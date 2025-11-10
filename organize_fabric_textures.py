#!/usr/bin/env python3
"""
Organize fabric texture files for WaveDesigner backing materials.

This script processes texture files in /public/assets/textures/fabric/:
- Keeps only Color, NormalGL, and Roughness textures
- Renames them to app convention (fabric-XXX_color.png, etc.)
- Deletes all other files

Run from project root: python organize_fabric_textures.py
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Set


def get_fabric_directory() -> Path:
    """Get the fabric textures directory path."""
    script_dir = Path(__file__).parent
    fabric_dir = script_dir / "public" / "assets" / "textures" / "fabric"
    
    if not fabric_dir.exists():
        print(f"ERROR: Directory does not exist: {fabric_dir}")
        print("Please ensure you're running this script from the project root.")
        exit(1)
    
    return fabric_dir


def parse_fabric_files(fabric_dir: Path) -> Dict[str, Dict[str, Path]]:
    """
    Parse fabric files and organize by fabric number.
    
    Returns:
        Dict mapping fabric number (e.g., "016") to dict of texture types
        Example: {"016": {"color": Path(...), "normal": Path(...), "roughness": Path(...)}}
    """
    fabrics: Dict[str, Dict[str, Path]] = {}
    
    # Pattern: FabricXXX_4K-PNG_TextureType.png
    pattern = re.compile(r'^Fabric(\d+)_4K-PNG_(\w+)\.png$')
    
    for file_path in fabric_dir.glob("Fabric*.png"):
        match = pattern.match(file_path.name)
        if not match:
            continue
        
        fabric_num = match.group(1)  # e.g., "016"
        texture_type = match.group(2)  # e.g., "Color", "NormalGL", "Roughness"
        
        # Only keep the texture types we need
        if texture_type == "Color":
            key = "color"
        elif texture_type == "NormalGL":
            key = "normal"
        elif texture_type == "Roughness":
            key = "roughness"
        else:
            continue
        
        if fabric_num not in fabrics:
            fabrics[fabric_num] = {}
        
        fabrics[fabric_num][key] = file_path
    
    return fabrics


def rename_fabric_files(fabrics: Dict[str, Dict[str, Path]], fabric_dir: Path) -> Set[str]:
    """
    Rename fabric files to app naming convention.
    
    Args:
        fabrics: Dict of fabric numbers and their texture files
        fabric_dir: Directory containing the files
        
    Returns:
        Set of new filenames that should be kept
    """
    kept_files: Set[str] = set()
    
    for fabric_num, textures in sorted(fabrics.items()):
        print(f"\nProcessing Fabric{fabric_num}:")
        
        for texture_type, old_path in textures.items():
            # New naming convention: fabric-XXX_type.png
            new_name = f"fabric-{fabric_num}_{texture_type}.png"
            new_path = fabric_dir / new_name
            
            # Rename the file
            try:
                old_path.rename(new_path)
                print(f"  ✓ Renamed {old_path.name} → {new_name}")
                kept_files.add(new_name)
            except Exception as e:
                print(f"  ✗ Error renaming {old_path.name}: {e}")
    
    return kept_files


def delete_unwanted_files(fabric_dir: Path, kept_files: Set[str]) -> None:
    """
    Delete all files in the directory except those in kept_files.
    
    Args:
        fabric_dir: Directory to clean
        kept_files: Set of filenames to keep
    """
    deleted_count = 0
    deleted_size = 0
    
    print("\n" + "="*60)
    print("DELETING UNWANTED FILES")
    print("="*60)
    
    for file_path in fabric_dir.iterdir():
        if not file_path.is_file():
            continue
        
        if file_path.name in kept_files:
            continue
        
        # Delete the file
        try:
            file_size = file_path.stat().st_size
            file_path.unlink()
            deleted_count += 1
            deleted_size += file_size
            print(f"  ✓ Deleted {file_path.name} ({file_size / 1024 / 1024:.1f} MB)")
        except Exception as e:
            print(f"  ✗ Error deleting {file_path.name}: {e}")
    
    print(f"\n✓ Deleted {deleted_count} files ({deleted_size / 1024 / 1024:.1f} MB total)")


def print_summary(fabrics: Dict[str, Dict[str, Path]], kept_files: Set[str]) -> None:
    """Print summary of organized files."""
    print("\n" + "="*60)
    print("ORGANIZATION SUMMARY")
    print("="*60)
    print(f"\nProcessed {len(fabrics)} fabric sets:")
    
    for fabric_num in sorted(fabrics.keys()):
        textures = fabrics[fabric_num]
        print(f"\n  Fabric{fabric_num}:")
        print(f"    - fabric-{fabric_num}_color.png")
        print(f"    - fabric-{fabric_num}_normal.png")
        if "roughness" in textures:
            print(f"    - fabric-{fabric_num}_roughness.png")
    
    print(f"\n✓ Total files kept: {len(kept_files)}")
    print("\nNext steps:")
    print("1. Update config/backing_materials.json with new texture paths")
    print("2. Test cloth backing materials in the app")


def main():
    """Main execution flow."""
    print("="*60)
    print("WAVEDESIGNER FABRIC TEXTURE ORGANIZER")
    print("="*60)
    
    # Get directory
    fabric_dir = get_fabric_directory()
    print(f"\nWorking directory: {fabric_dir}")
    
    # Count initial files
    initial_files = list(fabric_dir.glob("*"))
    print(f"Initial file count: {len(initial_files)}")
    
    # Parse fabric files
    fabrics = parse_fabric_files(fabric_dir)
    
    if not fabrics:
        print("\nERROR: No fabric texture files found!")
        print("Expected files like: Fabric016_4K-PNG_Color.png")
        exit(1)
    
    print(f"\nFound {len(fabrics)} fabric sets: {', '.join(sorted(fabrics.keys()))}")
    
    # Ask for confirmation
    print("\nThis script will:")
    print("1. Rename required texture files (Color, NormalGL, Roughness)")
    print("2. Delete ALL other files in the directory")
    
    response = input("\nContinue? (yes/no): ").strip().lower()
    if response not in ['yes', 'y']:
        print("Aborted.")
        exit(0)
    
    # Rename files
    kept_files = rename_fabric_files(fabrics, fabric_dir)
    
    # Delete unwanted files
    delete_unwanted_files(fabric_dir, kept_files)
    
    # Print summary
    print_summary(fabrics, kept_files)
    
    print("\n✓ Organization complete!")


if __name__ == "__main__":
    main()
