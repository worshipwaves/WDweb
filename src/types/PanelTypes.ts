// src/types/PanelTypes.ts

/**
 * Configuration for CSG panel generation
 */
export interface PanelConfig {
    finishX: number;         // Total composition width in inches
    finishY: number;         // Total composition height in inches
    thickness: number;       // Material thickness in inches
    separation: number;      // Gap between sections in inches
    numberSections: number;  // Number of sections (1-4)
    shape: 'circular' | 'rectangular';  // Panel shape
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