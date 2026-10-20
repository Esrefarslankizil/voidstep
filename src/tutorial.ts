import './tutorial.css';

const STORAGE_KEY = 'voidstep_tutorial_done';
let inMemoryTutorialDone = false;

export function hasSeenTutorial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch (_) {
    return inMemoryTutorialDone;
  }
}

export function markTutorialDone(): void {
  inMemoryTutorialDone = true;
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch (_) {
    // LocalStorage kapalıysa sessizce bellek durumunda tut
  }
}

export function resetTutorialStatus(): void {
  inMemoryTutorialDone = false;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
}

interface TutorialStep {
  title: string;
  instruction: string;
  stageHtml: string;
}

const STEPS: TutorialStep[] = [
  {
    title: 'ZIPLA',
    instruction: 'Zıplamak için sol alttaki ▲ tuşuna bas.',
    stageHtml: `
      <div class="stage-step-1">
        <div class="demo-btn demo-btn-jump">▲</div>
        <div class="css-cube css-cube-1"></div>
        <div class="css-platform css-platform-1"></div>
      </div>
    `,
  },
  {
    title: 'YÖN VER',
    instruction: 'Sağa sola kaymak için sağ alttaki ◀ ve ▶ tuşlarını kullan.',
    stageHtml: `
      <div class="stage-step-2">
        <div class="css-cube css-cube-2"></div>
        <div class="css-platform css-platform-2"></div>
        <div class="demo-arrow-group">
          <div class="demo-btn demo-btn-arrow btn-l">◀</div>
          <div class="demo-btn demo-btn-arrow btn-r">▶</div>
        </div>
      </div>
    `,
  },
  {
    title: 'BOŞLUKLARDA ZIPLA',
    instruction: 'Platformlar arasındaki boşluklara düşme, tam vaktinde zıpla!',
    stageHtml: `
      <div class="stage-step-3">
        <div class="css-platform css-plat-left"></div>
        <div class="css-cube css-cube-gap"></div>
        <div class="css-platform css-plat-right"></div>
      </div>
    `,
  },
  {
    title: "FENER & 3'LÜ KÜME",
    instruction: "Bulunduğun 3 blok karanlık, önündeki 3 blok aydınlıktır. 3. bloktan zıplayınca öndekiler söner, bir sonraki 3'lü açılır!",
    stageHtml: `
      <div class="stage-step-4">
        <div class="batch-card batch-dark">
          <div class="batch-card-header">
            <span class="batch-state-icon">👁‍🗨</span>
            <span class="batch-title">KARANLIK KÜME</span>
          </div>
          <div class="batch-plats-row">
            <div class="batch-plat b-dark">1</div>
            <div class="batch-plat b-dark">2</div>
            <div class="batch-plat b-dark">3</div>
          </div>
        </div>

        <div class="batch-divider">
          <span class="batch-arrow-icon">➔</span>
          <span class="batch-subtext">3. BLOKTA ZIPLA</span>
        </div>

        <div class="batch-card batch-lit">
          <div class="batch-card-header">
            <span class="batch-state-icon beam-pulse">✦</span>
            <span class="batch-title">AYDINLIK KÜME</span>
          </div>
          <div class="batch-plats-row">
            <div class="batch-plat b-lit">4</div>
            <div class="batch-plat b-lit">5</div>
            <div class="batch-plat b-lit">6</div>
          </div>
          <div class="batch-fade-alert">SÖNÜYOR!</div>
        </div>

        <div class="batch-cube-runner"></div>
      </div>
    `,
  },
];

export class Tutorial {
  private currentStep = 0;
  private overlayEl: HTMLElement | null = null;
  private onCompleteCallback: () => void;

  constructor(onComplete: () => void) {
    this.onCompleteCallback = onComplete;
  }

  show(): void {
    // Varsa önceki overlay'i temizle
    this.destroy();

    this.currentStep = 0;

    const dotsHtml = STEPS.map(
      (_, i) => `<span class="tut-dot${i === 0 ? ' active' : ''}"></span>`
    ).join('');

    const overlay = document.createElement('div');
    overlay.id = 'tutorial-overlay';
    overlay.innerHTML = `
      <div class="tutorial-modal">
        <span class="tut-corner tl"></span>
        <span class="tut-corner tr"></span>
        <span class="tut-corner bl"></span>
        <span class="tut-corner br"></span>

        <div class="tutorial-header">
          <span class="tutorial-badge">EĞİTİM <span id="tut-step-num">1</span>/${STEPS.length}</span>
          <h3 id="tut-title" class="tutorial-step-title">ZIPLA</h3>
        </div>

        <div id="tut-stage-container" class="tutorial-stage"></div>

        <p id="tut-desc" class="tutorial-instruction"></p>

        <div class="tutorial-footer">
          <div class="tutorial-dots">
            ${dotsHtml}
          </div>

          <div class="tutorial-actions">
            <button type="button" id="tut-btn-skip" class="tut-btn tut-btn-skip">GEÇ</button>
            <button type="button" id="tut-btn-next" class="tut-btn tut-btn-next">İLERİ</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('game-container')!.appendChild(overlay);
    this.overlayEl = overlay;

    // Buton dinleyicileri
    const btnSkip = overlay.querySelector('#tut-btn-skip') as HTMLButtonElement;
    const btnNext = overlay.querySelector('#tut-btn-next') as HTMLButtonElement;

    btnSkip.addEventListener('click', (e) => {
      e.stopPropagation();
      this.finish();
    });

    btnNext.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.currentStep < STEPS.length - 1) {
        this.currentStep++;
        this.renderStep();
      } else {
        this.finish();
      }
    });

    this.renderStep();
  }

  private renderStep(): void {
    if (!this.overlayEl) return;

    const step = STEPS[this.currentStep];

    const numEl = this.overlayEl.querySelector('#tut-step-num');
    const titleEl = this.overlayEl.querySelector('#tut-title');
    const stageContainer = this.overlayEl.querySelector('#tut-stage-container');
    const descEl = this.overlayEl.querySelector('#tut-desc');
    const nextBtn = this.overlayEl.querySelector('#tut-btn-next') as HTMLButtonElement;
    const dots = this.overlayEl.querySelectorAll('.tut-dot');

    if (numEl) numEl.textContent = `${this.currentStep + 1}`;
    if (titleEl) titleEl.textContent = step.title;
    if (stageContainer) stageContainer.innerHTML = step.stageHtml;
    if (descEl) descEl.textContent = step.instruction;

    // Noktaları güncelle
    dots.forEach((dot, idx) => {
      if (idx === this.currentStep) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });

    // Son adımda "İLERİ" butonu "BAŞLA" olur
    if (this.currentStep === STEPS.length - 1) {
      nextBtn.textContent = 'BAŞLA';
      nextBtn.className = 'tut-btn tut-btn-start';
    } else {
      nextBtn.textContent = 'İLERİ';
      nextBtn.className = 'tut-btn tut-btn-next';
    }
  }

  finish(): void {
    markTutorialDone();
    this.destroy();
    this.onCompleteCallback();
  }

  destroy(): void {
    if (this.overlayEl) {
      this.overlayEl.remove();
      this.overlayEl = null;
    }
  }
}
