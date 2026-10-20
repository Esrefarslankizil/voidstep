const INSTALL_HINT_KEY = 'voidstep_install_hint_dismissed';

export function isStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as any).standalone)
  );
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isFullscreenSupported(): boolean {
  const doc = document as any;
  const docEl = document.documentElement as any;
  return Boolean(
    doc.fullscreenEnabled ||
    doc.webkitFullscreenEnabled ||
    docEl.requestFullscreen ||
    docEl.webkitRequestFullscreen
  );
}

export function isFullscreenActive(): boolean {
  const doc = document as any;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

/**
 * Tarayıcı tam ekran durumunu açıp kapatır ve yatay yönü kilitler
 */
export async function toggleFullscreen(): Promise<void> {
  const doc = document as any;
  const docEl = document.documentElement as any;

  try {
    const isFull = isFullscreenActive();

    if (!isFull) {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      }

      // Destekleniyorsa ekran yönünü yatay olarak kilitle
      if (screen.orientation && 'lock' in screen.orientation) {
        try {
          await (screen.orientation as any).lock('landscape');
        } catch (_) {}
      }
    } else {
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      }
    }
  } catch (_) {
    // Kullanıcı jesti veya izin hatasında sessizce geç
  }
}

/**
 * İlk dokunuşta otomatik tam ekran isteği (özellikle Android Chrome için)
 */
export async function tryAutoFullscreen(): Promise<void> {
  if (isStandaloneMode()) return;
  if (isFullscreenActive()) return;

  const docEl = document.documentElement as any;

  try {
    if (docEl.requestFullscreen) {
      await docEl.requestFullscreen();
      if (screen.orientation && 'lock' in screen.orientation) {
        try {
          await (screen.orientation as any).lock('landscape');
        } catch (_) {}
      }
    } else if (docEl.webkitRequestFullscreen) {
      await docEl.webkitRequestFullscreen();
    }
  } catch (_) {
    // Reddedilirse veya desteklenmiyorsa oyun normal akışına devam eder
  }
}

/**
 * Kullanıcı hareketi anında bir defalık otomatik tam ekran denemesi
 */
let autoFullscreenBound = false;
export function setupAutoFullscreenOnGesture(): void {
  if (autoFullscreenBound) return;
  autoFullscreenBound = true;

  const onFirstTouch = () => {
    tryAutoFullscreen();
    window.removeEventListener('pointerdown', onFirstTouch);
    window.removeEventListener('touchstart', onFirstTouch);
    window.removeEventListener('click', onFirstTouch);
  };

  window.addEventListener('pointerdown', onFirstTouch, { once: true, passive: true });
  window.addEventListener('touchstart', onFirstTouch, { once: true, passive: true });
  window.addEventListener('click', onFirstTouch, { once: true, passive: true });
}

/**
 * Tam ekran butonu ve kurulum ipucu yöneticisi
 */
export class FullscreenManager {
  private btnFullscreen: HTMLButtonElement | null;
  private btnFullscreenGameOver: HTMLButtonElement | null;
  private installHint: HTMLElement | null;

  constructor() {
    this.btnFullscreen = document.getElementById('btn-fullscreen') as HTMLButtonElement | null;
    this.btnFullscreenGameOver = document.getElementById('btn-fullscreen-gameover') as HTMLButtonElement | null;
    this.installHint = document.getElementById('install-hint');

    this.initFullscreenButtons();
    this.initInstallHint();
  }

  private initFullscreenButtons(): void {
    const isSupported = isFullscreenSupported();

    const buttons = [this.btnFullscreen, this.btnFullscreenGameOver].filter(Boolean) as HTMLButtonElement[];

    if (!isSupported) {
      buttons.forEach((btn) => {
        btn.style.display = 'none';
      });
      return;
    }

    buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFullscreen();
      });
    });

    // Tam ekran durumu değiştikçe butonları güncelle
    const updateButtons = () => {
      const isFull = isFullscreenActive();
      if (this.btnFullscreen) {
        this.btnFullscreen.textContent = isFull ? '🗗' : '⛶';
        this.btnFullscreen.title = isFull ? 'Tam Ekrandan Çık' : 'Tam Ekran';
      }
      if (this.btnFullscreenGameOver) {
        this.btnFullscreenGameOver.textContent = isFull ? 'Tam Ekrandan Çık 🗗' : 'Tam Ekran ⛶';
      }
    };

    document.addEventListener('fullscreenchange', updateButtons);
    document.addEventListener('webkitfullscreenchange', updateButtons);
    updateButtons();
  }

  private initInstallHint(): void {
    if (!this.installHint) return;

    // Zaten standalone (PWA/Ana Ekrandan) veya tam ekranda açıldıysa gösterme
    if (isStandaloneMode()) {
      this.installHint.classList.add('hidden');
      return;
    }

    // Kapatma butonu dinleyicisi
    const closeBtn = document.getElementById('btn-close-install-hint');
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismissInstallHint();
    });
  }

  /**
   * Eğitim tamamlandıktan sonra veya uygun anda kurulum ipucunu gösterir
   */
  showInstallHintIfNeeded(): void {
    if (!this.installHint || isStandaloneMode()) return;

    try {
      if (localStorage.getItem(INSTALL_HINT_KEY) === 'true') {
        return;
      }
    } catch (_) {}

    // iOS veya mobil tarayıcıda ipucunu göster
    this.installHint.classList.remove('hidden');

    // 8 saniye sonra otomatik kaybolsun
    setTimeout(() => {
      if (this.installHint && !this.installHint.classList.contains('hidden')) {
        this.dismissInstallHint();
      }
    }, 8000);
  }

  private dismissInstallHint(): void {
    if (this.installHint) {
      this.installHint.classList.add('hidden');
    }
    try {
      localStorage.setItem(INSTALL_HINT_KEY, 'true');
    } catch (_) {}
  }
}
