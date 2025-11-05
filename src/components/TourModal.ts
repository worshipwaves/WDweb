/**
 * TourModal - First-visit onboarding modal
 * 
 * Shows a welcome message with option to start the tour or explore independently.
 * Uses localStorage to track if user has seen the prompt.
 */

export class TourModal {
  private modal: HTMLElement | null = null;
  private onStartTour: () => void;
  private onDismiss: () => void;
  
  constructor(onStartTour: () => void, onDismiss: () => void) {
    this.onStartTour = onStartTour;
    this.onDismiss = onDismiss;
  }
  
  /**
   * Check if modal should be shown (first visit + no audio data)
   */
  static shouldShow(): boolean {
    const hasSeenPrompt = localStorage.getItem('hasSeenTourPrompt');
    const hasSession = localStorage.getItem('wavedesigner_session');
    
    // Don't show if user has seen it before
    if (hasSeenPrompt === 'true') return false;
    
    // Don't show if user has existing session with audio
    if (hasSession) {
      try {
        const session = JSON.parse(hasSession) as { audio?: { rawSamples?: number[] } };
        if (session.audio?.rawSamples && session.audio.rawSamples.length > 0) {
          return false;
        }
      } catch (e) {
        // Invalid session, show modal
      }
    }
    
    return true;
  }
  
  /**
   * Show the modal
   */
  show(): void {
    if (this.modal) return; // Already showing
    
    this.modal = document.createElement('div');
    this.modal.className = 'tour-modal-overlay';
    this.modal.innerHTML = `
      <div class="tour-modal">
        <div class="tour-modal-header">
          <h2>Welcome to WaveDesigner! 🎵</h2>
        </div>
        <div class="tour-modal-body">
          <p>New to custom audio art?</p>
          <p>Take a 60-second tour to see how easy it is to create your design.</p>
        </div>
        <div class="tour-modal-footer">
          <button class="tour-modal-btn tour-modal-btn-primary" data-action="start-tour">
            🎬 Start Tour (60s)
          </button>
          <button class="tour-modal-btn tour-modal-btn-secondary" data-action="explore">
            I'll explore on my own
          </button>
        </div>
        <div class="tour-modal-checkbox">
          <label>
            <input type="checkbox" id="dontShowAgain" />
            Don't show this again
          </label>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.modal);
    
    // Bind event listeners
    const startBtn = this.modal.querySelector('[data-action="start-tour"]');
    const exploreBtn = this.modal.querySelector('[data-action="explore"]');
    
    startBtn?.addEventListener('click', () => this.handleStartTour());
    exploreBtn?.addEventListener('click', () => this.handleDismiss());
    
    // Close on overlay click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.handleDismiss();
      }
    });
  }
  
  /**
   * Handle start tour button click
   */
  private handleStartTour(): void {
    this.savePreference();
    this.hide();
    localStorage.removeItem('wavedesigner_session');
    this.onStartTour();
  }
  
  /**
   * Handle dismiss/explore button click
   */
  private handleDismiss(): void {
    this.savePreference();
    this.hide();
    this.onDismiss();
  }
  
  /**
   * Save user preference to localStorage
   */
  private savePreference(): void {
    const checkbox = document.getElementById('dontShowAgain') as HTMLInputElement;
    if (checkbox?.checked) {
      localStorage.setItem('hasSeenTourPrompt', 'true');
    }
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
  
  /**
   * Force dismiss without saving preference (for programmatic use)
   */
  dismiss(): void {
    this.hide();
  }
}
