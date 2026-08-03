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
  skySteps,
  glideRun,
  underGallery,
} from '../motifs.ts';

/**
 * DUSKMERE COAST — ACT 5 — "Reefbowl Circuit"
 *
 * Quarter pipes take centre stage: two sunken half-pipe bowls to skate, and
 * a leap of faith off the last cliff. The first bowl still flings a fast
 * runner onto the canopy (tests/skylanes.test.ts probes exactly that arc, so
 * the opener and the row-10 landing net are preserved) — but the canopy now
 * leads into trapped sky steps and a glide over the gauntlet, and the whole
 * act rides on a sea-cave gallery with a grind line and clocked teeth.
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
    c = runway(b, c.endX, c.endRow, { len: 10, checkpoint: true }); // 64–73 (shaft at 69)
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 74–95, CRYSTAL 1 (sky shelf)
    c = corridorLoop(b, c.endX, c.endRow); // 96–123, loop centre 109
    c = secretPocket(b, c.endX, c.endRow); // 124–133, CRYSTAL 2 + secret 1
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 16, count: 4 }); // 134–149
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 6 }); // 150–165: the wide bowl
    b.crystal(158, 26); // CRYSTAL 3 — hanging in the bowl's basin
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true }); // 166–173 (shaft at 170)
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 160 }); // 174–191
    c = sneakUnder(b, c.endX, c.endRow, { secret: true }); // 192–203, secret 2 (opens into the gallery)
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 2, period: 150 }); // 204–219
    b.drone(210, 18, 4); // patrols the jump line over the gauntlet
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 22 }); // 220–249: blind drop to row 27
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 10, enemy: true }); // 250–265, back to 24
    c = secretPocket(b, c.endX, c.endRow, { reward: 'rings10' }); // 266–275, secret 3
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 276–305
    c = runway(b, c.endX, c.endRow, { len: 22 }); // 306–327 (shaft at 318)
    signpostFinish(b, c.endX, c.endRow, { len: 32 }); // 328–359

    // Sky overlay — trapped steps first, then the wide catwalk net exactly
    // where the second bowl's fling comes down (rows 10, the probed arc: the
    // wide 8-tile platforms are what reliably catch a launch), then a glide
    // across the gauntlet with the sky crystal hanging on the second thermal.
    skySteps(b, 98, 10, { steps: 5, drone: true, trap: true }); // 98–135
    b.platform(134, 138, 10); // seam shelf between the steps and the catwalks
    canopyRun(b, 142, 10, { len: 47 }); // 142–188: strided so the wide bowl's
    // fling (apex ~x182, feet row 9.3, simulated) comes down ON 181–188.
    b.platform(193, 200, 10); // last catwalk before the perch
    glideRun(b, 201, 9, { len: 56, crystal: true }); // 201–256, CRYSTAL 5 mid-glide
    // Mercy mast-tops keep the sky lane continuous under the glide gap.
    for (const mx of [214, 222, 230, 238, 246]) b.platform(mx, mx + 1, 15);

    /* ============================ UNDER ROUTE ============================
     * The sea-cave gallery under the whole circuit, carved last. Shafts sit
     * on the checkpoint runways, clear of both bowls, the loop corridor
     * (96–123) and the leap mesa; the phase pit floor carries a carved door
     * down as well, so the slow route feeds the cave.
     */
    underGallery(b, 44, {
      len: 292, // 44–335
      shafts: [25, 126, 274], // at 69, 170, 318
      hazards: 2,
      rail: true, // grind line past the phase-pit door
      crystal: true, // CRYSTAL 4 — under-lane prize, beneath the sneak-under
    });
    // The pit-floor door (phase crossing's lower route, floor row 29).
    b.carve(179, 29, 180, 33);
    b.spring(179, 34, 13);
    b.spring(180, 34, 13);
  },
};
