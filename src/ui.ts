import { BatchFenerDebugInfo } from './fener';

const HIGH_SCORE_KEY = 'voidstep_highscore';

/**
 * UI Yöneticisi: HUD, 3'lü Küme Göstergesi, Ekrandaki Tuşlar, Dikey Uyarısı ve Lüks Game Over Ekranı
 */
export class UI {
  private overlay: HTMLElement;
  private scoreDisplay: HTMLElement;
  private speedIndicator: HTMLElement | null;
  private finalScore: HTMLElement;
  private orientationWarning: HTMLElement | null;
  private touchControls: HTMLElement | null;

  // 3'lü Küme (Batch) HUD Elementleri
  private lanternHud: HTMLElement | null;
  private batchNum: HTMLElement | null;

  // Game Over İstatistik & Rekor Elementleri
  private bestScore: HTMLElement | null;
  private newRecordBadge: HTMLElement | null;
  private statCheckpoints: HTMLElement | null;
  private statSpeed: HTMLElement | null;
  private btnShareScore: HTMLButtonElement | null;

  // Vignette & Debug
  private vignetteOverlay: HTMLElement | null;
  private fenerDebugOverlay: HTMLElement | null;

  private highScore = 0;

  constructor() {
    this.overlay = document.getElementById('overlay')!;
    this.scoreDisplay = document.getElementById('score-display')!;
    this.speedIndicator = document.getElementById('speed-indicator');
    this.finalScore = document.getElementById('final-score')!;
    this.orientationWarning = document.getElementById('orientation-warning');
    this.touchControls = document.getElementById('touch-controls');

    this.lanternHud = document.getElementById('lantern-hud');
    this.batchNum = document.getElementById('batch-num');

    this.bestScore = document.getElementById('best-score');
    this.newRecordBadge = document.getElementById('new-record-badge');
    this.statCheckpoints = document.getElementById('stat-checkpoints');
    this.statSpeed = document.getElementById('stat-speed');
    this.btnShareScore = document.getElementById('btn-share-score') as HTMLButtonElement | null;

    this.vignetteOverlay = document.getElementById('vignette-overlay');
    this.fenerDebugOverlay = document.getElementById('fener-debug-overlay');

    this.loadHighScore();
  }

  private loadHighScore(): void {
    try {
      const saved = localStorage.getItem(HIGH_SCORE_KEY);
      if (saved) {
        this.highScore = parseInt(saved, 10) || 0;
      }
    } catch (_) {}
  }

  updateScore(distance: number): void {
    this.scoreDisplay.innerHTML = `${Math.floor(distance)}<span class="unit">m</span>`;
  }

  updateSpeed(speed: number): void {
    if (this.speedIndicator) {
      this.speedIndicator.textContent = `${speed.toFixed(1)} m/s`;
    }
  }

  /**
   * 3'lü Küme (Batch) göstergesini günceller
   */
  updateBatchHUD(currentBatch: number, visibleBatch: number, isFading: boolean): void {
    if (this.batchNum) {
      this.batchNum.textContent = `#${visibleBatch}`;
    }
    if (this.lanternHud) {
      this.lanternHud.classList.toggle('fading', isFading);
      this.lanternHud.classList.toggle('light-on', !isFading);
    }
  }

  /**
   * Karanlık atmosfer CSS vignette opaklığını günceller (0.0 -> 0.5)
   */
  updateVignette(opacity: number): void {
    if (!this.vignetteOverlay) return;
    this.vignetteOverlay.style.opacity = opacity.toFixed(2);
  }

  /**
   * Ekranda geliştirici debug HUD panelini günceller (D Tuşu)
   */
  updateDebugOverlay(info: BatchFenerDebugInfo, show: boolean): void {
    if (!this.fenerDebugOverlay) return;
    if (!show) {
      this.fenerDebugOverlay.classList.add('hidden');
      return;
    }
    this.fenerDebugOverlay.classList.remove('hidden');
    this.fenerDebugOverlay.innerHTML = `
      <div style="font-weight:bold; color:#ffd700; margin-bottom:4px;">[3'LÜ KÜME DEBUG] <span style="font-size:10px; color:#888;">(D ile gizle)</span></div>
      <div>Mevcut Küme: <strong style="color:#00f0ff;">#${info.currentBatchIndex}</strong> ${info.currentBatchIndex === 0 ? '(Açılış Zemini)' : ''}</div>
      <div>Öndeki Aydınlık Küme: <strong style="color:#00ff88;">#${info.visibleBatchIndex}</strong></div>
      <div>Sönen Küme: ${info.fadingBatchIndex !== null ? `<span style="color:#ff9900;">#${info.fadingBatchIndex} (Kalan: %${Math.round((1 - info.fadeProgress) * 100)})</span>` : 'Yok'}</div>
      <div>Küpün Konumu: ${info.cubePlatformIndex !== null ? `#${info.cubePlatformIndex}` : 'Havada'}</div>
    `;
  }

  showControls(show: boolean): void {
    if (!this.touchControls) return;
    if (show) {
      this.touchControls.classList.remove('hidden');
    } else {
      this.touchControls.classList.add('hidden');
    }
  }

  /**
   * Lüks Game Over Ekranı: Rolling skor animasyonu, yüksek rekor takibi,
   * ulaşılan kontrol noktası ve hız istatistikleri.
   */
  showGameOver(distance: number, checkpointsCount = 0, maxSpeed = 5.0): void {
    const currentDist = Math.floor(distance);
    const isNewRecord = currentDist > this.highScore && currentDist > 0;

    if (isNewRecord) {
      this.highScore = currentDist;
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
      } catch (_) {}
    }

    // Yeni Rekor Rozeti
    if (this.newRecordBadge) {
      if (isNewRecord) {
        this.newRecordBadge.classList.remove('hidden');
      } else {
        this.newRecordBadge.classList.add('hidden');
      }
    }

    // İstatistik Değerleri
    if (this.bestScore) {
      this.bestScore.innerHTML = `${this.highScore}<span class="stat-unit">m</span>`;
    }
    if (this.statCheckpoints) {
      this.statCheckpoints.textContent = `Küme #${Math.max(1, checkpointsCount)}`;
    }
    if (this.statSpeed) {
      this.statSpeed.innerHTML = `${maxSpeed.toFixed(1)}<span class="stat-unit">m/s</span>`;
    }

    // Skor Rolling Animasyonu (0 -> currentDist)
    this.animateCounter(this.finalScore, currentDist, 'm', 600);

    // Paylaşım Butonu
    this.setupShareButton(currentDist);

    // Haptik Titreşim Geri Bildirimi
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([35, 60, 35]);
      } catch (_) {}
    }

    this.overlay.classList.remove('hidden');
    this.showControls(false);
  }

  private animateCounter(element: HTMLElement, targetValue: number, suffix = 'm', duration = 600): void {
    const startTime = performance.now();
    const update = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      // easeOutExpo formülü
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.floor(eased * targetValue);
      element.innerHTML = `${current}<span class="stat-unit">${suffix}</span>`;
      if (progress < 1.0) {
        requestAnimationFrame(update);
      }
    };
    requestAnimationFrame(update);
  }

  private setupShareButton(distance: number): void {
    if (!this.btnShareScore) return;

    this.btnShareScore.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const shareText = `VOIDSTEP'te ${distance} metre koştum! Beni geçebilir misin?`;

      if (typeof navigator !== 'undefined' && navigator.share) {
        navigator.share({
          title: 'VOIDSTEP',
          text: shareText,
          url: window.location.href,
        }).catch(() => {});
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(`${shareText} ${window.location.href}`);
        const span = this.btnShareScore?.querySelector('span');
        if (span) {
          const prevText = span.textContent;
          span.textContent = 'Kopyalandı! ✓';
          setTimeout(() => {
            if (span) span.textContent = prevText;
          }, 2000);
        }
      }
    };
  }

  hideGameOver(): void {
    this.overlay.classList.add('hidden');
  }

  setOrientationWarning(show: boolean): void {
    if (!this.orientationWarning) return;
    if (show) {
      this.orientationWarning.classList.remove('hidden');
      this.showControls(false);
    } else {
      this.orientationWarning.classList.add('hidden');
    }
  }

  showStartHint(): void {
    const hint = document.getElementById('start-hint');
    if (!hint) return;
    hint.classList.remove('hidden');
    hint.style.animation = 'none';
    void hint.offsetWidth;
    hint.style.animation = '';
    setTimeout(() => {
      hint.classList.add('hidden');
    }, 1500);
  }

  reset(): void {
    this.hideGameOver();
    this.updateScore(0);
    this.updateSpeed(5.0);
    this.updateBatchHUD(0, 1, false);
    this.showControls(true);
  }
}
