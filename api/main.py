from pathlib import Path
from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import tempfile
import os

from services.dtos import CompositionStateDTO
from services.service_facade import WaveformDesignerFacade
from services.config_service import ConfigService
from fastapi import Response
from dev_utils.performance_monitor import performance_monitor

# Define project root directory (parent of api directory)
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Initialize FastAPI application
app = FastAPI(title="WaveDesigner API", version="0.1.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create application-level WaveformDesignerFacade instance
# This is the single point of interaction with all business services
facade = WaveformDesignerFacade()

# Create ConfigService instance for configuration endpoints
config_service = ConfigService(PROJECT_ROOT / "config")

# Pydantic model for the audio processing response
class AudioProcessResponse(BaseModel):
    updated_state: CompositionStateDTO
    max_amplitude_local: float
    raw_samples_for_cache: List[float]

# Pydantic models for the smart CSG data endpoint
class CsgDataRequest(BaseModel):
    state: CompositionStateDTO
    changed_params: List[str]
    previous_max_amplitude: Optional[float] = None

class CsgDataResponse(BaseModel):
    csg_data: Dict[str, Any]
    updated_state: CompositionStateDTO
    max_amplitude_local: float

@app.get("/")
def health_check():
    """Basic health check endpoint."""
    return {"status": "ok", "message": "Welcome to WaveDesigner API"}
    
@app.get("/api/performance-report", response_class=Response)
def get_performance_report():
    """Returns the latest performance report as plain text."""
    report = performance_monitor.get_report()
    performance_monitor.reset()  # Reset after fetching to prepare for the next run
    return Response(content=report, media_type="text/plain")

@app.get("/api/performance-reset")
def reset_performance_report():
    """Manually resets the performance monitor."""
    performance_monitor.reset()
    return {"status": "ok", "message": "Performance monitor reset."}

@app.get("/api/config/archetypes")
def get_archetypes():
    """Load archetype definitions with enriched metadata"""
    return config_service.get_archetypes()

@app.get("/api/config/ui")
def get_ui_config():
    """Load UI configuration (elements, categories, thumbnails)"""
    return config_service.get_ui_config()

@app.get("/api/config/composition-defaults")
def get_composition_defaults():
    """Load composition default values for initial DTO"""
    return config_service.get_composition_defaults()   

@app.get("/api/config/wood-materials")
def get_wood_materials_config():
    """
    Get wood materials configuration including species catalog and texture settings.
    """
    return config_service.get_wood_materials_config()

@app.get("/api/config/default-parameters")
def get_default_parameters():
    """
    Get complete default parameters including UI configuration.
    Returns the full default_parameters.json file.
    """
    import json
    config_path = PROJECT_ROOT / "config" / "default_parameters.json"
    with open(config_path, 'r') as f:
        return json.load(f)

@app.get("/composition/default", response_model=CompositionStateDTO)
def get_default_composition():
    """
    Get the default composition state.
    
    Returns a complete CompositionStateDTO with all default parameters
    loaded from the configuration file.
    """
    return facade.create_default_state()
    
@app.post("/geometry/csg-data", response_model=CsgDataResponse)
def get_csg_data(request: CsgDataRequest) -> Dict[str, Any]:
    """
    Get CSG data for panel generation using smart processing levels.
    This endpoint determines the minimal processing required based on
    the parameters that have changed, and returns both the resulting
    CSG data and the updated application state.
    
    CRITICAL: For geometry changes, frontend sends NORMALIZED amplitudes (0-1 range).
    """
    try:
        # Log the processing level for debugging
        level = facade._processing_level_service.get_processing_level(request.changed_params)
        print(f"[API] Processing level: {level} for params: {request.changed_params}")
        
        # For geometry changes, verify amplitudes look normalized
        if level == "geometry" and request.state.processed_amplitudes:
            max_amp = max(abs(a) for a in request.state.processed_amplitudes)
            print(f"[API] Incoming amplitude range check: max={max_amp:.4f}")
            if max_amp > 1.5:
                print(f"[API WARNING] Amplitudes may not be normalized!")
        
        result = facade.process_and_get_csg_data(
            request.state,
            request.changed_params,
            request.previous_max_amplitude
        )
        print(f"[API] Returning csg_data.panel_config: {result['csg_data']['panel_config']}")
        if 'section_edges' in result['csg_data'] and result['csg_data']['section_edges']:
            print(f"[API] Included {len(result['csg_data']['section_edges'])} section edge sets")
        return result
    except Exception as e:
        print(f"Error in get_csg_data: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@app.post("/geometry/panel-parameters")
def get_panel_parameters(state: CompositionStateDTO) -> Dict[str, Any]:
    """
    Get just the panel configuration parameters.
    
    Args:
        state: Composition state with frame design
        
    Returns:
        Panel configuration dictionary
    """
    try:
        return facade.get_panel_parameters(state)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.post("/geometry/slot-data")
def get_slot_data(state: CompositionStateDTO):
    """
    Get just the slot data for CSG operations.
    
    Args:
        state: Composition state with processed amplitudes
        
    Returns:
        List of slot data dictionaries
    """
    try:
        return {"slots": facade.get_slot_data(state)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
        

@app.post("/audio/process", response_model=AudioProcessResponse)
async def process_audio(
    file: UploadFile = File(...),
    state: str = None
) -> Dict[str, Any]:
    """
    Process an uploaded audio file to extract amplitudes.
    
    This endpoint accepts an audio file and a composition state,
    processes the audio to extract amplitudes, and returns an
    updated state with the processed_amplitudes field populated.
    
    Args:
        file: Uploaded audio file (mp3, wav, etc)
        state: JSON string of CompositionStateDTO (optional, uses defaults if not provided)
        
    Returns:
        Updated CompositionStateDTO with processed_amplitudes
        
    Raises:
        HTTPException: If audio processing fails
    """
    # Parse state or use defaults
    if state:
        import json
        try:
            state_dict = json.loads(state)
            composition_state = CompositionStateDTO(**state_dict)
        except json.JSONDecodeError:
            # state might be form data, not JSON
            composition_state = facade.create_default_state()
    else:
        composition_state = facade.create_default_state()
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp_file:
        try:
            # Write uploaded file to temp location
            content = await file.read()
            tmp_file.write(content)
            tmp_file.flush()
            
            # Process the audio file and get the response package
            response_data = facade.process_audio(tmp_file.name, composition_state)
            
            return response_data
            
        finally:
            # Clean up temp file
            try:
                os.unlink(tmp_file.name)
            except:
                pass        