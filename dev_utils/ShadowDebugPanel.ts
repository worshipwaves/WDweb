/**
 * ShadowDebugPanel - Real-time shadow and lighting tuning tool
 * 
 * Toggle with Ctrl+Shift+D or call ShadowDebugPanel.toggle()
 * Enable by setting DEBUG_SHADOW_PANEL = true
 */

import { Vector3, Color3, ShadowGenerator } from '@babylonjs/core';
import type { SceneManager } from '../src/SceneManager';

// Configuration flag - set to true to enable the debug panel
export const DEBUG_SHADOW_PANEL = true;

interface ShadowConfig {
  direction: [number, number, number];
  intensity: number;
  light_position: [number, number, number];
  shadow_enabled: boolean;
  shadow_map_resolution: number;
  shadow_darkness: number;
  shadow_bias: number;
  shadow_normal_bias: number;
  frustum_edge_falloff: number;
  shadow_filter_mode: 'pcf' | 'exponential' | 'contact_hardening';
  shadow_blur: number;
  blur_kernel: number;
  contact_hardening_light_size: number;
  shadow_receiver_position: [number, number, number];
  shadow_level: number;
  ambient_boost: number;
  ambient_ground_color: [number, number, number];
  environment_intensity: number;
  // Advanced settings
  auto_light_position: boolean;
  shadow_frustum_size: number;
  hemispheric_sky_color: [number, number, number];
  force_back_faces_only: boolean;
}

interface SliderDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  section: string;
  parentKey?: string;
  index?: number;
}

export class ShadowDebugPanel {
  private static _instance: ShadowDebugPanel | null = null;
  private static _enabled = DEBUG_SHADOW_PANEL;
  
  private _panel: HTMLDivElement | null = null;
  private _sceneManager: SceneManager | null = null;
  private _currentConfig: ShadowConfig = this._getDefaultConfig();
  private _baselineConfig: ShadowConfig | null = null;  // Scene's initial values (from backgrounds.json)
  private _angleOverlay: HTMLDivElement | null = null;
  private _currentAngle: number = 45;  // Degrees, 0 = horizontal right, 90 = down
  private _angleGuideActive: boolean = false;
  private _keyHandler: ((e: KeyboardEvent) => void) | null = null;
  
  private readonly _sliders: SliderDef[] = [
    // Light Direction (default matches SceneManager.resetLighting: light from LEFT)
    // Note: Y/Z labels swapped to match visual behavior (artwork has 90° X rotation)
    { key: 'direction_x', label: 'Direction X', min: -1, max: 1, step: 0.05, defaultValue: 1.0, parentKey: 'direction', index: 0, section: 'direction' },
    { key: 'direction_y', label: 'Direction Z (Depth)', min: -1, max: 1, step: 0.05, defaultValue: -0.5, parentKey: 'direction', index: 1, section: 'direction' },
    { key: 'direction_z', label: 'Direction Y (Length)', min: -1, max: 0, step: 0.01, defaultValue: -1.0, parentKey: 'direction', index: 2, section: 'direction' },
    
    // Light Position is auto-calculated from direction (50 units behind artwork)
    // Only intensity is adjustable here
    { key: 'intensity', label: 'Intensity', min: 0.5, max: 4, step: 0.1, defaultValue: 2.0, section: 'light_position' },
    
    // Shadow properties (defaults match SceneManager)
    { key: 'shadow_darkness', label: 'Darkness', min: 0, max: 1, step: 0.01, defaultValue: 0.4, section: 'shadow' },
    
    // Exponential mode
    { key: 'shadow_blur', label: 'Blur Scale', min: 1, max: 30, step: 1, defaultValue: 15, section: 'exponential' },
    { key: 'blur_kernel', label: 'Blur Kernel', min: 8, max: 128, step: 8, defaultValue: 64, section: 'exponential' },
    
    // Contact hardening
    { key: 'contact_hardening_light_size', label: 'Light Size', min: 0.01, max: 0.5, step: 0.01, defaultValue: 0.05, section: 'contact' },
    
    // Shadow receiver (only Y matters - X/Z have no visible effect on 200x200 plane)
    { key: 'receiver_y', label: 'Receiver Y', min: -5, max: 0, step: 0.01, defaultValue: -0.19, parentKey: 'shadow_receiver_position', index: 1, section: 'receiver' },
    
    // Ambient light (default: hemispheric intensity = 1.0, so boost = 0)
    { key: 'ambient_boost', label: 'Ambient Boost', min: 0, max: 3, step: 0.1, defaultValue: 0, section: 'ambient' },
    { key: 'ambient_ground_r', label: 'Ground R', min: 0, max: 1, step: 0.05, defaultValue: 0, parentKey: 'ambient_ground_color', index: 0, section: 'ambient' },
    { key: 'ambient_ground_g', label: 'Ground G', min: 0, max: 1, step: 0.05, defaultValue: 0, parentKey: 'ambient_ground_color', index: 1, section: 'ambient' },
    { key: 'ambient_ground_b', label: 'Ground B', min: 0, max: 1, step: 0.05, defaultValue: 0, parentKey: 'ambient_ground_color', index: 2, section: 'ambient' },
    
    // Advanced - Light Position (when auto_light_position is false)
    { key: 'light_pos_x', label: 'Light Pos X', min: -100, max: 100, step: 5, defaultValue: 0, parentKey: 'light_position', index: 0, section: 'advanced' },
    { key: 'light_pos_y', label: 'Light Pos Y', min: -100, max: 100, step: 5, defaultValue: 25, parentKey: 'light_position', index: 1, section: 'advanced' },
    { key: 'light_pos_z', label: 'Light Pos Z', min: -100, max: 100, step: 5, defaultValue: 50, parentKey: 'light_position', index: 2, section: 'advanced' },
    
    // Advanced - Shadow Frustum
    { key: 'shadow_frustum_size', label: 'Frustum Size', min: 10, max: 200, step: 5, defaultValue: 50, section: 'advanced' },
    
    // Advanced - Hemispheric Sky Color (subtle effect on flat geometry, more visible on deep slots)
    { key: 'sky_color_r', label: 'Sky R', min: 0, max: 1, step: 0.05, defaultValue: 1.0, parentKey: 'hemispheric_sky_color', index: 0, section: 'advanced' },
    { key: 'sky_color_g', label: 'Sky G', min: 0, max: 1, step: 0.05, defaultValue: 1.0, parentKey: 'hemispheric_sky_color', index: 1, section: 'advanced' },
    { key: 'sky_color_b', label: 'Sky B', min: 0, max: 1, step: 0.05, defaultValue: 1.0, parentKey: 'hemispheric_sky_color', index: 2, section: 'advanced' },
    
    // Advanced - Troubleshooting controls (only adjust if artifacts appear)
    { key: 'shadow_bias', label: 'Bias', min: 0, max: 0.01, step: 0.0001, defaultValue: 0.0005, section: 'advanced' },
    { key: 'shadow_normal_bias', label: 'Normal Bias', min: 0, max: 0.05, step: 0.001, defaultValue: 0.003, section: 'advanced' },
    { key: 'frustum_edge_falloff', label: 'Edge Falloff', min: 0, max: 1, step: 0.05, defaultValue: 0, section: 'advanced' },
    
    // Advanced - Environment (requires HDR environment texture to have effect)
    { key: 'environment_intensity', label: 'Env Intensity', min: 0, max: 2, step: 0.1, defaultValue: 0.6, section: 'advanced' },
  ];

  private constructor() {}

  private _getDefaultConfig(): ShadowConfig {
    return {
      direction: [1.0, -0.5, -1.0],  // Matches SceneManager.resetLighting()
      intensity: 2.0,
      light_position: [0, 25, 50],
      shadow_enabled: true,
      shadow_map_resolution: 4096,
      shadow_darkness: 0.4,  // Matches SceneManager default
      shadow_bias: 0.0005,
      shadow_normal_bias: 0.003,
      frustum_edge_falloff: 0,
      shadow_filter_mode: 'pcf',
      shadow_blur: 15,
      blur_kernel: 64,
      contact_hardening_light_size: 0.05,
      shadow_receiver_position: [0, -0.19, 0],
      shadow_level: 0.4,  // Matches shadow_darkness default
      ambient_boost: 0,  // Default hemispheric intensity is 1.0, so boost = 0
      ambient_ground_color: [0, 0, 0],
      environment_intensity: 0.6,
      // Advanced
      auto_light_position: true,
      shadow_frustum_size: 50,
      hemispheric_sky_color: [1.0, 1.0, 1.0],
      force_back_faces_only: false,
    };
  }

  /**
   * Initialize keyboard shortcut listener
   * Call this once during app startup
   */
  public static init(sceneManager: SceneManager): void {
    if (!ShadowDebugPanel._enabled) return;
    
    if (!ShadowDebugPanel._instance) {
      ShadowDebugPanel._instance = new ShadowDebugPanel();
    }
    
    ShadowDebugPanel._instance._sceneManager = sceneManager;
    
    // Register keyboard shortcut: Ctrl+Shift+D (D for Debug)
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        ShadowDebugPanel.toggle();
      }
    });
    
    console.log('[ShadowDebugPanel] Initialized. Press Ctrl+Shift+D to toggle.');
  }

  /**
   * Enable/disable the debug panel feature
   */
  public static setEnabled(enabled: boolean): void {
    ShadowDebugPanel._enabled = enabled;
  }

  /**
   * Toggle panel visibility
   */
  public static toggle(): void {
    if (!ShadowDebugPanel._enabled) {
      console.log('[ShadowDebugPanel] Not enabled. Set DEBUG_SHADOW_PANEL = true');
      return;
    }
    
    if (!ShadowDebugPanel._instance) {
      console.warn('[ShadowDebugPanel] Not initialized. Call init() first.');
      return;
    }
    
    if (ShadowDebugPanel._instance._panel) {
      ShadowDebugPanel._instance._destroy();
    } else {
      ShadowDebugPanel._instance._createPanel();
      ShadowDebugPanel._instance._readCurrentValues();
    }
  }

  /**
   * Show the panel
   */
  public static show(): void {
    if (!ShadowDebugPanel._instance?._panel) {
      ShadowDebugPanel.toggle();
    }
  }

  /**
   * Hide the panel
   */
  public static hide(): void {
    if (ShadowDebugPanel._instance?._panel) {
      ShadowDebugPanel._instance._destroy();
    }
  }

  /**
   * Refresh baseline from current scene (call when background changes)
   */
  public static refreshBaseline(): void {
    if (ShadowDebugPanel._instance?._panel) {
      ShadowDebugPanel._instance._readCurrentValues();
    }
  }

  private _destroy(): void {
    if (this._panel) {
      this._panel.remove();
      this._panel = null;
    }
    if (this._angleOverlay) {
      this._angleOverlay.remove();
      this._angleOverlay = null;
    }
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    this._angleGuideActive = false;
  }

  private _readCurrentValues(): void {
    const sm = this._sceneManager as any;
    if (!sm) return;
    
    try {
      if (sm._directionalLight) {
        const dir = sm._directionalLight.direction;
        this._currentConfig.direction = [dir.x, dir.y, dir.z];
        const pos = sm._directionalLight.position;
        this._currentConfig.light_position = [pos.x, pos.y, pos.z];
        this._currentConfig.intensity = sm._directionalLight.intensity;
      }
      
      if (sm._shadowGenerator) {
        this._currentConfig.shadow_darkness = sm._shadowGenerator.darkness;
        this._currentConfig.shadow_bias = sm._shadowGenerator.bias;
        this._currentConfig.shadow_normal_bias = sm._shadowGenerator.normalBias;
        this._currentConfig.frustum_edge_falloff = sm._shadowGenerator.frustumEdgeFalloff ?? 0;
        
        // Read current resolution
        const shadowMap = sm._shadowGenerator.getShadowMap();
        if (shadowMap) {
          this._currentConfig.shadow_map_resolution = shadowMap.getSize().width;
        }
        
        // Detect current filter mode
        if (sm._shadowGenerator.useBlurExponentialShadowMap) {
          this._currentConfig.shadow_filter_mode = 'exponential';
          this._currentConfig.blur_kernel = sm._shadowGenerator.blurKernel ?? 64;
          this._currentConfig.shadow_blur = sm._shadowGenerator.blurScale ?? 15;
        } else if (sm._shadowGenerator.useContactHardeningShadow) {
          this._currentConfig.shadow_filter_mode = 'contact_hardening';
          this._currentConfig.contact_hardening_light_size = sm._shadowGenerator.contactHardeningLightSizeUVRatio ?? 0.05;
        } else {
          this._currentConfig.shadow_filter_mode = 'pcf';
        }
      }
      
      // Read actual shadow receiver position
      if (sm._shadowReceiverPlane) {
        const recvPos = sm._shadowReceiverPlane.position;
        this._currentConfig.shadow_receiver_position = [recvPos.x, recvPos.y, recvPos.z];
        
        // Read shadow level from material
        if (sm._shadowReceiverPlane.material?.shadowLevel !== undefined) {
          this._currentConfig.shadow_level = sm._shadowReceiverPlane.material.shadowLevel;
        }
      }
      
      if (sm._hemisphericLight) {
        this._currentConfig.ambient_boost = Math.max(0, sm._hemisphericLight.intensity - 1.0);
        const gc = sm._hemisphericLight.groundColor;
        if (gc) {
          this._currentConfig.ambient_ground_color = [gc.r, gc.g, gc.b];
        }
        // Read sky color (diffuse)
        const dc = sm._hemisphericLight.diffuse;
        if (dc) {
          this._currentConfig.hemispheric_sky_color = [dc.r, dc.g, dc.b];
        }
      }
      
      if (sm._scene) {
        this._currentConfig.environment_intensity = sm._scene.environmentIntensity ?? 0.6;
      }
      
      // Read shadow generator advanced settings
      if (sm._shadowGenerator) {
        this._currentConfig.force_back_faces_only = sm._shadowGenerator.forceBackFacesOnly ?? false;
      }
      
      // Read directional light frustum size
      if (sm._directionalLight) {
        // Use orthoRight as frustum size indicator (it's set symmetrically)
        const frustum = sm._directionalLight.orthoRight;
        if (frustum && frustum > 0) {
          this._currentConfig.shadow_frustum_size = frustum;
        }
      }
      
      // Store as baseline for this scene (values from backgrounds.json config)
      this._baselineConfig = JSON.parse(JSON.stringify(this._currentConfig));
      
      this._updateAllSliderDisplays();
      this._updateModeDisplay();
      this._updateDropdowns();
    } catch (e) {
      console.warn('[ShadowDebugPanel] Could not read current values:', e);
    }
  }
  
  private _updateDropdowns(): void {
    const resSelect = document.getElementById('sdp-shadow-resolution') as HTMLSelectElement;
    if (resSelect) {
      resSelect.value = String(this._currentConfig.shadow_map_resolution);
    }
    
    const filterSelect = document.getElementById('sdp-filter-mode') as HTMLSelectElement;
    if (filterSelect) {
      filterSelect.value = this._currentConfig.shadow_filter_mode;
    }
    
    // Update advanced checkboxes
    const autoLightPosCheckbox = document.getElementById('sdp-auto-light-pos') as HTMLInputElement;
    const lightPosSlidersContainer = document.getElementById('sdp-light-pos-sliders');
    if (autoLightPosCheckbox) {
      autoLightPosCheckbox.checked = this._currentConfig.auto_light_position;
      if (lightPosSlidersContainer) {
        lightPosSlidersContainer.classList.toggle('disabled-sliders', this._currentConfig.auto_light_position);
      }
    }
    
    const forceBackFacesCheckbox = document.getElementById('sdp-force-back-faces') as HTMLInputElement;
    if (forceBackFacesCheckbox) {
      forceBackFacesCheckbox.checked = this._currentConfig.force_back_faces_only;
    }
  }

  private _updateAllSliderDisplays(): void {
    this._sliders.forEach((def) => {
      const slider = document.getElementById(`sdp-slider-${def.key}`) as HTMLInputElement;
      const valueDisplay = document.getElementById(`sdp-value-${def.key}`);
      if (!slider || !valueDisplay) return;
      
      let val: number;
      if (def.parentKey && def.index !== undefined) {
        val = (this._currentConfig as any)[def.parentKey][def.index];
      } else {
        val = (this._currentConfig as any)[def.key];
      }
      
      if (val !== undefined) {
        slider.value = String(val);
        valueDisplay.textContent = this._formatValue(def, val);
      }
    });
  }

  private _formatValue(def: SliderDef, val: number): string {
    if (def.step < 0.001) return val.toFixed(4);
    if (def.step < 0.01) return val.toFixed(3);
    if (def.step < 0.1) return val.toFixed(2);
    if (def.step < 1) return val.toFixed(1);
    return val.toFixed(0);
  }

  private _createPanel(): void {
    this._panel = document.createElement('div');
    this._panel.id = 'shadow-debug-panel';
    this._panel.innerHTML = `
      <style>
        #shadow-debug-panel {
          position: fixed;
          top: 10px;
          right: 10px;
          width: 360px;
          max-height: 95vh;
          overflow-y: auto;
          background: rgba(15, 15, 20, 0.97);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          padding: 12px;
          font-family: system-ui, sans-serif;
          font-size: 11px;
          color: #e0e0e0;
          z-index: 10000;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        }
        #shadow-debug-panel::-webkit-scrollbar { width: 6px; }
        #shadow-debug-panel::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        #shadow-debug-panel::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
        #shadow-debug-panel h3 {
          margin: 0 0 12px 0;
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        #shadow-debug-panel .close-btn {
          background: none;
          border: none;
          color: #888;
          font-size: 18px;
          cursor: pointer;
          padding: 0 4px;
        }
        #shadow-debug-panel .close-btn:hover { color: #fff; }
        #shadow-debug-panel .section {
          margin-bottom: 8px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 6px;
          overflow: hidden;
        }
        #shadow-debug-panel .section-header {
          font-size: 10px;
          font-weight: 600;
          color: #aaa;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 8px 10px;
          background: rgba(255,255,255,0.03);
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        #shadow-debug-panel .section-header:hover { background: rgba(255,255,255,0.06); }
        #shadow-debug-panel .section-header .toggle { color: #666; }
        #shadow-debug-panel .section-content {
          padding: 8px 10px;
          display: none;
        }
        #shadow-debug-panel .section-content.open { display: block; }
        #shadow-debug-panel .slider-row {
          display: flex;
          align-items: center;
          margin-bottom: 6px;
          gap: 6px;
        }
        #shadow-debug-panel .slider-label {
          flex: 0 0 90px;
          color: #999;
          font-size: 10px;
        }
        #shadow-debug-panel input[type="range"] {
          flex: 1;
          height: 3px;
          -webkit-appearance: none;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 2px;
          outline: none;
        }
        #shadow-debug-panel input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          background: #D9A464;
          border-radius: 50%;
          cursor: pointer;
        }
        #shadow-debug-panel .slider-value {
          flex: 0 0 42px;
          text-align: right;
          font-family: monospace;
          font-size: 10px;
          color: #D9A464;
        }
        #shadow-debug-panel .select-row {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
          gap: 6px;
        }
        #shadow-debug-panel select {
          flex: 1;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          color: #e0e0e0;
          padding: 5px 8px;
          font-size: 11px;
        }
        #shadow-debug-panel .button-row {
          display: flex;
          gap: 6px;
          margin-top: 10px;
        }
        #shadow-debug-panel button {
          flex: 1;
          padding: 7px 10px;
          border: none;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
        }
        #shadow-debug-panel .copy-btn { background: #D9A464; color: #000; }
        #shadow-debug-panel .copy-btn:hover { background: #e8b574; }
        #shadow-debug-panel .reset-btn { background: rgba(255,255,255,0.1); color: #ccc; }
        #shadow-debug-panel .reset-btn:hover { background: rgba(255,255,255,0.15); }
        #shadow-debug-panel .defaults-btn { background: rgba(255,255,255,0.05); color: #888; font-size: 10px; }
        #shadow-debug-panel .defaults-btn:hover { background: rgba(255,255,255,0.1); color: #ccc; }
        #shadow-debug-panel .checkbox-row {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }
        #shadow-debug-panel .checkbox-row label {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #999;
          font-size: 10px;
          cursor: pointer;
        }
        #shadow-debug-panel .checkbox-row input[type="checkbox"] {
          width: 14px;
          height: 14px;
          accent-color: #D9A464;
        }
        #shadow-debug-panel .disabled-sliders {
          opacity: 0.4;
          pointer-events: none;
        }
        #shadow-debug-panel .json-output {
          margin-top: 8px;
          padding: 8px;
          background: rgba(0, 0, 0, 0.4);
          border-radius: 4px;
          font-family: monospace;
          font-size: 9px;
          color: #8f8;
          white-space: pre-wrap;
          word-break: break-all;
          max-height: 120px;
          overflow-y: auto;
          display: none;
        }
        #shadow-debug-panel .json-output.visible { display: block; }
        #shadow-debug-panel .active-badge {
          display: inline-block;
          padding: 2px 6px;
          background: #D9A464;
          color: #000;
          border-radius: 3px;
          font-size: 9px;
          font-weight: 600;
        }
        #shadow-debug-panel .angle-display {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 8px 0;
        }
        #shadow-debug-panel .angle-display .slider-label {
          min-width: 40px;
        }
        #shadow-debug-panel #sdp-angle-value {
          font-family: monospace;
          font-size: 14px;
          color: #D9A464;
          min-width: 45px;
        }
        #shadow-debug-panel .angle-hint {
          font-size: 9px;
          color: #666;
        }
        #shadow-debug-panel .apply-angle-btn {
          width: 100%;
          padding: 6px 10px;
          margin-top: 4px;
          background: #D9A464;
          color: #000;
          border: none;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
        }
        #shadow-debug-panel .apply-angle-btn:hover {
          background: #E8B878;
        }
        #sdp-angle-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          pointer-events: none;
          z-index: 9998;
          display: none;
        }
        #sdp-angle-overlay.visible {
          display: block;
        }
        #sdp-angle-line {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 300px;
          height: 3px;
          background: linear-gradient(90deg, rgba(217,164,100,0) 0%, #D9A464 20%, #D9A464 80%, rgba(217,164,100,0) 100%);
          transform-origin: center center;
          transform: translate(-50%, -50%) rotate(45deg);
          box-shadow: 0 0 10px rgba(217,164,100,0.5);
        }
        #sdp-angle-center {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 12px;
          height: 12px;
          background: #D9A464;
          border: 2px solid #fff;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
        }
      </style>
      
      <h3>
        Shadow & Lighting <span class="active-badge" id="sdp-mode-badge">PCF</span>
        <button class="close-btn">&times;</button>
      </h3>
      
      <div class="section">
        <div class="section-header" data-section="direction">
          Light Direction <span class="toggle">▼</span>
        </div>
        <div class="section-content open" id="sdp-section-direction"></div>
      </div>
      
      <div class="section">
        <div class="section-header" data-section="angle_guide">
          Shadow Angle Guide <span class="toggle">▶</span>
        </div>
        <div class="section-content" id="sdp-section-angle_guide">
          <div class="checkbox-row">
            <label>
              <input type="checkbox" id="sdp-show-angle-guide">
              Show Guide Line
            </label>
          </div>
          <div class="angle-display">
            <span class="slider-label">Angle:</span>
            <span id="sdp-angle-value">45°</span>
            <span class="angle-hint">(↑↓ arrows to adjust)</span>
          </div>
          <button class="apply-angle-btn" id="sdp-apply-angle">Apply to Light Direction</button>
        </div>
      </div>
      
      <div class="section">
        <div class="section-header" data-section="light_position">
          Light Intensity <span class="toggle">▶</span>
        </div>
        <div class="section-content" id="sdp-section-light_position"></div>
      </div>
      
      <div class="section">
        <div class="section-header" data-section="filter">
          Shadow Filter Mode <span class="toggle">▼</span>
        </div>
        <div class="section-content open" id="sdp-section-filter">
          <div class="select-row">
            <span class="slider-label">Mode</span>
            <select id="sdp-filter-mode">
              <option value="pcf">PCF (Sharp)</option>
              <option value="exponential">Exponential + Kernel Blur</option>
              <option value="contact_hardening">Contact Hardening</option>
            </select>
          </div>
          <div class="select-row">
            <span class="slider-label">Resolution</span>
            <select id="sdp-shadow-resolution">
              <option value="256">256 (Very Soft)</option>
              <option value="512">512 (Soft)</option>
              <option value="1024">1024 (Medium)</option>
              <option value="2048">2048 (Sharp)</option>
              <option value="4096" selected>4096 (Very Sharp)</option>
            </select>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-header" data-section="shadow">
          Shadow Properties <span class="toggle">▼</span>
        </div>
        <div class="section-content open" id="sdp-section-shadow"></div>
      </div>
      
      <div class="section" id="sdp-exp-section">
        <div class="section-header" data-section="exponential">
          Exponential Mode <span class="toggle">▶</span>
        </div>
        <div class="section-content" id="sdp-section-exponential"></div>
      </div>
      
      <div class="section" id="sdp-ch-section">
        <div class="section-header" data-section="contact">
          Contact Hardening <span class="toggle">▶</span>
        </div>
        <div class="section-content" id="sdp-section-contact"></div>
      </div>
      
      <div class="section">
        <div class="section-header" data-section="receiver">
          Shadow Receiver <span class="toggle">▶</span>
        </div>
        <div class="section-content" id="sdp-section-receiver"></div>
      </div>
      
      <div class="section">
        <div class="section-header" data-section="ambient">
          Ambient Light <span class="toggle">▶</span>
        </div>
        <div class="section-content" id="sdp-section-ambient"></div>
      </div>
      
      <div class="section" id="sdp-advanced-section">
        <div class="section-header" data-section="advanced">
          Advanced <span class="toggle">▶</span>
        </div>
        <div class="section-content" id="sdp-section-advanced">
          <div class="checkbox-row">
            <label>
              <input type="checkbox" id="sdp-auto-light-pos" checked>
              Auto Light Position
            </label>
          </div>
          <div id="sdp-light-pos-sliders"></div>
          <div class="checkbox-row" style="margin-top: 10px;">
            <label>
              <input type="checkbox" id="sdp-force-back-faces">
              Force Back Faces Only
            </label>
          </div>
        </div>
      </div>
      
      <div class="button-row">
        <button class="reset-btn" title="Reset to scene config">Reset</button>
        <button class="defaults-btn" title="Reset to universal defaults">Defaults</button>
        <button class="copy-btn">Copy JSON</button>
      </div>
      
      <div class="json-output" id="sdp-json-output"></div>
    `;
    
    document.body.appendChild(this._panel);
    
    // Add sliders to sections
    const sections = ['direction', 'light_position', 'shadow', 'exponential', 'contact', 'receiver', 'ambient'];
    sections.forEach((section) => {
      const keys = this._sliders.filter(s => s.section === section).map(s => s.key);
      this._addSliders(`sdp-section-${section}`, keys);
    });
    
    // Advanced section - light position sliders go in sub-container
    const lightPosKeys = this._sliders.filter(s => s.section === 'advanced' && s.parentKey === 'light_position').map(s => s.key);
    this._addSliders('sdp-light-pos-sliders', lightPosKeys);
    
    // Advanced section - frustum and sky color sliders
    const advancedOtherKeys = this._sliders.filter(s => s.section === 'advanced' && s.parentKey !== 'light_position').map(s => s.key);
    this._addSliders('sdp-section-advanced', advancedOtherKeys);
    
    // Section toggle handlers
    this._panel.querySelectorAll('.section-header').forEach((header) => {
      header.addEventListener('click', () => {
        const section = header.getAttribute('data-section');
        const content = document.getElementById(`sdp-section-${section}`);
        const toggle = header.querySelector('.toggle');
        if (content && toggle) {
          const isOpen = content.classList.toggle('open');
          toggle.textContent = isOpen ? '▼' : '▶';
        }
      });
    });
    
    // Close button
    this._panel.querySelector('.close-btn')?.addEventListener('click', () => this._destroy());
    this._panel.querySelector('.reset-btn')?.addEventListener('click', () => this._reset());
    this._panel.querySelector('.defaults-btn')?.addEventListener('click', () => this._resetToDefaults());
    this._panel.querySelector('.copy-btn')?.addEventListener('click', () => this._copyJson());
    
    // Auto Light Position checkbox
    const autoLightPosCheckbox = this._panel.querySelector('#sdp-auto-light-pos') as HTMLInputElement;
    const lightPosSlidersContainer = document.getElementById('sdp-light-pos-sliders');
    if (autoLightPosCheckbox && lightPosSlidersContainer) {
      autoLightPosCheckbox.checked = this._currentConfig.auto_light_position;
      lightPosSlidersContainer.classList.toggle('disabled-sliders', this._currentConfig.auto_light_position);
      
      autoLightPosCheckbox.addEventListener('change', () => {
        this._currentConfig.auto_light_position = autoLightPosCheckbox.checked;
        lightPosSlidersContainer.classList.toggle('disabled-sliders', autoLightPosCheckbox.checked);
        this._applyConfig();
      });
    }
    
    // Force Back Faces Only checkbox
    const forceBackFacesCheckbox = this._panel.querySelector('#sdp-force-back-faces') as HTMLInputElement;
    if (forceBackFacesCheckbox) {
      forceBackFacesCheckbox.checked = this._currentConfig.force_back_faces_only;
      
      forceBackFacesCheckbox.addEventListener('change', () => {
        this._currentConfig.force_back_faces_only = forceBackFacesCheckbox.checked;
        this._applyConfig();
      });
    }
    
    // Filter mode select
    const filterSelect = this._panel.querySelector('#sdp-filter-mode') as HTMLSelectElement;
    filterSelect.value = this._currentConfig.shadow_filter_mode;
    filterSelect.addEventListener('change', (e) => {
      this._currentConfig.shadow_filter_mode = (e.target as HTMLSelectElement).value as any;
      this._updateModeDisplay();
      this._applyConfig();
    });
    
    // Resolution select
    const resSelect = this._panel.querySelector('#sdp-shadow-resolution') as HTMLSelectElement;
    resSelect.value = String(this._currentConfig.shadow_map_resolution);
    resSelect.addEventListener('change', (e) => {
      this._currentConfig.shadow_map_resolution = parseInt((e.target as HTMLSelectElement).value);
      this._applyResolution();
    });
    
    // Create angle guide overlay
    this._createAngleOverlay();
    
    // Angle guide checkbox
    const angleGuideCheckbox = this._panel.querySelector('#sdp-show-angle-guide') as HTMLInputElement;
    if (angleGuideCheckbox) {
      angleGuideCheckbox.addEventListener('change', () => {
        this._angleGuideActive = angleGuideCheckbox.checked;
        this._updateAngleOverlay();
      });
    }
    
    // Apply angle button
    const applyAngleBtn = this._panel.querySelector('#sdp-apply-angle');
    if (applyAngleBtn) {
      applyAngleBtn.addEventListener('click', () => this._applyAngleToDirection());
    }
    
    // Keyboard handler for angle adjustment
    this._keyHandler = (e: KeyboardEvent) => {
      if (!this._angleGuideActive) return;
      
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._currentAngle = (this._currentAngle - 1 + 360) % 360;
        this._updateAngleOverlay();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._currentAngle = (this._currentAngle + 1) % 360;
        this._updateAngleOverlay();
      }
    };
    document.addEventListener('keydown', this._keyHandler);
    
    this._updateModeDisplay();
  }
  
  private _createAngleOverlay(): void {
    this._angleOverlay = document.createElement('div');
    this._angleOverlay.id = 'sdp-angle-overlay';
    this._angleOverlay.innerHTML = `
      <div id="sdp-angle-line"></div>
      <div id="sdp-angle-center"></div>
    `;
    document.body.appendChild(this._angleOverlay);
  }
  
  private _updateAngleOverlay(): void {
    if (!this._angleOverlay) return;
    
    // Show/hide overlay
    this._angleOverlay.classList.toggle('visible', this._angleGuideActive);
    
    // Update line rotation
    const line = this._angleOverlay.querySelector('#sdp-angle-line') as HTMLElement;
    if (line) {
      line.style.transform = `translate(-50%, -50%) rotate(${this._currentAngle}deg)`;
    }
    
    // Update angle display
    const angleDisplay = document.getElementById('sdp-angle-value');
    if (angleDisplay) {
      angleDisplay.textContent = `${this._currentAngle}°`;
    }
  }
  
  private _applyAngleToDirection(): void {
    // Convert angle to light direction
    // Angle 0° = shadow pointing right = light from left (X positive)
    // Angle 90° = shadow pointing down = light from above (mostly Y)
    // Angle 180° = shadow pointing left = light from right (X negative)
    
    const angleRad = (this._currentAngle * Math.PI) / 180;
    
    // Light direction is opposite of shadow direction
    // For shadows at angle θ, light comes from θ + 180°
    const lightAngleRad = angleRad + Math.PI;
    
    // Calculate X and Z from the angle (in screen space)
    // X: positive = from left, negative = from right
    // Z: typically -1 (toward viewer)
    const dirX = Math.cos(lightAngleRad);
    const dirZ = -Math.abs(Math.sin(lightAngleRad)) - 0.5;  // Always some -Z component
    
    // Keep current Y or use sensible default
    const dirY = this._currentConfig.direction[1] || -0.5;
    
    // Normalize
    const length = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
    this._currentConfig.direction = [
      dirX / length,
      dirY / length,
      dirZ / length
    ];
    
    // Update sliders and apply
    this._updateAllSliderDisplays();
    this._applyConfig();
    
    // Visual feedback - flash the apply button
    const btn = document.getElementById('sdp-apply-angle');
    if (btn) {
      btn.style.background = '#8f8';
      setTimeout(() => { btn.style.background = ''; }, 200);
    }
  }

  private _updateModeDisplay(): void {
    const mode = this._currentConfig.shadow_filter_mode;
    const badge = document.getElementById('sdp-mode-badge');
    const expSection = document.getElementById('sdp-exp-section');
    const chSection = document.getElementById('sdp-ch-section');
    
    if (badge) {
      const labels: Record<string, string> = { pcf: 'PCF', exponential: 'EXP', contact_hardening: 'CH' };
      badge.textContent = labels[mode] || mode;
    }
    
    if (expSection) expSection.style.opacity = mode === 'exponential' ? '1' : '0.4';
    if (chSection) chSection.style.opacity = mode === 'contact_hardening' ? '1' : '0.4';
  }

  private _addSliders(containerId: string, keys: string[]): void {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    keys.forEach((key) => {
      const def = this._sliders.find(s => s.key === key);
      if (!def) return;
      
      const row = document.createElement('div');
      row.className = 'slider-row';
      row.id = `sdp-row-${def.key}`;
      row.innerHTML = `
        <span class="slider-label">${def.label}</span>
        <input type="range" id="sdp-slider-${def.key}" min="${def.min}" max="${def.max}" step="${def.step}" value="${def.defaultValue}">
        <span class="slider-value" id="sdp-value-${def.key}">${this._formatValue(def, def.defaultValue)}</span>
      `;
      container.appendChild(row);
      
      const slider = row.querySelector(`#sdp-slider-${def.key}`) as HTMLInputElement;
      const valueDisplay = row.querySelector(`#sdp-value-${def.key}`) as HTMLSpanElement;
      
      slider.addEventListener('input', () => {
        const val = parseFloat(slider.value);
        valueDisplay.textContent = this._formatValue(def, val);
        this._updateValue(def, val);
        this._applyConfig();
      });
    });
  }

  private _updateValue(def: SliderDef, value: number): void {
    if (def.parentKey && def.index !== undefined) {
      (this._currentConfig as any)[def.parentKey][def.index] = value;
    } else {
      (this._currentConfig as any)[def.key] = value;
    }
  }

  private _applyResolution(): void {
    const sm = this._sceneManager as any;
    if (!sm || !sm._shadowGenerator || !sm._directionalLight) return;
    
    const res = this._currentConfig.shadow_map_resolution;
    
    try {
      const currentMap = sm._shadowGenerator.getShadowMap();
      if (currentMap && currentMap.getSize().width !== res) {
        // Store current shadow casters
        const casters = [...sm._sectionMeshes];
        
        // Dispose old shadow generator
        sm._shadowGenerator.dispose();
        
        // Create new shadow generator with new resolution
        sm._shadowGenerator = new ShadowGenerator(res, sm._directionalLight);
        
        // Re-add all shadow casters
        casters.forEach((mesh: any) => {
          if (mesh && !mesh.isDisposed()) {
            sm._shadowGenerator.addShadowCaster(mesh);
          }
        });
        
        // Re-apply shadow generator settings
        this._applyConfig();
        
        // Recreate shadow receiver plane using SceneManager's method if available
        if (sm._currentCSGData && typeof sm._createShadowReceiver === 'function') {
          // Dispose existing receiver
          if (sm._shadowReceiverPlane) {
            // Remove from hemispheric light excluded meshes
            if (sm._hemisphericLight?.excludedMeshes) {
              const idx = sm._hemisphericLight.excludedMeshes.indexOf(sm._shadowReceiverPlane);
              if (idx > -1) {
                sm._hemisphericLight.excludedMeshes.splice(idx, 1);
              }
            }
            sm._shadowReceiverPlane.dispose();
            sm._shadowReceiverPlane = null;
          }
          // Recreate with proper transforms
          sm._createShadowReceiver(sm._currentCSGData);
        } else if (sm._shadowReceiverPlane) {
          // Fallback: just re-enable shadows on existing plane
          sm._shadowReceiverPlane.receiveShadows = true;
        }
        
        console.log('[ShadowDebugPanel] Resolution changed to', res);
      }
    } catch (e) {
      console.error('[ShadowDebugPanel] Resolution change failed:', e);
    }
  }

  private _applyConfig(): void {
    const sm = this._sceneManager as any;
    if (!sm) return;
    
    try {
      const cfg = this._currentConfig;
      
      // Directional light
      if (sm._directionalLight) {
        const direction = new Vector3(cfg.direction[0], cfg.direction[1], cfg.direction[2]).normalize();
        sm._directionalLight.direction = direction;
        
        if (cfg.auto_light_position) {
          // Auto-calculate position: 50 units behind artwork in opposite direction of light
          const artworkPos = sm._rootNode?.position || new Vector3(0, 0, 0);
          const autoPosition = artworkPos.subtract(direction.scale(50));
          sm._directionalLight.position = autoPosition;
          
          // Update our config to reflect actual position (for display purposes)
          this._currentConfig.light_position = [autoPosition.x, autoPosition.y, autoPosition.z];
        } else {
          // Use manual light position
          sm._directionalLight.position = new Vector3(
            cfg.light_position[0],
            cfg.light_position[1],
            cfg.light_position[2]
          );
        }
        
        sm._directionalLight.intensity = cfg.intensity;
        
        // Apply shadow frustum size (orthographic projection bounds)
        const frustumSize = cfg.shadow_frustum_size;
        sm._directionalLight.orthoLeft = -frustumSize;
        sm._directionalLight.orthoRight = frustumSize;
        sm._directionalLight.orthoTop = frustumSize;
        sm._directionalLight.orthoBottom = -frustumSize;
      }
      
      // Shadow generator
      if (sm._shadowGenerator) {
        const sg = sm._shadowGenerator;
        const mode = cfg.shadow_filter_mode;
        
        sg.darkness = cfg.shadow_darkness;
        sg.bias = cfg.shadow_bias;
        sg.normalBias = cfg.shadow_normal_bias;
        sg.frustumEdgeFalloff = cfg.frustum_edge_falloff;
        sg.forceBackFacesOnly = cfg.force_back_faces_only;
        
        // Reset all modes
        sg.useBlurExponentialShadowMap = false;
        sg.usePercentageCloserFiltering = false;
        sg.useContactHardeningShadow = false;
        sg.useKernelBlur = false;
        
        if (mode === 'exponential') {
          sg.useBlurExponentialShadowMap = true;
          sg.useKernelBlur = true;
          sg.blurKernel = cfg.blur_kernel;
          sg.blurScale = cfg.shadow_blur;
        } else if (mode === 'pcf') {
          sg.usePercentageCloserFiltering = true;
          sg.filteringQuality = 2; // QUALITY_HIGH
        } else if (mode === 'contact_hardening') {
          sg.useContactHardeningShadow = true;
          sg.contactHardeningLightSizeUVRatio = cfg.contact_hardening_light_size;
          sg.filteringQuality = 2; // QUALITY_HIGH
        }
      }
      
      // Shadow receiver
      if (sm._shadowReceiverPlane) {
        sm._shadowReceiverPlane.position = new Vector3(
          cfg.shadow_receiver_position[0],
          cfg.shadow_receiver_position[1],
          cfg.shadow_receiver_position[2]
        );
        
        if (sm._shadowReceiverPlane.material?.shadowLevel !== undefined) {
          sm._shadowReceiverPlane.material.shadowLevel = cfg.shadow_darkness;  // Sync with darkness (shadow_level slider removed)
        }
      }
      
      // Hemispheric light
      if (sm._hemisphericLight) {
        sm._hemisphericLight.intensity = 1.0 + cfg.ambient_boost;
        sm._hemisphericLight.groundColor = new Color3(
          cfg.ambient_ground_color[0],
          cfg.ambient_ground_color[1],
          cfg.ambient_ground_color[2]
        );
        // Apply sky color (diffuse)
        sm._hemisphericLight.diffuse = new Color3(
          cfg.hemispheric_sky_color[0],
          cfg.hemispheric_sky_color[1],
          cfg.hemispheric_sky_color[2]
        );
      }
      
      // Scene
      if (sm._scene) {
        sm._scene.environmentIntensity = cfg.environment_intensity;
      }
      
    } catch (e) {
      console.error('[ShadowDebugPanel] Apply failed:', e);
    }
  }

  private _reset(): void {
    // Reset to scene's initial values (from backgrounds.json config)
    if (this._baselineConfig) {
      this._currentConfig = JSON.parse(JSON.stringify(this._baselineConfig));
    } else {
      this._currentConfig = this._getDefaultConfig();
    }
    
    this._updateAllSliderDisplays();
    this._updateDropdowns();
    this._updateModeDisplay();
    this._applyResolution();
    this._applyConfig();
  }
  
  private _resetToDefaults(): void {
    // Reset to hardcoded universal defaults (ignores backgrounds.json)
    this._currentConfig = this._getDefaultConfig();
    
    this._updateAllSliderDisplays();
    this._updateDropdowns();
    this._updateModeDisplay();
    this._applyResolution();
    this._applyConfig();
  }

  private _copyJson(): void {
    const cfg = this._currentConfig;
    const defaults = this._getDefaultConfig();
    
    // Normalize direction vector
    const dir = cfg.direction;
    const len = Math.sqrt(dir[0]*dir[0] + dir[1]*dir[1] + dir[2]*dir[2]);
    const normDir = len > 0 ? dir.map(v => Math.round((v / len) * 100) / 100) : dir;
    
    // Always include these (essential for any lighting config)
    const output: Record<string, any> = {
      direction: normDir,
      shadow_enabled: true,
    };
    
    // Helper to check if value differs from default
    const notDefault = (key: keyof ShadowConfig, precision = 100): boolean => {
      const val = cfg[key];
      const def = defaults[key];
      if (Array.isArray(val) && Array.isArray(def)) {
        return val.some((v, i) => Math.round(v * precision) !== Math.round((def as number[])[i] * precision));
      }
      if (typeof val === 'number' && typeof def === 'number') {
        return Math.round(val * precision) !== Math.round(def * precision);
      }
      return val !== def;
    };
    
    // Core lighting - include if non-default
    if (notDefault('intensity')) {
      output.intensity = cfg.intensity;
    }
    if (notDefault('shadow_darkness')) {
      output.shadow_darkness = cfg.shadow_darkness;
    }
    if (notDefault('shadow_filter_mode')) {
      output.shadow_filter_mode = cfg.shadow_filter_mode;
    }
    if (notDefault('shadow_map_resolution')) {
      output.shadow_map_resolution = cfg.shadow_map_resolution;
    }
    if (notDefault('ambient_boost')) {
      output.ambient_boost = cfg.ambient_boost;
    }
    
    // Ground color - include if not black
    if (notDefault('ambient_ground_color')) {
      output.ambient_ground_color = cfg.ambient_ground_color.map(v => Math.round(v * 100) / 100);
    }
    
    // Shadow receiver position - include if non-default
    if (notDefault('shadow_receiver_position', 1000)) {
      output.shadow_receiver_position = cfg.shadow_receiver_position.map(v => Math.round(v * 1000) / 1000);
    }
    
    // Mode-specific - only if that mode is active AND value differs
    if (cfg.shadow_filter_mode === 'exponential') {
      if (notDefault('shadow_blur')) {
        output.shadow_blur = cfg.shadow_blur;
      }
      if (notDefault('blur_kernel')) {
        output.blur_kernel = cfg.blur_kernel;
      }
    }
    if (cfg.shadow_filter_mode === 'contact_hardening') {
      if (notDefault('contact_hardening_light_size')) {
        output.contact_hardening_light_size = cfg.contact_hardening_light_size;
      }
    }
    
    // Advanced/troubleshooting - only if non-default
    if (notDefault('shadow_bias', 10000)) {
      output.shadow_bias = cfg.shadow_bias;
    }
    if (notDefault('shadow_normal_bias', 10000)) {
      output.shadow_normal_bias = cfg.shadow_normal_bias;
    }
    if (notDefault('hemispheric_sky_color')) {
      output.hemispheric_sky_color = cfg.hemispheric_sky_color.map(v => Math.round(v * 100) / 100);
    }
    
    // Format JSON to match backgrounds.json style
    // Compact arrays, wrapped in "lighting" key, 10-space indent for properties
    const indent = '          ';  // 10 spaces to match file
    const lines = Object.entries(output).map(([key, val]) => {
      const valStr = Array.isArray(val) 
        ? `[${val.join(', ')}]`
        : JSON.stringify(val);
      return `${indent}"${key}": ${valStr}`;
    });
    const jsonStr = `"lighting": {\n${lines.join(',\n')}\n        }`;
    
    navigator.clipboard.writeText(jsonStr).then(() => {
      console.log('[ShadowDebugPanel] Copied to clipboard');
    });
    
    const jsonOutput = document.getElementById('sdp-json-output');
    if (jsonOutput) {
      jsonOutput.textContent = jsonStr;
      jsonOutput.classList.add('visible');
    }
  }
}
