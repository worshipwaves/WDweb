from PIL import Image
import os

thumb_dir = 'public/assets/style/thumbnails'
for filename in os.listdir(thumb_dir):
    if filename.endswith('.png'):
        png_path = os.path.join(thumb_dir, filename)
        webp_path = png_path.replace('.png', '.webp')
        original_size = os.path.getsize(png_path)
        
        img = Image.open(png_path)
        img.thumbnail((512, 512), Image.Resampling.LANCZOS)
        img.save(webp_path, 'WEBP', quality=90, method=6)
        
        new_size = os.path.getsize(webp_path)
        print(f'{filename}: {original_size//1024}KB -> {new_size//1024}KB webp')