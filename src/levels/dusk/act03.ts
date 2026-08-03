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
  signpostFinish,
  canopyRun,
  skySteps,
} from '../motifs.ts';

/**
 * DUSKMERE COAST — ACT 3 — "Undertow Gallery"
 *
 * The undertow is the fast lane, and now it truly runs the act: the original
 * dash-padded gallery under the back half is extended west beneath the loop
 * and the phase crossing, so the under route is one continuous sea-cave from
 * the stacked shelves to the deep secret — with a grind line, its own rings
 * and light-well shafts on the plain runways. The act opens on the stacked
 * choice (no twin-runway apron), and the sky swaps its uniform catwalks for
 * catwalk/step alternation with a patrolling drone.
 *
 * Build order: ground chain first, then the gallery is CARVED, then the sky
 * overlay — carving last is what keeps the gallery from being back-filled.
 */
export const act03: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 3',
  title: 'Undertow Gallery',
  biome: 0,
  theme: 'verdant',
  width: 350,
  build(b: LevelBuilder): void {
    // Ground chain.
    let c = runway(b, 0, 24, { len: 12, rings: false }); // 0–11: start apron
    b.start(4, 24);
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 12–33, CRYSTAL 1 (sky shelf)
    c = runway(b, c.endX, c.endRow, { len: 8, dashPad: true }); // 34–41
    c = corridorLoop(b, c.endX, c.endRow); // 42–69, loop centre 55
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true }); // 70–77
    c = stalactiteGallery(b, c.endX, c.endRow); // 78–91: the hanging spikes debut
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 170 }); // 92–109
    c = runway(b, c.endX, c.endRow, { len: 8 }); // 110–117 (shaft at 112)
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 118–147
    c = sneakUnder(b, c.endX, c.endRow, { secret: true }); // 148–159, secret 1 (opens into the gallery)
    c = secretPocket(b, c.endX, c.endRow); // 160–169, CRYSTAL 2 + secret 2
    c = runway(b, c.endX, c.endRow, { len: 10, checkpoint: true }); // 170–179
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 1, period: 160 }); // 180–195

    // Pendulum stretch (196–215).
    b.floor(196, 215, 24);
    b.swingBall(201, 14, 9, 150, 0);
    b.crumble(205, 207, 20);
    b.ringsH(205, 207, 18);
    b.swingBall(210, 14, 9, 150, 75);
    b.ringsH(197, 204, 21);
    c = { endX: 216, endRow: 24 };

    c = runway(b, c.endX, c.endRow, { len: 12, enemy: true }); // 216–227
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 228–257
    c = runway(b, c.endX, c.endRow, { len: 12 }); // 258–269
    c = runway(b, c.endX, c.endRow, { len: 22 }); // 270–291
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 292–321
    c = runway(b, c.endX, c.endRow, { len: 12, rings: false }); // 322–333
    signpostFinish(b, c.endX, c.endRow, { len: 16 }); // 334–349

    /* ------------------------ THE UNDERTOW (carved) ------------------------
     * The classic back-half gallery, with its dash pads and deep secret …
     */
    b.carve(175, 28, 280, 33);
    b.floor(175, 280, 34);
    b.carve(176, 24, 178, 33); // drop shaft, through the checkpoint runway
    b.carve(262, 24, 264, 33); // drop shaft, the exit end
    b.dashPad(185, 34, 1, 11);
    b.dashPad(210, 34, 1, 11);
    b.dashPad(235, 34, 1, 11);
    b.ringsH(190, 206, 31);
    b.ringsH(220, 232, 31);
    b.monitor(200, 34, 'rings10');
    b.crystal(220, 31); // CRYSTAL 3 — the undertow prize
    b.enemy(230, 34, 4);
    b.spring(176, 34, 11);
    b.spring(177, 34, 11);
    b.spring(262, 34, 11);
    b.spring(263, 34, 11);
    // Deep secret: a low crawl off the far end of the gallery.
    b.carve(281, 31, 288, 33);
    b.floor(281, 288, 34);
    b.secret(281, 31, 288, 33);
    b.crystal(285, 32); // CRYSTAL 4 — deep secret
    b.ringBox(283, 32, 2, 1);

    /* … now extended west under the loop and the phase crossing, so the
     * under route spans the act instead of its last third. The extension's
     * ceiling is one row lower (carve 30–33) so the phase pit's slow lower
     * floor at row 29 survives as a shelf above the cave. */
    b.carve(52, 30, 174, 33);
    b.floor(52, 174, 34);
    b.carve(112, 18, 114, 33); // light-well shaft on the plain runway at 110–117
    b.spring(112, 34, 13);
    b.spring(113, 34, 13);
    b.ringsH(60, 70, 32);
    b.enemy(140, 34, 3);
    // The extension's grind line, mirroring the biome's underworld rails; it
    // ends over open floor, clear of the gallery's spikes and pads.
    b.rail(120, 31, 144, 32);

    // Sky overlay: catwalks joined to the stacked shelves, then staggered
    // steps under a drone, more catwalks, a trapped step set, catwalks out.
    const s1 = canopyRun(b, 36, 10, { len: 52, crystal: true }); // 36–87, CRYSTAL 5 (sky)
    const k1 = skySteps(b, s1.endX, 10, { steps: 5, drone: true, trap: false }); // 88–125
    const s2 = canopyRun(b, k1.endX, 10, { len: 78 }); // 126–203
    const k2 = skySteps(b, s2.endX, 10, { steps: 4, trap: true, drone: false }); // 204–234
    canopyRun(b, k2.endX, 10, { len: 52 }); // 235–286
  },
};
