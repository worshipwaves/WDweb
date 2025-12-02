// src/components/HorizontalScrollContainer.ts

import type { PanelComponent } from '../types/PanelTypes';

export interface HorizontalScrollContainerProps {
  onScrollChange?: (canScrollLeft: boolean, canScrollRight: boolean) => void;
}

/**
 * Horizontal scroll container with fade indicators for accordion content.
 * Manages scroll state, fade visibility, and scroll-to-selection behavior.
 */
export class HorizontalScrollContainer implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _scrollElement: HTMLElement | null = null;
  private _onScrollChange?: (canScrollLeft: boolean, canScrollRight: boolean) => void;
  private _scrollHandler: (() => void) | null = null;

  constructor(props?: HorizontalScrollContainerProps) {
    this._onScrollChange = props?.onScrollChange;
  }

  render(): HTMLElement {
    // Outer container for positioning fades
    const container = document.createElement('div');
    container.className = 'scroll-container';

    // Left fade indicator
    const fadeLeft = document.createElement('div');
    fadeLeft.className = 'scroll-fade scroll-fade--left';

    // Right fade indicator
    const fadeRight = document.createElement('div');
    fadeRight.className = 'scroll-fade scroll-fade--right';

    // Scrollable content area
    const scrollElement = document.createElement('div');
    scrollElement.className = 'horizontal-scroll';

    // Assemble structure
    container.appendChild(fadeLeft);
    container.appendChild(fadeRight);
    container.appendChild(scrollElement);

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
  }

  /**
   * Update scroll state and fade indicator visibility
   */
  private _updateScrollState(): void {
    if (!this._scrollElement || !this._container) return;

    const canScrollLeft = this._scrollElement.scrollLeft > 1;
    const canScrollRight = this._scrollElement.scrollLeft 
      this._scrollElement.scrollWidth - this._scrollElement.clientWidth - 1;

    this._container.classList.toggle('can-scroll-left', canScrollLeft);
    this._container.classList.toggle('can-scroll-right', canScrollRight);

    if (this._onScrollChange) {
      this._onScrollChange(canScrollLeft, canScrollRight);
    }
  }
}