# tests/test_composition_service.py

# tests/test_composition_service.py

import pytest
from services.dtos import CompositionStateDTO, FrameDesignDTO, PatternSettingsDTO
from services.geometry_service import GeometryService
from services.slot_generation_service import SlotGenerationService
from services.composition_service import CompositionService
from services.audio_processing_service import AudioProcessingService
from services.service_facade import WaveformDesignerFacade


class TestCompositionService:
    """Test suite for CompositionService."""
    
    def test_composition_service_instantiation(self):
        """Test that CompositionService can be instantiated with dependencies."""
        geometry_service = GeometryService()
        audio_service = AudioProcessingService()
        slot_service = SlotGenerationService(audio_service=audio_service)
        
        composition_service = CompositionService(
            geometry_service=geometry_service,
            slot_generation_service=slot_service,
            audio_processing_service=audio_service
        )
        
        assert composition_service is not None
        assert composition_service._geometry_service == geometry_service
        assert composition_service._slot_generation_service == slot_service
        assert composition_service._audio_processing_service == audio_service
    
    def test_generate_full_composition_without_amplitudes(self):
        """Test generating composition without amplitude data."""
        # Setup services
        geometry_service = GeometryService()
        audio_service = AudioProcessingService()
        slot_service = SlotGenerationService(audio_service)
        composition_service = CompositionService(geometry_service, slot_service, audio_service)
        
        # Create a basic state
        state = CompositionStateDTO()
        
        # Generate composition
        result = composition_service.generate_full_composition(state)
        
        # Should return state (currently unchanged)
        assert result == state
    
    def test_generate_full_composition_with_amplitudes(self):
        """Test generating composition with amplitude data."""
        # Setup services
        geometry_service = GeometryService()
        audio_service = AudioProcessingService()
        slot_service = SlotGenerationService(audio_service)
        composition_service = CompositionService(geometry_service, slot_service, audio_service)
        
        # Create state with amplitudes
        num_slots = 48
        amplitudes = [0.5] * num_slots
        state = CompositionStateDTO(
            pattern_settings=PatternSettingsDTO(number_slots=num_slots),
            processed_amplitudes=amplitudes
        )
        
        # Generate composition
        result = composition_service.generate_full_composition(state)
        
        # Should return state (currently unchanged)
        assert result == state
    
    def test_validate_composition_valid_state(self):
        """Test validation with a valid state."""
        audio_service = AudioProcessingService()
        composition_service = CompositionService(
            GeometryService(),
            SlotGenerationService(audio_service),
            audio_service
        )
        
        state = CompositionStateDTO(
            frame_design=FrameDesignDTO(number_sections=2),
            pattern_settings=PatternSettingsDTO(number_slots=48),
            processed_amplitudes=[0.5] * 48
        )
        
        validation = composition_service.validate_composition(state)
        
        assert validation['valid'] is True
        assert len(validation['errors']) == 0
    
    def test_validate_composition_invalid_state(self):
        """Test validation with invalid state."""
        audio_service = AudioProcessingService()
        composition_service = CompositionService(
            GeometryService(),
            SlotGenerationService(audio_service),
            audio_service
        )
        
        # Create state with mismatched amplitude count
        state = CompositionStateDTO(
            pattern_settings=PatternSettingsDTO(number_slots=48),
            processed_amplitudes=[0.5] * 24  # Wrong count
        )
        
        validation = composition_service.validate_composition(state)
        
        assert validation['valid'] is False
        assert len(validation['errors']) > 0
        assert "Amplitude count" in validation['errors'][0]
    
    def test_get_composition_summary(self):
        """Test getting composition summary."""
        audio_service = AudioProcessingService()
        composition_service = CompositionService(
            GeometryService(),
            SlotGenerationService(audio_service),
            audio_service
        )
        
        state = CompositionStateDTO()
        summary = composition_service.get_composition_summary(state)
        
        assert 'frame' in summary
        assert 'pattern' in summary
        assert 'audio' in summary
        assert 'rendering' in summary
        assert summary['frame']['sections'] == 2  # Default value


class TestWaveformDesignerFacade:
    """Test suite for WaveformDesignerFacade."""
    
    def test_facade_instantiation(self):
        """Test that the facade can be instantiated."""
        facade = WaveformDesignerFacade()
        
        assert facade is not None
        assert facade._config_service is not None
        assert facade._geometry_service is not None
        assert facade._slot_generation_service is not None
        assert facade._composition_service is not None
    
    def test_facade_generate_composition(self):
        """Test generating composition through the facade."""
        facade = WaveformDesignerFacade()
        state = facade.create_default_state()
        
        result = facade.generate_composition(state)
        
        assert result == state  # Currently just returns the state unchanged
    
    def test_facade_validate_composition(self):
        """Test validation through the facade."""
        facade = WaveformDesignerFacade()
        state = facade.create_default_state()
        
        validation = facade.validate_composition(state)
        
        assert 'valid' in validation
        assert 'errors' in validation
        assert 'warnings' in validation
    
    def test_facade_get_frame_geometry(self):
        """Test getting frame geometry through the facade."""
        facade = WaveformDesignerFacade()
        state = facade.create_default_state()
        state = state.model_copy(update={
            'frame_design': state.frame_design.model_copy(update={'number_sections': 2})
        })
        
        geometry = facade.get_frame_geometry(state)
        
        assert isinstance(geometry, list)
        assert len(geometry) == 4  # 2 arcs + 2 lines for n=2
    
    def test_facade_get_slot_coordinates_with_amplitudes(self):
        """Test getting slot coordinates through the facade."""
        facade = WaveformDesignerFacade()
        num_slots = 48
        state = facade.create_default_state()
        state = state.model_copy(update={
            'pattern_settings': state.pattern_settings.model_copy(update={'number_slots': num_slots}),
            'processed_amplitudes': [0.5] * num_slots
        })
        
        slots = facade.get_slot_coordinates(state)
        
        assert isinstance(slots, list)
        assert len(slots) == num_slots
    
    def test_facade_get_slot_coordinates_without_amplitudes(self):
        """Test that getting slots without amplitudes raises error."""
        facade = WaveformDesignerFacade()
        state = facade.create_default_state()
        
        with pytest.raises(ValueError, match="Cannot generate slots without processed amplitudes"):
            facade.get_slot_coordinates(state)
    
    def test_facade_create_default_state(self):
        """Test creating default state through facade."""
        facade = WaveformDesignerFacade()
        
        # Create with defaults from ConfigService
        state = facade.create_default_state()
        
        # Verify it returns a valid CompositionStateDTO
        assert isinstance(state, CompositionStateDTO)
        assert state.frame_design is not None
        assert state.pattern_settings is not None
        
        # Verify some default values are present
        assert state.frame_design.shape == 'circular'
        assert state.frame_design.number_sections == 2
        assert state.pattern_settings.slot_style == 'radial'
    
    def test_facade_get_composition_summary(self):
        """Test getting summary through facade."""
        facade = WaveformDesignerFacade()
        state = facade.create_default_state()
        
        summary = facade.get_composition_summary(state)
        
        assert isinstance(summary, dict)
        assert 'frame' in summary
        assert summary['frame']['shape'] == 'circular'
    
    def test_facade_get_service_info(self):
        """Test getting service info through facade."""
        facade = WaveformDesignerFacade()
        
        info = facade.get_service_info()
        
        assert 'config_service' in info
        assert 'geometry_service' in info
        assert 'composition_service' in info
        assert info['config_service'] == 'active'
        assert info['geometry_service'] == 'active - CSG mode only'
        assert info['composition_service'] == 'active'
        assert info['audio_service'] == 'not_implemented'


class TestIntegration:
    """Integration tests for the complete service stack."""
    
    def test_end_to_end_composition_generation(self):
        """Test complete composition generation flow."""
        # Create facade (single entry point)
        facade = WaveformDesignerFacade()
        
        # Create a complete state with all parameters
        num_slots = 96
        state = facade.create_default_state()
        state = state.model_copy(update={
            'frame_design': state.frame_design.model_copy(update={
                'finish_x': 24.0,
                'finish_y': 24.0,
                'number_sections': 4,
                'separation': 1.5
            }),
            'pattern_settings': state.pattern_settings.model_copy(update={
                'number_slots': num_slots,
                'bit_diameter': 0.25,
                'spacer': 0.5,
                'x_offset': 0.75,
                'y_offset': 2.0
            }),
            'processed_amplitudes': [0.3 + (i * 0.005) for i in range(num_slots)]
        })
        
        # Validate the state
        validation = facade.validate_composition(state)
        assert validation['valid'] is True
        
        # Generate the composition
        result = facade.generate_composition(state)
        assert result is not None
        
        # Get individual components
        geometry = facade.get_frame_geometry(state)
        assert len(geometry) == 12  # 4 arcs + 8 lines for n=4
        
        slots = facade.get_slot_coordinates(state)
        assert len(slots) == num_slots
        
        # Get summary
        summary = facade.get_composition_summary(state)
        assert summary['frame']['sections'] == 4
        assert summary['pattern']['slots'] == num_slots
        assert summary['pattern']['slots_per_section'] == 24
        assert summary['audio']['has_amplitudes'] is True