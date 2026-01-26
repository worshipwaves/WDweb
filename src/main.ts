// src/main.ts

import '@babylonjs/loaders/glTF/2.0';
import * as BABYLON from '@babylonjs/core';

import { PlacementDebugPanel, DEBUG_PLACEMENT_PANEL } from '../dev_utils/PlacementDebugPanel';
import { ShadowDebugPanel, DEBUG_SHADOW_PANEL } from '../dev_utils/ShadowDebugPanel';

import { ApplicationController } from './ApplicationController';
import type { AudioCacheService } from './AudioCacheService';
import { TourModal } from './components/TourModal';
import { DemoPlayer } from './demo/DemoPlayer';
import { SceneManager } from './SceneManager';
import { UIBootstrapper } from './UIBootstrapper';
import { UIEngine } from './UIEngine';
import { calculateGrainAngle } from './utils/materialUtils';
import { WaveformDesignerFacade } from './WaveformDesignerFacade';

// Expose Babylon core for console diagnostics
(window as Window & { BJS_CORE?: typeof BABYLON }).BJS_CORE = BABYLON;

// Global type declarations
declare global {
  interface Window {
    sceneManager?: SceneManager;
    controller?: ApplicationController;
    audioCache?: AudioCacheService;
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
			(window as unknown as { __wavedesigner_controller__: ApplicationController }).__wavedesigner_controller__ = controller;
			
			// Shadow Debug Panel - toggle with Ctrl+Shift+D
			if (DEBUG_SHADOW_PANEL) {
				ShadowDebugPanel.init(sceneManager);
			}
			
			// Placement Debug Panel - toggle with Ctrl+Shift+P
			if (DEBUG_PLACEMENT_PANEL) {
				PlacementDebugPanel.init(sceneManager);
			}

      // 4. Bootstrap the UI
      const bootstrapper = new UIBootstrapper(uiEngine, controller, sceneManager);
      await bootstrapper.initialize();
			
			// 5. Wire up Order button
      const orderBtn = document.getElementById('orderBtn');
      orderBtn?.addEventListener('click', () => {
        void controller.triggerExport();
      });

      // 5a. Initial render from restored state (if applicable and not starting tour)
      const initialState = controller.getState();
      if (!TourModal.shouldShow() && initialState?.composition?.processed_amplitudes?.length > 0) {
        try {
          const csgData = await controller.getRoutedCSGData(
            initialState.composition,
            [],
            null
          );
          await sceneManager.renderComposition(csgData);
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