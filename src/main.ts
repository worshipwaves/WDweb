// src/main.ts

import '@babylonjs/loaders/glTF/2.0';
import * as BABYLON from '@babylonjs/core';
import { ApplicationController } from './ApplicationController';
import { SceneManager } from './SceneManager';
import { UIEngine } from './UIEngine';
import { WaveformDesignerFacade } from './WaveformDesignerFacade';
import { UIBootstrapper } from './UIBootstrapper';
import { calculateGrainAngle } from './utils/materialUtils';
import { TourModal } from './components/TourModal';
import { DemoPlayer } from './demo/DemoPlayer';
import { SmartCsgResponse } from './types/schemas';

// Expose Babylon core for console diagnostics
(window as Window & { BJS_CORE?: typeof BABYLON }).BJS_CORE = BABYLON;

// Define a constant for the API base URL for easier configuration
const API_BASE_URL = 'http://localhost:8000';

// Global type declarations
declare global {
  interface Window {
    sceneManager?: SceneManager;
    controller?: ApplicationController;
    audioCache?: any;
    calculateGrainAngle?: typeof calculateGrainAngle;
    updateGrainDirectionOptionsFromController?: (newN: number) => void;
    uiEngine?: UIEngine;
    demoPlayer?: DemoPlayer;
  }
}

// Make calculateGrainAngle globally available for debugging
window.calculateGrainAngle = calculateGrainAngle;

// Application Entry Point
document.addEventListener('DOMContentLoaded', () => {
  void (async () => {
    try {
      // 1. Instantiate Core Components
      const uiEngine = new UIEngine();
      await uiEngine.loadConfig();
      
      const facade = new WaveformDesignerFacade();
      const controller = new ApplicationController(facade);
      const sceneManager = SceneManager.create('renderCanvas', facade, controller); 

      // 2. Make components globally accessible
      window.uiEngine = uiEngine;
      window.controller = controller;
      window.sceneManager = sceneManager;
      window.audioCache = controller.audioCache;
      window.demoPlayer = new DemoPlayer(controller, sceneManager); 

      // 3. Initialize Controller and Register SceneManager
      await controller.initialize();
      controller.registerSceneManager(sceneManager);

      // 4. Bootstrap the UI
      const bootstrapper = new UIBootstrapper(uiEngine, controller, sceneManager);
      await bootstrapper.initialize();

      // 5. Initial render from restored state (if applicable and not starting tour)
      const initialState = controller.getState();
      if (!TourModal.shouldShow() && initialState?.composition?.processed_amplitudes?.length > 0) {
        try {
          const response = await fetch(`${API_BASE_URL}/geometry/csg-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              state: initialState.composition,
              changed_params: [],
              previous_max_amplitude: null
            })
          });
          
          if (response.ok) {
            const csgData = await response.json() as SmartCsgResponse;
            await sceneManager.renderComposition(csgData);
          } else {
            console.error('[main.ts] Failed to fetch CSG data for initial render:', response.status, await response.text());
          }
        } catch (error) {
            console.error('[main.ts] Network error during initial fetch. Is the backend running?', error);
        }
      }

    } catch (error: unknown) {
      console.error('[MAIN] === INITIALIZATION FAILED ===');
      console.error('Initialization error:', error);
    }
  })();
});