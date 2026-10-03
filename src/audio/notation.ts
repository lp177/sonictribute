/**
 * Tracker notation for the soundtrack — pure string → event parsing, no Web
 * Audio, so every song can be validated headless in node.
 *
 * A LANE is one instrument's part, written as whitespace-separated tokens on a
 * grid of sixteenth-note STEPS:
 *
 *   C5  F#4  Bb3        a note (A4 = 440 Hz, equal temperament)
 *   C4+E4+G4            several notes struck together
 *   Am7@3   Fmaj7@4:1   a chord symbol rooted at an octave (`:n` = n-th inversion)
 *   k  s  h+o           drum hits (see DRUM_LETTERS), `+` to layer them
 *   .                   rest (also ends a held note)
 *   -                   hold the previous note one more step
 *   |                   bar line: every bar MUST add up to a full bar, so a
 *                       missing step is a parse error instead of a song that
 *                       silently drifts out of time
 *   /8  /4  /2  /1      from here on each token spans an eighth/quarter/… (default /16)
 *   suffix !  ?         accent / ghost velocity
 *   prefix ~            glide (portamento) into this note from the previous one
 *
 * Writing every part out step by step is what a tracker does, but a composer
 * thinks in progressions. The helpers below (`comp`, `bassline`, `shift`,
 * `rep`) EXPAND into plain lane strings, so the harmony is written once and the
 * pads, stabs, arpeggios and bass all follow it — and the parser still checks
 * the result like hand-written notes.
 */

export type DrumName =
  | 'kick'
  | 'snare'
  | 'hat'
  | 'open'
  | 'clap'
  | 'tomLo'
  | 'tomHi'
  | 'metal'
  | 'crash'
  | 'rim'
  | 'shaker';

/** One letter per drum so a groove reads like a drum-machine row. */
export const DRUM_LETTERS: Readonly<Record<string, DrumName>> = {
  k: 'kick',
  s: 'snare',
  h: 'hat',
  o: 'open',
  p: 'clap',
  t: 'tomLo',
  u: 'tomHi',
  m: 'metal',
  x: 'crash',
  r: 'rim',
  z: 'shaker',
};

export const VEL_NORMAL = 0.8;
export const VEL_ACCENT = 1;
export const VEL_GHOST = 0.45;

const NOTE_INDEX: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const NOTE_RE = /^([A-G])([#b]?)(-?\d)$/;
const CHORD_AT_RE = /^([A-G][#b]?)([^@]*)@(-?\d)(?::(\d))?$/;
const CHORD_RE = /^([A-G][#b]?)(.*)$/;
const RES_RE = /^\/(1|2|4|8|16)$/;

/** Intervals above the root for every chord quality the songs may name. */
export const CHORD_QUALITIES: Readonly<Record<string, readonly number[]>> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  mmaj7: [0, 3, 7, 11],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  '7sus4': [0, 5, 7, 10],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  '9': [0, 4, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  m11: [0, 3, 7, 10, 14, 17],
};

// ---------------------------------------------------------------- pitch

/** 'A4' → 69, 'C4' → 60 (MIDI numbering, C-1 = 0). */
export function noteToMidi(name: string): number {
  const m = NOTE_RE.exec(name);
  if (!m) throw new Error(`bad note "${name}"`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + NOTE_INDEX[m[1]] + acc;
}

/** Equal temperament, A4 = 440 Hz. */
export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function noteFreq(name: string): number {
  return midiToFreq(noteToMidi(name));
}

/** 61 → 'C#4' (always spelled with sharps). */
export function midiToName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  return `${SHARP_NAMES[pc]}${Math.floor(midi / 12) - 1}`;
}

function pitchClass(name: string): number {
  const acc = name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0;
  return (NOTE_INDEX[name[0]] + acc + 12) % 12;
}

function quality(q: string, sym: string): readonly number[] {
  const iv = CHORD_QUALITIES[q];
  if (!iv) throw new Error(`unknown chord quality "${q}" in "${sym}"`);
  return iv;
}

/** 'Am7@3' → [57, 60, 64, 67]; 'C@4:1' → first inversion [64, 67, 72]. */
export function chordToMidi(sym: string): number[] {
  const m = CHORD_AT_RE.exec(sym);
  if (!m) throw new Error(`bad chord "${sym}"`);
  const root = 12 * (Number(m[3]) + 1) + pitchClass(m[1]);
  const notes = quality(m[2], sym).map((i) => root + i);
  for (let k = 0; k < Number(m[4] ?? 0); k++) {
    notes.sort((a, b) => a - b);
    notes.push(notes.shift()! + 12);
  }
  return notes.sort((a, b) => a - b);
}

// ---------------------------------------------------------------- lanes

export interface LaneEvent {
  /** Step offset inside the lane (sixteenths). */
  step: number;
  /** Length in steps, including holds. */
  steps: number;
  midi: number[];
  drums: DrumName[];
  vel: number;
  glide: boolean;
}

export interface ParsedLane {
  events: LaneEvent[];
  /** Total length in steps. */
  steps: number;
  /** Holds written BEFORE the first note: they extend the previous pattern's last note. */
  leadTie: number;
  /** The last note is still held when the lane ends (a following lead tie may extend it). */
  openEnd: boolean;
}

interface Hit {
  midi: number[];
  drums: DrumName[];
  vel: number;
  glide: boolean;
}

function parseHit(tok: string): Hit {
  let body = tok;
  let vel = VEL_NORMAL;
  if (body.endsWith('!')) {
    vel = VEL_ACCENT;
    body = body.slice(0, -1);
  } else if (body.endsWith('?')) {
    vel = VEL_GHOST;
    body = body.slice(0, -1);
  }
  const glide = body.startsWith('~');
  if (glide) body = body.slice(1);
  const midi: number[] = [];
  const drums: DrumName[] = [];
  for (const part of body.split('+')) {
    const drum = DRUM_LETTERS[part];
    if (drum) drums.push(drum);
    else if (NOTE_RE.test(part)) midi.push(noteToMidi(part));
    else if (part.includes('@')) midi.push(...chordToMidi(part));
    else throw new Error(`unknown token "${tok}"`);
  }
  return { midi, drums, vel, glide };
}

const tokens = (src: string): string[] => src.split(/\s+/).filter(Boolean);

/**
 * Parses one lane. `stepsPerBar` drives the bar-line check: a lane that uses
 * `|` must fill every bar exactly.
 */
export function parseLane(src: string, stepsPerBar = 16): ParsedLane {
  const events: LaneEvent[] = [];
  let step = 0;
  let span = 1;
  let barStart = 0;
  let bar = 1;
  let usesBars = false;
  let leadTie = 0;
  let started = false;
  let last: LaneEvent | null = null;
  let held = false;
  const checkBar = (): void => {
    const len = step - barStart;
    if (len !== stepsPerBar) {
      throw new Error(`bar ${bar} has ${len} steps, expected ${stepsPerBar}: "${src.trim().slice(0, 80)}…"`);
    }
  };
  for (const tok of tokens(src)) {
    const res = RES_RE.exec(tok);
    if (res) {
      span = 16 / Number(res[1]);
      continue;
    }
    if (tok === '|') {
      usesBars = true;
      checkBar();
      barStart = step;
      bar++;
      continue;
    }
    if (tok === '-') {
      if (last && held) last.steps += span;
      else if (!started) leadTie += span;
      step += span;
      continue;
    }
    started = true;
    if (tok === '.') {
      held = false;
      step += span;
      continue;
    }
    const ev: LaneEvent = { step, steps: span, ...parseHit(tok) };
    events.push(ev);
    last = ev;
    held = true;
    step += span;
  }
  if (usesBars && step !== barStart) checkBar();
  return { events, steps: step, leadTie, openEnd: !!last && held && last.step + last.steps === step };
}

// ---------------------------------------------------------------- composing helpers

/** Repeats a lane `n` times. */
export function rep(lane: string, n: number): string {
  return Array.from({ length: n }, () => lane.trim()).join(' ');
}

/** Transposes every note and chord symbol in a lane by `semis` (drums untouched). */
export function shift(lane: string, semis: number): string {
  if (semis === 0) return lane;
  const one = (part: string): string => {
    if (NOTE_RE.test(part)) return midiToName(noteToMidi(part) + semis);
    const c = CHORD_AT_RE.exec(part);
    if (c) {
      const root = 12 * (Number(c[3]) + 1) + pitchClass(c[1]) + semis;
      const name = midiToName(root);
      const pc = name.replace(/-?\d+$/, '');
      return `${pc}${c[2]}@${Math.floor(root / 12) - 1}${c[4] ? `:${c[4]}` : ''}`;
    }
    return part;
  };
  return tokens(lane)
    .map((tok) => {
      const m = /^(~?)(.*?)([!?]?)$/.exec(tok)!;
      if (RES_RE.test(tok) || tok === '|' || tok === '-' || tok === '.') return tok;
      return m[1] + m[2].split('+').map(one).join('+') + m[3];
    })
    .join(' ');
}

interface ProgChord {
  /** Pitch class of the root. */
  root: number;
  intervals: readonly number[];
  /** First step (inside the whole progression) this chord sounds on. */
  from: number;
}

/**
 * A progression is written one bar per token, commas splitting a bar evenly:
 * `'Dmaj7 Em7 G,A7sus4'` = three bars, the last one half G, half A7sus4.
 */
export function parseProgression(prog: string, stepsPerBar = 16): { chords: ProgChord[]; steps: number } {
  const chords: ProgChord[] = [];
  const bars = tokens(prog).filter((t) => t !== '|');
  bars.forEach((bar, i) => {
    const parts = bar.split(',');
    const each = stepsPerBar / parts.length;
    if (!Number.isInteger(each)) throw new Error(`bar "${bar}" does not split evenly`);
    parts.forEach((sym, j) => {
      const m = CHORD_RE.exec(sym);
      if (!m) throw new Error(`bad chord "${sym}"`);
      chords.push({ root: pitchClass(m[1]), intervals: quality(m[2], sym), from: i * stepsPerBar + j * each });
    });
  });
  return { chords, steps: bars.length * stepsPerBar };
}

function chordAt(chords: ProgChord[], step: number): ProgChord {
  let c = chords[0];
  for (const ch of chords) if (ch.from <= step) c = ch;
  return c;
}

/**
 * Close voicing of a chord whose average pitch sits nearest `center`. Keeping
 * every chord in one band is cheap voice leading: pads and stabs glide between
 * neighbouring inversions instead of leaping by a fifth on every change.
 */
export function voiceChord(root: number, intervals: readonly number[], center: number): number[] {
  let best: number[] = [];
  let bestDist = Infinity;
  for (let octave = 1; octave <= 8; octave++) {
    const base = intervals.map((i) => 12 * octave + root + i);
    for (let inv = 0; inv < base.length; inv++) {
      const v = base.map((n, k) => (k < inv ? n + 12 : n)).sort((a, b) => a - b);
      const mean = v.reduce((a, b) => a + b, 0) / v.length;
      const d = Math.abs(mean - center);
      if (d < bestDist - 1e-9) {
        bestDist = d;
        best = v;
      }
    }
  }
  return best;
}

/**
 * Walks a template across a progression. Templates repeat every bar (an
 * array cycles bar by bar); `.`, `-`, `|` and `/N` work as in a lane. A hold
 * that runs over a chord change re-strikes the new harmony instead of holding
 * a stale note against it.
 */
function overProgression(
  prog: string,
  templates: string | readonly string[],
  stepsPerBar: number,
  render: (tok: string, chord: ProgChord, next: ProgChord) => string,
): string {
  const { chords, steps } = parseProgression(prog, stepsPerBar);
  const list = (Array.isArray(templates) ? templates : [templates]) as readonly string[];
  const out: string[] = [];
  let step = 0;
  let bar = 0;
  let sounding: ProgChord | null = null;
  let lastTok = '';
  let outSpan = 1;
  while (step < steps) {
    const tpl = tokens(list[bar % list.length]).filter((t) => t !== '|');
    let span = 1;
    let used = 0;
    if (outSpan !== 1) {
      out.push('/16');
      outSpan = 1;
    }
    for (const tok of tpl) {
      if (RES_RE.test(tok)) {
        span = 16 / Number(RES_RE.exec(tok)![1]);
        outSpan = span;
        out.push(tok);
        continue;
      }
      if (step >= steps) break;
      const chord = chordAt(chords, step);
      // The next CHANGE of harmony (wrapping to the top), for approach notes.
      const next = chords.find((ch) => ch.from > step) ?? chords[0];
      if (tok === '.') {
        out.push('.');
        sounding = null;
      } else if (tok === '-') {
        if (sounding && sounding !== chord && lastTok) {
          out.push(render(lastTok, chord, next));
          sounding = chord;
        } else out.push('-');
      } else {
        out.push(render(tok, chord, next));
        sounding = chord;
        lastTok = tok;
      }
      step += span;
      used += span;
    }
    if (used !== stepsPerBar) throw new Error(`template "${list[bar % list.length]}" is ${used} steps, expected ${stepsPerBar}`);
    out.push('|');
    bar++;
  }
  return out.join(' ');
}

function splitMarks(tok: string): { glide: string; body: string; acc: string } {
  const m = /^(~?)(.*?)([!?]?)$/.exec(tok)!;
  return { glide: m[1], body: m[2], acc: m[3] };
}

/**
 * Comping: plays a progression with a rhythm template whose tokens are chord
 * tone indices (`0` = lowest note of the voicing, past the top wraps up an
 * octave), `*` for the whole chord, or `0+2` for a partial. One helper covers
 * pads (`/1 *`), stabs (`* - . *`) and arpeggios (`0 1 2 3`).
 */
export function comp(prog: string, shape: string | readonly string[], center = 'G4', stepsPerBar = 16): string {
  const c = noteToMidi(center);
  return overProgression(prog, shape, stepsPerBar, (tok, chord) => {
    const { glide, body, acc } = splitMarks(tok);
    const v = voiceChord(chord.root, chord.intervals, c);
    const pick = (s: string): number[] => {
      if (s === '*') return v;
      const i = Number(s);
      if (!Number.isInteger(i) || i < 0) throw new Error(`bad comp index "${s}"`);
      return [v[i % v.length] + 12 * Math.floor(i / v.length)];
    };
    const notes = body.split('+').flatMap(pick).map(midiToName);
    return glide + notes.join('+') + acc;
  });
}

/**
 * Bass from a progression: template tokens are semitone offsets from the
 * chord ROOT (`0`, `12`, `7`, `-5`…), and `<` / `>` are chromatic approach
 * notes a half step below / above the NEXT chord's root — the funk walk-in.
 * Each root lands as close as possible to the previous one, kept within a
 * fourteen-semitone window above `low`: D-E-F#-G climbs instead of folding
 * back down an octave the moment it crosses an arbitrary register seam.
 */
export function bassline(prog: string, groove: string | readonly string[], low = 'E1', stepsPerBar = 16): string {
  const lo = noteToMidi(low);
  let prev = lo + 6;
  const near = (pc: number): number => {
    let m = prev + ((((pc - prev) % 12) + 18) % 12) - 6;
    if (m < lo) m += 12;
    if (m > lo + 14) m -= 12;
    return m;
  };
  const place = (pc: number): number => (prev = near(pc));
  return overProgression(prog, groove, stepsPerBar, (tok, chord, next) => {
    const { glide, body, acc } = splitMarks(tok);
    let midi: number;
    if (body === '<') midi = near(next.root) - 1;
    else if (body === '>') midi = near(next.root) + 1;
    else {
      const off = Number(body);
      if (!Number.isInteger(off)) throw new Error(`bad bass offset "${body}"`);
      midi = place(chord.root) + off;
    }
    return glide + midiToName(midi) + acc;
  });
}

// ---------------------------------------------------------------- songs

export type Wave = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'pulse25' | 'pulse12';

/** A pitched instrument. Times in seconds, levels 0..1. */
export interface TonePatch {
  kind: 'tone';
  wave: Wave;
  /** Peak level of one note at full velocity (unison voices are normalised). */
  gain: number;
  /** Extra copies of every note, spread over `detune` cents — the supersaw trick. */
  unison?: number;
  detune?: number;
  /** Octave shift applied to every note of the lane. */
  octave?: number;
  pan?: number;
  attack: number;
  decay: number;
  /** Sustain level as a fraction of the peak. */
  sustain: number;
  release: number;
  /** Fraction of the written length actually held (articulation); default 0.92. */
  gate?: number;
  filter?: {
    type?: BiquadFilterType;
    freq: number;
    q?: number;
    /** Extra cutoff (Hz) at the attack, decaying back to `freq`: the pluck/brass "wow". */
    env?: number;
    envDecay?: number;
  };
  /** Delayed vibrato: depth in cents, starting `delay` seconds into the note. */
  vibrato?: { rate: number; depth: number; delay: number };
  /** Portamento time for notes written with `~`. */
  glide?: number;
  /** A sine an octave down, mixed under the note (bass weight). */
  sub?: number;
  /** Send levels to the shared ping-pong delay and reverb. */
  delay?: number;
  reverb?: number;
}

/** A drum kit; every lane token picks one of its synthesised voices. */
export interface DrumPatch {
  kind: 'drums';
  gain: number;
  pan?: number;
  /** Per-voice level trims (1 = default). */
  levels?: Partial<Record<DrumName, number>>;
  /** Pitch multiplier for the tuned voices (kick, toms, snare body, metal). */
  tune?: number;
  /** Decay multiplier — < 1 is tight and dry, > 1 rings. */
  decay?: number;
  delay?: number;
  reverb?: number;
}

export type Patch = TonePatch | DrumPatch;

/** Lane name → lane string. Every lane name must be one of the song's instruments. */
export type Pattern = Readonly<Record<string, string>>;

export interface SongDef {
  title: string;
  /** For humans: key and mode. */
  key: string;
  bpm: number;
  /** Beats per bar (default 4). Steps are always sixteenths. */
  meter?: number;
  /** Delay applied to every off-beat sixteenth, as a fraction of a step (0 = straight). */
  swing?: number;
  /** Jingles play once; everything else loops its `main` section. */
  loop: boolean;
  /** Loudness trim so every track sits at the same level. */
  gain?: number;
  /** Tempo-synced ping-pong delay (in beats) and its feedback. */
  echo?: { beats: number; feedback: number };
  instruments: Readonly<Record<string, Patch>>;
  patterns: Readonly<Record<string, Pattern>>;
  /** Played once before the loop. Pattern refs: `name`, `name+2` (transpose), `name*3` (repeat). */
  intro?: readonly string[];
  /** The loop body (or, for a jingle, the whole piece). */
  main: readonly string[];
}

export interface NoteEvent {
  lane: string;
  midi: number[];
  drums: DrumName[];
  steps: number;
  vel: number;
  glide: boolean;
}

export interface Section {
  steps: number;
  /** Events starting at each step (an empty array for silent steps). */
  events: NoteEvent[][];
}

export interface CompiledSong {
  def: SongDef;
  stepsPerBar: number;
  intro: Section;
  main: Section;
}

const REF_RE = /^([A-Za-z]\w*?)([+-]\d+)?(?:\*(\d+))?$/;

/** 'A+2*3' → three copies of pattern A transposed up a whole step. */
export function parseRef(ref: string): { name: string; transpose: number; times: number } {
  const m = REF_RE.exec(ref);
  if (!m) throw new Error(`bad pattern ref "${ref}"`);
  return { name: m[1], transpose: Number(m[2] ?? 0), times: Number(m[3] ?? 1) };
}

/**
 * Flattens a song into per-step event lists. Throws on anything a composer
 * could get wrong: unknown pattern or instrument, a drum hit in a melodic
 * lane, lanes of different lengths inside one pattern, a broken bar.
 */
export function compileSong(def: SongDef): CompiledSong {
  const stepsPerBar = (def.meter ?? 4) * 4;
  const cache = new Map<string, { steps: number; lanes: [string, ParsedLane][] }>();
  const pattern = (name: string) => {
    const hit = cache.get(name);
    if (hit) return hit;
    const pat = def.patterns[name];
    if (!pat) throw new Error(`${def.title}: unknown pattern "${name}"`);
    const lanes: [string, ParsedLane][] = [];
    let steps = -1;
    for (const [lane, src] of Object.entries(pat)) {
      const patch = def.instruments[lane];
      if (!patch) throw new Error(`${def.title}/${name}: unknown instrument "${lane}"`);
      let parsed: ParsedLane;
      try {
        parsed = parseLane(src, stepsPerBar);
      } catch (e) {
        throw new Error(`${def.title}/${name}/${lane}: ${(e as Error).message}`);
      }
      for (const ev of parsed.events) {
        if (patch.kind === 'drums' && ev.midi.length) throw new Error(`${def.title}/${name}: notes in drum lane "${lane}"`);
        if (patch.kind === 'tone' && ev.drums.length) throw new Error(`${def.title}/${name}: drums in melodic lane "${lane}"`);
      }
      if (steps >= 0 && parsed.steps !== steps) {
        throw new Error(`${def.title}/${name}: lane "${lane}" is ${parsed.steps} steps, others are ${steps}`);
      }
      steps = parsed.steps;
      lanes.push([lane, parsed]);
    }
    if (steps <= 0) throw new Error(`${def.title}/${name}: empty pattern`);
    const out = { steps, lanes };
    cache.set(name, out);
    return out;
  };

  const section = (refs: readonly string[]): Section => {
    const events: NoteEvent[][] = [];
    let cursor = 0;
    let open = new Map<string, NoteEvent>();
    for (const ref of refs) {
      const { name, transpose, times } = parseRef(ref);
      for (let n = 0; n < times; n++) {
        const pat = pattern(name);
        const nextOpen = new Map<string, NoteEvent>();
        for (const [lane, parsed] of pat.lanes) {
          const tone = def.instruments[lane].kind === 'tone';
          const prev = open.get(lane);
          if (prev && parsed.leadTie > 0) prev.steps += parsed.leadTie;
          if (prev && !parsed.events.length && parsed.leadTie === pat.steps) nextOpen.set(lane, prev);
          parsed.events.forEach((e, i) => {
            const ev: NoteEvent = {
              lane,
              midi: tone ? e.midi.map((m) => m + transpose) : [],
              drums: e.drums,
              steps: e.steps,
              vel: e.vel,
              glide: e.glide,
            };
            (events[cursor + e.step] ??= []).push(ev);
            if (parsed.openEnd && i === parsed.events.length - 1) nextOpen.set(lane, ev);
          });
        }
        open = nextOpen;
        cursor += pat.steps;
      }
    }
    for (let i = 0; i < cursor; i++) events[i] ??= [];
    return { steps: cursor, events };
  };

  const main = section(def.main);
  if (main.steps === 0) throw new Error(`${def.title}: empty main section`);
  return { def, stepsPerBar, intro: section(def.intro ?? []), main };
}

/** Seconds per sixteenth-note step at a tempo. */
export function stepSeconds(bpm: number): number {
  return 60 / bpm / 4;
}

/** Total steps of a compiled song (intro once + one pass of the main section). */
export function songSteps(song: CompiledSong): number {
  return song.intro.steps + song.main.steps;
}

/** Length in seconds of the intro plus one pass of the main section. */
export function songSeconds(song: CompiledSong): number {
  return songSteps(song) * stepSeconds(song.def.bpm);
}
