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
      if (archetypeConstraints.interdependent) {
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
	
	/**
   * Determines if a UI element should be visible based on the current state.
   * Reads rules from the `ui_visibility` section of constraints.
   */
  public isElementVisible(elementKey: string, state: CompositionStateDTO): boolean {
    const rules = this.constraints.ui_visibility?.elements[elementKey];
    if (!rules?.show_when) {
      return true; // Default to visible if no rules are defined
    }

    return this._evaluateConditions(rules.show_when, state);
  }

  /**
   * Determines if a specific option within an element should be disabled.
   */
  public isOptionDisabled(elementKey: string, optionValue: string | number, state: CompositionStateDTO): boolean {
    const rules = this.constraints.ui_visibility?.options[elementKey]?.[optionValue];
    if (!rules?.disabled_when) {
      return false; // Default to enabled
    }

    return this._evaluateConditions(rules.disabled_when, state);
  }

  /**
   * Determines if a specific option within an element should be shown.
   */
  public isOptionVisible(elementKey: string, optionValue: string | number, state: CompositionStateDTO): boolean {
    const rules = this.constraints.ui_visibility?.options[elementKey]?.[optionValue];
    if (!rules?.show_when) {
      return true; // Default to visible
    }
    return this._evaluateConditions(rules.show_when, state);
  }

  /**
   * Evaluates a set of conditions against the current composition state.
   */
  private _evaluateConditions(conditions: Record<string, (string | number)[]>, state: CompositionStateDTO): boolean {
    // A simple map to resolve common keys to their full state path
    const pathMap: Record<string, (s: CompositionStateDTO) => any> = {
      shape: (s) => s.frame_design.shape,
      number_sections: (s) => s.frame_design.number_sections,
      slot_style: (s) => s.pattern_settings.slot_style,
    };

    for (const [key, allowedValues] of Object.entries(conditions)) {
      const valueGetter = pathMap[key];
      if (!valueGetter) {
        console.warn(`[Resolver] Unknown condition key: ${key}`);
        continue;
      }
      const currentValue = valueGetter(state);
      if (!allowedValues.includes(currentValue)) {
        return false; // Condition not met
      }
    }
    return true; // All conditions met
  }
	
	/**
   * Retrieves the audio upload constraints.
   */
  public getAudioUploadConstraints() {
    if (this.constraints.audio?.upload) {
      return this.constraints.audio.upload;
    }
    // Return safe defaults if the config section is missing
    console.warn('[Resolver] Audio constraints not found in config, using safe defaults.');
    return {
      accepted_mime_types: ['audio/*'],
      accepted_extensions: ['mp3', 'wav', 'flac', 'm4a'],
      max_file_size_mb: 100,
    };
  }
}