"""
DemucsService - Local GPU stem separation with silence compression.
Handles vocal isolation using Demucs and removes silent gaps from output.
Aligned with Desktop App logic (librosa/numpy) for mathematical parity.
"""


import sys
import subprocess
import shutil
import time
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
        self._demucs_threshold = float(audio_config.demucs_silence_threshold)
        self._demucs_duration = float(audio_config.demucs_silence_duration)
    
    def separate_vocals(
        self,
        input_path: Path
    ) -> tuple[Path, float]:
        """
        Separate vocals from audio file using Demucs.
        
        PyQt Parity: Demucs ONLY separates. Silence removal is decoupled
        and handled by the caller if needed.
        
        Args:
            input_path: Path to input audio file
            
        Returns:
            Tuple of (path to vocals WAV, processing time in seconds)
        """
        start_time = time.perf_counter()
        
        # PyQt parity: python -m demucs, CPU for determinism, no extra flags
        cmd = [
            sys.executable, "-m", "demucs",
            "--two-stems", "vocals",
            "-d", "cuda",
            "-o", str(self._output_dir),
            str(input_path)
        ]
        print(f"[DemucsService] Executing: {' '.join(cmd)}")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            print(f"[DemucsService] STDERR: {result.stderr}")
            print(f"[DemucsService] STDOUT: {result.stdout}")
            raise subprocess.CalledProcessError(
                result.returncode, cmd, result.stdout, result.stderr
            )
        
        demucs_time = time.perf_counter() - start_time
        
        stem_name = input_path.stem
        vocals_path = self._output_dir / "htdemucs" / stem_name / "vocals.wav"
        
        if not vocals_path.exists():
            vocals_path_ft = self._output_dir / "htdemucs_ft" / stem_name / "vocals.wav"
            if vocals_path_ft.exists():
                vocals_path = vocals_path_ft
            else:
                raise FileNotFoundError(f"Demucs output not found: {vocals_path}")
        
        print(f"[DemucsService] Demucs complete: {demucs_time:.1f}s, output={vocals_path}")
        
        # PARITY DIAGNOSTIC: Log post-demucs audio state before any further processing
        y_demucs, sr_demucs = librosa.load(str(vocals_path), sr=None, mono=True)
        print(f"[PARITY-WEB-DEMUCS] post_demucs: samples={len(y_demucs)}, duration={len(y_demucs)/sr_demucs:.3f}s, range=[{np.min(y_demucs):.3f}, {np.max(y_demucs):.3f}], sum={np.sum(y_demucs):.3f}")
        
        # PyQt parity: Return path only - caller handles silence removal
        return vocals_path, demucs_time
    
    def _compress_silence(self, vocals_path: Path) -> Path:
        """
        Remove silent gaps from vocals using config defaults.
        """
        # Use native sample rate for PyQt parity (min_duration conversion depends on actual SR)
        y, sr = librosa.load(str(vocals_path), sr=None, mono=True)
        
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
        # PyQt parity: Force 44100 Hz to ensure min_samples calculation matches
        y, sr = librosa.load(str(input_path), sr=44100, mono=True)
        
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
        
        # PARITY DIAGNOSTIC: Log post-silence audio state from actual file
        y_after, sr_after = librosa.load(str(output_path), sr=None, mono=True)
        removed_seconds = original_duration - (len(y_after) / sr_after)
        print(f"[PARITY-WEB-SILENCE] post_silence: samples={len(y_after)}, duration={len(y_after)/sr_after:.3f}s, range=[{np.min(y_after):.3f}, {np.max(y_after):.3f}], sum={np.sum(y_after):.3f}")
        print(f"[PARITY-WEB-SILENCE] removed: {removed_seconds:.3f}s")
        
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
        top_db_value = -threshold_db
        print(f"[PARITY-SILENCE] Input: samples={len(y)}, sr={sr}, threshold_db={threshold_db}, top_db={top_db_value}, min_duration={min_duration}")
        print(f"[PARITY-SILENCE] frame_length={self._frame_length}, hop_length={self._hop_length}")
        
        intervals = librosa.effects.split(
            y,
            top_db=top_db_value,
            frame_length=self._frame_length,
            hop_length=self._hop_length
        )
        
        print(f"[PARITY-SILENCE] Raw intervals detected: {len(intervals)}")
        if len(intervals) >= 3:
            print(f"[PARITY-SILENCE] First 3: {intervals[:3].tolist()}")
            print(f"[PARITY-SILENCE] Last 3: {intervals[-3:].tolist()}")
        
        if len(intervals) == 0:
            return y
            
        min_samples = int(min_duration * sr)
        merged_intervals = []
        
        for start, end in intervals:
            # PyQt parity: Only merge gaps, never discard short sounds
            if merged_intervals and start - merged_intervals[-1][1] < min_samples:
                # Create new list with updated last element (Immutability: No assignment)
                last_start = merged_intervals[-1][0]
                merged_intervals = merged_intervals[:-1] + [(last_start, end)]
            else:
                # Create new list with appended element (Immutability: No .append)
                merged_intervals = merged_intervals + [(start, end)]
                
        if not merged_intervals:
            return y
        
        min_samples = int(min_duration * sr)
        print(f"[PARITY-SILENCE] min_samples={min_samples}")
        print(f"[PARITY-SILENCE] Merged intervals: {len(merged_intervals)}")
        if len(merged_intervals) >= 3:
            print(f"[PARITY-SILENCE] First 3 merged: {merged_intervals[:3]}")
            print(f"[PARITY-SILENCE] Last 3 merged: {merged_intervals[-3:]}")
            
        # List comprehension (Immutability: No .append)
        non_silent_parts = [y[start:end] for start, end in merged_intervals]
        
        total_samples = sum(end - start for start, end in merged_intervals)
        print(f"[PARITY-SILENCE] Total samples after concat: {total_samples}, duration: {total_samples/sr:.4f}s")
            
        return np.concatenate(non_silent_parts) if non_silent_parts else y

    def cleanup(self, stem_name: str) -> None:
        """Remove temporary files for a processed track."""
        track_dir = self._output_dir / "htdemucs" / stem_name
        if track_dir.exists():
            shutil.rmtree(track_dir)
        
        track_dir_ft = self._output_dir / "htdemucs_ft" / stem_name
        if track_dir_ft.exists():
            shutil.rmtree(track_dir_ft)