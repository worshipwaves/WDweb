/**
 * PlacementDebugPanel - Measurement and placement tool for room staging
 * 
 * Toggle with Ctrl+Shift+P or call PlacementDebugPanel.toggle()
 * Enable by setting DEBUG_PLACEMENT_PANEL = true
 * 
 * Features:
 * - Measure reference objects (doors, frames) to establish pixels-per-inch
 * - Click to set artwork placement anchor point
 * - Calculate scale_factor based on known artwork dimensions
 * - Output JSON for backgrounds.json art_placement
 */

import { Vector3, PickingInfo } from '@babylonjs/core';
import type { SceneManager } from '../src/SceneManager';

// Configuration flag - set to true to enable the debug panel
export const DEBUG_PLACEMENT_PANEL = true;

interface PlacementConfig {
  position: [number, number, number];
  scale_factor: number;
  rotation: [number, number, number];
}

interface MeasurementPoint {
  screenX: number;
  screenY: number;
  scenePos?: Vector3;
}

type Mode = 'idle' | 'measure' | 'place';

export class PlacementDebugPanel {
  private static _instance: PlacementDebugPanel | null = null;
  private static _enabled = DEBUG_PLACEMENT_PANEL;
  
  private _panel: HTMLDivElement | null = null;
  private _sceneManager: SceneManager | null = null;
  private _overlay: HTMLCanvasElement | null = null;
  
  private _mode: Mode = 'idle';
  private _measurePoints: MeasurementPoint[] = [];
  private _placementPoint: MeasurementPoint | null = null;
  private _pixelsPerInch: number = 0;
  private _referenceDimensionInches: number = 80; // Default: standard door height
  
  private _currentConfig: PlacementConfig = {
    position: [0, 0, -20],
    scale_factor: 0.66,
    rotation: [0, 0, 0]
  };
  
  // Scene coordinate estimation parameters
  private _sceneDepth: number = -20;  // Z position for artwork plane
  private _artworkWidthInches: number = 36;  // For scale calculation
  
  private constructor() {}

  /**
   * Initialize keyboard shortcut listener
   */
  public static init(sceneManager: SceneManager): void {
    if (!PlacementDebugPanel._enabled) return;
    
    if (!PlacementDebugPanel._instance) {
      PlacementDebugPanel._instance = new PlacementDebugPanel();
    }
    
    PlacementDebugPanel._instance._sceneManager = sceneManager;
    
    // Register keyboard shortcut: Ctrl+Shift+P (P for Placement)
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        PlacementDebugPanel.toggle();
      }
    });
    
    console.log('[PlacementDebugPanel] Initialized. Press Ctrl+Shift+P to toggle.');
  }

  /**
   * Enable/disable the debug panel feature
   */
  public static setEnabled(enabled: boolean): void {
    PlacementDebugPanel._enabled = enabled;
  }

  /**
   * Toggle panel visibility
   */
  public static toggle(): void {
    if (!PlacementDebugPanel._enabled) {
      console.log('[PlacementDebugPanel] Not enabled. Set DEBUG_PLACEMENT_PANEL = true');
      return;
    }
    
    if (!PlacementDebugPanel._instance) {
      console.warn('[PlacementDebugPanel] Not initialized. Call init() first.');
      return;
    }
    
    if (PlacementDebugPanel._instance._panel) {
      PlacementDebugPanel._instance._destroy();
    } else {
      PlacementDebugPanel._instance._createPanel();
      PlacementDebugPanel._instance._createOverlay();
    }
  }

  private _destroy(): void {
    if (this._panel) {
      this._panel.remove();
      this._panel = null;
    }
    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }
    this._mode = 'idle';
    this._measurePoints = [];
    this._placementPoint = null;
  }

  private _createOverlay(): void {
    // Canvas overlay for drawing measurement lines and points
    this._overlay = document.createElement('canvas');
    this._overlay.id = 'pdp-overlay';
    this._overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 9997;
    `;
    document.body.appendChild(this._overlay);
    
    // Match canvas resolution to window
    this._overlay.width = window.innerWidth;
    this._overlay.height = window.innerHeight;
    
    window.addEventListener('resize', () => {
      if (this._overlay) {
        this._overlay.width = window.innerWidth;
        this._overlay.height = window.innerHeight;
        this._redrawOverlay();
      }
    });
  }

  private _redrawOverlay(): void {
    if (!this._overlay) return;
    const ctx = this._overlay.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, this._overlay.width, this._overlay.height);
    
    // Draw measurement points and line
    if (this._measurePoints.length > 0) {
      ctx.fillStyle = '#D9A464';
      ctx.strokeStyle = '#D9A464';
      ctx.lineWidth = 2;
      
      this._measurePoints.forEach((pt, idx) => {
        // Draw point
        ctx.beginPath();
        ctx.arc(pt.screenX, pt.screenY, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Label
        ctx.font = '12px monospace';
        ctx.fillText(`P${idx + 1}`, pt.screenX + 10, pt.screenY - 10);
      });
      
      // Draw line between points
      if (this._measurePoints.length === 2) {
        ctx.beginPath();
        ctx.moveTo(this._measurePoints[0].screenX, this._measurePoints[0].screenY);
        ctx.lineTo(this._measurePoints[1].screenX, this._measurePoints[1].screenY);
        ctx.stroke();
        
        // Calculate and display pixel distance
        const dx = this._measurePoints[1].screenX - this._measurePoints[0].screenX;
        const dy = this._measurePoints[1].screenY - this._measurePoints[0].screenY;
        const pixelDist = Math.sqrt(dx * dx + dy * dy);
        
        const midX = (this._measurePoints[0].screenX + this._measurePoints[1].screenX) / 2;
        const midY = (this._measurePoints[0].screenY + this._measurePoints[1].screenY) / 2;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(midX - 40, midY - 20, 80, 24);
        ctx.fillStyle = '#D9A464';
        ctx.fillText(`${pixelDist.toFixed(0)}px`, midX - 20, midY - 2);
      }
    }
    
    // Draw placement point
    if (this._placementPoint) {
      ctx.fillStyle = '#4ADE80';
      ctx.strokeStyle = '#4ADE80';
      ctx.lineWidth = 2;
      
      // Crosshair
      const px = this._placementPoint.screenX;
      const py = this._placementPoint.screenY;
      
      ctx.beginPath();
      ctx.moveTo(px - 15, py);
      ctx.lineTo(px + 15, py);
      ctx.moveTo(px, py - 15);
      ctx.lineTo(px, py + 15);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.font = '12px monospace';
      ctx.fillText('ANCHOR', px + 12, py - 12);
    }
  }

  private _handleCanvasClick(e: MouseEvent): void {
    // Get click position relative to the BabylonJS canvas
    const canvas = this._sceneManager?._engine?.getRenderingCanvas();
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX;
    const screenY = e.clientY;
    
    // Check if click is within canvas bounds
    if (screenX < rect.left || screenX > rect.right || 
        screenY < rect.top || screenY > rect.bottom) {
      return;
    }
    
    if (this._mode === 'measure') {
      if (this._measurePoints.length < 2) {
        this._measurePoints.push({ screenX, screenY });
        
        if (this._measurePoints.length === 2) {
          this._calculatePPI();
        }
        
        this._redrawOverlay();
        this._updateDisplay();
      }
    } else if (this._mode === 'place') {
      // Convert screen coords to scene position
      const scenePos = this._screenToScene(screenX, screenY);
      
      console.log('[PlacementDebugPanel] Click screen:', screenX, screenY);
      console.log('[PlacementDebugPanel] Calculated scene pos:', scenePos.x, scenePos.y, scenePos.z);
      
      this._placementPoint = { screenX, screenY, scenePos };
      this._currentConfig.position = [scenePos.x, scenePos.y, scenePos.z];
      
      this._redrawOverlay();
      this._updateDisplay();
    }
  }

  private _screenToScene(screenX: number, screenY: number): Vector3 {
    const sm = this._sceneManager as any;
    if (!sm || !sm._scene || !sm._camera) {
      return new Vector3(0, 0, this._sceneDepth);
    }
    
    const scene = sm._scene;
    const camera = sm._camera;
    const canvas = sm._engine.getRenderingCanvas();
    
    if (!canvas) return new Vector3(0, 0, this._sceneDepth);
    
    const rect = canvas.getBoundingClientRect();
    
    // Normalize to canvas coordinates
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    
    // Create a picking ray from the camera through the click point
    const pickRay = scene.createPickingRay(
      canvasX,
      canvasY,
      null,
      camera
    );
    
    // Calculate where ray intersects the artwork plane (Z = _sceneDepth)
    // Ray: origin + direction * t
    // Solve for t where ray.z = _sceneDepth
    if (Math.abs(pickRay.direction.z) > 0.0001) {
      const t = (this._sceneDepth - pickRay.origin.z) / pickRay.direction.z;
      const intersect = pickRay.origin.add(pickRay.direction.scale(t));
      return intersect;
    }
    
    return new Vector3(0, 0, this._sceneDepth);
  }

  private _calculatePPI(): void {
    if (this._measurePoints.length < 2) return;
    
    const dx = this._measurePoints[1].screenX - this._measurePoints[0].screenX;
    const dy = this._measurePoints[1].screenY - this._measurePoints[0].screenY;
    const pixelDist = Math.sqrt(dx * dx + dy * dy);
    
    if (this._referenceDimensionInches > 0) {
      this._pixelsPerInch = pixelDist / this._referenceDimensionInches;
      console.log(`[PlacementDebugPanel] PPI calculated: ${this._pixelsPerInch.toFixed(2)}`);
    }
  }

  private _calculateScaleFactor(): void {
    if (this._pixelsPerInch <= 0 || this._artworkWidthInches <= 0) return;
    
    // Get current canvas width
    const canvas = this._sceneManager?._engine?.getRenderingCanvas();
    if (!canvas) return;
    
    // Calculate what portion of the canvas the artwork should occupy
    // Based on how many pixels the artwork would be at current PPI
    const artworkPixels = this._artworkWidthInches * this._pixelsPerInch;
    
    // At scale_factor 1.0, artwork fills most of the view
    // Estimate baseline: artwork at 60" wide at scale 1.0 fills ~80% of 1920px canvas
    // This is an approximation - adjust based on actual camera setup
    const baselineArtworkPixels = 0.8 * canvas.width;
    const baselineWidthInches = 60;
    const baselinePPI = baselineArtworkPixels / baselineWidthInches;
    
    // Scale factor relative to baseline
    this._currentConfig.scale_factor = this._pixelsPerInch / baselinePPI;
    
    console.log(`[PlacementDebugPanel] Scale factor: ${this._currentConfig.scale_factor.toFixed(3)}`);
  }

  private _updateDisplay(): void {
    // Update PPI display
    const ppiEl = document.getElementById('pdp-ppi-value');
    if (ppiEl) {
      ppiEl.textContent = this._pixelsPerInch > 0 
        ? this._pixelsPerInch.toFixed(2) 
        : '--';
    }
    
    // Update position display
    const posEl = document.getElementById('pdp-position-value');
    if (posEl) {
      const pos = this._currentConfig.position;
      posEl.textContent = `[${pos[0].toFixed(2)}, ${pos[1].toFixed(2)}, ${pos[2].toFixed(2)}]`;
    }
    
    // Update scale factor display
    const scaleEl = document.getElementById('pdp-scale-value');
    if (scaleEl) {
      scaleEl.textContent = this._currentConfig.scale_factor.toFixed(3);
    }
    
    // Update pixel distance display
    const pixDistEl = document.getElementById('pdp-pixel-dist');
    if (pixDistEl && this._measurePoints.length === 2) {
      const dx = this._measurePoints[1].screenX - this._measurePoints[0].screenX;
      const dy = this._measurePoints[1].screenY - this._measurePoints[0].screenY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      pixDistEl.textContent = dist.toFixed(0);
    }
  }

  private _copyJson(): void {
    const cfg = this._currentConfig;
    
    // Format position array with 2 decimal places
    const posStr = `[${cfg.position[0].toFixed(2)}, ${cfg.position[1].toFixed(2)}, ${cfg.position[2].toFixed(2)}]`;
    const rotStr = `[${cfg.rotation[0]}, ${cfg.rotation[1]}, ${cfg.rotation[2]}]`;
    
    // Match backgrounds.json indentation (10 spaces)
    const indent = '          ';
    const jsonStr = `"art_placement": {
${indent}"position": ${posStr},
${indent}"scale_factor": ${cfg.scale_factor.toFixed(3)},
${indent}"rotation": ${rotStr}
        }`;
    
    navigator.clipboard.writeText(jsonStr).then(() => {
      console.log('[PlacementDebugPanel] Copied to clipboard');
    });
    
    const jsonOutput = document.getElementById('pdp-json-output');
    if (jsonOutput) {
      jsonOutput.textContent = jsonStr;
      jsonOutput.classList.add('visible');
    }
  }

  private _applyPlacement(): void {
    const sm = this._sceneManager as any;
    if (sm && typeof sm.applyArtPlacement === 'function') {
      sm.applyArtPlacement(this._currentConfig);
      console.log('[PlacementDebugPanel] Applied placement:', this._currentConfig);
    }
  }

  private _setMode(mode: Mode): void {
    this._mode = mode;
    
    // Update button states
    const measureBtn = document.getElementById('pdp-measure-btn');
    const placeBtn = document.getElementById('pdp-place-btn');
    
    if (measureBtn) {
      measureBtn.classList.toggle('active', mode === 'measure');
    }
    if (placeBtn) {
      placeBtn.classList.toggle('active', mode === 'place');
    }
    
    // Update cursor and overlay pointer events
    if (this._overlay) {
      this._overlay.style.pointerEvents = mode !== 'idle' ? 'auto' : 'none';
      this._overlay.style.cursor = mode === 'measure' ? 'crosshair' : 
                                   mode === 'place' ? 'cell' : 'default';
    }
    
    // Status message
    const statusEl = document.getElementById('pdp-status');
    if (statusEl) {
      const messages: Record<Mode, string> = {
        idle: 'Select a mode above',
        measure: 'Click two points to measure',
        place: 'Click to set anchor point'
      };
      statusEl.textContent = messages[mode];
    }
  }

  private _clearMeasurement(): void {
    this._measurePoints = [];
    this._pixelsPerInch = 0;
    this._redrawOverlay();
    this._updateDisplay();
  }

  private _clearPlacement(): void {
    this._placementPoint = null;
    this._currentConfig.position = [0, 0, this._sceneDepth];
    this._redrawOverlay();
    this._updateDisplay();
  }

  private _createPanel(): void {
    this._panel = document.createElement('div');
    this._panel.id = 'placement-debug-panel';
    this._panel.innerHTML = `
      <style>
        #placement-debug-panel {
          position: fixed;
          top: 10px;
          right: 10px;
          width: 320px;
          max-height: 90vh;
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
        #placement-debug-panel::-webkit-scrollbar { width: 6px; }
        #placement-debug-panel::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        #placement-debug-panel::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
        #placement-debug-panel h3 {
          margin: 0 0 12px 0;
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        #placement-debug-panel .close-btn {
          background: none;
          border: none;
          color: #888;
          font-size: 18px;
          cursor: pointer;
          padding: 0 4px;
        }
        #placement-debug-panel .close-btn:hover { color: #fff; }
        #placement-debug-panel .section {
          margin-bottom: 10px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 6px;
          padding: 10px;
        }
        #placement-debug-panel .section-title {
          font-size: 10px;
          font-weight: 600;
          color: #aaa;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        #placement-debug-panel .mode-buttons {
          display: flex;
          gap: 6px;
          margin-bottom: 8px;
        }
        #placement-debug-panel .mode-btn {
          flex: 1;
          padding: 8px;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 4px;
          background: rgba(255,255,255,0.05);
          color: #ccc;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s;
        }
        #placement-debug-panel .mode-btn:hover {
          background: rgba(255,255,255,0.1);
        }
        #placement-debug-panel .mode-btn.active {
          background: #D9A464;
          color: #000;
          border-color: #D9A464;
        }
        #placement-debug-panel .status {
          font-size: 10px;
          color: #888;
          text-align: center;
          padding: 4px;
          background: rgba(0,0,0,0.3);
          border-radius: 3px;
        }
        #placement-debug-panel .input-row {
          display: flex;
          align-items: center;
          margin-bottom: 6px;
          gap: 8px;
        }
        #placement-debug-panel .input-label {
          flex: 0 0 100px;
          color: #999;
          font-size: 10px;
        }
        #placement-debug-panel input[type="number"] {
          flex: 1;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 4px;
          color: #e0e0e0;
          padding: 5px 8px;
          font-size: 11px;
          width: 60px;
        }
        #placement-debug-panel .value-display {
          font-family: monospace;
          color: #D9A464;
          font-size: 11px;
        }
        #placement-debug-panel .result-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        #placement-debug-panel .result-label {
          color: #888;
          font-size: 10px;
        }
        #placement-debug-panel .result-value {
          font-family: monospace;
          color: #4ADE80;
          font-size: 11px;
        }
        #placement-debug-panel .button-row {
          display: flex;
          gap: 6px;
          margin-top: 8px;
        }
        #placement-debug-panel button {
          flex: 1;
          padding: 7px 10px;
          border: none;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
        }
        #placement-debug-panel .apply-btn { background: #4ADE80; color: #000; }
        #placement-debug-panel .apply-btn:hover { background: #5AEE90; }
        #placement-debug-panel .copy-btn { background: #D9A464; color: #000; }
        #placement-debug-panel .copy-btn:hover { background: #e8b574; }
        #placement-debug-panel .clear-btn { background: rgba(255,255,255,0.1); color: #ccc; }
        #placement-debug-panel .clear-btn:hover { background: rgba(255,255,255,0.15); }
        #placement-debug-panel .json-output {
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
        #placement-debug-panel .json-output.visible { display: block; }
        #placement-debug-panel .hint {
          font-size: 9px;
          color: #666;
          margin-top: 4px;
        }
      </style>
      
      <h3>
        Art Placement Tool
        <button class="close-btn">&times;</button>
      </h3>
      
      <div class="section">
        <div class="section-title">Mode</div>
        <div class="mode-buttons">
          <button class="mode-btn" id="pdp-measure-btn">📏 Measure</button>
          <button class="mode-btn" id="pdp-place-btn">📍 Place</button>
        </div>
        <div class="status" id="pdp-status">Select a mode above</div>
      </div>
      
      <div class="section">
        <div class="section-title">Reference Measurement</div>
        <div class="input-row">
          <span class="input-label">Real dimension (in)</span>
          <input type="number" id="pdp-ref-dimension" value="80" min="1" max="200" step="0.5">
        </div>
        <div class="hint">Standard door = 80", Frame = artist-provided</div>
        <div class="result-row">
          <span class="result-label">Pixel Distance</span>
          <span class="result-value" id="pdp-pixel-dist">--</span>
        </div>
        <div class="result-row">
          <span class="result-label">Pixels Per Inch</span>
          <span class="result-value" id="pdp-ppi-value">--</span>
        </div>
        <div class="button-row">
          <button class="clear-btn" id="pdp-clear-measure">Clear</button>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Artwork Size</div>
        <div class="input-row">
          <span class="input-label">Width (inches)</span>
          <input type="number" id="pdp-artwork-width" value="36" min="6" max="120" step="1">
        </div>
        <div class="button-row">
          <button class="clear-btn" id="pdp-calc-scale">Calculate Scale</button>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Scene Position</div>
        <div class="input-row">
          <span class="input-label">Depth (Z)</span>
          <input type="number" id="pdp-scene-depth" value="-20" min="-50" max="0" step="1">
        </div>
        <div class="result-row">
          <span class="result-label">Position</span>
          <span class="result-value" id="pdp-position-value">[0.00, 0.00, -20.00]</span>
        </div>
        <div class="result-row">
          <span class="result-label">Scale Factor</span>
          <span class="result-value" id="pdp-scale-value">0.660</span>
        </div>
        <div class="button-row">
          <button class="clear-btn" id="pdp-clear-place">Clear</button>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Manual Adjustments</div>
        <div class="input-row">
          <span class="input-label">Position X</span>
          <input type="number" id="pdp-pos-x" value="0" step="0.1">
        </div>
        <div class="input-row">
          <span class="input-label">Position Y</span>
          <input type="number" id="pdp-pos-y" value="0" step="0.1">
        </div>
        <div class="input-row">
          <span class="input-label">Scale Factor</span>
          <input type="number" id="pdp-scale-input" value="0.66" min="0.1" max="2" step="0.01">
        </div>
      </div>
      
      <div class="button-row">
        <button class="apply-btn" id="pdp-apply-btn">Apply</button>
        <button class="copy-btn" id="pdp-copy-btn">Copy JSON</button>
      </div>
      
      <div class="json-output" id="pdp-json-output"></div>
    `;
    
    document.body.appendChild(this._panel);
    
    // Event handlers
    this._panel.querySelector('.close-btn')?.addEventListener('click', () => this._destroy());
    
    // Mode buttons
    document.getElementById('pdp-measure-btn')?.addEventListener('click', () => {
      this._setMode(this._mode === 'measure' ? 'idle' : 'measure');
    });
    document.getElementById('pdp-place-btn')?.addEventListener('click', () => {
      this._setMode(this._mode === 'place' ? 'idle' : 'place');
    });
    
    // Reference dimension input
    const refDimInput = document.getElementById('pdp-ref-dimension') as HTMLInputElement;
    refDimInput?.addEventListener('change', () => {
      this._referenceDimensionInches = parseFloat(refDimInput.value) || 80;
      this._calculatePPI();
      this._updateDisplay();
    });
    
    // Artwork width input
    const artworkWidthInput = document.getElementById('pdp-artwork-width') as HTMLInputElement;
    artworkWidthInput?.addEventListener('change', () => {
      this._artworkWidthInches = parseFloat(artworkWidthInput.value) || 36;
    });
    
    // Scene depth input
    const sceneDepthInput = document.getElementById('pdp-scene-depth') as HTMLInputElement;
    sceneDepthInput?.addEventListener('change', () => {
      this._sceneDepth = parseFloat(sceneDepthInput.value) || -20;
      this._currentConfig.position[2] = this._sceneDepth;
      this._updateDisplay();
    });
    
    // Manual adjustment inputs
    const posXInput = document.getElementById('pdp-pos-x') as HTMLInputElement;
    const posYInput = document.getElementById('pdp-pos-y') as HTMLInputElement;
    const scaleInput = document.getElementById('pdp-scale-input') as HTMLInputElement;
    
    posXInput?.addEventListener('change', () => {
      this._currentConfig.position[0] = parseFloat(posXInput.value) || 0;
      this._updateDisplay();
    });
    posYInput?.addEventListener('change', () => {
      this._currentConfig.position[1] = parseFloat(posYInput.value) || 0;
      this._updateDisplay();
    });
    scaleInput?.addEventListener('change', () => {
      this._currentConfig.scale_factor = parseFloat(scaleInput.value) || 0.66;
      this._updateDisplay();
    });
    
    // Clear buttons
    document.getElementById('pdp-clear-measure')?.addEventListener('click', () => this._clearMeasurement());
    document.getElementById('pdp-clear-place')?.addEventListener('click', () => this._clearPlacement());
    
    // Calculate scale button
    document.getElementById('pdp-calc-scale')?.addEventListener('click', () => {
      this._calculateScaleFactor();
      this._updateDisplay();
    });
    
    // Apply and copy buttons
    document.getElementById('pdp-apply-btn')?.addEventListener('click', () => this._applyPlacement());
    document.getElementById('pdp-copy-btn')?.addEventListener('click', () => this._copyJson());
    
    // Canvas click handler (ignore clicks on the panel itself)
    document.addEventListener('click', (e) => {
      if (this._panel?.contains(e.target as Node)) return;
      this._handleCanvasClick(e);
    });
    
    this._updateDisplay();
  }
}
