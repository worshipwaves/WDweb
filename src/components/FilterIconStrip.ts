/**
 * FilterIconStrip.ts
 * Hero Forge-style horizontal icon strip for filtering thumbnail grids
 */

import type { PanelComponent } from '../types/PanelTypes';

import { Tooltip } from './Tooltip';

export interface FilterIconGroup {
  id: string;
  type: 'shape' | 'waveform';
  label: string;
  icons: FilterIconDefinition[];
}

export interface FilterIconDefinition {
  id: string;
  svgPath: string;
  tooltip: string;
  stateValue: string;
}

export class FilterIconStrip implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _groups: FilterIconGroup[];
  private _activeFilters: Map<string, Set<string>>;
  private _onChange: (groupId: string, selections: Set<string>) => void;
  private _tooltip: Tooltip = new Tooltip();
  
  constructor(
    groups: FilterIconGroup[],
    initialFilters: Map<string, Set<string>>,
    onChange: (groupId: string, selections: Set<string>) => void
  ) {
    this._groups = groups;
    this._activeFilters = new Map(initialFilters);
    this._onChange = onChange;
    
    groups.forEach(group => {
      if (!this._activeFilters.has(group.id)) {
        this._activeFilters.set(group.id, new Set());
      }
    });
  }
  
  render(): HTMLElement {
    this._container = document.createElement('div');
    this._container.className = 'filter-icon-strip';
    
    // Wrap show all button in container div to match filter-group structure
    const showAllContainer = document.createElement('div');
    showAllContainer.className = 'filter-group show-all-group';
    showAllContainer.style.padding = '0';
    showAllContainer.style.border = 'none';
    showAllContainer.style.background = 'transparent';
    const showAllButton = this._createShowAllButton();
    showAllContainer.appendChild(showAllButton);
    this._container.appendChild(showAllContainer);
    
    this._groups.forEach(group => {
      const groupElement = this._createFilterGroup(group);
      this._container!.appendChild(groupElement);
    });
    
    return this._container;
  }
  
  private _createFilterGroup(group: FilterIconGroup): HTMLElement {
    const groupDiv = document.createElement('div');
    groupDiv.className = `filter-group ${group.type}`;
    groupDiv.dataset.groupId = group.id;
    
    group.icons.forEach(icon => {
      const button = this._createIconButton(group.id, group.type, icon);
      groupDiv.appendChild(button);
    });
    
    return groupDiv;
  }
  
  private _createShowAllButton(): HTMLElement {
    const button = document.createElement('button');
    button.className = 'filter-icon filter-show-all';
    
    // Add tooltip handlers
    button.addEventListener('mouseenter', () => {
      this._tooltip.show('Clear all filters', button, 'above', 'tooltip-filter');
    });
    button.addEventListener('mouseleave', () => {
      this._tooltip.hide();
    });
    
    // Active if no filters selected across all groups
    const allEmpty = Array.from(this._activeFilters.values()).every(set => set.size === 0);
    if (allEmpty) {
      button.classList.add('active');
    }
    
    // Create filter funnel SVG inline (three horizontal lines forming funnel)
    button.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 6 L20 6 M6 12 L18 12 M9 18 L15 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
      </svg>
    `;
    
    button.addEventListener('click', () => {
      this._handleShowAllClick();
    });
    
    return button;
  }
  
  private _handleShowAllClick(): void {
    // Hide tooltip immediately on click
    this._tooltip.hide();
    
    // Always clear all filters (return to "show everything" state)
    this._groups.forEach(group => {
      this._activeFilters.set(group.id, new Set());
    });
    
    // Update all active states
    this._groups.forEach(group => {
      this._updateActiveStates(group.id);
    });
    
    // Emit change for each group
    this._groups.forEach(group => {
      const selections = this._activeFilters.get(group.id) || new Set();
      this._onChange(group.id, selections);
    });
  }
  
  private _createIconButton(groupId: string, groupType: string, icon: FilterIconDefinition): HTMLElement {
    const button = document.createElement('button');
    button.className = 'filter-icon';
    button.dataset.groupId = groupId;
    button.dataset.iconId = icon.id;
    
    // Add tooltip handlers
    button.addEventListener('mouseenter', () => {
      this._tooltip.show(icon.tooltip, button, 'above', 'tooltip-filter');
    });
    button.addEventListener('mouseleave', () => {
      this._tooltip.hide();
    });
    
    const activeSet = this._activeFilters.get(groupId);
    if (activeSet && activeSet.has(icon.id)) {
      button.classList.add('active');
    }
    
    this._loadSVG(icon.svgPath, button);
    
    button.addEventListener('click', () => {
      this._handleIconClick(groupId, icon.id, button);
    });
    
    return button;
  }
  
  private _loadSVG(svgPath: string, button: HTMLElement): void {
    const element = button;
    fetch(svgPath)
      .then(response => {
        if (!response.ok) throw new Error(`Failed to load ${svgPath}`);
        return response.text();
      })
      .then(svgText => {
        element.innerHTML = svgText;
      })
      .catch(error => {
        console.error('[FilterIconStrip] SVG load failed:', error);
        element.textContent = '?';
      });
  }
  
  private _handleIconClick(groupId: string, iconId: string, _button: HTMLElement): void {
    // Hide tooltip immediately on click
    this._tooltip.hide();
    
    const activeSet = this._activeFilters.get(groupId) || new Set();
    
    // Toggle this icon on/off
    if (activeSet.has(iconId)) {
      activeSet.delete(iconId);
    } else {
      activeSet.add(iconId);
    }
    
    this._activeFilters.set(groupId, activeSet);
    this._updateActiveStates(groupId);
    
    this._onChange(groupId, activeSet);
  }
  
  private _updateActiveStates(groupId: string): void {
    if (!this._container) return;
    
    const groupElement = this._container.querySelector(`[data-group-id="${groupId}"]`);
    if (!groupElement) return;
    
    const buttons = groupElement.querySelectorAll('.filter-icon');
    const activeSet = this._activeFilters.get(groupId) || new Set();
    
		buttons.forEach(btn => {
			const btnElement = btn as HTMLElement;
			const buttonIconId = btnElement.dataset.iconId;
			
			if (buttonIconId && activeSet.has(buttonIconId)) {
				btnElement.classList.add('active');
			} else {
				btnElement.classList.remove('active');
			}
		});
    
    // Update show all button state
    const allEmpty = Array.from(this._activeFilters.values()).every(set => set.size === 0);
    const showAllBtn = this._container.querySelector('.filter-show-all');
    if (showAllBtn) {
      if (allEmpty) {
        showAllBtn.classList.add('active');
      } else {
        showAllBtn.classList.remove('active');
      }
    }
  }
  
  destroy(): void {
    this._tooltip.destroy();
    
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}
