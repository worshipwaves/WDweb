# services/geometry_service.py
"""
Service for providing panel geometry parameters and calculations.
This is now the authoritative source for core geometry logic.
"""
import math
from typing import Dict, Any, Tuple, List
from services.dtos import CompositionStateDTO, GeometryResultDTO

# Panel thickness constant - matches frontend
PANEL_THICKNESS = 0.375  # inches

def find_min_radius_newton_raphson(bit_diameter: float, spacer: float, 
                                   num_slots: int) -> float:
    """
    Newton-Raphson solver for minimum radius calculation.
    Solves: 2*asin(bit/2r) + 2*asin(spacer/2r) - (2*pi/N) = 0
    
    Module-level function as it's used by multiple components.
    
    Args:
        bit_diameter: Diameter of cutting bit
        spacer: Space between slots
        num_slots: Total number of slots
        
    Returns:
        Minimum radius that satisfies physical constraints
    """
    epsilon = 1e-12
    tol_r = 1e-6
    tol_f = 1e-9
    max_iter = 100
    
    if num_slots <= 0:
        return 0.0

    total_angle_per_unit_rad = 2 * math.pi / num_slots
    
    def objective(r):
        """Objective function: 2*asin(bit/2r) + 2*asin(spacer/2r) - angle_per_slot"""
        if r <= epsilon:
            return float('inf')
        
        term1 = bit_diameter / (2 * r)
        term2 = spacer / (2 * r)
        
        if term1 > 1 or term2 > 1:
            return float('inf')
        
        try:
            angle_bit = 2 * math.asin(term1)
            angle_spacer = 2 * math.asin(term2)
            return angle_bit + angle_spacer - total_angle_per_unit_rad
        except:
            return float('inf')
    
    def objective_derivative(r):
        """Derivative of objective function for Newton-Raphson."""
        if r <= epsilon:
            return 0
        
        term1 = bit_diameter / (2 * r)
        term2 = spacer / (2 * r)
        
        if term1 >= 1 or term2 >= 1:
            return 0
        
        try:
            d1 = -bit_diameter / (r**2 * math.sqrt(1 - term1**2))
            d2 = -spacer / (r**2 * math.sqrt(1 - term2**2))
            return d1 + d2
        except:
            return 0
    
    # Initial guess
    r = (bit_diameter + spacer) / (2 * math.sin(total_angle_per_unit_rad / 2.0)) \
        if num_slots > 1 and abs(math.sin(total_angle_per_unit_rad / 2.0)) > epsilon \
        else max(bit_diameter, spacer) * 1.1
    
    # Newton-Raphson iteration
    for i in range(max_iter):
        f_r = objective(r)
        
        if not math.isfinite(f_r):
            break
        
        if abs(f_r) < tol_f:
            return r
        
        f_prime_r = objective_derivative(r)
        
        if not math.isfinite(f_prime_r) or abs(f_prime_r) < 1e-12:
            break
        
        step = f_r / f_prime_r
        
        # Limit step size to prevent overshooting
        if abs(step) > r * 0.75 and r > epsilon:
            step = math.copysign(r * 0.75, step)
        
        r_new = r - step
        
        # Ensure r stays positive
        if r_new <= epsilon:
            r = r / 1.2 if r > epsilon * 10 else epsilon * 10
            r = max(r, epsilon * 10)
            if i < max_iter - 10:
                continue
            else:
                break
        
        # Check convergence
        if abs(r_new - r) < tol_r and abs(f_r) < tol_f * 100:
            return r_new
        
        r = r_new
    
    # Fallback if Newton-Raphson fails
    fallback_r = (bit_diameter + spacer) / (2 * math.sin(total_angle_per_unit_rad / 2.0)) \
        if num_slots > 1 and abs(math.sin(total_angle_per_unit_rad / 2.0)) > epsilon \
        else max(bit_diameter, spacer) * 1.1
    
    return fallback_r if fallback_r > (max(bit_diameter, spacer) / 2.0 + epsilon) else r

def calculate_geometries_core(state: 'CompositionStateDTO') -> GeometryResultDTO:
    """
    Port of PyQt's calculate_geometries_core from core/algorithms/geometry_calculator.py.
    
    Calculates all geometry parameters, especially max_amplitude_local.
    Includes Newton-Raphson solver, circum_radius, V-point calculations, and cosine correction.
    
    Args:
        state: Composition state with frame and pattern settings
        
    Returns:
        GeometryResultDTO with all calculated geometry parameters
    """
    # Extract parameters from state
    frame = state.frame_design
    pattern = state.pattern_settings
    
    # Basic parameters
    finish_x = frame.finish_x
    finish_y = frame.finish_y  
    number_sections = frame.number_sections
    separation = frame.separation
    shape = frame.shape
    
    num_slots = pattern.number_slots
    bit_diameter = pattern.bit_diameter
    spacer = pattern.spacer
    x_offset = pattern.x_offset
    y_offset = pattern.y_offset
    grain_angle = pattern.grain_angle
    scale_center_point = pattern.scale_center_point
    
    # Calculate basic values
    slots_in_section = num_slots // number_sections if number_sections > 0 else num_slots
    
    # Global center and radius calculation
    radius = min(finish_x, finish_y) / 2.0
    gc_x = finish_x / 2.0
    gc_y = finish_y / 2.0
    
    # Calculate local centers for multi-section designs
    if number_sections == 1:
        section_local_centers = [(gc_x, gc_y)]
    elif number_sections == 2:
        # For both circular and rectangular, sections split vertically
        lc_x_right = gc_x + (separation / 2.0) + x_offset
        lc_x_left = gc_x - (separation / 2.0) - x_offset
        section_local_centers = [(lc_x_right, gc_y), (lc_x_left, gc_y)]
    elif number_sections == 3:
        # FIXED: Using x_offset (not y_offset) for n=3
        lc_distance_from_gc = (separation + (2 * x_offset)) / math.sqrt(3) if math.sqrt(3) > 1e-9 else separation + (2 * x_offset)
        section_local_centers = [
            (gc_x + lc_distance_from_gc * math.cos(math.radians(angle_deg)),
             gc_y + lc_distance_from_gc * math.sin(math.radians(angle_deg)))
            for angle_deg in [90, 330, 210]  # Top, bottom-right, bottom-left
        ]
    elif number_sections == 4:
        effective_side_len = separation + (2 * x_offset)
        lc_distance_from_gc = effective_side_len / math.sqrt(2) if math.sqrt(2) > 1e-9 else effective_side_len
        section_local_centers = [
            (gc_x + lc_distance_from_gc * math.cos(math.radians(angle_deg)),
             gc_y + lc_distance_from_gc * math.sin(math.radians(angle_deg)))
            for angle_deg in [45, 315, 225, 135]  # TR, BR, BL, TL
        ]
    else:
        section_local_centers = []
    
    # Default values for when num_slots == 0
    true_min_radius = 0.0
    min_radius_local = 0.0
    slot_angle_deg = 0.0
    theta_unit_deg = 0.0
    reference_angles = []
    circum_radius = 0.0
    min_radius_from_V_calc = 0.0
    max_radius_local_from_LC = 0.0
    center_point_from_V = 0.0
    max_amplitude_from_V = 0.0
    
    if num_slots > 0:
        epsilon = 1e-9
        
        # Newton-Raphson calculation for minimum radius
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
        
        # Slot angle calculations
        slot_angle_deg = 360.0 / num_slots
        theta_unit_deg = slot_angle_deg
        
        # Reference angles
        slot0 = grain_angle
        if number_sections >= 2:
            slot0 = grain_angle - (slot_angle_deg / 2.0)
        
        reference_angles = []
        current_angle = slot0
        for _ in range(slots_in_section):
            angle_to_add = current_angle
            while angle_to_add < 0:
                angle_to_add += 360.0
            while angle_to_add >= 360.0:
                angle_to_add -= 360.0
            reference_angles = reference_angles + [angle_to_add]
            current_angle -= slot_angle_deg
        
        # Circumradius calculation
        half_slot_angle_rad = math.radians(slot_angle_deg / 2.0)
        if abs(math.sin(half_slot_angle_rad)) > 1e-9:
            circum_radius = spacer / 2.0 / math.sin(half_slot_angle_rad)
        else:
            circum_radius = spacer * num_slots
        
        # Max radius from local center calculation
        R_global_y_offset = radius - y_offset
        
        if number_sections > 1 and section_local_centers:
            # Get section 0's LC (all sections identical, just rotated)
            lc_x, lc_y = section_local_centers[0]
            
            # Calculate distance from LC to frame at bifurcation angle
            if number_sections == 2:
                # Bifurcation at 0° (pointing right)
                local_radius = radius - abs(lc_x - gc_x)
            elif number_sections == 3:
                # Bifurcation at 90° (pointing up)
                local_radius = radius - abs(lc_y - gc_y)
            elif number_sections == 4:
                # Bifurcation at 45° (diagonal)
                dist_to_gc = math.sqrt((lc_x - gc_x)**2 + (lc_y - gc_y)**2)
                local_radius = radius - dist_to_gc
            else:
                # Fallback for other n values
                local_radius = radius
                
            # Apply y_offset to get max reach from LC
            max_radius_local_from_LC = local_radius - y_offset
        else:
            max_radius_local_from_LC = R_global_y_offset
        
        if max_radius_local_from_LC <= true_min_radius_from_NR:
            max_radius_local_from_LC = true_min_radius_from_NR + bit_diameter
        
        # V-POINT CALCULATIONS - Critical for correct amplitude
        # Calculate min/max radius from vertex V
        min_radius_from_V = true_min_radius_from_NR - circum_radius
        max_radius_from_V = max_radius_local_from_LC - circum_radius
        
        # Ensure max_radius_from_V is reasonable
        if max_radius_from_V <= 0:
            max_radius_from_V = bit_diameter
        
        # Ensure min_radius_from_V respects bit chord constraint
        min_r_v_for_bit_chord = 0.0
        if abs(math.sin(half_slot_angle_rad)) > 1e-9:
            min_r_v_for_bit_chord = (bit_diameter / 2.0) / math.sin(half_slot_angle_rad)
        min_r_v_for_bit_chord = max(min_r_v_for_bit_chord, 1e-6)
        
        min_radius_from_V_calc = max(min_radius_from_V, min_r_v_for_bit_chord)
        
        if max_radius_from_V <= min_radius_from_V_calc:
            max_radius_from_V = min_radius_from_V_calc + bit_diameter
        
        # Calculate center point from V
        base_cp_from_V = (min_radius_from_V_calc + max_radius_from_V) / 2.0
        center_point_from_V = base_cp_from_V * scale_center_point
        
        # Calculate maximum amplitude based on V-point geometry
        max_extension_outward = max_radius_from_V - center_point_from_V
        max_extension_inward = center_point_from_V - min_radius_from_V_calc
        max_amplitude_from_V = 2.0 * min(max_extension_outward, max_extension_inward)
        
        # Apply cosine correction for slot angle
        if max_amplitude_from_V < 0:
            max_amplitude_from_V = 0.0
        if slot_angle_deg > 1e-6:
            max_amplitude_from_V *= math.cos(half_slot_angle_rad)
        if max_amplitude_from_V < 0:
            max_amplitude_from_V = 0.0
    
    # Return properly typed DTO
    return GeometryResultDTO(
        shape=shape,
        numberSections=number_sections,
        num_slots=num_slots,
        slotsInSection=slots_in_section,
        bit_diameter=bit_diameter,
        grainAngle=grain_angle,
        radius=radius,
        original_center_x=gc_x,
        original_center_y=gc_y,
        section_local_centers=section_local_centers,
        reference_angles=reference_angles,
        slot_angle_deg=slot_angle_deg,
        theta_unit_deg=theta_unit_deg,
        true_min_radius=true_min_radius,
        min_radius_local=min_radius_local,
        max_radius_local=max_radius_local_from_LC,
        circum_radius=circum_radius,
        min_radius_from_V_calc=min_radius_from_V_calc,
        center_point_local=center_point_from_V,
        max_amplitude_local=max_amplitude_from_V,
        global_amplitude_scale_factor=max_amplitude_from_V
    )


class GeometryService:
    """
    Service for providing panel geometry parameters and calculations.
    This is now the authoritative source for core geometry logic.
    """
    
    def calculate_geometries_dto(self, state: CompositionStateDTO) -> GeometryResultDTO:
        """
        Calculate all geometry parameters using the core function.
        This is the authoritative source for geometry calculations.
        Returns a GeometryResultDTO with all calculated parameters.
        """
        return calculate_geometries_core(state)
    
    def get_panel_parameters(self, state: CompositionStateDTO) -> Dict[str, Any]:
        """
        Return parameters needed for CSG panel generation.
        
        Args:
            state: The composition state containing frame design parameters
            
        Returns:
            Dictionary with panel configuration:
                - finish_x: Total composition width in inches
                - finish_y: Total composition height in inches
                - thickness: Material thickness in inches  
                - separation: Gap between sections in inches
                - number_sections: Number of panel sections (1-4)
                - shape: Panel shape (circular or rectangular)
        """
        frame = state.frame_design
        
        result = {
            "finish_x": frame.finish_x,
            "finish_y": frame.finish_y,
            "thickness": PANEL_THICKNESS,
            "separation": frame.separation,
            "number_sections": frame.number_sections,
            "shape": frame.shape
        }
        print(f"[DEBUG] get_panel_parameters returning: {result}")
        return result
        
    def create_frame_geometry(self, state: CompositionStateDTO) -> List[Dict[str, Any]]:
        """
        Create the frame geometry segments (arcs and lines) for the panel sections.
        Following the PyQt logic from circular_frame.py get_boundary_segments().
        
        For n=3, this creates 3 arcs and 6 lines that define the wedge shapes.
        
        Returns:
            List of segment dictionaries with 'type', 'start', 'end', etc.
        """
        frame = state.frame_design
        number_sections = frame.number_sections
        separation = frame.separation
        
        # Global center and radius
        h = frame.finish_x / 2.0  # global center x
        k = frame.finish_y / 2.0  # global center y
        radius = frame.finish_y / 2.0
        
        if number_sections == 3:
            # Step 1: Calculate the 3 inner vertices (form equilateral triangle)
            # These are at angles 90°, 210°, 330° from global center
            inner_distance = separation / math.sqrt(3)
            inner_vertices = {}
            
            angles_deg = [90, 210, 330]
            for i, angle_deg in enumerate(angles_deg):
                angle_rad = math.radians(angle_deg)
                x = h + inner_distance * math.cos(angle_rad)
                y = k + inner_distance * math.sin(angle_rad)
                inner_vertices[f"P{i + 7}"] = [x, y]  # P7, P8, P9
            
            print(f"[DEBUG] Inner vertices: {inner_vertices}")
            
            # Step 2: Calculate the separation angle for the outer vertices
            # This creates the gaps between sections
            sep_angle = math.degrees(math.asin(separation / (2 * radius)))
            print(f"[DEBUG] Separation angle: {sep_angle:.2f} degrees")
            
            # Step 3: Define the three sections with their base angles
            # We use clockwise for sections and slots
            # Section 0: Top wedge (30° to 150°)
            # Section 1: Bottom-right wedge (270° to 390°)
            # Section 2: Bottom-left wedge (150° to 270°)
            sections = [
                (30, 150),    # Top - index 0
                (270, 390),   # Bottom-right - index 1 (SWAPPED)
                (150, 270),   # Bottom-left - index 2 (SWAPPED)
            ]
            
            # Step 4: Build segments immutably
            all_segments = []
            
            for i, (start_angle, end_angle) in enumerate(sections):
                # Adjust angles for separation
                adjusted_start = start_angle + sep_angle
                adjusted_end = end_angle - sep_angle
                
                # Handle wrap-around for section 2
                if adjusted_end > 360:
                    adjusted_end = adjusted_end - 360
                
                # Calculate outer vertices
                start_rad = math.radians(adjusted_start)
                end_rad = math.radians(adjusted_end)
                
                x_start = h + radius * math.cos(start_rad)
                y_start = k + radius * math.sin(start_rad)
                x_end = h + radius * math.cos(end_rad)
                y_end = k + radius * math.sin(end_rad)
                
                # Get the corresponding inner vertex for this section
                inner_vertex = inner_vertices[f"P{i + 7}"]
                
                # Create segments for this section
                section_segments = [
                    # Arc segment
                    {
                        "type": "arc",
                        "start": [x_start, y_start],
                        "end": [x_end, y_end],
                        "center": [h, k],
                        "radius": radius,
                        "is_counter_clockwise": True,
                        "section_index": i
                    },
                    # Line from arc end to inner vertex
                    {
                        "type": "line",
                        "start": [x_end, y_end],
                        "end": inner_vertex,
                        "section_index": i,
                        "edge_type": "end_to_inner"
                    },
                    # Line from inner vertex to arc start
                    {
                        "type": "line",
                        "start": inner_vertex,
                        "end": [x_start, y_start],
                        "section_index": i,
                        "edge_type": "inner_to_start"
                    }
                ]
                
                # Concatenate immutably
                all_segments = all_segments + section_segments
            
            print(f"[DEBUG] Generated {len(all_segments)} segments for n=3")
            return all_segments
            
        # Return empty list for other section counts
        return []    