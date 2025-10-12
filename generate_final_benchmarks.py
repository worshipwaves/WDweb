# generate_final_benchmarks.py (Corrected, Self-Contained Version)
import json
from pathlib import Path
import sys

# Add project root to path for imports
project_root = Path(__file__).resolve().parent
sys.path.insert(0, str(project_root))

# Import DTOs and the Service directly
from services.dtos import (
    CompositionStateDTO,
    FrameDesignDTO,
    PatternSettingsDTO,
    VisualCorrectionDTO,
    AudioSourceDTO,
    AudioProcessingDTO,
    PeakControlDTO,
    DisplaySettingsDTO,
    ExportSettingsDTO,
    ArtisticRenderingDTO,
)
from services.slot_generation_service import SlotGenerationService

def build_state_for_n_sections(number_sections: int) -> CompositionStateDTO:
    """
    Builds the standard test CompositionStateDTO for a given number of sections.
    This logic is self-contained and does not rely on any other files.
    """
    test_params_path = Path("tests") / "TEST_KingOfKingsChorus_C2R48_20250914_1218.txt"
    with open(test_params_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    params = data["parameters"]
    processed_amplitudes = data.get("processed_amplitudes", [])
    
    frame_design = FrameDesignDTO(
        shape=params["Design.Shape"],
        finish_x=float(params["Design.FinishX"]),
        finish_y=float(params["Design.FinishY"]),
        number_sections=number_sections,
        separation=float(params["Design.Separation"]),
        species=params["Design.Species"],
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
    
    initial_state = CompositionStateDTO(
        frame_design=frame_design,
        pattern_settings=pattern_settings,
        visual_correction=visual_correction,
        audio_source=AudioSourceDTO(),
        audio_processing=AudioProcessingDTO(),
        peak_control=PeakControlDTO(),
        display_settings=DisplaySettingsDTO(),
        export_settings=ExportSettingsDTO(),
        artistic_rendering=ArtisticRenderingDTO(),
    )
    
    state_with_amplitudes = initial_state.model_copy(
        update={"processed_amplitudes": processed_amplitudes}
    )
    
    return state_with_amplitudes

def generate_and_save(n: int, service: SlotGenerationService):
    """Generates and saves the golden master for a given section count."""
    print(f"Generating final benchmark for n={n} slots...")
    state = build_state_for_n_sections(number_sections=n)
    slot_data = service.create_slots(state=state)
    
    output_path = Path(f"golden_master_slots_n{n}.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(slot_data, f, indent=2)
    print(f"✅ Saved final benchmark to: {output_path}")

def main():
    """Main execution function"""
    from services.audio_processing_service import AudioProcessingService
    audio_service = AudioProcessingService()
    service = SlotGenerationService(audio_service)
    generate_and_save(3, service)
    generate_and_save(4, service)
    print("\nFinal benchmark generation complete. You may now delete this script and run pytest.")

if __name__ == "__main__":
    main()