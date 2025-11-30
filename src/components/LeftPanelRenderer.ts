/**
 * LeftPanelRenderer.ts
 * Renders category navigation buttons in left panel
 * 
 * Architecture: Presentation-only component
 * - Emits events on category click
 * - Does NOT store state
 * - Receives callback for parent coordination
 */

import type { CategoryConfig } from '../types/PanelTypes';

export class LeftPanelRenderer {
  private _container: HTMLElement;
  private _categories: CategoryConfig[];
  private _onCategoryClick: (categoryId: string) => void;
  
  constructor(
    containerId: string,
    categories: CategoryConfig[],
    onCategoryClick: (categoryId: string) => void
  ) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }
    this._container = container;
    this._categories = categories;
    this._onCategoryClick = onCategoryClick;
  }
  
  render(): void {
    this._container.innerHTML = `
      <div class="panel-body">
        <div class="category-list">
          ${this._categories.map(cat => this._renderCategory(cat)).join('')}
        </div>
      </div>
    `;
    
    this._bindListeners();
  }
  
  private _renderCategory(cat: CategoryConfig): string {
    const disabledClass = cat.enabled ? '' : 'disabled';
    const disabledAttr = cat.enabled ? '' : 'disabled';
    
    return `
      <button 
        class="category-button ${disabledClass}" 
        data-category="${cat.id}"
        ${disabledAttr}
				data-demo-id="category_${cat.id}"
      >
        <span class="category-icon">${cat.icon}</span>
        <span class="category-label">${cat.label}</span>
      </button>
    `;
  }
  
  private _bindListeners(): void {
    const buttons = this._container.querySelectorAll('.category-button');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const categoryId = btn.getAttribute('data-category');
        if (categoryId) {
          // Update active state
          buttons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          
          // Emit event to parent
          this._onCategoryClick(categoryId);
        }
      });
    });
  }
}
