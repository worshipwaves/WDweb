/**
 * AudioDevPanel - Developer panel for audio parameter inspection and control.
 * Mirrors the PyQt Audio tab for parity testing during development.
 * Toggle with Ctrl+Shift+A. Draggable, always-on-top overlay.
 *
 * Architecture:
 * - On open/reset: snapshots lastRenderedSnapshot from controller (exact render params)
 * - All fields edit a local _editBuffer only — no side effects until Process is clicked
 * - Process: builds composition from _editBuffer, calls applyWithDevParams on slicer
 * - Reset: re-renders from snapshot, restores all fields
 */

import type { ApplicationController } from '../src/ApplicationController';
import type { CompositionStateDTO } from '../src/types/schemas';

export const DEBUG_AUDIO_PANEL = true;

interface DevSnapshot {
  composition: CompositionStateDTO;
  rawSamples: Float32Array;
  isolateVocals: boolean;
}

export class AudioDevPanel {
  private static _instance: AudioDevPanel | null = null;
  private _controller: ApplicationController;
  private _panel: HTMLElement | null = null;
  private _visible = false;
  private _dragOffsetX = 0;
  private _dragOffsetY = 0;
  private _dragging = false;

  // Snapshot taken at open/reset — source of truth for Reset
  private _snapshot: DevSnapshot | null = null;

  // Local edit buffer — fields write here, Process reads from here
  private _editBuffer: Record<string, unknown> = {};

  private constructor(controller: ApplicationController) {
    this._controller = controller;
  }

  static init(controller: ApplicationController): void {
    if (!AudioDevPanel._instance) {
      AudioDevPanel._instance = new AudioDevPanel(controller);
    }
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        AudioDevPanel._instance!._toggle();
      }
    });
    console.log('[AudioDevPanel] Ready. Toggle with Ctrl+Shift+A');
  }

  private _toggle(): void {
    if (this._visible) {
      this._hide();
    } else {
      this._show();
    }
  }

  private _show(): void {
    this._takeSnapshot();
    if (!this._panel) {
      this._panel = this._build();
      document.body.appendChild(this._panel);
    }
    this._panel.style.display = 'block';
    this._visible = true;
    this._rebuildFields();
  }

  private _hide(): void {
    if (this._panel) this._panel.style.display = 'none';
    this._visible = false;
    (window as any).__audioDevOverrides__ = null;
  }

  private _takeSnapshot(): void {
    const snap = (this._controller as any).lastRenderedSnapshot as DevSnapshot | null;
    if (snap) {
      this._snapshot = {
        composition: JSON.parse(JSON.stringify(snap.composition)),
        rawSamples: new Float32Array(snap.rawSamples),
        isolateVocals: snap.isolateVocals
      };
      // Initialise edit buffer from snapshot
      this._editBuffer = this._flattenSnapshot(this._snapshot);
    } else {
      // Fallback: no render has occurred yet, read from current state
      const state = this._controller.getState();
      if (!state) return;
      const slicer = (this._controller as any)._audioSlicerPanel;
      this._snapshot = null;
      this._editBuffer = this._flattenState(
        state.composition,
        slicer?._isolateVocals ?? state.composition.audio_source?.use_stems ?? false
      );
    }
  }

  private _flattenSnapshot(snap: DevSnapshot): Record<string, unknown> {
    return this._flattenState(snap.composition, snap.isolateVocals);
  }

  private _flattenState(comp: CompositionStateDTO, isolateVocals: boolean): Record<string, unknown> {
    const ap = comp.audio_processing;
    const ps = comp.pattern_settings;
    const src = comp.audio_source;
    return {
      'src.start_time': src.start_time ?? 0,
      'src.end_time': src.end_time ?? 0,
      'src.use_stems': isolateVocals,
      'ap.remove_silence': ap.remove_silence,
      'ap.silence_threshold': ap.silence_threshold,
      'ap.silence_duration': ap.silence_duration,
      'ap.demucs_silence_threshold': ap.demucs_silence_threshold ?? -35,
      'ap.demucs_silence_duration': ap.demucs_silence_duration ?? 0.3,
      'ap.apply_filter': ap.apply_filter,
      'ap.filter_amount': ap.filter_amount,
      'ap.binning_mode': ap.binning_mode,
      'ap.num_raw_samples': ap.num_raw_samples,
      'ps.amplitude_exponent': ps.amplitude_exponent,
      'ps.visual_floor_pct': ps.visual_floor_pct,
    };
  }

  private _build(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'audio-dev-panel';
    panel.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      width: 300px;
      background: #1a1a1a;
      border: 1px solid #444;
      border-radius: 6px;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 11px;
      color: #e0e0e0;
      z-index: 99999;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6);
      user-select: none;
      max-height: calc(100vh - 120px);
      display: flex;
      flex-direction: column;
    `;

    // Title bar
    const titleBar = document.createElement('div');
    titleBar.style.cssText = `
      background: #2a2a2a;
      padding: 6px 10px;
      border-radius: 6px 6px 0 0;
      cursor: grab;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #444;
      flex-shrink: 0;
    `;
    titleBar.innerHTML = `
      <span style="color:#7eb8f7;font-weight:bold;font-size:12px;">&#9881; Audio Dev Panel</span>
      <span style="color:#888;font-size:10px;">Ctrl+Shift+A</span>
    `;

    // Drag logic
    titleBar.addEventListener('mousedown', (e) => {
      this._dragging = true;
      const rect = panel.getBoundingClientRect();
      this._dragOffsetX = e.clientX - rect.left;
      this._dragOffsetY = e.clientY - rect.top;
      titleBar.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', (e) => {
      if (!this._dragging || !this._panel) return;
      const newTop = Math.max(10, Math.min(e.clientY - this._dragOffsetY, window.innerHeight - 40));
      const newLeft = Math.max(0, Math.min(e.clientX - this._dragOffsetX, window.innerWidth - this._panel.offsetWidth));
      this._panel.style.top = `${newTop}px`;
      this._panel.style.left = `${newLeft}px`;
      this._panel.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => {
      this._dragging = false;
      titleBar.style.cursor = 'grab';
    });

    // Content area
    const content = document.createElement('div');
    content.id = 'audio-dev-panel-content';
    content.style.cssText = `padding: 8px 10px; overflow-y: auto; flex: 1;`;

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = `padding: 0 10px 10px; flex-shrink: 0;`;

    // Process button
    const processBtn = document.createElement('button');
    processBtn.id = 'audio-dev-process-btn';
    processBtn.innerHTML = '&#9654; Process';
    processBtn.style.cssText = `
      width: 100%;
      margin-top: 8px;
      padding: 6px;
      background: #1e5c2e;
      color: #7ef7a0;
      border: 1px solid #2e8c4e;
      border-radius: 4px;
      font-family: inherit;
      font-size: 11px;
      cursor: pointer;
    `;
    processBtn.addEventListener('click', () => void this._process());
    processBtn.addEventListener('mouseenter', () => { processBtn.style.background = '#266e38'; });
    processBtn.addEventListener('mouseleave', () => { processBtn.style.background = '#1e5c2e'; });

    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.innerHTML = '&#8635; Reset to Current Render';
    resetBtn.style.cssText = `
      width: 100%;
      margin-top: 4px;
      padding: 4px;
      background: #1a2a3a;
      color: #7eb8f7;
      border: 1px solid #2e4e6e;
      border-radius: 4px;
      font-family: inherit;
      font-size: 11px;
      cursor: pointer;
    `;
    resetBtn.addEventListener('click', () => void this._reset());
    resetBtn.addEventListener('mouseenter', () => { resetBtn.style.background = '#2a3a4a'; });
    resetBtn.addEventListener('mouseleave', () => { resetBtn.style.background = '#1a2a3a'; });

    // Status line
    const status = document.createElement('div');
    status.id = 'audio-dev-panel-status';
    status.style.cssText = `
      margin-top: 6px;
      padding: 4px 6px;
      background: #111;
      border-radius: 3px;
      color: #888;
      font-size: 10px;
      min-height: 16px;
    `;
    status.textContent = 'Snapshot loaded.';

    panel.appendChild(titleBar);
    panel.appendChild(content);
    footer.appendChild(processBtn);
    footer.appendChild(resetBtn);
    footer.appendChild(status);
    panel.appendChild(footer);

    return panel;
  }

  private _rebuildFields(): void {
    const content = document.getElementById('audio-dev-panel-content');
    if (!content) return;
    content.innerHTML = '';

    const buf = this._editBuffer;
    const snap = this._snapshot;

    const isDirty = (key: string): boolean => {
      if (!snap) return false;
      const flat = this._flattenSnapshot(snap);
      return JSON.stringify(flat[key]) !== JSON.stringify(buf[key]);
    };

    // Audio Source
    content.appendChild(this._section('Audio Source'));
    const state = this._controller.getState();
    const fileName = state?.composition.audio_source?.source_file?.split(/[\\/]/).pop() ?? '(none)';
    content.appendChild(this._readOnly('File', fileName));
    content.appendChild(this._textField('Start (s)', buf['src.start_time'] as number, isDirty('src.start_time'), (v) => { buf['src.start_time'] = v; }));
    content.appendChild(this._textField('End (s)', buf['src.end_time'] as number, isDirty('src.end_time'), (v) => { buf['src.end_time'] = v; }));
    content.appendChild(this._checkField('Use Stems', buf['src.use_stems'] as boolean, isDirty('src.use_stems'), (v) => { buf['src.use_stems'] = v; }));

    // Silence Removal
    content.appendChild(this._section('Silence Removal'));
    content.appendChild(this._checkField('Remove Silence', buf['ap.remove_silence'] as boolean, isDirty('ap.remove_silence'), (v) => { buf['ap.remove_silence'] = v; }));
    content.appendChild(this._textField('Threshold (dB)', buf['ap.silence_threshold'] as number, isDirty('ap.silence_threshold'), (v) => { buf['ap.silence_threshold'] = v; }));
    content.appendChild(this._textField('Min Duration (s)', buf['ap.silence_duration'] as number, isDirty('ap.silence_duration'), (v) => { buf['ap.silence_duration'] = v; }));

    // Stem Separation
    content.appendChild(this._section('Demucs'));
    content.appendChild(this._textField('Threshold (dB)', buf['ap.demucs_silence_threshold'] as number, isDirty('ap.demucs_silence_threshold'), (v) => { buf['ap.demucs_silence_threshold'] = v; }));
    content.appendChild(this._textField('Min Duration (s)', buf['ap.demucs_silence_duration'] as number, isDirty('ap.demucs_silence_duration'), (v) => { buf['ap.demucs_silence_duration'] = v; }));

    // Amplitude Processing
    content.appendChild(this._section('Amplitude Processing'));
    content.appendChild(this._checkField('Apply Filter', buf['ap.apply_filter'] as boolean, isDirty('ap.apply_filter'), (v) => { buf['ap.apply_filter'] = v; }));
    content.appendChild(this._textField('Filter Amount (%)', +((buf['ap.filter_amount'] as number) * 100).toFixed(2), isDirty('ap.filter_amount'), (v) => { buf['ap.filter_amount'] = v / 100; }));
    content.appendChild(this._textField('Amplitude Exponent', buf['ps.amplitude_exponent'] as number, isDirty('ps.amplitude_exponent'), (v) => { buf['ps.amplitude_exponent'] = v; }));
    content.appendChild(this._selectField('Binning Mode', buf['ap.binning_mode'] as string, ['mean_abs', 'min_max', 'continuous'], isDirty('ap.binning_mode'), (v) => { buf['ap.binning_mode'] = v; }));
    content.appendChild(this._textField('Visual Floor (%)', +((buf['ps.visual_floor_pct'] as number) * 100).toFixed(1), isDirty('ps.visual_floor_pct'), (v) => { buf['ps.visual_floor_pct'] = v / 100; }));
    content.appendChild(this._textField('Raw Samples', buf['ap.num_raw_samples'] as number, isDirty('ap.num_raw_samples'), (v) => { buf['ap.num_raw_samples'] = Math.round(v); }));

    // Dirty indicator
    const dirtyKeys = snap ? Object.keys(buf).filter(k => isDirty(k)) : [];
    if (dirtyKeys.length > 0) {
      const indicator = document.createElement('div');
      indicator.style.cssText = `margin-top: 8px; color: #f7c87e; font-size: 10px;`;
      indicator.textContent = `\u26A0 ${dirtyKeys.length} unsaved change(s)`;
      content.appendChild(indicator);
    }
  }

  private _buildCompositionFromBuffer(): CompositionStateDTO {
    const base = this._snapshot
      ? JSON.parse(JSON.stringify(this._snapshot.composition)) as CompositionStateDTO
      : JSON.parse(JSON.stringify(this._controller.getState()!.composition)) as CompositionStateDTO;

    const buf = this._editBuffer;
    base.audio_source.start_time = buf['src.start_time'] as number;
    base.audio_source.end_time = buf['src.end_time'] as number;
    base.audio_source.use_stems = buf['src.use_stems'] as boolean;
    base.audio_processing.remove_silence = buf['ap.remove_silence'] as boolean;
    base.audio_processing.silence_threshold = buf['ap.silence_threshold'] as number;
    base.audio_processing.silence_duration = buf['ap.silence_duration'] as number;
    base.audio_processing.demucs_silence_threshold = buf['ap.demucs_silence_threshold'] as number;
    base.audio_processing.demucs_silence_duration = buf['ap.demucs_silence_duration'] as number;
    base.audio_processing.apply_filter = buf['ap.apply_filter'] as boolean;
    base.audio_processing.filter_amount = buf['ap.filter_amount'] as number;
    base.audio_processing.binning_mode = buf['ap.binning_mode'] as string;
    base.audio_processing.num_raw_samples = buf['ap.num_raw_samples'] as number;
    base.pattern_settings.amplitude_exponent = buf['ps.amplitude_exponent'] as number;
    base.pattern_settings.visual_floor_pct = buf['ps.visual_floor_pct'] as number;
    return base;
  }

  private _needsBackendCall(): boolean {
    if (!this._snapshot) return true;
    const snap = this._flattenSnapshot(this._snapshot);
    const backendKeys = [
      'src.start_time', 'src.end_time', 'src.use_stems',
      'ap.remove_silence', 'ap.silence_threshold', 'ap.silence_duration',
      'ap.demucs_silence_threshold', 'ap.demucs_silence_duration',
      'ap.num_raw_samples'
    ];
    return backendKeys.some(k => JSON.stringify(snap[k]) !== JSON.stringify(this._editBuffer[k]));
  }

  private async _process(): Promise<void> {
    const status = document.getElementById('audio-dev-panel-status');
    const processBtn = document.getElementById('audio-dev-process-btn') as HTMLButtonElement | null;
    if (processBtn) processBtn.disabled = true;
    if (status) status.textContent = 'Processing...';

    // Set override flag so _applyFromCacheEntry respects composition values
    (window as any).__audioDevOverrides__ = true;

    const slicer = (this._controller as any)._audioSlicerPanel;
    if (!slicer) {
      if (status) status.textContent = 'Error: AudioSlicerPanel not found.';
      if (processBtn) processBtn.disabled = false;
      return;
    }

    const targetComp = this._buildCompositionFromBuffer();
    const isolateVocals = this._editBuffer['src.use_stems'] as boolean;

    try {
      if (!this._needsBackendCall() && this._snapshot) {
        // Rebin-only path: use snapshot rawSamples directly
        await slicer.applyWithDevParams({
          rawSamples: this._snapshot.rawSamples,
          isolateVocals,
          composition: targetComp
        });
        if (status) status.textContent = `Done (rebin only). Exponent: ${targetComp.pattern_settings.amplitude_exponent}`;
      } else {
        // Backend path: update slicer state and trigger full apply
        slicer._isolateVocals = isolateVocals;
        slicer._markStart = targetComp.audio_source.start_time;
        slicer._markEnd = targetComp.audio_source.end_time;

        // Push params into composition state so the pipeline picks them up
        const state = this._controller.getState();
        if (state) {
          Object.assign(state.composition.audio_processing, targetComp.audio_processing);
          Object.assign(state.composition.pattern_settings, targetComp.pattern_settings);
          Object.assign(state.composition.audio_source, targetComp.audio_source);
        }

        // Clear cache to force fresh pipeline
        (slicer._applyCache as Map<string, unknown>)?.clear();
        if (isolateVocals !== this._snapshot?.isolateVocals) {
          slicer._rawVocalsBuffer = null;
        }

        const applyBtn = document.querySelector('.slicer-btn-apply') as HTMLElement | null;
        if (applyBtn) {
          applyBtn.click();
          if (status) status.textContent = 'Backend call dispatched...';
        } else {
          if (status) status.textContent = 'Error: .slicer-btn-apply not found.';
        }
      }
    } catch (err) {
      console.error('[AudioDevPanel] Process failed:', err);
      if (status) status.textContent = `Error: ${String(err)}`;
    } finally {
      if (processBtn) processBtn.disabled = false;
    }
  }

  private async _reset(): Promise<void> {
    const status = document.getElementById('audio-dev-panel-status');
    if (status) status.textContent = 'Resetting...';

    // Re-take snapshot (in case UI has rendered since panel opened)
    this._takeSnapshot();
    (window as any).__audioDevOverrides__ = null;

    const slicer = (this._controller as any)._audioSlicerPanel;
    if (this._snapshot && slicer) {
      try {
        await slicer.applyWithDevParams({
          rawSamples: this._snapshot.rawSamples,
          isolateVocals: this._snapshot.isolateVocals,
          composition: JSON.parse(JSON.stringify(this._snapshot.composition))
        });
        if (status) status.textContent = 'Reset to last render.';
      } catch (err) {
        if (status) status.textContent = `Reset error: ${String(err)}`;
      }
    } else {
      if (status) status.textContent = this._snapshot ? 'No slicer found.' : 'No render snapshot yet.';
    }

    this._rebuildFields();
  }

  // ── Field builders ──────────────────────────────────────────────────────────

  private _section(label: string): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = `
      margin: 8px 0 4px;
      color: #7eb8f7;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border-bottom: 1px solid #333;
      padding-bottom: 2px;
    `;
    el.textContent = label;
    return el;
  }

  private _row(label: string, dirty: boolean): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 3px 0;
    `;
    const lbl = document.createElement('span');
    lbl.style.cssText = `flex: 1; ${dirty ? 'color: #f7c87e;' : 'color: #aaa;'}`;
    lbl.textContent = dirty ? `${label} *` : label;
    row.appendChild(lbl);
    return row;
  }

  private _readOnly(label: string, value: string): HTMLElement {
    const row = this._row(label, false);
    const val = document.createElement('span');
    val.style.cssText = `color: #e0e0e0; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right;`;
    val.textContent = value;
    row.appendChild(val);
    return row;
  }

  private _textField(label: string, value: number, dirty: boolean, onChange: (v: number) => void): HTMLElement {
    const row = this._row(label, dirty);
    const input = document.createElement('input');
    input.type = 'text';
    input.value = String(value);
    input.style.cssText = `
      width: 80px;
      background: #111;
      border: 1px solid ${dirty ? '#f7c87e' : '#444'};
      border-radius: 3px;
      color: #e0e0e0;
      font-family: inherit;
      font-size: 11px;
      padding: 2px 4px;
      text-align: right;
    `;
    const commit = () => {
      const v = parseFloat(input.value);
      if (!isNaN(v)) { onChange(v); this._rebuildFields(); }
    };
    input.addEventListener('change', commit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { commit(); input.blur(); } });
    row.appendChild(input);
    return row;
  }

  private _checkField(label: string, value: boolean, dirty: boolean, onChange: (v: boolean) => void): HTMLElement {
    const row = this._row(label, dirty);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = value;
    input.style.cssText = `width: 14px; height: 14px; cursor: pointer; accent-color: #7eb8f7;`;
    input.addEventListener('change', () => { onChange(input.checked); this._rebuildFields(); });
    row.appendChild(input);
    return row;
  }

  private _selectField(label: string, value: string, options: string[], dirty: boolean, onChange: (v: string) => void): HTMLElement {
    const row = this._row(label, dirty);
    const select = document.createElement('select');
    select.style.cssText = `
      background: #111;
      border: 1px solid ${dirty ? '#f7c87e' : '#444'};
      border-radius: 3px;
      color: #e0e0e0;
      font-family: inherit;
      font-size: 11px;
      padding: 2px 4px;
    `;
    options.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      if (opt === value) o.selected = true;
      select.appendChild(o);
    });
    select.addEventListener('change', () => { onChange(select.value); this._rebuildFields(); });
    row.appendChild(select);
    return row;
  }
}
