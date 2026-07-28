/** Score & achievements — pure functions, unit tested. */

export const SCORE = {
  ring: 10,
  enemy: 100,
  monitor: 200,
  crystal: 1000,
  secret: 500,
  bossHit: 100,
  bossDefeat: 1000,
  ringBonusEach: 100,
} as const;

/** SPG-style time bonus tiers (input in frames at 60 fps). */
export function timeBonus(frames: number): number {
  const s = frames / 60;
  if (s < 30) return 10000;
  if (s < 45) return 5000;
  if (s < 60) return 4000;
  if (s < 90) return 3000;
  if (s < 120) return 2000;
  if (s < 180) return 1000;
  if (s < 300) return 500;
  return 0;
}

export function ringBonus(rings: number): number {
  return rings * SCORE.ringBonusEach;
}

export interface LevelStats {
  timeFrames: number;
  ringsHeld: number;
  ringsCollected: number;
  crystalsFound: number;
  crystalsTotal: number;
  secretsFound: number;
  secretsTotal: number;
  tookDamage: boolean;
}

export interface Achievement {
  id: string;
  label: string;
}

export function computeAchievements(stats: LevelStats): Achievement[] {
  const out: Achievement[] = [];
  if (stats.crystalsFound === stats.crystalsTotal && stats.crystalsTotal > 0) {
    out.push({ id: 'crystal-hunter', label: 'Crystal Hunter — all Chrono Crystals recovered' });
  }
  if (stats.timeFrames < 90 * 60) {
    out.push({ id: 'speed-demon', label: 'Speed Demon — finished under 1:30' });
  }
  if (!stats.tookDamage) {
    out.push({ id: 'untouchable', label: 'Untouchable — no damage taken' });
  }
  if (stats.ringsCollected >= 100) {
    out.push({ id: 'ring-master', label: 'Ring Master — 100+ rings collected' });
  }
  if (stats.secretsFound === stats.secretsTotal && stats.secretsTotal > 0) {
    out.push({ id: 'explorer', label: 'Explorer — every secret room found' });
  }
  return out;
}
