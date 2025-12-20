"""
Configuration service factory for WaveDesigner.

Provides environment-based switching between JSON and database configuration.

Environment Variables:
    USE_DATABASE: Set to "true" to use PostgreSQL, otherwise uses JSON files
    
Usage:
    from services.config_loader import get_config_service
    
    config = get_config_service()
    archetypes = config.get_archetypes()
"""

import os
from functools import lru_cache
from pathlib import Path
from typing import Union

from services.config_service import ConfigService


def use_database() -> bool:
    """Check if database configuration is enabled."""
    return os.environ.get("USE_DATABASE", "").lower() == "true"


@lru_cache(maxsize=1)
def get_config_service() -> Union[ConfigService, "DatabaseConfigService"]:
    """
    Get configuration service based on environment.
    
    Returns ConfigService (JSON) or DatabaseConfigService (PostgreSQL)
    based on USE_DATABASE environment variable.
    
    Uses lru_cache to ensure single instance per process.
    
    Returns:
        Configuration service instance
    """
    if use_database():
        from services.database_config_service import DatabaseConfigService
        print("[Config] Using DatabaseConfigService (PostgreSQL)")
        return DatabaseConfigService()
    else:
        project_root = Path(__file__).resolve().parent.parent
        config_dir = project_root / "config"
        print(f"[Config] Using ConfigService (JSON from {config_dir})")
        return ConfigService(config_dir)


def clear_config_cache() -> None:
    """
    Clear cached config service instance.
    
    Call after database updates (e.g., from admin panel) to force reload.
    """
    get_config_service.cache_clear()


def refresh_config() -> None:
    """
    Refresh configuration from source.
    
    For database: reloads from PostgreSQL
    For JSON: clears cache and reloads files
    """
    clear_config_cache()
    service = get_config_service()
    
    # DatabaseConfigService has refresh(), ConfigService doesn't need it
    if hasattr(service, "refresh"):
        service.refresh()