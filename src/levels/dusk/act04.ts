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
  skySteps,
  underGallery,
} from '../motifs.ts';

/**
 * DUSKMERE COAST — ACT 4 — "Hopper Shallows"
 *
 * Two debuts on the surface: the coiled hoppers bounce across the tide flats
 * from the very first stretch (the act opens straight onto them — no shared
 * apron), and the biome's first quarter-pipe appears as a leap of faith.
 * Below, the sea-cave gallery now runs the full act with clocked teeth, and
 * the phase crossing's pit floor hides a carved door straight down into it.
 * The sky alternates catwalks and trapped steps under a drone.
 */
export const act04: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 4',
  title: 'Hopper Shallows',
  biome: 0,
  theme: 'verdant',
  width: 340,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 8, rings: false }); // 0–7: start apron
    b.start(4, 24);

    // The hopper shallows (8–27): meet the new enemy immediately, on open,
    // safe ground. Hoppers are silent until stomped, so the idle-start
    // contract holds even this close to the spawn.
    b.floor(8, 27, 24);
    b.hopper(14, 24);
    b.hopper(21, 24);
    b.ringsH(10, 25, 21);
    c = { endX: 28, endRow: 24 }; // (gallery shaft cuts the flats at 24–26)

    c = runway(b, c.endX, c.endRow, { len: 8, dashPad: true }); // 28–35
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 36–57, CRYSTAL 1 (sky shelf)
    c = corridorLoop(b, c.endX, c.endRow); // 58–85, loop centre 71
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 86–93
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 20 }); // 94–121: the blind drop, to row 27
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 10 }); // 122–137, back to row 24 (shaft at 132)
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 2 }); // 138–153
    c = sneakUnder(b, c.endX, c.endRow, { secret: true }); // 154–165, secret 1 (opens into the gallery)

    // Crumble shelf under a pendulum (166–185), with a crystal riding just
    // above the ledge — grab it before the floor lets go.
    b.floor(166, 185, 24);
    b.swingBall(171, 14, 9, 150, 0);
    b.crumble(174, 177, 20);
    b.ringsH(174, 177, 18);
    b.crystal(176, 18); // CRYSTAL 2 — over the crumble ledge
    b.hopper(182, 24);
    b.ringsH(167, 172, 21);
    c = { endX: 186, endRow: 24 };

    c = secretPocket(b, c.endX, c.endRow); // 186–195, CRYSTAL 3 + secret 2
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 196–225
    c = runway(b, c.endX, c.endRow, { len: 10, checkpoint: true }); // 226–235
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 170 }); // 236–253
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shoes' }); // 254–263, secret 3
    c = runway(b, c.endX, c.endRow, { len: 12 }); // 264–275 (shaft at 270)
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 276–305
    signpostFinish(b, c.endX, c.endRow, { len: 34 }); // 306–339

    // Sky overlay: short catwalk in, trapped steps, catwalk with the crystal,
    // steps again, catwalk out — teeth on every stretch.
    const s1 = canopyRun(b, 40, 10, { len: 39 }); // 40–78, joined to the stacked shelves
    const k1 = skySteps(b, s1.endX, 10, { steps: 5, drone: true, trap: true }); // 79–116
    const s2 = canopyRun(b, k1.endX, 10, { len: 52, crystal: true }); // 117–168, CRYSTAL 5 (sky)
    const k2 = skySteps(b, s2.endX, 10, { steps: 4, trap: true, drone: false }); // 169–199
    canopyRun(b, k2.endX, 10, { len: 65 }); // 200–264

    /* ============================ UNDER ROUTE ============================
     * Full-length sea-cave gallery, carved last. Shafts avoid the loop
     * corridor (58–85) and the leap mesa (94–121); the third door is a hole
     * in the phase crossing's pit floor — the slow lower route now leads
     * somewhere.
     */
    underGallery(b, 20, {
      len: 286, // 20–305
      shafts: [4, 112, 250], // at 24, 132, 270
      hazards: 2, // spikes AND a clocked trap — the curve bends upward here
      crystal: true, // CRYSTAL 4 — the under-lane prize, mid-gallery
    });
    // The pit-floor door: two columns of the phase crossing's lower route
    // (floor row 29) open into the gallery below, with springs to climb back.
    b.carve(241, 29, 242, 33);
    b.spring(241, 34, 13);
    b.spring(242, 34, 13);
  },
};
