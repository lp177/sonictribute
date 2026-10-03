import { describe, it, expect } from 'vitest';
import { Level, type LevelDef, type LevelBuilder } from '../src/game/Level.ts';
import { Player, NO_INPUT } from '../src/game/Player.ts';
import { SFX_NAMES } from '../src/audio/sfx.ts';
import { makeFlatMap, spawnOnGround, input } from './helpers.ts';

/**
 * Events the game raises are the sound designer's cue sheet: every one of
 * them is forwarded verbatim to `Sfx.play`. These pin the ones that used to
 * be lost, doubled or never raised at all.
 */

function bench(build: (b: LevelBuilder) => void, extra: Partial<LevelDef> = {}): LevelDef {
  return { name: 'BENCH', act: 'ACT 1', title: 'bench', biome: 0, theme: 'verdant', width: 120, height: 40, build, ...extra };
}

function settle(level: Level): Player {
  const p = new Player(level.startPos.x, level.startPos.y);
  for (let i = 0; i < 40 && !p.grounded; i++) p.update(level.map, NO_INPUT);
  return p;
}

describe('skid', () => {
  it('sounds once when the hero digs his heels in against a real run', () => {
    const map = makeFlatMap(200, 20, 240);
    const p = spawnOnGround(map, 400, 240);
    p.gsp = 7;
    const heard: string[] = [];
    for (let f = 0; f < 30; f++) {
      p.update(map, input({ left: true }));
      heard.push(...p.events);
    }
    expect(heard.filter((e) => e === 'skid')).toHaveLength(1);
  });

  it('is silent for a turn at walking pace, and on the Mag-Board', () => {
    const map = makeFlatMap(200, 20, 240);
    const slow = spawnOnGround(map, 400, 240);
    slow.gsp = 2;
    slow.update(map, input({ left: true }));
    expect(slow.events).not.toContain('skid');
    const board = spawnOnGround(map, 400, 240);
    board.board = true;
    board.gsp = 8;
    board.update(map, input({ left: true }));
    expect(board.events).not.toContain('skid');
  });

  it('sounds again for the next skid', () => {
    const map = makeFlatMap(400, 20, 240);
    const p = spawnOnGround(map, 3000, 240);
    let skids = 0;
    for (let round = 0; round < 2; round++) {
      p.gsp = 7;
      for (let f = 0; f < 40; f++) {
        p.update(map, input({ left: true }));
        skids += p.events.filter((e) => e === 'skid').length;
      }
      for (let f = 0; f < 10; f++) p.update(map, NO_INPUT);
    }
    expect(skids).toBe(2);
  });
});

describe('level events', () => {
  it('a monitor reports the box breaking AND what was in it, where it stood', () => {
    for (const kind of ['rings10', 'shield', 'shoes'] as const) {
      const level = new Level(
        bench((b) => {
          b.floor(0, 119, 24);
          b.start(4, 24);
          b.monitor(10, 24, kind);
        }),
      );
      const p = settle(level);
      p.x = level.monitors[0].x;
      p.y = level.monitors[0].y;
      p.rolling = true;
      const ev = level.update(p);
      expect(ev).toEqual(expect.arrayContaining(['monitor', kind]));
      expect(level.eventSources.get('monitor')!.x).toBe(level.monitors[0].x);
    }
  });

  it('the boss arrives on a klaxon, once', () => {
    const level = new Level(
      bench(
        (b) => {
          b.floor(0, 119, 24);
          b.start(4, 24);
          b.boss(40, 36, 100);
          b.goal(110, 24);
        },
        { bossKind: 'pod' },
      ),
    );
    const p = settle(level);
    p.x = 41 * 16;
    const first = level.update(p);
    expect(first).toEqual(expect.arrayContaining(['boss', 'warning']));
    const later: string[] = [];
    for (let f = 0; f < 60; f++) later.push(...level.update(p));
    expect(later).not.toContain('warning');
    expect(later).not.toContain('boss');
  });

  it('an arena gate thuds on impact, not for as long as the hero leans on it', () => {
    const level = new Level(
      bench(
        (b) => {
          b.floor(0, 119, 24);
          b.start(4, 24);
          b.boss(40, 36, 100);
          b.goal(110, 24);
        },
        { bossKind: 'pod' },
      ),
    );
    const p = settle(level);
    p.x = 41 * 16;
    level.update(p);
    const heard: string[] = [];
    for (let f = 0; f < 200; f++) {
      p.x = 30 * 16; // shoved back against the left gate, every frame
      heard.push(...level.update(p));
    }
    expect(heard.filter((e) => e === 'gate-bump')).toHaveLength(1);
  });

  it('landing on a crumbling ledge is a landing the scene can hear', () => {
    const level = new Level(
      bench((b) => {
        b.floor(0, 119, 30);
        b.start(4, 30);
        b.crumble(20, 24, 22);
      }),
    );
    const p = settle(level);
    p.x = 22 * 16;
    p.y = 22 * 16 - p.h - 4;
    p.grounded = false;
    p.ysp = 3;
    const heard: string[] = [];
    for (let f = 0; f < 6; f++) {
      p.update(level.map, NO_INPUT);
      heard.push(...level.update(p));
    }
    expect(heard.filter((e) => e === 'land')).toHaveLength(1);
  });

  it('a crumbling ledge gives way under a hero who LANDED on it', () => {
    const level = new Level(
      bench((b) => {
        b.floor(0, 119, 34);
        b.start(4, 34);
        b.crumble(20, 24, 22);
      }),
    );
    const p = settle(level);
    p.x = 22 * 16;
    p.y = 22 * 16 - p.h - 4;
    p.grounded = false;
    p.ysp = 3;
    const heard: string[] = [];
    let stood = 0;
    for (let f = 0; f < 140; f++) {
      p.update(level.map, NO_INPUT);
      heard.push(...level.update(p));
      if (p.grounded && Math.abs(p.y + p.h - 22 * 16) < 2) stood++;
    }
    // It held him for its shake, said so, and let go: he is on the floor now.
    expect(stood).toBeGreaterThan(20);
    expect(heard).toContain('crumble');
    expect((p.y + p.h) / 16).toBeCloseTo(34, 0);
  });

  it('a rail does not board a hero who is being knocked back by a hit', () => {
    const level = new Level(
      bench((b) => {
        b.floor(0, 119, 30);
        b.start(4, 30);
        b.rail(20, 26, 60, 28);
      }),
    );
    const p = settle(level);
    p.rings = 5;
    p.x = 40 * 16;
    p.y = 26 * 16 - p.h - 30;
    p.grounded = false;
    p.hurt(p.x + 20); // thrown back to the left, falling toward the rail
    for (let f = 0; f < 25; f++) {
      p.update(level.map, NO_INPUT);
      level.update(p);
      expect(p.railing).toBe(false);
    }
  });

  it('every event the game raises has a sound', () => {
    // The names a play-through can raise; a typo here or there is silence.
    const raised = [
      'jump', 'land', 'land-hard', 'roll', 'unroll', 'skid', 'slide-off', 'dash-charge', 'dash-rev', 'dash',
      'hurt', 'die', 'respawn', 'ring', 'monitor', 'rings10', 'shield', 'shoes', 'shield-lost', 'crystal',
      'secret', 'checkpoint', 'goal', 'spring', 'launch', 'dash-pad', 'loop-boost', 'rail-on', 'rail-off',
      'glider', 'glide', 'glider-lost', 'board', 'board-end', 'board-lost', 'cart-board', 'cart-wreck',
      'cart-crash', 'enemy', 'hopper-stomp', 'crumble', 'phase-blink', 'spike-warn', 'spike-trap',
      'stalactite-warn', 'stalactite-fall', 'stalactite-shatter', 'boss', 'warning', 'gate-slam',
      'gate-open', 'gate-bump', 'boss-telegraph', 'boss-hit', 'boss-slam', 'boss-defeated',
      'yolk-laugh', 'yolk-sting', 'thunder', 'core-crack', 'beam', 'time-stop', 'whoosh', 'title-card',
    ];
    for (const name of raised) expect(SFX_NAMES, name).toContain(name);
  });
});
