#!/usr/bin/env python3
"""
Script to create and analyze n=2 panel meshes for CSG compatibility.
Tests if the panels created from geometry segments are watertight and manifold.
"""

import sys
import numpy as np
from pathlib import Path
import trimesh

# Add project root to path
project_root = Path(__file__).resolve().parent
sys.path.insert(0, str(project_root))

from services.dtos import CompositionStateDTO, FrameDesignDTO, PatternSettingsDTO
from services.geometry_service import GeometryService


def segments_to_mesh(segments, thickness=0.375):
    """
    Convert 2D geometry segments to a 3D mesh by extrusion.
    This mimics what Babylon.js ExtrudePolygon should do.
    """
    # Extract points from segments to create a 2D polygon
    points_2d = []
    
    for i, segment in enumerate(segments):
        if segment['type'] == 'arc':
            # Tessellate arc into line segments
            center = segment['center']
            radius = segment['radius']
            start = segment['start']
            end = segment['end']
            
            # Calculate angles
            start_angle = np.arctan2(start[1] - center[1], start[0] - center[0])
            end_angle = np.arctan2(end[1] - center[1], end[0] - center[0])
            
            # Handle arc direction
            if segment.get('is_counter_clockwise', True):
                if end_angle <= start_angle:
                    end_angle += 2 * np.pi
            else:
                if start_angle <= end_angle:
                    start_angle += 2 * np.pi
                    
            # Generate points along arc
            num_points = 20  # Points per arc for smooth curve
            angles = np.linspace(start_angle, end_angle, num_points)
            
            for angle in angles[:-1]:  # Skip last point to avoid duplication
                x = center[0] + radius * np.cos(angle)
                y = center[1] + radius * np.sin(angle)
                points_2d.append([x, y])
                
        elif segment['type'] == 'line':
            # Add start point of line
            points_2d.append(segment['start'])
    
    # Convert to numpy array
    points_2d = np.array(points_2d)
    
    # Create 3D mesh by extrusion
    # Bottom face vertices
    bottom_verts = np.column_stack([points_2d, np.zeros(len(points_2d))])
    # Top face vertices
    top_verts = np.column_stack([points_2d, np.full(len(points_2d), thickness)])
    
    # Combine vertices
    vertices = np.vstack([bottom_verts, top_verts])
    
    # Create faces
    faces = []
    n_points = len(points_2d)
    
    # Bottom face (triangulate using earcut-style approach)
    # For simplicity, using a fan triangulation from first vertex
    for i in range(1, n_points - 1):
        faces.append([0, i, i + 1])
    
    # Top face
    for i in range(1, n_points - 1):
        faces.append([n_points, n_points + i + 1, n_points + i])
    
    # Side faces (quads split into triangles)
    for i in range(n_points):
        j = (i + 1) % n_points
        # Bottom triangle
        faces.append([i, j, j + n_points])
        # Top triangle
        faces.append([i, j + n_points, i + n_points])
    
    # Create trimesh object
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
    
    return mesh


def analyze_section_mesh(section_segments, section_name):
    """Analyze a single section's mesh for CSG compatibility."""
    
    print(f"\n{'='*50}")
    print(f"Analyzing {section_name}")
    print(f"{'='*50}")
    
    # Create mesh from segments
    try:
        mesh = segments_to_mesh(section_segments)
        print(f"✓ Mesh created successfully")
        print(f"  Vertices: {len(mesh.vertices)}")
        print(f"  Faces: {len(mesh.faces)}")
        print(f"  Edges: {len(mesh.edges)}")
        
    except Exception as e:
        print(f"✗ Failed to create mesh: {e}")
        return False
        
    # Check if watertight (no holes)
    is_watertight = mesh.is_watertight
    print(f"\nWatertight check: {'✓ PASS' if is_watertight else '✗ FAIL'}")
    if not is_watertight:
        print(f"  - Mesh has holes and cannot be used for CSG")
        print(f"  - Found {len(mesh.edges_unique)} unique edges")
        print(f"  - Found {len(mesh.edges_unique_length)} unique edge lengths")
        
    # Check if manifold (valid topology)
    # Different trimesh versions have different attributes
    is_manifold = True
    if hasattr(mesh, 'is_manifold'):
        is_manifold = mesh.is_manifold
    elif hasattr(mesh, 'is_winding_consistent'):
        is_manifold = mesh.is_winding_consistent
    else:
        # Check manually: all edges should be shared by exactly 2 faces
        try:
            edges_faces = mesh.edges_face
            edge_count = {}
            for edge in mesh.edges_unique:
                edge_tuple = tuple(sorted(edge))
                edge_count[edge_tuple] = edge_count.get(edge_tuple, 0) + 1
            non_manifold = [e for e, count in edge_count.items() if count != 2]
            is_manifold = len(non_manifold) == 0
            if not is_manifold:
                print(f"  - Found {len(non_manifold)} non-manifold edges")
        except:
            print("  - Unable to verify manifold property")
            
    print(f"Manifold check: {'✓ PASS' if is_manifold else '✗ FAIL'}")
    if not is_manifold:
        print(f"  - Mesh has invalid topology for CSG")
            
    # Check if solid (watertight + consistent normals)
    is_solid = False
    if hasattr(mesh, 'is_volume'):
        is_solid = mesh.is_volume
    else:
        # Alternative check: watertight and consistent winding
        is_solid = is_watertight and is_manifold
        
    print(f"Solid check: {'✓ PASS' if is_solid else '✗ FAIL'}")
    
    if is_solid or is_watertight:
        try:
            volume = mesh.volume
            print(f"  - Volume: {volume:.3f} cubic inches")
            if volume < 0:
                print(f"  ⚠ Negative volume indicates inverted normals")
        except:
            print(f"  - Unable to calculate volume")
    else:
        print(f"  - Mesh is not a valid solid for CSG")
        
    # Check face normals
    print(f"\nFace normals:")
    if mesh.faces.shape[0] > 0:
        # Check if normals are consistently oriented
        face_normals = mesh.face_normals
        avg_normal = np.mean(face_normals, axis=0)
        print(f"  - Average normal direction: {avg_normal}")
        
        # Check for inverted faces
        z_components = face_normals[:, 2]
        facing_up = np.sum(z_components > 0)
        facing_down = np.sum(z_components < 0)
        print(f"  - Faces pointing up: {facing_up}")
        print(f"  - Faces pointing down: {facing_down}")
        
        if facing_up > 0 and facing_down > 0:
            print(f"  ⚠ Mixed face orientations detected")
            
    # Check for duplicate vertices
    unique_verts = np.unique(mesh.vertices, axis=0)
    if len(unique_verts) < len(mesh.vertices):
        print(f"\n⚠ Found {len(mesh.vertices) - len(unique_verts)} duplicate vertices")
        
    # Check for degenerate faces
    areas = mesh.area_faces
    degenerate = np.sum(areas < 1e-10)
    if degenerate > 0:
        print(f"⚠ Found {degenerate} degenerate faces (zero area)")
        
    # Summary
    print(f"\n{'CSG COMPATIBLE' if (is_watertight and is_manifold and is_solid) else 'NOT CSG COMPATIBLE'}")
    
    return is_watertight and is_manifold and is_solid


def main():
    """Main analysis function."""
    
    print("Panel Mesh Analysis for CSG Compatibility")
    print("="*60)
    
    # Create test state for n=2
    state = CompositionStateDTO(
        frame_design=FrameDesignDTO(
            finish_x=36.0,
            finish_y=36.0,
            number_sections=2,
            separation=2.0
        ),
        pattern_settings=PatternSettingsDTO(
            number_slots=48,
            slot_style='radial',
            bit_diameter=0.25,
            spacer=0.5,
            x_offset=0.75,
            y_offset=1.5,
            scale_center_point=1.0,
            amplitude_exponent=1.0,
            orientation='auto',
            grain_angle=90.0
        )
    )
    
    # Generate geometry
    geometry_service = GeometryService()
    segments = geometry_service.create_frame_geometry(state)
    
    print(f"Generated {len(segments)} segments total")
    
    # Analyze segment structure
    arc_segments = [s for s in segments if s['type'] == 'arc']
    line_segments = [s for s in segments if s['type'] == 'line']
    
    print(f"  - {len(arc_segments)} arc segments")
    print(f"  - {len(line_segments)} line segments")
    
    # For n=2, segments are typically interleaved: [left_arc, right_arc, left_line, right_line]
    # We need to group them correctly
    
    if state.frame_design.number_sections == 2:
        print("\nGrouping segments for n=2 sections...")
        
        # Based on the corrected ordering: right section first, then left
        # The segments may be interleaved or sequential
        if len(segments) == 4:
            # Simple case: 2 arcs + 2 lines
            right_segments = [segments[1], segments[3]]  # Right arc + right line
            left_segments = [segments[0], segments[2]]   # Left arc + left line
        else:
            # More complex segmentation - need to analyze positions
            print("Complex segment structure detected, analyzing positions...")
            
            # Group by analyzing center positions
            right_segments = []
            left_segments = []
            
            for seg in segments:
                if seg['type'] == 'arc':
                    # Check which side based on arc position
                    if seg['start'][0] > 18:  # Right side
                        right_segments.append(seg)
                    else:
                        left_segments.append(seg)
                elif seg['type'] == 'line':
                    # Check line position
                    avg_x = (seg['start'][0] + seg['end'][0]) / 2
                    if avg_x > 18:
                        right_segments.append(seg)
                    else:
                        left_segments.append(seg)
        
        # Analyze each section
        right_compatible = analyze_section_mesh(right_segments, "Right Section (Section 0)")
        left_compatible = analyze_section_mesh(left_segments, "Left Section (Section 1)")
        
        # Overall summary
        print("\n" + "="*60)
        print("OVERALL ANALYSIS SUMMARY")
        print("="*60)
        
        if right_compatible and left_compatible:
            print("✓ Both sections are CSG compatible")
            print("  The panels should work for boolean operations")
        else:
            print("✗ One or both sections are not CSG compatible")
            print("  CSG operations may fail or produce unexpected results")
            
            if not right_compatible:
                print("  - Right section has issues")
            if not left_compatible:
                print("  - Left section has issues")
                
            print("\nPossible fixes:")
            print("  1. Ensure segments form a closed loop")
            print("  2. Check segment ordering (should be continuous)")
            print("  3. Verify arc directions are consistent")
            print("  4. Ensure no gaps between segment endpoints")
    
    else:
        print(f"Analysis for n={state.frame_design.number_sections} not yet implemented")


if __name__ == "__main__":
    main()