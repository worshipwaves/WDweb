/**
 * UploadInterface.ts
 * Handles file upload with drag-and-drop, visual-first approach
 */

export interface UploadEvents {
  onFileSelected: (file: File) => void;
  onError?: (error: string) => void;
}

export class UploadInterface {
  private container: HTMLElement;
  private dropZone: HTMLDivElement | null = null;
  private fileInput: HTMLInputElement | null = null;
  private isVisible: boolean = true;
  private callbacks: UploadEvents;
  
  private readonly acceptedTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp3', 'audio/x-wav', 'audio/x-m4a'];
  private readonly maxFileSize = 100 * 1024 * 1024; // 100MB
  
  constructor(containerId: string, callbacks: UploadEvents) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }
    
    this.container = container;
    this.callbacks = callbacks;
    
    this.createUploadInterface();
    this.attachEventListeners();
  }
  
  private createUploadInterface(): void {
    this.container.innerHTML = `
      <div id="uploadDropZone" class="upload-zone">
        <div class="upload-visual">
          <svg class="upload-icon" viewBox="0 0 100 100" width="80" height="80">
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/>
            <path d="M50 25 L50 60 M35 45 L50 25 L65 45" 
                  stroke="currentColor" stroke-width="3" 
                  stroke-linecap="round" stroke-linejoin="round"
                  fill="none"/>
            <circle cx="50" cy="50" r="45" fill="none" 
                    stroke="currentColor" stroke-width="2" 
                    stroke-dasharray="5,5" 
                    class="rotating-border"/>
          </svg>
          <div class="pulse-ring"></div>
        </div>
        <input type="file" id="fileInput" accept="audio/*" style="display: none;">
      </div>
    `;
    
    this.dropZone = document.getElementById('uploadDropZone') as HTMLDivElement;
    this.fileInput = document.getElementById('fileInput') as HTMLInputElement;
  }
  
  private attachEventListeners(): void {
    if (!this.dropZone || !this.fileInput) return;
    
    this.dropZone.addEventListener('click', () => {
      this.fileInput?.click();
    });
    
    this.fileInput.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        this.handleFile(target.files[0]);
      }
    });
    
    this.dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
    this.dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
    this.dropZone.addEventListener('drop', this.handleDrop.bind(this));
    
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
    
    // Add hint text after delay (3 seconds)
    setTimeout(() => {
      if (this.isVisible && this.dropZone) {
        const hint = document.createElement('div');
        hint.className = 'upload-hint';
        hint.textContent = 'Drop your audio file here';
        this.dropZone.appendChild(hint);
      }
    }, 3000);
  }
  
  private handleDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    
    const dataTransfer = e.dataTransfer;
    if (dataTransfer) {
      dataTransfer.dropEffect = 'copy';
    }
    
    this.dropZone?.classList.add('drag-over');
  }
  
  private handleDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = this.dropZone?.getBoundingClientRect();
    if (rect && (e.clientX <= rect.left || e.clientX >= rect.right || 
        e.clientY <= rect.top || e.clientY >= rect.bottom)) {
      this.dropZone?.classList.remove('drag-over');
    }
  }
  
  private handleDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    
    this.dropZone?.classList.remove('drag-over');
    
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      this.handleFile(e.dataTransfer.files[0]);
    }
  }
  
  private handleFile(file: File): void {
    if (!this.isValidAudioFile(file)) {
      if (this.callbacks.onError) {
        this.callbacks.onError('Please upload an audio file (MP3, WAV, or FLAC)');
      }
      return;
    }
    
    if (file.size > this.maxFileSize) {
      if (this.callbacks.onError) {
        this.callbacks.onError('File size must be less than 100MB');
      }
      return;
    }
    
    this.showProcessing();
    this.callbacks.onFileSelected(file);
  }
  
  private isValidAudioFile(file: File): boolean {
    if (this.acceptedTypes.includes(file.type)) {
      return true;
    }
    
    const extension = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'];
    return validExtensions.includes(extension || '');
  }
  
  private showProcessing(): void {
    if (this.dropZone) {
      this.dropZone.classList.add('processing');
    }
  }
  
  public hide(): void {
    this.isVisible = false;
    this.container.style.display = 'none';
  }
  
  public show(): void {
    this.isVisible = true;
    this.container.style.display = 'block';
  }
}