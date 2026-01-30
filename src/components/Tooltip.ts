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
  
	show(content: string | HTMLElement, targetElement: HTMLElement, position: 'left' | 'above' | 'right' | 'below' = 'left', className: string = 'tooltip', offsetX: number = 0, offsetY: number = 0, fixedToPanel: boolean = false, verticalAlign: 'center' | 'top' | 'canvas' = 'center'): void {
    // Skip thumbnail tooltips (HTMLElement content) on mobile - help tooltips (string) still show
    const isMobile = window.innerWidth < 750;
    if (isMobile && typeof content !== 'string') {
      return;
    }
    
    this.hide();
    
    this._showTimer = window.setTimeout(() => {
			if (!targetElement.isConnected) {
        return;
      }
      const tooltip = document.createElement('div');
      tooltip.className = className;
      
      // Handle both string and HTMLElement content
      if (typeof content === 'string') {
        tooltip.textContent = content;
      } else {
        tooltip.appendChild(content);
      }
      
      document.body.appendChild(tooltip);
      
      const rect = targetElement.getBoundingClientRect();
      
			if (position === 'above') {
					// Center horizontally above the target element
					tooltip.style.left = `${rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + offsetX}px`;
					tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8 + offsetY}px`;
			} else if (position === 'right') {
					// Position to the right of the target element
					tooltip.style.left = `${rect.right + 8 + offsetX}px`;
					tooltip.style.top = `${rect.top + (rect.height / 2) - (tooltip.offsetHeight / 2) + offsetY}px`;
			} else {
					// Left: Position tooltip
					if (fixedToPanel && verticalAlign === 'canvas') {
							const canvas = document.getElementById('renderCanvas');
							if (canvas) {
								const canvasRect = canvas.getBoundingClientRect();
								const maxHeight = canvasRect.height * 0.9;
								const naturalHeight = tooltip.offsetHeight;
								const displayHeight = Math.min(naturalHeight, maxHeight);
								if (naturalHeight > maxHeight) {
									tooltip.style.maxHeight = `${maxHeight}px`;
								}
								tooltip.style.left = `${canvasRect.right - tooltip.offsetWidth + offsetX}px`;
								tooltip.style.top = `${canvasRect.top + (canvasRect.height / 2) - (displayHeight / 2) + offsetY}px`;
							} else {
								tooltip.style.left = `${rect.left - tooltip.offsetWidth - 8 + offsetX}px`;
								tooltip.style.top = `${rect.top + (rect.height / 2) - (tooltip.offsetHeight / 2) + offsetY}px`;
							}
					} else if (fixedToPanel) {
							tooltip.style.left = `${rect.left - tooltip.offsetWidth - 8 + offsetX}px`;
							tooltip.style.top = `${rect.top + (rect.height / 2) - (tooltip.offsetHeight / 2) + offsetY}px`;
					} else {
							// Relative to target element
							tooltip.style.left = `${rect.left - tooltip.offsetWidth - 8 + offsetX}px`;
							tooltip.style.top = `${rect.top + (rect.height / 2) - (tooltip.offsetHeight / 2) + offsetY}px`;
					}
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