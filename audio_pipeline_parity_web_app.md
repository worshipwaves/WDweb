# Project Files Overview

**Generated on:** 2025-12-23 12:24:26
**Source:** Specified files (15)
**Total files:** 15

## Files Included

- `C:\Users\paulj\WDweb\database\models.py`
- `C:\Users\paulj\WDweb\routers\audio_router.py`
- `C:\Users\paulj\WDweb\services/composition_service.py`
- `C:\Users\paulj\WDweb\services/processing_level_service.py`
- `C:\Users\paulj\WDweb\services/slot_generation_service.py`
- `C:\Users\paulj\WDweb\services\audio_processing_service.py`
- `C:\Users\paulj\WDweb\services\dtos.py`
- `C:\Users\paulj\WDweb\services\geometry_service.py`
- `C:\Users\paulj\WDweb\services\service_facade.py`
- `C:\Users\paulj\WDweb\src/ApplicationController.ts`
- `C:\Users\paulj\WDweb\src/AudioCacheService.ts`
- `C:\Users\paulj\WDweb\src/components/AudioSlicerPanel.ts`
- `C:\Users\paulj\WDweb\src\ApplicationController.ts`
- `C:\Users\paulj\WDweb\src\AudioCacheService.ts`
- `C:\Users\paulj\WDweb\src\components\AudioSlicerPanel.ts`

---

## File: `C:\Users\paulj\WDweb\database\models.py`

```python
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
    
# =============================================================================
# UI CONFIGURATION
# =============================================================================

class UIConfig(Base):
    """
    UI configuration for frontend elements, buttons, and upload settings.
    Maps to ui_config.json. Singleton (id=1).
    """
    __tablename__ = "ui_config"
    
    id = Column(Integer, primary_key=True, default=1)
    
    # Store as structured JSONB to match frontend UIConfig interface
    elements = Column(JSONB, nullable=False, default={})
    buttons = Column(JSONB, nullable=False, default={})
    upload = Column(JSONB, nullable=False, default={})
    thumbnail_config = Column(JSONB, default={})
    categories = Column(JSONB, default={})
    
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())    
```

## File: `C:\Users\paulj\WDweb\routers\audio_router.py`

```python
"""
Audio processing endpoints - stem separation and silence removal.
"""

import tempfile
import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse
import librosa
import soundfile as sf

from services.demucs_service import DemucsService
from services.audio_processing_service import AudioProcessingService


router = APIRouter(prefix="/api/audio", tags=["audio"])

# Initialize service
from services.config_service import ConfigService
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
_config_service = ConfigService(PROJECT_ROOT / "config")
_audio_config = _config_service.get_audio_processing_config()
_demucs = DemucsService(
    audio_config=_audio_config,
    output_dir=PROJECT_ROOT / "temp" / "demucs_output"
)


@router.post("/isolate-vocals")
async def isolate_vocals(
    file: UploadFile = File(...),
    remove_silence: bool = True
):
    """
    Isolate vocals from uploaded audio file.
    
    - Runs Demucs stem separation (GPU accelerated)
    - Optionally compresses silence gaps
    - Returns processed vocals as WAV
    """
    if not file.filename:
        raise HTTPException(400, "No filename provided")
    
    # Save upload to temp file
    suffix = Path(file.filename).suffix or ".wav"
    temp_input = Path(tempfile.gettempdir()) / f"{uuid.uuid4()}{suffix}"
    
    try:
        # Write uploaded file
        content = await file.read()
        temp_input.write_bytes(content)
        
        # Process
        vocals_path = _demucs.separate_vocals(
            input_path=temp_input,
            remove_silence=remove_silence
        )
        
        # Return processed file
        return FileResponse(
            path=str(vocals_path),
            media_type="audio/wav",
            filename="vocals.wav"
        )
        
    except subprocess.CalledProcessError as e:
        raise HTTPException(500, f"Demucs processing failed: {e.stderr}")
    except FileNotFoundError as e:
        raise HTTPException(500, str(e))
    finally:
        # Cleanup input
        if temp_input.exists():
            temp_input.unlink()
            
@router.post("/compress-silence")
async def compress_silence(
    file: UploadFile = File(...),
    min_duration: float = Form(1.0),
    threshold_db: float = Form(-40.0)
):
    """
    Apply silence compression to audio with configurable params.
    Separate from Demucs for iterative testing.
    """
    if not file.filename:
        raise HTTPException(400, "No filename provided")
    
    suffix = Path(file.filename).suffix or ".wav"
    temp_input = Path(tempfile.gettempdir()) / f"{uuid.uuid4()}{suffix}"
    
    try:
        content = await file.read()
        temp_input.write_bytes(content)
        
        output_path = _demucs.compress_silence_only(
            input_path=temp_input,
            min_duration=min_duration,
            threshold_db=threshold_db
        )
        
        return FileResponse(
            path=str(output_path),
            media_type="audio/wav",
            filename="compressed.wav"
        )
        
    except Exception as e:
        raise HTTPException(500, f"Compression failed: {str(e)}")
    finally:
        if temp_input.exists():
            temp_input.unlink()


@router.post("/optimize")
async def optimize_audio_settings(
    file: UploadFile = File(...),
    mode: str = Form(...),
    num_slots: int = Form(...)
):
    """Analyze audio and return optimized processing settings."""
    if not file.filename:
        raise HTTPException(400, "No filename provided")
    
    suffix = Path(file.filename).suffix or ".wav"
    temp_input = Path(tempfile.gettempdir()) / f"{uuid.uuid4()}{suffix}"
    
    try:
        content = await file.read()
        temp_input.write_bytes(content)
        
        samples, _ = librosa.load(str(temp_input), sr=44100, mono=True)
        result = AudioProcessingService.analyze_and_optimize(samples, num_slots, mode)
        
        return result
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Processing failed: {str(e)}")
    finally:
        if temp_input.exists():
            temp_input.unlink()


@router.post("/process-commit")
async def process_audio_commit(
    file: UploadFile = File(...),
    isolate_vocals: bool = Form(False),
    remove_silence: bool = Form(False),
    silence_threshold: float = Form(-40.0),
    silence_min_duration: float = Form(1.0),
    start_time: float | None = Form(None),
    end_time: float | None = Form(None)
):
    """
    Full audio processing pipeline for art generation.
    
    1. Apply slice (if start_time/end_time provided)
    2. Isolate vocals (if requested)
    3. Return processed audio ready for waveform generation
    """
    if not file.filename:
        raise HTTPException(400, "No filename provided")
    
    suffix = Path(file.filename).suffix or ".wav"
    temp_input = Path(tempfile.gettempdir()) / f"{uuid.uuid4()}{suffix}"
    
    try:
        content = await file.read()
        temp_input.write_bytes(content)
        
        # Apply slice using librosa (Desktop parity: sample-accurate, float32, mono)
        if start_time is not None and end_time is not None:
            duration = end_time - start_time
            print(f"[DEBUG] Slicing: start={start_time}, end={end_time}, duration={duration}")
            y, sr = librosa.load(str(temp_input), sr=_audio_config.target_sample_rate, mono=True, offset=start_time, duration=duration)
            print(f"[DEBUG] Loaded slice: {len(y)} samples, sr={sr}")
            # Write to new WAV file (soundfile can't write to m4a/mp3)
            temp_input.unlink()
            temp_input = Path(tempfile.gettempdir()) / f"{uuid.uuid4()}.wav"
            sf.write(str(temp_input), y, sr)
            print(f"[DEBUG] Wrote sliced file: {temp_input}")
        
        print(f"[DEBUG] isolate_vocals={isolate_vocals}, remove_silence={remove_silence}")
        
        # Process based on options
        if isolate_vocals:
            output_path = _demucs.separate_vocals(
                input_path=temp_input,
                remove_silence=remove_silence
            )
        elif remove_silence:
            output_path = _demucs.compress_silence_only(
                input_path=temp_input,
                threshold_db=silence_threshold,
                min_duration=silence_min_duration
            )
        else:
            output_path = temp_input
        
        return FileResponse(
            path=str(output_path),
            media_type="audio/wav",
            filename="processed.wav"
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Processing failed: {str(e)}")
    finally:
        if temp_input.exists() and not isolate_vocals:
            pass  # Keep for response
        elif temp_input.exists():
            temp_input.unlink()
```

## File: `C:\Users\paulj\WDweb\services/composition_service.py`

```python
# services/composition_service.py

from typing import Dict, Any
from services.dtos import CompositionStateDTO
from services.geometry_service import GeometryService  
from services.slot_generation_service import SlotGenerationService
from services.audio_processing_service import AudioProcessingService


class CompositionService:
    """
    Service for orchestrating the complete composition generation process.
    Cleaned version for CSG-based approach.
    """
    
    def __init__(
        self,
        geometry_service: GeometryService,
        slot_generation_service: SlotGenerationService,
        audio_processing_service: AudioProcessingService
    ):
        """
        Initialize the CompositionService with required dependencies.
        
        Args:
            geometry_service: Service for geometric calculations
            slot_generation_service: Service for slot pattern generation
            audio_processing_service: Service for audio processing
        """
        self._geometry_service = geometry_service
        self._slot_generation_service = slot_generation_service
        self._audio_processing_service = audio_processing_service
    
    def generate_full_composition(self, state: CompositionStateDTO) -> CompositionStateDTO:
        """
        Generate a complete composition from the given state.
        
        For CSG approach, this primarily validates the state since
        actual generation happens in the frontend.
        
        Args:
            state: The composition state
            
        Returns:
            The same state (generation happens in frontend)
        """
        # Validate the state
        validation = self.validate_composition(state)
        if not validation['valid']:
            raise ValueError(f"Invalid composition: {validation['errors']}")
        
        # In CSG approach, actual generation happens in frontend
        # Backend just provides the data
        return state
    
    def validate_composition(self, state: CompositionStateDTO) -> Dict[str, Any]:
        """
        Validate a composition state for correctness.
        
        Args:
            state: The composition state to validate
            
        Returns:
            Validation results with 'valid', 'errors', and 'warnings'
        """
        errors = []
        warnings = []
        
        # Validate frame design
        if state.frame_design:
            if state.frame_design.number_sections not in [1, 2, 3, 4]:
                errors = errors + [f"Invalid number_sections: {state.frame_design.number_sections}"]
            
            if state.frame_design.finish_x <= 0 or state.frame_design.finish_y <= 0:
                errors = errors + ["Frame dimensions must be positive"]
            
            if state.frame_design.separation < 0:
                errors = errors + ["Separation cannot be negative"]
        else:
            errors = errors + ["Missing frame_design"]
        
        # Validate pattern settings if present
        if state.pattern_settings:
            if state.pattern_settings.number_slots <= 0:
                errors = errors + ["Number of slots must be positive"]
            
            if state.pattern_settings.bit_diameter <= 0:
                errors = errors + ["Bit diameter must be positive"]
            
            # Check amplitude count matches slot count
            if state.processed_amplitudes:
                expected = state.pattern_settings.number_slots
                actual = len(state.processed_amplitudes)
                if actual != expected:
                    errors = errors + [f"Amplitude count mismatch: expected {expected}, got {actual}"]
        
        # Warnings for optimization
        if state.frame_design and state.pattern_settings:
            if state.pattern_settings.number_slots > 200:
                warnings = warnings + ["High slot count may impact performance"]
            
            if state.frame_design.separation > state.frame_design.finish_y / 4:
                warnings = warnings + ["Large separation may result in small panels"]
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }
    
    def get_composition_summary(self, state: CompositionStateDTO) -> Dict[str, Any]:
        """
        Get a human-readable summary of the composition.
        
        Args:
            state: The composition state to summarize
            
        Returns:
            Dictionary with summary information
        """
        frame = state.frame_design
        pattern = state.pattern_settings
        
        summary = {
            'frame': {
                'shape': frame.shape if frame else 'circular',
                'dimensions': f"{frame.finish_x} x {frame.finish_y}" if frame else "36 x 36",
                'sections': frame.number_sections if frame else 1,
                'separation': frame.separation if frame else 0,
                'material_thickness': frame.material_thickness if frame else 0.375
            },
            'pattern': {
                'style': pattern.slot_style if pattern else 'radial',
                'slots': pattern.number_slots if pattern else 0,
                'bit_diameter': pattern.bit_diameter if pattern else 0.25
            },
            'audio': {
                'has_amplitudes': bool(state.processed_amplitudes),
                'amplitude_count': len(state.processed_amplitudes) if state.processed_amplitudes else 0
            },
            'rendering': {
                'ready_for_csg': bool(frame and pattern)
            }
        }
        
        # Add slots per section if multi-section
        if frame and pattern and frame.number_sections > 1:
            summary['pattern']['slots_per_section'] = pattern.number_slots // frame.number_sections
        
        return summary
```

## File: `C:\Users\paulj\WDweb\services/processing_level_service.py`

```python
"""Processing level service to handle parameter changes efficiently"""
from typing import List, Dict, Any, Optional
from services.dtos import CompositionStateDTO
from services.audio_processing_service import AudioProcessingService
from services.geometry_service import GeometryService
from services.config_service import ConfigService


class ProcessingLevelService:
    """Handles parameter changes based on a processing level hierarchy."""

    # Updated mapping of DTO field names to their processing level.
    PROCESSING_LEVELS = {
        # Display Level (Visual only, no re-calculation)
        "show_labels": "display",
        "show_offsets": "display",
        "show_debug_circle": "display",
        "section_materials": "display",

        # Post-processing Level (Affects rendering, but not slot geometry)
        "apply_correction": "post",
        "correction_scale": "post",
        "correction_mode": "post",
        "roll_amount": "post",

        # Slots Level (Recalculates slot geometry from existing amplitudes)
        "slot_style": "slots",
        "bit_diameter": "slots",
        "spacer": "slots",
        "side_margin": "slots",
        "lead_overlap": "slots",
        "lead_radius": "slots",

        # Geometry Level (Requires amplitude rescaling)
        "finish_x": "geometry",
        "finish_y": "geometry",
        "x_offset": "geometry",
        "y_offset": "geometry",
        "shape": "geometry",
        "scale_center_point": "geometry",
        "amplitude_exponent": "geometry",
        "number_sections": "geometry",
        "separation": "geometry",
        "processed_amplitudes": "geometry",

        # Audio Level (Requires full audio reprocessing)
        "number_slots": "audio",
        "filter_amount": "audio",
        "apply_filter": "audio",
    }

    LEVEL_HIERARCHY = ["display", "post", "slots", "geometry", "audio"]

    def __init__(self, audio_service, slot_service, config_service: ConfigService):
        self._audio_service = audio_service
        self._geometry_service = GeometryService()
        self._slot_service = slot_service
        self._config_service = config_service
        self._cached_max_amplitude_local = {}  # Placeholder for future caching

    def get_processing_level(self, changed_params: List[str]) -> str:
        """Determine the highest required processing level from a list of changed parameters."""
        if not changed_params:
            return "display"

        highest_index = 0
        for param in changed_params:
            level = self.PROCESSING_LEVELS.get(param)
            if level:
                level_index = self.LEVEL_HIERARCHY.index(level)
                if level_index > highest_index:
                    highest_index = level_index

        return self.LEVEL_HIERARCHY[highest_index]

    def process_by_level(
        self,
        state: CompositionStateDTO,
        changed_params: List[str],
        previous_max_amplitude: Optional[float]
    ) -> CompositionStateDTO:
        """Process a state update based on the required processing level."""
        level = self.get_processing_level(changed_params)

        print(f"[PROCESSING DIAGNOSTIC] Changed params: {changed_params}")
        print(f"[PROCESSING DIAGNOSTIC] Determined level: '{level}'")
        print(f"[PROCESSING DIAGNOSTIC] Previous max_amplitude: {previous_max_amplitude}")
        
        # CRITICAL: Preserve section_materials from incoming state (frontend owns this)
        # Preserve valid section_materials and add defaults for new sections
        if state.frame_design:
            from services.dtos import SectionMaterialDTO
            
            wood_config = self._config_service.get_wood_materials_config()
            
            num_sections = state.frame_design.number_sections
            existing_materials = state.frame_design.section_materials or []
            
            # Filter to valid sections only
            valid_materials = [m for m in existing_materials if m.section_id < num_sections]
            
            # Create defaults for missing sections (immutable)
            existing_ids = {m.section_id for m in valid_materials}
            new_defaults = [
                SectionMaterialDTO(
                    section_id=section_id,
                    species=wood_config['default_species'],
                    grain_direction=wood_config['default_grain_direction']
                )
                for section_id in range(num_sections)
                if section_id not in existing_ids
            ]
            
            # Combine and sort (creates new list, no mutation)
            self._incoming_section_materials = sorted(
                valid_materials + new_defaults, 
                key=lambda m: m.section_id
            )
        else:
            self._incoming_section_materials = []

        current_geometry = self._geometry_service.calculate_geometries_dto(state)
        current_max = current_geometry.max_amplitude_local
        print(f"[PROCESSING DIAGNOSTIC] Current max_amplitude: {current_max}")

        if level in ["display", "post", "slots"]:
            # CRITICAL: Check if we have normalized amplitudes that need physical scaling
            # This happens on initial load when restored state contains 0-1 normalized values
            if state.processed_amplitudes:
                max_amp = max(abs(a) for a in state.processed_amplitudes)
                if max_amp > 0 and max_amp <= 1.5:
                    print(f"[PROCESSING DIAGNOSTIC] Detected normalized amplitudes (max={max_amp:.4f}), applying physical scaling")
                    scaled_amplitudes = AudioProcessingService.scale_and_clamp_amplitudes(
                        state.processed_amplitudes,
                        current_max,
                        state.pattern_settings.bit_diameter
                    )
                    state = state.model_copy(update={"processed_amplitudes": scaled_amplitudes})
                    print(f"[PROCESSING DIAGNOSTIC] Scaled to physical space: max={max(scaled_amplitudes):.4f}")
                else:
                    print(f"[PROCESSING DIAGNOSTIC] Action: No server-side amplitude changes needed for '{level}' level.")
            else:
                print(f"[PROCESSING DIAGNOSTIC] Action: No server-side amplitude changes needed for '{level}' level.")
            return state

        if level == "geometry":
            print("[PROCESSING DIAGNOSTIC] Action: Geometry rescaling")
            new_state = self._process_geometry_change(state, previous_max_amplitude, current_max)
            if new_state.processed_amplitudes:
                print(f"[PROCESSING DIAGNOSTIC] Rescaled amplitudes: first={new_state.processed_amplitudes[0]:.4f}")
            return new_state

        if level == "audio":
            print("[PROCESSING DIAGNOSTIC] Action: Full audio reprocessing required.")
            return self._process_audio_change(state)

        return state

    def _process_geometry_change(
        self,
        state: CompositionStateDTO,
        previous_max_amplitude: Optional[float],
        new_max_amplitude: float
    ) -> CompositionStateDTO:
        """Handle geometry changes by applying new max_amplitude to normalized amplitudes."""
        if not state.processed_amplitudes:
            print("[PROCESSING DIAGNOSTIC] No amplitudes to process. Passing through.")
            return state

        print(f"[PROCESSING DIAGNOSTIC] Geometry change - applying new max_amplitude")
        if previous_max_amplitude is not None:
            print(f"[PROCESSING DIAGNOSTIC] Previous max: {previous_max_amplitude:.4f}")
        else:
            print("[PROCESSING DIAGNOSTIC] Previous max: None")
        print(f"[PROCESSING DIAGNOSTIC] New max: {new_max_amplitude:.4f}")
        
        # CRITICAL FIX: Frontend sends NORMALIZED amplitudes (0-1 range) for geometry changes
        # We apply the new max_amplitude directly, not rescale from previous
        if new_max_amplitude > 1e-9:
            # The amplitudes from frontend should be normalized (0-1)
            normalized_amplitudes = state.processed_amplitudes
            
            # Verify they look normalized (max should be around 1.0 or less)
            max_val = max(abs(a) for a in normalized_amplitudes) if normalized_amplitudes else 0
            if max_val > 1.5:
                print(f"[PROCESSING WARNING] Amplitudes don't look normalized (max={max_val:.2f})")
                # Emergency renormalization
                normalized_amplitudes = [a / max_val for a in normalized_amplitudes]
            
            # Apply new scaling to normalized values
            scaled_amplitudes = AudioProcessingService.scale_and_clamp_amplitudes(
                normalized_amplitudes,
                new_max_amplitude,
                state.pattern_settings.bit_diameter
            )
            
            print(f"[PROCESSING DIAGNOSTIC] Scaled {len(scaled_amplitudes)} amplitudes")
            print(f"[PROCESSING DIAGNOSTIC] Sample values: first={scaled_amplitudes[0]:.4f}, max={max(scaled_amplitudes):.4f}")
            
            updated_state = state.model_copy(update={"processed_amplitudes": scaled_amplitudes})
            if state.frame_design and self._incoming_section_materials:
                updated_frame = updated_state.frame_design.model_copy(
                    update={"section_materials": self._incoming_section_materials}
                )
                updated_state = updated_state.model_copy(update={"frame_design": updated_frame})
            return updated_state
        
        print("[PROCESSING DIAGNOSTIC] Invalid max_amplitude. Passing through.")
        return state

    def _process_audio_change(self, state: CompositionStateDTO) -> CompositionStateDTO:
        """
        Handle audio-level changes by re-scaling the provided (already rebinned) amplitudes.
        The frontend is responsible for rebinning from its raw sample cache.
        The backend is responsible for calculating the new max_amplitude_local and applying it.
        """
        print("[PROCESSING DIAGNOSTIC] Action: Re-scaling client-rebinned amplitudes.")
        
        # 1. The incoming state has the correct number of slots and a corresponding
        #    number of NORMALIZED (0-1) amplitudes from client-side rebinning.
        
        # 2. Recalculate the geometry for the NEW state.
        geometry = self._geometry_service.calculate_geometries_dto(state)
        new_max_amplitude = geometry.max_amplitude_local
        
        print(f"[PROCESSING DIAGNOSTIC] New max_amplitude_local for scaling: {new_max_amplitude:.4f}")

        # 3. Scale the normalized amplitudes to their final physical size.
        if state.processed_amplitudes and new_max_amplitude > 1e-9:
            scaled_amplitudes = AudioProcessingService.scale_and_clamp_amplitudes(
                state.processed_amplitudes,
                new_max_amplitude,
                state.pattern_settings.bit_diameter
            )
            updated_state = state.model_copy(update={"processed_amplitudes": scaled_amplitudes})
            if state.frame_design and self._incoming_section_materials:
                updated_frame = updated_state.frame_design.model_copy(
                    update={"section_materials": self._incoming_section_materials}
                )
                updated_state = updated_state.model_copy(update={"frame_design": updated_frame})
            return updated_state
        
        print("[PROCESSING DIAGNOSTIC] No amplitudes to scale or max_amplitude is zero. Returning state as is.")
        return state
```

## File: `C:\Users\paulj\WDweb\services/slot_generation_service.py`

```python
# services/slot_generation_service.py

import math
from typing import Optional, List, Dict, Any, Tuple
from services.dtos import CompositionStateDTO, GeometryResultDTO

class SlotGenerationService:
    """Service for generating slot coordinates from composition state."""
    
    def get_slot_data(self, state: CompositionStateDTO, geometry: GeometryResultDTO) -> List[Dict[str, Any]]:
        """
        Return slot data for CSG operations.
        
        Args:
            state: Complete composition state including processed amplitudes
            geometry: Pre-calculated geometry from GeometryService
            
        Returns:
            List of slot data dictionaries, each containing:
                - vertices: List of 4 [x, y] coordinates forming the trapezoid
                - x: X position of slot center
                - z: Z position of slot center (Y in 2D space)
                - angle: Rotation angle in radians
                - length: Slot length (for reference)
                - width: Slot width (for reference)
        """
        if not state.processed_amplitudes:
            raise ValueError("Cannot generate slot data without processed amplitudes")
        
        # Get the raw slot coordinates with pre-calculated geometry
        slots = self.create_slots(state, geometry)
        
        # Convert slot coordinates to CSG data format
        slot_data = []
        
        for slot in slots:
            if len(slot) < 4:
                continue
                
            # Get the 4 vertices that form the trapezoid
            vertices = [
                [slot[0][0], slot[0][1]],
                [slot[1][0], slot[1][1]],
                [slot[2][0], slot[2][1]],
                [slot[3][0], slot[3][1]]
            ]
            
            # Calculate center for reference
            center_x = sum(v[0] for v in vertices) / 4.0
            center_y = sum(v[1] for v in vertices) / 4.0
            
            # Calculate angle from radial centerline
            dx = slot[1][0] - slot[0][0]
            dy = slot[1][1] - slot[0][1]
            angle = math.atan2(dy, dx)
            
            # Calculate dimensions for reference
            length = math.sqrt(dx**2 + dy**2)
            width_dx = slot[3][0] - slot[0][0]
            width_dy = slot[3][1] - slot[0][1]
            width = math.sqrt(width_dx**2 + width_dy**2)
            
            slot_data = slot_data + [{
                "vertices": vertices,
                "x": center_x,
                "z": center_y,
                "angle": angle,
                "length": length,
                "width": width
            }]
        
        return slot_data
    
    def create_slots(self, state: CompositionStateDTO, geometry: GeometryResultDTO) -> List[List[List[float]]]:
        """
        Generate slot coordinates based on the composition state.
        
        Args:
            state: Complete composition state including processed amplitudes
            geometry: Pre-calculated geometry from GeometryService
            
        Returns:
            List of slots, where each slot is a list of [x, y] coordinates
        """
        # Extract key parameters
        number_slots = state.pattern_settings.number_slots
        slot_style = state.pattern_settings.slot_style
        amplitudes = state.processed_amplitudes
        
        # Validate amplitudes
        if len(amplitudes) != number_slots:
            raise ValueError(f"Expected {number_slots} amplitudes, got {len(amplitudes)}")
        
        # Generate slots based on style
        if slot_style == "radial":
            return self._generate_radial_slots(state, geometry, amplitudes)
        elif slot_style == "linear":
            return self._generate_linear_slots(state, geometry, amplitudes)
        else:
            raise NotImplementedError(f"Slot style '{slot_style}' not yet implemented")
            
    def _generate_linear_slots(
        self,
        state: 'CompositionStateDTO',
        geometry: GeometryResultDTO,
        amplitudes: List[float]
    ) -> List[List[List[float]]]:
        """Generate linear slot coordinates for rectangular frames.
        
        For n>2: Enforces symmetry by:
        - Equal slot count in both end sections
        - Equal slot count in all center sections
        - Uniform slot width across all sections
        - Adjusts side_margin slightly to make math work
        """
        
        frame = state.frame_design
        pattern = state.pattern_settings
        
        n_sections = frame.number_sections
        total_slots = pattern.number_slots
        
        finish_x = frame.finish_x
        finish_y = frame.finish_y
        separation = frame.separation
        
        side_margin = pattern.side_margin
        x_offset = pattern.x_offset
        target_exterior_margin = x_offset + side_margin  # Physical position for exterior edges
        y_offset = pattern.y_offset
        spacer = pattern.spacer
        bit_diameter = pattern.bit_diameter
        
        # Panel width
        panel_width = (finish_x - separation * (n_sections - 1)) / n_sections
        
        # Y limits
        center_y = finish_y / 2.0
        max_amplitude = finish_y - 2 * y_offset
        safety_minimum = bit_diameter * 2.0
        
        if n_sections <= 2:
            # Simple case: side_margin on outer edges, x_offset on inner edges
            slots_per_section = total_slots // n_sections
            
            if n_sections == 1:
                # Single panel: target_exterior_margin on both sides
                usable = panel_width - 2 * target_exterior_margin
                slot_width = (usable - (slots_per_section - 1) * spacer) / slots_per_section
                left_margin_list = [target_exterior_margin]
            else:
                # n=2: target_exterior_margin outer, x_offset inner
                # Section 0: L=target_exterior_margin, R=x_offset
                # Section 1: L=x_offset, R=target_exterior_margin
                usable = panel_width - target_exterior_margin - x_offset
                slot_width = (usable - (slots_per_section - 1) * spacer) / slots_per_section
                left_margin_list = [target_exterior_margin, x_offset]
            
            slots_per_section_list = [slots_per_section] * n_sections
            
        else:
            # n>2: Use symmetric_n_end if provided, otherwise fall back to solver
            if pattern.symmetric_n_end is not None:
                n_end = pattern.symmetric_n_end
                num_center_sections = n_sections - 2
                remaining = total_slots - 2 * n_end
                
                if remaining >= num_center_sections and remaining % num_center_sections == 0:
                    n_center = remaining // num_center_sections
                    center_usable = panel_width - 2 * x_offset
                    slot_width = (center_usable - (n_center - 1) * spacer) / n_center
                    min_slot_width = bit_diameter + 0.0625
                    end_span = n_end * slot_width + (n_end - 1) * spacer
                    adjusted_side_margin = panel_width - x_offset - end_span
                    
                    if slot_width < min_slot_width or adjusted_side_margin < x_offset:
                        print(f"[SlotGeneration] symmetric_n_end={n_end} violates physical constraints, using solver")
                        n_end, n_center, adjusted_side_margin, slot_width = self._find_symmetric_distribution(
                            total_slots, n_sections, panel_width, x_offset, side_margin, spacer, bit_diameter
                        )
                else:
                    print(f"[SlotGeneration] symmetric_n_end={n_end} invalid for total_slots={total_slots}, using solver")
                    n_end, n_center, adjusted_side_margin, slot_width = self._find_symmetric_distribution(
                        total_slots, n_sections, panel_width, x_offset, side_margin, spacer, bit_diameter
                    )
            else:
                n_end, n_center, adjusted_side_margin, slot_width = self._find_symmetric_distribution(
                    total_slots, n_sections, panel_width, x_offset, side_margin, spacer, bit_diameter
                )
            
            if pattern.symmetric_n_end is None and abs(adjusted_side_margin - target_exterior_margin) > 0.001:
                print(f"[SlotGeneration] Side margin adjusted from {target_exterior_margin:.3f}\" to {adjusted_side_margin:.3f}\" for symmetry")
            
            # Build per-section lists
            # Section 0: left_margin = adjusted_side_margin
            # Sections 1 to n-2: left_margin = x_offset
            # Section n-1: left_margin = x_offset (right_margin = adjusted_side_margin, but we position from left)
            
            slots_per_section_list = [n_end]
            left_margin_list = [adjusted_side_margin]  # Section 0: outer left = side_margin, right = x_offset
            
            for _ in range(n_sections - 2):
                slots_per_section_list = slots_per_section_list + [n_center]
                left_margin_list = left_margin_list + [x_offset]  # Center: L = x_offset (R derives from slot_width)
            
            slots_per_section_list = slots_per_section_list + [n_end]
            left_margin_list = left_margin_list + [x_offset]  # Section n-1: inner left = x_offset, right floats to side_margin
        
        # Generate all slots
        
        # Generate all slots
        all_slots = []
        global_idx = 0
        
        for section_idx in range(n_sections):
            section_slots = slots_per_section_list[section_idx]
            left_margin = left_margin_list[section_idx]
            
            panel_x_start = section_idx * (panel_width + separation)
            current_x = panel_x_start + left_margin
            
            for _ in range(section_slots):
                if global_idx >= len(amplitudes):
                    break
                
                amp = amplitudes[global_idx]
                amp = max(amp, safety_minimum)
                amp = min(amp, max_amplitude)
                
                half_amp = amp / 2.0
                y_bottom = center_y - half_amp
                y_top = center_y + half_amp
                
                x_start = current_x
                x_end = current_x + slot_width
                
                slot_coords = [
                    [x_start, y_bottom],
                    [x_start, y_top],
                    [x_end, y_top],
                    [x_end, y_bottom],
                    [x_start, y_bottom]
                ]
                
                all_slots = all_slots + [slot_coords]
                
                current_x += slot_width + spacer
                global_idx += 1
        
        return all_slots

    def _find_symmetric_distribution(
        self,
        total_slots: int,
        n_sections: int,
        panel_width: float,
        x_offset: float,
        side_margin: float,
        spacer: float,
        bit_diameter: float
    ) -> Tuple[int, int, float, float]:
        """
        Find (n_end, n_center, adjusted_side_margin, slot_width) that:
        - Sums exactly to total_slots
        - Has uniform slot_width
        - Adjusts side_margin closest to user's requested value
        
        Returns: (n_end, n_center, adjusted_side_margin, slot_width)
        """
        
        # Center section usable width (fixed)
        u_center = panel_width - 2 * x_offset
        
        best_result = None
        best_margin_diff = float('inf')
        
        # For n=3: total = 2*n_end + n_center
        # For n=4: total = 2*n_end + 2*n_center
        num_center_sections = n_sections - 2
        
        # Iterate possible n_end values
        max_n_end = total_slots // 2
        
        for n_end in range(1, max_n_end + 1):
            remaining = total_slots - 2 * n_end
            
            # n_center must divide evenly among center sections
            if remaining < num_center_sections:
                continue
            if remaining % num_center_sections != 0:
                continue
                
            n_center = remaining // num_center_sections
            
            # Calculate slot_width from center section
            # u_center = n_center * w + (n_center - 1) * spacer
            # w = (u_center - (n_center - 1) * spacer) / n_center
            slot_width = (u_center - (n_center - 1) * spacer) / n_center
            
            min_slot_width = bit_diameter + 0.0625  # CNC safety: bit diameter + 1/16"
            if slot_width < min_slot_width:
                continue
            
            # Calculate required u_end for this slot_width
            # u_end = n_end * w + (n_end - 1) * spacer
            u_end_required = n_end * slot_width + (n_end - 1) * spacer
            
            # Calculate adjusted_side_margin
            # u_end = panel_width - adjusted_side_margin - x_offset
            adjusted_side_margin = panel_width - x_offset - u_end_required
            
            # Skip if margin goes negative or too small
            if adjusted_side_margin < x_offset * 0.5:
                continue
            
            # Score by closeness to user's requested side_margin
            margin_diff = abs(adjusted_side_margin - side_margin)
            
            # Skip if adjustment exceeds tolerance (±25% or ±0.5", whichever is greater)
            max_adjustment = max(side_margin * 0.25, 0.5)
            if margin_diff > max_adjustment:
                continue
            
            if margin_diff < best_margin_diff:
                best_margin_diff = margin_diff
                best_result = (n_end, n_center, adjusted_side_margin, slot_width)
        
        if best_result is None:
            # No valid distribution for requested total_slots
            # Search nearby totals for one that works
            for offset in range(1, 15):
                for delta in [offset, -offset]:
                    test_total = total_slots + delta
                    if test_total < n_sections:
                        continue
                    
                    # Re-run the search for this total
                    test_result = self._find_valid_distribution(
                        test_total, n_sections, panel_width, x_offset, side_margin, spacer, bit_diameter, num_center_sections, u_center
                    )
                    if test_result:
                        print(f"[SlotGeneration] Snapped total_slots from {total_slots} to {test_total} for valid distribution")
                        return test_result
            
            # Ultimate fallback: equal distribution with x_offset margins
            slots_per = total_slots // n_sections
            usable_center = panel_width - 2 * x_offset
            slot_width = (usable_center - (slots_per - 1) * spacer) / slots_per
            span = slots_per * slot_width + (slots_per - 1) * spacer
            resulting_side_margin = panel_width - x_offset - span
            
            return (slots_per, slots_per, resulting_side_margin, slot_width)
        
        return best_result 

    def _find_valid_distribution(
        self,
        total_slots: int,
        n_sections: int,
        panel_width: float,
        x_offset: float,
        side_margin: float,
        spacer: float,
        bit_diameter: float,
        num_center_sections: int,
        u_center: float
    ) -> Optional[Tuple[int, int, float, float]]:
        """Check if total_slots has a valid symmetric distribution."""
        max_n_end = total_slots // 2
        max_adjustment = max(side_margin * 0.25, 0.5)
        
        for n_end in range(1, max_n_end + 1):
            remaining = total_slots - 2 * n_end
            
            if remaining < num_center_sections:
                continue
            if remaining % num_center_sections != 0:
                continue
                
            n_center = remaining // num_center_sections
            slot_width = (u_center - (n_center - 1) * spacer) / n_center
            
            min_slot_width = bit_diameter + 0.0625  # CNC safety: bit diameter + 1/16"
            if slot_width < min_slot_width:
                continue
            
            u_end_required = n_end * slot_width + (n_end - 1) * spacer
            adjusted_side_margin = panel_width - x_offset - u_end_required
            
            if adjusted_side_margin < x_offset * 0.5:
                continue
            
            margin_diff = abs(adjusted_side_margin - side_margin)
            if margin_diff <= max_adjustment:
                return (n_end, n_center, adjusted_side_margin, slot_width)
        
        return None
        
    def compute_valid_slot_counts(
        self,
        n_sections: int,
        panel_width: float,
        side_margin: float,
        x_offset: float,
        spacer: float,
        bit_diameter: float
    ) -> List[Dict[str, int]]:
        """
        Enumerate all valid total_slots values that produce symmetric distribution
        for the given geometry and side_margin.
        
        Returns list of {total_slots, n_end} dicts for frontend to set symmetric_n_end.
        """
        if n_sections < 3:
            return []
        
        center_usable = panel_width - 2 * x_offset
        end_usable = panel_width - side_margin - x_offset
        num_center_sections = n_sections - 2
        min_slot_width = bit_diameter + 0.0625
        
        valid_configs: List[Dict[str, int]] = []
        seen_totals: set = set()
        
        # Iterate n_center from 1 upward until slot_width becomes too small
        n_center = 1
        while True:
            slot_width = (center_usable - (n_center - 1) * spacer) / n_center
            
            if slot_width < min_slot_width:
                break
            
            # Calculate n_end that fits in end_usable with this slot_width
            n_end_float = (end_usable + spacer) / (slot_width + spacer)
            n_end = int(n_end_float)
            
            if n_end >= 1:
                total_slots = 2 * n_end + num_center_sections * n_center
                if total_slots not in seen_totals:
                    seen_totals = seen_totals | {total_slots}
                    valid_configs = valid_configs + [{'total_slots': total_slots, 'n_end': n_end}]
            
            n_center += 1
        
        return sorted(valid_configs, key=lambda x: x['total_slots'])   
    
    def compute_margin_presets(
        self,
        total_slots: int,
        n_sections: int,
        panel_width: float,
        x_offset: float,
        spacer: float,
        bit_diameter: float
    ) -> List[Dict[str, Any]]:
        """
        Enumerate all valid (n_end, n_center, side_margin) configurations
        for rectangular linear n>=3.
        """
        if n_sections < 3:
            return []
        
        center_usable = panel_width - 2 * x_offset
        num_center_sections = n_sections - 2
        min_slot_width = bit_diameter + 0.0625
        
        valid_configs: List[Dict[str, Any]] = []
        
        for n_end in range(1, total_slots // 2 + 1):
            remaining = total_slots - 2 * n_end
            
            if remaining < num_center_sections:
                continue
            if remaining % num_center_sections != 0:
                continue
            
            n_center = remaining // num_center_sections
            slot_width = (center_usable - (n_center - 1) * spacer) / n_center
            
            if slot_width < min_slot_width:
                continue
            
            end_span = n_end * slot_width + (n_end - 1) * spacer
            side_margin = panel_width - x_offset - end_span
            
            if side_margin < x_offset:
                continue
            
            valid_configs = valid_configs + [{
                'n_end': n_end,
                'n_center': n_center,
                'side_margin': round(side_margin, 3),
                'slot_width': round(slot_width, 4)
            }]
        
        valid_configs = sorted(valid_configs, key=lambda x: x['side_margin'])
        
        n = len(valid_configs)
        for i, config in enumerate(valid_configs):
            if i == 0:
                config['label'] = 'Minimum'
            elif i == n - 1:
                config['label'] = 'Maximum'
            elif n >= 5:
                pct = i / (n - 1)
                if pct < 0.33:
                    config['label'] = 'Small'
                elif pct < 0.66:
                    config['label'] = 'Medium'
                else:
                    config['label'] = 'Large'
            else:
                config['label'] = f'{config["side_margin"]}"'
        
        return valid_configs
    
    def _generate_radial_slots(
        self, 
        state: 'CompositionStateDTO', 
        geometry: GeometryResultDTO, 
        amplitudes: List[float]
    ) -> List[List[List[float]]]:
        """Generate radial slot coordinates."""
        
        # Extract shape for use in nested scope
        frame_shape = state.frame_design.shape
        number_sections = state.frame_design.number_sections
        number_slots = state.pattern_settings.number_slots
        slots_per_section = number_slots // number_sections
        
        # Extract commonly used params from DTO
        section_local_centers = geometry.section_local_centers
        reference_angles = geometry.reference_angles
        
        # Generate all slots immutably
        all_slots: List[List[List[float]]] = []
        
        for slot_index in range(number_slots):
            section_id = slot_index // slots_per_section
            local_slot_index = slot_index % slots_per_section
            
            # Amplitude with exponent
            amplitude = amplitudes[slot_index]
            scaled_amplitude = amplitude # * state.pattern_settings.amplitude_exponent
            
            # Symmetric extents about center point
            inward_extent = scaled_amplitude / 2.0
            outward_extent = scaled_amplitude / 2.0
            
            # Calculate per-slot visual adjustment if needed
            visual_adjustment = 0.0
            # Visual correction only applies to multi-section CIRCULAR designs
            if state.visual_correction.apply_correction and number_sections > 1:
                gc_x = state.frame_design.finish_x / 2.0
                gc_y = state.frame_design.finish_y / 2.0
                global_center = (gc_x, gc_y)
                
                lc_x, lc_y = section_local_centers[section_id]
                local_center = (lc_x, lc_y)
                
                unit_centerline_deg = reference_angles[local_slot_index]
                section_rotation_offset = 0.0
                
                if number_sections == 2:
                    if section_id == 1:
                        section_rotation_offset = 180.0
                elif number_sections == 3:
                    base_n3_offset = state.pattern_settings.grain_angle - 90.0
                    n3_section_rotations = [60.0, 300.0, 180.0]
                    section_rotation_offset = n3_section_rotations[section_id] + base_n3_offset
                elif number_sections == 4:
                    section_rotations_n4 = [0.0, 270.0, 180.0, 90.0]
                    section_rotation_offset = section_rotations_n4[section_id]
                    
                slot_global_angle_deg = unit_centerline_deg + section_rotation_offset
                while slot_global_angle_deg < 0:
                    slot_global_angle_deg += 360.0
                while slot_global_angle_deg >= 360.0:
                    slot_global_angle_deg -= 360.0
                    
                # CRITICAL: Use inscribed circle for ALL shapes
                # geometry.radius already has the correct inscribed circle
                global_radius = geometry.radius
                max_reach_from_lc = geometry.max_radius_local
                
                visual_adjustment = self._calculate_center_point_adjustment(
                    state, global_center, local_center, global_radius, slot_global_angle_deg,
                    max_reach_from_lc, number_sections, section_id
                )
                
                visual_adjustment *= state.visual_correction.correction_scale
            
            # Calculate slot coordinates
            slot_coords = self._calculate_radial_slot_coords(
                local_slot_index, geometry, section_id,
                0.0,  # nudge_distance
                state.visual_correction.correction_mode.lower().replace(" ", "_").replace("_adj", "_adj"),
                visual_adjustment, inward_extent, outward_extent
            )
            
            if slot_coords:
                slot_as_list = [[float(x), float(y)] for x, y in slot_coords]
                all_slots = all_slots + [slot_as_list]
            else:
                all_slots = all_slots + [[]]
        
        return all_slots
    
    def _calculate_center_point_adjustment(
        self, state: CompositionStateDTO, global_center_coords: Tuple[float, float], local_center_coords: Tuple[float, float],
        global_circle_radius: float, slot_centerline_global_angle_deg: float,
        current_max_slot_reach_from_lc: float, number_sections: int, section_id: int
    ) -> float:
        """Calculate per-slot visual adjustment."""
        h_gc, k_gc = global_center_coords
        lc_x_abs, lc_y_abs = local_center_coords
        epsilon = 1e-9
        a = lc_x_abs - h_gc
        b = lc_y_abs - k_gc
        r = global_circle_radius
        
        theta_rad = math.radians(slot_centerline_global_angle_deg)
        cos_theta = math.cos(theta_rad)
        sin_theta = math.sin(theta_rad)
        
        shape = state.frame_design.shape

        if shape == 'rectangular':
            # For a rectangle, find the intersection with the four bounding lines.
            rect_half_width = state.frame_design.finish_x / 2.0
            rect_half_height = state.frame_design.finish_y / 2.0
            
            t_values: List[float] = []
            # Intersection with vertical lines (x = +/- half_width)
            if abs(cos_theta) > epsilon:
                t_x1 = (rect_half_width - a) / cos_theta
                t_x2 = (-rect_half_width - a) / cos_theta
                if t_x1 >= -epsilon: t_values = t_values + [t_x1]
                if t_x2 >= -epsilon: t_values = t_values + [t_x2]

            # Intersection with horizontal lines (y = +/- half_height)
            if abs(sin_theta) > epsilon:
                t_y1 = (rect_half_height - b) / sin_theta
                t_y2 = (-rect_half_height - b) / sin_theta
                if t_y1 >= -epsilon: t_values = t_values + [t_y1]
                if t_y2 >= -epsilon: t_values = t_values + [t_y2]
            
            hypotLength = min(t_values) if t_values else 0.0

        else:  # 'circular'
            # Original line-circle intersection logic
            A = 2 * (a * cos_theta + b * sin_theta)
            B = a**2 + b**2 - r**2
            
            discriminant = A**2 - 4 * B
            if discriminant < 0:
                return 0.0
            
            sqrt_disc = math.sqrt(discriminant)
            t1 = (-A + sqrt_disc) / 2.0
            t2 = (-A - sqrt_disc) / 2.0
            
            valid_t = [t for t in [t1, t2] if t >= -epsilon]
            if not valid_t:
                return 0.0
                
            hypotLength = min(valid_t)
        
        baseAdjust = global_circle_radius - current_max_slot_reach_from_lc
        
        section_main_angles = {
            2: {0: 0, 1: 180},
            3: {0: 90, 1: 330, 2: 210},
            4: {0: 45, 1: 315, 2: 225, 3: 135},
        }
        
        if number_sections in section_main_angles:
            main_angle = section_main_angles[number_sections].get(section_id, 0)
            angle_diff = abs(slot_centerline_global_angle_deg - main_angle)
            if angle_diff > 180:
                angle_diff = 360 - angle_diff
            angle_factor = (1 - math.cos(math.radians(angle_diff))) / 2
            centerPointAdjust = baseAdjust * angle_factor
        else:
            centerPointAdjust = baseAdjust
            
        return max(0.0, centerPointAdjust)
    
    def _calculate_radial_slot_coords(
        self, slot_index: int, geometry: GeometryResultDTO, section_id: int,
        nudge_distance: float, correction_mode: str, visual_adjustment: float,
        inward_extent: float, outward_extent: float
    ) -> List[Tuple[float, float]]:
        """Calculate coordinates for a single radial slot."""
        lc_x, lc_y = geometry.section_local_centers[section_id]
        unit_centerline_deg = geometry.reference_angles[slot_index]
        slot_angle_deg = geometry.slot_angle_deg
        
        section_rotation_offset = 0.0
        number_sections = geometry.numberSections
        grain_angle = geometry.grainAngle
        
        if number_sections == 2 and section_id == 1:
            section_rotation_offset = 180.0
        elif number_sections == 3:
            base_n3_offset = grain_angle - 90.0
            n3_section_rotations = [60.0, 300.0, 180.0]
            section_rotation_offset = n3_section_rotations[section_id] + base_n3_offset
        elif number_sections == 4:
            section_rotations_n4 = [0.0, 270.0, 180.0, 90.0]
            section_rotation_offset = section_rotations_n4[section_id]
        
        slot_fan_centerline_deg = (unit_centerline_deg + section_rotation_offset) % 360
        slot_fan_centerline_rad = math.radians(slot_fan_centerline_deg)
        
        # Create local variables to avoid mutating input parameters, fixing the violation.
        current_slot_center_point_from_V = geometry.center_point_local
        adjusted_nudge_distance = nudge_distance
        
        if correction_mode == "center_adj":
            current_slot_center_point_from_V += visual_adjustment
        elif correction_mode == "nudge_adj":
            adjusted_nudge_distance += visual_adjustment
        
        adjusted_offset = geometry.circum_radius + adjusted_nudge_distance
        V_x = lc_x + adjusted_offset * math.cos(slot_fan_centerline_rad)
        V_y = lc_y + adjusted_offset * math.sin(slot_fan_centerline_rad)
        
        min_radial_dist_from_V_allowed = geometry.min_radius_from_V_calc
        max_radial_dist_from_V_allowed = geometry.max_radius_local - geometry.circum_radius
        
        ref_len1_from_V = max(current_slot_center_point_from_V - inward_extent, min_radial_dist_from_V_allowed)
        ref_len2_from_V = min(current_slot_center_point_from_V + outward_extent, max_radial_dist_from_V_allowed)
        
        if ref_len2_from_V < ref_len1_from_V + 1e-6:
            ref_len2_from_V = ref_len1_from_V + 1e-6
        
        half_slot_angle_rad = math.radians(slot_angle_deg / 2.0)
        cos_half_angle = math.cos(half_slot_angle_rad)
        
        length1 = ref_len1_from_V / cos_half_angle
        length2 = ref_len2_from_V / cos_half_angle
        
        angle_V_side_1_rad = slot_fan_centerline_rad - half_slot_angle_rad
        angle_V_side_2_rad = slot_fan_centerline_rad + half_slot_angle_rad
        
        p1 = (V_x + length1 * math.cos(angle_V_side_1_rad), V_y + length1 * math.sin(angle_V_side_1_rad))
        p2 = (V_x + length2 * math.cos(angle_V_side_1_rad), V_y + length2 * math.sin(angle_V_side_1_rad))
        p3 = (V_x + length2 * math.cos(angle_V_side_2_rad), V_y + length2 * math.sin(angle_V_side_2_rad))
        p4 = (V_x + length1 * math.cos(angle_V_side_2_rad), V_y + length1 * math.sin(angle_V_side_2_rad))
        
        return [p1, p2, p3, p4, p1]
```

## File: `C:\Users\paulj\WDweb\services\audio_processing_service.py`

```python
# services/audio_processing_service.py
"""
PARITY DIAGNOSTIC VERSION - Web Backend Audio Processing Service

This file replaces the production audio_processing_service.py temporarily.
Adds [PARITY-WEB] JSON output at each pipeline stage for comparison with PyQt.

USAGE:
1. Back up original: cp services/audio_processing_service.py services/audio_processing_service.py.bak
2. Replace with this file: cp web_backend_parity_diagnostic.py services/audio_processing_service.py
3. Run parity test
4. Restore original: cp services/audio_processing_service.py.bak services/audio_processing_service.py

NO LOGIC CHANGES - Only print statements added.
"""

import json
import math
import numpy as np
from typing import Tuple, Dict, Any, List, Optional
from enum import Enum
from pathlib import Path
import tempfile
import os
import subprocess
import shutil
from services.dtos import CompositionStateDTO
from dev_utils.performance_monitor import performance_monitor


class BinningMode(Enum):
    """Binning modes for audio amplitude processing."""
    MEAN_ABSOLUTE = "mean_abs"
    MIN_MAX = "min_max" 
    CONTINUOUS = "continuous"


def _parity_json(stage: str, data: dict) -> None:
    """Print parity diagnostic in format matching PyQt output."""
    print(f"[PARITY-WEB] {stage}: {json.dumps(data)}")


class AudioProcessingService:
    """
    DIAGNOSTIC VERSION - Static service for audio processing with parity output.
    All methods must produce numerically identical outputs to PyQt versions.
    """
    
    def __init__(self):
        """Initialize the service. This service is stateless."""
        pass
    
    @staticmethod
    def scale_and_clamp_amplitudes(
        normalized_amps: List[float],
        max_amplitude: float,
        bit_diameter: float
    ) -> List[float]:
        """
        Scale normalized amplitudes to physical dimensions with floor clamp.
        """
        floor = bit_diameter * 2.0
        return [max(amp * max_amplitude, floor) for amp in normalized_amps]
    
    @staticmethod
    def filter_data(amplitudes: np.ndarray, filter_amount: float) -> np.ndarray:
        """
        Filter data by subtracting noise floor and renormalizing.
        CRITICAL: Must run BEFORE applying exponent/compression.
        """
        if len(amplitudes) == 0 or filter_amount <= 0:
            return amplitudes
        sorted_amps = np.array(sorted(np.abs(amplitudes)))
        n = max(1, int(len(sorted_amps) * filter_amount))
        noise_floor = np.mean(sorted_amps[:n])
        filtered = np.maximum(0, np.abs(amplitudes) - noise_floor)
        max_val = np.max(filtered)
        if max_val > 1e-9:
            filtered = filtered / max_val
        return filtered
    
    @staticmethod
    def extract_amplitudes(y: np.ndarray, num_amplitudes: int) -> np.ndarray:
        """
        Port of PyQt's _extract_amplitudes.
        Converts to mono, normalizes to [-1, 1], resamples to exactly num_amplitudes samples.
        """
        # Work on a copy to preserve immutability
        y_work = y.copy()
        
        # Convert to mono if multi-channel
        if y_work.ndim > 1:
            y_work = np.mean(y_work, axis=1)
        
        # Normalize to [-1, 1]
        max_abs = np.max(np.abs(y_work))
        if max_abs > 1e-9:
            y_work = y_work / max_abs
        else:
            y_work = np.zeros_like(y_work)
        
        # Handle edge cases
        current_len = len(y_work)
        if current_len == num_amplitudes or current_len == 0:
            return y_work
        
        # Resample to target size
        target_indices = np.linspace(0, current_len - 1, num_amplitudes)
        if current_len > num_amplitudes:
            # Downsample by taking values at target indices
            y_work = y_work[target_indices.astype(int)]
        else:
            # Upsample using linear interpolation
            y_work = np.interp(target_indices, np.arange(current_len), y_work)
        
        return y_work
    
    @staticmethod
    def bin_amplitudes(amplitudes: np.ndarray, num_slots: int, 
                      mode: BinningMode) -> Tuple[np.ndarray, np.ndarray]:
        """
        Port of PyQt's bin_amplitudes.
        Bins amplitudes into slots using specified mode.
        """
        if amplitudes is None or len(amplitudes) == 0:
            return np.zeros(num_slots), np.zeros(num_slots)

        if num_slots <= 0:
            raise ValueError("Number of slots must be positive")

        min_binned_data = np.zeros(num_slots)
        max_binned_data = np.zeros(num_slots)

        if mode == BinningMode.CONTINUOUS:
            # Check if we have gaps from silence removal
            if len(amplitudes) < num_slots * 0.8:
                # Fallback to mean_abs
                return AudioProcessingService.bin_amplitudes(amplitudes, num_slots, BinningMode.MEAN_ABSOLUTE)
            
            # Direct resampling for continuous mode
            if len(amplitudes) != num_slots:
                old_indices = np.arange(len(amplitudes))
                new_indices = np.linspace(0, len(amplitudes)-1, num_slots)
                resampled = np.interp(new_indices, old_indices, amplitudes)
            else:
                resampled = amplitudes.copy()
            
            for i in range(num_slots):
                val = resampled[i]
                if val >= 0:
                    max_binned_data[i] = val
                    min_binned_data[i] = 0
                else:
                    max_binned_data[i] = 0
                    min_binned_data[i] = val
                    
        else:
            # Standard binning (MEAN_ABSOLUTE or MIN_MAX)
            samples_per_slot = len(amplitudes) / num_slots
            
            for slot_idx in range(num_slots):
                start_idx = int(slot_idx * samples_per_slot)
                end_idx = int((slot_idx + 1) * samples_per_slot)
                end_idx = min(end_idx, len(amplitudes))
                
                if start_idx >= end_idx:
                    continue
                    
                slot_data = amplitudes[start_idx:end_idx]
                
                if mode == BinningMode.MEAN_ABSOLUTE:
                    mean_abs = np.mean(np.abs(slot_data))
                    max_binned_data[slot_idx] = mean_abs
                    min_binned_data[slot_idx] = -mean_abs
                    
                elif mode == BinningMode.MIN_MAX:
                    max_binned_data[slot_idx] = np.max(slot_data)
                    min_binned_data[slot_idx] = np.min(slot_data)

        # Normalize both arrays by the combined max
        all_values = np.concatenate([np.abs(min_binned_data), np.abs(max_binned_data)])
        max_val = np.max(all_values) if len(all_values) > 0 else 0
        
        if max_val > 1e-9:
            min_binned_data = min_binned_data / max_val
            max_binned_data = max_binned_data / max_val

        return min_binned_data, max_binned_data

    @staticmethod
    def _remove_silence(
        audio_data: np.ndarray,
        sample_rate: int,
        threshold_db: float,
        min_duration: float
    ) -> np.ndarray:
        """Remove silence from audio signal."""
        import librosa
        
        # Get intervals of non-silence
        intervals = librosa.effects.split(
            audio_data,
            top_db=-threshold_db,
            frame_length=2048,
            hop_length=512
        )
        
        if len(intervals) == 0:
            return audio_data
            
        # Filter by minimum duration
        min_samples = int(min_duration * sample_rate)
        valid_intervals = [
            (start, end) for start, end in intervals 
            if (end - start) >= min_samples
        ]
        
        if len(valid_intervals) == 0:
            return audio_data
            
        # Concatenate non-silent segments
        segments = [audio_data[start:end] for start, end in valid_intervals]
        return np.concatenate(segments)

    def process_audio_file(
        self,
        audio_path: str,
        state: CompositionStateDTO
    ) -> Dict[str, Any]:
        """
        DIAGNOSTIC VERSION - Process audio file with parity output at each stage.
        """
        import librosa
        
        performance_monitor.start('total_audio_processing')
        
        print("\n" + "="*60)
        print("[PARITY-WEB] === AUDIO PIPELINE DIAGNOSTIC START ===")
        print("="*60)
        
        # Load audio file
        audio_data, sample_rate = librosa.load(audio_path, sr=None, mono=True)
        
        _parity_json("stage0_loaded", {
            "count": len(audio_data),
            "sample_rate": sample_rate,
            "duration": float(len(audio_data) / sample_rate),
            "first5": audio_data[:5].tolist(),
            "last5": audio_data[-5:].tolist()
        })
        
        # Apply silence removal if configured
        if state.audio_processing and state.audio_processing.remove_silence:
            threshold = state.audio_processing.silence_threshold
            duration = state.audio_processing.silence_duration
            audio_data = self._remove_silence(audio_data, sample_rate, threshold, duration)
            
            _parity_json("stage0b_silence_removed", {
                "count": len(audio_data),
                "threshold_db": threshold,
                "min_duration": duration
            })
        
        performance_monitor.start('amplitude_extraction_and_binning')
        
        # Stage 1: Resample to 200k samples
        num_raw_samples = 200000
        samples = self.extract_amplitudes(audio_data, num_raw_samples)
        
        _parity_json("stage1_resampled", {
            "count": len(samples),
            "min": float(np.min(samples)),
            "max": float(np.max(samples)),
            "first10": samples[:10].tolist(),
            "sum": float(np.sum(samples))
        })
        
        # Stage 2: Bin to num_slots
        num_slots = state.pattern_settings.number_slots
        
        # Get binning mode
        mode_str = "mean_abs"
        if state.audio_processing and state.audio_processing.binning_mode:
            mode_str = state.audio_processing.binning_mode
        
        mode_map = {
            "mean_abs": "mean_abs",
            "mean_absolute": "mean_abs",
            "min_max": "min_max",
            "minmax": "min_max",
            "continuous": "continuous"
        }
        mode_str = mode_map.get(mode_str, "mean_abs")
        binning_mode = BinningMode(mode_str)
        
        min_normalized, max_normalized = self.bin_amplitudes(samples, num_slots, binning_mode)
        
        _parity_json("stage2_binned", {
            "count": len(max_normalized),
            "min": float(np.min(max_normalized)),
            "max": float(np.max(max_normalized)),
            "first10": max_normalized[:10].tolist(),
            "last5": max_normalized[-5:].tolist(),
            "sum": float(np.sum(max_normalized)),
            "binning_mode": str(binning_mode.value)
        })
        
        # Stage 3: Apply filter (BEFORE exponent)
        apply_filter = False
        filter_amount = 0.0
        if state.audio_processing:
            apply_filter = state.audio_processing.apply_filter or False
            filter_amount = state.audio_processing.filter_amount or 0.0
        
        if apply_filter and filter_amount > 0:
            min_normalized = self.filter_data(min_normalized, filter_amount)
            max_normalized = self.filter_data(max_normalized, filter_amount)
        
        _parity_json("stage3_filtered", {
            "count": len(max_normalized),
            "min": float(np.min(max_normalized)),
            "max": float(np.max(max_normalized)),
            "first10": max_normalized[:10].tolist(),
            "apply_filter": apply_filter,
            "filter_amount": filter_amount
        })
        
        # Stage 4: Apply exponent
        exponent = state.pattern_settings.amplitude_exponent
        if exponent != 1.0:
            min_normalized = np.power(np.abs(min_normalized), exponent) * np.sign(min_normalized)
            max_normalized = np.power(np.abs(max_normalized), exponent) * np.sign(max_normalized)
        
        _parity_json("stage4_afterExponent", {
            "count": len(max_normalized),
            "min": float(np.min(max_normalized)),
            "max": float(np.max(max_normalized)),
            "first10": max_normalized[:10].tolist(),
            "exponent": exponent
        })
        
        # Normalize after exponent (match PyQt behavior)
        all_values = np.concatenate([np.abs(min_normalized), np.abs(max_normalized)])
        max_val = np.max(all_values)
        if max_val > 1e-9:
            min_normalized = min_normalized / max_val
            max_normalized = max_normalized / max_val
        
        _parity_json("stage4b_normalized", {
            "count": len(max_normalized),
            "min": float(np.min(max_normalized)),
            "max": float(np.max(max_normalized)),
            "first10": max_normalized[:10].tolist()
        })
        
        performance_monitor.end('amplitude_extraction_and_binning')
        performance_monitor.end('total_audio_processing')
        
        print("="*60)
        print("[PARITY-WEB] === AUDIO PIPELINE DIAGNOSTIC END ===")
        print("="*60 + "\n")
        
        # NOTE: Scaling (Stage 5) happens in service_facade.py after geometry calculation
        # The facade calls scale_and_clamp_amplitudes() with max_amplitude_local
        
        return {
            "min_amplitudes": min_normalized.tolist(),
            "max_amplitudes": max_normalized.tolist(),
            "raw_samples_for_cache": samples.tolist()
        }

    @staticmethod
    def calculate_auto_roll_for_sections(num_sections: int, num_slots: int) -> int:
        """Calculate automatic roll amount for n=3 sections business logic."""
        if num_sections == 3 and num_slots > 0:
            slots_in_section = num_slots // 3
            return slots_in_section // 2
        return 0

    @staticmethod
    def analyze_and_optimize(
        samples: np.ndarray, 
        num_slots: int, 
        mode: str = "music"
    ) -> Dict[str, Any]:
        """Runs a grid search to find the best amplitude exponent."""
        
        # Mode defaults
        if mode == "speech":
            binning_mode = BinningMode.MIN_MAX
            filter_amount = 0.05
            fallback_exp = 0.6
            candidates = [0.8, 0.6, 0.45, 0.35, 0.25]
        else:  # music
            binning_mode = BinningMode.MEAN_ABSOLUTE
            filter_amount = 0.02
            fallback_exp = 1.0
            candidates = [1.0, 0.9, 0.8, 0.7, 0.6]

        # Resample
        resampled_samples = AudioProcessingService.extract_amplitudes(samples, 200000)
        
        # Bin
        _, max_b = AudioProcessingService.bin_amplitudes(resampled_samples, num_slots, binning_mode)
        baseline = max_b
        
        # Filter
        clean_data = AudioProcessingService.filter_data(baseline, filter_amount)

        # Dynamic silence threshold (speech only)
        rec_threshold = -40
        if mode == "speech":
            abs_samples = np.abs(resampled_samples)
            non_zeros = abs_samples[abs_samples > 1e-5]
            if len(non_zeros) > 0:
                noise_floor_db = 20 * np.log10(np.percentile(non_zeros, 15))
                rec_threshold = int(max(-60, min(-10, noise_floor_db + 4)))

        # Grid search
        best_score = -float('inf')
        best_exp = fallback_exp
        logs = []

        for exp in candidates:
            compressed = np.power(clean_data, exp)
            
            # Normalize
            max_val = np.max(compressed)
            if max_val > 1e-9:
                compressed = compressed / max_val
            
            # Score
            p10 = np.percentile(compressed, 10)
            p90 = np.percentile(compressed, 90)
            spread = p90 - p10
            
            brick_pct = np.sum(compressed > 0.95) / len(compressed)
            ghost_pct = np.sum(compressed < 0.15) / len(compressed)
            
            score = spread - (brick_pct * 2.0) - (ghost_pct * 1.5)
            
            logs.append({
                "exp": exp,
                "spread": round(spread, 4),
                "brick": round(brick_pct, 4),
                "ghost": round(ghost_pct, 4),
                "score": round(score, 4)
            })
            
            if score > best_score:
                best_score = score
                best_exp = exp

        # Fallback check
        status = "success"
        if best_score < -0.1:
            best_exp = fallback_exp
            status = "fallback"

        return {
            "exponent": best_exp,
            "filter_amount": filter_amount,
            "silence_threshold": rec_threshold,
            "binning_mode": binning_mode.value,
            "remove_silence": mode == "speech",
            "silence_duration": 0.2 if mode == "speech" else 0.5,
            "score": round(best_score, 4),
            "status": status,
            "logs": logs
        }

```

## File: `C:\Users\paulj\WDweb\services\dtos.py`

```python
"""
Data Transfer Objects (DTOs) for WaveDesigner
Following Pragmatic Immutability principle - all DTOs are frozen

CONSTRAINT PHILOSOPHY:
- Field constraints here are STRUCTURAL INVARIANTS only (e.g., non-negative counts, normalized 0-1 ranges)
- Business-rule limits (max dimensions, slot counts) are validated by service layer against config JSON
- Business-configurable enumerations use `str` - validated against config at runtime
- Engine-fixed enumerations use `Literal` - these require code changes to extend

BUSINESS-CONFIGURABLE (str):
- grain_direction: wood_materials.json valid_grain_directions
- backing type: backing_materials.json material_catalog keys
- shape: constraints.json valid_shapes  
- color_palette: composition_defaults.json color_palettes keys

ENGINE-FIXED (Literal):
- frame_orientation: geometric constraint (2 physical orientations)
- dovetail_cut_direction: CNC machining constraint
- slot_style: geometry engine algorithms
- orientation: geometric constraint
- stem_choice: Demucs AI external dependency
- binning_method, binning_mode: statistical algorithms
- peak control method: audio processing algorithms
- correction_mode: algorithm implementations
- artistic_style: shader implementations
"""

from typing import List, Dict, Optional, Literal, Tuple, Any
from pydantic import BaseModel, Field, ConfigDict, model_validator
from pydantic.alias_generators import to_camel


# Configuration DTOs
class SpeciesCatalogItemDTO(BaseModel):
    """Individual species catalog entry."""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    id: str
    display: str
    wood_number: str


class WoodMaterialsConfigDTO(BaseModel):
    """Wood materials configuration from wood_materials.json."""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    default_species: str
    default_grain_direction: str  # Validated against valid_grain_directions in config
    species_catalog: List[SpeciesCatalogItemDTO]
    texture_config: Dict[str, Any]
    rendering_config: Dict[str, float]
    geometry_constants: Dict[str, Dict[str, List[int]]]


# Material Configuration DTOs
class SectionMaterialDTO(BaseModel):
    """Material settings for individual sections."""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    section_id: int = Field(ge=0)  # Upper bound from constraints.json
    species: str  # Validated against species_catalog in wood_materials.json
    grain_direction: str  # Validated against valid_grain_directions in wood_materials.json


class ArtPlacementDTO(BaseModel):
    """Defines the 3D placement of the artwork in a scene."""
    model_config = ConfigDict(frozen=True)
    position: Tuple[float, float, float]
    scale_factor: float
    rotation: Tuple[float, float, float]


class BackgroundPlacementDTO(BaseModel):
    """Contains overrides for a specific background."""
    model_config = ConfigDict(frozen=True)
    composition_overrides: Optional[Dict[str, Any]] = None
    art_placement: Optional[ArtPlacementDTO] = None


class ArchetypePlacementDTO(BaseModel):
    """Contains all background-specific overrides for a single archetype."""
    model_config = ConfigDict(frozen=True)
    backgrounds: Dict[str, BackgroundPlacementDTO]


class PlacementDefaultsDTO(BaseModel):
    """The root model for placement_defaults.json."""
    model_config = ConfigDict(frozen=True)
    version: str
    archetypes: Dict[str, ArchetypePlacementDTO]


class BackingConfig(BaseModel):
    """Backing material configuration."""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    enabled: bool
    type: str  # Validated against material_catalog keys in backing_materials.json
    material: str  # Validated against materials within the type
    inset: float = Field(ge=0.0)  # Upper bound from backing_materials.json


# Frame and Physical Design DTOs
class FrameDesignDTO(BaseModel):
    """Frame design parameters for the physical panel."""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    shape: str  # Validated against valid_shapes in constraints.json
    frame_orientation: Literal["vertical", "horizontal"]  # Engine-fixed: geometric constraint
    finish_x: float = Field(ge=1.0)  # Upper bound from constraints.json
    finish_y: float = Field(ge=1.0)  # Upper bound from constraints.json
    finish_z: float = Field(ge=0.1)  # Upper bound from config
    number_sections: int = Field(ge=1)  # Upper bound from constraints.json
    separation: float = Field(ge=0.0)  # Upper bound from constraints.json
    species: str  # Validated against species_catalog in wood_materials.json
    material_thickness: float = Field(ge=0.1)  # Upper bound from config
    section_materials: List[SectionMaterialDTO] = Field(default_factory=list)
    backing: Optional[BackingConfig] = None
    
    @model_validator(mode='after')
    def validate_circular_dimensions(self) -> 'FrameDesignDTO':
        """Ensure circular shape has equal width and height."""
        if self.shape == "circular" and abs(self.finish_x - self.finish_y) > 0.01:
            raise ValueError(
                f"Circular shape requires equal dimensions. "
                f"Got finish_x={self.finish_x}, finish_y={self.finish_y}"
            )
        return self


# Pattern and Slot Configuration DTOs
class DovetailSettingsDTO(BaseModel):
    """Dovetail path generation settings"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    generate_dovetails: bool
    show_dovetails: bool
    dovetail_inset: float = Field(ge=0.01)  # Upper bound from config
    dovetail_cut_direction: Literal["climb", "conventional"]  # Engine-fixed: CNC machining
    dovetail_edge_default: int = Field(ge=0)  # Upper bound derived from max sections
    dovetail_edge_overrides: str  # JSON string of overrides


class PatternSettingsDTO(BaseModel):
    """Slot pattern configuration"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    slot_style: Literal["radial", "linear", "sunburst"]  # Engine-fixed: geometry algorithms
    pattern_diameter: float = Field(default=36.0, ge=1.0)  # Upper bound from constraints.json
    number_slots: int = Field(ge=1)  # Upper bound from constraints.json
    bit_diameter: float = Field(ge=0.0)  # Upper bound from config
    spacer: float = Field(ge=0.0)  # Upper bound from config
    x_offset: float = Field(ge=0.0)  # Upper bound from constraints.json
    y_offset: float = Field(ge=0.0)  # Upper bound from constraints.json
    side_margin: float = Field(ge=0.0)  # Upper bound from constraints.json
    symmetric_n_end: Optional[int] = Field(
        default=None,
        ge=1,
        description="Override n_end for symmetric distribution in rectangular linear n>=3"
    )
    scale_center_point: float = Field(ge=0.1)  # Upper bound from config
    amplitude_exponent: float = Field(ge=0.25)  # Upper bound from config
    orientation: Literal["auto", "horizontal", "vertical"]  # Engine-fixed: geometric constraint
    grain_angle: float = Field(ge=0.0, le=360.0)  # Mathematical constraint: degrees in circle
    lead_overlap: float = Field(ge=0.0)  # Upper bound from config
    lead_radius: float = Field(ge=0.05)  # Upper bound from config
    dovetail_settings: DovetailSettingsDTO


# Audio Processing DTOs
class AudioSourceDTO(BaseModel):
    """Audio source configuration"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    source_file: Optional[str]
    start_time: float = Field(ge=0.0)
    end_time: float = Field(ge=0.0)
    use_stems: bool
    stem_choice: Literal["vocals", "drums", "bass", "other", "no_vocals", "all"]  # Engine-fixed: Demucs outputs


class AudioProcessingDTO(BaseModel):
    """Audio processing parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    target_sample_rate: Optional[int] = Field(default=None)
    num_raw_samples: int = Field(ge=1)  # Upper bound from config
    filter_amount: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    apply_filter: bool
    binning_method: Literal["mean", "max", "rms"]  # Engine-fixed: statistical algorithms
    binning_mode: Literal["mean_abs", "min_max", "continuous"]  # Engine-fixed: algorithm implementations
    remove_silence: bool
    silence_threshold: int = Field(ge=-80, le=0)  # dB scale: mathematical constraint
    silence_duration: float = Field(ge=0.1)  # Upper bound from config
    silence_frame_length: int = Field(default=2048, ge=1)  # Upper bound from config
    silence_hop_length: int = Field(default=512, ge=1)  # Upper bound from config


# Peak Control DTOs
class PeakControlDTO(BaseModel):
    """Peak detection and control settings"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    method: Literal["clip", "compress", "scale_up", "none"]  # Engine-fixed: audio algorithms
    threshold: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    roll_amount: int
    
    # Individual control toggles
    nudge_enabled: bool
    clip_enabled: bool
    compress_enabled: bool
    scale_enabled: bool
    scale_all_enabled: bool
    manual_enabled: bool
    
    # Control parameters
    clip_percentage: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    compression_exponent: float = Field(ge=0.1)  # Upper bound from config
    threshold_percentage: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    scale_all_percentage: float = Field(ge=0.1)  # Upper bound from config
    manual_slot: int = Field(ge=0)  # Upper bound from number_slots
    manual_value: float  # No constraints - allows any adjustment


# Visual Correction DTOs
class VisualCorrectionDTO(BaseModel):
    """Visual correction parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    apply_correction: bool
    correction_scale: float = Field(ge=0.0)  # Upper bound from config
    correction_mode: Literal["nudge_adj", "center_adj"]  # Engine-fixed: algorithm implementations
    
    @model_validator(mode='before')
    @classmethod
    def normalize_correction_mode(cls, data: Any) -> Any:
        """Normalize legacy correction_mode variants to canonical form."""
        if isinstance(data, dict) and 'correction_mode' in data:
            mode = data['correction_mode'].lower().replace(" ", "_")
            data = {**data, 'correction_mode': mode}  # Immutable update
        return data


# Display Settings DTOs
class DisplaySettingsDTO(BaseModel):
    """Display and visualization settings"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    show_debug_circle: bool
    debug_circle_radius: float = Field(ge=0.1)  # Upper bound from config
    show_labels: bool
    show_offsets: bool


# Export Settings DTOs
class ExportSettingsDTO(BaseModel):
    """Export configuration for various formats"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    cnc_margin: float = Field(ge=0.0)  # Upper bound from constraints.json
    sections_in_sheet: int = Field(ge=1)  # Upper bound from config


# Artistic Rendering DTOs
class ColorPaletteDTO(BaseModel):
    """Color palette definition"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    color_deep: List[float]
    color_mid: List[float]
    color_light: List[float]
    paper_color: List[float]


class WatercolorSettingsDTO(BaseModel):
    """Watercolor style parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    wetness: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    pigment_load: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    paper_roughness: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    bleed_amount: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    granulation: float = Field(ge=0.0, le=1.0)  # Normalized 0-1


class OilSettingsDTO(BaseModel):
    """Oil painting style parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    brush_size: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    impasto: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    brush_texture: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    color_mixing: float = Field(ge=0.0, le=1.0)  # Normalized 0-1


class InkSettingsDTO(BaseModel):
    """Ink style parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    ink_flow: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    ink_density: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    edge_darkening: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    dryness: float = Field(ge=0.0, le=1.0)  # Normalized 0-1


class PhysicalSimulationDTO(BaseModel):
    """Physical paint simulation parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    brush_pressure: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    paint_thickness: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    drying_time: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    medium_viscosity: float = Field(ge=0.0, le=1.0)  # Normalized 0-1


class NoiseSettingsDTO(BaseModel):
    """Noise texture settings"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    noise_scale: float = Field(ge=1.0)  # Upper bound from config
    noise_octaves: float = Field(ge=1.0)  # Upper bound from config
    noise_seed: float = Field(ge=0.0)  # Upper bound from config
    flow_speed: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    flow_direction: float = Field(ge=-1.0, le=1.0)  # Normalized -1 to 1


class ArtisticRenderingDTO(BaseModel):
    """Artistic rendering parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    artistic_style: Literal["watercolor", "oil", "ink"]  # Engine-fixed: shader implementations
    color_palette: str  # Validated against color_palettes keys in composition_defaults.json
    
    # Common artistic parameters
    opacity: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    artistic_intensity: float = Field(ge=0.0, le=1.0)  # Normalized 0-1
    amplitude_effects: str
    amplitude_influence: float = Field(ge=0.0)  # Upper bound from config
    
    # Style-specific settings
    watercolor_settings: WatercolorSettingsDTO
    oil_settings: OilSettingsDTO
    ink_settings: InkSettingsDTO
    
    # Physical simulation
    physical_simulation: PhysicalSimulationDTO
    
    # Noise settings
    noise_settings: NoiseSettingsDTO
    
    # Color palettes
    color_palettes: Dict[str, ColorPaletteDTO]


# Main Composition State DTO
class CompositionStateDTO(BaseModel):
    """Complete state of a WaveDesigner composition"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    frame_design: FrameDesignDTO
    pattern_settings: PatternSettingsDTO
    audio_source: AudioSourceDTO
    audio_processing: AudioProcessingDTO
    peak_control: PeakControlDTO
    visual_correction: VisualCorrectionDTO
    display_settings: DisplaySettingsDTO
    export_settings: ExportSettingsDTO
    artistic_rendering: ArtisticRenderingDTO
    processed_amplitudes: List[float]


# Geometry Result DTO
class GeometryResultDTO(BaseModel):
    """Results from geometry calculations."""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    # Basic configuration
    shape: str
    numberSections: int
    num_slots: int
    slotsInSection: int
    bit_diameter: float
    grainAngle: float
    
    # Global geometry
    radius: float
    original_center_x: float
    original_center_y: float
    
    # Local geometry
    section_local_centers: List[Tuple[float, float]]
    reference_angles: List[float]
    slot_angle_deg: float
    theta_unit_deg: float
    
    # Radius calculations
    true_min_radius: float
    min_radius_local: float
    max_radius_local: float
    circum_radius: float
    min_radius_from_V_calc: float
    
    # Amplitude and center point
    center_point_local: float
    max_amplitude_local: float
    global_amplitude_scale_factor: float
```

## File: `C:\Users\paulj\WDweb\services\geometry_service.py`

```python
# services/geometry_service.py
"""
Service for providing panel geometry parameters and calculations.
This is now the authoritative source for core geometry logic.
"""
import math
from typing import Dict, Any, Tuple, List
from services.dtos import CompositionStateDTO, GeometryResultDTO
from services.dimension_calculator import (
    DimensionConstraints,
    calculate_constrained_dimensions
)

# Panel thickness constant - matches frontend
PANEL_THICKNESS = 0.375  # inches

def get_vertical_space_at_x(x_pos: float, shape: str, y_offset: float, 
                            finish_x: float, finish_y: float) -> float:
    """
    Calculate available vertical space at a given X position.
    
    Args:
        x_pos: X position in CNC coordinates (relative to global center)
        shape: Panel shape ('circular' or 'diamond')
        y_offset: Y offset from boundaries
        finish_x: Panel width
        finish_y: Panel height
        
    Returns:
        Available vertical space at this X position
    """
    if shape == 'circular':
        radius = finish_x / 2.0
        # Chord height at X position: 2 * sqrt(r² - x²)
        x_squared = x_pos * x_pos
        r_squared = radius * radius
        if x_squared > r_squared:
            return 0.0
        chord_height = 2.0 * math.sqrt(r_squared - x_squared)
        return max(0.0, chord_height - 2.0 * y_offset)
        
    elif shape == 'diamond':
        # Diamond edge: linear from peak to corner
        # Height varies linearly from center (finish_y) to edge (0)
        half_width = finish_x / 2.0
        if abs(x_pos) > half_width:
            return 0.0
        # Linear interpolation: height = finish_y * (1 - |x|/half_width)
        edge_height = finish_y * (1.0 - abs(x_pos) / half_width)
        return max(0.0, edge_height - 2.0 * y_offset)
    
    return 0.0
    

def calculate_section_dimensions(
    shape: str,
    finish_x: float,
    finish_y: float,
    number_sections: int,
    separation: float,
    slot_style: str
) -> List[Dict[str, float]]:
    """
    Calculate dimensions and offsets for each section.
    Returns list of {width, height, offset_x, offset_y} for each section.
    """
    if shape == 'circular':
        radius = min(finish_x, finish_y) / 2.0
        diameter = radius * 2.0
        
        if number_sections == 1:
            return [{'width': diameter, 'height': diameter, 'offset_x': 0, 'offset_y': 0}]
        elif number_sections == 2:
            offset = (diameter + separation) / 2.0
            return [
                {'width': diameter, 'height': diameter, 'offset_x': offset, 'offset_y': 0},
                {'width': diameter, 'height': diameter, 'offset_x': -offset, 'offset_y': 0}
            ]
        elif number_sections == 3:
            gap_dist = separation / math.sqrt(3)
            return [
                {'width': diameter, 'height': diameter, 'offset_x': 0, 'offset_y': gap_dist},
                {'width': diameter, 'height': diameter, 'offset_x': gap_dist, 'offset_y': -gap_dist},
                {'width': diameter, 'height': diameter, 'offset_x': -gap_dist, 'offset_y': -gap_dist}
            ]
        elif number_sections == 4:
            offset = (diameter + separation) / 2.0
            return [
                {'width': diameter, 'height': diameter, 'offset_x': offset, 'offset_y': offset},
                {'width': diameter, 'height': diameter, 'offset_x': offset, 'offset_y': -offset},
                {'width': diameter, 'height': diameter, 'offset_x': -offset, 'offset_y': -offset},
                {'width': diameter, 'height': diameter, 'offset_x': -offset, 'offset_y': offset}
            ]
    
    elif shape == 'rectangular':
        if number_sections == 1:
            return [{'width': finish_x, 'height': finish_y, 'offset_x': 0, 'offset_y': 0}]
        elif number_sections == 2:
            section_width = (finish_x - separation) / 2.0
            offset = (section_width + separation) / 2.0
            return [
                {'width': section_width, 'height': finish_y, 'offset_x': offset, 'offset_y': 0},
                {'width': section_width, 'height': finish_y, 'offset_x': -offset, 'offset_y': 0}
            ]
        elif number_sections == 3:
            section_width = (finish_x - 2 * separation) / 3.0
            spacing = section_width + separation
            return [
                {'width': section_width, 'height': finish_y, 'offset_x': spacing, 'offset_y': 0},
                {'width': section_width, 'height': finish_y, 'offset_x': 0, 'offset_y': 0},
                {'width': section_width, 'height': finish_y, 'offset_x': -spacing, 'offset_y': 0}
            ]
        elif number_sections == 4:
            if slot_style == 'linear':
                section_width = (finish_x - 3 * separation) / 4.0
                spacing = section_width + separation
                start_offset = -finish_x / 2.0 + section_width / 2.0
                return [
                    {'width': section_width, 'height': finish_y, 'offset_x': start_offset + spacing * i, 'offset_y': 0}
                    for i in range(4)
                ]
            else:  # radial
                section_width = (finish_x - separation) / 2.0
                section_height = (finish_y - separation) / 2.0
                offset_x = (section_width + separation) / 2.0
                offset_y = (section_height + separation) / 2.0
                return [
                    {'width': section_width, 'height': section_height, 'offset_x': offset_x, 'offset_y': offset_y},
                    {'width': section_width, 'height': section_height, 'offset_x': offset_x, 'offset_y': -offset_y},
                    {'width': section_width, 'height': section_height, 'offset_x': -offset_x, 'offset_y': -offset_y},
                    {'width': section_width, 'height': section_height, 'offset_x': -offset_x, 'offset_y': offset_y}
                ]
    
    elif shape == 'diamond':
        if number_sections == 1:
            return [{'width': finish_x, 'height': finish_y, 'offset_x': 0, 'offset_y': 0}]
        elif number_sections == 2:
            # Two diamonds side by side (horizontally split)
            section_width = (finish_x - separation) / 2.0
            offset_x = (section_width + separation) / 2.0
            return [
                {'width': section_width, 'height': finish_y, 'offset_x': offset_x, 'offset_y': 0},
                {'width': section_width, 'height': finish_y, 'offset_x': -offset_x, 'offset_y': 0}
            ]
        elif number_sections == 4:
            section_width = (finish_x - separation) / 2.0
            section_height = (finish_y - separation) / 2.0
            offset_x = (section_width + separation) / 2.0
            offset_y = (section_height + separation) / 2.0
            return [
                {'width': section_width, 'height': section_height, 'offset_x': offset_x, 'offset_y': offset_y},
                {'width': section_width, 'height': section_height, 'offset_x': offset_x, 'offset_y': -offset_y},
                {'width': section_width, 'height': section_height, 'offset_x': -offset_x, 'offset_y': -offset_y},
                {'width': section_width, 'height': section_height, 'offset_x': -offset_x, 'offset_y': offset_y}
            ]
        
        raise ValueError(f"Diamond shape only supports n=1, 2, or 4, got {number_sections}")
    
    raise ValueError(f"Unsupported shape: {shape}")

def find_max_amplitude_linear_constrained(
    number_sections: int,
    number_slots: int,
    finish_x: float,
    finish_y: float,
    separation: float,
    y_offset: float,
    side_margin: float,
    x_offset: float,
    bit_diameter: float,
    shape: str
) -> float:
    """
    Binary search to find maximum amplitude where all linear slots fit within boundaries.
    
    For circular/diamond shapes with linear slots, vertical space varies by X position.
    This function finds the largest uniform amplitude where no slot violates its local boundary.
    
    Args:
        number_sections: Number of panel sections
        number_slots: Total number of slots
        finish_x: Panel width
        finish_y: Panel height
        separation: Gap between sections
        y_offset: Y offset from boundaries
        side_margin: Horizontal inset from left/right edges
        bit_diameter: Bit diameter for minimum constraint
        shape: Panel shape ('circular' or 'diamond')
        
    Returns:
        Maximum safe amplitude for all slots
    """
    
    # CRITICAL: If this calculation is part of a dimension change request,
    # ensure we're using dimensions that respect aspect ratio constraints.
    # This prevents backend from calculating geometry for dimensions that
    # the frontend would reject due to constraint violations.
    #
    # Note: In current implementation, dimensions are pre-validated by facade
    # before reaching this function, so this is a defensive check.
    # Future enhancement: Accept constraints as parameter if needed.
    
    slots_per_section = number_slots // number_sections if number_sections > 0 else number_slots
    
    # Calculate base panel width (margins are constraints within panels, not layout additions)
    panel_width = (finish_x - separation * (number_sections - 1)) / number_sections
    
    # Generate X positions for all slots immutably (CNC coordinates, centered at origin)
    gc_x = finish_x / 2.0
    
    def generate_slot_x_position(section_id: int, local_slot_index: int) -> float:
        # Determine margins for this section
        if number_sections == 1:
            # Single section: both edges are exterior
            left_margin = x_offset + side_margin
            right_margin = x_offset + side_margin
        elif section_id == 0:
            # Leftmost section: left edge is exterior
            left_margin = x_offset + side_margin
            right_margin = x_offset
        elif section_id == number_sections - 1:
            # Rightmost section: right edge is exterior
            left_margin = x_offset
            right_margin = x_offset + side_margin
        else:
            # Center sections: both edges are interior
            left_margin = x_offset
            right_margin = x_offset
        
        # Calculate usable width and slot width for this section
        section_usable_width = panel_width - left_margin - right_margin
        slot_width = section_usable_width / slots_per_section if slots_per_section > 0 else section_usable_width
        
        panel_x_start = section_id * (panel_width + separation)
        slot_x_cnc = panel_x_start + left_margin + (local_slot_index + 0.5) * slot_width
        return slot_x_cnc - gc_x  # Relative to center
    
    slot_x_positions = [
        generate_slot_x_position(section_id, local_slot_index)
        for section_id in range(number_sections)
        for local_slot_index in range(slots_per_section)
    ]
    
    # Binary search bounds
    lower = bit_diameter * 2.0  # Minimum machinable
    upper = finish_y - 2.0 * y_offset  # Theoretical max (rectangular case)
    tolerance = 0.001  # 1/1000 inch precision
    
    # Binary search for maximum amplitude
    while upper - lower > tolerance:
        test_amplitude = (upper + lower) / 2.0
        
        # Check if all slots fit at this amplitude
        all_fit = True
        for x_pos in slot_x_positions:
            available_space = get_vertical_space_at_x(x_pos, shape, y_offset, finish_x, finish_y)
            if test_amplitude > available_space:
                all_fit = False
                break
        
        if all_fit:
            lower = test_amplitude  # Can go higher
        else:
            upper = test_amplitude  # Hit boundary, must go lower
    
    return lower  # Conservative result

def find_min_radius_newton_raphson(bit_diameter: float, spacer: float, 
                                   num_slots: int) -> float:
    """
    Newton-Raphson solver for minimum radius calculation.
    Solves: 2*asin(bit/2r) + 2*asin(spacer/2r) - (2*pi/N) = 0
    
    Module-level function as it's used by multiple components.
    
    Args:
        bit_diameter: Diameter of cutting bit
        spacer: Space between slots
        num_slots: Total number of slots
        
    Returns:
        Minimum radius that satisfies physical constraints
    """
    epsilon = 1e-12
    tol_r = 1e-6
    tol_f = 1e-9
    max_iter = 100
    
    if num_slots <= 0:
        return 0.0

    total_angle_per_unit_rad = 2 * math.pi / num_slots
    
    def objective(r):
        """Objective function: 2*asin(bit/2r) + 2*asin(spacer/2r) - angle_per_slot"""
        if r <= epsilon:
            return float('inf')
        
        term1 = bit_diameter / (2 * r)
        term2 = spacer / (2 * r)
        
        if term1 > 1 or term2 > 1:
            return float('inf')
        
        try:
            angle_bit = 2 * math.asin(term1)
            angle_spacer = 2 * math.asin(term2)
            return angle_bit + angle_spacer - total_angle_per_unit_rad
        except:
            return float('inf')
    
    def objective_derivative(r):
        """Derivative of objective function for Newton-Raphson."""
        if r <= epsilon:
            return 0
        
        term1 = bit_diameter / (2 * r)
        term2 = spacer / (2 * r)
        
        if term1 >= 1 or term2 >= 1:
            return 0
        
        try:
            d1 = -bit_diameter / (r**2 * math.sqrt(1 - term1**2))
            d2 = -spacer / (r**2 * math.sqrt(1 - term2**2))
            return d1 + d2
        except:
            return 0
    
    # Initial guess
    r = (bit_diameter + spacer) / (2 * math.sin(total_angle_per_unit_rad / 2.0)) \
        if num_slots > 1 and abs(math.sin(total_angle_per_unit_rad / 2.0)) > epsilon \
        else max(bit_diameter, spacer) * 1.1
    
    # Newton-Raphson iteration
    for i in range(max_iter):
        f_r = objective(r)
        
        if not math.isfinite(f_r):
            break
        
        if abs(f_r) < tol_f:
            return r
        
        f_prime_r = objective_derivative(r)
        
        if not math.isfinite(f_prime_r) or abs(f_prime_r) < 1e-12:
            break
        
        step = f_r / f_prime_r
        
        # Limit step size to prevent overshooting
        if abs(step) > r * 0.75 and r > epsilon:
            step = math.copysign(r * 0.75, step)
        
        r_new = r - step
        
        # Ensure r stays positive
        if r_new <= epsilon:
            r = r / 1.2 if r > epsilon * 10 else epsilon * 10
            r = max(r, epsilon * 10)
            if i < max_iter - 10:
                continue
            else:
                break
        
        # Check convergence
        if abs(r_new - r) < tol_r and abs(f_r) < tol_f * 100:
            return r_new
        
        r = r_new
    
    # Fallback if Newton-Raphson fails
    fallback_r = (bit_diameter + spacer) / (2 * math.sin(total_angle_per_unit_rad / 2.0)) \
        if num_slots > 1 and abs(math.sin(total_angle_per_unit_rad / 2.0)) > epsilon \
        else max(bit_diameter, spacer) * 1.1
    
    return fallback_r if fallback_r > (max(bit_diameter, spacer) / 2.0 + epsilon) else r

def calculate_geometries_core(state: 'CompositionStateDTO') -> GeometryResultDTO:
    """
    Port of PyQt's calculate_geometries_core from core/algorithms/geometry_calculator.py.
    
    Calculates all geometry parameters, especially max_amplitude_local.
    Includes Newton-Raphson solver, circum_radius, V-point calculations, and cosine correction.
    
    Args:
        state: Composition state with frame and pattern settings
        
    Returns:
        GeometryResultDTO with all calculated geometry parameters
    """
    # Extract parameters from state
    frame = state.frame_design
    pattern = state.pattern_settings
    
    # Basic parameters
    finish_x = frame.finish_x
    finish_y = frame.finish_y  
    number_sections = frame.number_sections
    separation = frame.separation
    shape = frame.shape
    
    num_slots = pattern.number_slots
    bit_diameter = pattern.bit_diameter
    spacer = pattern.spacer
    x_offset = pattern.x_offset
    y_offset = pattern.y_offset
    grain_angle = pattern.grain_angle
    scale_center_point = pattern.scale_center_point
    
    # Calculate basic values
    slots_in_section = num_slots // number_sections if number_sections > 0 else num_slots
    
    # Global center and radius calculation
    gc_x = finish_x / 2.0
    gc_y = finish_y / 2.0
    
    # Determine the effective radius for the pattern based on shape and slot style.
    if shape == 'circular':
        # For circular panels, the pattern radius is ALWAYS the panel radius.
        radius = finish_x / 2.0
    elif shape == 'diamond':
        if pattern.slot_style == 'radial':
            # Use the inscribed circle radius for a diamond with a radial pattern.
            d1, d2 = finish_x, finish_y
            denominator = 2 * math.sqrt(d1**2 + d2**2)
            radius = (d1 * d2) / denominator if denominator > 1e-9 else min(d1, d2) / 2.0
        else: # Linear style on a diamond
            radius = min(finish_x, finish_y) / 2.0
    else: # Rectangular (and other potential shapes)
        if pattern.slot_style == 'radial':
            # UNIVERSAL: Use inscribed circle (min dimension / 2) for all rectangular
            radius = min(finish_x, finish_y) / 2.0
        else: # Linear style on a rectangular
            radius = min(finish_x, finish_y) / 2.0
    
    # Calculate local centers for multi-section designs
    if number_sections == 1:
        section_local_centers = [(gc_x, gc_y)]
    elif number_sections == 2:
        # For circular and rectangular, sections split vertically
        # For diamond, use same split but geometry is constrained by inscribed circle
        lc_x_right = gc_x + (separation / 2.0) + x_offset
        lc_x_left = gc_x - (separation / 2.0) - x_offset
        section_local_centers = [(lc_x_right, gc_y), (lc_x_left, gc_y)]
    elif number_sections == 3:
        # FIXED: Using x_offset (not y_offset) for n=3
        lc_distance_from_gc = (separation + (2 * x_offset)) / math.sqrt(3) if math.sqrt(3) > 1e-9 else separation + (2 * x_offset)
        section_local_centers = [
            (gc_x + lc_distance_from_gc * math.cos(math.radians(angle_deg)),
             gc_y + lc_distance_from_gc * math.sin(math.radians(angle_deg)))
            for angle_deg in [90, 330, 210]  # Top, bottom-right, bottom-left
        ]
    elif number_sections == 4:
        if pattern.slot_style == "linear":
            # Linear: 4 sections side-by-side horizontally
            section_width = (finish_x - 3 * separation) / 4
            section_local_centers = [
                (gc_x + (-finish_x/2 + section_width/2 + i * (section_width + separation)), gc_y)
                for i in range(4)
            ]
        else:
            # Radial: 2x2 grid at diagonal positions
            effective_side_len = separation + (2 * x_offset)
            lc_distance_from_gc = effective_side_len / math.sqrt(2) if math.sqrt(2) > 1e-9 else effective_side_len
            section_local_centers = [
                (gc_x + lc_distance_from_gc * math.cos(math.radians(angle_deg)),
                 gc_y + lc_distance_from_gc * math.sin(math.radians(angle_deg)))
                for angle_deg in [45, 315, 225, 135]  # TR, BR, BL, TL
            ]
    else:
        section_local_centers = []
    
    # Default values for when num_slots == 0
    true_min_radius = 0.0
    min_radius_local = 0.0
    slot_angle_deg = 0.0
    theta_unit_deg = 0.0
    reference_angles = []
    circum_radius = 0.0
    min_radius_from_V_calc = 0.0
    max_radius_local_from_LC = 0.0
    center_point_from_V = 0.0
    max_amplitude_from_V = 0.0
    
    if num_slots > 0:
        epsilon = 1e-9
        
        # Newton-Raphson calculation for minimum radius
        if bit_diameter <= epsilon and spacer <= epsilon:
            true_min_radius_from_NR = 0.0
        else:
            true_min_radius_from_NR = find_min_radius_newton_raphson(
                bit_diameter, spacer, num_slots
            )
            abs_min_check = max(bit_diameter / 2.0, spacer / 2.0) * 1.0001
            if true_min_radius_from_NR < abs_min_check:
                true_min_radius_from_NR = abs_min_check
        
        true_min_radius = true_min_radius_from_NR
        min_radius_local = true_min_radius_from_NR
        
        # Slot angle calculations
        slot_angle_deg = 360.0 / num_slots
        theta_unit_deg = slot_angle_deg
        
        # Reference angles
        slot0 = grain_angle
        if number_sections >= 2:
            slot0 = grain_angle - (slot_angle_deg / 2.0)
        
        reference_angles = []
        current_angle = slot0
        for _ in range(slots_in_section):
            angle_to_add = current_angle
            while angle_to_add < 0:
                angle_to_add += 360.0
            while angle_to_add >= 360.0:
                angle_to_add -= 360.0
            reference_angles = reference_angles + [angle_to_add]
            current_angle -= slot_angle_deg
        
        # Circumradius calculation
        half_slot_angle_rad = math.radians(slot_angle_deg / 2.0)
        if abs(math.sin(half_slot_angle_rad)) > 1e-9:
            circum_radius = spacer / 2.0 / math.sin(half_slot_angle_rad)
        else:
            circum_radius = spacer * num_slots
        
        # Max radius from local center calculation
        # UNIVERSAL APPROACH: Always use inscribed circle for radial patterns
        # This works for all shapes (circular, rectangular, diamond, future shapes)
        R_global_y_offset = radius - y_offset
        
        if number_sections > 1 and section_local_centers:
            # Calculate local radius by subtracting LC offset from global inscribed circle
            lc_x, lc_y = section_local_centers[0]
            
            # Distance from LC to global center
            if number_sections == 2:
                # Bifurcation at 0° (pointing right), offset is horizontal
                lc_offset = abs(lc_x - gc_x)
            elif number_sections == 3:
                # Bifurcation at 90° (pointing up), offset is vertical
                lc_offset = abs(lc_y - gc_y)
            elif number_sections == 4:
                # Bifurcation at 45° (diagonal), offset is Euclidean distance
                lc_offset = math.sqrt((lc_x - gc_x)**2 + (lc_y - gc_y)**2)
            else:
                lc_offset = 0.0
                
            # Local radius = inscribed circle minus LC offset
            local_radius = radius - lc_offset
            max_radius_local_from_LC = local_radius - y_offset
        else:
            max_radius_local_from_LC = R_global_y_offset
        
        if max_radius_local_from_LC <= true_min_radius_from_NR:
            max_radius_local_from_LC = true_min_radius_from_NR + bit_diameter
        
        # V-POINT CALCULATIONS - Critical for correct amplitude
        # Calculate min/max radius from vertex V
        min_radius_from_V = true_min_radius_from_NR - circum_radius
        max_radius_from_V = max_radius_local_from_LC - circum_radius
        
        # Ensure max_radius_from_V is reasonable
        if max_radius_from_V <= 0:
            max_radius_from_V = bit_diameter
        
        # Ensure min_radius_from_V respects bit chord constraint
        min_r_v_for_bit_chord = 0.0
        if abs(math.sin(half_slot_angle_rad)) > 1e-9:
            min_r_v_for_bit_chord = (bit_diameter / 2.0) / math.sin(half_slot_angle_rad)
        min_r_v_for_bit_chord = max(min_r_v_for_bit_chord, 1e-6)
        
        min_radius_from_V_calc = max(min_radius_from_V, min_r_v_for_bit_chord)
        
        if max_radius_from_V <= min_radius_from_V_calc:
            max_radius_from_V = min_radius_from_V_calc + bit_diameter
        
        # Calculate center point from V
        base_cp_from_V = (min_radius_from_V_calc + max_radius_from_V) / 2.0
        center_point_from_V = base_cp_from_V * scale_center_point
        
        # Calculate maximum amplitude based on V-point geometry
        max_extension_outward = max_radius_from_V - center_point_from_V
        max_extension_inward = center_point_from_V - min_radius_from_V_calc
        max_amplitude_from_V = 2.0 * min(max_extension_outward, max_extension_inward)
        
        # Apply cosine correction for slot angle
        if max_amplitude_from_V < 0:
            max_amplitude_from_V = 0.0
        if slot_angle_deg > 1e-6:
            max_amplitude_from_V *= math.cos(half_slot_angle_rad)
        if max_amplitude_from_V < 0:
            max_amplitude_from_V = 0.0
    
    # Override max_amplitude for linear slots (different geometry)
    slot_style = pattern.slot_style
    if slot_style == "linear":
        if shape == "rectangular":
            # Linear slots: simple vertical constraint
            max_amplitude_from_V = finish_y - 2.0 * y_offset
            center_point_from_V = finish_y / 2.0
        elif shape in ["circular", "diamond"]:
            # Linear slots on circular/diamond: constrained by varying boundary
            # Use binary search to find max amplitude where all slots fit
            side_margin = pattern.side_margin
            max_amplitude_from_V = find_max_amplitude_linear_constrained(
                number_sections,
                num_slots,
                finish_x,
                finish_y,
                separation,
                y_offset,
                side_margin,
                pattern.x_offset,
                bit_diameter,
                shape
            )
            center_point_from_V = max_amplitude_from_V / 2.0
    
    # Return properly typed DTO
    return GeometryResultDTO(
        shape=shape,
        numberSections=number_sections,
        num_slots=num_slots,
        slotsInSection=slots_in_section,
        bit_diameter=bit_diameter,
        grainAngle=grain_angle,
        radius=radius,
        original_center_x=gc_x,
        original_center_y=gc_y,
        section_local_centers=section_local_centers,
        reference_angles=reference_angles,
        slot_angle_deg=slot_angle_deg,
        theta_unit_deg=theta_unit_deg,
        true_min_radius=true_min_radius,
        min_radius_local=min_radius_local,
        max_radius_local=max_radius_local_from_LC,
        circum_radius=circum_radius,
        min_radius_from_V_calc=min_radius_from_V_calc,
        center_point_local=center_point_from_V,
        max_amplitude_local=max_amplitude_from_V,
        global_amplitude_scale_factor=max_amplitude_from_V
    )


class GeometryService:
    """
    Service for providing panel geometry parameters and calculations.
    This is now the authoritative source for core geometry logic.
    """
    
    def calculate_geometries_dto(self, state: CompositionStateDTO) -> GeometryResultDTO:
        """
        Calculate all geometry parameters using the core function.
        This is the authoritative source for geometry calculations.
        Returns a GeometryResultDTO with all calculated parameters.
        """
        return calculate_geometries_core(state)
    
    def get_panel_parameters(self, state: CompositionStateDTO) -> Dict[str, Any]:
        """
        Return parameters needed for CSG panel generation.
        
        Args:
            state: The composition state containing frame design parameters
            
        Returns:
            Dictionary with panel configuration:
                - finish_x: Total composition width in inches
                - finish_y: Total composition height in inches
                - outer_radius: Panel outer radius (finish_x / 2 for circular)
                - thickness: Material thickness in inches  
                - separation: Gap between sections in inches
                - number_sections: Number of panel sections (1-4)
                - shape: Panel shape (circular or rectangular)
        """
        frame = state.frame_design
        
        # Calculate outer_radius for circular panels (used for overlay positioning)
        outer_radius = frame.finish_x / 2.0
        
        result = {
            "finish_x": frame.finish_x,
            "finish_y": frame.finish_y,
            "outer_radius": outer_radius,
            "thickness": PANEL_THICKNESS,
            "separation": frame.separation,
            "number_sections": frame.number_sections,
            "shape": frame.shape,
            "slot_style": state.pattern_settings.slot_style
        }
        print(f"[DEBUG] get_panel_parameters returning: {result}")
        return result
        
    def create_frame_geometry(self, state: CompositionStateDTO) -> List[Dict[str, Any]]:
        """
        Create the frame geometry segments (arcs and lines) for the panel sections.
        Following the PyQt logic from circular_frame.py get_boundary_segments().
        
        For n=3, this creates 3 arcs and 6 lines that define the wedge shapes.
        
        Returns:
            List of segment dictionaries with 'type', 'start', 'end', etc.
        """
        frame = state.frame_design
        number_sections = frame.number_sections
        separation = frame.separation
        
        # Global center and radius
        h = frame.finish_x / 2.0  # global center x
        k = frame.finish_y / 2.0  # global center y
        radius = frame.finish_y / 2.0
        
        if number_sections == 3:
            # Step 1: Calculate the 3 inner vertices (form equilateral triangle)
            # These are at angles 90°, 210°, 330° from global center
            inner_distance = separation / math.sqrt(3)
            inner_vertices = {}
            
            angles_deg = [90, 210, 330]
            for i, angle_deg in enumerate(angles_deg):
                angle_rad = math.radians(angle_deg)
                x = h + inner_distance * math.cos(angle_rad)
                y = k + inner_distance * math.sin(angle_rad)
                inner_vertices[f"P{i + 7}"] = [x, y]  # P7, P8, P9
            
            print(f"[DEBUG] Inner vertices: {inner_vertices}")
            
            # Step 2: Calculate the separation angle for the outer vertices
            # This creates the gaps between sections
            sep_angle = math.degrees(math.asin(separation / (2 * radius)))
            print(f"[DEBUG] Separation angle: {sep_angle:.2f} degrees")
            
            # Step 3: Define the three sections with their base angles
            # We use clockwise for sections and slots
            # Section 0: Top wedge (30° to 150°)
            # Section 1: Bottom-right wedge (270° to 390°)
            # Section 2: Bottom-left wedge (150° to 270°)
            sections = [
                (30, 150),    # Top - index 0
                (270, 390),   # Bottom-right - index 1 (SWAPPED)
                (150, 270),   # Bottom-left - index 2 (SWAPPED)
            ]
            
            # Step 4: Build segments immutably
            all_segments = []
            
            for i, (start_angle, end_angle) in enumerate(sections):
                # Adjust angles for separation
                adjusted_start = start_angle + sep_angle
                adjusted_end = end_angle - sep_angle
                
                # Handle wrap-around for section 2
                if adjusted_end > 360:
                    adjusted_end = adjusted_end - 360
                
                # Calculate outer vertices
                start_rad = math.radians(adjusted_start)
                end_rad = math.radians(adjusted_end)
                
                x_start = h + radius * math.cos(start_rad)
                y_start = k + radius * math.sin(start_rad)
                x_end = h + radius * math.cos(end_rad)
                y_end = k + radius * math.sin(end_rad)
                
                # Get the corresponding inner vertex for this section
                inner_vertex = inner_vertices[f"P{i + 7}"]
                
                # Create segments for this section
                section_segments = [
                    # Arc segment
                    {
                        "type": "arc",
                        "start": [x_start, y_start],
                        "end": [x_end, y_end],
                        "center": [h, k],
                        "radius": radius,
                        "is_counter_clockwise": True,
                        "section_index": i
                    },
                    # Line from arc end to inner vertex
                    {
                        "type": "line",
                        "start": [x_end, y_end],
                        "end": inner_vertex,
                        "section_index": i,
                        "edge_type": "end_to_inner"
                    },
                    # Line from inner vertex to arc start
                    {
                        "type": "line",
                        "start": inner_vertex,
                        "end": [x_start, y_start],
                        "section_index": i,
                        "edge_type": "inner_to_start"
                    }
                ]
                
                # Concatenate immutably
                all_segments = all_segments + section_segments
            
            print(f"[DEBUG] Generated {len(all_segments)} segments for n=3")
            return all_segments
            
        # Return empty list for other section counts
        return []
        
def calculate_backing_outline(
    shape: str,
    finish_x: float,
    finish_y: float,
    inset: float,
    thickness: float,
    panel_material_thickness: float
) -> Dict[str, Any]:
    """
    Calculate backing mesh outline parameters.
    
    Args:
        shape: Panel shape ('circular', 'rectangular', 'diamond')
        finish_x: Panel width
        finish_y: Panel height
        inset: Backing inset from panel edges
        thickness: Backing material thickness
        panel_material_thickness: Panel material thickness for Y positioning
        
    Returns:
        Dictionary with backing outline parameters
    """
    # Calculate dimensions with inset
    backing_width = finish_x - (2.0 * inset)
    backing_height = finish_y - (2.0 * inset)
    
    # Position below panel (panel bottom is at Y=0 in coordinate space)
    # Add small offset to prevent z-fighting
    position_y = -(panel_material_thickness / 2.0) - (thickness / 2.0) - 0.001
    
    return {
        "shape": shape,
        "width": backing_width,
        "height": backing_height,
        "thickness": thickness,
        "position_y": position_y,
        "inset": inset
    }    
```

## File: `C:\Users\paulj\WDweb\services\service_facade.py`

```python
# services/service_facade.py

from pathlib import Path
from typing import List, Dict, Any, Optional
import numpy as np

from services.config_loader import get_config_service
from services.geometry_service import GeometryService, calculate_section_dimensions
from services.slot_generation_service import SlotGenerationService
from services.composition_service import CompositionService
from services.processing_level_service import ProcessingLevelService
from services.dtos import CompositionStateDTO
from services.audio_processing_service import AudioProcessingService

PROJECT_ROOT = Path(__file__).resolve().parent.parent

class WaveformDesignerFacade:
    """
    Facade pattern implementation for the WaveDesigner application.
    
    This is the ONLY class that external clients (API, PyQt app) should interact with.
    It manages the instantiation of all services and delegates operations to them.
    
    Following the KISS principle: This facade keeps the interface simple while
    hiding the complexity of service orchestration.
    """
    
    def __init__(self):
        """
        Initialize the facade by creating all required services.
        
        Services are created with their dependencies injected,
        maintaining loose coupling and testability.
        """
        # Create configuration service (supports JSON or PostgreSQL based on env)
        self._config_service = get_config_service()
        
        # Create base services
        self._geometry_service = GeometryService()
        self._audio_processing_service = AudioProcessingService()
        
        # Create slot generation service (now stateless with no dependencies)
        self._slot_generation_service = SlotGenerationService()
        
        # Create orchestration service with dependencies
        self._composition_service = CompositionService(
            geometry_service=self._geometry_service,
            slot_generation_service=self._slot_generation_service,
            audio_processing_service=self._audio_processing_service
        )        
        
        # Add the new processing level service
        self._processing_level_service = ProcessingLevelService(
            audio_service=self._audio_processing_service,
            slot_service=self._slot_generation_service,
            config_service=self._config_service
        )        
    
    def generate_composition(self, state: CompositionStateDTO) -> CompositionStateDTO:
        """
        Generate a complete composition from the given state.
        
        This is the primary method for creating a design. It orchestrates
        all necessary services to produce frame geometry, slot patterns,
        and other design elements.
        
        Args:
            state: The composition state containing all design parameters
            
        Returns:
            Updated composition state with generated elements
        """
        return self._composition_service.generate_full_composition(state)
    
    def validate_composition(self, state: CompositionStateDTO) -> Dict[str, Any]:
        """
        Validate a composition state for correctness and feasibility.
        
        Validates business-configurable string fields against config,
        then delegates to composition service for structural validation.
        
        Args:
            state: The composition state to validate
            
        Returns:
            Validation results dictionary with 'valid', 'errors', and 'warnings'
        """
        errors: List[str] = []
        
        # Validate shape against config
        constraints_config = self._config_service.get_constraints_config()
        valid_shapes = constraints_config.get('valid_shapes', [])
        if state.frame_design.shape not in valid_shapes:
            errors = errors + [f"Invalid shape: '{state.frame_design.shape}'. Valid: {valid_shapes}"]
        
        # Validate grain directions against config
        wood_config = self._config_service.get_wood_materials_config()
        valid_grains = wood_config.get('valid_grain_directions', [])
        for section in state.frame_design.section_materials:
            if section.grain_direction not in valid_grains:
                errors = errors + [
                    f"Invalid grain_direction for section {section.section_id}: "
                    f"'{section.grain_direction}'. Valid: {valid_grains}"
                ]
        
        # Validate species against catalog
        valid_species = [s['id'] for s in wood_config.get('species_catalog', [])]
        if state.frame_design.species not in valid_species:
            errors = errors + [f"Invalid species: '{state.frame_design.species}'. Valid: {valid_species}"]
        for section in state.frame_design.section_materials:
            if section.species not in valid_species:
                errors = errors + [
                    f"Invalid species for section {section.section_id}: "
                    f"'{section.species}'. Valid: {valid_species}"
                ]
        
        # Validate backing type and material against config
        if state.frame_design.backing and state.frame_design.backing.enabled:
            backing_config = self._config_service.get_backing_materials_config()
            valid_backing_types = list(backing_config.get('material_catalog', {}).keys())
            backing_type = state.frame_design.backing.type
            if backing_type not in valid_backing_types:
                errors = errors + [
                    f"Invalid backing type: '{backing_type}'. Valid: {valid_backing_types}"
                ]
            else:
                # Validate material within type
                type_config = backing_config['material_catalog'][backing_type]
                valid_materials = [m['id'] for m in type_config.get('materials', [])]
                if state.frame_design.backing.material not in valid_materials:
                    errors = errors + [
                        f"Invalid backing material: '{state.frame_design.backing.material}'. "
                        f"Valid for {backing_type}: {valid_materials}"
                    ]
        
        # Validate color_palette against available palettes
        default_state = self._config_service.get_default_state()
        valid_palettes = list(default_state.artistic_rendering.color_palettes.keys())
        if state.artistic_rendering.color_palette not in valid_palettes:
            errors = errors + [
                f"Invalid color_palette: '{state.artistic_rendering.color_palette}'. "
                f"Valid: {valid_palettes}"
            ]
        
        # If config validation failed, return early
        if errors:
            return {
                'valid': False,
                'errors': errors,
                'warnings': []
            }
        
        # Delegate to composition service for structural validation
        return self._composition_service.validate_composition(state)
    
    def get_panel_parameters(self, state: CompositionStateDTO) -> Dict[str, Any]:
        """
        Get panel configuration parameters for CSG operations.
        
        Args:
            state: The composition state
            
        Returns:
            Dictionary with panel configuration:
                - outer_radius: Panel outer radius
                - thickness: Material thickness
                - separation: Gap between sections
                - number_sections: Number of sections (1-4)
        """
        return self._geometry_service.get_panel_parameters(state)
    
    def get_backing_parameters(self, state: CompositionStateDTO) -> Dict[str, Any]:
        """
        Get backing mesh parameters. Returns list of parameters (one per section) when enabled.
        
        Args:
            state: Composition state with backing configuration
            
        Returns:
            Dictionary with backing parameters or {"enabled": False}
        """
        backing = state.frame_design.backing
        if not backing or not backing.enabled:
            return {"enabled": False}
        
        # Get backing material config
        material_config = self._config_service.get_backing_materials_config()
        type_config = material_config["material_catalog"][backing.type]
        
        # Get section dimensions from geometry service
        section_dims = calculate_section_dimensions(
            shape=state.frame_design.shape,
            finish_x=state.frame_design.finish_x,
            finish_y=state.frame_design.finish_y,
            number_sections=state.frame_design.number_sections,
            separation=state.frame_design.separation,
            slot_style=state.pattern_settings.slot_style
        )
        
        # Get material properties
        material_info = next(
            (m for m in type_config["materials"] if m["id"] == backing.material),
            type_config["materials"][0]
        )
        
        # Calculate Y position below panel
        panel_thickness = state.frame_design.material_thickness
        backing_thickness = type_config["thickness_inches"]
        position_y = -(panel_thickness / 2.0) - (backing_thickness / 2.0) - 0.001
        
        # Build backing parameters for each section
        inset = type_config["inset_inches"]
        backing_sections = []
        for section in section_dims:
            backing_sections.append({
                "shape": state.frame_design.shape,
                "width": section['width'] - (2.0 * inset),
                "height": section['height'] - (2.0 * inset),
                "thickness": backing_thickness,
                "position_x": section['offset_x'],
                "position_y": position_y,
                "position_z": section['offset_y'],
                "inset": inset
            })
        
        # For acrylic/cloth, each section needs 0.5" reveal on all sides
        # For foam, CSG uses full dimensions (flush)
        csg_finish_x = state.frame_design.finish_x
        csg_finish_y = state.frame_design.finish_y
        csg_separation = state.frame_design.separation
        
        if backing.type in ['acrylic', 'cloth']:
            # Reduce outer dimensions by 2x inset (0.5" reveal at edges)
            csg_finish_x -= (2.0 * inset)
            csg_finish_y -= (2.0 * inset)
            # Increase separation by 2x inset (0.5" reveal per section side)
            csg_separation += (2.0 * inset)
        
        # For circular n=3, get section edges using same geometry as wood panels
        section_edges = None
        if state.frame_design.shape == 'circular' and state.frame_design.number_sections == 3:
            # Use wood panel geometry calculation with backing dimensions
            modified_state = state.model_copy(update={
                "frame_design": state.frame_design.model_copy(update={
                    "finish_x": csg_finish_x,
                    "finish_y": csg_finish_y,
                    "separation": csg_separation
                })
            })
            frame_segments = self._geometry_service.create_frame_geometry(modified_state)
            
            # Extract section edges (same logic as get_csg_data)
            section_edges = []
            for section_idx in range(3):
                section_segments = [seg for seg in frame_segments if seg.get('section_index') == section_idx]
                lines = [seg for seg in section_segments if seg['type'] == 'line']
                
                if len(lines) == 2:
                    edge1 = next((l for l in lines if l.get('edge_type') == 'inner_to_start'), None)
                    edge2 = next((l for l in lines if l.get('edge_type') == 'end_to_inner'), None)
                    
                    if edge1 and edge2:
                        section_edges.append({
                            "section_index": section_idx,
                            "edge1_start": edge1["start"],
                            "edge1_end": edge1["end"],
                            "edge2_start": edge2["start"],
                            "edge2_end": edge2["end"]
                        })
        
        result = {
            "enabled": True,
            "type": backing.type,
            "material": backing.material,
            "sections": backing_sections,
            "material_properties": material_info,
            "csg_config": {
                "finish_x": csg_finish_x,
                "finish_y": csg_finish_y,
                "separation": csg_separation
            }
        }
        
        if section_edges:
            result["section_edges"] = section_edges
        
        return result
    
    def get_slot_data(self, state: CompositionStateDTO) -> List[Dict[str, Any]]:
        """
        Get slot data for CSG operations.
        
        Args:
            state: The composition state with processed amplitudes
            
        Returns:
            List of slot data dictionaries with position and dimensions
            
        Raises:
            ValueError: If state lacks required amplitude data
        """
        if not state.processed_amplitudes:
            raise ValueError("Cannot generate slot data without processed amplitudes")
        
        # Two-step flow: Calculate geometry first, then generate slots
        geometry = self._geometry_service.calculate_geometries_dto(state)
        return self._slot_generation_service.get_slot_data(state, geometry)
    
    def get_csg_data(self, state: CompositionStateDTO) -> Dict[str, Any]:
        """
        Get both panel parameters and slot data for CSG operations.
        
        Convenience method that combines panel and slot data.
        
        Args:
            state: The composition state with all required data
            
        Returns:
            Dictionary containing:
                - panel_config: Panel parameters
                - slot_data: List of slot data (if amplitudes present)
        """
        # Apply automatic roll for circular n=3 designs
        if (state.frame_design.shape == "circular" and 
            state.frame_design.number_sections == 3 and 
            state.processed_amplitudes):
            
            # Calculate the automatic roll amount
            auto_roll = AudioProcessingService.calculate_auto_roll_for_sections(
                state.frame_design.number_sections,
                state.pattern_settings.number_slots
            )
            
            # Apply roll if needed
            if auto_roll != 0 and auto_roll != state.peak_control.roll_amount:
                # Apply numpy.roll to the amplitudes
                rolled_amplitudes = np.roll(
                    np.array(state.processed_amplitudes), 
                    auto_roll
                ).tolist()
                
                # Create new state with rolled amplitudes
                state = state.model_copy(update={
                    "processed_amplitudes": rolled_amplitudes,
                    "peak_control": state.peak_control.model_copy(update={
                        "roll_amount": auto_roll
                    })
                })
        
        # Calculate geometry once for both panel and slots
        geometry = self._geometry_service.calculate_geometries_dto(state)
        
        result = {
            **geometry.model_dump(),  # Unpack all geometry data
            "panel_config": self.get_panel_parameters(state),
            "slot_data": [],
            "section_edges": []  # NEW: Include edge data for n=3
        }
        
        # Include slot data if amplitudes are available
        if state.processed_amplitudes:
            try:
                # Pass pre-calculated geometry to slot generation
                result["slot_data"] = self._slot_generation_service.get_slot_data(state, geometry)
                if state.pattern_settings.slot_style == "linear" and result["slot_data"]:
                    print(f"[DEBUG] First linear slot vertices: {result['slot_data'][0]['vertices']}")
                    print(f"[DEBUG] First linear slot dims: width={result['slot_data'][0]['width']:.4f}, length={result['slot_data'][0]['length']:.4f}")
            except ValueError:
                # Keep empty slot_data if generation fails
                pass
        
        # Extract section edge lines for n=3
        if state.frame_design.number_sections == 3:
            # Get frame geometry segments
            frame_segments = self._geometry_service.create_frame_geometry(state)
            
            # Group segments by section
            for section_idx in range(3):
                section_segments = [seg for seg in frame_segments if seg.get('section_index') == section_idx]
                
                # Find the two line segments for this section
                lines = [seg for seg in section_segments if seg['type'] == 'line']
                
                if len(lines) == 2:
                    # Identify which line is which based on edge_type
                    edge1 = next((l for l in lines if l.get('edge_type') == 'inner_to_start'), None)
                    edge2 = next((l for l in lines if l.get('edge_type') == 'end_to_inner'), None)
                    
                    if edge1 and edge2:
                        result["section_edges"].append({
                            "section_index": section_idx,
                            "edge1_start": edge1["start"],  # Inner vertex
                            "edge1_end": edge1["end"],      # Arc start point
                            "edge2_start": edge2["start"],  # Arc end point
                            "edge2_end": edge2["end"]       # Inner vertex (same as edge1_start)
                        })
                        print(f"[DEBUG] Section {section_idx} edges extracted")
            
            print(f"[DEBUG] Total section edges: {len(result['section_edges'])}")
        
        return result  
    
    def process_and_get_csg_data(
        self,
        state: CompositionStateDTO,
        changed_params: List[str],
        previous_max_amplitude: Optional[float]
    ) -> Dict[str, Any]:
        """
        Process state changes based on processing level and return CSG data.
        
        This is the smart method that orchestrates the optimization.
        
        Args:
            state: The current composition state.
            changed_params: A list of parameters that have changed.
            previous_max_amplitude: The max_amplitude_local from the previous state.
            
        Returns:
            A dictionary containing the 'updated_state' and 'csg_data'.
        """
        # Validate dimensions before processing
        from services.dimension_validator import validate_frame_design_dimensions
        
        constraints = self._config_service.get_dimension_constraints()
        shape_constraints = constraints.get(state.frame_design.shape, {})
        
        validation_result = validate_frame_design_dimensions(
            shape=state.frame_design.shape,
            finish_x=state.frame_design.finish_x,
            finish_y=state.frame_design.finish_y,
            min_dimension=shape_constraints.get('min_dimension', 8.0),
            max_dimension=shape_constraints.get('max_dimension', 84.0),
            aspect_ratio_locked=False,
            locked_aspect_ratio=None,
            tolerance=0.01
        )
        
        if not validation_result.valid:
            raise ValueError(f"Invalid dimensions: {validation_result.error}")
        
        # Step 1: Determine what processing is needed and get the updated state.
        updated_state = self._processing_level_service.process_by_level(
            state,
            changed_params,
            previous_max_amplitude
        )
        
        # Step 2: Calculate geometry to get section_local_centers and true_min_radius
        geometry = self._geometry_service.calculate_geometries_dto(updated_state)
        
        # Step 3: Generate CSG data FROM THE NEWLY PROCESSED STATE.
        csg_data = self.get_csg_data(updated_state)
        
        # Step 4: Add geometry data for overlay positioning
        csg_data["section_local_centers"] = geometry.section_local_centers
        csg_data["true_min_radius"] = geometry.true_min_radius

        # Step 5: Include backing parameters if backing is enabled
        backing_params = self.get_backing_parameters(updated_state)
        
        # Step 6: Return both so the frontend can sync its state.
        return {
            "csg_data": csg_data,
            "updated_state": updated_state,
            "max_amplitude_local": geometry.max_amplitude_local,
            "backing_parameters": backing_params
        }
    
    def get_composition_summary(self, state: CompositionStateDTO) -> Dict[str, Any]:
        """
        Get a human-readable summary of the composition.
        
        Args:
            state: The composition state to summarize
            
        Returns:
            Dictionary with summary information
        """
        return self._composition_service.get_composition_summary(state)
    
    def create_default_state(self) -> CompositionStateDTO:
        """
        Create a default composition state by loading it from the ConfigService.
        
        This is a convenience method for creating new projects. It delegates
        to the ConfigService which is the single source of truth for default
        parameters.
        
        Returns:
            New composition state with default values from config
            
        Example:
            facade = WaveformDesignerFacade()
            state = facade.create_default_state()
        """
        return self._config_service.get_default_state()
    
    def process_audio(self, audio_path: str, state: CompositionStateDTO) -> Dict[str, Any]:
        """
        Process an audio file and return the updated state and key geometry metrics.
        
        This is the main entry point for audio processing. It delegates to the
        AudioProcessingService to extract and process amplitudes, calculates the
        corresponding max_amplitude_local, and returns a package with both.
        
        Args:
            audio_path: Path to the audio file to process
            state: Current composition state
            
        Returns:
            A dictionary containing:
                - 'updated_state': New CompositionStateDTO with processed_amplitudes.
                - 'max_amplitude_local': The calculated max amplitude for this state.
            
        Raises:
            ValueError: If audio processing fails
        """
        # Step 1: Process audio to get NORMALIZED amplitudes (0-1) and raw samples
        audio_result = self._audio_processing_service.process_audio_file(audio_path, state)
        
        # Step 2: Calculate geometry for the current state to get the scaling factor
        geometry = self._geometry_service.calculate_geometries_dto(state)
        max_amplitude_local = geometry.max_amplitude_local

        # Step 3: Apply the final scaling to the normalized amplitudes
        # For now, use max_amplitudes as the primary amplitude array
        # TODO: Update to handle both min and max arrays properly
        normalized_amplitudes = audio_result.get("max_amplitudes", audio_result.get("scaled_amplitudes", []))
        scaled_amplitudes = AudioProcessingService.scale_and_clamp_amplitudes(
            normalized_amplitudes,
            max_amplitude_local,
            state.pattern_settings.bit_diameter
        )
        
        # Step 4: Create the final updated state DTO
        updated_state = state.model_copy(update={"processed_amplitudes": scaled_amplitudes})
        
        return {
            "updated_state": updated_state,
            "max_amplitude_local": max_amplitude_local,
            "raw_samples_for_cache": audio_result["raw_samples_for_cache"]
        }
    
    def get_service_info(self) -> Dict[str, str]:
        """
        Get information about available services for debugging/monitoring.
        
        Returns:
            Dictionary with service names and their status
        """
        return {
            'config_service': 'active',
            'geometry_service': 'active - CSG mode only',
            'slot_generation_service': 'active - CSG data mode',
            'composition_service': 'active',
            'audio_service': 'active',
            'export_service': 'not_implemented',
            'render_service': 'not_implemented'
        }
```

## File: `C:\Users\paulj\WDweb\src/ApplicationController.ts`

```typescript
/**
 * ApplicationController - Central state management and orchestration
 * 
 * Single source of truth for application state.
 * Coordinates between UI components and the facade.
 * Manages timers, autoplay, and phase transitions.
 */

import { AudioCacheService } from './AudioCacheService';
import { AspectRatioLock } from './components/AspectRatioLock';
import { FilterIconStrip } from './components/FilterIconStrip';
import { PanelStackManager } from './components/PanelStackManager';
import { RightPanelContentRenderer } from './components/RightPanelContent';
import { SectionSelectorPanel } from './components/SectionSelectorPanel';
import { SliderGroup } from './components/SliderGroup';
import { SubcategoryAccordion, type AccordionItemConfig } from './components/SubcategoryAccordion';
import { ThumbnailGrid } from './components/ThumbnailGrid';
import { AccordionStyleCard } from './components/AccordionStyleCard';
import { AccordionSpeciesCard } from './components/AccordionSpeciesCard';
import { AccordionCollectionCard, type CollectionCardConfig } from './components/AccordionCollectionCard';
import { CollectionVariantSelector } from './components/CollectionVariantSelector';
import { HorizontalScrollContainer } from './components/HorizontalScrollContainer';
import { WoodMaterialSelector } from './components/WoodMaterialSelector';
import { PerformanceMonitor } from './PerformanceMonitor';
import { ConstraintResolver } from './services/ConstraintResolver';
import type { CategoriesConfig, FilterIconGroup, PanelComponent, ThumbnailConfig } from './types/PanelTypes';
import {
  ApplicationState,
  BackgroundsConfigSchema,
  CompositionStateDTO,
	ConstraintsConfigSchema, 
  PlacementDefaultsSchema,
  WoodMaterialsConfigSchema,
  type ArtPlacement,
  type AudioProcessResponse,
  type BackgroundsConfig,
	type ConstraintsConfig,
  type CSGDataResponse,
  type PlacementDefaults,
  type SectionMaterial,
  type WoodMaterialsConfig,
} from './types/schemas';
import { applyDimensionChange, type DimensionConstraints } from './utils/dimensionUtils';
import { deepMerge } from './utils/mergeUtils';
import { fetchAndValidate } from './utils/validation';
import { Action, WaveformDesignerFacade } from './WaveformDesignerFacade';
import { type CategoriesConfig, type FilterIconGroup, type ThumbnailConfig } from './types/PanelTypes';


// Internal facade APIs that aren't exposed in the public interface
interface TextureCache {
  preloadAllTextures: (config: WoodMaterialsConfig) => Promise<IdleTextureLoader>;
}

interface IdleTextureLoader {
  pause: () => void;
  onProgress: (callback: (loaded: number, total: number) => void) => void;
}

interface SceneManagerInternal {
  _textureCache?: TextureCache;
}

interface Archetype {
  id: string;
  shape: string;
  slot_style: string;
  label: string;
  tooltip: string;
  thumbnail: string;
  number_sections: number;
  number_slots: number;
  separation: number;
  side_margin?: number;
}

interface UIConfig {
  thumbnail_config: ThumbnailConfig;
  categories: CategoriesConfig;
}

interface ElementConfig {
  label: string;
  state_path: string;
  min?: number;
  max?: number;
  step?: number;
  show_when?: {
    shape?: string[];
    slot_style?: string[];
  };
  dynamic_max_by_sections?: Record<string, number>;
}

interface UIEngine {
  getElementConfig: (key: string) => ElementConfig | undefined;
  getStateValue: (composition: CompositionStateDTO, path: string) => unknown;
  config?: { dimension_constraints?: Record<string, { allow_aspect_lock?: boolean; min_dimension?: number; max_dimension?: number }> };
}

declare global {
  interface Window {
    uiEngine?: UIEngine;
  }
}

// Subscriber callback type
type StateSubscriber = (state: ApplicationState) => void;

/**
 * Initialize section_materials array when number_sections changes.
 * Implements smart inheritance: unanimous species/grain → inherit, mixed → defaults.
 */
function initializeSectionMaterials(
  oldN: number,
  newN: number,
  uiCapturedMaterials: SectionMaterial[],
  config: WoodMaterialsConfig,
  availableGrains: string[]
): SectionMaterial[] {
  // If N is unchanged, do nothing
  if (newN === oldN) {
    return uiCapturedMaterials;
  }

  // Step 1: Determine intended species and grain from UI-captured state
  const allSameSpecies = uiCapturedMaterials.length > 0 && 
    uiCapturedMaterials.every(m => m.species === uiCapturedMaterials[0].species);
  const allSameGrain = uiCapturedMaterials.length > 0 && 
    uiCapturedMaterials.every(m => m.grain_direction === uiCapturedMaterials[0].grain_direction);

  const intendedSpecies = allSameSpecies ? uiCapturedMaterials[0].species : config.default_species;
  let intendedGrain = allSameGrain ? uiCapturedMaterials[0].grain_direction : config.default_grain_direction;

	// Step 2: Validate intended grain against NEW number of sections
  if (!availableGrains.includes(intendedGrain)) {
    intendedGrain = config.default_grain_direction;
  }

  // Step 3: Build new materials array from scratch to correct size (newN)
  const newMaterials: SectionMaterial[] = [];
  for (let i = 0; i < newN; i++) {
    const species = uiCapturedMaterials[i]?.species || intendedSpecies;
    newMaterials.push({
      section_id: i,
      species: species,
      grain_direction: intendedGrain
    });
  }

  return newMaterials;
}

export class ApplicationController {
  private _state: ApplicationState | null = null;
  private _facade: WaveformDesignerFacade;
  private _subscribers: Set<StateSubscriber> = new Set();
  private _autoplayTimer?: number;
  private _hintTimer?: number;
  private _panelStack: PanelStackManager | null = null;
  private _sceneManager: { 
    renderComposition: (csgData: CSGDataResponse) => Promise<void>;
    applySectionMaterials: () => void;
    applySingleSectionMaterial?: (sectionId: number) => void;
  } | null = null;
	private _audioCache: AudioCacheService;
  private _woodMaterialsConfig: WoodMaterialsConfig | null = null;
  private _selectedSectionIndices: Set<number> = new Set();
	private _backgroundsConfig: BackgroundsConfig | null = null;
  private _collectionsCatalog: import('./types/schemas').CollectionsCatalog | null = null;
  private _collectionVariantSelector: CollectionVariantSelector | null = null;
	private _currentRoomId: string | null = null;
	private _currentWallFinishId: string | null = null;
  private _idleTextureLoader: unknown = null; // IdleTextureLoader instance
	private _placementDefaults: PlacementDefaults | null = null;
	private _constraints: ConstraintsConfig | null = null;
	private _resolver: ConstraintResolver | null = null;
	private _compositionCache: Map<string, CompositionStateDTO> = new Map();
  private _marginPresetCache: Map<string, import('../types/schemas').MarginPreset[]> = new Map();
  private _isUpdatingComposition: boolean = false;
	public getResolver(): ConstraintResolver | null {
    return this._resolver;
  }
  
  private _isRectangularLinearN3Plus(archetypeId: string): boolean {
    return archetypeId === 'rectangular_linear_n3' || archetypeId === 'rectangular_linear_n4';
  }
	public getConstraintsConfig(): ConstraintsConfig | null {
    return this._constraints;
  }
	
	private async _fetchMarginPresets(composition: CompositionStateDTO): Promise<import('../types/schemas').MarginPreset[]> {
    const frame = composition.frame_design;
    const pattern = composition.pattern_settings;
    
    if (frame.shape !== 'rectangular' || pattern.slot_style !== 'linear' || frame.number_sections < 3) {
      return [];
    }
    
    const cacheKey = `${frame.finish_x}-${frame.separation}-${frame.number_sections}-${pattern.number_slots}`;
    
    const cached = this._marginPresetCache.get(cacheKey);
    if (cached) return cached;
    
    try {
      const response = await fetch('/api/geometry/margin-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finish_x: frame.finish_x,
          separation: frame.separation,
          number_sections: frame.number_sections,
          number_slots: pattern.number_slots,
          x_offset: pattern.x_offset,
          spacer: pattern.spacer,
          bit_diameter: pattern.bit_diameter,
          shape: frame.shape,
          slot_style: pattern.slot_style
        })
      });
      
      const data = await response.json() as import('../types/schemas').MarginPresetsResponse;
      
      if (data.applicable && data.presets.length > 0) {
        this._marginPresetCache.set(cacheKey, data.presets);
        return data.presets;
      }
    } catch (e) {
      console.error('[Controller] Failed to fetch margin presets:', e);
    }
    
    return [];
  }
	
	public getMarginPresets(composition: CompositionStateDTO): import('../types/schemas').MarginPreset[] {
    const frame = composition.frame_design;
    const pattern = composition.pattern_settings;
    const cacheKey = `${frame.finish_x}-${frame.separation}-${frame.number_sections}-${pattern.number_slots}`;
    return this._marginPresetCache.get(cacheKey) || [];
  }
  
  public getCategories(): import('./types/PanelTypes').CategoryConfig[] {
    if (!this._categoriesConfig) return [];
    return Object.entries(this._categoriesConfig)
      .map(([id, config]) => ({
        id,
        label: config.label,
        icon: '',
        enabled: Object.keys(config.subcategories).length > 0,
        order: config.order ?? 99
      }))
      .sort((a, b) => a.order - b.order);
  }
	
	// Four-panel navigation configuration
  private _thumbnailConfig: ThumbnailConfig | null = null;
  private _categoriesConfig: CategoriesConfig | null = null;
	private _archetypes: Map<string, Archetype> = new Map();
  
  // Four-panel DOM references
	private _leftMainPanel: HTMLElement | null = null;
  private _leftSecondaryPanel: HTMLElement | null = null;
  private _rightSecondaryPanel: HTMLElement | null = null;
  private _rightMainPanel: HTMLElement | null = null;
  private _filterIconStrip: FilterIconStrip | null = null;
  private _sectionSelectorPanel: SectionSelectorPanel | null = null;
  private _helpTooltip: Tooltip | null = null;
  private _activeRightPanelComponent: PanelComponent | null = null;
  private _renderId: number = 0;
  private _accordion: SubcategoryAccordion | null = null;
  private _accordionState: Record<string, Record<string, boolean>> = {};
	private _audioSlicerPanel: import('./components/AudioSlicerPanel').AudioSlicerPanel | null = null;
  
  constructor(facade: WaveformDesignerFacade) {
    this._facade = facade;
		this._audioCache = new AudioCacheService();
		this._panelStack = new PanelStackManager('right-panel-stack');
  }
	
	public get audioCache(): AudioCacheService {
    return this._audioCache;
  }
	
	/**
   * Update section selection state (called from SceneManager or UI)
   * Syncs state and updates section selector panel if visible
   */
  public selectSection(indices: Set<number>): void {
    // Update section selector panel if it exists
    if (this._sectionSelectorPanel) {
      this._sectionSelectorPanel.updateSelection(indices);
    }
  }
	
	public updateAudioSourceState(updates: Partial<{
    source_file: string | null;
    start_time: number;
    end_time: number;
    use_stems: boolean;
  }>): void {
    if (!this._state) return;
    this._state.composition.audio_source = {
      ...this._state.composition.audio_source,
      ...updates
    };
    this._facade.persistState(this._state);
  }

  public updateAudioProcessingState(updates: Partial<{
    remove_silence: boolean;
  }>): void {
    if (!this._state) return;
    this._state.composition.audio_processing = {
      ...this._state.composition.audio_processing,
      ...updates
    };
    this._facade.persistState(this._state);
  }

  /**
   * Create optimized composition state from /api/audio/optimize result
   * Does NOT mutate state directly - returns DTO for processing pipeline
   */
  public createOptimizedComposition(result: {
    exponent: number;
    filter_amount: number;
    silence_threshold: number;
    binning_mode: string;
    remove_silence: boolean;
    silence_duration: number;
  }): CompositionStateDTO | null {
    if (!this._state) return null;
    
    const newAudioProcessing = {
      ...this._state.composition.audio_processing,
      filter_amount: result.filter_amount,
      silence_threshold: result.silence_threshold,
      binning_mode: result.binning_mode,
      remove_silence: result.remove_silence,
      silence_duration: result.silence_duration,
      apply_filter: true
    };
    
    const newPatternSettings = {
      ...this._state.composition.pattern_settings,
      amplitude_exponent: result.exponent
    };
    
    return {
      ...this._state.composition,
      audio_processing: newAudioProcessing,
      pattern_settings: newPatternSettings
    };
  }
	
	/**
   * Restore UI from persisted state after DOM is ready
   * Called from main.ts after LeftPanelRenderer has rendered
   */
  restoreUIFromState(): void {
    if (!this._state) return;
    
    // Restore accordion state from persisted state
    if (this._state.ui.accordionState) {
      this._accordionState = { ...this._state.ui.accordionState };
    }
    
    const { activeCategory, activeSubcategory } = this._state.ui;
    
    if (!activeCategory) return;
    
    // 1. Highlight category button
    const categoryButtons = document.querySelectorAll('.category-button');
    categoryButtons.forEach(btn => {
      const btnId = btn.getAttribute('data-category');
      if (btnId === activeCategory) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    // 2. Render accordion for the category (replaces Left Secondary Panel)
    this._renderAccordionForCategory(activeCategory);
    
    // 3. Subcategory content now handled by accordion's getContent callback
  }
  
  /**
   * Initialize the controller with default or restored state
   */
  async initialize(): Promise<void> {
    try {
      // Initialize facade (loads style presets)
      this._facade.initialize();
			
			// Initialize help tooltip
      void import('./components/Tooltip').then(({ Tooltip }) => {
        this._helpTooltip = new Tooltip();
      });
			
			// Initialize panel references (DOM is ready at this point)
      this._leftMainPanel = document.getElementById('left-main-panel');
      this._leftSecondaryPanel = document.getElementById('left-secondary-panel');
      this._rightSecondaryPanel = document.getElementById('right-secondary-panel');
      this._rightMainPanel = document.getElementById('right-main-panel');
      
      if (!this._leftSecondaryPanel || !this._rightSecondaryPanel || !this._rightMainPanel) {
        console.warn('[Controller] Four-panel DOM elements not found');
      }

      window.addEventListener('resize', () => {
        this._updateLeftSecondaryPosition();
      });
      
      // Load wood materials configuration
      this._woodMaterialsConfig = await fetchAndValidate<WoodMaterialsConfig>(
        'http://localhost:8000/api/config/wood-materials',
        WoodMaterialsConfigSchema
      );
			
			// Load placement defaults configuration
      try {
        this._placementDefaults = await fetchAndValidate<PlacementDefaults>(
          'http://localhost:8000/api/config/placement-defaults',
          PlacementDefaultsSchema
        );
      } catch (error) {
        console.error('Failed to load placement defaults:', error);
        // Non-fatal: application can continue with base archetype defaults
      }
			
			// Load thumbnail and categories configuration
      // Load all configs in parallel
			const [archetypes, woodMaterials, backgrounds, placementDefaults, uiConfig, _compositionDefaults, constraints] = await Promise.all([
				fetch('http://localhost:8000/api/config/archetypes').then(r => r.json() as Promise<Record<string, Archetype>>),
				fetch('http://localhost:8000/api/config/wood-materials').then(r => r.json() as Promise<WoodMaterialsConfig>),
				fetchAndValidate<BackgroundsConfig>('http://localhost:8000/api/config/backgrounds', BackgroundsConfigSchema),
				fetch('http://localhost:8000/api/config/placement-defaults').then(r => r.json() as Promise<PlacementDefaults>),
				fetch('http://localhost:8000/api/config/ui').then(r => r.json() as Promise<UIConfig>),
				fetch('http://localhost:8000/api/config/composition-defaults').then(r => r.json() as Promise<unknown>),
				fetchAndValidate('http://localhost:8000/api/config/constraints', ConstraintsConfigSchema)
			]);

			// Store archetypes
			Object.entries(archetypes).forEach(([id, data]) => {
				this._archetypes.set(id, data);
			});

			// Store configs
			this._woodMaterialsConfig = woodMaterials;
			this._backgroundsConfig = backgrounds;
			this._currentRoomId = (backgrounds as { default_room?: string }).default_room || 'blank_wall';
			this._currentWallFinishId = (backgrounds as { default_wall_finish?: string }).default_wall_finish || 'warm-beige';
			this._placementDefaults = placementDefaults;
			this._constraints = constraints;
			this._resolver = new ConstraintResolver(constraints, placementDefaults);
			this._thumbnailConfig = uiConfig.thumbnail_config;
			this._categoriesConfig = uiConfig.categories;
			
    } catch (error: unknown) {
      console.error('[Controller] Failed to load configuration:', error);
    }
    
    // Load fresh defaults first
    const freshDefaults = await this._facade.createInitialState();
    
    // Try to restore saved state
    const restored = this._facade.loadPersistedState();
    
    if (restored && restored.audio.rawSamples && restored.audio.rawSamples.length > 0) {
      // Deep merge: preserved user settings + new schema fields from defaults
      this._state = this._facade.mergeStates(freshDefaults, restored);
      
      // CRITICAL: Scale normalized amplitudes to physical space
      // Persisted state may contain 0-1 normalized values that need scaling
      const amps = this._state.composition.processed_amplitudes;
      if (amps && amps.length > 0) {
        const maxAmp = Math.max(...amps.map(Math.abs));
        if (maxAmp > 0 && maxAmp <= 1.5) {
          // Call backend to get max_amplitude_local for current geometry
          const response = await fetch('http://localhost:8000/geometry/csg-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              state: this._state.composition,
              changed_params: [],
              previous_max_amplitude: null
            })
          });
          
          if (response.ok) {
            const csgData = await response.json() as { max_amplitude_local: number };
            const maxAmplitudeLocal = csgData.max_amplitude_local;
            
            // Scale amplitudes to physical dimensions
            const scaledAmps = amps.map(a => a * maxAmplitudeLocal);
            this._state = {
              ...this._state,
              composition: {
                ...this._state.composition,
                processed_amplitudes: scaledAmps
              },
              audio: {
                ...this._state.audio,
                previousMaxAmplitude: maxAmplitudeLocal
              }
            };
          }
        }
      }
      
      // Re-cache the raw samples on load
      if (this._state.audio.audioSessionId) {
        this._audioCache.rehydrateCache(
          this._state.audio.audioSessionId,
          new Float32Array(this._state.audio.rawSamples)
        );
      }
      await this.dispatch({ type: 'STATE_RESTORED', payload: this._state });
			
			// Restore composition cache from persisted state
      if (this._state.compositionCache) {
        Object.entries(this._state.compositionCache).forEach(([key, comp]) => {
          this._compositionCache.set(key, comp);
        });
      }
    } else {
      if (restored) {
        console.warn('[DEBUG] Restored state is invalid (missing rawSamples). Discarding and creating fresh state.');
      }
      this._state = freshDefaults;
    }
    
    this.notifySubscribers();
    
    // Update panels based on new state
    this.handlePanelUpdates(this._state);

    // specific default selection logic
    if (!this._state.ui.activeCategory) {
      const categoryIds = Object.keys(this._categoriesConfig || {});
      if (categoryIds.length > 0) this.handleCategorySelected(categoryIds[0]);
    }
  }
  
  /**
   * Get current application state
   */
  getState(): ApplicationState {
    if (!this._state) {
      throw new Error('Controller not initialized. Call initialize() first.');
    }
    return this._state;
  }
	
	/**
   * Forcibly resets the application to a fresh, default state.
   * Used by the demo player to ensure a clean start.
   */
  public async resetToDefaultState(): Promise<void> {
    this._state = await this._facade.createInitialState();
    this.notifySubscribers();
    // Clear scene without rendering (tour needs blank canvas)
    if (this._sceneManager && 'clearScene' in this._sceneManager) {
      (this._sceneManager as unknown as { clearScene: () => void }).clearScene();
    }
  }
  
  /**
   * Dispatch an action to update state
   */
  async dispatch(action: Action): Promise<void> {
    if (!this._state) {
      throw new Error('Controller not initialized');
    }
    
    // Special handling for file upload
    if (action.type === 'FILE_UPLOADED') {
      await this.handleFileUpload(action.payload.file, action.payload.uiSnapshot);
      return;
    }
		
		// Special handling for audio commit (slice/vocals)
    if (action.type === 'AUDIO_COMMIT') {
      await this._handleAudioCommit(action.payload);
      return;
    }
    
    // Process state transition through facade
    const newState = this._facade.processStateTransition(this._state, action);
    
    // Update state if changed
    if (newState !== this._state) {
      this._state = newState;
      this._facade.persistState(newState);
      this.notifySubscribers();
      
      // Handle side effects
      this.handleSideEffects(action);
    }
  }	

  /**
   * Register the SceneManager with the controller.
   * This allows the controller to directly trigger rendering operations.
   */
  registerSceneManager(sceneManager: { 
    renderComposition: (csgData: CSGDataResponse) => Promise<void>;
    applySectionMaterials: () => void;
    applySingleSectionMaterial?: (sectionId: number) => void;
    applyArtPlacement?: (placement: ArtPlacement) => void;
    resetArtPlacement?: () => void;
    applyLighting?: (lighting: LightingConfig) => void;
    resetLighting?: () => void;
  }): void {
    this._sceneManager = sceneManager;
    
    // Start texture loading immediately in background
    if (this._woodMaterialsConfig) {
      const textureCache = (this._sceneManager as unknown as SceneManagerInternal)._textureCache;
      if (textureCache && typeof textureCache.preloadAllTextures === 'function') {
        const selectedSpecies = this._state?.composition?.frame_design?.section_materials?.[0]?.species 
          || this._woodMaterialsConfig.default_species;
        void textureCache.preloadAllTextures(this._woodMaterialsConfig, selectedSpecies).then((idleLoader) => {
          this._idleTextureLoader = idleLoader;
          
          const indicator = document.getElementById('textureLoadingIndicator');
          const loadedEl = document.getElementById('texturesLoaded');
          const totalEl = document.getElementById('texturesTotal');
          
          if (indicator && loadedEl && totalEl) {
            idleLoader.onProgress((loaded, total) => {
              loadedEl.textContent = String(loaded);
              totalEl.textContent = String(total);
              
              if (loaded < total) {
                indicator.classList.add('active');
              } else {
                setTimeout(() => {
                  indicator.classList.remove('active');
                }, 2000);
              }
            });
          }
        }).catch((error: unknown) => {
          console.error('[Controller] Background texture loading failed:', error);
        });
      }
    }
    
    // Apply current background from state
    if (this._state && this._backgroundsConfig && 'changeBackground' in sceneManager) {
      const bgState = this._state.ui.currentBackground;
      const category = this._backgroundsConfig.categories[bgState.type];
      const background = category.find(bg => bg.id === bgState.id);
      
      if (background) {
        (sceneManager as unknown as { changeBackground: (type: string, id: string, rgb?: number[], path?: string, foregroundPath?: string, wallCompensation?: number) => void })
          .changeBackground(bgState.type, bgState.id, background.rgb, background.path, (background as { foreground_path?: string }).foreground_path, (background as { wall_compensation?: number }).wall_compensation);
        
        // Apply lighting config on initial load
        if (background.lighting && 'applyLighting' in sceneManager) {
          (sceneManager as unknown as { applyLighting: (lighting: unknown) => void }).applyLighting(background.lighting);
        } else if ('resetLighting' in sceneManager) {
          (sceneManager as unknown as { resetLighting: () => void }).resetLighting();
        }
        
        // Set initial body class for blank wall controls visibility
        document.body.classList.toggle('room-blank-wall', bgState.id === 'blank_wall');
      }
    }
  }	
  
  /**
   * Subscribe to state changes
   */
  subscribe(callback: StateSubscriber): () => void {
    this._subscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this._subscribers.delete(callback);
    };
  }
	
	/**
   * Get art placement for current background state
   * Used by SceneManager during initial render
   */
  public getCurrentArtPlacement(): ArtPlacement | null {
    if (!this._state || !this._backgroundsConfig) return null;
    
    const archetypeId = this.getActiveArchetypeId();
    if (!archetypeId) return null;
    
    const backgroundKey = this._getBackgroundKeyForCache(this._state.ui.currentBackground);
    let artPlacement: ArtPlacement | undefined;
    
    // 1. Check placement_defaults for archetype-specific override
    if (this._placementDefaults) {
      const placementData = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.[backgroundKey];
      artPlacement = placementData?.art_placement;
      
      if (!artPlacement && backgroundKey !== 'paint_and_accent') {
        artPlacement = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.['paint_and_accent']?.art_placement;
      }
    }
    
    // 2. Fallback to background's default art_placement
    if (!artPlacement) {
      const bgType = this._state.ui.currentBackground.type;
      if (bgType === 'rooms') {
        const bgId = this._state.ui.currentBackground.id;
        const background = this._backgroundsConfig.categories.rooms.find(bg => bg.id === bgId);
        artPlacement = background?.art_placement;
      }
    }
    
    return artPlacement || null;
  }
	
	/**
	 * Wait for walnut textures to be ready (don't remove overlay until they're loaded)
	 */
	private async waitForWalnutTextures(): Promise<void> {
		if (!this._sceneManager || !this._woodMaterialsConfig) {
			console.warn('[Controller] Cannot wait for textures - sceneManager or config not available');
			return;
		}
		
		const textureCache = this._sceneManager ? (this._sceneManager as { _textureCache?: { getTexture: (path: string) => { isReady: () => boolean; onLoadObservable: { addOnce: (callback: () => void) => void } } } })._textureCache : undefined;
		if (!textureCache) {
			console.warn('[Controller] TextureCache not available');
			return;
		}
		
		const walnut = this._woodMaterialsConfig.species_catalog.find(s => s.id === 'walnut-black-american');
		
		if (!walnut) {
			console.warn('[Controller] Walnut species not found in catalog');
			return;
		}
		
		const basePath = this._woodMaterialsConfig.texture_config.base_texture_path;
		const sizeInfo = this._woodMaterialsConfig.texture_config.size_map.large;
		const albedoPath = `${basePath}/${walnut.id}/Varnished/${sizeInfo.folder}/Diffuse/wood-${walnut.wood_number}_${walnut.id}-varnished-${sizeInfo.dimensions}_d.png`;
		
		// Get the texture from cache
		if (!textureCache) return;
		
		const texture = textureCache.getTexture(albedoPath);
		
		if (texture.isReady()) {
			return; // Already ready
		}
		
		// Wait for texture to load
		return new Promise<void>((resolve) => {
			texture.onLoadObservable.addOnce(() => {
				resolve();
			});
			
			
			// Timeout after 5 seconds to prevent infinite wait
			setTimeout(() => {
				console.warn('[Controller] Walnut texture load timeout - proceeding anyway');
				resolve();
			}, 5000);
		});
	}
	
	/**
   * Handle committed audio (slice and/or vocal isolation)
   * Sends to backend, receives processed audio, triggers art generation
   */
  private async _handleAudioCommit(payload: {
    useSlice: boolean;
    startTime: number | null;
    endTime: number | null;
    isolateVocals: boolean;
    sliceBlob: Blob | null;
    originalFile?: File;
  }): Promise<void> {
    if (!this._state) return;
    
    // Determine source audio - Always prefer original file for desktop parity
    const audioFile = payload.originalFile || 
      (payload.sliceBlob ? new File([payload.sliceBlob], 'slice.wav', { type: 'audio/wav' }) : null);
    
    if (!audioFile) {
      console.error('[Controller] No audio file for commit');
      return;
    }
    
    // Show processing state
    if (payload.isolateVocals) {
      await this.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'demucs', progress: 0 }
      });
    } else {
      await this.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'uploading', progress: 0 }
      });
    }
    
    try {
      // Build form data
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('isolate_vocals', String(payload.isolateVocals));
      formData.append('remove_silence', String(payload.removeSilence));
      formData.append('silence_threshold', String(payload.silenceThreshold));
      formData.append('silence_min_duration', String(payload.silenceMinDuration));
      
      // Send timing if we are using the original file to ensure backend handles slicing (parity)
      const isOriginal = audioFile === payload.originalFile;
      if (isOriginal && payload.useSlice && payload.startTime !== null && payload.endTime !== null) {
        formData.append('start_time', String(payload.startTime));
        formData.append('end_time', String(payload.endTime));
      }
      
      // Call backend
      const response = await fetch('/api/audio/process-commit', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Audio processing failed: ${response.status}`);
      }
      
      // Get processed audio blob
      const processedBlob = await response.blob();
      const processedFile = new File([processedBlob], 'processed.wav', { type: 'audio/wav' });
      
      // PARITY FIX: The file is already processed (silence removed).
      // Update state snapshot to prevent double-processing in the main pipeline.
      const cleanState = structuredClone(this._state.composition);
      if (payload.removeSilence) {
        cleanState.audio_processing.remove_silence = false;
      }

      // Feed into existing upload pipeline
      await this.handleFileUpload(processedFile, cleanState);
      
    } catch (error) {
      console.error('[Controller] Audio commit failed:', error);
      await this.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'idle', progress: 0 }
      });
    }
  }
  
  /**
   * Handle file upload with backend processing
   * @param file - The uploaded audio file
   * @param uiSnapshot - UI state captured by main.ts before dispatch
   */
  private async handleFileUpload(file: File, uiSnapshot: CompositionStateDTO): Promise<void> {
    if (!this._state) return;

    PerformanceMonitor.start('total_upload_to_render');
    
    // Update UI to show uploading
    await this.dispatch({
      type: 'PROCESSING_UPDATE',
      payload: { stage: 'uploading', progress: 0 },
    });

    try {
			
			// Pause background texture loading during heavy operations
      if (this._idleTextureLoader && typeof (this._idleTextureLoader as IdleTextureLoader).pause === 'function') {
        (this._idleTextureLoader as IdleTextureLoader).pause();
      }
			
      PerformanceMonitor.start('backend_audio_processing');
			
      // Clear the audio cache
      this._audioCache.clearAll();
			
			// Clear composition cache on new audio upload
      this._compositionCache.clear();

      // Preserve current background selection during audio processing
      const currentBg = this._state.ui.currentBackground;
      if (this._backgroundsConfig && this._sceneManager && 'changeBackground' in this._sceneManager) {
        const changeBackground = (this._sceneManager as unknown as { changeBackground: (type: string, id: string, rgb?: number[], path?: string, foregroundPath?: string, wallCompensation?: number) => Promise<void> }).changeBackground;
        
        if (currentBg.type === 'rooms') {
          const room = this._backgroundsConfig.categories.rooms.find(r => r.id === currentBg.id);
          if (room) {
            await changeBackground.call(this._sceneManager, 'rooms', room.id, undefined, room.path, (room as { foreground_path?: string }).foreground_path, (room as { wall_compensation?: number }).wall_compensation);
          }
        } else if (currentBg.type === 'paint') {
          const paint = this._backgroundsConfig.categories.paint.find(p => p.id === currentBg.id);
          if (paint) {
            await changeBackground.call(this._sceneManager, 'paint', paint.id, (paint as { rgb?: number[] }).rgb, (paint as { path?: string }).path, undefined, undefined);
          }
        } else if (currentBg.type === 'accent') {
          const accent = this._backgroundsConfig.categories.accent.find(a => a.id === currentBg.id);
          if (accent) {
            await changeBackground.call(this._sceneManager, 'accent', accent.id, (accent as { rgb?: number[] }).rgb, (accent as { path?: string }).path, undefined, undefined);
          }
        }
      }

      // Process audio through facade
      const audioResponse: AudioProcessResponse = await this._facade.processAudio(
        file,
        uiSnapshot
      );
      PerformanceMonitor.end('backend_audio_processing');

      PerformanceMonitor.start('cache_raw_samples');
      // Cache the raw samples
      const sessionId = this._audioCache.cacheRawSamples(
        file,
        new Float32Array(audioResponse.raw_samples_for_cache)
      );
      PerformanceMonitor.end('cache_raw_samples');
      
      // Preserve section_materials from uiSnapshot (user's wood customizations)
      // Backend may return defaults; frontend owns material selections
      const preservedComposition = {
        ...audioResponse.updated_state,
        frame_design: {
          ...audioResponse.updated_state.frame_design,
          section_materials: uiSnapshot.frame_design?.section_materials 
            ?? audioResponse.updated_state.frame_design.section_materials
        }
      };
      
      // Dispatch the backend response with preserved materials
      await this.dispatch({
        type: 'FILE_PROCESSING_SUCCESS',
        payload: {
          composition: preservedComposition,
          maxAmplitudeLocal: audioResponse.max_amplitude_local,
          rawSamplesForCache: audioResponse.raw_samples_for_cache,
          audioSessionId: sessionId,
        },
      });
      
      /// Show "Preparing your custom art experience!" message
      await this.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'preparing_textures', progress: 0 },
      });			
			
      PerformanceMonitor.start('csg_generation_and_render');
			
			// Compare user's pre-upload UI choices with backend defaults
      const backendComp = audioResponse.updated_state;
      const changedParams = this._detectChangedParams(backendComp, uiSnapshot);
      
      if (changedParams.length > 0) {
        // User changed UI before upload, use their values
        await this.handleCompositionUpdate(uiSnapshot);
      } else {
        // UI matched defaults, trigger initial render
        const response = await this._facade.getSmartCSGData(
          preservedComposition,
          [],
          null
        );
        
        if (this._sceneManager) {
          await this._sceneManager.renderComposition(response);
          
          // Wait a frame to ensure render is actually visible
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
      }
      
      PerformanceMonitor.end('csg_generation_and_render');
      
      PerformanceMonitor.end('total_upload_to_render');
      
      // Reset processing stage after successful render
      await this.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'idle', progress: 0 },
      });
    } catch (error: unknown) {
      console.error('File upload or processing failed:', error);
      await this.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'idle', progress: 0 },
      });
    }
  }
  
  /**
   * Start discovery phase with autoplay
   */
  private startDiscoveryPhase(): void {
    // Clear any existing timers
    this.clearTimers();
    
    // Start autoplay after 1 second
    setTimeout(() => {
      this.startAutoplay();
    }, 1000);
    
    // Show hint after 3 seconds
    this._hintTimer = window.setTimeout(() => {
      void this.dispatch({ type: 'SHOW_HINT' });
    }, 3000);
  }
  
  /**
   * Start carousel autoplay
   */
  startAutoplay(): void {
    if (this._autoplayTimer) {
      clearInterval(this._autoplayTimer);
    }
    
    this._autoplayTimer = window.setInterval(() => {
      if (!this._state || !this._state.ui.isAutoPlaying) {
        this.stopAutoplay();
        return;
      }
      
      const styles = this._facade.getStyleOptions();
      const nextIndex = (this._state.ui.currentStyleIndex + 1) % styles.length;
      
      void this.dispatch({ type: 'STYLE_SELECTED', payload: nextIndex });
    }, 4000);
  }
  
  /**
   * Stop carousel autoplay
   */
  stopAutoplay(): void {
    if (this._autoplayTimer) {
      clearInterval(this._autoplayTimer);
      this._autoplayTimer = undefined;
    }
    
    if (this._state?.ui.isAutoPlaying) {
      void this.dispatch({ type: 'AUTOPLAY_TOGGLED', payload: false });
    }
  }
  
  /**
   * Handle user interaction (stops autoplay)
   */
  handleUserInteraction(): void {
    this.stopAutoplay();
  }
  
  /**
   * Select a specific style
   */
  selectStyle(index: number): void {
    this.handleUserInteraction();
    void this.dispatch({ type: 'STYLE_SELECTED', payload: index });
  }
  
  /**
   * Transition to customization phase
   */
  enterCustomizationPhase(): void {
    this.stopAutoplay();
    void this.dispatch({ type: 'PHASE_CHANGED', payload: 'customization' });
  }
  
  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this._autoplayTimer) {
      clearInterval(this._autoplayTimer);
      this._autoplayTimer = undefined;
    }
    
    if (this._hintTimer) {
      clearTimeout(this._hintTimer);
      this._hintTimer = undefined;
    }
  }
  
  /**
   * Handle side effects after state changes
   */
  private handleSideEffects(action: Action): void {
    switch (action.type) {
      case 'FILE_PROCESSING_SUCCESS':
        this.startDiscoveryPhase();
        break;

      case 'PHASE_CHANGED':
        if (action.payload === 'discovery') {
          this.startDiscoveryPhase();
        } else if (action.payload === 'customization') {
          this.clearTimers();
        }
        break;
    }
  }
  
  /**
   * Notify all subscribers of state change
   */
  private notifySubscribers(): void {	
    if (!this._state) return;
    
    this._subscribers.forEach(callback => {
      callback(this._state!);
    });
  }
	
	/**
   * Handle panel updates based on state changes
   * Called automatically when state changes affect UI
   */
  private handlePanelUpdates(state: ApplicationState): void {
    if (!this._panelStack) return;
    
    // Clear panels on phase change
    if (state.ui.phase === 'upload') {
      this._panelStack.clearStack();
    }
  }
	
	/**
   * Handle category selection from left panel
   * Clears right panel stack and renders category-specific content
   */
  handleCategorySelected(categoryId: string): void {
    if (!this._panelStack || !this._state) return;
    
    // Clear accordion state for the category being left
    const previousCategory = this._state.ui.activeCategory;
    if (previousCategory && previousCategory !== categoryId) {
      delete this._accordionState[previousCategory];
    }
    
    // Clear section selector when leaving WOOD category
    if (this._sectionSelectorPanel) {
      this._sectionSelectorPanel.destroy();
      this._sectionSelectorPanel = null;
    }
    
    // Disable section interaction when leaving WOOD category
    if (this._sceneManager && 'setSectionInteractionEnabled' in this._sceneManager) {
      (this._sceneManager as { setSectionInteractionEnabled: (enabled: boolean) => void }).setSectionInteractionEnabled(false);
      (this._sceneManager as { setSectionOverlaysVisible: (visible: boolean) => void }).setSectionOverlaysVisible(false);
    }
    
    void this.dispatch({ type: 'CATEGORY_SELECTED', payload: categoryId });
    
    // Render accordion for the new category
    this._renderAccordionForCategory(categoryId);
  }
	
	/**
   * Handle background selection from UI
   */
  handleBackgroundSelected(backgroundId: string, type: 'paint' | 'accent' | 'rooms'): void {
    if (!this._backgroundsConfig || !this._sceneManager) return;
    
    const category = this._backgroundsConfig.categories[type];
    const background = category?.find(bg => bg.id === backgroundId);
    
    if (!background) {
      console.error(`[Controller] Background not found: ${backgroundId}`);
      return;
    }
    
    // Handle paint/texture as wall finish update (applies to current room)
    if (type === 'paint') {
      this._currentWallFinishId = backgroundId;
      
      // Update state
      if (this._state) {
        this._state = {
          ...this._state,
          ui: {
            ...this._state.ui,
            currentWallFinish: backgroundId
          }
        };
        this._facade.persistState(this._state);
      }
      
      // Store wall finish in SceneManager
      if ('changeBackground' in this._sceneManager) {
        (this._sceneManager as unknown as { changeBackground: (type: string, id: string, rgb?: number[], path?: string, foregroundPath?: string, wallCompensation?: number) => void })
          .changeBackground('paint', backgroundId, background.rgb, background.path);
      }
      
			// Re-apply current room with new wall finish (use state, not _currentRoomId which may be stale)
			const currentBg = this._state?.ui.currentBackground;
			if (currentBg?.type === 'rooms') {
				const room = this._backgroundsConfig.categories.rooms.find(r => r.id === currentBg.id);
				if (room?.foreground_path) {
					(this._sceneManager as unknown as { changeBackground: (type: string, id: string, rgb?: number[], path?: string, foregroundPath?: string, wallCompensation?: number) => void })
						.changeBackground('rooms', currentBg.id, undefined, room.path, room.foreground_path, (room as { wall_compensation?: number }).wall_compensation);
				}
			}
      
      this.notifySubscribers();
      return;
    }
    
    // Handle room selection
    if (type === 'rooms') {
      this._currentRoomId = backgroundId;
      
      // Toggle body class for blank wall controls visibility
      document.body.classList.toggle('room-blank-wall', backgroundId === 'blank_wall');
    }
    
    // Update state
    if (this._state) {
      this._state = {
        ...this._state,
        ui: {
          ...this._state.ui,
          currentBackground: { type, id: backgroundId }
        }
      };
      this._facade.persistState(this._state);
      // NOTE: notifySubscribers called by handleCompositionUpdate below
    }
    
    // Apply to scene (deferred until after composition update to prevent flash of wrong size)
		const applyBackground = (): Promise<void> => {
			if ('changeBackground' in this._sceneManager) {
				return (this._sceneManager as unknown as { changeBackground: (type: string, id: string, rgb?: number[], path?: string, foregroundPath?: string, wallCompensation?: number) => Promise<void> })
					.changeBackground(type, backgroundId, background.rgb, background.path, (background as { foreground_path?: string }).foreground_path, (background as { wall_compensation?: number }).wall_compensation);
			}
			return Promise.resolve();
		};
    
    // Apply placement defaults and caching if archetype is selected
    if (this._state) {
      const archetypeId = this.getActiveArchetypeId();
      
      // Only apply caching if archetype exists
      if (archetypeId) {
        const backgroundKey = this._getBackgroundKeyForCache({ id: backgroundId, type });
        const cacheKey = this._getCacheKey(archetypeId, backgroundKey);
        
        let composition = this._compositionCache.get(cacheKey);
        
        if (!composition) {
					// Cache miss: preserve current user-modified state without applying defaults
					// Defaults are ONLY applied during archetype selection, not background changes
					composition = structuredClone(this._state.composition);
					
					// Clamp to scene constraints (new scene may have tighter limits)
          if (this._resolver) {
            const sliderConfigs = this._resolver.resolveSliderConfigs(archetypeId, composition);
            const sizeOrWidth = sliderConfigs.find(s => s.id === 'width' || s.id === 'size');
            const sizeOrHeight = sliderConfigs.find(s => s.id === 'height' || s.id === 'size');
            if (sizeOrWidth) composition.frame_design.finish_x = Math.min(composition.frame_design.finish_x, sizeOrWidth.max);
            if (sizeOrHeight) composition.frame_design.finish_y = Math.min(composition.frame_design.finish_y, sizeOrHeight.max);
          }
          
          // Cache the current state as-is to preserve user modifications
          this._compositionCache.set(cacheKey, composition);
				} else {
					// Cache hit: restore cached composition but preserve current backing state
					const currentBacking = this._state.composition.frame_design.backing;
					composition = {
						...composition,
						frame_design: {
							...composition.frame_design,
							backing: currentBacking
						}
					};
				}

				let artPlacement: ArtPlacement | undefined;
				
				// 1. Check placement_defaults for archetype-specific override
				if (this._placementDefaults) {
					const placementData = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.[backgroundKey];
					artPlacement = placementData?.art_placement;
					
					if (!artPlacement && backgroundKey !== 'paint_and_accent') {
						artPlacement = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.['paint_and_accent']?.art_placement;
					}
				}
				
				// 2. Fallback to background's default art_placement
				if (!artPlacement && this._backgroundsConfig) {
					if (type === 'rooms') {
						const background = this._backgroundsConfig.categories.rooms.find(bg => bg.id === backgroundId);
						artPlacement = background?.art_placement;
					}
				}

				const applyArtAndLighting = () => {
						if (artPlacement && 'applyArtPlacement' in this._sceneManager) {
							(this._sceneManager as unknown as { applyArtPlacement: (placement: ArtPlacement) => void }).applyArtPlacement(artPlacement);
						} else if ('resetArtPlacement' in this._sceneManager) {
							(this._sceneManager as unknown as { resetArtPlacement: () => void }).resetArtPlacement();
						}

						if (background?.lighting && 'applyLighting' in this._sceneManager) {
							(this._sceneManager as unknown as { applyLighting: (lighting: unknown) => void }).applyLighting(background.lighting);
						} else if ('resetLighting' in this._sceneManager) {
							(this._sceneManager as unknown as { resetLighting: () => void }).resetLighting();
						}
					};
				void this.handleCompositionUpdate(composition).then(applyBackground).then(applyArtAndLighting);
      } else {
        // No archetype: apply background directly and notify
        void applyBackground();
        this.notifySubscribers();
      }
    }
    
    // Re-render panel to show updated selection (skip if accordion handles rendering)
    if (!this._accordion) {
      this._renderRightMainFiltered();
    }
  }
	
	/**
   * Update left secondary panel position based on main panel width
   */
  private _updateLeftSecondaryPosition(): void {
    if (!this._leftMainPanel || !this._leftSecondaryPanel) return;
    
    // Calculate position based on main panel's actual width
    const mainRect = this._leftMainPanel.getBoundingClientRect();
    const gap = 16; 
    
    // Determine the gap based on CSS logic (8px initial offset + width + gap)
    // Here we just use the right edge of the main panel + gap
    this._leftSecondaryPanel.style.left = `${mainRect.right + gap}px`;
  }
  
  /**
   * Render subcategory accordion for a category
   * Replaces the horizontal subcategory tab bar with vertical accordion
   * @private
   */
  private _renderAccordionForCategory(categoryId: string): void {
    if (!this._categoriesConfig || !this._rightMainPanel) return;
    
    const categoryConfig = this._categoriesConfig[categoryId as keyof CategoriesConfig];
    if (!categoryConfig) return;
    
    // Destroy previous accordion
    if (this._accordion) {
      this._accordion.destroy();
      this._accordion = null;
    }
    
    // Hide legacy left secondary panel
    if (this._leftSecondaryPanel) {
      this._leftSecondaryPanel.style.display = 'none';
      this._leftSecondaryPanel.classList.remove('visible');
    }
    
    // Build accordion items from subcategories
    const items = this._buildAccordionItems(categoryId);
    if (items.length === 0) {
      this._rightMainPanel.innerHTML = '<div class="panel-placeholder">No options available</div>';
      return;
    }
    
    // Get initial open state
    const initialState = this._getInitialAccordionState(categoryId);
    
    // Create accordion
    this._accordion = new SubcategoryAccordion({
      categoryId,
      items,
      initialOpenState: initialState,
      onToggle: (subcategoryId, isOpen) => this._handleAccordionToggle(categoryId, subcategoryId, isOpen)
    });
    
    // Render into right main panel
    this._rightMainPanel.innerHTML = '';
    this._rightMainPanel.appendChild(this._accordion.render());
    this._rightMainPanel.style.display = 'block';
    this._rightMainPanel.classList.add('visible');
    
    // Auto-select first subcategory if none selected
    if (!this._state?.ui.activeSubcategory && items.length > 0) {
      const firstEnabled = items.find(i => !i.isDisabled);
      if (firstEnabled) {
        void this.dispatch({ 
          type: 'SUBCATEGORY_SELECTED', 
          payload: { category: categoryId, subcategory: firstEnabled.id } 
        });
      }
    }
  }
	
	/**
   * Build accordion item configurations from category subcategories
   * @private
   */
  private _buildAccordionItems(categoryId: string): AccordionItemConfig[] {
    if (!this._categoriesConfig) return [];
    
    const categoryConfig = this._categoriesConfig[categoryId as keyof CategoriesConfig];
    if (!categoryConfig) return [];
    
    const items: AccordionItemConfig[] = [];
    
    // Sort subcategories by order
    const sortedSubcategories = Object.entries(categoryConfig.subcategories)
      .map(([id, config]) => ({ id, config }))
      .sort((a, b) => (a.config.order ?? 99) - (b.config.order ?? 99));
    
    for (const { id: subcategoryId, config: subcategory } of sortedSubcategories) {
      const item: AccordionItemConfig = {
        id: subcategoryId,
        label: subcategory.label,
        getValue: () => this._getSubcategoryDisplayValue(categoryId, subcategoryId),
        isDisabled: !!subcategory.note,
        isSingle: sortedSubcategories.length === 1,
        helpText: subcategory.panel_help,
        getContent: async () => this._renderSubcategoryContent(categoryId, subcategoryId)
      };
      
      items.push(item);
    }
    
    return items;
  }

	/**
   * Render Left Secondary Panel without dispatching actions
   * Pure rendering method for state restoration
   * @private
   */
  private _renderLeftSecondaryPanel(
    categoryId: string,
    selectedSubcategoryId: string | null
  ): void {
    if (!this._categoriesConfig || !this._leftSecondaryPanel) return;
    
    const categoryConfig = this._categoriesConfig[categoryId as keyof CategoriesConfig];
    if (!categoryConfig) return;
    
    const subcategories = Object.entries(categoryConfig.subcategories)
      .map(([id, config]) => ({ id, config }));
    
    if (subcategories.length === 0) {
      this._leftSecondaryPanel.style.display = 'none';
      return;
    }
    
    void import('./components/LeftSecondaryPanel').then(({ LeftSecondaryPanel }) => {
      const panel = new LeftSecondaryPanel(
        subcategories,
        selectedSubcategoryId,
        (id: string) => this._handleSubcategorySelected(id)
      );
      
      if (this._leftSecondaryPanel) {
        this._leftSecondaryPanel.innerHTML = '';
        this._leftSecondaryPanel.appendChild(panel.render());
        this._leftSecondaryPanel.style.display = 'block';
        this._leftSecondaryPanel.classList.add('visible');
        this._updateLeftSecondaryPosition();
        
        requestAnimationFrame(() => {
          if (this._sceneManager && 'updateCameraOffset' in this._sceneManager) {
            (this._sceneManager as { updateCameraOffset: () => void }).updateCameraOffset();
          }
        });
      }
    }).catch((error: unknown) => {
      console.error('[Controller] Failed to render Left Secondary Panel:', error);
    });
  }
  
  /**
   * Get display value for subcategory header
   * @private
   */
  private _getSubcategoryDisplayValue(categoryId: string, subcategoryId: string): string {
    if (!this._state) return '';
    
    const composition = this._state.composition;
    const ui = this._state.ui;
    
    const key = `${categoryId}:${subcategoryId}`;
    
    switch (key) {
      case 'wood:panel': {
        const shape = composition.frame_design.shape || 'circular';
        const numSections = composition.frame_design.number_sections || 1;
        const pattern = composition.pattern_settings.slot_style || 'radial';
        return `${this._capitalize(shape)}, ${numSections} panel${numSections > 1 ? 's' : ''}, ${this._capitalize(pattern)}`;
      }
      
      case 'wood:wood_species': {
        const mat = composition.frame_design.section_materials?.[0];
        if (!mat) return '';
        const speciesName = this._getSpeciesDisplayName(mat.species);
        const grain = this._capitalize(mat.grain_direction);
        return `${speciesName}, ${grain}`;
      }
      
      case 'wood:layout': {
        const w = composition.frame_design.finish_x;
        const h = composition.frame_design.finish_y;
        const slots = composition.pattern_settings.number_slots;
        return w && h ? `${w}" × ${h}", ${slots} Elements` : '';
      }
      
      case 'wood:backing': {
        if (!composition.frame_design.backing?.enabled) return 'None';
        const backing = composition.frame_design.backing;
        const typeLabel = this._capitalize(backing.type);
        const finishLabel = this._capitalize(backing.material);
        return `${typeLabel}, ${finishLabel}`;
      }
      
      case 'wood:frames':
        return 'Coming Soon';
				
			case 'audio:custom': {
        if (this._audioSlicerPanel) {
          const filename = this._audioSlicerPanel.getLoadedFilename();
          if (filename) return filename;
        }
        return composition.audio_source?.source_file || 'Choose audio file';
      }
      
      case 'audio:slicing': {
        if (this._audioSlicerPanel) {
          const selection = this._audioSlicerPanel.getSelectionDisplay();
          if (selection) return selection;
        }
        const src = composition.audio_source;
        if (src?.start_time > 0 || src?.end_time > 0) {
          const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
          return `${fmt(src.start_time)} → ${fmt(src.end_time)}`;
        }
        return 'Optional';
      }

      case 'audio:collections': {
        const collId = ui.selectedCollectionId;
        const recId = ui.selectedRecordingId;
        if (!collId || !this._collectionsCatalog) return 'Browse catalog';
        const coll = this._collectionsCatalog.collections.find(c => c.id === collId);
        if (!coll) return 'Browse catalog';
        const rec = coll.recordings.find(r => r.id === recId);
        return rec ? `${coll.title} - ${rec.artist}` : coll.title;
      }
      
      case 'backgrounds:paint': {
        const wallFinishId = ui.currentWallFinish;
        if (!wallFinishId) return '';
        return this._getBackgroundDisplayName('paint', wallFinishId);
      }
      
      case 'backgrounds:accent':
      case 'backgrounds:rooms': {
        const bg = ui.currentBackground;
        if (!bg) return '';
        if (bg.type !== subcategoryId) return '';
        return this._getBackgroundDisplayName(bg.type, bg.id);
      }
      
      default:
        return '';
    }
  }
  
  /**
   * Capitalize first letter of string
   * @private
   */
  private _capitalize(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  /**
   * Get display name for species
   * @private
   */
  private _getSpeciesDisplayName(speciesId: string): string {
    if (!this._woodMaterialsConfig) return speciesId;
    const species = this._woodMaterialsConfig.species_catalog.find(s => s.id === speciesId);
    return species?.display || speciesId;
  }
  
  /**
   * Get display name for backing material
   * @private
   */
  private _getBackingDisplayName(materialId: string): string {
    // Simple fallback - could be enhanced with backing config lookup
    return this._capitalize(materialId.replace(/-/g, ' '));
  }
  
  /**
   * Get display name for background
   * @private
   */
  private _getBackgroundDisplayName(type: string, id: string): string {
    if (!this._backgroundsConfig) return id;
    const category = this._backgroundsConfig.categories[type as keyof typeof this._backgroundsConfig.categories];
    if (!category) return id;
    const bg = (category as Array<{ id: string; name?: string; label?: string }>).find(b => b.id === id);
    return bg?.name || bg?.label || id;
  }
  
  /**
   * Handle accordion toggle event
   * @private
   */
  private _handleAccordionToggle(categoryId: string, subcategoryId: string, isOpen: boolean): void {
    // Persist accordion state to both local cache and UI state
    if (!this._accordionState[categoryId]) {
      this._accordionState[categoryId] = {};
    }
    this._accordionState[categoryId][subcategoryId] = isOpen;
    
    // Persist to UI state for storage
    if (this._state) {
      this._state = {
        ...this._state,
        ui: {
          ...this._state.ui,
          accordionState: { ...this._accordionState }
        }
      };
      this._facade.persistState(this._state);
    }
    
    // Update active subcategory when opened
    if (isOpen) {
      void this.dispatch({
        type: 'SUBCATEGORY_SELECTED',
        payload: { category: categoryId, subcategory: subcategoryId }
      });
      
      // Enable/disable section interaction based on config
      if (this._sceneManager && 'setSectionInteractionEnabled' in this._sceneManager) {
        const enableInteraction = this._isSectionSelectionEnabled(categoryId, subcategoryId);
        (this._sceneManager as { setSectionInteractionEnabled: (enabled: boolean) => void }).setSectionInteractionEnabled(enableInteraction);
        (this._sceneManager as { setSectionOverlaysVisible: (visible: boolean) => void }).setSectionOverlaysVisible(enableInteraction);
        if (!enableInteraction) {
          (this._sceneManager as { clearSelection: () => void }).clearSelection();
        }
      }
      
      // Scroll to selected item in horizontal scroll container
      requestAnimationFrame(() => {
        const content = this._accordion?.getContentElement(subcategoryId);
        const scrollContainer = content?.querySelector('.horizontal-scroll') as HTMLElement;
        if (scrollContainer) {
          this._scrollToSelectedInContainer(scrollContainer);
        }
      });
    }
  }
  
  /**
   * Get initial accordion open state for a category
   * @private
   */
  private _getInitialAccordionState(categoryId: string): Record<string, boolean> {
    // Return persisted state if exists
    if (this._accordionState[categoryId]) {
      return { ...this._accordionState[categoryId] };
    }
    
    // Default: first subcategory open
    if (!this._categoriesConfig) return {};
    
    const categoryConfig = this._categoriesConfig[categoryId as keyof CategoriesConfig];
    if (!categoryConfig) return {};
    
    const subcategories = Object.entries(categoryConfig.subcategories)
      .sort((a, b) => (a[1].order ?? 99) - (b[1].order ?? 99));
    
    const state: Record<string, boolean> = {};
    subcategories.forEach(([id]) => {
      // All subcategories closed by default
      state[id] = false;
    });
    
    return state;
  }
  
  /**
   * Render subcategory content for accordion
   * @private
   */
  private async _renderSubcategoryContent(categoryId: string, subcategoryId: string): Promise<HTMLElement> {
    const container = document.createElement("div");
    container.className = "subcategory-content-inner";
    
    // Note: SUBCATEGORY_SELECTED dispatch handled by _handleAccordionToggle
    
    // Look up option config from categories config
    const catConfig = this._categoriesConfig?.[categoryId as keyof typeof this._categoriesConfig];
    const subConfig = catConfig?.subcategories?.[subcategoryId];
    const optionConfig = subConfig?.options ? Object.values(subConfig.options)[0] : undefined;
    
    await this._renderSubcategoryContentInner(container, categoryId, subcategoryId, optionConfig);
    
    // Render sticky toolbar AFTER content (prepend to preserve position)
    const toolbar = this._getSubcategoryToolbar(categoryId, subcategoryId);
    if (toolbar) {
      const toolbarWrapper = document.createElement('div');
      toolbarWrapper.className = 'subcategory-toolbar--sticky';
      toolbarWrapper.appendChild(toolbar);
      container.insertBefore(toolbarWrapper, container.firstChild);
    }
    
    return container;
  }
  
  /**
   * Internal content rendering for subcategory
   * @private
   */
  private async _renderSubcategoryContentInner(
    container: HTMLElement,
    categoryId: string,
    subcategoryId: string
  ): Promise<void> {
    if (!this._categoriesConfig || !this._state) return;
    
    const categoryConfig = this._categoriesConfig[categoryId as keyof CategoriesConfig];
    const subcategory = categoryConfig?.subcategories[subcategoryId];
    if (!subcategory) return;
    
    // Handle placeholder subcategories
    if (subcategory.note) {
      container.innerHTML = `<div class="panel-placeholder"><p>${subcategory.note}</p></div>`;
      return;
    }
    
    // Use existing _renderRightMainFiltered logic adapted for accordion
    // For now, render a simple placeholder - full implementation connects to existing renderers
    const optionKey = Object.keys(subcategory.options)[0];
    const optionConfig = subcategory.options[optionKey];
    
    if (!optionConfig) {
      container.innerHTML = '<div class="panel-placeholder">No options configured</div>';
      return;
    }
    
    // Render based on option type - reuse existing component creation
    switch (optionConfig.type) {
      case 'thumbnail_grid':
        await this._renderThumbnailGridContent(container, categoryId, subcategoryId, optionConfig);
        break;
      case 'slider_group':
        this._renderSliderGroupContent(container);
        break;
      case 'species_selector':
        await this._renderSpeciesSelectorContent(container);
        break;
      case 'backing_swatches':
        await this._renderBackingSwatchesContent(container);
        break;
      case 'archetype_grid':
        await this._renderArchetypeGridContent(container, categoryId, subcategoryId);
        break;
      case 'wood_species_image_grid':
        await this._renderSpeciesGridContent(container);
        break;
      case 'backing_selector':
        await this._renderBackingSelectorContent(container);
        break;
      case 'tour_launcher':
        await this._renderTourLauncherContent(container);
        break;
      case 'audio_upload':
        await this._renderAudioUploadContent(container);
        break;
			case 'audio_trimmer':
        await this._renderAudioTrimmerContent(container);
        break;
      case 'collections_browser':
        await this._renderCollectionsContent(container);
        break;
      default:
        container.innerHTML = `<div class="panel-placeholder">Content type: ${optionConfig.type}</div>`;
    }
  }
	
	/**
   * Get toolbar element for a subcategory (rendered inside content area)
   * @private
   */
  private _getSubcategoryToolbar(categoryId: string, subcategoryId: string): HTMLElement | null {
    if (!this._categoriesConfig) return null;
    
    const categoryConfig = this._categoriesConfig[categoryId as keyof CategoriesConfig];
    const subcategory = categoryConfig?.subcategories[subcategoryId];
    if (!subcategory) return null;
    
    // Section selector toolbar for wood species
		if (categoryId === 'wood' && subcategoryId === 'wood_species') {
			return this._createSectionSelectorToolbar();
		}
		
		// Filter toolbar for any subcategory with filters
		if (subcategory.filters && Object.keys(subcategory.filters).length > 0) {
			return this._createFilterToolbar(categoryId, subcategoryId, subcategory.filters);
		}
			
		return null;
  }
  
  /**
   * Create filter toolbar for accordion header
   * @private
   */
  private _createFilterToolbar(
    categoryId: string,
    subcategoryId: string,
    filters: Record<string, import('./types/PanelTypes').FilterConfig>
  ): HTMLElement | null {
    const filterGroups = this._buildFilterIconGroups(filters);
    if (filterGroups.length === 0) return null;
    
    const filterKey = `${categoryId}_${subcategoryId}`;
    const stateFilters = this._state?.ui.filterSelections[filterKey] || {};
    const activeFiltersMap = new Map<string, Set<string>>();
    Object.entries(stateFilters).forEach(([filterId, selections]) => {
      activeFiltersMap.set(filterId, new Set(selections));
    });
    
    const strip = new FilterIconStrip(
      filterGroups,
      activeFiltersMap,
      (groupId, selections) => this._handleFilterSelected(groupId, selections, categoryId, subcategoryId),
      true // compact mode
    );
    
    return strip.render();
  }
  
  /**
   * Create section selector toolbar for accordion header
   * @private
   */
  private _createSectionSelectorToolbar(): HTMLElement | null {
    if (!this._state || !this._sceneManager) return null;
    
    const numberSections = this._state.composition.frame_design.number_sections;
    if (numberSections <= 1) return null;
    
    const shape = this._state.composition.frame_design.shape;
    const selectedSections = (this._sceneManager as unknown as { getSelectedSections: () => Set<number> }).getSelectedSections();
    
    // Destroy previous selector if exists
    if (this._sectionSelectorPanel) {
      this._sectionSelectorPanel.destroy();
    }
    
    const selector = new SectionSelectorPanel(
      this,
      numberSections,
      shape,
      selectedSections,
      (newSelection) => this._handleSectionSelectionFromUI(newSelection),
      true // inline mode
    );
    
    // Store reference for external updates (e.g., canvas click-to-clear)
    this._sectionSelectorPanel = selector;
    
    return selector.render();
  }
  
  /**
   * Create backing toggle toolbar for accordion header
   * @private
   */
  private _createBackingToggleToolbar(): HTMLElement | null {
    if (!this._state) return null;
    
    const isEnabled = this._state.composition.frame_design.backing?.enabled ?? false;
    
    // Create toggle inline (BackingPanel static method requires async import)
    const toggle = document.createElement('label');
    toggle.className = 'toggle-switch';
    toggle.innerHTML = `
      <input type="checkbox" ${isEnabled ? 'checked' : ''}>
      <span class="toggle-slider"></span>
    `;
    
    const checkbox = toggle.querySelector('input')!;
    checkbox.addEventListener('change', () => {
      void this._handleBackingToggle(checkbox.checked);
    });
    
    return toggle;
  }
  
  /**
   * Handle backing toggle from accordion toolbar
   * @private
   */
  private async _handleBackingToggle(enabled: boolean): Promise<void> {
    if (!this._state) return;
    
    const newComposition = {
      ...this._state.composition,
      frame_design: {
        ...this._state.composition.frame_design,
        backing: {
          ...this._state.composition.frame_design.backing,
          enabled
        }
      }
    };
    
    await this.handleCompositionUpdate(newComposition);
    
    // Update accordion value display
    if (this._accordion) {
      this._accordion.updateValue('backing');
    }
  }
	
	/**
   * Render tour launcher content for accordion
   * @private
   */
  private async _renderTourLauncherContent(container: HTMLElement): Promise<void> {
    const { TourLauncherPanel } = await import('./components/TourLauncherPanel');
    const tourPanel = new TourLauncherPanel(this, this._sceneManager);
    container.innerHTML = '';
    container.appendChild(tourPanel.render());
  }
	
	/**
   * Render audio slicer content for accordion
   * @private
   */
  private async _ensureAudioSlicerPanel(): Promise<void> {
    if (!this._audioSlicerPanel && this._state) {
      const { AudioSlicerPanel } = await import('./components/AudioSlicerPanel');
      this._audioSlicerPanel = new AudioSlicerPanel(this, {
        silenceThreshold: this._state.composition.audio_processing.silence_threshold,
        silenceDuration: this._state.composition.audio_processing.silence_duration,
        removeSilence: this._state.composition.audio_processing.remove_silence
      });
    }
  }

  private async _renderAudioTrimmerContent(container: HTMLElement): Promise<void> {
    await this._ensureAudioSlicerPanel();
    if (!this._audioSlicerPanel) return;
    container.innerHTML = '';
    container.appendChild(this._audioSlicerPanel.renderTrimmerSection());
  }
	
	private async _renderAudioUploadContent(container: HTMLElement): Promise<void> {
    await this._ensureAudioSlicerPanel();
    if (!this._audioSlicerPanel) return;
    container.innerHTML = '';
    container.appendChild(this._audioSlicerPanel.renderUploadSection());
  }
	
	/**
   * Update audio accordion header value (called from AudioSlicerPanel)
   */
  public updateAudioAccordionValue(subcategoryId: string): void {
    if (this._accordion) {
      this._accordion.updateValue(subcategoryId);
    }
  }

	/**
   * Open next audio accordion (called from AudioSlicerPanel CTA buttons)
   */
  public openNextAudioAccordion(currentSubcategory: string): void {
    const nextMap: Record<string, string> = {
      'custom': 'slicing'
    };
    const next = nextMap[currentSubcategory];
    if (next && this._accordion) {
      this._accordion.setOpen(currentSubcategory, false);
      this._accordion.setOpen(next, true);
    }
  }

  /**
   * Render upload interface content for accordion
   * @private
   */
  private async _renderUploadInterfaceContent(container: HTMLElement): Promise<void> {
    const { UploadPanel } = await import('./components/UploadPanel');
    const uploadPanel = new UploadPanel(this, this._audioCache);
    container.innerHTML = '';
    container.appendChild(uploadPanel.render());
  }

  /**
   * Render collections content for accordion
   * @private
   */
  private async _renderCollectionsContent(container: HTMLElement): Promise<void> {
    // Load catalog if not cached
    if (!this._collectionsCatalog) {
      try {
        const { CollectionsCatalogSchema } = await import('./types/schemas');
        const response = await fetch('/config/collections_catalog.json');
        const data = await response.json();
        this._collectionsCatalog = CollectionsCatalogSchema.parse(data);
      } catch (error) {
        console.error('[Controller] Failed to load collections catalog:', error);
        container.innerHTML = '<div class="panel-placeholder"><p>Failed to load collections</p></div>';
        return;
      }
    }

    // Get active category filter
    const filterKey = `${this._state.ui.activeCategory}_${this._state.ui.activeSubcategory}`;
    const stateFilters = this._state.ui.filterSelections[filterKey] || {};
    const activeFilter = stateFilters['collection_type']?.[0] || null;
    
    // Route to artist view if selected
    if (activeFilter === 'artist') {
      await this._renderArtistCollections(container);
      return;
    }
    
    // Filter collections by category (show all if no filter active)
    const collections = activeFilter
      ? this._collectionsCatalog.collections.filter(c => c.category === activeFilter)
      : this._collectionsCatalog.collections;
    const selectedId = this._state?.ui.selectedCollectionId || null;
    const selectedRecId = this._state?.ui.selectedRecordingId || null;

    // Create scroll container for cards
    const scrollContainer = new HorizontalScrollContainer();
    const scrollWrapper = scrollContainer.render();
    const scrollElement = scrollContainer.getScrollElement()!;

    collections.forEach(item => {
      const card = new AccordionCollectionCard({
        config: item as CollectionCardConfig,
        selected: item.id === selectedId,
        onSelect: (collectionId, recordingId) => {
          void this._handleCollectionSelected(collectionId, recordingId);
        }
      });
      scrollElement.appendChild(card.render());
    });

    container.innerHTML = '';
    container.appendChild(scrollWrapper);

    // Render variant selector area (persistent)
    const variantArea = document.createElement('div');
    variantArea.className = 'collection-variant-area';

		// Clean up previous variant selector
    if (this._collectionVariantSelector) {
      this._collectionVariantSelector.destroy();
      this._collectionVariantSelector = null;
    }
    
    const selectedCollection = collections.find(c => c.id === selectedId);
    if (selectedCollection && selectedCollection.recordings.length > 1) {
      const capturedCollectionId = selectedId!;
      this._collectionVariantSelector = new CollectionVariantSelector({
        recordings: selectedCollection.recordings,
        selectedRecordingId: selectedRecId,
        onSelect: (recordingId) => {
          void this._handleCollectionRecordingSelected(capturedCollectionId, recordingId);
        }
      });
      variantArea.appendChild(this._collectionVariantSelector.render());
    } else {
      variantArea.innerHTML = '<div class="variant-selector-empty">Select a track above</div>';
    }
    
    container.appendChild(variantArea);
    scrollContainer.scrollToSelected();
  }

	/**
   * Render artist-centric collection view
   * Groups recordings by artist, cards are artists, chips are songs
   * @private
   */
  private async _renderArtistCollections(container: HTMLElement): Promise<void> {
    if (!this._collectionsCatalog || !this._state) return;

    const catalog = this._collectionsCatalog;
    const artistMap = new Map<string, {
      id: string;
      name: string;
      thumbnail: string;
      songs: Array<{ collectionId: string; title: string; recordingUrl: string }>;
    }>();

    // Group recordings by artist
    catalog.collections.forEach(collection => {
      collection.recordings.forEach(recording => {
        const artistId = recording.artistId;
        if (!artistId) return;

        if (!artistMap.has(artistId)) {
          const artistMeta = catalog.artists?.[artistId];
          artistMap.set(artistId, {
            id: artistId,
            name: artistMeta?.name || recording.artist,
            thumbnail: artistMeta?.thumbnail || '',
            songs: []
          });
        }
        artistMap.get(artistId)!.songs.push({
          collectionId: collection.id,
          title: collection.title,
          recordingUrl: recording.url
        });
      });
    });

    const selectedArtistId = this._state.ui.selectedCollectionId || null;

    // Create scroll container for artist cards
    const scrollContainer = new HorizontalScrollContainer();
    const scrollWrapper = scrollContainer.render();
    const scrollElement = scrollContainer.getScrollElement()!;

    artistMap.forEach(artist => {
      const card = document.createElement('button');
      card.className = 'accordion-card collection-card artist-card';
      card.dataset.collectionId = artist.id;
      if (artist.id === selectedArtistId) {
        card.classList.add('selected');
      }

      const visual = document.createElement('div');
      visual.className = 'collection-card-visual artist-visual';
      if (artist.thumbnail) {
        const img = document.createElement('img');
        img.src = artist.thumbnail;
        img.alt = artist.name;
        img.loading = 'lazy';
        visual.appendChild(img);
      }
      card.appendChild(visual);

      const info = document.createElement('div');
      info.className = 'collection-card-info';
      const title = document.createElement('div');
      title.className = 'collection-card-title';
      title.textContent = artist.name;
      info.appendChild(title);
      const meta = document.createElement('div');
      meta.className = 'collection-card-meta';
      meta.textContent = `${artist.songs.length} song${artist.songs.length > 1 ? 's' : ''}`;
      info.appendChild(meta);
      card.appendChild(info);

      card.addEventListener('click', () => {
        this._handleArtistSelected(artist.id);
      });

      scrollElement.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(scrollWrapper);

    // Variant area for song chips
    const variantArea = document.createElement('div');
    variantArea.className = 'collection-variant-area';

    if (this._collectionVariantSelector) {
      this._collectionVariantSelector.destroy();
      this._collectionVariantSelector = null;
    }

    const selectedArtist = selectedArtistId ? artistMap.get(selectedArtistId) : null;
    if (selectedArtist && selectedArtist.songs.length > 0) {
      const songChips = document.createElement('div');
      songChips.className = 'variant-chip-container';
      
      const label = document.createElement('span');
      label.className = 'variant-selector-label';
      label.textContent = 'song:';
      variantArea.appendChild(label);

      selectedArtist.songs.forEach(song => {
        const chip = document.createElement('button');
        chip.className = 'variant-chip';
        chip.textContent = song.title;
        chip.addEventListener('click', () => {
          void this._loadCollectionAudio(song.recordingUrl, song.title);
        });
        songChips.appendChild(chip);
      });
      variantArea.appendChild(songChips);
    } else {
      variantArea.innerHTML = '<div class="variant-selector-empty">Select an artist above</div>';
    }

    container.appendChild(variantArea);
    scrollContainer.scrollToSelected();
  }
	
	/**
   * Handle collection track selection
   * @private
   */
  private async _handleCollectionSelected(collectionId: string, recordingId: string): Promise<void> {
    if (!this._state || !this._collectionsCatalog) return;

    const collection = this._collectionsCatalog.collections.find(c => c.id === collectionId);
    if (!collection) return;

    const recording = recordingId ? collection.recordings.find(r => r.id === recordingId) : null;
    
    // Multi-recording with no selection: update UI state but don't load audio
    if (!recording && collection.recordings.length > 1) {
      this._state = {
        ...this._state,
        ui: {
          ...this._state.ui,
          selectedCollectionId: collectionId,
          selectedRecordingId: null
        }
      };
      
      // Update variant selector
      const variantArea = document.querySelector('.collection-variant-area');
      if (variantArea) {
        if (this._collectionVariantSelector) {
          this._collectionVariantSelector.destroy();
        }
        this._collectionVariantSelector = new CollectionVariantSelector({
          recordings: collection.recordings,
          selectedRecordingId: null,
          onSelect: (recId) => {
            void this._handleCollectionRecordingSelected(collectionId, recId);
          }
        });
        variantArea.innerHTML = '';
        variantArea.appendChild(this._collectionVariantSelector.render());
      }
      
      // Update card selection visually
      const scrollContainer = document.querySelector('.subcategory-content-inner .horizontal-scroll');
      scrollContainer?.querySelectorAll('.collection-card').forEach(card => {
        card.classList.toggle('selected', (card as HTMLElement).dataset.collectionId === collectionId);
      });
      
      if (this._accordion) {
        this._accordion.updateValue('collections');
      }
      return;
    }
    
    if (!recording) return;

    // Update UI state
    this._state = {
      ...this._state,
      ui: {
        ...this._state.ui,
        selectedCollectionId: collectionId,
        selectedRecordingId: recordingId
      }
    };

    // Update variant selector (always recreate to capture correct collectionId in callback)
    const variantArea = document.querySelector('.collection-variant-area');
    if (variantArea && collection.recordings.length > 1) {
      if (this._collectionVariantSelector) {
        this._collectionVariantSelector.destroy();
      }
      this._collectionVariantSelector = new CollectionVariantSelector({
        recordings: collection.recordings,
        selectedRecordingId: recordingId,
        onSelect: (recId) => {
          void this._handleCollectionRecordingSelected(collectionId, recId);
        }
      });
      variantArea.innerHTML = '';
      variantArea.appendChild(this._collectionVariantSelector.render());
    } else if (variantArea && collection.recordings.length === 1) {
      if (this._collectionVariantSelector) {
        this._collectionVariantSelector.destroy();
      }
      variantArea.innerHTML = '<div class="variant-selector-empty">Single recording</div>';
      this._collectionVariantSelector = null;
    }

    // Update card selection visually
    const scrollContainer = document.querySelector('.subcategory-content-inner .horizontal-scroll');
    scrollContainer?.querySelectorAll('.collection-card').forEach(card => {
      card.classList.toggle('selected', (card as HTMLElement).dataset.collectionId === collectionId);
    });

    // Load audio file
    await this._loadCollectionAudio(recording.url, collection.title);

    // Update accordion header
    if (this._accordion) {
      this._accordion.updateValue('collections');
    }
  }

	/**
   * Handle artist card selection in artist view
   * @private
   */
  private _handleArtistSelected(artistId: string): void {
    if (!this._state) return;

    this._state = {
      ...this._state,
      ui: {
        ...this._state.ui,
        selectedCollectionId: artistId,
        selectedRecordingId: null
      }
    };

    // Update card selection visually
    const scrollContainer = document.querySelector('.subcategory-content-inner .horizontal-scroll');
    scrollContainer?.querySelectorAll('.collection-card').forEach(card => {
      card.classList.toggle('selected', (card as HTMLElement).dataset.collectionId === artistId);
    });

    // Refresh content to show song chips
    if (this._accordion) {
      this._accordion.refreshContent('collections');
    }
  }

  /**
   * Handle recording variant selection
   * @private
   */
  private async _handleCollectionRecordingSelected(collectionId: string, recordingId: string): Promise<void> {
    if (!this._state || !this._collectionsCatalog) return;

    const collection = this._collectionsCatalog.collections.find(c => c.id === collectionId);
    if (!collection) return;

    const recording = collection.recordings.find(r => r.id === recordingId);
    if (!recording) return;

    // Update state
    this._state = {
      ...this._state,
      ui: {
        ...this._state.ui,
        selectedRecordingId: recordingId
      }
    };

    // Load the new recording
    await this._loadCollectionAudio(recording.url, collection.title);
    
    // Update accordion header
    if (this._accordion) {
      this._accordion.updateValue('collections');
    }
  }

  /**
   * Load audio from collection URL
   * @private
   */
  private async _loadCollectionAudio(url: string, title: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const blob = await response.blob();
      const filename = url.split('/').pop() || `${title}.mp3`;
      const ext = filename.split('.').pop()?.toLowerCase();
      const mimeMap: Record<string, string> = {
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'flac': 'audio/flac',
        'ogg': 'audio/ogg'
      };
      const mimeType = blob.type || mimeMap[ext || ''] || 'audio/mpeg';
      const file = new File([blob], filename, { type: mimeType });
      
      // Ensure AudioSlicerPanel exists
      await this._ensureAudioSlicerPanel();
      
      // Use existing AudioSlicerPanel to load
      if (this._audioSlicerPanel) {
        this._audioSlicerPanel.loadAudioFile(file);
      }
    } catch (error) {
      console.error('[Controller] Failed to load collection audio:', error);
      // Show error without replacing variant selector
      const variantArea = document.querySelector('.collection-variant-area');
      if (variantArea) {
        const existingError = variantArea.querySelector('.collection-load-error');
        if (existingError) existingError.remove();
        const msg = document.createElement('div');
        msg.className = 'collection-load-error';
        msg.style.cssText = 'color: #c0392b; font-size: 11px; margin-top: 8px;';
        msg.textContent = `Audio not found: ${url}`;
        variantArea.appendChild(msg);
      }
    }
  }

	/**
   * Render backing selector content for accordion
   * @private
   */
  private async _renderBackingSelectorContent(container: HTMLElement): Promise<void> {
    if (!this._state) {
      container.innerHTML = '<div class="panel-placeholder">Loading backing options...</div>';
      return;
    }
    
    const backing = this._state.composition.frame_design.backing || {
      enabled: false,
      type: 'acrylic',
      material: 'clear',
      inset: 0.5
    };
    
    const { BackingPanel } = await import('./components/BackingPanel');
    
    const backingPanel = new BackingPanel(
      backing.enabled,
      backing.type,
      backing.material,
      (option: string, value: unknown) => {
        if (option === 'backing_enabled') {
          void this._updateBackingEnabled(value as boolean);
        } else if (option === 'backing_material') {
          const { type, material } = value as { type: string; material: string };
          void this._updateBackingMaterial(type, material);
        }
        if (this._accordion) {
          this._accordion.updateValue('backing');
        }
      },
      true // horizontal
    );
    
    container.innerHTML = '';
    container.appendChild(backingPanel.render());
  }
	
	/**
   * Render species grid content for accordion
   * @private
   */
  private async _renderSpeciesGridContent(container: HTMLElement): Promise<void> {
    if (!this._woodMaterialsConfig || !this._state) {
      container.innerHTML = '<div class="panel-placeholder">Loading species...</div>';
      return;
    }
    
    const materials = this._state.composition.frame_design.section_materials || [];
    const currentSpecies = materials[0]?.species || this._woodMaterialsConfig.default_species;
    const currentGrain = materials[0]?.grain_direction || this._woodMaterialsConfig.default_grain_direction;
    
    const scrollContainer = new HorizontalScrollContainer();
    const scrollWrapper = scrollContainer.render();
    const scrollElement = scrollContainer.getScrollElement()!;
    
    const shape = this._state.composition.frame_design.shape;
    const numSections = this._state.composition.frame_design.number_sections;
    
    const allGrainDefs = [
      { id: 'n1_vertical', direction: 'vertical' },
      { id: 'n1_horizontal', direction: 'horizontal' },
      { id: 'n4_radiant', direction: 'radiant' },
      { id: 'n4_diamond', direction: 'diamond' }
    ];
    const archetypeId = this.getActiveArchetypeId();
    const archetype = archetypeId ? this._archetypes.get(archetypeId) : null;
    const availableGrains = (archetype as { available_grains?: string[] })?.available_grains ?? ['vertical', 'horizontal'];
    const grainDefs = allGrainDefs.filter(g => availableGrains.includes(g.direction));
    
    this._woodMaterialsConfig.species_catalog.forEach(species => {
      const grains = grainDefs.map(g => ({
        id: g.id,
        direction: g.direction,
        thumbnailUrl: `/wood_thumbnails_small/${species.id}_${g.id}.png`,
        largeThumbnailUrl: `/wood_thumbnails_large/${species.id}_${g.id}.png`
      }));
      
      const card = new AccordionSpeciesCard({
				config: { id: species.id, label: species.display, grains },
				selectedSpecies: currentSpecies,
				selectedGrain: currentGrain,
        onSelect: (speciesId, grainDir) => {
          void (async () => {
            await this._updateWoodMaterial('species', speciesId);
            await this._updateWoodMaterial('grain_direction', grainDir);
            if (this._accordion) this._accordion.updateValue('wood_species');
          })();
        }
      });
      scrollElement.appendChild(card.render());
    });
    
    container.innerHTML = '';
    container.appendChild(scrollWrapper);
    scrollContainer.scrollToSelected();
  }
	
	/**
   * Render archetype grid content for accordion
   * @private
   */
  private async _renderArchetypeGridContent(container: HTMLElement, categoryId?: string, subcategoryId?: string): Promise<void> {
    if (!this._state || !this._archetypes) {
      container.innerHTML = '<div class="panel-placeholder">Loading styles...</div>';
      return;
    }
    
    const effectiveCategory = categoryId ?? this._state.ui.activeCategory;
    const effectiveSubcategory = subcategoryId ?? this._state.ui.activeSubcategory;
    const filterKey = `${effectiveCategory}_${effectiveSubcategory}`;
    const stateFilters = this._state.ui.filterSelections[filterKey] || {};
    
    const matchingArchetypes = Array.from(this._archetypes.values())
      .filter(archetype => {
        const activeShapes = stateFilters.shape ? new Set(stateFilters.shape) : new Set();
        if (activeShapes.size > 0 && !activeShapes.has(archetype.shape)) return false;
        
        const activePatterns = stateFilters.slot_pattern ? new Set(stateFilters.slot_pattern) : new Set();
        if (activePatterns.size > 0 && !activePatterns.has(archetype.slot_style)) return false;
        
        return true;
      })
      .map(archetype => ({
        id: archetype.id,
        label: archetype.label,
        thumbnailUrl: archetype.thumbnail,
        disabled: false,
        tooltip: archetype.tooltip
      }));
    
    const activeSelection = this.getActiveArchetypeId();
    
    const scrollContainer = new HorizontalScrollContainer();
    const scrollWrapper = scrollContainer.render();
    const scrollElement = scrollContainer.getScrollElement()!;
    
    matchingArchetypes.forEach(arch => {
      const card = new AccordionStyleCard({
        config: {
          id: arch.id,
          label: arch.label,
          thumbnailUrl: arch.thumbnailUrl,
          disabled: arch.disabled,
          tooltip: arch.tooltip
        },
        selected: arch.id === activeSelection,
        onSelect: (id) => { void this._handleArchetypeSelected(id); }
      });
      scrollElement.appendChild(card.render());
    });
    
    container.innerHTML = '';
    container.appendChild(scrollWrapper);
    scrollContainer.scrollToSelected();
  }
	
	/**
   * Scroll horizontal container to center the selected item
   * @private
   */
  private _scrollToSelectedInContainer(scrollContainer: HTMLElement): void {
    requestAnimationFrame(() => {
      const selected = scrollContainer.querySelector('.selected') as HTMLElement;
      if (!selected) return;
      
      const containerRect = scrollContainer.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();
      const scrollLeft = scrollContainer.scrollLeft;
      
      const targetScroll = scrollLeft +
        (selectedRect.left - containerRect.left) -
        (containerRect.width / 2) +
        (selectedRect.width / 2);
      
      scrollContainer.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: 'instant'
      });
    });
  }
  
  /**
   * Render thumbnail grid content for accordion
   * @private
   */
  private async _renderThumbnailGridContent(
    container: HTMLElement,
    categoryId: string,
    subcategoryId: string,
    _optionConfig: unknown
  ): Promise<void> {
    // Handle backgrounds category
    if (categoryId === 'backgrounds') {
      await this._renderBackgroundsContent(container, subcategoryId);
      return;
    }
    
    // Handle other thumbnail grids (style archetypes, etc.)
    container.innerHTML = '<div class="panel-placeholder">Content not yet implemented</div>';
  }
  
  /**
   * Render backgrounds content (paint, accent, rooms)
   * @private
   */
  private async _renderBackgroundsContent(container: HTMLElement, subcategoryId: string): Promise<void> {
    if (!this._backgroundsConfig) {
      container.innerHTML = '<div class="panel-placeholder">Loading backgrounds...</div>';
      return;
    }
    
    const type = subcategoryId as 'paint' | 'accent' | 'rooms';
    const backgrounds = this._backgroundsConfig.categories[type];
    
    if (!backgrounds || backgrounds.length === 0) {
      container.innerHTML = '<div class="panel-placeholder">No backgrounds available</div>';
      return;
    }
    
    const currentBg = this._state?.ui.currentBackground;
    let selectedId: string | null = null;
    if (type === 'paint') {
      selectedId = this._state?.ui.currentWallFinish || this._backgroundsConfig.default_wall_finish;
    } else if (currentBg?.type === type) {
      selectedId = currentBg.id;
    }
    
    // Create horizontal scroll container
    const scrollContainer = new HorizontalScrollContainer();
    const scrollWrapper = scrollContainer.render();
    const scrollElement = scrollContainer.getScrollElement()!;
    
    backgrounds.forEach(bg => {
      const card = this._createBackgroundCard(bg, type, selectedId === bg.id);
      scrollElement.appendChild(card);
    });
    
    container.innerHTML = '';
    container.appendChild(scrollWrapper);
    scrollContainer.scrollToSelected();
  }
  
  /**
   * Create a background card element
   * @private
   */
  private _createBackgroundCard(
    bg: { id: string; name: string; rgb?: number[]; path?: string },
    type: 'paint' | 'accent' | 'rooms',
    isSelected: boolean
  ): HTMLElement {
    const card = document.createElement('button');
    card.className = `accordion-card ${type === 'paint' ? 'paint-card' : type === 'accent' ? 'accent-card' : 'room-card'}`;
    if (isSelected) card.classList.add('selected');
    card.dataset.itemId = bg.id;
    
    if (type === 'paint') {
      // Paint: color swatch
      const swatch = document.createElement('div');
      swatch.className = 'paint-card-swatch';
      if (bg.rgb) {
        const [r, g, b] = bg.rgb.map(v => Math.round(v * 255));
        swatch.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
      }
      card.appendChild(swatch);
      
      const label = document.createElement('span');
      label.className = 'paint-card-label';
      label.textContent = bg.name;
      card.appendChild(label);
      
    } else if (type === 'accent') {
      // Accent: texture thumbnail
      const img = document.createElement('img');
      img.className = 'accent-card-image';
      img.src = bg.path || '';
      img.alt = bg.name;
      img.loading = 'lazy';
      card.appendChild(img);
      
      const label = document.createElement('span');
      label.className = 'accent-card-label';
      label.textContent = bg.name;
      card.appendChild(label);
      
    } else {
      // Rooms: scene thumbnail
      const img = document.createElement('img');
      img.className = 'room-card-image';
      img.src = bg.path || '';
      img.alt = bg.name;
      img.loading = 'lazy';
      card.appendChild(img);
      
      const label = document.createElement('span');
      label.className = 'room-card-label';
      label.textContent = bg.name;
      card.appendChild(label);
    }
    
    // Tooltip on hover
    card.addEventListener('mouseenter', () => {
      if (!this._helpTooltip) return;
      const content = document.createElement('div');
      content.className = 'tooltip-content-wrapper';
      if (bg.path && type !== 'paint') {
        const preview = document.createElement('img');
        preview.src = bg.path;
        preview.alt = bg.name;
        content.appendChild(preview);
      } else if (bg.rgb) {
        const swatch = document.createElement('div');
        swatch.className = 'tooltip-color-swatch';
        const [r, g, b] = bg.rgb.map(v => Math.round(v * 255));
        swatch.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
        content.appendChild(swatch);
      }
      const desc = document.createElement('p');
      desc.className = 'tooltip-description';
      desc.textContent = bg.name;
      content.appendChild(desc);
      const tooltipClass = type === 'paint' ? 'tooltip-paint' : type === 'accent' ? 'tooltip-accent' : 'tooltip-rooms';
      this._helpTooltip.show(content, card, 'left', tooltipClass, 0, 0, true, 'canvas');
    });
    card.addEventListener('mouseleave', () => this._helpTooltip?.hide());

    // Click handler
    card.addEventListener('click', () => {
      this._helpTooltip?.hide();
      this.handleBackgroundSelected(bg.id, type);
      
      // Update selection visually
      card.closest('.horizontal-scroll')?.querySelectorAll('.accordion-card').forEach(c => {
        c.classList.remove('selected');
      });
      card.classList.add('selected');
      
      // Update accordion value display
      if (this._accordion) {
        this._accordion.updateValue(type);
      }
    });
    
    return card;
  }
  
  /**
   * Set up scroll fade indicators
   * @private
   */
  private _setupScrollFades(wrapper: HTMLElement, scrollEl: HTMLElement): void {
    const updateFades = () => {
      const canScrollLeft = scrollEl.scrollLeft > 1;
      const canScrollRight = scrollEl.scrollLeft < scrollEl.scrollWidth - scrollEl.clientWidth - 1;
      wrapper.classList.toggle('can-scroll-left', canScrollLeft);
      wrapper.classList.toggle('can-scroll-right', canScrollRight);
    };
    
    scrollEl.addEventListener('scroll', updateFades, { passive: true });
    
    // Initial check after layout
    requestAnimationFrame(updateFades);
  }
  
  /**
   * Render slider group content for accordion
   * @private
   */
  private _renderSliderGroupContent(container: HTMLElement): void {
    if (!this._state || !this._resolver) return;
    
    const archetypeId = this.getActiveArchetypeId();
    if (!archetypeId) return;
    
    const sliderConfigs = this._resolver.resolveSliderConfigs(archetypeId, this._state.composition);
    
    const sliderGroup = new SliderGroup(
      sliderConfigs,
      (id, value) => void this._updateStateValue(id, value),
      this._state.composition.frame_design.number_sections,
      this._state.composition.pattern_settings.slot_style
    );
    
    const wrapper = document.createElement('div');
    wrapper.className = 'slider-card';
    wrapper.appendChild(sliderGroup.render());
    container.appendChild(wrapper);
  }
  
  /**
   * Render species selector content for accordion
   * @private
   */
  private async _renderSpeciesSelectorContent(container: HTMLElement): Promise<void> {
    // This will be connected to WoodMaterialSelector with horizontal mode
    container.innerHTML = '<div class="horizontal-scroll"><div class="panel-placeholder">Species selector loading...</div></div>';
  }
  
  /**
   * Render backing swatches content for accordion
   * @private
   */
  private async _renderBackingSwatchesContent(container: HTMLElement): Promise<void> {
    // This will be connected to BackingPanel content in horizontal mode
    container.innerHTML = '<div class="horizontal-scroll"><div class="panel-placeholder">Backing options loading...</div></div>';
  }
  
  /**
   * Handle STYLE category selection (four-panel architecture)
   * @private
   */
	private _handleStyleCategorySelected(): void {
    // DEPRECATED: Accordion now handles category rendering via _renderAccordionForCategory
    // Keeping method signature for backward compatibility during transition
    return;
    
    /* Original implementation preserved for reference:
    if (!this._categoriesConfig || !this._state?.ui.activeCategory || !this._thumbnailConfig) return;
    const categoryConfig = this._categoriesConfig[this._state.ui.activeCategory as keyof CategoriesConfig];
    if (!categoryConfig) return;
		
		const subcategories = Object.entries(categoryConfig.subcategories).map(([id, config]) => ({ id, config }));
    
		// Auto-select subcategory based on current state
    // BUT: Don't override if we already restored a saved subcategory
    const currentComposition = this._state?.composition;
    if (currentComposition && !this._state.ui.activeSubcategory) {
      if (subcategories.length === 1) {
        // Correctly select the single subcategory for Layout, Wood, etc.
        const subcategoryId = subcategories[0].id;
        void this.dispatch({ type: 'SUBCATEGORY_SELECTED', payload: { category: this._state.ui.activeCategory, subcategory: subcategoryId } });
      }
    }
    
    // Hide legacy panel stack
		if (this._panelStack) {
			this._panelStack.clearStack();
		}
		const stackContainer = document.getElementById('right-panel-stack');
		if (stackContainer) {
			stackContainer.style.display = 'none';
		}
		
		// Auto-select the first subcategory if one isn't already active for this category
      if (!this._state.ui.activeSubcategory && subcategories.length > 0) {
        const subcategoryId = subcategories[0].id;
        void this.dispatch({ type: 'SUBCATEGORY_SELECTED', payload: { category: this._state.ui.activeCategory, subcategory: subcategoryId } });
      }
      
      // Defer rendering to the next tick to ensure all state is consistent
      requestAnimationFrame(() => {
        if (this._state?.ui.activeSubcategory) {
          this._handleSubcategorySelected(this._state.ui.activeSubcategory);
        }
      });

    if (subcategories.length === 1) {
      // Auto-select single subcategory, hide secondary panel
      if (this._leftSecondaryPanel) {
        this._leftSecondaryPanel.style.display = 'none';
        this._leftSecondaryPanel.classList.remove('visible');
      }			
			// Update camera offset after panel hides
      requestAnimationFrame(() => {
        if (this._sceneManager && 'updateCameraOffset' in this._sceneManager) {
          (this._sceneManager as { updateCameraOffset: () => void }).updateCameraOffset();
        }
      });
      // Single-subcategory rendering handled by deferred requestAnimationFrame above
    } else if (subcategories.length > 1) {
      // Show placeholder and subcategory choices for multiple options
      if (this._rightMainPanel) {
        this._rightMainPanel.innerHTML = '<div class="panel-content"><div style="padding: 40px 20px; text-align: center; color: rgba(255, 255, 255, 0.6);"><div style="font-size: 48px; margin-bottom: 16px;">←</div><div style="font-size: 16px; font-weight: 500;">Select a subcategory</div></div></div>';
        this._rightMainPanel.style.display = 'block';
      }
      void import('./components/LeftSecondaryPanel').then(({ LeftSecondaryPanel }) => {
        const panel = new LeftSecondaryPanel(subcategories, this._state?.ui.activeSubcategory || null, (id: string) => this._handleSubcategorySelected(id));
        if (this._leftSecondaryPanel) {
          this._leftSecondaryPanel.innerHTML = '';
          this._leftSecondaryPanel.appendChild(panel.render());
          this._leftSecondaryPanel.style.display = 'block';
          this._leftSecondaryPanel.classList.add('visible');
          this._updateLeftSecondaryPosition();
        }
				
				// Update camera offset after panel visibility changes
        requestAnimationFrame(() => {
          if (this._sceneManager && 'updateCameraOffset' in this._sceneManager) {
            (this._sceneManager as { updateCameraOffset: () => void }).updateCameraOffset();
          }
        });
      }).catch((error: unknown) => console.error('[Controller] Failed to load LeftSecondaryPanel:', error));
    } else {
      // No subcategories found, show placeholder
      if (this._leftSecondaryPanel) {
        this._leftSecondaryPanel.style.display = 'none';
        this._leftSecondaryPanel.classList.remove('visible');
      }
      if (this._rightMainPanel) {
        this._rightMainPanel.innerHTML = '<div class="panel-content"><div class="panel-placeholder"><p>No options available for this category yet.</p></div></div>';
        this._rightMainPanel.style.display = 'block';
      }
    }
    */
  }
  
  /**
   * Handle subcategory selection (Left Secondary → Right Secondary + Right Main)
   * @private
   */
  private _handleSubcategorySelected(subcategoryId: string): void {
    // Skip legacy rendering when accordion is active
    if (this._accordion) return;
    
    if (!this._categoriesConfig || !this._state?.ui.activeCategory) {
      return;
    }
    
    const categoryConfig = this._categoriesConfig[this._state.ui.activeCategory as keyof CategoriesConfig];
    if (!categoryConfig) {
      return;
    }

    // Dispatch state update
    void this.dispatch({ type: 'SUBCATEGORY_SELECTED', payload: { category: this._state.ui.activeCategory, subcategory: subcategoryId } });

    // Enable/disable section interaction and overlays based on UI state
    if (this._sceneManager && 'setSectionInteractionEnabled' in this._sceneManager) {
      const enableInteraction = this._state.ui.activeCategory === 'wood' && subcategoryId === 'wood_species';
      (this._sceneManager as { setSectionInteractionEnabled: (enabled: boolean) => void }).setSectionInteractionEnabled(enableInteraction);
      (this._sceneManager as { setSectionOverlaysVisible: (visible: boolean) => void }).setSectionOverlaysVisible(enableInteraction);
      
      // Trigger tutorial pulse when entering Wood Species
      if (enableInteraction && 'playTutorialPulse' in this._sceneManager) {
        (this._sceneManager as unknown as { playTutorialPulse: () => void }).playTutorialPulse();
      }
    }

    // Re-render the LeftSecondaryPanel immediately to show the new selection
    const subcategories = Object.entries(categoryConfig.subcategories).map(([id, config]) => ({ id, config }));
    void import('./components/LeftSecondaryPanel').then(({ LeftSecondaryPanel }) => {
      const panel = new LeftSecondaryPanel(
        subcategories,
        this._state?.ui.activeSubcategory || null, // Pass the updated selection from state
        (id: string) => this._handleSubcategorySelected(id)
      );
      if (this._leftSecondaryPanel) {
        this._leftSecondaryPanel.innerHTML = '';
        this._leftSecondaryPanel.appendChild(panel.render());
      }
    });

    const subcategory = categoryConfig.subcategories[subcategoryId];
    if (!subcategory) return;

    // Always render the main panel after subcategory selection
    this._renderRightMainFiltered();
  }
	
	/**
   * Render section selector in Right Secondary panel for wood species selection
   * Only shown when WOOD > Species is active AND number_sections > 1
   * @private
   */
  private _renderSectionSelector(): void {
    if (!this._rightSecondaryPanel || !this._sceneManager) return;
    
    // Only show for WOOD > Species subcategory
    if (this._state?.ui.activeCategory !== 'wood' || this._state?.ui.activeSubcategory !== 'wood_species') {
      this._rightSecondaryPanel.style.display = 'none';
      return;
    }
    
    const state = this.getState();
    const numberSections = state.composition.frame_design.number_sections;
    const shape = state.composition.frame_design.shape;
    
    // Only show for n > 1
    if (numberSections <= 1) {
      this._rightSecondaryPanel.style.display = 'none';
      return;
    }
    
    // Get current selection from SceneManager
    const selectedSections = (this._sceneManager as unknown as { getSelectedSections: () => Set<number> }).getSelectedSections();
    
    // Clear and render new selector
    this._rightSecondaryPanel.innerHTML = '';
    
    void import('./components/SectionSelectorPanel').then(({ SectionSelectorPanel }) => {
      const selector = new SectionSelectorPanel(
        this,
        numberSections,
        shape,
        selectedSections,
        (newSelection: Set<number>) => {
          // Handle icon click → update SceneManager
          this._handleSectionSelectionFromUI(newSelection);
        }
      );
      
      this._sectionSelectorPanel = selector;
      this._rightSecondaryPanel!.appendChild(selector.render());
			this._rightSecondaryPanel!.classList.add('visible');
			this._rightMainPanel!.classList.add('has-toolbar');
			
    }).catch((error: unknown) => {
      console.error('[Controller] Failed to load SectionSelectorPanel:', error);
    });
  }

	/**
   * Enable/disable section interaction based on current navigation
   * Only enabled for WOOD > Wood & Grain
   * @private
   */
  private _updateSectionInteractionState(): void {
    if (!this._sceneManager) return;
    
    const sm = this._sceneManager as unknown as {
      setSectionInteractionEnabled: (enabled: boolean) => void;
      setSectionOverlaysVisible: (visible: boolean) => void;
      clearSelection: () => void;
    };
    
    const enableInteraction = this._isSectionSelectionEnabled();
    
    sm.setSectionInteractionEnabled(isWoodSpecies);
    
    if (!isWoodSpecies) {
      sm.setSectionOverlaysVisible(false);
      sm.clearSelection();
    }
  }

	/**
   * Check if subcategory enables section selection
   * @private
   */
  private _isSectionSelectionEnabled(categoryId?: string, subcategoryId?: string): boolean {
    if (!this._categoriesConfig) return false;
    
    const catId = categoryId ?? this._state?.ui.activeCategory;
    const subId = subcategoryId ?? this._state?.ui.activeSubcategory;
    
    if (!catId || !subId) return false;
    
    const category = this._categoriesConfig[catId as keyof CategoriesConfig];
    if (!category) return false;
    
    const subcategory = category.subcategories[subId];
    return subcategory?.enables_section_selection === true;
  }
  
  /**
   * Handle section selection from UI icons
   * Updates SceneManager which will sync overlays
   * @private
   */
  private _handleSectionSelectionFromUI(newSelection: Set<number>): void {
    if (!this._sceneManager) return;
    
    const sceneManager = this._sceneManager as unknown as {
      clearSelection: () => void;
      toggleSection: (index: number) => void;
      getSelectedSections: () => Set<number>;
      updateSectionUI: (selection: Set<number>) => void;
    };
    
    // Clear current selection
    sceneManager.clearSelection();
    
    // Apply new selection
    newSelection.forEach(index => {
      sceneManager.toggleSection(index);
    });
    
    // Sync controller state
    this.selectSection(sceneManager.getSelectedSections());
    
    // Update white dot overlays
    sceneManager.updateSectionUI(sceneManager.getSelectedSections());
  }
  
  /**
   * Handle filter selection (Icon strip → updates Right Main display only)
   * CRITICAL: Does NOT update composition state
   * @private
   */
  private _handleFilterSelected(filterId: string, selections: Set<string>, categoryId?: string, subcategoryId?: string): void {
    const effectiveCategory = categoryId ?? this._state?.ui.activeCategory;
    const effectiveSubcategory = subcategoryId ?? this._state?.ui.activeSubcategory;
    if (!effectiveSubcategory || !effectiveCategory) return;
    
    // Dispatch filter change
    void this.dispatch({ 
      type: 'FILTER_CHANGED', 
      payload: { 
        category: effectiveCategory,
        subcategory: effectiveSubcategory,
        filterId,
        selections: Array.from(selections)
      }
    });
    
    // Re-render Right Main with new filter combination
    if (!this._accordion) {
      this._renderRightMainFiltered();
    } else {
      // Refresh accordion content for the filter's owning subcategory
      this._accordion.refreshContent(effectiveSubcategory);
    }
  }
	
	/**
   * Build filter icon groups from subcategory filter config
   * @private
   */
  private _buildFilterIconGroups(filters: Record<string, import('./types/PanelTypes').FilterConfig>): FilterIconGroup[] {
    const groups: FilterIconGroup[] = [];
    
    // Build shape filter group (Panel Shape)
    if (filters.shape) {
      groups.push({
        id: 'shape',
        type: 'shape',
        label: 'Panel Shape',
        icons: filters.shape.options.map(opt => ({
        id: opt.id,
        svgPath: `/assets/icons/${opt.id === 'circular' ? 'circle' : opt.id === 'rectangular' ? 'rectangle' : 'diamond'}.svg`,
        tooltip: opt.tooltip || `${opt.label} Panel`,
        stateValue: opt.id
      }))
      });
    }
    
    // Build slot_pattern filter group (Waveform Pattern)
    if (filters.slot_pattern) {
      groups.push({
        id: 'slot_pattern',
        type: 'waveform',
        label: 'Waveform Pattern',
        icons: filters.slot_pattern.options.map(opt => ({
					id: opt.id,
					svgPath: `/assets/icons/${opt.id}.svg`,
					tooltip: opt.tooltip || `${opt.label} Waveform`,
					stateValue: opt.id
				}))
      });
    }
    
    // Build collection_type filter group (Category buttons)
    if (filters.collection_type) {
      groups.push({
        id: 'collection_type',
        type: 'category',
        label: filters.collection_type.label,
        icons: filters.collection_type.options.map(opt => ({
          id: opt.id,
          svgPath: `/assets/icons/${opt.id}.svg`,
          tooltip: opt.tooltip || opt.label,
          stateValue: opt.id
        }))
      });
    }
    
    return groups;
  }
  
  /**
   * Handle icon filter change from FilterIconStrip
   * @private
   */
  private _handleIconFilterChange(groupId: string, selections: Set<string>): void {
    this._handleFilterSelected(groupId, selections);
  }
  
  /**
   * Render Right Main panel with current filter combination
   * @private
   */
  private _renderRightMainFiltered(): void {
		if (!this._categoriesConfig || !this._state?.ui.activeCategory || !this._state.ui.activeSubcategory || !this._rightMainPanel) return;

		const categoryConfig = this._categoriesConfig[this._state.ui.activeCategory as keyof CategoriesConfig];
		const subcategory = categoryConfig?.subcategories[this._state.ui.activeSubcategory];
		if (!subcategory) return;

		// Increment render ID to invalidate pending async renders
		const currentRenderId = ++this._renderId;

		// CRITICAL: Destroy previous component to clean up tooltips/timers
		if (this._activeRightPanelComponent) {
			this._activeRightPanelComponent.destroy();
			this._activeRightPanelComponent = null;
		}

		// Preserve scroll position from the actual scrollable content area
    const scrollableContent = this._rightMainPanel.querySelector('.panel-content-scrollable') as HTMLElement;
    const scrollTop = scrollableContent?.scrollTop || 0;

    // Hide help tooltip when changing panels
    this._helpTooltip?.hide();

    this._rightMainPanel.innerHTML = '';
		this._rightMainPanel.classList.remove('has-toolbar');
		
		// Clear section selector panel when changing subcategories
		if (this._rightSecondaryPanel) {
			this._rightSecondaryPanel.innerHTML = '';
			this._rightSecondaryPanel.style.display = 'none';
			this._rightSecondaryPanel.classList.remove('visible');
			this._rightSecondaryPanel.style.height = '';
			this._rightSecondaryPanel.style.minHeight = '';
			this._rightSecondaryPanel.style.bottom = '';
		}
		if (this._sectionSelectorPanel) {
			this._sectionSelectorPanel.destroy();
			this._sectionSelectorPanel = null;
		}
		
		// Panel header removed - help icon now in subcategory bar (LeftSecondaryPanel)
		
		// Render filter icon strip if filters exist - OUTSIDE panel-content
		if (subcategory.filters && Object.keys(subcategory.filters).length > 0) {
			const filterGroups = this._buildFilterIconGroups(subcategory.filters);
			if (filterGroups.length > 0) {
				// Convert state filter selections to Map<string, Set<string>> for FilterIconStrip
				const filterKey = `${this._state.ui.activeCategory}_${this._state.ui.activeSubcategory}`;
				const stateFilters = this._state.ui.filterSelections[filterKey] || {};
				const activeFiltersMap = new Map<string, Set<string>>();
				Object.entries(stateFilters).forEach(([filterId, selections]) => {
					activeFiltersMap.set(filterId, new Set(selections));
				});
				
				this._filterIconStrip = new FilterIconStrip(
					filterGroups,
					activeFiltersMap,
					(groupId, iconId) => this._handleIconFilterChange(groupId, iconId)
				);
				this._rightSecondaryPanel!.appendChild(this._filterIconStrip.render());
				this._rightSecondaryPanel!.classList.add('visible');
				this._rightMainPanel.classList.add('has-toolbar');
			}
		}
		
		const panelContent = document.createElement('div');
		panelContent.className = 'panel-content panel-content-scrollable';

		// Check for a placeholder note
		if (subcategory.note) {
			panelContent.innerHTML = `<div class="panel-placeholder"><p>${subcategory.note}</p></div>`;
			this._rightMainPanel.appendChild(panelContent);
			this._rightMainPanel.style.display = 'block';
			this._rightMainPanel.classList.add('visible');
			
			// Restore scroll position
			requestAnimationFrame(() => {
				if (this._rightMainPanel) {
					this._rightMainPanel.scrollTop = scrollTop;
				}
			});
			return;
		}

    // Generic content rendering
    const optionKey = Object.keys(subcategory.options)[0];
    const optionConfig = subcategory.options[optionKey];

    if (optionConfig) {
      switch (optionConfig.type) {
        case 'slider_group': {
          // Resolve slider configurations dynamically based on the current archetype
          const archetypeId = this.getActiveArchetypeId();
          let sliderConfigs: SliderConfig[] = [];
          if (this._resolver && archetypeId && this._state) {
            sliderConfigs = this._resolver.resolveSliderConfigs(
              archetypeId,
              this._state.composition
            );
          }
          const sliderGroup = new SliderGroup(
            sliderConfigs,
            (id, value) => {
              void this._updateStateValue(id, value);
            },
            this._state.composition.frame_design.number_sections,
            this._state.composition.pattern_settings.slot_style
          );
          panelContent.appendChild(sliderGroup.render());
          
          // Add aspect ratio lock control if shape allows it
          const shape = this._state.composition.frame_design.shape;
          const uiConfig = window.uiEngine?.config as { dimension_constraints?: Record<string, { allow_aspect_lock?: boolean }> } | undefined;
          const shapeConstraints = uiConfig?.dimension_constraints?.[shape];
          const allowLock = shapeConstraints?.allow_aspect_lock ?? false;
          
          if (allowLock) {
            const lockControl = new AspectRatioLock(
              this._state.ui.aspectRatioLocked ?? false,
              true, // enabled
              (locked) => this._handleAspectRatioLockChange(locked)
            );
            panelContent.appendChild(lockControl.render());
          }
          
          break;
        }

				case 'wood_species_image_grid': {
					if (this._woodMaterialsConfig && this._state) {
						const body = document.createElement('div');
						body.className = 'panel-body';
						
						const materials = this._state.composition.frame_design.section_materials || [];
						const currentSpecies = materials[0]?.species || this._woodMaterialsConfig.default_species;
						const currentGrain = materials[0]?.grain_direction || this._woodMaterialsConfig.default_grain_direction;
						const scrollWrapper = document.createElement('div');
					scrollWrapper.className = 'horizontal-scroll';
					
					const grainDefs = [
						{ id: 'n1_vertical', direction: 'vertical' },
						{ id: 'n1_horizontal', direction: 'horizontal' },
						{ id: 'n4_radiant', direction: 'radiant' },
						{ id: 'n4_diamond', direction: 'diamond' }
					];
					
					this._woodMaterialsConfig.species_catalog.forEach(species => {
						const grains = grainDefs.map(g => ({
							id: g.id,
							direction: g.direction,
							thumbnailUrl: `/wood_thumbnails_small/${species.id}_${g.id}.png`,
							largeThumbnailUrl: `/wood_thumbnails_large/${species.id}_${g.id}.png`
						}));
						
						const card = new AccordionSpeciesCard({
              config: { id: species.id, label: species.display, grains },
              selectedSpecies: currentSpecies,
              selectedGrain: currentGrain,
							onSelect: (speciesId, grainDir) => {
								void (async () => {
									await this._updateWoodMaterial('species', speciesId);
									await this._updateWoodMaterial('grain_direction', grainDir);
									if (this._accordion) this._accordion.updateValue('wood_species');
								})();
							}
						});
						scrollWrapper.appendChild(card.render());
					});

					body.appendChild(scrollWrapper);
					panelContent.appendChild(body);
					
					// Render section selector in Right Secondary (for n > 1)
					this._renderSectionSelector();
				}
				break;
			}
				
				case 'upload_interface': {
          void import('./components/UploadPanel').then(({ UploadPanel }) => {
            const uploadPanel = new UploadPanel(this, this._audioCache);
            panelContent.appendChild(uploadPanel.render());
          }).catch((error: unknown) => {
            console.error('[Controller] Failed to load UploadPanel:', error);
          });
          break;
        }
				
				case 'thumbnail_grid': {
					// Handle backgrounds category grids
					if (this._state?.ui.activeCategory === 'backgrounds' && this._backgroundsConfig) {
						const subcategoryId = this._state.ui.activeSubcategory;
						const type = subcategoryId as 'paint' | 'accent' | 'rooms';
						const items = this._backgroundsConfig.categories[type];
						
						// Use grouped card layout for paint colors
						if (type === 'paint') {
								void import('./components/PaintColorSelector').then(({ PaintColorSelector }) => {
									if (this._renderId !== currentRenderId) return;
									const paintColors = items.map(item => ({
									id: item.id,
									name: item.name,
									rgb: item.rgb || [0.5, 0.5, 0.5],
									description: item.description,
									group: item.group
								}));
								
								const selector = new PaintColorSelector(
									paintColors,
									this._state!.ui.currentBackground.id,
									(id: string) => this.handleBackgroundSelected(id, 'paint')
								);
								
								panelContent.appendChild(selector.render());
									this._scrollToSelectedItem();
								}).catch((error: unknown) => {
									console.error('[Controller] Failed to load PaintColorSelector:', error);
							});
						} else if (type === 'rooms') {
								// Rooms use card layout
								void import('./components/RoomSelector').then(({ RoomSelector }) => {
									if (this._renderId !== currentRenderId) return;
									const rooms = items.map(item => ({
									id: item.id,
									name: item.name,
									path: item.path || '',
									description: item.description
								}));
								
								const selector = new RoomSelector(
									rooms,
									this._state!.ui.currentBackground.id,
									(id: string) => this.handleBackgroundSelected(id, 'rooms')
								);
								
								panelContent.appendChild(selector.render());
									this._scrollToSelectedItem();
								}).catch((error: unknown) => {
									console.error('[Controller] Failed to load RoomSelector:', error);
							});
						} else {
							// Accent uses standard thumbnail grid
							const thumbnailItems = items.map(item => {
								if (item.rgb) {
									return {
										id: item.id,
										label: item.name,
										thumbnailUrl: '',
										disabled: false,
										tooltip: item.description,
										rgb: item.rgb
									};
								} else {
									return {
										id: item.id,
										label: item.name,
										thumbnailUrl: item.path || '',
										disabled: false,
										tooltip: item.description
									};
								}
							});
							
							const tooltipContext = {
								category: 'backgrounds',
								subcategory: type
							};
							const grid = new ThumbnailGrid(
								thumbnailItems,
								(id: string) => this.handleBackgroundSelected(id, type),
								this._state.ui.currentBackground.id,
								tooltipContext
							);
							
							panelContent.appendChild(grid.render());
						}
					}
					break;
				}
        
        case 'tour_launcher': {
          void import('./components/TourLauncherPanel').then(({ TourLauncherPanel }) => {
            const tourPanel = new TourLauncherPanel(
              this,
              this._sceneManager
            );
            panelContent.appendChild(tourPanel.render());
          }).catch((error: unknown) => {
            console.error('[Controller] Failed to load TourLauncherPanel:', error);
          });
          break;
        }

        case 'archetype_grid': {
          const filterKey = `${this._state.ui.activeCategory}_${this._state.ui.activeSubcategory}`;
          const stateFilters = this._state.ui.filterSelections[filterKey] || {};
          
          const matchingArchetypes = Array.from(this._archetypes.values())
            .filter(archetype => {
              // Apply active filters from state
              const activeShapes = stateFilters.shape ? new Set(stateFilters.shape) : new Set();
              if (activeShapes.size > 0 && !activeShapes.has(archetype.shape)) {
                return false;
              }
              
              const activePatterns = stateFilters.slot_pattern ? new Set(stateFilters.slot_pattern) : new Set();
              if (activePatterns.size > 0 && !activePatterns.has(archetype.slot_style)) {
                return false;
              }
              
              return true;
            })
            .map(archetype => ({
              id: archetype.id,
              label: archetype.label,
              thumbnailUrl: archetype.thumbnail,
              disabled: false,
              tooltip: archetype.tooltip
            }));
            
          const activeSelection = this.getActiveArchetypeId();
          
          const thumbnailGrid = new ThumbnailGrid(
            matchingArchetypes,
            (id) => { void this._handleArchetypeSelected(id); },
            activeSelection,
            { type: 'archetype' }
          );
          panelContent.appendChild(thumbnailGrid.render());
          break;
        }
				case 'backing_selector': {
          if (this._state) {
            const backing = this._state.composition.frame_design.backing || {
              enabled: false,
              type: 'acrylic',
              material: 'clear',
              inset: 0.5
            };

            // Add toggle to right-secondary-panel toolbar
						const toggleWrapper = document.createElement('div');
						toggleWrapper.className = 'backing-toolbar-toggle';
						toggleWrapper.innerHTML = `
							<span class="backing-toggle-label">Enable Backing</span>
							<label class="toggle-switch toggle-switch-small">
								<input type="checkbox" id="backing-enabled-checkbox" ${backing.enabled ? 'checked' : ''}>
								<span class="toggle-slider"></span>
							</label>
						`;
						const checkbox = toggleWrapper.querySelector('input')! as HTMLInputElement;
						checkbox.addEventListener('change', () => {
							void this._updateBackingEnabled(checkbox.checked);
						});

						this._rightSecondaryPanel!.appendChild(toggleWrapper);
						this._rightSecondaryPanel!.classList.add('visible');
						this._rightMainPanel.classList.add('has-toolbar');

            // Create BackingPanel with grids only
            void import('./components/BackingPanel').then(({ BackingPanel }) => {
              // Guard: Skip if render is stale
              if (this._renderId !== currentRenderId) return;

              const backingPanel = new BackingPanel(
                backing.enabled,
                backing.type,
                backing.material,
                (option: string, value: unknown) => {
                  if (option === 'backing_enabled') {
                    void this._updateBackingEnabled(value as boolean);
                  } else if (option === 'backing_material') {
                    const { type, material } = value as { type: string; material: string };
                    void this._updateBackingMaterial(type, material);
                  }
                }
              );
              
              this._activeRightPanelComponent = backingPanel;
              panelContent.appendChild(backingPanel.render());
              this._scrollToSelectedItem();
            }).catch((error: unknown) => {
              console.error('[Controller] Failed to load BackingPanel:', error);
              panelContent.innerHTML = '<div class="panel-placeholder">Failed to load backing options</div>';
            });
          }
          break;
        }
      }
    }

    this._rightMainPanel.appendChild(panelContent);
    this._rightMainPanel.style.display = 'block';
    this._rightMainPanel.classList.add('visible');
		
    // Scroll to selected card for archetype grids, otherwise restore scroll position
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const newScrollableContent = this._rightMainPanel?.querySelector('.panel-content-scrollable') as HTMLElement;
      if (newScrollableContent) {
        const selectedCard = newScrollableContent.querySelector('.selected') as HTMLElement;
        if (selectedCard) {
          selectedCard.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
      }
      });
    });
  }

  /**
   * Scroll selected item to center of right main panel
   */
  private _scrollToSelectedItem(): void {
    requestAnimationFrame(() => {
      const selected = this._rightMainPanel?.querySelector('.panel-content-scrollable .selected') as HTMLElement;
      if (selected) {
        selected.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    });
  }
	
	getArchetype(id: string): Archetype | undefined {
    return this._archetypes.get(id);
  }
	
	/**
   * Get the current archetype ID from application state
   */
  public getActiveArchetypeId(): string | null {
    if (!this._state) return null;
    
    // Prefer explicit selection from UI state
    if (this._state.ui.selectedArchetypeId) {
      return this._state.ui.selectedArchetypeId;
    }
    
    // Fallback to detection logic
    for (const archetype of this._archetypes.values()) {
      const comp = this._state.composition;
      const matches = 
        comp.frame_design.shape === archetype.shape &&
        comp.frame_design.number_sections === archetype.number_sections &&
        comp.pattern_settings.slot_style === archetype.slot_style;
      
      if (matches) {
        return archetype.id;
      }
    }
    
    return null;
  }
	
	/**
   * Generate cache key for archetype + background combination
   */
  private _getCacheKey(archetypeId: string, backgroundId: string): string {
    return `${archetypeId}_${backgroundId}`;
  }
  
  /**
   * Get background key for cache lookup (converts paint/accent to generic key)
   */
  private _getBackgroundKeyForCache(background: { id: string; type: string }): string {
    return (background.type === 'paint' || background.type === 'accent') 
      ? 'paint_and_accent' 
      : background.id;
  }

  /**
   * Get nested value from composition state using dot notation
   * @private
   */
  private _getNestedValue(state: CompositionStateDTO, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = state;
    
    for (const part of parts) {
      if (typeof current === 'object' && current !== null && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  }
  
  /**
   * Handle thumbnail selection (Right Main → updates composition state)
   * Applies state_updates from config
   * @private
   */
  private async _handleArchetypeSelected(archetypeId: string): Promise<void> {
    if (!this._state) return;
    
    const archetype = this._archetypes.get(archetypeId);
    if (!archetype) {
      console.warn(`[Controller] Archetype not found: ${archetypeId}`);
      return;
    }
    
    const backgroundId = this._getBackgroundKeyForCache(this._state.ui.currentBackground);
    const cacheKey = this._getCacheKey(archetypeId, backgroundId);
    
    // Check cache first
    let composition = this._compositionCache.get(cacheKey);
    
    if (!composition) {
      // First visit: apply archetype base
      composition = structuredClone(this._state.composition);
      
      // Apply all properties from the archetype to the composition state
      composition.frame_design.shape = archetype.shape;
      composition.frame_design.number_sections = archetype.number_sections;
      composition.frame_design.separation = archetype.separation;
      composition.pattern_settings.slot_style = archetype.slot_style;
      composition.pattern_settings.number_slots = archetype.number_slots;
      if (archetype.side_margin !== undefined) {
        composition.pattern_settings.side_margin = archetype.side_margin;
      }
      
      // Set x_offset from constraints.json based on slot_style (single source of truth)
      const slotStyleConstraints = this._constraints?.manufacturing?.slot_style?.[archetype.slot_style];
      if (!slotStyleConstraints?.x_offset) {
        throw new Error(`Missing manufacturing.slot_style.${archetype.slot_style}.x_offset in constraints.json`);
      }
      composition.pattern_settings.x_offset = slotStyleConstraints.x_offset;
			
			// Clamp width/height to new archetype constraints
      if (this._resolver && (archetype.shape === 'rectangular' || archetype.shape === 'diamond')) {
        const sliderConfigs = this._resolver.resolveSliderConfigs(archetypeId, composition);
        const widthConfig = sliderConfigs.find(s => s.id === 'width');
        const heightConfig = sliderConfigs.find(s => s.id === 'height');
        
        if (widthConfig) {
          composition.frame_design.finish_x = Math.max(widthConfig.min, Math.min(composition.frame_design.finish_x, widthConfig.max));
        }
        if (heightConfig) {
          composition.frame_design.finish_y = Math.max(heightConfig.min, Math.min(composition.frame_design.finish_y, heightConfig.max));
        }
      }
      
      // If the new shape is circular, intelligently adjust and clamp the size.
      if (archetype.shape === 'circular') {
        const currentX = composition.frame_design.finish_x;
        const currentY = composition.frame_design.finish_y;
        const smallerCurrentDim = Math.min(currentX, currentY);

        let maxAllowedSize = 60;
        let minAllowedSize = 24;
        if (this._constraints?.manufacturing.circular.by_section_count) {
          const nKey = String(archetype.number_sections);
          const constraint = this._constraints.manufacturing.circular.by_section_count[nKey];
          maxAllowedSize = constraint?.max ?? this._constraints.manufacturing.circular.general.max;
          minAllowedSize = constraint?.min ?? this._constraints.manufacturing.circular.general.min;
        }
        
        const newSize = Math.max(minAllowedSize, Math.min(smallerCurrentDim, maxAllowedSize));
        composition.frame_design.finish_x = newSize;
        composition.frame_design.finish_y = newSize;
      }
			
			// CRITICAL: Apply placement defaults (composition_overrides) ONLY during archetype selection
      // Background changes (handleBackgroundSelected) must NOT reapply these defaults to preserve user modifications
      // Apply placement defaults (first visit only)
      if (this._placementDefaults) {
        const placementData = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.[backgroundId];
        if (placementData?.composition_overrides) {
          composition = deepMerge(composition, placementData.composition_overrides);
        }
      }
      
      // Cache the result
      this._compositionCache.set(cacheKey, composition);
    }
    
    // Pre-fetch margin presets for constrained archetypes
    if (this._isRectangularLinearN3Plus(archetypeId)) {
      const presets = await this._fetchMarginPresets(composition);
      if (presets.length > 0 && composition.pattern_settings.symmetric_n_end == null) {
        composition = {
          ...composition,
          pattern_settings: {
            ...composition.pattern_settings,
            symmetric_n_end: presets[0].n_end,
            side_margin: presets[0].side_margin
          }
        };
      }
    }
    
    // Store selected archetype ID in state
    if (this._state) {
      this._state.ui.selectedArchetypeId = archetypeId;
    }
    
    // Apply cached or newly created composition
    await this.handleCompositionUpdate(composition);
		
		// Re-render the panel to show updated selection and new slider limits
    if (!this._accordion) {
      this._renderRightMainFiltered();
    } else {
      this._accordion.refreshContent('panel');
      this._accordion.updateValue('panel');
      this._accordion.refreshContent('wood_species');
      this._accordion.updateValue('wood_species');
      this._accordion.refreshContent('layout');
      this._accordion.updateValue('layout');
    }
    
    // Update art placement
    if (this._sceneManager) {
      let artPlacement: ArtPlacement | undefined;
      
      // 1. Check placement_defaults for archetype-specific override
      if (this._placementDefaults) {
        const placementData = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.[backgroundId];
        artPlacement = placementData?.art_placement;
        
        if (!artPlacement && backgroundId !== 'paint_and_accent') {
          artPlacement = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.['paint_and_accent']?.art_placement;
        }
      }
      
      // 2. Fallback to background's default art_placement
      if (!artPlacement && this._backgroundsConfig && this._state) {
        const bgType = this._state.ui.currentBackground.type;
        if (bgType === 'rooms') {
          const background = this._backgroundsConfig.categories.rooms.find(bg => bg.id === backgroundId);
          artPlacement = background?.art_placement;
        }
      }

      if (artPlacement && 'applyArtPlacement' in this._sceneManager) {
					(this._sceneManager as unknown as { applyArtPlacement: (placement: ArtPlacement) => void }).applyArtPlacement(artPlacement);
				} else if ('resetArtPlacement' in this._sceneManager) {
					(this._sceneManager as unknown as { resetArtPlacement: () => void }).resetArtPlacement();
      }
    }
  }

  /**
   * Handle option selection from right panel
   * @private
   */
  private _handleOptionSelected(
    option: string,
    value: unknown,
    contentRenderer: RightPanelContentRenderer,
    uiConfig: { elements: Record<string, unknown> }
  ): void {
    if (!this._panelStack || !this._state) return;

    // Handle navigation to cascading panels
    if (option === 'navigate') {
      this._handleNavigation(value as string, contentRenderer, uiConfig);
      return;
    }

    // Handle backing enabled toggle
    if (option === 'backing_enabled') {
      void this._updateBackingEnabled(value as boolean);
      return;
    }

    // Handle backing material change
    if (option === 'backing_material') {
      const { type, material } = value as { type: string; material: string };
      void this._updateBackingMaterial(type, material);
      return;
    }

    // Handle direct state updates
    void this._updateStateValue(option, value);
  }
	
	/**
   * Update dimension with constraint logic
   * Handles width/height changes respecting aspect ratio lock and shape constraints
   * @private
   */
  private async _updateDimension(
    axis: 'x' | 'y',
    value: number
  ): Promise<void> {
		
		// Dimension update
		
    if (!this._state) return;

    const newComposition = structuredClone(this._state.composition);
		
		const newValue = value;

    // Build constraints from current state and config
    const uiConfig = window.uiEngine;
    const shapeConstraintsConfig = uiConfig?.config?.dimension_constraints?.[newComposition.frame_design.shape] as { min_dimension?: number; max_dimension?: number } | undefined;
    
    const constraints: DimensionConstraints = {
      shape: newComposition.frame_design.shape,
      aspectRatioLocked: this._state.ui.aspectRatioLocked ?? false,
      lockedAspectRatio: this._state.ui.lockedAspectRatio ?? null,
      minDimension: (shapeConstraintsConfig?.min_dimension as number | undefined) ?? 8.0,
      maxDimension: (shapeConstraintsConfig?.max_dimension as number | undefined) ?? 84.0
    };
    
    // Calculate new dimensions using utility function
    const result = applyDimensionChange(
      axis,
      newValue,
      newComposition.frame_design.finish_x,
      newComposition.frame_design.finish_y,
      constraints
    );
    
    // Apply calculated dimensions
    newComposition.frame_design.finish_x = result.finish_x;
    newComposition.frame_design.finish_y = result.finish_y;
    
    // Update UI state if lock was broken by clamping
    if (result.lockBroken && this._state.ui.aspectRatioLocked) {
      this._state = {
        ...this._state,
        ui: {
          ...this._state.ui,
          aspectRatioLocked: false,
          lockedAspectRatio: null
        }
      };
    }
    
    // Single update through facade
    await this.handleCompositionUpdate(newComposition);
    
    // Update accordion header value
    if (this._accordion) {
      this._accordion.updateValue('layout');
    }
    
    // Update the OTHER slider's max value directly without re-rendering
		const archetypeId = this.getActiveArchetypeId();
		if (archetypeId && this._resolver && this._state) {
			const sliderConfigs = this._resolver.resolveSliderConfigs(archetypeId, this._state.composition);
			
			// Update width slider max if height changed
			if (axis === 'y') {
				const widthConfig = sliderConfigs.find(s => s.id === 'width');
				if (widthConfig) {
					const widthSlider = document.getElementById('width') as HTMLInputElement;
					if (widthSlider) {
						widthSlider.max = String(widthConfig.max);
						// Clamp current value if it exceeds new max
						if (parseFloat(widthSlider.value) > widthConfig.max) {
							widthSlider.value = String(widthConfig.max);
							const valueDisplay = document.getElementById('width-value');
							if (valueDisplay) {
								valueDisplay.textContent = `${widthConfig.max}"`;
							}
						}
					}
				}
			}
			
			// Update height slider max if width changed
			if (axis === 'x') {
				const heightConfig = sliderConfigs.find(s => s.id === 'height');
				if (heightConfig) {
					const heightSlider = document.getElementById('height') as HTMLInputElement;
					if (heightSlider) {
						heightSlider.max = String(heightConfig.max);
						// Clamp current value if it exceeds new max
						if (parseFloat(heightSlider.value) > heightConfig.max) {
							heightSlider.value = String(heightConfig.max);
							const valueDisplay = document.getElementById('height-value');
							if (valueDisplay) {
								valueDisplay.textContent = `${heightConfig.max}"`;
							}
						}
					}
				}
			}
			
			// Update slots slider max (dimensions affect available slot space)
			const slotsConfig = sliderConfigs.find(s => s.id === 'slots');
			if (slotsConfig) {
				const slotsSlider = document.getElementById('slots') as HTMLInputElement;
				if (slotsSlider) {
					slotsSlider.max = String(slotsConfig.max);
					if (parseFloat(slotsSlider.value) > slotsConfig.max) {
						slotsSlider.value = String(slotsConfig.max);
						const valueDisplay = document.getElementById('slots-value');
						if (valueDisplay) {
							valueDisplay.textContent = String(slotsConfig.max);
						}
					}
				}
			}
		}
	}	
	/**
   * Handle aspect ratio lock toggle
   * Captures current ratio when locked, clears when unlocked
   * @private
   */
  private _handleAspectRatioLockChange(locked: boolean): void {
    if (!this._state) return;
    
    const newState = structuredClone(this._state);
    newState.ui.aspectRatioLocked = locked;
    
    if (locked) {
      // Capture current ratio
      const { finish_x, finish_y } = this._state.composition.frame_design;
      newState.ui.lockedAspectRatio = finish_x / finish_y;
    } else {
      // Clear locked ratio
      newState.ui.lockedAspectRatio = null;
    }
    
    // Update state (no backend call needed - UI-only state)
    this._state = newState;
    this._facade.persistState(this._state);
    
    // Re-render to update UI
    if (!this._accordion) {
      this._renderRightMainFiltered();
    }
  }
	
	/**
 * Update state value and trigger re-render
 * Uses UI config as single source of truth for state paths
 * @private
 */
	private async _updateStateValue(option: string, value: unknown): Promise<void> {
		if (!this._state) return;

		// Route width/height changes through dimension calculator
		if (option === 'width' || option === 'size') {
			return this._updateDimension('x', value as number);
		}
		if (option === 'height') {
			return this._updateDimension('y', value as number);
		}

		const newComposition = structuredClone(this._state.composition);

		// UIEngine is the authoritative source for element configs
		const elementConfig = window.uiEngine?.getElementConfig(option);
		
		if (!elementConfig?.state_path) {
			console.warn(`[Controller] No state_path found for option: ${option}`);
			return;
		}

		// Update the nested value using state_path from UIEngine
		this._setNestedValue(newComposition, elementConfig.state_path, value);
		
		// CRITICAL: For circular panels, "size", "width", and "height" all control diameter
		// and must update both finish_x and finish_y to maintain a perfect circle.
		if (newComposition.frame_design.shape === 'circular' && ['size', 'width', 'height'].includes(option)) {
      newComposition.frame_design.finish_x = value as number;
      newComposition.frame_design.finish_y = value as number;
    }

		// Trigger composition update
		await this.handleCompositionUpdate(newComposition);
		
		// Update slots slider max when separation or side_margin changes
		if (option === 'separation' || option === 'side_margin') {
			const archetypeId = this.getActiveArchetypeId();
			if (archetypeId && this._resolver && this._state) {
				const sliderConfigs = this._resolver.resolveSliderConfigs(archetypeId, this._state.composition);
				const slotsConfig = sliderConfigs.find(s => s.id === 'slots');
				if (slotsConfig) {
					const slotsSlider = document.getElementById('slots') as HTMLInputElement;
					if (slotsSlider) {
						slotsSlider.max = String(slotsConfig.max);
						if (parseFloat(slotsSlider.value) > slotsConfig.max) {
							slotsSlider.value = String(slotsConfig.max);
							const valueDisplay = document.getElementById('slots-value');
							if (valueDisplay) {
								valueDisplay.textContent = String(slotsConfig.max);
							}
						}
					}
				}
			}
		}
	}
	
	/**
   * Set nested object value using dot notation path
   * @private
   */
  private _setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown
  ): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    
    const lastPart = parts[parts.length - 1];
    current[lastPart] = value;
  }
	
	/**
   * Update wood material properties (species or grain_direction)
   * Applies to all sections or selected sections
   * @private
   */
  private async _updateWoodMaterial(
    property: 'species' | 'grain_direction',
    value: string
  ): Promise<void> {
    if (!this._state) return;

    // Create a new composition state immutably
    const newComposition = structuredClone(this._state.composition);
    
    // Ensure the materials array exists
    const materials = newComposition.frame_design.section_materials || [];
    const numSections = newComposition.frame_design.number_sections;
    
    // Determine which section indices to update
    const targetIndices = this._selectedSectionIndices.size > 0
      ? Array.from(this._selectedSectionIndices)
      : Array.from({ length: numSections }, (_, i) => i); // If none selected, target all

    // Update only the target sections
    targetIndices.forEach(sectionId => {
      const material = materials.find(m => m.section_id === sectionId);
      
      if (material) {
        // Update existing material entry
        material[property] = value;
      } else {
        // Create a new material entry if it doesn't exist
        const newMaterial: SectionMaterial = {
          section_id: sectionId,
          species: property === 'species' ? value : this._woodMaterialsConfig?.default_species || 'walnut-black-american',
          grain_direction: property === 'grain_direction' ? value as 'horizontal' | 'vertical' | 'radiant' | 'diamond' : this._woodMaterialsConfig?.default_grain_direction || 'vertical'
        };
        materials.push(newMaterial);
      }
    });

    // Ensure the materials array is sorted by section_id for consistency
    newComposition.frame_design.section_materials = materials.sort((a, b) => a.section_id - b.section_id);

    // Trigger the rendering pipeline with the updated composition
    await this.handleCompositionUpdate(newComposition);
    
    // Update accordion header value
    if (this._accordion) {
      this._accordion.updateValue('wood_species');
    }
  }
  
	/**
   * Update backing material
   * @private
   */
  private async _updateBackingMaterial(type: string, material: string): Promise<void> {
    if (!this._state) return;
		
		const backingType = type as 'acrylic' | 'cloth' | 'leather' | 'foam';

    // Define the backing object first to avoid parser ambiguity
    const currentBacking = this._state.composition.frame_design.backing || { enabled: true, inset: 0.5 };
    const newComposition: CompositionStateDTO = {
      ...this._state.composition,
      frame_design: {
        ...this._state.composition.frame_design,
        backing: {
          ...currentBacking,
          enabled: true,
          type: backingType,
          material: material,
        }
      }
    };
    
    const response = await fetch('http://localhost:8000/geometry/backing-parameters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newComposition)
    });

    if (!response.ok) {
      console.error('[Controller] Failed to fetch backing parameters after material change.');
      return;
    }
    const backingParams = await response.json();
    
    await this.dispatch({ type: 'COMPOSITION_UPDATED', payload: newComposition });

    if (this._sceneManager) {
			await this._sceneManager.generateBackingIfEnabled(backingParams, newComposition);
		}
		
		// Re-render panel to update BackingPanel with new enabled state
		if (!this._accordion) {
			this._renderRightMainFiltered();
		} else {
			this._accordion.updateValue('backing');
		}
	}
	
	private async _updateBackingEnabled(enabled: boolean): Promise<void> {
		if (!this._state) return;
		
		const currentBacking = this._state.composition.frame_design.backing || { 
			type: 'acrylic', 
			material: 'clear', 
			inset: 0.5 
		};
		
		const newComposition: CompositionStateDTO = {
			...this._state.composition,
			frame_design: {
				...this._state.composition.frame_design,
				backing: {
					...currentBacking,
					enabled
				}
			}
		};
		
		const response = await fetch('http://localhost:8000/geometry/backing-parameters', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(newComposition)
		});

		if (!response.ok) {
			console.error('[Controller] Failed to fetch backing parameters');
			return;
		}
		
		const backingParams = await response.json();
		await this.dispatch({ type: 'COMPOSITION_UPDATED', payload: newComposition });

		if (this._sceneManager) {
			await this._sceneManager.generateBackingIfEnabled(backingParams, newComposition);
		}
		
		// Re-render panel to update BackingPanel with new enabled state
		if (!this._accordion) {
			this._renderRightMainFiltered();
		} else {
			this._accordion.updateValue('backing');
		}
	}

  /**
   * Handle navigation to cascading panels
   * @private
   */
  private _handleNavigation(
    target: string,
    contentRenderer: RightPanelContentRenderer,
    uiConfig: { elements: Record<string, unknown> }
  ): void {
    if (!this._panelStack || !this._state) return;

    switch (target) {
      case 'species': {
        const panel = contentRenderer.renderWoodSpeciesPanel(
          this._state.composition,
          uiConfig,
          (species: string) => {
            void this._updateWoodMaterial('species', species);
            this._panelStack?.popPanel();
          },
          () => {
            this._panelStack?.popPanel();
          }
        );
        this._panelStack.pushPanel(panel);
        break;
      }

      case 'grain': {
        const panel = contentRenderer.renderGrainDirectionPanel(
          this._state.composition,
          (grain: string) => {
            void this._updateWoodMaterial('grain_direction', grain);
            this._panelStack?.popPanel();
          },
          () => {
            this._panelStack?.popPanel();
          }
        );
        this._panelStack.pushPanel(panel);
        break;
      }

      default:
        console.warn('Unknown navigation target:', target);
    }
  }
	
	private _detectChangedParams(
		oldComp: CompositionStateDTO,
		newComp: CompositionStateDTO
	): string[] {
		const changed = new Set<string>();

		// Special handling for section_materials array
		const compareSectionMaterials = (
			oldMaterials: Array<{section_id: number, species: string, grain_direction: string}>,
			newMaterials: Array<{section_id: number, species: string, grain_direction: string}>
		): boolean => {
			if (oldMaterials.length !== newMaterials.length) return true;
			
			// Sort both arrays by section_id for consistent comparison
			const oldSorted = [...oldMaterials].sort((a, b) => a.section_id - b.section_id);
			const newSorted = [...newMaterials].sort((a, b) => a.section_id - b.section_id);
			
			// Compare each element
			for (let i = 0; i < oldSorted.length; i++) {
				const old = oldSorted[i];
				const newer = newSorted[i];
				
				if (
					old.section_id !== newer.section_id ||
					old.species !== newer.species ||
					old.grain_direction !== newer.grain_direction
				) {
					return true;
				}
			}
			
			return false;
		};

		// Type-safe recursive comparison function
		const compareObjects = (
			o1: Record<string, unknown>,
			o2: Record<string, unknown>,
			path: string = ''
		) => {
			for (const key of Object.keys(o1)) {
				const val1 = o1[key];
				const val2 = o2[key];
				const currentPath = path ? `${path}.${key}` : key;

				// Special case: section_materials array
				if (currentPath === 'frame_design.section_materials') {
					if (Array.isArray(val1) && Array.isArray(val2)) {
						if (compareSectionMaterials(val1 as Array<{section_id: number, species: string, grain_direction: string}>, val2 as Array<{section_id: number, species: string, grain_direction: string}>)) {
							changed.add('section_materials');
						}
					}
					continue;
				}

				// Recurse into nested objects
				if (
					typeof val1 === 'object' && val1 !== null && !Array.isArray(val1) &&
					val2 && typeof val2 === 'object' && !Array.isArray(val2)
				) {
					compareObjects(
						val1 as Record<string, unknown>,
						val2 as Record<string, unknown>,
						currentPath
					);
				} else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
					// For primitives or other arrays
					changed.add(key);
				}
			}
		};

		compareObjects(oldComp, newComp);
		return Array.from(changed);
	}
  
  /**
   * Handles a request to update the composition, using the smart processing pipeline.
   * This is the core of the optimization logic on the frontend.
   */
 
	async handleCompositionUpdate(initialComposition: CompositionStateDTO): Promise<void> {
		
    if (this._isUpdatingComposition) {
      console.warn('[Controller] Composition update already in progress. Ignoring request.');
      return;
    }
    this._isUpdatingComposition = true;
    try {
      if (!this._state) {
        throw new Error('Controller not initialized');
      }
      
      // Create a mutable working copy to avoid reassigning the function parameter.
      let newComposition = initialComposition;

      // Check if the size has changed
      const oldSize = this._state.composition.frame_design.finish_x;
      const newSize = newComposition.frame_design.finish_x;

      if (oldSize !== newSize) {
        // Size has changed, apply smart defaults
        const sizeKey = String(newSize);
        const defaults = newComposition.size_defaults?.[sizeKey];

        if (defaults) {
          newComposition = {
            ...newComposition,
            pattern_settings: {
              ...newComposition.pattern_settings,
              number_slots: defaults.number_slots,
            },
            frame_design: {
              ...newComposition.frame_design,
              separation: defaults.separation,
            },
          };
          
          // Update UI dropdown to hide/show grain options and reset to valid value if needed
          if (typeof window !== 'undefined' && (window as { updateGrainDirectionOptionsFromController?: (n: number) => void }).updateGrainDirectionOptionsFromController) {
            (window as { updateGrainDirectionOptionsFromController?: (n: number) => void }).updateGrainDirectionOptionsFromController?.(newComposition.frame_design.number_sections);
          }
        }
      }
      
      // Initialize section_materials when number_sections changes
      const oldN = this._state.composition.frame_design.number_sections;
      const newN = newComposition.frame_design.number_sections;

      if (oldN !== newN) {
      
      // CRITICAL: Use materials from UI snapshot, NOT old state
      const uiCapturedMaterials = newComposition.frame_design.section_materials || [];
      if (this._woodMaterialsConfig) { // Ensure config is loaded
        const targetArchetype = Array.from(this._archetypes.values()).find(a => 
          a.shape === newComposition.frame_design.shape && 
          a.slot_style === newComposition.pattern_settings.slot_style && 
          a.number_sections === newN
        );
        // Fallback to config default (Single Source of Truth) instead of hardcoded strings
        const validGrains = (targetArchetype as { available_grains?: string[] })?.available_grains 
          ?? [this._woodMaterialsConfig.default_grain_direction];

        const initializedMaterials = initializeSectionMaterials(
          oldN,
          newN,
          uiCapturedMaterials,
          this._woodMaterialsConfig,
          validGrains
        );
        
        newComposition = {
          ...newComposition,
          frame_design: {
            ...newComposition.frame_design,
            section_materials: initializedMaterials
          }
        };
      }
      }

      // 1. Detect what changed to determine the processing level.
      const changedParams = this._detectChangedParams(
        this._state.composition,
        newComposition
      );

      // PARITY FIX: Invalidate client cache if "Heavy" audio parameters change.
      // These affect the timeline (silence/trimming), making cached samples stale.
      const heavyAudioParams = ['audio_processing.remove_silence', 'audio_processing.silence_threshold', 'audio_processing.silence_duration', 'audio_source'];
      if (changedParams.some(p => heavyAudioParams.some(h => p.startsWith(h))) && this._state.audio.audioSessionId) {
        this._audioCache.clearSession(this._state.audio.audioSessionId);
        this._state.audio.audioSessionId = null;
        this._facade.persistState(this._state);
      }

      // Invalidate margin presets if geometry changed
      const geometryChanged = changedParams.some(p => 
        ['finish_x', 'finish_y', 'separation', 'number_sections', 'number_slots', 'side_margin'].includes(p)
      );
      if (geometryChanged && this._isRectangularLinearN3Plus(this._state.ui.selectedArchetypeId || '')) {
        this._marginPresetCache.clear();
        // Let backend solver compute symmetric distribution with minimum margin
        newComposition = {
          ...newComposition,
          pattern_settings: {
            ...newComposition.pattern_settings,
            symmetric_n_end: null,
            side_margin: 0
          }
        };
      }

      // Clamp number_slots if side_margin change reduces available space
      if ((changedParams.includes('side_margin') || changedParams.includes('separation')) && this._resolver) {
        const archetypeId = this.getActiveArchetypeId();
        if (archetypeId) {
          const sliderConfigs = this._resolver.resolveSliderConfigs(archetypeId, newComposition);
          const slotsConfig = sliderConfigs.find(s => s.id === 'slots');
          if (slotsConfig && newComposition.pattern_settings.number_slots > slotsConfig.max) {
            newComposition = {
              ...newComposition,
              pattern_settings: {
                ...newComposition.pattern_settings,
                number_slots: slotsConfig.max
              }
            };
            // Force pipeline to re-bin audio and visual slider to snap to new position
            if (!changedParams.includes('number_slots')) changedParams.push('number_slots');
            const slotsSlider = document.getElementById('slots') as HTMLInputElement;
            if (slotsSlider) slotsSlider.value = String(slotsConfig.max);						
          }
        }
      }

      // If nothing relevant changed, just update the local state without an API call.
      if (changedParams.length === 0) {
        await this.dispatch({ type: 'COMPOSITION_UPDATED', payload: newComposition });
        return;
      }

      // 2. Check if ONLY material properties changed (fast path - no backend call)
      const onlyMaterialsChanged = changedParams.every(param => 
        param === 'section_materials' || param.startsWith('section_materials.')
      );

      if (onlyMaterialsChanged) {
        
        // Update state locally
        this._state = {
          ...this._state,
          composition: newComposition
        };
        
        // Persist state
        this._facade.persistState(this._state);
        
        // Update cache with user's customization
        const archetypeId = this.getActiveArchetypeId();
        if (archetypeId) {
          const backgroundId = this._getBackgroundKeyForCache(this._state.ui.currentBackground);
          const cacheKey = this._getCacheKey(archetypeId, backgroundId);
          this._compositionCache.set(cacheKey, structuredClone(newComposition));
        }
        
        // Apply materials to existing meshes (no CSG regeneration)
        if (this._sceneManager) {
          // When no specific sections are selected, this implies an update to all
          const targets = this._selectedSectionIndices.size > 0 
            ? this._selectedSectionIndices 
            : new Set(Array.from({ length: this._state.composition.frame_design.number_sections }, (_, i) => i));

          targets.forEach(sectionId => {
            this._sceneManager.applySingleSectionMaterial?.(sectionId);
          });
        }
        
        // Notify subscribers
        this.notifySubscribers();
        
        return; // CRITICAL: Stop execution here to prevent full re-render
      }

      // 3. Check if this is an audio-level change that we can handle client-side
      const audioLevelParams = ['number_sections', 'number_slots', 'binning_mode', 'amplitude_exponent', 'filter_amount'];
      const isAudioChange = changedParams.some(param => audioLevelParams.includes(param));
      
      let stateToSend = newComposition;
      
      if (isAudioChange && this._state.audio.audioSessionId) {
        const rebinnedAmplitudes = this._audioCache.rebinFromCache(
          this._state.audio.audioSessionId,
          {
            numSlots: newComposition.pattern_settings.number_slots,
            binningMode: (newComposition.audio_processing.binning_mode || 'mean_abs') as 'mean_abs' | 'min_max' | 'continuous',
            filterAmount: newComposition.audio_processing.apply_filter ? newComposition.audio_processing.filter_amount : 0,
            exponent: newComposition.pattern_settings.amplitude_exponent
          }
        );
        
        if (rebinnedAmplitudes) {
          // The rebinned amplitudes are NORMALIZED (0-1). We send them directly
          // to the backend, which will calculate the new max_amplitude_local for
          // the new geometry and perform the final scaling.
          stateToSend = {
            ...newComposition,
            processed_amplitudes: Array.from(rebinnedAmplitudes)
          };
        } else {
          return; // Abort if we can't generate valid amplitudes
        }
      } else {
            // Filter valid amplitudes first
            const validAmps = this._state.composition.processed_amplitudes.filter(
              (amp): amp is number => amp !== null && isFinite(amp)
            );
            
            // CRITICAL: For geometry changes, send NORMALIZED amplitudes (0-1 range)
            // Backend will apply the new max_amplitude_local to these normalized values
            const normalizedAmps = (() => {
              if (validAmps.length === 0) return validAmps;
              const maxAmp = Math.max(...validAmps.map(Math.abs));
              return maxAmp > 1.5 ? validAmps.map(a => a / maxAmp) : validAmps;
            })();
            
            stateToSend = {
                ...newComposition,
                processed_amplitudes: normalizedAmps,
            };
          }
      
      try {
        // 4. Make one smart API call.
        const response = await this._facade.getSmartCSGData(
          stateToSend,
          changedParams,
          this._state.audio.previousMaxAmplitude
        );

        // 5. Handle the handshake: update state FIRST, then trigger the render.
        // This is the crucial step to prevent infinite loops.

        // First, update the application state internally with the new, processed state.
        // We do this BEFORE notifying subscribers to prevent race conditions.
        // The backend is now the single source of truth for calculations.
        // We read the new max amplitude directly from the API response.
        this._state = {
          ...this._state,
          composition: response.updated_state,
          audio: { // Also update the audio tracking state
            ...this._state.audio,
            // The new "previous" is the value calculated and returned by the backend.
            previousMaxAmplitude: response.max_amplitude_local,
          },
        };

        // Manually persist the new state
        this._facade.persistState(this._state);
        
        // Now, trigger the render directly with the received CSG data.
        if (this._sceneManager) {
          await this._sceneManager.renderComposition(response);
          // Art placement applied internally by _renderCompositionInternal
        }
        
        // Update cache with user's customization
        const archetypeId = this.getActiveArchetypeId();
        if (archetypeId) {
          const backgroundId = this._getBackgroundKeyForCache(this._state.ui.currentBackground);
          const cacheKey = this._getCacheKey(archetypeId, backgroundId);
          this._compositionCache.set(cacheKey, structuredClone(response.updated_state));
        }
        
        // Finally, notify all other UI components that the state has changed.
        this.notifySubscribers();

			} catch (error: unknown) {
        console.error('[Controller] CSG generation failed, updating state locally:', error);
        
        // CRITICAL: Even if API fails, update local state so UI reflects user's selection
        this._state = {
          ...this._state,
          composition: newComposition
        };
        
        // Persist state even on API failure
        this._facade.persistState(this._state);
        
        // Notify subscribers so UI updates
        this.notifySubscribers();
      }
			
			// Refresh layout panel if geometry changed to update slider constraints
      if (this._accordion && geometryChanged) {
        this._accordion.refreshContent('layout');
      }
    } finally {
      this._isUpdatingComposition = false;
    }
  } 
 
	/**
   * Get wood materials configuration
   */
  getWoodMaterialsConfig(): WoodMaterialsConfig {
    if (!this._woodMaterialsConfig) {
      throw new Error('Wood materials config not loaded');
    }
    return this._woodMaterialsConfig;
  }
	
	public getBackgroundsConfig(): BackgroundsConfig | null {
    return this._backgroundsConfig;
  }
  
  /**
   * Select a section for material editing
   */
  selectSection(indices: Set<number>): void {
    this._selectedSectionIndices = new Set(indices);
    
    // Update section selector panel if it exists
    if (this._sectionSelectorPanel) {
      this._sectionSelectorPanel.updateSelection(indices);
    }
  }
  
  /**
   * Get currently selected section index
   */
  getSelectedSections(): Set<number> {
    return this._selectedSectionIndices;
  }
  
	/**
   * Update material for a specific section
   * FRONTEND-ONLY: Does not trigger backend CSG regeneration
   */
  updateSectionMaterial(
    sectionId: number, 
    species: string, 
    grainDirection: 'horizontal' | 'vertical' | 'angled'
  ): void {
    if (!this._state) {
      throw new Error('State not initialized');
    }
    
    // Get current section materials or create default array
    const currentMaterials = this._state.composition.frame_design.section_materials || [];
    
    // Create updated materials array immutably
    const updatedMaterials = [...currentMaterials];
    const existingIndex = updatedMaterials.findIndex(m => m.section_id === sectionId);
    
    const newMaterial = {
      section_id: sectionId,
      species: species,
      grain_direction: grainDirection
    };
    
    if (existingIndex >= 0) {
      updatedMaterials[existingIndex] = newMaterial;
    } else {
      updatedMaterials.push(newMaterial);
    }
    
    // Update state locally WITHOUT backend call
    this._state = {
      ...this._state,
      composition: {
        ...this._state.composition,
        frame_design: {
          ...this._state.composition.frame_design,
          section_materials: updatedMaterials
        }
      }
    };
    
    // Notify SceneManager to update ONLY the changed section (no CSG regeneration)
    if (this._sceneManager) {
      this._sceneManager.applySingleSectionMaterial?.(sectionId);
    }
    
    // Notify subscribers of state change
    this.notifySubscribers();
  }
  
  /**
   * Clean up controller
   */
  dispose(): void {
    this.clearTimers();
    this._subscribers.clear();
    
    if (this._state) {
      this._facade.persistState(this._state);
    }
  }
	
	public updateSectionMaterialsArray(newMaterials: Array<{section_id: number, species: string, grain_direction: string}>): void {
    // CRITICAL: Completely replace the array, don't merge with old entries
    const cleanMaterials = newMaterials.map(m => ({
      section_id: m.section_id,
      species: m.species,
      grain_direction: m.grain_direction
    }));
    
    // Update state with completely new array
    this._state.composition = {
      ...this._state.composition,
      frame_design: {
        ...this._state.composition.frame_design,
        section_materials: cleanMaterials
      }
    };
    
    this.notifySubscribers();
  }
}
```

## File: `C:\Users\paulj\WDweb\src/AudioCacheService.ts`

```typescript
/**
 * AudioCacheService - Client-side cache for raw audio samples
 * 
 * Caches the 200k normalized samples to enable instant rebinning
 * when audio-level parameters change (sections, slots, binning mode).
 * This avoids server round-trips for audio reprocessing.
 */

import { z } from 'zod';

// Schema for cached audio session
const AudioSessionSchema = z.object({
  id: z.string(),
  samples: z.instanceof(Float32Array),
  timestamp: z.number(),
  sourceFile: z.string(),
  fileHash: z.string()
}).strict();

type AudioSession = z.infer<typeof AudioSessionSchema>;

// Schema for bin parameters
const BinParametersSchema = z.object({
  numSlots: z.number().int().positive(),
  binningMode: z.enum(['mean_abs', 'min_max', 'continuous']),
  filterAmount: z.number().min(0).max(1).optional(),
  exponent: z.number().positive().optional()
}).strict();

type BinParameters = z.infer<typeof BinParametersSchema>;

export class AudioCacheService {
  // Cache storage (prefixed = OK per architecture)
  private readonly _cache: Map<string, AudioSession>;
  private readonly _maxCacheSize: number = 5; // Max sessions to keep

  constructor() {
    this._cache = new Map();
  }

  /**
   * Cache raw audio samples from initial processing
   */
  public cacheRawSamples(
    file: File,
    samples: Float32Array
  ): string {
    // Generate session ID
    const sessionId = crypto.randomUUID();
    
    // Create file hash for validation
    const fileHash = this._generateFileHash(file);
    
    // Create session object
    const session: AudioSession = {
      id: sessionId,
      samples: samples,
      timestamp: Date.now(),
      sourceFile: file.name,
      fileHash: fileHash
    };
    
    // Enforce cache size limit
    if (this._cache.size >= this._maxCacheSize) {
      // Remove oldest entry
      const oldestKey = this._findOldestSession();
      if (oldestKey) {
        this._cache.delete(oldestKey);
      }
    }
    
    // Store in cache
    this._cache.set(sessionId, session);
    
    return sessionId;
  }

  /**
   * Retrieve cached samples for a session
   */
  public getCachedSamples(sessionId: string): Float32Array | null {
    const session = this._cache.get(sessionId);
    if (!session) {
      return null;
    }
    
    // Return copy to prevent mutation
    return new Float32Array(session.samples);
  }

  /**
   * Check if session exists in cache
   */
  public hasSession(sessionId: string): boolean {
    return this._cache.has(sessionId);
  }

  /**
   * Rebin cached samples for new parameters
   * This performs the fast client-side rebinning operation
   */
  public rebinFromCache(
    sessionId: string,
    params: BinParameters
  ): Float32Array | null {
    const session = this._cache.get(sessionId);
    if (!session) {
      console.warn(`Session ${sessionId} not found in cache`);
      return null;
    }
    
    // Perform binning based on mode
    let amplitudes = this._binSamples(
      session.samples,
      params.numSlots,
      params.binningMode
    );
    
    // Apply filter if specified (MUST come before exponent)
    if (params.filterAmount && params.filterAmount > 0) {
      amplitudes = this._filterData(amplitudes, params.filterAmount);
    }
    
    // Apply exponent if specified
    if (params.exponent && params.exponent !== 1.0) {
      for (let i = 0; i < amplitudes.length; i++) {
        // Parity: Desktop does not re-normalize after power. 
        // Input is 0-1, Power keeps it 0-1.
        amplitudes[i] = Math.pow(amplitudes[i], params.exponent);
      }
      // Note: Previous re-normalization logic removed to match PyQt behavior
    }
    
    return amplitudes;
  }

  /**
   * Clear a specific session from cache
   */
  public clearSession(sessionId: string): void {
    this._cache.delete(sessionId);
  }

  /**
   * Clear all cached sessions
   */
  public clearAll(): void {
    this._cache.clear();
  }
	
  /**
   * Restores a session into the cache from persisted state.
   */
  public rehydrateCache(sessionId: string, samples: Float32Array): void {
    if (this._cache.has(sessionId)) {
      return; // Avoid re-adding if already present
    }

    const session: AudioSession = {
      id: sessionId,
      samples: samples,
      timestamp: Date.now(),
      sourceFile: 'restored-session',
      fileHash: 'restored-session'
    };

    this._cache.set(sessionId, session);
  }	

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    sessionCount: number;
    totalMemoryBytes: number;
    sessions: Array<{
      id: string;
      sourceFile: string;
      timestamp: number;
      sampleCount: number;
    }>;
  } {
    const sessions = Array.from(this._cache.values()).map(session => ({
      id: session.id,
      sourceFile: session.sourceFile,
      timestamp: session.timestamp,
      sampleCount: session.samples.length
    }));
    
    const totalMemoryBytes = sessions.reduce(
      (sum, session) => sum + (session.sampleCount * 4), // 4 bytes per Float32
      0
    );
    
    return {
      sessionCount: this._cache.size,
      totalMemoryBytes,
      sessions
    };
  }

  /**
   * Bin the raw samples according to parameters
   * Implements mean_abs, min_max, and continuous modes
   */
  private _binSamples(
    rawSamples: Float32Array,
    numSlots: number,
    binningMode: string
  ): Float32Array {
    const samplesPerSlot = Math.floor(rawSamples.length / numSlots);
    const amplitudes = new Float32Array(numSlots);
    
    for (let slotIdx = 0; slotIdx < numSlots; slotIdx++) {
      const startIdx = slotIdx * samplesPerSlot;
      const endIdx = Math.min(startIdx + samplesPerSlot, rawSamples.length);
      
      if (binningMode === 'mean_abs') {
        // Average of absolute values
        let sum = 0;
        for (let i = startIdx; i < endIdx; i++) {
          sum += Math.abs(rawSamples[i]);
        }
        amplitudes[slotIdx] = sum / (endIdx - startIdx);
        
      } else if (binningMode === 'min_max') {
        // Max absolute value in the bin
        let maxAbs = 0;
        for (let i = startIdx; i < endIdx; i++) {
          maxAbs = Math.max(maxAbs, Math.abs(rawSamples[i]));
        }
        amplitudes[slotIdx] = maxAbs;
        
      } else if (binningMode === 'continuous') {
        // RMS (Root Mean Square) for continuous representation
        let sumSquares = 0;
        for (let i = startIdx; i < endIdx; i++) {
          sumSquares += rawSamples[i] * rawSamples[i];
        }
        amplitudes[slotIdx] = Math.sqrt(sumSquares / (endIdx - startIdx));
        
      } else {
        // Default to mean_abs if unknown mode
        let sum = 0;
        for (let i = startIdx; i < endIdx; i++) {
          sum += Math.abs(rawSamples[i]);
        }
        amplitudes[slotIdx] = sum / (endIdx - startIdx);
      }
    }
    
    // Normalize to 0-1 range
    const maxAmplitude = Math.max(...amplitudes);
    if (maxAmplitude > 0) {
      for (let i = 0; i < amplitudes.length; i++) {
        amplitudes[i] = amplitudes[i] / maxAmplitude;
      }
    }
    
    return amplitudes;
  }

  /**
   * Filter data by subtracting noise floor and renormalizing.
   * Port of Python AudioProcessingService.filter_data()
   */
  private _filterData(amplitudes: Float32Array, filterAmount: number): Float32Array {
    if (amplitudes.length === 0 || filterAmount <= 0) {
      return amplitudes;
    }
    
    // Sort absolute values to find noise floor (returns new array)
    const sortedAbs = Array.from(amplitudes).map(Math.abs).sort((a, b) => a - b);
    const n = Math.max(1, Math.floor(sortedAbs.length * filterAmount));
    
    // Calculate noise floor as mean of bottom N values
    let noiseFloor = 0;
    for (let i = 0; i < n; i++) {
      noiseFloor += sortedAbs[i];
    }
    noiseFloor /= n;
    
    // Subtract noise floor and clamp to 0
    const filtered = new Float32Array(amplitudes.length);
    for (let i = 0; i < amplitudes.length; i++) {
      filtered[i] = Math.max(0, Math.abs(amplitudes[i]) - noiseFloor);
    }
    
    // Renormalize to 0-1
    const maxVal = Math.max(...filtered);
    if (maxVal > 1e-9) {
      for (let i = 0; i < filtered.length; i++) {
        filtered[i] = filtered[i] / maxVal;
      }
    }
    
    return filtered;
  }

  /**
   * Find the oldest session in cache for eviction
   */
  private _findOldestSession(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, session] of this._cache.entries()) {
      if (session.timestamp < oldestTime) {
        oldestTime = session.timestamp;
        oldestKey = key;
      }
    }
    
    return oldestKey;
  }

  /**
   * Generate a simple hash for file identification
   * (Not cryptographic, just for cache validation)
   */
  private _generateFileHash(file: File): string {
    // Simple hash based on file properties
    const str = `${file.name}_${file.size}_${file.lastModified}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }
}
```

## File: `C:\Users\paulj\WDweb\src/components/AudioSlicerPanel.ts`

```typescript
/**
 * AudioSlicerPanel.ts
 * "Pick a Moment" - Audio slicing interface for selecting audio segments
 * 
 * Architecture: Stateful component (manages audio playback state)
 * - Renders waveform visualization
 * - Provides transport controls (play, rewind, forward)
 * - Mark start/end points for slicing
 * - Exports sliced audio as WAV blob
 * - Emits AUDIO_SLICE_COMPLETE action via controller dispatch
 */

import type { PanelComponent } from '../types/PanelTypes';
import type { ApplicationController } from '../ApplicationController';

interface SliceResult {
  blob: Blob;
  startTime: number;
  endTime: number;
  duration: number;
}

interface AudioSlicerConfig {
  silenceThreshold: number;
  silenceDuration: number;
  removeSilence: boolean;
}

export class AudioSlicerPanel implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _controller: ApplicationController;
  private _config: AudioSlicerConfig;
  
  // DOM references
  private _dropZone: HTMLElement | null = null;
  private _fileInput: HTMLInputElement | null = null;
  private _canvas: HTMLCanvasElement | null = null;
  private _ctx: CanvasRenderingContext2D | null = null;
  private _playhead: HTMLElement | null = null;
  private _selectionOverlay: HTMLElement | null = null;
  private _currentTimeEl: HTMLElement | null = null;
  private _totalTimeEl: HTMLElement | null = null;
  private _markStartBtn: HTMLButtonElement | null = null;
  private _markEndBtn: HTMLButtonElement | null = null;
  private _selectionValueEl: HTMLElement | null = null;
  private _isolateCheckbox: HTMLInputElement | null = null;
  private _commitBtn: HTMLButtonElement | null = null;
  private _playBtn: HTMLButtonElement | null = null;
  private _resultPanel: HTMLElement | null = null;
  private _hintEl: HTMLElement | null = null;
	
	// V2 DOM references
  private _songLoaded: HTMLElement | null = null;
  private _songNameEl: HTMLElement | null = null;
  private _songDurationEl: HTMLElement | null = null;
  private _selectionSummary: HTMLElement | null = null;
  private _markStartBtnV2: HTMLButtonElement | null = null;
  private _markEndBtnV2: HTMLButtonElement | null = null;
  
  // Audio state
  private _audioContext: AudioContext | null = null;
  private _audioBuffer: AudioBuffer | null = null;
  private _sourceNode: AudioBufferSourceNode | null = null;
  private _isPlaying: boolean = false;
  private _playStartedAt: number = 0;
  private _pausedAt: number = 0;
  private _animationFrame: number | null = null;
	
	// Original file reference
  private _originalFile: File | null = null;
	
	// Processed audio (after Demucs)
  private _processedBuffer: AudioBuffer | null = null;
  private _isProcessing: boolean = false;
	
	// Raw vocals buffer (before silence removal)
  private _rawVocalsBuffer: AudioBuffer | null = null;
  
  // Silence params (from config)
  private _minDuration!: number;
  private _silenceThresh!: number;
  private _silenceEnabled!: boolean;
  private _isolateVocals: boolean = false;
	private _optimizationMode: 'speech' | 'music' = 'music';

  // Persisted state
  private _persistedFileName: string | null = null;
  
  // Section references (refreshed on each render)
  private _uploadSection: HTMLElement | null = null;
  private _trimmerSection: HTMLElement | null = null;
  private _enhanceSection: HTMLElement | null = null;
  
  // Selection state
  private _markStart: number | null = null;
  private _markEnd: number | null = null;
  private _markPhase: 'start' | 'end' = 'start';
	
	// Preview state
  private _isPreviewing: boolean = false;
  
  // Callback for slice completion
  private _onSliceComplete: ((result: SliceResult) => void) | null = null;

	// IndexedDB storage
  private static readonly DB_NAME = 'WaveDesignerAudio';
  private static readonly DB_VERSION = 1;
  private static readonly STORE_NAME = 'audioFiles';
  
  private async _openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(AudioSlicerPanel.DB_NAME, AudioSlicerPanel.DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(AudioSlicerPanel.STORE_NAME)) {
          db.createObjectStore(AudioSlicerPanel.STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }
  
  private async _saveAudioToStorage(file: File): Promise<boolean> {
    try {
      // Check available storage
      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        const available = (estimate.quota || 0) - (estimate.usage || 0);
        if (file.size > available * 0.8) {
          console.warn('[AudioSlicerPanel] Insufficient storage for audio file');
          return false;
        }
      }
      
      const db = await this._openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(AudioSlicerPanel.STORE_NAME, 'readwrite');
        const store = tx.objectStore(AudioSlicerPanel.STORE_NAME);
        
        store.put({
          id: 'currentAudio',
          file: file,
          fileName: file.name,
          savedAt: Date.now()
        });
        
        tx.oncomplete = () => {
          console.log('[AudioSlicerPanel] Audio saved to IndexedDB');
          db.close();
          resolve(true);
        };
        tx.onerror = () => {
          console.error('[AudioSlicerPanel] Failed to save audio:', tx.error);
          db.close();
          resolve(false);
        };
      });
    } catch (error) {
      console.error('[AudioSlicerPanel] IndexedDB error:', error);
      return false;
    }
  }
  
  private async _loadAudioFromStorage(): Promise<File | null> {
    try {
      const db = await this._openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(AudioSlicerPanel.STORE_NAME, 'readonly');
        const store = tx.objectStore(AudioSlicerPanel.STORE_NAME);
        const request = store.get('currentAudio');
        
        request.onsuccess = () => {
          db.close();
          if (request.result?.file) {
            console.log('[AudioSlicerPanel] Audio restored from IndexedDB');
            resolve(request.result.file);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => {
          db.close();
          resolve(null);
        };
      });
    } catch (error) {
      console.error('[AudioSlicerPanel] IndexedDB load error:', error);
      return null;
    }
  }
  
  private async _clearAudioStorage(): Promise<void> {
    try {
      const db = await this._openDB();
      const tx = db.transaction(AudioSlicerPanel.STORE_NAME, 'readwrite');
      const store = tx.objectStore(AudioSlicerPanel.STORE_NAME);
      store.delete('currentAudio');
      tx.oncomplete = () => db.close();
    } catch (error) {
      console.error('[AudioSlicerPanel] IndexedDB clear error:', error);
    }
  }

	private async _attemptAudioRestore(): Promise<void> {
    const file = await this._loadAudioFromStorage();
    
    if (file) {
      // Verify filename matches persisted state
      if (file.name === this._persistedFileName) {
        // Read persisted state BEFORE loading (loadFile overwrites it)
        const state = this._controller.getState();
        const src = state?.composition?.audio_source;
        const persistedStart = src?.start_time;
        const persistedEnd = src?.end_time;
        const needsVocals = src?.use_stems || false;
        
        // Load file without auto-commit
        await this._loadFile(file, true);
        
        // Restore slice and demucs state from saved values
        if (persistedStart !== undefined && persistedEnd !== undefined) {
        this._markStart = persistedStart;
          this._markEnd = persistedEnd;
          this._updateSelection();
          this._updateMarkButtonsV2();
        }
        
        // Restore vocals toggle state
        this._isolateVocals = needsVocals;
        
        // Update checkbox if trimmer section exists
        const checkbox = this._trimmerSection?.querySelector('.slicer-isolate-checkbox') as HTMLInputElement;
        if (checkbox) checkbox.checked = needsVocals;
        
        // Do NOT auto-process vocals on restore.
        // Composition is already valid from localStorage - artwork already rendered.
        // Demucs is expensive (30+ seconds); only run when user explicitly requests.
        
        // Do NOT call _handleCommit() here.
        // Global state is already correct from localStorage.
        // Committing would trigger backend processing that resets section_materials.
        return;
      } else {
        // Stale data, clear it
        await this._clearAudioStorage();
      }
    }
    
    // Restore failed - show re-upload prompt
    this._showReuploadPrompt();
  }
  
  private _showReuploadPrompt(): void {
    if (!this._uploadSection) return;
    
    // Update drop zone text to indicate re-upload needed
    const dropText = this._uploadSection.querySelector('.slicer-drop-text');
    const dropHint = this._uploadSection.querySelector('.slicer-drop-hint');
    
    if (dropText) dropText.textContent = 'Re-upload Your Song';
    if (dropHint) {
      dropHint.textContent = 'Your previous session expired. Please upload again to continue editing.';
      (dropHint as HTMLElement).style.color = '#c0392b';
    }
    
    // Ensure drop zone is visible
    this._dropZone?.classList.remove('hidden');
    this._songLoaded?.classList.remove('visible');
  }
  
  constructor(
    controller: ApplicationController,
    config?: Partial<AudioSlicerConfig>,
    onSliceComplete?: (result: SliceResult) => void
  ) {
    this._controller = controller;
    if (!config || config.silenceThreshold === undefined || config.silenceDuration === undefined) {
      throw new Error('[AudioSlicerPanel] Config missing required audio_processing values - check composition_defaults.json');
    }
    this._config = {
      silenceThreshold: config.silenceThreshold,
      silenceDuration: config.silenceDuration,
      removeSilence: config.removeSilence ?? false
    };
    this._silenceThresh = this._config.silenceThreshold;
    this._minDuration = this._config.silenceDuration;
    this._silenceEnabled = this._config.removeSilence;
    this._onSliceComplete = onSliceComplete || null;
    
    // Restore state from composition if available
    const state = controller.getState();
    if (state?.composition?.audio_source) {
      const src = state.composition.audio_source;
      if (src.start_time > 0 || src.end_time > 0) {
        this._markStart = src.start_time;
        this._markEnd = src.end_time;
      }
      this._isolateVocals = src.use_stems || false;
      this._persistedFileName = src.source_file || null;
    }
    if (state?.composition?.audio_processing) {
      this._silenceEnabled = state.composition.audio_processing.remove_silence || false;
    }
  }
  
  /**
   * Restore Upload Section UI based on persisted state
   */
  private _restoreUploadState(): void {
    const fileName = this._originalFile?.name || this._persistedFileName;
    const isLoaded = !!this._audioBuffer || !!this._persistedFileName;

    if (isLoaded && fileName) {
      this._dropZone?.classList.add('hidden');
      this._songLoaded?.classList.add('visible');
      
      if (this._songNameEl) this._songNameEl.textContent = fileName;
      
      if (this._songDurationEl) {
        const durationText = this._audioBuffer 
          ? this._formatTime(this._audioBuffer.duration) 
          : '--:--';
        this._songDurationEl.textContent = `${durationText} · ${this._audioBuffer ? 'Ready' : 'Re-upload to Edit'}`;
      }
    }
  }

  /**
   * Invalidate L3 (Vocals) and L4 (Processed) buffers.
   * Called when L1 (Source) or L2 (Trim) changes.
   */
  private _invalidateGeneratedBuffers(): void {
    if (this._rawVocalsBuffer || this._processedBuffer) {
      console.log('[AudioSlicerPanel] Invalidating cached buffers');
      this._rawVocalsBuffer = null;
      this._processedBuffer = null;
    }
  }

  private _persistTrimState(): void {
    if (this._markStart !== null && this._markEnd !== null) {
      this._controller.updateAudioSourceState({
        start_time: Math.min(this._markStart, this._markEnd),
        end_time: Math.max(this._markStart, this._markEnd)
      });
    }
  }

  private _persistToggleState(): void {
    this._controller.updateAudioSourceState({
      use_stems: this._isolateVocals
    });
    this._controller.updateAudioProcessingState({
      remove_silence: this._silenceEnabled
    });
  }
	
	renderTrimmerSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'audio-slicer-trimmer-section';
    this._trimmerSection = section;
    section.innerHTML = `
      <div class="slicer-section-header">
        <span class="slicer-section-number">1</span>
        <div class="slicer-section-text">
          <div class="slicer-section-title">Select part of the audio</div>
          <div class="slicer-section-desc">Listen, then tap to mark your selection</div>
        </div>
      </div>
      
      <div class="slicer-waveform-row">
        <button class="slicer-skip-btn slicer-btn-rewind" title="Rewind 5 seconds">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
          <span>5s</span>
        </button>
        
        <div class="slicer-waveform-wrap">
          <canvas class="slicer-waveform"></canvas>
          <div class="slicer-playhead"></div>
          <div class="slicer-selection">
            <div class="slicer-handle slicer-handle-start"></div>
            <div class="slicer-handle slicer-handle-end"></div>
          </div>
        </div>
        
        <button class="slicer-skip-btn slicer-btn-forward" title="Forward 5 seconds">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/></svg>
          <span>5s</span>
        </button>
      </div>
      
      <div class="slicer-transport">
        <span class="slicer-time slicer-time-current">0:00</span>
        <span class="slicer-time-separator">/</span>
        <span class="slicer-time slicer-time-total">0:00</span>
      </div>
      
      <div class="slicer-controls-row">
        <button class="slicer-play-btn" data-demo-id="slicer_play" title="Play selection">
          <svg class="slicer-play-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          <svg class="slicer-pause-icon" viewBox="0 0 24 24" fill="currentColor" style="display:none;"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        </button>
        <button class="slicer-mark-btn slicer-btn-mark-start" data-demo-id="slicer_start">
          <span class="slicer-mark-btn-label">Start Here</span>
          <span class="slicer-mark-btn-time">—</span>
        </button>
        <button class="slicer-mark-btn slicer-btn-mark-end" data-demo-id="slicer_end">
          <span class="slicer-mark-btn-label">End Here</span>
          <span class="slicer-mark-btn-time">—</span>
        </button>
        <button class="slicer-btn-reset" title="Reset to full song">Reset</button>
      </div>
      
      <div class="slicer-section-header">
        <span class="slicer-section-number">2</span>
        <div class="slicer-section-text">
          <div class="slicer-section-title">Isolate the Vocals <span class="slicer-vocals-status"></span></div>
          <div class="slicer-section-desc">Removes background music</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" class="slicer-isolate-checkbox" ${this._isolateVocals ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
      
      <input type="hidden" class="slicer-min-duration" value="${this._minDuration}">
      <input type="hidden" class="slicer-silence-thresh" value="${this._silenceThresh}">
      
      <div class="slicer-optimize-section">
        <div class="slicer-section-header" style="padding-bottom:8px;">
          <span class="slicer-section-number">3</span>
          <div class="slicer-section-text">
            <div class="slicer-section-title">Optimize for Visual Impact</div>
            <div class="slicer-section-desc">Auto-adjust settings for best carving results</div>
          </div>
        </div>
        <div class="slicer-optimize-controls">
          <label class="slicer-radio"><input type="radio" name="opt-mode" value="music" checked> Music</label>
          <label class="slicer-radio"><input type="radio" name="opt-mode" value="speech"> Speech</label>
          <button class="slicer-btn-optimize">Auto-Optimize</button>
          <span class="slicer-optimize-status"></span>
        </div>
      </div>
      
      <div class="slicer-cta-footer">
        <button class="slicer-btn-primary slicer-btn-apply" style="flex:1;">Apply To Artwork</button>
      </div>
    `;
    this._cacheTrimmerElements(section);
    this._attachTrimmerListeners(section);
    this._restoreTrimmerState();
    
    // Attempt to restore audio from IndexedDB if not already loaded
    if (!this._audioBuffer && this._persistedFileName) {
      void this._attemptAudioRestore();
    }
    
    return section;
  }

	
	renderUploadSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'audio-slicer-upload-section';
    this._uploadSection = section;
    section.innerHTML = `
      <div class="slicer-drop-zone" data-demo-id="slicer_drop">
        <div class="upload-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <p class="slicer-drop-text">Tap to Choose Your Song</p>
        <p class="slicer-drop-hint">or drag and drop your file here</p>
        <input type="file" class="slicer-file-input" accept="audio/*">
      </div>
      
      <div class="slicer-song-loaded">
        <div class="slicer-song-artwork">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
        </div>
        <div class="slicer-song-info">
          <div class="slicer-song-name"></div>
          <div class="slicer-song-duration"></div>
        </div>
        <button class="slicer-song-change">Change</button>
      </div>
    `;
    this._cacheUploadElements(section);
    this._attachUploadListeners(section);
    this._restoreUploadState();
    
    // Attempt to restore audio from IndexedDB if not already loaded
    if (!this._audioBuffer) {
      void this._attemptAudioRestore();
    }
    
    return section;
  }
	
	private _attachUploadListeners(section: HTMLElement): void {
    this._dropZone?.addEventListener('click', () => this._fileInput?.click());
    this._dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      this._dropZone?.classList.add('dragover');
    });
    this._dropZone?.addEventListener('dragleave', () => {
      this._dropZone?.classList.remove('dragover');
    });
    this._dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      this._dropZone?.classList.remove('dragover');
      const file = (e as DragEvent).dataTransfer?.files[0];
      if (file) this._loadFile(file);
    });
    this._fileInput?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) this._loadFile(file);
    });
    section.querySelector('.slicer-song-change')?.addEventListener('click', () => {
      this._resetToUpload();
    });
  }

  private _attachTrimmerListeners(section: HTMLElement): void {
    this._attachHandleDrag(section);
    section.querySelector('.slicer-play-btn')?.addEventListener('click', () => this._togglePlayback());
    section.querySelector('.slicer-btn-rewind')?.addEventListener('click', () => this._seek(-5));
    section.querySelector('.slicer-btn-forward')?.addEventListener('click', () => this._seek(5));
    section.querySelector('.slicer-btn-mark-start')?.addEventListener('click', () => this._handleMarkStart());
    section.querySelector('.slicer-btn-mark-end')?.addEventListener('click', () => this._handleMarkEnd());
    section.querySelector('.slicer-btn-reset')?.addEventListener('click', () => this._resetToFullTrack());
    section.querySelector('.slicer-isolate-checkbox')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this._isolateVocals = checked;
      this._persistToggleState();
      
      // Process vocals if enabled and not already cached
      if (checked && !this._rawVocalsBuffer && this._audioBuffer && this._originalFile) {
        void this._processVocals();
      }
    });
    section.querySelector('.slicer-btn-apply')?.addEventListener('click', () => this._handleCommit());
    
    // Optimization controls
    section.querySelectorAll('input[name="opt-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this._optimizationMode = (e.target as HTMLInputElement).value as 'speech' | 'music';
      });
    });
    section.querySelector('.slicer-btn-optimize')?.addEventListener('click', () => this._runOptimization());
    
    window.addEventListener('resize', this._handleResize);
  }
	
	/**
   * Get enhancements summary for accordion header display
   */
  public getEnhancementsDisplay(): string | null {
    const vocals = this._isolateVocals;
    const silence = this._silenceEnabled;
    
    if (!vocals && !silence) return null;
    
    const parts: string[] = [];
    if (vocals) parts.push('Vocals');
    if (silence) parts.push('Cleaned');
    return parts.join(', ');
  }
	
	/**
   * Get selection time range for accordion header display
   */
  public getSelectionDisplay(): string | null {
    if (this._markStart === null || this._markEnd === null) return null;
    const start = Math.min(this._markStart, this._markEnd);
    const end = Math.max(this._markStart, this._markEnd);
    return `${this._formatTime(start)} → ${this._formatTime(end)}`;
  }
	
	/**
   * Get loaded filename for accordion header display
   */
  public getLoadedFilename(): string | null {
    return this._originalFile?.name || this._persistedFileName;
  }

  private _attachEnhanceListeners(section: HTMLElement): void {
    section.querySelector('#toggle-vocals .toggle-switch input')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this._isolateVocals = checked;
      const card = section.querySelector('#toggle-vocals');
      card?.classList.toggle('active', checked);
      // Show/hide preview row
      const previewRow = section.querySelector('.slicer-vocals-preview');
      previewRow?.classList.toggle('visible', checked);
      this._controller.updateAudioAccordionValue('demucs');
      this._persistToggleState();
    });
    
    section.querySelector('.slicer-btn-vocals-preview')?.addEventListener('click', () => {
      void this._previewVocals(section);
    });
    section.querySelector('#toggle-silence .toggle-switch input')?.addEventListener('change', (e) => {
      const card = section.querySelector('#toggle-silence');
      const checked = (e.target as HTMLInputElement).checked;
      card?.classList.toggle('active', checked);
      this._silenceEnabled = checked;
      this._controller.updateAudioAccordionValue('demucs');
      this._persistToggleState();
      
      // Auto-process silence removal if enabled and vocals buffer exists
      if (checked && this._rawVocalsBuffer && !this._processedBuffer) {
        void this._processSilenceRemoval(section);
      }
    });
    this._commitBtn?.addEventListener('click', () => this._handleCommit());
  }
  
  private async _runOptimization(): Promise<void> {
    if (!this._originalFile) return;
    
    const statusEl = this._trimmerSection?.querySelector('.slicer-optimize-status') as HTMLElement;
    const btn = this._trimmerSection?.querySelector('.slicer-btn-optimize') as HTMLButtonElement;
    
    if (statusEl) statusEl.textContent = 'Analyzing...';
    if (btn) btn.disabled = true;
    
    const formData = new FormData();
    formData.append('file', this._originalFile);
    formData.append('mode', this._optimizationMode);
    formData.append('num_slots', String(this._controller.getState()?.composition.pattern_settings.number_slots || 48));
    
    try {
      const response = await fetch('/api/audio/optimize', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error(`${response.status}`);
      
      const result = await response.json();
      
      // 1. Get optimized composition DTO (Pure, no state mutation yet)
      const optimizedComposition = this._controller.createOptimizedComposition(result);
      
      if (optimizedComposition) {
        // 2. Pass to main pipeline
        // This ensures detectChangedParams sees the difference in exponent/filter settings,
        // triggering logic which handles cache rebinning AND backend scaling.
        await this._controller.handleCompositionUpdate(optimizedComposition);
      }
      
      if (statusEl) {
        statusEl.textContent = result.status === 'fallback' 
          ? `⚠ ${result.exponent}` 
          : `✓ ${result.exponent}`;
        statusEl.className = `slicer-optimize-status ${result.status}`;
      }
    } catch (error) {
      console.error('[AudioSlicerPanel] Optimization failed:', error);
      if (statusEl) {
        statusEl.textContent = '✗ Error';
        statusEl.className = 'slicer-optimize-status error';
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }
	
	private _cacheEnhanceElements(section: HTMLElement): void {
    this._isolateCheckbox = section.querySelector('.slicer-isolate-checkbox') as HTMLInputElement;
    this._commitBtn = section.querySelector('.slicer-btn-commit');
  }
	
	private _cacheTrimmerElements(section: HTMLElement): void {
    this._canvas = section.querySelector('.slicer-waveform');
    this._ctx = this._canvas?.getContext('2d') || null;
    this._playhead = section.querySelector('.slicer-playhead');
    this._playBtn = section.querySelector('.slicer-play-btn');
    this._currentTimeEl = section.querySelector('.slicer-time-current');
    this._totalTimeEl = section.querySelector('.slicer-time-total');
    this._selectionOverlay = section.querySelector('.slicer-selection');
    this._markStartBtn = section.querySelector('.slicer-btn-mark-start');
    this._markEndBtn = section.querySelector('.slicer-btn-mark-end');
    this._selectionSummary = section.querySelector('.slicer-selection-summary');
  }
	
	private _restoreEnhanceState(): void {
    const section = this._isolateCheckbox?.closest('.audio-slicer-enhance-section');
    if (!section) return;
    
    // Restore vocals toggle card state
    const vocalsCard = section.querySelector('#toggle-vocals');
    if (vocalsCard && this._isolateVocals) {
      vocalsCard.classList.add('active');
    }
    
    // Restore silence toggle card state
    const silenceCard = section.querySelector('#toggle-silence');
    if (silenceCard && this._silenceEnabled) {
      silenceCard.classList.add('active');
    }
  }
	
	private _restoreTrimmerState(): void {
    // Restore total time
    if (this._audioBuffer && this._totalTimeEl) {
      this._totalTimeEl.textContent = this._formatTime(this._audioBuffer.duration);
    }
    
    // Draw waveform if audio loaded
    if (this._audioBuffer) {
      requestAnimationFrame(() => this._drawWaveform());
    }
    
    // Restore slice and demucs state from composition if not already set
    const state = this._controller.getState();
    if (state?.composition?.audio_source) {
      const src = state.composition.audio_source;
      
      // Restore slice markers if audio loaded and marks at default
      if (this._audioBuffer && src.start_time !== undefined && src.end_time !== undefined) {
        const isFullTrack = this._markStart === 0 && this._markEnd === this._audioBuffer.duration;
        const hasPersistedSlice = src.start_time !== 0 || src.end_time !== this._audioBuffer.duration;
        
        if (isFullTrack && hasPersistedSlice) {
          this._markStart = src.start_time;
          this._markEnd = src.end_time;
        }
      }
      
      // Restore vocals toggle
      if (src.use_stems !== undefined) {
        this._isolateVocals = src.use_stems;
        const checkbox = this._trimmerSection?.querySelector('.slicer-isolate-checkbox') as HTMLInputElement;
        if (checkbox) checkbox.checked = this._isolateVocals;
      }
    }
    
    // Restore mark times
    this._updateMarkButtonsV2();
    
    // Restore selection overlay
    this._updateSelection();
    
    // Restore selection summary
    this._updateSelectionSummary();
    
    // Ensure controls are enabled if audio exists
    this._updateCommitButton();
  }
	
	private _restoreUploadState(): void {
    if (this._audioBuffer && this._originalFile) {
      this._dropZone?.classList.add('hidden');
      this._songLoaded?.classList.add('visible');
      if (this._songNameEl) this._songNameEl.textContent = this._originalFile.name;
      if (this._songDurationEl) this._songDurationEl.textContent = `${this._formatTime(this._audioBuffer.duration)} · Ready`;
    }
  }
	
	private _cacheUploadElements(section: HTMLElement): void {
    this._dropZone = section.querySelector('.slicer-drop-zone');
    this._fileInput = section.querySelector('.slicer-file-input');
    this._songLoaded = section.querySelector('.slicer-song-loaded');
    this._songNameEl = section.querySelector('.slicer-song-name');
    this._songDurationEl = section.querySelector('.slicer-song-duration');
  }
  
  private _handleResize = (): void => {
    if (this._audioBuffer) this._drawWaveform();
  };
	
	private _attachHandleDrag(section: HTMLElement): void {
    const wrap = section.querySelector('.slicer-waveform-wrap') as HTMLElement;
    const startHandle = section.querySelector('.slicer-handle-start') as HTMLElement;
    const endHandle = section.querySelector('.slicer-handle-end') as HTMLElement;
    if (!wrap || !startHandle || !endHandle) return;

    const onDrag = (e: MouseEvent | TouchEvent, isStart: boolean) => {
      if (!this._audioBuffer) return;
      const rect = wrap.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const time = pct * this._audioBuffer.duration;
      if (isStart) {
        this._markStart = time;
      } else {
        this._markEnd = time;
      }
      this._invalidateGeneratedBuffers();
      // Clear vocals status since buffer is now stale
      const statusEl = this._trimmerSection?.querySelector('.slicer-vocals-status');
      if (statusEl) statusEl.textContent = '';
      this._updateSelection();
      this._updateMarkButtonsV2();
      this._updateSelectionSummary();
    };

    const attach = (handle: HTMLElement, isStart: boolean) => {
      const onMove = (e: MouseEvent | TouchEvent) => onDrag(e, isStart);
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
        this._persistTrimState();
      };
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
      handle.addEventListener('touchstart', (e) => {
        e.preventDefault();
        document.addEventListener('touchmove', onMove);
        document.addEventListener('touchend', onUp);
      });
    };
    attach(startHandle, true);
    attach(endHandle, false);
  }
  
  private _initAudioContext(): void {
    if (!this._audioContext) {
      this._audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }
  
  private async _loadFile(file: File, skipAutoCommit: boolean = false): Promise<void> {
    this._initAudioContext();
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      this._audioBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);
			this._originalFile = file;
      
      // Update UI
      this._dropZone?.classList.add('hidden');
      this._songLoaded?.classList.add('visible');
      
      // Update song loaded display
      if (this._songNameEl) this._songNameEl.textContent = file.name;
      if (this._songDurationEl) this._songDurationEl.textContent = `${this._formatTime(this._audioBuffer.duration)} · Ready`;
      
      // Show song footer with buttons
      const songFooter = this._container?.querySelector('.slicer-song-footer') as HTMLElement;
      if (songFooter) songFooter.style.display = 'flex';
      
      // Update accordion subtitle
      const songSubtitle = this._container?.querySelector('.slicer-song-subtitle');
      if (songSubtitle) songSubtitle.textContent = file.name;
      
      if (this._totalTimeEl) {
        this._totalTimeEl.textContent = this._formatTime(this._audioBuffer.duration);
      }
      
      this._resetState(skipAutoCommit);
      // Initialize selection to full track so handles are visible
      this._markStart = 0;
      this._markEnd = this._audioBuffer.duration;
      this._updateCommitButton();
      this._drawWaveform();
      this._updateSelection();
      this._updateMarkButtonsV2();
      this._controller.updateAudioAccordionValue('custom');
      
      // Only update state with defaults on fresh upload, not restore
      if (!skipAutoCommit) {
        this._controller.updateAudioSourceState({
          source_file: file.name,
          start_time: 0,
          end_time: this._audioBuffer!.duration
        });
        
        // Save to IndexedDB for persistence across refresh
        void this._saveAudioToStorage(file);
        
        // Auto-commit: immediately process audio after upload
        this._handleCommit();
      }
      
    } catch (err) {
      console.error('[AudioSlicerPanel] Decode error:', err);
      // Could dispatch error action here
    }
  }
  
  private _drawWaveform(): void {
    if (!this._canvas || !this._ctx || !this._audioBuffer) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = this._canvas.getBoundingClientRect();
    this._canvas.width = rect.width * dpr;
    this._canvas.height = rect.height * dpr;
    this._ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    const data = this._audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;
    
    // Read colors from CSS variables
    const styles = getComputedStyle(document.documentElement);
    const bgColor = styles.getPropertyValue('--color-background-secondary').trim() || '244, 244, 244';
    const waveColor = styles.getPropertyValue('--color-foreground-secondary').trim() || '105, 105, 105';
    
    // Background
    this._ctx.fillStyle = `rgb(${bgColor})`;
    this._ctx.fillRect(0, 0, width, height);
    
    // Waveform using RMS for better visual differentiation
    this._ctx.fillStyle = `rgb(${waveColor})`;
    
    for (let i = 0; i < width; i++) {
      // Calculate RMS (root mean square) for this slice
      let sumSquares = 0;
      for (let j = 0; j < step; j++) {
        const v = data[i * step + j] || 0;
        sumSquares += v * v;
      }
      const rms = Math.sqrt(sumSquares / step);
      
      // Scale RMS to visible height (RMS of full-scale sine is ~0.707)
      const barH = Math.max(1, rms * amp * 4.5);
      this._ctx.fillRect(i, amp - barH / 2, 1, barH);
    }
  }
  
  private _formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
  
  private _getCurrentTime(): number {
    if (!this._audioContext) return this._pausedAt;
    return this._isPlaying
      ? this._pausedAt + (this._audioContext.currentTime - this._playStartedAt)
      : this._pausedAt;
  }
  
  private _togglePlayback(): void {
    this._initAudioContext();
    if (this._isPlaying) {
      this._stop();
    } else {
      this._play();
    }
  }
  
  private _play(): void {
    if (!this._audioBuffer || !this._audioContext) return;
    
    // Stop any existing playback first
    this._stopAll();
    
    // Use vocals buffer if stem separation enabled and available
    const buffer = (this._isolateVocals && this._rawVocalsBuffer) 
      ? this._rawVocalsBuffer 
      : this._audioBuffer;
    
    // Determine selection bounds
    // When using vocals buffer, it's already sliced - play full buffer
    const isUsingVocals = this._isolateVocals && !!this._rawVocalsBuffer;
    const startTime = isUsingVocals ? 0 : (this._markStart ?? 0);
    const endTime = isUsingVocals ? buffer.duration : (this._markEnd ?? buffer.duration);
    const selectionStart = Math.min(startTime, endTime);
    const selectionEnd = Math.max(startTime, endTime);
    
    // Reset pausedAt if it's outside valid range for current buffer
    if (this._pausedAt < selectionStart || this._pausedAt >= selectionEnd) {
      this._pausedAt = selectionStart;
    }
    
    // Start from selection start, or paused position if within selection
    let offset = selectionStart;
    if (this._pausedAt >= selectionStart && this._pausedAt < selectionEnd) {
      offset = this._pausedAt;
    }
    
    this._sourceNode = this._audioContext.createBufferSource();
    this._sourceNode.buffer = buffer;
    this._sourceNode.connect(this._audioContext.destination);
    this._sourceNode.start(0, offset, selectionEnd - offset);
    
    this._pausedAt = offset;
    this._playStartedAt = this._audioContext.currentTime;
    this._isPlaying = true;
    this._playhead?.classList.add('visible');
    
    if (this._markStartBtn) this._markStartBtn.disabled = false;
    if (this._markEndBtn) this._markEndBtn.disabled = false;
    
    // Toggle play/pause icons
    const section = this._trimmerSection || this._container;
    const playBtn = section?.querySelector('.slicer-play-btn');
    const playIcon = playBtn?.querySelector('.slicer-play-icon') as HTMLElement;
    const pauseIcon = playBtn?.querySelector('.slicer-pause-icon') as HTMLElement;
    if (playIcon) playIcon.style.display = 'none';
    if (pauseIcon) pauseIcon.style.display = '';
    playBtn?.classList.add('playing');
    
    this._sourceNode.onended = () => {
      if (this._isPlaying) this._stop();
    };
    
    this._updatePlayhead();
  }
  
  private _stop(): void {
    if (this._sourceNode) {
      this._sourceNode.onended = null;
      this._sourceNode.stop();
      this._sourceNode.disconnect();
      this._sourceNode = null;
    }
    
    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }
    
    this._pausedAt = this._getCurrentTime();
    if (this._audioBuffer && this._pausedAt >= this._audioBuffer.duration) {
      this._pausedAt = 0;
    }
    
    this._isPlaying = false;
    
    // Toggle play/pause icons (check both _trimmerSection and _container)
    const section = this._trimmerSection || this._container;
    const playBtn = section?.querySelector('.slicer-play-btn');
    const playIcon = playBtn?.querySelector('.slicer-play-icon') as HTMLElement;
    const pauseIcon = playBtn?.querySelector('.slicer-pause-icon') as HTMLElement;
    if (playIcon) playIcon.style.display = '';
    if (pauseIcon) pauseIcon.style.display = 'none';
    playBtn?.classList.remove('playing');
    
    if (this._currentTimeEl) this._currentTimeEl.textContent = this._formatTime(this._pausedAt);
  }
  
  private _seek(delta: number): void {
    if (!this._audioBuffer) return;
    
    const wasPlaying = this._isPlaying;
    if (wasPlaying) this._stop();
    
    this._pausedAt = Math.max(0, Math.min(this._pausedAt + delta, this._audioBuffer.duration));
    if (this._currentTimeEl) this._currentTimeEl.textContent = this._formatTime(this._pausedAt);
    this._updatePlayheadPosition();
    
    if (wasPlaying) this._play();
  }
  
  private _updatePlayhead(): void {
    const t = this._getCurrentTime();
    this._updatePlayheadPosition();
    if (this._currentTimeEl) this._currentTimeEl.textContent = this._formatTime(t);
    
    // Determine selection end (default to full track)
    const startTime = this._markStart ?? 0;
    const endTime = this._markEnd ?? (this._audioBuffer?.duration ?? 0);
    const selectionEnd = Math.max(startTime, endTime);
    
    if (this._isPlaying && this._audioBuffer && t < selectionEnd) {
      this._animationFrame = requestAnimationFrame(() => this._updatePlayhead());
    } else if (this._audioBuffer && t >= selectionEnd) {
      this._stop();
    }
  }
  
  private _updatePlayheadPosition(): void {
    if (!this._playhead || !this._audioBuffer) return;
    const t = this._getCurrentTime();
    
    // When playing vocals buffer, map position to selection range visually
    const isUsingVocals = this._isolateVocals && !!this._rawVocalsBuffer;
    let pct: number;
    
    if (isUsingVocals && this._markStart !== null && this._markEnd !== null) {
      // Map vocals time (0 to vocalsBuffer.duration) to selection range
      const selectionStart = Math.min(this._markStart, this._markEnd);
      const selectionEnd = Math.max(this._markStart, this._markEnd);
      const selectionDuration = selectionEnd - selectionStart;
      const visualTime = selectionStart + (t / this._rawVocalsBuffer!.duration) * selectionDuration;
      pct = (visualTime / this._audioBuffer.duration) * 100;
    } else {
      pct = (t / this._audioBuffer.duration) * 100;
    }
    
    this._playhead.style.left = `${pct}%`;
  }
  
  private _handleMarkStart(): void {
    this._markStart = this._getCurrentTime();
    this._invalidateGeneratedBuffers();
    this._updateSelectionDisplay();
    this._updateSelection();
    this._updateCommitButton();
    this._updateMarkButtonsV2();
    this._updateSelectionSummary();
    this._controller.updateAudioAccordionValue('slicing');
    this._persistTrimState();
  }
  
  private _handleMarkEnd(): void {
    this._markEnd = this._getCurrentTime();
    this._stop();
    
    // Ensure start < end
    if (this._markStart !== null && this._markEnd < this._markStart) {
      [this._markStart, this._markEnd] = [this._markEnd, this._markStart];
    }
    
    this._invalidateGeneratedBuffers();
    this._updateSelectionDisplay();
    this._updateSelection();
    this._updateCommitButton();
    this._updateMarkButtonsV2();
    this._updateSelectionSummary();
    this._controller.updateAudioAccordionValue('slicing');
    this._persistTrimState();
  }
  
  private _updateSelectionDisplay(): void {
    if (!this._selectionValueEl) return;
    
    if (this._markStart !== null && this._markEnd !== null) {
      const duration = Math.round(this._markEnd - this._markStart);
      this._selectionValueEl.textContent = `${this._formatTime(this._markStart)} → ${this._formatTime(this._markEnd)} (${duration}s)`;
    } else if (this._markStart !== null) {
      this._selectionValueEl.textContent = `${this._formatTime(this._markStart)} → ...`;
    } else {
      this._selectionValueEl.textContent = 'Full track';
    }
  }
  
  private _updateCommitButton(): void {
    if (!this._commitBtn) return;
    this._commitBtn.disabled = !this._audioBuffer;
    
    if (this._markStartBtn) this._markStartBtn.disabled = !this._audioBuffer;
    if (this._markEndBtn) this._markEndBtn.disabled = !this._audioBuffer;
    
    const previewBtn = this._container?.querySelector('.slicer-btn-preview') as HTMLButtonElement;
    const redoBtn = this._container?.querySelector('.slicer-btn-redo') as HTMLButtonElement;
    if (previewBtn) previewBtn.disabled = !this._audioBuffer;
    if (redoBtn) redoBtn.disabled = this._markStart === null && this._markEnd === null;
  }
  
  private _redo(): void {
    this._markStart = null;
    this._markEnd = null;
    this._processedBuffer = null;
    this._updateSelectionDisplay();
    this._updateSelection();
    this._updateCommitButton();
  }
  
  private _updateSelection(): void {
    if (!this._selectionOverlay || !this._audioBuffer) return;
    
    if (this._markStart === null) {
      this._selectionOverlay.classList.remove('visible');
      return;
    }
    
    const start = this._markEnd !== null ? Math.min(this._markStart, this._markEnd) : this._markStart;
    const end = this._markEnd !== null ? Math.max(this._markStart, this._markEnd) : start;
    
    const leftPct = (start / this._audioBuffer.duration) * 100;
    const widthPct = ((end - start) / this._audioBuffer.duration) * 100;
    
    this._selectionOverlay.style.left = `${leftPct}%`;
    this._selectionOverlay.style.width = `${Math.max(0.5, widthPct)}%`;
    this._selectionOverlay.classList.add('visible');
  }
  
  private _showResult(): void {
    if (this._markStart === null || this._markEnd === null) return;
    
    // Hide mark row, show result
    const markRow = this._container?.querySelector('.slicer-mark-row') as HTMLElement;
    if (markRow) markRow.style.display = 'none';
    if (this._hintEl) this._hintEl.style.display = 'none';
    
    // Update result display
    const startEl = this._container?.querySelector('.slicer-result-start');
    const endEl = this._container?.querySelector('.slicer-result-end');
    const secondsEl = this._container?.querySelector('.slicer-result-seconds');
    
    if (startEl) startEl.textContent = this._formatTime(this._markStart);
    if (endEl) endEl.textContent = this._formatTime(this._markEnd);
    if (secondsEl) secondsEl.textContent = Math.round(this._markEnd - this._markStart).toString();
    
    this._updateSelection();
    this._resultPanel?.classList.add('visible');
  }
  
  private async _preview(): Promise<void> {
    if (!this._audioBuffer) return;
    
    const previewBtn = this._container?.querySelector('.slicer-preview-row .slicer-btn-preview') as HTMLButtonElement;
    
    // Toggle off if already previewing
    if (this._isPreviewing) {
      this._stopAll();
      return;
    }
    
    // If processing, ignore
    if (this._isProcessing) return;
    
    const isolateVocals = this._isolateCheckbox?.checked || false;
    
    // If isolate vocals checked, need to process first
    if (isolateVocals) {
      await this._previewWithProcessing(previewBtn);
    } else {
      this._previewLocal(previewBtn);
    }
  }
  
  private _previewLocal(previewBtn: HTMLButtonElement | null): void {
    if (!this._audioBuffer) return;
    
    const startTime = this._markStart ?? 0;
    const endTime = this._markEnd ?? this._audioBuffer.duration;
    
    this._initAudioContext();
    this._stopAll();
    
    this._sourceNode = this._audioContext!.createBufferSource();
    this._sourceNode.buffer = this._audioBuffer;
    this._sourceNode.connect(this._audioContext!.destination);
    this._sourceNode.start(0, startTime, endTime - startTime);
    
    this._isPreviewing = true;
    if (previewBtn) previewBtn.textContent = '❚❚ Pause';
    
    this._sourceNode.onended = () => {
      this._isPreviewing = false;
      if (previewBtn) previewBtn.textContent = '▶ Preview';
    };
  }
  private async _previewWithProcessing(previewBtn: HTMLButtonElement | null): Promise<void> {
    if (!this._audioBuffer || !this._originalFile) return;
    
    this._isProcessing = true;
    if (previewBtn) previewBtn.textContent = '⏳ Processing...';
    
    try {
      // Build source audio
      const useSlice = this._markStart !== null && this._markEnd !== null;
      const audioFile = useSlice 
        ? new File([this._createSliceBlob()!], 'slice.wav', { type: 'audio/wav' })
        : this._originalFile;
      
      // Send to backend
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('isolate_vocals', 'true');
      
      const response = await fetch('/api/audio/process-commit', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Processing failed: ${response.status}`);
      }
      
      // Decode response
      const processedBlob = await response.blob();
      const arrayBuffer = await processedBlob.arrayBuffer();
      
      this._initAudioContext();
      // Store raw vocals (before silence removal)
      this._rawVocalsBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);
      this._processedBuffer = this._rawVocalsBuffer;
      
      // Show silence options
      const silenceOptions = this._container?.querySelector('.slicer-silence-options') as HTMLElement;
      if (silenceOptions) silenceOptions.style.display = 'block';
      
      // Play processed audio
      this._stopAll();
      this._sourceNode = this._audioContext!.createBufferSource();
      this._sourceNode.buffer = this._processedBuffer;
      this._sourceNode.connect(this._audioContext!.destination);
      this._sourceNode.start(0);
      
      this._isPreviewing = true;
      this._isProcessing = false;
      this._pausedAt = 0;
      this._playStartedAt = this._audioContext!.currentTime;
      if (previewBtn) previewBtn.textContent = '❚❚ Pause';
      
      // Start highlight animation loop
      const duration = this._processedBuffer!.duration;
      const updatePreviewHighlight = () => {
        if (!this._isPreviewing) return;
        const currentTime = this._audioContext!.currentTime - this._playStartedAt;
        this._updateSlotHighlight(currentTime);
        if (currentTime < duration) {
          requestAnimationFrame(updatePreviewHighlight);
        }
      };
      requestAnimationFrame(updatePreviewHighlight);
      
      this._sourceNode.onended = () => {
        this._isPreviewing = false;
        this._controller.highlightSlot(null);
        if (previewBtn) previewBtn.textContent = '▶ Preview';
      };
      
    } catch (error) {
      console.error('[AudioSlicerPanel] Preview processing failed:', error);
      this._isProcessing = false;
      if (previewBtn) previewBtn.textContent = '▶ Preview';
    }
  }
	
	private async _previewVocals(section: HTMLElement): Promise<void> {
    const btn = section.querySelector('.slicer-btn-vocals-preview') as HTMLButtonElement;
    const label = btn?.querySelector('.slicer-preview-label');
    const status = section.querySelector('.slicer-status-text');
    
    // If already previewing, stop
    if (this._isPreviewing) {
      this._stopAll();
      if (label) label.textContent = this._rawVocalsBuffer ? 'Preview Vocals' : 'Process & Preview';
      return;
    }
    
    // If cached, play directly
    if (this._rawVocalsBuffer) {
      this._playBuffer(this._rawVocalsBuffer, btn, label);
      return;
    }
    
    // Need to process
    if (!this._audioBuffer || !this._originalFile) return;
    
    this._isProcessing = true;
    if (label) label.textContent = 'Processing...';
    if (btn) btn.disabled = true;
    if (status) status.textContent = '';
    
    try {
      const useSlice = this._markStart !== null && this._markEnd !== null;
      const audioFile = useSlice 
        ? new File([this._createSliceBlob()!], 'slice.wav', { type: 'audio/wav' })
        : this._originalFile;
      
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('isolate_vocals', 'true');
      
      const response = await fetch('/api/audio/process-commit', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error(`Processing failed: ${response.status}`);
      
      const processedBlob = await response.blob();
      const arrayBuffer = await processedBlob.arrayBuffer();
      
      this._initAudioContext();
      this._rawVocalsBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);
      
      if (status) status.textContent = '✓ Cached';
      this._isProcessing = false;
      if (btn) btn.disabled = false;
      
      this._playBuffer(this._rawVocalsBuffer, btn, label);
      
    } catch (error) {
      console.error('[AudioSlicerPanel] Vocals processing failed:', error);
      this._isProcessing = false;
      if (btn) btn.disabled = false;
      if (label) label.textContent = 'Process & Preview';
      if (status) status.textContent = '✗ Failed';
    }
  }

private async _processPreviewSilenceRemoval(): Promise<void> {
    if (!this._rawVocalsBuffer) return;
    
    try {
      const rawBlob = this._encodeWAV(this._rawVocalsBuffer);
      
      const formData = new FormData();
      formData.append('file', new File([rawBlob], 'vocals.wav', { type: 'audio/wav' }));
      formData.append('min_duration', String(this._minDuration));
      formData.append('threshold_db', String(this._silenceThresh));
      
      const response = await fetch('/api/audio/compress-silence', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error(`Silence removal failed: ${response.status}`);
      
      const compressedBlob = await response.blob();
      const arrayBuffer = await compressedBlob.arrayBuffer();
      
      this._initAudioContext();
      // Replace raw vocals with silence-removed version for preview
      this._rawVocalsBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);
      
    } catch (error) {
      console.error('[AudioSlicerPanel] Preview silence removal failed:', error);
      // Keep raw vocals buffer - preview will work but without silence removal
    }
  }

private async _processVocals(): Promise<void> {
    if (!this._audioBuffer || !this._originalFile) return;
    if (this._isProcessing) return;
    
    this._isProcessing = true;
    
    // Update UI to show processing
    const statusEl = this._trimmerSection?.querySelector('.slicer-vocals-status') as HTMLElement;
    const playBtn = this._trimmerSection?.querySelector('.slicer-play-btn') as HTMLButtonElement;
    const applyBtn = this._trimmerSection?.querySelector('.slicer-btn-apply') as HTMLButtonElement;
    if (statusEl) {
      statusEl.textContent = '(processing...)';
      statusEl.style.color = '#c0392b';
    }
    if (playBtn) playBtn.disabled = true;
    if (applyBtn) applyBtn.disabled = true;
    
    try {
      const useSlice = this._markStart !== null && this._markEnd !== null;
      const audioFile = useSlice 
        ? new File([this._createSliceBlob()!], 'slice.wav', { type: 'audio/wav' })
        : this._originalFile;
      
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('isolate_vocals', 'true');
      
      const response = await fetch('/api/audio/process-commit', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error(`Processing failed: ${response.status}`);
      
      const processedBlob = await response.blob();
      const arrayBuffer = await processedBlob.arrayBuffer();
      
      this._initAudioContext();
      this._rawVocalsBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);
      
      // Now process silence removal for preview parity
      await this._processPreviewSilenceRemoval();
      
      // Show success
      const statusEl = this._trimmerSection?.querySelector('.slicer-vocals-status') as HTMLElement;
      if (statusEl) {
        statusEl.textContent = '✓';
        statusEl.style.color = '#27ae60';
      }
      
    } catch (error) {
      console.error('[AudioSlicerPanel] Vocals processing failed:', error);
      this._isolateVocals = false;
      const checkbox = this._trimmerSection?.querySelector('.slicer-isolate-checkbox') as HTMLInputElement;
      if (checkbox) checkbox.checked = false;
      
      // Show failure
      const statusEl = this._trimmerSection?.querySelector('.slicer-vocals-status') as HTMLElement;
      if (statusEl) {
        statusEl.textContent = '✗ failed';
        statusEl.style.color = '#c0392b';
      }
    } finally {
      this._isProcessing = false;
      // Re-enable buttons
      const playBtn = this._trimmerSection?.querySelector('.slicer-play-btn') as HTMLButtonElement;
      const applyBtn = this._trimmerSection?.querySelector('.slicer-btn-apply') as HTMLButtonElement;
      if (playBtn) playBtn.disabled = false;
      if (applyBtn) applyBtn.disabled = false;
    }
  }
  
  private _playBuffer(buffer: AudioBuffer, btn?: HTMLButtonElement | null, label?: Element | null): void {
    this._initAudioContext();
    this._stopAll();
    
    this._sourceNode = this._audioContext!.createBufferSource();
    this._sourceNode.buffer = buffer;
    this._sourceNode.connect(this._audioContext!.destination);
    this._sourceNode.start(0);
    
    this._isPreviewing = true;
    if (label) label.textContent = 'Pause';
    
    this._sourceNode.onended = () => {
      this._isPreviewing = false;
      if (label) label.textContent = this._rawVocalsBuffer ? 'Preview Vocals' : 'Process & Preview';
    };
  }
	
	private async _processSilenceRemoval(section: HTMLElement): Promise<void> {
    if (!this._rawVocalsBuffer) return;
    
    const card = section.querySelector('#toggle-silence');
    const statusEl = document.createElement('span');
    statusEl.className = 'slicer-silence-status';
    statusEl.textContent = ' Processing...';
    card?.querySelector('.slicer-toggle-title')?.appendChild(statusEl);
    
    try {
      const rawBlob = this._encodeWAV(this._rawVocalsBuffer);
      
      const formData = new FormData();
      formData.append('file', new File([rawBlob], 'vocals.wav', { type: 'audio/wav' }));
      formData.append('min_duration', String(this._minDuration));
      formData.append('threshold_db', String(this._silenceThresh));
      
      const response = await fetch('/api/audio/compress-silence', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error(`Silence removal failed: ${response.status}`);
      
      const compressedBlob = await response.blob();
      const arrayBuffer = await compressedBlob.arrayBuffer();
      
      this._initAudioContext();
      this._processedBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);
      
      statusEl.textContent = ' ✓ Ready';
      setTimeout(() => statusEl.remove(), 2000);
      
    } catch (error) {
      console.error('[AudioSlicerPanel] Silence removal failed:', error);
      statusEl.textContent = ' ✗ Failed';
      setTimeout(() => statusEl.remove(), 3000);
    }
  }
  
  private _stopAll(): void {
    // Stop main playback
    if (this._sourceNode) {
      this._sourceNode.onended = null;
      this._sourceNode.stop();
      this._sourceNode.disconnect();
      this._sourceNode = null;
    }
    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }
    
    // Reset states
    this._isPlaying = false;
    this._isPreviewing = false;
    
    // Reset play button icon to play state
    if (this._playBtn) {
      const playIcon = this._playBtn.querySelector('.slicer-play-icon') as HTMLElement;
      const pauseIcon = this._playBtn.querySelector('.slicer-pause-icon') as HTMLElement;
      if (playIcon) playIcon.style.display = '';
      if (pauseIcon) pauseIcon.style.display = 'none';
      this._playBtn.classList.remove('playing');
    }
    
    const previewBtn = this._container?.querySelector('.slicer-btn-preview') as HTMLButtonElement;
    if (previewBtn) previewBtn.textContent = '▶ Preview';
  }
  
  private _reset(): void {
    this._markStart = null;
    this._markEnd = null;
    this._markPhase = 'start';
    this._pausedAt = 0;
    
    // Reset mark button
    if (this._markStartBtn) this._markStartBtn.disabled = true;
    if (this._markEndBtn) this._markEndBtn.disabled = true;
    if (this._commitBtn) this._commitBtn.disabled = true;
    if (this._selectionValueEl) this._selectionValueEl.textContent = 'Full track';
    if (this._isolateCheckbox) this._isolateCheckbox.checked = false;
    
    // Show mark row, hide result
    const markRow = this._container?.querySelector('.slicer-mark-row') as HTMLElement;
    if (markRow) markRow.style.display = 'block';
    if (this._hintEl) {
      this._hintEl.style.display = 'block';
      this._hintEl.textContent = 'Press play, then mark your section';
      this._hintEl.classList.remove('active');
    }
    
    this._resultPanel?.classList.remove('visible');
    this._selectionOverlay?.classList.remove('visible');
    this._playhead?.classList.remove('visible');
    
    if (this._currentTimeEl) this._currentTimeEl.textContent = '0:00';
    
    // Enable preview/commit if audio loaded
    if (this._audioBuffer) {
      if (this._commitBtn) this._commitBtn.disabled = false;
      const previewBtn = this._container?.querySelector('.slicer-preview-row .slicer-btn-preview') as HTMLButtonElement;
      if (previewBtn) previewBtn.disabled = false;
    }
  }
  
  private _exportSlice(): void {
    if (this._markStart === null || this._markEnd === null || !this._audioBuffer || !this._audioContext) return;
    
    const sampleRate = this._audioBuffer.sampleRate;
    const startSample = Math.floor(this._markStart * sampleRate);
    const endSample = Math.floor(this._markEnd * sampleRate);
    const sliceLength = endSample - startSample;
    const numChannels = this._audioBuffer.numberOfChannels;
    
    // Create sliced buffer
    const slicedBuffer = this._audioContext.createBuffer(numChannels, sliceLength, sampleRate);
    for (let ch = 0; ch < numChannels; ch++) {
      slicedBuffer.getChannelData(ch).set(
        this._audioBuffer.getChannelData(ch).subarray(startSample, endSample)
      );
    }
    
    // Encode as WAV
    const wavBlob = this._encodeWAV(slicedBuffer);
    
    // Invoke callback or dispatch action
    if (this._onSliceComplete) {
      this._onSliceComplete({
        blob: wavBlob,
        startTime: this._markStart,
        endTime: this._markEnd,
        duration: this._markEnd - this._markStart
      });
    }
    
    // Dispatch action to controller
    void this._controller.dispatch({
      type: 'AUDIO_SLICE_COMPLETE',
      payload: {
        blob: wavBlob,
        startTime: this._markStart,
        endTime: this._markEnd,
        duration: this._markEnd - this._markStart
      }
    });
  }
	
	private _handleCommit(): void {
    const isolateVocals = this._isolateVocals || this._isolateCheckbox?.checked || false;
    const useSlice = this._markStart !== null && this._markEnd !== null;
    const removeSilence = isolateVocals ? true : this._silenceEnabled;
    
    // If vocals already processed client-side, use cached buffer and skip backend demucs
    const vocalsAlreadyProcessed = isolateVocals && !!this._rawVocalsBuffer;
    
    let fileToSend: File | Blob | undefined = this._originalFile ?? undefined;
    if (vocalsAlreadyProcessed) {
      // Send pre-processed vocals, tell backend to skip demucs
      fileToSend = new File([this._encodeWAV(this._rawVocalsBuffer!)], 'vocals.wav', { type: 'audio/wav' });
    }
    
    void this._controller.dispatch({
      type: 'AUDIO_COMMIT',
      payload: {
        // When vocals pre-processed, file is already sliced - don't slice again
        useSlice: vocalsAlreadyProcessed ? false : useSlice,
        startTime: vocalsAlreadyProcessed ? 0 : this._markStart,
        endTime: vocalsAlreadyProcessed ? (this._rawVocalsBuffer?.duration ?? this._markEnd) : this._markEnd,
        isolateVocals: vocalsAlreadyProcessed ? false : isolateVocals, // Skip demucs if already done
        removeSilence,
        silenceThreshold: this._silenceThresh,
        silenceMinDuration: this._minDuration,
        sliceBlob: null, // Slicing handled by file selection above
        originalFile: fileToSend
      }
    });
  }
	
	private async _applySilenceCompression(): Promise<void> {
    if (!this._rawVocalsBuffer) {
      console.warn('[AudioSlicerPanel] No raw vocals to compress');
      return;
    }
    
    // Use config values (set from composition_defaults.json in constructor)
    // Do not override from DOM - instance properties are authoritative
    
    const applyBtn = this._container?.querySelector('.slicer-btn-apply-silence') as HTMLButtonElement;
    if (applyBtn) applyBtn.textContent = '⏳ Applying...';
    
    try {
      const rawBlob = this._encodeWAV(this._rawVocalsBuffer);
      
      const formData = new FormData();
      formData.append('file', new File([rawBlob], 'vocals.wav', { type: 'audio/wav' }));
      formData.append('min_duration', String(this._minDuration));
      formData.append('threshold_db', String(this._silenceThresh));
      
      const response = await fetch('/api/audio/compress-silence', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error(`Compression failed: ${response.status}`);
      
      const compressedBlob = await response.blob();
      const arrayBuffer = await compressedBlob.arrayBuffer();
      
      this._initAudioContext();
      this._processedBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);
      
      // Auto-play result
      this._stopAll();
      this._sourceNode = this._audioContext!.createBufferSource();
      this._sourceNode.buffer = this._processedBuffer;
      this._sourceNode.connect(this._audioContext!.destination);
      this._sourceNode.start(0);
      
      this._isPreviewing = true;
      
      const previewBtn = this._container?.querySelector('.slicer-preview-row .slicer-btn-preview') as HTMLButtonElement;
      if (previewBtn) previewBtn.textContent = '❚❚ Pause';
      
      this._sourceNode.onended = () => {
        this._isPreviewing = false;
        if (previewBtn) previewBtn.textContent = '▶ Preview';
      };
      
    } catch (error) {
      console.error('[AudioSlicerPanel] Silence compression failed:', error);
    } finally {
      if (applyBtn) applyBtn.textContent = 'Apply';
    }
  }
  
  private _createSliceBlob(): Blob | null {
    if (this._markStart === null || this._markEnd === null || !this._audioBuffer || !this._audioContext) {
      return null;
    }
    
    const sampleRate = this._audioBuffer.sampleRate;
    const startSample = Math.floor(this._markStart * sampleRate);
    const endSample = Math.floor(this._markEnd * sampleRate);
    const sliceLength = endSample - startSample;
    const numChannels = this._audioBuffer.numberOfChannels;
    
    const slicedBuffer = this._audioContext.createBuffer(numChannels, sliceLength, sampleRate);
    for (let ch = 0; ch < numChannels; ch++) {
      slicedBuffer.getChannelData(ch).set(
        this._audioBuffer.getChannelData(ch).subarray(startSample, endSample)
      );
    }
    
    return this._encodeWAV(slicedBuffer);
  }
  
  private _encodeWAV(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const dataLength = buffer.length * blockAlign;
    const arrayBuffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(arrayBuffer);
    
    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    
    // RIFF header
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeStr(8, 'WAVE');
    
    // fmt chunk
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    
    // data chunk
    writeStr(36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Interleaved samples
    const channels: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
      channels.push(buffer.getChannelData(ch));
    }
    
    let pos = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, channels[ch][i]));
        view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        pos += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
	
	private _openAccordion(id: string): void {
    const target = this._container?.querySelector(`#${id}`) as HTMLDetailsElement;
    if (target) {
      // Close others
      this._container?.querySelectorAll('.subcategory-item').forEach(item => {
        (item as HTMLDetailsElement).open = false;
      });
      target.open = true;
    }
  }
  
  private _resetToUpload(): void {
    this._stopAll();
    this._audioBuffer = null;
    this._originalFile = null;
    this._processedBuffer = null;
    this._rawVocalsBuffer = null;
    this._resetState();
    
    // Clear stored audio since user is starting fresh
    void this._clearAudioStorage();
    
    this._dropZone?.classList.remove('hidden');
    this._songLoaded?.classList.remove('visible');
    
    const songFooter = this._container?.querySelector('.slicer-song-footer') as HTMLElement;
    if (songFooter) songFooter.style.display = 'none';
    
    const subtitle = this._container?.querySelector('.slicer-song-subtitle');
    if (subtitle) subtitle.textContent = 'Choose audio file';
    
    if (this._fileInput) this._fileInput.value = '';
  }
  
  private _useFullTrack(): void {
    if (!this._audioBuffer) return;
    this._markStart = 0;
    this._markEnd = this._audioBuffer.duration;
    this._updateMarkButtonsV2();
    this._updateSelectionSummary();
    this._updateSelection();
    this._controller.updateAudioAccordionValue('slicing');
  }
  
  private _handlePreviewFinal(): void {
    const btn = this._trimmerSection?.querySelector('.slicer-btn-preview-final');
    const playIcon = btn?.querySelector('.slicer-play-icon') as HTMLElement;
    const pauseIcon = btn?.querySelector('.slicer-pause-icon') as HTMLElement;
    const label = btn?.querySelector('.slicer-preview-label');
    
    if (this._isPreviewing) {
      this._stopAll();
      this._isPreviewing = false;
      if (playIcon) playIcon.style.display = '';
      if (pauseIcon) pauseIcon.style.display = 'none';
      if (label) label.textContent = 'Preview';
    } else {
      this._handleCommit();
    }
  }
  
  private _resetToFullTrack(): void {
    if (!this._audioBuffer) return;
    this._markStart = 0;
    this._markEnd = this._audioBuffer.duration;
    this._pausedAt = 0;
    
    // Invalidate vocals buffer since slice changed
    this._invalidateGeneratedBuffers();
    
    // Reset vocals toggle
    this._isolateVocals = false;
    const checkbox = this._trimmerSection?.querySelector('.slicer-isolate-checkbox') as HTMLInputElement;
    if (checkbox) checkbox.checked = false;
    
    // Clear vocals status
    const statusEl = this._trimmerSection?.querySelector('.slicer-vocals-status') as HTMLElement;
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.style.color = '';
    }
    
    this._updateMarkButtonsV2();
    this._updateSelection();
    this._persistTrimState();
  } 
  
  private _updateMarkButtonsV2(): void {
    if (!this._trimmerSection) return;
    
    const startTimeEl = this._trimmerSection.querySelector('.slicer-btn-mark-start .slicer-mark-btn-time');
    const endTimeEl = this._trimmerSection.querySelector('.slicer-btn-mark-end .slicer-mark-btn-time');
    const startBtn = this._trimmerSection.querySelector('.slicer-btn-mark-start');
    const endBtn = this._trimmerSection.querySelector('.slicer-btn-mark-end');
    
    if (startTimeEl) {
      startTimeEl.textContent = this._markStart !== null ? this._formatTime(this._markStart) : '—';
    }
    if (startBtn) {
      startBtn.classList.toggle('marked', this._markStart !== null);
    }
    if (endTimeEl) {
      endTimeEl.textContent = this._markEnd !== null ? this._formatTime(this._markEnd) : '—';
    }
    if (endBtn) {
      endBtn.classList.toggle('marked', this._markEnd !== null);
    }
  }
  
  private _updateSelectionSummary(): void {
    const summary = this._trimmerSection?.querySelector('.slicer-selection-summary');
    if (!summary) return;
    
    if (this._markStart !== null && this._markEnd !== null) {
      const start = Math.min(this._markStart, this._markEnd);
      const end = Math.max(this._markStart, this._markEnd);
      const duration = end - start;
      
      const rangeEl = summary.querySelector('.slicer-summary-range');
      const durationEl = summary.querySelector('.slicer-summary-duration');
      
      if (rangeEl) rangeEl.textContent = `${this._formatTime(start)} → ${this._formatTime(end)}`;
      if (durationEl) {
        const mins = Math.floor(duration / 60);
        const secs = Math.floor(duration % 60);
        durationEl.textContent = mins > 0 ? `(${mins} min ${secs} sec)` : `(${secs} sec)`;
      }
      
      summary.classList.add('visible');
    } else {
      summary.classList.remove('visible');
    }
  }
  
  private _resetState(skipPersist: boolean = false): void {
    this._markStart = null;
    this._markEnd = null;
    this._markPhase = 'start';
    this._pausedAt = 0;
    this._isPlaying = false;
    this._isolateVocals = false;
    this._silenceEnabled = false;
    
    // Persist reset state to clear any stale values (unless skipping during restore)
    if (!skipPersist) {
      this._persistToggleState();
    }
    
    // Reset vocals checkbox in trimmer section
    const trimmerCheckbox = this._trimmerSection?.querySelector('.slicer-isolate-checkbox') as HTMLInputElement;
    if (trimmerCheckbox) trimmerCheckbox.checked = false;
    
    if (this._markStartBtn) this._markStartBtn.disabled = true;
    if (this._markEndBtn) this._markEndBtn.disabled = true;
    if (this._commitBtn) this._commitBtn.disabled = true;
    if (this._selectionValueEl) this._selectionValueEl.textContent = 'Full track';
    if (this._isolateCheckbox) this._isolateCheckbox.checked = false;
    
    const markRow = this._container?.querySelector('.slicer-mark-row') as HTMLElement;
    if (markRow) markRow.style.display = 'block';
    
    if (this._hintEl) {
      this._hintEl.style.display = 'block';
      this._hintEl.textContent = 'Press play, then mark your section';
      this._hintEl.classList.remove('active');
    }
    
    this._resultPanel?.classList.remove('visible');
    this._selectionOverlay?.classList.remove('visible');
    this._playhead?.classList.remove('visible');
    
    if (this._currentTimeEl) this._currentTimeEl.textContent = '0:00';
  }
  
  /**
   * Load audio from an existing File object (e.g., from UploadPanel)
   */
  public loadAudioFile(file: File): void {
    this._loadFile(file);
  }
  
  /**
   * Load audio from an existing AudioBuffer
   */
  public loadAudioBuffer(buffer: AudioBuffer, fileName?: string): void {
    this._initAudioContext();
    this._audioBuffer = buffer;
    
    this._dropZone?.classList.add('hidden');
    this._songLoaded?.classList.add('visible');
    
    const fileNameEl = this._container?.querySelector('.slicer-file-name');
    if (fileNameEl) fileNameEl.textContent = fileName || 'Audio';
    
    if (this._totalTimeEl) {
      this._totalTimeEl.textContent = this._formatTime(buffer.duration);
    }
    
    this._resetState();
		this._invalidateGeneratedBuffers();
		this._updateCommitButton();
		this._drawWaveform();
		this._controller.updateAudioAccordionValue('custom');
		
		// Persist filename to composition state
		this._controller.updateAudioSourceState({
			source_file: file.name,
			start_time: 0,
			end_time: this._audioBuffer!.duration
		});
  }
  
  destroy(): void {
    // Stop playback
    this._stop();
    
    // Remove resize listener
    window.removeEventListener('resize', this._handleResize);
    
    // Close audio context
    if (this._audioContext) {
      this._audioContext.close();
      this._audioContext = null;
    }
    
    // Remove DOM
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}

```

## File: `C:\Users\paulj\WDweb\src\ApplicationController.ts`

```typescript
/**
 * ApplicationController - Central state management and orchestration
 * 
 * Single source of truth for application state.
 * Coordinates between UI components and the facade.
 * Manages timers, autoplay, and phase transitions.
 */

import { AudioCacheService } from './AudioCacheService';
import { AspectRatioLock } from './components/AspectRatioLock';
import { FilterIconStrip } from './components/FilterIconStrip';
import { PanelStackManager } from './components/PanelStackManager';
import { RightPanelContentRenderer } from './components/RightPanelContent';
import { SectionSelectorPanel } from './components/SectionSelectorPanel';
import { SliderGroup } from './components/SliderGroup';
import { SubcategoryAccordion, type AccordionItemConfig } from './components/SubcategoryAccordion';
import { ThumbnailGrid } from './components/ThumbnailGrid';
import { AccordionStyleCard } from './components/AccordionStyleCard';
import { AccordionSpeciesCard } from './components/AccordionSpeciesCard';
import { AccordionCollectionCard, type CollectionCardConfig } from './components/AccordionCollectionCard';
import { CollectionVariantSelector } from './components/CollectionVariantSelector';
import { HorizontalScrollContainer } from './components/HorizontalScrollContainer';
import { WoodMaterialSelector } from './components/WoodMaterialSelector';
import { PerformanceMonitor } from './PerformanceMonitor';
import { ConstraintResolver } from './services/ConstraintResolver';
import type { CategoriesConfig, FilterIconGroup, PanelComponent, ThumbnailConfig } from './types/PanelTypes';
import {
  ApplicationState,
  BackgroundsConfigSchema,
  CompositionStateDTO,
	ConstraintsConfigSchema, 
  PlacementDefaultsSchema,
  WoodMaterialsConfigSchema,
  type ArtPlacement,
  type AudioProcessResponse,
  type BackgroundsConfig,
	type ConstraintsConfig,
  type CSGDataResponse,
  type PlacementDefaults,
  type SectionMaterial,
  type WoodMaterialsConfig,
} from './types/schemas';
import { applyDimensionChange, type DimensionConstraints } from './utils/dimensionUtils';
import { deepMerge } from './utils/mergeUtils';
import { fetchAndValidate } from './utils/validation';
import { Action, WaveformDesignerFacade } from './WaveformDesignerFacade';
import { type CategoriesConfig, type FilterIconGroup, type ThumbnailConfig } from './types/PanelTypes';


// Internal facade APIs that aren't exposed in the public interface
interface TextureCache {
  preloadAllTextures: (config: WoodMaterialsConfig) => Promise<IdleTextureLoader>;
}

interface IdleTextureLoader {
  pause: () => void;
  onProgress: (callback: (loaded: number, total: number) => void) => void;
}

interface SceneManagerInternal {
  _textureCache?: TextureCache;
}

interface Archetype {
  id: string;
  shape: string;
  slot_style: string;
  label: string;
  tooltip: string;
  thumbnail: string;
  number_sections: number;
  number_slots: number;
  separation: number;
  side_margin?: number;
}

interface UIConfig {
  thumbnail_config: ThumbnailConfig;
  categories: CategoriesConfig;
}

interface ElementConfig {
  label: string;
  state_path: string;
  min?: number;
  max?: number;
  step?: number;
  show_when?: {
    shape?: string[];
    slot_style?: string[];
  };
  dynamic_max_by_sections?: Record<string, number>;
}

interface UIEngine {
  getElementConfig: (key: string) => ElementConfig | undefined;
  getStateValue: (composition: CompositionStateDTO, path: string) => unknown;
  config?: { dimension_constraints?: Record<string, { allow_aspect_lock?: boolean; min_dimension?: number; max_dimension?: number }> };
}

declare global {
  interface Window {
    uiEngine?: UIEngine;
  }
}

// Subscriber callback type
type StateSubscriber = (state: ApplicationState) => void;

/**
 * Initialize section_materials array when number_sections changes.
 * Implements smart inheritance: unanimous species/grain → inherit, mixed → defaults.
 */
function initializeSectionMaterials(
  oldN: number,
  newN: number,
  uiCapturedMaterials: SectionMaterial[],
  config: WoodMaterialsConfig,
  availableGrains: string[]
): SectionMaterial[] {
  // If N is unchanged, do nothing
  if (newN === oldN) {
    return uiCapturedMaterials;
  }

  // Step 1: Determine intended species and grain from UI-captured state
  const allSameSpecies = uiCapturedMaterials.length > 0 && 
    uiCapturedMaterials.every(m => m.species === uiCapturedMaterials[0].species);
  const allSameGrain = uiCapturedMaterials.length > 0 && 
    uiCapturedMaterials.every(m => m.grain_direction === uiCapturedMaterials[0].grain_direction);

  const intendedSpecies = allSameSpecies ? uiCapturedMaterials[0].species : config.default_species;
  let intendedGrain = allSameGrain ? uiCapturedMaterials[0].grain_direction : config.default_grain_direction;

	// Step 2: Validate intended grain against NEW number of sections
  if (!availableGrains.includes(intendedGrain)) {
    intendedGrain = config.default_grain_direction;
  }

  // Step 3: Build new materials array from scratch to correct size (newN)
  const newMaterials: SectionMaterial[] = [];
  for (let i = 0; i < newN; i++) {
    const species = uiCapturedMaterials[i]?.species || intendedSpecies;
    newMaterials.push({
      section_id: i,
      species: species,
      grain_direction: intendedGrain
    });
  }

  return newMaterials;
}

export class ApplicationController {
  private _state: ApplicationState | null = null;
  private _facade: WaveformDesignerFacade;
  private _subscribers: Set<StateSubscriber> = new Set();
  private _autoplayTimer?: number;
  private _hintTimer?: number;
  private _panelStack: PanelStackManager | null = null;
  private _sceneManager: { 
    renderComposition: (csgData: CSGDataResponse) => Promise<void>;
    applySectionMaterials: () => void;
    applySingleSectionMaterial?: (sectionId: number) => void;
  } | null = null;
	private _audioCache: AudioCacheService;
  private _woodMaterialsConfig: WoodMaterialsConfig | null = null;
  private _selectedSectionIndices: Set<number> = new Set();
	private _backgroundsConfig: BackgroundsConfig | null = null;
  private _collectionsCatalog: import('./types/schemas').CollectionsCatalog | null = null;
  private _collectionVariantSelector: CollectionVariantSelector | null = null;
	private _currentRoomId: string | null = null;
	private _currentWallFinishId: string | null = null;
  private _idleTextureLoader: unknown = null; // IdleTextureLoader instance
	private _placementDefaults: PlacementDefaults | null = null;
	private _constraints: ConstraintsConfig | null = null;
	private _resolver: ConstraintResolver | null = null;
	private _compositionCache: Map<string, CompositionStateDTO> = new Map();
  private _marginPresetCache: Map<string, import('../types/schemas').MarginPreset[]> = new Map();
  private _isUpdatingComposition: boolean = false;
	public getResolver(): ConstraintResolver | null {
    return this._resolver;
  }
  
  private _isRectangularLinearN3Plus(archetypeId: string): boolean {
    return archetypeId === 'rectangular_linear_n3' || archetypeId === 'rectangular_linear_n4';
  }
	public getConstraintsConfig(): ConstraintsConfig | null {
    return this._constraints;
  }
	
	private async _fetchMarginPresets(composition: CompositionStateDTO): Promise<import('../types/schemas').MarginPreset[]> {
    const frame = composition.frame_design;
    const pattern = composition.pattern_settings;
    
    if (frame.shape !== 'rectangular' || pattern.slot_style !== 'linear' || frame.number_sections < 3) {
      return [];
    }
    
    const cacheKey = `${frame.finish_x}-${frame.separation}-${frame.number_sections}-${pattern.number_slots}`;
    
    const cached = this._marginPresetCache.get(cacheKey);
    if (cached) return cached;
    
    try {
      const response = await fetch('/api/geometry/margin-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finish_x: frame.finish_x,
          separation: frame.separation,
          number_sections: frame.number_sections,
          number_slots: pattern.number_slots,
          x_offset: pattern.x_offset,
          spacer: pattern.spacer,
          bit_diameter: pattern.bit_diameter,
          shape: frame.shape,
          slot_style: pattern.slot_style
        })
      });
      
      const data = await response.json() as import('../types/schemas').MarginPresetsResponse;
      
      if (data.applicable && data.presets.length > 0) {
        this._marginPresetCache.set(cacheKey, data.presets);
        return data.presets;
      }
    } catch (e) {
      console.error('[Controller] Failed to fetch margin presets:', e);
    }
    
    return [];
  }
	
	public getMarginPresets(composition: CompositionStateDTO): import('../types/schemas').MarginPreset[] {
    const frame = composition.frame_design;
    const pattern = composition.pattern_settings;
    const cacheKey = `${frame.finish_x}-${frame.separation}-${frame.number_sections}-${pattern.number_slots}`;
    return this._marginPresetCache.get(cacheKey) || [];
  }
  
  public getCategories(): import('./types/PanelTypes').CategoryConfig[] {
    if (!this._categoriesConfig) return [];
    return Object.entries(this._categoriesConfig)
      .map(([id, config]) => ({
        id,
        label: config.label,
        icon: '',
        enabled: Object.keys(config.subcategories).length > 0,
        order: config.order ?? 99
      }))
      .sort((a, b) => a.order - b.order);
  }
	
	// Four-panel navigation configuration
  private _thumbnailConfig: ThumbnailConfig | null = null;
  private _categoriesConfig: CategoriesConfig | null = null;
	private _archetypes: Map<string, Archetype> = new Map();
  
  // Four-panel DOM references
	private _leftMainPanel: HTMLElement | null = null;
  private _leftSecondaryPanel: HTMLElement | null = null;
  private _rightSecondaryPanel: HTMLElement | null = null;
  private _rightMainPanel: HTMLElement | null = null;
  private _filterIconStrip: FilterIconStrip | null = null;
  private _sectionSelectorPanel: SectionSelectorPanel | null = null;
  private _helpTooltip: Tooltip | null = null;
  private _activeRightPanelComponent: PanelComponent | null = null;
  private _renderId: number = 0;
  private _accordion: SubcategoryAccordion | null = null;
  private _accordionState: Record<string, Record<string, boolean>> = {};
	private _audioSlicerPanel: import('./components/AudioSlicerPanel').AudioSlicerPanel | null = null;
  
  constructor(facade: WaveformDesignerFacade) {
    this._facade = facade;
		this._audioCache = new AudioCacheService();
		this._panelStack = new PanelStackManager('right-panel-stack');
  }
	
	public get audioCache(): AudioCacheService {
    return this._audioCache;
  }
	
	/**
   * Update section selection state (called from SceneManager or UI)
   * Syncs state and updates section selector panel if visible
   */
  public selectSection(indices: Set<number>): void {
    // Update section selector panel if it exists
    if (this._sectionSelectorPanel) {
      this._sectionSelectorPanel.updateSelection(indices);
    }
  }
	
	public updateAudioSourceState(updates: Partial<{
    source_file: string | null;
    start_time: number;
    end_time: number;
    use_stems: boolean;
  }>): void {
    if (!this._state) return;
    this._state.composition.audio_source = {
      ...this._state.composition.audio_source,
      ...updates
    };
    this._facade.persistState(this._state);
  }

  public updateAudioProcessingState(updates: Partial<{
    remove_silence: boolean;
  }>): void {
    if (!this._state) return;
    this._state.composition.audio_processing = {
      ...this._state.composition.audio_processing,
      ...updates
    };
    this._facade.persistState(this._state);
  }

  /**
   * Create optimized composition state from /api/audio/optimize result
   * Does NOT mutate state directly - returns DTO for processing pipeline
   */
  public createOptimizedComposition(result: {
    exponent: number;
    filter_amount: number;
    silence_threshold: number;
    binning_mode: string;
    remove_silence: boolean;
    silence_duration: number;
  }): CompositionStateDTO | null {
    if (!this._state) return null;
    
    const newAudioProcessing = {
      ...this._state.composition.audio_processing,
      filter_amount: result.filter_amount,
      silence_threshold: result.silence_threshold,
      binning_mode: result.binning_mode,
      remove_silence: result.remove_silence,
      silence_duration: result.silence_duration,
      apply_filter: true
    };
    
    const newPatternSettings = {
      ...this._state.composition.pattern_settings,
      amplitude_exponent: result.exponent
    };
    
    return {
      ...this._state.composition,
      audio_processing: newAudioProcessing,
      pattern_settings: newPatternSettings
    };
  }
	
	/**
   * Restore UI from persisted state after DOM is ready
   * Called from main.ts after LeftPanelRenderer has rendered
   */
  restoreUIFromState(): void {
    if (!this._state) return;
    
    // Restore accordion state from persisted state
    if (this._state.ui.accordionState) {
      this._accordionState = { ...this._state.ui.accordionState };
    }
    
    const { activeCategory, activeSubcategory } = this._state.ui;
    
    if (!activeCategory) return;
    
    // 1. Highlight category button
    const categoryButtons = document.querySelectorAll('.category-button');
    categoryButtons.forEach(btn => {
      const btnId = btn.getAttribute('data-category');
      if (btnId === activeCategory) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    // 2. Render accordion for the category (replaces Left Secondary Panel)
    this._renderAccordionForCategory(activeCategory);
    
    // 3. Subcategory content now handled by accordion's getContent callback
  }
  
  /**
   * Initialize the controller with default or restored state
   */
  async initialize(): Promise<void> {
    try {
      // Initialize facade (loads style presets)
      this._facade.initialize();
			
			// Initialize help tooltip
      void import('./components/Tooltip').then(({ Tooltip }) => {
        this._helpTooltip = new Tooltip();
      });
			
			// Initialize panel references (DOM is ready at this point)
      this._leftMainPanel = document.getElementById('left-main-panel');
      this._leftSecondaryPanel = document.getElementById('left-secondary-panel');
      this._rightSecondaryPanel = document.getElementById('right-secondary-panel');
      this._rightMainPanel = document.getElementById('right-main-panel');
      
      if (!this._leftSecondaryPanel || !this._rightSecondaryPanel || !this._rightMainPanel) {
        console.warn('[Controller] Four-panel DOM elements not found');
      }

      window.addEventListener('resize', () => {
        this._updateLeftSecondaryPosition();
      });
      
      // Load wood materials configuration
      this._woodMaterialsConfig = await fetchAndValidate<WoodMaterialsConfig>(
        'http://localhost:8000/api/config/wood-materials',
        WoodMaterialsConfigSchema
      );
			
			// Load placement defaults configuration
      try {
        this._placementDefaults = await fetchAndValidate<PlacementDefaults>(
          'http://localhost:8000/api/config/placement-defaults',
          PlacementDefaultsSchema
        );
      } catch (error) {
        console.error('Failed to load placement defaults:', error);
        // Non-fatal: application can continue with base archetype defaults
      }
			
			// Load thumbnail and categories configuration
      // Load all configs in parallel
			const [archetypes, woodMaterials, backgrounds, placementDefaults, uiConfig, _compositionDefaults, constraints] = await Promise.all([
				fetch('http://localhost:8000/api/config/archetypes').then(r => r.json() as Promise<Record<string, Archetype>>),
				fetch('http://localhost:8000/api/config/wood-materials').then(r => r.json() as Promise<WoodMaterialsConfig>),
				fetchAndValidate<BackgroundsConfig>('http://localhost:8000/api/config/backgrounds', BackgroundsConfigSchema),
				fetch('http://localhost:8000/api/config/placement-defaults').then(r => r.json() as Promise<PlacementDefaults>),
				fetch('http://localhost:8000/api/config/ui').then(r => r.json() as Promise<UIConfig>),
				fetch('http://localhost:8000/api/config/composition-defaults').then(r => r.json() as Promise<unknown>),
				fetchAndValidate('http://localhost:8000/api/config/constraints', ConstraintsConfigSchema)
			]);

			// Store archetypes
			Object.entries(archetypes).forEach(([id, data]) => {
				this._archetypes.set(id, data);
			});

			// Store configs
			this._woodMaterialsConfig = woodMaterials;
			this._backgroundsConfig = backgrounds;
			this._currentRoomId = (backgrounds as { default_room?: string }).default_room || 'blank_wall';
			this._currentWallFinishId = (backgrounds as { default_wall_finish?: string }).default_wall_finish || 'warm-beige';
			this._placementDefaults = placementDefaults;
			this._constraints = constraints;
			this._resolver = new ConstraintResolver(constraints, placementDefaults);
			this._thumbnailConfig = uiConfig.thumbnail_config;
			this._categoriesConfig = uiConfig.categories;
			
    } catch (error: unknown) {
      console.error('[Controller] Failed to load configuration:', error);
    }
    
    // Load fresh defaults first
    const freshDefaults = await this._facade.createInitialState();
    
    // Try to restore saved state
    const restored = this._facade.loadPersistedState();
    
    if (restored && restored.audio.rawSamples && restored.audio.rawSamples.length > 0) {
      // Deep merge: preserved user settings + new schema fields from defaults
      this._state = this._facade.mergeStates(freshDefaults, restored);
      
      // CRITICAL: Scale normalized amplitudes to physical space
      // Persisted state may contain 0-1 normalized values that need scaling
      const amps = this._state.composition.processed_amplitudes;
      if (amps && amps.length > 0) {
        const maxAmp = Math.max(...amps.map(Math.abs));
        if (maxAmp > 0 && maxAmp <= 1.5) {
          // Call backend to get max_amplitude_local for current geometry
          const response = await fetch('http://localhost:8000/geometry/csg-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              state: this._state.composition,
              changed_params: [],
              previous_max_amplitude: null
            })
          });
          
          if (response.ok) {
            const csgData = await response.json() as { max_amplitude_local: number };
            const maxAmplitudeLocal = csgData.max_amplitude_local;
            
            // Scale amplitudes to physical dimensions
            const scaledAmps = amps.map(a => a * maxAmplitudeLocal);
            this._state = {
              ...this._state,
              composition: {
                ...this._state.composition,
                processed_amplitudes: scaledAmps
              },
              audio: {
                ...this._state.audio,
                previousMaxAmplitude: maxAmplitudeLocal
              }
            };
          }
        }
      }
      
      // Re-cache the raw samples on load
      if (this._state.audio.audioSessionId) {
        this._audioCache.rehydrateCache(
          this._state.audio.audioSessionId,
          new Float32Array(this._state.audio.rawSamples)
        );
      }
      await this.dispatch({ type: 'STATE_RESTORED', payload: this._state });
			
			// Restore composition cache from persisted state
      if (this._state.compositionCache) {
        Object.entries(this._state.compositionCache).forEach(([key, comp]) => {
          this._compositionCache.set(key, comp);
        });
      }
    } else {
      if (restored) {
        console.warn('[DEBUG] Restored state is invalid (missing rawSamples). Discarding and creating fresh state.');
      }
      this._state = freshDefaults;
    }
    
    this.notifySubscribers();
    
    // Update panels based on new state
    this.handlePanelUpdates(this._state);

    // specific default selection logic
    if (!this._state.ui.activeCategory) {
      const categoryIds = Object.keys(this._categoriesConfig || {});
      if (categoryIds.length > 0) this.handleCategorySelected(categoryIds[0]);
    }
  }
  
  /**
   * Get current application state
   */
  getState(): ApplicationState {
    if (!this._state) {
      throw new Error('Controller not initialized. Call initialize() first.');
    }
    return this._state;
  }
	
	/**
   * Forcibly resets the application to a fresh, default state.
   * Used by the demo player to ensure a clean start.
   */
  public async resetToDefaultState(): Promise<void> {
    this._state = await this._facade.createInitialState();
    this.notifySubscribers();
    // Clear scene without rendering (tour needs blank canvas)
    if (this._sceneManager && 'clearScene' in this._sceneManager) {
      (this._sceneManager as unknown as { clearScene: () => void }).clearScene();
    }
  }
  
  /**
   * Dispatch an action to update state
   */
  async dispatch(action: Action): Promise<void> {
    if (!this._state) {
      throw new Error('Controller not initialized');
    }
    
    // Special handling for file upload
    if (action.type === 'FILE_UPLOADED') {
      await this.handleFileUpload(action.payload.file, action.payload.uiSnapshot);
      return;
    }
		
		// Special handling for audio commit (slice/vocals)
    if (action.type === 'AUDIO_COMMIT') {
      await this._handleAudioCommit(action.payload);
      return;
    }
    
    // Process state transition through facade
    const newState = this._facade.processStateTransition(this._state, action);
    
    // Update state if changed
    if (newState !== this._state) {
      this._state = newState;
      this._facade.persistState(newState);
      this.notifySubscribers();
      
      // Handle side effects
      this.handleSideEffects(action);
    }
  }	

  /**
   * Register the SceneManager with the controller.
   * This allows the controller to directly trigger rendering operations.
   */
  registerSceneManager(sceneManager: { 
    renderComposition: (csgData: CSGDataResponse) => Promise<void>;
    applySectionMaterials: () => void;
    applySingleSectionMaterial?: (sectionId: number) => void;
    applyArtPlacement?: (placement: ArtPlacement) => void;
    resetArtPlacement?: () => void;
    applyLighting?: (lighting: LightingConfig) => void;
    resetLighting?: () => void;
  }): void {
    this._sceneManager = sceneManager;
    
    // Start texture loading immediately in background
    if (this._woodMaterialsConfig) {
      const textureCache = (this._sceneManager as unknown as SceneManagerInternal)._textureCache;
      if (textureCache && typeof textureCache.preloadAllTextures === 'function') {
        const selectedSpecies = this._state?.composition?.frame_design?.section_materials?.[0]?.species 
          || this._woodMaterialsConfig.default_species;
        void textureCache.preloadAllTextures(this._woodMaterialsConfig, selectedSpecies).then((idleLoader) => {
          this._idleTextureLoader = idleLoader;
          
          const indicator = document.getElementById('textureLoadingIndicator');
          const loadedEl = document.getElementById('texturesLoaded');
          const totalEl = document.getElementById('texturesTotal');
          
          if (indicator && loadedEl && totalEl) {
            idleLoader.onProgress((loaded, total) => {
              loadedEl.textContent = String(loaded);
              totalEl.textContent = String(total);
              
              if (loaded < total) {
                indicator.classList.add('active');
              } else {
                setTimeout(() => {
                  indicator.classList.remove('active');
                }, 2000);
              }
            });
          }
        }).catch((error: unknown) => {
          console.error('[Controller] Background texture loading failed:', error);
        });
      }
    }
    
    // Apply current background from state
    if (this._state && this._backgroundsConfig && 'changeBackground' in sceneManager) {
      const bgState = this._state.ui.currentBackground;
      const category = this._backgroundsConfig.categories[bgState.type];
      const background = category.find(bg => bg.id === bgState.id);
      
      if (background) {
        (sceneManager as unknown as { changeBackground: (type: string, id: string, rgb?: number[], path?: string, foregroundPath?: string, wallCompensation?: number) => void })
          .changeBackground(bgState.type, bgState.id, background.rgb, background.path, (background as { foreground_path?: string }).foreground_path, (background as { wall_compensation?: number }).wall_compensation);
        
        // Apply lighting config on initial load
        if (background.lighting && 'applyLighting' in sceneManager) {
          (sceneManager as unknown as { applyLighting: (lighting: unknown) => void }).applyLighting(background.lighting);
        } else if ('resetLighting' in sceneManager) {
          (sceneManager as unknown as { resetLighting: () => void }).resetLighting();
        }
        
        // Set initial body class for blank wall controls visibility
        document.body.classList.toggle('room-blank-wall', bgState.id === 'blank_wall');
      }
    }
  }	
  
  /**
   * Subscribe to state changes
   */
  subscribe(callback: StateSubscriber): () => void {
    this._subscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this._subscribers.delete(callback);
    };
  }
	
	/**
   * Get art placement for current background state
   * Used by SceneManager during initial render
   */
  public getCurrentArtPlacement(): ArtPlacement | null {
    if (!this._state || !this._backgroundsConfig) return null;
    
    const archetypeId = this.getActiveArchetypeId();
    if (!archetypeId) return null;
    
    const backgroundKey = this._getBackgroundKeyForCache(this._state.ui.currentBackground);
    let artPlacement: ArtPlacement | undefined;
    
    // 1. Check placement_defaults for archetype-specific override
    if (this._placementDefaults) {
      const placementData = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.[backgroundKey];
      artPlacement = placementData?.art_placement;
      
      if (!artPlacement && backgroundKey !== 'paint_and_accent') {
        artPlacement = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.['paint_and_accent']?.art_placement;
      }
    }
    
    // 2. Fallback to background's default art_placement
    if (!artPlacement) {
      const bgType = this._state.ui.currentBackground.type;
      if (bgType === 'rooms') {
        const bgId = this._state.ui.currentBackground.id;
        const background = this._backgroundsConfig.categories.rooms.find(bg => bg.id === bgId);
        artPlacement = background?.art_placement;
      }
    }
    
    return artPlacement || null;
  }
	
	/**
	 * Wait for walnut textures to be ready (don't remove overlay until they're loaded)
	 */
	private async waitForWalnutTextures(): Promise<void> {
		if (!this._sceneManager || !this._woodMaterialsConfig) {
			console.warn('[Controller] Cannot wait for textures - sceneManager or config not available');
			return;
		}
		
		const textureCache = this._sceneManager ? (this._sceneManager as { _textureCache?: { getTexture: (path: string) => { isReady: () => boolean; onLoadObservable: { addOnce: (callback: () => void) => void } } } })._textureCache : undefined;
		if (!textureCache) {
			console.warn('[Controller] TextureCache not available');
			return;
		}
		
		const walnut = this._woodMaterialsConfig.species_catalog.find(s => s.id === 'walnut-black-american');
		
		if (!walnut) {
			console.warn('[Controller] Walnut species not found in catalog');
			return;
		}
		
		const basePath = this._woodMaterialsConfig.texture_config.base_texture_path;
		const sizeInfo = this._woodMaterialsConfig.texture_config.size_map.large;
		const albedoPath = `${basePath}/${walnut.id}/Varnished/${sizeInfo.folder}/Diffuse/wood-${walnut.wood_number}_${walnut.id}-varnished-${sizeInfo.dimensions}_d.png`;
		
		// Get the texture from cache
		if (!textureCache) return;
		
		const texture = textureCache.getTexture(albedoPath);
		
		if (texture.isReady()) {
			return; // Already ready
		}
		
		// Wait for texture to load
		return new Promise<void>((resolve) => {
			texture.onLoadObservable.addOnce(() => {
				resolve();
			});
			
			
			// Timeout after 5 seconds to prevent infinite wait
			setTimeout(() => {
				console.warn('[Controller] Walnut texture load timeout - proceeding anyway');
				resolve();
			}, 5000);
		});
	}
	
	/**
   * Handle committed audio (slice and/or vocal isolation)
   * Sends to backend, receives processed audio, triggers art generation
   */
  private async _handleAudioCommit(payload: {
    useSlice: boolean;
    startTime: number | null;
    endTime: number | null;
    isolateVocals: boolean;
    sliceBlob: Blob | null;
    originalFile?: File;
  }): Promise<void> {
    if (!this._state) return;
    
    // Determine source audio - Always prefer original file for desktop parity
    const audioFile = payload.originalFile || 
      (payload.sliceBlob ? new File([payload.sliceBlob], 'slice.wav', { type: 'audio/wav' }) : null);
    
    if (!audioFile) {
      console.error('[Controller] No audio file for commit');
      return;
    }
    
    // Show processing state
    if (payload.isolateVocals) {
      await this.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'demucs', progress: 0 }
      });
    } else {
      await this.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'uploading', progress: 0 }
      });
    }
    
    try {
      // Build form data
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('isolate_vocals', String(payload.isolateVocals));
      formData.append('remove_silence', String(payload.removeSilence));
      formData.append('silence_threshold', String(payload.silenceThreshold));
      formData.append('silence_min_duration', String(payload.silenceMinDuration));
      
      // Send timing if we are using the original file to ensure backend handles slicing (parity)
      const isOriginal = audioFile === payload.originalFile;
      if (isOriginal && payload.useSlice && payload.startTime !== null && payload.endTime !== null) {
        formData.append('start_time', String(payload.startTime));
        formData.append('end_time', String(payload.endTime));
      }
      
      // Call backend
      const response = await fetch('/api/audio/process-commit', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Audio processing failed: ${response.status}`);
      }
      
      // Get processed audio blob
      const processedBlob = await response.blob();
      const processedFile = new File([processedBlob], 'processed.wav', { type: 'audio/wav' });
      
      // PARITY FIX: The file is already processed (silence removed).
      // Update state snapshot to prevent double-processing in the main pipeline.
      const cleanState = structuredClone(this._state.composition);
      if (payload.removeSilence) {
        cleanState.audio_processing.remove_silence = false;
      }

      // Feed into existing upload pipeline
      await this.handleFileUpload(processedFile, cleanState);
      
    } catch (error) {
      console.error('[Controller] Audio commit failed:', error);
      await this.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'idle', progress: 0 }
      });
    }
  }
  
  /**
   * Handle file upload with backend processing
   * @param file - The uploaded audio file
   * @param uiSnapshot - UI state captured by main.ts before dispatch
   */
  private async handleFileUpload(file: File, uiSnapshot: CompositionStateDTO): Promise<void> {
    if (!this._state) return;

    PerformanceMonitor.start('total_upload_to_render');
    
    // Update UI to show uploading
    await this.dispatch({
      type: 'PROCESSING_UPDATE',
      payload: { stage: 'uploading', progress: 0 },
    });

    try {
			
			// Pause background texture loading during heavy operations
      if (this._idleTextureLoader && typeof (this._idleTextureLoader as IdleTextureLoader).pause === 'function') {
        (this._idleTextureLoader as IdleTextureLoader).pause();
      }
			
      PerformanceMonitor.start('backend_audio_processing');
			
      // Clear the audio cache
      this._audioCache.clearAll();
			
			// Clear composition cache on new audio upload
      this._compositionCache.clear();

      // Preserve current background selection during audio processing
      const currentBg = this._state.ui.currentBackground;
      if (this._backgroundsConfig && this._sceneManager && 'changeBackground' in this._sceneManager) {
        const changeBackground = (this._sceneManager as unknown as { changeBackground: (type: string, id: string, rgb?: number[], path?: string, foregroundPath?: string, wallCompensation?: number) => Promise<void> }).changeBackground;
        
        if (currentBg.type === 'rooms') {
          const room = this._backgroundsConfig.categories.rooms.find(r => r.id === currentBg.id);
          if (room) {
            await changeBackground.call(this._sceneManager, 'rooms', room.id, undefined, room.path, (room as { foreground_path?: string }).foreground_path, (room as { wall_compensation?: number }).wall_compensation);
          }
        } else if (currentBg.type === 'paint') {
          const paint = this._backgroundsConfig.categories.paint.find(p => p.id === currentBg.id);
          if (paint) {
            await changeBackground.call(this._sceneManager, 'paint', paint.id, (paint as { rgb?: number[] }).rgb, (paint as { path?: string }).path, undefined, undefined);
          }
        } else if (currentBg.type === 'accent') {
          const accent = this._backgroundsConfig.categories.accent.find(a => a.id === currentBg.id);
          if (accent) {
            await changeBackground.call(this._sceneManager, 'accent', accent.id, (accent as { rgb?: number[] }).rgb, (accent as { path?: string }).path, undefined, undefined);
          }
        }
      }

      // Process audio through facade
      const audioResponse: AudioProcessResponse = await this._facade.processAudio(
        file,
        uiSnapshot
      );
      PerformanceMonitor.end('backend_audio_processing');

      PerformanceMonitor.start('cache_raw_samples');
      // Cache the raw samples
      const sessionId = this._audioCache.cacheRawSamples(
        file,
        new Float32Array(audioResponse.raw_samples_for_cache)
      );
      PerformanceMonitor.end('cache_raw_samples');
      
      // Preserve section_materials from uiSnapshot (user's wood customizations)
      // Backend may return defaults; frontend owns material selections
      const preservedComposition = {
        ...audioResponse.updated_state,
        frame_design: {
          ...audioResponse.updated_state.frame_design,
          section_materials: uiSnapshot.frame_design?.section_materials 
            ?? audioResponse.updated_state.frame_design.section_materials
        }
      };
      
      // Dispatch the backend response with preserved materials
      await this.dispatch({
        type: 'FILE_PROCESSING_SUCCESS',
        payload: {
          composition: preservedComposition,
          maxAmplitudeLocal: audioResponse.max_amplitude_local,
          rawSamplesForCache: audioResponse.raw_samples_for_cache,
          audioSessionId: sessionId,
        },
      });
      
      /// Show "Preparing your custom art experience!" message
      await this.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'preparing_textures', progress: 0 },
      });			
			
      PerformanceMonitor.start('csg_generation_and_render');
			
			// Compare user's pre-upload UI choices with backend defaults
      const backendComp = audioResponse.updated_state;
      const changedParams = this._detectChangedParams(backendComp, uiSnapshot);
      
      if (changedParams.length > 0) {
        // User changed UI before upload, use their values
        await this.handleCompositionUpdate(uiSnapshot);
      } else {
        // UI matched defaults, trigger initial render
        const response = await this._facade.getSmartCSGData(
          preservedComposition,
          [],
          null
        );
        
        if (this._sceneManager) {
          await this._sceneManager.renderComposition(response);
          
          // Wait a frame to ensure render is actually visible
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
      }
      
      PerformanceMonitor.end('csg_generation_and_render');
      
      PerformanceMonitor.end('total_upload_to_render');
      
      // Reset processing stage after successful render
      await this.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'idle', progress: 0 },
      });
    } catch (error: unknown) {
      console.error('File upload or processing failed:', error);
      await this.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'idle', progress: 0 },
      });
    }
  }
  
  /**
   * Start discovery phase with autoplay
   */
  private startDiscoveryPhase(): void {
    // Clear any existing timers
    this.clearTimers();
    
    // Start autoplay after 1 second
    setTimeout(() => {
      this.startAutoplay();
    }, 1000);
    
    // Show hint after 3 seconds
    this._hintTimer = window.setTimeout(() => {
      void this.dispatch({ type: 'SHOW_HINT' });
    }, 3000);
  }
  
  /**
   * Start carousel autoplay
   */
  startAutoplay(): void {
    if (this._autoplayTimer) {
      clearInterval(this._autoplayTimer);
    }
    
    this._autoplayTimer = window.setInterval(() => {
      if (!this._state || !this._state.ui.isAutoPlaying) {
        this.stopAutoplay();
        return;
      }
      
      const styles = this._facade.getStyleOptions();
      const nextIndex = (this._state.ui.currentStyleIndex + 1) % styles.length;
      
      void this.dispatch({ type: 'STYLE_SELECTED', payload: nextIndex });
    }, 4000);
  }
  
  /**
   * Stop carousel autoplay
   */
  stopAutoplay(): void {
    if (this._autoplayTimer) {
      clearInterval(this._autoplayTimer);
      this._autoplayTimer = undefined;
    }
    
    if (this._state?.ui.isAutoPlaying) {
      void this.dispatch({ type: 'AUTOPLAY_TOGGLED', payload: false });
    }
  }
  
  /**
   * Handle user interaction (stops autoplay)
   */
  handleUserInteraction(): void {
    this.stopAutoplay();
  }
  
  /**
   * Select a specific style
   */
  selectStyle(index: number): void {
    this.handleUserInteraction();
    void this.dispatch({ type: 'STYLE_SELECTED', payload: index });
  }
  
  /**
   * Transition to customization phase
   */
  enterCustomizationPhase(): void {
    this.stopAutoplay();
    void this.dispatch({ type: 'PHASE_CHANGED', payload: 'customization' });
  }
  
  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this._autoplayTimer) {
      clearInterval(this._autoplayTimer);
      this._autoplayTimer = undefined;
    }
    
    if (this._hintTimer) {
      clearTimeout(this._hintTimer);
      this._hintTimer = undefined;
    }
  }
  
  /**
   * Handle side effects after state changes
   */
  private handleSideEffects(action: Action): void {
    switch (action.type) {
      case 'FILE_PROCESSING_SUCCESS':
        this.startDiscoveryPhase();
        break;

      case 'PHASE_CHANGED':
        if (action.payload === 'discovery') {
          this.startDiscoveryPhase();
        } else if (action.payload === 'customization') {
          this.clearTimers();
        }
        break;
    }
  }
  
  /**
   * Notify all subscribers of state change
   */
  private notifySubscribers(): void {	
    if (!this._state) return;
    
    this._subscribers.forEach(callback => {
      callback(this._state!);
    });
  }
	
	/**
   * Handle panel updates based on state changes
   * Called automatically when state changes affect UI
   */
  private handlePanelUpdates(state: ApplicationState): void {
    if (!this._panelStack) return;
    
    // Clear panels on phase change
    if (state.ui.phase === 'upload') {
      this._panelStack.clearStack();
    }
  }
	
	/**
   * Handle category selection from left panel
   * Clears right panel stack and renders category-specific content
   */
  handleCategorySelected(categoryId: string): void {
    if (!this._panelStack || !this._state) return;
    
    // Clear accordion state for the category being left
    const previousCategory = this._state.ui.activeCategory;
    if (previousCategory && previousCategory !== categoryId) {
      delete this._accordionState[previousCategory];
    }
    
    // Clear section selector when leaving WOOD category
    if (this._sectionSelectorPanel) {
      this._sectionSelectorPanel.destroy();
      this._sectionSelectorPanel = null;
    }
    
    // Disable section interaction when leaving WOOD category
    if (this._sceneManager && 'setSectionInteractionEnabled' in this._sceneManager) {
      (this._sceneManager as { setSectionInteractionEnabled: (enabled: boolean) => void }).setSectionInteractionEnabled(false);
      (this._sceneManager as { setSectionOverlaysVisible: (visible: boolean) => void }).setSectionOverlaysVisible(false);
    }
    
    void this.dispatch({ type: 'CATEGORY_SELECTED', payload: categoryId });
    
    // Render accordion for the new category
    this._renderAccordionForCategory(categoryId);
  }
	
	/**
   * Handle background selection from UI
   */
  handleBackgroundSelected(backgroundId: string, type: 'paint' | 'accent' | 'rooms'): void {
    if (!this._backgroundsConfig || !this._sceneManager) return;
    
    const category = this._backgroundsConfig.categories[type];
    const background = category?.find(bg => bg.id === backgroundId);
    
    if (!background) {
      console.error(`[Controller] Background not found: ${backgroundId}`);
      return;
    }
    
    // Handle paint/texture as wall finish update (applies to current room)
    if (type === 'paint') {
      this._currentWallFinishId = backgroundId;
      
      // Update state
      if (this._state) {
        this._state = {
          ...this._state,
          ui: {
            ...this._state.ui,
            currentWallFinish: backgroundId
          }
        };
        this._facade.persistState(this._state);
      }
      
      // Store wall finish in SceneManager
      if ('changeBackground' in this._sceneManager) {
        (this._sceneManager as unknown as { changeBackground: (type: string, id: string, rgb?: number[], path?: string, foregroundPath?: string, wallCompensation?: number) => void })
          .changeBackground('paint', backgroundId, background.rgb, background.path);
      }
      
			// Re-apply current room with new wall finish (use state, not _currentRoomId which may be stale)
			const currentBg = this._state?.ui.currentBackground;
			if (currentBg?.type === 'rooms') {
				const room = this._backgroundsConfig.categories.rooms.find(r => r.id === currentBg.id);
				if (room?.foreground_path) {
					(this._sceneManager as unknown as { changeBackground: (type: string, id: string, rgb?: number[], path?: string, foregroundPath?: string, wallCompensation?: number) => void })
						.changeBackground('rooms', currentBg.id, undefined, room.path, room.foreground_path, (room as { wall_compensation?: number }).wall_compensation);
				}
			}
      
      this.notifySubscribers();
      return;
    }
    
    // Handle room selection
    if (type === 'rooms') {
      this._currentRoomId = backgroundId;
      
      // Toggle body class for blank wall controls visibility
      document.body.classList.toggle('room-blank-wall', backgroundId === 'blank_wall');
    }
    
    // Update state
    if (this._state) {
      this._state = {
        ...this._state,
        ui: {
          ...this._state.ui,
          currentBackground: { type, id: backgroundId }
        }
      };
      this._facade.persistState(this._state);
      // NOTE: notifySubscribers called by handleCompositionUpdate below
    }
    
    // Apply to scene (deferred until after composition update to prevent flash of wrong size)
		const applyBackground = (): Promise<void> => {
			if ('changeBackground' in this._sceneManager) {
				return (this._sceneManager as unknown as { changeBackground: (type: string, id: string, rgb?: number[], path?: string, foregroundPath?: string, wallCompensation?: number) => Promise<void> })
					.changeBackground(type, backgroundId, background.rgb, background.path, (background as { foreground_path?: string }).foreground_path, (background as { wall_compensation?: number }).wall_compensation);
			}
			return Promise.resolve();
		};
    
    // Apply placement defaults and caching if archetype is selected
    if (this._state) {
      const archetypeId = this.getActiveArchetypeId();
      
      // Only apply caching if archetype exists
      if (archetypeId) {
        const backgroundKey = this._getBackgroundKeyForCache({ id: backgroundId, type });
        const cacheKey = this._getCacheKey(archetypeId, backgroundKey);
        
        let composition = this._compositionCache.get(cacheKey);
        
        if (!composition) {
					// Cache miss: preserve current user-modified state without applying defaults
					// Defaults are ONLY applied during archetype selection, not background changes
					composition = structuredClone(this._state.composition);
					
					// Clamp to scene constraints (new scene may have tighter limits)
          if (this._resolver) {
            const sliderConfigs = this._resolver.resolveSliderConfigs(archetypeId, composition);
            const sizeOrWidth = sliderConfigs.find(s => s.id === 'width' || s.id === 'size');
            const sizeOrHeight = sliderConfigs.find(s => s.id === 'height' || s.id === 'size');
            if (sizeOrWidth) composition.frame_design.finish_x = Math.min(composition.frame_design.finish_x, sizeOrWidth.max);
            if (sizeOrHeight) composition.frame_design.finish_y = Math.min(composition.frame_design.finish_y, sizeOrHeight.max);
          }
          
          // Cache the current state as-is to preserve user modifications
          this._compositionCache.set(cacheKey, composition);
				} else {
					// Cache hit: restore cached composition but preserve current backing state
					const currentBacking = this._state.composition.frame_design.backing;
					composition = {
						...composition,
						frame_design: {
							...composition.frame_design,
							backing: currentBacking
						}
					};
				}

				let artPlacement: ArtPlacement | undefined;
				
				// 1. Check placement_defaults for archetype-specific override
				if (this._placementDefaults) {
					const placementData = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.[backgroundKey];
					artPlacement = placementData?.art_placement;
					
					if (!artPlacement && backgroundKey !== 'paint_and_accent') {
						artPlacement = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.['paint_and_accent']?.art_placement;
					}
				}
				
				// 2. Fallback to background's default art_placement
				if (!artPlacement && this._backgroundsConfig) {
					if (type === 'rooms') {
						const background = this._backgroundsConfig.categories.rooms.find(bg => bg.id === backgroundId);
						artPlacement = background?.art_placement;
					}
				}

				const applyArtAndLighting = () => {
						if (artPlacement && 'applyArtPlacement' in this._sceneManager) {
							(this._sceneManager as unknown as { applyArtPlacement: (placement: ArtPlacement) => void }).applyArtPlacement(artPlacement);
						} else if ('resetArtPlacement' in this._sceneManager) {
							(this._sceneManager as unknown as { resetArtPlacement: () => void }).resetArtPlacement();
						}

						if (background?.lighting && 'applyLighting' in this._sceneManager) {
							(this._sceneManager as unknown as { applyLighting: (lighting: unknown) => void }).applyLighting(background.lighting);
						} else if ('resetLighting' in this._sceneManager) {
							(this._sceneManager as unknown as { resetLighting: () => void }).resetLighting();
						}
					};
				void this.handleCompositionUpdate(composition).then(applyBackground).then(applyArtAndLighting);
      } else {
        // No archetype: apply background directly and notify
        void applyBackground();
        this.notifySubscribers();
      }
    }
    
    // Re-render panel to show updated selection (skip if accordion handles rendering)
    if (!this._accordion) {
      this._renderRightMainFiltered();
    }
  }
	
	/**
   * Update left secondary panel position based on main panel width
   */
  private _updateLeftSecondaryPosition(): void {
    if (!this._leftMainPanel || !this._leftSecondaryPanel) return;
    
    // Calculate position based on main panel's actual width
    const mainRect = this._leftMainPanel.getBoundingClientRect();
    const gap = 16; 
    
    // Determine the gap based on CSS logic (8px initial offset + width + gap)
    // Here we just use the right edge of the main panel + gap
    this._leftSecondaryPanel.style.left = `${mainRect.right + gap}px`;
  }
  
  /**
   * Render subcategory accordion for a category
   * Replaces the horizontal subcategory tab bar with vertical accordion
   * @private
   */
  private _renderAccordionForCategory(categoryId: string): void {
    if (!this._categoriesConfig || !this._rightMainPanel) return;
    
    const categoryConfig = this._categoriesConfig[categoryId as keyof CategoriesConfig];
    if (!categoryConfig) return;
    
    // Destroy previous accordion
    if (this._accordion) {
      this._accordion.destroy();
      this._accordion = null;
    }
    
    // Hide legacy left secondary panel
    if (this._leftSecondaryPanel) {
      this._leftSecondaryPanel.style.display = 'none';
      this._leftSecondaryPanel.classList.remove('visible');
    }
    
    // Build accordion items from subcategories
    const items = this._buildAccordionItems(categoryId);
    if (items.length === 0) {
      this._rightMainPanel.innerHTML = '<div class="panel-placeholder">No options available</div>';
      return;
    }
    
    // Get initial open state
    const initialState = this._getInitialAccordionState(categoryId);
    
    // Create accordion
    this._accordion = new SubcategoryAccordion({
      categoryId,
      items,
      initialOpenState: initialState,
      onToggle: (subcategoryId, isOpen) => this._handleAccordionToggle(categoryId, subcategoryId, isOpen)
    });
    
    // Render into right main panel
    this._rightMainPanel.innerHTML = '';
    this._rightMainPanel.appendChild(this._accordion.render());
    this._rightMainPanel.style.display = 'block';
    this._rightMainPanel.classList.add('visible');
    
    // Auto-select first subcategory if none selected
    if (!this._state?.ui.activeSubcategory && items.length > 0) {
      const firstEnabled = items.find(i => !i.isDisabled);
      if (firstEnabled) {
        void this.dispatch({ 
          type: 'SUBCATEGORY_SELECTED', 
          payload: { category: categoryId, subcategory: firstEnabled.id } 
        });
      }
    }
  }
	
	/**
   * Build accordion item configurations from category subcategories
   * @private
   */
  private _buildAccordionItems(categoryId: string): AccordionItemConfig[] {
    if (!this._categoriesConfig) return [];
    
    const categoryConfig = this._categoriesConfig[categoryId as keyof CategoriesConfig];
    if (!categoryConfig) return [];
    
    const items: AccordionItemConfig[] = [];
    
    // Sort subcategories by order
    const sortedSubcategories = Object.entries(categoryConfig.subcategories)
      .map(([id, config]) => ({ id, config }))
      .sort((a, b) => (a.config.order ?? 99) - (b.config.order ?? 99));
    
    for (const { id: subcategoryId, config: subcategory } of sortedSubcategories) {
      const item: AccordionItemConfig = {
        id: subcategoryId,
        label: subcategory.label,
        getValue: () => this._getSubcategoryDisplayValue(categoryId, subcategoryId),
        isDisabled: !!subcategory.note,
        isSingle: sortedSubcategories.length === 1,
        helpText: subcategory.panel_help,
        getContent: async () => this._renderSubcategoryContent(categoryId, subcategoryId)
      };
      
      items.push(item);
    }
    
    return items;
  }

	/**
   * Render Left Secondary Panel without dispatching actions
   * Pure rendering method for state restoration
   * @private
   */
  private _renderLeftSecondaryPanel(
    categoryId: string,
    selectedSubcategoryId: string | null
  ): void {
    if (!this._categoriesConfig || !this._leftSecondaryPanel) return;
    
    const categoryConfig = this._categoriesConfig[categoryId as keyof CategoriesConfig];
    if (!categoryConfig) return;
    
    const subcategories = Object.entries(categoryConfig.subcategories)
      .map(([id, config]) => ({ id, config }));
    
    if (subcategories.length === 0) {
      this._leftSecondaryPanel.style.display = 'none';
      return;
    }
    
    void import('./components/LeftSecondaryPanel').then(({ LeftSecondaryPanel }) => {
      const panel = new LeftSecondaryPanel(
        subcategories,
        selectedSubcategoryId,
        (id: string) => this._handleSubcategorySelected(id)
      );
      
      if (this._leftSecondaryPanel) {
        this._leftSecondaryPanel.innerHTML = '';
        this._leftSecondaryPanel.appendChild(panel.render());
        this._leftSecondaryPanel.style.display = 'block';
        this._leftSecondaryPanel.classList.add('visible');
        this._updateLeftSecondaryPosition();
        
        requestAnimationFrame(() => {
          if (this._sceneManager && 'updateCameraOffset' in this._sceneManager) {
            (this._sceneManager as { updateCameraOffset: () => void }).updateCameraOffset();
          }
        });
      }
    }).catch((error: unknown) => {
      console.error('[Controller] Failed to render Left Secondary Panel:', error);
    });
  }
  
  /**
   * Get display value for subcategory header
   * @private
   */
  private _getSubcategoryDisplayValue(categoryId: string, subcategoryId: string): string {
    if (!this._state) return '';
    
    const composition = this._state.composition;
    const ui = this._state.ui;
    
    const key = `${categoryId}:${subcategoryId}`;
    
    switch (key) {
      case 'wood:panel': {
        const shape = composition.frame_design.shape || 'circular';
        const numSections = composition.frame_design.number_sections || 1;
        const pattern = composition.pattern_settings.slot_style || 'radial';
        return `${this._capitalize(shape)}, ${numSections} panel${numSections > 1 ? 's' : ''}, ${this._capitalize(pattern)}`;
      }
      
      case 'wood:wood_species': {
        const mat = composition.frame_design.section_materials?.[0];
        if (!mat) return '';
        const speciesName = this._getSpeciesDisplayName(mat.species);
        const grain = this._capitalize(mat.grain_direction);
        return `${speciesName}, ${grain}`;
      }
      
      case 'wood:layout': {
        const w = composition.frame_design.finish_x;
        const h = composition.frame_design.finish_y;
        const slots = composition.pattern_settings.number_slots;
        return w && h ? `${w}" × ${h}", ${slots} Elements` : '';
      }
      
      case 'wood:backing': {
        if (!composition.frame_design.backing?.enabled) return 'None';
        const backing = composition.frame_design.backing;
        const typeLabel = this._capitalize(backing.type);
        const finishLabel = this._capitalize(backing.material);
        return `${typeLabel}, ${finishLabel}`;
      }
      
      case 'wood:frames':
        return 'Coming Soon';
				
			case 'audio:custom': {
        if (this._audioSlicerPanel) {
          const filename = this._audioSlicerPanel.getLoadedFilename();
          if (filename) return filename;
        }
        return composition.audio_source?.source_file || 'Choose audio file';
      }
      
      case 'audio:slicing': {
        if (this._audioSlicerPanel) {
          const selection = this._audioSlicerPanel.getSelectionDisplay();
          if (selection) return selection;
        }
        const src = composition.audio_source;
        if (src?.start_time > 0 || src?.end_time > 0) {
          const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
          return `${fmt(src.start_time)} → ${fmt(src.end_time)}`;
        }
        return 'Optional';
      }

      case 'audio:collections': {
        const collId = ui.selectedCollectionId;
        const recId = ui.selectedRecordingId;
        if (!collId || !this._collectionsCatalog) return 'Browse catalog';
        const coll = this._collectionsCatalog.collections.find(c => c.id === collId);
        if (!coll) return 'Browse catalog';
        const rec = coll.recordings.find(r => r.id === recId);
        return rec ? `${coll.title} - ${rec.artist}` : coll.title;
      }
      
      case 'backgrounds:paint': {
        const wallFinishId = ui.currentWallFinish;
        if (!wallFinishId) return '';
        return this._getBackgroundDisplayName('paint', wallFinishId);
      }
      
      case 'backgrounds:accent':
      case 'backgrounds:rooms': {
        const bg = ui.currentBackground;
        if (!bg) return '';
        if (bg.type !== subcategoryId) return '';
        return this._getBackgroundDisplayName(bg.type, bg.id);
      }
      
      default:
        return '';
    }
  }
  
  /**
   * Capitalize first letter of string
   * @private
   */
  private _capitalize(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  /**
   * Get display name for species
   * @private
   */
  private _getSpeciesDisplayName(speciesId: string): string {
    if (!this._woodMaterialsConfig) return speciesId;
    const species = this._woodMaterialsConfig.species_catalog.find(s => s.id === speciesId);
    return species?.display || speciesId;
  }
  
  /**
   * Get display name for backing material
   * @private
   */
  private _getBackingDisplayName(materialId: string): string {
    // Simple fallback - could be enhanced with backing config lookup
    return this._capitalize(materialId.replace(/-/g, ' '));
  }
  
  /**
   * Get display name for background
   * @private
   */
  private _getBackgroundDisplayName(type: string, id: string): string {
    if (!this._backgroundsConfig) return id;
    const category = this._backgroundsConfig.categories[type as keyof typeof this._backgroundsConfig.categories];
    if (!category) return id;
    const bg = (category as Array<{ id: string; name?: string; label?: string }>).find(b => b.id === id);
    return bg?.name || bg?.label || id;
  }
  
  /**
   * Handle accordion toggle event
   * @private
   */
  private _handleAccordionToggle(categoryId: string, subcategoryId: string, isOpen: boolean): void {
    // Persist accordion state to both local cache and UI state
    if (!this._accordionState[categoryId]) {
      this._accordionState[categoryId] = {};
    }
    this._accordionState[categoryId][subcategoryId] = isOpen;
    
    // Persist to UI state for storage
    if (this._state) {
      this._state = {
        ...this._state,
        ui: {
          ...this._state.ui,
          accordionState: { ...this._accordionState }
        }
      };
      this._facade.persistState(this._state);
    }
    
    // Update active subcategory when opened
    if (isOpen) {
      void this.dispatch({
        type: 'SUBCATEGORY_SELECTED',
        payload: { category: categoryId, subcategory: subcategoryId }
      });
      
      // Enable/disable section interaction based on config
      if (this._sceneManager && 'setSectionInteractionEnabled' in this._sceneManager) {
        const enableInteraction = this._isSectionSelectionEnabled(categoryId, subcategoryId);
        (this._sceneManager as { setSectionInteractionEnabled: (enabled: boolean) => void }).setSectionInteractionEnabled(enableInteraction);
        (this._sceneManager as { setSectionOverlaysVisible: (visible: boolean) => void }).setSectionOverlaysVisible(enableInteraction);
        if (!enableInteraction) {
          (this._sceneManager as { clearSelection: () => void }).clearSelection();
        }
      }
      
      // Scroll to selected item in horizontal scroll container
      requestAnimationFrame(() => {
        const content = this._accordion?.getContentElement(subcategoryId);
        const scrollContainer = content?.querySelector('.horizontal-scroll') as HTMLElement;
        if (scrollContainer) {
          this._scrollToSelectedInContainer(scrollContainer);
        }
      });
    }
  }
  
  /**
   * Get initial accordion open state for a category
   * @private
   */
  private _getInitialAccordionState(categoryId: string): Record<string, boolean> {
    // Return persisted state if exists
    if (this._accordionState[categoryId]) {
      return { ...this._accordionState[categoryId] };
    }
    
    // Default: first subcategory open
    if (!this._categoriesConfig) return {};
    
    const categoryConfig = this._categoriesConfig[categoryId as keyof CategoriesConfig];
    if (!categoryConfig) return {};
    
    const subcategories = Object.entries(categoryConfig.subcategories)
      .sort((a, b) => (a[1].order ?? 99) - (b[1].order ?? 99));
    
    const state: Record<string, boolean> = {};
    subcategories.forEach(([id]) => {
      // All subcategories closed by default
      state[id] = false;
    });
    
    return state;
  }
  
  /**
   * Render subcategory content for accordion
   * @private
   */
  private async _renderSubcategoryContent(categoryId: string, subcategoryId: string): Promise<HTMLElement> {
    const container = document.createElement("div");
    container.className = "subcategory-content-inner";
    
    // Note: SUBCATEGORY_SELECTED dispatch handled by _handleAccordionToggle
    
    // Look up option config from categories config
    const catConfig = this._categoriesConfig?.[categoryId as keyof typeof this._categoriesConfig];
    const subConfig = catConfig?.subcategories?.[subcategoryId];
    const optionConfig = subConfig?.options ? Object.values(subConfig.options)[0] : undefined;
    
    await this._renderSubcategoryContentInner(container, categoryId, subcategoryId, optionConfig);
    
    // Render sticky toolbar AFTER content (prepend to preserve position)
    const toolbar = this._getSubcategoryToolbar(categoryId, subcategoryId);
    if (toolbar) {
      const toolbarWrapper = document.createElement('div');
      toolbarWrapper.className = 'subcategory-toolbar--sticky';
      toolbarWrapper.appendChild(toolbar);
      container.insertBefore(toolbarWrapper, container.firstChild);
    }
    
    return container;
  }
  
  /**
   * Internal content rendering for subcategory
   * @private
   */
  private async _renderSubcategoryContentInner(
    container: HTMLElement,
    categoryId: string,
    subcategoryId: string
  ): Promise<void> {
    if (!this._categoriesConfig || !this._state) return;
    
    const categoryConfig = this._categoriesConfig[categoryId as keyof CategoriesConfig];
    const subcategory = categoryConfig?.subcategories[subcategoryId];
    if (!subcategory) return;
    
    // Handle placeholder subcategories
    if (subcategory.note) {
      container.innerHTML = `<div class="panel-placeholder"><p>${subcategory.note}</p></div>`;
      return;
    }
    
    // Use existing _renderRightMainFiltered logic adapted for accordion
    // For now, render a simple placeholder - full implementation connects to existing renderers
    const optionKey = Object.keys(subcategory.options)[0];
    const optionConfig = subcategory.options[optionKey];
    
    if (!optionConfig) {
      container.innerHTML = '<div class="panel-placeholder">No options configured</div>';
      return;
    }
    
    // Render based on option type - reuse existing component creation
    switch (optionConfig.type) {
      case 'thumbnail_grid':
        await this._renderThumbnailGridContent(container, categoryId, subcategoryId, optionConfig);
        break;
      case 'slider_group':
        this._renderSliderGroupContent(container);
        break;
      case 'species_selector':
        await this._renderSpeciesSelectorContent(container);
        break;
      case 'backing_swatches':
        await this._renderBackingSwatchesContent(container);
        break;
      case 'archetype_grid':
        await this._renderArchetypeGridContent(container, categoryId, subcategoryId);
        break;
      case 'wood_species_image_grid':
        await this._renderSpeciesGridContent(container);
        break;
      case 'backing_selector':
        await this._renderBackingSelectorContent(container);
        break;
      case 'tour_launcher':
        await this._renderTourLauncherContent(container);
        break;
      case 'audio_upload':
        await this._renderAudioUploadContent(container);
        break;
			case 'audio_trimmer':
        await this._renderAudioTrimmerContent(container);
        break;
      case 'collections_browser':
        await this._renderCollectionsContent(container);
        break;
      default:
        container.innerHTML = `<div class="panel-placeholder">Content type: ${optionConfig.type}</div>`;
    }
  }
	
	/**
   * Get toolbar element for a subcategory (rendered inside content area)
   * @private
   */
  private _getSubcategoryToolbar(categoryId: string, subcategoryId: string): HTMLElement | null {
    if (!this._categoriesConfig) return null;
    
    const categoryConfig = this._categoriesConfig[categoryId as keyof CategoriesConfig];
    const subcategory = categoryConfig?.subcategories[subcategoryId];
    if (!subcategory) return null;
    
    // Section selector toolbar for wood species
		if (categoryId === 'wood' && subcategoryId === 'wood_species') {
			return this._createSectionSelectorToolbar();
		}
		
		// Filter toolbar for any subcategory with filters
		if (subcategory.filters && Object.keys(subcategory.filters).length > 0) {
			return this._createFilterToolbar(categoryId, subcategoryId, subcategory.filters);
		}
			
		return null;
  }
  
  /**
   * Create filter toolbar for accordion header
   * @private
   */
  private _createFilterToolbar(
    categoryId: string,
    subcategoryId: string,
    filters: Record<string, import('./types/PanelTypes').FilterConfig>
  ): HTMLElement | null {
    const filterGroups = this._buildFilterIconGroups(filters);
    if (filterGroups.length === 0) return null;
    
    const filterKey = `${categoryId}_${subcategoryId}`;
    const stateFilters = this._state?.ui.filterSelections[filterKey] || {};
    const activeFiltersMap = new Map<string, Set<string>>();
    Object.entries(stateFilters).forEach(([filterId, selections]) => {
      activeFiltersMap.set(filterId, new Set(selections));
    });
    
    const strip = new FilterIconStrip(
      filterGroups,
      activeFiltersMap,
      (groupId, selections) => this._handleFilterSelected(groupId, selections, categoryId, subcategoryId),
      true // compact mode
    );
    
    return strip.render();
  }
  
  /**
   * Create section selector toolbar for accordion header
   * @private
   */
  private _createSectionSelectorToolbar(): HTMLElement | null {
    if (!this._state || !this._sceneManager) return null;
    
    const numberSections = this._state.composition.frame_design.number_sections;
    if (numberSections <= 1) return null;
    
    const shape = this._state.composition.frame_design.shape;
    const selectedSections = (this._sceneManager as unknown as { getSelectedSections: () => Set<number> }).getSelectedSections();
    
    // Destroy previous selector if exists
    if (this._sectionSelectorPanel) {
      this._sectionSelectorPanel.destroy();
    }
    
    const selector = new SectionSelectorPanel(
      this,
      numberSections,
      shape,
      selectedSections,
      (newSelection) => this._handleSectionSelectionFromUI(newSelection),
      true // inline mode
    );
    
    // Store reference for external updates (e.g., canvas click-to-clear)
    this._sectionSelectorPanel = selector;
    
    return selector.render();
  }
  
  /**
   * Create backing toggle toolbar for accordion header
   * @private
   */
  private _createBackingToggleToolbar(): HTMLElement | null {
    if (!this._state) return null;
    
    const isEnabled = this._state.composition.frame_design.backing?.enabled ?? false;
    
    // Create toggle inline (BackingPanel static method requires async import)
    const toggle = document.createElement('label');
    toggle.className = 'toggle-switch';
    toggle.innerHTML = `
      <input type="checkbox" ${isEnabled ? 'checked' : ''}>
      <span class="toggle-slider"></span>
    `;
    
    const checkbox = toggle.querySelector('input')!;
    checkbox.addEventListener('change', () => {
      void this._handleBackingToggle(checkbox.checked);
    });
    
    return toggle;
  }
  
  /**
   * Handle backing toggle from accordion toolbar
   * @private
   */
  private async _handleBackingToggle(enabled: boolean): Promise<void> {
    if (!this._state) return;
    
    const newComposition = {
      ...this._state.composition,
      frame_design: {
        ...this._state.composition.frame_design,
        backing: {
          ...this._state.composition.frame_design.backing,
          enabled
        }
      }
    };
    
    await this.handleCompositionUpdate(newComposition);
    
    // Update accordion value display
    if (this._accordion) {
      this._accordion.updateValue('backing');
    }
  }
	
	/**
   * Render tour launcher content for accordion
   * @private
   */
  private async _renderTourLauncherContent(container: HTMLElement): Promise<void> {
    const { TourLauncherPanel } = await import('./components/TourLauncherPanel');
    const tourPanel = new TourLauncherPanel(this, this._sceneManager);
    container.innerHTML = '';
    container.appendChild(tourPanel.render());
  }
	
	/**
   * Render audio slicer content for accordion
   * @private
   */
  private async _ensureAudioSlicerPanel(): Promise<void> {
    if (!this._audioSlicerPanel && this._state) {
      const { AudioSlicerPanel } = await import('./components/AudioSlicerPanel');
      this._audioSlicerPanel = new AudioSlicerPanel(this, {
        silenceThreshold: this._state.composition.audio_processing.silence_threshold,
        silenceDuration: this._state.composition.audio_processing.silence_duration,
        removeSilence: this._state.composition.audio_processing.remove_silence
      });
    }
  }

  private async _renderAudioTrimmerContent(container: HTMLElement): Promise<void> {
    await this._ensureAudioSlicerPanel();
    if (!this._audioSlicerPanel) return;
    container.innerHTML = '';
    container.appendChild(this._audioSlicerPanel.renderTrimmerSection());
  }
	
	private async _renderAudioUploadContent(container: HTMLElement): Promise<void> {
    await this._ensureAudioSlicerPanel();
    if (!this._audioSlicerPanel) return;
    container.innerHTML = '';
    container.appendChild(this._audioSlicerPanel.renderUploadSection());
  }
	
	/**
   * Update audio accordion header value (called from AudioSlicerPanel)
   */
  public updateAudioAccordionValue(subcategoryId: string): void {
    if (this._accordion) {
      this._accordion.updateValue(subcategoryId);
    }
  }

	/**
   * Open next audio accordion (called from AudioSlicerPanel CTA buttons)
   */
  public openNextAudioAccordion(currentSubcategory: string): void {
    const nextMap: Record<string, string> = {
      'custom': 'slicing'
    };
    const next = nextMap[currentSubcategory];
    if (next && this._accordion) {
      this._accordion.setOpen(currentSubcategory, false);
      this._accordion.setOpen(next, true);
    }
  }

  /**
   * Render upload interface content for accordion
   * @private
   */
  private async _renderUploadInterfaceContent(container: HTMLElement): Promise<void> {
    const { UploadPanel } = await import('./components/UploadPanel');
    const uploadPanel = new UploadPanel(this, this._audioCache);
    container.innerHTML = '';
    container.appendChild(uploadPanel.render());
  }

  /**
   * Render collections content for accordion
   * @private
   */
  private async _renderCollectionsContent(container: HTMLElement): Promise<void> {
    // Load catalog if not cached
    if (!this._collectionsCatalog) {
      try {
        const { CollectionsCatalogSchema } = await import('./types/schemas');
        const response = await fetch('/config/collections_catalog.json');
        const data = await response.json();
        this._collectionsCatalog = CollectionsCatalogSchema.parse(data);
      } catch (error) {
        console.error('[Controller] Failed to load collections catalog:', error);
        container.innerHTML = '<div class="panel-placeholder"><p>Failed to load collections</p></div>';
        return;
      }
    }

    // Get active category filter
    const filterKey = `${this._state.ui.activeCategory}_${this._state.ui.activeSubcategory}`;
    const stateFilters = this._state.ui.filterSelections[filterKey] || {};
    const activeFilter = stateFilters['collection_type']?.[0] || null;
    
    // Route to artist view if selected
    if (activeFilter === 'artist') {
      await this._renderArtistCollections(container);
      return;
    }
    
    // Filter collections by category (show all if no filter active)
    const collections = activeFilter
      ? this._collectionsCatalog.collections.filter(c => c.category === activeFilter)
      : this._collectionsCatalog.collections;
    const selectedId = this._state?.ui.selectedCollectionId || null;
    const selectedRecId = this._state?.ui.selectedRecordingId || null;

    // Create scroll container for cards
    const scrollContainer = new HorizontalScrollContainer();
    const scrollWrapper = scrollContainer.render();
    const scrollElement = scrollContainer.getScrollElement()!;

    collections.forEach(item => {
      const card = new AccordionCollectionCard({
        config: item as CollectionCardConfig,
        selected: item.id === selectedId,
        onSelect: (collectionId, recordingId) => {
          void this._handleCollectionSelected(collectionId, recordingId);
        }
      });
      scrollElement.appendChild(card.render());
    });

    container.innerHTML = '';
    container.appendChild(scrollWrapper);

    // Render variant selector area (persistent)
    const variantArea = document.createElement('div');
    variantArea.className = 'collection-variant-area';

		// Clean up previous variant selector
    if (this._collectionVariantSelector) {
      this._collectionVariantSelector.destroy();
      this._collectionVariantSelector = null;
    }
    
    const selectedCollection = collections.find(c => c.id === selectedId);
    if (selectedCollection && selectedCollection.recordings.length > 1) {
      const capturedCollectionId = selectedId!;
      this._collectionVariantSelector = new CollectionVariantSelector({
        recordings: selectedCollection.recordings,
        selectedRecordingId: selectedRecId,
        onSelect: (recordingId) => {
          void this._handleCollectionRecordingSelected(capturedCollectionId, recordingId);
        }
      });
      variantArea.appendChild(this._collectionVariantSelector.render());
    } else {
      variantArea.innerHTML = '<div class="variant-selector-empty">Select a track above</div>';
    }
    
    container.appendChild(variantArea);
    scrollContainer.scrollToSelected();
  }

	/**
   * Render artist-centric collection view
   * Groups recordings by artist, cards are artists, chips are songs
   * @private
   */
  private async _renderArtistCollections(container: HTMLElement): Promise<void> {
    if (!this._collectionsCatalog || !this._state) return;

    const catalog = this._collectionsCatalog;
    const artistMap = new Map<string, {
      id: string;
      name: string;
      thumbnail: string;
      songs: Array<{ collectionId: string; title: string; recordingUrl: string }>;
    }>();

    // Group recordings by artist
    catalog.collections.forEach(collection => {
      collection.recordings.forEach(recording => {
        const artistId = recording.artistId;
        if (!artistId) return;

        if (!artistMap.has(artistId)) {
          const artistMeta = catalog.artists?.[artistId];
          artistMap.set(artistId, {
            id: artistId,
            name: artistMeta?.name || recording.artist,
            thumbnail: artistMeta?.thumbnail || '',
            songs: []
          });
        }
        artistMap.get(artistId)!.songs.push({
          collectionId: collection.id,
          title: collection.title,
          recordingUrl: recording.url
        });
      });
    });

    const selectedArtistId = this._state.ui.selectedCollectionId || null;

    // Create scroll container for artist cards
    const scrollContainer = new HorizontalScrollContainer();
    const scrollWrapper = scrollContainer.render();
    const scrollElement = scrollContainer.getScrollElement()!;

    artistMap.forEach(artist => {
      const card = document.createElement('button');
      card.className = 'accordion-card collection-card artist-card';
      card.dataset.collectionId = artist.id;
      if (artist.id === selectedArtistId) {
        card.classList.add('selected');
      }

      const visual = document.createElement('div');
      visual.className = 'collection-card-visual artist-visual';
      if (artist.thumbnail) {
        const img = document.createElement('img');
        img.src = artist.thumbnail;
        img.alt = artist.name;
        img.loading = 'lazy';
        visual.appendChild(img);
      }
      card.appendChild(visual);

      const info = document.createElement('div');
      info.className = 'collection-card-info';
      const title = document.createElement('div');
      title.className = 'collection-card-title';
      title.textContent = artist.name;
      info.appendChild(title);
      const meta = document.createElement('div');
      meta.className = 'collection-card-meta';
      meta.textContent = `${artist.songs.length} song${artist.songs.length > 1 ? 's' : ''}`;
      info.appendChild(meta);
      card.appendChild(info);

      card.addEventListener('click', () => {
        this._handleArtistSelected(artist.id);
      });

      scrollElement.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(scrollWrapper);

    // Variant area for song chips
    const variantArea = document.createElement('div');
    variantArea.className = 'collection-variant-area';

    if (this._collectionVariantSelector) {
      this._collectionVariantSelector.destroy();
      this._collectionVariantSelector = null;
    }

    const selectedArtist = selectedArtistId ? artistMap.get(selectedArtistId) : null;
    if (selectedArtist && selectedArtist.songs.length > 0) {
      const songChips = document.createElement('div');
      songChips.className = 'variant-chip-container';
      
      const label = document.createElement('span');
      label.className = 'variant-selector-label';
      label.textContent = 'song:';
      variantArea.appendChild(label);

      selectedArtist.songs.forEach(song => {
        const chip = document.createElement('button');
        chip.className = 'variant-chip';
        chip.textContent = song.title;
        chip.addEventListener('click', () => {
          void this._loadCollectionAudio(song.recordingUrl, song.title);
        });
        songChips.appendChild(chip);
      });
      variantArea.appendChild(songChips);
    } else {
      variantArea.innerHTML = '<div class="variant-selector-empty">Select an artist above</div>';
    }

    container.appendChild(variantArea);
    scrollContainer.scrollToSelected();
  }
	
	/**
   * Handle collection track selection
   * @private
   */
  private async _handleCollectionSelected(collectionId: string, recordingId: string): Promise<void> {
    if (!this._state || !this._collectionsCatalog) return;

    const collection = this._collectionsCatalog.collections.find(c => c.id === collectionId);
    if (!collection) return;

    const recording = recordingId ? collection.recordings.find(r => r.id === recordingId) : null;
    
    // Multi-recording with no selection: update UI state but don't load audio
    if (!recording && collection.recordings.length > 1) {
      this._state = {
        ...this._state,
        ui: {
          ...this._state.ui,
          selectedCollectionId: collectionId,
          selectedRecordingId: null
        }
      };
      
      // Update variant selector
      const variantArea = document.querySelector('.collection-variant-area');
      if (variantArea) {
        if (this._collectionVariantSelector) {
          this._collectionVariantSelector.destroy();
        }
        this._collectionVariantSelector = new CollectionVariantSelector({
          recordings: collection.recordings,
          selectedRecordingId: null,
          onSelect: (recId) => {
            void this._handleCollectionRecordingSelected(collectionId, recId);
          }
        });
        variantArea.innerHTML = '';
        variantArea.appendChild(this._collectionVariantSelector.render());
      }
      
      // Update card selection visually
      const scrollContainer = document.querySelector('.subcategory-content-inner .horizontal-scroll');
      scrollContainer?.querySelectorAll('.collection-card').forEach(card => {
        card.classList.toggle('selected', (card as HTMLElement).dataset.collectionId === collectionId);
      });
      
      if (this._accordion) {
        this._accordion.updateValue('collections');
      }
      return;
    }
    
    if (!recording) return;

    // Update UI state
    this._state = {
      ...this._state,
      ui: {
        ...this._state.ui,
        selectedCollectionId: collectionId,
        selectedRecordingId: recordingId
      }
    };

    // Update variant selector (always recreate to capture correct collectionId in callback)
    const variantArea = document.querySelector('.collection-variant-area');
    if (variantArea && collection.recordings.length > 1) {
      if (this._collectionVariantSelector) {
        this._collectionVariantSelector.destroy();
      }
      this._collectionVariantSelector = new CollectionVariantSelector({
        recordings: collection.recordings,
        selectedRecordingId: recordingId,
        onSelect: (recId) => {
          void this._handleCollectionRecordingSelected(collectionId, recId);
        }
      });
      variantArea.innerHTML = '';
      variantArea.appendChild(this._collectionVariantSelector.render());
    } else if (variantArea && collection.recordings.length === 1) {
      if (this._collectionVariantSelector) {
        this._collectionVariantSelector.destroy();
      }
      variantArea.innerHTML = '<div class="variant-selector-empty">Single recording</div>';
      this._collectionVariantSelector = null;
    }

    // Update card selection visually
    const scrollContainer = document.querySelector('.subcategory-content-inner .horizontal-scroll');
    scrollContainer?.querySelectorAll('.collection-card').forEach(card => {
      card.classList.toggle('selected', (card as HTMLElement).dataset.collectionId === collectionId);
    });

    // Load audio file
    await this._loadCollectionAudio(recording.url, collection.title);

    // Update accordion header
    if (this._accordion) {
      this._accordion.updateValue('collections');
    }
  }

	/**
   * Handle artist card selection in artist view
   * @private
   */
  private _handleArtistSelected(artistId: string): void {
    if (!this._state) return;

    this._state = {
      ...this._state,
      ui: {
        ...this._state.ui,
        selectedCollectionId: artistId,
        selectedRecordingId: null
      }
    };

    // Update card selection visually
    const scrollContainer = document.querySelector('.subcategory-content-inner .horizontal-scroll');
    scrollContainer?.querySelectorAll('.collection-card').forEach(card => {
      card.classList.toggle('selected', (card as HTMLElement).dataset.collectionId === artistId);
    });

    // Refresh content to show song chips
    if (this._accordion) {
      this._accordion.refreshContent('collections');
    }
  }

  /**
   * Handle recording variant selection
   * @private
   */
  private async _handleCollectionRecordingSelected(collectionId: string, recordingId: string): Promise<void> {
    if (!this._state || !this._collectionsCatalog) return;

    const collection = this._collectionsCatalog.collections.find(c => c.id === collectionId);
    if (!collection) return;

    const recording = collection.recordings.find(r => r.id === recordingId);
    if (!recording) return;

    // Update state
    this._state = {
      ...this._state,
      ui: {
        ...this._state.ui,
        selectedRecordingId: recordingId
      }
    };

    // Load the new recording
    await this._loadCollectionAudio(recording.url, collection.title);
    
    // Update accordion header
    if (this._accordion) {
      this._accordion.updateValue('collections');
    }
  }

  /**
   * Load audio from collection URL
   * @private
   */
  private async _loadCollectionAudio(url: string, title: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const blob = await response.blob();
      const filename = url.split('/').pop() || `${title}.mp3`;
      const ext = filename.split('.').pop()?.toLowerCase();
      const mimeMap: Record<string, string> = {
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'flac': 'audio/flac',
        'ogg': 'audio/ogg'
      };
      const mimeType = blob.type || mimeMap[ext || ''] || 'audio/mpeg';
      const file = new File([blob], filename, { type: mimeType });
      
      // Ensure AudioSlicerPanel exists
      await this._ensureAudioSlicerPanel();
      
      // Use existing AudioSlicerPanel to load
      if (this._audioSlicerPanel) {
        this._audioSlicerPanel.loadAudioFile(file);
      }
    } catch (error) {
      console.error('[Controller] Failed to load collection audio:', error);
      // Show error without replacing variant selector
      const variantArea = document.querySelector('.collection-variant-area');
      if (variantArea) {
        const existingError = variantArea.querySelector('.collection-load-error');
        if (existingError) existingError.remove();
        const msg = document.createElement('div');
        msg.className = 'collection-load-error';
        msg.style.cssText = 'color: #c0392b; font-size: 11px; margin-top: 8px;';
        msg.textContent = `Audio not found: ${url}`;
        variantArea.appendChild(msg);
      }
    }
  }

	/**
   * Render backing selector content for accordion
   * @private
   */
  private async _renderBackingSelectorContent(container: HTMLElement): Promise<void> {
    if (!this._state) {
      container.innerHTML = '<div class="panel-placeholder">Loading backing options...</div>';
      return;
    }
    
    const backing = this._state.composition.frame_design.backing || {
      enabled: false,
      type: 'acrylic',
      material: 'clear',
      inset: 0.5
    };
    
    const { BackingPanel } = await import('./components/BackingPanel');
    
    const backingPanel = new BackingPanel(
      backing.enabled,
      backing.type,
      backing.material,
      (option: string, value: unknown) => {
        if (option === 'backing_enabled') {
          void this._updateBackingEnabled(value as boolean);
        } else if (option === 'backing_material') {
          const { type, material } = value as { type: string; material: string };
          void this._updateBackingMaterial(type, material);
        }
        if (this._accordion) {
          this._accordion.updateValue('backing');
        }
      },
      true // horizontal
    );
    
    container.innerHTML = '';
    container.appendChild(backingPanel.render());
  }
	
	/**
   * Render species grid content for accordion
   * @private
   */
  private async _renderSpeciesGridContent(container: HTMLElement): Promise<void> {
    if (!this._woodMaterialsConfig || !this._state) {
      container.innerHTML = '<div class="panel-placeholder">Loading species...</div>';
      return;
    }
    
    const materials = this._state.composition.frame_design.section_materials || [];
    const currentSpecies = materials[0]?.species || this._woodMaterialsConfig.default_species;
    const currentGrain = materials[0]?.grain_direction || this._woodMaterialsConfig.default_grain_direction;
    
    const scrollContainer = new HorizontalScrollContainer();
    const scrollWrapper = scrollContainer.render();
    const scrollElement = scrollContainer.getScrollElement()!;
    
    const shape = this._state.composition.frame_design.shape;
    const numSections = this._state.composition.frame_design.number_sections;
    
    const allGrainDefs = [
      { id: 'n1_vertical', direction: 'vertical' },
      { id: 'n1_horizontal', direction: 'horizontal' },
      { id: 'n4_radiant', direction: 'radiant' },
      { id: 'n4_diamond', direction: 'diamond' }
    ];
    const archetypeId = this.getActiveArchetypeId();
    const archetype = archetypeId ? this._archetypes.get(archetypeId) : null;
    const availableGrains = (archetype as { available_grains?: string[] })?.available_grains ?? ['vertical', 'horizontal'];
    const grainDefs = allGrainDefs.filter(g => availableGrains.includes(g.direction));
    
    this._woodMaterialsConfig.species_catalog.forEach(species => {
      const grains = grainDefs.map(g => ({
        id: g.id,
        direction: g.direction,
        thumbnailUrl: `/wood_thumbnails_small/${species.id}_${g.id}.png`,
        largeThumbnailUrl: `/wood_thumbnails_large/${species.id}_${g.id}.png`
      }));
      
      const card = new AccordionSpeciesCard({
				config: { id: species.id, label: species.display, grains },
				selectedSpecies: currentSpecies,
				selectedGrain: currentGrain,
        onSelect: (speciesId, grainDir) => {
          void (async () => {
            await this._updateWoodMaterial('species', speciesId);
            await this._updateWoodMaterial('grain_direction', grainDir);
            if (this._accordion) this._accordion.updateValue('wood_species');
          })();
        }
      });
      scrollElement.appendChild(card.render());
    });
    
    container.innerHTML = '';
    container.appendChild(scrollWrapper);
    scrollContainer.scrollToSelected();
  }
	
	/**
   * Render archetype grid content for accordion
   * @private
   */
  private async _renderArchetypeGridContent(container: HTMLElement, categoryId?: string, subcategoryId?: string): Promise<void> {
    if (!this._state || !this._archetypes) {
      container.innerHTML = '<div class="panel-placeholder">Loading styles...</div>';
      return;
    }
    
    const effectiveCategory = categoryId ?? this._state.ui.activeCategory;
    const effectiveSubcategory = subcategoryId ?? this._state.ui.activeSubcategory;
    const filterKey = `${effectiveCategory}_${effectiveSubcategory}`;
    const stateFilters = this._state.ui.filterSelections[filterKey] || {};
    
    const matchingArchetypes = Array.from(this._archetypes.values())
      .filter(archetype => {
        const activeShapes = stateFilters.shape ? new Set(stateFilters.shape) : new Set();
        if (activeShapes.size > 0 && !activeShapes.has(archetype.shape)) return false;
        
        const activePatterns = stateFilters.slot_pattern ? new Set(stateFilters.slot_pattern) : new Set();
        if (activePatterns.size > 0 && !activePatterns.has(archetype.slot_style)) return false;
        
        return true;
      })
      .map(archetype => ({
        id: archetype.id,
        label: archetype.label,
        thumbnailUrl: archetype.thumbnail,
        disabled: false,
        tooltip: archetype.tooltip
      }));
    
    const activeSelection = this.getActiveArchetypeId();
    
    const scrollContainer = new HorizontalScrollContainer();
    const scrollWrapper = scrollContainer.render();
    const scrollElement = scrollContainer.getScrollElement()!;
    
    matchingArchetypes.forEach(arch => {
      const card = new AccordionStyleCard({
        config: {
          id: arch.id,
          label: arch.label,
          thumbnailUrl: arch.thumbnailUrl,
          disabled: arch.disabled,
          tooltip: arch.tooltip
        },
        selected: arch.id === activeSelection,
        onSelect: (id) => { void this._handleArchetypeSelected(id); }
      });
      scrollElement.appendChild(card.render());
    });
    
    container.innerHTML = '';
    container.appendChild(scrollWrapper);
    scrollContainer.scrollToSelected();
  }
	
	/**
   * Scroll horizontal container to center the selected item
   * @private
   */
  private _scrollToSelectedInContainer(scrollContainer: HTMLElement): void {
    requestAnimationFrame(() => {
      const selected = scrollContainer.querySelector('.selected') as HTMLElement;
      if (!selected) return;
      
      const containerRect = scrollContainer.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();
      const scrollLeft = scrollContainer.scrollLeft;
      
      const targetScroll = scrollLeft +
        (selectedRect.left - containerRect.left) -
        (containerRect.width / 2) +
        (selectedRect.width / 2);
      
      scrollContainer.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: 'instant'
      });
    });
  }
  
  /**
   * Render thumbnail grid content for accordion
   * @private
   */
  private async _renderThumbnailGridContent(
    container: HTMLElement,
    categoryId: string,
    subcategoryId: string,
    _optionConfig: unknown
  ): Promise<void> {
    // Handle backgrounds category
    if (categoryId === 'backgrounds') {
      await this._renderBackgroundsContent(container, subcategoryId);
      return;
    }
    
    // Handle other thumbnail grids (style archetypes, etc.)
    container.innerHTML = '<div class="panel-placeholder">Content not yet implemented</div>';
  }
  
  /**
   * Render backgrounds content (paint, accent, rooms)
   * @private
   */
  private async _renderBackgroundsContent(container: HTMLElement, subcategoryId: string): Promise<void> {
    if (!this._backgroundsConfig) {
      container.innerHTML = '<div class="panel-placeholder">Loading backgrounds...</div>';
      return;
    }
    
    const type = subcategoryId as 'paint' | 'accent' | 'rooms';
    const backgrounds = this._backgroundsConfig.categories[type];
    
    if (!backgrounds || backgrounds.length === 0) {
      container.innerHTML = '<div class="panel-placeholder">No backgrounds available</div>';
      return;
    }
    
    const currentBg = this._state?.ui.currentBackground;
    let selectedId: string | null = null;
    if (type === 'paint') {
      selectedId = this._state?.ui.currentWallFinish || this._backgroundsConfig.default_wall_finish;
    } else if (currentBg?.type === type) {
      selectedId = currentBg.id;
    }
    
    // Create horizontal scroll container
    const scrollContainer = new HorizontalScrollContainer();
    const scrollWrapper = scrollContainer.render();
    const scrollElement = scrollContainer.getScrollElement()!;
    
    backgrounds.forEach(bg => {
      const card = this._createBackgroundCard(bg, type, selectedId === bg.id);
      scrollElement.appendChild(card);
    });
    
    container.innerHTML = '';
    container.appendChild(scrollWrapper);
    scrollContainer.scrollToSelected();
  }
  
  /**
   * Create a background card element
   * @private
   */
  private _createBackgroundCard(
    bg: { id: string; name: string; rgb?: number[]; path?: string },
    type: 'paint' | 'accent' | 'rooms',
    isSelected: boolean
  ): HTMLElement {
    const card = document.createElement('button');
    card.className = `accordion-card ${type === 'paint' ? 'paint-card' : type === 'accent' ? 'accent-card' : 'room-card'}`;
    if (isSelected) card.classList.add('selected');
    card.dataset.itemId = bg.id;
    
    if (type === 'paint') {
      // Paint: color swatch
      const swatch = document.createElement('div');
      swatch.className = 'paint-card-swatch';
      if (bg.rgb) {
        const [r, g, b] = bg.rgb.map(v => Math.round(v * 255));
        swatch.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
      }
      card.appendChild(swatch);
      
      const label = document.createElement('span');
      label.className = 'paint-card-label';
      label.textContent = bg.name;
      card.appendChild(label);
      
    } else if (type === 'accent') {
      // Accent: texture thumbnail
      const img = document.createElement('img');
      img.className = 'accent-card-image';
      img.src = bg.path || '';
      img.alt = bg.name;
      img.loading = 'lazy';
      card.appendChild(img);
      
      const label = document.createElement('span');
      label.className = 'accent-card-label';
      label.textContent = bg.name;
      card.appendChild(label);
      
    } else {
      // Rooms: scene thumbnail
      const img = document.createElement('img');
      img.className = 'room-card-image';
      img.src = bg.path || '';
      img.alt = bg.name;
      img.loading = 'lazy';
      card.appendChild(img);
      
      const label = document.createElement('span');
      label.className = 'room-card-label';
      label.textContent = bg.name;
      card.appendChild(label);
    }
    
    // Tooltip on hover
    card.addEventListener('mouseenter', () => {
      if (!this._helpTooltip) return;
      const content = document.createElement('div');
      content.className = 'tooltip-content-wrapper';
      if (bg.path && type !== 'paint') {
        const preview = document.createElement('img');
        preview.src = bg.path;
        preview.alt = bg.name;
        content.appendChild(preview);
      } else if (bg.rgb) {
        const swatch = document.createElement('div');
        swatch.className = 'tooltip-color-swatch';
        const [r, g, b] = bg.rgb.map(v => Math.round(v * 255));
        swatch.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
        content.appendChild(swatch);
      }
      const desc = document.createElement('p');
      desc.className = 'tooltip-description';
      desc.textContent = bg.name;
      content.appendChild(desc);
      const tooltipClass = type === 'paint' ? 'tooltip-paint' : type === 'accent' ? 'tooltip-accent' : 'tooltip-rooms';
      this._helpTooltip.show(content, card, 'left', tooltipClass, 0, 0, true, 'canvas');
    });
    card.addEventListener('mouseleave', () => this._helpTooltip?.hide());

    // Click handler
    card.addEventListener('click', () => {
      this._helpTooltip?.hide();
      this.handleBackgroundSelected(bg.id, type);
      
      // Update selection visually
      card.closest('.horizontal-scroll')?.querySelectorAll('.accordion-card').forEach(c => {
        c.classList.remove('selected');
      });
      card.classList.add('selected');
      
      // Update accordion value display
      if (this._accordion) {
        this._accordion.updateValue(type);
      }
    });
    
    return card;
  }
  
  /**
   * Set up scroll fade indicators
   * @private
   */
  private _setupScrollFades(wrapper: HTMLElement, scrollEl: HTMLElement): void {
    const updateFades = () => {
      const canScrollLeft = scrollEl.scrollLeft > 1;
      const canScrollRight = scrollEl.scrollLeft < scrollEl.scrollWidth - scrollEl.clientWidth - 1;
      wrapper.classList.toggle('can-scroll-left', canScrollLeft);
      wrapper.classList.toggle('can-scroll-right', canScrollRight);
    };
    
    scrollEl.addEventListener('scroll', updateFades, { passive: true });
    
    // Initial check after layout
    requestAnimationFrame(updateFades);
  }
  
  /**
   * Render slider group content for accordion
   * @private
   */
  private _renderSliderGroupContent(container: HTMLElement): void {
    if (!this._state || !this._resolver) return;
    
    const archetypeId = this.getActiveArchetypeId();
    if (!archetypeId) return;
    
    const sliderConfigs = this._resolver.resolveSliderConfigs(archetypeId, this._state.composition);
    
    const sliderGroup = new SliderGroup(
      sliderConfigs,
      (id, value) => void this._updateStateValue(id, value),
      this._state.composition.frame_design.number_sections,
      this._state.composition.pattern_settings.slot_style
    );
    
    const wrapper = document.createElement('div');
    wrapper.className = 'slider-card';
    wrapper.appendChild(sliderGroup.render());
    container.appendChild(wrapper);
  }
  
  /**
   * Render species selector content for accordion
   * @private
   */
  private async _renderSpeciesSelectorContent(container: HTMLElement): Promise<void> {
    // This will be connected to WoodMaterialSelector with horizontal mode
    container.innerHTML = '<div class="horizontal-scroll"><div class="panel-placeholder">Species selector loading...</div></div>';
  }
  
  /**
   * Render backing swatches content for accordion
   * @private
   */
  private async _renderBackingSwatchesContent(container: HTMLElement): Promise<void> {
    // This will be connected to BackingPanel content in horizontal mode
    container.innerHTML = '<div class="horizontal-scroll"><div class="panel-placeholder">Backing options loading...</div></div>';
  }
  
  /**
   * Handle STYLE category selection (four-panel architecture)
   * @private
   */
	private _handleStyleCategorySelected(): void {
    // DEPRECATED: Accordion now handles category rendering via _renderAccordionForCategory
    // Keeping method signature for backward compatibility during transition
    return;
    
    /* Original implementation preserved for reference:
    if (!this._categoriesConfig || !this._state?.ui.activeCategory || !this._thumbnailConfig) return;
    const categoryConfig = this._categoriesConfig[this._state.ui.activeCategory as keyof CategoriesConfig];
    if (!categoryConfig) return;
		
		const subcategories = Object.entries(categoryConfig.subcategories).map(([id, config]) => ({ id, config }));
    
		// Auto-select subcategory based on current state
    // BUT: Don't override if we already restored a saved subcategory
    const currentComposition = this._state?.composition;
    if (currentComposition && !this._state.ui.activeSubcategory) {
      if (subcategories.length === 1) {
        // Correctly select the single subcategory for Layout, Wood, etc.
        const subcategoryId = subcategories[0].id;
        void this.dispatch({ type: 'SUBCATEGORY_SELECTED', payload: { category: this._state.ui.activeCategory, subcategory: subcategoryId } });
      }
    }
    
    // Hide legacy panel stack
		if (this._panelStack) {
			this._panelStack.clearStack();
		}
		const stackContainer = document.getElementById('right-panel-stack');
		if (stackContainer) {
			stackContainer.style.display = 'none';
		}
		
		// Auto-select the first subcategory if one isn't already active for this category
      if (!this._state.ui.activeSubcategory && subcategories.length > 0) {
        const subcategoryId = subcategories[0].id;
        void this.dispatch({ type: 'SUBCATEGORY_SELECTED', payload: { category: this._state.ui.activeCategory, subcategory: subcategoryId } });
      }
      
      // Defer rendering to the next tick to ensure all state is consistent
      requestAnimationFrame(() => {
        if (this._state?.ui.activeSubcategory) {
          this._handleSubcategorySelected(this._state.ui.activeSubcategory);
        }
      });

    if (subcategories.length === 1) {
      // Auto-select single subcategory, hide secondary panel
      if (this._leftSecondaryPanel) {
        this._leftSecondaryPanel.style.display = 'none';
        this._leftSecondaryPanel.classList.remove('visible');
      }			
			// Update camera offset after panel hides
      requestAnimationFrame(() => {
        if (this._sceneManager && 'updateCameraOffset' in this._sceneManager) {
          (this._sceneManager as { updateCameraOffset: () => void }).updateCameraOffset();
        }
      });
      // Single-subcategory rendering handled by deferred requestAnimationFrame above
    } else if (subcategories.length > 1) {
      // Show placeholder and subcategory choices for multiple options
      if (this._rightMainPanel) {
        this._rightMainPanel.innerHTML = '<div class="panel-content"><div style="padding: 40px 20px; text-align: center; color: rgba(255, 255, 255, 0.6);"><div style="font-size: 48px; margin-bottom: 16px;">←</div><div style="font-size: 16px; font-weight: 500;">Select a subcategory</div></div></div>';
        this._rightMainPanel.style.display = 'block';
      }
      void import('./components/LeftSecondaryPanel').then(({ LeftSecondaryPanel }) => {
        const panel = new LeftSecondaryPanel(subcategories, this._state?.ui.activeSubcategory || null, (id: string) => this._handleSubcategorySelected(id));
        if (this._leftSecondaryPanel) {
          this._leftSecondaryPanel.innerHTML = '';
          this._leftSecondaryPanel.appendChild(panel.render());
          this._leftSecondaryPanel.style.display = 'block';
          this._leftSecondaryPanel.classList.add('visible');
          this._updateLeftSecondaryPosition();
        }
				
				// Update camera offset after panel visibility changes
        requestAnimationFrame(() => {
          if (this._sceneManager && 'updateCameraOffset' in this._sceneManager) {
            (this._sceneManager as { updateCameraOffset: () => void }).updateCameraOffset();
          }
        });
      }).catch((error: unknown) => console.error('[Controller] Failed to load LeftSecondaryPanel:', error));
    } else {
      // No subcategories found, show placeholder
      if (this._leftSecondaryPanel) {
        this._leftSecondaryPanel.style.display = 'none';
        this._leftSecondaryPanel.classList.remove('visible');
      }
      if (this._rightMainPanel) {
        this._rightMainPanel.innerHTML = '<div class="panel-content"><div class="panel-placeholder"><p>No options available for this category yet.</p></div></div>';
        this._rightMainPanel.style.display = 'block';
      }
    }
    */
  }
  
  /**
   * Handle subcategory selection (Left Secondary → Right Secondary + Right Main)
   * @private
   */
  private _handleSubcategorySelected(subcategoryId: string): void {
    // Skip legacy rendering when accordion is active
    if (this._accordion) return;
    
    if (!this._categoriesConfig || !this._state?.ui.activeCategory) {
      return;
    }
    
    const categoryConfig = this._categoriesConfig[this._state.ui.activeCategory as keyof CategoriesConfig];
    if (!categoryConfig) {
      return;
    }

    // Dispatch state update
    void this.dispatch({ type: 'SUBCATEGORY_SELECTED', payload: { category: this._state.ui.activeCategory, subcategory: subcategoryId } });

    // Enable/disable section interaction and overlays based on UI state
    if (this._sceneManager && 'setSectionInteractionEnabled' in this._sceneManager) {
      const enableInteraction = this._state.ui.activeCategory === 'wood' && subcategoryId === 'wood_species';
      (this._sceneManager as { setSectionInteractionEnabled: (enabled: boolean) => void }).setSectionInteractionEnabled(enableInteraction);
      (this._sceneManager as { setSectionOverlaysVisible: (visible: boolean) => void }).setSectionOverlaysVisible(enableInteraction);
      
      // Trigger tutorial pulse when entering Wood Species
      if (enableInteraction && 'playTutorialPulse' in this._sceneManager) {
        (this._sceneManager as unknown as { playTutorialPulse: () => void }).playTutorialPulse();
      }
    }

    // Re-render the LeftSecondaryPanel immediately to show the new selection
    const subcategories = Object.entries(categoryConfig.subcategories).map(([id, config]) => ({ id, config }));
    void import('./components/LeftSecondaryPanel').then(({ LeftSecondaryPanel }) => {
      const panel = new LeftSecondaryPanel(
        subcategories,
        this._state?.ui.activeSubcategory || null, // Pass the updated selection from state
        (id: string) => this._handleSubcategorySelected(id)
      );
      if (this._leftSecondaryPanel) {
        this._leftSecondaryPanel.innerHTML = '';
        this._leftSecondaryPanel.appendChild(panel.render());
      }
    });

    const subcategory = categoryConfig.subcategories[subcategoryId];
    if (!subcategory) return;

    // Always render the main panel after subcategory selection
    this._renderRightMainFiltered();
  }
	
	/**
   * Render section selector in Right Secondary panel for wood species selection
   * Only shown when WOOD > Species is active AND number_sections > 1
   * @private
   */
  private _renderSectionSelector(): void {
    if (!this._rightSecondaryPanel || !this._sceneManager) return;
    
    // Only show for WOOD > Species subcategory
    if (this._state?.ui.activeCategory !== 'wood' || this._state?.ui.activeSubcategory !== 'wood_species') {
      this._rightSecondaryPanel.style.display = 'none';
      return;
    }
    
    const state = this.getState();
    const numberSections = state.composition.frame_design.number_sections;
    const shape = state.composition.frame_design.shape;
    
    // Only show for n > 1
    if (numberSections <= 1) {
      this._rightSecondaryPanel.style.display = 'none';
      return;
    }
    
    // Get current selection from SceneManager
    const selectedSections = (this._sceneManager as unknown as { getSelectedSections: () => Set<number> }).getSelectedSections();
    
    // Clear and render new selector
    this._rightSecondaryPanel.innerHTML = '';
    
    void import('./components/SectionSelectorPanel').then(({ SectionSelectorPanel }) => {
      const selector = new SectionSelectorPanel(
        this,
        numberSections,
        shape,
        selectedSections,
        (newSelection: Set<number>) => {
          // Handle icon click → update SceneManager
          this._handleSectionSelectionFromUI(newSelection);
        }
      );
      
      this._sectionSelectorPanel = selector;
      this._rightSecondaryPanel!.appendChild(selector.render());
			this._rightSecondaryPanel!.classList.add('visible');
			this._rightMainPanel!.classList.add('has-toolbar');
			
    }).catch((error: unknown) => {
      console.error('[Controller] Failed to load SectionSelectorPanel:', error);
    });
  }

	/**
   * Enable/disable section interaction based on current navigation
   * Only enabled for WOOD > Wood & Grain
   * @private
   */
  private _updateSectionInteractionState(): void {
    if (!this._sceneManager) return;
    
    const sm = this._sceneManager as unknown as {
      setSectionInteractionEnabled: (enabled: boolean) => void;
      setSectionOverlaysVisible: (visible: boolean) => void;
      clearSelection: () => void;
    };
    
    const enableInteraction = this._isSectionSelectionEnabled();
    
    sm.setSectionInteractionEnabled(isWoodSpecies);
    
    if (!isWoodSpecies) {
      sm.setSectionOverlaysVisible(false);
      sm.clearSelection();
    }
  }

	/**
   * Check if subcategory enables section selection
   * @private
   */
  private _isSectionSelectionEnabled(categoryId?: string, subcategoryId?: string): boolean {
    if (!this._categoriesConfig) return false;
    
    const catId = categoryId ?? this._state?.ui.activeCategory;
    const subId = subcategoryId ?? this._state?.ui.activeSubcategory;
    
    if (!catId || !subId) return false;
    
    const category = this._categoriesConfig[catId as keyof CategoriesConfig];
    if (!category) return false;
    
    const subcategory = category.subcategories[subId];
    return subcategory?.enables_section_selection === true;
  }
  
  /**
   * Handle section selection from UI icons
   * Updates SceneManager which will sync overlays
   * @private
   */
  private _handleSectionSelectionFromUI(newSelection: Set<number>): void {
    if (!this._sceneManager) return;
    
    const sceneManager = this._sceneManager as unknown as {
      clearSelection: () => void;
      toggleSection: (index: number) => void;
      getSelectedSections: () => Set<number>;
      updateSectionUI: (selection: Set<number>) => void;
    };
    
    // Clear current selection
    sceneManager.clearSelection();
    
    // Apply new selection
    newSelection.forEach(index => {
      sceneManager.toggleSection(index);
    });
    
    // Sync controller state
    this.selectSection(sceneManager.getSelectedSections());
    
    // Update white dot overlays
    sceneManager.updateSectionUI(sceneManager.getSelectedSections());
  }
  
  /**
   * Handle filter selection (Icon strip → updates Right Main display only)
   * CRITICAL: Does NOT update composition state
   * @private
   */
  private _handleFilterSelected(filterId: string, selections: Set<string>, categoryId?: string, subcategoryId?: string): void {
    const effectiveCategory = categoryId ?? this._state?.ui.activeCategory;
    const effectiveSubcategory = subcategoryId ?? this._state?.ui.activeSubcategory;
    if (!effectiveSubcategory || !effectiveCategory) return;
    
    // Dispatch filter change
    void this.dispatch({ 
      type: 'FILTER_CHANGED', 
      payload: { 
        category: effectiveCategory,
        subcategory: effectiveSubcategory,
        filterId,
        selections: Array.from(selections)
      }
    });
    
    // Re-render Right Main with new filter combination
    if (!this._accordion) {
      this._renderRightMainFiltered();
    } else {
      // Refresh accordion content for the filter's owning subcategory
      this._accordion.refreshContent(effectiveSubcategory);
    }
  }
	
	/**
   * Build filter icon groups from subcategory filter config
   * @private
   */
  private _buildFilterIconGroups(filters: Record<string, import('./types/PanelTypes').FilterConfig>): FilterIconGroup[] {
    const groups: FilterIconGroup[] = [];
    
    // Build shape filter group (Panel Shape)
    if (filters.shape) {
      groups.push({
        id: 'shape',
        type: 'shape',
        label: 'Panel Shape',
        icons: filters.shape.options.map(opt => ({
        id: opt.id,
        svgPath: `/assets/icons/${opt.id === 'circular' ? 'circle' : opt.id === 'rectangular' ? 'rectangle' : 'diamond'}.svg`,
        tooltip: opt.tooltip || `${opt.label} Panel`,
        stateValue: opt.id
      }))
      });
    }
    
    // Build slot_pattern filter group (Waveform Pattern)
    if (filters.slot_pattern) {
      groups.push({
        id: 'slot_pattern',
        type: 'waveform',
        label: 'Waveform Pattern',
        icons: filters.slot_pattern.options.map(opt => ({
					id: opt.id,
					svgPath: `/assets/icons/${opt.id}.svg`,
					tooltip: opt.tooltip || `${opt.label} Waveform`,
					stateValue: opt.id
				}))
      });
    }
    
    // Build collection_type filter group (Category buttons)
    if (filters.collection_type) {
      groups.push({
        id: 'collection_type',
        type: 'category',
        label: filters.collection_type.label,
        icons: filters.collection_type.options.map(opt => ({
          id: opt.id,
          svgPath: `/assets/icons/${opt.id}.svg`,
          tooltip: opt.tooltip || opt.label,
          stateValue: opt.id
        }))
      });
    }
    
    return groups;
  }
  
  /**
   * Handle icon filter change from FilterIconStrip
   * @private
   */
  private _handleIconFilterChange(groupId: string, selections: Set<string>): void {
    this._handleFilterSelected(groupId, selections);
  }
  
  /**
   * Render Right Main panel with current filter combination
   * @private
   */
  private _renderRightMainFiltered(): void {
		if (!this._categoriesConfig || !this._state?.ui.activeCategory || !this._state.ui.activeSubcategory || !this._rightMainPanel) return;

		const categoryConfig = this._categoriesConfig[this._state.ui.activeCategory as keyof CategoriesConfig];
		const subcategory = categoryConfig?.subcategories[this._state.ui.activeSubcategory];
		if (!subcategory) return;

		// Increment render ID to invalidate pending async renders
		const currentRenderId = ++this._renderId;

		// CRITICAL: Destroy previous component to clean up tooltips/timers
		if (this._activeRightPanelComponent) {
			this._activeRightPanelComponent.destroy();
			this._activeRightPanelComponent = null;
		}

		// Preserve scroll position from the actual scrollable content area
    const scrollableContent = this._rightMainPanel.querySelector('.panel-content-scrollable') as HTMLElement;
    const scrollTop = scrollableContent?.scrollTop || 0;

    // Hide help tooltip when changing panels
    this._helpTooltip?.hide();

    this._rightMainPanel.innerHTML = '';
		this._rightMainPanel.classList.remove('has-toolbar');
		
		// Clear section selector panel when changing subcategories
		if (this._rightSecondaryPanel) {
			this._rightSecondaryPanel.innerHTML = '';
			this._rightSecondaryPanel.style.display = 'none';
			this._rightSecondaryPanel.classList.remove('visible');
			this._rightSecondaryPanel.style.height = '';
			this._rightSecondaryPanel.style.minHeight = '';
			this._rightSecondaryPanel.style.bottom = '';
		}
		if (this._sectionSelectorPanel) {
			this._sectionSelectorPanel.destroy();
			this._sectionSelectorPanel = null;
		}
		
		// Panel header removed - help icon now in subcategory bar (LeftSecondaryPanel)
		
		// Render filter icon strip if filters exist - OUTSIDE panel-content
		if (subcategory.filters && Object.keys(subcategory.filters).length > 0) {
			const filterGroups = this._buildFilterIconGroups(subcategory.filters);
			if (filterGroups.length > 0) {
				// Convert state filter selections to Map<string, Set<string>> for FilterIconStrip
				const filterKey = `${this._state.ui.activeCategory}_${this._state.ui.activeSubcategory}`;
				const stateFilters = this._state.ui.filterSelections[filterKey] || {};
				const activeFiltersMap = new Map<string, Set<string>>();
				Object.entries(stateFilters).forEach(([filterId, selections]) => {
					activeFiltersMap.set(filterId, new Set(selections));
				});
				
				this._filterIconStrip = new FilterIconStrip(
					filterGroups,
					activeFiltersMap,
					(groupId, iconId) => this._handleIconFilterChange(groupId, iconId)
				);
				this._rightSecondaryPanel!.appendChild(this._filterIconStrip.render());
				this._rightSecondaryPanel!.classList.add('visible');
				this._rightMainPanel.classList.add('has-toolbar');
			}
		}
		
		const panelContent = document.createElement('div');
		panelContent.className = 'panel-content panel-content-scrollable';

		// Check for a placeholder note
		if (subcategory.note) {
			panelContent.innerHTML = `<div class="panel-placeholder"><p>${subcategory.note}</p></div>`;
			this._rightMainPanel.appendChild(panelContent);
			this._rightMainPanel.style.display = 'block';
			this._rightMainPanel.classList.add('visible');
			
			// Restore scroll position
			requestAnimationFrame(() => {
				if (this._rightMainPanel) {
					this._rightMainPanel.scrollTop = scrollTop;
				}
			});
			return;
		}

    // Generic content rendering
    const optionKey = Object.keys(subcategory.options)[0];
    const optionConfig = subcategory.options[optionKey];

    if (optionConfig) {
      switch (optionConfig.type) {
        case 'slider_group': {
          // Resolve slider configurations dynamically based on the current archetype
          const archetypeId = this.getActiveArchetypeId();
          let sliderConfigs: SliderConfig[] = [];
          if (this._resolver && archetypeId && this._state) {
            sliderConfigs = this._resolver.resolveSliderConfigs(
              archetypeId,
              this._state.composition
            );
          }
          const sliderGroup = new SliderGroup(
            sliderConfigs,
            (id, value) => {
              void this._updateStateValue(id, value);
            },
            this._state.composition.frame_design.number_sections,
            this._state.composition.pattern_settings.slot_style
          );
          panelContent.appendChild(sliderGroup.render());
          
          // Add aspect ratio lock control if shape allows it
          const shape = this._state.composition.frame_design.shape;
          const uiConfig = window.uiEngine?.config as { dimension_constraints?: Record<string, { allow_aspect_lock?: boolean }> } | undefined;
          const shapeConstraints = uiConfig?.dimension_constraints?.[shape];
          const allowLock = shapeConstraints?.allow_aspect_lock ?? false;
          
          if (allowLock) {
            const lockControl = new AspectRatioLock(
              this._state.ui.aspectRatioLocked ?? false,
              true, // enabled
              (locked) => this._handleAspectRatioLockChange(locked)
            );
            panelContent.appendChild(lockControl.render());
          }
          
          break;
        }

				case 'wood_species_image_grid': {
					if (this._woodMaterialsConfig && this._state) {
						const body = document.createElement('div');
						body.className = 'panel-body';
						
						const materials = this._state.composition.frame_design.section_materials || [];
						const currentSpecies = materials[0]?.species || this._woodMaterialsConfig.default_species;
						const currentGrain = materials[0]?.grain_direction || this._woodMaterialsConfig.default_grain_direction;
						const scrollWrapper = document.createElement('div');
					scrollWrapper.className = 'horizontal-scroll';
					
					const grainDefs = [
						{ id: 'n1_vertical', direction: 'vertical' },
						{ id: 'n1_horizontal', direction: 'horizontal' },
						{ id: 'n4_radiant', direction: 'radiant' },
						{ id: 'n4_diamond', direction: 'diamond' }
					];
					
					this._woodMaterialsConfig.species_catalog.forEach(species => {
						const grains = grainDefs.map(g => ({
							id: g.id,
							direction: g.direction,
							thumbnailUrl: `/wood_thumbnails_small/${species.id}_${g.id}.png`,
							largeThumbnailUrl: `/wood_thumbnails_large/${species.id}_${g.id}.png`
						}));
						
						const card = new AccordionSpeciesCard({
              config: { id: species.id, label: species.display, grains },
              selectedSpecies: currentSpecies,
              selectedGrain: currentGrain,
							onSelect: (speciesId, grainDir) => {
								void (async () => {
									await this._updateWoodMaterial('species', speciesId);
									await this._updateWoodMaterial('grain_direction', grainDir);
									if (this._accordion) this._accordion.updateValue('wood_species');
								})();
							}
						});
						scrollWrapper.appendChild(card.render());
					});

					body.appendChild(scrollWrapper);
					panelContent.appendChild(body);
					
					// Render section selector in Right Secondary (for n > 1)
					this._renderSectionSelector();
				}
				break;
			}
				
				case 'upload_interface': {
          void import('./components/UploadPanel').then(({ UploadPanel }) => {
            const uploadPanel = new UploadPanel(this, this._audioCache);
            panelContent.appendChild(uploadPanel.render());
          }).catch((error: unknown) => {
            console.error('[Controller] Failed to load UploadPanel:', error);
          });
          break;
        }
				
				case 'thumbnail_grid': {
					// Handle backgrounds category grids
					if (this._state?.ui.activeCategory === 'backgrounds' && this._backgroundsConfig) {
						const subcategoryId = this._state.ui.activeSubcategory;
						const type = subcategoryId as 'paint' | 'accent' | 'rooms';
						const items = this._backgroundsConfig.categories[type];
						
						// Use grouped card layout for paint colors
						if (type === 'paint') {
								void import('./components/PaintColorSelector').then(({ PaintColorSelector }) => {
									if (this._renderId !== currentRenderId) return;
									const paintColors = items.map(item => ({
									id: item.id,
									name: item.name,
									rgb: item.rgb || [0.5, 0.5, 0.5],
									description: item.description,
									group: item.group
								}));
								
								const selector = new PaintColorSelector(
									paintColors,
									this._state!.ui.currentBackground.id,
									(id: string) => this.handleBackgroundSelected(id, 'paint')
								);
								
								panelContent.appendChild(selector.render());
									this._scrollToSelectedItem();
								}).catch((error: unknown) => {
									console.error('[Controller] Failed to load PaintColorSelector:', error);
							});
						} else if (type === 'rooms') {
								// Rooms use card layout
								void import('./components/RoomSelector').then(({ RoomSelector }) => {
									if (this._renderId !== currentRenderId) return;
									const rooms = items.map(item => ({
									id: item.id,
									name: item.name,
									path: item.path || '',
									description: item.description
								}));
								
								const selector = new RoomSelector(
									rooms,
									this._state!.ui.currentBackground.id,
									(id: string) => this.handleBackgroundSelected(id, 'rooms')
								);
								
								panelContent.appendChild(selector.render());
									this._scrollToSelectedItem();
								}).catch((error: unknown) => {
									console.error('[Controller] Failed to load RoomSelector:', error);
							});
						} else {
							// Accent uses standard thumbnail grid
							const thumbnailItems = items.map(item => {
								if (item.rgb) {
									return {
										id: item.id,
										label: item.name,
										thumbnailUrl: '',
										disabled: false,
										tooltip: item.description,
										rgb: item.rgb
									};
								} else {
									return {
										id: item.id,
										label: item.name,
										thumbnailUrl: item.path || '',
										disabled: false,
										tooltip: item.description
									};
								}
							});
							
							const tooltipContext = {
								category: 'backgrounds',
								subcategory: type
							};
							const grid = new ThumbnailGrid(
								thumbnailItems,
								(id: string) => this.handleBackgroundSelected(id, type),
								this._state.ui.currentBackground.id,
								tooltipContext
							);
							
							panelContent.appendChild(grid.render());
						}
					}
					break;
				}
        
        case 'tour_launcher': {
          void import('./components/TourLauncherPanel').then(({ TourLauncherPanel }) => {
            const tourPanel = new TourLauncherPanel(
              this,
              this._sceneManager
            );
            panelContent.appendChild(tourPanel.render());
          }).catch((error: unknown) => {
            console.error('[Controller] Failed to load TourLauncherPanel:', error);
          });
          break;
        }

        case 'archetype_grid': {
          const filterKey = `${this._state.ui.activeCategory}_${this._state.ui.activeSubcategory}`;
          const stateFilters = this._state.ui.filterSelections[filterKey] || {};
          
          const matchingArchetypes = Array.from(this._archetypes.values())
            .filter(archetype => {
              // Apply active filters from state
              const activeShapes = stateFilters.shape ? new Set(stateFilters.shape) : new Set();
              if (activeShapes.size > 0 && !activeShapes.has(archetype.shape)) {
                return false;
              }
              
              const activePatterns = stateFilters.slot_pattern ? new Set(stateFilters.slot_pattern) : new Set();
              if (activePatterns.size > 0 && !activePatterns.has(archetype.slot_style)) {
                return false;
              }
              
              return true;
            })
            .map(archetype => ({
              id: archetype.id,
              label: archetype.label,
              thumbnailUrl: archetype.thumbnail,
              disabled: false,
              tooltip: archetype.tooltip
            }));
            
          const activeSelection = this.getActiveArchetypeId();
          
          const thumbnailGrid = new ThumbnailGrid(
            matchingArchetypes,
            (id) => { void this._handleArchetypeSelected(id); },
            activeSelection,
            { type: 'archetype' }
          );
          panelContent.appendChild(thumbnailGrid.render());
          break;
        }
				case 'backing_selector': {
          if (this._state) {
            const backing = this._state.composition.frame_design.backing || {
              enabled: false,
              type: 'acrylic',
              material: 'clear',
              inset: 0.5
            };

            // Add toggle to right-secondary-panel toolbar
						const toggleWrapper = document.createElement('div');
						toggleWrapper.className = 'backing-toolbar-toggle';
						toggleWrapper.innerHTML = `
							<span class="backing-toggle-label">Enable Backing</span>
							<label class="toggle-switch toggle-switch-small">
								<input type="checkbox" id="backing-enabled-checkbox" ${backing.enabled ? 'checked' : ''}>
								<span class="toggle-slider"></span>
							</label>
						`;
						const checkbox = toggleWrapper.querySelector('input')! as HTMLInputElement;
						checkbox.addEventListener('change', () => {
							void this._updateBackingEnabled(checkbox.checked);
						});

						this._rightSecondaryPanel!.appendChild(toggleWrapper);
						this._rightSecondaryPanel!.classList.add('visible');
						this._rightMainPanel.classList.add('has-toolbar');

            // Create BackingPanel with grids only
            void import('./components/BackingPanel').then(({ BackingPanel }) => {
              // Guard: Skip if render is stale
              if (this._renderId !== currentRenderId) return;

              const backingPanel = new BackingPanel(
                backing.enabled,
                backing.type,
                backing.material,
                (option: string, value: unknown) => {
                  if (option === 'backing_enabled') {
                    void this._updateBackingEnabled(value as boolean);
                  } else if (option === 'backing_material') {
                    const { type, material } = value as { type: string; material: string };
                    void this._updateBackingMaterial(type, material);
                  }
                }
              );
              
              this._activeRightPanelComponent = backingPanel;
              panelContent.appendChild(backingPanel.render());
              this._scrollToSelectedItem();
            }).catch((error: unknown) => {
              console.error('[Controller] Failed to load BackingPanel:', error);
              panelContent.innerHTML = '<div class="panel-placeholder">Failed to load backing options</div>';
            });
          }
          break;
        }
      }
    }

    this._rightMainPanel.appendChild(panelContent);
    this._rightMainPanel.style.display = 'block';
    this._rightMainPanel.classList.add('visible');
		
    // Scroll to selected card for archetype grids, otherwise restore scroll position
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const newScrollableContent = this._rightMainPanel?.querySelector('.panel-content-scrollable') as HTMLElement;
      if (newScrollableContent) {
        const selectedCard = newScrollableContent.querySelector('.selected') as HTMLElement;
        if (selectedCard) {
          selectedCard.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
      }
      });
    });
  }

  /**
   * Scroll selected item to center of right main panel
   */
  private _scrollToSelectedItem(): void {
    requestAnimationFrame(() => {
      const selected = this._rightMainPanel?.querySelector('.panel-content-scrollable .selected') as HTMLElement;
      if (selected) {
        selected.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    });
  }
	
	getArchetype(id: string): Archetype | undefined {
    return this._archetypes.get(id);
  }
	
	/**
   * Get the current archetype ID from application state
   */
  public getActiveArchetypeId(): string | null {
    if (!this._state) return null;
    
    // Prefer explicit selection from UI state
    if (this._state.ui.selectedArchetypeId) {
      return this._state.ui.selectedArchetypeId;
    }
    
    // Fallback to detection logic
    for (const archetype of this._archetypes.values()) {
      const comp = this._state.composition;
      const matches = 
        comp.frame_design.shape === archetype.shape &&
        comp.frame_design.number_sections === archetype.number_sections &&
        comp.pattern_settings.slot_style === archetype.slot_style;
      
      if (matches) {
        return archetype.id;
      }
    }
    
    return null;
  }
	
	/**
   * Generate cache key for archetype + background combination
   */
  private _getCacheKey(archetypeId: string, backgroundId: string): string {
    return `${archetypeId}_${backgroundId}`;
  }
  
  /**
   * Get background key for cache lookup (converts paint/accent to generic key)
   */
  private _getBackgroundKeyForCache(background: { id: string; type: string }): string {
    return (background.type === 'paint' || background.type === 'accent') 
      ? 'paint_and_accent' 
      : background.id;
  }

  /**
   * Get nested value from composition state using dot notation
   * @private
   */
  private _getNestedValue(state: CompositionStateDTO, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = state;
    
    for (const part of parts) {
      if (typeof current === 'object' && current !== null && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  }
  
  /**
   * Handle thumbnail selection (Right Main → updates composition state)
   * Applies state_updates from config
   * @private
   */
  private async _handleArchetypeSelected(archetypeId: string): Promise<void> {
    if (!this._state) return;
    
    const archetype = this._archetypes.get(archetypeId);
    if (!archetype) {
      console.warn(`[Controller] Archetype not found: ${archetypeId}`);
      return;
    }
    
    const backgroundId = this._getBackgroundKeyForCache(this._state.ui.currentBackground);
    const cacheKey = this._getCacheKey(archetypeId, backgroundId);
    
    // Check cache first
    let composition = this._compositionCache.get(cacheKey);
    
    if (!composition) {
      // First visit: apply archetype base
      composition = structuredClone(this._state.composition);
      
      // Apply all properties from the archetype to the composition state
      composition.frame_design.shape = archetype.shape;
      composition.frame_design.number_sections = archetype.number_sections;
      composition.frame_design.separation = archetype.separation;
      composition.pattern_settings.slot_style = archetype.slot_style;
      composition.pattern_settings.number_slots = archetype.number_slots;
      if (archetype.side_margin !== undefined) {
        composition.pattern_settings.side_margin = archetype.side_margin;
      }
      
      // Set x_offset from constraints.json based on slot_style (single source of truth)
      const slotStyleConstraints = this._constraints?.manufacturing?.slot_style?.[archetype.slot_style];
      if (!slotStyleConstraints?.x_offset) {
        throw new Error(`Missing manufacturing.slot_style.${archetype.slot_style}.x_offset in constraints.json`);
      }
      composition.pattern_settings.x_offset = slotStyleConstraints.x_offset;
			
			// Clamp width/height to new archetype constraints
      if (this._resolver && (archetype.shape === 'rectangular' || archetype.shape === 'diamond')) {
        const sliderConfigs = this._resolver.resolveSliderConfigs(archetypeId, composition);
        const widthConfig = sliderConfigs.find(s => s.id === 'width');
        const heightConfig = sliderConfigs.find(s => s.id === 'height');
        
        if (widthConfig) {
          composition.frame_design.finish_x = Math.max(widthConfig.min, Math.min(composition.frame_design.finish_x, widthConfig.max));
        }
        if (heightConfig) {
          composition.frame_design.finish_y = Math.max(heightConfig.min, Math.min(composition.frame_design.finish_y, heightConfig.max));
        }
      }
      
      // If the new shape is circular, intelligently adjust and clamp the size.
      if (archetype.shape === 'circular') {
        const currentX = composition.frame_design.finish_x;
        const currentY = composition.frame_design.finish_y;
        const smallerCurrentDim = Math.min(currentX, currentY);

        let maxAllowedSize = 60;
        let minAllowedSize = 24;
        if (this._constraints?.manufacturing.circular.by_section_count) {
          const nKey = String(archetype.number_sections);
          const constraint = this._constraints.manufacturing.circular.by_section_count[nKey];
          maxAllowedSize = constraint?.max ?? this._constraints.manufacturing.circular.general.max;
          minAllowedSize = constraint?.min ?? this._constraints.manufacturing.circular.general.min;
        }
        
        const newSize = Math.max(minAllowedSize, Math.min(smallerCurrentDim, maxAllowedSize));
        composition.frame_design.finish_x = newSize;
        composition.frame_design.finish_y = newSize;
      }
			
			// CRITICAL: Apply placement defaults (composition_overrides) ONLY during archetype selection
      // Background changes (handleBackgroundSelected) must NOT reapply these defaults to preserve user modifications
      // Apply placement defaults (first visit only)
      if (this._placementDefaults) {
        const placementData = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.[backgroundId];
        if (placementData?.composition_overrides) {
          composition = deepMerge(composition, placementData.composition_overrides);
        }
      }
      
      // Cache the result
      this._compositionCache.set(cacheKey, composition);
    }
    
    // Pre-fetch margin presets for constrained archetypes
    if (this._isRectangularLinearN3Plus(archetypeId)) {
      const presets = await this._fetchMarginPresets(composition);
      if (presets.length > 0 && composition.pattern_settings.symmetric_n_end == null) {
        composition = {
          ...composition,
          pattern_settings: {
            ...composition.pattern_settings,
            symmetric_n_end: presets[0].n_end,
            side_margin: presets[0].side_margin
          }
        };
      }
    }
    
    // Store selected archetype ID in state
    if (this._state) {
      this._state.ui.selectedArchetypeId = archetypeId;
    }
    
    // Apply cached or newly created composition
    await this.handleCompositionUpdate(composition);
		
		// Re-render the panel to show updated selection and new slider limits
    if (!this._accordion) {
      this._renderRightMainFiltered();
    } else {
      this._accordion.refreshContent('panel');
      this._accordion.updateValue('panel');
      this._accordion.refreshContent('wood_species');
      this._accordion.updateValue('wood_species');
      this._accordion.refreshContent('layout');
      this._accordion.updateValue('layout');
    }
    
    // Update art placement
    if (this._sceneManager) {
      let artPlacement: ArtPlacement | undefined;
      
      // 1. Check placement_defaults for archetype-specific override
      if (this._placementDefaults) {
        const placementData = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.[backgroundId];
        artPlacement = placementData?.art_placement;
        
        if (!artPlacement && backgroundId !== 'paint_and_accent') {
          artPlacement = this._placementDefaults.archetypes?.[archetypeId]?.backgrounds?.['paint_and_accent']?.art_placement;
        }
      }
      
      // 2. Fallback to background's default art_placement
      if (!artPlacement && this._backgroundsConfig && this._state) {
        const bgType = this._state.ui.currentBackground.type;
        if (bgType === 'rooms') {
          const background = this._backgroundsConfig.categories.rooms.find(bg => bg.id === backgroundId);
          artPlacement = background?.art_placement;
        }
      }

      if (artPlacement && 'applyArtPlacement' in this._sceneManager) {
					(this._sceneManager as unknown as { applyArtPlacement: (placement: ArtPlacement) => void }).applyArtPlacement(artPlacement);
				} else if ('resetArtPlacement' in this._sceneManager) {
					(this._sceneManager as unknown as { resetArtPlacement: () => void }).resetArtPlacement();
      }
    }
  }

  /**
   * Handle option selection from right panel
   * @private
   */
  private _handleOptionSelected(
    option: string,
    value: unknown,
    contentRenderer: RightPanelContentRenderer,
    uiConfig: { elements: Record<string, unknown> }
  ): void {
    if (!this._panelStack || !this._state) return;

    // Handle navigation to cascading panels
    if (option === 'navigate') {
      this._handleNavigation(value as string, contentRenderer, uiConfig);
      return;
    }

    // Handle backing enabled toggle
    if (option === 'backing_enabled') {
      void this._updateBackingEnabled(value as boolean);
      return;
    }

    // Handle backing material change
    if (option === 'backing_material') {
      const { type, material } = value as { type: string; material: string };
      void this._updateBackingMaterial(type, material);
      return;
    }

    // Handle direct state updates
    void this._updateStateValue(option, value);
  }
	
	/**
   * Update dimension with constraint logic
   * Handles width/height changes respecting aspect ratio lock and shape constraints
   * @private
   */
  private async _updateDimension(
    axis: 'x' | 'y',
    value: number
  ): Promise<void> {
		
		// Dimension update
		
    if (!this._state) return;

    const newComposition = structuredClone(this._state.composition);
		
		const newValue = value;

    // Build constraints from current state and config
    const uiConfig = window.uiEngine;
    const shapeConstraintsConfig = uiConfig?.config?.dimension_constraints?.[newComposition.frame_design.shape] as { min_dimension?: number; max_dimension?: number } | undefined;
    
    const constraints: DimensionConstraints = {
      shape: newComposition.frame_design.shape,
      aspectRatioLocked: this._state.ui.aspectRatioLocked ?? false,
      lockedAspectRatio: this._state.ui.lockedAspectRatio ?? null,
      minDimension: (shapeConstraintsConfig?.min_dimension as number | undefined) ?? 8.0,
      maxDimension: (shapeConstraintsConfig?.max_dimension as number | undefined) ?? 84.0
    };
    
    // Calculate new dimensions using utility function
    const result = applyDimensionChange(
      axis,
      newValue,
      newComposition.frame_design.finish_x,
      newComposition.frame_design.finish_y,
      constraints
    );
    
    // Apply calculated dimensions
    newComposition.frame_design.finish_x = result.finish_x;
    newComposition.frame_design.finish_y = result.finish_y;
    
    // Update UI state if lock was broken by clamping
    if (result.lockBroken && this._state.ui.aspectRatioLocked) {
      this._state = {
        ...this._state,
        ui: {
          ...this._state.ui,
          aspectRatioLocked: false,
          lockedAspectRatio: null
        }
      };
    }
    
    // Single update through facade
    await this.handleCompositionUpdate(newComposition);
    
    // Update accordion header value
    if (this._accordion) {
      this._accordion.updateValue('layout');
    }
    
    // Update the OTHER slider's max value directly without re-rendering
		const archetypeId = this.getActiveArchetypeId();
		if (archetypeId && this._resolver && this._state) {
			const sliderConfigs = this._resolver.resolveSliderConfigs(archetypeId, this._state.composition);
			
			// Update width slider max if height changed
			if (axis === 'y') {
				const widthConfig = sliderConfigs.find(s => s.id === 'width');
				if (widthConfig) {
					const widthSlider = document.getElementById('width') as HTMLInputElement;
					if (widthSlider) {
						widthSlider.max = String(widthConfig.max);
						// Clamp current value if it exceeds new max
						if (parseFloat(widthSlider.value) > widthConfig.max) {
							widthSlider.value = String(widthConfig.max);
							const valueDisplay = document.getElementById('width-value');
							if (valueDisplay) {
								valueDisplay.textContent = `${widthConfig.max}"`;
							}
						}
					}
				}
			}
			
			// Update height slider max if width changed
			if (axis === 'x') {
				const heightConfig = sliderConfigs.find(s => s.id === 'height');
				if (heightConfig) {
					const heightSlider = document.getElementById('height') as HTMLInputElement;
					if (heightSlider) {
						heightSlider.max = String(heightConfig.max);
						// Clamp current value if it exceeds new max
						if (parseFloat(heightSlider.value) > heightConfig.max) {
							heightSlider.value = String(heightConfig.max);
							const valueDisplay = document.getElementById('height-value');
							if (valueDisplay) {
								valueDisplay.textContent = `${heightConfig.max}"`;
							}
						}
					}
				}
			}
			
			// Update slots slider max (dimensions affect available slot space)
			const slotsConfig = sliderConfigs.find(s => s.id === 'slots');
			if (slotsConfig) {
				const slotsSlider = document.getElementById('slots') as HTMLInputElement;
				if (slotsSlider) {
					slotsSlider.max = String(slotsConfig.max);
					if (parseFloat(slotsSlider.value) > slotsConfig.max) {
						slotsSlider.value = String(slotsConfig.max);
						const valueDisplay = document.getElementById('slots-value');
						if (valueDisplay) {
							valueDisplay.textContent = String(slotsConfig.max);
						}
					}
				}
			}
		}
	}	
	/**
   * Handle aspect ratio lock toggle
   * Captures current ratio when locked, clears when unlocked
   * @private
   */
  private _handleAspectRatioLockChange(locked: boolean): void {
    if (!this._state) return;
    
    const newState = structuredClone(this._state);
    newState.ui.aspectRatioLocked = locked;
    
    if (locked) {
      // Capture current ratio
      const { finish_x, finish_y } = this._state.composition.frame_design;
      newState.ui.lockedAspectRatio = finish_x / finish_y;
    } else {
      // Clear locked ratio
      newState.ui.lockedAspectRatio = null;
    }
    
    // Update state (no backend call needed - UI-only state)
    this._state = newState;
    this._facade.persistState(this._state);
    
    // Re-render to update UI
    if (!this._accordion) {
      this._renderRightMainFiltered();
    }
  }
	
	/**
 * Update state value and trigger re-render
 * Uses UI config as single source of truth for state paths
 * @private
 */
	private async _updateStateValue(option: string, value: unknown): Promise<void> {
		if (!this._state) return;

		// Route width/height changes through dimension calculator
		if (option === 'width' || option === 'size') {
			return this._updateDimension('x', value as number);
		}
		if (option === 'height') {
			return this._updateDimension('y', value as number);
		}

		const newComposition = structuredClone(this._state.composition);

		// UIEngine is the authoritative source for element configs
		const elementConfig = window.uiEngine?.getElementConfig(option);
		
		if (!elementConfig?.state_path) {
			console.warn(`[Controller] No state_path found for option: ${option}`);
			return;
		}

		// Update the nested value using state_path from UIEngine
		this._setNestedValue(newComposition, elementConfig.state_path, value);
		
		// CRITICAL: For circular panels, "size", "width", and "height" all control diameter
		// and must update both finish_x and finish_y to maintain a perfect circle.
		if (newComposition.frame_design.shape === 'circular' && ['size', 'width', 'height'].includes(option)) {
      newComposition.frame_design.finish_x = value as number;
      newComposition.frame_design.finish_y = value as number;
    }

		// Trigger composition update
		await this.handleCompositionUpdate(newComposition);
		
		// Update slots slider max when separation or side_margin changes
		if (option === 'separation' || option === 'side_margin') {
			const archetypeId = this.getActiveArchetypeId();
			if (archetypeId && this._resolver && this._state) {
				const sliderConfigs = this._resolver.resolveSliderConfigs(archetypeId, this._state.composition);
				const slotsConfig = sliderConfigs.find(s => s.id === 'slots');
				if (slotsConfig) {
					const slotsSlider = document.getElementById('slots') as HTMLInputElement;
					if (slotsSlider) {
						slotsSlider.max = String(slotsConfig.max);
						if (parseFloat(slotsSlider.value) > slotsConfig.max) {
							slotsSlider.value = String(slotsConfig.max);
							const valueDisplay = document.getElementById('slots-value');
							if (valueDisplay) {
								valueDisplay.textContent = String(slotsConfig.max);
							}
						}
					}
				}
			}
		}
	}
	
	/**
   * Set nested object value using dot notation path
   * @private
   */
  private _setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown
  ): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    
    const lastPart = parts[parts.length - 1];
    current[lastPart] = value;
  }
	
	/**
   * Update wood material properties (species or grain_direction)
   * Applies to all sections or selected sections
   * @private
   */
  private async _updateWoodMaterial(
    property: 'species' | 'grain_direction',
    value: string
  ): Promise<void> {
    if (!this._state) return;

    // Create a new composition state immutably
    const newComposition = structuredClone(this._state.composition);
    
    // Ensure the materials array exists
    const materials = newComposition.frame_design.section_materials || [];
    const numSections = newComposition.frame_design.number_sections;
    
    // Determine which section indices to update
    const targetIndices = this._selectedSectionIndices.size > 0
      ? Array.from(this._selectedSectionIndices)
      : Array.from({ length: numSections }, (_, i) => i); // If none selected, target all

    // Update only the target sections
    targetIndices.forEach(sectionId => {
      const material = materials.find(m => m.section_id === sectionId);
      
      if (material) {
        // Update existing material entry
        material[property] = value;
      } else {
        // Create a new material entry if it doesn't exist
        const newMaterial: SectionMaterial = {
          section_id: sectionId,
          species: property === 'species' ? value : this._woodMaterialsConfig?.default_species || 'walnut-black-american',
          grain_direction: property === 'grain_direction' ? value as 'horizontal' | 'vertical' | 'radiant' | 'diamond' : this._woodMaterialsConfig?.default_grain_direction || 'vertical'
        };
        materials.push(newMaterial);
      }
    });

    // Ensure the materials array is sorted by section_id for consistency
    newComposition.frame_design.section_materials = materials.sort((a, b) => a.section_id - b.section_id);

    // Trigger the rendering pipeline with the updated composition
    await this.handleCompositionUpdate(newComposition);
    
    // Update accordion header value
    if (this._accordion) {
      this._accordion.updateValue('wood_species');
    }
  }
  
	/**
   * Update backing material
   * @private
   */
  private async _updateBackingMaterial(type: string, material: string): Promise<void> {
    if (!this._state) return;
		
		const backingType = type as 'acrylic' | 'cloth' | 'leather' | 'foam';

    // Define the backing object first to avoid parser ambiguity
    const currentBacking = this._state.composition.frame_design.backing || { enabled: true, inset: 0.5 };
    const newComposition: CompositionStateDTO = {
      ...this._state.composition,
      frame_design: {
        ...this._state.composition.frame_design,
        backing: {
          ...currentBacking,
          enabled: true,
          type: backingType,
          material: material,
        }
      }
    };
    
    const response = await fetch('http://localhost:8000/geometry/backing-parameters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newComposition)
    });

    if (!response.ok) {
      console.error('[Controller] Failed to fetch backing parameters after material change.');
      return;
    }
    const backingParams = await response.json();
    
    await this.dispatch({ type: 'COMPOSITION_UPDATED', payload: newComposition });

    if (this._sceneManager) {
			await this._sceneManager.generateBackingIfEnabled(backingParams, newComposition);
		}
		
		// Re-render panel to update BackingPanel with new enabled state
		if (!this._accordion) {
			this._renderRightMainFiltered();
		} else {
			this._accordion.updateValue('backing');
		}
	}
	
	private async _updateBackingEnabled(enabled: boolean): Promise<void> {
		if (!this._state) return;
		
		const currentBacking = this._state.composition.frame_design.backing || { 
			type: 'acrylic', 
			material: 'clear', 
			inset: 0.5 
		};
		
		const newComposition: CompositionStateDTO = {
			...this._state.composition,
			frame_design: {
				...this._state.composition.frame_design,
				backing: {
					...currentBacking,
					enabled
				}
			}
		};
		
		const response = await fetch('http://localhost:8000/geometry/backing-parameters', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(newComposition)
		});

		if (!response.ok) {
			console.error('[Controller] Failed to fetch backing parameters');
			return;
		}
		
		const backingParams = await response.json();
		await this.dispatch({ type: 'COMPOSITION_UPDATED', payload: newComposition });

		if (this._sceneManager) {
			await this._sceneManager.generateBackingIfEnabled(backingParams, newComposition);
		}
		
		// Re-render panel to update BackingPanel with new enabled state
		if (!this._accordion) {
			this._renderRightMainFiltered();
		} else {
			this._accordion.updateValue('backing');
		}
	}

  /**
   * Handle navigation to cascading panels
   * @private
   */
  private _handleNavigation(
    target: string,
    contentRenderer: RightPanelContentRenderer,
    uiConfig: { elements: Record<string, unknown> }
  ): void {
    if (!this._panelStack || !this._state) return;

    switch (target) {
      case 'species': {
        const panel = contentRenderer.renderWoodSpeciesPanel(
          this._state.composition,
          uiConfig,
          (species: string) => {
            void this._updateWoodMaterial('species', species);
            this._panelStack?.popPanel();
          },
          () => {
            this._panelStack?.popPanel();
          }
        );
        this._panelStack.pushPanel(panel);
        break;
      }

      case 'grain': {
        const panel = contentRenderer.renderGrainDirectionPanel(
          this._state.composition,
          (grain: string) => {
            void this._updateWoodMaterial('grain_direction', grain);
            this._panelStack?.popPanel();
          },
          () => {
            this._panelStack?.popPanel();
          }
        );
        this._panelStack.pushPanel(panel);
        break;
      }

      default:
        console.warn('Unknown navigation target:', target);
    }
  }
	
	private _detectChangedParams(
		oldComp: CompositionStateDTO,
		newComp: CompositionStateDTO
	): string[] {
		const changed = new Set<string>();

		// Special handling for section_materials array
		const compareSectionMaterials = (
			oldMaterials: Array<{section_id: number, species: string, grain_direction: string}>,
			newMaterials: Array<{section_id: number, species: string, grain_direction: string}>
		): boolean => {
			if (oldMaterials.length !== newMaterials.length) return true;
			
			// Sort both arrays by section_id for consistent comparison
			const oldSorted = [...oldMaterials].sort((a, b) => a.section_id - b.section_id);
			const newSorted = [...newMaterials].sort((a, b) => a.section_id - b.section_id);
			
			// Compare each element
			for (let i = 0; i < oldSorted.length; i++) {
				const old = oldSorted[i];
				const newer = newSorted[i];
				
				if (
					old.section_id !== newer.section_id ||
					old.species !== newer.species ||
					old.grain_direction !== newer.grain_direction
				) {
					return true;
				}
			}
			
			return false;
		};

		// Type-safe recursive comparison function
		const compareObjects = (
			o1: Record<string, unknown>,
			o2: Record<string, unknown>,
			path: string = ''
		) => {
			for (const key of Object.keys(o1)) {
				const val1 = o1[key];
				const val2 = o2[key];
				const currentPath = path ? `${path}.${key}` : key;

				// Special case: section_materials array
				if (currentPath === 'frame_design.section_materials') {
					if (Array.isArray(val1) && Array.isArray(val2)) {
						if (compareSectionMaterials(val1 as Array<{section_id: number, species: string, grain_direction: string}>, val2 as Array<{section_id: number, species: string, grain_direction: string}>)) {
							changed.add('section_materials');
						}
					}
					continue;
				}

				// Recurse into nested objects
				if (
					typeof val1 === 'object' && val1 !== null && !Array.isArray(val1) &&
					val2 && typeof val2 === 'object' && !Array.isArray(val2)
				) {
					compareObjects(
						val1 as Record<string, unknown>,
						val2 as Record<string, unknown>,
						currentPath
					);
				} else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
					// For primitives or other arrays
					changed.add(key);
				}
			}
		};

		compareObjects(oldComp, newComp);
		return Array.from(changed);
	}
  
  /**
   * Handles a request to update the composition, using the smart processing pipeline.
   * This is the core of the optimization logic on the frontend.
   */
 
	async handleCompositionUpdate(initialComposition: CompositionStateDTO): Promise<void> {
		
    if (this._isUpdatingComposition) {
      console.warn('[Controller] Composition update already in progress. Ignoring request.');
      return;
    }
    this._isUpdatingComposition = true;
    try {
      if (!this._state) {
        throw new Error('Controller not initialized');
      }
      
      // Create a mutable working copy to avoid reassigning the function parameter.
      let newComposition = initialComposition;

      // Check if the size has changed
      const oldSize = this._state.composition.frame_design.finish_x;
      const newSize = newComposition.frame_design.finish_x;

      if (oldSize !== newSize) {
        // Size has changed, apply smart defaults
        const sizeKey = String(newSize);
        const defaults = newComposition.size_defaults?.[sizeKey];

        if (defaults) {
          newComposition = {
            ...newComposition,
            pattern_settings: {
              ...newComposition.pattern_settings,
              number_slots: defaults.number_slots,
            },
            frame_design: {
              ...newComposition.frame_design,
              separation: defaults.separation,
            },
          };
          
          // Update UI dropdown to hide/show grain options and reset to valid value if needed
          if (typeof window !== 'undefined' && (window as { updateGrainDirectionOptionsFromController?: (n: number) => void }).updateGrainDirectionOptionsFromController) {
            (window as { updateGrainDirectionOptionsFromController?: (n: number) => void }).updateGrainDirectionOptionsFromController?.(newComposition.frame_design.number_sections);
          }
        }
      }
      
      // Initialize section_materials when number_sections changes
      const oldN = this._state.composition.frame_design.number_sections;
      const newN = newComposition.frame_design.number_sections;

      if (oldN !== newN) {
      
      // CRITICAL: Use materials from UI snapshot, NOT old state
      const uiCapturedMaterials = newComposition.frame_design.section_materials || [];
      if (this._woodMaterialsConfig) { // Ensure config is loaded
        const targetArchetype = Array.from(this._archetypes.values()).find(a => 
          a.shape === newComposition.frame_design.shape && 
          a.slot_style === newComposition.pattern_settings.slot_style && 
          a.number_sections === newN
        );
        // Fallback to config default (Single Source of Truth) instead of hardcoded strings
        const validGrains = (targetArchetype as { available_grains?: string[] })?.available_grains 
          ?? [this._woodMaterialsConfig.default_grain_direction];

        const initializedMaterials = initializeSectionMaterials(
          oldN,
          newN,
          uiCapturedMaterials,
          this._woodMaterialsConfig,
          validGrains
        );
        
        newComposition = {
          ...newComposition,
          frame_design: {
            ...newComposition.frame_design,
            section_materials: initializedMaterials
          }
        };
      }
      }

      // 1. Detect what changed to determine the processing level.
      const changedParams = this._detectChangedParams(
        this._state.composition,
        newComposition
      );

      // PARITY FIX: Invalidate client cache if "Heavy" audio parameters change.
      // These affect the timeline (silence/trimming), making cached samples stale.
      const heavyAudioParams = ['audio_processing.remove_silence', 'audio_processing.silence_threshold', 'audio_processing.silence_duration', 'audio_source'];
      if (changedParams.some(p => heavyAudioParams.some(h => p.startsWith(h))) && this._state.audio.audioSessionId) {
        this._audioCache.clearSession(this._state.audio.audioSessionId);
        this._state.audio.audioSessionId = null;
        this._facade.persistState(this._state);
      }

      // Invalidate margin presets if geometry changed
      const geometryChanged = changedParams.some(p => 
        ['finish_x', 'finish_y', 'separation', 'number_sections', 'number_slots', 'side_margin'].includes(p)
      );
      if (geometryChanged && this._isRectangularLinearN3Plus(this._state.ui.selectedArchetypeId || '')) {
        this._marginPresetCache.clear();
        // Let backend solver compute symmetric distribution with minimum margin
        newComposition = {
          ...newComposition,
          pattern_settings: {
            ...newComposition.pattern_settings,
            symmetric_n_end: null,
            side_margin: 0
          }
        };
      }

      // Clamp number_slots if side_margin change reduces available space
      if ((changedParams.includes('side_margin') || changedParams.includes('separation')) && this._resolver) {
        const archetypeId = this.getActiveArchetypeId();
        if (archetypeId) {
          const sliderConfigs = this._resolver.resolveSliderConfigs(archetypeId, newComposition);
          const slotsConfig = sliderConfigs.find(s => s.id === 'slots');
          if (slotsConfig && newComposition.pattern_settings.number_slots > slotsConfig.max) {
            newComposition = {
              ...newComposition,
              pattern_settings: {
                ...newComposition.pattern_settings,
                number_slots: slotsConfig.max
              }
            };
            // Force pipeline to re-bin audio and visual slider to snap to new position
            if (!changedParams.includes('number_slots')) changedParams.push('number_slots');
            const slotsSlider = document.getElementById('slots') as HTMLInputElement;
            if (slotsSlider) slotsSlider.value = String(slotsConfig.max);						
          }
        }
      }

      // If nothing relevant changed, just update the local state without an API call.
      if (changedParams.length === 0) {
        await this.dispatch({ type: 'COMPOSITION_UPDATED', payload: newComposition });
        return;
      }

      // 2. Check if ONLY material properties changed (fast path - no backend call)
      const onlyMaterialsChanged = changedParams.every(param => 
        param === 'section_materials' || param.startsWith('section_materials.')
      );

      if (onlyMaterialsChanged) {
        
        // Update state locally
        this._state = {
          ...this._state,
          composition: newComposition
        };
        
        // Persist state
        this._facade.persistState(this._state);
        
        // Update cache with user's customization
        const archetypeId = this.getActiveArchetypeId();
        if (archetypeId) {
          const backgroundId = this._getBackgroundKeyForCache(this._state.ui.currentBackground);
          const cacheKey = this._getCacheKey(archetypeId, backgroundId);
          this._compositionCache.set(cacheKey, structuredClone(newComposition));
        }
        
        // Apply materials to existing meshes (no CSG regeneration)
        if (this._sceneManager) {
          // When no specific sections are selected, this implies an update to all
          const targets = this._selectedSectionIndices.size > 0 
            ? this._selectedSectionIndices 
            : new Set(Array.from({ length: this._state.composition.frame_design.number_sections }, (_, i) => i));

          targets.forEach(sectionId => {
            this._sceneManager.applySingleSectionMaterial?.(sectionId);
          });
        }
        
        // Notify subscribers
        this.notifySubscribers();
        
        return; // CRITICAL: Stop execution here to prevent full re-render
      }

      // 3. Check if this is an audio-level change that we can handle client-side
      const audioLevelParams = ['number_sections', 'number_slots', 'binning_mode', 'amplitude_exponent', 'filter_amount'];
      const isAudioChange = changedParams.some(param => audioLevelParams.includes(param));
      
      let stateToSend = newComposition;
      
      if (isAudioChange && this._state.audio.audioSessionId) {
        const rebinnedAmplitudes = this._audioCache.rebinFromCache(
          this._state.audio.audioSessionId,
          {
            numSlots: newComposition.pattern_settings.number_slots,
            binningMode: (newComposition.audio_processing.binning_mode || 'mean_abs') as 'mean_abs' | 'min_max' | 'continuous',
            filterAmount: newComposition.audio_processing.apply_filter ? newComposition.audio_processing.filter_amount : 0,
            exponent: newComposition.pattern_settings.amplitude_exponent
          }
        );
        
        if (rebinnedAmplitudes) {
          // The rebinned amplitudes are NORMALIZED (0-1). We send them directly
          // to the backend, which will calculate the new max_amplitude_local for
          // the new geometry and perform the final scaling.
          stateToSend = {
            ...newComposition,
            processed_amplitudes: Array.from(rebinnedAmplitudes)
          };
        } else {
          return; // Abort if we can't generate valid amplitudes
        }
      } else {
            // Filter valid amplitudes first
            const validAmps = this._state.composition.processed_amplitudes.filter(
              (amp): amp is number => amp !== null && isFinite(amp)
            );
            
            // CRITICAL: For geometry changes, send NORMALIZED amplitudes (0-1 range)
            // Backend will apply the new max_amplitude_local to these normalized values
            const normalizedAmps = (() => {
              if (validAmps.length === 0) return validAmps;
              const maxAmp = Math.max(...validAmps.map(Math.abs));
              return maxAmp > 1.5 ? validAmps.map(a => a / maxAmp) : validAmps;
            })();
            
            stateToSend = {
                ...newComposition,
                processed_amplitudes: normalizedAmps,
            };
          }
      
      try {
        // 4. Make one smart API call.
        const response = await this._facade.getSmartCSGData(
          stateToSend,
          changedParams,
          this._state.audio.previousMaxAmplitude
        );

        // 5. Handle the handshake: update state FIRST, then trigger the render.
        // This is the crucial step to prevent infinite loops.

        // First, update the application state internally with the new, processed state.
        // We do this BEFORE notifying subscribers to prevent race conditions.
        // The backend is now the single source of truth for calculations.
        // We read the new max amplitude directly from the API response.
        this._state = {
          ...this._state,
          composition: response.updated_state,
          audio: { // Also update the audio tracking state
            ...this._state.audio,
            // The new "previous" is the value calculated and returned by the backend.
            previousMaxAmplitude: response.max_amplitude_local,
          },
        };

        // Manually persist the new state
        this._facade.persistState(this._state);
        
        // Now, trigger the render directly with the received CSG data.
        if (this._sceneManager) {
          await this._sceneManager.renderComposition(response);
          // Art placement applied internally by _renderCompositionInternal
        }
        
        // Update cache with user's customization
        const archetypeId = this.getActiveArchetypeId();
        if (archetypeId) {
          const backgroundId = this._getBackgroundKeyForCache(this._state.ui.currentBackground);
          const cacheKey = this._getCacheKey(archetypeId, backgroundId);
          this._compositionCache.set(cacheKey, structuredClone(response.updated_state));
        }
        
        // Finally, notify all other UI components that the state has changed.
        this.notifySubscribers();

			} catch (error: unknown) {
        console.error('[Controller] CSG generation failed, updating state locally:', error);
        
        // CRITICAL: Even if API fails, update local state so UI reflects user's selection
        this._state = {
          ...this._state,
          composition: newComposition
        };
        
        // Persist state even on API failure
        this._facade.persistState(this._state);
        
        // Notify subscribers so UI updates
        this.notifySubscribers();
      }
			
			// Refresh layout panel if geometry changed to update slider constraints
      if (this._accordion && geometryChanged) {
        this._accordion.refreshContent('layout');
      }
    } finally {
      this._isUpdatingComposition = false;
    }
  } 
 
	/**
   * Get wood materials configuration
   */
  getWoodMaterialsConfig(): WoodMaterialsConfig {
    if (!this._woodMaterialsConfig) {
      throw new Error('Wood materials config not loaded');
    }
    return this._woodMaterialsConfig;
  }
	
	public getBackgroundsConfig(): BackgroundsConfig | null {
    return this._backgroundsConfig;
  }
  
  /**
   * Select a section for material editing
   */
  selectSection(indices: Set<number>): void {
    this._selectedSectionIndices = new Set(indices);
    
    // Update section selector panel if it exists
    if (this._sectionSelectorPanel) {
      this._sectionSelectorPanel.updateSelection(indices);
    }
  }
  
  /**
   * Get currently selected section index
   */
  getSelectedSections(): Set<number> {
    return this._selectedSectionIndices;
  }
  
	/**
   * Update material for a specific section
   * FRONTEND-ONLY: Does not trigger backend CSG regeneration
   */
  updateSectionMaterial(
    sectionId: number, 
    species: string, 
    grainDirection: 'horizontal' | 'vertical' | 'angled'
  ): void {
    if (!this._state) {
      throw new Error('State not initialized');
    }
    
    // Get current section materials or create default array
    const currentMaterials = this._state.composition.frame_design.section_materials || [];
    
    // Create updated materials array immutably
    const updatedMaterials = [...currentMaterials];
    const existingIndex = updatedMaterials.findIndex(m => m.section_id === sectionId);
    
    const newMaterial = {
      section_id: sectionId,
      species: species,
      grain_direction: grainDirection
    };
    
    if (existingIndex >= 0) {
      updatedMaterials[existingIndex] = newMaterial;
    } else {
      updatedMaterials.push(newMaterial);
    }
    
    // Update state locally WITHOUT backend call
    this._state = {
      ...this._state,
      composition: {
        ...this._state.composition,
        frame_design: {
          ...this._state.composition.frame_design,
          section_materials: updatedMaterials
        }
      }
    };
    
    // Notify SceneManager to update ONLY the changed section (no CSG regeneration)
    if (this._sceneManager) {
      this._sceneManager.applySingleSectionMaterial?.(sectionId);
    }
    
    // Notify subscribers of state change
    this.notifySubscribers();
  }
  
  /**
   * Clean up controller
   */
  dispose(): void {
    this.clearTimers();
    this._subscribers.clear();
    
    if (this._state) {
      this._facade.persistState(this._state);
    }
  }
	
	public updateSectionMaterialsArray(newMaterials: Array<{section_id: number, species: string, grain_direction: string}>): void {
    // CRITICAL: Completely replace the array, don't merge with old entries
    const cleanMaterials = newMaterials.map(m => ({
      section_id: m.section_id,
      species: m.species,
      grain_direction: m.grain_direction
    }));
    
    // Update state with completely new array
    this._state.composition = {
      ...this._state.composition,
      frame_design: {
        ...this._state.composition.frame_design,
        section_materials: cleanMaterials
      }
    };
    
    this.notifySubscribers();
  }
}
```

## File: `C:\Users\paulj\WDweb\src\AudioCacheService.ts`

```typescript
/**
 * AudioCacheService - Client-side cache for raw audio samples
 * 
 * Caches the 200k normalized samples to enable instant rebinning
 * when audio-level parameters change (sections, slots, binning mode).
 * This avoids server round-trips for audio reprocessing.
 */

import { z } from 'zod';

// Schema for cached audio session
const AudioSessionSchema = z.object({
  id: z.string(),
  samples: z.instanceof(Float32Array),
  timestamp: z.number(),
  sourceFile: z.string(),
  fileHash: z.string()
}).strict();

type AudioSession = z.infer<typeof AudioSessionSchema>;

// Schema for bin parameters
const BinParametersSchema = z.object({
  numSlots: z.number().int().positive(),
  binningMode: z.enum(['mean_abs', 'min_max', 'continuous']),
  filterAmount: z.number().min(0).max(1).optional(),
  exponent: z.number().positive().optional()
}).strict();

type BinParameters = z.infer<typeof BinParametersSchema>;

export class AudioCacheService {
  // Cache storage (prefixed = OK per architecture)
  private readonly _cache: Map<string, AudioSession>;
  private readonly _maxCacheSize: number = 5; // Max sessions to keep

  constructor() {
    this._cache = new Map();
  }

  /**
   * Cache raw audio samples from initial processing
   */
  public cacheRawSamples(
    file: File,
    samples: Float32Array
  ): string {
    // Generate session ID
    const sessionId = crypto.randomUUID();
    
    // Create file hash for validation
    const fileHash = this._generateFileHash(file);
    
    // Create session object
    const session: AudioSession = {
      id: sessionId,
      samples: samples,
      timestamp: Date.now(),
      sourceFile: file.name,
      fileHash: fileHash
    };
    
    // Enforce cache size limit
    if (this._cache.size >= this._maxCacheSize) {
      // Remove oldest entry
      const oldestKey = this._findOldestSession();
      if (oldestKey) {
        this._cache.delete(oldestKey);
      }
    }
    
    // Store in cache
    this._cache.set(sessionId, session);
    
    return sessionId;
  }

  /**
   * Retrieve cached samples for a session
   */
  public getCachedSamples(sessionId: string): Float32Array | null {
    const session = this._cache.get(sessionId);
    if (!session) {
      return null;
    }
    
    // Return copy to prevent mutation
    return new Float32Array(session.samples);
  }

  /**
   * Check if session exists in cache
   */
  public hasSession(sessionId: string): boolean {
    return this._cache.has(sessionId);
  }

  /**
   * Rebin cached samples for new parameters
   * This performs the fast client-side rebinning operation
   */
  public rebinFromCache(
    sessionId: string,
    params: BinParameters
  ): Float32Array | null {
    const session = this._cache.get(sessionId);
    if (!session) {
      console.warn(`Session ${sessionId} not found in cache`);
      return null;
    }
    
    // Perform binning based on mode
    let amplitudes = this._binSamples(
      session.samples,
      params.numSlots,
      params.binningMode
    );
    
    // Apply filter if specified (MUST come before exponent)
    if (params.filterAmount && params.filterAmount > 0) {
      amplitudes = this._filterData(amplitudes, params.filterAmount);
    }
    
    // Apply exponent if specified
    if (params.exponent && params.exponent !== 1.0) {
      for (let i = 0; i < amplitudes.length; i++) {
        // Parity: Desktop does not re-normalize after power. 
        // Input is 0-1, Power keeps it 0-1.
        amplitudes[i] = Math.pow(amplitudes[i], params.exponent);
      }
      // Note: Previous re-normalization logic removed to match PyQt behavior
    }
    
    return amplitudes;
  }

  /**
   * Clear a specific session from cache
   */
  public clearSession(sessionId: string): void {
    this._cache.delete(sessionId);
  }

  /**
   * Clear all cached sessions
   */
  public clearAll(): void {
    this._cache.clear();
  }
	
  /**
   * Restores a session into the cache from persisted state.
   */
  public rehydrateCache(sessionId: string, samples: Float32Array): void {
    if (this._cache.has(sessionId)) {
      return; // Avoid re-adding if already present
    }

    const session: AudioSession = {
      id: sessionId,
      samples: samples,
      timestamp: Date.now(),
      sourceFile: 'restored-session',
      fileHash: 'restored-session'
    };

    this._cache.set(sessionId, session);
  }	

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    sessionCount: number;
    totalMemoryBytes: number;
    sessions: Array<{
      id: string;
      sourceFile: string;
      timestamp: number;
      sampleCount: number;
    }>;
  } {
    const sessions = Array.from(this._cache.values()).map(session => ({
      id: session.id,
      sourceFile: session.sourceFile,
      timestamp: session.timestamp,
      sampleCount: session.samples.length
    }));
    
    const totalMemoryBytes = sessions.reduce(
      (sum, session) => sum + (session.sampleCount * 4), // 4 bytes per Float32
      0
    );
    
    return {
      sessionCount: this._cache.size,
      totalMemoryBytes,
      sessions
    };
  }

  /**
   * Bin the raw samples according to parameters
   * Implements mean_abs, min_max, and continuous modes
   */
  private _binSamples(
    rawSamples: Float32Array,
    numSlots: number,
    binningMode: string
  ): Float32Array {
    const samplesPerSlot = Math.floor(rawSamples.length / numSlots);
    const amplitudes = new Float32Array(numSlots);
    
    for (let slotIdx = 0; slotIdx < numSlots; slotIdx++) {
      const startIdx = slotIdx * samplesPerSlot;
      const endIdx = Math.min(startIdx + samplesPerSlot, rawSamples.length);
      
      if (binningMode === 'mean_abs') {
        // Average of absolute values
        let sum = 0;
        for (let i = startIdx; i < endIdx; i++) {
          sum += Math.abs(rawSamples[i]);
        }
        amplitudes[slotIdx] = sum / (endIdx - startIdx);
        
      } else if (binningMode === 'min_max') {
        // Max absolute value in the bin
        let maxAbs = 0;
        for (let i = startIdx; i < endIdx; i++) {
          maxAbs = Math.max(maxAbs, Math.abs(rawSamples[i]));
        }
        amplitudes[slotIdx] = maxAbs;
        
      } else if (binningMode === 'continuous') {
        // RMS (Root Mean Square) for continuous representation
        let sumSquares = 0;
        for (let i = startIdx; i < endIdx; i++) {
          sumSquares += rawSamples[i] * rawSamples[i];
        }
        amplitudes[slotIdx] = Math.sqrt(sumSquares / (endIdx - startIdx));
        
      } else {
        // Default to mean_abs if unknown mode
        let sum = 0;
        for (let i = startIdx; i < endIdx; i++) {
          sum += Math.abs(rawSamples[i]);
        }
        amplitudes[slotIdx] = sum / (endIdx - startIdx);
      }
    }
    
    // Normalize to 0-1 range
    const maxAmplitude = Math.max(...amplitudes);
    if (maxAmplitude > 0) {
      for (let i = 0; i < amplitudes.length; i++) {
        amplitudes[i] = amplitudes[i] / maxAmplitude;
      }
    }
    
    return amplitudes;
  }

  /**
   * Filter data by subtracting noise floor and renormalizing.
   * Port of Python AudioProcessingService.filter_data()
   */
  private _filterData(amplitudes: Float32Array, filterAmount: number): Float32Array {
    if (amplitudes.length === 0 || filterAmount <= 0) {
      return amplitudes;
    }
    
    // Sort absolute values to find noise floor (returns new array)
    const sortedAbs = Array.from(amplitudes).map(Math.abs).sort((a, b) => a - b);
    const n = Math.max(1, Math.floor(sortedAbs.length * filterAmount));
    
    // Calculate noise floor as mean of bottom N values
    let noiseFloor = 0;
    for (let i = 0; i < n; i++) {
      noiseFloor += sortedAbs[i];
    }
    noiseFloor /= n;
    
    // Subtract noise floor and clamp to 0
    const filtered = new Float32Array(amplitudes.length);
    for (let i = 0; i < amplitudes.length; i++) {
      filtered[i] = Math.max(0, Math.abs(amplitudes[i]) - noiseFloor);
    }
    
    // Renormalize to 0-1
    const maxVal = Math.max(...filtered);
    if (maxVal > 1e-9) {
      for (let i = 0; i < filtered.length; i++) {
        filtered[i] = filtered[i] / maxVal;
      }
    }
    
    return filtered;
  }

  /**
   * Find the oldest session in cache for eviction
   */
  private _findOldestSession(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, session] of this._cache.entries()) {
      if (session.timestamp < oldestTime) {
        oldestTime = session.timestamp;
        oldestKey = key;
      }
    }
    
    return oldestKey;
  }

  /**
   * Generate a simple hash for file identification
   * (Not cryptographic, just for cache validation)
   */
  private _generateFileHash(file: File): string {
    // Simple hash based on file properties
    const str = `${file.name}_${file.size}_${file.lastModified}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }
}
```

## File: `C:\Users\paulj\WDweb\src\components\AudioSlicerPanel.ts`

```typescript
/**
 * AudioSlicerPanel.ts
 * "Pick a Moment" - Audio slicing interface for selecting audio segments
 * 
 * Architecture: Stateful component (manages audio playback state)
 * - Renders waveform visualization
 * - Provides transport controls (play, rewind, forward)
 * - Mark start/end points for slicing
 * - Exports sliced audio as WAV blob
 * - Emits AUDIO_SLICE_COMPLETE action via controller dispatch
 */

import type { PanelComponent } from '../types/PanelTypes';
import type { ApplicationController } from '../ApplicationController';

interface SliceResult {
  blob: Blob;
  startTime: number;
  endTime: number;
  duration: number;
}

interface AudioSlicerConfig {
  silenceThreshold: number;
  silenceDuration: number;
  removeSilence: boolean;
}

export class AudioSlicerPanel implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _controller: ApplicationController;
  private _config: AudioSlicerConfig;
  
  // DOM references
  private _dropZone: HTMLElement | null = null;
  private _fileInput: HTMLInputElement | null = null;
  private _canvas: HTMLCanvasElement | null = null;
  private _ctx: CanvasRenderingContext2D | null = null;
  private _playhead: HTMLElement | null = null;
  private _selectionOverlay: HTMLElement | null = null;
  private _currentTimeEl: HTMLElement | null = null;
  private _totalTimeEl: HTMLElement | null = null;
  private _markStartBtn: HTMLButtonElement | null = null;
  private _markEndBtn: HTMLButtonElement | null = null;
  private _selectionValueEl: HTMLElement | null = null;
  private _isolateCheckbox: HTMLInputElement | null = null;
  private _commitBtn: HTMLButtonElement | null = null;
  private _playBtn: HTMLButtonElement | null = null;
  private _resultPanel: HTMLElement | null = null;
  private _hintEl: HTMLElement | null = null;
	
	// V2 DOM references
  private _songLoaded: HTMLElement | null = null;
  private _songNameEl: HTMLElement | null = null;
  private _songDurationEl: HTMLElement | null = null;
  private _selectionSummary: HTMLElement | null = null;
  private _markStartBtnV2: HTMLButtonElement | null = null;
  private _markEndBtnV2: HTMLButtonElement | null = null;
  
  // Audio state
  private _audioContext: AudioContext | null = null;
  private _audioBuffer: AudioBuffer | null = null;
  private _sourceNode: AudioBufferSourceNode | null = null;
  private _isPlaying: boolean = false;
  private _playStartedAt: number = 0;
  private _pausedAt: number = 0;
  private _animationFrame: number | null = null;
	
	// Original file reference
  private _originalFile: File | null = null;
	
	// Processed audio (after Demucs)
  private _processedBuffer: AudioBuffer | null = null;
  private _isProcessing: boolean = false;
	
	// Raw vocals buffer (before silence removal)
  private _rawVocalsBuffer: AudioBuffer | null = null;
  
  // Silence params (from config)
  private _minDuration!: number;
  private _silenceThresh!: number;
  private _silenceEnabled!: boolean;
  private _isolateVocals: boolean = false;
	private _optimizationMode: 'speech' | 'music' = 'music';

  // Persisted state
  private _persistedFileName: string | null = null;
  
  // Section references (refreshed on each render)
  private _uploadSection: HTMLElement | null = null;
  private _trimmerSection: HTMLElement | null = null;
  private _enhanceSection: HTMLElement | null = null;
  
  // Selection state
  private _markStart: number | null = null;
  private _markEnd: number | null = null;
  private _markPhase: 'start' | 'end' = 'start';
	
	// Preview state
  private _isPreviewing: boolean = false;
  
  // Callback for slice completion
  private _onSliceComplete: ((result: SliceResult) => void) | null = null;

	// IndexedDB storage
  private static readonly DB_NAME = 'WaveDesignerAudio';
  private static readonly DB_VERSION = 1;
  private static readonly STORE_NAME = 'audioFiles';
  
  private async _openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(AudioSlicerPanel.DB_NAME, AudioSlicerPanel.DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(AudioSlicerPanel.STORE_NAME)) {
          db.createObjectStore(AudioSlicerPanel.STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }
  
  private async _saveAudioToStorage(file: File): Promise<boolean> {
    try {
      // Check available storage
      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        const available = (estimate.quota || 0) - (estimate.usage || 0);
        if (file.size > available * 0.8) {
          console.warn('[AudioSlicerPanel] Insufficient storage for audio file');
          return false;
        }
      }
      
      const db = await this._openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(AudioSlicerPanel.STORE_NAME, 'readwrite');
        const store = tx.objectStore(AudioSlicerPanel.STORE_NAME);
        
        store.put({
          id: 'currentAudio',
          file: file,
          fileName: file.name,
          savedAt: Date.now()
        });
        
        tx.oncomplete = () => {
          console.log('[AudioSlicerPanel] Audio saved to IndexedDB');
          db.close();
          resolve(true);
        };
        tx.onerror = () => {
          console.error('[AudioSlicerPanel] Failed to save audio:', tx.error);
          db.close();
          resolve(false);
        };
      });
    } catch (error) {
      console.error('[AudioSlicerPanel] IndexedDB error:', error);
      return false;
    }
  }
  
  private async _loadAudioFromStorage(): Promise<File | null> {
    try {
      const db = await this._openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(AudioSlicerPanel.STORE_NAME, 'readonly');
        const store = tx.objectStore(AudioSlicerPanel.STORE_NAME);
        const request = store.get('currentAudio');
        
        request.onsuccess = () => {
          db.close();
          if (request.result?.file) {
            console.log('[AudioSlicerPanel] Audio restored from IndexedDB');
            resolve(request.result.file);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => {
          db.close();
          resolve(null);
        };
      });
    } catch (error) {
      console.error('[AudioSlicerPanel] IndexedDB load error:', error);
      return null;
    }
  }
  
  private async _clearAudioStorage(): Promise<void> {
    try {
      const db = await this._openDB();
      const tx = db.transaction(AudioSlicerPanel.STORE_NAME, 'readwrite');
      const store = tx.objectStore(AudioSlicerPanel.STORE_NAME);
      store.delete('currentAudio');
      tx.oncomplete = () => db.close();
    } catch (error) {
      console.error('[AudioSlicerPanel] IndexedDB clear error:', error);
    }
  }

	private async _attemptAudioRestore(): Promise<void> {
    const file = await this._loadAudioFromStorage();
    
    if (file) {
      // Verify filename matches persisted state
      if (file.name === this._persistedFileName) {
        // Read persisted state BEFORE loading (loadFile overwrites it)
        const state = this._controller.getState();
        const src = state?.composition?.audio_source;
        const persistedStart = src?.start_time;
        const persistedEnd = src?.end_time;
        const needsVocals = src?.use_stems || false;
        
        // Load file without auto-commit
        await this._loadFile(file, true);
        
        // Restore slice and demucs state from saved values
        if (persistedStart !== undefined && persistedEnd !== undefined) {
        this._markStart = persistedStart;
          this._markEnd = persistedEnd;
          this._updateSelection();
          this._updateMarkButtonsV2();
        }
        
        // Restore vocals toggle state
        this._isolateVocals = needsVocals;
        
        // Update checkbox if trimmer section exists
        const checkbox = this._trimmerSection?.querySelector('.slicer-isolate-checkbox') as HTMLInputElement;
        if (checkbox) checkbox.checked = needsVocals;
        
        // Do NOT auto-process vocals on restore.
        // Composition is already valid from localStorage - artwork already rendered.
        // Demucs is expensive (30+ seconds); only run when user explicitly requests.
        
        // Do NOT call _handleCommit() here.
        // Global state is already correct from localStorage.
        // Committing would trigger backend processing that resets section_materials.
        return;
      } else {
        // Stale data, clear it
        await this._clearAudioStorage();
      }
    }
    
    // Restore failed - show re-upload prompt
    this._showReuploadPrompt();
  }
  
  private _showReuploadPrompt(): void {
    if (!this._uploadSection) return;
    
    // Update drop zone text to indicate re-upload needed
    const dropText = this._uploadSection.querySelector('.slicer-drop-text');
    const dropHint = this._uploadSection.querySelector('.slicer-drop-hint');
    
    if (dropText) dropText.textContent = 'Re-upload Your Song';
    if (dropHint) {
      dropHint.textContent = 'Your previous session expired. Please upload again to continue editing.';
      (dropHint as HTMLElement).style.color = '#c0392b';
    }
    
    // Ensure drop zone is visible
    this._dropZone?.classList.remove('hidden');
    this._songLoaded?.classList.remove('visible');
  }
  
  constructor(
    controller: ApplicationController,
    config?: Partial<AudioSlicerConfig>,
    onSliceComplete?: (result: SliceResult) => void
  ) {
    this._controller = controller;
    if (!config || config.silenceThreshold === undefined || config.silenceDuration === undefined) {
      throw new Error('[AudioSlicerPanel] Config missing required audio_processing values - check composition_defaults.json');
    }
    this._config = {
      silenceThreshold: config.silenceThreshold,
      silenceDuration: config.silenceDuration,
      removeSilence: config.removeSilence ?? false
    };
    this._silenceThresh = this._config.silenceThreshold;
    this._minDuration = this._config.silenceDuration;
    this._silenceEnabled = this._config.removeSilence;
    this._onSliceComplete = onSliceComplete || null;
    
    // Restore state from composition if available
    const state = controller.getState();
    if (state?.composition?.audio_source) {
      const src = state.composition.audio_source;
      if (src.start_time > 0 || src.end_time > 0) {
        this._markStart = src.start_time;
        this._markEnd = src.end_time;
      }
      this._isolateVocals = src.use_stems || false;
      this._persistedFileName = src.source_file || null;
    }
    if (state?.composition?.audio_processing) {
      this._silenceEnabled = state.composition.audio_processing.remove_silence || false;
    }
  }
  
  /**
   * Restore Upload Section UI based on persisted state
   */
  private _restoreUploadState(): void {
    const fileName = this._originalFile?.name || this._persistedFileName;
    const isLoaded = !!this._audioBuffer || !!this._persistedFileName;

    if (isLoaded && fileName) {
      this._dropZone?.classList.add('hidden');
      this._songLoaded?.classList.add('visible');
      
      if (this._songNameEl) this._songNameEl.textContent = fileName;
      
      if (this._songDurationEl) {
        const durationText = this._audioBuffer 
          ? this._formatTime(this._audioBuffer.duration) 
          : '--:--';
        this._songDurationEl.textContent = `${durationText} · ${this._audioBuffer ? 'Ready' : 'Re-upload to Edit'}`;
      }
    }
  }

  /**
   * Invalidate L3 (Vocals) and L4 (Processed) buffers.
   * Called when L1 (Source) or L2 (Trim) changes.
   */
  private _invalidateGeneratedBuffers(): void {
    if (this._rawVocalsBuffer || this._processedBuffer) {
      console.log('[AudioSlicerPanel] Invalidating cached buffers');
      this._rawVocalsBuffer = null;
      this._processedBuffer = null;
    }
  }

  private _persistTrimState(): void {
    if (this._markStart !== null && this._markEnd !== null) {
      this._controller.updateAudioSourceState({
        start_time: Math.min(this._markStart, this._markEnd),
        end_time: Math.max(this._markStart, this._markEnd)
      });
    }
  }

  private _persistToggleState(): void {
    this._controller.updateAudioSourceState({
      use_stems: this._isolateVocals
    });
    this._controller.updateAudioProcessingState({
      remove_silence: this._silenceEnabled
    });
  }
	
	renderTrimmerSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'audio-slicer-trimmer-section';
    this._trimmerSection = section;
    section.innerHTML = `
      <div class="slicer-section-header">
        <span class="slicer-section-number">1</span>
        <div class="slicer-section-text">
          <div class="slicer-section-title">Select part of the audio</div>
          <div class="slicer-section-desc">Listen, then tap to mark your selection</div>
        </div>
      </div>
      
      <div class="slicer-waveform-row">
        <button class="slicer-skip-btn slicer-btn-rewind" title="Rewind 5 seconds">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
          <span>5s</span>
        </button>
        
        <div class="slicer-waveform-wrap">
          <canvas class="slicer-waveform"></canvas>
          <div class="slicer-playhead"></div>
          <div class="slicer-selection">
            <div class="slicer-handle slicer-handle-start"></div>
            <div class="slicer-handle slicer-handle-end"></div>
          </div>
        </div>
        
        <button class="slicer-skip-btn slicer-btn-forward" title="Forward 5 seconds">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/></svg>
          <span>5s</span>
        </button>
      </div>
      
      <div class="slicer-transport">
        <span class="slicer-time slicer-time-current">0:00</span>
        <span class="slicer-time-separator">/</span>
        <span class="slicer-time slicer-time-total">0:00</span>
      </div>
      
      <div class="slicer-controls-row">
        <button class="slicer-play-btn" data-demo-id="slicer_play" title="Play selection">
          <svg class="slicer-play-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          <svg class="slicer-pause-icon" viewBox="0 0 24 24" fill="currentColor" style="display:none;"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        </button>
        <button class="slicer-mark-btn slicer-btn-mark-start" data-demo-id="slicer_start">
          <span class="slicer-mark-btn-label">Start Here</span>
          <span class="slicer-mark-btn-time">—</span>
        </button>
        <button class="slicer-mark-btn slicer-btn-mark-end" data-demo-id="slicer_end">
          <span class="slicer-mark-btn-label">End Here</span>
          <span class="slicer-mark-btn-time">—</span>
        </button>
        <button class="slicer-btn-reset" title="Reset to full song">Reset</button>
      </div>
      
      <div class="slicer-section-header">
        <span class="slicer-section-number">2</span>
        <div class="slicer-section-text">
          <div class="slicer-section-title">Isolate the Vocals <span class="slicer-vocals-status"></span></div>
          <div class="slicer-section-desc">Removes background music</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" class="slicer-isolate-checkbox" ${this._isolateVocals ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
      
      <input type="hidden" class="slicer-min-duration" value="${this._minDuration}">
      <input type="hidden" class="slicer-silence-thresh" value="${this._silenceThresh}">
      
      <div class="slicer-optimize-section">
        <div class="slicer-section-header" style="padding-bottom:8px;">
          <span class="slicer-section-number">3</span>
          <div class="slicer-section-text">
            <div class="slicer-section-title">Optimize for Visual Impact</div>
            <div class="slicer-section-desc">Auto-adjust settings for best carving results</div>
          </div>
        </div>
        <div class="slicer-optimize-controls">
          <label class="slicer-radio"><input type="radio" name="opt-mode" value="music" checked> Music</label>
          <label class="slicer-radio"><input type="radio" name="opt-mode" value="speech"> Speech</label>
          <button class="slicer-btn-optimize">Auto-Optimize</button>
          <span class="slicer-optimize-status"></span>
        </div>
      </div>
      
      <div class="slicer-cta-footer">
        <button class="slicer-btn-primary slicer-btn-apply" style="flex:1;">Apply To Artwork</button>
      </div>
    `;
    this._cacheTrimmerElements(section);
    this._attachTrimmerListeners(section);
    this._restoreTrimmerState();
    
    // Attempt to restore audio from IndexedDB if not already loaded
    if (!this._audioBuffer && this._persistedFileName) {
      void this._attemptAudioRestore();
    }
    
    return section;
  }

	
	renderUploadSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'audio-slicer-upload-section';
    this._uploadSection = section;
    section.innerHTML = `
      <div class="slicer-drop-zone" data-demo-id="slicer_drop">
        <div class="upload-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <p class="slicer-drop-text">Tap to Choose Your Song</p>
        <p class="slicer-drop-hint">or drag and drop your file here</p>
        <input type="file" class="slicer-file-input" accept="audio/*">
      </div>
      
      <div class="slicer-song-loaded">
        <div class="slicer-song-artwork">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
        </div>
        <div class="slicer-song-info">
          <div class="slicer-song-name"></div>
          <div class="slicer-song-duration"></div>
        </div>
        <button class="slicer-song-change">Change</button>
      </div>
    `;
    this._cacheUploadElements(section);
    this._attachUploadListeners(section);
    this._restoreUploadState();
    
    // Attempt to restore audio from IndexedDB if not already loaded
    if (!this._audioBuffer) {
      void this._attemptAudioRestore();
    }
    
    return section;
  }
	
	private _attachUploadListeners(section: HTMLElement): void {
    this._dropZone?.addEventListener('click', () => this._fileInput?.click());
    this._dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      this._dropZone?.classList.add('dragover');
    });
    this._dropZone?.addEventListener('dragleave', () => {
      this._dropZone?.classList.remove('dragover');
    });
    this._dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      this._dropZone?.classList.remove('dragover');
      const file = (e as DragEvent).dataTransfer?.files[0];
      if (file) this._loadFile(file);
    });
    this._fileInput?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) this._loadFile(file);
    });
    section.querySelector('.slicer-song-change')?.addEventListener('click', () => {
      this._resetToUpload();
    });
  }

  private _attachTrimmerListeners(section: HTMLElement): void {
    this._attachHandleDrag(section);
    section.querySelector('.slicer-play-btn')?.addEventListener('click', () => this._togglePlayback());
    section.querySelector('.slicer-btn-rewind')?.addEventListener('click', () => this._seek(-5));
    section.querySelector('.slicer-btn-forward')?.addEventListener('click', () => this._seek(5));
    section.querySelector('.slicer-btn-mark-start')?.addEventListener('click', () => this._handleMarkStart());
    section.querySelector('.slicer-btn-mark-end')?.addEventListener('click', () => this._handleMarkEnd());
    section.querySelector('.slicer-btn-reset')?.addEventListener('click', () => this._resetToFullTrack());
    section.querySelector('.slicer-isolate-checkbox')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this._isolateVocals = checked;
      this._persistToggleState();
      
      // Process vocals if enabled and not already cached
      if (checked && !this._rawVocalsBuffer && this._audioBuffer && this._originalFile) {
        void this._processVocals();
      }
    });
    section.querySelector('.slicer-btn-apply')?.addEventListener('click', () => this._handleCommit());
    
    // Optimization controls
    section.querySelectorAll('input[name="opt-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this._optimizationMode = (e.target as HTMLInputElement).value as 'speech' | 'music';
      });
    });
    section.querySelector('.slicer-btn-optimize')?.addEventListener('click', () => this._runOptimization());
    
    window.addEventListener('resize', this._handleResize);
  }
	
	/**
   * Get enhancements summary for accordion header display
   */
  public getEnhancementsDisplay(): string | null {
    const vocals = this._isolateVocals;
    const silence = this._silenceEnabled;
    
    if (!vocals && !silence) return null;
    
    const parts: string[] = [];
    if (vocals) parts.push('Vocals');
    if (silence) parts.push('Cleaned');
    return parts.join(', ');
  }
	
	/**
   * Get selection time range for accordion header display
   */
  public getSelectionDisplay(): string | null {
    if (this._markStart === null || this._markEnd === null) return null;
    const start = Math.min(this._markStart, this._markEnd);
    const end = Math.max(this._markStart, this._markEnd);
    return `${this._formatTime(start)} → ${this._formatTime(end)}`;
  }
	
	/**
   * Get loaded filename for accordion header display
   */
  public getLoadedFilename(): string | null {
    return this._originalFile?.name || this._persistedFileName;
  }

  private _attachEnhanceListeners(section: HTMLElement): void {
    section.querySelector('#toggle-vocals .toggle-switch input')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this._isolateVocals = checked;
      const card = section.querySelector('#toggle-vocals');
      card?.classList.toggle('active', checked);
      // Show/hide preview row
      const previewRow = section.querySelector('.slicer-vocals-preview');
      previewRow?.classList.toggle('visible', checked);
      this._controller.updateAudioAccordionValue('demucs');
      this._persistToggleState();
    });
    
    section.querySelector('.slicer-btn-vocals-preview')?.addEventListener('click', () => {
      void this._previewVocals(section);
    });
    section.querySelector('#toggle-silence .toggle-switch input')?.addEventListener('change', (e) => {
      const card = section.querySelector('#toggle-silence');
      const checked = (e.target as HTMLInputElement).checked;
      card?.classList.toggle('active', checked);
      this._silenceEnabled = checked;
      this._controller.updateAudioAccordionValue('demucs');
      this._persistToggleState();
      
      // Auto-process silence removal if enabled and vocals buffer exists
      if (checked && this._rawVocalsBuffer && !this._processedBuffer) {
        void this._processSilenceRemoval(section);
      }
    });
    this._commitBtn?.addEventListener('click', () => this._handleCommit());
  }
  
  private async _runOptimization(): Promise<void> {
    if (!this._originalFile) return;
    
    const statusEl = this._trimmerSection?.querySelector('.slicer-optimize-status') as HTMLElement;
    const btn = this._trimmerSection?.querySelector('.slicer-btn-optimize') as HTMLButtonElement;
    
    if (statusEl) statusEl.textContent = 'Analyzing...';
    if (btn) btn.disabled = true;
    
    const formData = new FormData();
    formData.append('file', this._originalFile);
    formData.append('mode', this._optimizationMode);
    formData.append('num_slots', String(this._controller.getState()?.composition.pattern_settings.number_slots || 48));
    
    try {
      const response = await fetch('/api/audio/optimize', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error(`${response.status}`);
      
      const result = await response.json();
      
      // 1. Get optimized composition DTO (Pure, no state mutation yet)
      const optimizedComposition = this._controller.createOptimizedComposition(result);
      
      if (optimizedComposition) {
        // 2. Pass to main pipeline
        // This ensures detectChangedParams sees the difference in exponent/filter settings,
        // triggering logic which handles cache rebinning AND backend scaling.
        await this._controller.handleCompositionUpdate(optimizedComposition);
      }
      
      if (statusEl) {
        statusEl.textContent = result.status === 'fallback' 
          ? `⚠ ${result.exponent}` 
          : `✓ ${result.exponent}`;
        statusEl.className = `slicer-optimize-status ${result.status}`;
      }
    } catch (error) {
      console.error('[AudioSlicerPanel] Optimization failed:', error);
      if (statusEl) {
        statusEl.textContent = '✗ Error';
        statusEl.className = 'slicer-optimize-status error';
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }
	
	private _cacheEnhanceElements(section: HTMLElement): void {
    this._isolateCheckbox = section.querySelector('.slicer-isolate-checkbox') as HTMLInputElement;
    this._commitBtn = section.querySelector('.slicer-btn-commit');
  }
	
	private _cacheTrimmerElements(section: HTMLElement): void {
    this._canvas = section.querySelector('.slicer-waveform');
    this._ctx = this._canvas?.getContext('2d') || null;
    this._playhead = section.querySelector('.slicer-playhead');
    this._playBtn = section.querySelector('.slicer-play-btn');
    this._currentTimeEl = section.querySelector('.slicer-time-current');
    this._totalTimeEl = section.querySelector('.slicer-time-total');
    this._selectionOverlay = section.querySelector('.slicer-selection');
    this._markStartBtn = section.querySelector('.slicer-btn-mark-start');
    this._markEndBtn = section.querySelector('.slicer-btn-mark-end');
    this._selectionSummary = section.querySelector('.slicer-selection-summary');
  }
	
	private _restoreEnhanceState(): void {
    const section = this._isolateCheckbox?.closest('.audio-slicer-enhance-section');
    if (!section) return;
    
    // Restore vocals toggle card state
    const vocalsCard = section.querySelector('#toggle-vocals');
    if (vocalsCard && this._isolateVocals) {
      vocalsCard.classList.add('active');
    }
    
    // Restore silence toggle card state
    const silenceCard = section.querySelector('#toggle-silence');
    if (silenceCard && this._silenceEnabled) {
      silenceCard.classList.add('active');
    }
  }
	
	private _restoreTrimmerState(): void {
    // Restore total time
    if (this._audioBuffer && this._totalTimeEl) {
      this._totalTimeEl.textContent = this._formatTime(this._audioBuffer.duration);
    }
    
    // Draw waveform if audio loaded
    if (this._audioBuffer) {
      requestAnimationFrame(() => this._drawWaveform());
    }
    
    // Restore slice and demucs state from composition if not already set
    const state = this._controller.getState();
    if (state?.composition?.audio_source) {
      const src = state.composition.audio_source;
      
      // Restore slice markers if audio loaded and marks at default
      if (this._audioBuffer && src.start_time !== undefined && src.end_time !== undefined) {
        const isFullTrack = this._markStart === 0 && this._markEnd === this._audioBuffer.duration;
        const hasPersistedSlice = src.start_time !== 0 || src.end_time !== this._audioBuffer.duration;
        
        if (isFullTrack && hasPersistedSlice) {
          this._markStart = src.start_time;
          this._markEnd = src.end_time;
        }
      }
      
      // Restore vocals toggle
      if (src.use_stems !== undefined) {
        this._isolateVocals = src.use_stems;
        const checkbox = this._trimmerSection?.querySelector('.slicer-isolate-checkbox') as HTMLInputElement;
        if (checkbox) checkbox.checked = this._isolateVocals;
      }
    }
    
    // Restore mark times
    this._updateMarkButtonsV2();
    
    // Restore selection overlay
    this._updateSelection();
    
    // Restore selection summary
    this._updateSelectionSummary();
    
    // Ensure controls are enabled if audio exists
    this._updateCommitButton();
  }
	
	private _restoreUploadState(): void {
    if (this._audioBuffer && this._originalFile) {
      this._dropZone?.classList.add('hidden');
      this._songLoaded?.classList.add('visible');
      if (this._songNameEl) this._songNameEl.textContent = this._originalFile.name;
      if (this._songDurationEl) this._songDurationEl.textContent = `${this._formatTime(this._audioBuffer.duration)} · Ready`;
    }
  }
	
	private _cacheUploadElements(section: HTMLElement): void {
    this._dropZone = section.querySelector('.slicer-drop-zone');
    this._fileInput = section.querySelector('.slicer-file-input');
    this._songLoaded = section.querySelector('.slicer-song-loaded');
    this._songNameEl = section.querySelector('.slicer-song-name');
    this._songDurationEl = section.querySelector('.slicer-song-duration');
  }
  
  private _handleResize = (): void => {
    if (this._audioBuffer) this._drawWaveform();
  };
	
	private _attachHandleDrag(section: HTMLElement): void {
    const wrap = section.querySelector('.slicer-waveform-wrap') as HTMLElement;
    const startHandle = section.querySelector('.slicer-handle-start') as HTMLElement;
    const endHandle = section.querySelector('.slicer-handle-end') as HTMLElement;
    if (!wrap || !startHandle || !endHandle) return;

    const onDrag = (e: MouseEvent | TouchEvent, isStart: boolean) => {
      if (!this._audioBuffer) return;
      const rect = wrap.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const time = pct * this._audioBuffer.duration;
      if (isStart) {
        this._markStart = time;
      } else {
        this._markEnd = time;
      }
      this._invalidateGeneratedBuffers();
      // Clear vocals status since buffer is now stale
      const statusEl = this._trimmerSection?.querySelector('.slicer-vocals-status');
      if (statusEl) statusEl.textContent = '';
      this._updateSelection();
      this._updateMarkButtonsV2();
      this._updateSelectionSummary();
    };

    const attach = (handle: HTMLElement, isStart: boolean) => {
      const onMove = (e: MouseEvent | TouchEvent) => onDrag(e, isStart);
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
        this._persistTrimState();
      };
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
      handle.addEventListener('touchstart', (e) => {
        e.preventDefault();
        document.addEventListener('touchmove', onMove);
        document.addEventListener('touchend', onUp);
      });
    };
    attach(startHandle, true);
    attach(endHandle, false);
  }
  
  private _initAudioContext(): void {
    if (!this._audioContext) {
      this._audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }
  
  private async _loadFile(file: File, skipAutoCommit: boolean = false): Promise<void> {
    this._initAudioContext();
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      this._audioBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);
			this._originalFile = file;
      
      // Update UI
      this._dropZone?.classList.add('hidden');
      this._songLoaded?.classList.add('visible');
      
      // Update song loaded display
      if (this._songNameEl) this._songNameEl.textContent = file.name;
      if (this._songDurationEl) this._songDurationEl.textContent = `${this._formatTime(this._audioBuffer.duration)} · Ready`;
      
      // Show song footer with buttons
      const songFooter = this._container?.querySelector('.slicer-song-footer') as HTMLElement;
      if (songFooter) songFooter.style.display = 'flex';
      
      // Update accordion subtitle
      const songSubtitle = this._container?.querySelector('.slicer-song-subtitle');
      if (songSubtitle) songSubtitle.textContent = file.name;
      
      if (this._totalTimeEl) {
        this._totalTimeEl.textContent = this._formatTime(this._audioBuffer.duration);
      }
      
      this._resetState(skipAutoCommit);
      // Initialize selection to full track so handles are visible
      this._markStart = 0;
      this._markEnd = this._audioBuffer.duration;
      this._updateCommitButton();
      this._drawWaveform();
      this._updateSelection();
      this._updateMarkButtonsV2();
      this._controller.updateAudioAccordionValue('custom');
      
      // Only update state with defaults on fresh upload, not restore
      if (!skipAutoCommit) {
        this._controller.updateAudioSourceState({
          source_file: file.name,
          start_time: 0,
          end_time: this._audioBuffer!.duration
        });
        
        // Save to IndexedDB for persistence across refresh
        void this._saveAudioToStorage(file);
        
        // Auto-commit: immediately process audio after upload
        this._handleCommit();
      }
      
    } catch (err) {
      console.error('[AudioSlicerPanel] Decode error:', err);
      // Could dispatch error action here
    }
  }
  
  private _drawWaveform(): void {
    if (!this._canvas || !this._ctx || !this._audioBuffer) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = this._canvas.getBoundingClientRect();
    this._canvas.width = rect.width * dpr;
    this._canvas.height = rect.height * dpr;
    this._ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    const data = this._audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;
    
    // Read colors from CSS variables
    const styles = getComputedStyle(document.documentElement);
    const bgColor = styles.getPropertyValue('--color-background-secondary').trim() || '244, 244, 244';
    const waveColor = styles.getPropertyValue('--color-foreground-secondary').trim() || '105, 105, 105';
    
    // Background
    this._ctx.fillStyle = `rgb(${bgColor})`;
    this._ctx.fillRect(0, 0, width, height);
    
    // Waveform using RMS for better visual differentiation
    this._ctx.fillStyle = `rgb(${waveColor})`;
    
    for (let i = 0; i < width; i++) {
      // Calculate RMS (root mean square) for this slice
      let sumSquares = 0;
      for (let j = 0; j < step; j++) {
        const v = data[i * step + j] || 0;
        sumSquares += v * v;
      }
      const rms = Math.sqrt(sumSquares / step);
      
      // Scale RMS to visible height (RMS of full-scale sine is ~0.707)
      const barH = Math.max(1, rms * amp * 4.5);
      this._ctx.fillRect(i, amp - barH / 2, 1, barH);
    }
  }
  
  private _formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
  
  private _getCurrentTime(): number {
    if (!this._audioContext) return this._pausedAt;
    return this._isPlaying
      ? this._pausedAt + (this._audioContext.currentTime - this._playStartedAt)
      : this._pausedAt;
  }
  
  private _togglePlayback(): void {
    this._initAudioContext();
    if (this._isPlaying) {
      this._stop();
    } else {
      this._play();
    }
  }
  
  private _play(): void {
    if (!this._audioBuffer || !this._audioContext) return;
    
    // Stop any existing playback first
    this._stopAll();
    
    // Use vocals buffer if stem separation enabled and available
    const buffer = (this._isolateVocals && this._rawVocalsBuffer) 
      ? this._rawVocalsBuffer 
      : this._audioBuffer;
    
    // Determine selection bounds
    // When using vocals buffer, it's already sliced - play full buffer
    const isUsingVocals = this._isolateVocals && !!this._rawVocalsBuffer;
    const startTime = isUsingVocals ? 0 : (this._markStart ?? 0);
    const endTime = isUsingVocals ? buffer.duration : (this._markEnd ?? buffer.duration);
    const selectionStart = Math.min(startTime, endTime);
    const selectionEnd = Math.max(startTime, endTime);
    
    // Reset pausedAt if it's outside valid range for current buffer
    if (this._pausedAt < selectionStart || this._pausedAt >= selectionEnd) {
      this._pausedAt = selectionStart;
    }
    
    // Start from selection start, or paused position if within selection
    let offset = selectionStart;
    if (this._pausedAt >= selectionStart && this._pausedAt < selectionEnd) {
      offset = this._pausedAt;
    }
    
    this._sourceNode = this._audioContext.createBufferSource();
    this._sourceNode.buffer = buffer;
    this._sourceNode.connect(this._audioContext.destination);
    this._sourceNode.start(0, offset, selectionEnd - offset);
    
    this._pausedAt = offset;
    this._playStartedAt = this._audioContext.currentTime;
    this._isPlaying = true;
    this._playhead?.classList.add('visible');
    
    if (this._markStartBtn) this._markStartBtn.disabled = false;
    if (this._markEndBtn) this._markEndBtn.disabled = false;
    
    // Toggle play/pause icons
    const section = this._trimmerSection || this._container;
    const playBtn = section?.querySelector('.slicer-play-btn');
    const playIcon = playBtn?.querySelector('.slicer-play-icon') as HTMLElement;
    const pauseIcon = playBtn?.querySelector('.slicer-pause-icon') as HTMLElement;
    if (playIcon) playIcon.style.display = 'none';
    if (pauseIcon) pauseIcon.style.display = '';
    playBtn?.classList.add('playing');
    
    this._sourceNode.onended = () => {
      if (this._isPlaying) this._stop();
    };
    
    this._updatePlayhead();
  }
  
  private _stop(): void {
    if (this._sourceNode) {
      this._sourceNode.onended = null;
      this._sourceNode.stop();
      this._sourceNode.disconnect();
      this._sourceNode = null;
    }
    
    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }
    
    this._pausedAt = this._getCurrentTime();
    if (this._audioBuffer && this._pausedAt >= this._audioBuffer.duration) {
      this._pausedAt = 0;
    }
    
    this._isPlaying = false;
    
    // Toggle play/pause icons (check both _trimmerSection and _container)
    const section = this._trimmerSection || this._container;
    const playBtn = section?.querySelector('.slicer-play-btn');
    const playIcon = playBtn?.querySelector('.slicer-play-icon') as HTMLElement;
    const pauseIcon = playBtn?.querySelector('.slicer-pause-icon') as HTMLElement;
    if (playIcon) playIcon.style.display = '';
    if (pauseIcon) pauseIcon.style.display = 'none';
    playBtn?.classList.remove('playing');
    
    if (this._currentTimeEl) this._currentTimeEl.textContent = this._formatTime(this._pausedAt);
  }
  
  private _seek(delta: number): void {
    if (!this._audioBuffer) return;
    
    const wasPlaying = this._isPlaying;
    if (wasPlaying) this._stop();
    
    this._pausedAt = Math.max(0, Math.min(this._pausedAt + delta, this._audioBuffer.duration));
    if (this._currentTimeEl) this._currentTimeEl.textContent = this._formatTime(this._pausedAt);
    this._updatePlayheadPosition();
    
    if (wasPlaying) this._play();
  }
  
  private _updatePlayhead(): void {
    const t = this._getCurrentTime();
    this._updatePlayheadPosition();
    if (this._currentTimeEl) this._currentTimeEl.textContent = this._formatTime(t);
    
    // Determine selection end (default to full track)
    const startTime = this._markStart ?? 0;
    const endTime = this._markEnd ?? (this._audioBuffer?.duration ?? 0);
    const selectionEnd = Math.max(startTime, endTime);
    
    if (this._isPlaying && this._audioBuffer && t < selectionEnd) {
      this._animationFrame = requestAnimationFrame(() => this._updatePlayhead());
    } else if (this._audioBuffer && t >= selectionEnd) {
      this._stop();
    }
  }
  
  private _updatePlayheadPosition(): void {
    if (!this._playhead || !this._audioBuffer) return;
    const t = this._getCurrentTime();
    
    // When playing vocals buffer, map position to selection range visually
    const isUsingVocals = this._isolateVocals && !!this._rawVocalsBuffer;
    let pct: number;
    
    if (isUsingVocals && this._markStart !== null && this._markEnd !== null) {
      // Map vocals time (0 to vocalsBuffer.duration) to selection range
      const selectionStart = Math.min(this._markStart, this._markEnd);
      const selectionEnd = Math.max(this._markStart, this._markEnd);
      const selectionDuration = selectionEnd - selectionStart;
      const visualTime = selectionStart + (t / this._rawVocalsBuffer!.duration) * selectionDuration;
      pct = (visualTime / this._audioBuffer.duration) * 100;
    } else {
      pct = (t / this._audioBuffer.duration) * 100;
    }
    
    this._playhead.style.left = `${pct}%`;
  }
  
  private _handleMarkStart(): void {
    this._markStart = this._getCurrentTime();
    this._invalidateGeneratedBuffers();
    this._updateSelectionDisplay();
    this._updateSelection();
    this._updateCommitButton();
    this._updateMarkButtonsV2();
    this._updateSelectionSummary();
    this._controller.updateAudioAccordionValue('slicing');
    this._persistTrimState();
  }
  
  private _handleMarkEnd(): void {
    this._markEnd = this._getCurrentTime();
    this._stop();
    
    // Ensure start < end
    if (this._markStart !== null && this._markEnd < this._markStart) {
      [this._markStart, this._markEnd] = [this._markEnd, this._markStart];
    }
    
    this._invalidateGeneratedBuffers();
    this._updateSelectionDisplay();
    this._updateSelection();
    this._updateCommitButton();
    this._updateMarkButtonsV2();
    this._updateSelectionSummary();
    this._controller.updateAudioAccordionValue('slicing');
    this._persistTrimState();
  }
  
  private _updateSelectionDisplay(): void {
    if (!this._selectionValueEl) return;
    
    if (this._markStart !== null && this._markEnd !== null) {
      const duration = Math.round(this._markEnd - this._markStart);
      this._selectionValueEl.textContent = `${this._formatTime(this._markStart)} → ${this._formatTime(this._markEnd)} (${duration}s)`;
    } else if (this._markStart !== null) {
      this._selectionValueEl.textContent = `${this._formatTime(this._markStart)} → ...`;
    } else {
      this._selectionValueEl.textContent = 'Full track';
    }
  }
  
  private _updateCommitButton(): void {
    if (!this._commitBtn) return;
    this._commitBtn.disabled = !this._audioBuffer;
    
    if (this._markStartBtn) this._markStartBtn.disabled = !this._audioBuffer;
    if (this._markEndBtn) this._markEndBtn.disabled = !this._audioBuffer;
    
    const previewBtn = this._container?.querySelector('.slicer-btn-preview') as HTMLButtonElement;
    const redoBtn = this._container?.querySelector('.slicer-btn-redo') as HTMLButtonElement;
    if (previewBtn) previewBtn.disabled = !this._audioBuffer;
    if (redoBtn) redoBtn.disabled = this._markStart === null && this._markEnd === null;
  }
  
  private _redo(): void {
    this._markStart = null;
    this._markEnd = null;
    this._processedBuffer = null;
    this._updateSelectionDisplay();
    this._updateSelection();
    this._updateCommitButton();
  }
  
  private _updateSelection(): void {
    if (!this._selectionOverlay || !this._audioBuffer) return;
    
    if (this._markStart === null) {
      this._selectionOverlay.classList.remove('visible');
      return;
    }
    
    const start = this._markEnd !== null ? Math.min(this._markStart, this._markEnd) : this._markStart;
    const end = this._markEnd !== null ? Math.max(this._markStart, this._markEnd) : start;
    
    const leftPct = (start / this._audioBuffer.duration) * 100;
    const widthPct = ((end - start) / this._audioBuffer.duration) * 100;
    
    this._selectionOverlay.style.left = `${leftPct}%`;
    this._selectionOverlay.style.width = `${Math.max(0.5, widthPct)}%`;
    this._selectionOverlay.classList.add('visible');
  }
  
  private _showResult(): void {
    if (this._markStart === null || this._markEnd === null) return;
    
    // Hide mark row, show result
    const markRow = this._container?.querySelector('.slicer-mark-row') as HTMLElement;
    if (markRow) markRow.style.display = 'none';
    if (this._hintEl) this._hintEl.style.display = 'none';
    
    // Update result display
    const startEl = this._container?.querySelector('.slicer-result-start');
    const endEl = this._container?.querySelector('.slicer-result-end');
    const secondsEl = this._container?.querySelector('.slicer-result-seconds');
    
    if (startEl) startEl.textContent = this._formatTime(this._markStart);
    if (endEl) endEl.textContent = this._formatTime(this._markEnd);
    if (secondsEl) secondsEl.textContent = Math.round(this._markEnd - this._markStart).toString();
    
    this._updateSelection();
    this._resultPanel?.classList.add('visible');
  }
  
  private async _preview(): Promise<void> {
    if (!this._audioBuffer) return;
    
    const previewBtn = this._container?.querySelector('.slicer-preview-row .slicer-btn-preview') as HTMLButtonElement;
    
    // Toggle off if already previewing
    if (this._isPreviewing) {
      this._stopAll();
      return;
    }
    
    // If processing, ignore
    if (this._isProcessing) return;
    
    const isolateVocals = this._isolateCheckbox?.checked || false;
    
    // If isolate vocals checked, need to process first
    if (isolateVocals) {
      await this._previewWithProcessing(previewBtn);
    } else {
      this._previewLocal(previewBtn);
    }
  }
  
  private _previewLocal(previewBtn: HTMLButtonElement | null): void {
    if (!this._audioBuffer) return;
    
    const startTime = this._markStart ?? 0;
    const endTime = this._markEnd ?? this._audioBuffer.duration;
    
    this._initAudioContext();
    this._stopAll();
    
    this._sourceNode = this._audioContext!.createBufferSource();
    this._sourceNode.buffer = this._audioBuffer;
    this._sourceNode.connect(this._audioContext!.destination);
    this._sourceNode.start(0, startTime, endTime - startTime);
    
    this._isPreviewing = true;
    if (previewBtn) previewBtn.textContent = '❚❚ Pause';
    
    this._sourceNode.onended = () => {
      this._isPreviewing = false;
      if (previewBtn) previewBtn.textContent = '▶ Preview';
    };
  }
  private async _previewWithProcessing(previewBtn: HTMLButtonElement | null): Promise<void> {
    if (!this._audioBuffer || !this._originalFile) return;
    
    this._isProcessing = true;
    if (previewBtn) previewBtn.textContent = '⏳ Processing...';
    
    try {
      // Build source audio
      const useSlice = this._markStart !== null && this._markEnd !== null;
      const audioFile = useSlice 
        ? new File([this._createSliceBlob()!], 'slice.wav', { type: 'audio/wav' })
        : this._originalFile;
      
      // Send to backend
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('isolate_vocals', 'true');
      
      const response = await fetch('/api/audio/process-commit', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Processing failed: ${response.status}`);
      }
      
      // Decode response
      const processedBlob = await response.blob();
      const arrayBuffer = await processedBlob.arrayBuffer();
      
      this._initAudioContext();
      // Store raw vocals (before silence removal)
      this._rawVocalsBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);
      this._processedBuffer = this._rawVocalsBuffer;
      
      // Show silence options
      const silenceOptions = this._container?.querySelector('.slicer-silence-options') as HTMLElement;
      if (silenceOptions) silenceOptions.style.display = 'block';
      
      // Play processed audio
      this._stopAll();
      this._sourceNode = this._audioContext!.createBufferSource();
      this._sourceNode.buffer = this._processedBuffer;
      this._sourceNode.connect(this._audioContext!.destination);
      this._sourceNode.start(0);
      
      this._isPreviewing = true;
      this._isProcessing = false;
      this._pausedAt = 0;
      this._playStartedAt = this._audioContext!.currentTime;
      if (previewBtn) previewBtn.textContent = '❚❚ Pause';
      
      // Start highlight animation loop
      const duration = this._processedBuffer!.duration;
      const updatePreviewHighlight = () => {
        if (!this._isPreviewing) return;
        const currentTime = this._audioContext!.currentTime - this._playStartedAt;
        this._updateSlotHighlight(currentTime);
        if (currentTime < duration) {
          requestAnimationFrame(updatePreviewHighlight);
        }
      };
      requestAnimationFrame(updatePreviewHighlight);
      
      this._sourceNode.onended = () => {
        this._isPreviewing = false;
        this._controller.highlightSlot(null);
        if (previewBtn) previewBtn.textContent = '▶ Preview';
      };
      
    } catch (error) {
      console.error('[AudioSlicerPanel] Preview processing failed:', error);
      this._isProcessing = false;
      if (previewBtn) previewBtn.textContent = '▶ Preview';
    }
  }
	
	private async _previewVocals(section: HTMLElement): Promise<void> {
    const btn = section.querySelector('.slicer-btn-vocals-preview') as HTMLButtonElement;
    const label = btn?.querySelector('.slicer-preview-label');
    const status = section.querySelector('.slicer-status-text');
    
    // If already previewing, stop
    if (this._isPreviewing) {
      this._stopAll();
      if (label) label.textContent = this._rawVocalsBuffer ? 'Preview Vocals' : 'Process & Preview';
      return;
    }
    
    // If cached, play directly
    if (this._rawVocalsBuffer) {
      this._playBuffer(this._rawVocalsBuffer, btn, label);
      return;
    }
    
    // Need to process
    if (!this._audioBuffer || !this._originalFile) return;
    
    this._isProcessing = true;
    if (label) label.textContent = 'Processing...';
    if (btn) btn.disabled = true;
    if (status) status.textContent = '';
    
    try {
      const useSlice = this._markStart !== null && this._markEnd !== null;
      const audioFile = useSlice 
        ? new File([this._createSliceBlob()!], 'slice.wav', { type: 'audio/wav' })
        : this._originalFile;
      
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('isolate_vocals', 'true');
      
      const response = await fetch('/api/audio/process-commit', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error(`Processing failed: ${response.status}`);
      
      const processedBlob = await response.blob();
      const arrayBuffer = await processedBlob.arrayBuffer();
      
      this._initAudioContext();
      this._rawVocalsBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);
      
      if (status) status.textContent = '✓ Cached';
      this._isProcessing = false;
      if (btn) btn.disabled = false;
      
      this._playBuffer(this._rawVocalsBuffer, btn, label);
      
    } catch (error) {
      console.error('[AudioSlicerPanel] Vocals processing failed:', error);
      this._isProcessing = false;
      if (btn) btn.disabled = false;
      if (label) label.textContent = 'Process & Preview';
      if (status) status.textContent = '✗ Failed';
    }
  }

private async _processPreviewSilenceRemoval(): Promise<void> {
    if (!this._rawVocalsBuffer) return;
    
    try {
      const rawBlob = this._encodeWAV(this._rawVocalsBuffer);
      
      const formData = new FormData();
      formData.append('file', new File([rawBlob], 'vocals.wav', { type: 'audio/wav' }));
      formData.append('min_duration', String(this._minDuration));
      formData.append('threshold_db', String(this._silenceThresh));
      
      const response = await fetch('/api/audio/compress-silence', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error(`Silence removal failed: ${response.status}`);
      
      const compressedBlob = await response.blob();
      const arrayBuffer = await compressedBlob.arrayBuffer();
      
      this._initAudioContext();
      // Replace raw vocals with silence-removed version for preview
      this._rawVocalsBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);
      
    } catch (error) {
      console.error('[AudioSlicerPanel] Preview silence removal failed:', error);
      // Keep raw vocals buffer - preview will work but without silence removal
    }
  }

private async _processVocals(): Promise<void> {
    if (!this._audioBuffer || !this._originalFile) return;
    if (this._isProcessing) return;
    
    this._isProcessing = true;
    
    // Update UI to show processing
    const statusEl = this._trimmerSection?.querySelector('.slicer-vocals-status') as HTMLElement;
    const playBtn = this._trimmerSection?.querySelector('.slicer-play-btn') as HTMLButtonElement;
    const applyBtn = this._trimmerSection?.querySelector('.slicer-btn-apply') as HTMLButtonElement;
    if (statusEl) {
      statusEl.textContent = '(processing...)';
      statusEl.style.color = '#c0392b';
    }
    if (playBtn) playBtn.disabled = true;
    if (applyBtn) applyBtn.disabled = true;
    
    try {
      const useSlice = this._markStart !== null && this._markEnd !== null;
      const audioFile = useSlice 
        ? new File([this._createSliceBlob()!], 'slice.wav', { type: 'audio/wav' })
        : this._originalFile;
      
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('isolate_vocals', 'true');
      
      const response = await fetch('/api/audio/process-commit', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error(`Processing failed: ${response.status}`);
      
      const processedBlob = await response.blob();
      const arrayBuffer = await processedBlob.arrayBuffer();
      
      this._initAudioContext();
      this._rawVocalsBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);
      
      // Now process silence removal for preview parity
      await this._processPreviewSilenceRemoval();
      
      // Show success
      const statusEl = this._trimmerSection?.querySelector('.slicer-vocals-status') as HTMLElement;
      if (statusEl) {
        statusEl.textContent = '✓';
        statusEl.style.color = '#27ae60';
      }
      
    } catch (error) {
      console.error('[AudioSlicerPanel] Vocals processing failed:', error);
      this._isolateVocals = false;
      const checkbox = this._trimmerSection?.querySelector('.slicer-isolate-checkbox') as HTMLInputElement;
      if (checkbox) checkbox.checked = false;
      
      // Show failure
      const statusEl = this._trimmerSection?.querySelector('.slicer-vocals-status') as HTMLElement;
      if (statusEl) {
        statusEl.textContent = '✗ failed';
        statusEl.style.color = '#c0392b';
      }
    } finally {
      this._isProcessing = false;
      // Re-enable buttons
      const playBtn = this._trimmerSection?.querySelector('.slicer-play-btn') as HTMLButtonElement;
      const applyBtn = this._trimmerSection?.querySelector('.slicer-btn-apply') as HTMLButtonElement;
      if (playBtn) playBtn.disabled = false;
      if (applyBtn) applyBtn.disabled = false;
    }
  }
  
  private _playBuffer(buffer: AudioBuffer, btn?: HTMLButtonElement | null, label?: Element | null): void {
    this._initAudioContext();
    this._stopAll();
    
    this._sourceNode = this._audioContext!.createBufferSource();
    this._sourceNode.buffer = buffer;
    this._sourceNode.connect(this._audioContext!.destination);
    this._sourceNode.start(0);
    
    this._isPreviewing = true;
    if (label) label.textContent = 'Pause';
    
    this._sourceNode.onended = () => {
      this._isPreviewing = false;
      if (label) label.textContent = this._rawVocalsBuffer ? 'Preview Vocals' : 'Process & Preview';
    };
  }
	
	private async _processSilenceRemoval(section: HTMLElement): Promise<void> {
    if (!this._rawVocalsBuffer) return;
    
    const card = section.querySelector('#toggle-silence');
    const statusEl = document.createElement('span');
    statusEl.className = 'slicer-silence-status';
    statusEl.textContent = ' Processing...';
    card?.querySelector('.slicer-toggle-title')?.appendChild(statusEl);
    
    try {
      const rawBlob = this._encodeWAV(this._rawVocalsBuffer);
      
      const formData = new FormData();
      formData.append('file', new File([rawBlob], 'vocals.wav', { type: 'audio/wav' }));
      formData.append('min_duration', String(this._minDuration));
      formData.append('threshold_db', String(this._silenceThresh));
      
      const response = await fetch('/api/audio/compress-silence', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error(`Silence removal failed: ${response.status}`);
      
      const compressedBlob = await response.blob();
      const arrayBuffer = await compressedBlob.arrayBuffer();
      
      this._initAudioContext();
      this._processedBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);
      
      statusEl.textContent = ' ✓ Ready';
      setTimeout(() => statusEl.remove(), 2000);
      
    } catch (error) {
      console.error('[AudioSlicerPanel] Silence removal failed:', error);
      statusEl.textContent = ' ✗ Failed';
      setTimeout(() => statusEl.remove(), 3000);
    }
  }
  
  private _stopAll(): void {
    // Stop main playback
    if (this._sourceNode) {
      this._sourceNode.onended = null;
      this._sourceNode.stop();
      this._sourceNode.disconnect();
      this._sourceNode = null;
    }
    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }
    
    // Reset states
    this._isPlaying = false;
    this._isPreviewing = false;
    
    // Reset play button icon to play state
    if (this._playBtn) {
      const playIcon = this._playBtn.querySelector('.slicer-play-icon') as HTMLElement;
      const pauseIcon = this._playBtn.querySelector('.slicer-pause-icon') as HTMLElement;
      if (playIcon) playIcon.style.display = '';
      if (pauseIcon) pauseIcon.style.display = 'none';
      this._playBtn.classList.remove('playing');
    }
    
    const previewBtn = this._container?.querySelector('.slicer-btn-preview') as HTMLButtonElement;
    if (previewBtn) previewBtn.textContent = '▶ Preview';
  }
  
  private _reset(): void {
    this._markStart = null;
    this._markEnd = null;
    this._markPhase = 'start';
    this._pausedAt = 0;
    
    // Reset mark button
    if (this._markStartBtn) this._markStartBtn.disabled = true;
    if (this._markEndBtn) this._markEndBtn.disabled = true;
    if (this._commitBtn) this._commitBtn.disabled = true;
    if (this._selectionValueEl) this._selectionValueEl.textContent = 'Full track';
    if (this._isolateCheckbox) this._isolateCheckbox.checked = false;
    
    // Show mark row, hide result
    const markRow = this._container?.querySelector('.slicer-mark-row') as HTMLElement;
    if (markRow) markRow.style.display = 'block';
    if (this._hintEl) {
      this._hintEl.style.display = 'block';
      this._hintEl.textContent = 'Press play, then mark your section';
      this._hintEl.classList.remove('active');
    }
    
    this._resultPanel?.classList.remove('visible');
    this._selectionOverlay?.classList.remove('visible');
    this._playhead?.classList.remove('visible');
    
    if (this._currentTimeEl) this._currentTimeEl.textContent = '0:00';
    
    // Enable preview/commit if audio loaded
    if (this._audioBuffer) {
      if (this._commitBtn) this._commitBtn.disabled = false;
      const previewBtn = this._container?.querySelector('.slicer-preview-row .slicer-btn-preview') as HTMLButtonElement;
      if (previewBtn) previewBtn.disabled = false;
    }
  }
  
  private _exportSlice(): void {
    if (this._markStart === null || this._markEnd === null || !this._audioBuffer || !this._audioContext) return;
    
    const sampleRate = this._audioBuffer.sampleRate;
    const startSample = Math.floor(this._markStart * sampleRate);
    const endSample = Math.floor(this._markEnd * sampleRate);
    const sliceLength = endSample - startSample;
    const numChannels = this._audioBuffer.numberOfChannels;
    
    // Create sliced buffer
    const slicedBuffer = this._audioContext.createBuffer(numChannels, sliceLength, sampleRate);
    for (let ch = 0; ch < numChannels; ch++) {
      slicedBuffer.getChannelData(ch).set(
        this._audioBuffer.getChannelData(ch).subarray(startSample, endSample)
      );
    }
    
    // Encode as WAV
    const wavBlob = this._encodeWAV(slicedBuffer);
    
    // Invoke callback or dispatch action
    if (this._onSliceComplete) {
      this._onSliceComplete({
        blob: wavBlob,
        startTime: this._markStart,
        endTime: this._markEnd,
        duration: this._markEnd - this._markStart
      });
    }
    
    // Dispatch action to controller
    void this._controller.dispatch({
      type: 'AUDIO_SLICE_COMPLETE',
      payload: {
        blob: wavBlob,
        startTime: this._markStart,
        endTime: this._markEnd,
        duration: this._markEnd - this._markStart
      }
    });
  }
	
	private _handleCommit(): void {
    const isolateVocals = this._isolateVocals || this._isolateCheckbox?.checked || false;
    const useSlice = this._markStart !== null && this._markEnd !== null;
    const removeSilence = isolateVocals ? true : this._silenceEnabled;
    
    // If vocals already processed client-side, use cached buffer and skip backend demucs
    const vocalsAlreadyProcessed = isolateVocals && !!this._rawVocalsBuffer;
    
    let fileToSend: File | Blob | undefined = this._originalFile ?? undefined;
    if (vocalsAlreadyProcessed) {
      // Send pre-processed vocals, tell backend to skip demucs
      fileToSend = new File([this._encodeWAV(this._rawVocalsBuffer!)], 'vocals.wav', { type: 'audio/wav' });
    }
    
    void this._controller.dispatch({
      type: 'AUDIO_COMMIT',
      payload: {
        // When vocals pre-processed, file is already sliced - don't slice again
        useSlice: vocalsAlreadyProcessed ? false : useSlice,
        startTime: vocalsAlreadyProcessed ? 0 : this._markStart,
        endTime: vocalsAlreadyProcessed ? (this._rawVocalsBuffer?.duration ?? this._markEnd) : this._markEnd,
        isolateVocals: vocalsAlreadyProcessed ? false : isolateVocals, // Skip demucs if already done
        removeSilence,
        silenceThreshold: this._silenceThresh,
        silenceMinDuration: this._minDuration,
        sliceBlob: null, // Slicing handled by file selection above
        originalFile: fileToSend
      }
    });
  }
	
	private async _applySilenceCompression(): Promise<void> {
    if (!this._rawVocalsBuffer) {
      console.warn('[AudioSlicerPanel] No raw vocals to compress');
      return;
    }
    
    // Use config values (set from composition_defaults.json in constructor)
    // Do not override from DOM - instance properties are authoritative
    
    const applyBtn = this._container?.querySelector('.slicer-btn-apply-silence') as HTMLButtonElement;
    if (applyBtn) applyBtn.textContent = '⏳ Applying...';
    
    try {
      const rawBlob = this._encodeWAV(this._rawVocalsBuffer);
      
      const formData = new FormData();
      formData.append('file', new File([rawBlob], 'vocals.wav', { type: 'audio/wav' }));
      formData.append('min_duration', String(this._minDuration));
      formData.append('threshold_db', String(this._silenceThresh));
      
      const response = await fetch('/api/audio/compress-silence', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error(`Compression failed: ${response.status}`);
      
      const compressedBlob = await response.blob();
      const arrayBuffer = await compressedBlob.arrayBuffer();
      
      this._initAudioContext();
      this._processedBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);
      
      // Auto-play result
      this._stopAll();
      this._sourceNode = this._audioContext!.createBufferSource();
      this._sourceNode.buffer = this._processedBuffer;
      this._sourceNode.connect(this._audioContext!.destination);
      this._sourceNode.start(0);
      
      this._isPreviewing = true;
      
      const previewBtn = this._container?.querySelector('.slicer-preview-row .slicer-btn-preview') as HTMLButtonElement;
      if (previewBtn) previewBtn.textContent = '❚❚ Pause';
      
      this._sourceNode.onended = () => {
        this._isPreviewing = false;
        if (previewBtn) previewBtn.textContent = '▶ Preview';
      };
      
    } catch (error) {
      console.error('[AudioSlicerPanel] Silence compression failed:', error);
    } finally {
      if (applyBtn) applyBtn.textContent = 'Apply';
    }
  }
  
  private _createSliceBlob(): Blob | null {
    if (this._markStart === null || this._markEnd === null || !this._audioBuffer || !this._audioContext) {
      return null;
    }
    
    const sampleRate = this._audioBuffer.sampleRate;
    const startSample = Math.floor(this._markStart * sampleRate);
    const endSample = Math.floor(this._markEnd * sampleRate);
    const sliceLength = endSample - startSample;
    const numChannels = this._audioBuffer.numberOfChannels;
    
    const slicedBuffer = this._audioContext.createBuffer(numChannels, sliceLength, sampleRate);
    for (let ch = 0; ch < numChannels; ch++) {
      slicedBuffer.getChannelData(ch).set(
        this._audioBuffer.getChannelData(ch).subarray(startSample, endSample)
      );
    }
    
    return this._encodeWAV(slicedBuffer);
  }
  
  private _encodeWAV(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const dataLength = buffer.length * blockAlign;
    const arrayBuffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(arrayBuffer);
    
    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    
    // RIFF header
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeStr(8, 'WAVE');
    
    // fmt chunk
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    
    // data chunk
    writeStr(36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Interleaved samples
    const channels: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
      channels.push(buffer.getChannelData(ch));
    }
    
    let pos = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, channels[ch][i]));
        view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        pos += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
	
	private _openAccordion(id: string): void {
    const target = this._container?.querySelector(`#${id}`) as HTMLDetailsElement;
    if (target) {
      // Close others
      this._container?.querySelectorAll('.subcategory-item').forEach(item => {
        (item as HTMLDetailsElement).open = false;
      });
      target.open = true;
    }
  }
  
  private _resetToUpload(): void {
    this._stopAll();
    this._audioBuffer = null;
    this._originalFile = null;
    this._processedBuffer = null;
    this._rawVocalsBuffer = null;
    this._resetState();
    
    // Clear stored audio since user is starting fresh
    void this._clearAudioStorage();
    
    this._dropZone?.classList.remove('hidden');
    this._songLoaded?.classList.remove('visible');
    
    const songFooter = this._container?.querySelector('.slicer-song-footer') as HTMLElement;
    if (songFooter) songFooter.style.display = 'none';
    
    const subtitle = this._container?.querySelector('.slicer-song-subtitle');
    if (subtitle) subtitle.textContent = 'Choose audio file';
    
    if (this._fileInput) this._fileInput.value = '';
  }
  
  private _useFullTrack(): void {
    if (!this._audioBuffer) return;
    this._markStart = 0;
    this._markEnd = this._audioBuffer.duration;
    this._updateMarkButtonsV2();
    this._updateSelectionSummary();
    this._updateSelection();
    this._controller.updateAudioAccordionValue('slicing');
  }
  
  private _handlePreviewFinal(): void {
    const btn = this._trimmerSection?.querySelector('.slicer-btn-preview-final');
    const playIcon = btn?.querySelector('.slicer-play-icon') as HTMLElement;
    const pauseIcon = btn?.querySelector('.slicer-pause-icon') as HTMLElement;
    const label = btn?.querySelector('.slicer-preview-label');
    
    if (this._isPreviewing) {
      this._stopAll();
      this._isPreviewing = false;
      if (playIcon) playIcon.style.display = '';
      if (pauseIcon) pauseIcon.style.display = 'none';
      if (label) label.textContent = 'Preview';
    } else {
      this._handleCommit();
    }
  }
  
  private _resetToFullTrack(): void {
    if (!this._audioBuffer) return;
    this._markStart = 0;
    this._markEnd = this._audioBuffer.duration;
    this._pausedAt = 0;
    
    // Invalidate vocals buffer since slice changed
    this._invalidateGeneratedBuffers();
    
    // Reset vocals toggle
    this._isolateVocals = false;
    const checkbox = this._trimmerSection?.querySelector('.slicer-isolate-checkbox') as HTMLInputElement;
    if (checkbox) checkbox.checked = false;
    
    // Clear vocals status
    const statusEl = this._trimmerSection?.querySelector('.slicer-vocals-status') as HTMLElement;
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.style.color = '';
    }
    
    this._updateMarkButtonsV2();
    this._updateSelection();
    this._persistTrimState();
  } 
  
  private _updateMarkButtonsV2(): void {
    if (!this._trimmerSection) return;
    
    const startTimeEl = this._trimmerSection.querySelector('.slicer-btn-mark-start .slicer-mark-btn-time');
    const endTimeEl = this._trimmerSection.querySelector('.slicer-btn-mark-end .slicer-mark-btn-time');
    const startBtn = this._trimmerSection.querySelector('.slicer-btn-mark-start');
    const endBtn = this._trimmerSection.querySelector('.slicer-btn-mark-end');
    
    if (startTimeEl) {
      startTimeEl.textContent = this._markStart !== null ? this._formatTime(this._markStart) : '—';
    }
    if (startBtn) {
      startBtn.classList.toggle('marked', this._markStart !== null);
    }
    if (endTimeEl) {
      endTimeEl.textContent = this._markEnd !== null ? this._formatTime(this._markEnd) : '—';
    }
    if (endBtn) {
      endBtn.classList.toggle('marked', this._markEnd !== null);
    }
  }
  
  private _updateSelectionSummary(): void {
    const summary = this._trimmerSection?.querySelector('.slicer-selection-summary');
    if (!summary) return;
    
    if (this._markStart !== null && this._markEnd !== null) {
      const start = Math.min(this._markStart, this._markEnd);
      const end = Math.max(this._markStart, this._markEnd);
      const duration = end - start;
      
      const rangeEl = summary.querySelector('.slicer-summary-range');
      const durationEl = summary.querySelector('.slicer-summary-duration');
      
      if (rangeEl) rangeEl.textContent = `${this._formatTime(start)} → ${this._formatTime(end)}`;
      if (durationEl) {
        const mins = Math.floor(duration / 60);
        const secs = Math.floor(duration % 60);
        durationEl.textContent = mins > 0 ? `(${mins} min ${secs} sec)` : `(${secs} sec)`;
      }
      
      summary.classList.add('visible');
    } else {
      summary.classList.remove('visible');
    }
  }
  
  private _resetState(skipPersist: boolean = false): void {
    this._markStart = null;
    this._markEnd = null;
    this._markPhase = 'start';
    this._pausedAt = 0;
    this._isPlaying = false;
    this._isolateVocals = false;
    this._silenceEnabled = false;
    
    // Persist reset state to clear any stale values (unless skipping during restore)
    if (!skipPersist) {
      this._persistToggleState();
    }
    
    // Reset vocals checkbox in trimmer section
    const trimmerCheckbox = this._trimmerSection?.querySelector('.slicer-isolate-checkbox') as HTMLInputElement;
    if (trimmerCheckbox) trimmerCheckbox.checked = false;
    
    if (this._markStartBtn) this._markStartBtn.disabled = true;
    if (this._markEndBtn) this._markEndBtn.disabled = true;
    if (this._commitBtn) this._commitBtn.disabled = true;
    if (this._selectionValueEl) this._selectionValueEl.textContent = 'Full track';
    if (this._isolateCheckbox) this._isolateCheckbox.checked = false;
    
    const markRow = this._container?.querySelector('.slicer-mark-row') as HTMLElement;
    if (markRow) markRow.style.display = 'block';
    
    if (this._hintEl) {
      this._hintEl.style.display = 'block';
      this._hintEl.textContent = 'Press play, then mark your section';
      this._hintEl.classList.remove('active');
    }
    
    this._resultPanel?.classList.remove('visible');
    this._selectionOverlay?.classList.remove('visible');
    this._playhead?.classList.remove('visible');
    
    if (this._currentTimeEl) this._currentTimeEl.textContent = '0:00';
  }
  
  /**
   * Load audio from an existing File object (e.g., from UploadPanel)
   */
  public loadAudioFile(file: File): void {
    this._loadFile(file);
  }
  
  /**
   * Load audio from an existing AudioBuffer
   */
  public loadAudioBuffer(buffer: AudioBuffer, fileName?: string): void {
    this._initAudioContext();
    this._audioBuffer = buffer;
    
    this._dropZone?.classList.add('hidden');
    this._songLoaded?.classList.add('visible');
    
    const fileNameEl = this._container?.querySelector('.slicer-file-name');
    if (fileNameEl) fileNameEl.textContent = fileName || 'Audio';
    
    if (this._totalTimeEl) {
      this._totalTimeEl.textContent = this._formatTime(buffer.duration);
    }
    
    this._resetState();
		this._invalidateGeneratedBuffers();
		this._updateCommitButton();
		this._drawWaveform();
		this._controller.updateAudioAccordionValue('custom');
		
		// Persist filename to composition state
		this._controller.updateAudioSourceState({
			source_file: file.name,
			start_time: 0,
			end_time: this._audioBuffer!.duration
		});
  }
  
  destroy(): void {
    // Stop playback
    this._stop();
    
    // Remove resize listener
    window.removeEventListener('resize', this._handleResize);
    
    // Close audio context
    if (this._audioContext) {
      this._audioContext.close();
      this._audioContext = null;
    }
    
    // Remove DOM
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}

```

