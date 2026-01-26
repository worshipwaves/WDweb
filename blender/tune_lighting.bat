@echo off
REM ============================================================
REM WaveDesigner Lighting Tuner
REM Opens Blender GUI for manual light adjustment
REM ============================================================
REM
REM USAGE:
REM   tune_lighting.bat panel_export.glb panel_config.json
REM
REM WORKFLOW:
REM   1. Run this script with your exported GLB
REM   2. Blender opens with scene pre-configured
REM   3. Press Z > Rendered for live preview
REM   4. Select lights, adjust Energy/Size/Position in Properties
REM   5. Press F12 for full quality preview
REM   6. When satisfied: Scripting workspace > Open extract_lighting.py > Run
REM   7. Copy output values to render_gltf.py LIGHTING_PRESETS
REM
REM ============================================================

set BLENDER_PATH="C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"
set SCRIPT_DIR=%~dp0
set SETUP_SCRIPT=%SCRIPT_DIR%setup_for_tuning.py

if "%~1"=="" (
    echo ERROR: Missing GLTF file
    echo Usage: tune_lighting.bat panel_export.glb [panel_config.json]
    exit /b 1
)

set GLTF_FILE=%~1
set CONFIG_FILE=%~2
if "%CONFIG_FILE%"=="" set CONFIG_FILE=panel_config.json

echo.
echo ============================================================
echo WaveDesigner Lighting Tuner
echo ============================================================
echo GLTF:   %GLTF_FILE%
echo Config: %CONFIG_FILE%
echo.
echo Opening Blender GUI for manual tuning...
echo ============================================================
echo.

%BLENDER_PATH% --python "%SETUP_SCRIPT%" -- --gltf "%GLTF_FILE%" --config "%CONFIG_FILE%"
