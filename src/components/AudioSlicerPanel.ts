/**
 * AudioSlicerPanel.ts
 * "Pick a Moment" - Audio slicing interface for selecting audio segments
 * 
 * Architecture: Stateful component (manages audio playback state)
 * - Renders waveform visualization
 * - Provides transport controls (play, rewind, forward)
 * - Mark start/end points for slicing
 * - Exports sliced audio as WAV blob
 * - Emits AUDIO_SLICE_COMPLETE action via controller dispatch
 */

import type { PanelComponent } from '../types/PanelTypes';
import type { ApplicationController } from '../ApplicationController';

interface SliceResult {
  blob: Blob;
  startTime: number;
  endTime: number;
  duration: number;
}

interface AudioSlicerConfig {
  silenceThreshold: number;
  silenceDuration: number;
  removeSilence: boolean;
}

export class AudioSlicerPanel implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _controller: ApplicationController;
  private _config: AudioSlicerConfig;
  
  // DOM references
  private _dropZone: HTMLElement | null = null;
  private _fileInput: HTMLInputElement | null = null;
  private _canvas: HTMLCanvasElement | null = null;
  private _ctx: CanvasRenderingContext2D | null = null;
  private _playhead: HTMLElement | null = null;
  private _selectionOverlay: HTMLElement | null = null;
  private _currentTimeEl: HTMLElement | null = null;
  private _totalTimeEl: HTMLElement | null = null;
  private _markStartBtn: HTMLButtonElement | null = null;
  private _markEndBtn: HTMLButtonElement | null = null;
  private _selectionValueEl: HTMLElement | null = null;
  private _isolateCheckbox: HTMLInputElement | null = null;
  private _commitBtn: HTMLButtonElement | null = null;
  private _playBtn: HTMLButtonElement | null = null;
  private _resultPanel: HTMLElement | null = null;
  private _hintEl: HTMLElement | null = null;
	
	// V2 DOM references
  private _songLoaded: HTMLElement | null = null;
  private _songNameEl: HTMLElement | null = null;
  private _songDurationEl: HTMLElement | null = null;
  private _selectionSummary: HTMLElement | null = null;
  private _markStartBtnV2: HTMLButtonElement | null = null;
  private _markEndBtnV2: HTMLButtonElement | null = null;
  
  // Audio state
  private _audioContext: AudioContext | null = null;
  private _audioBuffer: AudioBuffer | null = null;
  private _sourceNode: AudioBufferSourceNode | null = null;
  private _isPlaying: boolean = false;
  private _playStartedAt: number = 0;
  private _pausedAt: number = 0;
  private _animationFrame: number | null = null;
	
	// Original file reference
  private _originalFile: File | null = null;
	
	// Processed audio (after Demucs)
  private _processedBuffer: AudioBuffer | null = null;
  private _isProcessing: boolean = false;
	
	// Raw vocals buffer (before silence removal)
  private _rawVocalsBuffer: AudioBuffer | null = null;
  
  // Silence params (from config)
  private _minDuration!: number;
  private _silenceThresh!: number;
  private _silenceEnabled!: boolean;
  private _isolateVocals: boolean = false;

  // Persisted state
  private _persistedFileName: string | null = null;
  
  // Section references (refreshed on each render)
  private _uploadSection: HTMLElement | null = null;
  private _trimmerSection: HTMLElement | null = null;
  private _enhanceSection: HTMLElement | null = null;
  
  // Selection state
  private _markStart: number | null = null;
  private _markEnd: number | null = null;
  private _markPhase: 'start' | 'end' = 'start';
	
	// Preview state
  private _isPreviewing: boolean = false;
  
  // Callback for slice completion
  private _onSliceComplete: ((result: SliceResult) => void) | null = null;
  
  constructor(
    controller: ApplicationController,
    config?: Partial<AudioSlicerConfig>,
    onSliceComplete?: (result: SliceResult) => void
  ) {
    this._controller = controller;
    if (!config || config.silenceThreshold === undefined || config.silenceDuration === undefined) {
      console.error('[AudioSlicerPanel] Config missing required audio_processing values');
    }
    this._config = {
      silenceThreshold: config?.silenceThreshold ?? 0,
      silenceDuration: config?.silenceDuration ?? 0,
      removeSilence: config?.removeSilence ?? false
    };
    this._silenceThresh = this._config.silenceThreshold;
    this._minDuration = this._config.silenceDuration;
    this._silenceEnabled = this._config.removeSilence;
    this._onSliceComplete = onSliceComplete || null;
    
    // Restore state from composition if available
    const state = controller.getState();
    if (state?.composition?.audio_source) {
      const src = state.composition.audio_source;
      if (src.start_time > 0 || src.end_time > 0) {
        this._markStart = src.start_time;
        this._markEnd = src.end_time;
      }
      this._isolateVocals = src.use_stems || false;
      this._persistedFileName = src.source_file || null;
    }
    if (state?.composition?.audio_processing) {
      this._silenceEnabled = state.composition.audio_processing.remove_silence || false;
    }
  }
  
  /**
   * Restore Upload Section UI based on persisted state
   */
  private _restoreUploadState(): void {
    const fileName = this._originalFile?.name || this._persistedFileName;
    const isLoaded = !!this._audioBuffer || !!this._persistedFileName;

    if (isLoaded && fileName) {
      this._dropZone?.classList.add('hidden');
      this._songLoaded?.classList.add('visible');
      
      if (this._songNameEl) this._songNameEl.textContent = fileName;
      
      if (this._songDurationEl) {
        const durationText = this._audioBuffer 
          ? this._formatTime(this._audioBuffer.duration) 
          : '--:--';
        this._songDurationEl.textContent = `${durationText} · ${this._audioBuffer ? 'Ready' : 'Re-upload to Edit'}`;
      }
      
      const footer = this._dropZone?.closest('.audio-slicer-upload-section')?.querySelector('.slicer-upload-footer') as HTMLElement;
      if (footer) footer.style.display = 'flex';
    }
  }

  /**
   * Invalidate L3 (Vocals) and L4 (Processed) buffers.
   * Called when L1 (Source) or L2 (Trim) changes.
   */
  private _invalidateGeneratedBuffers(): void {
    if (this._rawVocalsBuffer || this._processedBuffer) {
      console.log('[AudioSlicerPanel] Invalidating cached buffers');
      this._rawVocalsBuffer = null;
      this._processedBuffer = null;
    }
  }

  private _persistTrimState(): void {
    if (this._markStart !== null && this._markEnd !== null) {
      this._controller.updateAudioSourceState({
        start_time: Math.min(this._markStart, this._markEnd),
        end_time: Math.max(this._markStart, this._markEnd)
      });
    }
  }

  private _persistToggleState(): void {
    this._controller.updateAudioSourceState({
      use_stems: this._isolateVocals
    });
    this._controller.updateAudioProcessingState({
      remove_silence: this._silenceEnabled
    });
  }
	
	renderEnhanceSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'audio-slicer-enhance-section';
    this._enhanceSection = section;
    section.innerHTML = `
      <div class="slicer-toggle-card" id="toggle-vocals">
        <div class="slicer-toggle-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </div>
        <div class="slicer-toggle-text">
          <div class="slicer-toggle-title">Just the Singing Voice</div>
          <div class="slicer-toggle-desc">Removes background music</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" class="slicer-isolate-checkbox" ${this._isolateVocals ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
      
      <div class="slicer-vocals-preview ${this._isolateVocals ? 'visible' : ''}">
        <button class="slicer-btn-vocals-preview" ${!this._audioBuffer ? 'disabled' : ''}>
          <svg class="slicer-preview-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          <span class="slicer-preview-label">${this._rawVocalsBuffer ? 'Preview Vocals' : 'Process & Preview'}</span>
        </button>
        <div class="slicer-vocals-status">
          <span class="slicer-status-text">${this._rawVocalsBuffer ? '✓ Cached' : ''}</span>
        </div>
      </div>
      
      <div class="slicer-toggle-card" id="toggle-silence">
        <div class="slicer-toggle-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="4" y1="8" x2="4" y2="16"/><line x1="8" y1="6" x2="8" y2="18"/>
            <line x1="12" y1="11" x2="12" y2="13"/><line x1="16" y1="6" x2="16" y2="18"/>
            <line x1="20" y1="8" x2="20" y2="16"/>
          </svg>
        </div>
        <div class="slicer-toggle-text">
          <div class="slicer-toggle-title">Clean Up Quiet Parts</div>
          <div class="slicer-toggle-desc">Tightens the waveform</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" class="slicer-silence-checkbox" ${this._silenceEnabled ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
      
      <input type="hidden" class="slicer-min-duration" value="${this._minDuration}">
      <input type="hidden" class="slicer-silence-thresh" value="${this._silenceThresh}">
      
      <div class="slicer-cta-footer">
        <button class="slicer-btn-primary slicer-btn-commit" data-demo-id="slicer_commit" style="flex:1;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          Create My Art
        </button>
      </div>
    `;
    this._cacheEnhanceElements(section);
    this._attachEnhanceListeners(section);
    this._restoreEnhanceState();
    return section;
  }
	
	renderTrimmerSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'audio-slicer-trimmer-section';
    this._trimmerSection = section;
    section.innerHTML = `
      <div class="slicer-instructions">
        <span class="slicer-instructions-number">1</span>
        <span class="slicer-instructions-text">Listen, then tap to mark your selection</span>
      </div>
      
      <div class="slicer-waveform-row">
        <button class="slicer-skip-btn slicer-btn-rewind" title="Rewind 5 seconds">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
          <span>5s</span>
        </button>
        
        <div class="slicer-waveform-wrap">
          <canvas class="slicer-waveform"></canvas>
          <div class="slicer-playhead"></div>
          <div class="slicer-selection">
            <div class="slicer-handle slicer-handle-start"></div>
            <div class="slicer-handle slicer-handle-end"></div>
          </div>
        </div>
        
        <button class="slicer-skip-btn slicer-btn-forward" title="Forward 5 seconds">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/></svg>
          <span>5s</span>
        </button>
      </div>
      
      <div class="slicer-transport">
        <span class="slicer-time slicer-time-current">0:00</span>
        <span class="slicer-time-separator">/</span>
        <span class="slicer-time slicer-time-total">0:00</span>
      </div>
      
      <button class="slicer-play-btn" data-demo-id="slicer_play">
        <svg class="slicer-play-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        <span class="slicer-play-label">Play to Find Your Moment</span>
      </button>
      
      <div class="slicer-mark-buttons">
        <button class="slicer-mark-btn slicer-btn-mark-start" data-demo-id="slicer_start">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 3v18"/><path d="M9 12h12"/><path d="M15 6l6 6-6 6"/>
          </svg>
          <span class="slicer-mark-btn-label">Start Here</span>
          <span class="slicer-mark-btn-time">—</span>
        </button>
        <button class="slicer-mark-btn slicer-btn-mark-end" data-demo-id="slicer_end">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 3v18"/><path d="M3 12h12"/><path d="M9 6l-6 6 6 6"/>
          </svg>
          <span class="slicer-mark-btn-label">End Here</span>
          <span class="slicer-mark-btn-time">—</span>
        </button>
      </div>
      
      <div class="slicer-selection-summary">
        <div class="slicer-summary-icon">✓</div>
        <div class="slicer-summary-text">
          <span class="slicer-summary-range">0:00 → 0:00</span>
          <span class="slicer-summary-duration">(0 sec)</span>
        </div>
        <button class="slicer-summary-preview">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          Preview
        </button>
      </div>
      
      <button class="slicer-use-full"><span>or use the full song</span></button>
      
      <div class="slicer-cta-footer">
        <button class="slicer-btn-secondary" data-action="next-accordion">Make It Beautiful →</button>
        <button class="slicer-btn-primary slicer-btn-commit" data-demo-id="slicer_commit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          Create My Art
        </button>
      </div>
    `;
    this._cacheTrimmerElements(section);
    this._attachTrimmerListeners(section);
    this._restoreTrimmerState();
    return section;
  }
	
	renderUploadSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'audio-slicer-upload-section';
    this._uploadSection = section;
    section.innerHTML = `
      <div class="slicer-drop-zone" data-demo-id="slicer_drop">
        <div class="upload-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <p class="slicer-drop-text">Tap to Choose Your Song</p>
        <p class="slicer-drop-hint">or drag and drop your file here</p>
        <input type="file" class="slicer-file-input" accept="audio/*">
      </div>
      
      <div class="slicer-song-loaded">
        <div class="slicer-song-artwork">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
        </div>
        <div class="slicer-song-info">
          <div class="slicer-song-name"></div>
          <div class="slicer-song-duration"></div>
        </div>
        <button class="slicer-song-change">Change</button>
      </div>
      
      <div class="slicer-cta-footer slicer-upload-footer">
        <button class="slicer-btn-secondary" data-action="next-accordion">Pick Your Moment →</button>
        <button class="slicer-btn-primary slicer-btn-commit" data-demo-id="slicer_commit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          Create My Art
        </button>
      </div>
    `;
    this._cacheUploadElements(section);
    this._attachUploadListeners(section);
    this._restoreUploadState();
    return section;
  }
	
	private _attachUploadListeners(section: HTMLElement): void {
    this._dropZone?.addEventListener('click', () => this._fileInput?.click());
    this._dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      this._dropZone?.classList.add('dragover');
    });
    this._dropZone?.addEventListener('dragleave', () => {
      this._dropZone?.classList.remove('dragover');
    });
    this._dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      this._dropZone?.classList.remove('dragover');
      const file = (e as DragEvent).dataTransfer?.files[0];
      if (file) this._loadFile(file);
    });
    this._fileInput?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) this._loadFile(file);
    });
    section.querySelector('.slicer-song-change')?.addEventListener('click', () => {
      this._resetToUpload();
    });
    section.querySelector('[data-action="next-accordion"]')?.addEventListener('click', () => {
      this._controller.openNextAudioAccordion('custom');
    });
    section.querySelector('.slicer-btn-commit')?.addEventListener('click', () => this._handleCommit());
  }

  private _attachTrimmerListeners(section: HTMLElement): void {
    this._attachHandleDrag(section);
    section.querySelector('.slicer-play-btn')?.addEventListener('click', () => this._togglePlayback());
    section.querySelector('.slicer-btn-rewind')?.addEventListener('click', () => this._seek(-5));
    section.querySelector('.slicer-btn-forward')?.addEventListener('click', () => this._seek(5));
    section.querySelector('.slicer-btn-mark-start')?.addEventListener('click', () => this._handleMarkStart());
    section.querySelector('.slicer-btn-mark-end')?.addEventListener('click', () => this._handleMarkEnd());
    section.querySelector('.slicer-use-full')?.addEventListener('click', () => this._useFullTrack());
    section.querySelector('.slicer-summary-preview')?.addEventListener('click', () => void this._preview());
    section.querySelector('[data-action="next-accordion"]')?.addEventListener('click', () => {
      this._controller.openNextAudioAccordion('slicing');
    });
    section.querySelector('.slicer-btn-commit')?.addEventListener('click', () => this._handleCommit());
    window.addEventListener('resize', this._handleResize);
  }
	
	/**
   * Get enhancements summary for accordion header display
   */
  public getEnhancementsDisplay(): string | null {
    const vocals = this._isolateVocals;
    const silence = this._silenceEnabled;
    
    if (!vocals && !silence) return null;
    
    const parts: string[] = [];
    if (vocals) parts.push('Vocals');
    if (silence) parts.push('Cleaned');
    return parts.join(', ');
  }
	
	/**
   * Get selection time range for accordion header display
   */
  public getSelectionDisplay(): string | null {
    if (this._markStart === null || this._markEnd === null) return null;
    const start = Math.min(this._markStart, this._markEnd);
    const end = Math.max(this._markStart, this._markEnd);
    return `${this._formatTime(start)} → ${this._formatTime(end)}`;
  }
	
	/**
   * Get loaded filename for accordion header display
   */
  public getLoadedFilename(): string | null {
    return this._originalFile?.name || this._persistedFileName;
  }

  private _attachEnhanceListeners(section: HTMLElement): void {
    section.querySelector('#toggle-vocals .toggle-switch input')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this._isolateVocals = checked;
      const card = section.querySelector('#toggle-vocals');
      card?.classList.toggle('active', checked);
      // Show/hide preview row
      const previewRow = section.querySelector('.slicer-vocals-preview');
      previewRow?.classList.toggle('visible', checked);
      this._controller.updateAudioAccordionValue('demucs');
      this._persistToggleState();
    });
    
    section.querySelector('.slicer-btn-vocals-preview')?.addEventListener('click', () => {
      void this._previewVocals(section);
    });
    section.querySelector('#toggle-silence .toggle-switch input')?.addEventListener('change', (e) => {
      const card = section.querySelector('#toggle-silence');
      const checked = (e.target as HTMLInputElement).checked;
      card?.classList.toggle('active', checked);
      this._silenceEnabled = checked;
      this._controller.updateAudioAccordionValue('demucs');
      this._persistToggleState();
      
      // Auto-process silence removal if enabled and vocals buffer exists
      if (checked && this._rawVocalsBuffer && !this._processedBuffer) {
        void this._processSilenceRemoval(section);
      }
    });
    this._commitBtn?.addEventListener('click', () => this._handleCommit());
  }
	
	private _cacheEnhanceElements(section: HTMLElement): void {
    this._isolateCheckbox = section.querySelector('.slicer-isolate-checkbox') as HTMLInputElement;
    this._commitBtn = section.querySelector('.slicer-btn-commit');
  }
	
	private _cacheTrimmerElements(section: HTMLElement): void {
    this._canvas = section.querySelector('.slicer-waveform');
    this._ctx = this._canvas?.getContext('2d') || null;
    this._playhead = section.querySelector('.slicer-playhead');
    this._playBtn = section.querySelector('.slicer-play-btn');
    this._currentTimeEl = section.querySelector('.slicer-time-current');
    this._totalTimeEl = section.querySelector('.slicer-time-total');
    this._selectionOverlay = section.querySelector('.slicer-selection');
    this._markStartBtn = section.querySelector('.slicer-btn-mark-start');
    this._markEndBtn = section.querySelector('.slicer-btn-mark-end');
    this._selectionSummary = section.querySelector('.slicer-selection-summary');
  }
	
	private _restoreEnhanceState(): void {
    const section = this._isolateCheckbox?.closest('.audio-slicer-enhance-section');
    if (!section) return;
    
    // Restore vocals toggle card state
    const vocalsCard = section.querySelector('#toggle-vocals');
    if (vocalsCard && this._isolateVocals) {
      vocalsCard.classList.add('active');
    }
    
    // Restore silence toggle card state
    const silenceCard = section.querySelector('#toggle-silence');
    if (silenceCard && this._silenceEnabled) {
      silenceCard.classList.add('active');
    }
  }
	
	private _restoreTrimmerState(): void {
    // Restore total time
    if (this._audioBuffer && this._totalTimeEl) {
      this._totalTimeEl.textContent = this._formatTime(this._audioBuffer.duration);
    }
    
    // Draw waveform if audio loaded
    if (this._audioBuffer) {
      requestAnimationFrame(() => this._drawWaveform());
    }
    
    // Restore mark times
    this._updateMarkButtonsV2();
    
    // Restore selection overlay
    this._updateSelection();
    
    // Restore selection summary
    this._updateSelectionSummary();
  }
	
	private _restoreUploadState(): void {
    if (this._audioBuffer && this._originalFile) {
      this._dropZone?.classList.add('hidden');
      this._songLoaded?.classList.add('visible');
      if (this._songNameEl) this._songNameEl.textContent = this._originalFile.name;
      if (this._songDurationEl) this._songDurationEl.textContent = `${this._formatTime(this._audioBuffer.duration)} · Ready`;
      const footer = this._dropZone?.closest('.audio-slicer-upload-section')?.querySelector('.slicer-upload-footer') as HTMLElement;
      if (footer) footer.style.display = 'flex';
    }
  }
	
	private _cacheUploadElements(section: HTMLElement): void {
    this._dropZone = section.querySelector('.slicer-drop-zone');
    this._fileInput = section.querySelector('.slicer-file-input');
    this._songLoaded = section.querySelector('.slicer-song-loaded');
    this._songNameEl = section.querySelector('.slicer-song-name');
    this._songDurationEl = section.querySelector('.slicer-song-duration');
  }
  
  private _handleResize = (): void => {
    if (this._audioBuffer) this._drawWaveform();
  };
	
	private _attachHandleDrag(section: HTMLElement): void {
    const wrap = section.querySelector('.slicer-waveform-wrap') as HTMLElement;
    const startHandle = section.querySelector('.slicer-handle-start') as HTMLElement;
    const endHandle = section.querySelector('.slicer-handle-end') as HTMLElement;
    if (!wrap || !startHandle || !endHandle) return;

    const onDrag = (e: MouseEvent | TouchEvent, isStart: boolean) => {
      if (!this._audioBuffer) return;
      const rect = wrap.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const time = pct * this._audioBuffer.duration;
      if (isStart) {
        this._markStart = time;
      } else {
        this._markEnd = time;
      }
      this._updateSelection();
      this._updateMarkButtonsV2();
      this._updateSelectionSummary();
    };

    const attach = (handle: HTMLElement, isStart: boolean) => {
      const onMove = (e: MouseEvent | TouchEvent) => onDrag(e, isStart);
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
        this._persistTrimState();
      };
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
      handle.addEventListener('touchstart', (e) => {
        e.preventDefault();
        document.addEventListener('touchmove', onMove);
        document.addEventListener('touchend', onUp);
      });
    };
    attach(startHandle, true);
    attach(endHandle, false);
  }
  
  private _initAudioContext(): void {
    if (!this._audioContext) {
      this._audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }
  
  private async _loadFile(file: File): Promise<void> {
    this._initAudioContext();
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      this._audioBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);
			this._originalFile = file;
      
      // Update UI
      this._dropZone?.classList.add('hidden');
      this._songLoaded?.classList.add('visible');
      
      // Update song loaded display
      if (this._songNameEl) this._songNameEl.textContent = file.name;
      if (this._songDurationEl) this._songDurationEl.textContent = `${this._formatTime(this._audioBuffer.duration)} · Ready`;
      
      // Show song footer with buttons
      const songFooter = this._container?.querySelector('.slicer-song-footer') as HTMLElement;
      if (songFooter) songFooter.style.display = 'flex';
      
      // Update accordion subtitle
      const songSubtitle = this._container?.querySelector('.slicer-song-subtitle');
      if (songSubtitle) songSubtitle.textContent = file.name;
      
      if (this._totalTimeEl) {
        this._totalTimeEl.textContent = this._formatTime(this._audioBuffer.duration);
      }
      
      this._resetState();
      this._updateCommitButton();
      this._drawWaveform();
      this._controller.updateAudioAccordionValue('custom');
      this._controller.updateAudioSourceState({
        source_file: file.name,
        start_time: 0,
        end_time: this._audioBuffer!.duration
      });
      
    } catch (err) {
      console.error('[AudioSlicerPanel] Decode error:', err);
      // Could dispatch error action here
    }
  }
  
  private _drawWaveform(): void {
    if (!this._canvas || !this._ctx || !this._audioBuffer) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = this._canvas.getBoundingClientRect();
    this._canvas.width = rect.width * dpr;
    this._canvas.height = rect.height * dpr;
    this._ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    const data = this._audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;
    
    // Read colors from CSS variables
    const styles = getComputedStyle(document.documentElement);
    const bgColor = styles.getPropertyValue('--color-background-secondary').trim() || '244, 244, 244';
    const waveColor = styles.getPropertyValue('--color-foreground-secondary').trim() || '105, 105, 105';
    
    // Background
    this._ctx.fillStyle = `rgb(${bgColor})`;
    this._ctx.fillRect(0, 0, width, height);
    
    // Waveform
    this._ctx.fillStyle = `rgb(${waveColor})`;
    for (let i = 0; i < width; i++) {
      let min = 1, max = -1;
      for (let j = 0; j < step; j++) {
        const v = data[i * step + j] || 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const barH = Math.max(1, (max - min) * amp);
      this._ctx.fillRect(i, amp - max * amp, 1, barH);
    }
  }
  
  private _formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
  
  private _getCurrentTime(): number {
    if (!this._audioContext) return this._pausedAt;
    return this._isPlaying
      ? this._pausedAt + (this._audioContext.currentTime - this._playStartedAt)
      : this._pausedAt;
  }
  
  private _togglePlayback(): void {
    this._initAudioContext();
    if (this._isPlaying) {
      this._stop();
    } else {
      this._play();
    }
  }
  
  private _play(): void {
    if (!this._audioBuffer || !this._audioContext) return;
    
    // Stop any existing playback first
    this._stopAll();
    
    this._sourceNode = this._audioContext.createBufferSource();
    this._sourceNode.buffer = this._audioBuffer;
    this._sourceNode.connect(this._audioContext.destination);
    this._sourceNode.start(0, this._pausedAt);
    
    this._playStartedAt = this._audioContext.currentTime;
    this._isPlaying = true;
    this._playhead?.classList.add('visible');
    
    // Update play button (v2 style)
    const playIcon = this._container?.querySelector('.slicer-play-icon') as HTMLElement;
    const playLabel = this._container?.querySelector('.slicer-play-label') as HTMLElement;
    if (playIcon) playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    if (playLabel) playLabel.textContent = 'Pause';
    this._container?.querySelector('.slicer-play-btn')?.classList.add('playing');
    
    if (this._markStartBtn) this._markStartBtn.disabled = false;
    if (this._markEndBtn) this._markEndBtn.disabled = false;
    
    this._sourceNode.onended = () => {
      if (this._isPlaying) this._stop();
    };
    
    this._updatePlayhead();
  }
  
  private _stop(): void {
    if (this._sourceNode) {
      this._sourceNode.onended = null;
      this._sourceNode.stop();
      this._sourceNode.disconnect();
      this._sourceNode = null;
    }
    
    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }
    
    this._pausedAt = this._getCurrentTime();
    if (this._audioBuffer && this._pausedAt >= this._audioBuffer.duration) {
      this._pausedAt = 0;
    }
    
    this._isPlaying = false;
    
    // Update play button (v2 style)
    const playIcon = this._container?.querySelector('.slicer-play-icon') as HTMLElement;
    const playLabel = this._container?.querySelector('.slicer-play-label') as HTMLElement;
    if (playIcon) playIcon.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
    if (playLabel) playLabel.textContent = 'Play to Find Your Moment';
    this._container?.querySelector('.slicer-play-btn')?.classList.remove('playing');
    
    if (this._currentTimeEl) this._currentTimeEl.textContent = this._formatTime(this._pausedAt);
  }
  
  private _seek(delta: number): void {
    if (!this._audioBuffer) return;
    
    const wasPlaying = this._isPlaying;
    if (wasPlaying) this._stop();
    
    this._pausedAt = Math.max(0, Math.min(this._pausedAt + delta, this._audioBuffer.duration));
    if (this._currentTimeEl) this._currentTimeEl.textContent = this._formatTime(this._pausedAt);
    this._updatePlayheadPosition();
    
    if (wasPlaying) this._play();
  }
  
  private _updatePlayhead(): void {
    const t = this._getCurrentTime();
    this._updatePlayheadPosition();
    if (this._currentTimeEl) this._currentTimeEl.textContent = this._formatTime(t);
    
    if (this._isPlaying && this._audioBuffer && t < this._audioBuffer.duration) {
      this._animationFrame = requestAnimationFrame(() => this._updatePlayhead());
    } else if (this._audioBuffer && t >= this._audioBuffer.duration) {
      this._stop();
    }
  }
  
  private _updatePlayheadPosition(): void {
    if (!this._playhead || !this._audioBuffer) return;
    const t = this._getCurrentTime();
    const pct = (t / this._audioBuffer.duration) * 100;
    this._playhead.style.left = `${pct}%`;
  }
  
  private _handleMarkStart(): void {
    this._markStart = this._getCurrentTime();
    this._invalidateGeneratedBuffers();
    this._updateSelectionDisplay();
    this._updateSelection();
    this._updateCommitButton();
    this._updateMarkButtonsV2();
    this._updateSelectionSummary();
    this._controller.updateAudioAccordionValue('slicing');
    this._persistTrimState();
  }
  
  private _handleMarkEnd(): void {
    this._markEnd = this._getCurrentTime();
    this._stop();
    
    // Ensure start < end
    if (this._markStart !== null && this._markEnd < this._markStart) {
      [this._markStart, this._markEnd] = [this._markEnd, this._markStart];
    }
    
    this._invalidateGeneratedBuffers();
    this._updateSelectionDisplay();
    this._updateSelection();
    this._updateCommitButton();
    this._updateMarkButtonsV2();
    this._updateSelectionSummary();
    this._controller.updateAudioAccordionValue('slicing');
    this._persistTrimState();
  }
  
  private _updateSelectionDisplay(): void {
    if (!this._selectionValueEl) return;
    
    if (this._markStart !== null && this._markEnd !== null) {
      const duration = Math.round(this._markEnd - this._markStart);
      this._selectionValueEl.textContent = `${this._formatTime(this._markStart)} → ${this._formatTime(this._markEnd)} (${duration}s)`;
    } else if (this._markStart !== null) {
      this._selectionValueEl.textContent = `${this._formatTime(this._markStart)} → ...`;
    } else {
      this._selectionValueEl.textContent = 'Full track';
    }
  }
  
  private _updateCommitButton(): void {
    if (!this._commitBtn) return;
    this._commitBtn.disabled = !this._audioBuffer;
    
    const previewBtn = this._container?.querySelector('.slicer-btn-preview') as HTMLButtonElement;
    const redoBtn = this._container?.querySelector('.slicer-btn-redo') as HTMLButtonElement;
    if (previewBtn) previewBtn.disabled = !this._audioBuffer;
    if (redoBtn) redoBtn.disabled = this._markStart === null && this._markEnd === null;
  }
  
  private _redo(): void {
    this._markStart = null;
    this._markEnd = null;
    this._processedBuffer = null;
    this._updateSelectionDisplay();
    this._updateSelection();
    this._updateCommitButton();
  }
  
  private _updateSelection(): void {
    if (!this._selectionOverlay || !this._audioBuffer) return;
    
    if (this._markStart === null) {
      this._selectionOverlay.classList.remove('visible');
      return;
    }
    
    const start = this._markEnd !== null ? Math.min(this._markStart, this._markEnd) : this._markStart;
    const end = this._markEnd !== null ? Math.max(this._markStart, this._markEnd) : start;
    
    const leftPct = (start / this._audioBuffer.duration) * 100;
    const widthPct = ((end - start) / this._audioBuffer.duration) * 100;
    
    this._selectionOverlay.style.left = `${leftPct}%`;
    this._selectionOverlay.style.width = `${Math.max(0.5, widthPct)}%`;
    this._selectionOverlay.classList.add('visible');
  }
  
  private _showResult(): void {
    if (this._markStart === null || this._markEnd === null) return;
    
    // Hide mark row, show result
    const markRow = this._container?.querySelector('.slicer-mark-row') as HTMLElement;
    if (markRow) markRow.style.display = 'none';
    if (this._hintEl) this._hintEl.style.display = 'none';
    
    // Update result display
    const startEl = this._container?.querySelector('.slicer-result-start');
    const endEl = this._container?.querySelector('.slicer-result-end');
    const secondsEl = this._container?.querySelector('.slicer-result-seconds');
    
    if (startEl) startEl.textContent = this._formatTime(this._markStart);
    if (endEl) endEl.textContent = this._formatTime(this._markEnd);
    if (secondsEl) secondsEl.textContent = Math.round(this._markEnd - this._markStart).toString();
    
    this._updateSelection();
    this._resultPanel?.classList.add('visible');
  }
  
  private async _preview(): Promise<void> {
    if (!this._audioBuffer) return;
    
    const previewBtn = this._container?.querySelector('.slicer-preview-row .slicer-btn-preview') as HTMLButtonElement;
    
    // Toggle off if already previewing
    if (this._isPreviewing) {
      this._stopAll();
      return;
    }
    
    // If processing, ignore
    if (this._isProcessing) return;
    
    const isolateVocals = this._isolateCheckbox?.checked || false;
    
    // If isolate vocals checked, need to process first
    if (isolateVocals) {
      await this._previewWithProcessing(previewBtn);
    } else {
      this._previewLocal(previewBtn);
    }
  }
  
  private _previewLocal(previewBtn: HTMLButtonElement | null): void {
    if (!this._audioBuffer) return;
    
    const startTime = this._markStart ?? 0;
    const endTime = this._markEnd ?? this._audioBuffer.duration;
    
    this._initAudioContext();
    this._stopAll();
    
    this._sourceNode = this._audioContext!.createBufferSource();
    this._sourceNode.buffer = this._audioBuffer;
    this._sourceNode.connect(this._audioContext!.destination);
    this._sourceNode.start(0, startTime, endTime - startTime);
    
    this._isPreviewing = true;
    if (previewBtn) previewBtn.textContent = '❚❚ Pause';
    
    this._sourceNode.onended = () => {
      this._isPreviewing = false;
      if (previewBtn) previewBtn.textContent = '▶ Preview';
    };
  }
  private async _previewWithProcessing(previewBtn: HTMLButtonElement | null): Promise<void> {
    if (!this._audioBuffer || !this._originalFile) return;
    
    this._isProcessing = true;
    if (previewBtn) previewBtn.textContent = '⏳ Processing...';
    
    try {
      // Build source audio
      const useSlice = this._markStart !== null && this._markEnd !== null;
      const audioFile = useSlice 
        ? new File([this._createSliceBlob()!], 'slice.wav', { type: 'audio/wav' })
        : this._originalFile;
      
      // Send to backend
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('isolate_vocals', 'true');
      
      const response = await fetch('/api/audio/process-commit', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Processing failed: ${response.status}`);
      }
      
      // Decode response
      const processedBlob = await response.blob();
      const arrayBuffer = await processedBlob.arrayBuffer();
      
      this._initAudioContext();
      // Store raw vocals (before silence removal)
      this._rawVocalsBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);
      this._processedBuffer = this._rawVocalsBuffer;
      
      // Show silence options
      const silenceOptions = this._container?.querySelector('.slicer-silence-options') as HTMLElement;
      if (silenceOptions) silenceOptions.style.display = 'block';
      
      // Play processed audio
      this._stopAll();
      this._sourceNode = this._audioContext!.createBufferSource();
      this._sourceNode.buffer = this._processedBuffer;
      this._sourceNode.connect(this._audioContext!.destination);
      this._sourceNode.start(0);
      
      this._isPreviewing = true;
      this._isProcessing = false;
      this._pausedAt = 0;
      this._playStartedAt = this._audioContext!.currentTime;
      if (previewBtn) previewBtn.textContent = '❚❚ Pause';
      
      // Start highlight animation loop
      const duration = this._processedBuffer!.duration;
      const updatePreviewHighlight = () => {
        if (!this._isPreviewing) return;
        const currentTime = this._audioContext!.currentTime - this._playStartedAt;
        this._updateSlotHighlight(currentTime);
        if (currentTime < duration) {
          requestAnimationFrame(updatePreviewHighlight);
        }
      };
      requestAnimationFrame(updatePreviewHighlight);
      
      this._sourceNode.onended = () => {
        this._isPreviewing = false;
        this._controller.highlightSlot(null);
        if (previewBtn) previewBtn.textContent = '▶ Preview';
      };
      
    } catch (error) {
      console.error('[AudioSlicerPanel] Preview processing failed:', error);
      this._isProcessing = false;
      if (previewBtn) previewBtn.textContent = '▶ Preview';
    }
  }
	
	private async _previewVocals(section: HTMLElement): Promise<void> {
    const btn = section.querySelector('.slicer-btn-vocals-preview') as HTMLButtonElement;
    const label = btn?.querySelector('.slicer-preview-label');
    const status = section.querySelector('.slicer-status-text');
    
    // If already previewing, stop
    if (this._isPreviewing) {
      this._stopAll();
      if (label) label.textContent = this._rawVocalsBuffer ? 'Preview Vocals' : 'Process & Preview';
      return;
    }
    
    // If cached, play directly
    if (this._rawVocalsBuffer) {
      this._playBuffer(this._rawVocalsBuffer, btn, label);
      return;
    }
    
    // Need to process
    if (!this._audioBuffer || !this._originalFile) return;
    
    this._isProcessing = true;
    if (label) label.textContent = 'Processing...';
    if (btn) btn.disabled = true;
    if (status) status.textContent = '';
    
    try {
      const useSlice = this._markStart !== null && this._markEnd !== null;
      const audioFile = useSlice 
        ? new File([this._createSliceBlob()!], 'slice.wav', { type: 'audio/wav' })
        : this._originalFile;
      
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('isolate_vocals', 'true');
      
      const response = await fetch('/api/audio/process-commit', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error(`Processing failed: ${response.status}`);
      
      const processedBlob = await response.blob();
      const arrayBuffer = await processedBlob.arrayBuffer();
      
      this._initAudioContext();
      this._rawVocalsBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);
      
      if (status) status.textContent = '✓ Cached';
      this._isProcessing = false;
      if (btn) btn.disabled = false;
      
      this._playBuffer(this._rawVocalsBuffer, btn, label);
      
    } catch (error) {
      console.error('[AudioSlicerPanel] Vocals processing failed:', error);
      this._isProcessing = false;
      if (btn) btn.disabled = false;
      if (label) label.textContent = 'Process & Preview';
      if (status) status.textContent = '✗ Failed';
    }
  }
  
  private _playBuffer(buffer: AudioBuffer, btn?: HTMLButtonElement | null, label?: Element | null): void {
    this._initAudioContext();
    this._stopAll();
    
    this._sourceNode = this._audioContext!.createBufferSource();
    this._sourceNode.buffer = buffer;
    this._sourceNode.connect(this._audioContext!.destination);
    this._sourceNode.start(0);
    
    this._isPreviewing = true;
    if (label) label.textContent = 'Pause';
    
    this._sourceNode.onended = () => {
      this._isPreviewing = false;
      if (label) label.textContent = this._rawVocalsBuffer ? 'Preview Vocals' : 'Process & Preview';
    };
  }
	
	private async _processSilenceRemoval(section: HTMLElement): Promise<void> {
    if (!this._rawVocalsBuffer) return;
    
    const card = section.querySelector('#toggle-silence');
    const statusEl = document.createElement('span');
    statusEl.className = 'slicer-silence-status';
    statusEl.textContent = ' Processing...';
    card?.querySelector('.slicer-toggle-title')?.appendChild(statusEl);
    
    try {
      const rawBlob = this._encodeWAV(this._rawVocalsBuffer);
      
      const formData = new FormData();
      formData.append('file', new File([rawBlob], 'vocals.wav', { type: 'audio/wav' }));
      formData.append('min_duration', String(this._minDuration));
      formData.append('threshold_db', String(this._silenceThresh));
      
      const response = await fetch('/api/audio/compress-silence', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error(`Silence removal failed: ${response.status}`);
      
      const compressedBlob = await response.blob();
      const arrayBuffer = await compressedBlob.arrayBuffer();
      
      this._initAudioContext();
      this._processedBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);
      
      statusEl.textContent = ' ✓ Ready';
      setTimeout(() => statusEl.remove(), 2000);
      
    } catch (error) {
      console.error('[AudioSlicerPanel] Silence removal failed:', error);
      statusEl.textContent = ' ✗ Failed';
      setTimeout(() => statusEl.remove(), 3000);
    }
  }
  
  private _stopAll(): void {
    // Stop main playback
    if (this._sourceNode) {
      this._sourceNode.onended = null;
      this._sourceNode.stop();
      this._sourceNode.disconnect();
      this._sourceNode = null;
    }
    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }
    
    // Reset states
    this._isPlaying = false;
    this._isPreviewing = false;
    if (this._playBtn) this._playBtn.textContent = '▶';
    
    const previewBtn = this._container?.querySelector('.slicer-btn-preview') as HTMLButtonElement;
    if (previewBtn) previewBtn.textContent = '▶ Preview';
  }
  
  private _reset(): void {
    this._markStart = null;
    this._markEnd = null;
    this._markPhase = 'start';
    this._pausedAt = 0;
    
    // Reset mark button
    if (this._markStartBtn) this._markStartBtn.disabled = true;
    if (this._markEndBtn) this._markEndBtn.disabled = true;
    if (this._commitBtn) this._commitBtn.disabled = true;
    if (this._selectionValueEl) this._selectionValueEl.textContent = 'Full track';
    if (this._isolateCheckbox) this._isolateCheckbox.checked = false;
    
    // Show mark row, hide result
    const markRow = this._container?.querySelector('.slicer-mark-row') as HTMLElement;
    if (markRow) markRow.style.display = 'block';
    if (this._hintEl) {
      this._hintEl.style.display = 'block';
      this._hintEl.textContent = 'Press play, then mark your section';
      this._hintEl.classList.remove('active');
    }
    
    this._resultPanel?.classList.remove('visible');
    this._selectionOverlay?.classList.remove('visible');
    this._playhead?.classList.remove('visible');
    
    if (this._currentTimeEl) this._currentTimeEl.textContent = '0:00';
    
    // Enable preview/commit if audio loaded
    if (this._audioBuffer) {
      if (this._commitBtn) this._commitBtn.disabled = false;
      const previewBtn = this._container?.querySelector('.slicer-preview-row .slicer-btn-preview') as HTMLButtonElement;
      if (previewBtn) previewBtn.disabled = false;
    }
  }
  
  private _exportSlice(): void {
    if (this._markStart === null || this._markEnd === null || !this._audioBuffer || !this._audioContext) return;
    
    const sampleRate = this._audioBuffer.sampleRate;
    const startSample = Math.floor(this._markStart * sampleRate);
    const endSample = Math.floor(this._markEnd * sampleRate);
    const sliceLength = endSample - startSample;
    const numChannels = this._audioBuffer.numberOfChannels;
    
    // Create sliced buffer
    const slicedBuffer = this._audioContext.createBuffer(numChannels, sliceLength, sampleRate);
    for (let ch = 0; ch < numChannels; ch++) {
      slicedBuffer.getChannelData(ch).set(
        this._audioBuffer.getChannelData(ch).subarray(startSample, endSample)
      );
    }
    
    // Encode as WAV
    const wavBlob = this._encodeWAV(slicedBuffer);
    
    // Invoke callback or dispatch action
    if (this._onSliceComplete) {
      this._onSliceComplete({
        blob: wavBlob,
        startTime: this._markStart,
        endTime: this._markEnd,
        duration: this._markEnd - this._markStart
      });
    }
    
    // Dispatch action to controller
    void this._controller.dispatch({
      type: 'AUDIO_SLICE_COMPLETE',
      payload: {
        blob: wavBlob,
        startTime: this._markStart,
        endTime: this._markEnd,
        duration: this._markEnd - this._markStart
      }
    });
  }
	
	private _handleCommit(): void {
    const isolateVocals = this._isolateCheckbox?.checked || false;
    const useSlice = this._markStart !== null && this._markEnd !== null;
    
    // PARITY FIX: Always send original file to backend.
    // We disable the client-side blob optimization here because browser decoding (48k)
    // creates artifacts compared to Librosa (native).
    
    void this._controller.dispatch({
      type: 'AUDIO_COMMIT',
      payload: {
        useSlice,
        startTime: this._markStart,
        endTime: this._markEnd,
        isolateVocals,
        removeSilence: this._silenceEnabled,
        silenceThreshold: parseFloat((this._container?.querySelector('.slicer-silence-thresh') as HTMLInputElement)?.value || '-40'),
        silenceMinDuration: parseFloat((this._container?.querySelector('.slicer-min-duration') as HTMLInputElement)?.value || '1.0'),
        sliceBlob: useSlice ? this._createSliceBlob() : null,
        originalFile: this._originalFile ?? undefined
      }
    });
  }
	
	private async _applySilenceCompression(): Promise<void> {
    if (!this._rawVocalsBuffer) {
      console.warn('[AudioSlicerPanel] No raw vocals to compress');
      return;
    }
    
    // Read params from inputs
    const minSilenceInput = this._container?.querySelector('.slicer-min-silence') as HTMLInputElement;
    const threshInput = this._container?.querySelector('.slicer-silence-thresh') as HTMLInputElement;
    const gapInput = this._container?.querySelector('.slicer-gap-duration') as HTMLInputElement;
    
    const minDurationInput = this._container?.querySelector('.slicer-min-duration') as HTMLInputElement;
    this._minDuration = parseFloat(minDurationInput?.value || '1.0');
    this._silenceThresh = parseFloat(threshInput?.value || '-40');
    
    const applyBtn = this._container?.querySelector('.slicer-btn-apply-silence') as HTMLButtonElement;
    if (applyBtn) applyBtn.textContent = '⏳ Applying...';
    
    try {
      const rawBlob = this._encodeWAV(this._rawVocalsBuffer);
      
      const formData = new FormData();
      formData.append('file', new File([rawBlob], 'vocals.wav', { type: 'audio/wav' }));
      formData.append('min_duration', String(this._minDuration));
      formData.append('threshold_db', String(this._silenceThresh));
      
      const response = await fetch('/api/audio/compress-silence', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error(`Compression failed: ${response.status}`);
      
      const compressedBlob = await response.blob();
      const arrayBuffer = await compressedBlob.arrayBuffer();
      
      this._initAudioContext();
      this._processedBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);
      
      // Auto-play result
      this._stopAll();
      this._sourceNode = this._audioContext!.createBufferSource();
      this._sourceNode.buffer = this._processedBuffer;
      this._sourceNode.connect(this._audioContext!.destination);
      this._sourceNode.start(0);
      
      this._isPreviewing = true;
      
      const previewBtn = this._container?.querySelector('.slicer-preview-row .slicer-btn-preview') as HTMLButtonElement;
      if (previewBtn) previewBtn.textContent = '❚❚ Pause';
      
      this._sourceNode.onended = () => {
        this._isPreviewing = false;
        if (previewBtn) previewBtn.textContent = '▶ Preview';
      };
      
    } catch (error) {
      console.error('[AudioSlicerPanel] Silence compression failed:', error);
    } finally {
      if (applyBtn) applyBtn.textContent = 'Apply';
    }
  }
  
  private _createSliceBlob(): Blob | null {
    if (this._markStart === null || this._markEnd === null || !this._audioBuffer || !this._audioContext) {
      return null;
    }
    
    const sampleRate = this._audioBuffer.sampleRate;
    const startSample = Math.floor(this._markStart * sampleRate);
    const endSample = Math.floor(this._markEnd * sampleRate);
    const sliceLength = endSample - startSample;
    const numChannels = this._audioBuffer.numberOfChannels;
    
    const slicedBuffer = this._audioContext.createBuffer(numChannels, sliceLength, sampleRate);
    for (let ch = 0; ch < numChannels; ch++) {
      slicedBuffer.getChannelData(ch).set(
        this._audioBuffer.getChannelData(ch).subarray(startSample, endSample)
      );
    }
    
    return this._encodeWAV(slicedBuffer);
  }
  
  private _encodeWAV(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const dataLength = buffer.length * blockAlign;
    const arrayBuffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(arrayBuffer);
    
    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    
    // RIFF header
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeStr(8, 'WAVE');
    
    // fmt chunk
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    
    // data chunk
    writeStr(36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Interleaved samples
    const channels: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
      channels.push(buffer.getChannelData(ch));
    }
    
    let pos = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, channels[ch][i]));
        view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        pos += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
	
	private _openAccordion(id: string): void {
    const target = this._container?.querySelector(`#${id}`) as HTMLDetailsElement;
    if (target) {
      // Close others
      this._container?.querySelectorAll('.subcategory-item').forEach(item => {
        (item as HTMLDetailsElement).open = false;
      });
      target.open = true;
    }
  }
  
  private _resetToUpload(): void {
    this._stopAll();
    this._audioBuffer = null;
    this._originalFile = null;
    this._processedBuffer = null;
    this._rawVocalsBuffer = null;
    this._resetState();
    
    this._dropZone?.classList.remove('hidden');
    this._songLoaded?.classList.remove('visible');
    
    const songFooter = this._container?.querySelector('.slicer-song-footer') as HTMLElement;
    if (songFooter) songFooter.style.display = 'none';
    
    const subtitle = this._container?.querySelector('.slicer-song-subtitle');
    if (subtitle) subtitle.textContent = 'Choose audio file';
    
    if (this._fileInput) this._fileInput.value = '';
  }
  
  private _useFullTrack(): void {
    if (!this._audioBuffer) return;
    this._markStart = 0;
    this._markEnd = this._audioBuffer.duration;
    this._updateMarkButtonsV2();
    this._updateSelectionSummary();
    this._updateSelection();
    this._controller.updateAudioAccordionValue('slicing');
  }
  
  private _updateMarkButtonsV2(): void {
    if (!this._trimmerSection) return;
    
    const startTimeEl = this._trimmerSection.querySelector('.slicer-btn-mark-start .slicer-mark-btn-time');
    const endTimeEl = this._trimmerSection.querySelector('.slicer-btn-mark-end .slicer-mark-btn-time');
    const startBtn = this._trimmerSection.querySelector('.slicer-btn-mark-start');
    const endBtn = this._trimmerSection.querySelector('.slicer-btn-mark-end');
    
    if (startTimeEl) {
      startTimeEl.textContent = this._markStart !== null ? this._formatTime(this._markStart) : '—';
    }
    if (startBtn) {
      startBtn.classList.toggle('marked', this._markStart !== null);
    }
    if (endTimeEl) {
      endTimeEl.textContent = this._markEnd !== null ? this._formatTime(this._markEnd) : '—';
    }
    if (endBtn) {
      endBtn.classList.toggle('marked', this._markEnd !== null);
    }
  }
  
  private _updateSelectionSummary(): void {
    const summary = this._trimmerSection?.querySelector('.slicer-selection-summary');
    if (!summary) return;
    
    if (this._markStart !== null && this._markEnd !== null) {
      const start = Math.min(this._markStart, this._markEnd);
      const end = Math.max(this._markStart, this._markEnd);
      const duration = end - start;
      
      const rangeEl = summary.querySelector('.slicer-summary-range');
      const durationEl = summary.querySelector('.slicer-summary-duration');
      
      if (rangeEl) rangeEl.textContent = `${this._formatTime(start)} → ${this._formatTime(end)}`;
      if (durationEl) {
        const mins = Math.floor(duration / 60);
        const secs = Math.floor(duration % 60);
        durationEl.textContent = mins > 0 ? `(${mins} min ${secs} sec)` : `(${secs} sec)`;
      }
      
      summary.classList.add('visible');
    } else {
      summary.classList.remove('visible');
    }
  }
  
  private _resetState(): void {
    this._markStart = null;
    this._markEnd = null;
    this._markPhase = 'start';
    this._pausedAt = 0;
    this._isPlaying = false;
    
    if (this._markStartBtn) this._markStartBtn.disabled = true;
    if (this._markEndBtn) this._markEndBtn.disabled = true;
    if (this._commitBtn) this._commitBtn.disabled = true;
    if (this._selectionValueEl) this._selectionValueEl.textContent = 'Full track';
    if (this._isolateCheckbox) this._isolateCheckbox.checked = false;
    
    const markRow = this._container?.querySelector('.slicer-mark-row') as HTMLElement;
    if (markRow) markRow.style.display = 'block';
    
    if (this._hintEl) {
      this._hintEl.style.display = 'block';
      this._hintEl.textContent = 'Press play, then mark your section';
      this._hintEl.classList.remove('active');
    }
    
    this._resultPanel?.classList.remove('visible');
    this._selectionOverlay?.classList.remove('visible');
    this._playhead?.classList.remove('visible');
    
    if (this._currentTimeEl) this._currentTimeEl.textContent = '0:00';
  }
  
  /**
   * Load audio from an existing File object (e.g., from UploadPanel)
   */
  public loadAudioFile(file: File): void {
    this._loadFile(file);
  }
  
  /**
   * Load audio from an existing AudioBuffer
   */
  public loadAudioBuffer(buffer: AudioBuffer, fileName?: string): void {
    this._initAudioContext();
    this._audioBuffer = buffer;
    
    this._dropZone?.classList.add('hidden');
    this._songLoaded?.classList.add('visible');
    
    const fileNameEl = this._container?.querySelector('.slicer-file-name');
    if (fileNameEl) fileNameEl.textContent = fileName || 'Audio';
    
    if (this._totalTimeEl) {
      this._totalTimeEl.textContent = this._formatTime(buffer.duration);
    }
    
    this._resetState();
		this._invalidateGeneratedBuffers();
		this._updateCommitButton();
		this._drawWaveform();
		this._controller.updateAudioAccordionValue('custom');
		
		// Persist filename to composition state
		this._controller.updateAudioSourceState({
			source_file: file.name,
			start_time: 0,
			end_time: this._audioBuffer!.duration
		});
  }
  
  destroy(): void {
    // Stop playback
    this._stop();
    
    // Remove resize listener
    window.removeEventListener('resize', this._handleResize);
    
    // Close audio context
    if (this._audioContext) {
      this._audioContext.close();
      this._audioContext = null;
    }
    
    // Remove DOM
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}
