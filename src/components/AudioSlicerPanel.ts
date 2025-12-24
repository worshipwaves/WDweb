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

import type { ApplicationController } from '../ApplicationController';
import type { PanelComponent } from '../types/PanelTypes';

interface SliceResult {
  blob: Blob;
  startTime: number;
  endTime: number;
  duration: number;
}

interface StoredAudioRecord {
  id: string;
  file: File;
  fileName: string;
  savedAt: number;
}

interface OptimizationResult {
  exponent: number;
  filter_amount: number;
  silence_threshold: number;
  binning_mode: string;
  remove_silence: boolean;
  silence_duration: number;
  status: 'optimized' | 'fallback' | 'error';
}

export class AudioSlicerPanel implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _controller: ApplicationController;
  
  // DOM references
  private _dropZone: HTMLElement | null = null;
	private _dropContent: HTMLElement | null = null;
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
  
  // Isolate Vocals param
  private _isolateVocals: boolean = false;
	
	// Pending intent for deferred UI update
  private _pendingIntent: 'music' | 'speech' | null = null;

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

	// IndexedDB storage
  private static readonly DB_NAME = 'WaveDesignerAudio';
  private static readonly DB_VERSION = 1;
  private static readonly STORE_NAME = 'audioFiles';
  
  private async _openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(AudioSlicerPanel.DB_NAME, AudioSlicerPanel.DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(AudioSlicerPanel.STORE_NAME)) {
          db.createObjectStore(AudioSlicerPanel.STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }
  
  private async _saveAudioToStorage(file: File): Promise<boolean> {
    try {
      // Check available storage
      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        const available = (estimate.quota || 0) - (estimate.usage || 0);
        if (file.size > available * 0.8) {
          console.warn('[AudioSlicerPanel] Insufficient storage for audio file');
          return false;
        }
      }
      
      const db = await this._openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(AudioSlicerPanel.STORE_NAME, 'readwrite');
        const store = tx.objectStore(AudioSlicerPanel.STORE_NAME);
        
        store.put({
          id: 'currentAudio',
          file: file,
          fileName: file.name,
          savedAt: Date.now()
        });
        
        tx.oncomplete = () => {
          db.close();
          resolve(true);
        };
        tx.onerror = () => {
          console.error('[AudioSlicerPanel] Failed to save audio:', tx.error);
          db.close();
          resolve(false);
        };
      });
    } catch (error) {
      console.error('[AudioSlicerPanel] IndexedDB error:', error);
      return false;
    }
  }
  
  private async _loadAudioFromStorage(): Promise<File | null> {
    try {
      const db = await this._openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(AudioSlicerPanel.STORE_NAME, 'readonly');
        const store = tx.objectStore(AudioSlicerPanel.STORE_NAME);
        const request = store.get('currentAudio');
        
        request.onsuccess = () => {
          db.close();
          const record = request.result as StoredAudioRecord | undefined;
          if (record?.file) {
            resolve(record.file);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => {
          db.close();
          resolve(null);
        };
      });
    } catch (error) {
      console.error('[AudioSlicerPanel] IndexedDB load error:', error);
      return null;
    }
  }
  
  private async _clearAudioStorage(): Promise<void> {
    try {
      const db = await this._openDB();
      const tx = db.transaction(AudioSlicerPanel.STORE_NAME, 'readwrite');
      const store = tx.objectStore(AudioSlicerPanel.STORE_NAME);
      store.delete('currentAudio');
      tx.oncomplete = () => db.close();
    } catch (error) {
      console.error('[AudioSlicerPanel] IndexedDB clear error:', error);
    }
  }

	private async _attemptAudioRestore(): Promise<void> {
    const file = await this._loadAudioFromStorage();
    
    if (file) {
      // Verify filename matches persisted state
      if (file.name === this._persistedFileName) {
        // Read persisted state BEFORE loading (loadFile overwrites it)
        const state = this._controller.getState();
        const src = state?.composition?.audio_source;
        const persistedStart = src?.start_time;
        const persistedEnd = src?.end_time;
        const needsVocals = src?.use_stems || false;
        
        // Load file without auto-commit
        await this._loadFile(file, true);
        
        // Restore slice and demucs state from saved values
        if (persistedStart !== undefined && persistedEnd !== undefined) {
        this._markStart = persistedStart;
          this._markEnd = persistedEnd;
          this._updateSelection();
          this._updateMarkButtonsV2();
        }
        
        // Restore vocals toggle state
        this._isolateVocals = needsVocals;
        
        // Update checkbox if trimmer section exists
        const checkbox = this._trimmerSection?.querySelector('.slicer-isolate-checkbox') as HTMLInputElement;
        if (checkbox) checkbox.checked = needsVocals;
        
        // Do NOT auto-process vocals on restore.
        // Composition is already valid from localStorage - artwork already rendered.
        // Demucs is expensive (30+ seconds); only run when user explicitly requests.
        
        // Do NOT call _handleCommit() here.
        // Global state is already correct from localStorage.
        // Committing would trigger backend processing that resets section_materials.
        return;
      } else {
        // Stale data, clear it
        await this._clearAudioStorage();
      }
    }
    
    // Restore failed - show re-upload prompt
    this._showReuploadPrompt();
  }
  
  private _showReuploadPrompt(): void {
    if (!this._uploadSection) return;
    
    // Update drop zone text to indicate re-upload needed
    const dropText = this._uploadSection.querySelector('.slicer-drop-text');
    const dropHint = this._uploadSection.querySelector('.slicer-drop-hint');
    
    if (dropText) dropText.textContent = 'Re-upload Your Song';
    if (dropHint) {
      dropHint.textContent = 'Your previous session expired. Please upload again to continue editing.';
      (dropHint as HTMLElement).style.color = '#c0392b';
    }
    
    // Ensure drop zone is visible
    this._dropContent?.classList.remove('hidden');
    this._songLoaded?.classList.remove('visible');
  }
  
  constructor(
    controller: ApplicationController,
    onSliceComplete?: (result: SliceResult) => void
  ) {
    this._controller = controller;
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
  }
  
  /**
   * Restore Upload Section UI based on persisted state
   */
  private _restoreUploadState(): void {
    const fileName = this._originalFile?.name || this._persistedFileName;
    const isLoaded = !!this._audioBuffer || !!this._persistedFileName;

    if (isLoaded && fileName) {
      this._dropContent?.classList.add('hidden');
      this._songLoaded?.classList.add('visible');
      
      if (this._songNameEl) this._songNameEl.textContent = fileName;
      
      if (this._songDurationEl) {
        const durationText = this._audioBuffer 
          ? this._formatTime(this._audioBuffer.duration) 
          : '--:--';
        this._songDurationEl.textContent = `${durationText} · ${this._audioBuffer ? 'Ready' : 'Re-upload to Edit'}`;
      }
    }
  }

  /**
   * Invalidate L3 (Vocals) and L4 (Processed) buffers.
   * Called when L1 (Source) or L2 (Trim) changes.
   */
  private _invalidateGeneratedBuffers(): void {
    if (this._rawVocalsBuffer || this._processedBuffer) {
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
  }
	
	renderTrimmerSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'audio-slicer-trimmer-section';
    this._trimmerSection = section;
    section.innerHTML = `
      <div class="slicer-section-header">
        <span class="slicer-section-number">1</span>
        <div class="slicer-section-text">
          <div class="slicer-section-title">Select part of the audio</div>
          <div class="slicer-section-desc">Listen, then tap to mark your selection</div>
        </div>
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
      
      <div class="slicer-controls-row">
        <button class="slicer-play-btn" data-demo-id="slicer_play" title="Play selection">
          <svg class="slicer-play-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          <svg class="slicer-pause-icon" viewBox="0 0 24 24" fill="currentColor" style="display:none;"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        </button>
        <button class="slicer-mark-btn slicer-btn-mark-start" data-demo-id="slicer_start">
          <span class="slicer-mark-btn-label">Start Here</span>
          <span class="slicer-mark-btn-time">—</span>
        </button>
        <button class="slicer-mark-btn slicer-btn-mark-end" data-demo-id="slicer_end">
          <span class="slicer-mark-btn-label">End Here</span>
          <span class="slicer-mark-btn-time">—</span>
        </button>
        <button class="slicer-btn-reset" title="Reset to full song">Reset</button>
      </div>
      
      <div class="slicer-section-header">
        <span class="slicer-section-number">2</span>
        <div class="slicer-section-text">
          <div class="slicer-section-title">Isolate the Vocals <span class="slicer-vocals-status"></span></div>
          <div class="slicer-section-desc">Removes background music</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" class="slicer-isolate-checkbox" ${this._isolateVocals ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
      
      <div class="slicer-cta-footer">
        <button class="slicer-btn-primary slicer-btn-apply" style="flex:1;">Apply To Artwork</button>
      </div>
    `;
    this._cacheTrimmerElements(section);
    this._attachTrimmerListeners(section);
    this._restoreTrimmerState();
    
    // Attempt to restore audio from IndexedDB if not already loaded
    if (!this._audioBuffer && this._persistedFileName) {
      void this._attemptAudioRestore();
    }
    
    return section;
  }
	
	private _applyPendingIntent(): void {
    if (!this._pendingIntent || !this._uploadSection) return;
    const radio = this._uploadSection.querySelector(`input[name="upload-intent"][value="${this._pendingIntent}"]`) as HTMLInputElement;
    if (radio) {
      radio.checked = true;
      this._pendingIntent = null;
    }
  }
	
	renderUploadSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'audio-slicer-upload-section';
    this._uploadSection = section;
    section.innerHTML = `
      <div class="slicer-card">
        <div class="slicer-section-header">
          <span class="slicer-section-number">1</span>
          <div class="slicer-section-text">
            <div class="slicer-section-title">What type of audio?</div>
            <div class="slicer-section-desc">Select one before uploading</div>
          </div>
        </div>
        <div class="slicer-intent-controls">
          <label class="slicer-radio"><input type="radio" name="upload-intent" value="music" checked> Music</label>
          <label class="slicer-radio"><input type="radio" name="upload-intent" value="speech"> Speech</label>
        </div>
      </div>
      
      <div class="slicer-card slicer-drop-zone" data-demo-id="slicer_drop">
        <div class="slicer-section-header">
          <span class="slicer-section-number">2</span>
          <div class="slicer-section-text">
            <div class="slicer-section-title">Upload your file</div>
            <div class="slicer-section-desc">Drop or browse to select</div>
          </div>
        </div>
        <div class="slicer-drop-content">
          <div class="upload-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <p class="slicer-drop-text">Drop file here</p>
          <p class="slicer-drop-hint">or tap to browse</p>
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
        <input type="file" class="slicer-file-input" accept="audio/*">
      </div>
    `;
    this._cacheUploadElements(section);
    this._attachUploadListeners(section);
    this._restoreUploadState();
    
    // Attempt to restore audio from IndexedDB if not already loaded
    if (!this._audioBuffer) {
      void this._attemptAudioRestore();
    }
		
		// Apply any pending intent from collection load
    this._applyPendingIntent();
    
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
      const file = e.dataTransfer?.files[0];
      if (file) void this._loadFile(file);
    });
    this._fileInput?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void this._loadFile(file);
    });
    section.querySelector('.slicer-song-change')?.addEventListener('click', () => {
      this._resetToUpload();
    });
    
    // Reprocess when intent changes if audio already loaded
    section.querySelectorAll('input[name="upload-intent"]').forEach(radio => {
      radio.addEventListener('change', () => {
        if (this._originalFile && this._audioBuffer) {
          void this._runOptimization().then(() => this._handleCommit());
        }
      });
    });
  }

  private _attachTrimmerListeners(section: HTMLElement): void {
    this._attachHandleDrag(section);
    section.querySelector('.slicer-play-btn')?.addEventListener('click', () => this._togglePlayback());
    section.querySelector('.slicer-btn-rewind')?.addEventListener('click', () => this._seek(-5));
    section.querySelector('.slicer-btn-forward')?.addEventListener('click', () => this._seek(5));
    section.querySelector('.slicer-btn-mark-start')?.addEventListener('click', () => this._handleMarkStart());
    section.querySelector('.slicer-btn-mark-end')?.addEventListener('click', () => this._handleMarkEnd());
    section.querySelector('.slicer-btn-reset')?.addEventListener('click', () => this._resetToFullTrack());
    section.querySelector('.slicer-isolate-checkbox')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this._isolateVocals = checked;
      this._persistToggleState();
      
      // Process vocals if enabled and not already cached
      if (checked && !this._rawVocalsBuffer && this._audioBuffer && this._originalFile) {
        void this._processVocals();
      }
    });
    section.querySelector('.slicer-btn-apply')?.addEventListener('click', () => {
      void this._runOptimization().then(() => this._handleCommit());
    });
    
    window.addEventListener('resize', this._handleResize);
  }
	
	/**
   * Get enhancements summary for accordion header display
   */
  public getEnhancementsDisplay(): string | null {
    const vocals = this._isolateVocals;
    const silence = this._controller.getState()?.composition.audio_processing?.remove_silence;
    
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
		
    this._commitBtn?.addEventListener('click', () => this._handleCommit());
  }
  
  private async _runOptimization(intentOverride?: 'music' | 'speech'): Promise<void> {
    if (!this._originalFile) {
      void this._controller.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'idle', progress: 100 }
      });
      return;
    }
    
    const statusEl = this._trimmerSection?.querySelector('.slicer-optimize-status') as HTMLElement;
    const btn = this._trimmerSection?.querySelector('.slicer-btn-optimize') as HTMLButtonElement;
    
    if (statusEl) statusEl.textContent = 'Analyzing...';
    if (btn) btn.disabled = true;
    
    const formData = new FormData();
    
    // Use sliced audio if slice markers are set, otherwise use original
    const hasSlice = this._markStart !== null && this._markEnd !== null && 
                     (this._markStart > 0 || this._markEnd < (this._audioBuffer?.duration ?? 0));
    if (hasSlice && this._audioBuffer) {
      const sliceBlob = this._createSliceBlob();
      if (sliceBlob) {
        formData.append('file', new File([sliceBlob], 'slice.wav', { type: 'audio/wav' }));
      } else {
        formData.append('file', this._originalFile);
      }
    } else {
      formData.append('file', this._originalFile);
    }
    
    const intentRadio = this._uploadSection?.querySelector('input[name="upload-intent"]:checked') as HTMLInputElement;
    const intent = intentOverride || intentRadio?.value || 'music';
    formData.append('mode', intent);
    formData.append('num_slots', String(this._controller.getState()?.composition.pattern_settings.number_slots || 48));
    
    try {
      const response = await fetch('/api/audio/optimize', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error(`${response.status}`);
      
      const result = await response.json() as OptimizationResult;
      
      // 1. Get optimized composition DTO (Pure, no state mutation yet)
      const optimizedComposition = this._controller.createOptimizedComposition(result);
      
      if (optimizedComposition) {
        // 2. Pass to main pipeline
        // This ensures detectChangedParams sees the difference in exponent/filter settings,
        // triggering logic which handles cache rebinning AND backend scaling.
        await this._controller.handleCompositionUpdate(optimizedComposition);
      }
      
      if (statusEl) {
        statusEl.textContent = result.status === 'fallback' 
          ? `⚠ ${result.exponent}` 
          : `✓ ${result.exponent}`;
        statusEl.className = `slicer-optimize-status ${result.status}`;
      }
    } catch (error) {
      console.error('[AudioSlicerPanel] Optimization failed:', error);
      if (statusEl) {
        statusEl.textContent = '✗ Error';
        statusEl.className = 'slicer-optimize-status error';
      }
    } finally {
      if (btn) btn.disabled = false;
    }
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
    
    // Restore slice and demucs state from composition if not already set
    const state = this._controller.getState();
    if (state?.composition?.audio_source) {
      const src = state.composition.audio_source;
      
      // Restore slice markers if audio loaded and marks at default
      if (this._audioBuffer && src.start_time !== undefined && src.end_time !== undefined) {
        const isFullTrack = this._markStart === 0 && this._markEnd === this._audioBuffer.duration;
        const hasPersistedSlice = src.start_time !== 0 || src.end_time !== this._audioBuffer.duration;
        
        if (isFullTrack && hasPersistedSlice) {
          this._markStart = src.start_time;
          this._markEnd = src.end_time;
        }
      }
      
      // Restore vocals toggle
      if (src.use_stems !== undefined) {
        this._isolateVocals = src.use_stems;
        const checkbox = this._trimmerSection?.querySelector('.slicer-isolate-checkbox') as HTMLInputElement;
        if (checkbox) checkbox.checked = this._isolateVocals;
      }
    }
    
    // Restore mark times
    this._updateMarkButtonsV2();
    
    // Restore selection overlay
    this._updateSelection();
    
    // Restore selection summary
    this._updateSelectionSummary();
    
    // Ensure controls are enabled if audio exists
    this._updateCommitButton();
  }
	
	private _restoreUploadState(): void {
    if (this._audioBuffer && this._originalFile) {
      this._dropContent?.classList.add('hidden');
      this._songLoaded?.classList.add('visible');
      if (this._songNameEl) this._songNameEl.textContent = this._originalFile.name;
      if (this._songDurationEl) this._songDurationEl.textContent = `${this._formatTime(this._audioBuffer.duration)} · Ready`;
    }
  }
	
	private _cacheUploadElements(section: HTMLElement): void {
    this._dropZone = section.querySelector('.slicer-drop-zone');
    this._dropContent = section.querySelector('.slicer-drop-content');
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
      this._invalidateGeneratedBuffers();
      // Clear vocals status since buffer is now stale
      const statusEl = this._trimmerSection?.querySelector('.slicer-vocals-status');
      if (statusEl) statusEl.textContent = '';
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
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this._audioContext = new AudioCtx();
    }
  }
  
  private async _loadFile(file: File, skipAutoCommit: boolean = false, intent?: 'music' | 'speech'): Promise<void> {
    this._initAudioContext();
    
    // Show processing overlay immediately
    if (!skipAutoCommit) {
      void this._controller.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'uploading', progress: 0, message: `Processing ${file.name}` }
      });
    }
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      this._audioBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);
			this._originalFile = file;
      
      // Update UI
      this._dropContent?.classList.add('hidden');
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
      
      this._resetState(skipAutoCommit);
      // Initialize selection to full track so handles are visible
      this._markStart = 0;
      this._markEnd = this._audioBuffer.duration;
      this._updateCommitButton();
      this._drawWaveform();
      this._updateSelection();
      this._updateMarkButtonsV2();
      this._controller.updateAudioAccordionValue('custom');
      
      // Only update state with defaults on fresh upload, not restore
      if (!skipAutoCommit) {
        this._controller.updateAudioSourceState({
          source_file: file.name,
          start_time: 0,
          end_time: this._audioBuffer.duration
        });
        
        // Save to IndexedDB for persistence across refresh
        void this._saveAudioToStorage(file);
				
				// Update intent radio button if provided (or store for later if section not rendered)
        if (intent) {
          this._pendingIntent = intent;
          this._applyPendingIntent();
        }
        
        // Auto-optimize with intent, then commit
        await this._runOptimization(intent);
        this._handleCommit();
      }
      
    } catch (err) {
      console.error('[AudioSlicerPanel] Decode error:', err);
      void this._controller.dispatch({
        type: 'PROCESSING_UPDATE',
        payload: { stage: 'idle', progress: 0 }
      });
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
    
    // Waveform using RMS for better visual differentiation
    this._ctx.fillStyle = `rgb(${waveColor})`;
    
    for (let i = 0; i < width; i++) {
      // Calculate RMS (root mean square) for this slice
      let sumSquares = 0;
      for (let j = 0; j < step; j++) {
        const v = data[i * step + j] || 0;
        sumSquares += v * v;
      }
      const rms = Math.sqrt(sumSquares / step);
      
      // Scale RMS to visible height (RMS of full-scale sine is ~0.707)
      const barH = Math.max(1, rms * amp * 4.5);
      this._ctx.fillRect(i, amp - barH / 2, 1, barH);
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
    
    // Use vocals buffer if stem separation enabled and available
    const buffer = (this._isolateVocals && this._rawVocalsBuffer) 
      ? this._rawVocalsBuffer 
      : this._audioBuffer;
    
    // Determine selection bounds
    // When using vocals buffer, it's already sliced - play full buffer
    const isUsingVocals = this._isolateVocals && !!this._rawVocalsBuffer;
    const startTime = isUsingVocals ? 0 : (this._markStart ?? 0);
    const endTime = isUsingVocals ? buffer.duration : (this._markEnd ?? buffer.duration);
    const selectionStart = Math.min(startTime, endTime);
    const selectionEnd = Math.max(startTime, endTime);
    
    // Reset pausedAt if it's outside valid range for current buffer
    if (this._pausedAt < selectionStart || this._pausedAt >= selectionEnd) {
      this._pausedAt = selectionStart;
    }
    
    // Start from selection start, or paused position if within selection
    let offset = selectionStart;
    if (this._pausedAt >= selectionStart && this._pausedAt < selectionEnd) {
      offset = this._pausedAt;
    }
    
    this._sourceNode = this._audioContext.createBufferSource();
    this._sourceNode.buffer = buffer;
    this._sourceNode.connect(this._audioContext.destination);
    this._sourceNode.start(0, offset, selectionEnd - offset);
    
    this._pausedAt = offset;
    this._playStartedAt = this._audioContext.currentTime;
    this._isPlaying = true;
    this._playhead?.classList.add('visible');
    
    if (this._markStartBtn) this._markStartBtn.disabled = false;
    if (this._markEndBtn) this._markEndBtn.disabled = false;
    
    // Toggle play/pause icons
    const section = this._trimmerSection || this._container;
    const playBtn = section?.querySelector('.slicer-play-btn');
    const playIcon = playBtn?.querySelector('.slicer-play-icon') as HTMLElement;
    const pauseIcon = playBtn?.querySelector('.slicer-pause-icon') as HTMLElement;
    if (playIcon) playIcon.style.display = 'none';
    if (pauseIcon) pauseIcon.style.display = '';
    playBtn?.classList.add('playing');
    
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
    
    // Toggle play/pause icons (check both _trimmerSection and _container)
    const section = this._trimmerSection || this._container;
    const playBtn = section?.querySelector('.slicer-play-btn');
    const playIcon = playBtn?.querySelector('.slicer-play-icon') as HTMLElement;
    const pauseIcon = playBtn?.querySelector('.slicer-pause-icon') as HTMLElement;
    if (playIcon) playIcon.style.display = '';
    if (pauseIcon) pauseIcon.style.display = 'none';
    playBtn?.classList.remove('playing');
    
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
    
    // Determine selection end (default to full track)
    const startTime = this._markStart ?? 0;
    const endTime = this._markEnd ?? (this._audioBuffer?.duration ?? 0);
    const selectionEnd = Math.max(startTime, endTime);
    
    if (this._isPlaying && this._audioBuffer && t < selectionEnd) {
      this._animationFrame = requestAnimationFrame(() => this._updatePlayhead());
    } else if (this._audioBuffer && t >= selectionEnd) {
      this._stop();
    }
  }
  
  private _updatePlayheadPosition(): void {
    if (!this._playhead || !this._audioBuffer) return;
    const t = this._getCurrentTime();
    
    // When playing vocals buffer, map position to selection range visually
    const isUsingVocals = this._isolateVocals && !!this._rawVocalsBuffer;
    let pct: number;
    
    if (isUsingVocals && this._markStart !== null && this._markEnd !== null) {
      // Map vocals time (0 to vocalsBuffer.duration) to selection range
      const selectionStart = Math.min(this._markStart, this._markEnd);
      const selectionEnd = Math.max(this._markStart, this._markEnd);
      const selectionDuration = selectionEnd - selectionStart;
      const visualTime = selectionStart + (t / this._rawVocalsBuffer.duration) * selectionDuration;
      pct = (visualTime / this._audioBuffer.duration) * 100;
    } else {
      pct = (t / this._audioBuffer.duration) * 100;
    }
    
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
    
    if (this._markStartBtn) this._markStartBtn.disabled = !this._audioBuffer;
    if (this._markEndBtn) this._markEndBtn.disabled = !this._audioBuffer;
    
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
    const btn = previewBtn;
    if (btn) btn.textContent = '❚❚ Pause';
    
    this._sourceNode.onended = () => {
      this._isPreviewing = false;
      if (btn) btn.textContent = '▶ Preview';
    };
  }
  private async _previewWithProcessing(previewBtn: HTMLButtonElement | null): Promise<void> {
    if (!this._audioBuffer || !this._originalFile) return;
    
    this._isProcessing = true;
    const btn = previewBtn;
    if (btn) btn.textContent = '⏳ Processing...';
    
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
      if (btn) btn.textContent = '❚❚ Pause';
      
    } catch (error) {
      console.error('[AudioSlicerPanel] Preview processing failed:', error);
      this._isProcessing = false;
      if (btn) btn.textContent = '▶ Preview';
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

private async _processPreviewSilenceRemoval(): Promise<void> {
    if (!this._rawVocalsBuffer) return;
    
    try {
      const rawBlob = this._encodeWAV(this._rawVocalsBuffer);
      const audioProcessing = this._controller.getState()?.composition.audio_processing;
      
      const formData = new FormData();
      formData.append('file', new File([rawBlob], 'vocals.wav', { type: 'audio/wav' }));
      formData.append('min_duration', String(audioProcessing?.silence_duration));
      formData.append('threshold_db', String(audioProcessing?.silence_threshold));
      
      const response = await fetch('/api/audio/compress-silence', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error(`Silence removal failed: ${response.status}`);
      
      const compressedBlob = await response.blob();
      const arrayBuffer = await compressedBlob.arrayBuffer();
      
      this._initAudioContext();
      // Replace raw vocals with silence-removed version for preview
      this._rawVocalsBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);
      
    } catch (error) {
      console.error('[AudioSlicerPanel] Preview silence removal failed:', error);
      // Keep raw vocals buffer - preview will work but without silence removal
    }
  }

private async _processVocals(): Promise<void> {
    if (!this._audioBuffer || !this._originalFile) return;
    if (this._isProcessing) return;
    
    this._isProcessing = true;
    
    // Update UI to show processing
    const statusEl = this._trimmerSection?.querySelector('.slicer-vocals-status') as HTMLElement;
    const playBtn = this._trimmerSection?.querySelector('.slicer-play-btn') as HTMLButtonElement;
    const applyBtn = this._trimmerSection?.querySelector('.slicer-btn-apply') as HTMLButtonElement;
    if (statusEl) {
      statusEl.textContent = '(processing...)';
      statusEl.style.color = '#c0392b';
    }
    if (playBtn) playBtn.disabled = true;
    if (applyBtn) applyBtn.disabled = true;
    
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
      
      // Now process silence removal for preview parity
      await this._processPreviewSilenceRemoval();
      
      // Show success
      const statusEl = this._trimmerSection?.querySelector('.slicer-vocals-status') as HTMLElement;
      if (statusEl) {
        statusEl.textContent = '✓';
        statusEl.style.color = '#27ae60';
      }
      
    } catch (error) {
      console.error('[AudioSlicerPanel] Vocals processing failed:', error);
      this._isolateVocals = false;
      const checkbox = this._trimmerSection?.querySelector('.slicer-isolate-checkbox') as HTMLInputElement;
      if (checkbox) checkbox.checked = false;
      
      // Show failure
      const statusEl = this._trimmerSection?.querySelector('.slicer-vocals-status') as HTMLElement;
      if (statusEl) {
        statusEl.textContent = '✗ failed';
        statusEl.style.color = '#c0392b';
      }
    } finally {
      this._isProcessing = false;
      // Re-enable buttons
      const playBtn = this._trimmerSection?.querySelector('.slicer-play-btn') as HTMLButtonElement;
      const applyBtn = this._trimmerSection?.querySelector('.slicer-btn-apply') as HTMLButtonElement;
      if (playBtn) playBtn.disabled = false;
      if (applyBtn) applyBtn.disabled = false;
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
    const labelEl = label;
    if (labelEl) labelEl.textContent = 'Pause';
    
    this._sourceNode.onended = () => {
      this._isPreviewing = false;
      if (labelEl) labelEl.textContent = this._rawVocalsBuffer ? 'Preview Vocals' : 'Process & Preview';
    };
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
    
    // Reset play button icon to play state
    if (this._playBtn) {
      const playIcon = this._playBtn.querySelector('.slicer-play-icon') as HTMLElement;
      const pauseIcon = this._playBtn.querySelector('.slicer-pause-icon') as HTMLElement;
      if (playIcon) playIcon.style.display = '';
      if (pauseIcon) pauseIcon.style.display = 'none';
      this._playBtn.classList.remove('playing');
    }
    
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
    const isolateVocals = this._isolateVocals || this._isolateCheckbox?.checked || false;
    const useSlice = this._markStart !== null && this._markEnd !== null;
    const audioProcessing = this._controller.getState()?.composition.audio_processing;
    const removeSilence = isolateVocals || audioProcessing?.remove_silence;
    
    // If vocals already processed client-side, use cached buffer and skip backend demucs
    const vocalsAlreadyProcessed = isolateVocals && !!this._rawVocalsBuffer;
    
    let fileToSend: File | Blob | undefined = this._originalFile ?? undefined;
    if (vocalsAlreadyProcessed) {
      // Send pre-processed vocals, tell backend to skip demucs
      fileToSend = new File([this._encodeWAV(this._rawVocalsBuffer!)], 'vocals.wav', { type: 'audio/wav' });
    }
    
    void this._controller.dispatch({
      type: 'AUDIO_COMMIT',
      payload: {
        // When vocals pre-processed, file is already sliced - don't slice again
        useSlice: vocalsAlreadyProcessed ? false : useSlice,
        startTime: vocalsAlreadyProcessed ? 0 : this._markStart,
        endTime: vocalsAlreadyProcessed ? (this._rawVocalsBuffer?.duration ?? this._markEnd) : this._markEnd,
        isolateVocals: vocalsAlreadyProcessed ? false : isolateVocals, // Skip demucs if already done
        removeSilence,
        silenceThreshold: audioProcessing?.silence_threshold,
      silenceMinDuration: audioProcessing?.silence_duration,
        sliceBlob: null, // Slicing handled by file selection above
        originalFile: fileToSend
      }
    });
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
      this._container?.querySelectorAll('.subcategory-item').forEach(el => {
        const details = el as HTMLDetailsElement;
        details.open = false;
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
    
    // Clear stored audio since user is starting fresh
    void this._clearAudioStorage();
    
    this._dropContent?.classList.remove('hidden');
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
  
  private _handlePreviewFinal(): void {
    const btn = this._trimmerSection?.querySelector('.slicer-btn-preview-final');
    const playIcon = btn?.querySelector('.slicer-play-icon') as HTMLElement;
    const pauseIcon = btn?.querySelector('.slicer-pause-icon') as HTMLElement;
    const label = btn?.querySelector('.slicer-preview-label');
    
    if (this._isPreviewing) {
      this._stopAll();
      this._isPreviewing = false;
      if (playIcon) playIcon.style.display = '';
      if (pauseIcon) pauseIcon.style.display = 'none';
      if (label) label.textContent = 'Preview';
    } else {
      this._handleCommit();
    }
  }
  
  private _resetToFullTrack(): void {
    if (!this._audioBuffer) return;
    this._markStart = 0;
    this._markEnd = this._audioBuffer.duration;
    this._pausedAt = 0;
    
    // Invalidate vocals buffer since slice changed
    this._invalidateGeneratedBuffers();
    
    // Reset vocals toggle
    this._isolateVocals = false;
    const checkbox = this._trimmerSection?.querySelector('.slicer-isolate-checkbox') as HTMLInputElement;
    if (checkbox) checkbox.checked = false;
    
    // Clear vocals status
    const statusEl = this._trimmerSection?.querySelector('.slicer-vocals-status') as HTMLElement;
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.style.color = '';
    }
    
    this._updateMarkButtonsV2();
    this._updateSelection();
    this._persistTrimState();
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
  
  private _resetState(skipPersist: boolean = false): void {
    this._markStart = null;
    this._markEnd = null;
    this._markPhase = 'start';
    this._pausedAt = 0;
    this._isPlaying = false;
    this._isolateVocals = false;
    
    // Persist reset state to clear any stale values (unless skipping during restore)
    if (!skipPersist) {
      this._persistToggleState();
    }
    
    // Reset vocals checkbox in trimmer section
    const trimmerCheckbox = this._trimmerSection?.querySelector('.slicer-isolate-checkbox') as HTMLInputElement;
    if (trimmerCheckbox) trimmerCheckbox.checked = false;
    
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
  public loadAudioFile(file: File, intent?: 'music' | 'speech'): void {
    void this._loadFile(file, false, intent);
  }
  
  /**
   * Load audio from an existing AudioBuffer
   */
  public loadAudioBuffer(buffer: AudioBuffer, fileName?: string): void {
    this._initAudioContext();
    this._audioBuffer = buffer;
    
    this._dropContent?.classList.add('hidden');
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
			source_file: fileName ?? '',
			start_time: 0,
			end_time: this._audioBuffer.duration
		});
  }
  
  destroy(): void {
    // Stop playback
    this._stop();
    
    // Remove resize listener
    window.removeEventListener('resize', this._handleResize);
    
    // Close audio context
    if (this._audioContext) {
      void this._audioContext.close();
      this._audioContext = null;
    }
    
    // Remove DOM
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}
