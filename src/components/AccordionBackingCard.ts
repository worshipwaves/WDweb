// src/components/AccordionBackingCard.ts

import type { PanelComponent } from '../types/PanelTypes';

export interface BackingCardConfig {
  id: string;
  label: string;
  colorRgb?: number[];
  textureUrl?: string;
}

export interface AccordionBackingCardProps {
  config: BackingCardConfig;
  selected: boolean;
  onSelect: (id: string) => void;
}

/**
 * Backing material card for accordion horizontal scroll.
 * Displays color swatch or texture with label below.
 */
export class AccordionBackingCard implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _config: BackingCardConfig;
  private _selected: boolean;
  private _onSelect: (id: string) => void;

  constructor(props: AccordionBackingCardProps) {
    this._config = props.config;
    this._selected = props.selected;
    this._onSelect = props.onSelect;
  }

  render(): HTMLElement {
    const card = document.createElement('button');
    card.className = 'accordion-card backing-card';
    card.dataset.itemId = this._config.id;

    if (this._selected) {
      card.classList.add('selected');
    }

    // Color swatch
    const swatch = document.createElement('div');
    swatch.className = 'backing-card-swatch';

    if (this._config.textureUrl) {
      swatch.style.backgroundImage = `url(${this._config.textureUrl})`;
      swatch.style.backgroundSize = 'cover';
      swatch.style.backgroundPosition = 'center';
    } else if (this._config.colorRgb) {
      const [r, g, b] = this._config.colorRgb;
      swatch.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    }

    card.appendChild(swatch);

    // Label
    const label = document.createElement('span');
    label.className = 'backing-card-label';
    label.textContent = this._config.label;
    card.appendChild(label);

    // Click handler
    card.addEventListener('click', () => {
      this._onSelect(this._config.id);
    });

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