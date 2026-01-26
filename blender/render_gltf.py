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
    
    # Wall settings
    WALL_COLOR = (0.957, 0.957, 0.957, 1)  # Light gray


# ============================================
# LIGHTING PRESETS
# ============================================

LIGHTING_PRESETS = {
    'gallery': {
        'description': 'Balanced showcase - shadows with full grain visibility',
        'key': {
            'azimuth': 45, 'elevation': 20, 'size': 40,
            'energy_ratio': 1.0, 'visible_glossy': True, 'color_temp': 5000,
        },
        'fill': {
            'azimuth': -30, 'elevation': 10, 'size': 60,
            'energy_ratio': 0.25, 'visible_glossy': False, 'color_temp': 5500,
        },
        'ambient_strength': 0.2,
    },
    'dramatic': {
        'description': 'High contrast - deep shadows, strong highlights',
        'key': {
            'azimuth': 60, 'elevation': 40, 'size': 25,
            'energy_ratio': 1.2, 'visible_glossy': True, 'color_temp': 4500,
        },
        'fill': {
            'azimuth': -45, 'elevation': 5, 'size': 50,
            'energy_ratio': 0.15, 'visible_glossy': False, 'color_temp': 6000,
        },
        'ambient_strength': 0.05,
    },
    'detail': {
        'description': 'Texture emphasis - raking light reveals grain',
        'key': {
            'azimuth': 30, 'elevation': 20, 'size': 50,
            'energy_ratio': 0.9, 'visible_glossy': True, 'color_temp': 5000,
        },
        'fill': {
            'azimuth': -20, 'elevation': 15, 'size': 70,
            'energy_ratio': 0.30, 'visible_glossy': False, 'color_temp': 5500,
        },
        'ambient_strength': 0.15,
    },
    'soft': {
        'description': 'Even illumination - minimal shadows for reverse/turntable',
        'key': {
            'azimuth': 15, 'elevation': 45, 'size': 80,
            'energy_ratio': 0.8, 'visible_glossy': True, 'color_temp': 5500,
        },
        'fill': {
            'azimuth': -15, 'elevation': 30, 'size': 80,
            'energy_ratio': 0.50, 'visible_glossy': False, 'color_temp': 5500,
        },
        'ambient_strength': 0.2,
    },
    'natural': {
        'description': 'Window simulation - realistic interior lighting',
        'key': {
            'azimuth': 50, 'elevation': 30, 'size': 60,
            'energy_ratio': 1.0, 'visible_glossy': True, 'color_temp': 5600,
        },
        'fill': {
            'azimuth': -40, 'elevation': 20, 'size': 40,
            'energy_ratio': 0.25, 'visible_glossy': False, 'color_temp': 4000,
        },
        'ambient_strength': 0.12,
    },
}


def kelvin_to_rgb(kelvin: float) -> tuple:
    """Convert color temperature in Kelvin to RGB values."""
    temp = kelvin / 100.0
    if temp <= 66:
        r = 255
        g = 99.4708025861 * math.log(temp) - 161.1195681661
    else:
        r = 329.698727446 * ((temp - 60) ** -0.1332047592)
        g = 288.1221695283 * ((temp - 60) ** -0.0755148492)
    r = max(0, min(255, r))
    g = max(0, min(255, g))
    if temp >= 66:
        b = 255
    elif temp <= 19:
        b = 0
    else:
        b = 138.5177312231 * math.log(temp - 10) - 305.0447927307
    b = max(0, min(255, b))
    return (r / 255.0, g / 255.0, b / 255.0)


# ============================================
# GLTF IMPORT & GEOMETRY
# ============================================

def import_gltf(gltf_path: str) -> list:
    """
    Import GLTF/GLB geometry from BabylonJS export.
    Returns list of imported mesh objects.
    """
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
        import_shading='NORMALS'
    )

    # Collect imported meshes
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']

    print(f"Imported {len(meshes)} meshes from GLTF")
    return meshes

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
        # Robust detection for any backing mesh
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
        
        # 4. Enable Smooth Shading
        bpy.ops.object.shade_smooth()

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
    panel_config: dict,
    mat_config: dict = None
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

    # Texture Coordinate
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

    # Grain direction angles
    if mat_config and mat_config.get('grain_angle') is not None:
        angle_deg = mat_config['grain_angle']
    else:
        grain_angles = {
            'horizontal': 0, 
            'vertical': 90,
            'radiant': [135, 45, 315, 225],
            'diamond': [45, 315, 225, 135]
        }
        if grain_direction in ('radiant', 'diamond'):
            angle_deg = grain_angles[grain_direction][section_index % 4]
        else:
            angle_deg = grain_angles.get(grain_direction, 90)

    print(f"DEBUG create_material: section_{section_index}, species={species}, angle_deg={angle_deg}")

    mapping.inputs['Rotation'].default_value = (math.radians(-90), 0, math.radians(angle_deg))

    # Scale for Object coordinates in inches
    tex_scale = 0.00635
    mapping.inputs['Scale'].default_value = (tex_scale, tex_scale, tex_scale)

    # Random offset
    random.seed(int(time.time() * 1000) + section_index)
    safe_margin = 0.2
    offset_x = 0.5 + random.uniform(-safe_margin, safe_margin)
    offset_y = 0.5 + random.uniform(-safe_margin, safe_margin)
    mapping.inputs['Location'].default_value = (offset_x, offset_y, 0)

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
    diffuse_file = find_texture_file(diffuse_path, "_d.png")
    if diffuse_file:
        diffuse_tex = nodes.new('ShaderNodeTexImage')
        diffuse_tex.location = (-200, 200)
        try:
            diffuse_tex.image = bpy.data.images.load(str(diffuse_file))
            diffuse_tex.image.colorspace_settings.name = 'sRGB'
        except Exception as e:
            print(f"  Diffuse load error: {e}")
        diffuse_tex.interpolation = 'Smart'
        diffuse_tex.extension = 'REPEAT'
        links.new(mapping.outputs['Vector'], diffuse_tex.inputs['Vector'])
        links.new(diffuse_tex.outputs['Color'], principled.inputs['Base Color'])

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
    """Create Jet Black Backing Material with satin finish (noise-free)."""
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
    # ACRYLIC IOR
    if 'IOR' in principled.inputs:
        principled.inputs['IOR'].default_value = 1.49
    # SATIN FINISH (0.5 = noise-free, 0.0 = mirror/noisy)
    principled.inputs['Roughness'].default_value = 0.05
    # NON-METALLIC
    principled.inputs['Metallic'].default_value = 0.0
    # Force fully opaque
    principled.inputs['Alpha'].default_value = 1.0

    links.new(principled.outputs['BSDF'], output.inputs['Surface'])

    return mat

def apply_materials(meshes: list, config: dict):
    """
    Apply Cycles materials to imported meshes based on config.
    Forces black backing material regardless of config triggers.
    """
    section_materials = config.get('section_materials', [])
    panel_config = config.get('panel_config', {})
    
    # Get backing config, or use empty dict
    backing_mat_props = config.get('backing_material', {})

    for mesh in meshes:
        if mesh.name.startswith('section_'):
            # Extract section index from name
            try:
                idx = int(mesh.name.split('_')[1])
            except (IndexError, ValueError):
                idx = 0
            
            # Find material config (species assignment is correct by mesh index)
            mat_config = next(
                (m for m in section_materials if m.get('section_id') == idx),
                {'species': 'walnut-black-american', 'grain_direction': 'vertical'}
            )
            
            # For 3-section circular panels, swap grain_angle between indices 1 and 2
            # Mesh geometry order doesn't match section_positioning_angles["3"] = [90, 330, 210]
            if len(section_materials) == 3 and idx in (1, 2):
                swapped_idx = 3 - idx  # 1→2, 2→1
                swapped_config = next(
                    (m for m in section_materials if m.get('section_id') == swapped_idx),
                    None
                )
                if swapped_config and swapped_config.get('grain_angle') is not None:
                    mat_config = dict(mat_config)  # Copy to avoid modifying original
                    mat_config['grain_angle'] = swapped_config['grain_angle']
            
            print(f"DEBUG apply_materials: mesh={mesh.name}, idx={idx}, grain_angle={mat_config.get('grain_angle')}")
            
            # Create and apply wood material
            mat = create_cycles_wood_material(
                mat_config['species'],
                mat_config['grain_direction'],
                idx,
                panel_config,
                mat_config
            )
            
            mesh.data.materials.clear()
            mesh.data.materials.append(mat)
            print(f"Applied {mat_config['species']} ({mat_config['grain_direction']}) to {mesh.name}")
        
        elif 'backing' in mesh.name.lower():
            # Apply backing material UNCONDITIONALLY
            mat = create_backing_material(backing_mat_props)
            mesh.data.materials.clear()
            mesh.data.materials.append(mat)
            print(f"Applied FORCE BLACK material to {mesh.name}")

# ============================================
# SCENE SETUP
# ============================================

def setup_lighting(preset: str = 'gallery', panel_size: float = 1.0):
    """
    Setup scene lighting using named preset.
    
    Args:
        preset: One of 'gallery', 'dramatic', 'detail', 'soft', 'natural'
        panel_size: Approximate panel dimension in meters (for distance scaling)
    """
    if preset not in LIGHTING_PRESETS:
        print(f"WARNING: Unknown preset '{preset}', using 'gallery'")
        preset = 'gallery'
    
    config = LIGHTING_PRESETS[preset]
    print(f"Lighting preset: {preset} - {config['description']}")
    
    if bpy.context.scene.render.engine != 'CYCLES':
        bpy.context.scene.render.engine = 'CYCLES'
    
    # Remove existing lights
    for obj in bpy.data.objects:
        if obj.type == 'LIGHT':
            bpy.data.objects.remove(obj, do_unlink=True)
    
    # Setup world/HDRI
    _setup_world_hdri(config['ambient_strength'])
    
    # Calculate base distance from panel size
    base_distance = panel_size * 3.0
    base_energy = 50000 * (panel_size / 20) ** 2
    
    # Create key light
    key_cfg = config['key']
    _create_area_light(
        name="Key_Light",
        azimuth=key_cfg['azimuth'],
        elevation=key_cfg['elevation'],
        distance=base_distance,
        size=key_cfg['size'],
        energy=base_energy * key_cfg['energy_ratio'],
        color_temp=key_cfg['color_temp'],
        visible_glossy=key_cfg['visible_glossy']
    )
    
    # Create fill light
    fill_cfg = config['fill']
    _create_area_light(
        name="Fill_Light",
        azimuth=fill_cfg['azimuth'],
        elevation=fill_cfg['elevation'],
        distance=base_distance * 0.8,
        size=fill_cfg['size'],
        energy=base_energy * fill_cfg['energy_ratio'],
        color_temp=fill_cfg['color_temp'],
        visible_glossy=fill_cfg['visible_glossy']
    )


def _create_area_light(
    name: str,
    azimuth: float,
    elevation: float,
    distance: float,
    size: float,
    energy: float,
    color_temp: float,
    visible_glossy: bool
):
    """Create positioned area light pointing at origin."""
    az_rad = math.radians(azimuth)
    el_rad = math.radians(elevation)
    
    x = math.sin(az_rad) * math.cos(el_rad) * distance
    y = -math.cos(az_rad) * math.cos(el_rad) * distance
    z = math.sin(el_rad) * distance
    
    bpy.ops.object.light_add(type='AREA', location=(x, y, z))
    light = bpy.context.active_object
    light.name = name
    light.data.size = size
    light.data.energy = energy
    light.data.color = kelvin_to_rgb(color_temp)
    
    direction = Vector((0, 0, 0)) - light.location
    light.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    light.visible_glossy = visible_glossy
    
    print(f"  {name}: pos=({x:.1f}, {y:.1f}, {z:.1f}), size={size}, energy={energy:.0f}")


def _setup_world_hdri(ambient_strength: float):
    """
    Setup world background with HDRI ambient lighting.
    Uses Light Path node to hide HDRI from glossy reflections (eliminates noise).
    
    Node graph:
        Environment Texture → Background (HDRI) ─┬→ Mix Shader → World Output
                                                 │
        Background (Black) ─────────────────────┘
                                                 │
        Light Path (Is Glossy Ray) ─────────────→ Mix Shader (Fac)
    """
    world = bpy.context.scene.world
    if world is None:
        world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    
    # World Output
    output = nodes.new('ShaderNodeOutputWorld')
    output.location = (600, 0)
    
    # Mix Shader - blends HDRI and black based on ray type
    mix_shader = nodes.new('ShaderNodeMixShader')
    mix_shader.location = (400, 0)
    
    # Light Path - provides Is Glossy Ray output
    light_path = nodes.new('ShaderNodeLightPath')
    light_path.location = (200, 200)
    
    # Background for HDRI (camera/diffuse rays)
    bg_hdri = nodes.new('ShaderNodeBackground')
    bg_hdri.location = (200, 0)
    bg_hdri.name = "Background_HDRI"
    bg_hdri.inputs['Strength'].default_value = ambient_strength * 5
    
    # Background for glossy rays (black - eliminates noise)
    bg_black = nodes.new('ShaderNodeBackground')
    bg_black.location = (200, -150)
    bg_black.name = "Background_Black"
    bg_black.inputs['Color'].default_value = (0.0, 0.0, 0.0, 1.0)
    bg_black.inputs['Strength'].default_value = 1.0
    
    # Environment Texture (HDRI)
    env_tex = nodes.new('ShaderNodeTexEnvironment')
    env_tex.location = (0, 0)
    
    if Config.HDRI_PATH.exists():
        try:
            env_tex.image = bpy.data.images.load(str(Config.HDRI_PATH))
            print(f"  HDRI loaded, strength={ambient_strength * 5}")
        except:
            bg_hdri.inputs['Color'].default_value = Config.WALL_COLOR
    else:
        bg_hdri.inputs['Color'].default_value = Config.WALL_COLOR
    
    # Wire the node graph
    links.new(env_tex.outputs['Color'], bg_hdri.inputs['Color'])
    links.new(bg_hdri.outputs['Background'], mix_shader.inputs[1])  # HDRI to slot 1
    links.new(bg_black.outputs['Background'], mix_shader.inputs[2])  # Black to slot 2
    links.new(light_path.outputs['Is Glossy Ray'], mix_shader.inputs['Fac'])  # Switch based on ray type
    links.new(mix_shader.outputs['Shader'], output.inputs['Surface'])
    

def create_environment_wall():
    """Create wall backdrop as shadow catcher (invisible but receives shadows)."""
    bpy.ops.mesh.primitive_plane_add(size=1000, location=(0, 0.25, 0))
    wall = bpy.context.active_object
    wall.name = "Environment_Wall"
    wall.rotation_euler = (math.radians(90), 0, 0)
    wall.is_shadow_catcher = True

    return wall
    
    
def get_camera_distance(subject_dimension: float, lens_mm: float = 50.0) -> float:
    """
    Calculates the exact distance required to fit the subject according to Config.FRAME_FILL.
    Used by ALL static and animated camera setups to ensure visual consistency.
    """
    sensor_width = 36.0  # Standard full-frame
    fov = 2 * math.atan(sensor_width / (2 * lens_mm))
    distance = (subject_dimension / Config.FRAME_FILL) / (2 * math.tan(fov / 2))
    return distance
    

def setup_camera(meshes: list, view: str = 'wall'):
    """Setup camera based on imported geometry bounds."""
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
        distance = get_camera_distance(max_dimension, cam_data.lens)
        
        # Spherical coordinates: azimuth=45°, elevation=15°
        azimuth = math.radians(-40)
        elevation = math.radians(0)
        
        cam_obj.location = (
            center.x + math.sin(azimuth) * math.cos(elevation) * distance,
            center.y - math.cos(azimuth) * math.cos(elevation) * distance,
            center.z + math.sin(elevation) * distance
        )
        direction = center - cam_obj.location
        cam_obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

    return cam_obj


def setup_camera_reverse(meshes: list):
    """Setup camera behind panel for reverse/backing shot."""
    min_coord = Vector((float('inf'), float('inf'), float('inf')))
    max_coord = Vector((float('-inf'), float('-inf'), float('-inf')))

    for mesh in meshes:
        if mesh.name.startswith('section_') or 'backing' in mesh.name.lower():
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
    max_dimension = max(size.x, size.z)

    cam_data = bpy.data.cameras.new('Camera')
    cam_obj = bpy.data.objects.new('Camera', cam_data)
    bpy.context.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj

    cam_data.type = 'PERSP'
    cam_data.lens = 50
    
    sensor_width = 36.0
    fov = 2 * math.atan(sensor_width / (2 * cam_data.lens))
    distance = (max_dimension / Config.FRAME_FILL) / (2 * math.tan(fov / 2))
    
    # Camera behind panel (positive Y)
    cam_obj.location = (center.x, center.y + distance, center.z)
    cam_obj.rotation_euler = (math.radians(90), 0, math.radians(180))

    return cam_obj


def setup_camera_closeup(meshes: list, config: dict, slot_index: int = None):
    """
    Setup camera for slot detail shot with depth of field.
    Auto-selects slot near upper-right quadrant if not specified.
    """
    # Get panel bounds
    min_coord = Vector((float('inf'), float('inf'), float('inf')))
    max_coord = Vector((float('-inf'), float('-inf'), float('-inf')))

    for mesh in meshes:
        if mesh.name.startswith('section_'):
            for vert in mesh.bound_box:
                world_vert = mesh.matrix_world @ Vector(vert)
                min_coord.x = min(min_coord.x, world_vert.x)
                min_coord.z = min(min_coord.z, world_vert.z)
                max_coord.x = max(max_coord.x, world_vert.x)
                max_coord.z = max(max_coord.z, world_vert.z)

    panel_center_x = (min_coord.x + max_coord.x) / 2
    panel_center_z = (min_coord.z + max_coord.z) / 2

    # Try to get slot data from config
    focus_x, focus_z = panel_center_x, panel_center_z
    slot_size = 2.0  # Default slot size estimate
    
    csg_data = config.get('csg_data', {})
    slot_data = csg_data.get('slot_data', [])
    
    if slot_data:
        # Find slot in upper-right quadrant if no index specified
        if slot_index is None:
            best_slot = None
            best_score = float('-inf')
            for slot in slot_data:
                vertices = slot.get('vertices', [])
                if vertices:
                    sx = sum(v[0] for v in vertices) / len(vertices)
                    sz = sum(v[1] for v in vertices) / len(vertices)
                    # Score: prefer upper-right (positive x, positive z)
                    score = sx + sz
                    if score > best_score:
                        best_score = score
                        best_slot = slot
            if best_slot:
                vertices = best_slot['vertices']
                focus_x = sum(v[0] for v in vertices) / len(vertices)
                focus_z = sum(v[1] for v in vertices) / len(vertices)
                slot_size = max(
                    max(v[0] for v in vertices) - min(v[0] for v in vertices),
                    max(v[1] for v in vertices) - min(v[1] for v in vertices)
                )
        else:
            if slot_index < len(slot_data):
                vertices = slot_data[slot_index].get('vertices', [])
                if vertices:
                    focus_x = sum(v[0] for v in vertices) / len(vertices)
                    focus_z = sum(v[1] for v in vertices) / len(vertices)
                    slot_size = max(
                        max(v[0] for v in vertices) - min(v[0] for v in vertices),
                        max(v[1] for v in vertices) - min(v[1] for v in vertices)
                    )

    focus_point = Vector((focus_x, 0, focus_z))
    
    # Camera setup with longer focal length for detail
    cam_data = bpy.data.cameras.new('CloseupCamera')
    cam_obj = bpy.data.objects.new('CloseupCamera', cam_data)
    bpy.context.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj

    cam_data.type = 'PERSP'
    cam_data.lens = 85  # Portrait lens, less distortion
    
    # Distance to frame slot with margin
    sensor_width = 36.0
    fov = 2 * math.atan(sensor_width / (2 * cam_data.lens))
    distance = (slot_size * 3) / (2 * math.tan(fov / 2))
    
    # Slight angle for depth perception (15° azimuth, 10° elevation)
    azimuth = math.radians(15)
    elevation = math.radians(10)
    
    cam_x = focus_x + math.sin(azimuth) * math.cos(elevation) * distance
    cam_y = -math.cos(azimuth) * math.cos(elevation) * distance
    cam_z = focus_z + math.sin(elevation) * distance
    
    cam_obj.location = (cam_x, cam_y, cam_z)
    
    # Point at focus
    direction = focus_point - cam_obj.location
    cam_obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    
    # Depth of field
    cam_data.dof.use_dof = True
    cam_data.dof.focus_distance = distance
    cam_data.dof.aperture_fstop = 2.8

    print(f"  Close-up focus: ({focus_x:.1f}, {focus_z:.1f}), distance: {distance:.1f}")
    return cam_obj


def setup_animated_camera(meshes: list, frames: int = 90):
    """
    Pivot-based camera orbiting panel. Simulates gallery walk.
    Camera maintains constant distance via pivot rotation.
    """
    # Get panel bounds
    min_coord = Vector((float('inf'), float('inf'), float('inf')))
    max_coord = Vector((float('-inf'), float('-inf'), float('-inf')))

    for mesh in meshes:
        if mesh.name.startswith('section_'):
            for vert in mesh.bound_box:
                world_vert = mesh.matrix_world @ Vector(vert)
                min_coord.x = min(min_coord.x, world_vert.x)
                min_coord.z = min(min_coord.z, world_vert.z)
                max_coord.x = max(max_coord.x, world_vert.x)
                max_coord.z = max(max_coord.z, world_vert.z)

    panel_width = max_coord.x - min_coord.x
    panel_height = max_coord.z - min_coord.z
    max_dimension = max(panel_width, panel_height)

    # Create camera
    cam_data = bpy.data.cameras.new('VideoCamera')
    cam_obj = bpy.data.objects.new('VideoCamera', cam_data)
    bpy.context.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj
    cam_data.type = 'PERSP'
    cam_data.lens = 50
    cam_data.dof.use_dof = False

    # Use SSOT for distance
    distance = get_camera_distance(max_dimension, cam_data.lens)
    distance *= 1.05  # 5% safety buffer for perspective distortion

    # Create focus target (point camera looks at)
    focus_target = bpy.data.objects.new('FocusTarget', None)
    bpy.context.collection.objects.link(focus_target)

    # Create camera pivot (invisible person walking)
    pivot = bpy.data.objects.new('CameraPivot', None)
    bpy.context.collection.objects.link(pivot)
    pivot.location = (0, 0, 0)

    # Parent camera to pivot, place in front
    cam_obj.parent = pivot
    cam_obj.location = (0, -distance, 0)

    # Track-to constraint
    track = cam_obj.constraints.new(type='TRACK_TO')
    track.target = focus_target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'

    # Animation settings
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = frames + 15  # Buffer for ping-pong

    # Gallery walk: ping-pong loop (left -> right -> left)
    mid_frame = (frames + 15) // 2

    # Pivot rotation: -35° -> +35° -> -35°
    pivot.rotation_euler = (0, 0, math.radians(-35))
    pivot.keyframe_insert(data_path='rotation_euler', frame=1)
    pivot.rotation_euler = (0, 0, math.radians(35))
    pivot.keyframe_insert(data_path='rotation_euler', frame=mid_frame)
    pivot.rotation_euler = (0, 0, math.radians(-35))
    pivot.keyframe_insert(data_path='rotation_euler', frame=frames + 15)

    # Focus target: scan 25% width (left -> right -> left)
    focus_target.location = (-panel_width * 0.25, 0, 0)
    focus_target.keyframe_insert(data_path='location', frame=1)
    focus_target.location = (panel_width * 0.25, 0, 0)
    focus_target.keyframe_insert(data_path='location', frame=mid_frame)
    focus_target.location = (-panel_width * 0.25, 0, 0)
    focus_target.keyframe_insert(data_path='location', frame=frames + 15)

    # Smooth interpolation
    for obj in [pivot, focus_target]:
        if obj.animation_data and obj.animation_data.action:
            for fc in obj.animation_data.action.fcurves:
                for kp in fc.keyframe_points:
                    kp.interpolation = 'BEZIER'
                    kp.easing = 'EASE_IN_OUT'

    # Loop-safe settings
    scene.use_preview_range = True
    scene.frame_preview_start = 1
    scene.frame_preview_end = frames

    print(f"  Video: {frames} frames, distance: {distance:.1f}")
    return cam_obj


def setup_turntable(meshes: list, frames: int = 72):
    """
    Camera orbits 360° around stationary panel.
    Panel orientation matches wall view. Outputs PNG sequence with transparency.
    """
    # Get panel bounds (same as wall view)
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

    # Camera pivot at panel center
    pivot = bpy.data.objects.new('CameraPivot', None)
    pivot.location = (center.x, center.y, center.z)
    bpy.context.collection.objects.link(pivot)

    # Camera setup (matches wall view)
    cam_data = bpy.data.cameras.new('TurntableCamera')
    cam_obj = bpy.data.objects.new('TurntableCamera', cam_data)
    bpy.context.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj

    cam_data.type = 'PERSP'
    cam_data.lens = 50

    distance = get_camera_distance(max_dimension, cam_data.lens)

    # Parent camera to pivot, position in front (same as wall view relative position)
    cam_obj.parent = pivot
    cam_obj.location = (0, -distance, 0)
    cam_obj.rotation_euler = (math.radians(90), 0, 0)

    # Animate pivot rotation around Z axis
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = frames

    pivot.rotation_euler = (0, 0, 0)
    pivot.keyframe_insert(data_path='rotation_euler', frame=1)

    pivot.rotation_euler = (0, 0, math.radians(360))
    pivot.keyframe_insert(data_path='rotation_euler', frame=frames + 1)

    # Linear interpolation for constant rotation speed
    if pivot.animation_data and pivot.animation_data.action:
        for fc in pivot.animation_data.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'

    print(f"  Turntable: {frames} frames, camera orbit 360°")
    return cam_obj


def setup_video_render_settings(output_path: str):
    """Configure render settings for video output."""
    scene = bpy.context.scene
    
    scene.render.image_settings.file_format = 'FFMPEG'
    scene.render.ffmpeg.format = 'MPEG4'
    scene.render.ffmpeg.codec = 'H264'
    scene.render.ffmpeg.constant_rate_factor = 'HIGH'
    scene.render.ffmpeg.ffmpeg_preset = 'GOOD'
    scene.render.fps = 30
    
    scene.render.filepath = output_path


def setup_turntable_render_settings(output_path: str):
    """Configure render settings for turntable PNG sequence."""
    scene = bpy.context.scene
    
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '16'
    scene.render.film_transparent = True
    scene.render.fps = 30
    
    # Output path should end with frame number placeholder
    scene.render.filepath = output_path


def setup_render_settings():
    """Configure Cycles render settings with noise reduction."""
    scene = bpy.context.scene
    
    scene.render.engine = 'CYCLES'
    
    # Color management - matches Archetype_Render.blend
    scene.view_settings.view_transform = 'Khronos PBR Neutral'
    scene.view_settings.look = 'Medium Contrast'
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0

    cycles_prefs = bpy.context.preferences.addons['cycles'].preferences
    cycles_prefs.compute_device_type = 'OPTIX'
    cycles_prefs.get_devices()

    for device in cycles_prefs.devices:
        device.use = (device.type == 'OPTIX')

    scene.cycles.device = 'GPU'
    scene.cycles.samples = Config.RENDER_SAMPLES
    
    # Denoising - render and preview
    scene.cycles.use_denoising = Config.USE_DENOISER
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    scene.cycles.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
    scene.cycles.use_preview_denoising = True
    scene.cycles.preview_denoiser = 'AUTO'
    
    # Disable caustics - major noise source with glossy materials
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
    
    # Clamping - reduces fireflies from bright reflections
    scene.cycles.sample_clamp_direct = 0.0
    scene.cycles.sample_clamp_indirect = 10.0

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
        elif argv[i] == '--reverse':
            args['view'] = 'reverse'
            i += 1
        elif argv[i] == '--closeup':
            args['view'] = 'closeup'
            i += 1
        elif argv[i] == '--video':
            args['mode'] = 'video'
            i += 1
        elif argv[i] == '--turntable':
            args['mode'] = 'turntable'
            i += 1
        elif argv[i] == '--all-stills':
            args['batch'] = 'stills'
            i += 1
        elif argv[i] == '--all':
            args['batch'] = 'all'
            i += 1
        elif argv[i] == '--frames':
            args['frames'] = int(argv[i + 1])
            i += 2
        elif argv[i] == '--1k':
            Config.RENDER_WIDTH = Config.RENDER_HEIGHT = 1024
            i += 1
        elif argv[i] == '--2k':
            Config.RENDER_WIDTH = Config.RENDER_HEIGHT = 2048
            i += 1
        elif argv[i] == '--hd':
            Config.RENDER_WIDTH = 1920
            Config.RENDER_HEIGHT = 1080
            i += 1
        elif argv[i] == '--720p':
            Config.RENDER_WIDTH = 1280
            Config.RENDER_HEIGHT = 720
            i += 1
        elif argv[i] == '--draft':
            Config.RENDER_WIDTH = Config.RENDER_HEIGHT = 256
            i += 1
        elif argv[i] == '--lighting':
            args['lighting'] = argv[i + 1]
            i += 2
        elif argv[i] == '--webp':
            args['webp'] = True
            i += 1
        else:
            i += 1

    return args
    
def cleanup_for_batch():
    """Remove cameras and wall between batch renders."""
    for obj in list(bpy.data.objects):
        if obj.type == 'CAMERA' or obj.name in ('Environment_Wall', 'FocusTarget', 'CameraPivot', 'PanelRotator'):
            bpy.data.objects.remove(obj, do_unlink=True)    

def main():
    args = parse_args()

    gltf_path = args.get('gltf')
    config_path = args.get('config')
    output_path = args.get('output', str(Config.OUTPUT_DIR / 'render.png'))
    view = args.get('view', 'wall')
    mode = args.get('mode', 'still')  # 'still', 'video', or 'turntable'
    frames = args.get('frames')

    if not gltf_path:
        print("Usage: blender --background --python render_gltf.py -- --gltf panel.glb --config panel_config.json")
        print("")
        print("STILL SHOTS:")
        print("  --wall        Front view (default)")
        print("  --orthogonal  3/4 angle view")
        print("  --reverse     Back of panel (no wall)")
        print("  --closeup     Slot detail with DOF")
        print("")
        print("ANIMATION:")
        print("  --video       Walkby animation (MP4)")
        print("  --turntable   360° rotation (PNG sequence)")
        print("  --all-stills  Render all 4 still views")
        print("  --all         Render all 6 modes (stills + video + turntable)")
        print("  --frames N    Frame count (default: 90 video, 72 turntable)")
        print("")
        print("OPTIONS:")
        print("  --samples N   Render samples")
        print("  --1k / --2k   Square resolution")
        print("  --hd / --720p Video resolution")
        print("  --lighting X  Preset: gallery, dramatic, detail, soft, natural")
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
    print(f"Mode: {mode}")
    if mode != 'still':
        print(f"Frames: {frames or 'default'}")
    print("=" * 60)

    # Import geometry
    meshes = import_gltf(gltf_path)
    
    # DEBUG: Print all objects and their bounds
    print("=" * 40)
    print("SCENE DIAGNOSTIC")
    print("=" * 40)
    for obj in bpy.context.scene.objects:
        print(f"  {obj.name}: type={obj.type}, loc={obj.location}, scale={obj.scale}")
        if obj.type == 'MESH':
            bbox = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
            min_corner = Vector((min(v.x for v in bbox), min(v.y for v in bbox), min(v.z for v in bbox)))
            max_corner = Vector((max(v.x for v in bbox), max(v.y for v in bbox), max(v.z for v in bbox)))
            print(f"         bounds: min={min_corner}, max={max_corner}")
    print("=" * 40)

    if not meshes:
        print("ERROR: No meshes imported from GLTF")
        return

    # Fix inverted geometry from baked rotations
    force_backing_alignment(meshes)

    # Apply Cycles materials
    apply_materials(meshes, config)

    # Calculate panel size from actual geometry bounds (geometry is in inches)
    all_bounds = []
    for mesh in meshes:
        if mesh.name.startswith('section_'):
            for corner in mesh.bound_box:
                world_corner = mesh.matrix_world @ Vector(corner)
                all_bounds.append(world_corner)
    
    if all_bounds:
        max_extent = max(
            max(abs(v.x) for v in all_bounds),
            max(abs(v.z) for v in all_bounds)
        )
        panel_size = max_extent  # Already in scene units (inches)
    else:
        panel_size = 24  # Fallback
    
    # Setup lighting
    lighting_preset = args.get('lighting', 'gallery')
    setup_lighting(lighting_preset, panel_size)
    
    # Setup render settings (common to all modes)
    setup_render_settings()
    
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    start_time = time.time()

    # Determine render queue
    batch = args.get('batch')
    if batch == 'stills':
        render_queue = [('still', 'wall'), ('still', 'orthogonal'), ('still', 'reverse'), ('still', 'closeup')]
    elif batch == 'all':
        render_queue = [('still', 'wall'), ('still', 'orthogonal'), ('still', 'reverse'), ('still', 'closeup'), ('video', None), ('turntable', None)]
    else:
        render_queue = [(mode, view)]

    for render_mode, render_view in render_queue:
        if batch:
            cleanup_for_batch()
        
        render_start = time.time()
        
        if batch:
            print(f"\n{'='*60}")
            print(f"BATCH: {render_mode} {render_view or ''}")
            print("=" * 60)

        # === VIDEO MODE ===
        if render_mode == 'video':
            video_frames = frames or 90
            create_environment_wall()
            setup_animated_camera(meshes, video_frames)
            
            video_output = output_file.parent / f"{output_file.stem}_video.mp4" if not batch else output_file.parent / "video.mp4"
            setup_video_render_settings(str(video_output))
            
            print("-" * 30)
            print(f"Rendering video: {video_frames} frames...")
            
            bpy.ops.render.render(animation=True)
            
            elapsed = time.time() - render_start
            print(f"Video complete in {elapsed:.2f}s")
            print(f"Output: {video_output}")

        # === TURNTABLE MODE ===
        elif render_mode == 'turntable':
            turntable_frames = frames or 72
            setup_turntable(meshes, turntable_frames)
            
            turntable_output = output_file.parent / f"{output_file.stem}_turn_" if not batch else output_file.parent / "turntable_"
            setup_turntable_render_settings(str(turntable_output))
            
            print("-" * 30)
            print(f"Rendering turntable: {turntable_frames} frames...")
            
            bpy.ops.render.render(animation=True)
            
            elapsed = time.time() - render_start
            print(f"Turntable complete in {elapsed:.2f}s")
            print(f"Output: {turntable_output}0001.png - {turntable_output}{turntable_frames:04d}.png")
            
            # Convert to WebP if requested
            if args.get('webp'):
                import subprocess
                for i in range(1, turntable_frames + 1):
                    png_path = f"{turntable_output}{i:04d}.png"
                    webp_path = f"{turntable_output}{i:04d}.webp"
                    subprocess.run(['ffmpeg', '-y', '-i', png_path, '-quality', '90', webp_path], capture_output=True)
                    Path(png_path).unlink()  # Delete PNG
                print(f"Converted to WebP: {turntable_output}0001.webp - {turntable_output}{turntable_frames:04d}.webp")

        # === STILL MODES ===
        else:
            if render_view in ('wall', 'orthogonal'):
                create_environment_wall()
            
            if render_view == 'reverse':
                setup_camera_reverse(meshes)
            elif render_view == 'closeup':
                setup_camera_closeup(meshes, config)
            else:
                setup_camera(meshes, render_view)
            
            still_output = output_file if not batch else output_file.parent / f"{render_view}.png"
            bpy.context.scene.render.filepath = str(still_output)
            
            print("-" * 30)
            print(f"Rendering {render_view} view...")
            
            bpy.ops.render.render(write_still=True)
            
            elapsed = time.time() - render_start
            print(f"Render complete in {elapsed:.2f}s")
            print(f"Output: {still_output}")

    total_elapsed = time.time() - start_time
    if batch:
        print(f"\n{'='*60}")
        print(f"BATCH COMPLETE: {len(render_queue)} renders in {total_elapsed:.2f}s")
    print("=" * 60)

if __name__ == "__main__":
    main()