import * as THREE from 'three';
import { CONFIG } from './config';
import { Player } from './player';
import { PlatformManager, calculateDifficulty } from './platforms';
import { checkCollision, collisionState, resetCollisionState } from './collision';
import { InputManager } from './input';
import { ParticleSystem } from './particles';
import { UI } from './ui';
import { createNebulaTexture } from './textures';
import { Tutorial, hasSeenTutorial, resetTutorialStatus } from './tutorial';
import { FullscreenManager, setupAutoFullscreenOnGesture, tryAutoFullscreen } from './fullscreen';
import { FenerManager } from './fener';
import { LightBeam } from './beam';

// ── State ──────────────────────────────────────
type GameState = 'PLAYING' | 'GAME_OVER' | 'PAUSED' | 'TUTORIAL';
let state: GameState = 'PLAYING';
let distance = 0;
let isPortraitMode = false;
let tutorialInstance: Tutorial | null = null;

// ── Three.js Sahne & Renderer ──────────────────
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(CONFIG.BG_COLOR);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(CONFIG.BG_COLOR, 0.012);

// Yatay (landscape) ekran için optimize edilmiş 55 derecelik görüş açısı
const camera = new THREE.PerspectiveCamera(
  CONFIG.CAM_FOV,
  window.innerWidth / window.innerHeight,
  0.1,
  140
);

// ── Oyun Nesneleri ─────────────────────────────
let player: Player;
let platformManager: PlatformManager;
let particles: ParticleSystem;
let lightBeam: LightBeam;
const nebulae: THREE.Sprite[] = [];
const ui = new UI();
const fullscreenManager = new FullscreenManager();
const fenerManager = new FenerManager();
setupAutoFullscreenOnGesture();

function initGame(): void {
  while (scene.children.length > 0) {
    scene.remove(scene.children[0]);
  }
  nebulae.length = 0;

  player = new Player(scene);
  platformManager = new PlatformManager(scene);
  particles = new ParticleSystem(scene);
  lightBeam = new LightBeam(scene);

  resetCollisionState();
  fenerManager.reset();
  addSpaceAtmosphere();

  distance = 0;
  state = 'PLAYING';
  ui.reset();
  checkOrientation();

  if (hasSeenTutorial()) {
    ui.showStartHint();
    fullscreenManager.showInstallHintIfNeeded();
  }
}

// ── Kozmik Uzay Atmosferi (Nebulalar & Yıldızlar) ──
function addSpaceAtmosphere(): void {
  const starCount = 450;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 120;
    positions[i * 3 + 1] = (Math.random() - 0.2) * 60;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 220 - 40;

    const r = Math.random();
    if (r < 0.55) {
      colors[i * 3] = 0.95; colors[i * 3 + 1] = 0.95; colors[i * 3 + 2] = 1.0;
    } else if (r < 0.8) {
      colors[i * 3] = 0.2; colors[i * 3 + 1] = 0.85; colors[i * 3 + 2] = 1.0;
    } else {
      colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.65; colors[i * 3 + 2] = 0.2;
    }
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const starMat = new THREE.PointsMaterial({
    size: 0.18,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  scene.add(new THREE.Points(starGeo, starMat));

  const nebulaConfigs = [
    { color: 'rgba(50, 20, 110, 0.45)', pos: new THREE.Vector3(-15, 8, -40), scale: 50 },
    { color: 'rgba(10, 50, 90, 0.35)',  pos: new THREE.Vector3(18, -4, -60), scale: 60 },
    { color: 'rgba(80, 25, 70, 0.30)',  pos: new THREE.Vector3(0, 15, -90),  scale: 75 },
    { color: 'rgba(15, 35, 75, 0.40)',  pos: new THREE.Vector3(-10, -10, -120), scale: 80 },
  ];

  for (const cfg of nebulaConfigs) {
    const tex = createNebulaTexture(cfg.color);
    const spriteMat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(cfg.pos);
    sprite.scale.set(cfg.scale, cfg.scale, 1);
    scene.add(sprite);
    nebulae.push(sprite);
  }
}

// ── Kamera Takibi (Yatay Ekran İçin Optimize) ──
function updateCamera(): void {
  const target = new THREE.Vector3(
    player.mesh.position.x * 0.45 + CONFIG.CAM_OFFSET_X,
    player.mesh.position.y + CONFIG.CAM_OFFSET_Y,
    player.mesh.position.z + CONFIG.CAM_OFFSET_Z
  );
  camera.position.lerp(target, CONFIG.CAM_LERP);

  const lookAt = new THREE.Vector3(
    player.mesh.position.x * 0.25,
    player.mesh.position.y + 0.3,
    player.mesh.position.z - CONFIG.CAM_LOOK_AHEAD
  );
  camera.lookAt(lookAt);

  for (const n of nebulae) {
    n.position.z = player.mesh.position.z + (n.userData.baseZ || (n.userData.baseZ = n.position.z));
  }
}

// ── Eğitim (Tutorial) Başlatma ─────────────────
function startTutorial(): void {
  state = 'TUTORIAL';
  ui.showControls(false);

  tutorialInstance = new Tutorial(() => {
    tutorialInstance = null;
    state = 'PLAYING';
    ui.showControls(true);
    ui.showStartHint();
    fullscreenManager.showInstallHintIfNeeded();
  });

  tutorialInstance.show();
}

// ── Ekran Yönü Kontrolü (Dikey = Uyarı & Duraklat, Yatay = Devam Et) ──
function checkOrientation(): boolean {
  const isLandscape = window.innerWidth > window.innerHeight;
  const isPortrait = !isLandscape;

  if (isPortrait !== isPortraitMode) {
    isPortraitMode = isPortrait;
    ui.setOrientationWarning(isPortrait);

    if (isPortrait) {
      if (state === 'PLAYING') {
        state = 'PAUSED';
      }
    } else {
      // Yataya dönüldü:
      if (!hasSeenTutorial()) {
        // İlk defa açılıyorsa yatay moda geçildiği an eğitimi başlat
        startTutorial();
      } else if (state === 'PAUSED') {
        state = 'PLAYING';
        ui.showControls(true);
      }
    }
  }

  return isPortraitMode;
}

// ── Girdi Yöneticisi ───────────────────────────
const input = new InputManager({
  onJump: () => {
    if (state === 'PLAYING') {
      player.jump();
      // 1. Başlangıç zemininden zıplama kontrolü
      if (fenerManager.currentBatchIndex === 0) {
        fenerManager.advanceToBatch(1);
      } else {
        // 2. Mevcut kümenin 3. (sonuncu) platformundan zıplama kontrolü
        const lastPlatformOfCurrentBatch = fenerManager.currentBatchIndex * CONFIG.BATCH_SIZE;
        if (collisionState.lastPlatformIndex === lastPlatformOfCurrentBatch) {
          fenerManager.advanceToBatch(fenerManager.currentBatchIndex + 1);
        }
      }
    }
  },
  onRestart: () => {
    if (state === 'GAME_OVER') {
      tryAutoFullscreen();
      input.setGameOver(false);
      initGame();
    }
  },
  onToggleLantern: () => {
    fenerManager.advanceToBatch(fenerManager.currentBatchIndex + 1);
  },
  onCycleLevel: () => {
    fenerManager.advanceToBatch(fenerManager.currentBatchIndex + 1);
  },
  onToggleDebug: () => {
    const show = fenerManager.toggleDebug();
    const underCube = player.isGrounded ? collisionState.lastPlatformIndex : null;
    ui.updateDebugOverlay(fenerManager.getDebugInfo(underCube, player.isGrounded), show);
  },
});

// ── HMR ve WebSocket Kopmalarında Sayfanın Yenilenmesini Engelle ──
if ((import.meta as any).hot) {
  (import.meta as any).hot.on('vite:ws:disconnect', () => {
    console.warn('[VOIDSTEP] WebSocket bağlantısı koptu — otomatik sayfa yenileme engellendi.');
  });
  (import.meta as any).hot.on('vite:beforeFullReload', () => {
    console.warn('[VOIDSTEP] Otomatik tam sayfa yenileme engellendi.');
    throw new Error('[VOIDSTEP] Full reload blocked');
  });
}

// ── Aktif Oyunda Yanlışlıkla Sayfayı Yenileme / Çıkış Koruması ──
window.addEventListener('beforeunload', (e) => {
  if (state === 'PLAYING' && distance > 15) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ── Sekme veya Ekran Değişimi (Ekran kilidi, başka sekme vs.) ──
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (state === 'PLAYING') {
      state = 'PAUSED';
    }
  } else {
    // Sekmeye dönüldüğünde saati sıfırla ki küp boşluğa fırlamasın
    clock.getDelta();
    if (state === 'PAUSED' && !isPortraitMode) {
      state = 'PLAYING';
      ui.showControls(true);
    }
  }
});

// ── Eğitimi Tekrar Göster Butonları Dinleyicileri ──
const btnReplayHud = document.getElementById('btn-tutorial-replay');
const btnReplayGameOver = document.getElementById('btn-tutorial-replay-gameover');

const handleReplayClick = (e: Event) => {
  e.preventDefault();
  e.stopPropagation();
  tryAutoFullscreen();
  resetTutorialStatus();
  ui.hideGameOver();
  input.setGameOver(false);
  initGame();
  startTutorial();
};

btnReplayHud?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  // Eğer oyun devam ediyorsa oyunu sıfırlama, duraklatıp eğitimi göster
  if (state === 'PLAYING') {
    state = 'TUTORIAL';
    ui.showControls(false);
    tutorialInstance = new Tutorial(() => {
      tutorialInstance = null;
      state = 'PLAYING';
      ui.showControls(true);
      clock.getDelta(); // zaman farkını sıfırla
    });
    tutorialInstance.show();
  } else {
    handleReplayClick(e);
  }
});

btnReplayGameOver?.addEventListener('click', handleReplayClick);

// ── Oyun Döngüsü ──────────────────────────────
const clock = new THREE.Clock();

function gameLoop(): void {
  requestAnimationFrame(gameLoop);

  // 1. Dikey ekran uyarısı aktifse fizik ve oyun döngüsü durur
  if (isPortraitMode) {
    renderer.render(scene, camera);
    return;
  }

  // 2. Eğitim sürerken CPU/GPU tasarrufu için fizik ve döngü durur (statik arka plan)
  if (state === 'TUTORIAL') {
    renderer.render(scene, camera);
    return;
  }

  const dt = Math.min(clock.getDelta(), 0.05);

  if (state === 'PLAYING') {
    distance = Math.abs(player.mesh.position.z);

    // 1. Başlangıç zemini veya kümenin 3. bloğundan ayrılma takibi:
    if (fenerManager.currentBatchIndex === 0) {
      // Başlangıç zemininden ayrılma (zıplama veya zeminden düşme/havalanma)
      const runway = platformManager.platforms.find((p) => p.isRunway);
      const runwayFrontZ = runway ? runway.mesh.position.z - runway.depth / 2 : -12;
      if (player.justJumped || !player.isGrounded || player.mesh.position.z < runwayFrontZ) {
        fenerManager.advanceToBatch(1);
      }
    } else {
      // Kümenin 3. (sonuncu) platformundan ayrılma (zıplama veya platform sonundan ayrılma)
      const lastPlatformOfCurrentBatch = fenerManager.currentBatchIndex * CONFIG.BATCH_SIZE;
      if (collisionState.lastPlatformIndex === lastPlatformOfCurrentBatch) {
        const plat = platformManager.platforms.find((p) => p.index === lastPlatformOfCurrentBatch);
        const platFrontZ = plat ? plat.mesh.position.z - plat.depth / 2 : player.mesh.position.z - 1;
        if (player.justJumped || !player.isGrounded || player.mesh.position.z < platFrontZ) {
          fenerManager.advanceToBatch(fenerManager.currentBatchIndex + 1);
        }
      } else if (collisionState.lastPlatformIndex > lastPlatformOfCurrentBatch) {
        // İleri bir platforma basıldıysa küme eşitlemesi
        const playerBatch = Math.floor((collisionState.lastPlatformIndex - 1) / CONFIG.BATCH_SIZE) + 1;
        if (playerBatch > fenerManager.currentBatchIndex) {
          fenerManager.advanceToBatch(playerBatch);
        }
      }
    }

    // Küpün şu anda üstünde durduğu platform indeksi (yerdeyse)
    const underCubeIndex = player.isGrounded ? collisionState.lastPlatformIndex : null;

    // Fener sönme zamanlayıcısının güncellenmesi
    fenerManager.update(dt);

    // Platform görünürlüklerinin güncellenmesi:
    // - Önündeki 3'lü küme tam aydınlık (1.0)
    // - Ayrılınan küme saydamlığı azalarak sönüyor (1.0 -> 0.0)
    // - Diğerleri karanlık (0.0)
    platformManager.updateVisibilities(
      dt,
      fenerManager.visibleBatchIndex,
      fenerManager.fadingBatchIndex,
      fenerManager.fadeProgress
    );

    // Konik Işık Huzmesi: daima önündeki aydınlık 3'lü kümeye bakar
    const setFarZ = platformManager.getBatchFarZ(fenerManager.visibleBatchIndex);
    const setCenter = platformManager.getBatchCenter(fenerManager.visibleBatchIndex);
    lightBeam.update(
      player.mesh.position,
      setCenter,
      setFarZ
    );

    // Karanlık atmosfer CSS vignette güncellemesi
    ui.updateVignette(fenerManager.vignetteOpacity);

    // HUD 3'lü küme göstergesi
    ui.updateBatchHUD(
      fenerManager.currentBatchIndex,
      fenerManager.visibleBatchIndex,
      fenerManager.fadingBatchIndex !== null
    );

    // Geliştirici Debug HUD açıksa canlı güncelle
    if (fenerManager.showDebugOverlay) {
      ui.updateDebugOverlay(fenerManager.getDebugInfo(underCubeIndex, player.isGrounded), true);
    }

    // Zorluk parametreleri
    const diff = calculateDifficulty(distance, collisionState.gapBonus);
    ui.updateScore(distance);
    ui.updateSpeed(diff.speed);

    // Girdi yönü
    player.strafeInput = input.getStrafeDirection();

    // Oyuncu hareketi
    player.update(dt, diff.speed);

    // Çarpışma kontrolü
    checkCollision(player, platformManager.platforms);

    // Post-collision
    player.postCollision();

    // Sonsuz Parkur üretimi ve geri dönüşümü
    platformManager.update(player.mesh.position.z, collisionState.gapBonus);

    // Parçacık efektleri
    if (player.shouldEmitTrail) {
      particles.emitTrailCube(player.mesh.position, 0x00f0ff);
    }
    if (player.justJumped) {
      particles.emitBurst(player.mesh.position, 10, true, 0x00f0ff);
    }
    if (player.justLanded) {
      particles.emitBurst(player.mesh.position, 8, false, 0x00f0ff);
    }

    // Düşme kontrolü
    if (player.mesh.position.y < CONFIG.FALL_THRESHOLD) {
      state = 'GAME_OVER';
      player.alive = false;
      input.setGameOver(true);
      ui.showGameOver(distance, fenerManager.currentBatchIndex, diff.speed);
    }
  }

  particles.update(dt);
  updateCamera();
  renderer.render(scene, camera);
}

// ── Pencere ve Yön Değişimi Dinleyicileri ───────
let resizeDebounceTimer: number | null = null;
function handleResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  checkOrientation();

  // Mobil cihazlarda adres çubuğu veya yön animasyonu bittiğinde tekrar doğrula
  if (resizeDebounceTimer !== null) {
    clearTimeout(resizeDebounceTimer);
  }
  resizeDebounceTimer = window.setTimeout(() => {
    checkOrientation();
    resizeDebounceTimer = null;
  }, 150);
}

window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', () => {
  setTimeout(handleResize, 100);
});
if (screen.orientation && 'addEventListener' in screen.orientation) {
  try {
    screen.orientation.addEventListener('change', () => {
      setTimeout(handleResize, 100);
    });
  } catch (_) {}
}

// ── Başlat ─────────────────────────────────────
initGame();
checkOrientation();

// Eğer yatay modda açıldıysa ve eğitim daha önce görülmediyse başlat
if (window.innerWidth > window.innerHeight && !hasSeenTutorial()) {
  startTutorial();
}

gameLoop();
