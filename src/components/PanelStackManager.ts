/**
 * PanelStackManager.ts
 * Manages dynamic cascading panels for Hero Forge-style UI
 * 
 * Responsibilities:
 * - Maintain stack of active panels
 * - Calculate dynamic positioning based on viewport
 * - Handle responsive layout (desktop/tablet/mobile)
 * - Animate panel transitions
 * 
 * Architecture: Stateful component (allowed to track _panels)
 * All panel content comes from external sources (no business logic)
 */

import type { PanelComponent } from '../types/PanelTypes';

interface PanelState {
  id: string;
  component: PanelComponent;
  zIndex: number;
  position: number; // Horizontal offset multiplier
}

export class PanelStackManager {
  private _panels: PanelState[] = [];
  private _container: HTMLElement;
  private readonly BASE_Z_INDEX = 11;
  private readonly PANEL_WIDTH = 320;
  private readonly PANEL_GAP = 16;
  
  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }
    this._container = container;
  }
  
  /**
   * Add new panel to stack (cascading to the right)
   */
  pushPanel(component: PanelComponent): void {
    const position = this._panels.length;
    const newPanel: PanelState = {
      id: `panel-${Date.now()}`,
      component,
      zIndex: this.BASE_Z_INDEX + position,
      position
    };
    
    this._panels.push(newPanel);
    this.render();
  }
  
  /**
   * Remove last panel from stack
   */
  popPanel(): void {
    if (this._panels.length === 0) return;
    
    const panel = this._panels.pop();
    if (!panel) return;
    
    const element = document.getElementById(panel.id);
    
    if (element) {
      // Animate out
      element.style.transform = 'translateX(100%)';
      element.style.opacity = '0';
      
      setTimeout(() => {
        element.remove();
      }, 200); // Match CSS transition duration
    }
  }
  
  /**
   * Clear all panels from stack
   */
  clearStack(): void {
    // Destroy all panel components
    this._panels.forEach(panel => {
      panel.component.destroy();
    });
    
    // Clear immediately (no animation for full stack clear)
    this._container.innerHTML = '';
    this._panels = [];
  }
	
	/**
   * Clear only cascading panels (keep primary at index 0)
   */
  clearCascadingPanels(): void {
    if (this._panels.length <= 1) return;
    
    // Remove cascading panels (index > 0)
    const cascadingPanels = this._panels.splice(1);
    
    cascadingPanels.forEach(panel => {
      const element = document.getElementById(panel.id);
      if (element) {
        element.style.transform = 'translateX(100%)';
        element.style.opacity = '0';
        setTimeout(() => element.remove(), 200);
      }
      panel.component.destroy();
    });
  }

  /**
   * Update the primary (first) panel with new content
   */
  updatePrimaryPanel(component: PanelComponent): void {
    // Clear any cascading panels first
    this.clearCascadingPanels();
    
    // If no primary panel exists, push it
    if (this._panels.length === 0) {
      this.pushPanel(component);
      return;
    }
    
    // Replace primary panel content
    const primaryPanel = this._panels[0];
    const element = document.getElementById(primaryPanel.id);
    
    if (element) {
      // Destroy old component
      primaryPanel.component.destroy();
      
      // Update panel state
      primaryPanel.component = component;
      
      // Clear and re-render
      element.innerHTML = '';
      const newContent = component.render();
      element.appendChild(newContent);
    }
  }
  
  /**
   * Get current panel count
   */
  getPanelCount(): number {
    return this._panels.length;
  }
  
  /**
   * Check if stack is empty
   */
  isEmpty(): boolean {
    return this._panels.length === 0;
  }
  
  /**
   * Render all panels in stack
   */
  private render(): void {
    // Clear existing
    this._container.innerHTML = '';
    
    // Determine viewport type
    const viewportWidth = window.innerWidth;
    const isMobile = viewportWidth < 768;
    const isTablet = viewportWidth >= 768 && viewportWidth <= 1024;
    
    // Render each panel
    this._panels.forEach((panel, index) => {
      const element = document.createElement('aside');
      element.id = panel.id;
      element.className = 'panel panel-right';
      
      if (index > 0) {
        element.classList.add('panel-cascading');
      }
      
      // Calculate position based on viewport
      if (isMobile) {
        // Mobile: Panels not visible (bottom sheet used instead)
        element.style.display = 'none';
      } else if (isTablet && index > 0) {
        // Tablet: Overlay with slight offset for visibility
        element.style.right = '36px';
      } else {
        // Desktop: Side-by-side stacking
        const rightOffset = 16 + (index * (this.PANEL_WIDTH + this.PANEL_GAP));
        element.style.right = `${rightOffset}px`;
      }
      
      element.style.zIndex = `${panel.zIndex}`;
      
      // Render component and append to panel
      const componentElement = panel.component.render();
      element.appendChild(componentElement);
      
      // Set initial animation state
      element.style.opacity = '0';
      element.style.transform = 'translateX(100%)';
      
      this._container.appendChild(element);
      
      // Trigger entrance animation
      requestAnimationFrame(() => {
        element.style.opacity = '1';
        element.style.transform = 'translateX(0)';
      });
    });
  }
  
  /**
   * Handle window resize - reposition panels
   */
  handleResize(): void {
    this.render();
  }
}
