/**
 * TextureCacheService - Pre-loads and caches wood textures
 * 
 * Prevents repeated texture downloads by maintaining a cache of Texture instances.
 * All textures are pre-loaded on application startup in the background.
 */

import { Texture, Scene } from '@babylonjs/core';
import type { WoodMaterialsConfig } from './types/schemas';
import { PerformanceMonitor } from './PerformanceMonitor';
import { IdleTextureLoader } from './IdleTextureLoader';

export class TextureCacheService {
  private _textureCache: Map<string, Texture> = new Map();
  private _scene: Scene;
  
  constructor(scene: Scene) {
    this._scene = scene;
  }
  
  /**
   * Get texture from cache, or load and cache if not present
   */
  getTexture(path: string): Texture {
    // Check cache first
    const cached = this._textureCache.get(path);
    if (cached) {
      return cached;
    }
    
    // Not in cache - load and cache it
    console.log(`[TextureCache] Loading and caching: ${path}`);
    const texture = new Texture(path, this._scene);
    this._textureCache.set(path, texture);
    
    return texture;
  }
  
  /**
   * Pre-load wood textures with aggressive prioritization
   * Phase 1: Walnut only (blocks render for fastest time-to-visual)
   * Phase 2: Cherry & Maple (high priority background)
   * Phase 3: Remaining species (low priority background)
   */
  async preloadAllTextures(config: WoodMaterialsConfig): Promise<IdleTextureLoader> {
    console.log('[TextureCache] Loading first species (array position 0) immediately...');
    
    const textureConfig = config.texture_config;
    const basePath = textureConfig.base_texture_path;
    
    // ALWAYS use Large size for all panels (best quality, simpler caching)
    const sizeInfo = textureConfig.size_map.large;
    const folderName = sizeInfo.folder;
    
    // Load FIRST species in array immediately (blocks render)
    const firstSpecies = config.species_catalog[0];
    if (firstSpecies) {
      console.log(`[TextureCache] Loading ${firstSpecies.id} (immediate)...`);
      PerformanceMonitor.start('first_species_texture_download');
      await this._preloadSpeciesTexturesAsync(firstSpecies, basePath, folderName, sizeInfo.dimensions);
      PerformanceMonitor.end('first_species_texture_download');
      console.log(`[TextureCache] ✓ ${firstSpecies.id} ready - render can proceed`);
    }
    
    // Create idle loader for remaining species (array order = priority)
    const idleLoader = new IdleTextureLoader(this, config);
    
    // Start background loading from index 1 (skip first species already loaded)
    idleLoader.startBackgroundLoading(1);
    
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