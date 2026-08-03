import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  rollersRun,
  stackedChoice,
  corridorLoop,
  secretPocket,
  sneakUnder,
  hazardGauntlet,
  phaseCrossing,
  leapOfFaith,
  signpostFinish,
  canopyRun,
} from '../motifs.ts';

/**
 * DUSKMERE COAST — ACT 4 — "Hopper Shallows"
 *
 * Two debuts: the coiled hoppers (stompable, fixed deterministic arcs) bounce
 * across the tide flats, and the biome's first quarter-pipe appears as a
 * leap of faith — a blind ring-guided launch with a guaranteed safe landing.
 * The ground road is the fast lane again, but it is busier now: this is
 * where the biome's difficulty curve starts to bend upward.
 */
export const act04: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 4',
  title: 'Hopper Shallows',
  biome: 0,
  theme: 'verdant',
  width: 340,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: start apron
    b.start(4, 24);
    c = runway(b, c.endX, c.endRow, { len: 12, dashPad: true }); // 10–21

    // The hopper shallows (22–41): meet the new enemy on open, safe ground.
    // Hoppers are silent until stomped, so the idle-start contract holds.
    b.floor(22, 41, 24);
    b.hopper(28, 24);
    b.hopper(35, 24);
    b.ringsH(24, 39, 21);
    c = { endX: 42, endRow: 24 };

    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 42–63, CRYSTAL 1 (sky shelf)
    c = corridorLoop(b, c.endX, c.endRow); // 64–91
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 92–99
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 20 }); // 100–127: the blind drop, to row 27
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 10 }); // 128–143, back to row 24
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 2 }); // 144–159 (trap rhythm + hopper)
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 160–171, CRYSTAL 2 (under) + secret 1

    // Crumble shelf under a pendulum (172–191), with a crystal riding just
    // above the ledge — grab it before the floor lets go.
    b.floor(172, 191, 24);
    b.swingBall(177, 14, 9, 150, 0);
    b.crumble(180, 183, 20);
    b.ringsH(180, 183, 18);
    b.crystal(182, 18); // CRYSTAL 3 — over the crumble ledge
    b.hopper(188, 24);
    b.ringsH(173, 178, 21);
    c = { endX: 192, endRow: 24 };

    c = secretPocket(b, c.endX, c.endRow); // 192–201, CRYSTAL 4 + secret 2
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 202–231
    c = runway(b, c.endX, c.endRow, { len: 10, checkpoint: true, enemy: true }); // 232–241
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 170 }); // 242–259
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shoes' }); // 260–269, secret 3
    c = runway(b, c.endX, c.endRow, { len: 12 }); // 270–281
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 282–311
    signpostFinish(b, c.endX, c.endRow, { len: 28 }); // 312–339

    // Sky overlay, joined to the stacked-choice shelves.
    const s = canopyRun(b, 66, 9, { len: 130, crystal: true }); // CRYSTAL 5 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 117 });
  },
};
