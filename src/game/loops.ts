/**
 * Loops: layer switching (Sonic 1 style path swappers) plus the speed assist.
 *
 * Collision layer 0 has a straight corridor through every loop; layer 1
 * replaces it with the loop's annulus channel. The player runs the channel on
 * layer 1 and the flat corridor on layer 0.
 *
 * GEOMETRY. The channel floor is flattened to the corridor height over
 * ±`flatHalf` at the loop base, so at the trigger lines both layers have the
 * *same* floor and the swap is invisible. The annulus must also be thick
 * enough to reach the ground all around its lower quarters, or its wall would
 * float above the corridor and headbutt the player — hence
 * `thickness >= innerR * (sqrt(2) - 1)`, checked by a unit test.
 *
 * ENTER / EXIT. Both happen at the same two lines, so a naive trigger pair
 * would swap back one frame after entering. Instead a loop is *armed* once
 * the player actually climbs past its centre height: entering uses the line
 * you run into, exiting uses the line you run out of, and only when armed.
 * That way one full lap always happens, in either direction.
 *
 * FEEL. Loops are a signature toy, not a skill check: entry grants a boost
 * and the channel enforces a floor speed, so a loop entered at any running
 * pace is always completed. A deliberate departure from raw SPG (where a slow
 * entry peels you off the wall).
 */

/** Loop geometry & assist tuning (game feel, NOT Sonic Physics Guide values). */
export const LOOP = {
  /** Default inner radius — the channel the hero rides around. */
  innerR: 64,
  /** Default annulus thickness. Must satisfy >= innerR * (sqrt(2) - 1). */
  thickness: 28,
  /**
   * Half-width of the flattened channel base, and the offset of the two
   * layer-switch lines from the centre. Equal by design: the swap then
   * happens exactly where both layers' floors coincide.
   */
  flatHalf: 16,
  /** Below this ground speed you just run past — no loop, no boost. */
  entryMin: 2,
  /** Speed granted on entry: enough to carry any hero all the way round. */
  boost: 11,
  /** Floor speed enforced inside the channel so gravity can never stall you. */
  sustain: 7,
} as const;

export interface LoopZone {
  /** Centre of the loop in world pixels. */
  cx: number;
  cy: number;
  innerR: number;
  outerR: number;
  /** Offset from `cx` of the two layer-switch lines. */
  trigHalf: number;
}

export function makeLoopZone(cx: number, cy: number, innerR: number, thickness: number): LoopZone {
  return { cx, cy, innerR, outerR: innerR + thickness, trigHalf: LOOP.flatHalf };
}

/** Minimum annulus thickness that keeps the loop's legs planted on the ground. */
export function minThickness(innerR: number): number {
  return innerR * (Math.SQRT2 - 1);
}

export interface LoopCross {
  layer: number;
  /** +1 entered running right, -1 entered running left, 0 = no entry. */
  entered: 0 | 1 | -1;
}

/** True while (x, y) is at the loop's base, where the swap lines live. */
function atBase(loop: LoopZone, x: number, y: number): boolean {
  if (Math.abs(x - loop.cx) > loop.outerR + 48) return false;
  const floorY = loop.cy + loop.innerR;
  return y >= floorY - 32 && y <= floorY + 24;
}

/**
 * Tracks which loop the player is inside and whether they have gone far
 * enough round it to be allowed out the far side. One instance per Level.
 */
export class LoopTracker {
  private loops: LoopZone[];
  /** Index of the loop the player is currently riding, or -1. */
  private inside = -1;
  /** Set once the current lap climbs past the loop's centre height. */
  private armed = false;

  constructor(loops: LoopZone[]) {
    this.loops = loops;
  }

  /** Index of the loop being ridden, or -1 when running the normal ground. */
  get current(): number {
    return this.inside;
  }

  /** Whether the current lap has climbed high enough to be allowed out. */
  get lapArmed(): boolean {
    return this.armed;
  }

  reset(): void {
    this.inside = -1;
    this.armed = false;
  }

  /**
   * Advances the tracker for one frame of player movement and returns the
   * collision layer to use plus any loop entry that just happened. The
   * tracker owns the layer state, so only the loop actually being ridden is
   * ever consulted.
   */
  update(prevX: number, x: number, y: number, gsp: number): LoopCross {
    if (this.inside >= 0) {
      const loop = this.loops[this.inside];
      if (y < loop.cy) this.armed = true;
      const left = loop.cx - loop.trigHalf;
      const right = loop.cx + loop.trigHalf;
      const leavingBase =
        this.armed &&
        atBase(loop, x, y) &&
        ((prevX < right && x >= right) || (prevX > left && x <= left));
      const strayed =
        Math.abs(x - loop.cx) > loop.outerR + 64 || Math.abs(y - loop.cy) > loop.outerR + 96;
      if (leavingBase || strayed) {
        this.reset();
        return { layer: 0, entered: 0 };
      }
      return { layer: 1, entered: 0 };
    }

    // Too slow to commit: run straight through on the flat corridor instead
    // of being yanked onto a wall you cannot climb.
    if (Math.abs(gsp) < LOOP.entryMin) return { layer: 0, entered: 0 };

    for (let i = 0; i < this.loops.length; i++) {
      const loop = this.loops[i];
      if (!atBase(loop, x, y)) continue;
      const left = loop.cx - loop.trigHalf;
      const right = loop.cx + loop.trigHalf;
      // Enter by the line you are running into, heading into the loop.
      if (gsp > 0 && prevX < left && x >= left) {
        this.inside = i;
        this.armed = false;
        return { layer: 1, entered: 1 };
      }
      if (gsp < 0 && prevX > right && x <= right) {
        this.inside = i;
        this.armed = false;
        return { layer: 1, entered: -1 };
      }
    }
    return { layer: 0, entered: 0 };
  }
}

/** The loop whose annulus contains (x, y), if any — used by the speed assist. */
export function loopAt(x: number, y: number, loops: LoopZone[]): LoopZone | null {
  for (const loop of loops) {
    if (Math.hypot(x - loop.cx, y - loop.cy) <= loop.outerR + 24) return loop;
  }
  return null;
}
