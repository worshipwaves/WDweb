"""Database package for WaveDesigner configuration storage."""

from database.connection import get_db, engine, init_db, SessionLocal
from database.models import (
    Base,
    # Wood
    WoodSpecies,
    WoodConfig,
    # Backing
    BackingTypeConfig,
    BackingMaterial,
    BackingConfig,
    # Archetypes
    Archetype,
    ArchetypeConstraint,
    # Constraints
    ManufacturingConstraints,
    # Backgrounds
    BackgroundPaint,
    BackgroundRoom,
    BackgroundConfig,
    # Composition
    CompositionDefaults,
    ColorPalette,
    PlacementDefaults,
)

__all__ = [
    # Connection
    "get_db",
    "engine", 
    "init_db",
    "SessionLocal",
    "Base",
    # Models
    "WoodSpecies",
    "WoodConfig",
    "BackingTypeConfig",
    "BackingMaterial",
    "BackingConfig",
    "Archetype",
    "ArchetypeConstraint",
    "ManufacturingConstraints",
    "BackgroundPaint",
    "BackgroundRoom",
    "BackgroundConfig",
    "CompositionDefaults",
    "ColorPalette",
    "PlacementDefaults",
]