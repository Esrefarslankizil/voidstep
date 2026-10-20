import * as THREE from 'three';
import { CONFIG, calculateRunwayLength } from './config';
import { createEdgeTileTexture } from './textures';

export interface Platform {
  mesh: THREE.Mesh;
  edges: THREE.LineSegments;
  gridLines: THREE.LineSegments;
  themeIndex: number;
  index: number;
  batchIndex: number;
  width: number;
  depth: number;
  height: number;
  isRunway?: boolean;

  // Bağımsız Görünürlük & Materyaller
  currentVisibility: number;
  targetVisibility: number;
  materials: THREE.MeshBasicMaterial[];
  edgeMat: THREE.LineBasicMaterial;
  glowEdgeMat: THREE.LineBasicMaterial;

  setTargetVisibility: (val: number) => void;
  updateVisibility: (dt: number) => void;
  dispose: () => void;
}

export interface DifficultyParams {
  speed: number;
  platformWidth: number;
  actualEdgeGap: number;
  edgeGapMax: number;
  airTime: number;
  actualMaxXStep: number;
  fairMaxXStep: number;
}

/**
 * Mesafeye göre dinamik zorluk parametrelerini hesaplar.
 */
export function calculateDifficulty(distance: number, gapBonus = 0): DifficultyParams {
  const runwayTravel = calculateRunwayLength() - CONFIG.PLAYER_START_MARGIN;
  const effectiveDistance = Math.max(0, distance - runwayTravel);

  // 1. İleri Hız (5'ten başlar, her 100m'de +0.5, en fazla 9)
  const speed = Math.min(
    CONFIG.FORWARD_SPEED_MAX,
    CONFIG.FORWARD_SPEED_START + (effectiveDistance / 100) * CONFIG.FORWARD_SPEED_STEP_PER_100M
  );

  // 2. Platform Genişliği (4'ten başlar, mesafeyle 2.2'ye kadar daralır)
  const widthRatio = Math.min(effectiveDistance / 400, 1.0);
  const platformWidth = Number(
    (CONFIG.PLATFORM_WIDTH_START - widthRatio * (CONFIG.PLATFORM_WIDTH_START - CONFIG.PLATFORM_WIDTH_MIN)).toFixed(2)
  );

  // 3. Havada Kalma Süresi
  const airTime = (2 * CONFIG.JUMP_FORCE) / Math.abs(CONFIG.GRAVITY);

  // 4. Boşluk Üst Sınırı: edgeGap <= FORWARD_SPEED * havadaKalmaSüresi * 0.8
  const edgeGapMax = speed * airTime * 0.8;

  // 5. Uyarlanabilir Kenar Boşluğu
  const gapProgress = Math.min(effectiveDistance / 500, 1.0);
  const baseEdgeGap = THREE.MathUtils.lerp(CONFIG.MIN_EDGE_GAP, edgeGapMax, gapProgress);
  const actualEdgeGap = Number(Math.min(baseEdgeGap + gapBonus, edgeGapMax).toFixed(2));

  // 6. Yan Hareket Adillik Kontrolü
  const transitTime = actualEdgeGap / speed;
  const fairMaxXStep = Number((CONFIG.STRAFE_SPEED * transitTime * 0.8).toFixed(2));
  const targetMaxXStep = THREE.MathUtils.lerp(
    CONFIG.PLATFORM_MAX_X_STEP_START,
    CONFIG.PLATFORM_MAX_X_STEP_MAX,
    Math.min(effectiveDistance / 450, 1.0)
  );
  const actualMaxXStep = Number(Math.min(targetMaxXStep, fairMaxXStep).toFixed(2));

  return {
    speed,
    platformWidth,
    actualEdgeGap,
    edgeGapMax,
    airTime,
    actualMaxXStep,
    fairMaxXStep,
  };
}

/**
 * Platform iç ızgara çizgilerini üretir
 */
function createInternalGridGeometry(W: number, H: number, D: number): THREE.BufferGeometry {
  const points: number[] = [];
  const halfW = W / 2;
  const halfH = H / 2;
  const halfD = D / 2;

  const stepX = 1;
  for (let x = stepX; x < W; x += stepX) {
    const px = -halfW + x;
    points.push(px, halfH + 0.002, -halfD, px, halfH + 0.002, halfD);
  }
  for (let z = 1; z < D; z++) {
    const pz = -halfD + z;
    points.push(-halfW, halfH + 0.002, pz, halfW, halfH + 0.002, pz);
  }

  for (let x = stepX; x < W; x += stepX) {
    const px = -halfW + x;
    points.push(px, -halfH, halfD + 0.002, px, halfH, halfD + 0.002);
    points.push(px, -halfH, -halfD - 0.002, px, halfH, -halfD - 0.002);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geo;
}

/**
 * Platform Oluşturucu (Bireysel Materyaller ile)
 *
 * Her platform kendi MeshBasicMaterial ve LineBasicMaterial nesnelerine sahiptir.
 * Görünürlük (0..1) hedefe doğru hızlı lerp eder (açılış: 10/sn, sönme: FADING süresine göre).
 * Kenarlar neon mavi (#00cfff) ve mor (#9b5cff).
 */
function createSinglePlatform(
  scene: THREE.Scene,
  x: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  themeIndex: number,
  platformIndex: number,
  isRunway = false
): Platform {
  const batchIndex = isRunway ? 0 : Math.floor((platformIndex - 1) / CONFIG.BATCH_SIZE) + 1;
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const edgesGeo = new THREE.EdgesGeometry(geometry);
  const gridGeo = createInternalGridGeometry(width, height, depth);

  const neonCyan = '#00cfff';
  const neonPurple = '#9b5cff';
  const hexCyan = 0x00cfff;
  const hexPurple = 0x9b5cff;

  let neonColor: string;
  let hexColor: number;
  let innerColor: string;

  if (isRunway) {
    neonColor = neonCyan;
    hexColor = hexCyan;
    innerColor = '#040915';
  } else {
    const isCyan = platformIndex % 2 === 1;
    neonColor = isCyan ? neonCyan : neonPurple;
    hexColor = isCyan ? hexCyan : hexPurple;
    innerColor = isCyan ? '#030814' : '#0a0414';
  }

  // Başlangıç görünürlüğü: Zemin ve ilk 3'lü küme (batch 1) aydınlık, geri kalanı karanlık
  const initialVis = (isRunway || batchIndex === 1) ? 1.0 : CONFIG.DARK_VISIBILITY;

  const materials: THREE.MeshBasicMaterial[] = [];
  for (let f = 0; f < 6; f++) {
    const tex = createEdgeTileTexture(neonColor, innerColor);
    materials.push(
      new THREE.MeshBasicMaterial({
        map: tex,
        color: 0xffffff,
        transparent: true,
        opacity: initialVis,
      })
    );
  }

  const edgeMat = new THREE.LineBasicMaterial({
    color: hexColor,
    linewidth: 2,
    transparent: true,
    opacity: initialVis,
  });

  const glowEdgeMat = new THREE.LineBasicMaterial({
    color: hexColor,
    transparent: true,
    opacity: initialVis * 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, materials);
  mesh.position.set(x, 0, z);

  const edges = new THREE.LineSegments(edgesGeo, edgeMat);
  edges.position.copy(mesh.position);

  const gridLines = new THREE.LineSegments(gridGeo, glowEdgeMat);
  gridLines.position.copy(mesh.position);

  scene.add(mesh);
  scene.add(edges);
  scene.add(gridLines);

  let currentVisibility = initialVis;
  let targetVisibility = initialVis;

  const setTargetVisibility = (val: number) => {
    targetVisibility = val;
  };

  const updateVisibility = (dt: number) => {
    const lerpSpeed = 12.0;
    currentVisibility = THREE.MathUtils.lerp(
      currentVisibility,
      targetVisibility,
      Math.min(1.0, lerpSpeed * dt)
    );

    const vis = currentVisibility;

    if (vis <= 0.005) {
      mesh.visible = false;
      edges.visible = false;
      gridLines.visible = false;
    } else {
      mesh.visible = true;
      edges.visible = true;
      gridLines.visible = true;

      for (const m of materials) {
        m.opacity = Math.min(1.0, vis * 0.95);
      }
      edgeMat.opacity = Math.min(1.0, vis);
      glowEdgeMat.opacity = Math.min(1.0, vis * 0.45);
    }
  };

  const dispose = () => {
    scene.remove(mesh);
    scene.remove(edges);
    scene.remove(gridLines);

    geometry.dispose();
    edgesGeo.dispose();
    gridGeo.dispose();
    edgeMat.dispose();
    glowEdgeMat.dispose();

    materials.forEach((m) => {
      if (m.map) m.map.dispose();
      m.dispose();
    });
  };

  return {
    mesh,
    edges,
    gridLines,
    themeIndex,
    index: platformIndex,
    batchIndex,
    width,
    depth,
    height,
    isRunway,
    currentVisibility,
    targetVisibility,
    materials,
    edgeMat,
    glowEdgeMat,
    setTargetVisibility,
    updateVisibility,
    dispose,
  };
}

/**
 * Sonsuz 3'lü Küme (Batch) Platform Yöneticisi
 */
export class PlatformManager {
  private scene: THREE.Scene;
  platforms: Platform[] = [];
  private nextIndex = 0;
  private lastFrontZ = 0;
  private prevX = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.reset();
  }

  reset(): void {
    for (const p of this.platforms) {
      p.dispose();
    }
    this.platforms = [];
    this.nextIndex = 0;
    this.prevX = 0;

    // ── 1. GÜVENLİ AÇILIŞ ZEMİNİ (RUNWAY) ──
    const runwayDepth = calculateRunwayLength(); // 14m
    const runwayWidth = CONFIG.PLATFORM_WIDTH_START + CONFIG.RUNWAY_WIDTH_BONUS;

    const runwayCenterZ = CONFIG.PLAYER_START_MARGIN - runwayDepth / 2;
    this.lastFrontZ = CONFIG.PLAYER_START_MARGIN - runwayDepth; // -12m

    const runway = createSinglePlatform(
      this.scene,
      0,
      runwayCenterZ,
      runwayWidth,
      runwayDepth,
      CONFIG.PLATFORM_HEIGHT,
      0,
      this.nextIndex++,
      true // isRunway
    );
    this.platforms.push(runway);

    // ── 2. ZEMİNDEN SONRAKİ İLK PLATFORMLAR ──
    for (let i = 0; i < CONFIG.ACTIVE_PLATFORMS_AHEAD; i++) {
      this.spawnNextPlatform(0, 0);
    }
  }

  /**
   * Bir sonraki platformu üretir.
   */
  private spawnNextPlatform(playerDistance: number, gapBonus: number): void {
    const i = this.nextIndex++;
    const normalPlatformIndex = i - 1;
    const isSafe = normalPlatformIndex < CONFIG.SAFE_PLATFORM_COUNT;

    const diff = calculateDifficulty(playerDistance, gapBonus);

    const width = isSafe ? CONFIG.PLATFORM_WIDTH_START : diff.platformWidth;
    const depth = CONFIG.PLATFORM_DEPTH;
    const height = CONFIG.PLATFORM_HEIGHT;
    const edgeGap = isSafe ? CONFIG.MIN_EDGE_GAP : diff.actualEdgeGap;

    const z = this.lastFrontZ - edgeGap - depth / 2;
    this.lastFrontZ = z - depth / 2;

    let x = 0;
    if (!isSafe) {
      const maxXStep = diff.actualMaxXStep;
      const minX = Math.max(-CONFIG.PLATFORM_X_RANGE, this.prevX - maxXStep);
      const maxX = Math.min(CONFIG.PLATFORM_X_RANGE, this.prevX + maxXStep);
      x = minX + Math.random() * (maxX - minX);
    }
    this.prevX = x;

    const platform = createSinglePlatform(
      this.scene,
      x,
      z,
      width,
      depth,
      height,
      i,
      i,
      false // isRunway
    );

    this.platforms.push(platform);
  }

  /**
   * Belirli bir kümenin (batch) en uzak kenar Z koordinatını döndürür
   */
  getBatchFarZ(batchIndex: number): number {
    let minZ = Infinity;
    for (const p of this.platforms) {
      if (p.batchIndex === batchIndex) {
        const farEdge = p.mesh.position.z - p.depth / 2;
        if (farEdge < minZ) minZ = farEdge;
      }
    }
    return minZ === Infinity ? -40 : minZ;
  }

  /**
   * Belirli bir kümenin (batch) ortalama merkez koordinatını döndürür
   */
  getBatchCenter(batchIndex: number): THREE.Vector3 {
    let sumX = 0;
    let sumZ = 0;
    let count = 0;

    for (const p of this.platforms) {
      if (p.batchIndex === batchIndex) {
        sumX += p.mesh.position.x;
        sumZ += p.mesh.position.z;
        count++;
      }
    }

    if (count === 0) return new THREE.Vector3(0, 0, -20);
    return new THREE.Vector3(sumX / count, 0, sumZ / count);
  }

  /**
   * 3'lü Küme Görünürlük Güncellemesi:
   * - Başlangıç zemini: görünür
   * - visibleBatchIndex (önündeki 3'lü küme): tam aydınlık (1.0)
   * - fadingBatchIndex (ayrılınan küme): saydamlığı azalarak sönüyor (1.0 -> 0.0)
   * - Diğerleri (içinde bulunulan ezberlenmiş küme veya uzaktakiler): karanlık (0.0)
   */
  updateVisibilities(
    dt: number,
    visibleBatchIndex: number,
    fadingBatchIndex: number | null,
    fadeProgress: number
  ): void {
    for (const p of this.platforms) {
      if (p.isRunway) {
        p.setTargetVisibility(1.0);
        p.updateVisibility(dt);
        continue;
      }

      let target: number = CONFIG.DARK_VISIBILITY;

      if (p.batchIndex === visibleBatchIndex) {
        // Önündeki 3'lü küme tam aydınlık
        target = 1.0;
      } else if (fadingBatchIndex !== null && p.batchIndex === fadingBatchIndex) {
        // Ayrılınan küme saydamlığı azalarak sönüyor
        target = Math.max(0, 1.0 - fadeProgress);
      } else {
        // İçinde bulunulan küme veya sonraki kümeler karanlık
        target = CONFIG.DARK_VISIBILITY;
      }

      p.setTargetVisibility(target);
      p.updateVisibility(dt);
    }
  }

  update(playerZ: number, gapBonus: number): void {
    const playerDistance = Math.abs(playerZ);

    const lastPlatform = this.platforms[this.platforms.length - 1];
    const distanceAhead = lastPlatform ? playerZ - lastPlatform.mesh.position.z : 0;

    while (this.platforms.length < CONFIG.ACTIVE_PLATFORMS_AHEAD || distanceAhead < 120) {
      this.spawnNextPlatform(playerDistance, gapBonus);
      const newLast = this.platforms[this.platforms.length - 1];
      if (!newLast || playerZ - newLast.mesh.position.z >= 130) break;
    }

    const thresholdZ = playerZ + CONFIG.DISPOSE_DISTANCE_BEHIND;

    while (this.platforms.length > 0) {
      const first = this.platforms[0];
      const backEdgeZ = first.mesh.position.z + first.depth / 2;

      if (backEdgeZ > thresholdZ) {
        first.dispose();
        this.platforms.shift();
      } else {
        break;
      }
    }
  }
}

export function getPlatformBounds(platform: Platform) {
  const p = platform.mesh.position;
  return {
    minX: p.x - platform.width / 2,
    maxX: p.x + platform.width / 2,
    minY: p.y - platform.height / 2,
    maxY: p.y + platform.height / 2,
    minZ: p.z - platform.depth / 2,
    maxZ: p.z + platform.depth / 2,
  };
}
