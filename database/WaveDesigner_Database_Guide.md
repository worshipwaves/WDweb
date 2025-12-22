# WaveDesigner Database Guide

## Your Mental Model vs Database Structure

You think in terms of: **Archetypes, Backing, Wood Species, Grain Direction, Rooms, Wall Finishes**

The database organizes these into 15 tables. Here's how they map:

| Your Concept | Tables |
|--------------|--------|
| Archetypes | archetypes, archetype_constraints |
| Backing | backing_type_configs, backing_materials, backing_config |
| Wood Species | wood_species, wood_config |
| Grain Direction | Stored in wood_config (valid list) and archetypes (available per archetype) |
| Rooms | background_rooms, background_config |
| Wall Finishes | background_paints, background_config |
| Other | manufacturing_constraints, composition_defaults, color_palettes, placement_defaults |

---

## Tables Grouped by Purpose

### ARCHETYPES (Design Styles)

#### `archetypes`
**What it stores:** The 18 design styles customers choose from (circular_radial_n1, rectangular_linear_n2, etc.)

| Column | Purpose |
|--------|---------|
| id | Unique key like "circular_radial_n2" |
| shape | circular, rectangular, or diamond |
| slot_style | radial or linear |
| label | Display name: "Circular Radial - 2 Sections" |
| tooltip | Hover text description |
| thumbnail | Path to preview image |
| number_sections | 1, 2, 3, or 4 |
| available_grains | Which grain directions work for this archetype |
| number_slots | Default slot count |
| separation | Default gap between sections (inches) |
| side_margin | For linear styles only |
| sort_order | Display order in UI |
| is_active | Set false to hide without deleting |

**When to edit:**
- Add a new design style
- Change default slot count for a style
- Update which grain directions are available
- Reorder how styles appear in the UI
- Disable a style temporarily

---

#### `archetype_constraints`
**What it stores:** Min/max limits for each archetype's sliders

| Column | Purpose |
|--------|---------|
| archetype_id | Links to archetypes table |
| available_sliders | Which sliders show: ["size", "slots", "separation"] |
| size_constraint | {"min": 24, "max": 42, "step": 1} |
| width_constraint | For rectangular/diamond shapes |
| height_constraint | For rectangular/diamond shapes |
| slots_constraint | {"min": 36, "max": 72} |
| separation_constraint | {"min": 0.5, "max": 4.0, "step": 0.5} |
| side_margin_constraint | For linear slot styles |

**When to edit:**
- Change the min/max size for an archetype
- Adjust slot count limits
- Add or remove a slider from the UI

---

### WOOD SPECIES

#### `wood_species`
**What it stores:** The catalog of available woods

| Column | Purpose |
|--------|---------|
| id | Unique key like "walnut-black-american" |
| display | Customer-facing name: "Walnut" |
| wood_number | Internal reference: "109" |
| sort_order | Display order in selector |
| is_active | Set false to hide without deleting |

**When to edit:**
- Add a new wood species
- Rename a species
- Reorder the species list
- Disable a species you no longer stock

---

#### `wood_config`
**What it stores:** Global wood settings (single row, id=1)

| Column | Purpose |
|--------|---------|
| valid_grain_directions | ["horizontal", "vertical", "radiant", "diamond"] |
| default_species | Which species is selected on load |
| default_grain_direction | Which grain is selected on load |
| texture_config | Size thresholds and folder paths |
| rendering_config | Grain angle mappings |
| geometry_constants | Section positioning angles |

**When to edit:**
- Change the default wood species
- Change the default grain direction
- Adjust texture size breakpoints
- Modify grain angle calculations (rare)

---

### BACKING MATERIALS

#### `backing_type_configs`
**What it stores:** The 4 backing categories

| Column | Purpose |
|--------|---------|
| type | "acrylic", "cloth", "leather", "foam" |
| display_name | Customer-facing: "Acrylic" |
| thickness_inches | Physical thickness for 3D rendering |
| inset_inches | How far backing sits inside frame |
| description | Category description |
| sort_order | Display order |
| is_active | Set false to hide category |

**When to edit:**
- Add a new backing category
- Change the thickness/inset dimensions
- Reorder backing type tabs
- Disable an entire backing category

---

#### `backing_materials`
**What it stores:** Individual materials within each type

| Column | Purpose |
|--------|---------|
| id | Composite key: "acrylic_black" |
| backing_type_id | Links to backing_type_configs |
| material_id | Short id: "black" |
| display | Customer-facing: "Black" |
| color_rgb | [R, G, B] values 0-1 |
| alpha | Transparency 0-1 |
| pbr_properties | {metallic, roughness, clearcoat...} |
| texture_files | For cloth/leather: {diffuse, normal, roughness paths} |
| sort_order | Order within the type |
| is_active | Set false to hide |

**When to edit:**
- Add a new color/material option
- Adjust the RGB color
- Tweak PBR rendering properties
- Update texture file paths
- Disable a specific material

---

#### `backing_config`
**What it stores:** Backing defaults (single row, id=1)

| Column | Purpose |
|--------|---------|
| default_enabled | Is backing ON when app loads? |
| default_type | Which type tab is selected |
| default_material | Which material is selected |

**When to edit:**
- Change whether backing is on/off by default
- Change which backing shows initially

---

### BACKGROUNDS (Staging)

#### `background_rooms`
**What it stores:** Room scenes for staging the artwork

| Column | Purpose |
|--------|---------|
| id | "living-room-modern", "minimalist_home_bedroom" |
| name | Display name: "Modern Living Room" |
| description | Scene description |
| path | Path to background image |
| foreground_path | Optional foreground overlay image |
| wall_compensation | Scale adjustment factor |
| art_placement | {position, scale_factor, rotation} |
| lighting | {direction, shadow settings, ambient} |
| sort_order | Display order |
| is_active | Set false to hide |

**When to edit:**
- Add a new room scene
- Adjust art positioning for a room
- Tweak lighting/shadows for a room
- Update image paths
- Disable a room

---

#### `background_paints`
**What it stores:** Wall colors and textures

| Column | Purpose |
|--------|---------|
| id | "soft-white", "brick-red" |
| name | Display name: "Soft White" |
| group_name | Category: "Whites", "Warm Neutrals", "Textures" |
| rgb | [R, G, B] for solid colors |
| texture_path | Path for textured finishes (brick, wood planks) |
| sort_order | Display order |
| is_active | Set false to hide |

**When to edit:**
- Add a new wall color
- Adjust an RGB value
- Add a new texture option
- Reorganize color groups
- Disable a color

---

#### `background_config`
**What it stores:** Background defaults (single row, id=1)

| Column | Purpose |
|--------|---------|
| default_room | Which room loads initially |
| default_wall_finish | Which wall color is selected |

**When to edit:**
- Change the default staging room
- Change the default wall color

---

### MANUFACTURING & CONSTRAINTS

#### `manufacturing_constraints`
**What it stores:** CNC and production limits (single row, id=1)

| Column | Purpose |
|--------|---------|
| valid_shapes | ["circular", "rectangular", "diamond"] |
| cnc_max_x, cnc_max_y | Physical table limits |
| circular_constraints | Size limits by section count |
| rectangular_constraints | Width/height min/max |
| diamond_constraints | Width/height min/max |
| slot_style_constraints | X-offset by slot style |
| scene_constraints | Max height per room |
| ui_visibility | Show/hide rules for UI elements |
| audio_constraints | Upload limits |

**When to edit:**
- Get a bigger CNC table (rare)
- Adjust shipping size limits
- Change max dimensions per room scene
- Modify audio upload limits

---

### COMPOSITION DEFAULTS

#### `composition_defaults`
**What it stores:** Default state for new compositions (single row, id=1)

| Column | Purpose |
|--------|---------|
| frame_design | Default shape, size, species, sections, backing |
| pattern_settings | Default slot style, count, offsets |
| audio_source | Default audio settings |
| audio_processing | Sample rate, silence removal settings |
| peak_control | Amplitude adjustment defaults |
| visual_correction | Nudge settings |
| display_settings | Debug toggles |
| export_settings | CNC margin defaults |
| artistic_rendering | Watercolor/ink/oil defaults |

**When to edit:**
- Change what a new design looks like on first load
- Adjust default audio processing settings
- Modify default artistic rendering style

---

#### `color_palettes`
**What it stores:** Artistic rendering color options

| Column | Purpose |
|--------|---------|
| id | "ocean", "sunset", "forest", "monochrome" |
| color_deep | [R, G, B, A] for deep tones |
| color_mid | [R, G, B, A] for mid tones |
| color_light | [R, G, B, A] for light tones |
| paper_color | Background color |
| sort_order | Display order |
| is_active | Set false to hide |

**When to edit:**
- Add a new color palette
- Adjust palette colors
- Disable a palette

---

#### `placement_defaults`
**What it stores:** Per-room placement overrides (single row, id=1)

| Column | Purpose |
|--------|---------|
| scene_overrides | JSON with room-specific placement adjustments |

**When to edit:**
- Fine-tune art positioning for specific rooms

---

### SYSTEM

#### `alembic_version`
**What it stores:** Database migration tracking

**Never edit manually.** Alembic uses this to know which migrations have run.

---

## Common Workflows

### "I want to add a new wood species"

1. Open pgAdmin > wavedesigner > Tables > wood_species
2. Right-click > View/Edit Data > All Rows
3. Add row: id="new-species-id", display="Display Name", wood_number="XXX", sort_order=15, is_active=true
4. Save (F6)
5. Restart uvicorn
6. Add texture files to /assets/textures/wood/[size]/new-species-id/

### "I want to disable an archetype"

1. Open archetypes table
2. Find the row, set is_active = false
3. Save and restart uvicorn

### "I want to change the default room"

1. Open background_config table (single row)
2. Change default_room to the room id you want
3. Save and restart uvicorn

### "I want to add a new backing color"

1. Open backing_materials table
2. Add row with id="acrylic_newcolor", backing_type_id="acrylic", material_id="newcolor", display="New Color", color_rgb=[R,G,B], pbr_properties={"metallic":0,"roughness":0.2,...}
3. Save and restart uvicorn

---

## Important Notes

1. **Restart required:** The app caches config at startup. After database edits, restart uvicorn.

2. **is_active pattern:** Never delete rows - set is_active=false instead. This preserves data integrity.

3. **sort_order:** Controls display order in the UI. Lower numbers appear first.

4. **JSONB columns:** texture_config, pbr_properties, art_placement, lighting are JSON. Edit carefully.

5. **Foreign keys:** Some tables link to others (e.g., archetype_constraints.archetype_id must exist in archetypes). Add parent rows first.
