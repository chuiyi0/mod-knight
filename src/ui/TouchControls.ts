import { InputCommand } from '../sim/types';

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

  private joyBaseEl: HTMLDivElement;
  private joyKnobEl: HTMLDivElement;
  private fireBtnEl: HTMLButtonElement;
  private skillBtnEl: HTMLButtonElement;
  private switchBtnEl: HTMLButtonElement;
  private switchHoldTimer: number | null = null;

  constructor(
    root: HTMLElement,
    opts: { onUnlockAudio: () => void; onOpenBag: () => void; onTogglePause: () => void }
  ) {
    this.openBagCb = opts.onOpenBag;
    this.togglePauseCb = opts.onTogglePause;

    root.innerHTML = `
      <div class="touch-zone-left" id="joy-zone"></div>
      <div class="joy-base" id="joy-base"><div class="joy-knob" id="joy-knob"></div></div>
      <div class="touch-right-cluster">
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

    const zone = root.querySelector('#joy-zone') as HTMLDivElement;
    this.joyBaseEl = root.querySelector('#joy-base') as HTMLDivElement;
    this.joyKnobEl = root.querySelector('#joy-knob') as HTMLDivElement;
    this.fireBtnEl = root.querySelector('#btn-fire') as HTMLButtonElement;
    this.skillBtnEl = root.querySelector('#btn-skill') as HTMLButtonElement;
    this.switchBtnEl = root.querySelector('#btn-switch') as HTMLButtonElement;

    // Floating virtual joystick on left half of screen
    const maxR = 44;
    zone.addEventListener('pointerdown', (e) => {
      opts.onUnlockAudio();
      if (this.joyTouchId !== null) return;
      this.joyTouchId = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      this.joyOriginX = e.clientX;
      this.joyOriginY = e.clientY;
      this.joyBaseEl.style.left = `${e.clientX}px`;
      this.joyBaseEl.style.top = `${e.clientY}px`;
      this.joyBaseEl.classList.add('visible');
      this.joyKnobEl.style.transform = 'translate(-50%, -50%)';
    });

    zone.addEventListener('pointermove', (e) => {
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
    zone.addEventListener('pointerup', resetJoy);
    zone.addEventListener('pointercancel', resetJoy);

    // Fire / Interact main button
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

    // Skill button
    this.skillBtnEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      opts.onUnlockAudio();
      this.skillPressedQueue = true;
      this.skillBtnEl.classList.add('pressed');
    });
    const endSkill = () => this.skillBtnEl.classList.remove('pressed');
    this.skillBtnEl.addEventListener('pointerup', endSkill);
    this.skillBtnEl.addEventListener('pointercancel', endSkill);

    // Switch weapon (tap) / Open sticker bag (long-press 400ms)
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

    // Keyboard bindings for PC testing
    window.addEventListener('keydown', (e) => {
      opts.onUnlockAudio();
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) {
        e.preventDefault();
      }
      if (!this.keys.has(k)) {
        if (k === 'j' || k === ' ') this.firePressedQueue = true;
        if (k === 'f' || k === 'enter') this.interactPressedQueue = true;
        if (k === 'k' || k === 'shift') this.skillPressedQueue = true;
        if (k === 'q' || k === 'e') this.switchPressedQueue = true;
        if (k === 'tab') {
          e.preventDefault();
          this.openBagCb?.();
        }
        if (k === 'escape') {
          this.togglePauseCb?.();
        }
      }
      this.keys.add(k);
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
  }

  updateButtonVisuals(opts: {
    showInteract: boolean;
    interactLabel?: string;
    skillCooldown: number;
    skillCharges: number;
    isLobby: boolean;
  }): void {
    const iconEl = this.fireBtnEl.querySelector('#fire-icon')!;
    const labelEl = this.fireBtnEl.querySelector('#fire-label')!;
    const cdEl = this.skillBtnEl.querySelector('#skill-cd-label')!;

    if (opts.showInteract) {
      iconEl.textContent = '👋';
      labelEl.textContent = opts.interactLabel ?? '互动';
    } else if (opts.isLobby) {
      iconEl.textContent = '👋';
      labelEl.textContent = '互动';
    } else {
      iconEl.textContent = '⚔️';
      labelEl.textContent = '攻击';
    }

    if (opts.isLobby) {
      this.skillBtnEl.style.display = 'none';
      this.switchBtnEl.style.display = 'none';
    } else {
      this.skillBtnEl.style.display = 'flex';
      this.switchBtnEl.style.display = 'flex';
      cdEl.textContent = opts.skillCharges > 0 ? '技能' : `${opts.skillCooldown.toFixed(1)}s`;
      this.skillBtnEl.style.opacity = opts.skillCharges > 0 ? '1' : '0.55';
    }
  }

  pollCommand(playerId = 'p1'): InputCommand {
    let mx = this.joyVecX;
    let my = this.joyVecY;
    if (this.keys.has('w') || this.keys.has('arrowup')) my -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) my += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1;

    const fireHeld = this.fireHeld || this.keys.has('j') || this.keys.has(' ');
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
