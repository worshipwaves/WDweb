# services/slot_generation_service.py

import math
from typing import Optional, List, Dict, Any, Tuple
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
        elif slot_style == "linear":
            return self._generate_linear_slots(state, geometry, amplitudes)
        else:
            raise NotImplementedError(f"Slot style '{slot_style}' not yet implemented")
            
    def _generate_linear_slots(
        self,
        state: 'CompositionStateDTO',
        geometry: GeometryResultDTO,
        amplitudes: List[float]
    ) -> List[List[List[float]]]:
        """Generate linear slot coordinates for rectangular frames.
        
        For n>2: Enforces symmetry by:
        - Equal slot count in both end sections
        - Equal slot count in all center sections
        - Uniform slot width across all sections
        - Adjusts side_margin slightly to make math work
        """
        
        frame = state.frame_design
        pattern = state.pattern_settings
        
        n_sections = frame.number_sections
        total_slots = pattern.number_slots
        
        finish_x = frame.finish_x
        finish_y = frame.finish_y
        separation = frame.separation
        
        side_margin = pattern.side_margin
        x_offset = pattern.x_offset
        target_exterior_margin = x_offset + side_margin  # Physical position for exterior edges
        y_offset = pattern.y_offset
        spacer = pattern.spacer
        bit_diameter = pattern.bit_diameter
        
        # Panel width
        panel_width = (finish_x - separation * (n_sections - 1)) / n_sections
        
        # Y limits
        center_y = finish_y / 2.0
        max_amplitude = finish_y - 2 * y_offset
        safety_minimum = bit_diameter * 2.0
        
        if n_sections <= 2:
            # Simple case: side_margin on outer edges, x_offset on inner edges
            slots_per_section = total_slots // n_sections
            
            if n_sections == 1:
                # Single panel: target_exterior_margin on both sides
                usable = panel_width - 2 * target_exterior_margin
                slot_width = (usable - (slots_per_section - 1) * spacer) / slots_per_section
                left_margin_list = [target_exterior_margin]
            else:
                # n=2: target_exterior_margin outer, x_offset inner
                # Section 0: L=target_exterior_margin, R=x_offset
                # Section 1: L=x_offset, R=target_exterior_margin
                usable = panel_width - target_exterior_margin - x_offset
                slot_width = (usable - (slots_per_section - 1) * spacer) / slots_per_section
                left_margin_list = [target_exterior_margin, x_offset]
            
            slots_per_section_list = [slots_per_section] * n_sections
            
        else:
            # n>2: Use symmetric_n_end if provided, otherwise fall back to solver
            if pattern.symmetric_n_end is not None:
                n_end = pattern.symmetric_n_end
                num_center_sections = n_sections - 2
                remaining = total_slots - 2 * n_end
                
                if remaining >= num_center_sections and remaining % num_center_sections == 0:
                    n_center = remaining // num_center_sections
                    center_usable = panel_width - 2 * x_offset
                    slot_width = (center_usable - (n_center - 1) * spacer) / n_center
                    min_slot_width = bit_diameter + 0.0625
                    end_span = n_end * slot_width + (n_end - 1) * spacer
                    adjusted_side_margin = panel_width - x_offset - end_span
                    
                    if slot_width < min_slot_width or adjusted_side_margin < x_offset:
                        print(f"[SlotGeneration] symmetric_n_end={n_end} violates physical constraints, using solver")
                        n_end, n_center, adjusted_side_margin, slot_width = self._find_symmetric_distribution(
                            total_slots, n_sections, panel_width, x_offset, side_margin, spacer, bit_diameter
                        )
                else:
                    print(f"[SlotGeneration] symmetric_n_end={n_end} invalid for total_slots={total_slots}, using solver")
                    n_end, n_center, adjusted_side_margin, slot_width = self._find_symmetric_distribution(
                        total_slots, n_sections, panel_width, x_offset, side_margin, spacer, bit_diameter
                    )
            else:
                n_end, n_center, adjusted_side_margin, slot_width = self._find_symmetric_distribution(
                    total_slots, n_sections, panel_width, x_offset, side_margin, spacer, bit_diameter
                )
            
            if pattern.symmetric_n_end is None and abs(adjusted_side_margin - target_exterior_margin) > 0.001:
                print(f"[SlotGeneration] Side margin adjusted from {target_exterior_margin:.3f}\" to {adjusted_side_margin:.3f}\" for symmetry")
            
            # Build per-section lists
            # Section 0: left_margin = adjusted_side_margin
            # Sections 1 to n-2: left_margin = x_offset
            # Section n-1: left_margin = x_offset (right_margin = adjusted_side_margin, but we position from left)
            
            slots_per_section_list = [n_end]
            left_margin_list = [adjusted_side_margin]  # Section 0: outer left = side_margin, right = x_offset
            
            for _ in range(n_sections - 2):
                slots_per_section_list = slots_per_section_list + [n_center]
                left_margin_list = left_margin_list + [x_offset]  # Center: L = x_offset (R derives from slot_width)
            
            slots_per_section_list = slots_per_section_list + [n_end]
            left_margin_list = left_margin_list + [x_offset]  # Section n-1: inner left = x_offset, right floats to side_margin
        
        # Generate all slots
        
        # Generate all slots
        all_slots = []
        global_idx = 0
        
        for section_idx in range(n_sections):
            section_slots = slots_per_section_list[section_idx]
            left_margin = left_margin_list[section_idx]
            
            panel_x_start = section_idx * (panel_width + separation)
            current_x = panel_x_start + left_margin
            
            for _ in range(section_slots):
                if global_idx >= len(amplitudes):
                    break
                
                amp = amplitudes[global_idx]
                amp = max(amp, safety_minimum)
                amp = min(amp, max_amplitude)
                
                half_amp = amp / 2.0
                y_bottom = center_y - half_amp
                y_top = center_y + half_amp
                
                x_start = current_x
                x_end = current_x + slot_width
                
                slot_coords = [
                    [x_start, y_bottom],
                    [x_start, y_top],
                    [x_end, y_top],
                    [x_end, y_bottom],
                    [x_start, y_bottom]
                ]
                
                all_slots = all_slots + [slot_coords]
                
                current_x += slot_width + spacer
                global_idx += 1
        
        return all_slots

    def _find_symmetric_distribution(
        self,
        total_slots: int,
        n_sections: int,
        panel_width: float,
        x_offset: float,
        side_margin: float,
        spacer: float,
        bit_diameter: float
    ) -> Tuple[int, int, float, float]:
        """
        Find (n_end, n_center, adjusted_side_margin, slot_width) that:
        - Sums exactly to total_slots
        - Has uniform slot_width
        - Adjusts side_margin closest to user's requested value
        
        Returns: (n_end, n_center, adjusted_side_margin, slot_width)
        """
        
        # Center section usable width (fixed)
        u_center = panel_width - 2 * x_offset
        
        best_result = None
        best_margin_diff = float('inf')
        
        # For n=3: total = 2*n_end + n_center
        # For n=4: total = 2*n_end + 2*n_center
        num_center_sections = n_sections - 2
        
        # Iterate possible n_end values
        max_n_end = total_slots // 2
        
        for n_end in range(1, max_n_end + 1):
            remaining = total_slots - 2 * n_end
            
            # n_center must divide evenly among center sections
            if remaining < num_center_sections:
                continue
            if remaining % num_center_sections != 0:
                continue
                
            n_center = remaining // num_center_sections
            
            # Calculate slot_width from center section
            # u_center = n_center * w + (n_center - 1) * spacer
            # w = (u_center - (n_center - 1) * spacer) / n_center
            slot_width = (u_center - (n_center - 1) * spacer) / n_center
            
            min_slot_width = bit_diameter + 0.0625  # CNC safety: bit diameter + 1/16"
            if slot_width < min_slot_width:
                continue
            
            # Calculate required u_end for this slot_width
            # u_end = n_end * w + (n_end - 1) * spacer
            u_end_required = n_end * slot_width + (n_end - 1) * spacer
            
            # Calculate adjusted_side_margin
            # u_end = panel_width - adjusted_side_margin - x_offset
            adjusted_side_margin = panel_width - x_offset - u_end_required
            
            # Skip if margin goes negative or too small
            if adjusted_side_margin < x_offset * 0.5:
                continue
            
            # Score by closeness to user's requested side_margin
            margin_diff = abs(adjusted_side_margin - side_margin)
            
            # Skip if adjustment exceeds tolerance (±25% or ±0.5", whichever is greater)
            max_adjustment = max(side_margin * 0.25, 0.5)
            if margin_diff > max_adjustment:
                continue
            
            if margin_diff < best_margin_diff:
                best_margin_diff = margin_diff
                best_result = (n_end, n_center, adjusted_side_margin, slot_width)
        
        if best_result is None:
            # No valid distribution for requested total_slots
            # Search nearby totals for one that works
            for offset in range(1, 15):
                for delta in [offset, -offset]:
                    test_total = total_slots + delta
                    if test_total < n_sections:
                        continue
                    
                    # Re-run the search for this total
                    test_result = self._find_valid_distribution(
                        test_total, n_sections, panel_width, x_offset, side_margin, spacer, bit_diameter, num_center_sections, u_center
                    )
                    if test_result:
                        print(f"[SlotGeneration] Snapped total_slots from {total_slots} to {test_total} for valid distribution")
                        return test_result
            
            # Ultimate fallback: equal distribution with x_offset margins
            slots_per = total_slots // n_sections
            usable_center = panel_width - 2 * x_offset
            slot_width = (usable_center - (slots_per - 1) * spacer) / slots_per
            span = slots_per * slot_width + (slots_per - 1) * spacer
            resulting_side_margin = panel_width - x_offset - span
            
            return (slots_per, slots_per, resulting_side_margin, slot_width)
        
        return best_result 

    def _find_valid_distribution(
        self,
        total_slots: int,
        n_sections: int,
        panel_width: float,
        x_offset: float,
        side_margin: float,
        spacer: float,
        bit_diameter: float,
        num_center_sections: int,
        u_center: float
    ) -> Optional[Tuple[int, int, float, float]]:
        """Check if total_slots has a valid symmetric distribution."""
        max_n_end = total_slots // 2
        max_adjustment = max(side_margin * 0.25, 0.5)
        
        for n_end in range(1, max_n_end + 1):
            remaining = total_slots - 2 * n_end
            
            if remaining < num_center_sections:
                continue
            if remaining % num_center_sections != 0:
                continue
                
            n_center = remaining // num_center_sections
            slot_width = (u_center - (n_center - 1) * spacer) / n_center
            
            min_slot_width = bit_diameter + 0.0625  # CNC safety: bit diameter + 1/16"
            if slot_width < min_slot_width:
                continue
            
            u_end_required = n_end * slot_width + (n_end - 1) * spacer
            adjusted_side_margin = panel_width - x_offset - u_end_required
            
            if adjusted_side_margin < x_offset * 0.5:
                continue
            
            margin_diff = abs(adjusted_side_margin - side_margin)
            if margin_diff <= max_adjustment:
                return (n_end, n_center, adjusted_side_margin, slot_width)
        
        return None
        
    def compute_valid_slot_counts(
        self,
        n_sections: int,
        panel_width: float,
        side_margin: float,
        x_offset: float,
        spacer: float,
        bit_diameter: float
    ) -> List[Dict[str, int]]:
        """
        Enumerate all valid total_slots values that produce symmetric distribution
        for the given geometry and side_margin.
        
        Returns list of {total_slots, n_end} dicts for frontend to set symmetric_n_end.
        """
        if n_sections < 3:
            return []
        
        center_usable = panel_width - 2 * x_offset
        end_usable = panel_width - side_margin - x_offset
        num_center_sections = n_sections - 2
        min_slot_width = bit_diameter + 0.0625
        
        valid_configs: List[Dict[str, int]] = []
        seen_totals: set = set()
        
        # Iterate n_center from 1 upward until slot_width becomes too small
        n_center = 1
        while True:
            slot_width = (center_usable - (n_center - 1) * spacer) / n_center
            
            if slot_width < min_slot_width:
                break
            
            # Calculate n_end that fits in end_usable with this slot_width
            n_end_float = (end_usable + spacer) / (slot_width + spacer)
            n_end = int(n_end_float)
            
            if n_end >= 1:
                total_slots = 2 * n_end + num_center_sections * n_center
                if total_slots not in seen_totals:
                    seen_totals = seen_totals | {total_slots}
                    valid_configs = valid_configs + [{'total_slots': total_slots, 'n_end': n_end}]
            
            n_center += 1
        
        return sorted(valid_configs, key=lambda x: x['total_slots'])   
    
    def compute_margin_presets(
        self,
        total_slots: int,
        n_sections: int,
        panel_width: float,
        x_offset: float,
        spacer: float,
        bit_diameter: float
    ) -> List[Dict[str, Any]]:
        """
        Enumerate all valid (n_end, n_center, side_margin) configurations
        for rectangular linear n>=3.
        """
        if n_sections < 3:
            return []
        
        center_usable = panel_width - 2 * x_offset
        num_center_sections = n_sections - 2
        min_slot_width = bit_diameter + 0.0625
        
        valid_configs: List[Dict[str, Any]] = []
        
        for n_end in range(1, total_slots // 2 + 1):
            remaining = total_slots - 2 * n_end
            
            if remaining < num_center_sections:
                continue
            if remaining % num_center_sections != 0:
                continue
            
            n_center = remaining // num_center_sections
            slot_width = (center_usable - (n_center - 1) * spacer) / n_center
            
            if slot_width < min_slot_width:
                continue
            
            end_span = n_end * slot_width + (n_end - 1) * spacer
            side_margin = panel_width - x_offset - end_span
            
            if side_margin < x_offset:
                continue
            
            valid_configs = valid_configs + [{
                'n_end': n_end,
                'n_center': n_center,
                'side_margin': round(side_margin, 3),
                'slot_width': round(slot_width, 4)
            }]
        
        valid_configs = sorted(valid_configs, key=lambda x: x['side_margin'])
        
        n = len(valid_configs)
        for i, config in enumerate(valid_configs):
            if i == 0:
                config['label'] = 'Minimum'
            elif i == n - 1:
                config['label'] = 'Maximum'
            elif n >= 5:
                pct = i / (n - 1)
                if pct < 0.33:
                    config['label'] = 'Small'
                elif pct < 0.66:
                    config['label'] = 'Medium'
                else:
                    config['label'] = 'Large'
            else:
                config['label'] = f'{config["side_margin"]}"'
        
        return valid_configs
    
    def _generate_radial_slots(
        self, 
        state: 'CompositionStateDTO', 
        geometry: GeometryResultDTO, 
        amplitudes: List[float]
    ) -> List[List[List[float]]]:
        """Generate radial slot coordinates."""
        
        # Extract shape for use in nested scope
        frame_shape = state.frame_design.shape
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
            scaled_amplitude = amplitude # * state.pattern_settings.amplitude_exponent
            
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