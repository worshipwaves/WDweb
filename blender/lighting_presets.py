"""
WaveDesigner Lighting Presets
Drop-in replacement for setup_hdri_lighting() in render_gltf.py

Test standalone:
    blender --background --python lighting_presets.py

Integration:
    1. Copy LIGHTING_PRESETS dict and setup_lighting() function to render_gltf.py
    2. Replace setup_hdri_lighting() call with setup_lighting(preset, panel_size)
    3. Add --lighting argument to parse_args()
"""

import bpy
import math
from mathutils import Vector

# ============================================
# LIGHTING PRESETS
# ============================================

LIGHTING_PRESETS = {
    'gallery': {
        'description': 'Balanced showcase - shadows with full grain visibility',
        'key': {
            'azimuth': 45,          # Degrees from front (positive = left)
            'elevation': 35,        # Degrees above eye level
            'size': 40,             # Area light size (shadow softness)
            'energy_ratio': 1.0,    # Base energy multiplier
            'visible_glossy': True, # Show wood sheen
            'color_temp': 5000,     # Kelvin (neutral daylight)
        },
        'fill': {
            'azimuth': -30,         # Opposite side, lower
            'elevation': 10,
            'size': 60,             # Larger = softer
            'energy_ratio': 0.25,   # 4:1 key-to-fill ratio
            'visible_glossy': False,
            'color_temp': 5500,
        },
        'ambient_strength': 0.1,    # HDRI contribution
    },
    
    'dramatic': {
        'description': 'High contrast - deep shadows, strong highlights',
        'key': {
            'azimuth': 60,
            'elevation': 40,
            'size': 25,             # Smaller = crisper shadows
            'energy_ratio': 1.2,
            'visible_glossy': True,
            'color_temp': 4500,     # Slightly warm
        },
        'fill': {
            'azimuth': -45,
            'elevation': 5,
            'size': 50,
            'energy_ratio': 0.15,   # 6:1 ratio - darker shadows
            'visible_glossy': False,
            'color_temp': 6000,
        },
        'ambient_strength': 0.05,
    },
    
    'detail': {
        'description': 'Texture emphasis - raking light reveals grain',
        'key': {
            'azimuth': 30,
            'elevation': 20,        # Lower angle rakes across surface
            'size': 50,
            'energy_ratio': 0.9,
            'visible_glossy': True,
            'color_temp': 5000,
        },
        'fill': {
            'azimuth': -20,
            'elevation': 15,
            'size': 70,
            'energy_ratio': 0.30,   # 3:1 ratio - open shadows for detail
            'visible_glossy': False,
            'color_temp': 5500,
        },
        'ambient_strength': 0.15,
    },
    
    'soft': {
        'description': 'Even illumination - minimal shadows for reverse/turntable',
        'key': {
            'azimuth': 15,
            'elevation': 45,
            'size': 80,             # Very large = very soft
            'energy_ratio': 0.8,
            'visible_glossy': True,
            'color_temp': 5500,
        },
        'fill': {
            'azimuth': -15,
            'elevation': 30,
            'size': 80,
            'energy_ratio': 0.50,   # 2:1 ratio - nearly flat
            'visible_glossy': False,
            'color_temp': 5500,
        },
        'ambient_strength': 0.2,
    },
    
    'natural': {
        'description': 'Window simulation - realistic interior lighting',
        'key': {
            'azimuth': 50,
            'elevation': 30,
            'size': 60,             # Large window
            'energy_ratio': 1.0,
            'visible_glossy': True,
            'color_temp': 5600,     # Daylight
        },
        'fill': {
            'azimuth': -40,
            'elevation': 20,
            'size': 40,
            'energy_ratio': 0.25,
            'visible_glossy': False,
            'color_temp': 4000,     # Warm bounce from interior
        },
        'ambient_strength': 0.12,
    },
}


def kelvin_to_rgb(kelvin: float) -> tuple:
    """
    Convert color temperature in Kelvin to RGB values.
    Attempt to match common Blender BLACKBODY
    Attempt to match common color temperatures:
        2700K = warm incandescent
        4000K = warm white
        5000K = neutral daylight
        6500K = cool daylight
    """
    temp = kelvin / 100.0
    
    # Red
    if temp <= 66:
        r = 255
    else:
        r = temp - 60
        r = 329.698727446 * (r ** -0.1332047592)
        r = max(0, min(255, r))
    
    # Green
    if temp <= 66:
        g = temp
        g = 99.4708025861 * math.log(g) - 161.1195681661
    else:
        g = temp - 60
        g = 288.1221695283 * (g ** -0.0755148492)
    g = max(0, min(255, g))
    
    # Blue
    if temp >= 66:
        b = 255
    elif temp <= 19:
        b = 0
    else:
        b = temp - 10
        b = 138.5177312231 * math.log(b) - 305.0447927307
        b = max(0, min(255, b))
    
    return (r / 255.0, g / 255.0, b / 255.0)


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
    
    # Ensure Cycles
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
    base_energy = 50000 * (base_distance / 50) ** 2
    
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
    """
    Create positioned area light pointing at origin.
    
    Args:
        azimuth: Horizontal angle in degrees (0=front, positive=left, negative=right)
        elevation: Vertical angle in degrees (0=eye level, positive=above)
        distance: Distance from origin
        size: Area light size (controls shadow softness)
        energy: Light power in watts
        color_temp: Color temperature in Kelvin
        visible_glossy: Whether light appears in glossy reflections
    """
    az_rad = math.radians(azimuth)
    el_rad = math.radians(elevation)
    
    # Spherical to Cartesian (Y is depth axis, negative = in front of wall)
    x = math.sin(az_rad) * math.cos(el_rad) * distance
    y = -math.cos(az_rad) * math.cos(el_rad) * distance
    z = math.sin(el_rad) * distance
    
    bpy.ops.object.light_add(type='AREA', location=(x, y, z))
    light = bpy.context.active_object
    light.name = name
    
    # Light properties
    light.data.size = size
    light.data.energy = energy
    light.data.color = kelvin_to_rgb(color_temp)
    
    # Point at origin (panel center)
    direction = Vector((0, 0, 0)) - light.location
    light.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    
    # Glossy visibility (affects specular reflections on wood)
    light.visible_glossy = visible_glossy
    
    print(f"  {name}: pos=({x:.1f}, {y:.1f}, {z:.1f}), size={size}, energy={energy:.0f}, temp={color_temp}K")


def _setup_world_hdri(ambient_strength: float):
    """
    Setup world shader with masked HDRI.
    HDRI provides ambient fill but is blocked behind wall and in glossy reflections.
    
    Args:
        ambient_strength: HDRI brightness multiplier (0-1)
    """
    world = bpy.context.scene.world
    if world is None:
        world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    
    # Output
    output = nodes.new('ShaderNodeOutputWorld')
    output.location = (900, 0)
    
    # HDRI background
    bg_hdri = nodes.new('ShaderNodeBackground')
    bg_hdri.location = (200, 200)
    bg_hdri.inputs['Strength'].default_value = ambient_strength
    
    # Black background (for masking)
    bg_black = nodes.new('ShaderNodeBackground')
    bg_black.location = (200, -200)
    bg_black.inputs['Color'].default_value = (0, 0, 0, 1)
    
    # Mix shader for rear wall mask
    mix_rear = nodes.new('ShaderNodeMixShader')
    mix_rear.location = (400, 100)
    
    # Mix shader for glossy mask
    mix_glossy = nodes.new('ShaderNodeMixShader')
    mix_glossy.location = (600, 0)
    
    # Texture coordinates for rear mask
    tex_coord = nodes.new('ShaderNodeTexCoord')
    tex_coord.location = (-400, 300)
    
    sep_xyz = nodes.new('ShaderNodeSeparateXYZ')
    sep_xyz.location = (-200, 300)
    
    math_compare = nodes.new('ShaderNodeMath')
    math_compare.location = (0, 300)
    math_compare.operation = 'GREATER_THAN'
    math_compare.inputs[1].default_value = 0  # Y > 0 means behind wall
    
    # Light path for glossy mask
    light_path = nodes.new('ShaderNodeLightPath')
    light_path.location = (400, 300)
    
    # Environment texture
    env_tex = nodes.new('ShaderNodeTexEnvironment')
    env_tex.location = (-100, 200)
    
    # Load HDRI if available
    from pathlib import Path
    hdri_path = Path(__file__).parent / "hdri" / "studio_small_09_4k.exr"
    if hdri_path.exists():
        try:
            env_tex.image = bpy.data.images.load(str(hdri_path))
            print(f"  HDRI loaded: {hdri_path.name}, strength={ambient_strength}")
        except Exception as e:
            print(f"  HDRI load failed: {e}")
    else:
        print(f"  HDRI not found: {hdri_path}")
    
    # Link nodes
    # Rear mask: black behind wall (Y > 0)
    links.new(tex_coord.outputs['Generated'], sep_xyz.inputs['Vector'])
    links.new(sep_xyz.outputs['Y'], math_compare.inputs[0])
    links.new(env_tex.outputs['Color'], bg_hdri.inputs['Color'])
    links.new(math_compare.outputs['Value'], mix_rear.inputs['Fac'])
    links.new(bg_hdri.outputs['Background'], mix_rear.inputs[1])
    links.new(bg_black.outputs['Background'], mix_rear.inputs[2])
    
    # Glossy mask: black in reflections
    links.new(light_path.outputs['Is Glossy Ray'], mix_glossy.inputs['Fac'])
    links.new(mix_rear.outputs['Shader'], mix_glossy.inputs[1])
    links.new(bg_black.outputs['Background'], mix_glossy.inputs[2])
    
    # Output
    links.new(mix_glossy.outputs['Shader'], output.inputs['Surface'])


# ============================================
# STANDALONE TEST
# ============================================
if __name__ == "__main__":
    # Clear scene
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    
    # Add test cube
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    
    # Add wall
    bpy.ops.mesh.primitive_plane_add(size=10, location=(0, 0.5, 0))
    wall = bpy.context.active_object
    wall.rotation_euler = (math.radians(90), 0, 0)
    
    # Test each preset
    for preset in LIGHTING_PRESETS:
        print(f"\n--- Testing preset: {preset} ---")
        setup_lighting(preset, panel_size=1.0)
        
        # Count lights
        lights = [obj for obj in bpy.data.objects if obj.type == 'LIGHT']
        print(f"  Created {len(lights)} lights")
    
    print("\n=== Test complete ===")
