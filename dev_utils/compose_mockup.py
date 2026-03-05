"""
compose_mockup.py
Place artwork renders into room mockup scenes at correct physical scale.

Usage:
    python compose_mockup.py artwork.webp --size 54 --unit in --scene Creative-Mockups/living_room_1
    python compose_mockup.py artwork.png --size 40x60 --unit in --scene BelloMockup/bathroom_1
    python compose_mockup.py artwork.webp --size 54 --unit in --scene Creative-Mockups/living_room_1 \
        --crop "4.5:3 bottom=1731" --crop "16:9 top=205"

Directory structure:
    mockup_layers/
      Vendor/
        room.json           <- scene config
        room/               <- extracted layer PNGs

Requires: Pillow, numpy
Run extract_psd_layers.py first to generate the layer PNGs for each scene.
"""

import argparse
import json
from pathlib import Path
from PIL import Image, ImageChops
import numpy as np

# ── Default paths ─────────────────────────────────────────────────────────
BASE_DIR = Path(r'C:\Users\paulj\WDweb\dev_utils\mockup_layers')
OUTPUT_DIR = Path(r'C:\Users\paulj\WDweb\dev_utils\mockup_outputs')
# ──────────────────────────────────────────────────────────────────────────


def resolve_scene(scene_arg: str) -> tuple[dict, Path]:
    """Resolve vendor/room argument to config dict and layers directory.

    Returns (config_dict, layers_dir)
    """
    parts = scene_arg.replace('\\', '/').split('/')
    if len(parts) != 2:
        raise ValueError(f"Scene must be Vendor/room format. Got: '{scene_arg}'")

    vendor, room = parts
    vendor_dir = BASE_DIR / vendor
    config_path = vendor_dir / f'{room}.json'
    layers_dir = vendor_dir / room

    if not config_path.exists():
        available = []
        if vendor_dir.exists():
            available = [f.stem for f in vendor_dir.glob('*.json')]
        raise FileNotFoundError(
            f"Config not found: {config_path}\n"
            f"Available in {vendor}: {', '.join(available) or 'none'}"
        )

    with open(config_path, 'r') as f:
        config = json.load(f)

    if not layers_dir.exists():
        raise FileNotFoundError(
            f"Layers directory not found: {layers_dir}\n"
            f"Run: python extract_psd_layers.py --scene {scene_arg}"
        )

    print(f"Scene: {config.get('vendor', vendor)}/{config.get('name', room)} "
          f"— {config.get('description', '')}")
    return config, layers_dir


def parse_crop_arg(crop_str: str) -> dict:
    """Parse a crop argument string.

    Format: 'RATIO ANCHOR' e.g. '4.5:3 bottom=1690' or '16:9 top=200'
    """
    parts = crop_str.strip().split()
    if len(parts) < 2:
        raise ValueError(f"Crop format: 'W:H anchor=value' e.g. '4.5:3 bottom=1690'. Got: '{crop_str}'")

    ratio_parts = parts[0].split(':')
    rw, rh = float(ratio_parts[0]), float(ratio_parts[1])

    anchor_parts = parts[1].split('=')
    anchor_side = anchor_parts[0].lower()
    anchor_value = int(anchor_parts[1])

    if anchor_side not in ('top', 'bottom', 'left', 'right'):
        raise ValueError(f"Anchor must be top, bottom, left, or right. Got: '{anchor_side}'")

    name = f"{parts[0].replace(':', 'x')}_{anchor_side}{anchor_value}"
    return {'name': name, 'rw': rw, 'rh': rh,
            'anchor_side': anchor_side, 'anchor_value': anchor_value}


def parse_size(size_str: str, unit: str) -> tuple[float, float]:
    """Parse size string. Accepts '54' (diameter/square) or '100x70' (WxH)."""
    if 'x' in size_str.lower():
        parts = size_str.lower().split('x')
        w, h = float(parts[0]), float(parts[1])
    else:
        w = h = float(size_str)

    if unit == 'in':
        w *= 2.54
        h *= 2.54
    elif unit == 'mm':
        w /= 10
    elif unit == 'cm':
        pass
    else:
        raise ValueError(f"Unknown unit: {unit}")
    return w, h


def to_pixels(cm: float, px_per_in: float) -> int:
    return int(cm * (px_per_in / 2.54))


def load_layer(layers_dir: Path, filename: str) -> Image.Image | None:
    """Load a layer PNG by exact filename or glob pattern."""
    exact = layers_dir / filename
    if exact.exists():
        return Image.open(exact).convert('RGBA')
    for f in layers_dir.glob(filename):
        return Image.open(f).convert('RGBA')
    return None


def load_meta(layers_dir: Path, pattern: str) -> dict:
    """Load metadata from a _meta.txt file."""
    meta = {}
    for f in layers_dir.glob(pattern):
        for line in f.read_text().splitlines():
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                meta[k.strip()] = v.strip()
    return meta


def apply_wall_color(composite: Image.Image, color_hex: str,
                     layers_dir: Path, cfg: dict) -> Image.Image:
    """Tint the wall area with a solid color, preserving texture detail."""
    wall_img = load_layer(layers_dir, 'wall.png')
    meta = load_meta(layers_dir, 'wall_meta.txt')

    if wall_img is None:
        print("  Warning: wall.png not found, skipping wall color")
        return composite

    bx = int(meta.get('bbox_left', cfg['wall_left']))
    by = int(meta.get('bbox_top', cfg['wall_top']))

    color_hex = color_hex.lstrip('#')
    r, g, b = int(color_hex[0:2], 16), int(color_hex[2:4], 16), int(color_hex[4:6], 16)

    wall_region = composite.crop((bx, by, bx + wall_img.width, by + wall_img.height))
    wall_gray = wall_region.convert('L')

    tinted = Image.merge('RGB', (
        Image.eval(wall_gray, lambda v: int(v * r / 255)),
        Image.eval(wall_gray, lambda v: int(v * g / 255)),
        Image.eval(wall_gray, lambda v: int(v * b / 255)),
    )).convert('RGBA')

    if wall_img.mode == 'RGBA':
        tinted.putalpha(wall_img.split()[3])

    composite.paste(tinted, (bx, by), tinted)
    return composite


# ── Blend mode implementations ────────────────────────────────────────────

def blend_multiply(base, overlay, opacity):
    mask = overlay.split()[3]  # overlay alpha = where effect applies
    base_rgb = np.array(base.convert('RGB'), dtype=np.float32)
    over_rgb = np.array(overlay.convert('RGB'), dtype=np.float32)
    alpha = np.array(mask, dtype=np.float32) / 255.0 * opacity
    alpha3 = np.stack([alpha] * 3, axis=-1)
    multiplied = (base_rgb * over_rgb) / 255.0
    result = base_rgb * (1 - alpha3) + multiplied * alpha3
    return Image.fromarray(np.clip(result, 0, 255).astype(np.uint8)).convert('RGBA')


def blend_screen(base, overlay, opacity):
    mask = overlay.split()[3]
    base_rgb = np.array(base.convert('RGB'), dtype=np.float32)
    over_rgb = np.array(overlay.convert('RGB'), dtype=np.float32)
    alpha = np.array(mask, dtype=np.float32) / 255.0 * opacity
    alpha3 = np.stack([alpha] * 3, axis=-1)
    screened = 255.0 - ((255.0 - base_rgb) * (255.0 - over_rgb)) / 255.0
    result = base_rgb * (1 - alpha3) + screened * alpha3
    return Image.fromarray(np.clip(result, 0, 255).astype(np.uint8)).convert('RGBA')


def blend_color_dodge(base, overlay, opacity):
    mask = overlay.split()[3]
    b = np.array(base.convert('RGB'), dtype=np.float32)
    o = np.array(overlay.convert('RGB'), dtype=np.float32)
    alpha = np.array(mask, dtype=np.float32) / 255.0 * opacity
    alpha3 = np.stack([alpha] * 3, axis=-1)
    inv = np.maximum(255.0 - o, 1.0)
    dodged = np.clip((b * 255.0) / inv, 0, 255)
    result = b * (1 - alpha3) + dodged * alpha3
    return Image.fromarray(np.clip(result, 0, 255).astype(np.uint8)).convert('RGBA')


def blend_soft_light(base, overlay, opacity):
    mask = overlay.split()[3]
    b = np.array(base.convert('RGB'), dtype=np.float32) / 255.0
    o = np.array(overlay.convert('RGB'), dtype=np.float32) / 255.0
    alpha = np.array(mask, dtype=np.float32) / 255.0 * opacity
    alpha3 = np.stack([alpha] * 3, axis=-1)
    blended = np.where(o <= 0.5,
                       b - (1 - 2 * o) * b * (1 - b),
                       b + (2 * o - 1) * (np.sqrt(np.maximum(b, 0)) - b))
    result = b * (1 - alpha3) + blended * alpha3
    return Image.fromarray(np.clip(result * 255, 0, 255).astype(np.uint8)).convert('RGBA')


BLEND_MODES = {
    'multiply': blend_multiply,
    'screen': blend_screen,
    'color_dodge': blend_color_dodge,
    'soft_light': blend_soft_light,
}


def apply_fx_layer(composite, layers_dir, fx_def, global_opacity=1.0):
    """Apply a single FX layer with the specified blend mode."""
    fx_img = load_layer(layers_dir, fx_def['file'])
    if fx_img is None:
        print(f"  Warning: {fx_def['file']} not found, skipping")
        return composite

    blend_mode = fx_def.get('blend_mode', 'normal')
    layer_opacity = fx_def.get('opacity', 255) / 255.0
    effective_opacity = layer_opacity * global_opacity

    blend_fn = BLEND_MODES.get(blend_mode)
    if blend_fn:
        result = blend_fn(composite, fx_img, effective_opacity)
        if composite.mode == 'RGBA':
            result.putalpha(composite.split()[3])
        print(f"  Applied: {fx_def['file']} ({blend_mode} @ {effective_opacity:.0%})")
        return result
    else:
        if effective_opacity < 1.0:
            alpha = fx_img.split()[3]
            alpha = Image.eval(alpha, lambda v: int(v * effective_opacity))
            fx_img.putalpha(alpha)
        composite.paste(fx_img, (0, 0), fx_img)
        print(f"  Applied: {fx_def['file']} (normal @ {effective_opacity:.0%})")
        return composite


def generate_crops(composite, art_center, output_dir, base_name, crop_defs):
    """Generate responsive crop variants using anchor-based positioning."""
    results = {}
    cw, ch = composite.size

    for crop in crop_defs:
        ratio = crop['rw'] / crop['rh']
        side = crop['anchor_side']
        anchor = crop['anchor_value']
        name = crop['name']
        cx, cy = art_center

        if side == 'bottom':
            crop_w = min(cw, cw)
            crop_h = int(crop_w / ratio)
            if crop_h > anchor:
                crop_h = anchor
                crop_w = int(crop_h * ratio)
            y1 = anchor - crop_h
            x1 = max(0, min(cx - crop_w // 2, cw - crop_w))

        elif side == 'top':
            crop_w = min(cw, cw)
            crop_h = int(crop_w / ratio)
            if crop_h > (ch - anchor):
                crop_h = ch - anchor
                crop_w = int(crop_h * ratio)
            y1 = anchor
            x1 = max(0, min(cx - crop_w // 2, cw - crop_w))

        elif side == 'left':
            crop_h = min(ch, ch)
            crop_w = int(crop_h * ratio)
            if crop_w > (cw - anchor):
                crop_w = cw - anchor
                crop_h = int(crop_w / ratio)
            x1 = anchor
            y1 = max(0, min(cy - crop_h // 2, ch - crop_h))

        elif side == 'right':
            crop_h = min(ch, ch)
            crop_w = int(crop_h * ratio)
            if crop_w > anchor:
                crop_w = anchor
                crop_h = int(crop_w / ratio)
            x1 = anchor - crop_w
            if x1 < 0:
                x1 = 0
                crop_w = anchor
                crop_h = int(crop_w / ratio)
            y1 = max(0, min(cy - crop_h // 2, ch - crop_h))

        x2 = x1 + crop_w
        y2 = y1 + crop_h
        cropped = composite.crop((x1, y1, x2, y2))
        fname = f'{base_name}_{name}.webp'
        cropped.convert('RGB').save(output_dir / fname, 'WEBP', quality=92)
        results[name] = {'file': fname, 'size': f'{crop_w}x{crop_h}',
                         'region': f'({x1},{y1})->({x2},{y2})'}
        print(f"  {name}: {crop_w}x{crop_h} from ({x1},{y1}) to ({x2},{y2})")

    return results


def compose(artwork_path: str, size_str: str, unit: str = 'in',
            scene_config: dict = None, layers_dir: Path = None,
            wall_color: str | None = None, offset_x: int = 0, offset_y: int = 0,
            fx_opacity: float = 1.0, crop_defs: list[dict] | None = None,
            output_name: str | None = None):
    """Main compositing function."""

    cfg = scene_config
    px_per_in = cfg['px_per_in']
    px_per_cm = px_per_in / 2.54
    canvas_w = cfg['canvas_width']
    canvas_h = cfg['canvas_height']
    wall_top = cfg['wall_top']
    wall_bottom = cfg['wall_bottom']
    wall_cx = cfg['wall_center_x']
    vert_ratio = cfg.get('artwork_vert_ratio', 0.42)

    out = OUTPUT_DIR
    out.mkdir(parents=True, exist_ok=True)

    art_path = Path(artwork_path)
    if output_name is None:
        output_name = art_path.stem

    print(f"\n{'='*60}")
    print(f"Compositing: {art_path.name}")
    print(f"{'='*60}")

    # 1. Load base composite
    print("\n[1] Loading base scene...")
    composite = load_layer(layers_dir, 'composite_clean.png')
    if composite is None:
        raise FileNotFoundError(
            f"composite_clean.png not found in {layers_dir}.\n"
            f"Run extract_psd_layers.py first.")
    if composite.size != (canvas_w, canvas_h):
        canvas = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
        canvas.paste(composite, (0, 0))
        composite = canvas
    print(f"  Scene: {composite.size}")

    # 2. Wall color
    if wall_color:
        print(f"\n[2] Applying wall color: {wall_color}")
        composite = apply_wall_color(composite, wall_color, layers_dir, cfg)
    else:
        print("\n[2] Wall color: default")

    # 3. Pre-artwork FX
    fx_defs = cfg.get('fx_layers', [])
    pre_fx = [fx for fx in fx_defs if fx.get('before_artwork', False)]
    if pre_fx and fx_opacity > 0:
        print(f"\n[3] Applying {len(pre_fx)} pre-artwork FX layer(s)...")
        for fx_def in pre_fx:
            composite = apply_fx_layer(composite, layers_dir, fx_def, fx_opacity)
    else:
        print("\n[3] Pre-artwork FX: none")

    # 4. Load and scale artwork
    print(f"\n[4] Loading artwork: {artwork_path}")
    artwork = Image.open(artwork_path).convert('RGBA')
    print(f"  Source: {artwork.size}, mode={artwork.mode}")

    w_cm, h_cm = parse_size(size_str, unit)
    target_w = to_pixels(w_cm, px_per_in)
    target_h = to_pixels(h_cm, px_per_in)
    print(f"  Physical: {w_cm:.1f}x{h_cm:.1f} cm -> {target_w}x{target_h} px")

    # Auto-trim: scale based on content bounds, not canvas size
    ALPHA_THRESHOLD = 20
    alpha = artwork.split()[3]
    alpha_trimmed = alpha.point(lambda v: 255 if v > ALPHA_THRESHOLD else 0)
    content_bbox = alpha_trimmed.getbbox()
    if content_bbox:
        cb_left, cb_top, cb_right, cb_bottom = content_bbox
        content_w = cb_right - cb_left
        content_h = cb_bottom - cb_top
        print(f"  Content bounds: ({cb_left},{cb_top})->({cb_right},{cb_bottom}) = {content_w}x{content_h}")
    else:
        content_w, content_h = artwork.size
        content_bbox = None
        print(f"  Warning: no alpha content detected, using full canvas")

    art_w, art_h = artwork.size
    scale = min(target_w / content_w, target_h / content_h)
    new_w = int(art_w * scale)
    new_h = int(art_h * scale)
    artwork_scaled = artwork.resize((new_w, new_h), Image.LANCZOS)
    content_scaled_w = int(content_w * scale)
    content_scaled_h = int(content_h * scale)
    print(f"  Scaled canvas: {new_w}x{new_h}, content: {content_scaled_w}x{content_scaled_h}")

    # 5. Position artwork
    wall_h = wall_bottom - wall_top
    art_cy = wall_top + int(wall_h * vert_ratio)
    art_cx = wall_cx
    art_cx += offset_x
    art_cy += offset_y

    if content_bbox:
        content_cx_in_canvas = int((cb_left + cb_right) / 2 * scale)
        content_cy_in_canvas = int((cb_top + cb_bottom) / 2 * scale)
    else:
        content_cx_in_canvas = new_w // 2
        content_cy_in_canvas = new_h // 2

    paste_x = art_cx - content_cx_in_canvas
    paste_y = art_cy - content_cy_in_canvas
    print(f"\n[5] Positioning: content center=({art_cx},{art_cy}), paste=({paste_x},{paste_y})")
    print(f"  Offsets applied: x={offset_x}, y={offset_y}")

    if paste_y + new_h > wall_bottom:
        overlap = paste_y + new_h - wall_bottom
        print(f"  Note: artwork extends {overlap}px ({overlap/px_per_cm:.1f}cm) below wall")
    if paste_y < wall_top:
        overlap = wall_top - paste_y
        print(f"  Note: artwork extends {overlap}px ({overlap/px_per_cm:.1f}cm) above wall top")

    # 6. Composite artwork
    print(f"\n[6] Compositing artwork...")
    composite.paste(artwork_scaled, (paste_x, paste_y), artwork_scaled)

    # 7. Post-artwork FX
    post_fx = [fx for fx in fx_defs if not fx.get('before_artwork', False)]
    if post_fx and fx_opacity > 0:
        print(f"\n[7] Applying {len(post_fx)} post-artwork FX layer(s)...")
        for fx_def in post_fx:
            composite = apply_fx_layer(composite, layers_dir, fx_def, fx_opacity)
    else:
        print("\n[7] Post-artwork FX: none")

    # 8. Foreground layer
    fg_file = cfg.get('foreground_layer')
    if fg_file:
        print(f"\n[8] Applying foreground: {fg_file}")
        fg = load_layer(layers_dir, fg_file)
        if fg:
            composite.paste(fg, (0, 0), fg)
        else:
            print(f"  Warning: {fg_file} not found")
    else:
        print("\n[8] Foreground: none")

    # 9. Save
    print(f"\n[9] Saving...")
    full_path = out / f'{output_name}_full.webp'
    composite.convert('RGB').save(full_path, 'WEBP', quality=92)
    print(f"  -> {full_path}")

    png_path = out / f'{output_name}_full.png'
    composite.convert('RGB').save(png_path, 'PNG')
    print(f"  -> {png_path}")

    # 10. Crops
    if crop_defs:
        print(f"\n[10] Generating {len(crop_defs)} crop(s)...")
        art_center = (art_cx, art_cy)
        generate_crops(composite, art_center, out, output_name, crop_defs)
    else:
        print(f"\n[10] Crops: skipped (use --crop to add)")

    print(f"\n{'='*60}")
    print(f"Done! Output in: {out}")
    print(f"{'='*60}\n")


def compose_nursery_video(artwork_path: str, size_str: str, unit: str = 'in',
                          scene_config: dict = None, layers_dir: Path = None,
                          offset_x: int = 0, offset_y: int = 0,
                          crop_defs: list[dict] | None = None,
                          output_name: str | None = None):
    """Compositor for FrameArtWonderland nursery video mockup PSDs.

    Reads background.png and replace_me_meta.txt from the extracted layers dir.
    Scales artwork to fit the Replace-me slot at Normal blend, centered.
    No wall_top/wall_bottom/px_per_in config fields required — slot bbox drives
    all positioning.

    JSON config fields used:
        active_scene    - 'Scene 1' or 'Scene 2' (set by extractor)
        blend_override  - 'normal' (required for frameless renders)
        canvas_width    - optional, inferred from background.png if absent
        canvas_height   - optional, inferred from background.png if absent
    """
    cfg = scene_config
    out = OUTPUT_DIR
    out.mkdir(parents=True, exist_ok=True)

    art_path = Path(artwork_path)
    if output_name is None:
        output_name = art_path.stem

    active_scene = cfg.get('active_scene', 'Scene 2')
    blend_override = cfg.get('blend_override', 'normal').lower()

    print(f"\n{'='*60}")
    print(f"Compositing (nursery video): {art_path.name}")
    print(f"Active scene: {active_scene}")
    print(f"{'='*60}")

    # ── [1] Background ───────────────────────────────────────────────────
    print("\n[1] Loading background...")
    bg_path = layers_dir / 'background.png'
    if not bg_path.exists():
        raise FileNotFoundError(
            f"background.png not found in {layers_dir}\n"
            f"Run: python extract_psd_layers.py --scene for this scene first.")
    background = Image.open(bg_path).convert('RGBA')
    canvas_w, canvas_h = background.size
    print(f"  background.png: {canvas_w}x{canvas_h}")

    composite = background.copy()

    # ── [2] Slot bbox from metadata ──────────────────────────────────────
    print("\n[2] Reading slot bbox from replace_me_meta.txt...")
    meta = load_meta(layers_dir, 'replace_me_meta.txt')
    if not meta:
        raise FileNotFoundError(
            f"replace_me_meta.txt not found in {layers_dir}\n"
            f"Run extract_psd_layers.py for this scene first.")

    slot_left   = int(meta['bbox_left'])
    slot_top    = int(meta['bbox_top'])
    slot_right  = int(meta['bbox_right'])
    slot_bottom = int(meta['bbox_bottom'])
    slot_w = slot_right  - slot_left
    slot_h = slot_bottom - slot_top

    print(f"  Slot: ({slot_left},{slot_top}) -> ({slot_right},{slot_bottom}) "
          f"= {slot_w}x{slot_h}")
    print(f"  Blend override: {blend_override}")

    # ── [3] Load and scale artwork ───────────────────────────────────────
    print(f"\n[3] Loading artwork: {artwork_path}")
    artwork = Image.open(artwork_path).convert('RGBA')
    aw, ah = artwork.size
    print(f"  Source: {aw}x{ah}")

    # Auto-trim to content bounds so white-background renders scale correctly
    ALPHA_THRESHOLD = 20
    alpha_ch = artwork.split()[3]
    alpha_trimmed = alpha_ch.point(lambda v: 255 if v > ALPHA_THRESHOLD else 0)
    content_bbox = alpha_trimmed.getbbox()

    if content_bbox:
        cb_left, cb_top, cb_right, cb_bottom = content_bbox
        content_w = cb_right - cb_left
        content_h = cb_bottom - cb_top
        print(f"  Content bounds: ({cb_left},{cb_top})->({cb_right},{cb_bottom}) "
              f"= {content_w}x{content_h}")
    else:
        content_w, content_h = aw, ah
        content_bbox = (0, 0, aw, ah)
        print(f"  No alpha trim detected, using full canvas: {content_w}x{content_h}")

    # Scale to fit slot
    scale = min(slot_w / content_w, slot_h / content_h)
    new_w = int(aw * scale)
    new_h = int(ah * scale)
    artwork_scaled = artwork.resize((new_w, new_h), Image.LANCZOS)
    content_scaled_w = int(content_w * scale)
    content_scaled_h = int(content_h * scale)
    print(f"  Scaled canvas: {new_w}x{new_h}, content: {content_scaled_w}x{content_scaled_h}")

    # ── [4] Position: center content within slot ─────────────────────────
    cb_left, cb_top, cb_right, cb_bottom = content_bbox
    content_cx_in_scaled = int((cb_left + cb_right) / 2 * scale)
    content_cy_in_scaled = int((cb_top  + cb_bottom) / 2 * scale)

    slot_cx = slot_left + slot_w // 2
    slot_cy = slot_top  + slot_h // 2

    paste_x = slot_cx - content_cx_in_scaled + offset_x
    paste_y = slot_cy - content_cy_in_scaled + offset_y

    print(f"\n[4] Positioning: slot center=({slot_cx},{slot_cy}), "
          f"paste=({paste_x},{paste_y}), offsets=({offset_x},{offset_y})")

    # Warn if artwork exceeds slot bounds
    if paste_x < slot_left or paste_x + new_w > slot_right:
        print(f"  Note: artwork extends beyond slot horizontal bounds")
    if paste_y < slot_top or paste_y + new_h > slot_bottom:
        print(f"  Note: artwork extends beyond slot vertical bounds")

    # ── [5] Composite ────────────────────────────────────────────────────
    print(f"\n[5] Compositing at {blend_override} blend...")
    composite.paste(artwork_scaled, (paste_x, paste_y), artwork_scaled)

    # ── [6] Save ─────────────────────────────────────────────────────────
    print(f"\n[6] Saving...")
    webp_path = out / f'{output_name}_full.webp'
    png_path  = out / f'{output_name}_full.png'
    composite.convert('RGB').save(webp_path, 'WEBP', quality=92)
    composite.convert('RGB').save(png_path, 'PNG')
    print(f"  -> {webp_path}")
    print(f"  -> {png_path}")

    # ── [7] Crops ────────────────────────────────────────────────────────
    if crop_defs:
        print(f"\n[7] Generating {len(crop_defs)} crop(s)...")
        art_center = (slot_cx + offset_x, slot_cy + offset_y)
        generate_crops(composite, art_center, out, output_name, crop_defs)
    else:
        print(f"\n[7] Crops: skipped (use --crop to add)")

    print(f"\n{'='*60}")
    print(f"Done! Output in: {out}")
    print(f"{'='*60}\n")


# ── Composer dispatch ─────────────────────────────────────────────────────

COMPOSERS = {
    'nursery_video': compose_nursery_video,
}


def main():
    parser = argparse.ArgumentParser(
        description='Compose artwork into room mockup scenes',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python compose_mockup.py artwork.webp --size 54 --unit in --scene Creative-Mockups/living_room_1
  python compose_mockup.py artwork.png --size 40x60 --unit in --scene BelloMockup/bathroom_1
  python compose_mockup.py artwork.webp --size 54 --unit in --scene Creative-Mockups/living_room_1 \\
      --crop "4.5:3 bottom=1731" --crop "16:9 top=205"
  python compose_mockup.py artwork.png --size 54 --unit in --scene Creative-Mockups/living_room_1 \\
      --wall-color "#E8DDD0" --offset-y 100 --fx-opacity 0.5

Crop format:  "W:H anchor=pixel_value"
  Anchors:  top=Y     top edge fixed, extends downward
            bottom=Y  bottom edge fixed, extends upward
            left=X    left edge fixed, extends rightward
            right=X   right edge fixed, extends leftward
  Unanchored axis centers on artwork.
        """
    )

    parser.add_argument('artwork', help='Path to artwork image (PNG, WebP)')
    parser.add_argument('--size', required=True,
                        help='Physical size: "54" (square/diameter) or "40x60" (WxH)')
    parser.add_argument('--unit', choices=['in', 'cm', 'mm'], default='in',
                        help='Size unit (default: in)')
    parser.add_argument('--scene', required=True,
                        help='Vendor/room path (e.g. Creative-Mockups/living_room_1)')
    parser.add_argument('--wall-color', default=None,
                        help='Hex color for wall (e.g. "#E8DDD0")')
    parser.add_argument('--offset-x', type=int, default=0,
                        help='Horizontal offset in pixels (+ = right)')
    parser.add_argument('--offset-y', type=int, default=0,
                        help='Vertical offset in pixels (+ = down)')
    parser.add_argument('--fx-opacity', type=float, default=1.0,
                        help='FX layer opacity 0.0-1.0 (default: 1.0)')
    parser.add_argument('--crop', action='append', dest='crops', default=None,
                        help='Add a crop: "W:H anchor=value" (repeatable)')
    parser.add_argument('--output-name', default=None,
                        help='Base name for output files (default: artwork filename)')

    args = parser.parse_args()

    scene_config, layers_dir = resolve_scene(args.scene)

    crop_defs = None
    if args.crops:
        crop_defs = [parse_crop_arg(c) for c in args.crops]

    # Dispatch to scene-specific composer if defined, otherwise use default
    composer_name = scene_config.get('composer')
    if composer_name and composer_name in COMPOSERS:
        COMPOSERS[composer_name](
            artwork_path=args.artwork,
            size_str=args.size,
            unit=args.unit,
            scene_config=scene_config,
            layers_dir=layers_dir,
            offset_x=args.offset_x,
            offset_y=args.offset_y,
            crop_defs=crop_defs,
            output_name=args.output_name,
        )
    else:
        compose(
            artwork_path=args.artwork,
            size_str=args.size,
            unit=args.unit,
            scene_config=scene_config,
            layers_dir=layers_dir,
            wall_color=args.wall_color,
            offset_x=args.offset_x,
            offset_y=args.offset_y,
            fx_opacity=args.fx_opacity,
            crop_defs=crop_defs,
            output_name=args.output_name,
        )


if __name__ == '__main__':
    main()
