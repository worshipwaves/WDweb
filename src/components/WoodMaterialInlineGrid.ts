/**
 * WoodMaterialInlineGrid.ts
 * Renders wood species with inline grain direction options
 * 
 * Architecture: Stateless component
 * - Shows species with filtered grain buttons based on shape/n
 * - Emits selection via callback
 */

import type { PanelComponent } from '../types/PanelTypes';

interface SpeciesInfo {
  id: string;
  display: string;
  wood_number: string;
}

interface GrainOption {
  id: string;
  label: string;
  available: boolean;
}

export class WoodMaterialInlineGrid implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _species: SpeciesInfo[];
  private _shape: string;
  private _numberSections: number;
  private _currentSpecies: string;
  private _currentGrain: string;
  private _onSelect: (species: string, grain: string) => void;
  
  constructor(
    species: SpeciesInfo[],
    shape: string,
    numberSections: number,
    currentSpecies: string,
    currentGrain: string,
    onSelect: (species: string, grain: string) => void
  ) {
    this._species = species;
    this._shape = shape;
    this._numberSections = numberSections;
    this._currentSpecies = currentSpecies;
    this._currentGrain = currentGrain;
    this._onSelect = onSelect;
  }
  
  render(): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'wood-material-inline-grid';
    
    this._species.forEach(species => {
      const row = this._renderSpeciesRow(species);
      grid.appendChild(row);
    });
    
    this._container = grid;
    return grid;
  }
  
  private _renderSpeciesRow(species: SpeciesInfo): HTMLElement {
    const row = document.createElement('div');
    row.className = 'wood-species-row';
    
    // Species label
    const label = document.createElement('div');
    label.className = 'wood-species-label';
    label.textContent = species.display;
    row.appendChild(label);
    
    // Grain options
    const grainContainer = document.createElement('div');
    grainContainer.className = 'wood-grain-options';
    
    const grainOptions = this._getAvailableGrainOptions();
    grainOptions.forEach(grain => {
      const button = document.createElement('button');
      button.className = 'wood-grain-button';
      button.textContent = grain.label;
      button.dataset.species = species.id;
      button.dataset.grain = grain.id;
      
      if (!grain.available) {
        button.classList.add('disabled');
        button.disabled = true;
      }
      
      if (species.id === this._currentSpecies && grain.id === this._currentGrain) {
        button.classList.add('active');
      }
      
      button.addEventListener('click', () => {
        if (grain.available) {
          this._onSelect(species.id, grain.id);
        }
      });
      
      grainContainer.appendChild(button);
    });
    
    row.appendChild(grainContainer);
    return row;
  }
  
  private _getAvailableGrainOptions(): GrainOption[] {
    const n = this._numberSections;
    const shape = this._shape;
    
    // Vertical and Horizontal always available
    const options: GrainOption[] = [
      { id: 'vertical', label: 'Vertical', available: true },
      { id: 'horizontal', label: 'Horizontal', available: true }
    ];
    
    // Radiant: (circular && n >= 2) OR n === 4
    const radiantAvailable = (shape === 'circular' && n >= 2) || n === 4;
    options.push({ id: 'radiant', label: 'Radiant', available: radiantAvailable });
    
    // Diamond: n === 4 only
    const diamondAvailable = n === 4;
    options.push({ id: 'diamond', label: 'Diamond', available: diamondAvailable });
    
    return options;
  }
  
  destroy(): void {
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}