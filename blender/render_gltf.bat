@echo off
REM ============================================================
REM WaveDesigner Blender Render Script
REM ============================================================
REM
REM Generates photorealistic renders from BabylonJS-exported geometry.
REM
REM PREREQUISITES:
REM   1. Export from BabylonJS configurator (browser console):
REM      await window.sceneManager.downloadForBlenderRender()
REM   2. This downloads two files to your Downloads folder:
REM      - panel_export.glb (geometry)
REM      - panel_config.json (materials/settings)
REM   3. Move both files to: C:\Users\paulj\WDweb\blender
REM
REM ============================================================
REM USAGE
REM ============================================================
REM
REM   render_gltf.bat <glb_file> <config_file> <output_name> <samples> [options]
REM
REM   Arguments:
REM     glb_file     - The .glb geometry file (e.g., panel_export.glb)
REM     config_file  - The .json config file (e.g., panel_config.json)
REM     output_name  - Base name for output file (no extension)
REM     samples      - Render quality: 64=draft, 256=preview, 512=production
REM
REM ============================================================
REM STILL SHOTS
REM ============================================================
REM
REM   --wall        Front view, panel on wall (DEFAULT)
REM   --orthogonal  3/4 angle view showing depth
REM   --reverse     Back of panel, shows backing material (no wall)
REM   --closeup     Slot detail with shallow depth of field
REM
REM ============================================================
REM ANIMATION
REM ============================================================
REM
REM   --video       Camera walks past panel left-to-right (MP4 output)
REM   --turntable   Panel rotates 360 degrees (PNG sequence, transparent)
REM   --frames N    Number of frames (default: 90 for video, 72 for turntable)
REM
REM   Frame guide:
REM     30 frames  = 1 second  (quick test)
REM     90 frames  = 3 seconds (standard video)
REM     72 frames  = 360/72 = 5 degree increments (smooth turntable)
REM
REM ============================================================
REM RESOLUTION
REM ============================================================
REM
REM   --draft       256x256   (fast test, ~10 sec)
REM   --1k          1024x1024 (preview, ~1 min)
REM   --2k          2048x2048 (production stills, ~3 min)
REM   --720p        1280x720  (video preview)
REM   --hd          1920x1080 (production video)
REM
REM ============================================================
REM LIGHTING PRESETS
REM ============================================================
REM
REM   --lighting gallery   Balanced showcase (DEFAULT)
REM   --lighting dramatic  High contrast, deep shadows
REM   --lighting detail    Emphasizes wood grain texture
REM   --lighting soft      Even illumination, minimal shadows
REM   --lighting natural   Simulates window light
REM
REM ============================================================
REM EXAMPLES
REM ============================================================
REM
REM   --- QUICK TESTS (use these first to verify setup) ---
REM
REM   render_gltf.bat panel_export.glb panel_config.json test 64 --draft
REM   render_gltf.bat panel_export.glb panel_config.json test 64 --video --frames 30 --720p
REM
REM   --- STILL SHOTS ---
REM
REM   Front view, preview quality:
REM   render_gltf.bat panel_export.glb panel_config.json front 256 --wall --1k
REM
REM   Front view, production quality:
REM   render_gltf.bat panel_export.glb panel_config.json front 512 --wall --2k
REM
REM   3/4 angle view:
REM   render_gltf.bat panel_export.glb panel_config.json ortho 256 --orthogonal --1k
REM
REM   Back of panel:
REM   render_gltf.bat panel_export.glb panel_config.json back 256 --reverse --1k
REM
REM   Slot close-up:
REM   render_gltf.bat panel_export.glb panel_config.json detail 256 --closeup --1k
REM
REM   --- VIDEO ---
REM
REM   Quick test (1 second):
REM   render_gltf.bat panel_export.glb panel_config.json walkby 64 --video --frames 30 --720p
REM
REM   Production (3 seconds, HD):
REM   render_gltf.bat panel_export.glb panel_config.json walkby 256 --video --frames 90 --hd
REM
REM   --- TURNTABLE ---
REM
REM   Quick test (quarter rotation):
REM   render_gltf.bat panel_export.glb panel_config.json spin 64 --turntable --frames 18 --draft
REM
REM   Production (full 360):
REM   render_gltf.bat panel_export.glb panel_config.json spin 256 --turntable --frames 72 --1k
REM
REM   --- WITH LIGHTING PRESETS ---
REM
REM   Dramatic lighting for hero shot:
REM   render_gltf.bat panel_export.glb panel_config.json hero 512 --wall --2k --lighting dramatic
REM
REM   Soft lighting for turntable:
REM   render_gltf.bat panel_export.glb panel_config.json spin 256 --turntable --lighting soft
REM
REM ============================================================
REM OUTPUT LOCATIONS
REM ============================================================
REM
REM   All renders save to: C:\Users\paulj\WDweb\blender\output\
REM
REM   Still shots:    <output_name>.png
REM   Video:          <output_name>_video.mp4
REM   Turntable:      <output_name>_turn_0001.png through <output_name>_turn_NNNN.png
REM
REM ============================================================
REM RENDER TIME ESTIMATES (RTX GPU)
REM ============================================================
REM
REM   Still shots:
REM     --draft (256x256, 64 samples)   ~10 seconds
REM     --1k (1024x1024, 256 samples)   ~1 minute
REM     --2k (2048x2048, 512 samples)   ~3-5 minutes
REM
REM   Video (per frame):
REM     --720p, 64 samples              ~15 seconds/frame
REM     --hd, 256 samples               ~45 seconds/frame
REM
REM   Example: 90-frame HD video at 256 samples = ~70 minutes
REM
REM ============================================================
REM TROUBLESHOOTING
REM ============================================================
REM
REM   "GLTF file not found"
REM     - Check that panel_export.glb is in C:\Users\paulj\WDweb\blender
REM
REM   Black or missing textures
REM     - Wood textures must be in ..\public\assets\textures\wood\
REM
REM   Noisy render
REM     - Increase samples (256 or higher)
REM     - This should not happen with current settings
REM
REM   Video won't play
REM     - Check output folder for <name>_video.mp4
REM     - Ensure FFmpeg codec is available (built into Blender)
REM
REM ============================================================
setlocal enabledelayedexpansion
set BLENDER_PATH="C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"
set SCRIPT_DIR=C:\Users\paulj\WDweb\blender
set RENDER_SCRIPT=%SCRIPT_DIR%\render_gltf.py
set OUTPUT_DIR=%SCRIPT_DIR%\output
if "%~1"=="" (
    echo ERROR: Missing GLTF file
    echo.
    echo Usage: render_gltf.bat ^<glb_file^> ^<config_file^> [output_name] [samples] [options]
    echo.
    echo Run without arguments to see this help, or read the comments at the top of this file.
    exit /b 1
)
set GLTF_FILE=%~1
set CONFIG_FILE=%~2
set OUTPUT_FILE=%~3
set SAMPLES=%~4
if "%CONFIG_FILE%"=="" set CONFIG_FILE=panel_config.json
if "%OUTPUT_FILE%"=="" set OUTPUT_FILE=render.png
if "%SAMPLES%"=="" set SAMPLES=256
set FULL_OUTPUT=%OUTPUT_DIR%\%OUTPUT_FILE%
REM Collect extra args
shift & shift & shift & shift
set "EXTRA_ARGS="
:parse
if "%~1"=="" goto run
set "EXTRA_ARGS=!EXTRA_ARGS! %1"
shift
goto parse
:run
echo.
echo ============================================================
echo WaveDesigner GLTF Render
echo ============================================================
echo GLTF:    %GLTF_FILE%
echo Config:  %CONFIG_FILE%
echo Output:  %FULL_OUTPUT%
echo Samples: %SAMPLES%
echo Options: %EXTRA_ARGS%
echo ============================================================
echo.
%BLENDER_PATH% --background --python "%RENDER_SCRIPT%" -- ^
    --gltf "%GLTF_FILE%" ^
    --config "%CONFIG_FILE%" ^
    --output "%FULL_OUTPUT%" ^
    --samples %SAMPLES% ^
    %EXTRA_ARGS%
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Render complete: %FULL_OUTPUT%
) else (
    echo Render failed with error: %ERRORLEVEL%
)
endlocal
