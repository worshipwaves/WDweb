"""Diagnostic script for linear slots amplitude analysis."""
import sys
from pathlib import Path

# Add project to path
sys.path.insert(0, str(Path(__file__).parent))

from services.service_facade import WaveformDesignerFacade
from services.dtos import CompositionStateDTO

def main():
    facade = WaveformDesignerFacade()
    
    # Get default state
    state = facade.create_default_state()
    
    # Override to linear/rectangular
    state = state.model_copy(update={
        'frame_design': state.frame_design.model_copy(update={
            'shape': 'rectangular',
            'finish_x': 48.0,
            'finish_y': 20.0,
            'number_sections': 1
        }),
        'pattern_settings': state.pattern_settings.model_copy(update={
            'slot_style': 'linear',
            'number_slots': 24
        })
    })
    
    # Calculate geometry
    geometry = facade._geometry_service.calculate_geometries_dto(state)
    
    print("\n=== GEOMETRY ===")
    print(f"max_amplitude_local: {geometry.max_amplitude_local:.4f}")
    print(f"center_point_local: {geometry.center_point_local:.4f}")
    print(f"Shape: {state.frame_design.shape}")
    print(f"finish_y: {state.frame_design.finish_y}")
    print(f"y_offset: {state.pattern_settings.y_offset}")
    
    print("\n=== PROCESSED AMPLITUDES ===")
    amps = state.processed_amplitudes
    if amps:
        print(f"Count: {len(amps)}")
        print(f"Min: {min(amps):.4f}")
        print(f"Max: {max(amps):.4f}")
        print(f"Mean: {sum(amps)/len(amps):.4f}")
        print(f"First 5: {[f'{a:.4f}' for a in amps[:5]]}")
    else:
        print("No amplitudes in default state")
    
    print("\n=== EXPECTED vs ACTUAL ===")
    print(f"Expected max slot height: {geometry.max_amplitude_local:.4f} inches")
    if amps:
        print(f"Actual max slot height: {max(amps):.4f} inches")
        print(f"Ratio: {max(amps)/geometry.max_amplitude_local*100:.1f}% of available space")

if __name__ == "__main__":
    main()