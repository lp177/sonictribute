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
} from '../motifs.ts';

/**
 * DUSKMERE COAST — ACT 3 — "Undertow Gallery"
 *
 * The undertow is the fast lane: a long dash-padded gallery carved beneath
 * the shore, entered by two visible drop shafts and exited by springs — the
 * classic Tidebreak underworld, promoted from detour to main road. Up top the
 * surface debuts the hanging stalactites (player-armed, so they never chirp
 * at an idle hero) and the first hard-light phase crossing.
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
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: start apron
    b.start(4, 24);
    c = runway(b, c.endX, c.endRow, { len: 10, dashPad: true }); // 10–19
    c = corridorLoop(b, c.endX, c.endRow); // 20–47
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 48–69, CRYSTAL 1 (sky shelf)
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 70–77
    c = stalactiteGallery(b, c.endX, c.endRow); // 78–91: the hanging spikes debut
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 170 }); // 92–109
    c = runway(b, c.endX, c.endRow, { len: 8, enemy: true }); // 110–117
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 118–147
    c = sneakUnder(b, c.endX, c.endRow, { secret: true }); // 148–159, secret 1 (shield pocket)
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
     * Drop shafts sit on plain runways, clear of every loop footprint; the
     * gallery's dash pads make it the fastest line through the middle third.
     */
    b.carve(175, 28, 280, 33);
    b.floor(175, 280, 34);
    b.carve(176, 24, 178, 33); // drop shaft 1, through the checkpoint runway
    b.carve(262, 24, 264, 33); // drop shaft 2, the exit end
    b.dashPad(185, 34, 1, 11);
    b.dashPad(210, 34, 1, 11);
    b.dashPad(235, 34, 1, 11);
    b.ringsH(190, 206, 31);
    b.ringsH(220, 232, 31);
    b.monitor(200, 34, 'rings10');
    b.crystal(220, 31); // CRYSTAL 3 — the undertow prize
    b.enemy(230, 34, 4);
    // Every pit is a detour, never a trap: springs under each shaft.
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

    // Sky overlay, within 9 columns of the stacked-choice shelves.
    const s = canopyRun(b, 72, 10, { len: 130, crystal: true }); // CRYSTAL 5 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 104 });
  },
};
