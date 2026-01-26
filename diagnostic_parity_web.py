#!/usr/bin/env python3
"""
Web App Audio Pipeline Diagnostic Script
Purpose: Generate step-by-step JSON metrics for parity comparison with PyQt App.

Usage: python diagnostic_parity_web.py <audio_file> [--slots N] [--exp X] [--scale X]
"""

import os
import sys
import json
import argparse
import numpy as np
import librosa

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from services.audio_processing_service import AudioProcessingService, BinningMode


def get_metrics(stage_name, samples, sample_rate, duration=None):
    """Generate the required DTO for a processing stage."""
    if duration is None:
        duration = len(samples) / sample_rate if sample_rate > 0 else 0.0
    
    return {
        "stage": stage_name,
        "sample_count": int(len(samples)),
        "sample_rate": int(sample_rate),
        "duration_sec": float(round(duration, 6)),
        "min": float(np.min(samples)) if len(samples) > 0 else 0.0,
        "max": float(np.max(samples)) if len(samples) > 0 else 0.0,
        "mean": float(np.mean(samples)) if len(samples) > 0 else 0.0,
        "sum": float(np.sum(samples)) if len(samples) > 0 else 0.0,
        "first_10": [float(x) for x in samples[:10]],
        "last_10": [float(x) for x in samples[-10:]]
    }


def remove_silence(audio_data, sample_rate, threshold_db, min_duration):
    """
    Silence removal matching PyQt AudioLoaderAdapter._remove_silence.
    Uses AudioProcessingService._remove_silence static method.
    """
    return AudioProcessingService._remove_silence(
        audio_data, sample_rate, threshold_db, min_duration
    )


def run_diagnostic(audio_path, num_slots=60, exponent=1.0, max_scale=15.0):
    """Run diagnostic with exact PyQt-matching parameters."""
    
    # --- 1. LOADED ---
    y, sr = librosa.load(audio_path, sr=44100)
    print(json.dumps(get_metrics("loaded", y, sr)))

    # --- 2. SILENCE REMOVED ---
    # Matching PyQt params: -40dB, 1.0s min duration
    y_no_silence = remove_silence(y, sr, threshold_db=-40.0, min_duration=1.0)
    print(json.dumps(get_metrics("silence_removed", y_no_silence, sr)))

    # --- 3. EXTRACTED 200K ---
    y_200k = AudioProcessingService.extract_amplitudes(y_no_silence, 200000)
    print(json.dumps(get_metrics("extracted_200k", y_200k, sr)))

    # --- 4. BINNED ---
    # Using MEAN_ABSOLUTE mode (standard for music)
    _, max_binned = AudioProcessingService.bin_amplitudes(
        y_200k, num_slots, BinningMode.MEAN_ABSOLUTE
    )
    print(json.dumps(get_metrics("binned", max_binned, 0)))

    # --- 5. EXPONENT APPLIED ---
    y_exp = np.power(max_binned, exponent)
    print(json.dumps(get_metrics("exponent_applied", y_exp, 0)))

    # --- 6. FINAL ---
    # Normalize 0-1 then scale to geometry max_amplitude
    max_val = np.max(y_exp) if np.max(y_exp) > 1e-9 else 1.0
    final_scaled = (y_exp / max_val) * max_scale
    print(json.dumps(get_metrics("final", final_scaled, 0)))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Web App Audio Pipeline Diagnostic")
    parser.add_argument("file", help="Path to audio file")
    parser.add_argument("--slots", type=int, default=60, help="Number of slots (default 60)")
    parser.add_argument("--exp", type=float, default=1.0, help="Exponent (default 1.0)")
    parser.add_argument("--scale", type=float, default=15.0, help="Geometry scale (default 15.0)")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.file):
        print(json.dumps({"error": f"File {args.file} not found", "stage": "failed"}))
        sys.exit(1)

    try:
        run_diagnostic(args.file, args.slots, args.exp, args.scale)
    except Exception as e:
        print(json.dumps({"error": str(e), "stage": "failed"}))
        sys.exit(1)
