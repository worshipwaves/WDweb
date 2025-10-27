/**
 * ThumbnailGrid.ts
 * Renders grid of selectable thumbnail options
 * 
 * Architecture: Stateless component
 * - Receives items + selection via render()
 * - Emits selection events via callback
 * - No internal state storage
 */

import type { PanelComponent, ThumbnailItem } from '../types/PanelTypes';

export class ThumbnailGrid implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _items: ThumbnailItem[];
  private _currentSelection: string | null;
  private _onSelect: (id: string) => void;
  
  constructor(
    items: ThumbnailItem[],
    onSelect: (id: string) => void,
    currentSelection: string | null = null
  ) {
    this._items = items;
    this._onSelect = onSelect;
    this._currentSelection = currentSelection;
  }
  
  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'thumbnail-grid';
    
    this._items.forEach(item => {
      const card = document.createElement('button');
      card.className = 'thumbnail-card';
      card.dataset.itemId = item.id;
      
      if (item.id === this._currentSelection) {
        card.classList.add('selected');
      }
      
      if (item.disabled) {
        card.classList.add('disabled');
        card.disabled = true;
      }
      
      // Thumbnail image or placeholder
      if (item.thumbnailUrl) {
        const img = document.createElement('img');
        img.src = item.thumbnailUrl;
        img.alt = item.label;
        card.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'thumbnail-placeholder';
        placeholder.textContent = item.label.charAt(0);
        card.appendChild(placeholder);
      }
      
      // Label
      const label = document.createElement('span');
      label.className = 'thumbnail-label';
      label.textContent = item.label;
      card.appendChild(label);
      
      // Event handler
      if (!item.disabled) {
        card.addEventListener('click', () => {
          this._onSelect(item.id);
        });
      }
      
      container.appendChild(card);
    });
    
    this._container = container;
    return container;
  }
  
  destroy(): void {
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}