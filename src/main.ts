import {
  Engine, 
  Scene, 
  ArcRotateCamera, 
  HemisphericLight,
  DirectionalLight,
  Vector3, 
  Color3,
  Mesh,
  TransformNode,
  Animation,
  CubicEase,
  EasingFunction
} from '@babylonjs/core';
import { GLTFFileLoader } from '@babylonjs/loaders/glTF';
import '@babylonjs/loaders/glTF/2.0';
import * as BABYLON from '@babylonjs/core';
(window as Window & { BJS_CORE?: typeof BABYLON }).BJS_CORE = BABYLON; // Expose Babylon core for console diagnostics

import { ApplicationController } from './ApplicationController';
import { AudioCacheService } from './AudioCacheService';
import { FrameGenerationService } from './FrameGenerationService';
import { type CSGDataResponse, type WoodMaterialsConfig } from './types/schemas';
import { CompositionStateDTO } from './types/schemas';
import { UploadInterface } from './UploadInterface';
import { WaveformDesignerFacade } from './WaveformDesignerFacade';
import { WoodMaterial } from './WoodMaterial';


/**
 * Calculate grain angle based on direction and section configuration.
 * Uses angles from backend configuration (single source of truth).
 */
function calculateGrainAngle(
  direction: 'horizontal' | 'vertical' | 'angled',
  sectionId: number,
  numberSections: number,
  config: WoodMaterialsConfig
): number {
  if (direction === 'horizontal') return 0;
  if (direction === 'vertical') return 90;
  
  // Angled: use bifurcation angle from config
  const anglesKey = String(numberSections);
  const angles = config.geometry_constants.section_positioning_angles[anglesKey];
  
  if (!angles || !angles[sectionId]) {
    console.warn(`[main.ts] No angle found for section ${sectionId} in ${numberSections}-section config`);
    return 0;
  }
  
  return angles[sectionId];
}

// Extend the global Window interface
declare global {
  interface Window {
    sceneManager?: SceneManager;
    controller?: ApplicationController;
    audioCache?: AudioCacheService;
  }
}

class SceneManager {
  // Rendering dependencies (prefixed = OK)
  private _engine: Engine;
  private _scene: Scene;
  private _canvas: HTMLCanvasElement;
  private _camera!: ArcRotateCamera;
	private _facade: WaveformDesignerFacade;
  
  // Rendering resources (prefixed = OK)
  private _woodMaterial: WoodMaterial | null = null;
  private _panelMesh: Mesh | null = null;
  private _finalMesh: Mesh | null = null;
  private _sectionMeshes: Mesh[] = [];
  private _sectionMaterials: WoodMaterial[] = [];
	private _selectedSectionIndex: number | null = null;
  private _rootNode: TransformNode | null = null;
	private _renderQueue: Promise<void> = Promise.resolve();
  private _isRendering = false;

  private constructor(canvasId: string, facade: WaveformDesignerFacade) {
    // Get canvas element
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      throw new Error(`Canvas with id "${canvasId}" not found`);
    }
    this._canvas = canvas;
    this._facade = facade;
		
    // Initialize Babylon.js engine
    this._engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true
    });

    // Create scene
    this._scene = new Scene(this._engine);
    this._scene.clearColor = new Color3(0.1, 0.1, 0.1).toColor4();

    // Initialize camera
    this._camera = this.setupCamera();

    // Setup lighting
    this.setupLighting();

    // Register GLTF loader
    if (!GLTFFileLoader) {
      console.error('GLTF loader not available');
    }

    // Handle window resize
    window.addEventListener('resize', () => {
      this._engine.resize();
    });

    // Start render loop
    this._engine.runRenderLoop(() => {
      this._scene.render();
    });
    
    // Reset camera button
    const resetButton = document.getElementById('resetCameraButton');
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        this.resetCamera();
      });
    }
  }

  public static create(canvasId: string, facade: WaveformDesignerFacade): SceneManager {
    const manager = new SceneManager(canvasId, facade);
    
    // Note: Wood materials will be applied when sections are rendered
    // No need for default material setup here
    
    // Create a root node for final orientation
    manager._rootNode = new TransformNode("root", manager._scene);
    manager._rootNode.rotation.x = Math.PI / 2;
    
    // Set initial camera position
    manager._camera.setTarget(Vector3.Zero());
    manager._camera.radius = 47;
    
    return manager;
  }

  private setupCamera(): ArcRotateCamera {
    // Create an arc rotate camera with mobile-friendly settings
    const camera = new ArcRotateCamera(
      'mainCamera',
      Math.PI / 2,  // Alpha - horizontal rotation
      Math.PI / 2,  // Beta - vertical rotation
      50,           // Radius - distance from target
      Vector3.Zero(),
      this._scene
    );

    // Set camera limits for good mobile UX
    camera.lowerRadiusLimit = 20;
    camera.upperRadiusLimit = 100;
    camera.lowerBetaLimit = 0.1;
    camera.upperBetaLimit = Math.PI - 0.1;

    // Mobile-friendly controls
    camera.panningSensibility = 50;
    camera.wheelPrecision = 20;
    camera.pinchPrecision = 50;

    // Enable camera controls
    camera.attachControl(this._canvas, true);

    // Configure for touch devices
    camera.useNaturalPinchZoom = true;
    camera.inputs.attached.pointers.multiTouchPanning = true;
    camera.inputs.attached.pointers.multiTouchPanAndZoom = true;

    return camera;
  }

  private setupLighting(): void {
    // Main hemisphere light for ambient
    const ambientLight = new HemisphericLight(
      'ambientLight',
      new Vector3(0, 1, 0),
      this._scene
    );
    ambientLight.intensity = 1.0;
    ambientLight.diffuse = new Color3(1, 1, 0.95);
    ambientLight.specular = new Color3(1, 1, 1);
    ambientLight.groundColor = new Color3(0.3, 0.3, 0.3);
    
    // Add a directional light from the front
    const directionalLight = new DirectionalLight(
      'directionalLight',
      new Vector3(0, 0, -1),  // Direction: straight toward the panel
      this._scene
    );
    directionalLight.position = new Vector3(0, 0, 50);  // Position: in front of panel
    directionalLight.intensity = 2.0;
    
    // CRITICAL: Set the scene's environment intensity for PBR materials
    this._scene.environmentIntensity = 0.6;
    
    // Create a greige background (off-white with grey tint)
    this._scene.clearColor = new Color3(0.86, 0.84, 0.82).toColor4();
    
    // Create a neutral environment color for PBR reflections
    this._scene.ambientColor = new Color3(0.2, 0.2, 0.2);
    this._scene.environmentColor = new Color3(0.8, 0.8, 0.8);
  }

  public renderComposition(csgData: CSGDataResponse): Promise<void> {
    void (this._renderQueue = this._renderQueue.then(
      async () => {
        if (this._isRendering) {
          console.warn('Render already in progress, skipping.');
          return;
        }
        
        this._isRendering = true;
        try {
          await this._renderCompositionInternal(csgData);
        } finally {
          this._isRendering = false;
        }
      }
    ));
    
    return this._renderQueue;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async _renderCompositionInternal(csgData: CSGDataResponse): Promise<void> {
    console.log('[POC] SceneManager._renderCompositionInternal called');
    
    // Clean up old meshes
    if (this._finalMesh) {
      this._finalMesh.dispose();
      this._finalMesh = null;
    }
    if (this._panelMesh) {
      this._panelMesh.dispose();
      this._panelMesh = null;
    }
    
    // Clean up section meshes
    this._sectionMeshes.forEach(mesh => mesh.dispose());
    this._sectionMeshes = [];
    
    // Clean up section materials  
    this._sectionMaterials.forEach(mat => mat.dispose());
    this._sectionMaterials = [];

    try {
      // Get array of meshes from frame service
      const frameService = new FrameGenerationService(this._scene);
      const meshes = frameService.createFrameMeshes(csgData);
      
      console.log(`[POC] SceneManager received ${meshes.length} meshes`);

      if (meshes.length === 0) {
        console.warn('[POC] No meshes returned from frame service');
        return;
      }

      // Create root node if it doesn't exist
      if (!this._rootNode) {
        this._rootNode = new TransformNode("root", this._scene);
        this._rootNode.rotation.x = Math.PI / 2;
      }

      // Store section meshes
      this._sectionMeshes = meshes;
      
      // Apply materials to sections based on state
      this.applySectionMaterials();
      
      console.log('[POC] All section meshes configured');
      
      // Setup interaction
      this.setupSectionInteraction();

    } catch (error: unknown) {
      console.error('[POC] CSG mesh generation failed:', error);
    }
  }
	
	private setupSectionInteraction(): void {
    console.log('[SceneManager] Setting up section interaction');
    
    this._canvas.addEventListener('pointerdown', (_evt) => {
      const pickResult = this._scene.pick(
        this._scene.pointerX,
        this._scene.pointerY
      );
      
      if (pickResult.hit && pickResult.pickedMesh) {
        // Extract section_id from mesh name (format: "section_N")
        const meshName = pickResult.pickedMesh.name;
        const match = meshName.match(/^section_(\d+)$/);
        
        if (match) {
          const sectionId = parseInt(match[1], 10);
          console.log(`[SceneManager] Section ${sectionId} clicked (mesh: ${meshName})`);
          
          // Update selection state
          this.selectSection(sectionId);
          
          // Notify controller
          if (window.controller) {
            window.controller.selectSection(sectionId);
          }
          
          // Update UI to show selected section
          this.updateSectionUI(sectionId);
        }
      }
    });
  }
  
  private selectSection(index: number): void {
    // Clear previous selection
    if (this._selectedSectionIndex !== null && this._sectionMeshes[this._selectedSectionIndex]) {
      this.clearSectionHighlight(this._selectedSectionIndex);
    }
    
    // Set new selection
    this._selectedSectionIndex = index;
    
    // Highlight selected section
    if (this._sectionMeshes[index]) {
      this.highlightSection(index);
    }
  }
  
  private highlightSection(index: number): void {
    const mesh = this._sectionMeshes[index];
    if (!mesh) return;
    
    // Add subtle highlight effect (could use glow layer or outline in future)
    mesh.renderOutline = true;
    mesh.outlineWidth = 0.05;
    mesh.outlineColor = new Color3(1, 1, 0); // Yellow outline
  }
  
  private clearSectionHighlight(index: number): void {
    const mesh = this._sectionMeshes[index];
    if (!mesh) return;
    
    mesh.renderOutline = false;
  }
  
  private updateSectionUI(index: number): void {
    // Update section indicator in UI
    const sectionIndicator = document.getElementById('sectionIndicator');
    const sectionNumber = document.getElementById('selectedSectionNumber');
    
    if (sectionIndicator && sectionNumber) {
      sectionIndicator.style.display = 'block';
      sectionNumber.textContent = String(index + 1);
    }
    
    // Update controls to show current section's material
    if (window.controller) {
      const state = window.controller.getState();
      const materials = state.composition.frame_design.section_materials || [];
      const sectionMaterial = materials.find(m => m.section_id === index);
      
      const speciesEl = document.getElementById('woodSpecies') as HTMLSelectElement;
      const grainEl = document.getElementById('grainDirection') as HTMLSelectElement;
      
      if (sectionMaterial) {
        if (speciesEl) speciesEl.value = sectionMaterial.species;
        if (grainEl) grainEl.value = sectionMaterial.grain_direction;
      } else {
        // Use defaults from config
        try {
          const config = window.controller.getWoodMaterialsConfig();
          if (speciesEl) {
            speciesEl.value = config.default_species;
          }
          if (grainEl) {
            grainEl.value = config.default_grain_direction;
          }
        } catch {
          // Config not loaded, cannot set defaults.
        }
      }
    }
  }
	
	private applySectionMaterials(): void {
    if (!window.controller) {
      console.error('[SceneManager] Controller not available');
      return;
    }
    
    const state = window.controller.getState();
    const config = window.controller.getWoodMaterialsConfig();
    const composition = state.composition;
    
    const numberSections = composition.frame_design.number_sections;
    const panelDimension = composition.frame_design.finish_x;
    const sectionMaterials = composition.frame_design.section_materials || [];
    
    console.log(`[SceneManager] Applying materials to ${this._sectionMeshes.length} sections`);
    
    for (let index = 0; index < this._sectionMeshes.length; index++) {
      const mesh = this._sectionMeshes[index];
      console.log(`[SceneManager] Setting up section ${index}: ${mesh.name}`);

      // Get material settings for this section
      let species = config.default_species;
      let grainDirection: 'horizontal' | 'vertical' | 'angled' =
        config.default_grain_direction as 'horizontal' | 'vertical' | 'angled';

      const sectionMaterial = sectionMaterials.find(
        (m) => m.section_id === index
      );
      if (sectionMaterial) {
        species = sectionMaterial.species;
        grainDirection = sectionMaterial.grain_direction;
      }

      // Calculate grain angle (uses angles from config)
      const grainAngle = calculateGrainAngle(
        grainDirection,
        index,
        numberSections,
        config
      );

      // Create or reuse material
      let material: WoodMaterial;
      if (this._sectionMaterials[index]) {
        material = this._sectionMaterials[index];
      } else {
        material = new WoodMaterial(`wood_section_${index}`, this._scene);
        material.backFaceCulling = false;
        material.twoSidedLighting = true;
        this._sectionMaterials[index] = material;
      }

      // Update textures and grain
      material.updateTexturesAndGrain(
        species,
        grainAngle,
        panelDimension,
        config
      );

      // Apply to mesh
      this._sectionMeshes[index].material = material;
      this._sectionMeshes[index].parent = this._rootNode;
    }
  }

  public dispose(): void {
    if (this._woodMaterial) {
      this._woodMaterial.dispose();
      this._woodMaterial = null;
    }
    if (this._panelMesh) {
      this._panelMesh.dispose();
      this._panelMesh = null;
    }
    if (this._finalMesh) {
      this._finalMesh.dispose();
      this._finalMesh = null;
    }
    
    // Dispose section meshes
    this._sectionMeshes.forEach(mesh => mesh.dispose());
    this._sectionMeshes = [];
    
    // Dispose section materials
    this._sectionMaterials.forEach(mat => mat.dispose());
    this._sectionMaterials = [];
    
    this._engine.dispose();
  }
  
  public resetCamera(): void {
    // Target values
    const targetAlpha = Math.PI / 2;
    const targetBeta = Math.PI / 2;
    const targetRadius = 47;
    const targetPosition = Vector3.Zero();
    
    // Animation duration
    const duration = 1000;
    const fps = 60;
    const totalFrames = (duration / 1000) * fps;
    
    // Create animations
    const animAlpha = new Animation(
      'alphaAnim', 'alpha', fps, 
      Animation.ANIMATIONTYPE_FLOAT, 
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    const animBeta = new Animation(
      'betaAnim', 'beta', fps,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    const animRadius = new Animation(
      'radiusAnim', 'radius', fps,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    
    // Set keyframes with easing
    animAlpha.setKeys([
      { frame: 0, value: this._camera.alpha },
      { frame: totalFrames, value: targetAlpha }
    ]);
    animBeta.setKeys([
      { frame: 0, value: this._camera.beta },
      { frame: totalFrames, value: targetBeta }
    ]);
    animRadius.setKeys([
      { frame: 0, value: this._camera.radius },
      { frame: totalFrames, value: targetRadius }
    ]);
    
    // Apply easing function
    const easingFunction = new CubicEase();
    easingFunction.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    animAlpha.setEasingFunction(easingFunction);
    animBeta.setEasingFunction(easingFunction);
    animRadius.setEasingFunction(easingFunction);
    
    // Animate target position
    this._camera.setTarget(targetPosition);
    
    // Run animations
    this._scene.beginDirectAnimation(
      this._camera, 
      [animAlpha, animBeta, animRadius], 
      0, totalFrames, false
    );
  }

  public async updateComposition(newState: CompositionStateDTO): Promise<void> {
    // Dispose of any previous meshes
    if (this._finalMesh) {
      this._finalMesh.dispose();
      this._finalMesh = null;
    }
    if (this._panelMesh) {
      this._panelMesh.dispose();
      this._panelMesh = null;
    }
    
    // Dispose section meshes
    this._sectionMeshes.forEach(mesh => mesh.dispose());
    this._sectionMeshes = [];
    
    // Dispose section materials
    this._sectionMaterials.forEach(mat => mat.dispose());
    this._sectionMaterials = [];

    // Run the full generation and CSG operation
    await this.renderComposition(newState);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  void (async () => {
    try {
      // Create the facade and controller
      const facade = new WaveformDesignerFacade();
      const controller = new ApplicationController(facade);
			window.controller = controller;
      window.audioCache = controller.audioCache;
      await controller.initialize();	
      
      // Create the scene manager
      const sceneManager = SceneManager.create('renderCanvas', facade);		

			// Populate UI controls with backend defaults
      const initialState = controller.getState();
      const sectionsEl = document.getElementById('sections') as HTMLSelectElement;
      const slotsEl = document.getElementById('slots') as HTMLInputElement;
      const sizeEl = document.getElementById('size') as HTMLSelectElement;
      const separationEl = document.getElementById('separation') as HTMLInputElement;
      
      const shapeEl = document.getElementById('shape') as HTMLSelectElement;
      
      if (shapeEl) shapeEl.value = initialState.composition.frame_design.shape;
      if (sectionsEl) sectionsEl.value = String(initialState.composition.frame_design.number_sections);
      if (slotsEl) slotsEl.value = String(initialState.composition.pattern_settings.number_slots);
      if (sizeEl) sizeEl.value = String(initialState.composition.frame_design.finish_x);
      if (separationEl) separationEl.value = String(initialState.composition.frame_design.separation);
			
			if (sectionsEl) sectionsEl.value = String(initialState.composition.frame_design.number_sections);
      if (slotsEl) slotsEl.value = String(initialState.composition.pattern_settings.number_slots);
      if (sizeEl) sizeEl.value = String(initialState.composition.frame_design.finish_x);
      if (separationEl) separationEl.value = String(initialState.composition.frame_design.separation);
      
      // Add event listeners to update value displays
      if (slotsEl) {
        const slotsValueEl = document.getElementById('slotsValue');
        if (slotsValueEl) slotsValueEl.textContent = slotsEl.value;
        slotsEl.addEventListener('input', () => {
          if (slotsValueEl) slotsValueEl.textContent = slotsEl.value;
        });
      }
      
      if (separationEl) {
        const sepValueEl = document.getElementById('separationValue');
        if (sepValueEl) sepValueEl.textContent = separationEl.value;
        separationEl.addEventListener('input', () => {
          if (sepValueEl) sepValueEl.textContent = separationEl.value;
        });
      }
      
      // Register the scene manager with the controller so it can trigger renders
      controller.registerSceneManager(sceneManager);			
      
      // Create upload interface
      const uploadInterface = new UploadInterface('uploadContainer', {
        onFileSelected: (file: File) => {
          void controller.dispatch({ type: 'FILE_UPLOADED', payload: file });
        },
        onError: (error: string) => {
          console.error('Upload error:', error);
        }
      });
      
      // Subscribe to state changes to update the UI.
      controller.subscribe((state) => {
        // Handle UI phase transitions
        if (state.phase === 'discovery' || state.phase === 'customization') {
          const uploadContainer = document.getElementById('uploadContainer');
          const vizContainer = document.getElementById('visualizationContainer');
          if (uploadContainer?.classList.contains('active')) {
            uploadContainer.classList.remove('active');
            vizContainer?.classList.add('active');
            uploadInterface.hide();
          }
        }

        // Force UI controls to sync with the current composition state
        const sectionsEl = document.getElementById('sections') as HTMLSelectElement;
        const slotsEl = document.getElementById('slots') as HTMLInputElement;
        const sizeEl = document.getElementById('size') as HTMLSelectElement;
        const separationEl = document.getElementById('separation') as HTMLInputElement;

        if (sectionsEl) sectionsEl.value = String(state.composition.frame_design.number_sections);
        if (slotsEl) slotsEl.value = String(state.composition.pattern_settings.number_slots);
        if (sizeEl) sizeEl.value = String(state.composition.frame_design.finish_x);
        if (separationEl) separationEl.value = String(state.composition.frame_design.separation);
      });
      
      // Perform the initial render based on the default state
      void (async () => {
        const initialState = controller.getState();
        const csgData = await facade.getSmartCSGData(
          initialState.composition,
          [], // No changed params on initial load
          null
        );
        await sceneManager.renderComposition(csgData.csg_data);
      })();
			
			// Add wood species change listener
      const woodSpeciesControl = document.getElementById('woodSpecies') as HTMLSelectElement;
      if (woodSpeciesControl && controller) {
        woodSpeciesControl.addEventListener('change', () => {
          const state = controller.getState();
            const numSections = state.composition.frame_design.number_sections;
            const selectedSection = controller.getSelectedSection();
            const grainDirectionControl = document.getElementById('grainDirection') as HTMLSelectElement;
            const grainDirection = grainDirectionControl ? 
              grainDirectionControl.value as 'horizontal' | 'vertical' | 'angled' : 'vertical';
            const species = woodSpeciesControl.value;
            
            // For n=1, always update section 0 regardless of selection
            if (numSections === 1) {
              controller.updateSectionMaterial(0, species, grainDirection);
            } else if (selectedSection !== null && selectedSection >= 0) {
              // Update specific selected section
              controller.updateSectionMaterial(selectedSection, species, grainDirection);
            } else {
              // Update all sections
              for (let i = 0; i < numSections; i++) {
                controller.updateSectionMaterial(i, species, grainDirection);
              }
            }
        });
      }
      
      // Add grain direction change listener
      const grainDirectionControl = document.getElementById('grainDirection') as HTMLSelectElement;
      if (grainDirectionControl && controller) {
        grainDirectionControl.addEventListener('change', () => {
          const state = controller.getState();
            const numSections = state.composition.frame_design.number_sections;
            const selectedSection = controller.getSelectedSection();
            const grainDirection = grainDirectionControl.value as 'horizontal' | 'vertical' | 'angled';
            const speciesEl = document.getElementById('woodSpecies') as HTMLSelectElement;
            const species = speciesEl ? speciesEl.value : 'walnut-black-american';
            
            // For n=1, always update section 0 regardless of selection
            if (numSections === 1) {
              controller.updateSectionMaterial(0, species, grainDirection);
            } else if (selectedSection !== null && selectedSection >= 0) {
              // Update specific selected section
              controller.updateSectionMaterial(selectedSection, species, grainDirection);
            } else {
              // Update all sections
              for (let i = 0; i < numSections; i++) {
                controller.updateSectionMaterial(i, species, grainDirection);
              }
            }
        });
      }
			
      // Wire up UI controls
      const updateButton = document.getElementById('updateButton');
      if (updateButton) {
        updateButton.addEventListener('click', () => {
        if (!controller) return;
        const currentState = controller.getState();
        const newComposition = structuredClone(currentState.composition);

        // Get values from UI controls
        const shapeEl = document.getElementById('shape') as HTMLSelectElement;
        const sectionsEl = document.getElementById('sections') as HTMLSelectElement;
        const slotsEl = document.getElementById('slots') as HTMLInputElement;
        const sizeEl = document.getElementById('size') as HTMLSelectElement;
        const separationEl = document.getElementById('separation') as HTMLInputElement;

        if (shapeEl) {
          newComposition.frame_design.shape = shapeEl.value as 'circular' | 'rectangular';
        }
          if (sectionsEl) {
            newComposition.frame_design.number_sections = parseInt(sectionsEl.value, 10);
          }
          if (slotsEl) {
            newComposition.pattern_settings.number_slots = parseInt(slotsEl.value, 10);
          }
          if (sizeEl) {
            const size = parseFloat(sizeEl.value);
            newComposition.frame_design.finish_x = size;
            newComposition.frame_design.finish_y = size;
          }
          if (separationEl) {
            newComposition.frame_design.separation = parseFloat(separationEl.value);
          }

          // Delegate the entire update process to the controller's smart handler.
          void controller.handleCompositionUpdate(newComposition);
        });
      }

      // Add listeners to 'sections' and 'slots' controls to handle divisibility logic instantly
      const sectionsControl = document.getElementById('sections') as HTMLSelectElement;
      const slotsControl = document.getElementById('slots') as HTMLInputElement;

      if (sectionsControl && slotsControl) {
        sectionsControl.addEventListener('change', () => {
          const numSections = parseInt(sectionsControl.value, 10);
          const numSlots = parseInt(slotsControl.value, 10);

          // Update slider step
          slotsControl.step = String(numSections);

          // Snap to nearest valid value
          if (numSlots % numSections !== 0) {
            slotsControl.value = String(Math.round(numSlots / numSections) * numSections);
            // Update displayed value
            const slotsValueEl = document.getElementById('slotsValue');
            if (slotsValueEl) slotsValueEl.textContent = slotsControl.value;
          }
        });
				
				// Reset materials when section count changes
        sectionsControl.addEventListener('change', () => {
          if (!controller) return;
          
          const numSections = parseInt(sectionsControl.value, 10);
          const state = controller.getState();
          const materials = state.composition.frame_design.section_materials || [];
          
          // For n=1, hide section indicator and clear selection
          const sectionIndicator = document.getElementById('sectionIndicator');
          if (numSections === 1) {
            controller.selectSection(-1);
            if (sectionIndicator) sectionIndicator.style.display = 'none';
          }
          
          // Check if all sections have the same species
          const allSameSpecies = materials.length > 0 && 
            materials.every(m => m.species === materials[0].species);
          
          if (!allSameSpecies) {
            // Mixed materials or no materials - reset to default
            const config = controller.getWoodMaterialsConfig();
            
            // Clear section selection
            controller.selectSection(-1);
            if (sectionIndicator) sectionIndicator.style.display = 'none';
            
            // Reset UI controls to defaults
            const speciesEl = document.getElementById('woodSpecies') as HTMLSelectElement;
            const grainEl = document.getElementById('grainDirection') as HTMLSelectElement;
            if (speciesEl) speciesEl.value = config.default_species;
            if (grainEl) grainEl.value = config.default_grain_direction;
          }
          // If all same species, materials are preserved in the composition update
        });
        
        // Set initial step value based on current sections
        const initialSections = parseInt(sectionsControl.value, 10);
        slotsControl.step = String(initialSections);
      }

      // Add listener to 'size' control to apply smart defaults instantly to other controls
      const sizeControl = document.getElementById('size') as HTMLSelectElement;
      const separationControl = document.getElementById('separation') as HTMLInputElement;

      if (sizeControl && slotsControl && separationControl && controller) {
        sizeControl.addEventListener('change', () => {
          const newSize = sizeControl.value;
          const defaults = controller.getState().composition.size_defaults?.[newSize];
          
          if (defaults) {
            slotsControl.value = String(defaults.number_slots);
            separationControl.value = String(defaults.separation);
            
            // Update displayed value
            const slotsValueEl = document.getElementById('slotsValue');
            if (slotsValueEl) slotsValueEl.textContent = String(defaults.number_slots);
            const sepValueEl = document.getElementById('separationValue');
            if (sepValueEl) sepValueEl.textContent = String(defaults.separation);

            // Also ensure the new slot number is valid for the current number of sections
            const numSections = parseInt(sectionsControl.value, 10);
            if (defaults.number_slots % numSections !== 0) {
                slotsControl.value = String(Math.round(defaults.number_slots / numSections) * numSections);
                if (slotsValueEl) slotsValueEl.textContent = slotsControl.value;
            }
          }
        });
        
        // Trigger once on load to apply initial defaults
        sizeControl.dispatchEvent(new Event('change'));
      }
      
      // Expose globally for testing
      window.sceneManager = sceneManager;
      window.controller = controller;
      
    } catch (error) {
      console.error('Failed to initialize application:', error);
    }
  })();
});