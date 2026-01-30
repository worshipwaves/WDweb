from PIL import Image

path = 'public/assets/style/thumbnails/circular_radial_n2_asymmetric.webp'
img = Image.open(path)

bbox = img.getbbox()
cropped = img.crop(bbox)

target_content_size = int(512 * 0.95)
w, h = cropped.size
scale = target_content_size / max(w, h)
new_w = int(w * scale)
new_h = int(h * scale)
scaled = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)

final = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
x = (512 - new_w) // 2
y = (512 - new_h) // 2
final.paste(scaled, (x, y))

final.save(path, 'WEBP', quality=90)
print('Done')