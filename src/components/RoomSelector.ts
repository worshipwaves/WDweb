/**
 * RoomSelector.ts
 * Card-based room background selector
 * 
 * Architecture: Stateless component matching BackingPanel pattern
 * - Card layout with room name and thumbnail
 * - Tooltip shows larger room image
 */

import type { PanelComponent } from '../types/PanelTypes';
import { Tooltip } from './Tooltip';

interface RoomBackground {
  id: string;
  name: string;
  path: string;
  description: string;
}

export class RoomSelector implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _rooms: RoomBackground[];
  private _currentSelection: string;
  private _onSelect: (id: string) => void;
  private _tooltip: Tooltip = new Tooltip();

  constructor(
    rooms: RoomBackground[],
    currentSelection: string,
    onSelect: (id: string) => void
  ) {
    this._rooms = rooms;
    this._currentSelection = currentSelection;
    this._onSelect = onSelect;
  }

  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'room-selector';

    this._rooms.forEach(room => {
      const card = this._createRoomCard(room);
      container.appendChild(card);
    });

    this._container = container;
    return container;
  }

  private _createRoomCard(room: RoomBackground): HTMLElement {
    const card = document.createElement('div');
    card.className = 'color-group-card';

    if (room.id === this._currentSelection) {
      card.classList.add('active');
    }

    // Room name label
    const label = document.createElement('div');
    label.className = 'color-group-label';
    label.textContent = room.name;
    card.appendChild(label);

    // Room thumbnail (single item, not grid)
    const thumbnailWrapper = document.createElement('div');
    thumbnailWrapper.className = 'room-thumbnail-wrapper';

    const thumbnail = this._createRoomThumbnail(room);
    thumbnailWrapper.appendChild(thumbnail);

    card.appendChild(thumbnailWrapper);
    return card;
  }

  private _createRoomThumbnail(room: RoomBackground): HTMLElement {
    const thumbnail = document.createElement('div');
    thumbnail.className = 'room-thumbnail';
    thumbnail.dataset.id = room.id;

    if (room.id === this._currentSelection) {
      thumbnail.classList.add('selected');
    }

    // Room image
    const img = document.createElement('img');
    img.src = room.path;
    img.alt = room.name;
    img.className = 'room-thumbnail-image';
    thumbnail.appendChild(img);

    // Tooltip on hover - large image
    thumbnail.addEventListener('mouseenter', () => {
      const contentContainer = document.createElement('div');
      contentContainer.className = 'tooltip-content-wrapper';

      // Large room image
      const largeImg = document.createElement('img');
      largeImg.src = room.path;
      largeImg.alt = room.name;
      contentContainer.appendChild(largeImg);

      // Description text
      const description = document.createElement('p');
      description.className = 'tooltip-description';
      description.textContent = `${room.name}\n\n${room.description}`;
      contentContainer.appendChild(description);

      this._tooltip.show(contentContainer, thumbnail, 'left', 'tooltip-rooms', 0, 0, true);
    });

    thumbnail.addEventListener('mouseleave', () => {
      this._tooltip.hide();
    });

    // Click handler
    thumbnail.addEventListener('click', () => {
      this._tooltip.hide();
      this._onSelect(room.id);
    });

    return thumbnail;
  }

  destroy(): void {
    this._tooltip.destroy();
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}