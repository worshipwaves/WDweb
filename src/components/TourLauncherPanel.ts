import type { PanelComponent } from '../types/PanelTypes';
import { TourModal } from './TourModal';
import type { ApplicationController } from '../ApplicationController';

/**
 * Tour launcher panel component
 * Renders a prominent button to start the interactive tour
 */
export class TourLauncherPanel implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _controller: ApplicationController;
  private _sceneManager: { 
    startCinematicRotation: (callback: () => void) => void;
    clearScene: () => void;
  } | null;
  
  constructor(
    controller: ApplicationController,
    sceneManager: { 
      startCinematicRotation: (callback: () => void) => void;
      clearScene: () => void;
    } | null
  ) {
    this._controller = controller;
    this._sceneManager = sceneManager;
  }
  
  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'panel-content tour-launcher-panel';
    
    const body = document.createElement('div');
    body.className = 'panel-body';
    
    const description = document.createElement('p');
    description.className = 'tour-description';
    description.textContent = 'Experience WaveDesigner with a guided 60-second tour using Amazing Grace. See how audio becomes art.';
    
    const button = document.createElement('button');
    button.className = 'tour-launch-button';
    button.textContent = '🎬 Begin Tour Experience';
    button.addEventListener('click', () => this._launchTour());
    
    body.appendChild(description);
    body.appendChild(button);
    container.appendChild(body);
    
    this._container = container;
    return container;
  }
  
  private _launchTour(): void {
    void import('../demo/DemoPlayer').then(({ DemoPlayer }) => {
      const demoPlayer = new DemoPlayer(this._controller, this._sceneManager);
      demoPlayer.start();
    }).catch((error: unknown) => {
      console.error('[TourLauncherPanel] Failed to load DemoPlayer:', error);
    });
  }
  
  destroy(): void {
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}