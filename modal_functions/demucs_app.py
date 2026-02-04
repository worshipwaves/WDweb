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
# Local Entrypoint for Testing
# ---------------------------------------------------------------------------
@app.local_entrypoint()
def main():
    """Test the Demucs function with a sample file."""
    print("Modal Demucs App - Test Mode")
    print("To test, upload a file to S3 and call:")
    print('  separate_vocals.remote("audio/input/test.wav", "audio/output/test_vocals.wav")')
