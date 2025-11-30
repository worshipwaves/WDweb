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
import { Tooltip } from './Tooltip';

interface SubcategoryItem {
  id: string;
  config: SubcategoryConfig;
}

export class LeftSecondaryPanel implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _subcategories: SubcategoryItem[];
  private _currentSelection: string | null;
  private _onSelect: (subcategoryId: string) => void;
  private _tooltip: Tooltip;
  private _helpVisible: boolean = false;
  private _documentClickHandler: ((e: MouseEvent) => void) | null = null;
  
  constructor(
    subcategories: SubcategoryItem[],
    currentSelection: string | null,
    onSelect: (subcategoryId: string) => void
  ) {
    this._subcategories = subcategories;
    this._currentSelection = currentSelection;
    this._onSelect = onSelect;
    this._tooltip = new Tooltip();
  }
  
  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'panel-content';
    
    const list = document.createElement('div');
    list.className = 'subcategory-list';
    
    this._subcategories.forEach(item => {
      const button = document.createElement('button');
      button.className = 'subcategory-button';
      button.dataset.subcategory = item.id;
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
          console.log('[LeftSecondaryPanel] Subcategory clicked:', item.id);
          try {
            console.log('[LeftSecondaryPanel] Calling _onSelect with:', item.id);
            console.log('[LeftSecondaryPanel] _onSelect is:', typeof this._onSelect, this._onSelect);
            this._onSelect(item.id);
            console.log('[LeftSecondaryPanel] _onSelect completed successfully');
          } catch (error) {
            console.error('[LeftSecondaryPanel] ERROR in click handler:', error);
            console.error('[LeftSecondaryPanel] Stack trace:', error instanceof Error ? error.stack : 'No stack');
          }
        });
      }
      
      list.appendChild(button);
    });
    
    container.appendChild(list);
    
    // Add help icon outside list (doesn't participate in wrap)
    const helpButton = document.createElement('button');
    helpButton.className = 'subcategory-help-icon';
    helpButton.innerHTML = '?';
    helpButton.title = 'Help';
    
    // Document click handler for click-anywhere-to-close
    const documentClickHandler = (e: MouseEvent) => {
      if (!helpButton.contains(e.target as Node)) {
        this._tooltip.hide();
        this._helpVisible = false;
        document.removeEventListener('click', documentClickHandler);
      }
    };
    
    helpButton.addEventListener('click', (e) => {
      e.stopPropagation();
      const selectedSubcat = this._subcategories.find(s => s.id === this._currentSelection);
      const helpContent = selectedSubcat?.config.panel_help;
      
      if (!helpContent) return;
      
      if (this._helpVisible) {
        this._tooltip.hide();
        this._helpVisible = false;
        document.removeEventListener('click', documentClickHandler);
      } else {
        this._tooltip.show(helpContent, helpButton, 'left', 'tooltip-help', 0, 0, true, 'top');
        this._helpVisible = true;
        document.addEventListener('click', documentClickHandler);
      }
    });
    
    container.appendChild(helpButton);
    this._container = container;
    return container;
  }
  
  destroy(): void {
    this._tooltip.hide();
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}