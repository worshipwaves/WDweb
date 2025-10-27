/**
 * RightPanelContent.ts
 * Renders category-specific content for right panel
 * 
 * Architecture: Presentation-only component
 * - Returns PanelComponent instances with event handlers
 * - No state storage
 * - No hardcoded defaults (all from config)
 * - Assumes state is pre-validated by Zod
 */

import type { PanelComponent } from '../types/PanelTypes';
import type { CompositionStateDTO } from '../types/schemas';

import { GrainDirectionGrid } from './GrainDirectionGrid';
import { SimplePanel } from './SimplePanel';
import { SliderGroup } from './SliderGroup';
import { ThumbnailGrid } from './ThumbnailGrid';
import { WoodSpeciesGrid } from './WoodSpeciesGrid';

interface UIConfig {
  elements: Record<string, unknown>;
}

interface ShapeOption {
  value: string;
  label: string;
}

interface ConfigOption {
  value: string | number;
  label: string;
}

interface ElementConfig {
  options?: ConfigOption[];
}

export class RightPanelContentRenderer {
  /**
   * Main entry point - renders content based on category
   * @param category - Category ID to render
   * @param state - Current composition state (validated by Zod)
   * @param config - UI configuration from default_parameters.json
   * @param onOptionSelected - Callback for option selection
   */
  renderContent(
    category: string,
    state: CompositionStateDTO,
    config: UIConfig,
    onOptionSelected: (option: string, value: unknown) => void
  ): PanelComponent {
    switch (category) {
      case 'audio':
        return this._renderAudioOptions();
      case 'style':
        return this._renderStyleOptions(state, config, onOptionSelected);
      case 'layout':
        return this._renderLayoutOptions(state, config, onOptionSelected);
      case 'wood':
        return this._renderWoodOptions(state, config, onOptionSelected);
      case 'backing':
        return this._renderBackingOptions();
      default:
        return new SimplePanel('<div class="panel-placeholder">Coming soon...</div>');
    }
  }

  private _renderAudioOptions(): PanelComponent {
    const html = `
      <div class="panel-header">
        <h3>Audio Settings</h3>
      </div>
      <div class="panel-body">
        <div class="panel-placeholder">
          <p>Audio waveform customization coming soon</p>
        </div>
      </div>
    `;
    return new SimplePanel(html);
  }

  private _renderStyleOptions(
    state: CompositionStateDTO,
    config: UIConfig,
    onOptionSelected: (option: string, value: unknown) => void
  ): PanelComponent {
    // Create wrapper that combines multiple sections
    const container = document.createElement('div');
    container.className = 'panel-content';

    // Header
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = '<h3>Panel Style</h3>';
    container.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'panel-body';

    // Shape options group
    const shapeGroup = document.createElement('div');
    shapeGroup.className = 'option-group';
    const shapeLabel = document.createElement('label');
    shapeLabel.className = 'option-label';
    shapeLabel.textContent = 'Shape';
    shapeGroup.appendChild(shapeLabel);

    const shapeOptions = this._getShapeOptions(config);
    const currentShape = state.frame_design.shape;
    const shapeThumbnails = new ThumbnailGrid(
      shapeOptions.map(opt => ({
        id: opt.value,
        label: opt.label,
        disabled: false,
      })),
      (id: string) => onOptionSelected('shape', id),
      currentShape
    );
    shapeGroup.appendChild(shapeThumbnails.render());
    body.appendChild(shapeGroup);

    // Sections group (simple buttons for now)
    const sectionsGroup = document.createElement('div');
    sectionsGroup.className = 'option-group';
    const sectionsLabel = document.createElement('label');
    sectionsLabel.className = 'option-label';
    sectionsLabel.textContent = 'Sections';
    sectionsGroup.appendChild(sectionsLabel);

    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'button-group';
    const sectionOptions = this._getSectionOptions(config);
    const currentSections = state.frame_design.number_sections;

    sectionOptions.forEach(n => {
      const btn = document.createElement('button');
      btn.className = `section-button ${currentSections === n ? 'active' : ''}`;
      btn.textContent = String(n);
      btn.addEventListener('click', () => onOptionSelected('number_sections', n));
      buttonGroup.appendChild(btn);
    });

    sectionsGroup.appendChild(buttonGroup);
    body.appendChild(sectionsGroup);

    container.appendChild(body);

    // Return as component
    return {
      render: () => container,
      destroy: () => {
        shapeThumbnails.destroy();
        container.remove();
      },
    };
  }

  private _renderLayoutOptions(
    state: CompositionStateDTO,
    config: UIConfig,
    onOptionSelected: (option: string, value: unknown) => void
  ): PanelComponent {
    const container = document.createElement('div');
    container.className = 'panel-content';

    // Header
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = '<h3>Layout</h3>';
    container.appendChild(header);

    // Body with sliders
    const body = document.createElement('div');
    body.className = 'panel-body';

    // Extract slider configs from config
    const sliderConfigs = this._extractSliderConfigs(config, state);

    const sliders = new SliderGroup(
      sliderConfigs,
      (id: string, value: number) => onOptionSelected(id, value)
    );

    body.appendChild(sliders.render());
    container.appendChild(body);

    return {
      render: () => container,
      destroy: () => {
        sliders.destroy();
        container.remove();
      },
    };
  }

  private _renderWoodOptions(
    state: CompositionStateDTO,
    config: UIConfig,
    onOptionSelected: (option: string, value: unknown) => void
  ): PanelComponent {
    const container = document.createElement('div');
    container.className = 'panel-content';

    // Header
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = '<h3>Wood Material</h3>';
    container.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'panel-body';

    // Extract species catalog from config
    const woodConfig = config.elements.wood_materials as
      | {
          species_catalog?: Array<{
            id: string;
            display: string;
            wood_number: string;
          }>;
        }
      | undefined;

    const speciesCatalog = woodConfig?.species_catalog || [];

    // Type-safe access to section materials
    interface SectionMaterial {
      section_id: number;
      species: string;
      grain_direction: string;
    }

    const materials = (state.section_materials as unknown as SectionMaterial[] | undefined) || [];
    const firstMaterial = materials.length > 0 ? materials[0] : null;

    // Always append body to container immediately
    container.appendChild(body);
    
    if (!firstMaterial || speciesCatalog.length === 0) {
      body.innerHTML = '<div class="panel-placeholder">No materials configured</div>';
    } else {
      // Dynamically import and render WoodMaterialInlineGrid
      import('./WoodMaterialInlineGrid').then(({ WoodMaterialInlineGrid }) => {
        const grid = new WoodMaterialInlineGrid(
          speciesCatalog,
          state.frame_design.shape,
          state.frame_design.number_sections,
          firstMaterial.species,
          firstMaterial.grain_direction,
          (species: string, grain: string) => {
            onOptionSelected('wood_material', { species, grain_direction: grain });
          }
        );
        
        body.appendChild(grid.render());
      }).catch((error: unknown) => {
        console.error('[RightPanelContent] Failed to load WoodMaterialInlineGrid:', error);
        body.innerHTML = '<div class="panel-placeholder">Failed to load wood options</div>';
      });
    }

    return {
      render: () => container,
      destroy: () => {
        container.remove();
      },
    };
  }

  private _renderBackingOptions(): PanelComponent {
    const container = document.createElement('div');
    container.className = 'panel-content';

    // Header
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = '<h3>Wood Selection</h3>';
    container.appendChild(header);

    // Body with navigation cards
    const body = document.createElement('div');
    body.className = 'panel-body';

    // Type-safe access to section materials
    interface SectionMaterial {
      section_id: number;
      species: string;
      grain_direction: string;
    }

    const materials = (state.section_materials as unknown as SectionMaterial[] | undefined) || [];
    const firstMaterial = materials.length > 0 ? materials[0] : null;

    if (!firstMaterial) {
      body.innerHTML = '<div class="panel-placeholder">No materials configured</div>';
    } else {
      const species: string = firstMaterial.species;
      const grainDirection: string = firstMaterial.grain_direction;

      // Species card
      const speciesCard = this._createNavigationCard(
        '🪵',
        'Species',
        species,
        () => onOptionSelected('navigate', 'species')
      );
      body.appendChild(speciesCard);

      // Grain card
      const grainCard = this._createNavigationCard(
        '↕️',
        'Grain Direction',
        grainDirection,
        () => onOptionSelected('navigate', 'grain')
      );
      body.appendChild(grainCard);
    }

    container.appendChild(body);

    return {
      render: () => container,
      destroy: () => {
        container.remove();
      },
    };
  }

  private _renderBackingOptions(): PanelComponent {
    const html = `
      <div class="panel-header">
        <h3>Backing</h3>
      </div>
      <div class="panel-body">
        <div class="panel-placeholder">
          <p>Backing material options coming soon</p>
        </div>
      </div>
    `;
    return new SimplePanel(html);
  }
	
	/**
   * Render wood species selection panel (cascading)
   */
  renderWoodSpeciesPanel(
    state: CompositionStateDTO,
    config: UIConfig,
    onSelect: (species: string) => void,
    onBack: () => void
  ): PanelComponent {
    // Extract species catalog from config
    const woodConfig = config.elements.wood_materials as
      | {
          species_catalog?: Array<{
            id: string;
            display: string;
            wood_number: string;
          }>;
        }
      | undefined;

    const speciesCatalog = woodConfig?.species_catalog || [];

    // Get current selection
    interface SectionMaterial {
      species: string;
    }
    const materials = state.section_materials as unknown as SectionMaterial[];
    const currentSpecies = materials.length > 0 ? materials[0].species : '';

    return new WoodSpeciesGrid(speciesCatalog, currentSpecies, onSelect, onBack);
  }

  /**
   * Render grain direction selection panel (cascading)
   */
  renderGrainDirectionPanel(
    state: CompositionStateDTO,
    onSelect: (grain: string) => void,
    onBack: () => void
  ): PanelComponent {
    // Determine available grain directions based on shape and sections
    const shape = state.frame_design.shape;
    const sections = state.frame_design.number_sections;

    const availableGrains = this._getAvailableGrainDirections(shape, sections);

    // Get current selection
    interface SectionMaterial {
      grain_direction: string;
    }
    const materials = state.section_materials as unknown as SectionMaterial[];
    const currentGrain = materials.length > 0 ? materials[0].grain_direction : '';

    return new GrainDirectionGrid(availableGrains, currentGrain, onSelect, onBack);
  }

  /**
   * Create a navigation card button
   */
  private _createNavigationCard(
    icon: string,
    label: string,
    value: string,
    onClick: () => void
  ): HTMLElement {
    const card = document.createElement('button');
    card.className = 'option-card';
    card.addEventListener('click', onClick);

    const iconSpan = document.createElement('span');
    iconSpan.className = 'option-icon';
    iconSpan.textContent = icon;
    card.appendChild(iconSpan);

    const infoDiv = document.createElement('div');
    infoDiv.className = 'option-info';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'option-label';
    labelSpan.textContent = label;
    infoDiv.appendChild(labelSpan);

    const valueSpan = document.createElement('span');
    valueSpan.className = 'option-value';
    valueSpan.textContent = value;
    infoDiv.appendChild(valueSpan);

    card.appendChild(infoDiv);

    const arrow = document.createElement('span');
    arrow.className = 'option-arrow';
    arrow.textContent = '›';
    card.appendChild(arrow);

    return card;
  }

  /**
   * Extract shape options from config
   */
  private _getShapeOptions(config: UIConfig): ShapeOption[] {
    const shapeElement = config.elements.shape as ElementConfig | undefined;
    if (!shapeElement?.options) return [];
    return shapeElement.options.map(opt => ({
      value: String(opt.value),
      label: opt.label,
    }));
  }

  /**
   * Extract section options from config
   */
  private _getSectionOptions(config: UIConfig): number[] {
    const sectionsElement = config.elements.sections as ElementConfig | undefined;
    if (!sectionsElement?.options) return [];
    return sectionsElement.options.map(opt => Number(opt.value));
  }
	
	/**
   * Extract slider configurations from config
   * Supports both range and select elements
   */
  private _extractSliderConfigs(
    config: UIConfig,
    state: CompositionStateDTO
  ): Array<{
    id: string;
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
    unit?: string;
  }> {
    const sliders: Array<{
      id: string;
      label: string;
      min: number;
      max: number;
      step: number;
      value: number;
      unit?: string;
    }> = [];

    // Map of slider element IDs to their state paths
    const sliderElements = ['size', 'diameter', 'separation', 'slots'];

    sliderElements.forEach(elementId => {
      const element = config.elements[elementId] as
        | {
            type?: string;
            label?: string;
            min?: number;
            max?: number;
            step?: number;
            state_path?: string;
            options?: Array<{ value: number }>;
          }
        | undefined;

      if (!element) return;

      // Handle range type
      if (element.type === 'range' && element.min !== undefined && element.max !== undefined) {
        const statePath = element.state_path || '';
        const value = this._getStateValueByPath(state, statePath);

        sliders.push({
          id: elementId,
          label: element.label || elementId,
          min: element.min,
          max: element.max,
          step: element.step || 1,
          value: typeof value === 'number' ? value : element.min,
          unit: '"',
        });
      }

      // Handle select type (convert to slider range)
      if (element.type === 'select' && element.options) {
        const values = element.options.map(opt => opt.value);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const step = values.length > 1 ? values[1] - values[0] : 1;

        const statePath = element.state_path || '';
        const value = this._getStateValueByPath(state, statePath);

        sliders.push({
          id: elementId,
          label: element.label || elementId,
          min,
          max,
          step,
          value: typeof value === 'number' ? value : min,
          unit: '"',
        });
      }
    });

    return sliders;
  }

  /**
   * Get nested state value by dot-notation path
   */
  private _getStateValueByPath(state: CompositionStateDTO, path: string): unknown {
    if (!path) return undefined;

    const parts = path.split('.');
    let current: unknown = state;

    for (const part of parts) {
      if (typeof current === 'object' && current !== null && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
	
	/**
   * Get available grain directions based on shape and number of sections
   */
  private _getAvailableGrainDirections(shape: string, sections: number): string[] {
    const allGrains = ['horizontal', 'vertical', 'radiant', 'diamond'];

    // Diamond grain only available for n=4
    if (sections !== 4) {
      return allGrains.filter(g => g !== 'diamond');
    }

    // Radiant requires n>=2
    if (sections < 2) {
      return allGrains.filter(g => g !== 'radiant' && g !== 'diamond');
    }

    return allGrains;
  }
}