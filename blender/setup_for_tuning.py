"""
WaveDesigner Lighting Setup - Interactive Tuning
Opens Blender GUI with scene ready for manual light adjustment.

USAGE:
    "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" --python setup_for_tuning.py -- --gltf panel_export.glb --config panel_config.json
"""

import bpy
import math
import json
import sys
import time
import random
from pathlib import Path
from mathutils import Vector


# ============================================
# CONFIGURATION
# ============================================

class Config:
    """Paths resolved relative to script location, matching render_gltf.py"""
    BASE_DIR = Path(__file__).parent.resolve()
    TEXTURE_DIR = BASE_DIR.parent / "public" / "assets" / "textures" / "wood"
    HDRI_PATH = BASE_DIR / "hdri" / "studio_small_09_4k.exr"
    WALL_COLOR = (0.8, 0.8, 0.8, 1)
    TEXTURE_SIZE = "Large_400cm"
    USE_VARNISHED = True
    
    @classmethod
    def print_paths(cls):
        """Diagnostic: Print all resolved paths"""
        print("\n" + "=" * 60)
        print("PATH DIAGNOSTICS")
        print("=" * 60)
        print(f"Script location:  {__file__}")
        print(f"BASE_DIR:         {cls.BASE_DIR}")
        print(f"  exists:         {cls.BASE_DIR.exists()}")
        print(f"TEXTURE_DIR:      {cls.TEXTURE_DIR}")
        print(f"  exists:         {cls.TEXTURE_DIR.exists()}")
        print(f"HDRI_PATH:        {cls.HDRI_PATH}")
        print(f"  exists:         {cls.HDRI_PATH.exists()}")
        
        if cls.TEXTURE_DIR.exists():
            species_dirs = [d.name for d in cls.TEXTURE_DIR.iterdir() if d.is_dir()]
            print(f"Available species: {species_dirs[:5]}{'...' if len(species_dirs) > 5 else ''}")
        print("=" * 60 + "\n")


# ============================================
# MATERIALS - Exact copy from render_gltf.py
# ============================================

def find_texture_file(directory: Path, suffix: str) -> Path | None:
    """Find texture file with given suffix."""
    if not directory.exists():
        print(f"    WARNING: Directory does not exist: {directory}")
        return None
    for f in directory.iterdir():
        if f.suffix == '.png' and suffix in f.name:
            return f
    print(f"    WARNING: No {suffix} file in {directory}")
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
    print(f"  Creating material for {species}...")
    
    mat_name = f"wood_{species}_{section_index}"
    mat = bpy.data.materials.new(name=mat_name)
    mat.use_nodes = True
    mat.blend_method = 'OPAQUE'  # Ensure no transparency
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

    # Load textures - build paths
    texture_base = Config.TEXTURE_DIR / species
    size_folder = Config.TEXTURE_SIZE

    if Config.USE_VARNISHED:
        diffuse_path = texture_base / "Varnished" / size_folder / "Diffuse"
    else:
        diffuse_path = texture_base / "Raw" / size_folder / "Diffuse"

    shared_path = texture_base / "Shared_Maps" / size_folder
    
    print(f"    Diffuse path: {diffuse_path}")
    print(f"    Shared path:  {shared_path}")

    # Diffuse
    diffuse_file = find_texture_file(diffuse_path, "_d.png")
    if diffuse_file:
        print(f"    Loading diffuse: {diffuse_file.name}")
        diffuse_tex = nodes.new('ShaderNodeTexImage')
        diffuse_tex.location = (-200, 200)
        try:
            diffuse_tex.image = bpy.data.images.load(str(diffuse_file))
            diffuse_tex.image.colorspace_settings.name = 'sRGB'
            print(f"    Diffuse loaded successfully")
        except Exception as e:
            print(f"    ERROR loading diffuse: {e}")
        diffuse_tex.interpolation = 'Smart'
        diffuse_tex.extension = 'REPEAT'
        links.new(mapping.outputs['Vector'], diffuse_tex.inputs['Vector'])
        links.new(diffuse_tex.outputs['Color'], principled.inputs['Base Color'])
    else:
        print(f"    Using fallback color (no diffuse texture)")
        principled.inputs['Base Color'].default_value = (0.5, 0.3, 0.15, 1)

    # Normal
    normal_file = find_texture_file(shared_path / "Normal", "_n.png")
    if normal_file:
        print(f"    Loading normal: {normal_file.name}")
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
        print(f"    Loading roughness: {roughness_file.name}")
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
    """Create Jet Black Backing Material."""
    mat = bpy.data.materials.new(name='backing_material')
    mat.use_nodes = True
    mat.blend_method = 'OPAQUE'
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (400, 0)

    principled = nodes.new('ShaderNodeBsdfPrincipled')
    principled.location = (0, 0)

    principled.inputs['Base Color'].default_value = (0.0, 0.0, 0.0, 1)
    if 'IOR' in principled.inputs:
        principled.inputs['IOR'].default_value = 1.49
    principled.inputs['Roughness'].default_value = 0.0
    principled.inputs['Metallic'].default_value = 0.0

    links.new(principled.outputs['BSDF'], output.inputs['Surface'])

    return mat


def apply_materials(meshes: list, config: dict):
    """Apply Cycles materials to imported meshes based on config."""
    print("\n" + "-" * 40)
    print("APPLYING MATERIALS")
    print("-" * 40)
    
    section_materials = config.get('section_materials', [])
    panel_config = config.get('panel_config', {})
    backing_mat_props = config.get('backing_material', {})
    
    print(f"Config has {len(section_materials)} section_materials entries")

    for mesh in meshes:
        if mesh.name.startswith('section_'):
            try:
                idx = int(mesh.name.split('_')[1])
            except (IndexError, ValueError):
                idx = 0
            
            mat_config = next(
                (m for m in section_materials if m.get('section_id') == idx),
                {'species': 'walnut-black-american', 'grain_direction': 'vertical'}
            )
            
            print(f"\n{mesh.name}: species={mat_config['species']}, grain={mat_config['grain_direction']}")
            
            mat = create_cycles_wood_material(
                mat_config['species'],
                mat_config['grain_direction'],
                idx,
                panel_config
            )
            
            mesh.data.materials.clear()
            mesh.data.materials.append(mat)
        
        elif 'backing' in mesh.name.lower():
            print(f"\n{mesh.name}: applying black backing")
            mat = create_backing_material(backing_mat_props)
            mesh.data.materials.clear()
            mesh.data.materials.append(mat)
    
    print("-" * 40 + "\n")


# ============================================
# SCENE SETUP
# ============================================

def clear_scene():
    """Remove default objects."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()


def import_gltf(gltf_path: str) -> list:
    """Import GLTF geometry."""
    gltf_path = str(Path(gltf_path).resolve())
    
    print(f"Importing GLTF: {gltf_path}")
    print(f"  exists: {Path(gltf_path).exists()}")
    
    if not Path(gltf_path).exists():
        print(f"ERROR: GLTF not found: {gltf_path}")
        return []
    
    bpy.ops.import_scene.gltf(filepath=gltf_path, import_shading='NORMALS')
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    print(f"Imported {len(meshes)} meshes: {[m.name for m in meshes]}")
    return meshes


def create_wall():
    """Create wall backdrop."""
    bpy.ops.mesh.primitive_plane_add(size=1000, location=(0, 0.5, 0))
    wall = bpy.context.active_object
    wall.name = "Environment_Wall"
    wall.rotation_euler = (math.radians(90), 0, 0)
    
    mat = bpy.data.materials.new(name="Wall_Paint")
    mat.use_nodes = True
    mat.blend_method = 'OPAQUE'
    nodes = mat.node_tree.nodes
    nodes.clear()
    
    output = nodes.new('ShaderNodeOutputMaterial')
    principled = nodes.new('ShaderNodeBsdfPrincipled')
    principled.inputs['Base Color'].default_value = Config.WALL_COLOR
    principled.inputs['Roughness'].default_value = 0.9
    mat.node_tree.links.new(principled.outputs['BSDF'], output.inputs['Surface'])
    wall.data.materials.append(mat)
    
    return wall


def setup_world():
    """Setup world with solid background."""
    world = bpy.context.scene.world
    if world is None:
        world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    
    output = nodes.new('ShaderNodeOutputWorld')
    bg = nodes.new('ShaderNodeBackground')
    bg.inputs['Color'].default_value = Config.WALL_COLOR
    bg.inputs['Strength'].default_value = 1.0
    links.new(bg.outputs['Background'], output.inputs['Surface'])


def create_starter_lights(panel_size: float):
    """Create initial lights for tuning."""
    distance = panel_size * 2
    
    # Key light
    bpy.ops.object.light_add(type='AREA', location=(distance * 0.7, -distance, distance * 0.5))
    key = bpy.context.active_object
    key.name = "Key_Light"
    key.data.size = panel_size * 0.5
    key.data.energy = 500000
    key.data.color = (1.0, 0.95, 0.9)
    direction = Vector((0, 0, 0)) - key.location
    key.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    
    # Fill light
    bpy.ops.object.light_add(type='AREA', location=(-distance * 0.5, -distance * 0.8, distance * 0.2))
    fill = bpy.context.active_object
    fill.name = "Fill_Light"
    fill.data.size = panel_size * 0.8
    fill.data.energy = 150000
    fill.data.color = (0.95, 0.95, 1.0)
    direction = Vector((0, 0, 0)) - fill.location
    fill.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    
    print(f"Created lights: Key_Light (500000), Fill_Light (150000)")


def setup_camera(meshes: list):
    """Position camera to frame geometry."""
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
    max_dim = max(size.x, size.y, size.z)
    
    cam_data = bpy.data.cameras.new('Camera')
    cam_data.lens = 50
    cam_obj = bpy.data.objects.new('Camera', cam_data)
    bpy.context.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj
    
    distance = max_dim * 1.5
    cam_obj.location = (center.x, center.y - distance, center.z)
    cam_obj.rotation_euler = (math.radians(90), 0, 0)
    
    return max_dim


def setup_render_settings():
    """Configure Cycles."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    
    # GPU setup
    try:
        cycles_prefs = bpy.context.preferences.addons['cycles'].preferences
        cycles_prefs.compute_device_type = 'OPTIX'
        cycles_prefs.get_devices()
        for device in cycles_prefs.devices:
            device.use = (device.type == 'OPTIX')
        scene.cycles.device = 'GPU'
        print("Using GPU (OptiX)")
    except Exception as e:
        print(f"GPU setup failed, using CPU: {e}")
    
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    
    # Ensure no film transparency
    scene.render.film_transparent = False


# ============================================
# MAIN
# ============================================

def parse_args():
    args = {}
    if '--' in sys.argv:
        argv = sys.argv[sys.argv.index('--') + 1:]
        i = 0
        while i < len(argv):
            if argv[i] == '--gltf' and i + 1 < len(argv):
                args['gltf'] = argv[i + 1]
                i += 2
            elif argv[i] == '--config' and i + 1 < len(argv):
                args['config'] = argv[i + 1]
                i += 2
            else:
                i += 1
    return args


def main():
    args = parse_args()
    gltf_path = args.get('gltf')
    config_path = args.get('config')
    
    if not gltf_path:
        print("Usage: blender --python setup_for_tuning.py -- --gltf panel.glb --config config.json")
        return
    
    print("=" * 60)
    print("WaveDesigner Lighting Tuning Setup")
    print("=" * 60)
    
    # Print path diagnostics
    Config.print_paths()
    
    clear_scene()
    meshes = import_gltf(gltf_path)
    
    if not meshes:
        print("ERROR: No meshes imported")
        return
    
    # Load config
    config = {}
    if config_path:
        config_file = Path(config_path)
        if not config_file.is_absolute():
            config_file = Path.cwd() / config_path
        
        print(f"Config file: {config_file}")
        print(f"  exists: {config_file.exists()}")
        
        if config_file.exists():
            with open(config_file, 'r') as f:
                config = json.load(f)
            print(f"  section_materials: {len(config.get('section_materials', []))} entries")
        else:
            print("WARNING: Config file not found, using defaults")
    
    apply_materials(meshes, config)
    create_wall()
    setup_world()
    panel_size = setup_camera(meshes)
    create_starter_lights(panel_size)
    setup_render_settings()
    
    print("=" * 60)
    print("SETUP COMPLETE")
    print("=" * 60)
    print("")
    print("NEXT STEPS:")
    print("1. Press Z > Rendered for live preview")
    print("2. Select lights, adjust Energy/Size in Properties panel")
    print("3. Press F12 for full render")
    print("4. Run extract_lighting.py in Scripting workspace when done")
    print("")


if __name__ == "__main__":
    main()
