// --- START OF NEW FILE src/demo/DemoPlayer.ts ---
import { ApplicationController } from '../ApplicationController';
import { DemoScript, DemoAction } from './DemoScript';
import { CompositionStateDTO } from '../types/schemas';

const DEMO_AUDIO_PATH = '/assets/audio/AmazingGrace.mp3';

export class DemoPlayer {
  private controller: ApplicationController;
	private sceneManager: any; // Using 'any' to avoid circular dependency issues
  private isRunning: boolean = false;
  private currentStep: number = 0;
  private highlightElement: HTMLElement | null = null;
  private ctaButton: HTMLElement | null = null;
  
  constructor(controller: ApplicationController) {
    this.controller = controller;
		this.sceneManager = sceneManager;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.currentStep = 0;
    this.executeNextStep();
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
  }

  private async executeNextStep(): Promise<void> {
    if (!this.isRunning || this.currentStep >= DemoScript.length) {
      this.stop();
      return;
    }

    const action = DemoScript[this.currentStep];
    this.currentStep++;

    console.log(`[DemoPlayer] Executing: ${action.type}`, action);

    switch (action.type) {
			case 'reset':
        await this.controller.resetToDefaultState();
        this.executeNextStep();
        break;
				
      case 'narrate': {
        const audio = new Audio(`/assets/narration/${action.file}`);
        audio.play();
        audio.onended = () => {
          this.executeNextStep();
        };
        break;
      }

      case 'highlight': {
        const element = document.querySelector(`[data-demo-id="${action.target}"]`) as HTMLElement;
        if (element) {
          this.highlightElement = element;
          element.classList.add('demo-highlight');
        }
        this.executeNextStep();
        break;
      }

      case 'remove_highlight': {
        const element = document.querySelector(`[data-demo-id="${action.target}"]`) as HTMLElement;
        element?.classList.remove('demo-highlight');
        if (this.highlightElement === element) {
          this.highlightElement = null;
        }
        this.executeNextStep();
        break;
      }
      
      case 'click': {
        const element = document.querySelector(`[data-demo-id="${action.target}"]`) as HTMLElement;
        element?.click();
        this.executeNextStep();
        break;
      }

      case 'wait':
        setTimeout(() => this.executeNextStep(), action.duration);
        break;

      case 'simulate_upload': {
        const response = await fetch(DEMO_AUDIO_PATH);
        const blob = await response.blob();
        const file = new File([blob], 'AmazingGrace.mp3', { type: 'audio/mpeg' });
        const snapshot: CompositionStateDTO = this.controller.getState().composition;
        // The file upload process itself will trigger the next step once rendering is complete
        await this.controller.dispatch({ type: 'FILE_UPLOADED', payload: { file, uiSnapshot: snapshot }});
        
        // Add a listener for the end of the render to continue the script
        const renderEndListener = () => {
          this.executeNextStep();
          document.removeEventListener('demo:renderComplete', renderEndListener);
        };
        document.addEventListener('demo:renderComplete', renderEndListener);
        break;
      }

      case 'camera_animate':
        if (action.animation === 'slow_rotate' && this.sceneManager) {
          // Pass a callback to continue the script ONLY after the animation finishes.
          this.sceneManager.startCinematicRotation(() => {
            this.executeNextStep();
          });
        } else {
          // If animation can't run, continue immediately.
          this.executeNextStep();
        }
        break;

      case 'show_cta': {
        const button = document.createElement('button');
        button.innerText = 'Start Designing Now';
        button.className = 'demo-cta-button';
        button.onclick = () => {
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
}
// --- END OF NEW FILE ---