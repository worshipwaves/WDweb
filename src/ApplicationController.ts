/**
 * ApplicationController - Central state management and orchestration
 * 
 * Single source of truth for application state.
 * Coordinates between UI components and the facade.
 * Manages timers, autoplay, and phase transitions.
 */

import { AudioCacheService } from './AudioCacheService';
import { PanelStackManager } from './components/PanelStackManager';
import { FilterIconStrip } from './components/FilterIconStrip';
import type { FilterIconGroup } from './types/PanelTypes';
import { RightPanelContentRenderer } from './components/RightPanelContent';
import { SliderGroup } from './components/SliderGroup';
import { ThumbnailGrid } from './components/ThumbnailGrid';
import { WoodMaterialInlineGrid } from './components/WoodMaterialInlineGrid';
import { PerformanceMonitor } from './PerformanceMonitor';
import {
  CompositionStateDTO,
  ApplicationState,
  type AudioProcessResponse,
  type CSGDataResponse,
  type WoodMaterialsConfig,
  WoodMaterialsConfigSchema,
  type SectionMaterial,
} from './types/schemas';
import { fetchAndValidate } from './utils/validation';
import { WaveformDesignerFacade, Action } from './WaveformDesignerFacade';
import type { ThumbnailConfig, CategoriesConfig } from './types/PanelTypes';

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
    intendedGrain = 'vertical';
  }

  // Step 3: Build new materials array from scratch to correct size (newN)
  const newMaterials: SectionMaterial[] = [];
  for (let i = 0; i < newN; i++) {
    const species = uiCapturedMaterials[i]?.species || intendedSpecies;
    newMaterials.push({
      section_id: i,
      species: species,
      grain_direction: intendedGrain
    });
  }

  return newMaterials;
}

export class ApplicationController {
  private _state: ApplicationState | null = null;
  private _facade: WaveformDesignerFacade;
  private _subscribers: Set<StateSubscriber> = new Set();
  private _autoplayTimer?: number;
  private _hintTimer?: number;
  private _panelStack: PanelStackManager | null = null;
  private _sceneManager: { 
    renderComposition: (csgData: CSGDataResponse) => Promise<void>;
    applySectionMaterials: () => void;
    applySingleSectionMaterial?: (sectionId: number) => void;
  } | null = null;
	private _audioCache: AudioCacheService;
  private _woodMaterialsConfig: WoodMaterialsConfig | null = null;
  private _selectedSectionIndices: Set<number> = new Set();
  private _idleTextureLoader: unknown = null; // IdleTextureLoader instance
	
	// Four-panel navigation state
  private _activeCategory: string | null = null;
  private _activeSubcategory: string | null = null;
  private _activeFilters: Map<string, Set<string>> = new Map();
	private _categoryFilterState: Map<string, Map<string, Set<string>>> = new Map();
  private _thumbnailConfig: ThumbnailConfig | null = null;
  private _categoriesConfig: CategoriesConfig | null = null;
	private _archetypes: Map<string, any> = new Map();
  
  // Four-panel DOM references
  private _leftSecondaryPanel: HTMLElement | null = null;
  private _rightSecondaryPanel: HTMLElement | null = null;
  private _rightMainPanel: HTMLElement | null = null;
  private _filterIconStrip: FilterIconStrip | null = null;
  
  constructor(facade: WaveformDesignerFacade) {
    this._facade = facade;
		this._audioCache = new AudioCacheService();
		this._panelStack = new PanelStackManager('right-panel-stack');
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
			
			// Initialize panel references (DOM is ready at this point)
      this._leftSecondaryPanel = document.getElementById('left-secondary-panel');
      this._rightSecondaryPanel = document.getElementById('right-secondary-panel');
      this._rightMainPanel = document.getElementById('right-main-panel');
      
      if (!this._leftSecondaryPanel || !this._rightSecondaryPanel || !this._rightMainPanel) {
        console.warn('[Controller] Four-panel DOM elements not found');
      }
      
      // Load wood materials configuration
      this._woodMaterialsConfig = await fetchAndValidate<WoodMaterialsConfig>(
        'http://localhost:8000/api/config/wood-materials',
        WoodMaterialsConfigSchema
      );
			
			// Load thumbnail and categories configuration
      // Load all configs in parallel
			const [archetypes, woodMaterials, uiConfig, compositionDefaults] = await Promise.all([
				fetch('http://localhost:8000/api/config/archetypes').then(r => r.json()),
				fetch('http://localhost:8000/api/config/wood-materials').then(r => r.json()),
				fetch('http://localhost:8000/api/config/ui').then(r => r.json()),
				fetch('http://localhost:8000/api/config/composition-defaults').then(r => r.json())
			]);

			// Store archetypes
			Object.entries(archetypes).forEach(([id, data]: [string, any]) => {
				this._archetypes.set(id, data);
			});

			// Store configs
			this._woodMaterialsConfig = woodMaterials;
			this._thumbnailConfig = (uiConfig as any).thumbnail_config;
			this._categoriesConfig = (uiConfig as any).categories;
			
    } catch (error: unknown) {
      console.error('[Controller] Failed to load configuration:', error);
    }
    
    // Load fresh defaults first
    const freshDefaults = await this._facade.createInitialState();
    
    // Try to restore saved state
    const restored = this._facade.loadPersistedState();
    
    if (restored && restored.audio.rawSamples && restored.audio.rawSamples.length > 0) {
      // Deep merge: preserved user settings + new schema fields from defaults
      this._state = this._facade.mergeStates(freshDefaults, restored);
      
      // CRITICAL: Scale normalized amplitudes to physical space
      // Persisted state may contain 0-1 normalized values that need scaling
      const amps = this._state.composition.processed_amplitudes;
      if (amps && amps.length > 0) {
        const maxAmp = Math.max(...amps.map(Math.abs));
        if (maxAmp > 0 && maxAmp <= 1.5) {
          console.log(`[Controller] Detected normalized amplitudes (max=${maxAmp.toFixed(4)}), scaling to physical space`);
          
          // Call backend to get max_amplitude_local for current geometry
          const response = await fetch('http://localhost:8000/geometry/csg-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              state: this._state.composition,
              changed_params: [],
              previous_max_amplitude: null
            })
          });
          
          if (response.ok) {
            const csgData = await response.json() as { max_amplitude_local: number };
            const maxAmplitudeLocal = csgData.max_amplitude_local;
            
            // Scale amplitudes to physical dimensions
            const scaledAmps = amps.map(a => a * maxAmplitudeLocal);
            this._state = {
              ...this._state,
              composition: {
                ...this._state.composition,
                processed_amplitudes: scaledAmps
              },
              audio: {
                ...this._state.audio,
                previousMaxAmplitude: maxAmplitudeLocal
              }
            };
            
            console.log(`[Controller] Scaled amplitudes: max=${Math.max(...scaledAmps).toFixed(4)}`);
          }
        }
      }
      
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
    
    // Update panels based on new state
    this.handlePanelUpdates(this._state);
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
   * Forcibly resets the application to a fresh, default state.
   * Used by the demo player to ensure a clean start.
   */
  public async resetToDefaultState(): Promise<void> {
    this._state = await this._facade.createInitialState();
    this.notifySubscribers();
    // Also clear any visual remnants from previous state
    if (this._sceneManager) {
      const csgData = await this._facade.getSmartCSGData(this._state.composition, [], null);
      await this._sceneManager.renderComposition(csgData);
    }
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
    applySingleSectionMaterial?: (sectionId: number) => void;
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
		
		const textureCache = this._sceneManager ? (this._sceneManager as { _textureCache?: { getTexture: (path: string) => { isReady: () => boolean; onLoadObservable: { addOnce: (callback: () => void) => void } } } })._textureCache : undefined;
		if (!textureCache) {
			console.warn('[Controller] TextureCache not available');
			return;
		}
		
		const walnut = this._woodMaterialsConfig.species_catalog.find(s => s.id === 'walnut-black-american');
		
		if (!walnut) {
			console.warn('[Controller] Walnut species not found in catalog');
			return;
		}
		
		const basePath = this._woodMaterialsConfig.texture_config.base_texture_path;
		const sizeInfo = this._woodMaterialsConfig.texture_config.size_map.large;
		const albedoPath = `${basePath}/${walnut.id}/Varnished/${sizeInfo.folder}/Diffuse/wood-${walnut.wood_number}_${walnut.id}-varnished-${sizeInfo.dimensions}_d.png`;
		
		// Get the texture from cache
		if (!textureCache) return;
		
		const texture = textureCache.getTexture(albedoPath);
		
		if (texture.isReady()) {
			return; // Already ready
		}
		
		// Wait for texture to load
		return new Promise<void>((resolve) => {
			texture.onLoadObservable.addOnce(() => {
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
          await this._sceneManager.renderComposition(response);
          
          // Wait a frame to ensure render is actually visible
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
      }
      
      PerformanceMonitor.end('csg_generation_and_render');
      
      // CRITICAL: Wait for walnut textures to be ready before removing overlay
      // This prevents user seeing black meshes while textures load
      await this.waitForWalnutTextures();
      
      PerformanceMonitor.end('total_upload_to_render');
      
      // Reset processing stage after successful render
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
	
	/**
   * Handle panel updates based on state changes
   * Called automatically when state changes affect UI
   */
  private handlePanelUpdates(state: ApplicationState): void {
    if (!this._panelStack) return;
    
    // Clear panels on phase change
    if (state.ui.phase === 'upload') {
      this._panelStack.clearStack();
    }
  }
	
	/**
   * Handle category selection from left panel
   * Clears right panel stack and renders category-specific content
   */
  handleCategorySelected(categoryId: string): void {
    if (!this._panelStack || !this._state) return;
    
    // Save current category's filter state before switching
    if (this._activeCategory && this._activeFilters.size > 0) {
      this._categoryFilterState.set(this._activeCategory, new Map(this._activeFilters));
    }
    
    // Switch to new category
    this._activeCategory = categoryId;
    this._activeSubcategory = null;
    
    // Restore saved filter state for this category, or start fresh
    const savedFilters = this._categoryFilterState.get(categoryId);
    if (savedFilters) {
      this._activeFilters = new Map(savedFilters);
    } else {
      this._activeFilters.clear();
    }
    
    // All categories now use the four-panel architecture
    this._handleStyleCategorySelected();
  }
  
  /**
   * Handle STYLE category selection (four-panel architecture)
   * @private
   */
	private _handleStyleCategorySelected(): void {
    if (!this._categoriesConfig || !this._activeCategory || !this._thumbnailConfig) return;
    const categoryConfig = this._categoriesConfig[this._activeCategory as keyof CategoriesConfig];
    if (!categoryConfig) return;
		
		const subcategories = Object.entries(categoryConfig.subcategories).map(([id, config]) => ({ id, config }));
    
		// Auto-select subcategory and filters based on current state
    const currentComposition = this._state?.composition;
    if (currentComposition) {
      if (subcategories.length === 1) {
        // Correctly select the single subcategory for Layout, Wood, etc.
        this._activeSubcategory = subcategories[0].id;
      } else {
        this._activeSubcategory = null;
      }
      
      // Initialize filters only if not already set (first visit to category)
      if (!this._activeFilters.has('shape')) {
        this._activeFilters.set('shape', new Set<string>());
      }
      if (!this._activeFilters.has('slot_pattern')) {
        this._activeFilters.set('slot_pattern', new Set<string>());
      }
    }
    
    // Hide legacy panel stack
		if (this._panelStack) {
			this._panelStack.clearStack();
		}
		const stackContainer = document.getElementById('right-panel-stack');
		if (stackContainer) {
			stackContainer.style.display = 'none';
		}
		
		// If auto-selection succeeded, defer right panel rendering to next tick
		// This ensures all state and async imports complete before rendering
		if (currentComposition && this._activeSubcategory) {
			const selectedSubcategory = this._activeSubcategory;
			requestAnimationFrame(() => {
				this._handleSubcategorySelected(selectedSubcategory);
			});
		}

    if (subcategories.length === 1) {
      // Auto-select single subcategory, hide secondary panel
      if (this._leftSecondaryPanel) {
        this._leftSecondaryPanel.style.display = 'none';
        this._leftSecondaryPanel.classList.remove('visible');
      }			
			// Update camera offset after panel hides
      requestAnimationFrame(() => {
        if (this._sceneManager && 'updateCameraOffset' in this._sceneManager) {
          (this._sceneManager as { updateCameraOffset: () => void }).updateCameraOffset();
        }
      });
      // Single-subcategory rendering handled by deferred requestAnimationFrame above
    } else if (subcategories.length > 1) {
      // Show placeholder and subcategory choices for multiple options
      if (this._rightMainPanel) {
        this._rightMainPanel.innerHTML = '<div class="panel-content"><div style="padding: 40px 20px; text-align: center; color: rgba(255, 255, 255, 0.6);"><div style="font-size: 48px; margin-bottom: 16px;">←</div><div style="font-size: 16px; font-weight: 500;">Select a subcategory</div></div></div>';
        this._rightMainPanel.style.display = 'block';
      }
      import('./components/LeftSecondaryPanel').then(({ LeftSecondaryPanel }) => {
        const panel = new LeftSecondaryPanel(subcategories, this._activeSubcategory, (id: string) => this._handleSubcategorySelected(id));
        if (this._leftSecondaryPanel) {
          this._leftSecondaryPanel.innerHTML = '';
          this._leftSecondaryPanel.appendChild(panel.render());
          this._leftSecondaryPanel.style.display = 'block';
          this._leftSecondaryPanel.classList.add('visible');
        }
				
				// Update camera offset after panel visibility changes
        requestAnimationFrame(() => {
          if (this._sceneManager && 'updateCameraOffset' in this._sceneManager) {
            (this._sceneManager as { updateCameraOffset: () => void }).updateCameraOffset();
          }
        });
      }).catch((error: unknown) => console.error('[Controller] Failed to load LeftSecondaryPanel:', error));
    } else {
      // No subcategories found, show placeholder
      if (this._leftSecondaryPanel) {
        this._leftSecondaryPanel.style.display = 'none';
        this._leftSecondaryPanel.classList.remove('visible');
      }
      if (this._rightMainPanel) {
        this._rightMainPanel.innerHTML = '<div class="panel-content"><div class="panel-placeholder"><p>No options available for this category yet.</p></div></div>';
        this._rightMainPanel.style.display = 'block';
      }
    }
  }
  
  /**
   * Handle subcategory selection (Left Secondary → Right Secondary + Right Main)
   * @private
   */
  private _handleSubcategorySelected(subcategoryId: string): void {
    if (!this._categoriesConfig || !this._activeCategory) return;
    const categoryConfig = this._categoriesConfig[this._activeCategory as keyof CategoriesConfig];
    if (!categoryConfig) return;

    this._activeSubcategory = subcategoryId;

    const subcategory = categoryConfig.subcategories[subcategoryId];
    if (!subcategory) return;
    
    // Initialize filters to empty Set (no filter = show ALL)
    Object.entries(subcategory.filters).forEach(([filterId, filterConfig]) => {
			if (!this._activeFilters.has(filterId)) {
				this._activeFilters.set(filterId, new Set());
			}
		});
		
		// Update camera offset after right secondary visibility changes
    requestAnimationFrame(() => {
      if (this._sceneManager && 'updateCameraOffset' in this._sceneManager) {
        (this._sceneManager as { updateCameraOffset: () => void }).updateCameraOffset();
      }
    });

    // Always render the main panel after subcategory selection
    this._renderRightMainFiltered();
  }
  
  /**
   * Handle filter selection (Icon strip → updates Right Main display only)
   * CRITICAL: Does NOT update composition state
   * @private
   */
  private _handleFilterSelected(filterId: string, selections: Set<string>): void {
    if (!this._activeSubcategory) return;
    
    // Update filter selection (transient display state)
    this._activeFilters.set(filterId, selections);
    
    // Re-render Right Main with new filter combination
    this._renderRightMainFiltered();
    
    // NO dispatch() call - filters don't update composition state
  }
	
	/**
   * Build filter icon groups from subcategory filter config
   * @private
   */
  private _buildFilterIconGroups(filters: Record<string, import('./types/PanelTypes').FilterConfig>): FilterIconGroup[] {
    const groups: FilterIconGroup[] = [];
    
    // Build shape filter group (Panel Shape)
    if (filters.shape) {
      groups.push({
        id: 'shape',
        type: 'shape',
        label: 'Panel Shape',
        icons: filters.shape.options.map(opt => ({
        id: opt.id,
        svgPath: `/assets/icons/${opt.id === 'circular' ? 'circle' : opt.id === 'rectangular' ? 'rectangle' : 'diamond'}.svg`,
        tooltip: opt.tooltip || `${opt.label} Panel`,
        stateValue: opt.id
      }))
      });
    }
    
    // Build slot_pattern filter group (Waveform Pattern)
    if (filters.slot_pattern) {
      groups.push({
        id: 'slot_pattern',
        type: 'waveform',
        label: 'Waveform Pattern',
        icons: filters.slot_pattern.options.map(opt => ({
					id: opt.id,
					svgPath: `/assets/icons/${opt.id}.svg`,
					tooltip: opt.tooltip || `${opt.label} Waveform`,
					stateValue: opt.id
				}))
      });
    }
    
    return groups;
  }
  
  /**
   * Handle icon filter change from FilterIconStrip
   * @private
   */
  private _handleIconFilterChange(groupId: string, selections: Set<string>): void {
    this._handleFilterSelected(groupId, selections);
  }
  
  /**
   * Render Right Main panel with current filter combination
   * @private
   */
  private _renderRightMainFiltered(): void {
		if (!this._categoriesConfig || !this._activeCategory || !this._activeSubcategory || !this._rightMainPanel) return;

		const categoryConfig = this._categoriesConfig[this._activeCategory as keyof CategoriesConfig];
		const subcategory = categoryConfig?.subcategories[this._activeSubcategory];
		if (!subcategory) return;

		this._rightMainPanel.innerHTML = '';
		
		// Render filter icon strip if filters exist - OUTSIDE panel-content
		if (subcategory.filters && Object.keys(subcategory.filters).length > 0) {
			const filterGroups = this._buildFilterIconGroups(subcategory.filters);
			if (filterGroups.length > 0) {
				this._filterIconStrip = new FilterIconStrip(
					filterGroups,
					this._activeFilters,
					(groupId, iconId) => this._handleIconFilterChange(groupId, iconId)
				);
				this._rightMainPanel.appendChild(this._filterIconStrip.render());
			}
		}
		
		const panelContent = document.createElement('div');
		panelContent.className = 'panel-content panel-content-scrollable';

		// Check for a placeholder note
		if (subcategory.note) {
			panelContent.innerHTML = `<div class="panel-placeholder"><p>${subcategory.note}</p></div>`;
			this._rightMainPanel.appendChild(panelContent);
			this._rightMainPanel.style.display = 'block';
			this._rightMainPanel.classList.add('visible');
			return;
		}

    // Generic content rendering
    const optionKey = Object.keys(subcategory.options)[0];
    const optionConfig = subcategory.options[optionKey];

    if (optionConfig) {
      switch (optionConfig.type) {
        case 'slider_group': {
          const sliderConfigs = (optionConfig.element_keys || []).map(key => {
            const elConfig = window.uiEngine?.getElementConfig(key);
            const value = window.uiEngine?.getStateValue(this._state!.composition, elConfig!.state_path) as number;
            return {
              id: key,
              label: elConfig!.label,
              min: elConfig!.min!,
              max: elConfig!.max!,
              step: elConfig!.step!,
              value: value ?? elConfig!.min!,
              unit: key === 'slots' ? '' : '"',
            };
          });
          const sliderGroup = new SliderGroup(
            sliderConfigs,
            (id, value) => {
              void this._updateStateValue(id, value);
            },
            this._state!.composition.frame_design.number_sections
          );
          panelContent.appendChild(sliderGroup.render());
          break;
        }

        case 'wood_material_inline_grid': {
          if (this._woodMaterialsConfig) {
            // Create header
            const header = document.createElement('div');
            header.className = 'panel-header';
            header.innerHTML = '<h3>Wood Material</h3>';
            panelContent.appendChild(header);
            
            // Create body
            const body = document.createElement('div');
            body.className = 'panel-body';
            panelContent.appendChild(body);
            
            // Render grid into body
            const { species, grain_direction } = this._state!.composition.frame_design.section_materials[0] || {};
            const grid = new WoodMaterialInlineGrid(
              this._woodMaterialsConfig.species_catalog,
              this._state!.composition.frame_design.shape,
              this._state!.composition.frame_design.number_sections,
              species || this._woodMaterialsConfig.default_species,
              grain_direction || this._woodMaterialsConfig.default_grain_direction,
              (selectedSpecies, selectedGrain) => {
                void this._updateWoodMaterial('species', selectedSpecies);
                void this._updateWoodMaterial('grain_direction', selectedGrain);
              }
            );
            body.appendChild(grid.render());
          }
          break;
        }
				
        case 'upload_interface': {
          // Create header
          const header = document.createElement('div');
          header.className = 'panel-header';
          header.innerHTML = '<h3>Upload Audio</h3>';
          panelContent.appendChild(header);
          
          // Create body with upload controls
          const body = document.createElement('div');
          body.className = 'panel-body';
          body.style.display = 'flex';
          body.style.flexDirection = 'column';
          body.style.gap = '16px';
          body.style.padding = '20px';
          
          // Create file input (hidden)
          const fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.accept = 'audio/*';
          fileInput.style.display = 'none';
          body.appendChild(fileInput);
          
          // Create upload button
          const uploadButton = document.createElement('button');
          uploadButton.className = 'upload-button';
					uploadButton.dataset.demoId = 'upload_button';
          uploadButton.style.padding = '16px 24px';
          uploadButton.style.fontSize = '16px';
          uploadButton.style.fontWeight = '500';
          uploadButton.style.backgroundColor = 'rgba(100, 150, 255, 0.2)';
          uploadButton.style.border = '2px solid rgba(100, 150, 255, 0.5)';
          uploadButton.style.borderRadius = '8px';
          uploadButton.style.color = 'rgba(255, 255, 255, 0.9)';
          uploadButton.style.cursor = 'pointer';
          uploadButton.style.transition = 'all 0.2s ease';
          uploadButton.innerHTML = '📁 Choose Audio File';
          uploadButton.addEventListener('click', () => fileInput.click());
          body.appendChild(uploadButton);
          
          // Create drop zone
          const dropZone = document.createElement('div');
          dropZone.style.padding = '40px 20px';
          dropZone.style.border = '2px dashed rgba(255, 255, 255, 0.3)';
          dropZone.style.borderRadius = '8px';
          dropZone.style.textAlign = 'center';
          dropZone.style.color = 'rgba(255, 255, 255, 0.6)';
          dropZone.style.cursor = 'pointer';
          dropZone.innerHTML = '<div style="font-size: 48px; margin-bottom: 16px;">⬆️</div><div>Or drag and drop your audio file here</div><div style="margin-top: 8px; font-size: 12px; opacity: 0.7;">Supported formats: MP3, WAV, FLAC, M4A</div>';
          dropZone.addEventListener('click', () => fileInput.click());
          body.appendChild(dropZone);
          
          // File input change handler
          fileInput.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
              const currentState = this.getState();
              const uiComposition = currentState.composition;
              void this.dispatch({ 
                type: 'FILE_UPLOADED', 
                payload: { file: target.files[0], uiSnapshot: uiComposition }
              });
            }
          });
          
          // Drag and drop handlers
          dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.borderColor = 'rgba(100, 150, 255, 0.8)';
            dropZone.style.backgroundColor = 'rgba(100, 150, 255, 0.1)';
          });
          
          dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            dropZone.style.backgroundColor = 'transparent';
          });
          
          dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            dropZone.style.backgroundColor = 'transparent';
            
            if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
              const currentState = this.getState();
              const uiComposition = currentState.composition;
              void this.dispatch({ 
                type: 'FILE_UPLOADED', 
                payload: { file: e.dataTransfer.files[0], uiSnapshot: uiComposition }
              });
            }
          });
          
          panelContent.appendChild(body);
          break;
        }				

        // Default to ThumbnailGrid for "Style" category
        default: {
          const allThumbnails = optionConfig.thumbnails || {};

          const thumbnailItems = Object.entries(allThumbnails)
            .filter(([key, config]) => {
              // Apply icon filter selections (empty Set = show all)
              const activeShapes = this._activeFilters.get('shape') || new Set();
              if (activeShapes.size > 0) {
                const thumbnailShape = config.state_updates['frame_design.shape'] as string;
                if (!activeShapes.has(thumbnailShape)) {
                  return false;
                }
              }
              
              const activePatterns = this._activeFilters.get('slot_pattern') || new Set();
              if (activePatterns.size > 0) {
                const thumbnailPattern = config.state_updates['pattern_settings.slot_style'] as string;
                if (!activePatterns.has(thumbnailPattern)) {
                  return false;
                }
              }
              
              return true;
            })
            .map(([key, config]) => {
              // Check validation rules per thumbnail
              const thumbnailShape = config.state_updates['frame_design.shape'] as string;
              const thumbnailPattern = config.state_updates['pattern_settings.slot_style'] as string;
              const thumbnailN = config.state_updates['frame_design.number_sections'] as number;
              const ruleKey = `${thumbnailShape}_${thumbnailPattern}`;
              const validNValues = optionConfig.validation_rules?.[ruleKey] || [];
              const isDisabled = validNValues.length > 0 && !validNValues.includes(thumbnailN);
              
              return {
                id: key,
                label: config.label,
                thumbnailUrl: `${this._thumbnailConfig!.base_path}/${key}${this._thumbnailConfig!.extension}`,
                disabled: isDisabled,
                tooltip: config.tooltip,
              };
            });

          const activeSelection = this._getActiveThumbnailId(
            allThumbnails,
            this._state!.composition
          );

          const thumbnailGrid = new ThumbnailGrid(
            thumbnailItems,
            (id) => this._handleThumbnailSelected(id),
            activeSelection
          );
          panelContent.appendChild(thumbnailGrid.render());
          break;
        }
      }
    }

    this._rightMainPanel.appendChild(panelContent);
    this._rightMainPanel.style.display = 'block';
    this._rightMainPanel.classList.add('visible');
  }
	
	/**
   * Get active thumbnail ID by matching current state to thumbnail state_updates
   * @private
   */
  private _getActiveThumbnailId(
    thumbnails: Record<string, ThumbnailOptionConfig>,
    currentState: CompositionStateDTO
  ): string | null {
    for (const [thumbnailId, config] of Object.entries(thumbnails)) {
      const updates = config.state_updates;
      
      const matches = Object.entries(updates).every(([path, value]) => {
        const currentValue = this._getNestedValue(currentState, path);
        return currentValue === value;
      });
      
      if (matches) {
        return thumbnailId;
      }
    }
    
    return null;
  }

  /**
   * Get nested value from composition state using dot notation
   * @private
   */
  private _getNestedValue(state: CompositionStateDTO, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = state;
    
    for (const part of parts) {
      if (typeof current === 'object' && current !== null && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  }
  
  /**
   * Handle thumbnail selection (Right Main → updates composition state)
   * Applies state_updates from config
   * @private
   */
  private async _handleThumbnailSelected(thumbnailKey: string): Promise<void> {
    if (!this._categoriesConfig || !this._activeCategory || !this._activeSubcategory || !this._state) return;

    const categoryConfig = this._categoriesConfig[this._activeCategory as keyof typeof this._categoriesConfig];
    if (!categoryConfig) return;

    const subcategory = categoryConfig.subcategories[this._activeSubcategory];
    const optionKey = Object.keys(subcategory.options)[0];
    const thumbnail = subcategory.options[optionKey]?.thumbnails?.[thumbnailKey];
    
    if (!thumbnail) return;
    
    // Apply all state_updates from config
    const newComposition = structuredClone(this._state.composition);
    
    Object.entries(thumbnail.state_updates).forEach(([path, value]) => {
      this._setNestedValue(newComposition, path, value);
    });
    
    // Trigger rendering pipeline directly
    await this.handleCompositionUpdate(newComposition);
  }

  /**
   * Handle option selection from right panel
   * @private
   */
  private _handleOptionSelected(
    option: string,
    value: unknown,
    contentRenderer: RightPanelContentRenderer,
    uiConfig: { elements: Record<string, unknown> }
  ): void {
    if (!this._panelStack || !this._state) return;

    // Handle navigation to cascading panels
    if (option === 'navigate') {
      this._handleNavigation(value as string, contentRenderer, uiConfig);
      return;
    }

    // Handle direct state updates
    void this._updateStateValue(option, value);
  }
	
	/**
 * Update state value and trigger re-render
 * Uses UI config as single source of truth for state paths
 * @private
 */
	private async _updateStateValue(option: string, value: unknown): Promise<void> {
		if (!this._state) return;

		const newComposition = structuredClone(this._state.composition);

		// UIEngine is the authoritative source for element configs
		const elementConfig = window.uiEngine?.getElementConfig(option);
		
		if (!elementConfig?.state_path) {
			console.warn(`[Controller] No state_path found for option: ${option}`);
			return;
		}

		// Update the nested value using state_path from UIEngine
		this._setNestedValue(newComposition, elementConfig.state_path, value);

		// Trigger composition update
		await this.handleCompositionUpdate(newComposition);
	}
	
	/**
   * Set nested object value using dot notation path
   * @private
   */
  private _setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown
  ): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    
    const lastPart = parts[parts.length - 1];
    current[lastPart] = value;
  }
	
	/**
   * Update wood material properties (species or grain_direction)
   * Applies to all sections or selected sections
   * @private
   */
  private async _updateWoodMaterial(
    property: 'species' | 'grain_direction',
    value: string
  ): Promise<void> {
    if (!this._state) return;

    // Create a new composition state immutably
    const newComposition = structuredClone(this._state.composition);
    
    // Ensure the materials array exists
    const materials = newComposition.frame_design.section_materials || [];
    const numSections = newComposition.frame_design.number_sections;
    
    // Determine which section indices to update
    const targetIndices = this._selectedSectionIndices.size > 0
      ? Array.from(this._selectedSectionIndices)
      : Array.from({ length: numSections }, (_, i) => i); // If none selected, target all

    // Update only the target sections
    targetIndices.forEach(sectionId => {
      let material = materials.find(m => m.section_id === sectionId);
      
      if (material) {
        // Update existing material entry
        material[property] = value;
      } else {
        // Create a new material entry if it doesn't exist
        const newMaterial: SectionMaterial = {
          section_id: sectionId,
          species: property === 'species' ? value : this._woodMaterialsConfig?.default_species || 'walnut-black-american',
          grain_direction: property === 'grain_direction' ? value as 'horizontal' | 'vertical' | 'radiant' | 'diamond' : this._woodMaterialsConfig?.default_grain_direction || 'vertical'
        };
        materials.push(newMaterial);
      }
    });

    // Ensure the materials array is sorted by section_id for consistency
    newComposition.frame_design.section_materials = materials.sort((a, b) => a.section_id - b.section_id);

    // Trigger the rendering pipeline with the updated composition
    await this.handleCompositionUpdate(newComposition);
  }

  /**
   * Handle navigation to cascading panels
   * @private
   */
  private _handleNavigation(
    target: string,
    contentRenderer: RightPanelContentRenderer,
    uiConfig: { elements: Record<string, unknown> }
  ): void {
    if (!this._panelStack || !this._state) return;

    switch (target) {
      case 'species': {
        const panel = contentRenderer.renderWoodSpeciesPanel(
          this._state.composition,
          uiConfig,
          (species: string) => {
            void this._updateWoodMaterial('species', species);
            this._panelStack?.popPanel();
          },
          () => {
            this._panelStack?.popPanel();
          }
        );
        this._panelStack.pushPanel(panel);
        break;
      }

      case 'grain': {
        const panel = contentRenderer.renderGrainDirectionPanel(
          this._state.composition,
          (grain: string) => {
            void this._updateWoodMaterial('grain_direction', grain);
            this._panelStack?.popPanel();
          },
          () => {
            this._panelStack?.popPanel();
          }
        );
        this._panelStack.pushPanel(panel);
        break;
      }

      default:
        console.warn('Unknown navigation target:', target);
    }
  }
	
	private _detectChangedParams(
		oldComp: CompositionStateDTO,
		newComp: CompositionStateDTO
	): string[] {
		const changed = new Set<string>();

		// Special handling for section_materials array
		const compareSectionMaterials = (
			oldMaterials: Array<{section_id: number, species: string, grain_direction: string}>,
			newMaterials: Array<{section_id: number, species: string, grain_direction: string}>
		): boolean => {
			if (oldMaterials.length !== newMaterials.length) return true;
			
			// Sort both arrays by section_id for consistent comparison
			const oldSorted = [...oldMaterials].sort((a, b) => a.section_id - b.section_id);
			const newSorted = [...newMaterials].sort((a, b) => a.section_id - b.section_id);
			
			// Compare each element
			for (let i = 0; i < oldSorted.length; i++) {
				const old = oldSorted[i];
				const newer = newSorted[i];
				
				if (
					old.section_id !== newer.section_id ||
					old.species !== newer.species ||
					old.grain_direction !== newer.grain_direction
				) {
					return true;
				}
			}
			
			return false;
		};

		// Type-safe recursive comparison function
		const compareObjects = (
			o1: Record<string, unknown>,
			o2: Record<string, unknown>,
			path: string = ''
		) => {
			for (const key of Object.keys(o1)) {
				const val1 = o1[key];
				const val2 = o2[key];
				const currentPath = path ? `${path}.${key}` : key;

				// Special case: section_materials array
				if (currentPath === 'frame_design.section_materials') {
					if (Array.isArray(val1) && Array.isArray(val2)) {
						if (compareSectionMaterials(val1 as Array<{section_id: number, species: string, grain_direction: string}>, val2 as Array<{section_id: number, species: string, grain_direction: string}>)) {
							changed.add('section_materials');
						}
					}
					continue;
				}

				// Recurse into nested objects
				if (
					typeof val1 === 'object' && val1 !== null && !Array.isArray(val1) &&
					val2 && typeof val2 === 'object' && !Array.isArray(val2)
				) {
					compareObjects(
						val1 as Record<string, unknown>,
						val2 as Record<string, unknown>,
						currentPath
					);
				} else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
					// For primitives or other arrays
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
				
				// Update UI dropdown to hide/show grain options and reset to valid value if needed
				if (typeof window !== 'undefined' && (window as { updateGrainDirectionOptionsFromController?: (n: number) => void }).updateGrainDirectionOptionsFromController) {
					(window as { updateGrainDirectionOptionsFromController?: (n: number) => void }).updateGrainDirectionOptionsFromController?.(newN);
					const updateFn = (window as { updateGrainDirectionOptionsFromController?: (n: number) => void }).updateGrainDirectionOptionsFromController;
					if (updateFn) updateFn(newN);
				}
      }
    }
		
		// Initialize section_materials when number_sections changes (CHAT 2 FIX)
    const oldN = this._state.composition.frame_design.number_sections;
    const newN = newComposition.frame_design.number_sections;

    if (oldN !== newN) {
    
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
          this._sceneManager.applySingleSectionMaterial?.(sectionId);
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
      this._sceneManager.applySingleSectionMaterial?.(sectionId);
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
    // CRITICAL: Completely replace the array, don't merge with old entries
    const cleanMaterials = newMaterials.map(m => ({
      section_id: m.section_id,
      species: m.species,
      grain_direction: m.grain_direction
    }));
    
    // Update state with completely new array
    this._state.composition = {
      ...this._state.composition,
      frame_design: {
        ...this._state.composition.frame_design,
        section_materials: cleanMaterials
      }
    };
    
    this.notifySubscribers();
  }
}