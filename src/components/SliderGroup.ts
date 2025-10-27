/**
 * SliderGroup.ts
 * Renders group of slider controls with live value display
 * 
 * Architecture: Stateless component
 * - Receives slider configs + values via constructor
 * - Emits change events via callback
 * - No internal state storage
 */

import type { PanelComponent, SliderConfig } from '../types/PanelTypes';

export class SliderGroup implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _sliders: SliderConfig[];
  private _onChange: (id: string, value: number) => void;
	private _numberSections?: number;
  
  constructor(
    sliders: SliderConfig[],
    onChange: (id: string, value: number) => void,
    numberSections?: number
  ) {
    this._sliders = sliders;
    this._onChange = onChange;
    this._numberSections = numberSections;
  }

  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'slider-group';

    this._sliders.forEach(config => {
      const group = document.createElement('div');
      group.className = 'slider-control';

      // Label row
      const labelRow = document.createElement('div');
      labelRow.className = 'slider-label-row';

      const label = document.createElement('label');
      label.textContent = config.label;
      label.htmlFor = config.id;
      labelRow.appendChild(label);

      const valueDisplay = document.createElement('span');
      valueDisplay.className = 'slider-value';
      valueDisplay.id = `${config.id}-value`;
      valueDisplay.textContent = `${config.value}${config.unit || ''}`;
      labelRow.appendChild(valueDisplay);

      group.appendChild(labelRow);

      // Slider input
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.id = config.id;
      slider.min = String(config.min);
      slider.max = String(config.max);
      slider.step = String(config.step);
      slider.value = String(config.value);
      slider.className = 'slider-input';

      // Event handler with debouncing
      let debounceTimer: number | null = null;

      slider.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        let value = parseFloat(target.value);

        // Enforce slot increments based on number of sections
        if (config.id === 'slots' && this._numberSections && this._numberSections > 0) {
          const remainder = value % this._numberSections;
          if (remainder !== 0) {
            value = Math.round(value / this._numberSections) * this._numberSections;
            // Visually snap the slider to the valid value
            target.value = String(value);
          }
        }

        // Update display immediately (visual feedback)
        valueDisplay.textContent = `${value}${config.unit || ''}`;

        // Debounce the actual state update (backend call)
        if (debounceTimer !== null) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = window.setTimeout(() => {
          this._onChange(config.id, value);
          debounceTimer = null;
        }, 300); // Wait 300ms after user stops dragging
      });

      group.appendChild(slider);
      container.appendChild(group);
    });
    
    this._container = container;
    return container;
  }
  
  destroy(): void {
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}