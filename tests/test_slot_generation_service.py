# tests/test_slot_generation_service.py

import json
import pytest
import numpy as np
from pathlib import Path

# Import all required DTOs
from services.dtos import (
    FrameDesignDTO,
    PatternSettingsDTO,
    CompositionStateDTO,
    AudioSourceDTO,
    AudioProcessingDTO,
    PeakControlDTO,
    VisualCorrectionDTO,
    DisplaySettingsDTO,
    ExportSettingsDTO,
    ArtisticRenderingDTO,
)
from services.slot_generation_service import SlotGenerationService
from services.audio_processing_service import AudioProcessingService


@pytest.fixture
def create_test_state():
    """Factory fixture for creating test CompositionStateDTO with amplitudes."""
    # Load test parameters
    test_params_path = Path(__file__).parent / "TEST_KingOfKingsChorus_C2R48_20250914_1218.txt"
    with open(test_params_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    params = data["parameters"]
    processed_amplitudes = data.get("processed_amplitudes", [])
    
    def _factory(number_sections: int):
        """Create a CompositionStateDTO with specified number_sections."""
        frame_design = FrameDesignDTO(
            shape=params["Design.Shape"],
            frame_orientation=params.get("Design.FrameOrientation", "vertical"),
            finish_x=float(params["Design.FinishX"]),
            finish_y=float(params["Design.FinishY"]),
            finish_z=float(params.get("Design.FinishZ", 0.5)),
            number_sections=number_sections,  # Use parametrized value
            separation=float(params["Design.Separation"]),
            species=params["Design.Species"],
            material_thickness=0.375
        )
        
        pattern_settings = PatternSettingsDTO(
            slot_style=params["Pattern.SlotStyle"],
            number_slots=int(params["Pattern.NumberSlots"]),
            bit_diameter=float(params["Pattern.BitDiameter"]),
            spacer=float(params["Pattern.Spacer"]),
            x_offset=float(params["Pattern.X_Offset"]),
            y_offset=float(params["Pattern.Y_Offset"]),
            scale_center_point=float(params["Pattern.ScaleCenterPoint"]),
            amplitude_exponent=float(params["Pattern.AmplitudeExponent"]),
            orientation=params["Pattern.Orientation"],
            grain_angle=float(params["Pattern.GrainAngle"]),
            lead_overlap=float(params["Pattern.LeadOverlap"]),
            lead_radius=float(params["Pattern.LeadRadius"]),
        )
        
        visual_correction = VisualCorrectionDTO(
            apply_correction=params["Visual.ApplyCorrection"],
            correction_scale=float(params["Visual.CorrectionScale"]),
            correction_mode=params["Visual.CorrectionMode"],
        )
        
        # Create the initial state
        initial_state = CompositionStateDTO(
            frame_design=frame_design,
            pattern_settings=pattern_settings,
            audio_source=AudioSourceDTO(),
            audio_processing=AudioProcessingDTO(),
            peak_control=PeakControlDTO(),
            visual_correction=visual_correction,
            display_settings=DisplaySettingsDTO(),
            export_settings=ExportSettingsDTO(),
            artistic_rendering=ArtisticRenderingDTO(),
        )
        
        # Use model_copy to add the processed amplitudes
        state_with_amplitudes = initial_state.model_copy(
            update={"processed_amplitudes": processed_amplitudes}
        )
        
        return state_with_amplitudes
    
    return _factory


@pytest.mark.parametrize("number_sections", [2, 3, 4])
def test_create_slots(number_sections, create_test_state):
    """Test that slot generation matches the golden master data for each section count."""
    # Load the appropriate golden master file
    golden_master_path = Path(f"golden_master_slots_n{number_sections}.json")
    with open(golden_master_path, "r", encoding="utf-8") as f:
        golden_master_slots = json.load(f)
    
    # Create test state with specified number_sections
    state = create_test_state(number_sections)
    
    # Create service and generate slots
    audio_service = AudioProcessingService()
    service = SlotGenerationService(audio_service)
    generated_slots = service.create_slots(state=state)
    
    # Verify structure
    assert isinstance(generated_slots, list)
    assert len(generated_slots) == len(golden_master_slots)
    assert len(generated_slots) == 48, f"Should generate 48 slots for n={number_sections}"
    
    # Compare each slot
    for slot_idx, (generated, expected) in enumerate(zip(generated_slots, golden_master_slots)):
        assert isinstance(generated, list), f"Slot {slot_idx} should be a list for n={number_sections}"
        assert len(generated) == len(expected), f"Slot {slot_idx} point count mismatch for n={number_sections}"
        
        # Each slot should have 5 points (closed polygon)
        assert len(generated) == 5, f"Slot {slot_idx} should have 5 points for n={number_sections}"
        
        # Compare each point
        for point_idx, (gen_point, exp_point) in enumerate(zip(generated, expected)):
            np.testing.assert_allclose(
                np.array(gen_point, dtype=float),
                np.array(exp_point, dtype=float),
                rtol=1e-9,
                atol=1e-9,
                err_msg=f"Slot {slot_idx}, point {point_idx} mismatch for n={number_sections}"
            )