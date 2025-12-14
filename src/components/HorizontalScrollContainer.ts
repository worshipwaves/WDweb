// src/components/HorizontalScrollContainer.ts

import type { PanelComponent } from '../types/PanelTypes';

export interface HorizontalScrollContainerProps {
  onScrollChange?: (canScrollLeft: boolean, canScrollRight: boolean) => void;
}

/**
 * Horizontal scroll container with arrow navigation for accordion content.
 * Manages scroll state, arrow visibility, and scroll-to-selection behavior.
 */
export class HorizontalScrollContainer implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _scrollElement: HTMLElement | null = null;
  private _leftArrow: HTMLButtonElement | null = null;
  private _rightArrow: HTMLButtonElement | null = null;
  private _onScrollChange?: (canScrollLeft: boolean, canScrollRight: boolean) => void;
  private _scrollHandler: (() => void) | null = null;

  constructor(props?: HorizontalScrollContainerProps) {
    this._onScrollChange = props?.onScrollChange;
  }

  render(): HTMLElement {
    // Outer container for positioning arrows
    const container = document.createElement('div');
    container.className = 'scroll-container';

    // Left arrow button
    const leftArrow = document.createElement('button');
    leftArrow.className = 'scroll-arrow scroll-arrow--left';
    leftArrow.type = 'button';
    leftArrow.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    leftArrow.addEventListener('click', () => this._scrollByCard(-1));

    // Right arrow button
    const rightArrow = document.createElement('button');
    rightArrow.className = 'scroll-arrow scroll-arrow--right';
    rightArrow.type = 'button';
    rightArrow.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    rightArrow.addEventListener('click', () => this._scrollByCard(1));

    // Scrollable content area
    const scrollElement = document.createElement('div');
    scrollElement.className = 'horizontal-scroll';

    // Assemble structure
    container.appendChild(leftArrow);
    container.appendChild(rightArrow);
    container.appendChild(scrollElement);

    this._leftArrow = leftArrow;
    this._rightArrow = rightArrow;

    // Set up scroll listener
    this._scrollHandler = () => this._updateScrollState();
    scrollElement.addEventListener('scroll', this._scrollHandler, { passive: true });

    this._container = container;
    this._scrollElement = scrollElement;

    // Initial state check after render
    requestAnimationFrame(() => this._updateScrollState());

    return container;
  }

  /**
   * Append a card element to the scroll container
   */
  appendCard(card: HTMLElement): void {
    if (this._scrollElement) {
      this._scrollElement.appendChild(card);
      // Update scroll state after adding content
      requestAnimationFrame(() => this._updateScrollState());
    }
  }

  /**
   * Append multiple card elements
   */
  appendCards(cards: HTMLElement[]): void {
    if (this._scrollElement) {
      cards.forEach(card => this._scrollElement!.appendChild(card));
      requestAnimationFrame(() => this._updateScrollState());
    }
  }

  /**
   * Clear all cards from the container
   */
  clearCards(): void {
    if (this._scrollElement) {
      this._scrollElement.innerHTML = '';
      this._updateScrollState();
    }
  }

  /**
   * Scroll to center the selected item in view
   */
  scrollToSelected(): void {
    if (!this._scrollElement) return;

    requestAnimationFrame(() => {
      const selected = this._scrollElement!.querySelector('.selected') as HTMLElement;
      if (!selected) return;

      const containerRect = this._scrollElement!.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();
      const scrollLeft = this._scrollElement!.scrollLeft;

      const targetScroll = scrollLeft +
        (selectedRect.left - containerRect.left) -
        (containerRect.width / 2) +
        (selectedRect.width / 2);

      this._scrollElement!.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: 'instant'
      });

      this._updateScrollState();
    });
  }

  /**
   * Get the scroll element for direct manipulation if needed
   */
  getScrollElement(): HTMLElement | null {
    return this._scrollElement;
  }

  destroy(): void {
    if (this._scrollElement && this._scrollHandler) {
      this._scrollElement.removeEventListener('scroll', this._scrollHandler);
      this._scrollHandler = null;
    }
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
    this._scrollElement = null;
    this._leftArrow = null;
    this._rightArrow = null;
  }

  /**
   * Scroll by one card width in the specified direction
   */
  private _scrollByCard(direction: -1 | 1): void {
    if (!this._scrollElement) return;

    const firstCard = this._scrollElement.querySelector('.accordion-card, .species-card, .color-group-card') as HTMLElement;
    if (!firstCard) return;

    const gap = 15; // matches CSS gap
    const scrollAmount = (firstCard.offsetWidth + gap) * direction;

    this._scrollElement.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    });
  }

  /**
   * Update scroll state and fade indicator visibility
   */
  private _updateScrollState(): void {
    if (!this._scrollElement || !this._container) return;

    const canScrollLeft = this._scrollElement.scrollLeft > 1;
    const canScrollRight = this._scrollElement.scrollLeft < 
      this._scrollElement.scrollWidth - this._scrollElement.clientWidth - 1;

    this._container.classList.toggle('can-scroll-left', canScrollLeft);
    this._container.classList.toggle('can-scroll-right', canScrollRight);

    // Update arrow visibility
    if (this._leftArrow) {
      this._leftArrow.style.display = canScrollLeft ? 'flex' : 'none';
    }
    if (this._rightArrow) {
      this._rightArrow.style.display = canScrollRight ? 'flex' : 'none';
    }

    if (this._onScrollChange) {
      this._onScrollChange(canScrollLeft, canScrollRight);
    }
  }
}