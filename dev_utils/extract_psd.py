#!/usr/bin/env python3
"""
PSD Scene Extractor - Decoupled
Fixes "Dark Sofa" and "Gray Wall" by preventing double-shadowing.
"""

from pathlib import Path
from psd_tools import PSDImage
from PIL import Image
import numpy as np
import json

# ================= CONFIGURATION =================
PSD_PATH = Path(r"C:\Users\paulj\OneDrive\Desktop\Minimalist Home\Minimalist Home.psd")
OUTPUT_DIR = Path(r"C:\Users\paulj\WDweb\public\assets\backgrounds\rooms")
WALL_COLOR = (225, 87, 143) # Pink in segmentation mask

# ================= HELPER FUNCTIONS =================

def extract_layer_by_path(psd, path_parts):
    current = psd
    for part in path_parts:
        found = next((layer for layer in current if layer.name == part), None)
        if not found: return None
        current = found
    return current

def composite_on_white(img_rgba, canvas_size, offset=(0,0)):
    """
    Pastes an RGBA image onto a white canvas.
    Returns RGB image.
    This "Bakes" the transparency so semi-transparent pixels (blankets)
    look bright/correct instead of muddy.
    """
    background = Image.new('RGBA', canvas_size, (255, 255, 255, 255))
    layer_full = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    layer_full.paste(img_rgba, offset)
    composited = Image.alpha_composite(background, layer_full)
    return composited.convert('RGB')

def create_thumbnail(img, output_path):
    thumb = img.copy()
    thumb.thumbnail((400, 400), Image.LANCZOS)
    thumb.save(output_path, optimize=True)

# ================= MAIN LOGIC =================

def extract_room(psd, room_name, output_dir):
    print(f"\nProcessing: {room_name}")
    
    # 1. Setup
    safe_name = room_name.lower().replace(' ', '_').replace('-', '_')
    room_group = extract_layer_by_path(psd, [room_name])
    
    if not room_group:
        print(f"  ERROR: Room group '{room_name}' not found")
        return None
        
    interior_layer = next((l for l in room_group if l.name == 'Interior'), None)
    shadows_layer = next((l for l in room_group if l.name == 'Shadows'), None)
            
    if not interior_layer or not shadows_layer:
        print("  ERROR: Missing 'Interior' or 'Shadows' layer")
        return None

    canvas_size = psd.size

    # 2. Extract Raw Layers
    print("  Extracting layers...")
    int_img_raw = interior_layer.topil()
    shad_img_raw = shadows_layer.topil()

    # 3. Process Foreground (Interior Only)
    # We DO NOT blend shadows here. We want the furniture exactly as rendered.
    print("  Processing Foreground (Decoupled)...")
    
    # We still "composite on white" to fix the halo/muddy edge issue for the blanket
    fg_rgb = composite_on_white(int_img_raw, canvas_size, (interior_layer.left, interior_layer.top))
    
    # Re-apply the original Alpha. 
    # Result: Bright, clean furniture. Opaque White Bookshelf.
    foreground = fg_rgb.convert('RGBA')
    
    # Re-construct the full-size alpha channel for the mask
    alpha_full = Image.new('L', canvas_size, 0)
    alpha_full.paste(int_img_raw.getchannel('A'), (interior_layer.left, interior_layer.top))
    foreground.putalpha(alpha_full)

    # 4. Process Shadow Overlay
    # We prepare this for CSS 'mix-blend-mode: multiply'.
    # For Multiply: White (255) = Transparent/Invisible. Dark = Shadow.
    print("  Processing Shadows...")
    
    shadow_rgb = composite_on_white(shad_img_raw, canvas_size, (shadows_layer.left, shadows_layer.top))
    
    # Optimization: To be absolutely safe, we can mask the shadow layer 
    # to be Pure White where the furniture sits. This prevents any accidental 
    # "Double Darkening" if the shadow layer happens to overlap the sofa.
    shadow_data = np.array(shadow_rgb)
    alpha_data = np.array(alpha_full)
    
    # Where furniture is opaque (alpha > 0), force shadow map to White (invisible in Multiply)
    furniture_mask = alpha_data > 0
    shadow_data[furniture_mask] = [255, 255, 255]
    
    shadow_overlay = Image.fromarray(shadow_data)

    # 5. Save Files
    fg_filename = f"{safe_name}_foreground.png"
    foreground.save(output_dir / fg_filename, optimize=True)
    print(f"  Saved: {fg_filename}")
    
    sh_filename = f"{safe_name}_shadow.png"
    shadow_overlay.save(output_dir / sh_filename, optimize=True)
    print(f"  Saved: {sh_filename}")
    
    # Thumbnail
    thumb_dir = output_dir / 'thumbnails'
    thumb_dir.mkdir(exist_ok=True)
    create_thumbnail(foreground, thumb_dir / f"{safe_name}_thumb.png")

    return {
        'id': safe_name.replace('_', '-'),
        'name': room_name,
        'foreground': fg_filename,
        'shadow': sh_filename,
        'width': canvas_size[0],
        'height': canvas_size[1]
    }

def main():
    if not PSD_PATH.exists():
        print(f"ERROR: File not found: {PSD_PATH}")
        return
    
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    print(f"Loading PSD: {PSD_PATH}")
    psd = PSDImage.open(PSD_PATH)
    
    rooms_to_process = ['Living-room', 'Hallway', 'Fireplace', 'Bedroom']
    results = []
    
    for room_name in rooms_to_process:
        res = extract_room(psd, room_name, OUTPUT_DIR)
        if res: results.append(res)
            
    with open(OUTPUT_DIR / 'rooms_manifest.json', 'w') as f:
        json.dump({'wall_color_rgb': WALL_COLOR, 'rooms': results}, f, indent=2)
        
    print(f"\nDone! Processed {len(results)} rooms.")

if __name__ == "__main__":
    main()