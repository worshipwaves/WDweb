#!/usr/bin/env python3
"""
Standalone test script for verifying slot coordinate calculations.
Generates both numerical comparisons and visual SVG output.
"""

import json
import math
import sys
from pathlib import Path
from typing import List, Tuple, Dict, Any

# Add project root to path
project_root = Path(__file__).resolve().parent
sys.path.insert(0, str(project_root))

from services.dtos import CompositionStateDTO, FrameDesignDTO, PatternSettingsDTO, VisualCorrectionDTO
from services.slot_generation_service import SlotGenerationService


def create_test_state(n_sections: int) -> CompositionStateDTO:
    """Create test state matching main.ts configuration."""
    
    # These amplitudes are from main.ts
    test_amplitudes = [
        7.377289171659599, 7.175424104907904, 7.947381906287243, 6.309899084196261,
        8.509554991123261, 3.9179934089313417, 3.4016715257059422, 4.1676797973281925,
        6.733006274970626, 5.522907515672512, 5.435391156287806, 7.214751572348543,
        4.464005605652318, 7.065628727838287, 6.339390427205711, 6.627919203783868,
        7.937200634764569, 7.926042960285718, 4.130148457186006, 1.6084991234673234,
        8.541931831938664, 8.997024734669823, 7.006368448188243, 6.161957006051612,
        4.367885546730526, 6.456220446968886, 6.496028168421691, 6.75012511656738,
        6.142357419734808, 7.305315784914471, 7.2970509880313585, 4.226254040366297,
        3.853560748156187, 6.343382893479419, 5.511899707693911, 4.063604608856191,
        4.3137820371118165, 4.667667651216671, 8.391558964574049, 6.562422434089324,
        5.927573179450188, 5.601240010507797, 6.135012825870278, 7.270847625209216,
        5.389086949119614, 6.601738548007217, 6.670465962599199, 4.286043961852452
    ]
    
    return CompositionStateDTO(
        frame_design=FrameDesignDTO(
            finish_x=36.0,
            finish_y=36.0,
            number_sections=n_sections,
            separation=2.0
        ),
        pattern_settings=PatternSettingsDTO(
            number_slots=48,
            slot_style='radial',
            bit_diameter=0.25,
            spacer=0.5,
            x_offset=0.75,  # Critical parameter that was missing!
            y_offset=1.5,
            scale_center_point=1.0,
            amplitude_exponent=1.0,
            orientation='auto',
            grain_angle=90.0
        ),
        processed_amplitudes=test_amplitudes,
        visual_correction=VisualCorrectionDTO(
            apply_correction=True,
            correction_scale=1.0,
            correction_mode='nudge_adj'
        )
    )


def analyze_slot_positions(slots: List[List[List[float]]], n_sections: int) -> Dict[str, Any]:
    """Analyze slot positions for verification."""
    
    analysis = {
        'total_slots': len(slots),
        'slots_per_section': len(slots) // n_sections if n_sections > 0 else len(slots),
        'sections': []
    }
    
    slots_per_section = analysis['slots_per_section']
    h, k = 18.0, 18.0  # Canvas center
    
    for section_id in range(n_sections):
        section_slots = []
        
        for i in range(3):  # Look at first 3 slots of each section
            slot_idx = section_id * slots_per_section + i
            if slot_idx < len(slots):
                slot = slots[slot_idx]
                
                # Calculate center of slot for verification
                center_x = sum(p[0] for p in slot[:-1]) / 4
                center_y = sum(p[1] for p in slot[:-1]) / 4
                
                # Distance from canvas center
                dist_from_center = math.sqrt((center_x - h)**2 + (center_y - k)**2)
                
                # Angle from center
                angle = math.degrees(math.atan2(center_y - k, center_x - h))
                if angle < 0:
                    angle += 360
                
                section_slots.append({
                    'slot_index': slot_idx,
                    'vertices': slot,
                    'center': [center_x, center_y],
                    'distance_from_center': dist_from_center,
                    'angle_degrees': angle,
                    'p1': slot[0],  # Inner left
                    'p2': slot[1],  # Outer left  
                    'p3': slot[2],  # Outer right
                    'p4': slot[3],  # Inner right
                })
        
        analysis['sections'].append({
            'section_id': section_id,
            'first_slots': section_slots
        })
    
    return analysis


def create_svg_visualization(slots: List[List[List[float]]], n_sections: int, filename: str):
    """Create SVG file showing slot positions."""
    
    svg_lines = []
    svg_lines.append('<?xml version="1.0" encoding="utf-8"?>')
    svg_lines.append('<svg xmlns="http://www.w3.org/2000/svg" width="36in" height="36in" viewBox="0 0 36 36">')
    svg_lines.append('  <rect width="36" height="36" fill="white" stroke="black" stroke-width="0.01"/>')
    
    # Draw center crosshairs
    svg_lines.append('  <line x1="0" y1="18" x2="36" y2="18" stroke="gray" stroke-width="0.005" stroke-dasharray="0.1,0.1"/>')
    svg_lines.append('  <line x1="18" y1="0" x2="18" y2="36" stroke="gray" stroke-width="0.005" stroke-dasharray="0.1,0.1"/>')
    
    # Draw circle at canvas radius
    svg_lines.append('  <circle cx="18" cy="18" r="18" fill="none" stroke="green" stroke-width="0.01" opacity="0.3"/>')
    
    # Color each section differently
    colors = ['red', 'blue', 'green', 'purple', 'orange', 'brown']
    slots_per_section = len(slots) // n_sections if n_sections > 0 else len(slots)
    
    # Draw slots
    for i, slot in enumerate(slots):
        section_id = i // slots_per_section
        color = colors[section_id % len(colors)]
        
        # Create polygon points string
        points = ' '.join(f"{p[0]},{p[1]}" for p in slot[:-1])  # Skip last point (duplicate)
        
        # Highlight first slot of each section
        if i % slots_per_section == 0:
            svg_lines.append(f'  <polygon points="{points}" fill="{color}" fill-opacity="0.3" stroke="{color}" stroke-width="0.02"/>')
            # Add slot number
            center_x = sum(p[0] for p in slot[:-1]) / 4
            center_y = sum(p[1] for p in slot[:-1]) / 4
            svg_lines.append(f'  <text x="{center_x}" y="{center_y}" font-size="0.3" text-anchor="middle">{i}</text>')
        else:
            svg_lines.append(f'  <polygon points="{points}" fill="none" stroke="{color}" stroke-width="0.01"/>')
    
    # Mark section centers if n > 1
    if n_sections > 1:
        h, k = 18.0, 18.0
        separation = 2.0
        x_offset = 0.75
        
        if n_sections == 2:
            # Left and right centers
            centers = [
                (h - separation/2 - x_offset, k),
                (h + separation/2 + x_offset, k)
            ]
        elif n_sections == 3:
            # Triangle arrangement
            y_offset = 1.5
            tri_offset = separation / math.sqrt(3)
            centers = [
                (h, k + separation + y_offset),
                (h - tri_offset - x_offset, k - separation/2 - y_offset/2),
                (h + tri_offset + x_offset, k - separation/2 - y_offset/2)
            ]
        else:
            centers = []
        
        for i, (cx, cy) in enumerate(centers):
            svg_lines.append(f'  <circle cx="{cx}" cy="{cy}" r="0.2" fill="{colors[i]}" opacity="0.5"/>')
            svg_lines.append(f'  <text x="{cx}" y="{cy + 0.1}" font-size="0.4" text-anchor="middle" fill="black">S{i}</text>')
    
    svg_lines.append('</svg>')
    
    with open(filename, 'w') as f:
        f.write('\n'.join(svg_lines))
    
    print(f"Created visualization: {filename}")


def verify_against_golden_master(slots: List[List[List[float]]], n_sections: int) -> bool:
    """Compare against golden master if it exists."""
    
    golden_path = Path(f"golden_master_slots_n{n_sections}.json")
    
    if not golden_path.exists():
        print(f"No golden master found for n={n_sections}")
        return True
    
    with open(golden_path, 'r') as f:
        golden_data = json.load(f)
    
    if len(slots) != len(golden_data):
        print(f"ERROR: Slot count mismatch! Generated: {len(slots)}, Golden: {len(golden_data)}")
        return False
    
    tolerance = 1e-6
    mismatches = 0
    
    for i, (generated, golden) in enumerate(zip(slots, golden_data)):
        for j, (g_point, gold_point) in enumerate(zip(generated, golden)):
            dx = abs(g_point[0] - gold_point[0])
            dy = abs(g_point[1] - gold_point[1])
            
            if dx > tolerance or dy > tolerance:
                if mismatches < 3:  # Only show first few
                    print(f"Slot {i}, Point {j} mismatch:")
                    print(f"  Generated: ({g_point[0]:.6f}, {g_point[1]:.6f})")
                    print(f"  Golden:    ({gold_point[0]:.6f}, {gold_point[1]:.6f})")
                    print(f"  Delta:     ({dx:.9f}, {dy:.9f})")
                mismatches += 1
    
    if mismatches > 0:
        print(f"\nTotal mismatches: {mismatches}")
        return False
    else:
        print(f"✓ All slots match golden master within tolerance ({tolerance})")
        return True


def main():
    """Run complete slot verification tests."""
    
    print("=" * 60)
    print("SLOT COORDINATE VERIFICATION TEST")
    print("=" * 60)
    
    # Test different section counts
    for n_sections in [1, 2, 3]:
        print(f"\n--- Testing n={n_sections} sections ---")
        
        # Create test state
        state = create_test_state(n_sections)
        
        # Generate slots
        from services.audio_processing_service import AudioProcessingService
        audio_service = AudioProcessingService()
        service = SlotGenerationService(audio_service)
        try:
            slots = service.create_slots(state)
            print(f"Generated {len(slots)} slots")
            
            # Analyze positions
            analysis = analyze_slot_positions(slots, n_sections)
            
            # Print analysis for first slot of each section
            for section in analysis['sections']:
                print(f"\nSection {section['section_id']}:")
                for slot_info in section['first_slots'][:1]:  # Just first slot
                    print(f"  Slot {slot_info['slot_index']}:")
                    print(f"    Center: ({slot_info['center'][0]:.3f}, {slot_info['center'][1]:.3f})")
                    print(f"    Angle: {slot_info['angle_degrees']:.1f}°")
                    print(f"    Distance from center: {slot_info['distance_from_center']:.3f}")
                    print(f"    P1 (inner-left):  ({slot_info['p1'][0]:.3f}, {slot_info['p1'][1]:.3f})")
                    print(f"    P2 (outer-left):  ({slot_info['p2'][0]:.3f}, {slot_info['p2'][1]:.3f})")
                    print(f"    P3 (outer-right): ({slot_info['p3'][0]:.3f}, {slot_info['p3'][1]:.3f})")
                    print(f"    P4 (inner-right): ({slot_info['p4'][0]:.3f}, {slot_info['p4'][1]:.3f})")
            
            # Verify against golden master
            verify_against_golden_master(slots, n_sections)
            
            # Create SVG visualization
            svg_filename = f"slot_verification_n{n_sections}.svg"
            create_svg_visualization(slots, n_sections, svg_filename)
            
        except Exception as e:
            print(f"ERROR generating slots: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "=" * 60)
    print("VERIFICATION COMPLETE")
    print("Check the generated SVG files to visually verify slot positions")
    print("=" * 60)


if __name__ == "__main__":
    main()
