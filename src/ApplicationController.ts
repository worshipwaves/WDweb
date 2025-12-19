/**
 * ApplicationController - Central state management and orchestration
 * 
 * Single source of truth for application state.
 * Coordinates between UI components and the facade.
 * Manages timers, autoplay, and phase transitions.
 */

import { AudioCacheService } from './AudioCacheService';
import { AspectRatioLock } from './components/AspectRatioLock';
import { FilterIconStrip } from './components/FilterIconStrip';
import { PanelStackManager } from './components/PanelStackManager';
import { RightPanelContentRenderer } from './components/RightPanelContent';
import { SectionSelectorPanel } from './components/SectionSelectorPanel';
import { SliderGroup } from './components/SliderGroup';
import { SubcategoryAccordion, type AccordionItemConfig } from './components/SubcategoryAccordion';
import { ThumbnailGrid } from './components/ThumbnailGrid';
import { AccordionStyleCard } from './components/AccordionStyleCard';
import { AccordionSpeciesCard } from './components/AccordionSpeciesCard';
import { AccordionCollectionCard, type CollectionCardConfig } from './components/AccordionCollectionCard';
import { CollectionVariantSelector } from './components/CollectionVariantSelector';
import { HorizontalScrollContainer } from './components/HorizontalScrollContainer';
import { WoodMaterialSelector } from './components/WoodMaterialSelector';
import { PerformanceMonitor } from './PerformanceMonitor';
import { ConstraintResolver } from './services/ConstraintResolver';
import type { CategoriesConfig, FilterIconGroup, PanelComponent, ThumbnailConfig } from './types/PanelTypes';
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
	type ConstraintsConfig,
  type CSGDataResponse,
  type PlacementDefaults,
  type SectionMaterial,
  type WoodMaterialsConfig,
} from './types/schemas';
import { applyDimensionChange, type DimensionConstraints } from './utils/dimensionUtils';
import { deepMerge } from './utils/mergeUtils';
import { fetchAndValidate } from './utils/validation';
import { Action, WaveformDesignerFacade } from './WaveformDesignerFacade';
import { type CategoriesConfig, type FilterIconGroup, type ThumbnailConfig } from './types/PanelTypes';


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
  config?: { dimension_constraints?: Record<string, { allow_aspect_lock?: boolean; min_dimension?: number; max_dimension?: number }> };
}

declare global {
  interface Window {
    uiEngine?: UIEngine;
  }
}

// Subscriber callback type
type StateSubscriber = (state: ApplicationState) => void;

/**
 * Initialize section_materials array when number_sections changes.
 * Implements smart inheritance: unanimous species/grain → inherit, mixed → defaults.
 */
function initializeSectionMaterials(
  oldN: number,
  newN: number,
  uiCapturedMaterials: SectionMaterial[],
  config: WoodMaterialsConfig,
  availableGrains: string[]
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
  if (!availableGrains.includes(intendedGrain)) {
    intendedGrain = config.default_grain_direction;
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
  private _collectionsCatalog: import('./types/schemas').CollectionsCatalog | null = null;
  private _collectionVariantSelector: CollectionVariantSelector | null = null;
	private _currentRoomId: string | null = null;
	private _currentWallFinishId: string | null = null;
  private _idleTextureLoader: unknown = null; // IdleTextureLoader instance
	private _placementDefaults: PlacementDefaults | null = null;
	private _constraints: ConstraintsConfig | null = null;
	private _resolver: ConstraintResolver | null = null;
	private _compositionCache: Map<string, CompositionStateDTO> = new Map();
  private _marginPresetCache: Map<string, import('../types/schemas').MarginPreset[]> = new Map();
  private _isUpdatingComposition: boolean = false;
	public getResolver(): ConstraintResolver | null {
    return this._resolver;
  }
  
  private _isRectangularLinearN3Plus(archetypeId: string): boolean {
    return archetypeId === 'rectangular_linear_n3' || archetypeId === 'rectangular_linear_n4';
  }
	public getConstraintsConfig(): ConstraintsConfig | null {
    return this._constraints;
  }
	
	private async _fetchMarginPresets(composition: CompositionStateDTO): Promise<import('../types/schemas').MarginPreset[]> {
    const frame = composition.frame_design;
    const pattern = composition.pattern_settings;
    
    if (frame.shape !== 'rectangular' || pattern.slot_style !== 'linear' || frame.number_sections < 3) {
      return [];
    }
    
    const cacheKey = `${frame.finish_x}-${frame.separation}-${frame.number_sections}-${pattern.number_slots}`;
    
    const cached = this._marginPresetCache.get(cacheKey);
    if (cached) return cached;
    
    try {
      const response = await fetch('/api/geometry/margin-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finish_x: frame.finish_x,
          separation: frame.separation,
          number_sections: frame.number_sections,
          number_slots: pattern.number_slots,
          x_offset: pattern.x_offset,
          spacer: pattern.spacer,
          bit_diameter: pattern.bit_diameter,
          shape: frame.shape,
          slot_style: pattern.slot_style
        })
      });
      
      const data = await response.json() as import('../types/schemas').MarginPresetsResponse;
      
      if (data.applicable && data.presets.length > 0) {
        this._marginPresetCache.set(cacheKey, data.presets);
        return data.presets;
      }
    } catch (e) {
      console.error('[Controller] Failed to fetch margin presets:', e);
    }
    
    return [];
  }
	
	public getMarginPresets(composition: CompositionStateDTO): import('../types/schemas').MarginPreset[] {
    const frame = composition.frame_design;
    const pattern = composition.pattern_settings;
    const cacheKey = `${frame.finish_x}-${frame.separation}-${frame.number_sections}-${pattern.number_slots}`;
    return this._marginPresetCache.get(cacheKey) || [];
  }
  
  public getCategories(): import('./types/PanelTypes').CategoryConfig[] {
    if (!this._categoriesConfig) return [];
    return Object.entries(this._categoriesConfig)
      .map(([id, config]) => ({
        id,
        label: config.label,
        icon: '',
        enabled: Object.keys(config.subcategories).length > 0,
        order: config.order ?? 99
      }))
      .sort((a, b) => a.order - b.order);
  }
	
	// Four-panel navigation configuration
  private _thumbnailConfig: ThumbnailConfig | null = null;
  private _categoriesConfig: CategoriesConfig | null = null;
	private _archetypes: Map<string, Archetype> = new Map();
  
  // Four-panel DOM references
	private _leftMainPanel: HTMLElement | null = null;
  private _leftSecondaryPanel: HTMLElement | null = null;
  private _rightSecondaryPanel: HTMLElement | null = null;
  private _rightMainPanel: HTMLElement | null = null;
  private _filterIconStrip: FilterIconStrip | null = null;
  private _sectionSelectorPanel: SectionSelectorPanel | null = null;
  private _helpTooltip: Tooltip | null = null;
  private _activeRightPanelComponent: PanelComponent | null = null;
  private _renderId: number = 0;
  private _accordion: SubcategoryAccordion | null = null;
  private _accordionState: Record<string, Record<string, boolean>> = {};
	private _audioSlicerPanel: import('./components/AudioSlicerPanel').AudioSlicerPanel | null = null;
  
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
	
	public updateAudioSourceState(updates: Partial<{
    source_file: string | null;
    start_time: number;
    end_time: number;
    use_stems: boolean;
  }>): void {
    if (!this._state) return;
    this._state.composition.audio_source = {
      ...this._state.composition.audio_source,
      ...updates
    };
    this._facade.persistState(this._state);
  }

  public updateAudioProcessingState(updates: Partial<{
    remove_silence: boolean;
  }>): void {
    if (!this._state) return;
    this._state.composition.audio_processing = {
      ...this._state.composition.audio_processing,
      ...updates
    };
    this._facade.persistState(this._state);
  }
	
	/**
   * Restore UI from persisted state after DOM is ready
   * Called from main.ts after LeftPanelRenderer has rendered
   */
  restoreUIFromState(): void {
    if (!this._state) return;
    
    // Restore accordion state from persisted state
    if (this._state.ui.accordionState) {
      this._accordionState = { ...this._state.ui.accordionState };
    }
    
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
    
    // 2. Render accordion for the category (replaces Left Secondary Panel)
    this._renderAccordionForCategory(activeCategory);
    
    // 3. Subcategory content now handled by accordion's getContent callback
  }
  
  /**
   * Initialize the controller with default or restored state
   */
  async initialize(): Promise<void> {
    try {
      // Initialize facade (loads style presets)
      this._facade.initialize();
			
			// Initialize help tooltip
      void import('./components/Tooltip').then(({ Tooltip }) => {
        this._helpTooltip = new Tooltip();
      });
			
			// Initialize panel references (DOM is ready at this point)
      this._leftMainPanel = document.getElementById('left-main-panel');
      this._leftSecondaryPanel = document.getElementById('left-secondary-panel');
      this._rightSecondaryPanel = document.getElementById('right-secondary-panel');
      this._rightMainPanel = document.getElementById('right-main-panel');
      
      if (!this._leftSecondaryPanel || !this._rightSecondaryPanel || !this._rightMainPanel) {
        console.warn('[Controller] Four-panel DOM elements not found');
      }

      window.addEventListener('resize', () => {
        this._updateLeftSecondaryPosition();
      });
      
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
				fetch('http://localhost:8000/api/config/archetypes').then(r => r.json() as Promise<Record<string, Archetype>>),
				fetch('http://localhost:8000/api/config/wood-materials').then(r => r.json() as Promise<WoodMaterialsConfig>),
				fetchAndValidate<BackgroundsConfig>('http://localhost:8000/api/config/backgrounds', BackgroundsConfigSchema),
				fetch('http://localhost:8000/api/config/placement-defaults').then(r => r.json() as Promise<PlacementDefaults>),
				fetch('http://localhost:8000/api/config/ui').then(r => r.json() as Promise<UIConfig>),
				fetch('http://localhost:8000/api/config/composition-defaults').then(r => r.json() as Promise<unknown>),
				fetchAndValidate('http://localhost:8000/api/config/constraints', ConstraintsConfigSchema)
			]);

			// Store archetypes
			Object.entries(archetypes).forEach(([id, data]) => {
				this._archetypes.set(id, data);
			});

			// Store configs
			this._woodMaterialsConfig = woodMaterials;
			this._backgroundsConfig = backgrounds;
			this._currentRoomId = (backgrounds as { default_room?: string }).default_room || 'blank_wall';
			this._currentWallFinishId = (backgrounds as { default_wall_finish?: string }).default_wall_finish || 'warm-beige';
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

    // specific default selection logic
    if (!this._state.ui.activeCategory) {
      const categoryIds = Object.keys(this._categoriesConfig || {});
      if (categoryIds.length > 0) this.handleCategorySelected(categoryIds[0]);
    }
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
		
		// Special handling for audio commit (slice/vocals)
    if (action.type === 'AUDIO_COMMIT') {
      await this._handleAudioCommit(action.payload);
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
        const selectedSpecies = this._state?.composition?.frame_design?.section_materials?.[0]?.species 
          || this._woodMaterialsConfig.default_species;
        void textureCache.preloadAllTextures(this._woodMaterialsConfig, selectedSpecies).then((idleLoader) => {
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
        (sceneManager as unknown as { changeBackground: (type: string, id: string, rgb?: number[], path?: string, foregroundPath?: string, wallCompensation?: number) => void })
          .changeBackground(bgState.type, bgState.id, background.rgb, background.path, (background as { foreground_path?: string }).foreground_path, (background as { wall_compensation?: number }).wall_compensation);
        
        // Apply lighting config on initial load
        if (background.lighting && 'applyLighting' in sceneManager) {
          (sceneManager as unknown as { applyLighting: (lighting: unknown) => void }).applyLighting(background.lighting);
        } else if ('resetLighting' in sceneManager) {
          (sceneManager as unknown as { resetLighting: () => void }).resetLighting();
        }
        
        // Set initial body class for blank wall controls visibility
        document.body.classList.toggle('room-blank-wall', bgState.id === 'blank_wall');
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
   * Handle committed audio (slice and/or vocal isolation)
   * Sends to backend, receives processed audio, triggers art generation
   */
  private async _handleAudioCommit(payload: {
    useSlice: boolean;
    startTime: number | null;
    endTime: number | null;
    isolateVocals: boolean;
    sliceBlob: Blob | null;
    originalFile?: File;
  }): Promise<void> {
    if (!this._state) return;
    
    // Determine source audio - Always prefer original file for desktop parity
    const audioFile = payload.originalFile || 
      (payload.sliceBlob ? new File([payload.sliceBlob], 'slice.wav', { type: 'audio/wav' }) : null);
    
    if (!audioFile) {
      console.error('[Controller] No audio file for commit');
      return;
    }
    
    // Show processing state
    if (payload.isolateVocals) {
      await this.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'demucs', progress: 0 }
      });
    } else {
      await this.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'uploading', progress: 0 }
      });
    }
    
    try {
      // Build form data
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('isolate_vocals', String(payload.isolateVocals));
      formData.append('remove_silence', String(payload.removeSilence));
      formData.append('silence_threshold', String(payload.silenceThreshold));
      formData.append('silence_min_duration', String(payload.silenceMinDuration));
      
      // Send timing if we are using the original file to ensure backend handles slicing (parity)
      const isOriginal = audioFile === payload.originalFile;
      if (isOriginal && payload.useSlice && payload.startTime !== null && payload.endTime !== null) {
        formData.append('start_time', String(payload.startTime));
        formData.append('end_time', String(payload.endTime));
      }
      
      // Call backend
      const response = await fetch('/api/audio/process-commit', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Audio processing failed: ${response.status}`);
      }
      
      // Get processed audio blob
      const processedBlob = await response.blob();
      const processedFile = new File([processedBlob], 'processed.wav', { type: 'audio/wav' });
      
      // PARITY FIX: The file is already processed (silence removed).
      // Update state snapshot to prevent double-processing in the main pipeline.
      const cleanState = structuredClone(this._state.composition);
      if (payload.removeSilence) {
        cleanState.audio_processing.remove_silence = false;
      }

      // Feed into existing upload pipeline
      await this.handleFileUpload(processedFile, cleanState);
      
    } catch (error) {
      console.error('[Controller] Audio commit failed:', error);
      await this.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'idle', progress: 0 }
      });
    }
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
			
      // Clear the audio cache
      this._audioCache.clearAll();
			
			// Clear composition cache on new audio upload
      this._compositionCache.clear();

      // Preserve current background selection during audio processing
      const currentBg = this._state.ui.currentBackground;
      if (this._backgroundsConfig && this._sceneManager && 'changeBackground' in this._sceneManager) {
        const changeBackground = (this._sceneManager as unknown as { changeBackground: (type: string, id: string, rgb?: number[], path?: string, foregroundPath?: string, wallCompensation?: number) => Promise<void> }).changeBackground;
        
        if (currentBg.type === 'rooms') {
          const room = this._backgroundsConfig.categories.rooms.find(r => r.id === currentBg.id);
          if (room) {
            await changeBackground.call(this._sceneManager, 'rooms', room.id, undefined, room.path, (room as { foreground_path?: string }).foreground_path, (room as { wall_compensation?: number }).wall_compensation);
          }
        } else if (currentBg.type === 'paint') {
          const paint = this._backgroundsConfig.categories.paint.find(p => p.id === currentBg.id);
          if (paint) {
            await changeBackground.call(this._sceneManager, 'paint', paint.id, (paint as { rgb?: number[] }).rgb, (paint as { path?: string }).path, undefined, undefined);
          }
        } else if (currentBg.type === 'accent') {
          const accent = this._backgroundsConfig.categories.accent.find(a => a.id === currentBg.id);
          if (accent) {
            await changeBackground.call(this._sceneManager, 'accent', accent.id, (accent as { rgb?: number[] }).rgb, (accent as { path?: string }).path, undefined, undefined);
          }
        }
      }

      // Process audio through facade
      const audioResponse: AudioProcessResponse = await this._facade.processAudio(
        file,
        uiSnapshot
      );
      PerformanceMonitor.end('backend_audio_processing');

      PerformanceMonitor.start('cache_raw_samples');
      // Cache the raw samples
      const sessionId = this._audioCache.cacheRawSamples(
        file,
        new Float32Array(audioResponse.raw_samples_for_cache)
      );
      PerformanceMonitor.end('cache_raw_samples');
      
      // Preserve section_materials from uiSnapshot (user's wood customizations)
      // Backend may return defaults; frontend owns material selections
      const preservedComposition = {
        ...audioResponse.updated_state,
        frame_design: {
          ...audioResponse.updated_state.frame_design,
          section_materials: uiSnapshot.frame_design?.section_materials 
            ?? audioResponse.updated_state.frame_design.section_materials
        }
      };
      
      // Dispatch the backend response with preserved materials
      await this.dispatch({
        type: 'FILE_PROCESSING_SUCCESS',
        payload: {
          composition: preservedComposition,
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
          preservedComposition,
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
    
    // Disable section interaction when leaving WOOD category
    if (this._sceneManager && 'setSectionInteractionEnabled' in this._sceneManager) {
      (this._sceneManager as { setSectionInteractionEnabled: (enabled: boolean) => void }).setSectionInteractionEnabled(false);
      (this._sceneManager as { setSectionOverlaysVisible: (visible: boolean) => void }).setSectionOverlaysVisible(false);
    }
    
    void this.dispatch({ type: 'CATEGORY_SELECTED', payload: categoryId });
    
    // Render accordion for the new category
    this._renderAccordionForCategory(categoryId);
  }
	
	/**
   * Handle background selection from UI
   */
  handleBackgroundSelected(backgroundId: string, type: 'paint' | 'accent' | 'rooms'): void {
    if (!this._backgroundsConfig || !this._sceneManager) return;
    
    const category = this._backgroundsConfig.categories[type];
    const background = category?.find(bg => bg.id === backgroundId);
    
    if (!background) {
      console.error(`[Controller] Background not found: ${backgroundId}`);
      return;
    }
    
    // Handle paint/texture as wall finish update (applies to current room)
    if (type === 'paint') {
      this._currentWallFinishId = backgroundId;
      
      // Update state
      if (this._state) {
        this._state = {
          ...this._state,
          ui: {
            ...this._state.ui,
            currentWallFinish: backgroundId
          }
        };
        this._facade.persistState(this._state);
      }
      
      // Store wall finish in SceneManager
      if ('changeBackground' in this._sceneManager) {
        (this._sceneManager as unknown as { changeBackground: (type: string, id: string, rgb?: number[], path?: string, foregroundPath?: string, wallCompensation?: number) => void })
          .changeBackground('paint', backgroundId, background.rgb, background.path);
      }
      
			// Re-apply current room with new wall finish (use state, not _currentRoomId which may be stale)
			const currentBg = this._state?.ui.currentBackground;
			if (currentBg?.type === 'rooms') {
				const room = this._backgroundsConfig.categories.rooms.find(r => r.id === currentBg.id);
				if (room?.foreground_path) {
					(this._sceneManager as unknown as { changeBackground: (type: string, id: string, rgb?: number[], path?: string, foregroundPath?: string, wallCompensation?: number) => void })
						.changeBackground('rooms', currentBg.id, undefined, room.path, room.foreground_path, (room as { wall_compensation?: number }).wall_compensation);
				}
			}
      
      this.notifySubscribers();
      return;
    }
    
    // Handle room selection
    if (type === 'rooms') {
      this._currentRoomId = backgroundId;
      
      // Toggle body class for blank wall controls visibility
      document.body.classList.toggle('room-blank-wall', backgroundId === 'blank_wall');
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
    
    // Apply to scene (deferred until after composition update to prevent flash of wrong size)
		const applyBackground = (): Promise<void> => {
			if ('changeBackground' in this._sceneManager) {
				return (this._sceneManager as unknown as { changeBackground: (type: string, id: string, rgb?: number[], path?: string, foregroundPath?: string, wallCompensation?: number) => Promise<void> })
					.changeBackground(type, backgroundId, background.rgb, background.path, (background as { foreground_path?: string }).foreground_path, (background as { wall_compensation?: number }).wall_compensation);
			}
			return Promise.resolve();
		};
    
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
					
					// Clamp to scene constraints (new scene may have tighter limits)
          if (this._resolver) {
            const sliderConfigs = this._resolver.resolveSliderConfigs(archetypeId, composition);
            const sizeOrWidth = sliderConfigs.find(s => s.id === 'width' || s.id === 'size');
            const sizeOrHeight = sliderConfigs.find(s => s.id === 'height' || s.id === 'size');
            if (sizeOrWidth) composition.frame_design.finish_x = Math.min(composition.frame_design.finish_x, sizeOrWidth.max);
            if (sizeOrHeight) composition.frame_design.finish_y = Math.min(composition.frame_design.finish_y, sizeOrHeight.max);
          }
          
          // Cache the current state as-is to preserve user modifications
          this._compositionCache.set(cacheKey, composition);
				} else {
					// Cache hit: restore cached composition but preserve current backing state
					const currentBacking = this._state.composition.frame_design.backing;
					composition = {
						...composition,
						frame_design: {
							...composition.frame_design,
							backing: currentBacking
						}
					};
				}

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

				const applyArtAndLighting = () => {
						if (artPlacement && 'applyArtPlacement' in this._sceneManager) {
							(this._sceneManager as unknown as { applyArtPlacement: (placement: ArtPlacement) => void }).applyArtPlacement(artPlacement);
						} else if ('resetArtPlacement' in this._sceneManager) {
							(this._sceneManager as unknown as { resetArtPlacement: () => void }).resetArtPlacement();
						}

						if (background?.lighting && 'applyLighting' in this._sceneManager) {
							(this._sceneManager as unknown as { applyLighting: (lighting: unknown) => void }).applyLighting(background.lighting);
						} else if ('resetLighting' in this._sceneManager) {
							(this._sceneManager as unknown as { resetLighting: () => void }).resetLighting();
						}
					};
				void this.handleCompositionUpdate(composition).then(applyBackground).then(applyArtAndLighting);
      }
    }
    
    // Re-render panel to show updated selection (skip if accordion handles rendering)
    if (!this._accordion) {
      this._renderRightMainFiltered();
    }
  }
	
	/**
   * Update left secondary panel position based on main panel width
   */
  private _updateLeftSecondaryPosition(): void {
    if (!this._leftMainPanel || !this._leftSecondaryPanel) return;
    
    // Calculate position based on main panel's actual width
    const mainRect = this._leftMainPanel.getBoundingClientRect();
    const gap = 16; 
    
    // Determine the gap based on CSS logic (8px initial offset + width + gap)
    // Here we just use the right edge of the main panel + gap
    this._leftSecondaryPanel.style.left = `${mainRect.right + gap}px`;
  }
  
  /**
   * Render subcategory accordion for a category
   * Replaces the horizontal subcategory tab bar with vertical accordion
   * @private
   */
  private _renderAccordionForCategory(categoryId: string): void {
    if (!this._categoriesConfig || !this._rightMainPanel) return;
    
    const categoryConfig = this._categoriesConfig[categoryId as keyof CategoriesConfig];
    if (!categoryConfig) return;
    
    // Destroy previous accordion
    if (this._accordion) {
      this._accordion.destroy();
      this._accordion = null;
    }
    
    // Hide legacy left secondary panel
    if (this._leftSecondaryPanel) {
      this._leftSecondaryPanel.style.display = 'none';
      this._leftSecondaryPanel.classList.remove('visible');
    }
    
    // Build accordion items from subcategories
    const items = this._buildAccordionItems(categoryId);
    if (items.length === 0) {
      this._rightMainPanel.innerHTML = '<div class="panel-placeholder">No options available</div>';
      return;
    }
    
    // Get initial open state
    const initialState = this._getInitialAccordionState(categoryId);
    
    // Create accordion
    this._accordion = new SubcategoryAccordion({
      categoryId,
      items,
      initialOpenState: initialState,
      onToggle: (subcategoryId, isOpen) => this._handleAccordionToggle(categoryId, subcategoryId, isOpen)
    });
    
    // Render into right main panel
    this._rightMainPanel.innerHTML = '';
    this._rightMainPanel.appendChild(this._accordion.render());
    this._rightMainPanel.style.display = 'block';
    this._rightMainPanel.classList.add('visible');
    
    // Auto-select first subcategory if none selected
    if (!this._state?.ui.activeSubcategory && items.length > 0) {
      const firstEnabled = items.find(i => !i.isDisabled);
      if (firstEnabled) {
        void this.dispatch({ 
          type: 'SUBCATEGORY_SELECTED', 
          payload: { category: categoryId, subcategory: firstEnabled.id } 
        });
      }
    }
  }
	
	/**
   * Build accordion item configurations from category subcategories
   * @private
   */
  private _buildAccordionItems(categoryId: string): AccordionItemConfig[] {
    if (!this._categoriesConfig) return [];
    
    const categoryConfig = this._categoriesConfig[categoryId as keyof CategoriesConfig];
    if (!categoryConfig) return [];
    
    const items: AccordionItemConfig[] = [];
    
    // Sort subcategories by order
    const sortedSubcategories = Object.entries(categoryConfig.subcategories)
      .map(([id, config]) => ({ id, config }))
      .sort((a, b) => (a.config.order ?? 99) - (b.config.order ?? 99));
    
    for (const { id: subcategoryId, config: subcategory } of sortedSubcategories) {
      const item: AccordionItemConfig = {
        id: subcategoryId,
        label: subcategory.label,
        getValue: () => this._getSubcategoryDisplayValue(categoryId, subcategoryId),
        isDisabled: !!subcategory.note,
        isSingle: sortedSubcategories.length === 1,
        helpText: subcategory.panel_help,
        getContent: async () => this._renderSubcategoryContent(categoryId, subcategoryId)
      };
      
      items.push(item);
    }
    
    return items;
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
        this._leftSecondaryPanel.classList.add('visible');
        this._updateLeftSecondaryPosition();
        
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
   * Get display value for subcategory header
   * @private
   */
  private _getSubcategoryDisplayValue(categoryId: string, subcategoryId: string): string {
    if (!this._state) return '';
    
    const composition = this._state.composition;
    const ui = this._state.ui;
    
    const key = `${categoryId}:${subcategoryId}`;
    
    switch (key) {
      case 'wood:panel': {
        const shape = composition.frame_design.shape || 'circular';
        const numSections = composition.frame_design.number_sections || 1;
        const pattern = composition.pattern_settings.slot_style || 'radial';
        return `${this._capitalize(shape)}, ${numSections} panel${numSections > 1 ? 's' : ''}, ${this._capitalize(pattern)}`;
      }
      
      case 'wood:wood_species': {
        const mat = composition.frame_design.section_materials?.[0];
        if (!mat) return '';
        const speciesName = this._getSpeciesDisplayName(mat.species);
        const grain = this._capitalize(mat.grain_direction);
        return `${speciesName}, ${grain}`;
      }
      
      case 'wood:layout': {
        const w = composition.frame_design.finish_x;
        const h = composition.frame_design.finish_y;
        const slots = composition.pattern_settings.number_slots;
        return w && h ? `${w}" × ${h}", ${slots} Elements` : '';
      }
      
      case 'wood:backing': {
        if (!composition.frame_design.backing?.enabled) return 'None';
        const backing = composition.frame_design.backing;
        const typeLabel = this._capitalize(backing.type);
        const finishLabel = this._capitalize(backing.material);
        return `${typeLabel}, ${finishLabel}`;
      }
      
      case 'wood:frames':
        return 'Coming Soon';
				
			case 'audio:custom': {
        if (this._audioSlicerPanel) {
          const filename = this._audioSlicerPanel.getLoadedFilename();
          if (filename) return filename;
        }
        return composition.audio_source?.source_file || 'Choose audio file';
      }
      
      case 'audio:slicing': {
        if (this._audioSlicerPanel) {
          const selection = this._audioSlicerPanel.getSelectionDisplay();
          if (selection) return selection;
        }
        const src = composition.audio_source;
        if (src?.start_time > 0 || src?.end_time > 0) {
          const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
          return `${fmt(src.start_time)} → ${fmt(src.end_time)}`;
        }
        return 'Optional';
      }

      case 'audio:collections': {
        const collId = ui.selectedCollectionId;
        const recId = ui.selectedRecordingId;
        if (!collId || !this._collectionsCatalog) return 'Browse catalog';
        const coll = this._collectionsCatalog.collections.find(c => c.id === collId);
        if (!coll) return 'Browse catalog';
        const rec = coll.recordings.find(r => r.id === recId);
        return rec ? `${coll.title} - ${rec.artist}` : coll.title;
      }
      
      case 'backgrounds:paint': {
        const wallFinishId = ui.currentWallFinish;
        if (!wallFinishId) return '';
        return this._getBackgroundDisplayName('paint', wallFinishId);
      }
      
      case 'backgrounds:accent':
      case 'backgrounds:rooms': {
        const bg = ui.currentBackground;
        if (!bg) return '';
        if (bg.type !== subcategoryId) return '';
        return this._getBackgroundDisplayName(bg.type, bg.id);
      }
      
      default:
        return '';
    }
  }
  
  /**
   * Capitalize first letter of string
   * @private
   */
  private _capitalize(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  /**
   * Get display name for species
   * @private
   */
  private _getSpeciesDisplayName(speciesId: string): string {
    if (!this._woodMaterialsConfig) return speciesId;
    const species = this._woodMaterialsConfig.species_catalog.find(s => s.id === speciesId);
    return species?.display || speciesId;
  }
  
  /**
   * Get display name for backing material
   * @private
   */
  private _getBackingDisplayName(materialId: string): string {
    // Simple fallback - could be enhanced with backing config lookup
    return this._capitalize(materialId.replace(/-/g, ' '));
  }
  
  /**
   * Get display name for background
   * @private
   */
  private _getBackgroundDisplayName(type: string, id: string): string {
    if (!this._backgroundsConfig) return id;
    const category = this._backgroundsConfig.categories[type as keyof typeof this._backgroundsConfig.categories];
    if (!category) return id;
    const bg = (category as Array<{ id: string; name?: string; label?: string }>).find(b => b.id === id);
    return bg?.name || bg?.label || id;
  }
  
  /**
   * Handle accordion toggle event
   * @private
   */
  private _handleAccordionToggle(categoryId: string, subcategoryId: string, isOpen: boolean): void {
    // Persist accordion state to both local cache and UI state
    if (!this._accordionState[categoryId]) {
      this._accordionState[categoryId] = {};
    }
    this._accordionState[categoryId][subcategoryId] = isOpen;
    
    // Persist to UI state for storage
    if (this._state) {
      this._state = {
        ...this._state,
        ui: {
          ...this._state.ui,
          accordionState: { ...this._accordionState }
        }
      };
      this._facade.persistState(this._state);
    }
    
    // Update active subcategory when opened
    if (isOpen) {
      void this.dispatch({
        type: 'SUBCATEGORY_SELECTED',
        payload: { category: categoryId, subcategory: subcategoryId }
      });
      
      // Enable/disable section interaction based on config
      if (this._sceneManager && 'setSectionInteractionEnabled' in this._sceneManager) {
        const enableInteraction = this._isSectionSelectionEnabled(categoryId, subcategoryId);
        (this._sceneManager as { setSectionInteractionEnabled: (enabled: boolean) => void }).setSectionInteractionEnabled(enableInteraction);
        (this._sceneManager as { setSectionOverlaysVisible: (visible: boolean) => void }).setSectionOverlaysVisible(enableInteraction);
        if (!enableInteraction) {
          (this._sceneManager as { clearSelection: () => void }).clearSelection();
        }
      }
      
      // Scroll to selected item in horizontal scroll container
      requestAnimationFrame(() => {
        const content = this._accordion?.getContentElement(subcategoryId);
        const scrollContainer = content?.querySelector('.horizontal-scroll') as HTMLElement;
        if (scrollContainer) {
          this._scrollToSelectedInContainer(scrollContainer);
        }
      });
    }
  }
  
  /**
   * Get initial accordion open state for a category
   * @private
   */
  private _getInitialAccordionState(categoryId: string): Record<string, boolean> {
    // Return persisted state if exists
    if (this._accordionState[categoryId]) {
      return { ...this._accordionState[categoryId] };
    }
    
    // Default: first subcategory open
    if (!this._categoriesConfig) return {};
    
    const categoryConfig = this._categoriesConfig[categoryId as keyof CategoriesConfig];
    if (!categoryConfig) return {};
    
    const subcategories = Object.entries(categoryConfig.subcategories)
      .sort((a, b) => (a[1].order ?? 99) - (b[1].order ?? 99));
    
    const state: Record<string, boolean> = {};
    subcategories.forEach(([id]) => {
      // All subcategories closed by default
      state[id] = false;
    });
    
    return state;
  }
  
  /**
   * Render subcategory content for accordion
   * @private
   */
  private async _renderSubcategoryContent(categoryId: string, subcategoryId: string): Promise<HTMLElement> {
    const container = document.createElement("div");
    container.className = "subcategory-content-inner";
    
    // Note: SUBCATEGORY_SELECTED dispatch handled by _handleAccordionToggle
    
    // Look up option config from categories config
    const catConfig = this._categoriesConfig?.[categoryId as keyof typeof this._categoriesConfig];
    const subConfig = catConfig?.subcategories?.[subcategoryId];
    const optionConfig = subConfig?.options ? Object.values(subConfig.options)[0] : undefined;
    
    await this._renderSubcategoryContentInner(container, categoryId, subcategoryId, optionConfig);
    
    // Render sticky toolbar AFTER content (prepend to preserve position)
    const toolbar = this._getSubcategoryToolbar(categoryId, subcategoryId);
    if (toolbar) {
      const toolbarWrapper = document.createElement('div');
      toolbarWrapper.className = 'subcategory-toolbar--sticky';
      toolbarWrapper.appendChild(toolbar);
      container.insertBefore(toolbarWrapper, container.firstChild);
    }
    
    return container;
  }
  
  /**
   * Internal content rendering for subcategory
   * @private
   */
  private async _renderSubcategoryContentInner(
    container: HTMLElement,
    categoryId: string,
    subcategoryId: string
  ): Promise<void> {
    if (!this._categoriesConfig || !this._state) return;
    
    const categoryConfig = this._categoriesConfig[categoryId as keyof CategoriesConfig];
    const subcategory = categoryConfig?.subcategories[subcategoryId];
    if (!subcategory) return;
    
    // Handle placeholder subcategories
    if (subcategory.note) {
      container.innerHTML = `<div class="panel-placeholder"><p>${subcategory.note}</p></div>`;
      return;
    }
    
    // Use existing _renderRightMainFiltered logic adapted for accordion
    // For now, render a simple placeholder - full implementation connects to existing renderers
    const optionKey = Object.keys(subcategory.options)[0];
    const optionConfig = subcategory.options[optionKey];
    
    if (!optionConfig) {
      container.innerHTML = '<div class="panel-placeholder">No options configured</div>';
      return;
    }
    
    // Render based on option type - reuse existing component creation
    switch (optionConfig.type) {
      case 'thumbnail_grid':
        await this._renderThumbnailGridContent(container, categoryId, subcategoryId, optionConfig);
        break;
      case 'slider_group':
        this._renderSliderGroupContent(container);
        break;
      case 'species_selector':
        await this._renderSpeciesSelectorContent(container);
        break;
      case 'backing_swatches':
        await this._renderBackingSwatchesContent(container);
        break;
      case 'archetype_grid':
        await this._renderArchetypeGridContent(container, categoryId, subcategoryId);
        break;
      case 'wood_species_image_grid':
        await this._renderSpeciesGridContent(container);
        break;
      case 'backing_selector':
        await this._renderBackingSelectorContent(container);
        break;
      case 'tour_launcher':
        await this._renderTourLauncherContent(container);
        break;
      case 'audio_upload':
        await this._renderAudioUploadContent(container);
        break;
			case 'audio_trimmer':
        await this._renderAudioTrimmerContent(container);
        break;
      case 'collections_browser':
        await this._renderCollectionsContent(container);
        break;
      default:
        container.innerHTML = `<div class="panel-placeholder">Content type: ${optionConfig.type}</div>`;
    }
  }
	
	/**
   * Get toolbar element for a subcategory (rendered inside content area)
   * @private
   */
  private _getSubcategoryToolbar(categoryId: string, subcategoryId: string): HTMLElement | null {
    if (!this._categoriesConfig) return null;
    
    const categoryConfig = this._categoriesConfig[categoryId as keyof CategoriesConfig];
    const subcategory = categoryConfig?.subcategories[subcategoryId];
    if (!subcategory) return null;
    
    // Section selector toolbar for wood species
		if (categoryId === 'wood' && subcategoryId === 'wood_species') {
			return this._createSectionSelectorToolbar();
		}
		
		// Filter toolbar for any subcategory with filters
		if (subcategory.filters && Object.keys(subcategory.filters).length > 0) {
			return this._createFilterToolbar(categoryId, subcategoryId, subcategory.filters);
		}
			
		return null;
  }
  
  /**
   * Create filter toolbar for accordion header
   * @private
   */
  private _createFilterToolbar(
    categoryId: string,
    subcategoryId: string,
    filters: Record<string, import('./types/PanelTypes').FilterConfig>
  ): HTMLElement | null {
    const filterGroups = this._buildFilterIconGroups(filters);
    if (filterGroups.length === 0) return null;
    
    const filterKey = `${categoryId}_${subcategoryId}`;
    const stateFilters = this._state?.ui.filterSelections[filterKey] || {};
    const activeFiltersMap = new Map<string, Set<string>>();
    Object.entries(stateFilters).forEach(([filterId, selections]) => {
      activeFiltersMap.set(filterId, new Set(selections));
    });
    
    const strip = new FilterIconStrip(
      filterGroups,
      activeFiltersMap,
      (groupId, selections) => this._handleFilterSelected(groupId, selections, categoryId, subcategoryId),
      true // compact mode
    );
    
    return strip.render();
  }
  
  /**
   * Create section selector toolbar for accordion header
   * @private
   */
  private _createSectionSelectorToolbar(): HTMLElement | null {
    if (!this._state || !this._sceneManager) return null;
    
    const numberSections = this._state.composition.frame_design.number_sections;
    if (numberSections <= 1) return null;
    
    const shape = this._state.composition.frame_design.shape;
    const selectedSections = (this._sceneManager as unknown as { getSelectedSections: () => Set<number> }).getSelectedSections();
    
    // Destroy previous selector if exists
    if (this._sectionSelectorPanel) {
      this._sectionSelectorPanel.destroy();
    }
    
    const selector = new SectionSelectorPanel(
      this,
      numberSections,
      shape,
      selectedSections,
      (newSelection) => this._handleSectionSelectionFromUI(newSelection),
      true // inline mode
    );
    
    // Store reference for external updates (e.g., canvas click-to-clear)
    this._sectionSelectorPanel = selector;
    
    return selector.render();
  }
  
  /**
   * Create backing toggle toolbar for accordion header
   * @private
   */
  private _createBackingToggleToolbar(): HTMLElement | null {
    if (!this._state) return null;
    
    const isEnabled = this._state.composition.frame_design.backing?.enabled ?? false;
    
    // Create toggle inline (BackingPanel static method requires async import)
    const toggle = document.createElement('label');
    toggle.className = 'toggle-switch';
    toggle.innerHTML = `
      <input type="checkbox" ${isEnabled ? 'checked' : ''}>
      <span class="toggle-slider"></span>
    `;
    
    const checkbox = toggle.querySelector('input')!;
    checkbox.addEventListener('change', () => {
      void this._handleBackingToggle(checkbox.checked);
    });
    
    return toggle;
  }
  
  /**
   * Handle backing toggle from accordion toolbar
   * @private
   */
  private async _handleBackingToggle(enabled: boolean): Promise<void> {
    if (!this._state) return;
    
    const newComposition = {
      ...this._state.composition,
      frame_design: {
        ...this._state.composition.frame_design,
        backing: {
          ...this._state.composition.frame_design.backing,
          enabled
        }
      }
    };
    
    await this.handleCompositionUpdate(newComposition);
    
    // Update accordion value display
    if (this._accordion) {
      this._accordion.updateValue('backing');
    }
  }
	
	/**
   * Render tour launcher content for accordion
   * @private
   */
  private async _renderTourLauncherContent(container: HTMLElement): Promise<void> {
    const { TourLauncherPanel } = await import('./components/TourLauncherPanel');
    const tourPanel = new TourLauncherPanel(this, this._sceneManager);
    container.innerHTML = '';
    container.appendChild(tourPanel.render());
  }
	
	/**
   * Render audio slicer content for accordion
   * @private
   */
  private async _ensureAudioSlicerPanel(): Promise<void> {
    if (!this._audioSlicerPanel && this._state) {
      const { AudioSlicerPanel } = await import('./components/AudioSlicerPanel');
      this._audioSlicerPanel = new AudioSlicerPanel(this, {
        silenceThreshold: this._state.composition.audio_processing.silence_threshold,
        silenceDuration: this._state.composition.audio_processing.silence_duration,
        removeSilence: this._state.composition.audio_processing.remove_silence
      });
    }
  }

  private async _renderAudioTrimmerContent(container: HTMLElement): Promise<void> {
    await this._ensureAudioSlicerPanel();
    if (!this._audioSlicerPanel) return;
    container.innerHTML = '';
    container.appendChild(this._audioSlicerPanel.renderTrimmerSection());
  }
	
	private async _renderAudioUploadContent(container: HTMLElement): Promise<void> {
    await this._ensureAudioSlicerPanel();
    if (!this._audioSlicerPanel) return;
    container.innerHTML = '';
    container.appendChild(this._audioSlicerPanel.renderUploadSection());
  }
	
	/**
   * Update audio accordion header value (called from AudioSlicerPanel)
   */
  public updateAudioAccordionValue(subcategoryId: string): void {
    if (this._accordion) {
      this._accordion.updateValue(subcategoryId);
    }
  }

	/**
   * Open next audio accordion (called from AudioSlicerPanel CTA buttons)
   */
  public openNextAudioAccordion(currentSubcategory: string): void {
    const nextMap: Record<string, string> = {
      'custom': 'slicing'
    };
    const next = nextMap[currentSubcategory];
    if (next && this._accordion) {
      this._accordion.setOpen(currentSubcategory, false);
      this._accordion.setOpen(next, true);
    }
  }

  /**
   * Render upload interface content for accordion
   * @private
   */
  private async _renderUploadInterfaceContent(container: HTMLElement): Promise<void> {
    const { UploadPanel } = await import('./components/UploadPanel');
    const uploadPanel = new UploadPanel(this, this._audioCache);
    container.innerHTML = '';
    container.appendChild(uploadPanel.render());
  }

  /**
   * Render collections content for accordion
   * @private
   */
  private async _renderCollectionsContent(container: HTMLElement): Promise<void> {
    // Load catalog if not cached
    if (!this._collectionsCatalog) {
      try {
        const { CollectionsCatalogSchema } = await import('./types/schemas');
        const response = await fetch('/config/collections_catalog.json');
        const data = await response.json();
        this._collectionsCatalog = CollectionsCatalogSchema.parse(data);
      } catch (error) {
        console.error('[Controller] Failed to load collections catalog:', error);
        container.innerHTML = '<div class="panel-placeholder"><p>Failed to load collections</p></div>';
        return;
      }
    }

    // Get active category filter
    const filterKey = `${this._state.ui.activeCategory}_${this._state.ui.activeSubcategory}`;
    const stateFilters = this._state.ui.filterSelections[filterKey] || {};
    const activeFilter = stateFilters['collection_type']?.[0] || null;
    
    // Route to artist view if selected
    if (activeFilter === 'artist') {
      await this._renderArtistCollections(container);
      return;
    }
    
    // Filter collections by category (show all if no filter active)
    const collections = activeFilter
      ? this._collectionsCatalog.collections.filter(c => c.category === activeFilter)
      : this._collectionsCatalog.collections;
    const selectedId = this._state?.ui.selectedCollectionId || null;
    const selectedRecId = this._state?.ui.selectedRecordingId || null;

    // Create scroll container for cards
    const scrollContainer = new HorizontalScrollContainer();
    const scrollWrapper = scrollContainer.render();
    const scrollElement = scrollContainer.getScrollElement()!;

    collections.forEach(item => {
      const card = new AccordionCollectionCard({
        config: item as CollectionCardConfig,
        selected: item.id === selectedId,
        onSelect: (collectionId, recordingId) => {
          void this._handleCollectionSelected(collectionId, recordingId);
        }
      });
      scrollElement.appendChild(card.render());
    });

    container.innerHTML = '';
    container.appendChild(scrollWrapper);

    // Render variant selector area (persistent)
    const variantArea = document.createElement('div');
    variantArea.className = 'collection-variant-area';

		// Clean up previous variant selector
    if (this._collectionVariantSelector) {
      this._collectionVariantSelector.destroy();
      this._collectionVariantSelector = null;
    }
    
    const selectedCollection = collections.find(c => c.id === selectedId);
    if (selectedCollection && selectedCollection.recordings.length > 1) {
      const capturedCollectionId = selectedId!;
      this._collectionVariantSelector = new CollectionVariantSelector({
        recordings: selectedCollection.recordings,
        selectedRecordingId: selectedRecId,
        onSelect: (recordingId) => {
          void this._handleCollectionRecordingSelected(capturedCollectionId, recordingId);
        }
      });
      variantArea.appendChild(this._collectionVariantSelector.render());
    } else {
      variantArea.innerHTML = '<div class="variant-selector-empty">Select a track above</div>';
    }
    
    container.appendChild(variantArea);
    scrollContainer.scrollToSelected();
  }

	/**
   * Render artist-centric collection view
   * Groups recordings by artist, cards are artists, chips are songs
   * @private
   */
  private async _renderArtistCollections(container: HTMLElement): Promise<void> {
    if (!this._collectionsCatalog || !this._state) return;

    const catalog = this._collectionsCatalog;
    const artistMap = new Map<string, {
      id: string;
      name: string;
      thumbnail: string;
      songs: Array<{ collectionId: string; title: string; recordingUrl: string }>;
    }>();

    // Group recordings by artist
    catalog.collections.forEach(collection => {
      collection.recordings.forEach(recording => {
        const artistId = recording.artistId;
        if (!artistId) return;

        if (!artistMap.has(artistId)) {
          const artistMeta = catalog.artists?.[artistId];
          artistMap.set(artistId, {
            id: artistId,
            name: artistMeta?.name || recording.artist,
            thumbnail: artistMeta?.thumbnail || '',
            songs: []
          });
        }
        artistMap.get(artistId)!.songs.push({
          collectionId: collection.id,
          title: collection.title,
          recordingUrl: recording.url
        });
      });
    });

    const selectedArtistId = this._state.ui.selectedCollectionId || null;

    // Create scroll container for artist cards
    const scrollContainer = new HorizontalScrollContainer();
    const scrollWrapper = scrollContainer.render();
    const scrollElement = scrollContainer.getScrollElement()!;

    artistMap.forEach(artist => {
      const card = document.createElement('button');
      card.className = 'accordion-card collection-card artist-card';
      card.dataset.collectionId = artist.id;
      if (artist.id === selectedArtistId) {
        card.classList.add('selected');
      }

      const visual = document.createElement('div');
      visual.className = 'collection-card-visual artist-visual';
      if (artist.thumbnail) {
        const img = document.createElement('img');
        img.src = artist.thumbnail;
        img.alt = artist.name;
        img.loading = 'lazy';
        visual.appendChild(img);
      }
      card.appendChild(visual);

      const info = document.createElement('div');
      info.className = 'collection-card-info';
      const title = document.createElement('div');
      title.className = 'collection-card-title';
      title.textContent = artist.name;
      info.appendChild(title);
      const meta = document.createElement('div');
      meta.className = 'collection-card-meta';
      meta.textContent = `${artist.songs.length} song${artist.songs.length > 1 ? 's' : ''}`;
      info.appendChild(meta);
      card.appendChild(info);

      card.addEventListener('click', () => {
        this._handleArtistSelected(artist.id);
      });

      scrollElement.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(scrollWrapper);

    // Variant area for song chips
    const variantArea = document.createElement('div');
    variantArea.className = 'collection-variant-area';

    if (this._collectionVariantSelector) {
      this._collectionVariantSelector.destroy();
      this._collectionVariantSelector = null;
    }

    const selectedArtist = selectedArtistId ? artistMap.get(selectedArtistId) : null;
    if (selectedArtist && selectedArtist.songs.length > 0) {
      const songChips = document.createElement('div');
      songChips.className = 'variant-chip-container';
      
      const label = document.createElement('span');
      label.className = 'variant-selector-label';
      label.textContent = 'song:';
      variantArea.appendChild(label);

      selectedArtist.songs.forEach(song => {
        const chip = document.createElement('button');
        chip.className = 'variant-chip';
        chip.textContent = song.title;
        chip.addEventListener('click', () => {
          void this._loadCollectionAudio(song.recordingUrl, song.title);
        });
        songChips.appendChild(chip);
      });
      variantArea.appendChild(songChips);
    } else {
      variantArea.innerHTML = '<div class="variant-selector-empty">Select an artist above</div>';
    }

    container.appendChild(variantArea);
    scrollContainer.scrollToSelected();
  }
	
	/**
   * Handle collection track selection
   * @private
   */
  private async _handleCollectionSelected(collectionId: string, recordingId: string): Promise<void> {
    if (!this._state || !this._collectionsCatalog) return;

    const collection = this._collectionsCatalog.collections.find(c => c.id === collectionId);
    if (!collection) return;

    const recording = recordingId ? collection.recordings.find(r => r.id === recordingId) : null;
    
    // Multi-recording with no selection: update UI state but don't load audio
    if (!recording && collection.recordings.length > 1) {
      this._state = {
        ...this._state,
        ui: {
          ...this._state.ui,
          selectedCollectionId: collectionId,
          selectedRecordingId: null
        }
      };
      
      // Update variant selector
      const variantArea = document.querySelector('.collection-variant-area');
      if (variantArea) {
        if (this._collectionVariantSelector) {
          this._collectionVariantSelector.destroy();
        }
        this._collectionVariantSelector = new CollectionVariantSelector({
          recordings: collection.recordings,
          selectedRecordingId: null,
          onSelect: (recId) => {
            void this._handleCollectionRecordingSelected(collectionId, recId);
          }
        });
        variantArea.innerHTML = '';
        variantArea.appendChild(this._collectionVariantSelector.render());
      }
      
      // Update card selection visually
      const scrollContainer = document.querySelector('.subcategory-content-inner .horizontal-scroll');
      scrollContainer?.querySelectorAll('.collection-card').forEach(card => {
        card.classList.toggle('selected', (card as HTMLElement).dataset.collectionId === collectionId);
      });
      
      if (this._accordion) {
        this._accordion.updateValue('collections');
      }
      return;
    }
    
    if (!recording) return;

    // Update UI state
    this._state = {
      ...this._state,
      ui: {
        ...this._state.ui,
        selectedCollectionId: collectionId,
        selectedRecordingId: recordingId
      }
    };

    // Update variant selector (always recreate to capture correct collectionId in callback)
    const variantArea = document.querySelector('.collection-variant-area');
    if (variantArea && collection.recordings.length > 1) {
      if (this._collectionVariantSelector) {
        this._collectionVariantSelector.destroy();
      }
      this._collectionVariantSelector = new CollectionVariantSelector({
        recordings: collection.recordings,
        selectedRecordingId: recordingId,
        onSelect: (recId) => {
          void this._handleCollectionRecordingSelected(collectionId, recId);
        }
      });
      variantArea.innerHTML = '';
      variantArea.appendChild(this._collectionVariantSelector.render());
    } else if (variantArea && collection.recordings.length === 1) {
      if (this._collectionVariantSelector) {
        this._collectionVariantSelector.destroy();
      }
      variantArea.innerHTML = '<div class="variant-selector-empty">Single recording</div>';
      this._collectionVariantSelector = null;
    }

    // Update card selection visually
    const scrollContainer = document.querySelector('.subcategory-content-inner .horizontal-scroll');
    scrollContainer?.querySelectorAll('.collection-card').forEach(card => {
      card.classList.toggle('selected', (card as HTMLElement).dataset.collectionId === collectionId);
    });

    // Load audio file
    await this._loadCollectionAudio(recording.url, collection.title);

    // Update accordion header
    if (this._accordion) {
      this._accordion.updateValue('collections');
    }
  }

	/**
   * Handle artist card selection in artist view
   * @private
   */
  private _handleArtistSelected(artistId: string): void {
    if (!this._state) return;

    this._state = {
      ...this._state,
      ui: {
        ...this._state.ui,
        selectedCollectionId: artistId,
        selectedRecordingId: null
      }
    };

    // Update card selection visually
    const scrollContainer = document.querySelector('.subcategory-content-inner .horizontal-scroll');
    scrollContainer?.querySelectorAll('.collection-card').forEach(card => {
      card.classList.toggle('selected', (card as HTMLElement).dataset.collectionId === artistId);
    });

    // Refresh content to show song chips
    if (this._accordion) {
      this._accordion.refreshContent('collections');
    }
  }

  /**
   * Handle recording variant selection
   * @private
   */
  private async _handleCollectionRecordingSelected(collectionId: string, recordingId: string): Promise<void> {
    if (!this._state || !this._collectionsCatalog) return;

    const collection = this._collectionsCatalog.collections.find(c => c.id === collectionId);
    if (!collection) return;

    const recording = collection.recordings.find(r => r.id === recordingId);
    if (!recording) return;

    // Update state
    this._state = {
      ...this._state,
      ui: {
        ...this._state.ui,
        selectedRecordingId: recordingId
      }
    };

    // Load the new recording
    await this._loadCollectionAudio(recording.url, collection.title);
    
    // Update accordion header
    if (this._accordion) {
      this._accordion.updateValue('collections');
    }
  }

  /**
   * Load audio from collection URL
   * @private
   */
  private async _loadCollectionAudio(url: string, title: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const blob = await response.blob();
      const filename = url.split('/').pop() || `${title}.mp3`;
      const ext = filename.split('.').pop()?.toLowerCase();
      const mimeMap: Record<string, string> = {
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'flac': 'audio/flac',
        'ogg': 'audio/ogg'
      };
      const mimeType = blob.type || mimeMap[ext || ''] || 'audio/mpeg';
      const file = new File([blob], filename, { type: mimeType });
      
      // Ensure AudioSlicerPanel exists
      await this._ensureAudioSlicerPanel();
      
      // Use existing AudioSlicerPanel to load
      if (this._audioSlicerPanel) {
        this._audioSlicerPanel.loadAudioFile(file);
      }
    } catch (error) {
      console.error('[Controller] Failed to load collection audio:', error);
      // Show error without replacing variant selector
      const variantArea = document.querySelector('.collection-variant-area');
      if (variantArea) {
        const existingError = variantArea.querySelector('.collection-load-error');
        if (existingError) existingError.remove();
        const msg = document.createElement('div');
        msg.className = 'collection-load-error';
        msg.style.cssText = 'color: #c0392b; font-size: 11px; margin-top: 8px;';
        msg.textContent = `Audio not found: ${url}`;
        variantArea.appendChild(msg);
      }
    }
  }

	/**
   * Render backing selector content for accordion
   * @private
   */
  private async _renderBackingSelectorContent(container: HTMLElement): Promise<void> {
    if (!this._state) {
      container.innerHTML = '<div class="panel-placeholder">Loading backing options...</div>';
      return;
    }
    
    const backing = this._state.composition.frame_design.backing || {
      enabled: false,
      type: 'acrylic',
      material: 'clear',
      inset: 0.5
    };
    
    const { BackingPanel } = await import('./components/BackingPanel');
    
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
        if (this._accordion) {
          this._accordion.updateValue('backing');
        }
      },
      true // horizontal
    );
    
    container.innerHTML = '';
    container.appendChild(backingPanel.render());
  }
	
	/**
   * Render species grid content for accordion
   * @private
   */
  private async _renderSpeciesGridContent(container: HTMLElement): Promise<void> {
    if (!this._woodMaterialsConfig || !this._state) {
      container.innerHTML = '<div class="panel-placeholder">Loading species...</div>';
      return;
    }
    
    const materials = this._state.composition.frame_design.section_materials || [];
    const currentSpecies = materials[0]?.species || this._woodMaterialsConfig.default_species;
    const currentGrain = materials[0]?.grain_direction || this._woodMaterialsConfig.default_grain_direction;
    
    const scrollContainer = new HorizontalScrollContainer();
    const scrollWrapper = scrollContainer.render();
    const scrollElement = scrollContainer.getScrollElement()!;
    
    const shape = this._state.composition.frame_design.shape;
    const numSections = this._state.composition.frame_design.number_sections;
    
    const allGrainDefs = [
      { id: 'n1_vertical', direction: 'vertical' },
      { id: 'n1_horizontal', direction: 'horizontal' },
      { id: 'n4_radiant', direction: 'radiant' },
      { id: 'n4_diamond', direction: 'diamond' }
    ];
    const archetypeId = this.getActiveArchetypeId();
    const archetype = archetypeId ? this._archetypes.get(archetypeId) : null;
    const availableGrains = (archetype as { available_grains?: string[] })?.available_grains ?? ['vertical', 'horizontal'];
    const grainDefs = allGrainDefs.filter(g => availableGrains.includes(g.direction));
    
    this._woodMaterialsConfig.species_catalog.forEach(species => {
      const grains = grainDefs.map(g => ({
        id: g.id,
        direction: g.direction,
        thumbnailUrl: `/wood_thumbnails_small/${species.id}_${g.id}.png`,
        largeThumbnailUrl: `/wood_thumbnails_large/${species.id}_${g.id}.png`
      }));
      
      const card = new AccordionSpeciesCard({
				config: { id: species.id, label: species.display, grains },
				selectedSpecies: currentSpecies,
				selectedGrain: currentGrain,
        onSelect: (speciesId, grainDir) => {
          void (async () => {
            await this._updateWoodMaterial('species', speciesId);
            await this._updateWoodMaterial('grain_direction', grainDir);
            if (this._accordion) this._accordion.updateValue('wood_species');
          })();
        }
      });
      scrollElement.appendChild(card.render());
    });
    
    container.innerHTML = '';
    container.appendChild(scrollWrapper);
    scrollContainer.scrollToSelected();
  }
	
	/**
   * Render archetype grid content for accordion
   * @private
   */
  private async _renderArchetypeGridContent(container: HTMLElement, categoryId?: string, subcategoryId?: string): Promise<void> {
    if (!this._state || !this._archetypes) {
      container.innerHTML = '<div class="panel-placeholder">Loading styles...</div>';
      return;
    }
    
    const effectiveCategory = categoryId ?? this._state.ui.activeCategory;
    const effectiveSubcategory = subcategoryId ?? this._state.ui.activeSubcategory;
    const filterKey = `${effectiveCategory}_${effectiveSubcategory}`;
    const stateFilters = this._state.ui.filterSelections[filterKey] || {};
    
    const matchingArchetypes = Array.from(this._archetypes.values())
      .filter(archetype => {
        const activeShapes = stateFilters.shape ? new Set(stateFilters.shape) : new Set();
        if (activeShapes.size > 0 && !activeShapes.has(archetype.shape)) return false;
        
        const activePatterns = stateFilters.slot_pattern ? new Set(stateFilters.slot_pattern) : new Set();
        if (activePatterns.size > 0 && !activePatterns.has(archetype.slot_style)) return false;
        
        return true;
      })
      .map(archetype => ({
        id: archetype.id,
        label: archetype.label,
        thumbnailUrl: archetype.thumbnail,
        disabled: false,
        tooltip: archetype.tooltip
      }));
    
    const activeSelection = this.getActiveArchetypeId();
    
    const scrollContainer = new HorizontalScrollContainer();
    const scrollWrapper = scrollContainer.render();
    const scrollElement = scrollContainer.getScrollElement()!;
    
    matchingArchetypes.forEach(arch => {
      const card = new AccordionStyleCard({
        config: {
          id: arch.id,
          label: arch.label,
          thumbnailUrl: arch.thumbnailUrl,
          disabled: arch.disabled,
          tooltip: arch.tooltip
        },
        selected: arch.id === activeSelection,
        onSelect: (id) => { void this._handleArchetypeSelected(id); }
      });
      scrollElement.appendChild(card.render());
    });
    
    container.innerHTML = '';
    container.appendChild(scrollWrapper);
    scrollContainer.scrollToSelected();
  }
	
	/**
   * Scroll horizontal container to center the selected item
   * @private
   */
  private _scrollToSelectedInContainer(scrollContainer: HTMLElement): void {
    requestAnimationFrame(() => {
      const selected = scrollContainer.querySelector('.selected') as HTMLElement;
      if (!selected) return;
      
      const containerRect = scrollContainer.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();
      const scrollLeft = scrollContainer.scrollLeft;
      
      const targetScroll = scrollLeft +
        (selectedRect.left - containerRect.left) -
        (containerRect.width / 2) +
        (selectedRect.width / 2);
      
      scrollContainer.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: 'instant'
      });
    });
  }
  
  /**
   * Render thumbnail grid content for accordion
   * @private
   */
  private async _renderThumbnailGridContent(
    container: HTMLElement,
    categoryId: string,
    subcategoryId: string,
    _optionConfig: unknown
  ): Promise<void> {
    // Handle backgrounds category
    if (categoryId === 'backgrounds') {
      await this._renderBackgroundsContent(container, subcategoryId);
      return;
    }
    
    // Handle other thumbnail grids (style archetypes, etc.)
    container.innerHTML = '<div class="panel-placeholder">Content not yet implemented</div>';
  }
  
  /**
   * Render backgrounds content (paint, accent, rooms)
   * @private
   */
  private async _renderBackgroundsContent(container: HTMLElement, subcategoryId: string): Promise<void> {
    if (!this._backgroundsConfig) {
      container.innerHTML = '<div class="panel-placeholder">Loading backgrounds...</div>';
      return;
    }
    
    const type = subcategoryId as 'paint' | 'accent' | 'rooms';
    const backgrounds = this._backgroundsConfig.categories[type];
    
    if (!backgrounds || backgrounds.length === 0) {
      container.innerHTML = '<div class="panel-placeholder">No backgrounds available</div>';
      return;
    }
    
    const currentBg = this._state?.ui.currentBackground;
    let selectedId: string | null = null;
    if (type === 'paint') {
      selectedId = this._state?.ui.currentWallFinish || this._backgroundsConfig.default_wall_finish;
    } else if (currentBg?.type === type) {
      selectedId = currentBg.id;
    }
    
    // Create horizontal scroll container
    const scrollContainer = new HorizontalScrollContainer();
    const scrollWrapper = scrollContainer.render();
    const scrollElement = scrollContainer.getScrollElement()!;
    
    backgrounds.forEach(bg => {
      const card = this._createBackgroundCard(bg, type, selectedId === bg.id);
      scrollElement.appendChild(card);
    });
    
    container.innerHTML = '';
    container.appendChild(scrollWrapper);
    scrollContainer.scrollToSelected();
  }
  
  /**
   * Create a background card element
   * @private
   */
  private _createBackgroundCard(
    bg: { id: string; name: string; rgb?: number[]; path?: string },
    type: 'paint' | 'accent' | 'rooms',
    isSelected: boolean
  ): HTMLElement {
    const card = document.createElement('button');
    card.className = `accordion-card ${type === 'paint' ? 'paint-card' : type === 'accent' ? 'accent-card' : 'room-card'}`;
    if (isSelected) card.classList.add('selected');
    card.dataset.itemId = bg.id;
    
    if (type === 'paint') {
      // Paint: color swatch
      const swatch = document.createElement('div');
      swatch.className = 'paint-card-swatch';
      if (bg.rgb) {
        const [r, g, b] = bg.rgb.map(v => Math.round(v * 255));
        swatch.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
      }
      card.appendChild(swatch);
      
      const label = document.createElement('span');
      label.className = 'paint-card-label';
      label.textContent = bg.name;
      card.appendChild(label);
      
    } else if (type === 'accent') {
      // Accent: texture thumbnail
      const img = document.createElement('img');
      img.className = 'accent-card-image';
      img.src = bg.path || '';
      img.alt = bg.name;
      img.loading = 'lazy';
      card.appendChild(img);
      
      const label = document.createElement('span');
      label.className = 'accent-card-label';
      label.textContent = bg.name;
      card.appendChild(label);
      
    } else {
      // Rooms: scene thumbnail
      const img = document.createElement('img');
      img.className = 'room-card-image';
      img.src = bg.path || '';
      img.alt = bg.name;
      img.loading = 'lazy';
      card.appendChild(img);
      
      const label = document.createElement('span');
      label.className = 'room-card-label';
      label.textContent = bg.name;
      card.appendChild(label);
    }
    
    // Tooltip on hover
    card.addEventListener('mouseenter', () => {
      if (!this._helpTooltip) return;
      const content = document.createElement('div');
      content.className = 'tooltip-content-wrapper';
      if (bg.path && type !== 'paint') {
        const preview = document.createElement('img');
        preview.src = bg.path;
        preview.alt = bg.name;
        content.appendChild(preview);
      } else if (bg.rgb) {
        const swatch = document.createElement('div');
        swatch.className = 'tooltip-color-swatch';
        const [r, g, b] = bg.rgb.map(v => Math.round(v * 255));
        swatch.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
        content.appendChild(swatch);
      }
      const desc = document.createElement('p');
      desc.className = 'tooltip-description';
      desc.textContent = bg.name;
      content.appendChild(desc);
      const tooltipClass = type === 'paint' ? 'tooltip-paint' : type === 'accent' ? 'tooltip-accent' : 'tooltip-rooms';
      this._helpTooltip.show(content, card, 'left', tooltipClass, 0, 0, true, 'canvas');
    });
    card.addEventListener('mouseleave', () => this._helpTooltip?.hide());

    // Click handler
    card.addEventListener('click', () => {
      this._helpTooltip?.hide();
      this.handleBackgroundSelected(bg.id, type);
      
      // Update selection visually
      card.closest('.horizontal-scroll')?.querySelectorAll('.accordion-card').forEach(c => {
        c.classList.remove('selected');
      });
      card.classList.add('selected');
      
      // Update accordion value display
      if (this._accordion) {
        this._accordion.updateValue(type);
      }
    });
    
    return card;
  }
  
  /**
   * Set up scroll fade indicators
   * @private
   */
  private _setupScrollFades(wrapper: HTMLElement, scrollEl: HTMLElement): void {
    const updateFades = () => {
      const canScrollLeft = scrollEl.scrollLeft > 1;
      const canScrollRight = scrollEl.scrollLeft < scrollEl.scrollWidth - scrollEl.clientWidth - 1;
      wrapper.classList.toggle('can-scroll-left', canScrollLeft);
      wrapper.classList.toggle('can-scroll-right', canScrollRight);
    };
    
    scrollEl.addEventListener('scroll', updateFades, { passive: true });
    
    // Initial check after layout
    requestAnimationFrame(updateFades);
  }
  
  /**
   * Render slider group content for accordion
   * @private
   */
  private _renderSliderGroupContent(container: HTMLElement): void {
    if (!this._state || !this._resolver) return;
    
    const archetypeId = this.getActiveArchetypeId();
    if (!archetypeId) return;
    
    const sliderConfigs = this._resolver.resolveSliderConfigs(archetypeId, this._state.composition);
    
    const sliderGroup = new SliderGroup(
      sliderConfigs,
      (id, value) => void this._updateStateValue(id, value),
      this._state.composition.frame_design.number_sections,
      this._state.composition.pattern_settings.slot_style
    );
    
    const wrapper = document.createElement('div');
    wrapper.className = 'slider-card';
    wrapper.appendChild(sliderGroup.render());
    container.appendChild(wrapper);
  }
  
  /**
   * Render species selector content for accordion
   * @private
   */
  private async _renderSpeciesSelectorContent(container: HTMLElement): Promise<void> {
    // This will be connected to WoodMaterialSelector with horizontal mode
    container.innerHTML = '<div class="horizontal-scroll"><div class="panel-placeholder">Species selector loading...</div></div>';
  }
  
  /**
   * Render backing swatches content for accordion
   * @private
   */
  private async _renderBackingSwatchesContent(container: HTMLElement): Promise<void> {
    // This will be connected to BackingPanel content in horizontal mode
    container.innerHTML = '<div class="horizontal-scroll"><div class="panel-placeholder">Backing options loading...</div></div>';
  }
  
  /**
   * Handle STYLE category selection (four-panel architecture)
   * @private
   */
	private _handleStyleCategorySelected(): void {
    // DEPRECATED: Accordion now handles category rendering via _renderAccordionForCategory
    // Keeping method signature for backward compatibility during transition
    return;
    
    /* Original implementation preserved for reference:
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
          this._updateLeftSecondaryPosition();
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
    */
  }
  
  /**
   * Handle subcategory selection (Left Secondary → Right Secondary + Right Main)
   * @private
   */
  private _handleSubcategorySelected(subcategoryId: string): void {
    // Skip legacy rendering when accordion is active
    if (this._accordion) return;
    
    if (!this._categoriesConfig || !this._state?.ui.activeCategory) {
      return;
    }
    
    const categoryConfig = this._categoriesConfig[this._state.ui.activeCategory as keyof CategoriesConfig];
    if (!categoryConfig) {
      return;
    }

    // Dispatch state update
    void this.dispatch({ type: 'SUBCATEGORY_SELECTED', payload: { category: this._state.ui.activeCategory, subcategory: subcategoryId } });

    // Enable/disable section interaction and overlays based on UI state
    if (this._sceneManager && 'setSectionInteractionEnabled' in this._sceneManager) {
      const enableInteraction = this._state.ui.activeCategory === 'wood' && subcategoryId === 'wood_species';
      (this._sceneManager as { setSectionInteractionEnabled: (enabled: boolean) => void }).setSectionInteractionEnabled(enableInteraction);
      (this._sceneManager as { setSectionOverlaysVisible: (visible: boolean) => void }).setSectionOverlaysVisible(enableInteraction);
      
      // Trigger tutorial pulse when entering Wood Species
      if (enableInteraction && 'playTutorialPulse' in this._sceneManager) {
        (this._sceneManager as unknown as { playTutorialPulse: () => void }).playTutorialPulse();
      }
    }

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
    const selectedSections = (this._sceneManager as unknown as { getSelectedSections: () => Set<number> }).getSelectedSections();
    
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
			this._rightSecondaryPanel!.classList.add('visible');
			this._rightMainPanel!.classList.add('has-toolbar');
			
    }).catch((error: unknown) => {
      console.error('[Controller] Failed to load SectionSelectorPanel:', error);
    });
  }

	/**
   * Enable/disable section interaction based on current navigation
   * Only enabled for WOOD > Wood & Grain
   * @private
   */
  private _updateSectionInteractionState(): void {
    if (!this._sceneManager) return;
    
    const sm = this._sceneManager as unknown as {
      setSectionInteractionEnabled: (enabled: boolean) => void;
      setSectionOverlaysVisible: (visible: boolean) => void;
      clearSelection: () => void;
    };
    
    const enableInteraction = this._isSectionSelectionEnabled();
    
    sm.setSectionInteractionEnabled(isWoodSpecies);
    
    if (!isWoodSpecies) {
      sm.setSectionOverlaysVisible(false);
      sm.clearSelection();
    }
  }

	/**
   * Check if subcategory enables section selection
   * @private
   */
  private _isSectionSelectionEnabled(categoryId?: string, subcategoryId?: string): boolean {
    if (!this._categoriesConfig) return false;
    
    const catId = categoryId ?? this._state?.ui.activeCategory;
    const subId = subcategoryId ?? this._state?.ui.activeSubcategory;
    
    if (!catId || !subId) return false;
    
    const category = this._categoriesConfig[catId as keyof CategoriesConfig];
    if (!category) return false;
    
    const subcategory = category.subcategories[subId];
    return subcategory?.enables_section_selection === true;
  }
  
  /**
   * Handle section selection from UI icons
   * Updates SceneManager which will sync overlays
   * @private
   */
  private _handleSectionSelectionFromUI(newSelection: Set<number>): void {
    if (!this._sceneManager) return;
    
    const sceneManager = this._sceneManager as unknown as {
      clearSelection: () => void;
      toggleSection: (index: number) => void;
      getSelectedSections: () => Set<number>;
      updateSectionUI: (selection: Set<number>) => void;
    };
    
    // Clear current selection
    sceneManager.clearSelection();
    
    // Apply new selection
    newSelection.forEach(index => {
      sceneManager.toggleSection(index);
    });
    
    // Sync controller state
    this.selectSection(sceneManager.getSelectedSections());
    
    // Update white dot overlays
    sceneManager.updateSectionUI(sceneManager.getSelectedSections());
  }
  
  /**
   * Handle filter selection (Icon strip → updates Right Main display only)
   * CRITICAL: Does NOT update composition state
   * @private
   */
  private _handleFilterSelected(filterId: string, selections: Set<string>, categoryId?: string, subcategoryId?: string): void {
    const effectiveCategory = categoryId ?? this._state?.ui.activeCategory;
    const effectiveSubcategory = subcategoryId ?? this._state?.ui.activeSubcategory;
    if (!effectiveSubcategory || !effectiveCategory) return;
    
    // Dispatch filter change
    void this.dispatch({ 
      type: 'FILTER_CHANGED', 
      payload: { 
        category: effectiveCategory,
        subcategory: effectiveSubcategory,
        filterId,
        selections: Array.from(selections)
      }
    });
    
    // Re-render Right Main with new filter combination
    if (!this._accordion) {
      this._renderRightMainFiltered();
    } else {
      // Refresh accordion content for the filter's owning subcategory
      this._accordion.refreshContent(effectiveSubcategory);
    }
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
    
    // Build collection_type filter group (Category buttons)
    if (filters.collection_type) {
      groups.push({
        id: 'collection_type',
        type: 'category',
        label: filters.collection_type.label,
        icons: filters.collection_type.options.map(opt => ({
          id: opt.id,
          svgPath: `/assets/icons/${opt.id}.svg`,
          tooltip: opt.tooltip || opt.label,
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

		// Increment render ID to invalidate pending async renders
		const currentRenderId = ++this._renderId;

		// CRITICAL: Destroy previous component to clean up tooltips/timers
		if (this._activeRightPanelComponent) {
			this._activeRightPanelComponent.destroy();
			this._activeRightPanelComponent = null;
		}

		// Preserve scroll position from the actual scrollable content area
    const scrollableContent = this._rightMainPanel.querySelector('.panel-content-scrollable') as HTMLElement;
    const scrollTop = scrollableContent?.scrollTop || 0;

    // Hide help tooltip when changing panels
    this._helpTooltip?.hide();

    this._rightMainPanel.innerHTML = '';
		this._rightMainPanel.classList.remove('has-toolbar');
		
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
		
		// Panel header removed - help icon now in subcategory bar (LeftSecondaryPanel)
		
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
				this._rightSecondaryPanel!.appendChild(this._filterIconStrip.render());
				this._rightSecondaryPanel!.classList.add('visible');
				this._rightMainPanel.classList.add('has-toolbar');
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
            this._state.composition.pattern_settings.slot_style
          );
          panelContent.appendChild(sliderGroup.render());
          
          // Add aspect ratio lock control if shape allows it
          const shape = this._state.composition.frame_design.shape;
          const uiConfig = window.uiEngine?.config as { dimension_constraints?: Record<string, { allow_aspect_lock?: boolean }> } | undefined;
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
						const body = document.createElement('div');
						body.className = 'panel-body';
						
						const materials = this._state.composition.frame_design.section_materials || [];
						const currentSpecies = materials[0]?.species || this._woodMaterialsConfig.default_species;
						const currentGrain = materials[0]?.grain_direction || this._woodMaterialsConfig.default_grain_direction;
						const scrollWrapper = document.createElement('div');
					scrollWrapper.className = 'horizontal-scroll';
					
					const grainDefs = [
						{ id: 'n1_vertical', direction: 'vertical' },
						{ id: 'n1_horizontal', direction: 'horizontal' },
						{ id: 'n4_radiant', direction: 'radiant' },
						{ id: 'n4_diamond', direction: 'diamond' }
					];
					
					this._woodMaterialsConfig.species_catalog.forEach(species => {
						const grains = grainDefs.map(g => ({
							id: g.id,
							direction: g.direction,
							thumbnailUrl: `/wood_thumbnails_small/${species.id}_${g.id}.png`,
							largeThumbnailUrl: `/wood_thumbnails_large/${species.id}_${g.id}.png`
						}));
						
						const card = new AccordionSpeciesCard({
              config: { id: species.id, label: species.display, grains },
              selectedSpecies: currentSpecies,
              selectedGrain: currentGrain,
							onSelect: (speciesId, grainDir) => {
								void (async () => {
									await this._updateWoodMaterial('species', speciesId);
									await this._updateWoodMaterial('grain_direction', grainDir);
									if (this._accordion) this._accordion.updateValue('wood_species');
								})();
							}
						});
						scrollWrapper.appendChild(card.render());
					});

					body.appendChild(scrollWrapper);
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
						
						// Use grouped card layout for paint colors
						if (type === 'paint') {
								void import('./components/PaintColorSelector').then(({ PaintColorSelector }) => {
									if (this._renderId !== currentRenderId) return;
									const paintColors = items.map(item => ({
									id: item.id,
									name: item.name,
									rgb: item.rgb || [0.5, 0.5, 0.5],
									description: item.description,
									group: item.group
								}));
								
								const selector = new PaintColorSelector(
									paintColors,
									this._state!.ui.currentBackground.id,
									(id: string) => this.handleBackgroundSelected(id, 'paint')
								);
								
								panelContent.appendChild(selector.render());
									this._scrollToSelectedItem();
								}).catch((error: unknown) => {
									console.error('[Controller] Failed to load PaintColorSelector:', error);
							});
						} else if (type === 'rooms') {
								// Rooms use card layout
								void import('./components/RoomSelector').then(({ RoomSelector }) => {
									if (this._renderId !== currentRenderId) return;
									const rooms = items.map(item => ({
									id: item.id,
									name: item.name,
									path: item.path || '',
									description: item.description
								}));
								
								const selector = new RoomSelector(
									rooms,
									this._state!.ui.currentBackground.id,
									(id: string) => this.handleBackgroundSelected(id, 'rooms')
								);
								
								panelContent.appendChild(selector.render());
									this._scrollToSelectedItem();
								}).catch((error: unknown) => {
									console.error('[Controller] Failed to load RoomSelector:', error);
							});
						} else {
							// Accent uses standard thumbnail grid
							const thumbnailItems = items.map(item => {
								if (item.rgb) {
									return {
										id: item.id,
										label: item.name,
										thumbnailUrl: '',
										disabled: false,
										tooltip: item.description,
										rgb: item.rgb
									};
								} else {
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
              disabled: false,
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
            const backing = this._state.composition.frame_design.backing || {
              enabled: false,
              type: 'acrylic',
              material: 'clear',
              inset: 0.5
            };

            // Add toggle to right-secondary-panel toolbar
						const toggleWrapper = document.createElement('div');
						toggleWrapper.className = 'backing-toolbar-toggle';
						toggleWrapper.innerHTML = `
							<span class="backing-toggle-label">Enable Backing</span>
							<label class="toggle-switch toggle-switch-small">
								<input type="checkbox" id="backing-enabled-checkbox" ${backing.enabled ? 'checked' : ''}>
								<span class="toggle-slider"></span>
							</label>
						`;
						const checkbox = toggleWrapper.querySelector('input')! as HTMLInputElement;
						checkbox.addEventListener('change', () => {
							void this._updateBackingEnabled(checkbox.checked);
						});

						this._rightSecondaryPanel!.appendChild(toggleWrapper);
						this._rightSecondaryPanel!.classList.add('visible');
						this._rightMainPanel.classList.add('has-toolbar');

            // Create BackingPanel with grids only
            void import('./components/BackingPanel').then(({ BackingPanel }) => {
              // Guard: Skip if render is stale
              if (this._renderId !== currentRenderId) return;

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
              
              this._activeRightPanelComponent = backingPanel;
              panelContent.appendChild(backingPanel.render());
              this._scrollToSelectedItem();
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
		
    // Scroll to selected card for archetype grids, otherwise restore scroll position
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const newScrollableContent = this._rightMainPanel?.querySelector('.panel-content-scrollable') as HTMLElement;
      if (newScrollableContent) {
        const selectedCard = newScrollableContent.querySelector('.selected') as HTMLElement;
        if (selectedCard) {
          selectedCard.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
      }
      });
    });
  }

  /**
   * Scroll selected item to center of right main panel
   */
  private _scrollToSelectedItem(): void {
    requestAnimationFrame(() => {
      const selected = this._rightMainPanel?.querySelector('.panel-content-scrollable .selected') as HTMLElement;
      if (selected) {
        selected.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    });
  }
	
	getArchetype(id: string): Archetype | undefined {
    return this._archetypes.get(id);
  }
	
	/**
   * Get the current archetype ID from application state
   */
  public getActiveArchetypeId(): string | null {
    if (!this._state) return null;
    
    // Prefer explicit selection from UI state
    if (this._state.ui.selectedArchetypeId) {
      return this._state.ui.selectedArchetypeId;
    }
    
    // Fallback to detection logic
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
      
      // Set x_offset from constraints.json based on slot_style (single source of truth)
      const slotStyleConstraints = this._constraints?.manufacturing?.slot_style?.[archetype.slot_style];
      if (!slotStyleConstraints?.x_offset) {
        throw new Error(`Missing manufacturing.slot_style.${archetype.slot_style}.x_offset in constraints.json`);
      }
      composition.pattern_settings.x_offset = slotStyleConstraints.x_offset;
			
			// Clamp width/height to new archetype constraints
      if (this._resolver && (archetype.shape === 'rectangular' || archetype.shape === 'diamond')) {
        const sliderConfigs = this._resolver.resolveSliderConfigs(archetypeId, composition);
        const widthConfig = sliderConfigs.find(s => s.id === 'width');
        const heightConfig = sliderConfigs.find(s => s.id === 'height');
        
        if (widthConfig) {
          composition.frame_design.finish_x = Math.max(widthConfig.min, Math.min(composition.frame_design.finish_x, widthConfig.max));
        }
        if (heightConfig) {
          composition.frame_design.finish_y = Math.max(heightConfig.min, Math.min(composition.frame_design.finish_y, heightConfig.max));
        }
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
    
    // Pre-fetch margin presets for constrained archetypes
    if (this._isRectangularLinearN3Plus(archetypeId)) {
      const presets = await this._fetchMarginPresets(composition);
      if (presets.length > 0 && composition.pattern_settings.symmetric_n_end == null) {
        composition = {
          ...composition,
          pattern_settings: {
            ...composition.pattern_settings,
            symmetric_n_end: presets[0].n_end,
            side_margin: presets[0].side_margin
          }
        };
      }
    }
    
    // Store selected archetype ID in state
    if (this._state) {
      this._state.ui.selectedArchetypeId = archetypeId;
    }
    
    // Apply cached or newly created composition
    await this.handleCompositionUpdate(composition);
		
		// Re-render the panel to show updated selection and new slider limits
    if (!this._accordion) {
      this._renderRightMainFiltered();
    } else {
      this._accordion.refreshContent('panel');
      this._accordion.updateValue('panel');
      this._accordion.refreshContent('wood_species');
      this._accordion.updateValue('wood_species');
      this._accordion.refreshContent('layout');
      this._accordion.updateValue('layout');
    }
    
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
					(this._sceneManager as unknown as { applyArtPlacement: (placement: ArtPlacement) => void }).applyArtPlacement(artPlacement);
				} else if ('resetArtPlacement' in this._sceneManager) {
					(this._sceneManager as unknown as { resetArtPlacement: () => void }).resetArtPlacement();
      }
    }
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
		
		// Dimension update
		
    if (!this._state) return;

    const newComposition = structuredClone(this._state.composition);
		
		const newValue = value;

    // Build constraints from current state and config
    const uiConfig = window.uiEngine;
    const shapeConstraintsConfig = uiConfig?.config?.dimension_constraints?.[newComposition.frame_design.shape] as { min_dimension?: number; max_dimension?: number } | undefined;
    
    const constraints: DimensionConstraints = {
      shape: newComposition.frame_design.shape,
      aspectRatioLocked: this._state.ui.aspectRatioLocked ?? false,
      lockedAspectRatio: this._state.ui.lockedAspectRatio ?? null,
      minDimension: (shapeConstraintsConfig?.min_dimension as number | undefined) ?? 8.0,
      maxDimension: (shapeConstraintsConfig?.max_dimension as number | undefined) ?? 84.0
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
    
    // Update accordion header value
    if (this._accordion) {
      this._accordion.updateValue('layout');
    }
    
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
			
			// Update slots slider max (dimensions affect available slot space)
			const slotsConfig = sliderConfigs.find(s => s.id === 'slots');
			if (slotsConfig) {
				const slotsSlider = document.getElementById('slots') as HTMLInputElement;
				if (slotsSlider) {
					slotsSlider.max = String(slotsConfig.max);
					if (parseFloat(slotsSlider.value) > slotsConfig.max) {
						slotsSlider.value = String(slotsConfig.max);
						const valueDisplay = document.getElementById('slots-value');
						if (valueDisplay) {
							valueDisplay.textContent = String(slotsConfig.max);
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
    if (!this._accordion) {
      this._renderRightMainFiltered();
    }
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
		
		// Update slots slider max when separation or side_margin changes
		if (option === 'separation' || option === 'side_margin') {
			const archetypeId = this.getActiveArchetypeId();
			if (archetypeId && this._resolver && this._state) {
				const sliderConfigs = this._resolver.resolveSliderConfigs(archetypeId, this._state.composition);
				const slotsConfig = sliderConfigs.find(s => s.id === 'slots');
				if (slotsConfig) {
					const slotsSlider = document.getElementById('slots') as HTMLInputElement;
					if (slotsSlider) {
						slotsSlider.max = String(slotsConfig.max);
						if (parseFloat(slotsSlider.value) > slotsConfig.max) {
							slotsSlider.value = String(slotsConfig.max);
							const valueDisplay = document.getElementById('slots-value');
							if (valueDisplay) {
								valueDisplay.textContent = String(slotsConfig.max);
							}
						}
					}
				}
			}
		}
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
    
    // Update accordion header value
    if (this._accordion) {
      this._accordion.updateValue('wood_species');
    }
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
		
		// Re-render panel to update BackingPanel with new enabled state
		if (!this._accordion) {
			this._renderRightMainFiltered();
		} else {
			this._accordion.updateValue('backing');
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
		
		// Re-render panel to update BackingPanel with new enabled state
		if (!this._accordion) {
			this._renderRightMainFiltered();
		} else {
			this._accordion.updateValue('backing');
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
        const targetArchetype = Array.from(this._archetypes.values()).find(a => 
          a.shape === newComposition.frame_design.shape && 
          a.slot_style === newComposition.pattern_settings.slot_style && 
          a.number_sections === newN
        );
        // Fallback to config default (Single Source of Truth) instead of hardcoded strings
        const validGrains = (targetArchetype as { available_grains?: string[] })?.available_grains 
          ?? [this._woodMaterialsConfig.default_grain_direction];

        const initializedMaterials = initializeSectionMaterials(
          oldN,
          newN,
          uiCapturedMaterials,
          this._woodMaterialsConfig,
          validGrains
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

      // Invalidate margin presets if geometry changed
      const geometryChanged = changedParams.some(p => 
        ['finish_x', 'finish_y', 'separation', 'number_sections', 'number_slots', 'side_margin'].includes(p)
      );
      if (geometryChanged && this._isRectangularLinearN3Plus(this._state.ui.selectedArchetypeId || '')) {
        this._marginPresetCache.clear();
        // Let backend solver compute symmetric distribution with minimum margin
        newComposition = {
          ...newComposition,
          pattern_settings: {
            ...newComposition.pattern_settings,
            symmetric_n_end: null,
            side_margin: 0
          }
        };
      }

      // Clamp number_slots if side_margin change reduces available space
      if ((changedParams.includes('side_margin') || changedParams.includes('separation')) && this._resolver) {
        const archetypeId = this.getActiveArchetypeId();
        if (archetypeId) {
          const sliderConfigs = this._resolver.resolveSliderConfigs(archetypeId, newComposition);
          const slotsConfig = sliderConfigs.find(s => s.id === 'slots');
          if (slotsConfig && newComposition.pattern_settings.number_slots > slotsConfig.max) {
            newComposition = {
              ...newComposition,
              pattern_settings: {
                ...newComposition.pattern_settings,
                number_slots: slotsConfig.max
              }
            };
            // Force pipeline to re-bin audio and visual slider to snap to new position
            if (!changedParams.includes('number_slots')) changedParams.push('number_slots');
            const slotsSlider = document.getElementById('slots') as HTMLInputElement;
            if (slotsSlider) slotsSlider.value = String(slotsConfig.max);						
          }
        }
      }

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
          } as { numSlots: number; binningMode: 'mean_abs' }
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
            const normalizedAmps = (() => {
              if (validAmps.length === 0) return validAmps;
              const maxAmp = Math.max(...validAmps.map(Math.abs));
              return maxAmp > 1.5 ? validAmps.map(a => a / maxAmp) : validAmps;
            })();
            
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
              (this._sceneManager as unknown as { applyArtPlacement: (placement: ArtPlacement) => void }).applyArtPlacement(artPlacement);
            } else if ('resetArtPlacement' in this._sceneManager) {
              (this._sceneManager as unknown as { resetArtPlacement: () => void }).resetArtPlacement();
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
        console.error('[Controller] CSG generation failed, updating state locally:', error);
        
        // CRITICAL: Even if API fails, update local state so UI reflects user's selection
        this._state = {
          ...this._state,
          composition: newComposition
        };
        
        // Persist state even on API failure
        this._facade.persistState(this._state);
        
        // Notify subscribers so UI updates
        this.notifySubscribers();
      }
			
			// Refresh layout panel if geometry changed to update slider constraints
      if (this._accordion && geometryChanged) {
        this._accordion.refreshContent('layout');
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