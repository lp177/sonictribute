import { describe, it, expect } from 'vitest';
import { Level } from '../src/game/Level.ts';
import { TILES, TILE_EMPTY } from '../src/physics/TileMap.ts';
import { castGround } from '../src/physics/sensors.ts';
import { PHYS } from '../src/physics/constants.ts';
import { zone1 } from '../src/levels/zone1.ts';
import { Player } from '../src/game/Player.ts';
import { input } from './helpers.ts';

const T = PHYS.tile;

function makeLevel() {
  return new Level(zone1);
}

describe('Zone 1 — Verdant Rush (structure)', () => {
  const level = makeLevel();

  it('has all required features', () => {
    expect(level.startPos.x).toBeGreaterThan(0);
    expect(level.bossTriggerX).toBeGreaterThan(0);
    expect(level.goal.x).toBeGreaterThan(level.bossTriggerX);
    expect(level.crystals).toHaveLength(5);
    expect(level.secrets).toHaveLength(3);
    expect(level.loops).toHaveLength(3);
    expect(level.checkpoints.length).toBeGreaterThanOrEqual(2);
    expect(level.rings.length).toBeGreaterThan(50);
    expect(level.enemies.length).toBeGreaterThanOrEqual(4);
  });

  it('has a boss arena to the right of the trigger', () => {
    expect(level.arena.left).toBeGreaterThan(0);
    expect(level.arena.right).toBeGreaterThan(level.arena.left);
    expect(level.goal.x).toBeLessThanOrEqual(level.arena.right + 2 * T);
  });

  it('does not place entities inside solid ground', () => {
    const emptyAt = (x: number, y: number) => level.map.get(Math.floor(x / T), Math.floor(y / T), 0) === TILES[TILE_EMPTY];
    for (const r of level.rings) expect(emptyAt(r.x, r.y)).toBe(true);
    for (const c of level.crystals) expect(emptyAt(c.x, c.y)).toBe(true);
    for (const m of level.monitors) expect(emptyAt(m.x, m.y)).toBe(true);
    for (const e of level.enemies) expect(emptyAt(e.x, e.y)).toBe(true);
  });

  it('has solid loop corridors on layer 0 and annulus channels on layer 1', () => {
    for (const loop of level.loops) {
      const cxTile = Math.floor(loop.cx / T);
      const surfaceRow = Math.floor((loop.cy + loop.innerR) / T);
      // Straight corridor under the loop on layer 0.
      for (let dx = -6; dx <= 6; dx++) {
        expect(level.map.get(cxTile + dx, surfaceRow, 0).heights.some((h) => h > 0)).toBe(true);
      }
      // Annulus crown present on layer 1.
      const crown = level.map.get(cxTile, surfaceRow - 6, 1);
      expect(crown.heightsTop.some((h) => h > 0) || crown.heights.some((h) => h > 0)).toBe(true);
    }
  });
});

describe('Zone 1 — reachability (flood fill through open space)', () => {
  const level = makeLevel();

  function reachableCells(): Set<number> {
    const w = level.map.w;
    const passable = (tx: number, ty: number) => {
      if (!level.map.inBounds(tx, ty)) return false;
      const t = level.map.get(tx, ty, 0);
      return t === TILES[TILE_EMPTY] || t.oneWay;
    };
    const start = { x: Math.floor(level.startPos.x / T), y: Math.floor(level.startPos.y / T) };
    const seen = new Set<number>();
    const queue = [start];
    seen.add(start.y * w + start.x);
    while (queue.length) {
      const { x, y } = queue.pop()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        const key = ny * w + nx;
        if (!seen.has(key) && passable(nx, ny)) {
          seen.add(key);
          queue.push({ x: nx, y: ny });
        }
      }
    }
    return seen;
  }

  it('goal, boss trigger, crystals and secrets are all reachable from the start', () => {
    const w = level.map.w;
    const reach = reachableCells();
    const at = (x: number, y: number) => reach.has(Math.floor(y / T) * w + Math.floor(x / T));
    expect(at(level.goal.x, level.goal.y - 8)).toBe(true);
    expect(at(level.bossTriggerX, level.goal.y - 8)).toBe(true);
    for (const c of level.crystals) expect(at(c.x, c.y)).toBe(true);
    for (const s of level.secrets) expect(at(s.x + s.w / 2, s.y + s.h / 2)).toBe(true);
  });
});

describe('Zone 1 — gameplay integration', () => {
  it('collecting a ring updates score and counters', () => {
    const level = makeLevel();
    const p = new Player(level.rings[0].x, level.rings[0].y);
    const before = level.score;
    level.update(p);
    expect(p.rings).toBe(1);
    expect(level.score).toBe(before + 10);
    expect(level.ringsCollected).toBe(1);
  });

  it('taking damage scatters rings and marks tookDamage', () => {
    const level = makeLevel();
    const p = new Player(level.startPos.x, level.startPos.y);
    p.rings = 8;
    p.invuln = 0;
    // Drop the player onto the first enemy's position.
    const e = level.enemies[0];
    p.x = e.x;
    p.y = e.y;
    p.rolling = false;
    p.jumping = false;
    level.update(p);
    expect(p.rings).toBe(0);
    expect(level.tookDamage).toBe(true);
    expect(level.scattered.length).toBeGreaterThan(0);
  });

  it('boss spawns past the trigger; goal locked until boss defeated', () => {
    const level = makeLevel();
    const p = new Player(level.bossTriggerX + 4, 300);
    p.invuln = 99999; // keep the test deterministic (no deaths)
    level.update(p);
    expect(level.boss).not.toBeNull();

    // Goal does not trigger while the boss lives.
    p.x = level.goal.x + 4;
    p.y = level.goal.y - 20;
    level.update(p);
    expect(level.results).toBeNull();

    // Defeat the boss by stomping it 8 times.
    const boss = level.boss!;
    boss.phase = 'sway';
    for (let i = 0; i < 8; i++) {
      boss.invuln = 0;
      p.x = boss.x;
      p.y = boss.y;
      p.rolling = true;
      p.jumping = false;
      p.grounded = false;
      level.update(p);
    }
    expect(level.bossDefeated).toBe(true);

    p.x = level.goal.x + 4;
    level.update(p);
    expect(level.results).not.toBeNull();
    expect(level.results!.crystalsTotal).toBe(5);
    expect(level.results!.secretsTotal).toBe(3);
  });

  it('boss contact damage tracks tookDamage and scatters rings exactly once', () => {
    const level = makeLevel();
    const p = new Player(level.bossTriggerX + 4, 300);
    level.update(p); // spawn boss
    const boss = level.boss!;
    boss.phase = 'sway';
    p.rings = 9;
    p.invuln = 0;
    // Stand inside the pod body, not attacking.
    p.x = boss.x;
    p.y = boss.y;
    p.rolling = false;
    p.jumping = false;
    level.update(p);
    expect(p.rings).toBe(0);
    expect(level.tookDamage).toBe(true);
    expect(level.scattered.length).toBeGreaterThan(0);
  });

  it('respawns at the last checkpoint after dying', () => {
    const level = makeLevel();
    const cp = level.checkpoints[0];
    const p = new Player(cp.x + 2, cp.y - 40);
    level.update(p); // activates the checkpoint
    expect(cp.active).toBe(true);
    expect(level.respawnPos.x).toBe(cp.x);

    p.die();
    p.y = level.map.pixelH + 100; // fallen out of the world
    level.update(p);
    expect(p.dead).toBe(false);
    expect(p.x).toBe(cp.x);
  });

  it('simulates a bot speedrun: start -> first checkpoint without dying', () => {
    const level = makeLevel();
    const p = new Player(level.startPos.x, level.startPos.y);
    p.rings = 50; // buffer against mistakes
    const cpX = level.checkpoints[0].x;
    let frames = 0;
    let stall = 0;
    let lastX = p.x;
    // Spin dash at the start.
    p.update(level.map, input({ down: true, jump: true, jumpPressed: true }));
    for (let i = 0; i < 4; i++) p.update(level.map, input({ down: true, jump: true, jumpPressed: true }));
    p.update(level.map, input({}));
    while (p.x < cpX && frames < 7200 && !p.dead) {
      frames++;
      // Eyes: jump when the ground disappears just ahead.
      const groundAhead = castGround(level.map, p.x + 24, p.y + p.h + 8, 0, p.layer);
      const jump = p.grounded && !groundAhead;
      // Stalled (wall/steep slope): spin dash.
      if (p.x - lastX > 1) {
        stall = 0;
        lastX = p.x;
      } else {
        stall++;
      }
      if (stall > 60 && p.grounded && !p.spindashing) {
        for (let i = 0; i < 4; i++) p.update(level.map, input({ down: true, jump: true, jumpPressed: true }));
        p.update(level.map, input({}));
        stall = 0;
        continue;
      }
      p.update(level.map, input({ right: true, jump, jumpPressed: jump }));
      level.update(p);
      if (p.rings === 0) p.rings = 50; // keep the bot alive for the traversal check
    }
    expect(p.dead).toBe(false);
    expect(p.x).toBeGreaterThanOrEqual(cpX);
  });
});
