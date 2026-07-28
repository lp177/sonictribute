import { describe, it, expect } from 'vitest';
import { Player, BOARD, NO_INPUT } from '../src/game/Player.ts';
import { DashPad, BoardPad, BuzzDrone } from '../src/game/entities.ts';
import { Level } from '../src/game/Level.ts';
import { zone2 } from '../src/levels/zone2.ts';
import { PHYS } from '../src/physics/constants.ts';
import { makeFlatMap, spawnOnGround, input, run } from './helpers.ts';

describe('Mag-Board (vehicle)', () => {
  it('mounts from a BoardPad exactly once', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    const pad = new BoardPad(200, 240 - 14);
    expect(pad.tryMount(p)).toBe(true);
    expect(p.board).toBe(true);
    expect(pad.tryMount(p)).toBe(false); // already riding
  });

  it('does not mount from out of range', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    const pad = new BoardPad(400, 240 - 14);
    expect(pad.tryMount(p)).toBe(false);
    expect(p.board).toBe(false);
  });

  it('enforces a forward minimum speed, even against input', () => {
    const map = makeFlatMap(200, 20, 240);
    const p = spawnOnGround(map, 200, 240);
    p.mountBoard();
    run(map, p, 30);
    expect(p.gsp).toBeGreaterThanOrEqual(BOARD.min);
    const x0 = p.x;
    run(map, p, 30, input({ left: true }));
    expect(p.gsp).toBeGreaterThanOrEqual(BOARD.min);
    expect(p.x).toBeGreaterThan(x0);
    expect(p.facing).toBe(1);
  });

  it('keeps rolling and spin dash available while riding', () => {
    // The board is a pickup, not a downgrade: it must never remove a core
    // ability. Rolling is how the hero attacks and ducks.
    const map = makeFlatMap(200, 20, 240);
    const p = spawnOnGround(map, 200, 240);
    p.mountBoard();
    run(map, p, 20, input({ down: true }));
    expect(p.rolling).toBe(true);
    expect(p.board).toBe(true); // and you are still on the board
    expect(p.attacking).toBe(true);

    const q = spawnOnGround(map, 200, 240);
    q.mountBoard();
    q.gsp = 0;
    q.update(map, input({ down: true, jump: true, jumpPressed: true }));
    expect(q.spindashing).toBe(true);
  });

  it('keeps the board through a jump and landing', () => {
    const map = makeFlatMap(200, 20, 240);
    const p = spawnOnGround(map, 200, 240);
    p.mountBoard();
    run(map, p, 10);
    p.update(map, input({ jump: true, jumpPressed: true }));
    expect(p.grounded).toBe(false);
    expect(p.board).toBe(true);
    run(map, p, 120);
    expect(p.grounded).toBe(true);
    expect(p.board).toBe(true);
    expect(p.gsp).toBeGreaterThanOrEqual(BOARD.min);
  });

  it('absorbs one hit: board lost, rings and shield kept', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    p.mountBoard();
    p.rings = 7;
    p.shield = true;
    const lost = p.hurt(p.x + 10);
    expect(lost).toBe(0);
    expect(p.board).toBe(false);
    expect(p.rings).toBe(7);
    expect(p.shield).toBe(true);
    expect(p.invuln).toBeGreaterThan(0);
    expect(p.events).toContain('board-lost');
  });

  it('dismounts with a hop at the level dismount line', () => {
    const level = new Level(zone2);
    const p = new Player(level.boardEndX + 8, 21 * PHYS.tile - PHYS.heightRadius - 2);
    for (let i = 0; i < 30 && !p.grounded; i++) p.update(level.map, NO_INPUT);
    expect(p.grounded).toBe(true);
    p.mountBoard();
    const events = level.update(p);
    expect(p.board).toBe(false);
    expect(events).toContain('board-end');
    // The hop is what sells the dismount: it must actually leave the ground.
    expect(p.grounded).toBe(false);
    expect(p.ysp).toBe(-BOARD.hop);
  });

  it('dismounting in mid-air keeps the existing trajectory', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    p.mountBoard();
    p.grounded = false;
    p.ysp = 5; // falling
    p.xsp = 9;
    p.dismountBoard();
    expect(p.board).toBe(false);
    expect(p.ysp).toBe(5); // no upward pop mid-fall
    expect(p.xsp).toBe(9);
  });

  it('level tracks a board hit as damage without scattering rings', () => {
    const level = new Level(zone2);
    const s = level.spikes[0];
    const p = new Player(s.x, s.y - 4);
    p.mountBoard();
    p.rings = 9;
    const events = level.update(p);
    expect(p.board).toBe(false);
    expect(p.rings).toBe(9);
    expect(level.tookDamage).toBe(true);
    expect(level.scattered).toHaveLength(0);
    // The level's own stream must carry it: `player.events` is wiped at the
    // start of the next player update, so the scene never sees it there.
    expect(events).toContain('board-lost');
  });

  it('a shield hit reaches the level event stream too', () => {
    const level = new Level(zone2);
    const s = level.spikes[0];
    const p = new Player(s.x, s.y - 4);
    p.shield = true;
    p.rings = 9;
    const events = level.update(p);
    expect(p.shield).toBe(false);
    expect(p.rings).toBe(9);
    expect(events).toContain('shield-lost');
  });

  it('respawning clears the board', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    p.mountBoard();
    p.respawn(100, 100);
    expect(p.board).toBe(false);
  });
});

describe('DashPad', () => {
  it('boosts a grounded player in its direction', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    const pad = new DashPad(200, 240 - 6, 1, 10);
    expect(pad.tryTrigger(p)).toBe(true);
    expect(p.gsp).toBe(10);
    expect(p.facing).toBe(1);
  });

  it('never slows a player already faster than its power', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    p.gsp = 12;
    const pad = new DashPad(200, 240 - 6, 1, 10);
    pad.tryTrigger(p);
    expect(p.gsp).toBe(12);
  });

  it('ignores airborne players and respects its cooldown', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    const pad = new DashPad(200, 240 - 6, 1, 10);
    p.grounded = false;
    expect(pad.tryTrigger(p)).toBe(false);
    p.grounded = true;
    expect(pad.tryTrigger(p)).toBe(true);
    p.gsp = 0;
    expect(pad.tryTrigger(p)).toBe(false); // cooling down
    for (let i = 0; i < 20; i++) pad.update();
    expect(pad.tryTrigger(p)).toBe(true);
  });

  it('boosts leftwards when mirrored', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    const pad = new DashPad(200, 240 - 6, -1, 10);
    pad.tryTrigger(p);
    expect(p.gsp).toBe(-10);
    expect(p.facing).toBe(-1);
  });

  it('still boosts a rolling player (pads launch rolls into loops)', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    p.gsp = 3;
    p.rolling = true;
    const pad = new DashPad(200, 240 - 6, 1, 11);
    expect(pad.tryTrigger(p)).toBe(true);
    expect(p.gsp).toBe(11);
    expect(p.rolling).toBe(true); // a pad must not uncurl you
  });

  it('still boosts a boarded player past the board minimum', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    p.mountBoard();
    p.gsp = BOARD.min;
    const pad = new DashPad(200, 240 - 6, 1, 11);
    expect(pad.tryTrigger(p)).toBe(true);
    expect(p.gsp).toBe(11);
    expect(p.board).toBe(true);
  });
});

describe('BuzzDrone', () => {
  it('patrols deterministically within its range', () => {
    const d = new BuzzDrone(400, 200, 48);
    let minX = d.x;
    let maxX = d.x;
    for (let i = 0; i < 700; i++) {
      d.update();
      minX = Math.min(minX, d.x);
      maxX = Math.max(maxX, d.x);
    }
    expect(minX).toBeGreaterThanOrEqual(400 - 48 - 0.001);
    expect(maxX).toBeLessThanOrEqual(400 + 48 + 0.001);
    expect(maxX - minX).toBeGreaterThan(48); // it actually moves
    expect(Math.abs(d.y - 200)).toBeLessThanOrEqual(5.001);
  });

  it('dies to an attacking player and bounces them', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    const d = new BuzzDrone(p.x, p.y, 0);
    p.jumping = true;
    p.grounded = false;
    expect(d.interact(p)).toBe('kill');
    expect(d.alive).toBe(false);
    expect(p.ysp).toBeLessThan(0); // bounced
    expect(d.interact(p)).toBeNull(); // dead drones are harmless
  });

  it('reports a hit on a non-attacking player', () => {
    const map = makeFlatMap();
    const p = spawnOnGround(map, 200, 240);
    const d = new BuzzDrone(p.x, p.y, 0);
    expect(d.interact(p)).toBe('hurt');
  });
});
