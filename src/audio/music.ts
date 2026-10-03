/**
 * The music player: a small tracker that turns compiled songs (songs.ts) into
 * Web Audio voices.
 *
 * Scheduling follows "A Tale of Two Clocks": a coarse JS timer (25 ms) wakes
 * up and books every step that falls inside the next ~120 ms on the AUDIO
 * clock, so notes land sample-accurately no matter how late the timer fires.
 * JS never plays a note "now" — it always says "at t".
 *
 * Things a game soundtrack needs beyond a loop:
 * - play() before the first user gesture is remembered and starts the moment
 *   the mixer creates the context;
 * - switching tracks crossfades (the old song keeps playing under its fade);
 * - jingles play once and report back through `onEnd`;
 * - speed shoes nudge the tempo, eased over a few steps instead of lurching;
 * - a throttled background tab never "catches up" with a burst of notes: the
 *   player skips forward to where the song should be.
 *
 * Every note's nodes are disconnected when its oscillator ends, so a long
 * session does not accumulate a graph.
 */
import { AudioMixer } from './mixer.ts';
import {
  compileSong,
  midiToFreq,
  stepSeconds,
  type CompiledSong,
  type DrumName,
  type DrumPatch,
  type NoteEvent,
  type Section,
  type TonePatch,
} from './notation.ts';
import { SONGS, type TrackId } from './songs.ts';

export type { TrackId } from './songs.ts';

export interface PlayOptions {
  /** Start over even if this track is already playing. */
  restart?: boolean;
  /** Seconds to fade the new track in (0 = straight in). */
  fadeIn?: number;
  /** Called once when a non-looping track (jingle) has finished. */
  onEnd?: () => void;
}

const TICK_MS = 25;
/** How far ahead notes are booked while the page is visible. */
const LOOKAHEAD = 0.12;
/** Hidden tabs throttle timers to ~1 Hz: book further ahead so the music does not gap. */
const HIDDEN_LOOKAHEAD = 1.6;
/** First note of a new track lands this far after "now" (time for the graph to settle). */
const START_LEAD = 0.05;
/** Crossfade length when a track replaces another and no fade was asked for. */
const SWAP_FADE = 0.35;
/** Longest release/ring a voice can have — how long a stopped track's strips live on. */
const TAIL = 2.5;
/** Speed shoes: the tempo eases toward its target by this fraction per step. */
const TEMPO_EASE = 0.3;

const isHidden = (): boolean => typeof document !== 'undefined' && document.hidden === true;

const compiled = new Map<TrackId, CompiledSong>();
/** Songs are parsed on first use and kept. */
export function getSong(id: TrackId): CompiledSong {
  let s = compiled.get(id);
  if (!s) {
    s = compileSong(SONGS[id]);
    compiled.set(id, s);
  }
  return s;
}

/** Per-instrument channel strip: level, pan and the two effect sends. */
interface Strip {
  input: GainNode;
  nodes: AudioNode[];
}

/** One song instance. Several can exist during a crossfade. */
class TrackPlayer {
  readonly id: TrackId;
  private readonly song: CompiledSong;
  private section: Section;
  private inIntro: boolean;
  private pos = 0;
  /** Absolute step counter (for swing parity and tempo easing). */
  private count = 0;
  private nextTime: number;
  private tempo: number;
  private strips = new Map<string, Strip>();
  private lastFreq = new Map<string, number>();
  private readonly out: GainNode;
  private readonly sendDelay: GainNode;
  private readonly sendVerb: GainNode;
  /** No note may start at or after this time (fade-out end). */
  private cutoff = Infinity;
  /** When the last note of a jingle has rung out. */
  private endsAt = Infinity;
  private ended = false;
  /** onEnd is owed to the caller (delivered by Music outside the tick loop). */
  endDue = false;
  disposed = false;
  private readonly ctx: BaseAudioContext;
  private readonly mixer: AudioMixer;
  private readonly music: Music;
  readonly onEnd?: () => void;

  constructor(
    ctx: BaseAudioContext,
    mixer: AudioMixer,
    music: Music,
    id: TrackId,
    start: number,
    fadeIn: number,
    onEnd?: () => void,
  ) {
    this.ctx = ctx;
    this.mixer = mixer;
    this.music = music;
    this.onEnd = onEnd;
    this.id = id;
    this.song = getSong(id);
    this.inIntro = this.song.intro.steps > 0;
    this.section = this.inIntro ? this.song.intro : this.song.main;
    this.nextTime = start;
    this.tempo = music.tempoScale;

    const trim = this.song.def.gain ?? 1;
    this.out = ctx.createGain();
    this.sendDelay = ctx.createGain();
    this.sendVerb = ctx.createGain();
    for (const g of [this.out, this.sendDelay, this.sendVerb]) {
      if (fadeIn > 0) {
        // Silent until it starts: a fade-out issued before then must ramp from 0, not from 1.
        g.gain.value = 0;
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(trim, start + fadeIn);
      } else g.gain.value = trim;
    }
    this.out.connect(mixer.musicBus);
    this.sendDelay.connect(mixer.delaySend);
    this.sendVerb.connect(mixer.reverbSend);

    const echo = this.song.def.echo;
    if (echo) mixer.setEcho((echo.beats * 60) / this.song.def.bpm, echo.feedback);
    else mixer.setEcho((0.75 * 60) / this.song.def.bpm, 0.25);
  }

  get finished(): boolean {
    return this.ended;
  }

  /** Fade to silence over `dur` seconds from `at`, then stop booking notes. */
  fadeOut(at: number, dur: number): void {
    const d = Math.max(0.01, dur);
    for (const g of [this.out, this.sendDelay, this.sendVerb]) {
      g.gain.cancelScheduledValues(at);
      g.gain.setValueAtTime(g.gain.value, at);
      g.gain.linearRampToValueAtTime(0, at + d);
    }
    this.cutoff = Math.min(this.cutoff, at + d);
  }

  /** Books every step that starts before `horizon`. Returns false once the player can be dropped. */
  tick(now: number, horizon: number): boolean {
    if (this.disposed) return false;
    if (this.cutoff !== Infinity && now > this.cutoff + TAIL) {
      this.dispose();
      return false;
    }
    if (this.endsAt !== Infinity && now >= this.endsAt) {
      if (!this.ended) {
        this.ended = true;
        this.endDue = !!this.onEnd;
      }
      if (now > this.endsAt + TAIL) {
        this.dispose();
        return false;
      }
      return true;
    }
    // A throttled timer woke up late: jump to where the song should be
    // instead of firing every missed note at once.
    if (this.nextTime < now - 0.05) {
      while (this.nextTime < now && this.endsAt === Infinity) this.advance(false);
    }
    while (this.nextTime < horizon && this.nextTime < this.cutoff && this.endsAt === Infinity) {
      this.advance(true);
    }
    return true;
  }

  private advance(play: boolean): void {
    const base = stepSeconds(this.song.def.bpm);
    // Ease toward the requested tempo a little each step: speed shoes
    // accelerate the band rather than cutting to a faster recording.
    const target = this.music.tempoScale;
    this.tempo += (target - this.tempo) * TEMPO_EASE;
    if (Math.abs(target - this.tempo) < 0.002) this.tempo = target;
    const dur = base / this.tempo;
    if (play) {
      const swing = this.count % 2 === 1 ? (this.song.def.swing ?? 0) * dur : 0;
      for (const ev of this.section.events[this.pos]) this.playEvent(ev, this.nextTime + swing, ev.steps * dur);
    }
    this.nextTime += dur;
    this.count++;
    this.pos++;
    if (this.pos >= this.section.steps) {
      this.pos = 0;
      if (this.inIntro) {
        this.inIntro = false;
        this.section = this.song.main;
      } else if (!this.song.def.loop) {
        this.endsAt = this.nextTime + 0.6;
      }
    }
  }

  private strip(lane: string): Strip {
    let s = this.strips.get(lane);
    if (s) return s;
    const patch = this.song.def.instruments[lane];
    const ctx = this.ctx;
    const input = ctx.createGain();
    const pan = ctx.createStereoPanner();
    pan.pan.value = patch.pan ?? 0;
    input.connect(pan);
    pan.connect(this.out);
    const nodes: AudioNode[] = [input, pan];
    if (patch.delay) {
      const g = ctx.createGain();
      g.gain.value = patch.delay;
      input.connect(g);
      g.connect(this.sendDelay);
      nodes.push(g);
    }
    if (patch.reverb) {
      const g = ctx.createGain();
      g.gain.value = patch.reverb;
      input.connect(g);
      g.connect(this.sendVerb);
      nodes.push(g);
    }
    s = { input, nodes };
    this.strips.set(lane, s);
    return s;
  }

  private playEvent(ev: NoteEvent, t: number, dur: number): void {
    const patch = this.song.def.instruments[ev.lane];
    const strip = this.strip(ev.lane);
    if (patch.kind === 'drums') {
      for (const d of ev.drums) drum(this.ctx, this.mixer, patch, strip.input, d, t, ev.vel);
      return;
    }
    const shiftOct = 12 * (patch.octave ?? 0);
    const freqs = ev.midi.map((m) => midiToFreq(m + shiftOct));
    const from = ev.glide ? this.lastFreq.get(ev.lane) : undefined;
    tone(this.ctx, this.mixer, patch, strip.input, freqs, t, dur, ev.vel, from);
    this.lastFreq.set(ev.lane, freqs[freqs.length - 1]);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const s of this.strips.values()) for (const n of s.nodes) n.disconnect();
    this.strips.clear();
    this.out.disconnect();
    this.sendDelay.disconnect();
    this.sendVerb.disconnect();
  }
}

/** Disconnects a voice's nodes once its last source has stopped. */
function cleanupOnEnd(src: AudioScheduledSourceNode, nodes: AudioNode[]): void {
  src.onended = () => {
    for (const n of nodes) n.disconnect();
  };
}

function setWave(osc: OscillatorNode, mixer: AudioMixer, wave: TonePatch['wave']): void {
  if (wave === 'pulse25' || wave === 'pulse12') osc.setPeriodicWave(mixer.wave(wave));
  else osc.type = wave;
}

/**
 * One pitched note (or chord): unison oscillators → optional filter with its
 * own envelope → amplitude ADSR → the instrument's strip.
 */
function tone(
  ctx: BaseAudioContext,
  mixer: AudioMixer,
  p: TonePatch,
  dest: AudioNode,
  freqs: number[],
  t: number,
  writtenDur: number,
  vel: number,
  glideFrom?: number,
): void {
  const unison = Math.max(1, p.unison ?? 1);
  const voices = freqs.length * unison;
  // Detuned copies add up incoherently (power, not amplitude): 1/sqrt(n)
  // keeps a supersaw chord as loud as a single note, not eight times louder.
  const peak = (p.gain * vel) / Math.sqrt(voices);
  const a = Math.max(0.001, p.attack);
  const dur = Math.max(writtenDur * (p.gate ?? 0.92), a + 0.01);
  const off = t + dur;
  const end = off + p.release * 1.2 + 0.02;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(peak, t + a);
  if (p.sustain < 1) env.gain.setTargetAtTime(peak * p.sustain, t + a, Math.max(0.005, p.decay / 3));
  env.gain.setTargetAtTime(0, off, Math.max(0.004, p.release / 5));
  env.connect(dest);
  const nodes: AudioNode[] = [env];

  let input: AudioNode = env;
  if (p.filter) {
    const f = ctx.createBiquadFilter();
    f.type = p.filter.type ?? 'lowpass';
    f.Q.value = p.filter.q ?? 0.7;
    const base = p.filter.freq;
    if (p.filter.env) {
      f.frequency.setValueAtTime(Math.min(18000, base + p.filter.env * vel), t);
      f.frequency.setTargetAtTime(base, t + 0.002, Math.max(0.005, (p.filter.envDecay ?? 0.2) / 3));
    } else f.frequency.value = base;
    f.connect(env);
    nodes.push(f);
    input = f;
  }

  let vib: GainNode | null = null;
  if (p.vibrato && dur > p.vibrato.delay + 0.05) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = p.vibrato.rate;
    vib = ctx.createGain();
    vib.gain.setValueAtTime(0, t + p.vibrato.delay);
    vib.gain.linearRampToValueAtTime(p.vibrato.depth, t + p.vibrato.delay + 0.25);
    lfo.connect(vib);
    lfo.start(t);
    lfo.stop(end);
    nodes.push(lfo, vib);
  }

  const spread = p.detune ?? 0;
  let last: OscillatorNode | null = null;
  for (const f of freqs) {
    for (let u = 0; u < unison; u++) {
      const osc = ctx.createOscillator();
      setWave(osc, mixer, p.wave);
      if (unison > 1) osc.detune.value = spread * (u / (unison - 1) - 0.5) * 2;
      if (glideFrom && freqs.length === 1) {
        osc.frequency.setValueAtTime(glideFrom, t);
        osc.frequency.exponentialRampToValueAtTime(f, t + (p.glide ?? 0.06));
      } else osc.frequency.value = f;
      if (vib) vib.connect(osc.detune);
      osc.connect(input);
      osc.start(t);
      osc.stop(end);
      nodes.push(osc);
      last = osc;
    }
    if (p.sub) {
      const s = ctx.createOscillator();
      s.type = 'sine';
      s.frequency.value = f / 2;
      const sg = ctx.createGain();
      sg.gain.value = p.sub;
      s.connect(sg);
      sg.connect(env); // under the filter: the sub stays round whatever the cutoff does
      s.start(t);
      s.stop(end);
      nodes.push(s, sg);
    }
  }
  if (last) cleanupOnEnd(last, nodes);
}

function noiseSource(ctx: BaseAudioContext, mixer: AudioMixer, t: number, dur: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = mixer.noise;
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur);
  return src;
}

/** Per-voice placement in the stereo field (like a real kit seen from the drummer's stool). */
const DRUM_PAN: Partial<Record<DrumName, number>> = {
  hat: 0.25,
  open: 0.25,
  shaker: -0.3,
  tomHi: 0.3,
  tomLo: -0.3,
  metal: -0.2,
  rim: 0.15,
  crash: -0.15,
};

/** Synthesised drum voices. Every node is released when the voice ends. */
function drum(
  ctx: BaseAudioContext,
  mixer: AudioMixer,
  p: DrumPatch,
  dest: AudioNode,
  name: DrumName,
  t: number,
  vel: number,
): void {
  const lvl = p.gain * vel * (p.levels?.[name] ?? 1);
  if (lvl <= 0) return;
  const tune = p.tune ?? 1;
  const dk = p.decay ?? 1;
  const out = ctx.createGain();
  out.gain.value = lvl;
  const nodes: AudioNode[] = [out];
  const pan = DRUM_PAN[name];
  if (pan) {
    const sp = ctx.createStereoPanner();
    sp.pan.value = pan;
    out.connect(sp);
    sp.connect(dest);
    nodes.push(sp);
  } else out.connect(dest);

  /** A pitched body: sine/triangle dropping from f0 to f1. */
  const body = (type: OscillatorType, f0: number, f1: number, drop: number, len: number, level: number): OscillatorNode => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + drop);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + len + 0.01);
    nodes.push(o, g);
    return o;
  };
  /** Filtered noise with an exponential decay. */
  const hiss = (type: BiquadFilterType, freq: number, q: number, len: number, level: number, attack = 0): AudioBufferSourceNode => {
    const src = noiseSource(ctx, mixer, t, len + 0.01);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    if (attack > 0) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(level, t + attack);
    } else g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    nodes.push(src, f, g);
    return src;
  };

  let last: AudioScheduledSourceNode;
  switch (name) {
    case 'kick':
      // Sine pitch drop for the thump, a 5 ms noise tick so it reads on laptop speakers.
      hiss('highpass', 2500, 0.7, 0.012, 0.3);
      last = body('sine', 155 * tune, 46 * tune, 0.11, 0.42 * dk, 0.85);
      break;
    case 'snare':
      body('triangle', 210 * tune, 160 * tune, 0.06, 0.11 * dk, 0.55);
      last = hiss('highpass', 1300, 0.8, 0.19 * dk, 0.7);
      break;
    case 'clap': {
      // Three ragged bursts then a short tail: hands that are never quite together.
      const src = noiseSource(ctx, mixer, t, 0.25 * dk);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1300;
      f.Q.value = 1.1;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      for (const o of [0, 0.011, 0.022]) {
        g.gain.setValueAtTime(0.9, t + o);
        g.gain.exponentialRampToValueAtTime(0.15, t + o + 0.009);
      }
      g.gain.setValueAtTime(0.7, t + 0.031);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.24 * dk);
      src.connect(f);
      f.connect(g);
      g.connect(out);
      nodes.push(src, f, g);
      last = src;
      break;
    }
    case 'hat':
      last = hiss('highpass', 6500, 0.9, 0.05 * dk, 0.75);
      break;
    case 'open':
      last = hiss('highpass', 6000, 0.9, 0.3 * dk, 0.5);
      break;
    case 'shaker':
      last = hiss('bandpass', 5800, 0.9, 0.07 * dk, 0.9, 0.012);
      break;
    case 'crash':
      hiss('bandpass', 5200, 0.6, 0.5 * dk, 0.25);
      last = hiss('highpass', 4200, 0.7, 1.5 * dk, 0.32);
      break;
    case 'tomLo':
      last = body('sine', 140 * tune, 82 * tune, 0.18, 0.32 * dk, 0.9);
      break;
    case 'tomHi':
      last = body('sine', 210 * tune, 128 * tune, 0.16, 0.26 * dk, 0.85);
      break;
    case 'rim':
      hiss('bandpass', 2600, 2, 0.02, 0.4);
      last = body('triangle', 1650 * tune, 1500 * tune, 0.02, 0.045, 0.55);
      break;
    case 'metal': {
      // An anvil / factory clank: inharmonic square partials through a
      // resonant band — the 808 cymbal recipe tuned down into iron.
      const len = 0.22 * dk;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2900 * tune;
      bp.Q.value = 2.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.7, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + len);
      bp.connect(g);
      g.connect(out);
      nodes.push(bp, g);
      let o: OscillatorNode | null = null;
      for (const f of [263, 400, 532, 731]) {
        o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = f * 1.9 * tune;
        o.connect(bp);
        o.start(t);
        o.stop(t + len + 0.01);
        nodes.push(o);
      }
      last = o!;
      break;
    }
  }
  cleanupOnEnd(last, nodes);
}

export class Music {
  private players: TrackPlayer[] = [];
  private active: TrackPlayer | null = null;
  private pending: { id: TrackId; opts: PlayOptions } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private target = 1;
  private ducked = false;
  private pumping = false;
  /** Offline rendering drives the clock by hand (`pump`). */
  private readonly manual: boolean;
  readonly mixer: AudioMixer;

  constructor(mixer: AudioMixer, opts: { manualClock?: boolean } = {}) {
    this.mixer = mixer;
    this.manual = !!opts.manualClock;
    mixer.onReady(() => {
      if (this.ducked) mixer.duck(true);
      const p = this.pending;
      this.pending = null;
      if (p) this.play(p.id, p.opts);
    });
  }

  /** The track playing (or requested before audio was unlocked); null when silent. */
  get current(): TrackId | null {
    if (this.pending) return this.pending.id;
    if (!this.active || this.active.finished) return null;
    return this.active.id;
  }

  /** Requested tempo multiplier (1 = as written). */
  get tempoScale(): number {
    return this.target;
  }

  play(id: TrackId, opts: PlayOptions = {}): void {
    const ctx = this.mixer.context;
    if (!ctx) {
      // No user gesture yet: remember the latest request.
      if (this.pending?.id === id && !opts.restart) return;
      this.pending = { id, opts };
      return;
    }
    if (this.active && this.active.id === id && !this.active.finished && !opts.restart) return;
    const now = ctx.currentTime;
    const fadeIn = Math.max(0, opts.fadeIn ?? 0);
    if (this.active) {
      this.active.fadeOut(now, Math.max(SWAP_FADE, fadeIn));
    }
    const p = new TrackPlayer(ctx, this.mixer, this, id, now + START_LEAD, fadeIn, opts.onEnd);
    this.players.push(p);
    this.active = p;
    this.pump();
    this.startTimer();
  }

  stop(fadeOut = 0.6): void {
    this.pending = null;
    const ctx = this.mixer.context;
    if (this.active && ctx) this.active.fadeOut(ctx.currentTime, fadeOut);
    this.active = null;
  }

  /** Speed shoes: 1.2 for a lively boost. Applied from the next step, eased over a few. */
  setTempoScale(scale: number): void {
    this.target = Math.max(0.5, Math.min(2, Number.isFinite(scale) ? scale : 1));
  }

  /** Pause menu: pull the music down a few dB without stopping it. */
  duck(on: boolean): void {
    this.ducked = on;
    this.mixer.duck(on);
  }

  /**
   * Books notes up to `until` (default: now + lookahead). Called by the timer;
   * offline rendering calls it once with the full length.
   */
  pump(until?: number): void {
    const ctx = this.mixer.context;
    if (!ctx) return;
    if (this.pumping) return;
    this.pumping = true;
    const now = ctx.currentTime;
    const horizon = until ?? now + (isHidden() ? HIDDEN_LOOKAHEAD : LOOKAHEAD);
    const ticked = this.players;
    this.players = ticked.filter((p) => p.tick(now, horizon));
    this.pumping = false;
    if (this.active && this.active.disposed) this.active = null;
    // Jingle callbacks run only now, outside the tick loop: an onEnd that
    // starts the next track (the usual thing to do) must not race the list.
    // Read from the pre-filter list so a late tick that both ends and drops
    // a jingle still delivers its callback.
    for (const p of ticked) {
      if (!p.endDue) continue;
      p.endDue = false;
      p.onEnd?.();
    }
    if (!this.players.length) this.stopTimer();
  }

  private startTimer(): void {
    if (this.manual || this.timer !== null) return;
    this.timer = setInterval(() => this.pump(), TICK_MS);
  }

  private stopTimer(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}

/**
 * Renders a track (optionally with sound effects layered on top) into an
 * OfflineAudioContext through the real mixer — what the game would output,
 * minus the speakers. Used to measure levels headless.
 */
export async function renderOffline(
  id: TrackId,
  seconds: number,
  opts: {
    sampleRate?: number;
    musicVolume?: number;
    sfxVolume?: number;
    tempoScale?: number;
    /** Runs after the music is booked; may schedule more sound on the mixer. */
    extra?: (mixer: AudioMixer, ctx: OfflineAudioContext) => void;
  } = {},
): Promise<AudioBuffer> {
  const rate = opts.sampleRate ?? 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(rate * seconds), rate);
  const mixer = new AudioMixer({
    context: ctx,
    volumes: () => ({ musicVolume: opts.musicVolume ?? 0.7, sfxVolume: opts.sfxVolume ?? 0.8 }),
  });
  const music = new Music(mixer, { manualClock: true });
  if (opts.tempoScale) music.setTempoScale(opts.tempoScale);
  music.play(id);
  // Book in half-second chunks, exactly like the live lookahead. Booking the
  // whole render up front would leave thousands of not-yet-started nodes in
  // the graph from t=0, and the renderer processes every one of them each
  // quantum — minutes of CPU for a minute of music.
  const CHUNK = 0.5;
  music.pump(CHUNK + LOOKAHEAD);
  for (let t = CHUNK; t < seconds; t += CHUNK) {
    const at = t;
    void ctx.suspend(at).then(() => {
      music.pump(at + CHUNK + LOOKAHEAD);
      void ctx.resume();
    });
  }
  opts.extra?.(mixer, ctx);
  const buf = await ctx.startRendering();
  mixer.dispose();
  return buf;
}
