"""
Blender Diagnostic Script
Extracts all render, viewport, world, and material settings for debugging noise issues.

Usage:
    blender --background yourfile.blend --python blender_diagnostic.py > diagnostic_output.txt
    
Or run in Blender's Scripting workspace (interactive).
"""

import bpy
import json
from pathlib import Path


def get_render_settings():
    """Extract Cycles render settings."""
    scene = bpy.context.scene
    cycles = scene.cycles
    render = scene.render
    
    settings = {
        "engine": render.engine,
        "resolution": {
            "x": render.resolution_x,
            "y": render.resolution_y,
            "percentage": render.resolution_percentage
        },
        "sampling": {
            "render_samples": cycles.samples if hasattr(cycles, 'samples') else None,
            "viewport_samples": cycles.preview_samples if hasattr(cycles, 'preview_samples') else None,
            "use_adaptive_sampling": cycles.use_adaptive_sampling,
            "adaptive_threshold": cycles.adaptive_threshold,
            "time_limit": cycles.time_limit if hasattr(cycles, 'time_limit') else None
        },
        "denoising": {
            "use_denoising": cycles.use_denoising,
            "denoiser": cycles.denoiser if hasattr(cycles, 'denoiser') else None,
            "denoising_input_passes": cycles.denoising_input_passes if hasattr(cycles, 'denoising_input_passes') else None,
            "use_preview_denoising": cycles.use_preview_denoising if hasattr(cycles, 'use_preview_denoising') else None,
            "preview_denoiser": cycles.preview_denoiser if hasattr(cycles, 'preview_denoiser') else None
        },
        "light_paths": {
            "max_bounces": cycles.max_bounces,
            "diffuse_bounces": cycles.diffuse_bounces,
            "glossy_bounces": cycles.glossy_bounces,
            "transmission_bounces": cycles.transmission_bounces,
            "volume_bounces": cycles.volume_bounces,
            "transparent_max_bounces": cycles.transparent_max_bounces,
            "caustics_reflective": cycles.caustics_reflective,
            "caustics_refractive": cycles.caustics_refractive
        },
        "clamping": {
            "sample_clamp_direct": cycles.sample_clamp_direct,
            "sample_clamp_indirect": cycles.sample_clamp_indirect
        },
        "color_management": {
            "view_transform": scene.view_settings.view_transform,
            "look": scene.view_settings.look,
            "exposure": scene.view_settings.exposure,
            "gamma": scene.view_settings.gamma,
            "display_device": scene.display_settings.display_device
        },
        "film": {
            "filter_type": cycles.filter_type if hasattr(cycles, 'filter_type') else None,
            "filter_width": cycles.filter_width if hasattr(cycles, 'filter_width') else None,
            "film_transparent": render.film_transparent
        }
    }
    
    return settings


def get_world_settings():
    """Extract world/environment settings."""
    world = bpy.context.scene.world
    
    if not world:
        return {"error": "No world configured"}
    
    settings = {
        "name": world.name,
        "use_nodes": world.use_nodes,
        "ray_visibility": {
            "camera": world.cycles_visibility.camera if hasattr(world, 'cycles_visibility') else None,
            "diffuse": world.cycles_visibility.diffuse if hasattr(world, 'cycles_visibility') else None,
            "glossy": world.cycles_visibility.glossy if hasattr(world, 'cycles_visibility') else None,
            "transmission": world.cycles_visibility.transmission if hasattr(world, 'cycles_visibility') else None,
            "scatter": world.cycles_visibility.scatter if hasattr(world, 'cycles_visibility') else None
        },
        "nodes": []
    }
    
    if world.use_nodes and world.node_tree:
        for node in world.node_tree.nodes:
            node_info = {
                "name": node.name,
                "type": node.type,
                "label": node.label
            }
            
            # Get node-specific settings
            if node.type == 'BACKGROUND':
                node_info["color"] = list(node.inputs['Color'].default_value) if 'Color' in node.inputs else None
                node_info["strength"] = node.inputs['Strength'].default_value if 'Strength' in node.inputs else None
            
            elif node.type == 'TEX_ENVIRONMENT':
                if node.image:
                    node_info["image"] = node.image.name
                    node_info["image_filepath"] = node.image.filepath
                    node_info["colorspace"] = node.image.colorspace_settings.name
            
            elif node.type == 'LIGHT_PATH':
                node_info["outputs"] = [o.name for o in node.outputs]
            
            elif node.type == 'MIX_SHADER':
                node_info["fac"] = node.inputs['Fac'].default_value if 'Fac' in node.inputs else None
            
            settings["nodes"].append(node_info)
    
    return settings


def get_viewport_settings():
    """Extract viewport shading settings from all 3D views."""
    viewports = []
    
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                for space in area.spaces:
                    if space.type == 'VIEW_3D':
                        shading = space.shading
                        viewport_info = {
                            "screen_name": screen.name,
                            "shading_type": shading.type,  # WIREFRAME, SOLID, MATERIAL, RENDERED
                            "light": shading.light if hasattr(shading, 'light') else None,
                            "color_type": shading.color_type if hasattr(shading, 'color_type') else None,
                            "use_scene_lights": shading.use_scene_lights,
                            "use_scene_world": shading.use_scene_world,
                            "use_scene_lights_render": shading.use_scene_lights_render if hasattr(shading, 'use_scene_lights_render') else None,
                            "use_scene_world_render": shading.use_scene_world_render if hasattr(shading, 'use_scene_world_render') else None,
                            "studio_light": shading.studio_light if hasattr(shading, 'studio_light') else None,
                            "studiolight_rotate_z": shading.studiolight_rotate_z if hasattr(shading, 'studiolight_rotate_z') else None,
                            "studiolight_intensity": shading.studiolight_intensity if hasattr(shading, 'studiolight_intensity') else None,
                            "studiolight_background_alpha": shading.studiolight_background_alpha if hasattr(shading, 'studiolight_background_alpha') else None,
                            "studiolight_background_blur": shading.studiolight_background_blur if hasattr(shading, 'studiolight_background_blur') else None,
                        }
                        viewports.append(viewport_info)
    
    return viewports


def get_material_settings():
    """Extract material settings for all materials."""
    materials = []
    
    for mat in bpy.data.materials:
        mat_info = {
            "name": mat.name,
            "use_nodes": mat.use_nodes,
            "blend_method": mat.blend_method if hasattr(mat, 'blend_method') else None,
            "shadow_method": mat.shadow_method if hasattr(mat, 'shadow_method') else None,
            "principled_bsdf": None
        }
        
        if mat.use_nodes and mat.node_tree:
            # Find Principled BSDF node
            for node in mat.node_tree.nodes:
                if node.type == 'BSDF_PRINCIPLED':
                    principled = {
                        "base_color": list(node.inputs['Base Color'].default_value) if 'Base Color' in node.inputs else None,
                        "metallic": node.inputs['Metallic'].default_value if 'Metallic' in node.inputs else None,
                        "roughness": node.inputs['Roughness'].default_value if 'Roughness' in node.inputs else None,
                        "ior": node.inputs['IOR'].default_value if 'IOR' in node.inputs else None,
                        "alpha": node.inputs['Alpha'].default_value if 'Alpha' in node.inputs else None,
                        "specular_ior_level": node.inputs['Specular IOR Level'].default_value if 'Specular IOR Level' in node.inputs else None,
                        "coat_weight": node.inputs['Coat Weight'].default_value if 'Coat Weight' in node.inputs else None,
                        "coat_roughness": node.inputs['Coat Roughness'].default_value if 'Coat Roughness' in node.inputs else None,
                        "emission_strength": node.inputs['Emission Strength'].default_value if 'Emission Strength' in node.inputs else None,
                        "subsurface_weight": node.inputs['Subsurface Weight'].default_value if 'Subsurface Weight' in node.inputs else None,
                        "anisotropic": node.inputs['Anisotropic'].default_value if 'Anisotropic' in node.inputs else None,
                        "anisotropic_rotation": node.inputs['Anisotropic Rotation'].default_value if 'Anisotropic Rotation' in node.inputs else None,
                    }
                    mat_info["principled_bsdf"] = principled
                    
                    # Check for connected textures
                    connected_inputs = []
                    for inp in node.inputs:
                        if inp.is_linked:
                            connected_inputs.append(inp.name)
                    mat_info["connected_texture_inputs"] = connected_inputs
                    break
        
        materials.append(mat_info)
    
    return materials


def get_light_settings():
    """Extract light settings."""
    lights = []
    
    for obj in bpy.data.objects:
        if obj.type == 'LIGHT':
            light = obj.data
            light_info = {
                "name": obj.name,
                "type": light.type,
                "color": list(light.color),
                "energy": light.energy,
                "location": list(obj.location),
                "rotation": list(obj.rotation_euler),
            }
            
            if light.type == 'AREA':
                light_info["size"] = light.size
                light_info["size_y"] = light.size_y if hasattr(light, 'size_y') else None
                light_info["shape"] = light.shape
            
            if hasattr(light, 'use_shadow'):
                light_info["use_shadow"] = light.use_shadow
            
            if hasattr(light, 'cycles'):
                light_info["cycles_cast_shadow"] = light.cycles.cast_shadow if hasattr(light.cycles, 'cast_shadow') else None
                light_info["cycles_max_bounces"] = light.cycles.max_bounces if hasattr(light.cycles, 'max_bounces') else None
            
            lights.append(light_info)
    
    return lights


def get_workspace_viewport_modes():
    """Get the shading mode for each workspace's 3D viewport."""
    workspace_modes = {}
    
    for workspace in bpy.data.workspaces:
        for screen in workspace.screens:
            for area in screen.areas:
                if area.type == 'VIEW_3D':
                    for space in area.spaces:
                        if space.type == 'VIEW_3D':
                            workspace_modes[workspace.name] = {
                                "shading_type": space.shading.type,
                                "use_scene_lights": space.shading.use_scene_lights,
                                "use_scene_world": space.shading.use_scene_world,
                            }
                            break
    
    return workspace_modes


def run_diagnostic():
    """Run full diagnostic and print results."""
    diagnostic = {
        "blender_version": ".".join(str(x) for x in bpy.app.version),
        "blend_file": bpy.data.filepath,
        "render_settings": get_render_settings(),
        "world_settings": get_world_settings(),
        "workspace_viewport_modes": get_workspace_viewport_modes(),
        "viewport_settings": get_viewport_settings(),
        "materials": get_material_settings(),
        "lights": get_light_settings()
    }
    
    print("=" * 80)
    print("BLENDER DIAGNOSTIC OUTPUT")
    print("=" * 80)
    print()
    
    # Pretty print JSON
    output = json.dumps(diagnostic, indent=2, default=str)
    print(output)
    
    print()
    print("=" * 80)
    print("KEY ITEMS TO CHECK FOR NOISE ISSUES:")
    print("=" * 80)
    
    # Highlight key settings
    rs = diagnostic["render_settings"]
    ws = diagnostic["world_settings"]
    
    print(f"\n[SAMPLING]")
    print(f"  Render samples: {rs['sampling']['render_samples']}")
    print(f"  Viewport samples: {rs['sampling']['viewport_samples']}")
    print(f"  Denoising enabled: {rs['denoising']['use_denoising']}")
    print(f"  Preview denoising: {rs['denoising'].get('use_preview_denoising', 'N/A')}")
    
    print(f"\n[CLAMPING]")
    print(f"  Direct clamp: {rs['clamping']['sample_clamp_direct']}")
    print(f"  Indirect clamp: {rs['clamping']['sample_clamp_indirect']}")
    
    print(f"\n[CAUSTICS]")
    print(f"  Reflective: {rs['light_paths']['caustics_reflective']}")
    print(f"  Refractive: {rs['light_paths']['caustics_refractive']}")
    
    print(f"\n[WORLD RAY VISIBILITY]")
    if ws.get('ray_visibility'):
        rv = ws['ray_visibility']
        print(f"  Camera: {rv.get('camera')}")
        print(f"  Diffuse: {rv.get('diffuse')}")
        print(f"  Glossy: {rv.get('glossy')}")
    
    print(f"\n[WORKSPACE VIEWPORT MODES]")
    for ws_name, mode in diagnostic["workspace_viewport_modes"].items():
        print(f"  {ws_name}: {mode['shading_type']} (scene_lights={mode['use_scene_lights']}, scene_world={mode['use_scene_world']})")
    
    print(f"\n[BACKING MATERIALS]")
    for mat in diagnostic["materials"]:
        if "backing" in mat["name"].lower():
            pbsdf = mat.get("principled_bsdf", {})
            print(f"  {mat['name']}:")
            print(f"    Roughness: {pbsdf.get('roughness')}")
            print(f"    Base Color: {pbsdf.get('base_color')}")
            print(f"    Metallic: {pbsdf.get('metallic')}")
            print(f"    Coat Weight: {pbsdf.get('coat_weight')}")
    
    return diagnostic


if __name__ == "__main__":
    run_diagnostic()
