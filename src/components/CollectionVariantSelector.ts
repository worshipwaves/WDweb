// src/components/CollectionVariantSelector.ts

import type { PanelComponent } from '../types/PanelTypes';
import type { CollectionRecording } from '../types/schemas';

export interface CollectionVariantSelectorProps {
  recordings: CollectionRecording[];
  selectedRecordingId: string | null;
  onSelect: (recordingId: string) => void;
}

/**
 * Horizontal chip strip for selecting recording variants.
 * Appears below collection cards when a multi-version track is selected.
 */
export class CollectionVariantSelector implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _recordings: CollectionRecording[];
  private _selectedId: string | null;
  private _onSelect: (recordingId: string) => void;

  constructor(props: CollectionVariantSelectorProps) {
    this._recordings = props.recordings;
    this._selectedId = props.selectedRecordingId;
    this._onSelect = props.onSelect;
  }

  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'collection-variant-selector';

    const label = document.createElement('span');
    label.className = 'variant-selector-label';
    label.textContent = 'recording:';
    container.appendChild(label);

    const chipContainer = document.createElement('div');
    chipContainer.className = 'variant-chip-container';

    this._recordings.forEach(rec => {
      const chip = document.createElement('button');
      chip.className = 'variant-chip';
      chip.dataset.recordingId = rec.id;

      if (rec.id === this._selectedId) {
        chip.classList.add('selected');
      }

      chip.textContent = rec.artist;

      chip.addEventListener('click', () => {
        chipContainer.querySelectorAll('.variant-chip').forEach(c => {
          c.classList.remove('selected');
        });
        chip.classList.add('selected');

        this._onSelect(rec.id);
      });

      chipContainer.appendChild(chip);
    });

    container.appendChild(chipContainer);

    this._container = container;
    return container;
  }

  updateSelection(recordingId: string): void {
    if (!this._container) return;
    this._selectedId = recordingId;
    
    this._container.querySelectorAll('.variant-chip').forEach(chip => {
      const el = chip as HTMLElement;
      el.classList.toggle('selected', el.dataset.recordingId === recordingId);
    });
  }

  updateRecordings(recordings: CollectionRecording[], selectedId: string | null): void {
    this._recordings = recordings;
    this._selectedId = selectedId;
    
    if (this._container) {
      const oldContainer = this._container;
      const newEl = this.render();
      oldContainer.replaceWith(newEl);
    }
  }

  destroy(): void {
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}