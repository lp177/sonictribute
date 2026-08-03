import type { Player } from './Player.ts';
import type { BossLike } from './Boss.ts';
import { playerBox, overlaps, type Rect } from './entities.ts';

export type ShardPhase = 'intro' | 'burrow' | 'surface' | 'vulnerable' | 'shards' | 'defeated';

/** A crystal splinter on a ballistic arc. Hurts in any form — jump it. */
export interface Shard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
}

/** Sinking out of sight (px/frame) — slow enough to read as "it's leaving". */
const DIG_SPEED = 3.5;
/** Coming back out. Much faster than digging: the eruption is the threat. */
const RISE_SPEED = 6;
/** Underground tracking speed. Beatable on foot, so running is a real answer. */
const BURROW_SPEED = 1.9;
const BURROW_SPEED_RAGE = 2.5;
/** Frames spent shadowing the player underground before it commits to a spot. */
const BURROW_CHASE = 84;
/** Frames of rubble spray over the chosen spot before it bursts out. */
const TELEGRAPH = 26;
/** Frame of the shard phase the second, aimed volley leaves the drill. */
const SHARD_VOLLEY = 34;
/** Length of the shard phase. */
const SHARD_PHASE = 72;
/** Length of the vulnerable window. */
const VULN = 90;
const SHARD_GRAVITY = 0.22;
/** Backstop lifetime; shards normally die on the floor long before this. */
const SHARD_LIFE = 180;
const HIT_IFRAMES = 45;

/**
 * Opening spray: symmetric, so wherever the player stands something is coming.
 * Slow-ish arcs on purpose — the shards are meant to be read and jumped, not
 * reacted to, which is what keeps the fight fair at Chrono Vault speeds.
 */
const FAN_WIDE = [
  { vx: -4.2, vy: -3.9 },
  { vx: -2.4, vy: -5.6 },
  { vx: 0, vy: -6.4 },
  { vx: 2.4, vy: -5.6 },
  { vx: 4.2, vy: -3.9 },
] as const;

/**
 * Follow-up: tighter, and leaned toward whichever side the player retreated
 * to, so dodging the first volley and standing still does not save them.
 */
const FAN_TIGHT = [
  { vx: -3.2, vy: -5.2 },
  { vx: -1.2, vy: -6.2 },
  { vx: 1.2, vy: -6.2 },
  { vx: 3.2, vy: -5.2 },
] as const;

/** How far the aimed volley leans toward the player. */
const AIM_BIAS = 1.1;

/**
 * Dr. Yolk's Shard Drill (Zone 3): a drill rig that burrows through the
 * cavern floor, tracks the player underground as a moving mound of rubble,
 * erupts at a telegraphed spot, sprays crystal shards, then sits exposed —
 * the only window in which it can be hurt. Fully deterministic (timer-driven,
 * no RNG) so unit tests are stable.
 *
 * Unlike the Piston Crusher, the rig is not merely armoured between windows:
 * while it is under the floor there is nothing to touch at all, which turns
 * the burrow phase into free repositioning time instead of a waiting game.
 */
export class CrystalBoss implements BossLike {
  readonly kind = 'shard' as const;
  readonly title = 'DR. YOLK';
  readonly subtitle = 'SHARD DRILL';
  readonly maxHp = 8;
  x: number;
  y: number;
  hp = 8;
  phase: ShardPhase = 'intro';
  timer = 0;
  invuln = 0;
  readonly groundY: number;
  /** Body centre when the rig stands on the cavern floor. */
  readonly surfaceY: number;
  /** Body centre when it is fully under the floor (nothing pokes through). */
  readonly buriedY: number;
  readonly minX: number;
  readonly maxX: number;
  /** Hard arena walls: shards that reach them shatter. */
  readonly arenaLeft: number;
  readonly arenaRight: number;
  shards: Shard[] = [];

  /** Finale fury: faster underground chase, a third volley, briefer window. */
  readonly rage: boolean;

  constructor(x: number, groundY: number, arenaLeft: number, arenaRight: number, rage = false) {
    this.rage = rage;
    this.x = x;
    this.groundY = groundY;
    this.surfaceY = groundY - 22;
    this.buriedY = groundY + 34;
    this.y = this.surfaceY - 132; // drops in from the cavern roof
    this.arenaLeft = arenaLeft;
    this.arenaRight = arenaRight;
    this.minX = arenaLeft + 48;
    this.maxX = arenaRight - 48;
  }

  get defeated(): boolean {
    return this.phase === 'defeated';
  }

  get bodyBox(): Rect {
    return { x: this.x - 24, y: this.y - 22, w: 48, h: 44 };
  }

  /** 0 = fully submerged, 1 = fully out. Drives the rig art and the rubble. */
  get emergence(): number {
    const t = (this.buriedY - this.y) / (this.buriedY - this.surfaceY);
    return Math.max(0, Math.min(1, t));
  }

  /** True while only the mound of rubble shows — nothing to hit. */
  get buried(): boolean {
    return this.phase === 'burrow' && this.y >= this.buriedY - 0.5;
  }

  shardBox(s: Shard): Rect {
    return { x: s.x - 7, y: s.y - 7, w: 14, h: 14 };
  }

  update(player: Player): string[] {
    const events: string[] = [];
    this.timer++;
    if (this.invuln > 0) this.invuln--;

    for (const s of this.shards) {
      s.vy += SHARD_GRAVITY;
      s.x += s.vx;
      s.y += s.vy;
      s.age++;
    }
    // Shards die on the floor, against the arena walls, or of old age, so a
    // volley can never outlive the cycle that fired it.
    this.shards = this.shards.filter(
      (s) => s.age < SHARD_LIFE && s.y < this.groundY + 6 && s.x > this.arenaLeft && s.x < this.arenaRight,
    );

    switch (this.phase) {
      case 'intro':
        this.y += (this.surfaceY - this.y) * 0.06;
        if (Math.abs(this.y - this.surfaceY) < 2) {
          this.y = this.surfaceY;
          this.phase = 'burrow';
          this.timer = 0;
          events.push('boss-dig');
        }
        break;
      case 'burrow':
        if (this.y < this.buriedY) {
          // Still sinking. The phase clock is held at zero until the rig is
          // out of sight, or a hit taken late in the vulnerable window would
          // eat into the chase and the eruption would arrive untelegraphed.
          this.y = Math.min(this.buriedY, this.y + DIG_SPEED);
          this.timer = 0;
          break;
        }
        if (this.timer <= BURROW_CHASE) {
          const dx = player.x - this.x;
          this.x += Math.max(-(this.rage ? BURROW_SPEED_RAGE : BURROW_SPEED), Math.min((this.rage ? BURROW_SPEED_RAGE : BURROW_SPEED), dx));
          this.x = Math.max(this.minX, Math.min(this.maxX, this.x));
        } else if (this.timer === BURROW_CHASE + 1) {
          // Commits to a spot and stops moving: the tell is a stationary
          // rubble spray, so the player can leave before it opens.
          events.push('boss-telegraph');
        }
        if (this.timer > BURROW_CHASE + TELEGRAPH) {
          this.phase = 'surface';
          this.timer = 0;
        }
        break;
      case 'surface':
        if (this.timer === 1) events.push('boss-burst');
        this.y = Math.max(this.surfaceY, this.y - RISE_SPEED);
        if (this.y <= this.surfaceY) {
          this.phase = 'shards';
          this.timer = 0;
        }
        break;
      case 'shards':
        if (this.timer === 1) {
          this.fire(FAN_WIDE, 0);
          events.push('boss-shards');
        } else if (this.timer === SHARD_VOLLEY) {
          this.fire(FAN_TIGHT, Math.sign(player.x - this.x) * AIM_BIAS);
          events.push('boss-shards');
        } else if (this.rage && this.timer === SHARD_VOLLEY * 2) {
          // The rematch adds a third, harder-leaning volley: the safe spot
          // after volley two is exactly where this one goes.
          this.fire(FAN_TIGHT, Math.sign(player.x - this.x) * AIM_BIAS * 1.6);
          events.push('boss-shards');
        }
        if (this.timer > SHARD_PHASE) {
          this.phase = 'vulnerable';
          this.timer = 0;
        }
        break;
      case 'vulnerable':
        // Drill spent and venting: the only window in which it can be hurt
        // (briefer in the rematch).
        if (this.timer > (this.rage ? VULN - 24 : VULN)) {
          this.phase = 'burrow';
          this.timer = 0;
          events.push('boss-dig');
        }
        break;
      case 'defeated':
        this.shards = [];
        break;
    }
    return events;
  }

  /**
   * Contact report (damage applied by the Level): shards hurt regardless of
   * ball form — they must be jumped. The rig itself cannot be touched while
   * it is under the floor, is armoured while erupting and firing, and only
   * takes damage in the vulnerable window.
   */
  interact(p: Player): 'hit' | 'hurt' | null {
    if (this.phase === 'intro' || this.phase === 'defeated') return null;
    for (const s of this.shards) {
      if (overlaps(playerBox(p), this.shardBox(s))) return 'hurt';
    }
    // Burrowed: only rubble shows, so there is no contact in either
    // direction. Gate this on actual DEPTH, not on the phase: the rig spends
    // the first frames of 'burrow' still sticking out of the floor, and
    // gating on the phase made that visible hull intangible — the player
    // could stand inside it.
    if (this.emergence <= 0) return null;
    if (overlaps(playerBox(p), this.bodyBox)) {
      if (!p.attacking) return 'hurt';
      if (this.phase === 'vulnerable' && this.invuln === 0) {
        this.hp--;
        this.invuln = HIT_IFRAMES;
        this.timer = 0; // landing a hit buys time for the next one
        if (this.hp <= 0) {
          this.phase = 'defeated';
          this.shards = [];
          return 'hit';
        }
        p.bounce();
        return 'hit';
      }
      // Armoured hull: shrug the attack off.
      if (!p.grounded) p.bounce();
    }
    return null;
  }

  private fire(fan: readonly { vx: number; vy: number }[], bias: number): void {
    for (const v of fan) {
      this.shards.push({ x: this.x, y: this.y - 20, vx: v.vx + bias, vy: v.vy, age: 0 });
    }
  }
}
