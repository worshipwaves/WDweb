// src/components/BackingPanel.ts

import type { PanelComponent } from '../types/PanelTypes';
import { Tooltip } from './Tooltip';

// Interfaces matching the structure from config/backing_materials.json
interface BackingMaterial {
  id: string;
  display: string;
  description: string;
  color_rgb?: number[];
  texture_files?: { diffuse?: string };
}

interface BackingType {
  type: string;
  display_name: string;
  materials: BackingMaterial[];
}

interface BackingConfig {
  default_enabled: boolean;
  material_catalog: Record<string, BackingType>;
}

export class BackingPanel implements PanelComponent {
  private container: HTMLElement;
  private backingConfig: BackingConfig | null = null;
  private onOptionSelected: (option: string, value: unknown) => void;
  private tooltip: Tooltip = new Tooltip();

  // Internal state for rendering
  private isEnabled: boolean;
  private currentType: string;
  private currentMaterial: string;

  constructor(
    isEnabled: boolean,
    type: string,
    material: string,
    onOptionSelected: (option: string, value: unknown) => void
  ) {
    this.isEnabled = isEnabled; // Use the passed-in state
    this.currentType = type;
    this.currentMaterial = material;
    this.onOptionSelected = onOptionSelected;
    this.container = document.createElement('div');
    this.container.className = 'backing-panel-body';

    // Fetch config and then render
    void this.loadBackingConfig().then(() => {
      this.renderContent(); // No longer reads default from config
    });
  }

  private async loadBackingConfig(): Promise<BackingConfig | null> {
    if (this.backingConfig) return this.backingConfig;
    try {
      const response = await fetch('http://localhost:8000/api/config/backing-materials');
      if (!response.ok) throw new Error('Failed to load backing config');
      this.backingConfig = await response.json() as BackingConfig;
      return this.backingConfig;
    } catch (error) {
      this.container.innerHTML = '<div class="panel-placeholder">Failed to load options</div>';
      return null;
    }
  }

  private renderContent(): void {
    if (!this.backingConfig) return;
    this.tooltip.hide();
		
		if (this.typeGrid) {
      this.typeGrid.destroy();
      this.typeGrid = null;
    }
    if (this.finishGrid) {
      this.finishGrid.destroy();
      this.finishGrid = null;
    }

    this.container.innerHTML = ''; // Clear previous content

    const contentWrapper = document.createElement('div');
    contentWrapper.style.padding = '16px';
    contentWrapper.style.opacity = this.isEnabled ? '1' : '0.4';
    contentWrapper.style.pointerEvents = this.isEnabled ? 'auto' : 'none';
    contentWrapper.style.display = 'flex';
    contentWrapper.style.flexDirection = 'column';
    contentWrapper.style.gap = '24px';

    // 2. Material Type Grid
    contentWrapper.appendChild(this.createTypeGrid());

    // 3. Finish Grid
    const selectedTypeData = this.backingConfig.material_catalog[this.currentType];
    if (selectedTypeData) {
      contentWrapper.appendChild(this.createFinishGrid(selectedTypeData));
    }

    this.container.appendChild(contentWrapper);
  }

  private createEnableToggle(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'backing-enable-toggle';
    group.innerHTML = `
      <label for="backing-enabled-checkbox">Enable Backing</label>
      <label class="toggle-switch">
        <input type="checkbox" id="backing-enabled-checkbox" ${this.isEnabled ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    `;
    const checkbox = group.querySelector('input')!;
    checkbox.addEventListener('change', () => {
      this.isEnabled = checkbox.checked;
      this.onOptionSelected('backing_enabled', this.isEnabled);
      this.renderContent();
    });
    return group;
  }

  private createTypeGrid(): HTMLElement {
    const card = document.createElement('div');
    card.className = 'color-group-card';

    const label = document.createElement('div');
    label.className = 'color-group-label';
    label.textContent = 'Material Type';
    card.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'color-swatch-grid';

    Object.values(this.backingConfig!.material_catalog).forEach(type => {
      const firstMaterial = type.materials[0];
      const swatch = this.createThumbnailSwatch(
        type.type,
        type.display_name,
        firstMaterial.texture_files?.diffuse,
        firstMaterial.color_rgb,
        type.display_name,
        this.currentType === type.type,
        () => {
          this.currentType = type.type;
          this.currentMaterial = this.backingConfig!.material_catalog[type.type].materials[0].id;
          this.renderContent();
          this.onOptionSelected('backing_material', { type: this.currentType, material: this.currentMaterial });
        }
      );
      grid.appendChild(swatch);
    });

    card.appendChild(grid);
    return card;
  }

  private createFinishGrid(typeData: BackingType): HTMLElement {
    const card = document.createElement('div');
    card.className = 'color-group-card';

    const label = document.createElement('div');
    label.className = 'color-group-label';
    label.textContent = 'Finish';
    card.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'color-swatch-grid';

    typeData.materials.forEach(mat => {
      const swatch = this.createThumbnailSwatch(
        mat.id,
        mat.display,
        mat.texture_files?.diffuse,
        mat.color_rgb,
        mat.description,
        this.currentMaterial === mat.id,
        () => {
          this.currentMaterial = mat.id;
          this.renderContent();
          this.onOptionSelected('backing_material', { type: this.currentType, material: this.currentMaterial });
        }
      );
      grid.appendChild(swatch);
    });

    card.appendChild(grid);
    return card;
  }
	
	private createThumbnailSwatch(
    id: string,
    label: string,
    textureUrl: string | undefined,
    rgb: number[] | undefined,
    tooltipText: string,
    isSelected: boolean,
    onClick: () => void
  ): HTMLElement {
    const swatch = document.createElement('div');
    swatch.className = `color-swatch${isSelected ? ' selected' : ''}`;
    swatch.dataset.id = id;

    const fill = document.createElement('div');
    fill.className = 'color-swatch-fill';

    if (textureUrl) {
      fill.style.backgroundImage = `url(${textureUrl})`;
      fill.style.backgroundSize = 'cover';
      fill.style.backgroundPosition = 'center';
    } else if (rgb) {
      fill.style.backgroundColor = `rgb(${rgb[0] * 255}, ${rgb[1] * 255}, ${rgb[2] * 255})`;
    }

    swatch.appendChild(fill);

    // Tooltip on hover
    swatch.addEventListener('mouseenter', () => {
      const contentContainer = document.createElement('div');
      contentContainer.className = 'tooltip-content-wrapper';

      if (textureUrl) {
        const preview = document.createElement('img');
        preview.src = textureUrl;
        preview.alt = label;
        contentContainer.appendChild(preview);
      } else if (rgb) {
        const preview = document.createElement('div');
        preview.className = 'tooltip-color-swatch';
        preview.style.backgroundColor = `rgb(${rgb[0] * 255}, ${rgb[1] * 255}, ${rgb[2] * 255})`;
        contentContainer.appendChild(preview);
      }

      const description = document.createElement('p');
      description.className = 'tooltip-description';
      description.textContent = `${label}\n\n${tooltipText}`;
      contentContainer.appendChild(description);

      this.tooltip.show(contentContainer, swatch, 'left', 'tooltip-backing', 0, 0, true);
    });

    swatch.addEventListener('mouseleave', () => {
      this.tooltip.hide();
    });

    swatch.addEventListener('click', () => {
      this.tooltip.hide();
      onClick();
    });

    return swatch;
  }

  public render(): HTMLElement { return this.container; }
	
  public destroy(): void {
    this.tooltip.destroy();
    this.container.remove();
  }
}