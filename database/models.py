"""
SQLAlchemy models for WaveDesigner configuration database.

Schema Design Principles:
- Normalize where relationships exist (backing_types -> backing_materials)
- Keep JSONB for complex nested structures (lighting, pbr_properties)
- Use enums for fixed categorical values
- Maintain referential integrity for admin panel operations
"""

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, 
    ForeignKey, Enum, JSON, DateTime, Index
)
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
import enum

Base = declarative_base()


# =============================================================================
# ENUMS
# =============================================================================

class ShapeType(enum.Enum):
    circular = "circular"
    rectangular = "rectangular"
    diamond = "diamond"


class SlotStyle(enum.Enum):
    radial = "radial"
    linear = "linear"


class GrainDirection(enum.Enum):
    horizontal = "horizontal"
    vertical = "vertical"
    radiant = "radiant"
    diamond = "diamond"


class BackingType(enum.Enum):
    acrylic = "acrylic"
    cloth = "cloth"
    leather = "leather"
    foam = "foam"


# =============================================================================
# WOOD MATERIALS
# =============================================================================

class WoodSpecies(Base):
    """Wood species catalog - maps to species_catalog in wood_materials.json"""
    __tablename__ = "wood_species"
    
    id = Column(String(50), primary_key=True)  # e.g., "walnut-black-american"
    display = Column(String(100), nullable=False)
    wood_number = Column(String(10), nullable=False)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        Index("ix_wood_species_sort_order", "sort_order"),
    )


class WoodConfig(Base):
    """
    Singleton table for wood material global configuration.
    Stores texture_config, rendering_config, geometry_constants, defaults.
    """
    __tablename__ = "wood_config"
    
    id = Column(Integer, primary_key=True, default=1)
    valid_grain_directions = Column(ARRAY(String), nullable=False)
    default_species = Column(String(50), ForeignKey("wood_species.id"), nullable=False)
    default_grain_direction = Column(String(20), nullable=False)
    texture_config = Column(JSONB, nullable=False)  # size_thresholds, size_map, base_path
    rendering_config = Column(JSONB, nullable=False)  # grain_rotation, direction_angles
    geometry_constants = Column(JSONB, nullable=False)  # section_positioning_angles, offsets
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


# =============================================================================
# BACKING MATERIALS
# =============================================================================

class BackingTypeConfig(Base):
    """Backing type configuration - parent for backing materials"""
    __tablename__ = "backing_type_configs"
    
    type = Column(String(20), primary_key=True)  # acrylic, cloth, leather, foam
    display_name = Column(String(50), nullable=False)
    thickness_inches = Column(Float, nullable=False)
    inset_inches = Column(Float, nullable=False)
    description = Column(Text)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    
    materials = relationship("BackingMaterial", back_populates="backing_type", cascade="all, delete-orphan")


class BackingMaterial(Base):
    """Individual backing material within a type"""
    __tablename__ = "backing_materials"
    
    id = Column(String(50), primary_key=True)  # Composite: type + material_id
    backing_type_id = Column(String(20), ForeignKey("backing_type_configs.type"), nullable=False)
    material_id = Column(String(50), nullable=False)  # e.g., "white", "black", "bison"
    display = Column(String(100), nullable=False)
    description = Column(Text)
    color_rgb = Column(ARRAY(Float), nullable=False)  # [r, g, b]
    alpha = Column(Float, default=1.0)
    pbr_properties = Column(JSONB, nullable=False)  # metallic, roughness, clearcoat...
    texture_files = Column(JSONB)  # diffuse, normal, roughness paths (nullable for acrylics)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    
    backing_type = relationship("BackingTypeConfig", back_populates="materials")
    
    __table_args__ = (
        Index("ix_backing_materials_type", "backing_type_id"),
    )


class BackingConfig(Base):
    """Singleton for backing global defaults"""
    __tablename__ = "backing_config"
    
    id = Column(Integer, primary_key=True, default=1)
    default_enabled = Column(Boolean, default=False)
    default_type = Column(String(20), ForeignKey("backing_type_configs.type"))
    default_material = Column(String(50))  # References material_id within the type
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


# =============================================================================
# ARCHETYPES
# =============================================================================

class Archetype(Base):
    """
    Design archetypes - combinations of shape/slot_style/sections.
    Maps to archetypes.json entries.
    """
    __tablename__ = "archetypes"
    
    id = Column(String(50), primary_key=True)  # e.g., "circular_radial_n2"
    shape = Column(Enum(ShapeType), nullable=False)
    slot_style = Column(Enum(SlotStyle), nullable=False)
    label = Column(String(100), nullable=False)
    tooltip = Column(Text)
    thumbnail = Column(String(255))  # Asset path
    number_sections = Column(Integer, nullable=False)
    available_grains = Column(ARRAY(String), nullable=False)
    number_slots = Column(Integer, nullable=False)
    separation = Column(Float, default=0)
    side_margin = Column(Float)  # Only for linear slot styles
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    constraints = relationship("ArchetypeConstraint", back_populates="archetype", uselist=False)
    
    __table_args__ = (
        Index("ix_archetypes_shape_style", "shape", "slot_style"),
    )


class ArchetypeConstraint(Base):
    """
    Per-archetype dimension constraints.
    Maps to archetype_constraints in constraints.json.
    """
    __tablename__ = "archetype_constraints"
    
    archetype_id = Column(String(50), ForeignKey("archetypes.id"), primary_key=True)
    available_sliders = Column(ARRAY(String), nullable=False)
    
    # All sliders have min/max/step stored as JSONB for flexibility
    size_constraint = Column(JSONB)  # {"min": 24, "max": 30, "step": 1}
    width_constraint = Column(JSONB)
    height_constraint = Column(JSONB)
    slots_constraint = Column(JSONB)
    separation_constraint = Column(JSONB)
    side_margin_constraint = Column(JSONB)
    
    archetype = relationship("Archetype", back_populates="constraints")


# =============================================================================
# MANUFACTURING CONSTRAINTS
# =============================================================================

class ManufacturingConstraints(Base):
    """
    Global manufacturing constraints.
    Maps to manufacturing section of constraints.json.
    """
    __tablename__ = "manufacturing_constraints"
    
    id = Column(Integer, primary_key=True, default=1)
    version = Column(String(20), default="2.0.0")
    description = Column(Text)
    valid_shapes = Column(ARRAY(String), nullable=False)
    
    # CNC table limits
    cnc_max_x = Column(Float, nullable=False)
    cnc_max_y = Column(Float, nullable=False)
    
    # Shape-specific constraints as JSONB
    circular_constraints = Column(JSONB, nullable=False)  # general + by_section_count
    rectangular_constraints = Column(JSONB, nullable=False)  # width/height min/max
    diamond_constraints = Column(JSONB, nullable=False)
    slot_style_constraints = Column(JSONB, nullable=False)  # x_offset by style
    
    # Scene constraints
    scene_constraints = Column(JSONB)  # max_height per scene
    
    # UI visibility rules
    ui_visibility = Column(JSONB)  # show_when conditions
    
    # Audio constraints
    audio_constraints = Column(JSONB)  # mime_types, extensions, max_size
    
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


# =============================================================================
# BACKGROUNDS / STAGING
# =============================================================================

class BackgroundPaint(Base):
    """Wall paint colors for staging"""
    __tablename__ = "background_paints"
    
    id = Column(String(50), primary_key=True)  # e.g., "soft-white"
    name = Column(String(100), nullable=False)
    description = Column(Text)
    group_name = Column(String(50), nullable=False)  # Whites, Warm Neutrals, Textures
    rgb = Column(ARRAY(Float))  # [r, g, b] - nullable for texture-based paints
    texture_path = Column(String(255))  # For texture-based (brick, wood planks)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)


class BackgroundRoom(Base):
    """Room scenes for staging"""
    __tablename__ = "background_rooms"
    
    id = Column(String(50), primary_key=True)  # e.g., "living-room-modern"
    name = Column(String(100), nullable=False)
    description = Column(Text)
    path = Column(String(255), nullable=False)  # Background image path
    foreground_path = Column(String(255))  # Optional foreground overlay
    wall_compensation = Column(Float, default=1.0)
    
    # Art placement configuration
    art_placement = Column(JSONB, nullable=False)  # anchor, position, scale_factor, rotation
    
    # Lighting configuration
    lighting = Column(JSONB, nullable=False)  # direction, shadow settings, ambient
    
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)


class BackgroundConfig(Base):
    """Singleton for background defaults"""
    __tablename__ = "background_config"
    
    id = Column(Integer, primary_key=True, default=1)
    default_room = Column(String(50), ForeignKey("background_rooms.id"))
    default_wall_finish = Column(String(50), ForeignKey("background_paints.id"))
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


# =============================================================================
# COMPOSITION DEFAULTS
# =============================================================================

class CompositionDefaults(Base):
    """
    Default composition state.
    Maps to composition_defaults.json.
    Stored as JSONB to match DTO structure exactly.
    """
    __tablename__ = "composition_defaults"
    
    id = Column(Integer, primary_key=True, default=1)
    
    # Store as structured JSONB to match CompositionStateDTO
    frame_design = Column(JSONB, nullable=False)
    pattern_settings = Column(JSONB, nullable=False)
    audio_source = Column(JSONB, nullable=False)
    audio_processing = Column(JSONB, nullable=False)
    peak_control = Column(JSONB, nullable=False)
    visual_correction = Column(JSONB, nullable=False)
    display_settings = Column(JSONB, nullable=False)
    export_settings = Column(JSONB, nullable=False)
    artistic_rendering = Column(JSONB, nullable=False)
    processed_amplitudes = Column(JSONB, default=[])
    
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ColorPalette(Base):
    """Artistic rendering color palettes"""
    __tablename__ = "color_palettes"
    
    id = Column(String(50), primary_key=True)  # e.g., "ocean", "sunset"
    color_deep = Column(ARRAY(Float), nullable=False)  # [r, g, b, a]
    color_mid = Column(ARRAY(Float), nullable=False)
    color_light = Column(ARRAY(Float), nullable=False)
    paper_color = Column(ARRAY(Float), nullable=False)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)


# =============================================================================
# PLACEMENT DEFAULTS (Per-scene overrides)
# =============================================================================

class PlacementDefaults(Base):
    """
    Scene-specific placement default overrides.
    Maps to placement_defaults.json.
    """
    __tablename__ = "placement_defaults"
    
    id = Column(Integer, primary_key=True, default=1)
    
    # Per-scene configuration as JSONB
    # Structure: {"scene_id": {"position": [...], "scale_factor": ...}}
    scene_overrides = Column(JSONB, default={})
    
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())