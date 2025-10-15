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
  StylePresetSchema,
  ApplicationStateSchema,
  type CompositionStateDTO,
  type AudioProcessResponse,
  type SmartCsgResponse,
  type StylePreset,
  type ApplicationState
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
  | { 
      type: 'FILE_PROCESSING_SUCCESS'; 
      payload: { 
        composition: CompositionStateDTO; 
        maxAmplitudeLocal: number; 
        rawSamplesForCache: number[]; // Add this
        audioSessionId?: string 
      };
    }
  | { type: 'SHOW_HINT' };
	

export class WaveformDesignerFacade {
	private readonly apiBase = 'http://localhost:8000';
  private _stylePresets: StylePreset[] = [];
  
  /**
   * Initialize facade by loading style presets from backend config
   */
  async initialize(): Promise<void> {
    const response = await fetch(`${this.apiBase}/api/config/default-parameters`);
    if (!response.ok) {
      throw new Error('Failed to load default parameters');
    }
    
    const data = await response.json() as unknown;
    
    // Validate structure
    if (typeof data !== 'object' || data === null || !('style_presets' in data)) {
      throw new Error('Invalid config structure: missing style_presets');
    }
    
    const config = data as { style_presets: unknown };
    
    // Validate each preset
    if (!Array.isArray(config.style_presets)) {
      throw new Error('style_presets must be an array');
    }
    
    this._stylePresets = config.style_presets.map((preset: unknown) => {
      const result = StylePresetSchema.safeParse(preset);
      if (!result.success) {
        console.error('Invalid style preset:', result.error.format());
        throw new Error('Style preset validation failed');
      }
      return result.data;
    });
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
    const composition: CompositionStateDTO = await this.getDefaultState();
    
    return {
      phase: 'upload',
      composition,
      audio: {
        originalAmplitudes: null,
        previousMaxAmplitude: null,
        audioSessionId: null,
      },
      ui: {
        currentStyleIndex: 0,
        isAutoPlaying: false,
        showHint: false,
        renderQuality: 'high'
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
    const merge = (target: any, source: any): any => {
      if (!source || typeof source !== 'object' || Array.isArray(source)) {
        return source;
      }
      
      if (!target || typeof target !== 'object' || Array.isArray(target)) {
        return source;
      }
      
      const result: any = { ...target };
      
      for (const key in source) {
        if (source.hasOwnProperty(key)) {
          if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
            result[key] = merge(target[key], source[key]);
          } else {
            result[key] = source[key];
          }
        }
      }
      
      return result;
    };
    
    return merge(freshDefaults, persisted);
  }
	
  /**
   * TypeScript port of the backend's core geometry calculation.
   * This allows the frontend to stay in sync with max_amplitude_local
   * without an extra API call.
   */
  calculateGeometriesCore_TS(state: CompositionStateDTO): { maxAmplitudeLocal: number } {
    const { frame_design: frame, pattern_settings: pattern } = state;
    const { finish_x, finish_y, number_sections, separation } = frame;
    const { number_slots, bit_diameter, spacer, x_offset, y_offset, scale_center_point } = pattern;

    if (number_slots <= 0) return { maxAmplitudeLocal: 0 };

    const radius = Math.min(finish_x, finish_y) / 2.0;
    const gc_x = finish_x / 2.0;
    const gc_y = finish_y / 2.0;
    
    const slot_angle_deg = 360.0 / number_slots;
    const half_slot_angle_rad = (slot_angle_deg / 2.0) * (Math.PI / 180.0);

    const true_min_radius_from_NR = (bit_diameter + spacer) / (2 * Math.sin(half_slot_angle_rad));
    const circum_radius = (spacer / 2.0) / Math.sin(half_slot_angle_rad);

    let max_radius_local_from_LC = radius - y_offset;

    if (number_sections > 1) {
        let local_radius = radius;
        if (number_sections === 2) {
            const lc_x = gc_x + (separation / 2.0) + x_offset;
            local_radius = radius - Math.abs(lc_x - gc_x);
        } else if (number_sections === 3) {
            const lc_distance_from_gc = (separation + (2 * x_offset)) / Math.sqrt(3);
            const lc_y = gc_y + lc_distance_from_gc;
            local_radius = radius - Math.abs(lc_y - gc_y);
        } else if (number_sections === 4) {
            const effective_side_len = separation + (2 * x_offset);
            const lc_distance_from_gc = effective_side_len / Math.sqrt(2);
            local_radius = radius - lc_distance_from_gc;
        }
        max_radius_local_from_LC = local_radius - y_offset;
    }

    if (max_radius_local_from_LC <= true_min_radius_from_NR) {
        max_radius_local_from_LC = true_min_radius_from_NR + bit_diameter;
    }

    const min_radius_from_V = true_min_radius_from_NR - circum_radius;
    let max_radius_from_V = max_radius_local_from_LC - circum_radius;
    if (max_radius_from_V <= min_radius_from_V) {
        max_radius_from_V = min_radius_from_V + bit_diameter;
    }
    
    const base_cp_from_V = (min_radius_from_V + max_radius_from_V) / 2.0;
    const center_point_from_V = base_cp_from_V * scale_center_point;
    
    const max_extension_outward = max_radius_from_V - center_point_from_V;
    const max_extension_inward = center_point_from_V - min_radius_from_V;
    let max_amplitude_from_V = 2.0 * Math.min(max_extension_outward, max_extension_inward);
    
    max_amplitude_from_V *= Math.cos(half_slot_angle_rad);
    
    return { maxAmplitudeLocal: max_amplitude_from_V > 0 ? max_amplitude_from_V : 0 };
  }	
  
  /**
   * Get available style options from configuration
   */
  getStyleOptions(): StylePreset[] {
    return this._stylePresets;
  }
}