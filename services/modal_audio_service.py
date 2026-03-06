"""
Modal Audio Service - Client wrapper for Modal audio processing.

Provides methods for remote audio loading, Demucs pipeline, and warmup.
"""

from typing import Optional


class ModalAudioService:
    """
    Client service for Modal-based audio processing.
    
    Methods:
        load_audio_remote: Offload librosa.load + extract_amplitudes to Modal CPU
        process_pipeline_remote: Full Demucs + silence + extraction on Modal GPU
        warmup: Pre-warm both CPU and GPU containers
    """

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
        """Ping Modal to warm up GPU and CPU containers."""
        try:
            import modal
            ping = modal.Function.from_name("wavedesigner-demucs", "ping")
            ping.spawn()
            print("[ModalAudioService] Warmup triggered")
        except Exception as e:
            print(f"[ModalAudioService] Warmup failed: {e}")


# Singleton instance
_modal_service: Optional[ModalAudioService] = None


def get_modal_audio_service() -> ModalAudioService:
    """Get or create the Modal audio service singleton."""
    global _modal_service
    if _modal_service is None:
        _modal_service = ModalAudioService()
    return _modal_service