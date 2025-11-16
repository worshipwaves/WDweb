// --- START OF NEW FILE src/demo/DemoPlayer.ts ---
import { ApplicationController } from '../ApplicationController';

import { DemoScript } from './DemoScript';

export class DemoPlayer {
  private controller: ApplicationController;
	private sceneManager: { 
    startCinematicRotation: (callback: () => void) => void;
    clearScene: () => void;
  } | null = null;
  private isRunning: boolean = false;
  private currentStep: number = 0;
  private highlightElement: HTMLElement | null = null;
  private ctaButton: HTMLElement | null = null;
  private skipOverlay: HTMLElement | null = null;
  private readonly totalScenes: number = 6; // Update if demo changes
  private activeAudio: HTMLAudioElement | null = null;
  private activeTimeout: number | null = null;
  
  constructor(controller: ApplicationController, sceneManager?: { startCinematicRotation: (callback: () => void) => void }) {
    this.controller = controller;
		this.sceneManager = sceneManager || null;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.currentStep = 0;
    this.showSkipOverlay();
    void this.executeNextStep();
  }

  public stop(): void {
    this.isRunning = false;
    
    // Stop active audio
    if (this.activeAudio) {
      this.activeAudio.pause();
      this.activeAudio = null;
    }
    
    // Clear active timeout
    if (this.activeTimeout !== null) {
      clearTimeout(this.activeTimeout);
      this.activeTimeout = null;
    }
    
    // Remove highlights
    if (this.highlightElement) {
      this.highlightElement.classList.remove('demo-highlight');
      this.highlightElement = null;
    }
    
    // Remove UI elements
    if (this.ctaButton) {
      this.ctaButton.remove();
      this.ctaButton = null;
    }
    if (this.skipOverlay) {
      this.skipOverlay.remove();
      this.skipOverlay = null;
    }
    
    // CRITICAL FIX: Tour's reset action clears activeCategory
    // Restore AUDIO category so user can navigate subcategories
    void this.controller.dispatch({
      type: 'CATEGORY_SELECTED',
      payload: 'audio'
    });
  }

  private async executeNextStep(): Promise<void> {
    if (!this.isRunning || this.currentStep >= DemoScript.length) {
      this.stop();
      return;
    }

    const action = DemoScript[this.currentStep];
    this.currentStep++;

    switch (action.type) {
			case 'reset':
        await this.controller.resetToDefaultState();
        void this.executeNextStep();
        break;
				
      case 'narrate': {
        const audio = new Audio(`/assets/narration/${action.file}`);
        this.activeAudio = audio;
        
        // Handle audio load errors
        audio.onerror = (): void => {
          console.warn(`[DemoPlayer] Narration file not found: ${action.file}, continuing silently`);
          this.activeAudio = null;
          void this.executeNextStep();
        };
        
        void audio.play().catch((error: unknown) => {
          console.warn('[DemoPlayer] Narration playback failed:', error);
          this.activeAudio = null;
          void this.executeNextStep();
        });
        
        audio.onended = () => {
          this.activeAudio = null;
          void this.executeNextStep();
        };
        break;
      }

      case 'highlight': {
        const element = document.querySelector(`[data-demo-id="${action.target}"]`) as HTMLElement;
        if (element) {
          this.highlightElement = element;
          element.classList.add('demo-highlight');
        }
        void this.executeNextStep();
        break;
      }

      case 'remove_highlight': {
        const element = document.querySelector(`[data-demo-id="${action.target}"]`) as HTMLElement;
        element?.classList.remove('demo-highlight');
        if (this.highlightElement === element) {
          this.highlightElement = null;
        }
        void this.executeNextStep();
        break;
      }
      
      case 'click': {
        const element = document.querySelector(`[data-demo-id="${action.target}"]`) as HTMLElement;
        element?.click();
        void this.executeNextStep();
        break;
      }

      case 'wait':
        this.activeTimeout = window.setTimeout(() => {
          this.activeTimeout = null;
          void this.executeNextStep();
        }, action.duration);
        break;

			case 'simulate_upload': {
				console.log('[DemoPlayer] Starting simulate_upload');
				
				try {
					console.log('[DemoPlayer] Fetching demo audio file...');
					// WRONG: const response = await fetch('/assets/demo/demo_audio.mp3');
					// RIGHT: Files in /public are served from root without /public prefix
					const response = await fetch('/assets/demo/demo_audio.mp3');
					
					if (!response.ok) {
						console.error('[DemoPlayer] Demo file fetch failed:', response.status, response.statusText);
						void this.executeNextStep();
						break;
					}
					
					const blob = await response.blob();
					console.log('[DemoPlayer] Blob created:', {
						size: blob.size,
						type: blob.type
					});
					
					if (blob.size === 0 || blob.type.includes('html')) {
						console.error('[DemoPlayer] Invalid file type:', blob.type);
						void this.executeNextStep();
						break;
					}
					
					const file = new File([blob], 'demo_audio.mp3', { 
						type: blob.type || 'audio/mpeg'
					});
					
					console.log('[DemoPlayer] File object created:', {
						name: file.name,
						size: file.size,
						type: file.type
					});
					
					const currentState = this.controller.getState();
					const uiComposition = currentState.composition;
					
					console.log('[DemoPlayer] Dispatching FILE_UPLOADED...');
					await this.controller.dispatch({
						type: 'FILE_UPLOADED',
						payload: { file, uiSnapshot: uiComposition }
					});
					
					console.log('[DemoPlayer] FILE_UPLOADED dispatched, waiting for processing...');
					
					let attempts = 0;
					const maxAttempts = 100;
					
					const checkProcessing = (): void => {
						const state = this.controller.getState();
						attempts++;
						
						console.log(`[DemoPlayer] Check ${attempts}: stage=${state.processing.stage}`);
						
						if (state.processing.stage === 'idle') {
							console.log('[DemoPlayer] Processing complete! Continuing demo...');
							void this.executeNextStep();
						} else if (attempts >= maxAttempts) {
							console.error('[DemoPlayer] Processing timeout');
							void this.executeNextStep();
						} else {
							setTimeout(checkProcessing, 100);
						}
					};
					
					checkProcessing();
					
				} catch (error: unknown) {
					console.error('[DemoPlayer] Demo upload failed:', error);
					void this.executeNextStep();
				}
				break;
			}
			
			case 'update_progress':
        this.updateProgress(action.scene);
        void this.executeNextStep();
        break;

      case 'camera_animate':
        if (action.animation === 'slow_rotate' && this.sceneManager) {
          // Pass a callback to continue the script ONLY after the animation finishes.
          this.sceneManager.startCinematicRotation(() => {
            void this.executeNextStep();
          });
        } else {
          // If animation can't run, continue immediately.
          void this.executeNextStep();
        }
        break;

      case 'show_cta': {
        const button = document.createElement('button');
        button.innerText = 'Start Designing Now';
        button.className = 'demo-cta-button';
        button.onclick = (): void => {
          this.stop();
          window.location.reload(); // Simple way to reset
        };
        document.body.appendChild(button);
        this.ctaButton = button;
        // Don't call executeNextStep, this is the end.
        break;
      }
    }
  }
  
  /**
   * Show skip overlay with progress indicator
   * @private
   */
  private showSkipOverlay(): void {
    if (this.skipOverlay) return; // Already showing
    
    this.skipOverlay = document.createElement('div');
    this.skipOverlay.className = 'demo-skip-overlay';
    this.skipOverlay.innerHTML = `
      <button class="demo-skip-button" title="Exit tour">Skip Tour ×</button>
      <div class="demo-progress">Scene <span id="demoCurrentScene">1</span> of ${this.totalScenes}</div>
    `;
    
    document.body.appendChild(this.skipOverlay);
    
    const skipButton = this.skipOverlay.querySelector('.demo-skip-button');
    skipButton?.addEventListener('click', () => {
      this.stop();
      
      // Force UI refresh by re-selecting current subcategory
      const currentState = this.controller.getState();
      if (currentState.ui.activeCategory && currentState.ui.activeSubcategory) {
        void this.controller.dispatch({
          type: 'SUBCATEGORY_SELECTED',
          payload: {
            category: currentState.ui.activeCategory,
            subcategory: currentState.ui.activeSubcategory
          }
        });
      }
    });
  }
  
  /**
   * Update progress indicator
   * @private
   */
  private updateProgress(sceneNumber: number): void {
    const currentSceneEl = document.getElementById('demoCurrentScene');
    if (currentSceneEl) {
      currentSceneEl.textContent = String(sceneNumber);
    }
  }
}
// --- END OF NEW FILE ---