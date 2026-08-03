import { expect } from 'vitest';
import { Level, type LevelDef } from '../src/game/Level.ts';
import { TILES, TILE_EMPTY } from '../src/physics/TileMap.ts';
import { castGround } from '../src/physics/sensors.ts';
import { PHYS } from '../src/physics/constants.ts';
import { Player, NO_INPUT } from '../src/game/Player.ts';
import { input } from './helpers.ts';

const T = PHYS.tile;

/** Row bands each route is expected to live in (world height 40). */
const LANES = [
  { name: 'sky', from: 2, to: 16 },
  { name: 'ground', from: 17, to: 27 },
  { name: 'under', from: 28, to: 36 },
] as const;

function laneColumns(level: Level, from: number, to: number, needHeadroom = false): number[] {
  const cols: number[] = [];
  for (let tx = 0; tx < level.map.w; tx++) {
    for (let ty = from; ty <= to; ty++) {
      if (!level.map.get(tx, ty, 0).heights.some((h) => h > 0)) continue;
      if (needHeadroom) {
        // A REAL route needs somewhere to exist above its floor: two clear
        // rows of headroom. Without this, solid bedrock "passes" as an
        // underground path — the exact hole that shipped fake under-routes.
        const clear = (row: number) =>
          row >= 0 && !level.map.get(tx, row, 0).heights.some((h) => h > 0);
        if (!(clear(ty - 1) && clear(ty - 2))) continue;
      }
      cols.push(tx);
      break;
    }
  }
  return cols;
}

/**
 * The whole-act quality gate every one of the campaign's acts must pass.
 * This is what lets forty-two levels be authored in parallel without any of
 * them shipping a dead end, a stall, a buried entity or a missing route.
 */
export function checkAct(def: LevelDef): void {
  const level = new Level(def);
  const name = `${def.title}`;

  // --- Structure minimums ---
  expect(level.crystals, `${name}: crystals`).toHaveLength(5);
  expect(level.secrets, `${name}: secrets`).toHaveLength(3);
  expect(level.checkpoints.length, `${name}: checkpoints`).toBeGreaterThanOrEqual(2);
  expect(level.rings.length, `${name}: rings`).toBeGreaterThan(50);
  expect(
    level.enemies.length + level.drones.length,
    `${name}: enemies`,
  ).toBeGreaterThanOrEqual(3);
  expect(level.goal.x, `${name}: goal`).toBeGreaterThan(0);
  if (def.bossKind) {
    expect(level.bossTriggerX, `${name}: boss trigger`).toBeGreaterThan(0);
    expect(level.goal.x, `${name}: goal after trigger`).toBeGreaterThan(level.bossTriggerX);
  }

  // --- Nothing buried in solid rock ---
  const emptyAt = (x: number, y: number) =>
    level.map.get(Math.floor(x / T), Math.floor(y / T), 0) === TILES[TILE_EMPTY];
  for (const r of level.rings) expect(emptyAt(r.x, r.y), `${name}: ring in rock @${Math.round(r.x / T)},${Math.round(r.y / T)}`).toBe(true);
  for (const c of level.crystals) expect(emptyAt(c.x, c.y), `${name}: crystal in rock @${Math.round(c.x / T)}`).toBe(true);
  for (const m of level.monitors) expect(emptyAt(m.x, m.y), `${name}: monitor in rock @${Math.round(m.x / T)}`).toBe(true);
  for (const e of level.enemies) expect(emptyAt(e.x, e.y), `${name}: enemy in rock @${Math.round(e.x / T)}`).toBe(true);
  for (const d of level.drones) expect(emptyAt(d.x, d.y), `${name}: drone in rock @${Math.round(d.x / T)}`).toBe(true);

  // --- No hand-placed ring inside a loop's annulus wall ---
  for (const loop of level.loops) {
    for (const ring of level.rings) {
      const d = Math.hypot(ring.x - loop.cx, ring.y - loop.cy);
      expect(d >= loop.innerR && d <= loop.outerR, `${name}: ring buried in loop wall`).toBe(false);
    }
    // Loop corridors solid on layer 0, hollow above.
    const cxTile = Math.floor(loop.cx / T);
    const surfaceRow = Math.floor((loop.cy + loop.innerR) / T);
    for (let dx = -6; dx <= 6; dx++) {
      expect(
        level.map.get(cxTile + dx, surfaceRow, 0).heights.some((h) => h > 0),
        `${name}: loop corridor broken at ${cxTile + dx}`,
      ).toBe(true);
    }
  }

  // --- Three routes, continuous and stocked ---
  for (const lane of LANES) {
    // The under lane must be a travellable gallery (floor + headroom), not
    // bedrock; the other bands' surfaces have open air by construction.
    const cols = laneColumns(level, lane.from, lane.to, lane.name === 'under');
    expect(cols.length, `${name}: ${lane.name} route missing`).toBeGreaterThan(30);
    const span = cols[cols.length - 1] - cols[0];
    expect(span, `${name}: ${lane.name} route too short`).toBeGreaterThan(90);
    for (let i = 1; i < cols.length; i++) {
      const gap = cols[i] - cols[i - 1] - 1;
      expect(gap, `${name}: ${lane.name} has a ${gap}-tile gap at x=${cols[i - 1]}`).toBeLessThanOrEqual(9);
    }
  }
  const laneOf = (y: number) => LANES.find((l) => y / T >= l.from && y / T <= l.to)?.name ?? 'other';
  expect(
    new Set(level.crystals.map((c) => laneOf(c.y))).size,
    `${name}: crystals all on one route`,
  ).toBeGreaterThanOrEqual(2);

  // --- Reachability flood fill (goal, crystals, secrets) ---
  const w = level.map.w;
  const passable = (tx: number, ty: number) => {
    if (!level.map.inBounds(tx, ty)) return false;
    const t = level.map.get(tx, ty, 0);
    return t === TILES[TILE_EMPTY] || t.oneWay;
  };
  const seen = new Set<number>();
  const queue = [{ x: Math.floor(level.startPos.x / T), y: Math.floor(level.startPos.y / T) }];
  seen.add(queue[0].y * w + queue[0].x);
  while (queue.length) {
    const { x, y } = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const k = (y + dy) * w + (x + dx);
      if (!seen.has(k) && passable(x + dx, y + dy)) {
        seen.add(k);
        queue.push({ x: x + dx, y: y + dy });
      }
    }
  }
  const at = (x: number, y: number) => seen.has(Math.floor(y / T) * w + Math.floor(x / T));
  expect(at(level.goal.x, level.goal.y - 8), `${name}: goal unreachable`).toBe(true);
  level.crystals.forEach((c, i) => expect(at(c.x, c.y), `${name}: crystal ${i} unreachable @${Math.round(c.x / T)}`).toBe(true));
  level.secrets.forEach((s, i) => expect(at(s.x + s.w / 2, s.y + s.h / 2), `${name}: secret ${i} unreachable`).toBe(true));

  // --- Flow: a bot holding right reaches the end without stalling ---
  const p = new Player(level.startPos.x, level.startPos.y);
  for (let i = 0; i < 40 && !p.grounded; i++) p.update(level.map, NO_INPUT);
  p.rings = 30;
  let lastX = p.x;
  let stall = 0;
  let worstStall = 0;
  let worstAt = 0;
  const startX = p.x;
  const target = level.bossTriggerX > 0 ? level.bossTriggerX : level.goal.x - 8 * T;
  let f = 0;
  for (; f < 9000 && !p.dead; f++) {
    const groundAhead = castGround(level.map, p.x + 26, p.y + p.h + 8, 0, p.layer);
    const jump = p.grounded && p.mode === 0 && !groundAhead;
    p.update(level.map, input({ right: true, jump, jumpPressed: jump }));
    level.update(p);
    if (p.rings === 0) p.rings = 30;
    if (p.x - lastX > 0.4) {
      lastX = p.x;
      stall = 0;
    } else if (++stall > worstStall) {
      worstStall = stall;
      worstAt = p.x;
    }
    if (p.x > target) break;
  }
  expect(p.dead, `${name}: flow bot died`).toBe(false);
  expect(p.x, `${name}: flow bot never reached the end`).toBeGreaterThan(target);
  expect(
    worstStall,
    `${name}: pinned ${worstStall} frames at tile ${Math.round(worstAt / T)}`,
  ).toBeLessThan(150);
  expect((p.x - startX) / Math.max(1, f), `${name}: too slow overall`).toBeGreaterThan(2.2);

  // --- Doing nothing produces nothing ---
  const idleLevel = new Level(def);
  const q = new Player(idleLevel.startPos.x, idleLevel.startPos.y);
  for (let i = 0; i < 40 && !q.grounded; i++) q.update(idleLevel.map, NO_INPUT);
  const heard: string[] = [];
  for (let i = 0; i < 600; i++) {
    q.update(idleLevel.map, NO_INPUT);
    heard.push(...idleLevel.update(q));
  }
  expect(heard, `${name}: idle start triggers ${[...new Set(heard)].join(',')}`).toEqual([]);
}
