#!/usr/bin/env python3
"""
Web App Geometry Diagnostic Script (Minimal)
Bypasses full DTO stack to test geometry calculations directly.
"""

import sys
import os
import json
import math

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from services.geometry_service import find_min_radius_newton_raphson


def calculate_geometry(
    shape="circular",
    finish_x=36.0,
    finish_y=36.0,
    number_sections=2,
    separation=2.0,
    slot_style="radial",
    num_slots=60,
    bit_diameter=0.25,
    spacer=0.5,
    x_offset=0.75,
    y_offset=1.5,
    side_margin=0.0,
    grain_angle=90.0,
    scale_center_point=1.0,
):
    """
    Direct port of calculate_geometries_core logic for diagnostic purposes.
    Returns geometry outputs without requiring full CompositionStateDTO.
    """
    
    slots_in_section = num_slots // number_sections if number_sections > 0 else num_slots
    
    # Global center
    gc_x = finish_x / 2.0
    gc_y = finish_y / 2.0
    
    # Radius calculation based on shape
    if shape == 'circular':
        radius = finish_x / 2.0
    elif shape == 'diamond':
        if slot_style == 'radial':
            radius = min(finish_x, finish_y) / 2.0
        else:
            radius = min(finish_x, finish_y) / 2.0
    else:  # rectangular
        radius = min(finish_x, finish_y) / 2.0
    
    # Default values
    true_min_radius = 0.0
    min_radius_local = 0.0
    slot_angle_deg = 0.0
    circum_radius = 0.0
    min_radius_from_V_calc = 0.0
    max_radius_local_from_LC = 0.0
    center_point_from_V = 0.0
    max_amplitude_from_V = 0.0
    
    epsilon = 1e-9
    
    if num_slots > 0:
        # Newton-Raphson for minimum radius
        if bit_diameter <= epsilon and spacer <= epsilon:
            true_min_radius_from_NR = 0.0
        else:
            true_min_radius_from_NR = find_min_radius_newton_raphson(
                bit_diameter, spacer, num_slots
            )
            abs_min_check = max(bit_diameter / 2.0, spacer / 2.0) * 1.0001
            if true_min_radius_from_NR < abs_min_check:
                true_min_radius_from_NR = abs_min_check
        
        true_min_radius = true_min_radius_from_NR
        min_radius_local = true_min_radius_from_NR
        
        # Slot angle
        slot_angle_deg = 360.0 / num_slots
        half_slot_angle_rad = math.radians(slot_angle_deg / 2.0)
        
        # Circumradius
        if abs(math.sin(half_slot_angle_rad)) > epsilon:
            circum_radius = spacer / (2.0 * math.sin(half_slot_angle_rad))
        else:
            circum_radius = spacer / 2.0
        
        # Max radius calculation
        if shape == 'circular':
            if number_sections == 1:
                max_radius_local_from_LC = radius - x_offset
            elif number_sections == 2:
                max_radius_local_from_LC = radius - x_offset - separation / 2.0
            elif number_sections == 3:
                theta_rad = math.radians(120.0)
                bifurcation_distance = separation / (2.0 * math.sin(theta_rad / 2.0))
                max_radius_local_from_LC = radius - bifurcation_distance - x_offset
            elif number_sections == 4:
                effective_side = separation + 2 * x_offset
                lc_dist = effective_side / math.sqrt(2)
                max_radius_local_from_LC = radius - lc_dist - x_offset
            else:
                max_radius_local_from_LC = radius - x_offset
        elif shape == 'diamond':
            inscribed_radius = min(finish_x, finish_y) / 2.0
            if number_sections == 1:
                max_radius_local_from_LC = inscribed_radius - x_offset
            else:
                max_radius_local_from_LC = inscribed_radius - x_offset - separation / 2.0
        else:  # rectangular
            half_height = finish_y / 2.0
            if number_sections == 1:
                max_radius_local_from_LC = half_height - y_offset
            else:
                max_radius_local_from_LC = half_height - y_offset
        
        # Ensure max > min
        if max_radius_local_from_LC <= true_min_radius_from_NR:
            max_radius_local_from_LC = true_min_radius_from_NR + bit_diameter
        
        # V-point calculations
        min_radius_from_V = true_min_radius_from_NR - circum_radius
        max_radius_from_V = max_radius_local_from_LC - circum_radius
        
        if max_radius_from_V <= 0:
            max_radius_from_V = bit_diameter
        
        # Bit chord constraint
        min_r_v_for_bit_chord = 0.0
        if abs(math.sin(half_slot_angle_rad)) > epsilon:
            min_r_v_for_bit_chord = (bit_diameter / 2.0) / math.sin(half_slot_angle_rad)
        min_r_v_for_bit_chord = max(min_r_v_for_bit_chord, epsilon)
        
        min_radius_from_V_calc = max(min_radius_from_V, min_r_v_for_bit_chord)
        
        if max_radius_from_V <= min_radius_from_V_calc:
            max_radius_from_V = min_radius_from_V_calc + bit_diameter
        
        # Center point
        base_cp_from_V = (min_radius_from_V_calc + max_radius_from_V) / 2.0
        center_point_from_V = base_cp_from_V * scale_center_point
        
        # Max amplitude
        max_extension_outward = max_radius_from_V - center_point_from_V
        max_extension_inward = center_point_from_V - min_radius_from_V_calc
        max_amplitude_from_V = 2.0 * min(max_extension_outward, max_extension_inward)
        
        if max_amplitude_from_V < 0:
            max_amplitude_from_V = 0.0
        
        # Cosine correction for radial slots
        if slot_style == "radial" and slot_angle_deg > epsilon:
            max_amplitude_from_V *= math.cos(half_slot_angle_rad)
        
        if max_amplitude_from_V < 0:
            max_amplitude_from_V = 0.0
        
        # Override for linear slots
        if slot_style == "linear":
            if shape == "rectangular":
                max_amplitude_from_V = finish_y - 2.0 * y_offset
                center_point_from_V = finish_y / 2.0
            # For circular/diamond linear, would need find_max_amplitude_linear_constrained
    
    return {
        "max_amplitude_local": max_amplitude_from_V,
        "center_point_local": center_point_from_V,
        "true_min_radius": true_min_radius,
        "min_radius_local": min_radius_local,
        "max_radius_local": max_radius_local_from_LC,
        "circum_radius": circum_radius,
        "min_radius_from_V_calc": min_radius_from_V_calc,
        "slot_angle_deg": slot_angle_deg,
        "slots_in_section": slots_in_section,
        "radius": radius,
    }


def run_standard_tests():
    """Run standard geometry test configurations."""
    
    test_configs = [
        ("circular_radial_n2_60slots", {}),
        ("circular_radial_n2_48slots", {"finish_x": 30.0, "finish_y": 30.0, "num_slots": 48}),
        ("circular_radial_n3_60slots", {"number_sections": 3}),
        ("circular_radial_n4_60slots", {"number_sections": 4}),
        ("circular_linear_n2_60slots", {"slot_style": "linear", "side_margin": 0.0}),
        ("rectangular_radial_n2_60slots", {"shape": "rectangular", "finish_x": 48.0, "finish_y": 24.0}),
        ("rectangular_linear_n2_60slots", {"shape": "rectangular", "slot_style": "linear", "finish_x": 48.0, "finish_y": 24.0, "side_margin": 0.0}),
        ("diamond_radial_n2_60slots", {"shape": "diamond"}),
        ("circular_radial_bit0.125", {"bit_diameter": 0.125}),
        ("circular_radial_bit0.375", {"bit_diameter": 0.375}),
        ("circular_radial_scp0.8", {"scale_center_point": 0.8}),
        ("circular_radial_scp1.2", {"scale_center_point": 1.2}),
    ]
    
    defaults = {
        "shape": "circular",
        "finish_x": 36.0,
        "finish_y": 36.0,
        "number_sections": 2,
        "separation": 2.0,
        "slot_style": "radial",
        "num_slots": 60,
        "bit_diameter": 0.25,
        "spacer": 0.5,
        "x_offset": 0.75,
        "y_offset": 1.5,
        "side_margin": 0.0,
        "grain_angle": 90.0,
        "scale_center_point": 1.0,
    }
    
    for name, overrides in test_configs:
        params = defaults.copy()
        params.update(overrides)
        
        outputs = calculate_geometry(**params)
        
        result = {
            "config": name,
            "inputs": {
                "shape": params["shape"],
                "finish_x": params["finish_x"],
                "finish_y": params["finish_y"],
                "number_sections": params["number_sections"],
                "separation": params["separation"],
                "slot_style": params["slot_style"],
                "number_slots": params["num_slots"],
                "bit_diameter": params["bit_diameter"],
                "spacer": params["spacer"],
                "x_offset": params["x_offset"],
                "y_offset": params["y_offset"],
                "side_margin": params["side_margin"],
                "grain_angle": params["grain_angle"],
                "scale_center_point": params["scale_center_point"],
            },
            "outputs": {k: float(v) if isinstance(v, float) else int(v) for k, v in outputs.items()}
        }
        print(json.dumps(result))


if __name__ == "__main__":
    try:
        run_standard_tests()
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(json.dumps({"error": str(e), "stage": "failed"}))
        sys.exit(1)
