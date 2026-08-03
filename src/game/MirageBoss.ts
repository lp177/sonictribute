import type { Player } from './Player.ts';
import type { BossLike } from './Boss.ts';
import { playerBox, overlaps, type Rect } from './entities.ts';

export type MiragePhase = 'intro' | 'pace' | 'trace' | 'derez' | 'defeated';

/** A hard-light line frozen along the trace path. Stationary once laid. */
export interface Afterimage {
  x: number;
  y: number;
  age: number;
}

/** Cruise speed while pacing — player-ish, so the pass is always jumpable. */
const PACE_SPEED = 3.4;
/** Working back up to cruise out of a standstill (post-derez, post-intro). */
const PACE_ACCEL = 0.1;
/** Frame of 'pace' at which it plants and shimmers — the pre-trace tell. */
const PACE_TELL = 240;
/** End of 'pace'; the tell therefore lasts PACE_LEN - PACE_TELL frames. */
const PACE_LEN = 276;
/** Braking into the tell. From cruise it is stood still with frames to spare. */
const BRAKE = 0.15;
const TRACE_ACCEL = 0.12;
/** Trace top speed sits above the hero's cruise: outrunning it is not the answer. */
const TRACE_TOP = 7;
const TRACE_LEN = 210;
/**
 * One image every N frames of trace. Paired with the top speed this spaces the
 * lines ~45-63px apart — wide enough for a hero (~20px) to thread, tight
 * enough that standing still is never safe.
 */
const AFTER_EVERY = 9;
/** No images below this speed: the launch point gets one clean line, not a pile. */
const LAY_MIN_SPEED = 2;
/** Frames an image persists. Exported so the painter can fade by age. */
export const AFTERIMAGE_LIFE = 240;
/**
 * Frames before a fresh image becomes a hazard. Exported for the painter (draw
 * it solidifying). The grace keeps a hero running close behind the pacer from
 * being clipped by a line that materialises inside them.
 */
export const AFTERIMAGE_ARM = 6;
/** Age multiplier while derezzed: the flush opens an approach path to the boss. */
const DEREZ_FADE = 4;
/** Length of the vulnerable window. */
const DEREZ_LEN = 110;
const HIT_IFRAMES = 45;
/** Glitch meter slew rates (per frame, toward 1 in derez / toward 0 outside). */
const DEREZ_IN = 1 / 14;
const DEREZ_OUT = 1 / 20;

/**
 * Dr. Yolk's Mirage Pacer (Noon Tomorrow): a hard-light sprinter that races
 * the arena floor. It paces at a jumpable player-ish speed, plants and
 * shimmers, then TRACES — accelerating hard and freezing afterimages along
 * its path that persist as stationary hazards until the arena is striped with
 * light. The sprint overheats it into 'derez': stationary, glitching, and the
 * only window in which it can be hurt, while its afterimages burn away fast
 * enough to open a path to it. Fully deterministic (timer-driven, no RNG) so
 * unit tests are stable.
 *
 * Unlike the other three bosses it never leaves the ground and never aims at
 * the player: the whole fight is a rhythm read — jump the passes, weave the
 * lines, close in when it stalls.
 */
export class MirageBoss implements BossLike {
  readonly kind = 'mirage' as const;
  readonly title = 'DR. YOLK';
  readonly subtitle = 'MIRAGE PACER';
  readonly maxHp = 8;
  x: number;
  y: number;
  hp = 8;
  phase: MiragePhase = 'intro';
  timer = 0;
  invuln = 0;
  /** Which way it is running; the painter mirrors the sprite off this. */
  facing: 1 | -1 = -1;
  /** Current ground speed, px/frame (always >= 0; direction is `facing`). */
  speed = 0;
  readonly groundY: number;
  /** Body centre while running on the arena floor. */
  readonly standY: number;
  readonly minX: number;
  readonly maxX: number;
  afterimages: Afterimage[] = [];
  /**
   * Run-cycle clock: DISTANCE covered, not frames. Anything drawn from
   * `timer` snaps when a phase change (or a window-extending hit) resets it —
   * the same lesson as the Wrecking Pod's mace — and a frame clock would pump
   * the legs of a boss that is stood still. Distance can do neither.
   */
  runT = 0;
  /**
   * Glitch meter backing `derez01`. A dedicated accumulator, NOT derived from
   * `timer`: landing a hit resets the phase timer to extend the window, and a
   * glitch intensity that snapped back with it would read as the window
   * closing right when the player is being rewarded.
   */
  private derezLevel = 0;

  /** Finale fury: hotter trace, denser light-wall, briefer derez. */
  readonly rage: boolean;

  constructor(x: number, groundY: number, arenaLeft: number, arenaRight: number, rage = false) {
    this.rage = rage;
    this.x = x;
    this.groundY = groundY;
    this.standY = groundY - 18;
    this.y = this.standY - 140; // resolves out of the glare overhead
    this.minX = arenaLeft + 48;
    this.maxX = arenaRight - 48;
  }

  get defeated(): boolean {
    return this.phase === 'defeated';
  }

  /** 0..1 glitch intensity for the painter (static, tearing, palette splits). */
  get derez01(): number {
    return this.derezLevel;
  }

  get bodyBox(): Rect {
    return { x: this.x - 20, y: this.y - 18, w: 40, h: 36 };
  }

  /** Slimmer than the body so the gaps between laid lines stay threadable. */
  afterimageBox(a: Afterimage): Rect {
    return { x: a.x - 12, y: a.y - 16, w: 24, h: 32 };
  }

  update(_player: Player): string[] {
    const events: string[] = [];
    this.timer++;
    if (this.invuln > 0) this.invuln--;
    this.derezLevel =
      this.phase === 'derez'
        ? Math.min(1, this.derezLevel + DEREZ_IN)
        : Math.max(0, this.derezLevel - DEREZ_OUT);
    this.runT += this.speed;

    // Images cool on their own clocks; the derez flush only burns them faster.
    const fade = this.phase === 'derez' ? DEREZ_FADE : 1;
    for (const a of this.afterimages) a.age += fade;
    this.afterimages = this.afterimages.filter((a) => a.age < AFTERIMAGE_LIFE);

    switch (this.phase) {
      case 'intro':
        this.y += (this.standY - this.y) * 0.06;
        if (Math.abs(this.y - this.standY) < 2) {
          this.y = this.standY;
          this.phase = 'pace';
          this.timer = 0;
        }
        break;
      case 'pace':
        if (this.timer === PACE_TELL) events.push('boss-telegraph');
        // Cruise until the tell, then brake and stand shimmering: the burst
        // that follows always launches from a readable standstill.
        if (this.timer < PACE_TELL) this.speed = Math.min(PACE_SPEED, this.speed + PACE_ACCEL);
        else this.speed = Math.max(0, this.speed - BRAKE);
        this.move();
        if (this.timer > PACE_LEN) {
          this.phase = 'trace';
          this.timer = 0;
          events.push('boss-trace');
        }
        break;
      case 'trace':
        this.speed = Math.min(this.rage ? TRACE_TOP + 1.5 : TRACE_TOP, this.speed + TRACE_ACCEL);
        this.move();
        if (this.timer % AFTER_EVERY === 0 && this.speed >= LAY_MIN_SPEED) {
          this.afterimages.push({ x: this.x, y: this.y, age: 0 });
        }
        if (this.timer > TRACE_LEN) {
          this.phase = 'derez';
          this.timer = 0;
          this.speed = 0;
          events.push('boss-derez');
        }
        break;
      case 'derez':
        // Overheated and glitching: stationary, and the only damage window.
        if (this.timer > (this.rage ? DEREZ_LEN - 30 : DEREZ_LEN)) {
          this.phase = 'pace';
          this.timer = 0;
          events.push('boss-rez');
        }
        break;
      case 'defeated':
        this.afterimages = [];
        break;
    }
    return events;
  }

  /** Advance along the floor, turning at the arena walls. Never leaves them. */
  private move(): void {
    this.x += this.speed * this.facing;
    if (this.x <= this.minX) {
      this.x = this.minX;
      this.facing = 1;
    } else if (this.x >= this.maxX) {
      this.x = this.maxX;
      this.facing = -1;
    }
  }

  /**
   * Contact report (damage applied by the Level — single damage path).
   * Afterimages are checked BEFORE the body so rolling into the pacer through
   * one of its own lines costs the player rather than handing them a free
   * hit, and they hurt in ANY form: hard light must be jumped, not rolled.
   */
  interact(p: Player): 'hit' | 'hurt' | null {
    if (this.phase === 'intro' || this.phase === 'defeated') return null;
    for (const a of this.afterimages) {
      if (a.age >= AFTERIMAGE_ARM && a.age < AFTERIMAGE_LIFE && overlaps(playerBox(p), this.afterimageBox(a))) {
        return 'hurt';
      }
    }
    if (!overlaps(playerBox(p), this.bodyBox)) return null;
    if (this.phase === 'derez') {
      if (p.attacking) {
        if (this.invuln === 0) {
          this.hp--;
          this.invuln = HIT_IFRAMES;
          this.timer = 0; // landing a hit keeps it derezzed a moment longer
          if (this.hp <= 0) {
            this.phase = 'defeated';
            this.afterimages = [];
            return 'hit';
          }
          p.bounce();
          return 'hit';
        }
        // i-frames: still solid, so the player cannot sink into the glitch.
        if (!p.grounded) p.bounce();
        return null;
      }
      return 'hurt';
    }
    // Mid-sprint the shell sheds a stomp harmlessly — landing on it is a
    // mistimed jump, not a death sentence — but a grounded roll is burned
    // through: if rolling beat the pacer there would be no race at all.
    if (p.attacking && !p.grounded) {
      p.bounce();
      return null;
    }
    return 'hurt';
  }
}
