# services/audio_processing_service.py
"""
RECONCILED VERSION - Combines production features with diagnostic improvements.

Key features restored from ORIGINAL:
- Time slicing (offset/duration in librosa.load)
- Demucs stem separation
- Full pipeline order: Slice -> Demucs -> Silence Removal -> Extract -> Bin -> Filter -> Exponent

Improvements kept from DIAGNOSTIC:
- np.partition in filter_data (O(n) vs O(n log n))
- analyze_and_optimize with intent_config parameter
- Parity JSON output for debugging
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
from services.geometry_service import GeometryService
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
        bit_diameter: float,
        visual_floor_pct: float
    ) -> List[float]:
        """
        Scale normalized amplitudes to physical dimensions with artistic floor clamp.
        
        Args:
            normalized_amps: 0-1 normalized amplitude values
            max_amplitude: Maximum physical amplitude (inches)
            bit_diameter: CNC bit diameter for physical safety limit
            visual_floor_pct: Minimum slot height as percentage of max_amplitude
            
        Returns:
            Scaled amplitudes with floor = max(art_floor, physical_limit)
        """
        art_floor = max_amplitude * visual_floor_pct
        physical_limit = bit_diameter * 2.0
        effective_floor = max(art_floor, physical_limit)
        return [max(amp * max_amplitude, effective_floor) for amp in normalized_amps]
    
    @staticmethod
    def filter_data(amplitudes: np.ndarray, filter_amount: float) -> np.ndarray:
        """
        Filter data by subtracting noise floor and rescaling to preserve original max.
        CRITICAL: Must run BEFORE applying exponent/compression.
        Uses np.partition for O(n) performance.
        """
        if amplitudes is None or len(amplitudes) == 0:
            return np.array([])
        if filter_amount <= 0:
            return amplitudes
        n = max(1, int(len(amplitudes) * filter_amount))
        # np.partition is O(n) vs O(n log n) for sort
        partitioned = np.partition(np.abs(amplitudes), n)
        average_noise = np.mean(partitioned[:n])
        filtered_amps = np.maximum(0, np.abs(amplitudes) - average_noise)
        max_orig = np.max(np.abs(amplitudes))
        max_filt = np.max(filtered_amps)
        if max_filt > 1e-9:
            filtered_amps = filtered_amps * (max_orig / max_filt)
        return filtered_amps    
    
    @staticmethod
    def extract_amplitudes(y: np.ndarray, num_amplitudes: int) -> np.ndarray:
        """
        Port of PyQt's _extract_amplitudes.
        Converts to mono, normalizes to [-1, 1], resamples to exactly num_amplitudes samples.
        """
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
            y_work = y_work[target_indices.astype(int)]
        else:
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
            if len(amplitudes) < num_slots * 0.8:
                return AudioProcessingService.bin_amplitudes(amplitudes, num_slots, BinningMode.MEAN_ABSOLUTE)
            
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
            samples_per_slot = len(amplitudes) / num_slots
            
            for slot_idx in range(num_slots):
                start_idx = int(round(slot_idx * samples_per_slot))
                end_idx = int(round((slot_idx + 1) * samples_per_slot))
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
                    
        # Normalize
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
        """
        Remove silence using PyQt-parity gap-merge logic.
        """
        import librosa
        
        top_db_value = -threshold_db
        
        intervals = librosa.effects.split(
            audio_data,
            top_db=top_db_value,
            frame_length=2048,
            hop_length=512
        )
        
        if len(intervals) == 0:
            return audio_data.copy()
            
        min_samples = int(min_duration * sample_rate)
        merged_intervals = []
        
        for start, end in intervals:
            if merged_intervals and start - merged_intervals[-1][1] < min_samples:
                merged_intervals = merged_intervals[:-1] + [(merged_intervals[-1][0], end)]
            else:
                merged_intervals = merged_intervals + [(start, end)]
                
        if not merged_intervals:
            return audio_data.copy()
            
        segments = [audio_data[start:end] for start, end in merged_intervals]
        return np.concatenate(segments) if segments else audio_data.copy()
        
        
    def process_audio_file(
        self,
        audio_path: str,
        state: CompositionStateDTO
    ) -> Dict[str, Any]:
        """
        Complete audio processing pipeline with slicing, demucs, and silence removal.
        
        Pipeline order: Slice -> Demucs -> Silence Removal -> Extract -> Bin -> Filter -> Exponent
        """
        import librosa
        import soundfile as sf
        
        performance_monitor.start('total_audio_processing')
        
        # Extract parameters from state
        start_time = state.audio_source.start_time if state.audio_source else 0.0
        end_time = state.audio_source.end_time if state.audio_source else 0.0
        use_stems = state.audio_source.use_stems if state.audio_source else False
        stem_choice = state.audio_source.stem_choice if state.audio_source else "vocals"
        
        performance_monitor.start('audio_slicing_and_loading')
        
        # Get target sample rate from config (44100 for PyQt parity)
        target_sr = state.audio_processing.target_sample_rate if state.audio_processing else None
        if target_sr is None:
            target_sr = 44100  # PyQt parity default
        
        # Convert to WAV if not already (eliminates decoder variance)
        if not audio_path.lower().endswith('.wav'):
            import soundfile as sf
            print(f"[PARITY-WEB] Converting {audio_path} to WAV for decoder parity...")
            y_convert, sr_convert = librosa.load(audio_path, sr=target_sr, mono=True)
            wav_path = audio_path.rsplit('.', 1)[0] + '_converted.wav'
            sf.write(wav_path, y_convert, sr_convert)
            audio_path = wav_path
            print(f"[PARITY-WEB] Converted to: {wav_path}")
        
        # ============================================================
        # STEP 1: TIME SLICING (RESTORED FROM ORIGINAL)
        # ============================================================
        working_path = audio_path
        if start_time > 0 or (end_time > 0 and end_time > start_time):
            duration = (end_time - start_time) if end_time > start_time else None
            
            try:
                # Use native sample rate if demucs will process (PyQt parity)
                # Demucs produces different output at different input sample rates
                slice_sr = None if use_stems else target_sr
                audio_data, sample_rate = librosa.load(
                    audio_path, 
                    sr=slice_sr, 
                    mono=True,
                    offset=start_time,
                    duration=duration
                )
                
                # Save slice to temp file for potential demucs processing
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
                    sf.write(tmp.name, audio_data, sample_rate)
                    working_path = tmp.name
                    
            except Exception as e:
                raise ValueError(f"Failed to slice audio: {e}")
        else:
            # Load full file (no slicing)
            try:
                audio_data, sample_rate = librosa.load(working_path, sr=target_sr, mono=True)
            except Exception as e:
                raise ValueError(f"Failed to load audio file: {e}")
                
        performance_monitor.end('audio_slicing_and_loading')
        
        # ============================================================
        # STEP 2: DEMUCS STEM SEPARATION (CONSOLIDATED - PyQt PARITY)
        # ============================================================
        if use_stems:
            
            performance_monitor.start('demucs_execution')
            
            try:
                # Import and use canonical DemucsService
                from services.demucs_service import DemucsService
                from services.config_loader import get_config_service
                
                config_service = get_config_service()
                audio_config = config_service.get_audio_processing_config()
                
                demucs_output_dir = Path(tempfile.gettempdir()) / "demucs_output"
                demucs_service = DemucsService(
                    audio_config=audio_config,
                    output_dir=demucs_output_dir
                )
                
                # PyQt parity: Demucs only separates, returns path
                vocals_path, demucs_time = demucs_service.separate_vocals(
                    input_path=Path(working_path)
                )
                
                performance_monitor.end('demucs_execution')
                
                # PyQt parity: Load at 44100Hz
                audio_data, sample_rate = librosa.load(str(vocals_path), sr=44100, mono=True)
                
                # PyQt parity: Silence removal is DECOUPLED
                # Soccer mom UI: Auto-apply for demucs output
                demucs_threshold = audio_config.demucs_silence_threshold  # -35.0
                demucs_duration = audio_config.demucs_silence_duration    # 0.3
                audio_data = self._remove_silence(audio_data, sample_rate, demucs_threshold, demucs_duration)
                
                # Clean up demucs output
                try:
                    demucs_dir = vocals_path.parent.parent
                    if demucs_dir.name in ["htdemucs", "htdemucs_ft"]:
                        shutil.rmtree(demucs_dir, ignore_errors=True)
                except:
                    pass
                    
            except Exception as e:
                performance_monitor.end('demucs_execution')
        
        # ============================================================
        # STEP 3: SILENCE REMOVAL
        # ============================================================
        if state.audio_processing and state.audio_processing.remove_silence:
            performance_monitor.start('silence_removal')
            threshold = state.audio_processing.silence_threshold
            duration_param = state.audio_processing.silence_duration
            
            audio_data = self._remove_silence(audio_data, sample_rate, threshold, duration_param)
            performance_monitor.end('silence_removal')
        
        # Clean up temp file if created
        if working_path != audio_path and os.path.exists(working_path):
            try:
                os.unlink(working_path)
            except:
                pass
        
        performance_monitor.start('amplitude_extraction_and_binning')
        
        # ============================================================
        # STEP 4: EXTRACT 200K SAMPLES
        # ============================================================
        num_raw_samples = 200000
        samples = self.extract_amplitudes(audio_data, num_raw_samples)
        
        audio_filename = os.path.basename(audio_path)
        print(f"[PARITY-WEB-DIAG] audio_input: file={audio_filename}, start={start_time}, end={end_time}, duration={end_time - start_time if end_time > start_time else 'full'}")
        print(f"[PARITY-WEB-DIAG] audio_loaded: samples={len(audio_data)}, sample_rate={sample_rate}, duration_actual={len(audio_data)/sample_rate:.3f}")
        print(f"[PARITY-WEB-DIAG] resample_target: 200000 samples")
        
        print(f"[PARITY-WEB] stage1_resampled: {len(samples)} samples, range [{np.min(samples):.3f}, {np.max(samples):.3f}], sum={np.sum(samples):.3f}")
        
        # ============================================================
        # STEP 5: BIN TO NUM_SLOTS
        # ============================================================
        num_slots = state.pattern_settings.number_slots
        
        # Get binning mode - support both attribute names for compatibility
        mode_str = "mean_abs"
        if state.audio_processing:
            # Try both attribute names
            mode_str = getattr(state.audio_processing, 'binning_mode', None) or \
                       getattr(state.audio_processing, 'binning_method', None) or \
                       "mean_abs"
        
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
        
        min_normalized, max_normalized = self.bin_amplitudes(samples, num_slots, binning_mode)
        
        print(f"[PARITY-WEB] stage2_binned: {len(max_normalized)} slots, range [{np.min(max_normalized):.3f}, {np.max(max_normalized):.3f}], sum={np.sum(max_normalized):.3f}, mode={binning_mode.name}")
        
        # ============================================================
        # STEP 6: APPLY FILTER (BEFORE EXPONENT)
        # ============================================================
        apply_filter = False
        filter_amount = 0.0
        if state.audio_processing:
            apply_filter = state.audio_processing.apply_filter or False
            filter_amount = state.audio_processing.filter_amount or 0.0
        
        if apply_filter and filter_amount > 0:
            min_normalized = self.filter_data(min_normalized, filter_amount)
            max_normalized = self.filter_data(max_normalized, filter_amount)
        
        print(f"[PARITY-WEB] stage3_filtered: range [{np.min(max_normalized):.3f}, {np.max(max_normalized):.3f}], filter={filter_amount:.3f}")
        
        # ============================================================
        # STEP 7: APPLY EXPONENT
        # ============================================================
        exponent = state.pattern_settings.amplitude_exponent
        if exponent != 1.0:
            min_normalized = np.power(np.abs(min_normalized), exponent) * np.sign(min_normalized)
            max_normalized = np.power(np.abs(max_normalized), exponent) * np.sign(max_normalized)
        
        print(f"[PARITY-WEB] stage4_exponent: range [{np.min(max_normalized):.3f}, {np.max(max_normalized):.3f}], exp={exponent}")
        
        # STAGE 5: Scale to physical dimensions (PyQt parity)
        geometry_service = GeometryService()
        geometry = geometry_service.calculate_geometries_dto(state)
        max_amplitude_local = geometry.max_amplitude_local
        true_min_radius = geometry.true_min_radius
        bit_diameter = state.pattern_settings.bit_diameter
        visual_floor_pct = state.pattern_settings.visual_floor_pct
        
        scaled_amplitudes = self.scale_and_clamp_amplitudes(
            max_normalized.tolist(),
            max_amplitude_local,
            bit_diameter,
            visual_floor_pct
        )
        scaled_amplitudes = np.array(scaled_amplitudes)
        
        floor_value = max_amplitude_local * visual_floor_pct
        scale_range = max_amplitude_local - floor_value
        print(f"[PARITY-WEB-DIAG] geometry_input: max_amplitude_local={max_amplitude_local:.3f}, true_min_radius={true_min_radius:.3f}, center_point_local={geometry.center_point_local:.3f}, bit_diameter={bit_diameter}")
        print(f"[PARITY-WEB-DIAG] scale_params: floor_pct={visual_floor_pct}, scale_range={scale_range:.3f}")
        print(f"[PARITY-WEB] stage5_scaled: range [{np.min(scaled_amplitudes):.3f}, {np.max(scaled_amplitudes):.3f}], sum={np.sum(scaled_amplitudes):.3f}")
        print(f"  first10: [{', '.join(f'{v:.3f}' for v in scaled_amplitudes[:10])}]")
        print(f"  last10:  [{', '.join(f'{v:.3f}' for v in scaled_amplitudes[-10:])}]")
        
        print(f"[PARITY-WEB] geometry: max_amp={max_amplitude_local:.3f}, true_min_r={true_min_radius:.3f}, center={geometry.center_point_local:.3f}, bit={bit_diameter}")
        
        performance_monitor.end('amplitude_extraction_and_binning')
        performance_monitor.end('total_audio_processing')
        
        # Scale min_amplitudes to physical dimensions
        scaled_min = self.scale_and_clamp_amplitudes(
            np.abs(min_normalized).tolist(),
            max_amplitude_local,
            bit_diameter,
            visual_floor_pct
        )
        
        return {
            "min_amplitudes": scaled_min,
            "max_amplitudes": scaled_amplitudes.tolist(),
            "raw_samples_for_cache": samples.tolist(),
            "max_amplitude_local": max_amplitude_local
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
        intent_config: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Runs a grid search to find the best amplitude exponent."""
        
        # Fallback to hardcoded defaults if no config provided
        if intent_config is None or mode not in intent_config:
            if mode == "speech":
                binning_mode = BinningMode.MIN_MAX
                filter_candidates = [0.05]
                fallback_filter = 0.05
                fallback_exp = 0.6
                exponent_candidates = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25]
                remove_silence = True
                silence_duration = 0.2
            else:
                binning_mode = BinningMode.MEAN_ABSOLUTE
                filter_candidates = [0.02]
                fallback_filter = 0.02
                fallback_exp = 1.0
                exponent_candidates = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25]
                remove_silence = False
                silence_duration = 0.5
        else:
            params = intent_config[mode]
            binning_mode = BinningMode(params["binning_mode"])
            filter_candidates = params["filter_candidates"]
            fallback_filter = params["fallback_filter"]
            fallback_exp = params["fallback_exponent"]
            exponent_candidates = params["exponent_candidates"]
            remove_silence = params["remove_silence"]
            silence_duration = params["silence_duration"]

        resampled_samples = AudioProcessingService.extract_amplitudes(samples, 200000)
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

        def evaluate_candidate(f_amt: float, exp: float) -> Dict[str, Any]:
            filtered = AudioProcessingService.filter_data(baseline, f_amt)
            compressed = np.power(filtered, exp)
            
            max_val = np.max(compressed)
            if max_val > 1e-9:
                compressed = compressed / max_val
            
            p10 = np.percentile(compressed, 10)
            p90 = np.percentile(compressed, 90)
            spread = p90 - p10
            brick_pct = np.sum(compressed > 0.95) / len(compressed)
            ghost_pct = np.sum(compressed < 0.2) / len(compressed)
            score = spread - (brick_pct * 2.0) - (ghost_pct * 1.75)
            
            return {
                "filter": f_amt,
                "exp": exp,
                "spread": round(spread, 4),
                "brick": round(brick_pct, 4),
                "ghost": round(ghost_pct, 4),
                "score": round(score, 4)
            }

        logs = tuple(
            evaluate_candidate(f_amt, exp)
            for f_amt in filter_candidates
            for exp in exponent_candidates
        )

        best_candidate = max(logs, key=lambda x: x['score']) if logs else None
        
        best_score = best_candidate['score'] if best_candidate else -float('inf')
        best_exp = best_candidate['exp'] if best_candidate else fallback_exp
        best_filter = best_candidate['filter'] if best_candidate else fallback_filter

        status = "success"
        if best_score < -0.1:
            best_exp = fallback_exp
            status = "fallback"

        return {
            "exponent": best_exp,
            "filter_amount": best_filter,
            "silence_threshold": rec_threshold,
            "binning_mode": binning_mode.value,
            "remove_silence": remove_silence,
            "silence_duration": silence_duration,
            "score": round(best_score, 4),
            "status": status,
            "logs": logs
        }