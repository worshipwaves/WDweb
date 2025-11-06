/**
 * SectionSelectorPanel.ts
 * Section selector with icon-based multi-select for Right Secondary panel
 * 
 * Architecture: Stateless component
 * - Displays vertical column of section selection icons
 * - Top icon: "All Sections" (full shape in orange)
 * - Individual icons: Single section highlighted in orange
 * - Multi-select support (toggles sections like 3D click)
 * - Bidirectional sync with SceneManager white dot overlays
 */

import type { PanelComponent } from '../types/PanelTypes';
import type { ApplicationController } from '../ApplicationController';
import { Tooltip } from './Tooltip';

interface SectionIcon {
  id: string; // 'all' or 'section_0', 'section_1', etc.
  sectionIndex: number | null; // null for 'all', 0-3 for individual sections
  label: string;
}

export class SectionSelectorPanel implements PanelComponent {
  private _container: HTMLElement | null = null;
  private _controller: ApplicationController;
  private _numberSections: number;
  private _shape: string;
  private _selectedSections: Set<number>;
  private _onSelectionChange: (selectedIndices: Set<number>) => void;
  private _icons: SectionIcon[] = [];
	private _tooltip: Tooltip;
  
  constructor(
    controller: ApplicationController,
    numberSections: number,
    shape: string,
    selectedSections: Set<number>,
    onSelectionChange: (selectedIndices: Set<number>) => void
  ) {
    this._controller = controller;
    this._numberSections = numberSections;
    this._shape = shape;
    this._selectedSections = new Set(selectedSections); // Clone to avoid mutation
    this._onSelectionChange = onSelectionChange;
		this._tooltip = new Tooltip();
    this._buildIconList();
  }
  
  private _buildIconList(): void {
    this._icons = [];
    
    // "All Sections" icon
    this._icons.push({
      id: 'all',
      sectionIndex: null,
      label: 'All Sections'
    });
    
    // Individual section icons
    for (let i = 0; i < this._numberSections; i++) {
      this._icons.push({
        id: `section_${i}`,
        sectionIndex: i,
        label: `Section ${i + 1}`
      });
    }
  }
  
  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'panel-content section-selector-panel';
    
    // Body with icon column (no header)
    const body = document.createElement('div');
    body.className = 'panel-body';
    
    const iconColumn = document.createElement('div');
    iconColumn.className = 'section-icon-column';
    
    this._icons.forEach(iconDef => {
      const iconButton = this._createIconButton(iconDef);
      iconColumn.appendChild(iconButton);
    });
    
    body.appendChild(iconColumn);
    container.appendChild(body);
    
    this._container = container;
    return container;
  }
  
	private _createIconButton(iconDef: SectionIcon): HTMLElement {
    const button = document.createElement('button');
    button.className = 'section-icon-button';
    button.dataset.iconId = iconDef.id;
    
    // Determine if this icon should be highlighted
    const isSelected = this._isIconSelected(iconDef);
    if (isSelected) {
      button.classList.add('selected');
    }
    
    // Load and render SVG
    const svgContainer = document.createElement('div');
    svgContainer.className = 'section-icon-svg';
    
    // Only render for circular shapes (rectangular uses different approach)
    if (this._shape === 'circular') {
      void this._loadAndColorSVG(iconDef, svgContainer);
    }
    
    button.appendChild(svgContainer);
    
    // Label (optional - can be hidden via CSS)
    const label = document.createElement('span');
    label.className = 'section-icon-label';
    label.textContent = iconDef.label;
    button.appendChild(label);
    
    // Tooltip handlers
    button.addEventListener('mouseenter', () => {
      this._tooltip.show(iconDef.label, button, 'left', 'tooltip-section');
    });
    button.addEventListener('mouseleave', () => {
      this._tooltip.hide();
    });
    
    // Click handler
    button.addEventListener('click', () => {
      this._handleIconClick(iconDef);
    });
    
    return button;
  }
  
  private _isIconSelected(iconDef: SectionIcon): boolean {
    if (iconDef.sectionIndex === null) {
      // "All" icon is selected if all sections are selected
      if (this._selectedSections.size === 0) return false;
      for (let i = 0; i < this._numberSections; i++) {
        if (!this._selectedSections.has(i)) return false;
      }
      return true;
    } else {
      // Individual section icon is selected if that section is in the set
      return this._selectedSections.has(iconDef.sectionIndex);
    }
  }
  
  private async _loadAndColorSVG(iconDef: SectionIcon, container: HTMLElement): Promise<void> {
    const svgPath = `/assets/icons/circular_${this._numberSections}.svg`;
    
    try {
      const response = await fetch(svgPath);
      if (!response.ok) {
        console.error(`[SectionSelector] Failed to load ${svgPath}`);
        return;
      }
      
      const svgText = await response.text();
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
      const svgElement = svgDoc.querySelector('svg');
      
      if (!svgElement) {
        console.error('[SectionSelector] No SVG element found');
        return;
      }
      
      // Apply colors to section paths
      this._applySectionColors(svgElement, iconDef);
      
      // Add to container
      container.innerHTML = svgElement.outerHTML;
      
    } catch (error) {
      console.error('[SectionSelector] Error loading SVG:', error);
    }
  }
  
  private _applySectionColors(svgElement: SVGElement, iconDef: SectionIcon): void {
    // Determine which sections should be orange
    const orangeSections = new Set<number>();
    if (iconDef.sectionIndex === null) {
      // "All" icon - all sections orange
      for (let i = 0; i < this._numberSections; i++) {
        orangeSections.add(i);
      }
    } else {
      // Individual section icon - only this section orange
      orangeSections.add(iconDef.sectionIndex);
    }
    
    if (this._numberSections === 3) {
      // n=3: Three separate path elements with class="section"
      const paths = svgElement.querySelectorAll('path.section');
      const sectionOrder = ['top', 'right', 'left']; // Maps to section_id [0, 1, 2]
      
      paths.forEach((path, index) => {
        const color = orangeSections.has(index) ? '#D9A464' : '#FFFFFF';
        path.setAttribute('fill', color);
        path.setAttribute('stroke', color);
        path.setAttribute('style', `fill:${color};stroke:${color};stroke-width:1.33444`);
      });
      
    } else if (this._numberSections === 4) {
      // n=4: One path with 4 segments (M commands) - need to split
      const group = svgElement.querySelector('g');
      const originalPath = group?.querySelector('path');
      if (!originalPath || !group) return;
      
      const pathData = originalPath.getAttribute('d') || '';
      const transform = originalPath.getAttribute('transform') || '';
      const segments = pathData.split(/(?=M)/).filter(s => s.trim());
      
      // Clear and rebuild with separate paths
      group.innerHTML = '';
      
      // SVG segments are counter-clockwise: [TR, TL, BL, BR]
      // Map to clockwise section_ids: [0=TR, 1=BR, 2=BL, 3=TL]
      const segmentToSection = [0, 3, 2, 1]; // Maps SVG index to section_id
      
      segments.forEach((segment, svgIndex) => {
        const newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        newPath.setAttribute('d', segment);
        newPath.setAttribute('transform', transform);
        
        const sectionId = segmentToSection[svgIndex];
        const color = orangeSections.has(sectionId) ? '#D9A464' : '#FFFFFF';
        newPath.setAttribute('fill', color);
        newPath.setAttribute('stroke', color);
        newPath.setAttribute('stroke-width', '.01');
        newPath.setAttribute('stroke-linecap', 'round');
        newPath.setAttribute('stroke-linejoin', 'round');
        
        group.appendChild(newPath);
      });
      
    } else if (this._numberSections === 2) {
      // n=2: First group g[stroke="#000"] has one path with 4 M commands (2 arcs + 2 dividers)
      const mainGroup = svgElement.querySelector('g[stroke="#000"]');
      const originalPath = mainGroup?.querySelector('path');
      
      if (originalPath && mainGroup) {
        const pathData = originalPath.getAttribute('d') || '';
        const transform = originalPath.getAttribute('transform') || '';
        const segments = pathData.split(/(?=M)/).filter(s => s.trim());
        
        // Clear and rebuild with separate paths
        mainGroup.innerHTML = '';
        
        // First 2 segments are the actual sections (arcs)
        // SVG order: [LEFT arc, RIGHT arc, ...]
        // Map to: [section1=LEFT, section0=RIGHT]
        const segmentToSection = [1, 0]; // SVG index 0→section1, SVG index 1→section0
        
        segments.forEach((segment, svgIndex) => {
          if (svgIndex < 2) { // Only the first 2 segments (the arcs)
            const newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            newPath.setAttribute('d', segment);
            newPath.setAttribute('transform', transform);
            
            const sectionId = segmentToSection[svgIndex];
            const color = orangeSections.has(sectionId) ? '#D9A464' : '#FFFFFF';
            newPath.setAttribute('fill', color);
            newPath.setAttribute('stroke', color);
            newPath.setAttribute('stroke-width', '.02');
            
            mainGroup.appendChild(newPath);
          }
        });
      }
    }
  }
  
  private _handleIconClick(iconDef: SectionIcon): void {
    const newSelection = new Set(this._selectedSections);
    
    if (iconDef.sectionIndex === null) {
      // "All" icon clicked
      const allSelected = newSelection.size === this._numberSections;
      
      if (allSelected) {
        // All currently selected → deselect all
        newSelection.clear();
      } else {
        // Not all selected → select all
        newSelection.clear();
        for (let i = 0; i < this._numberSections; i++) {
          newSelection.add(i);
        }
      }
    } else {
      // Individual section icon clicked → toggle that section
      if (newSelection.has(iconDef.sectionIndex)) {
        newSelection.delete(iconDef.sectionIndex);
      } else {
        newSelection.add(iconDef.sectionIndex);
      }
    }
    
    // Emit selection change
    this._onSelectionChange(newSelection);
  }
  
  /**
   * Update component with new selection state (called from controller)
   */
  updateSelection(selectedSections: Set<number>): void {
    this._selectedSections = new Set(selectedSections);
    
    if (!this._container) return;
    
    // Update icon button states
    const buttons = this._container.querySelectorAll('.section-icon-button');
    buttons.forEach((button) => {
      const iconId = (button as HTMLElement).dataset.iconId;
      const iconDef = this._icons.find(icon => icon.id === iconId);
      
      if (iconDef) {
        const isSelected = this._isIconSelected(iconDef);
        if (isSelected) {
          button.classList.add('selected');
        } else {
          button.classList.remove('selected');
        }
      }
    });
  }
  
  destroy(): void {
    this._tooltip.hide();
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}
