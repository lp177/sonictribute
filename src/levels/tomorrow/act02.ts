import type { LevelBuilder, LevelDef } from '../../game/Level.ts';
import {
  runway,
  rollersRun,
  corridorLoop,
  stackedChoice,
  phaseCrossing,
  leapOfFaith,
  sneakUnder,
  stalactiteGallery,
  secretPocket,
  hazardGauntlet,
  quarterPipeBowl,
  signpostFinish,
  canopyRun,
  underGallery,
} from '../motifs.ts';

const W = 336;

/**
 * NOON TOMORROW — ACT 2: the hard-light lesson. Two phase crossings on the
 * ground, ghost stairs in the sky, and the biome's first blind leap of faith
 * (ring-guided, mesa-landed, as always). Fast lane: SKY — the canopy runs
 * unbroken over the first two-thirds of the act.
 */
export const act02: LevelDef = {
  name: 'NOON TOMORROW',
  act: 'ACT 2',
  title: 'Hardlight Stairway',
  biome: 3,
  theme: 'neon',
  width: W,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: start apron
    b.start(4, 24);
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 10–31, crystal 1 (sky shelf)
    c = runway(b, c.endX, c.endRow, { len: 8, dashPad: true }); // 32–39
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 7, period: 190 }); // 40–56
    c = runway(b, c.endX, c.endRow, { len: 7, checkpoint: true, enemy: true }); // 57–63
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 64–93
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 170 }); // 94–111: a beat faster
    c = secretPocket(b, c.endX, c.endRow); // 112–121, crystal 2 (ground), secret 1
    c = runway(b, c.endX, c.endRow, { len: 8, dashPad: true }); // 122–129
    b.hopper(126, 24);
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 2, period: 160 }); // 130–145
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 146–157, crystal 3 (under), secret 2
    c = runway(b, c.endX, c.endRow, { len: 6, checkpoint: true }); // 158–163
    c = corridorLoop(b, c.endX, c.endRow); // 164–191
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 12, count: 2 }); // 192–203
    c = runway(b, c.endX, c.endRow, { len: 10, enemy: true }); // 204–213
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 24 }); // 214–245: the blind drop, to row 27
    c = runway(b, c.endX, c.endRow, { len: 8, rise: 3, checkpoint: true }); // 246–259, back to 24
    c = quarterPipeBowl(b, c.endX, c.endRow); // 260–273
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // 274–283, secret 3
    c = runway(b, c.endX, c.endRow, { len: 12, dashPad: true }); // 284–295
    const fin = signpostFinish(b, c.endX, c.endRow, { len: 40 }); // 296–335
    if (fin.endX !== W) throw new Error(`act02 chain ends at ${fin.endX}, not ${W}`);

    // Sky overlay — ends before the leap so its ring trail keeps clear air.
    // Lengths are 13k+8 so each run ends flush after its own last platform
    // and the chained seam stays a standard 5-tile hop.
    const s = canopyRun(b, 36, 10, { len: 112, crystal: true }); // crystal 4 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 60, crystal: true }); // crystal 5 (sky)
    b.phasePlatform(44, 48, 10, 200, 0);
    b.phasePlatform(57, 61, 10, 200, 100);
    // The ghost stairway: counter-phased steps climbing over the leap zone —
    // a skilled jumper can ride the blink upward instead of taking the drop.
    b.phasePlatform(210, 213, 14, 160, 0);
    b.phasePlatform(216, 219, 12, 160, 53);
    b.phasePlatform(222, 225, 10, 160, 106);
    b.drone(100, 6, 3);
    b.drone(220, 7, 3);

    // Undercity metro gallery — the real under route, carved LAST so it wins
    // over every ground fill. One corridor spans the act (rows 30-34); the
    // sneakUnder pocket at 148-155 merges into it as an alcove with its own
    // 2-wide shaft as a mid-act entrance. Drop shafts sit on plain floor:
    // 26 (under the stackedChoice upper shelf, clear of the crab at 18-24),
    // 122 (landing delivers you onto the dash pad at 125) and 290 (fed by
    // the pad at 287) — clear of the loop at 164-191, the leap zone at
    // 214-245 and the bowl at 260-273. Both phase pits keep their row-29
    // floors as a shell over the corridor roof.
    underGallery(b, 16, { len: 280, shafts: [10, 106, 274], hazards: 1, crystal: false });
  },
};
