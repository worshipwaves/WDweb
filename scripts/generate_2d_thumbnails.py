# scripts/generate_2d_thumbnails.py
import os
import json
import random
from PIL import Image

# --- CONFIGURATION ---
# We now define two sizes and two output directories
LARGE_THUMBNAIL_SIZE = (1024, 1024)
SMALL_THUMBNAIL_SIZE = (256, 256)

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_TEXTURES_DIR = os.path.join(ROOT_DIR, 'public', 'assets', 'textures', 'wood')
LARGE_OUTPUT_DIR = os.path.join(ROOT_DIR, 'wood_thumbnails_large') # For tooltips
SMALL_OUTPUT_DIR = os.path.join(ROOT_DIR, 'wood_thumbnails_small') # For the grid
CONFIG_FILE = os.path.join(ROOT_DIR, 'config', 'wood_materials.json')
# --- END CONFIGURATION ---

def create_n1_thumbnail(source_image, grain_direction, size):
    """
    Creates an n=1 thumbnail of a specific size.
    """
    width, height = source_image.size
    crop_size = min(width, height) // 2
    left = (width - crop_size) / 2
    top = (height - crop_size) / 2
    right = (width + crop_size) / 2
    bottom = (height + crop_size) / 2
    
    thumb = source_image.crop((left, top, right, bottom))
    
    if grain_direction == 'vertical':
        thumb = thumb.rotate(90, expand=True)
        
    return thumb.resize(size, Image.Resampling.LANCZOS)

def create_n4_thumbnail(source_image, pattern, geometry_constants, size):
    """
    Creates an n=4 thumbnail of a specific size with random crops.
    """
    GAP_INCHES = 0.5
    PANEL_INCHES = 24.0
    
    gap_pixels = int(round((GAP_INCHES / PANEL_INCHES) * size[0]))
    quadrant_pixels = (size[0] - gap_pixels) // 2
    
    final_image = Image.new('RGBA', size, (0, 0, 0, 0))

    if pattern == 'radiant':
        angles = [135, 45, 225, 315]
    else: # diamond
        angles = [45, -45, -45, 45]

    positions = [
        (0, 0),
        (quadrant_pixels + gap_pixels, 0),
        (0, quadrant_pixels + gap_pixels),
        (quadrant_pixels + gap_pixels, quadrant_pixels + gap_pixels),
    ]

    sw, sh = source_image.size
    source_crop_size = int(quadrant_pixels * 1.5)
    if source_crop_size > min(sw, sh):
        source_crop_size = min(sw, sh)

    for i in range(4):
        max_x = sw - source_crop_size
        max_y = sh - source_crop_size
        random_x = random.randint(0, max_x)
        random_y = random.randint(0, max_y)
        
        random_crop = source_image.crop((
            random_x, 
            random_y, 
            random_x + source_crop_size, 
            random_y + source_crop_size
        ))
        
        rotated_image = random_crop.rotate(angles[i], resample=Image.Resampling.BICUBIC, expand=False)
        
        center_x, center_y = rotated_image.size[0] // 2, rotated_image.size[1] // 2
        half_quad = quadrant_pixels // 2
        final_crop = rotated_image.crop(
            (
                center_x - half_quad,
                center_y - half_quad,
                center_x + half_quad,
                center_y + half_quad
            )
        )
        
        final_image.paste(final_crop, positions[i])

    return final_image

def main():
    # Create both output directories
    if not os.path.exists(LARGE_OUTPUT_DIR):
        os.makedirs(LARGE_OUTPUT_DIR)
    if not os.path.exists(SMALL_OUTPUT_DIR):
        os.makedirs(SMALL_OUTPUT_DIR)

    with open(CONFIG_FILE, 'r') as f:
        config = json.load(f)
    
    species_list = config['species_catalog']
    geometry_constants = config['geometry_constants']
    texture_config = config['texture_config']
    
    print(f"Found {len(species_list)} wood species. Generating 2 sizes for 4 patterns each...")

    for species in species_list:
        species_id = species['id']
        wood_number = species['wood_number']
        
        size_info = texture_config['size_map']['large']
        texture_filename = f"wood-{wood_number}_{species_id}-varnished-{size_info['dimensions']}_d.png"
        source_path = os.path.join(INPUT_TEXTURES_DIR, species_id, 'Varnished', size_info['folder'], 'Diffuse', texture_filename)
        
        if not os.path.exists(source_path):
            print(f"  [!] Skipping {species['display']}: Source texture not found.")
            continue
            
        print(f"  Processing {species['display']}...")
        source_image = Image.open(source_path)

        # Generate, resize, and save for each pattern
        try:
            # Horizontal
            large_h = create_n1_thumbnail(source_image, 'horizontal', LARGE_THUMBNAIL_SIZE)
            large_h.save(os.path.join(LARGE_OUTPUT_DIR, f"{species_id}_n1_horizontal.png"))
            small_h = large_h.resize(SMALL_THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
            small_h.save(os.path.join(SMALL_OUTPUT_DIR, f"{species_id}_n1_horizontal.png"))

            # Vertical
            large_v = create_n1_thumbnail(source_image, 'vertical', LARGE_THUMBNAIL_SIZE)
            large_v.save(os.path.join(LARGE_OUTPUT_DIR, f"{species_id}_n1_vertical.png"))
            small_v = large_v.resize(SMALL_THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
            small_v.save(os.path.join(SMALL_OUTPUT_DIR, f"{species_id}_n1_vertical.png"))

            # Radiant
            large_r = create_n4_thumbnail(source_image, 'radiant', geometry_constants, LARGE_THUMBNAIL_SIZE)
            large_r.save(os.path.join(LARGE_OUTPUT_DIR, f"{species_id}_n4_radiant.png"))
            small_r = large_r.resize(SMALL_THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
            small_r.save(os.path.join(SMALL_OUTPUT_DIR, f"{species_id}_n4_radiant.png"))
            
            # Diamond
            large_d = create_n4_thumbnail(source_image, 'diamond', geometry_constants, LARGE_THUMBNAIL_SIZE)
            large_d.save(os.path.join(LARGE_OUTPUT_DIR, f"{species_id}_n4_diamond.png"))
            small_d = large_d.resize(SMALL_THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
            small_d.save(os.path.join(SMALL_OUTPUT_DIR, f"{species_id}_n4_diamond.png"))

        except Exception as e:
            print(f"    [ERROR] Failed to generate thumbnails for {species_id}: {e}")

    print("\nThumbnail generation complete!")
    print(f"Large images (512x512) saved to: {LARGE_OUTPUT_DIR}")
    print(f"Small images (256x256) saved to: {SMALL_OUTPUT_DIR}")

if __name__ == "__main__":
    main()