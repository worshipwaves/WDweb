# services/service_facade.py

from pathlib import Path
from typing import List, Dict, Any, Optional
import numpy as np

from services.config_service import ConfigService
from services.geometry_service import GeometryService
from services.slot_generation_service import SlotGenerationService
from services.composition_service import CompositionService
from services.processing_level_service import ProcessingLevelService
from services.dtos import CompositionStateDTO
from services.audio_processing_service import AudioProcessingService


class WaveformDesignerFacade:
    """
    Facade pattern implementation for the WaveDesigner application.
    
    This is the ONLY class that external clients (API, PyQt app) should interact with.
    It manages the instantiation of all services and delegates operations to them.
    
    Following the KISS principle: This facade keeps the interface simple while
    hiding the complexity of service orchestration.
    """
    
    def __init__(self):
        """
        Initialize the facade by creating all required services.
        
        Services are created with their dependencies injected,
        maintaining loose coupling and testability.
        """
        # Create configuration service (single source of truth for defaults)
        self._config_service = ConfigService(
            config_path=Path("config/default_parameters.json")
        )
        
        # Create base services
        self._geometry_service = GeometryService()
        self._audio_processing_service = AudioProcessingService()
        
        # Create slot generation service (now stateless with no dependencies)
        self._slot_generation_service = SlotGenerationService()
        
        # Create orchestration service with dependencies
        self._composition_service = CompositionService(
            geometry_service=self._geometry_service,
            slot_generation_service=self._slot_generation_service,
            audio_processing_service=self._audio_processing_service
        )        
        
        # Add the new processing level service
        self._processing_level_service = ProcessingLevelService(
            audio_service=self._audio_processing_service,
            slot_service=self._slot_generation_service
        )        
    
    def generate_composition(self, state: CompositionStateDTO) -> CompositionStateDTO:
        """
        Generate a complete composition from the given state.
        
        This is the primary method for creating a design. It orchestrates
        all necessary services to produce frame geometry, slot patterns,
        and other design elements.
        
        Args:
            state: The composition state containing all design parameters
            
        Returns:
            Updated composition state with generated elements
        """
        return self._composition_service.generate_full_composition(state)
    
    def validate_composition(self, state: CompositionStateDTO) -> Dict[str, Any]:
        """
        Validate a composition state for correctness and feasibility.
        
        Args:
            state: The composition state to validate
            
        Returns:
            Validation results dictionary with 'valid', 'errors', and 'warnings'
        """
        return self._composition_service.validate_composition(state)
    
    def get_panel_parameters(self, state: CompositionStateDTO) -> Dict[str, Any]:
        """
        Get panel configuration parameters for CSG operations.
        
        Args:
            state: The composition state
            
        Returns:
            Dictionary with panel configuration:
                - outer_radius: Panel outer radius
                - thickness: Material thickness
                - separation: Gap between sections
                - number_sections: Number of sections (1-4)
        """
        return self._geometry_service.get_panel_parameters(state)
    
    def get_slot_data(self, state: CompositionStateDTO) -> List[Dict[str, Any]]:
        """
        Get slot data for CSG operations.
        
        Args:
            state: The composition state with processed amplitudes
            
        Returns:
            List of slot data dictionaries with position and dimensions
            
        Raises:
            ValueError: If state lacks required amplitude data
        """
        if not state.processed_amplitudes:
            raise ValueError("Cannot generate slot data without processed amplitudes")
        
        # Two-step flow: Calculate geometry first, then generate slots
        geometry = self._geometry_service.calculate_geometries_dto(state)
        return self._slot_generation_service.get_slot_data(state, geometry)
    
    def get_csg_data(self, state: CompositionStateDTO) -> Dict[str, Any]:
        """
        Get both panel parameters and slot data for CSG operations.
        
        Convenience method that combines panel and slot data.
        
        Args:
            state: The composition state with all required data
            
        Returns:
            Dictionary containing:
                - panel_config: Panel parameters
                - slot_data: List of slot data (if amplitudes present)
        """
        # Apply automatic roll for circular n=3 designs
        if (state.frame_design.shape == "circular" and 
            state.frame_design.number_sections == 3 and 
            state.processed_amplitudes):
            
            # Calculate the automatic roll amount
            auto_roll = AudioProcessingService.calculate_auto_roll_for_sections(
                state.frame_design.number_sections,
                state.pattern_settings.number_slots
            )
            
            # Apply roll if needed
            if auto_roll != 0 and auto_roll != state.peak_control.roll_amount:
                # Apply numpy.roll to the amplitudes
                rolled_amplitudes = np.roll(
                    np.array(state.processed_amplitudes), 
                    auto_roll
                ).tolist()
                
                # Create new state with rolled amplitudes
                state = state.model_copy(update={
                    "processed_amplitudes": rolled_amplitudes,
                    "peak_control": state.peak_control.model_copy(update={
                        "roll_amount": auto_roll
                    })
                })
        
        # Calculate geometry once for both panel and slots
        geometry = self._geometry_service.calculate_geometries_dto(state)
        
        result = {
            "panel_config": self.get_panel_parameters(state),
            "slot_data": [],
            "section_edges": []  # NEW: Include edge data for n=3
        }
        
        # Include slot data if amplitudes are available
        if state.processed_amplitudes:
            try:
                # Pass pre-calculated geometry to slot generation
                result["slot_data"] = self._slot_generation_service.get_slot_data(state, geometry)
            except ValueError:
                # Keep empty slot_data if generation fails
                pass
        
        # Extract section edge lines for n=3
        if state.frame_design.number_sections == 3:
            # Get frame geometry segments
            frame_segments = self._geometry_service.create_frame_geometry(state)
            
            # Group segments by section
            for section_idx in range(3):
                section_segments = [seg for seg in frame_segments if seg.get('section_index') == section_idx]
                
                # Find the two line segments for this section
                lines = [seg for seg in section_segments if seg['type'] == 'line']
                
                if len(lines) == 2:
                    # Identify which line is which based on edge_type
                    edge1 = next((l for l in lines if l.get('edge_type') == 'inner_to_start'), None)
                    edge2 = next((l for l in lines if l.get('edge_type') == 'end_to_inner'), None)
                    
                    if edge1 and edge2:
                        result["section_edges"].append({
                            "section_index": section_idx,
                            "edge1_start": edge1["start"],  # Inner vertex
                            "edge1_end": edge1["end"],      # Arc start point
                            "edge2_start": edge2["start"],  # Arc end point
                            "edge2_end": edge2["end"]       # Inner vertex (same as edge1_start)
                        })
                        print(f"[DEBUG] Section {section_idx} edges extracted")
            
            print(f"[DEBUG] Total section edges: {len(result['section_edges'])}")
        
        return result  
    
    def process_and_get_csg_data(
        self,
        state: CompositionStateDTO,
        changed_params: List[str],
        previous_max_amplitude: Optional[float]
    ) -> Dict[str, Any]:
        """
        Process state changes based on processing level and return CSG data.
        
        This is the smart method that orchestrates the optimization.
        
        Args:
            state: The current composition state.
            changed_params: A list of parameters that have changed.
            previous_max_amplitude: The max_amplitude_local from the previous state.
            
        Returns:
            A dictionary containing the 'updated_state' and 'csg_data'.
        """
        # Step 1: Determine what processing is needed and get the updated state.
        updated_state = self._processing_level_service.process_by_level(
            state,
            changed_params,
            previous_max_amplitude
        )
        
        # Step 2: Calculate geometry to get section_local_centers and true_min_radius
        geometry = self._geometry_service.calculate_geometries_dto(updated_state)
        
        # Step 3: Generate CSG data FROM THE NEWLY PROCESSED STATE.
        csg_data = self.get_csg_data(updated_state)
        
        # Step 4: Add geometry data for overlay positioning
        csg_data["section_local_centers"] = geometry.section_local_centers
        csg_data["true_min_radius"] = geometry.true_min_radius

        # Step 5: Return both so the frontend can sync its state.
        return {
            "csg_data": csg_data,
            "updated_state": updated_state
        }
    
    def get_composition_summary(self, state: CompositionStateDTO) -> Dict[str, Any]:
        """
        Get a human-readable summary of the composition.
        
        Args:
            state: The composition state to summarize
            
        Returns:
            Dictionary with summary information
        """
        return self._composition_service.get_composition_summary(state)
    
    def create_default_state(self) -> CompositionStateDTO:
        """
        Create a default composition state by loading it from the ConfigService.
        
        This is a convenience method for creating new projects. It delegates
        to the ConfigService which is the single source of truth for default
        parameters.
        
        Returns:
            New composition state with default values from config
            
        Example:
            facade = WaveformDesignerFacade()
            state = facade.create_default_state()
        """
        return self._config_service.get_default_state()
    
    def process_audio(self, audio_path: str, state: CompositionStateDTO) -> Dict[str, Any]:
        """
        Process an audio file and return the updated state and key geometry metrics.
        
        This is the main entry point for audio processing. It delegates to the
        AudioProcessingService to extract and process amplitudes, calculates the
        corresponding max_amplitude_local, and returns a package with both.
        
        Args:
            audio_path: Path to the audio file to process
            state: Current composition state
            
        Returns:
            A dictionary containing:
                - 'updated_state': New CompositionStateDTO with processed_amplitudes.
                - 'max_amplitude_local': The calculated max amplitude for this state.
            
        Raises:
            ValueError: If audio processing fails
        """
        # Step 1: Process audio to get NORMALIZED amplitudes (0-1) and raw samples
        audio_result = self._audio_processing_service.process_audio_file(audio_path, state)
        
        # Step 2: Calculate geometry for the current state to get the scaling factor
        geometry = self._geometry_service.calculate_geometries_dto(state)
        max_amplitude_local = geometry.max_amplitude_local

        # Step 3: Apply the final scaling to the normalized amplitudes
        # For now, use max_amplitudes as the primary amplitude array
        # TODO: Update to handle both min and max arrays properly
        normalized_amplitudes = audio_result.get("max_amplitudes", audio_result.get("scaled_amplitudes", []))
        scaled_amplitudes = [amp * max_amplitude_local for amp in normalized_amplitudes]
        
        # Step 4: Create the final updated state DTO
        updated_state = state.model_copy(update={"processed_amplitudes": scaled_amplitudes})
        
        return {
            "updated_state": updated_state,
            "max_amplitude_local": max_amplitude_local,
            "raw_samples_for_cache": audio_result["raw_samples_for_cache"]
        }
    
    def get_service_info(self) -> Dict[str, str]:
        """
        Get information about available services for debugging/monitoring.
        
        Returns:
            Dictionary with service names and their status
        """
        return {
            'config_service': 'active',
            'geometry_service': 'active - CSG mode only',
            'slot_generation_service': 'active - CSG data mode',
            'composition_service': 'active',
            'audio_service': 'active',
            'export_service': 'not_implemented',
            'render_service': 'not_implemented'
        }