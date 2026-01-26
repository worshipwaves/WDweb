import {
    Scene,
    Mesh
} from '@babylonjs/core';

import { PanelGenerationService } from './PanelGenerationService';
import { PanelConfig, SlotData } from './types/PanelTypes';

interface CSGDataResponse {
    panel_config: {
        finish_x: number;
        finish_y: number;
        thickness: number;
        separation: number;
        number_sections: number;
        shape?: string;
        slot_style?: string;
    };
    slot_data: Array<{
        vertices?: number[][];
        x: number;
        z: number;
        angle: number;
        length: number;
        width?: number;
        panelIndex?: number;
    }>;
    section_edges?: Array<{
        section_index: number;
        edge1_start: number[];
        edge1_end: number[];
        edge2_start: number[];
        edge2_end: number[];
    }>;
    asymmetric_config?: {
        gap: number;
        large_finish_x: number;
        small_finish_x: number;
        large_slots: Array<{
            vertices?: number[][];
            x: number;
            z: number;
            angle: number;
            length: number;
            width?: number;
        }>;
        small_slots: Array<{
            vertices?: number[][];
            x: number;
            z: number;
            angle: number;
            length: number;
            width?: number;
        }>;
    };
}

export class FrameGenerationService {
    private scene: Scene;
    private panelService: PanelGenerationService;

    constructor(scene: Scene) {
        this.scene = scene;
        this.panelService = new PanelGenerationService(scene);
    }

    /**
     * Creates the panel mesh using CSG operations.
     * Fetches configuration from backend and delegates to PanelGenerationService.
     */
		public createFrameMeshes(data: CSGDataResponse): Mesh[] {
				try {
						const slotStyle = data.panel_config.slot_style || 'radial';
						
						// Handle asymmetric: create 4 meshes (2 large, 2 small) with gap positioning
						if (slotStyle === 'asymmetric' && data.asymmetric_config) {
								return this.createAsymmetricMeshes(data);
						}
						
						// Map backend snake_case to frontend camelCase
						const config: PanelConfig = {
								finishX: data.panel_config.finish_x,
								finishY: data.panel_config.finish_y,
								thickness: data.panel_config.thickness,
								separation: data.panel_config.separation,
								numberSections: data.panel_config.number_sections,
								shape: data.panel_config.shape || 'circular',
								slotStyle: slotStyle
						};
						
						const slots: SlotData[] = data.slot_data || [];
						const sectionEdges = data.section_edges || [];
						
						const panels = this.panelService.createPanelsWithCSG(config, slots, sectionEdges);
						
						return panels;
				} catch (error: unknown) {
						console.error('[POC] Error creating frame meshes:', error);
						throw error;
				}
		}
		
		/**
		 * Create meshes for asymmetric archetype: 4 semi-circles (2 large, 2 small)
		 * positioned with calculated gap. Toggle controls visibility pairs.
		 */
		private createAsymmetricMeshes(data: CSGDataResponse): Mesh[] {
				const cfg = data.asymmetric_config!;
				const thickness = data.panel_config.thickness;
				
				// Large config (separation=0 for standalone n=2)
				const largeConfig: PanelConfig = {
						finishX: cfg.large_finish_x,
						finishY: cfg.large_finish_x,
						thickness,
						separation: 0,
						numberSections: 2,
						shape: 'circular',
						slotStyle: 'radial'
				};
				
				// Small config (separation=0 for standalone n=2)
				const smallConfig: PanelConfig = {
						finishX: cfg.small_finish_x,
						finishY: cfg.small_finish_x,
						thickness,
						separation: 0,
						numberSections: 2,
						shape: 'circular',
						slotStyle: 'radial'
				};
				
				// Create meshes with their respective slots
				const largeMeshes = this.panelService.createPanelsWithCSG(largeConfig, cfg.large_slots as SlotData[]);
				const smallMeshes = this.panelService.createPanelsWithCSG(smallConfig, cfg.small_slots as SlotData[]);
				
				// Position meshes with gap between flat edges
				// Note: Visual left = +X, Visual right = -X in scene coordinate system
				const halfGap = cfg.gap / 2.0;
				
				largeMeshes[0].position.x = -halfGap;  // Large right: visual right
				largeMeshes[1].position.x = halfGap;   // Large left: visual left
				smallMeshes[0].position.x = -halfGap;  // Small right: visual right
				smallMeshes[1].position.x = halfGap;   // Small left: visual left
				
				// Rename for clarity and set initial visibility
				// Default: Large on LEFT, Small on RIGHT
				largeMeshes[0].name = 'asymmetric_large_right';
				largeMeshes[1].name = 'asymmetric_large_left';
				smallMeshes[0].name = 'asymmetric_small_right';
				smallMeshes[1].name = 'asymmetric_small_left';
				
				// Initial visibility: large left + small right visible
				largeMeshes[0].setEnabled(false);  // Large right hidden
				largeMeshes[1].setEnabled(true);   // Large left visible
				smallMeshes[0].setEnabled(true);   // Small right visible
				smallMeshes[1].setEnabled(false);  // Small left hidden
				
				// Return all 4 meshes: indices 0-1 are visible, 2-3 are hidden alternates
				// Section 0 = right (small_right visible), Section 1 = left (large_left visible)
				return [smallMeshes[0], largeMeshes[1], largeMeshes[0], smallMeshes[1]];
		}
		
		// Keep old method for backwards compatibility during transition
		public createFrameMesh(data: CSGDataResponse): Mesh {
				console.warn('[POC] Using deprecated createFrameMesh - should use createFrameMeshes');
				const meshes = this.createFrameMeshes(data);
				return meshes[0];
		}
}