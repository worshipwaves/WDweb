"""
WaveDesigner Blender Render Script
Generates photorealistic renders from CSG JSON data.

Usage:
    blender --background --python render_panel.py -- --config csg_response.json --output render.png

Requirements:
    - Blender 4.x
    - ACHDRI file in hdri/ directory
    - Wood textures in textures/wood/ directory
"""

import bpy
import bmesh
import math
import json
import sys
import os
import time
from pathlib import Path
from mathutils import Vector, Matrix, Euler

# ============================================
# CONFIGURATION
# ============================================

class Config:
    """Paths and render settings"""
    
    # Base paths (will be set from script location)
    BASE_DIR = Path(__file__).parent
    TEXTURE_DIR = BASE_DIR.parent / "public" / "assets" / "textures" / "wood"
    HDRI_PATH = BASE_DIR / "hdri" / "studio_small_09_4k.exr"
    OUTPUT_DIR = BASE_DIR / "output"
    
    # Render settings
    RENDER_WIDTH = 2048
    RENDER_HEIGHT = 2048
    RENDER_SAMPLES = 512
    USE_DENOISER = True
    
    # Geometry settings
    SLOT_FILLET_RADIUS = 0.125  # 0.25" bit diameter / 2
    SLOT_FILLET_SEGMENTS = 8
    
    # Material settings
    TEXTURE_SIZE = "Large_400cm"  # Large_400cm, Medium_99cm, Small_36cm
    USE_VARNISHED = True
    
    # Unit conversion (inches to Blender units/meters)
    SCALE_FACTOR = 0.0254  # 1 inch = 0.0254 meters
    
    # Camera settings
    FRAME_FILL = 0.75  # Fill 95% of frame


# ============================================
# GEOMETRY BUILDERS
# ============================================

def create_semicircle_mesh(name: str, radius: float, thickness: float, 
                           center_x: float, is_right: bool) -> bpy.types.Object:
    """
    Create a semicircle mesh for circular n=2 panels.
    """
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    
    bm = bmesh.new()
    
    # Create semicircle profile
    segments = 64
    verts_bottom = []
    verts_top = []
    
    # Angle range: right half = -90Ã‚Â° to 90Ã‚Â°, left half = 90Ã‚Â° to 270Ã‚Â°
    if is_right:
        start_angle = -math.pi / 2
        end_angle = math.pi / 2
    else:
        start_angle = math.pi / 2
        end_angle = 3 * math.pi / 2
    
    for i in range(segments + 1):
        t = i / segments
        angle = start_angle + t * (end_angle - start_angle)
        x = math.cos(angle) * radius
        y = math.sin(angle) * radius
        
        verts_bottom.append(bm.verts.new((x, y, 0)))
        verts_top.append(bm.verts.new((x, y, thickness)))
    
    # Add center vertices for flat edge
    center_bottom = bm.verts.new((0, -radius if is_right else radius, 0))
    center_top = bm.verts.new((0, -radius if is_right else radius, thickness))
    
    bm.verts.ensure_lookup_table()
    
    # Create faces
    # Bottom face
    bottom_verts = verts_bottom + [center_bottom] if is_right else verts_bottom + [center_bottom]
    try:
        bm.faces.new(verts_bottom[::-1])  # Reversed for correct normal
    except:
        pass
    
    # Top face  
    try:
        bm.faces.new(verts_top)
    except:
        pass
    
    # Curved edge faces
    for i in range(segments):
        try:
            bm.faces.new([
                verts_bottom[i], verts_bottom[i + 1],
                verts_top[i + 1], verts_top[i]
            ])
        except:
            pass
    
    # Flat edge face (diameter)
    try:
        bm.faces.new([
            verts_bottom[0], verts_top[0],
            verts_top[-1], verts_bottom[-1]
        ])
    except:
        pass
    
    bm.to_mesh(mesh)
    bm.free()
    
    # Position
    obj.location.x = center_x * Config.SCALE_FACTOR
    
    return obj


def create_circular_panel_base(radius: float, thickness: float, 
                                separation: float, num_sections: int) -> list:
    """
    Create base panel geometry for circular shape.
    
    Returns list of section objects.
    """
    sections = []
    
    if num_sections == 2:
        # Two semicircles with gap
        gap = separation * Config.SCALE_FACTOR
        offset = gap / 2 + (radius * Config.SCALE_FACTOR) / 2
        
        # Right section
        right = create_semicircle_section(
            "section_0", 
            radius * Config.SCALE_FACTOR,
            thickness * Config.SCALE_FACTOR,
            offset
        )
        sections.append(right)
        
        # Left section
        left = create_semicircle_section(
            "section_1",
            radius * Config.SCALE_FACTOR, 
            thickness * Config.SCALE_FACTOR,
            -offset
        )
        sections.append(left)
    
    elif num_sections == 1:
        # Full circle
        circle = create_full_circle_section(
            "section_0",
            radius * Config.SCALE_FACTOR,
            thickness * Config.SCALE_FACTOR
        )
        sections.append(circle)
    
    return sections


def create_semicircle_section(name: str, radius: float, thickness: float, 
                               center_x: float) -> bpy.types.Object:
    """Create a semicircle section using curves for clean geometry."""
    
    # Create curve for semicircle profile
    curve_data = bpy.data.curves.new(name + '_curve', 'CURVE')
    curve_data.dimensions = '2D'
    curve_data.fill_mode = 'BOTH'
    
    spline = curve_data.splines.new('BEZIER')
    
    # Semicircle needs 3 control points with handles
    spline.bezier_points.add(2)  # Total 3 points
    
    # Determine if right or left based on center_x
    is_right = center_x > 0
    
    if is_right:
        # Right semicircle: arc from bottom to top on right side
        points = [
            (0, -radius),   # Bottom of diameter
            (radius, 0),    # Rightmost point
            (0, radius),    # Top of diameter
        ]
        # Bezier handles for circular arc approximation
        handle_length = radius * 0.552284749831  # Magic number for circle approximation
        handles_left = [
            (handle_length, -radius),
            (radius, -handle_length),
            (-handle_length, radius),
        ]
        handles_right = [
            (-handle_length, -radius),
            (radius, handle_length),
            (handle_length, radius),
        ]
    else:
        # Left semicircle
        points = [
            (0, radius),    # Top of diameter
            (-radius, 0),   # Leftmost point
            (0, -radius),   # Bottom of diameter
        ]
        handle_length = radius * 0.552284749831
        handles_left = [
            (-handle_length, radius),
            (-radius, handle_length),
            (handle_length, -radius),
        ]
        handles_right = [
            (handle_length, radius),
            (-radius, -handle_length),
            (-handle_length, -radius),
        ]
    
    for i, bp in enumerate(spline.bezier_points):
        bp.co = (points[i][0], points[i][1], 0)
        bp.handle_left = (handles_left[i][0], handles_left[i][1], 0)
        bp.handle_right = (handles_right[i][0], handles_right[i][1], 0)
        bp.handle_left_type = 'FREE'
        bp.handle_right_type = 'FREE'
    
    # Close the curve with straight line (diameter)
    spline.use_cyclic_u = True
    
    # Create object from curve
    curve_obj = bpy.data.objects.new(name + '_curve_obj', curve_data)
    bpy.context.collection.objects.link(curve_obj)
    
    # Convert to mesh and extrude
    bpy.context.view_layer.objects.active = curve_obj
    curve_obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    
    # Extrude for thickness
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.extrude_region_move(TRANSFORM_OT_translate={"value": (0, 0, thickness)})
    bpy.ops.object.mode_set(mode='OBJECT')
    
    # Rename and position
    curve_obj.name = name
    curve_obj.location.x = center_x
    
    return curve_obj
    
    
def create_rectangular_section_mesh(name: str, width: float, height: float, 
                                     thickness: float, center_x: float, 
                                     center_y: float) -> bpy.types.Object:
    """Create a rectangular section mesh."""
    bpy.ops.mesh.primitive_cube_add(
        size=1,
        location=(center_x, center_y, thickness / 2)
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (width, height, thickness)
    
    # Apply scale to mesh data
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    
    return obj


def create_diamond_section_mesh(name: str, half_width: float, half_height: float,
                                 thickness: float, quadrant: int,
                                 gap_x: float, gap_y: float) -> bpy.types.Object:
    """
    Create a triangular quadrant for diamond panel.
    Quadrants (clockwise from top-right): 0=TR, 1=BR, 2=BL, 3=TL
    
    Each quadrant is bounded by:
    - Inner corner at gap intersection
    - Two points where gap lines intersect the outer diagonal edge
    
    Diamond diagonal equation: |x|/half_width + |y|/half_height = 1
    """
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    
    bm = bmesh.new()
    
    half_gap_x = gap_x / 2
    half_gap_y = gap_y / 2
    
    # Calculate intersection points where gap lines meet diagonal edges
    # For TR diagonal (from top to right): x/hw + y/hh = 1
    # Vertical gap (x = half_gap_x) intersects at: y = hh * (1 - half_gap_x/hw)
    # Horizontal gap (y = half_gap_y) intersects at: x = hw * (1 - half_gap_y/hh)
    
    if quadrant == 0:  # Top-Right: diagonal from (0, hh) to (hw, 0)
        v0 = (half_gap_x, half_gap_y, 0)  # Inner corner
        v1 = (half_width * (1 - half_gap_y / half_height), half_gap_y, 0)  # Horizontal gap meets diagonal
        v2 = (half_gap_x, half_height * (1 - half_gap_x / half_width), 0)  # Vertical gap meets diagonal
    elif quadrant == 1:  # Bottom-Right: diagonal from (hw, 0) to (0, -hh)
        v0 = (half_gap_x, -half_gap_y, 0)
        v1 = (half_gap_x, -half_height * (1 - half_gap_x / half_width), 0)  # Vertical gap meets diagonal
        v2 = (half_width * (1 - half_gap_y / half_height), -half_gap_y, 0)  # Horizontal gap meets diagonal
    elif quadrant == 2:  # Bottom-Left: diagonal from (0, -hh) to (-hw, 0)
        v0 = (-half_gap_x, -half_gap_y, 0)
        v1 = (-half_width * (1 - half_gap_y / half_height), -half_gap_y, 0)  # Horizontal gap meets diagonal
        v2 = (-half_gap_x, -half_height * (1 - half_gap_x / half_width), 0)  # Vertical gap meets diagonal
    else:  # Top-Left: diagonal from (-hw, 0) to (0, hh)
        v0 = (-half_gap_x, half_gap_y, 0)
        v1 = (-half_gap_x, half_height * (1 - half_gap_x / half_width), 0)  # Vertical gap meets diagonal
        v2 = (-half_width * (1 - half_gap_y / half_height), half_gap_y, 0)  # Horizontal gap meets diagonal
    
    # Create bottom face vertices
    bv0 = bm.verts.new(v0)
    bv1 = bm.verts.new(v1)
    bv2 = bm.verts.new(v2)
    
    # Create top face vertices
    tv0 = bm.verts.new((v0[0], v0[1], thickness))
    tv1 = bm.verts.new((v1[0], v1[1], thickness))
    tv2 = bm.verts.new((v2[0], v2[1], thickness))
    
    bm.verts.ensure_lookup_table()
    
    # Create faces
    bm.faces.new([bv0, bv2, bv1])  # Bottom (reversed for normal)
    bm.faces.new([tv0, tv1, tv2])  # Top
    bm.faces.new([bv0, bv1, tv1, tv0])  # Side 1
    bm.faces.new([bv1, bv2, tv2, tv1])  # Side 2
    bm.faces.new([bv2, bv0, tv0, tv2])  # Side 3
    
    bm.to_mesh(mesh)
    bm.free()
    
    return obj   


def create_full_circle_section(name: str, radius: float, thickness: float) -> bpy.types.Object:
    """Create a full circle section."""
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius,
        depth=thickness,
        vertices=64,
        location=(0, 0, thickness / 2)
    )
    obj = bpy.context.active_object
    obj.name = name
    return obj
    
    
def create_environment_wall(panel_config):
    """
    Creates a large wall behind the artwork to provide visual context
    and break the illusion of the object rotating.
    """
    # Create wall plane
    # Position at 0.5m Y (positive Y is behind panel) to prevent occlusion of backing
    bpy.ops.mesh.primitive_plane_add(size=10, location=(0, 0.5, 0))
    wall = bpy.context.active_object
    wall.name = "Environment_Wall"
    
    # Rotate to stand vertical (facing -Y)
    wall.rotation_euler = (math.radians(90), 0, 0)
    
    # Scale it up to cover the background (50x50 meters)
    wall.scale = (5, 5, 1) 
    
    # Create simple wall material (Matte White/Grey)
    mat = bpy.data.materials.new(name="Wall_Paint")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    
    output = nodes.new('ShaderNodeOutputMaterial')
    principled = nodes.new('ShaderNodeBsdfPrincipled')
    
    # Off-white color (Light Grey)
    principled.inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1)
    principled.inputs['Roughness'].default_value = 0.9 # Matte wall
    principled.inputs['Specular IOR Level'].default_value = 0.1 # Low reflection
    
    mat.node_tree.links.new(principled.outputs['BSDF'], output.inputs['Surface'])
    
    wall.data.materials.append(mat)
    return wall    


def create_slot_cutter(slot_data: dict, thickness: float) -> bpy.types.Object:
    """
    Create a slot cutter with true filleted corners.
    """
    vertices = slot_data['vertices']
    
    # Transform from CNC coordinates (bottom-left origin) to centered
    # The JSON center is at (21, 21) for 42x42 panel
    center_offset_x = 21  # Will be read from panel_config
    center_offset_y = 21
    
    # Convert vertices to centered coordinates
    centered_verts = []
    for v in vertices:
        centered_verts.append((
            (v[0] - center_offset_x) * Config.SCALE_FACTOR,
            (v[1] - center_offset_y) * Config.SCALE_FACTOR
        ))
    
    # Create curve with rounded corners
    curve_data = bpy.data.curves.new('slot_curve', 'CURVE')
    curve_data.dimensions = '2D'
    curve_data.fill_mode = 'BOTH'
    
    spline = curve_data.splines.new('POLY')
    spline.points.add(len(centered_verts) - 1)
    
    for i, v in enumerate(centered_verts):
        spline.points[i].co = (v[0], v[1], 0, 1)
    
    spline.use_cyclic_u = True
    
    # Create object
    curve_obj = bpy.data.objects.new('slot_cutter', curve_data)
    bpy.context.collection.objects.link(curve_obj)
    
    # Add bevel for rounded corners
    curve_data.bevel_depth = Config.SLOT_FILLET_RADIUS * Config.SCALE_FACTOR
    curve_data.bevel_resolution = Config.SLOT_FILLET_SEGMENTS
    
    # Convert to mesh
    bpy.context.view_layer.objects.active = curve_obj
    curve_obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    
    # Extrude through panel
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    cutter_depth = thickness * Config.SCALE_FACTOR * 2
    bpy.ops.mesh.extrude_region_move(
        TRANSFORM_OT_translate={"value": (0, 0, cutter_depth)}
    )
    bpy.ops.object.mode_set(mode='OBJECT')
    
    # Position cutter to intersect panel
    curve_obj.location.z = -thickness * Config.SCALE_FACTOR * 0.5
    
    return curve_obj


def cut_slots_from_section(section: bpy.types.Object, slots: list, 
                           panel_config: dict, section_index: int) -> bpy.types.Object:
    """
    Cut slots from a section using boolean operations.
    """
    center_x = panel_config['finish_x'] / 2
    center_y = panel_config['finish_y'] / 2
    separation = panel_config['separation']
    thickness = panel_config['thickness']
    
    # Filter slots belonging to this section
    section_slots = []
    for slot in slots:
        slot_center_x = slot['x'] - center_x
        
        if panel_config['number_sections'] == 2:
            # Right section (index 0) gets positive X slots
            # Left section (index 1) gets negative X slots
            if section_index == 0 and slot_center_x > 0:
                section_slots.append(slot)
            elif section_index == 1 and slot_center_x < 0:
                section_slots.append(slot)
        else:
            section_slots.append(slot)
    
    print(f"Section {section_index}: cutting {len(section_slots)} slots")
    
    # Create and apply boolean for each slot
    for i, slot in enumerate(section_slots):
        cutter = create_slot_cutter_mesh(slot, panel_config)
        
        if cutter is None:
            continue
        
        # Add boolean modifier
        bool_mod = section.modifiers.new(name=f'slot_{i}', type='BOOLEAN')
        bool_mod.operation = 'DIFFERENCE'
        bool_mod.object = cutter
        bool_mod.solver = 'EXACT'
        
        # Apply modifier
        bpy.context.view_layer.objects.active = section
        bpy.ops.object.modifier_apply(modifier=bool_mod.name)
        
        # Delete cutter
        bpy.data.objects.remove(cutter, do_unlink=True)
    
    return section


def cut_slots_with_center(section: bpy.types.Object, slots: list, 
                          center_x: float, center_y: float, 
                          thickness: float) -> bpy.types.Object:
    """
    Cut slots from a section using explicit center coordinates.
    Used for asymmetric panels where each section has its own coordinate system.
    """
    print(f"Cutting {len(slots)} slots with center ({center_x}, {center_y})")
    
    for i, slot in enumerate(slots):
        vertices = slot.get('vertices', [])
        if len(vertices) != 4:
            continue
        
        # Transform vertices from panel-local to world-centered coordinates
        scaled_verts = []
        for v in vertices:
            scaled_verts.append((
                (v[0] - center_x) * Config.SCALE_FACTOR,
                (v[1] - center_y) * Config.SCALE_FACTOR
            ))
        
        # Create cutter mesh
        cutter = create_slot_cutter_from_verts(scaled_verts, thickness)
        if cutter is None:
            continue
        
        # Boolean difference
        bool_mod = section.modifiers.new(name=f'slot_{i}', type='BOOLEAN')
        bool_mod.operation = 'DIFFERENCE'
        bool_mod.object = cutter
        bool_mod.solver = 'EXACT'
        
        bpy.context.view_layer.objects.active = section
        bpy.ops.object.modifier_apply(modifier=bool_mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
    
    return section


def create_slot_cutter_from_verts(scaled_verts: list, thickness: float) -> bpy.types.Object:
    """
    Create slot cutter from pre-scaled vertices.
    """
    mesh = bpy.data.meshes.new('slot_cutter_mesh')
    obj = bpy.data.objects.new('slot_cutter', mesh)
    bpy.context.collection.objects.link(obj)
    
    bm = bmesh.new()
    
    # Generate filleted polygon
    fillet_radius = Config.SLOT_FILLET_RADIUS * Config.SCALE_FACTOR
    fillet_segments = Config.SLOT_FILLET_SEGMENTS
    
    all_verts_2d = []
    
    for i in range(4):
        p_prev = scaled_verts[(i - 1) % 4]
        p_curr = scaled_verts[i]
        p_next = scaled_verts[(i + 1) % 4]
        
        to_prev = (p_prev[0] - p_curr[0], p_prev[1] - p_curr[1])
        to_next = (p_next[0] - p_curr[0], p_next[1] - p_curr[1])
        
        len_prev = math.sqrt(to_prev[0]**2 + to_prev[1]**2)
        len_next = math.sqrt(to_next[0]**2 + to_next[1]**2)
        
        if len_prev < 0.0001 or len_next < 0.0001:
            all_verts_2d.append(p_curr)
            continue
        
        dir_prev = (to_prev[0] / len_prev, to_prev[1] / len_prev)
        dir_next = (to_next[0] / len_next, to_next[1] / len_next)
        
        effective_radius = min(fillet_radius, len_prev * 0.4, len_next * 0.4)
        
        arc_start = (
            p_curr[0] + dir_prev[0] * effective_radius,
            p_curr[1] + dir_prev[1] * effective_radius
        )
        arc_end = (
            p_curr[0] + dir_next[0] * effective_radius,
            p_curr[1] + dir_next[1] * effective_radius
        )
        
        for s in range(fillet_segments + 1):
            t = s / fillet_segments
            mt = 1 - t
            x = mt*mt*arc_start[0] + 2*mt*t*p_curr[0] + t*t*arc_end[0]
            y = mt*mt*arc_start[1] + 2*mt*t*p_curr[1] + t*t*arc_end[1]
            all_verts_2d.append((x, y))
    
    z_bottom = -thickness * Config.SCALE_FACTOR
    z_top = thickness * Config.SCALE_FACTOR * 2
    
    verts_bottom = []
    verts_top = []
    
    for v2d in all_verts_2d:
        verts_bottom.append(bm.verts.new((v2d[0], v2d[1], z_bottom)))
        verts_top.append(bm.verts.new((v2d[0], v2d[1], z_top)))
    
    bm.verts.ensure_lookup_table()
    
    n = len(all_verts_2d)
    try:
        bm.faces.new(verts_bottom)
    except:
        pass
    try:
        bm.faces.new(verts_top[::-1])
    except:
        pass
    for i in range(n):
        i_next = (i + 1) % n
        try:
            bm.faces.new([
                verts_bottom[i], verts_bottom[i_next],
                verts_top[i_next], verts_top[i]
            ])
        except:
            pass
    
    bm.to_mesh(mesh)
    bm.free()
    
    return obj


def create_slot_cutter_mesh(slot: dict, panel_config: dict) -> bpy.types.Object:
    """
    Create a slot cutter mesh with proper filleted corners.
    Uses native Blender curves for true arcs.
    """
    vertices = slot.get('vertices', [])
    if len(vertices) != 4:
        return None
    
    center_x = panel_config['finish_x'] / 2
    center_y = panel_config['finish_y'] / 2
    thickness = panel_config['thickness']
    
    # Convert to centered, scaled coordinates
    scaled_verts = []
    for v in vertices:
        scaled_verts.append((
            (v[0] - center_x) * Config.SCALE_FACTOR,
            (v[1] - center_y) * Config.SCALE_FACTOR
        ))
    
    # Create mesh directly with filleted corners
    mesh = bpy.data.meshes.new('slot_cutter_mesh')
    obj = bpy.data.objects.new('slot_cutter', mesh)
    bpy.context.collection.objects.link(obj)
    
    bm = bmesh.new()
    
    # Generate filleted polygon
    fillet_radius = Config.SLOT_FILLET_RADIUS * Config.SCALE_FACTOR
    fillet_segments = Config.SLOT_FILLET_SEGMENTS
    
    all_verts_2d = []
    
    for i in range(4):
        p_prev = scaled_verts[(i - 1) % 4]
        p_curr = scaled_verts[i]
        p_next = scaled_verts[(i + 1) % 4]
        
        # Vectors to adjacent vertices
        to_prev = (p_prev[0] - p_curr[0], p_prev[1] - p_curr[1])
        to_next = (p_next[0] - p_curr[0], p_next[1] - p_curr[1])
        
        # Normalize
        len_prev = math.sqrt(to_prev[0]**2 + to_prev[1]**2)
        len_next = math.sqrt(to_next[0]**2 + to_next[1]**2)
        
        if len_prev < 0.0001 or len_next < 0.0001:
            all_verts_2d.append(p_curr)
            continue
        
        dir_prev = (to_prev[0] / len_prev, to_prev[1] / len_prev)
        dir_next = (to_next[0] / len_next, to_next[1] / len_next)
        
        # Effective fillet radius (limited by edge lengths)
        effective_radius = min(fillet_radius, len_prev * 0.4, len_next * 0.4)
        
        # Arc start and end points
        arc_start = (
            p_curr[0] + dir_prev[0] * effective_radius,
            p_curr[1] + dir_prev[1] * effective_radius
        )
        arc_end = (
            p_curr[0] + dir_next[0] * effective_radius,
            p_curr[1] + dir_next[1] * effective_radius
        )
        
        # Generate arc points using quadratic bezier approximation
        for s in range(fillet_segments + 1):
            t = s / fillet_segments
            mt = 1 - t
            # Quadratic bezier: P = (1-t)Ã‚Â²Ã‚Â·P0 + 2(1-t)tÃ‚Â·P1 + tÃ‚Â²Ã‚Â·P2
            x = mt*mt*arc_start[0] + 2*mt*t*p_curr[0] + t*t*arc_end[0]
            y = mt*mt*arc_start[1] + 2*mt*t*p_curr[1] + t*t*arc_end[1]
            all_verts_2d.append((x, y))
    
    # Create bottom and top vertices
    z_bottom = -thickness * Config.SCALE_FACTOR
    z_top = thickness * Config.SCALE_FACTOR * 2
    
    verts_bottom = []
    verts_top = []
    
    for v2d in all_verts_2d:
        verts_bottom.append(bm.verts.new((v2d[0], v2d[1], z_bottom)))
        verts_top.append(bm.verts.new((v2d[0], v2d[1], z_top)))
    
    bm.verts.ensure_lookup_table()
    
    # Create faces
    n = len(all_verts_2d)
    
    # Bottom face
    try:
        bm.faces.new(verts_bottom)
    except:
        pass
    
    # Top face
    try:
        bm.faces.new(verts_top[::-1])
    except:
        pass
    
    # Side faces
    for i in range(n):
        i_next = (i + 1) % n
        try:
            bm.faces.new([
                verts_bottom[i], verts_bottom[i_next],
                verts_top[i_next], verts_top[i]
            ])
        except:
            pass
    
    bm.to_mesh(mesh)
    bm.free()
    
    return obj


# ============================================
# MATERIALS
# ============================================

def create_wood_material(species: str, name: str, grain_direction: str = 'vertical',
                         section_index: int = 0, shape: str = 'circular',
                         panel_width: float = 42.0, panel_height: float = 42.0) -> bpy.types.Material:
    """
    Create a PBR wood material from texture files.
    """
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    
    # Clear default nodes
    nodes.clear()
    
    # Create nodes
    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (800, 0)
    
    principled = nodes.new('ShaderNodeBsdfPrincipled')
    principled.location = (400, 0)
    
    # Texture coordinate - use Object instead of UV for consistent projection
    tex_coord = nodes.new('ShaderNodeTexCoord')
    tex_coord.location = (-800, 0)
    
    # Shared coordinate origin for consistent UV mapping across sections
    coord_empty = bpy.data.objects.get('TextureCoordOrigin')
    if not coord_empty:
        coord_empty = bpy.data.objects.new('TextureCoordOrigin', None)
        bpy.context.collection.objects.link(coord_empty)
        coord_empty.hide_viewport = True
        coord_empty.hide_render = True
    tex_coord.object = coord_empty
    
    mapping = nodes.new('ShaderNodeMapping')
    mapping.location = (-600, 0)
    
    # Grain direction rotation
    grain_angles = {'horizontal': 0, 'vertical': 90, 'radiant': 0, 'diamond': 45}
    
    # Diamond shape: per-section angles for radiant/diamond grain patterns
    diamond_radiant_angles = [135, 45, 315, 225]  # TR, BR, BL, TL
    diamond_diamond_angles = [45, 315, 225, 135]  # TR, BR, BL, TL
    
    if shape == 'diamond' and grain_direction == 'radiant':
        grain_rotation_deg = diamond_radiant_angles[section_index % 4]
    elif shape == 'diamond' and grain_direction == 'diamond':
        grain_rotation_deg = diamond_diamond_angles[section_index % 4]
    else:
        grain_rotation_deg = grain_angles.get(grain_direction, 90)
    print(f"DEBUG GRAIN: section={section_index}, shape={shape}, grain_dir={grain_direction}, rotation={grain_rotation_deg}°")
    mapping.inputs['Rotation'].default_value = (0, 0, math.radians(grain_rotation_deg))
    
    # Scale for Generated coordinates (0-1 normalized per object bounding box)
    # Scale down by 0.7 to ensure full coverage after any rotation (sqrt(2)/2 ≈ 0.707)
    # This maps the section to ~70% of texture, leaving margin for rotation
    import random
    rotation_margin = 0.7
    mapping.inputs['Scale'].default_value = (rotation_margin, rotation_margin, 1.0)
    
    # Center the texture mapping, then apply small random offset
    # Generated coords are 0-1, so center is 0.5 - we offset to center the scaled region
    center_offset = (1.0 - rotation_margin) / 2  # Centers the 0.7 region within 0-1
    random.seed(section_index + hash(species))
    jitter = 0.05  # Small random variation
    offset_x = center_offset + (random.random() - 0.5) * jitter
    offset_y = center_offset + (random.random() - 0.5) * jitter
    mapping.inputs['Location'].default_value = (offset_x, offset_y, 0)
    
    # Connect Generated coordinates (object-local, rotation-invariant)
    links.new(tex_coord.outputs['Generated'], mapping.inputs['Vector'])
    
    # Build texture paths
    texture_base = Config.TEXTURE_DIR / species
    size_folder = Config.TEXTURE_SIZE
    
    if Config.USE_VARNISHED:
        diffuse_path = texture_base / "Varnished" / size_folder / "Diffuse"
    else:
        diffuse_path = texture_base / "Raw" / size_folder / "Diffuse"
    
    shared_path = texture_base / "Shared_Maps" / size_folder
    
    # Debug: print resolved paths
    print(f"DEBUG texture_base: {texture_base}")
    print(f"DEBUG diffuse_path: {diffuse_path} exists={diffuse_path.exists()}")
    print(f"DEBUG shared_path: {shared_path} exists={shared_path.exists()}")
    
    # Find texture files
    diffuse_file = find_texture_file(diffuse_path, "_d.png")
    print(f"DEBUG diffuse_file: {diffuse_file}")
    normal_file = find_texture_file(shared_path / "Normal", "_n.png")
    roughness_file = find_texture_file(shared_path / "Roughness", "_r.png")
    bump_file = find_texture_file(shared_path / "Bump", "_b.png")
    
    # Diffuse/Albedo
    if diffuse_file:
        diffuse_tex = nodes.new('ShaderNodeTexImage')
        diffuse_tex.location = (-200, 200)
        diffuse_tex.image = bpy.data.images.load(str(diffuse_file))
        diffuse_tex.extension = 'EXTEND'  # Prevent tiling
        print(f"DEBUG loaded image: {diffuse_tex.image.name if diffuse_tex.image else 'NONE'}")
        links.new(mapping.outputs['Vector'], diffuse_tex.inputs['Vector'])
        links.new(diffuse_tex.outputs['Color'], principled.inputs['Base Color'])
        print(f"DEBUG diffuse connected to Base Color: {principled.inputs['Base Color'].is_linked}")
    else:
        print(f"DEBUG diffuse_file is None!")
    
    # Normal map
    if normal_file:
        normal_tex = nodes.new('ShaderNodeTexImage')
        normal_tex.location = (-200, -100)
        normal_tex.image = bpy.data.images.load(str(normal_file))
        normal_tex.image.colorspace_settings.name = 'Non-Color'
        normal_tex.extension = 'EXTEND'  # Prevent tiling
        
        normal_map = nodes.new('ShaderNodeNormalMap')
        normal_map.location = (100, -100)
        normal_map.inputs['Strength'].default_value = 1.0
        
        links.new(mapping.outputs['Vector'], normal_tex.inputs['Vector'])
        links.new(normal_tex.outputs['Color'], normal_map.inputs['Color'])
        links.new(normal_map.outputs['Normal'], principled.inputs['Normal'])
    
    # Roughness
    if roughness_file:
        roughness_tex = nodes.new('ShaderNodeTexImage')
        roughness_tex.location = (-200, -400)
        roughness_tex.image = bpy.data.images.load(str(roughness_file))
        roughness_tex.image.colorspace_settings.name = 'Non-Color'
        roughness_tex.extension = 'EXTEND'  # Prevent tiling
        
        links.new(mapping.outputs['Vector'], roughness_tex.inputs['Vector'])
        links.new(roughness_tex.outputs['Color'], principled.inputs['Roughness'])
    else:
        # Default roughness for varnished wood
        principled.inputs['Roughness'].default_value = 0.3
    
    # Subsurface scattering
    principled.inputs['Subsurface Weight'].default_value = 0.05
    principled.inputs['Subsurface Radius'].default_value = (0.1, 0.05, 0.02)
    
    # Anisotropic reflection
    aniso_rotation_map = {'horizontal': 0.0, 'vertical': 0.25, 'radiant': 0.0, 'diamond': 0.125}
    principled.inputs['Anisotropic'].default_value = 0.3
    principled.inputs['Anisotropic Rotation'].default_value = aniso_rotation_map.get(grain_direction, 0.25)
    
    # Connect principled to output
    links.new(principled.outputs['BSDF'], output.inputs['Surface'])
    
    return mat


def find_texture_file(directory: Path, suffix: str) -> Path | None:
    """Find a texture file with given suffix in directory."""
    if not directory.exists():
        return None
    
    for f in directory.iterdir():
        if f.suffix == '.png' and suffix in f.name:
            return f
    
    return None


def create_backing_material(material_props: dict) -> bpy.types.Material:
    """Create backing material (acrylic, MDF, etc.)"""
    mat = bpy.data.materials.new(name='backing_material')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    
    nodes.clear()
    
    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (400, 0)
    
    principled = nodes.new('ShaderNodeBsdfPrincipled')
    principled.location = (0, 0)
    
    # Set properties from config
    color = material_props.get('color_rgb', [0, 0, 0])
    # Boost pure black slightly for visible reflections
    r = color[0] / 255 if color[0] > 1 else color[0]
    g = color[1] / 255 if color[1] > 1 else color[1]
    b = color[2] / 255 if color[2] > 1 else color[2]
    if r == 0 and g == 0 and b == 0:
        r = g = b = 0.02
    principled.inputs['Base Color'].default_value = (r, g, b, 1)
    
    pbr = material_props.get('pbr_properties', {})
    principled.inputs['Metallic'].default_value = pbr.get('metallic', 0)
    principled.inputs['Roughness'].default_value = pbr.get('roughness', 0.2)
    principled.inputs['Specular IOR Level'].default_value = 0.8  # Boost reflections
    
    # Clear coat for acrylic
    if pbr.get('clearcoat_intensity', 0) > 0:
        principled.inputs['Coat Weight'].default_value = pbr['clearcoat_intensity']
        principled.inputs['Coat Roughness'].default_value = pbr.get('clearcoat_roughness', 0.05)
    
    links.new(principled.outputs['BSDF'], output.inputs['Surface'])
    
    return mat


# ============================================
# SCENE SETUP
# ============================================

def setup_scene():
    """Initialize clean scene."""
    # Delete all objects
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    
    # Delete orphan data
    for mesh in bpy.data.meshes:
        bpy.data.meshes.remove(mesh)
    for mat in bpy.data.materials:
        bpy.data.materials.remove(mat)
    for img in bpy.data.images:
        bpy.data.images.remove(img)


def setup_hdri_lighting():
    """Setup HDRI environment lighting."""
    # Get or create world
    world = bpy.context.scene.world
    if world is None:
        world = bpy.data.worlds.new("World")
        bpy.context.scene.world = world
    
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    
    nodes.clear()
    
    # Environment texture
    env_tex = nodes.new('ShaderNodeTexEnvironment')
    env_tex.location = (-300, 0)
    
    if Config.HDRI_PATH.exists():
        env_tex.image = bpy.data.images.load(str(Config.HDRI_PATH))
    else:
        print(f"Warning: HDRI not found at {Config.HDRI_PATH}")
    
    # Background node
    background = nodes.new('ShaderNodeBackground')
    background.location = (0, 0)
    background.inputs['Strength'].default_value = 1.0  # standard ambient
    
    # Output
    output = nodes.new('ShaderNodeOutputWorld')
    output.location = (200, 0)
    
    links.new(env_tex.outputs['Color'], background.inputs['Color'])
    links.new(background.outputs['Background'], output.inputs['Surface'])

    # Add a "Gallery Spot" Area Light for reflections/specularity
    # Position: Front-Left-Up to rake across the grain
    bpy.ops.object.light_add(type='AREA', radius=2, location=(-2, -3, 2))
    light = bpy.context.active_object
    light.name = "Key_Light"
    light.data.energy = 200  # Watts
    
    # Point light at center (0,0,0)
    direction = Vector((0, 0, 0)) - light.location
    light.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def setup_camera(panel_config: dict, view: str = 'wall'):
    """
    Setup camera for specified view type.
    """
    # Panel dimensions
    radius = panel_config.get('outer_radius', panel_config['finish_x'] / 2)
    separation = panel_config['separation']
    thickness = panel_config['thickness']
    
    width_m = panel_config['finish_x'] * Config.SCALE_FACTOR
    height_m = panel_config['finish_y'] * Config.SCALE_FACTOR
    sep_m = separation * Config.SCALE_FACTOR
    thick_m = thickness * Config.SCALE_FACTOR
    radius_m = radius * Config.SCALE_FACTOR
    
    max_dimension = max(width_m + sep_m, height_m)
    
    # Create camera
    cam_data = bpy.data.cameras.new('Camera')
    cam_obj = bpy.data.objects.new('Camera', cam_data)
    bpy.context.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj
    
    if view == 'wall':
        # Front-facing Perspective (Matches Video Look)
        cam_data.type = 'PERSP'
        cam_data.lens = 50
        
        # Calculate Distance based on FOV (Same math as video)
        sensor_width = 36.0
        fov = 2 * math.atan(sensor_width / (2 * cam_data.lens))
        distance = (max_dimension / Config.FRAME_FILL) / (2 * math.tan(fov / 2))
        
        cam_obj.location = (0, -distance, 0)
        # Look at -Z (Panel Front) with Y up
        cam_obj.rotation_euler = (math.radians(90), 0, 0)
        
    elif view == 'orthogonal':
        # 3/4 top-down view (original render style)
        cam_data.type = 'PERSP'
        cam_data.lens = 50
        distance = max_dimension * (2.75 / Config.FRAME_FILL)
        cam_obj.location = (distance * 0.7, -distance * 0.7, distance * 0.5)
        # Point at center
        direction = Vector((0, 0, 0)) - cam_obj.location
        rot_quat = direction.to_track_quat('-Z', 'Y')
        cam_obj.rotation_euler = rot_quat.to_euler()
        
    elif view == 'close':
        # Close-up of gap between panels, showing slot detail
        cam_data.type = 'PERSP'
        cam_data.lens = 50
        # Scale distance based on FRAME_FILL for visual consistency
        base_distance = 0.4
        adjusted_distance = base_distance * (0.75 / Config.FRAME_FILL)
        cam_obj.location = (0.15, -adjusted_distance, thick_m + 0.1)
        cam_obj.rotation_euler = (math.radians(75), 0, math.radians(15))
        
    elif view == 'back':
        # Back view to verify backing inset
        cam_data.type = 'ORTHO'
        cam_data.ortho_scale = max_dimension / Config.FRAME_FILL
        # Look at -Y (Panel Back) from +Y
        cam_obj.location = (0, 2.0, 0)
        cam_obj.rotation_euler = (math.radians(90), 0, math.radians(180))
        
        # Hide wall for back view to prevent occlusion
        wall = bpy.data.objects.get("Environment_Wall")
        if wall:
            wall.hide_render = True
            wall.hide_viewport = True
        
        # Move backing to front of panel for back view visibility
        panel_thick = panel_config['thickness'] * Config.SCALE_FACTOR
        for obj in bpy.data.objects:
            if obj.name.startswith('backing_'):
                obj.location.y = panel_thick + 0.002
    
    cam_data.dof.use_dof = False
    
    return cam_obj
    
    
def setup_animated_camera(panel_config: dict, frames: int = 90, is_turntable: bool = False, view_mode: str = 'wall'):
    """
    Setup camera orbiting a wall-mounted panel. 
    Modes: Gallery Walk (Video) OR 360 Turntable.
    Simulates a person walking by and scanning the artwork from edge to edge.
    """
    # Create Camera
    cam_data = bpy.data.cameras.new('Camera')
    cam_obj = bpy.data.objects.new('Camera', cam_data)
    bpy.context.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj
    cam_data.type = 'PERSP'
    cam_data.lens = 50  # 50mm restores depth perception
    cam_data.dof.use_dof = False # Explicitly disable DOF to prevent blur
    
    # Calculate dimensions
    radius_m = panel_config.get('outer_radius', panel_config['finish_x'] / 2) * Config.SCALE_FACTOR
    panel_diameter = radius_m * 2
    panel_width_m = panel_config['finish_x'] * Config.SCALE_FACTOR
    
    if view_mode == 'close':
        # Macro view overrides global framing to focus on details
        distance = 0.4 
    else:
        # Calculate Distance based on Field of View (FOV)
        # Formula: Distance = (ObjectSize / FrameFill) / (2 * tan(FOV/2))
        sensor_width = 36.0 # Blender default sensor width (mm)
        fov = 2 * math.atan(sensor_width / (2 * cam_data.lens))
        
        # Exact distance to fit object within FRAME_FILL
        distance = (panel_diameter / Config.FRAME_FILL) / (2 * math.tan(fov / 2))
        
        # Add 5% safety buffer for perspective distortion during rotation (corners come closer)
        distance *= 1.05
    
    # 1. Create the Focus Target (The point the camera looks at)
    focus_target = bpy.data.objects.new('FocusTarget', None)
    bpy.context.collection.objects.link(focus_target)
    
    # 2. Create the Camera Pivot (The invisible person walking)
    pivot = bpy.data.objects.new('CameraPivot', None)
    bpy.context.collection.objects.link(pivot)
    pivot.location = (0, 0, 0)
    
    # Parent Camera to Pivot
    cam_obj.parent = pivot
    # Place camera "Front" relative to pivot (-Y direction is front in Blender)
    cam_obj.location = (0, -distance, 0)
    
    # 3. Add TrackTo Constraint
    # This forces the camera to look at the FocusTarget, overriding manual rotation
    track = cam_obj.constraints.new(type='TRACK_TO')
    track.target = focus_target
    track.track_axis = 'TRACK_NEGATIVE_Z' # Camera -Z points to target
    track.up_axis = 'UP_Y'                # Camera Y is up
    
    # Animation Settings
    scene = bpy.context.scene
    scene.frame_start = 1
    # Turntable needs exact frame count; Gallery adds buffer
    scene.frame_end = frames if is_turntable else (frames + 15)

    
    # --- ANIMATION KEYFRAMES ---
    
    if is_turntable:
        # 1. 360 Turntable Logic (0 to 360 constant spin)
        pivot.rotation_euler = (0, 0, 0)
        pivot.keyframe_insert(data_path='rotation_euler', frame=1)
        pivot.rotation_euler = (0, 0, math.radians(360))
        pivot.keyframe_insert(data_path='rotation_euler', frame=frames + 1)
        
        # Focus stays dead center
        focus_target.location = (0, 0, 0)
        
        # Linear Interpolation (Constant Speed)
        interp = 'LINEAR'
        easing = 'AUTO'
    else:
        # 2. Gallery Walk Logic (Ping-Pong Loop)
        mid_frame = (frames + 15) // 2
        
        # Pivot: Left (-35) -> Right (+35) -> Left (-35)
        # Tighter angle maintains composure and keeps edges visible
        pivot.rotation_euler = (0, 0, math.radians(-35))
        pivot.keyframe_insert(data_path='rotation_euler', frame=1)
        pivot.rotation_euler = (0, 0, math.radians(35))
        pivot.keyframe_insert(data_path='rotation_euler', frame=mid_frame)
        pivot.rotation_euler = (0, 0, math.radians(-35))
        pivot.keyframe_insert(data_path='rotation_euler', frame=frames + 15)

        # Focus: Scan 25% width (Left -> Right -> Left)
        # Reduced from 50% to ensure camera doesn't pan past the object edges
        focus_target.location = (-panel_width_m * 0.25, 0, 0)
        focus_target.keyframe_insert(data_path='location', frame=1)
        focus_target.location = (panel_width_m * 0.25, 0, 0)
        focus_target.keyframe_insert(data_path='location', frame=mid_frame)
        focus_target.location = (-panel_width_m * 0.25, 0, 0)
        focus_target.keyframe_insert(data_path='location', frame=frames + 15)
        
        interp = 'BEZIER'
        easing = 'EASE_IN_OUT'

    # Apply Interpolation settings
    for obj in [pivot, focus_target]:
        if obj.animation_data and obj.animation_data.action:
            for fc in obj.animation_data.action.fcurves:
                for kp in fc.keyframe_points:
                    kp.interpolation = interp
                    kp.easing = easing
    
    # Loop-safe settings
    scene.use_preview_range = True
    scene.frame_preview_start = 1
    scene.frame_preview_end = frames

    return cam_obj

def setup_video_render_settings(output_path: Path):
    """Configure render settings for video output."""
    scene = bpy.context.scene
    
    # Use Cycles
    scene.render.engine = 'CYCLES'
    
    # GPU rendering (Optimized for RTX)
    cycles_prefs = bpy.context.preferences.addons['cycles'].preferences
    cycles_prefs.compute_device_type = 'OPTIX' # Use OPTIX for RTX cards
    cycles_prefs.get_devices()
    
    # Enable GPU, Disable CPU
    for device in cycles_prefs.devices:
        if device.type == 'OPTIX':
            device.use = True
        else:
            device.use = False
            
    scene.cycles.device = 'GPU'
    
    # Lower samples for video (motion hides noise)
    scene.cycles.samples = Config.RENDER_SAMPLES
    scene.cycles.use_denoising = Config.USE_DENOISER
    scene.cycles.denoiser = 'OPTIX'
    
    # HD resolution for web
    # Use Config dimensions (2048x2048) for 1:1 aspect ratio
    scene.render.resolution_x = Config.RENDER_WIDTH
    scene.render.resolution_y = Config.RENDER_HEIGHT
    scene.render.resolution_percentage = 100
    
    # Video output settings
    scene.render.image_settings.file_format = 'FFMPEG'
    scene.render.ffmpeg.format = 'MPEG4'
    scene.render.ffmpeg.codec = 'H264'
    scene.render.ffmpeg.constant_rate_factor = 'HIGH'
    scene.render.ffmpeg.ffmpeg_preset = 'GOOD'
    scene.render.fps = 30
    
    # Output path
    scene.render.filepath = str(output_path)    
    

def setup_render_settings():
    """Configure Cycles render settings."""
    scene = bpy.context.scene
    
    # Set Color Management to High Contrast for "Pop"
    # Blender 4.x (AgX) uses specific AgX look names
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = -0.1 # neutral

    # Use Cycles
    scene.render.engine = 'CYCLES'
    
    # GPU rendering (Optimized for RTX)
    cycles_prefs = bpy.context.preferences.addons['cycles'].preferences
    cycles_prefs.compute_device_type = 'OPTIX' # Use OPTIX for RTX cards
    cycles_prefs.get_devices()
    
    # Enable GPU, Disable CPU
    for device in cycles_prefs.devices:
        if device.type == 'OPTIX':
            device.use = True
        else:
            device.use = False
    
    scene.cycles.device = 'GPU'
    
    # Quality settings
    scene.cycles.samples = Config.RENDER_SAMPLES
    scene.cycles.use_denoising = Config.USE_DENOISER
    scene.cycles.denoiser = 'OPTIX'  # Use OptiX denoiser for RTX
    
    # Resolution
    scene.render.resolution_x = Config.RENDER_WIDTH
    scene.render.resolution_y = Config.RENDER_HEIGHT
    scene.render.resolution_percentage = 100
    
    # Output format
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '16'
    
    # Transparent background
    scene.render.film_transparent = True


def create_circular_section_mesh(name: str, radius: float, thickness: float,
                                  center_x: float, is_right: bool) -> bpy.types.Object:
    """
    Create a semicircle section mesh.
    """
    # Create using cylinder and boolean cut
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius,
        depth=thickness,
        vertices=128,
        location=(0, 0, thickness / 2)
    )
    cylinder = bpy.context.active_object
    cylinder.name = name
    
    # Create cutting box for semicircle
    bpy.ops.mesh.primitive_cube_add(
        size=radius * 3,
        location=(radius * 1.5 if not is_right else -radius * 1.5, 0, thickness / 2)
    )
    cutter = bpy.context.active_object
    
    # Boolean difference
    bool_mod = cylinder.modifiers.new(name='cut_half', type='BOOLEAN')
    bool_mod.operation = 'DIFFERENCE'
    bool_mod.object = cutter
    bool_mod.solver = 'EXACT'
    
    bpy.context.view_layer.objects.active = cylinder
    bpy.ops.object.modifier_apply(modifier=bool_mod.name)
    
    # Delete cutter
    bpy.data.objects.remove(cutter, do_unlink=True)
    
    # Position section
    cylinder.location.x = center_x
    
    return cylinder


def create_backing_meshes(backing_params: dict, panel_config: dict) -> list:
    """
    Create backing panel meshes - one for each section.
    Backings are inset from the ENTIRE perimeter of each semicircle:
    - Arc edge: reduced radius
    - Flat edge: cut plane offset inward
    
    Geometry approach:
    1. Create circle with radius (R - inset) for arc inset
    2. Cut with plane at x = Â±inset (not x=0) for flat edge inset
    3. Position center at wood_offset (same as wood section)
    """
    sections_config = backing_params.get('sections', [])
    if not sections_config:
        print("DEBUG: No sections_config found")
        return []
    
    backing_meshes = []
    backing_thickness = sections_config[0].get('thickness', 0.125) * Config.SCALE_FACTOR
    inset = sections_config[0].get('inset', 0.5) * Config.SCALE_FACTOR
    
    # Panel parameters (in meters)
    radius = panel_config['outer_radius'] * Config.SCALE_FACTOR
    panel_thickness = panel_config['thickness'] * Config.SCALE_FACTOR
    separation = panel_config['separation'] * Config.SCALE_FACTOR
    num_sections = panel_config['number_sections']
    
    # Backing radius: inset from arc
    backing_radius = radius - inset
    
    # Z position: attached to back of panel (Z=0). Negative Z becomes +Y after rotation.
    z_pos = -backing_thickness / 2 - 0.0000254
    
    print(f"DEBUG: Creating backing - wood_radius={radius/Config.SCALE_FACTOR:.2f}in, backing_radius={backing_radius/Config.SCALE_FACTOR:.2f}in")
    print(f"DEBUG: inset={inset/Config.SCALE_FACTOR:.2f}in, separation={separation/Config.SCALE_FACTOR:.2f}in")
    
    if num_sections == 2:
        # Wood sections are offset by separation/2 from origin
        wood_offset = separation / 2
        
        for idx in range(2):
            is_right = (idx == 0)
            
            # Create circle with reduced radius (arc inset)
            bpy.ops.mesh.primitive_cylinder_add(
                radius=backing_radius,
                depth=backing_thickness,
                vertices=64,
                location=(0, 0, z_pos)
            )
            backing = bpy.context.active_object
            backing.name = f'backing_{idx}'
            
            # Cut to semicircle with OFFSET cut plane for flat edge inset
            # Cutter edge at x = Â±inset instead of x = 0
            cutter_size = backing_radius * 4
            
            if is_right:
                # Keep x > inset portion (right side)
                # Cutter occupies x < inset, so cutter center at x = inset - cutter_size/2
                cutter_x = inset - cutter_size / 2
            else:
                # Keep x < -inset portion (left side)
                # Cutter occupies x > -inset, so cutter center at x = -inset + cutter_size/2
                cutter_x = -inset + cutter_size / 2
            
            bpy.ops.mesh.primitive_cube_add(
                size=cutter_size,
                location=(cutter_x, 0, z_pos)
            )
            cutter = bpy.context.active_object
            
            bool_mod = backing.modifiers.new(name='cut_half', type='BOOLEAN')
            bool_mod.operation = 'DIFFERENCE'
            bool_mod.object = cutter
            bool_mod.solver = 'EXACT'
            
            bpy.context.view_layer.objects.active = backing
            bpy.ops.object.modifier_apply(modifier=bool_mod.name)
            bpy.data.objects.remove(cutter, do_unlink=True)
            
            # Position backing center at same offset as wood section
            # The inset is already built into the geometry:
            # - Arc is at (backing_radius) from center = (radius - inset) from center
            # - Flat edge is at x = Â±inset in local coords
            if is_right:
                backing.location.x = wood_offset
            else:
                backing.location.x = -wood_offset
            
            # Verify geometry bounds
            arc_world = wood_offset + backing_radius if is_right else -wood_offset - backing_radius
            flat_world = wood_offset + inset if is_right else -wood_offset - inset
            wood_arc = wood_offset + radius if is_right else -wood_offset - radius
            wood_flat = wood_offset if is_right else -wood_offset
            
            print(f"DEBUG: Backing {idx} ({'right' if is_right else 'left'}):")
            print(f"  Wood: arc={wood_arc/Config.SCALE_FACTOR:.2f}in, flat={wood_flat/Config.SCALE_FACTOR:.2f}in")
            print(f"  Back: arc={arc_world/Config.SCALE_FACTOR:.2f}in, flat={flat_world/Config.SCALE_FACTOR:.2f}in")
            print(f"  Insets: arc={abs(wood_arc-arc_world)/Config.SCALE_FACTOR:.2f}in, flat={abs(wood_flat-flat_world)/Config.SCALE_FACTOR:.2f}in")
            
            backing_meshes.append(backing)
    
    else:
        # Full circle backing for n=1
        bpy.ops.mesh.primitive_cylinder_add(
            radius=backing_radius,
            depth=backing_thickness,
            vertices=64,
            location=(0, 0, z_pos)
        )
        backing = bpy.context.active_object
        backing.name = 'backing_0'
        backing_meshes.append(backing)
    
    for b in backing_meshes:
        print(f"DEBUG: {b.name} loc=({b.location.x/Config.SCALE_FACTOR:.2f}, {b.location.y/Config.SCALE_FACTOR:.2f}, {b.location.z/Config.SCALE_FACTOR:.2f})in")
    print(f"DEBUG: Created {len(backing_meshes)} backing meshes")
    return backing_meshes
    
    
def create_rectangular_backing(backing_params: dict, panel_config: dict) -> list:
    """Create backing panels for rectangular shape."""
    sections_config = backing_params.get('sections', [])
    if not sections_config:
        return []
    
    backing_meshes = []
    backing_thickness = sections_config[0].get('thickness', 0.125) * Config.SCALE_FACTOR
    inset = sections_config[0].get('inset', 0.5) * Config.SCALE_FACTOR
    
    num_sections = panel_config['number_sections']
    width = panel_config['finish_x'] * Config.SCALE_FACTOR
    height = panel_config['finish_y'] * Config.SCALE_FACTOR
    separation = panel_config.get('separation', 0) * Config.SCALE_FACTOR
    
    z_pos = -backing_thickness / 2 - 0.0000254
    
    if num_sections == 1:
        bpy.ops.mesh.primitive_cube_add(
            size=1,
            location=(0, 0, z_pos)
        )
        backing = bpy.context.active_object
        backing.name = 'backing_0'
        backing.scale = (width - 2*inset, height - 2*inset, backing_thickness)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        backing_meshes.append(backing)
        
    elif num_sections == 2:
        section_width = (width - separation) / 2 - inset
        for idx in range(2):
            offset_x = (width/4 + separation/4) if idx == 0 else -(width/4 + separation/4)
            bpy.ops.mesh.primitive_cube_add(
                size=1,
                location=(offset_x, 0, z_pos)
            )
            backing = bpy.context.active_object
            backing.name = f'backing_{idx}'
            backing.scale = (section_width, height - 2*inset, backing_thickness)
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            backing_meshes.append(backing)
            
    elif num_sections == 4:
        section_width = (width - separation) / 2 - inset
        section_height = (height - separation) / 2 - inset
        positions = [
            (width/4 + separation/4, height/4 + separation/4),   # TR
            (width/4 + separation/4, -height/4 - separation/4),  # BR
            (-width/4 - separation/4, -height/4 - separation/4), # BL
            (-width/4 - separation/4, height/4 + separation/4),  # TL
        ]
        for idx, (px, py) in enumerate(positions):
            bpy.ops.mesh.primitive_cube_add(
                size=1,
                location=(px, py, z_pos)
            )
            backing = bpy.context.active_object
            backing.name = f'backing_{idx}'
            backing.scale = (section_width, section_height, backing_thickness)
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            backing_meshes.append(backing)
    
    return backing_meshes


def create_diamond_backing(backing_params: dict, panel_config: dict) -> list:
    """Create backing panels for diamond shape (4 triangular sections)."""
    sections_config = backing_params.get('sections', [])
    if not sections_config:
        return []
    
    backing_meshes = []
    backing_thickness = sections_config[0].get('thickness', 0.125) * Config.SCALE_FACTOR
    inset = sections_config[0].get('inset', 0.5) * Config.SCALE_FACTOR
    
    half_width = (panel_config['finish_x'] / 2) * Config.SCALE_FACTOR
    half_height = (panel_config['finish_y'] / 2) * Config.SCALE_FACTOR
    separation = panel_config.get('separation', 0) * Config.SCALE_FACTOR
    
    z_pos = -backing_thickness / 2 - 0.0000254
    
    # Backing dimensions: inset from outer diagonal edges
    backing_half_width = half_width - inset
    backing_half_height = half_height - inset
    
    # Gap increased by inset on each side
    half_gap_x = separation / 2 + inset
    half_gap_y = separation / 2 + inset
    
    for quadrant in range(4):
        mesh = bpy.data.meshes.new(f'backing_{quadrant}_mesh')
        obj = bpy.data.objects.new(f'backing_{quadrant}', mesh)
        bpy.context.collection.objects.link(obj)
        
        bm = bmesh.new()
        
        # Calculate intersection points where gap lines meet diagonal edges
        if quadrant == 0:  # Top-Right
            v0 = (half_gap_x, half_gap_y, z_pos)
            v1 = (backing_half_width * (1 - half_gap_y / backing_half_height), half_gap_y, z_pos)
            v2 = (half_gap_x, backing_half_height * (1 - half_gap_x / backing_half_width), z_pos)
        elif quadrant == 1:  # Bottom-Right
            v0 = (half_gap_x, -half_gap_y, z_pos)
            v1 = (half_gap_x, -backing_half_height * (1 - half_gap_x / backing_half_width), z_pos)
            v2 = (backing_half_width * (1 - half_gap_y / backing_half_height), -half_gap_y, z_pos)
        elif quadrant == 2:  # Bottom-Left
            v0 = (-half_gap_x, -half_gap_y, z_pos)
            v1 = (-backing_half_width * (1 - half_gap_y / backing_half_height), -half_gap_y, z_pos)
            v2 = (-half_gap_x, -backing_half_height * (1 - half_gap_x / backing_half_width), z_pos)
        else:  # Top-Left
            v0 = (-half_gap_x, half_gap_y, z_pos)
            v1 = (-half_gap_x, backing_half_height * (1 - half_gap_x / backing_half_width), z_pos)
            v2 = (-backing_half_width * (1 - half_gap_y / backing_half_height), half_gap_y, z_pos)
        
        # Bottom and top vertices
        bv0 = bm.verts.new(v0)
        bv1 = bm.verts.new(v1)
        bv2 = bm.verts.new(v2)
        tv0 = bm.verts.new((v0[0], v0[1], v0[2] - backing_thickness))
        tv1 = bm.verts.new((v1[0], v1[1], v1[2] - backing_thickness))
        tv2 = bm.verts.new((v2[0], v2[1], v2[2] - backing_thickness))
        
        bm.verts.ensure_lookup_table()
        
        bm.faces.new([bv0, bv1, bv2])
        bm.faces.new([tv0, tv2, tv1])
        bm.faces.new([bv0, bv1, tv1, tv0])
        bm.faces.new([bv1, bv2, tv2, tv1])
        bm.faces.new([bv2, bv0, tv0, tv2])
        
        bm.to_mesh(mesh)
        bm.free()
        
        backing_meshes.append(obj)
    
    return backing_meshes


def build_rectangular_panel(json_data: dict) -> list:
    """Build rectangular panel with 1, 2, or 4 sections."""
    csg_data = json_data['csg_data']
    panel_config = csg_data['panel_config']
    slot_data = csg_data.get('slot_data', [])
    slots_per_section = csg_data.get('slotsInSection', len(slot_data))
    
    state = json_data.get('updated_state', {})
    frame_design = state.get('frame_design', {})
    section_materials = frame_design.get('section_materials', [])
    
    num_sections = panel_config['number_sections']
    width = panel_config['finish_x'] * Config.SCALE_FACTOR
    height = panel_config['finish_y'] * Config.SCALE_FACTOR
    thickness = panel_config['thickness'] * Config.SCALE_FACTOR
    separation = panel_config.get('separation', 0) * Config.SCALE_FACTOR
    
    center_x = panel_config['finish_x'] / 2
    center_y = panel_config['finish_y'] / 2
    
    print(f"Building RECTANGULAR panel: {num_sections} sections")
    
    sections = []
    
    if num_sections == 1:
        section = create_rectangular_section_mesh(
            "section_0", width, height, thickness, 0, 0
        )
        section_slots = slot_data
        section = cut_slots_with_center(section, section_slots, center_x, center_y, 
                                        panel_config['thickness'])
        
        species = section_materials[0].get('species', 'maple') if section_materials else 'maple'
        grain = section_materials[0].get('grain_direction', 'vertical') if section_materials else 'vertical'
        mat = create_wood_material(species, f"wood_{species}_0", grain)
        section.data.materials.append(mat)
        sections.append(section)
        
    elif num_sections == 2:
        section_width = (width - separation) / 2
        positions = [
            (section_width/2 + separation/2, 0),   # Right
            (-(section_width/2 + separation/2), 0) # Left
        ]
        section_centers = csg_data.get('section_local_centers', [
            [center_x + separation/2, center_y],
            [center_x - separation/2, center_y]
        ])
        
        for idx in range(2):
            section = create_rectangular_section_mesh(
                f"section_{idx}", section_width, height, thickness,
                positions[idx][0], positions[idx][1]
            )
            
            start_slot = idx * slots_per_section
            end_slot = start_slot + slots_per_section
            section_slots = slot_data[start_slot:end_slot]
            
            sc = section_centers[idx]
            section = cut_slots_with_center(section, section_slots, sc[0], sc[1],
                                            panel_config['thickness'])
            
            species = section_materials[idx].get('species', 'maple') if idx < len(section_materials) else 'maple'
            grain = section_materials[idx].get('grain_direction', 'vertical') if idx < len(section_materials) else 'vertical'
            mat = create_wood_material(species, f"wood_{species}_{idx}", grain)
            section.data.materials.append(mat)
            sections.append(section)
            
    elif num_sections == 4:
        section_width = (width - separation) / 2
        section_height = (height - separation) / 2
        # Clockwise from top-right: TR, BR, BL, TL
        positions = [
            (section_width/2 + separation/2, section_height/2 + separation/2),   # TR
            (section_width/2 + separation/2, -(section_height/2 + separation/2)), # BR
            (-(section_width/2 + separation/2), -(section_height/2 + separation/2)), # BL
            (-(section_width/2 + separation/2), section_height/2 + separation/2), # TL
        ]
        section_centers = csg_data.get('section_local_centers')
        
        for idx in range(4):
            section = create_rectangular_section_mesh(
                f"section_{idx}", section_width, section_height, thickness,
                positions[idx][0], positions[idx][1]
            )
            
            start_slot = idx * slots_per_section
            end_slot = start_slot + slots_per_section
            section_slots = slot_data[start_slot:end_slot]
            
            sc = section_centers[idx]
            section = cut_slots_with_center(section, section_slots, sc[0], sc[1],
                                            panel_config['thickness'])
            
            species = section_materials[idx].get('species', 'maple') if idx < len(section_materials) else 'maple'
            grain = section_materials[idx].get('grain_direction', 'vertical') if idx < len(section_materials) else 'vertical'
            mat = create_wood_material(species, f"wood_{species}_{idx}", grain)
            section.data.materials.append(mat)
            sections.append(section)
    
    # Backing
    backing_params = json_data.get('backing_parameters', {})
    if backing_params.get('enabled', False):
        backing_meshes = create_rectangular_backing(backing_params, panel_config)
        mat_props = backing_params.get('material_properties', {})
        backing_mat = create_backing_material(mat_props)
        for backing in backing_meshes:
            backing.data.materials.append(backing_mat)
            sections.append(backing)
    
    # Rotate to wall orientation (no transform apply)
    print("Rotating panel to wall orientation (Vertical)...")
    for obj in sections:
        obj.rotation_euler = (math.radians(90), 0, 0)
    
    create_environment_wall(panel_config)
    return sections


def build_diamond_panel(json_data: dict) -> list:
    """Build diamond panel with 4 triangular sections."""
    csg_data = json_data['csg_data']
    panel_config = csg_data['panel_config']
    slot_data = csg_data.get('slot_data', [])
    slots_per_section = csg_data.get('slotsInSection', len(slot_data) // 4)
    
    state = json_data.get('updated_state', {})
    frame_design = state.get('frame_design', {})
    section_materials = frame_design.get('section_materials', [])
    
    half_width = (panel_config['finish_x'] / 2) * Config.SCALE_FACTOR
    half_height = (panel_config['finish_y'] / 2) * Config.SCALE_FACTOR
    thickness = panel_config['thickness'] * Config.SCALE_FACTOR
    separation = panel_config.get('separation', 0) * Config.SCALE_FACTOR
    
    section_centers = csg_data.get('section_local_centers')
    print(f"DEBUG: section_local_centers = {section_centers}")
    print(f"DEBUG: original_center = ({csg_data.get('original_center_x')}, {csg_data.get('original_center_y')})")
    
    print(f"Building DIAMOND panel: 4 sections, {len(slot_data)} total slots")
    
    sections = []
    
    for idx in range(4):
        section = create_diamond_section_mesh(
            f"section_{idx}",
            half_width, half_height, thickness,
            quadrant=idx,
            gap_x=separation, gap_y=separation
        )
        
        start_slot = idx * slots_per_section
        end_slot = start_slot + slots_per_section
        section_slots = slot_data[start_slot:end_slot]
        
        # Use original_center for slot transformation (mesh is world-centered)
        original_cx = csg_data.get('original_center_x')
        original_cy = csg_data.get('original_center_y')
        section = cut_slots_with_center(section, section_slots, original_cx, original_cy,
                                        panel_config['thickness'])
        
        species = section_materials[idx].get('species', 'maple') if idx < len(section_materials) else 'maple'
        grain = section_materials[idx].get('grain_direction', 'vertical') if idx < len(section_materials) else 'vertical'
        mat = create_wood_material(species, f"wood_{species}_{idx}", grain, idx, 'diamond',
                                   panel_config['finish_x'], panel_config['finish_y'])
        section.data.materials.append(mat)
        sections.append(section)
    
    # Backing
    backing_params = json_data.get('backing_parameters', {})
    if backing_params.get('enabled', False):
        backing_meshes = create_diamond_backing(backing_params, panel_config)
        mat_props = backing_params.get('material_properties', {})
        backing_mat = create_backing_material(mat_props)
        for backing in backing_meshes:
            backing.data.materials.append(backing_mat)
            sections.append(backing)
    
    # Rotate to wall orientation (no transform apply)
    print("Rotating panel to wall orientation (Vertical)...")
    for obj in sections:
        obj.rotation_euler = (math.radians(90), 0, 0)
    
    create_environment_wall(panel_config)
    return sections    


def build_asymmetric_panel(json_data: dict) -> list:
    """
    Build asymmetric circular panel with different sized halves.
    
    Layout determined by large_position in asymmetric_config:
    - "left": Large on left, Small on right (default)
    - "right": Large on right, Small on left
    """
    csg_data = json_data['csg_data']
    panel_config = csg_data['panel_config']
    asymmetric_config = csg_data.get('asymmetric_config', {})
    
    gap = asymmetric_config.get('gap', 3.5)
    large_finish_x = asymmetric_config.get('large_finish_x', 42.0)
    small_finish_x = asymmetric_config.get('small_finish_x', 35.0)
    large_slots = asymmetric_config.get('large_slots', [])
    small_slots = asymmetric_config.get('small_slots', [])
    large_position = asymmetric_config.get('large_position', 'left')
    
    large_radius = large_finish_x / 2  # 21"
    small_radius = small_finish_x / 2  # 17.5"
    thickness = panel_config['thickness']
    
    # Get materials
    state = json_data.get('updated_state', {})
    frame_design = state.get('frame_design', {})
    section_materials = frame_design.get('section_materials', [])
    
    print(f"Building ASYMMETRIC panel:")
    print(f"  Large: {large_finish_x}\" (radius {large_radius}\"), {len(large_slots)} slots")
    print(f"  Small: {small_finish_x}\" (radius {small_radius}\"), {len(small_slots)} slots")
    print(f"  Gap: {gap}\"")
    print(f"  Large position: {large_position}")
    
    sections = []
    
    # Position calculations based on large_position
    # Flat edges face the gap, arcs extend outward
    if large_position == 'left':
        large_offset = -(gap / 2) * Config.SCALE_FACTOR
        small_offset = (gap / 2) * Config.SCALE_FACTOR
        large_is_right = False
        small_is_right = True
    else:  # large_position == 'right'
        large_offset = (gap / 2) * Config.SCALE_FACTOR
        small_offset = -(gap / 2) * Config.SCALE_FACTOR
        large_is_right = True
        small_is_right = False
    
    # === LARGE SECTION (index 0) ===
    large_section = create_circular_section_mesh(
        "section_0",
        large_radius * Config.SCALE_FACTOR,
        thickness * Config.SCALE_FACTOR,
        large_offset,
        is_right=large_is_right
    )
    
    # Filter and cut large slots based on position
    large_center = large_finish_x / 2  # 21
    if large_is_right:
        # Large on right: use right half (x > center)
        filtered_large_slots = [s for s in large_slots if s['x'] > large_center]
        large_center_offset = large_center - (gap / 2)
    else:
        # Large on left: use left half (x < center)
        filtered_large_slots = [s for s in large_slots if s['x'] < large_center]
        large_center_offset = large_center + (gap / 2)
    print(f"Large section: {len(filtered_large_slots)} slots ({'right' if large_is_right else 'left'} half)")
    
    large_section = cut_slots_with_center(
        large_section, filtered_large_slots, 
        large_center_offset, large_center, thickness
    )
    
    # Apply material - use position-based index (0=right, 1=left)
    large_mat_idx = 0 if large_is_right else 1
    species = section_materials[large_mat_idx].get('species', 'maple') if len(section_materials) > large_mat_idx else 'maple'
    grain = section_materials[large_mat_idx].get('grain_direction', 'vertical') if len(section_materials) > large_mat_idx else 'vertical'
    mat = create_wood_material(species, f"wood_{species}_large", grain)
    large_section.data.materials.append(mat)
    sections.append(large_section)
    
    # === SMALL SECTION ===
    small_section = create_circular_section_mesh(
        "section_1",
        small_radius * Config.SCALE_FACTOR,
        thickness * Config.SCALE_FACTOR,
        small_offset,
        is_right=small_is_right
    )
    
    # Filter and cut small slots based on position
    small_center = small_finish_x / 2  # 17.5
    if small_is_right:
        # Small on right: use right half (x > center)
        filtered_small_slots = [s for s in small_slots if s['x'] > small_center]
        small_center_offset = small_center - (gap / 2)
    else:
        # Small on left: use left half (x < center)
        filtered_small_slots = [s for s in small_slots if s['x'] < small_center]
        small_center_offset = small_center + (gap / 2)
    print(f"Small section: {len(filtered_small_slots)} slots ({'right' if small_is_right else 'left'} half)")
    
    small_section = cut_slots_with_center(
        small_section, filtered_small_slots,
        small_center_offset, small_center, thickness
    )
    
    # Apply material - use position-based index (0=right, 1=left)
    small_mat_idx = 0 if small_is_right else 1
    species = section_materials[small_mat_idx].get('species', 'maple') if len(section_materials) > small_mat_idx else 'maple'
    grain = section_materials[small_mat_idx].get('grain_direction', 'vertical') if len(section_materials) > small_mat_idx else 'vertical'
    mat = create_wood_material(species, f"wood_{species}_small", grain)
    small_section.data.materials.append(mat)
    sections.append(small_section)
    
    # === BACKING ===
    backing_params = json_data.get('backing_parameters', {})
    if backing_params.get('enabled', False):
        backing_meshes = create_asymmetric_backing(
            backing_params, large_radius, small_radius, gap, thickness, large_position
        )
        mat_props = backing_params.get('material_properties', {})
        backing_mat = create_backing_material(mat_props)
        
        for backing in backing_meshes:
            backing.data.materials.append(backing_mat)
            sections.append(backing)
    
    return sections


def create_asymmetric_backing(backing_params: dict, large_radius: float, 
                               small_radius: float, gap: float, 
                               panel_thickness: float, large_position: str = "left") -> list:
    """
    Create backing for asymmetric panel (different radius for each side).
    """
    sections_config = backing_params.get('sections', [])
    if not sections_config:
        return []
    
    backing_meshes = []
    backing_thickness = sections_config[0].get('thickness', 0.125) * Config.SCALE_FACTOR
    inset = sections_config[0].get('inset', 0.5) * Config.SCALE_FACTOR
    
    z_pos = -backing_thickness / 2 - 0.0000254
    
    # Determine positions based on large_position
    if large_position == 'left':
        large_offset = -(gap / 2) * Config.SCALE_FACTOR
        small_offset = (gap / 2) * Config.SCALE_FACTOR
        large_cutter_side = 'left'  # Keep left half
        small_cutter_side = 'right'  # Keep right half
    else:
        large_offset = (gap / 2) * Config.SCALE_FACTOR
        small_offset = -(gap / 2) * Config.SCALE_FACTOR
        large_cutter_side = 'right'  # Keep right half
        small_cutter_side = 'left'  # Keep left half
    
    # Large backing
    large_backing_radius = (large_radius * Config.SCALE_FACTOR) - inset
    
    bpy.ops.mesh.primitive_cylinder_add(
        radius=large_backing_radius,
        depth=backing_thickness,
        vertices=64,
        location=(0, 0, z_pos)
    )
    large_backing = bpy.context.active_object
    large_backing.name = 'backing_0'
    
    # Cut to semicircle
    cutter_size = large_backing_radius * 4
    if large_cutter_side == 'left':
        cutter_x = -inset + cutter_size / 2  # Keep x < -inset
    else:
        cutter_x = inset - cutter_size / 2  # Keep x > inset
    bpy.ops.mesh.primitive_cube_add(size=cutter_size, location=(cutter_x, 0, z_pos))
    cutter = bpy.context.active_object
    
    bool_mod = large_backing.modifiers.new(name='cut_half', type='BOOLEAN')
    bool_mod.operation = 'DIFFERENCE'
    bool_mod.object = cutter
    bool_mod.solver = 'EXACT'
    
    bpy.context.view_layer.objects.active = large_backing
    bpy.ops.object.modifier_apply(modifier=bool_mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    
    large_backing.location.x = large_offset
    backing_meshes.append(large_backing)
    
    # Small backing
    small_backing_radius = (small_radius * Config.SCALE_FACTOR) - inset
    
    bpy.ops.mesh.primitive_cylinder_add(
        radius=small_backing_radius,
        depth=backing_thickness,
        vertices=64,
        location=(0, 0, z_pos)
    )
    small_backing = bpy.context.active_object
    small_backing.name = 'backing_1'
    
    # Cut to semicircle based on position
    if small_cutter_side == 'right':
        cutter_x = inset - cutter_size / 2  # Keep x > inset
    else:
        cutter_x = -inset + cutter_size / 2  # Keep x < -inset
    bpy.ops.mesh.primitive_cube_add(size=cutter_size, location=(cutter_x, 0, z_pos))
    cutter = bpy.context.active_object
    
    bool_mod = small_backing.modifiers.new(name='cut_half', type='BOOLEAN')
    bool_mod.operation = 'DIFFERENCE'
    bool_mod.object = cutter
    bool_mod.solver = 'EXACT'
    
    bpy.context.view_layer.objects.active = small_backing
    bpy.ops.object.modifier_apply(modifier=bool_mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    
    small_backing.location.x = small_offset
    backing_meshes.append(small_backing)
    
    print(f"DEBUG: Asymmetric backing - large_r={large_backing_radius/Config.SCALE_FACTOR:.2f}in, small_r={small_backing_radius/Config.SCALE_FACTOR:.2f}in, large_pos={large_position}")
    return backing_meshes


# ============================================
# MAIN BUILDER
# ============================================

def build_panel_from_json(json_data: dict) -> list:
    """
    Build complete panel geometry from CSG JSON response.
    
    Returns list of section objects.
    """
    csg_data = json_data['csg_data']
    panel_config = csg_data['panel_config']
    slot_data = csg_data.get('slot_data', [])
    shape = panel_config.get('shape', 'circular')
    
    # Check for asymmetric panel
    slot_style = panel_config.get('slot_style', '')
    asymmetric_config = csg_data.get('asymmetric_config', {})
    
    if slot_style == 'asymmetric' or asymmetric_config.get('large_slots'):
        print("Detected ASYMMETRIC panel configuration")
        sections = build_asymmetric_panel(json_data)
        create_environment_wall(panel_config)
        return sections
    
    # Route by shape
    if shape == 'rectangular':
        return build_rectangular_panel(json_data)
    elif shape == 'diamond':
        return build_diamond_panel(json_data)
    
    # Get state for materials
    state = json_data.get('updated_state', {})
    frame_design = state.get('frame_design', {})
    section_materials = frame_design.get('section_materials', [])
    
    print(f"Building panel: {panel_config['shape']}, {panel_config['number_sections']} sections")
    print(f"Dimensions: {panel_config['finish_x']}\" x {panel_config['finish_y']}\" x {panel_config['thickness']}\"")
    print(f"Slots: {len(slot_data)}")
    
    sections = []
    
    if panel_config['shape'] == 'circular':
        if panel_config['number_sections'] == 2:
            # Create two semicircles
            radius = panel_config['outer_radius']
            thickness = panel_config['thickness']
            separation = panel_config['separation']
            
            # Calculate section positions
            # Sections are offset by half the separation plus half width
            offset = (separation / 2) * Config.SCALE_FACTOR
            
            for idx in range(2):
                section_x = offset if idx == 0 else -offset
                
                section = create_circular_section_mesh(
                    f"section_{idx}",
                    radius * Config.SCALE_FACTOR,
                    thickness * Config.SCALE_FACTOR,
                    section_x,
                    is_right=(idx == 0)
                )
                
                # Cut slots
                section = cut_slots_from_section(section, slot_data, panel_config, idx)
                
                # Apply material
                if idx < len(section_materials):
                    species = section_materials[idx].get('species', 'maple')
                else:
                    species = 'maple'
                
                grain_direction = 'vertical'
                if idx < len(section_materials):
                    grain_direction = section_materials[idx].get('grain_direction', 'vertical')
                
                mat = create_wood_material(species, f"wood_{species}_{idx}", grain_direction)
                section.data.materials.append(mat)
                
                sections.append(section)
    
    # Create backing if enabled
    backing_params = json_data.get('backing_parameters', {})
    if backing_params.get('enabled', False):
        backing_meshes = create_backing_meshes(backing_params, panel_config)
        mat_props = backing_params.get('material_properties', {})
        backing_mat = create_backing_material(mat_props)
        
        for backing in backing_meshes:
            backing.data.materials.append(backing_mat)
            sections.append(backing)
    
    # --- ROTATE PANEL TO WALL ORIENTATION ---
    # Rotate objects WITHOUT applying transforms (preserves Generated coordinate mapping)
    print("Rotating panel to wall orientation (Vertical)...")
    for obj in sections:
        obj.rotation_euler = (math.radians(90), 0, 0)
        
    # --- ADD WALL ---
    create_environment_wall(panel_config)
    
    return sections


# ============================================
# CLI INTERFACE
# ============================================

def parse_args():
    """Parse command line arguments after '--'"""
    args = {}
    
    if '--' in sys.argv:
        argv = sys.argv[sys.argv.index('--') + 1:]
    else:
        argv = []
    
    i = 0
    while i < len(argv):
        if argv[i] == '--config':
            args['config'] = argv[i + 1]
            i += 2
        elif argv[i] == '--output':
            args['output'] = argv[i + 1]
            i += 2
        elif argv[i] == '--samples':
            Config.RENDER_SAMPLES = int(argv[i + 1])
            i += 2
        elif argv[i] == '--width':
            Config.RENDER_WIDTH = int(argv[i + 1])
            i += 2
        elif argv[i] == '--height':
            Config.RENDER_HEIGHT = int(argv[i + 1])
            i += 2
        elif argv[i] == '--view':
            args['view'] = argv[i + 1]
            i += 2
        elif argv[i] in ('--wall', '--orthogonal', '--close', '--back', '--all'):
            args['view'] = argv[i].replace('--', '')
            i += 1
        elif argv[i] == '--video':
            args['video'] = True
            i += 1
        elif argv[i] == '--turntable':
            args['turntable'] = True
            i += 1
        elif argv[i] == '--1k':
            Config.RENDER_WIDTH = 1024
            Config.RENDER_HEIGHT = 1024
            i += 1
        elif argv[i] == '--2k':
            Config.RENDER_WIDTH = 2048
            Config.RENDER_HEIGHT = 2048
            i += 1
        elif argv[i] == '--draft':
            Config.RENDER_WIDTH = 256
            Config.RENDER_HEIGHT = 256
            i += 1    
        elif argv[i] == '--frames':
            args['frames'] = int(argv[i + 1])
            i += 2
        elif argv[i] == '--step':
            args['step'] = int(argv[i + 1])
            i += 2
        else:
            i += 1
    
    return args


def main():
    args = parse_args()
    config_path = args.get('config')
    output_path = args.get('output', str(Config.OUTPUT_DIR / 'render.png'))
    
    output_file = Path(output_path)
    if not output_file.is_absolute():
        output_file = Config.OUTPUT_DIR / output_file.name
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    if not config_path:
        print("Usage error: Missing config path")
        return
    
    with open(config_path, 'r') as f:
        json_data = json.load(f)
    
    print("=" * 60)
    print("WaveDesigner Blender Render (Optimized for RTX)")
    print("=" * 60)
    
    setup_scene()
    setup_hdri_lighting()
    setup_render_settings()
    
    # Build geometry
    sections = build_panel_from_json(json_data)
    print(f"Created {len(sections)} objects")
    
    # Setup camera based on panel size and view option
    panel_config = json_data['csg_data']['panel_config']
    view = args.get('view', 'wall')
    
    if view == 'all':
        views = ['wall', 'orthogonal', 'close']
    else:
        views = [view]
        
    # Handle animation (Video OR Turntable)
    # Auto-enable video if specific animation flags are present (even if --video is omitted)
    force_anim = args.get('video') or args.get('frames') or args.get('step')
    
    if force_anim or args.get('turntable'):
        is_turntable = args.get('turntable', False)
        frames = args.get('frames', 300)
        print(f"Rendering animation (Turntable={is_turntable}): {frames} frames")
        
        # If turntable, remove wall to see back
        if is_turntable:
            wall = bpy.data.objects.get("Environment_Wall")
            if wall: bpy.data.objects.remove(wall, do_unlink=True)
        
        # Apply Frame Step if requested (for fast previews)
        if args.get('step'):
            bpy.context.scene.frame_step = args['step']

        # Pass the 'view' arg (e.g. 'close') so we can render macro videos if requested
        setup_animated_camera(panel_config, frames, is_turntable, view_mode=args.get('view', 'wall'))
        
        # Only use MP4 settings for video; Turntable uses default PNG sequence
        if not is_turntable:
            video_output = output_file.parent / f"{output_file.stem}_video.mp4"
            setup_video_render_settings(video_output)
        else:
            # Turntable: Output PNG sequence to output dir
            # Blender automatically appends frame numbers (e.g. name0001.png)
            bpy.context.scene.render.filepath = str(output_file.parent / output_file.stem)
        
        print("-" * 30)
        print("Starting Video Render...")
        start_time = time.time()  # <--- Start Timer
        
        bpy.ops.render.render(animation=True)
        
        end_time = time.time()    # <--- End Timer
        elapsed = end_time - start_time
        minutes = int(elapsed // 60)
        seconds = int(elapsed % 60)
        
        print(f"Animation finished in: {minutes}m {seconds}s ({elapsed:.2f}s)")
        if not is_turntable:
            print(f"Saved to: {video_output}")
        print("=" * 60)
        return    
    
    # Handle Still Images
    for v in views:
        # Remove existing camera if re-rendering
        for obj in bpy.data.objects:
            if obj.type == 'CAMERA':
                bpy.data.objects.remove(obj, do_unlink=True)
        
        setup_camera(panel_config, v)
        
        # Generate output filename with view suffix
        if len(views) > 1:
            view_output = output_file.parent / f"{output_file.stem}_{v}{output_file.suffix}"
        else:
            view_output = output_file
        
        bpy.context.scene.render.filepath = str(view_output)
        
        print("-" * 30)
        print(f"Rendering View: {v}...")
        start_time = time.time()  # <--- Start Timer
        
        bpy.ops.render.render(write_still=True)
        
        end_time = time.time()    # <--- End Timer
        elapsed = end_time - start_time
        
        print(f"Render finished in: {elapsed:.2f} seconds")
        print(f"Saved to: {view_output}")
    
    print("=" * 60)


if __name__ == "__main__":
    main()