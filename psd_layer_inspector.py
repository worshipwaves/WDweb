#!/usr/bin/env python3
"""
PSD Layer Inspector
Run this to see exactly what psd-tools is extracting.
"""
from pathlib import Path
from psd_tools import PSDImage
from PIL import Image

PSD_PATH = Path(r"C:\Users\paulj\WDweb\Minimalist Home.psd")
OUTPUT_DIR = Path(r"C:\Users\paulj\WDweb\public\assets\backgrounds\rooms\debug_inspector")

def inspect_room(psd, room_name):
    print(f"Inspecting: {room_name}")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Find layers
    room_group = next((x for x in psd if x.name == room_name), None)
    if not room_group: return
    
    interior = next((x for x in room_group if x.name == 'Interior'), None)
    shadows = next((x for x in room_group if x.name == 'Shadows'), None)
    
    # 1. Save Raw Interior (Check if this looks gray or white)
    if interior:
        print(f"  Interior Opacity: {interior.opacity}/255")
        img = interior.topil()
        img.save(OUTPUT_DIR / f"{room_name}_raw_interior.png")
        
    # 2. Save Raw Shadows (Check if this is solid black or transparent)
    if shadows:
        print(f"  Shadows Opacity: {shadows.opacity}/255")
        print(f"  Shadows Blend Mode: {shadows.blend_mode}")
        img = shadows.topil()
        img.save(OUTPUT_DIR / f"{room_name}_raw_shadows.png")

def main():
    psd = PSDImage.open(PSD_PATH)
    # Just check one room to test
    inspect_room(psd, 'Home library') 
    print(f"Check the folder: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()