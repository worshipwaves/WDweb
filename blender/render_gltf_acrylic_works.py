"""
WaveDesigner Blender Render Script (GLTF Import Version)
Generates photorealistic renders from exported BabylonJS geometry.

Usage:
    blender --background --python render_gltf.py -- --gltf panel.glb --config panel_config.json --output render.png

This version imports geometry exported from BabylonJS, preserving exact mesh
geometry and UVs. Only materials need to be converted to Cycles.
"""

import bpy
import math
import json
import sys
import os
import time
import random
from pathlib import Path
from mathutils import Vector, Matrix

# ============================================
# CONFIGURATION
# ============================================

class Config:
    """Paths and render settings"""
    
    BASE_DIR = Path(__file__).parent
    TEXTURE_DIR = BASE_DIR.parent / "public" / "assets" / "textures" / "wood"
    HDRI_PATH = BASE_DIR / "hdri" / "studio_small_09_4k.exr"
    OUTPUT_DIR = BASE_DIR / "output"
    
    # Render settings
    RENDER_WIDTH = 2048
    RENDER_HEIGHT = 2048
    RENDER_SAMPLES = 512
    USE_DENOISER = True
    
    # Material settings
    TEXTURE_SIZE = "Large_400cm"
    USE_VARNISHED = True
    
    # Camera settings
    FRAME_FILL = 0.85


# ============================================
# GLTF IMPORT
# ============================================

def import_gltf(gltf_path: str) -> list:
    """
    Import GLTF/GLB geometry from BabylonJS export.
    Returns list of imported mesh objects.
    """
    # Resolve to absolute path
    gltf_path = str(Path(gltf_path).resolve())
    
    if not Path(gltf_path).exists():
        print(f"ERROR: GLTF file not found: {gltf_path}")
        return []
    
    # Clear existing objects
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    
    # Import GLTF
    bpy.ops.import_scene.gltf(
        filepath=gltf_path,
        import_shading='NORMALS'  # Preserve normals from BabylonJS
    )
    
    # Collect imported meshes
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    
    print(f"Imported {len(meshes)} meshes from GLTF")
    for mesh in meshes:
        print(f"  - {mesh.name}: {len(mesh.data.vertices)} verts")
    
    return meshes
    
    
def inspect_transforms(meshes):
    print("\n" + "="*40)
    print("INSPECTING IMPORTED TRANSFORMS")
    print("="*40)
    
    for mesh in meshes:
        if 'backing' in mesh.name.lower():
            # Get rotation in degrees for readability
            rot = mesh.rotation_euler
            rot_deg = (round(math.degrees(rot.x)), round(math.degrees(rot.y)), round(math.degrees(rot.z)))
            
            # Get scale
            scale = mesh.scale
            scale_rounded = (round(scale.x, 3), round(scale.y, 3), round(scale.z, 3))
            
            print(f"Object: {mesh.name}")
            print(f"  Rotation (XYZ deg): {rot_deg}")
            print(f"  Scale    (XYZ):     {scale_rounded}")
            
            if rot_deg[2] != 0 or scale.x < 0 or scale.y < 0:
                 print("  -> CONFIRMED: Object has Rotation or Mirroring applied.")
            else:
                 print("  -> Object is Neutral (0,0,0).")
    print("="*40 + "\n")    
    
    
def fix_inverted_normals(meshes):
    """
    Force recalculation of normals to ensure faces point OUTWARD.
    Fixes 'inside-out' geometry that breaks refractive materials (glass/acrylic).
    """
    print("Verifying and fixing normals...")
    
    # Deselect all objects first
    bpy.ops.object.select_all(action='DESELECT')
    
    for mesh in meshes:
        # Only process meshes
        if mesh.type != 'MESH':
            continue
            
        # 1. Set object as active
        bpy.context.view_layer.objects.active = mesh
        
        # 2. Go into Edit Mode
        bpy.ops.object.mode_set(mode='EDIT')
        
        # 3. Select All Faces
        bpy.ops.mesh.select_all(action='SELECT')
        
        # 4. Recalculate Normals (Force Outside)
        bpy.ops.mesh.normals_make_consistent(inside=False)
        
        # 5. Return to Object Mode
        bpy.ops.object.mode_set(mode='OBJECT')
        
        print(f"  - Recalculated normals for {mesh.name}")    


def orient_for_wall_view(meshes: list):
    """
    BabylonJS exports with Y-up, Blender imports with Z-up conversion.
    Apply any needed rotation to match wall-mounted orientation.
    """
    # GLTF import should handle coordinate conversion automatically
    # If orientation is wrong, apply rotation here
    
    for mesh in meshes:
        if mesh.name.startswith('section_') or mesh.name.startswith('backing_'):
            # Verify orientation - panel should face -Y (toward camera)
            # Adjust if needed based on testing
            pass
    
    print("Geometry oriented for wall view")


# ============================================
# MATERIALS (Cycles PBR)
# ============================================

def find_texture_file(directory: Path, suffix: str) -> Path | None:
    """Find texture file with given suffix."""
    if not directory.exists():
        return None
    for f in directory.iterdir():
        if f.suffix == '.png' and suffix in f.name:
            return f
    return None


def create_cycles_wood_material(
    species: str, 
    grain_direction: str,
    section_index: int,
    panel_config: dict
) -> bpy.types.Material:
    """
    Create Cycles PBR wood material.
    Uses Object coordinates for consistent UV mapping across sections.
    """
    mat_name = f"wood_{species}_{section_index}"
    mat = bpy.data.materials.new(name=mat_name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    
    # Output
    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (800, 0)
    
    # Principled BSDF
    principled = nodes.new('ShaderNodeBsdfPrincipled')
    principled.location = (400, 0)
    
    # Texture Coordinate (use UV from GLTF import)
    tex_coord = nodes.new('ShaderNodeTexCoord')
    tex_coord.location = (-800, 0)
    
    # Reference empty for consistent Object coordinates across all sections
    coord_empty = bpy.data.objects.get('TextureCoordOrigin')
    if not coord_empty:
        coord_empty = bpy.data.objects.new('TextureCoordOrigin', None)
        bpy.context.collection.objects.link(coord_empty)
        coord_empty.hide_render = True
        coord_empty.hide_viewport = True
    tex_coord.object = coord_empty
    
    # Mapping for grain rotation
    mapping = nodes.new('ShaderNodeMapping')
    mapping.location = (-600, 0)
    
    # Grain direction angles (matches BabylonJS config)
    grain_angles = {
        'horizontal': 0, 
        'vertical': 90,
        'radiant': [135, 45, 315, 225],   # Per-section for n=4
        'diamond': [45, 315, 225, 135]    # Per-section for n=4
    }
    
    if grain_direction in ('radiant', 'diamond'):
        angle_deg = grain_angles[grain_direction][section_index % 4]
    else:
        angle_deg = grain_angles.get(grain_direction, 90)
    
    mapping.inputs['Rotation'].default_value = (math.radians(-90), 0, math.radians(angle_deg))
    
    # Scale for Object coordinates in inches (GLTF exports in inches)
    # 4m texture, inch geometry: 0.25 * 0.0254 = 0.00635
    tex_scale = 0.00635
    mapping.inputs['Scale'].default_value = (tex_scale, tex_scale, tex_scale)
    
    # Random offset centered at 0.5 with constrained jitter
    random.seed(int(time.time() * 1000) + section_index)
    safe_margin = 0.2
    offset_x = 0.5 + random.uniform(-safe_margin, safe_margin)
    offset_y = 0.5 + random.uniform(-safe_margin, safe_margin)
    mapping.inputs['Location'].default_value = (offset_x, offset_y, 0)
    
    # Use Object coordinates with shared reference empty
    links.new(tex_coord.outputs['Object'], mapping.inputs['Vector'])
    
    # Load textures
    texture_base = Config.TEXTURE_DIR / species
    size_folder = Config.TEXTURE_SIZE
    
    if Config.USE_VARNISHED:
        diffuse_path = texture_base / "Varnished" / size_folder / "Diffuse"
    else:
        diffuse_path = texture_base / "Raw" / size_folder / "Diffuse"
    
    shared_path = texture_base / "Shared_Maps" / size_folder
    
    # Diffuse
    print(f"  Diffuse path: {diffuse_path}")
    print(f"  Diffuse exists: {diffuse_path.exists()}")
    diffuse_file = find_texture_file(diffuse_path, "_d.png")
    print(f"  Diffuse file: {diffuse_file}")
    if diffuse_file:
        diffuse_tex = nodes.new('ShaderNodeTexImage')
        diffuse_tex.location = (-200, 200)
        try:
            diffuse_tex.image = bpy.data.images.load(str(diffuse_file))
            diffuse_tex.image.colorspace_settings.name = 'sRGB'
            print(f"  Diffuse image loaded: {diffuse_tex.image.name if diffuse_tex.image else 'FAILED'}")
        except Exception as e:
            print(f"  Diffuse load error: {e}")
        diffuse_tex.interpolation = 'Smart'
        diffuse_tex.extension = 'REPEAT'
        links.new(mapping.outputs['Vector'], diffuse_tex.inputs['Vector'])
        link = links.new(diffuse_tex.outputs['Color'], principled.inputs['Base Color'])
        print(f"  Base Color link created: {link is not None}")
        print(f"  Principled inputs: {[s.name for s in principled.inputs]}")
    
    # Normal
    normal_file = find_texture_file(shared_path / "Normal", "_n.png")
    if normal_file:
        normal_tex = nodes.new('ShaderNodeTexImage')
        normal_tex.location = (-200, -100)
        normal_tex.image = bpy.data.images.load(str(normal_file))
        normal_tex.image.colorspace_settings.name = 'Non-Color'
        normal_tex.extension = 'EXTEND'
        
        normal_map = nodes.new('ShaderNodeNormalMap')
        normal_map.location = (100, -100)
        
        links.new(mapping.outputs['Vector'], normal_tex.inputs['Vector'])
        links.new(normal_tex.outputs['Color'], normal_map.inputs['Color'])
        links.new(normal_map.outputs['Normal'], principled.inputs['Normal'])
    
    # Roughness
    roughness_file = find_texture_file(shared_path / "Roughness", "_r.png")
    if roughness_file:
        roughness_tex = nodes.new('ShaderNodeTexImage')
        roughness_tex.location = (-200, -400)
        roughness_tex.image = bpy.data.images.load(str(roughness_file))
        roughness_tex.image.colorspace_settings.name = 'Non-Color'
        roughness_tex.extension = 'EXTEND'
        
        links.new(mapping.outputs['Vector'], roughness_tex.inputs['Vector'])
        links.new(roughness_tex.outputs['Color'], principled.inputs['Roughness'])
    else:
        principled.inputs['Roughness'].default_value = 0.3
    
    # Wood-specific PBR settings
    principled.inputs['Subsurface Weight'].default_value = 0.05
    principled.inputs['Subsurface Radius'].default_value = (0.1, 0.05, 0.02)
    principled.inputs['Anisotropic'].default_value = 0.3
    
    links.new(principled.outputs['BSDF'], output.inputs['Surface'])
    
    return mat


def create_backing_material(material_props: dict) -> bpy.types.Material:
    mat = bpy.data.materials.new(name='backing_material')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    
    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (400, 0)
    
    principled = nodes.new('ShaderNodeBsdfPrincipled')
    principled.location = (0, 0)
    
    # JET BLACK
    principled.inputs['Base Color'].default_value = (0.0, 0.0, 0.0, 1)
    # GLASS REFLECTION
    if 'IOR' in principled.inputs:
        principled.inputs['IOR'].default_value = 1.49
    # SHARPNESS (0.0 = Mirror, 0.02 = Polished Plastic)
    principled.inputs['Roughness'].default_value = 0.0
    # NON-METALLIC
    principled.inputs['Metallic'].default_value = 0.0
    
    links.new(principled.outputs['BSDF'], output.inputs['Surface'])
    return mat
   
    
def force_backing_alignment(meshes):
    """
    1. Detects wall-facing panels.
    2. Clears 'Custom Split Normals' (Crucial for GLTF imports).
    3. Flips normals to face the camera.
    """
    print("Force aligning backing normals...")
    
    # Default assumption: Camera is at negative Y looking at positive Y
    cam_loc = Vector((0, -200, 0)) 
    
    # Ensure Object Mode
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
        
    bpy.ops.object.select_all(action='DESELECT')
    
    for mesh in meshes:
        if 'backing' not in mesh.name.lower(): continue
        if not mesh.data.polygons: continue
        
        # 1. CLEAR CUSTOM SPLIT NORMALS
        # GLTF imports often lock normals. If we flip geometry but keep old normals,
        # the shading looks gray/broken. We must clear this data.
        bpy.context.view_layer.objects.active = mesh
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
        
        # 2. Check Direction
        poly = mesh.data.polygons[0]
        world_normal = mesh.matrix_world.to_3x3() @ poly.normal
        vec_to_cam = (cam_loc - mesh.location).normalized()
        
        # 3. Flip if facing away
        if world_normal.dot(vec_to_cam) < 0:
            print(f"  - FLIPPING {mesh.name} (Detected facing wall)")
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.mesh.select_all(action='SELECT')
            bpy.ops.mesh.flip_normals()
            bpy.ops.object.mode_set(mode='OBJECT')
        
        # 4. Enable Smooth Shading (optional, but good for glass)
        bpy.ops.object.shade_smooth()


def apply_materials(meshes, config):
    """
    Apply Cycles materials.
    FORCED: Always applies Jet Black to backings, ignoring config triggers.
    """
    section_materials = config.get('section_materials', [])
    panel_config = config.get('panel_config', {})
    
    # Get backing config, or use empty dict if missing
    backing_mat_props = config.get('backing_material', {})
    
    for mesh in meshes:
        # 1. WOOD SECTIONS
        if mesh.name.startswith('section_'):
            try:
                idx = int(mesh.name.split('_')[1])
            except: idx = 0
            
            mat_config = next(
                (m for m in section_materials if m.get('section_id') == idx),
                {'species': 'walnut-black-american', 'grain_direction': 'vertical'}
            )
            
            mat = create_cycles_wood_material(
                mat_config['species'],
                mat_config['grain_direction'],
                idx,
                panel_config
            )
            
            mesh.data.materials.clear()
            mesh.data.materials.append(mat)
            print(f"Applied {mat_config['species']} to {mesh.name}")
        
        # 2. BACKING PANELS (The Fix)
        elif 'backing' in mesh.name.lower():
            # We call this UNCONDITIONALLY now.
            # Even if backing_mat_props is empty, create_backing_material 
            # handles the defaults (Pure Black, Shiny).
            mat = create_backing_material(backing_mat_props)
            
            mesh.data.materials.clear()
            mesh.data.materials.append(mat)
            print(f"Applied FORCE BLACK material to {mesh.name}")


# ============================================
# SCENE SETUP (Preserved from original)
# ============================================

def setup_hdri_lighting():
    """
    Setup HDRI and Scene Lights.
    1. Forces Cycles engine.
    2. MASKS HDRI FROM REFLECTIONS: Prevents "Gray" look on black acrylic.
    3. MASKS HDRI FROM REAR: Prevents wall bleed.
    4. OPTIMIZES LIGHTS: Keeps highlights sharp, removes gray wash-out.
    """
    if bpy.context.scene.render.engine != 'CYCLES':
        bpy.context.scene.render.engine = 'CYCLES'

    world = bpy.context.scene.world
    if world is None:
        world = bpy.data.worlds.new("World")
        bpy.context.scene.world = world
    
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    
    # --- NODES SETUP ---
    output = nodes.new('ShaderNodeOutputWorld')
    output.location = (900, 0)
    
    # The actual HDRI
    bg_hdri = nodes.new('ShaderNodeBackground')
    bg_hdri.location = (200, 200)
    
    # Pure Black (for masking)
    bg_black = nodes.new('ShaderNodeBackground')
    bg_black.location = (200, -200)
    bg_black.inputs['Color'].default_value = (0, 0, 0, 1)
    
    # Mix 1: The "Rear Wall" Mask
    mix_rear = nodes.new('ShaderNodeMixShader')
    mix_rear.location = (400, 100)
    
    # Mix 2: The "Glossy/Reflection" Mask (The Fix for Gray Blacks)
    mix_glossy = nodes.new('ShaderNodeMixShader')
    mix_glossy.location = (600, 0)
    
    # Coordinates for Rear Mask
    tex_coord = nodes.new('ShaderNodeTexCoord')
    tex_coord.location = (-400, 300)
    sep_xyz = nodes.new('ShaderNodeSeparateXYZ')
    sep_xyz.location = (-200, 300)
    math_compare = nodes.new('ShaderNodeMath')
    math_compare.location = (0, 300)
    math_compare.operation = 'GREATER_THAN'
    
    # Light Path for Glossy Mask
    light_path = nodes.new('ShaderNodeLightPath')
    light_path.location = (400, 300)
    
    # Texture
    env_tex = nodes.new('ShaderNodeTexEnvironment')
    env_tex.location = (-100, 200)
    
    # --- LOAD HDRI ---
    if Config.HDRI_PATH.exists():
        try:
            env_tex.image = bpy.data.images.load(str(Config.HDRI_PATH))
        except: pass

    # --- LINKING ---
    
    # 1. Setup Rear Mask (Is Y > 0?)
    links.new(tex_coord.outputs['Generated'], sep_xyz.inputs['Vector'])
    links.new(sep_xyz.outputs['Y'], math_compare.inputs[0])
    
    # 2. Connect HDRI
    links.new(env_tex.outputs['Color'], bg_hdri.inputs['Color'])
    
    # 3. Mix Rear Mask
    # If Backwards (Val=1), show Black. Else show HDRI.
    links.new(math_compare.outputs['Value'], mix_rear.inputs['Fac'])
    links.new(bg_hdri.outputs['Background'], mix_rear.inputs[1])
    links.new(bg_black.outputs['Background'], mix_rear.inputs[2])
    
    # 4. Mix Glossy Mask (The "Jet Black" Logic)
    # If "Is Glossy Ray" is TRUE, show Black. 
    # This means the mirror surface sees BLACK space, not the gray HDRI room.
    links.new(light_path.outputs['Is Glossy Ray'], mix_glossy.inputs['Fac'])
    links.new(mix_rear.outputs['Shader'], mix_glossy.inputs[1]) # Non-Glossy sees HDRI
    links.new(bg_black.outputs['Background'], mix_glossy.inputs[2]) # Glossy sees Black
    
    # 5. Output
    links.new(mix_glossy.outputs['Shader'], output.inputs['Surface'])

    # --- SCENE LIGHTS ---
    
    # 1. Key Overhead (This provides the SHINY reflection on the black)
    bpy.ops.object.light_add(type='AREA', location=(-40, -30, 40))
    key = bpy.context.active_object
    key.name = "Key_Overhead"
    key.data.size = 40
    key.data.energy = 50000
    key.rotation_euler = (math.radians(50), 0, 0)
    # Important: This one stays Visible to Glossy to create the highlight

    # 2. Front Fill (Diffuse Only)
    bpy.ops.object.light_add(type='AREA', location=(0, -50, 0))
    fill = bpy.context.active_object
    fill.name = "Front_Fill"
    fill.data.size = 40
    fill.data.energy = 15000
    fill.rotation_euler = (math.radians(90), 0, 0)
    fill.visible_glossy = False 

    # 3. Right Fill (Diffuse Only)
    bpy.ops.object.light_add(type='AREA', location=(40, -30, 20))
    right_fill = bpy.context.active_object
    right_fill.name = "Right_Fill"
    right_fill.data.size = 30
    right_fill.data.energy = 25000
    right_fill.rotation_euler = (math.radians(60), 0, math.radians(-30))
    right_fill.visible_glossy = False

    # 4. Small Key Light (Highlights)
    bpy.ops.object.light_add(type='AREA', radius=2, location=(-2, -3, 2))
    light = bpy.context.active_object
    light.name = "Key_Light"
    light.data.energy = 200
    
    direction = Vector((0, 0, 0)) - light.location
    light.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def create_environment_wall():
    """Create wall backdrop."""
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0.25, 0))
    wall = bpy.context.active_object
    wall.name = "Environment_Wall"
    wall.rotation_euler = (math.radians(90), 0, 0)
    
    mat = bpy.data.materials.new(name="Wall_Paint")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    
    output = nodes.new('ShaderNodeOutputMaterial')
    principled = nodes.new('ShaderNodeBsdfPrincipled')
    principled.inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1)
    principled.inputs['Roughness'].default_value = 0.9
    
    mat.node_tree.links.new(principled.outputs['BSDF'], output.inputs['Surface'])
    wall.data.materials.append(mat)
    
    return wall


def setup_camera(meshes: list, view: str = 'wall'):
    """Setup camera based on imported geometry bounds."""
    # Calculate bounding box of all panel meshes
    min_coord = Vector((float('inf'), float('inf'), float('inf')))
    max_coord = Vector((float('-inf'), float('-inf'), float('-inf')))
    
    for mesh in meshes:
        if mesh.name.startswith('section_'):
            for vert in mesh.bound_box:
                world_vert = mesh.matrix_world @ Vector(vert)
                min_coord.x = min(min_coord.x, world_vert.x)
                min_coord.y = min(min_coord.y, world_vert.y)
                min_coord.z = min(min_coord.z, world_vert.z)
                max_coord.x = max(max_coord.x, world_vert.x)
                max_coord.y = max(max_coord.y, world_vert.y)
                max_coord.z = max(max_coord.z, world_vert.z)
    
    center = (min_coord + max_coord) / 2
    size = max_coord - min_coord
    max_dimension = max(size.x, size.y, size.z)
    
    # Create camera
    cam_data = bpy.data.cameras.new('Camera')
    cam_obj = bpy.data.objects.new('Camera', cam_data)
    bpy.context.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj
    
    if view == 'wall':
        cam_data.type = 'PERSP'
        cam_data.lens = 50
        
        sensor_width = 36.0
        fov = 2 * math.atan(sensor_width / (2 * cam_data.lens))
        distance = (max_dimension / Config.FRAME_FILL) / (2 * math.tan(fov / 2))
        
        cam_obj.location = (center.x, center.y - distance, center.z)
        cam_obj.rotation_euler = (math.radians(90), 0, 0)
    
    elif view == 'orthogonal':
        cam_data.type = 'PERSP'
        cam_data.lens = 50
        distance = max_dimension * 2.5
        cam_obj.location = (center.x + distance * 0.7, center.y - distance * 0.7, center.z + distance * 0.5)
        direction = center - cam_obj.location
        cam_obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    
    return cam_obj


def setup_render_settings():
    """Configure Cycles render settings."""
    scene = bpy.context.scene
    
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.render.engine = 'CYCLES'
    
    cycles_prefs = bpy.context.preferences.addons['cycles'].preferences
    cycles_prefs.compute_device_type = 'OPTIX'
    cycles_prefs.get_devices()
    
    for device in cycles_prefs.devices:
        device.use = (device.type == 'OPTIX')
    
    scene.cycles.device = 'GPU'
    scene.cycles.samples = Config.RENDER_SAMPLES
    scene.cycles.use_denoising = Config.USE_DENOISER
    scene.cycles.denoiser = 'OPTIX'
    
    scene.render.resolution_x = Config.RENDER_WIDTH
    scene.render.resolution_y = Config.RENDER_HEIGHT
    scene.render.resolution_percentage = 100
    
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '16'
    scene.render.film_transparent = True


# ============================================
# CLI INTERFACE
# ============================================

def parse_args():
    """Parse command line arguments."""
    args = {}
    
    if '--' in sys.argv:
        argv = sys.argv[sys.argv.index('--') + 1:]
    else:
        argv = []
    
    i = 0
    while i < len(argv):
        if argv[i] == '--gltf':
            args['gltf'] = argv[i + 1]
            i += 2
        elif argv[i] == '--config':
            args['config'] = argv[i + 1]
            i += 2
        elif argv[i] == '--output':
            args['output'] = argv[i + 1]
            i += 2
        elif argv[i] == '--samples':
            Config.RENDER_SAMPLES = int(argv[i + 1])
            i += 2
        elif argv[i] == '--view':
            args['view'] = argv[i + 1]
            i += 2
        elif argv[i] == '--wall':
            args['view'] = 'wall'
            i += 1
        elif argv[i] == '--orthogonal':
            args['view'] = 'orthogonal'
            i += 1
        elif argv[i] == '--1k':
            Config.RENDER_WIDTH = Config.RENDER_HEIGHT = 1024
            i += 1
        elif argv[i] == '--2k':
            Config.RENDER_WIDTH = Config.RENDER_HEIGHT = 2048
            i += 1
        elif argv[i] == '--draft':
            Config.RENDER_WIDTH = Config.RENDER_HEIGHT = 256
            i += 1
        else:
            i += 1
    
    return args


def main():
    args = parse_args()
    
    gltf_path = args.get('gltf')
    config_path = args.get('config')
    output_path = args.get('output', str(Config.OUTPUT_DIR / 'render.png'))
    view = args.get('view', 'wall')
    
    if not gltf_path:
        print("Usage: blender --background --python render_gltf.py -- --gltf panel.glb --config panel_config.json")
        return
    
    # Load config
    config = {}
    if config_path and Path(config_path).exists():
        with open(config_path, 'r') as f:
            config = json.load(f)
    
    print("=" * 60)
    print("WaveDesigner GLTF Render")
    print("=" * 60)
    print(f"GLTF: {gltf_path}")
    print(f"Config: {config_path}")
    print(f"Output: {output_path}")
    print("=" * 60)
    
    # Import geometry
    meshes = import_gltf(gltf_path)
    
    if not meshes:
        print("ERROR: No meshes imported from GLTF")
        return
        
    inspect_transforms(meshes)    
    
    # Orient for rendering
    orient_for_wall_view(meshes)
    
    # Fix inverted geometry from baked rotations
    force_backing_alignment(meshes)
    
    # Apply Cycles materials
    apply_materials(meshes, config)
    
    # Setup scene
    setup_hdri_lighting()
    create_environment_wall()
    setup_camera(meshes, view)
    setup_render_settings()
    
    # Render
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.render.filepath = str(output_file)
    
    # Save the scene for inspection
    debug_path = str(Config.OUTPUT_DIR / "debug_scene.blend")
    bpy.ops.wm.save_as_mainfile(filepath=debug_path)
    print(f"DEBUG: Saved blend file to {debug_path}")

    # bpy.ops.render.render(write_still=True)    
    
    print("-" * 30)
    print(f"Rendering {view} view...")
    start_time = time.time()
    
    bpy.ops.render.render(write_still=True)
    
    elapsed = time.time() - start_time
    print(f"Render complete in {elapsed:.2f}s")
    print(f"Output: {output_file}")
    print("=" * 60)


if __name__ == "__main__":
    main()
