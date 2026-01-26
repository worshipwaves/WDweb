import os
import subprocess
import sys
import numpy as np
import librosa
import soundfile as sf
import json
import torch

def run_locked_gpu_parity_web():
    # 1. Verification of the WebApp environment
    venv_python = sys.executable
    print(f"--- WEBAPP ENVIRONMENT CHECK ---")
    print(f"Venv Python: {venv_python}")
    print(f"Torch Version: {torch.__version__}")
    print(f"CUDA Available: {torch.cuda.is_available()}")
    
    if not torch.cuda.is_available():
        print("ERROR: WebApp venv does not see CUDA.")
        return

    print(f"Using GPU: {torch.cuda.get_device_name(0)}")

    input_file = r"C:\Users\paulj\OneDrive\Desktop\sound clips\KingOfKingsChorus.wav"
    temp_slice = "parity_temp_slice_web.wav"
    output_base = "parity_separated_web_gpu"
    
    # 2. Extract slice (47s - 76s)
    y, sr = librosa.load(input_file, sr=None, offset=47.0, duration=29.0)
    sf.write(temp_slice, y, sr)

    # 3. Force Demucs to use the GPU with the EXPLICIT flag
    cmd = [
        venv_python, "-m", "demucs",
        "-d", "cuda",
        "--two-stems", "vocals",
        "-o", output_base,
        temp_slice
    ]
    
    print(f"\n--- RUNNING WEBAPP DEMUCS GPU ---")
    print(f"Command: {' '.join(cmd)}")
    
    subprocess.run(cmd, check=True, env=os.environ)

    # 4. Process results
    vocal_stem = os.path.join(output_base, "htdemucs", "parity_temp_slice_web", "vocals.wav")
    y_vocal, _ = librosa.load(vocal_stem, sr=44100, mono=True)
    
    # Peak Normalization (1.0)
    max_abs = np.max(np.abs(y_vocal))
    y_norm = y_vocal / max_abs

    result = {
        "sample_count": len(y_norm),
        "sum_abs": float(np.sum(np.abs(y_norm))),
        "max_abs_pre_norm": float(max_abs),
        "mean": float(np.mean(y_norm))
    }

    print("\n=== FINAL WEBAPP GPU PARITY RESULTS ===")
    print(json.dumps(result, indent=2))
    print("=======================================")

if __name__ == "__main__":
    run_locked_gpu_parity_web()