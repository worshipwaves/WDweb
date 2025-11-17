// src/services/ConstraintResolver.ts

import type { SliderConfig } from '../types/PanelTypes';
import type { ArchetypeConstraint, CompositionStateDTO, ConstraintsConfig } from '../types/schemas';

/**
 * Interprets operational constraints from constraints.json based on the current application state.
 * This is the intelligence layer between raw constraint data and the UI.
 */
export class ConstraintResolver {
  constructor(
    private constraints: ConstraintsConfig,
    private placementDefaults?: any
  ) {
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
   * Calculate max width based on CNC table constraints
   */
  private calculateMaxWidthRectLinear(
    numSections: number,
    currentHeight: number,
    separation: number,
    tableMaxX: number,
    tableMaxY: number,
    minWidth: number
  ): number {
    const sectionHeight = currentHeight;
    
    if (sectionHeight <= tableMaxX) {
      const maxSectionWidth = tableMaxY;
      return numSections * maxSectionWidth + (numSections - 1) * separation;
    } else if (sectionHeight <= tableMaxY) {
      const maxSectionWidth = tableMaxX;
      return numSections * maxSectionWidth + (numSections - 1) * separation;
    } else {
      return minWidth;
    }
  }

  private calculateMaxHeightRectLinear(
    numSections: number,
    currentWidth: number,
    separation: number,
    tableMaxX: number,
    tableMaxY: number,
    minHeight: number
  ): number {
    const sectionWidth = (currentWidth - (numSections - 1) * separation) / numSections;
    
    if (sectionWidth <= tableMaxX) {
      return tableMaxY;
    } else if (sectionWidth <= tableMaxY) {
      return tableMaxX;
    } else {
      return minHeight;
    }
  }

  private calculateMaxWidthRectRadialN4(
    currentHeight: number,
    separation: number,
    tableMaxX: number,
    tableMaxY: number,
    minWidth: number
  ): number {
    const sectionHeight = (currentHeight - separation) / 2;
    
    if (sectionHeight <= tableMaxX) {
      const maxSectionWidth = tableMaxY;
      return 2 * maxSectionWidth + separation;
    } else if (sectionHeight <= tableMaxY) {
      const maxSectionWidth = tableMaxX;
      return 2 * maxSectionWidth + separation;
    } else {
      return minWidth;
    }
  }

  private calculateMaxHeightRectRadialN4(
    currentWidth: number,
    separation: number,
    tableMaxX: number,
    tableMaxY: number,
    minHeight: number
  ): number {
    const sectionWidth = (currentWidth - separation) / 2;
    
    if (sectionWidth <= tableMaxX) {
      return 2 * tableMaxY + separation;
    } else if (sectionWidth <= tableMaxY) {
      return 2 * tableMaxX + separation;
    } else {
      return minHeight;
    }
  }

  private calculateMaxDimensionCircular(
    numSections: number,
    minDim: number,
    maxDim: number
  ): number {
    const knownLimits: Record<number, number> = {
      1: 30,
      2: 42,
      3: 54,
      4: 60
    };
    
    return knownLimits[numSections] ?? Math.min(maxDim, 30);
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
      
      // Apply CNC table constraints for width/height sliders
      const tableMaxX = this.constraints.manufacturing?.cnc_table?.max_x ?? 30;
      const tableMaxY = this.constraints.manufacturing?.cnc_table?.max_y ?? 42;
      const shape = state.frame_design.shape;
      const slotStyle = state.pattern_settings.slot_style;
      const numSections = state.frame_design.number_sections;
      const separation = state.frame_design.separation;
			
			if (sliderKey === 'size') {
        let calculatedMax = sliderConstraint.max;
        if (shape === 'circular') {
          calculatedMax = this.calculateMaxDimensionCircular(numSections, sliderConstraint.min, sliderConstraint.max);
        }
        
        // Apply scene-specific constraints from constraints.json
        const controller = (window as any).controller;
        const fullState = controller?.getState();
        const currentBg = fullState?.ui?.currentBackground;
        if (currentBg?.type === 'rooms' && this.constraints.scenes?.[currentBg.id]) {
          const sceneConstraint = this.constraints.scenes[currentBg.id];
          if (sceneConstraint.max_height !== null && sceneConstraint.max_height !== undefined) {
            calculatedMax = Math.min(calculatedMax, sceneConstraint.max_height);
          }
        }
        
        finalMax = Math.min(sliderConstraint.max, calculatedMax);
      } else if (sliderKey === 'width') {
        let calculatedMax = sliderConstraint.max;
        if (shape === 'circular') {
          calculatedMax = this.calculateMaxDimensionCircular(numSections, sliderConstraint.min, sliderConstraint.max);
        } else if (shape === 'rectangular' || shape === 'diamond') {
          if (slotStyle === 'linear') {
            calculatedMax = this.calculateMaxWidthRectLinear(
              numSections,
              state.frame_design.finish_y,
              separation,
              tableMaxX,
              tableMaxY,
              sliderConstraint.min
            );
          } else if (numSections === 4) {
            calculatedMax = this.calculateMaxWidthRectRadialN4(
              state.frame_design.finish_y,
              separation,
              tableMaxX,
              tableMaxY,
              sliderConstraint.min
            );
          } else {
            calculatedMax = this.calculateMaxWidthRectLinear(
              numSections,
              state.frame_design.finish_y,
              separation,
              tableMaxX,
              tableMaxY,
              sliderConstraint.min
            );
          }
        }
        
        // Apply scene-specific constraints from constraints.json
        const controller = (window as any).controller;
        const fullState = controller?.getState();
        const currentBg = fullState?.ui?.currentBackground;
        if (currentBg?.type === 'rooms' && this.constraints.scenes?.[currentBg.id]) {
          const sceneConstraint = this.constraints.scenes[currentBg.id];
          if (sceneConstraint.max_height !== null && sceneConstraint.max_height !== undefined) {
            // For circular shapes, both dimensions limited by scene max_height
            calculatedMax = Math.min(calculatedMax, sceneConstraint.max_height);
          }
        }
        
        finalMax = Math.min(sliderConstraint.max, calculatedMax);
      } else if (sliderKey === 'height') {
        let calculatedMax = sliderConstraint.max;
        if (shape === 'circular') {
          calculatedMax = this.calculateMaxDimensionCircular(numSections, sliderConstraint.min, sliderConstraint.max);
        } else if (shape === 'rectangular' || shape === 'diamond') {
          if (slotStyle === 'linear') {
            calculatedMax = this.calculateMaxHeightRectLinear(
              numSections,
              state.frame_design.finish_x,
              separation,
              tableMaxX,
              tableMaxY,
              sliderConstraint.min
            );
          } else if (numSections === 4) {
            calculatedMax = this.calculateMaxHeightRectRadialN4(
              state.frame_design.finish_x,
              separation,
              tableMaxX,
              tableMaxY,
              sliderConstraint.min
            );
          } else {
            calculatedMax = this.calculateMaxHeightRectLinear(
              numSections,
              state.frame_design.finish_x,
              separation,
              tableMaxX,
              tableMaxY,
              sliderConstraint.min
            );
          }
        }
        
        // Apply scene-specific constraints from constraints.json
        const currentBg = (window as any).controller?.getState()?.ui?.currentBackground;
        if (currentBg?.type === 'rooms' && this.constraints.scenes?.[currentBg.id]) {
          const sceneConstraint = this.constraints.scenes[currentBg.id];
          if (sceneConstraint.max_height !== null && sceneConstraint.max_height !== undefined) {
            // For circular shapes, both dimensions limited by scene max_height
            calculatedMax = Math.min(calculatedMax, sceneConstraint.max_height);
          }
        }
        
        finalMax = Math.min(sliderConstraint.max, calculatedMax);
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