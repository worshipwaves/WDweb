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
    if (this.highlightElement) {
      this.highlightElement.classList.remove('demo-highlight');
      this.highlightElement = null;
    }
    if (this.ctaButton) {
      this.ctaButton.remove();
      this.ctaButton = null;
    }
    if (this.skipOverlay) {
      this.skipOverlay.remove();
      this.skipOverlay = null;
    }
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
        
        // Handle audio load errors
        audio.onerror = (): void => {
          console.warn(`[DemoPlayer] Narration file not found: ${action.file}, continuing silently`);
          void this.executeNextStep();
        };
        
        void audio.play().catch((error: unknown) => {
          console.warn('[DemoPlayer] Narration playback failed:', error);
          void this.executeNextStep();
        });
        
        audio.onended = () => {
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
        setTimeout(() => void this.executeNextStep(), action.duration);
        break;

      case 'simulate_upload': {        
        // Just wait for visual effect, then continue
        setTimeout(() => {
          void this.executeNextStep();
        }, 2000);
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
      window.location.reload();
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