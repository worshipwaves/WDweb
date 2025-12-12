#!/usr/bin/env python3
"""
PSD Structure Analyzer for Scene Extraction
Analyzes PSD mockup files to determine layer structure and extraction strategy.
"""

from pathlib import Path
from psd_tools import PSDImage
from psd_tools.constants import BlendMode
import json


def analyze_layer(layer, depth=0):
    """Analyze a single layer and return structured data."""
    indent = "  " * depth
    
    layer_info = {
        "name": layer.name,
        "kind": layer.kind,
        "visible": layer.visible,
        "opacity": layer.opacity,
        "blend_mode": str(layer.blend_mode),
        "bbox": {
            "left": layer.left,
            "top": layer.top,
            "right": layer.right,
            "bottom": layer.bottom,
            "width": layer.width,
            "height": layer.height
        },
        "has_pixels": layer.has_pixels() if hasattr(layer, 'has_pixels') else False,
        "is_group": layer.is_group(),
        "children": []
    }
    
    # Check for smart object
    if hasattr(layer, 'smart_object'):
        so = layer.smart_object
        if so:
            layer_info["smart_object"] = {
                "filename": so.filename if hasattr(so, 'filename') else None,
                "unique_id": so.unique_id if hasattr(so, 'unique_id') else None
            }
    
    # Check for mask
    if layer.mask:
        layer_info["mask"] = {
            "bbox": {
                "left": layer.mask.left,
                "top": layer.mask.top,
                "right": layer.mask.right,
                "bottom": layer.mask.bottom
            }
        }
    
    # Check for effects
    if hasattr(layer, 'effects') and layer.effects:
        layer_info["has_effects"] = True
    
    # Recursively analyze children for groups
    if layer.is_group():
        for child in layer:
            layer_info["children"].append(analyze_layer(child, depth + 1))
    
    return layer_info


def print_layer_tree(layer_info, depth=0):
    """Print layer tree in readable format."""
    indent = "  " * depth
    kind_marker = "[G]" if layer_info["is_group"] else "[L]"
    vis_marker = "✓" if layer_info["visible"] else "✗"
    pixel_marker = "◆" if layer_info["has_pixels"] else "○"
    
    bbox = layer_info["bbox"]
    size_str = f"{bbox['width']}x{bbox['height']}" if bbox['width'] > 0 else "empty"
    
    print(f"{indent}{vis_marker} {kind_marker} {pixel_marker} {layer_info['name']}")
    print(f"{indent}   Size: {size_str}, Blend: {layer_info['blend_mode']}, Opacity: {layer_info['opacity']}")
    
    if "smart_object" in layer_info:
        print(f"{indent}   Smart Object: {layer_info['smart_object'].get('filename', 'embedded')}")
    
    if "mask" in layer_info:
        print(f"{indent}   Has Mask")
    
    if layer_info.get("has_effects"):
        print(f"{indent}   Has Effects")
    
    for child in layer_info["children"]:
        print_layer_tree(child, depth + 1)


def identify_scenes(structure):
    """Identify potential scenes based on layer structure."""
    scenes = []
    
    def find_scenes(layer_info, parent_path=""):
        current_path = f"{parent_path}/{layer_info['name']}" if parent_path else layer_info['name']
        
        # Heuristics for scene detection:
        # 1. Top-level groups are often scenes
        # 2. Groups with names containing scene-related keywords
        # 3. Groups that contain both background and placeholder layers
        
        scene_keywords = ['scene', 'mockup', 'room', 'view', 'frame', 'wall', 'interior']
        name_lower = layer_info['name'].lower()
        
        is_potential_scene = (
            layer_info["is_group"] and 
            (any(kw in name_lower for kw in scene_keywords) or 
             (layer_info["bbox"]["width"] > 1000 and layer_info["bbox"]["height"] > 1000))
        )
        
        if is_potential_scene:
            # Look for smart objects (artwork placeholders)
            placeholders = []
            backgrounds = []
            
            def find_placeholders(info, path=""):
                for child in info.get("children", []):
                    child_path = f"{path}/{child['name']}"
                    if "smart_object" in child:
                        placeholders.append({
                            "name": child["name"],
                            "path": child_path,
                            "bbox": child["bbox"]
                        })
                    if any(bg in child["name"].lower() for bg in ["background", "bg", "wall", "room"]):
                        backgrounds.append({
                            "name": child["name"],
                            "path": child_path
                        })
                    find_placeholders(child, child_path)
            
            find_placeholders(layer_info, current_path)
            
            scenes.append({
                "name": layer_info["name"],
                "path": current_path,
                "bbox": layer_info["bbox"],
                "placeholders": placeholders,
                "backgrounds": backgrounds
            })
        
        for child in layer_info["children"]:
            find_scenes(child, current_path)
    
    for layer in structure:
        find_scenes(layer)
    
    return scenes


def analyze_color_map_layers(structure):
    """Find and analyze color map layers."""
    color_maps = []
    
    def find_color_maps(layer_info, parent_path=""):
        current_path = f"{parent_path}/{layer_info['name']}" if parent_path else layer_info['name']
        name_lower = layer_info['name'].lower()
        
        if 'color' in name_lower and ('map' in name_lower or 'mask' in name_lower):
            color_maps.append({
                "name": layer_info["name"],
                "path": current_path,
                "blend_mode": layer_info["blend_mode"],
                "visible": layer_info["visible"],
                "bbox": layer_info["bbox"]
            })
        
        for child in layer_info["children"]:
            find_color_maps(child, current_path)
    
    for layer in structure:
        find_color_maps(layer)
    
    return color_maps


def main():
    psd_path = Path(r"C:\Users\paulj\WDweb\Minimalist Home.psd")
    
    if not psd_path.exists():
        print(f"ERROR: File not found: {psd_path}")
        return
    
    print(f"Loading PSD: {psd_path}")
    print("=" * 80)
    
    psd = PSDImage.open(psd_path)
    
    # Basic file info
    print(f"\nFile Information:")
    print(f"  Dimensions: {psd.width} x {psd.height}")
    print(f"  Color Mode: {psd.color_mode}")
    print(f"  Bit Depth: {psd.depth} bits")
    print(f"  Channels: {psd.channels}")
    print(f"  Layer Count: {len(list(psd.descendants()))}")
    
    # Analyze structure
    print(f"\n{'=' * 80}")
    print("LAYER STRUCTURE")
    print("Legend: ✓/✗ = visible, [G] = group, [L] = layer, ◆/○ = has pixels")
    print("=" * 80)
    
    structure = []
    for layer in psd:
        layer_info = analyze_layer(layer)
        structure.append(layer_info)
        print_layer_tree(layer_info)
    
    # Identify scenes
    print(f"\n{'=' * 80}")
    print("DETECTED SCENES")
    print("=" * 80)
    
    scenes = identify_scenes(structure)
    if scenes:
        for i, scene in enumerate(scenes, 1):
            print(f"\nScene {i}: {scene['name']}")
            print(f"  Size: {scene['bbox']['width']}x{scene['bbox']['height']}")
            print(f"  Placeholders found: {len(scene['placeholders'])}")
            for p in scene['placeholders']:
                print(f"    - {p['name']} ({p['bbox']['width']}x{p['bbox']['height']})")
            print(f"  Background layers: {len(scene['backgrounds'])}")
            for b in scene['backgrounds']:
                print(f"    - {b['name']}")
    else:
        print("No scenes detected based on standard heuristics.")
        print("Top-level layers may represent individual scenes.")
    
    # Color map analysis
    print(f"\n{'=' * 80}")
    print("COLOR MAP LAYERS")
    print("=" * 80)
    
    color_maps = analyze_color_map_layers(structure)
    if color_maps:
        for cm in color_maps:
            print(f"\n  {cm['name']}")
            print(f"    Blend Mode: {cm['blend_mode']}")
            print(f"    Visible: {cm['visible']}")
    else:
        print("No color map layers detected.")
    
    # Export structure to JSON for further processing
    output_json = psd_path.with_suffix('.structure.json')
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump({
            "file_info": {
                "path": str(psd_path),
                "width": psd.width,
                "height": psd.height,
                "color_mode": str(psd.color_mode),
                "depth": psd.depth,
                "channels": psd.channels
            },
            "structure": structure,
            "scenes": scenes,
            "color_maps": color_maps
        }, f, indent=2, default=str)
    
    print(f"\n{'=' * 80}")
    print(f"Structure exported to: {output_json}")


if __name__ == "__main__":
    main()
