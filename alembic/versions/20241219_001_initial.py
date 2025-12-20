"""Initial schema for WaveDesigner configuration

Revision ID: 001_initial
Revises: None
Create Date: 2024-12-19

Creates all tables for Phase 1 database migration:
- Wood materials (species, config)
- Backing materials (types, materials, config)
- Archetypes and constraints
- Manufacturing constraints
- Backgrounds (paints, rooms, config)
- Composition defaults
- Color palettes
- Placement defaults
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ==========================================================================
    # ENUMS (created via raw SQL to avoid conflicts)
    # ==========================================================================
    op.execute("CREATE TYPE shapetype AS ENUM ('circular', 'rectangular', 'diamond')")
    op.execute("CREATE TYPE slotstyle AS ENUM ('radial', 'linear')")
    
    shape_type = postgresql.ENUM("circular", "rectangular", "diamond", name="shapetype", create_type=False)
    slot_style = postgresql.ENUM("radial", "linear", name="slotstyle", create_type=False)
    
    # ==========================================================================
    # WOOD MATERIALS
    # ==========================================================================
    op.create_table(
        "wood_species",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("display", sa.String(100), nullable=False),
        sa.Column("wood_number", sa.String(10), nullable=False),
        sa.Column("sort_order", sa.Integer, default=0),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_wood_species_sort_order", "wood_species", ["sort_order"])
    
    op.create_table(
        "wood_config",
        sa.Column("id", sa.Integer, primary_key=True, default=1),
        sa.Column("valid_grain_directions", postgresql.ARRAY(sa.String), nullable=False),
        sa.Column("default_species", sa.String(50), sa.ForeignKey("wood_species.id"), nullable=False),
        sa.Column("default_grain_direction", sa.String(20), nullable=False),
        sa.Column("texture_config", postgresql.JSONB, nullable=False),
        sa.Column("rendering_config", postgresql.JSONB, nullable=False),
        sa.Column("geometry_constants", postgresql.JSONB, nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # ==========================================================================
    # BACKING MATERIALS
    # ==========================================================================
    op.create_table(
        "backing_type_configs",
        sa.Column("type", sa.String(20), primary_key=True),
        sa.Column("display_name", sa.String(50), nullable=False),
        sa.Column("thickness_inches", sa.Float, nullable=False),
        sa.Column("inset_inches", sa.Float, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("sort_order", sa.Integer, default=0),
        sa.Column("is_active", sa.Boolean, default=True),
    )
    
    op.create_table(
        "backing_materials",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("backing_type_id", sa.String(20), sa.ForeignKey("backing_type_configs.type"), nullable=False),
        sa.Column("material_id", sa.String(50), nullable=False),
        sa.Column("display", sa.String(100), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("color_rgb", postgresql.ARRAY(sa.Float), nullable=False),
        sa.Column("alpha", sa.Float, default=1.0),
        sa.Column("pbr_properties", postgresql.JSONB, nullable=False),
        sa.Column("texture_files", postgresql.JSONB),
        sa.Column("sort_order", sa.Integer, default=0),
        sa.Column("is_active", sa.Boolean, default=True),
    )
    op.create_index("ix_backing_materials_type", "backing_materials", ["backing_type_id"])
    
    op.create_table(
        "backing_config",
        sa.Column("id", sa.Integer, primary_key=True, default=1),
        sa.Column("default_enabled", sa.Boolean, default=False),
        sa.Column("default_type", sa.String(20), sa.ForeignKey("backing_type_configs.type")),
        sa.Column("default_material", sa.String(50)),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # ==========================================================================
    # ARCHETYPES
    # ==========================================================================
    op.create_table(
        "archetypes",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("shape", shape_type, nullable=False),
        sa.Column("slot_style", slot_style, nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("tooltip", sa.Text),
        sa.Column("thumbnail", sa.String(255)),
        sa.Column("number_sections", sa.Integer, nullable=False),
        sa.Column("available_grains", postgresql.ARRAY(sa.String), nullable=False),
        sa.Column("number_slots", sa.Integer, nullable=False),
        sa.Column("separation", sa.Float, default=0),
        sa.Column("side_margin", sa.Float),
        sa.Column("sort_order", sa.Integer, default=0),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_archetypes_shape_style", "archetypes", ["shape", "slot_style"])
    
    op.create_table(
        "archetype_constraints",
        sa.Column("archetype_id", sa.String(50), sa.ForeignKey("archetypes.id"), primary_key=True),
        sa.Column("available_sliders", postgresql.ARRAY(sa.String), nullable=False),
        sa.Column("size_constraint", postgresql.JSONB),
        sa.Column("width_constraint", postgresql.JSONB),
        sa.Column("height_constraint", postgresql.JSONB),
        sa.Column("slots_constraint", postgresql.JSONB),
        sa.Column("separation_constraint", postgresql.JSONB),
        sa.Column("side_margin_constraint", postgresql.JSONB),
    )
    
    # ==========================================================================
    # MANUFACTURING CONSTRAINTS
    # ==========================================================================
    op.create_table(
        "manufacturing_constraints",
        sa.Column("id", sa.Integer, primary_key=True, default=1),
        sa.Column("version", sa.String(20), default="2.0.0"),
        sa.Column("description", sa.Text),
        sa.Column("valid_shapes", postgresql.ARRAY(sa.String), nullable=False),
        sa.Column("cnc_max_x", sa.Float, nullable=False),
        sa.Column("cnc_max_y", sa.Float, nullable=False),
        sa.Column("circular_constraints", postgresql.JSONB, nullable=False),
        sa.Column("rectangular_constraints", postgresql.JSONB, nullable=False),
        sa.Column("diamond_constraints", postgresql.JSONB, nullable=False),
        sa.Column("slot_style_constraints", postgresql.JSONB, nullable=False),
        sa.Column("scene_constraints", postgresql.JSONB),
        sa.Column("ui_visibility", postgresql.JSONB),
        sa.Column("audio_constraints", postgresql.JSONB),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # ==========================================================================
    # BACKGROUNDS
    # ==========================================================================
    op.create_table(
        "background_paints",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("group_name", sa.String(50), nullable=False),
        sa.Column("rgb", postgresql.ARRAY(sa.Float)),
        sa.Column("texture_path", sa.String(255)),
        sa.Column("sort_order", sa.Integer, default=0),
        sa.Column("is_active", sa.Boolean, default=True),
    )
    
    op.create_table(
        "background_rooms",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("path", sa.String(255), nullable=False),
        sa.Column("foreground_path", sa.String(255)),
        sa.Column("wall_compensation", sa.Float, default=1.0),
        sa.Column("art_placement", postgresql.JSONB, nullable=False),
        sa.Column("lighting", postgresql.JSONB, nullable=False),
        sa.Column("sort_order", sa.Integer, default=0),
        sa.Column("is_active", sa.Boolean, default=True),
    )
    
    op.create_table(
        "background_config",
        sa.Column("id", sa.Integer, primary_key=True, default=1),
        sa.Column("default_room", sa.String(50), sa.ForeignKey("background_rooms.id")),
        sa.Column("default_wall_finish", sa.String(50), sa.ForeignKey("background_paints.id")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # ==========================================================================
    # COMPOSITION DEFAULTS
    # ==========================================================================
    op.create_table(
        "composition_defaults",
        sa.Column("id", sa.Integer, primary_key=True, default=1),
        sa.Column("frame_design", postgresql.JSONB, nullable=False),
        sa.Column("pattern_settings", postgresql.JSONB, nullable=False),
        sa.Column("audio_source", postgresql.JSONB, nullable=False),
        sa.Column("audio_processing", postgresql.JSONB, nullable=False),
        sa.Column("peak_control", postgresql.JSONB, nullable=False),
        sa.Column("visual_correction", postgresql.JSONB, nullable=False),
        sa.Column("display_settings", postgresql.JSONB, nullable=False),
        sa.Column("export_settings", postgresql.JSONB, nullable=False),
        sa.Column("artistic_rendering", postgresql.JSONB, nullable=False),
        sa.Column("processed_amplitudes", postgresql.JSONB, default=[]),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    op.create_table(
        "color_palettes",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("color_deep", postgresql.ARRAY(sa.Float), nullable=False),
        sa.Column("color_mid", postgresql.ARRAY(sa.Float), nullable=False),
        sa.Column("color_light", postgresql.ARRAY(sa.Float), nullable=False),
        sa.Column("paper_color", postgresql.ARRAY(sa.Float), nullable=False),
        sa.Column("sort_order", sa.Integer, default=0),
        sa.Column("is_active", sa.Boolean, default=True),
    )
    
    op.create_table(
        "placement_defaults",
        sa.Column("id", sa.Integer, primary_key=True, default=1),
        sa.Column("scene_overrides", postgresql.JSONB, default={}),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    # Drop tables in reverse order (respecting foreign keys)
    op.drop_table("placement_defaults")
    op.drop_table("color_palettes")
    op.drop_table("composition_defaults")
    op.drop_table("background_config")
    op.drop_table("background_rooms")
    op.drop_table("background_paints")
    op.drop_table("manufacturing_constraints")
    op.drop_table("archetype_constraints")
    op.drop_table("archetypes")
    op.drop_table("backing_config")
    op.drop_table("backing_materials")
    op.drop_table("backing_type_configs")
    op.drop_table("wood_config")
    op.drop_table("wood_species")
    
    # Drop enums
    op.execute("DROP TYPE IF EXISTS slotstyle")
    op.execute("DROP TYPE IF EXISTS shapetype")