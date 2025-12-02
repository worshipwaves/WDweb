import { z } from 'zod';

export const SectionMaterialSchema = z.object({
  section_id: z.number().int().min(0).max(3),
  species: z.string(),
  grain_direction: z.enum(['horizontal', 'vertical', 'radiant', 'diamond'])
}).strict();

export type SectionMaterial = z.infer<typeof SectionMaterialSchema>;

export const BackingConfigSchema = z.object({
  enabled: z.boolean(),
  type: z.enum(['acrylic', 'cloth', 'leather', 'foam']),
  material: z.string(),
  inset: z.number()
}).strict();

export type BackingConfig = z.infer<typeof BackingConfigSchema>;

export const WoodMaterialsConfigSchema = z.object({
  default_species: z.string(),
  default_grain_direction: z.enum(['horizontal', 'vertical', 'radiant']),
  species_catalog: z.array(z.object({
    id: z.string(),
    display: z.string(),
    wood_number: z.string()
  })),
  texture_config: z.object({
    size_thresholds_inches: z.object({
      small: z.number(),
      medium: z.number()
    }),
    size_map: z.record(z.string(), z.object({
      folder: z.string(),
      dimensions: z.string()
    })),
    base_texture_path: z.string()
  }),
  rendering_config: z.object({
    grain_rotation_offset_degrees: z.number(),
    grain_direction_angles: z.record(z.string(), z.union([z.number(), z.string()]))
  }),
  geometry_constants: z.object({
    section_positioning_angles: z.record(z.string(), z.array(z.number())),
    section_rotation_offsets: z.record(z.string(), z.array(z.number()))
  })
}).strict();

export type WoodMaterialsConfig = z.infer<typeof WoodMaterialsConfigSchema>;

// Art placement metadata schema (for placement_defaults.json)
export const ArtPlacementSchema = z.object({
  position: z.tuple([z.number(), z.number(), z.number()]),
  scale_factor: z.number(),
  rotation: z.tuple([z.number(), z.number(), z.number()]),
}).strict();

export type ArtPlacement = z.infer<typeof ArtPlacementSchema>;

export const LightingConfigSchema = z.object({
  direction: z.tuple([z.number(), z.number(), z.number()]),
  intensity: z.number(),
  shadow_enabled: z.boolean(),
  shadow_blur: z.number().optional(),
  shadow_darkness: z.number().optional(),
  ambient_boost: z.number().optional(),
  shadow_receiver_position: z.tuple([z.number(), z.number(), z.number()]).optional(),
  shadow_filter_mode: z.enum(['exponential', 'pcf', 'contact_hardening']).optional(),
  shadow_receiver_size: z.number().optional(),
  shadow_frustum_size: z.number().optional(),
}).strict();

export type LightingConfig = z.infer<typeof LightingConfigSchema>;

export const BackgroundItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string().optional(),
  rgb: z.array(z.number()).optional(),
  description: z.string(),
  group: z.string().optional(),
  art_placement: ArtPlacementSchema.optional(),
  lighting: LightingConfigSchema.optional()
}).strict();

export const BackgroundsConfigSchema = z.object({
  default_background: z.object({
    type: z.enum(['paint', 'accent', 'rooms']),
    id: z.string()
  }),
  categories: z.object({
    paint: z.array(BackgroundItemSchema),
    accent: z.array(BackgroundItemSchema),
    rooms: z.array(BackgroundItemSchema)
  })
}).strict();

export type BackgroundItem = z.infer<typeof BackgroundItemSchema>;
export type BackgroundsConfig = z.infer<typeof BackgroundsConfigSchema>;

export const StylePresetSchema = z.object({
  id: z.string(),
  sections: z.number().int().min(1).max(4),
  slots: z.number().int().min(24),
  name: z.string()
}).strict();

export type StylePreset = z.infer<typeof StylePresetSchema>;

export const ArchetypeSchema = z.object({
  id: z.string(),
  shape: z.string(),
  slot_style: z.string(),
  label: z.string(),
  tooltip: z.string(),
  thumbnail: z.string(),
  number_sections: z.number(),
  number_slots: z.number(),
  separation: z.number(),
  side_margin: z.number().optional()
}).strict();

export type Archetype = z.infer<typeof ArchetypeSchema>;

export const FrameDesignSchema = z.object({
  shape: z.enum(['circular', 'rectangular', 'diamond']),
  frame_orientation: z.string(),
  finish_x: z.number(),
  finish_y: z.number(),
  finish_z: z.number(),
  number_sections: z.number(),
  separation: z.number(),
  species: z.string(),
  material_thickness: z.number(),
	section_materials: z.array(SectionMaterialSchema).optional().default([]),
  backing: BackingConfigSchema.optional(),
});

export const DovetailSettingsSchema = z.object({
  generate_dovetails: z.boolean(),
  show_dovetails: z.boolean(),
  dovetail_inset: z.number(),
  dovetail_cut_direction: z.string(),
  dovetail_edge_default: z.number(),
  dovetail_edge_overrides: z.string(),
});

export const PatternSettingsSchema = z.object({
  slot_style: z.string(),
  number_slots: z.number(),
  bit_diameter: z.number(),
  spacer: z.number(),
  x_offset: z.number(),
  y_offset: z.number(),
  side_margin: z.number(),
  scale_center_point: z.number(),
  amplitude_exponent: z.number(),
  orientation: z.string(),
  grain_angle: z.number(),
  lead_overlap: z.number(),
  lead_radius: z.number(),
  dovetail_settings: DovetailSettingsSchema,
});

export const SizeDefaultsSchema = z.record(z.string(), z.object({
  number_slots: z.number(),
  separation: z.number(),
}));

export const AudioSourceSchema = z.object({
  source_file: z.string().nullable(),
  start_time: z.number(),
  end_time: z.number(),
  use_stems: z.boolean(),
  stem_choice: z.string(),
});

export const AudioProcessingSchema = z.object({
  num_raw_samples: z.number(),
  filter_amount: z.number(),
  apply_filter: z.boolean(),
  binning_method: z.string(),
  binning_mode: z.string(),
  remove_silence: z.boolean(),
  silence_threshold: z.number(),
  silence_duration: z.number(),
});

export const PeakControlSchema = z.object({
  method: z.string(),
  threshold: z.number(),
  roll_amount: z.number(),
  nudge_enabled: z.boolean(),
  clip_enabled: z.boolean(),
  compress_enabled: z.boolean(),
  scale_enabled: z.boolean(),
  scale_all_enabled: z.boolean(),
  manual_enabled: z.boolean(),
  clip_percentage: z.number(),
  compression_exponent: z.number(),
  threshold_percentage: z.number(),
  scale_all_percentage: z.number(),
  manual_slot: z.number(),
  manual_value: z.number(),
});

export const VisualCorrectionSchema = z.object({
  apply_correction: z.boolean(),
  correction_scale: z.number(),
  correction_mode: z.string(),
});

export const DisplaySettingsSchema = z.object({
  show_debug_circle: z.boolean(),
  debug_circle_radius: z.number(),
  show_labels: z.boolean(),
  show_offsets: z.boolean(),
});

export const ExportSettingsSchema = z.object({
  cnc_margin: z.number(),
  sections_in_sheet: z.number(),
});

export const ColorPaletteSchema = z.object({
  color_deep: z.array(z.number()),
  color_mid: z.array(z.number()),
  color_light: z.array(z.number()),
  paper_color: z.array(z.number()),
});

export const WatercolorSettingsSchema = z.object({
  wetness: z.number(),
  pigment_load: z.number(),
  paper_roughness: z.number(),
  bleed_amount: z.number(),
  granulation: z.number(),
});

export const OilSettingsSchema = z.object({
  brush_size: z.number(),
  impasto: z.number(),
  brush_texture: z.number(),
  color_mixing: z.number(),
});

export const InkSettingsSchema = z.object({
  ink_flow: z.number(),
  ink_density: z.number(),
  edge_darkening: z.number(),
  dryness: z.number(),
});

export const PhysicalSimulationSchema = z.object({
  brush_pressure: z.number(),
  paint_thickness: z.number(),
  drying_time: z.number(),
  medium_viscosity: z.number(),
});

export const NoiseSettingsSchema = z.object({
  noise_scale: z.number(),
  noise_octaves: z.number(),
  noise_seed: z.number(),
  flow_speed: z.number(),
  flow_direction: z.number(),
});

export const ArtisticRenderingSchema = z.object({
  artistic_style: z.string(),
  color_palette: z.string(),
  opacity: z.number(),
  artistic_intensity: z.number(),
  amplitude_effects: z.string(),
  amplitude_influence: z.number(),
  watercolor_settings: WatercolorSettingsSchema,
  oil_settings: OilSettingsSchema,
  ink_settings: InkSettingsSchema,
  physical_simulation: PhysicalSimulationSchema,
  noise_settings: NoiseSettingsSchema,
  color_palettes: z.record(z.string(), ColorPaletteSchema),
});

export const CompositionStateDTOSchema = z.object({
  frame_design: FrameDesignSchema,
  pattern_settings: PatternSettingsSchema,
  size_defaults: SizeDefaultsSchema.optional(), // Make optional to handle old stored states
  audio_source: AudioSourceSchema,
  audio_processing: AudioProcessingSchema,
  peak_control: PeakControlSchema,
  visual_correction: VisualCorrectionSchema,
  display_settings: DisplaySettingsSchema,
  export_settings: ExportSettingsSchema,
  artistic_rendering: ArtisticRenderingSchema,
  processed_amplitudes: z.array(z.number()),
});

export type CompositionStateDTO = z.infer<typeof CompositionStateDTOSchema>;

export const CSGDataResponseSchema = z.object({
  panel_config: z.object({
    finish_x: z.number(),
    finish_y: z.number(),
    thickness: z.number(),
    separation: z.number(),
    number_sections: z.number(),
    shape: z.string().optional(),
		slot_style: z.string().optional(),
  }),
  slot_data: z.array(z.object({
    vertices: z.array(z.array(z.number())).optional(),
    x: z.number(),
    z: z.number(),
    angle: z.number(),
    length: z.number(),
    width: z.number().optional(),
    panelIndex: z.number().optional(),
  })),
  section_edges: z.array(z.object({
    section_index: z.number(),
    edge1_start: z.array(z.number()),
    edge1_end: z.array(z.number()),
    edge2_start: z.array(z.number()),
    edge2_end: z.array(z.number()),
  })).optional(),
  section_local_centers: z.array(z.tuple([z.number(), z.number()])),
  true_min_radius: z.number(),
});

export type CSGDataResponse = z.infer<typeof CSGDataResponseSchema>;

export const SmartCsgResponseSchema = z.object({
  csg_data: CSGDataResponseSchema,
  updated_state: CompositionStateDTOSchema,
  max_amplitude_local: z.number(),
  backing_parameters: z.any().optional(),
});

export type SmartCsgResponse = z.infer<typeof SmartCsgResponseSchema>;

export const AudioProcessResponseSchema = z.object({
  updated_state: CompositionStateDTOSchema,
  max_amplitude_local: z.number(),
  raw_samples_for_cache: z.array(z.number()),
});

export type AudioProcessResponse = z.infer<typeof AudioProcessResponseSchema>;

// Schema for tracking original audio data to prevent compound rescaling
export const AudioDataSchema = z.object({
  rawSamples: z.array(z.number()).nullable(),
  previousMaxAmplitude: z.number().nullable(),
  audioSessionId: z.string().nullable(),
});

export type AudioData = z.infer<typeof AudioDataSchema>;

// Accordion state schema for navigation
export const AccordionStateSchema = z.record(z.string(), z.boolean());
export type AccordionState = z.infer<typeof AccordionStateSchema>;

export const AccordionStateMapSchema = z.record(z.string(), AccordionStateSchema);
export type AccordionStateMap = z.infer<typeof AccordionStateMapSchema>;

// Hero Forge UI state schema
export const UIStateSchema = z.object({
  leftPanelVisible: z.boolean(),
  rightPanelVisible: z.boolean(),
  selectedCategory: z.string().nullable(),
  selectedOption: z.string().nullable(),
  currentStyleIndex: z.number().nullable(),
  isAutoPlaying: z.boolean(),
  showHint: z.boolean(),
  renderQuality: z.enum(['low', 'medium', 'high']),
  // Navigation state
  activeCategory: z.string().nullable(),
  activeSubcategory: z.string().nullable(),
  subcategoryHistory: z.record(z.string(), z.string()), // category -> last subcategory
  filterSelections: z.record(z.string(), z.record(z.string(), z.array(z.string()))),
  accordionState: AccordionStateMapSchema.optional().default({}),
  currentBackground: z.object({
    type: z.enum(['paint', 'accent', 'rooms']),
    id: z.string()
  }),
	aspectRatioLocked: z.boolean().optional().default(false),
  lockedAspectRatio: z.number().nullable().optional().default(null)
});

export type UIState = z.infer<typeof UIStateSchema>;

// ============================================================================
// FOUR-PANEL ARCHITECTURE SCHEMAS (STYLE Category Config)
// ============================================================================

/**
 * Thumbnail configuration schema
 */
export const ThumbnailConfigSchema = z.object({
  base_path: z.string(),
  filter_base_path: z.string(),
  extension: z.string()
});

/**
 * Filter option schema
 */
export const FilterOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  thumbnail: z.string()
});

/**
 * Filter configuration schema
 */
export const FilterConfigSchema = z.object({
  type: z.enum(['single', 'stack']),
  label: z.string(),
  ui_state_path: z.string(),
  options: z.array(FilterOptionSchema),
  default: z.string()
});

/**
 * State updates schema - flexible record for dotted path notation
 */
export const StateUpdatesSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()])
);

/**
 * Thumbnail option configuration schema
 */
export const ThumbnailOptionConfigSchema = z.object({
  label: z.string(),
  tooltip: z.string(),
  state_updates: StateUpdatesSchema
});

/**
 * Options configuration schema
 */
export const OptionsConfigSchema = z.object({
  label: z.string(),
  validation_rules: z.record(z.string(), z.array(z.number())),
  thumbnails: z.record(z.string(), ThumbnailOptionConfigSchema)
});

/**
 * Subcategory configuration schema
 */
export const SubcategoryConfigSchema = z.object({
  label: z.string(),
	panel_title: z.string().optional(),
	panel_help: z.string().optional(),
  note: z.string().optional(),
  filters: z.record(z.string(), FilterConfigSchema),
  options: z.record(z.string(), OptionsConfigSchema)
});

/**
 * Style category configuration schema
 */
export const StyleCategoryConfigSchema = z.object({
  label: z.string(),
  subcategories: z.record(z.string(), SubcategoryConfigSchema)
});

/**
 * Categories configuration schema
 */
export const CategoriesConfigSchema = z.object({
  style: StyleCategoryConfigSchema
});

// Type exports
export type ThumbnailConfig = z.infer<typeof ThumbnailConfigSchema>;
export type FilterOption = z.infer<typeof FilterOptionSchema>;
export type FilterConfig = z.infer<typeof FilterConfigSchema>;
export type StateUpdates = z.infer<typeof StateUpdatesSchema>;
export type ThumbnailOptionConfig = z.infer<typeof ThumbnailOptionConfigSchema>;
export type OptionsConfig = z.infer<typeof OptionsConfigSchema>;
export type SubcategoryConfig = z.infer<typeof SubcategoryConfigSchema>;
export type StyleCategoryConfig = z.infer<typeof StyleCategoryConfigSchema>;
export type CategoriesConfig = z.infer<typeof CategoriesConfigSchema>;

const AudioUploadConstraintsSchema = z.object({
  accepted_mime_types: z.array(z.string()),
  accepted_extensions: z.array(z.string()),
  max_file_size_mb: z.number(),
});

const AudioConstraintsSchema = z.object({
  upload: AudioUploadConstraintsSchema,
});

// The single, authoritative schema for the entire application state
export const ApplicationStateSchema = z.object({
  phase: z.enum(['upload', 'discovery', 'reveal', 'intent', 'customize']),
  composition: CompositionStateDTOSchema,
  compositionCache: z.record(z.string(), CompositionStateDTOSchema).default({}),
  audio: AudioDataSchema, // New addition for smart processing
  ui: UIStateSchema,
  processing: z.object({
    stage: z.enum(['idle', 'uploading', 'preparing_textures', 'demucs', 'rendering']),
    progress: z.number(),
  }),
});

// ======================================================================
// PLACEMENT DEFAULTS SCHEMAS
// ======================================================================

// Composition Overrides Schema (partial for flexibility)
export const CompositionOverridesSchema = z.record(z.string(), z.any());

export type CompositionOverrides = Partial<CompositionStateDTO>;

// Schema for a single background's placement settings
export const BackgroundPlacementSchema = z.object({
  composition_overrides: CompositionOverridesSchema.optional(),
  art_placement: ArtPlacementSchema.optional(),
}).strict();

export type BackgroundPlacement = z.infer<typeof BackgroundPlacementSchema>;

// Schema for a single archetype's placement rules
export const ArchetypePlacementSchema = z.object({
  backgrounds: z.record(z.string(), BackgroundPlacementSchema),
}).strict();

export type ArchetypePlacement = z.infer<typeof ArchetypePlacementSchema>;

// The top-level schema for the entire placement_defaults.json file
export const PlacementDefaultsSchema = z.object({
  version: z.string(),
  archetypes: z.record(z.string(), ArchetypePlacementSchema),
}).strict();

export type PlacementDefaults = z.infer<typeof PlacementDefaultsSchema>;

// ======================================================================
// CONSTRAINTS CONFIGURATION SCHEMA
// ======================================================================

const ArchetypeSliderConstraintSchema = z.object({
  min: z.number(),
  max: z.number(),
  step: z.number()
}).strict();

const ArchetypeSlotsConstraintSchema = z.object({
  min: z.number(),
  max: z.number()
}).strict();

const ArchetypeConstraintSchema = z.object({
  available_sliders: z.array(z.string()),
  size: ArchetypeSliderConstraintSchema.optional(),
  width: ArchetypeSliderConstraintSchema.optional(),
  height: ArchetypeSliderConstraintSchema.optional(),
  slots: ArchetypeSlotsConstraintSchema.optional(),
  separation: ArchetypeSliderConstraintSchema.optional(),
  side_margin: ArchetypeSliderConstraintSchema.optional(),
  interdependent: z.string().optional()
}).strict();

const UIVisibilityConditionSchema = z.record(z.string(), z.array(z.union([z.string(), z.number()])));

const UIVisibilityRuleSchema = z.object({
  show_when: UIVisibilityConditionSchema.optional(),
  disabled_when: UIVisibilityConditionSchema.optional(),
});

const UIVisibilitySchema = z.object({
  elements: z.record(z.string(), UIVisibilityRuleSchema),
  options: z.record(z.string(), z.record(z.string(), UIVisibilityRuleSchema)),
});

const SceneConstraintSchema = z.object({
  max_height: z.number().nullable(),
  reason: z.string()
}).strict();

export const ConstraintsConfigSchema = z.object({
  version: z.string(),
  description: z.string(),
  manufacturing: z.object({
    cnc_table: z.object({
      max_x: z.number(),
      max_y: z.number(),
      reason: z.string()
    }).strict(),
    circular: z.object({
      general: z.object({
        min: z.number(),
        max: z.number(),
        reason: z.string()
      }).strict(),
      by_section_count: z.record(z.string(), z.object({
        min: z.number(),
        max: z.number()
      }).strict())
    }).strict(),
    rectangular: z.object({
      width: z.object({ min: z.number(), max: z.number() }).strict(),
      height: z.object({ min: z.number(), max: z.number() }).strict(),
      reason: z.string()
    }).strict(),
    diamond: z.object({
      width: z.object({ min: z.number(), max: z.number() }).strict(),
      height: z.object({ min: z.number(), max: z.number() }).strict(),
      reason: z.string()
    }).strict()
  }).strict(),
  archetype_constraints: z.record(z.string(), ArchetypeConstraintSchema),
  scenes: z.record(z.string(), SceneConstraintSchema),
  ui_visibility: UIVisibilitySchema,
  audio: AudioConstraintsSchema.optional()
}).strict();

export type ConstraintsConfig = z.infer<typeof ConstraintsConfigSchema>;

export type ApplicationState = z.infer<typeof ApplicationStateSchema>;

