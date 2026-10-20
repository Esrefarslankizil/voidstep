import * as THREE from 'three';
import { CONFIG } from './config';

/**
 * Konik Işık Huzmesi (Volumetric Conical Light Beam)
 *
 * Özellikler:
 * - Küpün önünden hafif aşağı bakan THREE.ConeGeometry (açık tabanlı / open-ended).
 * - Additive blending, mavi/mor neon renk (0x5a88ff), depthWrite: false.
 * - Boyu: Küpten kümenin son platformunun uzak kenarına (farZ) kadar uzanır ve
 *   küp ilerledikçe kısalır; asla küme dışına taşmaz.
 * - Yön: Aktif platform kümesinin merkezine bakar.
 * - WARNING durumunda: Titreme (flicker) ve daralma (scale).
 * - FADING durumunda: Yumuşakça 0'a söner.
 * - Mobil performans için gerçek SpotLight veya gölge kullanılmaz.
 */
export class LightBeam {
  mesh: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private baseRadiusRatio = 0.22;

  constructor(scene: THREE.Scene) {
    // Birim koni: height = 1.0, radius = baseRadiusRatio
    const geo = new THREE.ConeGeometry(this.baseRadiusRatio, 1.0, 24, 1, true);
    // Tepe noktasını (apex) (0, 0, 0) orijinine taşı
    geo.translate(0, -0.5, 0);
    // Koniyi -Z (ileri / lookAt) yönüne çevir
    geo.rotateX(-Math.PI / 2);

    this.material = new THREE.MeshBasicMaterial({
      color: 0x5a88ff,
      transparent: true,
      opacity: CONFIG.BEAM_OPACITY,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  update(
    cubePos: THREE.Vector3,
    setCenterPos: THREE.Vector3,
    setFarZ: number
  ): void {
    // Tepe noktası (apex): Küpün ön ve hafif alt kenarı
    const startX = cubePos.x;
    const startY = cubePos.y + 0.15;
    const startZ = cubePos.z - 0.25;

    // Huzmenin uzunluğu: Küpten önündeki 3'lü kümenin son platformunun uzak kenarına kadar olan mesafe
    const length = Math.max(1.2, startZ - setFarZ);

    this.mesh.position.set(startX, startY, startZ);

    // Huzme yönü önündeki kümenin merkezine bakar
    const lookTarget = new THREE.Vector3(setCenterPos.x, 0.0, setFarZ + length * 0.45);
    this.mesh.lookAt(lookTarget);

    this.material.opacity = CONFIG.BEAM_OPACITY;
    this.mesh.scale.set(length, length, length);
    this.mesh.visible = true;
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
