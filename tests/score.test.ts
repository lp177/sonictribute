import { describe, it, expect } from 'vitest';
import { timeBonus, ringBonus, computeAchievements, type LevelStats } from '../src/game/Score.ts';

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
