# routers/export_router.py
"""
Export endpoint for commission package (.wdp + .wav) download.
Produces PyQt-compatible Reconstruction Kit for production handoff.

Package Contents:
- project_design.wdp: JSON state file with PyQt parameter format
- master_vocals.wav: Demucs + silence-removed vocal stem (44100 Hz, 16-bit PCM)
- original_source.wav: Full original audio file (44100 Hz, 16-bit PCM)
"""

import io
import json
import tempfile
import zipfile
from pathlib import Path
from datetime import datetime
from typing import Dict, Any

import numpy as np
import librosa
import soundfile as sf

from fastapi import APIRouter, HTTPException, Form, UploadFile, File
from fastapi.responses import StreamingResponse

from services.dtos import CompositionStateDTO


router = APIRouter(prefix="/api/export", tags=["export"])


def _convert_to_wav(audio_bytes: bytes, original_filename: str) -> bytes:
    """Convert audio to 44100 Hz 16-bit PCM WAV."""
    with tempfile.NamedTemporaryFile(suffix=Path(original_filename).suffix, delete=False) as tmp_in:
        tmp_in.write(audio_bytes)
        tmp_in_path = tmp_in.name
    
    try:
        y, _ = librosa.load(tmp_in_path, sr=44100, mono=True)
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_out:
            sf.write(tmp_out.name, y, 44100, subtype='PCM_16')
            with open(tmp_out.name, 'rb') as f:
                return f.read()
    finally:
        Path(tmp_in_path).unlink(missing_ok=True)


def _build_pyqt_parameters(state: CompositionStateDTO) -> Dict[str, Any]:
    """
    Build the parameters dict matching PyQt's ParameterManager schema EXACTLY.
    
    STRICT: Only keys defined in PyQt schema are included.
    Extra keys cause ParameterException in PyQt.
    
    Flattening Rules Applied:
    - RollAmount: 0 (roll baked into processed_amplitudes)
    - UseStems: False (master_vocals.wav is pre-separated)
    """
    fd = state.frame_design
    ps = state.pattern_settings
    ap = state.audio_processing
    
    return {
        # Design Category
        "Design.Shape": fd.shape,
        "Design.FrameOrientation": fd.frame_orientation,
        "Design.FinishX": fd.finish_x,
        "Design.FinishY": fd.finish_y,
        "Design.NumberSections": fd.number_sections,
        "Design.Separation": fd.separation,
        "Design.FinishZ": fd.finish_z,
        
        # Pattern Category
        "Pattern.SlotStyle": ps.slot_style,
        "Pattern.NumberSlots": ps.number_slots,
        "Pattern.BitDiameter": ps.bit_diameter,
        "Pattern.Spacer": ps.spacer,
        "Pattern.X_Offset": ps.x_offset,
        "Pattern.Y_Offset": ps.y_offset,
        "Pattern.ScaleCenterPoint": ps.scale_center_point,
        "Pattern.AmplitudeExponent": ps.amplitude_exponent,
        "Pattern.GrainAngle": ps.grain_angle,
        "Pattern.VisualFloor": ps.visual_floor_pct,
        "Pattern.GenerateDovetails": False,
        "Pattern.DovetailInset": 0.0625,
        "Pattern.LeadOverlap": 0.25,
        "Pattern.LeadRadius": 0.25,
        
        # Audio Category
        "Audio.Processing.ApplyFilter": ap.apply_filter if ap else True,
        "Audio.Processing.FilterAmount": ap.filter_amount if ap else 0.01,
        "Audio.Processing.BinningMode": ap.binning_mode if ap else "mean_abs",
        "Audio.Processing.RollAmount": 0,
        "Audio.Processing.UseStems": False,
    }


def _build_commission_details(state: CompositionStateDTO) -> Dict[str, Any]:
    """
    Build the commission_details block for shop floor metadata.
    
    Contains all parameters that drive the physical order but do NOT
    affect PyQt geometry calculation. PyQt ignores this block.
    """
    fd = state.frame_design
    
    return {
        "section_materials": [
            {
                "section_id": m.section_id,
                "species": m.species,
                "grain": m.grain_direction
            }
            for m in (fd.section_materials or [])
        ],
        "backing": {
            "enabled": fd.backing.enabled if fd.backing else False,
            "type": fd.backing.type if fd.backing else "none",
            "material": fd.backing.material if fd.backing else "none"
        },
        "default_species": fd.species,
        "client_notes": "",
        "web_session_id": ""
    }


def _build_wdp_content(
    state: CompositionStateDTO,
    client_name: str
) -> Dict[str, Any]:
    """
    Build the complete .wdp JSON structure for PyQt compatibility.
    Matches PyQt's ProjectManager save format exactly.
    """
    # Bake roll into processed_amplitudes for circular n=3 designs
    # This ensures WYSIWYG parity and prevents double-roll bugs
    amplitudes = state.processed_amplitudes or []
    if (state.frame_design.shape == "circular" and 
        state.frame_design.number_sections == 3 and 
        amplitudes):
        num_slots = state.pattern_settings.number_slots
        auto_roll = (num_slots // 3) // 2
        if auto_roll != 0:
            amplitudes = np.roll(np.array(amplitudes), auto_roll).tolist()
    
    return {
        "version": "1.0",
        "client_name": client_name,
        "save_date": datetime.utcnow().isoformat(),
        "audio_file_path": "master_vocals.wav",
        "original_audio_file": "original_source.wav",
        "parameters": _build_pyqt_parameters(state),
        "commission_details": _build_commission_details(state),
        "processed_amplitudes": amplitudes,
        "slot_nudges": {},
        "manual_amplitude_adjustments": {},
        "reference_states": [],
        "ui_states": {
            "current_reference_index": -1
        },
        "export_folder": "",
        "stem_paths": {}
    }


@router.post("/commission-package")
async def export_commission_package(
    state_json: str = Form(...),
    client_name: str = Form("Customer"),
    project_name: str = Form("Commission"),
    audio_file: UploadFile = File(...),
    original_file: UploadFile = File(...)
):
    """
    Export Reconstruction Kit as ZIP containing .wdp and both .wav files.
    
    Contents:
    - {name}.wdp: Project state file
    - master_vocals.wav: Processed vocal stem (44100 Hz, 16-bit PCM)
    - original_source.wav: Original audio converted to WAV (44100 Hz, 16-bit PCM)
    """
    try:
        state_dict = json.loads(state_json)
        state = CompositionStateDTO.model_validate(state_dict)
    except json.JSONDecodeError as e:
        raise HTTPException(400, f"Invalid JSON in state_json: {e}")
    except Exception as e:
        raise HTTPException(400, f"Invalid state data: {e}")
    
    if not audio_file.filename:
        raise HTTPException(400, "Processed audio file required")
    if not original_file.filename:
        raise HTTPException(400, "Original audio file required")
    
    # Sanitize names for filesystem
    safe_client = "".join(c for c in client_name if c.isalnum() or c in "._- ")
    safe_project = "".join(c for c in project_name if c.isalnum() or c in "._- ")
    base_name = f"{safe_client}_{safe_project}".replace(" ", "_")
    
    wdp_filename = f"{base_name}.wdp"
    zip_filename = f"{base_name}.zip"
    
    # Build .wdp content
    wdp_content = _build_wdp_content(state, client_name)
    wdp_json = json.dumps(wdp_content, indent=2)
    
    # Read and convert audio files to 44100 Hz 16-bit PCM WAV
    vocals_content = await audio_file.read()
    original_content = await original_file.read()
    original_wav = _convert_to_wav(original_content, original_file.filename or "original.wav")
    
    # Create ZIP in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(wdp_filename, wdp_json)
        zf.writestr("master_vocals.wav", vocals_content)
        zf.writestr("original_source.wav", original_wav)
    
    zip_buffer.seek(0)
    
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{zip_filename}"'
        }
    )


@router.post("/wdp-only")
async def export_wdp_only(
    state_json: str = Form(...),
    client_name: str = Form("Customer"),
    project_name: str = Form("Commission")
):
    """
    Export only the .wdp file (no audio).
    Uses standardized filenames for audio references.
    """
    try:
        state_dict = json.loads(state_json)
        state = CompositionStateDTO.model_validate(state_dict)
    except json.JSONDecodeError as e:
        raise HTTPException(400, f"Invalid JSON in state_json: {e}")
    except Exception as e:
        raise HTTPException(400, f"Invalid state data: {e}")
    
    safe_client = "".join(c for c in client_name if c.isalnum() or c in "._- ")
    safe_project = "".join(c for c in project_name if c.isalnum() or c in "._- ")
    base_name = f"{safe_client}_{safe_project}".replace(" ", "_")
    wdp_filename = f"{base_name}.wdp"
    
    wdp_content = _build_wdp_content(state, client_name)
    wdp_json = json.dumps(wdp_content, indent=2)
    
    return StreamingResponse(
        io.BytesIO(wdp_json.encode("utf-8")),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{wdp_filename}"'
        }
    )
