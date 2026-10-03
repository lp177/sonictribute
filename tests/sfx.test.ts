import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AudioMixer } from '../src/audio/mixer.ts';
import { Sfx, SFX_NAMES } from '../src/audio/sfx.ts';
import source from '../src/audio/sfx.ts?raw';

/**
 * The same minimal Web Audio stand-in as audio-scheduler.test.ts, and
 * deliberately no richer: if the synth reaches for a node or a param this
 * fake lacks, it fails here before it fails there. Levels, lengths and
 * spectra are NOT tested here — those are measured by offline rendering in a
 * browser (see SOUND_DESIGN.md).
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
    if (!(v > 0)) throw new RangeError('exponential ramp to a non-positive value');
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

class FakePanner extends FakeNode {
  pan = new FakeParam();
}

class FakeCtx {
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  nodes: FakeNode[] = [];
  sources: FakeSource[] = [];
  buffers = 0;
  destination = new FakeNode(this);
  createGain = () => Object.assign(new FakeNode(this), { gain: new FakeParam() });
  createOscillator = () => new FakeSource(this);
  createBufferSource = () => new FakeSource(this);
  createBiquadFilter = () => Object.assign(new FakeNode(this), { type: 'lowpass', frequency: new FakeParam(), Q: new FakeParam() });
  createStereoPanner = () => new FakePanner(this);
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

let ctx: FakeCtx;
let sfx: Sfx;
beforeEach(() => {
  ctx = new FakeCtx();
  sfx = new Sfx(new AudioMixer({ context: ctx as unknown as BaseAudioContext, volumes }));
});
afterEach(() => sfx.mixer.dispose());

/** Plays `name` and returns what it added to the graph. */
function played(name: string, opts?: { pan?: number }) {
  const nodes = ctx.nodes.length;
  const sources = ctx.sources.length;
  sfx.play(name, opts);
  const added = ctx.nodes.slice(nodes);
  return {
    nodes: added,
    sources: ctx.sources.slice(sources),
    panners: added.filter((n): n is FakePanner => n instanceof FakePanner),
  };
}

describe('Sfx palette', () => {
  it('lists exactly the sounds play() implements', () => {
    const cases = [...source.matchAll(/case '([a-z0-9-]+)':/g)].map((m) => m[1]);
    expect(new Set(cases).size).toBe(cases.length);
    expect([...cases].sort()).toEqual([...SFX_NAMES].sort());
  });

  it('every listed sound makes sound, and an unknown one makes none', () => {
    for (const name of SFX_NAMES) expect(played(name).sources.length, name).toBeGreaterThan(0);
    expect(played('some-unknown-event').nodes.length).toBe(0);
  });

  it('books nothing in the past and stops every source it starts', () => {
    ctx.advance(3);
    for (const name of SFX_NAMES) {
      for (const s of played(name).sources) {
        expect(s.startAt, name).toBeGreaterThanOrEqual(3);
        expect(Number.isFinite(s.stopAt), name).toBe(true);
        expect(s.stopAt, name).toBeGreaterThan(s.startAt);
      }
    }
  });

  it('no sound outlasts two seconds', () => {
    for (const name of SFX_NAMES) {
      for (const s of played(name).sources) expect(s.stopAt, name).toBeLessThan(2);
    }
  });

  it('disconnects every node once its sources end (no graph growth)', () => {
    const permanent = new Set(ctx.nodes);
    for (const name of SFX_NAMES) {
      sfx.play(name, { pan: 0.3 });
      sfx.play(name); // dropped: one per frame
    }
    ctx.advance(5);
    const leaked = ctx.nodes.filter((n) => !permanent.has(n) && !n.disconnected);
    expect(leaked.length).toBe(0);
  });

  it('allocates no AudioBuffer per call: noise is the one shared buffer', () => {
    sfx.play('dash');
    const after = ctx.buffers;
    for (let t = 1; t < 4; t++) {
      ctx.advance(t);
      for (const name of SFX_NAMES) sfx.play(name);
    }
    expect(ctx.buffers).toBe(after);
  });

  it('keeps the everyday sounds cheap and the big ones bounded', () => {
    for (const name of ['ring', 'jump', 'land', 'spring', 'ui-move', 'text-blip', 'tally']) {
      expect(played(name, { pan: 0.4 }).nodes.length, name).toBeLessThanOrEqual(12);
    }
    for (const name of SFX_NAMES) expect(played(name, { pan: 0.4 }).nodes.length, name).toBeLessThanOrEqual(64);
  });

  it('is silent (and safe) before audio exists', () => {
    const cold = new Sfx(new AudioMixer({ volumes }));
    for (const name of SFX_NAMES) expect(() => cold.play(name, { pan: 0.5 }), name).not.toThrow();
    cold.mixer.dispose();
  });
});

describe('Sfx repetition', () => {
  it('plays a sound once per frame, however many callers ask', () => {
    for (const name of SFX_NAMES) {
      const first = played(name).sources.length;
      expect(first, name).toBeGreaterThan(0);
      expect(played(name).sources.length, name).toBe(0);
    }
  });

  it('a different sound in the same frame is not dropped', () => {
    expect(played('monitor').sources.length).toBeGreaterThan(0);
    expect(played('shield').sources.length).toBeGreaterThan(0);
  });

  it('rate limits what callers may fire every frame', () => {
    const gaps: [string, number][] = [
      ['ring', 0.03],
      ['dash-rev', 0.05],
      ['land', 0.12],
      ['skid', 0.25],
      ['gate-bump', 0.35],
      ['ui-move', 0.03],
      ['tally', 0.045],
      ['text-blip', 0.035],
      // Long story voices: skipping through a cutscene must not stack them.
      ['yolk-laugh', 1.2],
      ['warning', 0.8],
      ['thunder', 0.4],
    ];
    for (const [name, gap] of gaps) {
      let t = ctx.currentTime + 1;
      ctx.advance(t);
      expect(played(name).sources.length, name).toBeGreaterThan(0);
      // One 60 Hz frame at a time, up to just short of the gap: nothing.
      for (t += 1 / 60; t < ctx.currentTime + gap - 1e-6; t += 1 / 60) {
        const at = ctx.currentTime;
        ctx.currentTime = t;
        expect(played(name).sources.length, `${name} +${(t - at).toFixed(3)}s`).toBe(0);
        ctx.currentTime = at;
      }
      ctx.advance(ctx.currentTime + gap + 0.001);
      expect(played(name).sources.length, `${name} after its gap`).toBeGreaterThan(0);
    }
  });

  it('ring pickups climb a ladder while chained, and reset after a pause', () => {
    const pitches: number[] = [];
    for (let i = 0; i < 14; i++) {
      ctx.advance(1 + i * 0.1);
      pitches.push(played('ring').sources[0].frequency.value);
    }
    expect(pitches[0]).toBeCloseTo(988, 0);
    for (let i = 1; i < 12; i++) expect(pitches[i], `rung ${i}`).toBeGreaterThan(pitches[i - 1]);
    // The top rung holds rather than running off the scale.
    expect(pitches[13]).toBeCloseTo(pitches[11], 5);
    ctx.advance(4);
    expect(played('ring').sources[0].frequency.value).toBeCloseTo(988, 0);
  });

  it('each ring is struck on one side and answered on the other, swapping per pickup', () => {
    const sides: number[][] = [];
    for (let i = 0; i < 4; i++) {
      ctx.advance(1 + i * 0.1);
      sides.push(played('ring').panners.map((p) => p.pan.value));
    }
    for (const s of sides) {
      expect(s.length).toBe(2);
      expect(Math.sign(s[0])).toBe(-Math.sign(s[1]));
    }
    for (let i = 1; i < sides.length; i++) expect(Math.sign(sides[i][0])).toBe(-Math.sign(sides[i - 1][0]));
  });

  it('spin-dash revs climb with the charge, and a fresh charge starts over', () => {
    const rev = (name: string) => played(name).sources[0].frequency.value;
    ctx.advance(1);
    const first = rev('dash-charge');
    const revs: number[] = [];
    for (let i = 1; i <= 5; i++) {
      ctx.advance(1 + i * 0.15);
      revs.push(rev('dash-rev'));
    }
    expect(revs[0]).toBeGreaterThan(first);
    for (let i = 1; i < revs.length; i++) expect(revs[i]).toBeGreaterThan(revs[i - 1]);
    ctx.advance(5);
    expect(rev('dash-charge')).toBeCloseTo(first, 5);
  });

  it('repeats are never the identical sample: jumps differ in pitch by a hair', () => {
    const pitches = new Set<number>();
    for (let i = 0; i < 8; i++) {
      ctx.advance(1 + i);
      pitches.add(played('jump').sources[0].frequency.value);
    }
    expect(pitches.size).toBeGreaterThan(1);
    // The fake keeps the last value booked: the top of the sweep, 2.9x the start.
    for (const f of pitches) expect(Math.abs(f / (310 * 2.9) - 1)).toBeLessThan(0.02);
  });
});

describe('Sfx stereo', () => {
  it('a centred sound goes straight to the bus: no panner', () => {
    expect(played('jump').panners.length).toBe(0);
    ctx.advance(1);
    expect(played('jump', {}).panners.length).toBe(0);
  });

  it('places a sound, its voices sharing one panner', () => {
    const p = played('jump', { pan: 0.5 });
    expect(p.sources.length).toBeGreaterThan(1);
    expect(p.panners.length).toBe(1);
    expect(p.panners[0].pan.value).toBeCloseTo(0.5, 5);
  });

  it("offsets a sound's own left/right play by the placement, clamped to the field", () => {
    const pans = played('ring', { pan: 0.9 })
      .panners.map((p) => p.pan.value)
      .sort((a, b) => a - b);
    expect(pans.length).toBe(2);
    expect(pans[0]).toBeCloseTo(0.45, 5);
    expect(pans[1]).toBe(1);
  });

  it('every pan a sound uses stays inside -1..1, wherever it is placed', () => {
    for (const pan of [-1, 1, -7, 7]) {
      ctx.advance(ctx.currentTime + 2);
      for (const name of SFX_NAMES) {
        for (const p of played(name, { pan }).panners) {
          expect(p.pan.value, name).toBeGreaterThanOrEqual(-1);
          expect(p.pan.value, name).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('ignores a junk placement', () => {
    expect(played('jump', { pan: Number.NaN }).panners.length).toBe(0);
  });
});

describe('Sfx hurt', () => {
  it('scatters rings — unless a shield or the board took the hit', () => {
    const plain = played('hurt').sources.length;
    ctx.advance(3);
    const spray = played('ring-loss').sources.length;
    expect(spray).toBeGreaterThan(0);
    for (const guard of ['shield-lost', 'board-lost']) {
      ctx.advance(ctx.currentTime + 3);
      sfx.play(guard);
      expect(played('hurt').sources.length, guard).toBe(plain - spray);
    }
    // The next unguarded hit loses rings again.
    ctx.advance(ctx.currentTime + 3);
    expect(played('hurt').sources.length).toBe(plain);
  });
});
