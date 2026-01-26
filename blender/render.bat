@echo off
REM ============================================================
REM WaveDesigner Blender Render Script
REM ============================================================
REM
REM BASIC USAGE:
REM   render.bat <config.json> [output_name] [samples] [options...]
REM
REM ARGUMENTS:
REM   %1 - Config JSON file (required)
REM        The CSG response JSON exported from the web app
REM
REM   %2 - Output filename (optional, default: render.png)
REM        Extension determines format for stills (.png)
REM        Videos auto-append "_video.mp4"
REM
REM   %3 - Sample count (optional, default: 512)
REM        64  = Draft quality, fast (~15 sec/frame)
REM        128 = Good quality, balanced (~25 sec/frame)
REM        256 = High quality (~45 sec/frame)
REM        512 = Production quality (~60+ sec/frame)
REM
REM   [options] - Unlimited additional options passed to Python
REM
REM ============================================================
REM CSG DATA CAPTURE:
REM ============================================================
REM
REM   Standard panels (single API call):
REM     1. F12 -> Network tab -> Filter: csg-data
REM     2. Configure panel in WaveDesigner
REM     3. Click request -> Response tab -> Copy
REM     4. Save as csg_response.json
REM
REM   ASYMMETRIC panels (TWO API calls - must merge):
REM     1. F12 -> Network -> Clear (prohibit button)
REM     2. Configure asymmetric panel
REM     3. TWO csg-data requests appear (same size ~20kB each)
REM     4. Click FIRST request -> Response -> Save as large.json
REM     5. Click SECOND request -> Response -> Save as small.json
REM     6. Merge: python merge_asymmetric.py large.json small.json
REM     7. Then render normally with csg_response.json
REM
REM ============================================================
REM STILL IMAGE OPTIONS:
REM ============================================================
REM
REM   --wall        Front-facing view, hanging on wall (default)
REM   --orthogonal  3/4 Angled Gallery View (Eye Level)
REM   --close       Detail/Macro view (See MACRO CONTROLS below)
REM   --all         Renders all three views (wall, orthogonal, close)
REM
REM EXAMPLES:
REM   render.bat csg_response.json product 256 --wall
REM   render.bat csg_response.json product 256 --orthogonal
REM   render.bat csg_response.json product 256 --all
REM
REM ============================================================
REM CLOSE-UP / MACRO CONTROLS (Use with --view close):
REM ============================================================
REM
REM   --focus "x,y" Target point on panel surface in inches
REM                 "0,0" = Center, "10,5" = 10" Right, 5" Up
REM
REM   --azimuth N   Camera rotation around target (Degrees)
REM                 0 = Front, 90 = Right, -90 = Left
REM
REM   --elevation N Camera tilt looking down (Degrees)
REM                 0 = Eye Level, 90 = Top-Down
REM
REM   --zoom N      Magnification Factor
REM                 1.0 = Full Frame, 4.0 = 4x Zoom
REM
REM EXAMPLE:
REM   render.bat csg.json detail 256 --view close --focus "6,0" --zoom 4
REM
REM ============================================================
REM VIDEO OPTIONS:
REM ============================================================
REM
REM   --video       Enable video render (camera arc animation)
REM   --frames N    Number of frames (default: 90)
REM                 30 frames = 1 second at 30fps
REM                 60 frames = 2 seconds
REM                 90 frames = 3 seconds
REM
REM EXAMPLES:
REM   render.bat csg_response.json showcase 64 --video --frames 30
REM   render.bat csg_response.json showcase 128 --video --frames 60
REM
REM ============================================================
REM RESOLUTION OPTIONS:
REM ============================================================
REM
REM   --draft       256x256 resolution (ultra-fast preview)
REM   --1k          1024x1024 resolution (web/social, ~15 sec/frame)
REM   --2k          2048x2048 resolution (production, ~60 sec/frame)
REM   --width N     Custom width in pixels
REM   --height N    Custom height in pixels
REM
REM EXAMPLES:
REM   render.bat csg_response.json web 64 --video --frames 60 --1k
REM   render.bat csg_response.json investor 256 --video --frames 90 --2k
REM
REM ============================================================
REM ADDITIONAL OPTIONS:
REM ============================================================
REM
REM   --turntable   360-degree rotation (PNG sequence, not MP4)
REM   --back        Rear view (for verifying backing inset)
REM   --step N      Render every Nth frame (fast video preview)
REM
REM ============================================================
REM RENDER TIME ESTIMATES (RTX 5000 with OptiX):
REM ============================================================
REM
REM   | Resolution | Samples | Per Frame | 60 Frame Video |
REM   |------------|---------|-----------|----------------|
REM   | 256x256    | 64      | ~2 sec    | ~2 min         |
REM   | 1024x1024  | 64      | ~10 sec   | ~10 min        |
REM   | 1024x1024  | 128     | ~18 sec   | ~18 min        |
REM   | 2048x2048  | 64      | ~35 sec   | ~35 min        |
REM   | 2048x2048  | 128     | ~60 sec   | ~60 min        |
REM   | 2048x2048  | 256     | ~90 sec   | ~90 min        |
REM
REM ============================================================

setlocal enabledelayedexpansion

REM Configuration - adjust Blender path if needed
set BLENDER_PATH="C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"
set SCRIPT_DIR=C:\Users\paulj\WDweb\blender
set RENDER_SCRIPT=%SCRIPT_DIR%\render_panel.py
set OUTPUT_DIR=%SCRIPT_DIR%\output

REM Check arguments
if "%~1"=="" (
    echo.
    echo ERROR: Missing config file argument
    echo Usage: render.bat ^<config.json^> [output_name] [samples] [options...]
    exit /b 1
)

REM Show help
if "%~1"=="--help" (
    notepad "%~f0"
    exit /b 0
)

REM Set defaults
set CONFIG_FILE=%~1
set OUTPUT_FILE=%~2
set SAMPLES=%~3

if "%OUTPUT_FILE%"=="" set OUTPUT_FILE=render.png
if "%SAMPLES%"=="" set SAMPLES=512

REM Build full output path
set FULL_OUTPUT_PATH=%OUTPUT_DIR%\%OUTPUT_FILE%

REM Verify files exist
if not exist "%CONFIG_FILE%" (
    echo Error: Config file not found: %CONFIG_FILE%
    exit /b 1
)
if not exist %BLENDER_PATH% (
    echo Error: Blender not found at %BLENDER_PATH%
    exit /b 1
)
if not exist "%RENDER_SCRIPT%" (
    echo Error: Render script not found: %RENDER_SCRIPT%
    exit /b 1
)

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

REM ============================================================
REM ARGUMENT PROCESSING (Fix for unlimited args)
REM ============================================================

REM Shift past the first 3 known arguments (config, output, samples)
REM so we can capture the "tail" of arguments into EXTRA_ARGS

REM Save known args first because shifting deletes them
set "A1=%~1"
set "A2=%~2"
set "A3=%~3"

REM Shift 3 times to discard %1, %2, %3 from the stack
shift
shift
shift

REM Capture all remaining arguments into a single string
set "EXTRA_ARGS="
:parse_args
if "%~1"=="" goto run_blender
set "EXTRA_ARGS=!EXTRA_ARGS! %1"
shift
goto parse_args

:run_blender
echo.
echo ============================================================
echo WaveDesigner Blender Render
echo ============================================================
echo Config:  %CONFIG_FILE%
echo Output:  %FULL_OUTPUT_PATH%
echo Samples: %SAMPLES%
echo Options: %EXTRA_ARGS%
echo ============================================================
echo.

REM Run Blender
%BLENDER_PATH% --background --python "%RENDER_SCRIPT%" -- --config "%CONFIG_FILE%" --output "%FULL_OUTPUT_PATH%" --samples %SAMPLES% %EXTRA_ARGS%

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo Render complete!
    echo Output: %OUTPUT_DIR%
    echo ============================================================
) else (
    echo.
    echo Render failed with error code: %ERRORLEVEL%
)

endlocal
exit /b %ERRORLEVEL%