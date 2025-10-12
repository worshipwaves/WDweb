# verify_max_amplitude_local.py

import json
import numpy as np
from pathlib import Path
from services.audio_processing_service import AudioProcessingService
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

def main():
    # Load the test data
    test_path = Path("tests/TEST_KingOfKingsChorus_C2R48_20250914_1218.txt")
    with open(test_path, "r") as f:
        data = json.load(f)
    
    params = data["parameters"]
    final_amplitudes = np.array(data["processed_amplitudes"])
    
    # Create state with exact parameters from PyQt
    state = CompositionStateDTO(
        frame_design=FrameDesignDTO(
            shape="circular",
            frame_orientation="vertical",
            finish_x=36.0,
            finish_y=36.0,
            finish_z=0.5,
            number_sections=2,  # n=2 from the file
            separation=2.0,
            species="maple"
        ),
        pattern_settings=PatternSettingsDTO(
            slot_style="radial",
            number_slots=48,
            bit_diameter=0.25,
            spacer=0.5,
            x_offset=0.75,
            y_offset=1.5,
            scale_center_point=1.0,
            amplitude_exponent=1.0,
            orientation="auto",
            grain_angle=90.0,
            lead_overlap=0.25,
            lead_radius=0.25,
            dovetail_settings=DovetailSettingsDTO(
                generate_dovetails=False,
                show_dovetails=False,
                dovetail_inset=0.0625,
                dovetail_cut_direction="climb",
                dovetail_edge_default=0,
                dovetail_edge_overrides="{}"
            )
        ),
        # Add minimal required DTOs
        audio_source=AudioSourceDTO(source_file=None, start_time=0.0, end_time=0.0, use_stems=False, stem_choice="all"),
        audio_processing=AudioProcessingDTO(
            num_raw_samples=200000, filter_amount=0.05, apply_filter=False,
            binning_method="mean", binning_mode="mean_abs", remove_silence=False,
            silence_threshold=-20, silence_duration=0.5
        ),
        peak_control=PeakControlDTO(
            method="none", threshold=0.8, roll_amount=0,
            nudge_enabled=False, clip_enabled=False, compress_enabled=False,
            scale_enabled=False, scale_all_enabled=False, manual_enabled=False,
            clip_percentage=0.8, compression_exponent=0.75, threshold_percentage=0.9,
            scale_all_percentage=1.0, manual_slot=0, manual_value=1.0
        ),
        visual_correction=VisualCorrectionDTO(apply_correction=True, correction_scale=1.0, correction_mode="nudge_adj"),
        display_settings=DisplaySettingsDTO(show_debug_circle=False, debug_circle_radius=1.5, show_labels=False, show_offsets=False),
        export_settings=ExportSettingsDTO(cnc_margin=1.0, sections_in_sheet=1),
        artistic_rendering=ArtisticRenderingDTO(
            artistic_style="watercolor", color_palette="ocean", opacity=0.7,
            artistic_intensity=0.5, amplitude_effects="wave", amplitude_influence=1.0,
            watercolor_settings=WatercolorSettingsDTO(wetness=0.5, pigment_load=0.5, paper_roughness=0.5, bleed_amount=0.3, granulation=0.5),
            oil_settings=OilSettingsDTO(brush_size=0.5, impasto=0.5, brush_texture=0.5, color_mixing=0.5),
            ink_settings=InkSettingsDTO(ink_flow=0.5, ink_density=0.5, edge_darkening=0.5, dryness=0.5),
            physical_simulation=PhysicalSimulationDTO(brush_pressure=0.5, paint_thickness=0.5, drying_time=0.5, medium_viscosity=0.5),
            noise_settings=NoiseSettingsDTO(noise_scale=1.0, noise_octaves=4, noise_intensity=0.5, noise_persistence=0.5,
                                          noise_lacunarity=2.0, noise_seed=0.0, flow_speed=0.1, flow_direction=0.0),
            color_palettes={}
        ),
        processed_amplitudes=[]
    )
    
    # Calculate geometry including max_amplitude_local
    service = AudioProcessingService()
    geometry = service.calculate_geometries_core(state)
    
    our_max_amplitude = geometry["max_amplitude_local"]
    
    print("=" * 60)
    print("MAX_AMPLITUDE_LOCAL VERIFICATION")
    print("=" * 60)
    print(f"Parameters: n={state.frame_design.number_sections}, slots={state.pattern_settings.number_slots}")
    print(f"Our calculated max_amplitude_local: {our_max_amplitude:.10f}")
    
    # The final amplitudes are binned_normalized * max_amplitude_local
    # So binned_normalized = final_amplitudes / max_amplitude_local
    # Since binned values should be normalized to [-1, 1], max should be close to 1.0
    
    print(f"\nFinal amplitude range: [{final_amplitudes.min():.4f}, {final_amplitudes.max():.4f}]")
    
    # Estimate what the normalized binned values would have been
    estimated_binned = final_amplitudes / our_max_amplitude
    print(f"Estimated normalized binned range: [{estimated_binned.min():.4f}, {estimated_binned.max():.4f}]")
    print(f"Max of estimated binned: {estimated_binned.max():.4f} (should be ~1.0 if correct)")
    
    # Check if this makes sense
    if 0.9 < estimated_binned.max() < 1.1:
        print("\n✅ VERIFICATION PASSED: max_amplitude_local appears correct!")
        print("   The normalized binned values peak near 1.0 as expected.")
    else:
        print("\n❌ VERIFICATION FAILED: max_amplitude_local may be incorrect.")
        print(f"   Expected max binned ~1.0, got {estimated_binned.max():.4f}")
    
    # Also calculate for other section counts for reference
    print("\n" + "=" * 60)
    print("REFERENCE VALUES FOR OTHER SECTION COUNTS:")
    print("=" * 60)
    
    for n in [1, 3, 4]:
        state_n = state.model_copy(update={
            'frame_design': state.frame_design.model_copy(update={'number_sections': n}),
            'pattern_settings': state.pattern_settings.model_copy(update={
                'number_slots': 72 if n == 3 else 96 if n == 4 else 48
            })
        })
        geo_n = service.calculate_geometries_core(state_n)
        print(f"n={n}: max_amplitude_local = {geo_n['max_amplitude_local']:.10f}")

if __name__ == "__main__":
    main()