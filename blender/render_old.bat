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
REM   %4-%9 - Additional options passed to Python script
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
REM   --wall        Front-facing view, as if hanging on wall (default)
REM   --orthogonal  3/4 top-down product shot view
REM   --close       Close-up of gap between panels showing slot detail
REM   --all         Renders all three views (wall, orthogonal, close)
REM
REM EXAMPLES:
REM   render.bat csg_response.json product 256 --wall
REM   render.bat csg_response.json product 256 --orthogonal
REM   render.bat csg_response.json product 256 --all
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
REM QUICK REFERENCE:
REM ============================================================
REM
REM   Fast test (1 sec video):
REM     render.bat csg_response.json test 64 --video --frames 30 --1k
REM
REM   Web quality (2 sec video):
REM     render.bat csg_response.json web 128 --video --frames 60 --1k
REM
REM   Production quality (3 sec video):
REM     render.bat csg_response.json final 256 --video --frames 90 --2k
REM
REM   All three still views:
REM     render.bat csg_response.json product 256 --all
REM
REM   Asymmetric panel workflow:
REM     python merge_asymmetric.py large.json small.json
REM     render.bat csg_response.json asymmetric 256 --wall
REM
REM ============================================================

setlocal

REM Configuration - adjust Blender path if needed
set BLENDER_PATH="C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"
set SCRIPT_DIR=C:\Users\paulj\WDweb\blender
set RENDER_SCRIPT=%SCRIPT_DIR%\render_panel.py
set OUTPUT_DIR=%SCRIPT_DIR%\output

REM Check arguments
if "%~1"=="" (
    echo.
    echo ERROR: Missing config file argument
    echo.
    echo Usage: render.bat ^<config.json^> [output_name] [samples] [options...]
    echo.
    echo Run 'render.bat --help' or view this file for full documentation.
    echo.
    exit /b 1
)

REM Show help
if "%~1"=="--help" (
    echo.
    echo Opening render.bat for documentation...
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
    echo Please edit this script to set the correct Blender path.
    exit /b 1
)

if not exist "%RENDER_SCRIPT%" (
    echo Error: Render script not found: %RENDER_SCRIPT%
    exit /b 1
)

REM Ensure output directory exists
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

echo.
echo ============================================================
echo WaveDesigner Blender Render
echo ============================================================
echo Config:  %CONFIG_FILE%
echo Output:  %FULL_OUTPUT_PATH%
echo Samples: %SAMPLES%
echo Options: %4 %5 %6 %7 %8 %9
echo ============================================================
echo.

REM Run Blender - pass all extra arguments to Python script
%BLENDER_PATH% --background --python "%RENDER_SCRIPT%" -- --config "%CONFIG_FILE%" --output "%FULL_OUTPUT_PATH%" --samples %SAMPLES% %4 %5 %6 %7 %8 %9

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo Render complete!
    echo Output: %OUTPUT_DIR%
    echo ============================================================
    echo.
) else (
    echo.
    echo Render failed with error code: %ERRORLEVEL%
)

endlocal
exit /b %ERRORLEVEL%
