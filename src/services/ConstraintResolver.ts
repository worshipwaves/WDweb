// src/services/ConstraintResolver.ts

import type { SliderConfig } from '../types/PanelTypes';
import type { CompositionStateDTO, ConstraintsConfig } from '../types/schemas';

/** Local type derived from ConstraintsConfig to avoid any-typed import */
type ArchetypeConstraint = ConstraintsConfig['archetype_constraints'][string];

interface WindowWithController extends Window {
  controller?: {
    getState: () => { ui?: { currentBackground?: { type: string; id: string } } };
    getMarginPresets: (state: import('../types/schemas').CompositionStateDTO) => import('../types/schemas').MarginPreset[];
  };
}

interface UIEngine {
  getElementConfig: (key: string) => { label: string; state_path: string } | undefined;
  getStateValue: (state: CompositionStateDTO, path: string) => unknown;
}

declare global {
  interface Window {
    uiEngine?: UIEngine;
  }
}

/**
 * Interprets operational constraints from constraints.json based on the current application state.
 * This is the intelligence layer between raw constraint data and the UI.
 */
export class ConstraintResolver {
  constructor(
    private constraints: ConstraintsConfig,
    private placementDefaults?: Record<string, unknown>
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
      return 2 * maxSectionWidth;
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
      return 2 * tableMaxX;
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
   * Calculate maximum slots for linear patterns based on CNC constraints.
   * Slot width must be at least bit_diameter + 1/16" to avoid tool breakage.
   * 
   * For rectangular/diamond n>2: end sections have side_margin, center sections don't.
   * This results in unequal usable widths requiring per-section calculation.
   */
  private calculateMaxSlotsLinear(
    shape: string,
    finishX: number,
    numSections: number,
    sideMargin: number,
    xOffset: number,
    yOffset: number,
    separation: number,
    spacer: number,
    bitDiameter: number,
    configMax: number
  ): number {
    const minSlotWidth = bitDiameter + 0.0625; // bit diameter + 1/16"
    const slotPlusSpace = minSlotWidth + spacer;
    
    let maxTotalSlots: number;
    
    if (shape === 'circular') {
      // Circular linear: symmetric sections
      let totalUsable: number;
      if (numSections === 1) {
        totalUsable = Math.max(0, finishX - 2 * (yOffset + sideMargin));
      } else {
        // n=2
        totalUsable = Math.max(0, finishX - 2 * (yOffset + sideMargin + xOffset) - separation);
      }
      maxTotalSlots = Math.floor((totalUsable + spacer) / slotPlusSpace);
      
    } else if ((shape === 'rectangular' || shape === 'diamond') && numSections > 2) {
      // Rectangular/Diamond linear n>2: unequal section widths
      // End sections have side_margin, center sections don't
      const sectionWidth = (finishX - separation * (numSections - 1)) / numSections;
      const endUsable = sectionWidth - sideMargin - 2 * xOffset;
      const centerUsable = sectionWidth - 2 * xOffset;
      
      const maxEndSlots = Math.floor((endUsable + spacer) / slotPlusSpace);
      const maxCenterSlots = Math.floor((centerUsable + spacer) / slotPlusSpace);
      
      if (numSections === 3) {
        // [end, center, end]
        maxTotalSlots = 2 * maxEndSlots + maxCenterSlots;
      } else {
        // n=4: [end, center, center, end]
        maxTotalSlots = 2 * maxEndSlots + 2 * maxCenterSlots;
      }
      
    } else {
      // Rectangular/Diamond linear n=1 or n=2: symmetric sections
      let totalUsable: number;
      if (numSections === 1) {
        totalUsable = finishX - 2 * sideMargin - 2 * xOffset;
      } else {
        // n=2: both sections have side_margin on outer edge
        totalUsable = finishX - 2 * sideMargin - 2 * xOffset * numSections - separation;
      }
      maxTotalSlots = Math.floor((totalUsable + spacer) / slotPlusSpace);
    }
    
    // Ensure valid positive integer (side_margin can consume all width)
    maxTotalSlots = Math.max(1, maxTotalSlots);
    
    return Math.min(maxTotalSlots, configMax);
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

    const archetypeConstraintsTyped = archetypeConstraints as { available_sliders: string[] };
    const available_sliders: string[] = archetypeConstraintsTyped.available_sliders;
    
    // UIEngine is available on the window object from main.ts
    const uiEngine: UIEngine | undefined = window.uiEngine;
    if (!uiEngine) {
      console.error("[Resolver] UIEngine not available on window object.");
      return [];
    }

    const sliderConfigs: (SliderConfig | null)[] = available_sliders.map((sliderKey: string): SliderConfig | null => {
      // The type assertion here is safe because we check for existence.
      const sliderConstraint = (archetypeConstraints as Record<string, unknown>)[sliderKey] as { min: number; max: number; step: number } | undefined;
      const elementConfig = uiEngine.getElementConfig(sliderKey);
      
      if (!sliderConstraint || !elementConfig) {
        console.warn(`[Resolver] Missing constraint or element config for slider: ${sliderKey}`);
        return null;
      }
      
      const currentValue = uiEngine.getStateValue(state, elementConfig.state_path) as number;
      
      // Clamp the current value to be within the new dynamic limits
      const _clampedValue = Math.max(sliderConstraint.min, Math.min(currentValue, sliderConstraint.max));
      
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
        const controller = (window as WindowWithController).controller;
        const fullState = controller?.getState();
        const currentBg = fullState?.ui?.currentBackground;
        if (currentBg && currentBg.type === 'rooms' && currentBg.id && this.constraints.scenes?.[currentBg.id]) {
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
        } else if (shape === 'diamond' && numSections === 1) {
          calculatedMax = sliderConstraint.max;
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
        // Only apply max_height to width for circular shapes (where width = height = diameter)
        const controller = (window as WindowWithController).controller;
        const fullState = controller?.getState();
        const currentBg = fullState?.ui?.currentBackground;
        if (shape === 'circular' && currentBg && currentBg.type === 'rooms' && currentBg.id && this.constraints.scenes?.[currentBg.id]) {
          const sceneConstraint = this.constraints.scenes[currentBg.id];
          if (sceneConstraint.max_height !== null && sceneConstraint.max_height !== undefined) {
            calculatedMax = Math.min(calculatedMax, sceneConstraint.max_height);
          }
        }
        
        finalMax = Math.min(sliderConstraint.max, calculatedMax);
      } else if (sliderKey === 'height') {
        let calculatedMax = sliderConstraint.max;
        if (shape === 'circular') {
          calculatedMax = this.calculateMaxDimensionCircular(numSections, sliderConstraint.min, sliderConstraint.max);
        } else if (shape === 'diamond' && numSections === 1) {
          calculatedMax = sliderConstraint.max;
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
        const currentBg = (window as WindowWithController).controller?.getState()?.ui?.currentBackground;
        if (currentBg && currentBg.type === 'rooms' && currentBg.id && this.constraints.scenes?.[currentBg.id]) {
          const sceneConstraint = this.constraints.scenes[currentBg.id];
          if (sceneConstraint.max_height !== null && sceneConstraint.max_height !== undefined) {
            // For circular shapes, both dimensions limited by scene max_height
            calculatedMax = Math.min(calculatedMax, sceneConstraint.max_height);
          }
        }
        
        finalMax = Math.min(sliderConstraint.max, calculatedMax);
      }

      // Apply CNC manufacturing constraints for slots (linear patterns only)
      if (sliderKey === 'slots' && slotStyle === 'linear') {
        const sideMargin = state.pattern_settings.side_margin;
        const slotStyleConstraints = this.constraints.manufacturing?.slot_style?.[slotStyle];
        if (!slotStyleConstraints) {
          throw new Error(`Missing manufacturing.slot_style.${slotStyle} in constraints.json`);
        }
        const xOffset = slotStyleConstraints.x_offset;
        const yOffset = state.pattern_settings.y_offset;
        const spacer = state.pattern_settings.spacer;
        const bitDiameter = state.pattern_settings.bit_diameter;
        const calculatedMax = this.calculateMaxSlotsLinear(
          shape,
          state.frame_design.finish_x,
          numSections,
          sideMargin,
          xOffset,
          yOffset,
          separation,
          spacer,
          bitDiameter,
          sliderConstraint.max
        );
        finalMax = Math.min(finalMax, calculatedMax);
      }

      // Ensure slots max is divisible by step (numSections for multi-panel)
      if (sliderKey === 'slots' && numSections > 1) {
        finalMax = Math.floor(finalMax / numSections) * numSections;
      }

      // Clamp the current value against the new dynamic max for display
      const displayValue = Math.max(sliderConstraint.min, Math.min(currentValue, finalMax));

      // Slots step: require divisibility by numSections for radial OR linear with n>1
      const step = sliderKey === 'slots'
        ? (slotStyle === 'radial' || numSections > 1 ? numSections : 1)
        : (sliderConstraint.step || 1);

      return {
        id: sliderKey,
        label: elementConfig.label,
        min: sliderConstraint.min,
        max: finalMax,
        step,
        value: displayValue,
        unit: sliderKey === 'slots' ? '' : '"',
        displayOffset: sliderKey === 'side_margin' ? 1 : undefined,
      };
    });

    // Filter out any nulls that may have occurred from missing configs
    let filteredConfigs = sliderConfigs.filter((s): s is SliderConfig => s !== null);
    
    // Hide side_margin for rectangular archetypes (backend handles symmetric distribution)
    if (state.frame_design.shape === 'rectangular') {
      filteredConfigs = filteredConfigs.filter(c => c.id !== 'side_margin');
    }
    
    return filteredConfigs;
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
    const pathMap: Record<string, (s: CompositionStateDTO) => string | number> = {
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