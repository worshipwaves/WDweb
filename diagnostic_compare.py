# diagnostic_compare.py
"""
Compare web audio pipeline vs PyQt pipeline output.
Run with: python diagnostic_compare.py "path/to/audio.mp3"
"""

import sys
import numpy as np
from pathlib import Path

# Add project to path
sys.path.insert(0, str(Path(__file__).parent))

import librosa
from services.audio_processing_service import AudioProcessingService, BinningMode


def run_full_diagnostic(audio_path: str, mode: str = "speech", num_slots: int = 48):
    """Run full pipeline with detailed output at each stage."""
    
    print("=" * 70)
    print(f"DIAGNOSTIC: {Path(audio_path).name}")
    print(f"Mode: {mode} | Slots: {num_slots}")
    print("=" * 70)
    
    # Load audio
    samples, sr = librosa.load(audio_path, sr=44100, mono=True)
    print(f"\n[1] RAW AUDIO")
    print(f"    Sample rate: {sr}")
    print(f"    Duration: {len(samples)/sr:.2f}s")
    print(f"    Samples: {len(samples)}")
    print(f"    Range: [{samples.min():.4f}, {samples.max():.4f}]")
    
    # Extract 200k samples
    resampled = AudioProcessingService.extract_amplitudes(samples, 200000)
    print(f"\n[2] RESAMPLED (200k)")
    print(f"    Length: {len(resampled)}")
    print(f"    Range: [{resampled.min():.6f}, {resampled.max():.6f}]")
    print(f"    First 10: {resampled[:10].tolist()}")
    
    # Set mode params
    if mode == "speech":
        binning_mode = BinningMode.MIN_MAX
        filter_amount = 0.05
        candidates = [0.8, 0.6, 0.45, 0.35, 0.25]
    else:
        binning_mode = BinningMode.MEAN_ABSOLUTE
        filter_amount = 0.02
        candidates = [1.0, 0.9, 0.8, 0.7, 0.6]
    
    # Bin amplitudes
    min_b, max_b = AudioProcessingService.bin_amplitudes(resampled, num_slots, binning_mode)
    print(f"\n[3] BINNED ({binning_mode.value})")
    print(f"    Slots: {len(max_b)}")
    print(f"    max_b range: [{max_b.min():.6f}, {max_b.max():.6f}]")
    print(f"    max_b values: {[round(float(x), 4) for x in max_b]}")
    
    # Filter
    filtered = AudioProcessingService.filter_data(max_b, filter_amount)
    print(f"\n[4] FILTERED (amount={filter_amount})")
    print(f"    Range: [{filtered.min():.6f}, {filtered.max():.6f}]")
    print(f"    Values: {[round(float(x), 4) for x in filtered]}")
    
    # Grid search
    print(f"\n[5] GRID SEARCH")
    best_score = -float('inf')
    best_exp = candidates[0]
    
    for exp in candidates:
        test_data = np.power(filtered, exp)
        p10 = np.percentile(test_data, 10)
        p90 = np.percentile(test_data, 90)
        spread = p90 - p10
        brick_pct = np.sum(test_data > 0.95) / len(test_data)
        ghost_pct = np.sum(test_data < 0.15) / len(test_data)
        score = spread - (brick_pct * 2.0) - (ghost_pct * 1.5)
        
        marker = ""
        if score > best_score:
            best_score = score
            best_exp = exp
            marker = " <-- BEST"
        
        print(f"    Exp {exp}: Score={score:.4f} | Spread={spread:.3f} | Brick={brick_pct:.3f} | Ghost={ghost_pct:.3f}{marker}")
    
    # Final output with best exponent
    final = np.power(filtered, best_exp)
    print(f"\n[6] FINAL OUTPUT (exponent={best_exp})")
    print(f"    Range: [{final.min():.6f}, {final.max():.6f}]")
    print(f"    Values: {[round(float(x), 4) for x in final]}")
    
    # Statistics
    print(f"\n[7] STATISTICS")
    print(f"    P10: {np.percentile(final, 10):.4f}")
    print(f"    P25: {np.percentile(final, 25):.4f}")
    print(f"    P50: {np.percentile(final, 50):.4f}")
    print(f"    P75: {np.percentile(final, 75):.4f}")
    print(f"    P90: {np.percentile(final, 90):.4f}")
    print(f"    Mean: {np.mean(final):.4f}")
    print(f"    Std: {np.std(final):.4f}")
    
    # Histogram
    print(f"\n[8] DISTRIBUTION (10 bins)")
    hist, edges = np.histogram(final, bins=10, range=(0, 1))
    for i, count in enumerate(hist):
        bar = "█" * (count * 40 // max(hist)) if max(hist) > 0 else ""
        print(f"    {edges[i]:.1f}-{edges[i+1]:.1f}: {bar} ({count})")
    
    print("\n" + "=" * 70)
    
    return {
        "resampled": resampled,
        "binned": max_b,
        "filtered": filtered,
        "final": final,
        "exponent": best_exp,
        "score": best_score
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python diagnostic_compare.py <audio_file> [mode] [num_slots]")
        print("  mode: 'speech' or 'music' (default: speech)")
        print("  num_slots: integer (default: 48)")
        sys.exit(1)
    
    audio_path = sys.argv[1]
    mode = sys.argv[2] if len(sys.argv) > 2 else "speech"
    num_slots = int(sys.argv[3]) if len(sys.argv) > 3 else 48
    
    run_full_diagnostic(audio_path, mode, num_slots)