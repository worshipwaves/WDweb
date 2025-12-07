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