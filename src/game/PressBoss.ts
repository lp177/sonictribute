import type { Player } from './Player.ts';
import type { BossLike } from './Boss.ts';
import { playerBox, overlaps, type Rect } from './entities.ts';

export type PressPhase = 'intro' | 'hover' | 'telegraph' | 'slam' | 'open' | 'rise' | 'defeated';

/** Ground shockwave released by a slam; must be jumped (rolling won't help). */
export interface Shockwave {
  x: number;
  dir: 1 | -1;
  age: number;
}

const SHOCK_SPEED = 3.25;
const SHOCK_LIFE = 80;

/**
 * Dr. Yolk's Piston Crusher (Zone 2): hovers tracking the player, telegraphs,
 * slams to the floor releasing two ground shockwaves, then sits vulnerable
 * ("open") before rising again. Armoured everywhere except the open window.
 * Fully deterministic (timer-driven, no RNG) so unit tests are stable.
 */
export class PressBoss implements BossLike {
  readonly kind = 'press' as const;
  readonly title = 'DR. YOLK';
  readonly subtitle = 'PISTON CRUSHER';
  readonly maxHp = 8;
  x: number;
  y: number;
  hp = 8;
  phase: PressPhase = 'intro';
  timer = 0;
  invuln = 0;
  readonly groundY: number;
  readonly homeY: number;
  readonly minX: number;
  readonly maxX: number;
  shockwaves: Shockwave[] = [];

  constructor(x: number, groundY: number, arenaLeft: number, arenaRight: number) {
    this.x = x;
    this.groundY = groundY;
    this.homeY = groundY - 110;
    this.y = this.homeY - 120; // drops in from above
    this.minX = arenaLeft + 48;
    this.maxX = arenaRight - 48;
  }

  get defeated(): boolean {
    return this.phase === 'defeated';
  }

  /** Resting height of the piston body's centre when it sits on the floor. */
  private get slamY(): number {
    return this.groundY - 18;
  }

  get bodyBox(): Rect {
    return { x: this.x - 22, y: this.y - 18, w: 44, h: 36 };
  }

  shockBox(s: Shockwave): Rect {
    return { x: s.x - 6, y: this.groundY - 14, w: 12, h: 14 };
  }

  update(player: Player): string[] {
    const events: string[] = [];
    this.timer++;
    if (this.invuln > 0) this.invuln--;

    for (const s of this.shockwaves) {
      s.x += s.dir * SHOCK_SPEED;
      s.age++;
    }
    this.shockwaves = this.shockwaves.filter((s) => s.age < SHOCK_LIFE);

    switch (this.phase) {
      case 'intro':
        this.y += (this.homeY - this.y) * 0.06;
        if (Math.abs(this.y - this.homeY) < 2) {
          this.phase = 'hover';
          this.timer = 0;
        }
        break;
      case 'hover': {
        // Shadow the player from above, slowly.
        const dx = player.x - this.x;
        this.x += Math.max(-1.4, Math.min(1.4, dx));
        this.x = Math.max(this.minX, Math.min(this.maxX, this.x));
        if (this.timer > 110) {
          this.phase = 'telegraph';
          this.timer = 0;
        }
        break;
      }
      case 'telegraph':
        if (this.timer === 1) events.push('boss-telegraph');
        // Deterministic shudder while winding up.
        this.y = this.homeY + Math.sin(this.timer * 1.3) * 2;
        if (this.timer > 28) {
          this.phase = 'slam';
          this.timer = 0;
        }
        break;
      case 'slam':
        this.y = Math.min(this.slamY, this.y + 9);
        if (this.y >= this.slamY) {
          this.phase = 'open';
          this.timer = 0;
          this.shockwaves.push({ x: this.x - 24, dir: -1, age: 0 }, { x: this.x + 24, dir: 1, age: 0 });
          events.push('boss-slam');
        }
        break;
      case 'open':
        // Vulnerable window: the piston vents on the floor.
        if (this.timer > 90) {
          this.phase = 'rise';
          this.timer = 0;
        }
        break;
      case 'rise':
        this.y = Math.max(this.homeY, this.y - 2.5);
        if (this.y <= this.homeY) {
          this.phase = 'hover';
          this.timer = 0;
        }
        break;
      case 'defeated':
        this.shockwaves = [];
        break;
    }
    return events;
  }

  /**
   * Contact report (damage applied by the Level): shockwaves hurt regardless
   * of ball form — they must be jumped. The pod is armoured except while
   * 'open'; an attacking touch on armour just bounces the player off.
   */
  interact(p: Player): 'hit' | 'hurt' | null {
    if (this.phase === 'intro' || this.phase === 'defeated') return null;
    for (const s of this.shockwaves) {
      if (overlaps(playerBox(p), this.shockBox(s))) return 'hurt';
    }
    if (overlaps(playerBox(p), this.bodyBox)) {
      if (!p.attacking) return 'hurt';
      if (this.phase === 'open' && this.invuln === 0) {
        this.hp--;
        this.invuln = 45;
        this.timer = 0; // hitting it keeps the window open a moment longer
        if (this.hp <= 0) {
          this.phase = 'defeated';
          this.shockwaves = [];
          return 'hit';
        }
        p.bounce();
        return 'hit';
      }
      // Armoured: shrug the attack off.
      if (!p.grounded) p.bounce();
    }
    return null;
  }
}
