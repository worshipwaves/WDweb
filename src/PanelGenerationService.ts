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
    console.log('[POC] createPanelsWithCSG - n=' + config.numberSections);
    
    if (this.debugMode) {
      const debugCutters = this.scene.meshes.filter(m => m.name.startsWith('debugSlotCutter_'));
      console.log(`[DEBUG] Disposing ${debugCutters.length} old debug cutters`);
      debugCutters.forEach(m => m.dispose());
    }
    
    // For n=1, use old approach
    if (config.numberSections === 1) {
      console.log('[POC] Using legacy single-mesh approach for n=1');
      const baseShape = config.shape === 'rectangular' 
        ? this.createFlatBox(config)
        : this.createFlatDisc(config);
      
      if (slots && slots.length > 0) {
        const finalPanel = this.cutSlots(baseShape, slots, config);
        return [finalPanel];
      }
      return [baseShape];
    }
    
    console.log('[POC] Creating separate meshes for each section');
    const sectionMeshes: Mesh[] = [];
    const sectionsToCreate = config.numberSections;
    
    for (let sectionIndex = 0; sectionIndex < sectionsToCreate; sectionIndex++) {
      console.log(`[POC] === Section ${sectionIndex} ===`);
      
      // Step 1: Create a full base shape for this section
      const baseShape = config.shape === 'rectangular' 
        ? this.createFlatBox(config)
        : this.createFlatDisc(config);
      console.log(`[POC] Created base ${config.shape === 'rectangular' ? 'box' : 'disc'}`);
      
      if (config.numberSections === 3) {
        // NEW APPROACH: Wedge first, rotate, THEN cut slots
        console.log(`[POC] Carving section ${sectionIndex} wedge from clean disc (no slots yet)`);
        const sectionData = this.cutToSectionShape(baseShape, sectionIndex, config, sectionEdges);
        const sectionMesh = sectionData.mesh;
        
        // Rotate the wedge to correct orientation BEFORE cutting slots
        sectionMesh.rotation.y = Math.PI;
        sectionMesh.rotation.z = Math.PI;
        sectionMesh.bakeCurrentTransformIntoVertices();
        sectionMesh.refreshBoundingInfo();
        sectionMesh.freezeWorldMatrix();
        sectionMesh.isPickable = true;
        sectionMesh.alwaysSelectAsActiveMesh = true;
        
        // Sequential distribution: divide 48 slots evenly
        let sectionSlots: SlotData[] = [];
        if (slots && slots.length > 0) {
          const slotsPerSection = Math.floor(slots.length / config.numberSections);
          const startIdx = sectionIndex * slotsPerSection;
          const rawSlots = slots.slice(startIdx, startIdx + slotsPerSection);
          
          // Transform slot coordinates AND vertices to match Y+Z rotation
          const CNC_CENTER = config.outerRadius;
          sectionSlots = rawSlots.map(slot => ({
            ...slot,
            vertices: slot.vertices ? slot.vertices.map(v => [
              (2 * CNC_CENTER) - v[0],  // Mirror X around center
              (2 * CNC_CENTER) - v[1]   // Mirror Y around center
            ]) : undefined
          }));
        }
        console.log(`[POC] Cutting ${sectionSlots.length} vertex-transformed slots into rotated section ${sectionIndex}`);
        
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
        
      } else {
        // EXISTING APPROACH FOR N=2 and N=4: Wedge first, then filtered slots
        console.log(`[POC] Using wedge-first approach for n=${config.numberSections}`);
        const sectionData = this.cutToSectionShape(baseShape, sectionIndex, config, sectionEdges);
        const sectionMesh = sectionData.mesh;
        
        // Filter slots for this specific section
        const sectionSlots = slots ? this.filterSlotsForSection(slots, sectionIndex, config) : [];
        console.log(`[POC] Section ${sectionIndex} has ${sectionSlots.length} filtered slots`);
        
        let finalMesh = sectionMesh;
        if (sectionSlots.length > 0) {
          finalMesh = this.cutSlots(sectionMesh, sectionSlots, config);
          sectionMesh.dispose();
        }
        
        finalMesh.name = `section_${sectionIndex}`;
        finalMesh.isPickable = true;
        console.log(`[POC] Section ${sectionIndex} mesh created: ${finalMesh.name}`);
        
        sectionMeshes.push(finalMesh);
      }
    }
    
    console.log(`[POC] Returning ${sectionMeshes.length} section meshes`);
    return sectionMeshes;
  }
	
  private createFlatDisc(config: PanelConfig): Mesh {
    const { outerRadius, thickness } = config;
    
    const cylinder = MeshBuilder.CreateCylinder('baseDisc', {
      diameter: outerRadius * 2,
      height: thickness,
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
	
  private createFlatBox(config: PanelConfig): Mesh {
    const { outerRadius, thickness } = config;
    
    const box = MeshBuilder.CreateBox('baseBox', {
      width: outerRadius * 2,
      depth: outerRadius * 2,
      height: thickness
    }, this.scene);
    
    box.rotation.y = Math.PI / 2;
    box.bakeCurrentTransformIntoVertices();
    box.refreshBoundingInfo();
    
    const mat = new StandardMaterial('boxMat', this.scene);
    mat.diffuseColor = new Color3(0.8, 0.8, 0.8);
    mat.backFaceCulling = false;
    box.material = mat;
    
    return box;
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
    
    // Only rotate for n=1, n=2, n=4 (n=3 rotates after wedge cut)
    if (config.numberSections !== 3) {
      result.rotation.y = Math.PI;
      result.bakeCurrentTransformIntoVertices();
    }
    
    return result;
  }
  
  private createSlotBox(slot: SlotData, config: PanelConfig): Mesh {
    if (!slot.vertices || slot.vertices.length !== 4) {
      throw new Error(`Slot missing required vertices data`);
    }
    
    // Transform CNC coordinates to Babylon coordinates
    const CNC_CENTER = config.outerRadius;
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
    const { numberSections, separation, outerRadius } = config;
    
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
      const sectionEdgeData = sectionEdges?.find((e: { section_index: number; edge1_start: number[] }) => e.section_index === sectionIndex);
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

  private filterSlotsForSection(allSlots: SlotData[], sectionIndex: number, config: PanelConfig): SlotData[] {
    const { numberSections, outerRadius } = config;
    
    if (numberSections === 1) {
      return allSlots;
    }
    
    if (numberSections === 2) {
      const CNC_CENTER = outerRadius;
      
      const filtered = allSlots.filter(slot => {
        const babylonX = slot.x - CNC_CENTER;
        if (sectionIndex === 0) {
          return babylonX > 0;
        } else {
          return babylonX < 0;
        }
      });
      
      return filtered;
    }
    
    if (numberSections === 4) {
      const CNC_CENTER = outerRadius;
      
      return allSlots.filter(slot => {
        const babylonX = slot.x - CNC_CENTER;
        const babylonZ = slot.z - CNC_CENTER;
        
        if (sectionIndex === 0) {
          return babylonX > 0 && babylonZ > 0;
        } else if (sectionIndex === 1) {
          return babylonX > 0 && babylonZ < 0;
        } else if (sectionIndex === 2) {
          return babylonX < 0 && babylonZ < 0;
        } else {
          return babylonX < 0 && babylonZ > 0;
        }
      });
    }
    
    return allSlots;
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