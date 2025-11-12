"""
Dimension calculation parity tests.

CRITICAL: These tests verify that Python and TypeScript dimension logic
produce identical results. If these tests fail, there is a desynchronization
bug between frontend and backend.

Run with: pytest tests/test_dimension_parity.py -v
"""
import pytest
from services.dimension_calculator import (
    DimensionConstraints,
    CalculatedDimensions,
    calculate_constrained_dimensions
)


class TestCircularShapeConstraints:
    """Test circular shape always forces square dimensions."""
    
    def test_circular_forces_square_from_width(self):
        """Circular shape: changing width forces height to match."""
        constraints = DimensionConstraints(
            shape='circular',
            aspect_ratio_locked=False,
            locked_aspect_ratio=None,
            min_dimension=8.0,
            max_dimension=84.0
        )
        
        result = calculate_constrained_dimensions('x', 24.0, 18.0, 18.0, constraints)
        
        assert result.finish_x == 24.0
        assert result.finish_y == 24.0
        assert result.lock_broken is False
    
    def test_circular_forces_square_from_height(self):
        """Circular shape: changing height forces width to match."""
        constraints = DimensionConstraints(
            shape='circular',
            aspect_ratio_locked=False,
            locked_aspect_ratio=None,
            min_dimension=8.0,
            max_dimension=84.0
        )
        
        result = calculate_constrained_dimensions('y', 36.0, 24.0, 24.0, constraints)
        
        assert result.finish_x == 36.0
        assert result.finish_y == 36.0
        assert result.lock_broken is False
    
    def test_circular_ignores_aspect_lock(self):
        """Circular shape: aspect lock setting is irrelevant."""
        constraints = DimensionConstraints(
            shape='circular',
            aspect_ratio_locked=True,
            locked_aspect_ratio=2.0,
            min_dimension=8.0,
            max_dimension=84.0
        )
        
        result = calculate_constrained_dimensions('x', 48.0, 30.0, 30.0, constraints)
        
        assert result.finish_x == 48.0
        assert result.finish_y == 48.0  # Forced square, ratio ignored
        assert result.lock_broken is False


class TestRectangularIndependentDimensions:
    """Test rectangular shape with aspect lock disabled."""
    
    def test_width_change_independent(self):
        """No lock: changing width leaves height unchanged."""
        constraints = DimensionConstraints(
            shape='rectangular',
            aspect_ratio_locked=False,
            locked_aspect_ratio=None,
            min_dimension=8.0,
            max_dimension=84.0
        )
        
        result = calculate_constrained_dimensions('x', 48.0, 24.0, 18.0, constraints)
        
        assert result.finish_x == 48.0
        assert result.finish_y == 18.0  # Unchanged
        assert result.lock_broken is False
    
    def test_height_change_independent(self):
        """No lock: changing height leaves width unchanged."""
        constraints = DimensionConstraints(
            shape='rectangular',
            aspect_ratio_locked=False,
            locked_aspect_ratio=None,
            min_dimension=8.0,
            max_dimension=84.0
        )
        
        result = calculate_constrained_dimensions('y', 36.0, 24.0, 18.0, constraints)
        
        assert result.finish_x == 24.0  # Unchanged
        assert result.finish_y == 36.0
        assert result.lock_broken is False


class TestAspectRatioLock:
    """Test aspect ratio lock maintains proportions."""
    
    def test_width_change_updates_height(self):
        """Lock active: changing width calculates new height."""
        constraints = DimensionConstraints(
            shape='rectangular',
            aspect_ratio_locked=True,
            locked_aspect_ratio=2.0,  # 2:1 ratio (width:height)
            min_dimension=8.0,
            max_dimension=84.0
        )
        
        result = calculate_constrained_dimensions('x', 48.0, 24.0, 12.0, constraints)
        
        assert result.finish_x == 48.0
        assert result.finish_y == 24.0  # 48 / 2 = 24
        assert result.lock_broken is False
    
    def test_height_change_updates_width(self):
        """Lock active: changing height calculates new width."""
        constraints = DimensionConstraints(
            shape='rectangular',
            aspect_ratio_locked=True,
            locked_aspect_ratio=1.5,  # 3:2 ratio
            min_dimension=8.0,
            max_dimension=84.0
        )
        
        result = calculate_constrained_dimensions('y', 24.0, 30.0, 20.0, constraints)
        
        assert result.finish_x == 36.0  # 24 * 1.5 = 36
        assert result.finish_y == 24.0
        assert result.lock_broken is False
    
    def test_square_ratio_lock(self):
        """Lock with 1:1 ratio behaves like circular."""
        constraints = DimensionConstraints(
            shape='rectangular',
            aspect_ratio_locked=True,
            locked_aspect_ratio=1.0,
            min_dimension=8.0,
            max_dimension=84.0
        )
        
        result = calculate_constrained_dimensions('x', 30.0, 24.0, 24.0, constraints)
        
        assert result.finish_x == 30.0
        assert result.finish_y == 30.0
        assert result.lock_broken is False


class TestBoundaryConditions:
    """Test clamping behavior when dimensions hit limits."""
    
    def test_lock_breaks_at_max_boundary(self):
        """Lock breaks when calculated dimension exceeds max."""
        constraints = DimensionConstraints(
            shape='rectangular',
            aspect_ratio_locked=True,
            locked_aspect_ratio=2.0,
            min_dimension=8.0,
            max_dimension=40.0
        )
        
        # User drags width to 84, ideal height would be 42 (exceeds max of 40)
        result = calculate_constrained_dimensions('x', 84.0, 40.0, 20.0, constraints)
        
        assert result.finish_x == 84.0
        assert result.finish_y == 40.0  # Clamped to max
        assert result.lock_broken is True  # Lock broken by clamping
    
    def test_lock_breaks_at_min_boundary(self):
        """Lock breaks when calculated dimension falls below min."""
        constraints = DimensionConstraints(
            shape='rectangular',
            aspect_ratio_locked=True,
            locked_aspect_ratio=4.0,
            min_dimension=8.0,
            max_dimension=84.0
        )
        
        # User drags width to 20, ideal height would be 5 (below min of 8)
        result = calculate_constrained_dimensions('x', 20.0, 32.0, 8.0, constraints)
        
        assert result.finish_x == 20.0
        assert result.finish_y == 8.0  # Clamped to min
        assert result.lock_broken is True
    
    def test_lock_preserved_within_boundaries(self):
        """Lock maintains when calculated value is within bounds."""
        constraints = DimensionConstraints(
            shape='rectangular',
            aspect_ratio_locked=True,
            locked_aspect_ratio=1.5,
            min_dimension=8.0,
            max_dimension=84.0
        )
        
        result = calculate_constrained_dimensions('x', 60.0, 45.0, 30.0, constraints)
        
        assert result.finish_x == 60.0
        assert result.finish_y == 40.0  # 60 / 1.5 = 40 (within bounds)
        assert result.lock_broken is False


class TestDiamondShape:
    """Test diamond shape behaves like rectangular for dimensions."""
    
    def test_diamond_independent_dimensions(self):
        """Diamond with no lock: independent dimensions."""
        constraints = DimensionConstraints(
            shape='diamond',
            aspect_ratio_locked=False,
            locked_aspect_ratio=None,
            min_dimension=8.0,
            max_dimension=84.0
        )
        
        result = calculate_constrained_dimensions('x', 36.0, 24.0, 18.0, constraints)
        
        assert result.finish_x == 36.0
        assert result.finish_y == 18.0  # Unchanged
        assert result.lock_broken is False
    
    def test_diamond_respects_aspect_lock(self):
        """Diamond with lock: maintains ratio."""
        constraints = DimensionConstraints(
            shape='diamond',
            aspect_ratio_locked=True,
            locked_aspect_ratio=1.5,
            min_dimension=8.0,
            max_dimension=84.0
        )
        
        result = calculate_constrained_dimensions('y', 30.0, 36.0, 24.0, constraints)
        
        assert result.finish_x == 45.0  # 30 * 1.5 = 45
        assert result.finish_y == 30.0
        assert result.lock_broken is False


class TestEdgeCases:
    """Test unusual but valid scenarios."""
    
    def test_zero_locked_ratio_handled(self):
        """Edge case: locked_aspect_ratio is None when lock is False."""
        constraints = DimensionConstraints(
            shape='rectangular',
            aspect_ratio_locked=False,
            locked_aspect_ratio=None,  # Should be ignored
            min_dimension=8.0,
            max_dimension=84.0
        )
        
        result = calculate_constrained_dimensions('x', 40.0, 30.0, 20.0, constraints)
        
        assert result.finish_x == 40.0
        assert result.finish_y == 20.0
        assert result.lock_broken is False
    
    def test_minimum_dimension_clamp(self):
        """Ensures calculated value cannot go below minimum."""
        constraints = DimensionConstraints(
            shape='rectangular',
            aspect_ratio_locked=True,
            locked_aspect_ratio=10.0,  # Extreme ratio
            min_dimension=8.0,
            max_dimension=84.0
        )
        
        result = calculate_constrained_dimensions('x', 50.0, 80.0, 8.0, constraints)
        
        assert result.finish_x == 50.0
        assert result.finish_y == 8.0  # Would be 5, clamped to min
        assert result.lock_broken is True
    
    def test_maximum_dimension_clamp(self):
    """Ensures calculated value cannot exceed maximum."""
    constraints = DimensionConstraints(
        shape='rectangular',
        aspect_ratio_locked=True,
        locked_aspect_ratio=0.5,  # Height = 2 × Width
        min_dimension=8.0,
        max_dimension=84.0
    )
    
    # Width changes to 50, ideal height would be 100 (exceeds max of 84)
    result = calculate_constrained_dimensions('x', 50.0, 42.0, 21.0, constraints)
    
    assert result.finish_x == 50.0
    assert result.finish_y == 84.0  # Would be 100, clamped to max
    assert result.lock_broken is True  # Lock broken by boundary