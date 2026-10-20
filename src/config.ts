/** VOIDSTEP — Oyun Ayarları (Yatay / Landscape Modu) */
export const CONFIG = {
  // ── 1. Hız & Fizik (Mesafeye göre artar) ──
  FORWARD_SPEED_START: 5.0,
  FORWARD_SPEED_MAX: 9.0,
  FORWARD_SPEED_STEP_PER_100M: 0.5,

  // Yan hareket: %60 oranında tutuldu (STRAFE_SPEED = 4.8)
  STRAFE_SPEED: 4.8,
  STRAFE_ACCEL_LERP: 0.22, // ~0.08 sn yumuşak ama anında tepkili ivmelenme
  JUMP_FORCE: 11.0,
  GRAVITY: -28.0,

  // ── 2. Oyuncu (Küp) ──
  PLAYER_SIZE: 0.8,
  PLAYER_START_Y: 0.90, // Platform üstü 0.5 + 0.4
  PLAYER_COLOR: 0x00f0ff,
  PLAYER_MAX_X: 5.0,

  // ── 3. Kamera (Yatay 16:9 Geniş Ekran İçin Optimize Edildi) ──
  CAM_OFFSET_X: 0,
  CAM_OFFSET_Y: 3.6,
  CAM_OFFSET_Z: 5.4,
  CAM_LOOK_AHEAD: 4.0,
  CAM_LERP: 0.08,
  CAM_FOV: 55,

  // ── 4. Platform Boyutları ──
  PLATFORM_HEIGHT: 1.0,
  PLATFORM_DEPTH: 5.0,
  PLATFORM_WIDTH_START: 4.0,
  PLATFORM_WIDTH_MIN: 2.2,

  // ── 5. Başlangıç Güvenli Açılış Zemini (Runway) ──
  START_SAFE_SECONDS: 2,       // Küpün altında ilk 2 sn boyunca hiç boşluk olmayan zemin
  PLAYER_START_MARGIN: 2,      // Küpün zeminin başından uzaklığı
  RUNWAY_WIDTH_BONUS: 1.0,     // Açılış zemini normalden daha geniş (4 + 1 = 5)

  // ── 6. Boşluk & Kenar Ayarları ──
  MIN_EDGE_GAP: 2.5,
  GAP_BONUS_INCREMENT: 0.4,
  GAP_BONUS_DECREMENT: 0.1,
  GAP_BONUS_MAX: 2.0,

  PLATFORM_MAX_X_STEP_START: 1.5,
  PLATFORM_MAX_X_STEP_MAX: 2.5,
  PLATFORM_X_RANGE: 2.2,

  ACTIVE_PLATFORMS_AHEAD: 15,
  DISPOSE_DISTANCE_BEHIND: 20,
  SAFE_PLATFORM_COUNT: 3,

  // ── 7. Kolaylıklar ──
  COYOTE_TIME: 0.08,
  JUMP_BUFFER_TIME: 0.10,

  // ── 8. Dünya & Renkler ──
  FALL_THRESHOLD: -8,
  BG_COLOR: 0x040612,

  THEMES: [
    { name: 'cyan',   neon: '#00f0ff', hex: 0x00f0ff, inner: '#040915' },
    { name: 'amber',  neon: '#ff9900', hex: 0xff9900, inner: '#140a02' },
    { name: 'magenta',neon: '#ff2a8d', hex: 0xff2a8d, inner: '#12040c' },
    { name: 'violet', neon: '#a844ff', hex: 0xa844ff, inner: '#0b0416' },
  ],

  // ── 9. Fener & 3'lü Küme (Batch) Görünürlük Mekaniği ──
  BATCH_SIZE: 3,
  FADE_DURATION: 0.8,
  DARK_VISIBILITY: 0.0,
  CUBE_MIN_VISIBILITY: 0.35,
  BEAM_OPACITY: 0.12,
  VIGNETTE_MAX: 0.5,
  FENER_DEBUG: true,
} as const;

/**
 * Güvenli açılış zemin uzunluğu formülü (sayı elle yazılmaz):
 * runwayLength = START_FORWARD_SPEED * START_SAFE_SECONDS + PLAYER_START_MARGIN + 2
 */
export function calculateRunwayLength(): number {
  return CONFIG.FORWARD_SPEED_START * CONFIG.START_SAFE_SECONDS + CONFIG.PLAYER_START_MARGIN + 2;
}
