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

  constructor(x: number, y: number, dir: 1 | -1 = 1, power = 12, angle = 56, minSpeed = 3.5) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.power = power;
    this.angle = angle;
    this.minSpeed = minSpeed;
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
    p.grounded = false;
    p.rolling = false;
    p.spindashing = false;
    p.jumping = false; // the arc is the board's, not a cuttable player jump
    p.xsp = Math.cos(rad) * this.power * this.dir;
    p.ysp = -Math.sin(rad) * this.power;
    p.gsp = p.xsp;
    p.facing = this.dir;
    this.cooldown = 22;
    return true;
  }

  update(): void {
    if (this.cooldown > 0) this.cooldown--;
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
