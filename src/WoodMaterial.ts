import { 
    PBRMaterial,
    Scene,
    Texture
} from '@babylonjs/core';
import type { WoodMaterialsConfig } from './types/schemas';
import { PerformanceMonitor } from './PerformanceMonitor';

/**
 * Custom wood material class that extends PBRMaterial.
 * Designed to support multiple wood species and future custom shader implementations
 * including Tri-Planar mapping for CSG-cut surfaces.
 * 
 * ARCHITECTURE NOTE: This class has NO hardcoded constants. All configuration
 * is provided via parameters from the backend ConfigService through the frontend
 * ApplicationController. This maintains the single source of truth principle.
 */
export class WoodMaterial extends PBRMaterial {
    private scene: Scene;
    private currentSpecies: string | null = null;
    
    // Texture references for potential shader access
    private albedoMap: Texture | null = null;
    private normalMap: Texture | null = null;
    private roughnessMap: Texture | null = null;
    
    constructor(name: string, scene: Scene) {
        super(name, scene);
        this.scene = scene;
        
        // Initialize base PBR properties
        this.metallic = 0;
        this.roughness = 1.0;
        
        // Prepare for future custom shader implementation
        this.prepareCustomShaderHooks();
    }
    
    /**
     * Updates the material textures and grain rotation for a specific wood species.
     * @param species - The wood species identifier (e.g., "walnut-black-american")
     * @param grainAngleDeg - Grain rotation angle in degrees (0-360)
     * @param panelDimension - Panel dimension for texture size selection
     * @param config - Wood materials configuration from backend
     * @param textureCache - Texture cache service for efficient texture loading
     */
    public updateTexturesAndGrain(
        species: string, 
        grainAngleDeg: number, 
        panelDimension: number,
        config: WoodMaterialsConfig,
        textureCache?: { getTexture: (path: string) => Texture }
    ): void {
        PerformanceMonitor.start(`material_update_${species}`);
        console.log(`[WoodMaterial] Loading: ${species}, grain: ${grainAngleDeg}°, dimension: ${panelDimension}"`);
        
        this.currentSpecies = species;
        
        // Generate random UV offsets for visual variety
        const randomUOffset = Math.random();
        const randomVOffset = Math.random();
        
        // Select appropriate texture size
        const size = this.selectTextureSize(panelDimension, config);
        
        // Load textures with grain rotation and random offsets
        this.loadWoodTextures(species, size, grainAngleDeg, config, randomUOffset, randomVOffset, textureCache);
    }
    
    /**
     * Select appropriate texture size based on panel dimension.
     * NOTE: Always returns 'large' for best quality and simpler caching.
     * Random UV offsets prevent repetitive appearance across sections.
     */
    private selectTextureSize(_dimension: number, _config: WoodMaterialsConfig): string {
        return 'large';
    }
    
    /**
     * Universal wood texture loader using consistent directory structure.
     */
    private loadWoodTextures(
        species: string, 
        size: string, 
        grainAngleDeg: number, 
        config: WoodMaterialsConfig,
        randomUOffset: number,
        randomVOffset: number,
        textureCache?: { getTexture: (path: string) => Texture }
    ): void {
        const basePath = config.texture_config.base_texture_path;
        const assetRoot = `${basePath}/${species}/`;
        
        const sizeConfig = config.texture_config.size_map[size];
        if (!sizeConfig) {
            console.error(`[WoodMaterial] Invalid size: ${size}`);
            return;
        }
        
        // Get wood number for this species
        const speciesInfo = config.species_catalog.find(s => s.id === species);
        if (!speciesInfo) {
            console.error(`[WoodMaterial] Unknown species: ${species}`);
            return;
        }
        const woodNumber = speciesInfo.wood_number;
        
        const sizeFolder = sizeConfig.folder;
        const dimensions = sizeConfig.dimensions;

        // Calculate grain rotation (add offset from config)
        const rotationOffset = config.rendering_config.grain_rotation_offset_degrees;
        const totalRotationDeg = grainAngleDeg + rotationOffset;
        const grainRotationRad = (totalRotationDeg * Math.PI) / 180;
        
        // DO NOT dispose old textures when using cache - they're shared!
        // The TextureCacheService manages texture lifecycle
        // Only set references to null to allow garbage collection of the reference
        this.albedoMap = null;
        this.normalMap = null;
        this.roughnessMap = null;
        
        // Construct texture paths
        const albedoPath = `${assetRoot}Varnished/${sizeFolder}/Diffuse/wood-${woodNumber}_${species}-varnished-${dimensions}_d.png`;
        const normalPath = `${assetRoot}Shared_Maps/${sizeFolder}/Normal/wood-${woodNumber}_${species}-${dimensions}_n.png`;
        const roughnessPath = `${assetRoot}Shared_Maps/${sizeFolder}/Roughness/wood-${woodNumber}_${species}-${dimensions}_r.png`;
        
        console.log(`[WoodMaterial] Loading albedo from: ${albedoPath}`);
        
        // Use texture cache if available, otherwise load directly
        if (textureCache) {
            this.albedoMap = textureCache.getTexture(albedoPath);
            this.normalMap = textureCache.getTexture(normalPath);
            this.roughnessMap = textureCache.getTexture(roughnessPath);
        } else {
            // Fallback: load without cache
            this.albedoMap = new Texture(
                albedoPath, 
                this.scene, 
                undefined, undefined, undefined, 
                () => { console.log(`[WoodMaterial] Albedo loaded successfully`); },
                (message) => { console.error(`[WoodMaterial] Albedo load failed: ${message}`); }
            );
            this.normalMap = new Texture(normalPath, this.scene);
            this.roughnessMap = new Texture(roughnessPath, this.scene);
        }
        
        // Configure albedo/diffuse texture
        this.albedoMap.wrapU = Texture.WRAP_ADDRESSMODE;
        this.albedoMap.wrapV = Texture.WRAP_ADDRESSMODE;
        this.albedoMap.wAng = grainRotationRad;
        this.albedoMap.uOffset = randomUOffset;
        this.albedoMap.vOffset = randomVOffset;
        this.albedoTexture = this.albedoMap;
        
        // Configure normal map
        this.normalMap.wAng = grainRotationRad;
        this.normalMap.uOffset = randomUOffset;
        this.normalMap.vOffset = randomVOffset;
        this.bumpTexture = this.normalMap;
        
        // Configure roughness texture
        this.roughnessMap.wAng = grainRotationRad;
        this.roughnessMap.uOffset = randomUOffset;
        this.roughnessMap.vOffset = randomVOffset;
        this.metallicTexture = this.roughnessMap;
        this.useRoughnessFromMetallicTextureGreen = true;
        
        console.log(`[WoodMaterial] Textures loaded for ${species}`);
        PerformanceMonitor.end(`material_update_${species}`);
    }
    
    /**
     * Prepares the material for future custom shader implementation.
     * This method sets up the hooks and structure needed for Tri-Planar mapping
     * and other custom shader effects.
     */
    private prepareCustomShaderHooks(): void {
        // Future implementation notes:
        // 1. This is where we'll inject custom vertex/fragment shader code
        // 2. We'll add uniforms for controlling UV vs Tri-Planar modes
        // 3. We'll add parameters for CSG cut detection
        
        // Placeholder for custom uniforms that will be needed
        // These will be used when implementing the custom shader
        this.customShaderNameResolve = (shaderName: string, _uniforms: string[], _uniformBuffers: string[], 
                                       _samplers: string[], _defines: unknown) => {
            // Future: Add custom uniforms here
            // uniforms.push("woodGrainScale");
            // uniforms.push("triPlanarBlend");
            // uniforms.push("isCutSurface");
            
            return shaderName;
        };
        
        // Future: Hook for vertex shader modifications
        // this.onBindObservable.add(() => {
        //     // Set custom uniform values here
        // });
    }
    
    /**
     * Gets the current wood species
     */
    public getCurrentSpecies(): string | null {
        return this.currentSpecies;
    }
    
    /**
     * Disposes of the material and its textures
     */
    public dispose(): void {
        if (this.albedoMap) {
            this.albedoMap.dispose();
            this.albedoMap = null;
        }
        if (this.normalMap) {
            this.normalMap.dispose();
            this.normalMap = null;
        }
        if (this.roughnessMap) {
            this.roughnessMap.dispose();
            this.roughnessMap = null;
        }
        
        super.dispose();
    }
}