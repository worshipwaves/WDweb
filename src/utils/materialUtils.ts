// src/utils/materialUtils.ts

import type { WoodMaterialsConfig, SmartCsgResponse } from '../types/schemas';

/**
 * Calculate grain angle based on direction and section configuration.
 * Uses angles from backend configuration (single source of truth).
 * @param csgData The current CSG data response, used to check panel shape. This is an explicit dependency.
 */
export function calculateGrainAngle(
  direction: string,
  sectionId: number,
  numberSections: number,
  config: WoodMaterialsConfig,
  csgData: SmartCsgResponse | null
): number {
  const directionAngles = config.rendering_config.grain_direction_angles;
  const angleOrKey = directionAngles[direction];

  if (typeof angleOrKey === 'number') {
    if (csgData?.csg_data?.panel_config?.shape === 'rectangular') {
      return (angleOrKey + 90) % 360;
    }
    return angleOrKey;
  }

  if (typeof angleOrKey === 'string') {
    let anglesKey = '';
    
    if (angleOrKey.startsWith('use_section_positioning_')) {
      anglesKey = angleOrKey.substring('use_section_positioning_'.length);
    } else if (angleOrKey === 'use_section_positioning') {
      anglesKey = numberSections === 4 ? '4_radiant' : String(numberSections);
    }
    
    if (anglesKey) {
      const angles = config.geometry_constants.section_positioning_angles[anglesKey];
      if (angles && typeof angles[sectionId] === 'number') {
        if (csgData?.csg_data?.panel_config?.shape === 'rectangular') {
          return (angles[sectionId] + 90) % 360;
        }
        return angles[sectionId];
      }
    }
  }
  
  console.warn(`[materialUtils] No angle found for direction "${direction}", section ${sectionId}, n=${numberSections}`);
  return 0;
}