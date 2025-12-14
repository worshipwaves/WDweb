// src/components/PaintColorSelector.ts
// src/components/PaintColorSelector.ts
import type { PanelComponent } from '../types/PanelTypes';
import { HorizontalScrollContainer } from './HorizontalScrollContainer';
import { Tooltip } from './Tooltip';

interface PaintColor {
  id: string;
  name: string;
  rgb: number[];
  description: string;
  group?: string;
}

interface ColorGroup {
  name: string;
  colors: PaintColor[];
}

export class PaintColorSelector implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _colors: PaintColor[];
  private _currentSelection: string;
  private _onSelect: (id: string) => void;
  private _tooltip: Tooltip = new Tooltip();
  private _horizontal: boolean = false;
  private _scrollContainer: HorizontalScrollContainer | null = null;

  constructor(
    colors: PaintColor[],
    currentSelection: string,
    onSelect: (id: string) => void,
    horizontal: boolean = false
  ) {
    this._colors = colors;
    this._currentSelection = currentSelection;
    this._onSelect = onSelect;
    this._horizontal = horizontal;
  }

  render(): HTMLElement {
    if (this._horizontal) {
      this._scrollContainer = new HorizontalScrollContainer();
      const wrapper = this._scrollContainer.render();
      const scrollElement = this._scrollContainer.getScrollElement()!;
      scrollElement.classList.add('paint-color-selector');

      const groups = this._groupColors();
      groups.forEach(group => {
        const card = this._createGroupCard(group);
        scrollElement.appendChild(card);
      });

      this._container = wrapper;
      this._scrollContainer.scrollToSelected();
      return wrapper;
    }

    const container = document.createElement('div');
    container.className = 'paint-color-selector';

    const groups = this._groupColors();
    groups.forEach(group => {
      const card = this._createGroupCard(group);
      container.appendChild(card);
    });

    this._container = container;
    return container;
  }

  private _groupColors(): ColorGroup[] {
    const groupMap = new Map<string, PaintColor[]>();
    
    // Preserve order from config by using first occurrence
    const groupOrder: string[] = [];

    this._colors.forEach(color => {
      const groupName = color.group || 'Other';
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, []);
        groupOrder.push(groupName);
      }
      groupMap.get(groupName)!.push(color);
    });

    return groupOrder.map(name => ({
      name,
      colors: groupMap.get(name)!
    }));
  }

  private _createGroupCard(group: ColorGroup): HTMLElement {
    const card = document.createElement('div');
    card.className = 'color-group-card';

    // Check if any color in this group is selected
    const hasSelectedColor = group.colors.some(c => c.id === this._currentSelection);
    if (hasSelectedColor) {
      card.classList.add('active');
    }

    // Group label
    const label = document.createElement('div');
    label.className = 'color-group-label';
    label.textContent = group.name;
    card.appendChild(label);

    // Swatch grid (2 columns)
    const swatchGrid = document.createElement('div');
    swatchGrid.className = 'color-swatch-grid';

    group.colors.forEach(color => {
      const swatch = this._createColorSwatch(color);
      swatchGrid.appendChild(swatch);
    });

    card.appendChild(swatchGrid);
    return card;
  }

  private _createColorSwatch(color: PaintColor): HTMLElement {
    const swatch = document.createElement('button');
    swatch.className = 'color-swatch';

    if (color.id === this._currentSelection) {
      swatch.classList.add('selected');
    }

    // Color fill
    const colorFill = document.createElement('div');
    colorFill.className = 'color-swatch-fill';
    const r = Math.round(color.rgb[0] * 255);
    const g = Math.round(color.rgb[1] * 255);
    const b = Math.round(color.rgb[2] * 255);
    colorFill.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    swatch.appendChild(colorFill);

    // Tooltip on hover
    swatch.addEventListener('mouseenter', () => {
      const contentContainer = document.createElement('div');
      contentContainer.className = 'tooltip-content-wrapper';

      // Large color swatch
      const largeSwatch = document.createElement('div');
      largeSwatch.className = 'tooltip-color-swatch';
      largeSwatch.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
      contentContainer.appendChild(largeSwatch);

      // Color name and description
      const description = document.createElement('p');
      description.className = 'tooltip-description';
      description.textContent = `${color.name}\n\n${color.description}`;
      contentContainer.appendChild(description);

      this._tooltip.show(contentContainer, swatch, 'left', 'tooltip-paint', 0, 0, true);
    });

    swatch.addEventListener('mouseleave', () => {
      this._tooltip.hide();
    });

    // Click to select
    swatch.addEventListener('click', () => {
      this._tooltip.hide();
      this._onSelect(color.id);
    });

    return swatch;
  }

  destroy(): void {
    this._tooltip.destroy();
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}
