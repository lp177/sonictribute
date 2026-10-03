/**
 * The BOLT soundtrack, as data. Every melody here is original; the homage is
 * in STYLE only — bright major hooks, syncopated funk bass, sixteenth hats,
 * key-change lifts — never in notes.
 *
 * Composition notes, so the next person can extend it in the same voice:
 * - Harmony is written first, as a progression string per section; bass,
 *   pads, stabs and arpeggios are DERIVED from it (`bassline`, `comp`), so a
 *   chord change is one edit, not five.
 * - Melodies are written out note by note. The main theme's hook is a 3+3+2
 *   sixteenth figure; that rhythmic cell comes back in the boss music and the
 *   ending quotes the whole hook — one motif threading the campaign the way
 *   the Chrono Core threads the story.
 * - Each biome has its own band: Duskmere is marimba, congas and slap bass;
 *   the Foundry is saw brass, anvil clanks and a sixteenth acid bass; the
 *   Underwhen is glass bells through a ping-pong delay; Noon Tomorrow is
 *   supersaw stabs on four-on-the-floor.
 * - Leave space. A lead that rests for two beats is what lets the answer
 *   (marimba, brass, counter) be heard.
 *
 * Pure data + pure helpers: no Web Audio here, so `tests/music.test.ts`
 * parses every track in node.
 */
import { bassline, comp, rep, shift, type DrumPatch, type SongDef, type TonePatch } from './notation.ts';

export * from './notation.ts';

export type TrackId =
  | 'title'
  | 'story'
  | 'dusk'
  | 'midnight'
  | 'never'
  | 'tomorrow'
  | 'boss'
  | 'finale'
  | 'clear'
  | 'ending';

export const TRACK_IDS: readonly TrackId[] = [
  'title',
  'story',
  'dusk',
  'midnight',
  'never',
  'tomorrow',
  'boss',
  'finale',
  'clear',
  'ending',
];

// ---------------------------------------------------------------- shared kit

const tone = (p: Omit<TonePatch, 'kind'>): TonePatch => ({ kind: 'tone', ...p });
const kit = (p: Omit<DrumPatch, 'kind'>): DrumPatch => ({ kind: 'drums', ...p });

const REST = '. . . . . . . . . . . . . . . .';
const rests = (bars: number): string => rep(`${REST} |`, bars);

// ================================================================ TITLE
// "BOLT!" — the main theme. D major, 144 BPM.
// Intro: a bVI-bVII-I brass fanfare (G A Bb C → D). A: the hook, a rising
// Dmaj7-Em7-F#m7 climb answered by a falling line. A2 repeats the hook and
// closes on the tonic. B: a half-time bridge in long notes. Then the hook
// lifts a whole step to E, with the brass doubling it, and a deceptive
// turnaround (B7 → Cmaj7 → A7) drops it back home to D.

const T_PROG = {
  intro: 'G A Bb C',
  a: 'Dmaj7 Em7 F#m7 G,A7sus4 Bm7 Gmaj7 Em7 A7sus4,A7',
  a2: 'Dmaj7 Em7 F#m7 G,A7sus4 Bm7 Gmaj7 Em7,A7 D',
  b: 'Bm7 A Gmaj7 F#m7 Em7 F#m7 Gmaj7 A7sus4,A7',
  turn: 'Cmaj7 A7sus4,A7',
};

/** The hook: 3+3+2 sixteenths climbing, then a long held peak. */
const T_HOOK = `
  A4 - - D5 - - F#5! - - - E5 - F#5 - A5 - |
  - - - - B5 - A5 - G5 - F#5 - E5 - - - |
  A4 - - C#5 - - F#5! - - - E5 - F#5 - A5 - |
  - - - - B5 - C#6 - D6! - - - . . . . |`;
const T_ANSWER = `
  D6 - - C#6 - - B5 - - - A5 - F#5 - - - |
  . . G5 A5 B5 - - - A5 - G5 - F#5 - D5 - |
  E5 - - F#5 - - G5 - - - B5 - A5 - G5 - |
  E5 - - - D5 - - - . . A4? C#5 E5 G5 A5! - |`;
const T_CADENCE = `
  D6 - - C#6 - - B5 - - - A5 - B5 - D6 - |
  - - - - E6 - D6 - B5 - - - A5 - G5 - |
  E5 - - F#5 - - G5 - - - A5 - B5 - C#6 - |
  D6! - - - - - - - - - - - . . . . |`;
const T_BRIDGE = `
  F#5 - - - - - - - D5 - E5 - F#5 - A5 - |
  E5 - - - - - - - . . C#5 - E5 - A5 - |
  F#5 - - - - - D5 - - - B4 - D5 - F#5 - |
  E5 - - - - - - - - - - - . . . . |
  G5 - - - - - - - E5 - F#5 - G5 - B5 - |
  A5 - - - - - - - F#5 - G5 - A5 - C#6 - |
  D6 - - - B5 - - - A5 - - - G5 - - - |
  A5 - - - - - - - . . . . . . . . |`;
const T_TURN = `
  B5 - - - - - G5 - - - E5 - G5 - B5 - |
  D6 - - - - - - - C#6 - - - A5 - G5 - |`;

const T_FUNK = ['0! . 12? 0 . . 12 . 0 . . 0 12 . 7 <', '0! . 12? 0 . . 12 . 0 . 7 . 12 . 0 .'];
const T_KS = 'k . . . s . . k . . k . s . . .';
const T_KS2 = 'k . . . s . . k . k . . s . . k?';
const T_KSX = 'x+k . . . s . . k . . k . s . . .';
const T_FILL = 'k . . . s . . k . . s? s s? s! s s!';
const T_HATS = 'h h? h h? h h? h h? h h? h h? h h? o .';
const T_DRUMS_8 = `${T_KSX} | ${T_KS2} | ${T_KS} | ${T_KS2} | ${T_KS} | ${T_KS2} | ${T_KS} | ${T_FILL} |`;

const TITLE: SongDef = {
  title: 'BOLT! (Main Theme)',
  key: 'D major (lift to E)',
  bpm: 144,
  loop: true,
  gain: 1,
  echo: { beats: 0.75, feedback: 0.3 },
  instruments: {
    lead: tone({
      wave: 'pulse25',
      gain: 0.3,
      attack: 0.004,
      decay: 0.25,
      sustain: 0.72,
      release: 0.09,
      filter: { freq: 6000 },
      vibrato: { rate: 5.6, depth: 16, delay: 0.18 },
      glide: 0.05,
      reverb: 0.14,
      delay: 0.06,
    }),
    brass: tone({
      wave: 'sawtooth',
      unison: 2,
      detune: 9,
      gain: 0.17,
      attack: 0.012,
      decay: 0.25,
      sustain: 0.6,
      release: 0.12,
      filter: { freq: 1300, q: 2, env: 2600, envDecay: 0.2 },
      pan: -0.2,
      reverb: 0.16,
    }),
    bass: tone({
      wave: 'sawtooth',
      gain: 0.3,
      attack: 0.003,
      decay: 0.14,
      sustain: 0.5,
      release: 0.05,
      gate: 0.8,
      filter: { freq: 520, q: 5, env: 1500, envDecay: 0.1 },
      sub: 0.45,
    }),
    pad: tone({
      wave: 'square',
      unison: 2,
      detune: 12,
      gain: 0.08,
      attack: 0.08,
      decay: 0.6,
      sustain: 0.6,
      release: 0.4,
      filter: { freq: 1200 },
      pan: 0.18,
      reverb: 0.3,
    }),
    arp: tone({
      wave: 'pulse12',
      gain: 0.11,
      attack: 0.002,
      decay: 0.09,
      sustain: 0.15,
      release: 0.06,
      filter: { freq: 4500 },
      pan: 0.35,
      delay: 0.22,
    }),
    drums: kit({ gain: 0.55 }),
    hats: kit({ gain: 0.45 }),
  },
  patterns: {
    intro: {
      brass: comp(T_PROG.intro, ['*! - - * - - * - . . * - *! - - -', '*! - - * - - * - . . * - *! - - -', '*! - - * - - * - . . * - *! - - -', '*! - - * - - * - . . . . . . . .'], 'E4'),
      bass: `G1 - - G1 - - G1 - . . G1 - G1 - - - | A1 - - A1 - - A1 - . . A1 - A1 - - - |
             Bb1 - - Bb1 - - Bb1 - . . Bb1 - Bb1 - - - | C2 - - C2 - - C2 - . . C2 . A1 . C#2 . |`,
      drums: `x+k . . k . . k . . . k . s! . . . | k . . k . . k . . . k . s! . . . |
              k . . k . . k . . . k . s! . . . | k . . k . . k . s s? s s? s! s s! s! |`,
    },
    A: {
      lead: T_HOOK + T_ANSWER,
      bass: bassline(T_PROG.a, T_FUNK, 'B1'),
      pad: comp(T_PROG.a, '/2 * -', 'A4'),
      drums: T_DRUMS_8,
      hats: rep(`${T_HATS} |`, 8),
    },
    A2: {
      lead: T_HOOK + T_CADENCE,
      bass: bassline(T_PROG.a2, T_FUNK, 'B1'),
      pad: comp(T_PROG.a2, '/2 * -', 'A4'),
      arp: comp(T_PROG.a2, '/8 0 1 2 3 2 1 0 1', 'A5'),
      brass: comp(T_PROG.a2, [REST, '. . . . . . . . . . . . . . *! .'], 'E4'),
      drums: T_DRUMS_8,
      hats: rep(`${T_HATS} |`, 8),
    },
    B: {
      lead: T_BRIDGE,
      bass: bassline(T_PROG.b, '0! - - - - - - 12? 0 - - - 7 - 12 -', 'B1'),
      pad: comp(T_PROG.b, '/2 * -', 'A4'),
      arp: comp(T_PROG.b, '0 1 2 3 2 1 0 1 0 1 2 3 2 1 0 1', 'B5'),
      brass: comp(T_PROG.b, [REST, '. . . . . . . . . . *? - . *! - -'], 'E4'),
      drums: rep('k . . . . . . . s . k . . . . . |', 7) + ' k . . . . . . . s . s? s s! s s! s! |',
      hats: rep('/8 h h? h h? h h? h o |', 8),
    },
    lift: {
      lead: T_HOOK + T_ANSWER,
      brass: shift(T_HOOK + T_ANSWER, -12),
      bass: bassline(T_PROG.a, T_FUNK, 'B1'),
      pad: comp(T_PROG.a, '/2 * -', 'A4'),
      arp: comp(T_PROG.a, '/8 0 1 2 3 2 1 0 1', 'A5'),
      drums: T_DRUMS_8,
      hats: rep(`${T_HATS} |`, 8),
    },
    turn: {
      lead: T_TURN,
      bass: bassline(T_PROG.turn, T_FUNK, 'B1'),
      pad: comp(T_PROG.turn, '/2 * -', 'A4'),
      brass: comp(T_PROG.turn, [REST, '*! - - * - - * - . . . . . . . .'], 'E4'),
      drums: `${T_KS} | k . s? . k . s . s s? s s? s! s s! s! |`,
      hats: rep(`${T_HATS} |`, 2),
    },
  },
  intro: ['intro'],
  main: ['A', 'A2', 'B', 'lift+2', 'turn'],
};

// ================================================================ STORY
// "The Chrono Core" — cutscene underscore. D minor (dorian colour), 90 BPM.
// A clock that never stops: a glass tick-tock (A/E) pedals under changing
// harmony. A: a lyrical flute line with long notes and suspensions. B climbs
// to the high register. A2 adds a harp. C strips back to the clock and three
// rising sighs.

const S_PROG = {
  intro: 'Dm9 Bbmaj7 Gm9 A7sus4,A7',
  a: 'Dm9 Bbmaj7 Gm9 A7sus4,A7 Dm9 Fmaj7 Em7b5 A7sus4,A7',
  b: 'Bbmaj7 C Am7 Dm9 Gm9 Am7 Bbmaj7 A7sus4,A7',
  c: 'Dm9 Dm9 Bbmaj7 Bbmaj7 Gm9 Gm9 A7sus4 A7',
};
const S_TICK = '/8 A5 E5? A5 E5? A5 E5? A5 E5? |';
const S_A = `
  A4 - - - - - - - E5 - - - F5 - - - |
  D5 - - - - - - - - - - - . . . . |
  . . . . A4 - - - Bb4 - - - D5 - - - |
  E5 - - - - - - - C#5 - - - - - - - |
  A4 - - - - - - - E5 - - - F5 - - - |
  A5 - - - - - - - G5 - - - E5 - - - |
  G5 - - - - - - - E5 - - - D5 - Bb4 - |
  D5 - - - - - - - C#5 - - - - - - - |`;
const S_B = `
  F5 - - - - - - - A5 - - - - - G5 - |
  E5 - - - - - - - - - - - G5 - - - |
  C6 - - - - - - - B5 - - - A5 - - - |
  A5 - - - - - - - - - - - . . . . |
  Bb5 - - - - - - - A5 - - - G5 - - - |
  E5 - - - - - - - G5 - - - A5 - - - |
  D6 - - - - - - - C6 - - - A5 - - - |
  G5 - - - - - - - E5 - - - C#5 - - - |`;
const S_C = `
  ${REST} | . . . . . . . . F5 - E5 - D5 - - - |
  ${REST} | . . . . . . . . A5 - G5 - F5 - - - |
  ${REST} | . . . . . . . . Bb5 - A5 - G5 - - - |
  ${REST} | . . . . . . . . E5 - - - C#5 - - - |`;
const S_BASS = '0 - - - - - - - - - - - 7 - - -';
const S_PERC = 'k? . z? . z . z? . r . z? . z . z? . |';

const STORY: SongDef = {
  title: 'The Chrono Core',
  key: 'D minor / dorian',
  bpm: 90,
  loop: true,
  gain: 0.79,
  echo: { beats: 0.75, feedback: 0.4 },
  instruments: {
    flute: tone({
      wave: 'triangle',
      gain: 0.34,
      attack: 0.07,
      decay: 0.3,
      sustain: 0.8,
      release: 0.35,
      filter: { freq: 3500 },
      vibrato: { rate: 5, depth: 14, delay: 0.3 },
      glide: 0.08,
      reverb: 0.4,
      delay: 0.12,
    }),
    pad: tone({
      wave: 'sawtooth',
      unison: 3,
      detune: 14,
      gain: 0.11,
      attack: 0.7,
      decay: 1,
      sustain: 0.8,
      release: 1.4,
      filter: { freq: 850, q: 0.6 },
      reverb: 0.45,
    }),
    harp: tone({
      wave: 'triangle',
      gain: 0.16,
      attack: 0.002,
      decay: 0.6,
      sustain: 0,
      release: 0.5,
      pan: 0.3,
      delay: 0.3,
      reverb: 0.3,
    }),
    clock: tone({
      wave: 'sine',
      gain: 0.12,
      attack: 0.001,
      decay: 0.2,
      sustain: 0,
      release: 0.25,
      pan: -0.3,
      delay: 0.35,
    }),
    bass: tone({
      wave: 'triangle',
      gain: 0.22,
      attack: 0.02,
      decay: 0.5,
      sustain: 0.7,
      release: 0.35,
      filter: { freq: 500 },
    }),
    perc: kit({ gain: 0.26, decay: 0.8, reverb: 0.25 }),
  },
  patterns: {
    intro: {
      pad: comp(S_PROG.intro, '/1 *', 'A4'),
      clock: rep(S_TICK, 4),
      bass: bassline(S_PROG.intro, S_BASS, 'C2'),
    },
    A: {
      flute: S_A,
      pad: comp(S_PROG.a, '/2 * -', 'A4'),
      clock: rep(S_TICK, 8),
      bass: bassline(S_PROG.a, S_BASS, 'C2'),
    },
    B: {
      flute: S_B,
      pad: comp(S_PROG.b, '/2 * -', 'A4'),
      harp: comp(S_PROG.b, '/8 . . 0 1 2 . . .', 'D5'),
      bass: bassline(S_PROG.b, S_BASS, 'C2'),
      perc: rep(S_PERC, 8),
    },
    A2: {
      flute: S_A,
      pad: comp(S_PROG.a, '/2 * -', 'A4'),
      harp: comp(S_PROG.a, '/8 0 1 2 3 4 3 2 1', 'D5'),
      bass: bassline(S_PROG.a, S_BASS, 'C2'),
      perc: rep(S_PERC, 8),
    },
    C: {
      flute: S_C,
      pad: comp(S_PROG.c, '/2 * -', 'A4'),
      clock: rep(S_TICK, 8),
      bass: bassline(S_PROG.c, '0 - - - - - - - - - - - - - - -', 'C2'),
    },
  },
  intro: ['intro'],
  main: ['A', 'B', 'A2', 'C'],
};

// ================================================================ DUSK
// "Duskmere Coast" — golden dusk seaside. F major, 140 BPM, a light swing.
// Marimba off-beat skank, congas and shaker, slap bass with octave pops.
// A: a breezy syncopated hook over ii-V movement (Em7-A7 → Dm7, Cm7-F7 →
// Bb). A2 bends through Bbm6 (the borrowed iv, the sunset sigh). B sings in
// long notes while the marimba answers each phrase. The hook lifts to G,
// and Bbmaj7-C7 rolls it home.

const D_PROG = {
  intro: 'Bbmaj7 C7sus4,C7',
  a: 'Fmaj7 Em7,A7 Dm7 Cm7,F7 Bbmaj7 Am7 Gm7 C7sus4,C7',
  a2: 'Fmaj7 Em7,A7 Dm7 Cm7,F7 Bbmaj7 Bbm6 Am7,D7 Gm7,C7',
  b: 'Dm7 Am7 Bbmaj7 Fmaj7 Gm7 Am7 Bbmaj7 C7sus4,C7',
  turn: 'Bbmaj7 C7sus4,C7',
};
const D_HOOK = `
  C5 . F5 . A5 - G5 F5 . . E5 F5 - - . . |
  G5 - - - . . E5 - C#5 - - - A4 - . . |
  D5 . F5 . A5 - C6 A5 . . G5 A5 - - . . |
  Bb5 - - - . . G5 - A5 - - - Eb5 - . . |`;
const D_A_END = `
  D5 - - - F5 - A5 - - - G5 - F5 - D5 - |
  E5 - - - . . C5 - - - D5 - E5 - G5 - |
  F5 - - - - - D5 - - - Bb4 - C5 - D5 - |
  C5 - - - - - - - . . . . . . . . |`;
const D_A2_END = `
  D5 - - - F5 - A5 - - - C6 - A5 - F5 - |
  Db5 - - - - - F5 - - - G5 - - - . . |
  E5 - - - C5 - - - F#5 - - - A5 - - - |
  G5 - - - - - Bb5 - A5 - - - G5 - E5 - |`;
const D_B = `
  A5 - - - - - - - G5 - F5 - - - E5 - |
  C5 - - - - - - - - - - - . . . . |
  D5 - - - - - - - F5 - - - A5 - - - |
  A5 - - - - - - - G5 - - - . . . . |
  Bb5 - - - - - - - A5 - G5 - - - F5 - |
  E5 - - - - - - - - - - - . . . . |
  F5 - - - D5 - - - F5 - - - A5 - - - |
  G5 - - - - - - - . . . . . . . . |`;
const D_B_ANSWER = `
  ${REST} | . . . . . . . . . . . . E5 G5 A5 C6 |
  ${REST} | . . . . . . . . . . . . C6 A5 F5 C5 |
  ${REST} | . . . . . . . . . . . . G5 E5 C5 A4 |
  ${REST} | . . . . . . . . G4 C5 E5 G5 Bb5 G5 E5 C5 |`;
const D_A_ANSWER = `
  ${REST} | ${REST} | ${REST} | . . . . . . . . . . . . . . C6 A5 |
  ${REST} | ${REST} | ${REST} | . . . . . . . . E5 G5 Bb5 C6 . Bb5 G5 E5 |`;
const D_TURN = `
  F5 - - - - - D5 - - - F5 - A5 - C6 - |
  Bb5 - - - - - - - . . G5 - E5 - C5 - |`;
const D_GROOVE = ['0! . 12? 0 . . 12 . . 0 . 12? 0 . 7 <', '0! . . 12 . 7 . 12? 0 . 12 . 7 . 12 .'];
const D_SKANK = '. . *? . . . * . . . *? . . . * .';
const D_KS = 'k . . . p+s . . k . . k . p+s . . .';
const D_KS2 = 'k . . . p+s . . k . k? . k p+s . . .';
const D_KSX = 'x+k . . . p+s . . k . . k . p+s . . .';
const D_FILL = 'k . . . p+s . . k . . u u? t t? t! .';
const D_DRUMS_8 = `${D_KSX} | ${D_KS2} | ${D_KS} | ${D_KS2} | ${D_KS} | ${D_KS2} | ${D_KS} | ${D_FILL} |`;
const D_PERC = 'h? z h z? h? z h z? h? z h z? h? z o z? |';
const D_CONGA = '. . u? . . . u . t . . u? . . t t? |';

const DUSK: SongDef = {
  title: 'Duskmere Coast',
  key: 'F major (lift to G)',
  bpm: 140,
  swing: 0.12,
  loop: true,
  gain: 1.04,
  echo: { beats: 0.75, feedback: 0.3 },
  instruments: {
    lead: tone({
      wave: 'square',
      gain: 0.21,
      attack: 0.006,
      decay: 0.3,
      sustain: 0.7,
      release: 0.1,
      filter: { freq: 2600, q: 0.8 },
      vibrato: { rate: 5.2, depth: 18, delay: 0.2 },
      glide: 0.05,
      reverb: 0.18,
      delay: 0.08,
    }),
    mallet: tone({
      wave: 'triangle',
      gain: 0.26,
      attack: 0.002,
      decay: 0.22,
      sustain: 0,
      release: 0.15,
      pan: 0.3,
      reverb: 0.2,
      delay: 0.1,
    }),
    skank: tone({
      wave: 'triangle',
      unison: 2,
      detune: 6,
      gain: 0.2,
      attack: 0.002,
      decay: 0.12,
      sustain: 0,
      release: 0.08,
      pan: -0.25,
      reverb: 0.12,
    }),
    bass: tone({
      wave: 'sawtooth',
      gain: 0.3,
      attack: 0.002,
      decay: 0.12,
      sustain: 0.45,
      release: 0.05,
      gate: 0.78,
      filter: { freq: 600, q: 4, env: 2200, envDecay: 0.08 },
      sub: 0.4,
    }),
    pad: tone({
      wave: 'sawtooth',
      unison: 3,
      detune: 12,
      gain: 0.07,
      attack: 0.25,
      decay: 0.8,
      sustain: 0.7,
      release: 0.6,
      filter: { freq: 1500 },
      pan: 0.1,
      reverb: 0.35,
    }),
    drums: kit({ gain: 0.52, levels: { snare: 0.6, clap: 0.8 } }),
    perc: kit({ gain: 0.4 }),
    congas: kit({ gain: 0.3, tune: 1.7, decay: 0.6 }),
  },
  patterns: {
    intro: {
      skank: comp(D_PROG.intro, D_SKANK, 'C5'),
      bass: bassline(D_PROG.intro, D_GROOVE, 'C2'),
      mallet: `${REST} | . . . . . . . . C5 E5 G5 Bb5 C6 . . . |`,
      perc: rep(D_PERC, 2),
      congas: rep(D_CONGA, 2),
    },
    A: {
      lead: D_HOOK + D_A_END,
      mallet: D_A_ANSWER,
      skank: comp(D_PROG.a, D_SKANK, 'C5'),
      bass: bassline(D_PROG.a, D_GROOVE, 'C2'),
      drums: D_DRUMS_8,
      perc: rep(D_PERC, 8),
      congas: rep(D_CONGA, 8),
    },
    A2: {
      lead: D_HOOK + D_A2_END,
      skank: comp(D_PROG.a2, D_SKANK, 'C5'),
      pad: comp(D_PROG.a2, '/2 * -', 'F4'),
      bass: bassline(D_PROG.a2, D_GROOVE, 'C2'),
      drums: D_DRUMS_8,
      perc: rep(D_PERC, 8),
      congas: rep(D_CONGA, 8),
    },
    B: {
      lead: D_B,
      mallet: D_B_ANSWER,
      pad: comp(D_PROG.b, '/2 * -', 'F4'),
      bass: bassline(D_PROG.b, ['0! . . . 12 . . 0 . . 7 . 12 . . .', '0! . . . 12 . . 0 . . 7 . 12 . 0 <'], 'C2'),
      drums: rep('k . . . . . . . p+s . . k . . . . |', 7) + ` ${D_FILL} |`,
      perc: rep(D_PERC, 8),
    },
    lift: {
      lead: D_HOOK + D_A_END,
      mallet: shift(D_HOOK + D_A_END, 12),
      skank: comp(D_PROG.a, D_SKANK, 'C5'),
      pad: comp(D_PROG.a, '/2 * -', 'F4'),
      bass: bassline(D_PROG.a, D_GROOVE, 'C2'),
      drums: D_DRUMS_8,
      perc: rep(D_PERC, 8),
      congas: rep(D_CONGA, 8),
    },
    turn: {
      lead: D_TURN,
      skank: comp(D_PROG.turn, D_SKANK, 'C5'),
      bass: bassline(D_PROG.turn, D_GROOVE, 'C2'),
      drums: `${D_KS} | ${D_FILL} |`,
      perc: rep(D_PERC, 2),
      congas: rep(D_CONGA, 2),
    },
  },
  intro: ['intro'],
  main: ['A', 'A2', 'B', 'lift+2', 'turn'],
};

// ================================================================ MIDNIGHT
// "Otherwhile Foundry" — the endless night shift. C minor, 150 BPM.
// Sixteenth acid bass, saw brass, anvil clanks on the off-beats. A: a riff
// built from repeated notes and a pulse-wave counter that answers in the
// gaps. B opens up over Eb-Bb (the factory roof at night). A2 doubles
// everything. C is the machine room: call-and-response riffs climbing
// Ab → Bb → Fm → G7 back into the loop.

const M_PROG = {
  intro: 'Cm7 Cm7',
  a: 'Cm7 Cm7 Abmaj7 Bb,G7 Cm7 Cm7 Fm7 Abmaj7,G7',
  b: 'Ebmaj7 Bb Fm7 Cm7 Abmaj7 Bb Gsus4 G7',
  c: 'Abmaj7 Abmaj7 Bb Bb Fm7 Fm7 G7sus4 G7',
};
const M_A = `
  G4 . . G4 . . Bb4 . C5 - - . Eb5 - C5 . |
  . . . . . . . . Bb4 - G4 - F4 - G4 - |
  G4 . . G4 . . Bb4 . C5 - - . Eb5 - G5 . |
  F5 - - - - - D5 - . . B4 - D5 - F5 - |
  G5 - - . F5 - Eb5 - . . C5 - Eb5 - F5 - |
  G5 - - - - - - - . . . . . . . . |
  Ab5 - - . G5 - F5 - . . C5 - F5 - G5 - |
  Eb5 - - - - - C5 - B4 - - - D5 - - - |`;
const M_A_COUNTER = `
  ${REST} | C6 . Eb6 . G6 . Eb6 . . . . . . . . . |
  ${REST} | ${REST} |
  ${REST} | . . . . . . . . Bb5 . G5 . Eb5 . C5 . |
  ${REST} | ${REST} |`;
const M_B = `
  Bb5 - - - - - G5 - - - Eb5 - - - D5 - |
  F5 - - - - - - - - - - - . . . . |
  Ab5 - - - - - F5 - - - C5 - - - Eb5 - |
  G5 - - - - - - - - - - - . . . . |
  C6 - - - - - Bb5 - - - G5 - - - Eb5 - |
  D6 - - - - - - - F5 - - - Bb5 - - - |
  C6 - - - - - - - - - - - . . . . |
  B5 - - - - - - - G5 - - - F5 - D5 - |`;
const M_C = `
  C5 . C5 . Eb5 . . C5 . . Bb4 . C5 - - - | ${REST} |
  D5 . D5 . F5 . . D5 . . C5 . D5 - - - | ${REST} |
  F5 . F5 . Ab5 . . F5 . . Eb5 . F5 - - - | ${REST} |
  G5 - - - - - - - F5 - - - - - - - |
  D5 - - - - - - - B4 - - - - - - - |`;
const M_C_COUNTER = `
  ${REST} | Eb6 . C6 . G5 . C6 . Eb6 . . . . . . . |
  ${REST} | F6 . D6 . Bb5 . D6 . F6 . . . . . . . |
  ${REST} | Ab6 . F6 . C6 . F6 . Ab6 . . . . . . . |
  ${REST} | ${REST} |`;
const M_GROOVE = ['0! 0? 12 0? 0 0? 12? 0 0! 0? 12 0? 7 0? 12 7?', '0! 0? 12 0? 0 0? 12? 0 0! 0? 12 0? 7 7? 12? <'];
const M_KS = 'k . . k s+p . . . k . k . s+p . . k?';
const M_KS2 = 'k . . k s+p . . . k . k . s+p . k s?';
const M_KSX = 'x+k . . k s+p . . . k . k . s+p . . k?';
const M_FILL = 'k . . k s+p . . . k . s s? s! s? s s!';
const M_DRUMS_8 = `${M_KSX} | ${M_KS2} | ${M_KS} | ${M_KS2} | ${M_KS} | ${M_KS2} | ${M_KS} | ${M_FILL} |`;
const M_METAL = '. . m . . . m? . . . m . . m? . . |';
const M_HATS = 'h h? h h? h h? h h? h h? h h? h h? h h? |';

const MIDNIGHT: SongDef = {
  title: 'Otherwhile Foundry',
  key: 'C minor',
  bpm: 150,
  loop: true,
  gain: 1.15,
  echo: { beats: 0.5, feedback: 0.25 },
  instruments: {
    lead: tone({
      wave: 'sawtooth',
      unison: 2,
      detune: 8,
      gain: 0.3,
      attack: 0.008,
      decay: 0.25,
      sustain: 0.65,
      release: 0.1,
      filter: { freq: 1800, q: 1.5, env: 2400, envDecay: 0.25 },
      vibrato: { rate: 5.8, depth: 12, delay: 0.22 },
      reverb: 0.15,
    }),
    counter: tone({
      wave: 'pulse12',
      gain: 0.16,
      attack: 0.002,
      decay: 0.1,
      sustain: 0.3,
      release: 0.06,
      pan: 0.35,
      delay: 0.25,
    }),
    stab: tone({
      wave: 'sawtooth',
      unison: 2,
      detune: 12,
      gain: 0.16,
      attack: 0.004,
      decay: 0.15,
      sustain: 0.2,
      release: 0.08,
      filter: { freq: 900, q: 3, env: 2600, envDecay: 0.12 },
      pan: -0.3,
      reverb: 0.2,
    }),
    bass: tone({
      wave: 'sawtooth',
      gain: 0.27,
      attack: 0.002,
      decay: 0.08,
      sustain: 0.4,
      release: 0.03,
      gate: 0.7,
      filter: { freq: 380, q: 9, env: 1800, envDecay: 0.07 },
      sub: 0.45,
    }),
    pad: tone({
      wave: 'sawtooth',
      unison: 2,
      detune: 10,
      gain: 0.06,
      attack: 0.3,
      decay: 0.8,
      sustain: 0.7,
      release: 0.5,
      filter: { freq: 900 },
      reverb: 0.3,
    }),
    drums: kit({ gain: 0.55, levels: { clap: 0.6 } }),
    metal: kit({ gain: 0.4, reverb: 0.3 }),
    hats: kit({ gain: 0.4, decay: 0.7 }),
  },
  patterns: {
    intro: {
      bass: bassline(M_PROG.intro, M_GROOVE, 'C2'),
      metal: rep(M_METAL, 2),
      hats: rep(M_HATS, 2),
      drums: `${REST} | . . . . . . . . s? s s? s s! s s! s! |`,
    },
    A: {
      lead: M_A,
      counter: M_A_COUNTER,
      bass: bassline(M_PROG.a, M_GROOVE, 'C2'),
      drums: M_DRUMS_8,
      metal: rep(M_METAL, 8),
      hats: rep(M_HATS, 8),
    },
    B: {
      lead: M_B,
      stab: comp(M_PROG.b, '. . . . . . *! . . . . . . . * .', 'G4'),
      pad: comp(M_PROG.b, '/2 * -', 'G4'),
      bass: bassline(M_PROG.b, M_GROOVE, 'C2'),
      drums: M_DRUMS_8,
      metal: rep(M_METAL, 8),
      hats: rep(M_HATS, 8),
    },
    A2: {
      lead: M_A,
      counter: shift(M_A, 12),
      stab: comp(M_PROG.a, '. . . . . . *! . . . . . . . * .', 'G4'),
      bass: bassline(M_PROG.a, M_GROOVE, 'C2'),
      drums: M_DRUMS_8,
      metal: rep(M_METAL, 8),
      hats: rep(M_HATS, 8),
    },
    C: {
      lead: M_C,
      counter: M_C_COUNTER,
      stab: comp(M_PROG.c, '*! . . *? . . * . . . . . . . . .', 'G4'),
      bass: bassline(M_PROG.c, M_GROOVE, 'C2'),
      drums: rep('k . . . s+p . . . k . . . s+p . . . |', 7) + ` ${M_FILL} |`,
      metal: rep(M_METAL, 8),
      hats: rep(M_HATS, 8),
    },
  },
  intro: ['intro'],
  main: ['A', 'B', 'A2', 'C'],
};

// ================================================================ NEVER
// "The Underwhen" — a crystal cavern with no hour. D dorian, 120 BPM.
// Glass bells, arpeggios through a dotted-eighth ping-pong delay, a round
// triangle bass and soft hand percussion — no snare. The raised sixth (B
// natural, the G major chord) is the colour of the place. A: slow bell
// phrases with the cave answering. B climbs to a high E. A2 doubles the bell
// an octave up. C ("no hour"): the harmony planes up Dm9-Em7-Fmaj7-G while a
// single line rises one step per bar.

const N_PROG = {
  intro: 'Dm9 G Dm9 G',
  a: 'Dm9 G Dm9 G Bbmaj7 C Am7 Dm9',
  b: 'Bbmaj7 C Dm9 Am7 Bbmaj7 C Em7b5 A7sus4,A7',
  c: 'Dm9 Em7 Fmaj7 G Dm9 Em7 Fmaj7 Gsus4,G',
};
const N_A = `
  A5 - - - - - E5 - - - F5 - - - - - |
  B5 - - - - - - - - - - - . . . . |
  A5 - - - - - E5 - - - F5 - - - D5 - |
  G5 - - - - - - - D5 - - - B4 - - - |
  F5 - - - - - D5 - - - A5 - - - - - |
  G5 - - - - - - - E5 - - - . . . . |
  C6 - - - - - B5 - - - A5 - - - E5 - |
  D5 - - - - - - - - - - - . . . . |`;
const N_B = `
  D6 - - - - - - - C6 - - - A5 - - - |
  G5 - - - - - - - - - - - E5 - - - |
  F5 - - - E5 - - - D5 - - - A4 - - - |
  C5 - - - - - - - - - - - . . . . |
  D5 - - - F5 - - - A5 - - - C6 - - - |
  E6 - - - - - - - D6 - - - C6 - - - |
  Bb5 - - - - - - - G5 - - - - - - - |
  A5 - - - - - - - C#6 - - - - - - - |`;
const N_C = `
  ${rests(4)}
  A4 - - - - - - - - - - - - - - - |
  B4 - - - - - - - - - - - - - - - |
  C5 - - - - - - - - - - - - - - - |
  D5 - - - - - - - - - - - B4 - - - |`;
const N_ARP = '/8 0 1 2 3 4 3 2 1';
const N_BASS = '0! - - - - - - - - - 7 - - - 12? -';
const N_PERC = 'k . . . . . k? . r . . . . . . . |';
const N_SHAKER = 'z? z? z z? z? z? z z? z? z? z z? z? z? z z? |';

const NEVER: SongDef = {
  title: 'The Underwhen',
  key: 'D dorian',
  bpm: 120,
  loop: true,
  gain: 0.9,
  echo: { beats: 0.75, feedback: 0.48 },
  instruments: {
    bell: tone({
      wave: 'triangle',
      gain: 0.32,
      attack: 0.003,
      decay: 0.7,
      sustain: 0.3,
      release: 0.8,
      vibrato: { rate: 4.5, depth: 8, delay: 0.4 },
      reverb: 0.45,
      delay: 0.22,
    }),
    glass: tone({
      wave: 'sine',
      gain: 0.13,
      attack: 0.002,
      decay: 0.5,
      sustain: 0.15,
      release: 0.9,
      pan: 0.25,
      reverb: 0.5,
      delay: 0.3,
    }),
    arp: tone({
      wave: 'pulse12',
      gain: 0.14,
      attack: 0.002,
      decay: 0.15,
      sustain: 0.1,
      release: 0.12,
      filter: { freq: 2800 },
      pan: -0.2,
      delay: 0.55,
      reverb: 0.25,
    }),
    pad: tone({
      wave: 'square',
      unison: 2,
      detune: 10,
      gain: 0.07,
      attack: 0.9,
      decay: 1,
      sustain: 0.8,
      release: 1.2,
      filter: { freq: 700 },
      reverb: 0.5,
    }),
    bass: tone({
      wave: 'triangle',
      gain: 0.24,
      attack: 0.01,
      decay: 0.5,
      sustain: 0.6,
      release: 0.3,
      filter: { freq: 600 },
      sub: 0.3,
    }),
    perc: kit({ gain: 0.4, decay: 0.9, reverb: 0.3, levels: { kick: 0.8 } }),
    shaker: kit({ gain: 0.35, reverb: 0.2 }),
  },
  patterns: {
    intro: {
      arp: comp(N_PROG.intro, N_ARP, 'A5'),
      pad: comp(N_PROG.intro, '/1 *', 'A4'),
    },
    A: {
      bell: N_A,
      arp: comp(N_PROG.a, N_ARP, 'A5'),
      pad: comp(N_PROG.a, '/2 * -', 'A4'),
      bass: bassline(N_PROG.a, N_BASS, 'C2'),
      perc: rep(N_PERC, 8),
      shaker: rep(N_SHAKER, 8),
    },
    B: {
      bell: N_B,
      arp: comp(N_PROG.b, N_ARP, 'A5'),
      pad: comp(N_PROG.b, '/2 * -', 'A4'),
      bass: bassline(N_PROG.b, N_BASS, 'C2'),
      perc: rep('k . . . . . k? . r . . . . . u? t? |', 8),
      shaker: rep(N_SHAKER, 8),
    },
    A2: {
      bell: N_A,
      glass: shift(N_A, 12),
      arp: comp(N_PROG.a, N_ARP, 'A5'),
      pad: comp(N_PROG.a, '/2 * -', 'A4'),
      bass: bassline(N_PROG.a, N_BASS, 'C2'),
      perc: rep(N_PERC, 8),
      shaker: rep(N_SHAKER, 8),
    },
    C: {
      glass: N_C,
      arp: comp(N_PROG.c, '0 2 1 3 2 4 3 5 4 3 2 1 0 2 1 3', 'A5'),
      pad: comp(N_PROG.c, '/2 * -', 'A4'),
      bass: bassline(N_PROG.c, '0! - - - - - - - - - - - - - - -', 'C2'),
      shaker: rep(N_SHAKER, 8),
    },
  },
  intro: ['intro'],
  main: ['A', 'B', 'A2', 'C'],
};

// ================================================================ TOMORROW
// "Noon Tomorrow" — neon city, endless countdown. A minor, 160 BPM.
// Eurobeat engine: four-on-the-floor, octave bass, supersaw stabs on the
// off-beats. Verse: a repeated-note syncopated figure (A A C E…). Chorus: the
// IV-V-iii-vi climb with a soaring long-note line ending on E7 → F (the
// deceptive cadence the genre runs on). Second chorus lifts a whole step.

const W_PROG = {
  intro: 'Fmaj7 G Em7 Am7',
  a: 'Am Fmaj7 G Am Am Fmaj7 G E7',
  b: 'Fmaj7 G Em7 Am7 Dm7 G Cmaj7 E7',
  turn: 'Fmaj7 G,E7',
};
const W_VERSE = `
  A4 . A4 . C5 . E5 - - . D5 - C5 - B4 - |
  C5 - - - A4 - - - . . . . . . . . |
  B4 . B4 . D5 . G5 - - . F5 - E5 - D5 - |
  E5 - - - - - - - . . . . . . . . |
  A4 . A4 . C5 . E5 - - . D5 - C5 - B4 - |
  C5 - - - F5 - - - A5 - - - G5 - F5 - |
  G5 - - - - - D5 - - - B4 - D5 - F5 - |
  E5 - - - - - - - G#5 - - - B5 - - - |`;
const W_VERSE_ANSWER = `
  ${REST} | . . . . . . . . A5 C6 E6 A5 C6 E6 G6? E6 |
  ${REST} | . . . . . . . . E6 C6 A5 E5 A5 C6 E6 A6 |
  ${rests(4)}`;
const W_CHORUS = `
  A5 - - - - - G5 - - - A5 - - - C6 - |
  B5 - - - - - G5 - - - D5 - - - G5 - |
  G5 - - - - - E5 - - - G5 - - - B5 - |
  A5 - - - - - - - - - - - . . E5 G5 |
  A5 - - - - - F5 - - - A5 - - - C6 - |
  B5 - - - - - - - D6 - - - B5 - - - |
  C6 - - - - - B5 - - - G5 - - - E5 - |
  G#5 - - - - - - - B5 - - - D6 - - - |`;
const W_TURN = `
  A5 - - - - - - - C6 - - - E6 - - - |
  D6 - - - - - - - B5 - - - G#5 - - - |`;
const W_STABS = '. . *! . . . * . . . *! . . . * .';
const W_OCT = '0! . 12 . 0 . 12 . 0! . 12 . 0 . 12 <';
const W_K = 'k . . . k+p . . . k . . . k+p . . .';
const W_KX = 'x+k . . . k+p . . . k . . . k+p . . .';
const W_FILL = 'k . . . k+p . . . k . s s? s s! s s!';
const W_DRUMS_8 = `${W_KX} | ${W_K} | ${W_K} | ${W_K} | ${W_K} | ${W_K} | ${W_K} | ${W_FILL} |`;
const W_HATS = 'h? h? o h? h? h? o h? h? h? o h? h? h? o h? |';

const TOMORROW: SongDef = {
  title: 'Noon Tomorrow',
  key: 'A minor (chorus lifts to B minor)',
  bpm: 160,
  loop: true,
  gain: 1.07,
  echo: { beats: 0.75, feedback: 0.3 },
  instruments: {
    lead: tone({
      wave: 'sawtooth',
      unison: 2,
      detune: 7,
      gain: 0.29,
      attack: 0.005,
      decay: 0.3,
      sustain: 0.7,
      release: 0.12,
      filter: { freq: 4200, q: 0.8 },
      vibrato: { rate: 6, depth: 14, delay: 0.2 },
      glide: 0.04,
      reverb: 0.18,
      delay: 0.12,
    }),
    sparkle: tone({
      wave: 'pulse25',
      gain: 0.1,
      attack: 0.003,
      decay: 0.2,
      sustain: 0.5,
      release: 0.1,
      pan: 0.3,
      delay: 0.2,
    }),
    stabs: tone({
      wave: 'sawtooth',
      unison: 3,
      detune: 18,
      gain: 0.15,
      attack: 0.003,
      decay: 0.16,
      sustain: 0.15,
      release: 0.09,
      filter: { freq: 1600, q: 1.5, env: 3600, envDecay: 0.12 },
      pan: -0.15,
      reverb: 0.2,
    }),
    pluck: tone({
      wave: 'square',
      gain: 0.13,
      attack: 0.002,
      decay: 0.12,
      sustain: 0.1,
      release: 0.08,
      filter: { freq: 3000, env: 3000, envDecay: 0.1 },
      pan: 0.35,
      delay: 0.3,
    }),
    pad: tone({
      wave: 'sawtooth',
      unison: 3,
      detune: 16,
      gain: 0.07,
      attack: 0.2,
      decay: 0.8,
      sustain: 0.75,
      release: 0.5,
      filter: { freq: 1800 },
      reverb: 0.35,
    }),
    bass: tone({
      wave: 'sawtooth',
      gain: 0.27,
      attack: 0.002,
      decay: 0.1,
      sustain: 0.5,
      release: 0.04,
      gate: 0.75,
      filter: { freq: 700, q: 3, env: 1600, envDecay: 0.08 },
      sub: 0.4,
    }),
    drums: kit({ gain: 0.55, levels: { clap: 0.9 } }),
    hats: kit({ gain: 0.38 }),
  },
  patterns: {
    intro: {
      stabs: comp(W_PROG.intro, W_STABS, 'A4'),
      hats: rep(W_HATS, 4),
      drums: `${rests(2)} ${W_K} | k . . . k+p . . . k . s s? s s! s! s! |`,
      bass: `${rests(2)} ${bassline('Em7 Am7', W_OCT, 'D2')}`,
    },
    A: {
      lead: W_VERSE,
      pluck: W_VERSE_ANSWER,
      stabs: comp(W_PROG.a, W_STABS, 'A4'),
      bass: bassline(W_PROG.a, W_OCT, 'D2'),
      drums: W_DRUMS_8,
      hats: rep(W_HATS, 8),
    },
    B: {
      lead: W_CHORUS,
      stabs: comp(W_PROG.b, W_STABS, 'A4'),
      pad: comp(W_PROG.b, '/2 * -', 'E4'),
      bass: bassline(W_PROG.b, W_OCT, 'D2'),
      drums: W_DRUMS_8,
      hats: rep(W_HATS, 8),
    },
    A2: {
      lead: W_VERSE,
      pluck: comp(W_PROG.a, '0 1 2 3 1 2 3 4 2 3 4 5 3 4 5 6', 'A5'),
      stabs: comp(W_PROG.a, W_STABS, 'A4'),
      pad: comp(W_PROG.a, '/2 * -', 'E4'),
      bass: bassline(W_PROG.a, W_OCT, 'D2'),
      drums: W_DRUMS_8,
      hats: rep(W_HATS, 8),
    },
    lift: {
      lead: W_CHORUS,
      sparkle: shift(W_CHORUS, 12),
      stabs: comp(W_PROG.b, W_STABS, 'A4'),
      pad: comp(W_PROG.b, '/2 * -', 'E4'),
      bass: bassline(W_PROG.b, W_OCT, 'D2'),
      drums: W_DRUMS_8,
      hats: rep(W_HATS, 8),
    },
    turn: {
      lead: W_TURN,
      stabs: comp(W_PROG.turn, '*! . . *! . . *! . . . *! . *! . . .', 'A4'),
      bass: bassline(W_PROG.turn, W_OCT, 'D2'),
      drums: `${W_K} | ${W_FILL} |`,
      hats: rep(W_HATS, 2),
    },
  },
  intro: ['intro'],
  main: ['A', 'B', 'A2', 'lift+2', 'turn'],
};

// ================================================================ BOSS
// "Clockbreaker" — 168 BPM, E minor with the phrygian flat second (F) as the
// threat. The bass riff is the boss's heartbeat: E-E-E'-E … D … G-F, and it
// follows the harmony note for note into F. The lead reuses the main theme's
// 3+3+2 cell, now on a chromatic neighbour (E-E-F). A2 adds brass stabs and a
// sixteenth arp. B is the struggle: a heroic C-D-Em climb that cannot quite
// resolve (B7). R is a two-bar riff that climbs a semitone at a time, four
// times — the pressure ratchets until the loop resets.

const B_PROG = {
  intro: 'Em Em',
  a: 'Em Em F Em Em Em F,G Em',
  b: 'C D Em Em C D B7 B7',
  r: 'Em F',
};
const B_A = `
  E5 - - E5 - - F5 - E5 - - - B4 - C5 - |
  B4 - - - - - - - . . . . . . . . |
  F5 - - F5 - - Gb5 - F5 - - - C5 - Db5 - |
  C5 - - - - - - - B4 - - - . . . . |
  G5 - - G5 - - A5 - G5 - - - E5 - F#5 - |
  G5 - - - - - - - . . . . . . . . |
  A5 - - A5 - - C6 - B5 - - - D6 - - - |
  E6! - - - - - - - - - - - . . . . |`;
const B_B = `
  E5 - - - - - G5 - - - C6 - - - B5 - |
  A5 - - - - - - - F#5 - - - D5 - - - |
  G5 - - - - - E5 - - - B4 - - - E5 - |
  F#5 - - - - - - - G5 - - - A5 - - - |
  G5 - - - - - E5 - - - C5 - - - G5 - |
  A5 - - - - - F#5 - - - D5 - - - A5 - |
  B5 - - - - - - - D#5 - - - F#5 - - - |
  A5 - - - - - - - - - - - . . . . |`;
const B_R = `
  B4 . B4 . E5 . B4 . D5 - - . E5 - - - |
  C5 . C5 . F5 . C5 . E5 - - . F5 - - - |`;
const B_RIFF = '0! 0 12 0 . 0 10 0 . 0 12 0 3 . 1? .';
const B_STAB = '. . . . . . . . *! . . * . . * .';
const B_KS = 'k . . k s . k . k . . k s . k .';
const B_KS2 = 'k . . k s . k . k . k k s . s? s';
const B_KSX = 'x+k . . k s . k . k . . k s . k .';
const B_FILL = 'k . . k s . k . t t u u t! t u! u!';
const B_DRUMS_8 = `${B_KSX} | ${B_KS} | ${B_KS} | ${B_KS2} | ${B_KS} | ${B_KS} | ${B_KS} | ${B_FILL} |`;
const B_HATS = 'h! h h? h h! h h? h h! h h? h h! h h? h |';

const BOSS_INSTRUMENTS: SongDef['instruments'] = {
  lead: tone({
    wave: 'sawtooth',
    unison: 2,
    detune: 14,
    gain: 0.29,
    attack: 0.004,
    decay: 0.2,
    sustain: 0.75,
    release: 0.08,
    filter: { freq: 3400, q: 1.2 },
    vibrato: { rate: 6.5, depth: 16, delay: 0.16 },
    reverb: 0.12,
  }),
  brass: tone({
    wave: 'sawtooth',
    unison: 2,
    detune: 10,
    gain: 0.16,
    attack: 0.004,
    decay: 0.14,
    sustain: 0.3,
    release: 0.08,
    filter: { freq: 1100, q: 2.5, env: 3000, envDecay: 0.12 },
    pan: -0.25,
    reverb: 0.15,
  }),
  arp: tone({
    wave: 'pulse12',
    gain: 0.11,
    attack: 0.002,
    decay: 0.07,
    sustain: 0.2,
    release: 0.04,
    pan: 0.3,
    delay: 0.15,
  }),
  bass: tone({
    wave: 'sawtooth',
    gain: 0.28,
    attack: 0.002,
    decay: 0.09,
    sustain: 0.45,
    release: 0.03,
    gate: 0.72,
    filter: { freq: 450, q: 6, env: 1700, envDecay: 0.07 },
    sub: 0.45,
  }),
  pad: tone({
    wave: 'square',
    unison: 2,
    detune: 14,
    gain: 0.06,
    attack: 0.15,
    decay: 0.5,
    sustain: 0.7,
    release: 0.3,
    filter: { freq: 1000 },
    reverb: 0.25,
  }),
  drums: kit({ gain: 0.56, levels: { tomLo: 0.9, tomHi: 0.9 } }),
  hats: kit({ gain: 0.38 }),
};

const BOSS_PATTERNS: SongDef['patterns'] = {
  intro: {
    bass: bassline(B_PROG.intro, B_RIFF, 'C2'),
    hats: rep(B_HATS, 2),
    drums: `${REST} | . . . . . . . . t t u u t! t u! u! |`,
  },
  A: {
    lead: B_A,
    bass: bassline(B_PROG.a, B_RIFF, 'C2'),
    pad: comp(B_PROG.a, '/2 * -', 'G4'),
    drums: B_DRUMS_8,
    hats: rep(B_HATS, 8),
  },
  A2: {
    lead: B_A,
    brass: comp(B_PROG.a, [REST, B_STAB], 'G4'),
    arp: comp(B_PROG.a, '0 1 2 3 2 1 0 1 0 1 2 3 2 1 0 1', 'B5'),
    bass: bassline(B_PROG.a, B_RIFF, 'C2'),
    pad: comp(B_PROG.a, '/2 * -', 'G4'),
    drums: B_DRUMS_8,
    hats: rep(B_HATS, 8),
  },
  B: {
    lead: B_B,
    arp: comp(B_PROG.b, '0 1 2 1 0 1 2 1 0 1 2 1 0 1 2 1', 'B5'),
    brass: comp(B_PROG.b, '*! . . * . . * . . . . . . . . .', 'G4'),
    bass: bassline(B_PROG.b, '0! . 0 0 12 . 0 0 0! . 0 0 12 . 7 <', 'C2'),
    drums: B_DRUMS_8,
    hats: rep(B_HATS, 8),
  },
  R: {
    lead: B_R,
    brass: comp(B_PROG.r, '*! . . *! . . *! . . . . . . . . .', 'G4'),
    bass: bassline(B_PROG.r, B_RIFF, 'C2'),
    drums: `${B_KSX} | ${B_KS2} |`,
    hats: rep(B_HATS, 2),
  },
};

const BOSS: SongDef = {
  title: 'Clockbreaker',
  key: 'E minor (phrygian bII)',
  bpm: 168,
  loop: true,
  gain: 0.94,
  echo: { beats: 0.5, feedback: 0.22 },
  instruments: BOSS_INSTRUMENTS,
  patterns: BOSS_PATTERNS,
  intro: ['intro'],
  main: ['A', 'A2', 'B', 'R', 'R+1', 'R+2', 'R+3'],
};

// ================================================================ FINALE
// "Clockbreaker (Rematch)" — the same DNA, wound tighter: 176 BPM, a
// semitone higher from the first note (F minor), a raging arpeggio and
// sixteenth-crash accents over the hook, the climb going one rung further,
// and a last statement of the hook a minor third up (G minor).

const FINALE: SongDef = {
  title: 'Clockbreaker (Rematch)',
  key: 'F minor → G minor',
  bpm: 176,
  loop: true,
  gain: 0.95,
  echo: { beats: 0.5, feedback: 0.22 },
  instruments: BOSS_INSTRUMENTS,
  patterns: {
    ...BOSS_PATTERNS,
    rage: {
      ...BOSS_PATTERNS.A2,
      arp: comp(B_PROG.a, '0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1', 'B5'),
      brass: comp(B_PROG.a, [REST, B_STAB, '*! . . *! . . *! . . . . . . . . .', B_STAB], 'G4'),
      drums: `${B_KSX} | ${B_KS2} | x+k . . k s . k . k . . k s . k . | ${B_KS2} |
              ${B_KSX} | ${B_KS2} | x+k . . k s . k . k . . k s . k . | ${B_FILL} |`,
    },
  },
  intro: ['intro+1'],
  main: ['A+1', 'rage+1', 'B+1', 'R+1', 'R+2', 'R+3', 'R+4', 'rage+3'],
};

// ================================================================ CLEAR
// Act-clear jingle: C major, a rising arpeggio, the heroic bVI-bVII (Ab-Bb)
// and a held C with vibrato. ~4.4 s, plays once.

const CLEAR: SongDef = {
  title: 'Act Clear',
  key: 'C major',
  bpm: 165,
  loop: false,
  gain: 1.25,
  instruments: {
    lead: TITLE.instruments.lead,
    brass: TITLE.instruments.brass,
    bass: TITLE.instruments.bass,
    arp: TITLE.instruments.arp,
    drums: TITLE.instruments.drums,
  },
  patterns: {
    fanfare: {
      lead: `C5 . E5 . G5 . C6 - - - G5 - C6 - E6 - |
             Eb6 - - - - - C6 - D6 - - - - - F6 - |
             E6! - - - - - - - - - - - . . . . |`,
      brass: comp('C Ab,Bb C', ['*! . . . . . * - . . * - * - - -', '* - - - - - * - * - - - - - * -', '*! - - - - - - - - - - - . . . .'], 'E4'),
      bass: `C2 . . . C2 . . . G1 . . . C2 . . . |
             Ab1 - - - - - Ab1 - Bb1 - - - - - Bb1 - |
             C2 - - - - - - - - - - - . . . . |`,
      arp: `${REST} | ${REST} | /16 C6 E6 G6 C7 E7 G7 C7? G6? E6? . . . . . . . |`,
      drums: `x+k . . . s . . . k . . . s . s s |
              k . . . s . . k k . . . s s s! s! |
              x+k . . . . . . . . . . . . . . . |`,
    },
  },
  main: ['fanfare'],
};

// ================================================================ ENDING
// "Tomorrow, Again" — the ending. C major, 96 BPM, a gentle swing. The main
// theme's hook comes home as a ballad (a whole step down, half the energy),
// then a new tender B melody, the hook again with a bell counter-line, and
// a coda that settles on a plain C major chord: resolved, nothing left
// ticking.

const E_PROG = {
  intro: 'Fmaj7 Em7 Dm7 G7sus4',
  a: 'Cmaj7 Dm7 Em7 F,G7sus4 Am7 Fmaj7 Dm7,G7 C',
  b: 'Fmaj7 G Em7 Am7 Dm7 Em7 Fmaj7 G7sus4,G7',
  c: 'Fmaj7 G Am7 Am7 Fmaj7 G Csus4,C C',
};
const E_HOOK = shift(T_HOOK + T_CADENCE, -2);
const E_B = `
  A5 - - - - - - - G5 - A5 - C6 - - - |
  B5 - - - - - - - - - - - G5 - - - |
  G5 - - - - - - - E5 - G5 - B5 - - - |
  A5 - - - - - - - - - - - . . . . |
  F5 - - - - - - - E5 - F5 - A5 - - - |
  G5 - - - - - - - - - - - E5 - - - |
  A5 - - - - - - - C6 - - - E6 - - - |
  D6 - - - - - - - B5 - - - G5 - - - |`;
const E_C = `
  C6 - - - - - - - A5 - - - G5 - - - |
  G5 - - - - - - - - - - - D5 - - - |
  E5 - - - - - - - - - - - - - - - |
  . . . . . . . . E5 - G5 - A5 - C6 - |
  C6 - - - - - - - A5 - - - G5 - - - |
  B5 - - - - - - - D6 - - - - - - - |
  F5 - - - - - - - E5 - - - - - - - |
  C5 - - - - - - - - - - - . . . . |`;
const E_EP = '*? . . * . . . . . . * . . . . .';
const E_BASS = '0 - - - - - - 7? 0 - - - 12? - 7 -';
const E_DRUMS = 'k . . . . . k? . r . . . . . . . |';
const E_SHAKER = '/8 z? z z? z z? z z? z |';

const ENDING: SongDef = {
  title: 'Tomorrow, Again',
  key: 'C major',
  bpm: 96,
  swing: 0.1,
  loop: true,
  gain: 0.8,
  echo: { beats: 0.75, feedback: 0.35 },
  instruments: {
    lead: tone({
      wave: 'square',
      gain: 0.22,
      attack: 0.02,
      decay: 0.4,
      sustain: 0.75,
      release: 0.25,
      filter: { freq: 2000, q: 0.7 },
      vibrato: { rate: 5, depth: 16, delay: 0.25 },
      glide: 0.06,
      reverb: 0.35,
      delay: 0.12,
    }),
    bell: tone({
      wave: 'sine',
      gain: 0.15,
      attack: 0.002,
      decay: 0.6,
      sustain: 0.2,
      release: 0.8,
      pan: 0.3,
      reverb: 0.45,
      delay: 0.2,
    }),
    ep: tone({
      wave: 'triangle',
      unison: 2,
      detune: 6,
      gain: 0.2,
      attack: 0.005,
      decay: 0.8,
      sustain: 0.3,
      release: 0.5,
      filter: { freq: 2500 },
      pan: -0.2,
      reverb: 0.3,
    }),
    pad: tone({
      wave: 'sawtooth',
      unison: 3,
      detune: 12,
      gain: 0.07,
      attack: 0.6,
      decay: 1,
      sustain: 0.8,
      release: 1.2,
      filter: { freq: 1000 },
      reverb: 0.4,
    }),
    bass: tone({
      wave: 'triangle',
      gain: 0.25,
      attack: 0.01,
      decay: 0.4,
      sustain: 0.6,
      release: 0.25,
      filter: { freq: 700 },
      sub: 0.4,
    }),
    drums: kit({ gain: 0.38, decay: 0.85, reverb: 0.2, levels: { kick: 0.9 } }),
    shaker: kit({ gain: 0.32 }),
  },
  patterns: {
    intro: {
      ep: comp(E_PROG.intro, E_EP, 'E4'),
      pad: comp(E_PROG.intro, '/1 *', 'G4'),
      bass: `${rests(2)} ${bassline('Dm7 G7sus4', E_BASS, 'C2')}`,
    },
    A: {
      lead: E_HOOK,
      ep: comp(E_PROG.a, E_EP, 'E4'),
      pad: comp(E_PROG.a, '/2 * -', 'G4'),
      bass: bassline(E_PROG.a, E_BASS, 'C2'),
      drums: rep(E_DRUMS, 8),
      shaker: rep(E_SHAKER, 8),
    },
    B: {
      lead: E_B,
      ep: comp(E_PROG.b, E_EP, 'E4'),
      pad: comp(E_PROG.b, '/2 * -', 'G4'),
      bass: bassline(E_PROG.b, E_BASS, 'C2'),
      drums: rep(E_DRUMS, 8),
      shaker: rep(E_SHAKER, 8),
    },
    A2: {
      lead: E_HOOK,
      bell: comp(E_PROG.a, '/4 . 2 . 1', 'C6'),
      ep: comp(E_PROG.a, E_EP, 'E4'),
      pad: comp(E_PROG.a, '/2 * -', 'G4'),
      bass: bassline(E_PROG.a, E_BASS, 'C2'),
      drums: rep(E_DRUMS, 8),
      shaker: rep(E_SHAKER, 8),
    },
    C: {
      lead: E_C,
      bell: shift(E_C, 12),
      ep: comp(E_PROG.c, E_EP, 'E4'),
      pad: comp(E_PROG.c, '/2 * -', 'G4'),
      bass: bassline(E_PROG.c, E_BASS, 'C2'),
      shaker: rep(E_SHAKER, 8),
    },
  },
  intro: ['intro'],
  main: ['A', 'B', 'A2', 'C'],
};

/** Every track the game can request. */
export const SONGS: Readonly<Record<TrackId, SongDef>> = {
  title: TITLE,
  story: STORY,
  dusk: DUSK,
  midnight: MIDNIGHT,
  never: NEVER,
  tomorrow: TOMORROW,
  boss: BOSS,
  finale: FINALE,
  clear: CLEAR,
  ending: ENDING,
};
