"""
Data Transfer Objects (DTOs) for WaveDesigner
Following Pragmatic Immutability principle - all DTOs are frozen
"""

from typing import List, Dict, Optional, Literal, Tuple, Any
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
    """Wood materials configuration from default_parameters.json."""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    default_species: str
    default_grain_direction: Literal["horizontal", "vertical", "radiant"]
    species_catalog: List[SpeciesCatalogItemDTO]
    texture_config: Dict[str, Any]
    rendering_config: Dict[str, float]
    geometry_constants: Dict[str, Dict[str, List[int]]]

# Material Configuration DTOs
class SectionMaterialDTO(BaseModel):
    """Material settings for individual sections."""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    section_id: int = Field(ge=0, le=3)
    species: str
    grain_direction: Literal["horizontal", "vertical", "radiant", "diamond"]
    
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
    type: Literal["acrylic", "cloth", "leather", "foam"]
    material: str
    inset: float = Field(ge=0.0, le=2.0)  
    
# Frame and Physical Design DTOs
class FrameDesignDTO(BaseModel):
    """Frame design parameters for the physical panel."""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    shape: Literal["circular", "rectangular", "diamond"]
    frame_orientation: Literal["vertical", "horizontal"]
    finish_x: float = Field(ge=1.0, le=100.0)
    finish_y: float = Field(ge=1.0, le=100.0)
    finish_z: float = Field(ge=0.1, le=5.0)
    number_sections: int = Field(ge=1, le=4)
    separation: float = Field(ge=0.0, le=10.0)
    species: str
    material_thickness: float = Field(ge=0.1, le=2.0)
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
    dovetail_inset: float = Field(ge=0.01, le=0.5)
    dovetail_cut_direction: Literal["climb", "conventional"]
    dovetail_edge_default: int = Field(ge=0, le=3)
    dovetail_edge_overrides: str  # JSON string of overrides


class PatternSettingsDTO(BaseModel):
    """Slot pattern configuration"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    slot_style: Literal["radial", "linear", "sunburst"]
    pattern_diameter: float = Field(default=36.0, ge=1.0, le=100.0)
    number_slots: int = Field(ge=1, le=3000)
    bit_diameter: float = Field(ge=0.0, le=2.0)
    spacer: float = Field(ge=0.0, le=10.0)
    x_offset: float = Field(ge=0.0, le=10.0)
    y_offset: float = Field(ge=0.0, le=10.0)
    side_margin: float = Field(ge=0.0, le=100.0)
    scale_center_point: float = Field(ge=0.1, le=10.0)
    amplitude_exponent: float = Field(ge=0.25, le=4.0)
    orientation: Literal["auto", "horizontal", "vertical"]
    grain_angle: float = Field(ge=0.0, le=360.0)
    lead_overlap: float = Field(ge=0.0, le=2.0)
    lead_radius: float = Field(ge=0.05, le=1.0)
    dovetail_settings: DovetailSettingsDTO


# Audio Processing DTOs
class AudioSourceDTO(BaseModel):
    """Audio source configuration"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    source_file: Optional[str]
    start_time: float = Field(ge=0.0, le=9999.0)
    end_time: float = Field(ge=0.0, le=9999.0)
    use_stems: bool
    stem_choice: Literal["vocals", "drums", "bass", "other", "no_vocals", "all"]


class AudioProcessingDTO(BaseModel):
    """Audio processing parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    num_raw_samples: int = Field(ge=50000, le=1000000)
    filter_amount: float = Field(ge=0.0, le=0.5)
    apply_filter: bool
    binning_method: Literal["mean", "max", "rms"]
    binning_mode: Literal["mean_abs", "min_max", "continuous"]
    remove_silence: bool
    silence_threshold: int = Field(ge=-80, le=0)
    silence_duration: float = Field(ge=0.1, le=10.0)


# Peak Control DTOs
class PeakControlDTO(BaseModel):
    """Peak detection and control settings"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    method: Literal["clip", "compress", "scale_up", "none"]
    threshold: float = Field(ge=0.1, le=1.0)
    roll_amount: int
    
    # Individual control toggles
    nudge_enabled: bool
    clip_enabled: bool
    compress_enabled: bool
    scale_enabled: bool
    scale_all_enabled: bool
    manual_enabled: bool
    
    # Control parameters
    clip_percentage: float = Field(ge=0.1, le=1.0)
    compression_exponent: float = Field(ge=0.1, le=1.0)
    threshold_percentage: float = Field(ge=0.1, le=1.0)
    scale_all_percentage: float = Field(ge=0.1, le=2.0)
    manual_slot: int = Field(ge=0, le=1000)
    manual_value: float = Field(ge=-1000.0, le=1000.0)


# Visual Correction DTOs
class VisualCorrectionDTO(BaseModel):
    """Visual correction parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    apply_correction: bool
    correction_scale: float = Field(ge=0.0, le=5.0)
    correction_mode: Literal["nudge_adj", "center_adj", "Nudge Adj", 
                            "Center Adj", "Nudge_Adj", "Center_Adj"]


# Display Settings DTOs
class DisplaySettingsDTO(BaseModel):
    """Display and visualization settings"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    show_debug_circle: bool
    debug_circle_radius: float = Field(ge=0.1, le=100.0)
    show_labels: bool
    show_offsets: bool


# Export Settings DTOs
class ExportSettingsDTO(BaseModel):
    """Export configuration for various formats"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    cnc_margin: float = Field(ge=0.0, le=10.0)
    sections_in_sheet: int = Field(ge=1, le=100)


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
    
    wetness: float = Field(ge=0.3, le=0.9)
    pigment_load: float = Field(ge=0.2, le=1.0)
    paper_roughness: float = Field(ge=0.0, le=0.8)
    bleed_amount: float = Field(ge=0.1, le=0.8)
    granulation: float = Field(ge=0.0, le=0.7)


class OilSettingsDTO(BaseModel):
    """Oil painting style parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    brush_size: float = Field(ge=0.1, le=1.0)
    impasto: float = Field(ge=0.0, le=1.0)
    brush_texture: float = Field(ge=0.0, le=1.0)
    color_mixing: float = Field(ge=0.0, le=1.0)


class InkSettingsDTO(BaseModel):
    """Ink style parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    ink_flow: float = Field(ge=0.0, le=1.0)
    ink_density: float = Field(ge=0.0, le=1.0)
    edge_darkening: float = Field(ge=0.0, le=1.0)
    dryness: float = Field(ge=0.0, le=1.0)


class PhysicalSimulationDTO(BaseModel):
    """Physical paint simulation parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    brush_pressure: float = Field(ge=0.0, le=1.0)
    paint_thickness: float = Field(ge=0.0, le=1.0)
    drying_time: float = Field(ge=0.0, le=1.0)
    medium_viscosity: float = Field(ge=0.0, le=1.0)


class NoiseSettingsDTO(BaseModel):
    """Noise texture settings"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    noise_scale: float = Field(ge=1.0, le=100.0)
    noise_octaves: float = Field(ge=1.0, le=8.0)
    noise_seed: float = Field(ge=0.0, le=100.0)
    flow_speed: float = Field(ge=0.0, le=1.0)
    flow_direction: float = Field(ge=-1.0, le=1.0)


class ArtisticRenderingDTO(BaseModel):
    """Artistic rendering parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    artistic_style: Literal["watercolor", "oil", "ink"]
    color_palette: Literal["ocean", "sunset", "forest", "monochrome"]
    
    # Common artistic parameters
    opacity: float = Field(ge=0.0, le=1.0)
    artistic_intensity: float = Field(ge=0.0, le=1.0)
    amplitude_effects: str
    amplitude_influence: float = Field(ge=0.2, le=1.5)
    
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