/**
 * LeftSecondaryPanel.ts
 * Renders subcategory navigation for active category
 * 
 * Architecture: Stateless component
 * - Receives subcategory list from config
 * - Highlights current selection
 * - Emits selection via callback
 */

import type { PanelComponent, SubcategoryConfig } from '../types/PanelTypes';

interface SubcategoryItem {
  id: string;
  config: SubcategoryConfig;
}

export class LeftSecondaryPanel implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _subcategories: SubcategoryItem[];
  private _currentSelection: string | null;
  private _onSelect: (subcategoryId: string) => void;
  
  constructor(
    subcategories: SubcategoryItem[],
    currentSelection: string | null,
    onSelect: (subcategoryId: string) => void
  ) {
    this._subcategories = subcategories;
    this._currentSelection = currentSelection;
    this._onSelect = onSelect;
  }
  
  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'panel-content';
    
    const list = document.createElement('div');
    list.className = 'subcategory-list';
    
    this._subcategories.forEach(item => {
      const button = document.createElement('button');
      button.className = 'subcategory-button';
      button.dataset.subcategoryId = item.id;
			button.dataset.demoId = `subcategory_${item.id}`;
      
      if (item.id === this._currentSelection) {
        button.classList.add('selected');
      }
      
      // Check if subcategory is a placeholder (has note but empty filters/options)
      const hasFilters = Object.keys(item.config.filters).length > 0;
      const hasOptions = Object.keys(item.config.options).length > 0;
      const isPlaceholder = !hasFilters && !hasOptions;
      
      if (isPlaceholder) {
        button.classList.add('disabled');
        button.disabled = true;
      }
      
      // Label
      const label = document.createElement('span');
      label.className = 'subcategory-label';
      label.textContent = item.config.label;
      button.appendChild(label);
      
      // Note (if placeholder)
      if (item.config.note) {
        const note = document.createElement('span');
        note.className = 'subcategory-note';
        note.textContent = item.config.note;
        button.appendChild(note);
      }
      
      // Event handler
      if (!isPlaceholder) {
        button.addEventListener('click', () => {
          this._onSelect(item.id);
        });
      }
      
      list.appendChild(button);
    });
    
    container.appendChild(list);
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