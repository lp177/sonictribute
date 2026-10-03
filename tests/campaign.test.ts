import { describe, it, expect } from 'vitest';
import { LEVELS, BIOMES, biomeActs } from '../src/levels/index.ts';
import { Progress, type ActBest } from '../src/game/progress.ts';
import {
  STORY_HOUR_OF_DUSK,
  STORY_HOUR_OF_MIDNIGHT,
  STORY_HOUR_OF_NEVER,
  STORY_HOUR_OF_TOMORROW,
  STORY_ENDING,
  speakerOf,
} from '../src/game/story.ts';

/** In-memory localStorage so persistence is testable headless. */
function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

const run = (score = 1000): ActBest => ({ score, timeFrames: 3600, crystals: 3, secrets: 1 });

describe('Campaign shape — the four stolen hours', () => {
  it('declares four biomes, each a different theme and hour', () => {
    expect(BIOMES).toHaveLength(4);
    expect(new Set(BIOMES.map((b) => b.theme)).size).toBe(4);
    expect(new Set(BIOMES.map((b) => b.name)).size).toBe(4);
  });

  it('orders acts by biome with no interleaving', () => {
    const seq = LEVELS.map((d) => d.biome);
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i], 'acts of a biome must be contiguous').toBeGreaterThanOrEqual(seq[i - 1]);
    }
    for (const e of LEVELS) expect(e.biome).toBeLessThan(BIOMES.length);
  });

  it('biomeActs returns each act with its campaign index', () => {
    const all = BIOMES.flatMap((_, i) => biomeActs(i));
    expect(all.length).toBe(LEVELS.length);
    for (const { def, index } of all) expect(LEVELS[index]).toBe(def);
  });

  it('act titles are unique — the level select must distinguish them', () => {
    const titles = LEVELS.map((d) => d.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('the story tells four stuck hours and an ending, in its own words', () => {
    const beats = [
      STORY_HOUR_OF_DUSK,
      STORY_HOUR_OF_MIDNIGHT,
      STORY_HOUR_OF_NEVER,
      STORY_HOUR_OF_TOMORROW,
      STORY_ENDING,
    ];
    expect(new Set(beats.map((b) => b.id)).size).toBe(5);
    for (const b of beats) expect(b.lines.length).toBeGreaterThanOrEqual(3);
    // The scenario's own vocabulary, not the borrowed one.
    expect(STORY_HOUR_OF_DUSK.lines.join(' ')).toMatch(/HOUR SHARDS/);
    expect(STORY_ENDING.lines.join(' ')).toMatch(/Tomorrow|tomorrow/);
  });

  it('the villain is heard: an entrance, a boast and a laugh in the opener, a taunt in every beat', () => {
    const beats = [
      STORY_HOUR_OF_DUSK,
      STORY_HOUR_OF_MIDNIGHT,
      STORY_HOUR_OF_NEVER,
      STORY_HOUR_OF_TOMORROW,
      STORY_ENDING,
    ];
    for (const b of beats) {
      expect(b.speakers, b.id).toHaveLength(b.lines.length);
      const spoken = b.lines.filter((_, i) => speakerOf(b, i)?.who === 'yolk');
      expect(spoken.length, `${b.id}: Yolk never speaks`).toBeGreaterThanOrEqual(1);
      // The narrator opens and closes every beat: Yolk interrupts, he does not host.
      expect(speakerOf(b, 0)).toBeNull();
      expect(speakerOf(b, b.lines.length - 1)).toBeNull();
    }
    const moods = STORY_HOUR_OF_DUSK.speakers!.map((s) => s?.mood ?? null);
    const first = moods.findIndex((m) => m !== null);
    // He arrives before the Core is cracked, and laughs before he cracks it.
    const crack = STORY_HOUR_OF_DUSK.lines.findIndex((l) => /HOUR SHARDS/.test(l));
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(crack);
    expect(moods.indexOf('laugh')).toBeGreaterThan(first);
    expect(moods.indexOf('laugh')).toBeLessThan(crack);
    expect(moods.filter((m) => m !== null).length).toBeGreaterThanOrEqual(4);
    // Beaten, he is not laughing any more.
    expect(STORY_ENDING.speakers!.find((s) => s)?.mood).toBe('sad');
  });
});

describe('Progress — clears, bests, unlocks', () => {
  it('starts with only the first act unlocked', () => {
    const p = new Progress();
    expect(p.isUnlocked(0)).toBe(true);
    expect(p.isUnlocked(1)).toBe(false);
    expect(p.clearedCount()).toBe(0);
    expect(p.continueAt(10)).toBe(0);
  });

  it('clearing an act unlocks the next one', () => {
    const p = new Progress();
    p.recordClear(0, run());
    expect(p.isCleared(0)).toBe(true);
    expect(p.isUnlocked(1)).toBe(true);
    expect(p.isUnlocked(2)).toBe(false);
    expect(p.continueAt(10)).toBe(1);
  });

  it('keeps the best of each metric independently', () => {
    const p = new Progress();
    p.recordClear(3, { score: 500, timeFrames: 7200, crystals: 5, secrets: 0 });
    p.recordClear(3, { score: 900, timeFrames: 9000, crystals: 1, secrets: 3 });
    // A faster earlier time and a fuller earlier collection both survive.
    expect(p.best(3)).toEqual({ score: 900, timeFrames: 7200, crystals: 5, secrets: 3 });
  });

  it('continueAt lands on the first uncleared act, not past the end', () => {
    const p = new Progress();
    p.recordClear(0, run());
    p.recordClear(1, run());
    p.recordClear(2, run());
    expect(p.continueAt(3)).toBe(2); // everything cleared: replay the finale
    expect(p.continueAt(5)).toBe(3);
  });

  it('round-trips through storage', () => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
    try {
      const p = new Progress();
      p.recordClear(0, run(2500));
      p.recordClear(1, run(700));
      p.save();
      const q = Progress.load();
      expect(q.isCleared(0)).toBe(true);
      expect(q.best(0)!.score).toBe(2500);
      expect(q.isUnlocked(2)).toBe(true);
      expect(q.clearedCount()).toBe(2);
    } finally {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  });

  it('survives missing or corrupt storage', () => {
    expect(Progress.load().clearedCount()).toBe(0);
    const store = fakeStorage();
    store.setItem('bolt.progress.v1', '{broken');
    (globalThis as { localStorage?: Storage }).localStorage = store;
    try {
      expect(Progress.load().clearedCount()).toBe(0);
      expect(() => new Progress().save()).not.toThrow();
    } finally {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  });

  it('ignores junk entries when loading', () => {
    const store = fakeStorage();
    store.setItem(
      'bolt.progress.v1',
      JSON.stringify({ '0': run(100), 'x': run(1), '-3': run(1), '2': { score: 'no' } }),
    );
    (globalThis as { localStorage?: Storage }).localStorage = store;
    try {
      const p = Progress.load();
      expect(p.clearedCount()).toBe(1);
      expect(p.isCleared(0)).toBe(true);
    } finally {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  });
});
