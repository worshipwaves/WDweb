"""
extract_psd_layers.py
Run once per scene to export key layers from a mockup PSD as individual PNGs.
These PNGs are used by compose_mockup.py for fast, repeated compositing.

Usage:
    python extract_psd_layers.py --scene Creative-Mockups/living_room_1
    python extract_psd_layers.py --scene BelloMockup/bathroom_1
    python extract_psd_layers.py --scene FrameArtWonderland/nursery_3_mobile
    python extract_psd_layers.py --scene FrameArtWonderland/nursery_3_square

Directory structure:
    mockup_layers/
      Vendor/
        room.psd            <- source PSD
        room.json           <- scene config (must contain "extractor" field)
        room/               <- extracted layer PNGs (created by this script)

Requires: psd-tools, Pillow
"""

import argparse
import json
from pathlib import Path
from psd_tools import PSDImage
from PIL import Image

# ── Base directory ────────────────────────────────────────────────────────
BASE_DIR = Path(r'C:\Users\paulj\WDweb\dev_utils\mockup_layers')
# ──────────────────────────────────────────────────────────────────────────


def save_meta(path: Path, **kwargs):
    """Write key=value metadata file."""
    with open(path, 'w') as f:
        for k, v in kwargs.items():
            f.write(f"{k}={v}\n")


def pad_to_canvas(img, bbox, canvas_w, canvas_h):
    """Paste a cropped layer image onto a full-size transparent canvas at its bbox position."""
    canvas = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
    canvas.paste(img, (bbox[0], bbox[1]))
    return canvas


def resolve_scene(scene_arg: str) -> tuple[dict, Path, Path]:
    """Resolve Vendor/room argument to config, PSD path, and output dir."""
    parts = scene_arg.replace('\\', '/').split('/')
    if len(parts) != 2:
        raise ValueError(f"Scene must be Vendor/room format. Got: '{scene_arg}'")

    vendor, room = parts
    vendor_dir = BASE_DIR / vendor
    config_path = vendor_dir / f'{room}.json'

    if not config_path.exists():
        available = []
        if vendor_dir.exists():
            available = [f.stem for f in vendor_dir.glob('*.json')]
        vendors = [d.name for d in BASE_DIR.iterdir() if d.is_dir()]
        raise FileNotFoundError(
            f"Config not found: {config_path}\n"
            f"Available in {vendor}: {', '.join(available) or 'none'}\n"
            f"Vendors: {', '.join(vendors) or 'none'}"
        )

    with open(config_path, 'r') as f:
        config = json.load(f)

    psd_file = config.get('psd_file', f'{room}.psd')
    psd_path = vendor_dir / psd_file
    layers_dir = vendor_dir / room

    return config, psd_path, layers_dir


# ── Extractors ────────────────────────────────────────────────────────────

def extract_scene31(psd: PSDImage, out: Path, config: dict):
    """Extractor for Creative-Mockups type PSDs.

    Expected structure:
        Masks (group) - Color Fill layers with Multiply blend
        Render (pixel) - Base 3D room render
        Smart Objects > Wall - Wall texture/color layer
        FRAMES OPEN AND CHOOSE (group) - Frame variants (all hidden)
        FX (group) - Lighting effects
    """
    print("\n[1/5] Exporting full composite (no frames)...")
    composite = psd.composite()
    composite.save(out / 'composite_clean.png')
    print(f"  -> composite_clean.png ({composite.size})")

    for layer in psd:
        if layer.kind == 'pixel' and layer.name == 'Render':
            print("\n[2/5] Exporting base Render layer...")
            img = layer.composite()
            img.save(out / 'render_base.png')
            print(f"  -> render_base.png (bbox={layer.bbox})")

        if layer.is_group() and layer.name == 'Smart Objects':
            for child in layer:
                if child.name == 'Wall':
                    print("\n[3/5] Exporting Wall layer...")
                    img = child.composite()
                    img.save(out / 'wall.png')
                    print(f"  -> wall.png (bbox={child.bbox})")
                    save_meta(out / 'wall_meta.txt',
                              bbox_left=child.bbox[0], bbox_top=child.bbox[1],
                              bbox_right=child.bbox[2], bbox_bottom=child.bbox[3])

        if layer.is_group() and layer.name == 'FX':
            print("\n[4/5] Exporting FX layers...")
            for i, child in enumerate(layer):
                img = child.composite()
                fname = f'fx_{i}_{child.name.replace(" ", "_")}.png'
                img.save(out / fname)
                blend = getattr(child, 'blend_mode', 'unknown')
                opacity = getattr(child, 'opacity', 255)
                print(f"  -> {fname} (blend={blend}, opacity={opacity}, bbox={child.bbox})")
                save_meta(out / f'fx_{i}_meta.txt',
                          name=child.name, blend_mode=blend, opacity=opacity,
                          bbox_left=child.bbox[0], bbox_top=child.bbox[1],
                          bbox_right=child.bbox[2], bbox_bottom=child.bbox[3])

        if layer.is_group() and layer.name == 'Masks':
            print("\n[5/5] Exporting Masks layers...")
            for i, child in enumerate(layer):
                img = child.composite()
                fname = f'mask_{i}_{child.name.replace(" ", "_")}.png'
                img.save(out / fname)
                blend = getattr(child, 'blend_mode', 'unknown')
                opacity = getattr(child, 'opacity', 255)
                print(f"  -> {fname} (blend={blend}, opacity={opacity}, bbox={child.bbox})")
                save_meta(out / f'mask_{i}_meta.txt',
                          name=child.name, blend_mode=blend, opacity=opacity,
                          bbox_left=child.bbox[0], bbox_top=child.bbox[1],
                          bbox_right=child.bbox[2], bbox_bottom=child.bbox[3])


def extract_bathroom(psd: PSDImage, out: Path, config: dict):
    """Extractor for BelloMockup type PSDs.

    Expected structure:
        space (pixel) - Room background
        Frame groups (ratio-named, e.g. '4x5 frame') - each contains:
            shadow (x2, smartobject) - Multiply @ 255
            adjustable frame (group) - artwork smart object
            unnamed pixel - Normal (wall area)
            unnamed pixel - Normal (floor reflection)
            unnamed curves - Color Dodge @ 64 (window light)
            unnamed pixel - Multiply @ 255 (wall shadow)
        foreground (pixel) - Furniture overlay
        delete this layer (pixel) - placeholder
    """
    print("\n[1/5] Exporting composite (clean background)...")
    space_layer = None
    foreground_layer = None
    active_frame_group = None

    for layer in psd:
        if layer.kind == 'pixel' and layer.name == 'space':
            space_layer = layer
        elif layer.kind == 'pixel' and layer.name == 'foreground':
            foreground_layer = layer
        elif layer.is_group() and 'frame' in layer.name and layer.visible:
            active_frame_group = layer

    cw, ch = psd.width, psd.height

    # Build composite_clean from space + Normal-blend pixel layers inside frame group.
    # The Normal layers (wall area, floor reflection) are scene elements baked into each
    # frame group — they complete the room background but aren't FX or artwork.
    if space_layer:
        composite = space_layer.composite()
        # space may be smaller than canvas — pad if needed
        if composite.size != (cw, ch):
            composite = pad_to_canvas(composite, space_layer.bbox, cw, ch)
        print(f"  space layer: {composite.size}")
    else:
        composite = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        print("  Warning: no 'space' layer found, starting from blank canvas")

    # Find a frame group to pull scene layers from
    frame_group = active_frame_group
    if frame_group is None:
        for layer in psd:
            if layer.is_group() and 'frame' in layer.name:
                frame_group = layer
                break

    # Composite Normal-blend pixel layers from frame group onto space
    if frame_group:
        for child in frame_group:
            if child.kind != 'pixel':
                continue
            blend = str(getattr(child, 'blend_mode', '')).lower()
            # Normal blend = scene element (wall area or floor reflection)
            if 'normal' in blend:
                child_img = child.composite()
                child_img = pad_to_canvas(child_img, child.bbox, cw, ch)
                composite.paste(child_img, (0, 0), child_img)
                print(f"  + Normal layer: bbox={child.bbox}, size={child.size}")

    composite.save(out / 'composite_clean.png')
    print(f"  -> composite_clean.png ({composite.size})")

    # Extract FX from frame group (all groups have identical FX layers)
    if frame_group:
        print(f"\n[2/5] Extracting FX from '{frame_group.name}' group...")
        cw, ch = psd.width, psd.height
        unnamed_idx = 0
        for child in frame_group:
            if child.kind in ('smartobject', 'curves') or child.is_group():
                continue
            if child.kind == 'pixel':
                blend = getattr(child, 'blend_mode', 'unknown')
                opacity = getattr(child, 'opacity', 255)
                blend_str = str(blend).lower()

                if 'color_dodge' in blend_str:
                    fname = 'window_light.png'
                    label = 'window_light'
                elif 'multiply' in blend_str:
                    fname = 'wall_shadow.png'
                    label = 'wall_shadow'
                elif 'normal' in blend_str:
                    # Scene element already baked into composite_clean
                    continue
                else:
                    fname = f'fx_{unnamed_idx}_unnamed.png'
                    label = f'fx_{unnamed_idx}'
                    unnamed_idx += 1

                img = child.composite()
                img = pad_to_canvas(img, child.bbox, cw, ch)
                img.save(out / fname)
                print(f"  -> {fname} (blend={blend}, opacity={opacity}, "
                      f"bbox={child.bbox}, padded to {cw}x{ch})")
                save_meta(out / f'{label}_meta.txt',
                          name=label, blend_mode=blend, opacity=opacity,
                          bbox_left=child.bbox[0], bbox_top=child.bbox[1],
                          bbox_right=child.bbox[2], bbox_bottom=child.bbox[3])

    # Foreground
    if foreground_layer:
        print("\n[3/5] Exporting foreground layer...")
        cw, ch = psd.width, psd.height
        img = foreground_layer.composite()
        img = pad_to_canvas(img, foreground_layer.bbox, cw, ch)
        img.save(out / 'foreground.png')
        print(f"  -> foreground.png (bbox={foreground_layer.bbox}, padded to {cw}x{ch})")
        save_meta(out / 'foreground_meta.txt',
                  bbox_left=foreground_layer.bbox[0], bbox_top=foreground_layer.bbox[1],
                  bbox_right=foreground_layer.bbox[2], bbox_bottom=foreground_layer.bbox[3])
    else:
        print("\n[3/5] No foreground layer found")

    # Shadows
    if frame_group:
        print("\n[4/5] Exporting shadow layers...")
        cw, ch = psd.width, psd.height
        shadow_idx = 0
        for child in frame_group:
            if child.kind == 'smartobject' and child.name == 'shadow':
                img = child.composite()
                img = pad_to_canvas(img, child.bbox, cw, ch)
                fname = f'shadow_{shadow_idx}.png'
                img.save(out / fname)
                blend = getattr(child, 'blend_mode', 'unknown')
                opacity = getattr(child, 'opacity', 255)
                print(f"  -> {fname} (blend={blend}, opacity={opacity}, "
                      f"bbox={child.bbox}, padded to {cw}x{ch})")
                save_meta(out / f'shadow_{shadow_idx}_meta.txt',
                          name='shadow', blend_mode=blend, opacity=opacity,
                          bbox_left=child.bbox[0], bbox_top=child.bbox[1],
                          bbox_right=child.bbox[2], bbox_bottom=child.bbox[3])
                shadow_idx += 1

    print("\n[5/5] Extraction complete.")


def extract_nursery_video(psd: PSDImage, out: Path, config: dict):
    """Extractor for FrameArtWonderland nursery video mockup PSDs.

    PSD structure (mobile 1080x1920, square variant proportionally larger):
        Animation-mobile  (smartobject, Normal)  - full-canvas rasterized video frame
        Scene 2           (group)
            Replace-me    (smartobject, Multiply) - artwork slot, bbox (153,431,924,1517)
        Scene 1           (group)
            Replace-me    (smartobject, Multiply) - artwork slot, bbox (337,430,744,1005)

    There are no separate FX, shadow, foreground, or lighting layers.
    The entire scene — including ambient nursery lighting and wall texture — is
    baked into the Animation smart object rasterization.

    Outputs:
        background.png          - rasterized Animation layer (full canvas, RGB)
        replace_me_meta.txt     - bbox and blend of the active scene's Replace-me slot
        scene_1_replace_me_meta.txt  - bbox and blend for Scene 1 slot (smaller)
        scene_2_replace_me_meta.txt  - bbox and blend for Scene 2 slot (larger)

    Compositing note:
        Replace-me layers use Multiply blend. For a frameless render composited at
        Normal blend, set blend_override=normal in the scene JSON. The background
        will show the nursery wall with no frame surround added on top.
    """
    cw, ch = psd.width, psd.height
    print(f"\nCanvas: {cw}x{ch}")

    # ── [1/3] Background ─────────────────────────────────────────────────
    print("\n[1/3] Exporting background (Animation smart object)...")

    animation_layer = None
    for layer in psd:
        if layer.name in ('Animation-mobile', 'Animation-square', 'Animation'):
            animation_layer = layer
            break
        # Fallback: first smartobject at Normal blend covering full canvas
        if (not animation_layer
                and hasattr(layer, 'kind') and layer.kind == 'type' or True):
            blend = str(getattr(layer, 'blend_mode', '')).lower()
            bbox = getattr(layer, 'bbox', None)
            if (bbox and bbox[0] == 0 and bbox[1] == 0
                    and bbox[2] == cw and bbox[3] == ch
                    and 'normal' in blend):
                animation_layer = layer

    if animation_layer is None:
        # Last resort: composite the whole PSD with Replace-me layers hidden
        print("  Warning: Animation layer not found by name. "
              "Compositing full PSD as background fallback.")
        bg = psd.composite()
    else:
        print(f"  Found: '{animation_layer.name}' (kind={animation_layer.kind}, "
              f"bbox={animation_layer.bbox})")
        bg = animation_layer.composite()

    # Ensure RGB — video frame has no meaningful alpha
    bg = bg.convert('RGBA')
    if bg.size != (cw, ch):
        bg = pad_to_canvas(bg, animation_layer.bbox, cw, ch)

    bg.save(out / 'background.png')
    print(f"  -> background.png ({bg.size})")
    save_meta(out / 'background_meta.txt',
              blend_mode='normal', opacity=255,
              bbox_left=0, bbox_top=0, bbox_right=cw, bbox_bottom=ch)

    # ── [2/3] Replace-me slots ───────────────────────────────────────────
    print("\n[2/3] Locating Replace-me slots in Scene groups...")

    scenes = {}  # {'Scene 1': layer, 'Scene 2': layer}

    for layer in psd:
        if not layer.is_group():
            continue
        name = layer.name
        if not (name.startswith('Scene') or 'scene' in name.lower()):
            continue
        for child in layer:
            if child.name == 'Replace-me':
                scenes[name] = child
                blend = str(getattr(child, 'blend_mode', 'unknown'))
                opacity = getattr(child, 'opacity', 255)
                print(f"  Found '{name}' -> Replace-me: "
                      f"bbox={child.bbox}, blend={blend}, opacity={opacity}")

    if not scenes:
        print("  ERROR: No Scene groups with Replace-me layers found.")
        print("  Check layer names in the PSD match 'Scene N' / 'Replace-me'.")
        return

    # Save per-scene metadata
    for scene_name, replace_layer in scenes.items():
        safe = scene_name.lower().replace(' ', '_')
        blend = str(getattr(replace_layer, 'blend_mode', 'multiply'))
        opacity = getattr(replace_layer, 'opacity', 255)
        bbox = replace_layer.bbox  # (left, top, right, bottom) in psd-tools convention
        save_meta(
            out / f'{safe}_replace_me_meta.txt',
            scene=scene_name,
            blend_mode=blend,
            opacity=opacity,
            bbox_left=bbox[0], bbox_top=bbox[1],
            bbox_right=bbox[2], bbox_bottom=bbox[3],
            width=bbox[2] - bbox[0],
            height=bbox[3] - bbox[1],
        )
        print(f"  -> {safe}_replace_me_meta.txt")

    # Determine active scene from config, defaulting to largest bbox area
    active_scene = config.get('active_scene')
    if active_scene and active_scene in scenes:
        replace_layer = scenes[active_scene]
        print(f"\n  Active scene from config: '{active_scene}'")
    else:
        replace_layer = max(
            scenes.values(),
            key=lambda l: (l.bbox[2] - l.bbox[0]) * (l.bbox[3] - l.bbox[1])
        )
        active_scene = next(k for k, v in scenes.items() if v is replace_layer)
        print(f"\n  Active scene defaulting to largest bbox: '{active_scene}'")

    blend = str(getattr(replace_layer, 'blend_mode', 'multiply'))
    opacity = getattr(replace_layer, 'opacity', 255)
    bbox = replace_layer.bbox

    save_meta(
        out / 'replace_me_meta.txt',
        scene=active_scene,
        blend_mode=blend,
        opacity=opacity,
        bbox_left=bbox[0], bbox_top=bbox[1],
        bbox_right=bbox[2], bbox_bottom=bbox[3],
        width=bbox[2] - bbox[0],
        height=bbox[3] - bbox[1],
    )
    print(f"  -> replace_me_meta.txt (active: '{active_scene}', "
          f"bbox={bbox}, {bbox[2]-bbox[0]}x{bbox[3]-bbox[1]})")

    # ── [3/3] Summary ────────────────────────────────────────────────────
    print("\n[3/3] Extraction complete.")
    print(f"\n  Scenes found:  {list(scenes.keys())}")
    print(f"  Active scene:  {active_scene}")
    print(f"  Artwork slot:  {bbox[2]-bbox[0]}x{bbox[3]-bbox[1]} "
          f"at ({bbox[0]},{bbox[1]})")
    print(f"\n  Compositing note:")
    print(f"  Replace-me blend is '{blend}'. For a frameless render use")
    print(f"  blend_override=normal in the scene JSON to composite at Normal.")


# ── Dispatch ──────────────────────────────────────────────────────────────

EXTRACTORS = {
    'living_room_1':    extract_scene31,
    'bathroom_1':       extract_bathroom,
    'nursery_3_mobile': extract_nursery_video,
    'nursery_3_square': extract_nursery_video,
}


def main():
    parser = argparse.ArgumentParser(
        description='Extract PSD layers for mockup compositing',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Directory structure:
  mockup_layers/
    Vendor/
      room.psd          <- source PSD
      room.json         <- scene config (must contain "extractor" field)
      room/             <- extracted PNGs (created by this script)

Examples:
  python extract_psd_layers.py --scene Creative-Mockups/living_room_1
  python extract_psd_layers.py --scene BelloMockup/bathroom_1
  python extract_psd_layers.py --scene FrameArtWonderland/nursery_3_mobile
  python extract_psd_layers.py --scene FrameArtWonderland/nursery_3_square

Available extractors:
  living_room_1     - Creative-Mockups style (Render + Smart Objects + FX + Masks)
  bathroom_1        - BelloMockup style (space + frame groups + foreground)
  nursery_3_mobile  - FrameArtWonderland video mockup, 1080x1920 mobile
  nursery_3_square  - FrameArtWonderland video mockup, square variant
        """
    )
    parser.add_argument('--scene', required=True,
                        help='Vendor/room path (e.g. FrameArtWonderland/nursery_3_mobile)')
    args = parser.parse_args()

    config, psd_path, layers_dir = resolve_scene(args.scene)
    layers_dir.mkdir(parents=True, exist_ok=True)

    print(f"{'='*60}")
    print(f"Extracting: {args.scene}")
    print(f"PSD: {psd_path}")
    print(f"Output: {layers_dir}")
    print(f"{'='*60}")

    if not psd_path.exists():
        print(f"ERROR: PSD not found: {psd_path}")
        return

    extractor_name = config.get('extractor')
    if extractor_name not in EXTRACTORS:
        print(f"ERROR: Unknown extractor '{extractor_name}'")
        print(f"Available: {', '.join(EXTRACTORS.keys())}")
        return

    psd = PSDImage.open(str(psd_path))
    print(f"Canvas: {psd.width}x{psd.height}, mode={psd.color_mode}")

    EXTRACTORS[extractor_name](psd, layers_dir, config)

    print(f"\nDone! Layers exported to: {layers_dir}")
    print(f"Run: python compose_mockup.py artwork.png --size 54 --unit in --scene {args.scene}")


if __name__ == '__main__':
    main()
