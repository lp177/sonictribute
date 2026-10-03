import { PHYS } from '../physics/constants.ts';
import {
  castGround,
  modeForAngle,
  rotate,
  sinDeg,
  cosDeg,
  norm360,
  angleDiff,
  MODE_FLOOR,
  type GroundMode,
} from '../physics/sensors.ts';
import type { TileMap } from '../physics/TileMap.ts';

export interface PlayerInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  /** Jump button currently held. */
  jump: boolean;
  /** Jump button pressed this exact frame (edge trigger). */
  jumpPressed: boolean;
}

export const NO_INPUT: PlayerInput = {
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  jumpPressed: false,
};

const sign = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);

/**
 * Mag-Board vehicle tuning (not SPG values — original mechanic). The board
 * enforces a minimum forward ground speed and absorbs one hit; steering in
 * the air stays free so the player still chooses paths between routes.
 */
export const BOARD = {
  /** Minimum rightward ground speed while riding. */
  min: 7,
  /** Small pop when the ride ends at a dismount line. */
  hop: 3,
} as const;

/**
 * Arcade-feel departures from raw SPG (same spirit as LOOP: this is a quick
 * action game, not a physics exam). Three complaints motivated each value:
 *
 *  - `stepUp`: the wall sensor used to zero gsp for ANY obstacle, however
 *    small. Terrain here is generated from a fixed tile vocabulary (0°, 26.5°,
 *    45°), so joins leave lips a few pixels tall — enough to read as a
 *    perpendicular wall and brake a running or rolling player to a dead stop.
 *    The ground sensors already snap over such lips (`snapRange`), so anything
 *    the feet can climb must not be treated as a wall.
 *  - `plow`: SPG bleeds speed uphill while rolling (`slpRollUp`) no matter how
 *    fast the ball is going. Combined with the lips above, a gentle rise could
 *    stall a full-speed ball. Drag now fades out with speed: full at a crawl,
 *    none at `plow` and beyond, so a ball with momentum ploughs through
 *    gradients. Downhill acceleration is untouched — that part already feels
 *    right.
 *  - `acc`/`top`: raw SPG has NO rolling acceleration, so curling up while slow
 *    left you stuck slow with no way to recover. Holding the direction of
 *    travel now accelerates the ball up to running top speed. Deliberately
 *    gated on input: with no input, friction still wins and the ball uncurls,
 *    which is the only way back to standing.
 */
/**
 * Hang-glider tuning (game feel, not SPG). The glider is a sky-lane tool:
 * collected from a pickup, deployed by HOLDING jump while falling, and it
 * turns descent into travel — slow sink, strong steering, and wind columns
 * carry it upward. Lost when the player takes a real hit.
 */
export const GLIDE = {
  /** Terminal sink rate while deployed (px/frame). */
  sink: 1.1,
  /** Air steering multiplier while deployed. */
  steer: 2.2,
  /** Fastest upward speed wind may impart to a deployed glider. */
  soar: -4.5,
} as const;

/**
 * Hill-climb assist (arcade feel, not SPG). Raw SPG slope drag on a 26.5°
 * ramp is a hair stronger than running acceleration, so a hero who arrives
 * slow — or is knocked to a stop halfway up — cannot walk up a gentle hill at
 * all: he decelerates to nothing and has to go back for a run-up. In a game
 * whose roads are hills that is a dead stop on ordinary ground. While the
 * player pushes UP a gentle slope the drag is capped below the acceleration,
 * fading back to the full SPG value by `speed`: anyone can always climb (at a
 * jog), and a hero with momentum loses exactly what SPG says he should.
 *
 * It covers 45° faces too. They were left out at first ("a run-up, by
 * design"), and every level author then built the same trap three different
 * ways: a hero set down at the foot of a kicker — by a spring, off a ledge,
 * by a hit — could not get over it and had nowhere to back up to. What a 45°
 * face costs a slow hero is the LAUNCH off its lip, not the road.
 */
export const CLIMB = {
  /** Steepest slope assisted, as sin(angle): 0.72 takes in the 45° faces. */
  maxSin: 0.72,
  /** Share of running acceleration the drag is capped to at a standstill. */
  floor: 0.5,
  /** Ground speed at which the cap reaches full acceleration (SPG takes over). */
  speed: 4,
} as const;

/**
 * The kick off the line (arcade feel, not SPG). A flat acceleration is either
 * sluggish from a standstill or so strong that a hill costs nothing at speed.
 * So it is strongest at rest — `1 + kick` times `PHYS.acc` — and fades to the
 * plain value by `until`: a jog in a third of a second, a run in one, and
 * from there up the slopes take their toll exactly as before.
 *
 * It is a kick off LEVEL ground. It fades out with the slope too, gone by
 * `flatSin`: with it, a hero standing at the foot of a kicker left the lip
 * at a run, and every gap in the game was cleared from a standstill — speed
 * must still be brought to a hill, not found on it. The same kick steers a
 * JUMP from rest (a hop onto a ledge beside you); a flight he did not jump
 * into, off a lip or a ledge, gets none.
 */
export const START = { kick: 1.5, until: 4, flatSin: 0.4 } as const;

function startKick(speed: number, sinA = 0): number {
  const slow = Math.max(0, 1 - Math.abs(speed) / START.until);
  const level = Math.max(0, 1 - Math.abs(sinA) / START.flatSin);
  return 1 + START.kick * slow * level;
}

/** Ground speed from which turning against the run is a skid (SPG: 4). */
const SKID_SPEED = 4;

/** Rebound off a stomped enemy, px/frame: never less than a hop, never a rocket. */
export const BOUNCE = { min: 4, max: 9 } as const;

export const ROLL = {
  /** Max lip (px) ridden over instead of stopping dead. */
  stepUp: 8,
  /** Ground speed at/above which uphill slope drag is fully cancelled. */
  plow: 4,
  /** Acceleration while rolling and holding the direction of travel. */
  acc: PHYS.acc,
  /** Ceiling for that acceleration (the speed you would reach running). */
  top: PHYS.top,
} as const;

/**
 * The hero. Movement follows the Sonic Physics Guide: ground speed (gsp) is
 * the master variable while grounded; xsp/ysp are derived from it and the
 * ground angle. Airborne, xsp/ysp are master and gsp is recomputed on landing
 * by projecting the velocity onto the surface tangent.
 */
export class Player {
  x: number;
  y: number;
  xsp = 0;
  ysp = 0;
  gsp = 0;
  /** Degrees, 0 = flat floor, counter-clockwise positive (visual). */
  angle = 0;
  mode: GroundMode = MODE_FLOOR;
  grounded = false;
  rolling = false;
  jumping = false;
  spindashing = false;
  spinRevs = 0;
  facing: 1 | -1 = 1;
  rings = 0;
  invuln = 0;
  /** Shield absorbs one hit without losing rings. */
  shield = false;
  /** Speed shoes timer (frames): raises top speed while active. */
  shoes = 0;
  /** Riding a Mag-Board (level-specific vehicle): fast, forward, one free hit. */
  board = false;
  dead = false;
  finished = false;
  /** Active collision layer (0 = normal, 1 = inside loops). */
  layer = 0;
  /**
   * Squash-and-stretch amount, +1 = fully squashed (just landed hard),
   * -1 = fully stretched (rising fast). Decays every frame; purely cosmetic,
   * read by the renderer.
   */
  squash = 0;
  /** Vertical speed of the last landing — drives impact dust and sound. */
  landImpact = 0;
  /**
   * Standing still and holding up / down. Classic behaviour: the hero looks
   * that way and, after a beat, the camera pans so you can scout the route
   * above or the drop below before committing.
   */
  lookUp = false;
  crouch = false;
  /** Carrying the hang glider (sky-lane pickup; lost on a real hit). */
  hasGlider = false;
  /** Glider currently deployed (held jump while falling). */
  gliding = false;
  /** Locked onto a grind rail (zone 3's vehicle). */
  railing = false;
  /** Which way along the rail the ride is going. */
  railDir: 1 | -1 = 1;
  /** Locked aboard a minecart: the Level drives the cart, jump is the only control. */
  carting = false;
  /** Braking hard against the run (latched, so the skid sounds once). */
  private skidding = false;
  /** Events emitted during the last update (sound/FX hooks). */
  events: string[] = [];

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  /** Body half-height: ball form (rolling/jumping) is shorter. */
  get h(): number {
    return this.ball ? PHYS.heightRadiusRoll : PHYS.heightRadius;
  }
  get w(): number {
    return PHYS.widthRadius;
  }
  get ball(): boolean {
    return this.rolling || this.jumping;
  }
  get attacking(): boolean {
    return this.ball;
  }

  update(map: TileMap, input: PlayerInput): void {
    this.events = [];
    this.landImpact = 0;
    this.lookUp = false;
    this.crouch = false;
    if (this.invuln > 0) this.invuln--;
    if (this.shoes > 0) this.shoes--;
    // Squash relaxes back to neutral; airborne rise stretches the body.
    this.squash *= 0.82;
    if (Math.abs(this.squash) < 0.01) this.squash = 0;
    if (!this.grounded && !this.dead) {
      const stretch = Math.max(-1, Math.min(0, this.ysp / 12));
      if (stretch < this.squash) this.squash = stretch;
    }
    if (this.dead) {
      this.ysp = Math.min(this.ysp + PHYS.grv, PHYS.yspMax);
      this.y += this.ysp;
      return;
    }
    // On a rail the level drives movement; jumping is the only control.
    if (this.railing) {
      if (input.jumpPressed) this.dismountRail(true);
      return;
    }
    // Same deal aboard a minecart: the Level drives the cart and pins the
    // rider to it; the jump button is the one and only way out.
    if (this.carting) {
      if (input.jumpPressed) this.dismountCart(true);
      return;
    }
    if (this.grounded) this.updateGround(map, input);
    else this.updateAir(map, input);
  }

  /* ------------------------------- Grounded -------------------------------- */

  private updateGround(map: TileMap, input: PlayerInput): void {
    const prevY = this.y;

    // --- Spin dash (charging or releasing) ---
    if (this.spindashing) {
      this.spinRevs = Math.max(0, this.spinRevs - PHYS.dashDecay);
      if (input.jumpPressed) {
        this.spinRevs = Math.min(this.spinRevs + PHYS.dashRev, PHYS.dashRevMax);
        this.events.push('dash-rev');
      }
      if (!input.down) {
        this.spindashing = false;
        this.adjustHeight(true);
        this.rolling = true;
        this.gsp = (PHYS.dashBase + this.spinRevs) * this.facing;
        this.events.push('dash');
      }
      this.groundStick(map, prevY);
      return;
    }

    // --- Look up / crouch (only while genuinely stopped) ---
    const stopped = Math.abs(this.gsp) < PHYS.unrollSpeed;
    if (stopped && !this.rolling && !this.spindashing) {
      this.lookUp = input.up;
      this.crouch = input.down;
    }

    // --- Start rolling (not from a board: the board IS the ride) ---
    if (!this.board && !this.rolling && input.down && Math.abs(this.gsp) >= PHYS.unrollSpeed) {
      this.adjustHeight(true);
      this.rolling = true;
      this.events.push('roll');
    }
    // --- Start spin dash ---
    if (!this.board && !this.rolling && input.down && input.jumpPressed && Math.abs(this.gsp) < PHYS.unrollSpeed) {
      this.spindashing = true;
      this.spinRevs = 0;
      this.events.push('dash-charge');
      return;
    }

    // --- Horizontal input & slope physics ---
    if (this.rolling) {
      // No direct control, only braking when pushing against the motion.
      if (input.left && this.gsp > 0) this.gsp = Math.max(0, this.gsp - PHYS.dec);
      else if (input.right && this.gsp < 0) this.gsp = Math.min(0, this.gsp + PHYS.dec);
      this.gsp -= sign(this.gsp) * Math.min(Math.abs(this.gsp), PHYS.rfc);
      // Holding the way you are already rolling builds speed up to running top
      // speed (see ROLL). Gated on input on purpose: with nothing held, friction
      // still wins and the ball uncurls below `unrollSpeed`, which is the only
      // route back to standing.
      const rollDir = sign(this.gsp);
      if (rollDir !== 0 && ((input.right && rollDir > 0) || (input.left && rollDir < 0))) {
        if (Math.abs(this.gsp) < ROLL.top) {
          this.gsp = rollDir * Math.min(ROLL.top, Math.abs(this.gsp) + ROLL.acc);
        }
      }
      const sinA = sinDeg(this.angle);
      const downhill = sign(this.gsp) === -sign(sinA);
      let sf = downhill ? PHYS.slpRollDown : PHYS.slpRollUp;
      if (!downhill) {
        // Uphill drag fades out with speed, so a little gradient can no longer
        // stall a ball that has real momentum. Downhill gain is untouched.
        sf *= 1 - Math.min(1, Math.abs(this.gsp) / ROLL.plow);
      }
      if (Math.abs(this.gsp) > 0.001) this.gsp -= sf * sinA;
      // Out of speed: he gets up — on anything the legs can climb. The limit
      // used to be 0.7, a hair UNDER a 45° face (0.707), while sliding off
      // only starts a hair over it: a ball that came to rest on a kicker was
      // too steep to uncurl and too shallow to slide, and with no control in
      // a roll it froze there for good.
      if (Math.abs(this.gsp) < PHYS.unrollSpeed && Math.abs(sinDeg(this.angle)) <= CLIMB.maxSin) {
        this.adjustHeight(false);
        this.rolling = false;
        this.gsp = 0;
        this.events.push('unroll');
      }
    } else {
      const top = PHYS.top + (this.shoes > 0 ? 2 : 0);
      // SPG: acceleration only applies BELOW top speed. Holding the direction
      // you are already over-speeding in (spin dash, spring, dash pad, loop
      // boost) must never brake you back down to `top`.
      // Heels dug in: pushing against a real run. Once per skid.
      const braking = !this.board && ((input.left && this.gsp >= SKID_SPEED) || (input.right && this.gsp <= -SKID_SPEED));
      if (braking && !this.skidding) this.events.push('skid');
      this.skidding = braking || (this.skidding && ((input.left && this.gsp > 0) || (input.right && this.gsp < 0)));
      const acc = PHYS.acc * startKick(this.gsp, sinDeg(this.angle));
      if (input.left) {
        if (this.gsp > 0) this.gsp -= PHYS.dec;
        else if (this.gsp > -top) this.gsp = Math.max(this.gsp - acc, -top);
        this.facing = -1;
      } else if (input.right) {
        if (this.gsp < 0) this.gsp += PHYS.dec;
        else if (this.gsp < top) this.gsp = Math.min(this.gsp + acc, top);
        this.facing = 1;
      }
      const sinA = sinDeg(this.angle);
      if (Math.abs(this.gsp) > 0.05 || Math.abs(sinA) > 0.719) {
        let drag = PHYS.slp * sinA;
        // Pushing up a gentle hill: never more drag than the legs can beat.
        const uphill = (input.right && drag > 0 && this.gsp >= 0) || (input.left && drag < 0 && this.gsp <= 0);
        if (uphill && Math.abs(sinA) <= CLIMB.maxSin) {
          const cap = PHYS.acc * (CLIMB.floor + (1 - CLIMB.floor) * Math.min(1, Math.abs(this.gsp) / CLIMB.speed));
          drag = sign(drag) * Math.min(Math.abs(drag), cap);
        }
        this.gsp -= drag;
      }
      if (!input.left && !input.right) {
        this.gsp -= sign(this.gsp) * Math.min(Math.abs(this.gsp), PHYS.frc);
      }
    }
    this.gsp = Math.max(-PHYS.gspMax, Math.min(PHYS.gspMax, this.gsp));

    // The Mag-Board drives itself: never slower than BOARD.min, always right.
    if (this.board) {
      this.facing = 1;
      this.gsp = Math.max(this.gsp, BOARD.min);
    }

    // --- Derive xsp/ysp and move ---
    this.xsp = this.gsp * cosDeg(this.angle);
    this.ysp = -this.gsp * sinDeg(this.angle);

    if (this.gsp !== 0) {
      const dir = sign(this.gsp) as 1 | -1;
      const off = rotate(this.mode, dir * (this.w + 1), 0);
      const wallMode = ((this.mode + (dir === 1 ? 1 : 3)) % 4) as GroundMode;
      const wall = castGround(map, this.x + this.xsp + off.x, this.y + off.y, wallMode, this.layer);
      this.x += this.xsp;
      // Only a near-perpendicular obstacle counts as a wall; a steepening
      // curve ahead (e.g. entering a loop) is handled by the ground sensors.
      if (wall && wall.depth > 0 && !wall.oneWay && angleDiff(wall.angle, this.angle) > 60) {
        // ...but a lip only a few pixels tall is a STEP, not a wall. The tile
        // vocabulary (0°/26.5°/45°) leaves such lips at slope joins, and
        // stopping dead on them is what made rolling feel like it kept getting
        // caught on pebbles. groundStick() snaps over anything this small on
        // the very next frame, so ride it instead of zeroing all speed.
        const footOff = rotate(this.mode, dir * this.w, this.h);
        const ahead = castGround(map, this.x + footOff.x, this.y + footOff.y, this.mode, this.layer);
        const climbable = !!ahead && ahead.depth > 0 && ahead.depth <= ROLL.stepUp;
        if (!climbable) {
          this.clipAlong(wallMode, wall.depth);
          this.gsp = 0;
          this.xsp = 0;
          this.ysp = 0;
        }
      }
    }
    this.y += this.ysp;

    this.groundStick(map, prevY);

    // --- Jump (always possible from the ground, rolling or not) ---
    if (this.grounded && input.jumpPressed) {
      const a = this.angle;
      this.xsp -= PHYS.jmp * sinDeg(a);
      this.ysp -= PHYS.jmp * cosDeg(a);
      this.grounded = false;
      this.adjustHeight(true);
      this.jumping = true;
      this.events.push('jump');
    }
  }

  /** Reposition onto the ground surface, or detach when walking off an edge. */
  private groundStick(map: TileMap, prevY: number): void {
    const offA = rotate(this.mode, -this.w, this.h);
    const offB = rotate(this.mode, this.w, this.h);
    const hitA = castGround(map, this.x + offA.x, this.y + offA.y, this.mode, this.layer);
    const hitB = castGround(map, this.x + offB.x, this.y + offB.y, this.mode, this.layer);
    const hit = !hitA ? hitB : !hitB ? hitA : hitA.depth >= hitB.depth ? hitA : hitB;

    if (!hit || hit.depth < -PHYS.snapRange) {
      this.grounded = false; // walked off an edge
      return;
    }
    if (hit.oneWay && this.mode === MODE_FLOOR && prevY + this.h > hit.surface + 1) {
      this.grounded = false; // came from below a one-way platform
      return;
    }

    const groundDir = rotate(this.mode, 0, 1);
    this.x -= groundDir.x * hit.depth;
    this.y -= groundDir.y * hit.depth;

    // Angle from the two contact points (18px baseline) when both sensors
    // are on the same surface — much smoother than per-column tile slopes
    // on curves. Falls back to the tile angle at edges/steps.
    let angle = hit.angle;
    if (hitA && hitB && Math.abs(hitA.depth - hitB.depth) <= 8) {
      const ax = this.x + offA.x;
      const ay = this.y + offA.y;
      const bx = this.x + offB.x;
      const by = this.y + offB.y;
      const pa = this.mode === MODE_FLOOR || this.mode === 2 ? { x: ax, y: hitA.surface } : { x: hitA.surface, y: ay };
      const pb = this.mode === MODE_FLOOR || this.mode === 2 ? { x: bx, y: hitB.surface } : { x: hitB.surface, y: by };
      angle = norm360((Math.atan2(-(pb.y - pa.y), pb.x - pa.x) * 180) / Math.PI);
    }
    this.angle = angle;
    this.mode = modeForAngle(angle);

    // Slide off steep ground when too slow (SPG fall-off threshold, angle
    // strictly steeper than 45° so a 45° slope doesn't trap us in a
    // land/slide-off oscillation).
    const steep = this.angle > 45.5 && this.angle < 314.5;
    if (steep && Math.abs(this.gsp) < PHYS.fallSpeed) {
      this.grounded = false;
      this.events.push('slide-off');
    }
  }

  private clipAlong(wallMode: GroundMode, depth: number): void {
    const n = rotate(wallMode, 0, -1); // surface normal pointing out of the wall
    this.x += n.x * depth;
    this.y += n.y * depth;
  }

  /* ------------------------------- Airborne -------------------------------- */

  private updateAir(map: TileMap, input: PlayerInput): void {
    const prevY = this.y;

    // --- Hang glider: HOLD jump while falling to deploy, release to fold ---
    if (this.hasGlider) {
      // Falling with jump held — from a ledge, a spring, or the top of his
      // own jump. (It used to refuse after a jump, so the one natural way to
      // open the wing, jump and keep holding, did nothing.)
      if (!this.gliding && input.jump && this.ysp > 0) {
        this.gliding = true;
        // Under the wing he hangs upright, not curled.
        this.adjustHeight(false);
        this.rolling = false;
        this.jumping = false;
        this.events.push('glide');
      } else if (this.gliding && !input.jump) {
        this.gliding = false;
      }
    } else {
      this.gliding = false;
    }

    // Air steering accelerates only BELOW top speed — the same rule as on the
    // ground. Clamping to `top` (the Sonic 1 air cap) cut any flight faster
    // than a run down to running speed the instant the player held forward:
    // every kicker, rail and spring launch lost a third of its distance for
    // doing the natural thing. Steering against the motion always brakes.
    // Against the flight it brakes twice as hard as it pushes (`airTurn`):
    // checking a jump, or changing your mind in one, is the control a player
    // misses most. Under the wing the glider's own steering applies both ways.
    const steer = this.gliding ? PHYS.air * GLIDE.steer : PHYS.air * (this.jumping ? startKick(this.xsp) : 1);
    const turn = this.gliding ? steer : PHYS.airTurn;
    if (input.left) {
      if (this.xsp > 0) this.xsp -= Math.min(turn, this.xsp + steer);
      else if (this.xsp > -PHYS.top) this.xsp = Math.max(this.xsp - steer, -PHYS.top);
      this.facing = -1;
    } else if (input.right) {
      if (this.xsp < 0) this.xsp += Math.min(turn, steer - this.xsp);
      else if (this.xsp < PHYS.top) this.xsp = Math.min(this.xsp + steer, PHYS.top);
      this.facing = 1;
    }
    if (this.jumping && !input.jump && this.ysp < -PHYS.jrel) this.ysp = -PHYS.jrel;
    if (this.gliding) {
      // The wing carries the fall: gravity still pulls, but sink is capped
      // low and wind (applied by the Level) may push the whole thing upward.
      this.ysp = Math.min(this.ysp + PHYS.grv * 0.3, GLIDE.sink);
      this.ysp = Math.max(this.ysp, GLIDE.soar);
    } else {
      this.ysp = Math.min(this.ysp + PHYS.grv, PHYS.yspMax);
    }

    // Horizontal move + wall clip (only genuinely wall-facing surfaces).
    if (this.xsp !== 0) {
      const dir = sign(this.xsp) as 1 | -1;
      const wallMode: GroundMode = dir === 1 ? 1 : 3;
      const wall = castGround(map, this.x + this.xsp + dir * (this.w + 1), this.y, wallMode, this.layer);
      const wallish =
        wall && (dir === 1 ? wall.angle > 45 && wall.angle < 135 : wall.angle > 225 && wall.angle < 315);
      this.x += this.xsp;
      if (wall && wall.depth > 0 && !wall.oneWay && wallish) {
        this.clipAlong(wallMode, wall.depth);
        this.xsp = 0;
      }
    }

    // Vertical move.
    this.y += this.ysp;

    if (this.ysp < 0) {
      const hL = castGround(map, this.x - this.w, this.y - this.h, 2, this.layer);
      const hR = castGround(map, this.x + this.w, this.y - this.h, 2, this.layer);
      const hit = !hL ? hR : !hR ? hL : hL.depth >= hR.depth ? hL : hR;
      if (hit && hit.depth > 0 && !hit.oneWay) {
        this.y += hit.depth;
        this.ysp = 0;
      }
    } else {
      const fL = castGround(map, this.x - this.w, this.y + this.h, 0, this.layer);
      const fR = castGround(map, this.x + this.w, this.y + this.h, 0, this.layer);
      const hit = !fL ? fR : !fR ? fL : fL.depth >= fR.depth ? fL : fR;
      if (hit && hit.depth >= -8) {
        if (hit.oneWay && prevY + this.h > hit.surface + 1) return;
        this.land(hit.angle, hit.depth);
      }
    }
  }

  private land(angle: number, depth: number): void {
    const a = norm360(angle);
    this.gliding = false; // the wing folds the moment feet touch ground
    this.landImpact = Math.max(0, this.ysp);
    // Hard landings squash the body and are worth extra dust/sound.
    this.squash = Math.min(1, this.landImpact / 10);
    this.y -= depth; // airborne body is always upright (floor mode)
    this.grounded = true;
    this.angle = a;
    this.mode = modeForAngle(a);
    // Project velocity onto the surface tangent t = (cos a, -sin a).
    this.gsp = this.xsp * cosDeg(a) - this.ysp * sinDeg(a);
    this.ysp = 0;
    // A ball stays a ball. The ground is hills and lips, so a rolling hero
    // leaves it for a frame or two all the time; standing him up on every
    // touchdown (tried, as "the classic way") uncurled a player who was
    // holding the roll a dozen times an act, at full speed — the rhythm of
    // the whole game broken on every bump. The roll ends when it runs out of
    // speed, or when the player wants it to.
    this.adjustHeight(this.rolling);
    this.jumping = false;
    this.events.push(this.landImpact > 7 ? 'land-hard' : 'land');
  }

  /* ------------------------------ Combat etc. ------------------------------ */

  /** Returns rings lost (0 when the hit was absorbed by board/shield/invulnerability). */
  hurt(fromX: number): number {
    if (this.invuln > 0 || this.dead) return 0;
    if (this.board) {
      // The board takes the hit and is destroyed; rings and shield survive.
      this.board = false;
      this.invuln = 120;
      this.adjustHeight(false);
      this.grounded = false;
      this.rolling = false;
      this.jumping = false;
      this.spindashing = false;
      this.carting = false;
      this.xsp = this.x < fromX ? -2 : 2;
      this.ysp = -4;
      this.events.push('board-lost');
      return 0;
    }
    if (this.shield) {
      this.shield = false;
      this.invuln = 120;
      this.adjustHeight(false);
      this.grounded = false;
      this.rolling = false;
      this.jumping = false;
      this.spindashing = false;
      this.carting = false;
      this.xsp = this.x < fromX ? -2 : 2;
      this.ysp = -4;
      this.events.push('shield-lost');
      return 0;
    }
    if (this.rings === 0) {
      this.die();
      return 0;
    }
    const lost = this.rings;
    this.rings = 0;
    if (this.hasGlider) {
      this.hasGlider = false;
      this.gliding = false;
      this.events.push('glider-lost');
    }
    this.invuln = 120;
    this.adjustHeight(false);
    this.grounded = false;
    this.rolling = false;
    this.jumping = false;
    this.spindashing = false;
    // Knockback needs normal air physics, so any ride lock is broken here —
    // the Level notices `!p.carting` and lets the cart run on riderless.
    this.carting = false;
    this.xsp = this.x < fromX ? -2 : 2;
    this.ysp = -4;
    this.events.push('hurt');
    return lost;
  }

  die(): void {
    if (this.dead) return;
    this.dead = true;
    this.carting = false;
    this.xsp = 0;
    this.ysp = -7;
    this.events.push('die');
  }

  /**
   * Bounce after stomping something (enemy/boss from above). As in the
   * classics the rebound is the fall reversed: land on a badnik from a height
   * and you spring back up to it, which is what turns a row of them into a
   * bridge. It is a jump, so it is yours to keep — hold the button for the
   * full rebound, let go and it is cut to the usual small hop.
   */
  bounce(): void {
    this.grounded = false;
    this.ysp = -Math.max(BOUNCE.min, Math.min(BOUNCE.max, Math.abs(this.ysp)));
    this.adjustHeight(true);
    this.jumping = true;
  }

  /** Lock onto a grind rail. */
  mountRail(dir: 1 | -1): void {
    if (this.dead) return;
    this.railing = true;
    this.railDir = dir;
    this.facing = dir;
    this.ysp = 0;
    this.jumping = false;
    this.spindashing = false;
    if (this.rolling) {
      this.adjustHeight(false);
      this.rolling = false;
    }
    this.events.push('rail-on');
  }

  /** Leave the rail — at the end of it, or by jumping. */
  dismountRail(jump = false): void {
    if (!this.railing) return;
    this.railing = false;
    this.grounded = false;
    this.xsp = this.gsp;
    if (jump) {
      this.ysp = -PHYS.jmp;
      this.jumping = true;
      this.events.push('jump');
    }
  }

  /** Board a minecart: locked aboard, the Level drives from here. */
  mountCart(dir: 1 | -1): void {
    if (this.carting || this.dead) return;
    if (this.rolling && !this.jumping) this.adjustHeight(false); // uncurl into the tub
    this.carting = true;
    this.rolling = false;
    this.jumping = false;
    this.spindashing = false;
    this.facing = dir;
    this.ysp = 0;
  }

  /** Leave the cart — by jumping out, or set down by the Level at the crash. */
  dismountCart(jump = false): void {
    if (!this.carting) return;
    this.carting = false;
    this.grounded = false;
    // Momentum is kept: the cart's speed (written into gsp while carried)
    // becomes the rider's launch speed.
    this.xsp = this.gsp;
    if (jump) {
      this.ysp = -PHYS.jmp;
      this.jumping = true;
      this.events.push('jump');
    }
  }

  /** Step onto a Mag-Board (no-op if already riding). */
  mountBoard(): void {
    if (this.board || this.dead) return;
    if (this.rolling && !this.jumping) this.adjustHeight(false); // uncurl onto the deck
    this.board = true;
    this.rolling = false;
    this.spindashing = false;
  }

  /** End of the ride (dismount line): small hop off the board. */
  dismountBoard(): void {
    if (!this.board) return;
    this.board = false;
    if (this.grounded) {
      this.grounded = false;
      this.ysp = -BOARD.hop;
      this.jumping = false;
    }
  }

  respawn(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.xsp = this.ysp = this.gsp = 0;
    this.angle = 0;
    this.mode = MODE_FLOOR;
    this.grounded = false;
    this.rolling = this.jumping = this.spindashing = false;
    this.board = false;
    this.railing = false;
    this.carting = false;
    this.hasGlider = false;
    this.gliding = false;
    this.layer = 0;
    this.dead = false;
    this.invuln = 60;
    this.rings = 0;
  }

  /** Keep the feet planted when the body switches between standing and ball. */
  private adjustHeight(toBall: boolean): void {
    if (this.ball === toBall) return;
    this.y += toBall
      ? PHYS.heightRadius - PHYS.heightRadiusRoll
      : -(PHYS.heightRadius - PHYS.heightRadiusRoll);
  }
}
