import json
from pathlib import Path
import sys

# Add project root to path to allow imports
project_root = Path(__file__).resolve().parent
sys.path.insert(0, str(project_root))

from services.slot_generation_service import SlotGenerationService
from services.dtos import CompositionStateDTO, FrameDesignDTO, PatternSettingsDTO
from services.audio_processing_service import AudioProcessingService

def generate_master_for_slots(n: int, service: SlotGenerationService) -> None:
    """
    Generates and saves a golden master slots file for a given number of sections.
    
    Args:
        n: Number of sections
        service: SlotGenerationService instance with injected dependencies
    """
    print(f"Generating Golden Master Slots for n={n}...")
    
    # Load base parameters and amplitudes from the standard test file
    test_params_path = Path("tests") / "TEST_KingOfKingsChorus_C2R48_20250914_1218.txt"
    with open(test_params_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    params = data["parameters"]
    amplitudes = data["processed_amplitudes"]

    # Create a base state object with the correct number of sections
    initial_state = CompositionStateDTO(
        frame_design=FrameDesignDTO(
            number_sections=n,
            separation=float(params["Design.Separation"]),
            finish_x=float(params["Design.FinishX"]),
            finish_y=float(params["Design.FinishY"]),
        ),
        pattern_settings=PatternSettingsDTO(
            number_slots=int(params["Pattern.NumberSlots"]),
            # Add any other pattern settings required by the service
            slot_style=params["Pattern.SlotStyle"],
            bit_diameter=float(params["Pattern.BitDiameter"]),
            spacer=float(params["Pattern.Spacer"]),
            x_offset=float(params["Pattern.X_Offset"]),
            y_offset=float(params["Pattern.Y_Offset"]),
            scale_center_point=float(params["Pattern.ScaleCenterPoint"]),
            amplitude_exponent=float(params["Pattern.AmplitudeExponent"]),
        )
    )
    
    # Create the final state with amplitudes included
    state = initial_state.model_copy(update={"processed_amplitudes": amplitudes})
    
    # Generate the slot data
    slot_data = service.create_slots(state)

    # Define the output filename
    output_path = Path(f"golden_master_slots_n{n}.json")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(slot_data, f, indent=2)
    
    print(f"✅ Saved: {output_path}")


def main():
    """Main execution function"""
    audio_service = AudioProcessingService()
    slot_service = SlotGenerationService(audio_service)
    
    # Generate for required section counts
    generate_master_for_slots(3, slot_service)
    generate_master_for_slots(4, slot_service)
    
    print("\nBenchmark generation complete.")


if __name__ == "__main__":
    main()