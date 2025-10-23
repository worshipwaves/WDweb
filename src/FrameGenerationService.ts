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
        edge1_start: number[];  // [x, y] inner vertex
        edge1_end: number[];    // [x, y] arc start
        edge2_start: number[];  // [x, y] arc end  
        edge2_end: number[];    // [x, y] inner vertex
    }>;
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
						// Map backend snake_case to frontend camelCase
						const config: PanelConfig = {
								finishX: (data.panel_config as { finish_x: number }).finish_x,
								finishY: data.panel_config.finish_y,
								thickness: data.panel_config.thickness,
								separation: data.panel_config.separation,
								numberSections: data.panel_config.number_sections,
								shape: data.panel_config.shape || 'circular'
						};
						
						const slots: SlotData[] = data.slot_data || [];

						// Pass section edges if available (for n=3)
						const sectionEdges = data.section_edges || [];
						
						// Create panels using CSG - now returns array
						const panels = this.panelService.createPanelsWithCSG(config, slots, sectionEdges);
						
						return panels;
				} catch (error: unknown) {
						console.error('[POC] Error creating frame meshes:', error);
						throw error;
				}
		}
		
		// Keep old method for backwards compatibility during transition
		public createFrameMesh(data: CSGDataResponse): Mesh {
				console.warn('[POC] Using deprecated createFrameMesh - should use createFrameMeshes');
				const meshes = this.createFrameMeshes(data);
				return meshes[0];
		}
}