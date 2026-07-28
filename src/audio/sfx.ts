/** Tiny procedural WebAudio synth — no audio assets needed. */
export class Sfx {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;

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

  private blip(freq: number, dur: number, type: OscillatorType, sweep = 0, when = 0): void {
    if (!this.ac || !this.master) return;
    const t0 = this.ac.currentTime + when;
    const o = this.ac.createOscillator();
    const g = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (sweep !== 0) o.frequency.linearRampToValueAtTime(Math.max(30, freq + sweep), t0 + dur);
    g.gain.setValueAtTime(0.5, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, when = 0): void {
    if (!this.ac || !this.master) return;
    const t0 = this.ac.currentTime + when;
    const len = Math.ceil(this.ac.sampleRate * dur);
    const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ac.createBufferSource();
    src.buffer = buf;
    const g = this.ac.createGain();
    g.gain.value = 0.4;
    src.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  play(name: string): void {
    if (!this.ac) return;
    switch (name) {
      case 'ring':
        this.blip(988, 0.07, 'sine');
        this.blip(1319, 0.18, 'sine', 0, 0.07);
        break;
      case 'jump':
        this.blip(220, 0.18, 'square', 330);
        break;
      case 'spring':
        this.blip(180, 0.22, 'square', 520);
        break;
      case 'dash':
        this.noise(0.25);
        this.blip(120, 0.25, 'sawtooth', 400);
        break;
      case 'dash-rev':
        this.blip(160, 0.08, 'square', 120);
        break;
      case 'hurt':
        this.blip(440, 0.3, 'sawtooth', -300);
        break;
      case 'shield-lost':
        this.blip(660, 0.2, 'sine', -220);
        break;
      case 'enemy':
        this.noise(0.12);
        this.blip(320, 0.12, 'square', -120);
        break;
      case 'monitor':
        this.blip(523, 0.09, 'square');
        this.blip(784, 0.14, 'square', 0, 0.09);
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
      case 'boss-hit':
        this.noise(0.15);
        this.blip(200, 0.18, 'sawtooth', -100);
        break;
      case 'boss-defeated':
        this.noise(0.6);
        this.blip(100, 0.6, 'sawtooth', -60);
        break;
      case 'goal':
        [523, 659, 784, 1047].forEach((f, i) => this.blip(f, 0.16, 'square', 0, i * 0.12));
        break;
      case 'die':
        this.blip(330, 0.5, 'sawtooth', -280);
        break;
      case 'land':
        break;
      default:
        break;
    }
  }
}
