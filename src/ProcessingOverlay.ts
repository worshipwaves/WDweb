/**
 * ProcessingOverlay - Fullscreen overlay for processing status messages
 * 
 * Subscribes to ApplicationController processing state and displays
 * appropriate messages for each stage (uploading, preparing_textures, demucs, etc.)
 */

import type { ApplicationController } from './ApplicationController';
import type { ApplicationState } from './types/schemas';

interface StageConfig {
  message: string;
  showProgress: boolean;
}

export class ProcessingOverlay {
  private overlay: HTMLElement | null = null;
  private messageElement: HTMLElement | null = null;
  private progressBar: HTMLElement | null = null;
  private controller: ApplicationController;
  
  // Map processing stages to user-friendly messages
  private readonly stageMessages: Record<string, StageConfig> = {
    idle: { message: '', showProgress: false },
    uploading: { message: 'Uploading your audio...', showProgress: true },
    preparing_textures: { message: 'Preparing your custom art experience!', showProgress: false },
    demucs: { message: 'Isolating vocals...', showProgress: true },
    rendering: { message: 'Rendering your design...', showProgress: false },
  };
  
  constructor(overlayId: string, controller: ApplicationController) {
    this.overlay = document.getElementById(overlayId);
    this.controller = controller;
    
    if (!this.overlay) {
      console.error(`[ProcessingOverlay] Element with id "${overlayId}" not found`);
      return;
    }
    
    // Get child elements
    this.messageElement = this.overlay.querySelector('.processing-message');
    this.progressBar = this.overlay.querySelector('.processing-progress-bar');
    
    // Subscribe to state changes
    this.controller.subscribe((state) => {
      this.update(state);
    });
    
    // Initial state
    const currentState = this.controller.getState();
    this.update(currentState);
  }
  
  /**
   * Update overlay based on current processing stage
   */
  private update(state: ApplicationState): void {
    if (!this.overlay || !this.messageElement) return;
    
    const { stage, progress } = state.processing;
    const config = this.stageMessages[stage];
    
    if (!config) {
      console.warn(`[ProcessingOverlay] Unknown processing stage: ${stage}`);
      this.hide();
      return;
    }
    
    // Show or hide overlay based on stage
    if (stage === 'idle') {
      this.hide();
    } else {
      this.show(config.message, config.showProgress ? progress : undefined);
    }
  }
  
  /**
   * Show overlay with message and optional progress
   */
  private show(message: string, progress?: number): void {
    if (!this.overlay || !this.messageElement) return;
    
    this.messageElement.textContent = message;
    
    // Update progress bar
    if (this.progressBar) {
      if (progress !== undefined && progress >= 0) {
        this.progressBar.style.display = 'block';
        const fill = this.progressBar.querySelector('.processing-progress-fill') as HTMLElement;
        if (fill) {
          fill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
        }
      } else {
        // Indeterminate progress (show animated bar)
        this.progressBar.style.display = 'block';
        const fill = this.progressBar.querySelector('.processing-progress-fill') as HTMLElement;
        if (fill) {
          fill.style.width = '30%';
          fill.classList.add('indeterminate');
        }
      }
    }
    
    this.overlay.classList.add('active');
  }
  
  /**
   * Hide overlay
   */
  private hide(): void {
    if (!this.overlay) return;
    
    this.overlay.classList.remove('active');
    
    // Reset progress bar
    if (this.progressBar) {
      const fill = this.progressBar.querySelector('.processing-progress-fill') as HTMLElement;
      if (fill) {
        fill.style.width = '0%';
        fill.classList.remove('indeterminate');
      }
    }
  }
}