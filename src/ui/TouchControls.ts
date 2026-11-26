import { InputCommand, MetaSave } from '../sim/types';

export class TouchAndKeyboardInput {
  private keys = new Set<string>();
  private joyTouchId: number | null = null;
  private joyOriginX = 0;
  private joyOriginY = 0;
  private joyVecX = 0;
  private joyVecY = 0;

  private fireHeld = false;
  private firePressedQueue = false;
  private skillPressedQueue = false;
  private switchPressedQueue = false;
  private interactPressedQueue = false;
  private openBagCb?: () => void;
  private togglePauseCb?: () => void;

  private root: HTMLElement;
  private zoneEl: HTMLDivElement;
  private clusterEl: HTMLDivElement;
  private joyBaseEl: HTMLDivElement;
  private joyKnobEl: HTMLDivElement;
  private fireBtnEl: HTMLButtonElement;
  private skillBtnEl: HTMLButtonElement;
  private switchBtnEl: HTMLButtonElement;
  private switchHoldTimer: number | null = null;
  private settings: MetaSave['settings'];

  constructor(
    root: HTMLElement,
    settings: MetaSave['settings'],
    opts: { onUnlockAudio: () => void; onOpenBag: () => void; onTogglePause: () => void }
  ) {
    this.root = root;
    this.settings = settings;
    this.openBagCb = opts.onOpenBag;
    this.togglePauseCb = opts.onTogglePause;

    root.innerHTML = `
      <div class="touch-zone-left" id="joy-zone"></div>
      <div class="joy-base" id="joy-base"><div class="joy-knob" id="joy-knob"></div></div>
      <div class="touch-right-cluster" id="right-cluster">
        <button class="act-btn btn-switch" id="btn-switch" type="button">
          <span>🔄</span>
          <span class="btn-sub-label">切枪</span>
        </button>
        <button class="act-btn btn-skill" id="btn-skill" type="button">
          <span>⚡</span>
          <span class="btn-sub-label" id="skill-cd-label">技能</span>
        </button>
        <button class="act-btn btn-fire" id="btn-fire" type="button">
          <span id="fire-icon">⚔️</span>
          <span class="btn-sub-label" id="fire-label">攻击</span>
        </button>
      </div>
    `;

    this.zoneEl = root.querySelector('#joy-zone') as HTMLDivElement;
    this.clusterEl = root.querySelector('#right-cluster') as HTMLDivElement;
    this.joyBaseEl = root.querySelector('#joy-base') as HTMLDivElement;
    this.joyKnobEl = root.querySelector('#joy-knob') as HTMLDivElement;
    this.fireBtnEl = root.querySelector('#btn-fire') as HTMLButtonElement;
    this.skillBtnEl = root.querySelector('#btn-skill') as HTMLButtonElement;
    this.switchBtnEl = root.querySelector('#btn-switch') as HTMLButtonElement;

    this.applySettings(settings);

    const maxR = 44;
    this.zoneEl.addEventListener('pointerdown', (e) => {
      opts.onUnlockAudio();
      if (this.joyTouchId !== null) return;
      this.joyTouchId = e.pointerId;
      this.zoneEl.setPointerCapture(e.pointerId);
      this.joyOriginX = e.clientX;
      this.joyOriginY = e.clientY;
      this.joyBaseEl.style.left = `${e.clientX}px`;
      this.joyBaseEl.style.top = `${e.clientY}px`;
      this.joyBaseEl.classList.add('visible');
      this.joyKnobEl.style.transform = 'translate(-50%, -50%)';
    });

    this.zoneEl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joyTouchId) return;
      const dx = e.clientX - this.joyOriginX;
      const dy = e.clientY - this.joyOriginY;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(maxR, dist);
      const ang = Math.atan2(dy, dx);
      const kx = Math.cos(ang) * clamped;
      const ky = Math.sin(ang) * clamped;
      this.joyKnobEl.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
      if (dist / maxR < 0.08) {
        this.joyVecX = 0;
        this.joyVecY = 0;
      } else {
        this.joyVecX = kx / maxR;
        this.joyVecY = ky / maxR;
      }
    });

    const resetJoy = (e: PointerEvent) => {
      if (e.pointerId !== this.joyTouchId) return;
      this.joyTouchId = null;
      this.joyVecX = 0;
      this.joyVecY = 0;
      this.joyBaseEl.classList.remove('visible');
    };
    this.zoneEl.addEventListener('pointerup', resetJoy);
    this.zoneEl.addEventListener('pointercancel', resetJoy);

    this.fireBtnEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      opts.onUnlockAudio();
      this.fireHeld = true;
      this.firePressedQueue = true;
      this.fireBtnEl.classList.add('pressed');
    });
    const endFire = () => {
      this.fireHeld = false;
      this.fireBtnEl.classList.remove('pressed');
    };
    this.fireBtnEl.addEventListener('pointerup', endFire);
    this.fireBtnEl.addEventListener('pointercancel', endFire);
    this.fireBtnEl.addEventListener('pointerleave', endFire);

    this.skillBtnEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      opts.onUnlockAudio();
      this.skillPressedQueue = true;
      this.skillBtnEl.classList.add('pressed');
    });
    const endSkill = () => this.skillBtnEl.classList.remove('pressed');
    this.skillBtnEl.addEventListener('pointerup', endSkill);
    this.skillBtnEl.addEventListener('pointercancel', endSkill);

    this.switchBtnEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      opts.onUnlockAudio();
      this.switchBtnEl.classList.add('pressed');
      let openedBag = false;
      this.switchHoldTimer = window.setTimeout(() => {
        openedBag = true;
        this.openBagCb?.();
      }, 400);
      const onUp = () => {
        this.switchBtnEl.classList.remove('pressed');
        if (this.switchHoldTimer !== null) {
          clearTimeout(this.switchHoldTimer);
          this.switchHoldTimer = null;
        }
        if (!openedBag) this.switchPressedQueue = true;
        this.switchBtnEl.removeEventListener('pointerup', onUp);
        this.switchBtnEl.removeEventListener('pointercancel', onUp);
      };
      this.switchBtnEl.addEventListener('pointerup', onUp);
      this.switchBtnEl.addEventListener('pointercancel', onUp);
    });

    window.addEventListener('keydown', (e) => {
      opts.onUnlockAudio();
      const k = e.key.toLowerCase();
      const kb = this.settings.keyBindings;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', kb.bag].includes(k)) {
        e.preventDefault();
      }
      if (!this.keys.has(k)) {
        if (k === kb.fire || k === ' ') this.firePressedQueue = true;
        if (k === kb.interact || k === 'enter') this.interactPressedQueue = true;
        if (k === kb.skill || k === 'shift') this.skillPressedQueue = true;
        if (k === kb.switch || k === 'e') this.switchPressedQueue = true;
        if (k === kb.bag) this.openBagCb?.();
        if (k === 'escape') this.togglePauseCb?.();
      }
      this.keys.add(k);
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
  }

  applySettings(settings: MetaSave['settings']): void {
    this.settings = settings;
    const sc = Math.max(0.75, Math.min(1.4, settings.buttonScale ?? 1));
    const swap = Boolean(settings.swapHands);

    // Swap left/right handed touch zones cleanly!
    if (swap) {
      this.zoneEl.style.left = '52%';
      this.clusterEl.style.right = 'auto';
      this.clusterEl.style.left = 'max(18px, env(safe-area-inset-left))';
    } else {
      this.zoneEl.style.left = '0';
      this.clusterEl.style.left = 'auto';
      this.clusterEl.style.right = 'max(18px, env(safe-area-inset-right))';
    }

    const off = settings.touchOffsets;
    this.fireBtnEl.style.transform = `translate(${off.fire.x}px, ${off.fire.y}px) scale(${sc})`;
    this.skillBtnEl.style.transform = `translate(${off.skill.x}px, ${off.skill.y}px) scale(${sc})`;
    this.switchBtnEl.style.transform = `translate(${off.switch.x}px, ${off.switch.y}px) scale(${sc})`;
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? 'block' : 'none';
  }

  updateButtonVisuals(opts: {
    showInteract: boolean;
    interactLabel?: string;
    skillCooldown: number;
    skillCharges: number;
  }): void {
    const iconEl = this.fireBtnEl.querySelector('#fire-icon')!;
    const labelEl = this.fireBtnEl.querySelector('#fire-label')!;
    const cdEl = this.skillBtnEl.querySelector('#skill-cd-label')!;

    if (opts.showInteract) {
      iconEl.textContent = '👋';
      labelEl.textContent = opts.interactLabel ?? '互动';
    } else {
      iconEl.textContent = '⚔️';
      labelEl.textContent = '攻击';
    }

    cdEl.textContent = opts.skillCharges > 0 ? '技能' : `${opts.skillCooldown.toFixed(1)}s`;
    this.skillBtnEl.style.opacity = opts.skillCharges > 0 ? '1' : '0.55';
  }

  pollCommand(playerId = 'p1'): InputCommand {
    let mx = this.joyVecX;
    let my = this.joyVecY;
    if (this.keys.has('w') || this.keys.has('arrowup')) my -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) my += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1;

    const kb = this.settings.keyBindings;
    const fireHeld = this.fireHeld || this.keys.has(kb.fire) || this.keys.has(' ');
    const cmd: InputCommand = {
      playerId,
      moveX: mx,
      moveY: my,
      fireHeld,
      firePressed: this.firePressedQueue,
      skillPressed: this.skillPressedQueue,
      switchPressed: this.switchPressedQueue,
      interactPressed: this.interactPressedQueue
    };

    this.firePressedQueue = false;
    this.skillPressedQueue = false;
    this.switchPressedQueue = false;
    this.interactPressedQueue = false;
    return cmd;
  }
}
