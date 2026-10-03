import type { Level } from '../src/game/Level.ts';
import { PHYS } from '../src/physics/constants.ts';

const T = PHYS.tile;

/**
 * A physical answer to "can a player get there?".
 *
 * The contract's flood fill only proves a prize is not sealed in rock: air
 * connects everything, so a catwalk eleven rows over flat ground with nothing
 * leading up to it passes, and so does the crystal on it. Three of the four
 * biomes shipped first drafts with high roads nobody could stand on.
 *
 * This walks the act the way a player moves: along the ground, by running
 * jumps (the real arc: five rows up, and as far across as a jump at running
 * speed carries to that height), off springs, kicker lips and launchers,
 * along rails and cart tracks, up wind columns, under the wing, and from
 * badnik to badnik. It is deliberately GENEROUS — no walls, always a full
 * run-up — so what it reports as unreachable really is.
 */
const JUMP_UP = 5;
/** Columns a jump at running speed covers before coming down `up` rows above where it left (negative = below). */
function jumpAcross(up: number): number {
  const d = PHYS.jmp * PHYS.jmp - 2 * PHYS.grv * up * T;
  if (d < 0) return -1;
  return Math.floor((PHYS.top * (PHYS.jmp + Math.sqrt(d))) / PHYS.grv / T) - 2;
}
const ACROSS = Array.from({ length: JUMP_UP + 1 }, (_, up) => jumpAcross(up));
/** A jump to somewhere lower, or a plain drop: the level arc and a little more. */
const DROP_ACROSS = jumpAcross(0) + 4;
const JUMP_ACROSS = ACROSS[JUMP_UP];

export interface Reach {
  /** Can a player stand on (col, row)? */
  stands(col: number, row: number): boolean;
  /** Ledges (runs of one-way tiles, crumbling and hard-light ledges) nobody can get onto. */
  deadLedges: { x0: number; x1: number; row: number }[];
  /** True when a pickup at world (x, y) is within a jump of somewhere reachable, or on a flight path. */
  canTake(x: number, y: number): boolean;
}

export function reach(level: Level): Reach {
  const W = level.map.w;
  const H = level.map.h;
  const tile = (x: number, y: number) => level.map.get(x, y, 0);
  const solid = (x: number, y: number) => level.map.inBounds(x, y) && tile(x, y).heights.some((h) => h > 0);
  const key = (x: number, r: number) => r * W + x;

  // Everywhere feet can rest: the top of a tile (or a ledge) with headroom.
  const spots = new Set<number>();
  const byCol: number[][] = Array.from({ length: W }, () => []);
  const add = (x: number, r: number) => {
    if (x < 0 || x >= W || r < 1 || r >= H || spots.has(key(x, r))) return;
    spots.add(key(x, r));
    byCol[x].push(r);
  };
  // Headroom is what rock leaves: a one-way ledge overhead is no ceiling.
  const blocks = (x: number, y: number) => solid(x, y) && !tile(x, y).oneWay;
  for (let x = 0; x < W; x++) {
    for (let y = 2; y < H; y++) if (solid(x, y) && !blocks(x, y - 1) && !blocks(x, y - 2) && !tile(x, y - 1).oneWay) add(x, y);
  }
  const ledges: { x0: number; x1: number; row: number }[] = [];
  for (let y = 0; y < H; y++) {
    let a = -1;
    for (let x = 0; x <= W; x++) {
      const on = x < W && tile(x, y).oneWay;
      if (on && a < 0) a = x;
      if (!on && a >= 0) {
        if (x - a >= 2) ledges.push({ x0: a, x1: x - 1, row: y });
        a = -1;
      }
    }
  }
  for (const c of [...level.crumbles, ...level.phasePlats]) {
    const row = Math.round(c.y / T);
    const x0 = Math.floor(c.x / T);
    const x1 = Math.floor((c.x + c.w - 1) / T);
    for (let x = x0; x <= x1; x++) add(x, row);
    ledges.push({ x0, x1, row });
  }

  const seen = new Set<number>();
  const queue: [number, number][] = [];
  const visit = (x: number, r: number) => {
    const k = key(x, r);
    if (!spots.has(k) || seen.has(k)) return;
    seen.add(k);
    queue.push([x, r]);
  };
  /** Everything standable in a box of columns, from `top` row down. */
  const land = (x0: number, x1: number, top: number, bottom = H) => {
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) for (const r of byCol[x]) if (r >= top && r <= bottom) visit(x, r);
  };

  // Things that throw or carry: each fires once, when something reachable touches it.
  type Mover = { near: (x: number, r: number) => boolean; go: () => void; done: boolean };
  const movers: Mover[] = [];
  const zones: { x0: number; x1: number; top: number }[] = [];
  const fling = (x0: number, x1: number, top: number) => {
    zones.push({ x0, x1, top });
    land(x0, x1, top);
  };
  for (const s of level.springs) {
    const col = Math.floor(s.x / T);
    const row = Math.round((s.y + 8) / T);
    const rise = Math.floor((s.power * s.power) / (2 * PHYS.grv) / T) - 1;
    movers.push({ near: (x, r) => Math.abs(x - col) <= 2 && Math.abs(r - row) <= 2, go: () => fling(col - 6, col + 16, row - rise), done: false });
  }
  for (const l of level.launchers) {
    const col = Math.floor(l.x / T);
    const row = Math.round((l.y + 8) / T);
    movers.push({ near: (x, r) => Math.abs(x - col) <= 3 && Math.abs(r - row) <= 2, go: () => fling(l.dir > 0 ? col : col - 44, l.dir > 0 ? col + 44 : col, row - 18), done: false });
  }
  // Kicker lips: a 45° tile with open air past it. What leaves it flies.
  for (let x = 0; x < W - 1; x++) {
    for (let y = 1; y < H; y++) {
      const t = tile(x, y);
      if (t.heights[0] !== 1 || t.heights[T - 1] !== T || solid(x + 1, y) || solid(x + 1, y + 1)) continue;
      movers.push({ near: (cx, r) => cx <= x && cx >= x - 40 && r >= y - 2 && r <= y + 18, go: () => fling(x + 2, x + 52, y - 12), done: false });
    }
  }
  for (const rl of [...level.rails, ...level.carts.map((c) => ({ x0: Math.min(c.startX, c.endX), y0: c.startX < c.endX ? c.startY : c.endY, x1: Math.max(c.startX, c.endX), y1: c.startX < c.endX ? c.endY : c.startY }))]) {
    const cx0 = Math.floor(rl.x0 / T);
    const cx1 = Math.floor(rl.x1 / T);
    const rowAt = (x: number) => (rl.y0 + ((rl.y1 - rl.y0) * (x * T - rl.x0)) / Math.max(1, rl.x1 - rl.x0)) / T;
    movers.push({
      // Dropped onto from above, or jumped onto from beside either end.
      near: (x, r) => x >= cx0 - JUMP_ACROSS && x <= cx1 + JUMP_ACROSS && r - rowAt(Math.max(cx0, Math.min(cx1, x))) <= JUMP_UP && rowAt(Math.max(cx0, Math.min(cx1, x))) - r <= 14,
      go: () => {
        // A rider can jump off anywhere along it, and is set down past either end.
        fling(cx0 - 10, cx1 + 24, Math.floor(Math.min(rl.y0, rl.y1) / T) - JUMP_UP - 1);
      },
      done: false,
    });
  }
  for (const w of level.winds) {
    const cx0 = Math.floor(w.x0 / T);
    const cx1 = Math.floor(w.x1 / T);
    movers.push({ near: (x, r) => x >= cx0 - 3 && x <= cx1 + 3 && r * T >= w.y0, go: () => fling(cx0 - 10, cx1 + 10, Math.floor(w.y0 / T) - 4), done: false });
  }
  for (const g of level.gliders) {
    const col = Math.floor(g.x / T);
    const row = Math.floor(g.y / T);
    // Under the wing: a long shallow way forward, and up wherever a thermal lifts it.
    movers.push({ near: (x, r) => Math.abs(x - col) <= JUMP_ACROSS && r - row <= JUMP_UP + 2 && row - r <= 20, go: () => fling(col - 4, col + 110, row - 16), done: false });
  }
  for (const d of level.drones) {
    const col = Math.floor(d.homeX / T);
    const row = Math.floor(d.homeY / T);
    movers.push({ near: (x, r) => Math.abs(x - col) <= JUMP_ACROSS + 2 && r - row <= JUMP_UP + 1 && row - r <= 20, go: () => fling(col - JUMP_ACROSS - 2, col + JUMP_ACROSS + 2, row - JUMP_UP - 1), done: false });
  }
  for (const b of level.boardPads) {
    const col = Math.floor(b.x / T);
    void col; // the board changes speed, not where feet can go
  }

  const start: [number, number] = [Math.floor(level.startPos.x / T), 0];
  for (const r of byCol[start[0]]) if (r * T >= level.startPos.y) {
    visit(start[0], r);
    break;
  }
  while (queue.length) {
    const [x, r] = queue.pop()!;
    for (let dx = -DROP_ACROSS; dx <= DROP_ACROSS; dx++) {
      const nx = x + dx;
      if (nx < 0 || nx >= W) continue;
      for (const nr of byCol[nx]) {
        // Up: within a jump, and no further across than the arc reaches at
        // that height. Down: anywhere a fall or a long hop carries.
        if (nr < r ? r - nr <= JUMP_UP && Math.abs(dx) <= ACROSS[r - nr] : true) visit(nx, nr);
      }
    }
    for (const m of movers) {
      if (m.done || !m.near(x, r)) continue;
      m.done = true;
      m.go();
    }
  }

  const stands = (col: number, row: number) => seen.has(key(col, row));
  return {
    stands,
    deadLedges: ledges.filter((l) => {
      for (let x = l.x0; x <= l.x1; x++) if (stands(x, l.row)) return false;
      return true;
    }),
    canTake(px, py) {
      const col = Math.floor(px / T);
      const row = py / T;
      for (let x = Math.max(0, col - JUMP_ACROSS); x <= Math.min(W - 1, col + JUMP_ACROSS); x++) {
        for (const r of byCol[x]) if (stands(x, r) && r - row >= -1 && r - row <= JUMP_UP + 2) return true;
      }
      return zones.some((z) => col >= z.x0 && col <= z.x1 && row >= z.top);
    },
  };
}
