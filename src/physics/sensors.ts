import { PHYS } from './constants.ts';
import type { TileMap } from './TileMap.ts';

const T = PHYS.tile;
const SNAP = PHYS.snapRange;

export const MODE_FLOOR = 0;
export const MODE_RIGHT = 1; // running up a wall on the right (ground to the east)
export const MODE_CEILING = 2;
export const MODE_LEFT = 3; // running down a wall on the left (ground to the west)
export type GroundMode = 0 | 1 | 2 | 3;

export interface SensorHit {
  /** Penetration depth: > 0 means the sensor is inside the ground. */
  depth: number;
  /** Surface angle in degrees, 0 = flat floor, counter-clockwise positive. */
  angle: number;
  /** World coordinate of the surface along the cast axis. */
  surface: number;
  /** Whether the tile found is a one-way platform. */
  oneWay: boolean;
}

const deg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Casts a ground sensor placed at world point (px, py) in the direction given
 * by `mode` (mode 0 casts down, 1 casts +x, 2 casts up, 3 casts -x), against
 * the given collision layer. Returns null when no surface is within snap
 * range above the sensor.
 */
export function castGround(map: TileMap, px: number, py: number, mode: GroundMode, layer = 0): SensorHit | null {
  switch (mode) {
    case MODE_FLOOR:
      return castDown(map, px, py, layer);
    case MODE_RIGHT:
      return castEast(map, px, py, layer);
    case MODE_CEILING:
      return castUp(map, px, py, layer);
    case MODE_LEFT:
      return castWest(map, px, py, layer);
  }
}

function castDown(map: TileMap, px: number, py: number, layer: number): SensorHit | null {
  const tx = Math.floor(px / T);
  const ty = Math.floor(py / T);
  const c = Math.min(T - 1, Math.max(0, Math.floor(px - tx * T)));
  const tile = map.get(tx, ty, layer);
  const h = tile.heights[c];

  let surface: number;
  let angle: number;
  let oneWay = tile.oneWay;
  if (h === 0) {
    // Empty column: the ground may be in the tile below.
    const below = map.get(tx, ty + 1, layer);
    const h2 = below.heights[c];
    if (h2 === 0) return null;
    surface = (ty + 2) * T - h2;
    angle = slopeAngle(map, tx, ty + 1, c, 'heights', layer);
    oneWay = below.oneWay;
  } else if (h === T) {
    // Full column: the surface may continue in the tile above.
    const above = map.get(tx, ty - 1, layer);
    const h2 = above.heights[c];
    surface = ty * T - h2;
    angle = h2 > 0 ? slopeAngle(map, tx, ty - 1, c, 'heights', layer) : slopeAngle(map, tx, ty, c, 'heights', layer);
    if (h2 > 0) oneWay = above.oneWay;
  } else {
    surface = (ty + 1) * T - h;
    angle = slopeAngle(map, tx, ty, c, 'heights', layer);
  }
  const depth = py - surface;
  if (depth < -SNAP) return null;
  return { depth, angle, surface, oneWay };
}

function castUp(map: TileMap, px: number, py: number, layer: number): SensorHit | null {
  const tx = Math.floor(px / T);
  const ty = Math.floor(py / T);
  const c = Math.min(T - 1, Math.max(0, Math.floor(px - tx * T)));
  const tile = map.get(tx, ty, layer);
  const h = tile.heightsTop[c];

  let surface: number;
  let angle: number;
  if (h === 0) {
    const above = map.get(tx, ty - 1, layer);
    const h2 = above.heightsTop[c];
    if (h2 === 0) return null;
    surface = (ty - 1) * T + h2;
    angle = 180 - slopeAngle(map, tx, ty - 1, c, 'heightsTop', layer);
  } else if (h === T) {
    const below = map.get(tx, ty + 1, layer);
    const h2 = below.heightsTop[c];
    surface = (ty + 1) * T + h2;
    angle = h2 > 0 ? 180 - slopeAngle(map, tx, ty + 1, c, 'heightsTop', layer) : 180 - slopeAngle(map, tx, ty, c, 'heightsTop', layer);
  } else {
    surface = ty * T + h;
    angle = 180 - slopeAngle(map, tx, ty, c, 'heightsTop', layer);
  }
  const depth = surface - py;
  if (depth < -SNAP) return null;
  return { depth, angle: norm360(angle), surface, oneWay: tile.oneWay };
}

function castEast(map: TileMap, px: number, py: number, layer: number): SensorHit | null {
  const tx = Math.floor(px / T);
  const ty = Math.floor(py / T);
  const r = Math.min(T - 1, Math.max(0, Math.floor(py - ty * T)));
  const tile = map.get(tx, ty, layer);
  const w = tile.widths[r];

  let surface: number;
  let angle: number;
  if (w === 0) {
    const east = map.get(tx + 1, ty, layer);
    const w2 = east.widths[r];
    if (w2 === 0) return null;
    surface = (tx + 2) * T - w2;
    angle = 90 - slopeAngleW(map, tx + 1, ty, r, 'widths', layer);
  } else if (w === T) {
    const west = map.get(tx - 1, ty, layer);
    const w2 = west.widths[r];
    surface = tx * T - w2;
    angle = w2 > 0 ? 90 - slopeAngleW(map, tx - 1, ty, r, 'widths', layer) : 90 - slopeAngleW(map, tx, ty, r, 'widths', layer);
  } else {
    surface = (tx + 1) * T - w;
    angle = 90 - slopeAngleW(map, tx, ty, r, 'widths', layer);
  }
  const depth = px - surface;
  if (depth < -SNAP) return null;
  return { depth, angle: norm360(angle), surface, oneWay: tile.oneWay };
}

function castWest(map: TileMap, px: number, py: number, layer: number): SensorHit | null {
  const tx = Math.floor(px / T);
  const ty = Math.floor(py / T);
  const r = Math.min(T - 1, Math.max(0, Math.floor(py - ty * T)));
  const tile = map.get(tx, ty, layer);
  const w = tile.widthsLeft[r];

  let surface: number;
  let angle: number;
  if (w === 0) {
    const west = map.get(tx - 1, ty, layer);
    const w2 = west.widthsLeft[r];
    if (w2 === 0) return null;
    surface = (tx - 1) * T + w2;
    angle = 270 + slopeAngleW(map, tx - 1, ty, r, 'widthsLeft', layer);
  } else if (w === T) {
    const east = map.get(tx + 1, ty, layer);
    const w2 = east.widthsLeft[r];
    surface = (tx + 1) * T + w2;
    angle = w2 > 0 ? 270 + slopeAngleW(map, tx + 1, ty, r, 'widthsLeft', layer) : 270 + slopeAngleW(map, tx, ty, r, 'widthsLeft', layer);
  } else {
    surface = tx * T + w;
    angle = 270 + slopeAngleW(map, tx, ty, r, 'widthsLeft', layer);
  }
  const depth = surface - px;
  if (depth < -SNAP) return null;
  return { depth, angle: norm360(angle), surface, oneWay: tile.oneWay };
}

/** Angle in degrees from a height array (positive = climbing to the right). */
function slopeAngle(map: TileMap, tx: number, ty: number, c: number, kind: 'heights' | 'heightsTop', layer: number): number {
  const prev = map.sampleHeights(tx, ty, c - 1, kind, layer);
  const next = map.sampleHeights(tx, ty, c + 1, kind, layer);
  return deg(Math.atan2(next - prev, 2));
}

/** Angle delta from a width array (positive = surface receding going down). */
function slopeAngleW(map: TileMap, tx: number, ty: number, r: number, kind: 'widths' | 'widthsLeft', layer: number): number {
  const prev = map.sampleWidths(tx, ty, r - 1, kind, layer);
  const next = map.sampleWidths(tx, ty, r + 1, kind, layer);
  return deg(Math.atan2(next - prev, 2));
}

export function norm360(a: number): number {
  return ((a % 360) + 360) % 360;
}

/** Smallest absolute difference between two angles, in [0, 180]. */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(norm360(a) - norm360(b));
  return d > 180 ? 360 - d : d;
}

/** Which ground-mode quadrant an angle falls into (SPG style). */
export function modeForAngle(angle: number): GroundMode {
  const a = norm360(angle);
  if (a >= 315 || a < 45) return MODE_FLOOR;
  if (a < 135) return MODE_RIGHT;
  if (a < 225) return MODE_CEILING;
  return MODE_LEFT;
}

/** Rotate a body-space offset into world space for the given ground mode. */
export function rotate(mode: GroundMode, bx: number, by: number): { x: number; y: number } {
  switch (mode) {
    case MODE_FLOOR:
      return { x: bx, y: by };
    case MODE_RIGHT:
      return { x: by, y: -bx };
    case MODE_CEILING:
      return { x: -bx, y: -by };
    case MODE_LEFT:
      return { x: -by, y: bx };
  }
}

export const sinDeg = (a: number) => Math.sin((a * Math.PI) / 180);
export const cosDeg = (a: number) => Math.cos((a * Math.PI) / 180);
