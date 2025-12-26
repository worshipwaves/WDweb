// src/PanelGenerationService.ts

import {
  Scene,
  Mesh,
  MeshBuilder,
  CSG,
  Vector3,
  VertexBuffer,
  VertexData,
  StandardMaterial,
  Color3,
	TransformNode
} from '@babylonjs/core';

// BabylonJS requires earcut for ExtrudePolygon triangulation
import earcut from 'earcut';
if (typeof window !== 'undefined' && !(window as any).earcut) {
  (window as any).earcut = earcut;
}

interface PanelConfig {
  thickness: number;
  separation: number;
  numberSections: number;
  shape: string;
  finishX: number;
  finishY: number;
	slotStyle: string;
}

interface SectionDimensions {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

interface SlotData {
  x: number;
  z: number;
  angle: number;
  length: number;
  width?: number;
  panelIndex?: number;
  vertices?: number[][];  // Array of [x, y] coordinates
}

// Fillet parameters for CNC router visualization
const FILLET_RADIUS = 0.125;  // Half of 0.25" bit diameter
const FILLET_SEGMENTS = 4;    // Arc segments per corner

export class PanelGenerationService {
  private debugMode: boolean = false;
  private scene: Scene;
  
  constructor(scene: Scene) {
    this.scene = scene;
		(window as Window & { debugScene?: Scene }).debugScene = scene;
  }
  
  /**
   * Calculate dimensions and positions for each section based on shape and layout
   */
  private calculateSectionDimensions(config: PanelConfig): SectionDimensions[] {
    if (config.shape === 'circular') {
      return this.calculateCircularSections(config);
    }
    
    if (config.shape === 'rectangular') {
      return this.calculateRectangularSections(config);
    }
    
    throw new Error(`Unsupported shape: ${config.shape}`);
  }
  
  private calculateCircularSections(config: PanelConfig): SectionDimensions[] {
    const { finishX, finishY, numberSections, separation } = config;
    const radius = Math.min(finishX, finishY) / 2;
    const diameter = radius * 2;
    
    if (numberSections === 1) {
      return [{ width: diameter, height: diameter, offsetX: 0, offsetY: 0 }];
    }
    
    if (numberSections === 2) {
      // Two circles side by side with gap
      const offsetDistance = (diameter + separation) / 2;
      return [
        { width: diameter, height: diameter, offsetX: offsetDistance, offsetY: 0 },
        { width: diameter, height: diameter, offsetX: -offsetDistance, offsetY: 0 }
      ];
    }
    
    if (numberSections === 3) {
      // Three circles in triangular arrangement
      const gapDist = (separation) / Math.sqrt(3);
      return [
        { width: diameter, height: diameter, offsetX: 0, offsetY: gapDist },           // Top
        { width: diameter, height: diameter, offsetX: gapDist, offsetY: -gapDist },   // Bottom-right
        { width: diameter, height: diameter, offsetX: -gapDist, offsetY: -gapDist }   // Bottom-left
      ];
    }
    
    if (numberSections === 4) {
      // Four circles in 2x2 grid
      const offsetDistance = (diameter + separation) / 2;
      return [
        { width: diameter, height: diameter, offsetX: offsetDistance, offsetY: offsetDistance },    // Top-right
        { width: diameter, height: diameter, offsetX: offsetDistance, offsetY: -offsetDistance },   // Bottom-right
        { width: diameter, height: diameter, offsetX: -offsetDistance, offsetY: -offsetDistance },  // Bottom-left
        { width: diameter, height: diameter, offsetX: -offsetDistance, offsetY: offsetDistance }    // Top-left
      ];
    }
    
    throw new Error(`Unsupported number of sections for circular: ${numberSections}`);
  }
  
  private calculateRectangularSections(config: PanelConfig): SectionDimensions[] {
    const { finishX, finishY, numberSections, separation } = config;
    
    if (numberSections === 1) {
      return [{ width: finishX, height: finishY, offsetX: 0, offsetY: 0 }];
    }
    
    if (numberSections === 2) {
      // Split vertically: [panel] [gap] [panel]
      const sectionWidth = (finishX - separation) / 2;
      const offsetDistance = (sectionWidth + separation) / 2;
      return [
        { width: sectionWidth, height: finishY, offsetX: offsetDistance, offsetY: 0 },
        { width: sectionWidth, height: finishY, offsetX: -offsetDistance, offsetY: 0 }
      ];
    }
    
    if (numberSections === 4) {
      // Branch on slot style: linear = side-by-side, radial = 2×2 grid
      if (config.slotStyle === 'linear') {
        // Four rectangles side-by-side horizontally
        const sectionWidth = (finishX - separation * 3) / 4;
        const spacing = sectionWidth + separation;
        const startOffset = -finishX / 2 + sectionWidth / 2;
        return [
          { width: sectionWidth, height: finishY, offsetX: startOffset + spacing * 0, offsetY: 0 },
          { width: sectionWidth, height: finishY, offsetX: startOffset + spacing * 1, offsetY: 0 },
          { width: sectionWidth, height: finishY, offsetX: startOffset + spacing * 2, offsetY: 0 },
          { width: sectionWidth, height: finishY, offsetX: startOffset + spacing * 3, offsetY: 0 }
        ];
      } else {
        // Radial: 2×2 grid with gaps (existing behavior)
        const sectionWidth = (finishX - separation) / 2;
        const sectionHeight = (finishY - separation) / 2;
        const offsetX = (sectionWidth + separation) / 2;
        const offsetY = (sectionHeight + separation) / 2;
        return [
          { width: sectionWidth, height: sectionHeight, offsetX: offsetX, offsetY: offsetY },     // Top-right
          { width: sectionWidth, height: sectionHeight, offsetX: offsetX, offsetY: -offsetY },    // Bottom-right
          { width: sectionWidth, height: sectionHeight, offsetX: -offsetX, offsetY: -offsetY },   // Bottom-left
          { width: sectionWidth, height: sectionHeight, offsetX: -offsetX, offsetY: offsetY }     // Top-left
        ];
      }
    }
		
		if (numberSections === 3) {
			// Three rectangles side-by-side horizontally
			const sectionWidth = (finishX - separation * 2) / 3;
			const spacing = sectionWidth + separation;
			return [
				{ width: sectionWidth, height: finishY, offsetX: spacing, offsetY: 0 },      // Right
				{ width: sectionWidth, height: finishY, offsetX: 0, offsetY: 0 },           // Center
				{ width: sectionWidth, height: finishY, offsetX: -spacing, offsetY: 0 }     // Left
			];
		}		
    
    throw new Error(`Unsupported number of sections for rectangular: ${numberSections}`);
  }
  
  private createSectionBaseMesh(dim: SectionDimensions, config: PanelConfig): Mesh {
    if (config.shape === 'circular') {
      const cylinder = MeshBuilder.CreateCylinder('baseDisc', {
        diameter: dim.width,
        height: config.thickness,
        tessellation: 128,
        cap: Mesh.CAP_ALL
      }, this.scene);
      
      cylinder.bakeCurrentTransformIntoVertices();
      cylinder.refreshBoundingInfo();
      
      const mat = new StandardMaterial('discMat', this.scene);
      mat.diffuseColor = new Color3(0.8, 0.8, 0.8);
      mat.backFaceCulling = false;
      cylinder.material = mat;
      
      return cylinder;
    }
    
    if (config.shape === 'rectangular') {
      const baseMesh = MeshBuilder.CreateBox('baseBox', {
        width: dim.width,
        depth: dim.height, // Use depth for the "height" on the XZ plane
        height: config.thickness
      }, this.scene);
      
      // Bake the transformation into the vertices to create a clean mesh for CSG.
      baseMesh.bakeCurrentTransformIntoVertices();
      baseMesh.refreshBoundingInfo();
      
      // The material is just a placeholder for CSG, will be replaced later
      const mat = new StandardMaterial('placeholderMat', this.scene);
      mat.diffuseColor = new Color3(0.8, 0.8, 0.8);
      mat.backFaceCulling = false;
      baseMesh.material = mat;

      return baseMesh;
    }
    
    throw new Error(`Unsupported shape: ${config.shape}`);
  }
	
	/**
   * Creates a single triangular section for a diamond panel using CSG.
   * A diamond panel is composed of 4 such sections.
   */
  private _createDiamondSectionCSG(width: number, height: number, separation: number, thickness: number): Mesh {
    // Oversize the initial box to ensure clean cuts
    const oversize = 2;
    const baseBox = MeshBuilder.CreateBox('base', {
      width: width + oversize,
      depth: height + oversize,
      height: thickness * 3 // Extra thickness for CSG robustness
    }, this.scene);
    baseBox.position.x = width / 2;
    baseBox.position.z = height / 2;
    baseBox.bakeCurrentTransformIntoVertices();
    let baseCSG = CSG.FromMesh(baseBox);

    // Create large, thin boxes to act as cutting planes
    const cutterWidth = Math.max(width, height) * 4;
    const cutterHeight = thickness * 5;

    // Cutter 1: Defines the outer diagonal edge of the triangle
    const cutter1 = MeshBuilder.CreateBox('cutter1', { width: cutterWidth, height: cutterHeight, depth: 2 }, this.scene);
    cutter1.position = new Vector3(width / 2, 0, height / 2);
    cutter1.rotation.y = Math.atan2(height, width); // Align with the diagonal
    cutter1.position.x -= (cutterWidth / 2 - 1) * Math.cos(cutter1.rotation.y);
    cutter1.position.z -= (cutterWidth / 2 - 1) * Math.sin(cutter1.rotation.y);

    // Cutter 2: Defines the inner vertical separation edge
    const cutter2 = MeshBuilder.CreateBox('cutter2', { width: 2, height: cutterHeight, depth: cutterWidth }, this.scene);
    cutter2.position.x = separation / 2;
    
    // Cutter 3: Defines the inner horizontal separation edge
    const cutter3 = MeshBuilder.CreateBox('cutter3', { width: cutterWidth, height: cutterHeight, depth: 2 }, this.scene);
    cutter3.position.z = separation / 2;
    
    // Perform subtractions
    baseCSG = baseCSG.subtract(CSG.FromMesh(cutter1));
    baseCSG = baseCSG.subtract(CSG.FromMesh(cutter2));
    baseCSG = baseCSG.subtract(CSG.FromMesh(cutter3));

    // Dispose of temporary meshes
    baseBox.dispose();
    cutter1.dispose();
    cutter2.dispose();
    cutter3.dispose();
    
    // Return the final manifold mesh for this section
    const sectionMesh = baseCSG.toMesh('diamondSection', null, this.scene);
    sectionMesh.bakeCurrentTransformIntoVertices();
    return sectionMesh;
  }
  
  /**
   * Main entry point - creates panels using CSG approach
   */
	createPanelsWithCSG(
    config: PanelConfig,
    slots?: SlotData[],
    sectionEdges?: {
      section_index: number;
      edge1_start: number[];
      edge1_end: number[];
      edge2_start: number[];
      edge2_end: number[];
    }[]
  ): Mesh[] {
		if (config.shape === 'diamond') {
      // This is a simpler, more robust "Top-Down CSG" approach.
      // 1. Create the full diamond panel.
      // 2. Use large cutting boxes to slice it into the final sections.
      // 3. Use a simple, correct, quadrant-based slot filter.

      const finalMeshes: Mesh[] = [];
      const { finishX, finishY, thickness, separation, numberSections } = config;

      // Step 1: Create the full, solid diamond base mesh.
      const fullDiamond = MeshBuilder.CreateCylinder('baseDiamond', {
        diameter: 1, height: thickness, tessellation: 4, cap: Mesh.CAP_ALL
      }, this.scene);
      fullDiamond.scaling = new Vector3(finishX, 1, finishY);
      fullDiamond.bakeCurrentTransformIntoVertices();
      const baseCSG = CSG.FromMesh(fullDiamond);
      fullDiamond.dispose();

      // Step 2: Define the section geometries by slicing the base diamond.
      const sectionCSGs: CSG[] = [];
      const oversize = Math.max(finishX, finishY) * 2; // Cutter size
      const halfSep = separation / 2;

      if (numberSections === 1) {
        sectionCSGs.push(baseCSG);
      } else if (numberSections === 2) {
        const rightCutter = MeshBuilder.CreateBox('rc', { width: oversize, depth: oversize, height: thickness * 2 }, this.scene);
        rightCutter.position = new Vector3(oversize / 2 + halfSep, 0, 0);
        const leftCutter = MeshBuilder.CreateBox('lc', { width: oversize, depth: oversize, height: thickness * 2 }, this.scene);
        leftCutter.position = new Vector3(-oversize / 2 - halfSep, 0, 0);

        sectionCSGs.push(baseCSG.intersect(CSG.FromMesh(rightCutter))); // Section 0 (Right)
        sectionCSGs.push(baseCSG.intersect(CSG.FromMesh(leftCutter)));  // Section 1 (Left)
        rightCutter.dispose();
        leftCutter.dispose();
      } else if (numberSections === 4) {
        const cutters = [
          { x: oversize / 2 + halfSep, z: oversize / 2 + halfSep },  // TR (0)
          { x: oversize / 2 + halfSep, z: -oversize / 2 - halfSep }, // BR (1)
          { x: -oversize / 2 - halfSep, z: -oversize / 2 - halfSep}, // BL (2)
          { x: -oversize / 2 - halfSep, z: oversize / 2 + halfSep }  // TL (3)
        ];
        cutters.forEach(pos => {
          const cutter = MeshBuilder.CreateBox('qc', { width: oversize, depth: oversize, height: thickness * 2 }, this.scene);
          cutter.position = new Vector3(pos.x, 0, pos.z);
          sectionCSGs.push(baseCSG.intersect(CSG.FromMesh(cutter)));
          cutter.dispose();
        });
      }

      // Step 3: Process each section - convert to mesh, filter slots, and cut.
      for (let i = 0; i < sectionCSGs.length; i++) {
        const sectionMesh = sectionCSGs[i].toMesh(`section_base_${i}`, null, this.scene);

        // Step 3a: Custom, correct slot filtering for diamond shape.
        const sectionSlots = slots ? slots.filter(slot => {
          const slotX = slot.x - (finishX / 2.0); // Center coordinates
          const slotZ = slot.z - (finishY / 2.0);
          
          if (numberSections === 4) {
            if (i === 0) return slotX >= 0 && slotZ >= 0; // TR
            if (i === 1) return slotX >= 0 && slotZ < 0;  // BR
            if (i === 2) return slotX < 0 && slotZ < 0;   // BL
            if (i === 3) return slotX < 0 && slotZ >= 0;  // TL
          } else if (numberSections === 2) {
            if (i === 0) return slotX >= 0; // Right
            if (i === 1) return slotX < 0;  // Left
          }
          return true; // n=1 gets all slots
        }) : [];
        
        // Step 3b: Cut slots.
        let finalMesh = sectionMesh;
        if (sectionSlots.length > 0) {
          finalMesh = this.cutSlots(sectionMesh, sectionSlots, config);
          if (sectionMesh !== finalMesh) {
            sectionMesh.dispose();
          }
        }

        // Step 3c: Finalize mesh properties.
        finalMesh.name = `section_${i}`;
        finalMesh.computeWorldMatrix(true);
        finalMesh.refreshBoundingInfo(true, true);
        finalMesh.isPickable = true;
        finalMesh.alwaysSelectAsActiveMesh = true;
        finalMeshes.push(finalMesh);
      }
      
      return finalMeshes;
    }
    
    // Calculate section dimensions based on shape
    const sectionDims = this.calculateSectionDimensions(config);
    const sectionMeshes: Mesh[] = [];
    
    for (let sectionIndex = 0; sectionIndex < sectionDims.length; sectionIndex++) {
      const dim = sectionDims[sectionIndex];
      
      // For circular n=2, n=3, n=4, use monolithic CSG approach (create full disc, then carve)
      if (config.shape === 'circular' && config.numberSections > 1) {
        
        // Step 1: Create FULL disc
        const fullDisc = MeshBuilder.CreateCylinder('baseDisc', {
          diameter: config.finishX,  // Full size, not section size
          height: config.thickness,
          tessellation: 128,
          cap: Mesh.CAP_ALL
        }, this.scene);
        fullDisc.bakeCurrentTransformIntoVertices();
        fullDisc.refreshBoundingInfo();
        
        // Step 2: Carve section shape using CSG
        const sectionData = this.cutToSectionShape(fullDisc, sectionIndex, config, sectionEdges);
        const sectionMesh = sectionData.mesh;
        
        // FIX: Pre-rotate bottom sections for n=3 BEFORE cutting slots
        if (config.numberSections === 3 && (sectionIndex === 1 || sectionIndex === 2)) {
          sectionMesh.rotation.z = Math.PI;
          sectionMesh.bakeCurrentTransformIntoVertices();
        }
        
        // Step 3: Filter slots for this section
        const sectionSlots = slots ? this.filterSlotsForSection(slots, sectionIndex, config) : [];
        
        // Step 4: Cut slots
        let finalMesh = sectionMesh;
        if (sectionSlots.length > 0) {
          finalMesh = this.cutSlots(sectionMesh, sectionSlots, config);
          sectionMesh.dispose();
        }
        
        finalMesh.name = `section_${sectionIndex}`;
        finalMesh.refreshBoundingInfo();
        finalMesh.isPickable = true;
        finalMesh.alwaysSelectAsActiveMesh = true;
        
        // CRITICAL: Force full bounding info recalculation after all transformations
        // This ensures click detection works across the entire mesh surface
        finalMesh.computeWorldMatrix(true);
        finalMesh.refreshBoundingInfo(true, true);
        
        sectionMeshes.push(finalMesh);
        continue;  // Skip the rest of the loop
      }
      
      // Original modular approach for rectangular
      // Create base mesh with actual section dimensions
      const baseMesh = this.createSectionBaseMesh(dim, config);
      
      // Position the section at its offset (centered at origin)
      baseMesh.position.x = dim.offsetX;
      baseMesh.position.z = dim.offsetY;
      
      // CRITICAL: Bake position into vertices before CSG operations
      // CSG.FromMesh() ignores .position property and only reads vertex data
      baseMesh.bakeCurrentTransformIntoVertices();
      
      // Filter slots for this section
      const sectionSlots = slots ? this.filterSlotsForSection(slots, sectionIndex, config) : [];
      
      // Cut slots if any exist
      let finalMesh = baseMesh;
      if (sectionSlots.length > 0) {
        finalMesh = this.cutSlots(baseMesh, sectionSlots, config);
        baseMesh.dispose();
      }
      
      finalMesh.name = `section_${sectionIndex}`;
      finalMesh.refreshBoundingInfo();
      finalMesh.isPickable = true;
      finalMesh.alwaysSelectAsActiveMesh = true;
      
      sectionMeshes.push(finalMesh);
    }
    
    return sectionMeshes;
  }
  
	private cutSlots(panelMesh: Mesh, slots: SlotData[], config: PanelConfig): Mesh {
    // If there are no slots, return the original panel mesh immediately.
    if (!slots || slots.length === 0) {
      return panelMesh;
    }

    const panelCSG = CSG.FromMesh(panelMesh);
    panelMesh.dispose(); // The original mesh is no longer needed.

    // 1. Create all cutter meshes first.
    const slotCutters = slots.map(slot => this.createSlotBox(slot, config));

    // 2. Union all cutters into a single CSG object.
    const allSlotsCSG = CSG.FromMesh(slotCutters[0]);
    for (let i = 1; i < slotCutters.length; i++) {
      const slotCSG = CSG.FromMesh(slotCutters[i]);
      allSlotsCSG.unionInPlace(slotCSG);
    }
    
    // 3. Perform a single, highly optimized subtraction.
    const resultCSG = panelCSG.subtract(allSlotsCSG);
    
    // 4. Clean up all the temporary cutter meshes.
    slotCutters.forEach(cutter => cutter.dispose());
    
    const result = resultCSG.toMesh(`${panelMesh.name}_withSlots`, null, this.scene);
    
    const mat = new StandardMaterial('finalPanelMat', this.scene);
    mat.diffuseColor = new Color3(0.9, 0.7, 0.5);
    mat.specularColor = new Color3(0.2, 0.2, 0.2);
    mat.backFaceCulling = false;
    result.material = mat;
    
    // Apply rotations to align with coordinate system expectations
    if (config.numberSections === 3) {
      // n=3 wedge cut needs Y rotation
      result.rotation.y = Math.PI;
      result.bakeCurrentTransformIntoVertices();
    } else {
      // n=1, n=2, n=4 need triple rotation for correct orientation
      result.rotation.y = Math.PI;  // 180° around Y (horizontal flip)
      result.bakeCurrentTransformIntoVertices();
    }
    
    return result;
  }
  
  private getFilletedPath(vertices: Vector3[], radius: number, segments: number): Vector3[] {
    const result: Vector3[] = [];
    const n = vertices.length;
    
    for (let i = 0; i < n; i++) {
      const prev = vertices[(i - 1 + n) % n];
      const curr = vertices[i];
      const next = vertices[(i + 1) % n];
      
      const toPrev = { x: prev.x - curr.x, z: prev.z - curr.z };
      const toNext = { x: next.x - curr.x, z: next.z - curr.z };
      
      const lenPrev = Math.sqrt(toPrev.x ** 2 + toPrev.z ** 2);
      const lenNext = Math.sqrt(toNext.x ** 2 + toNext.z ** 2);
      
      const dirPrev = { x: toPrev.x / lenPrev, z: toPrev.z / lenPrev };
      const dirNext = { x: toNext.x / lenNext, z: toNext.z / lenNext };
      
      const effectiveRadius = Math.min(radius, lenPrev * 0.4, lenNext * 0.4);
      
      const arcStart = {
        x: curr.x + dirPrev.x * effectiveRadius,
        z: curr.z + dirPrev.z * effectiveRadius
      };
      const arcEnd = {
        x: curr.x + dirNext.x * effectiveRadius,
        z: curr.z + dirNext.z * effectiveRadius
      };
      
      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const mt = 1 - t;
        result.push(new Vector3(
          mt * mt * arcStart.x + 2 * mt * t * curr.x + t * t * arcEnd.x,
          0,
          mt * mt * arcStart.z + 2 * mt * t * curr.z + t * t * arcEnd.z
        ));
      }
    }
    
    return result;
  }

	private createSlotBox(slot: SlotData, config: PanelConfig): Mesh {
		if (!slot.vertices || slot.vertices.length !== 4) {
      throw new Error(`Slot missing required vertices data`);
    }
    
    // Transform CNC coordinates to Babylon coordinates
    const CNC_CENTER_X = config.finishX / 2.0;
    const CNC_CENTER_Y = config.finishY / 2.0;
    
    let shapePoints = slot.vertices.map(v => new Vector3(
      v[0] - CNC_CENTER_X,
      0,
      v[1] - CNC_CENTER_Y
    ));
    
    // Enforce consistent winding (CCW) via signed area check
    let sum = 0;
    for (let i = 0; i < shapePoints.length; i++) {
      const cur = shapePoints[i];
      const next = shapePoints[(i + 1) % shapePoints.length];
      sum += (next.x - cur.x) * (next.z + cur.z);
    }
    if (sum > 0) {
      shapePoints.reverse();
    }
    
    // Apply fillets to corners
    const filletedPoints = this.getFilletedPath(shapePoints, FILLET_RADIUS, FILLET_SEGMENTS);
    
    // Extrude using Earcut triangulation (robust for N-gons)
    const extrudeHeight = config.thickness * 3;
    const slotMesh = MeshBuilder.ExtrudePolygon('slotCutter', {
      shape: filletedPoints,
      depth: extrudeHeight,
      sideOrientation: Mesh.DOUBLESIDE,
      bevel: true,
      bevelSize: 0.125,
      bevelSegments: 1
    }, this.scene);
    
    // Center vertically (ExtrudePolygon extrudes downward from y=0)
    slotMesh.position.y = extrudeHeight / 2;
    
    return slotMesh;
  }

  private filterSlotsForSection(slots: SlotData[], sectionIndex: number, config: PanelConfig): SlotData[] {
    if (config.numberSections === 1) {
      return slots;
    }
    
    const sectionDims = this.calculateSectionDimensions(config);
    const dim = sectionDims[sectionIndex];
    
    // Calculate CNC center point (backend uses this as origin)
    const cncCenterX = config.finishX / 2.0;
    const cncCenterY = config.finishY / 2.0;
    
    // Filter slots that fall within this section's bounds
    return slots.filter(slot => {
      // Convert from CNC coordinates to centered coordinates
      const slotX = slot.x - cncCenterX;
      const slotZ = slot.z - cncCenterY;
      
      // Check if slot center is within section bounds
      const minX = dim.offsetX - (dim.width / 2);
      const maxX = dim.offsetX + (dim.width / 2);
      const minZ = dim.offsetY - (dim.height / 2);
      const maxZ = dim.offsetY + (dim.height / 2);
      
      return slotX >= minX && slotX <= maxX && slotZ >= minZ && slotZ <= maxZ;
    });
  }
  
  private cutToSectionShape(
    baseMesh: Mesh,
    sectionIndex: number,
    config: PanelConfig,
    sectionEdges?: {
      section_index: number;
      edge1_start: number[];
      edge1_end: number[];
      edge2_start: number[];
      edge2_end: number[];
    }[]
  ): { mesh: Mesh; innerVertex: { x: number; z: number } } {
    const { numberSections, separation } = config;
    const outerRadius = Math.min(config.finishX, config.finishY) / 2;
    
    if (numberSections === 2) {
      const cutBox = MeshBuilder.CreateBox('cutter', {
        width: outerRadius * 2.5,
        height: config.thickness * 3,
        depth: outerRadius * 2.5
      }, this.scene);
      
      if (sectionIndex === 0) {
        cutBox.position.x = -(outerRadius * 1.25) + separation/2;
      } else {
        cutBox.position.x = (outerRadius * 1.25) - separation/2;
      }
      
      const baseCSG = CSG.FromMesh(baseMesh);
      const cutterCSG = CSG.FromMesh(cutBox);
      const resultCSG = baseCSG.subtract(cutterCSG);
      
      cutBox.dispose();
      baseMesh.dispose();
      
      const resultMesh = resultCSG.toMesh(`section_${sectionIndex}`, null, this.scene);
      resultMesh.refreshBoundingInfo();
      
      return { mesh: resultMesh, innerVertex: { x: 0, z: 0 } };
    }
    
    if (numberSections === 3) {
      const sectionEdgeData = sectionEdges?.find((e) => e.section_index === sectionIndex);
      if (!sectionEdgeData) {
        console.error(`[POC] No edge data found for section ${sectionIndex}`);
        return { mesh: baseMesh, innerVertex: { x: 0, z: 0 } };
      }
      
      const CNC_CENTER = outerRadius;
      const innerVertex = {
        x: sectionEdgeData.edge1_start[0] - CNC_CENTER,
        z: sectionEdgeData.edge1_start[1] - CNC_CENTER
      };
      
      const centerlines = [90, 330, 210];
      const centerline = centerlines[sectionIndex] * Math.PI / 180;
      
      const cutterWidth = outerRadius * 4;
      const cutterDepth = outerRadius * 2;
      const cutterHeight = config.thickness * 3;
      
      const edgeOffset = 60 * Math.PI / 180;
      const angle1_rot = (centerline - edgeOffset) - (90 * Math.PI / 180);
      
      const pivotNode1 = new TransformNode(`cutterPivot1_s${sectionIndex}`, this.scene);
      pivotNode1.position = new Vector3(innerVertex.x, 0, innerVertex.z);
      
      const cutter1 = MeshBuilder.CreateBox(`edge1_cutter_s${sectionIndex}`, {
        width: cutterWidth,
        height: cutterHeight,
        depth: cutterDepth
      }, this.scene);
      
      cutter1.position.x = -cutterWidth / 2;
      cutter1.parent = pivotNode1;
      pivotNode1.rotation.y = angle1_rot;
      
      cutter1.computeWorldMatrix(true);
      cutter1.bakeCurrentTransformIntoVertices();
      cutter1.parent = null;
      pivotNode1.dispose();
      
      const angle2_rot = (centerline + edgeOffset) - (90 * Math.PI / 180);
      
      const pivotNode2 = new TransformNode(`cutterPivot2_s${sectionIndex}`, this.scene);
      pivotNode2.position = new Vector3(innerVertex.x, 0, innerVertex.z);
      
      const cutter2 = MeshBuilder.CreateBox(`edge2_cutter_s${sectionIndex}`, {
        width: cutterWidth,
        height: cutterHeight,
        depth: cutterDepth
      }, this.scene);
      
      cutter2.position.x = cutterWidth / 2;
      cutter2.parent = pivotNode2;
      pivotNode2.rotation.y = angle2_rot;
      
      cutter2.computeWorldMatrix(true);
      cutter2.bakeCurrentTransformIntoVertices();
      cutter2.parent = null;
      pivotNode2.dispose();
      
      const baseCSG = CSG.FromMesh(baseMesh);
      const cutter1CSG = CSG.FromMesh(cutter1);
      const cutter2CSG = CSG.FromMesh(cutter2);
      const resultCSG = baseCSG.subtract(cutter1CSG).subtract(cutter2CSG);
      
      cutter1.dispose();
      cutter2.dispose();
      baseMesh.dispose();
      
      const resultMesh = resultCSG.toMesh(`section_${sectionIndex}`, null, this.scene);
      resultMesh.refreshBoundingInfo();
      
      return { mesh: resultMesh, innerVertex };
    }
    
    if (numberSections === 4) {
      const cutBox1 = MeshBuilder.CreateBox('cutter1', {
        width: outerRadius * 2.5,
        height: config.thickness * 3,
        depth: outerRadius * 2.5
      }, this.scene);
      
      const cutBox2 = MeshBuilder.CreateBox('cutter2', {
        width: outerRadius * 2.5,
        height: config.thickness * 3,
        depth: outerRadius * 2.5
      }, this.scene);
      
      if (sectionIndex === 0) {
        cutBox1.position.x = -(outerRadius * 1.25) + separation/2;
        cutBox2.position.z = -(outerRadius * 1.25) + separation/2;
      } else if (sectionIndex === 1) {
        cutBox1.position.x = -(outerRadius * 1.25) + separation/2;
        cutBox2.position.z = (outerRadius * 1.25) - separation/2;
      } else if (sectionIndex === 2) {
        cutBox1.position.x = (outerRadius * 1.25) - separation/2;
        cutBox2.position.z = (outerRadius * 1.25) - separation/2;
      } else {
        cutBox1.position.x = (outerRadius * 1.25) - separation/2;
        cutBox2.position.z = -(outerRadius * 1.25) + separation/2;
      }
      
      const baseCSG = CSG.FromMesh(baseMesh);
      const cutter1CSG = CSG.FromMesh(cutBox1);
      const cutter2CSG = CSG.FromMesh(cutBox2);
      
      let resultCSG = baseCSG.subtract(cutter1CSG);
      resultCSG = resultCSG.subtract(cutter2CSG);
      
      cutBox1.dispose();
      cutBox2.dispose();
      baseMesh.dispose();
      
      const resultMesh = resultCSG.toMesh(`section_${sectionIndex}`, null, this.scene);
      resultMesh.refreshBoundingInfo();
      
      return { mesh: resultMesh, innerVertex: { x: 0, z: 0 } };
    }
    
    return { mesh: baseMesh, innerVertex: { x: 0, z: 0 } };
  }
  
  validateMesh(mesh: Mesh): boolean {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    
    if (!positions || !indices) {
      return false;
    }
    
    let degenerateCount = 0;
    const threshold = 0.00001;
    
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i] * 3;
      const i1 = indices[i + 1] * 3;
      const i2 = indices[i + 2] * 3;
      
      const v0 = new Vector3(positions[i0], positions[i0 + 1], positions[i0 + 2]);
      const v1 = new Vector3(positions[i1], positions[i1 + 1], positions[i1 + 2]);
      const v2 = new Vector3(positions[i2], positions[i2 + 1], positions[i2 + 2]);
      
      const area = Vector3.Cross(v1.subtract(v0), v2.subtract(v0)).length() / 2;
      
      if (area < threshold) {
        degenerateCount++;
      }
    }
    return degenerateCount === 0;
  }

  /**
   * Generate backing mesh based on panel shape
   */
  generateBackingMesh(
    shape: string,
    width: number,
    height: number,
    thickness: number,
    positionY: number
  ): Mesh {
    let backingMesh: Mesh;

    if (shape === 'circular') {
      backingMesh = MeshBuilder.CreateCylinder('backing', {
        diameter: width,
        height: thickness,
        tessellation: 128
      }, this.scene);
    } else if (shape === 'rectangular') {
      backingMesh = MeshBuilder.CreateBox('backing', {
        width: width,
        height: thickness,
        depth: height
      }, this.scene);
    } else if (shape === 'diamond') {
      backingMesh = MeshBuilder.CreateCylinder('backing', {
        diameter: 1,
        height: thickness,
        tessellation: 4
      }, this.scene);
      backingMesh.scaling = new Vector3(width, 1, height);
      backingMesh.bakeCurrentTransformIntoVertices();
    } else {
      throw new Error(`Unsupported backing shape: ${shape}`);
    }

    backingMesh.position.y = positionY;
    return backingMesh;
  }
}