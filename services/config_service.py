"""Configuration service for loading default application state."""
import json
from pathlib import Path
from services.dtos import CompositionStateDTO, PlacementDefaultsDTO

class ConfigService:
    """Service for managing application configuration and default state."""
    
    def __init__(self, config_dir: Path) -> None:
        """Initialize the configuration service.
        
        Args:
            config_dir: Path to the configuration directory.
        """
        # Load composition defaults for DTO
        with open(config_dir / 'composition_defaults.json', 'r') as f:
            composition_data = json.load(f)
        self._default_state = CompositionStateDTO(**composition_data)
        
        # Load other configs
        with open(config_dir / 'wood_materials.json', 'r') as f:
            self._wood_materials = json.load(f)
        
        with open(config_dir / 'archetypes.json', 'r') as f:
            self._archetypes = json.load(f)
        
        with open(config_dir / 'ui_config.json', 'r') as f:
            self._ui_config = json.load(f)
            
        with open(config_dir / 'backgrounds_config.json', 'r') as f:
            self._backgrounds = json.load(f)
        
        with open(config_dir / 'backing_materials.json', 'r') as f:
            self._backing_materials = json.load(f) 

        with open(config_dir / 'placement_defaults.json', 'r') as f:
            placement_data = json.load(f)
        self._placement_defaults = PlacementDefaultsDTO(**placement_data)    
    
    def get_default_state(self) -> CompositionStateDTO:
        """Return the default application state.
        
        Returns:
            The default CompositionStateDTO instance.
        """
        return self._default_state
        
    def get_wood_materials_config(self) -> dict:
        """Return wood materials configuration.
        
        Returns:
            Dictionary with wood materials configuration.
        """
        return self._wood_materials
    
    def get_archetypes(self) -> dict:
        """Return archetype definitions.
        
        Returns:
            Dictionary with archetype definitions.
        """
        return self._archetypes
    
    def get_ui_config(self) -> dict:
        """Return UI configuration.
        
        Returns:
            Dictionary with UI configuration.
        """
        return self._ui_config
    
    def get_composition_defaults(self) -> dict:
        """Return composition defaults as dict.
        
        Returns:
            Dictionary with composition default values.
        """
        return self._default_state.model_dump()
        
    def get_backgrounds_config(self) -> dict:
        """Return backgrounds configuration.
        
        Returns:
            Dictionary with backgrounds configuration.
        """
        return self._backgrounds    
        
    def get_backing_materials_config(self) -> dict:
        """Return backing materials configuration.
        
        Returns:
            Dictionary with backing materials configuration.
        """
        return self._backing_materials
        
    def get_dimension_constraints(self) -> dict:
        """Return dimension constraints configuration.
        
        Returns:
            Dictionary with dimension constraints for all shapes.
        """
        return self._ui_config.get('dimension_constraints', {
            'circular': {'min_dimension': 8.0, 'max_dimension': 84.0},
            'rectangular': {'min_dimension': 8.0, 'max_dimension': 84.0},
            'diamond': {'min_dimension': 8.0, 'max_dimension': 84.0}
        })    

    def get_placement_defaults(self) -> dict:
        """Return scene placement default overrides.
        
        Returns:
            Dictionary with placement defaults configuration.
        """
        return self._placement_defaults.model_dump()