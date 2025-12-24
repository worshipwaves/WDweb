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
        filter_amount = params["filter_amount"]
        fallback_exp = params["fallback_exponent"]
        candidates = intent_config["exponent_candidates"]

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

        # Grid search helper
        def evaluate_exponent(exp: float) -> Tuple[float, Dict[str, Any]]:
            compressed = np.power(clean_data, exp)
            max_val = np.max(compressed)
            if max_val > 1e-9:
                compressed = compressed / max_val
            p10 = np.percentile(compressed, 10)
            p90 = np.percentile(compressed, 90)
            spread = p90 - p10
            brick_pct = np.sum(compressed > 0.95) / len(compressed)
            ghost_pct = np.sum(compressed < 0.15) / len(compressed)
            score = spread - (brick_pct * 2.0) - (ghost_pct * 1.5)
            return score, {
                "exp": exp,
                "spread": round(spread, 4),
                "brick": round(brick_pct, 4),
                "ghost": round(ghost_pct, 4),
                "score": round(score, 4)
            }
        
        # Evaluate all candidates (immutable)
        results = tuple(evaluate_exponent(exp) for exp in candidates)
        logs = tuple(log for _, log in results)
        best_score, best_exp = max(
            ((score, exp) for (score, _), exp in zip(results, candidates)),
            key=lambda x: x[0],
            default=(-float('inf'), fallback_exp)
        )

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
            "remove_silence": params["remove_silence"],
            "silence_duration": params["silence_duration"],
            "score": round(best_score, 4),
            "status": status,
            "logs": logs
        }
