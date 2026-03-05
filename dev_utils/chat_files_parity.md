# Project Files Overview

**Generated on:** 2025-12-07 10:57:07
**Source:** Specified files (10)
**Total files:** 10

## Files Included

- `C:\Users\paulj\WDweb\WaveformViewer.ts`
- `C:\Users\paulj\WDweb\config\composition_defaults.json`
- `C:\Users\paulj\WDweb\routers\audio_router.py`
- `C:\Users\paulj\WDweb\services\audio_processing_service.py`
- `C:\Users\paulj\WDweb\services\demucs_service.py`
- `C:\Users\paulj\WDweb\services\dtos.py`
- `C:\Users\paulj\WDweb\src\ApplicationController.ts`
- `C:\Users\paulj\WDweb\src\AudioCacheService.ts`
- `C:\Users\paulj\WDweb\src\WaveformDesignerFacade.ts`
- `C:\Users\paulj\WDweb\src\components\AudioSlicerPanel.ts`

---

## File: `C:\Users\paulj\WDweb\WaveformViewer.ts`

```typescript
/**
 * WaveformViewer.ts
 * Handles audio file loading, waveform visualization, and playback controls
 */

export interface AudioState {
  file: File | null;
  buffer: AudioBuffer | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  sliceRange: { start: number; end: number } | null;
}

export class WaveformViewer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private audioContext: AudioContext;
  private audioBuffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private startedAt: number = 0;
  private pausedAt: number = 0;
  private isPlaying: boolean = false;
  
  private waveformData: Float32Array | null = null;
  private peaks: number[] = [];
  private troughs: number[] = [];
  
  private markers: { begin: number | null; end: number | null } = { begin: null, end: null };
  private isDragging: boolean = false;
  private hoverPosition: number | null = null;
  
  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) throw new Error(`Canvas element with id "${canvasId}" not found`);
    
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context from canvas');
    this.ctx = ctx;
    
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.setupCanvas();
    this.attachEventListeners();
  }
  
  private setupCanvas(): void {
    const resizeCanvas = () => {
      const container = this.canvas.parentElement;
      if (container) {
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        if (this.waveformData) this.drawWaveform();
      }
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
  }
  
  public async loadAudio(file: File): Promise<void> {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    const arrayBuffer = await file.arrayBuffer();
    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this.extractWaveformData();
    this.drawWaveform();
  }
  
  private extractWaveformData(): void {
    if (!this.audioBuffer) return;
    
    this.waveformData = this.audioBuffer.getChannelData(0);
    const samplesPerPixel = Math.floor(this.waveformData.length / this.canvas.width);
    this.peaks = [];
    this.troughs = [];
    
    for (let i = 0; i < this.canvas.width; i++) {
      const start = i * samplesPerPixel;
      const end = Math.min(start + samplesPerPixel, this.waveformData.length);
      
      let min = 1.0;
      let max = -1.0;
      
      for (let j = start; j < end; j++) {
        const sample = this.waveformData[j];
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }
      
      this.peaks.push(max);
      this.troughs.push(min);
    }
  }
  
  private drawWaveform(): void {
    const { width, height } = this.canvas;
    
    // Clear canvas with gradient
    const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#0a0a0a');
    gradient.addColorStop(1, '#1a1a1a');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);
    
    if (!this.peaks.length) return;
    
    const centerY = height / 2;
    const amplitude = height * 0.4;
    
    // Draw mirrored waveform
    this.ctx.beginPath();
    for (let i = 0; i < this.peaks.length; i++) {
      const x = i;
      const peakY = centerY - (this.peaks[i] * amplitude);
      
      if (i === 0) this.ctx.moveTo(x, centerY);
      this.ctx.lineTo(x, peakY);
    }
    
    for (let i = this.peaks.length - 1; i >= 0; i--) {
      const x = i;
      const troughY = centerY + Math.abs(this.troughs[i] * amplitude);
      this.ctx.lineTo(x, troughY);
    }
    
    this.ctx.closePath();
    this.ctx.fillStyle = 'rgba(100, 150, 255, 0.3)';
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1;
    this.ctx.globalAlpha = 0.8;
    this.ctx.stroke();
    
    this.drawMarkers();
  }
  
  public getAudioBuffer(): AudioBuffer | null {
    return this.audioBuffer;
  }
  
  private drawMarkers(): void {
    const { width, height } = this.canvas;
    
    if (this.markers.begin !== null && this.markers.end !== null) {
      const startX = this.markers.begin * width;
      const endX = this.markers.end * width;
      
      this.ctx.fillStyle = 'rgba(76, 175, 80, 0.2)';
      this.ctx.fillRect(startX, 0, endX - startX, height);
    }
    
    if (this.markers.begin !== null) {
      const x = this.markers.begin * width;
      this.ctx.strokeStyle = '#4CAF50';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }
    
    if (this.markers.end !== null) {
      const x = this.markers.end * width;
      this.ctx.strokeStyle = '#F44336';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }
  }
  
  // Add mouse/touch event handlers
  private attachEventListeners(): void {
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
  }
  
  private handleMouseDown(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const position = x / this.canvas.width;
    
    if (e.shiftKey || !this.markers.begin) {
      this.setMarker('begin', position);
    } else {
      this.setMarker('end', position);
    }
  }
  
  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const position = x / this.canvas.width;
    
    if (!this.markers.begin) {
      this.setMarker('begin', position);
    } else {
      this.setMarker('end', position);
    }
  }
  
  public setMarker(type: 'begin' | 'end', position: number | null): void {
    this.markers[type] = position;
    this.drawWaveform();
  }
  
  public getSliceRange(): { start: number; end: number } | null {
    if (this.markers.begin !== null && this.markers.end !== null && this.audioBuffer) {
      return {
        start: this.markers.begin * this.audioBuffer.duration,
        end: this.markers.end * this.audioBuffer.duration
      };
    }
    return null;
  }
}
```

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
    "side_margin": 1.0,
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
    "silence_duration": 0.50,
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
_demucs = DemucsService(audio_config=_audio_config)


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
                    sr=44100, 
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
                audio_data, sample_rate = librosa.load(working_path, sr=44100, mono=True)
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
                    audio_data, sample_rate = librosa.load(stem_path, sr=44100, mono=True)
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
    
    # Desktop defaults (used if no config provided)
    DEFAULT_TARGET_SAMPLE_RATE = 44100
    DEFAULT_SILENCE_THRESHOLD = -40.0
    DEFAULT_SILENCE_DURATION = 1.0
    DEFAULT_FRAME_LENGTH = 2048
    DEFAULT_HOP_LENGTH = 512
    
    def __init__(
        self, 
        output_dir: Path | None = None,
        audio_config: Optional['AudioProcessingDTO'] = None
    ):
        self._output_dir = output_dir or Path(__file__).parent.parent / "temp" / "demucs_output"
        self._output_dir.mkdir(parents=True, exist_ok=True)
        
        # Load defaults from DTO or use hardcoded desktop defaults
        if audio_config:
            self._target_sample_rate = int(audio_config.target_sample_rate)
            self._default_threshold = float(audio_config.silence_threshold)
            self._default_duration = float(audio_config.silence_duration)
            self._frame_length = int(audio_config.silence_frame_length)
            self._hop_length = int(audio_config.silence_hop_length)
        else:
            self._target_sample_rate = self.DEFAULT_TARGET_SAMPLE_RATE
            self._default_threshold = self.DEFAULT_SILENCE_THRESHOLD
            self._default_duration = self.DEFAULT_SILENCE_DURATION
            self._frame_length = self.DEFAULT_FRAME_LENGTH
            self._hop_length = self.DEFAULT_HOP_LENGTH
    
    def separate_vocals(
        self,
        input_path: Path,
        remove_silence: bool = False
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
        min_duration: Optional[float] = None,
        threshold_db: Optional[float] = None
    ) -> Path:
        """
        Apply silence compression to any audio file.
        Standalone endpoint for iterative testing.
        Uses config defaults if params not provided.
        """
        # Use configured sample rate for Desktop parity
        y, sr = librosa.load(str(input_path), sr=self._target_sample_rate, mono=True)
        
        original_duration = len(y) / sr
        
        processed_y = self._apply_silence_removal_logic(
            y, sr,
            threshold_db=threshold_db if threshold_db is not None else self._default_threshold,
            min_duration=min_duration if min_duration is not None else self._default_duration
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
                merged_intervals[-1] = (merged_intervals[-1][0], end)
            else:
                merged_intervals.append((start, end))
                
        if not merged_intervals:
            return y
            
        non_silent_parts = []
        for start, end in merged_intervals:
            non_silent_parts.append(y[start:end])
            
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

## File: `C:\Users\paulj\WDweb\services\dtos.py`

```python
"""
Data Transfer Objects (DTOs) for WaveDesigner
Following Pragmatic Immutability principle - all DTOs are frozen
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
    """Wood materials configuration from default_parameters.json."""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    default_species: str
    default_grain_direction: Literal["horizontal", "vertical", "radiant"]
    species_catalog: List[SpeciesCatalogItemDTO]
    texture_config: Dict[str, Any]
    rendering_config: Dict[str, float]
    geometry_constants: Dict[str, Dict[str, List[int]]]

# Material Configuration DTOs
class SectionMaterialDTO(BaseModel):
    """Material settings for individual sections."""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    section_id: int = Field(ge=0, le=3)
    species: str
    grain_direction: Literal["horizontal", "vertical", "radiant", "diamond"]
    
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
    type: Literal["acrylic", "cloth", "leather", "foam"]
    material: str
    inset: float = Field(ge=0.0, le=2.0)  
    
# Frame and Physical Design DTOs
class FrameDesignDTO(BaseModel):
    """Frame design parameters for the physical panel."""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    shape: Literal["circular", "rectangular", "diamond"]
    frame_orientation: Literal["vertical", "horizontal"]
    finish_x: float = Field(ge=1.0, le=100.0)
    finish_y: float = Field(ge=1.0, le=100.0)
    finish_z: float = Field(ge=0.1, le=5.0)
    number_sections: int = Field(ge=1, le=4)
    separation: float = Field(ge=0.0, le=10.0)
    species: str
    material_thickness: float = Field(ge=0.1, le=2.0)
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
    dovetail_inset: float = Field(ge=0.01, le=0.5)
    dovetail_cut_direction: Literal["climb", "conventional"]
    dovetail_edge_default: int = Field(ge=0, le=3)
    dovetail_edge_overrides: str  # JSON string of overrides


class PatternSettingsDTO(BaseModel):
    """Slot pattern configuration"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    slot_style: Literal["radial", "linear", "sunburst"]
    pattern_diameter: float = Field(default=36.0, ge=1.0, le=100.0)
    number_slots: int = Field(ge=1, le=3000)
    bit_diameter: float = Field(ge=0.0, le=2.0)
    spacer: float = Field(ge=0.0, le=10.0)
    x_offset: float = Field(ge=0.0, le=10.0)
    y_offset: float = Field(ge=0.0, le=10.0)
    side_margin: float = Field(ge=0.0, le=100.0)
    scale_center_point: float = Field(ge=0.1, le=10.0)
    amplitude_exponent: float = Field(ge=0.25, le=4.0)
    orientation: Literal["auto", "horizontal", "vertical"]
    grain_angle: float = Field(ge=0.0, le=360.0)
    lead_overlap: float = Field(ge=0.0, le=2.0)
    lead_radius: float = Field(ge=0.05, le=1.0)
    dovetail_settings: DovetailSettingsDTO


# Audio Processing DTOs
class AudioSourceDTO(BaseModel):
    """Audio source configuration"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    source_file: Optional[str]
    start_time: float = Field(ge=0.0, le=9999.0)
    end_time: float = Field(ge=0.0, le=9999.0)
    use_stems: bool
    stem_choice: Literal["vocals", "drums", "bass", "other", "no_vocals", "all"]


class AudioProcessingDTO(BaseModel):
    """Audio processing parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    target_sample_rate: int = Field(default=44100, ge=8000, le=96000)
    num_raw_samples: int = Field(ge=50000, le=1000000)
    filter_amount: float = Field(ge=0.0, le=0.5)
    apply_filter: bool
    binning_method: Literal["mean", "max", "rms"]
    binning_mode: Literal["mean_abs", "min_max", "continuous"]
    remove_silence: bool
    silence_threshold: int = Field(ge=-80, le=0)
    silence_duration: float = Field(ge=0.1, le=10.0)
    silence_frame_length: int = Field(default=2048, ge=512, le=8192)
    silence_hop_length: int = Field(default=512, ge=128, le=2048)


# Peak Control DTOs
class PeakControlDTO(BaseModel):
    """Peak detection and control settings"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    method: Literal["clip", "compress", "scale_up", "none"]
    threshold: float = Field(ge=0.1, le=1.0)
    roll_amount: int
    
    # Individual control toggles
    nudge_enabled: bool
    clip_enabled: bool
    compress_enabled: bool
    scale_enabled: bool
    scale_all_enabled: bool
    manual_enabled: bool
    
    # Control parameters
    clip_percentage: float = Field(ge=0.1, le=1.0)
    compression_exponent: float = Field(ge=0.1, le=1.0)
    threshold_percentage: float = Field(ge=0.1, le=1.0)
    scale_all_percentage: float = Field(ge=0.1, le=2.0)
    manual_slot: int = Field(ge=0, le=1000)
    manual_value: float = Field(ge=-1000.0, le=1000.0)


# Visual Correction DTOs
class VisualCorrectionDTO(BaseModel):
    """Visual correction parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    apply_correction: bool
    correction_scale: float = Field(ge=0.0, le=5.0)
    correction_mode: Literal["nudge_adj", "center_adj", "Nudge Adj", 
                            "Center Adj", "Nudge_Adj", "Center_Adj"]


# Display Settings DTOs
class DisplaySettingsDTO(BaseModel):
    """Display and visualization settings"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    show_debug_circle: bool
    debug_circle_radius: float = Field(ge=0.1, le=100.0)
    show_labels: bool
    show_offsets: bool


# Export Settings DTOs
class ExportSettingsDTO(BaseModel):
    """Export configuration for various formats"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    cnc_margin: float = Field(ge=0.0, le=10.0)
    sections_in_sheet: int = Field(ge=1, le=100)


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
    
    wetness: float = Field(ge=0.3, le=0.9)
    pigment_load: float = Field(ge=0.2, le=1.0)
    paper_roughness: float = Field(ge=0.0, le=0.8)
    bleed_amount: float = Field(ge=0.1, le=0.8)
    granulation: float = Field(ge=0.0, le=0.7)


class OilSettingsDTO(BaseModel):
    """Oil painting style parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    brush_size: float = Field(ge=0.1, le=1.0)
    impasto: float = Field(ge=0.0, le=1.0)
    brush_texture: float = Field(ge=0.0, le=1.0)
    color_mixing: float = Field(ge=0.0, le=1.0)


class InkSettingsDTO(BaseModel):
    """Ink style parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    ink_flow: float = Field(ge=0.0, le=1.0)
    ink_density: float = Field(ge=0.0, le=1.0)
    edge_darkening: float = Field(ge=0.0, le=1.0)
    dryness: float = Field(ge=0.0, le=1.0)


class PhysicalSimulationDTO(BaseModel):
    """Physical paint simulation parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    brush_pressure: float = Field(ge=0.0, le=1.0)
    paint_thickness: float = Field(ge=0.0, le=1.0)
    drying_time: float = Field(ge=0.0, le=1.0)
    medium_viscosity: float = Field(ge=0.0, le=1.0)


class NoiseSettingsDTO(BaseModel):
    """Noise texture settings"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    noise_scale: float = Field(ge=1.0, le=100.0)
    noise_octaves: float = Field(ge=1.0, le=8.0)
    noise_seed: float = Field(ge=0.0, le=100.0)
    flow_speed: float = Field(ge=0.0, le=1.0)
    flow_direction: float = Field(ge=-1.0, le=1.0)


class ArtisticRenderingDTO(BaseModel):
    """Artistic rendering parameters"""
    model_config = ConfigDict(frozen=True, populate_by_name=True)
    
    artistic_style: Literal["watercolor", "oil", "ink"]
    color_palette: Literal["ocean", "sunset", "forest", "monochrome"]
    
    # Common artistic parameters
    opacity: float = Field(ge=0.0, le=1.0)
    artistic_intensity: float = Field(ge=0.0, le=1.0)
    amplitude_effects: str
    amplitude_influence: float = Field(ge=0.2, le=1.5)
    
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
  config: WoodMaterialsConfig
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
  const archetypeId = window.controller?.getActiveArchetypeId();
  const archetype = archetypeId ? window.controller?.getArchetype(archetypeId) : null;
  const availableGrains = (archetype as { available_grains?: string[] })?.available_grains ?? ['vertical', 'horizontal'];
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
  private _idleTextureLoader: unknown = null; // IdleTextureLoader instance
	private _placementDefaults: PlacementDefaults | null = null;
	private _constraints: ConstraintsConfig | null = null;
	private _resolver: ConstraintResolver | null = null;
	private _compositionCache: Map<string, CompositionStateDTO> = new Map();
	private _isUpdatingComposition: boolean = false;
	public getResolver(): ConstraintResolver | null {
    return this._resolver;
  }
	public getConstraintsConfig(): ConstraintsConfig | null {
    return this._constraints;
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
   * Restore UI from persisted state after DOM is ready
   * Called from main.ts after LeftPanelRenderer has rendered
   */
  restoreUIFromState(): void {
    if (!this._state) return;
    
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
        void textureCache.preloadAllTextures(this._woodMaterialsConfig).then((idleLoader) => {
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
        (sceneManager as unknown as { changeBackground: (type: string, id: string, rgb?: number[], path?: string) => void })
          .changeBackground(bgState.type, bgState.id, background.rgb, background.path);
        
        // Apply lighting config on initial load
        if (background.lighting && 'applyLighting' in sceneManager) {
          (sceneManager as unknown as { applyLighting: (lighting: unknown) => void }).applyLighting(background.lighting);
        } else if ('resetLighting' in sceneManager) {
          (sceneManager as unknown as { resetLighting: () => void }).resetLighting();
        }
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
    
    // SMART BYPASS: If blob provided and no further processing needed, skip backend
    if (payload.sliceBlob && !payload.isolateVocals && !payload.removeSilence) {
      console.log('[Controller] Client-side processing complete. Bypassing backend.');
      const finalFile = new File([payload.sliceBlob], 'processed.wav', { type: 'audio/wav' });
      await this.handleFileUpload(finalFile, this._state.composition);
      return;
    }
    
    // Determine source audio
    const audioFile = payload.sliceBlob 
      ? new File([payload.sliceBlob], 'slice.wav', { type: 'audio/wav' })
      : payload.originalFile;
    
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
      // Only send timing if we're NOT sending pre-sliced blob
      // (backend should slice original file, not re-slice an already sliced blob)
      if (!payload.sliceBlob && payload.useSlice && payload.startTime !== null && payload.endTime !== null) {
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
      
      // Feed into existing upload pipeline
      await this.handleFileUpload(processedFile, this._state.composition);
      
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
			
      // Force a complete state reset on new file upload
      const freshState = await this._facade.createInitialState();
      this._state = freshState;
      
      // Clear the audio cache
      this._audioCache.clearAll();
			
			// Clear composition cache on new audio upload
      this._compositionCache.clear();

      // Process audio through facade
      const audioResponse: AudioProcessResponse = await this._facade.processAudio(
        file,
        this._state.composition
      );
      PerformanceMonitor.end('backend_audio_processing');

      PerformanceMonitor.start('cache_raw_samples');
      // Cache the raw samples
      const sessionId = this._audioCache.cacheRawSamples(
        file,
        new Float32Array(audioResponse.raw_samples_for_cache)
      );
      PerformanceMonitor.end('cache_raw_samples');
      
      // Dispatch the backend response (subscribers will sync UI to backend defaults)
      await this.dispatch({
        type: 'FILE_PROCESSING_SUCCESS',
        payload: {
          composition: audioResponse.updated_state,
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
          audioResponse.updated_state,
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
    const background = category.find(bg => bg.id === backgroundId);
    
    if (!background) {
      console.error(`[Controller] Background not found: ${backgroundId}`);
      return;
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
      this.notifySubscribers();
    }
    
    // Apply to scene (deferred until after composition update to prevent flash of wrong size)
		const applyBackground = () => {
			if ('changeBackground' in this._sceneManager) {
				(this._sceneManager as unknown as { changeBackground: (type: string, id: string, rgb?: number[], path?: string) => void })
					.changeBackground(type, backgroundId, background.rgb, background.path);
			}
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
          
          // Apply composition (no changes needed, just ensures scene updates)
          void this.handleCompositionUpdate(composition).then(applyBackground);
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
					void this.handleCompositionUpdate(composition).then(applyBackground);
				}
        
        // Apply art placement
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

				if (artPlacement && 'applyArtPlacement' in this._sceneManager) {
					(this._sceneManager as unknown as { applyArtPlacement: (placement: ArtPlacement) => void }).applyArtPlacement(artPlacement);
				} else if ('resetArtPlacement' in this._sceneManager) {
					(this._sceneManager as unknown as { resetArtPlacement: () => void }).resetArtPlacement();
				}

				// Apply lighting config if present
				if (background?.lighting && 'applyLighting' in this._sceneManager) {
					(this._sceneManager as unknown as { applyLighting: (lighting: unknown) => void }).applyLighting(background.lighting);
				} else if ('resetLighting' in this._sceneManager) {
					(this._sceneManager as unknown as { resetLighting: () => void }).resetLighting();
				}
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
        isDisabled: !!subcategory.note, // Placeholder subcategories are disabled
        isSingle: sortedSubcategories.length === 1,
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
        return 'Choose audio file';
      }
      
      case 'audio:slicing': {
        if (this._audioSlicerPanel) {
          const selection = this._audioSlicerPanel.getSelectionDisplay();
          if (selection) return selection;
        }
        return 'Optional';
      }
      
      case 'audio:demucs': {
        if (this._audioSlicerPanel) {
          const enhancements = this._audioSlicerPanel.getEnhancementsDisplay();
          if (enhancements) return enhancements;
        }
        return 'Optional';
      }	
      
      case 'backgrounds:paint':
      case 'backgrounds:accent':
      case 'backgrounds:rooms': {
        const bg = ui.currentBackground;
        if (!bg) return '';
        // subcategoryId is 'paint', 'accent', or 'rooms'
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
    const bg = (category as Array<{ id: string; label?: string }>).find(b => b.id === id);
    return bg?.label || id;
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
      
      // Enable/disable section interaction for wood species
      if (this._sceneManager && 'setSectionInteractionEnabled' in this._sceneManager) {
        const enableInteraction = categoryId === 'wood' && subcategoryId === 'wood_species';
        (this._sceneManager as { setSectionInteractionEnabled: (enabled: boolean) => void }).setSectionInteractionEnabled(enableInteraction);
        (this._sceneManager as { setSectionOverlaysVisible: (visible: boolean) => void }).setSectionOverlaysVisible(enableInteraction);
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
      case 'audio_enhance':
        await this._renderAudioEnhanceContent(container);
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
    
    if (categoryId === 'wood' && subcategoryId === 'panel' && subcategory.filters) {
      return this._createFilterToolbar(categoryId, subcategoryId, subcategory.filters);
    } else if (categoryId === 'wood' && subcategoryId === 'wood_species') {
      return this._createSectionSelectorToolbar();
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
      'custom': 'slicing',
      'slicing': 'demucs'
    };
    const next = nextMap[currentSubcategory];
    if (next && this._accordion) {
      this._accordion.setOpen(currentSubcategory, false);
      this._accordion.setOpen(next, true);
    }
  }
	
	private async _renderAudioEnhanceContent(container: HTMLElement): Promise<void> {
    await this._ensureAudioSlicerPanel();
    if (!this._audioSlicerPanel) return;
    container.innerHTML = '';
    container.appendChild(this._audioSlicerPanel.renderEnhanceSection());
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
    container.innerHTML = '<div class="panel-placeholder"><p>Collections coming soon</p></div>';
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
    
    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'horizontal-scroll';
    
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
      scrollWrapper.appendChild(card.render());
    });
    
    container.innerHTML = '';
    container.appendChild(scrollWrapper);
    this._scrollToSelectedInContainer(scrollWrapper);
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
    
    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'horizontal-scroll';
    
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
      scrollWrapper.appendChild(card.render());
    });
    
    container.innerHTML = '';
    container.appendChild(scrollWrapper);
    this._scrollToSelectedInContainer(scrollWrapper);
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
    const selectedId = currentBg?.type === type ? currentBg.id : null;
    
    // Create horizontal scroll container
    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'scroll-container';
    
    const scrollContent = document.createElement('div');
    scrollContent.className = 'horizontal-scroll';
    
    backgrounds.forEach(bg => {
      const card = this._createBackgroundCard(bg, type, selectedId === bg.id);
      scrollContent.appendChild(card);
    });
    
    scrollWrapper.appendChild(scrollContent);
    
    container.innerHTML = '';
    container.appendChild(scrollWrapper);
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
        const initializedMaterials = initializeSectionMaterials(
          oldN,
          newN,
          uiCapturedMaterials,
          this._woodMaterialsConfig
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
      const audioLevelParams = ['number_sections', 'number_slots', 'binning_mode'];
      const isAudioChange = changedParams.some(param => audioLevelParams.includes(param));
      
      let stateToSend = newComposition;
      
      if (isAudioChange && this._state.audio.audioSessionId) {
        const rebinnedAmplitudes = this._audioCache.rebinFromCache(
          this._state.audio.audioSessionId,
          {
            numSlots: newComposition.pattern_settings.number_slots,
            binningMode: 'mean_abs'
          } as { numSlots: number; binningMode: 'mean_abs' }
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
          
          // Re-apply art placement after rendering
          const archetypeId = this.getActiveArchetypeId();
          if (archetypeId) {
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
            if (!artPlacement && this._backgroundsConfig && this._state) {
              const bgType = this._state.ui.currentBackground.type;
              if (bgType === 'rooms') {
                const bgId = this._state.ui.currentBackground.id;
                const background = this._backgroundsConfig.categories.rooms.find(bg => bg.id === bgId);
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

## File: `C:\Users\paulj\WDweb\src\WaveformDesignerFacade.ts`

```typescript
/**export type Action = 
  | { type: 'FILE_UPLOADED'; payload: File }
  | { type: 'STYLE_SELECTED'; payload: number }
  | { type: 'AUTOPLAY_TOGGLED'; payload: boolean }
  | { type: 'PHASE_CHANGED'; payload: ApplicationState['phase'] }
  | { type: 'PROCESSING_UPDATE'; payload: Partial<ApplicationState['processing']> }
  | { type: 'DEMUCS_COMPLETED'; payload: CompositionStateDTO }
  | { type: 'STATE_RESTORED'; payload: ApplicationState };

 * WaveformDesignerFacade - Frontend facade matching backend architecture
 * 
 * This is the ONLY entry point for UI components to interact with services.
 * Maintains architectural boundaries and prevents direct service access.
 * All state management, backend calls, and business logic go through here.
 */

import { 
  CompositionStateDTOSchema,
  AudioProcessResponseSchema,
  SmartCsgResponseSchema,
  ApplicationStateSchema,
  type CompositionStateDTO,
  type AudioProcessResponse,
  type SmartCsgResponse,
  type StylePreset,
  type ApplicationState
} from './types/schemas';
import { fetchAndValidate, parseStoredData } from './utils/validation';

// Action types for state updates
export type Action =
  | { type: 'FILE_UPLOADED'; payload: { file: File; uiSnapshot: CompositionStateDTO } }
  | { type: 'STYLE_SELECTED'; payload: number }             // user selection
  | { type: 'STYLE_ADVANCE'; payload: number }              // autoplay (programmatic)
  | { type: 'AUTOPLAY_TOGGLED'; payload: boolean }
  | { type: 'PHASE_CHANGED'; payload: ApplicationState['phase'] }
  | { type: 'PROCESSING_UPDATE'; payload: Partial<ApplicationState['processing']> }
  | { type: 'DEMUCS_COMPLETED'; payload: CompositionStateDTO }
  | { type: 'STATE_RESTORED'; payload: ApplicationState }
  | { type: 'COMPOSITION_UPDATED'; payload: CompositionStateDTO }
	| { type: 'AUDIO_COMMIT'; payload: { useSlice: boolean; startTime: number | null; endTime: number | null; isolateVocals: boolean; removeSilence: boolean; silenceThreshold: number; silenceMinDuration: number; sliceBlob: Blob | null; originalFile?: File } }
  | { 
      type: 'FILE_PROCESSING_SUCCESS'; 
      payload: { 
        composition: CompositionStateDTO; 
        maxAmplitudeLocal: number; 
        rawSamplesForCache: number[]; // Add this
        audioSessionId?: string 
      };
    }
  | { type: 'SHOW_HINT' }
  | { type: 'CATEGORY_SELECTED'; payload: string }
  | { type: 'SUBCATEGORY_SELECTED'; payload: { category: string; subcategory: string } }
  | { type: 'FILTER_CHANGED'; payload: { category: string; subcategory: string; filterId: string; selections: string[] } };
	

export class WaveformDesignerFacade {
	private readonly apiBase = 'http://localhost:8000';
  private _stylePresets: StylePreset[] = [];
  
  /**
   * Initialize facade by loading style presets from backend config
   */
  initialize(): void {
  // Style presets deprecated - using archetypes instead
  // Archetypes are loaded by ApplicationController
  this._stylePresets = [];
}
  
  /**
   * Process uploaded audio file through backend
   */
  async processAudio(file: File, state: CompositionStateDTO): Promise<AudioProcessResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('state', JSON.stringify(state));

    return fetchAndValidate(
      `${this.apiBase}/audio/process`,
      AudioProcessResponseSchema,
      {
        method: 'POST',
        body: formData,
      }
    );
  }
  
  /**
   * Get CSG data using the smart processing endpoint
   */
  async getSmartCSGData(
    state: CompositionStateDTO,
    changedParams: string[],
    previousMaxAmplitude: number | null
  ): Promise<SmartCsgResponse> {
    const requestBody = {
      state,
      changed_params: changedParams,
      previous_max_amplitude: previousMaxAmplitude,
    };

    return fetchAndValidate(
      `${this.apiBase}/geometry/csg-data`,
      SmartCsgResponseSchema,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );
  }
  
  /**
   * Get default state from backend
   */
  async getDefaultState(): Promise<CompositionStateDTO> {
    return fetchAndValidate(
      `${this.apiBase}/composition/default`,
      CompositionStateDTOSchema
    );
  }
  
  /**
   * Create initial application state
   */
  async createInitialState(): Promise<ApplicationState> {
    const composition: CompositionStateDTO = await this.getDefaultState();
    
    return {
      phase: 'upload',
      composition,
      audio: {
        rawSamples: null,
        previousMaxAmplitude: null,
        audioSessionId: null,
      },
			ui: {
				leftPanelVisible: true,
				rightPanelVisible: true,
				selectedCategory: null,
				selectedOption: null,
				currentStyleIndex: 0,
				isAutoPlaying: false,
				showHint: false,
				renderQuality: 'medium',
				activeCategory: null,
        activeSubcategory: null,
        subcategoryHistory: {},
        filterSelections: {},
        currentBackground: {
          type: 'paint',
          id: 'agreeable-gray'
        }
			},
      processing: {
        stage: 'idle',
        progress: 0
      }
    };
  }
  
  /**
   * Process state transitions (pure function)
   */
  processStateTransition(state: ApplicationState, action: Action): ApplicationState {
    switch (action.type) {
      case 'PHASE_CHANGED':
        return {
          ...state,
          phase: action.payload
        };
        
			case 'STYLE_SELECTED':
				// User-initiated style selection -> stop autoplay
				return {
					...state,
					ui: {
						...state.ui,
						currentStyleIndex: action.payload,
						isAutoPlaying: false
					}
				};

			case 'STYLE_ADVANCE':
				// Programmatic autoplay advance -> do NOT stop autoplay
				return {
					...state,
					ui: {
						...state.ui,
						currentStyleIndex: action.payload
						// do NOT touch isAutoPlaying here
					}
				};

        
      case 'AUTOPLAY_TOGGLED':
        return {
          ...state,
          ui: {
            ...state.ui,
            isAutoPlaying: action.payload
          }
        };
        
      case 'PROCESSING_UPDATE':
        return {
          ...state,
          processing: {
            ...state.processing,
            ...action.payload
          }
        };
        
      case 'DEMUCS_COMPLETED':
        return {
          ...state,
          phase: 'reveal' as const,
          composition: action.payload,
          processing: {
            stage: 'idle' as const,
            progress: 100
          }
        };
        
      case 'STATE_RESTORED':
        return { ...action.payload };
        
      case 'FILE_PROCESSING_SUCCESS': {
        // When a new file is processed, we create a completely new, clean application state.
        // This ensures no stale parameters (e.g., from a previous localStorage session) interfere.
        const newComposition = action.payload.composition;
        return {
          ...state, // We keep the top-level structure
          phase: 'discovery',
          composition: newComposition, // Use the fresh composition from the backend
          audio: {
            rawSamples: action.payload.rawSamplesForCache,
            previousMaxAmplitude: action.payload.maxAmplitudeLocal,
            audioSessionId: action.payload.audioSessionId || null,
          },
          processing: { stage: 'idle', progress: 100 },
          ui: {
            // Reset UI state to defaults for a new discovery phase
            ...state.ui,
            currentStyleIndex: 0,
            isAutoPlaying: true,
            showHint: false,
          },
        };
      }

      case 'SHOW_HINT':
        return {
          ...state,
          ui: { ...state.ui, showHint: true }
        };
        
      case 'COMPOSITION_UPDATED':
        return {
          ...state,
          composition: action.payload
        };
        
      case 'CATEGORY_SELECTED': {
        const categoryId = action.payload;
        const lastSubcategory = state.ui.subcategoryHistory[categoryId] || null;
        return {
          ...state,
          ui: {
            ...state.ui,
            activeCategory: categoryId,
            activeSubcategory: lastSubcategory,
            filterSelections: {}
          }
        };
      }
        
      case 'SUBCATEGORY_SELECTED':
        return {
          ...state,
          ui: {
            ...state.ui,
            activeCategory: action.payload.category,
            activeSubcategory: action.payload.subcategory,
            subcategoryHistory: {
              ...state.ui.subcategoryHistory,
              [action.payload.category]: action.payload.subcategory
            }
          }
        };
        
      case 'FILTER_CHANGED': {
        const key = `${action.payload.category}_${action.payload.subcategory}`;
        return {
          ...state,
          ui: {
            ...state.ui,
            filterSelections: {
              ...state.ui.filterSelections,
              [key]: {
                ...state.ui.filterSelections[key],
                [action.payload.filterId]: action.payload.selections
              }
            }
          }
        };
      }
        
      default:
        return state;
    }
  }
  
  /**
   * Persist state to localStorage (facade is the only one who touches storage)
   */
  persistState(state: ApplicationState): void {
    try {
      // Create a deep copy to avoid mutating the live state
      const stateToPersist = structuredClone(state);
      
      // Convert Float32Array to a plain array for correct JSON serialization
      if (stateToPersist.audio.rawSamples) {
        stateToPersist.audio.rawSamples = Array.from(stateToPersist.audio.rawSamples);
      }

      const serialized = JSON.stringify(stateToPersist);
      localStorage.setItem('wavedesigner_session', serialized);
    } catch (e) {
      console.warn('Failed to persist state:', e);
    }
  }
  
  /**
   * Load persisted state from localStorage
   */
  loadPersistedState(): ApplicationState | null {
    const stored = localStorage.getItem('wavedesigner_session');
    // Use the type-safe helper to parse and validate the stored data.
    // It handles JSON parsing errors and Zod validation internally.
    const restoredState = parseStoredData(stored, ApplicationStateSchema);
    
    // Always reset processing stage to idle on page load
    if (restoredState) {
      return {
        ...restoredState,
        processing: {
          stage: 'idle',
          progress: 0
        }
      };
    }
    
    return null;
  }
	
	/**
   * Deep merge persisted state onto fresh defaults
   * Preserves user customizations while adding new schema fields
   */
  mergeStates(freshDefaults: ApplicationState, persisted: ApplicationState): ApplicationState {
    // Always use fresh backend defaults for system config (not user choices)
    const systemDefaults = {
      audio_processing: freshDefaults.composition.audio_processing
    };
    
    const merge = (target: unknown, source: unknown): unknown => {
      if (typeof source !== 'object' || source === null || Array.isArray(source)) {
        return source;
      }
      
      if (typeof target !== 'object' || target === null || Array.isArray(target)) {
        return source;
      }

      const result: Record<string, unknown> = { ...(target as Record<string, unknown>) };

      for (const key of Object.keys(source)) {
        const sourceValue = (source as Record<string, unknown>)[key];
        const targetValue = result[key];

        if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
          result[key] = merge(targetValue, sourceValue);
        } else {
          result[key] = sourceValue;
        }
      }
      
      return result;
    };
    
    const merged = merge(freshDefaults, persisted) as ApplicationState;
    
    // Restore system defaults that should not come from persisted state
    return {
      ...merged,
      composition: {
        ...merged.composition,
        audio_processing: systemDefaults.audio_processing
      }
    };
  }
  
  /**
   * Get available style options from configuration
   */
  getStyleOptions(): StylePreset[] {
    return this._stylePresets;
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
  
  constructor(
    controller: ApplicationController,
    config?: Partial<AudioSlicerConfig>,
    onSliceComplete?: (result: SliceResult) => void
  ) {
    this._controller = controller;
    if (!config || config.silenceThreshold === undefined || config.silenceDuration === undefined) {
      console.error('[AudioSlicerPanel] Config missing required audio_processing values');
    }
    this._config = {
      silenceThreshold: config?.silenceThreshold ?? 0,
      silenceDuration: config?.silenceDuration ?? 0,
      removeSilence: config?.removeSilence ?? false
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
    }
    if (state?.composition?.audio_processing) {
      this._silenceEnabled = state.composition.audio_processing.remove_silence || false;
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
	
	renderEnhanceSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'audio-slicer-enhance-section';
    this._enhanceSection = section;
    section.innerHTML = `
      <div class="slicer-toggle-card" id="toggle-vocals">
        <div class="slicer-toggle-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </div>
        <div class="slicer-toggle-text">
          <div class="slicer-toggle-title">Just the Singing Voice</div>
          <div class="slicer-toggle-desc">Removes background music</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" class="slicer-isolate-checkbox" ${this._isolateVocals ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
      
      <div class="slicer-vocals-preview ${this._isolateVocals ? 'visible' : ''}">
        <button class="slicer-btn-vocals-preview" ${!this._audioBuffer ? 'disabled' : ''}>
          <svg class="slicer-preview-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          <span class="slicer-preview-label">${this._rawVocalsBuffer ? 'Preview Vocals' : 'Process & Preview'}</span>
        </button>
        <div class="slicer-vocals-status">
          <span class="slicer-status-text">${this._rawVocalsBuffer ? '✓ Cached' : ''}</span>
        </div>
      </div>
      
      <div class="slicer-toggle-card" id="toggle-silence">
        <div class="slicer-toggle-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="4" y1="8" x2="4" y2="16"/><line x1="8" y1="6" x2="8" y2="18"/>
            <line x1="12" y1="11" x2="12" y2="13"/><line x1="16" y1="6" x2="16" y2="18"/>
            <line x1="20" y1="8" x2="20" y2="16"/>
          </svg>
        </div>
        <div class="slicer-toggle-text">
          <div class="slicer-toggle-title">Clean Up Quiet Parts</div>
          <div class="slicer-toggle-desc">Tightens the waveform</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" class="slicer-silence-checkbox" ${this._silenceEnabled ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
      
      <input type="hidden" class="slicer-min-duration" value="${this._minDuration}">
      <input type="hidden" class="slicer-silence-thresh" value="${this._silenceThresh}">
      
      <div class="slicer-cta-footer">
        <button class="slicer-btn-primary slicer-btn-commit" data-demo-id="slicer_commit" style="flex:1;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          Create My Art
        </button>
      </div>
    `;
    this._cacheEnhanceElements(section);
    this._attachEnhanceListeners(section);
    this._restoreEnhanceState();
    return section;
  }
	
	renderTrimmerSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'audio-slicer-trimmer-section';
    this._trimmerSection = section;
    section.innerHTML = `
      <div class="slicer-instructions">
        <span class="slicer-instructions-number">1</span>
        <span class="slicer-instructions-text">Listen, then tap to mark your selection</span>
      </div>
      
      <div class="slicer-waveform-row">
        <button class="slicer-skip-btn slicer-btn-rewind" title="Rewind 5 seconds">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
          <span>5s</span>
        </button>
        
        <div class="slicer-waveform-wrap">
          <canvas class="slicer-waveform"></canvas>
          <div class="slicer-playhead"></div>
          <div class="slicer-selection"></div>
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
      
      <button class="slicer-play-btn" data-demo-id="slicer_play">
        <svg class="slicer-play-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        <span class="slicer-play-label">Play to Find Your Moment</span>
      </button>
      
      <div class="slicer-mark-buttons">
        <button class="slicer-mark-btn slicer-btn-mark-start" data-demo-id="slicer_start">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 3v18"/><path d="M9 12h12"/><path d="M15 6l6 6-6 6"/>
          </svg>
          <span class="slicer-mark-btn-label">Start Here</span>
          <span class="slicer-mark-btn-time">—</span>
        </button>
        <button class="slicer-mark-btn slicer-btn-mark-end" data-demo-id="slicer_end">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 3v18"/><path d="M3 12h12"/><path d="M9 6l-6 6 6 6"/>
          </svg>
          <span class="slicer-mark-btn-label">End Here</span>
          <span class="slicer-mark-btn-time">—</span>
        </button>
      </div>
      
      <div class="slicer-selection-summary">
        <div class="slicer-summary-icon">✓</div>
        <div class="slicer-summary-text">
          <span class="slicer-summary-range">0:00 → 0:00</span>
          <span class="slicer-summary-duration">(0 sec)</span>
        </div>
        <button class="slicer-summary-preview">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          Preview
        </button>
      </div>
      
      <button class="slicer-use-full"><span>or use the full song</span></button>
      
      <div class="slicer-cta-footer">
        <button class="slicer-btn-secondary" data-action="next-accordion">Make It Beautiful →</button>
        <button class="slicer-btn-primary slicer-btn-commit" data-demo-id="slicer_commit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          Create My Art
        </button>
      </div>
    `;
    this._cacheTrimmerElements(section);
    this._attachTrimmerListeners(section);
    this._restoreTrimmerState();
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
      
      <div class="slicer-cta-footer slicer-upload-footer">
        <button class="slicer-btn-secondary" data-action="next-accordion">Pick Your Moment →</button>
        <button class="slicer-btn-primary slicer-btn-commit" data-demo-id="slicer_commit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          Create My Art
        </button>
      </div>
    `;
    this._cacheUploadElements(section);
    this._attachUploadListeners(section);
    this._restoreUploadState();
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
    section.querySelector('[data-action="next-accordion"]')?.addEventListener('click', () => {
      this._controller.openNextAudioAccordion('custom');
    });
    section.querySelector('.slicer-btn-commit')?.addEventListener('click', () => this._handleCommit());
  }

  private _attachTrimmerListeners(section: HTMLElement): void {
    section.querySelector('.slicer-play-btn')?.addEventListener('click', () => this._togglePlayback());
    section.querySelector('.slicer-btn-rewind')?.addEventListener('click', () => this._seek(-5));
    section.querySelector('.slicer-btn-forward')?.addEventListener('click', () => this._seek(5));
    section.querySelector('.slicer-btn-mark-start')?.addEventListener('click', () => this._handleMarkStart());
    section.querySelector('.slicer-btn-mark-end')?.addEventListener('click', () => this._handleMarkEnd());
    section.querySelector('.slicer-use-full')?.addEventListener('click', () => this._useFullTrack());
    section.querySelector('.slicer-summary-preview')?.addEventListener('click', () => void this._preview());
    section.querySelector('[data-action="next-accordion"]')?.addEventListener('click', () => {
      this._controller.openNextAudioAccordion('slicing');
    });
    section.querySelector('.slicer-btn-commit')?.addEventListener('click', () => this._handleCommit());
    window.addEventListener('resize', this._handleResize);
  }
	
	/**
   * Get enhancements summary for accordion header display
   */
  public getEnhancementsDisplay(): string | null {
    const vocals = this._isolateCheckbox?.checked || false;
    const silence = this._silenceEnabled || false;
    
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
    return this._originalFile?.name || null;
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
    
    // Restore mark times
    this._updateMarkButtonsV2();
    
    // Restore selection overlay
    this._updateSelection();
    
    // Restore selection summary
    this._updateSelectionSummary();
  }
	
	private _restoreUploadState(): void {
    if (this._audioBuffer && this._originalFile) {
      this._dropZone?.classList.add('hidden');
      this._songLoaded?.classList.add('visible');
      if (this._songNameEl) this._songNameEl.textContent = this._originalFile.name;
      if (this._songDurationEl) this._songDurationEl.textContent = `${this._formatTime(this._audioBuffer.duration)} · Ready`;
      const footer = this._dropZone?.closest('.audio-slicer-upload-section')?.querySelector('.slicer-upload-footer') as HTMLElement;
      if (footer) footer.style.display = 'flex';
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
  
  private _initAudioContext(): void {
    if (!this._audioContext) {
      this._audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }
  
  private async _loadFile(file: File): Promise<void> {
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
      
      this._resetState();
      this._updateCommitButton();
      this._drawWaveform();
      this._controller.updateAudioAccordionValue('custom');
      this._controller.updateAudioSourceState({
        source_file: file.name,
        start_time: 0,
        end_time: this._audioBuffer!.duration
      });
      
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
    
    // Waveform
    this._ctx.fillStyle = `rgb(${waveColor})`;
    for (let i = 0; i < width; i++) {
      let min = 1, max = -1;
      for (let j = 0; j < step; j++) {
        const v = data[i * step + j] || 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const barH = Math.max(1, (max - min) * amp);
      this._ctx.fillRect(i, amp - max * amp, 1, barH);
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
    
    this._sourceNode = this._audioContext.createBufferSource();
    this._sourceNode.buffer = this._audioBuffer;
    this._sourceNode.connect(this._audioContext.destination);
    this._sourceNode.start(0, this._pausedAt);
    
    this._playStartedAt = this._audioContext.currentTime;
    this._isPlaying = true;
    this._playhead?.classList.add('visible');
    
    // Update play button (v2 style)
    const playIcon = this._container?.querySelector('.slicer-play-icon') as HTMLElement;
    const playLabel = this._container?.querySelector('.slicer-play-label') as HTMLElement;
    if (playIcon) playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    if (playLabel) playLabel.textContent = 'Pause';
    this._container?.querySelector('.slicer-play-btn')?.classList.add('playing');
    
    if (this._markStartBtn) this._markStartBtn.disabled = false;
    if (this._markEndBtn) this._markEndBtn.disabled = false;
    
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
    
    // Update play button (v2 style)
    const playIcon = this._container?.querySelector('.slicer-play-icon') as HTMLElement;
    const playLabel = this._container?.querySelector('.slicer-play-label') as HTMLElement;
    if (playIcon) playIcon.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
    if (playLabel) playLabel.textContent = 'Play to Find Your Moment';
    this._container?.querySelector('.slicer-play-btn')?.classList.remove('playing');
    
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
    
    if (this._isPlaying && this._audioBuffer && t < this._audioBuffer.duration) {
      this._animationFrame = requestAnimationFrame(() => this._updatePlayhead());
    } else if (this._audioBuffer && t >= this._audioBuffer.duration) {
      this._stop();
    }
  }
  
  private _updatePlayheadPosition(): void {
    if (!this._playhead || !this._audioBuffer) return;
    const t = this._getCurrentTime();
    const pct = (t / this._audioBuffer.duration) * 100;
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
      if (previewBtn) previewBtn.textContent = '❚❚ Pause';
      
      this._sourceNode.onended = () => {
        this._isPreviewing = false;
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
    if (this._playBtn) this._playBtn.textContent = '▶';
    
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
    const isolateVocals = this._isolateCheckbox?.checked || false;
    const useSlice = this._markStart !== null && this._markEnd !== null;
    
    // If we already have processed audio from preview, use it directly
    if (isolateVocals && (this._processedBuffer || this._rawVocalsBuffer)) {
      // Use compressed or raw depending on silence toggle
			// Prefer silence-removed buffer if enabled AND available, else use raw vocals
      const bufferToUse = (this._silenceEnabled && this._processedBuffer) 
        ? this._processedBuffer 
        : this._rawVocalsBuffer;
      if (!bufferToUse) {
        console.error('[AudioSlicerPanel] No buffer available');
        return;
      }
      const processedBlob = this._encodeWAV(bufferToUse);
      void this._controller.dispatch({
        type: 'AUDIO_COMMIT',
        payload: {
          useSlice: false,
          startTime: null,
          endTime: null,
          isolateVocals: false, // Already processed
          removeSilence: false, // Already applied if enabled
          silenceThreshold: this._silenceThresh,
          silenceMinDuration: this._minDuration,
          sliceBlob: processedBlob,
          originalFile: undefined
        }
      });
      return;
    }
    
    void this._controller.dispatch({
      type: 'AUDIO_COMMIT',
      payload: {
        useSlice,
        startTime: this._markStart,
        endTime: this._markEnd,
        isolateVocals,
        removeSilence: this._silenceEnabled,
        silenceThreshold: parseFloat((this._container?.querySelector('.slicer-silence-thresh') as HTMLInputElement)?.value || '-40'),
        silenceMinDuration: parseFloat((this._container?.querySelector('.slicer-min-duration') as HTMLInputElement)?.value || '1.0'),
        sliceBlob: useSlice ? this._createSliceBlob() : null,
        originalFile: this._originalFile ?? undefined
      }
    });
  }
	
	private async _applySilenceCompression(): Promise<void> {
    if (!this._rawVocalsBuffer) {
      console.warn('[AudioSlicerPanel] No raw vocals to compress');
      return;
    }
    
    // Read params from inputs
    const minSilenceInput = this._container?.querySelector('.slicer-min-silence') as HTMLInputElement;
    const threshInput = this._container?.querySelector('.slicer-silence-thresh') as HTMLInputElement;
    const gapInput = this._container?.querySelector('.slicer-gap-duration') as HTMLInputElement;
    
    const minDurationInput = this._container?.querySelector('.slicer-min-duration') as HTMLInputElement;
    this._minDuration = parseFloat(minDurationInput?.value || '1.0');
    this._silenceThresh = parseFloat(threshInput?.value || '-40');
    
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
  
  private _resetState(): void {
    this._markStart = null;
    this._markEnd = null;
    this._markPhase = 'start';
    this._pausedAt = 0;
    this._isPlaying = false;
    
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

