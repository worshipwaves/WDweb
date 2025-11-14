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
        
        self._constraints: dict
        
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
        
        constraints_path = config_dir / 'constraints.json'
        if not constraints_path.exists():
            raise FileNotFoundError(f"CRITICAL: constraints.json not found at {constraints_path}")
        with open(constraints_path, 'r') as f:
            self._constraints = json.load(f)
    
    def get_default_state(self) -> CompositionStateDTO:
        """Return the default application state.
        
        Returns:
            The default CompositionStateDTO instance.
        """
        return self._default_state
        
    def get_constraints_config(self) -> dict:
        """Return manufacturing and scene constraints configuration.
        
        Returns:
            Dictionary with constraints configuration.
        """
        return self._constraints      
        
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
        mfg = self._constraints['manufacturing']
        return {
            'circular': {
                'min_dimension': float(mfg['circular']['general']['min']),
                'max_dimension': float(mfg['circular']['general']['max'])
            },
            'rectangular': {
                'min_dimension': float(mfg['rectangular']['width']['min']),
                'max_dimension': float(mfg['rectangular']['width']['max'])
            },
            'diamond': {
                'min_dimension': float(mfg['diamond']['width']['min']),
                'max_dimension': float(mfg['diamond']['width']['max'])
            }
        }    

    def get_placement_defaults(self) -> dict:
        """Return scene placement default overrides.
        
        Returns:
            Dictionary with placement defaults configuration.
        """
        return self._placement_defaults.model_dump()