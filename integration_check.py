# Run this in Python to verify services can be instantiated
from services.audio_processing_service import AudioProcessingService
from services.slot_generation_service import SlotGenerationService
from services.composition_service import CompositionService
from services.geometry_service import GeometryService

# Create services with proper dependencies
audio_service = AudioProcessingService()
slot_service = SlotGenerationService(audio_service)
geometry_service = GeometryService()
composition_service = CompositionService(geometry_service, slot_service, audio_service)

print("✓ All services instantiated successfully")