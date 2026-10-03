/**
 * Pure terrain geometry for the renderer (no DOM, unit tested).
 *
 * The collision map is a grid of 16-px tiles whose solid shape is a height
 * array — one value per pixel column. Rasterising that literally gives a
 * staircase: a 26° ramp climbs 1 px every 2 columns, which at a 3x render
 * scale is a visible 3-device-pixel stair on every slope in the game. The
 * renderer therefore works from per-column SOLID RUNS, smooths each surface
 * along its own run of connected columns (never across a real step or wall),
 * and joins neighbouring columns with quads between column centres. The
 * drawn surface stays within half a pixel of the collision surface, so feet
 * still sit exactly on it — it just stops looking like a bar chart.
 */
import { PHYS } from '../physics/constants.ts';
import { TILES, TILE_EMPTY, TILE_FULL, type Tile, type TileMap } from '../physics/TileMap.ts';

const T = PHYS.tile;

/** A vertical span of solid pixels in one column, world y, [top, bottom). */
export interface Run {
  top: number;
  bottom: number;
  /** Smoothed surface y (top) and underside y (bottom) for drawing. */
  st: number;
  sb: number;
  /** True when the run is cut by the query window, not by air. */
  openTop: boolean;
  openBottom: boolean;
}

/** Steps taller than this are real steps/walls and are never smoothed. */
const STEP = 3;
/** Smoothing half-window in columns. */
const SMOOTH = 2;

/**
 * Layer-0 tile for rendering. Above the map is open sky (the camera may
 * overscroll there); below and beside it the world is solid bedrock, which
 * matches the collision map's own out-of-bounds rule.
 */
export function renderTile(map: TileMap, tx: number, ty: number): Tile {
  if (ty < 0) return TILES[TILE_EMPTY];
  if (ty >= map.h) return TILES[TILE_FULL];
  const cx = Math.max(0, Math.min(map.w - 1, tx));
  return map.get(cx, ty, 0);
}

/** One-way platforms are drawn as separate props, never as ground mass. */
export function isOneWay(t: Tile): boolean {
  return t.oneWay;
}

/** Solid runs of world column `x` between world rows y0..y1 (one-way excluded). */
export function columnRuns(map: TileMap, x: number, y0: number, y1: number): Run[] {
  const tx = Math.floor(x / T);
  const c = ((x % T) + T) % T;
  const runs: Run[] = [];
  let cur: Run | null = null;
  const ty0 = Math.floor(y0 / T);
  const ty1 = Math.floor((y1 - 1) / T);
  for (let ty = ty0; ty <= ty1; ty++) {
    const tile = renderTile(map, tx, ty);
    let a = 0;
    let b = 0;
    if (!tile.oneWay) {
      const h = tile.heights[c];
      if (h > 0) {
        a = ty * T + T - h;
        b = ty * T + T;
      } else if (tile.heightsTop[c] > 0) {
        a = ty * T;
        b = ty * T + tile.heightsTop[c];
      }
    }
    if (b > a) {
      a = Math.max(a, y0);
      b = Math.min(b, y1);
      if (b <= a) continue;
      if (cur && cur.bottom === a) cur.bottom = b;
      else {
        cur = { top: a, bottom: b, st: a, sb: b, openTop: false, openBottom: false };
        runs.push(cur);
      }
    }
  }
  for (const r of runs) {
    r.st = r.top;
    r.sb = r.bottom;
    r.openTop = r.top <= y0;
    r.openBottom = r.bottom >= y1;
  }
  return runs;
}

/** The run in `list` that continues `r` sideways (overlaps it), if any. */
function partner(r: Run, list: Run[] | undefined): Run | null {
  if (!list) return null;
  let best: Run | null = null;
  let bestD = Infinity;
  for (const o of list) {
    if (o.bottom <= r.top || o.top >= r.bottom) continue;
    const d = Math.abs(o.top - r.top);
    if (d < bestD) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

/**
 * Column runs for world columns x0..x1-1, with each surface (and underside)
 * smoothed along its chain of connected columns.
 */
export function buildColumns(map: TileMap, x0: number, x1: number, y0: number, y1: number): Run[][] {
  const cols: Run[][] = [];
  for (let x = x0; x < x1; x++) cols.push(columnRuns(map, x, y0, y1));

  const smoothEdge = (key: 'top' | 'bottom', out: 'st' | 'sb', open: 'openTop' | 'openBottom') => {
    for (let i = 0; i < cols.length; i++) {
      for (const r of cols[i]) {
        if (r[open]) continue;
        let sum = r[key];
        let n = 1;
        // Walk the chain each way while the edge stays continuous.
        for (const dir of [-1, 1]) {
          let prev = r;
          for (let k = 1; k <= SMOOTH; k++) {
            const p = partner(prev, cols[i + dir * k]);
            if (!p || p[open] || Math.abs(p[key] - prev[key]) > STEP) break;
            sum += p[key];
            n++;
            prev = p;
          }
        }
        r[out] = sum / n;
      }
    }
  };
  smoothEdge('top', 'st', 'openTop');
  smoothEdge('bottom', 'sb', 'openBottom');
  return cols;
}

/** A filled polygon in world coordinates (flat x,y pairs). */
export type Poly = number[];

/**
 * The solid mass as polygons. Each STRIP — a run continued column after
 * column while the surface and underside stay continuous and the link is
 * unambiguous (each run is the other's best partner) — becomes ONE polygon:
 * its top edge through the smoothed column centres, its bottom edge back.
 * Strips end on their column's exact pixel boundary, so walls stay sharp and
 * neighbouring strips abut with no gap. Collinear points are dropped.
 *
 * This matters for speed: the old per-column quads made every chunk a path
 * of ~300 sub-polygons, filled ~20 times per chunk by the compositor, and the
 * GPU tessellation of that is what stalled the frame when a chunk was baked.
 * A flat stretch of ground is now four points.
 */
export function solidPolys(cols: Run[][], x0: number): Poly[] {
  const next = new Map<Run, Run>();
  const linked = new Set<Run>();
  for (let i = 0; i + 1 < cols.length; i++) {
    for (const a of cols[i]) {
      const b = partner(a, cols[i + 1]);
      if (!b || partner(b, cols[i]) !== a) continue;
      if (Math.abs(a.st - b.st) > STEP || Math.abs(a.sb - b.sb) > STEP) continue;
      next.set(a, b);
      linked.add(b);
    }
  }
  const polys: Poly[] = [];
  for (let i = 0; i < cols.length; i++) {
    for (const first of cols[i]) {
      if (linked.has(first)) continue; // not a strip start
      const top: number[] = [x0 + i, first.st];
      const bottom: number[] = [x0 + i, first.sb];
      let r = first;
      let x = x0 + i;
      for (;;) {
        top.push(x + 0.5, r.st);
        bottom.push(x + 0.5, r.sb);
        const n = next.get(r);
        if (!n) break;
        r = n;
        x++;
      }
      top.push(x + 1, r.st);
      bottom.push(x + 1, r.sb);
      const poly = simplify(top);
      const under = simplify(bottom);
      for (let k = under.length - 2; k >= 0; k -= 2) poly.push(under[k], under[k + 1]);
      polys.push(poly);
    }
  }
  return polys;
}

/** Drops points that lie on the line through their neighbours. */
function simplify(pts: number[]): number[] {
  if (pts.length <= 4) return pts.slice();
  const out = [pts[0], pts[1]];
  for (let k = 2; k + 2 < pts.length; k += 2) {
    const ax = out[out.length - 2];
    const ay = out[out.length - 1];
    const bx = pts[k];
    const by = pts[k + 1];
    const cx = pts[k + 2];
    const cy = pts[k + 3];
    const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(cross) > 0.05 * Math.hypot(cx - ax, cy - ay)) out.push(bx, by);
  }
  out.push(pts[pts.length - 2], pts[pts.length - 1]);
  return out;
}


/** A horizontal run of one-way platform tiles, world px. */
export interface Ledge {
  x: number;
  y: number;
  w: number;
}

/** Merges one-way tiles into ledges overlapping the given world rect. */
export function ledges(map: TileMap, x0: number, y0: number, x1: number, y1: number): Ledge[] {
  const out: Ledge[] = [];
  const ty0 = Math.max(0, Math.floor(y0 / T));
  const ty1 = Math.min(map.h - 1, Math.floor((y1 - 1) / T));
  for (let ty = ty0; ty <= ty1; ty++) {
    // Scan the whole row so a ledge crossing the window keeps its true ends
    // (its end caps must render identically in every chunk it touches).
    let start = -1;
    for (let tx = 0; tx <= map.w; tx++) {
      const one = tx < map.w && map.get(tx, ty, 0).oneWay;
      if (one && start < 0) start = tx;
      if (!one && start >= 0) {
        const lx = start * T;
        const lw = (tx - start) * T;
        if (lx < x1 && lx + lw > x0) out.push({ x: lx, y: ty * T, w: lw });
        start = -1;
      }
    }
  }
  return out;
}

/**
 * Tiles that read as UNDERGROUND: empty space with a thick roof above it and
 * a floor close below. Those get a back wall of rock instead of showing the
 * sky through the ground — a gallery that looks onto the sunset reads as a
 * hole in the level, not a tunnel. Returns world-pixel rects (tile aligned).
 */
export function interiorRects(map: TileMap, x0: number, y0: number, x1: number, y1: number): { x: number; y: number; w: number; h: number }[] {
  const out: { x: number; y: number; w: number; h: number }[] = [];
  const solid = (tx: number, ty: number) => {
    const t = renderTile(map, tx, ty);
    return !t.oneWay && t !== TILES[TILE_EMPTY];
  };
  const tx0 = Math.floor(x0 / T);
  const tx1 = Math.ceil(x1 / T);
  const ty1 = Math.min(map.h, Math.ceil(y1 / T));
  for (let tx = tx0; tx < tx1; tx++) {
    let roof = 0; // consecutive solid tiles seen just above
    let ty = 0;
    while (ty < ty1) {
      if (solid(tx, ty)) {
        roof++;
        ty++;
        continue;
      }
      // An empty span starts here.
      const start = ty;
      while (ty < map.h && !solid(tx, ty)) ty++;
      const gap = ty - start;
      const floored = ty < map.h;
      if (roof >= 2 && floored && gap <= 8) {
        const a = Math.max(start, Math.floor(y0 / T) - 1);
        const b = Math.min(ty, ty1 + 1);
        if (b > a) out.push({ x: tx * T, y: a * T, w: T, h: (b - a) * T });
      }
      roof = 0;
    }
  }
  return out;
}
