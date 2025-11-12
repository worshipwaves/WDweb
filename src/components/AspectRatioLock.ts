/**
 * AspectRatioLock.ts
 * Checkbox control for locking/unlocking aspect ratio
 * 
 * Architecture: Stateless component
 * - Receives lock state via constructor
 * - Emits change events via callback
 * - No internal state storage
 */

import type { PanelComponent } from '../types/PanelTypes';

export class AspectRatioLock implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _locked: boolean;
  private _enabled: boolean;
  private _onChange: (locked: boolean) => void;
  
  /**
   * Create aspect ratio lock control
   * 
   * @param locked - Current lock state
   * @param enabled - Whether control is enabled (disabled for circular shapes)
   * @param onChange - Callback fired when lock state changes
   */
  constructor(
    locked: boolean,
    enabled: boolean,
    onChange: (locked: boolean) => void
  ) {
    this._locked = locked;
    this._enabled = enabled;
    this._onChange = onChange;
  }
  
  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'aspect-ratio-lock-control';
    
    // Checkbox input
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'aspect-lock';
    checkbox.checked = this._locked;
    checkbox.disabled = !this._enabled;
    checkbox.className = 'aspect-lock-checkbox';
    
    // Event handler - emit change via callback
    checkbox.addEventListener('change', () => {
      this._onChange(checkbox.checked);
    });
    
    // Label
    const label = document.createElement('label');
    label.htmlFor = 'aspect-lock';
    label.className = 'aspect-lock-label';
    
    // Lock icon (changes based on state)
    const icon = document.createElement('span');
    icon.className = 'lock-icon';
    icon.textContent = this._locked ? '🔒' : '🔓';
    
    // Label text
    const labelText = document.createElement('span');
    labelText.textContent = 'Lock Aspect Ratio';
    
    label.appendChild(icon);
    label.appendChild(labelText);
    
    container.appendChild(checkbox);
    container.appendChild(label);
    
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