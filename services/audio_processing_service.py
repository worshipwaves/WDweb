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