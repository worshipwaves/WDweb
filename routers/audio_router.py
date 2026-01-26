"""
Audio processing endpoints - stem separation and silence removal.
"""

import tempfile
import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse
import subprocess
import librosa
import soundfile as sf

from services.demucs_service import DemucsService
from services.audio_processing_service import AudioProcessingService


router = APIRouter(prefix="/api/audio", tags=["audio"])

# Initialize service
from services.config_loader import get_config_service
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
_config_service = get_config_service()
_audio_config = _config_service.get_audio_processing_config()
_intent_defaults = _config_service.get_intent_defaults()
_demucs = DemucsService(
    audio_config=_audio_config,
    output_dir=PROJECT_ROOT / "temp" / "demucs_output"
)


@router.post("/isolate-vocals")
async def isolate_vocals(
    file: UploadFile = File(...),
    remove_silence: bool = False
):
    """
    Isolate vocals from uploaded audio file.
    
    - Runs Demucs stem separation (GPU accelerated)
    - Optionally compresses silence gaps
    - Returns processed vocals as WAV
    
    PyQt parity: When called with remove_silence=False, returns raw Demucs output.
    PyQt handles silence removal locally with shop-specified parameters.
    """
    if not file.filename:
        raise HTTPException(400, "No filename provided")
    
    suffix = Path(file.filename).suffix or ".wav"
    temp_input = Path(tempfile.gettempdir()) / f"{uuid.uuid4()}{suffix}"
    
    try:
        content = await file.read()
        temp_input.write_bytes(content)
        
        # PyQt parity: Demucs only separates
        vocals_path, demucs_time = _demucs.separate_vocals(
            input_path=temp_input
        )
        
        # PyQt parity: Silence removal is decoupled, apply if requested
        if remove_silence:
            vocals_path = _demucs.compress_silence_only(
                input_path=vocals_path,
                threshold_db=_audio_config.demucs_silence_threshold,
                min_duration=_audio_config.demucs_silence_duration
            )
        
        return FileResponse(
            path=str(vocals_path),
            media_type="audio/wav",
            filename="vocals.wav",
            headers={"X-Demucs-Time": str(round(demucs_time, 2))}
        )
        
    except subprocess.CalledProcessError as e:
        raise HTTPException(500, f"Demucs processing failed: {e.stderr}")
    except FileNotFoundError as e:
        raise HTTPException(500, str(e))
    finally:
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
        
        # DIAGNOSTIC: Save input for parity comparison
        debug_path = Path(tempfile.gettempdir()) / "debug_silence_input.wav"
        debug_path.write_bytes(content)
        print(f"[DEBUG-SILENCE] Saved input to: {debug_path}")
        
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
        result = AudioProcessingService.analyze_and_optimize(
            samples, num_slots, mode, 
            intent_config=_intent_defaults.model_dump()
        )
        
        for log in result.get("logs", []):
            print(f"[OPTIMIZER] Exp {log['exp']}: Score={log['score']:.3f} (Spread={log['spread']:.2f}, Brick={log['brick']:.2f}, Ghost={log['ghost']:.2f})")
        print(f"[OPTIMIZER] Selected: Exp={result['exponent']}, Status={result['status']}")
        print(f"[OPTIMIZER] Params: binning={result['binning_mode']}, filter={result['filter_amount']}, silence={result['remove_silence']}, thresh={result['silence_threshold']}, dur={result['silence_duration']}")
        
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
        
        # Apply time slicing FIRST if parameters provided
        working_path = temp_input
        if start_time is not None and end_time is not None:
            duration = end_time - start_time
            if duration > 0:
                y, sr = librosa.load(str(temp_input), sr=None, mono=True,
                                     offset=start_time, duration=duration)
                slice_path = Path(tempfile.gettempdir()) / f"{uuid.uuid4()}_slice.wav"
                sf.write(str(slice_path), y, sr)
                working_path = slice_path
        
        print(f"[DEBUG] isolate_vocals={isolate_vocals}, remove_silence={remove_silence}")
        
        # Process based on options
        demucs_time = 0.0
        if isolate_vocals:
            # PyQt parity: Demucs only separates
            vocals_path, demucs_time = _demucs.separate_vocals(
                input_path=working_path
            )
            
            # PyQt parity: Silence removal is decoupled, apply if requested
            if remove_silence:
                output_path = _demucs.compress_silence_only(
                    input_path=vocals_path,
                    threshold_db=_audio_config.demucs_silence_threshold,
                    min_duration=_audio_config.demucs_silence_duration
                )
            else:
                output_path = vocals_path
        elif remove_silence:
            output_path = _demucs.compress_silence_only(
                input_path=working_path,
                threshold_db=silence_threshold,
                min_duration=silence_min_duration
            )
        else:
            output_path = working_path
        
        headers = {"X-Demucs-Time": str(round(demucs_time, 2))} if demucs_time > 0 else {}
        
        return FileResponse(
            path=str(output_path),
            media_type="audio/wav",
            filename="processed.wav",
            headers=headers
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