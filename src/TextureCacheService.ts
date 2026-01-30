/**
 * TextureCacheService - Pre-loads and caches wood textures
 * 
 * Prevents repeated texture downloads by maintaining a cache of Texture instances.
 * All textures are pre-loaded on application startup in the background.
 */

import { Texture, Scene } from '@babylonjs/core';

import { resolveAssetUrl } from './utils/assetUrl';
import { IdleTextureLoader } from './IdleTextureLoader';
import { PerformanceMonitor } from './PerformanceMonitor';
import type { WoodMaterialsConfig } from './types/schemas';

export class TextureCacheService {
  private _textureCache: Map<string, Texture> = new Map();
  private _blobUrlCache: Map<string, string> = new Map();
  private _scene: Scene;
  private _cacheName = 'wavedesigner-textures-v1';
  
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
      PerformanceMonitor.start('texture_preload_priority');
      await this._preloadSpeciesTexturesAsync(prioritySpecies, basePath, folderName, sizeInfo.dimensions);
      PerformanceMonitor.end('texture_preload_priority');
    }
    
    // Load remaining top species (skip priority if already loaded)
    const remaining = config.species_catalog.filter(s => s.id !== priorityId).slice(0, 2);
    PerformanceMonitor.start('texture_preload_secondary');
    for (const species of remaining) {
      await this._preloadSpeciesTexturesAsync(species, basePath, folderName, sizeInfo.dimensions);
    }
    PerformanceMonitor.end('texture_preload_secondary');
    
    // Create idle loader for remaining species (array order = priority)
    const idleLoader = new IdleTextureLoader(this, config);
    
    // Idle preloading disabled - cache viewed species on demand instead
    // idleLoader.startBackgroundLoading(3);
    
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
    
    this._blobUrlCache.forEach(url => URL.revokeObjectURL(url));
    this._blobUrlCache.clear();
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
			this._ensureInCacheApi(path);
	}
	
  /**
   * Ensure texture is in Cache API for cross-session persistence.
   */
  private async _ensureInCacheApi(path: string): Promise<void> {
    try {
      const finalUrl = resolveAssetUrl(path);
      const cache = await window.caches.open(this._cacheName);
      const existing = await cache.match(finalUrl);
      if (!existing) {
        await cache.add(finalUrl);
      }
    } catch (err) {
      console.warn('[TextureCache] Cache API storage failed:', err);
    }
  }

  /**
   * Get texture via Cache API - checks persistent storage first.
   */
  async getTextureAsync(path: string): Promise<Texture> {
    const cached = this._textureCache.get(path);
    if (cached) {
      return cached.clone();
    }
    
    const finalUrl = resolveAssetUrl(path);
    
    try {
      const cache = await window.caches.open(this._cacheName);
      let response = await cache.match(finalUrl);
      
      if (!response) {
        await cache.add(finalUrl);
        response = await cache.match(finalUrl);
      }
      
      if (!response) throw new Error(`Failed to cache: ${finalUrl}`);
      
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      this._blobUrlCache.set(path, objectUrl);
      
      const texture = new Texture(objectUrl, this._scene);
      texture.onDisposeObservable.add(() => {
        URL.revokeObjectURL(objectUrl);
        this._blobUrlCache.delete(path);
      });
      
      this._textureCache.set(path, texture);
      return texture;
      
    } catch (err) {
      console.warn('[TextureCache] Cache API failed, using network:', err);
      const texture = new Texture(finalUrl, this._scene);
      this._textureCache.set(path, texture);
      return texture;
    }
  }

  /**
   * Preload all three maps for a species via Cache API.
   */
  async preloadSpeciesFull(speciesId: string, config: WoodMaterialsConfig): Promise<void> {
    const textureConfig = config.texture_config;
    const basePath = textureConfig.base_texture_path;
    const sizeInfo = textureConfig.size_map.Seamless_4K;
    const folderName = sizeInfo.folder;
    const dimensions = sizeInfo.dimensions;
    
    const species = config.species_catalog.find(s => s.id === speciesId);
    if (!species) return;
    
    const albedoPath = `${basePath}/${speciesId}/Varnished/${folderName}/Diffuse/wood-${species.wood_number}_${speciesId}-varnished-${dimensions}_d.png`;
    const normalPath = `${basePath}/${speciesId}/Shared_Maps/${folderName}/Normal/wood-${species.wood_number}_${speciesId}-${dimensions}_n.png`;
    const roughnessPath = `${basePath}/${speciesId}/Shared_Maps/${folderName}/Roughness/wood-${species.wood_number}_${speciesId}-${dimensions}_r.png`;
    
    await Promise.all([
      this.getTextureAsync(albedoPath),
      this.getTextureAsync(normalPath),
      this.getTextureAsync(roughnessPath)
    ]);
    
    await Promise.all([
      this._waitForTextureReady(this._textureCache.get(albedoPath)!),
      this._waitForTextureReady(this._textureCache.get(normalPath)!),
      this._waitForTextureReady(this._textureCache.get(roughnessPath)!)
    ]);
  }
}