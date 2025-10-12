# Texture Assets

This directory contains textures used by the SoundWave Art project.

## Directory Structure

- `wood/` - Wood textures organized by species, finish type, and size
  - Each wood species has its own subdirectory (e.g., maple, walnut, cherry)
  - Within each species directory:
    - `Raw/` and `Varnished/` directories for different finishes
    - Size variations (Small_36cm, Medium_99cm, Large_400cm)
    - Complete PBR material sets (Diffuse, Bump, Normal, Roughness)
    - `Blender_Materials/` containing ready-to-use Blender material presets
    - `Shared_Maps/` containing texture maps shared between finishes
  - Standardized naming convention for all textures

## Available Wood Species

The following wood species are available:
- alder-red
- bloodwood
- bubinga
- cedar-western-red
- cherry-black
- mahogany-american
- maple
- maple-birdseye
- oak-red-american
- oak-white-american
- padauk-african
- pine-north-carolina
- walnut-black-american
- wenge
- zebrano

## Texture Maps

Each wood species includes the following texture maps:
- **Diffuse** (`_d.png`) - Color/albedo maps
- **Bump** (`_b.png`) - Bump/height maps
- **Normal** (`_n.png`) - Normal maps for detailed surface normals
- **Roughness** (`_r.png`) - Roughness maps for PBR shading

## Usage

The visualization system references these textures through the `visualization/materials/wood_materials.py` module. When implementing material loading, use paths relative to the assets directory:

```python
# Example path to a wood texture
"assets/textures/wood/maple/Varnished/Medium_99cm/Diffuse/wood-098_maple-varnished-300x099cm_d.png"
```
