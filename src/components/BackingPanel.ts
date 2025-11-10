// src/components/BackingPanel.ts

import type { PanelComponent, ThumbnailItem } from '../types/PanelTypes';
import { ThumbnailGrid } from './ThumbnailGrid';
import { Tooltip } from './Tooltip';
import { TooltipClassNameFactory } from '../utils/TooltipClassNameFactory';

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
    this.container.className = 'panel-content';

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

    this.container.innerHTML = ''; // Clear previous content

    const body = document.createElement('div');
    body.className = 'backing-panel-body';

    // 1. Enable Toggle
    body.appendChild(this.createEnableToggle());

    const contentWrapper = document.createElement('div');
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

    body.appendChild(contentWrapper);
    this.container.appendChild(body);
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
    const group = document.createElement('div');
    const label = document.createElement('label');
    label.className = 'option-label';
    label.textContent = 'Material Type';
    group.appendChild(label);

    const typeItems: ThumbnailItem[] = Object.values(this.backingConfig!.material_catalog).map(type => {
      const firstMaterial = type.materials[0];
      return {
        id: type.type,
        label: type.display_name,
        thumbnailUrl: firstMaterial.texture_files?.diffuse, // Use diffuse from first item as preview
        rgb: firstMaterial.color_rgb, // Fallback to color
        tooltip: type.display_name,
      };
    });

    const typeGrid = new ThumbnailGrid(typeItems, (typeId) => {
      this.currentType = typeId;
      this.currentMaterial = this.backingConfig!.material_catalog[typeId].materials[0].id;
      this.renderContent(); 
      this.onOptionSelected('backing_material', { type: this.currentType, material: this.currentMaterial });
    }, this.currentType);
    
    group.appendChild(typeGrid.render());
    return group;
  }

  private createFinishGrid(typeData: BackingType): HTMLElement {
    const group = document.createElement('div');
    const label = document.createElement('label');
    label.className = 'option-label';
    label.textContent = 'Finish';
    group.appendChild(label);
    
    const finishItems: ThumbnailItem[] = typeData.materials.map(mat => ({
        id: mat.id,
        label: mat.display,
        thumbnailUrl: mat.texture_files?.diffuse,
        rgb: mat.color_rgb,
        tooltip: mat.description,
    }));

    const finishGrid = new ThumbnailGrid(finishItems, (materialId) => {
        this.currentMaterial = materialId;
        this.renderContent();
        this.onOptionSelected('backing_material', { type: this.currentType, material: this.currentMaterial });
    }, this.currentMaterial, { subcategory: 'backing_finish' });

    group.appendChild(finishGrid.render());
    return group;
  }

  public render(): HTMLElement { return this.container; }
  public destroy(): void { this.container.remove(); }
}