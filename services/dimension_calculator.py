"""
Dimension calculation utilities for panel sizing.

CRITICAL: This logic MUST stay synchronized with frontend src/utils/dimensionUtils.ts
Any changes to dimension constraints must be applied to BOTH files.

This module provides pure functions for calculating constrained panel dimensions
based on shape, aspect ratio locks, and boundary limits.
"""
from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class DimensionConstraints:
    """
    Immutable dimension constraints.
    
    Attributes:
        shape: Panel shape (circular forces 1:1 ratio)
        aspect_ratio_locked: Whether aspect ratio is locked
        locked_aspect_ratio: Stored ratio when locked (width/height)
        min_dimension: Minimum allowed dimension in inches
        max_dimension: Maximum allowed dimension in inches
    """
    shape: Literal['circular', 'rectangular', 'diamond']
    aspect_ratio_locked: bool
    locked_aspect_ratio: float | None
    min_dimension: float
    max_dimension: float


@dataclass(frozen=True)
class CalculatedDimensions:
    """
    Result of dimension calculation.
    
    Attributes:
        finish_x: Calculated width in inches
        finish_y: Calculated height in inches
        lock_broken: True if clamping broke the aspect ratio lock
    """
    finish_x: float
    finish_y: float
    lock_broken: bool


def calculate_constrained_dimensions(
    axis: Literal['x', 'y'],
    new_value: float,
    current_x: float,
    current_y: float,
    constraints: DimensionConstraints
) -> CalculatedDimensions:
    """
    Calculate new dimensions respecting shape and aspect ratio constraints.
    
    This is a PURE FUNCTION with identical logic to frontend dimensionUtils.ts.
    Used by geometry_service.py to ensure backend calculations match user UI.
    
    Args:
        axis: Which dimension is changing ('x' for width, 'y' for height)
        new_value: Proposed new value for the changing axis
        current_x: Current finish_x value
        current_y: Current finish_y value
        constraints: Active dimension constraints
        
    Returns:
        CalculatedDimensions with both finish_x and finish_y,
        plus flag indicating if aspect lock was broken by clamping
        
    Examples:
        >>> constraints = DimensionConstraints(
        ...     shape='circular',
        ...     aspect_ratio_locked=False,
        ...     locked_aspect_ratio=None,
        ...     min_dimension=8.0,
        ...     max_dimension=84.0
        ... )
        >>> result = calculate_constrained_dimensions('x', 24.0, 18.0, 18.0, constraints)
        >>> result.finish_x, result.finish_y
        (24.0, 24.0)
    """
    
    # Circular shape always forces square
    if constraints.shape == 'circular':
        return CalculatedDimensions(
            finish_x=new_value,
            finish_y=new_value,
            lock_broken=False
        )
    
    # Aspect ratio locked - maintain ratio with clamping
    if constraints.aspect_ratio_locked and constraints.locked_aspect_ratio:
        if axis == 'x':
            # Width changed, calculate new height
            ideal_y = new_value / constraints.locked_aspect_ratio
            clamped_y = _clamp(ideal_y, constraints.min_dimension, constraints.max_dimension)
            
            return CalculatedDimensions(
                finish_x=new_value,
                finish_y=clamped_y,
                lock_broken=abs(ideal_y - clamped_y) > 0.01
            )
        else:  # axis == 'y'
            # Height changed, calculate new width
            ideal_x = new_value * constraints.locked_aspect_ratio
            clamped_x = _clamp(ideal_x, constraints.min_dimension, constraints.max_dimension)
            
            return CalculatedDimensions(
                finish_x=clamped_x,
                finish_y=new_value,
                lock_broken=abs(ideal_x - clamped_x) > 0.01
            )
    
    # Independent dimensions (no lock active)
    if axis == 'x':
        return CalculatedDimensions(
            finish_x=new_value,
            finish_y=current_y,
            lock_broken=False
        )
    else:
        return CalculatedDimensions(
            finish_x=current_x,
            finish_y=new_value,
            lock_broken=False
        )


def _clamp(value: float, min_val: float, max_val: float) -> float:
    """
    Clamp value to range [min_val, max_val].
    
    Args:
        value: Value to clamp
        min_val: Minimum allowed value
        max_val: Maximum allowed value
        
    Returns:
        Clamped value within [min_val, max_val]
    """
    return max(min_val, min(value, max_val))