// src/components/AccordionStyleCard.ts

import type { PanelComponent } from '../types/PanelTypes';

export interface StyleCardConfig {
  id: string;
  label: string;
  thumbnailUrl: string;
  disabled?: boolean;
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

    // Label
    const label = document.createElement('span');
    label.className = 'style-card-label';
    label.textContent = this._config.label;
    card.appendChild(label);

    // Click handler
    if (!this._config.disabled) {
      card.addEventListener('click', () => {
        this._onSelect(this._config.id);
      });
    }

    this._container = card;
    return card;
  }

  destroy(): void {
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}