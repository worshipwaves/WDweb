# Project Files Overview

**Generated on:** 2025-12-21 17:28:22
**Source:** Specified files (6)
**Total files:** 6

## Files Included

- `C:\Users\paulj\WDweb\config\composition_defaults.json`
- `C:\Users\paulj\WDweb\routers\audio_router.py`
- `C:\Users\paulj\WDweb\services\audio_processing_service.py`
- `C:\Users\paulj\WDweb\services\demucs_service.py`
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
            y, sr = librosa.load(str(temp_input), sr=_audio_config.target_sample_rate, mono=True, offset=start_time, duration=duration)
            sf.write(str(temp_input), y, sr)
        
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
Faithful port of PyQt audio processing functions for numerical parity.
All methods are stateless, pure functions for web deployment.
"""

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


class AudioProcessingService:
    """
    Static service containing exact ports of PyQt audio processing functions.
    All methods must produce numerically identical outputs to PyQt versions (tolerance: 1e-10).
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
        
        Args:
            normalized_amps: 0-1 normalized amplitude values
            max_amplitude: Maximum physical amplitude (inches)
            bit_diameter: CNC bit diameter for floor calculation
            
        Returns:
            Scaled amplitudes with minimum floor of bit_diameter * 2.0
        """
        floor = bit_diameter * 2.0
        return [max(amp * max_amplitude, floor) for amp in normalized_amps]
    
    @staticmethod
    def extract_amplitudes(y: np.ndarray, num_amplitudes: int) -> np.ndarray:
        """
        Port of PyQt's _extract_amplitudes from core/algorithms/audio_processing.py.
        
        Converts to mono, normalizes to [-1, 1], resamples to exactly num_amplitudes samples.
        
        Args:
            y: Input audio samples
            num_amplitudes: Target number of samples (typically 200,000)
            
        Returns:
            Resampled and normalized amplitude array
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
        Port of PyQt's bin_amplitudes from core/algorithms/audio_processing.py.
        
        Bins amplitudes into slots using specified mode, includes final normalization step.
        
        Args:
            amplitudes: Input amplitude array (normalized to [-1, 1])
            num_slots: Number of output slots
            mode: Binning mode (MEAN_ABSOLUTE, MIN_MAX, or CONTINUOUS)
            
        Returns:
            Tuple of (min_amplitudes, max_amplitudes) normalized arrays.
            For MEAN_ABSOLUTE mode, arrays are symmetric.
        """
        if amplitudes is None or len(amplitudes) == 0:
            return np.zeros(num_slots), np.zeros(num_slots)
        
        if num_slots <= 0:
            raise ValueError("Number of slots must be positive")
        
        min_binned_data = np.zeros(num_slots)
        max_binned_data = np.zeros(num_slots)
        
        if mode == BinningMode.CONTINUOUS:
            # Check if we have gaps from silence removal
            will_fallback = len(amplitudes) < num_slots * 0.8
            
            if will_fallback:  # Less than 80% of expected samples
                # Fallback to MEAN_ABSOLUTE
                return AudioProcessingService.bin_amplitudes(
                    amplitudes, num_slots, BinningMode.MEAN_ABSOLUTE
                )
            
            # Direct resampling, no binning
            if len(amplitudes) != num_slots:
                old_indices = np.arange(len(amplitudes))
                new_indices = np.linspace(0, len(amplitudes)-1, num_slots)
                resampled = np.interp(new_indices, old_indices, amplitudes)
            else:
                resampled = amplitudes.copy()
            
            # Split positive/negative for visualization
            for i in range(num_slots):
                if resampled[i] >= 0:
                    min_binned_data[i] = 0
                    max_binned_data[i] = resampled[i]
                else:
                    min_binned_data[i] = resampled[i]
                    max_binned_data[i] = 0
        else:
            # Binning approaches (MEAN_ABSOLUTE and MIN_MAX)
            num_total_amplitudes = len(amplitudes)
            bin_size = num_total_amplitudes / float(num_slots)
            
            for i in range(num_slots):
                start_idx = int(round(i * bin_size))
                end_idx = int(round((i + 1) * bin_size))
                
                if start_idx >= num_total_amplitudes:
                    continue
                
                end_idx = min(end_idx, num_total_amplitudes)
                if start_idx >= end_idx:
                    continue
                
                slice_data = amplitudes[start_idx:end_idx]
                
                if len(slice_data) > 0:
                    if mode == BinningMode.MEAN_ABSOLUTE:
                        binned_value = np.mean(np.abs(slice_data))
                        min_binned_data[i] = -binned_value  # Symmetric
                        max_binned_data[i] = binned_value
                    elif mode == BinningMode.MIN_MAX:
                        min_binned_data[i] = np.min(slice_data)
                        max_binned_data[i] = np.max(slice_data)
        
        # Final normalization step - critical for parity
        if mode == BinningMode.MEAN_ABSOLUTE:
            # Normalize to [0, 1] but keep symmetry
            max_val = np.max(np.abs(max_binned_data))
            if max_val > 1e-9:
                min_normalized = min_binned_data / max_val  # Will be negative
                max_normalized = max_binned_data / max_val  # Will be positive
            else:
                min_normalized = np.zeros_like(min_binned_data)
                max_normalized = np.zeros_like(max_binned_data)
        else:
            # For MIN_MAX and CONTINUOUS, preserve negative values
            all_values = np.concatenate([min_binned_data, max_binned_data])
            max_abs = np.max(np.abs(all_values))
            
            if max_abs > 1e-9:
                min_normalized = min_binned_data / max_abs
                max_normalized = max_binned_data / max_abs
            else:
                min_normalized = np.zeros_like(min_binned_data)
                max_normalized = np.zeros_like(max_binned_data)
        
        return min_normalized, max_normalized
        
    @staticmethod
    def process_audio_file(audio_path: str, state: CompositionStateDTO) -> Dict[str, Any]:
        """
        Complete audio processing pipeline with slicing, demucs, and silence removal.
        This method is now focused ONLY on audio processing and does not calculate geometry.
        
        Args:
            audio_path: Path to the audio file
            state: Composition state containing processing parameters
            
        Returns:
            Dictionary containing scaled amplitudes and raw samples for client caching
        """
        performance_monitor.start('total_audio_processing')
        
        try:
            import librosa
            import soundfile as sf
            # [INVESTIGATION] Log environment details
            file_size = os.path.getsize(audio_path)
            print(f"[ENV-CHECK] Librosa: {librosa.__version__}, SoundFile: {sf.__version__}")
            print(f"[ENV-CHECK] File on disk: {file_size} bytes (Path: {audio_path})")
        except ImportError:
            raise ValueError("Required libraries not installed")
        
        # Extract parameters
        start_time = state.audio_source.start_time if state.audio_source else 0.0
        end_time = state.audio_source.end_time if state.audio_source else 0.0
        use_stems = state.audio_source.use_stems if state.audio_source else False
        stem_choice = state.audio_source.stem_choice if state.audio_source else "vocals"
        
        performance_monitor.start('audio_slicing_and_loading')
        
        # Step 1: Time slicing
        working_path = audio_path
        if start_time > 0 or (end_time > 0 and end_time > start_time):
            print(f"Step 1: Slicing audio from {start_time}s to {end_time}s...")
            duration = (end_time - start_time) if end_time > start_time else None
            
            try:
                audio_data, sample_rate = librosa.load(
                    audio_path, 
                    sr=None, 
                    mono=True,
                    offset=start_time,
                    duration=duration
                )
                
                # Save slice to temp file for potential demucs processing
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
                    sf.write(tmp.name, audio_data, sample_rate)
                    working_path = tmp.name
                    print(f"  Sliced to {duration:.1f} seconds")
                    
            except Exception as e:
                raise ValueError(f"Failed to slice audio: {e}")
        else:
            # Load full file
            try:
                audio_data, sample_rate = librosa.load(working_path, sr=None, mono=True)
            except Exception as e:
                raise ValueError(f"Failed to load audio file: {e}")
                
        performance_monitor.end('audio_slicing_and_loading')
        
        # Step 2: Demucs stem separation (optional)
        if use_stems:
            print(f"Step 2: Extracting {stem_choice} with demucs...")
            
            performance_monitor.start('demucs_execution')
            
            stem_path = AudioProcessingService._run_demucs_local(working_path, stem_choice)
            
            performance_monitor.end('demucs_execution')
            
            if stem_path:
                # Load the stem
                try:
                    audio_data, sample_rate = librosa.load(stem_path, sr=None, mono=True)
                    print(f"  Extracted {stem_choice} stem")
                    
                    # Clean up demucs output
                    try:
                        demucs_dir = Path(stem_path).parent.parent
                        if demucs_dir.name in ["htdemucs", "htdemucs_ft"]:
                            shutil.rmtree(demucs_dir, ignore_errors=True)
                    except:
                        pass
                except Exception as e:
                    print(f"  Warning: Failed to load stem, using original: {e}")
        
        # Step 3: Remove silence (optional)
        if state.audio_processing and state.audio_processing.remove_silence:
            performance_monitor.start('silence_removal')
            print(f"Step 3: Removing silence...")
            original_length = len(audio_data) / sample_rate
            audio_data = AudioProcessingService._remove_silence(
                audio_data,
                sample_rate, 
                state.audio_processing.silence_threshold,
                state.audio_processing.silence_duration
            )
            performance_monitor.end('silence_removal')
            new_length = len(audio_data) / sample_rate
            print(f"  Reduced from {original_length:.1f}s to {new_length:.1f}s")
        
        # Clean up temp file if created
        if working_path != audio_path and os.path.exists(working_path):
            try:
                os.unlink(working_path)
            except:
                pass
        
        performance_monitor.start('amplitude_extraction_and_binning')
        
        # Extract 200k samples (matching PyQt behavior)
        samples = AudioProcessingService.extract_amplitudes(audio_data, 200000)
        
        # Get binning mode from state with proper mapping
        mode_str = state.audio_processing.binning_method if state.audio_processing else "mean_abs"
        
        # Map common variations to correct enum values
        mode_map = {
            "mean": "mean_abs",
            "mean_abs": "mean_abs",
            "mean_absolute": "mean_abs",
            "min_max": "min_max",
            "minmax": "min_max",
            "continuous": "continuous"
        }
        
        mode_str = mode_map.get(mode_str, "mean_abs")
        binning_mode = BinningMode(mode_str)
        
        # Bin to match number of slots
        num_slots = state.pattern_settings.number_slots
        min_binned, max_binned = AudioProcessingService.bin_amplitudes(samples, num_slots, binning_mode)
        
        # Store both arrays for proper slot rendering
        # Backend will send both arrays, frontend will use both for inner/outer radius
        
        # Apply amplitude exponent to both arrays
        exponent = state.pattern_settings.amplitude_exponent
        if exponent != 1.0:
            min_binned = np.power(np.abs(min_binned), exponent) * np.sign(min_binned)
            max_binned = np.power(np.abs(max_binned), exponent) * np.sign(max_binned)
        
        # Normalize both arrays by the same factor
        all_values = np.concatenate([min_binned, max_binned])
        max_val = np.max(np.abs(all_values))
        if max_val > 0:
            min_normalized = min_binned / max_val
            max_normalized = max_binned / max_val
        else:
            min_normalized = min_binned
            max_normalized = max_binned
            
        # --- DIAGNOSTIC DUMP START ---
        print(f"\n[DIAGNOSTIC] Web Audio Pipeline Data Dump")
        print(f"1. Audio Data (After Silence Removal):")
        print(f"   - Length: {len(audio_data)}")
        print(f"   - Sample Rate: {sample_rate}")
        print(f"   - Duration: {len(audio_data)/sample_rate:.4f}s")
        print(f"   - First 5 samples: {audio_data[:5].tolist()}")
        print(f"   - Last 5 samples: {audio_data[-5:].tolist()}")
        print(f"2. Extracted Samples (200k resampled):")
        print(f"   - Length: {len(samples)}")
        print(f"   - First 5: {samples[:5].tolist()}")
        print(f"   - Last 5: {samples[-5:].tolist()}")
        print(f"3. Binning Config:")
        print(f"   - Mode: {binning_mode}")
        print(f"   - Num Slots: {num_slots}")
        print(f"   - Exponent: {exponent}")
        print(f"4. Binned (Normalized) - max_normalized:")
        print(f"   - Length: {len(max_normalized)}")
        print(f"   - All values: {[round(float(x), 6) for x in max_normalized]}")
        print(f"   - Min: {float(np.min(max_normalized)):.6f}")
        print(f"   - Max: {float(np.max(max_normalized)):.6f}")
        print(f"[DIAGNOSTIC] End Dump\n")
        # --- DIAGNOSTIC DUMP END ---    
            
        performance_monitor.end('amplitude_extraction_and_binning')   
        
        # NOTE: max_amplitude_local is now calculated in the facade.
        # This service now returns the NORMALIZED amplitudes.
        # The facade is responsible for the final scaling.
        
        performance_monitor.end('total_audio_processing')
        
        return {
            "min_amplitudes": min_normalized.tolist(),  # Normalized min array
            "max_amplitudes": max_normalized.tolist(),  # Normalized max array
            "raw_samples_for_cache": samples.tolist()
        } 
    
    @staticmethod
    def calculate_auto_roll_for_sections(num_sections: int, num_slots: int) -> int:
        """
        Port of PyQt's calculate_auto_roll_for_sections from geometry_calculator.py.
        
        Calculate automatic roll amount for n=3 sections business logic.
        
        Args:
            num_sections: Number of sections in design
            num_slots: Total number of slots
            
        Returns:
            Roll amount (number of slots to shift)
        """
        if num_sections == 3 and num_slots > 0:
            slots_in_section = num_slots // 3
            return slots_in_section // 2
        return 0
    
    @staticmethod
    def _remove_silence(
        audio_data: np.ndarray,
        sample_rate: int,
        threshold_db: float,
        min_duration: float
    ) -> np.ndarray:
        """
        Remove silence from audio signal maintaining immutability.
        Essential for vocals after demucs separation.
        """
        import librosa
        
        # Find non-silent intervals
        intervals = librosa.effects.split(
            audio_data, 
            top_db=-threshold_db,
            frame_length=2048,
            hop_length=512
        )
        
        if len(intervals) == 0:
            return audio_data.copy()
            
        # Build merged intervals immutably
        min_samples = int(min_duration * sample_rate)
        merged_intervals = []
        
        for start, end in intervals:
            if end - start < min_samples:
                continue
                
            if merged_intervals and start - merged_intervals[-1][1] < min_samples:
                # Create new list with merged interval
                merged_intervals = merged_intervals[:-1] + [(merged_intervals[-1][0], end)]
            else:
                # Create new list with added interval
                merged_intervals = merged_intervals + [(start, end)]
                
        if not merged_intervals:
            return audio_data.copy()
            
        # Extract non-silent parts using list comprehension (immutable)
        non_silent_parts = [audio_data[start:end] for start, end in merged_intervals]
        
        return np.concatenate(non_silent_parts) if non_silent_parts else audio_data.copy()
    
    @staticmethod
    def _run_demucs_local(audio_path: str, stem_choice: str) -> Optional[str]:
        """
        Run demucs locally using GPU if available.
        Returns path to the extracted stem or None if failed.
        """
        try:
            import torch
            
            # Check for GPU
            device = "cuda" if torch.cuda.is_available() else "cpu"
            if device == "cuda":
                print(f"✓ Using GPU for demucs")
            else:
                print("⚠ Using CPU for demucs (will be slower)")
            
            # Create temp directory for output
            output_dir = Path(tempfile.gettempdir()) / "demucs_output"
            output_dir.mkdir(exist_ok=True)
            
            # Run demucs via command line
            cmd = [
                "demucs",
                "-d", device,
                "--two-stems", "vocals",  # Faster: just vocals/no_vocals
                "-o", str(output_dir),
                audio_path
            ]
            
            print(f"Running demucs on {Path(audio_path).name}...")
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                print(f"Demucs failed: {result.stderr}")
                return None
            
            # Find the output file
            audio_name = Path(audio_path).stem
            stem_path = output_dir / "htdemucs" / audio_name / f"{stem_choice}.wav"
            
            if not stem_path.exists():
                stem_path = output_dir / "htdemucs_ft" / audio_name / f"{stem_choice}.wav"
            
            if stem_path.exists():
                return str(stem_path)
            else:
                print(f"Stem not found at expected path")
                return None
                
        except ImportError:
            print("⚠ Demucs not installed. Install with: pip install demucs")
            return None
        except Exception as e:
            print(f"⚠ Demucs error: {e}")
            return None
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
  binningMode: z.enum(['mean_abs', 'min_max', 'continuous'])
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
    return this._binSamples(
      session.samples,
      params.numSlots,
      params.binningMode
    );
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

