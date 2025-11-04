/**
 * TextureCacheService - Pre-loads and caches wood textures
 * 
 * Prevents repeated texture downloads by maintaining a cache of Texture instances.
 * All textures are pre-loaded on application startup in the background.
 */

import { Texture, Scene } from '@babylonjs/core';

import { IdleTextureLoader } from './IdleTextureLoader';
import { PerformanceMonitor } from './PerformanceMonitor';
import type { WoodMaterialsConfig } from './types/schemas';

export class TextureCacheService {
  private _textureCache: Map<string, Texture> = new Map();
  private _scene: Scene;
  
  constructor(scene: Scene) {
    this._scene = scene;
  }
  
  /**
   * Get texture from cache, or load and cache if not present
   */
  /**
   * Get texture from cache, or load and cache if not present.
   * Returns a CLONE to prevent shared state issues (each material
   * needs independent rotation/offset properties).
   */
  getTexture(path: string): Texture {
    // Check cache first
    const cached = this._textureCache.get(path);
    if (cached) {
      // Return clone so each material can modify independently
      return cached.clone();
    }
    
    // Not in cache - load and cache it
    const texture = new Texture(path, this._scene);
    this._textureCache.set(path, texture);
    
    // Return clone (GPU data shared, wrapper independent)
    return texture.clone();
  }
  
  /**
   * Pre-load wood textures with aggressive prioritization
   * Phase 1: Walnut only (blocks render for fastest time-to-visual)
   * Phase 2: Cherry & Maple (high priority background)
   * Phase 3: Remaining species (low priority background)
   */
  async preloadAllTextures(config: WoodMaterialsConfig): Promise<IdleTextureLoader> {
    const textureConfig = config.texture_config;
    const basePath = textureConfig.base_texture_path;
		
		// DIAGNOSTIC: Track individual species load times
		const loadTimes: { species: string; duration: number }[] = [];
    
    // ALWAYS use Large size for all panels (best quality, simpler caching)
    const sizeInfo = textureConfig.size_map.large;
    const folderName = sizeInfo.folder;
    
    // Load FIRST species in array immediately (blocks render)
    // DIAGNOSTIC: Load first 3 species and measure each
		for (let i = 0; i < Math.min(3, config.species_catalog.length); i++) {
			const species = config.species_catalog[i];
			const perfKey = `texture_load_${species.id}`;
			
			PerformanceMonitor.start(perfKey);
			await this._preloadSpeciesTexturesAsync(species, basePath, folderName, sizeInfo.dimensions);
			const duration = PerformanceMonitor.end(perfKey);
			
			loadTimes.push({ species: species.id, duration: duration! });
			console.log(`[TEXTURE DIAGNOSTIC] ${species.id}: ${duration!.toFixed(0)}ms`);
		}
		
		// Calculate and log statistics
		const totalTime = loadTimes.reduce((sum, entry) => sum + entry.duration, 0);
		const avgTime = totalTime / loadTimes.length;
		const estimatedAll = avgTime * config.species_catalog.length;
		
		console.log(`[TEXTURE DIAGNOSTIC] ═══════════════════════════════════`);
		console.log(`[TEXTURE DIAGNOSTIC] Total for 3 species: ${totalTime.toFixed(0)}ms (${(totalTime / 1000).toFixed(2)}s)`);
		console.log(`[TEXTURE DIAGNOSTIC] Average per species: ${avgTime.toFixed(0)}ms`);
		console.log(`[TEXTURE DIAGNOSTIC] Estimated all ${config.species_catalog.length} species: ${estimatedAll.toFixed(0)}ms (${(estimatedAll / 1000).toFixed(1)}s)`);
		console.log(`[TEXTURE DIAGNOSTIC] ═══════════════════════════════════`);
    
    // Create idle loader for remaining species (array order = priority)
    const idleLoader = new IdleTextureLoader(this, config);
    
		// DIAGNOSTIC: Start background loading from index 3 (skip first 3 already loaded)
		idleLoader.startBackgroundLoading(3);
    
    return idleLoader;
  }
  
  /**
   * Preload all texture types for a single species (async, waits for ready)
   * @private
   */
  private async _preloadSpeciesTexturesAsync(
    species: { id: string; wood_number: string },
    basePath: string,
    folderName: string,
    dimensions: string
  ): Promise<void> {
    const speciesId = species.id;
    const woodNumber = species.wood_number;
    
    // Construct paths (note: Normal and Roughness are in Shared_Maps, not Varnished)
    const albedoPath = `${basePath}/${speciesId}/Varnished/${folderName}/Diffuse/wood-${woodNumber}_${speciesId}-varnished-${dimensions}_d.png`;
    const normalPath = `${basePath}/${speciesId}/Shared_Maps/${folderName}/Normal/wood-${woodNumber}_${speciesId}-${dimensions}_n.png`;
    const roughnessPath = `${basePath}/${speciesId}/Shared_Maps/${folderName}/Roughness/wood-${woodNumber}_${speciesId}-${dimensions}_r.png`;
    
    // Load all three textures
    const albedo = this.getTexture(albedoPath);
    const normal = this.getTexture(normalPath);
    const roughness = this.getTexture(roughnessPath);
    
    // Wait for all three to finish loading
    await Promise.all([
      this._waitForTextureReady(albedo),
      this._waitForTextureReady(normal),
      this._waitForTextureReady(roughness)
    ]);
  }
  
  /**
   * Wait for a texture to finish loading
   * @private
   */
  private _waitForTextureReady(texture: Texture): Promise<void> {
    if (texture.isReady()) {
      return Promise.resolve();
    }
    
    return new Promise((resolve) => {
      texture.onLoadObservable.addOnce(() => {
        resolve();
      });
    });
  }
  
  /**
   * Clear all cached textures and dispose
   */
  dispose(): void {
    this._textureCache.forEach(texture => texture.dispose());
    this._textureCache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getStats(): { size: number; paths: string[] } {
    return {
      size: this._textureCache.size,
      paths: Array.from(this._textureCache.keys())
    };
  }
}