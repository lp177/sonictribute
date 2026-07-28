import type { Player } from './Player.ts';

export type ArenaPhase = 'open' | 'slamming' | 'locked' | 'opening' | 'cleared';

/**
 * The boss arena lock-in. Crossing the trigger slams a gate down at each end
 * of the arena and holds the player inside until the boss is beaten — the
 * classic "there is no way out but through" framing.
 *
 * The gates are real obstacles, not a silent position clamp: they animate
 * down over `SLAM_FRAMES`, the camera is handed to the fight while they fall,
 * and running into one stops you with a thud instead of an invisible wall.
 * Deterministic (frame-counted, no RNG) so it is unit-testable.
 */
export class BossArena {
  /** Frames the gates take to slam shut, and the beat before control returns. */
  static readonly SLAM_FRAMES = 34;
  static readonly LOCK_HOLD = 26;
  static readonly OPEN_FRAMES = 46;
  /** Gate dimensions in pixels. */
  static readonly WIDTH = 20;
  static readonly HEIGHT = 200;

  phase: ArenaPhase = 'open';
  timer = 0;
  readonly leftX: number;
  readonly rightX: number;
  readonly floorY: number;

  constructor(leftX: number, rightX: number, floorY: number) {
    this.leftX = leftX;
    this.rightX = rightX;
    this.floorY = floorY;
  }

  /** 0 = fully raised (open), 1 = fully shut. */
  get closed(): number {
    switch (this.phase) {
      case 'open':
        return 0;
      case 'slamming':
        return Math.min(1, this.timer / BossArena.SLAM_FRAMES);
      case 'locked':
        return 1;
      case 'opening':
        return Math.max(0, 1 - this.timer / BossArena.OPEN_FRAMES);
      case 'cleared':
        return 0;
    }
  }

  /** True while the player should not be given back control (cinematic). */
  get cinematic(): boolean {
    return this.phase === 'slamming' || (this.phase === 'locked' && this.timer < BossArena.LOCK_HOLD);
  }

  /** True while the gates physically block passage. */
  get blocking(): boolean {
    return this.closed > 0.25;
  }

  /** Top edge of a gate for rendering: it descends from above. */
  gateTop(): number {
    return this.floorY - BossArena.HEIGHT * this.closed;
  }

  /** Slam the gates shut. Returns the event to play, or null if already shut. */
  lock(): string | null {
    if (this.phase !== 'open') return null;
    this.phase = 'slamming';
    this.timer = 0;
    return 'gate-slam';
  }

  /** Raise the gates again once the boss is down. */
  release(): string | null {
    if (this.phase !== 'locked') return null;
    this.phase = 'opening';
    this.timer = 0;
    return 'gate-open';
  }

  update(): void {
    this.timer++;
    if (this.phase === 'slamming' && this.timer >= BossArena.SLAM_FRAMES) {
      this.phase = 'locked';
      this.timer = 0;
    } else if (this.phase === 'opening' && this.timer >= BossArena.OPEN_FRAMES) {
      this.phase = 'cleared';
      this.timer = 0;
    }
  }

  /**
   * Keeps the player inside the arena while the gates are down. Returns true
   * when the player was actually stopped by a gate this frame (worth a thud).
   */
  confine(p: Player): boolean {
    if (!this.blocking) return false;
    const half = BossArena.WIDTH / 2;
    const min = this.leftX + half + p.w;
    const max = this.rightX - half - p.w;
    let hit = false;
    if (p.x < min) {
      p.x = min;
      if (p.gsp < 0) p.gsp = 0;
      if (p.xsp < 0) p.xsp = 0;
      hit = true;
    } else if (p.x > max) {
      p.x = max;
      if (p.gsp > 0) p.gsp = 0;
      if (p.xsp > 0) p.xsp = 0;
      hit = true;
    }
    return hit;
  }
}
