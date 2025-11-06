/**
 * WoodSpeciesGrid.ts
 * Renders wood species selection grid as a cascading panel
 * 
 * Architecture: Stateless component
 * - Receives species catalog from config
 * - Emits selection via callback
 * - Includes back button for navigation
 */

import type { PanelComponent, ThumbnailItem } from '../types/PanelTypes';

import { ThumbnailGrid } from './ThumbnailGrid';

interface SpeciesOption {
  id: string;
  display: string;
  wood_number: string;
}

export class WoodSpeciesGrid implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _thumbnailGrid: ThumbnailGrid | null = null;
  private _species: SpeciesOption[];
  private _currentSelection: string;
  private _onSelect: (species: string) => void;
  private _onBack: () => void;
  
  constructor(
    species: SpeciesOption[],
    currentSelection: string,
    onSelect: (species: string) => void,
    onBack: () => void
  ) {
    this._species = species;
    this._currentSelection = currentSelection;
    this._onSelect = onSelect;
    this._onBack = onBack;
  }
  
  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'panel-content';
    
    // Header with back button
    const header = document.createElement('div');
    header.className = 'panel-header';
    
    const backButton = document.createElement('button');
    backButton.className = 'back-button';
    backButton.textContent = '‹';
    backButton.title = 'Back';
    backButton.addEventListener('click', () => this._onBack());
    header.appendChild(backButton);
    
    const title = document.createElement('h3');
    title.textContent = 'Wood Species';
    header.appendChild(title);
    
    container.appendChild(header);
    
    // Body with thumbnail grid
    const body = document.createElement('div');
    body.className = 'panel-body';
    
    // Convert species to thumbnail items
    const thumbnailItems: ThumbnailItem[] = this._species.map(spec => ({
      id: spec.id,
      label: spec.display,
      thumbnailUrl: `/public/assets/wood/${spec.wood_number}_thumb.png`,
      disabled: false,
      tooltip: spec.display,
    }));
    
    this._thumbnailGrid = new ThumbnailGrid(
      thumbnailItems,
      (id: string) => this._onSelect(id),
      this._currentSelection
    );
    
    body.appendChild(this._thumbnailGrid.render());
    container.appendChild(body);
    
    this._container = container;
    return container;
  }
  
  destroy(): void {
    if (this._thumbnailGrid) {
      this._thumbnailGrid.destroy();
      this._thumbnailGrid = null;
    }
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}