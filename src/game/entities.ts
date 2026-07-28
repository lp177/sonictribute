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
