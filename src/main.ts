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
  EasingFunction,
  Layer
} from '@babylonjs/core';
import * as BABYLON from '@babylonjs/core';
import { GLTFFileLoader } from '@babylonjs/loaders/glTF';
import '@babylonjs/loaders/glTF/2.0';
(window as Window & { BJS_CORE?: typeof BABYLON }).BJS_CORE = BABYLON; // Expose Babylon core for console diagnostics

import { ApplicationController } from './ApplicationController';
import { AudioCacheService } from './AudioCacheService';
import { FrameGenerationService } from './FrameGenerationService';
import { PerformanceMonitor } from './PerformanceMonitor';
import { ProcessingOverlay } from './ProcessingOverlay';
import { TextureCacheService } from './TextureCacheService';
import { type ApplicationState, type CSGDataResponse, type SmartCsgResponse, type WoodMaterialsConfig, CompositionStateDTO } from './types/schemas';
import { UIEngine } from './UIEngine';
import { UploadInterface } from './UploadInterface';
import { WaveformDesignerFacade } from './WaveformDesignerFacade';
import { WoodMaterial } from './WoodMaterial';
import { DemoPlayer } from './demo/DemoPlayer';
import { ConfirmModal } from './components/ConfirmModal';
import { TourModal } from './components/TourModal';



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
  const angleOrKey = directionAngles[direction];

  // Case 1: Direct numeric angle (e.g., "horizontal": 0)
  if (typeof angleOrKey === 'number') {
    // CRITICAL: Box UVs are rotated 90° relative to cylinder UVs
    // For rectangular: horizontal should be 90°, vertical should be 0°
    // For circular/diamond: horizontal is 0°, vertical is 90° (as configured)
    const csgDataWrapper = window.sceneManager?.getCurrentCSGData();
        if (csgDataWrapper?.csg_data?.panel_config?.shape === 'rectangular') {
          return (angleOrKey + 90) % 360;
        }
    return angleOrKey;
  }

  // Case 2: String-based key for lookup
  if (typeof angleOrKey === 'string') {
    let anglesKey = '';
    
    if (angleOrKey.startsWith('use_section_positioning_')) {
      // Handles "use_section_positioning_4_radiant", etc.
      anglesKey = angleOrKey.substring('use_section_positioning_'.length);
    } else if (angleOrKey === 'use_section_positioning') {
      // For radiant: n=1,2,3 use "1","2","3" but n=4 uses "4_radiant"
      anglesKey = numberSections === 4 ? '4_radiant' : String(numberSections);
    }
    
    if (anglesKey) {
      const angles = config.geometry_constants.section_positioning_angles[anglesKey];
      if (angles && typeof angles[sectionId] === 'number') {
        // CRITICAL: Box UVs are rotated 90° relative to cylinder UVs
        // Apply same offset for radiant/diamond on rectangular panels
        const csgDataWrapper = window.sceneManager?.getCurrentCSGData();
        if (csgDataWrapper?.csg_data?.panel_config?.shape === 'rectangular') {
          return (angles[sectionId] + 90) % 360;
        }
        return angles[sectionId];
      }
    }
  }
  
  // Final fallback if nothing else matches
  console.warn(`[main.ts] No angle found for direction "${direction}", section ${sectionId}, n=${numberSections}`);
  return 0;
}

declare global {
  interface Window {
    sceneManager?: SceneManager;
    controller?: ApplicationController;
    audioCache?: AudioCacheService;
    calculateGrainAngle?: typeof calculateGrainAngle;
    updateGrainDirectionOptionsFromController?: (newN: number) => void;
    _uiEngineInstance?: UIEngine;
    uiEngine?: UIEngine;
    demoPlayer?: DemoPlayer;
    __controller__?: ApplicationController;
  }
}

// Export calculateGrainAngle for debugging and controller access
window.calculateGrainAngle = calculateGrainAngle;

/**
 * Make updateGrainDirectionOptions globally accessible for ApplicationController
 */
window.updateGrainDirectionOptionsFromController = (newN: number) => {
  // This will be set after UIEngine is initialized
  if (window._uiEngineInstance) {
    updateGrainDirectionOptions(window._uiEngineInstance, newN);
  }
};

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
	private _selectedSectionIndices: Set<number> = new Set();
  private _rootNode: TransformNode | null = null;
	private _currentCSGData: SmartCsgResponse | null = null;  // Store CSG data for overlay positioning
	private _overlayMeshes: Map<number, Mesh> = new Map();
	private _backgroundLayer: Layer | null = null;
	private _cameraOffset: number = 0;
  private _isDesktopLayout: boolean = true;
  private _hasPlayedPulseAnimation: boolean = false;
  private _renderQueue: Promise<void> = Promise.resolve();
  private _isRendering = false;
  private _isInteractionSetup: boolean = false;

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

    // Setup background
    this.setupBackground(); // COMMENT OUT TO NOT USE IMAGE BACKGROUND

    // Initial layout check
    this.checkLayoutMode();
    this.updateCameraOffset();

    // Register GLTF loader
    if (!GLTFFileLoader) {
      console.error('GLTF loader not available');
    }
		
		// Handle window resize
    window.addEventListener('resize', () => {
      this._engine.resize();
      this.checkLayoutMode();
      this.updateCameraOffset();
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
    manager._camera.setTarget(new Vector3(manager._cameraOffset, 0, 0));
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
    this._scene.clearColor = new Color3(0.90, 0.88, 0.86).toColor4();
    
    // Create a neutral environment color for PBR reflections
    this._scene.ambientColor = new Color3(0.2, 0.2, 0.2);
    this._scene.environmentColor = new Color3(0.8, 0.8, 0.8);
  }
	
	private setupBackground(): void {
    // Use Layer for 2D background image (standard Babylon.js approach)
    this._backgroundLayer = new Layer(
      'backgroundLayer',
      '/assets/backgrounds/stucco.jpg',
      this._scene,
      true
    );
  }
	
	private checkLayoutMode(): void {
    const DESKTOP_BREAKPOINT = 768;
    this._isDesktopLayout = window.innerWidth >= DESKTOP_BREAKPOINT;
  }
	
	public updateCameraOffset(): void {
    if (!this._isDesktopLayout) {
      // Mobile: no horizontal offset
      this._cameraOffset = 0;
      this._camera.target.x = 0;
      return;
    }
    
    // Desktop: calculate offset based on visible panel widths
    const leftMainPanel = document.getElementById('left-main-panel');
    const _leftSecondaryPanel = document.getElementById('left-secondary-panel');
    const _rightSecondaryPanel = document.getElementById('right-secondary-panel');
    const rightMainPanel = document.getElementById('right-main-panel');
    
    // Calculate left side width (main panel only)
    let leftWidth = 0;
    if (leftMainPanel && window.getComputedStyle(leftMainPanel).display !== 'none') {
      leftWidth += leftMainPanel.offsetWidth + 16; // Include gap
    }
    
    // Calculate right side width (main panel only)
    let rightWidth = 0;
    if (rightMainPanel && window.getComputedStyle(rightMainPanel).display !== 'none') {
      rightWidth += rightMainPanel.offsetWidth + 16;
    }
    
    // Calculate offset in pixels (positive = shift right, negative = shift left)
    const offsetPixels = (leftWidth - rightWidth) / 1;
    
    // Convert pixels to scene units
    // Camera FOV affects visible width at a given distance
    const distance = this._camera.radius;
    const fov = this._camera.fov || 0.8;
    const canvasWidth = this._canvas.width;
    const visibleWidth = 2 * distance * Math.tan(fov / 2);
    const pixelsPerUnit = canvasWidth / visibleWidth;
    const offsetUnits = offsetPixels / pixelsPerUnit;
    
    // Apply offset to camera target
    this._cameraOffset = offsetUnits;
    this._camera.target.x = this._cameraOffset;
		
		// ALSO apply the pixel offset to the bottom controls container
    const controlsContainer = document.querySelector('.ui-controls-bottom-center') as HTMLElement;
    if (controlsContainer) {
      // We use the pixel offset directly for CSS transforms
      controlsContainer.style.transform = `translateX(calc(-50% + ${offsetPixels / 2}px))`;
    }
  }

  /**
   * Preload default wood textures on page load (before audio upload)
   * This ensures instant rendering when user uploads audio
   */
  public preloadDefaultTextures(config: WoodMaterialsConfig): void {
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
      
      // Load and cache textures (they'll be in cache when user uploads audio)
      this._textureCache.getTexture(albedoPath);
      this._textureCache.getTexture(normalPath);
      this._textureCache.getTexture(roughnessPath);
    });
  }

  public renderComposition(csgData: SmartCsgResponse): Promise<void> {
    void (this._renderQueue = this._renderQueue.then(
      () => {
        if (this._isRendering) {
          console.warn('Render already in progress, skipping.');
          return;
        }
        
        this._isRendering = true;
        try {
          this._renderCompositionInternal(csgData);
        } finally {
          this._isRendering = false;
        }
      }
    ));
    
    return this._renderQueue;
  }

  private _renderCompositionInternal(csgData: SmartCsgResponse): void {
    PerformanceMonitor.start('render_internal_total');
		
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
		
    try {
      PerformanceMonitor.start('csg_mesh_generation');
      
      // Get array of meshes from frame service
      const frameService = new FrameGenerationService(this._scene);
      const meshes = frameService.createFrameMeshes(csgData.csg_data);

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
      
      // Play pulse animation once after initial render
      this.pulseAllSections();
			
			// Notify the demo player that the render is complete
      document.dispatchEvent(new CustomEvent('demo:renderComplete'));
			
			// Auto-fit camera to new geometry
      const idealRadius = this.calculateIdealRadius();
      this._camera.radius = idealRadius;
      
      // Setup interaction
      this.setupSectionInteraction();

      // Conditionally enable selection UI for multi-section layouts
      const sectionIndicator = document.getElementById('sectionIndicator');
      if (this._sectionMeshes.length > 1) {
			if (sectionIndicator) sectionIndicator.style.display = 'flex';
			
			// ONLY auto-select on first render
			if (this._isFirstRender) {
				this._selectedSectionIndices.clear();
				for (let i = 0; i < this._sectionMeshes.length; i++) {
					this._selectedSectionIndices.add(i);
				}
				
				this._overlayMeshes.clear();
				this._selectedSectionIndices.forEach(index => {
					const overlay = this.createCircularOverlay(index);
					if (overlay) {
						this._overlayMeshes.set(index, overlay);
					}
				});
				
				this._isFirstRender = false;
			} else {
				// On subsequent renders, clear selection
				this.clearSelection();
			}
			
			this._createSectionChipsUI(this._sectionMeshes.length);
			this.updateSectionUI(this._selectedSectionIndices);
		} else {
        // For n=1, hide the selection UI and clear any selection state
        if (sectionIndicator) sectionIndicator.style.display = 'none';
        this.clearSelection();
      }

    } catch (error: unknown) {
      console.error('[POC] CSG mesh generation failed:', error);
    }
  }
	
	public getSelectedSections(): Set<number> {
    return this._selectedSectionIndices;
  }
	
	public clearSelection(): void {
    this._overlayMeshes.forEach(overlay => this._fadeOutAndDispose(overlay));
    this._overlayMeshes.clear();
    this._selectedSectionIndices.clear();
  }
  
  public getCurrentCSGData(): SmartCsgResponse | null {
    return this._currentCSGData ?? null;
  }
  
  private setupSectionInteraction(): void {
    // CRITICAL: Only set up interaction once to prevent duplicate event listeners
    if (this._isInteractionSetup) {
      return;
    }
    
    this._isInteractionSetup = true;
    
    this._canvas.addEventListener('pointerdown', (evt: PointerEvent) => {
      const pickResult = this._scene.pick(
        this._scene.pointerX,
        this._scene.pointerY
      );
      
      if (pickResult.hit && pickResult.pickedMesh) {
        // Extract section_id from mesh name (format: "section_N")
        const meshName = pickResult.pickedMesh.name;
        const match = meshName.match(/^section_(\d+)$/);
        
        if (this._sectionMeshes.length > 1 && match) {
          const sectionId = parseInt(match[1], 10);
          
          // Check for multi-select modifier key from the native browser event
          const multiSelect = evt.ctrlKey || evt.metaKey;
          
          // Check if we're single-clicking the only item that is already selected
          const isDeselectingSingle = !multiSelect && this._selectedSectionIndices.size === 1 && this._selectedSectionIndices.has(sectionId);

          // Clear selection ONLY IF it's a standard single click on a NEW item,
          // but NOT if we're trying to deselect the only selected item.
          if (!multiSelect && !isDeselectingSingle) {
            this.clearSelection();
          }

          // Now, the toggle will work as expected in all cases.
          this.toggleSection(sectionId);
          
          // Notify controller of the new selection state
          if (window.controller) {
            // The controller's selectSection now just syncs state
            window.controller.selectSection(this._selectedSectionIndices);
          }
          
          // Update UI to show selected section(s)
          this.updateSectionUI(this._selectedSectionIndices);
        }
      } else {
        // "Click away" logic: nothing was hit, so deselect all.
        this.clearSelection();
        if (window.controller) {
          window.controller.selectSection(this._selectedSectionIndices);
        }
        this.updateSectionUI(this._selectedSectionIndices);
      }
    });
  }
  
  private selectSection(index: number): void {
    // Clear all existing selections
    this.clearSelection();
    
    // Add the new selection
    this._selectedSectionIndices.add(index);
    
    // Create overlay for the newly selected section
    if (this._sectionMeshes[index]) {
      const overlay = this.createCircularOverlay(index);
      if (overlay) {
        this._overlayMeshes.set(index, overlay);
      }
    }
  }

  public toggleSection(index: number): void {
    if (this._selectedSectionIndices.has(index)) {
      // Deselect: Remove from set and fade out overlay
      this._selectedSectionIndices.delete(index);
      const overlay = this._overlayMeshes.get(index);
      if (overlay) {
        this._fadeOutAndDispose(overlay);
        this._overlayMeshes.delete(index);
      }
    } else {
      // Select: Add to set and create new overlay
      this._selectedSectionIndices.add(index);
      if (this._sectionMeshes[index]) {
        const overlay = this.createCircularOverlay(index);
        if (overlay) {
          this._overlayMeshes.set(index, overlay);
        }
      }
    }
  }
	
	private pulseAllSections(): void {
    if (this._hasPlayedPulseAnimation) return;
    if (!this._currentCSGData?.csg_data || !window.controller) return;
    
    const csgData = this._currentCSGData.csg_data;
    if (csgData.panel_config.number_sections <= 1) return;
    
    const config = window.controller.getWoodMaterialsConfig();
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
    const _localCenters = (numSections !== 3 && numSections !== 1) 
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
        
        if (!localCenter || bifurcationAngle === undefined) return;
        
        // Calculate position along bifurcation ray at 60% of min_radius
        const distanceFromCenter = minRadius * 0.6;
        const angleRad = (bifurcationAngle * Math.PI) / 180;
        
        // Convert from CNC coordinates to Babylon coordinates
				const cncCenterX = csgData.panel_config.finish_x / 2.0;
				const cncCenterY = csgData.panel_config.finish_y / 2.0;
				const localCenterBabylon = {
					x: localCenter[0] - cncCenterX,
					z: localCenter[1] - cncCenterY
				};
        
        // Calculate COMPLETE position in pre-bake space
        let xPos = localCenterBabylon.x + distanceFromCenter * Math.cos(angleRad);
        let zPos = localCenterBabylon.z + distanceFromCenter * Math.sin(angleRad);
        
        // THEN apply transformation to the complete position.
        // The y-axis rotation bake flips the coordinate system. We must negate
        // the final coordinates to place the dot in the correct visual location.
        if (numSections !== 1) {
          xPos = -xPos;
          zPos = -zPos;
        }
        
        const center = boundingInfo.boundingBox.center;
        const yPos = center.y + 2;
        
        // The static dot is now created on initial render.
        // This function now only creates the temporary pulsing rings around it.
        
        // Create 2 pulsing rings that grow and fade
        for (let pulseNum = 0; pulseNum < 2; pulseNum++) {
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
						
            // CRITICAL: Disable picking on pulse rings so they don't block section clicks
            ring.isPickable = false;						
            
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
        
      }, index * 3100); // Start next section after previous completes all pulses
    });
		
		// Calculate total animation duration for all sections
    const totalDuration = (numSections * 3100); // Last section animation + buffer
    
    // Clear selection after all pulse animations complete
    setTimeout(() => {
      this.clearSelection();
      if (window.controller) {
        window.controller.selectSection(this._selectedSectionIndices);
      }
      this.updateSectionUI(this._selectedSectionIndices);
    }, totalDuration);
    
    this._hasPlayedPulseAnimation = true;
  }
  
  private _fadeOutAndDispose(overlay: Mesh): void {
    const material = overlay.material as StandardMaterial;
    if (!material) {
      overlay.dispose();
      return;
    }
    
    const fadeAnimation = new Animation(
      'overlayFade',
      'alpha',
      60,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    
    fadeAnimation.setKeys([
      { frame: 0, value: material.alpha },
      { frame: 18, value: 0 }
    ]);
    
    material.animations = [fadeAnimation];
    
    const animatable = this._scene.beginAnimation(material, 0, 18, false);
    
    animatable.onAnimationEnd = () => {
      overlay.dispose();
    };
  }
  
  private createCircularOverlay(index: number): Mesh | null {
    const mesh = this._sectionMeshes[index];
    if (!mesh || !this._currentCSGData || !window.controller) return null;
    
    // Note: Disposing of existing overlays is now handled by selectSection/toggleSection
    
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
    
    // Get section bounding info for sizing
    const boundingInfo = mesh.getBoundingInfo();
    const size = boundingInfo.boundingBox.extendSize;
    const maxDimension = Math.max(size.x, size.z);
    const overlayRadius = maxDimension * 0.05; // 5% of section size
    
    // Create circular plane mesh with a unique name
    const overlay = MeshBuilder.CreateDisc(
      `selectionOverlay_${index}`,
      { radius: overlayRadius, tessellation: 32 },
      this._scene
    );
    
    // Use local center from backend geometry data
    const localCenter = csgData.section_local_centers[index];
    const bifurcationAngle = bifurcationAngles[index];
    const minRadius = csgData.true_min_radius;
    
    if (!localCenter || bifurcationAngle === undefined) return null;
    
    // Calculate position along bifurcation ray at 60% of min_radius
    const distanceFromCenter = minRadius * 0.6;
    const angleRad = (bifurcationAngle * Math.PI) / 180;
    
		// Convert from CNC coordinates to Babylon coordinates
    const CNC_CENTER_X = csgData.panel_config.finish_x / 2.0;
    const CNC_CENTER_Y = csgData.panel_config.finish_y / 2.0;
    const localCenterBabylon = {
      x: localCenter[0] - CNC_CENTER_X,
      z: localCenter[1] - CNC_CENTER_Y
    };
    
    // Calculate COMPLETE position in pre-bake space
    let xPos = localCenterBabylon.x + distanceFromCenter * Math.cos(angleRad);
    let zPos = localCenterBabylon.z + distanceFromCenter * Math.sin(angleRad);
    
    // THEN apply transformation to the complete position.
    // The y-axis rotation bake flips the coordinate system. We must negate
    // the final coordinates to place the dot in the correct visual location.
    if (numSections !== 1) {
      xPos = -xPos;
      zPos = -zPos;
    }
    
    const center = boundingInfo.boundingBox.center;
    
    // Position overlay on bifurcation ray, well above surface to avoid z-fighting
    overlay.position = new Vector3(xPos, center.y + 2, zPos);
    
    // Force overlay to render on top
    overlay.renderingGroupId = 1;
    overlay.rotation.x = Math.PI / 2; // Rotate to face upward
    
    // Create semi-transparent white material
    const overlayMat = new StandardMaterial(`overlayMat_${index}`, this._scene);
    overlayMat.diffuseColor = new Color3(1, 1, 1);
    overlayMat.alpha = 0.7;
    overlayMat.emissiveColor = new Color3(0.3, 0.3, 0.3); // Slight glow for visibility
    overlayMat.backFaceCulling = false;
    
    overlay.material = overlayMat;
    overlay.parent = this._rootNode;
    
    // CRITICAL: Disable picking on overlay so clicks pass through to section mesh
    overlay.isPickable = false;

    return overlay;
  }
  
  private updateSectionUI(indices: Set<number>): void {
    const sectionIndicator = document.getElementById('sectionIndicator');
    const speciesEl = document.getElementById('woodSpecies') as HTMLSelectElement;
    const grainEl = document.getElementById('grainDirection') as HTMLSelectElement;
  
    if (!sectionIndicator || !speciesEl || !grainEl || !window.controller) return;
  
    // Update chip visuals
    const chips = document.querySelectorAll('.section-chip');
    chips.forEach(chip => {
      const chipId = parseInt((chip as HTMLElement).dataset.sectionId ?? '-1', 10);
      chip.classList.toggle('active', indices.has(chipId));
    });
  
    // Update "Select All" checkbox state
    const selectAllCheckbox = document.getElementById('selectAllCheckbox') as HTMLInputElement;
    if (selectAllCheckbox) {
      const numSections = this._sectionMeshes.length;
      if (numSections > 0 && indices.size === numSections) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
      } else if (indices.size > 0 && indices.size < numSections) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true; // Shows a dash for partial selection
      } else { // indices.size is 0
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
      }
    }

    // Update control panel for material dropdowns
    const state = window.controller.getState();
    const materials = state.composition.frame_design.section_materials || [];
    const config = window.controller.getWoodMaterialsConfig();
  
    if (indices.size === 0) {
      // No sections selected - leave dropdowns unchanged
    } else if (indices.size === 1) {
      const index = indices.values().next().value as number;
      const sectionMaterial = materials.find(m => m.section_id === index);
      speciesEl.value = sectionMaterial?.species || config.default_species;
      grainEl.value = sectionMaterial?.grain_direction || config.default_grain_direction;
    } else { // Multiple sections selected
      const selectedMaterials = Array.from(indices).map(id => materials.find(m => m.section_id === id));
      const firstSpecies = selectedMaterials[0]?.species || config.default_species;
      const firstGrain = selectedMaterials[0]?.grain_direction || config.default_grain_direction;
  
      const allSpeciesSame = selectedMaterials.every(m => (m?.species || config.default_species) === firstSpecies);
      const allGrainsSame = selectedMaterials.every(m => (m?.grain_direction || config.default_grain_direction) === firstGrain);
  
      speciesEl.value = allSpeciesSame ? firstSpecies : ''; // Empty value indicates "Mixed"
      grainEl.value = allGrainsSame ? firstGrain : '';
    }
  }
	
	private _createSectionChipsUI(numSections: number): void {
    const container = document.getElementById('sectionChipContainer');
    if (!container) return;

    // Clear existing chips
    container.innerHTML = '';

    for (let i = 0; i < numSections; i++) {
      const chip = document.createElement('button');
      chip.className = 'section-chip';
      chip.textContent = `${i + 1}`;
      chip.dataset.sectionId = String(i);

      chip.addEventListener('click', () => {
        // Toggle selection logic
        this.toggleSection(i);
        // Update the UI to reflect the change
        this.updateSectionUI(this._selectedSectionIndices);
        // Notify the controller of the new selection state
        if (window.controller) {
          window.controller.selectSection(this._selectedSectionIndices);
        }
      });

      container.appendChild(chip);
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
    
    for (let index = 0; index < this._sectionMeshes.length; index++) {
      const mesh = this._sectionMeshes[index];

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
      mesh.material = material;
      mesh.parent = this._rootNode;
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
	
	public toggleZoom(zoomIn: boolean): void {
    // Calculate target based on current radius and zoom direction
    let targetRadius: number;
    const currentRadius = this._camera.radius;
    
    if (zoomIn) {
      // Zoom in: divide by 2 (more aggressive - two clicks gets to 25% of original)
      targetRadius = currentRadius / 2;
      // Clamp to minimum
      if (targetRadius < this._camera.lowerRadiusLimit) {
        targetRadius = this._camera.lowerRadiusLimit;
      }
    } else {
      // Zoom out: multiply by 2 (two clicks returns to original)
      targetRadius = currentRadius * 2;
      // Clamp to maximum
      if (targetRadius > this._camera.upperRadiusLimit) {
        targetRadius = this._camera.upperRadiusLimit;
      }
    }
    
    const duration = 800;
    const fps = 60;
    
    const animRadius = new Animation(
      'radiusAnim', 'radius', fps,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    
    animRadius.setKeys([
      { frame: 0, value: currentRadius },
      { frame: (duration / 1000) * fps, value: targetRadius }
    ]);
    
    this._camera.animations = [animRadius];
    this._scene.beginAnimation(this._camera, 0, (duration / 1000) * fps, false);
  }
	
	/**
   * Calculate ideal camera radius based on mesh bounding box
   */
  private calculateIdealRadius(): number {
    if (!this._rootNode) return 47; // Fallback to default
    
    // Get bounding info of all meshes under root node
    const childMeshes = this._rootNode.getChildMeshes();
    if (childMeshes.length === 0) return 47;
    
    // Calculate combined bounding box
    let min = new Vector3(Infinity, Infinity, Infinity);
    let max = new Vector3(-Infinity, -Infinity, -Infinity);
    
    childMeshes.forEach(mesh => {
      const boundingInfo = mesh.getBoundingInfo();
      const meshMin = boundingInfo.boundingBox.minimumWorld;
      const meshMax = boundingInfo.boundingBox.maximumWorld;
      
      min = Vector3.Minimize(min, meshMin);
      max = Vector3.Maximize(max, meshMax);
    });
    
    // Calculate diagonal of bounding box
    const size = max.subtract(min);
    const diagonal = size.length();
    
    // Return radius with comfortable margin (1.5x diagonal)
    return diagonal * 1.5;
  }
	
	public startCinematicRotation(onAnimationEnd?: () => void): void {
    const duration = 10000; // 10 seconds for a slow, cinematic feel
    const fps = 60;
    const totalFrames = (duration / 1000) * fps;

    const animAlpha = new Animation(
      'cinematicAlpha', 'alpha', fps,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT // Don't loop
    );

    animAlpha.setKeys([
      { frame: 0, value: this._camera.alpha },
      { frame: totalFrames, value: this._camera.alpha + (2 * Math.PI) }
    ]);
    
    // Apply easing for a smoother start and end
    const easingFunction = new CubicEase();
    easingFunction.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    animAlpha.setEasingFunction(easingFunction);

    this._camera.animations = [animAlpha];
    const animatable = this._scene.beginAnimation(this._camera, 0, totalFrames, false); // `false` to not loop

    if (onAnimationEnd) {
      animatable.onAnimationEnd = onAnimationEnd;
    }
  }
  
  public resetCamera(): void {
    // Target values
    const targetAlpha = Math.PI / 2;
    const targetBeta = Math.PI / 2;
    const targetRadius = this.calculateIdealRadius();
    const targetPosition = new Vector3(this._cameraOffset, 0, 0);
    
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
	
	public updateComposition(_newState: CompositionStateDTO): void {
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
    // await this.renderComposition(_newState); // Type error: parameter is not SmartCsgResponse
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('[MAIN] DOMContentLoaded fired');
  void (async () => {
    try {
      console.log('[MAIN] Step 1: Creating UIEngine...');
      const uiEngine = new UIEngine();
      console.log('[MAIN] Step 2: Loading UIEngine config...');
      await uiEngine.loadConfig();
      console.log('[MAIN] Step 3: UIEngine loaded successfully');
			
			// Make UIEngine accessible for grain direction updates from controller
      window._uiEngineInstance = uiEngine;
      window.uiEngine = uiEngine;
      console.log('[MAIN] Step 4: UIEngine attached to window');
      
      console.log('[MAIN] Step 5: Creating facade...');
      const facade = new WaveformDesignerFacade();
      console.log('[MAIN] Step 6: Creating controller...');
      const controller = new ApplicationController(facade);
			window.controller = controller;
      window.audioCache = controller.audioCache;
      console.log('[MAIN] Step 7: Starting controller.initialize()...');
      await controller.initialize();
      console.log('[MAIN] Step 8: Controller initialized!');
			
			window.__controller__ = controller;
      
      console.log('[MAIN] Step 9: Creating scene manager...');
      const sceneManager = SceneManager.create('renderCanvas', facade);
      window.sceneManager = sceneManager;
      console.log('[MAIN] Step 10: Scene manager created');
      
      controller.registerSceneManager(sceneManager);
      
      try {
        const woodConfig = controller.getWoodMaterialsConfig();
        sceneManager.preloadDefaultTextures(woodConfig);
      } catch (error: unknown) {
        console.warn('[main.ts] Could not preload textures - config not loaded yet:', error);
      }
      
      console.log('[MAIN] Step 11: Starting initializeUI...');
      await initializeUI(uiEngine, controller, sceneManager);
      console.log('[MAIN] Step 12: UI initialized!');
			
			// Initialize tour modal (first-visit onboarding)
      if (TourModal.shouldShow()) {
        const tourModal = new TourModal(
          () => {
            // Start tour callback
            const demoPlayer = window.demoPlayer;
            if (demoPlayer) {
              demoPlayer.start();
            }
          },
          () => {
            // Dismiss callback (no action needed)
          }
        );
        tourModal.show();
      }
      
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
      
      console.log('[MAIN] === INITIALIZATION COMPLETE ===');
      
    } catch (error: unknown) {
      console.error('[MAIN] === INITIALIZATION FAILED ===');
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
  
  // 5b. Bind zoom toggle button
  bindZoomToggleButton(sceneManager);
  
  // 6. Bind new file upload button
  bindNewFileButton(controller);
	
  // 6a. Subscribe to state changes to keep UI elements in sync
  controller.subscribe((newState) => {
    console.log('[main.ts] State updated, syncing all UI elements.');
    // This function will now run every time the state changes.
    syncUIFromState(uiEngine, newState.composition);
    
    // It's also important to re-run conditional logic after a state sync.
    updateConditionalUI(uiEngine, newState.composition);
  });	
  
  // 7. Bind select all checkbox
  bindSelectAllCheckbox(controller, sceneManager);
	
	// 7b. Bind start tour button
  bindStartTourButton(uiEngine, controller, sceneManager);
  
  // 8. Setup upload interface
  setupUploadInterface(uiEngine, controller);
  
  // 9. Initialize processing overlay
  new ProcessingOverlay('processingOverlay', controller);
	
	// 9.5 Initialize left panel renderer
  const { LeftPanelRenderer } = await import('./components/LeftPanelRenderer');
  const leftPanelRenderer = new LeftPanelRenderer(
    'left-main-panel',
    (categoryId) => controller.handleCategorySelected(categoryId)
  );
  leftPanelRenderer.render();
  
  // 9.6 Restore UI from persisted state (must happen after buttons rendered)
  controller.restoreUIFromState();
  
  // 10. Subscribe to state changes (only sync UI on phase transitions, not every change)
  controller.subscribe((state) => {
    handlePhaseTransition(uiEngine, state, controller);
  });
  
  // 11. Initial phase transition (only if restoring non-upload phase)
  if (initialState.phase !== 'upload') {
    handlePhaseTransition(uiEngine, initialState, controller);
  }
  
  // 12. Initial conditional logic (like disabling n=3 for rectangular)
  updateConditionalUI(uiEngine, initialState.composition);
	
	// 13. Ensure all sections options are visible (fix n=3 regression)
  ensureSectionsOptionsVisible();
}

/**
 * Sync all UI elements from composition state
 */
function syncUIFromState(uiEngine: UIEngine, composition: CompositionStateDTO): void {
  const elementKeys = uiEngine.getElementKeys();
  
  elementKeys.forEach(key => {
    const config = uiEngine.getElementConfig(key);
    if (!config) return;
    
    const value = uiEngine.getStateValue(composition, config.state_path) as string | number | null | undefined;
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
      continue; // Skip setStateValue - both dimensions already set
    }
		
		if (key === 'woodSpecies' || key === 'grainDirection') {
			// Skip - materials are handled by bindUpdateButton's section-specific logic
			continue;
		}
				
				// UIEngine.setStateValue returns updated composition
				const updated: CompositionStateDTO = uiEngine.setStateValue(composition, config.state_path, value) as CompositionStateDTO;
				Object.assign(composition, updated);
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
        updateGrainDirectionOptions(uiEngine, sections);
        
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
        
        // Read current UI values, not state
				const shapeEl = uiEngine.getElement('shape') as HTMLSelectElement;
				const finishXEl = uiEngine.getElement('width') || uiEngine.getElement('size');
				const updatedState = {
					shape: shapeEl?.value || 'circular',
					number_sections: sections,
					finish_x: finishXEl ? parseFloat((finishXEl as HTMLSelectElement).value) : 36
				};
				updateConditionalUI(uiEngine, updatedState);
      });
    }
    
    // Generic behavior: shape updates conditional options and element visibility
    if (key === 'shape') {
      element.addEventListener('change', () => {
        const shapeValue = (element as HTMLSelectElement).value;
        const currentState = controller.getState();
        const currentComposition = currentState.composition;

        // Create a snapshot of the current UI state to pass to the update function
        const updatedState: { shape: string; number_sections: number; finish_x: number } = {
          shape: shapeValue,
          number_sections: currentComposition.frame_design.number_sections,
          finish_x: currentComposition.frame_design.finish_x,
        };
        
        // Update conditional UI based on the new shape
        updateConditionalUI(uiEngine, updatedState);
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
      element.addEventListener('change', () => {
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
			
			// Preserve checkbox state during update
      const checkbox = document.getElementById('selectAllCheckbox') as HTMLInputElement;
      const _preservedCheckboxState = checkbox ? {
        checked: checkbox.checked,
        indeterminate: checkbox.indeterminate
      } : null;
      const currentState = controller.getState();
      
      // CRITICAL FIX: Use captureUISnapshot to properly read section_materials from UI dropdowns
      const newComposition: CompositionStateDTO = captureUISnapshot(uiEngine, currentState.composition);
      
      // Read all element values and update composition (skip empty/invalid values)
      const elementKeys = uiEngine.getElementKeys();
      elementKeys.forEach(key => {
        const config = uiEngine.getElementConfig(key);
        if (!config) return;
        
        // CRITICAL: Skip elements that are hidden by show_when conditions
        if (config.show_when) {
          const shouldShow = Object.entries(config.show_when).every(([stateKey, allowedValues]) => {
            const currentValue = newComposition.frame_design[stateKey as keyof typeof newComposition.frame_design];
            return allowedValues.includes(currentValue);
          });
          if (!shouldShow) {
            return;
          }
        }
        
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
        
        // CRITICAL: Special handling for size - sets both finish_x AND finish_y
        if (key === 'size') {
          newComposition.frame_design.finish_x = typedValue as number;
          newComposition.frame_design.finish_y = typedValue as number;
          return; // Skip normal setStateValue processing
        }
        
        // Check if this is a section-specific property (contains [])
        if (config.state_path.includes('[]')) {
          // Extract array path and property name
          const [arrayPath, property] = config.state_path.split('[].');
          if (!property) return;
          
          // Determine target sections
          const selectedSections = sceneManager.getSelectedSections();
          
          // If no sections are selected, default to updating all.
          // Otherwise, only update the selected ones.
          const targetSections: number[] = selectedSections.size > 0
            ? Array.from(selectedSections)
            : Array.from({ length: newComposition.frame_design.number_sections }, (_, i) => i);
          
          // Navigate to the array
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
          const parts = arrayPath.split('.');
          let current: Record<string, unknown> = newComposition as Record<string, unknown>;
          for (const part of parts) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            current = current[part] as Record<string, unknown>;
          }
          
          // Ensure array exists and has entries for all sections
          if (!Array.isArray(current)) {
            console.warn(`[bindUpdateButton] ${arrayPath} is not an array`);
            return;
          }
          
          // Update the property for all target sections
          targetSections.forEach(targetId => {
            let sectionEntry = Array.isArray(current) 
              ? current.find((item: unknown): item is Record<string, unknown> => 
                  typeof item === 'object' && item !== null && 
                  'section_id' in item && (item as Record<string, unknown>).section_id === targetId
                )
              : undefined;
            if (!sectionEntry) {
              sectionEntry = { section_id: targetId };
              if (Array.isArray(current)) {
                current.push(sectionEntry);
              }
            }
            if (sectionEntry && typeof sectionEntry === 'object') {
              sectionEntry[property] = typedValue;
            }
          });
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
      
      // CLEAR SELECTION AFTER UPDATE
      sceneManager.clearSelection();
      controller.selectSection(sceneManager.getSelectedSections());
      sceneManager.updateSectionUI(sceneManager.getSelectedSections());
      
      // Update checkbox to reflect cleared selection
      if (checkbox) {
        checkbox.checked = false;
        checkbox.indeterminate = false;
      }
      
      // Update conditional UI after backend processing completes
      const updatedState = controller.getState();
      updateConditionalUI(uiEngine, updatedState.composition);
    })();
  });
}

/**
 * Bind Apply to All Sections button
 */
/* function _bindApplyToAllButton(_controller: ApplicationController): void {
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
} */

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
 * Bind zoom toggle button
 */
function bindZoomToggleButton(
  sceneManager: ReturnType<typeof SceneManager.create>
): void {
  const zoomButton = document.getElementById('zoomToggleButton');
  if (!zoomButton) return;
  
  let isZoomedIn = false;
  
  zoomButton.addEventListener('click', () => {
    isZoomedIn = !isZoomedIn;
    sceneManager.toggleZoom(isZoomedIn);
    zoomButton.textContent = isZoomedIn ? '⊖' : '⊕';
  });
}

/**
 * Bind new file upload button
 */
function bindNewFileButton(_controller: ApplicationController): void {
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
function updateConditionalUI(uiEngine: UIEngine, compositionOrSnapshot: Partial<CompositionStateDTO> | Record<string, unknown>): void {
  // This function now accepts either a full DTO or a simple snapshot object
  // to make it more flexible for event handlers.
  const currentState: Record<string, unknown> = {
    shape: compositionOrSnapshot.frame_design?.shape ?? (compositionOrSnapshot as Record<string, unknown>).shape,
    number_sections: compositionOrSnapshot.frame_design?.number_sections ?? (compositionOrSnapshot as Record<string, unknown>).number_sections,
    finish_x: compositionOrSnapshot.frame_design?.finish_x ?? (compositionOrSnapshot as Record<string, unknown>).finish_x,
    slot_style: compositionOrSnapshot.pattern_settings?.slot_style ?? (compositionOrSnapshot as Record<string, unknown>).slot_style,
  };

  uiEngine.updateConditionalOptions(currentState);
  uiEngine.updateElementVisibility(currentState);
}

/**
 * CRITICAL FIX: Re-enable n=3 for circular shapes
 * This fixes regression where n=3 was hidden instead of just disabled
 */
function ensureSectionsOptionsVisible(): void {
  const sectionsEl = document.getElementById('sections') as HTMLSelectElement;
  if (!sectionsEl) return;
  
  // Make sure all options are visible (not display:none)
  for (const option of sectionsEl.options) {
    option.style.display = '';
  }
}

/**
 * Bind the "Start Tour" button to initialize and run the demo.
 */
function bindStartTourButton(
  _uiEngine: UIEngine, 
  controller: ApplicationController,
  sceneManager: SceneManager
): void {
  const startButton = document.getElementById('startTourButton');
  if (!startButton) return;

  const demoPlayer = new DemoPlayer(controller, sceneManager);
  window.demoPlayer = demoPlayer; // Expose for debugging

  startButton.addEventListener('click', () => {
    const confirmModal = new ConfirmModal({
      title: 'Start guided tour?',
      message: 'This will reset your current design.',
      primaryAction: 'Start Tour',
      secondaryAction: 'Cancel',
      onConfirm: () => {
        demoPlayer.start();
      },
      onCancel: () => {
        // User cancelled, do nothing
      }
    });
    confirmModal.show();
  });
}

/**
 * Bind the "Select All / None" checkbox functionality
 */
function bindSelectAllCheckbox(
  controller: ApplicationController,
  sceneManager: ReturnType<typeof SceneManager.create>
): void {
  const checkbox = document.getElementById('selectAllCheckbox') as HTMLInputElement;
  if (!checkbox) return;
	
	// Initialize checkbox to unchecked
  checkbox.checked = false;
  checkbox.indeterminate = false;	

  checkbox.addEventListener('change', () => {
    const numSections = controller.getState().composition.frame_design.number_sections;
    
    // Clear existing selections to start fresh
    sceneManager.clearSelection();

    if (checkbox.checked) {
      // If checked, select all sections
      for (let i = 0; i < numSections; i++) {
        sceneManager.toggleSection(i);
      }
    }
    // If unchecked, clearSelection() has already done the job.

    // Sync controller state and update UI chips
    controller.selectSection(sceneManager.getSelectedSections());
    sceneManager.updateSectionUI(sceneManager.getSelectedSections());
  });
}

/**
 * Dynamically updates the grain direction options based on the number of sections.
 */
function updateGrainDirectionOptions(uiEngine: UIEngine, numSections: number): void {
  const grainEl = uiEngine.getElement('grainDirection') as HTMLSelectElement;
  const grainConfig = uiEngine.getElementConfig('grainDirection');
  if (!grainEl || !grainConfig?.options) return;

  let isCurrentValueVisible = false;

  // Update visibility of each option
  for (const option of grainConfig.options) {
    const optionEl = grainEl.querySelector(`option[value="${option.value}"]`);
    if (!optionEl) continue;

    let shouldShow = true;
    if (option.show_when) {
      const sections = option.show_when.number_sections;
      if (sections && !sections.includes(numSections)) {
        shouldShow = false;
      }
    }

    (optionEl as HTMLElement).style.display = shouldShow ? '' : 'none';
    if (shouldShow && grainEl.value === option.value) {
      isCurrentValueVisible = true;
    }
  }

  // CRITICAL FIX: Sync UI dropdown to match initializeSectionMaterials fallback
  if (!isCurrentValueVisible) {
    grainEl.value = 'vertical'; // Match initializeSectionMaterials fallback logic
  }
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
  switch (onChangeConfig.action) {
    case 'update_section_materials':
      // SceneManager may not be available during initial setup - this is expected
      if (!window.sceneManager) {
        return;
      }
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
  
  const selectedSections = sceneManager.getSelectedSections();
  
  if (selectedSections.size > 0) {
    // If one or more sections are selected, update only those
    selectedSections.forEach(sectionId => {
      controller.updateSectionMaterial(sectionId, species, grain);
    });
  } else {
    // When no section is selected, apply to all sections
    const numSections = controller.getState().composition.frame_design.number_sections;
    for (let i = 0; i < numSections; i++) {
      controller.updateSectionMaterial(i, species, grain);
    }
  }
}