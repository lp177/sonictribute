import { expect } from 'vitest';
import { Level, type LevelDef } from '../src/game/Level.ts';
import { TILES, TILE_EMPTY } from '../src/physics/TileMap.ts';
import { PHYS } from '../src/physics/constants.ts';
import { Player, NO_INPUT } from '../src/game/Player.ts';
import { WORLD_ROWS } from '../src/levels/sections.ts';
import { runBot, finishLine } from './bots.ts';
import { reach } from './reach.ts';

const T = PHYS.tile;

/**
 * What an act owes the player, as numbers. They come from how the classic
 * games' acts are actually built (see AGENTS.md, "Level design rules"):
 * roads that rise and fall, speed earned from slopes rather than handed out
 * by boosters, roads stacked over each other for most of the act's length,
 * and nothing anywhere that ends a run for missing a jump.
 */
export const ACT = {
  /** Tiles. A classic opening act is ~600 x 64; shorter is over before it starts. */
  minWidth: 480,
  maxWidth: 760,
  rings: 150,
  enemies: 6,
  monitors: 6,
  checkpoints: 3,
  /** Rows between the highest and the lowest point of the ground. */
  relief: 14,
  /** Longest stretch of ground allowed to stay level (columns)... */
  flatRun: 44,
  /** ...except the home straight: the last columns before the finish. */
  homeStraight: 70,
  /** Downhill runs of at least `descentRows` rows: where the speed comes from. */
  descents: 3,
  descentRows: 6,
  /** Share of columns with a second / a third road stacked over the first. */
  twoRoads: 0.4,
  threeRoads: 0.1,
  /** Rows a crystal must sit above the middle road to count as a high-road one. */
  tierGap: 5,
  /** Dash pads: speed is the terrain's to give. Board acts get the board's own. */
  dashPads: 2,
  dashPadsBoard: 4,
  loops: 3,
  /** A loop's run-up must come down at least this many rows... */
  loopRunUp: 4,
  /** ...and no dash pad may sit this close before it. */
  loopPadClear: 14,
} as const;

const solid = (level: Level, tx: number, ty: number): boolean =>
  level.map.inBounds(tx, ty) && level.map.get(tx, ty, 0).heights.some((h) => h > 0);

/** Rows of every standable surface in a column: solid (or a ledge) with headroom. */
function surfaces(level: Level, tx: number): number[] {
  const rows: number[] = [];
  for (let ty = 2; ty < level.map.h; ty++) {
    if (solid(level, tx, ty) && !solid(level, tx, ty - 1) && !solid(level, tx, ty - 2)) rows.push(ty);
  }
  return rows;
}

/**
 * The whole-act quality gate every one of the campaign's acts must pass.
 * This is what lets forty-two levels be authored in parallel without any of
 * them shipping a dead end, a stall, a buried entity — or a flat corridor.
 */
export function checkAct(def: LevelDef): void {
  const level = new Level(def);
  const name = `${def.title}`;
  const W = level.map.w;
  const H = level.map.h;

  // --- Size: long enough to have a shape, tall enough to stack roads ---
  expect(W, `${name}: width`).toBeGreaterThanOrEqual(ACT.minWidth);
  expect(W, `${name}: width`).toBeLessThanOrEqual(ACT.maxWidth);
  expect(H, `${name}: height`).toBe(WORLD_ROWS);

  // --- Structure minimums ---
  expect(level.crystals, `${name}: crystals`).toHaveLength(5);
  expect(level.secrets, `${name}: secrets`).toHaveLength(3);
  expect(level.checkpoints.length, `${name}: checkpoints`).toBeGreaterThanOrEqual(ACT.checkpoints);
  expect(level.rings.length, `${name}: rings`).toBeGreaterThanOrEqual(ACT.rings);
  expect(level.monitors.length, `${name}: monitors`).toBeGreaterThanOrEqual(ACT.monitors);
  expect(
    level.enemies.length + level.drones.length + level.hoppers.length,
    `${name}: enemies`,
  ).toBeGreaterThanOrEqual(ACT.enemies);
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

  // --- Nothing bottomless: a missed jump costs time, never the run ---
  for (let tx = 0; tx < W; tx++) {
    expect(solid(level, tx, H - 1), `${name}: bottomless column ${tx}`).toBe(true);
  }

  // --- Speed is the terrain's to give ---
  const padLimit = level.boardPads.length > 0 ? ACT.dashPadsBoard : ACT.dashPads;
  expect(level.dashPads.length, `${name}: dash pads (earn speed from slopes instead)`).toBeLessThanOrEqual(padLimit);
  expect(level.loops.length, `${name}: loops (more than ${ACT.loops} is wallpaper)`).toBeLessThanOrEqual(ACT.loops);
  for (const loop of level.loops) {
    for (const ring of level.rings) {
      const d = Math.hypot(ring.x - loop.cx, ring.y - loop.cy);
      expect(d >= loop.innerR && d <= loop.outerR, `${name}: ring buried in loop wall`).toBe(false);
    }
    // Loop corridors solid on layer 0, hollow above.
    const cxTile = Math.floor(loop.cx / T);
    const surfaceRow = Math.floor((loop.cy + loop.innerR) / T);
    for (let dx = -6; dx <= 6; dx++) {
      expect(solid(level, cxTile + dx, surfaceRow), `${name}: loop corridor broken at ${cxTile + dx}`).toBe(true);
    }
    // The run-up is a downhill, not a booster.
    let highest = surfaceRow;
    for (let tx = cxTile - 30; tx < cxTile - 6; tx++) {
      for (const r of surfaces(level, tx)) if (r > surfaceRow - 14 && r < highest) highest = r;
    }
    expect(surfaceRow - highest, `${name}: loop at ${cxTile} has no downhill run-up`).toBeGreaterThanOrEqual(ACT.loopRunUp);
    for (const pad of level.dashPads) {
      const before = (loop.cx - pad.x) / T;
      expect(before > 0 && before < ACT.loopPadClear, `${name}: dash pad feeding the loop at ${cxTile}`).toBe(false);
    }
  }

  // --- Roads stacked over each other ---
  const end = Math.floor(finishLine(level) / T);
  let two = 0;
  let three = 0;
  for (let tx = 0; tx < end; tx++) {
    // Every surface found has standing room over it, so each one is a road.
    const tiers = surfaces(level, tx).length;
    if (tiers >= 2) two++;
    if (tiers >= 3) three++;
  }
  expect(two / end, `${name}: only ${Math.round((two / end) * 100)}% of the act has a second road`).toBeGreaterThanOrEqual(ACT.twoRoads);
  expect(three / end, `${name}: only ${Math.round((three / end) * 100)}% of the act has a third road`).toBeGreaterThanOrEqual(ACT.threeRoads);

  // --- Reachability flood fill (goal, crystals, secrets) ---
  const passable = (tx: number, ty: number) => {
    if (!level.map.inBounds(tx, ty)) return false;
    const t = level.map.get(tx, ty, 0);
    return t === TILES[TILE_EMPTY] || t.oneWay;
  };
  const seen = new Set<number>();
  const queue = [{ x: Math.floor(level.startPos.x / T), y: Math.floor(level.startPos.y / T) }];
  seen.add(queue[0].y * W + queue[0].x);
  while (queue.length) {
    const { x, y } = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const k = (y + dy) * W + (x + dx);
      if (!seen.has(k) && passable(x + dx, y + dy)) {
        seen.add(k);
        queue.push({ x: x + dx, y: y + dy });
      }
    }
  }
  const at = (x: number, y: number) => seen.has(Math.floor(y / T) * W + Math.floor(x / T));
  expect(at(level.goal.x, level.goal.y - 8), `${name}: goal unreachable`).toBe(true);
  level.crystals.forEach((c, i) => expect(at(c.x, c.y), `${name}: crystal ${i} unreachable @${Math.round(c.x / T)}`).toBe(true));
  level.secrets.forEach((s, i) => expect(at(s.x + s.w / 2, s.y + s.h / 2), `${name}: secret ${i} unreachable`).toBe(true));

  // --- ...and reachable by a PLAYER, not just by air (see reach.ts) ---
  // A ledge nobody can stand on is scenery, and a crystal on it is a lie.
  const can = reach(level);
  expect(
    can.deadLedges.map((l) => `${l.x0}-${l.x1}@${l.row}`),
    `${name}: ledges with no way onto them`,
  ).toEqual([]);
  level.crystals.forEach((c, i) => expect(can.canTake(c.x, c.y), `${name}: crystal ${i} out of reach @${Math.floor(c.x / T)},${Math.floor(c.y / T)}`).toBe(true));
  for (const m of level.monitors) expect(can.canTake(m.x, m.y), `${name}: monitor out of reach @${Math.floor(m.x / T)},${Math.floor(m.y / T)}`).toBe(true);

  // --- Every road leads to the goal: three ways of playing all arrive ---
  const naive = runBot(def, 'naive');
  expect(naive.player.dead, `${name}: naive bot died`).toBe(false);
  expect(naive.reached, `${name}: naive bot stopped at tile ${Math.round(naive.player.x / T)}`).toBe(true);
  expect(naive.worstStall, `${name}: naive bot pinned ${naive.worstStall} frames at tile ${naive.worstAt}`).toBeLessThan(150);
  expect(naive.avgSpeed, `${name}: too slow overall`).toBeGreaterThan(2.5);
  for (const style of ['faller', 'roller'] as const) {
    const r = runBot(def, style);
    expect(r.player.dead, `${name}: ${style} bot died`).toBe(false);
    expect(r.reached, `${name}: ${style} bot stopped at tile ${Math.round(r.player.x / T)}`).toBe(true);
    expect(r.worstStall, `${name}: ${style} bot pinned ${r.worstStall} frames at tile ${r.worstAt}`).toBeLessThan(240);
    // Rolling the slopes has to be worth it: that is where the speed is.
    if (style === 'roller') expect(r.topSpeed, `${name}: slopes never pay (roller top speed)`).toBeGreaterThan(9.5);
  }

  // --- Relief: the ground rises and falls ---
  // The ground line: the topmost solid (non-ledge) tile of every column.
  const ground: number[] = [];
  for (let tx = 0; tx < W; tx++) {
    let row = H;
    for (let ty = 0; ty < H; ty++) {
      const t = level.map.get(tx, ty, 0);
      if (!t.oneWay && t.heights.some((h) => h > 0)) {
        row = ty;
        break;
      }
    }
    ground.push(row);
  }
  const body = ground.slice(4, end);
  expect(Math.max(...body) - Math.min(...body), `${name}: the ground is flat (relief)`).toBeGreaterThanOrEqual(ACT.relief);
  let runStart = 0;
  for (let tx = 1; tx <= end - ACT.homeStraight; tx++) {
    if (ground[tx] === ground[runStart]) continue;
    const len = tx - runStart;
    expect(len, `${name}: ${len} level columns of ground from tile ${runStart}`).toBeLessThanOrEqual(ACT.flatRun);
    runStart = tx;
  }
  // A descent is a slope you can run or roll down: column after column, each
  // no more than a row below the last. Shafts and cliffs are not slopes.
  let descents = 0;
  let drop = 0;
  for (let tx = 1; tx < end; tx++) {
    const step = ground[tx] - ground[tx - 1];
    if (step >= 0 && step <= 1) {
      drop += step;
      continue;
    }
    if (drop >= ACT.descentRows) descents++;
    drop = 0;
  }
  if (drop >= ACT.descentRows) descents++;
  expect(descents, `${name}: downhill runs of ${ACT.descentRows}+ rows`).toBeGreaterThanOrEqual(ACT.descents);

  // --- Crystals live on more than one road ---
  const tierOf = (c: { x: number; y: number }) => {
    const dy = ground[Math.floor(c.x / T)] - c.y / T;
    return dy >= ACT.tierGap ? 'high' : dy < 0 ? 'low' : 'mid';
  };
  const used = new Set(level.crystals.map(tierOf));
  expect(used.size, `${name}: crystals all on one road (${[...used].join()})`).toBeGreaterThanOrEqual(2);

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
