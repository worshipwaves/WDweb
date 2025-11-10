// src/SceneManager.ts

import {
    Engine, Scene, ArcRotateCamera, HemisphericLight, DirectionalLight,
    Vector3, Color3, Color4, Mesh, MeshBuilder, StandardMaterial,
    TransformNode, Animation, CubicEase, EasingFunction, Layer, PointerEventTypes
} from '@babylonjs/core';
import { GLTFFileLoader } from '@babylonjs/loaders/glTF';
import { ApplicationController } from './ApplicationController';
import { FrameGenerationService } from './FrameGenerationService';
import { PerformanceMonitor } from './PerformanceMonitor';
import { TextureCacheService } from './TextureCacheService';
import { IdleTextureLoader } from './IdleTextureLoader';
import { SmartCsgResponse, WoodMaterialsConfig, BackgroundsConfig, ApplicationState, CompositionStateDTO } from './types/schemas';
import { WaveformDesignerFacade } from './WaveformDesignerFacade';
import { WoodMaterial } from './WoodMaterial';
import { BackingMaterial } from './BackingMaterial';
import { PanelGenerationService } from './PanelGenerationService';
import type { BackingParameters } from './types/PanelTypes';
import { calculateGrainAngle } from './utils/materialUtils';

export class SceneManager {
    private _engine: Engine;
    private _scene: Scene;
    private _canvas: HTMLCanvasElement;
    public _camera!: ArcRotateCamera;
    private _facade: WaveformDesignerFacade;
    private _controller: ApplicationController; // Injected dependency
    private _textureCache: TextureCacheService;

    private _sectionMeshes: Mesh[] = [];
    private _sectionMaterials: WoodMaterial[] = [];
    private _backingMesh: Mesh | null = null;
		private _backingMeshes: Mesh[] = [];
    private _selectedSectionIndices: Set<number> = new Set();
    private _rootNode: TransformNode | null = null;
    private _currentCSGData: SmartCsgResponse | null = null;
    private _overlayMeshes: Map<number, Mesh> = new Map();
    private _backgroundLayer: Layer | null = null;
    private _cameraOffset: number = 0;
    private _isDesktopLayout: boolean = true;
    private _hasPlayedPulseAnimation: boolean = false;
    private _renderQueue: Promise<void> = Promise.resolve();
    private _isRendering = false;
    private _isInteractionSetup: boolean = false;
    private _isFirstRender: boolean = true;
		private _referenceAspectRatio: number = 0;

    private constructor(canvasId: string, facade: WaveformDesignerFacade, controller: ApplicationController) {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) throw new Error(`Canvas with id "${canvasId}" not found`);
        this._canvas = canvas;
        this._facade = facade;
        this._controller = controller; // Store the injected controller

        this._engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true });
        this._scene = new Scene(this._engine);
        this._scene.clearColor = new Color3(0.1, 0.1, 0.1).toColor4();
        this._textureCache = new TextureCacheService(this._scene);
        this._camera = this.setupCamera();
        this.setupLighting();
        //this.setupBackground();
        this.checkLayoutMode();
        this.updateCameraOffset();

        GLTFFileLoader; // Reference to prevent tree-shaking

        window.addEventListener('resize', () => {
            this._engine.resize();
            this.checkLayoutMode();
            this.updateCameraOffset();
            this.adjustCameraForAspectRatio();
        });

        this._engine.runRenderLoop(() => this._scene.render());
    }

    public static create(canvasId: string, facade: WaveformDesignerFacade, controller: ApplicationController): SceneManager {
        const manager = new SceneManager(canvasId, facade, controller);
        manager._rootNode = new TransformNode("root", manager._scene);
        manager._rootNode.rotation.x = Math.PI / 2;
        manager._camera.setTarget(new Vector3(manager._cameraOffset, 0, 0));
        manager._camera.radius = 47;
        
        // Store initial aspect ratio as reference
        const canvas = manager._engine.getRenderingCanvas();
        if (canvas) {
            manager._referenceAspectRatio = canvas.width / canvas.height;
        }
        
        return manager;
    }

    private setupCamera(): ArcRotateCamera {
        const camera = new ArcRotateCamera('mainCamera', Math.PI / 2, Math.PI / 2, 50, Vector3.Zero(), this._scene);
        camera.lowerRadiusLimit = 20;
        camera.upperRadiusLimit = 300;
        camera.lowerBetaLimit = 0.1;
        camera.upperBetaLimit = Math.PI - 0.1;
        camera.panningSensibility = 50;
        camera.wheelPrecision = 20;
        camera.pinchPrecision = 50;
        camera.attachControl(this._canvas, true);
        camera.useNaturalPinchZoom = true;
        if (camera.inputs.attached.pointers) {
            camera.inputs.attached.pointers.multiTouchPanning = true;
            camera.inputs.attached.pointers.multiTouchPanAndZoom = true;
        }
        return camera;
    }

    private setupLighting(): void {
        const ambientLight = new HemisphericLight('ambientLight', new Vector3(0, 1, 0), this._scene);
        ambientLight.intensity = 1.0;
        ambientLight.diffuse = new Color3(1, 1, 0.95);
        ambientLight.specular = new Color3(1, 1, 1);
        ambientLight.groundColor = new Color3(0.3, 0.3, 0.3);
        
        const directionalLight = new DirectionalLight('directionalLight', new Vector3(0, 0, -1), this._scene);
        directionalLight.position = new Vector3(0, 0, 50);
        directionalLight.intensity = 2.0;
        
        this._scene.environmentIntensity = 0.6;
        this._scene.clearColor = new Color3(0.90, 0.88, 0.86).toColor4();
        this._scene.ambientColor = new Color3(0.2, 0.2, 0.2);
        this._scene.environmentColor = new Color3(0.8, 0.8, 0.8);
    }
	
    // src/SceneManager.ts

		private setupBackground(): void {
				// Create a simple, non-textured background layer that is always ready.
				this._backgroundLayer = new Layer('backgroundLayer', null, this._scene, true);
				// Make it transparent so the scene's clearColor shows through.
				this._backgroundLayer.color = new Color4(0, 0, 0, 0);
		}
	
    public changeBackground(type: string, id: string, rgb?: number[], path?: string): void {
        if (this._backgroundLayer) {
            this._backgroundLayer.dispose();
            this._backgroundLayer = null;
        }
        if (type === 'paint' && rgb) {
            this._scene.clearColor = new Color3(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255).toColor4();
        } else if ((type === 'accent' || type === 'rooms') && path) {
            this._scene.clearColor = new Color3(0.9, 0.88, 0.86).toColor4();
            this._backgroundLayer = new Layer('backgroundLayer', path, this._scene, true);
        }
        
        // Apply art placement for room backgrounds
        if (type === 'rooms') {
            this.applyArtPlacement(id);
        } else {
            // Reset to default position for paint/accent backgrounds
            this.resetArtPlacement();
        }
    }
	
    private checkLayoutMode(): void {
        const DESKTOP_BREAKPOINT = 768;
        this._isDesktopLayout = window.innerWidth >= DESKTOP_BREAKPOINT;
    }
	
    public updateCameraOffset(): void {
        if (!this._isDesktopLayout) {
            this._cameraOffset = 0;
            this._camera.target.x = 0;
            return;
        }
        
        const leftMainPanel = document.getElementById('left-main-panel');
        const rightMainPanel = document.getElementById('right-main-panel');
        let leftWidth = 0;
        if (leftMainPanel && window.getComputedStyle(leftMainPanel).display !== 'none') {
            leftWidth += leftMainPanel.offsetWidth + 16;
        }
        let rightWidth = 0;
        if (rightMainPanel && window.getComputedStyle(rightMainPanel).display !== 'none') {
            rightWidth += rightMainPanel.offsetWidth + 16;
        }
        const offsetPixels = (leftWidth - rightWidth) / 2;
        const distance = this._camera.radius;
        const fov = this._camera.fov || 0.8;
        const canvasWidth = this._engine.getRenderWidth();
        if (canvasWidth === 0) return;

        const visibleWidth = 2 * distance * Math.tan(fov / 2);
        const pixelsPerUnit = canvasWidth / visibleWidth;
        if (pixelsPerUnit === 0) return;

        const offsetUnits = offsetPixels / pixelsPerUnit;
        this._cameraOffset = offsetUnits;
        this._camera.target.x = this._cameraOffset;
    }
		
		private adjustCameraForAspectRatio(): void {
        if (this._referenceAspectRatio === 0) return;
        
        const canvas = this._engine.getRenderingCanvas();
        if (!canvas) return;
        
        const currentAspect = canvas.width / canvas.height;
        const aspectRatio = this._referenceAspectRatio / currentAspect;
        
        // Adjust radius to maintain horizontal FOV
        const baseRadius = this.calculateIdealRadius();
        this._camera.radius = baseRadius * aspectRatio;
    }

    public preloadDefaultTextures(config: WoodMaterialsConfig): void {
        const speciesToPreload = ['walnut-black-american', 'cherry-black', 'maple'];
        speciesToPreload.forEach(speciesId => {
            const species = config.species_catalog.find(s => s.id === speciesId);
            if (!species) return;
            const sizeInfo = config.texture_config.size_map?.large;
            if (!sizeInfo) {
                console.error("Texture size configuration for 'large' is missing.");
                return;
            }
            const basePath = config.texture_config.base_texture_path;
            const albedoPath = `${basePath}/${species.id}/Varnished/${sizeInfo.folder}/Diffuse/wood-${species.wood_number}_${species.id}-varnished-${sizeInfo.dimensions}_d.png`;
            const normalPath = `${basePath}/${species.id}/Shared_Maps/${sizeInfo.folder}/Normal/wood-${species.wood_number}_${species.id}-${sizeInfo.dimensions}_n.png`;
            const roughnessPath = `${basePath}/${species.id}/Shared_Maps/${sizeInfo.folder}/Roughness/wood-${species.wood_number}_${species.id}-${sizeInfo.dimensions}_r.png`;
            this._textureCache.getTexture(albedoPath);
            this._textureCache.getTexture(normalPath);
            this._textureCache.getTexture(roughnessPath);
        });
    }

    public renderComposition(csgData: SmartCsgResponse): Promise<void> {
        this._renderQueue = this._renderQueue.then(async () => {
            if (this._isRendering) return;
            this._isRendering = true;
            try {
                await this._renderCompositionInternal(csgData);
            } finally {
                this._isRendering = false;
            }
        });
        return this._renderQueue;
    }

    private async _renderCompositionInternal(csgData: SmartCsgResponse): Promise<void> {
        PerformanceMonitor.start('render_internal_total');
        PerformanceMonitor.start('mesh_cleanup');
        this._currentCSGData = csgData;
        if (this._rootNode) {
            this._rootNode.dispose(false, false);
            this._rootNode = null;
        }
        this._sectionMeshes = [];
        this._sectionMaterials = [];
        PerformanceMonitor.end('mesh_cleanup');
        try {
            PerformanceMonitor.start('csg_mesh_generation');
            const frameService = new FrameGenerationService(this._scene);
            const meshes = frameService.createFrameMeshes(csgData.csg_data);
            if (meshes.length === 0) return;
						if (!this._rootNode) {
								this._rootNode = new TransformNode("root", this._scene);
								this._rootNode.rotation.x = Math.PI / 2;
								
								// Reapply art placement if room background is active
								if (this._controller) {
										const state = this._controller.getState();
										if (state?.ui?.currentBackground?.type === 'rooms') {
												this.applyArtPlacement(state.ui.currentBackground.id);
										}
								}
						}
						this._sectionMeshes = meshes;

						// Reapply art placement AFTER meshes are parented (meshes must exist for bounding box)
						const state = this._controller.getState();
						if (state?.ui?.currentBackground?.type === 'rooms') {
								this.applyArtPlacement(state.ui.currentBackground.id);
						}
            PerformanceMonitor.end('csg_mesh_generation');
            PerformanceMonitor.start('apply_materials');
            this.applySectionMaterials();
            PerformanceMonitor.end('apply_materials');
            
            this.pulseAllSections();
            this._camera.radius = this.calculateIdealRadius();
            this.setupSectionInteraction();

            const sectionIndicator = document.getElementById('sectionIndicator');
            if (this._sectionMeshes.length > 1) {
                if (sectionIndicator) sectionIndicator.style.display = 'flex';
                if (this._isFirstRender) {
                    this._selectedSectionIndices.clear();
                    for (let i = 0; i < this._sectionMeshes.length; i++) {
                        this._selectedSectionIndices.add(i);
                    }
                    this._overlayMeshes.clear();
                    this._selectedSectionIndices.forEach(index => {
                        const overlay = this.createCircularOverlay(index);
                        if (overlay) this._overlayMeshes.set(index, overlay);
                    });
                    this._isFirstRender = false;
                } else {
                    this.clearSelection();
                }
                this._createSectionChipsUI(this._sectionMeshes.length);
                this.updateSectionUI(this._selectedSectionIndices);
            } else {
                if (sectionIndicator) sectionIndicator.style.display = 'none';
                this.clearSelection();
            }
            
            document.dispatchEvent(new CustomEvent('demo:renderComplete'));
            PerformanceMonitor.end('render_internal_total');
        } catch (error: unknown) {
            console.error('[SceneManager] CSG mesh generation failed:', error);
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
	
    public clearScene(): void {
        if (this._rootNode) {
            this._rootNode.dispose();
            this._rootNode = null;
        }
        this._sectionMeshes = [];
        this._sectionMaterials.forEach(mat => mat.dispose());
        this._sectionMaterials = [];
        this._overlayMeshes.forEach(overlay => this._fadeOutAndDispose(overlay));
        this._overlayMeshes.clear();
        this._selectedSectionIndices.clear();
        this.disposeBacking();
    }
  
    public getCurrentCSGData(): SmartCsgResponse | null {
        return this._currentCSGData ?? null;
    }
	
    public async captureArchetypeThumbnail(size: number = 1024): Promise<void> {
        throw new Error('Method captureArchetypeThumbnail() not implemented.');
    }
  
    private setupSectionInteraction(): void {
        if (this._isInteractionSetup) return;
        this._isInteractionSetup = true;
        this._scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
                const pickResult = pointerInfo.pickInfo;
                if (pickResult?.hit && pickResult.pickedMesh) {
                    const meshName = pickResult.pickedMesh.name;
                    const match = meshName.match(/^section_(\d+)$/);
                    if (this._sectionMeshes.length > 1 && match) {
                        const sectionId = parseInt(match[1], 10);
                        const multiSelect = (pointerInfo.event as PointerEvent).ctrlKey || (pointerInfo.event as PointerEvent).metaKey;
                        const isDeselectingSingle = !multiSelect && this._selectedSectionIndices.size === 1 && this._selectedSectionIndices.has(sectionId);
                        if (!multiSelect && !isDeselectingSingle) this.clearSelection();
                        this.toggleSection(sectionId);
                        this._controller.selectSection(this._selectedSectionIndices);
                        this.updateSectionUI(this._selectedSectionIndices);
                    }
                } else {
                    this.clearSelection();
                    this._controller.selectSection(this._selectedSectionIndices);
                    this.updateSectionUI(this._selectedSectionIndices);
                }
            }
        });
    }
  
    public toggleSection(index: number): void {
        if (this._selectedSectionIndices.has(index)) {
            this._selectedSectionIndices.delete(index);
            const overlay = this._overlayMeshes.get(index);
            if (overlay) {
                this._fadeOutAndDispose(overlay);
                this._overlayMeshes.delete(index);
            }
        } else {
            this._selectedSectionIndices.add(index);
            if (this._sectionMeshes[index]) {
                const overlay = this.createCircularOverlay(index);
                if (overlay) this._overlayMeshes.set(index, overlay);
            }
        }
    }
	
    private pulseAllSections(): void {
        if (this._hasPlayedPulseAnimation) return;
        if (!this._currentCSGData?.csg_data) return;
        
        const csgData = this._currentCSGData.csg_data;
        if (csgData.panel_config.number_sections <= 1) return;
        
        const config = this._controller.getWoodMaterialsConfig();
        const numSections = csgData.panel_config.number_sections;
        
        let bifurcationAngles: number[];
        if (numSections === 4) {
          const angleMap: Record<string, number> = { 'TR': 45, 'BR': 315, 'BL': 225, 'TL': 135 };
          const quadrantOrder = ['TR', 'BR', 'BL', 'TL'];
          bifurcationAngles = quadrantOrder.map(q => angleMap[q]);
        } else {
          bifurcationAngles = config.geometry_constants.section_positioning_angles[String(numSections)] || [0];
        }
        
        this._sectionMeshes.forEach((mesh, index) => {
          setTimeout(() => {
            const boundingInfo = mesh.getBoundingInfo();
            const size = boundingInfo.boundingBox.extendSize;
            const maxDimension = Math.max(size.x, size.z);
            const baseRadius = maxDimension * 0.05;
            
            const localCenter = csgData.section_local_centers[index];
            const bifurcationAngle = bifurcationAngles[index];
            const minRadius = csgData.true_min_radius;
            
            if (!localCenter || bifurcationAngle === undefined) return;
            
            const distanceFromCenter = minRadius * 0.6;
            const angleRad = (bifurcationAngle * Math.PI) / 180;
            const cncCenterX = csgData.panel_config.finish_x / 2.0;
            const cncCenterY = csgData.panel_config.finish_y / 2.0;
            const localCenterBabylon = { x: localCenter[0] - cncCenterX, z: localCenter[1] - cncCenterY };
            
            let xPos = localCenterBabylon.x + distanceFromCenter * Math.cos(angleRad);
            let zPos = localCenterBabylon.z + distanceFromCenter * Math.sin(angleRad);
            
            if (numSections !== 1) {
              xPos = -xPos;
              zPos = -zPos;
            }
            
            const center = boundingInfo.boundingBox.center;
            const yPos = center.y + 2;
            
            for (let pulseNum = 0; pulseNum < 2; pulseNum++) {
              setTimeout(() => {
                const ring = MeshBuilder.CreateDisc(`pulseRing_${index}_${pulseNum}`, { radius: baseRadius, tessellation: 32 }, this._scene);
                ring.position = new Vector3(xPos, yPos + 0.01, zPos);
                ring.rotation.x = Math.PI / 2;
                ring.renderingGroupId = 1;
                ring.parent = this._rootNode;
                ring.isPickable = false;						
                
                const ringMat = new StandardMaterial(`pulseRingMat_${index}_${pulseNum}`, this._scene);
                ringMat.diffuseColor = new Color3(0.3, 0.5, 0.8);
                ringMat.emissiveColor = new Color3(0.3, 0.5, 0.8);
                ringMat.alpha = 0.6;
                ringMat.backFaceCulling = false;
                ring.material = ringMat;
                
                const scaleAnim = new Animation(`ringScale_${index}_${pulseNum}`, 'scaling', 30, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
                const alphaAnim = new Animation(`ringAlpha_${index}_${pulseNum}`, 'alpha', 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
                scaleAnim.setKeys([{ frame: 0, value: new Vector3(1, 1, 1) }, { frame: 45, value: new Vector3(3, 3, 3) }]);
                alphaAnim.setKeys([{ frame: 0, value: 0.6 }, { frame: 45, value: 0 }]);
                ring.animations = [scaleAnim];
                ringMat.animations = [alphaAnim];
                
                const scaleAnimatable = this._scene.beginAnimation(ring, 0, 45, false);
                this._scene.beginAnimation(ringMat, 0, 45, false);
                
                scaleAnimatable.onAnimationEnd = () => {
                  ring.dispose();
                  ringMat.dispose();
                };
              }, pulseNum * 1500);
            }
          }, index * 3100);
        });
        
        const totalDuration = (numSections * 3100);
        
        setTimeout(() => {
          this.clearSelection();
          this._controller.selectSection(this._selectedSectionIndices);
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
        const fadeAnimation = new Animation('overlayFade', 'alpha', 60, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
        fadeAnimation.setKeys([{ frame: 0, value: material.alpha }, { frame: 18, value: 0 }]);
        material.animations = [fadeAnimation];
        const animatable = this._scene.beginAnimation(material, 0, 18, false);
        animatable.onAnimationEnd = () => overlay.dispose();
    }
  
    private createCircularOverlay(index: number): Mesh | null {
        const mesh = this._sectionMeshes[index];
        if (!mesh || !this._currentCSGData) return null;
        const config = this._controller.getWoodMaterialsConfig();
        const csgData = this._currentCSGData.csg_data;
        const numSections = csgData.panel_config.number_sections;
        let bifurcationAngles: number[];
        if (numSections === 4) {
          const angleMap: Record<string, number> = { 'TR': 45, 'BR': 315, 'BL': 225, 'TL': 135 };
          const quadrantOrder = ['TR', 'BR', 'BL', 'TL'];
          bifurcationAngles = quadrantOrder.map(q => angleMap[q]);
        } else {
          bifurcationAngles = config.geometry_constants.section_positioning_angles[String(numSections)] || [0];
        }
        const boundingInfo = mesh.getBoundingInfo();
        const size = boundingInfo.boundingBox.extendSize;
        const maxDimension = Math.max(size.x, size.z);
        const overlayRadius = maxDimension * 0.05;
        const overlay = MeshBuilder.CreateDisc(`selectionOverlay_${index}`, { radius: overlayRadius, tessellation: 32 }, this._scene);
        const localCenter = csgData.section_local_centers[index];
        const bifurcationAngle = bifurcationAngles[index];
        const minRadius = csgData.true_min_radius;
        if (!localCenter || bifurcationAngle === undefined) return null;
        const distanceFromCenter = minRadius * 0.6;
        const angleRad = (bifurcationAngle * Math.PI) / 180;
        const cncCenterX = csgData.panel_config.finish_x / 2.0;
        const cncCenterY = csgData.panel_config.finish_y / 2.0;
        const localCenterBabylon = { x: localCenter[0] - cncCenterX, z: localCenter[1] - cncCenterY };
        let xPos = localCenterBabylon.x + distanceFromCenter * Math.cos(angleRad);
        let zPos = localCenterBabylon.z + distanceFromCenter * Math.sin(angleRad);
        if (numSections !== 1) {
          xPos = -xPos;
          zPos = -zPos;
        }
        const center = boundingInfo.boundingBox.center;
        overlay.position = new Vector3(xPos, center.y + 0.01, zPos);
        overlay.renderingGroupId = 1;
        overlay.rotation.x = Math.PI / 2;
        const overlayMat = new StandardMaterial(`overlayMat_${index}`, this._scene);
        overlayMat.diffuseColor = new Color3(1, 1, 1);
        overlayMat.alpha = 0.7;
        overlayMat.emissiveColor = new Color3(0.3, 0.3, 0.3);
        overlayMat.backFaceCulling = false;
        overlay.material = overlayMat;
        overlay.parent = this._rootNode;
        overlay.isPickable = false;
        return overlay;
    }
  
    public updateSectionUI(indices: Set<number>): void {
        const chips = document.querySelectorAll('.section-chip');
        chips.forEach(chip => {
            const chipId = parseInt((chip as HTMLElement).dataset.sectionId ?? '-1', 10);
            chip.classList.toggle('active', indices.has(chipId));
        });
        const selectAllCheckbox = document.getElementById('selectAllCheckbox') as HTMLInputElement;
        if (selectAllCheckbox) {
            const numSections = this._sectionMeshes.length;
            if (numSections > 0 && indices.size === numSections) {
                selectAllCheckbox.checked = true;
                selectAllCheckbox.indeterminate = false;
            } else if (indices.size > 0 && indices.size < numSections) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = true;
            } else {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            }
        }
        const state = this._controller.getState();
        const materials = state.composition.frame_design.section_materials || [];
        const config = this._controller.getWoodMaterialsConfig();
        const speciesEl = document.getElementById('woodSpecies') as HTMLSelectElement;
        const grainEl = document.getElementById('grainDirection') as HTMLSelectElement;
        if (!speciesEl || !grainEl) return;
        if (indices.size === 1) {
            const index = indices.values().next().value as number;
            const sectionMaterial = materials.find(m => m.section_id === index);
            speciesEl.value = sectionMaterial?.species || config.default_species;
            grainEl.value = sectionMaterial?.grain_direction || config.default_grain_direction;
        } else if (indices.size > 1) {
            const selectedMaterials = Array.from(indices).map(id => materials.find(m => m.section_id === id));
            const firstSpecies = selectedMaterials[0]?.species || config.default_species;
            const firstGrain = selectedMaterials[0]?.grain_direction || config.default_grain_direction;
            const allSpeciesSame = selectedMaterials.every(m => (m?.species || config.default_species) === firstSpecies);
            const allGrainsSame = selectedMaterials.every(m => (m?.grain_direction || config.default_grain_direction) === firstGrain);
            speciesEl.value = allSpeciesSame ? firstSpecies : '';
            grainEl.value = allGrainsSame ? firstGrain : '';
        }
    }
	
    private _createSectionChipsUI(numSections: number): void {
        const container = document.getElementById('sectionChipContainer');
        if (!container) return;
        container.innerHTML = '';
        for (let i = 0; i < numSections; i++) {
            const chip = document.createElement('button');
            chip.className = 'section-chip';
            chip.textContent = `${i + 1}`;
            chip.dataset.sectionId = String(i);
            chip.addEventListener('click', () => {
                this.toggleSection(i);
                this.updateSectionUI(this._selectedSectionIndices);
                this._controller.selectSection(this._selectedSectionIndices);
            });
            container.appendChild(chip);
        }
    }
	
    public applySectionMaterials(): void {
        const { composition } = this._controller.getState();
        const config = this._controller.getWoodMaterialsConfig();
        const { number_sections: numberSections, finish_x: panelDimension, section_materials: sectionMaterials = [] } = composition.frame_design;
        
        for (let index = 0; index < this._sectionMeshes.length; index++) {
            const mesh = this._sectionMeshes[index];
            const sectionMaterialData = sectionMaterials.find(m => m.section_id === index);
            const species = sectionMaterialData?.species || config.default_species;
            const grainDirection = sectionMaterialData?.grain_direction || config.default_grain_direction as 'horizontal' | 'vertical' | 'radiant' | 'diamond';
            
            const grainAngle = calculateGrainAngle(
                grainDirection, 
                index, 
                numberSections, 
                config, 
                this._currentCSGData
            );
            
            let material = this._sectionMaterials[index];
            if (!material) {
                material = new WoodMaterial(`wood_section_${index}`, this._scene);
                material.backFaceCulling = false;
                material.twoSidedLighting = true;
                this._sectionMaterials[index] = material;
            }
            
            material.updateTexturesAndGrain(
                species, 
                grainAngle, 
                panelDimension, 
                config, 
                index, 
                this._textureCache
            );
            
            mesh.material = material;
            mesh.parent = this._rootNode;
        }
    }
	
    public applySingleSectionMaterial(sectionIndex: number): void {
        const mesh = this._sectionMeshes[sectionIndex];
        if (!mesh) return;
        const state = this._controller.getState();
        const config = this._controller.getWoodMaterialsConfig();
        const { number_sections, finish_x, section_materials = [] } = state.composition.frame_design;
        const sectionMaterialData = section_materials.find(m => m.section_id === sectionIndex);
        const species = sectionMaterialData?.species || config.default_species;
        const grainDirection = sectionMaterialData?.grain_direction || config.default_grain_direction as any;
        const grainAngle = calculateGrainAngle(grainDirection, sectionIndex, number_sections, config, this._currentCSGData);
        let material = this._sectionMaterials[sectionIndex];
        if (!material) {
            material = new WoodMaterial(`wood_section_${sectionIndex}`, this._scene);
            this._sectionMaterials[sectionIndex] = material;
        }
        material.updateTexturesAndGrain(species, grainAngle, finish_x, config, sectionIndex, this._textureCache);
        mesh.material = material;
    }

    public dispose(): void {
        this._sectionMeshes.forEach(mesh => mesh.dispose());
        this._sectionMaterials.forEach(mat => mat.dispose());
        this._sectionMeshes = [];
        this._sectionMaterials = [];
        this._engine.dispose();
    }
	
    public toggleZoom(zoomIn: boolean): void {
        let targetRadius = zoomIn ? this._camera.radius / 1.1 : this._camera.radius * 1.1;
        targetRadius = Math.max(this._camera.lowerRadiusLimit ?? 1, Math.min(targetRadius, this._camera.upperRadiusLimit ?? 1000));
        const anim = new Animation('camRadius', 'radius', 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
        anim.setKeys([{ frame: 0, value: this._camera.radius }, { frame: 20, value: targetRadius }]);
        const ease = new CubicEase();
        ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
        anim.setEasingFunction(ease);
        this._camera.animations.push(anim);
        this._scene.beginAnimation(this._camera, 0, 20, false);
    }
	
    private calculateIdealRadius(): number {
        if (!this._rootNode) return 47;
        const childMeshes = this._rootNode.getChildMeshes();
        if (childMeshes.length === 0) return 47;
        let min = new Vector3(Infinity, Infinity, Infinity);
        let max = new Vector3(-Infinity, -Infinity, -Infinity);
        childMeshes.forEach(mesh => {
            const boundingInfo = mesh.getBoundingInfo();
            min = Vector3.Minimize(min, boundingInfo.boundingBox.minimumWorld);
            max = Vector3.Maximize(max, boundingInfo.boundingBox.maximumWorld);
        });
        const diagonal = max.subtract(min).length();
        return Math.max(diagonal * 1.5, this._camera.lowerRadiusLimit ?? 20);
    }
	
    public startCinematicRotation(onAnimationEnd?: () => void): void {
        const animAlpha = new Animation('cinematicAlpha', 'alpha', 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
        animAlpha.setKeys([{ frame: 0, value: this._camera.alpha }, { frame: 300, value: this._camera.alpha + (2 * Math.PI) }]);
        const ease = new CubicEase();
        ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
        animAlpha.setEasingFunction(ease);
        this._camera.animations = [animAlpha];
        const animatable = this._scene.beginAnimation(this._camera, 0, 300, false);
        if (onAnimationEnd) animatable.onAnimationEnd = onAnimationEnd;
    }
  
    public resetCamera(): void {
        const targetRadius = this.calculateIdealRadius();
        const animAlpha = new Animation('alphaAnim', 'alpha', 60, Animation.ANIMATIONTYPE_FLOAT);
        const animBeta = new Animation('betaAnim', 'beta', 60, Animation.ANIMATIONTYPE_FLOAT);
        const animRadius = new Animation('radiusAnim', 'radius', 60, Animation.ANIMATIONTYPE_FLOAT);
        animAlpha.setKeys([{ frame: 0, value: this._camera.alpha }, { frame: 60, value: Math.PI / 2 }]);
        animBeta.setKeys([{ frame: 0, value: this._camera.beta }, { frame: 60, value: Math.PI / 2 }]);
        animRadius.setKeys([{ frame: 0, value: this._camera.radius }, { frame: 60, value: targetRadius }]);
        const ease = new CubicEase();
        ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
        [animAlpha, animBeta, animRadius].forEach(a => a.setEasingFunction(ease));
        this._camera.setTarget(new Vector3(this._cameraOffset, 0, 0));
        this._scene.beginDirectAnimation(this._camera, [animAlpha, animBeta, animRadius], 0, 60, false);
    }
	
    public updateComposition(_newState: CompositionStateDTO): void {
        throw new Error('Method updateComposition() is not fully implemented and should be reviewed.');
    }

    public async generateBackingIfEnabled(backingParams: BackingParameters | null, composition: CompositionStateDTO): Promise<void> {
        console.log('[SceneManager] generateBackingIfEnabled called');
        console.log('[SceneManager] composition:', composition ? 'exists' : 'null');
        
        if (!composition) {
            console.log('[SceneManager] Early return: no composition');
            return;
        }
        
        if (!backingParams?.enabled || !backingParams.sections) {
            console.log('[SceneManager] Early return: backing not enabled or no sections');
            this.disposeBackingMeshes();
            return;
        }
        
        console.log('[SceneManager] Creating backing meshes for', backingParams.sections.length, 'sections');
        
        this.disposeBackingMeshes();
        this._backingMeshes = [];
        
        // Create all backing panels at once (reuses panel CSG logic)
        const panelService = new PanelGenerationService(this._scene);
        
        const backingConfig = {
            finishX: backingParams.csg_config?.finish_x ?? composition.frame_design.finish_x,
            finishY: backingParams.csg_config?.finish_y ?? composition.frame_design.finish_y,
            thickness: backingParams.sections[0].thickness,
            separation: backingParams.csg_config?.separation ?? composition.frame_design.separation,
            numberSections: composition.frame_design.number_sections,
            shape: composition.frame_design.shape,
            slotStyle: composition.pattern_settings.slot_style
        };
        
        // Create all backing panels without slots
        // Pass section_edges for circular n=3 CSG cutting
        const backingPanels = panelService.createPanelsWithCSG(
            backingConfig, 
            [],  // No slots for backing
            backingParams.section_edges  // Edge data for n=3 cutting
        );
        
        // Apply materials and positioning to each backing mesh
        for (let i = 0; i < backingParams.sections.length; i++) {
            const section = backingParams.sections[i];
            const mesh = backingPanels[i];
            
            mesh.name = `backing_section_${i}`;
            mesh.position.y = section.position_y;
            
            // CRITICAL: Apply n=3 rotation for backing (matches wood panel rotation from cutSlots)
            if (composition.frame_design.number_sections === 3 && composition.frame_design.shape === 'circular') {
                mesh.rotation.y = Math.PI;
                mesh.bakeCurrentTransformIntoVertices();
            }
            
            mesh.parent = this._rootNode;
            
            const backingMaterial = new BackingMaterial(this._scene, backingParams);
            mesh.material = backingMaterial.getMaterial();
            
            this._backingMeshes.push(mesh);
        }
        
        console.log(`[SceneManager] Generated ${this._backingMeshes.length} backing meshes`);
    }
		
		private createBackingMesh(
        section: BackingParameters['sections'][0],
        params: BackingParameters,
        sectionIndex: number,
        state: ApplicationState
    ): Mesh {
        const composition = state.composition;
        
        // Use PanelGenerationService to create backing with same cuts as wood panels
        const panelService = new PanelGenerationService(this._scene);
        
        const backingConfig = {
            finishX: composition.frame_design.finish_x,
            finishY: composition.frame_design.finish_y,
            thickness: section.thickness,
            separation: composition.frame_design.separation,
            numberSections: composition.frame_design.number_sections,
            shape: composition.frame_design.shape,
            slotStyle: composition.pattern_settings.slot_style
        };
        
        // Create panels without slots (pass empty array)
        const backingPanels = panelService.createPanelsWithCSG(backingConfig, []);
        
        // Get the backing mesh for this section
        const mesh = backingPanels[sectionIndex];
        mesh.name = `backing_section_${sectionIndex}`;
        
        // Position below wood panel
        mesh.position.y = section.position_y;
        
        // Apply backing material
        const backingMaterial = new BackingMaterial(this._scene, params);
        mesh.material = backingMaterial.getMaterial();
        
        mesh.parent = this._rootNode;
        
        return mesh;
    }
		
		
    public updateBackingMaterial(backingParams: BackingParameters): void {
        if (!this._backingMesh || !backingParams.enabled) {
            return;
        }

        const backingMaterial = new BackingMaterial(this._scene, backingParams);
        this._backingMesh.material = backingMaterial.getMaterial();
        console.log('[SceneManager] Backing material updated');
    }

    public disposeBacking(): void {
        if (this._backingMesh) {
            this._backingMesh.dispose();
            this._backingMesh = null;
        }
    }

    private disposeBackingMeshes(): void {
        if (this._backingMeshes && this._backingMeshes.length > 0) {
            for (const mesh of this._backingMeshes) {
                mesh.dispose();
            }
            this._backingMeshes = [];
        }
    }
		
		private applyArtPlacement(backgroundId: string): void {
				if (!this._controller) {
						console.warn('[SceneManager] Controller not available yet');
						return;
				}
				
				const config = this._controller.getBackgroundsConfig();
				if (!config) {
						console.warn('[SceneManager] No backgrounds config available');
						return;
				}
				
				const background = config.categories.rooms.find(bg => bg.id === backgroundId);
				if (!background || !background.art_placement) {
						console.warn(`[SceneManager] No art placement data for background: ${backgroundId}`);
						this.resetArtPlacement();
						return;
				}
				
				if (!this._rootNode) {
						console.warn('[SceneManager] Root node not available');
						return;
				}
				
				const placement = background.art_placement;
    
				// Calculate expected bounds from composition parameters (no mesh dependency)
				const state = this._controller.getState();
				if (!state?.composition?.frame_design) {
						console.warn('[SceneManager] Cannot calculate bounds - state not ready');
						// Fallback to direct positioning without offset
						this._rootNode.position = new Vector3(
								placement.position[0],
								placement.position[1],
								placement.position[2]
						);
						return;
				}
				
				const frameDesign = state.composition.frame_design;
				
				// Calculate vertical extent based on shape
				let minY: number;
				if (frameDesign.shape === 'rectangular') {
						// Rectangles: vertical extent is finish_y (height dimension)
						minY = -frameDesign.finish_y / 2;
				} else {
						// Circular/diamond: use radius (minimum of both dimensions)
						const radius = Math.min(frameDesign.finish_x, frameDesign.finish_y) / 2;
						minY = -radius;
				}
				
				// Position Y represents bottom edge - offset by composition height
				const yOffset = -minY; // Shift up so bottom is at specified Y
				
				// Apply position (Y coordinate now references bottom-center)
				this._rootNode.position = new Vector3(
						placement.position[0],
						placement.position[1] + yOffset,
						placement.position[2]
				);
        
        // Apply scale factor
        const currentScale = this._rootNode.scaling.x;
        const targetScale = placement.scale_factor;
        if (Math.abs(currentScale - targetScale) > 0.01) {
            this._rootNode.scaling = new Vector3(targetScale, targetScale, targetScale);
        }
        
        // Apply rotation if specified
        if (placement.rotation) {
            const rotX = placement.rotation[0] * Math.PI / 180;
            const rotY = placement.rotation[1] * Math.PI / 180;
            const rotZ = placement.rotation[2] * Math.PI / 180;
            
            // Preserve the existing X rotation (Math.PI / 2) and add placement rotation
            this._rootNode.rotation = new Vector3(
                Math.PI / 2 + rotX,
                rotY,
                rotZ
            );
        }
        
        console.log(`[SceneManager] Applied art placement for ${backgroundId}:`, placement);
    }
    
    private resetArtPlacement(): void {
        if (!this._rootNode) return;
        
        // Reset to default position (centered, no offset)
        this._rootNode.position = new Vector3(0, 0, 0);
        
        // Reset scale to 1.0
        this._rootNode.scaling = new Vector3(1, 1, 1);
        
        // Reset rotation to default (preserve coordinate transform rotation)
        this._rootNode.rotation = new Vector3(Math.PI / 2, 0, 0);
        
        console.log('[SceneManager] Reset art placement to defaults');
    }
}