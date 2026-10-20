/**
 * VOIDSTEP — 60 Saniyelik Mekanik ve Fizik Simülasyon Testi
 * - Zıplamadan geçiş testi: Küp boşlukta düşüyor mu?
 * - Zıplayarak ilerleme testi: Sonsuz parkur üretimi ve dispose kontrolü.
 * - 60+ saniye oyun döngüsü simülasyonu.
 */

const CONFIG = {
  FORWARD_SPEED_START: 5.0,
  FORWARD_SPEED_MAX: 9.0,
  FORWARD_SPEED_STEP_PER_100M: 0.5,
  STRAFE_SPEED: 4.8,
  JUMP_FORCE: 11.0,
  GRAVITY: -28.0,
  PLAYER_SIZE: 0.8,
  PLAYER_START_Y: 0.90,
  PLATFORM_HEIGHT: 1.0,
  PLATFORM_DEPTH: 5.0,
  PLATFORM_WIDTH_START: 4.0,
  PLATFORM_WIDTH_MIN: 2.2,
  MIN_EDGE_GAP: 2.5,
  GAP_BONUS_INCREMENT: 0.4,
  GAP_BONUS_DECREMENT: 0.1,
  GAP_BONUS_MAX: 2.0,
  PLATFORM_MAX_X_STEP_START: 1.5,
  PLATFORM_MAX_X_STEP_MAX: 2.5,
  PLATFORM_X_RANGE: 2.2,
  ACTIVE_PLATFORMS_AHEAD: 15,
  DISPOSE_DISTANCE_BEHIND: 20,
  FALL_THRESHOLD: -8,
};

function lerp(a, b, t) { return a + (b - a) * t; }

function calcDiff(distance, gapBonus = 0) {
  const speed = Math.min(CONFIG.FORWARD_SPEED_MAX, CONFIG.FORWARD_SPEED_START + (distance / 100) * CONFIG.FORWARD_SPEED_STEP_PER_100M);
  const widthRatio = Math.min(distance / 400, 1.0);
  const platformWidth = Number((CONFIG.PLATFORM_WIDTH_START - widthRatio * (CONFIG.PLATFORM_WIDTH_START - CONFIG.PLATFORM_WIDTH_MIN)).toFixed(2));
  const airTime = (2 * CONFIG.JUMP_FORCE) / Math.abs(CONFIG.GRAVITY);
  const edgeGapMax = speed * airTime * 0.8;
  const gapProgress = Math.min(distance / 500, 1.0);
  const baseEdgeGap = lerp(CONFIG.MIN_EDGE_GAP, edgeGapMax, gapProgress);
  const actualEdgeGap = Number(Math.min(baseEdgeGap + gapBonus, edgeGapMax).toFixed(2));
  return { speed, platformWidth, actualEdgeGap, edgeGapMax, airTime };
}

console.log('--- TEST 1: Zıplamadan Düşüş Simülasyonu ---');
// Oyuncu Platform 0 (Z: 0, depth: 5, front: -2.5) üzerinden yürüyerek çıkıyor
let playerY = 0.90;
let playerZ = -2.5; // Platform kenarı
let velocityY = 0;
const nextPlatBackZ = -2.5 - 2.5; // MIN_EDGE_GAP = 2.5 sonra -> Z = -5.0
const nextPlatTopY = 0.50;
let fellBelowThreshold = false;
let hitNextPlatformTop = false;

const dt = 1 / 60;
while (playerZ > nextPlatBackZ - 2.5) {
  playerZ -= 5.0 * dt; // speed 5
  velocityY += CONFIG.GRAVITY * dt;
  playerY += velocityY * dt;

  const playerBottom = playerY - CONFIG.PLAYER_SIZE / 2;
  const centerInNextPlat = playerZ <= nextPlatBackZ;

  if (centerInNextPlat) {
    if (playerBottom <= nextPlatTopY + 0.08 && playerBottom >= nextPlatTopY - 0.25) {
      hitNextPlatformTop = true;
      break;
    }
  }

  if (playerY < CONFIG.FALL_THRESHOLD) {
    fellBelowThreshold = true;
    break;
  }
}

console.log(`Sonraki platform kenarına ulaşıldığında Y: ${playerY.toFixed(2)}, Alt Y: ${(playerY - 0.4).toFixed(2)}`);
console.log(`Platform yüzeyine hatalı tutunma oldu mu?: ${hitNextPlatformTop ? 'EVET (HATA!)' : 'HAYIR (BAŞARILI)'}`);
console.log(`Oyuncu boşluğa düştü mü?: ${playerY < 0 ? 'EVET (BAŞARILI)' : 'HAYIR'}`);

console.log('\n--- TEST 2: 60 Saniyelik Sonsuz Parkur Simülasyonu ---');
let simPlayerZ = 0;
let simDistance = 0;
let gapBonus = 0;
let totalDisposed = 0;
let totalSpawned = 0;

// Platform kuyruğu
let platforms = [];
let lastFrontZ = 2.5;

function spawn(d) {
  const diff = calcDiff(d, gapBonus);
  const z = lastFrontZ - diff.actualEdgeGap - CONFIG.PLATFORM_DEPTH / 2;
  lastFrontZ = z - CONFIG.PLATFORM_DEPTH / 2;
  platforms.push({ z, depth: CONFIG.PLATFORM_DEPTH, id: totalSpawned++ });
}

// İlk 15 platform
for (let i = 0; i < CONFIG.ACTIVE_PLATFORMS_AHEAD; i++) spawn(0);

// 60 saniye x 60 fps = 3600 kare
for (let frame = 0; frame < 3600; frame++) {
  const currentSpeed = calcDiff(simDistance, gapBonus).speed;
  simPlayerZ -= currentSpeed * dt;
  simDistance = Math.abs(simPlayerZ);

  // Platform yönetimi
  while (platforms.length < 15 || (simPlayerZ - platforms[platforms.length - 1].z) < 110) {
    spawn(simDistance);
  }

  while (platforms.length > 0) {
    const first = platforms[0];
    if (first.z + first.depth / 2 > simPlayerZ + CONFIG.DISPOSE_DISTANCE_BEHIND) {
      platforms.shift();
      totalDisposed++;
    } else {
      break;
    }
  }
}

console.log(`60 saniye sonrası kat edilen mesafe: ${simDistance.toFixed(1)} m`);
console.log(`Aktif platform sayısı: ${platforms.length} (Her zaman >= 15)`);
console.log(`Toplam üretilen platform: ${totalSpawned}`);
console.log(`Hafızadan temizlenen (disposed) platform: ${totalDisposed}`);
console.log(`Hafıza sızıntısı var mı?: ${platforms.length < 30 ? 'HAYIR, TEMİZ' : 'EVET'}`);
