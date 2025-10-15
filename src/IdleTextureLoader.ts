/**
 * IdleTextureLoader - Smart background texture loading during browser idle time
 * 
 * - Pauses on user interaction
 * - Resumes during idle periods
 * - Loads textures in priority order (array sequence)
 * - Shows loading indicators when needed
 */

import type { TextureCacheService } from './TextureCacheService';
import type { WoodMaterialsConfig } from './types/schemas';

export class IdleTextureLoader {
  private textureCache: TextureCacheService;
  private config: WoodMaterialsConfig;
  private loadQueue: Array<{ id: string; wood_number: string }> = [];
  private isLoading: boolean = false;
  private isPaused: boolean = false;
  private idleCallbackId: number | null = null;
  private userActiveTimeout: number | null = null;
  private onProgressCallback?: (loaded: number, total: number) => void;
  
  constructor(textureCache: TextureCacheService, config: WoodMaterialsConfig) {
    this.textureCache = textureCache;
    this.config = config;
    this.setupUserActivityDetection();
  }
  
  /**
   * Start loading textures in background (array order after first species)
   * @param startIndex - Index to start from (typically 1, skipping already-loaded first species)
   */
  startBackgroundLoading(startIndex: number = 1): void {
    // Build queue from array order
    this.loadQueue = this.config.species_catalog.slice(startIndex);
    
    console.log(`[IdleLoader] Starting background load of ${this.loadQueue.length} species`);
    
    // Start loading during idle time
    this.scheduleNextLoad();
  }
  
  /**
   * Schedule next texture load during idle time
   */
  private scheduleNextLoad(): void {
    if (this.loadQueue.length === 0) {
      console.log('[IdleLoader] All species loaded');
      return;
    }
    
    if (this.isPaused || this.isLoading || this.idleCallbackId !== null) {
      // Wait for resume or current load to finish, or callback already scheduled
      return;
    }
    
    // Use requestIdleCallback to load during browser idle time
    this.idleCallbackId = window.requestIdleCallback(
      (deadline) => {
        this.idleCallbackId = null; // Clear immediately
        
        if (deadline.timeRemaining() > 0 && !this.isPaused && !this.isLoading) {
          void this.loadNextSpecies();
        } else {
          // Not enough time or paused, try again later
          setTimeout(() => this.scheduleNextLoad(), 500);
        }
      },
      { timeout: 2000 } // Force execution after 2s even if not idle
    );
  }
  
  /**
   * Load next species from queue
   */
  private async loadNextSpecies(): Promise<void> {
    if (this.loadQueue.length === 0 || this.isLoading) return;
    
    this.isLoading = true;
    const species = this.loadQueue.shift()!;
    
    console.log(`[IdleLoader] Loading ${species.id} (${this.loadQueue.length} remaining)`);
    
    // Add timeout to detect hung loads
    const timeoutMs = 10000; // 10 seconds
    const loadPromise = (async () => {
      try {
      const textureConfig = this.config.texture_config;
      const basePath = textureConfig.base_texture_path;
      const sizeInfo = textureConfig.size_map.large;
      const folderName = sizeInfo.folder;
      const dimensions = sizeInfo.dimensions;
      
      // Load textures using cache's method
      await (this.textureCache as any)._preloadSpeciesTexturesAsync(
        species,
        basePath,
        folderName,
        dimensions
      );
      
      console.log(`[IdleLoader] ✓ ${species.id} loaded`);
      } catch (error) {
        console.error(`[IdleLoader] Failed to load ${species.id}:`, error);
      }
    })();
    
    // Race between load and timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout loading ${species.id}`)), timeoutMs);
    });
    
    try {
      await Promise.race([loadPromise, timeoutPromise]);
    } catch (error) {
      console.error(`[IdleLoader] Load failed or timed out for ${species.id}:`, error);
    }
    
    this.isLoading = false;
    
    // Update progress AFTER setting isLoading = false for correct calculation
    if (this.onProgressCallback) {
      const status = this.getStatus();
      console.log(`[IdleLoader] Progress update: ${status.loaded}/${status.total}`);
      this.onProgressCallback(status.loaded, status.total);
    }
    
    // Schedule next load
    if (!this.isPaused) {
      this.scheduleNextLoad();
    }
  }
  
  /**
   * Pause loading (user is active)
   */
  private pause(): void {
    if (this.isPaused) return;
    
    this.isPaused = true;
    
    // Cancel pending idle callback
    if (this.idleCallbackId !== null) {
      window.cancelIdleCallback(this.idleCallbackId);
      this.idleCallbackId = null;
    }
  }
  
  /**
   * Resume loading (user became idle)
   */
  private resume(): void {
    if (!this.isPaused) {
      // Already running, don't spam
      return;
    }
    
    console.log('[IdleLoader] Resuming background loading');
    this.isPaused = false;
    
    // Only schedule if not already loading and no pending callback
    if (!this.isLoading && this.idleCallbackId === null) {
      this.scheduleNextLoad();
    }
  }
  
  /**
   * Setup user activity detection
   */
  private setupUserActivityDetection(): void {
    const events = ['mousedown', 'keydown', 'touchstart', 'wheel'];
    
    const handleUserActivity = () => {
      // User is active - pause loading (but only if not currently loading a texture)
      if (!this.isLoading) {
        this.pause();
      }
      
      // Clear existing timeout
      if (this.userActiveTimeout !== null) {
        clearTimeout(this.userActiveTimeout);
      }
      
      // Resume after 1 second of inactivity (longer delay)
      this.userActiveTimeout = window.setTimeout(() => {
        if (this.isPaused) {
          this.resume();
        }
      }, 1000);
    };
    
    // Attach listeners (removed mousemove and scroll - too aggressive)
    events.forEach(event => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });
  }
  
  /**
   * Check if a species is already loaded
   */
  isSpeciesLoaded(speciesId: string): boolean {
    // Check if textures exist in cache
    const textureConfig = this.config.texture_config;
    const basePath = textureConfig.base_texture_path;
    const sizeInfo = textureConfig.size_map.large;
    const species = this.config.species_catalog.find(s => s.id === speciesId);
    
    if (!species) return false;
    
    const albedoPath = `${basePath}/${species.id}/Varnished/${sizeInfo.folder}/Diffuse/wood-${species.wood_number}_${species.id}-varnished-${sizeInfo.dimensions}_d.png`;
    
    return (this.textureCache as any)._textureCache.has(albedoPath);
  }
  
  /**
   * Load a specific species immediately (user requested)
   */
  async loadSpeciesImmediate(speciesId: string): Promise<void> {
    const species = this.config.species_catalog.find(s => s.id === speciesId);
    if (!species) {
      console.error(`[IdleLoader] Species not found: ${speciesId}`);
      return;
    }
    
    // Remove from queue if present
    this.loadQueue = this.loadQueue.filter(s => s.id !== speciesId);
    
    // Load immediately
    const textureConfig = this.config.texture_config;
    const basePath = textureConfig.base_texture_path;
    const sizeInfo = textureConfig.size_map.large;
    
    await (this.textureCache as any)._preloadSpeciesTexturesAsync(
      species,
      basePath,
      sizeInfo.folder,
      sizeInfo.dimensions
    );
  }
  
  /**
   * Get loading status
   */
  getStatus(): { total: number; loaded: number; remaining: number } {
    const total = this.config.species_catalog.length;
    const remaining = this.loadQueue.length + (this.isLoading ? 1 : 0);
    const loaded = total - remaining;
    
    return { total, loaded, remaining };
  }
  
  /**
   * Set progress callback for UI updates
   */
  onProgress(callback: (loaded: number, total: number) => void): void {
    this.onProgressCallback = callback;
    
    // Call immediately with current status
    const status = this.getStatus();
    callback(status.loaded, status.total);
  }
}