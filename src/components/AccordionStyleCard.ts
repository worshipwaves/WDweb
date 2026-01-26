// src/components/AccordionStyleCard.ts

import type { PanelComponent } from '../types/PanelTypes';

import { Tooltip } from './Tooltip';

export interface StyleCardConfig {
  id: string;
  label: string;
  thumbnailUrl: string;
  disabled?: boolean;
	tooltip?: string;
}

export interface AccordionStyleCardProps {
  config: StyleCardConfig;
  selected: boolean;
  onSelect: (id: string) => void;
}

/**
 * Style card for archetype selection in accordion horizontal scroll.
 * Displays thumbnail image with label below.
 */
export class AccordionStyleCard implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _config: StyleCardConfig;
  private _selected: boolean;
  private _onSelect: (id: string) => void;
	private _tooltip: Tooltip = new Tooltip();

  constructor(props: AccordionStyleCardProps) {
    this._config = props.config;
    this._selected = props.selected;
    this._onSelect = props.onSelect;
  }

  render(): HTMLElement {
    const card = document.createElement('button');
    card.className = 'accordion-card style-card';
    card.dataset.itemId = this._config.id;

    if (this._selected) {
      card.classList.add('selected');
    }

    if (this._config.disabled) {
      card.classList.add('disabled');
      card.disabled = true;
    }

    // Thumbnail image
    const img = document.createElement('img');
    img.className = 'style-card-image';
    img.src = this._config.thumbnailUrl;
    img.alt = this._config.label;
    img.loading = 'lazy';
    card.appendChild(img);

    // Click handler
    if (!this._config.disabled) {
      card.addEventListener('click', () => {
        this._tooltip.hide();
        this._onSelect(this._config.id);
      });
    }

    // Tooltip on hover
    if (this._config.tooltip) {
      card.addEventListener('mouseenter', () => {
        const content = document.createElement('div');
        content.className = 'tooltip-content-wrapper';
        
        // Optional: Add image to tooltip if desired for consistency
        const tooltipImg = document.createElement('img');
        tooltipImg.src = this._config.thumbnailUrl;
        tooltipImg.alt = this._config.label;
        content.appendChild(tooltipImg);

        const desc = document.createElement('p');
        desc.className = 'tooltip-description';
        desc.textContent = this._config.tooltip!;
        content.appendChild(desc);
        
        // Changed from 'tooltip-style-card' to 'tooltip-archetype' to match CSS
        this._tooltip.show(content, card, 'left', 'tooltip-archetype', 0, 0, true, 'canvas');
      });
      card.addEventListener('mouseleave', () => this._tooltip.hide());
    }

    this._container = card;
    return card;
  }

  destroy(): void {
    this._tooltip.hide();
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}