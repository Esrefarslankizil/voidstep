import { CONFIG } from './config';

export interface BatchFenerDebugInfo {
  currentBatchIndex: number;
  visibleBatchIndex: number;
  fadingBatchIndex: number | null;
  fadeProgress: number;
  cubePlatformIndex: number | null;
  isGrounded: boolean;
}

/**
 * Mekânsal 3'lü Küme (Batch) Fener Yöneticisi
 *
 * Akış & Kurallar:
 * 1. Oyuncu başlangıç zeminindeyken (Küme 0):
 *    - Önündeki Küme 1 ([1, 2, 3]) tam aydınlıktır (1.0).
 *    - Geri kalanı karanlıktır (0.0). Süre/zamanlayıcı geri sayımı yoktur.
 * 2. Oyuncu başlangıç zemininden ayrıldığı / zıpladığı anda:
 *    - Küme 1'e geçilir. Küme 1 saydamlığı azalarak söner (1.0 -> 0.0).
 *    - Önündeki bir sonraki Küme 2 ([4, 5, 6]) tam aydınlanır!
 * 3. Oyuncu Küme 1 içindeyken (1, 2, 3):
 *    - Altındaki Küme 1 karanlıktır (ezberden zıplar).
 *    - Önündeki Küme 2 tam aydınlıktır (incelenir).
 * 4. Ne zaman ki 3 küpten sonuncusundan (Platform 3, 6, 9, ...) ayrıldı / zıpladı:
 *    - Önündeki küme saydamlığı azalarak söner.
 *    - Bir sonraki küme tam aydınlanır!
 */
export class FenerManager {
  currentBatchIndex = 0;       // Oyuncunun içinde bulunduğu küme (0 = zemin, 1 = [1,2,3], 2 = [4,5,6]...)
  visibleBatchIndex = 1;       // Oyuncunun önünde tam aydınlık olan küme (currentBatchIndex + 1)
  fadingBatchIndex: number | null = null; // Saydamlığı azalarak sönmekte olan küme
  fadeTimer = 0;
  showDebugOverlay = false;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.currentBatchIndex = 0;
    this.visibleBatchIndex = 1;
    this.fadingBatchIndex = null;
    this.fadeTimer = 0;
  }

  /**
   * Kümeden ayrılınca (zemin bitimi veya kümenin 3. bloğundan zıplama) bir sonraki kümeye ilerletir.
   */
  advanceToBatch(newBatchIndex: number): void {
    if (newBatchIndex <= this.currentBatchIndex) return;

    // Önceki aydınlık küme şimdi sönmeye başlar
    this.fadingBatchIndex = this.visibleBatchIndex;
    this.fadeTimer = CONFIG.FADE_DURATION;

    this.currentBatchIndex = newBatchIndex;
    this.visibleBatchIndex = this.currentBatchIndex + 1;

    console.log(
      `%c[FENER KÜME] Küme #${this.currentBatchIndex}'e geçildi! Küme #${this.fadingBatchIndex} saydamlaşarak sönüyor, önündeki Küme #${this.visibleBatchIndex} açıldı!`,
      'color: #00f0ff; font-weight: bold; background: #060a20; padding: 4px; border-left: 3px solid #00f0ff;'
    );
  }

  update(dt: number): void {
    if (this.fadingBatchIndex !== null) {
      this.fadeTimer -= dt;
      if (this.fadeTimer <= 0) {
        this.fadingBatchIndex = null;
        this.fadeTimer = 0;
      }
    }
  }

  /**
   * Sönmekte olan kümenin kararma ilerlemesi (0.0: tam görünür -> 1.0: tamamen söndü)
   */
  get fadeProgress(): number {
    if (this.fadingBatchIndex === null) return 0.0;
    return Math.max(0, Math.min(1.0, 1.0 - this.fadeTimer / CONFIG.FADE_DURATION));
  }

  get vignetteOpacity(): number {
    return this.currentBatchIndex > 0 ? CONFIG.VIGNETTE_MAX : 0.0;
  }

  toggleDebug(): boolean {
    this.showDebugOverlay = !this.showDebugOverlay;
    return this.showDebugOverlay;
  }

  getDebugInfo(cubePlatformIndex: number | null, isGrounded: boolean): BatchFenerDebugInfo {
    return {
      currentBatchIndex: this.currentBatchIndex,
      visibleBatchIndex: this.visibleBatchIndex,
      fadingBatchIndex: this.fadingBatchIndex,
      fadeProgress: this.fadeProgress,
      cubePlatformIndex,
      isGrounded,
    };
  }
}
