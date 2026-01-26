"""
Fix Noise Issues in Blender Scene

Addresses:
1. Enable render and preview denoising
2. Fix World shader node connections (hide HDRI from glossy reflections)

Usage:
    blender --background Archetype_Render.blend --python fix_noise.py
    
Or run in Scripting workspace interactively.
"""

import bpy


def enable_denoising():
    """Enable denoising for both render and viewport."""
    scene = bpy.context.scene
    cycles = scene.cycles
    
    # Render denoising
    cycles.use_denoising = True
    cycles.denoiser = 'OPENIMAGEDENOISE'  # or 'OPTIX' if RTX GPU
    cycles.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
    
    # Viewport/preview denoising
    cycles.use_preview_denoising = True
    cycles.preview_denoiser = 'AUTO'
    
    print("[DENOISING] Enabled for render and preview")
    print(f"  Render denoiser: {cycles.denoiser}")
    print(f"  Preview denoiser: {cycles.preview_denoiser}")


def fix_world_shader_nodes():
    """
    Fix World shader to hide HDRI from glossy reflections.
    
    Required node graph:
        Environment Texture → Background (HDRI) ─┬→ Mix Shader → World Output
                                                 │
        Background (Black) ─────────────────────┘
                                                 │
        Light Path (Is Glossy Ray) ─────────────→ Mix Shader (Fac)
    
    When Is Glossy Ray = 1 (glossy bounce), use black background.
    When Is Glossy Ray = 0 (camera/diffuse ray), use HDRI.
    """
    world = bpy.context.scene.world
    
    if not world or not world.use_nodes:
        print("[ERROR] No world or world nodes not enabled")
        return False
    
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    
    # Find existing nodes
    env_tex = None
    bg_hdri = None
    bg_black = None
    light_path = None
    mix_shader = None
    world_output = None
    
    for node in nodes:
        if node.type == 'TEX_ENVIRONMENT':
            env_tex = node
        elif node.type == 'BACKGROUND':
            # Distinguish by color - black vs HDRI-connected
            if node.inputs['Color'].is_linked:
                bg_hdri = node
            elif list(node.inputs['Color'].default_value)[:3] == [0.0, 0.0, 0.0]:
                bg_black = node
            else:
                # Gray background - treat as HDRI background
                bg_hdri = node
        elif node.type == 'LIGHT_PATH':
            light_path = node
        elif node.type == 'MIX_SHADER':
            mix_shader = node
        elif node.type == 'OUTPUT_WORLD':
            world_output = node
    
    print(f"[WORLD NODES] Found:")
    print(f"  Environment Texture: {env_tex is not None}")
    print(f"  Background (HDRI): {bg_hdri is not None}")
    print(f"  Background (Black): {bg_black is not None}")
    print(f"  Light Path: {light_path is not None}")
    print(f"  Mix Shader: {mix_shader is not None}")
    print(f"  World Output: {world_output is not None}")
    
    # Create missing nodes
    if not light_path:
        light_path = nodes.new('ShaderNodeLightPath')
        light_path.location = (-400, 200)
        print("  Created Light Path node")
    
    if not mix_shader:
        mix_shader = nodes.new('ShaderNodeMixShader')
        mix_shader.location = (200, 0)
        print("  Created Mix Shader node")
    
    if not bg_black:
        bg_black = nodes.new('ShaderNodeBackground')
        bg_black.inputs['Color'].default_value = (0.0, 0.0, 0.0, 1.0)
        bg_black.inputs['Strength'].default_value = 1.0
        bg_black.location = (0, -150)
        bg_black.name = "Background_Black"
        print("  Created Black Background node")
    
    if not bg_hdri:
        bg_hdri = nodes.new('ShaderNodeBackground')
        bg_hdri.location = (0, 150)
        bg_hdri.name = "Background_HDRI"
        print("  Created HDRI Background node")
    
    if not world_output:
        world_output = nodes.new('ShaderNodeOutputWorld')
        world_output.location = (400, 0)
        print("  Created World Output node")
    
    # Clear existing links to Mix Shader inputs to rewire cleanly
    links_to_remove = []
    for link in links:
        if link.to_node == mix_shader:
            links_to_remove.append(link)
        elif link.to_node == world_output and link.to_socket.name == 'Surface':
            links_to_remove.append(link)
    
    for link in links_to_remove:
        links.remove(link)
    
    # Wire the node graph
    # 1. Environment Texture → HDRI Background (if env_tex exists)
    if env_tex and bg_hdri:
        # Check if already connected
        if not bg_hdri.inputs['Color'].is_linked:
            links.new(env_tex.outputs['Color'], bg_hdri.inputs['Color'])
            print("  Linked: Environment Texture → HDRI Background")
    
    # 2. HDRI Background → Mix Shader input 1 (Shader slot 1)
    links.new(bg_hdri.outputs['Background'], mix_shader.inputs[1])
    print("  Linked: HDRI Background → Mix Shader [1]")
    
    # 3. Black Background → Mix Shader input 2 (Shader slot 2)
    links.new(bg_black.outputs['Background'], mix_shader.inputs[2])
    print("  Linked: Black Background → Mix Shader [2]")
    
    # 4. Light Path (Is Glossy Ray) → Mix Shader Fac
    links.new(light_path.outputs['Is Glossy Ray'], mix_shader.inputs['Fac'])
    print("  Linked: Light Path (Is Glossy Ray) → Mix Shader (Fac)")
    
    # 5. Mix Shader → World Output
    links.new(mix_shader.outputs['Shader'], world_output.inputs['Surface'])
    print("  Linked: Mix Shader → World Output")
    
    print("[WORLD SHADER] Node connections fixed")
    print("  Effect: HDRI visible to camera/diffuse, black to glossy reflections")
    
    return True


def verify_backing_roughness():
    """Check backing material roughness - too low causes noise."""
    for mat in bpy.data.materials:
        if 'backing' in mat.name.lower():
            if mat.use_nodes:
                for node in mat.node_tree.nodes:
                    if node.type == 'BSDF_PRINCIPLED':
                        roughness = node.inputs['Roughness'].default_value
                        print(f"[MATERIAL] {mat.name}: Roughness = {roughness}")
                        if roughness < 0.3:
                            print(f"  WARNING: Low roughness may cause noise. Consider 0.3-0.5")


def save_blend():
    """Save the modified .blend file."""
    filepath = bpy.data.filepath
    if filepath:
        bpy.ops.wm.save_as_mainfile(filepath=filepath)
        print(f"\n[SAVED] {filepath}")
    else:
        print("\n[WARNING] No filepath - file not saved. Use File > Save As")


def main():
    print("=" * 60)
    print("NOISE FIX SCRIPT")
    print("=" * 60)
    
    enable_denoising()
    print()
    
    fix_world_shader_nodes()
    print()
    
    verify_backing_roughness()
    print()
    
    save_blend()
    
    print("\n" + "=" * 60)
    print("COMPLETE")
    print("=" * 60)
    print("\nTo verify:")
    print("1. Open the .blend file")
    print("2. Switch to Layout workspace")
    print("3. Press Z → Rendered")
    print("4. Noise should be significantly reduced or eliminated")


if __name__ == "__main__":
    main()
