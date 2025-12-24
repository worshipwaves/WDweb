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