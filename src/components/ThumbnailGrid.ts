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
  
  constructor(
    items: ThumbnailItem[],
    onSelect: (id: string) => void,
    currentSelection: string | null = null,
    tooltipContext?: { category?: string; subcategory?: string; type?: 'archetype' | 'species' }
  ) {
    this._items = items;
    this._onSelect = onSelect;
    this._currentSelection = currentSelection;
		this._tooltipClassName = tooltipContext 
      ? TooltipClassNameFactory.generate(tooltipContext)
      : 'tooltip-grid';
  }
  
  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'thumbnail-grid';
    
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
        swatch.style.backgroundColor = `rgb(${item.rgb[0]}, ${item.rgb[1]}, ${item.rgb[2]})`;
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
          // Create structured tooltip with image + text (matching species tooltip style)
          const contentContainer = document.createElement('div');
          contentContainer.className = 'tooltip-content-wrapper';
          
          // Large version of the thumbnail image
          if (item.thumbnailUrl) {
            const largeImage = document.createElement('img');
            largeImage.src = item.thumbnailUrl;
            largeImage.alt = item.label;
            contentContainer.appendChild(largeImage);
          }
          
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
          selectedCard.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest'
          });
        }
      });
    }
    
    return container;
  }
  
  destroy(): void {
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}