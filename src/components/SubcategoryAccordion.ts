// src/components/SubcategoryAccordion.ts

import type { PanelComponent } from '../types/PanelTypes';
import { Tooltip } from './Tooltip';

/**
 * Configuration for a single accordion item (subcategory)
 */
export interface AccordionItemConfig {
  id: string;
  label: string;
  getValue: () => string;
  getToolbar?: () => HTMLElement | null;
  getContent: () => Promise<HTMLElement>;
  isSingle?: boolean;
  isDisabled?: boolean;
  helpText?: string;
}

/**
 * Props for SubcategoryAccordion component
 */
export interface SubcategoryAccordionProps {
  categoryId: string;
  items: AccordionItemConfig[];
  initialOpenState: Record<string, boolean>;
  onToggle: (subcategoryId: string, isOpen: boolean) => void;
}

/**
 * Caret icon SVG markup
 */
const CARET_SVG = `<svg class="subcategory-icon" width="16" height="16" viewBox="0 0 10 6" fill="none">
  <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/**
 * SubcategoryAccordion - Manages accordion UI for subcategory navigation.
 * 
 * Architecture:
 * - Uses native <details>/<summary> for accessibility
 * - Supports async content loading via getContent()
 * - Toolbars embedded in headers with event isolation
 * - Tracks open/close state via callbacks
 */
export class SubcategoryAccordion implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _categoryId: string;
  private _items: AccordionItemConfig[];
  private _openState: Record<string, boolean>;
  private _onToggle: (subcategoryId: string, isOpen: boolean) => void;
  
  // Track rendered elements for updates
  private _detailsElements: Map<string, HTMLDetailsElement> = new Map();
  private _valueElements: Map<string, HTMLElement> = new Map();
  private _toolbarElements: Map<string, HTMLElement> = new Map();
  private _contentElements: Map<string, HTMLElement> = new Map();
  
  // Track content load state to avoid duplicate loads
  private _contentLoaded: Map<string, boolean> = new Map();
  private _contentLoading: Map<string, boolean> = new Map();
  
  // Render ID guards for async content
  private _contentRenderId: Map<string, number> = new Map();
  
  // Tooltip for help icons
  private _tooltip: Tooltip = new Tooltip();
  private _activeHelpId: string | null = null;

  constructor(props: SubcategoryAccordionProps) {
    this._categoryId = props.categoryId;
    this._items = props.items;
    this._openState = { ...props.initialOpenState };
    this._onToggle = props.onToggle;
  }

  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'subcategory-accordion';
    container.dataset.categoryId = this._categoryId;

    this._items.forEach((item, index) => {
      const details = this._createAccordionItem(item, index + 1);
      container.appendChild(details);
    });

    this._container = container;
    return container;
  }

  /**
   * Update the displayed value for a subcategory
   */
  updateValue(subcategoryId: string): void {
    const valueEl = this._valueElements.get(subcategoryId);
    const item = this._items.find(i => i.id === subcategoryId);
    
    if (valueEl && item) {
      valueEl.textContent = item.getValue();
    }
  }

  /**
   * Programmatically set open/close state
   */
  setOpen(subcategoryId: string, isOpen: boolean): void {
    const details = this._detailsElements.get(subcategoryId);
    if (details) {
      details.open = isOpen;
      this._openState[subcategoryId] = isOpen;
      
      if (isOpen) {
        this._ensureContentLoaded(subcategoryId);
      }
    }
  }

  /**
   * Refresh the toolbar element for a subcategory
   */
  refreshToolbar(subcategoryId: string): void {
    const toolbarContainer = this._toolbarElements.get(subcategoryId);
    const item = this._items.find(i => i.id === subcategoryId);
    
    if (toolbarContainer && item?.getToolbar) {
      toolbarContainer.innerHTML = '';
      const newToolbar = item.getToolbar();
      if (newToolbar) {
        this._attachToolbarEvents(newToolbar);
        toolbarContainer.appendChild(newToolbar);
      }
    }
  }

  /**
   * Refresh content for a subcategory (force reload)
   */
  async refreshContent(subcategoryId: string): Promise<void> {
    this._contentLoaded.set(subcategoryId, false);
    await this._loadContent(subcategoryId);
  }

  destroy(): void {
    this._tooltip.hide();
    this._detailsElements.clear();
    this._valueElements.clear();
    this._contentElements.clear();
    this._contentLoaded.clear();
    this._contentLoading.clear();
    this._contentRenderId.clear();
    
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }

  /**
   * Create a single accordion item
   */
  private _createAccordionItem(item: AccordionItemConfig, stepNumber: number): HTMLDetailsElement {
    const details = document.createElement('details');
    details.className = 'subcategory-item';
    details.dataset.subcategoryId = item.id;

    // Apply variant classes
    if (item.isSingle) {
      details.classList.add('subcategory-item--single');
    }
    if (item.isDisabled) {
      details.classList.add('subcategory-item--disabled');
    }

    // Set initial open state
    const shouldOpen = item.isSingle || this._openState[item.id] || false;
    if (shouldOpen && !item.isDisabled) {
      details.open = true;
      this._openState[item.id] = true;
    }

    // Create summary (header)
    const summary = this._createSummary(item, stepNumber);
    details.appendChild(summary);

    // Create content container
    const content = document.createElement('div');
    content.className = 'subcategory-content';
    details.appendChild(content);

    // Store references
    this._detailsElements.set(item.id, details);
    this._contentElements.set(item.id, content);

    // Handle toggle events
    if (!item.isDisabled) {
      details.addEventListener('toggle', () => {
        this._handleToggle(item.id, details.open);
      });
    }

    // Load content if initially open
    if (details.open && !item.isDisabled) {
      this._ensureContentLoaded(item.id);
    }

    return details;
  }

  /**
   * Create the summary (clickable header) element
   */
  private _createSummary(item: AccordionItemConfig, stepNumber: number): HTMLElement {
    const summary = document.createElement('summary');
    summary.className = 'subcategory-header';

    // Top row: label + help + caret
    const topRow = document.createElement('div');
    topRow.className = 'subcategory-header-top';

    // Label (numbered only for wood category)
    const label = document.createElement('span');
    label.className = 'subcategory-label';
    label.textContent = this._categoryId === 'wood' ? `${stepNumber}. ${item.label}` : item.label;
    topRow.appendChild(label);

    // Actions container (help + caret)
    const actions = document.createElement('div');
    actions.className = 'subcategory-header-actions';

    // Help icon (if helpText provided)
    if (item.helpText) {
      const helpBtn = document.createElement('button');
      helpBtn.className = 'accordion-help-icon';
      helpBtn.type = 'button';
      helpBtn.textContent = '?';
      helpBtn.title = 'Help';
      
      // Isolate from accordion toggle
      helpBtn.addEventListener('mousedown', (e) => e.stopPropagation());
      helpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._activeHelpId === item.id) {
          this._tooltip.hide();
          this._activeHelpId = null;
        } else {
          this._tooltip.show(item.helpText!, helpBtn, 'left', 'tooltip-help', 0, 0, true, 'canvas');
          this._activeHelpId = item.id;
        }
      });
      
      actions.appendChild(helpBtn);
    }

    // Caret icon (hidden for single-item)
    if (!item.isSingle) {
      const iconWrapper = document.createElement('span');
      iconWrapper.innerHTML = CARET_SVG;
      actions.appendChild(iconWrapper.firstElementChild!);
    }

    topRow.appendChild(actions);
    summary.appendChild(topRow);

    // Value display (second line)
    const value = document.createElement('span');
    value.className = 'subcategory-value';
    value.textContent = item.getValue();
    this._valueElements.set(item.id, value);
    summary.appendChild(value);
		
    return summary;
  }

  /**
   * Attach click isolation to toolbar elements
   */
  private _attachToolbarEvents(toolbar: HTMLElement): void {
    if (!toolbar || typeof toolbar.addEventListener !== 'function') {
      console.warn('[SubcategoryAccordion] Invalid toolbar element');
      return;
    }
    
    // Prevent accordion toggle when clicking toolbar controls
    toolbar.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    // Also handle mousedown to prevent summary focus behavior
    toolbar.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
  }

  /**
   * Handle toggle event from details element
   */
  private _handleToggle(subcategoryId: string, isOpen: boolean): void {
    this._openState[subcategoryId] = isOpen;
    this._onToggle(subcategoryId, isOpen);

    if (isOpen) {
      // Single-open: close all other sections
      this._detailsElements.forEach((details, id) => {
        if (id !== subcategoryId && details.open) {
          details.open = false;
          this._openState[id] = false;
          this._onToggle(id, false);
        }
      });
      this._ensureContentLoaded(subcategoryId);
    }
  }

  /**
   * Ensure content is loaded for a subcategory
   */
  private _ensureContentLoaded(subcategoryId: string): void {
    if (this._contentLoaded.get(subcategoryId)) {
      return;
    }
    if (this._contentLoading.get(subcategoryId)) {
      return;
    }
    
    void this._loadContent(subcategoryId);
  }

  /**
   * Load content for a subcategory with render ID guard
   */
  private async _loadContent(subcategoryId: string): Promise<void> {
    const item = this._items.find(i => i.id === subcategoryId);
    const contentEl = this._contentElements.get(subcategoryId);
    
    if (!item || !contentEl) return;

    // Increment render ID for this subcategory
    const currentRenderId = (this._contentRenderId.get(subcategoryId) || 0) + 1;
    this._contentRenderId.set(subcategoryId, currentRenderId);
    
    this._contentLoading.set(subcategoryId, true);

    // Show loading state
    contentEl.innerHTML = '<div class="subcategory-loading">Loading...</div>';

    try {
      const content = await item.getContent();
      
      // Guard: check if this is still the current render
      if (this._contentRenderId.get(subcategoryId) !== currentRenderId) {
        return;
      }

      contentEl.innerHTML = '';
      contentEl.appendChild(content);
      this._contentLoaded.set(subcategoryId, true);
      
    } catch (error) {
      // Guard: check if this is still the current render
      if (this._contentRenderId.get(subcategoryId) !== currentRenderId) {
        return;
      }
      
      console.error(`Failed to load content for ${subcategoryId}:`, error);
      contentEl.innerHTML = '<div class="subcategory-error">Failed to load content</div>';
    } finally {
      this._contentLoading.set(subcategoryId, false);
    }
  }

  /**
   * Get current open state for all items
   */
  getOpenState(): Record<string, boolean> {
    return { ...this._openState };
  }

  /**
   * Get the content element for a subcategory
   */
  getContentElement(subcategoryId: string): HTMLElement | null {
    return this._contentElements.get(subcategoryId) || null;
  }

  /**
   * Get the details element for a subcategory
   */
  getDetailsElement(subcategoryId: string): HTMLDetailsElement | undefined {
    return this._detailsElements.get(subcategoryId);
  }
}