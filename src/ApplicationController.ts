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
import { PerformanceMonitor } from './PerformanceMonitor';

// Subscriber callback type
type StateSubscriber = (state: ApplicationState) => void;


/**
 * Check if a grain direction is available for a given number of sections.
 */
function isGrainAvailableForN(grain: string, n: number): boolean {
  if (grain === 'diamond') return n === 4;
  if (grain === 'radiant') return n >= 2;
  return true; // horizontal/vertical always available
}

/**
 * Initialize section_materials array when number_sections changes.
 * Implements smart inheritance: unanimous species/grain → inherit, mixed → defaults.
 */
function initializeSectionMaterials(
  oldN: number,
  newN: number,
  uiCapturedMaterials: SectionMaterial[],
  config: WoodMaterialsConfig
): SectionMaterial[] {
  // If N is unchanged, do nothing
  if (newN === oldN) {
    return uiCapturedMaterials;
  }

  // Step 1: Determine intended species and grain from UI-captured state
  const allSameSpecies = uiCapturedMaterials.length > 0 && 
    uiCapturedMaterials.every(m => m.species === uiCapturedMaterials[0].species);
  const allSameGrain = uiCapturedMaterials.length > 0 && 
    uiCapturedMaterials.every(m => m.grain_direction === uiCapturedMaterials[0].grain_direction);

  const intendedSpecies = allSameSpecies ? uiCapturedMaterials[0].species : config.default_species;
  let intendedGrain = allSameGrain ? uiCapturedMaterials[0].grain_direction : config.default_grain_direction;

  // Step 2: Validate intended grain against NEW number of sections
  if (!isGrainAvailableForN(intendedGrain, newN)) {
    console.log(`[initializeSectionMaterials] Grain "${intendedGrain}" not available for n=${newN}, falling back to vertical`);
    intendedGrain = 'vertical';
  }

  // Step 3: Build new materials array from scratch to correct size (newN)
  const newMaterials: SectionMaterial[] = [];
  for (let i = 0; i < newN; i++) {
    const species = uiCapturedMaterials[i]?.species || intendedSpecies;
    newMaterials.push({
      section_id: i,
      species: species,
      grain_direction: intendedGrain as 'horizontal' | 'vertical' | 'radiant' | 'diamond'
    });
  }

  console.log(`[initializeSectionMaterials] Finalized for n=${newN}:`, newMaterials);
  return newMaterials;
}

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
  private _selectedSectionIndices: Set<number> = new Set();
  private _idleTextureLoader: any = null; // IdleTextureLoader instance
  
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
  registerSceneManager(sceneManager: { 
    renderComposition: (csgData: CSGDataResponse) => Promise<void>;
    applySectionMaterials: () => void;
  }): void {
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
	 * Wait for walnut textures to be ready (don't remove overlay until they're loaded)
	 */
	private async waitForWalnutTextures(): Promise<void> {
		if (!this._sceneManager || !this._woodMaterialsConfig) {
			console.warn('[Controller] Cannot wait for textures - sceneManager or config not available');
			return;
		}
		
		const textureCache = (this._sceneManager as any)._textureCache;
		if (!textureCache) {
			console.warn('[Controller] TextureCache not available');
			return;
		}
		
		const walnut = this._woodMaterialsConfig.species_catalog.find((s: any) => s.id === 'walnut-black-american');
		if (!walnut) {
			console.warn('[Controller] Walnut species not found in catalog');
			return;
		}
		
		const basePath = this._woodMaterialsConfig.texture_config.base_texture_path;
		const sizeInfo = this._woodMaterialsConfig.texture_config.size_map.large;
		const albedoPath = `${basePath}/${walnut.id}/Varnished/${sizeInfo.folder}/Diffuse/wood-${walnut.wood_number}_${walnut.id}-varnished-${sizeInfo.dimensions}_d.png`;
		
		console.log('[Controller] Waiting for walnut albedo texture:', albedoPath);
		
		// Get the texture from cache
		const texture = textureCache.getTexture(albedoPath);
		
		if (texture.isReady()) {
			console.log('[Controller] Walnut texture already ready');
			return; // Already ready
		}
		
		// Wait for texture to load
		console.log('[Controller] Walnut texture loading...');
		return new Promise((resolve) => {
			texture.onLoadObservable.addOnce(() => {
				console.log('[Controller] Walnut texture loaded');
				resolve();
			});
			
			// Timeout after 5 seconds to prevent infinite wait
			setTimeout(() => {
				console.warn('[Controller] Walnut texture load timeout - proceeding anyway');
				resolve();
			}, 5000);
		});
	}
  
  /**
   * Handle file upload with backend processing
   * @param file - The uploaded audio file
   * @param uiSnapshot - UI state captured by main.ts before dispatch
   */
  private async handleFileUpload(file: File, uiSnapshot: CompositionStateDTO): Promise<void> {
    if (!this._state) return;

    PerformanceMonitor.start('total_upload_to_render');
    
    // Update UI to show uploading
    await this.dispatch({
      type: 'PROCESSING_UPDATE',
      payload: { stage: 'uploading', progress: 0 },
    });

    try {
      PerformanceMonitor.start('backend_audio_processing');
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
      PerformanceMonitor.end('backend_audio_processing');

      PerformanceMonitor.start('cache_raw_samples');
      // Cache the raw samples
      const sessionId = this._audioCache.cacheRawSamples(
        file,
        new Float32Array(audioResponse.raw_samples_for_cache)
      );
      PerformanceMonitor.end('cache_raw_samples');
      
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
      
      /// Show "Preparing your custom art experience!" message
      await this.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'preparing_textures', progress: 0 },
      });
      
      // TEMPORARILY DISABLED TO TEST IF IDLE TEXTURE LOADING BLOCKS SECTION CHANGES
			/*
			// Start texture preload in background (don't await - let render proceed)
			if (this._sceneManager && this._woodMaterialsConfig) {
				const textureCache = (this._sceneManager as any)._textureCache;
				if (textureCache && typeof textureCache.preloadAllTextures === 'function') {
					textureCache.preloadAllTextures(this._woodMaterialsConfig).then((idleLoader: any) => {
						this._idleTextureLoader = idleLoader;
						console.log('[Controller] Idle texture loader initialized');
						
						const indicator = document.getElementById('textureLoadingIndicator');
						const loadedEl = document.getElementById('texturesLoaded');
						const totalEl = document.getElementById('texturesTotal');
						
						if (indicator && loadedEl && totalEl) {
							console.log('[Controller] Setting up progress callback');
							idleLoader.onProgress((loaded: number, total: number) => {
								console.log(`[Controller] Progress callback fired: ${loaded}/${total}`);
								loadedEl.textContent = String(loaded);
								totalEl.textContent = String(total);
								
								if (loaded < total) {
									indicator.classList.add('active');
								} else {
									console.log('[Controller] All textures loaded, hiding indicator');
									setTimeout(() => {
										indicator.classList.remove('active');
									}, 2000);
								}
							});
						}
					}).catch((error: unknown) => {
						console.error('[Controller] Texture preload failed:', error);
					});
				}
			}
			*/
			
			console.log('[Controller] Texture preloading DISABLED for testing');
      
      PerformanceMonitor.start('csg_generation_and_render');
			
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
          console.log('[Controller] Starting renderComposition...');
          await this._sceneManager.renderComposition(response);
          console.log('[Controller] renderComposition complete, waiting for visibility...');
          
          // Wait a frame to ensure render is actually visible
          await new Promise(resolve => requestAnimationFrame(resolve));
          console.log('[Controller] Render should now be visible');
        }
      }
      
      PerformanceMonitor.end('csg_generation_and_render');
      
      // CRITICAL: Wait for walnut textures to be ready before removing overlay
      // This prevents user seeing black meshes while textures load
      console.log('[Controller] Waiting for walnut textures to be ready...');
      await this.waitForWalnutTextures();
      console.log('[Controller] Walnut textures ready - removing overlay');
      
      PerformanceMonitor.end('total_upload_to_render');
      
      // Reset processing stage after successful render
      console.log('[Controller] Resetting processing stage to idle');
      await this.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'idle', progress: 0 },
      });
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

    console.log('[handleCompositionUpdate] ENTRY - finish_x:', newComposition.frame_design.finish_x, 'finish_y:', newComposition.frame_design.finish_y);
    
    // Check if the size has changed
    const oldSize = this._state.composition.frame_design.finish_x;
    const newSize = newComposition.frame_design.finish_x;

    if (oldSize !== newSize) {
      console.log('[handleCompositionUpdate] Size changed detected, applying defaults');
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
				
				// Update UI dropdown to hide/show grain options and reset to valid value if needed
				if (typeof window !== 'undefined' && (window as any).updateGrainDirectionOptionsFromController) {
					(window as any).updateGrainDirectionOptionsFromController(newN);
				}
      }
    }
		
		// Initialize section_materials when number_sections changes (CHAT 2 FIX)
    const oldN = this._state.composition.frame_design.number_sections;
    const newN = newComposition.frame_design.number_sections;

    if (oldN !== newN) {
    console.log(`[Controller] number_sections changed ${oldN}→${newN}, initializing materials`);
    
    // CRITICAL: Use materials from UI snapshot, NOT old state
    const uiCapturedMaterials = newComposition.frame_design.section_materials || [];
    const initializedMaterials = initializeSectionMaterials(
      oldN,
      newN,
      uiCapturedMaterials,
      this._woodMaterialsConfig
    );
      
      newComposition = {
        ...newComposition,
        frame_design: {
          ...newComposition.frame_design,
          section_materials: initializedMaterials
        }
      };
    }

    // 1. Detect what changed to determine the processing level.
    const changedParams = this._detectChangedParams(
      this._state.composition,
      newComposition
    );

    // DIAGNOSTIC: Log what changed
    console.log('[Controller] Changed params detected:', changedParams);

    // If nothing relevant changed, just update the local state without an API call.
    if (changedParams.length === 0) {
      await this.dispatch({ type: 'COMPOSITION_UPDATED', payload: newComposition });
      return;
    }

    // 2. Check if ONLY material properties changed (fast path - no backend call)
    const onlyMaterialsChanged = changedParams.every(param => 
      param === 'section_materials' || param.startsWith('section_materials.')
    );

    if (onlyMaterialsChanged) {
      console.log('[Controller] Material-only change detected - applying without backend call');
      
      // Update state locally
      this._state = {
        ...this._state,
        composition: newComposition
      };
      
      // Persist state
      this._facade.persistState(this._state);
      
      // Apply materials to existing meshes (no CSG regeneration)
      if (this._sceneManager) {
        // When no specific sections are selected, this implies an update to all
        const targets = this._selectedSectionIndices.size > 0 
          ? this._selectedSectionIndices 
          : new Set(Array.from({ length: this._state.composition.frame_design.number_sections }, (_, i) => i));

        targets.forEach(sectionId => {
          this._sceneManager.applySingleSectionMaterial(sectionId);
        });
      }
      
      // Notify subscribers
      this.notifySubscribers();
      
      return; // CRITICAL: Stop execution here to prevent full re-render
    }

    // 3. Check if this is an audio-level change that we can handle client-side
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
      // 4. Make one smart API call.
      const response = await this._facade.getSmartCSGData(
        stateToSend,
        changedParams,
        this._state.audio.previousMaxAmplitude
      );

      // 5. Handle the handshake: update state FIRST, then trigger the render.
      // This is the crucial step to prevent infinite loops.

      // First, update the application state internally with the new, processed state.
      // We do this BEFORE notifying subscribers to prevent race conditions.
      // The backend is now the single source of truth for calculations.
      // We read the new max amplitude directly from the API response.
      this._state = {
        ...this._state,
        composition: response.updated_state,
        audio: { // Also update the audio tracking state
          ...this._state.audio,
          // The new "previous" is the value calculated and returned by the backend.
          previousMaxAmplitude: response.max_amplitude_local,
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
  selectSection(indices: Set<number>): void {
    console.log(`[Controller] Selection updated:`, Array.from(indices));
    this._selectedSectionIndices = new Set(indices);
  }
  
  /**
   * Get currently selected section index
   */
  getSelectedSections(): Set<number> {
    return this._selectedSectionIndices;
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
    
    // Notify SceneManager to update ONLY the changed section (no CSG regeneration)
    if (this._sceneManager) {
      this._sceneManager.applySingleSectionMaterial(sectionId);
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
	
	public updateSectionMaterialsArray(newMaterials: Array<{section_id: number, species: string, grain_direction: string}>): void {
    console.log('[Controller] updateSectionMaterialsArray called with:', newMaterials);
    
    // CRITICAL: Completely replace the array, don't merge with old entries
    const cleanMaterials = newMaterials.map(m => ({
      section_id: m.section_id,
      species: m.species,
      grain_direction: m.grain_direction
    }));
    
    console.log('[Controller] Setting section_materials to:', cleanMaterials);
    
    // Update state with completely new array
    this._state.composition = {
      ...this._state.composition,
      frame_design: {
        ...this._state.composition.frame_design,
        section_materials: cleanMaterials
      }
    };
    
    console.log('[Controller] State after update:', this._state.composition.frame_design.section_materials);
    
    this.notifySubscribers();
  }
}