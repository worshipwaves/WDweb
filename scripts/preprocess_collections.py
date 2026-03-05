"""
scripts/preprocess_collections.py

Offline preprocessing script for WaveDesigner collections.

For each song in the manifest:
  1. Loads WAV from source directory
  2. Applies slice (start_time / end_time)
  3. Runs Demucs vocal isolation
  4. Applies silence removal
  5. Extracts 200,000 normalized Float32 samples
  6. Writes {song_id}.json (metadata) and {song_id}.bin (raw samples)

Output directory (local dev):
  C:\\Users\\paulj\\WDweb\\public\\assets\\collections\\samples\\

Usage (from project root):
  python scripts/preprocess_collections.py
  python scripts/preprocess_collections.py --song amazing-grace
  python scripts/preprocess_collections.py --dry-run
  python scripts/preprocess_collections.py --skip-demucs   # for pipeline testing only
"""

import argparse
import json
import os
import struct
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path
import librosa
import numpy as np
import soundfile as sf
import tempfile

# ============================================================================
# PATHS — edit SOURCE_DIR if your WAV folder moves
# ============================================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent

SOURCE_DIR = Path(r"C:\Users\paulj\OneDrive\Desktop\Awaken Hymns\WorshipWavesCollections")

OUTPUT_DIR = PROJECT_ROOT / "public" / "assets" / "collections" / "samples"

MANIFEST_PATH = PROJECT_ROOT / "collection_manifest.json"

# ============================================================================
# BOOTSTRAP — ensure project root is on sys.path so service imports work
# ============================================================================

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def _build_state(entry: dict, skip_demucs: bool = False):
    """
    Load the canonical CompositionStateDTO from the database via get_config_service(),
    then override audio_source and audio_processing fields from the manifest entry.

    All geometry and processing defaults (including visual_floor_pct) come from
    the database — no hardcoded values, no JSON file reads.
    """
    import os
    os.environ["USE_DATABASE"] = "true"

    from services.config_loader import get_config_service
    from services.dtos import AudioSourceDTO, AudioProcessingDTO

    config_service = get_config_service()
    state = config_service.get_default_state()

    # Build new audio_source from manifest entry
    new_audio_source = AudioSourceDTO(
        source_file=entry["source_file"],
        start_time=entry["slice_start"],
        end_time=entry["slice_end"],
        use_stems=not skip_demucs,
        stem_choice="vocals"
    )

    # speech intent: enable silence removal with standard speech params,
    # preserving all other audio_processing fields from the database
    if entry["intent"] == "speech":
        silence_threshold = -20
        silence_duration = 0.2
    else:
        silence_threshold = -30
        silence_duration = 1.0

    new_audio_processing = AudioProcessingDTO(
        **{
            **state.audio_processing.model_dump(),
            "remove_silence": skip_demucs,
            "silence_threshold": silence_threshold,
            "silence_duration": silence_duration,
            "demucs_silence_threshold": -35.0,
            "demucs_silence_duration": 0.3,
        }
    )

    return state.model_copy(update={
        "audio_source": new_audio_source,
        "audio_processing": new_audio_processing,
    })


def _write_bin(samples_list: list, output_path: Path) -> None:
    """Write Float32 samples as little-endian IEEE 754 binary."""
    with open(output_path, "wb") as f:
        for v in samples_list:
            f.write(struct.pack("<f", float(v)))


def _write_json(entry: dict, duration: float, sample_count: int, optimize_result: dict, output_path: Path) -> None:
    """Write metadata JSON for the song."""
    metadata = {
        "song_id": entry["song_id"],
        "intent": entry["intent"],
        "duration": round(duration, 3),
        "slice_start": entry["slice_start"],
        "slice_end": entry["slice_end"],
        "demucs_version": entry["demucs_version"],
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "sample_count": sample_count,
        "exponent": optimize_result["exponent"],
        "filter_amount": optimize_result["filter_amount"],
        "binning_mode": optimize_result["binning_mode"]
    }
    with open(output_path, "w") as f:
        json.dump(metadata, f, indent=2)


def process_song(entry: dict, skip_demucs: bool = False, dry_run: bool = False) -> bool:
    """
    Process a single song entry from the manifest.
    Returns True on success, False on failure.
    """
    song_id = entry["song_id"]
    source_path = SOURCE_DIR / entry["source_file"]

    print(f"\n{'='*60}")
    print(f"[{song_id}]")
    print(f"  source : {source_path}")
    print(f"  slice  : {entry['slice_start']}s -> {entry['slice_end']}s")
    print(f"  demucs : {'SKIPPED' if skip_demucs else entry['demucs_version']}")

    if not source_path.exists():
        print(f"  ERROR  : Source file not found: {source_path}")
        return False

    if dry_run:
        print(f"  DRY RUN: skipping processing")
        return True

    try:
        from services.audio_processing_service import AudioProcessingService
        from services.demucs_service import DemucsService
        from services.config_loader import get_config_service

        state = _build_state(entry, skip_demucs=skip_demucs)
        config_service = get_config_service()
        audio_config = config_service.get_audio_processing_config()

        # === PHASE 1: Match process-commit (slice → demucs → compress_silence_only → WAV) ===
        slice_duration = entry["slice_end"] - entry["slice_start"]
        y_slice, sr_slice = librosa.load(str(source_path), sr=None, mono=True,
                                         offset=entry["slice_start"], duration=slice_duration)
        slice_path = Path(tempfile.gettempdir()) / f"{song_id}_slice.wav"
        sf.write(str(slice_path), y_slice, sr_slice)

        if skip_demucs:
            processed_path = slice_path
        else:
            demucs_output_dir = Path(tempfile.gettempdir()) / "demucs_output"
            demucs_svc = DemucsService(audio_config=audio_config, output_dir=demucs_output_dir)
            vocals_path, _ = demucs_svc.separate_vocals(input_path=slice_path)
            processed_path = demucs_svc.compress_silence_only(
                input_path=vocals_path,
                threshold_db=audio_config.demucs_silence_threshold,
                min_duration=audio_config.demucs_silence_duration
            )

        # === PHASE 2: Match /audio/process with cleanState (load WAV → extract 200K) ===
        svc = AudioProcessingService()
        audio_data, _ = librosa.load(str(processed_path), sr=44100, mono=True)
        raw_samples_np = svc.extract_amplitudes(audio_data, 200000)
        raw_samples = raw_samples_np.tolist()
        sample_count = len(raw_samples)

        duration = slice_duration

        # Run grid search on sliced source WAV (matches UI /audio/analyze input)
        slice_audio, _ = librosa.load(
            str(source_path), sr=44100, mono=True,
            offset=entry["slice_start"], duration=slice_duration
        )
        num_slots = state.pattern_settings.number_slots if state.pattern_settings else 48
        intent_config = config_service.get_intent_defaults().model_dump()
        optimize_result = AudioProcessingService.analyze_and_optimize(
            slice_audio, num_slots, entry["intent"], intent_config
        )

        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

        bin_path = OUTPUT_DIR / f"{song_id}.bin"
        json_path = OUTPUT_DIR / f"{song_id}.json"

        _write_bin(raw_samples, bin_path)
        _write_json(entry, duration, sample_count, optimize_result, json_path)

        bin_kb = bin_path.stat().st_size / 1024
        print(f"  OK     : {sample_count} samples")
        print(f"  wrote  : {bin_path.name} ({bin_kb:.1f} KB)")
        print(f"  wrote  : {json_path.name}")
        return True

    except Exception:
        print(f"  FAILED : {song_id}")
        traceback.print_exc()
        return False


def main():
    parser = argparse.ArgumentParser(description="Preprocess WaveDesigner collection songs")
    parser.add_argument(
        "--song",
        metavar="SONG_ID",
        help="Process a single song by song_id (e.g. amazing-grace)"
    )
    parser.add_argument(
        "--skip-demucs",
        action="store_true",
        help="Skip Demucs vocal isolation (pipeline testing only -- not for production)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate manifest and source files without processing"
    )
    args = parser.parse_args()

    if not MANIFEST_PATH.exists():
        print(f"ERROR: Manifest not found: {MANIFEST_PATH}")
        sys.exit(1)

    with open(MANIFEST_PATH, "r") as f:
        manifest = json.load(f)

    print(f"Manifest loaded: {len(manifest)} songs")
    print(f"Source dir : {SOURCE_DIR}")
    print(f"Output dir : {OUTPUT_DIR}")

    if args.song:
        manifest = [e for e in manifest if e["song_id"] == args.song]
        if not manifest:
            print(f"ERROR: song_id '{args.song}' not found in manifest")
            sys.exit(1)

    results = {"ok": [], "failed": []}

    for entry in manifest:
        success = process_song(
            entry,
            skip_demucs=args.skip_demucs,
            dry_run=args.dry_run
        )
        if success:
            results["ok"].append(entry["song_id"])
        else:
            results["failed"].append(entry["song_id"])

    print(f"\n{'='*60}")
    print(f"COMPLETE: {len(results['ok'])} succeeded, {len(results['failed'])} failed")
    if results["failed"]:
        print(f"FAILED:")
        for sid in results["failed"]:
            print(f"  - {sid}")
        sys.exit(1)


if __name__ == "__main__":
    main()
