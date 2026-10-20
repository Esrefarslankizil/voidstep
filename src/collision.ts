import { Player } from './player';
import { Platform, getPlatformBounds } from './platforms';
import { CONFIG } from './config';

/** Platform geçişi ve uyarlanabilir boşluk takipçisi */
export interface CollisionState {
  lastPlatformIndex: number;
  gapBonus: number;
}

export const collisionState: CollisionState = {
  lastPlatformIndex: 0,
  gapBonus: 0,
};

export function resetCollisionState(): void {
  collisionState.lastPlatformIndex = 0;
  collisionState.gapBonus = 0;
}

/**
 * Sürekli (Swept) AABB Çarpışma ve Zemin Kontrolü.
 *
 * Çözülen Sorunlar:
 * 1. Tunneling (Hızlı düşerken veya FPS düşüşünde bloğun içinden geçip düşme):
 *    prevBottom ve currentBottom karşılaştırılarak, kare içinde platform yüzeyinden
 *    geçen küp kesin olarak yakalanır (0.25 gibi dar tolerans yerine platformun tüm
 *    1 metrelik gövde hacmi kontrol edilir).
 * 2. Kenar Kayması:
 *    Küpün gövdesi platformun üzerindeyken hafif kenar toleransı (marginX = 0.28) verilir;
 *    böylece küpün %90'ı bloğun üzerindeyken ani düşme yaşanmaz.
 * 3. Zıplamadan Geçiş Engeli:
 *    Boşluğa zıplamadan düşen küp 0.5 saniyede 3.5m dikey düşer ve sonraki platformun
 *    alt seviyesinin (minY) çok altında kalır; asla sonraki platforma tutunamaz.
 */
export function checkCollision(
  player: Player,
  platforms: Platform[]
): boolean {
  // Yukarı doğru zıplarken platformdan geçişe izin ver
  if (player.velocityY > 0) return false;

  const px = player.mesh.position.x;
  const pz = player.mesh.position.z;
  const prevBottom = player.prevY - CONFIG.PLAYER_SIZE / 2;
  const currentBottom = player.mesh.position.y - CONFIG.PLAYER_SIZE / 2;

  // Küp kenar toleransı (küpün yarısından azı boşluktaysa düşmesin)
  const marginX = CONFIG.PLAYER_SIZE * 0.35; // ~0.28 birim
  const marginZ = 0.30;

  for (let i = 0; i < platforms.length; i++) {
    const platform = platforms[i];
    const plat = getPlatformBounds(platform);

    // 1. Yatay X sınırları kontrolü
    const insideX = px >= plat.minX - marginX && px <= plat.maxX + marginX;
    if (!insideX) continue;

    // 2. İleri-Geri Z sınırları kontrolü
    const insideZ = pz <= plat.maxZ + marginZ && pz >= plat.minZ - marginZ;
    if (!insideZ) continue;

    // 3. Dikey Yüzey ve Gövde Kontrolü (Sürekli Çarpışma / Swept Collision)
    const platformTop = plat.maxY; // 0.50
    const platformBottom = plat.minY; // -0.50

    // Oyuncu bu karede veya önceki karede platform üst yüzeyindeydi veya üstünden geçti mi?
    const wasAboveOrAtSurface = prevBottom >= platformTop - 0.20;
    const isNowAtOrBelowSurface = currentBottom <= platformTop + 0.12;
    const isAbovePlatformBase = currentBottom >= platformBottom - 0.30;

    if (wasAboveOrAtSurface && isNowAtOrBelowSurface && isAbovePlatformBase) {
      // Platform üstüne kesin oturt
      const targetY = platformTop + CONFIG.PLAYER_SIZE / 2;
      player.mesh.position.y = targetY;
      player.edges.position.y = targetY;
      player.glowEdges.position.y = targetY;
      player.halo.position.y = targetY;

      player.velocityY = 0;
      player.isGrounded = true;

      // Platform geçişi kontrolü
      if (platform.index !== collisionState.lastPlatformIndex) {
        const wasOnRunway = collisionState.lastPlatformIndex === 0;

        // Açılış zemininden normal platforma geçiş ceza sayılmaz
        if (!wasOnRunway) {
          if (!player.hasJumpedThisGap) {
            // Boşluğu zıplamadan geçti -> ceza olarak sonraki boşlukları artır
            collisionState.gapBonus = Math.min(
              CONFIG.GAP_BONUS_MAX,
              collisionState.gapBonus + CONFIG.GAP_BONUS_INCREMENT
            );
          } else {
            // Zıplayarak nizami geçti -> bonus yavaşça normale dönsün
            collisionState.gapBonus = Math.max(
              0,
              collisionState.gapBonus - CONFIG.GAP_BONUS_DECREMENT
            );
          }
        }

        collisionState.lastPlatformIndex = platform.index;
        player.hasJumpedThisGap = false;
      }

      // Dönüşleri sıfırla
      player.mesh.rotation.x = 0;
      player.edges.rotation.x = 0;
      player.glowEdges.rotation.x = 0;

      return true;
    }
  }

  return false;
}
