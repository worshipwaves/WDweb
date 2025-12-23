/**
 * AudioCacheService - Client-side cache for raw audio samples
 * 
 * Caches the 200k normalized samples to enable instant rebinning
 * when audio-level parameters change (sections, slots, binning mode).
 * This avoids server round-trips for audio reprocessing.
 */

import { z } from 'zod';

// Schema for cached audio session
const AudioSessionSchema = z.object({
  id: z.string(),
  samples: z.instanceof(Float32Array),
  timestamp: z.number(),
  sourceFile: z.string(),
  fileHash: z.string()
}).strict();

type AudioSession = z.infer<typeof AudioSessionSchema>;

// Schema for bin parameters
const BinParametersSchema = z.object({
  numSlots: z.number().int().positive(),
  binningMode: z.enum(['mean_abs', 'min_max', 'continuous']),
  filterAmount: z.number().min(0).max(1).optional(),
  exponent: z.number().positive().optional()
}).strict();

type BinParameters = z.infer<typeof BinParametersSchema>;

export class AudioCacheService {
  // Cache storage (prefixed = OK per architecture)
  private readonly _cache: Map<string, AudioSession>;
  private readonly _maxCacheSize: number = 5; // Max sessions to keep

  constructor() {
    this._cache = new Map();
  }

  /**
   * Cache raw audio samples from initial processing
   */
  public cacheRawSamples(
    file: File,
    samples: Float32Array
  ): string {
    // Generate session ID
    const sessionId = crypto.randomUUID();
    
    // Create file hash for validation
    const fileHash = this._generateFileHash(file);
    
    // Create session object
    const session: AudioSession = {
      id: sessionId,
      samples: samples,
      timestamp: Date.now(),
      sourceFile: file.name,
      fileHash: fileHash
    };
    
    // Enforce cache size limit
    if (this._cache.size >= this._maxCacheSize) {
      // Remove oldest entry
      const oldestKey = this._findOldestSession();
      if (oldestKey) {
        this._cache.delete(oldestKey);
      }
    }
    
    // Store in cache
    this._cache.set(sessionId, session);
    
    return sessionId;
  }

  /**
   * Retrieve cached samples for a session
   */
  public getCachedSamples(sessionId: string): Float32Array | null {
    const session = this._cache.get(sessionId);
    if (!session) {
      return null;
    }
    
    // Return copy to prevent mutation
    return new Float32Array(session.samples);
  }

  /**
   * Check if session exists in cache
   */
  public hasSession(sessionId: string): boolean {
    return this._cache.has(sessionId);
  }

  /**
   * Rebin cached samples for new parameters
   * This performs the fast client-side rebinning operation
   */
  public rebinFromCache(
    sessionId: string,
    params: BinParameters
  ): Float32Array | null {
    const session = this._cache.get(sessionId);
    if (!session) {
      console.warn(`Session ${sessionId} not found in cache`);
      return null;
    }
    
    // Perform binning based on mode
    let amplitudes = this._binSamples(
      session.samples,
      params.numSlots,
      params.binningMode
    );
    
    // Apply filter if specified (MUST come before exponent)
    if (params.filterAmount && params.filterAmount > 0) {
      amplitudes = this._filterData(amplitudes, params.filterAmount);
    }
    
    // Apply exponent if specified
    if (params.exponent && params.exponent !== 1.0) {
      for (let i = 0; i < amplitudes.length; i++) {
        // Parity: Desktop does not re-normalize after power. 
        // Input is 0-1, Power keeps it 0-1.
        amplitudes[i] = Math.pow(amplitudes[i], params.exponent);
      }
      // Note: Previous re-normalization logic removed to match PyQt behavior
    }
    
    return amplitudes;
  }

  /**
   * Clear a specific session from cache
   */
  public clearSession(sessionId: string): void {
    this._cache.delete(sessionId);
  }

  /**
   * Clear all cached sessions
   */
  public clearAll(): void {
    this._cache.clear();
  }
	
  /**
   * Restores a session into the cache from persisted state.
   */
  public rehydrateCache(sessionId: string, samples: Float32Array): void {
    if (this._cache.has(sessionId)) {
      return; // Avoid re-adding if already present
    }

    const session: AudioSession = {
      id: sessionId,
      samples: samples,
      timestamp: Date.now(),
      sourceFile: 'restored-session',
      fileHash: 'restored-session'
    };

    this._cache.set(sessionId, session);
  }	

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    sessionCount: number;
    totalMemoryBytes: number;
    sessions: Array<{
      id: string;
      sourceFile: string;
      timestamp: number;
      sampleCount: number;
    }>;
  } {
    const sessions = Array.from(this._cache.values()).map(session => ({
      id: session.id,
      sourceFile: session.sourceFile,
      timestamp: session.timestamp,
      sampleCount: session.samples.length
    }));
    
    const totalMemoryBytes = sessions.reduce(
      (sum, session) => sum + (session.sampleCount * 4), // 4 bytes per Float32
      0
    );
    
    return {
      sessionCount: this._cache.size,
      totalMemoryBytes,
      sessions
    };
  }

  /**
   * Bin the raw samples according to parameters
   * Implements mean_abs, min_max, and continuous modes
   */
  private _binSamples(
    rawSamples: Float32Array,
    numSlots: number,
    binningMode: string
  ): Float32Array {
    const samplesPerSlot = Math.floor(rawSamples.length / numSlots);
    const amplitudes = new Float32Array(numSlots);
    
    for (let slotIdx = 0; slotIdx < numSlots; slotIdx++) {
      const startIdx = slotIdx * samplesPerSlot;
      const endIdx = Math.min(startIdx + samplesPerSlot, rawSamples.length);
      
      if (binningMode === 'mean_abs') {
        // Average of absolute values
        let sum = 0;
        for (let i = startIdx; i < endIdx; i++) {
          sum += Math.abs(rawSamples[i]);
        }
        amplitudes[slotIdx] = sum / (endIdx - startIdx);
        
      } else if (binningMode === 'min_max') {
        // Max absolute value in the bin
        let maxAbs = 0;
        for (let i = startIdx; i < endIdx; i++) {
          maxAbs = Math.max(maxAbs, Math.abs(rawSamples[i]));
        }
        amplitudes[slotIdx] = maxAbs;
        
      } else if (binningMode === 'continuous') {
        // RMS (Root Mean Square) for continuous representation
        let sumSquares = 0;
        for (let i = startIdx; i < endIdx; i++) {
          sumSquares += rawSamples[i] * rawSamples[i];
        }
        amplitudes[slotIdx] = Math.sqrt(sumSquares / (endIdx - startIdx));
        
      } else {
        // Default to mean_abs if unknown mode
        let sum = 0;
        for (let i = startIdx; i < endIdx; i++) {
          sum += Math.abs(rawSamples[i]);
        }
        amplitudes[slotIdx] = sum / (endIdx - startIdx);
      }
    }
    
    // Normalize to 0-1 range
    const maxAmplitude = Math.max(...amplitudes);
    if (maxAmplitude > 0) {
      for (let i = 0; i < amplitudes.length; i++) {
        amplitudes[i] = amplitudes[i] / maxAmplitude;
      }
    }
    
    return amplitudes;
  }

  /**
   * Filter data by subtracting noise floor and renormalizing.
   * Port of Python AudioProcessingService.filter_data()
   */
  private _filterData(amplitudes: Float32Array, filterAmount: number): Float32Array {
    if (amplitudes.length === 0 || filterAmount <= 0) {
      return amplitudes;
    }
    
    // Sort absolute values to find noise floor (returns new array)
    const sortedAbs = Array.from(amplitudes).map(Math.abs).sort((a, b) => a - b);
    const n = Math.max(1, Math.floor(sortedAbs.length * filterAmount));
    
    // Calculate noise floor as mean of bottom N values
    let noiseFloor = 0;
    for (let i = 0; i < n; i++) {
      noiseFloor += sortedAbs[i];
    }
    noiseFloor /= n;
    
    // Subtract noise floor and clamp to 0
    const filtered = new Float32Array(amplitudes.length);
    for (let i = 0; i < amplitudes.length; i++) {
      filtered[i] = Math.max(0, Math.abs(amplitudes[i]) - noiseFloor);
    }
    
    // Renormalize to 0-1
    const maxVal = Math.max(...filtered);
    if (maxVal > 1e-9) {
      for (let i = 0; i < filtered.length; i++) {
        filtered[i] = filtered[i] / maxVal;
      }
    }
    
    return filtered;
  }

  /**
   * Find the oldest session in cache for eviction
   */
  private _findOldestSession(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, session] of this._cache.entries()) {
      if (session.timestamp < oldestTime) {
        oldestTime = session.timestamp;
        oldestKey = key;
      }
    }
    
    return oldestKey;
  }

  /**
   * Generate a simple hash for file identification
   * (Not cryptographic, just for cache validation)
   */
  private _generateFileHash(file: File): string {
    // Simple hash based on file properties
    const str = `${file.name}_${file.size}_${file.lastModified}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }
}