// src/components/AccordionSpeciesCard.ts

import type { PanelComponent } from '../types/PanelTypes';

export interface GrainOption {
  id: string;
  direction: string;
  thumbnailUrl: string;
}

export interface SpeciesCardConfig {
  id: string;
  label: string;
  grains: GrainOption[];
}

export interface AccordionSpeciesCardProps {
  config: SpeciesCardConfig;
  selectedSpecies: string | null;
  selectedGrain: string | null;
  onSelect: (speciesId: string, grainDirection: string) => void;
}

/**
 * Species card for wood material selection in accordion horizontal scroll.
 * Displays species label with 4 grain direction thumbnails.
 */
export class AccordionSpeciesCard implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _config: SpeciesCardConfig;
  private _selectedSpecies: string | null;
  private _selectedGrain: string | null;
  private _onSelect: (speciesId: string, grainDirection: string) => void;

  constructor(props: AccordionSpeciesCardProps) {
    this._config = props.config;
    this._selectedSpecies = props.selectedSpecies;
    this._selectedGrain = props.selectedGrain;
    this._onSelect = props.onSelect;
  }

  render(): HTMLElement {
    const isSelectedSpecies = this._config.id === this._selectedSpecies;

    const card = document.createElement('div');
    card.className = 'accordion-card accordion-species-card';
    card.dataset.speciesId = this._config.id;

    if (isSelectedSpecies) {
      card.classList.add('selected');
    }

    // Species label
    const label = document.createElement('div');
    label.className = 'species-card-label';
    label.textContent = this._config.label;
    card.appendChild(label);

    // Grain thumbnail grid
    const grainGrid = document.createElement('div');
    grainGrid.className = 'species-grain-grid';

    this._config.grains.forEach(grain => {
      const thumb = document.createElement('button');
      thumb.className = 'grain-thumb';
      thumb.dataset.grain = grain.direction;

      if (isSelectedSpecies && grain.direction === this._selectedGrain) {
        thumb.classList.add('selected');
      }

      const img = document.createElement('img');
      img.src = grain.thumbnailUrl;
      img.alt = `${this._config.label} - ${grain.direction}`;
      img.loading = 'lazy';
      thumb.appendChild(img);

      thumb.addEventListener('click', (e) => {
        e.stopPropagation();
        this._onSelect(this._config.id, grain.direction);
      });

      grainGrid.appendChild(thumb);
    });

    card.appendChild(grainGrid);

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