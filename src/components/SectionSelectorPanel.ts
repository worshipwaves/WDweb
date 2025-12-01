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
  visualOrder: number; // Render order: 0=top of stack (radial: clockwise from 12:00, linear: left-to-right)
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
      visualOrder: -1,
      label: 'Select All / Clear All'
    });
    
    // Determine visual order mapping based on shape, slot_style, and number_sections
    const slotStyle = this._controller.getState().composition.pattern_settings.slot_style;
    let visualMapping: number[];
    
    if (slotStyle === 'linear') {
      // Linear: icons stack left-to-right (reverse mesh array for n=2/n=3)
      if (this._shape === 'rectangular' && this._numberSections === 2) {
        visualMapping = [1, 0]; // [L, R]
      } else if (this._shape === 'rectangular' && this._numberSections === 3) {
        visualMapping = [2, 1, 0]; // [L, C, R]
      } else {
        visualMapping = Array.from({ length: this._numberSections }, (_, i) => i); // [0,1,2,3]
      }
    } else {
      // Radial: icons stack clockwise from 12 o'clock
      if ((this._shape === 'circular' || this._shape === 'diamond') && this._numberSections === 4) {
        visualMapping = [0, 1, 2, 3]; // TR, BR, BL, TL (already correct order)
      } else {
        visualMapping = Array.from({ length: this._numberSections }, (_, i) => i); // Already correct
      }
    }
    
    // Build icons with visual order
    for (let i = 0; i < this._numberSections; i++) {
      this._icons.push({
        id: `section_${i}`,
        sectionIndex: i,
        visualOrder: visualMapping.indexOf(i),
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
    
    // Sort icons by visual order (top-to-bottom = clockwise for radial, L-to-R for linear)
    const sortedIcons = [...this._icons].sort((a, b) => a.visualOrder - b.visualOrder);
    
    sortedIcons.forEach(iconDef => {
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
    
    // Render icons based on shape
    if (this._shape === 'circular' || this._shape === 'rectangular' || this._shape === 'diamond') {
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
      this._tooltip.show(iconDef.label, button, 'above', 'tooltip-section');
    });
    button.addEventListener('mouseleave', () => {
      this._tooltip.hide();
    });
    
    // Click handler
    button.addEventListener('click', (event) => {
      this._handleIconClick(iconDef, event);
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
    // For rectangular n=4, distinguish between radial (2x2) and linear (side-by-side)
    let svgPath: string;
    if (this._shape === 'rectangular' && this._numberSections === 4) {
      const slotStyle = this._controller.getState().composition.pattern_settings.slot_style;
      svgPath = slotStyle === 'linear' 
        ? `/assets/icons/rectangular_4_linear.svg`
        : `/assets/icons/rectangular_4.svg`;
    } else {
      svgPath = `/assets/icons/${this._shape}_${this._numberSections}.svg`;
    }
    
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
	
	private async _loadRectangularIcon(iconDef: SectionIcon, container: HTMLElement): Promise<void> {
    const iconPath = `/assets/icons/rectangular_${this._numberSections}_${iconDef.sectionIndex === null ? 'all' : iconDef.sectionIndex}.png`;
    
    const img = document.createElement('img');
    img.src = iconPath;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    
    container.appendChild(img);
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
      // n=3 handling depends on shape
      if (this._shape === 'rectangular') {
        // n=3 rectangular: One path with 3 segments (M commands)
        const group = svgElement.querySelector('g');
        const originalPath = group?.querySelector('path');
        if (!originalPath || !group) return;
        
        const pathData = originalPath.getAttribute('d') || '';
        const transform = originalPath.getAttribute('transform') || '';
        const style = originalPath.getAttribute('style') || '';
        const segments = pathData.split(/(?=M)/).filter(s => s.trim());
        
        // Clear and rebuild with separate paths
        group.innerHTML = '';
        
        // SVG order: [Middle, Right, Left]
        // Map to: [section1=Middle, section2=Right, section0=Left]
        const segmentToSection = [1, 0, 2];
        
        segments.forEach((segment, svgIndex) => {
          const newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          newPath.setAttribute('d', segment);
          if (transform) newPath.setAttribute('transform', transform);
          
          const sectionId = segmentToSection[svgIndex];
          const color = orangeSections.has(sectionId) ? '#D9A464' : '#FFFFFF';
          newPath.setAttribute('fill', color);
          newPath.setAttribute('stroke', color);
          newPath.setAttribute('style', style.replace(/fill:#[0-9a-fA-F]+/, `fill:${color}`).replace(/stroke:#[0-9a-fA-F]+/, `stroke:${color}`));
          
          group.appendChild(newPath);
        });
        return;
      }
      
      // n=3 circular: Three separate path elements with class="section"
      const paths = svgElement.querySelectorAll('path.section');
      const sectionOrder = ['top', 'right', 'left']; // Maps to section_id [0, 1, 2]
      
      paths.forEach((path, index) => {
        const color = orangeSections.has(index) ? '#D9A464' : '#FFFFFF';
        path.setAttribute('fill', color);
        path.setAttribute('stroke', color);
        path.setAttribute('style', `fill:${color};stroke:${color};stroke-width:1.33444`);
      });
      
    } else if (this._numberSections === 4) {
      // n=4 handling depends on shape and slot_style
      const slotStyle = this._controller.getState().composition.pattern_settings.slot_style;
      
      if (this._shape === 'rectangular' && slotStyle === 'linear') {
        // n=4 rectangular linear: One path with 4 segments (M commands)
        const group = svgElement.querySelector('g');
        const originalPath = group?.querySelector('path');
        if (!originalPath || !group) return;
        
        const pathData = originalPath.getAttribute('d') || '';
        const transform = originalPath.getAttribute('transform') || '';
        const style = originalPath.getAttribute('style') || '';
        const segments = pathData.split(/(?=M)/).filter(s => s.trim());
        
        // Clear and rebuild with separate paths
        group.innerHTML = '';
        
        // SVG order: [Leftmost, Middle-left, Middle-right, Rightmost]
        // Map to: [section0, section1, section2, section3]
        const segmentToSection = [1, 2, 0, 3];
        
        segments.forEach((segment, svgIndex) => {
          const newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          newPath.setAttribute('d', segment);
          if (transform) newPath.setAttribute('transform', transform);
          
          const sectionId = segmentToSection[svgIndex];
          const color = orangeSections.has(sectionId) ? '#D9A464' : '#FFFFFF';
          newPath.setAttribute('fill', color);
          newPath.setAttribute('stroke', color);
          newPath.setAttribute('style', style.replace(/fill:#[0-9a-fA-F]+/g, `fill:${color}`).replace(/stroke:#[0-9a-fA-F]+/g, `stroke:${color}`));
          
          group.appendChild(newPath);
        });
        return;
      }
      
      // n=4 radial (circular or rectangular 2x2): One path with 4 segments (M commands)
      const group = svgElement.querySelector('g');
      const originalPath = group?.querySelector('path');
      if (!originalPath || !group) return;
      
      const pathData = originalPath.getAttribute('d') || '';
      const transform = originalPath.getAttribute('transform') || '';
      const segments = pathData.split(/(?=M)/).filter(s => s.trim());
      
      // Clear and rebuild with separate paths
      group.innerHTML = '';
      
      // SVG segments are counter-clockwise: [TR, TL, BL, BR] (visual positions)
      let segmentToSection: number[];
      if (this._shape === 'circular' || this._shape === 'diamond') {
        // Circular: no rotation applied, mesh array = [TR, BR, BL, TL]
        segmentToSection = [0, 3, 2, 1];
      } else {
        // Rectangular: 180° Y rotation applied, mesh array visual = [TL, BL, BR, TR]
        segmentToSection = [0, 1, 2, 3];
      }
      
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
      // n=2 handling depends on shape
      if (this._shape === 'rectangular') {
        // n=2 rectangular: One path with 2 segments (M commands)
        const group = svgElement.querySelector('g');
        const originalPath = group?.querySelector('path');
        if (!originalPath || !group) return;
        
        const pathData = originalPath.getAttribute('d') || '';
        const style = originalPath.getAttribute('style') || '';
        const segments = pathData.split(/(?=M)/).filter(s => s.trim());
        
        // Clear and rebuild with separate paths
        group.innerHTML = '';
        
        // SVG order: [Left segment, Right segment]
        // Map to: [section1=Left, section0=Right]
        const segmentToSection = [1, 0];
        
        segments.forEach((segment, svgIndex) => {
          const newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          newPath.setAttribute('d', segment);
          
          const sectionId = segmentToSection[svgIndex];
          const color = orangeSections.has(sectionId) ? '#D9A464' : '#FFFFFF';
          newPath.setAttribute('fill', color);
          newPath.setAttribute('stroke', color);
          newPath.setAttribute('style', style.replace(/fill:#[0-9a-fA-F]+/, `fill:${color}`).replace(/stroke:#[0-9a-fA-F]+/, `stroke:${color}`));
          
          group.appendChild(newPath);
        });
        return;
      }
      
      if (this._shape === 'diamond') {
        // n=2 diamond: same structure as circular
        const mainGroup = svgElement.querySelector('g[stroke="#000"]');
        const originalPath = mainGroup?.querySelector('path');
        
        if (originalPath && mainGroup) {
          const pathData = originalPath.getAttribute('d') || '';
          const transform = originalPath.getAttribute('transform') || '';
          const segments = pathData.split(/(?=M)/).filter(s => s.trim());
          
          mainGroup.innerHTML = '';
          const segmentToSection = [0, 1];
          
          segments.forEach((segment, svgIndex) => {
            if (svgIndex < 2) {
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
        return;
      }
      
      // n=2 circular: First group g[stroke="#000"] has one path with 4 M commands (2 arcs + 2 dividers)
      const mainGroup = svgElement.querySelector('g[stroke="#000"]');
      const originalPath = mainGroup?.querySelector('path');
      
      if (originalPath && mainGroup) {
        const pathData = originalPath.getAttribute('d') || '';
        const transform = originalPath.getAttribute('transform') || '';
        const segments = pathData.split(/(?=M)/).filter(s => s.trim());
        
        // Clear and rebuild with separate paths
        mainGroup.innerHTML = '';
        
        // First 2 segments are the actual sections (arcs)
        // SVG order: [RIGHT arc, LEFT arc, ...]
        // Map to: [section0=RIGHT, section1=LEFT]
        const segmentToSection = [1, 0]; // SVG index 0→section0, SVG index 1→section1
        
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
  
  private _handleIconClick(iconDef: SectionIcon, event: MouseEvent): void {
    const newSelection = new Set(this._selectedSections);
    const isMultiSelect = event.ctrlKey || event.metaKey; // Ctrl on Windows/Linux, Cmd on Mac
    
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
      // Individual section icon clicked
      if (isMultiSelect) {
        // Ctrl+click: toggle that section (multi-select)
        if (newSelection.has(iconDef.sectionIndex)) {
          newSelection.delete(iconDef.sectionIndex);
        } else {
          newSelection.add(iconDef.sectionIndex);
        }
      } else {
        // Regular click: select only this section (replace selection)
        newSelection.clear();
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
