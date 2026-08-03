import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  rollersRun,
  stackedChoice,
  corridorLoop,
  secretPocket,
  sneakUnder,
  hazardGauntlet,
  signpostFinish,
  canopyRun,
  skySteps,
  glideRun,
  underGallery,
} from '../motifs.ts';

/**
 * DUSKMERE COAST — ACT 2 — "Gullwing Causeway"
 *
 * The hang glider's debut. The causeway opens straight into rolling swells
 * (no dash-pad apron this time — each act now opens differently), and the sky
 * lane is a real journey: catwalks to a launch perch where the wing waits,
 * a simple first glide held up by two thermals, then more catwalks and a set
 * of staggered steps. Below the shore, a full-length sea-cave gallery is the
 * third road — carved after the ground chain, entered by visible light-well
 * shafts, with a grind line and spring lifts back out. One shaft sits inside
 * a thermal, making it a wind elevator straight from the cave to the glide
 * line — the discovery the act is named for.
 */
export const act02: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 2',
  title: 'Gullwing Causeway',
  biome: 0,
  theme: 'verdant',
  width: 340,
  build(b: LevelBuilder): void {
    // Ground chain, left to right (each motif lays its own ground).
    let c = runway(b, 0, 24, { len: 8, rings: false }); // 0–7: the start apron
    b.start(4, 24);
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 8–37: straight into the swells
    c = runway(b, c.endX, c.endRow, { len: 14, dashPad: true }); // 38–51 (shaft at 46)
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 52–73, CRYSTAL 1 (sky shelf)
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true }); // 74–81
    c = corridorLoop(b, c.endX, c.endRow); // 82–109, loop centre 95
    c = secretPocket(b, c.endX, c.endRow); // 110–119, CRYSTAL 2 + secret 1
    c = runway(b, c.endX, c.endRow, { len: 10 }); // 120–129 (the wind-elevator shaft at 124)
    c = runway(b, c.endX, c.endRow, { len: 20, enemy: true }); // 130–149: flat under the glide line

    // Launch set piece (150–171): the ramp arc lands on the canopy past the
    // glide deck. Ease back down off the pad — a hard step after a launcher
    // strands slow arrivals.
    b.launchRamp(150, 24, 3); // 150–157, pad tops out on row 21
    b.gentleDown(158, 21, 3); // 158–163, back to row 24
    b.floor(164, 171, 24);
    b.ringsH(165, 170, 21);
    c = { endX: 172, endRow: 24 };

    c = sneakUnder(b, c.endX, c.endRow, { secret: true }); // 172–183, secret 2 (opens into the gallery)
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 12, density: 1 }); // 184–195: one telegraphed trap
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shoes' }); // 196–205, secret 3
    c = runway(b, c.endX, c.endRow, { len: 10, checkpoint: true }); // 206–215 (shaft at 211)

    // Pendulum reef (216–235): two swing balls bracketing a crumble ledge —
    // pure timing, fully visible, and far enough in that clocks never chirp
    // at an idle hero on the apron.
    b.floor(216, 235, 24);
    b.swingBall(221, 14, 9, 160, 0);
    b.crumble(226, 228, 20);
    b.ringsH(226, 228, 18);
    b.swingBall(231, 14, 9, 160, 80);
    b.ringsH(217, 224, 21);
    c = { endX: 236, endRow: 24 };

    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 236–265
    c = runway(b, c.endX, c.endRow, { len: 20, enemy: true }); // 266–285 (shaft at 281)
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 286–315
    c = runway(b, c.endX, c.endRow, { len: 8, rings: false }); // 316–323 (shaft at 318)
    signpostFinish(b, c.endX, c.endRow, { len: 16 }); // 324–339

    /* ============================= SKY ROUTE =============================
     * Catwalks in, a first gentle glide, catwalks out, staggered steps —
     * never the same texture for long.
     */
    const s1 = canopyRun(b, 54, 10, { len: 52 }); // 54–105, joined to the stacked shelves
    const g = glideRun(b, s1.endX, 9, { len: 56, crystal: true }); // 106–161, CRYSTAL 5 mid-glide
    // Mercy mast-tops under the glide gap: a folded wing lands on a shelf,
    // not in a pit, and the sky lane stays continuous for the route contract.
    for (const mx of [118, 126, 134, 142, 150]) b.platform(mx, mx + 1, 15);
    const s2 = canopyRun(b, g.endX + 1, 10, { len: 65, crystal: true }); // 162–226, CRYSTAL 4
    skySteps(b, s2.endX, 10, { steps: 4, drone: true, trap: false }); // 227–257

    /* ============================ UNDER ROUTE ============================
     * The sea-cave gallery, carved last so nothing back-fills it. Shafts sit
     * on plain runways, clear of the loop corridor (82–109), the launch ramp
     * and the pendulums. The shaft at 124 rises through a thermal: springs
     * plus wind carry you from the cave floor all the way to the glide line.
     */
    underGallery(b, 40, {
      len: 284, // 40–323, spanning the whole causeway
      shafts: [6, 84, 171, 241, 278], // at 46, 124, 211, 281, 318
      hazards: 1, // early act: static spikes only, no clocked traps below
      rail: true, // first underworld grind line of the biome
      crystal: true, // CRYSTAL 3 — the under-lane prize lives IN the gallery
    });
  },
};
