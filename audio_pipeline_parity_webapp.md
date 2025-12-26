# Project Files Overview

**Generated on:** 2025-12-25 19:40:31
**Source:** Specified files (8)
**Total files:** 8

## Files Included

- `C:\Users\paulj\WDweb\config\composition_defaults.json`
- `C:\Users\paulj\WDweb\routers\audio_router.py`
- `C:\Users\paulj\WDweb\services\audio_processing_service.py`
- `C:\Users\paulj\WDweb\services\demucs_service.py`
- `C:\Users\paulj\WDweb\services\geometry_service.py`
- `C:\Users\paulj\WDweb\services\service_facade.py`
- `C:\Users\paulj\WDweb\src\AudioCacheService.ts`
- `C:\Users\paulj\WDweb\src\components\AudioSlicerPanel.ts`

---

## File: `C:\Users\paulj\WDweb\config\composition_defaults.json`

```json
{
  "frame_design": {
    "shape": "circular",
    "frame_orientation": "vertical",
    "finish_x": 36.0,
    "finish_y": 36.0,
    "finish_z": 0.375,
    "number_sections": 2,
    "separation": 2.0,
    "species": "maple",
    "material_thickness": 0.375,
    "section_materials": [
      {"section_id": 0, "species": "walnut-black-american", "grain_direction": "vertical"},
      {"section_id": 1, "species": "walnut-black-american", "grain_direction": "vertical"},
      {"section_id": 2, "species": "walnut-black-american", "grain_direction": "vertical"},
      {"section_id": 3, "species": "walnut-black-american", "grain_direction": "vertical"}
    ],
    "backing": {
      "enabled": false,
      "type": "acrylic",
      "material": "clear",
      "inset": 0.5
    }
  },
  "pattern_settings": {
    "slot_style": "radial",
    "pattern_diameter": 36.0,
    "number_slots": 48,
    "bit_diameter": 0.25,
    "spacer": 0.5,
    "x_offset": 0.75,
    "y_offset": 1.5,
    "side_margin": 0,
    "scale_center_point": 1.0,
    "amplitude_exponent": 1.0,
    "orientation": "auto",
    "grain_angle": 90.0,
    "lead_overlap": 0.25,
    "lead_radius": 0.25,
    "dovetail_settings": {
      "generate_dovetails": false,
      "show_dovetails": false,
      "dovetail_inset": 0.0625,
      "dovetail_cut_direction": "climb",
      "dovetail_edge_default": 0,
      "dovetail_edge_overrides": "{}"
    }
  },
  "audio_source": {
    "source_file": null,
    "start_time": 0.0,
    "end_time": 0.0,
    "use_stems": false,
    "stem_choice": "vocals"
  },
  "audio_processing": {
		"target_sample_rate": 44100,
    "num_raw_samples": 200000,
    "filter_amount": 0.05,
    "apply_filter": false,
    "binning_method": "mean",
    "binning_mode": "mean_abs",
    "remove_silence": false,
    "silence_threshold": -20,
    "silence_duration": 0.5,
    "silence_frame_length": 2048,
    "silence_hop_length": 512
  },
  "peak_control": {
    "method": "none",
    "threshold": 0.8,
    "roll_amount": 0,
    "nudge_enabled": false,
    "clip_enabled": false,
    "compress_enabled": false,
    "scale_enabled": false,
    "scale_all_enabled": false,
    "manual_enabled": false,
    "clip_percentage": 0.8,
    "compression_exponent": 0.75,
    "threshold_percentage": 0.9,
    "scale_all_percentage": 1.0,
    "manual_slot": 0,
    "manual_value": 1.0
  },
  "visual_correction": {
    "apply_correction": true,
    "correction_scale": 1.0,
    "correction_mode": "nudge_adj"
  },
  "display_settings": {
    "show_debug_circle": false,
    "debug_circle_radius": 1.5,
    "show_labels": false,
    "show_offsets": false
  },
  "export_settings": {
    "cnc_margin": 1.0,
    "sections_in_sheet": 1
  },
  "artistic_rendering": {
    "artistic_style": "watercolor",
    "color_palette": "ocean",
    "opacity": 1.0,
    "artistic_intensity": 0.8,
    "amplitude_effects": "color",
    "amplitude_influence": 1.0,
    "watercolor_settings": {
      "wetness": 0.7,
      "pigment_load": 0.8,
      "paper_roughness": 0.5,
      "bleed_amount": 0.6,
      "granulation": 0.4
    },
    "oil_settings": {
      "brush_size": 0.5,
      "impasto": 0.4,
      "brush_texture": 0.5,
      "color_mixing": 0.6
    },
    "ink_settings": {
      "ink_flow": 0.4,
      "ink_density": 0.8,
      "edge_darkening": 0.6,
      "dryness": 0.3
    },
    "physical_simulation": {
      "brush_pressure": 0.7,
      "paint_thickness": 0.5,
      "drying_time": 0.5,
      "medium_viscosity": 0.5
    },
    "noise_settings": {
      "noise_scale": 20.0,
      "noise_octaves": 4.0,
      "noise_seed": 0.0,
      "flow_speed": 0.3,
      "flow_direction": 0.0
    },
    "color_palettes": {
      "ocean": {
        "color_deep": [0.0, 0.2, 0.4, 0.9],
        "color_mid": [0.0, 0.4, 0.6, 0.7],
        "color_light": [0.2, 0.6, 0.8, 0.5],
        "paper_color": [0.98, 0.97, 0.95, 1.0]
      },
      "sunset": {
        "color_deep": [0.4, 0.1, 0.0, 0.9],
        "color_mid": [0.7, 0.3, 0.1, 0.7],
        "color_light": [1.0, 0.6, 0.2, 0.5],
        "paper_color": [0.98, 0.95, 0.93, 1.0]
      },
      "forest": {
        "color_deep": [0.0, 0.2, 0.1, 0.9],
        "color_mid": [0.1, 0.4, 0.2, 0.7],
        "color_light": [0.3, 0.6, 0.4, 0.5],
        "paper_color": [0.97, 0.98, 0.95, 1.0]
      },
      "monochrome": {
        "color_deep": [0.1, 0.1, 0.1, 0.9],
        "color_mid": [0.4, 0.4, 0.4, 0.7],
        "color_light": [0.7, 0.7, 0.7, 0.5],
        "paper_color": [0.98, 0.98, 0.98, 1.0]
      }
    }
  },
	"processed_amplitudes": []
}

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
        mode: str,
        intent_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Runs a grid search to find the best amplitude exponent."""
        
        # Load from config (required)
        params = intent_config[mode]
        binning_mode = BinningMode(params["binning_mode"])
        filter_candidates = params["filter_candidates"]
        fallback_filter = params["fallback_filter"]
        fallback_exp = params["fallback_exponent"]
        exponent_candidates = params["exponent_candidates"]

        # Resample
        resampled_samples = AudioProcessingService.extract_amplitudes(samples, 200000)
        
        # Bin
        _, max_b = AudioProcessingService.bin_amplitudes(resampled_samples, num_slots, binning_mode)
        baseline = max_b

        # Dynamic silence threshold (speech only)
        rec_threshold = -40
        if mode == "speech":
            abs_samples = np.abs(resampled_samples)
            non_zeros = abs_samples[abs_samples > 1e-5]
            if len(non_zeros) > 0:
                noise_floor_db = 20 * np.log10(np.percentile(non_zeros, 15))
                rec_threshold = int(max(-60, min(-10, noise_floor_db + 4)))

        # 2D grid search: filter × exponent
        best_score = -float('inf')
        best_exp = fallback_exp
        best_filter = fallback_filter
        logs = []
        
        for filter_amt in filter_candidates:
            filtered = AudioProcessingService.filter_data(baseline, filter_amt)
            for exp in exponent_candidates:
                compressed = np.power(filtered, exp)
                max_val = np.max(compressed)
                if max_val > 1e-9:
                    compressed = compressed / max_val
                p10 = np.percentile(compressed, 10)
                p90 = np.percentile(compressed, 90)
                spread = p90 - p10
                brick_pct = np.sum(compressed > 0.95) / len(compressed)
                ghost_pct = np.sum(compressed < 0.15) / len(compressed)
                score = spread - (brick_pct * 2.0) - (ghost_pct * 1.5)
                logs.append({
                    "filter": filter_amt,
                    "exp": exp,
                    "spread": round(spread, 4),
                    "brick": round(brick_pct, 4),
                    "ghost": round(ghost_pct, 4),
                    "score": round(score, 4)
                })
                if score > best_score:
                    best_score = score
                    best_exp = exp
                    best_filter = filter_amt

        # Fallback check
        status = "success"
        if best_score < -0.1:
            best_exp = fallback_exp
            status = "fallback"

        return {
            "exponent": best_exp,
            "filter_amount": best_filter,
            "silence_threshold": rec_threshold,
            "binning_mode": binning_mode.value,
            "remove_silence": params["remove_silence"],
            "silence_duration": params["silence_duration"],
            "score": round(best_score, 4),
            "status": status,
            "logs": logs
        }

```

## File: `C:\Users\paulj\WDweb\services\demucs_service.py`

```python
"""
DemucsService - Local GPU stem separation with silence compression.
Handles vocal isolation using Demucs and removes silent gaps from output.
Aligned with Desktop App logic (librosa/numpy) for mathematical parity.
"""

import subprocess
import shutil
from pathlib import Path
from typing import Optional, TYPE_CHECKING
import numpy as np
import librosa
import soundfile as sf

if TYPE_CHECKING:
    from services.dtos import AudioProcessingDTO


class DemucsService:
    """Local GPU-based Demucs processing with desktop-parity silence removal."""
    
    def __init__(
        self, 
        audio_config: 'AudioProcessingDTO',
        output_dir: Path
    ):
        self._output_dir = output_dir
        self._output_dir.mkdir(parents=True, exist_ok=True)
        
        # Load configuration (Mandatory DTO injection)
        tsr = audio_config.target_sample_rate
        self._target_sample_rate = int(tsr) if tsr is not None else None
        self._default_threshold = float(audio_config.silence_threshold)
        self._default_duration = float(audio_config.silence_duration)
        self._frame_length = int(audio_config.silence_frame_length)
        self._hop_length = int(audio_config.silence_hop_length)
    
    def separate_vocals(
        self,
        input_path: Path,
        remove_silence: bool
    ) -> Path:
        """
        Separate vocals from audio file using Demucs.
        
        Args:
            input_path: Path to input audio file
            remove_silence: Whether to compress silence in output
            
        Returns:
            Path to processed vocals WAV file
        """
        subprocess.run(
            [
                "demucs",
                "--two-stems=vocals",
                "-d", "cuda",
                "-o", str(self._output_dir),
                str(input_path)
            ],
            capture_output=True,
            text=True,
            check=True
        )
        
        stem_name = input_path.stem
        vocals_path = self._output_dir / "htdemucs" / stem_name / "vocals.wav"
        
        if not vocals_path.exists():
            vocals_path_ft = self._output_dir / "htdemucs_ft" / stem_name / "vocals.wav"
            if vocals_path_ft.exists():
                vocals_path = vocals_path_ft
            else:
                raise FileNotFoundError(f"Demucs output not found: {vocals_path}")
        
        if remove_silence:
            return self._compress_silence(vocals_path)
        
        return vocals_path
    
    def _compress_silence(self, vocals_path: Path) -> Path:
        """
        Remove silent gaps from vocals using config defaults.
        """
        # Use configured sample rate for Desktop parity
        y, sr = librosa.load(str(vocals_path), sr=self._target_sample_rate, mono=True)
        
        processed_y = self._apply_silence_removal_logic(
            y, sr,
            threshold_db=self._default_threshold,
            min_duration=self._default_duration
        )
        
        if len(processed_y) == len(y):
            return vocals_path

        compressed_path = vocals_path.parent / "vocals_compressed.wav"
        sf.write(str(compressed_path), processed_y, sr)
        
        return compressed_path
        
    def compress_silence_only(
        self,
        input_path: Path,
        min_duration: Optional[float],
        threshold_db: Optional[float]
    ) -> Path:
        """
        Apply silence compression to any audio file.
        Standalone endpoint for iterative testing.
        """
        # Use configured sample rate for Desktop parity
        y, sr = librosa.load(str(input_path), sr=self._target_sample_rate, mono=True)
        
        original_duration = len(y) / sr
        
        processed_y = self._apply_silence_removal_logic(
            y, sr,
            threshold_db=threshold_db,
            min_duration=min_duration
        )
        
        compressed_duration = len(processed_y) / sr
        print(f"[DemucsService] Silence compression: {original_duration:.2f}s -> {compressed_duration:.2f}s")
        
        output_path = input_path.parent / f"{input_path.stem}_compressed.wav"
        sf.write(str(output_path), processed_y, sr)
        
        return output_path    
    
    def _apply_silence_removal_logic(
        self,
        y: np.ndarray,
        sr: int,
        threshold_db: float,
        min_duration: float
    ) -> np.ndarray:
        """
        Core silence removal logic ported exactly from Desktop AudioLoaderAdapter.
        
        Logic:
        1. Split based on threshold
        2. Merge close intervals based on min_duration
        3. Concatenate without gaps
        """
        intervals = librosa.effects.split(
            y,
            top_db=-threshold_db,
            frame_length=self._frame_length,
            hop_length=self._hop_length
        )
        
        if len(intervals) == 0:
            return y
            
        min_samples = int(min_duration * sr)
        merged_intervals = []
        
        for start, end in intervals:
            if end - start < min_samples:
                continue
                
            if merged_intervals and start - merged_intervals[-1][1] < min_samples:
                # Create new list with updated last element (Immutability: No assignment)
                last_start = merged_intervals[-1][0]
                merged_intervals = merged_intervals[:-1] + [(last_start, end)]
            else:
                # Create new list with appended element (Immutability: No .append)
                merged_intervals = merged_intervals + [(start, end)]
                
        if not merged_intervals:
            return y
            
        # List comprehension (Immutability: No .append)
        non_silent_parts = [y[start:end] for start, end in merged_intervals]
            
        return np.concatenate(non_silent_parts) if non_silent_parts else y

    def cleanup(self, stem_name: str) -> None:
        """Remove temporary files for a processed track."""
        track_dir = self._output_dir / "htdemucs" / stem_name
        if track_dir.exists():
            shutil.rmtree(track_dir)
        
        track_dir_ft = self._output_dir / "htdemucs_ft" / stem_name
        if track_dir_ft.exists():
            shutil.rmtree(track_dir_ft)
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

import type { ApplicationController } from '../ApplicationController';
import type { PanelComponent } from '../types/PanelTypes';

interface SliceResult {
  blob: Blob;
  startTime: number;
  endTime: number;
  duration: number;
}

interface StoredAudioRecord {
  id: string;
  file: File;
  fileName: string;
  savedAt: number;
}

interface OptimizationResult {
  exponent: number;
  filter_amount: number;
  silence_threshold: number;
  binning_mode: string;
  remove_silence: boolean;
  silence_duration: number;
  status: 'optimized' | 'fallback' | 'error';
}

export class AudioSlicerPanel implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _controller: ApplicationController;
  
  // DOM references
  private _dropZone: HTMLElement | null = null;
	private _dropContent: HTMLElement | null = null;
  private _fileInput: HTMLInputElement | null = null;
  private _canvas: HTMLCanvasElement | null = null;
  private _ctx: CanvasRenderingContext2D | null = null;
  private _playhead: HTMLElement | null = null;
  private _selectionOverlay: HTMLElement | null = null;
  private _startTimeInput: HTMLInputElement | null = null;
  private _endTimeInput: HTMLInputElement | null = null;
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
  
  // Isolate Vocals param
  private _isolateVocals: boolean = false;
	
	// Pending intent for deferred UI update
  private _pendingIntent: 'music' | 'speech' | null = null;

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
          const record = request.result as StoredAudioRecord | undefined;
          if (record?.file) {
            resolve(record.file);
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
    this._dropContent?.classList.remove('hidden');
    this._songLoaded?.classList.remove('visible');
  }
  
  constructor(
    controller: ApplicationController,
    onSliceComplete?: (result: SliceResult) => void
  ) {
    this._controller = controller;
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
  }
  
  /**
   * Restore Upload Section UI based on persisted state
   */
  private _restoreUploadState(): void {
    const fileName = this._originalFile?.name || this._persistedFileName;
    const isLoaded = !!this._audioBuffer || !!this._persistedFileName;

    if (isLoaded && fileName) {
      this._dropContent?.classList.add('hidden');
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
          <div class="slicer-section-desc">Listen, then either drag the handles or tap to mark your selection</div>
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
        <input type="text" class="slicer-time slicer-time-start" value="0:00" placeholder="0:00">
        <span class="slicer-time-separator">/</span>
        <input type="text" class="slicer-time slicer-time-end" value="0:00" placeholder="0:00">
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
	
	private _applyPendingIntent(): void {
    if (!this._pendingIntent || !this._uploadSection) return;
    const radio = this._uploadSection.querySelector(`input[name="upload-intent"][value="${this._pendingIntent}"]`) as HTMLInputElement;
    if (radio) {
      radio.checked = true;
      this._pendingIntent = null;
    }
  }
	
	renderUploadSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'audio-slicer-upload-section';
    this._uploadSection = section;
    section.innerHTML = `
      <div class="slicer-card">
        <div class="slicer-section-header">
          <span class="slicer-section-number">1</span>
          <div class="slicer-section-text">
            <div class="slicer-section-title">What type of audio?</div>
            <div class="slicer-section-desc">Select one before uploading</div>
          </div>
        </div>
        <div class="slicer-intent-controls">
          <label class="slicer-radio"><input type="radio" name="upload-intent" value="music" checked> Music</label>
          <label class="slicer-radio"><input type="radio" name="upload-intent" value="speech"> Speech</label>
        </div>
      </div>
      
      <div class="slicer-card slicer-drop-zone" data-demo-id="slicer_drop">
        <div class="slicer-section-header">
          <span class="slicer-section-number">2</span>
          <div class="slicer-section-text">
            <div class="slicer-section-title">Upload your file</div>
            <div class="slicer-section-desc">Drop or browse to select</div>
          </div>
        </div>
        <div class="slicer-drop-content">
          <div class="upload-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <p class="slicer-drop-text">Drop file here</p>
          <p class="slicer-drop-hint">or tap to browse</p>
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
        <input type="file" class="slicer-file-input" accept="audio/*">
      </div>
    `;
    this._cacheUploadElements(section);
    this._attachUploadListeners(section);
    this._restoreUploadState();
    
    // Attempt to restore audio from IndexedDB if not already loaded
    if (!this._audioBuffer) {
      void this._attemptAudioRestore();
    }
		
		// Apply any pending intent from collection load
    this._applyPendingIntent();
    
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
      const file = e.dataTransfer?.files[0];
      if (file) void this._loadFile(file);
    });
    this._fileInput?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void this._loadFile(file);
    });
    section.querySelector('.slicer-song-change')?.addEventListener('click', () => {
      this._resetToUpload();
    });
    
    // Reprocess when intent changes if audio already loaded
    section.querySelectorAll('input[name="upload-intent"]').forEach(radio => {
      radio.addEventListener('change', () => {
        if (this._originalFile && this._audioBuffer) {
          void this._runOptimization().then(() => this._handleCommit());
        }
      });
    });
  }

  private _attachTrimmerListeners(section: HTMLElement): void {
    this._attachHandleDrag(section);
    section.querySelector('.slicer-play-btn')?.addEventListener('click', () => this._togglePlayback());
    section.querySelector('.slicer-btn-rewind')?.addEventListener('click', () => this._seek(-5));
    section.querySelector('.slicer-btn-forward')?.addEventListener('click', () => this._seek(5));
		
		// Transport time input editing
    const transportStartInput = section.querySelector('.slicer-time-start') as HTMLInputElement;
    const transportEndInput = section.querySelector('.slicer-time-end') as HTMLInputElement;
    
    transportStartInput?.addEventListener('blur', () => this._handleTransportTimeInput('start', transportStartInput));
    transportStartInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); transportStartInput.blur(); }
    });
    
    transportEndInput?.addEventListener('blur', () => this._handleTransportTimeInput('end', transportEndInput));
    transportEndInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); transportEndInput.blur(); }
    });
		
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
    section.querySelector('.slicer-btn-apply')?.addEventListener('click', () => {
      void this._runOptimization().then(() => this._handleCommit());
    });
    
    window.addEventListener('resize', this._handleResize);
  }
	
	/**
   * Get enhancements summary for accordion header display
   */
  public getEnhancementsDisplay(): string | null {
    const vocals = this._isolateVocals;
    const silence = this._controller.getState()?.composition.audio_processing?.remove_silence;
    
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
		
    this._commitBtn?.addEventListener('click', () => this._handleCommit());
  }
  
  private async _runOptimization(intentOverride?: 'music' | 'speech'): Promise<void> {
    if (!this._originalFile) {
      void this._controller.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'idle', progress: 100 }
      });
      return;
    }
    
    const statusEl = this._trimmerSection?.querySelector('.slicer-optimize-status') as HTMLElement;
    const btn = this._trimmerSection?.querySelector('.slicer-btn-optimize') as HTMLButtonElement;
    
    if (statusEl) statusEl.textContent = 'Analyzing...';
    if (btn) btn.disabled = true;
    
    const formData = new FormData();
    
    // Use sliced audio if slice markers are set, otherwise use original
    const hasSlice = this._markStart !== null && this._markEnd !== null && 
                     (this._markStart > 0 || this._markEnd < (this._audioBuffer?.duration ?? 0));
    if (hasSlice && this._audioBuffer) {
      const sliceBlob = this._createSliceBlob();
      if (sliceBlob) {
        formData.append('file', new File([sliceBlob], 'slice.wav', { type: 'audio/wav' }));
      } else {
        formData.append('file', this._originalFile);
      }
    } else {
      formData.append('file', this._originalFile);
    }
    
    const intentRadio = this._uploadSection?.querySelector('input[name="upload-intent"]:checked') as HTMLInputElement;
    const intent = intentOverride || intentRadio?.value || 'music';
    formData.append('mode', intent);
    formData.append('num_slots', String(this._controller.getState()?.composition.pattern_settings.number_slots || 48));
    
    try {
      const response = await fetch('/api/audio/optimize', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error(`${response.status}`);
      
      const result = await response.json() as OptimizationResult;
      
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
    this._startTimeInput = section.querySelector('.slicer-time-start');
    this._endTimeInput = section.querySelector('.slicer-time-end');
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
  }
	
	private _restoreTrimmerState(): void {
    // Restore total time
    if (this._audioBuffer) {
      this._updateTransportTimes();
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
      this._dropContent?.classList.add('hidden');
      this._songLoaded?.classList.add('visible');
      if (this._songNameEl) this._songNameEl.textContent = this._originalFile.name;
      if (this._songDurationEl) this._songDurationEl.textContent = `${this._formatTime(this._audioBuffer.duration)} · Ready`;
    }
  }
	
	private _cacheUploadElements(section: HTMLElement): void {
    this._dropZone = section.querySelector('.slicer-drop-zone');
    this._dropContent = section.querySelector('.slicer-drop-content');
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
      this._updateTransportTimes();
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
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this._audioContext = new AudioCtx();
    }
  }
  
  private async _loadFile(file: File, skipAutoCommit: boolean = false, intent?: 'music' | 'speech'): Promise<void> {
    this._initAudioContext();
    
    // Show processing overlay immediately
    if (!skipAutoCommit) {
      void this._controller.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'uploading', progress: 0, message: `Processing ${file.name}` }
      });
    }
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      this._audioBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);
			this._originalFile = file;
      
      // Update UI
      this._dropContent?.classList.add('hidden');
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
      
      this._updateTransportTimes();
      
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
          end_time: this._audioBuffer.duration
        });
        
        // Save to IndexedDB for persistence across refresh
        void this._saveAudioToStorage(file);
				
				// Update intent radio button if provided (or store for later if section not rendered)
        if (intent) {
          this._pendingIntent = intent;
          this._applyPendingIntent();
        }
        
        // Auto-optimize with intent, then commit
        await this._runOptimization(intent);
        this._handleCommit();
      }
      
    } catch (err) {
      console.error('[AudioSlicerPanel] Decode error:', err);
      void this._controller.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'idle', progress: 0 }
      });
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
	
	private _parseTime(timeStr: string): number | null {
    const match = timeStr.trim().match(/^(\d+):(\d{2})$/);
    if (!match) return null;
    const mins = parseInt(match[1], 10);
    const secs = parseInt(match[2], 10);
    if (secs >= 60) return null;
    return mins * 60 + secs;
  }

  private _handleTransportTimeInput(which: 'start' | 'end', input: HTMLInputElement): void {
    const seconds = this._parseTime(input.value);
    if (seconds === null || !this._audioBuffer) {
      this._updateTransportTimes();
      return;
    }
    const clamped = Math.max(0, Math.min(seconds, this._audioBuffer.duration));
    if (which === 'start') {
      this._markStart = clamped;
      if (this._markEnd !== null && clamped > this._markEnd) {
        this._markEnd = clamped;
      }
    } else {
      this._markEnd = clamped;
      if (this._markStart !== null && clamped < this._markStart) {
        this._markStart = clamped;
      }
    }
    this._updateSelection();
    this._updateTransportTimes();
    this._updateMarkButtonsV2();
    this._updateCommitButton();
    this._persistTrimState();
  }

  private _updateTransportTimes(): void {
    if (!this._trimmerSection || !this._audioBuffer) return;
    const startInput = this._trimmerSection.querySelector('.slicer-time-start') as HTMLInputElement;
    const endInput = this._trimmerSection.querySelector('.slicer-time-end') as HTMLInputElement;
    
    const startTime = this._markStart ?? 0;
    const endTime = this._markEnd ?? this._audioBuffer.duration;
    
    if (startInput && document.activeElement !== startInput) {
      startInput.value = this._formatTime(startTime);
    }
    if (endInput && document.activeElement !== endInput) {
      endInput.value = this._formatTime(endTime);
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
    
    // Playback position tracked internally, transport shows selection bounds
  }
  
  private _seek(delta: number): void {
    if (!this._audioBuffer) return;
    
    const wasPlaying = this._isPlaying;
    if (wasPlaying) this._stop();
    
    this._pausedAt = Math.max(0, Math.min(this._pausedAt + delta, this._audioBuffer.duration));
    // Playback position tracked internally, transport shows selection bounds
    this._updatePlayheadPosition();
    
    if (wasPlaying) this._play();
  }
  
  private _updatePlayhead(): void {
    const t = this._getCurrentTime();
    this._updatePlayheadPosition();
    // Playback position tracked internally, transport shows selection bounds
    
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
      const visualTime = selectionStart + (t / this._rawVocalsBuffer.duration) * selectionDuration;
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
    this._updateTransportTimes();
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
    this._updateTransportTimes();
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
    const btn = previewBtn;
    if (btn) btn.textContent = '❚❚ Pause';
    
    this._sourceNode.onended = () => {
      this._isPreviewing = false;
      if (btn) btn.textContent = '▶ Preview';
    };
  }
  private async _previewWithProcessing(previewBtn: HTMLButtonElement | null): Promise<void> {
    if (!this._audioBuffer || !this._originalFile) return;
    
    this._isProcessing = true;
    const btn = previewBtn;
    if (btn) btn.textContent = '⏳ Processing...';
    
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
      if (btn) btn.textContent = '❚❚ Pause';
      
    } catch (error) {
      console.error('[AudioSlicerPanel] Preview processing failed:', error);
      this._isProcessing = false;
      if (btn) btn.textContent = '▶ Preview';
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
      const audioProcessing = this._controller.getState()?.composition.audio_processing;
      
      const formData = new FormData();
      formData.append('file', new File([rawBlob], 'vocals.wav', { type: 'audio/wav' }));
      formData.append('min_duration', String(audioProcessing?.silence_duration));
      formData.append('threshold_db', String(audioProcessing?.silence_threshold));
      
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
    const labelEl = label;
    if (labelEl) labelEl.textContent = 'Pause';
    
    this._sourceNode.onended = () => {
      this._isPreviewing = false;
      if (labelEl) labelEl.textContent = this._rawVocalsBuffer ? 'Preview Vocals' : 'Process & Preview';
    };
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
    
    this._updateTransportTimes();
    
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
    const audioProcessing = this._controller.getState()?.composition.audio_processing;
    const removeSilence = isolateVocals || audioProcessing?.remove_silence;
    
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
        silenceThreshold: audioProcessing?.silence_threshold,
      silenceMinDuration: audioProcessing?.silence_duration,
        sliceBlob: null, // Slicing handled by file selection above
        originalFile: fileToSend
      }
    });
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
      this._container?.querySelectorAll('.subcategory-item').forEach(el => {
        const details = el as HTMLDetailsElement;
        details.open = false;
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
    
    this._dropContent?.classList.remove('hidden');
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
    
    this._updateTransportTimes();
  }
  
  /**
   * Load audio from an existing File object (e.g., from UploadPanel)
   */
  public loadAudioFile(file: File, intent?: 'music' | 'speech'): void {
    void this._loadFile(file, false, intent);
  }
  
  /**
   * Load audio from an existing AudioBuffer
   */
  public loadAudioBuffer(buffer: AudioBuffer, fileName?: string): void {
    this._initAudioContext();
    this._audioBuffer = buffer;
    
    this._dropContent?.classList.add('hidden');
    this._songLoaded?.classList.add('visible');
    
    const fileNameEl = this._container?.querySelector('.slicer-file-name');
    if (fileNameEl) fileNameEl.textContent = fileName || 'Audio';
    
    this._updateTransportTimes();
    
    this._resetState();
		this._invalidateGeneratedBuffers();
		this._updateCommitButton();
		this._drawWaveform();
		this._controller.updateAudioAccordionValue('custom');
		
		// Persist filename to composition state
		this._controller.updateAudioSourceState({
			source_file: fileName ?? '',
			start_time: 0,
			end_time: this._audioBuffer.duration
		});
  }
  
  destroy(): void {
    // Stop playback
    this._stop();
    
    // Remove resize listener
    window.removeEventListener('resize', this._handleResize);
    
    // Close audio context
    if (this._audioContext) {
      void this._audioContext.close();
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

