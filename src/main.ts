import {
  Engine, 
  Scene, 
  ArcRotateCamera, 
  HemisphericLight,
  DirectionalLight,
  Vector3, 
  Color3,
  Mesh,
  MeshBuilder,
  StandardMaterial,
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
import { TextureCacheService } from './TextureCacheService';
import { UploadInterface } from './UploadInterface';
import { UIEngine } from './UIEngine';
import { WaveformDesignerFacade } from './WaveformDesignerFacade';
import { WoodMaterial } from './WoodMaterial';
import { ProcessingOverlay } from './ProcessingOverlay';
import { PerformanceMonitor } from './PerformanceMonitor';


/**
 * Calculate grain angle based on direction and section configuration.
 * Uses angles from backend configuration (single source of truth).
 */
function calculateGrainAngle(
  direction: string,
  sectionId: number,
  numberSections: number,
  config: WoodMaterialsConfig
): number {
  const directionAngles = config.rendering_config.grain_direction_angles;
  
  // Check if this direction has a direct angle mapping
  if (direction in directionAngles) {
    const angle = directionAngles[direction];
    
    // If the value is a number, use it directly
    if (typeof angle === 'number') {
      return angle;
    }
    
    // If it's a string (like "use_section_positioning"), fall through
  }
  
  // Use section positioning angles (for unmapped directions or special values)
  const anglesKey = String(numberSections);
  const angles = config.geometry_constants.section_positioning_angles[anglesKey];
  
  if (!angles || typeof angles[sectionId] !== 'number') {
    console.warn(`[main.ts] No angle found for direction "${direction}", section ${sectionId}, n=${numberSections}`);
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
  private _textureCache: TextureCacheService;
  
  // Rendering resources (prefixed = OK)
  private _woodMaterial: WoodMaterial | null = null;
  private _panelMesh: Mesh | null = null;
  private _finalMesh: Mesh | null = null;
  private _sectionMeshes: Mesh[] = [];
  private _sectionMaterials: WoodMaterial[] = [];
	private _selectedSectionIndex: number | null = null;
  private _rootNode: TransformNode | null = null;
	private _currentCSGData: CSGDataResponse | null = null;  // Store CSG data for overlay positioning
	private _overlayMesh: Mesh | null = null;
  private _hasPlayedPulseAnimation: boolean = false;
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

    // Initialize texture cache
    this._textureCache = new TextureCacheService(this._scene);

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

  /**
   * Preload default wood textures on page load (before audio upload)
   * This ensures instant rendering when user uploads audio
   */
  public preloadDefaultTextures(config: WoodMaterialsConfig): void {
    console.log('[SceneManager] Preloading default textures on page load...');
    
    // Preload walnut immediately (and optionally cherry/maple for quick switching)
    const speciesToPreload = ['walnut-black-american', 'cherry-black', 'maple'];
    
    speciesToPreload.forEach(speciesId => {
      const species = config.species_catalog.find(s => s.id === speciesId);
      if (!species) {
        console.warn(`[SceneManager] Species not found: ${speciesId}`);
        return;
      }
      
      const basePath = config.texture_config.base_texture_path;
      const sizeInfo = config.texture_config.size_map.large;
      
      // Construct paths for all 3 texture maps
      const albedoPath = `${basePath}/${species.id}/Varnished/${sizeInfo.folder}/Diffuse/wood-${species.wood_number}_${species.id}-varnished-${sizeInfo.dimensions}_d.png`;
      const normalPath = `${basePath}/${species.id}/Shared_Maps/${sizeInfo.folder}/Normal/wood-${species.wood_number}_${species.id}-${sizeInfo.dimensions}_n.png`;
      const roughnessPath = `${basePath}/${species.id}/Shared_Maps/${sizeInfo.folder}/Roughness/wood-${species.wood_number}_${species.id}-${sizeInfo.dimensions}_r.png`;
      
      console.log(`[SceneManager] Page-load preload: ${species.id}`);
      
      // Load and cache textures (they'll be in cache when user uploads audio)
      this._textureCache.getTexture(albedoPath);
      this._textureCache.getTexture(normalPath);
      this._textureCache.getTexture(roughnessPath);
    });
    
    console.log('[SceneManager] Page-load texture preload initiated');
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

  private _renderCompositionInternal(csgData: CSGDataResponse): void {
    console.log('[POC] SceneManager._renderCompositionInternal called');
    PerformanceMonitor.start('render_internal_total');
		
		console.log('[BEFORE CLEANUP]', {
			rootNode: this._rootNode ? 'exists' : 'null',
			rootNodeId: this._rootNode?.uniqueId,
			rootNodeName: this._rootNode?.name,
			meshCount: this._sectionMeshes.length,
			sceneTransformNodes: this._scene.transformNodes.length,
			sceneMeshes: this._scene.meshes.length
		});
		
    PerformanceMonitor.start('mesh_cleanup');
		// Store CSG data for overlay positioning
    this._currentCSGData = csgData;
    
		// Dispose the root node, which recursively disposes all children and materials
		if (this._rootNode) {
			this._rootNode.dispose(false, false); // ← Only dispose materials, NOT textures!
			this._rootNode = null;
		}

		// Clear reference arrays (meshes already disposed via root)
		this._sectionMeshes = [];
		this._sectionMaterials = [];
    
    PerformanceMonitor.end('mesh_cleanup');
		
		console.log('[AFTER CLEANUP]', {
			rootNode: this._rootNode ? 'exists' : 'null',
			rootNodeId: this._rootNode?.uniqueId,
			rootNodeName: this._rootNode?.name,
			meshCount: this._sectionMeshes.length,
			sceneTransformNodes: this._scene.transformNodes.length,
			sceneMeshes: this._scene.meshes.length
		});		

    try {
      PerformanceMonitor.start('csg_mesh_generation');
      
      // Get array of meshes from frame service
      const frameService = new FrameGenerationService(this._scene);
      const meshes = frameService.createFrameMeshes(csgData.csg_data);
      
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
      
      PerformanceMonitor.end('csg_mesh_generation');
      PerformanceMonitor.start('apply_materials');
      
      // Apply materials to sections based on state
      this.applySectionMaterials();
      
      PerformanceMonitor.end('apply_materials');
      PerformanceMonitor.end('render_internal_total');
      
      console.log('[POC] All section meshes configured');
      
      // Play pulse animation once after initial render
      this.pulseAllSections();
      
      // Setup interaction
      this.setupSectionInteraction();

    } catch (error: unknown) {
      console.error('[POC] CSG mesh generation failed:', error);
    }
  }
	
	public getSelectedSection(): number | null {
    return this._selectedSectionIndex;
  }
	
	public clearSelection(): void {
    this.fadeOutOverlay();
    
    // Hide "Apply to All" button
    const applyAllBtn = document.getElementById('applyToAllSections');
    if (applyAllBtn) {
      applyAllBtn.style.display = 'none';
    }
    
    // Reset section indicator
    const sectionIndicator = document.getElementById('sectionIndicator');
    if (sectionIndicator) {
      sectionIndicator.style.display = 'none';
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
    // Set new selection
    this._selectedSectionIndex = index;
    
    // Create overlay for selected section
    if (this._sectionMeshes[index]) {
      this.createCircularOverlay(index);
    }
  }
	
	private pulseAllSections(): void {
    if (this._hasPlayedPulseAnimation) return;
    if (!this._currentCSGData || !window.controller) return;
    
    const config = window.controller.getWoodMaterialsConfig();
    const csgData = this._currentCSGData.csg_data;
    const numSections = csgData.panel_config.number_sections;
    
    // Get bifurcation angles - with special handling for n=4 ordering mismatch
    let bifurcationAngles: number[];
    if (numSections === 4) {
      // Backend section_local_centers order: [TR, BR, BL, TL]
      // Backend section_positioning_angles["4"]: [45, 135, 225, 315] = [TR, TL, BL, BR]
      // Create correct mapping: each index gets the angle for its position
      const angleMap: Record<string, number> = { 'TR': 45, 'BR': 315, 'BL': 225, 'TL': 135 };
      const quadrantOrder = ['TR', 'BR', 'BL', 'TL'];
      bifurcationAngles = quadrantOrder.map(q => angleMap[q]);  // Results in [45, 315, 225, 135]
    } else {
      bifurcationAngles = config.geometry_constants.section_positioning_angles[String(numSections)] || [0];
    }
    
    // CRITICAL: For n≠3, rotation.y=π is baked into mesh vertices, which mirrors the mesh
    // This means mesh array order is reversed from section_local_centers order
    // Reverse the array to match the visual mesh layout
    const localCenters = (numSections !== 3 && numSections !== 1) 
      ? [...csgData.section_local_centers].reverse() 
      : csgData.section_local_centers;
    
    // Create pulsing overlays sequentially on each section
    this._sectionMeshes.forEach((mesh, index) => {
      setTimeout(() => {
        const boundingInfo = mesh.getBoundingInfo();
        const size = boundingInfo.boundingBox.extendSize;
        const maxDimension = Math.max(size.x, size.z);
        const baseRadius = maxDimension * 0.05; // 5% size
        
        // Use local center from backend geometry data
        const localCenter = csgData.section_local_centers[index];
        const bifurcationAngle = bifurcationAngles[index];
        const minRadius = csgData.true_min_radius;
        
        // Calculate position along bifurcation ray at 60% of min_radius
        const distanceFromCenter = minRadius * 0.6;
        const angleRad = (bifurcationAngle * Math.PI) / 180;
        
        // Convert from CNC coordinates to Babylon coordinates
        const CNC_CENTER = csgData.panel_config.outer_radius;
        const localCenterBabylon = {
          x: localCenter[0] - CNC_CENTER,
          z: localCenter[1] - CNC_CENTER
        };
        
        // Calculate COMPLETE position in pre-bake space
        let xPos = localCenterBabylon.x + distanceFromCenter * Math.cos(angleRad);
        let zPos = localCenterBabylon.z + distanceFromCenter * Math.sin(angleRad);
        
        // THEN apply transformation to the complete position
        // For n=2,4: rotation.y=π is baked → negate both axes
        // For n=3: rotation.y=π AND rotation.z=π are baked → also negate both axes
        if (numSections !== 1) {
          xPos = -xPos;
          zPos = -zPos;
        }
        
        const center = boundingInfo.boundingBox.center;
        const yPos = center.y + 2;
        
        // Create static white circle (stays visible)
        const staticCircle = MeshBuilder.CreateDisc(
          `pulseStatic_${index}`,
          { radius: baseRadius, tessellation: 32 },
          this._scene
        );
        staticCircle.position = new Vector3(xPos, yPos, zPos);
        staticCircle.rotation.x = Math.PI / 2;
        staticCircle.renderingGroupId = 1;
        staticCircle.parent = this._rootNode;
        
        const staticMat = new StandardMaterial(`pulseStaticMat_${index}`, this._scene);
        staticMat.diffuseColor = new Color3(1, 1, 1);
        staticMat.alpha = 0.8;
        staticMat.emissiveColor = new Color3(0.2, 0.2, 0.2);
        staticMat.backFaceCulling = false;
        staticCircle.material = staticMat;
        
        // Create 3 pulsing rings that grow and fade
        for (let pulseNum = 0; pulseNum < 3; pulseNum++) {
          setTimeout(() => {
            const ring = MeshBuilder.CreateDisc(
              `pulseRing_${index}_${pulseNum}`,
              { radius: baseRadius, tessellation: 32 },
              this._scene
            );
            ring.position = new Vector3(xPos, yPos + 0.01, zPos);
            ring.rotation.x = Math.PI / 2;
            ring.renderingGroupId = 1;
            ring.parent = this._rootNode;
            
            const ringMat = new StandardMaterial(`pulseRingMat_${index}_${pulseNum}`, this._scene);
            ringMat.diffuseColor = new Color3(0.3, 0.5, 0.8); // Blueish
            ringMat.emissiveColor = new Color3(0.3, 0.5, 0.8);
            ringMat.alpha = 0.6;
            ringMat.backFaceCulling = false;
            ring.material = ringMat;
            
            // Grow and fade animation (slow, like upload pulse)
            const scaleAnim = new Animation(
              `ringScale_${index}_${pulseNum}`,
              'scaling',
              30,
              Animation.ANIMATIONTYPE_VECTOR3,
              Animation.ANIMATIONLOOPMODE_CONSTANT
            );
            
            const alphaAnim = new Animation(
              `ringAlpha_${index}_${pulseNum}`,
              'alpha',
              30,
              Animation.ANIMATIONTYPE_FLOAT,
              Animation.ANIMATIONLOOPMODE_CONSTANT
            );
            
            scaleAnim.setKeys([
              { frame: 0, value: new Vector3(1, 1, 1) },
              { frame: 45, value: new Vector3(3, 3, 3) }
            ]);
            
            alphaAnim.setKeys([
              { frame: 0, value: 0.6 },
              { frame: 45, value: 0 }
            ]);
            
            ring.animations = [scaleAnim];
            ringMat.animations = [alphaAnim];
            
            const scaleAnimatable = this._scene.beginAnimation(ring, 0, 45, false);
            this._scene.beginAnimation(ringMat, 0, 45, false);
            
            scaleAnimatable.onAnimationEnd = () => {
              ring.dispose();
              ringMat.dispose();
            };
          }, pulseNum * 1500); // 1.5 seconds between pulses (slow like upload)
        }
        
        // Remove static circle after all pulses complete
        setTimeout(() => {
          staticCircle.dispose();
          staticMat.dispose();
        }, 5000); // 3 pulses × 1.5s + buffer
        
      }, index * 5500); // Start next section after previous completes all pulses
    });
    
    this._hasPlayedPulseAnimation = true;
  }
  
  private fadeOutOverlay(): void {
    if (!this._overlayMesh) return;
    
    const material = this._overlayMesh.material as StandardMaterial;
    if (!material) return;
    
    const fadeAnimation = new Animation(
      'overlayFade',
      'alpha',
      60,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    
    fadeAnimation.setKeys([
      { frame: 0, value: 0.4 },
      { frame: 18, value: 0 }
    ]);
    
    material.animations = [fadeAnimation];
    
    const animatable = this._scene.beginAnimation(material, 0, 18, false);
    
    animatable.onAnimationEnd = () => {
      if (this._overlayMesh) {
        this._overlayMesh.dispose();
        this._overlayMesh = null;
      }
      this._selectedSectionIndex = null;
    };
  }
  
  private createCircularOverlay(index: number): void {
    const mesh = this._sectionMeshes[index];
    if (!mesh || !this._currentCSGData || !window.controller) return;
    
    // Dispose existing overlay if present
    if (this._overlayMesh) {
      this._overlayMesh.dispose();
      this._overlayMesh = null;
    }
    
    const config = window.controller.getWoodMaterialsConfig();
    const csgData = this._currentCSGData.csg_data;
    const numSections = csgData.panel_config.number_sections;
    
    // Get bifurcation angles - with special handling for n=4 ordering mismatch
    let bifurcationAngles: number[];
    if (numSections === 4) {
      // Backend section_local_centers order: [TR, BR, BL, TL]
      // Backend section_positioning_angles["4"]: [45, 135, 225, 315] = [TR, TL, BL, BR]
      // Create correct mapping: each index gets the angle for its position
      const angleMap: Record<string, number> = { 'TR': 45, 'BR': 315, 'BL': 225, 'TL': 135 };
      const quadrantOrder = ['TR', 'BR', 'BL', 'TL'];
      bifurcationAngles = quadrantOrder.map(q => angleMap[q]);  // Results in [45, 315, 225, 135]
    } else {
      bifurcationAngles = config.geometry_constants.section_positioning_angles[String(numSections)] || [0];
    }
    
    // CRITICAL: For n≠3, rotation.y=π is baked into mesh vertices, which mirrors the mesh
    // Reverse the array to match the visual mesh layout
    const localCenters = (numSections !== 3 && numSections !== 1) 
      ? [...csgData.section_local_centers].reverse() 
      : csgData.section_local_centers;
    
    // Get section bounding info for sizing
    const boundingInfo = mesh.getBoundingInfo();
    const size = boundingInfo.boundingBox.extendSize;
    const maxDimension = Math.max(size.x, size.z);
    const overlayRadius = maxDimension * 0.05; // 5% of section size
    
    // Create circular plane mesh
    this._overlayMesh = MeshBuilder.CreateDisc(
      'selectionOverlay',
      { radius: overlayRadius, tessellation: 32 },
      this._scene
    );
    
    // Use local center from backend geometry data
    const localCenter = csgData.section_local_centers[index];
    const bifurcationAngle = bifurcationAngles[index];
    const minRadius = csgData.true_min_radius;
    
    // Calculate position along bifurcation ray at 60% of min_radius
    const distanceFromCenter = minRadius * 0.6;
    const angleRad = (bifurcationAngle * Math.PI) / 180;
    
    // Convert from CNC coordinates to Babylon coordinates
    const CNC_CENTER = csgData.panel_config.outer_radius;
    const localCenterBabylon = {
      x: localCenter[0] - CNC_CENTER,
      z: localCenter[1] - CNC_CENTER
    };
    
    // Calculate COMPLETE position in pre-bake space
    let xPos = localCenterBabylon.x + distanceFromCenter * Math.cos(angleRad);
    let zPos = localCenterBabylon.z + distanceFromCenter * Math.sin(angleRad);
    
    // THEN apply transformation to the complete position
    // For n=2,4: rotation.y=π is baked → negate both axes
    // For n=3: rotation.y=π AND rotation.z=π are baked → also negate both axes
    if (numSections !== 1) {
      xPos = -xPos;
      zPos = -zPos;
    }
    
    const center = boundingInfo.boundingBox.center;
    
    // Position overlay on bifurcation ray, well above surface to avoid z-fighting
    this._overlayMesh.position = new Vector3(xPos, center.y + 2, zPos);
    
    // Force overlay to render on top
    this._overlayMesh.renderingGroupId = 1;
    this._overlayMesh.rotation.x = Math.PI / 2; // Rotate to face upward
    
    // Create semi-transparent white material
    const overlayMat = new StandardMaterial('overlayMat', this._scene);
    overlayMat.diffuseColor = new Color3(1, 1, 1);
    overlayMat.alpha = 0.7;
    overlayMat.emissiveColor = new Color3(0.3, 0.3, 0.3); // Slight glow for visibility
    overlayMat.backFaceCulling = false;
    
    this._overlayMesh.material = overlayMat;
    this._overlayMesh.parent = this._rootNode;
  }
  
  private updateSectionUI(index: number): void {
    // Update section indicator in UI
    const sectionIndicator = document.getElementById('sectionIndicator');
    const sectionNumber = document.getElementById('selectedSectionNumber');
    
    if (sectionIndicator && sectionNumber) {
      sectionIndicator.style.display = 'block';
      sectionNumber.textContent = String(index + 1);
    }
    
    // Show "Apply to All" button if n >= 2
    const applyAllBtn = document.getElementById('applyToAllSections');
    if (applyAllBtn && window.controller) {
      const state = window.controller.getState();
      const numSections = state.composition.frame_design.number_sections;
      applyAllBtn.style.display = numSections >= 2 ? 'block' : 'none';
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
	
	public applySectionMaterials(): void {
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
    
    console.log(`[SceneManager] === Applying materials to ${this._sectionMeshes.length} sections ===`);
    console.log(`[SceneManager] Section materials array:`, JSON.stringify(sectionMaterials, null, 2));
    console.log(`[SceneManager] Mesh count:`, this._sectionMeshes.length);
    console.log(`[SceneManager] Existing materials count:`, this._sectionMaterials.length);
    
    for (let index = 0; index < this._sectionMeshes.length; index++) {
      const mesh = this._sectionMeshes[index];
      console.log(`[SceneManager] Processing section ${index}: ${mesh.name}`);
      console.log(`[SceneManager] Current mesh material:`, mesh.material?.name || 'none');

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
        console.log(`[SceneManager] Reusing existing material for section ${index}: ${this._sectionMaterials[index].name}`);
        material = this._sectionMaterials[index];
      } else {
        console.log(`[SceneManager] Creating NEW material for section ${index}`);
        material = new WoodMaterial(`wood_section_${index}`, this._scene);
        material.backFaceCulling = false;
        material.twoSidedLighting = true;
        this._sectionMaterials[index] = material;
      }

      console.log(`[SceneManager] Updating section ${index} to species: ${species}, grainAngle: ${grainAngle}`);
      
      // Update textures and grain (with texture cache)
      material.updateTexturesAndGrain(
        species,
        grainAngle,
        panelDimension,
        config,
				index,
        this._textureCache
      );

      // Apply to mesh
      this._sectionMeshes[index].material = material;
      this._sectionMeshes[index].parent = this._rootNode;
    }
  }
	
	public applySingleSectionMaterial(sectionIndex: number): void {
    if (!window.controller) {
      console.error('[SceneManager] Controller not available');
      return;
    }
    
    const mesh = this._sectionMeshes[sectionIndex];
    if (!mesh) {
      console.error(`[SceneManager] Section ${sectionIndex} mesh not found`);
      return;
    }
    
    const state = window.controller.getState();
    const config = window.controller.getWoodMaterialsConfig();
    const composition = state.composition;
    
    const numberSections = composition.frame_design.number_sections;
    const panelDimension = composition.frame_design.finish_x;
    const sectionMaterials = composition.frame_design.section_materials || [];
    
    // Get material settings for THIS section only
    let species = config.default_species;
    let grainDirection: 'horizontal' | 'vertical' | 'angled' =
      config.default_grain_direction as 'horizontal' | 'vertical' | 'angled';
    
    const sectionMaterial = sectionMaterials.find(m => m.section_id === sectionIndex);
    if (sectionMaterial) {
      species = sectionMaterial.species;
      grainDirection = sectionMaterial.grain_direction;
    }
    
    const grainAngle = calculateGrainAngle(
      grainDirection,
      sectionIndex,
      numberSections,
      config
    );
    
    // Get or create material for this section
    let material = this._sectionMaterials[sectionIndex];
    if (!material) {
      material = new WoodMaterial(`wood_section_${sectionIndex}`, this._scene);
      material.backFaceCulling = false;
      material.twoSidedLighting = true;
      this._sectionMaterials[sectionIndex] = material;
    }
		
		console.log(`[applySingleSectionMaterial] Section ${sectionIndex} material name: ${material.name}`);
		console.log(`[applySingleSectionMaterial] Material instance unique? ${this._sectionMaterials.filter(m => m === material).length === 1}`);		
    
    // Update only this section's material
    material.updateTexturesAndGrain(
      species,
      grainAngle,
      panelDimension,
      config,
      sectionIndex,
      this._textureCache
    );
    
    mesh.material = material;
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
      // Initialize UIEngine first - loads config from backend
      const uiEngine = new UIEngine();
      await uiEngine.loadConfig();
      
      // Create the facade and controller
      const facade = new WaveformDesignerFacade();
      const controller = new ApplicationController(facade);
			window.controller = controller;
      window.audioCache = controller.audioCache;
      await controller.initialize();	
      
      // Create the scene manager
      const sceneManager = SceneManager.create('renderCanvas', facade);
      window.sceneManager = sceneManager;
      
      // Register scene manager with controller
      controller.registerSceneManager(sceneManager);
      
      // Preload default textures (walnut, cherry, maple) on page load
      // This ensures instant rendering when user uploads audio
      try {
        const woodConfig = controller.getWoodMaterialsConfig();
        sceneManager.preloadDefaultTextures(woodConfig);
      } catch (error) {
        console.warn('[main.ts] Could not preload textures - config not loaded yet:', error);
      }
      
      // Generic UI initialization
      await initializeUI(uiEngine, controller, sceneManager);
      
      // Trigger initial render if composition has amplitudes
      const initialState = controller.getState();
      if (initialState.composition.processed_amplitudes.length > 0) {
        const response = await fetch('http://localhost:8000/geometry/csg-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            state: initialState.composition,
            changed_params: [],
            previous_max_amplitude: null
          })
        });
        
        if (response.ok) {
          const csgData = await response.json() as CSGDataResponse;
          await sceneManager.renderComposition(csgData);
        } else {
          console.error('[main.ts] Failed to fetch CSG data:', response.status, await response.text());
        }
      }
      
    } catch (error) {
      console.error('Initialization error:', error);
    }
  })();
});

/**
 * Generic UI initialization - no hardcoded element references
 */
async function initializeUI(
  uiEngine: UIEngine, 
  controller: ApplicationController,
  sceneManager: ReturnType<typeof SceneManager.create>
): Promise<void> {
  const initialState = controller.getState();
  
  // 1. Set up dynamic options first (wood species from endpoint)
  await setupDynamicOptions(uiEngine);
  
  // 2. Then populate all UI elements from composition state
  syncUIFromState(uiEngine, initialState.composition);
  
  // 3. Bind all element change listeners generically
  bindElementListeners(uiEngine, controller, sceneManager);
  
  // 4. Bind update button
  bindUpdateButton(uiEngine, controller, sceneManager);
  
  // 5. Bind camera reset button
  bindCameraResetButton(sceneManager);
  
  // 6. Bind new file upload button
  bindNewFileButton(controller);
  
  // 7. Setup upload interface
  setupUploadInterface(uiEngine, controller);
  
  // 8. Initialize processing overlay
  new ProcessingOverlay('processingOverlay', controller);
  
  // 9. Subscribe to state changes (only sync UI on phase transitions, not every change)
  controller.subscribe((state) => {
    handlePhaseTransition(uiEngine, state, controller);
  });
  
  // 10. Initial phase transition (only if restoring non-upload phase)
  if (initialState.phase !== 'upload') {
    handlePhaseTransition(uiEngine, initialState, controller);
  }
  
  // 11. Initial conditional logic (like disabling n=3 for rectangular)
  updateConditionalUI(uiEngine, initialState.composition);
}

/**
 * Sync all UI elements from composition state
 */
function syncUIFromState(uiEngine: UIEngine, composition: CompositionStateDTO): void {
  const elementKeys = uiEngine.getElementKeys();
  
  elementKeys.forEach(key => {
    const config = uiEngine.getElementConfig(key);
    if (!config) return;
    
    const value = uiEngine.getStateValue(composition, config.state_path);
    if (value !== null && value !== undefined) {
      const typedValue: string | number = typeof value === 'number' ? value : String(value);
      uiEngine.writeElementValue(key, typedValue);
    }
  });
}

/**
 * Setup dynamic options from endpoints (e.g., wood species)
 */
async function setupDynamicOptions(uiEngine: UIEngine): Promise<void> {
  const elementKeys = uiEngine.getElementKeys();
  
  for (const key of elementKeys) {
    const config = uiEngine.getElementConfig(key);
    if (!config) continue;
    
    const element = uiEngine.getElement(key) as HTMLSelectElement;
    if (!element) continue;
    
    // Handle dynamic options from endpoint
    if (config.options_from_endpoint) {
      const options = await uiEngine.loadDynamicOptions(key);
      if (options.length > 0) {
        element.innerHTML = '';
        options.forEach(opt => {
          const optionEl = document.createElement('option');
          optionEl.value = String(opt.value);
          optionEl.textContent = opt.label;
          element.appendChild(optionEl);
        });
      }
    }
    // Handle static options from config
    else if (config.options && element.tagName === 'SELECT') {
      element.innerHTML = '';
      config.options.forEach(opt => {
        const optionEl = document.createElement('option');
        optionEl.value = String(opt.value);
        optionEl.textContent = opt.label;
        element.appendChild(optionEl);
      });
    }
  }
}

/**
 * Capture current UI state generically using UIEngine
 */
function captureUISnapshot(uiEngine: UIEngine, baseComposition: CompositionStateDTO): CompositionStateDTO {
  // Deep clone to avoid mutations
  const composition = JSON.parse(JSON.stringify(baseComposition)) as CompositionStateDTO;
  const elementKeys = uiEngine.getElementKeys();
  
  for (const key of elementKeys) {
    const config = uiEngine.getElementConfig(key);
    if (!config) continue;
    
    let value = uiEngine.readElementValue(key);
    if (value === null || value === undefined) continue;
    
    // CRITICAL: Convert strings to numbers for numeric fields
    if (config.type === 'select' && typeof value === 'string') {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        value = numValue;
      }
    }
    
    // Special handling for size - sets both finish_x AND finish_y
    if (key === 'size') {
      composition.frame_design.finish_x = value as number;
      composition.frame_design.finish_y = value as number;
    } else {
      // UIEngine.setStateValue returns updated composition
      const updated = uiEngine.setStateValue(composition, config.state_path, value);
      Object.assign(composition, updated);
    }
  }
  
  return composition;
}

/**
 * Bind change listeners to all elements generically
 */
function bindElementListeners(uiEngine: UIEngine, controller: ApplicationController, _sceneManager: SceneManager): void {
  const elementKeys = uiEngine.getElementKeys();
  
  elementKeys.forEach(key => {
    const element = uiEngine.getElement(key);
    const config = uiEngine.getElementConfig(key);
    
    if (!element || !config) return;
    
    // Handle range inputs - update display value
    if (config.type === 'range' && config.display_value_id) {
      const inputEl = element as HTMLInputElement;
      const displayEl = document.getElementById(config.display_value_id);
      
      if (displayEl) {
        displayEl.textContent = inputEl.value;
        inputEl.addEventListener('input', () => {
          displayEl.textContent = inputEl.value;
        });
      }
    }
    
    // Generic behavior: sections updates slots step and validates
    if (key === 'sections') {
      element.addEventListener('change', () => {
        const sections = parseInt((element as HTMLSelectElement).value);
        uiEngine.updateSlotsStep(sections);
        
        const slotsEl = uiEngine.getElement('slots') as HTMLInputElement;
        if (slotsEl) {
          const currentSlots = parseInt(slotsEl.value);
          const validSlots = uiEngine.validateSlotsDivisibility(currentSlots, sections);
          if (validSlots !== currentSlots) {
            slotsEl.value = String(validSlots);
            const displayEl = document.getElementById('slotsValue');
            if (displayEl) displayEl.textContent = String(validSlots);
          }
        }
        
        // Trigger conditional UI update
        const currentState = controller.getState();
        updateConditionalUI(uiEngine, currentState.composition);
      });
    }
    
    // Generic behavior: shape updates conditional options
    if (key === 'shape') {
      element.addEventListener('change', () => {
        // Read the CURRENT dropdown value, not the old state
        const shapeValue = (element as HTMLSelectElement).value;
        const currentState = controller.getState();
        
        // Create updated state with new shape value
        const updatedState: Record<string, string | number> = {
          shape: shapeValue,
          sections: currentState.composition.frame_design.number_sections,
        };
        
        uiEngine.updateConditionalOptions(updatedState);
      });
    }
    
    // Generic behavior: handle on_change_triggers if configured
    if (config.on_change_triggers) {
      element.addEventListener('change', () => {
        const value = uiEngine.readElementValue(key);
        const currentState = controller.getState();
        uiEngine.handleOnChangeTriggers(key, value, currentState.composition);
      });
    }
    
    // Generic on_change handlers from config
    if (config.on_change) {
      console.log(`[bindElementListeners] Binding on_change handler for: ${key}`, config.on_change);
      element.addEventListener('change', () => {
        console.log(`[bindElementListeners] on_change triggered for: ${key}`);
        handleOnChangeAction(config.on_change!, uiEngine, controller);
      });
    }
  });
}

/**
 * Bind update button to collect all values and submit
 */
function bindUpdateButton(uiEngine: UIEngine, controller: ApplicationController, sceneManager: SceneManager): void {
  const updateButton = uiEngine.getElement('updateDesign');
  if (!updateButton) return;
  
  updateButton.addEventListener('click', () => {
    void (async () => {
      const currentState = controller.getState();
      const newComposition: CompositionStateDTO = JSON.parse(JSON.stringify(currentState.composition)) as CompositionStateDTO;
      
      // Read all element values and update composition (skip empty/invalid values)
      const elementKeys = uiEngine.getElementKeys();
      elementKeys.forEach(key => {
        const config = uiEngine.getElementConfig(key);
        if (!config) return;
        
        const value = uiEngine.readElementValue(key);
        
        // Skip null, undefined, or empty string values
        if (value === null || value === undefined || value === '') return;
        
        // Convert to appropriate type
        let typedValue: string | number = value;
        if (config.type === 'select' && typeof value === 'string') {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            typedValue = numValue;
          }
        }
        
        // Check if this is a section-specific property (contains [])
        if (config.state_path.includes('[]')) {
          // Extract array path and property name
          const [arrayPath, property] = config.state_path.split('[].');
          if (!property) return;
          
          // Determine target section
          const numSections = newComposition.frame_design.number_sections;
          const selectedSection = sceneManager.getSelectedSection();
          
          let targetSection: number;
          if (numSections === 1) {
            targetSection = 0;
          } else if (selectedSection !== null && selectedSection >= 0) {
            targetSection = selectedSection;
          } else {
            targetSection = 0;
          }
          
          // Navigate to the array
          const parts = arrayPath.split('.');
          let current: any = newComposition;
          for (const part of parts) {
            current = current[part];
          }
          
          // Ensure array exists and has entries for all sections
          if (!Array.isArray(current)) {
            console.warn(`[bindUpdateButton] ${arrayPath} is not an array`);
            return;
          }
          
          // Find or create entry for target section
          let sectionEntry = current.find((item: any) => item.section_id === targetSection);
          if (!sectionEntry) {
            sectionEntry = { section_id: targetSection };
            current.push(sectionEntry);
          }
          
          // Update the specific property for this section
          sectionEntry[property] = typedValue;
        } else {
          // Regular property - update normally
          const updated: CompositionStateDTO = uiEngine.setStateValue(newComposition, config.state_path, typedValue) as CompositionStateDTO;
          Object.assign(newComposition, updated);
        }
      });
      
      // Validate slots divisibility
      const slots = newComposition.pattern_settings.number_slots;
      const sections = newComposition.frame_design.number_sections;
      const validSlots = uiEngine.validateSlotsDivisibility(slots, sections);
      
      if (validSlots !== slots) {
        newComposition.pattern_settings.number_slots = validSlots;
        // Update UI
        const slotsEl = uiEngine.getElement('slots') as HTMLInputElement;
        if (slotsEl) {
          slotsEl.value = String(validSlots);
          const displayEl = document.getElementById('slotsValue');
          if (displayEl) displayEl.textContent = String(validSlots);
        }
      }
      
      // Submit to controller and re-render scene
      await controller.handleCompositionUpdate(newComposition);
      
      // Clear selection and fade overlay after update
      if (window.sceneManager) {
        window.sceneManager.clearSelection();
      }
    })();
  });
}

/**
 * Bind Apply to All Sections button
 */
function bindApplyToAllButton(controller: ApplicationController): void {
  const applyAllBtn = document.getElementById('applyToAllSections');
  if (!applyAllBtn) return;
  
  applyAllBtn.addEventListener('click', () => {
    const speciesEl = document.getElementById('woodSpecies') as HTMLSelectElement;
    const grainEl = document.getElementById('grainDirection') as HTMLSelectElement;
    
    if (!speciesEl || !grainEl) return;
    
    const species = speciesEl.value;
    const grain = grainEl.value as 'horizontal' | 'vertical' | 'angled';
    
    // Apply current dropdown values to all sections
    controller.applyToAllSections(species, grain);
  });
}

/**
 * Bind camera reset button
 */
function bindCameraResetButton(
  sceneManager: ReturnType<typeof SceneManager.create>
): void {
  const resetButton = document.getElementById('resetCameraButton');
  if (!resetButton) return;
  
  resetButton.addEventListener('click', () => {
    sceneManager.resetCamera();
  });
}

/**
 * Bind new file upload button
 */
function bindNewFileButton(controller: ApplicationController): void {
  const newFileButton = document.getElementById('newFileButton');
  if (!newFileButton) return;
  
  newFileButton.addEventListener('click', () => {
    // Show confirmation dialog
    const confirmed = confirm(
      'Upload a new audio file?\n\n' +
      'This will clear your current design and return to the upload screen.'
    );
    
    if (confirmed) {
      // Clear localStorage
      localStorage.removeItem('wavedesigner_session');
      
      // Reload page to reset to initial state
      window.location.reload();
    }
  });
}

/**
 * Setup upload interface
 */
function setupUploadInterface(uiEngine: UIEngine, controller: ApplicationController): void {
  const uploadConfig = uiEngine.getUploadConfig();
  if (!uploadConfig) return;
  
  // Create upload interface (stored but not used directly)
  new UploadInterface(uploadConfig.container_id, {
    onFileSelected: (file: File) => {
      // Capture UI snapshot before upload (respects user's pre-upload choices)
      const currentState = controller.getState();
      const uiComposition = captureUISnapshot(uiEngine, currentState.composition);
      
      void controller.dispatch({ 
        type: 'FILE_UPLOADED', 
        payload: { file, uiSnapshot: uiComposition }
      });
    },
    onError: (error: string) => {
      console.error('Upload error:', error);
    }
  }, uiEngine);
}

/**
 * Update conditional UI (e.g., disable n=3 for rectangular)
 */
function updateConditionalUI(uiEngine: UIEngine, composition: CompositionStateDTO): void {
  const currentState: Record<string, string | number> = {
    shape: composition.frame_design.shape,
    sections: composition.frame_design.number_sections,
  };
  
  uiEngine.updateConditionalOptions(currentState);
}

/**
 * Handle phase transitions (upload → visualization)
 */
function handlePhaseTransition(
  uiEngine: UIEngine,
  state: ApplicationState,
  _controller: ApplicationController
): void {
  const uploadConfig = uiEngine.getUploadConfig();
  if (!uploadConfig) return;
  
  const uploadContainer = document.getElementById(uploadConfig.container_id);
  const visualizationContainer = document.getElementById('visualizationContainer');
  
  if (!uploadContainer || !visualizationContainer) return;
  
  const { phase } = state;
  if (phase === 'upload') {
    uploadContainer.classList.add('active');
    visualizationContainer.classList.remove('active');
  } else if (phase === 'discovery' || phase === 'customization') {
    uploadContainer.classList.remove('active');
    visualizationContainer.classList.add('active');
  }
}

/**
 * Handle generic on_change actions from config
 */
function handleOnChangeAction(
  onChangeConfig: { action: string; requires?: string[] },
  uiEngine: UIEngine,
  controller: ApplicationController
): void {
  console.log(`[handleOnChangeAction] Called with action: ${onChangeConfig.action}`);
  
  switch (onChangeConfig.action) {
    case 'update_section_materials':
      console.log('[handleOnChangeAction] Entering update_section_materials case');
      // SceneManager may not be available during initial setup - this is expected
      if (!window.sceneManager) {
        console.log('[handleOnChangeAction] SceneManager not available, returning');
        return;
      }
      console.log('[handleOnChangeAction] Calling handleUpdateSectionMaterials');
      handleUpdateSectionMaterials(onChangeConfig, uiEngine, controller, window.sceneManager);
      break;
    default:
      console.warn(`[main.ts] Unknown on_change action: ${onChangeConfig.action}`);
  }
}

/**
 * Handle update_section_materials action (wood species/grain changes)
 */
function handleUpdateSectionMaterials(
  onChangeConfig: { action: string; requires?: string[] },
  uiEngine: UIEngine,
  controller: ApplicationController,
  sceneManager: ReturnType<typeof SceneManager.create>
): void {
  console.log('[handleUpdateSectionMaterials] CALLED');
  
  if (!onChangeConfig.requires || onChangeConfig.requires.length < 2) {
    console.warn('[handleUpdateSectionMaterials] Missing required parameters');
    return;
  }
  
  // Get required element values from config
  const values: Record<string, string> = {};
  for (const key of onChangeConfig.requires) {
    const element = uiEngine.getElement(key);
    if (!element) {
      console.warn(`[handleUpdateSectionMaterials] Element not found: ${key}`);
      return;
    }
    values[key] = (element as HTMLSelectElement).value;
  }
  
  // Use the first two required params as species and grain (order from config)
  const [speciesKey, grainKey] = onChangeConfig.requires;
  const species = values[speciesKey];
  const grain = values[grainKey];
  
  if (!species || !grain) {
    console.warn('[handleUpdateSectionMaterials] Missing values:', { species, grain });
    return;
  }
  
  const currentState = controller.getState();
  const numSections = currentState.composition.frame_design.number_sections;
  const selectedSection = sceneManager.getSelectedSection();
  
  console.log(`[handleUpdateSectionMaterials] Selected section: ${selectedSection}, numSections: ${numSections}, species: ${species}, grain: ${grain}`);
  
  if (numSections === 1) {
    console.log('[handleUpdateSectionMaterials] Updating section 0 only (n=1)');
    controller.updateSectionMaterial(0, species, grain);
  } else if (selectedSection !== null && selectedSection >= 0) {
    console.log(`[handleUpdateSectionMaterials] Updating ONLY selected section ${selectedSection}`);
    controller.updateSectionMaterial(selectedSection, species, grain);
  } else {
    // When n>1 and no section selected, default to section 0 only
    console.log(`[handleUpdateSectionMaterials] No selection - defaulting to section 0`);
    controller.updateSectionMaterial(0, species, grain);
  }
}