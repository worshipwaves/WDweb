// src/components/AccordionSpeciesCard.ts

import type { PanelComponent } from '../types/PanelTypes';

import { Tooltip } from './Tooltip';

export interface GrainOption {
  id: string;
  direction: string;
  thumbnailUrl: string;
  largeThumbnailUrl?: string;
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
	private _tooltip: Tooltip = new Tooltip();

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
        this._tooltip.hide();
        
        // Update visual selection across all species cards
        const scrollContainer = card.closest('.horizontal-scroll');
        if (scrollContainer) {
          // Remove selected from all cards and grain thumbs
          scrollContainer.querySelectorAll('.accordion-species-card').forEach(c => {
            c.classList.remove('selected');
            c.querySelectorAll('.grain-thumb').forEach(t => t.classList.remove('selected'));
          });
        }
        
        // Mark this card and grain as selected
        card.classList.add('selected');
        thumb.classList.add('selected');
        
        this._onSelect(this._config.id, grain.direction);
      });

      thumb.addEventListener('mouseenter', () => {
        const content = document.createElement('div');
        content.className = 'tooltip-content-wrapper';
        if (grain.largeThumbnailUrl) {
          const largeImg = document.createElement('img');
          largeImg.width = 512;
          largeImg.height = 512;
          largeImg.style.backgroundColor = 'transparent';
          largeImg.src = grain.largeThumbnailUrl;
          largeImg.alt = `${this._config.label} - ${grain.direction}`;
          content.appendChild(largeImg);
        }
        const desc = document.createElement('p');
        desc.className = 'tooltip-description';
        desc.textContent = `${this._config.label} with ${grain.direction} grain pattern.`;
        content.appendChild(desc);
        this._tooltip.show(content, thumb, 'left', 'tooltip-species', 0, 0, true, 'canvas');
      });
      thumb.addEventListener('mouseleave', () => this._tooltip.hide());

      grainGrid.appendChild(thumb);
    });

    card.appendChild(grainGrid);

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