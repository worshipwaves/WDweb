// src/BackingMaterial.ts

import { PBRMaterial, Color3, Texture, Scene } from '@babylonjs/core';

import type { BackingParameters } from './types/PanelTypes';

/**
 * Material manager for backing meshes
 * Handles PBR materials for acrylic, cloth, and foam
 */
export class BackingMaterial {
  private material: PBRMaterial;
  private scene: Scene;

  constructor(scene: Scene, backingParams: BackingParameters) {
    this.scene = scene;
    this.material = this.createMaterial(backingParams);
  }

  private createMaterial(params: BackingParameters): PBRMaterial {
    const mat = new PBRMaterial(`backing_${params.type}_${params.material}`, this.scene);
    
    if (!params.material_properties) {
      return mat;
    }

    const props = params.material_properties;
    const pbr = props.pbr_properties;

    // Base color
    mat.albedoColor = new Color3(
      props.color_rgb[0],
      props.color_rgb[1],
      props.color_rgb[2]
    );

    // PBR properties
    mat.metallic = pbr.metallic;
    mat.roughness = pbr.roughness;

    // Transparency for acrylic
    if (props.alpha !== undefined) {
      mat.alpha = props.alpha;
    }

    // Clear coat for acrylic
    if (pbr.clearcoat_intensity !== undefined) {
      mat.clearCoat.isEnabled = true;
      mat.clearCoat.intensity = pbr.clearcoat_intensity;
      mat.clearCoat.roughness = pbr.clearcoat_roughness || 0.05;
    }

    // Textures for cloth/foam
    if (props.texture_files) {
      if (props.texture_files.diffuse) {
        mat.albedoTexture = new Texture(props.texture_files.diffuse, this.scene);
      }
      if (props.texture_files.normal) {
        mat.bumpTexture = new Texture(props.texture_files.normal, this.scene);
      }
    }

    // Two-sided rendering
    mat.backFaceCulling = false;
    mat.twoSidedLighting = true;

    return mat;
  }

  public getMaterial(): PBRMaterial {
    return this.material;
  }

  public updateMaterial(backingParams: BackingParameters): void {
    this.material.dispose();
    this.material = this.createMaterial(backingParams);
  }

  public dispose(): void {
    this.material.dispose();
  }
}