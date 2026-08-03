import { describe, it, expect } from 'vitest';
import { midnightActs } from '../src/levels/midnight/index.ts';
import { STORY_HOUR_OF_MIDNIGHT } from '../src/game/story.ts';
import { checkAct } from './actContract.ts';

/**
 * Biome 1 roster shape: eleven acts, the story beat only on the opener, the
 * Piston Press at the mid-check and the finale, and no duplicate postcards.
 */
describe('OTHERWHILE FOUNDRY — roster', () => {
  it('has 11 acts in shift order with unique scene titles', () => {
    expect(midnightActs).toHaveLength(11);
    midnightActs.forEach((d, i) => {
      expect(d.act).toBe(`ACT ${i + 1}`);
      expect(d.biome).toBe(1);
      expect(d.theme).toBe('gear');
      expect(d.width ?? 320).toBeGreaterThanOrEqual(320);
      expect(d.width ?? 320).toBeLessThanOrEqual(420);
    });
    expect(new Set(midnightActs.map((d) => d.title)).size).toBe(11);
  });

  it('only act 1 carries the midnight cutscene', () => {
    expect(midnightActs[0].intro).toBe(STORY_HOUR_OF_MIDNIGHT);
    for (const d of midnightActs.slice(1)) expect(d.intro).toBeUndefined();
  });

  it('the Piston Press guards acts 6 and 11, nothing else', () => {
    midnightActs.forEach((d, i) => {
      if (i === 5 || i === 10) expect(d.bossKind).toBe('press');
      else expect(d.bossKind).toBeUndefined();
    });
  });
});

/** Every midnight act passes the full campaign quality gate. */
describe('OTHERWHILE FOUNDRY — act contract', () => {
  it.each(
    midnightActs.map((d, i) => [`${String(i + 1).padStart(2, '0')} ${d.title}`, d] as const),
  )('%s', (_name, def) => checkAct(def));
});
