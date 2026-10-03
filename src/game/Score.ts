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
  /**
   * Target time for the act (frames). Derived from the run length and the
   * boss, so a long act is not ranked against a short one's clock.
   */
  parFrames?: number;
  /** Deaths this run (respawns at a checkpoint). */
  deaths?: number;
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

/* ---------------------------------- Rank ---------------------------------- */

export type Rank = 'S' | 'A' | 'B' | 'C' | 'D';

export const RANKS: readonly Rank[] = ['S', 'A', 'B', 'C', 'D'];

/**
 * Par time for an act: the distance to the goal at a good player's average
 * pace, plus a fixed allowance for a boss fight. The pace is 3.6 px/frame:
 * the acts are built on downhills now, a first-timer holding right averages
 * about 4.5 on the default road and a rolled run is quicker still, so par is
 * a clean run that stops for a crystal or two. Tidebreak Run's par is ~45 s.
 */
export const PAR_PACE = 3.6;

export function parTime(goalX: number, hasBoss: boolean): number {
  return Math.round(goalX / PAR_PACE + (hasBoss ? 45 * 60 : 0));
}

/**
 * The act rank — a single letter that rewards the four ways to play an act
 * well, so every kind of player has something to chase on a replay:
 *   pace      30 pts  (full at or under par, nothing at three times par)
 *   crystals  35 pts  (exploration: the Chrono Crystals across all routes)
 *   no damage 20 pts  (minus 5 per death if hit)
 *   rings     15 pts  (rings still held at the goal, 100 = full)
 * S >= 85, A >= 70, B >= 50, C >= 30, else D.
 */
export function computeRank(stats: LevelStats): { rank: Rank; points: number } {
  const par = stats.parFrames ?? 90 * 60;
  const ratio = stats.timeFrames <= par ? 1 : Math.max(0, 1 - (stats.timeFrames - par) / (2 * par));
  const pace = 30 * ratio;
  const crystals = stats.crystalsTotal > 0 ? (35 * stats.crystalsFound) / stats.crystalsTotal : 35;
  const care = stats.tookDamage ? Math.max(0, 10 - 5 * (stats.deaths ?? 0)) : 20;
  const rings = (15 * Math.min(100, stats.ringsHeld)) / 100;
  const points = Math.round(pace + crystals + care + rings);
  const rank: Rank = points >= 85 ? 'S' : points >= 70 ? 'A' : points >= 50 ? 'B' : points >= 30 ? 'C' : 'D';
  return { rank, points };
}

/** True when `a` is a better rank than `b` (null = no rank yet). */
export function betterRank(a: Rank, b: Rank | null | undefined): boolean {
  return !b || RANKS.indexOf(a) < RANKS.indexOf(b);
}
