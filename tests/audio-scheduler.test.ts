import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AudioMixer } from '../src/audio/mixer.ts';
import { Music } from '../src/audio/music.ts';
import { Sfx } from '../src/audio/sfx.ts';
import { getSong } from '../src/audio/music.ts';
import { stepSeconds, SONGS } from '../src/audio/songs.ts';

/**
 * A minimal stand-in for the Web Audio API: every node records connections
 * and disconnections, sources record start/stop and can be "ended" by
 * advancing the fake clock. Enough to test the scheduler's bookkeeping
 * headless; the actual sound is verified by offline rendering in a browser.
 */
class FakeParam {
  value = 0;
  setValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  setTargetAtTime(v: number) {
    this.value = v;
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

class FakeNode {
  connected = 0;
  disconnected = false;
  readonly ctx: FakeCtx;
  constructor(ctx: FakeCtx) {
    this.ctx = ctx;
    ctx.nodes.push(this);
  }
  connect(target: unknown) {
    this.connected++;
    return target;
  }
  disconnect() {
    this.disconnected = true;
  }
}

class FakeSource extends FakeNode {
  frequency = new FakeParam();
  detune = new FakeParam();
  type = 'sine';
  buffer: unknown = null;
  startAt = -1;
  stopAt = Infinity;
  onended: (() => void) | null = null;
  done = false;
  constructor(ctx: FakeCtx) {
    super(ctx);
    ctx.sources.push(this);
  }
  start(t = 0) {
    this.startAt = t;
  }
  stop(t = 0) {
    this.stopAt = t;
  }
  setPeriodicWave() {}
}

class FakeCtx {
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  nodes: FakeNode[] = [];
  sources: FakeSource[] = [];
  buffers = 0;
  destination = new FakeNode(this);
  private gainNode = () => Object.assign(new FakeNode(this), { gain: new FakeParam() });
  createGain = () => this.gainNode();
  createOscillator = () => new FakeSource(this);
  createBufferSource = () => new FakeSource(this);
  createBiquadFilter = () => Object.assign(new FakeNode(this), { type: 'lowpass', frequency: new FakeParam(), Q: new FakeParam() });
  createStereoPanner = () => Object.assign(new FakeNode(this), { pan: new FakeParam() });
  createDelay = () => Object.assign(new FakeNode(this), { delayTime: new FakeParam() });
  createConvolver = () => Object.assign(new FakeNode(this), { buffer: null as unknown });
  createWaveShaper = () => Object.assign(new FakeNode(this), { curve: null as unknown });
  createDynamicsCompressor = () =>
    Object.assign(new FakeNode(this), {
      threshold: new FakeParam(),
      knee: new FakeParam(),
      ratio: new FakeParam(),
      attack: new FakeParam(),
      release: new FakeParam(),
    });
  createPeriodicWave = () => ({});
  createBuffer = (_ch: number, len: number) => {
    this.buffers++;
    const data = new Float32Array(len);
    return { getChannelData: () => data, length: len };
  };
  resume = async () => {
    this.state = 'running';
  };
  suspend = async () => {
    this.state = 'suspended';
  };
  /** Moves the clock and fires `onended` for every source that has stopped. */
  advance(to: number) {
    this.currentTime = to;
    for (const s of this.sources) {
      if (!s.done && s.stopAt <= to) {
        s.done = true;
        s.onended?.();
      }
    }
  }
}

const volumes = () => ({ musicVolume: 0.7, sfxVolume: 0.8 });

function rig() {
  const ctx = new FakeCtx();
  const mixer = new AudioMixer({ context: ctx as unknown as BaseAudioContext, volumes });
  const music = new Music(mixer, { manualClock: true });
  return { ctx, mixer, music };
}

/** Runs the scheduler like the 25 ms timer would, up to `until`. */
function run(ctx: FakeCtx, music: Music, from: number, until: number) {
  for (let t = from; t <= until + 1e-9; t += 0.025) {
    ctx.advance(t);
    music.pump();
  }
}

describe('Music scheduler', () => {
  it('remembers a play() made before audio exists and starts it on unlock', () => {
    const g = globalThis as unknown as { AudioContext?: unknown };
    const saved = g.AudioContext;
    let made: FakeCtx | null = null;
    g.AudioContext = class {
      constructor() {
        made = new FakeCtx();
        return made;
      }
    };
    try {
      const mixer = new AudioMixer({ volumes });
      const music = new Music(mixer, { manualClock: true });
      music.play('title');
      music.duck(true);
      expect(music.current).toBe('title');
      expect(mixer.ready).toBe(false);
      mixer.ensure();
      expect(made).not.toBeNull();
      expect(music.current).toBe('title');
      expect(made!.sources.length).toBeGreaterThan(0);
    } finally {
      g.AudioContext = saved;
    }
  });

  it('playing the current track again is a no-op unless restarted', () => {
    const { ctx, music } = rig();
    music.play('dusk');
    run(ctx, music, 0, 0.5);
    const before = ctx.sources.length;
    music.play('dusk');
    music.pump();
    expect(ctx.sources.length).toBe(before);
    music.play('dusk', { restart: true });
    expect(music.current).toBe('dusk');
  });

  it('crossfades: the old track keeps playing under its fade, then is dropped', () => {
    const { ctx, music } = rig();
    music.play('title');
    run(ctx, music, 0, 1);
    music.play('boss');
    expect(music.current).toBe('boss');
    const internals = music as unknown as { players: unknown[] };
    expect(internals.players.length).toBe(2);
    run(ctx, music, 1, 5);
    expect(internals.players.length).toBe(1);
  });

  it('a jingle plays once, reports its end once, and may chain the next track', () => {
    const { ctx, music } = rig();
    let ended = 0;
    music.play('clear', {
      onEnd: () => {
        ended++;
        music.play('title');
      },
    });
    run(ctx, music, 0, 8);
    expect(ended).toBe(1);
    expect(music.current).toBe('title');
  });

  it('stop() fades out and leaves silence', () => {
    const { ctx, music } = rig();
    music.play('never');
    run(ctx, music, 0, 1);
    music.stop(0.3);
    expect(music.current).toBeNull();
    const booked = ctx.sources.length;
    run(ctx, music, 1, 5);
    // Nothing new is booked after the fade ends.
    expect(ctx.sources.filter((s) => s.startAt > 1.35).length).toBe(0);
    expect(ctx.sources.length).toBeGreaterThanOrEqual(booked);
  });

  it('skips forward after a stalled timer instead of firing every missed note', () => {
    const { ctx, music } = rig();
    music.play('midnight');
    run(ctx, music, 0, 2);
    const before = ctx.sources.length;
    ctx.advance(7); // five seconds with no timer at all (throttled tab)
    music.pump();
    const burst = ctx.sources.length - before;
    // At most a lookahead's worth of notes, nowhere near five seconds' worth.
    expect(burst).toBeLessThan(40);
    expect(ctx.sources.every((s) => s.startAt === -1 || s.startAt >= 0)).toBe(true);
    expect(ctx.sources.slice(before).every((s) => s.startAt >= 7 - 0.05)).toBe(true);
  });

  it('speed shoes run the band ~1.2x faster', () => {
    const steps = (scale: number) => {
      const { music } = rig();
      music.setTempoScale(scale);
      music.play('midnight');
      music.pump(10);
      return (music as unknown as { players: { count: number }[] }).players[0].count;
    };
    const ratio = steps(1.2) / steps(1);
    expect(ratio).toBeGreaterThan(1.15);
    expect(ratio).toBeLessThan(1.22);
    expect(steps(1)).toBeCloseTo(10 / stepSeconds(SONGS.midnight.bpm), -1);
  });

  it('tempo scale is clamped and ignores junk', () => {
    const { music } = rig();
    music.setTempoScale(9);
    expect(music.tempoScale).toBe(2);
    music.setTempoScale(Number.NaN);
    expect(music.tempoScale).toBe(1);
  });

  it('every voice node is disconnected once its note ends (no graph growth)', () => {
    const { ctx, music } = rig();
    const permanent = new Set(ctx.nodes);
    music.play('tomorrow');
    run(ctx, music, 0, 4);
    music.stop(0.2);
    run(ctx, music, 4, 9);
    const leaked = ctx.nodes.filter((n) => !permanent.has(n) && !n.disconnected);
    expect(leaked.length).toBe(0);
  });

  it('every song compiles once and is cached', () => {
    expect(getSong('ending')).toBe(getSong('ending'));
  });
});

describe('Sfx on the mixer', () => {
  let ctx: FakeCtx;
  let sfx: Sfx;
  beforeEach(() => {
    ctx = new FakeCtx();
    sfx = new Sfx(new AudioMixer({ context: ctx as unknown as BaseAudioContext, volumes }));
  });
  afterEach(() => sfx.mixer.dispose());

  it('is silent (and safe) before audio is unlocked', () => {
    const cold = new Sfx(new AudioMixer({ volumes }));
    expect(() => cold.play('ring')).not.toThrow();
    expect(cold.music.current).toBeNull();
  });

  it('plays every game and menu event without throwing', () => {
    const events = [
      'ring', 'jump', 'land', 'land-hard', 'spring', 'dash', 'dash-rev', 'loop-boost', 'dash-pad', 'hurt',
      'shield-lost', 'rail-on', 'rail-off', 'glider', 'glide', 'glider-lost', 'board', 'board-end', 'board-lost',
      'enemy', 'monitor', 'crystal', 'secret', 'checkpoint', 'stalactite-warn', 'stalactite-fall',
      'stalactite-shatter', 'cart-board', 'cart-wreck', 'cart-crash', 'phase-blink', 'hopper-stomp', 'boss-trace',
      'boss-derez', 'boss-rez', 'crumble', 'spike-trap', 'spike-warn', 'gate-slam', 'gate-open', 'boss', 'boss-hit',
      'boss-slam', 'boss-telegraph', 'boss-dig', 'boss-burst', 'boss-shards', 'boss-defeated', 'goal', 'die',
      'ui-move', 'ui-confirm', 'ui-back', 'ui-error', 'tally', 'tally-end', 'rank', 'title-card', 'pause',
      'unpause', 'text-blip', 'some-unknown-event',
    ];
    for (const ev of events) expect(() => sfx.play(ev), ev).not.toThrow();
  });

  it('noise is one shared buffer, not an allocation per hit', () => {
    sfx.play('dash');
    const after = ctx.buffers;
    for (let i = 0; i < 20; i++) {
      sfx.play('dash');
      sfx.play('enemy');
      sfx.play('boss-slam');
    }
    expect(ctx.buffers).toBe(after);
  });

  it('per-frame UI sounds are rate limited', () => {
    const before = ctx.sources.length;
    for (let i = 0; i < 10; i++) sfx.play('tally'); // same instant: one tick
    const one = ctx.sources.length - before;
    expect(one).toBe(1);
    ctx.advance(0.1);
    sfx.play('tally');
    expect(ctx.sources.length - before).toBe(2);
  });

  it('shares its context with the music', () => {
    expect(sfx.music.mixer).toBe(sfx.mixer);
  });
});
