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