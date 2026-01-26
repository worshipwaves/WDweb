// src/types/PanelTypes.ts
import type { MarginPreset } from './schemas';

/**
 * Configuration for CSG panel generation
 */
export interface PanelConfig {
    finishX: number;         // Total composition width in inches
    finishY: number;         // Total composition height in inches
    thickness: number;       // Material thickness in inches
    separation: number;      // Gap between sections in inches
    numberSections: number;  // Number of sections (1-4)
    shape: 'circular' | 'rectangular' | 'diamond';  // Panel shape
}

/**
 * Calculated dimensions and position for a single section
 */
export interface SectionDimensions {
    width: number;   // Section width in inches
    height: number;  // Section height in inches
    offsetX: number; // X offset from composition origin (inches)
    offsetY: number; // Y offset from composition origin (inches)
}

/**
 * Backing material configuration
 */
export interface BackingConfig {
    enabled: boolean;
    type: 'acrylic' | 'cloth' | 'leather' | 'foam';
    material: string;
    inset: number;
}

/**
 * Backing mesh parameters from backend
 */
export interface BackingParameters {
    enabled: boolean;
    type?: string;
    material?: string;
    sections?: Array<{
        shape: string;
        width: number;
        height: number;
        thickness: number;
        position_x: number;
        position_y: number;
        position_z: number;
        inset: number;
    }>;
    material_properties?: {
        id: string;
        display: string;
        color_rgb: number[];
        alpha?: number;
        pbr_properties: {
            metallic: number;
            roughness: number;
            clearcoat_intensity?: number;
            clearcoat_roughness?: number;
        };
        texture_files?: {
            diffuse: string;
            normal: string;
        };
    };
		csg_config?: {
        finish_x: number;
        finish_y: number;
        separation: number;
    };
		section_edges?: Array<{
        section_index: number;
        edge1_start: number[];
        edge1_end: number[];
        edge2_start: number[];
        edge2_end: number[];
    }>;
}

/**
 * Data for a single slot to be cut via CSG
 */
export interface SlotData {
    vertices?: number[][];  // 4 vertices [x, y] in CNC coordinates
    x: number;              // Center X in CNC coordinates
    z: number;              // Center Z in CNC coordinates (Y in 2D)
    angle: number;          // Rotation angle in radians
    length: number;         // Radial length
    width?: number;         // Width (for reference)
    panelIndex?: number;    // Legacy - which panel this belongs to
}

/**
 * Combined CSG data from backend
 */
export interface CSGData {
    panel_config: PanelConfig;
    slot_data: SlotData[];
    section_local_centers: [number, number][];  // Local center [x, y] for each section
    true_min_radius: number;  // Minimum radius where slots begin
}

// ============================================
// UI NAVIGATION TYPES (Hero Forge-style panels)
// ============================================

/**
 * Configuration for left panel category buttons
 */
export interface CategoryConfig {
  id: string;
  label: string;
  icon: string; // Unicode emoji
  enabled: boolean;
}

/**
 * Configuration for panel content routing
 */
export interface PanelContentConfig {
  category: string;
  component: string;
  data?: Record<string, unknown>;
}

/**
 * Base interface for all panel components
 * Architecture: Components are stateless, render based on input, emit events
 */
export interface PanelComponent {
  /**
   * Render component to DOM element
   * @returns HTMLElement with event handlers attached
   */
  render(): HTMLElement;
  
  /**
   * Clean up event listeners and DOM references
   */
  destroy(): void;
}

/**
 * Configuration for thumbnail grid items
 */
export interface ThumbnailItem {
  id: string;
  label: string;
  thumbnailUrl?: string;
  disabled?: boolean;
  tooltip?: string;
  rgb?: [number, number, number];
}

/**
 * Configuration for slider controls
 */
export interface SliderConfig {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: string;
  displayOffset?: number;  // Offset added to display value (e.g., 1 shows "1" when value is 0)
  discretePresets?: MarginPreset[];  // For discrete side_margin selection
  selectedPresetNEnd?: number;  // Currently selected preset's n_end value
}

/**
 * Configuration for right panel options
 */
export interface PanelOption {
  id: string;
  label: string;
  value: string | number;
  thumbnail?: string;
  action?: 'select' | 'navigate';
}

// ============================================================================
// FOUR-PANEL ARCHITECTURE TYPES (STYLE Category Config)
// ============================================================================

/**
 * Configuration for thumbnail paths and extensions
 */
export interface ThumbnailConfig {
  base_path: string;
  filter_base_path: string;
  extension: string;
}

/**
 * Filter option for Right Secondary panel
 */
export interface FilterOption {
  id: string;
  label: string;
  thumbnail: string;
	tooltip?: string;
}

/**
 * Filter configuration (shape, slot_pattern, etc.)
 */
export interface FilterConfig {
  type: 'single' | 'stack';
  label: string;
  ui_state_path: string;
  options: FilterOption[];
  default: string;
}

/**
 * Accordion open/close state for a category
 */
export interface AccordionState {
  [subcategoryId: string]: boolean;
}

/**
 * Accordion state map for all categories
 */
export interface AccordionStateMap {
  [categoryId: string]: AccordionState;
}

/**
 * Filter icon group for FilterIconStrip component
 */
export interface FilterIconGroup {
  id: string;
  type: 'shape' | 'waveform' | 'category';
  label: string;
  icons: FilterIconDefinition[];
}

/**
 * Individual filter icon definition
 */
export interface FilterIconDefinition {
  id: string;
  svgPath: string;
	label?: string;
  tooltip: string;
  stateValue: string;
}

/**
 * Individual thumbnail configuration
 */
export interface ThumbnailOptionConfig {
  label: string;
  tooltip: string;
}

/**
 * Options configuration for a subcategory
 */
export interface OptionsConfig {
  label: string;
  type?: string;
  archetype_source?: string;
  display_field?: string;
  sort_by?: string;
  validation_rules?: Record<string, number[]>;
  thumbnails?: Record<string, ThumbnailOptionConfig>;
}

/**
 * Subcategory configuration (panel, assembled, etc.)
 */
export interface SubcategoryConfig {
  label: string;
  panel_title?: string;
  panel_help?: string;
  note?: string;
	enables_section_selection?: boolean;
  filters: Record<string, FilterConfig>;
  options: Record<string, OptionsConfig>;
}

/**
 * Category configuration (style, audio, etc.)
 */
export interface StyleCategoryConfig {
  label: string;
  subcategories: Record<string, SubcategoryConfig>;
}

/**
 * Top-level categories configuration
 */
export interface CategoriesConfig {
  style: StyleCategoryConfig;
}