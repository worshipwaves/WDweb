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

import { Tooltip } from './Tooltip';
import { TooltipClassNameFactory } from '../utils/TooltipClassNameFactory';

export class ThumbnailGrid implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _items: ThumbnailItem[];
  private _currentSelection: string | null;
  private _onSelect: (id: string) => void;
  private _tooltip: Tooltip = new Tooltip();
	private _tooltipClassName: string;
	private _isDestroyed: boolean = false;
  private _horizontal: boolean = false;
  
  constructor(
    items: ThumbnailItem[],
    onSelect: (id: string) => void,
    currentSelection: string | null = null,
    tooltipContext?: { category?: string; subcategory?: string; type?: 'archetype' | 'species' },
    horizontal: boolean = false
  ) {
    this._items = items;
    this._onSelect = onSelect;
    this._currentSelection = currentSelection;
		this._tooltipClassName = tooltipContext 
      ? TooltipClassNameFactory.generate(tooltipContext)
      : 'tooltip-grid';
    this._horizontal = horizontal;
  }
  
  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = this._horizontal ? 'thumbnail-grid horizontal-scroll' : 'thumbnail-grid';
    
    this._items.forEach(item => {
      const card = document.createElement('button');
      card.className = 'thumbnail-card';
      card.dataset.itemId = item.id;
			
			// Map common items to specific demo IDs
      const demoIdMap: { [key: string]: string } = {
        'circular_radial_n2': 'thumbnail_split',
        'walnut-black-american': 'wood_walnut',
        // Add other mappings as needed
      };
      
      if (demoIdMap[item.id]) {
        card.dataset.demoId = demoIdMap[item.id];
      }
      
      if (item.id === this._currentSelection) {
        card.classList.add('selected');
      }
      
      if (item.disabled) {
        card.classList.add('disabled');
        card.disabled = true;
      }
      
      // Thumbnail image, color swatch, or placeholder
      if (item.thumbnailUrl) {
        const img = document.createElement('img');
        img.src = item.thumbnailUrl;
        img.alt = item.label;
        card.appendChild(img);
      } else if (item.rgb) {
        // Paint color swatch
        const swatch = document.createElement('div');
        swatch.className = 'thumbnail-color-swatch';
        // Convert normalized RGB (0-1) to CSS RGB (0-255)
        const r = Math.round(item.rgb[0] * 255);
        const g = Math.round(item.rgb[1] * 255);
        const b = Math.round(item.rgb[2] * 255);
        swatch.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
        card.appendChild(swatch);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'thumbnail-placeholder';
        placeholder.textContent = item.label.charAt(0);
        card.appendChild(placeholder);
      }
      
      // Label
/*       const label = document.createElement('span');
      label.className = 'thumbnail-label';
      label.textContent = item.label;
      card.appendChild(label); */
      
      // Event handler
      if (!item.disabled) {
        card.addEventListener('click', () => {
          this._tooltip.hide();
          this._onSelect(item.id);
        });
      }
			
			// Tooltip handlers
      if (item.tooltip) {
        card.addEventListener('mouseenter', () => {
					if (this._isDestroyed) return;
          // Create structured tooltip with image + text (matching species tooltip style)
          const contentContainer = document.createElement('div');
          contentContainer.className = 'tooltip-content-wrapper';
          
          // Large version of the thumbnail image
          /* if (item.thumbnailUrl) {
            const largeImage = document.createElement('img');
            largeImage.src = item.thumbnailUrl;
            largeImage.alt = item.label;
            contentContainer.appendChild(largeImage);
          } */
          
          // Text description with dark background
          const description = document.createElement('p');
          description.className = 'tooltip-description';
          description.textContent = item.tooltip;
          contentContainer.appendChild(description);
          
          this._tooltip.show(contentContainer, card, 'left', this._tooltipClassName, -10, 0, true);
        });
        card.addEventListener('mouseleave', () => {
          this._tooltip.hide();
        });
      }
      
      container.appendChild(card);
    });
    
    this._container = container;
    
    // Auto-scroll to selected item after render
    if (this._currentSelection) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        const selectedCard = container.querySelector('.thumbnail-card.selected') as HTMLElement;
        if (selectedCard) {
          // This scrollIntoView is causing a bug where the parent panel scrolls
          // instead of the scrollable content area, breaking the sticky header.
          // Disabling it is the most robust fix. The user can scroll manually.
          // selectedCard.scrollIntoView({ 
          //   behavior: 'smooth', 
          //   block: 'nearest'
          // });
        }
      });
    }
    
    return container;
  }
  
  destroy(): void {
		this._isDestroyed = true;
    this._tooltip.destroy();
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}