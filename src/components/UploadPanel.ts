/**
 * UploadPanel.ts
 * Upload interface component with file picker and drag-drop functionality
 * 
 * Architecture: Stateless component
 * - Emits FILE_UPLOADED action via controller dispatch
 * - No internal state beyond DOM references
 * - Uses data-demo-id for tour compatibility
 * 
 * Design: Matches .slider-card + .slider-group pattern from WOOD > Layout
 * - Styles defined in test.css (.upload-card, .upload-card-*)
 */

import type { ApplicationController } from '../ApplicationController';
import type { PanelComponent } from '../types/PanelTypes';

export class UploadPanel implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _controller: ApplicationController;
  private _fileInput: HTMLInputElement | null = null;
  private _dropZone: HTMLElement | null = null;
  
  constructor(
    controller: ApplicationController,
    _audioCache?: unknown
  ) {
    this._controller = controller;
  }
  
  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'panel-content upload-panel';
    
    // Hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
    fileInput.style.display = 'none';
    this._fileInput = fileInput;
    container.appendChild(fileInput);
    
    // Drop zone - uses .upload-card class (matches .slider-card)
    const dropZone = document.createElement('div');
    dropZone.className = 'upload-card';
    dropZone.dataset.demoId = 'upload_dropzone';
    this._dropZone = dropZone;
    
    // Inner content wrapper - matches .slider-group padding
    const content = document.createElement('div');
    content.className = 'upload-card-content';
    
    // Upload icon - Option A style (arrow with tray)
		const iconContainer = document.createElement('div');
		iconContainer.className = 'upload-card-icon';
		iconContainer.innerHTML = `
			<svg width="60" height="60" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M24 32V16M24 16L18 22M24 16L30 22" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M8 32V36C8 38.2091 9.79086 40 12 40H36C38.2091 40 40 38.2091 40 36V32" stroke-linecap="round"/>
			</svg>
		`;
		content.appendChild(iconContainer);
    
    // Title
    const title = document.createElement('div');
    title.className = 'upload-card-title';
    title.textContent = 'Upload Audio File';
    content.appendChild(title);
    
    // Hint text
    const hint = document.createElement('div');
    hint.className = 'upload-card-hint';
    hint.textContent = 'Drag and drop or click to select';
    content.appendChild(hint);
    
    // Browse button
    const browseButton = document.createElement('button');
    browseButton.className = 'upload-card-button';
    browseButton.dataset.demoId = 'upload_button';
    browseButton.textContent = 'Browse Files';
    
    // Button click triggers file input
    browseButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this._fileInput?.click();
    });
    content.appendChild(browseButton);
    
    // Formats text
    const formats = document.createElement('div');
    formats.className = 'upload-card-formats';
    formats.textContent = 'MP3, WAV, FLAC, M4A up to 100MB';
    content.appendChild(formats);
    
    dropZone.appendChild(content);
    
    // Drop zone click triggers file input
    dropZone.addEventListener('click', () => {
      this._fileInput?.click();
    });
    
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
      dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = dropZone.getBoundingClientRect();
      if (
        e.clientX <= rect.left ||
        e.clientX >= rect.right ||
        e.clientY <= rect.top ||
        e.clientY >= rect.bottom
      ) {
        dropZone.classList.remove('drag-over');
      }
    });
    
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
      
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        this._handleFileSelected(e.dataTransfer.files[0]);
      }
    });
    
    container.appendChild(dropZone);
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