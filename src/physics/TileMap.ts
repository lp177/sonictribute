import { PHYS } from './constants.ts';

const T = PHYS.tile; // 16

/**
 * A tile is described by height/width arrays, exactly like the Mega Drive
 * games: `heights[c]` = solid pixels measured from the bottom edge for column
 * c (used by floor sensors), `widths[r]` = solid pixels from the right edge
 * for row r (used when running on right-side walls). The two other
 * orientations are used for ceiling / left-wall traversal and default to
 * "full only"; the loop generator provides proper values for them.
 */
export interface Tile {
  heights: number[];
  widths: number[];
  heightsTop: number[];
  widthsLeft: number[];
  /** Platforms only collide with feet coming from above. */
  oneWay: boolean;
}

export function makeTile(heights: number[], widths?: number[], oneWay = false): Tile {
  const w = widths ?? heights.map((v) => (v > 0 ? T : 0));
  return {
    heights,
    widths: w,
    heightsTop: heights.map((v) => (v >= T ? T : 0)),
    widthsLeft: w.map((v) => (v >= T ? T : 0)),
    oneWay,
  };
}

const range = (n: number, fn: (i: number) => number) =>
  Array.from({ length: n }, (_, i) => Math.max(0, Math.min(T, Math.round(fn(i)))));

/* ------------------------------- Built-in tiles ------------------------------ */

export const TILE_EMPTY = 0;
export const TILE_FULL = 1;

export const TILES: Tile[] = [
  makeTile(range(T, () => 0), range(T, () => 0)), // 0 empty
  makeTile(range(T, () => T)), // 1 full
  // 2 slope up-right 45° (heights 1..16). Widths are the true mirror
  // (row r has r+1 solid pixels from the right) so wall-mode sensors work.
  makeTile(range(T, (c) => c + 1), range(T, (r) => r + 1)),
  makeTile(range(T, (c) => T - c)), // 3 slope down-right 45° (16..1)
  makeTile(range(T, (c) => (c + 1) / 2)), // 4 gentle up-right (0.5..8)
  makeTile(range(T, (c) => 8 + (c + 1) / 2)), // 5 gentle up-right high (8.5..16)
  makeTile(range(T, (c) => (T - c) / 2)), // 6 gentle down-right (8..0.5)
  makeTile(range(T, (c) => 8 + (T - c) / 2)), // 7 gentle down-right high (16..8.5)
  makeTile(range(T, () => T), range(T, () => T), true), // 8 one-way platform
];

const clampT = (v: number) => Math.max(0, Math.min(T, Math.round(v)));

/* ------------------------------- Loop generator ------------------------------ */

/**
 * Stamps a classic loop into one collision layer: a solid annulus whose inner
 * surface is traversable in all four ground modes. `cx`, `cy` are the loop
 * centre in world pixels. The annulus bottom is flattened to `floorY` (the
 * surrounding corridor height) over the middle `flatHalf` pixels so the
 * channel floor meets the corridor seamlessly.
 */
export function stampLoop(
  map: TileMap,
  layer: number,
  cx: number,
  cy: number,
  innerR: number,
  thickness: number,
  flatHalf = 24,
): void {
  const outerR = innerR + thickness;
  const floorY = cy + innerR;
  const box = Math.ceil(outerR / T);
  const tx0 = Math.floor(cx / T) - box;
  const ty0 = Math.floor(cy / T) - box;

  for (let ty = ty0; ty <= ty0 + box * 2; ty++) {
    for (let tx = tx0; tx <= tx0 + box * 2; tx++) {
      const heights = new Array<number>(T).fill(0);
      const widths = new Array<number>(T).fill(0);
      const heightsTop = new Array<number>(T).fill(0);
      const widthsLeft = new Array<number>(T).fill(0);
      let any = false;

      for (let c = 0; c < T; c++) {
        const x = tx * T + c + 0.5;
        const dx = Math.abs(x - cx);
        if (dx < outerR) {
          const innerDy = dx < innerR ? Math.sqrt(innerR * innerR - dx * dx) : 0;
          const outerDy = Math.sqrt(outerR * outerR - dx * dx);
          // Bottom band of the annulus (flattened near the corridor level).
          let bLo = dx < innerR ? cy + innerDy : cy - outerDy;
          if (dx <= flatHalf) bLo = floorY;
          const bHi = cy + outerDy;
          // Top band.
          const tLo = cy - outerDy;
          const tHi = dx < innerR ? cy - innerDy : cy + outerDy;
          const tileTop = ty * T;
          if (bHi > tileTop && bLo < tileTop + T) heights[c] = clampT(tileTop + T - bLo);
          if (tHi > tileTop && tLo < tileTop + T) heightsTop[c] = clampT(tHi - tileTop);
          if (heights[c] > 0 || heightsTop[c] > 0) any = true;
        }
      }
      for (let r = 0; r < T; r++) {
        const y = ty * T + r + 0.5;
        const dy = Math.abs(y - cy);
        if (dy < outerR) {
          const innerDx = dy < innerR ? Math.sqrt(innerR * innerR - dy * dy) : 0;
          const outerDx = Math.sqrt(outerR * outerR - dy * dy);
          const rLo = dy < innerR ? cx + innerDx : cx - outerDx;
          const rHi = cx + outerDx;
          const lLo = cx - outerDx;
          const lHi = dy < innerR ? cx - innerDx : cx + outerDx;
          const tileLeft = tx * T;
          if (rHi > tileLeft && rLo < tileLeft + T) widths[r] = clampT(tileLeft + T - rLo);
          if (lHi > tileLeft && lLo < tileLeft + T) widthsLeft[r] = clampT(lHi - tileLeft);
        }
      }
      if (any) map.setTile(tx, ty, { heights, widths, heightsTop, widthsLeft, oneWay: false }, layer);
    }
  }
}

/* --------------------------------- Tile map --------------------------------- */

/**
 * Two full collision layers, like Sonic 1: layer 0 is the default terrain,
 * layer 1 is used inside loops (the corridor through the loop is removed
 * there and replaced by the annulus channel). Triggers in the level switch
 * the player's active layer.
 */
export class TileMap {
  readonly w: number;
  readonly h: number;
  private grids: [Tile[], Tile[]];

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.grids = [
      new Array<Tile>(w * h).fill(TILES[TILE_EMPTY]),
      new Array<Tile>(w * h).fill(TILES[TILE_EMPTY]),
    ];
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h;
  }

  get(tx: number, ty: number, layer = 0): Tile {
    if (!this.inBounds(tx, ty)) return TILES[TILE_FULL]; // world edges are solid
    return this.grids[layer][ty * this.w + tx];
  }

  setTile(tx: number, ty: number, tile: Tile | null, layer = 0): void {
    if (this.inBounds(tx, ty)) this.grids[layer][ty * this.w + tx] = tile ?? TILES[TILE_EMPTY];
  }

  set(tx: number, ty: number, id: number, layer = 0): void {
    this.setTile(tx, ty, TILES[id] ?? null, layer);
  }

  /** Copies one collision layer onto another (base for loop variants). */
  copyLayer(from: number, to: number): void {
    this.grids[to] = this.grids[from].slice();
  }

  get pixelW(): number {
    return this.w * T;
  }
  get pixelH(): number {
    return this.h * T;
  }

  /** Height/width-array sample that crosses tile borders (angle estimation). */
  sampleHeights(tx: number, ty: number, c: number, kind: 'heights' | 'heightsTop', layer = 0): number {
    let x = tx;
    let col = c;
    if (c < 0) {
      x = tx - 1;
      col = c + T;
    } else if (c >= T) {
      x = tx + 1;
      col = c - T;
    }
    return this.get(x, ty, layer)[kind][col];
  }

  sampleWidths(tx: number, ty: number, r: number, kind: 'widths' | 'widthsLeft', layer = 0): number {
    let y = ty;
    let row = r;
    if (r < 0) {
      y = ty - 1;
      row = r + T;
    } else if (r >= T) {
      y = ty + 1;
      row = r - T;
    }
    return this.get(tx, y, layer)[kind][row];
  }
}
