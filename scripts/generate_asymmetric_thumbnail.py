"""
Generate thumbnail for circular_radial_n2_asymmetric archetype.
Two semi-circles of different sizes (42" and 35") with gap.
"""
from PIL import Image, ImageDraw
import os

OUTPUT_SIZE = 1024
LARGE_RADIUS = 0.44   # 42" relative
SMALL_RADIUS = 0.36   # 35" relative
GAP = 0.03
WOOD_COLOR = (180, 140, 100, 255)  # Warm wood tone

def main():
    size = OUTPUT_SIZE
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    center_y = size // 2
    gap_px = int(GAP * size)
    
    # Large semi-circle on left
    large_r = int(LARGE_RADIUS * size)
    large_cx = size // 2 - gap_px // 2
    draw.pieslice(
        [large_cx - large_r, center_y - large_r, large_cx + large_r, center_y + large_r],
        start=90, end=270, fill=WOOD_COLOR
    )
    
    # Small semi-circle on right
    small_r = int(SMALL_RADIUS * size)
    small_cx = size // 2 + gap_px // 2
    draw.pieslice(
        [small_cx - small_r, center_y - small_r, small_cx + small_r, center_y + small_r],
        start=-90, end=90, fill=WOOD_COLOR
    )
    
    # Output path
    output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 
                              'public', 'assets', 'style', 'thumbnails')
    output_path = os.path.join(output_dir, 'circular_radial_n2_asymmetric.webp')
    
    img.save(output_path, 'WEBP', quality=90)
    print(f'Saved: {output_path}')
    print(f'Size: {os.path.getsize(output_path) // 1024}KB')

if __name__ == '__main__':
    main()