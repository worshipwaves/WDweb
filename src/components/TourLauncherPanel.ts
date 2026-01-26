/**
 * TourLauncherPanel.ts
 * Tour launcher panel component - renders button to start interactive tour
 * 
 * Architecture: Stateless component
 * - Launches DemoPlayer on button click
 * - Uses data-demo-id for tour compatibility
 * 
 * Design: Matches .upload-card / .slider-card pattern
 * - Styles defined in test.css (.tour-card, .tour-card-*)
 */

import type { ApplicationController } from '../ApplicationController';
import type { PanelComponent } from '../types/PanelTypes';

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
    
    // Tour card - uses .tour-card class (matches .slider-card / .upload-card)
    const card = document.createElement('div');
    card.className = 'tour-card';
    
    // Inner content wrapper
    const content = document.createElement('div');
    content.className = 'tour-card-content';
    
    // Title
    const title = document.createElement('div');
    title.className = 'tour-card-title';
    title.textContent = 'Amazing Grace - Song to Art';
    content.appendChild(title);
    
    // Description
    const description = document.createElement('div');
    description.className = 'tour-card-description';
    description.textContent = 'Experience WaveDesigner through a guided 60-second tour. See how audio becomes art.';
    content.appendChild(description);
    
    // Launch button
    const button = document.createElement('button');
    button.className = 'tour-card-button';
    button.textContent = 'Enjoy the Tour';
    button.addEventListener('click', () => this._launchTour());
    content.appendChild(button);
    
    card.appendChild(content);
    container.appendChild(card);
    
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