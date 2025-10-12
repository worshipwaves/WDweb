import { 
    PBRMaterial,
    Scene,
    Texture
} from '@babylonjs/core';
import type { WoodMaterialsConfig } from './types/schemas';

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
     */
    public updateTexturesAndGrain(
        species: string, 
        grainAngleDeg: number, 
        panelDimension: number,
        config: WoodMaterialsConfig
    ): void {
        console.log(`[WoodMaterial] Loading: ${species}, grain: ${grainAngleDeg}°, dimension: ${panelDimension}"`);
        
        this.currentSpecies = species;
        
        // Select appropriate texture size
        const size = this.selectTextureSize(panelDimension, config);
        
        // Load textures with grain rotation
        this.loadWoodTextures(species, size, grainAngleDeg, config);
    }
    
    /**
     * Select appropriate texture size based on panel dimension.
     */
    private selectTextureSize(dimension: number, config: WoodMaterialsConfig): string {
        const thresholds = config.texture_config.size_thresholds_inches;
        if (dimension <= thresholds.small) {
            return 'small';
        } else if (dimension <= thresholds.medium) {
            return 'medium';
        } else {
            return 'large';
        }
    }
    
    /**
     * Universal wood texture loader using consistent directory structure.
     */
    private loadWoodTextures(
        species: string, 
        size: string, 
        grainAngleDeg: number, 
        config: WoodMaterialsConfig
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
        
        // Dispose old textures
        if (this.albedoMap) {
            this.albedoMap.dispose();
        }
        if (this.normalMap) {
            this.normalMap.dispose();
        }
        if (this.roughnessMap) {
            this.roughnessMap.dispose();
        }
        
        // Varnished Albedo/Diffuse texture
        const albedoPath = `${assetRoot}Varnished/${sizeFolder}/Diffuse/wood-${woodNumber}_${species}-varnished-${dimensions}_d.png`;
        console.log(`[WoodMaterial] Loading albedo from: ${albedoPath}`);
        this.albedoMap = new Texture(
            albedoPath, 
            this.scene, 
            undefined, undefined, undefined, 
            () => { console.log(`[WoodMaterial] Albedo loaded successfully`); },
            (message) => { console.error(`[WoodMaterial] Failed to load albedo:`, message); }
        );
        this.albedoMap.wAng = grainRotationRad;
        this.albedoTexture = this.albedoMap;
        
        // Normal map
        this.normalMap = new Texture(
            `${assetRoot}Shared_Maps/${sizeFolder}/Normal/wood-${woodNumber}_${species}-${dimensions}_n.png`,
            this.scene
        );
        this.normalMap.wAng = grainRotationRad;
        this.bumpTexture = this.normalMap;
        
        // Roughness texture
        this.roughnessMap = new Texture(
            `${assetRoot}Shared_Maps/${sizeFolder}/Roughness/wood-${woodNumber}_${species}-${dimensions}_r.png`,
            this.scene
        );
        this.roughnessMap.wAng = grainRotationRad;
        this.metallicTexture = this.roughnessMap;
        this.useRoughnessFromMetallicTextureGreen = true;
        
        console.log(`[WoodMaterial] Textures loaded for ${species}`);
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