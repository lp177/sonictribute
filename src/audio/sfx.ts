/**
 * Tiny procedural WebAudio synth — no audio assets needed.
 *
 * The synth is deliberately "dynamic": repeated actions do not replay an
 * identical sample. Ring pickups climb a pitch ladder while you keep chaining
 * them, spin-dash revs rise with the charge, and impacts are bass-heavy with
 * a lowpass sweep so a stomp reads as weight rather than a beep.
 */
export class Sfx {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  /** Rising-pitch state for chained pickups. */
  private ringChain = 0;
  private lastRingAt = -99;
  private revStep = 0;
  private lastRevAt = -99;

  /** Must be called from a user-gesture context at least once. */
  ensure(): void {
    if (!this.ac) {
      this.ac = new AudioContext();
      this.master = this.ac.createGain();
      this.master.gain.value = 0.25;
      this.master.connect(this.ac.destination);
    }
    if (this.ac.state === 'suspended') void this.ac.resume();
  }

  private blip(freq: number, dur: number, type: OscillatorType, sweep = 0, when = 0, gain = 0.5): void {
    if (!this.ac || !this.master) return;
    const t0 = this.ac.currentTime + when;
    const o = this.ac.createOscillator();
    const g = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (sweep !== 0) o.frequency.linearRampToValueAtTime(Math.max(30, freq + sweep), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, when = 0, gain = 0.4): void {
    if (!this.ac || !this.master) return;
    const t0 = this.ac.currentTime + when;
    const len = Math.ceil(this.ac.sampleRate * dur);
    const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ac.createBufferSource();
    src.buffer = buf;
    const g = this.ac.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  /**
   * Weighty impact: a sub-bass sine drop plus lowpass-swept noise. This is
   * what makes stomps, slams and gates feel physical instead of tinny.
   */
  private thud(freq: number, dur: number, punch = 1): void {
    if (!this.ac || !this.master) return;
    const t0 = this.ac.currentTime;

    const o = this.ac.createOscillator();
    const og = this.ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 2.2, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(24, freq * 0.6), t0 + dur);
    og.gain.setValueAtTime(0.9 * punch, t0);
    og.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(og);
    og.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);

    const len = Math.ceil(this.ac.sampleRate * dur);
    const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = this.ac.createBufferSource();
    src.buffer = buf;
    const lp = this.ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1800 * punch, t0);
    lp.frequency.exponentialRampToValueAtTime(160, t0 + dur);
    const ng = this.ac.createGain();
    ng.gain.value = 0.5 * punch;
    src.connect(lp);
    lp.connect(ng);
    ng.connect(this.master);
    src.start(t0);
  }

  /** Seconds since the context started; -99 before audio is unlocked. */
  private get now(): number {
    return this.ac ? this.ac.currentTime : -99;
  }

  play(name: string): void {
    if (!this.ac) return;
    switch (name) {
      case 'ring': {
        // Chained pickups climb a pentatonic-ish ladder, then reset once you
        // stop collecting — the classic "ring run" reward.
        if (this.now - this.lastRingAt > 0.55) this.ringChain = 0;
        else this.ringChain = Math.min(this.ringChain + 1, 11);
        this.lastRingAt = this.now;
        const semis = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26][this.ringChain];
        const step = 2 ** (semis / 12);
        this.blip(988 * step, 0.06, 'sine');
        this.blip(1319 * step, 0.16, 'sine', 0, 0.06);
        break;
      }
      case 'jump':
        this.blip(220, 0.18, 'square', 330);
        break;
      case 'land':
        break;
      case 'land-hard':
        this.thud(90, 0.16, 0.7);
        break;
      case 'spring':
        this.blip(180, 0.22, 'square', 520);
        this.blip(360, 0.18, 'triangle', 700, 0.02, 0.3);
        break;
      case 'dash':
        this.noise(0.25);
        this.blip(120, 0.25, 'sawtooth', 400);
        this.thud(70, 0.18, 0.6);
        break;
      case 'dash-rev': {
        // Each rev climbs, so a long charge audibly winds up.
        if (this.now - this.lastRevAt > 0.7) this.revStep = 0;
        else this.revStep = Math.min(this.revStep + 1, 8);
        this.lastRevAt = this.now;
        this.blip(160 * 2 ** (this.revStep / 14), 0.08, 'square', 120);
        break;
      }
      case 'loop-boost':
        this.noise(0.18);
        this.blip(300, 0.3, 'sawtooth', 700);
        this.blip(600, 0.25, 'triangle', 900, 0.03, 0.25);
        break;
      case 'dash-pad':
        this.noise(0.12);
        this.blip(240, 0.2, 'sawtooth', 500);
        break;
      case 'hurt':
        this.blip(440, 0.3, 'sawtooth', -300);
        this.thud(80, 0.2, 0.8);
        break;
      case 'shield-lost':
        this.blip(660, 0.2, 'sine', -220);
        break;
      case 'board':
        this.blip(330, 0.12, 'triangle', 200);
        this.blip(660, 0.16, 'triangle', 200, 0.1);
        break;
      case 'board-end':
        this.blip(660, 0.1, 'triangle', -200);
        break;
      case 'board-lost':
        this.noise(0.2);
        this.blip(520, 0.22, 'triangle', -320);
        break;
      case 'enemy':
        this.noise(0.12);
        this.blip(320, 0.12, 'square', -120);
        this.thud(110, 0.12, 0.55);
        break;
      case 'monitor':
        this.blip(523, 0.09, 'square');
        this.blip(784, 0.14, 'square', 0, 0.09);
        this.thud(120, 0.1, 0.4);
        break;
      case 'crystal':
        this.blip(659, 0.1, 'sine');
        this.blip(880, 0.1, 'sine', 0, 0.08);
        this.blip(1319, 0.22, 'sine', 0, 0.16);
        break;
      case 'secret':
        this.blip(392, 0.12, 'triangle');
        this.blip(523, 0.12, 'triangle', 0, 0.1);
        this.blip(659, 0.2, 'triangle', 0, 0.2);
        break;
      case 'checkpoint':
        this.blip(587, 0.1, 'square');
        this.blip(880, 0.18, 'square', 0, 0.1);
        break;
      case 'crumble':
        this.noise(0.18, 0, 0.25);
        this.blip(150, 0.2, 'square', -80, 0, 0.25);
        break;
      case 'spike-trap':
        this.blip(900, 0.06, 'square', -400);
        this.noise(0.08, 0, 0.3);
        break;
      case 'spike-warn':
        this.blip(1200, 0.05, 'square', 0, 0, 0.18);
        break;
      case 'gate-slam':
        this.thud(60, 0.45, 1.2);
        this.noise(0.3, 0.02, 0.35);
        break;
      case 'gate-open':
        this.thud(70, 0.3, 0.7);
        this.blip(300, 0.4, 'triangle', 260, 0.05, 0.25);
        break;
      case 'boss':
        // Alarm: two rising stabs announcing the lock-in.
        this.blip(220, 0.3, 'sawtooth', 120, 0, 0.35);
        this.blip(260, 0.35, 'sawtooth', 140, 0.32, 0.35);
        break;
      case 'boss-hit':
        this.noise(0.15);
        this.blip(200, 0.18, 'sawtooth', -100);
        this.thud(95, 0.2, 0.9);
        break;
      case 'boss-slam':
        this.noise(0.3);
        this.thud(48, 0.5, 1.3);
        break;
      case 'boss-telegraph':
        this.blip(700, 0.08, 'square');
        this.blip(700, 0.08, 'square', 0, 0.12);
        break;
      case 'boss-defeated':
        this.noise(0.6);
        this.thud(45, 0.7, 1.4);
        this.blip(100, 0.6, 'sawtooth', -60);
        break;
      case 'goal':
        [523, 659, 784, 1047].forEach((f, i) => this.blip(f, 0.16, 'square', 0, i * 0.12));
        break;
      case 'die':
        this.blip(330, 0.5, 'sawtooth', -280);
        break;
      default:
        break;
    }
  }
}
