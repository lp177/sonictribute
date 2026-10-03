/**
 * Procedural sound effects — no audio assets, every sound is synthesised.
 *
 * HOUSE STYLE: a Mega Drive cabinet. Three voice types, the same three the
 * console had, and every effect is a small arrangement of them:
 *
 *   fm     two-operator FM (YM2612): a modulator swinging the carrier's pitch,
 *          with its own decaying index. Whole-number ratios give brass, buzz
 *          and "boing"; anything else gives metal — bells, clangs, glass.
 *   tone   PSG (SN76489): one square / band-limited pulse / triangle with a
 *          sweep or a stepped run. Blips, arpeggios, the jump.
 *   noise  the shared noise buffer through one filter. Never bare white noise:
 *          a band is chosen, so a crunch, a hiss and a rumble sound different.
 *
 * An impact is always three things — a transient `click`, a pitched body, a
 * tail — never a bare beep. `thud` is the sub-bass that gives one weight.
 *
 * MIX: four loudness tiers, measured through the real mixer at default volumes
 * (the music's loop body sits near -24.5 dBFS RMS, peaking around -8 dBFS):
 *
 *   SLAM    -4 … -1 dBFS   boss slams, eruptions, the defeat chain, wrecks
 *   ACTION  -9 … -4 dBFS   ring, jump, stomp, spring, pickups: over the music
 *   WORLD  -16 … -9 dBFS   hazards ticking, foley, anything the hero did not do
 *   UI        < -16 dBFS   menus and counters, well under the music
 *
 * Effects stay short and bright enough to read over the music, never long or
 * dense enough to mask it. Anything a caller may fire every frame is rate
 * limited (`MIN_GAP`), and no sound plays twice in one frame: N traps on one
 * clock would otherwise stack into a single N-times-louder hit. Repeats vary
 * (pitch jitter, round-robin, the ring's ladder) so nothing machine-guns.
 *
 * Everything routes through the shared AudioMixer's sfx bus, so the player's
 * effects volume and the master limiter apply, and the soundtrack (`music`)
 * lives on the same context. SOUND_DESIGN.md has the per-sound table.
 */
import { AudioMixer, type ExtraWave } from './mixer.ts';
import { Music } from './music.ts';

export interface SfxOptions {
  /** Stereo placement, -1 (left) … 1 (right). A sound's own left/right play is offset by it. */
  pan?: number;
}

/** Every name `play()` answers to. Anything else is silently ignored. */
export const SFX_NAMES = [
  // hero
  'jump', 'land', 'land-hard', 'roll', 'unroll', 'skid', 'slide-off', 'dash-charge', 'dash-rev', 'dash',
  'hurt', 'ring-loss', 'die', 'respawn',
  // pickups
  'ring', 'rings10', 'shield', 'shield-lost', 'shoes', 'monitor', 'crystal', 'secret', 'checkpoint', 'goal',
  // gadgets and rides
  'spring', 'launch', 'dash-pad', 'loop-boost', 'rail-on', 'rail-off', 'glider', 'glide', 'glider-lost',
  'board', 'board-end', 'board-lost', 'cart-board', 'cart-wreck', 'cart-crash',
  // enemies and hazards
  'enemy', 'hopper-stomp', 'crumble', 'phase-blink', 'spike-warn', 'spike-trap',
  'stalactite-warn', 'stalactite-fall', 'stalactite-shatter',
  // boss
  'warning', 'boss', 'gate-slam', 'gate-open', 'gate-bump', 'boss-telegraph', 'boss-hit', 'boss-slam',
  'boss-dig', 'boss-burst', 'boss-shards', 'boss-trace', 'boss-derez', 'boss-rez', 'boss-defeated',
  // story
  'yolk-laugh', 'yolk-sting', 'thunder', 'core-crack', 'beam', 'time-stop', 'whoosh',
  // menus and results
  'ui-move', 'ui-confirm', 'ui-back', 'ui-error', 'pause', 'unpause', 'tally', 'tally-end', 'rank',
  'title-card', 'text-blip',
] as const;

type Wave = OscillatorType | ExtraWave;
type Points = readonly (readonly [number, number])[];

/** What every voice shares: a contour and a loudness envelope. */
interface Shape {
  /** Hz at the strike (pitch for `fm`/`tone`, filter frequency for `noise`). */
  f: number;
  /** Exponential glide to this frequency over the whole voice. */
  to?: number;
  /** `[seconds, Hz]` glide targets, in order (instead of `to`). */
  glide?: Points;
  /**
   * `[seconds, Hz]` re-struck notes: the frequency steps and the envelope
   * restarts. One chip channel playing a run, at the cost of one voice.
   */
  seq?: Points;
  /** Seconds from the strike to silence. */
  dur: number;
  gain?: number;
  /** Delay from now, seconds. */
  at?: number;
  pan?: number;
  /** Attack, seconds. Default 2 ms: instant to the ear, no click at the onset. */
  a?: number;
  /** Seconds held at full level before the decay. */
  hold?: number;
  /** Linear decay — a gated, held body — instead of exponential (a struck one). */
  lin?: boolean;
}

interface Tone extends Shape {
  wave?: Wave;
}

interface Fm extends Shape {
  /** Modulator : carrier frequency. Whole numbers are harmonic; anything else is metal. */
  ratio?: number;
  /** Modulation index at the strike — how bright and how rough. */
  index?: number;
  /** Index the strike settles to (default 0: it rings out as a pure tone)… */
  indexTo?: number;
  /** …over this many seconds (default: the whole note). */
  idur?: number;
  /** Carrier waveform (default sine). */
  wave?: OscillatorType;
}

interface Noise extends Shape {
  type?: BiquadFilterType;
  q?: number;
}

/** Where a voice plays: the sfx bus, or a panner into it shared by one `play()` call. */
interface Out {
  node: AudioNode;
  voices: number;
}

/** Relative level a voice has decayed to when it is cut (-54 dB). */
const SILENT = 0.002;
/** Level a re-struck note has fallen to when the next one lands. */
const DAMP = 0.14;
/** Less than one 60 Hz frame: the same sound twice in a frame plays once. */
const FRAME_GAP = 0.012;
/**
 * Minimum seconds between two plays of a sound: either some caller may fire
 * it every frame, or it is a long voice that must not pile up on itself when
 * a player skips through a cutscene.
 */
const MIN_GAP = new Map<string, number>([
  ['ring', 0.03],
  ['dash-rev', 0.05],
  ['land', 0.12],
  ['skid', 0.25],
  ['slide-off', 0.3],
  ['glide', 0.2],
  ['gate-bump', 0.35],
  ['phase-blink', 0.06],
  ['spike-warn', 0.05],
  ['spike-trap', 0.05],
  ['crumble', 0.05],
  ['ui-move', 0.03],
  ['tally', 0.045],
  ['text-blip', 0.035],
  ['yolk-laugh', 1.2],
  ['warning', 0.8],
  ['thunder', 0.4],
  ['whoosh', 0.2],
]);

/** The ring run: a major-pentatonic ladder, climbed one rung per chained pickup. */
const RING_LADDER = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26];
/** Dr. Yolk's laugh, `[start, length, Hz]` per syllable: five barks falling, then the long one. */
const LAUGH: readonly (readonly [number, number, number])[] = [
  [0, 0.12, 196],
  [0.16, 0.12, 185],
  [0.32, 0.12, 175],
  [0.48, 0.12, 165],
  [0.64, 0.13, 147],
  [0.82, 0.56, 131],
];

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
/** ±`pct` of pitch jitter, so a repeated sound is never the identical sample twice. */
const vary = (f: number, pct = 0.015): number => f * (1 + (Math.random() * 2 - 1) * pct);

export class Sfx {
  /** The one AudioContext and the mix (shared with the music). */
  readonly mixer: AudioMixer;
  /** The soundtrack player, on the same context. */
  readonly music: Music;
  /** When each sound last played, for `MIN_GAP`. */
  private lastAt = new Map<string, number>();
  /** Rising-pitch state for chained pickups, and which side the next one starts on. */
  private ringChain = 0;
  private lastRingAt = -99;
  private ringSide = 1;
  private revStep = 0;
  private lastRevAt = -99;
  /** Round-robin counters for sounds that repeat back to back. */
  private tallyFlip = false;
  private moveStep = 0;
  /** When a shield or board last took a hit for the hero (that hit scatters no rings). */
  private guardLostAt = -99;
  /** Placement asked for by the `play()` call in progress, and the panners it has opened. */
  private pan0 = 0;
  private outs = new Map<number, Out>();

  constructor(mixer = new AudioMixer()) {
    this.mixer = mixer;
    this.music = new Music(mixer);
  }

  /** Creates / resumes the audio context (harmless to call every frame). */
  ensure(): void {
    this.mixer.ensure();
  }

  /** Call from inside a DOM user-gesture handler: this is what starts audio. */
  unlock(): void {
    this.mixer.unlock();
  }

  private get ac(): BaseAudioContext | null {
    return this.mixer.context;
  }

  /** Seconds since the context started; -99 before audio is unlocked. */
  private get now(): number {
    return this.ac ? this.ac.currentTime : -99;
  }

  /* -------------------------------- Toolkit -------------------------------- */

  /**
   * Stereo placement on the way to the sfx bus. Voices of one `play()` call
   * that land on the same spot share one panner, so a twenty-voice explosion
   * costs two or three of them, not twenty.
   */
  private out(pan = 0): Out {
    const p = Math.round(clamp(this.pan0 + pan, -1, 1) * 100) / 100;
    let o = this.outs.get(p);
    if (!o) {
      let node: AudioNode = this.mixer.sfxBus;
      if (p !== 0) {
        const panner = this.ac!.createStereoPanner();
        panner.pan.value = p;
        panner.connect(node);
        node = panner;
      }
      o = { node, voices: 0 };
      this.outs.set(p, o);
    }
    o.voices++;
    return o;
  }

  /**
   * Tears a voice down when its source ends — and the panner it shared once
   * the last voice on it is gone — so a long session never grows the graph.
   */
  private reap(src: AudioScheduledSourceNode, nodes: AudioNode[], out: Out): void {
    src.onended = () => {
      for (const n of nodes) n.disconnect();
      if (--out.voices === 0 && out.node !== this.mixer.sfxBus) out.node.disconnect();
    };
  }

  private setWave(o: OscillatorNode, wave: Wave): void {
    if (wave === 'pulse25' || wave === 'pulse12') o.setPeriodicWave(this.mixer.wave(wave));
    else o.type = wave;
  }

  /** Books a voice's frequency contour on `p` (scaled by `mul` for an FM modulator). */
  private contour(p: AudioParam, t0: number, s: Shape, mul = 1): void {
    p.setValueAtTime(s.f * mul, t0);
    if (s.seq) for (const [t, f] of s.seq) p.setValueAtTime(f * mul, t0 + t);
    else if (s.glide) for (const [t, f] of s.glide) p.exponentialRampToValueAtTime(Math.max(1, f * mul), t0 + t);
    else if (s.to) p.exponentialRampToValueAtTime(Math.max(1, s.to * mul), t0 + s.dur);
  }

  /** Strike → (hold) → decay, restarted at every `seq` note. */
  private envelope(g: AudioParam, t0: number, peak: number, s: Shape): void {
    const a = s.a ?? 0.002;
    const strikes = [0, ...(s.seq ?? []).map(([t]) => t)];
    // Closed from NOW, not from the strike: a gain node idles at 1, and a
    // delayed voice whose source starts a sample ahead of its first envelope
    // event leaks that one sample at full scale.
    g.value = 0;
    g.setValueAtTime(0, t0);
    strikes.forEach((at, i) => {
      const last = i === strikes.length - 1;
      const end = last ? s.dur : strikes[i + 1];
      g.linearRampToValueAtTime(peak, t0 + at + a);
      if (s.hold) g.setValueAtTime(peak, t0 + Math.min(at + a + s.hold, end - 0.004));
      if (s.lin) g.linearRampToValueAtTime(last ? 0 : peak * DAMP, t0 + end);
      else g.exponentialRampToValueAtTime(peak * (last ? SILENT : DAMP), t0 + end);
    });
  }

  /** PSG voice: one oscillator, one envelope. */
  private tone(s: Tone): void {
    const ac = this.ac!;
    const t0 = ac.currentTime + (s.at ?? 0);
    const o = ac.createOscillator();
    const g = ac.createGain();
    this.setWave(o, s.wave ?? 'square');
    this.contour(o.frequency, t0, s);
    this.envelope(g.gain, t0, s.gain ?? 0.3, s);
    const out = this.out(s.pan);
    o.connect(g);
    g.connect(out.node);
    o.start(t0);
    o.stop(t0 + s.dur + 0.02);
    this.reap(o, [o, g], out);
  }

  /**
   * FM voice: a modulator swings the carrier's frequency by `index` times its
   * own, and that swing dies away faster than the note does. The burst of
   * sidebands at the strike is the "ching" of a ring and the bite of a clang;
   * what is left ringing is nearly a pure tone.
   */
  private fm(s: Fm): void {
    const ac = this.ac!;
    const t0 = ac.currentTime + (s.at ?? 0);
    const ratio = s.ratio ?? 1;
    const car = ac.createOscillator();
    const mod = ac.createOscillator();
    const depth = ac.createGain();
    const amp = ac.createGain();
    car.type = s.wave ?? 'sine';
    this.contour(car.frequency, t0, s);
    this.contour(mod.frequency, t0, s, ratio);
    // The swing is in Hz, so it is re-pitched with every note of a run.
    const notes: Points = [[0, s.f], ...(s.seq ?? [])];
    notes.forEach(([at, f], i) => {
      const end = i + 1 < notes.length ? notes[i + 1][0] : s.dur;
      const hz = f * ratio;
      depth.gain.setValueAtTime(Math.max(0.5, hz * (s.index ?? 2)), t0 + at);
      depth.gain.exponentialRampToValueAtTime(Math.max(0.5, hz * (s.indexTo ?? 0)), t0 + Math.min(end, at + (s.idur ?? s.dur)));
    });
    this.envelope(amp.gain, t0, s.gain ?? 0.3, s);
    const out = this.out(s.pan);
    mod.connect(depth);
    depth.connect(car.frequency);
    car.connect(amp);
    amp.connect(out.node);
    for (const o of [car, mod]) {
      o.start(t0);
      o.stop(t0 + s.dur + 0.02);
    }
    this.reap(car, [car, mod, depth, amp], out);
  }

  /**
   * Filtered noise. Reads a window of the mixer's shared buffer at a random
   * offset — no AudioBuffer is allocated per call.
   */
  private noise(s: Noise): void {
    const ac = this.ac!;
    const t0 = ac.currentTime + (s.at ?? 0);
    const src = ac.createBufferSource();
    src.buffer = this.mixer.noise;
    src.loop = true;
    const band = ac.createBiquadFilter();
    band.type = s.type ?? 'bandpass';
    band.Q.value = s.q ?? (band.type === 'bandpass' ? 1 : 0.7);
    this.contour(band.frequency, t0, s);
    const g = ac.createGain();
    this.envelope(g.gain, t0, s.gain ?? 0.3, { a: 0.001, ...s });
    const out = this.out(s.pan);
    src.connect(band);
    band.connect(g);
    g.connect(out.node);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + s.dur + 0.02);
    this.reap(src, [src, band, g], out);
  }

  /** The transient at the front of every impact: a few milliseconds of bright noise. */
  private click(at = 0, gain = 0.2, pan = 0): void {
    this.noise({ type: 'highpass', f: 2600, dur: 0.014, gain, at, pan, a: 0.0005 });
  }

  /**
   * Weight: a sub-bass sine drop plus lowpass-swept noise. This is what makes
   * stomps, slams and gates feel physical instead of tinny.
   */
  private thud(freq: number, dur: number, punch = 1, at = 0, pan = 0): void {
    this.tone({ wave: 'sine', f: freq * 2.2, to: Math.max(24, freq * 0.6), dur, gain: 0.7 * punch, at, pan, a: 0.001 });
    this.noise({ type: 'lowpass', f: 1800 * punch, to: 160, dur: dur * 0.8, gain: 0.4 * punch, at, pan });
  }

  /** Struck bell (ratio 3.5: inharmonic, so it reads as metal, not as a note on an organ). */
  private bell(f: number, dur: number, gain: number, at = 0, pan = 0, index = 1.6): void {
    this.fm({ f, ratio: 3.5, index, idur: Math.min(dur, 0.12), dur, gain, at, pan });
  }

  /** Struck plate: a tritone-ish ratio and a deep, slow index — armour taking a hit. */
  private clang(f: number, dur: number, gain: number, at = 0, pan = 0): void {
    this.fm({ f, ratio: 1.41, index: 4.5, indexTo: 0.6, dur, gain, at, pan });
  }

  /** One explosion of a chain; `size` scales its depth, length and level together. */
  private boom(at: number, size: number, pan: number): void {
    const f = vary(64 / size, 0.06);
    this.tone({ wave: 'sine', f: f * 2.4, to: Math.max(24, f * 0.55), dur: 0.16 + 0.3 * size, gain: 0.6 * size, at, pan, a: 0.001 });
    this.noise({ type: 'lowpass', f: 3400 * size, to: 220, dur: 0.14 + 0.34 * size, gain: 0.5 * size, at, pan });
  }

  /** One spin-dash rev: a motor note that winds up, a semitone higher per rev. */
  private rev(step: number): void {
    const k = 2 ** (step / 12);
    const f = 185 * k;
    this.fm({ wave: 'sawtooth', f: f * 0.7, glide: [[0.09, f * 1.5], [0.26, f * 1.3]], ratio: 0.5, index: 2.2, indexTo: 1, dur: 0.28, gain: 0.4, lin: true });
    this.noise({ f: 900 * k, to: 2800 * k, q: 1.6, dur: 0.16, gain: 0.36 });
  }

  /** Rings bouncing away: two FM channels trading detuned pings left and right, falling. */
  private scatter(): void {
    const ping = (f: number): number => vary(f, 0.03);
    this.fm({ f: ping(2093), seq: [[0.09, ping(1661)], [0.19, ping(1865)], [0.3, ping(1245)]], ratio: 3.5, index: 1.3, idur: 0.06, dur: 0.52, gain: 0.17, at: 0.03, pan: -0.55 });
    this.fm({ f: ping(1760), seq: [[0.09, ping(1397)], [0.2, ping(1480)], [0.32, ping(988)]], ratio: 3.5, index: 1.3, idur: 0.06, dur: 0.54, gain: 0.15, at: 0.075, pan: 0.55 });
  }

  /* --------------------------------- Palette -------------------------------- */

  play(name: string, opts?: SfxOptions): void {
    // Not audible yet (no gesture): drop it rather than queue it — queued
    // one-shots would all fire together when the context finally starts.
    if (!this.ac || !this.mixer.audible) return;
    const now = this.now;
    const last = this.lastAt.get(name);
    if (last !== undefined && now - last < (MIN_GAP.get(name) ?? FRAME_GAP)) return;
    this.lastAt.set(name, now);
    const pan = opts?.pan ?? 0;
    this.pan0 = Number.isFinite(pan) ? clamp(pan, -1, 1) : 0;
    this.outs.clear();

    switch (name) {
      // ---- hero
      case 'jump': {
        // The classic: a pulse wave swept up an octave and a half, over a soft
        // push off the ground.
        const f = vary(310);
        this.tone({ wave: 'pulse25', f, glide: [[0.13, f * 2.9]], dur: 0.2, gain: 0.4, lin: true });
        this.tone({ wave: 'sine', f: 170, to: 80, dur: 0.07, gain: 0.3 });
        this.noise({ type: 'lowpass', f: 1400, to: 500, dur: 0.05, gain: 0.2 });
        break;
      }
      case 'land':
        // Foley, not an event: a soft pat that sits under everything.
        this.noise({ type: 'lowpass', f: 900, to: 300, dur: 0.05, gain: 0.34 });
        this.tone({ wave: 'sine', f: vary(130, 0.05), to: 70, dur: 0.05, gain: 0.16 });
        break;
      case 'land-hard':
        this.click(0, 0.14);
        this.thud(85, 0.2, 0.42);
        this.noise({ f: 1700, to: 600, q: 0.8, dur: 0.09, gain: 0.6, lin: true });
        break;
      case 'roll':
        // "Zzip": a tight buzz that tucks upward as the hero curls.
        this.fm({ f: vary(190), glide: [[0.09, 760]], index: 6, indexTo: 3, dur: 0.13, gain: 0.16, lin: true });
        this.noise({ f: 2500, to: 6000, q: 2, dur: 0.1, gain: 0.25 });
        break;
      case 'unroll':
        this.tone({ wave: 'pulse25', f: 520, to: 300, dur: 0.06, gain: 0.18 });
        this.noise({ type: 'lowpass', f: 1200, dur: 0.05, gain: 0.3 });
        break;
      case 'skid': {
        // Two narrow, clashing bands of noise: rubber screeching on stone.
        const f = vary(2300, 0.04);
        this.noise({ f, to: f * 0.72, q: 9, dur: 0.24, gain: 1.2, a: 0.008 });
        this.noise({ f: f * 1.52, to: f * 1.1, q: 12, dur: 0.18, gain: 0.8, a: 0.008 });
        break;
      }
      case 'slide-off':
        this.noise({ f: 1600, to: 500, q: 1.2, dur: 0.14, gain: 0.38 });
        this.tone({ wave: 'sine', f: 440, to: 220, dur: 0.12, gain: 0.1 });
        break;
      case 'dash-charge':
        // The first rev, plus the scuff of the hero spinning up on the spot.
        this.revStep = 0;
        this.lastRevAt = now;
        this.rev(0);
        this.noise({ f: 600, to: 1800, q: 1.2, dur: 0.2, gain: 0.25, a: 0.02 });
        break;
      case 'dash-rev':
        // Each rev climbs, so a long charge audibly winds up.
        if (now - this.lastRevAt > 0.7) this.revStep = 0;
        else this.revStep = Math.min(this.revStep + 1, 12);
        this.lastRevAt = now;
        this.rev(this.revStep);
        break;
      case 'dash':
        // Release: a hard launch — burst of noise, an FM zap falling away, a kick.
        this.click(0, 0.14);
        this.noise({ f: 3200, to: 500, q: 0.9, dur: 0.24, gain: 0.5, lin: true });
        this.fm({ f: 1500, to: 170, ratio: 0.5, index: 1.2, indexTo: 0.3, dur: 0.24, gain: 0.28 });
        this.thud(70, 0.16, 0.3);
        break;
      case 'hurt':
        // Harsh and falling, then the rings spray out — unless a shield or the
        // board took the hit, in which case there are no rings to lose.
        this.click(0, 0.2);
        this.fm({ f: 660, to: 150, ratio: 1.41, index: 1.5, indexTo: 0.6, dur: 0.32, gain: 0.32, lin: true });
        this.thud(80, 0.18, 0.5);
        if (now - this.guardLostAt > 0.05) this.scatter();
        break;
      case 'ring-loss':
        this.scatter();
        break;
      case 'die':
        // A little lift, then the long fall: unmistakably not a hit you walk off.
        this.click(0, 0.2);
        this.thud(80, 0.18, 0.45);
        this.fm({ f: 587, glide: [[0.08, 659], [0.6, 110]], index: 1, indexTo: 2.5, dur: 0.62, gain: 0.27, hold: 0.1, lin: true });
        this.tone({ wave: 'pulse25', f: 294, glide: [[0.08, 330], [0.6, 55]], dur: 0.6, gain: 0.12, lin: true });
        break;
      case 'respawn':
        this.fm({ f: 392, seq: [[0.05, 587], [0.1, 784], [0.15, 1175]], ratio: 2, index: 1, dur: 0.4, gain: 0.35 });
        this.noise({ f: 600, to: 3000, q: 1.5, dur: 0.25, gain: 0.5, a: 0.12 });
        break;

      // ---- pickups
      case 'ring': {
        // THE sound of the game: an FM bell struck on one side and answered a
        // fourth up on the other, the sides swapping with every pickup. Chained
        // pickups climb a pentatonic ladder, then reset once you stop
        // collecting — the classic "ring run" reward.
        if (now - this.lastRingAt > 0.55) this.ringChain = 0;
        else this.ringChain = Math.min(this.ringChain + 1, RING_LADDER.length - 1);
        this.lastRingAt = now;
        const k = 2 ** (RING_LADDER[this.ringChain] / 12);
        // Key scaling, as on the chip: the higher the rung, the purer and softer.
        const index = 1.7 / Math.sqrt(k);
        const level = 0.5 / k ** 0.3;
        this.ringSide = -this.ringSide;
        const side = this.ringSide * 0.45;
        this.bell(988 * k, 0.09, level, 0, side, index);
        this.bell(1319 * k, 0.26, level, 0.055, -side, index);
        break;
      }
      case 'rings10':
        // Ten at once: the ring chime run up four rungs, left answering right.
        this.fm({ f: 988, seq: [[0.05, 1319], [0.1, 1568], [0.15, 1976]], ratio: 3.5, index: 1.6, idur: 0.05, dur: 0.44, gain: 0.4, at: 0.04, pan: -0.4 });
        this.fm({ f: 1319, seq: [[0.05, 1568], [0.1, 1976], [0.15, 2637]], ratio: 3.5, index: 1.2, idur: 0.05, dur: 0.44, gain: 0.27, at: 0.065, pan: 0.4 });
        break;
      case 'shield':
        // A bubble closing around the hero: a soft swell that brightens as it
        // rises, and a "bloop" as it seals.
        this.fm({ f: 196, to: 392, ratio: 2, index: 0.4, indexTo: 2.2, dur: 0.6, gain: 0.3, a: 0.18, hold: 0.14, lin: true });
        this.tone({ wave: 'sine', f: 1175, to: 1568, dur: 0.6, gain: 0.1, a: 0.25, lin: true });
        this.noise({ f: 600, to: 2400, q: 2, dur: 0.5, gain: 0.3, a: 0.2, lin: true });
        this.tone({ wave: 'sine', f: 600, to: 1300, dur: 0.06, gain: 0.2, at: 0.42 });
        break;
      case 'shield-lost':
        // The bubble pops.
        this.guardLostAt = now;
        this.tone({ wave: 'sine', f: 500, to: 1500, dur: 0.045, gain: 0.32 });
        this.noise({ f: 2400, to: 900, q: 1.2, dur: 0.12, gain: 0.55 });
        this.fm({ f: 1000, to: 280, ratio: 2, index: 1.2, indexTo: 0.2, dur: 0.28, gain: 0.26, at: 0.02 });
        break;
      case 'shoes': {
        // Speed up: a pulse arpeggio racing up two octaves, doubled an octave
        // higher a beat behind on the other side.
        const run = [659, 784, 1047, 1319, 1568, 2093];
        this.tone({ wave: 'pulse25', f: 523, seq: run.map((f, i) => [(i + 1) * 0.036, f]), dur: 0.42, gain: 0.46, at: 0.04, pan: -0.3 });
        this.tone({ wave: 'pulse12', f: 1047, seq: run.map((f, i) => [(i + 1) * 0.036, f * 2]), dur: 0.42, gain: 0.19, at: 0.058, pan: 0.3 });
        this.noise({ f: 800, to: 5000, q: 1.2, dur: 0.3, gain: 0.36, at: 0.04, a: 0.04 });
        break;
      }
      case 'monitor':
        // The box breaking. What was inside has its own sound.
        this.click(0, 0.14);
        this.tone({ wave: 'sine', f: 620, to: 150, dur: 0.08, gain: 0.28 });
        this.noise({ f: 2600, to: 1200, q: 1.2, dur: 0.15, gain: 0.55, lin: true });
        this.thud(110, 0.1, 0.3);
        break;
      case 'crystal':
        // A sparkling E-major arpeggio over a low bell, the top note left to
        // shimmer against a twin a few cents sharp.
        this.fm({ f: 1319, seq: [[0.06, 1661], [0.12, 1976], [0.18, 2637]], ratio: 3.5, index: 1.4, idur: 0.06, dur: 0.76, gain: 0.36, pan: -0.35 });
        this.fm({ f: 1976, seq: [[0.06, 2637], [0.12, 3322], [0.18, 3951]], ratio: 2, index: 0.8, idur: 0.06, dur: 0.7, gain: 0.14, at: 0.03, pan: 0.35 });
        this.tone({ wave: 'sine', f: 2637 * 1.007, dur: 0.56, gain: 0.12, at: 0.18, pan: 0.2 });
        this.bell(330, 0.5, 0.24, 0, 0, 2);
        this.noise({ f: 9000, to: 6000, q: 2, dur: 0.5, gain: 0.36, at: 0.16, a: 0.03 });
        break;
      case 'secret':
        // A Gmaj7 arpeggio that never lands on the root: something found, not finished.
        this.fm({ f: 392, seq: [[0.07, 494], [0.14, 587], [0.21, 740], [0.28, 988]], ratio: 2, index: 1.2, idur: 0.07, dur: 0.7, gain: 0.48, pan: -0.25 });
        this.fm({ f: 784, seq: [[0.07, 988], [0.14, 1175], [0.21, 1480], [0.28, 1976]], ratio: 2, index: 0.8, idur: 0.07, dur: 0.66, gain: 0.16, at: 0.035, pan: 0.4 });
        break;
      case 'checkpoint':
        // Two bright bell notes, and the lamp twirling up to speed above them.
        this.click(0, 0.15);
        this.fm({ f: 1175, seq: [[0.11, 1760]], ratio: 3.5, index: 1.6, idur: 0.08, dur: 0.5, gain: 0.34 });
        this.tone({ wave: 'pulse12', f: 1760, seq: [[0.03, 2093], [0.06, 2349], [0.09, 2794], [0.12, 3520]], dur: 0.3, gain: 0.14, at: 0.13, pan: 0.3 });
        this.thud(140, 0.08, 0.3);
        break;
      case 'goal':
        // A rip up into a brass stab with the octave on top. Under 0.6 s: the
        // music owns the real jingle.
        this.tone({ wave: 'pulse25', f: 392, seq: [[0.035, 523], [0.07, 659]], dur: 0.12, gain: 0.3 });
        [523, 659, 784].forEach((f, i) => this.fm({ f, index: 2.6, indexTo: 0.8, dur: 0.46, gain: 0.17, at: 0.1, hold: 0.08, pan: (i - 1) * 0.4 }));
        this.bell(1047, 0.48, 0.16, 0.1);
        this.thud(98, 0.14, 0.4, 0.1);
        break;

      // ---- gadgets and rides
      case 'spring':
        // Rubbery "boing": the pitch overshoots, then wobbles home.
        this.click(0, 0.2);
        this.fm({ f: 170, glide: [[0.045, 640], [0.1, 400], [0.16, 540], [0.23, 450], [0.32, 490]], index: 6, indexTo: 1.5, dur: 0.34, gain: 0.3, lin: true });
        this.tone({ wave: 'sine', f: 240, to: 90, dur: 0.06, gain: 0.3 });
        break;
      case 'launch':
        // Off the lip of a ramp: air rushing up, a slide-whistle rise inside it.
        this.noise({ f: 500, to: 3600, q: 1.1, dur: 0.34, gain: 0.7, a: 0.02 });
        this.fm({ f: 260, to: 1040, ratio: 2, index: 2.5, indexTo: 0.5, dur: 0.26, gain: 0.24, lin: true });
        this.thud(90, 0.1, 0.35);
        break;
      case 'dash-pad':
        // Electric: a short zap up, hard at the front.
        this.click(0, 0.2);
        this.fm({ f: 380, glide: [[0.1, 1500]], index: 6, indexTo: 2, dur: 0.2, gain: 0.28, lin: true });
        this.noise({ f: 1800, to: 5200, q: 1.4, dur: 0.16, gain: 0.5 });
        this.thud(80, 0.1, 0.32);
        break;
      case 'loop-boost':
        // The long one of the boost family, with a pulse run on top as the reward.
        this.noise({ f: 500, to: 4200, dur: 0.36, gain: 0.7, a: 0.03 });
        this.fm({ f: 300, to: 1200, index: 5, indexTo: 1.5, dur: 0.32, gain: 0.26, lin: true });
        this.tone({ wave: 'pulse12', f: 784, seq: [[0.05, 1047], [0.1, 1319], [0.15, 1568]], dur: 0.36, gain: 0.24 });
        break;
      case 'rail-on':
        // Metal bite, then the grind.
        this.click(0, 0.25);
        this.fm({ f: 740, ratio: 2.76, index: 2.5, indexTo: 0.3, dur: 0.16, gain: 0.3 });
        this.noise({ f: 3400, to: 2600, q: 5, dur: 0.42, gain: 1, a: 0.01 });
        this.fm({ f: 147, to: 165, ratio: 3, index: 3, indexTo: 2, dur: 0.4, gain: 0.1, at: 0.03, lin: true });
        break;
      case 'rail-off':
        this.click(0, 0.1);
        this.fm({ f: 880, to: 1320, ratio: 3.5, index: 1.5, dur: 0.12, gain: 0.16 });
        break;
      case 'glider':
        // Picked up: three notes rising, canvas unfurling under them.
        this.fm({ f: 523, seq: [[0.07, 784], [0.14, 1047]], ratio: 2, index: 1.2, idur: 0.07, dur: 0.36, gain: 0.4 });
        this.noise({ f: 700, to: 2600, dur: 0.2, gain: 0.46, a: 0.03 });
        break;
      case 'glide':
        // The wing catching air.
        this.noise({ f: 400, to: 1300, q: 0.8, dur: 0.2, gain: 0.55, a: 0.015 });
        this.tone({ wave: 'triangle', f: 300, to: 440, dur: 0.16, gain: 0.12 });
        break;
      case 'glider-lost':
        this.noise({ f: 3000, to: 700, q: 2, dur: 0.22, gain: 0.4 });
        this.tone({ wave: 'triangle', f: 620, to: 260, dur: 0.22, gain: 0.12 });
        break;
      case 'board':
        // Mag-Board: coils charging, then two notes as it takes the hero's weight.
        this.fm({ f: 110, to: 440, index: 3, indexTo: 1, dur: 0.2, gain: 0.26, lin: true });
        this.fm({ f: 659, seq: [[0.1, 988]], ratio: 2, index: 1.5, idur: 0.08, dur: 0.36, gain: 0.3, at: 0.08 });
        this.thud(100, 0.1, 0.35);
        break;
      case 'board-end':
        this.fm({ f: 660, to: 330, ratio: 2, index: 1.2, dur: 0.16, gain: 0.18 });
        this.thud(110, 0.08, 0.25, 0.06);
        break;
      case 'board-lost':
        // The board takes the hit and comes apart.
        this.guardLostAt = now;
        this.click(0, 0.2);
        this.noise({ f: 1800, to: 400, q: 0.9, dur: 0.22, gain: 0.5 });
        this.fm({ f: 520, to: 140, ratio: 2.76, index: 2, dur: 0.24, gain: 0.26 });
        this.thud(90, 0.14, 0.34);
        this.click(0.1, 0.14, -0.3);
        this.click(0.17, 0.1, 0.3);
        break;
      case 'cart-board':
        // Clunk into the tub, and the wheels start to turn.
        this.thud(120, 0.12, 0.45);
        this.fm({ f: 233, ratio: 2.76, index: 2.5, indexTo: 0.4, dur: 0.18, gain: 0.26 });
        this.fm({ f: 110, to: 165, ratio: 0.5, index: 3, dur: 0.42, gain: 0.18, at: 0.04, a: 0.03, lin: true });
        this.noise({ f: 400, to: 900, dur: 0.4, gain: 0.3, at: 0.04, a: 0.05, lin: true });
        break;
      case 'cart-wreck':
      case 'cart-crash':
        // Into the buffer: sub, splintering, and debris landing after.
        this.click(0, 0.4);
        this.thud(52, 0.5, 1.1);
        this.noise({ type: 'lowpass', f: 3800, to: 280, dur: 0.45, gain: 0.6 });
        this.clang(196, 0.4, 0.3);
        this.click(0.19, 0.2, -0.4);
        this.click(0.31, 0.14, 0.4);
        this.click(0.42, 0.08, -0.2);
        break;

      // ---- enemies and hazards
      case 'enemy': {
        // "Pok", then a small explosion.
        const v = vary(1, 0.04);
        this.click(0, 0.12);
        this.tone({ wave: 'sine', f: 880 * v, to: 180 * v, dur: 0.09, gain: 0.27 });
        this.tone({ wave: 'square', f: 560 * v, to: 240 * v, dur: 0.07, gain: 0.12 });
        this.noise({ type: 'lowpass', f: 3200, to: 500, dur: 0.2, gain: 0.5, lin: true });
        this.thud(100, 0.14, 0.28);
        break;
      }
      case 'hopper-stomp': {
        // The same pop, with the spring it was sitting on let go.
        const v = vary(1, 0.04);
        this.click(0, 0.12);
        this.tone({ wave: 'sine', f: 1000 * v, to: 200 * v, dur: 0.09, gain: 0.28 });
        this.fm({ f: 300 * v, glide: [[0.05, 620 * v], [0.12, 380 * v]], index: 5, indexTo: 1, dur: 0.18, gain: 0.2, at: 0.02 });
        this.noise({ type: 'lowpass', f: 3200, to: 500, dur: 0.18, gain: 0.45, lin: true });
        this.thud(105, 0.13, 0.28);
        break;
      }
      case 'crumble':
        // Rubble letting go in three lumps.
        this.click(0, 0.1);
        this.noise({ type: 'lowpass', f: 1600, seq: [[0.07, 1200], [0.15, 900]], dur: 0.3, gain: 0.45 });
        this.fm({ f: 110, to: 55, ratio: 0.5, index: 4, dur: 0.26, gain: 0.15 });
        break;
      case 'phase-blink':
        this.fm({ f: 1245, to: 830, ratio: 2, index: 2, indexTo: 0.3, dur: 0.07, gain: 0.2 });
        break;
      case 'spike-warn':
        this.click(0, 0.1);
        this.tone({ wave: 'pulse12', f: 1245, dur: 0.035, gain: 0.21 });
        break;
      case 'spike-trap':
        // "Shing": steel sliding out, and the stop at full extension.
        this.fm({ f: 1700, to: 2700, ratio: 3.5, index: 2, indexTo: 0.3, dur: 0.14, gain: 0.12 });
        this.noise({ type: 'highpass', f: 4000, dur: 0.07, gain: 0.13 });
        this.thud(140, 0.07, 0.2);
        break;
      case 'stalactite-warn':
        // Crystal cracking overhead: two ticks.
        this.click(0, 0.1);
        this.click(0.09, 0.1);
        this.fm({ f: 1480, seq: [[0.09, 1568]], ratio: 2.4, index: 1.5, idur: 0.04, dur: 0.2, gain: 0.14 });
        break;
      case 'stalactite-fall':
        this.tone({ wave: 'sine', f: 1500, to: 520, dur: 0.26, gain: 0.12, a: 0.02, lin: true });
        this.noise({ f: 3000, to: 1200, q: 3, dur: 0.24, gain: 0.5, a: 0.03 });
        break;
      case 'stalactite-shatter':
        this.click(0, 0.1);
        this.noise({ f: 5200, to: 2200, dur: 0.16, gain: 0.24 });
        this.fm({ f: 2794, seq: [[0.035, 2093], [0.075, 3322], [0.12, 2489]], ratio: 2.4, index: 1.2, idur: 0.03, dur: 0.3, gain: 0.11 });
        this.thud(130, 0.09, 0.2);
        break;

      // ---- boss
      case 'warning':
        // Klaxon: two tones a tritone apart, two cycles. Brass-rough and held,
        // so it reads as an alarm and not as a melody.
        this.fm({ f: 622, seq: [[0.22, 440], [0.44, 622], [0.66, 440]], index: 2.4, indexTo: 1.6, dur: 0.9, gain: 0.3, a: 0.008, hold: 0.15 });
        this.tone({ wave: 'pulse25', f: 311, seq: [[0.22, 220], [0.44, 311], [0.66, 220]], dur: 0.9, gain: 0.14, a: 0.008, hold: 0.15 });
        break;
      case 'boss':
        // He arrives: a low growl opening up, a tritone grinding against its
        // root. No alarm in it — `warning` is the alarm and sits on top.
        this.fm({ f: 73.4, index: 1, indexTo: 5, dur: 0.75, gain: 0.19, a: 0.1, hold: 0.3, lin: true });
        this.fm({ f: 103.8, index: 1, indexTo: 4, dur: 0.75, gain: 0.11, a: 0.14, hold: 0.3, lin: true });
        this.fm({ f: 146.8, index: 1, indexTo: 6, dur: 0.75, gain: 0.08, a: 0.18, hold: 0.3, lin: true });
        this.thud(60, 0.3, 0.45);
        break;
      case 'gate-slam':
        // Both gates at once, one in each ear, and the latches seating as they
        // finish falling 34 frames later.
        this.click(0, 0.5);
        this.thud(56, 0.5, 1.2);
        this.noise({ type: 'lowpass', f: 2600, to: 220, dur: 0.42, gain: 0.6 });
        this.clang(98, 0.55, 0.3, 0, -0.6);
        this.clang(104, 0.55, 0.3, 0.012, 0.6);
        this.thud(110, 0.1, 0.45, 0.57);
        this.click(0.57, 0.25);
        break;
      case 'gate-open':
        // The gates grinding back up on their chains, and locking open.
        this.fm({ f: 82, to: 147, ratio: 0.5, index: 5, indexTo: 3, dur: 0.75, gain: 0.2, a: 0.04, hold: 0.4, lin: true });
        this.noise({ f: 500, to: 1200, q: 1.5, dur: 0.75, gain: 0.5, a: 0.05, lin: true });
        for (let i = 0; i < 4; i++) this.click(0.12 + i * 0.15, 0.14, i % 2 ? 0.5 : -0.5);
        this.thud(120, 0.1, 0.4, 0.76);
        break;
      case 'gate-bump':
        this.thud(95, 0.1, 0.3);
        this.fm({ f: 180, ratio: 1.41, index: 2, dur: 0.12, gain: 0.18 });
        break;
      case 'boss-telegraph':
        // "Bi-BIP": lock-on, the second note up a fourth.
        this.fm({ f: 784, seq: [[0.11, 1047]], index: 2.2, indexTo: 1.2, dur: 0.24, gain: 0.38, hold: 0.04 });
        break;
      case 'boss-hit':
        // Heavy metal: a clang with a second plate ringing off it, and sub.
        this.click(0, 0.14);
        this.clang(311, 0.38, 0.3);
        this.fm({ f: 466, ratio: 2.76, index: 2.5, indexTo: 0.3, dur: 0.26, gain: 0.19, pan: 0.2 });
        this.thud(92, 0.22, 0.42);
        this.noise({ f: 1800, to: 700, dur: 0.1, gain: 0.3, lin: true });
        break;
      case 'boss-slam':
        this.click(0, 0.5);
        this.thud(46, 0.55, 1.3);
        this.noise({ type: 'lowpass', f: 2800, to: 200, dur: 0.45, gain: 0.6 });
        this.clang(131, 0.5, 0.32);
        this.noise({ f: 900, seq: [[0.14, 700], [0.25, 500]], dur: 0.4, gain: 0.3, at: 0.08 });
        break;
      case 'boss-dig':
        // Rock swallowing the rig: the drill, and rubble closing over it.
        this.thud(55, 0.4, 0.52);
        this.noise({ type: 'lowpass', f: 700, seq: [[0.1, 600], [0.2, 500], [0.3, 400]], dur: 0.48, gain: 0.7 });
        this.fm({ f: 82, to: 49, ratio: 3, index: 3, dur: 0.46, gain: 0.22, lin: true });
        break;
      case 'boss-burst':
        // The eruption — the heaviest cue in the fight — with crystal raining after.
        this.click(0, 0.5);
        this.thud(42, 0.62, 1.4);
        this.noise({ type: 'lowpass', f: 4500, to: 240, dur: 0.5, gain: 0.7 });
        this.fm({ f: 98, to: 392, ratio: 0.5, index: 5, indexTo: 2, dur: 0.38, gain: 0.3, at: 0.02, lin: true });
        this.fm({ f: 2637, seq: [[0.05, 1976], [0.11, 3136], [0.18, 2349]], ratio: 2.4, index: 1.2, idur: 0.04, dur: 0.4, gain: 0.12, at: 0.12, pan: 0.4 });
        break;
      case 'boss-shards':
        // A volley you dodge AND feel: the launch thump, then three glass
        // darts fanned left, centre, right.
        this.tone({ wave: 'sine', f: 220, to: 80, dur: 0.09, gain: 0.4 });
        this.noise({ f: 1500, to: 4500, q: 1.5, dur: 0.12, gain: 0.5 });
        [1047, 1319, 1568].forEach((f, i) => this.fm({ f, to: f * 1.12, ratio: 2.4, index: 2, indexTo: 0.3, dur: 0.18, gain: 0.2, at: i * 0.04, pan: (i - 1) * 0.5 }));
        break;
      case 'boss-trace':
        // The Mirage breaks into its run: a buzz winding up through rushing air.
        this.noise({ f: 500, to: 4500, q: 1.2, dur: 0.28, gain: 0.7, a: 0.02 });
        this.fm({ f: 220, to: 880, index: 6, indexTo: 2, dur: 0.32, gain: 0.3, lin: true });
        break;
      case 'boss-derez':
        // Overheated and glitching: a square wave falling down a broken staircase.
        this.tone({ f: 988, seq: [[0.04, 659], [0.08, 1175], [0.12, 494], [0.16, 740], [0.2, 370], [0.26, 247], [0.32, 185]], dur: 0.46, gain: 0.2 });
        this.noise({ type: 'highpass', f: 5000, seq: [[0.08, 5000], [0.16, 6000], [0.26, 4000]], dur: 0.4, gain: 0.24 });
        this.fm({ f: 440, to: 110, ratio: 0.5, index: 2, dur: 0.45, gain: 0.16 });
        break;
      case 'boss-rez':
        this.tone({ f: 185, seq: [[0.035, 277], [0.07, 370], [0.105, 554], [0.14, 740], [0.175, 1109]], dur: 0.32, gain: 0.4 });
        this.noise({ f: 1000, to: 4000, dur: 0.2, gain: 0.5, a: 0.02 });
        break;
      case 'boss-defeated':
        // The chain: six blasts walking across the screen and one last big one,
        // while the machine winds down underneath.
        this.click(0, 0.5);
        this.boom(0, 0.85, -0.3);
        this.boom(0.17, 0.6, 0.45);
        this.boom(0.31, 0.7, -0.5);
        this.boom(0.5, 0.65, 0.25);
        this.boom(0.66, 0.75, -0.15);
        this.boom(0.84, 0.7, 0.5);
        this.boom(1.05, 1.25, 0);
        this.click(1.05, 0.5);
        this.fm({ f: 880, to: 55, ratio: 1.41, index: 2, indexTo: 3, dur: 1.2, gain: 0.14, lin: true });
        break;

      // ---- story
      case 'yolk-laugh':
        this.laugh();
        break;
      case 'yolk-sting':
        // The reveal: brass on D with the E-flat a semitone above and the
        // A-flat a tritone up — nothing in it resolves — over a timpani hit.
        for (const [f, level, side] of [[73.4, 0.19, 0], [146.8, 0.15, -0.3], [155.6, 0.13, 0.3], [207.7, 0.1, 0]]) {
          this.fm({ f, index: 4, indexTo: 1.5, idur: 0.5, dur: 0.9, gain: level, a: 0.02, hold: 0.12, pan: side });
        }
        this.tone({ wave: 'sine', f: 110, glide: [[0.06, 73.4]], dur: 0.6, gain: 0.35, a: 0.001 });
        this.noise({ type: 'lowpass', f: 800, to: 200, dur: 0.1, gain: 0.4 });
        break;
      case 'thunder':
        // The crack, then low noise rolling away, every swell darker than the last.
        this.noise({ type: 'highpass', f: 1800, dur: 0.09, gain: 0.6, a: 0.0005 });
        this.noise({ f: 5000, to: 600, q: 0.7, dur: 0.3, gain: 0.7 });
        this.noise({ type: 'lowpass', f: 420, seq: [[0.32, 300], [0.68, 220], [1.0, 160]], dur: 1.5, gain: 1.4, at: 0.05, a: 0.04 });
        this.tone({ wave: 'sine', f: 62, to: 34, dur: 1.2, gain: 0.5, at: 0.04, a: 0.02 });
        break;
      case 'core-crack':
        // The Chrono Core breaks: one hard crack, then glass notes tumbling
        // down, traded left and right.
        this.click(0, 0.12);
        this.noise({ type: 'highpass', f: 3500, dur: 0.07, gain: 0.17 });
        this.noise({ f: 6500, to: 2500, q: 1.2, dur: 0.3, gain: 0.5 });
        this.thud(98, 0.16, 0.26);
        this.fm({ f: 4186, seq: [[0.09, 3136], [0.2, 2349], [0.33, 1760], [0.48, 1319]], ratio: 2.4, index: 1.4, idur: 0.05, dur: 0.82, gain: 0.18, at: 0.03, pan: -0.5 });
        this.fm({ f: 3520, seq: [[0.1, 2794], [0.22, 2093], [0.36, 1568]], ratio: 2.4, index: 1.4, idur: 0.05, dur: 0.75, gain: 0.16, at: 0.08, pan: 0.5 });
        break;
      case 'beam':
        // Tractor beam: two hums a hair apart, so the beating between them
        // quickens as the pitch climbs.
        this.fm({ f: 98, to: 294, ratio: 2, index: 1.5, indexTo: 3, dur: 1, gain: 0.24, a: 0.12, hold: 0.55, lin: true, pan: -0.2 });
        this.fm({ f: 101, to: 303, ratio: 2, index: 1.5, indexTo: 3, dur: 1, gain: 0.24, a: 0.12, hold: 0.55, lin: true, pan: 0.2 });
        this.noise({ f: 700, to: 3200, q: 3, dur: 1, gain: 0.6, a: 0.2, hold: 0.45, lin: true });
        break;
      case 'time-stop':
        this.timeStop();
        break;
      case 'whoosh':
        this.flyBy();
        break;

      // ---- menus and results: quiet, short, never fatiguing
      case 'ui-move':
        // Fires on every cursor step: one soft pulse tick, three near-identical
        // pitches in rotation so a held direction does not machine-gun.
        this.moveStep = (this.moveStep + 1) % 3;
        this.tone({ wave: 'pulse25', f: 1568 * [1, 0.985, 1.012][this.moveStep], dur: 0.03, gain: 0.13 });
        break;
      case 'ui-confirm':
        this.click(0, 0.05);
        this.fm({ f: 784, seq: [[0.05, 1175]], ratio: 2, index: 1.2, idur: 0.05, dur: 0.2, gain: 0.135 });
        break;
      case 'ui-back':
        this.tone({ wave: 'pulse25', f: 659, seq: [[0.05, 494]], dur: 0.14, gain: 0.15 });
        break;
      case 'ui-error':
        // A low double buzz: clearly NO without sounding like damage.
        this.fm({ f: 196, seq: [[0.1, 185]], index: 3, indexTo: 2, dur: 0.24, gain: 0.09, hold: 0.04 });
        break;
      case 'pause':
        this.fm({ f: 880, seq: [[0.07, 587]], ratio: 2, index: 1, idur: 0.06, dur: 0.22, gain: 0.14 });
        break;
      case 'unpause':
        this.fm({ f: 587, seq: [[0.07, 880]], ratio: 2, index: 1, idur: 0.06, dur: 0.22, gain: 0.14 });
        break;
      case 'tally':
        // A score count-up may call this every frame; capped at ~22 ticks/s,
        // two pitches alternating so it reads as a mechanism, not a buzz.
        this.tallyFlip = !this.tallyFlip;
        this.tone({ wave: 'pulse25', f: this.tallyFlip ? 1760 : 1976, dur: 0.028, gain: 0.1 });
        break;
      case 'tally-end':
        // Ka-ching: the drawer tick, then two bells a fifth apart.
        this.click(0, 0.12);
        this.tone({ wave: 'pulse12', f: 2637, dur: 0.03, gain: 0.08 });
        this.bell(1319, 0.4, 0.2, 0.02, -0.3);
        this.bell(1976, 0.42, 0.17, 0.032, 0.3, 1.2);
        break;
      case 'rank':
        // The rank stamp: a weighty thud, then a brass triad with a bell on top.
        this.thud(105, 0.18, 0.38);
        this.noise({ f: 1400, to: 500, dur: 0.08, gain: 0.25 });
        [523, 659, 784].forEach((f, i) => this.fm({ f, index: 2.4, indexTo: 0.8, dur: 0.4, gain: 0.08, at: 0.05, hold: 0.06, pan: (i - 1) * 0.35 }));
        this.bell(1047, 0.4, 0.1, 0.05);
        break;
      case 'title-card':
        // Whoosh in from the left and away to the right, over a low swoop, and
        // a glint as the card lands.
        this.noise({ f: 400, to: 3200, q: 1.2, dur: 0.28, gain: 0.8, a: 0.03, pan: -0.5 });
        this.noise({ f: 3200, to: 700, q: 1.2, dur: 0.3, gain: 0.5, at: 0.22, a: 0.02, pan: 0.5 });
        this.tone({ wave: 'sine', f: 90, to: 160, dur: 0.4, gain: 0.16, a: 0.02 });
        this.bell(1568, 0.25, 0.07, 0.24);
        break;
      case 'text-blip':
        // Typewriter dialogue: very short and soft, a hair of pitch jitter so
        // a long line does not drone. Throttled for fast text speeds.
        this.tone({ wave: 'pulse25', f: 700 + Math.random() * 70, dur: 0.028, gain: 0.1 });
        break;
      default:
        break;
    }
  }

  /* ------------------------------ Story voices ------------------------------ */

  /**
   * Dr. Yolk laughing, "HA-HA-HA-HA-HA-HAAA" — an arcade speech chip, not a
   * recording. One saw (with a pulse an octave under it for menace) is gated
   * into syllables and pushed through band-passes at 700 and 1100 Hz, the
   * formant pair of an open "A", plus a third at 2.5 kHz for the chip's nasal
   * edge; a puff of noise ahead of each vowel is the "H". Every syllable
   * scoops downward, the phrase falls, and the last one is held and shaken.
   */
  private laugh(): void {
    const ac = this.ac!;
    const t0 = ac.currentTime;
    const out = this.out();
    const voice = ac.createOscillator();
    voice.type = 'sawtooth';
    const under = ac.createOscillator();
    this.setWave(under, 'pulse25');
    const underGain = ac.createGain();
    underGain.gain.value = 0.8;
    // The glottis: opens once per syllable.
    const gate = ac.createGain();
    gate.gain.value = 0;
    const shake = ac.createOscillator();
    shake.frequency.value = 6.5;
    const shakeDepth = ac.createGain();
    shakeDepth.gain.value = 0;
    const breath = ac.createBufferSource();
    breath.buffer = this.mixer.noise;
    breath.loop = true;
    const breathBand = ac.createBiquadFilter();
    breathBand.type = 'bandpass';
    breathBand.frequency.value = 1500;
    breathBand.Q.value = 1.2;
    const breathGate = ac.createGain();
    breathGate.gain.value = 0;
    const nodes: AudioNode[] = [voice, under, underGain, gate, shake, shakeDepth, breath, breathBand, breathGate];

    let end = t0;
    LAUGH.forEach(([at, len, f], i) => {
      const s = t0 + at;
      const last = i === LAUGH.length - 1;
      end = s + len;
      for (const [o, mul] of [[voice, 1], [under, 0.5]] as const) {
        o.frequency.setValueAtTime(f * mul * 1.14, s);
        o.frequency.exponentialRampToValueAtTime(f * mul * 0.9, end);
      }
      breathGate.gain.setValueAtTime(0, s);
      breathGate.gain.linearRampToValueAtTime(0.5, s + 0.008);
      breathGate.gain.linearRampToValueAtTime(0, s + 0.05);
      gate.gain.setValueAtTime(0, s + 0.02);
      gate.gain.linearRampToValueAtTime(1, s + 0.035);
      gate.gain.setValueAtTime(1, end - (last ? 0.3 : 0.035));
      gate.gain.linearRampToValueAtTime(0, end);
      if (last) {
        // Vibrato, in cents, only once the long note has settled.
        shakeDepth.gain.setValueAtTime(0, s + 0.08);
        shakeDepth.gain.linearRampToValueAtTime(45, s + 0.25);
      }
    });

    // A chest band under the formants keeps it a body, not a telephone.
    for (const [type, f, q, level] of [['bandpass', 700, 5, 1.3], ['bandpass', 1100, 7, 1.1], ['bandpass', 2500, 8, 0.5], ['lowpass', 320, 0.7, 0.16]] as const) {
      const band = ac.createBiquadFilter();
      band.type = type;
      band.frequency.value = f;
      band.Q.value = q;
      const g = ac.createGain();
      g.gain.value = level;
      gate.connect(band);
      band.connect(g);
      g.connect(out.node);
      nodes.push(band, g);
    }
    voice.connect(gate);
    under.connect(underGain);
    underGain.connect(gate);
    shake.connect(shakeDepth);
    shakeDepth.connect(voice.detune);
    shakeDepth.connect(under.detune);
    breath.connect(breathBand);
    breathBand.connect(breathGate);
    breathGate.connect(out.node);
    for (const o of [voice, under, shake]) {
      o.start(t0);
      o.stop(end + 0.03);
    }
    breath.start(t0, Math.random() * 1.5);
    breath.stop(end + 0.03);
    this.reap(voice, nodes, out);
  }

  /**
   * Time stops, as a tape does: the pitch falls in a straight line to
   * nothing (so it plunges at the end, where an exponential glide would
   * merely sag), the highs close with it, and a clock's ticks spread apart
   * until the next one never comes.
   */
  private timeStop(): void {
    const ac = this.ac!;
    const t0 = ac.currentTime;
    const dur = 0.9;
    const out = this.out();
    const amp = ac.createGain();
    amp.gain.value = 0;
    amp.gain.setValueAtTime(0, t0);
    amp.gain.linearRampToValueAtTime(1, t0 + 0.005);
    amp.gain.setValueAtTime(1, t0 + 0.3);
    amp.gain.linearRampToValueAtTime(0, t0 + dur);
    const dark = ac.createBiquadFilter();
    dark.type = 'lowpass';
    dark.Q.value = 2;
    dark.frequency.setValueAtTime(2600, t0);
    dark.frequency.linearRampToValueAtTime(110, t0 + dur);
    const nodes: AudioNode[] = [amp, dark];
    // A bare fifth: enough of a chord to hear "music" winding down.
    const tones = ([[392, 0.22], [588, 0.12]] as const).map(([f, level]) => {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t0);
      o.frequency.linearRampToValueAtTime(f * 0.04, t0 + dur);
      const g = ac.createGain();
      g.gain.value = level;
      o.connect(g);
      g.connect(dark);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
      nodes.push(o, g);
      return o;
    });
    const hiss = ac.createBufferSource();
    hiss.buffer = this.mixer.noise;
    hiss.loop = true;
    const band = ac.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 1.5;
    band.frequency.setValueAtTime(3200, t0);
    band.frequency.linearRampToValueAtTime(60, t0 + dur);
    const hissGain = ac.createGain();
    hissGain.gain.value = 0.5;
    hiss.connect(band);
    band.connect(hissGain);
    hissGain.connect(amp);
    hiss.start(t0, Math.random() * 1.5);
    hiss.stop(t0 + dur + 0.02);
    nodes.push(hiss, band, hissGain);
    dark.connect(amp);
    amp.connect(out.node);
    this.reap(tones[0], nodes, out);
    [0, 0.06, 0.13, 0.22, 0.34, 0.5, 0.72].forEach((at, i) => {
      this.tone({ wave: 'pulse12', f: 2200 * (1 - i * 0.11), dur: 0.02, gain: 0.16 * (1 - i * 0.1), at });
    });
  }

  /**
   * Something passing at speed: a band of noise that opens and closes as it
   * crosses from one side to the other, with a Doppler whine dropping as it
   * goes by.
   */
  private flyBy(): void {
    const ac = this.ac!;
    const t0 = ac.currentTime;
    const dur = 0.5;
    const mid = 0.22;
    const sweep = ac.createStereoPanner();
    sweep.pan.setValueAtTime(clamp(this.pan0 - 0.85, -1, 1), t0);
    sweep.pan.linearRampToValueAtTime(clamp(this.pan0 + 0.85, -1, 1), t0 + dur);
    sweep.connect(this.mixer.sfxBus);
    const swell = (g: AudioParam, peak: number): void => {
      g.value = 0;
      g.setValueAtTime(0, t0);
      g.linearRampToValueAtTime(peak, t0 + mid);
      g.linearRampToValueAtTime(0, t0 + dur);
    };
    const air = ac.createBufferSource();
    air.buffer = this.mixer.noise;
    air.loop = true;
    const band = ac.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 1.2;
    band.frequency.setValueAtTime(500, t0);
    band.frequency.exponentialRampToValueAtTime(3600, t0 + mid);
    band.frequency.exponentialRampToValueAtTime(800, t0 + dur);
    const airGain = ac.createGain();
    swell(airGain.gain, 0.9);
    const whine = ac.createOscillator();
    whine.type = 'triangle';
    whine.frequency.setValueAtTime(1180, t0);
    whine.frequency.exponentialRampToValueAtTime(1100, t0 + mid - 0.05);
    whine.frequency.exponentialRampToValueAtTime(640, t0 + mid + 0.1);
    whine.frequency.exponentialRampToValueAtTime(600, t0 + dur);
    const whineGain = ac.createGain();
    swell(whineGain.gain, 0.12);
    air.connect(band);
    band.connect(airGain);
    airGain.connect(sweep);
    whine.connect(whineGain);
    whineGain.connect(sweep);
    air.start(t0, Math.random() * 1.5);
    air.stop(t0 + dur + 0.02);
    whine.start(t0);
    whine.stop(t0 + dur + 0.02);
    this.reap(air, [air, band, airGain, whine, whineGain], { node: sweep, voices: 1 });
  }
}
