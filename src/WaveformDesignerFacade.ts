/**export type Action = 
  | { type: 'FILE_UPLOADED'; payload: File }
  | { type: 'STYLE_SELECTED'; payload: number }
  | { type: 'AUTOPLAY_TOGGLED'; payload: boolean }
  | { type: 'PHASE_CHANGED'; payload: ApplicationState['phase'] }
  | { type: 'PROCESSING_UPDATE'; payload: Partial<ApplicationState['processing']> }
  | { type: 'DEMUCS_COMPLETED'; payload: CompositionStateDTO }
  | { type: 'STATE_RESTORED'; payload: ApplicationState };

 * WaveformDesignerFacade - Frontend facade matching backend architecture
 * 
 * This is the ONLY entry point for UI components to interact with services.
 * Maintains architectural boundaries and prevents direct service access.
 * All state management, backend calls, and business logic go through here.
 */

import { 
  CompositionStateDTOSchema,
  AudioProcessResponseSchema,
  SmartCsgResponseSchema,
  ApplicationStateSchema,
  BackgroundsConfigSchema,
  type CompositionStateDTO,
  type AudioProcessResponse,
  type SmartCsgResponse,
  type StylePreset,
  type ApplicationState,
	type BackgroundsConfig
} from './types/schemas';
import { fetchAndValidate, parseStoredData } from './utils/validation';

// Action types for state updates
export type Action =
  | { type: 'FILE_UPLOADED'; payload: { file: File; uiSnapshot: CompositionStateDTO } }
  | { type: 'STYLE_SELECTED'; payload: number }             // user selection
  | { type: 'STYLE_ADVANCE'; payload: number }              // autoplay (programmatic)
  | { type: 'AUTOPLAY_TOGGLED'; payload: boolean }
  | { type: 'PHASE_CHANGED'; payload: ApplicationState['phase'] }
  | { type: 'PROCESSING_UPDATE'; payload: Partial<ApplicationState['processing']> }
  | { type: 'DEMUCS_COMPLETED'; payload: CompositionStateDTO }
  | { type: 'STATE_RESTORED'; payload: ApplicationState }
  | { type: 'COMPOSITION_UPDATED'; payload: CompositionStateDTO }
	| { type: 'AUDIO_COMMIT'; payload: { useSlice: boolean; startTime: number | null; endTime: number | null; isolateVocals: boolean; removeSilence: boolean; silenceThreshold: number; silenceMinDuration: number; sliceBlob: Blob | null; originalFile?: File } }
  | { 
      type: 'FILE_PROCESSING_SUCCESS'; 
      payload: { 
        composition: CompositionStateDTO; 
        maxAmplitudeLocal: number; 
        rawSamplesForCache: number[]; // Add this
        audioSessionId?: string 
      };
    }
  | { type: 'SHOW_HINT' }
  | { type: 'CATEGORY_SELECTED'; payload: string }
  | { type: 'SUBCATEGORY_SELECTED'; payload: { category: string; subcategory: string } }
  | { type: 'FILTER_CHANGED'; payload: { category: string; subcategory: string; filterId: string; selections: string[] } };
	

export class WaveformDesignerFacade {
	private readonly apiBase = 'http://localhost:8000';
  private _stylePresets: StylePreset[] = [];
  
  /**
   * Initialize facade by loading style presets from backend config
   */
  initialize(): void {
  // Style presets deprecated - using archetypes instead
  // Archetypes are loaded by ApplicationController
  this._stylePresets = [];
}
  
  /**
   * Process uploaded audio file through backend
   */
  async processAudio(file: File, state: CompositionStateDTO): Promise<AudioProcessResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('state', JSON.stringify(state));

    return fetchAndValidate(
      `${this.apiBase}/audio/process`,
      AudioProcessResponseSchema,
      {
        method: 'POST',
        body: formData,
      }
    );
  }
  
  /**
   * Get CSG data using the smart processing endpoint
   */
  async getSmartCSGData(
    state: CompositionStateDTO,
    changedParams: string[],
    previousMaxAmplitude: number | null
  ): Promise<SmartCsgResponse> {
    const requestBody = {
      state,
      changed_params: changedParams,
      previous_max_amplitude: previousMaxAmplitude,
    };

    return fetchAndValidate(
      `${this.apiBase}/geometry/csg-data`,
      SmartCsgResponseSchema,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );
  }
  
  /**
   * Get default state from backend
   */
  async getDefaultState(): Promise<CompositionStateDTO> {
    return fetchAndValidate(
      `${this.apiBase}/composition/default`,
      CompositionStateDTOSchema
    );
  }
  
  /**
   * Create initial application state
   */
  async createInitialState(): Promise<ApplicationState> {
  const [composition, backgroundsConfig] = await Promise.all([
    this.getDefaultState(),
    fetchAndValidate<BackgroundsConfig>(
      `${this.apiBase}/api/config/backgrounds`,
      BackgroundsConfigSchema
    )
  ]);
  
  return {
    phase: 'upload',
    composition,
    audio: {
      rawSamples: null,
      previousMaxAmplitude: null,
      audioSessionId: null,
    },
    ui: {
      leftPanelVisible: true,
      rightPanelVisible: true,
      selectedCategory: null,
      selectedOption: null,
      currentStyleIndex: 0,
      isAutoPlaying: false,
      showHint: false,
      renderQuality: 'medium',
      activeCategory: null,
      activeSubcategory: null,
      subcategoryHistory: {},
      filterSelections: {},
      currentBackground: {
        type: 'rooms',
        id: backgroundsConfig.default_room
      },
      currentWallFinish: backgroundsConfig.default_wall_finish
    },
    processing: {
      stage: 'idle',
      progress: 0
    }
  };
}
  
  /**
   * Process state transitions (pure function)
   */
  processStateTransition(state: ApplicationState, action: Action): ApplicationState {
    switch (action.type) {
      case 'PHASE_CHANGED':
        return {
          ...state,
          phase: action.payload
        };
        
			case 'STYLE_SELECTED':
				// User-initiated style selection -> stop autoplay
				return {
					...state,
					ui: {
						...state.ui,
						currentStyleIndex: action.payload,
						isAutoPlaying: false
					}
				};

			case 'STYLE_ADVANCE':
				// Programmatic autoplay advance -> do NOT stop autoplay
				return {
					...state,
					ui: {
						...state.ui,
						currentStyleIndex: action.payload
						// do NOT touch isAutoPlaying here
					}
				};

        
      case 'AUTOPLAY_TOGGLED':
        return {
          ...state,
          ui: {
            ...state.ui,
            isAutoPlaying: action.payload
          }
        };
        
      case 'PROCESSING_UPDATE':
        return {
          ...state,
          processing: {
            ...state.processing,
            ...action.payload
          }
        };
        
      case 'DEMUCS_COMPLETED':
        return {
          ...state,
          phase: 'reveal' as const,
          composition: action.payload,
          processing: {
            stage: 'idle' as const,
            progress: 100
          }
        };
        
      case 'STATE_RESTORED':
        return { ...action.payload };
        
      case 'FILE_PROCESSING_SUCCESS': {
        // When a new file is processed, we create a completely new, clean application state.
        // This ensures no stale parameters (e.g., from a previous localStorage session) interfere.
        const newComposition = action.payload.composition;
        return {
          ...state, // We keep the top-level structure
          phase: 'discovery',
          composition: newComposition, // Use the fresh composition from the backend
          audio: {
            rawSamples: action.payload.rawSamplesForCache,
            previousMaxAmplitude: action.payload.maxAmplitudeLocal,
            audioSessionId: action.payload.audioSessionId || null,
          },
          processing: { stage: 'idle', progress: 100 },
          ui: {
            // Reset UI state to defaults for a new discovery phase
            ...state.ui,
            currentStyleIndex: 0,
            isAutoPlaying: true,
            showHint: false,
          },
        };
      }

      case 'SHOW_HINT':
        return {
          ...state,
          ui: { ...state.ui, showHint: true }
        };
        
      case 'COMPOSITION_UPDATED':
        return {
          ...state,
          composition: action.payload
        };
        
      case 'CATEGORY_SELECTED': {
        const categoryId = action.payload;
        const lastSubcategory = state.ui.subcategoryHistory[categoryId] || null;
        return {
          ...state,
          ui: {
            ...state.ui,
            activeCategory: categoryId,
            activeSubcategory: lastSubcategory,
            filterSelections: {}
          }
        };
      }
        
      case 'SUBCATEGORY_SELECTED':
        return {
          ...state,
          ui: {
            ...state.ui,
            activeCategory: action.payload.category,
            activeSubcategory: action.payload.subcategory,
            subcategoryHistory: {
              ...state.ui.subcategoryHistory,
              [action.payload.category]: action.payload.subcategory
            }
          }
        };
        
      case 'FILTER_CHANGED': {
        const key = `${action.payload.category}_${action.payload.subcategory}`;
        return {
          ...state,
          ui: {
            ...state.ui,
            filterSelections: {
              ...state.ui.filterSelections,
              [key]: {
                ...state.ui.filterSelections[key],
                [action.payload.filterId]: action.payload.selections
              }
            }
          }
        };
      }
        
      default:
        return state;
    }
  }
  
  /**
   * Persist state to localStorage (facade is the only one who touches storage)
   */
  persistState(state: ApplicationState): void {
    try {
      // Create a deep copy to avoid mutating the live state
      const stateToPersist = structuredClone(state);
      
      // Convert Float32Array to a plain array for correct JSON serialization
      if (stateToPersist.audio.rawSamples) {
        stateToPersist.audio.rawSamples = Array.from(stateToPersist.audio.rawSamples);
      }

      const serialized = JSON.stringify(stateToPersist);
      localStorage.setItem('wavedesigner_session', serialized);
    } catch (e) {
      console.warn('Failed to persist state:', e);
    }
  }
  
  /**
   * Load persisted state from localStorage
   */
  loadPersistedState(): ApplicationState | null {
    const stored = localStorage.getItem('wavedesigner_session');
    // Use the type-safe helper to parse and validate the stored data.
    // It handles JSON parsing errors and Zod validation internally.
    const restoredState = parseStoredData(stored, ApplicationStateSchema);
    
    // Always reset processing stage to idle on page load
    if (restoredState) {
      return {
        ...restoredState,
        processing: {
          stage: 'idle',
          progress: 0
        }
      };
    }
    
    return null;
  }
	
	/**
   * Deep merge persisted state onto fresh defaults
   * Preserves user customizations while adding new schema fields
   */
  mergeStates(freshDefaults: ApplicationState, persisted: ApplicationState): ApplicationState {
    // Always use fresh backend defaults for system config (not user choices)
    const systemDefaults = {
      audio_processing: freshDefaults.composition.audio_processing
    };
    
    const merge = (target: unknown, source: unknown): unknown => {
      if (typeof source !== 'object' || source === null || Array.isArray(source)) {
        return source;
      }
      
      if (typeof target !== 'object' || target === null || Array.isArray(target)) {
        return source;
      }

      const result: Record<string, unknown> = { ...(target as Record<string, unknown>) };

      for (const key of Object.keys(source)) {
        const sourceValue = (source as Record<string, unknown>)[key];
        const targetValue = result[key];

        if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
          result[key] = merge(targetValue, sourceValue);
        } else {
          result[key] = sourceValue;
        }
      }
      
      return result;
    };
    
    const merged = merge(freshDefaults, persisted) as ApplicationState;
    
    // Restore system defaults that should not come from persisted state
    return {
      ...merged,
      composition: {
        ...merged.composition,
        audio_processing: systemDefaults.audio_processing
      }
    };
  }
  
  /**
   * Get available style options from configuration
   */
  getStyleOptions(): StylePreset[] {
    return this._stylePresets;
  }
}