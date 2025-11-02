/**
 * Tooltip.ts
 * Displays hover tooltips with 500ms delay
 * 
 * Architecture: Utility component
 * - No state storage beyond timer reference
 * - Self-positioning relative to target
 */

export class Tooltip {
  private _element: HTMLElement | null = null;
  private _showTimer: number | null = null;
  
  show(text: string, targetElement: HTMLElement, position: 'left' | 'above' = 'left'): void {
    this.hide();
    
    this._showTimer = window.setTimeout(() => {
      const tooltip = document.createElement('div');
      tooltip.className = 'tooltip';
      tooltip.textContent = text;
      document.body.appendChild(tooltip);
      
      const rect = targetElement.getBoundingClientRect();
      
      if (position === 'above') {
        // Center horizontally above the target element
        tooltip.style.left = `${rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2)}px`;
        tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8}px`;
      } else {
        // Default: Position tooltip 16px left of the right main panel's left edge
        const rightMainPanel = document.querySelector('.panel-right-main') as HTMLElement;
        if (rightMainPanel) {
          const panelRect = rightMainPanel.getBoundingClientRect();
          tooltip.style.left = `${panelRect.left - tooltip.offsetWidth - 40}px`;
        } else {
          // Fallback if panel not found
          tooltip.style.left = `${rect.left - tooltip.offsetWidth - 20}px`;
        }
        tooltip.style.top = `${rect.top + (rect.height / 2) - (tooltip.offsetHeight / 2)}px`;
      }
      
      this._element = tooltip;
    }, 10);
  }
  
  hide(): void {
    if (this._showTimer !== null) {
      clearTimeout(this._showTimer);
      this._showTimer = null;
    }
    
    if (this._element) {
      this._element.remove();
      this._element = null;
    }
  }
  
  destroy(): void {
    this.hide();
  }
}