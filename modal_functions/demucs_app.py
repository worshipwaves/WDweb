"""
Modal Demucs App - GPU-accelerated vocal isolation for WaveDesigner.

Deployment:
    modal deploy modal/demucs_app.py

Test locally:
    modal run modal/demucs_app.py
"""

import modal

# ---------------------------------------------------------------------------
# Image Definition
# ---------------------------------------------------------------------------
demucs_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install(
        "torch==2.1.0",
        "torchaudio==2.1.0",
        "demucs==4.0.1",
        "boto3==1.34.108",
        "soundfile==0.12.1",
        "numpy==1.26.4",
        "librosa==0.10.2",
    )
)

app = modal.App("wavedesigner-demucs", image=demucs_image)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
S3_BUCKET = "wave-designer"
S3_REGION = "us-east-2"
AUDIO_PREFIX = "audio"

# ---------------------------------------------------------------------------
# Demucs Function
# ---------------------------------------------------------------------------
@app.function(
    gpu="A10G",
    timeout=600,
    secrets=[modal.Secret.from_name("aws-credentials")],
    enable_memory_snapshot=True,
)
def separate_vocals(input_s3_key: str, output_s3_key: str) -> dict:
    """
    Separate vocals from audio file using Demucs on A10G GPU.
    
    Args:
        input_s3_key: S3 key for input audio (e.g., "audio/input/abc123.wav")
        output_s3_key: S3 key for output vocals (e.g., "audio/output/abc123_vocals.wav")
    
    Returns:
        dict with status, processing_time, and output_key
    """
    import os
    import time
    import tempfile
    import subprocess
    from pathlib import Path
    import boto3
    import soundfile as sf
    import numpy as np
    
    start_time = time.perf_counter()
    
    # Initialize S3 client
    s3 = boto3.client(
        "s3",
        region_name=S3_REGION,
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )
    
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        input_path = tmpdir / "input.wav"
        output_dir = tmpdir / "demucs_output"
        output_dir.mkdir()
        
        # Download input from S3
        print(f"[Modal] Downloading s3://{S3_BUCKET}/{input_s3_key}")
        s3.download_file(S3_BUCKET, input_s3_key, str(input_path))
        
        # Run Demucs - PyQt parity flags
        cmd = [
            "python", "-m", "demucs",
            "--two-stems", "vocals",
            "-d", "cuda",
            "-o", str(output_dir),
            str(input_path),
        ]
        print(f"[Modal] Executing: {' '.join(cmd)}")
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"[Modal] STDERR: {result.stderr}")
            raise RuntimeError(f"Demucs failed: {result.stderr}")
        
        # Locate vocals output
        vocals_path = output_dir / "htdemucs" / "input" / "vocals.wav"
        if not vocals_path.exists():
            # Try alternate model output path
            vocals_path = output_dir / "htdemucs_ft" / "input" / "vocals.wav"
        
        if not vocals_path.exists():
            raise FileNotFoundError(f"Vocals output not found in {output_dir}")
        
        # Read and verify output
        y, sr = sf.read(str(vocals_path))
        print(f"[Modal] Output: {len(y)} samples, {sr} Hz, duration={len(y)/sr:.2f}s")
        
        # Upload result to S3
        print(f"[Modal] Uploading to s3://{S3_BUCKET}/{output_s3_key}")
        s3.upload_file(str(vocals_path), S3_BUCKET, output_s3_key)
        
        processing_time = time.perf_counter() - start_time
        print(f"[Modal] Complete in {processing_time:.1f}s")
        
        return {
            "status": "completed",
            "processing_time": round(processing_time, 2),
            "output_key": output_s3_key,
            "sample_count": len(y),
            "sample_rate": sr,
        }


@app.function(
    secrets=[modal.Secret.from_name("aws-credentials")],
)
def generate_presigned_urls(input_key: str, output_key: str, expiration: int = 3600) -> dict:
    """
    Generate presigned URLs for S3 upload/download.
    
    Args:
        input_key: S3 key for upload destination
        output_key: S3 key for download source (after processing)
        expiration: URL expiration in seconds
    
    Returns:
        dict with upload_url and download_url
    """
    import os
    import boto3
    
    s3 = boto3.client(
        "s3",
        region_name=S3_REGION,
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )
    
    upload_url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": S3_BUCKET, "Key": input_key, "ContentType": "audio/wav"},
        ExpiresIn=expiration,
    )
    
    download_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": output_key},
        ExpiresIn=expiration,
    )
    
    return {
        "upload_url": upload_url,
        "download_url": download_url,
        "input_key": input_key,
        "output_key": output_key,
    }

# ---------------------------------------------------------------------------
# Helpers (called from within Modal functions — imports deferred to call time)
# ---------------------------------------------------------------------------
def _extract_samples(audio_path: str, target_samples: int = 200000) -> tuple:
    """Matches router._extract_samples_for_cache exactly."""
    import librosa
    y, sr = librosa.load(audio_path, sr=44100, mono=True)
    duration = float(len(y) / sr)
    if len(y) > target_samples:
        step = len(y) / target_samples
        indices = [int(i * step) for i in range(target_samples)]
        samples = [float(y[i]) for i in indices]
    else:
        samples = [float(s) for s in y]
    return samples, duration


def _compress_silence(audio_path: str, threshold_db: float, min_duration: float) -> str:
    """Matches DemucsService._apply_silence_removal_logic exactly."""
    import librosa
    import soundfile as sf
    import numpy as np
    from pathlib import Path

    y, sr = librosa.load(audio_path, sr=44100, mono=True)
    original_dur = len(y) / sr

    top_db = abs(threshold_db)
    intervals = librosa.effects.split(y, top_db=top_db, frame_length=2048, hop_length=512)

    if len(intervals) == 0:
        return audio_path

    min_samples = int(min_duration * sr)
    merged = []
    for s, e in intervals:
        if merged and s - merged[-1][1] < min_samples:
            merged[-1] = (merged[-1][0], e)
        else:
            merged.append((s, e))

    if not merged:
        return audio_path

    segments = [y[s:e] for s, e in merged]
    processed = np.concatenate(segments) if segments else y

    print(f"[Modal] Silence compression: {original_dur:.2f}s -> {len(processed)/sr:.2f}s")

    output_path = str(Path(audio_path).parent / "compressed.wav")
    sf.write(output_path, processed, sr)
    return output_path


# ---------------------------------------------------------------------------
# Audio Loading (CPU only — for /optimize and /audio/process offloading)
# ---------------------------------------------------------------------------
@app.function(cpu=2, memory=4096, timeout=120)
def remote_load_audio(file_bytes: bytes, sr: int = 44100, target_samples: int = 200000) -> dict:
    """
    Load audio and return normalized amplitude samples.
    Port of AudioProcessingService.extract_amplitudes.
    """
    import tempfile
    from pathlib import Path
    import numpy as np
    import librosa

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(file_bytes)
        f.flush()
        tmp_path = f.name

    try:
        y, sample_rate = librosa.load(tmp_path, sr=sr, mono=True)
        duration = float(len(y) / sample_rate)

        # Normalize to [-1, 1] (matches extract_amplitudes)
        max_abs = np.max(np.abs(y))
        if max_abs > 1e-9:
            y = y / max_abs
        else:
            y = np.zeros_like(y)

        # Resample to target count (matches extract_amplitudes np.interp path)
        current_len = len(y)
        if current_len != target_samples and current_len > 0:
            target_indices = np.linspace(0, current_len - 1, target_samples)
            y = np.interp(target_indices, np.arange(current_len), y)

        return {
            "samples": y.tolist(),
            "duration": duration,
            "sample_rate": sample_rate,
        }
    finally:
        Path(tmp_path).unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Full Process-Commit Pipeline (GPU — slice + Demucs + silence + extraction)
# ---------------------------------------------------------------------------
@app.function(
    gpu="A10G",
    timeout=600,
    secrets=[modal.Secret.from_name("aws-credentials")],
    enable_memory_snapshot=True,
)
def remote_process_pipeline(
    file_bytes: bytes,
    isolate_vocals: bool = True,
    remove_silence: bool = False,
    silence_threshold: float = -40.0,
    silence_min_duration: float = 1.0,
    demucs_silence_threshold: float = -35.0,
    demucs_silence_duration: float = 0.3,
) -> dict:
    """
    Full process-commit pipeline on Modal GPU.
    Input: pre-sliced audio bytes (Render handles slicing).
    Returns dict matching ProcessedAudioResponse fields.
    """
    import time
    import base64
    import tempfile
    import subprocess
    from pathlib import Path

    start = time.perf_counter()

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        input_path = tmpdir / "input.wav"
        input_path.write_bytes(file_bytes)

        # Original samples (pre-demucs) for cache
        raw_samples_original, duration_original = _extract_samples(str(input_path))

        demucs_time = 0.0

        if isolate_vocals:
            # Demucs separation
            output_dir = tmpdir / "demucs_output"
            output_dir.mkdir()
            cmd = [
                "python", "-m", "demucs",
                "--two-stems", "vocals",
                "-d", "cuda",
                "-o", str(output_dir),
                str(input_path),
            ]
            print(f"[Modal] Demucs: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"[Modal] STDERR: {result.stderr}")
                raise RuntimeError(f"Demucs failed: {result.stderr}")

            vocals_path = output_dir / "htdemucs" / "input" / "vocals.wav"
            if not vocals_path.exists():
                vocals_path = output_dir / "htdemucs_ft" / "input" / "vocals.wav"
            if not vocals_path.exists():
                raise FileNotFoundError(f"Vocals not found in {output_dir}")

            demucs_time = time.perf_counter() - start

            # Silence removal (always for demucs path)
            output_path = _compress_silence(
                str(vocals_path),
                threshold_db=demucs_silence_threshold,
                min_duration=demucs_silence_duration,
            )
        elif remove_silence:
            output_path = _compress_silence(
                str(input_path),
                threshold_db=silence_threshold,
                min_duration=silence_min_duration,
            )
        else:
            output_path = str(input_path)

        # Processed samples for cache
        raw_samples, duration_processed = _extract_samples(output_path)

        # Encode audio
        with open(output_path, "rb") as f:
            audio_base64 = base64.b64encode(f.read()).decode("utf-8")

        total = time.perf_counter() - start
        print(f"[Modal] Pipeline complete: {total:.1f}s (demucs: {demucs_time:.1f}s)")

        return {
            "audio_base64": audio_base64,
            "raw_samples": raw_samples,
            "raw_samples_original": raw_samples_original,
            "duration": duration_processed,
            "duration_original": duration_original,
            "demucs_time": round(demucs_time, 2),
        }    
    
# ---------------------------------------------------------------------------
# Warmup Function
# ---------------------------------------------------------------------------
@app.function(
    gpu="A10G",
    timeout=30,
    secrets=[modal.Secret.from_name("aws-credentials")],
    enable_memory_snapshot=True,
)
def ping() -> dict:
    """Lightweight warmup function - spins up GPU container without processing."""
    import torch
    gpu_available = torch.cuda.is_available()
    gpu_name = torch.cuda.get_device_name(0) if gpu_available else "none"
    return {"status": "warm", "gpu": gpu_name}    

# ---------------------------------------------------------------------------
# Local Entrypoint for Testing
# ---------------------------------------------------------------------------
@app.local_entrypoint()
def main():
    """Test the Demucs function with a sample file."""
    print("Modal Demucs App - Test Mode")
    print("To test, upload a file to S3 and call:")
    print('  separate_vocals.remote("audio/input/test.wav", "audio/output/test_vocals.wav")')
