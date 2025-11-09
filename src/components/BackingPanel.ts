// src/components/BackingPanel.ts

import type { PanelComponent } from '../types/PanelTypes';

interface BackingMaterial {
  id: string;
  display: string;
  description: string;
}

interface BackingType {
  type: string;
  display_name: string;
  materials: BackingMaterial[];
}

interface BackingConfig {
  material_catalog: Record<string, BackingType>;
}

export class BackingPanel implements PanelComponent {
  private container: HTMLElement;
  private backingConfig: BackingConfig | null = null;
  private currentType: string;
  private currentMaterial: string;
  private onOptionSelected: (option: string, value: unknown) => void;

  constructor(
    type: string,
    material: string,
    onOptionSelected: (option: string, value: unknown) => void
  ) {
    console.log('[BackingPanel] Constructor called');
    console.log('[BackingPanel] type:', type);
    console.log('[BackingPanel] material:', material);
    console.log('[BackingPanel] onOptionSelected:', typeof onOptionSelected, onOptionSelected);
    this.currentType = type;
    this.currentMaterial = material;
    this.onOptionSelected = onOptionSelected;
    console.log('[BackingPanel] this.onOptionSelected:', typeof this.onOptionSelected, this.onOptionSelected);
    this.container = document.createElement('div');
    this.container.className = 'panel-content';
    
    void this.loadBackingConfig();
  }

  private async loadBackingConfig(): Promise<void> {
    try {
      const response = await fetch('http://localhost:8000/api/config/backing-materials');
      if (!response.ok) {
        throw new Error('Failed to load backing config');
      }
      this.backingConfig = await response.json() as BackingConfig;
      this.renderContent();
    } catch (error) {
      console.error('[BackingPanel] Failed to load backing config:', error);
      this.container.innerHTML = '<div class="panel-placeholder">Failed to load backing options</div>';
    }
  }

  private renderContent(): void {
    if (!this.backingConfig) return;

    this.container.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = '<h3>Backing Material</h3>';
    this.container.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'panel-body';

    // Material Type Selection (Acrylic, Cloth, Foam)
    const typeGroup = document.createElement('div');
    typeGroup.className = 'option-group';
    
    const typeLabel = document.createElement('label');
    typeLabel.className = 'option-label';
    typeLabel.textContent = 'Material Type';
    typeGroup.appendChild(typeLabel);

    const typeButtons = document.createElement('div');
    typeButtons.className = 'button-group';

    const callback = this.onOptionSelected;
    Object.entries(this.backingConfig.material_catalog).forEach(([typeId, typeData]) => {
      const btn = document.createElement('button');
      btn.className = `section-button ${this.currentType === typeId ? 'active' : ''}`;
      btn.textContent = typeData.display_name;
      btn.addEventListener('click', () => {
        this.currentType = typeId;
        const firstMaterial = typeData.materials[0].id;
        this.currentMaterial = firstMaterial;
        callback('backing_material', { type: typeId, material: firstMaterial });
        this.renderContent();
      });
      typeButtons.appendChild(btn);
    });

    typeGroup.appendChild(typeButtons);
    body.appendChild(typeGroup);

    // Color/Finish Selection
    const currentTypeData = this.backingConfig.material_catalog[this.currentType];
    console.log('[BackingPanel] currentType:', this.currentType);
    console.log('[BackingPanel] currentTypeData:', currentTypeData);
    console.log('[BackingPanel] materials:', currentTypeData?.materials);
    if (currentTypeData && currentTypeData.materials.length > 0) {
      const materialGroup = document.createElement('div');
      materialGroup.className = 'option-group';
      
      const materialLabel = document.createElement('label');
      materialLabel.className = 'option-label';
      materialLabel.textContent = 'Color/Finish';
      materialGroup.appendChild(materialLabel);

      const materialGrid = document.createElement('div');
      materialGrid.className = 'thumbnail-grid';

      currentTypeData.materials.forEach((mat) => {
        console.log('[BackingPanel] Creating tile for:', mat.id, mat.display);
        const tile = document.createElement('button');
        tile.className = `thumbnail-tile ${this.currentMaterial === mat.id ? 'active' : ''}`;
        tile.title = mat.description;
        
        // Add color swatch
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        const rgb = (mat as { color_rgb: number[] }).color_rgb;
        swatch.style.backgroundColor = `rgb(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)})`;
        swatch.style.width = '100%';
        swatch.style.height = '80px';
        swatch.style.borderRadius = '4px';
        swatch.style.marginBottom = '8px';
        tile.appendChild(swatch);
        
        const label = document.createElement('div');
        label.className = 'thumbnail-label';
        label.textContent = mat.display;
        tile.appendChild(label);
        console.log('[BackingPanel] Tile created:', tile);

        tile.addEventListener('click', () => {
          this.currentMaterial = mat.id;
          callback('backing_material', { type: this.currentType, material: mat.id });
          this.renderContent();
        });

        materialGrid.appendChild(tile);
        console.log('[BackingPanel] Tile appended to grid');
      });

      console.log('[BackingPanel] materialGrid children:', materialGrid.children.length);
      materialGroup.appendChild(materialGrid);
      console.log('[BackingPanel] materialGroup children:', materialGroup.children.length);
      body.appendChild(materialGroup);
      console.log('[BackingPanel] body children:', body.children.length);
    }

    this.container.appendChild(body);
    console.log('[BackingPanel] renderContent complete, container:', this.container);
    console.log('[BackingPanel] container.outerHTML:', this.container.outerHTML.substring(0, 500));
  }

  public render(): HTMLElement {
    return this.container;
  }

  public destroy(): void {
    this.container.remove();
  }
}