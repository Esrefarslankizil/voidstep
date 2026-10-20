export type InputCallbacks = {
  onJump: () => void;
  onRestart: () => void;
  onToggleLantern?: () => void;
  onCycleLevel?: () => void;
  onToggleDebug?: () => void;
};

/**
 * Yatay Mod Ekrandaki Dokunmatik Tuşlar (On-Screen Virtual Controls)
 * ve Geliştirici Klavye Kontrolleri.
 *
 * Çoklu Dokunma (Multi-Touch):
 * - Pointer Events (pointerdown/up/cancel/leave) ile her tuş pointerId ile bağımsız izlenir.
 * - Sol parmakla zıplarken aynı anda sağ parmakla yön verilebilir.
 * - İki yön tuşuna birden basılırsa birbirini iptal eder (yön = 0).
 * - Zıplama basılı tutunca tekrarlamaz, her basış tek zıplamadır.
 */
export class InputManager {
  private callbacks: InputCallbacks;
  private isGameOver = false;

  // Klavye tuşları
  private keys = new Set<string>();

  // Dokunmatik tuş pointer takibi
  private leftPointerId: number | null = null;
  private rightPointerId: number | null = null;
  private jumpPointerId: number | null = null;

  constructor(callbacks: InputCallbacks) {
    this.callbacks = callbacks;
    this.setupKeyboard();
    this.setupOnScreenButtons();
    this.setupRestartButton();
    this.preventGestures();
  }

  setGameOver(value: boolean): void {
    this.isGameOver = value;
    // Oyun bitince basılı kalan durumları sıfırla
    if (value) {
      this.leftPointerId = null;
      this.rightPointerId = null;
      this.jumpPointerId = null;
      this.clearButtonStyles();
    }
  }

  /**
   * Her kare yatay girdi yönünü döndürür: -1 (sol), 0 (dur), 1 (sağ).
   * İki tuşa birden basılırsa birbirini iptal eder.
   */
  getStrafeDirection(): number {
    let dir = 0;

    // 1. Ekrandaki dokunmatik tuşlar
    if (this.leftPointerId !== null) dir -= 1;
    if (this.rightPointerId !== null) dir += 1;

    // 2. Klavye (Geliştirme için)
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) dir -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) dir += 1;

    // Clamping: -1, 0, 1
    if (dir < -1) dir = -1;
    if (dir > 1) dir = 1;

    return dir;
  }

  // ── Ekrandaki Dokunmatik Tuşlar (Pointer Events ile Çoklu Dokunma) ──
  private setupOnScreenButtons(): void {
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnJump = document.getElementById('btn-jump');

    // SOLA OK TUŞU (◀)
    if (btnLeft) {
      btnLeft.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.isGameOver) return;
        this.leftPointerId = e.pointerId;
        btnLeft.classList.add('active');
        btnLeft.setPointerCapture?.(e.pointerId);
      });

      const releaseLeft = (e: PointerEvent) => {
        if (this.leftPointerId === e.pointerId) {
          this.leftPointerId = null;
          btnLeft.classList.remove('active');
          btnLeft.releasePointerCapture?.(e.pointerId);
        }
      };
      btnLeft.addEventListener('pointerup', releaseLeft);
      btnLeft.addEventListener('pointercancel', releaseLeft);
      btnLeft.addEventListener('pointerleave', releaseLeft);
    }

    // SAĞA OK TUŞU (▶)
    if (btnRight) {
      btnRight.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.isGameOver) return;
        this.rightPointerId = e.pointerId;
        btnRight.classList.add('active');
        btnRight.setPointerCapture?.(e.pointerId);
      });

      const releaseRight = (e: PointerEvent) => {
        if (this.rightPointerId === e.pointerId) {
          this.rightPointerId = null;
          btnRight.classList.remove('active');
          btnRight.releasePointerCapture?.(e.pointerId);
        }
      };
      btnRight.addEventListener('pointerup', releaseRight);
      btnRight.addEventListener('pointercancel', releaseRight);
      btnRight.addEventListener('pointerleave', releaseRight);
    }

    // BÜYÜK ZIPLAMA TUŞU (▲)
    if (btnJump) {
      btnJump.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.isGameOver) return;

        this.jumpPointerId = e.pointerId;
        btnJump.classList.add('active');
        btnJump.setPointerCapture?.(e.pointerId);

        // Her basış tek zıplama
        this.callbacks.onJump();

        // Titreşim (varsa 15ms)
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(15);
          } catch (_) {}
        }
      });

      const releaseJump = (e: PointerEvent) => {
        if (this.jumpPointerId === e.pointerId) {
          this.jumpPointerId = null;
          btnJump.classList.remove('active');
          btnJump.releasePointerCapture?.(e.pointerId);
        }
      };
      btnJump.addEventListener('pointerup', releaseJump);
      btnJump.addEventListener('pointercancel', releaseJump);
      btnJump.addEventListener('pointerleave', releaseJump);
    }
  }

  // ── Game Over Yeniden Başlatma Butonu ──
  private setupRestartButton(): void {
    const btnRestart = document.getElementById('btn-restart');
    if (!btnRestart) return;

    let lastRestartTimestamp = 0;
    const triggerRestart = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      if (now - lastRestartTimestamp < 500) {
        return; // Hızlı mükerrer basışları engelle (debounce)
      }
      lastRestartTimestamp = now;

      if (this.isGameOver) {
        this.callbacks.onRestart();
      }
    };

    btnRestart.addEventListener('click', triggerRestart);
  }

  private clearButtonStyles(): void {
    document.getElementById('btn-left')?.classList.remove('active');
    document.getElementById('btn-right')?.classList.remove('active');
    document.getElementById('btn-jump')?.classList.remove('active');
  }

  // ── Klavye (Geliştirme için) ──
  private setupKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);

      if (this.isGameOver) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          this.callbacks.onRestart();
        }
        return;
      }

      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        this.callbacks.onJump();
      }

      if (e.code === 'KeyF') {
        e.preventDefault();
        this.callbacks.onToggleLantern?.();
      }

      if (e.code === 'KeyL') {
        e.preventDefault();
        this.callbacks.onCycleLevel?.();
      }

      if (e.code === 'KeyD') {
        e.preventDefault();
        this.callbacks.onToggleDebug?.();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.leftPointerId = null;
      this.rightPointerId = null;
      this.jumpPointerId = null;
      this.clearButtonStyles();
    });
  }

  private preventGestures(): void {
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mobil tarayıcılarda sayfayı aşağı çekerek yenilemeyi (Pull-to-Refresh)
    // ve ekran kaydırma jestlerini kesin olarak engelle
    window.addEventListener(
      'touchmove',
      (e) => {
        // Sayfanın yenilenmesini veya kaymasını engelle
        if (e.cancelable) {
          e.preventDefault();
        }
      },
      { passive: false }
    );

    // Çift dokunma zoom engeli
    let lastTouch = 0;
    window.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouch <= 250) {
        e.preventDefault();
      }
      lastTouch = now;
    }, { passive: false });
  }
}
