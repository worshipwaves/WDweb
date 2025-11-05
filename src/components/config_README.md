# WaveDesigner Configuration Files

This directory contains all configuration files that control application behavior, UI elements, material properties, and design templates. These files are the **single source of truth** for the application - no values are hardcoded in the codebase.

---

## File Overview

### Configuration Files
- **`archetypes.json`** - Pre-configured design templates (style presets)
- **`composition_defaults.json`** - Default values for all composition parameters
- **`ui_config.json`** - UI element definitions, categories, and navigation structure
- **`wood_materials.json`** - Wood species catalog, texture paths, and rendering configuration

### How They Work Together

```
User Opens App
  ↓
composition_defaults.json → Initial state loaded
  ↓
ui_config.json → UI elements rendered (sliders, dropdowns)
  ↓
wood_materials.json → Wood textures and species available
  ↓
User clicks archetype thumbnail
  ↓
archetypes.json → Pre-configured values applied to state
  ↓
Backend processes → 3D preview updates
```

---

## 1. `composition_defaults.json`

**Purpose:** Defines the initial state of the application when it first loads. Every parameter that can be modified through the UI has a default value here.

### Structure Overview

```json
{
  "frame_design": { ... },
  "pattern_settings": { ... },
  "amplitude_processing": { ... },
  "visual_correction": { ... },
  "display_settings": { ... },
  "export_settings": { ... }
}
```

### Key Sections

#### `frame_design` - Physical Panel Specifications

| Field | Type | Description | Valid Values |
|-------|------|-------------|--------------|
| `shape` | string | Panel shape | "circular", "rectangular", "diamond" |
| `number_sections` | integer | Number of sections | 1, 2, 3, 4 |
| `finish_x` | number | Width/diameter (inches) | 12-84 |
| `finish_y` | number | Height (inches) | 12-84 |
| `separation` | number | Gap between sections (inches) | 0.5-5.0 |
| `material_thickness` | number | Panel thickness (inches) | 0.375-1.0 |

**Critical Rule:** For circular panels, `finish_x` must equal `finish_y` (both represent diameter).

#### `section_materials` - Material Assignment

Array defining wood species and grain for each section.

```json
"section_materials": [
  {
    "section_id": 0,
    "species": "walnut-black-american",
    "grain_direction": "vertical"
  }
]
```

**Grain Direction Rules:**
- `horizontal` / `vertical`: Always available
- `radiant`: Requires n ≥ 2 sections
- `diamond`: Only n = 4 sections

#### `pattern_settings` - Slot Configuration

| Field | Type | Description | Valid Values |
|-------|------|-------------|--------------|
| `slot_style` | string | Pattern type | "radial", "linear" |
| `number_slots` | integer | Total slots | 24-120 |
| `side_margin` | number | Margin for linear (inches) | 0-10 |
| `bit_diameter` | number | CNC bit size (inches) | 0.125-0.5 |
| `slot_spacer` | number | Min slot spacing (inches) | 0.0625-0.25 |

**When side_margin applies:** Only when `slot_style = "linear"` AND `shape` is "circular" or "diamond".

### Editing Guidelines

**To change default panel size:**
```json
"finish_x": 48,  // Changed from 36
"finish_y": 48   // Must match for circular
```

**To change default wood species:**
```json
"section_materials": [
  {
    "section_id": 0,
    "species": "cherry-black",  // Changed from walnut
    "grain_direction": "horizontal"
  }
]
```

---

## 2. `ui_config.json`

**Purpose:** Defines all UI elements (sliders, dropdowns, buttons), their properties, visibility rules, and the navigation structure (categories/subcategories).

### Structure Overview

```json
{
  "elements": { ... },        // Individual UI controls
  "thumbnail_config": { ... }, // Asset paths
  "categories": { ... }        // Navigation hierarchy
}
```

### Section: `elements`

Defines every interactive control in the application.

#### Element Types

**Range Slider:**
```json
"size": {
  "id": "size",
  "type": "range",
  "label": "Size",
  "state_path": "frame_design.finish_x",
  "show_when": {"shape": ["circular"]},
  "min": 24,
  "max": 60,
  "step": 1,
  "dynamic_max_by_sections": {
    "1": 30,
    "2": 42,
    "3": 54,
    "4": 60
  }
}
```

**Select Dropdown:**
```json
"shape": {
  "id": "shape",
  "type": "select",
  "label": "Shape",
  "state_path": "frame_design.shape",
  "options": [
    {"value": "circular", "label": "Circular"},
    {"value": "rectangular", "label": "Rectangular"}
  ]
}
```

#### Critical Properties

| Property | Purpose | Example |
|----------|---------|---------|
| `state_path` | Maps UI to backend state | `"frame_design.finish_x"` |
| `show_when` | Conditional visibility | `{"shape": ["circular"]}` |
| `dynamic_max_by_sections` | Max changes with N | `{"1": 30, "2": 42}` |

#### Conditional Visibility (`show_when`)

Controls when elements appear based on current state.

**Single condition:**
```json
"show_when": {"shape": ["circular"]}
```
Shows element only when shape is circular.

**Multiple conditions (AND logic):**
```json
"show_when": {
  "shape": ["circular", "diamond"],
  "slot_style": ["linear"]
}
```
Shows element when shape is circular OR diamond AND slot_style is linear.

#### Dynamic Max Values

Allows slider maximum to change based on number of sections (used for circular panel size limits based on CNC table capacity).

```json
"dynamic_max_by_sections": {
  "1": 30,   // n=1: max size 30"
  "2": 42,   // n=2: max size 42"
  "3": 54,   // n=3: max size 54"
  "4": 60    // n=4: max size 60"
}
```

**Keys must be strings**, not numbers.

### Section: `categories`

Defines navigation hierarchy for the four-panel UI architecture.

```json
"categories": {
  "wood": {
    "label": "WOOD",
    "subcategories": {
      "panel": {
        "label": "Panel",
        "filters": {},
        "options": {
          "layout_controls": {
            "type": "slider_group",
            "element_keys": ["size", "width", "height", "separation", "slots"]
          }
        }
      },
      "wood_species": {
        "label": "Species",
        "options": {
          "grid": {
            "type": "wood_species_image_grid"
          }
        }
      }
    }
  }
}
```

#### `element_keys` Array

Lists ALL possible sliders for a subcategory. The `show_when` conditions in `elements` determine which ones actually appear.

**Example:** For panel layout:
```json
"element_keys": ["size", "width", "height", "separation", "slots"]
```

- Circular shape → Shows: `size`, `separation`, `slots`
- Rectangular shape → Shows: `width`, `height`, `separation`, `slots`

### Editing Guidelines

**Add new slider:**

1. Add element definition:
```json
"elements": {
  "my_new_slider": {
    "id": "my_new_slider",
    "type": "range",
    "label": "My Parameter",
    "state_path": "pattern_settings.my_parameter",
    "min": 0,
    "max": 100,
    "step": 5
  }
}
```

2. Add to subcategory's `element_keys`:
```json
"element_keys": ["size", "width", "height", "my_new_slider"]
```

**Change slider range:**
```json
"slots": {
  "min": 12,  // Changed from 24
  "max": 144  // Changed from 120
}
```

**Add conditional visibility:**
```json
"my_slider": {
  "show_when": {
    "shape": ["rectangular"],
    "number_sections": [2, 3, 4]
  }
}
```

---

## 3. `wood_materials.json`

**Purpose:** Defines available wood species, texture file paths, rendering properties, and geometry constants for material application.

### Structure Overview

```json
{
  "default_species": "walnut-black-american",
  "default_grain_direction": "vertical",
  "species_catalog": [ ... ],
  "texture_config": { ... },
  "rendering_config": { ... },
  "geometry_constants": { ... }
}
```

### Section: `species_catalog`

Array of all available wood species.

```json
"species_catalog": [
  {
    "id": "walnut-black-american",
    "display": "Walnut",
    "wood_number": "109"
  },
  {
    "id": "cherry-black",
    "display": "Cherry",
    "wood_number": "085"
  }
]
```

| Field | Purpose | Example |
|-------|---------|---------|
| `id` | Unique identifier | "walnut-black-american" |
| `display` | User-facing name | "Walnut" |
| `wood_number` | Texture file prefix | "109" |

### Section: `texture_config`

Defines texture file structure and paths.

```json
"texture_config": {
  "size_map": {
    "large": {
      "folder": "Large_400cm",
      "dimensions": "300x400cm"
    }
  },
  "base_texture_path": "/assets/textures/wood"
}
```

#### Texture File Naming Convention

For species `walnut-black-american` (wood_number: `109`):

**Diffuse (color) texture:**
```
/assets/textures/wood/walnut-black-american/Varnished/Large_400cm/Diffuse/
  wood-109_walnut-black-american-varnished-300x400cm_d.png
```

**Normal map:**
```
/assets/textures/wood/walnut-black-american/Shared_Maps/Large_400cm/Normal/
  wood-109_walnut-black-american-300x400cm_n.png
```

**Roughness map:**
```
/assets/textures/wood/walnut-black-american/Shared_Maps/Large_400cm/Roughness/
  wood-109_walnut-black-american-300x400cm_r.png
```

### Section: `rendering_config`

Controls how materials are rendered in 3D.

```json
"rendering_config": {
  "grain_rotation_offset_degrees": 0.0,
  "grain_direction_angles": {
    "horizontal": 0,
    "vertical": 90,
    "radiant": "use_section_positioning",
    "diamond": "use_section_positioning_4_diamond"
  }
}
```

**Grain Angles:**
- `horizontal`: 0° (grain runs left-right)
- `vertical`: 90° (grain runs up-down)
- `radiant`: Uses section-specific angles from `geometry_constants`
- `diamond`: Uses diamond-specific angles from `geometry_constants`

### Section: `geometry_constants`

Defines angles for radiant/diamond grain patterns.

```json
"geometry_constants": {
  "section_positioning_angles": {
    "1": [0],
    "2": [0, 180],
    "3": [90, 330, 210],
    "4_radiant": [135, 45, 315, 225],
    "4_diamond": [45, 315, 225, 135]
  }
}
```

**Keys:**
- Simple numbers ("1", "2", "3"): For n=1/2/3 radial patterns
- `"4_radiant"`: Four sections with radiant grain
- `"4_diamond"`: Four sections with diamond grain

### Editing Guidelines

**Add new wood species:**

1. Add to catalog:
```json
{
  "id": "oak-red",
  "display": "Red Oak",
  "wood_number": "099"
}
```

2. Create texture directory:
```
/assets/textures/wood/oak-red/
  Varnished/Large_400cm/Diffuse/
  Shared_Maps/Large_400cm/Normal/
  Shared_Maps/Large_400cm/Roughness/
```

3. Name texture files:
```
wood-099_oak-red-varnished-300x400cm_d.png
wood-099_oak-red-300x400cm_n.png
wood-099_oak-red-300x400cm_r.png
```

**Change default wood:**
```json
"default_species": "cherry-black",  // Changed from walnut
"default_grain_direction": "horizontal"
```

---

## 4. `archetypes.json`

**Purpose:** Pre-configured design templates that users can select to instantly apply a complete set of parameters.

### Structure

Each archetype is a complete composition configuration.

```json
{
  "circular_radial_n2": {
    "id": "circular_radial_n2",
    "label": "Circular Radial - 2 Sections",
    "shape": "circular",
    "number_sections": 2,
    "slot_style": "radial",
    "number_slots": 48,
    "separation": 2.0,
    "thumbnail": "/assets/style/thumbnails/circular_radial_n2.png",
    "tooltip": "Classic split circular design"
  }
}
```

### Archetype Properties

| Field | Required | Purpose |
|-------|----------|---------|
| `id` | Yes | Unique identifier |
| `label` | Yes | Display name |
| `shape` | Yes | Panel shape |
| `number_sections` | Yes | Section count |
| `slot_style` | Yes | Pattern type |
| `number_slots` | Yes | Slot count |
| `separation` | Yes | Section gap |
| `side_margin` | No | Linear pattern margin |
| `thumbnail` | Yes | Preview image path |
| `tooltip` | Yes | Description text |

### When User Selects Archetype

All specified properties are applied to the composition state:

```
User clicks "circular_radial_n2" thumbnail
  ↓
ApplicationController applies:
  - shape = "circular"
  - number_sections = 2
  - slot_style = "radial"
  - number_slots = 48
  - separation = 2.0
  ↓
Backend regenerates geometry
  ↓
3D preview updates
```

### Editing Guidelines

**Add new archetype:**

1. Create entry:
```json
"rectangular_linear_n4": {
  "id": "rectangular_linear_n4",
  "label": "Rectangular Linear - 4 Sections",
  "shape": "rectangular",
  "number_sections": 4,
  "slot_style": "linear",
  "number_slots": 96,
  "separation": 1.0,
  "side_margin": 3.0,
  "thumbnail": "/assets/style/thumbnails/rectangular_linear_n4.png",
  "tooltip": "Modern four-panel linear design"
}
```

2. Generate thumbnail:
- Size: 256×256 pixels
- Place in: `/public/assets/style/thumbnails/`
- Format: PNG with transparency

**Modify existing archetype:**
```json
"circular_radial_n2": {
  "number_slots": 60,  // Changed from 48
  "separation": 3.0     // Changed from 2.0
}
```

---

## Configuration Validation

### Backend Validation

All config files are validated on application startup using Pydantic schemas in `services/dtos.py`.

**If validation fails:**
- Application won't start
- Error message indicates which file/field is invalid
- Check console for specific validation errors

### Common Validation Errors

**Type mismatch:**
```
Expected integer, got string: "48" → Use 48 (no quotes)
```

**Missing required field:**
```
Field required: 'species' missing from section_materials[0]
```

**Invalid enum value:**
```
"shape" must be one of: circular, rectangular, diamond
Got: "square"
```

---

## Configuration Workflow

### Development Cycle

1. **Edit config file** (any of the 4 JSON files)
2. **Save file**
3. **Restart backend** if you changed:
   - `composition_defaults.json`
   - `wood_materials.json`
   - `archetypes.json`
4. **Refresh browser** if you changed:
   - `ui_config.json` (frontend-only)
5. **Test changes** in application
6. **Verify 3D preview** updates correctly

### Hot Reload Behavior

- **Backend (Python):** Restarts automatically with `--reload` flag
- **Frontend (TypeScript):** Hot reloads automatically via Vite
- **Config files:** Require manual refresh/restart

---

## Common Configuration Tasks

### Change CNC Size Limits

**File:** `ui_config.json`

```json
"size": {
  "dynamic_max_by_sections": {
    "1": 36,  // Increased from 30
    "2": 48,  // Increased from 42
    "3": 60,  // Increased from 54
    "4": 72   // Increased from 60
  }
}
```

### Change Default Slot Count

**File:** `composition_defaults.json`

```json
"pattern_settings": {
  "number_slots": 72  // Changed from 48
}
```

### Add New Grain Direction

Not config-only - requires code changes in:
- `ui_config.json` - Add option
- `wood_materials.json` - Add rendering angle
- Frontend shader code - Handle new direction

### Change Texture Resolution

**File:** `wood_materials.json`

Add new size tier:
```json
"size_map": {
  "medium": {
    "folder": "Medium_200cm",
    "dimensions": "300x200cm"
  }
}
```

Update texture files to match new folder structure.

---

## Troubleshooting

### Config Not Loading

**Symptom:** Changes don't appear in app

**Fixes:**
1. Check JSON syntax (use JSONLint.com)
2. Restart backend server
3. Hard refresh browser (Ctrl+Shift+R)
4. Check browser console for errors

### UI Element Not Showing

**Symptom:** Slider/dropdown missing

**Check:**
1. `show_when` conditions - may be filtering it out
2. Element ID in `element_keys` array
3. `state_path` is valid
4. Browser console for errors

### Texture Not Loading

**Symptom:** Black mesh or missing texture

**Check:**
1. File path in `texture_config.base_texture_path`
2. Species `wood_number` matches filename
3. File exists in correct directory structure
4. File permissions (readable)
5. Browser console for 404 errors

### Archetype Not Applying

**Symptom:** Clicking thumbnail doesn't change design

**Check:**
1. Archetype ID is unique
2. All required fields present
3. Values are valid (shape, sections, slots)
4. Thumbnail path is correct
5. Browser console for errors

---

## Best Practices

### Configuration Naming

**Use descriptive IDs:**
```json
// Good
"circular_radial_n2"

// Bad
"preset1"
```

**Use consistent naming:**
- Species: `{wood}-{variety}-{region}` → "oak-red-american"
- Archetypes: `{shape}_{pattern}_n{sections}` → "circular_radial_n2"

### Version Control

**Always commit together:**
- Config changes
- Related code changes
- New asset files

**Use descriptive commit messages:**
```
feat: Add cherry wood species with textures
config: Increase max panel size to 72" for n=4
fix: Correct diamond grain angles for n=4
```

### Testing After Changes

**Checklist:**
- [ ] Application starts without errors
- [ ] UI elements appear correctly
- [ ] Conditional visibility works
- [ ] Archetype selection works
- [ ] 3D preview updates
- [ ] Textures load properly
- [ ] No console errors

---

## Reference: Config File Locations

```
config/
├── archetypes.json              # Design templates
├── composition_defaults.json    # Initial state values
├── ui_config.json               # UI elements & navigation
└── wood_materials.json          # Species & textures
```

**Backend loads from:** `config/` directory relative to project root

**Frontend fetches from:** API endpoints served by backend:
- `/api/config/archetypes`
- `/api/config/composition-defaults`
- `/api/config/ui`
- `/api/config/wood-materials`

---

## Support

**For configuration questions:**
- Review this README
- Check Technical Architecture Annex
- Consult Project Implementation Plans

**For adding new capabilities beyond config:**
- New shapes: Requires geometry generation code
- New UI patterns: Requires component development
- New processing: Requires backend service updates
