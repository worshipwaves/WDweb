# services/slot_generation_service.py

import math
from typing import List, Dict, Any, Tuple
from services.dtos import CompositionStateDTO, GeometryResultDTO

class SlotGenerationService:
    """Service for generating slot coordinates from composition state."""
    
    def get_slot_data(self, state: CompositionStateDTO, geometry: GeometryResultDTO) -> List[Dict[str, Any]]:
        """
        Return slot data for CSG operations.
        
        Args:
            state: Complete composition state including processed amplitudes
            geometry: Pre-calculated geometry from GeometryService
            
        Returns:
            List of slot data dictionaries, each containing:
                - vertices: List of 4 [x, y] coordinates forming the trapezoid
                - x: X position of slot center
                - z: Z position of slot center (Y in 2D space)
                - angle: Rotation angle in radians
                - length: Slot length (for reference)
                - width: Slot width (for reference)
        """
        if not state.processed_amplitudes:
            raise ValueError("Cannot generate slot data without processed amplitudes")
        
        # Get the raw slot coordinates with pre-calculated geometry
        slots = self.create_slots(state, geometry)
        
        # Convert slot coordinates to CSG data format
        slot_data = []
        
        for slot in slots:
            if len(slot) < 4:
                continue
                
            # Get the 4 vertices that form the trapezoid
            vertices = [
                [slot[0][0], slot[0][1]],
                [slot[1][0], slot[1][1]],
                [slot[2][0], slot[2][1]],
                [slot[3][0], slot[3][1]]
            ]
            
            # Calculate center for reference
            center_x = sum(v[0] for v in vertices) / 4.0
            center_y = sum(v[1] for v in vertices) / 4.0
            
            # Calculate angle from radial centerline
            dx = slot[1][0] - slot[0][0]
            dy = slot[1][1] - slot[0][1]
            angle = math.atan2(dy, dx)
            
            # Calculate dimensions for reference
            length = math.sqrt(dx**2 + dy**2)
            width_dx = slot[3][0] - slot[0][0]
            width_dy = slot[3][1] - slot[0][1]
            width = math.sqrt(width_dx**2 + width_dy**2)
            
            slot_data = slot_data + [{
                "vertices": vertices,
                "x": center_x,
                "z": center_y,
                "angle": angle,
                "length": length,
                "width": width
            }]
        
        return slot_data
    
    def create_slots(self, state: CompositionStateDTO, geometry: GeometryResultDTO) -> List[List[List[float]]]:
        """
        Generate slot coordinates based on the composition state.
        
        Args:
            state: Complete composition state including processed amplitudes
            geometry: Pre-calculated geometry from GeometryService
            
        Returns:
            List of slots, where each slot is a list of [x, y] coordinates
        """
        # Extract key parameters
        number_slots = state.pattern_settings.number_slots
        slot_style = state.pattern_settings.slot_style
        amplitudes = state.processed_amplitudes
        
        # Validate amplitudes
        if len(amplitudes) != number_slots:
            raise ValueError(f"Expected {number_slots} amplitudes, got {len(amplitudes)}")
        
        # Generate slots based on style
        if slot_style == "radial":
            return self._generate_radial_slots(state, geometry, amplitudes)
        else:
            raise NotImplementedError(f"Slot style '{slot_style}' not yet implemented")
    
    def _generate_radial_slots(
        self, 
        state: 'CompositionStateDTO', 
        geometry: GeometryResultDTO, 
        amplitudes: List[float]
    ) -> List[List[List[float]]]:
        """Generate radial slot coordinates."""
        number_sections = state.frame_design.number_sections
        number_slots = state.pattern_settings.number_slots
        slots_per_section = number_slots // number_sections
        
        # Extract commonly used params from DTO
        section_local_centers = geometry.section_local_centers
        reference_angles = geometry.reference_angles
        
        # Generate all slots immutably
        all_slots: List[List[List[float]]] = []
        
        for slot_index in range(number_slots):
            section_id = slot_index // slots_per_section
            local_slot_index = slot_index % slots_per_section
            
            # Amplitude with exponent
            amplitude = amplitudes[slot_index]
            scaled_amplitude = amplitude * state.pattern_settings.amplitude_exponent
            
            # Symmetric extents about center point
            inward_extent = scaled_amplitude / 2.0
            outward_extent = scaled_amplitude / 2.0
            
            # Calculate per-slot visual adjustment if needed
            visual_adjustment = 0.0
            # Visual correction only applies to multi-section CIRCULAR designs
            if state.visual_correction.apply_correction and number_sections > 1:
                gc_x = state.frame_design.finish_x / 2.0
                gc_y = state.frame_design.finish_y / 2.0
                global_center = (gc_x, gc_y)
                
                lc_x, lc_y = section_local_centers[section_id]
                local_center = (lc_x, lc_y)
                
                unit_centerline_deg = reference_angles[local_slot_index]
                section_rotation_offset = 0.0
                
                if number_sections == 2:
                    if section_id == 1:
                        section_rotation_offset = 180.0
                elif number_sections == 3:
                    base_n3_offset = state.pattern_settings.grain_angle - 90.0
                    n3_section_rotations = [60.0, 300.0, 180.0]
                    section_rotation_offset = n3_section_rotations[section_id] + base_n3_offset
                elif number_sections == 4:
                    section_rotations_n4 = [0.0, 270.0, 180.0, 90.0]
                    section_rotation_offset = section_rotations_n4[section_id]
                    
                slot_global_angle_deg = unit_centerline_deg + section_rotation_offset
                while slot_global_angle_deg < 0:
                    slot_global_angle_deg += 360.0
                while slot_global_angle_deg >= 360.0:
                    slot_global_angle_deg -= 360.0
                    
                # CRITICAL: Use inscribed circle for ALL shapes
                # geometry.radius already has the correct inscribed circle
                global_radius = geometry.radius
                max_reach_from_lc = geometry.max_radius_local
                
                visual_adjustment = self._calculate_center_point_adjustment(
                    state, global_center, local_center, global_radius, slot_global_angle_deg,
                    max_reach_from_lc, number_sections, section_id
                )
                
                visual_adjustment *= state.visual_correction.correction_scale
            
            # Calculate slot coordinates
            slot_coords = self._calculate_radial_slot_coords(
                local_slot_index, geometry, section_id,
                0.0,  # nudge_distance
                state.visual_correction.correction_mode.lower().replace(" ", "_").replace("_adj", "_adj"),
                visual_adjustment, inward_extent, outward_extent
            )
            
            if slot_coords:
                slot_as_list = [[float(x), float(y)] for x, y in slot_coords]
                all_slots = all_slots + [slot_as_list]
            else:
                all_slots = all_slots + [[]]
        
        return all_slots
    
    def _calculate_center_point_adjustment(
        self, state: CompositionStateDTO, global_center_coords: Tuple[float, float], local_center_coords: Tuple[float, float],
        global_circle_radius: float, slot_centerline_global_angle_deg: float,
        current_max_slot_reach_from_lc: float, number_sections: int, section_id: int
    ) -> float:
        """Calculate per-slot visual adjustment."""
        h_gc, k_gc = global_center_coords
        lc_x_abs, lc_y_abs = local_center_coords
        epsilon = 1e-9
        a = lc_x_abs - h_gc
        b = lc_y_abs - k_gc
        r = global_circle_radius
        
        theta_rad = math.radians(slot_centerline_global_angle_deg)
        cos_theta = math.cos(theta_rad)
        sin_theta = math.sin(theta_rad)
        
        shape = state.frame_design.shape

        if shape == 'rectangular':
            # For a rectangle, find the intersection with the four bounding lines.
            rect_half_width = state.frame_design.finish_x / 2.0
            rect_half_height = state.frame_design.finish_y / 2.0
            
            t_values: List[float] = []
            # Intersection with vertical lines (x = +/- half_width)
            if abs(cos_theta) > epsilon:
                t_x1 = (rect_half_width - a) / cos_theta
                t_x2 = (-rect_half_width - a) / cos_theta
                if t_x1 >= -epsilon: t_values = t_values + [t_x1]
                if t_x2 >= -epsilon: t_values = t_values + [t_x2]

            # Intersection with horizontal lines (y = +/- half_height)
            if abs(sin_theta) > epsilon:
                t_y1 = (rect_half_height - b) / sin_theta
                t_y2 = (-rect_half_height - b) / sin_theta
                if t_y1 >= -epsilon: t_values = t_values + [t_y1]
                if t_y2 >= -epsilon: t_values = t_values + [t_y2]
            
            hypotLength = min(t_values) if t_values else 0.0

        else:  # 'circular'
            # Original line-circle intersection logic
            A = 2 * (a * cos_theta + b * sin_theta)
            B = a**2 + b**2 - r**2
            
            discriminant = A**2 - 4 * B
            if discriminant < 0:
                return 0.0
            
            sqrt_disc = math.sqrt(discriminant)
            t1 = (-A + sqrt_disc) / 2.0
            t2 = (-A - sqrt_disc) / 2.0
            
            valid_t = [t for t in [t1, t2] if t >= -epsilon]
            if not valid_t:
                return 0.0
                
            hypotLength = min(valid_t)
        
        baseAdjust = global_circle_radius - current_max_slot_reach_from_lc
        
        section_main_angles = {
            2: {0: 0, 1: 180},
            3: {0: 90, 1: 330, 2: 210},
            4: {0: 45, 1: 315, 2: 225, 3: 135},
        }
        
        if number_sections in section_main_angles:
            main_angle = section_main_angles[number_sections].get(section_id, 0)
            angle_diff = abs(slot_centerline_global_angle_deg - main_angle)
            if angle_diff > 180:
                angle_diff = 360 - angle_diff
            angle_factor = (1 - math.cos(math.radians(angle_diff))) / 2
            centerPointAdjust = baseAdjust * angle_factor
        else:
            centerPointAdjust = baseAdjust
            
        return max(0.0, centerPointAdjust)
    
    def _calculate_radial_slot_coords(
        self, slot_index: int, geometry: GeometryResultDTO, section_id: int,
        nudge_distance: float, correction_mode: str, visual_adjustment: float,
        inward_extent: float, outward_extent: float
    ) -> List[Tuple[float, float]]:
        """Calculate coordinates for a single radial slot."""
        lc_x, lc_y = geometry.section_local_centers[section_id]
        unit_centerline_deg = geometry.reference_angles[slot_index]
        slot_angle_deg = geometry.slot_angle_deg
        
        section_rotation_offset = 0.0
        number_sections = geometry.numberSections
        grain_angle = geometry.grainAngle
        
        if number_sections == 2 and section_id == 1:
            section_rotation_offset = 180.0
        elif number_sections == 3:
            base_n3_offset = grain_angle - 90.0
            n3_section_rotations = [60.0, 300.0, 180.0]
            section_rotation_offset = n3_section_rotations[section_id] + base_n3_offset
        elif number_sections == 4:
            section_rotations_n4 = [0.0, 270.0, 180.0, 90.0]
            section_rotation_offset = section_rotations_n4[section_id]
        
        slot_fan_centerline_deg = (unit_centerline_deg + section_rotation_offset) % 360
        slot_fan_centerline_rad = math.radians(slot_fan_centerline_deg)
        
        # Create local variables to avoid mutating input parameters, fixing the violation.
        current_slot_center_point_from_V = geometry.center_point_local
        adjusted_nudge_distance = nudge_distance
        
        if correction_mode == "center_adj":
            current_slot_center_point_from_V += visual_adjustment
        elif correction_mode == "nudge_adj":
            adjusted_nudge_distance += visual_adjustment
        
        adjusted_offset = geometry.circum_radius + adjusted_nudge_distance
        V_x = lc_x + adjusted_offset * math.cos(slot_fan_centerline_rad)
        V_y = lc_y + adjusted_offset * math.sin(slot_fan_centerline_rad)
        
        min_radial_dist_from_V_allowed = geometry.min_radius_from_V_calc
        max_radial_dist_from_V_allowed = geometry.max_radius_local - geometry.circum_radius
        
        ref_len1_from_V = max(current_slot_center_point_from_V - inward_extent, min_radial_dist_from_V_allowed)
        ref_len2_from_V = min(current_slot_center_point_from_V + outward_extent, max_radial_dist_from_V_allowed)
        
        if ref_len2_from_V < ref_len1_from_V + 1e-6:
            ref_len2_from_V = ref_len1_from_V + 1e-6
        
        half_slot_angle_rad = math.radians(slot_angle_deg / 2.0)
        cos_half_angle = math.cos(half_slot_angle_rad)
        
        length1 = ref_len1_from_V / cos_half_angle
        length2 = ref_len2_from_V / cos_half_angle
        
        angle_V_side_1_rad = slot_fan_centerline_rad - half_slot_angle_rad
        angle_V_side_2_rad = slot_fan_centerline_rad + half_slot_angle_rad
        
        p1 = (V_x + length1 * math.cos(angle_V_side_1_rad), V_y + length1 * math.sin(angle_V_side_1_rad))
        p2 = (V_x + length2 * math.cos(angle_V_side_1_rad), V_y + length2 * math.sin(angle_V_side_1_rad))
        p3 = (V_x + length2 * math.cos(angle_V_side_2_rad), V_y + length2 * math.sin(angle_V_side_2_rad))
        p4 = (V_x + length1 * math.cos(angle_V_side_2_rad), V_y + length1 * math.sin(angle_V_side_2_rad))
        
        return [p1, p2, p3, p4, p1]