import * as THREE from 'three';

const MAX_CUBES = 40;
const MAX_SPARKS = 80;

interface TrailCube {
  mesh: THREE.LineSegments;
  velocity: THREE.Vector3;
  rotSpeed: THREE.Vector3;
  life: number;
  maxLife: number;
  baseScale: number;
}

/**
 * Referans görseldeki "EDGE" tarzı küp parçacık sistemi:
 * Oyuncunun arkasında süzülen, dönen mini tel kafes küpler (cube debris trail)
 * ve zıplama/iniş anında açığa çıkan neon kıvılcımlar.
 */
export class ParticleSystem {
  private trailCubes: TrailCube[] = [];
  private sparksPoints: THREE.Points;
  private sparkPositions: Float32Array;
  private sparkVelocities: Float32Array;
  private sparkLifetimes: Float32Array;
  private nextSparkIndex = 0;
  private cubePoolIndex = 0;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // ── 1. Mini Küp İzi Havuzu (Tel Kafes Küpler) ──
    const cubeGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    const edgesGeo = new THREE.EdgesGeometry(cubeGeo);

    for (let i = 0; i < MAX_CUBES; i++) {
      const mat = new THREE.LineBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.LineSegments(edgesGeo, mat);
      mesh.position.set(0, -100, 0);
      mesh.visible = false;
      scene.add(mesh);

      this.trailCubes.push({
        mesh,
        velocity: new THREE.Vector3(),
        rotSpeed: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        baseScale: 1,
      });
    }

    // ── 2. Parlak Neon Kıvılcımlar ──
    this.sparkPositions = new Float32Array(MAX_SPARKS * 3);
    this.sparkVelocities = new Float32Array(MAX_SPARKS * 3);
    this.sparkLifetimes = new Float32Array(MAX_SPARKS);

    for (let i = 0; i < MAX_SPARKS; i++) {
      this.sparkPositions[i * 3 + 1] = -100;
      this.sparkLifetimes[i] = 0;
    }

    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));

    const sparkMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.12,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.sparksPoints = new THREE.Points(sparkGeo, sparkMat);
    scene.add(this.sparksPoints);
  }

  /**
   * Oyuncu hareket ederken arkasından kopup süzülen mini küp bırakır
   */
  emitTrailCube(pos: THREE.Vector3, colorHex = 0x00f0ff): void {
    const item = this.trailCubes[this.cubePoolIndex];
    this.cubePoolIndex = (this.cubePoolIndex + 1) % MAX_CUBES;

    const mesh = item.mesh;
    mesh.visible = true;
    (mesh.material as THREE.LineBasicMaterial).color.setHex(colorHex);
    (mesh.material as THREE.LineBasicMaterial).opacity = 0.85;

    // Küpün arkasından ve tabanından hafif saçılma ile başla
    mesh.position.set(
      pos.x + (Math.random() - 0.5) * 0.4,
      pos.y + (Math.random() - 0.3) * 0.4,
      pos.z + 0.3 + Math.random() * 0.3
    );

    // Hafif yukarı ve geriye doğru süzülme (referans görseldeki gibi)
    item.velocity.set(
      (Math.random() - 0.5) * 0.8,
      Math.random() * 1.5 + 0.3,
      Math.random() * 1.0 + 0.5
    );

    // Rastgele dönme hızı
    item.rotSpeed.set(
      (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 6
    );

    const life = 0.8 + Math.random() * 0.6;
    item.life = life;
    item.maxLife = life;
    item.baseScale = 0.7 + Math.random() * 0.6;
    mesh.scale.setScalar(item.baseScale);
  }

  /**
   * Zıplama veya yere inişte neon kıvılcım patlaması
   */
  emitBurst(origin: THREE.Vector3, count: number, upward: boolean, colorHex = 0x00f0ff): void {
    // 2-3 adet mini küp fırlat
    const cubeCount = Math.min(3, count);
    for (let c = 0; c < cubeCount; c++) {
      this.emitTrailCube(origin, colorHex);
    }

    // Kıvılcımları saç
    (this.sparksPoints.material as THREE.PointsMaterial).color.setHex(colorHex);

    for (let i = 0; i < count; i++) {
      const idx = this.nextSparkIndex;
      this.nextSparkIndex = (this.nextSparkIndex + 1) % MAX_SPARKS;

      this.sparkPositions[idx * 3] = origin.x + (Math.random() - 0.5) * 0.5;
      this.sparkPositions[idx * 3 + 1] = origin.y - 0.2;
      this.sparkPositions[idx * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.5;

      this.sparkVelocities[idx * 3] = (Math.random() - 0.5) * 4;
      this.sparkVelocities[idx * 3 + 1] = upward ? Math.random() * 5 + 2 : -(Math.random() * 2 + 0.5);
      this.sparkVelocities[idx * 3 + 2] = (Math.random() - 0.5) * 4;

      this.sparkLifetimes[idx] = 0.4 + Math.random() * 0.3;
    }
  }

  update(dt: number): void {
    // ── Mini Küp İzi Güncellemesi ──
    for (const item of this.trailCubes) {
      if (item.life <= 0) continue;

      item.life -= dt;
      const progress = item.life / item.maxLife; // 1 -> 0

      // Hareket & Dönme
      item.mesh.position.addScaledVector(item.velocity, dt);
      item.mesh.rotation.x += item.rotSpeed.x * dt;
      item.mesh.rotation.y += item.rotSpeed.y * dt;
      item.mesh.rotation.z += item.rotSpeed.z * dt;

      // Yerçekimi hafifçe aşağı çeker
      item.velocity.y -= 2.0 * dt;

      // Küçülerek ve solarak kaybolma
      const scale = item.baseScale * progress;
      item.mesh.scale.setScalar(Math.max(0.001, scale));
      (item.mesh.material as THREE.LineBasicMaterial).opacity = progress * 0.8;

      if (item.life <= 0) {
        item.mesh.visible = false;
        item.mesh.position.set(0, -100, 0);
      }
    }

    // ── Kıvılcım Güncellemesi ──
    for (let i = 0; i < MAX_SPARKS; i++) {
      if (this.sparkLifetimes[i] <= 0) continue;

      this.sparkLifetimes[i] -= dt;
      this.sparkPositions[i * 3] += this.sparkVelocities[i * 3] * dt;
      this.sparkPositions[i * 3 + 1] += this.sparkVelocities[i * 3 + 1] * dt;
      this.sparkPositions[i * 3 + 2] += this.sparkVelocities[i * 3 + 2] * dt;

      this.sparkVelocities[i * 3 + 1] -= 8 * dt;

      if (this.sparkLifetimes[i] <= 0) {
        this.sparkPositions[i * 3 + 1] = -100;
      }
    }

    (this.sparksPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
