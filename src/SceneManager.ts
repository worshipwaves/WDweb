// src/SceneManager.ts

import {
    Engine, Scene, ArcRotateCamera, HemisphericLight, DirectionalLight, 
    Vector3, Color3, Color4, Material, Mesh, MeshBuilder, StandardMaterial,
    TransformNode, Animation, CubicEase, EasingFunction, Layer, PointerEventTypes, ShadowGenerator, BackgroundMaterial
} from '@babylonjs/core';
import { GLTFFileLoader } from '@babylonjs/loaders/glTF';
import { GLTF2Export } from '@babylonjs/serializers/glTF';

import { ApplicationController } from './ApplicationController';
import { BackingMaterial } from './BackingMaterial';
import { FrameGenerationService } from './FrameGenerationService';
import { PanelGenerationService } from './PanelGenerationService';
import { PerformanceMonitor } from './PerformanceMonitor';
import { TextureCacheService } from './TextureCacheService';
import type { BackingParameters } from './types/PanelTypes';
import { SmartCsgResponse, WoodMaterialsConfig, ApplicationState, CompositionStateDTO, ArtPlacement, LightingConfig } from './types/schemas';
import { calculateGrainAngle } from './utils/materialUtils';
import { WaveformDesignerFacade } from './WaveformDesignerFacade';
import { WoodMaterial } from './WoodMaterial';

/* eslint-disable no-param-reassign */

// Debug globals for development tools
declare global {
    interface Window {
        scene?: Scene;
        __sceneManager?: SceneManager;
    }
}

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
		private _baseCameraRadius: number = 50;  // Standard 50" gallery viewing distance
    private _idealCameraRadius: number = 50;
		private _archetypeIdealRadius: Map<string, number> = new Map();
    private _currentArchetypeId: string | null = null;
    private _asymmetricLargeOnLeft: boolean = true; // Toggle state for asymmetric archetype
    private _turntablePole: TransformNode | null = null;
    private _turntableEnabled: boolean = false;
    private _lastPointerX: number = 0;
    private _pinchStartDistance: number = 0;
    private _pinchStartRadius: number = 0;
    private _activePointers: Map<number, PointerEvent> = new Map();
		private _currentImageAspectRatio: number = 1.5; // Default 3:2
		private _currentPaintColor: number[] | null = null;
		private _currentWallTexturePath: string | undefined = undefined;
		private _currentDisplayedRoomId: string | null = null;
		private _baselineAspectRatio: number = 1.0;
		private _baseRadiusBeforeAspect: number = 50;
		private _hemisphericLight: HemisphericLight | null = null;
    private _directionalLight: DirectionalLight | null = null;
		private _resizeObserver: ResizeObserver | null = null;
    private _shadowGenerator: ShadowGenerator | null = null;
    private _shadowReceiverPlane: Mesh | null = null;
    private _referenceAspectRatio: number = 1.0;
    private _cameraControlsEnabled: boolean = true;
		// Debug getters
    public get engine(): Engine { return this._engine; }
    public get scene(): Scene { return this._scene; }

    private constructor(canvasId: string, facade: WaveformDesignerFacade, controller: ApplicationController) {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
				const maxDPR = Math.min(window.devicePixelRatio, 2);
        if (!canvas) throw new Error(`Canvas with id "${canvasId}" not found`);
        this._canvas = canvas;
        this._facade = facade;
        this._controller = controller; // Store the injected controller

        this._engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true }, true);				
				this._engine.setHardwareScalingLevel(1 / maxDPR);
        this._scene = new Scene(this._engine);
				window.scene = this._scene;
        this._scene.clearColor = new Color4(0, 0, 0, 0);
        this._textureCache = new TextureCacheService(this._scene);
        this._camera = this.setupCamera();
        this.setupLighting();
        //this.setupBackground();
        this.checkLayoutMode();
        this.updateCameraOffset();
				this.updateCanvasBoundaries();

        GLTFFileLoader; // Reference to prevent tree-shaking

        this._resizeObserver = new ResizeObserver(() => {
            window.requestAnimationFrame(() => {
                if (!this._engine || this._engine.isDisposed) return;
                this._engine.resize();
                this.checkLayoutMode();
                this.updateCameraOffset();
                this.updateCanvasBoundaries();
                this.syncFovWithBackground();
            });
        });
        this._resizeObserver.observe(this._canvas);

        this._engine.runRenderLoop(() => this._scene.render());
				
				// DEBUG: Expose for ShadowDebugPanel console tool
        window.__sceneManager = this;
    }
		
		private syncFovWithBackground(): void {
        const canvas = this._engine.getRenderingCanvas();
        if (!canvas || canvas.width === 0 || canvas.height === 0) return;

        const screenAspect = canvas.width / canvas.height;
        const imageAspect = this._currentImageAspectRatio;
        const baseFov = 0.8; // Standard vertical FOV (radians)

        if (screenAspect < imageAspect) {
            // Screen is taller/narrower than image: Background fills height.
            // Keep vertical FOV constant.
            this._camera.fov = baseFov;
        } else {
            // Screen is wider/shorter than image: Background fills width (crops vertical).
            // Adjust vertical FOV to maintain fixed horizontal coverage.
            const newHalfFov = Math.atan(Math.tan(baseFov / 2) * (imageAspect / screenAspect));
            this._camera.fov = newHalfFov * 2;
        }
    }
		
		/**
     * Enable or disable camera controls based on background type.
     * Only blank_wall allows camera manipulation.
     * When enabled, uses turntable mode (object rotates, camera only zooms).
     */
    public setCameraControlsEnabled(enabled: boolean): void {
        if (enabled === this._cameraControlsEnabled) return;
        
        this._cameraControlsEnabled = enabled;
        
        if (enabled) {
            this._enableTurntableMode();
        } else {
            this._disableTurntableMode();
        }
    }
    
    private _enableTurntableMode(): void {
        this._turntableEnabled = true;
        
        // Create turntable pole if needed
        if (!this._turntablePole) {
            this._turntablePole = new TransformNode("turntablePole", this._scene);
        }
        
        // Parent rootNode to the pole, positioned at artwork center
        if (this._rootNode && this._rootNode.parent !== this._turntablePole) {
            // Position pole at rootNode's current location
            this._turntablePole.position = this._rootNode.position.clone();
            this._turntablePole.rotation = Vector3.Zero();
            
            // Reset rootNode position since pole now holds the offset
            this._rootNode.position = Vector3.Zero();
            this._rootNode.setParent(this._turntablePole);
        }
        
        // Camera: fully disable rotation/pan inputs, keep only for zoom
        this._camera.detachControl();
        // Remove pointer inputs that cause camera orbit
        if (this._camera.inputs.attached.pointers) {
            this._camera.inputs.remove(this._camera.inputs.attached.pointers);
        }
        
        // Reset camera to front view
        this._camera.alpha = Math.PI / 2;
        this._camera.beta = Math.PI / 2;
        this._camera.setTarget(Vector3.Zero());
        
        // Add pointer events for turntable drag
        this._canvas.addEventListener('pointerdown', this._onTurntablePointerDown);
        this._canvas.addEventListener('pointermove', this._onTurntablePointerMove);
        this._canvas.addEventListener('pointerup', this._onTurntablePointerUp);
        this._canvas.addEventListener('pointerleave', this._onTurntablePointerUp);
        
        // Allow zoom via wheel (desktop)
        this._canvas.addEventListener('wheel', this._onTurntableWheel);
        
        // Allow zoom via pinch (mobile)
        this._canvas.addEventListener('pointerdown', this._onTurntablePinchStart);
        this._canvas.addEventListener('pointermove', this._onTurntablePinchMove);
        this._canvas.addEventListener('pointerup', this._onTurntablePinchEnd);
        this._canvas.addEventListener('pointercancel', this._onTurntablePinchEnd);
    }
    
    private _disableTurntableMode(): void {
        this._turntableEnabled = false;
        
        // Unparent rootNode from pole
        if (this._rootNode && this._turntablePole) {
            this._rootNode.setParent(null);
            // Reset pole rotation so next enable starts fresh
            this._turntablePole.rotation = Vector3.Zero();
        }
        
        // Remove turntable event listeners
        this._canvas.removeEventListener('pointerdown', this._onTurntablePointerDown);
        this._canvas.removeEventListener('pointermove', this._onTurntablePointerMove);
        this._canvas.removeEventListener('pointerup', this._onTurntablePointerUp);
        this._canvas.removeEventListener('pointerleave', this._onTurntablePointerUp);
        this._canvas.removeEventListener('wheel', this._onTurntableWheel);
        this._canvas.removeEventListener('pointerdown', this._onTurntablePinchStart);
        this._canvas.removeEventListener('pointermove', this._onTurntablePinchMove);
        this._canvas.removeEventListener('pointerup', this._onTurntablePinchEnd);
        this._canvas.removeEventListener('pointercancel', this._onTurntablePinchEnd);
        
        // Clear any active pointers
        this._activePointers.clear();
        
        // Detach camera controls for room views
        this._camera.detachControl();
    }
    
    private _isDragging: boolean = false;
    
    private _onTurntablePointerDown = (evt: PointerEvent): void => {
        this._isDragging = true;
        this._lastPointerX = evt.clientX;
    };
    
    private _onTurntablePointerMove = (evt: PointerEvent): void => {
        if (!this._isDragging) return;
        if (!this._rootNode) return;
        
        const deltaX = evt.clientX - this._lastPointerX;
        this._lastPointerX = evt.clientX;
        
        // Rotate rootNode around Y axis (turntable spin)
        this._rootNode.rotation.y -= deltaX * 0.005;
        
        // Hide shadow plane when rotated (shadow position becomes incorrect)
        if (this._shadowReceiverPlane && this._shadowReceiverPlane.isVisible) {
            this._shadowReceiverPlane.isVisible = false;
        }
    };
    
    private _onTurntablePointerUp = (): void => {
        this._isDragging = false;
    };
    
    private _onTurntableWheel = (evt: WheelEvent): void => {
        evt.preventDefault();
        
        // Zoom in/out
        const zoomDelta = evt.deltaY * 0.05;
        const newRadius = this._camera.radius + zoomDelta;
        
        // Clamp radius
        this._camera.radius = Math.max(5, Math.min(150, newRadius));
    };
    
    private _onTurntablePinchStart = (evt: PointerEvent): void => {
        this._activePointers.set(evt.pointerId, evt);
        
        if (this._activePointers.size === 2) {
            // Two fingers down - start pinch
            const pointers = Array.from(this._activePointers.values());
            this._pinchStartDistance = this._getPointerDistance(pointers[0], pointers[1]);
            this._pinchStartRadius = this._camera.radius;
        }
    };
    
    private _onTurntablePinchMove = (evt: PointerEvent): void => {
        this._activePointers.set(evt.pointerId, evt);
        
        if (this._activePointers.size === 2) {
            // Two fingers moving - handle pinch zoom
            const pointers = Array.from(this._activePointers.values());
            const currentDistance = this._getPointerDistance(pointers[0], pointers[1]);
            
            if (this._pinchStartDistance > 0) {
                const scale = this._pinchStartDistance / currentDistance;
                const newRadius = this._pinchStartRadius * scale;
                
                // Clamp radius
                this._camera.radius = Math.max(5, Math.min(150, newRadius));
            }
        }
    };
    
    private _onTurntablePinchEnd = (evt: PointerEvent): void => {
        this._activePointers.delete(evt.pointerId);
        
        if (this._activePointers.size < 2) {
            this._pinchStartDistance = 0;
        }
    };
    
    private _getPointerDistance(p1: PointerEvent, p2: PointerEvent): number {
        const dx = p1.clientX - p2.clientX;
        const dy = p1.clientY - p2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    public static create(canvasId: string, facade: WaveformDesignerFacade, controller: ApplicationController): SceneManager {
        const manager = new SceneManager(canvasId, facade, controller);
        manager._rootNode = new TransformNode("root", manager._scene);
        manager._rootNode.rotation.x = Math.PI / 2;
        manager._camera.setTarget(new Vector3(manager._cameraOffset, 0, 0));
        
        // Store initial aspect ratio as reference
        const canvas = manager._engine.getRenderingCanvas();
        if (canvas) {
            manager._referenceAspectRatio = canvas.width / canvas.height;
            manager._baselineAspectRatio = manager._referenceAspectRatio;
        }
				manager.updateCanvasBoundaries();
        
        return manager;
    }

    private setupCamera(): ArcRotateCamera {
        const camera = new ArcRotateCamera('mainCamera', Math.PI / 2, Math.PI / 2, 50, Vector3.Zero(), this._scene);  // Standard 50" gallery viewing distance
        this._baseCameraRadius = camera.radius;  // Capture base for scene-specific calculations
				camera.lowerRadiusLimit = 0.1;
				camera.minZ = 0.01;
				camera.wheelPrecision = 5;
        camera.upperRadiusLimit = 300;
        camera.lowerBetaLimit = 0.1;
        camera.upperBetaLimit = Math.PI - 0.1;
        camera.panningSensibility = 50;
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
        // 1. Fix Hemispheric Light (The "Fill" Light)
        this._hemisphericLight = new HemisphericLight('ambientLight', new Vector3(0, 1, 0), this._scene);
        
        // Lower intensity so it doesn't overpower the sun
        this._hemisphericLight.intensity = 0.7; 
        
        // Keep the light slightly warm
        this._hemisphericLight.diffuse = new Color3(1, 1, 0.95);
        
        // CRITICAL FIX 1: Kill the shine on the ambient light
        this._hemisphericLight.specular = new Color3(0, 0, 0); 
        
        // CRITICAL FIX 2: Make shadows BLACK. 
        // This ensures the cracks in the wood texture actually look dark.
        this._hemisphericLight.groundColor = new Color3(0, 0, 0); 
        
        // 2. Fix Directional Light (The "Sun")
        // Light travels from Right (X=1) to Left (X=-1), and Down (Y=-0.5)
        this._directionalLight = new DirectionalLight('directionalLight', new Vector3(-1, -0.5, -1), this._scene);
        this._directionalLight.position = new Vector3(0, 0, 50);
        this._directionalLight.autoCalcShadowZBounds = true;
        
        // Slight reduction to prevent over-exposure since we have environment lighting too
        this._directionalLight.intensity = 1.5; 
        
        this._scene.environmentIntensity = 0.6;
        
        // CRITICAL FIX 3: Remove global ambient color. 
        // Let the actual lights do the work.
        this._scene.ambientColor = new Color3(0, 0, 0);
        
        // Set to transparent so CSS background shows through
        this._scene.clearColor = new Color4(0, 0, 0, 0);
        
        // This environment color might be redundant with environmentIntensity, 
        // but if you keep it, make it darker to avoid washout.
        this._scene.environmentColor = new Color3(0.2, 0.2, 0.2); 
    }
	

		private setupBackground(): void {
				// Create a simple, non-textured background layer that is always ready.
				this._backgroundLayer = new Layer('backgroundLayer', null, this._scene, true);
				// Make it transparent so the scene's clearColor shows through.
				this._backgroundLayer.color = new Color4(0, 0, 0, 0);
		}
	
		public changeBackground(type: string, id: string, rgb?: number[], path?: string, foregroundPath?: string, wallCompensation?: number): Promise<void> {
		return new Promise<void>((resolve) => {
				const canvas = this._engine.getRenderingCanvas();
				const container = canvas?.parentElement;
				
				// Ensure canvas is permanently transparent
				if (canvas) {
						canvas.style.backgroundColor = 'transparent';
						canvas.style.backgroundImage = 'none';
				}
				this._scene.clearColor = new Color4(0, 0, 0, 0);
				
				// Dispose Babylon layer if it exists
				if (this._backgroundLayer) {
						this._backgroundLayer.dispose();
						this._backgroundLayer = null;
				}
				
				// Handle paint type BEFORE clearing container (paint just stores preference)
				if (type === 'paint') {
						if (rgb) {
								this._currentPaintColor = rgb;
								this._currentWallTexturePath = undefined;
						} else if (path) {
								this._currentWallTexturePath = path;
								this._currentPaintColor = undefined;
						}
						resolve();
						return; // Paint selection alone doesn't change display
				}

				// Apply background to container (only for non-paint types)
				if (container) {
						// Do NOT clear container here - causes flash
						// Background is set inside async callbacks after images load
						
						if (type === 'rooms' && path) {
								// Check if same room - just update wall color without reloading overlays
								if (foregroundPath && this._currentDisplayedRoomId === id) {
										// Same room, just update background color
										if (this._currentWallTexturePath) {
												container.style.backgroundImage = `url(${this._currentWallTexturePath})`;
												container.style.backgroundSize = 'cover';
												container.style.backgroundPosition = 'center';
										} else {
												const paintRgb = this._currentPaintColor || [0.816, 0.804, 0.784];
												const comp = wallCompensation ?? 1.0;
												const wallRgb = paintRgb.map(c => Math.min(1.0, c * comp));
												container.style.backgroundColor = `rgb(${wallRgb[0] * 255}, ${wallRgb[1] * 255}, ${wallRgb[2] * 255})`;
												container.style.backgroundImage = 'none';
										}
										resolve();
										return; // Skip overlay reload
								}
								
								// Different room - full reload
								this._currentDisplayedRoomId = id;
								
								// Disable camera controls for room scenes (except blank_wall)
								this.setCameraControlsEnabled(id === 'blank_wall');
								
								if (foregroundPath) {
										// Preload both images before swapping to prevent flash
										const fgImg = new Image();
										const shadowPath = foregroundPath.replace('_foreground.png', '_shadow.png');
										const shadowImg = new Image();
										let loadedCount = 0;
										
										const onBothLoaded = async () => {
												loadedCount++;
												if (loadedCount < 2) return;
												
												// Decode images before DOM swap to prevent flash
												await Promise.all([
														fgImg.decode().catch(() => {}),
														shadowImg.decode().catch(() => {})
												]);
												
												this._currentImageAspectRatio = fgImg.width / fgImg.height;
												
												// Update background color
												if (this._currentWallTexturePath) {
														container.style.backgroundImage = `url(${this._currentWallTexturePath})`;
														container.style.backgroundSize = 'cover';
														container.style.backgroundPosition = 'center';
												} else {
														const paintRgb = this._currentPaintColor || [0.816, 0.804, 0.784];
														const comp = wallCompensation ?? 1.0;
														const wallRgb = paintRgb.map(c => Math.min(1.0, c * comp));
													container.style.backgroundColor = `rgb(${wallRgb[0] * 255}, ${wallRgb[1] * 255}, ${wallRgb[2] * 255})`;
													container.style.backgroundImage = 'none';
											}
											
											// Capture old overlay references BEFORE adding new ones
												const oldFg = container.querySelector('.room-foreground-overlay');
												const oldShadow = container.querySelector('.room-shadow-overlay');
												
												// Shadow overlay (add new FIRST)
												const shadowOverlay = document.createElement('div');
												shadowOverlay.className = 'room-shadow-overlay';
												shadowOverlay.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;background-image:url(${shadowPath});background-size:cover;background-position:center;pointer-events:none;z-index:0;mix-blend-mode:multiply;`;
												container.insertBefore(shadowOverlay, container.firstChild);
												
												// Foreground overlay
												const overlay = document.createElement('div');
												overlay.className = 'room-foreground-overlay';
												overlay.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;background-image:url(${foregroundPath});background-size:cover;background-position:center;pointer-events:none;z-index:1;`;
												container.insertBefore(overlay, container.firstChild);
												
												// Remove old overlays AFTER new ones are in DOM
												oldFg?.remove();
												oldShadow?.remove();
												
												this.syncFovWithBackground();
												resolve();
										};
										
										fgImg.onload = () => void onBothLoaded();
										shadowImg.onload = () => void onBothLoaded();
										shadowImg.onerror = onBothLoaded; // Handle missing shadow
										
										fgImg.src = foregroundPath;
										shadowImg.src = shadowPath;
								} else {
										// Standard room (non-colorizable): remove overlays and set background
										container.querySelector('.room-foreground-overlay')?.remove();
										container.querySelector('.room-shadow-overlay')?.remove();
										const img = new Image();
										img.onload = () => {
												this._currentImageAspectRatio = img.width / img.height;
												container.style.backgroundImage = `url(${path})`;
												container.style.backgroundSize = 'cover';
												container.style.backgroundPosition = 'center';
												this.syncFovWithBackground();
												resolve();
										};
										img.src = path;
									}
							}
					}
			});
		}

    private checkLayoutMode(): void {
        const DESKTOP_BREAKPOINT = 768;
        this._isDesktopLayout = window.innerWidth >= DESKTOP_BREAKPOINT;
    }
		
		private updateCanvasBoundaries(): void {
        const canvas = this._engine.getRenderingCanvas();
        if (!canvas) return;
        
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const viewportAspect = viewportWidth / viewportHeight;
        const targetAspect = 16 / 9;
        
        let canvasLeft = 0;
        let canvasRight = viewportWidth;
        
        if (viewportAspect > targetAspect) {
            const canvasWidth = viewportHeight * targetAspect;
            canvasLeft = (viewportWidth - canvasWidth) / 2;
            canvasRight = canvasLeft + canvasWidth;
        }
        
        const canvasRightOffset = viewportWidth - canvasRight;
        
        document.documentElement.style.setProperty('--canvas-left', `${canvasLeft}px`);
        document.documentElement.style.setProperty('--canvas-right', `${canvasRight}px`);
        document.documentElement.style.setProperty('--canvas-right-offset', `${canvasRightOffset}px`);
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
						// Warm cache only - don't create clones
						this._textureCache.ensureCached(albedoPath);
						this._textureCache.ensureCached(normalPath);
						this._textureCache.ensureCached(roughnessPath);
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
        if (this._shadowReceiverPlane) {
            this._shadowReceiverPlane.dispose();
            this._shadowReceiverPlane = null;
        }
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
						}
						// Hide rootNode until all meshes and textures are ready (prevents staged reveal)
						this._rootNode.setEnabled(false);
						this._sectionMeshes = meshes;
            
            // SHADOW FIX: Prevent self-shadowing artifacts ("paint drips") on flat wood panels
            // Root cause: Wood panels are flat extrusions that should never cast shadows onto themselves.
            // Setting receiveShadows = false eliminates z-fighting between the mesh surface and its own shadow.
            // Backing panels and shadow receiver plane will still catch shadows from the wood.
            this._sectionMeshes.forEach(mesh => {
                mesh.receiveShadows = false;
            });
            
            // Sync asymmetric visibility with toggle state after mesh recreation
            if (csgData.csg_data?.panel_config?.slot_style === 'asymmetric') {
                this._syncAsymmetricVisibility();
            }
            
            PerformanceMonitor.end('csg_mesh_generation');
            PerformanceMonitor.start('apply_materials');
            this.applySectionMaterials();
            PerformanceMonitor.end('apply_materials');
            
            //this.pulseAllSections();
						//this._camera.radius = this.calculateIdealRadius();
						this.setupSectionInteraction();
            
            // Disable section picking unless UI is on a subcategory that enables it
            const enablesSectionSelection = (this._controller as unknown as { 
                isSectionSelectionEnabled?: () => boolean 
            }).isSectionSelectionEnabled?.() ?? false;
            if (!enablesSectionSelection) {
                this.setSectionInteractionEnabled(false);
            }

            const sectionIndicator = document.getElementById('sectionIndicator');
            if (this._sectionMeshes.length > 1) {
                if (sectionIndicator) sectionIndicator.style.display = 'flex';
                if (this._isFirstRender) {
                    this._selectedSectionIndices.clear();
                    this._overlayMeshes.clear();
                    // Check UI state for initial tutorial pulse
                    const state = this._controller.getState();
                    const shouldShowTutorial = state.ui.activeCategory === 'wood' && state.ui.activeSubcategory === 'wood_species';
                    if (shouldShowTutorial) {
                        this.playTutorialPulse();
                    }
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
						
						// Apply art placement from current state (fixes initial render bug)
            const artPlacement = this._controller.getCurrentArtPlacement();
            if (artPlacement) {
                this.applyArtPlacement(artPlacement);
            } else {
                this.resetArtPlacement();
            }
            
            // Regenerate backing if enabled (fixes backing disappearance on layout changes)
            if (csgData.backing_parameters) {
                this.generateBackingIfEnabled(csgData.backing_parameters, csgData.updated_state);
            }
            
            // Regenerate shadow receiver (same lifecycle as backing)
            this._createShadowReceiver(csgData);
            
            // Collect texture promises but do not await them (prevents blocking main thread)
            const texturePromises: Promise<void>[] = [];
            for (const mat of this._sectionMaterials) {
                const tex = mat.albedoTexture;
                if (tex && !tex.isReady()) {
                    const observable = (tex as import('@babylonjs/core').Texture).onLoadObservable;
                    texturePromises.push(new Promise<void>(resolve => { observable.addOnce(() => { resolve(); }); }));
                }
            }

            // Keep scene hidden until textures are ready to prevent "pop-in" artifact
            if (texturePromises.length > 0) {
                this._rootNode?.setEnabled(false);
                await Promise.all(texturePromises);
                this._rootNode?.setEnabled(true);
            } else {
                this._rootNode?.setEnabled(true);
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
	
    public captureArchetypeThumbnail(_size: number = 1024): Promise<void> {
        throw new Error('Method captureArchetypeThumbnail() not implemented.');
    }
		
		public setSectionInteractionEnabled(enabled: boolean): void {
        // Enable/disable clicking on section meshes
        this._sectionMeshes.forEach(mesh => {
            mesh.isPickable = enabled;
        });
    }
		
		public setSectionOverlaysVisible(visible: boolean): void {
        // Show/hide white dot overlays
        this._overlayMeshes.forEach(overlay => {
            overlay.setEnabled(visible);
        });
    }
  
    private setupSectionInteraction(): void {
        if (this._isInteractionSetup) return;
        this._isInteractionSetup = true;
        this._scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
                const pickResult = pointerInfo.pickInfo;
                if (pickResult?.hit && pickResult.pickedMesh) {
                    const meshName = pickResult.pickedMesh.name;
                    
                    // Determine section_id from mesh name
                    let sectionId: number | null = null;
                    const standardMatch = meshName.match(/^section_(\d+)$/);
                    if (standardMatch) {
                        sectionId = parseInt(standardMatch[1], 10);
                    } else if (meshName.startsWith('asymmetric_')) {
                        // For asymmetric: section_id by SIZE (0=small, 1=large)
                        sectionId = meshName.includes('_large_') ? 1 : meshName.includes('_small_') ? 0 : null;
                    }
                    
                    if (this._sectionMeshes.length > 1 && sectionId !== null) {
                        const multiSelect = (pointerInfo.event as PointerEvent).ctrlKey || (pointerInfo.event as PointerEvent).metaKey;
                        const isDeselectingSingle = !multiSelect && this._selectedSectionIndices.size === 1 && this._selectedSectionIndices.has(sectionId);
                        if (!multiSelect && !isDeselectingSingle) this.clearSelection();
                        this.toggleSection(sectionId);
                        this._controller.selectSection(this._selectedSectionIndices);
                        this.updateSectionUI(this._selectedSectionIndices);
                    } else {
                        // Clicked on non-section mesh (shadowReceiver, backing, etc.)
                        this.clearSelection();
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

    /**
     * Toggle asymmetric layout between large-on-left and large-on-right.
     * Swaps visibility of mesh pairs without regenerating geometry.
     * Also toggles backing meshes if present.
     */
    public toggleAsymmetricLayout(): void {
        this._asymmetricLargeOnLeft = !this._asymmetricLargeOnLeft;
        
        // Find asymmetric wood meshes by name
        const largeLeft = this._sectionMeshes.find(m => m.name === 'asymmetric_large_left');
        const largeRight = this._sectionMeshes.find(m => m.name === 'asymmetric_large_right');
        const smallLeft = this._sectionMeshes.find(m => m.name === 'asymmetric_small_left');
        const smallRight = this._sectionMeshes.find(m => m.name === 'asymmetric_small_right');
        
        if (!largeLeft || !largeRight || !smallLeft || !smallRight) {
            console.warn('[SceneManager] toggleAsymmetricLayout called but wood meshes not found');
            return;
        }
        
        // Find asymmetric backing meshes by name (may not exist if backing disabled)
        const backingLargeLeft = this._backingMeshes.find(m => m.name === 'backing_large_left');
        const backingLargeRight = this._backingMeshes.find(m => m.name === 'backing_large_right');
        const backingSmallLeft = this._backingMeshes.find(m => m.name === 'backing_small_left');
        const backingSmallRight = this._backingMeshes.find(m => m.name === 'backing_small_right');
        
        if (this._asymmetricLargeOnLeft) {
            // Large on LEFT, Small on RIGHT
            largeLeft.setEnabled(true);
            smallRight.setEnabled(true);
            largeRight.setEnabled(false);
            smallLeft.setEnabled(false);
            
            // Toggle backing if present
            backingLargeLeft?.setEnabled(true);
            backingSmallRight?.setEnabled(true);
            backingLargeRight?.setEnabled(false);
            backingSmallLeft?.setEnabled(false);
        } else {
            // Large on RIGHT, Small on LEFT
            largeLeft.setEnabled(false);
            smallRight.setEnabled(false);
            largeRight.setEnabled(true);
            smallLeft.setEnabled(true);
            
            // Toggle backing if present
            backingLargeLeft?.setEnabled(false);
            backingSmallRight?.setEnabled(false);
            backingLargeRight?.setEnabled(true);
            backingSmallLeft?.setEnabled(true);
        }
    }

    public isAsymmetricLargeOnLeft(): boolean {
        return this._asymmetricLargeOnLeft;
    }
		
		/**
     * Sync asymmetric mesh visibility with current toggle state.
     * Called after mesh recreation to preserve user's left/right selection.
     */
    private _syncAsymmetricVisibility(): void {
        const largeLeft = this._sectionMeshes.find(m => m.name === 'asymmetric_large_left');
        const largeRight = this._sectionMeshes.find(m => m.name === 'asymmetric_large_right');
        const smallLeft = this._sectionMeshes.find(m => m.name === 'asymmetric_small_left');
        const smallRight = this._sectionMeshes.find(m => m.name === 'asymmetric_small_right');
        
        const backingLargeLeft = this._backingMeshes.find(m => m.name === 'backing_large_left');
        const backingLargeRight = this._backingMeshes.find(m => m.name === 'backing_large_right');
        const backingSmallLeft = this._backingMeshes.find(m => m.name === 'backing_small_left');
        const backingSmallRight = this._backingMeshes.find(m => m.name === 'backing_small_right');
        
        if (this._asymmetricLargeOnLeft) {
            largeLeft?.setEnabled(true);
            smallRight?.setEnabled(true);
            largeRight?.setEnabled(false);
            smallLeft?.setEnabled(false);
            backingLargeLeft?.setEnabled(true);
            backingSmallRight?.setEnabled(true);
            backingLargeRight?.setEnabled(false);
            backingSmallLeft?.setEnabled(false);
        } else {
            largeLeft?.setEnabled(false);
            smallRight?.setEnabled(false);
            largeRight?.setEnabled(true);
            smallLeft?.setEnabled(true);
            backingLargeLeft?.setEnabled(false);
            backingSmallRight?.setEnabled(false);
            backingLargeRight?.setEnabled(true);
            backingSmallLeft?.setEnabled(true);
        }
    }
		
		public playTutorialPulse(): void {
        // Wait for textures/shaders so wood is visible before pulsing
        this._scene.executeWhenReady(() => {
            const numSections = this._sectionMeshes.length;
            if (numSections <= 1) return;
            
            const pulseDuration = 800;
            
            for (let i = 0; i < numSections; i++) {
                setTimeout(() => {
                    // Re-check existence in case user navigated away quickly
                    if (i >= this._sectionMeshes.length) return;
                    
                    const overlay = this.createCircularOverlay(i);
                    if (overlay) {
                        this._overlayMeshes.set(i, overlay);
                        setTimeout(() => {
                            this._fadeOutAndDispose(overlay);
                            this._overlayMeshes.delete(i);
                        }, pulseDuration);
                    }
                }, i * pulseDuration);
            }
        });
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
        const shape = csgData.panel_config.shape;
        const slotStyle = csgData.panel_config.slot_style;
        
        const boundingInfo = mesh.getBoundingInfo();
        const size = boundingInfo.boundingBox.extendSize;
        const maxDimension = Math.max(size.x, size.z);
        const overlayRadius = maxDimension * 0.05;
        const overlay = MeshBuilder.CreateDisc(`selectionOverlay_${index}`, { radius: overlayRadius, tessellation: 32 }, this._scene);
        
        const center = boundingInfo.boundingBox.center;
        let xPos: number, zPos: number;
        
        // Rectangular linear: place dot at mesh center (side-by-side panels)
        if (shape === 'rectangular' && slotStyle === 'linear') {
          xPos = center.x;
          zPos = center.z;
        } else {
          // Radial patterns: use bifurcation angles
          let bifurcationAngles: number[];
          if (numSections === 4) {
            const angleMap: Record<string, number> = { 'TR': 45, 'BR': 315, 'BL': 225, 'TL': 135 };
            const quadrantOrder = ['TR', 'BR', 'BL', 'TL'];
            bifurcationAngles = quadrantOrder.map(q => angleMap[q]);
          } else {
            bifurcationAngles = config.geometry_constants.section_positioning_angles[String(numSections)] || [0];
          }
          
          const localCenter = csgData.section_local_centers[index];
          const bifurcationAngle = bifurcationAngles[index];
          const minRadius = csgData.true_min_radius;
          if (!localCenter || bifurcationAngle === undefined) return null;
          
          const distanceFromCenter = minRadius * 0.6;
          const angleRad = (bifurcationAngle * Math.PI) / 180;
          const cncCenterX = csgData.panel_config.finish_x / 2.0;
          const cncCenterY = csgData.panel_config.finish_y / 2.0;
          const localCenterBabylon = { x: localCenter[0] - cncCenterX, z: localCenter[1] - cncCenterY };
          xPos = localCenterBabylon.x + distanceFromCenter * Math.cos(angleRad);
          zPos = localCenterBabylon.z + distanceFromCenter * Math.sin(angleRad);
          
          if (numSections !== 1) {
            xPos = -xPos;
            zPos = -zPos;
          }
        }
        
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
        
        // Register meshes as shadow casters if shadow generator exists
        if (this._shadowGenerator) {
            this._sectionMeshes.forEach(mesh => {
                if (!this._shadowGenerator!.getShadowMap()?.renderList?.includes(mesh)) {
                    this._shadowGenerator!.addShadowCaster(mesh);
                }
            });
        }
    }
	
    public applySingleSectionMaterial(sectionIndex: number): void {
        const mesh = this._sectionMeshes[sectionIndex];
        if (!mesh) return;
        const state = this._controller.getState();
        const config = this._controller.getWoodMaterialsConfig();
        const { number_sections, finish_x, section_materials = [] } = state.composition.frame_design;
        
        // For asymmetric, determine material_id by SIZE from mesh name
        let materialId = sectionIndex;
        if (mesh.name.startsWith('asymmetric_')) {
            materialId = mesh.name.includes('_large_') ? 1 : 0;
        }
        
        const sectionMaterialData = section_materials.find(m => m.section_id === materialId);
        const species = sectionMaterialData?.species || config.default_species;
        const grainDirection = (sectionMaterialData?.grain_direction || config.default_grain_direction) as 'horizontal' | 'vertical' | 'radiant' | 'diamond';
        const grainAngle = calculateGrainAngle(grainDirection, materialId, number_sections, config, this._currentCSGData);
        let material = this._sectionMaterials[sectionIndex];
        if (!material) {
            material = new WoodMaterial(`wood_section_${sectionIndex}`, this._scene);
            this._sectionMaterials[sectionIndex] = material;
        }
        material.updateTexturesAndGrain(species, grainAngle, finish_x, config, sectionIndex, this._textureCache);
        mesh.material = material;
    }

    /**
     * Reapply materials to visible section meshes.
     * Used after asymmetric toggle to sync materials with swapped state.
     */
    public reapplyVisibleMaterials(): void {
        // Apply materials to all visible asymmetric meshes
        for (let i = 0; i < this._sectionMeshes.length; i++) {
            const mesh = this._sectionMeshes[i];
            if (mesh.isEnabled()) {
                this.applySingleSectionMaterial(i);
            }
        }
    }

    public dispose(): void {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        this._sectionMeshes.forEach(mesh => mesh.dispose());
        this._sectionMaterials.forEach(mat => mat.dispose());
        this._sectionMeshes = [];
        this._sectionMaterials = [];
        this._engine.dispose();
    }
	
    public toggleZoom(zoomIn: boolean): void {
        let targetRadius = zoomIn ? this._camera.radius / 1.5 : this._camera.radius * 1.5;
        targetRadius = Math.max(this._camera.lowerRadiusLimit ?? 1, Math.min(targetRadius, this._camera.upperRadiusLimit ?? 1000));
        const anim = new Animation('camRadius', 'radius', 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
        anim.setKeys([{ frame: 0, value: this._camera.radius }, { frame: 20, value: targetRadius }]);
        const ease = new CubicEase();
        ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
        anim.setEasingFunction(ease);
        this._camera.animations = [anim];
        this._scene.beginAnimation(this._camera, 0, 20, false);
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
		
		private _calculateArchetypeCameraRadius(archetypeId: string): void {
        const constraints = this._controller.getConstraintsConfig();
        const resolver = this._controller.getResolver();
        
        if (constraints && resolver) {
            const archetypeConstraints = resolver.getArchetypeConstraints(archetypeId);
            
            if (archetypeConstraints) {
                let maxDimension = 0;
                
                const archetypes = constraints.archetype_constraints;
                const archetype = archetypes[archetypeId];
                
                if (archetype) {
                    if (archetype.size) {
                        maxDimension = archetype.size.max;
                    } else if (archetype.width && archetype.height) {
                        const maxWidth = archetype.width.max;
                        const maxHeight = archetype.height.max;
                        
                        if (archetype.interdependent) {
                            maxDimension = Math.sqrt(84 * 84 + 60 * 60);
                        } else {
                            maxDimension = Math.sqrt(maxWidth * maxWidth + maxHeight * maxHeight);
                        }
                    }
                    
                    const fov = this._camera.fov || 0.8;
                    const isMobile = window.innerWidth < 750;
                    const paddingFactor = isMobile ? 0.4 : 1.25; // 90% fill on mobile, 80% on desktop
                    const halfHeight = Math.tan(fov / 2);
                    const idealRadius = (maxDimension / 2) * paddingFactor / halfHeight;
                    
                    this._archetypeIdealRadius.set(archetypeId, idealRadius);
                }
            }
        }
    }
		
		private calculateIdealRadius(): number {
			const state = this._controller?.getState();
			const frameDesign = state?.composition?.frame_design;
			
			if (!frameDesign) {
					return 47;
			}
			
			const width = frameDesign.finish_x;
			const height = frameDesign.finish_y;
			const dominantDimension = Math.max(width, height);
			
			// Tighter framing on mobile (90% fill vs 67% on desktop)
			const isMobile = window.innerWidth < 750;
			const paddingFactor = isMobile ? 1.1 : 1.5;
				
				return Math.max(dominantDimension * paddingFactor, this._camera.lowerRadiusLimit ?? 20);
		}
  
    public resetCamera(): void {
        const targetRadius = this._idealCameraRadius;
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
        
        // Reset turntable rotation
        if (this._rootNode) {
            this._rootNode.rotation.y = 0;
        }
        
        // Show shadow plane
        if (this._shadowReceiverPlane) {
            this._shadowReceiverPlane.isVisible = true;
        }
    }
	
    public updateComposition(_newState: CompositionStateDTO): void {
        throw new Error('Method updateComposition() is not fully implemented and should be reviewed.');
    }

    public generateBackingIfEnabled(backingParams: BackingParameters | null, composition: CompositionStateDTO): void {
				
				PerformanceMonitor.start('generate_backing');
        
        if (!composition) {
            return;
        }
        
        if (!backingParams?.enabled || !backingParams.sections) {
            this.disposeBackingMeshes();
            return;
        }
        
        this.disposeBackingMeshes();
        this._backingMeshes = [];
        
        // Check for asymmetric pattern
        const asymmetricConfig = this._currentCSGData?.csg_data?.asymmetric_config;
        if (composition.pattern_settings.slot_style === 'asymmetric' && asymmetricConfig) {
            this._generateAsymmetricBacking(backingParams, asymmetricConfig);
            PerformanceMonitor.end('generate_backing');
            return;
        }
        
        // NOTE: Backing meshes must NOT cast shadows (receive only) to avoid blocking the wood panel's slot shadows.
        // They are intentionally excluded from this._shadowGenerator.addShadowCaster() calls.
        
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
            
            // CRITICAL: Apply rotation for ALL backing (matches wood panel rotation from cutSlots)
            // Wood panels get this normalization regardless of section count
            mesh.rotation.y = Math.PI;
            mesh.bakeCurrentTransformIntoVertices();
            
            // Set position AFTER baking (baking resets position to 0)
            mesh.position.y = section.position_y;
            
            // Apply material BEFORE parenting to prevent white flash
            const backingMaterial = new BackingMaterial(this._scene, backingParams);
            mesh.material = backingMaterial.getMaterial();
            
            mesh.parent = this._rootNode;
            mesh.receiveShadows = true;  // Enable backing to receive slot shadows
            
            this._backingMeshes.push(mesh);
        }
				
				PerformanceMonitor.end('generate_backing');
    }

    /**
     * Generate backing meshes for asymmetric pattern.
     * Creates 4 backing meshes (large_left, large_right, small_left, small_right)
     * with visibility matching wood panel state.
     */
    private _generateAsymmetricBacking(
        backingParams: BackingParameters,
        asymmetricConfig: { gap: number; large_finish_x: number; small_finish_x: number }
    ): void {
        const panelService = new PanelGenerationService(this._scene);
        const thickness = backingParams.sections[0].thickness;
        const positionY = backingParams.sections[0].position_y;
        const inset = backingParams.sections[0].inset || 0;
        const halfGap = asymmetricConfig.gap / 2.0;

        // Apply inset to backing dimensions (0.5" reveal at edges)
        const largeBackingSize = asymmetricConfig.large_finish_x - (2.0 * inset);
        const smallBackingSize = asymmetricConfig.small_finish_x - (2.0 * inset);

        // Create large backing panels
        // separation = 2*inset creates 0.5" inset on each straight edge
        const largeConfig = {
            finishX: largeBackingSize,
            finishY: largeBackingSize,
            thickness,
            separation: 2 * inset,
            numberSections: 2,
            shape: 'circular',
            slotStyle: 'radial'
        };
        const largePanels = panelService.createPanelsWithCSG(largeConfig, [], []);

        // Create small backing panels
        const smallConfig = {
            finishX: smallBackingSize,
            finishY: smallBackingSize,
            thickness,
            separation: 2 * inset,
            numberSections: 2,
            shape: 'circular',
            slotStyle: 'radial'
        };
        const smallPanels = panelService.createPanelsWithCSG(smallConfig, [], []);

        // Apply material and common setup to all backing meshes
        const setupBackingMesh = (mesh: Mesh, name: string, offsetX: number): void => {
            mesh.name = name;
            mesh.rotation.y = Math.PI;
            mesh.bakeCurrentTransformIntoVertices();
            mesh.position.x = offsetX;
            mesh.position.y = positionY;
            const backingMaterial = new BackingMaterial(this._scene, backingParams);
            mesh.material = backingMaterial.getMaterial();
            mesh.parent = this._rootNode;
            mesh.receiveShadows = true;
        };

        // Position backing meshes (same logic as wood panels)
        // Note: Visual left = +X, Visual right = -X in scene coordinate system
        setupBackingMesh(largePanels[0], 'backing_large_right', -halfGap);
        setupBackingMesh(largePanels[1], 'backing_large_left', halfGap);
        setupBackingMesh(smallPanels[0], 'backing_small_right', -halfGap);
        setupBackingMesh(smallPanels[1], 'backing_small_left', halfGap);

        // Set initial visibility to match wood panels (large left + small right)
        largePanels[0].setEnabled(false);  // large_right hidden
        largePanels[1].setEnabled(true);   // large_left visible
        smallPanels[0].setEnabled(true);   // small_right visible
        smallPanels[1].setEnabled(false);  // small_left hidden

        // Store in order: [small_right, large_left, large_right, small_left]
        // Matches wood panel _sectionMeshes order for material application
        this._backingMeshes = [smallPanels[0], largePanels[1], largePanels[0], smallPanels[1]];
    }
    
    private _createShadowReceiver(csgData: SmartCsgResponse): void {
        const bgState = this._controller.getState().ui.currentBackground;
        const bgConfig = this._controller.getBackgroundsConfig();
        const background = bgConfig?.categories.rooms.find(bg => bg.id === bgState.id);
        const shadowDarkness = background?.lighting?.shadow_darkness ?? 0.4;
        
        const receiverSize = 200;
        this._shadowReceiverPlane = MeshBuilder.CreatePlane('shadowReceiver', { size: receiverSize }, this._scene);
        
        this._shadowReceiverPlane.rotation = new Vector3(Math.PI / 2, Math.PI, 0);
        this._shadowReceiverPlane.bakeCurrentTransformIntoVertices();
        
        let finalYPos: number;
        const backingEnabled = csgData.updated_state?.frame_design?.backing?.enabled ?? false;
        const backingSection = csgData.backing_parameters?.sections?.[0];
        if (backingEnabled && backingSection) {
            const backingThickness = backingSection.thickness;
            const backingCenterY = backingSection.position_y;
            finalYPos = backingCenterY - (backingThickness / 2) - 0.001;
        } else if (csgData.csg_data?.panel_config) {
            const panelThickness = csgData.csg_data.panel_config.thickness;
            finalYPos = -(panelThickness / 2) - 0.001;
        } else {
            finalYPos = -1.0;
        }
        // Use config position if provided, otherwise auto-calculated
        if (background?.lighting?.shadow_receiver_position) {
            const pos = background.lighting.shadow_receiver_position;
            this._shadowReceiverPlane.position = new Vector3(pos[0], pos[1], pos[2]);
        } else {
            this._shadowReceiverPlane.position = new Vector3(0, finalYPos, 0);
        }
        
        const shadowMat = new BackgroundMaterial("shadowReceiverMat", this._scene);
        shadowMat.shadowLevel = shadowDarkness;
        shadowMat.useRGBColor = false;
        shadowMat.primaryColor = Color3.Black();
        shadowMat.alpha = 1.0;
        shadowMat.opacityFresnel = false;
        (shadowMat as unknown as { shadowOnly: boolean }).shadowOnly = true;
        this._shadowReceiverPlane.material = shadowMat;
        
        if (this._hemisphericLight) {
            this._hemisphericLight.excludedMeshes.push(this._shadowReceiverPlane);
        }
        
        this._shadowReceiverPlane.parent = this._rootNode;
        this._shadowReceiverPlane.receiveShadows = true;
    }
		
		private createBackingMesh(
        section: NonNullable<BackingParameters['sections']>[0],
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
		
		public applyArtPlacement(placement: ArtPlacement): void {
        if (!this._rootNode) {
            console.warn('[SceneManager] Root node not available for art placement');
            return;
						
        }
				
				PerformanceMonitor.start('apply_art_placement');

        const state = this._controller.getState();
        const frameDesign = state?.composition?.frame_design;

        // Determine Y offset based on anchor mode (default: bottom for backward compatibility)
        const anchorMode = (placement as { anchor?: string }).anchor || 'bottom';
        let yOffset = 0;
        
        if (anchorMode === 'bottom') {
            // Bottom anchor: position is bottom edge, add half-height to get center
            yOffset = (frameDesign ? (frameDesign.shape === 'circular' ? Math.min(frameDesign.finish_x, frameDesign.finish_y) / 2 : frameDesign.finish_y / 2) : 0) * placement.scale_factor;
        }
        // Center anchor: position IS center, no offset needed
        
        const targetPosition = new Vector3(
            placement.position[0],
            placement.position[1] + yOffset,
            placement.position[2]
        );

        // When turntable mode is active, set pole position instead of rootNode
        if (this._turntableEnabled && this._turntablePole) {
            this._turntablePole.position = targetPosition;
            this._rootNode.position = Vector3.Zero();
        } else {
            this._rootNode.position = targetPosition;
        }

        // Apply scale factor
        const targetScale = placement.scale_factor;
        this._rootNode.scaling = new Vector3(targetScale, targetScale, targetScale);

        // Apply rotation
        const rotX = placement.rotation[0] * Math.PI / 180;
        const rotY = placement.rotation[1] * Math.PI / 180;
        const rotZ = placement.rotation[2] * Math.PI / 180;
        
        // Preserve the existing X rotation (Math.PI / 2) and add placement rotation
        this._rootNode.rotation = new Vector3(
            Math.PI / 2 + rotX,
            rotY,
            rotZ
        );
        
        const archetypeId = state?.composition?.archetype_id || null;
        const scaleFactor = placement.scale_factor || 1.0;
        
        if (archetypeId && archetypeId !== this._currentArchetypeId) {
            this._currentArchetypeId = archetypeId;
            this._calculateArchetypeCameraRadius(archetypeId);
        }
        
        // Apply cached archetype radius with scene scale adjustment
        const baseRadius = this._archetypeIdealRadius.get(archetypeId || '') || this._baseCameraRadius;
        // Mobile (portrait): tighter framing to fill narrow canvas
        const isMobile = window.innerWidth < 750;
        const mobileFactor = isMobile ? 0.5 : 1.0;
        this._idealCameraRadius = (baseRadius / scaleFactor) * mobileFactor;
        
        // Establish current aspect ratio as new baseline
        const canvas = this._engine.getRenderingCanvas();
        if (canvas && canvas.width > 0 && canvas.height > 0) {
            this._baselineAspectRatio = canvas.width / canvas.height;
            this._baseRadiusBeforeAspect = this._idealCameraRadius;
            this._camera.radius = this._idealCameraRadius;
        } else {
            this._camera.radius = this._idealCameraRadius;
        }
				
				// Reposition shadow receiver to stay behind artwork
        if (this._shadowReceiverPlane) {
            this._shadowReceiverPlane.parent = this._rootNode;
            
            // Get lighting config from current background
            const bgState = this._controller.getState().ui.currentBackground;
            const bgConfig = this._controller.getBackgroundsConfig();
            const background = bgConfig?.categories.rooms.find(bg => bg.id === bgState.id);
            const shadowDarkness = background?.lighting?.shadow_darkness ?? 0.4;
            
            // Position shadow receiver 0.001" behind backing (if enabled) or panel bottom
            let finalYPos: number;
            const backingEnabled = state?.composition?.frame_design?.backing?.enabled ?? false;
            const currentBackingSection = this._currentCSGData?.backing_parameters?.sections?.[0];
            if (backingEnabled && currentBackingSection) {
                // Get backing thickness and position
                const backingThickness = currentBackingSection.thickness;
                const backingCenterY = currentBackingSection.position_y;
                // Position 0.001" behind backing bottom surface
                finalYPos = backingCenterY - (backingThickness / 2) - 0.001;
            } else if (this._currentCSGData?.csg_data?.panel_config) {
                // No backing - position 0.001" behind wood panel bottom surface
                const panelThickness = this._currentCSGData.csg_data.panel_config.thickness;
                finalYPos = -(panelThickness / 2) - 0.001;
            } else {
                // Fallback - default position behind artwork
                finalYPos = -1.0;
            }
            
            // Set position AFTER reparenting (prevents coordinate space corruption)
            // Use config position if provided, otherwise auto-calculated
            
            if (background?.lighting?.shadow_receiver_position) {
                const pos = background.lighting.shadow_receiver_position;
                this._shadowReceiverPlane.position = new Vector3(pos[0], pos[1], pos[2]);
            } else {
                this._shadowReceiverPlane.position = new Vector3(0, finalYPos, 0);
            }
            this._shadowReceiverPlane.rotation = Vector3.Zero();
            
            // Counteract parent scaling to maintain constant world-space size
            const parentScale = this._rootNode.scaling.x;
            this._shadowReceiverPlane.scaling = new Vector3(1/parentScale, 1/parentScale, 1/parentScale);
            
            // Update material shadowLevel to match current background config
            if (this._shadowReceiverPlane.material) {
                this._shadowReceiverPlane.material.shadowLevel = shadowDarkness;
            }
        }
        
        // Reposition directional light to maintain shadow camera relationship
        if (this._directionalLight && this._shadowGenerator) {
            const lightDirection = this._directionalLight.direction.clone().normalize();
            this._directionalLight.position = this._rootNode.position.subtract(lightDirection.scale(50));
            
            // Recalculate frustum for new artwork dimensions
            const artworkDimension = frameDesign ? Math.max(frameDesign.finish_x, frameDesign.finish_y) : 60;
            const scaleFactor = this._rootNode?.scaling.x ?? 1.0;
            const frustumSize = ((artworkDimension * scaleFactor * 0.6) + 10);
            this._directionalLight.orthoLeft = -frustumSize;
            this._directionalLight.orthoRight = frustumSize;
            this._directionalLight.orthoTop = frustumSize;
            this._directionalLight.orthoBottom = -frustumSize;
        }
				
				PerformanceMonitor.end('apply_art_placement');
    }
		
		private _positionShadowReceiver(lighting: LightingConfig): void {
        if (!this._shadowReceiverPlane) return;
        
        if (lighting.shadow_receiver_position) {
            // Use explicit coordinates from config
            this._shadowReceiverPlane.position = new Vector3(
                lighting.shadow_receiver_position[0],
                lighting.shadow_receiver_position[1],
                lighting.shadow_receiver_position[2]
            );
        } else {
            // Auto-position: 5 units behind artwork's actual position
            const artworkPos = this._rootNode?.position || new Vector3(0, 0, 0);
            this._shadowReceiverPlane.position = new Vector3(
                artworkPos.x,
                artworkPos.y,
                artworkPos.z - 5
            );
        }
    }
		
		public applyLighting(lighting: LightingConfig): void {
        if (!this._directionalLight || !this._hemisphericLight) return;

        // 1. NORMALIZE LIGHT DIRECTION
        // SHADOW FIX: Apply direction directly from config without transformation
        // The config values [1.0, -0.5, -1.0] were proven correct via console diagnostics
        // Previous code was inverting Y and Z, causing shadows to appear on wrong side
        const lightDirection = new Vector3(
            lighting.direction[0],
            lighting.direction[1],
            lighting.direction[2]
        ).normalize();
        this._directionalLight.direction = lightDirection;
        this._directionalLight.intensity = lighting.intensity ?? 2.0;
        
        // Move light back along its vector so shadows don't get clipped
        const artworkPosition = this._rootNode?.position || Vector3.Zero();
        this._directionalLight.position = artworkPosition.subtract(lightDirection.scale(50));
        
        // SHADOW FIX: Manually define orthographic frustum to prevent shadow clipping
        // Root cause: autoCalcShadowZBounds was truncating shadows at bottom/left edges
        this._directionalLight.autoCalcShadowZBounds = false;
        this._directionalLight.shadowMinZ = 0;
        this._directionalLight.shadowMaxZ = 200;  // Deep enough for all artwork positions
				
				// CRITICAL: Disable automatic X/Y frustum recalculation
        // autoUpdateExtends causes BabylonJS to override orthoLeft/Right/Top/Bottom every frame
        this._directionalLight.autoUpdateExtends = false;
        
        // Calculate dynamic frustum size based on actual artwork dimensions
        // Always calculate dynamically - ignore config value to ensure shadows scale with artwork
        const state = this._controller.getState();
        const frameDesign = state?.composition?.frame_design;
        const artworkDimension = frameDesign ? Math.max(frameDesign.finish_x, frameDesign.finish_y) : 60;
        const scaleFactor = this._rootNode?.scaling.x ?? 1.0;
        const frustumSize = ((artworkDimension * scaleFactor * 0.6) + 10);
        this._directionalLight.orthoLeft = -frustumSize;
        this._directionalLight.orthoRight = frustumSize;
        this._directionalLight.orthoTop = frustumSize;
        this._directionalLight.orthoBottom = -frustumSize;

        // Ambient boost
        this._hemisphericLight.intensity = 1.0 + (lighting.ambient_boost ?? 0);
        
        // Sky color (light from above)
        if (lighting.hemispheric_sky_color) {
            this._hemisphericLight.diffuse = new Color3(
                lighting.hemispheric_sky_color[0],
                lighting.hemispheric_sky_color[1],
                lighting.hemispheric_sky_color[2]
            );
        }
        
        // Ground color (bounce light from floor)
        if (lighting.ambient_ground_color) {
            this._hemisphericLight.groundColor = new Color3(
                lighting.ambient_ground_color[0],
                lighting.ambient_ground_color[1],
                lighting.ambient_ground_color[2]
            );
        }

        // 2. SHADOW CONFIGURATION
        if (lighting.shadow_enabled) {
            const shadowResolution = lighting.shadow_map_resolution ?? 4096;
            if (!this._shadowGenerator) {
                this._shadowGenerator = new ShadowGenerator(shadowResolution, this._directionalLight);
            } else {
                // Enforce resolution if generator already exists
                const currentMap = this._shadowGenerator.getShadowMap();
                if (currentMap && currentMap.getSize().width !== shadowResolution) {
                    this._shadowGenerator.dispose();
                    this._shadowGenerator = new ShadowGenerator(shadowResolution, this._directionalLight);
                }
            }
            
            // SHADOW FIX: Clear and rebuild caster list to ensure only wood panels cast shadows
            // This prevents backing panels from blocking shadows and ensures proper caster registration after lighting changes
            this._shadowGenerator.getShadowMap()!.renderList = [];
            this._sectionMeshes.forEach(mesh => {
                this._shadowGenerator!.addShadowCaster(mesh);
            });
            
            // SHADOW FIX: Update quality settings for thin geometry
            // Higher bias values prevent z-fighting on flat surfaces while maintaining shadow definition
            this._shadowGenerator.blurScale = lighting.shadow_blur ?? 1;
            this._shadowGenerator.darkness = lighting.shadow_darkness ?? 0.4;
            
            // Apply filter mode from config (default: pcf for high-quality product visualization)
            const filterMode = lighting.shadow_filter_mode ?? 'pcf';
            this._shadowGenerator.useBlurExponentialShadowMap = false;
            this._shadowGenerator.usePercentageCloserFiltering = false;
            this._shadowGenerator.useContactHardeningShadow = false;
            
            if (filterMode === 'exponential') {
                this._shadowGenerator.useBlurExponentialShadowMap = true;
            } else if (filterMode === 'pcf') {
                this._shadowGenerator.usePercentageCloserFiltering = true;
                this._shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_HIGH;
            } else if (filterMode === 'contact_hardening') {
                this._shadowGenerator.useContactHardeningShadow = true;
                this._shadowGenerator.contactHardeningLightSizeUVRatio = 0.05;
                this._shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_HIGH;
            }
            
            this._shadowGenerator.bias = 0.0005;  // Increased from 0.0001 to prevent self-shadowing artifacts
            this._shadowGenerator.normalBias = 0.003;  // Additional bias for thin geometry

            // 3. SHADOW RECEIVER (The Invisible Wall)
            if (this._shadowReceiverPlane) {
                this._shadowReceiverPlane.dispose();
                this._shadowReceiverPlane = null;
            }
            const receiverSize = 200; // Global constant - large enough for all artwork sizes
                this._shadowReceiverPlane = MeshBuilder.CreatePlane('shadowReceiver', { size: receiverSize }, this._scene);
                
                // Apply rotation matching wood panel geometry pipeline
                // X=90° aligns Plane normal with Cylinder caps, Y=180° matches wood flip
                this._shadowReceiverPlane.rotation = new Vector3(Math.PI / 2, Math.PI, 0);
                
                // CRITICAL: Bake rotation into vertices (matches wood panel construction)
                this._shadowReceiverPlane.bakeCurrentTransformIntoVertices();
                
                // Reset rotation to zero (now baked into geometry)
                this._shadowReceiverPlane.rotation = Vector3.Zero();
                
                // Parent to root node
                this._shadowReceiverPlane.parent = this._rootNode;
                
                // Counteract parent scaling to maintain constant world-space size
                const parentScale = this._rootNode?.scaling.x ?? 1.0;
                this._shadowReceiverPlane.scaling = new Vector3(1/parentScale, 1/parentScale, 1/parentScale);
                
                // Position close behind artwork in Local Y (maps to World Z depth)
								if (lighting.shadow_receiver_position) {
										this._shadowReceiverPlane.position = new Vector3(
												lighting.shadow_receiver_position[0],
												lighting.shadow_receiver_position[1],
												lighting.shadow_receiver_position[2]
										);
								} else {
										// --- FIX: Match depth logic from _createShadowReceiver ---
										let finalYPos = -1.0;
										
										// Use current panel thickness for tight shadow fit (e.g. -0.25 instead of -1.0)
										if (this._currentCSGData?.csg_data?.panel_config) {
												const thickness = this._currentCSGData.csg_data.panel_config.thickness;
												finalYPos = -(thickness / 2) - 0.001;
										}
										
										this._shadowReceiverPlane.position = new Vector3(0, finalYPos, 0);
								}
                
                // --- FIX 2: Restore the Background ---
                // We use BackgroundMaterial. 
                // By default, it renders transparently but catches shadows.
                const shadowMat = new BackgroundMaterial("shadowReceiverMat", this._scene);
                shadowMat.shadowLevel = lighting.shadow_darkness;
                shadowMat.useRGBColor = false;
                shadowMat.primaryColor = Color3.Black(); // Black for dark shadows on transparent canvas
                shadowMat.alpha = 1.0;
                shadowMat.opacityFresnel = false;
                (shadowMat as unknown as { shadowOnly: boolean }).shadowOnly = true; // Forces shadow-only rendering on transparent canvas
                
                this._shadowReceiverPlane.material = shadowMat;
                // Prevent ambient light from turning the plane white/gray
                if (this._hemisphericLight) {
                    this._hemisphericLight.excludedMeshes.push(this._shadowReceiverPlane);
                }
                this._shadowReceiverPlane.receiveShadows = true;
        } else {
            if (this._shadowGenerator) {
                this._shadowGenerator.dispose();
                this._shadowGenerator = null;
            }
            if (this._shadowReceiverPlane) {
                this._shadowReceiverPlane.dispose();
                this._shadowReceiverPlane = null;
            }
        }
    }

    public resetLighting(): void {
        if (!this._directionalLight || !this._hemisphericLight) return;

        // Restore universal defaults (Matches Golden Vector)
        this._directionalLight.direction = new Vector3(1.0, -0.5, -1.0).normalize();
        this._directionalLight.intensity = 2.0;
        this._hemisphericLight.intensity = 1.0;

        // Disable shadows
        if (this._shadowGenerator) {
            this._shadowGenerator.dispose();
            this._shadowGenerator = null;
        }
        if (this._shadowReceiverPlane) {
            this._shadowReceiverPlane.dispose();
            this._shadowReceiverPlane = null;
        }
    }
    
    public resetArtPlacement(): void {
        if (!this._rootNode) return;
        
        this._rootNode.position = new Vector3(0, 0, 0);
        this._rootNode.scaling = new Vector3(1, 1, 1);
        this._rootNode.rotation = new Vector3(Math.PI / 2, 0, 0);
        
        const state = this._controller.getState();
        const frameDesign = state?.composition?.frame_design;
        
        if (frameDesign) {
            const width = frameDesign.finish_x;
            const height = frameDesign.finish_y;
            const currentDimension = Math.max(width, height);
            
            const fov = this._camera.fov || 0.8;
            // Mobile (portrait): tighter framing to fill narrow width
            const isMobile = window.innerWidth < 750;
            const paddingFactor = isMobile ? 0.7 : 1.25;
            const halfHeight = Math.tan(fov / 2);
            const idealRadius = (currentDimension / 2) * paddingFactor / halfHeight;
            
            this._idealCameraRadius = idealRadius;
            this._camera.radius = this._idealCameraRadius;
        } else {
            this._idealCameraRadius = this._baseCameraRadius;
            this._camera.radius = this._idealCameraRadius;
        }
    }


		/**
		 * Export current panel geometry as GLB for Blender rendering.
		 * Preserves mesh geometry, UVs, and material metadata.
		 * 
		 * @returns Promise containing GLB blob and material config for Blender
		 */
		public async exportForBlenderRender(): Promise<{
				glb: Blob;
				config: {
						panel_config: object;
						section_materials: Array<{
								section_id: number;
								species: string;
								grain_direction: string;
								grain_angle?: number;
								mesh_name: string;
						}>;
						backing_enabled: boolean;
						backing_material?: object;
				};
		}> {
				if (!this._currentCSGData || this._sectionMeshes.length === 0) {
						throw new Error('No panel geometry to export. Render a panel first.');
				}

				// Collect meshes to export
				const exportMeshes: Mesh[] = [];
				const sectionMaterials: Array<{
						section_id: number;
						species: string;
						grain_direction: string;
						mesh_name: string;
				}> = [];

				// Get current state for material info
				const state = this._controller.getState();
				const materials = state?.composition?.frame_design?.section_materials || [];

				// Tag section meshes with material metadata
				this._sectionMeshes.forEach((mesh, index) => {
						mesh.name = `section_${index}`;
						exportMeshes.push(mesh);

						const matConfig = materials.find(m => m.section_id === index);
						const grainDirection = matConfig?.grain_direction || 'vertical';
						
						// Compute grain angle (same as applySectionMaterials)
						const grainAngle = calculateGrainAngle(
								grainDirection as 'horizontal' | 'vertical' | 'radiant' | 'diamond',
								index,
								this._sectionMeshes.length,
								this._controller.getWoodMaterialsConfig(),
								this._currentCSGData
						);
						
						sectionMaterials.push({
								section_id: index,
								species: matConfig?.species || 'walnut-black-american',
								grain_direction: grainDirection,
								grain_angle: grainAngle,
								mesh_name: mesh.name
						});
				});

				// Include backing meshes if present
				if (this._backingMeshes && this._backingMeshes.length > 0) {
						this._backingMeshes.forEach((mesh, index) => {
								mesh.name = `backing_${index}`;
								exportMeshes.push(mesh);
						});
				}

				// Create temporary parent for export
        const exportRoot = new TransformNode('export_root', this._scene);
        // Match rootNode rotation so panel faces camera in exported file
        if (this._rootNode) {
            exportRoot.rotation = this._rootNode.rotation.clone();
        }
        const originalParents: (TransformNode | null)[] = [];
        const originalMaterials: (Material | null)[] = [];

        // Create lightweight dummy material (no textures to embed)
        const dummyMat = new StandardMaterial('export_dummy', this._scene);
        dummyMat.diffuseColor = new Color3(0.5, 0.5, 0.5);
        dummyMat.specularColor = new Color3(0, 0, 0);

        exportMeshes.forEach(mesh => {
            originalParents.push(mesh.parent as TransformNode | null);
            originalMaterials.push(mesh.material);
            mesh.material = dummyMat;  // Swap to prevent texture embedding
            mesh.parent = exportRoot;
        });

				try {
						// Export to GLB
						const glb = await GLTF2Export.GLBAsync(this._scene, 'wavedesigner_panel', {
								shouldExportNode: (node) => {
                // Only export visible panel meshes (respects asymmetric toggle state)
                if (node === exportRoot) return true;
                const isPanel = node.name.startsWith('section_') || 
                                node.name.startsWith('backing_') ||
                                node.name.startsWith('asymmetric_');
                if (!isPanel) return false;
                // Filter by visibility - asymmetric uses setEnabled() to toggle pairs
                return (node as Mesh).isEnabled?.() ?? true;
            },
								exportWithoutWaitingForScene: false,
								includeCoordinateSystemConversionNodes: false,
                shouldExportTexture: () => false
            });

						// Get the GLB blob
						const glbBlob = glb.glTFFiles['wavedesigner_panel.glb'] as Blob;

						// Build config for Blender material application
						const config = {
								panel_config: this._currentCSGData.csg_data.panel_config,
								section_materials: sectionMaterials,
								backing_enabled: this._backingMeshes && this._backingMeshes.length > 0,
								backing_material: (this._currentCSGData.backing_parameters as BackingParameters | undefined)?.material_properties
						};

						return { glb: glbBlob, config };

				} finally {
						// Restore original parenting and materials
						exportMeshes.forEach((mesh, index) => {
								mesh.parent = originalParents[index];
								mesh.material = originalMaterials[index];
						});
						dummyMat.dispose();
						exportRoot.dispose();
				}
		}

		/**
		 * Download panel as GLB + config JSON bundle for Blender rendering.
		 * Triggered by UI "Export for Render" button.
		 */
		public async downloadForBlenderRender(): Promise<void> {
				try {
						const { glb, config } = await this.exportForBlenderRender();

						// Download GLB
						const glbUrl = URL.createObjectURL(glb);
						const glbLink = document.createElement('a');
						glbLink.href = glbUrl;
						glbLink.download = 'panel_export.glb';
						glbLink.click();
						URL.revokeObjectURL(glbUrl);

						// Download config JSON
						const configBlob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
						const configUrl = URL.createObjectURL(configBlob);
						const configLink = document.createElement('a');
						configLink.href = configUrl;
						configLink.download = 'panel_config.json';
						configLink.click();
						URL.revokeObjectURL(configUrl);
				} catch (error) {
						console.error('[SceneManager] Export failed:', error);
						throw error;
				}
		}	
}