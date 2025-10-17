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

interface PanelConfig {
  outerRadius: number;
  thickness: number;
  separation: number;
  numberSections: number;
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
      // 2×2 grid with gaps
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
    
    throw new Error(`Unsupported number of sections for rectangular: ${numberSections}`);
  }
  
  private createSectionBaseMesh(dim: SectionDimensions, config: PanelConfig): Mesh {
    if (config.shape === 'circular') {
      const cylinder = MeshBuilder.CreateCylinder('baseDisc', {
        diameter: dim.width,
        height: config.thickness,
        tessellation: 64,
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
      const box = MeshBuilder.CreateBox('baseBox', {
        width: dim.width,
        depth: dim.height,
        height: config.thickness
      }, this.scene);
      
      box.bakeCurrentTransformIntoVertices();
      box.refreshBoundingInfo();
      
      const mat = new StandardMaterial('boxMat', this.scene);
      mat.diffuseColor = new Color3(0.8, 0.8, 0.8);
      mat.backFaceCulling = false;
      box.material = mat;
      
      return box;
    }
    
    throw new Error(`Unsupported shape: ${config.shape}`);
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
    console.log(`[POC] createPanelsWithCSG - shape=${config.shape}, n=${config.numberSections}`);
    
    // Calculate section dimensions based on shape
    const sectionDims = this.calculateSectionDimensions(config);
    const sectionMeshes: Mesh[] = [];
    
    for (let sectionIndex = 0; sectionIndex < sectionDims.length; sectionIndex++) {
      console.log(`[POC] === Section ${sectionIndex} ===`);
      const dim = sectionDims[sectionIndex];
      
      // For circular n=2, n=3, n=4, use monolithic CSG approach (create full disc, then carve)
      if (config.shape === 'circular' && config.numberSections > 1) {
        console.log(`[POC] Using monolithic CSG approach for circular n=${config.numberSections}, section ${sectionIndex}`);
        
        // Step 1: Create FULL disc
        const fullDisc = MeshBuilder.CreateCylinder('baseDisc', {
          diameter: config.finishX,  // Full size, not section size
          height: config.thickness,
          tessellation: 64,
          cap: Mesh.CAP_ALL
        }, this.scene);
        fullDisc.bakeCurrentTransformIntoVertices();
        fullDisc.refreshBoundingInfo();
        
        // Step 2: Carve section shape using CSG
        const sectionData = this.cutToSectionShape(fullDisc, sectionIndex, config, sectionEdges);
        const sectionMesh = sectionData.mesh;
        
        // Step 3: Filter slots for this section
        const sectionSlots = slots ? this.filterSlotsForSection(slots, sectionIndex, config) : [];
        console.log(`[POC] Section ${sectionIndex} has ${sectionSlots.length} slots`);
        
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
        
        console.log(`[POC] Section ${sectionIndex} mesh created: ${finalMesh.name}`);
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
      console.log(`[POC] Section ${sectionIndex} has ${sectionSlots.length} slots`);
      
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
      
      console.log(`[POC] Section ${sectionIndex} mesh created: ${finalMesh.name}`);
      sectionMeshes.push(finalMesh);
    }
    
    console.log(`[POC] Returning ${sectionMeshes.length} section meshes`);
    return sectionMeshes;
  }
  
  private cutSlots(panelMesh: Mesh, slots: SlotData[], config: PanelConfig): Mesh { 
    console.log(`[POC] Starting CSG slot cutting: ${slots.length} slots`);
    let resultCSG = CSG.FromMesh(panelMesh);
    let successfulCuts = 0;
    let failedCuts = 0;
    
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const slotBox = this.createSlotBox(slot, config);
      
      try {
        const slotCSG = CSG.FromMesh(slotBox);
        resultCSG = resultCSG.subtract(slotCSG);
        successfulCuts++;
      } catch (error) {
        console.error(`[CSG] Failed at slot ${i}:`, error);
        failedCuts++;
      }
      
      if (this.debugMode) {
        const debugMat = new StandardMaterial(`debugSlot${i}`, this.scene);
        debugMat.diffuseColor = new Color3(1, 0, 0);
        debugMat.alpha = 0.3;
        slotBox.material = debugMat;
        slotBox.name = `debugSlotCutter_${i}`;
      } else {
        slotBox.dispose();
      }
    }
    
    console.log(`[POC] CSG complete: ${successfulCuts} successful, ${failedCuts} failed cuts`);
    
    panelMesh.dispose();
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
  
  private createSlotBox(slot: SlotData, config: PanelConfig): Mesh {
    if (!slot.vertices || slot.vertices.length !== 4) {
      throw new Error(`Slot missing required vertices data`);
    }
    
    // Transform CNC coordinates to Babylon coordinates
    const CNC_CENTER = config.shape === 'circular'
      ? Math.min(config.finishX, config.finishY) / 2
      : Math.max(config.finishX, config.finishY) / 2;
    const vertices2D = slot.vertices.map(v => [
      v[0] - CNC_CENTER,  // CNC X → Babylon X
      v[1] - CNC_CENTER   // CNC Y → Babylon Z
    ]);
    
    const positions: number[] = [];
    const extrudeHeight = config.thickness * 3;
    
    // Bottom face
    for (const v of vertices2D) {
      positions.push(v[0], -extrudeHeight, v[1]);
    }
    
    // Top face
    for (const v of vertices2D) {
      positions.push(v[0], extrudeHeight, v[1]);
    }
    
    const indices: number[] = [
      0, 2, 1, 0, 3, 2,  // Bottom
      4, 5, 6, 4, 6, 7,  // Top
      0, 1, 5, 0, 5, 4,  // Sides
      1, 2, 6, 1, 6, 5,
      2, 3, 7, 2, 7, 6,
      3, 0, 4, 3, 4, 7
    ];
    
    const customMesh = new Mesh('slotWedge', this.scene);
    const vertexData = new VertexData();
    
    vertexData.positions = positions;
    vertexData.indices = indices;
    
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    vertexData.normals = normals;
    
    vertexData.applyToMesh(customMesh);
    
    return customMesh;
  }

  private filterSlotsForSection(slots: SlotData[], sectionIndex: number, config: PanelConfig): SlotData[] {
    if (config.numberSections === 1) {
      return slots;
    }
    
    const sectionDims = this.calculateSectionDimensions(config);
    const dim = sectionDims[sectionIndex];
    
    // Calculate CNC center point (backend uses this as origin)
    const cncCenter = config.shape === 'circular' 
      ? Math.min(config.finishX, config.finishY) / 2
      : Math.max(config.finishX, config.finishY) / 2;
    
    // Filter slots that fall within this section's bounds
    return slots.filter(slot => {
      // Convert from CNC coordinates to centered coordinates
      const slotX = slot.x - cncCenter;
      const slotZ = slot.z - cncCenter;
      
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
    
    console.log(`[POC] cutToSectionShape: section ${sectionIndex} of ${numberSections}`);
    
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
}