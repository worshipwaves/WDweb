// src/services/ConstraintResolver.ts

import type { SliderConfig } from '../types/PanelTypes';
import type { ArchetypeConstraint, CompositionStateDTO, ConstraintsConfig } from '../types/schemas';

/**
 * Interprets operational constraints from constraints.json based on the current application state.
 * This is the intelligence layer between raw constraint data and the UI.
 */
export class ConstraintResolver {
  constructor(private constraints: ConstraintsConfig) {
    if (!constraints.archetype_constraints) {
      throw new Error('Invalid constraints file: missing "archetype_constraints" section.');
    }
  }

  /**
   * Retrieves the specific constraint block for a given archetype ID.
   */
  public getArchetypeConstraints(archetypeId: string | null): ArchetypeConstraint | null {
    if (!archetypeId || !this.constraints.archetype_constraints[archetypeId]) {
      console.warn(`[Resolver] No constraints found for archetype: ${archetypeId ?? 'null'}`);
      return null;
    }
    return this.constraints.archetype_constraints[archetypeId];
  }

  /**
   * Resolves the complete slider configuration for a given archetype.
   * This is the primary method used by the UI to build the layout panel.
   */
  public resolveSliderConfigs(archetypeId: string, state: CompositionStateDTO): SliderConfig[] {
    const archetypeConstraints = this.getArchetypeConstraints(archetypeId);
    if (!archetypeConstraints) {
      return []; // Return no sliders if no constraints are defined
    }

    const { available_sliders } = archetypeConstraints;
    
    // UIEngine is available on the window object from main.ts
    const uiEngine = window.uiEngine; 
    if (!uiEngine) {
      console.error("[Resolver] UIEngine not available on window object.");
      return [];
    }

    const sliderConfigs = available_sliders.map((sliderKey): SliderConfig | null => {
      // The type assertion here is safe because we check for existence.
      const sliderConstraint = archetypeConstraints[sliderKey as keyof ArchetypeConstraint] as { min: number; max: number; step: number } | undefined;
      const elementConfig = uiEngine.getElementConfig(sliderKey);
      
      if (!sliderConstraint || !elementConfig) {
        console.warn(`[Resolver] Missing constraint or element config for slider: ${sliderKey}`);
        return null;
      }
      
      const currentValue = uiEngine.getStateValue(state, elementConfig.state_path) as number;
      
      // Clamp the current value to be within the new dynamic limits
      const clampedValue = Math.max(sliderConstraint.min, Math.min(currentValue, sliderConstraint.max));
      
      let finalMax = sliderConstraint.max;
      
      // Handle interdependent constraint for diamond_radial_n4 to update UI display
      if (archetypeId === 'diamond_radial_n4' && archetypeConstraints.interdependent) {
        if (sliderKey === 'width') {
          // If height is currently over 60, clamp my (width's) max to 60.
          // Otherwise, my max is the default from the constraints file (e.g., 84).
          finalMax = state.frame_design.finish_y > 60 ? 60 : sliderConstraint.max;
        }
        if (sliderKey === 'height') {
          // If width is currently over 60, clamp my (height's) max to 60.
          // Otherwise, my max is the default.
          finalMax = state.frame_design.finish_x > 60 ? 60 : sliderConstraint.max;
        }
      }

      // Clamp the current value against the new dynamic max for display
      const displayValue = Math.max(sliderConstraint.min, Math.min(currentValue, finalMax));

      return {
        id: sliderKey,
        label: elementConfig.label,
        min: sliderConstraint.min,
        max: finalMax,
        step: sliderConstraint.step,
        value: displayValue,
        unit: sliderKey === 'slots' ? '' : '"',
      };
    });

    // Filter out any nulls that may have occurred from missing configs
    return sliderConfigs.filter((s): s is SliderConfig => s !== null);
  }
}