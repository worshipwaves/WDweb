# tests/test_audio_processing.py

"""
Test suite for verifying the ported audio processing functions
maintain exact parity with the PyQt implementation.
"""

import json
import pytest
import numpy as np
from pathlib import Path

from services.audio_processing_service import AudioProcessingService, BinningMode
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


class TestAudioProcessingService:
    """Test the ported audio processing functions."""
    
    @pytest.fixture
    def audio_service(self):
        """Create audio processing service instance."""
        return AudioProcessingService()
    
    @pytest.fixture
    def test_state(self):
        """Create test composition state with all required fields."""
        return CompositionStateDTO(
            frame_design=FrameDesignDTO(
                shape="circular",
                frame_orientation="vertical",
                finish_x=36.0,
                finish_y=36.0,
                finish_z=0.5,
                number_sections=2,
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
            audio_source=AudioSourceDTO(
                source_file=None,
                start_time=0.0,
                end_time=0.0,
                use_stems=False,
                stem_choice="all"
            ),
            audio_processing=AudioProcessingDTO(
                num_raw_samples=200000,
                filter_amount=0.05,
                apply_filter=False,
                binning_method="mean",
                binning_mode="mean_abs",
                remove_silence=False,
                silence_threshold=-20,
                silence_duration=0.5
            ),
            peak_control=PeakControlDTO(
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
            ),
            visual_correction=VisualCorrectionDTO(
                apply_correction=True,
                correction_scale=1.0,
                correction_mode="nudge_adj"
            ),
            display_settings=DisplaySettingsDTO(
                show_debug_circle=False,
                debug_circle_radius=1.5,
                show_labels=False,
                show_offsets=False
            ),
            export_settings=ExportSettingsDTO(
                cnc_margin=1.0,
                sections_in_sheet=1
            ),
            artistic_rendering=ArtisticRenderingDTO(
                artistic_style="watercolor",
                color_palette="ocean",
                opacity=0.7,
                artistic_intensity=0.5,
                amplitude_effects="wave",
                amplitude_influence=1.0,
                watercolor_settings=WatercolorSettingsDTO(
                    wetness=0.5,
                    pigment_load=0.5,
                    paper_roughness=0.5,
                    bleed_amount=0.3,
                    granulation=0.5
                ),
                oil_settings=OilSettingsDTO(
                    brush_size=0.5,
                    impasto=0.5,
                    brush_texture=0.5,
                    color_mixing=0.5
                ),
                ink_settings=InkSettingsDTO(
                    ink_flow=0.5,
                    ink_density=0.5,
                    edge_darkening=0.5,
                    dryness=0.5
                ),
                physical_simulation=PhysicalSimulationDTO(
                    brush_pressure=0.5,
                    paint_thickness=0.5,
                    drying_time=0.5,
                    medium_viscosity=0.5
                ),
                noise_settings=NoiseSettingsDTO(
                    noise_scale=1.0,
                    noise_octaves=4,
                    noise_intensity=0.5,
                    noise_persistence=0.5,
                    noise_lacunarity=2.0,
                    noise_seed=0.0,
                    flow_speed=0.1,
                    flow_direction=0.0
                ),
                color_palettes={}
            ),
            processed_amplitudes=[]
        )
    
    def test_extract_amplitudes_basic(self, audio_service):
        """Test basic amplitude extraction."""
        # Create test signal
        samples = np.sin(np.linspace(0, 10*np.pi, 1000))
        
        # Extract to 200 samples
        result = audio_service.extract_amplitudes(samples, 200)
        
        assert len(result) == 200
        assert np.abs(result).max() <= 1.0  # Normalized
        assert result.min() >= -1.0
        assert result.max() <= 1.0
    
    def test_extract_amplitudes_mono_conversion(self, audio_service):
        """Test stereo to mono conversion."""
        # Create stereo signal
        stereo = np.array([
            [1.0, 0.5],
            [0.8, 0.6],
            [0.6, 0.4],
            [0.4, 0.2]
        ])
        
        result = audio_service.extract_amplitudes(stereo, 4)
        
        # Should be average of channels, then normalized
        expected = np.array([0.75, 0.7, 0.5, 0.3])
        expected = expected / np.max(np.abs(expected))
        np.testing.assert_allclose(result, expected, rtol=1e-10)
    
    def test_bin_amplitudes_mean_absolute(self, audio_service):
        """Test MEAN_ABSOLUTE binning mode with normalization."""
        # Create test signal with known pattern
        amplitudes = np.array([1, -1, 1, -1, 0.5, -0.5, 0.5, -0.5])
        
        min_binned, max_binned = audio_service.bin_amplitudes(
            amplitudes, 4, BinningMode.MEAN_ABSOLUTE
        )
        
        # MEAN_ABSOLUTE should be symmetric
        assert len(min_binned) == 4
        assert len(max_binned) == 4
        np.testing.assert_array_equal(min_binned, -max_binned)
        
        # After normalization
        assert np.max(max_binned) == 1.0
        np.testing.assert_allclose(max_binned, [1.0, 1.0, 0.5, 0.5], rtol=1e-10)
    
    def test_bin_amplitudes_min_max(self, audio_service):
        """Test MIN_MAX binning mode with normalization."""
        amplitudes = np.array([1, -0.5, 0.8, -0.3, 0.6, -0.1, 0.4, 0.2])
        
        min_binned, max_binned = audio_service.bin_amplitudes(
            amplitudes, 4, BinningMode.MIN_MAX
        )
        
        # Values normalized by max absolute value (1.0)
        np.testing.assert_allclose(min_binned[0], -0.5, rtol=1e-10)
        np.testing.assert_allclose(max_binned[0], 1.0, rtol=1e-10)
        np.testing.assert_allclose(min_binned[1], -0.3, rtol=1e-10)
        np.testing.assert_allclose(max_binned[1], 0.8, rtol=1e-10)
    
    def test_bin_amplitudes_continuous(self, audio_service):
        """Test CONTINUOUS binning mode."""
        # Linear ramp for easy verification
        amplitudes = np.linspace(-1, 1, 100)
        
        min_binned, max_binned = audio_service.bin_amplitudes(
            amplitudes, 10, BinningMode.CONTINUOUS
        )
        
        # Should resample to 10 values
        assert len(min_binned) == 10
        assert len(max_binned) == 10
        
        # First half should have negative values in min array
        assert all(min_binned[i] < 0 for i in range(5))
        # Second half should have positive values in max array  
        assert all(max_binned[i] > 0 for i in range(5, 10))
    
    def test_calculate_geometries_core_single_section(self, audio_service, test_state):
        """Test geometry calculation for single section."""
        # Create new state with number_sections=1
        state_n1 = test_state.model_copy(update={
            'frame_design': test_state.frame_design.model_copy(update={'number_sections': 1})
        })
        
        result = audio_service.calculate_geometries_core(state_n1)
        
        assert result["numberSections"] == 1
        assert result["radius"] == 18.0
        assert result["slotsInSection"] == 48
        assert len(result["section_local_centers"]) == 1
        assert result["section_local_centers"][0] == (18.0, 18.0)
        assert "max_amplitude_local" in result
        assert result["max_amplitude_local"] > 0
    
    def test_calculate_geometries_core_two_sections(self, audio_service, test_state):
        """Test geometry calculation for two sections."""
        result = audio_service.calculate_geometries_core(test_state)
        
        assert result["numberSections"] == 2
        assert result["slotsInSection"] == 24
        assert len(result["section_local_centers"]) == 2
        
        centers = result["section_local_centers"]
        assert centers[0][0] > 18.0  # Right of center
        assert centers[1][0] < 18.0  # Left of center
        assert centers[0][1] == centers[1][1] == 18.0  # Same Y
        
        assert "true_min_radius" in result
        assert result["true_min_radius"] > 0
    
    def test_calculate_geometries_core_three_sections(self, audio_service, test_state):
        """Test geometry calculation for three sections in triangle."""
        # Create new state with number_sections=3 and num_slots=72
        state_n3 = test_state.model_copy(update={
            'frame_design': test_state.frame_design.model_copy(update={'number_sections': 3}),
            'pattern_settings': test_state.pattern_settings.model_copy(update={'number_slots': 72})
        })
        
        result = audio_service.calculate_geometries_core(state_n3)
        
        assert result["numberSections"] == 3
        assert result["slotsInSection"] == 24
        assert len(result["section_local_centers"]) == 3
        
        centers = result["section_local_centers"]
        assert centers[0][1] > 18.0  # Top center above middle
        assert centers[1][1] < 18.0  # Bottom two below
        assert centers[2][1] < 18.0
        
        assert result["max_amplitude_local"] > 0
        assert result["slot_angle_deg"] == pytest.approx(360.0 / 72, rel=1e-10)
    
    def test_calculate_auto_roll_n3(self, audio_service):
        """Test auto-roll calculation for n=3 sections."""
        roll = audio_service.calculate_auto_roll_for_sections(3, 72)
        assert roll == 12  # slots_in_section // 2 = 24 // 2
    
    def test_calculate_auto_roll_other_sections(self, audio_service):
        """Test auto-roll returns 0 for non-n=3."""
        assert audio_service.calculate_auto_roll_for_sections(1, 48) == 0
        assert audio_service.calculate_auto_roll_for_sections(2, 48) == 0
        assert audio_service.calculate_auto_roll_for_sections(4, 48) == 0
    
    def test_v_point_calculations(self, audio_service, test_state):
        """Test that V-point calculations are performed correctly."""
        result = audio_service.calculate_geometries_core(test_state)
        
        # V-point specific values should exist
        assert "circum_radius" in result
        assert "min_radius_from_V_calc" in result
        assert "center_point_local" in result
        assert "max_amplitude_local" in result
        
        # Verify the relationship accounts for bit chord constraint
        circum_radius = result["circum_radius"]
        min_radius_from_V = result["min_radius_from_V_calc"]
        true_min_radius = result["true_min_radius"]
        bit_diameter = test_state.pattern_settings.bit_diameter
        slot_angle_deg = result["slot_angle_deg"]
        half_slot_angle_rad = np.radians(slot_angle_deg / 2.0)
        
        # Calculate the constraint
        min_r_v_for_bit_chord = (bit_diameter / 2.0) / np.sin(half_slot_angle_rad)
        min_r_v_for_bit_chord = max(min_r_v_for_bit_chord, 1e-6)
        
        # Expected value considering the constraint
        expected_min_from_v = true_min_radius - circum_radius
        if expected_min_from_v < min_r_v_for_bit_chord:
            expected_min_from_v = min_r_v_for_bit_chord
        
        np.testing.assert_allclose(
            min_radius_from_V,
            expected_min_from_v,
            rtol=1e-10,
            atol=1e-10
        )
    
    @pytest.mark.parametrize("number_sections,num_slots", [
        (1, 48),
        (2, 48),
        (3, 72),
        (4, 96)
    ])
    def test_max_amplitude_local_positive(self, audio_service, test_state, number_sections, num_slots):
        """Test that max_amplitude_local is always positive and reasonable."""
        # Create new state with parametrized values
        updated_state = test_state.model_copy(update={
            'frame_design': test_state.frame_design.model_copy(update={'number_sections': number_sections}),
            'pattern_settings': test_state.pattern_settings.model_copy(update={'number_slots': num_slots})
        })
        
        result = audio_service.calculate_geometries_core(updated_state)
        
        assert result["max_amplitude_local"] > 0
        assert result["max_amplitude_local"] < result["radius"]