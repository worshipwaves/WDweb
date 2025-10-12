"""Helper functions for creating test DTOs with all required fields."""
from services.dtos import (
    CompositionStateDTO, FrameDesignDTO, PatternSettingsDTO,
    AudioSourceDTO, AudioProcessingDTO, PeakControlDTO,
    VisualCorrectionDTO, DisplaySettingsDTO, ExportSettingsDTO,
    ArtisticRenderingDTO, DovetailSettingsDTO
)

def create_minimal_frame_design(**kwargs):
    """Create FrameDesignDTO with defaults, allowing overrides."""
    defaults = {
        'shape': 'circular',
        'frame_orientation': 'vertical', 
        'finish_x': 36.0,
        'finish_y': 36.0,
        'finish_z': 0.5,
        'number_sections': 2,
        'separation': 2.0,
        'species': 'maple',
        'material_thickness': 0.375
    }
    defaults.update(kwargs)
    return FrameDesignDTO(**defaults)

def create_minimal_pattern_settings(**kwargs):
    """Create PatternSettingsDTO with defaults, allowing overrides."""
    defaults = {
        'slot_style': 'radial',
        'number_slots': 48,
        'bit_diameter': 0.25,
        'spacer': 0.5,
        'x_offset': 0.75,
        'y_offset': 1.5,
        'scale_center_point': 1.0,
        'amplitude_exponent': 1.0,
        'orientation': 'auto',
        'grain_angle': 90.0,
        'lead_overlap': 0.25,
        'lead_radius': 0.25,
        'dovetail_settings': DovetailSettingsDTO(
            generate_dovetails=False,
            show_dovetails=False,
            dovetail_inset=0.0625,
            dovetail_cut_direction='climb',
            dovetail_edge_default=0,
            dovetail_edge_overrides='{}'
        )
    }
    defaults.update(kwargs)
    return PatternSettingsDTO(**defaults)

def create_minimal_composition_state(**kwargs):
    """Create CompositionStateDTO with all required fields."""
    defaults = {
        'frame_design': create_minimal_frame_design(),
        'pattern_settings': create_minimal_pattern_settings(),
        'audio_source': AudioSourceDTO(),
        'audio_processing': AudioProcessingDTO(),
        'peak_control': PeakControlDTO(),
        'visual_correction': VisualCorrectionDTO(),
        'display_settings': DisplaySettingsDTO(),
        'export_settings': ExportSettingsDTO(),
        'artistic_rendering': ArtisticRenderingDTO(),
        'processed_amplitudes': []
    }
    defaults.update(kwargs)
    return CompositionStateDTO(**defaults)