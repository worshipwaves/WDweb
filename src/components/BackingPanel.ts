// src/components/BackingPanel.ts

import type { PanelComponent } from '../types/PanelTypes';

import { HorizontalScrollContainer } from './HorizontalScrollContainer';
import { Tooltip } from './Tooltip';
import { getApiBaseUrl } from '../utils/assetUrl';


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

  private horizontal: boolean = false;
  private _materialScrollContainer: HorizontalScrollContainer | null = null;
  private _finishScrollContainer: HorizontalScrollContainer | null = null;
	
  /**
   * Create a standalone toggle element for embedding in accordion header.
   * Static factory that doesn't require a full BackingPanel instance.
   */
  static createEmbeddableToggle(
    isEnabled: boolean,
    onChange: (enabled: boolean) => void
  ): HTMLElement {
    const toggle = document.createElement('label');
    toggle.className = 'toggle-switch';
    toggle.innerHTML = `
      <input type="checkbox" ${isEnabled ? 'checked' : ''}>
      <span class="toggle-slider"></span>
    `;
    
    const checkbox = toggle.querySelector('input')!;
    checkbox.addEventListener('change', () => {
      onChange(checkbox.checked);
    });
    
    return toggle;
  }
  
  /**
   * Update an existing embeddable toggle's checked state
   */
  static updateToggleState(toggle: HTMLElement, isEnabled: boolean): void {
    const checkbox = toggle.querySelector('input') as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = isEnabled;
    }
  }

  constructor(
    isEnabled: boolean,
    type: string,
    material: string,
    onOptionSelected: (option: string, value: unknown) => void,
    horizontal: boolean = false
  ) {
    this.isEnabled = isEnabled; // Use the passed-in state
    this.currentType = type;
    this.currentMaterial = material;
    this.onOptionSelected = onOptionSelected;
    this.horizontal = horizontal;
    this.container = document.createElement('div');
    this.container.className = horizontal ? 'backing-panel-horizontal' : 'backing-panel-body';

    // Fetch config and then render
    void this.loadBackingConfig().then(() => {
      this.renderContent(); // No longer reads default from config
    });
  }

  private async loadBackingConfig(): Promise<BackingConfig | null> {
    if (this.backingConfig) return this.backingConfig;
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/config/backing-materials`);
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

    this.container.innerHTML = '';

    if (this.horizontal) {
      this.renderHorizontalContent();
    } else {
      this.renderVerticalContent();
    }
  }

  private renderVerticalContent(): void {
    if (!this.backingConfig) return;

    const contentWrapper = document.createElement('div');
    contentWrapper.style.padding = '16px';
    contentWrapper.style.opacity = this.isEnabled ? '1' : '0.4';
    contentWrapper.style.pointerEvents = this.isEnabled ? 'auto' : 'none';
    contentWrapper.style.display = 'flex';
    contentWrapper.style.flexDirection = 'column';
    contentWrapper.style.gap = '24px';

    contentWrapper.appendChild(this.createTypeGrid());

    const selectedTypeData = this.backingConfig.material_catalog[this.currentType];
    if (selectedTypeData) {
      contentWrapper.appendChild(this.createFinishGrid(selectedTypeData));
    }

    this.container.appendChild(contentWrapper);
  }

  private renderHorizontalContent(): void {
    if (!this.backingConfig) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'backing-content-wrapper';

    // --- Material Row ---
    const materialLabel = document.createElement('div');
    materialLabel.className = 'backing-row-label';
    materialLabel.textContent = 'Material';
    wrapper.appendChild(materialLabel);

    this._materialScrollContainer = new HorizontalScrollContainer();
    const materialScrollWrapper = this._materialScrollContainer.render();
    const materialScroll = this._materialScrollContainer.getScrollElement()!;

    // "None" card
    materialScroll.appendChild(this.createHorizontalCard('none', 'None', undefined, undefined, !this.isEnabled, () => {
      this.isEnabled = false;
      this.onOptionSelected('backing_enabled', false);
      this.renderContent();
    }));

    // Material type cards
    Object.values(this.backingConfig.material_catalog).forEach(typeData => {
      const firstMat = typeData.materials[0];
      materialScroll.appendChild(this.createHorizontalCard(
        typeData.type,
        typeData.display_name,
        firstMat.texture_files?.diffuse,
        firstMat.color_rgb,
        this.isEnabled && this.currentType === typeData.type,
        () => {
          this.isEnabled = true;
          this.currentType = typeData.type;
          this.currentMaterial = typeData.materials[0].id;
          this.onOptionSelected('backing_enabled', true);
          this.onOptionSelected('backing_material', { type: this.currentType, material: this.currentMaterial });
          this.renderContent();
        },
        `${typeData.display_name} backing material`
      ));
    });

    wrapper.appendChild(materialScrollWrapper);

    // --- Finish Row ---
    const finishLabel = document.createElement('div');
    finishLabel.className = 'backing-row-label';
    finishLabel.textContent = 'Finish';
    wrapper.appendChild(finishLabel);

    this._finishScrollContainer = new HorizontalScrollContainer();
    const finishScrollWrapper = this._finishScrollContainer.render();
    const finishScroll = this._finishScrollContainer.getScrollElement()!;
    if (!this.isEnabled) {
      finishScrollWrapper.style.opacity = '0.4';
      finishScrollWrapper.style.pointerEvents = 'none';
    }

    const selectedTypeData = this.backingConfig.material_catalog[this.currentType];
    if (selectedTypeData) {
      selectedTypeData.materials.forEach(mat => {
        finishScroll.appendChild(this.createHorizontalCard(
          mat.id,
          mat.display,
          mat.texture_files?.diffuse,
          mat.color_rgb,
          this.isEnabled && this.currentMaterial === mat.id,
          () => {
            this.currentMaterial = mat.id;
            this.onOptionSelected('backing_material', { type: this.currentType, material: this.currentMaterial });
            this.renderContent();
          },
          mat.description
        ));
      });
    }

    wrapper.appendChild(finishScrollWrapper);

    this.container.appendChild(wrapper);

    // Scroll to selected
    this._materialScrollContainer.scrollToSelected();
    if (this.isEnabled) {
      this._finishScrollContainer.scrollToSelected();
    }
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

  private scrollToSelected(scrollContainer: HTMLElement): void {
    requestAnimationFrame(() => {
      const selected = scrollContainer.querySelector('.selected') as HTMLElement;
      if (!selected) return;

      const containerRect = scrollContainer.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();
      const scrollLeft = scrollContainer.scrollLeft;

      const targetScroll = scrollLeft +
        (selectedRect.left - containerRect.left) -
        (containerRect.width / 2) +
        (selectedRect.width / 2);

      scrollContainer.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: 'instant'
      });
    });
  }
	
	private createHorizontalCard(
    id: string,
    label: string,
    textureUrl: string | undefined,
    rgb: number[] | undefined,
    isSelected: boolean,
    onClick: () => void,
    tooltipText?: string
  ): HTMLElement {
    const card = document.createElement('button');
    card.className = 'accordion-card backing-material-card';
    card.dataset.itemId = id;

    if (isSelected) {
      card.classList.add('selected');
    }

    const swatch = document.createElement('div');
    swatch.className = 'backing-material-swatch';

    if (id === 'none') {
      swatch.innerHTML = `<svg class="none-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <line x1="4" y1="4" x2="20" y2="20"/>
        <line x1="20" y1="4" x2="4" y2="20"/>
      </svg>`;
    } else {
      const fill = document.createElement('div');
      fill.className = 'backing-material-fill';

      if (textureUrl) {
        fill.style.backgroundImage = `url(${textureUrl})`;
        fill.style.backgroundSize = 'cover';
        fill.style.backgroundPosition = 'center';
      } else if (rgb) {
        const scale = rgb[0] <= 1 && rgb[1] <= 1 && rgb[2] <= 1 ? 255 : 1;
        fill.style.backgroundColor = `rgb(${rgb[0] * scale}, ${rgb[1] * scale}, ${rgb[2] * scale})`;
      }

      swatch.appendChild(fill);
    }

    card.appendChild(swatch);

    const labelEl = document.createElement('span');
    labelEl.className = 'backing-material-label';
    labelEl.textContent = label;
    card.appendChild(labelEl);

    // Tooltip on hover
    if (tooltipText) {
      card.addEventListener('mouseenter', () => {
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
          const scale = rgb[0] <= 1 && rgb[1] <= 1 && rgb[2] <= 1 ? 255 : 1;
          preview.style.backgroundColor = `rgb(${rgb[0] * scale}, ${rgb[1] * scale}, ${rgb[2] * scale})`;
          contentContainer.appendChild(preview);
        }

        const description = document.createElement('p');
        description.className = 'tooltip-description';
        description.textContent = `${label}\n\n${tooltipText}`;
        contentContainer.appendChild(description);

        this.tooltip.show(contentContainer, card, 'left', 'tooltip-backing', 0, 0, true, 'canvas');
      });

      card.addEventListener('mouseleave', () => {
        this.tooltip.hide();
      });
    }

    card.addEventListener('click', () => {
      this.tooltip.hide();
      onClick();
    });

    return card;
  }

  public render(): HTMLElement { return this.container; }
	
  public destroy(): void {
    this.tooltip.destroy();
    this.container.remove();
  }
}