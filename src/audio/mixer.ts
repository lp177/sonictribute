/**
 * The one AudioContext and the mix every sound goes through:
 *
 *   sfxBus ─→ sfx volume ─────────────────────────────────┐
 *   music tracks ─→ musicBus ─→ glue ─→ music volume ─→ duck ─┼─→ master ─→ limiter ─→ safety clip ─→ out
 *   sends ─→ ping-pong delay + reverb ─→ musicBus
 *
 * Music and effects each follow their player-set volume on a perceptual
 * (squared) curve, so the slider's midpoint SOUNDS like half rather than
 * barely quieter than full. The music has its own gentle bus compressor
 * (glue) BEFORE its fader, so kick transients stop dictating the headroom and
 * the band sounds the same at every volume setting. The master compressor
 * keeps a boss slam over a busy chorus from clipping; the waveshaper after it
 * is a last-resort soft clip that guarantees no sample ever leaves [-1, 1].
 *
 * The graph can also be built on an OfflineAudioContext (pass `context`), which
 * is how the soundtrack is rendered and measured headless.
 */
import { onSettingsChange, settings } from '../core/settings.ts';

/**
 * Bus levels at volume 1, calibrated by offline render (see music.ts
 * `renderOffline`). At the default settings the music's loop body sits near
 * -24.5 dBFS RMS with peaks around -8 dBFS, and everyday effects (ring, jump,
 * stomp) peak a few dB ABOVE the music — the console-game convention of a
 * music bed under readable effects.
 */
export const MUSIC_LEVEL = 0.6;
export const SFX_LEVEL = 1;
/** How far the music drops while the pause menu is open. */
export const DUCK_DB = -9;
/** Volume changes ramp instead of stepping, so dragging the slider never zips. */
const VOLUME_TAU = 0.04;

export const dbToGain = (db: number): number => 10 ** (db / 20);
export const gainToDb = (g: number): number => 20 * Math.log10(Math.max(g, 1e-9));

/** Slider position (0..1) → linear gain. Squared: perceptual loudness is roughly logarithmic. */
export function volumeCurve(v: number): number {
  const c = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
  return c * c;
}

export type ExtraWave = 'pulse25' | 'pulse12';

export interface MixerOptions {
  /** Build on this context right away (OfflineAudioContext rendering, tests). */
  context?: BaseAudioContext;
  /** Volume source; defaults to the live game settings (and follows their changes). */
  volumes?: () => { musicVolume: number; sfxVolume: number };
}

type AudioCtor = new (opts?: AudioContextOptions) => AudioContext;

export class AudioMixer {
  private ctx: BaseAudioContext | null = null;
  /** True when WE created a realtime AudioContext (offline contexts cannot suspend/resume). */
  private realtime = false;
  /** suspend() was asked for (page hidden): a stray ensure() must not wake it. */
  private parked = false;
  /** A real user gesture has reached us (see `unlock`). */
  private unlocked = false;
  private readyFns: ((ctx: BaseAudioContext) => void)[] = [];
  private unsubscribe: (() => void) | null = null;
  private readonly volumes: () => { musicVolume: number; sfxVolume: number };
  private noiseBuf: AudioBuffer | null = null;
  private waves = new Map<ExtraWave, PeriodicWave>();

  private masterGain!: GainNode;
  private musicIn!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private duckGain!: GainNode;
  private delayL!: DelayNode;
  private delayR!: DelayNode;
  private feedback!: GainNode;
  private delayInput!: GainNode;
  private reverbInput!: GainNode;

  constructor(opts: MixerOptions = {}) {
    this.volumes = opts.volumes ?? settings;
    if (!opts.volumes) this.unsubscribe = onSettingsChange(() => this.applyVolumes());
    if (opts.context) this.build(opts.context);
  }

  get context(): BaseAudioContext | null {
    return this.ctx;
  }

  get ready(): boolean {
    return this.ctx !== null;
  }

  /**
   * True when a sound scheduled now will actually be heard now. A realtime
   * context that the browser is still holding suspended (autoplay policy, no
   * gesture yet) keeps its clock at zero: anything booked on it piles up and
   * fires in one burst the moment it wakes, so one-shot effects must be
   * dropped until then. Offline contexts (rendering, tests) always qualify.
   */
  get audible(): boolean {
    if (!this.ctx) return false;
    if (!this.realtime) return true;
    if (this.parked) return false;
    return this.unlocked || (this.ctx as AudioContext).state === 'running';
  }

  /** Context time in seconds; 0 before audio exists. */
  get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** Music tracks connect here (pre-glue, pre-volume, pre-duck). */
  get musicBus(): GainNode {
    return this.musicIn;
  }

  get sfxBus(): GainNode {
    return this.sfxGain;
  }

  /** Send inputs of the shared effects; their return lands on the music bus. */
  get delaySend(): GainNode {
    return this.delayInput;
  }

  get reverbSend(): GainNode {
    return this.reverbInput;
  }

  /**
   * Creates the context on first call — browsers only allow audio to start
   * from a user gesture, so call this from a key/click handler. Later calls
   * resume a context the browser suspended (autoplay policy, iOS interruption).
   */
  ensure(): BaseAudioContext | null {
    if (!this.ctx) {
      const g = globalThis as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
      const Ctor = g.AudioContext ?? g.webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.realtime = true;
        this.build(new Ctor({ latencyHint: 'interactive' }));
      } catch {
        this.realtime = false;
        return null;
      }
    }
    if (this.realtime && !this.parked) {
      const ac = this.ctx as AudioContext;
      if (ac.state !== 'running' && ac.state !== 'closed') void ac.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Call from INSIDE a user-gesture handler (keydown, pointerdown, touchend).
   * Browsers only let audio start from one, and Safari insists the resume
   * happens in the handler itself — a later frame is too late.
   */
  unlock(): BaseAudioContext | null {
    this.unlocked = true;
    return this.ensure();
  }

  /** Runs `fn` once the context exists (immediately if it already does). */
  onReady(fn: (ctx: BaseAudioContext) => void): void {
    if (this.ctx) fn(this.ctx);
    else this.readyFns.push(fn);
  }

  /** Page hidden: stop the audio clock (no CPU, no throttled-timer catch-up). */
  async suspend(): Promise<void> {
    this.parked = true;
    if (this.realtime && this.ctx && (this.ctx as AudioContext).state === 'running') {
      await (this.ctx as AudioContext).suspend().catch(() => {});
    }
  }

  /** Page visible again. */
  async resume(): Promise<void> {
    this.parked = false;
    if (this.realtime && this.ctx && (this.ctx as AudioContext).state !== 'closed') {
      await (this.ctx as AudioContext).resume().catch(() => {});
    }
  }

  /** Pause-menu duck on the music only; effects keep their level. */
  duck(on: boolean): void {
    if (!this.ctx) return;
    this.duckGain.gain.setTargetAtTime(on ? dbToGain(DUCK_DB) : 1, this.ctx.currentTime, 0.08);
  }

  /** Re-times the ping-pong delay (tempo-synced per track). */
  setEcho(seconds: number, feedback: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = Math.max(0.05, Math.min(1.9, seconds));
    this.delayL.delayTime.setTargetAtTime(s, t, 0.05);
    this.delayR.delayTime.setTargetAtTime(s, t, 0.05);
    this.feedback.gain.setTargetAtTime(Math.max(0, Math.min(0.7, feedback)), t, 0.05);
  }

  /**
   * Two seconds of white noise shared by every hat, snare and whoosh. Voices
   * start it at a random offset, so one buffer never sounds like a loop — and
   * nothing allocates a fresh AudioBuffer per hit.
   */
  get noise(): AudioBuffer {
    if (!this.noiseBuf) {
      const ctx = this.ctx!;
      const len = Math.floor(ctx.sampleRate * 2);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    return this.noiseBuf;
  }

  /** Band-limited pulse waves (25 % and 12.5 % duty) — the chiptune lead colours. */
  wave(kind: ExtraWave): PeriodicWave {
    let w = this.waves.get(kind);
    if (!w) {
      const duty = kind === 'pulse25' ? 0.25 : 0.125;
      const n = 64;
      const real = new Float32Array(n);
      const imag = new Float32Array(n);
      for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
      w = this.ctx!.createPeriodicWave(real, imag);
      this.waves.set(kind, w);
    }
    return w;
  }

  /** Stops following settings (offline mixers, tests). */
  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const v = this.volumes();
    const t = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(MUSIC_LEVEL * volumeCurve(v.musicVolume), t, VOLUME_TAU);
    this.sfxGain.gain.setTargetAtTime(SFX_LEVEL * volumeCurve(v.sfxVolume), t, VOLUME_TAU);
  }

  private build(ctx: BaseAudioContext): void {
    this.ctx = ctx;
    const v = this.volumes();

    // Glue, not squash: a soft knee a few dB under full scale. Browsers add
    // automatic makeup gain to this node, so the calibration constants above
    // are measured through it.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 8;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;

    // Transparent below 0.6, then a tanh shoulder that never reaches 1.
    const clip = ctx.createWaveShaper();
    const N = 2048;
    const curve = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * 2 - 1;
      const a = Math.abs(x);
      const y = a <= 0.6 ? a : 0.6 + 0.38 * Math.tanh((a - 0.6) / 0.38);
      curve[i] = Math.sign(x) * y;
    }
    clip.curve = curve;

    this.masterGain = ctx.createGain();
    this.masterGain.connect(comp);
    comp.connect(clip);
    clip.connect(ctx.destination);

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = SFX_LEVEL * volumeCurve(v.sfxVolume);
    this.sfxGain.connect(this.masterGain);

    this.duckGain = ctx.createGain();
    this.duckGain.connect(this.masterGain);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = MUSIC_LEVEL * volumeCurve(v.musicVolume);
    this.musicGain.connect(this.duckGain);
    // Bus glue: a slow-ish, low-ratio compressor that shaves the kick and
    // bass transients a few dB. It sits before the fader so its behaviour
    // (and the band's punch) does not change with the music volume.
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -12;
    glue.knee.value = 10;
    glue.ratio.value = 2.5;
    glue.attack.value = 0.006;
    glue.release.value = 0.18;
    glue.connect(this.musicGain);
    this.musicIn = ctx.createGain();
    this.musicIn.connect(glue);

    // Ping-pong delay: L echoes, feeds R, which feeds back into L. The loop is
    // band-limited so repeats darken and thin out like a real cave, instead of
    // piling up low-end mud under the bass.
    this.delayInput = ctx.createGain();
    this.delayL = ctx.createDelay(2);
    this.delayR = ctx.createDelay(2);
    this.delayL.delayTime.value = 0.375;
    this.delayR.delayTime.value = 0.375;
    this.feedback = ctx.createGain();
    this.feedback.gain.value = 0.35;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 280;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    const panL = ctx.createStereoPanner();
    panL.pan.value = -0.7;
    const panR = ctx.createStereoPanner();
    panR.pan.value = 0.7;
    this.delayInput.connect(hp);
    hp.connect(lp);
    lp.connect(this.delayL);
    this.delayL.connect(panL);
    this.delayL.connect(this.delayR);
    this.delayR.connect(panR);
    this.delayR.connect(this.feedback);
    this.feedback.connect(this.delayL);
    panL.connect(this.musicIn);
    panR.connect(this.musicIn);

    this.reverbInput = ctx.createGain();
    const verb = ctx.createConvolver();
    verb.buffer = impulse(ctx, 2.4, 2.6);
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.6;
    this.reverbInput.connect(verb);
    verb.connect(verbOut);
    verbOut.connect(this.musicIn);

    const fns = this.readyFns;
    this.readyFns = [];
    for (const fn of fns) fn(ctx);
  }
}

/**
 * A synthetic room: stereo noise with an exponential decay that also darkens
 * over time (a one-pole lowpass whose cutoff falls), like air absorbing the
 * highs of a long tail. Generated once per context.
 */
function impulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const k = 0.65 - 0.55 * t; // smoothing: bright early reflections, dull tail
      lp += k * (Math.random() * 2 - 1 - lp);
      d[i] = lp * (1 - t) ** decay;
    }
    // A short pre-delay keeps the dry attack in front of the wash.
    for (let i = 0; i < Math.min(len, Math.floor(rate * 0.012)); i++) d[i] = 0;
  }
  return buf;
}
