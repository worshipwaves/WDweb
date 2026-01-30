from PIL import Image

path = 'public/assets/style/thumbnails/circular_radial_n2_asymmetric.webp'
img = Image.open(path)

# Find bounding box of non-transparent content
bbox = img.getbbox()
cropped = img.crop(bbox)

# Add small padding (1%)
w, h = cropped.size
pad = int(max(w, h) * 0.01)
padded = Image.new('RGBA', (w + pad*2, h + pad*2), (0, 0, 0, 0))
padded.paste(cropped, (pad, pad))

# Resize to 512x512
padded.thumbnail((512, 512), Image.Resampling.LANCZOS)
padded.save(path, 'WEBP', quality=90)
print('Cropped and resized')