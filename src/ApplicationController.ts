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
    try {
      // Initialize facade (loads style presets)
      await this._facade.initialize();
      
      // Load wood materials configuration
      this._woodMaterialsConfig = await fetchAndValidate<WoodMaterialsConfig>(
        'http://localhost:8000/api/config/wood-materials',
        WoodMaterialsConfigSchema
      );
      console.log('[Controller] Wood materials config loaded:', this._woodMaterialsConfig);
    } catch (error) {
      console.error('[Controller] Failed to load configuration:', error);
      throw error;
    }
    
    // Load fresh defaults first
    const freshDefaults = await this._facade.createInitialState();
    
    // Try to restore saved state
    const restored = this._facade.loadPersistedState();
    
    if (restored && restored.audio.rawSamples && restored.audio.rawSamples.length > 0) {
      // Deep merge: preserved user settings + new schema fields from defaults
      this._state = this._facade.mergeStates(freshDefaults, restored);
      
      // Re-cache the raw samples on load
      if (this._state.audio.audioSessionId) {
        this._audioCache.rehydrateCache(
          this._state.audio.audioSessionId,
          new Float32Array(this._state.audio.rawSamples)
        );
      }
      await this.dispatch({ type: 'STATE_RESTORED', payload: this._state });
    } else {
      if (restored) {
        console.warn('[DEBUG] Restored state is invalid (missing rawSamples). Discarding and creating fresh state.');
      }
      this._state = freshDefaults;
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
      await this.handleFileUpload(action.payload.file, action.payload.uiSnapshot);
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
   * @param file - The uploaded audio file
   * @param uiSnapshot - UI state captured by main.ts before dispatch
   */
  private async handleFileUpload(file: File, uiSnapshot: CompositionStateDTO): Promise<void> {
    if (!this._state) return;

    // Update UI to show uploading
    await this.dispatch({
      type: 'PROCESSING_UPDATE',
      payload: { stage: 'uploading', progress: 0 },
    });

    try {
      // Force a complete state reset on new file upload
      const freshState = await this._facade.createInitialState();
      this._state = freshState;
      
      // Clear the audio cache
      this._audioCache.clearAll();

      // Process audio through facade
      const audioResponse: AudioProcessResponse = await this._facade.processAudio(
        file,
        this._state.composition
      );

      // Cache the raw samples
      const sessionId = this._audioCache.cacheRawSamples(
        file,
        new Float32Array(audioResponse.raw_samples_for_cache)
      );
      
      // Dispatch the backend response (subscribers will sync UI to backend defaults)
      await this.dispatch({
        type: 'FILE_PROCESSING_SUCCESS',
        payload: {
          composition: audioResponse.updated_state,
          maxAmplitudeLocal: audioResponse.max_amplitude_local,
          rawSamplesForCache: audioResponse.raw_samples_for_cache,
          audioSessionId: sessionId,
        },
      });
			
			// Compare user's pre-upload UI choices with backend defaults
      const backendComp = audioResponse.updated_state;
      const changedParams = this._detectChangedParams(backendComp, uiSnapshot);
      
      if (changedParams.length > 0) {
        // User changed UI before upload, use their values
        await this.handleCompositionUpdate(uiSnapshot);
      } else {
        // UI matched defaults, trigger initial render
        const response = await this._facade.getSmartCSGData(
          audioResponse.updated_state,
          [],
          null
        );
        
        if (this._sceneManager) {
          await this._sceneManager.renderComposition(response);
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

    // CRITICAL: Ensure both dimensions match for circular shapes
    // This prevents mismatch bugs from UI snapshot capture or state restoration
    if (newComposition.frame_design.shape === 'circular') {
      const size = newComposition.frame_design.finish_x;
      if (newComposition.frame_design.finish_y !== size) {
        console.warn(`[Controller] Correcting finish_y mismatch: ${newComposition.frame_design.finish_y} → ${size}`);
        newComposition = {
          ...newComposition,
          frame_design: {
            ...newComposition.frame_design,
            finish_x: size,
            finish_y: size,
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
        await this._sceneManager.renderComposition(response);
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
