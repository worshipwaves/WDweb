"""
Modal Audio Service - Client wrapper for Modal Demucs processing.

Handles job submission, status polling, and S3 coordination.
"""

import os
import uuid
import time
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field
from enum import Enum
import boto3
from botocore.config import Config
import modal


class JobStatus(Enum):
    PENDING = "pending"
    UPLOADING = "uploading"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class DemucsJob:
    job_id: str
    status: JobStatus
    input_key: str
    output_key: str
    upload_url: Optional[str] = None
    download_url: Optional[str] = None
    processing_time: Optional[float] = None
    error_message: Optional[str] = None
    created_at: float = field(default_factory=time.time)


class ModalAudioService:
    """
    Client service for Modal-based Demucs processing.
    
    Flow:
    1. create_job() - Generate job ID and presigned URLs
    2. Client uploads audio to upload_url
    3. submit_job() - Trigger Modal function
    4. poll_status() - Check completion
    5. Client downloads result from download_url
    """
    
    S3_BUCKET = "wave-designer"
    S3_REGION = "us-east-2"
    AUDIO_PREFIX = "audio"
    
    def __init__(self):
        self._jobs: dict[str, DemucsJob] = {}
        self._modal_app = None
        self._s3_client = None
    
    def _get_s3_client(self):
        """Lazy-initialize S3 client."""
        if self._s3_client is None:
            self._s3_client = boto3.client(
                "s3",
                region_name=self.S3_REGION,
                config=Config(signature_version="s3v4"),
            )
        return self._s3_client
    
    def create_job(self) -> DemucsJob:
        """
        Create a new Demucs job with presigned URLs for upload/download.
        
        Returns:
            DemucsJob with upload_url for client to PUT audio file
        """
        job_id = str(uuid.uuid4())
        input_key = f"{self.AUDIO_PREFIX}/input/{job_id}.wav"
        output_key = f"{self.AUDIO_PREFIX}/output/{job_id}_vocals.wav"
        
        s3 = self._get_s3_client()
        
        # Generate presigned upload URL
        upload_url = s3.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self.S3_BUCKET,
                "Key": input_key,
                "ContentType": "audio/wav",
            },
            ExpiresIn=3600,
        )
        
        # Generate presigned download URL (for after processing)
        download_url = s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self.S3_BUCKET,
                "Key": output_key,
            },
            ExpiresIn=3600,
        )
        
        job = DemucsJob(
            job_id=job_id,
            status=JobStatus.PENDING,
            input_key=input_key,
            output_key=output_key,
            upload_url=upload_url,
            download_url=download_url,
        )
        
        self._jobs[job_id] = job
        return job
    
    def submit_job(self, job_id: str) -> DemucsJob:
        """
        Submit job to Modal for processing.
        
        Call this AFTER client has uploaded audio to upload_url.
        
        Args:
            job_id: Job ID from create_job()
        
        Returns:
            Updated DemucsJob with processing status
        """
        if job_id not in self._jobs:
            raise ValueError(f"Unknown job ID: {job_id}")
        
        job = self._jobs[job_id]
        
        # Verify input file exists in S3
        s3 = self._get_s3_client()
        try:
            s3.head_object(Bucket=self.S3_BUCKET, Key=job.input_key)
        except s3.exceptions.ClientError:
            job.status = JobStatus.FAILED
            job.error_message = "Input file not found in S3. Upload failed?"
            return job
        
        job.status = JobStatus.PROCESSING
        
        # Call Modal function asynchronously
        try:
            # Import Modal function
            import modal
            separate_vocals = modal.Function.from_name("wavedesigner-demucs", "separate_vocals")
            
            # Spawn async call
            call = separate_vocals.spawn(job.input_key, job.output_key)
            
            # Store call ID for status polling
            job._modal_call_id = call.object_id
            
        except Exception as e:
            job.status = JobStatus.FAILED
            job.error_message = str(e)
        
        return job
    
    def submit_job_sync(self, job_id: str, timeout: int = 300) -> DemucsJob:
        """
        Submit job and wait for completion (synchronous).
        
        Args:
            job_id: Job ID from create_job()
            timeout: Maximum wait time in seconds
        
        Returns:
            Completed DemucsJob
        """
        if job_id not in self._jobs:
            raise ValueError(f"Unknown job ID: {job_id}")
        
        job = self._jobs[job_id]
        
        # Verify input file exists in S3
        s3 = self._get_s3_client()
        try:
            s3.head_object(Bucket=self.S3_BUCKET, Key=job.input_key)
        except Exception:
            job.status = JobStatus.FAILED
            job.error_message = "Input file not found in S3. Upload failed?"
            return job
        
        job.status = JobStatus.PROCESSING
        
        try:
            # Import and call Modal function synchronously
            import modal
            separate_vocals = modal.Function.from_name("wavedesigner-demucs", "separate_vocals")
            
            result = separate_vocals.remote(job.input_key, job.output_key)
            
            job.status = JobStatus.COMPLETED
            job.processing_time = result.get("processing_time")
            
        except Exception as e:
            job.status = JobStatus.FAILED
            job.error_message = str(e)
        
        return job
    
    def get_job_status(self, job_id: str) -> Optional[DemucsJob]:
        """Get current status of a job."""
        return self._jobs.get(job_id)
    
    def upload_file_to_job(self, job_id: str, file_path: Path) -> bool:
        """
        Upload a local file to the job's S3 input location.
        
        Alternative to client-side presigned URL upload.
        
        Args:
            job_id: Job ID
            file_path: Local file path
        
        Returns:
            True if upload succeeded
        """
        if job_id not in self._jobs:
            raise ValueError(f"Unknown job ID: {job_id}")
        
        job = self._jobs[job_id]
        s3 = self._get_s3_client()
        
        try:
            s3.upload_file(str(file_path), self.S3_BUCKET, job.input_key)
            job.status = JobStatus.UPLOADING
            return True
        except Exception as e:
            job.status = JobStatus.FAILED
            job.error_message = f"Upload failed: {e}"
            return False
    
    def download_result(self, job_id: str, output_path: Path) -> bool:
        """
        Download processed vocals to local file.
        
        Args:
            job_id: Job ID
            output_path: Local destination path
        
        Returns:
            True if download succeeded
        """
        if job_id not in self._jobs:
            raise ValueError(f"Unknown job ID: {job_id}")
        
        job = self._jobs[job_id]
        
        if job.status != JobStatus.COMPLETED:
            return False
        
        s3 = self._get_s3_client()
        
        try:
            s3.download_file(self.S3_BUCKET, job.output_key, str(output_path))
            return True
        except Exception:
            return False
            
    def load_audio_remote(self, file_bytes: bytes, sr: int = 44100, target_samples: int = 200000) -> dict:
        """Send audio to Modal for librosa.load + extract_amplitudes. Returns 200K samples."""
        import modal
        fn = modal.Function.from_name("wavedesigner-demucs", "remote_load_audio")
        return fn.remote(file_bytes, sr=sr, target_samples=target_samples)

    def process_pipeline_remote(self, file_bytes: bytes, **kwargs) -> dict:
        """Send audio to Modal for full process-commit pipeline. Returns ProcessedAudioResponse fields."""
        import modal
        fn = modal.Function.from_name("wavedesigner-demucs", "remote_process_pipeline")
        return fn.remote(file_bytes, **kwargs)        
            
            
    async def warmup(self) -> None:
        """Ping Modal to warm up container."""
        try:
            import modal
            ping = modal.Function.from_name("wavedesigner-demucs", "ping")
            ping.spawn()
            print("[ModalAudioService] Warmup triggered")
        except Exception as e:
            print(f"[ModalAudioService] Warmup failed: {e}")
            
    
    def cleanup_job(self, job_id: str) -> None:
        """
        Delete S3 files for a completed job.
        
        Call after client has downloaded result.
        """
        if job_id not in self._jobs:
            return
        
        job = self._jobs[job_id]
        s3 = self._get_s3_client()
        
        try:
            s3.delete_object(Bucket=self.S3_BUCKET, Key=job.input_key)
            s3.delete_object(Bucket=self.S3_BUCKET, Key=job.output_key)
        except Exception:
            pass  # Best effort cleanup
        
        del self._jobs[job_id]


# Singleton instance
_modal_service: Optional[ModalAudioService] = None


def get_modal_audio_service() -> ModalAudioService:
    """Get or create the Modal audio service singleton."""
    global _modal_service
    if _modal_service is None:
        _modal_service = ModalAudioService()
    return _modal_service
