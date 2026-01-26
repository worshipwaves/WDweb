"""Processing level service to handle parameter changes efficiently"""
from typing import List, Dict, Any, Optional
from services.dtos import CompositionStateDTO
from services.audio_processing_service import AudioProcessingService
from services.geometry_service import GeometryService
from services.config_service import ConfigService


class ProcessingLevelService:
    """Handles parameter changes based on a processing level hierarchy."""

    # Updated mapping of DTO field names to their processing level.
    PROCESSING_LEVELS = {
        # Display Level (Visual only, no re-calculation)
        "show_labels": "display",
        "show_offsets": "display",
        "show_debug_circle": "display",
        "section_materials": "display",

        # Post-processing Level (Affects rendering, but not slot geometry)
        "apply_correction": "post",
        "correction_scale": "post",
        "correction_mode": "post",
        "roll_amount": "post",

        # Slots Level (Recalculates slot geometry from existing amplitudes)
        "slot_style": "slots",
        "bit_diameter": "slots",
        "spacer": "slots",
        "side_margin": "slots",
        "lead_overlap": "slots",
        "lead_radius": "slots",

        # Geometry Level (Requires amplitude rescaling)
        "finish_x": "geometry",
        "finish_y": "geometry",
        "x_offset": "geometry",
        "y_offset": "geometry",
        "shape": "geometry",
        "scale_center_point": "geometry",
        "amplitude_exponent": "geometry",
        "number_sections": "geometry",
        "separation": "geometry",
        "processed_amplitudes": "geometry",

        # Audio Level (Requires full audio reprocessing)
        "number_slots": "audio",
        "filter_amount": "audio",
        "apply_filter": "audio",
    }

    LEVEL_HIERARCHY = ["display", "post", "slots", "geometry", "audio"]

    def __init__(self, audio_service, slot_service, config_service: ConfigService):
        self._audio_service = audio_service
        self._geometry_service = GeometryService()
        self._slot_service = slot_service
        self._config_service = config_service
        self._cached_max_amplitude_local = {}  # Placeholder for future caching

    def get_processing_level(self, changed_params: List[str]) -> str:
        """Determine the highest required processing level from a list of changed parameters."""
        if not changed_params:
            return "display"

        highest_index = 0
        for param in changed_params:
            level = self.PROCESSING_LEVELS.get(param)
            if level:
                level_index = self.LEVEL_HIERARCHY.index(level)
                if level_index > highest_index:
                    highest_index = level_index

        return self.LEVEL_HIERARCHY[highest_index]

    def process_by_level(
        self,
        state: CompositionStateDTO,
        changed_params: List[str],
        previous_max_amplitude: Optional[float]
    ) -> CompositionStateDTO:
        """Process a state update based on the required processing level."""
        level = self.get_processing_level(changed_params)

        print(f"[PROCESSING DIAGNOSTIC] Changed params: {changed_params}")
        print(f"[PROCESSING DIAGNOSTIC] Determined level: '{level}'")
        print(f"[PROCESSING DIAGNOSTIC] Previous max_amplitude: {previous_max_amplitude}")
        
        # CRITICAL: Preserve section_materials from incoming state (frontend owns this)
        # Preserve valid section_materials and add defaults for new sections
        if state.frame_design:
            from services.dtos import SectionMaterialDTO
            
            wood_config = self._config_service.get_wood_materials_config()
            
            num_sections = state.frame_design.number_sections
            existing_materials = state.frame_design.section_materials or []
            
            # Filter to valid sections only
            valid_materials = [m for m in existing_materials if m.section_id < num_sections]
            
            # Create defaults for missing sections (immutable)
            existing_ids = {m.section_id for m in valid_materials}
            new_defaults = [
                SectionMaterialDTO(
                    section_id=section_id,
                    species=wood_config['default_species'],
                    grain_direction=wood_config['default_grain_direction']
                )
                for section_id in range(num_sections)
                if section_id not in existing_ids
            ]
            
            # Combine and sort (creates new list, no mutation)
            self._incoming_section_materials = sorted(
                valid_materials + new_defaults, 
                key=lambda m: m.section_id
            )
        else:
            self._incoming_section_materials = []

        current_geometry = self._geometry_service.calculate_geometries_dto(state)
        current_max = current_geometry.max_amplitude_local
        print(f"[PROCESSING DIAGNOSTIC] Current max_amplitude: {current_max}")

        if level in ["display", "post", "slots"]:
            # CRITICAL: Check if we have normalized amplitudes that need physical scaling
            # This happens on initial load when restored state contains 0-1 normalized values
            if state.processed_amplitudes:
                max_amp = max(abs(a) for a in state.processed_amplitudes)
                if max_amp > 0 and max_amp <= 1.5:
                    print(f"[PROCESSING DIAGNOSTIC] Detected normalized amplitudes (max={max_amp:.4f}), applying physical scaling")
                    scaled_amplitudes = AudioProcessingService.scale_and_clamp_amplitudes(
                        state.processed_amplitudes,
                        new_max_amplitude,
                        state.pattern_settings.bit_diameter,
                        state.pattern_settings.visual_floor_pct
                    )
                    state = state.model_copy(update={"processed_amplitudes": scaled_amplitudes})
                    print(f"[PROCESSING DIAGNOSTIC] Scaled to physical space: max={max(scaled_amplitudes):.4f}")
                else:
                    print(f"[PROCESSING DIAGNOSTIC] Action: No server-side amplitude changes needed for '{level}' level.")
            else:
                print(f"[PROCESSING DIAGNOSTIC] Action: No server-side amplitude changes needed for '{level}' level.")
            return state

        if level == "geometry":
            print("[PROCESSING DIAGNOSTIC] Action: Geometry rescaling")
            new_state = self._process_geometry_change(state, previous_max_amplitude, current_max)
            if new_state.processed_amplitudes:
                print(f"[PROCESSING DIAGNOSTIC] Rescaled amplitudes: first={new_state.processed_amplitudes[0]:.4f}")
            return new_state

        if level == "audio":
            print("[PROCESSING DIAGNOSTIC] Action: Full audio reprocessing required.")
            return self._process_audio_change(state)

        return state

    def _process_geometry_change(
        self,
        state: CompositionStateDTO,
        previous_max_amplitude: Optional[float],
        new_max_amplitude: float
    ) -> CompositionStateDTO:
        """Handle geometry changes by applying new max_amplitude to normalized amplitudes."""
        if not state.processed_amplitudes:
            print("[PROCESSING DIAGNOSTIC] No amplitudes to process. Passing through.")
            return state

        print(f"[PROCESSING DIAGNOSTIC] Geometry change - applying new max_amplitude")
        if previous_max_amplitude is not None:
            print(f"[PROCESSING DIAGNOSTIC] Previous max: {previous_max_amplitude:.4f}")
        else:
            print("[PROCESSING DIAGNOSTIC] Previous max: None")
        print(f"[PROCESSING DIAGNOSTIC] New max: {new_max_amplitude:.4f}")
        
        # CRITICAL FIX: Frontend sends NORMALIZED amplitudes (0-1 range) for geometry changes
        # We apply the new max_amplitude directly, not rescale from previous
        if new_max_amplitude > 1e-9:
            # The amplitudes from frontend should be normalized (0-1)
            normalized_amplitudes = state.processed_amplitudes
            
            # Verify they look normalized (max should be around 1.0 or less)
            max_val = max(abs(a) for a in normalized_amplitudes) if normalized_amplitudes else 0
            if max_val > 1.5:
                print(f"[PROCESSING WARNING] Amplitudes don't look normalized (max={max_val:.2f})")
                # Emergency renormalization
                normalized_amplitudes = [a / max_val for a in normalized_amplitudes]
            
            # Apply new scaling to normalized values
            scaled_amplitudes = AudioProcessingService.scale_and_clamp_amplitudes(
                normalized_amplitudes,
                new_max_amplitude,
                state.pattern_settings.bit_diameter,
                state.pattern_settings.visual_floor_pct
            )
            
            print(f"[PROCESSING DIAGNOSTIC] Scaled {len(scaled_amplitudes)} amplitudes")
            print(f"[PROCESSING DIAGNOSTIC] Sample values: first={scaled_amplitudes[0]:.4f}, max={max(scaled_amplitudes):.4f}")
            
            updated_state = state.model_copy(update={"processed_amplitudes": scaled_amplitudes})
            if state.frame_design and self._incoming_section_materials:
                updated_frame = updated_state.frame_design.model_copy(
                    update={"section_materials": self._incoming_section_materials}
                )
                updated_state = updated_state.model_copy(update={"frame_design": updated_frame})
            return updated_state
        
        print("[PROCESSING DIAGNOSTIC] Invalid max_amplitude. Passing through.")
        return state

    def _process_audio_change(self, state: CompositionStateDTO) -> CompositionStateDTO:
        """
        Handle audio-level changes by re-scaling the provided (already rebinned) amplitudes.
        The frontend is responsible for rebinning from its raw sample cache.
        The backend is responsible for calculating the new max_amplitude_local and applying it.
        """
        print("[PROCESSING DIAGNOSTIC] Action: Re-scaling client-rebinned amplitudes.")
        
        # 1. The incoming state has the correct number of slots and a corresponding
        #    number of NORMALIZED (0-1) amplitudes from client-side rebinning.
        
        # 2. Recalculate the geometry for the NEW state.
        geometry = self._geometry_service.calculate_geometries_dto(state)
        new_max_amplitude = geometry.max_amplitude_local
        
        print(f"[PROCESSING DIAGNOSTIC] New max_amplitude_local for scaling: {new_max_amplitude:.4f}")

        # 3. Scale the normalized amplitudes to their final physical size.
        if state.processed_amplitudes and new_max_amplitude > 1e-9:
            scaled_amplitudes = AudioProcessingService.scale_and_clamp_amplitudes(
                state.processed_amplitudes,
                new_max_amplitude,
                geometry.min_radius_from_V_calc,
                state.pattern_settings.visual_floor_pct
            )
            updated_state = state.model_copy(update={"processed_amplitudes": scaled_amplitudes})
            if state.frame_design and self._incoming_section_materials:
                updated_frame = updated_state.frame_design.model_copy(
                    update={"section_materials": self._incoming_section_materials}
                )
                updated_state = updated_state.model_copy(update={"frame_design": updated_frame})
            return updated_state
        
        print("[PROCESSING DIAGNOSTIC] No amplitudes to scale or max_amplitude is zero. Returning state as is.")
        return state