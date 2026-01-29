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

interface ExtendedSliderConfig extends SliderConfig {
  dynamic_max_by_sections?: Record<string, number>;
}


export class SliderGroup implements PanelComponent {
	private static _keyboardHandlerInitialized = false;
  private _container: HTMLElement | null = null;
  private _sliders: SliderConfig[];
  private _onChange: (id: string, value: number) => void;
	private _numberSections?: number;
	private _slotStyle?: string;
	private _title?: string;
	private _onInteraction?: (isInteracting: boolean) => void;
  private _isDragging = false;
  private _windowMouseUpHandler: (() => void) | null = null;
	private _pendingSliderValue: { id: string; value: number } | null = null;
  
  constructor(
    sliders: SliderConfig[],
    onChange: (id: string, value: number) => void,
    numberSections?: number,
    slotStyle?: string,
    title?: string,
    onInteraction?: (isInteracting: boolean) => void
  ) {
    this._sliders = sliders;
    this._onChange = onChange;
    this._numberSections = numberSections;
    this._slotStyle = slotStyle;
    this._title = title;
    this._onInteraction = onInteraction;
    
    // Apply dynamic max values based on number of sections
    this._updateDynamicMaxValues();
    
    // Initialize keyboard handler once
    SliderGroup._initKeyboardHandler();
  }
  
  /**
   * Enable keyboard arrow keys for sliders.
   * BabylonJS captures keyboard at window level; this intercepts for sliders.
   */
  private static _initKeyboardHandler(): void {
    if (SliderGroup._keyboardHandlerInitialized) return;
    SliderGroup._keyboardHandlerInitialized = true;
    
    let activeSlider: HTMLInputElement | null = null;
    let renderTimer: number | null = null;
    
    document.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('slider-input')) {
        activeSlider = target as HTMLInputElement;
      } else if (!target.closest('.slider-control')) {
        activeSlider = null;
      }
    }, true);
    
    window.addEventListener('keydown', (e) => {
      if (!activeSlider) return;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      
      e.stopImmediatePropagation();
      e.preventDefault();
      
      if (renderTimer !== null) clearTimeout(renderTimer);
      
      const step = parseFloat(activeSlider.step) || 1;
      const min = parseFloat(activeSlider.min);
      const max = parseFloat(activeSlider.max);
      let val = parseFloat(activeSlider.value);
      
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') val += step;
      else val -= step;
      
      val = Math.max(min, Math.min(max, val));
      activeSlider.value = String(val);
      
      const display = activeSlider.closest('.slider-control')?.querySelector('.slider-value');
      if (display) display.textContent = val + '"';
      
      const slider = activeSlider;
      renderTimer = window.setTimeout(() => {
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      }, 300);
    }, true);
  }
  
  /**
   * Update max values for sliders with dynamic_max_by_sections
   * @private
   */
  private _updateDynamicMaxValues(): void {
    if (!this._numberSections) return;
    
    this._sliders.forEach((slider, index) => {
      const dynamicMax = (slider as ExtendedSliderConfig).dynamic_max_by_sections;
      if (dynamicMax) {
        const sectionKey = String(this._numberSections);
        const newMax = dynamicMax[sectionKey];
        if (newMax !== undefined) {
          this._sliders[index] = { ...slider, max: newMax };
          
          // Clamp current value if it exceeds new max
          if (this._sliders[index].value > this._sliders[index].max) {
            this._sliders[index] = { ...this._sliders[index], value: this._sliders[index].max };
          }
        }
      }
    });
	}

  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'slider-group';

    // Add optional header
    if (this._title) {
      const header = document.createElement('div');
      header.className = 'panel-header';
      header.innerHTML = `<h3>${this._title}</h3>`;
      container.appendChild(header);
    }
		
		// Window-level listeners to catch mouseup/touchend outside slider
    this._windowMouseUpHandler = () => {
      if (this._isDragging) {
        this._isDragging = false;
        // Fire pending value on drag end
        if (this._pendingSliderValue) {
          this._onChange(this._pendingSliderValue.id, this._pendingSliderValue.value);
          this._pendingSliderValue = null;
        }
        this._onInteraction?.(false);
      }
    };
    window.addEventListener('mouseup', this._windowMouseUpHandler);
    window.addEventListener('touchend', this._windowMouseUpHandler);

    this._sliders.forEach(config => {
      // Check for discrete presets
      if (config.discretePresets && config.discretePresets.length > 0) {
        const discreteEl = this._renderDiscreteSelector(config);
        container.appendChild(discreteEl);
        return;
      }
      
      const group = document.createElement('div');
      group.className = 'slider-control control-group'; // Add back the expected generic class

      // Label row
      const labelRow = document.createElement('div');
      labelRow.className = 'slider-label-row';

      const label = document.createElement('label');
      label.textContent = config.label;
      label.htmlFor = config.id;
      labelRow.appendChild(label);

      const displayOffset = config.displayOffset || 0;
      const displayValue = config.value + displayOffset;
      const displayMin = config.min + displayOffset;
      const displayMax = config.max + displayOffset;
      
      const valueDisplay = document.createElement('span');
      valueDisplay.className = 'slider-value';
      valueDisplay.id = `${config.id}-value`;
      valueDisplay.textContent = `${displayValue}${config.unit || ''}`;
      labelRow.appendChild(valueDisplay);

      group.appendChild(labelRow);

      // Slider input
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.id = config.id;
      slider.min = String(displayMin);
      slider.max = String(displayMax);
      slider.step = String(config.step);
      slider.value = String(displayValue);
      slider.className = 'slider-input';
			
			// Track interaction start (mouse and touch)
      const startDrag = () => {
        if (!this._isDragging) {
          this._isDragging = true;
          this._onInteraction?.(true);
        }
      };
      slider.addEventListener('mousedown', startDrag);
      slider.addEventListener('touchstart', startDrag, { passive: true });

      slider.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const displayOffset = config.displayOffset || 0;
        let value = parseFloat(target.value) - displayOffset;

        // Enforce slot increments based on number of sections (radial only)
        if (config.id === 'slots' && this._numberSections && this._numberSections > 0 && this._slotStyle === 'radial') {
          const remainder = value % this._numberSections;
          if (remainder !== 0) {
            value = Math.round(value / this._numberSections) * this._numberSections;
            // Visually snap the slider to the valid value
            target.value = String(value);
          }
        }

        // Update display immediately (visual feedback)
        valueDisplay.textContent = `${value + displayOffset}${config.unit || ''}`;

        // Store value for render on drag end
        if (this._isDragging) {
          this._pendingSliderValue = { id: config.id, value };
        } else {
          // Not dragging (keyboard input, etc.) - fire immediately
          this._onChange(config.id, value);
        }
      });

      group.appendChild(slider);
      container.appendChild(group);
    });
    
    this._container = container;
    return container;
  }
  
  private _renderDiscreteSelector(config: SliderConfig): HTMLElement {
    const group = document.createElement('div');
    group.className = 'slider-control control-group discrete-selector';

    const labelRow = document.createElement('div');
    labelRow.className = 'slider-label-row';

    const label = document.createElement('label');
    label.textContent = config.label;
    label.htmlFor = `${config.id}-select`;
    labelRow.appendChild(label);

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'slider-value';
    valueDisplay.id = `${config.id}-value`;
    const selected = config.discretePresets?.find(p => p.n_end === config.selectedPresetNEnd);
    valueDisplay.textContent = selected ? `${selected.side_margin}${config.unit || ''}` : '';
    labelRow.appendChild(valueDisplay);

    group.appendChild(labelRow);

    const select = document.createElement('select');
    select.id = `${config.id}-select`;
    select.className = 'discrete-select';

    for (const preset of config.discretePresets || []) {
      const option = document.createElement('option');
      option.value = String(preset.n_end);
      option.textContent = `${preset.label} (${preset.side_margin}")`;
      option.selected = preset.n_end === config.selectedPresetNEnd;
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      const n_end = parseInt(select.value, 10);
      const preset = config.discretePresets?.find(p => p.n_end === n_end);
      if (preset) {
        valueDisplay.textContent = `${preset.side_margin}${config.unit || ''}`;
      }
      this._onChange('symmetric_n_end', n_end);
    });

    group.appendChild(select);
    return group;
  }

  destroy(): void {
		// Clean up window-level event listener
    if (this._windowMouseUpHandler) {
      window.removeEventListener('mouseup', this._windowMouseUpHandler);
			window.removeEventListener('touchend', this._windowMouseUpHandler);
      this._windowMouseUpHandler = null;
    }
    if (this._isDragging) {
      this._isDragging = false;
      this._onInteraction?.(false);
    }
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}