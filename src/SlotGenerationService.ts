import {

    Vector3, 
    Mesh, 
    MeshBuilder, 
    Scene
} from '@babylonjs/core';
import earcut from 'earcut';

// Type definitions for the composition state
interface FrameDesignDTO {
    finish_x: number;
    finish_y: number;
    number_sections: number;
    separation: number;
}

interface PatternSettingsDTO {
    number_slots: number;
    slot_style: string;
    bit_diameter: number;
    spacer: number;
    x_offset: number;
    y_offset: number;
    scale_center_point: number;
    amplitude_exponent: number;
    orientation: string;
    grain_angle: number;
}

interface VisualCorrectionDTO {
    apply_correction?: boolean;
    correction_scale?: number;
    correction_mode?: string;
}

export interface CompositionStateDTO {
    frame_design: FrameDesignDTO;
    pattern_settings: PatternSettingsDTO;
    processed_amplitudes: number[];
    visual_correction?: VisualCorrectionDTO;
}

interface GeoParams {
    sectionLocalCenters: Vector3[];
    referenceAngles: number[];
    slotAngleDeg: number;
    centerPointLocal: number;
    bitDiameter: number;
    numberSections: number;
    grainAngle: number;
    circumRadius: number;
    minRadiusFromVCalc: number;
    maxRadiusLocal: number;
    finishX: number;
    finishY: number;
}

export class SlotGenerationService {
    private scene: Scene;
    
    constructor(scene: Scene) {
        this.scene = scene;
    }
    
    public createMergedCutterMesh(state: CompositionStateDTO): Mesh | null {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        (window as any).earcut = earcut;	
				
        // Runtime check for DTO shape
        if (!state || !state.frame_design || !state.pattern_settings || !state.processed_amplitudes) {
            throw new Error("Invalid CompositionStateDTO: Missing required fields.");
        }

        const { number_slots, slot_style } = state.pattern_settings;
        const { processed_amplitudes: amplitudes } = state;
        
        if (amplitudes.length !== number_slots) {
            throw new Error(`Expected ${number_slots} amplitudes, got ${amplitudes.length}`);
        }
        
        const geoParams = this.buildGeoParams(state);
        
        if (slot_style === 'radial') {
            return this.generateMergedRadialCutter(state, geoParams, amplitudes);
        } else {
            throw new Error(`Slot style '${slot_style}' not yet implemented`);
        }
    }

    public getSlotCoordinates(state: CompositionStateDTO): number[][][] {
        // Runtime check for DTO shape
        if (!state || !state.frame_design || !state.pattern_settings || !state.processed_amplitudes) {
            throw new Error("Invalid CompositionStateDTO: Missing required fields.");
        }

        const { number_slots, slot_style } = state.pattern_settings;
        const { number_sections } = state.frame_design;
        const { processed_amplitudes: amplitudes } = state;

        if (amplitudes.length !== number_slots) {
            throw new Error(`Expected ${number_slots} amplitudes, got ${amplitudes.length}`);
        }

        if (slot_style !== 'radial') {
            throw new Error(`Coordinate generation for '${slot_style}' is not implemented.`);
        }
        
        const geoParams = this.buildGeoParams(state);
        const slotsPerSection = Math.floor(number_slots / number_sections);
        
        let visualAdjustment = 0.0;
        if (state.visual_correction?.apply_correction) {
            visualAdjustment = this.calculateVisualAdjustment(state);
        }

        const allCoords: number[][][] = [];

        for (let slotIndex = 0; slotIndex < number_slots; slotIndex++) {
            const sectionId = Math.floor(slotIndex / slotsPerSection);
            const localSlotIndex = slotIndex % slotsPerSection;
            
            const amplitude = amplitudes[slotIndex];
            const scaledAmplitude = amplitude * state.pattern_settings.amplitude_exponent;
            const inwardExtent = scaledAmplitude / 2.0;
            const outwardExtent = scaledAmplitude / 2.0;
            const correctionMode = (state.visual_correction?.correction_mode || "nudge_adj").toLowerCase().replace(/ |_/g, "_").replace("_adj", "_adj");
            
            const slotVectorCoords = this.calculateRadialSlotCoords(
                localSlotIndex, geoParams, sectionId, 0.0, correctionMode,
                visualAdjustment, inwardExtent, outwardExtent
            );

            const slotXYCoords = slotVectorCoords.map(v => [v.x, v.y]);
            allCoords.push(slotXYCoords);
        }

        return allCoords;
    }
    
    private buildGeoParams(state: CompositionStateDTO): GeoParams {
        const r = state.frame_design.finish_y / 2.0;
        const h = state.frame_design.finish_x / 2.0;
        const k = state.frame_design.finish_y / 2.0;
        
        const { number_sections, separation } = state.frame_design;
        const xOffset = state.pattern_settings.x_offset;  // Critical for multi-section positioning
        const yOffset = state.pattern_settings.y_offset;  // Outer boundary constraint
        
        let sectionLocalCenters: Vector3[];
        
        // Keep sections in CAD coordinate space (matching Python backend)
        if (number_sections === 1) {
            sectionLocalCenters = [new Vector3(h, k, 0)];
        } else if (number_sections === 2) {
            sectionLocalCenters = [
                new Vector3(h - separation / 2.0 - xOffset, k, 0),
                new Vector3(h + separation / 2.0 + xOffset, k, 0),
            ];
        } else if (number_sections === 3) {
            const effectiveSideLen = separation + (2 * xOffset);
            const radius = effectiveSideLen / Math.sqrt(3);
            sectionLocalCenters = [
                new Vector3(h + radius * Math.cos(Math.PI / 2), k + radius * Math.sin(Math.PI / 2), 0),
                new Vector3(h + radius * Math.cos(7 * Math.PI / 6), k + radius * Math.sin(7 * Math.PI / 6), 0),
                new Vector3(h + radius * Math.cos(11 * Math.PI / 6), k + radius * Math.sin(11 * Math.PI / 6), 0),
            ];
        } else if (number_sections === 4) {
            const effectiveSideLen = separation + (2 * xOffset);
            const halfDiag = effectiveSideLen / Math.sqrt(2);
            const halfSep = halfDiag / Math.sqrt(2);
            sectionLocalCenters = [
                new Vector3(h - halfSep, k - halfSep, 0),
                new Vector3(h + halfSep, k - halfSep, 0),
                new Vector3(h + halfSep, k + halfSep, 0),
                new Vector3(h - halfSep, k + halfSep, 0),
            ];
        } else {
            sectionLocalCenters = [new Vector3(h, k, 0)];
        }
        
        const { number_slots } = state.pattern_settings;
        if (number_sections <= 0) throw new Error(`Invalid number of sections: ${number_sections}`);
        
        const slotsPerSection = Math.floor(number_slots / number_sections);
        if (slotsPerSection < 1) {
            throw new Error(`Computed slotsPerSection is less than 1. Check numberSlots (${number_slots}) and numberSections (${number_sections}).`);
        }

				const anglePerSlot = 360.0 / slotsPerSection;

        const orientation = (state.pattern_settings.orientation || "").toLowerCase();
        const baseAngleDeg = (orientation === "vertical" || orientation === "auto") ? 90.0 : 0.0;

        const referenceAngles: number[] = Array.from({ length: slotsPerSection }, (_, i) => baseAngleDeg + i * anglePerSlot);

        const anglePerSlotRad = anglePerSlot * (Math.PI / 180.0);
        
        // For radial slots on circular panels, position near the panel edge
        const panelRadius = r;  // r is already finishY/2
        const edgeInset = state.pattern_settings.x_offset;  // How far from edge
        const minRadiusForBit = (state.pattern_settings.bit_diameter + state.pattern_settings.spacer) / anglePerSlotRad;
        // Slots should be positioned near panel edge, not at yOffset
        const effectiveCircumRadius = Math.max(panelRadius - edgeInset, minRadiusForBit);
        
        const spacerAngle = state.pattern_settings.spacer * (360.0 / (2.0 * Math.PI * effectiveCircumRadius));
        const slotAngleDeg = anglePerSlot - spacerAngle;
        
        // Calculate max_radius_local_from_LC (matching Python geometry_calculator.py)
        let maxRadiusLocal = r - yOffset; // R_global_y_offset_arc
        
        // For multi-section designs, account for local center offset
        if (number_sections > 1 && sectionLocalCenters.length > 0) {
            const [lcX, lcY] = [sectionLocalCenters[0].x, sectionLocalCenters[0].y];
            let localRadius: number;
            
            if (number_sections === 2) {
                // Bifurcation at 0° (pointing right)
                localRadius = r - Math.abs(lcX - h);
            } else if (number_sections === 3) {
                // Bifurcation at 90° (pointing up)
                localRadius = r - Math.abs(lcY - k);
            } else if (number_sections === 4) {
                // Bifurcation at 45° (diagonal)
                const distToGC = Math.sqrt((lcX - h) ** 2 + (lcY - k) ** 2);
                localRadius = r - distToGC;
            } else {
                localRadius = r;
            }
            
            maxRadiusLocal = localRadius - yOffset;
        }
        
        // Ensure minimum
        const trueMinRadius = state.pattern_settings.bit_diameter + state.pattern_settings.spacer;
        if (maxRadiusLocal <= trueMinRadius) {
            maxRadiusLocal = trueMinRadius + state.pattern_settings.bit_diameter;
        }
        
        return {
            sectionLocalCenters, referenceAngles, slotAngleDeg,
            centerPointLocal: state.pattern_settings.scale_center_point,
            bitDiameter: state.pattern_settings.bit_diameter, numberSections: number_sections,
            grainAngle: state.pattern_settings.grain_angle,
            circumRadius: effectiveCircumRadius,
            minRadiusFromVCalc: state.pattern_settings.bit_diameter,
            maxRadiusLocal: maxRadiusLocal,  // Now properly calculated with y_offset
            finishX: state.frame_design.finish_x,
            finishY: state.frame_design.finish_y,
        };
    }
    
    private generateMergedRadialCutter(state: CompositionStateDTO, geoParams: GeoParams, amplitudes: number[]): Mesh | null {
        const { number_slots } = state.pattern_settings;
        const { number_sections } = state.frame_design;
        const slotsPerSection = Math.floor(number_slots / number_sections);
        
        let visualAdjustment = 0.0;
        if (state.visual_correction?.apply_correction) {
            visualAdjustment = this.calculateVisualAdjustment(state);
        }
        
        const individualCutters: Mesh[] = [];
        
        for (let slotIndex = 0; slotIndex < number_slots; slotIndex++) {
            const sectionId = Math.floor(slotIndex / slotsPerSection);
            const localSlotIndex = slotIndex % slotsPerSection;
            
            const amplitude = amplitudes[slotIndex];
            const scaledAmplitude = amplitude * state.pattern_settings.amplitude_exponent;
            const inwardExtent = scaledAmplitude / 2.0;
            const outwardExtent = scaledAmplitude / 2.0;
            const correctionMode = (state.visual_correction?.correction_mode || "nudge_adj").toLowerCase().replace(/ |_/g, "_").replace("_adj", "_adj");
            
            const slotCoords = this.calculateRadialSlotCoords(
                localSlotIndex, geoParams, sectionId, 0.0, correctionMode,
                visualAdjustment, inwardExtent, outwardExtent
            );
            
            if (slotCoords.length > 0) {
                const cutterMesh = this.createCutterMeshFromCoords(slotCoords, slotIndex, state);
                if (cutterMesh) {
                    individualCutters.push(cutterMesh);
                }
            }
        }
        
        if (individualCutters.length === 0) return null;
        
        const mergedCutter = Mesh.MergeMeshes(individualCutters, true, true, undefined, false, true);
        if (mergedCutter) {
            individualCutters.forEach(mesh => mesh.dispose());
            mergedCutter.name = 'masterCutter';
        }
        
        return mergedCutter;
    }
    
    private calculateVisualAdjustment(state: CompositionStateDTO): number {
        if (state.frame_design.number_sections <= 1) return 0.0;
        
        const r = state.frame_design.finish_y / 2.0;
        const separation = state.frame_design.separation;
        let visualAdj = 0.0;

        if (state.frame_design.number_sections === 2) {
            const dx = separation / 2.0;
            visualAdj = (Math.abs(dx) >= r) ? r : r - Math.sqrt(r * r - dx * dx);
        }
        
        return visualAdj * (state.visual_correction?.correction_scale || 1.0);
    }
    
    private calculateRadialSlotCoords(
        slotIndex: number, geoParams: GeoParams, sectionId: number, nudgeDistance: number,
        correctionMode: string, visualAdjustment: number, inwardExtent: number, outwardExtent: number
    ): Vector3[] {
        // Section centers are already origin-centered after buildGeoParams fix
        const { x: lcX, y: lcY } = geoParams.sectionLocalCenters[sectionId];
        const unitCenterlineDeg = geoParams.referenceAngles[slotIndex];
        
        let sectionRotationOffset = 0.0;
        if (geoParams.numberSections === 2) {
            if (sectionId === 1) sectionRotationOffset = 180.0;
        } else if (geoParams.numberSections === 3) {
            const baseN3Offset = geoParams.grainAngle - 90.0;
            const n3SectionRotations = [60.0, 300.0, 180.0];
            sectionRotationOffset = n3SectionRotations[sectionId] + baseN3Offset;
        } else if (geoParams.numberSections === 4) {
            const sectionRotationsN4 = [0.0, 270.0, 180.0, 90.0];
            sectionRotationOffset = sectionRotationsN4[sectionId];
        }
        
        let slotFanCenterlineDeg = (unitCenterlineDeg + sectionRotationOffset) % 360;
        if (slotFanCenterlineDeg < 0) slotFanCenterlineDeg += 360;
        
        const slotFanCenterlineRad = slotFanCenterlineDeg * Math.PI / 180;
        
        let currentSlotCenterPointFromV = geoParams.centerPointLocal;
        let adjustedNudgeDistance = nudgeDistance;
        if (correctionMode === "center_adj") currentSlotCenterPointFromV += visualAdjustment;
        else if (correctionMode === "nudge_adj") adjustedNudgeDistance += visualAdjustment;
        
        const adjustedOffset = geoParams.circumRadius + adjustedNudgeDistance;
        const vX = lcX + adjustedOffset * Math.cos(slotFanCenterlineRad);
        const vY = lcY + adjustedOffset * Math.sin(slotFanCenterlineRad);
        
        const maxRadialDistFromVAllowed = geoParams.maxRadiusLocal - geoParams.circumRadius;
        
        const refLen1FromV = Math.max(currentSlotCenterPointFromV - inwardExtent, geoParams.minRadiusFromVCalc);
        let refLen2FromV = Math.min(currentSlotCenterPointFromV + outwardExtent, maxRadialDistFromVAllowed);
        
        if (refLen2FromV < refLen1FromV + 1e-6) refLen2FromV = refLen1FromV + 1e-6;
        
        const halfSlotAngleRad = (geoParams.slotAngleDeg / 2.0) * Math.PI / 180;
        const cosHalfAngle = Math.cos(halfSlotAngleRad);
        if (cosHalfAngle <= 1e-9) return [];
        
        const lenToSide1 = refLen1FromV / cosHalfAngle;
        const lenToSide2 = refLen2FromV / cosHalfAngle;
        
        const angleVSide1 = slotFanCenterlineRad - halfSlotAngleRad;
        const angleVSide2 = slotFanCenterlineRad + halfSlotAngleRad;
        
        // Calculate slot corners in CAD space
        const p1 = new Vector3(vX + lenToSide1 * Math.cos(angleVSide1), vY + lenToSide1 * Math.sin(angleVSide1), 0);
        const p2 = new Vector3(vX + lenToSide2 * Math.cos(angleVSide1), vY + lenToSide2 * Math.sin(angleVSide1), 0);
        const p3 = new Vector3(vX + lenToSide2 * Math.cos(angleVSide2), vY + lenToSide2 * Math.sin(angleVSide2), 0);
        const p4 = new Vector3(vX + lenToSide1 * Math.cos(angleVSide2), vY + lenToSide1 * Math.sin(angleVSide2), 0);
        
        return [p1, p2, p3, p4, p1.clone()];
    }
    
    private createCutterMeshFromCoords(coords: Vector3[], slotIndex: number, state: CompositionStateDTO): Mesh | null {
        if (coords.length < 3) return null;
        
        // Get canvas center for transformation
        const h = state.frame_design.finish_x / 2.0;
        const k = state.frame_design.finish_y / 2.0;
        
        // Transform coordinates from CAD XY to Babylon XZ plane
        const transformedCoords = coords.map(coord => 
            new Vector3(
                coord.x - h,    // Center X
                0,              // Y = 0 (we're in XZ plane)
                -(coord.y - k)  // Center and flip Y to -Z
            )
        );
        
        const cutterDepth = 0.375;
        const cutterMesh = MeshBuilder.ExtrudePolygon(
            `slotCutter_${slotIndex}`, 
            { 
                shape: transformedCoords, 
                depth: cutterDepth, 
                sideOrientation: Mesh.DOUBLESIDE 
            }, 
            this.scene, 
            earcut
        );
        
        // No rotation needed - geometry is created in correct orientation
        return cutterMesh;
    }
}