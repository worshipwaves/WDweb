#!/usr/bin/env python3
"""
Web App Geometry Pipeline Diagnostic Script
Purpose: Generate step-by-step JSON metrics for parity comparison with PyQt App.

Usage: python diagnostic_geometry_web.py [--config CONFIG_JSON]

Tests multiple geometry configurations and outputs max_amplitude_local calculations.
"""

import sys
import os
import json
import argparse

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from services.geometry_service import GeometryService, calculate_geometries_core
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
)


def create_test_state(
    shape="circular",
    finish_x=36.0,
    finish_y=36.0,
    number_sections=2,
    separation=2.0,
    slot_style="radial",
    number_slots=60,
    bit_diameter=0.25,
    spacer=0.5,
    x_offset=0.75,
    y_offset=1.5,
    side_margin=0.0,
    grain_angle=90.0,
    scale_center_point=1.0,
):
    """Create a minimal CompositionStateDTO for geometry testing."""
    
    frame_design = FrameDesignDTO(
        shape=shape,
        frame_orientation="vertical",
        finish_x=finish_x,
        finish_y=finish_y,
        finish_z=0.375,
        number_sections=number_sections,
        separation=separation,
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
        slot_style=slot_style,
        pattern_diameter=finish_x,
        number_slots=number_slots,
        bit_diameter=bit_diameter,
        spacer=spacer,
        x_offset=x_offset,
        y_offset=y_offset,
        side_margin=side_margin,
        scale_center_point=scale_center_point,
        amplitude_exponent=1.0,
        orientation="auto",
        grain_angle=grain_angle,
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
    
    display_settings = DisplaySettingsDTO(
        show_labels=False,
        show_offsets=False,
        show_debug_circle=False
    )
    
    export_settings = ExportSettingsDTO(
        format="dxf",
        include_reference=True,
        units="inches"
    )
    
    artistic_rendering = ArtisticRenderingDTO(
        palette_id="ocean",
        render_style="watercolor",
        background_color=[1.0, 1.0, 1.0, 1.0]
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


def get_geometry_metrics(config_name, state):
    """Calculate geometry and return metrics dict."""
    geometry = calculate_geometries_core(state)
    
    return {
        "config": config_name,
        "inputs": {
            "shape": state.frame_design.shape,
            "finish_x": state.frame_design.finish_x,
            "finish_y": state.frame_design.finish_y,
            "number_sections": state.frame_design.number_sections,
            "separation": state.frame_design.separation,
            "slot_style": state.pattern_settings.slot_style,
            "number_slots": state.pattern_settings.number_slots,
            "bit_diameter": state.pattern_settings.bit_diameter,
            "spacer": state.pattern_settings.spacer,
            "x_offset": state.pattern_settings.x_offset,
            "y_offset": state.pattern_settings.y_offset,
            "side_margin": state.pattern_settings.side_margin,
            "grain_angle": state.pattern_settings.grain_angle,
            "scale_center_point": state.pattern_settings.scale_center_point,
        },
        "outputs": {
            "max_amplitude_local": float(geometry.max_amplitude_local),
            "center_point_local": float(geometry.center_point_local),
            "true_min_radius": float(geometry.true_min_radius),
            "min_radius_local": float(geometry.min_radius_local),
            "max_radius_local": float(geometry.max_radius_local),
            "circum_radius": float(geometry.circum_radius),
            "min_radius_from_V_calc": float(geometry.min_radius_from_V_calc),
            "slot_angle_deg": float(geometry.slot_angle_deg),
            "slots_in_section": int(geometry.slotsInSection),
            "radius": float(geometry.radius),
        }
    }


def run_standard_tests():
    """Run standard geometry test configurations."""
    
    test_configs = [
        # Circular radial - most common
        {"name": "circular_radial_n2_60slots", "shape": "circular", "slot_style": "radial", 
         "finish_x": 36.0, "finish_y": 36.0, "number_sections": 2, "number_slots": 60},
        
        # Circular radial - different sizes
        {"name": "circular_radial_n2_48slots", "shape": "circular", "slot_style": "radial",
         "finish_x": 30.0, "finish_y": 30.0, "number_sections": 2, "number_slots": 48},
        
        # Circular radial - n=3
        {"name": "circular_radial_n3_60slots", "shape": "circular", "slot_style": "radial",
         "finish_x": 36.0, "finish_y": 36.0, "number_sections": 3, "number_slots": 60},
        
        # Circular radial - n=4
        {"name": "circular_radial_n4_60slots", "shape": "circular", "slot_style": "radial",
         "finish_x": 36.0, "finish_y": 36.0, "number_sections": 4, "number_slots": 60},
        
        # Circular linear
        {"name": "circular_linear_n2_60slots", "shape": "circular", "slot_style": "linear",
         "finish_x": 36.0, "finish_y": 36.0, "number_sections": 2, "number_slots": 60,
         "side_margin": 1.0},
        
        # Rectangular radial
        {"name": "rectangular_radial_n2_60slots", "shape": "rectangular", "slot_style": "radial",
         "finish_x": 48.0, "finish_y": 24.0, "number_sections": 2, "number_slots": 60},
        
        # Rectangular linear
        {"name": "rectangular_linear_n2_60slots", "shape": "rectangular", "slot_style": "linear",
         "finish_x": 48.0, "finish_y": 24.0, "number_sections": 2, "number_slots": 60,
         "side_margin": 1.0},
        
        # Diamond radial
        {"name": "diamond_radial_n2_60slots", "shape": "diamond", "slot_style": "radial",
         "finish_x": 36.0, "finish_y": 36.0, "number_sections": 2, "number_slots": 60},
        
        # Different bit diameters
        {"name": "circular_radial_bit0.125", "shape": "circular", "slot_style": "radial",
         "finish_x": 36.0, "finish_y": 36.0, "number_sections": 2, "number_slots": 60,
         "bit_diameter": 0.125},
        
        {"name": "circular_radial_bit0.375", "shape": "circular", "slot_style": "radial",
         "finish_x": 36.0, "finish_y": 36.0, "number_sections": 2, "number_slots": 60,
         "bit_diameter": 0.375},
        
        # Different scale_center_point
        {"name": "circular_radial_scp0.8", "shape": "circular", "slot_style": "radial",
         "finish_x": 36.0, "finish_y": 36.0, "number_sections": 2, "number_slots": 60,
         "scale_center_point": 0.8},
        
        {"name": "circular_radial_scp1.2", "shape": "circular", "slot_style": "radial",
         "finish_x": 36.0, "finish_y": 36.0, "number_sections": 2, "number_slots": 60,
         "scale_center_point": 1.2},
    ]
    
    for config in test_configs:
        name = config.pop("name")
        
        # Set defaults
        params = {
            "shape": "circular",
            "finish_x": 36.0,
            "finish_y": 36.0,
            "number_sections": 2,
            "separation": 2.0,
            "slot_style": "radial",
            "number_slots": 60,
            "bit_diameter": 0.25,
            "spacer": 0.5,
            "x_offset": 0.75,
            "y_offset": 1.5,
            "side_margin": 0.0,
            "grain_angle": 90.0,
            "scale_center_point": 1.0,
        }
        params.update(config)
        
        state = create_test_state(**params)
        metrics = get_geometry_metrics(name, state)
        print(json.dumps(metrics))


def run_custom_test(config_path):
    """Run test from custom JSON config file."""
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    name = config.get("name", "custom")
    params = {k: v for k, v in config.items() if k != "name"}
    
    state = create_test_state(**params)
    metrics = get_geometry_metrics(name, state)
    print(json.dumps(metrics))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Web App Geometry Diagnostic")
    parser.add_argument("--config", help="Path to custom JSON config file")
    
    args = parser.parse_args()
    
    try:
        if args.config:
            run_custom_test(args.config)
        else:
            run_standard_tests()
    except Exception as e:
        print(json.dumps({"error": str(e), "stage": "failed"}))
        sys.exit(1)
