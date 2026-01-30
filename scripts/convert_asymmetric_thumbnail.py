from PIL import Image
import os

path = 'public/assets/style/thumbnails/circular_radial_n2_asymmetric.png'
img = Image.open(path)
img.thumbnail((512, 512), Image.Resampling.LANCZOS)
img.save(path.replace('.png', '.webp'), 'WEBP', quality=90)
os.remove(path)
print('Converted to webp and deleted PNG')