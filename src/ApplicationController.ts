/**
 * ApplicationController - Central state management and orchestration
 * 
 * Single source of truth for application state.
 * Coordinates between UI components and the facade.
 * Manages timers, autoplay, and phase transitions.
 */

import { AudioCacheService } from './AudioCacheService';
import { FilterIconStrip } from './components/FilterIconStrip';
import { PanelStackManager } from './components/PanelStackManager';
import { RightPanelContentRenderer } from './components/RightPanelContent';
import { SectionSelectorPanel } from './components/SectionSelectorPanel';
import { SliderGroup } from './components/SliderGroup';
import { ThumbnailGrid } from './components/ThumbnailGrid';
import { WoodMaterialSelector } from './components/WoodMaterialSelector';
import { PerformanceMonitor } from './PerformanceMonitor';
import type { CategoriesConfig, FilterIconGroup, ThumbnailConfig } from './types/PanelTypes';
import {
  ApplicationState,
  BackgroundsConfigSchema,
  CompositionStateDTO,
	ConstraintsConfigSchema, 
  PlacementDefaultsSchema,
  WoodMaterialsConfigSchema,
  type ArtPlacement,
  type AudioProcessResponse,
  type BackgroundsConfig,
  type CompositionOverrides,
	type ConstraintsConfig,
  type CSGDataResponse,
  type PlacementDefaults,
  type SectionMaterial,
  type WoodMaterialsConfig,
} from './types/schemas';
import { fetchAndValidate } from './utils/validation';
import { deepMerge } from './utils/mergeUtils';
import { Action, WaveformDesignerFacade } from './WaveformDesignerFacade';
import { applyDimensionChange, type DimensionConstraints } from './utils/dimensionUtils';
import { AspectRatioLock } from './components/AspectRatioLock';
import { ConstraintResolver } from './services/ConstraintResolver';


// Internal facade APIs that aren't exposed in the public interface
interface TextureCache {
  preloadAllTextures: (config: WoodMaterialsConfig) => Promise<IdleTextureLoader>;
}

interface IdleTextureLoader {
  pause: () => void;
  onProgress: (callback: (loaded: number, total: number) => void) => void;
}

interface SceneManagerInternal {
  _textureCache?: TextureCache;
}

interface Archetype {
  id: string;
  shape: string;
  slot_style: string;
  label: string;
  tooltip: string;
  thumbnail: string;
  number_sections: number;
  number_slots: number;
  separation: number;
  side_margin?: number;
}

interface UIConfig {
  thumbnail_config: ThumbnailConfig;
  categories: CategoriesConfig;
}

interface ElementConfig {
  label: string;
  state_path: string;
  min?: number;
  max?: number;
  step?: number;
  show_when?: {
    shape?: string[];
    slot_style?: string[];
  };
  dynamic_max_by_sections?: Record<string, number>;
}

interface UIEngine {
  getElementConfig: (key: string) => ElementConfig | undefined;
  getStateValue: (composition: CompositionStateDTO, path: string) => unknown;
}

declare global {
  interface Window {
    uiEngine?: UIEngine;
  }
}

// Subscriber callback type
type StateSubscriber = (state: ApplicationState) => void;


/**
 * Check if a grain direction is available for a given number of sections.
 */
function isGrainAvailableForN(grain: string, n: number): boolean {
  // Defer to the UIEngine, which reads from the configuration file.
  if (window.uiEngine) {
    return window.uiEngine.isGrainDirectionAvailable(grain, n);
  }

  // Fallback for safety, though UIEngine should always be available.
  if (grain === 'diamond') return n === 4;
  if (grain === 'radiant') return n >= 3;
  return true;
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
	private _backgroundsConfig: BackgroundsConfig | null = null;
  private _idleTextureLoader: unknown = null; // IdleTextureLoader instance
	private _placementDefaults: PlacementDefaults | null = null;
	private _constraints: ConstraintsConfig | null = null;
	private _resolver: ConstraintResolver | null = null;
	private _compositionCache: Map<string, CompositionStateDTO> = new Map();
	public getResolver(): ConstraintResolver | null {
    return this._resolver;
  }
	public getConstraintsConfig(): ConstraintsConfig | null {
    return this._constraints;
  }
	
	// Four-panel navigation configuration
  private _thumbnailConfig: ThumbnailConfig | null = null;
  private _categoriesConfig: CategoriesConfig | null = null;
	private _archetypes: Map<string, Archetype> = new Map();
  
  // Four-panel DOM references
  private _leftSecondaryPanel: HTMLElement | null = null;
  private _rightSecondaryPanel: HTMLElement | null = null;
  private _rightMainPanel: HTMLElement | null = null;
  private _filterIconStrip: FilterIconStrip | null = null;
  private _sectionSelectorPanel: SectionSelectorPanel | null = null;
  
  constructor(facade: WaveformDesignerFacade) {
    this._facade = facade;
		this._audioCache = new AudioCacheService();
		this._panelStack = new PanelStackManager('right-panel-stack');
  }
	
	public get audioCache(): AudioCacheService {
    return this._audioCache;
  }
	
	/**
   * Update section selection state (called from SceneManager or UI)
   * Syncs state and updates section selector panel if visible
   */
  public selectSection(indices: Set<number>): void {
    // Update section selector panel if it exists
    if (this._sectionSelectorPanel) {
      this._sectionSelectorPanel.updateSelection(indices);
    }
  }
	
	/**
   * Restore UI from persisted state after DOM is ready
   * Called from main.ts after LeftPanelRenderer has rendered
   */
  restoreUIFromState(): void {
    if (!this._state) return;
    
    const { activeCategory, activeSubcategory } = this._state.ui;
    
    if (!activeCategory) return;
    
    // 1. Highlight category button
    const categoryButtons = document.querySelectorAll('.category-button');
    categoryButtons.forEach(btn => {
      const btnId = btn.getAttribute('data-category');
      if (btnId === activeCategory) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    // 2. Render Left Secondary Panel
    this._renderLeftSecondaryPanel(activeCategory, activeSubcategory);
    
    // 3. If subcategory exists, render right panels
    if (activeSubcategory) {
      requestAnimationFrame(() => {
        if (this._state?.ui.activeSubcategory) {
          this._handleSubcategorySelected(this._state.ui.activeSubcategory);
        }
      });
    }
  }
  
  /**
   * Initialize the controller with default or restored state
   */
  async initialize(): Promise<void> {
    try {
      // Initialize facade (loads style presets)
      this._facade.initialize();
			
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
			
			// Load placement defaults configuration
      try {
        this._placementDefaults = await fetchAndValidate<PlacementDefaults>(
          'http://localhost:8000/api/config/placement-defaults',
          PlacementDefaultsSchema
        );
      } catch (error) {
        console.error('Failed to load placement defaults:', error);
        // Non-fatal: application can continue with base archetype defaults
      }
			
			// Load thumbnail and categories configuration
      // Load all configs in parallel
			const [archetypes, woodMaterials, backgrounds, placementDefaults, uiConfig, _compositionDefaults, constraints] = await Promise.all([
				fetch('http://localhost:8000/api/config/archetypes').then(r => r.json()),
				fetch('http://localhost:8000/api/config/wood-materials').then(r => r.json()),
				fetchAndValidate<BackgroundsConfig>('http://localhost:8000/api/config/backgrounds', BackgroundsConfigSchema),
				fetch('http://localhost:8000/api/config/placement-defaults').then(r => r.json()),
				fetch('http://localhost:8000/api/config/ui').then(r => r.json()),
				fetch('http://localhost:8000/api/config/composition-defaults').then(r => r.json()),
				fetchAndValidate('http://localhost:8000/api/config/constraints', ConstraintsConfigSchema)
			]) as [Record<string, Archetype>, WoodMaterialsConfig, BackgroundsConfig, PlacementDefaults, UIConfig, unknown, ConstraintsConfig];

			// Store archetypes
			Object.entries(archetypes).forEach(([id, data]) => {
				this._archetypes.set(id, data);
			});

			// Store configs
			this._woodMaterialsConfig = woodMaterials;
			this._backgroundsConfig = backgrounds;
			this._placementDefaults = placementDefaults;
			this._constraints = constraints;
			this._resolver = new ConstraintResolver(constraints, placementDefaults);
			this._thumbnailConfig = uiConfig.thumbnail_config;
			this._categoriesConfig = uiConfig.categories;
			
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
			
			// Restore composition cache from persisted state
      if (this._state.compositionCache) {
        Object.entries(this._state.compositionCache).forEach(([key, comp]) => {
          this._compositionCache.set(key, comp);
        });
      }
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
    // Clear scene without rendering (tour needs blank canvas)
    if (this._sceneManager && 'clearScene' in this._sceneManager) {
      (this._sceneManager as unknown as { clearScene: () => void }).clearScene();
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
    applyArtPlacement?: (placement: ArtPlacement) => void;
    resetArtPlacement?: () => void;
    applyLighting?: (lighting: LightingConfig) => void;
    resetLighting?: () => void;
  }): void {
    this._sceneManager = sceneManager;
    
    // Start texture loading immediately in background
    if (this._woodMaterialsConfig) {
      const textureCache = (this._sceneManager as unknown as SceneManagerInternal)._textureCache;
      if (textureCache && typeof textureCache.preloadAllTextures === 'function') {
        void textureCache.preloadAllTextures(this._woodMaterialsConfig).then((idleLoader) => {
          this._idleTextureLoader = idleLoader;
          
          const indicator = document.getElementById('textureLoadingIndicator');
          const loadedEl = document.getElementById('texturesLoaded');
          const totalEl = document.getElementById('texturesTotal');
          
          if (indicator && loadedEl && totalEl) {
            idleLoader.onProgress((loaded, total) => {
              loadedEl.textContent = String(loaded);
              totalEl.textContent = String(total);
              
              if (loaded < total) {
                indicator.classList.add('active');
              } else {
                setTimeout(() => {
                  indicator.classList.remove('active');
                }, 2000);
              }
            });
          }
        }).catch((error: unknown) => {
          console.error('[Controller] Background texture loading failed:', error);
        });
      }
    }
    
    // Apply current background from state
    if (this._state && this._backgroundsConfig && 'changeBackground' in sceneManager) {
      const bgState = this._state.ui.currentBackground;
      const category = this._backgroundsConfig.categories[bgState.type];
      const background = category.find(bg => bg.id === bgState.id);
      
      if (background) {
        (sceneManager as unknown as { changeBackground: (type: string, id: string, rgb?: number[], path?: string) => void })
          .changeBackground(bgState.type, bgState.id, background.rgb, background.path);
        
        // Apply lighting config on initial load
        if (background.lighting && 'applyLighting' in sceneManager) {
          (sceneManager as any).applyLighting(background.lighting);
        } else if ('resetLighting' in sceneManager) {
          (sceneManager as any).resetLighting();
        }
      }
    }
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
   * Get art placement for current background state
   * Used by SceneManager during initial render
   */
  public getCurrentArtPlacement(): ArtPlacement | null {
    if (!this._state || !this._backgroundsConfig) return null;
    
    const archetypeId = this.getActiveArchetypeId();
    if (!archetypeId) return null;
    
    const backgroundKey = this._getBackgroundKeyForCache(this._state.ui.currentBackground);
    let artPlacement: ArtPlacement | undefined;
    
    // 1. Check placement_defaults for archetype-specific override
    if (this._placementDefaults) {
      const placementData = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.[backgroundKey];
      artPlacement = placementData?.art_placement;
      
      if (!artPlacement && backgroundKey !== 'paint_and_accent') {
        artPlacement = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.['paint_and_accent']?.art_placement;
      }
    }
    
    // 2. Fallback to background's default art_placement
    if (!artPlacement) {
      const bgType = this._state.ui.currentBackground.type;
      if (bgType === 'rooms') {
        const bgId = this._state.ui.currentBackground.id;
        const background = this._backgroundsConfig.categories.rooms.find(bg => bg.id === bgId);
        artPlacement = background?.art_placement;
      }
    }
    
    return artPlacement || null;
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
			
			// Pause background texture loading during heavy operations
      if (this._idleTextureLoader && typeof (this._idleTextureLoader as IdleTextureLoader).pause === 'function') {
        (this._idleTextureLoader as IdleTextureLoader).pause();
      }
			
      PerformanceMonitor.start('backend_audio_processing');
			
      // Force a complete state reset on new file upload
      const freshState = await this._facade.createInitialState();
      this._state = freshState;
      
      // Clear the audio cache
      this._audioCache.clearAll();
			
			// Clear composition cache on new audio upload
      this._compositionCache.clear();

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
    
    // Clear section selector when leaving WOOD category
    if (this._sectionSelectorPanel) {
      this._sectionSelectorPanel.destroy();
      this._sectionSelectorPanel = null;
    }
    
    void this.dispatch({ type: 'CATEGORY_SELECTED', payload: categoryId });
    
    this._handleStyleCategorySelected();
  }
	
	/**
   * Handle background selection from UI
   */
  handleBackgroundSelected(backgroundId: string, type: 'paint' | 'accent' | 'rooms'): void {
    if (!this._backgroundsConfig || !this._sceneManager) return;
    
    const category = this._backgroundsConfig.categories[type];
    const background = category.find(bg => bg.id === backgroundId);
    
    if (!background) {
      console.error(`[Controller] Background not found: ${backgroundId}`);
      return;
    }
    
    // Update state
    if (this._state) {
      this._state = {
        ...this._state,
        ui: {
          ...this._state.ui,
          currentBackground: { type, id: backgroundId }
        }
      };
      this._facade.persistState(this._state);
      this.notifySubscribers();
    }
    
    // Apply to scene
    if ('changeBackground' in this._sceneManager) {
      (this._sceneManager as unknown as { changeBackground: (type: string, id: string, rgb?: number[], path?: string) => void })
        .changeBackground(type, backgroundId, background.rgb, background.path);
    }
    
    // Apply placement defaults and caching if archetype is selected
    if (this._state) {
      const archetypeId = this.getActiveArchetypeId();
      
      // Only apply caching if archetype exists
      if (archetypeId) {
        const backgroundKey = this._getBackgroundKeyForCache({ id: backgroundId, type });
        const cacheKey = this._getCacheKey(archetypeId, backgroundKey);
        
        let composition = this._compositionCache.get(cacheKey);
        
        if (!composition) {
          // Cache miss: preserve current user-modified state without applying defaults
          // Defaults are ONLY applied during archetype selection, not background changes
          composition = structuredClone(this._state.composition);
          
          // Cache the current state as-is to preserve user modifications
          this._compositionCache.set(cacheKey, composition);
          
          // Apply composition (no changes needed, just ensures scene updates)
          void this.handleCompositionUpdate(composition);
        } else {
          // Cache hit: restore cached composition (includes user modifications)
          void this.handleCompositionUpdate(composition);
        }
        
        // Apply art placement
				let artPlacement: ArtPlacement | undefined;
				
				// 1. Check placement_defaults for archetype-specific override
				if (this._placementDefaults) {
					const placementData = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.[backgroundKey];
					artPlacement = placementData?.art_placement;
					
					if (!artPlacement && backgroundKey !== 'paint_and_accent') {
						artPlacement = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.['paint_and_accent']?.art_placement;
					}
				}
				
				// 2. Fallback to background's default art_placement
				if (!artPlacement && this._backgroundsConfig) {
					if (type === 'rooms') {
						const background = this._backgroundsConfig.categories.rooms.find(bg => bg.id === backgroundId);
						artPlacement = background?.art_placement;
					}
				}

				if (artPlacement && 'applyArtPlacement' in this._sceneManager) {
					(this._sceneManager as any).applyArtPlacement(artPlacement);
				} else if ('resetArtPlacement' in this._sceneManager) {
					(this._sceneManager as any).resetArtPlacement();
				}

				// Apply lighting config if present
				console.log('[Controller] Checking lighting:', background?.lighting);
				console.log('[Controller] Has applyLighting?', 'applyLighting' in this._sceneManager);
				if (background?.lighting && 'applyLighting' in this._sceneManager) {
					console.log('[Controller] Calling applyLighting with:', background.lighting);
					(this._sceneManager as any).applyLighting(background.lighting);
				} else if ('resetLighting' in this._sceneManager) {
					console.log('[Controller] Calling resetLighting');
					(this._sceneManager as any).resetLighting();
				}
      }
    }
  }
	
	/**
   * Render Left Secondary Panel without dispatching actions
   * Pure rendering method for state restoration
   * @private
   */
  private _renderLeftSecondaryPanel(
    categoryId: string,
    selectedSubcategoryId: string | null
  ): void {
    if (!this._categoriesConfig || !this._leftSecondaryPanel) return;
    
    const categoryConfig = this._categoriesConfig[categoryId as keyof CategoriesConfig];
    if (!categoryConfig) return;
    
    const subcategories = Object.entries(categoryConfig.subcategories)
      .map(([id, config]) => ({ id, config }));
    
    if (subcategories.length === 0) {
      this._leftSecondaryPanel.style.display = 'none';
      return;
    }
    
    void import('./components/LeftSecondaryPanel').then(({ LeftSecondaryPanel }) => {
      const panel = new LeftSecondaryPanel(
        subcategories,
        selectedSubcategoryId,
        (id: string) => this._handleSubcategorySelected(id)
      );
      
      if (this._leftSecondaryPanel) {
        this._leftSecondaryPanel.innerHTML = '';
        this._leftSecondaryPanel.appendChild(panel.render());
        this._leftSecondaryPanel.style.display = 'block';
        
        // Position left-secondary based on left-main's actual width
        const leftMainPanel = document.getElementById('left-main-panel');
        if (leftMainPanel) {
          const gap = 16; // Gap between panels
          const leftPosition = leftMainPanel.offsetLeft + leftMainPanel.offsetWidth + gap;
          this._leftSecondaryPanel.style.left = `${leftPosition}px`;
        }
        
        this._leftSecondaryPanel.classList.add('visible');
        
        requestAnimationFrame(() => {
          if (this._sceneManager && 'updateCameraOffset' in this._sceneManager) {
            (this._sceneManager as { updateCameraOffset: () => void }).updateCameraOffset();
          }
        });
      }
    }).catch((error: unknown) => {
      console.error('[Controller] Failed to render Left Secondary Panel:', error);
    });
  }
  
  /**
   * Handle STYLE category selection (four-panel architecture)
   * @private
   */
	private _handleStyleCategorySelected(): void {
    if (!this._categoriesConfig || !this._state?.ui.activeCategory || !this._thumbnailConfig) return;
    const categoryConfig = this._categoriesConfig[this._state.ui.activeCategory as keyof CategoriesConfig];
    if (!categoryConfig) return;
		
		const subcategories = Object.entries(categoryConfig.subcategories).map(([id, config]) => ({ id, config }));
    
		// Auto-select subcategory based on current state
    // BUT: Don't override if we already restored a saved subcategory
    const currentComposition = this._state?.composition;
    if (currentComposition && !this._state.ui.activeSubcategory) {
      if (subcategories.length === 1) {
        // Correctly select the single subcategory for Layout, Wood, etc.
        const subcategoryId = subcategories[0].id;
        void this.dispatch({ type: 'SUBCATEGORY_SELECTED', payload: { category: this._state.ui.activeCategory, subcategory: subcategoryId } });
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
		
		// Auto-select the first subcategory if one isn't already active for this category
      if (!this._state.ui.activeSubcategory && subcategories.length > 0) {
        const subcategoryId = subcategories[0].id;
        void this.dispatch({ type: 'SUBCATEGORY_SELECTED', payload: { category: this._state.ui.activeCategory, subcategory: subcategoryId } });
      }
      
      // Defer rendering to the next tick to ensure all state is consistent
      requestAnimationFrame(() => {
        if (this._state?.ui.activeSubcategory) {
          this._handleSubcategorySelected(this._state.ui.activeSubcategory);
        }
      });

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
      void import('./components/LeftSecondaryPanel').then(({ LeftSecondaryPanel }) => {
        const panel = new LeftSecondaryPanel(subcategories, this._state?.ui.activeSubcategory || null, (id: string) => this._handleSubcategorySelected(id));
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
    console.log('[Controller] _handleSubcategorySelected called with:', subcategoryId);
    console.log('[Controller] Current state:', {
      hasConfig: !!this._categoriesConfig,
      hasState: !!this._state,
      activeCategory: this._state?.ui.activeCategory
    });
    
    if (!this._categoriesConfig || !this._state?.ui.activeCategory) {
      console.error('[Controller] Early return: missing config or state');
      return;
    }
    
    const categoryConfig = this._categoriesConfig[this._state.ui.activeCategory as keyof CategoriesConfig];
    if (!categoryConfig) {
      console.error('[Controller] Early return: no category config for', this._state.ui.activeCategory);
      return;
    }

    console.log('[Controller] Dispatching SUBCATEGORY_SELECTED');
    // Dispatch state update
    void this.dispatch({ type: 'SUBCATEGORY_SELECTED', payload: { category: this._state.ui.activeCategory, subcategory: subcategoryId } });
    console.log('[Controller] Dispatch completed');

    // Re-render the LeftSecondaryPanel immediately to show the new selection
    const subcategories = Object.entries(categoryConfig.subcategories).map(([id, config]) => ({ id, config }));
    void import('./components/LeftSecondaryPanel').then(({ LeftSecondaryPanel }) => {
      const panel = new LeftSecondaryPanel(
        subcategories,
        this._state?.ui.activeSubcategory || null, // Pass the updated selection from state
        (id: string) => this._handleSubcategorySelected(id)
      );
      if (this._leftSecondaryPanel) {
        this._leftSecondaryPanel.innerHTML = '';
        this._leftSecondaryPanel.appendChild(panel.render());
      }
    });

    const subcategory = categoryConfig.subcategories[subcategoryId];
    if (!subcategory) return;

    // Always render the main panel after subcategory selection
    this._renderRightMainFiltered();
  }
	
	/**
   * Render section selector in Right Secondary panel for wood species selection
   * Only shown when WOOD > Species is active AND number_sections > 1
   * @private
   */
  private _renderSectionSelector(): void {
    if (!this._rightSecondaryPanel || !this._sceneManager) return;
    
    // Only show for WOOD > Species subcategory
    if (this._state?.ui.activeCategory !== 'wood' || this._state?.ui.activeSubcategory !== 'wood_species') {
      this._rightSecondaryPanel.style.display = 'none';
      return;
    }
    
    const state = this.getState();
    const numberSections = state.composition.frame_design.number_sections;
    const shape = state.composition.frame_design.shape;
    
    // Only show for n > 1
    if (numberSections <= 1) {
      this._rightSecondaryPanel.style.display = 'none';
      return;
    }
    
    // Get current selection from SceneManager
    const selectedSections = this._sceneManager.getSelectedSections();
    
    // Clear and render new selector
    this._rightSecondaryPanel.innerHTML = '';
    
    void import('./components/SectionSelectorPanel').then(({ SectionSelectorPanel }) => {
      const selector = new SectionSelectorPanel(
        this,
        numberSections,
        shape,
        selectedSections,
        (newSelection: Set<number>) => {
          // Handle icon click → update SceneManager
          this._handleSectionSelectionFromUI(newSelection);
        }
      );
      
      this._sectionSelectorPanel = selector;
      this._rightSecondaryPanel!.appendChild(selector.render());
      this._rightSecondaryPanel!.style.display = 'block';
      this._rightSecondaryPanel!.classList.add('visible');
			
			// Force auto-height for section selector panel
			this._rightSecondaryPanel!.style.height = 'auto';
			this._rightSecondaryPanel!.style.minHeight = '0';	
			this._rightSecondaryPanel!.style.bottom = 'auto';
			
    }).catch((error: unknown) => {
      console.error('[Controller] Failed to load SectionSelectorPanel:', error);
    });
  }
  
  /**
   * Handle section selection from UI icons
   * Updates SceneManager which will sync overlays
   * @private
   */
  private _handleSectionSelectionFromUI(newSelection: Set<number>): void {
    if (!this._sceneManager) return;
    
    // Clear current selection
    this._sceneManager.clearSelection();
    
    // Apply new selection
    newSelection.forEach(index => {
      this._sceneManager.toggleSection(index);
    });
    
    // Sync controller state
    this.selectSection(this._sceneManager.getSelectedSections());
    
    // Update white dot overlays
    this._sceneManager.updateSectionUI(this._sceneManager.getSelectedSections());
  }
  
  /**
   * Handle filter selection (Icon strip → updates Right Main display only)
   * CRITICAL: Does NOT update composition state
   * @private
   */
  private _handleFilterSelected(filterId: string, selections: Set<string>): void {
    if (!this._state?.ui.activeSubcategory || !this._state.ui.activeCategory) return;
    
    // Dispatch filter change
    void this.dispatch({ 
      type: 'FILTER_CHANGED', 
      payload: { 
        category: this._state.ui.activeCategory,
        subcategory: this._state.ui.activeSubcategory,
        filterId,
        selections: Array.from(selections)
      }
    });
    
    // Re-render Right Main with new filter combination
    this._renderRightMainFiltered();
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
		if (!this._categoriesConfig || !this._state?.ui.activeCategory || !this._state.ui.activeSubcategory || !this._rightMainPanel) return;

		const categoryConfig = this._categoriesConfig[this._state.ui.activeCategory as keyof CategoriesConfig];
		const subcategory = categoryConfig?.subcategories[this._state.ui.activeSubcategory];
		if (!subcategory) return;

		// Preserve scroll position
    const scrollTop = this._rightMainPanel.scrollTop;

    this._rightMainPanel.innerHTML = '';
    
    // Immediately restore scroll to prevent visible jump to top
    this._rightMainPanel.scrollTop = scrollTop;
		
		// Clear section selector panel when changing subcategories
		if (this._rightSecondaryPanel) {
			this._rightSecondaryPanel.innerHTML = '';
			this._rightSecondaryPanel.style.display = 'none';
			this._rightSecondaryPanel.classList.remove('visible');
			this._rightSecondaryPanel.style.height = '';
			this._rightSecondaryPanel.style.minHeight = '';
			this._rightSecondaryPanel.style.bottom = '';
		}
		if (this._sectionSelectorPanel) {
			this._sectionSelectorPanel.destroy();
			this._sectionSelectorPanel = null;
		}
		
		// Render filter icon strip if filters exist - OUTSIDE panel-content
		if (subcategory.filters && Object.keys(subcategory.filters).length > 0) {
			const filterGroups = this._buildFilterIconGroups(subcategory.filters);
			if (filterGroups.length > 0) {
				// Convert state filter selections to Map<string, Set<string>> for FilterIconStrip
				const filterKey = `${this._state.ui.activeCategory}_${this._state.ui.activeSubcategory}`;
				const stateFilters = this._state.ui.filterSelections[filterKey] || {};
				const activeFiltersMap = new Map<string, Set<string>>();
				Object.entries(stateFilters).forEach(([filterId, selections]) => {
					activeFiltersMap.set(filterId, new Set(selections));
				});
				
				this._filterIconStrip = new FilterIconStrip(
					filterGroups,
					activeFiltersMap,
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
			
			// Restore scroll position
			requestAnimationFrame(() => {
				if (this._rightMainPanel) {
					this._rightMainPanel.scrollTop = scrollTop;
				}
			});
			return;
		}

    // Generic content rendering
    const optionKey = Object.keys(subcategory.options)[0];
    const optionConfig = subcategory.options[optionKey];

    if (optionConfig) {
      switch (optionConfig.type) {
        case 'slider_group': {
          // Resolve slider configurations dynamically based on the current archetype
          const archetypeId = this.getActiveArchetypeId();
          let sliderConfigs: SliderConfig[] = [];
          if (this._resolver && archetypeId && this._state) {
            sliderConfigs = this._resolver.resolveSliderConfigs(
              archetypeId,
              this._state.composition
            );
          }
          const sliderGroup = new SliderGroup(
            sliderConfigs,
            (id, value) => {
              void this._updateStateValue(id, value);
            },
            this._state.composition.frame_design.number_sections,
            'Layout'
          );
          panelContent.appendChild(sliderGroup.render());
          
          // Add aspect ratio lock control if shape allows it
          const shape = this._state.composition.frame_design.shape;
          const uiConfig = window.uiEngine?.config;
          const shapeConstraints = uiConfig?.dimension_constraints?.[shape];
          const allowLock = shapeConstraints?.allow_aspect_lock ?? false;
          
          if (allowLock) {
            const lockControl = new AspectRatioLock(
              this._state.ui.aspectRatioLocked ?? false,
              true, // enabled
              (locked) => this._handleAspectRatioLockChange(locked)
            );
            panelContent.appendChild(lockControl.render());
          }
          
          break;
        }

				case 'wood_species_image_grid': {
					if (this._woodMaterialsConfig && this._state) {
						const header = document.createElement('div');
						header.className = 'panel-header';
						header.style.padding = '16px';
						header.innerHTML = '<h3>Wood & Grain</h3>';
						panelContent.appendChild(header);
						const body = document.createElement('div');
						body.className = 'panel-body';
						
						const materials = this._state.composition.frame_design.section_materials || [];
						const currentSpecies = materials[0]?.species || this._woodMaterialsConfig.default_species;
						const currentGrain = materials[0]?.grain_direction || this._woodMaterialsConfig.default_grain_direction;
						const grid = new WoodMaterialSelector(
							this._woodMaterialsConfig.species_catalog,
							this._state.composition.frame_design.number_sections,
							currentSpecies,
							currentGrain,
							(update) => {
								void (async () => {
									// Capture scroll position from current .panel-body before re-render
								const oldBody = document.querySelector('.panel-right-main .panel-body') as HTMLElement;
								const scrollTop = oldBody?.scrollTop || 0;

								await this._updateWoodMaterial('species', update.species);
								await this._updateWoodMaterial('grain_direction', update.grain);
								this._renderRightMainFiltered();

								// Restore scroll position to new .panel-body after re-render
								requestAnimationFrame(() => {
									const newBody = document.querySelector('.panel-right-main .panel-body') as HTMLElement;
									if (newBody) {
										newBody.scrollTop = scrollTop;
									}
								});
							})();
						}
					);
					body.appendChild(grid.render());
					panelContent.appendChild(body);
					
					// Render section selector in Right Secondary (for n > 1)
					this._renderSectionSelector();
				}
				break;
			}
				
				case 'upload_interface': {
          void import('./components/UploadPanel').then(({ UploadPanel }) => {
            const uploadPanel = new UploadPanel(this, this._audioCache);
            panelContent.appendChild(uploadPanel.render());
          }).catch((error: unknown) => {
            console.error('[Controller] Failed to load UploadPanel:', error);
          });
          break;
        }
				
				case 'thumbnail_grid': {
					// Handle backgrounds category grids
					if (this._state?.ui.activeCategory === 'backgrounds' && this._backgroundsConfig) {
						const subcategoryId = this._state.ui.activeSubcategory;
						const type = subcategoryId as 'paint' | 'accent' | 'rooms';
						const items = this._backgroundsConfig.categories[type];
						
						const thumbnailItems: ThumbnailItem[] = items.map(item => {
							if (item.rgb) {
								// Paint color - render as color swatch
								return {
									id: item.id,
									label: item.name,
									thumbnailUrl: '',
									disabled: false,
									tooltip: item.description,
									rgb: item.rgb
								};
							} else {
								// Image background
								return {
									id: item.id,
									label: item.name,
									thumbnailUrl: item.path || '',
									disabled: false,
									tooltip: item.description
								};
							}
						});
						
						const tooltipContext = {
							category: 'backgrounds',
							subcategory: type
						};
						const grid = new ThumbnailGrid(
							thumbnailItems,
							(id: string) => this.handleBackgroundSelected(id, type),
							this._state.ui.currentBackground.id,
							tooltipContext
						);
						
						panelContent.appendChild(grid.render());
					}
					break;
				}
        
        case 'tour_launcher': {
          void import('./components/TourLauncherPanel').then(({ TourLauncherPanel }) => {
            const tourPanel = new TourLauncherPanel(
              this,
              this._sceneManager
            );
            panelContent.appendChild(tourPanel.render());
          }).catch((error: unknown) => {
            console.error('[Controller] Failed to load TourLauncherPanel:', error);
          });
          break;
        }				

        case 'archetype_grid': {
          const filterKey = `${this._state.ui.activeCategory}_${this._state.ui.activeSubcategory}`;
          const stateFilters = this._state.ui.filterSelections[filterKey] || {};
          
          const matchingArchetypes = Array.from(this._archetypes.values())
            .filter(archetype => {
              // Apply active filters from state
              const activeShapes = stateFilters.shape ? new Set(stateFilters.shape) : new Set();
              if (activeShapes.size > 0 && !activeShapes.has(archetype.shape)) {
                return false;
              }
              
              const activePatterns = stateFilters.slot_pattern ? new Set(stateFilters.slot_pattern) : new Set();
              if (activePatterns.size > 0 && !activePatterns.has(archetype.slot_style)) {
                return false;
              }
              
              return true;
            })
            .map(archetype => ({
              id: archetype.id,
              label: archetype.label,
              thumbnailUrl: archetype.thumbnail,
              disabled: false, // Future validation logic here
              tooltip: archetype.tooltip
            }));
            
          const activeSelection = this.getActiveArchetypeId();
          
          const thumbnailGrid = new ThumbnailGrid(
            matchingArchetypes,
            (id) => { void this._handleArchetypeSelected(id); },
            activeSelection,
            { type: 'archetype' }
          );
          panelContent.appendChild(thumbnailGrid.render());
          break;
        }
				case 'backing_selector': {
          if (this._state) {
            void import('./components/BackingPanel').then(({ BackingPanel }) => {
              const backing = this._state!.composition.frame_design.backing || {
                enabled: false,
                type: 'acrylic',
                material: 'clear',
                inset: 0.5
              };

              const backingPanel = new BackingPanel(
                backing.enabled,
                backing.type,
                backing.material,
                (option: string, value: unknown) => {
                  if (option === 'backing_enabled') {
                    void this._updateBackingEnabled(value as boolean);
                  } else if (option === 'backing_material') {
                    const { type, material } = value as { type: string; material: string };
                    void this._updateBackingMaterial(type, material);
                  }
                }
              );
              
              panelContent.appendChild(backingPanel.render());
            }).catch((error: unknown) => {
              console.error('[Controller] Failed to load BackingPanel:', error);
              panelContent.innerHTML = '<div class="panel-placeholder">Failed to load backing options</div>';
            });
          }
          break;
        }
      }
    }

    this._rightMainPanel.appendChild(panelContent);
    this._rightMainPanel.style.display = 'block';
    this._rightMainPanel.classList.add('visible');
    
    /* // Gracefully center selected card after render
    requestAnimationFrame(() => {
      const selectedCard = this._rightMainPanel?.querySelector('.thumbnail-card.selected') as HTMLElement;
      if (selectedCard) {
        selectedCard.scrollIntoView({ 
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }
    }); */
  }
	
	/**
   * Get the current archetype ID from application state
   */
  public getActiveArchetypeId(): string | null {
    if (!this._state) return null;
    
    for (const archetype of this._archetypes.values()) {
      const comp = this._state.composition;
      const matches = 
        comp.frame_design.shape === archetype.shape &&
        comp.frame_design.number_sections === archetype.number_sections &&
        comp.pattern_settings.slot_style === archetype.slot_style;
      
      if (matches) {
        return archetype.id;
      }
    }
    
    return null;
  }
	
	/**
   * Generate cache key for archetype + background combination
   */
  private _getCacheKey(archetypeId: string, backgroundId: string): string {
    return `${archetypeId}_${backgroundId}`;
  }
  
  /**
   * Get background key for cache lookup (converts paint/accent to generic key)
   */
  private _getBackgroundKeyForCache(background: { id: string; type: string }): string {
    return (background.type === 'paint' || background.type === 'accent') 
      ? 'paint_and_accent' 
      : background.id;
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
  private async _handleArchetypeSelected(archetypeId: string): Promise<void> {
    if (!this._state) return;
    
    const archetype = this._archetypes.get(archetypeId);
    if (!archetype) {
      console.warn(`[Controller] Archetype not found: ${archetypeId}`);
      return;
    }
    
    const backgroundId = this._getBackgroundKeyForCache(this._state.ui.currentBackground);
    const cacheKey = this._getCacheKey(archetypeId, backgroundId);
    
    // Check cache first
    let composition = this._compositionCache.get(cacheKey);
    
    if (!composition) {
      // First visit: apply archetype base
      composition = structuredClone(this._state.composition);
      
      // Apply all properties from the archetype to the composition state
      composition.frame_design.shape = archetype.shape;
      composition.frame_design.number_sections = archetype.number_sections;
      composition.frame_design.separation = archetype.separation;
      composition.pattern_settings.slot_style = archetype.slot_style;
      composition.pattern_settings.number_slots = archetype.number_slots;
      if (archetype.side_margin !== undefined) {
        composition.pattern_settings.side_margin = archetype.side_margin;
      }
      
      // If the new shape is circular, intelligently adjust and clamp the size.
      if (archetype.shape === 'circular') {
        const currentX = composition.frame_design.finish_x;
        const currentY = composition.frame_design.finish_y;
        const smallerCurrentDim = Math.min(currentX, currentY);

        let maxAllowedSize = 60;
        let minAllowedSize = 24;
        if (this._constraints?.manufacturing.circular.by_section_count) {
          const nKey = String(archetype.number_sections);
          const constraint = this._constraints.manufacturing.circular.by_section_count[nKey];
          maxAllowedSize = constraint?.max ?? this._constraints.manufacturing.circular.general.max;
          minAllowedSize = constraint?.min ?? this._constraints.manufacturing.circular.general.min;
        }
        
        const newSize = Math.max(minAllowedSize, Math.min(smallerCurrentDim, maxAllowedSize));
        composition.frame_design.finish_x = newSize;
        composition.frame_design.finish_y = newSize;
      }
			
			// CRITICAL: Apply placement defaults (composition_overrides) ONLY during archetype selection
      // Background changes (handleBackgroundSelected) must NOT reapply these defaults to preserve user modifications
      // Apply placement defaults (first visit only)
      if (this._placementDefaults) {
        const placementData = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.[backgroundId];
        if (placementData?.composition_overrides) {
          composition = deepMerge(composition, placementData.composition_overrides);
        }
      }
      
      // Cache the result
      this._compositionCache.set(cacheKey, composition);
    }
    
    // Apply cached or newly created composition
    await this.handleCompositionUpdate(composition);
		
		// Re-render the panel to show updated selection and new slider limits
    this._renderRightMainFiltered();
    
    // Update art placement
    if (this._sceneManager) {
      let artPlacement: ArtPlacement | undefined;
      
      // 1. Check placement_defaults for archetype-specific override
      if (this._placementDefaults) {
        const placementData = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.[backgroundId];
        artPlacement = placementData?.art_placement;
        
        if (!artPlacement && backgroundId !== 'paint_and_accent') {
          artPlacement = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.['paint_and_accent']?.art_placement;
        }
      }
      
      // 2. Fallback to background's default art_placement
      if (!artPlacement && this._backgroundsConfig && this._state) {
        const bgType = this._state.ui.currentBackground.type;
        if (bgType === 'rooms') {
          const background = this._backgroundsConfig.categories.rooms.find(bg => bg.id === backgroundId);
          artPlacement = background?.art_placement;
        }
      }

      if (artPlacement && 'applyArtPlacement' in this._sceneManager) {
        (this._sceneManager as any).applyArtPlacement(artPlacement);
      } else if ('resetArtPlacement' in this._sceneManager) {
        (this._sceneManager as any).resetArtPlacement();
      }
    }
    
    // Re-render the panel to show updated selection
    this._renderRightMainFiltered();
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

    // Handle backing enabled toggle
    if (option === 'backing_enabled') {
      void this._updateBackingEnabled(value as boolean);
      return;
    }

    // Handle backing material change
    if (option === 'backing_material') {
      const { type, material } = value as { type: string; material: string };
      void this._updateBackingMaterial(type, material);
      return;
    }

    // Handle direct state updates
    void this._updateStateValue(option, value);
  }
	
	/**
   * Update dimension with constraint logic
   * Handles width/height changes respecting aspect ratio lock and shape constraints
   * @private
   */
  private async _updateDimension(
    axis: 'x' | 'y',
    value: number
  ): Promise<void> {
		
		console.log('[DIMENSION UPDATE]', {
      axis,
      value,
      currentArchetype: this.getActiveArchetypeId()
    });
		
    if (!this._state) return;

    const newComposition = structuredClone(this._state.composition);
		
		let newValue = value; // Use a mutable variable for clamping

    // Build constraints from current state and config
    const uiConfig = window.uiEngine?.config;
    const shapeConstraints = uiConfig?.dimension_constraints?.[newComposition.frame_design.shape];
    
    const constraints: DimensionConstraints = {
      shape: newComposition.frame_design.shape,
      aspectRatioLocked: this._state.ui.aspectRatioLocked ?? false,
      lockedAspectRatio: this._state.ui.lockedAspectRatio ?? null,
      minDimension: shapeConstraints?.min_dimension ?? 8.0,
      maxDimension: shapeConstraints?.max_dimension ?? 84.0
    };
    
    // Calculate new dimensions using utility function
    const result = applyDimensionChange(
      axis,
      newValue,
      newComposition.frame_design.finish_x,
      newComposition.frame_design.finish_y,
      constraints
    );
    
    // Apply calculated dimensions
    newComposition.frame_design.finish_x = result.finish_x;
    newComposition.frame_design.finish_y = result.finish_y;
    
    // Update UI state if lock was broken by clamping
    if (result.lockBroken && this._state.ui.aspectRatioLocked) {
      this._state = {
        ...this._state,
        ui: {
          ...this._state.ui,
          aspectRatioLocked: false,
          lockedAspectRatio: null
        }
      };
    }
    
    // Single update through facade
    await this.handleCompositionUpdate(newComposition);
    
    // Update the OTHER slider's max value directly without re-rendering
		const archetypeId = this.getActiveArchetypeId();
		if (archetypeId && this._resolver && this._state) {
			const sliderConfigs = this._resolver.resolveSliderConfigs(archetypeId, this._state.composition);
			
			// Update width slider max if height changed
			if (axis === 'y') {
				const widthConfig = sliderConfigs.find(s => s.id === 'width');
				if (widthConfig) {
					const widthSlider = document.getElementById('width') as HTMLInputElement;
					if (widthSlider) {
						widthSlider.max = String(widthConfig.max);
						// Clamp current value if it exceeds new max
						if (parseFloat(widthSlider.value) > widthConfig.max) {
							widthSlider.value = String(widthConfig.max);
							const valueDisplay = document.getElementById('width-value');
							if (valueDisplay) {
								valueDisplay.textContent = `${widthConfig.max}"`;
							}
						}
					}
				}
			}
			
			// Update height slider max if width changed
			if (axis === 'x') {
				const heightConfig = sliderConfigs.find(s => s.id === 'height');
				if (heightConfig) {
					const heightSlider = document.getElementById('height') as HTMLInputElement;
					if (heightSlider) {
						heightSlider.max = String(heightConfig.max);
						// Clamp current value if it exceeds new max
						if (parseFloat(heightSlider.value) > heightConfig.max) {
							heightSlider.value = String(heightConfig.max);
							const valueDisplay = document.getElementById('height-value');
							if (valueDisplay) {
								valueDisplay.textContent = `${heightConfig.max}"`;
							}
						}
					}
				}
			}
		}
	}	

	/**
   * Handle aspect ratio lock toggle
   * Captures current ratio when locked, clears when unlocked
   * @private
   */
  private _handleAspectRatioLockChange(locked: boolean): void {
    if (!this._state) return;
    
    const newState = structuredClone(this._state);
    newState.ui.aspectRatioLocked = locked;
    
    if (locked) {
      // Capture current ratio
      const { finish_x, finish_y } = this._state.composition.frame_design;
      newState.ui.lockedAspectRatio = finish_x / finish_y;
    } else {
      // Clear locked ratio
      newState.ui.lockedAspectRatio = null;
    }
    
    // Update state (no backend call needed - UI-only state)
    this._state = newState;
    this._facade.persistState(this._state);
    
    // Re-render to update UI
    this._renderRightMainFiltered();
  }
	
	/**
 * Update state value and trigger re-render
 * Uses UI config as single source of truth for state paths
 * @private
 */
	private async _updateStateValue(option: string, value: unknown): Promise<void> {
		if (!this._state) return;

		// Route width/height changes through dimension calculator
		if (option === 'width' || option === 'size') {
			return this._updateDimension('x', value as number);
		}
		if (option === 'height') {
			return this._updateDimension('y', value as number);
		}

		const newComposition = structuredClone(this._state.composition);

		// UIEngine is the authoritative source for element configs
		const elementConfig = window.uiEngine?.getElementConfig(option);
		
		if (!elementConfig?.state_path) {
			console.warn(`[Controller] No state_path found for option: ${option}`);
			return;
		}

		// Update the nested value using state_path from UIEngine
		this._setNestedValue(newComposition, elementConfig.state_path, value);
		
		// CRITICAL: For circular panels, "size", "width", and "height" all control diameter
		// and must update both finish_x and finish_y to maintain a perfect circle.
		if (newComposition.frame_design.shape === 'circular' && ['size', 'width', 'height'].includes(option)) {
      newComposition.frame_design.finish_x = value as number;
      newComposition.frame_design.finish_y = value as number;
    }

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
      const material = materials.find(m => m.section_id === sectionId);
      
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
   * Update backing material
   * @private
   */
  private async _updateBackingMaterial(type: string, material: string): Promise<void> {
    if (!this._state) return;
		
		const backingType = type as 'acrylic' | 'cloth' | 'leather' | 'foam';

    // Define the backing object first to avoid parser ambiguity
    const currentBacking = this._state.composition.frame_design.backing || { enabled: true, inset: 0.5 };
    const newComposition: CompositionStateDTO = {
      ...this._state.composition,
      frame_design: {
        ...this._state.composition.frame_design,
        backing: {
          ...currentBacking,
          enabled: true,
          type: backingType,
          material: material,
        }
      }
    };
    
    const response = await fetch('http://localhost:8000/geometry/backing-parameters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newComposition)
    });

    if (!response.ok) {
      console.error('[Controller] Failed to fetch backing parameters after material change.');
      return;
    }
    const backingParams = await response.json();
    
    await this.dispatch({ type: 'COMPOSITION_UPDATED', payload: newComposition });

    if (this._sceneManager) {
      await this._sceneManager.generateBackingIfEnabled(backingParams, newComposition);
    }
  }
	
	private async _updateBackingEnabled(enabled: boolean): Promise<void> {
		if (!this._state) return;
		
		const currentBacking = this._state.composition.frame_design.backing || { 
			type: 'acrylic', 
			material: 'clear', 
			inset: 0.5 
		};
		
		const newComposition: CompositionStateDTO = {
			...this._state.composition,
			frame_design: {
				...this._state.composition.frame_design,
				backing: {
					...currentBacking,
					enabled
				}
			}
		};
		
		const response = await fetch('http://localhost:8000/geometry/backing-parameters', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(newComposition)
		});

		if (!response.ok) {
			console.error('[Controller] Failed to fetch backing parameters');
			return;
		}
		
		const backingParams = await response.json();
		await this.dispatch({ type: 'COMPOSITION_UPDATED', payload: newComposition });

		if (this._sceneManager) {
			await this._sceneManager.generateBackingIfEnabled(backingParams, newComposition);
		}
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
		
    if (this._isUpdatingComposition) {
      console.warn('[Controller] Composition update already in progress. Ignoring request.');
      return;
    }
    this._isUpdatingComposition = true;
    try {
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
            (window as { updateGrainDirectionOptionsFromController?: (n: number) => void }).updateGrainDirectionOptionsFromController?.(newComposition.frame_design.number_sections);
          }
        }
      }
      
      // Initialize section_materials when number_sections changes
      const oldN = this._state.composition.frame_design.number_sections;
      const newN = newComposition.frame_design.number_sections;

      if (oldN !== newN) {
      
      // CRITICAL: Use materials from UI snapshot, NOT old state
      const uiCapturedMaterials = newComposition.frame_design.section_materials || [];
      if (this._woodMaterialsConfig) { // Ensure config is loaded
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
        
        // Update cache with user's customization
        const archetypeId = this.getActiveArchetypeId();
        if (archetypeId) {
          const backgroundId = this._getBackgroundKeyForCache(this._state.ui.currentBackground);
          const cacheKey = this._getCacheKey(archetypeId, backgroundId);
          this._compositionCache.set(cacheKey, structuredClone(newComposition));
        }
        
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
          
          // Re-apply art placement after rendering
          const archetypeId = this.getActiveArchetypeId();
          if (archetypeId) {
            const backgroundKey = this._getBackgroundKeyForCache(this._state.ui.currentBackground);
            let artPlacement: ArtPlacement | undefined;
            
            // 1. Check placement_defaults for archetype-specific override
            if (this._placementDefaults) {
              const placementData = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.[backgroundKey];
              artPlacement = placementData?.art_placement;
              
              if (!artPlacement && backgroundKey !== 'paint_and_accent') {
                artPlacement = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.['paint_and_accent']?.art_placement;
              }
            }
            
            // 2. Fallback to background's default art_placement
            if (!artPlacement && this._backgroundsConfig && this._state) {
              const bgType = this._state.ui.currentBackground.type;
              if (bgType === 'rooms') {
                const bgId = this._state.ui.currentBackground.id;
                const background = this._backgroundsConfig.categories.rooms.find(bg => bg.id === bgId);
                artPlacement = background?.art_placement;
              }
            }

            if (artPlacement && 'applyArtPlacement' in this._sceneManager) {
              (this._sceneManager as any).applyArtPlacement(artPlacement);
            } else if ('resetArtPlacement' in this._sceneManager) {
              (this._sceneManager as any).resetArtPlacement();
            }
          }
        }
        
        // Update cache with user's customization
        const archetypeId = this.getActiveArchetypeId();
        if (archetypeId) {
          const backgroundId = this._getBackgroundKeyForCache(this._state.ui.currentBackground);
          const cacheKey = this._getCacheKey(archetypeId, backgroundId);
          this._compositionCache.set(cacheKey, structuredClone(response.updated_state));
        }
        
        // Finally, notify all other UI components that the state has changed.
        this.notifySubscribers();

      } catch (error: unknown) {
        // Optionally dispatch an error state to the UI
      }
    } finally {
      this._isUpdatingComposition = false;
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
	
	public getBackgroundsConfig(): BackgroundsConfig | null {
    return this._backgroundsConfig;
  }
  
  /**
   * Select a section for material editing
   */
  selectSection(indices: Set<number>): void {
    this._selectedSectionIndices = new Set(indices);
    
    // Update section selector panel if it exists
    if (this._sectionSelectorPanel) {
      this._sectionSelectorPanel.updateSelection(indices);
    }
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