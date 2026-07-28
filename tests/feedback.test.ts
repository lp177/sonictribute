import { describe, it, expect } from 'vitest';
import { Level } from '../src/game/Level.ts';
import { LEVELS } from '../src/levels/index.ts';
import { zone1 } from '../src/levels/zone1.ts';
import { Player, NO_INPUT } from '../src/game/Player.ts';
import { FxSystem } from '../src/render/fx.ts';

describe('Doing nothing produces nothing', () => {
  it.each(LEVELS.map((d) => [d.name, d] as const))(
    '%s is silent while the hero stands still',
    (_name, def) => {
      // Regression: hazards run on their own clocks all over the level. They
      // used to announce themselves from anywhere, so the player heard a
      // meaningless blip every couple of seconds and saw the sparks burst
      // out of the hero, no matter what they were doing.
      const level = new Level(def);
      const p = new Player(level.startPos.x, level.startPos.y);
      for (let i = 0; i < 40 && !p.grounded; i++) p.update(level.map, NO_INPUT);
      const heard: string[] = [];
      for (let f = 0; f < 900; f++) {
        p.update(level.map, NO_INPUT);
        heard.push(...level.update(p));
      }
      expect(heard, `idle hero triggered: ${[...new Set(heard)].join(', ')}`).toEqual([]);
    },
  );

  it('an effect belongs to the thing that caused it, not to the hero', () => {
    const level = new Level(zone1);
    const trap = level.traps[0];
    // Stand the player well away from the trap but inside earshot.
    const p = new Player(trap.x - 200, trap.y - 40);
    let sawSourced = false;
    for (let f = 0; f < 400; f++) {
      const evs = level.update(p);
      for (const ev of evs) {
        if (ev === 'spike-warn' || ev === 'spike-trap') {
          const src = level.eventSources.get(ev);
          expect(src, `${ev} reported no position`).toBeDefined();
          // At a trap, not at the hero. (Traps placed side by side share the
          // event name, so the position is one of them — either is correct.)
          expect(level.traps.some((t) => t.x === src!.x)).toBe(true);
          expect(src!.x).not.toBe(p.x);
          sawSourced = true;
        }
      }
    }
    expect(sawSourced).toBe(true);
  });

  it('a hazard far across the level stays quiet', () => {
    const level = new Level(zone1);
    // Somewhere with no trap within earshot.
    const spot = 100;
    expect(level.traps.every((t) => Math.abs(t.x - spot) > 600)).toBe(true);
    const p = new Player(spot, 300);
    const heard: string[] = [];
    for (let f = 0; f < 400; f++) heard.push(...level.update(p));
    expect(heard.filter((e) => e.startsWith('spike'))).toEqual([]);
  });
});

describe('Damage and death never spiral', () => {
  /** Runs the real scene loop, including the hit-stop freeze gate. */
  function sceneLoop(frames: number, park: (p: Player, level: Level) => void) {
    const level = new Level(zone1);
    const fx = new FxSystem();
    const p = new Player(level.bossTriggerX + 4, 300);
    level.update(p);
    const boss = level.boss!;
    boss.phase = 'sway';
    p.rings = 20;
    p.invuln = 0;

    const tally: Record<string, number> = {};
    let frozen = 0;
    for (let f = 0; f < frames; f++) {
      if (fx.tickFreeze()) {
        frozen++;
        continue;
      }
      fx.update();
      p.update(level.map, NO_INPUT);
      park(p, level);
      for (const ev of level.update(p)) {
        tally[ev] = (tally[ev] ?? 0) + 1;
        fx.onEvent(ev, p.x, p.y);
      }
    }
    return { tally, frozen, p, level };
  }

  it('reports a death exactly once, however long the corpse lies in the hazard', () => {
    // Regression: 'die' was re-emitted every frame the dead player still
    // overlapped a hazard. Each one re-triggered hit-stop, so the game froze
    // solid and the player could do nothing.
    const r = sceneLoop(400, (p, level) => {
      const m = (level.boss as unknown as { macePos(): { x: number; y: number } }).macePos();
      p.x = m.x;
      p.y = m.y;
    });
    expect(r.tally['die'] ?? 0).toBe(1);
    expect(r.p.dead).toBe(true);
  });

  it('never freezes the world for a meaningful share of the time', () => {
    const r = sceneLoop(400, (p, level) => {
      const m = (level.boss as unknown as { macePos(): { x: number; y: number } }).macePos();
      p.x = m.x;
      p.y = m.y;
    });
    // Taking damage must not cost the player control.
    expect(r.frozen).toBeLessThan(20);
  });

  it('gives full invulnerability frames between hits', () => {
    const r = sceneLoop(300, (p, level) => {
      const m = (level.boss as unknown as { macePos(): { x: number; y: number } }).macePos();
      p.x = m.x;
      p.y = m.y;
    });
    // One ring loss, then the i-frames must hold until they run out.
    expect(r.tally['hurt'] ?? 0).toBe(1);
  });
});

describe('FxSystem — hit-stop is for hits you land', () => {
  it('does not freeze the world when the player is hurt or killed', () => {
    const hurt = new FxSystem();
    hurt.onEvent('hurt', 0, 0);
    expect(hurt.hitStop).toBe(0);
    const died = new FxSystem();
    died.onEvent('die', 0, 0);
    expect(died.hitStop).toBe(0);
  });

  it('still freezes when the player connects', () => {
    const fx = new FxSystem();
    fx.onEvent('boss-hit', 0, 0);
    expect(fx.hitStop).toBeGreaterThan(0);
  });

  it('still gives shake and a flash for damage feedback', () => {
    const fx = new FxSystem();
    fx.onEvent('hurt', 0, 0);
    expect(fx.shakeMag).toBeGreaterThan(0);
    expect(fx.flashFrames).toBeGreaterThan(0);
  });

  it('caps the freeze no matter how many impacts stack in one frame', () => {
    const fx = new FxSystem();
    for (let i = 0; i < 50; i++) {
      fx.onEvent('boss-defeated', 0, 0);
      fx.onEvent('boss-hit', 0, 0);
      fx.onEvent('enemy', 0, 0);
    }
    expect(fx.hitStop).toBeLessThanOrEqual(12);
    let frames = 0;
    while (fx.tickFreeze()) frames++;
    expect(frames).toBeLessThanOrEqual(12);
  });
});
