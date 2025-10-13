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
- 079 - alder-red
- 082 - bloodwood
- 054 - bubinga
- 083 - cedar-western-red
- 085 - cherry-black
- 095 - mahogany-american
- 098 - maple
- 097 - maple-birdseye
- 099 - oak-red-american
- 100 - oak-white-american
- 069 - padauk-african
- 102 - pine-north-carolina
- 109 - walnut-black-american
- 077 - wenge
- 078 - zebrano

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