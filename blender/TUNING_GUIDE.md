# WaveDesigner Lighting Tuning Guide

## Quick Start

```batch
cd C:\Users\paulj\WDweb\blender
tune_lighting.bat panel_export.glb panel_config.json
```

## Blender Workflow

### 1. Enable Rendered Preview
- Press `Z` key → select "Rendered"
- Or: Top-right corner dropdown → "Viewport Shading" → "Rendered"

### 2. Select a Light
- Click light in viewport, or
- Click light name in Outliner (top-right panel)

### 3. Adjust Light Properties
Properties panel (right side) → Light tab (lightbulb icon):

| Property | Effect | Typical Range |
|----------|--------|---------------|
| **Energy** | Brightness | 10,000 - 500,000 |
| **Size** | Shadow softness | 5 - 50 |
| **Color** | Warmth/coolness | Click swatch |

### 4. Move/Rotate Light
- `G` = Grab (move)
- `G` then `X`/`Y`/`Z` = Move on axis
- `R` = Rotate
- Middle-mouse drag = Orbit viewport

### 5. Preview Full Render
- Press `F12`
- Close render window to return to viewport

### 6. Extract Values
1. Switch to "Scripting" workspace (top tabs)
2. Click "Open" → select `extract_lighting.py`
3. Click "Run Script"
4. Copy output from console (bottom panel)

## Key Lighting Principles

### For Wood Grain Visibility
- **Lower elevation** (15-25°) = light skims surface, reveals texture
- **Higher elevation** (40-60°) = flatter illumination

### For Shadows
- **Smaller size** = sharper shadows
- **Larger size** = softer shadows
- **Single dominant light** = visible shadows
- **Multiple equal lights** = flat, shadowless

### For Wood Warmth
- **Warm color** (orange tint) = enhances wood
- **Cool color** (blue tint) = clinical, less natural

## Light Positions

```
        TOP VIEW
        
        Wall (Y=0)
          │
    ┌─────┼─────┐
    │     │     │
 ───┼─────●─────┼───  X axis
    │   Panel   │
    │     │     │
    └─────┼─────┘
          │
      Camera (Y negative)


   Key Light: Upper-left or upper-right
   Fill Light: Opposite side, lower
```

## Troubleshooting

### Scene too dark
- Increase Key_Light energy (try 200,000+)
- Add more fill lights
- Increase HDRI strength in World properties

### No visible shadows
- Reduce Fill_Light energy
- Move Key_Light further off-axis
- Reduce light Size for crisper shadows

### Wood looks flat
- Lower Key_Light elevation (more raking angle)
- Ensure Key_Light visible_glossy = True
- Check wood material has roughness texture

### Grainy preview
- Normal for viewport preview
- F12 render will be cleaner
- Increase Render samples for final output
