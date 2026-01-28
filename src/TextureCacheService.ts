/**
 * TextureCacheService - Pre-loads and caches wood textures
 * 
 * Prevents repeated texture downloads by maintaining a cache of Texture instances.
 * All textures are pre-loaded on application startup in the background.
 */

import { Texture, Scene } from '@babylonjs/core';

import { resolveAssetUrl } from './utils/assetUrl';
import { IdleTextureLoader } from './IdleTextureLoader';
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
    const texture = new Texture(resolveAssetUrl(path), this._scene);
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
  async preloadAllTextures(config: WoodMaterialsConfig, prioritySpeciesId?: string): Promise<IdleTextureLoader> {
    const textureConfig = config.texture_config;
    const basePath = textureConfig.base_texture_path;
    const sizeInfo = textureConfig.size_map.Seamless_4K;
    const folderName = sizeInfo.folder;
    
    // Load priority species first (selected or default)
    const priorityId = prioritySpeciesId || config.default_species;
    const prioritySpecies = config.species_catalog.find(s => s.id === priorityId);
    if (prioritySpecies) {
      await this._preloadSpeciesTexturesAsync(prioritySpecies, basePath, folderName, sizeInfo.dimensions);
    }
    
    // Load remaining top species (skip priority if already loaded)
    const remaining = config.species_catalog.filter(s => s.id !== priorityId).slice(0, 2);
    for (const species of remaining) {
      await this._preloadSpeciesTexturesAsync(species, basePath, folderName, sizeInfo.dimensions);
    }
    
    // Create idle loader for remaining species (array order = priority)
    const idleLoader = new IdleTextureLoader(this, config);
    
    // Background preload remaining species during idle time
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
    
    // Cache textures without creating orphan clones
    this.ensureCached(albedoPath);
    this.ensureCached(normalPath);
    this.ensureCached(roughnessPath);
    
    // Wait for all three to finish loading
    await Promise.all([
      this._waitForTextureReady(this._textureCache.get(albedoPath)!),
      this._waitForTextureReady(this._textureCache.get(normalPath)!),
      this._waitForTextureReady(this._textureCache.get(roughnessPath)!)
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
	
	/**
	 * Ensure texture is in cache without returning a clone.
	 * Use for preloading only.
	 */
	ensureCached(path: string): void {
			if (this._textureCache.has(path)) return;
			const texture = new Texture(resolveAssetUrl(path), this._scene);
			this._textureCache.set(path, texture);
	}	
}