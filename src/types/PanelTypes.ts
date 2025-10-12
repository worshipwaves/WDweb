// src/types/PanelTypes.ts

/**
 * Configuration for CSG panel generation
 */
export interface PanelConfig {
    outerRadius: number;     // Panel outer radius in inches (or half-width for rectangular)
    thickness: number;       // Material thickness in inches
    separation: number;      // Gap between sections in inches
    numberSections: number;  // Number of sections (1-4)
    shape?: 'circular' | 'rectangular';  // Panel shape (default: circular)
}

/**
 * Data for a single slot to be cut via CSG
 */
export interface SlotData {
		vertices?: number[][];  // 4 vertices [x, y] in CNC coordinates
		x: number;             // Center X in CNC coordinates
		z: number;             // Center Z in CNC coordinates (Y in 2D)
		angle: number;         // Rotation angle in radians
		length: number;        // Radial length
		width?: number;        // Width (for reference)
		panelIndex?: number;   // Which panel section
}

/**
 * Combined CSG data from backend
 */
export interface CSGData {
    panel_config: PanelConfig;
    slot_data: SlotData[];
}