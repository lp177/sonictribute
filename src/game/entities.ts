import { castGround } from '../physics/sensors.ts';
import { PHYS } from '../physics/constants.ts';
import type { TileMap } from '../physics/TileMap.ts';
import type { Player } from './Player.ts';

const T = PHYS.tile;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function playerBox(p: Player): Rect {
  return { x: p.x - p.w, y: p.y - p.h, w: p.w * 2, h: p.h * 2 };
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/* --------------------------------- Rings ---------------------------------- */

export class Ring {
  taken = false;
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  get box(): Rect {
    return { x: this.x - 6, y: this.y - 6, w: 12, h: 12 };
  }
  tryCollect(p: Player): boolean {
    if (this.taken || !overlaps(playerBox(p), this.box)) return false;
    this.taken = true;
    p.rings++;
    return true;
  }
}

/** A ring spilled by damage: bounces, expires, briefly uncollectable. */
export class ScatteredRing {
  collected = false;
  age = 0;
  x: number;
  y: number;
  xsp: number;
  ysp: number;
  constructor(x: number, y: number, xsp: number, ysp: number) {
    this.x = x;
    this.y = y;
    this.xsp = xsp;
    this.ysp = ysp;
  }

  update(map: TileMap, layer: number): void {
    this.age++;
    this.ysp += 0.09375;
    this.x += this.xsp;
    this.y += this.ysp;
    const hit = castGround(map, this.x, this.y + 4, 0, layer);
    if (hit && hit.depth > 0 && this.ysp > 0) {
      this.y -= hit.depth;
      this.ysp *= -0.75;
    }
  }

  get alive(): boolean {
    return this.age < 256;
  }

  tryCollect(p: Player): boolean {
    if (this.collected || this.age < 30) return false;
    if (!overlaps(playerBox(p), { x: this.x - 6, y: this.y - 6, w: 12, h: 12 })) return false;
    this.collected = true;
    p.rings++;
    return true;
  }
}

/* -------------------------------- Springs --------------------------------- */

export type SpringDir = 'up' | 'left' | 'right';

export class Spring {
  cooldown = 0;
  x: number;
  y: number;
  dir: SpringDir;
  power: number;
  constructor(x: number, y: number, dir: SpringDir, power: number) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.power = power;
  }

  get box(): Rect {
    return { x: this.x - 8, y: this.y - 8, w: 16, h: 16 };
  }

  tryTrigger(p: Player): boolean {
    if (this.cooldown > 0 || !overlaps(playerBox(p), this.box)) return false;
    if (this.dir === 'up') {
      if (p.ysp < 0) return false; // must be falling onto it
      p.grounded = false;
      p.ysp = -this.power;
      // Clear `jumping`, or the variable-jump-height cutoff would truncate
      // the launch to PHYS.jrel the moment the jump button is not held —
      // a spring's power is the spring's, not the player's.
      p.jumping = false;
    } else {
      const sign = this.dir === 'right' ? 1 : -1;
      p.gsp = this.power * sign;
      p.xsp = this.power * sign;
      p.facing = sign;
    }
    this.cooldown = 16;
    return true;
  }

  update(): void {
    if (this.cooldown > 0) this.cooldown--;
  }
}

/* -------------------------------- Launcher -------------------------------- */

/**
 * Ramp-end springboard: hit it with speed and it flings you up and forward on
 * a long diagonal arc — the "shot into the sky" moment. Deliberately requires
 * momentum, so it rewards a clean fast approach instead of a standing hop.
 */
export class Launcher {
  cooldown = 0;
  x: number;
  y: number;
  dir: 1 | -1;
  power: number;
  /** Launch angle above the horizon, in degrees. */
  angle: number;
  /** Minimum ground speed in `dir` needed to fire it. */
  minSpeed: number;
  /**
   * When set, entry speed above `power` is CONVERTED into launch speed rather
   * than clamped to it — the quarter pipe's whole point is that the height you
   * get out is the speed you brought in. Off by default so existing launchers
   * keep their fixed, tuned arcs.
   */
  convert: boolean;

  constructor(x: number, y: number, dir: 1 | -1 = 1, power = 12, angle = 56, minSpeed = 3.5, convert = false) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.power = power;
    this.angle = angle;
    this.minSpeed = minSpeed;
    this.convert = convert;
  }

  get box(): Rect {
    return { x: this.x - 12, y: this.y - 14, w: 24, h: 22 };
  }

  /** True while the board is charged and ready (drives the art). */
  get ready(): boolean {
    return this.cooldown === 0;
  }

  tryLaunch(p: Player): boolean {
    if (this.cooldown > 0 || p.dead || !overlaps(playerBox(p), this.box)) return false;
    if (p.gsp * this.dir < this.minSpeed) return false;
    const rad = (this.angle * Math.PI) / 180;
    const v = this.convert ? Math.max(this.power, Math.abs(p.gsp)) : this.power;
    p.grounded = false;
    p.rolling = false;
    p.spindashing = false;
    p.jumping = false; // the arc is the board's, not a cuttable player jump
    p.xsp = Math.cos(rad) * v * this.dir;
    p.ysp = -Math.sin(rad) * v;
    p.gsp = p.xsp;
    p.facing = this.dir;
    this.cooldown = 22;
    return true;
  }

  update(): void {
    if (this.cooldown > 0) this.cooldown--;
  }
}

/* ------------------------------- Grind rail -------------------------------- */

/** Grind rail tuning (game feel, not SPG). */
export const RAIL = {
  /** Speed you are carried at, at minimum, once locked on. */
  min: 9,
  /** How much a downhill rail adds per frame (uphill subtracts). */
  gravity: 0.09,
  /** Ceiling so a long drop-rail cannot fling you absurdly fast. */
  max: 15,
  /** How close the feet must pass to snap on. */
  catch: 14,
} as const;

/**
 * A grind rail: land on it from above and you lock on and ride it, following
 * its slope, until it ends or you jump off. The third zone's signature toy —
 * it turns a gap into a high-speed line rather than an obstacle.
 *
 * Deterministic and purely geometric: the rail is a straight segment and the
 * player's position along it is derived from x, so there is no hidden state
 * to desync.
 */
export class Rail {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;

  constructor(x0: number, y0: number, x1: number, y1: number) {
    // Always stored left-to-right so `yAt` is unambiguous.
    if (x0 <= x1) {
      this.x0 = x0;
      this.y0 = y0;
      this.x1 = x1;
      this.y1 = y1;
    } else {
      this.x0 = x1;
      this.y0 = y1;
      this.x1 = x0;
      this.y1 = y0;
    }
  }

  get slope(): number {
    return (this.y1 - this.y0) / Math.max(1e-6, this.x1 - this.x0);
  }

  /** Rail height at x, or null when x is off the ends. */
  yAt(x: number): number | null {
    if (x < this.x0 || x > this.x1) return null;
    return this.y0 + (x - this.x0) * this.slope;
  }

  /**
   * Try to lock the player on. Only catches feet arriving from above (or
   * already sliding along), never from underneath.
   */
  tryCatch(p: Player): boolean {
    if (p.dead || p.railing) return false;
    if (p.ysp < 0) return false; // rising: pass through
    const y = this.yAt(p.x);
    if (y === null) return false;
    const feet = p.y + p.h;
    if (feet < y - RAIL.catch || feet > y + RAIL.catch) return false;
    p.mountRail(Math.sign(p.xsp || p.gsp || 1) as 1 | -1);
    return true;
  }

  /** Carries a locked-on player one frame. Returns false when the rail ends. */
  carry(p: Player): boolean {
    if (this.yAt(p.x) === null) return false;
    const dir = p.railDir;
    // Screen y grows downward, so `slope * dir > 0` means travelling downhill.
    // Downhill accelerates, uphill bleeds — the slope IS the gameplay.
    const downhill = this.slope * dir > 0;
    const change = RAIL.gravity * Math.abs(this.slope) * (downhill ? 1 : -1);
    const speed = Math.max(RAIL.min, Math.min(RAIL.max, Math.abs(p.gsp) + change));
    p.gsp = speed * dir;
    p.xsp = p.gsp;
    p.ysp = 0;
    p.x += p.xsp;
    const ny = this.yAt(p.x);
    if (ny === null) {
      // Ran off the end: place the rider exactly on the tip before releasing
      // them. Leaving them at last frame's height launches them from inside
      // whatever the rail ended against.
      p.x = dir > 0 ? this.x1 : this.x0;
      p.y = (dir > 0 ? this.y1 : this.y0) - p.h;
      return false;
    }
    p.y = ny - p.h;
    p.grounded = true;
    p.angle = 0;
    return true;
  }
}

/* ------------------------------ Hang glider -------------------------------- */

/** Sky-lane pickup: grants the hang glider until the player takes a real hit. */
export class GliderPickup {
  taken = false;
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  get box(): Rect {
    return { x: this.x - 10, y: this.y - 12, w: 20, h: 24 };
  }
  tryCollect(p: Player): boolean {
    if (this.taken || p.dead || p.hasGlider || !overlaps(playerBox(p), this.box)) return false;
    this.taken = true;
    p.hasGlider = true;
    return true;
  }
}

/* -------------------------------- Wind zone -------------------------------- */

/**
 * A column of rising air. Airborne players inside it are nudged upward;
 * a DEPLOYED glider is carried hard — wind is what turns the glider from a
 * fall-softener into a route. Purely a force field: silent, no contact
 * damage, drawn as streaming motes by the scene.
 */
export class WindZone {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly lift: number;
  constructor(x0: number, y0: number, x1: number, y1: number, lift = 0.35) {
    this.x0 = x0;
    this.y0 = y0;
    this.x1 = x1;
    this.y1 = y1;
    this.lift = lift;
  }
  contains(x: number, y: number): boolean {
    return x >= this.x0 && x <= this.x1 && y >= this.y0 && y <= this.y1;
  }
  apply(p: Player): void {
    if (p.grounded || p.dead || !this.contains(p.x, p.y)) return;
    if (p.gliding) {
      p.ysp = Math.max(p.ysp - this.lift * 2.6, -4.5);
    } else {
      p.ysp = Math.max(p.ysp - this.lift, -2.5);
    }
  }
}

/* -------------------------------- Monitors -------------------------------- */

export type MonitorKind = 'rings10' | 'shield' | 'shoes';

export class Monitor {
  broken = false;
  x: number;
  y: number;
  kind: MonitorKind;
  constructor(x: number, y: number, kind: MonitorKind) {
    this.x = x;
    this.y = y;
    this.kind = kind;
  }

  get box(): Rect {
    return { x: this.x - 12, y: this.y - 12, w: 24, h: 24 };
  }

  /** Only an attacking (ball-form) player breaks monitors. */
  tryBreak(p: Player): MonitorKind | null {
    if (this.broken || !p.attacking || !overlaps(playerBox(p), this.box)) return null;
    this.broken = true;
    if (this.kind === 'rings10') p.rings += 10;
    else if (this.kind === 'shield') p.shield = true;
    else p.shoes = 20 * 60;
    if (!p.grounded) p.bounce();
    return this.kind;
  }
}

/* --------------------------------- Spikes --------------------------------- */

export class Spikes {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  get box(): Rect {
    return { x: this.x - 8, y: this.y - 4, w: 16, h: 8 };
  }
  touches(p: Player): boolean {
    return overlaps(playerBox(p), this.box);
  }
}

/* ------------------------------ Spike trap -------------------------------- */

export type TrapPhase = 'hidden' | 'warning' | 'out' | 'sinking';

/**
 * Pop-up spikes on a fixed cycle. Always telegraphed: the plate rattles for a
 * warning beat before the spikes emerge, and the whole cycle is deterministic
 * so the hazard is learnable and dodgeable rather than a coin flip. Safe to
 * stand on while hidden or sinking.
 */
export class SpikeTrap {
  t: number;
  x: number;
  y: number;
  /** Frames per full cycle; the trap is dangerous for a fraction of it. */
  readonly period: number;
  private readonly warnAt: number;
  private readonly outAt: number;
  private readonly sinkAt: number;

  constructor(x: number, y: number, period = 150, offset = 0) {
    this.x = x;
    this.y = y;
    this.period = period;
    this.t = ((offset % period) + period) % period;
    this.warnAt = period - 46; // rattle
    this.outAt = period - 30; // spikes up
    this.sinkAt = period - 8; // retracting
  }

  get phase(): TrapPhase {
    if (this.t >= this.sinkAt) return 'sinking';
    if (this.t >= this.outAt) return 'out';
    if (this.t >= this.warnAt) return 'warning';
    return 'hidden';
  }

  /** 0 = flush with the floor, 1 = fully extended. */
  get extension(): number {
    const p = this.phase;
    if (p === 'out') return Math.min(1, (this.t - this.outAt) / 6);
    if (p === 'sinking') return Math.max(0, 1 - (this.t - this.sinkAt) / 8);
    return 0;
  }

  get box(): Rect {
    return { x: this.x - 8, y: this.y - 14 * this.extension, w: 16, h: 14 * this.extension };
  }

  /** Returns 'warn' on the frame the tell starts, so it can be heard. */
  update(): 'warn' | 'strike' | null {
    this.t = (this.t + 1) % this.period;
    if (this.t === this.warnAt) return 'warn';
    if (this.t === this.outAt) return 'strike';
    return null;
  }

  touches(p: Player): boolean {
    return this.extension > 0.35 && overlaps(playerBox(p), this.box);
  }
}

/* --------------------------- Crumbling platform ---------------------------- */

/**
 * A ledge that gives way. Standing on it starts a visible shake, then it
 * drops and respawns after a while — the player can see it react and keep
 * moving instead of being punished without warning.
 */
export class CrumblePlatform {
  /** Frames of shaking before it lets go. */
  static readonly SHAKE = 34;
  static readonly RESPAWN = 220;
  x: number;
  y: number;
  readonly w: number;
  state: 'solid' | 'shaking' | 'falling' | 'gone' = 'solid';
  timer = 0;
  fallY = 0;

  constructor(x: number, y: number, w: number) {
    this.x = x;
    this.y = y;
    this.w = w;
  }

  get box(): Rect {
    return { x: this.x, y: this.y, w: this.w, h: 8 };
  }

  /** True while it should carry the player. */
  get solid(): boolean {
    return this.state === 'solid' || this.state === 'shaking';
  }

  /** Visual jitter offset while shaking. */
  get shakeOffset(): number {
    return this.state === 'shaking' ? Math.sin(this.timer * 1.7) * 1.6 : 0;
  }

  /** Returns 'crumble' on the frame it lets go. */
  update(p: Player): 'crumble' | null {
    switch (this.state) {
      case 'solid': {
        // Triggered by feet resting on the plank.
        const feet = p.y + p.h;
        const on = p.grounded && feet >= this.y - 6 && feet <= this.y + 10 && p.x > this.x - 4 && p.x < this.x + this.w + 4;
        if (on) {
          this.state = 'shaking';
          this.timer = 0;
        }
        break;
      }
      case 'shaking':
        this.timer++;
        if (this.timer >= CrumblePlatform.SHAKE) {
          this.state = 'falling';
          this.timer = 0;
          this.fallY = 0;
          return 'crumble';
        }
        break;
      case 'falling':
        this.timer++;
        this.fallY += 0.6 + this.timer * 0.12;
        if (this.timer > 60) {
          this.state = 'gone';
          this.timer = 0;
        }
        break;
      case 'gone':
        this.timer++;
        if (this.timer >= CrumblePlatform.RESPAWN) {
          this.state = 'solid';
          this.timer = 0;
          this.fallY = 0;
        }
        break;
    }
    return null;
  }
}

/* ---------------------------- Swinging spike ball --------------------------- */

/**
 * A spiked wrecking ball on a chain, swinging on a fixed sine. Deterministic
 * and slow enough to read, so timing the run underneath is a skill check the
 * player can actually see coming.
 */
export class SwingBall {
  t = 0;
  readonly pivotX: number;
  readonly pivotY: number;
  readonly length: number;
  readonly period: number;
  readonly arc: number;
  private readonly offset: number;

  constructor(pivotX: number, pivotY: number, length: number, period = 150, offset = 0, arcDeg = 62) {
    this.pivotX = pivotX;
    this.pivotY = pivotY;
    this.length = length;
    this.period = period;
    this.offset = offset;
    this.arc = (arcDeg * Math.PI) / 180;
  }

  get angle(): number {
    return Math.sin(((this.t + this.offset) / this.period) * Math.PI * 2) * this.arc;
  }

  get x(): number {
    return this.pivotX + Math.sin(this.angle) * this.length;
  }

  get y(): number {
    return this.pivotY + Math.cos(this.angle) * this.length;
  }

  get box(): Rect {
    return { x: this.x - 11, y: this.y - 11, w: 22, h: 22 };
  }

  update(): void {
    this.t++;
  }

  /** The ball always hurts — rolling does not save you, you have to time it. */
  touches(p: Player): boolean {
    return overlaps(playerBox(p), this.box);
  }
}

/* ------------------------------- Chrono crystal ---------------------------- */

export class Crystal {
  taken = false;
  x: number;
  y: number;
  id: number;
  constructor(x: number, y: number, id: number) {
    this.x = x;
    this.y = y;
    this.id = id;
  }
  get box(): Rect {
    return { x: this.x - 8, y: this.y - 10, w: 16, h: 20 };
  }
  tryCollect(p: Player): boolean {
    if (this.taken || !overlaps(playerBox(p), this.box)) return false;
    this.taken = true;
    return true;
  }
}

/* -------------------------------- Checkpoints ------------------------------ */

export class Checkpoint {
  active = false;
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  tryActivate(p: Player): boolean {
    if (this.active || p.x < this.x) return false;
    this.active = true;
    return true;
  }
}

/* ------------------------------ SnapCrab enemy ----------------------------- */

/** Simple patrolling badnik: walks back and forth between x0 and x1. */
export class SnapCrab {
  alive = true;
  xsp: number;
  x: number;
  y: number;
  x0: number;
  x1: number;
  constructor(x: number, y: number, x0: number, x1: number) {
    this.x = x;
    this.y = y;
    this.x0 = x0;
    this.x1 = x1;
    this.xsp = 0.5;
  }

  get box(): Rect {
    return { x: this.x - 10, y: this.y - 7, w: 20, h: 14 };
  }

  update(): void {
    if (!this.alive) return;
    this.x += this.xsp;
    if (this.x > this.x1) {
      this.x = this.x1;
      this.xsp = -0.5;
    } else if (this.x < this.x0) {
      this.x = this.x0;
      this.xsp = 0.5;
    }
  }

  /** Returns 'kill' when destroyed by the player, 'hurt' when it hits them. */
  interact(p: Player): 'kill' | 'hurt' | null {
    if (!this.alive || !overlaps(playerBox(p), this.box)) return null;
    if (p.attacking) {
      this.alive = false;
      if (!p.grounded) p.bounce();
      return 'kill';
    }
    return 'hurt';
  }
}

/* -------------------------------- Dash pad --------------------------------- */

/** Floor booster: running over it slams ground speed to `power` in `dir`. */
export class DashPad {
  cooldown = 0;
  x: number;
  y: number;
  dir: 1 | -1;
  power: number;
  constructor(x: number, y: number, dir: 1 | -1, power: number) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.power = power;
  }

  get box(): Rect {
    return { x: this.x - 12, y: this.y - 6, w: 24, h: 12 };
  }

  tryTrigger(p: Player): boolean {
    if (this.cooldown > 0 || !p.grounded || !overlaps(playerBox(p), this.box)) return false;
    if (this.dir === 1) p.gsp = Math.max(p.gsp, this.power);
    else p.gsp = Math.min(p.gsp, -this.power);
    p.facing = this.dir;
    this.cooldown = 12;
    return true;
  }

  update(): void {
    if (this.cooldown > 0) this.cooldown--;
  }
}

/* ---------------------------- Mag-Board mount pad --------------------------- */

/**
 * Vehicle pickup: walking through it puts the player on a Mag-Board. Reusable,
 * so losing the board to a hit lets you walk back and grab another.
 */
export class BoardPad {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  get box(): Rect {
    return { x: this.x - 10, y: this.y - 14, w: 20, h: 28 };
  }

  tryMount(p: Player): boolean {
    if (p.board || p.dead || !overlaps(playerBox(p), this.box)) return false;
    p.mountBoard();
    return true;
  }
}

/* ------------------------------ BuzzDrone enemy ----------------------------- */

/** Flying badnik: hovers in a deterministic figure around its home point. */
export class BuzzDrone {
  alive = true;
  t = 0;
  x: number;
  y: number;
  readonly homeX: number;
  readonly homeY: number;
  readonly rangeX: number;
  constructor(x: number, y: number, rangeX: number) {
    this.x = x;
    this.y = y;
    this.homeX = x;
    this.homeY = y;
    this.rangeX = rangeX;
  }

  /** Horizontal heading for the renderer. */
  get dir(): 1 | -1 {
    return Math.cos(this.t / 50) >= 0 ? 1 : -1;
  }

  get box(): Rect {
    return { x: this.x - 9, y: this.y - 6, w: 18, h: 12 };
  }

  update(): void {
    if (!this.alive) return;
    this.t++;
    this.x = this.homeX + Math.sin(this.t / 50) * this.rangeX;
    this.y = this.homeY + Math.sin(this.t / 21) * 5;
  }

  /** Returns 'kill' when destroyed by the player, 'hurt' when it hits them. */
  interact(p: Player): 'kill' | 'hurt' | null {
    if (!this.alive || !overlaps(playerBox(p), this.box)) return null;
    if (p.attacking) {
      this.alive = false;
      if (!p.grounded) p.bounce();
      return 'kill';
    }
    return 'hurt';
  }
}

/* -------------------------------- Stalactite ------------------------------- */

/**
 * A hanging spike under a ceiling tile. It is armed by the PLAYER: passing
 * beneath it starts a visible tremble (the tell), then it drops, shatters on
 * whatever it lands on and grows back a while later. Only the falling body
 * hurts — the tremble and the floor shards are safe, so the hazard is a
 * "keep moving" prompt rather than an ambush.
 */
export class Stalactite {
  /** Frames of visible trembling between the warn and the drop. */
  static readonly TREMBLE = 30;
  /** Frames a shattered spike stays gone before it regrows. */
  static readonly RESPAWN = 300;
  /** Horizontal half-range (px, ~4 tiles) of "passing beneath". */
  static readonly TRIGGER = 64;
  /** Body length from ceiling anchor to tip. */
  static readonly LEN = 18;

  state: 'hanging' | 'trembling' | 'falling' | 'shattered' = 'hanging';
  timer = 0;
  ysp = 0;
  x: number;
  /** Top of the spike; moves while falling. */
  y: number;
  readonly homeY: number;

  constructor(x: number, ceilingY: number) {
    this.x = x;
    this.y = ceilingY;
    this.homeY = ceilingY;
  }

  get tipY(): number {
    return this.y + Stalactite.LEN;
  }

  get box(): Rect {
    return { x: this.x - 5, y: this.y, w: 10, h: Stalactite.LEN };
  }

  /** Visual jitter while trembling — the readable tell that it will drop. */
  get shakeOffset(): number {
    return this.state === 'trembling' ? Math.sin(this.timer * 1.9) * 1.4 : 0;
  }

  update(map: TileMap, layer: number, p: Player): 'warn' | 'fall' | 'shatter' | null {
    switch (this.state) {
      case 'hanging':
        // Armed by the player passing beneath — never by a level-wide clock,
        // so an idle player far away can never hear one going off.
        if (!p.dead && p.y > this.tipY && Math.abs(p.x - this.x) <= Stalactite.TRIGGER) {
          this.state = 'trembling';
          this.timer = 0;
          return 'warn';
        }
        break;
      case 'trembling':
        if (++this.timer >= Stalactite.TREMBLE) {
          this.state = 'falling';
          this.ysp = 0;
          return 'fall';
        }
        break;
      case 'falling': {
        this.ysp = Math.min(this.ysp + 0.3, PHYS.yspMax);
        this.y += this.ysp;
        const hit = castGround(map, this.x, this.tipY, 0, layer);
        if ((hit && hit.depth > 0) || this.tipY > map.pixelH) {
          if (hit && hit.depth > 0) this.y -= hit.depth;
          this.state = 'shattered';
          this.timer = 0;
          return 'shatter';
        }
        break;
      }
      case 'shattered':
        if (++this.timer >= Stalactite.RESPAWN) {
          this.state = 'hanging';
          this.y = this.homeY;
          this.ysp = 0;
          this.timer = 0;
        }
        break;
    }
    return null;
  }

  /** Only the falling spike is dangerous; trembling and shards are safe. */
  touches(p: Player): boolean {
    return this.state === 'falling' && overlaps(playerBox(p), this.box);
  }
}

/* --------------------------------- Minecart -------------------------------- */

/** Minecart tuning (game feel, not SPG). */
export const CART = {
  /** Horizontal track speed while running (px/frame). */
  speed: 5,
  /** Frames a wreck stays wrecked before a fresh cart waits at the start. */
  respawn: 400,
  /** How high the rider stands above the track line (the tub floor). */
  rideHeight: 8,
} as const;

/**
 * A minecart waiting at the start of its track. Touching it commits the
 * player to the ride: the cart runs the track and CRASHES into the buffer at
 * the far end. Jumping (the only control aboard) is how you leave with your
 * momentum; staying aboard costs one hit — applied by the Level, like every
 * other source of damage.
 */
export class Minecart {
  state: 'waiting' | 'running' | 'crashed' = 'waiting';
  /** True while the player is aboard THIS cart (mirrors p.carting). */
  rider = false;
  timer = 0;
  x: number;
  y: number;
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
  readonly dirX: 1 | -1;

  constructor(x0: number, y0: number, x1: number, y1: number) {
    this.startX = x0;
    this.startY = y0;
    this.endX = x1;
    this.endY = y1;
    this.dirX = x1 >= x0 ? 1 : -1;
    this.x = x0;
    this.y = y0;
  }

  /** Current horizontal velocity — what a bailing rider inherits. */
  get vx(): number {
    return this.state === 'running' ? CART.speed * this.dirX : 0;
  }

  /** Track height at x (linear, like a rail). */
  yAt(x: number): number {
    const t = (x - this.startX) / (this.endX - this.startX);
    return this.startY + (this.endY - this.startY) * t;
  }

  get box(): Rect {
    return { x: this.x - 14, y: this.y - 14, w: 28, h: 16 };
  }

  /** Touching a waiting cart boards it — the ride starts immediately. */
  tryBoard(p: Player): boolean {
    if (this.state !== 'waiting' || p.dead || p.carting || p.board || p.railing) return false;
    if (!overlaps(playerBox(p), this.box)) return false;
    this.state = 'running';
    this.rider = true;
    p.mountCart(this.dirX);
    return true;
  }

  /** Advances the cart one frame; returns 'crash' the frame it hits the buffer. */
  update(): 'crash' | null {
    switch (this.state) {
      case 'running': {
        this.x += CART.speed * this.dirX;
        const past = this.dirX > 0 ? this.x >= this.endX : this.x <= this.endX;
        if (past) {
          // The buffer is a hard stop at a DEFINED point — the crash always
          // happens at exactly the track end, never a frame past it.
          this.x = this.endX;
          this.y = this.endY;
          this.state = 'crashed';
          this.timer = 0;
          return 'crash';
        }
        this.y = this.yAt(this.x);
        break;
      }
      case 'crashed':
        if (++this.timer >= CART.respawn) {
          this.state = 'waiting';
          this.rider = false;
          this.x = this.startX;
          this.y = this.startY;
          this.timer = 0;
        }
        break;
      case 'waiting':
        break;
    }
    return null;
  }

  /** Pins the rider into the tub — the cart, not the player, is what moves. */
  carry(p: Player): void {
    p.x = this.x;
    p.y = this.y - CART.rideHeight - p.h;
    p.xsp = this.vx;
    p.gsp = this.vx;
    p.ysp = 0;
    p.grounded = true;
    p.angle = 0;
    p.facing = this.dirX;
  }
}

/* ------------------------------ Phase platform ------------------------------ */

/**
 * A hard-light one-way platform on a fixed cycle: solid for half its period,
 * off for the rest. It NEVER cuts out silently — the last `WARN` frames of
 * the solid phase blink visibly (and raise one event), and while it is off a
 * faint ghost telegraphs where it will return. Deterministic, so the rhythm
 * is learnable.
 */
export class PhasePlatform {
  /** Frames of visible blink before the light goes out (contract: 20+). */
  static readonly WARN = 24;
  t: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly period: number;

  constructor(x: number, y: number, w: number, period = 180, offset = 0) {
    this.x = x;
    this.y = y;
    this.w = w;
    // A period too short to fit the warning would break the "never vanishes
    // without 20+ frames of visible warning" promise, so clamp it up.
    this.period = Math.max(period, PhasePlatform.WARN * 4);
    this.t = ((offset % this.period) + this.period) % this.period;
  }

  /** Frames of the cycle the light is on. */
  get onFrames(): number {
    return Math.floor(this.period / 2);
  }

  get solid(): boolean {
    return this.t < this.onFrames;
  }

  /** True during the blink — still solid, but visibly about to cut out. */
  get warning(): boolean {
    return this.solid && this.t >= this.onFrames - PhasePlatform.WARN;
  }

  /** 0..1 progress of the off phase — drives the returning-ghost telegraph. */
  get ghost(): number {
    // +1 so the ghost is already faintly there on the very first off frame:
    // the platform must never be simply GONE with no trace of its return.
    return this.solid ? 0 : (this.t - this.onFrames + 1) / (this.period - this.onFrames);
  }

  /** Returns 'blink' on the frame the cut-out warning starts. */
  update(): 'blink' | null {
    this.t = (this.t + 1) % this.period;
    return this.t === this.onFrames - PhasePlatform.WARN ? 'blink' : null;
  }
}

/* --------------------------------- Hopper ---------------------------------- */

/** Hopper tuning: one hop cycle = `sit` coiled frames + `air` arc frames. */
export const HOPPER = {
  sit: 45,
  air: 40,
  /** Horizontal hop distance (px): it bounces between two pads. */
  hop: 48,
  /** Arc apex height (px). */
  height: 44,
} as const;

/**
 * A coiled jumper: sits, then leaps a fixed parabolic arc between two pads,
 * back and forth forever. Its position is a pure function of its clock — no
 * physics, no RNG — so the arc is exactly learnable. Stompable like a crab.
 */
export class Hopper {
  alive = true;
  t = 0;
  x: number;
  y: number;
  readonly x0: number;
  readonly x1: number;
  readonly groundY: number;

  constructor(x: number, groundY: number) {
    this.x0 = x;
    this.x1 = x + HOPPER.hop;
    this.groundY = groundY;
    this.x = x;
    this.y = groundY - 8;
  }

  get period(): number {
    return HOPPER.sit + HOPPER.air;
  }

  /** True while coiled on a pad (renderer squash pose). */
  get coiled(): boolean {
    return this.t % this.period < HOPPER.sit;
  }

  /** Which way the current (or next) hop goes — for the renderer. */
  get dir(): 1 | -1 {
    return Math.floor(this.t / this.period) % 2 === 0 ? 1 : -1;
  }

  update(): void {
    if (!this.alive) return;
    this.t++;
    const n = Math.floor(this.t / this.period);
    const ph = this.t % this.period;
    const from = n % 2 === 0 ? this.x0 : this.x1;
    const to = n % 2 === 0 ? this.x1 : this.x0;
    if (ph < HOPPER.sit) {
      this.x = from;
      this.y = this.groundY - 8;
    } else {
      const u = (ph - HOPPER.sit) / HOPPER.air;
      this.x = from + (to - from) * u;
      this.y = this.groundY - 8 - HOPPER.height * 4 * u * (1 - u);
    }
  }

  get box(): Rect {
    return { x: this.x - 8, y: this.y - 8, w: 16, h: 16 };
  }

  /** Returns 'kill' when destroyed by the player, 'hurt' when it hits them. */
  interact(p: Player): 'kill' | 'hurt' | null {
    if (!this.alive || !overlaps(playerBox(p), this.box)) return null;
    if (p.attacking) {
      this.alive = false;
      if (!p.grounded) p.bounce();
      return 'kill';
    }
    return 'hurt';
  }
}

/* -------------------------------- Goal sign ------------------------------- */

export class GoalSign {
  spinning = 0;
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  tryTrigger(p: Player): boolean {
    if (this.spinning > 0 || p.x < this.x) return false;
    this.spinning = 120;
    p.finished = true;
    return true;
  }
  update(): void {
    if (this.spinning > 0) this.spinning--;
  }
}

/** Convenience for level building: tile centre coordinates. */
export const tileCentre = (t: number) => t * T + T / 2;
