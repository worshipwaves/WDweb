"""
Data Transfer Objects (DTOs) for WaveDesigner
Following Pragmatic Immutability principle - all DTOs are frozen

CONSTRAINT PHILOSOPHY:
- Field constraints here are STRUCTURAL INVARIANTS only (e.g., non-negative counts, normalized 0-1 ranges)
- Business-rule limits (max dimensions, slot counts) are validated by service layer against config JSON
- Business-configurable enumerations use `str` - validated against config at runtime
- Engine-fixed enumerations use `Literal` - these require code changes to extend

BUSINESS-CONFIGURABLE (str):
- grain_direction: wood_materials.json valid_grain_directions
- backing type: backing_materials.json material_catalog keys
- shape: constraints.json valid_shapes  
- color_palette: composition_defaults.json color_palettes keys

ENGINE-FIXED (Literal):
- frame_orientation: geometric constraint (2 physical orientations)
- dovetail_cut_direction: CNC machining constraint
- slot_style: geometry engine algorithms
- orientation: geometric constraint
- stem_choice: Demucs AI external dependency
- binning_method, binning_mode: statistical algorithms
- peak control method: audio processing algorithms
- correction_mode: algorithm implementations
- artistic_style: shader implementations
"""

from typing import List, Dict, Optional, Literal, Tuple, Any, Union
from pydantic import BaseModel, Field, ConfigDict, model_validator
from pydantic.alias_generators import to_camel


# Configuration DTOs
class SpeciesCatalogItemDTO(BaseModel):
    """Individual species catalog entry."""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    id: str
    display: str
    wood_number: str


class WoodMaterialsConfigDTO(BaseModel):
    """Wood materials configuration from wood_materials.json."""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    default_species: str
    default_grain_direction: str  # Validated against valid_grain_directions in config
    species_catalog: List[SpeciesCatalogItemDTO]
    texture_config: Dict[str, Any]
    rendering_config: Dict[str, float]
    geometry_constants: Dict[str, Dict[str, List[int]]]


# Material Configuration DTOs
class SectionMaterialDTO(BaseModel):
    """Material settings for individual sections."""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    section_id: int = Field(ge=0)  # Upper bound from constraints.json
    species: str  # Validated against species_catalog in wood_materials.json
    grain_direction: str  # Validated against valid_grain_directions in wood_materials.json


class ArtPlacementDTO(BaseModel):
    """Defines the 3D placement of the artwork in a scene."""
    model_config = ConfigDict(frozen=True)
    position: Tuple[float, float, float]
    scale_factor: float
    rotation: Tuple[float, float, float]


class BackgroundPlacementDTO(BaseModel):
    """Contains overrides for a specific background."""
    model_config = ConfigDict(frozen=True)
    composition_overrides: Optional[Dict[str, Any]] = None
    art_placement: Optional[ArtPlacementDTO] = None


class ArchetypePlacementDTO(BaseModel):
    """Contains all background-specific overrides for a single archetype."""
    model_config = ConfigDict(frozen=True)
    backgrounds: Dict[str, BackgroundPlacementDTO]


class PlacementDefaultsDTO(BaseModel):
    """The root model for placement_defaults.json."""
    model_config = ConfigDict(frozen=True)
    version: str
    archetypes: Dict[str, ArchetypePlacementDTO]


class BackingConfig(BaseModel):
    """Backing material configuration."""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    enabled: bool
    type: str  # Validated against material_catalog keys in backing_materials.json
    material: str  # Validated against materials within the type
    inset: float = Field(ge=0.0)  # Upper bound from backing_materials.json


# Frame and Physical Design DTOs
class FrameDesignDTO(BaseModel):
    """Frame design parameters for the physical panel."""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    shape: str  # Validated against valid_shapes in constraints.json
    frame_orientation: Literal["vertical", "horizontal"]  # Engine-fixed: geometric constraint
    finish_x: float = Field(ge=1.0)  # Upper bound from constraints.json
    finish_y: float = Field(ge=1.0)  # Upper bound from constraints.json
    finish_z: float = Field(ge=0.1)  # Upper bound from config
    number_sections: int = Field(ge=1)  # Upper bound from constraints.json
    separation: float = Field(ge=0.0)  # Upper bound from constraints.json
    species: str  # Validated against species_catalog in wood_materials.json
    material_thickness: float = Field(ge=0.1)  # Upper bound from config
    section_materials: List[SectionMaterialDTO] = Field(default_factory=list)
    backing: Optional[BackingConfig] = None
    
    @model_validator(mode='after')
    def validate_circular_dimensions(self) -> 'FrameDesignDTO':
        """Ensure circular shape has equal width and height."""
        if self.shape == "circular" and abs(self.finish_x - self.finish_y) > 0.01:
            raise ValueError(
                f"Circular shape requires equal dimensions. "
                f"Got finish_x={self.finish_x}, finish_y={self.finish_y}"
            )
        return self


# Pattern and Slot Configuration DTOs
class DovetailSettingsDTO(BaseModel):
    """Dovetail path generation settings"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    generate_dovetails: bool
    show_dovetails: bool
    dovetail_inset: float = Field(ge=0.01)  # Upper bound from config
    dovetail_cut_direction: Literal["climb", "conventional"]  # Engine-fixed: CNC machining
    dovetail_edge_default: int = Field(ge=0)  # Upper bound derived from max sections
    dovetail_edge_overrides: str  # JSON string of overrides


class PatternSettingsDTO(BaseModel):
    """Slot pattern configuration"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    slot_style: Literal["radial", "linear", "sunburst", "asymmetric"]  # Engine-fixed: geometry algorithms
    pattern_diameter: float = Field(default=36.0, ge=1.0)  # Upper bound from constraints.json
    number_slots: int = Field(ge=1)  # Upper bound from constraints.json
    bit_diameter: float = Field(ge=0.0)  # Upper bound from config
    spacer: float = Field(ge=0.0)  # Upper bound from config
    x_offset: float = Field(ge=0.0)  # Upper bound from constraints.json
    y_offset: float = Field(ge=0.0)  # Upper bound from constraints.json
    side_margin: float = Field(ge=0.0)  # Upper bound from constraints.json
    symmetric_n_end: Optional[int] = Field(
        default=None,
        ge=1,
        description="Override n_end for symmetric distribution in rectangular linear n>=3"
    )
    scale_center_point: float = Field(ge=0.1)  # Upper bound from config
    amplitude_exponent: float = Field(ge=0.25)  # Upper bound from config
    visual_floor_pct: float = Field(ge=0.0, le=0.5)  # Min slot height as % of max
    orientation: Literal["auto", "horizontal", "vertical"]  # Engine-fixed: geometric constraint
    grain_angle: float = Field(ge=0.0, le=360.0)  # Mathematical constraint: degrees in circle
    lead_overlap: float = Field(ge=0.0)  # Upper bound from config
    lead_radius: float = Field(ge=0.05)  # Upper bound from config
    dovetail_settings: DovetailSettingsDTO
    
class IntentParamsDTO(BaseModel):
    """Parameters for a single audio intent (speech or music)."""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    binning_mode: Literal["mean_abs", "min_max", "continuous"]
    filter_candidates: List[float]
    fallback_filter: float = Field(ge=0.0, le=1.0)
    fallback_exponent: float = Field(ge=0.1, le=2.0)
    exponent_candidates: List[float]
    remove_silence: bool
    silence_duration: float = Field(ge=0.1)


class IntentDefaultsDTO(BaseModel):
    """Intent-driven audio processing configuration."""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    speech: IntentParamsDTO
    music: IntentParamsDTO   


# Audio Processing DTOs
class AudioSourceDTO(BaseModel):
    """Audio source configuration"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    source_file: Optional[str]
    start_time: float = Field(ge=0.0)
    end_time: float = Field(ge=0.0)
    use_stems: bool
    stem_choice: Literal["vocals", "drums", "bass", "other", "no_vocals", "all"]  # Engine-fixed: Demucs outputs


class AudioProcessingDTO(BaseModel):
    """Audio processing parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    target_sample_rate: Optional[int] = Field(default=None)
    num_raw_samples: int = Field(ge=1)  # Upper bound from config
    filter_amount: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    apply_filter: bool
    binning_method: Literal["mean", "max", "rms"]  # Engine-fixed: statistical algorithms
    binning_mode: Literal["mean_abs", "min_max", "continuous"]  # Engine-fixed: algorithm implementations
    remove_silence: bool
    silence_threshold: int = Field(ge=-80, le=0)  # dB scale: mathematical constraint
    silence_duration: float = Field(ge=0.1)  # Upper bound from config
    silence_frame_length: int = Field(default=2048, ge=1)  # Upper bound from config
    silence_hop_length: int = Field(default=512, ge=1)  # Upper bound from config
    demucs_silence_threshold: float = Field(default=-35.0, ge=-80, le=0)
    demucs_silence_duration: float = Field(default=0.3, ge=0.1)


# Peak Control DTOs
class PeakControlDTO(BaseModel):
    """Peak detection and control settings"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    method: Literal["clip", "compress", "scale_up", "none"]  # Engine-fixed: audio algorithms
    threshold: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    roll_amount: int
    
    # Individual control toggles
    nudge_enabled: bool
    clip_enabled: bool
    compress_enabled: bool
    scale_enabled: bool
    scale_all_enabled: bool
    manual_enabled: bool
    
    # Control parameters
    clip_percentage: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    compression_exponent: float = Field(ge=0.1)  # Upper bound from config
    threshold_percentage: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    scale_all_percentage: float = Field(ge=0.1)  # Upper bound from config
    manual_slot: int = Field(ge=0)  # Upper bound from number_slots
    manual_value: float  # No constraints - allows any adjustment


# Visual Correction DTOs
class VisualCorrectionDTO(BaseModel):
    """Visual correction parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    apply_correction: bool
    correction_scale: float = Field(ge=0.0)  # Upper bound from config
    correction_mode: Literal["nudge_adj", "center_adj"]  # Engine-fixed: algorithm implementations
    
    @model_validator(mode='before')
    @classmethod
    def normalize_correction_mode(cls, data: Any) -> Any:
        """Normalize legacy correction_mode variants to canonical form."""
        if isinstance(data, dict) and 'correction_mode' in data:
            mode = data['correction_mode'].lower().replace(" ", "_")
            data = {**data, 'correction_mode': mode}  # Immutable update
        return data


# Display Settings DTOs
class DisplaySettingsDTO(BaseModel):
    """Display and visualization settings"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    show_debug_circle: bool
    debug_circle_radius: float = Field(ge=0.1)  # Upper bound from config
    show_labels: bool
    show_offsets: bool


# Export Settings DTOs
class ExportSettingsDTO(BaseModel):
    """Export configuration for various formats"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    cnc_margin: float = Field(ge=0.0)  # Upper bound from constraints.json
    sections_in_sheet: int = Field(ge=1)  # Upper bound from config


# Artistic Rendering DTOs
class ColorPaletteDTO(BaseModel):
    """Color palette definition"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    color_deep: List[float]
    color_mid: List[float]
    color_light: List[float]
    paper_color: List[float]


class WatercolorSettingsDTO(BaseModel):
    """Watercolor style parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    wetness: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    pigment_load: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    paper_roughness: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    bleed_amount: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    granulation: float = Field(ge=0.0, le=1.0)  # Normalized 0-1


class OilSettingsDTO(BaseModel):
    """Oil painting style parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    brush_size: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    impasto: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    brush_texture: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    color_mixing: float = Field(ge=0.0, le=1.0)  # Normalized 0-1


class InkSettingsDTO(BaseModel):
    """Ink style parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    ink_flow: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    ink_density: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    edge_darkening: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    dryness: float = Field(ge=0.0, le=1.0)  # Normalized 0-1


class PhysicalSimulationDTO(BaseModel):
    """Physical paint simulation parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    brush_pressure: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    paint_thickness: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    drying_time: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    medium_viscosity: float = Field(ge=0.0, le=1.0)  # Normalized 0-1


class NoiseSettingsDTO(BaseModel):
    """Noise texture settings"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    noise_scale: float = Field(ge=1.0)  # Upper bound from config
    noise_octaves: float = Field(ge=1.0)  # Upper bound from config
    noise_seed: float = Field(ge=0.0)  # Upper bound from config
    flow_speed: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    flow_direction: float = Field(ge=-1.0, le=1.0)  # Normalized -1 to 1


class ArtisticRenderingDTO(BaseModel):
    """Artistic rendering parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    artistic_style: Literal["watercolor", "oil", "ink"]  # Engine-fixed: shader implementations
    color_palette: str  # Validated against color_palettes keys in composition_defaults.json
    
    # Common artistic parameters
    opacity: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    artistic_intensity: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    amplitude_effects: str
    amplitude_influence: float = Field(ge=0.0)  # Upper bound from config
    
    # Style-specific settings
    watercolor_settings: WatercolorSettingsDTO
    oil_settings: OilSettingsDTO
    ink_settings: InkSettingsDTO
    
    # Physical simulation
    physical_simulation: PhysicalSimulationDTO
    
    # Noise settings
    noise_settings: NoiseSettingsDTO
    
    # Color palettes
    color_palettes: Dict[str, ColorPaletteDTO]


# Main Composition State DTO
class CompositionStateDTO(BaseModel):
    """Complete state of a WaveDesigner composition"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    frame_design: FrameDesignDTO
    pattern_settings: PatternSettingsDTO
    audio_source: AudioSourceDTO
    audio_processing: AudioProcessingDTO
    peak_control: PeakControlDTO
    visual_correction: VisualCorrectionDTO
    display_settings: DisplaySettingsDTO
    export_settings: ExportSettingsDTO
    artistic_rendering: ArtisticRenderingDTO
    processed_amplitudes: List[float]


# Geometry Result DTO
class GeometryResultDTO(BaseModel):
    """Results from geometry calculations."""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    # Basic configuration
    shape: str
    numberSections: int
    num_slots: int
    slotsInSection: int
    bit_diameter: float
    grainAngle: float
    
    # Global geometry
    radius: float
    original_center_x: float
    original_center_y: float
    
    # Local geometry
    section_local_centers: List[Tuple[float, float]]
    reference_angles: List[float]
    slot_angle_deg: float
    theta_unit_deg: float
    
    # Radius calculations
    true_min_radius: float
    min_radius_local: float
    max_radius_local: float
    circum_radius: float
    min_radius_from_V_calc: float
    
    # Amplitude and center point
    center_point_local: float
    max_amplitude_local: float
    global_amplitude_scale_factor: float