# services/composition_service.py

from typing import Dict, Any
from services.dtos import CompositionStateDTO
from services.geometry_service import GeometryService  
from services.slot_generation_service import SlotGenerationService
from services.audio_processing_service import AudioProcessingService


class CompositionService:
    """
    Service for orchestrating the complete composition generation process.
    Cleaned version for CSG-based approach.
    """
    
    def __init__(
        self,
        geometry_service: GeometryService,
        slot_generation_service: SlotGenerationService,
        audio_processing_service: AudioProcessingService
    ):
        """
        Initialize the CompositionService with required dependencies.
        
        Args:
            geometry_service: Service for geometric calculations
            slot_generation_service: Service for slot pattern generation
            audio_processing_service: Service for audio processing
        """
        self._geometry_service = geometry_service
        self._slot_generation_service = slot_generation_service
        self._audio_processing_service = audio_processing_service
    
    def generate_full_composition(self, state: CompositionStateDTO) -> CompositionStateDTO:
        """
        Generate a complete composition from the given state.
        
        For CSG approach, this primarily validates the state since
        actual generation happens in the frontend.
        
        Args:
            state: The composition state
            
        Returns:
            The same state (generation happens in frontend)
        """
        # Validate the state
        validation = self.validate_composition(state)
        if not validation['valid']:
            raise ValueError(f"Invalid composition: {validation['errors']}")
        
        # In CSG approach, actual generation happens in frontend
        # Backend just provides the data
        return state
    
    def validate_composition(self, state: CompositionStateDTO) -> Dict[str, Any]:
        """
        Validate a composition state for correctness.
        
        Args:
            state: The composition state to validate
            
        Returns:
            Validation results with 'valid', 'errors', and 'warnings'
        """
        errors = []
        warnings = []
        
        # Validate frame design
        if state.frame_design:
            if state.frame_design.number_sections not in [1, 2, 3, 4]:
                errors = errors + [f"Invalid number_sections: {state.frame_design.number_sections}"]
            
            if state.frame_design.finish_x <= 0 or state.frame_design.finish_y <= 0:
                errors = errors + ["Frame dimensions must be positive"]
            
            if state.frame_design.separation < 0:
                errors = errors + ["Separation cannot be negative"]
        else:
            errors = errors + ["Missing frame_design"]
        
        # Validate pattern settings if present
        if state.pattern_settings:
            if state.pattern_settings.number_slots <= 0:
                errors = errors + ["Number of slots must be positive"]
            
            if state.pattern_settings.bit_diameter <= 0:
                errors = errors + ["Bit diameter must be positive"]
            
            # Check amplitude count matches slot count
            if state.processed_amplitudes:
                expected = state.pattern_settings.number_slots
                actual = len(state.processed_amplitudes)
                if actual != expected:
                    errors = errors + [f"Amplitude count mismatch: expected {expected}, got {actual}"]
        
        # Warnings for optimization
        if state.frame_design and state.pattern_settings:
            if state.pattern_settings.number_slots > 200:
                warnings = warnings + ["High slot count may impact performance"]
            
            if state.frame_design.separation > state.frame_design.finish_y / 4:
                warnings = warnings + ["Large separation may result in small panels"]
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }
    
    def get_composition_summary(self, state: CompositionStateDTO) -> Dict[str, Any]:
        """
        Get a human-readable summary of the composition.
        
        Args:
            state: The composition state to summarize
            
        Returns:
            Dictionary with summary information
        """
        frame = state.frame_design
        pattern = state.pattern_settings
        
        summary = {
            'frame': {
                'shape': frame.shape if frame else 'circular',
                'dimensions': f"{frame.finish_x} x {frame.finish_y}" if frame else "36 x 36",
                'sections': frame.number_sections if frame else 1,
                'separation': frame.separation if frame else 0,
                'material_thickness': frame.material_thickness if frame else 0.375
            },
            'pattern': {
                'style': pattern.slot_style if pattern else 'radial',
                'slots': pattern.number_slots if pattern else 0,
                'bit_diameter': pattern.bit_diameter if pattern else 0.25
            },
            'audio': {
                'has_amplitudes': bool(state.processed_amplitudes),
                'amplitude_count': len(state.processed_amplitudes) if state.processed_amplitudes else 0
            },
            'rendering': {
                'ready_for_csg': bool(frame and pattern)
            }
        }
        
        # Add slots per section if multi-section
        if frame and pattern and frame.number_sections > 1:
            summary['pattern']['slots_per_section'] = pattern.number_slots // frame.number_sections
        
        return summary