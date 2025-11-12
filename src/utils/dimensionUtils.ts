/**
 * Dimension calculation utilities for panel sizing.
 * 
 * CRITICAL: This logic MUST stay synchronized with backend services/dimension_calculator.py
 * Any changes to dimension constraints must be applied to BOTH files.
 * 
 * This module provides pure functions for calculating constrained panel dimensions
 * based on shape, aspect ratio locks, and boundary limits.
 */

export interface DimensionConstraints {
  shape: 'circular' | 'rectangular' | 'diamond';
  aspectRatioLocked: boolean;
  lockedAspectRatio: number | null;
  minDimension: number;
  maxDimension: number;
}

export interface DimensionResult {
  finish_x: number;
  finish_y: number;
  lockBroken: boolean;
}

/**
 * Calculate new dimensions respecting shape and aspect ratio constraints.
 * 
 * This is a PURE FUNCTION with identical logic to backend dimension_calculator.py.
 * Used by ApplicationController to ensure frontend UI matches backend calculations.
 * 
 * @param axis - Which dimension is changing ('x' for width, 'y' for height)
 * @param newValue - Proposed new value for the changing axis
 * @param currentX - Current finish_x value
 * @param currentY - Current finish_y value
 * @param constraints - Active dimension constraints
 * @returns DimensionResult with both finish_x and finish_y, plus lock broken flag
 * 
 * @example
 * ```typescript
 * const constraints: DimensionConstraints = {
 *   shape: 'circular',
 *   aspectRatioLocked: false,
 *   lockedAspectRatio: null,
 *   minDimension: 8.0,
 *   maxDimension: 84.0
 * };
 * const result = applyDimensionChange('x', 24.0, 18.0, 18.0, constraints);
 * // result.finish_x === 24.0, result.finish_y === 24.0
 * ```
 */
export function applyDimensionChange(
  axis: 'x' | 'y',
  newValue: number,
  currentX: number,
  currentY: number,
  constraints: DimensionConstraints
): DimensionResult {
  
  // Circular shape always forces square
  if (constraints.shape === 'circular') {
    return {
      finish_x: newValue,
      finish_y: newValue,
      lockBroken: false
    };
  }
  
  // Aspect ratio locked - maintain ratio with clamping
  if (constraints.aspectRatioLocked && constraints.lockedAspectRatio) {
    if (axis === 'x') {
      // Width changed, calculate new height
      const idealY = newValue / constraints.lockedAspectRatio;
      const clampedY = clamp(idealY, constraints.minDimension, constraints.maxDimension);
      
      return {
        finish_x: newValue,
        finish_y: clampedY,
        lockBroken: Math.abs(idealY - clampedY) > 0.01
      };
    } else {
      // Height changed, calculate new width
      const idealX = newValue * constraints.lockedAspectRatio;
      const clampedX = clamp(idealX, constraints.minDimension, constraints.maxDimension);
      
      return {
        finish_x: clampedX,
        finish_y: newValue,
        lockBroken: Math.abs(idealX - clampedX) > 0.01
      };
    }
  }
  
  // Independent dimensions (no lock active)
  if (axis === 'x') {
    return {
      finish_x: newValue,
      finish_y: currentY,
      lockBroken: false
    };
  } else {
    return {
      finish_x: currentX,
      finish_y: newValue,
      lockBroken: false
    };
  }
}

/**
 * Clamp value to range [min, max].
 * 
 * @param value - Value to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Clamped value within [min, max]
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}