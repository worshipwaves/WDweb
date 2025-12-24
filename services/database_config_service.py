"""
Database-backed configuration service for WaveDesigner.

Drop-in replacement for ConfigService that reads from PostgreSQL
instead of JSON files. Implements identical interface for seamless switching.
"""

from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from database import (
    get_db,
    WoodSpecies, WoodConfig,
    BackingTypeConfig, BackingMaterial, BackingConfig,
    Archetype, ArchetypeConstraint,
    ManufacturingConstraints,
    BackgroundPaint, BackgroundRoom, BackgroundConfig,
    CompositionDefaults, ColorPalette,
    PlacementDefaults,
    CollectionsCatalog,
    IntentDefaults,
)
from services.dtos import CompositionStateDTO, PlacementDefaultsDTO, AudioProcessingDTO, IntentDefaultsDTO


class DatabaseConfigService:
    """
    Configuration service backed by PostgreSQL database.
    
    Provides identical interface to ConfigService for seamless switching.
    Uses singleton pattern for config tables (id=1).
    """
    
    def __init__(self) -> None:
        """Initialize by loading all configuration from database."""
        self._load_all_config()
    
    def _load_all_config(self) -> None:
        """Load all configuration from database into memory."""
        with get_db() as session:
            self._load_wood_materials(session)
            self._load_backing_materials(session)
            self._load_archetypes(session)
            self._load_constraints(session)
            self._load_backgrounds(session)
            self._load_composition_defaults(session)
            self._load_placement_defaults(session)
            self._load_ui_config(session)
            self._load_collections(session)
            self._load_intent_defaults(session)
    
    # =========================================================================
    # WOOD MATERIALS
    # =========================================================================
    
    def _load_wood_materials(self, session: Session) -> None:
        """Load wood materials configuration."""
        config = session.query(WoodConfig).filter_by(id=1).first()
        if not config:
            raise RuntimeError("Wood configuration not found in database")
        
        species = session.query(WoodSpecies).filter_by(is_active=True).order_by(WoodSpecies.sort_order).all()
        
        self._wood_materials = {
            "valid_grain_directions": config.valid_grain_directions,
            "default_species": config.default_species,
            "default_grain_direction": config.default_grain_direction,
            "species_catalog": [
                {"id": s.id, "display": s.display, "wood_number": s.wood_number}
                for s in species
            ],
            "texture_config": config.texture_config,
            "rendering_config": config.rendering_config,
            "geometry_constants": config.geometry_constants,
        }
    
    def get_wood_materials_config(self) -> dict:
        """Return wood materials configuration."""
        return self._wood_materials
    
    # =========================================================================
    # BACKING MATERIALS
    # =========================================================================
    
    def _load_backing_materials(self, session: Session) -> None:
        """Load backing materials configuration."""
        config = session.query(BackingConfig).filter_by(id=1).first()
        if not config:
            raise RuntimeError("Backing configuration not found in database")
        
        types = session.query(BackingTypeConfig).filter_by(is_active=True).order_by(BackingTypeConfig.sort_order).all()
        
        material_catalog = {}
        for bt in types:
            materials = session.query(BackingMaterial).filter_by(
                backing_type_id=bt.type, 
                is_active=True
            ).order_by(BackingMaterial.sort_order).all()
            
            material_catalog[bt.type] = {
                "type": bt.type,
                "display_name": bt.display_name,
                "thickness_inches": bt.thickness_inches,
                "inset_inches": bt.inset_inches,
                "description": bt.description,
                "materials": [
                    {
                        "id": m.material_id,
                        "display": m.display,
                        "description": m.description,
                        "color_rgb": m.color_rgb,
                        "alpha": m.alpha,
                        "pbr_properties": m.pbr_properties,
                        **({"texture_files": m.texture_files} if m.texture_files else {})
                    }
                    for m in materials
                ]
            }
        
        self._backing_materials = {
            "default_enabled": config.default_enabled,
            "default_type": config.default_type,
            "default_material": config.default_material,
            "material_catalog": material_catalog,
        }
    
    def get_backing_materials_config(self) -> dict:
        """Return backing materials configuration."""
        return self._backing_materials
    
    # =========================================================================
    # ARCHETYPES
    # =========================================================================
    
    def _load_archetypes(self, session: Session) -> None:
        """Load archetype definitions."""
        archetypes = session.query(Archetype).filter_by(is_active=True).order_by(Archetype.sort_order).all()
        
        self._archetypes = {}
        for arch in archetypes:
            self._archetypes[arch.id] = {
                "id": arch.id,
                "shape": arch.shape.value,
                "slot_style": arch.slot_style.value,
                "label": arch.label,
                "tooltip": arch.tooltip,
                "thumbnail": arch.thumbnail,
                "number_sections": arch.number_sections,
                "available_grains": arch.available_grains,
                "number_slots": arch.number_slots,
                "separation": arch.separation,
                **({"side_margin": arch.side_margin} if arch.side_margin is not None else {})
            }
    
    def get_archetypes(self) -> dict:
        """Return archetype definitions."""
        return self._archetypes
    
    # =========================================================================
    # CONSTRAINTS
    # =========================================================================
    
    def _load_constraints(self, session: Session) -> None:
        """Load manufacturing and archetype constraints."""
        mfg = session.query(ManufacturingConstraints).filter_by(id=1).first()
        if not mfg:
            raise RuntimeError("Manufacturing constraints not found in database")
        
        # Load archetype-specific constraints
        arch_constraints = session.query(ArchetypeConstraint).all()
        archetype_constraints = {}
        for ac in arch_constraints:
            constraint = {"available_sliders": ac.available_sliders}
            if ac.size_constraint:
                constraint["size"] = ac.size_constraint
            if ac.width_constraint:
                constraint["width"] = ac.width_constraint
            if ac.height_constraint:
                constraint["height"] = ac.height_constraint
            if ac.slots_constraint:
                constraint["slots"] = ac.slots_constraint
            if ac.separation_constraint:
                constraint["separation"] = ac.separation_constraint
            if ac.side_margin_constraint:
                constraint["side_margin"] = ac.side_margin_constraint
            archetype_constraints[ac.archetype_id] = constraint
        
        self._constraints = {
            "version": mfg.version,
            "description": mfg.description,
            "valid_shapes": mfg.valid_shapes,
            "manufacturing": {
                "cnc_table": {
                    "max_x": mfg.cnc_max_x,
                    "max_y": mfg.cnc_max_y,
                    "reason": "CNC table physical limits. Panels can be rotated."
                },
                "circular": mfg.circular_constraints,
                "rectangular": mfg.rectangular_constraints,
                "diamond": mfg.diamond_constraints,
                "slot_style": mfg.slot_style_constraints,
            },
            "archetype_constraints": archetype_constraints,
            "scenes": mfg.scene_constraints or {},
            "ui_visibility": mfg.ui_visibility or {},
            "audio": mfg.audio_constraints or {},
        }
    
    def get_constraints_config(self) -> dict:
        """Return manufacturing and scene constraints configuration."""
        return self._constraints
    
    def get_dimension_constraints(self) -> dict:
        """Return dimension constraints configuration."""
        mfg = self._constraints["manufacturing"]
        return {
            "circular": {
                "min_dimension": float(mfg["circular"]["general"]["min"]),
                "max_dimension": float(mfg["circular"]["general"]["max"])
            },
            "rectangular": {
                "min_dimension": float(mfg["rectangular"]["width"]["min"]),
                "max_dimension": float(mfg["rectangular"]["width"]["max"])
            },
            "diamond": {
                "min_dimension": float(mfg["diamond"]["width"]["min"]),
                "max_dimension": float(mfg["diamond"]["width"]["max"])
            }
        }
    
    # =========================================================================
    # BACKGROUNDS
    # =========================================================================
    
    def _load_backgrounds(self, session: Session) -> None:
        """Load backgrounds configuration."""
        config = session.query(BackgroundConfig).filter_by(id=1).first()
        if not config:
            raise RuntimeError("Background configuration not found in database")
        
        paints = session.query(BackgroundPaint).filter_by(is_active=True).order_by(BackgroundPaint.sort_order).all()
        rooms = session.query(BackgroundRoom).filter_by(is_active=True).order_by(BackgroundRoom.sort_order).all()
        
        print(f"[DEBUG] Loaded {len(rooms)} active rooms from database")
        
        self._backgrounds = {
            "default_room": config.default_room,
            "default_wall_finish": config.default_wall_finish,
            "categories": {
                "paint": [
                    {
                        "id": p.id,
                        "name": p.name,
                        "description": p.description,
                        "group": p.group_name,
                        **({"rgb": p.rgb} if p.rgb else {}),
                        **({"path": p.texture_path} if p.texture_path else {}),
                    }
                    for p in paints
                ],
                "rooms": [
                    {
                        "id": r.id,
                        "name": r.name,
                        "description": r.description,
                        "path": r.path,
                        **({"foreground_path": r.foreground_path} if r.foreground_path else {}),
                        "wall_compensation": r.wall_compensation,
                        "art_placement": r.art_placement,
                        "lighting": r.lighting,
                    }
                    for r in rooms
                ],
            },
        }
    
    def get_backgrounds_config(self) -> dict:
        """Return backgrounds configuration."""
        return self._backgrounds
    
    # =========================================================================
    # COMPOSITION DEFAULTS
    # =========================================================================
    
    def _load_composition_defaults(self, session: Session) -> None:
        """Load composition defaults."""
        defaults = session.query(CompositionDefaults).filter_by(id=1).first()
        if not defaults:
            raise RuntimeError("Composition defaults not found in database")
        
        # Load color palettes separately
        palettes = session.query(ColorPalette).filter_by(is_active=True).order_by(ColorPalette.sort_order).all()
        color_palettes = {
            p.id: {
                "color_deep": p.color_deep,
                "color_mid": p.color_mid,
                "color_light": p.color_light,
                "paper_color": p.paper_color,
            }
            for p in palettes
        }
        
        # Build full composition state
        composition_data = {
            "frame_design": defaults.frame_design,
            "pattern_settings": defaults.pattern_settings,
            "audio_source": defaults.audio_source,
            "audio_processing": defaults.audio_processing,
            "peak_control": defaults.peak_control,
            "visual_correction": defaults.visual_correction,
            "display_settings": defaults.display_settings,
            "export_settings": defaults.export_settings,
            "artistic_rendering": {
                **defaults.artistic_rendering,
                "color_palettes": color_palettes,  # Merge palettes from separate table
            },
            "processed_amplitudes": defaults.processed_amplitudes or [],
        }
        
        self._default_state = CompositionStateDTO(**composition_data)
    
    def get_default_state(self) -> CompositionStateDTO:
        """Return the default application state."""
        return self._default_state
    
    def get_composition_defaults(self) -> dict:
        """Return composition defaults as dict."""
        return self._default_state.model_dump()
    
    def get_audio_processing_config(self) -> AudioProcessingDTO:
        """Return audio processing DTO for silence removal config."""
        return self._default_state.audio_processing
    
    # =========================================================================
    # UI CONFIG
    # =========================================================================
    
    def _load_ui_config(self, session: Session) -> None:
        """Load UI configuration."""
        from database import UIConfig
        
        config = session.query(UIConfig).filter_by(id=1).first()
        if not config:
            raise RuntimeError("UI config not found in database")
        
        self._ui_config = {
            "elements": config.elements or {},
            "buttons": config.buttons or {},
            "upload": config.upload or {},
            "thumbnail_config": config.thumbnail_config or {},
            "categories": config.categories or {},
        }
    
    def get_ui_config(self) -> dict:
        """Return UI configuration."""
        return self._ui_config
    
    # =========================================================================
    # PLACEMENT DEFAULTS
    # =========================================================================
    
    def _load_placement_defaults(self, session: Session) -> None:
        """Load placement defaults."""
        defaults = session.query(PlacementDefaults).filter_by(id=1).first()
        
        if defaults and defaults.scene_overrides:
            self._placement_defaults = PlacementDefaultsDTO(**defaults.scene_overrides)
        else:
            # Empty defaults if not configured
            self._placement_defaults = PlacementDefaultsDTO()
    
    def get_placement_defaults(self) -> dict:
        """Return scene placement default overrides."""
        return self._placement_defaults.model_dump(exclude_none=True)
    
    # =========================================================================
    # REFRESH (for admin panel updates)
    # =========================================================================
    
    def refresh(self) -> None:
        """Reload all configuration from database."""
        self._load_all_config()
        
    def _load_collections(self, session: Session) -> None:
        """Load collections catalog from database."""
        config = session.query(CollectionsCatalog).filter_by(id=1).first()
        if config:
            self._collections_catalog = config.data
        else:
            self._collections_catalog = {"version": "1.0", "artists": {}, "categories": [], "collections": []}

    def get_collections_catalog(self) -> dict:
        """Return collections catalog."""
        return self._collections_catalog   

    # =========================================================================
    # INTENT DEFAULTS
    # =========================================================================
    
    def _load_intent_defaults(self, session: Session) -> None:
        """Load intent defaults for audio processing."""
        config = session.query(IntentDefaults).filter_by(id=1).first()
        if config and config.config:
            self._intent_defaults = IntentDefaultsDTO(**config.config)
        else:
            raise RuntimeError("Intent defaults not found in database")
    
    def get_intent_defaults(self) -> IntentDefaultsDTO:
        """Return intent defaults DTO."""
        return self._intent_defaults        