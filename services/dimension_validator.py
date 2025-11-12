"""
Dimension validation utilities for API request validation.

This module provides validation functions to ensure dimension values from
the frontend are valid before processing. Acts as a safeguard at the API
boundary to catch frontend bugs or malicious requests.
"""
from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class ValidationResult:
    """
    Result of dimension validation.
    
    Attributes:
        valid: Whether dimensions are valid
        error: Error message if validation failed, None otherwise
    """
    valid: bool
    error: str | None = None


def validate_circular_dimensions(
    finish_x: float,
    finish_y: float,
    tolerance: float = 0.01
) -> ValidationResult:
    """
    Validate that circular panel dimensions are equal (square).
    
    Args:
        finish_x: Width dimension
        finish_y: Height dimension
        tolerance: Acceptable difference (default 0.01 inches)
        
    Returns:
        ValidationResult indicating if dimensions form a valid circle
    """
    if abs(finish_x - finish_y) > tolerance:
        return ValidationResult(
            valid=False,
            error=f"Circular panels require equal dimensions. Got {finish_x}x{finish_y}"
        )
    return ValidationResult(valid=True)


def validate_dimension_bounds(
    finish_x: float,
    finish_y: float,
    min_dimension: float,
    max_dimension: float
) -> ValidationResult:
    """
    Validate that dimensions are within allowed bounds.
    
    Args:
        finish_x: Width dimension
        finish_y: Height dimension
        min_dimension: Minimum allowed dimension
        max_dimension: Maximum allowed dimension
        
    Returns:
        ValidationResult indicating if dimensions are within bounds
    """
    if finish_x < min_dimension or finish_x > max_dimension:
        return ValidationResult(
            valid=False,
            error=f"Width {finish_x} outside bounds [{min_dimension}, {max_dimension}]"
        )
    
    if finish_y < min_dimension or finish_y > max_dimension:
        return ValidationResult(
            valid=False,
            error=f"Height {finish_y} outside bounds [{min_dimension}, {max_dimension}]"
        )
    
    return ValidationResult(valid=True)


def validate_aspect_ratio_lock(
    finish_x: float,
    finish_y: float,
    locked_aspect_ratio: float,
    tolerance: float = 0.01
) -> ValidationResult:
    """
    Validate that dimensions match the locked aspect ratio.
    
    Args:
        finish_x: Width dimension
        finish_y: Height dimension
        locked_aspect_ratio: Expected ratio (width/height)
        tolerance: Acceptable ratio difference (default 0.01)
        
    Returns:
        ValidationResult indicating if ratio is maintained
    """
    if finish_y <= 0:
        return ValidationResult(
            valid=False,
            error="Height (finish_y) must be a positive number for aspect ratio validation"
        )
    
    actual_ratio = finish_x / finish_y
    
    if abs(actual_ratio - locked_aspect_ratio) > tolerance:
        return ValidationResult(
            valid=False,
            error=f"Aspect ratio lock violated. Expected {locked_aspect_ratio:.2f}, got {actual_ratio:.2f}"
        )
    
    return ValidationResult(valid=True)


def validate_frame_design_dimensions(
    shape: Literal['circular', 'rectangular', 'diamond'],
    finish_x: float,
    finish_y: float,
    aspect_ratio_locked: bool = False,
    locked_aspect_ratio: float | None = None,
    min_dimension: float = 8.0,
    max_dimension: float = 84.0
) -> ValidationResult:
    """
    Comprehensive validation of frame design dimensions.
    
    This is the main validation function called by the service facade
    to validate incoming composition updates.
    
    Args:
        shape: Panel shape
        finish_x: Width dimension
        finish_y: Height dimension
        aspect_ratio_locked: Whether aspect ratio is locked
        locked_aspect_ratio: Locked ratio if lock is active
        min_dimension: Minimum allowed dimension
        max_dimension: Maximum allowed dimension
        
    Returns:
        ValidationResult with validation status and error if invalid
    """
    # Check bounds first
    bounds_result = validate_dimension_bounds(
        finish_x, finish_y, min_dimension, max_dimension
    )
    if not bounds_result.valid:
        return bounds_result
    
    # Check circular constraint
    if shape == 'circular':
        circular_result = validate_circular_dimensions(finish_x, finish_y)
        if not circular_result.valid:
            return circular_result
    
    # Check aspect ratio lock if active
    if aspect_ratio_locked and locked_aspect_ratio:
        ratio_result = validate_aspect_ratio_lock(
            finish_x, finish_y, locked_aspect_ratio
        )
        if not ratio_result.valid:
            return ratio_result
    
    return ValidationResult(valid=True)