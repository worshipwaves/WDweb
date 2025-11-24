/**
 * UploadPanel.ts
 * Upload interface component with file picker and drag-drop functionality
 * 
 * Architecture: Stateless component
 * - Emits FILE_UPLOADED action via controller dispatch
 * - No internal state beyond DOM references
 * - Uses data-demo-id for tour compatibility
 */

import type { PanelComponent } from '../types/PanelTypes';
import type { ApplicationController } from '../ApplicationController';
import type { AudioCacheService } from '../services/AudioCacheService';

export class UploadPanel implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _controller: ApplicationController;
  private _audioCache: AudioCacheService;
  private _fileInput: HTMLInputElement | null = null;
  private _dropZone: HTMLElement | null = null;
  
  constructor(
    controller: ApplicationController,
    audioCache: AudioCacheService
  ) {
    this._controller = controller;
    this._audioCache = audioCache;
  }
  
  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'panel-content upload-panel';
    
    // Body with upload controls
    const body = document.createElement('div');
    body.className = 'panel-body';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.gap = '16px';
    body.style.padding = '20px';
    
    // Create file input (hidden)
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
    fileInput.style.display = 'none';
    this._fileInput = fileInput;
    body.appendChild(fileInput);
    
    // Create upload button
    const uploadButton = document.createElement('button');
    uploadButton.className = 'upload-button';
    uploadButton.dataset.demoId = 'upload_button';
    uploadButton.style.padding = '16px 24px';
    uploadButton.style.fontSize = '16px';
    uploadButton.style.fontWeight = '500';
    uploadButton.style.background = 'linear-gradient(135deg, #D9A464 0%, #C89550 100%)';
		uploadButton.style.border = 'none';
		uploadButton.style.boxShadow = '0 4px 12px rgba(217, 164, 100, 0.3)';
		uploadButton.style.color = '#1a1a1a';
    uploadButton.style.borderRadius = '8px';
    uploadButton.style.color = 'rgba(255, 255, 255, 0.9)';
    uploadButton.style.cursor = 'pointer';
    uploadButton.style.transition = 'all 0.2s ease';
    uploadButton.innerHTML = '📁 Choose Audio File';
    
    // Upload button hover effects
    uploadButton.addEventListener('mouseenter', () => {
			uploadButton.style.boxShadow = '0 6px 16px rgba(217, 164, 100, 0.4)';
			uploadButton.style.transform = 'translateY(-2px)';
		});
    
		uploadButton.addEventListener('mouseleave', () => {
			uploadButton.style.boxShadow = '0 4px 12px rgba(217, 164, 100, 0.3)';
			uploadButton.style.transform = 'translateY(0)';
		});
    
    uploadButton.addEventListener('click', () => {
      this._fileInput?.click();
    });
    
    body.appendChild(uploadButton);
    
    // Create drop zone
    const dropZone = document.createElement('div');
    dropZone.style.padding = '40px 20px';
    dropZone.style.border = '2px dashed rgba(255, 255, 255, 0.3)';
    dropZone.style.borderRadius = '8px';
    dropZone.style.textAlign = 'center';
    dropZone.style.color = 'rgba(255, 255, 255, 0.6)';
    dropZone.style.cursor = 'pointer';
    dropZone.innerHTML = '<div style="font-size: 48px; margin-bottom: 16px;"></div><div>Or drag and drop your audio file here</div><div style="margin-top: 8px; font-size: 12px; opacity: 0.7;">Supported formats: MP3, WAV, FLAC, M4A</div>';
    this._dropZone = dropZone;
    
    // Drop zone click triggers file input
    dropZone.addEventListener('click', () => {
      this._fileInput?.click();
    });
    
    body.appendChild(dropZone);
    
    // File input change handler
    fileInput.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        this._handleFileSelected(target.files[0]);
      }
    });
    
    // Drag and drop handlers
		dropZone.addEventListener('dragover', (e) => {
			e.preventDefault();
			e.stopPropagation();
			dropZone.style.borderColor = 'rgba(217, 164, 100, 0.8)';
			dropZone.style.backgroundColor = 'rgba(217, 164, 100, 0.1)';
		});
    
    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.style.borderColor = 'rgba(255, 255, 255, 0.3)';
      dropZone.style.backgroundColor = 'transparent';
    });
    
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.style.borderColor = 'rgba(255, 255, 255, 0.3)';
      dropZone.style.backgroundColor = 'transparent';
      
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        this._handleFileSelected(e.dataTransfer.files[0]);
      }
    });
    
    container.appendChild(body);
    this._container = container;
    
    return container;
  }
  
  private _handleFileSelected(file: File): void {
    const currentState = this._controller.getState();
    const uiComposition = currentState.composition;
    
    void this._controller.dispatch({ 
      type: 'FILE_UPLOADED', 
      payload: { file, uiSnapshot: uiComposition }
    });
  }
  
  destroy(): void {
    this._fileInput = null;
    this._dropZone = null;
    
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}
