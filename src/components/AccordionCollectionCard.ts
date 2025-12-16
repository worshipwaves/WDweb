// src/components/AccordionCollectionCard.ts

import type { PanelComponent } from '../types/PanelTypes';
import type { CollectionRecording as CollectionRecordingType } from '../types/schemas';

export type CollectionRecording = CollectionRecordingType;

export interface CollectionCardConfig {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  waveformThumbnail?: string;
  recordings: CollectionRecording[];
}

export interface AccordionCollectionCardProps {
  config: CollectionCardConfig;
  selected: boolean;
  onSelect: (collectionId: string, recordingId: string) => void;
}

/**
 * Collection card for audio catalog selection in accordion horizontal scroll.
 * Displays waveform thumbnail with title and version count.
 */
export class AccordionCollectionCard implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _config: CollectionCardConfig;
  private _selected: boolean;
  private _onSelect: (collectionId: string, recordingId: string) => void;
	private _clickHandler: (() => void) | null = null;

  constructor(props: AccordionCollectionCardProps) {
    this._config = props.config;
    this._selected = props.selected;
    this._onSelect = props.onSelect;
  }

  render(): HTMLElement {
    const card = document.createElement('button');
    card.className = 'accordion-card collection-card';
    card.dataset.collectionId = this._config.id;
    card.dataset.category = this._config.category;

    if (this._selected) {
      card.classList.add('selected');
    }

    // Waveform thumbnail area
    const visual = document.createElement('div');
    visual.className = 'collection-card-visual';
    
    if (this._config.waveformThumbnail) {
      const img = document.createElement('img');
      img.src = this._config.waveformThumbnail;
      img.alt = this._config.title;
      img.loading = 'lazy';
      visual.appendChild(img);
    }
    // No fallback - visual area shows gradient background only
    
    card.appendChild(visual);

    // Info area
    const info = document.createElement('div');
    info.className = 'collection-card-info';

    const title = document.createElement('div');
    title.className = 'collection-card-title';
    title.textContent = this._config.title;
    info.appendChild(title);

    // Show version count or duration
    const meta = document.createElement('div');
    meta.className = 'collection-card-meta';
    if (this._config.recordings.length > 1) {
      meta.textContent = `${this._config.recordings.length} recordings`;
    } else if (this._config.recordings.length === 1) {
      meta.textContent = this._formatDuration(this._config.recordings[0].duration);
    }
    info.appendChild(meta);

    card.appendChild(info);

    // Click handler - select default recording
    this._clickHandler = () => {
      const defaultRec = this._config.recordings.find(r => r.isDefault) || this._config.recordings[0];
      if (defaultRec) {
        this._onSelect(this._config.id, defaultRec.id);
      }
    };
    card.addEventListener('click', this._clickHandler);

    this._container = card;
    return card;
  }

  private _formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  destroy(): void {
    if (this._container) {
      if (this._clickHandler) {
        this._container.removeEventListener('click', this._clickHandler);
        this._clickHandler = null;
      }
      this._container.remove();
      this._container = null;
    }
  }
}