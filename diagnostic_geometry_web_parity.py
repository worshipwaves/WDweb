#!/usr/bin/env python3
"""
Web App Geometry Diagnostic - PyQt Parity Test
Matches exact parameters from PyQt's diagnostic_geometry_pyqt.py
Uses actual current DTO schema from services/dtos.py
"""

import sys
import os
import json

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from services.geometry_service import calculate_geometries_core
from services.dtos import (
    CompositionStateDTO,
    FrameDesignDTO,
    PatternSettingsDTO,
    DovetailSettingsDTO,
    AudioSourceDTO,
    AudioProcessingDTO,
    PeakControlDTO,
    VisualCorrectionDTO,
    DisplaySettingsDTO,
    ExportSettingsDTO,
    ArtisticRenderingDTO,
    WatercolorSettingsDTO,
    OilSettingsDTO,
    InkSettingsDTO,
    PhysicalSimulationDTO,
    NoiseSettingsDTO,
)


def create_parity_state():
    """
    Create CompositionStateDTO matching PyQt diagnostic_geometry_pyqt.py params:
    - num_slots: 60
    - numberSections: 2
    - finishX: 36.0
    - finishY: 36.0
    - bitDiameter: 0.25
    - spacer: 0.5
    - xOffset: 0.75
    - yOffset: 1.5
    - separation: 2.0
    - scaleCenterPoint: 1.0
    - grainAngle: 90.0
    - shape: "circular"
    - style: "radial"
    """
    
    frame_design = FrameDesignDTO(
        shape="circular",
        frame_orientation="vertical",
        finish_x=36.0,
        finish_y=36.0,
        finish_z=0.375,
        number_sections=2,
        separation=2.0,
        species="walnut-black-american",
        material_thickness=0.375,
        section_materials=[],
        backing={"enabled": False, "type": "acrylic", "material": "clear", "inset": 0.5}
    )
    
    dovetail_settings = DovetailSettingsDTO(
        generate_dovetails=False,
        show_dovetails=False,
        dovetail_inset=0.0625,
        dovetail_cut_direction="climb",
        dovetail_edge_default=0,
        dovetail_edge_overrides="{}"
    )
    
    pattern_settings = PatternSettingsDTO(
        slot_style="radial",
        pattern_diameter=36.0,
        number_slots=60,
        bit_diameter=0.25,
        spacer=0.5,
        x_offset=0.75,
        y_offset=1.5,
        side_margin=0.0,
        scale_center_point=1.0,
        amplitude_exponent=1.0,
        visual_floor_pct=0.0,
        orientation="auto",
        grain_angle=90.0,
        lead_overlap=0.25,
        lead_radius=0.25,
        dovetail_settings=dovetail_settings
    )
    
    audio_source = AudioSourceDTO(
        source_file=None,
        start_time=0.0,
        end_time=0.0,
        use_stems=False,
        stem_choice="vocals"
    )
    
    audio_processing = AudioProcessingDTO(
        target_sample_rate=44100,
        num_raw_samples=200000,
        filter_amount=0.05,
        apply_filter=False,
        binning_method="mean",
        binning_mode="mean_abs",
        remove_silence=False,
        silence_threshold=-20,
        silence_duration=0.5,
        silence_frame_length=2048,
        silence_hop_length=512,
        demucs_silence_threshold=-35.0,
        demucs_silence_duration=0.3
    )
    
    peak_control = PeakControlDTO(
        method="none",
        threshold=0.8,
        roll_amount=0,
        nudge_enabled=False,
        clip_enabled=False,
        compress_enabled=False,
        scale_enabled=False,
        scale_all_enabled=False,
        manual_enabled=False,
        clip_percentage=0.8,
        compression_exponent=0.75,
        threshold_percentage=0.9,
        scale_all_percentage=1.0,
        manual_slot=0,
        manual_value=1.0
    )
    
    visual_correction = VisualCorrectionDTO(
        apply_correction=True,
        correction_scale=1.0,
        correction_mode="nudge_adj"
    )
    
    # Current schema: show_debug_circle, debug_circle_radius, show_labels, show_offsets
    display_settings = DisplaySettingsDTO(
        show_debug_circle=False,
        debug_circle_radius=1.0,
        show_labels=False,
        show_offsets=False
    )
    
    # Current schema: cnc_margin, sections_in_sheet
    export_settings = ExportSettingsDTO(
        cnc_margin=0.0,
        sections_in_sheet=1
    )
    
    # Current schema artistic rendering with full sub-DTOs
    watercolor_settings = WatercolorSettingsDTO(
        wetness=0.5,
        pigment_load=0.5,
        paper_roughness=0.3,
        bleed_amount=0.5,
        granulation=0.3
    )
    
    oil_settings = OilSettingsDTO(
        brush_size=0.5,
        impasto=0.3,
        brush_texture=0.5,
        color_mixing=0.5
    )
    
    ink_settings = InkSettingsDTO(
        ink_flow=0.5,
        ink_density=0.5,
        edge_darkening=0.3,
        dryness=0.2
    )
    
    physical_simulation = PhysicalSimulationDTO(
        brush_pressure=0.5,
        paint_thickness=0.5,
        drying_time=0.5,
        medium_viscosity=0.5
    )
    
    noise_settings = NoiseSettingsDTO(
        noise_scale=1.0,
        noise_octaves=1.0,
        noise_seed=0.0,
        flow_speed=0.0,
        flow_direction=0.0
    )
    
    artistic_rendering = ArtisticRenderingDTO(
        artistic_style="watercolor",
        color_palette="ocean",
        opacity=1.0,
        artistic_intensity=0.5,
        amplitude_effects="none",
        amplitude_influence=0.0,
        watercolor_settings=watercolor_settings,
        oil_settings=oil_settings,
        ink_settings=ink_settings,
        physical_simulation=physical_simulation,
        noise_settings=noise_settings,
        color_palettes={}
    )
    
    return CompositionStateDTO(
        frame_design=frame_design,
        pattern_settings=pattern_settings,
        audio_source=audio_source,
        audio_processing=audio_processing,
        peak_control=peak_control,
        visual_correction=visual_correction,
        display_settings=display_settings,
        export_settings=export_settings,
        artistic_rendering=artistic_rendering,
        processed_amplitudes=[]
    )


def main():
    state = create_parity_state()
    geometry = calculate_geometries_core(state)
    
    # Output matching PyQt diagnostic format
    result = {
        "true_min_radius": geometry.true_min_radius,
        "max_amplitude_local": geometry.max_amplitude_local,
        "center_point_local": geometry.center_point_local,
        "circum_radius": geometry.circum_radius,
        "min_radius_local": geometry.min_radius_local,
        "max_radius_local": geometry.max_radius_local,
        "min_radius_from_V_calc": geometry.min_radius_from_V_calc,
        "slot_angle_deg": geometry.slot_angle_deg,
        "slots_in_section": geometry.slotsInSection,
        "radius": geometry.radius,
    }
    
    print("GEOMETRY_PARITY_START")
    print(json.dumps(result, indent=2))
    print("GEOMETRY_PARITY_END")


if __name__ == "__main__":
    main()
