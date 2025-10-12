# tests/test_geometry_service.py

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
    DovetailSettingsDTO,
)
from services.geometry_service import GeometryService


@pytest.fixture
def create_composition_state():
    """Factory fixture for creating CompositionStateDTO with specified number_sections."""
    # Load test parameters once
    test_params_path = Path(__file__).parent / "TEST_KingOfKingsChorus_C2R48_20250914_1218.txt"
    with open(test_params_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    params = data["parameters"]
    
    def _factory(number_sections: int) -> CompositionStateDTO:
        """Create a CompositionStateDTO with the specified number_sections."""
        frame_design = FrameDesignDTO(
            shape=params["Design.Shape"],
            frame_orientation=params.get("Design.FrameOrientation", "vertical"),
            finish_x=float(params["Design.FinishX"]),
            finish_y=float(params["Design.FinishY"]),
            finish_z=float(params.get("Design.FinishZ", 0.5)),
            number_sections=number_sections,
            separation=float(params["Design.Separation"]),
            species=params.get("Design.Species", "maple"),
            material_thickness=0.375
        )
        
        pattern_settings = PatternSettingsDTO(
            slot_style=params.get("Pattern.SlotStyle", "radial"),
            number_slots=int(params.get("Pattern.NumberSlots", 48)),
            bit_diameter=float(params.get("Pattern.BitDiameter", 0.25)),
            spacer=float(params.get("Pattern.Spacer", 0.5)),
            x_offset=float(params["Pattern.X_Offset"]),
            y_offset=float(params.get("Pattern.Y_Offset", 1.5)),
            scale_center_point=float(params.get("Pattern.ScaleCenterPoint", 1.0)),
            amplitude_exponent=float(params.get("Pattern.AmplitudeExponent", 1.0)),
            orientation=params.get("Pattern.Orientation", "auto"),
            grain_angle=float(params.get("Pattern.GrainAngle", 90.0)),
            lead_overlap=float(params.get("Pattern.LeadOverlap", 0.25)),
            lead_radius=float(params.get("Pattern.LeadRadius", 0.25)),
            dovetail_settings=DovetailSettingsDTO(
                generate_dovetails=False,
                show_dovetails=False,
                dovetail_inset=0.0625,
                dovetail_cut_direction="climb",
                dovetail_edge_default=0,
                dovetail_edge_overrides="{}"
            )
        )
        
        return CompositionStateDTO(
            frame_design=frame_design,
            pattern_settings=pattern_settings,
            audio_source=AudioSourceDTO(),
            audio_processing=AudioProcessingDTO(),
            peak_control=PeakControlDTO(),
            visual_correction=VisualCorrectionDTO(),
            display_settings=DisplaySettingsDTO(),
            export_settings=ExportSettingsDTO(),
            artistic_rendering=ArtisticRenderingDTO(),
            processed_amplitudes=[]
        )
    
    return _factory


@pytest.mark.parametrize("number_sections", [1, 2, 3, 4])
def test_create_frame_geometry(number_sections, create_composition_state):
    # Load the golden master file using standardized naming pattern
    golden_master_path = Path(f"golden_master_geometry_n{number_sections}.json")
    with open(golden_master_path, "r", encoding="utf-8") as f:
        golden_master_geometry = json.load(f)
    
    # Create CompositionStateDTO using the factory fixture
    input_parameters = create_composition_state(number_sections)
    
    # Execute the service method
    service = GeometryService()
    segments = service.create_frame_geometry(state=input_parameters)
    
    # Assertions remain unchanged
    assert isinstance(segments, list)
    assert len(segments) == len(golden_master_geometry)
    
    for i, (got, exp) in enumerate(zip(segments, golden_master_geometry)):
        assert got["type"] == exp["type"], f"type mismatch at index {i} for n={number_sections}"
        
        for key in ("start", "end", "center"):
            if key in exp:
                np.testing.assert_allclose(
                    np.array(got[key], dtype=float),
                    np.array(exp[key], dtype=float),
                    rtol=1e-9,
                    atol=1e-9,
                    err_msg=f"{key} mismatch at index {i} for n={number_sections}",
                )
        
        if "radius" in exp:
            np.testing.assert_allclose(
                float(got["radius"]),
                float(exp["radius"]),
                rtol=1e-12,
                atol=1e-12,
                err_msg=f"radius mismatch at index {i} for n={number_sections}",
            )
        
        if "is_counter_clockwise" in exp:
            assert got["is_counter_clockwise"] == exp["is_counter_clockwise"], (
                f"is_counter_clockwise mismatch at index {i} for n={number_sections}"
            )