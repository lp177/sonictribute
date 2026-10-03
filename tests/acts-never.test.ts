import { describe, it, expect } from 'vitest';
import { neverActs } from '../src/levels/never/index.ts';
import { STORY_HOUR_OF_NEVER } from '../src/game/story.ts';
import { checkAct } from './actContract.ts';

/**
 * THE UNDERWHEN (biome 2, theme 'crystal') — the ten-act roster gate.
 * Every act must pass the full campaign act contract, and the roster itself
 * must have the agreed campaign shape: one intro on the opener, shard bosses
 * at the mid-check (act 5) and the finale (act 10), long worlds throughout.
 */
describe('THE UNDERWHEN — roster shape', () => {
  it('has ten acts in order, all biome 2 / crystal', () => {
    expect(neverActs).toHaveLength(10);
    neverActs.forEach((d, i) => {
      expect(d.act, d.title).toBe(`ACT ${i + 1}`);
      expect(d.biome, d.title).toBe(2);
      expect(d.theme, d.title).toBe('crystal');
      // This biome answers "too short": every act runs long.
    });
  });

  it('only act 1 carries the biome intro', () => {
    expect(neverActs[0].intro).toBe(STORY_HOUR_OF_NEVER);
    neverActs.slice(1).forEach((d) => expect(d.intro, d.title).toBeUndefined());
  });

  it('shard bosses guard acts 5 and 10, nothing else', () => {
    neverActs.forEach((d, i) => {
      if (i === 4 || i === 9) expect(d.bossKind, d.title).toBe('shard');
      else expect(d.bossKind, d.title).toBeUndefined();
    });
  });

  it('titles are unique scene-descriptive postcards', () => {
    const titles = neverActs.map((d) => d.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe('THE UNDERWHEN — act contract', () => {
  it.each(neverActs.map((d, i) => [`${String(i + 1).padStart(2, '0')} ${d.title}`, d] as const))(
    '%s',
    (_name, def) => checkAct(def),
  );
});
