import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  rollersRun,
  phaseCrossing,
  stackedChoice,
  corridorLoop,
  sneakUnder,
  railCascade,
  hazardGauntlet,
  secretPocket,
  leapOfFaith,
  cartCanyon,
  signpostFinish,
  canopyRun,
  underGallery,
} from '../motifs.ts';

/**
 * MIDNIGHT ACT 9 — "Shift-Change Catwalks"
 *
 * The whole act is timed to the shift bell: three phase crossings, each wider
 * and quicker than the last, teach the counter-phased rhythm the hard way.
 * Between bells: a grind cascade, a full-density trap row, and the biome's
 * longest leap of faith gliding down onto the last crossing's far side.
 */
export const midnight09: LevelDef = {
  name: 'OTHERWHILE FOUNDRY',
  act: 'ACT 9',
  title: 'Shift-Change Catwalks',
  biome: 1,
  theme: 'gear',
  width: 380,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: the bell tower gate
    b.start(4, 24);
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 10–39
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 170 }); // 40–57: first bell
    b.drone(47, 20, 2); // patrols the pit under the hard light
    c = stackedChoice(b, c.endX, c.endRow, { len: 24, crystal: true }); // 58–81, crystal 1 (sky shelf)
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 82–89
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 150 }); // 90–108: second bell, wider
    b.drone(98, 20, 2);
    c = corridorLoop(b, c.endX, c.endRow, { drop: 2, corridor: 22 }); // 109–138
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shoes' }); // 139–148, secret 1 (monitor first)
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 5 }); // 151–161, up to row 21
    c = railCascade(b, c.endX, c.endRow); // 162–192, grind down to row 27
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6 }); // 193–204, back to row 24
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 18, density: 3, period: 120 }); // 205–222
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // crystal 3 (under), secret 2
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 140 }); // 233–251: third bell, fastest
    c = secretPocket(b, c.endX, c.endRow); // crystal (ground), secret 3
    c = leapOfFaith(b, c.endX, c.endRow, { drop: 3, glide: 26 }); // 262–295: glide past the bells
    b.crystal(281, 8); // 4 (sky) — above the catwalk at the top of the arc
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 8, checkpoint: true, enemy: true }); // 296–309
    c = cartCanyon(b, c.endX, c.endRow, { gap: 7 }); // 310–329
    b.drone(318, 21, 2);
    signpostFinish(b, c.endX, c.endRow, { len: 50 }); // 330–379

    // Sky overlay at row 10 — always solid, the reward for climbing out of
    // the phase rhythm altogether.
    let s = canopyRun(b, 64, 10, { len: 104, crystal: true }); // crystal 5 (sky)
    s = canopyRun(b, s.endX, s.endRow, { len: 104 });
    canopyRun(b, s.endX, s.endRow, { len: 78 });

    // The bell tower's cable duct, running under all three phase pits (their
    // shelf floors at row 29 keep their springs; the duct passes beneath) and
    // broken only by the cart canyon's ledge (floor 30, cols 315–321). The
    // sneak-under pocket (223–230, floor 34) merges in, under crystal and
    // all. Shafts: gate apron (8), stacked-choice deck (75), the climb-out
    // runway (198) and the run-out (348) — clear of the loop corridor
    // (109–138), the rail cascade, the full gauntlet and the leap.
    underGallery(b, 4, { len: 311, row: 34, shafts: [4, 71, 194], hazards: 2, crystal: false });
    underGallery(b, 322, { len: 52, row: 34, shafts: [26], hazards: 2, crystal: false });
  },
};
