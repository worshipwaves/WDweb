#!/usr/bin/env python3
"""
Test script for audio slicing fix verification.
Sends request directly to /api/audio/process-commit with 47-76s parameters.

Usage: python test_slice_fix.py <path_to_KingOfKingsChorus.wav>
"""

import sys
import requests
import tempfile
import librosa
import numpy as np
from pathlib import Path


def test_slice_fix(audio_path: str, start_time: float = 47.0, end_time: float = 76.0):
    """
    Test that backend correctly slices audio at specified times.
    
    Expected behavior after fix:
    - Backend receives 80s file + start_time=47, end_time=76
    - Backend returns 29s sliced file
    - Returned file contains audio from original 47-76s segment
    """
    audio_path = Path(audio_path)
    if not audio_path.exists():
        print(f"ERROR: File not found: {audio_path}")
        return False
    
    # Load original for reference
    print(f"[1] Loading original file: {audio_path.name}")
    y_original, sr = librosa.load(str(audio_path), sr=None, mono=True)
    original_duration = len(y_original) / sr
    print(f"    Duration: {original_duration:.2f}s, Sample rate: {sr}")
    
    # Extract reference segment (what we expect to get back)
    print(f"\n[2] Extracting reference segment: {start_time}s - {end_time}s")
    y_reference, _ = librosa.load(str(audio_path), sr=None, mono=True,
                                   offset=start_time, duration=end_time - start_time)
    ref_duration = len(y_reference) / sr
    ref_sum = float(np.sum(np.abs(y_reference)))
    print(f"    Reference duration: {ref_duration:.2f}s")
    print(f"    Reference abs sum: {ref_sum:.4f}")
    
    # Send to backend
    print(f"\n[3] Sending to /api/audio/process-commit")
    print(f"    start_time={start_time}, end_time={end_time}")
    
    with open(audio_path, 'rb') as f:
        files = {'file': (audio_path.name, f, 'audio/wav')}
        data = {
            'isolate_vocals': 'false',
            'remove_silence': 'false',
            'silence_threshold': '-40.0',
            'silence_min_duration': '1.0',
            'start_time': str(start_time),
            'end_time': str(end_time)
        }
        
        try:
            response = requests.post(
                'http://localhost:8000/api/audio/process-commit',
                files=files,
                data=data,
                timeout=60
            )
        except requests.exceptions.ConnectionError:
            print("    ERROR: Cannot connect to backend. Is it running on localhost:8000?")
            return False
    
    if response.status_code != 200:
        print(f"    ERROR: Backend returned {response.status_code}")
        print(f"    Response: {response.text[:500]}")
        return False
    
    print(f"    Response: {response.status_code} OK")
    
    # Save and analyze returned audio
    print(f"\n[4] Analyzing returned audio")
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
        tmp.write(response.content)
        tmp_path = tmp.name
    
    y_returned, sr_returned = librosa.load(tmp_path, sr=None, mono=True)
    returned_duration = len(y_returned) / sr_returned
    returned_sum = float(np.sum(np.abs(y_returned)))
    
    print(f"    Returned duration: {returned_duration:.2f}s")
    print(f"    Returned abs sum: {returned_sum:.4f}")
    
    # Cleanup
    Path(tmp_path).unlink()
    
    # Verify results
    print(f"\n[5] Verification")
    expected_duration = end_time - start_time
    duration_match = abs(returned_duration - expected_duration) < 0.5
    
    # Compare audio content (should be very close if same segment)
    if len(y_returned) == len(y_reference):
        correlation = np.corrcoef(y_returned, y_reference)[0, 1]
        content_match = correlation > 0.99
        print(f"    Correlation with reference: {correlation:.6f}")
    else:
        # Resample to compare
        min_len = min(len(y_returned), len(y_reference))
        correlation = np.corrcoef(y_returned[:min_len], y_reference[:min_len])[0, 1]
        content_match = correlation > 0.95
        print(f"    Correlation with reference (truncated): {correlation:.6f}")
    
    print(f"    Duration match: {duration_match} (expected ~{expected_duration}s, got {returned_duration:.2f}s)")
    print(f"    Content match: {content_match}")
    
    # Final verdict
    print(f"\n{'='*60}")
    if duration_match and content_match:
        print("PASS: Backend correctly sliced audio at 47-76s")
        return True
    elif returned_duration > 70:
        print("FAIL: Backend returned full file (slicing not applied)")
        print("      Check that start_time/end_time are being used in process-commit")
        return False
    elif not content_match:
        print("FAIL: Duration correct but content doesn't match 47-76s segment")
        print("      Backend may be slicing wrong portion")
        return False
    else:
        print(f"FAIL: Unexpected result")
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_slice_fix.py <path_to_audio.wav>")
        print("       python test_slice_fix.py <path> <start_time> <end_time>")
        sys.exit(1)
    
    audio_path = sys.argv[1]
    start = float(sys.argv[2]) if len(sys.argv) > 2 else 47.0
    end = float(sys.argv[3]) if len(sys.argv) > 3 else 76.0
    
    success = test_slice_fix(audio_path, start, end)
    sys.exit(0 if success else 1)
