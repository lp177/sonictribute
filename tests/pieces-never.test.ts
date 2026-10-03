import { describe, it, expect } from 'vitest';
import { Level, LevelBuilder, type LevelDef } from '../src/game/Level.ts';
import { Player, NO_INPUT, type PlayerInput } from '../src/game/Player.ts';
import { PHYS } from '../src/physics/constants.ts';
import { WORLD_ROWS, LO, groundRow, highRoad, loopHill, rollingStart } from '../src/levels/sections.ts';
import {
  alcove,
  cartDrop,
  hangingRoof,
  hollowHall,
  lightBridge,
  loopWalk,
  onRamp,
  railDescent,
  railLift,
  valley,
} from '../src/levels/never/pieces.ts';
import { runBot } from './bots.ts';
import { input } from './helpers.ts';

const T = PHYS.tile;

function bench(build: (b: LevelBuilder) => void, width = 260): LevelDef {
  return { name: 'BENCH', act: 'ACT 1', title: 'bench', biome: 2, theme: 'crystal', width, height: WORLD_ROWS, build };
}

/**
 * Plays a bench from its start (or from `spawn`) with a scripted hand: `keys`
 * is asked every frame what to press. Returns the level, the hero, every event
 * the level raised, and what the ride looked like (rail speed, deepest point).
 */
function play(def: LevelDef, frames: number, keys: (p: Player, f: number) => Partial<PlayerInput>, spawn?: { col: number; row: number }) {
  const level = new Level(def);
  // No settling pass: a hero set down on hard light has only the level to stand on.
  const p = spawn ? new Player(spawn.col * T + T / 2, spawn.row * T - PHYS.heightRadius - 2) : new Player(level.startPos.x, level.startPos.y);
  p.rings = 10;
  const events: string[] = [];
  let railFrames = 0;
  let slowestOnRail = Infinity;
  let rodeCart = false;
  let deepest = 0;
  for (let f = 0; f < frames; f++) {
    p.update(level.map, input(keys(p, f)));
    events.push(...level.update(p));
    // The frame of the catch still carries the approach speed: the rail's own
    // pace starts with the first frame it carries.
    if (p.railing && railFrames++ > 0) slowestOnRail = Math.min(slowestOnRail, Math.abs(p.gsp));
    if (p.carting) rodeCart = true;
    deepest = Math.max(deepest, (p.y + p.h) / T);
  }
  return { level, p, events, railFrames, slowestOnRail, rodeCart, deepest, feet: (p.y + p.h) / T, col: p.x / T };
}

const holdRight = () => ({ right: true });

describe('railDescent: the road ends at a lip and a rail carries on', () => {
  // rollingStart ends at column 30, row 28: the lip is column 36, the rail's
  // tip column 76, the far bank row 40, the chasm floor row 45.
  const def = bench((b) => {
    let c = rollingStart(b, 0, 24);
    c = railDescent(b, c.endX, c.endRow, { span: 40, drop: 12, pit: 5, crabs: 0, prize: 'crystal' });
    alcove(b, 31, 35, 45);
    b.floor(c.endX, 259, c.endRow);
    b.goal(250, c.endRow);
  });

  it('running off the lip is boarding it: rail speed all the way, set down on the far bank', () => {
    // Let go of everything at the tip: where is the rider set down?
    let rode = false;
    const r = play(def, 400, (p) => {
      if (p.railing) rode = true;
      return { right: !rode || p.railing };
    });
    expect(r.railFrames).toBeGreaterThan(40);
    expect(r.slowestOnRail).toBeGreaterThanOrEqual(9);
    expect(r.feet).toBeCloseTo(40, 0); // on the bank, not in it
    expect(r.col).toBeGreaterThan(76); // past the tip
    expect(r.deepest).toBeLessThan(40.5); // and never went near the chasm floor
    expect(r.level.dashPads).toHaveLength(0);
  });

  it('jumping at the lip lands on the catwalk over it, and the catwalk leads to the prize', () => {
    let jumped = false;
    const r = play(def, 420, (p) => {
      const press = !jumped && p.grounded && p.x > 34.5 * T;
      if (press) jumped = true;
      return { right: true, jump: jumped && p.ysp < 0, jumpPressed: press };
    });
    expect(r.level.crystals[0].taken).toBe(true);
  });

  it('even a walker who keeps the direction held drifts onto the rail', () => {
    // Two tiles of run-up: he leaves the lip at a stroll, and air steering
    // carries him the four columns out to the rail's head.
    let rode = false;
    const lv = new Level(def);
    const p = new Player(34 * T + 8, 28 * T - 21);
    for (let i = 0; i < 40 && !p.grounded; i++) p.update(lv.map, NO_INPUT);
    for (let f = 0; f < 120; f++) {
      p.update(lv.map, input({ right: true }));
      lv.update(p);
      rode ||= p.railing;
    }
    expect(rode).toBe(true);
  });

  it('the chasm floor under the rail leads out', () => {
    // Dropped straight down past the rail's head (the direction let go at the lip).
    const r = runBot(def, 'faller', 3000, { col: 38, row: 45 });
    expect(r.road.get(50)).toBeCloseTo(45, 0); // walked the chasm floor
    expect(r.reached).toBe(true); // and its climb-out
    expect(r.worstStall).toBeLessThan(60);
  });

  it('a rail cannot be left downward: jump off it and it catches you again', () => {
    let jumped = false;
    const r = play(def, 400, (p) => {
      const press = !jumped && p.railing && p.x > 50 * T;
      if (press) jumped = true;
      return { right: true, jumpPressed: press };
    });
    expect(jumped).toBe(true);
    expect(r.deepest).toBeLessThan(40.5); // never reached the chasm floor (row 45)
  });

  it('alcove: walking BACK along the chasm floor finds the pocket under the lip', () => {
    const r = play(def, 240, () => ({ left: true }), { col: 44, row: 45 });
    expect(r.level.secrets[0].found).toBe(true);
  });
});

describe('railLift: a rail that runs uphill is a lift', () => {
  const def = bench((b) => {
    b.floor(0, 39, 44);
    b.start(4, 44);
    const c = railLift(b, 40, 44, { rise: 14, span: 24, top: 10 });
    expect(c.endRow).toBe(30);
    b.floor(c.endX, 259, c.endRow);
    b.goal(250, c.endRow);
  });

  it('the road walks onto it and is carried to the clifftop at rail speed', () => {
    const r = play(def, 400, holdRight);
    expect(r.railFrames).toBeGreaterThan(30);
    expect(r.slowestOnRail).toBeGreaterThanOrEqual(9);
    expect(r.feet).toBeCloseTo(30, 0);
    expect(r.col).toBeGreaterThan(68); // past the cliff edge, on top
  });

  it('all three bots get up it', () => {
    for (const style of ['naive', 'faller', 'roller'] as const) {
      const r = runBot(def, style, 3000);
      expect(r.reached, style).toBe(true);
      expect(r.worstStall, style).toBeLessThan(60);
    }
  });
});

describe('cartDrop: the only decision aboard is when to jump', () => {
  // Boarding ledge row 24, the chasm columns 25–48, far bank row 32, chasm
  // floor row 38, buffer column 55.
  const def = bench((b) => {
    b.floor(0, 19, 24);
    b.start(4, 24);
    const c = cartDrop(b, 20, 24, { span: 24, drop: 8, pit: 6, crabs: 0, prize: 'crystal' });
    b.floor(c.endX, 259, c.endRow);
    b.goal(250, c.endRow);
  });

  it('staying aboard costs one hit, and sets you down on the far bank', () => {
    const r = play(def, 420, holdRight);
    expect(r.rodeCart).toBe(true);
    expect(r.events.filter((e) => e === 'hurt')).toHaveLength(1);
    expect(r.p.dead).toBe(false);
    expect(r.feet).toBeCloseTo(32, 0);
    expect(r.col).toBeGreaterThan(48); // on the bank, not back in the chasm
  });

  it('a full jump out of the last stretch reaches the bail ledge and its prize, unhurt', () => {
    for (const before of [6, 10, 14]) {
      let jumped = false;
      const r = play(def, 300, (p) => {
        const press = !jumped && p.carting && p.x > (55 - before) * T;
        if (press) jumped = true;
        return { right: true, jump: jumped && p.ysp < 0, jumpPressed: press };
      });
      expect(r.events, `bailing ${before} columns out`).not.toContain('hurt');
      expect(r.level.crystals[0].taken, `bailing ${before} columns out`).toBe(true);
    }
  });

  it('the prize belongs to the cart: a jump from the bank under the ledge falls short of it', () => {
    let jumped = false;
    const r = play(
      def,
      200,
      (p) => {
        const press = !jumped && p.grounded;
        if (press) jumped = true;
        return { jump: p.ysp < 0, jumpPressed: press };
      },
      { col: 65, row: 32 }, // right under the crystal (buffer + 10)
    );
    expect(jumped).toBe(true);
    expect(r.level.crystals[0].taken).toBe(false);
  });

  it('jumping out early lands on the chasm floor, and the springs lift you out', () => {
    // A hop the moment the cart is over the chasm, then nothing but right.
    let jumped = false;
    const r = play(def, 500, (p) => {
      const press = !jumped && p.carting && p.x > 26 * T;
      if (press) jumped = true;
      return { right: true, jumpPressed: press };
    });
    expect(r.deepest).toBeGreaterThan(36); // down in the chasm (its floor is row 38), five rows under the bank
    expect(r.events).not.toContain('hurt');
    expect(r.feet).toBeCloseTo(32, 0);
    expect(r.col).toBeGreaterThan(48); // out of the chasm, on the far bank
    expect(runBot(def, 'naive', 3000).reached).toBe(true); // the bot that bails by reflex
  });

  it('a negative drop makes it a cart that climbs', () => {
    const up = bench((b) => {
      b.floor(0, 19, 40);
      b.start(4, 40);
      const c = cartDrop(b, 20, 40, { span: 16, drop: -7, pit: 13, crabs: 0 });
      expect(c.endRow).toBe(33);
      b.floor(c.endX, 259, c.endRow);
      b.goal(250, c.endRow);
    });
    for (const style of ['naive', 'faller', 'roller'] as const) expect(runBot(up, style, 4000).reached, style).toBe(true);
  });
});

describe('lightBridge: a floor that is only sometimes there', () => {
  const make = (sweep: boolean) =>
    bench((b) => {
      b.floor(0, 39, 30);
      b.start(4, 30);
      const c = lightBridge(b, 40, 30, { spans: 4, period: 160, sweep, crabs: 0 });
      b.floor(c.endX, 259, c.endRow);
      b.goal(250, c.endRow);
    });

  it('holds whoever stands on a lit span, and drops them on the chasm floor when it goes dark', () => {
    // The first span (columns 44–47) is lit for the first 80 frames.
    const lit = play(make(false), 40, () => ({}), { col: 45, row: 30 });
    expect(lit.feet).toBeCloseTo(30, 0);
    const dark = play(make(false), 150, () => ({}), { col: 45, row: 30 });
    expect(dark.feet).toBeCloseTo(36, 0);
    expect(dark.p.dead).toBe(false);
  });

  it('either way across leads on: the faller, who never waits for the light, still arrives', () => {
    for (const sweep of [false, true]) {
      for (const style of ['naive', 'faller', 'roller'] as const) {
        const r = runBot(make(sweep), style, 3000);
        expect(r.reached, `${style} sweep=${sweep}`).toBe(true);
        expect(r.worstStall, `${style} sweep=${sweep}`).toBeLessThan(120);
      }
    }
  });

  it('with sweep the spans light in sequence, two at a time', () => {
    const level = new Level(make(true));
    const p = new Player(level.startPos.x, level.startPos.y);
    for (let f = 0; f < 320; f++) {
      level.update(p);
      expect(level.phasePlats.filter((ph) => ph.solid)).toHaveLength(2);
    }
  });
});

describe('hollowHall: two halls and a floor of light between them', () => {
  // Upper floor row 30, lower hall floor row 39, panes at columns 45, 53, 61.
  const def = bench((b) => {
    b.floor(0, 39, 30);
    b.start(4, 30);
    const c = hollowHall(b, 40, 30, { len: 40, panes: 3, period: 160, spikes: 4, secret: true, prize: 'crystal' });
    b.floor(c.endX, 259, c.endRow);
    b.goal(250, c.endRow);
  });

  it('whoever falls through a dark pane takes the lower hall and is lifted out', () => {
    // Started in the first pane's well, as if it had just gone dark under him.
    // (A runner skims a dark pane like any four-column gap; it is the walker,
    // and whoever stops for the stalactites, that the floor gives way under.)
    const r = runBot(def, 'faller', 4000, { col: 46, row: 33 });
    const rows = [...r.road].filter(([col]) => col >= 44 && col < 78).map(([, row]) => row);
    expect(Math.max(...rows)).toBeCloseTo(30 + LO, 0);
    expect(r.level.secrets[0].found).toBe(true);
    expect(r.reached).toBe(true);
  });

  it('hopping the panes keeps you in the upper hall', () => {
    const r = runBot(def, 'naive', 4000);
    const rows = [...r.road].filter(([col]) => col >= 40 && col < 80).map(([, row]) => row);
    expect(Math.max(...rows)).toBeLessThan(31);
    expect(r.reached).toBe(true);
  });

  it('the roof hangs a spike over every pane and stops short of the lift out', () => {
    const b = new LevelBuilder(260, WORLD_ROWS);
    def.build(b);
    for (const pane of [45, 53, 61]) expect(b.stalactiteDefs.some((s) => Math.floor(s.x / T) === pane + 2)).toBe(true);
    expect(b.grid[23][70]).toBe('#');
    expect(b.grid[23][76]).toBe('.'); // open sky over the lift's shaft (columns 75–77)
  });
});

describe('hangingRoof: a roof that follows the road', () => {
  const ground = (b: LevelBuilder) => {
    rollingStart(b, 0, 24); // ends column 30, row 28
    b.floor(30, 39, 28);
    b.gentleDown(40, 28, 8);
    b.floor(56, 259, 36);
    b.goal(250, 36);
  };
  const def = bench((b) => {
    ground(b);
    hangingRoof(b, 36, 70, { spikes: 4, prize: 'rings10' });
  });

  it('rides seven rows over the road, down the slope with it', () => {
    const bare = new LevelBuilder(260, WORLD_ROWS);
    ground(bare);
    const roofed = new LevelBuilder(260, WORLD_ROWS);
    def.build(roofed);
    for (let x = 36; x <= 70; x++) expect(groundRow(roofed, x), `column ${x}`).toBe(groundRow(bare, x) - 7);
    expect(roofed.stalactiteDefs).toHaveLength(4);
  });

  it('its spikes are armed by a runner and fall behind them', () => {
    const r = play(def, 500, holdRight);
    expect(r.events).toContain('stalactite-warn');
    expect(r.events).not.toContain('hurt');
    expect(r.col).toBeGreaterThan(75);
  });

  it('its top is a road: a hero set down on it runs its length and comes off the far end', () => {
    const r = runBot(def, 'faller', 3000, { col: 38, row: 21 });
    expect(r.road.get(44)).toBeLessThan(23); // still on the roof over the slope
    expect(r.reached).toBe(true);
  });

  it('refuses to be hung over a step in the road, and says where', () => {
    const b = new LevelBuilder(260, WORLD_ROWS);
    b.floor(0, 50, 30);
    b.floor(51, 100, 20);
    expect(() => hangingRoof(b, 40, 60)).toThrow(/steps at column 51/);
  });
});

describe('Ways onto the high road', () => {
  it('loopWalk: a jump up at the top of the run-up, a level walk, and you are on the loop’s roof', () => {
    // The loop hill starts at column 30, row 24: the catwalk is row 19, and so is the roof.
    const def = bench((b) => {
      b.floor(0, 29, 24);
      b.start(4, 24);
      loopWalk(b, 30, 24, 6);
      const c = loopHill(b, 30, 24, { drop: 6, roof: 'crystal' });
      b.floor(c.endX, 259, c.endRow);
      b.goal(250, c.endRow);
    });
    let jumped = false;
    let onWalk = false;
    const r = play(def, 400, (p) => {
      const press = !jumped && p.grounded && p.x > 28 * T;
      if (press) jumped = true;
      if (jumped && p.grounded && Math.abs((p.y + p.h) / T - 19) < 0.2) onWalk = true;
      return { right: true, jump: jumped && p.ysp < 0, jumpPressed: press };
    });
    expect(onWalk).toBe(true);
    expect(r.level.crystals[0].taken).toBe(true); // walked onto the roof and through its prize
    // Without the jump the same hero just runs the loop.
    expect(play(def, 400, holdRight).level.crystals[0].taken).toBe(false);
  });

  it('onRamp: stand under the step, jump, and its spring puts you on a high road no jump reaches', () => {
    const def = bench((b) => {
      b.floor(0, 259, 40);
      b.start(4, 40);
      onRamp(b, 30);
      highRoad(b, 35, 80);
      b.goal(250, 40);
    });
    let pressed = false;
    let highest = 99;
    const r = play(
      def,
      260,
      (p, f) => {
        const press = !pressed && f > 2 && p.grounded;
        if (press) pressed = true;
        if (p.grounded) highest = Math.min(highest, (p.y + p.h) / T);
        // Straight up onto the step; once the spring has fired, lean right.
        return { jump: p.ysp < 0, jumpPressed: press, right: (p.y + p.h) / T < 34 };
      },
      { col: 31, row: 40 },
    );
    expect(r.level.springs).toHaveLength(1);
    expect(highest).toBeCloseTo(29, 0); // stood on a ledge eleven rows over the road
    // A plain jump from the road is nowhere near it.
    let j = false;
    const low = play(def, 120, (p, f) => {
      const press = !j && f > 2 && p.grounded;
      if (press) j = true;
      return { jump: p.ysp < 0, jumpPressed: press };
    }, { col: 40, row: 40 });
    expect(low.deepest).toBeCloseTo(40, 0);
    expect(low.feet).toBeCloseTo(40, 0);
  });
});

describe('valley: launchValley, with its climb-out repaired', () => {
  it('a slow walker on the valley floor gets out, even when the climb rises past the lower ledge', () => {
    // rollingStart ends at column 30, row 30: the valley floor is row 39 and
    // its climb-out starts at column 97.
    const def = bench((b) => {
      let c = rollingStart(b, 0, 26);
      c = valley(b, c.endX, c.endRow, { depth: 9, out: 13, crabs: 0, retrySpring: false });
      b.floor(c.endX, 259, c.endRow);
      b.goal(250, c.endRow);
    });
    // Parked at the foot of the climb: no run-up at all.
    const r = runBot(def, 'faller', 3000, { col: 95, row: 39 });
    expect(r.reached).toBe(true);
    expect(r.worstStall).toBeLessThan(60);
  });
});
