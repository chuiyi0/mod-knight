/**
 * Zero-asset WebAudio 8-bit/16-bit Chiptune SFX & Retro Groove Synthesizer.
 * Keeps APK tiny (<15MB) and gives every quirk weapon its signature hilarious sound!
 */
export class RetroAudioEngine {
  private ctx: AudioContext | null = null;
  public sfxEnabled = true;
  public bgmEnabled = true;
  private bgmInterval: number | null = null;
  private bgmStep = 0;

  private ensureContext(): AudioContext | null {
    if (!this.sfxEnabled && !this.bgmEnabled) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  unlock(): void {
    this.ensureContext();
  }

  play(sound: string, pitch = 1): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const tone = (
      type: OscillatorType,
      f1: number,
      f2: number,
      dur: number,
      gainVal = 0.14,
      delay = 0
    ) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f1 * pitch, now + delay);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, f2 * pitch), now + delay + dur);
      g.gain.setValueAtTime(gainVal, now + delay);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + dur + 0.01);
    };

    switch (sound) {
      case 'shoot':
        tone('square', 420, 140, 0.07, 0.09);
        break;
      case 'laser':
        tone('sawtooth', 880, 260, 0.13, 0.1);
        break;
      case 'melee':
        tone('triangle', 320, 110, 0.09, 0.14);
        break;
      case 'fish':
        // Wet salted fish slap!
        tone('triangle', 220, 75, 0.11, 0.18);
        tone('square', 150, 90, 0.06, 0.08, 0.02);
        break;
      case 'chicken':
        // Hilarious rubber chicken honk slide!
        tone('sawtooth', 540, 820, 0.08, 0.11);
        tone('sawtooth', 780, 340, 0.16, 0.11, 0.08);
        break;
      case 'pan':
        // Metallic frying pan BONK!
        tone('square', 740, 520, 0.14, 0.14);
        tone('triangle', 1120, 880, 0.12, 0.09);
        break;
      case 'clang':
        tone('square', 1200, 900, 0.06, 0.1);
        break;
      case 'hit':
        tone('square', 220, 110, 0.05, 0.08);
        break;
      case 'crit':
        tone('square', 660, 990, 0.09, 0.12);
        break;
      case 'kill':
        tone('square', 300, 90, 0.11, 0.11);
        break;
      case 'player_hit':
        tone('sawtooth', 160, 55, 0.18, 0.16);
        break;
      case 'explode':
        tone('sawtooth', 130, 32, 0.26, 0.18);
        tone('square', 85, 28, 0.22, 0.14, 0.02);
        break;
      case 'coin':
        tone('square', 987, 1318, 0.09, 0.1);
        break;
      case 'mana':
        tone('sine', 520, 780, 0.07, 0.09);
        break;
      case 'heal':
        tone('triangle', 440, 660, 0.1, 0.12);
        tone('triangle', 660, 880, 0.12, 0.12, 0.08);
        break;
      case 'skill':
        tone('square', 330, 660, 0.1, 0.12);
        tone('square', 660, 990, 0.12, 0.1, 0.07);
        break;
      case 'slot':
        tone('square', 523, 659, 0.06, 0.1);
        tone('square', 659, 784, 0.06, 0.1, 0.06);
        break;
      case 'jackpot':
      case 'room_clear':
      case 'chest':
        [523, 659, 784, 1046].forEach((f, i) => tone('square', f, f * 1.02, 0.1, 0.1, i * 0.065));
        break;
      case 'portal':
        tone('sine', 300, 900, 0.25, 0.12);
        break;
      case 'boss_intro':
        [220, 207, 196, 146].forEach((f, i) => tone('sawtooth', f, f * 0.95, 0.16, 0.13, i * 0.12));
        break;
      case 'switch':
        tone('triangle', 500, 700, 0.05, 0.08);
        break;
      case 'error':
        tone('sawtooth', 180, 120, 0.12, 0.1);
        break;
      case 'shield_full':
      case 'ready':
        tone('sine', 660, 990, 0.1, 0.08);
        break;
    }
  }

  startBgm(mode: 'lobby' | 'dungeon' | 'boss'): void {
    this.stopBgm();
    if (!this.bgmEnabled || typeof window === 'undefined') return;
    const notes =
      mode === 'lobby'
        ? [261, 329, 392, 329, 293, 349, 440, 349]
        : mode === 'boss'
          ? [146, 146, 174, 164, 146, 130, 146, 220]
          : [196, 233, 261, 293, 261, 233, 196, 174];
    const tempoMs = mode === 'boss' ? 190 : mode === 'lobby' ? 320 : 240;

    this.bgmInterval = window.setInterval(() => {
      if (!this.bgmEnabled || !this.ctx || this.ctx.state !== 'running') return;
      const f = notes[this.bgmStep % notes.length];
      this.bgmStep++;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = mode === 'lobby' ? 'triangle' : 'square';
      osc.frequency.setValueAtTime(f, this.ctx.currentTime);
      g.gain.setValueAtTime(0.028, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + tempoMs / 1200);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + tempoMs / 1000);
    }, tempoMs);
  }

  stopBgm(): void {
    if (this.bgmInterval !== null) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}
