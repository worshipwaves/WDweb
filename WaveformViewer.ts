/**
 * WaveformViewer.ts
 * Handles audio file loading, waveform visualization, and playback controls
 */

export interface AudioState {
  file: File | null;
  buffer: AudioBuffer | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  sliceRange: { start: number; end: number } | null;
}

export class WaveformViewer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private audioContext: AudioContext;
  private audioBuffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private startedAt: number = 0;
  private pausedAt: number = 0;
  private isPlaying: boolean = false;
  
  private waveformData: Float32Array | null = null;
  private peaks: number[] = [];
  private troughs: number[] = [];
  
  private markers: { begin: number | null; end: number | null } = { begin: null, end: null };
  private isDragging: boolean = false;
  private hoverPosition: number | null = null;
  
  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) throw new Error(`Canvas element with id "${canvasId}" not found`);
    
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context from canvas');
    this.ctx = ctx;
    
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.setupCanvas();
    this.attachEventListeners();
  }
  
  private setupCanvas(): void {
    const resizeCanvas = () => {
      const container = this.canvas.parentElement;
      if (container) {
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        if (this.waveformData) this.drawWaveform();
      }
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
  }
  
  public async loadAudio(file: File): Promise<void> {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    const arrayBuffer = await file.arrayBuffer();
    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this.extractWaveformData();
    this.drawWaveform();
  }
  
  private extractWaveformData(): void {
    if (!this.audioBuffer) return;
    
    this.waveformData = this.audioBuffer.getChannelData(0);
    const samplesPerPixel = Math.floor(this.waveformData.length / this.canvas.width);
    this.peaks = [];
    this.troughs = [];
    
    for (let i = 0; i < this.canvas.width; i++) {
      const start = i * samplesPerPixel;
      const end = Math.min(start + samplesPerPixel, this.waveformData.length);
      
      let min = 1.0;
      let max = -1.0;
      
      for (let j = start; j < end; j++) {
        const sample = this.waveformData[j];
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }
      
      this.peaks.push(max);
      this.troughs.push(min);
    }
  }
  
  private drawWaveform(): void {
    const { width, height } = this.canvas;
    
    // Clear canvas with gradient
    const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#0a0a0a');
    gradient.addColorStop(1, '#1a1a1a');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);
    
    if (!this.peaks.length) return;
    
    const centerY = height / 2;
    const amplitude = height * 0.4;
    
    // Draw mirrored waveform
    this.ctx.beginPath();
    for (let i = 0; i < this.peaks.length; i++) {
      const x = i;
      const peakY = centerY - (this.peaks[i] * amplitude);
      
      if (i === 0) this.ctx.moveTo(x, centerY);
      this.ctx.lineTo(x, peakY);
    }
    
    for (let i = this.peaks.length - 1; i >= 0; i--) {
      const x = i;
      const troughY = centerY + Math.abs(this.troughs[i] * amplitude);
      this.ctx.lineTo(x, troughY);
    }
    
    this.ctx.closePath();
    this.ctx.fillStyle = 'rgba(100, 150, 255, 0.3)';
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1;
    this.ctx.globalAlpha = 0.8;
    this.ctx.stroke();
    
    this.drawMarkers();
  }
  
  public getAudioBuffer(): AudioBuffer | null {
    return this.audioBuffer;
  }
  
  private drawMarkers(): void {
    const { width, height } = this.canvas;
    
    if (this.markers.begin !== null && this.markers.end !== null) {
      const startX = this.markers.begin * width;
      const endX = this.markers.end * width;
      
      this.ctx.fillStyle = 'rgba(76, 175, 80, 0.2)';
      this.ctx.fillRect(startX, 0, endX - startX, height);
    }
    
    if (this.markers.begin !== null) {
      const x = this.markers.begin * width;
      this.ctx.strokeStyle = '#4CAF50';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }
    
    if (this.markers.end !== null) {
      const x = this.markers.end * width;
      this.ctx.strokeStyle = '#F44336';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }
  }
  
  // Add mouse/touch event handlers
  private attachEventListeners(): void {
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
  }
  
  private handleMouseDown(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const position = x / this.canvas.width;
    
    if (e.shiftKey || !this.markers.begin) {
      this.setMarker('begin', position);
    } else {
      this.setMarker('end', position);
    }
  }
  
  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const position = x / this.canvas.width;
    
    if (!this.markers.begin) {
      this.setMarker('begin', position);
    } else {
      this.setMarker('end', position);
    }
  }
  
  public setMarker(type: 'begin' | 'end', position: number | null): void {
    this.markers[type] = position;
    this.drawWaveform();
  }
  
  public getSliceRange(): { start: number; end: number } | null {
    if (this.markers.begin !== null && this.markers.end !== null && this.audioBuffer) {
      return {
        start: this.markers.begin * this.audioBuffer.duration,
        end: this.markers.end * this.audioBuffer.duration
      };
    }
    return null;
  }
}