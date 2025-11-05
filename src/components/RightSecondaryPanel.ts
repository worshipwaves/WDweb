/**
 * RightSecondaryPanel.ts
 * Renders filter selection strip for active subcategory
 * 
 * Architecture: Stateless component
 * - Displays shape/slot_pattern filters
 * - Highlights current selection
 * - Emits filter change (does NOT update composition state)
 */

import type { PanelComponent, FilterConfig, ThumbnailConfig } from '../types/PanelTypes';

interface FilterItem {
  id: string;
  config: FilterConfig;
}

export class RightSecondaryPanel implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _filters: FilterItem[];
  private _currentSelections: Map<string, string>;
  private _thumbnailConfig: ThumbnailConfig;
  private _onFilterSelect: (filterId: string, value: string) => void;
  
  constructor(
    filters: FilterItem[],
    currentSelections: Map<string, string>,
    thumbnailConfig: ThumbnailConfig,
    onFilterSelect: (filterId: string, value: string) => void
  ) {
    this._filters = filters;
    this._currentSelections = currentSelections;
    this._thumbnailConfig = thumbnailConfig;
    this._onFilterSelect = onFilterSelect;
  }
  
  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'panel-content';
    
    this._filters.forEach(filterItem => {
      const filterGroup = this._renderFilterGroup(filterItem);
      container.appendChild(filterGroup);
    });
    
    this._container = container;
    return container;
  }
  
  private _renderFilterGroup(filterItem: FilterItem): HTMLElement {
    const group = document.createElement('div');
    group.className = 'filter-group';
    group.dataset.filterId = filterItem.id;
    
    // Label
    const label = document.createElement('div');
    label.className = 'filter-label';
    label.textContent = filterItem.config.label;
    group.appendChild(label);
    
    // Options
    const optionsList = document.createElement('div');
    optionsList.className = `filter-options filter-type-${filterItem.config.type}`;
    
    const currentValue = this._currentSelections.get(filterItem.id) || filterItem.config.default;
    
    filterItem.config.options.forEach(option => {
      const button = document.createElement('button');
      button.className = 'filter-option';
      button.dataset.optionId = option.id;
      
      if (option.id === currentValue) {
        button.classList.add('selected');
      }
      
      // Thumbnail image
      if (option.thumbnail) {
        const thumbnailPath = `${this._thumbnailConfig.filter_base_path}/${option.thumbnail}${this._thumbnailConfig.extension}`;
        
        const img = document.createElement('img');
        img.src = thumbnailPath;
        img.alt = option.label;
        img.className = 'filter-thumbnail';
        button.appendChild(img);
      }
      
      // Label
      const optionLabel = document.createElement('span');
      optionLabel.className = 'filter-option-label';
      optionLabel.textContent = option.label;
      button.appendChild(optionLabel);
      
      // Event handler
      button.addEventListener('click', () => {
        this._onFilterSelect(filterItem.id, option.id);
      });
      
      optionsList.appendChild(button);
    });
    
    group.appendChild(optionsList);
    return group;
  }
  
  destroy(): void {
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}