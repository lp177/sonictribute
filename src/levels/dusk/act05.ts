import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  rollersRun,
  stackedChoice,
  corridorLoop,
  secretPocket,
  sneakUnder,
  hazardGauntlet,
  stalactiteGallery,
  phaseCrossing,
  quarterPipeBowl,
  leapOfFaith,
  signpostFinish,
  canopyRun,
} from '../motifs.ts';

/**
 * DUSKMERE COAST — ACT 5 — "Reefbowl Circuit"
 *
 * Quarter pipes take centre stage: two sunken half-pipe bowls to skate, and
 * a leap of faith off the last cliff. The bowls fling a fast runner into the
 * sky lane, making the canopy the reward line for keeping speed — the act is
 * a circuit of launch, glide, land, repeat.
 */
export const act05: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 5',
  title: 'Reefbowl Circuit',
  biome: 0,
  theme: 'verdant',
  width: 360,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: start apron
    b.start(4, 24);
    c = runway(b, c.endX, c.endRow, { len: 10, dashPad: true }); // 10–19
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 20–49
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 4 }); // 50–63: the first bowl
    c = runway(b, c.endX, c.endRow, { len: 10, checkpoint: true, enemy: true }); // 64–73
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 74–95, CRYSTAL 1 (sky shelf)
    c = corridorLoop(b, c.endX, c.endRow); // 96–123
    c = secretPocket(b, c.endX, c.endRow); // 124–133, CRYSTAL 2 + secret 1
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 16, count: 4 }); // 134–149
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 6 }); // 150–165: the wide bowl
    b.crystal(158, 26); // CRYSTAL 3 — hanging in the bowl's basin
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 166–173
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 160 }); // 174–191
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 192–203, CRYSTAL 4 (under) + secret 2
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 2, period: 150 }); // 204–219
    b.drone(210, 18, 4); // patrols the jump line over the gauntlet
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 22 }); // 220–249: blind drop to row 27
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 10, enemy: true }); // 250–265, back to 24
    c = secretPocket(b, c.endX, c.endRow, { reward: 'rings10' }); // 266–275, secret 3
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 276–305
    c = runway(b, c.endX, c.endRow, { len: 22 }); // 306–327
    signpostFinish(b, c.endX, c.endRow, { len: 32 }); // 328–359

    // Sky overlay — the landing net for both bowls' launches.
    const s = canopyRun(b, 98, 8, { len: 130, crystal: true }); // CRYSTAL 5 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 104 });
  },
};
