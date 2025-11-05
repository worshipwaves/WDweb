/**
 * SimplePanel.ts
 * Wrapper component for simple HTML content (placeholders, static content)
 * 
 * Architecture: Stateless component
 * - Takes HTML string, wraps in component interface
 * - Used for placeholder content during development
 */

import type { PanelComponent } from '../types/PanelTypes';

export class SimplePanel implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _htmlContent: string;
  
  constructor(htmlContent: string) {
    this._htmlContent = htmlContent;
  }
  
  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'panel-content';
    container.innerHTML = this._htmlContent;
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