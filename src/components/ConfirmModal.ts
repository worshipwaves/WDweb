/**
 * ConfirmModal - Custom confirmation dialog component
 * 
 * Replaces browser confirm() with branded modal matching app design.
 */

export interface ConfirmModalOptions {
  title: string;
  message: string;
  primaryAction: string;
  secondaryAction: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export class ConfirmModal {
  private modal: HTMLElement | null = null;
  private options: ConfirmModalOptions;
  
  constructor(options: ConfirmModalOptions) {
    this.options = options;
  }
  
  /**
   * Show the confirmation modal
   */
  show(): void {
    if (this.modal) return; // Already showing
    
    this.modal = document.createElement('div');
    this.modal.className = 'confirm-modal-overlay';
    this.modal.innerHTML = `
      <div class="confirm-modal">
        <div class="confirm-modal-header">
          <h3>${this.options.title}</h3>
        </div>
        <div class="confirm-modal-body">
          <p>${this.options.message}</p>
        </div>
        <div class="confirm-modal-footer">
          <button class="confirm-modal-btn confirm-modal-btn-secondary" data-action="cancel">
            ${this.options.secondaryAction}
          </button>
          <button class="confirm-modal-btn confirm-modal-btn-primary" data-action="confirm">
            ${this.options.primaryAction}
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.modal);
    
    // Bind event listeners
    const confirmBtn = this.modal.querySelector('[data-action="confirm"]');
    const cancelBtn = this.modal.querySelector('[data-action="cancel"]');
    
    confirmBtn?.addEventListener('click', () => this.handleConfirm());
    cancelBtn?.addEventListener('click', () => this.handleCancel());
    
    // Close on overlay click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.handleCancel();
      }
    });
    
    // ESC key to cancel
    const escHandler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        this.handleCancel();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }
  
  /**
   * Handle confirm button click
   */
  private handleConfirm(): void {
    this.hide();
    this.options.onConfirm();
  }
  
  /**
   * Handle cancel button click
   */
  private handleCancel(): void {
    this.hide();
    this.options.onCancel();
  }
  
  /**
   * Hide and remove the modal
   */
  private hide(): void {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}
