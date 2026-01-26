#!/usr/bin/env python3
"""
Web App Audio Diagnostic - PyQt Parity Test
Matches exact logic from PyQt's diagnostic_audio.py

CRITICAL: Uses identical algorithms to PyQt:
1. Normalization: y = y / np.max(np.abs(y))
2. Silence removal: librosa.effects.split(top_db=35) + np.concatenate
3. Resampling: np.linspace().astype(int) (nearest neighbor)
"""

import sys
import json
import numpy as np
import librosa

# Version reporting
try:
    import soxr
    soxr_version = soxr.__version__
except ImportError:
    soxr_version = "NOT_INSTALLED"


def get_metrics(stage_name, samples):
    """Generate metrics dict matching PyQt format."""
    return {
        "stage": stage_name,
        "sample_count": int(len(samples)),
        "min": float(np.min(samples)),
        "max": float(np.max(samples)),
        "mean": float(np.mean(samples)),
        "first_5": [float(x) for x in samples[:5]]
    }


def run_parity_diagnostic(audio_path):
    """
    Run audio pipeline diagnostic matching PyQt's exact logic.
    
    Pipeline order (per Master Brief v3.0):
    1. Load audio at 44100 Hz, mono
    2. Peak normalize to 1.0 (BEFORE silence removal)
    3. Silence removal at -35dB
    4. Resample to 200k samples (nearest neighbor)
    """
    
    # 1. Version Check
    print(f"DEBUG: versions: numpy={np.__version__}, librosa={librosa.__version__}, soxr={soxr_version}")
    
    # 2. LOAD & PEAK NORMALIZE (Master Brief Requirement)
    y, sr = librosa.load(audio_path, sr=44100, mono=True)
    y = y / np.max(np.abs(y))  # CRITICAL: Must happen before silence removal
    print(json.dumps(get_metrics("normalized_peak", y)))
    
    # 3. SILENCE REMOVAL (-35dB for Stems, matching PyQt)
    # Using librosa.effects.split with top_db=35 (which is -35dB threshold)
    intervals = librosa.effects.split(y, top_db=35)
    
    if len(intervals) > 0:
        y_trimmed = np.concatenate([y[start:end] for start, end in intervals])
    else:
        y_trimmed = y.copy()
    
    print(json.dumps(get_metrics("silence_removed", y_trimmed)))
    
    # 4. RESAMPLE TO 200K (Nearest Neighbor - matching PyQt)
    target_size = 200000
    indices = np.linspace(0, len(y_trimmed) - 1, target_size).astype(int)
    y_200k = y_trimmed[indices]
    print(json.dumps(get_metrics("resampled_200k", y_200k)))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python diagnostic_audio_web_parity.py <file.wav>")
        print("")
        print("This script runs the audio pipeline diagnostic matching PyQt's exact logic.")
        print("Provide the same audio file used in PyQt diagnostic for comparison.")
        sys.exit(1)
    else:
        run_parity_diagnostic(sys.argv[1])
