/**
 * GrainDirectionGrid.ts
 * Renders grain direction selection grid as a cascading panel
 * 
 * Architecture: Stateless component
 * - Receives available grain options (filtered by shape/sections)
 * - Emits selection via callback
 * - Includes back button for navigation
 */

import type { PanelComponent, ThumbnailItem } from '../types/PanelTypes';

import { ThumbnailGrid } from './ThumbnailGrid';

export class GrainDirectionGrid implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _thumbnailGrid: ThumbnailGrid | null = null;
  private _availableGrains: string[];
  private _currentSelection: string;
  private _onSelect: (grain: string) => void;
  private _onBack: () => void;
  
  constructor(
    availableGrains: string[],
    currentSelection: string,
    onSelect: (grain: string) => void,
    onBack: () => void
  ) {
    this._availableGrains = availableGrains;
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
    title.textContent = 'Grain Direction';
    header.appendChild(title);
    
    container.appendChild(header);
    
    // Body with thumbnail grid
    const body = document.createElement('div');
    body.className = 'panel-body';
    
    // Grain direction options with placeholder icons
    const grainLabels: Record<string, string> = {
      horizontal: 'Horizontal',
      vertical: 'Vertical',
      radiant: 'Radiant',
      diamond: 'Diamond',
    };
    
    const thumbnailItems: ThumbnailItem[] = this._availableGrains.map(grain => ({
      id: grain,
      label: grainLabels[grain] || grain,
      thumbnailUrl: `/public/assets/grain/${grain}_thumb.png`,
      disabled: false,
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