#!/usr/bin/env python
"""
Seed database from existing JSON configuration files.

Usage:
    python scripts/seed_database.py
    python scripts/seed_database.py --clear  # Clear existing data first
    
Reads config files from ./config/ and populates PostgreSQL database.
"""

import argparse
import json
import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from database import (
    get_db, init_db,
    WoodSpecies, WoodConfig,
    BackingTypeConfig, BackingMaterial, BackingConfig,
    Archetype, ArchetypeConstraint,
    ManufacturingConstraints,
    BackgroundPaint, BackgroundRoom, BackgroundConfig,
    CompositionDefaults, ColorPalette,
    PlacementDefaults,
    UIConfig,
)


CONFIG_DIR = PROJECT_ROOT / "config"


def load_json(filename: str) -> dict:
    """Load JSON file from config directory."""
    path = CONFIG_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def clear_database(session) -> None:
    """Clear all data from database tables."""
    print("Clearing existing data...")
    
    # Delete in dependency order
    session.query(UIConfig).delete()
    session.query(PlacementDefaults).delete()
    session.query(ColorPalette).delete()
    session.query(CompositionDefaults).delete()
    session.query(BackgroundConfig).delete()
    session.query(BackgroundRoom).delete()
    session.query(BackgroundPaint).delete()
    session.query(ManufacturingConstraints).delete()
    session.query(ArchetypeConstraint).delete()
    session.query(Archetype).delete()
    session.query(BackingConfig).delete()
    session.query(BackingMaterial).delete()
    session.query(BackingTypeConfig).delete()
    session.query(WoodConfig).delete()
    session.query(WoodSpecies).delete()
    
    session.commit()
    print("  Done.")


def seed_wood_materials(session) -> None:
    """Seed wood_materials.json data."""
    print("Seeding wood materials...")
    data = load_json("wood_materials.json")
    
    # Insert species
    for idx, species in enumerate(data["species_catalog"]):
        session.add(WoodSpecies(
            id=species["id"],
            display=species["display"],
            wood_number=species["wood_number"],
            sort_order=idx,
            is_active=True
        ))
    
    session.flush()  # Ensure species exist for FK
    
    # Insert config (singleton)
    session.add(WoodConfig(
        id=1,
        valid_grain_directions=data["valid_grain_directions"],
        default_species=data["default_species"],
        default_grain_direction=data["default_grain_direction"],
        texture_config=data["texture_config"],
        rendering_config=data["rendering_config"],
        geometry_constants=data["geometry_constants"],
    ))
    
    print(f"  Inserted {len(data['species_catalog'])} wood species")


def seed_backing_materials(session) -> None:
    """Seed backing_materials.json data."""
    print("Seeding backing materials...")
    data = load_json("backing_materials.json")
    
    type_order = {"acrylic": 0, "cloth": 1, "leather": 2, "foam": 3}
    
    for type_id, type_data in data["material_catalog"].items():
        # Insert backing type
        session.add(BackingTypeConfig(
            type=type_id,
            display_name=type_data["display_name"],
            thickness_inches=type_data["thickness_inches"],
            inset_inches=type_data["inset_inches"],
            description=type_data.get("description"),
            sort_order=type_order.get(type_id, 99),
            is_active=True
        ))
        
        # Insert materials for this type
        for idx, mat in enumerate(type_data["materials"]):
            composite_id = f"{type_id}_{mat['id']}"
            session.add(BackingMaterial(
                id=composite_id,
                backing_type_id=type_id,
                material_id=mat["id"],
                display=mat["display"],
                description=mat.get("description"),
                color_rgb=mat["color_rgb"],
                alpha=mat.get("alpha", 1.0),
                pbr_properties=mat["pbr_properties"],
                texture_files=mat.get("texture_files"),
                sort_order=idx,
                is_active=True
            ))
    
    session.flush()
    
    # Insert backing config (singleton)
    session.add(BackingConfig(
        id=1,
        default_enabled=data["default_enabled"],
        default_type=data["default_type"],
        default_material=data["default_material"],
    ))
    
    mat_count = sum(len(t["materials"]) for t in data["material_catalog"].values())
    print(f"  Inserted {len(data['material_catalog'])} backing types, {mat_count} materials")


def seed_archetypes(session) -> None:
    """Seed archetypes.json data."""
    print("Seeding archetypes...")
    data = load_json("archetypes.json")
    
    for idx, (arch_id, arch) in enumerate(data.items()):
        session.add(Archetype(
            id=arch_id,
            shape=arch["shape"],
            slot_style=arch["slot_style"],
            label=arch["label"],
            tooltip=arch.get("tooltip"),
            thumbnail=arch.get("thumbnail"),
            number_sections=arch["number_sections"],
            available_grains=arch["available_grains"],
            number_slots=arch["number_slots"],
            separation=arch.get("separation", 0),
            side_margin=arch.get("side_margin"),
            sort_order=idx,
            is_active=True
        ))
    
    print(f"  Inserted {len(data)} archetypes")


def seed_constraints(session) -> None:
    """Seed constraints.json data."""
    print("Seeding constraints...")
    data = load_json("constraints.json")
    
    mfg = data["manufacturing"]
    
    # Insert manufacturing constraints (singleton)
    session.add(ManufacturingConstraints(
        id=1,
        version=data.get("version", "2.0.0"),
        description=data.get("description"),
        valid_shapes=data["valid_shapes"],
        cnc_max_x=mfg["cnc_table"]["max_x"],
        cnc_max_y=mfg["cnc_table"]["max_y"],
        circular_constraints=mfg["circular"],
        rectangular_constraints=mfg["rectangular"],
        diamond_constraints=mfg["diamond"],
        slot_style_constraints=mfg["slot_style"],
        scene_constraints=data.get("scenes"),
        ui_visibility=data.get("ui_visibility"),
        audio_constraints=data.get("audio"),
    ))
    
    session.flush()
    
    # Insert archetype-specific constraints
    arch_constraints = data.get("archetype_constraints", {})
    for arch_id, constraints in arch_constraints.items():
        session.add(ArchetypeConstraint(
            archetype_id=arch_id,
            available_sliders=constraints["available_sliders"],
            size_constraint=constraints.get("size"),
            width_constraint=constraints.get("width"),
            height_constraint=constraints.get("height"),
            slots_constraint=constraints.get("slots"),
            separation_constraint=constraints.get("separation"),
            side_margin_constraint=constraints.get("side_margin"),
        ))
    
    print(f"  Inserted manufacturing constraints + {len(arch_constraints)} archetype constraints")


def seed_backgrounds(session) -> None:
    """Seed backgrounds_config.json data."""
    print("Seeding backgrounds...")
    data = load_json("backgrounds_config.json")
    
    categories = data["categories"]
    
    # Insert paints (wall colors and textures)
    for idx, paint in enumerate(categories.get("paint", [])):
        session.add(BackgroundPaint(
            id=paint["id"],
            name=paint["name"],
            description=paint.get("description"),
            group_name=paint.get("group", "Other"),
            rgb=paint.get("rgb"),
            texture_path=paint.get("path"),
            sort_order=idx,
            is_active=True
        ))
    
    # Insert rooms
    for idx, room in enumerate(categories.get("rooms", [])):
        # Provide defaults for required JSONB fields
        art_placement = room.get("art_placement", {
            "position": [0, 0, -20],
            "scale_factor": 1.0,
            "rotation": [0, 0, 0]
        })
        lighting = room.get("lighting", {
            "direction": [-0.66, -0.25, -0.71],
            "shadow_enabled": True,
            "shadow_darkness": 0.8,
            "ambient_boost": 0.5
        })
        
        session.add(BackgroundRoom(
            id=room["id"],
            name=room["name"],
            description=room.get("description"),
            path=room["path"],
            foreground_path=room.get("foreground_path"),
            wall_compensation=room.get("wall_compensation", 1.0),
            art_placement=art_placement,
            lighting=lighting,
            sort_order=idx,
            is_active=True
        ))
    
    session.flush()
    
    # Insert background config (singleton)
    session.add(BackgroundConfig(
        id=1,
        default_room=data.get("default_room"),
        default_wall_finish=data.get("default_wall_finish"),
    ))
    
    paint_count = len(categories.get("paint", []))
    room_count = len(categories.get("rooms", []))
    print(f"  Inserted {paint_count} paints, {room_count} rooms")


def seed_composition_defaults(session) -> None:
    """Seed composition_defaults.json data."""
    print("Seeding composition defaults...")
    data = load_json("composition_defaults.json")
    
    # Extract color palettes to separate table
    palettes = data.get("artistic_rendering", {}).get("color_palettes", {})
    for idx, (palette_id, palette) in enumerate(palettes.items()):
        session.add(ColorPalette(
            id=palette_id,
            color_deep=palette["color_deep"],
            color_mid=palette["color_mid"],
            color_light=palette["color_light"],
            paper_color=palette["paper_color"],
            sort_order=idx,
            is_active=True
        ))
    
    # Insert composition defaults (singleton) - store full structure
    session.add(CompositionDefaults(
        id=1,
        frame_design=data["frame_design"],
        pattern_settings=data["pattern_settings"],
        audio_source=data["audio_source"],
        audio_processing=data["audio_processing"],
        peak_control=data["peak_control"],
        visual_correction=data["visual_correction"],
        display_settings=data["display_settings"],
        export_settings=data["export_settings"],
        artistic_rendering=data["artistic_rendering"],
        processed_amplitudes=data.get("processed_amplitudes", []),
    ))
    
    print(f"  Inserted composition defaults + {len(palettes)} color palettes")


def seed_placement_defaults(session) -> None:
    """Seed placement_defaults.json data."""
    print("Seeding placement defaults...")
    
    try:
        data = load_json("placement_defaults.json")
    except FileNotFoundError:
        print("  Skipping (file not found)")
        return
    
    session.add(PlacementDefaults(
        id=1,
        scene_overrides=data,
    ))
    
    print("  Inserted placement defaults")
    
def seed_ui_config(session) -> None:
    """Seed ui_config.json data."""
    print("Seeding UI config...")
    data = load_json("ui_config.json")
    
    session.add(UIConfig(
        id=1,
        elements=data.get("elements", {}),
        buttons=data.get("buttons", {}),
        upload=data.get("upload", {}),
        thumbnail_config=data.get("thumbnail_config", {}),
        categories=data.get("categories", {}),
    ))
    
    print("  Inserted UI config")

def main():
    parser = argparse.ArgumentParser(description="Seed database from JSON config files")
    parser.add_argument("--clear", action="store_true", help="Clear existing data before seeding")
    args = parser.parse_args()
    
    print("=" * 60)
    print("WaveDesigner Database Seeder")
    print("=" * 60)
    print(f"Config directory: {CONFIG_DIR}")
    print()
    
    # Initialize database schema if needed
    print("Initializing database schema...")
    init_db()
    print("  Done.")
    print()
    
    with get_db() as session:
        if args.clear:
            clear_database(session)
            print()
        
        try:
            seed_wood_materials(session)
            seed_backing_materials(session)
            seed_archetypes(session)
            seed_constraints(session)
            seed_backgrounds(session)
            seed_composition_defaults(session)
            seed_placement_defaults(session)
            seed_ui_config(session)
            
            session.commit()
            print()
            print("=" * 60)
            print("Seeding complete!")
            print("=" * 60)
            
        except Exception as e:
            session.rollback()
            print(f"\nError during seeding: {e}")
            raise


if __name__ == "__main__":
    main()