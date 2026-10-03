import { describe, it, expect } from 'vitest';
import {
  SONGS,
  TRACK_IDS,
  bassline,
  chordToMidi,
  comp,
  compileSong,
  midiToFreq,
  midiToName,
  noteFreq,
  noteToMidi,
  parseLane,
  parseProgression,
  parseRef,
  rep,
  shift,
  songSeconds,
  stepSeconds,
  voiceChord,
  VEL_ACCENT,
  VEL_GHOST,
  VEL_NORMAL,
  type SongDef,
  type TrackId,
} from '../src/audio/songs.ts';
import { volumeCurve, dbToGain, gainToDb } from '../src/audio/mixer.ts';

describe('pitch', () => {
  it('A4 is 440 Hz and C4 is middle C', () => {
    expect(noteFreq('A4')).toBe(440);
    expect(noteFreq('C4')).toBeCloseTo(261.63, 2);
    expect(noteFreq('A5')).toBeCloseTo(880, 6);
    expect(noteFreq('A3')).toBeCloseTo(220, 6);
  });

  it('spells sharps and flats as the same pitch', () => {
    expect(noteToMidi('C#4')).toBe(noteToMidi('Db4'));
    expect(noteToMidi('B3') + 1).toBe(noteToMidi('C4'));
    expect(noteToMidi('Cb4')).toBe(noteToMidi('B3'));
    expect(noteToMidi('C-1')).toBe(0);
    expect(midiToName(61)).toBe('C#4');
    expect(midiToFreq(69 + 12)).toBeCloseTo(880, 6);
  });

  it('rejects junk', () => {
    expect(() => noteToMidi('H4')).toThrow();
    expect(() => noteToMidi('C')).toThrow();
  });

  it('builds chords from symbols, with inversions', () => {
    expect(chordToMidi('C@4')).toEqual([60, 64, 67]);
    expect(chordToMidi('Am7@3')).toEqual([57, 60, 64, 67]);
    expect(chordToMidi('C@4:1')).toEqual([64, 67, 72]);
    expect(() => chordToMidi('Cxyz@4')).toThrow(/quality/);
  });
});

describe('lane notation', () => {
  it('parses notes, rests and holds on a sixteenth grid', () => {
    const l = parseLane('C5 . E5 - - G5');
    expect(l.steps).toBe(6);
    expect(l.events.map((e) => [e.step, e.steps, e.midi[0]])).toEqual([
      [0, 1, 72],
      [2, 3, 76],
      [5, 1, 79],
    ]);
    expect(l.openEnd).toBe(true);
  });

  it('parses accents, ghosts and glides', () => {
    const l = parseLane('C5! D5? ~E5 F5');
    expect(l.events.map((e) => e.vel)).toEqual([VEL_ACCENT, VEL_GHOST, VEL_NORMAL, VEL_NORMAL]);
    expect(l.events.map((e) => e.glide)).toEqual([false, false, true, false]);
  });

  it('parses note stacks and chord symbols', () => {
    const l = parseLane('C4+E4+G4 Am7@3!');
    expect(l.events[0].midi).toEqual([60, 64, 67]);
    expect(l.events[1].midi).toEqual([57, 60, 64, 67]);
    expect(l.events[1].vel).toBe(VEL_ACCENT);
  });

  it('parses drum lanes with layered hits', () => {
    const l = parseLane('k . h+s . o? x+k');
    expect(l.events.map((e) => e.drums)).toEqual([['kick'], ['hat', 'snare'], ['open'], ['crash', 'kick']]);
    expect(l.events[2].vel).toBe(VEL_GHOST);
    expect(l.events.every((e) => e.midi.length === 0)).toBe(true);
  });

  it('a resolution marker makes each token span more steps', () => {
    const l = parseLane('/4 C4 - D4 . /16 E4');
    expect(l.steps).toBe(17);
    expect(l.events.map((e) => [e.step, e.steps])).toEqual([
      [0, 8],
      [8, 4],
      [16, 1],
    ]);
  });

  it('bar lines catch a missing step instead of drifting out of time', () => {
    expect(() => parseLane('C4 . . . | D4 . .', 4)).toThrow(/bar 2 has 3 steps/);
    expect(() => parseLane('C4 . . . | D4 . . .', 4)).not.toThrow();
  });

  it('leading holds belong to the previous pattern', () => {
    const l = parseLane('- - C5 .');
    expect(l.leadTie).toBe(2);
    expect(l.events[0].step).toBe(2);
    // A hold after a rest is just more rest.
    expect(parseLane('. - C5').leadTie).toBe(0);
  });

  it('rejects unknown tokens', () => {
    expect(() => parseLane('C5 q D5')).toThrow(/unknown token/);
  });
});

describe('composing helpers', () => {
  it('rep and shift', () => {
    expect(rep('a b', 3)).toBe('a b a b a b');
    expect(shift('C4 . ~D4! Am7@3 k', 2)).toBe('D4 . ~E4! Bm7@3 k');
    expect(shift('B4+D5', 1)).toBe('C5+D#5');
  });

  it('progressions split bars on commas', () => {
    const p = parseProgression('C Dm7,G7');
    expect(p.steps).toBe(32);
    expect(p.chords.map((c) => c.from)).toEqual([0, 16, 24]);
  });

  it('voices chords near a centre (voice leading)', () => {
    const v = voiceChord(0, [0, 4, 7], noteToMidi('G4'));
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    expect(Math.abs(mean - noteToMidi('G4'))).toBeLessThanOrEqual(4);
  });

  it('comp plays chord tones against the progression', () => {
    const lane = comp('C', '0 1 2 * . . . . . . . . . . . .', 'E4');
    const l = parseLane(lane);
    expect(l.events[3].midi.length).toBe(3);
    expect(l.steps).toBe(16);
  });

  it('a held comp re-strikes when the chord changes under it', () => {
    const l = parseLane(comp('C,G', '/1 *', 'E4'));
    // '/1 *' would hold C for the whole bar; there is no G event, which is
    // why pads use '/2 * -' — the hold over the change re-strikes.
    expect(l.events.length).toBe(1);
    const l2 = parseLane(comp('C,G', '/2 * -', 'E4'));
    expect(l2.events.length).toBe(2);
    expect(l2.events[1].step).toBe(8);
  });

  it('bassline follows roots with offsets and walks into the next chord', () => {
    const l = parseLane(bassline('C G', '0 . 12 . 7 . . . . . . . . . . <', 'C2'));
    const notes = l.events.map((e) => midiToName(e.midi[0]));
    expect(notes.slice(0, 4)).toEqual(['C2', 'C3', 'G2', 'F#2']); // F#2 = approach to G2
  });

  it('bassline keeps stepwise progressions stepwise', () => {
    const l = parseLane(bassline('D E F# G A', '0 . . . . . . . . . . . . . . .', 'B1'));
    const roots = l.events.map((e) => e.midi[0]);
    for (let i = 1; i < roots.length; i++) expect(roots[i]).toBeGreaterThan(roots[i - 1]);
  });

  it('pattern refs carry transposition and repeats', () => {
    expect(parseRef('A')).toEqual({ name: 'A', transpose: 0, times: 1 });
    expect(parseRef('lift+2')).toEqual({ name: 'lift', transpose: 2, times: 1 });
    expect(parseRef('R-3*2')).toEqual({ name: 'R', transpose: -3, times: 2 });
    expect(parseRef('A2+1')).toEqual({ name: 'A2', transpose: 1, times: 1 });
  });
});

const tiny = (over: Partial<SongDef> = {}): SongDef => ({
  title: 'tiny',
  key: 'C',
  bpm: 120,
  loop: true,
  instruments: {
    lead: { kind: 'tone', wave: 'square', gain: 0.2, attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.1 },
    drums: { kind: 'drums', gain: 0.5 },
  },
  patterns: {
    P: { lead: 'C4 - - - | E4 - - -', drums: 'k . . . | s . . .' },
    Q: { lead: '- - G4 .', drums: 'k . h .' },
  },
  meter: 1,
  main: ['P', 'Q'],
  ...over,
});

describe('compiler', () => {
  it('flattens patterns, ties across pattern boundaries and transposes', () => {
    const c = compileSong(tiny({ main: ['P', 'Q', 'P+2'] }));
    expect(c.main.steps).toBe(20);
    // E4 at step 4 is held into Q's two leading holds: 4 + 2 steps.
    const e4 = c.main.events[4].find((e) => e.lane === 'lead')!;
    expect(e4.steps).toBe(6);
    // P+2 transposes the lead but not the drums.
    expect(c.main.events[12].find((e) => e.lane === 'lead')!.midi).toEqual([62]);
    expect(c.main.events[12].find((e) => e.lane === 'drums')!.drums).toEqual(['kick']);
  });

  it('rejects lanes of different lengths in one pattern', () => {
    expect(() => compileSong(tiny({ patterns: { P: { lead: 'C4 . . .', drums: 'k . .' } }, main: ['P'] }))).toThrow(
      /steps/,
    );
  });

  it('rejects unknown patterns and instruments, and drums in melodic lanes', () => {
    expect(() => compileSong(tiny({ main: ['Nope'] }))).toThrow(/unknown pattern/);
    expect(() => compileSong(tiny({ patterns: { P: { tuba: 'C4' } }, main: ['P'] }))).toThrow(/unknown instrument/);
    expect(() => compileSong(tiny({ patterns: { P: { lead: 'k' } }, main: ['P'] }))).toThrow(/drums in melodic/);
    expect(() => compileSong(tiny({ patterns: { P: { drums: 'C4' } }, main: ['P'] }))).toThrow(/notes in drum/);
  });

  it('repeats a ref with *n', () => {
    expect(compileSong(tiny({ main: ['Q*3'] })).main.steps).toBe(12);
  });
});

describe('the soundtrack', () => {
  const GAME_REQUESTS: TrackId[] = ['title', 'story', 'dusk', 'midnight', 'never', 'tomorrow', 'boss', 'finale', 'clear', 'ending'];

  it('has every track the game asks for', () => {
    for (const id of GAME_REQUESTS) expect(SONGS[id], id).toBeDefined();
    expect([...TRACK_IDS].sort()).toEqual([...GAME_REQUESTS].sort());
  });

  for (const id of TRACK_IDS) {
    describe(id, () => {
      const def = SONGS[id];
      const song = compileSong(def);

      it('parses, with every bar complete', () => {
        expect(song.main.steps).toBeGreaterThan(0);
      });

      it('loops on a bar line', () => {
        expect(song.main.steps % song.stepsPerBar).toBe(0);
        expect(song.intro.steps % song.stepsPerBar).toBe(0);
      });

      it('has a sane tempo', () => {
        expect(def.bpm).toBeGreaterThanOrEqual(60);
        expect(def.bpm).toBeLessThanOrEqual(200);
        expect(stepSeconds(def.bpm)).toBeGreaterThan(0);
      });

      it('has no dead air at the loop point', () => {
        // The first step of the loop body plays something (bass, drum or chord).
        expect(song.main.events[0].length).toBeGreaterThan(0);
      });

      it('keeps every note in a playable range', () => {
        for (const sec of [song.intro, song.main]) {
          for (const step of sec.events) {
            for (const ev of step) {
              const patch = def.instruments[ev.lane];
              const oct = patch.kind === 'tone' ? 12 * (patch.octave ?? 0) : 0;
              for (const m of ev.midi) {
                const f = midiToFreq(m + oct);
                expect(f, `${id}/${ev.lane}`).toBeGreaterThan(30);
                expect(f, `${id}/${ev.lane}`).toBeLessThan(4200);
              }
              expect(ev.steps).toBeGreaterThan(0);
            }
          }
        }
      });

      if (def.loop) {
        it('is a real piece, not a two-bar loop (>= 32 bars, several sections)', () => {
          expect(song.main.steps / song.stepsPerBar).toBeGreaterThanOrEqual(32);
          const distinct = new Set(def.main.map((r) => r.replace(/[+-]\d+.*$/, '')));
          expect(distinct.size).toBeGreaterThanOrEqual(3);
        });

        it('has a melody', () => {
          const lanes = new Set(song.main.events.flat().filter((e) => e.midi.length === 1).map((e) => e.lane));
          expect(lanes.size).toBeGreaterThanOrEqual(2);
        });
      } else {
        it('is a short one-shot jingle', () => {
          const s = songSeconds(song);
          expect(s).toBeGreaterThan(2);
          expect(s).toBeLessThan(7);
        });
      }
    });
  }

  it('only the act-clear jingle is non-looping', () => {
    expect(TRACK_IDS.filter((id) => !SONGS[id].loop)).toEqual(['clear']);
  });

  it('every biome has its own band (instrument palettes differ)', () => {
    const palette = (id: TrackId): string =>
      Object.entries(SONGS[id].instruments)
        .map(([k, p]) => `${k}:${p.kind === 'tone' ? p.wave : 'kit'}`)
        .sort()
        .join(',');
    const biomes: TrackId[] = ['dusk', 'midnight', 'never', 'tomorrow'];
    expect(new Set(biomes.map(palette)).size).toBe(biomes.length);
  });

  it('the finale is the boss rematch: faster and higher', () => {
    expect(SONGS.finale.bpm).toBeGreaterThan(SONGS.boss.bpm);
    const lead = (id: TrackId) => compileSong(SONGS[id]).main.events.flat().find((e) => e.lane === 'lead')!.midi[0];
    expect(lead('finale')).toBeGreaterThan(lead('boss'));
  });
});

describe('mixer curves', () => {
  it('volume is perceptual (squared) and clamped', () => {
    expect(volumeCurve(0)).toBe(0);
    expect(volumeCurve(1)).toBe(1);
    expect(volumeCurve(0.5)).toBeCloseTo(0.25);
    expect(volumeCurve(2)).toBe(1);
    expect(volumeCurve(-1)).toBe(0);
    expect(volumeCurve(Number.NaN)).toBe(0);
  });

  it('dB helpers round-trip', () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
    expect(gainToDb(dbToGain(-9))).toBeCloseTo(-9, 6);
  });
});
