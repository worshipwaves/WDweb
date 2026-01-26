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
    
    color = material_props.get('color_rgb', [0, 0, 0])
    r = color[0] / 255 if color[0] > 1 else color[0]
    g = color[1] / 255 if color[1] > 1 else color[1]
    b = color[2] / 255 if color[2] > 1 else color[2]
    if r == 0 and g == 0 and b == 0:
        r = g = b = 0.02
    principled.inputs['Base Color'].default_value = (r, g, b, 1)
    
    pbr = material_props.get('pbr_properties', {})
    principled.inputs['Metallic'].default_value = pbr.get('metallic', 0)
    principled.inputs['Roughness'].default_value = pbr.get('roughness', 0.02)
    
    if pbr.get('clearcoat_intensity', 0) > 0:
        principled.inputs['Coat Weight'].default_value = pbr['clearcoat_intensity']
        principled.inputs['Coat Roughness'].default_value = pbr.get('clearcoat_roughness', 0.05)
    
    links.new(principled.outputs['BSDF'], output.inputs['Surface'])
    
    return mat


def apply_materials(meshes: list, config: dict):
    """
    Apply Cycles materials to imported meshes based on config.
    """
    section_materials = config.get('section_materials', [])
    panel_config = config.get('panel_config', {})
    
    # Debug: Check UV data on meshes
    for mesh in meshes:
        if mesh.name.startswith('section_'):
            uv_layers = mesh.data.uv_layers
            print(f"  {mesh.name} UV layers: {[uv.name for uv in uv_layers]}")
            if uv_layers:
                print(f"    Active UV: {uv_layers.active.name if uv_layers.active else 'NONE'}")
    
    for mesh in meshes:
        if mesh.name.startswith('section_'):
            # Extract section index from name
            try:
                idx = int(mesh.name.split('_')[1])
            except (IndexError, ValueError):
                idx = 0
            
            # Find material config
            mat_config = next(
                (m for m in section_materials if m.get('section_id') == idx),
                {'species': 'walnut-black-american', 'grain_direction': 'vertical'}
            )
            
            # Create and apply wood material
            mat = create_cycles_wood_material(
                mat_config['species'],
                mat_config['grain_direction'],
                idx,
                panel_config
            )
            
            # Clear existing materials and apply new
            mesh.data.materials.clear()
            mesh.data.materials.append(mat)
            
            print(f"Applied {mat_config['species']} ({mat_config['grain_direction']}) to {mesh.name}")
        
        elif mesh.name.startswith('backing_'):
            # Apply backing material
            backing_mat_props = config.get('backing_material', {})
            if backing_mat_props:
                mat = create_backing_material(backing_mat_props)
                mesh.data.materials.clear()
                mesh.data.materials.append(mat)
                print(f"Applied backing material to {mesh.name}")


# ============================================
# SCENE SETUP (Preserved from original)
# ============================================

def setup_hdri_lighting():
    """Setup HDRI environment lighting."""
    world = bpy.context.scene.world
    if world is None:
        world = bpy.data.worlds.new("World")
        bpy.context.scene.world = world
    
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    
    background = nodes.new('ShaderNodeBackground')
    background.location = (0, 0)
    background.inputs['Color'].default_value = (0.5, 0.5, 0.5, 1)
    background.inputs['Strength'].default_value = 0.1
    
    output = nodes.new('ShaderNodeOutputWorld')
    output.location = (200, 0)
    
    links.new(background.outputs['Background'], output.inputs['Surface'])
    
    # Overhead light - simulates window/ceiling, casts shadow below
    bpy.ops.object.light_add(type='AREA', location=(-40, -30, 40))
    key = bpy.context.active_object
    key.name = "Key_Overhead"
    key.data.size = 40
    key.data.energy = 50000
    key.rotation_euler = (math.radians(50), 0, 0)
    
    # Front fill - softens shadows, prevents pure black
    bpy.ops.object.light_add(type='AREA', location=(0, -50, 0))
    fill = bpy.context.active_object
    fill.name = "Front_Fill"
    fill.data.size = 40
    fill.data.energy = 15000
    fill.rotation_euler = (math.radians(90), 0, 0)
    
    # Right fill - balances key light from left
    bpy.ops.object.light_add(type='AREA', location=(40, -30, 20))
    right_fill = bpy.context.active_object
    right_fill.name = "Right_Fill"
    right_fill.data.size = 30
    right_fill.data.energy = 25000
    right_fill.rotation_euler = (math.radians(60), 0, math.radians(-30))
    
    # Key light
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
    
    # Orient for rendering
    orient_for_wall_view(meshes)
    
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
