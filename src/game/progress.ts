/**
 * Campaign progress: which acts are cleared, with per-act bests. Pure logic
 * plus a guarded localStorage layer (same pattern as core/bindings.ts), so it
 * is fully unit-testable headless.
 *
 * Unlock rule: an act is playable when it is the first act or the act before
 * it has been cleared. Level select exists so a cleared act can be replayed
 * directly — that is what makes per-act completion runs practical.
 */

import { betterRank, RANKS, type Rank } from './Score.ts';

export interface ActBest {
  score: number;
  timeFrames: number;
  crystals: number;
  secrets: number;
  /** Best rank earned (absent on saves from before ranks existed). */
  rank?: Rank;
}

const STORAGE_KEY = 'bolt.progress.v1';

export class Progress {
  private cleared = new Map<number, ActBest>();

  isCleared(index: number): boolean {
    return this.cleared.has(index);
  }

  best(index: number): ActBest | null {
    const b = this.cleared.get(index);
    return b ? { ...b } : null;
  }

  isUnlocked(index: number): boolean {
    return index === 0 || this.cleared.has(index - 1);
  }

  /** Number of cleared acts (drives the title-screen completion counter). */
  clearedCount(): number {
    return this.cleared.size;
  }

  /** The act the campaign should continue from: first not-yet-cleared. */
  continueAt(total: number): number {
    for (let i = 0; i < total; i++) if (!this.cleared.has(i)) return i;
    return Math.max(0, total - 1);
  }

  /**
   * Records a clear, keeping the best of each metric independently — a
   * faster run should not erase an earlier full-crystal run's collection.
   */
  recordClear(index: number, run: ActBest): void {
    const prev = this.cleared.get(index);
    this.cleared.set(
      index,
      prev
        ? {
            score: Math.max(prev.score, run.score),
            timeFrames: Math.min(prev.timeFrames, run.timeFrames),
            crystals: Math.max(prev.crystals, run.crystals),
            secrets: Math.max(prev.secrets, run.secrets),
            rank: run.rank && betterRank(run.rank, prev.rank) ? run.rank : prev.rank,
          }
        : { ...run },
    );
  }

  toJSON(): Record<string, ActBest> {
    const out: Record<string, ActBest> = {};
    for (const [k, v] of this.cleared) out[String(k)] = v;
    return out;
  }

  save(): void {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.toJSON()));
    } catch {
      // Private mode / disabled storage — progress simply does not persist.
    }
  }

  static load(): Progress {
    const p = new Progress();
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as Record<string, ActBest>;
        for (const [k, v] of Object.entries(data)) {
          const i = Number(k);
          if (
            Number.isInteger(i) &&
            i >= 0 &&
            typeof v?.score === 'number' &&
            typeof v?.timeFrames === 'number'
          ) {
            p.cleared.set(i, {
              score: v.score,
              timeFrames: v.timeFrames,
              crystals: v.crystals ?? 0,
              secrets: v.secrets ?? 0,
              ...(RANKS.includes(v.rank as Rank) ? { rank: v.rank } : {}),
            });
          }
        }
      }
    } catch {
      // Corrupt storage falls back to a fresh campaign.
    }
    return p;
  }
}
