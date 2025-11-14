// src/components/WoodMaterialSelector.ts
import type { PanelComponent } from '../types/PanelTypes';

import { Tooltip } from './Tooltip';
import { TooltipClassNameFactory } from '../utils/TooltipClassNameFactory';

interface SpeciesInfo {
  id: string;
  display: string;
}

export class WoodMaterialSelector implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _speciesList: SpeciesInfo[];
  private _numberSections: number;
  private _currentSpecies: string;
  private _currentGrain: string;
  private _onSelect: (update: { species: string; grain: string }) => void;
  private _tooltip: Tooltip = new Tooltip();
	private _tooltipClassName: string;

  constructor(
    speciesList: SpeciesInfo[],
    numberSections: number,
    currentSpecies: string,
    currentGrain: string,
    onSelect: (update: { species: string; grain: string }) => void
  ) {
    this._speciesList = speciesList;
    this._numberSections = numberSections;
    this._currentSpecies = currentSpecies;
    this._currentGrain = currentGrain;
    this._onSelect = onSelect;
    this._tooltipClassName = TooltipClassNameFactory.generate({ type: 'species' });
  }

  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'wood-species-image-grid';

    this._speciesList.forEach(species => {
      const card = this._createSpeciesCard(species);
      container.appendChild(card);
    });

    this._container = container;
    
    // Auto-scroll to selected item after render
    requestAnimationFrame(() => {
      const selectedCard = container.querySelector('.species-card.active');
      if (selectedCard) {
        selectedCard.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
      }
    });
    
    return container;
  }

  private _createSpeciesCard(species: SpeciesInfo): HTMLElement {
    const card = document.createElement('div');
    card.className = 'species-card';
    if (species.id === this._currentSpecies) {
      card.classList.add('active');
    }

    const label = document.createElement('div');
    label.className = 'species-label';
    label.textContent = species.display;
    card.appendChild(label);

    const thumbnailGrid = document.createElement('div');
    thumbnailGrid.className = 'grain-thumbnail-grid';

    const grainOptions = this._getAvailableGrains();
    grainOptions.forEach(grain => {
      if (grain.isAvailable) {
        const thumb = this._createGrainThumbnail(species, grain.id, grain.label);
        thumbnailGrid.appendChild(thumb);
      }
    });

    card.appendChild(thumbnailGrid);
    return card;
  }

  private _createGrainThumbnail(species: SpeciesInfo, grainId: string, grainLabel: string): HTMLElement {
    const thumbContainer = document.createElement('button');
    thumbContainer.className = 'grain-thumbnail';

    // Translate the app state's grain direction to the thumbnail's ID format
    const currentGrainAsId = this._mapGrainToId(this._currentGrain);

    if (species.id === this._currentSpecies && grainId === currentGrainAsId) {
      thumbContainer.classList.add('selected');
    }

    const img = document.createElement('img');
    img.src = `/wood_thumbnails_small/${species.id}_${grainId}.png`;
    img.alt = `${species.display} - ${grainLabel}`;
    thumbContainer.appendChild(img);

    thumbContainer.addEventListener('mouseenter', () => {
      // Create a container for the tooltip content
      const contentContainer = document.createElement('div');
      contentContainer.className = 'tooltip-content-wrapper';

      // Create an image element for the large thumbnail
      const largeImage = document.createElement('img');
      largeImage.src = `/wood_thumbnails_large/${species.id}_${grainId}.png`;
      largeImage.alt = `${species.display} - ${grainLabel}`;
      contentContainer.appendChild(largeImage);

      // Create a text description element
      const description = document.createElement('p');
      description.className = 'tooltip-description';
      description.textContent = `This is a beautiful ${species.display} with a ${grainLabel.toLowerCase()} grain pattern. More details about the wood's origin and characteristics can go here.`;
      contentContainer.appendChild(description);
      
      // Pass the container element to the tooltip
      this._tooltip.show(contentContainer, thumbContainer, 'left', this._tooltipClassName, 0, 0, true);
    });
    thumbContainer.addEventListener('mouseleave', () => this._tooltip.hide());

    thumbContainer.addEventListener('click', () => {
      // Immediately hide the tooltip before triggering the re-render.
      this._tooltip.hide(); 

      const simpleGrain = this._mapIdToGrain(grainId);
      this._onSelect({ species: species.id, grain: simpleGrain });
    });

    return thumbContainer;
  }
  
  // Helper to translate state grain ('vertical') to thumbnail ID ('n1_vertical')
  private _mapGrainToId(grain: string): string {
    if (grain === 'radiant') return 'n4_radiant';
    if (grain === 'diamond') return 'n4_diamond';
    if (grain === 'horizontal') return 'n1_horizontal';
    return 'n1_vertical'; // Default
  }

  // Helper to translate thumbnail ID ('n1_vertical') back to state grain ('vertical')
  private _mapIdToGrain(grainId: string): string {
    if (grainId.includes('radiant')) return 'radiant';
    if (grainId.includes('diamond')) return 'diamond';
    if (grainId.includes('horizontal')) return 'horizontal';
    return 'vertical';
  }

	private _getAvailableGrains(): { id: string; label: string; isAvailable: boolean }[] {
		const resolver = window.controller?.getResolver();
		const state = window.controller?.getState()?.composition;
		const grainConfig = window.uiEngine?.getElementConfig('grainDirection');

		if (!resolver || !state || !grainConfig || !grainConfig.options) {
			console.warn('[WoodMaterialSelector] Missing resolver, state, or config for grain options.');
			return [];
		}

		const availableGrains = grainConfig.options
			.filter(opt => resolver.isOptionVisible('grainDirection', opt.value, state))
			.map(opt => ({
				id: this._mapGrainToId(String(opt.value)),
				label: opt.label,
				isAvailable: true,
			}));
		
		// This part is to make sure we don't show duplicate thumbnail types (like n1_vertical and n1_horizontal)
		// when only one is needed to represent the basic grains.
		const uniqueOptions: { id: string; label: string; isAvailable: boolean }[] = [];
		const seenIds = new Set<string>();

		for (const option of availableGrains) {
			if (!seenIds.has(option.id)) {
				uniqueOptions.push(option);
				seenIds.add(option.id);
			}
		}

		return uniqueOptions;
	}

  destroy(): void {
    this._tooltip.destroy();
    if (this._container) this._container.remove();
  }
}