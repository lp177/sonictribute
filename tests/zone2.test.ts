import { describe, it, expect } from 'vitest';
import { Level } from '../src/game/Level.ts';
import { TILES, TILE_EMPTY } from '../src/physics/TileMap.ts';
import { castGround } from '../src/physics/sensors.ts';
import { PHYS } from '../src/physics/constants.ts';
import { zone2 } from '../src/levels/zone2.ts';
import { Player, NO_INPUT } from '../src/game/Player.ts';
import { PressBoss } from '../src/game/PressBoss.ts';
import { input } from './helpers.ts';
import { hasCrown } from './loopHelpers.ts';

const T = PHYS.tile;

function makeLevel() {
  return new Level(zone2);
}

describe('Zone 2 — Cog Skyway (structure)', () => {
  const level = makeLevel();

  it('has all required features', () => {
    expect(level.theme).toBe('gear');
    expect(level.bossKind).toBe('press');
    expect(level.startPos.x).toBeGreaterThan(0);
    expect(level.bossTriggerX).toBeGreaterThan(0);
    expect(level.goal.x).toBeGreaterThan(level.bossTriggerX);
    expect(level.crystals).toHaveLength(5);
    expect(level.secrets).toHaveLength(3);
    expect(level.loops).toHaveLength(2);
    expect(level.checkpoints.length).toBeGreaterThanOrEqual(3);
    expect(level.rings.length).toBeGreaterThan(50);
    expect(level.enemies.length).toBeGreaterThanOrEqual(3);
  });

  it('introduces the zone-specific mechanisms', () => {
    expect(level.dashPads.length).toBeGreaterThanOrEqual(5);
    expect(level.drones.length).toBeGreaterThanOrEqual(4);
    expect(level.boardPads).toHaveLength(1);
    // The ride starts at the pad and ends at the dismount line, well before the boss.
    expect(level.boardEndX).toBeGreaterThan(level.boardPads[0].x);
    expect(level.boardEndX).toBeLessThan(level.bossTriggerX);
    // Discovery order: first dash pad comes before the board pad.
    const firstPad = Math.min(...level.dashPads.map((d) => d.x));
    expect(firstPad).toBeLessThan(level.boardPads[0].x);
  });

  it('does not place entities inside solid ground', () => {
    const emptyAt = (x: number, y: number) => level.map.get(Math.floor(x / T), Math.floor(y / T), 0) === TILES[TILE_EMPTY];
    for (const r of level.rings) expect(emptyAt(r.x, r.y)).toBe(true);
    for (const c of level.crystals) expect(emptyAt(c.x, c.y)).toBe(true);
    for (const m of level.monitors) expect(emptyAt(m.x, m.y)).toBe(true);
    for (const e of level.enemies) expect(emptyAt(e.x, e.y)).toBe(true);
    for (const d of level.drones) expect(emptyAt(d.x, d.y)).toBe(true);
    for (const d of level.dashPads) expect(emptyAt(d.x, d.y)).toBe(true);
    for (const b of level.boardPads) expect(emptyAt(b.x, b.y)).toBe(true);
  });

  it('has solid loop corridors on layer 0 and annulus channels on layer 1', () => {
    for (const loop of level.loops) {
      const cxTile = Math.floor(loop.cx / T);
      const surfaceRow = Math.floor((loop.cy + loop.innerR) / T);
      for (let dx = -6; dx <= 6; dx++) {
        expect(level.map.get(cxTile + dx, surfaceRow, 0).heights.some((h) => h > 0)).toBe(true);
      }
      expect(hasCrown(level, loop)).toBe(true);
    }
  });

  it('every skyway gap has an escape spring', () => {
    // Gaps are the pits between the upper floor segments (surface row 21,
    // pit floor row 26): each must contain an upward spring.
    const gaps: [number, number][] = [
      [101, 107],
      [116, 122],
      [131, 137],
    ];
    for (const [x0, x1] of gaps) {
      const has = level.springs.some((s) => s.dir === 'up' && s.x > x0 * T && s.x < (x1 + 1) * T && s.y > 24 * T);
      expect(has).toBe(true);
    }
  });
});

describe('Zone 2 — reachability (flood fill through open space)', () => {
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

  it('goal, boss trigger, crystals, secrets and the board pad are reachable', () => {
    const w = level.map.w;
    const reach = reachableCells();
    const at = (x: number, y: number) => reach.has(Math.floor(y / T) * w + Math.floor(x / T));
    expect(at(level.goal.x, level.goal.y - 8)).toBe(true);
    expect(at(level.bossTriggerX, level.goal.y - 8)).toBe(true);
    for (const c of level.crystals) expect(at(c.x, c.y)).toBe(true);
    for (const s of level.secrets) expect(at(s.x + s.w / 2, s.y + s.h / 2)).toBe(true);
    expect(at(level.boardPads[0].x, level.boardPads[0].y)).toBe(true);
  });
});

describe('Zone 2 — gameplay integration', () => {
  it('crossing the board pad mounts the Mag-Board', () => {
    const level = makeLevel();
    const pad = level.boardPads[0];
    const p = new Player(pad.x, pad.y);
    const events = level.update(p);
    expect(p.board).toBe(true);
    expect(events).toContain('board');
  });

  it('spawns the Piston Crusher past the trigger; goal locked until it falls', () => {
    const level = makeLevel();
    const p = new Player(level.bossTriggerX + 4, 300);
    p.invuln = 99999;
    level.update(p);
    expect(level.boss).toBeInstanceOf(PressBoss);
    const boss = level.boss as PressBoss;
    expect(boss.kind).toBe('press');

    p.x = level.goal.x + 4;
    p.y = level.goal.y - 20;
    level.update(p);
    expect(level.results).toBeNull();

    // Defeat it by striking during each open window.
    for (let i = 0; i < boss.maxHp; i++) {
      boss.phase = 'open';
      boss.y = boss.groundY - 18;
      boss.invuln = 0;
      boss.timer = 0;
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

  it('a drone hit scatters rings and marks tookDamage', () => {
    const level = makeLevel();
    const d = level.drones[0];
    const p = new Player(d.x, d.y);
    p.rings = 6;
    level.update(p);
    expect(p.rings).toBe(0);
    expect(level.tookDamage).toBe(true);
    expect(level.scattered.length).toBeGreaterThan(0);
  });

  it('a stomped drone scores like a badnik', () => {
    const level = makeLevel();
    const d = level.drones[0];
    const p = new Player(d.x, d.y);
    p.jumping = true;
    p.grounded = false;
    const before = level.score;
    const events = level.update(p);
    expect(d.alive).toBe(false);
    expect(level.score).toBe(before + 100);
    expect(events).toContain('enemy');
  });

  it("forwards the boss's own events so slam shake and sfx can fire", () => {
    const level = makeLevel();
    const p = new Player(level.bossTriggerX + 4, 300);
    p.invuln = 99999;
    level.update(p);
    const boss = level.boss as PressBoss;
    boss.phase = 'hover';
    boss.y = boss.homeY;
    boss.timer = 111; // about to telegraph
    const seen: string[] = [];
    for (let i = 0; i < 200; i++) {
      p.x = level.arena.left + 20; // stay clear so contacts do not interfere
      p.y = 300;
      seen.push(...level.update(p));
      if (seen.includes('boss-slam')) break;
    }
    expect(seen).toContain('boss-telegraph');
    expect(seen).toContain('boss-slam');
  });

  it('rides the Mag-Board across the whole skyway and dismounts at the line', () => {
    const level = makeLevel();
    const pad = level.boardPads[0];
    // Start grounded just before the pad, on the skyway floor.
    const p = new Player(pad.x - 48, 21 * T - PHYS.heightRadius - 2);
    for (let i = 0; i < 40 && !p.grounded; i++) p.update(level.map, NO_INPUT);
    expect(p.grounded).toBe(true);

    let mounted = false;
    let dismounted = false;
    let ridingAtGaps = 0;
    let frames = 0;
    while (frames < 4000 && !p.dead && !dismounted) {
      frames++;
      // Jump when the ground runs out just ahead.
      const groundAhead = castGround(level.map, p.x + 28, p.y + p.h + 8, 0, p.layer);
      const jump = p.grounded && !groundAhead;
      p.update(level.map, input({ right: true, jump, jumpPressed: jump }));
      const events = level.update(p);
      if (events.includes('board')) mounted = true;
      if (events.includes('board-end')) dismounted = true;
      // Count frames spent boarded while over the gap region.
      if (p.board && p.x > 101 * T && p.x < 138 * T) ridingAtGaps++;
    }

    expect(mounted).toBe(true);
    expect(dismounted).toBe(true);
    expect(p.dead).toBe(false);
    expect(p.x).toBeGreaterThanOrEqual(level.boardEndX);
    // It genuinely crossed the gap section on the board, not on foot.
    expect(ridingAtGaps).toBeGreaterThan(20);
  });

  it('simulates a bot run: start -> past the Mag-Board section without dying', () => {
    const level = makeLevel();
    const p = new Player(level.startPos.x, level.startPos.y);
    p.rings = 50;
    const targetX = level.checkpoints[1].x; // after the dismount line
    let frames = 0;
    let stall = 0;
    let lastX = p.x;
    p.update(level.map, input({ down: true, jump: true, jumpPressed: true }));
    for (let i = 0; i < 4; i++) p.update(level.map, input({ down: true, jump: true, jumpPressed: true }));
    p.update(level.map, input({}));
    while (p.x < targetX && frames < 9000 && !p.dead) {
      frames++;
      const groundAhead = castGround(level.map, p.x + 24, p.y + p.h + 8, 0, p.layer);
      const jump = p.grounded && !groundAhead;
      if (p.x - lastX > 1) {
        stall = 0;
        lastX = p.x;
      } else {
        stall++;
      }
      if (stall > 60 && p.grounded && !p.spindashing && !p.board) {
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
    expect(p.x).toBeGreaterThanOrEqual(targetX);
  });
});
