"""Configuration service for loading default application state."""

import json
from pathlib import Path

from services.dtos import CompositionStateDTO


class ConfigService:
    """Service for managing application configuration and default state."""
    
    def __init__(self, config_path: Path) -> None:
        """Initialize the configuration service.
        
        Args:
            config_path: Path to the JSON configuration file.
        """
        with open(config_path, 'r') as f:
            config_data = json.load(f)
        
        # Store raw config data for accessing non-DTO fields like wood_materials
        self._config_data = config_data
        self._default_state = CompositionStateDTO(**config_data)
    
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
        return self._config_data.get('wood_materials', {})    