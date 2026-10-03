import { describe, it, expect } from 'vitest';
import { timeBonus, ringBonus, computeAchievements, computeRank, betterRank, parTime, type LevelStats } from '../src/game/Score.ts';

const baseStats: LevelStats = {
  timeFrames: 60 * 60,
  ringsHeld: 0,
  ringsCollected: 0,
  crystalsFound: 0,
  crystalsTotal: 5,
  secretsFound: 0,
  secretsTotal: 3,
  tookDamage: false,
};

describe('time bonus (SPG-style tiers)', () => {
  it('awards top bonus under 30 seconds', () => {
    expect(timeBonus(29 * 60)).toBe(10000);
  });
  it('decays through the tiers', () => {
    expect(timeBonus(44 * 60)).toBe(5000);
    expect(timeBonus(59 * 60)).toBe(4000);
    expect(timeBonus(89 * 60)).toBe(3000);
    expect(timeBonus(119 * 60)).toBe(2000);
    expect(timeBonus(179 * 60)).toBe(1000);
    expect(timeBonus(299 * 60)).toBe(500);
    expect(timeBonus(300 * 60)).toBe(0);
  });
});

describe('ring bonus', () => {
  it('is 100 per held ring', () => {
    expect(ringBonus(37)).toBe(3700);
    expect(ringBonus(0)).toBe(0);
  });
});

describe('achievements', () => {
  it('crystal hunter requires all crystals', () => {
    const s = { ...baseStats, crystalsFound: 5 };
    expect(computeAchievements(s).map((a) => a.id)).toContain('crystal-hunter');
    const s2 = { ...baseStats, crystalsFound: 4 };
    expect(computeAchievements(s2).map((a) => a.id)).not.toContain('crystal-hunter');
  });

  it('speed demon under 1:30', () => {
    const s = { ...baseStats, timeFrames: 89 * 60 };
    expect(computeAchievements(s).map((a) => a.id)).toContain('speed-demon');
    const s2 = { ...baseStats, timeFrames: 91 * 60 };
    expect(computeAchievements(s2).map((a) => a.id)).not.toContain('speed-demon');
  });

  it('untouchable only without damage', () => {
    expect(computeAchievements(baseStats).map((a) => a.id)).toContain('untouchable');
    const s = { ...baseStats, tookDamage: true };
    expect(computeAchievements(s).map((a) => a.id)).not.toContain('untouchable');
  });

  it('ring master at 100+ collected', () => {
    const s = { ...baseStats, ringsCollected: 100 };
    expect(computeAchievements(s).map((a) => a.id)).toContain('ring-master');
    const s2 = { ...baseStats, ringsCollected: 99 };
    expect(computeAchievements(s2).map((a) => a.id)).not.toContain('ring-master');
  });

  it('explorer requires every secret room', () => {
    const s = { ...baseStats, secretsFound: 3 };
    expect(computeAchievements(s).map((a) => a.id)).toContain('explorer');
    const s2 = { ...baseStats, secretsFound: 2 };
    expect(computeAchievements(s2).map((a) => a.id)).not.toContain('explorer');
  });
});

describe('act rank', () => {
  const perfect: LevelStats = {
    ...baseStats,
    timeFrames: 30 * 60,
    parFrames: 40 * 60,
    crystalsFound: 5,
    ringsHeld: 100,
    tookDamage: false,
  };

  it('a flawless, fast, full-collection run is an S', () => {
    expect(computeRank(perfect)).toEqual({ rank: 'S', points: 100 });
  });

  it('pace is full at par and fades to nothing at three times par', () => {
    const atPar = computeRank({ ...perfect, timeFrames: perfect.parFrames! }).points;
    const slow = computeRank({ ...perfect, timeFrames: perfect.parFrames! * 2 }).points;
    const crawl = computeRank({ ...perfect, timeFrames: perfect.parFrames! * 3 }).points;
    expect(atPar).toBe(100);
    expect(slow).toBe(85);
    expect(crawl).toBe(70);
    expect(computeRank({ ...perfect, timeFrames: perfect.parFrames! * 9 }).points).toBe(70);
  });

  it('every way of playing well counts: an explorer who is slow still ranks', () => {
    const explorer = computeRank({ ...perfect, timeFrames: perfect.parFrames! * 3, ringsHeld: 0 });
    expect(explorer.rank).toBe('B');
  });

  it('damage costs less than dying', () => {
    const hit = computeRank({ ...perfect, tookDamage: true }).points;
    const died = computeRank({ ...perfect, tookDamage: true, deaths: 2 }).points;
    expect(hit).toBe(90);
    expect(died).toBe(80);
  });

  it('a bare finish is a D', () => {
    const bare = computeRank({ ...baseStats, timeFrames: 99 * 60 * 60, parFrames: 60 * 60, tookDamage: true, deaths: 3 });
    expect(bare.rank).toBe('D');
  });

  it('orders ranks for best-of bookkeeping', () => {
    expect(betterRank('S', 'A')).toBe(true);
    expect(betterRank('B', 'A')).toBe(false);
    expect(betterRank('C', null)).toBe(true);
  });

  it('par time grows with the run and allows for a boss', () => {
    expect(parTime(7200, false)).toBe(2000);
    expect(parTime(7200, true)).toBe(2000 + 45 * 60);
    expect(parTime(14400, false)).toBe(2 * parTime(7200, false));
  });
});
