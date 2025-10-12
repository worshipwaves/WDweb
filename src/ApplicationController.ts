/**
 * ApplicationController - Central state management and orchestration
 * 
 * Single source of truth for application state.
 * Coordinates between UI components and the facade.
 * Manages timers, autoplay, and phase transitions.
 */

import { AudioCacheService } from './AudioCacheService';
import {
  CompositionStateDTO,
  ApplicationState,
  type AudioProcessResponse,
  type CSGDataResponse,
  type WoodMaterialsConfig,
  WoodMaterialsConfigSchema,
} from './types/schemas';
import { WaveformDesignerFacade, Action } from './WaveformDesignerFacade';
import { fetchAndValidate } from './utils/validation';

// Subscriber callback type
type StateSubscriber = (state: ApplicationState) => void;

export class ApplicationController {
  private _state: ApplicationState | null = null;
  private _facade: WaveformDesignerFacade;
  private _subscribers: Set<StateSubscriber> = new Set();
  private _autoplayTimer?: number;
  private _hintTimer?: number;
  private _sceneManager: { 
    renderComposition: (csgData: CSGDataResponse) => Promise<void>;
    applySectionMaterials: () => void;
  } | null = null;
	private _audioCache: AudioCacheService;
	private _woodMaterialsConfig: WoodMaterialsConfig | null = null;
  private _selectedSectionIndex: number | null = null;
  
  constructor(facade: WaveformDesignerFacade) {
    this._facade = facade;
		this._audioCache = new AudioCacheService();
  }
	
	public get audioCache(): AudioCacheService {
    return this._audioCache;
  }
  
  /**
   * Initialize the controller with default or restored state
   */
  async initialize(): Promise<void> {
    // Fetch wood materials configuration first (foundational config)
    try {
      this._woodMaterialsConfig = await fetchAndValidate(
        '/api/config/wood-materials',
        WoodMaterialsConfigSchema
      );
      console.log('[Controller] Wood materials config loaded:', this._woodMaterialsConfig);
    } catch (error) {
      console.error('[Controller] Failed to load wood materials config:', error);
      throw error;
    }		
    // Try to restore saved state first
    const restored = this._facade.loadPersistedState();
    
    if (restored && restored.audio.rawSamples && restored.audio.rawSamples.length > 0) {
      // ONLY restore if we have the critical rawSamples data
      this._state = restored;
      // Re-cache the raw samples on load
      if (this._state.audio.audioSessionId) {
        this._audioCache.rehydrateCache(
          this._state.audio.audioSessionId,
          new Float32Array(this._state.audio.rawSamples)
        );
      }
      await this.dispatch({ type: 'STATE_RESTORED', payload: restored });
    } else {
      if (restored) {
        console.warn('[DEBUG] Restored state is invalid (missing rawSamples). Discarding and creating fresh state.');
      }
      // Create fresh state from backend defaults
      this._state = await this._facade.createInitialState();
    }
    
    this.notifySubscribers();
  }
  
  /**
   * Get current application state
   */
  getState(): ApplicationState {
    if (!this._state) {
      throw new Error('Controller not initialized. Call initialize() first.');
    }
    return this._state;
  }
  
  /**
   * Dispatch an action to update state
   */
  async dispatch(action: Action): Promise<void> {
    if (!this._state) {
      throw new Error('Controller not initialized');
    }
    
    // Special handling for file upload
    if (action.type === 'FILE_UPLOADED') {
      await this.handleFileUpload(action.payload);
      return;
    }
    
    // Process state transition through facade
    const newState = this._facade.processStateTransition(this._state, action);
    
    // Update state if changed
    if (newState !== this._state) {
      this._state = newState;
      this._facade.persistState(newState);
      this.notifySubscribers();
      
      // Handle side effects
      this.handleSideEffects(action);
    }
  }	

  /**
   * Register the SceneManager with the controller.
   * This allows the controller to directly trigger rendering operations.
   */
  registerSceneManager(sceneManager: { renderComposition: (csgData: CSGDataResponse) => Promise<void> }): void {
    this._sceneManager = sceneManager;
  }	
  
  /**
   * Subscribe to state changes
   */
  subscribe(callback: StateSubscriber): () => void {
    this._subscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this._subscribers.delete(callback);
    };
  }
  
  /**
   * Handle file upload with backend processing
   */
  private async handleFileUpload(file: File): Promise<void> {
    if (!this._state) return;

    // Update UI to show uploading
    await this.dispatch({
      type: 'PROCESSING_UPDATE',
      payload: { stage: 'uploading', progress: 0 },
    });

    try {
      // --- CRITICAL FIX: Force a complete state reset on new file upload ---
      // This ensures no stale data from localStorage can corrupt the new session.
      const freshState = await this._facade.createInitialState();
      this._state = freshState;
      
      // Clear the audio cache entirely to prevent any possible cross-contamination.
      this._audioCache.clearAll();

      // Process audio through facade using the guaranteed-clean state.
      const audioResponse: AudioProcessResponse = await this._facade.processAudio(
        file,
        this._state.composition // Use the newly created clean state
      );

      // CORRECTED: Cache the correct raw samples from the backend response
      const sessionId = this._audioCache.cacheRawSamples(
        file,
        new Float32Array(audioResponse.raw_samples_for_cache)
      );
      
      // Dispatch a single action with the complete, validated result from the backend.
      // This payload now matches what the FILE_PROCESSING_SUCCESS action expects.
      await this.dispatch({
        type: 'FILE_PROCESSING_SUCCESS',
        payload: {
          composition: audioResponse.updated_state,
          maxAmplitudeLocal: audioResponse.max_amplitude_local,
          rawSamplesForCache: audioResponse.raw_samples_for_cache, // Pass raw samples to the reducer
          audioSessionId: sessionId,
        },
      });
			
			// CRITICAL: Force composition to match UI controls on audio load
      const sectionsEl = document.getElementById('sections') as HTMLSelectElement;
      const slotsEl = document.getElementById('slots') as HTMLInputElement;
      const sizeEl = document.getElementById('size') as HTMLSelectElement;
      
      if (sectionsEl || slotsEl || sizeEl) {
        const uiComposition = { ...audioResponse.updated_state };
        let needsUpdate = false;
        
        if (sectionsEl && parseInt(sectionsEl.value) !== audioResponse.updated_state.frame_design.number_sections) {
          uiComposition.frame_design.number_sections = parseInt(sectionsEl.value, 10);
          needsUpdate = true;
        }
        if (sizeEl && parseFloat(sizeEl.value) !== audioResponse.updated_state.frame_design.finish_x) {
          const size = parseFloat(sizeEl.value);
          uiComposition.frame_design.finish_x = size;
          uiComposition.frame_design.finish_y = size;
          needsUpdate = true;
        }
        if (slotsEl && parseInt(slotsEl.value) !== audioResponse.updated_state.pattern_settings.number_slots) {
          uiComposition.pattern_settings.number_slots = parseInt(slotsEl.value, 10);
          needsUpdate = true;
        }
        
        // If UI differs from loaded state, update to match UI
        if (needsUpdate) {
          await this.handleCompositionUpdate(uiComposition);
        }
      }
    } catch (error: unknown) {
      console.error('File upload or processing failed:', error);
      await this.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'idle', progress: 0 },
      });
    }
  }
  
  /**
   * Start discovery phase with autoplay
   */
  private startDiscoveryPhase(): void {
    // Clear any existing timers
    this.clearTimers();
    
    // Start autoplay after 1 second
    setTimeout(() => {
      this.startAutoplay();
    }, 1000);
    
    // Show hint after 3 seconds
    this._hintTimer = window.setTimeout(() => {
      void this.dispatch({ type: 'SHOW_HINT' });
    }, 3000);
  }
  
  /**
   * Start carousel autoplay
   */
  startAutoplay(): void {
    if (this._autoplayTimer) {
      clearInterval(this._autoplayTimer);
    }
    
    this._autoplayTimer = window.setInterval(() => {
      if (!this._state || !this._state.ui.isAutoPlaying) {
        this.stopAutoplay();
        return;
      }
      
      const styles = this._facade.getStyleOptions();
      const nextIndex = (this._state.ui.currentStyleIndex + 1) % styles.length;
      
      void this.dispatch({ type: 'STYLE_SELECTED', payload: nextIndex });
    }, 4000);
  }
  
  /**
   * Stop carousel autoplay
   */
  stopAutoplay(): void {
    if (this._autoplayTimer) {
      clearInterval(this._autoplayTimer);
      this._autoplayTimer = undefined;
    }
    
    if (this._state?.ui.isAutoPlaying) {
      void this.dispatch({ type: 'AUTOPLAY_TOGGLED', payload: false });
    }
  }
  
  /**
   * Handle user interaction (stops autoplay)
   */
  handleUserInteraction(): void {
    this.stopAutoplay();
  }
  
  /**
   * Select a specific style
   */
  selectStyle(index: number): void {
    this.handleUserInteraction();
    void this.dispatch({ type: 'STYLE_SELECTED', payload: index });
  }
  
  /**
   * Transition to customization phase
   */
  enterCustomizationPhase(): void {
    this.stopAutoplay();
    void this.dispatch({ type: 'PHASE_CHANGED', payload: 'customization' });
  }
  
  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this._autoplayTimer) {
      clearInterval(this._autoplayTimer);
      this._autoplayTimer = undefined;
    }
    
    if (this._hintTimer) {
      clearTimeout(this._hintTimer);
      this._hintTimer = undefined;
    }
  }
  
  /**
   * Handle side effects after state changes
   */
  private handleSideEffects(action: Action): void {
    switch (action.type) {
      case 'FILE_PROCESSING_SUCCESS':
        this.startDiscoveryPhase();
        break;

      case 'PHASE_CHANGED':
        if (action.payload === 'discovery') {
          this.startDiscoveryPhase();
        } else if (action.payload === 'customization') {
          this.clearTimers();
        }
        break;
    }
  }
  
  /**
   * Notify all subscribers of state change
   */
  private notifySubscribers(): void {	
    if (!this._state) return;
    
    this._subscribers.forEach(callback => {
      callback(this._state!);
    });
  }
	
  private _detectChangedParams(
    oldComp: CompositionStateDTO,
    newComp: CompositionStateDTO
  ): string[] {
    const changed = new Set<string>();

    // Type-safe recursive comparison function
    const compareObjects = (
      o1: Record<string, unknown>,
      o2: Record<string, unknown>
    ) => {
      for (const key of Object.keys(o1)) {
        const val1 = o1[key];
        const val2 = o2[key];

        // Recurse into nested objects, ensuring they are valid objects before doing so.
        if (
          typeof val1 === 'object' && val1 !== null && !Array.isArray(val1) &&
          val2 && typeof val2 === 'object' && !Array.isArray(val2)
        ) {
          compareObjects(
            val1 as Record<string, unknown>,
            val2 as Record<string, unknown>
          );
        } else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
          // For primitives or arrays, a simple string comparison is sufficient
          // and safer than direct comparison for non-primitives.
          changed.add(key);
        }
      }
    };

    compareObjects(oldComp, newComp);
    return Array.from(changed);
  }
  
  /**
   * Handles a request to update the composition, using the smart processing pipeline.
   * This is the core of the optimization logic on the frontend.
   */
  async handleCompositionUpdate(initialComposition: CompositionStateDTO): Promise<void> {
    if (!this._state) {
      throw new Error('Controller not initialized');
    }
		
		// Create a mutable working copy to avoid reassigning the function parameter.
    let newComposition = initialComposition;

    // Check if the size has changed
    const oldSize = this._state.composition.frame_design.finish_x;
    const newSize = newComposition.frame_design.finish_x;

    if (oldSize !== newSize) {
      // Size has changed, apply smart defaults
      const sizeKey = String(newSize);
      const defaults = newComposition.size_defaults?.[sizeKey];

      if (defaults) {
        newComposition = {
          ...newComposition,
          pattern_settings: {
            ...newComposition.pattern_settings,
            number_slots: defaults.number_slots,
          },
          frame_design: {
            ...newComposition.frame_design,
            separation: defaults.separation,
          },
        };
      }
    }

    // 1. Detect what changed to determine the processing level.
    const changedParams = this._detectChangedParams(
      this._state.composition,
      newComposition
    );

    // If nothing relevant changed, just update the local state without an API call.
    if (changedParams.length === 0) {
      await this.dispatch({ type: 'COMPOSITION_UPDATED', payload: newComposition });
      return;
    }

    // 2. Check if this is an audio-level change that we can handle client-side
    const audioLevelParams = ['number_sections', 'number_slots', 'binning_mode'];
    const isAudioChange = changedParams.some(param => audioLevelParams.includes(param));
    
    let stateToSend = newComposition;
    
    if (isAudioChange && this._state.audio.audioSessionId) {
      const rebinnedAmplitudes = this._audioCache.rebinFromCache(
        this._state.audio.audioSessionId,
        {
          numSlots: newComposition.pattern_settings.number_slots,
          binningMode: 'mean_abs'
        }
      );
      
      if (rebinnedAmplitudes) {
        // The rebinned amplitudes are NORMALIZED (0-1). We send them directly
        // to the backend, which will calculate the new max_amplitude_local for
        // the new geometry and perform the final scaling.
        stateToSend = {
          ...newComposition,
          processed_amplitudes: Array.from(rebinnedAmplitudes)
        };
      } else {
        return; // Abort if we can't generate valid amplitudes
      }
		} else {
					// Filter valid amplitudes first
					const validAmps = this._state.composition.processed_amplitudes.filter(
						(amp): amp is number => amp !== null && isFinite(amp)
					);
					
					// CRITICAL: For geometry changes, send NORMALIZED amplitudes (0-1 range)
					// Backend will apply the new max_amplitude_local to these normalized values
					let normalizedAmps = validAmps;
					if (validAmps.length > 0) {
						const maxAmp = Math.max(...validAmps.map(Math.abs));
						if (maxAmp > 1.5) {
							// Amplitudes are already scaled, normalize them
							normalizedAmps = validAmps.map(a => a / maxAmp);
						}
					}
					
					stateToSend = {
							...newComposition,
							processed_amplitudes: normalizedAmps,
					};
				}
    
    try {
      // 3. Make one smart API call.
      const response = await this._facade.getSmartCSGData(
        stateToSend,
        changedParams,
        this._state.audio.previousMaxAmplitude
      );

      // 4. Handle the handshake: update state FIRST, then trigger the render.
      // This is the crucial step to prevent infinite loops.

      // First, update the application state internally with the new, processed state.
      // We do this BEFORE notifying subscribers to prevent race conditions.
      // Recalculate the max_amplitude_local from the NEWLY updated state from the server.
      // This ensures our reference for the next rescale is always correct.
      const newGeometry = this._facade.calculateGeometriesCore_TS(response.updated_state);
      const newMaxAmplitude = newGeometry.maxAmplitudeLocal;

      this._state = {
        ...this._state,
        composition: response.updated_state,
        audio: { // Also update the audio tracking state
          ...this._state.audio,
          // The new "previous" is the max amplitude we just calculated
          previousMaxAmplitude: newMaxAmplitude,
        },
      };

      // Manually persist the new state
      this._facade.persistState(this._state);
      
      // Now, trigger the render directly with the received CSG data.
      if (this._sceneManager) {
        await this._sceneManager.renderComposition(response.csg_data);
      }
      
      // Finally, notify all other UI components that the state has changed.
      this.notifySubscribers();

    } catch (error: unknown) {
      // Optionally dispatch an error state to the UI
    }
  }
	
	/**
   * Get wood materials configuration
   */
  getWoodMaterialsConfig(): WoodMaterialsConfig {
    if (!this._woodMaterialsConfig) {
      throw new Error('Wood materials config not loaded');
    }
    return this._woodMaterialsConfig;
  }
  
  /**
   * Select a section for material editing
   */
  selectSection(index: number): void {
    console.log(`[Controller] Section ${index} selected`);
    this._selectedSectionIndex = index;
  }
  
  /**
   * Get currently selected section index
   */
  getSelectedSection(): number | null {
    return this._selectedSectionIndex;
  }
  
	/**
   * Update material for a specific section
   * FRONTEND-ONLY: Does not trigger backend CSG regeneration
   */
  updateSectionMaterial(
    sectionId: number, 
    species: string, 
    grainDirection: 'horizontal' | 'vertical' | 'angled'
  ): void {
    if (!this._state) {
      throw new Error('State not initialized');
    }
    
    console.log(`[Controller] Updating section ${sectionId} material: ${species}, ${grainDirection} (frontend-only)`);
    
    // Get current section materials or create default array
    const currentMaterials = this._state.composition.frame_design.section_materials || [];
    
    // Create updated materials array immutably
    const updatedMaterials = [...currentMaterials];
    const existingIndex = updatedMaterials.findIndex(m => m.section_id === sectionId);
    
    const newMaterial = {
      section_id: sectionId,
      species: species,
      grain_direction: grainDirection
    };
    
    if (existingIndex >= 0) {
      updatedMaterials[existingIndex] = newMaterial;
    } else {
      updatedMaterials.push(newMaterial);
    }
    
    // Update state locally WITHOUT backend call
    this._state = {
      ...this._state,
      composition: {
        ...this._state.composition,
        frame_design: {
          ...this._state.composition.frame_design,
          section_materials: updatedMaterials
        }
      }
    };
    
    // Notify SceneManager to update materials only (no CSG regeneration)
    if (this._sceneManager) {
      this._sceneManager.applySectionMaterials();
    }
    
    // Notify subscribers of state change
    this.notifySubscribers();
  }
  
  /**
   * Clean up controller
   */
  dispose(): void {
    this.clearTimers();
    this._subscribers.clear();
    
    if (this._state) {
      this._facade.persistState(this._state);
    }
  }
}
