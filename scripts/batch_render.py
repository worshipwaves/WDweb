"""
scripts/batch_render.py

Automated batch render for WaveDesigner collection thumbnails.
225 renders: 15 hymns × 15 archetypes × 1 species per hymn.

Prerequisites:
  - Backend running at localhost:8000
  - Vite dev server running at localhost:5173
  - All 15 .bin and .json sidecar files present in /assets/collections/samples/
  - playwright installed: pip install playwright && playwright install chromium
  - Pillow installed: pip install Pillow

Usage:
  python scripts/batch_render.py
  python scripts/batch_render.py --archetype circular_radial_n1
  python scripts/batch_render.py --hymn amazing-grace
  python scripts/batch_render.py --dry-run
  python scripts/batch_render.py --size 4096
  python scripts/batch_render.py --size 2048 --no-msaa
  python scripts/batch_render.py --skip-existing
  python scripts/batch_render.py --reload-every 50

Output:
  C:\\Users\\paulj\\WDweb\\renders\\{archetype_id}\\{artifact_name}_{species}.png

Quality fixes (v2):
  - CreateScreenshotUsingRenderTargetAsync replaces CreateScreenshotAsync
    → dedicated offscreen RenderTargetTexture at exact requested dimensions
    → MSAA samples parameter for antialiased edges on slots/contours
  - Camera FOV fixed to baseFov (0.8 rad) for 1:1 capture aspect ratio
    → eliminates viewport-dependent FOV distortion
  - Hardware scaling level reset to 1 during capture
    → prevents DPR multiplication exceeding MAX_TEXTURE_SIZE
  - Chunked base64 transfer for renders > 4096
    → avoids CDP serialization limits on large data URLs
  - Periodic page reload to reclaim GPU memory across long runs
"""

import argparse
import asyncio
import base64
import io
import json
import os
import sys
import time
import traceback
from pathlib import Path

from PIL import Image
from playwright.async_api import async_playwright

# ============================================================================
# CONFIG
# ============================================================================

APP_URL             = 'http://localhost:5173'
API_URL             = 'http://localhost:8000'
OUTPUT_DIR          = Path(r'C:\Users\paulj\WDweb\renders')
SETTLE_MS           = 300     # ms after textures ready before capture
TEXTURE_TIMEOUT_MS  = 30000   # max ms to wait for textures
DEFAULT_RENDER_SIZE = 4096    # px — safe for all GPUs (MAX_TEXTURE_SIZE >= 4096)
DEFAULT_MSAA        = 4       # MSAA samples (1 = off, 4 = high quality)
RELOAD_EVERY        = 75      # reload page every N renders to reclaim GPU memory

# ============================================================================
# HYMN MANIFEST — 15 hymns, one species each (rotates through all 15 species)
# songId       : matches .bin / .json sidecar filenames
# artifactName : used in output filename and as audio_source.source_file
# species      : wood species ID from wood_materials.json catalog
# ============================================================================

HYMNS = [
    # Covenant collection
    { 'songId': 'how-great-thou-art',                'artifactName': 'the-awe',           'species': 'walnut-black-american'  },
    { 'songId': 'great-is-thy-faithfulness',         'artifactName': 'the-faithfulness',  'species': 'cherry-black'           },
    { 'songId': 'come-thou-fount-of-every-blessing', 'artifactName': 'the-ebenezer',      'species': 'maple'                  },
    { 'songId': 'be-thou-my-vision',                 'artifactName': 'the-vision',        'species': 'maple-birdseye'         },
    { 'songId': 'my-hope-is-built-on-nothing-less',  'artifactName': 'the-solid-rock',    'species': 'oak-white-american'     },
    # Cross collection
    { 'songId': 'amazing-grace',                     'artifactName': 'the-grace',         'species': 'oak-red-american'       },
    { 'songId': 'it-is-well-with-my-soul',           'artifactName': 'the-well',          'species': 'mahogany-american'      },
    { 'songId': 'when-i-survey-the-wondrous-cross',  'artifactName': 'the-survey',        'species': 'alder-red'              },
    { 'songId': 'blessed-assurance',                 'artifactName': 'the-assurance',     'species': 'bloodwood'              },
    { 'songId': 'turn-your-eyes-upon-jesus',         'artifactName': 'the-gaze',          'species': 'bubinga'                },
    # Crown collection
    { 'songId': 'holy-holy-holy',                    'artifactName': 'the-sanctus',       'species': 'cedar-western-red'      },
    { 'songId': 'crown-him-with-many-crowns',        'artifactName': 'the-diadems',       'species': 'padauk-african'         },
    { 'songId': 'all-hail-the-power-of-jesus-name',  'artifactName': 'the-king-of-kings', 'species': 'pine-north-carolina'    },
    { 'songId': 'to-god-be-the-glory',               'artifactName': 'the-glory',         'species': 'wenge'                  },
    { 'songId': 'come-thou-long-expected-jesus',     'artifactName': 'the-maranatha',     'species': 'zebrano'                },
]

# ============================================================================
# JAVASCRIPT — injected into the page once at startup
# ============================================================================

JS_INIT = """
async () => {
    // Verify all required globals
    if (!window.controller)   throw new Error('window.controller not found');
    if (!window.sceneManager) throw new Error('window.sceneManager not found');
    if (!window.audioCache)   throw new Error('window.audioCache not found');
    if (!window.BJS_CORE)     throw new Error('window.BJS_CORE not found');

    // Clear container background for transparent capture
    const canvas = document.getElementById('renderCanvas');
    if (canvas) {
        canvas.style.backgroundColor = 'transparent';
        canvas.style.backgroundImage = 'none';
        const container = canvas.parentElement;
        if (container) {
            container.style.backgroundImage = 'none';
            container.style.backgroundColor = 'transparent';
            container.style.background = 'transparent';
        }
    }

    // Report GPU limits for diagnostics
    const gl = window.sceneManager.engine._gl;
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const maxRB  = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    const renderer = gl.getParameter(gl.RENDERER);
    console.log(`[BatchRender] GPU: ${renderer}`);
    console.log(`[BatchRender] MAX_TEXTURE_SIZE: ${maxTex}`);
    console.log(`[BatchRender] MAX_RENDERBUFFER_SIZE: ${maxRB}`);

    return { maxTextureSize: maxTex, maxRenderbufferSize: maxRB, renderer: renderer };
}
"""

# ============================================================================
# JAVASCRIPT — injected per render job
# Fixes vs v1:
#   1. CreateScreenshotUsingRenderTargetAsync with explicit MSAA samples
#   2. Camera FOV set to baseFov (0.8) for 1:1 capture aspect
#   3. Hardware scaling level reset to 1 during capture
#   4. Shadow receiver temporarily hidden (optional, via job.hideShadow)
# ============================================================================

JS_RENDER = """
async (job) => {
    const BABYLON   = window.BJS_CORE;
    const hymn      = job.hymn;
    const archetype = job.archetype;
    const TEXTURE_TIMEOUT = job.textureTimeoutMs;
    const SETTLE_MS = job.settleMs;
    const RENDER_SIZE = job.renderSize;
    const MSAA_SAMPLES = job.msaaSamples;

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // --- Load .bin samples ---
    const binUrl = `/assets/collections/samples/${hymn.songId}.bin`;
    const binRes = await fetch(binUrl);
    if (!binRes.ok) throw new Error(`Failed to fetch .bin: ${binUrl} (${binRes.status})`);
    const rawSamples = new Float32Array(await binRes.arrayBuffer());

    // --- Load .json sidecar ---
    const jsonUrl = `/assets/collections/samples/${hymn.songId}.json`;
    const jsonRes = await fetch(jsonUrl);
    if (!jsonRes.ok) throw new Error(`Failed to fetch sidecar: ${jsonUrl} (${jsonRes.status})`);
    const sidecar = await jsonRes.json();

    // --- Cache raw samples ---
    const dummyFile = new File([new ArrayBuffer(8)], `${hymn.artifactName}.wav`, { type: 'audio/wav' });
    const sessionId = window.audioCache.cacheRawSamples(dummyFile, rawSamples);

    // --- Rebin using sidecar params ---
    const rebinned = window.audioCache.rebinFromCache(sessionId, {
        numSlots:     archetype.number_slots,
        binningMode:  sidecar.binning_mode  || 'mean_abs',
        exponent:     sidecar.exponent      ?? 1.0,
        filterAmount: sidecar.filter_amount ?? 0,
    });
    if (!rebinned) throw new Error('rebinFromCache returned null');

    // --- Build composition ---
    const baseState = window.controller.getState();
    const comp = JSON.parse(JSON.stringify(baseState.composition));

    comp.frame_design.shape           = archetype.shape;
    comp.frame_design.finish_x        = archetype.default_finish_x;
    comp.frame_design.finish_y        = archetype.default_finish_y;
    comp.frame_design.separation      = archetype.separation;
    comp.frame_design.number_sections = archetype.number_sections;
    comp.pattern_settings.slot_style  = archetype.slot_style;
    comp.pattern_settings.number_slots = archetype.number_slots;
    comp.frame_design.section_materials = Array.from(
        { length: archetype.number_sections },
        (_, i) => ({
            section_id: i,
            species: hymn.species,
            grain_direction: archetype.default_grain_direction,
        })
    );
    comp.processed_amplitudes = Array.from(rebinned);
    comp.audio_source = { ...comp.audio_source, source_file: hymn.artifactName };

    // --- Sync species into live controller state ---
    const liveState = window.controller.getState();
    liveState.composition.frame_design.section_materials = comp.frame_design.section_materials;

    // --- Request CSG ---
    const csgResponse = await window.controller.getRoutedCSGData(
        comp,
        ['processed_amplitudes', 'frame_design', 'pattern_settings'],
        null
    );

    // --- Render ---
    await window.sceneManager.renderComposition(csgResponse);

    // --- Wait for textures ---
    await new Promise(resolve => {
        const scene = window.sceneManager.scene;
        const deadline = Date.now() + TEXTURE_TIMEOUT;
        function check() {
            const pending = scene.getWaitingItemsCount();
            if (pending === 0) {
                resolve();
            } else if (Date.now() > deadline) {
                console.warn(`[BatchRender] Texture timeout: ${pending} items still pending`);
                resolve();
            } else {
                requestAnimationFrame(check);
            }
        }
        check();
    });

    await sleep(SETTLE_MS);

    // =======================================================================
    // CAPTURE — CreateScreenshotUsingRenderTargetAsync
    // =======================================================================

    const engine = window.sceneManager.engine;
    const scene  = window.sceneManager.scene;
    const cam    = scene.activeCamera;

    // Force transparent clear
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

    // Save state we will modify
    const savedFov     = cam.fov;
    const savedScaling = engine.getHardwareScalingLevel();

    // Fix camera FOV for 1:1 capture aspect (no viewport correction)
    cam.fov = 0.8;

    // Reset hardware scaling to 1:1 — prevents DPR multiplication
    // (e.g. DPR=2 + 4096 request = 8192 internal, exceeding MAX_TEXTURE_SIZE)
    engine.setHardwareScalingLevel(1);

    // Optionally hide shadow receiver for clean isolated artwork
    let shadowReceiver = null;
    if (job.hideShadow) {
        // Find shadow receiver plane in scene
        shadowReceiver = scene.getMeshByName('shadowReceiverPlane');
        if (shadowReceiver) shadowReceiver.setEnabled(false);
    }

    let dataURL;
    try {
        // CreateScreenshotUsingRenderTargetAsync:
        //   - Allocates a dedicated RenderTargetTexture at exact dimensions
        //   - 'samples' parameter enables MSAA on the offscreen target
        //   - Does NOT resize the viewport canvas
        //   - Renders one frame into the target, reads pixels, returns data URL
        dataURL = await BABYLON.Tools.CreateScreenshotUsingRenderTargetAsync(
            engine,
            cam,
            { width: RENDER_SIZE, height: RENDER_SIZE },
            'image/png',
            MSAA_SAMPLES,    // MSAA samples (4x default)
            true,            // antialiasing
            null,            // fileName (null = return data URL)
            false,           // renderSprites
            true             // enableStencilBuffer
        );
    } finally {
        // Restore engine and camera state
        cam.fov = savedFov;
        engine.setHardwareScalingLevel(savedScaling);
        if (shadowReceiver) shadowReceiver.setEnabled(true);
    }

    // --- Clean up audio cache ---
    window.audioCache.clearSession(sessionId);

    // --- Return in chunks to avoid CDP serialization limits ---
    // For 4096x4096, base64 PNG is ~10-25MB. For 8192, ~40-100MB.
    // Chunked transfer via window.__batchChunks avoids single-evaluate limits.
    const CHUNK_SIZE = 4 * 1024 * 1024;  // 4MB chunks
    if (dataURL.length > CHUNK_SIZE) {
        window.__batchChunks = [];
        for (let i = 0; i < dataURL.length; i += CHUNK_SIZE) {
            window.__batchChunks.push(dataURL.substring(i, i + CHUNK_SIZE));
        }
        return { chunked: true, totalChunks: window.__batchChunks.length, totalLength: dataURL.length };
    }

    return { chunked: false, dataURL: dataURL };
}
"""

JS_GET_CHUNK = """
(index) => {
    return window.__batchChunks[index];
}
"""

JS_CLEAR_CHUNKS = """
() => { window.__batchChunks = null; }
"""

# ============================================================================
# HELPERS
# ============================================================================

def decode_png(data_url: str) -> bytes:
    """Strip data URL prefix, decode base64, crop to artwork bounding box."""
    header, encoded = data_url.split(',', 1)
    raw = base64.b64decode(encoded)

    img = Image.open(io.BytesIO(raw)).convert('RGBA')

    # Crop to non-transparent bounding box
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    out = io.BytesIO()
    img.save(out, format='PNG', optimize=True)
    return out.getvalue()


async def fetch_archetypes() -> dict:
    """Fetch active archetypes from the backend API."""
    import urllib.request
    url = f'{API_URL}/api/config/archetypes'
    with urllib.request.urlopen(url, timeout=10) as response:
        data = json.loads(response.read().decode())
    # Filter to active archetypes that have default sizes set
    active = {
        k: v for k, v in data.items()
        if v.get('default_finish_x') is not None
        and v.get('default_finish_y') is not None
        and v.get('default_grain_direction') is not None
    }
    return active


async def wait_for_app(page, timeout_ms: int = 60000) -> None:
    """Wait until window.controller and window.sceneManager are ready."""
    print('  Waiting for app to initialize...')
    await page.wait_for_function(
        """() => window.controller &&
                window.sceneManager &&
                window.audioCache &&
                window.BJS_CORE &&
                window.controller.getState() !== null""",
        timeout=timeout_ms
    )
    print('  App ready.')


async def retrieve_data_url(page, result: dict) -> str:
    """Retrieve full data URL, handling chunked transfers."""
    if not result['chunked']:
        return result['dataURL']

    # Reassemble from chunks stored in window.__batchChunks
    total = result['totalChunks']
    parts = []
    for i in range(total):
        chunk = await page.evaluate(JS_GET_CHUNK, i)
        parts.append(chunk)
    await page.evaluate(JS_CLEAR_CHUNKS)
    return ''.join(parts)


async def init_page(pw, app_url: str, render_size: int):
    """Launch browser, navigate, wait for app, run JS_INIT. Returns (browser, page, gpu_info)."""
    browser = await pw.chromium.launch(headless=False)
    context = await browser.new_context(viewport={'width': 1600, 'height': 900})
    page = await context.new_page()

    await page.goto(app_url, wait_until='networkidle', timeout=60000)
    await wait_for_app(page)

    gpu_info = await page.evaluate(JS_INIT)

    # Validate render size against GPU limits
    max_tex = gpu_info.get('maxTextureSize', 4096)
    if render_size > max_tex:
        print(f'  WARNING: Requested render size {render_size} exceeds GPU MAX_TEXTURE_SIZE {max_tex}')
        print(f'  Clamping to {max_tex}')
        render_size = max_tex

    print(f'  GPU: {gpu_info.get("renderer", "unknown")}')
    print(f'  MAX_TEXTURE_SIZE: {max_tex}')
    print(f'  Render size: {render_size}x{render_size}')

    return browser, page, gpu_info, render_size


# ============================================================================
# MAIN
# ============================================================================

async def main():
    parser = argparse.ArgumentParser(description='WaveDesigner batch renderer (v2 — quality fix)')
    parser.add_argument('--archetype',     metavar='ID',   help='Render one archetype only')
    parser.add_argument('--hymn',          metavar='ID',   help='Render one hymn only (songId)')
    parser.add_argument('--dry-run',       action='store_true', help='List jobs without rendering')
    parser.add_argument('--skip-existing', action='store_true', help='Skip renders where output PNG already exists')
    parser.add_argument('--size',          type=int, default=DEFAULT_RENDER_SIZE,
                        help=f'Render size in pixels (default: {DEFAULT_RENDER_SIZE})')
    parser.add_argument('--no-msaa',       action='store_true', help='Disable MSAA (faster, lower quality)')
    parser.add_argument('--no-shadow',     action='store_true', help='Hide shadow receiver during capture')
    parser.add_argument('--reload-every',  type=int, default=RELOAD_EVERY,
                        help=f'Reload page every N renders to reclaim GPU memory (default: {RELOAD_EVERY})')
    args = parser.parse_args()

    render_size  = args.size
    msaa_samples = 1 if args.no_msaa else DEFAULT_MSAA

    # --- Fetch archetypes from API ---
    print('Fetching archetypes from API...')
    try:
        archetypes = await fetch_archetypes()
    except Exception as e:
        print(f'ERROR: Could not fetch archetypes from {API_URL}/api/config/archetypes')
        print(f'  {e}')
        print('  Is the backend running?')
        sys.exit(1)

    print(f'  {len(archetypes)} active archetypes with default sizes.')

    # --- Apply filters ---
    hymns = HYMNS
    if args.hymn:
        hymns = [h for h in hymns if h['songId'] == args.hymn]
        if not hymns:
            print(f'ERROR: hymn songId "{args.hymn}" not found in manifest')
            sys.exit(1)

    if args.archetype:
        if args.archetype not in archetypes:
            print(f'ERROR: archetype "{args.archetype}" not found or missing default sizes')
            sys.exit(1)
        archetypes = {args.archetype: archetypes[args.archetype]}

    # --- Build job list ---
    jobs = []
    for archetype_id, archetype in archetypes.items():
        for hymn in hymns:
            output_path = OUTPUT_DIR / archetype_id / f"{hymn['artifactName']}_{hymn['species']}.png"
            if args.skip_existing and output_path.exists():
                continue
            jobs.append({
                'archetype_id': archetype_id,
                'archetype': archetype,
                'hymn': hymn,
                'output_path': output_path,
            })

    total = len(jobs)
    print(f'\nJobs: {total} ({len(archetypes)} archetypes × {len(hymns)} hymns)')

    if args.dry_run:
        print('\nDRY RUN — jobs that would be rendered:')
        for j in jobs:
            print(f"  {j['archetype_id']} / {j['hymn']['artifactName']} / {j['hymn']['species']} -> {j['output_path']}")
        return

    if total == 0:
        print('No jobs to render.')
        return

    # --- Create output dirs ---
    for archetype_id in archetypes:
        (OUTPUT_DIR / archetype_id).mkdir(parents=True, exist_ok=True)

    # --- Launch browser ---
    print(f'\nLaunching browser -> {APP_URL}')
    async with async_playwright() as pw:
        browser, page, gpu_info, render_size = await init_page(pw, APP_URL, render_size)

        success_count = 0
        fail_count    = 0
        start_time    = time.time()

        print(f'\nStarting renders ({render_size}x{render_size}, MSAA={msaa_samples}x)...')
        print(f'{"="*60}')

        for idx, job in enumerate(jobs):
            label = f"[{idx+1}/{total}] {job['archetype_id']} / {job['hymn']['artifactName']}"

            # --- Periodic page reload to reclaim GPU memory ---
            if idx > 0 and idx % args.reload_every == 0:
                print(f'\n  Reloading page (GPU memory reclaim after {idx} renders)...')
                await page.goto(APP_URL, wait_until='networkidle', timeout=60000)
                await wait_for_app(page)
                await page.evaluate(JS_INIT)
                print('  Reload complete.\n')

            print(f'{label}')

            try:
                result = await page.evaluate(
                    JS_RENDER,
                    {
                        'hymn':            job['hymn'],
                        'archetype':       job['archetype'],
                        'textureTimeoutMs': TEXTURE_TIMEOUT_MS,
                        'settleMs':        SETTLE_MS,
                        'renderSize':      render_size,
                        'msaaSamples':     msaa_samples,
                        'hideShadow':      args.no_shadow,
                    }
                )

                # Retrieve full data URL (handles chunked transfers)
                data_url = await retrieve_data_url(page, result)

                # Decode, crop, and save PNG
                png_bytes = decode_png(data_url)
                job['output_path'].write_bytes(png_bytes)

                elapsed = time.time() - start_time
                avg = elapsed / (idx + 1)
                remaining = avg * (total - idx - 1)
                print(f'  OK  {job["output_path"].name}  '
                      f'({len(png_bytes)//1024}KB)  '
                      f'ETA: {int(remaining//60)}m {int(remaining%60)}s')

                success_count += 1

            except Exception as e:
                print(f'  FAIL: {e}')
                traceback.print_exc()
                fail_count += 1

            # Brief GPU pause between renders
            await asyncio.sleep(0.2)

        await browser.close()

    # --- Summary ---
    total_time = time.time() - start_time
    print(f'\n{"="*60}')
    print(f'COMPLETE in {int(total_time//60)}m {int(total_time%60)}s')
    print(f'  Success: {success_count} / {total}')
    if fail_count > 0:
        print(f'  Failed:  {fail_count} / {total}')


if __name__ == '__main__':
    asyncio.run(main())
