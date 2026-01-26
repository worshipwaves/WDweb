"""
Extract Lighting Values from Tuned Scene

Run this in Blender's Python Console (Scripting workspace) after manually tuning lights.
Copy the output to update LIGHTING_PRESETS in render_gltf.py.

USAGE:
    1. Open Scripting workspace in Blender
    2. Open this file or paste contents
    3. Click "Run Script"
    4. Copy output from console
"""

import bpy
import math
from mathutils import Vector


def extract_lighting():
    """Extract lighting parameters from current scene."""
    
    print("\n" + "=" * 60)
    print("EXTRACTED LIGHTING VALUES")
    print("=" * 60)
    
    lights = [obj for obj in bpy.data.objects if obj.type == 'LIGHT']
    
    if not lights:
        print("ERROR: No lights found in scene")
        return
    
    # Find panel center for angle calculations
    panel_center = Vector((0, 0, 0))
    panel_meshes = [obj for obj in bpy.data.objects if obj.type == 'MESH' and obj.name.startswith('section_')]
    
    if panel_meshes:
        all_centers = []
        for mesh in panel_meshes:
            bbox_center = sum((Vector(corner) for corner in mesh.bound_box), Vector()) / 8
            world_center = mesh.matrix_world @ bbox_center
            all_centers.append(world_center)
        panel_center = sum(all_centers, Vector()) / len(all_centers)
    
    print(f"\nPanel center: ({panel_center.x:.2f}, {panel_center.y:.2f}, {panel_center.z:.2f})")
    
    for light in lights:
        print(f"\n--- {light.name} ---")
        
        # Raw values
        print(f"  Location: ({light.location.x:.2f}, {light.location.y:.2f}, {light.location.z:.2f})")
        print(f"  Energy: {light.data.energy:.0f}")
        print(f"  Size: {light.data.size:.2f}")
        print(f"  Color: ({light.data.color.r:.3f}, {light.data.color.g:.3f}, {light.data.color.b:.3f})")
        
        # Calculate angles relative to panel
        relative_pos = light.location - panel_center
        distance = relative_pos.length
        
        # Azimuth: angle in XY plane (0 = front/negative Y, positive = left/positive X)
        azimuth = math.degrees(math.atan2(relative_pos.x, -relative_pos.y))
        
        # Elevation: angle above horizontal
        horizontal_dist = math.sqrt(relative_pos.x**2 + relative_pos.y**2)
        elevation = math.degrees(math.atan2(relative_pos.z, horizontal_dist))
        
        print(f"  Distance: {distance:.2f}")
        print(f"  Azimuth: {azimuth:.1f}°")
        print(f"  Elevation: {elevation:.1f}°")
        print(f"  visible_glossy: {light.visible_glossy}")
    
    # Generate preset code
    print("\n" + "=" * 60)
    print("PRESET CODE (copy to LIGHTING_PRESETS)")
    print("=" * 60)
    
    key_light = next((l for l in lights if 'key' in l.name.lower()), lights[0] if lights else None)
    fill_light = next((l for l in lights if 'fill' in l.name.lower()), lights[1] if len(lights) > 1 else None)
    
    if key_light:
        kp = key_light.location - panel_center
        k_dist = kp.length
        k_az = math.degrees(math.atan2(kp.x, -kp.y))
        k_el = math.degrees(math.atan2(kp.z, math.sqrt(kp.x**2 + kp.y**2)))
        
        print(f"""
    'tuned': {{
        'description': 'Manually tuned preset',
        'key': {{
            'azimuth': {k_az:.0f}, 'elevation': {k_el:.0f}, 'size': {key_light.data.size:.1f},
            'energy_ratio': 1.0, 'visible_glossy': {key_light.visible_glossy}, 'color_temp': 5000,
        }},""")
        
        if fill_light:
            fp = fill_light.location - panel_center
            f_az = math.degrees(math.atan2(fp.x, -fp.y))
            f_el = math.degrees(math.atan2(fp.z, math.sqrt(fp.x**2 + fp.y**2)))
            fill_ratio = fill_light.data.energy / key_light.data.energy if key_light.data.energy > 0 else 0.25
            
            print(f"""        'fill': {{
            'azimuth': {f_az:.0f}, 'elevation': {f_el:.0f}, 'size': {fill_light.data.size:.1f},
            'energy_ratio': {fill_ratio:.2f}, 'visible_glossy': {fill_light.visible_glossy}, 'color_temp': 5500,
        }},
        'ambient_strength': 0.1,
        'base_energy': {key_light.data.energy:.0f},  # Actual energy used
    }},""")
    
    print("\n" + "=" * 60)
    print("NOTES:")
    print("- base_energy is the actual Key_Light energy value")
    print("- Adjust energy_ratio values proportionally if needed")
    print("- Color temp is approximate - actual RGB values shown above")
    print("=" * 60 + "\n")


# Run extraction
extract_lighting()
