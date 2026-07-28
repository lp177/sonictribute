/**
 * Loop layer-switch logic (Sonic 1 style). The level's collision layer 0 has
 * a straight corridor through every loop; layer 1 replaces that corridor with
 * the loop's annulus channel. Crossing a trigger line at either base of the
 * loop flips the active layer: entering from the left switches to layer 1,
 * leaving to the right switches back to layer 0 (and vice versa, so loops can
 * also be traversed backwards).
 */
export interface LoopZone {
  /** Centre of the loop in world pixels. */
  cx: number;
  cy: number;
  innerR: number;
  outerR: number;
}

export function makeLoopZone(cx: number, cy: number, innerR: number, thickness: number): LoopZone {
  return { cx, cy, innerR, outerR: innerR + thickness };
}

/**
 * Computes the collision layer for the next frame given the player's
 * horizontal movement across trigger lines. Pure function — the caller tracks
 * the player's previous x.
 */
export function loopLayerAt(
  layer: number,
  prevX: number,
  x: number,
  y: number,
  loops: LoopZone[],
): number {
  let result = layer;
  for (const loop of loops) {
    // Fail-safe: leaving the loop's neighbourhood always restores layer 0.
    if (Math.abs(x - loop.cx) > loop.outerR + 48 || Math.abs(y - loop.cy) > loop.outerR + 96) {
      continue;
    }
    // Triggers only apply near the channel floor, so climbing the loop's
    // walls never crosses them.
    if (y < loop.cy + loop.innerR - 32 || y > loop.cy + loop.innerR + 24) continue;
    const trigA = loop.cx - loop.innerR * 0.5;
    const trigB = loop.cx + loop.innerR * 0.5;
    if (prevX < trigA && x >= trigA) result = 1; // enter from the left
    else if (prevX > trigA && x <= trigA) result = 0; // back out to the left
    else if (prevX < trigB && x >= trigB) result = 0; // leave to the right
    else if (prevX > trigB && x <= trigB) result = 1; // enter from the right
  }
  return result;
}
