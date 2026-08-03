import type { LevelDef, LevelBuilder } from '../game/Level.ts';
import { STORY_INTRO } from '../game/story.ts';

/**
 * ZONE 1 — VERDANT RUSH
 *
 * THREE ROUTES, all of which run the length of the zone:
 *   SKY    (rows 3–12)  — entered off the launch ramp or a strong spring,
 *                         then a chain of precise platform hops.
 *   GROUND (rows 18–26) — the default road: hills, loops, hazards.
 *   UNDER  (rows 28–34) — a gallery carved beneath the bedrock, entered by
 *                         falling through visible shafts, exited by springs.
 * One Chrono Crystal sits on each route, so no single lane can collect them
 * all — you have to learn the whole zone.
 *
 * TERRAIN RULE: height changes on a running route use `hill`, `dip`,
 * `gentleUp`/`gentleDown` (~26.5°), never 45° steps. A 45° face reads as a
 * wall at speed and kills momentum, which is the opposite of the point.
 *
 * BUILD ORDER: ground first (floors fill to bedrock), then the sky
 * platforms, then the underworld is CARVED out of the bedrock and given its
 * own floor. Carving last is what keeps the gallery from being back-filled.
 */
export const zone1: LevelDef = {
  name: 'VERDANT RUSH',
  act: 'ACT 1',
  title: 'Tidebreak Run',
  biome: 0,
  theme: 'verdant',
  bossKind: 'pod',
  intro: STORY_INTRO,
  build(b: LevelBuilder): void {
    /* ============================ GROUND ROUTE ============================ */
    b.floor(0, 12, 21);
    b.start(4, 21);
    b.ringsH(7, 11, 18);
    b.hill(13, 21, 2, 5); // 13–25, crown row 19
    b.ringsH(17, 21, 16);
    b.floor(26, 32, 21);
    b.enemy(29, 21, 3);

    b.gentleDown(33, 21, 3); // 33–38, down to row 24
    b.floor(39, 84, 24);
    b.ringsH(35, 39, 21);
    b.loop(46, 24);
    b.ringsH(56, 60, 21);
    b.spring(62, 24, 12); // a second way up to the sky route
    b.enemy(74, 24, 4);
    b.spikeTrap(79, 24, 150, 0); // telegraphed: it rattles before it strikes
    b.spikeTrap(80, 24, 150, 0);
    // Secret room 1, tucked under the corridor floor.
    b.carve(70, 24, 71, 27);
    b.carve(70, 25, 78, 27);
    b.secret(70, 24, 78, 27);
    b.crystal(75, 26); // CRYSTAL — ground secret
    b.ringBox(72, 26, 2, 1);
    b.monitor(77, 27, 'rings10');
    b.spring(70, 28, 12);
    b.spring(71, 28, 12);

    b.gentleUp(85, 23, 3); // 85–90, back to row 21
    b.floor(91, 96, 21);
    b.checkpoint(93, 21);
    b.hill(97, 21, 3, 6); // 97–114, crown row 18
    b.ringsH(103, 108, 15);
    b.enemy(105, 18, 3);
    b.floor(115, 120, 21);
    b.monitor(117, 21, 'shield');
    b.launchRamp(121, 21, 3); // 121–128: run-up, then a shot into the sky
    // Ease back down off the launch pad. Dropping straight from the pad row
    // to the base row leaves a 3-tile cliff for anyone who arrives too slow
    // to fire the board — exactly the kind of hard step this zone avoids.
    b.gentleDown(129, 18, 3); // 129–134, back to row 21
    b.floor(135, 140, 21);

    b.gentleDown(141, 21, 3); // 141–146, down to row 24
    b.floor(147, 200, 24);
    b.loop(154, 24);
    b.ringsH(164, 168, 21);
    b.swingBall(172, 14, 9, 150, 0); // visible pendulum: time the run under it
    b.crumble(176, 178, 20); // ledge that gives way after a beat
    b.ringsH(176, 178, 18);
    b.enemy(186, 24, 4);
    b.spikeTrap(196, 24, 150, 60);

    b.gentleDown(201, 24, 2); // 201–204, down into the hollow
    b.floor(205, 224, 26);
    b.spikes(209, 211, 26);
    b.platform(207, 213, 22);
    b.ringsH(208, 212, 20);
    b.monitor(206, 26, 'rings10');
    b.enemy(215, 26, 4);
    b.spikeTrap(218, 26, 140, 70);
    // Secret room 2, below the hollow.
    b.carve(220, 26, 221, 29);
    b.carve(220, 27, 224, 29);
    b.secret(220, 26, 224, 29);
    b.crystal(223, 28); // CRYSTAL — ground secret 2
    b.ringBox(221, 28, 2, 1);
    b.spring(220, 30, 11);
    b.spring(221, 30, 11);

    b.gentleUp(225, 25, 2); // 225–228, back to row 24
    b.floor(229, 266, 24);
    b.loop(236, 24);
    b.ringsH(246, 250, 21);
    b.checkpoint(243, 24);
    b.monitor(252, 24, 'shoes');
    b.enemy(255, 24, 3);
    b.swingBall(248, 14, 9, 160, 80);
    // Mesa with secret room 3 inside it.
    b.platform(246, 254, 18);
    b.ringsH(247, 253, 16);

    b.gentleUp(267, 23, 3); // 267–272, up to row 21
    b.floor(273, 319, 21);
    b.ringsH(274, 279, 18);
    b.boss(282, 276, 314);
    b.goal(310, 21);

    /* ============================= SKY ROUTE ==============================
     * A chain of one-way platforms, never more than ~6 tiles apart, running
     * from the launch ramp to the arena approach. Falling off drops you onto
     * the ground route rather than killing you.
     */
    b.platform(136, 146, 7);
    b.ringsH(137, 145, 5);
    b.platform(152, 160, 5);
    b.ringsH(153, 159, 3);
    b.crystal(156, 3); // CRYSTAL — sky route
    b.platform(166, 174, 8);
    b.ringsH(167, 173, 6);
    b.platform(180, 188, 6);
    b.monitor(184, 6, 'rings10');
    b.platform(194, 202, 9);
    b.ringsH(195, 201, 7);
    b.platform(208, 216, 6);
    b.ringsH(209, 215, 4);
    b.platform(222, 230, 9);
    b.platform(236, 244, 6);
    b.ringsH(237, 243, 4);
    b.platform(250, 258, 9);
    b.ringsH(251, 257, 7);
    b.platform(264, 272, 12); // last step down to the arena approach

    /* =========================== UNDER ROUTE =============================
     * Carved out of the bedrock AFTER the surface exists, with visible drop
     * shafts in and spring lifts out. Falling in costs time, never a life.
     */
    b.carve(150, 28, 262, 33);
    b.floor(150, 262, 34);
    // Drop shafts must clear every loop footprint, or they punch a hole in
    // the loop's run-up corridor.
    b.carve(190, 24, 193, 33); // drop shaft 1, through the corridor deck
    b.carve(244, 24, 247, 33); // drop shaft 2, past loop 3
    b.carve(256, 24, 259, 33); // exit shaft
    b.ringsH(196, 206, 31);
    b.monitor(200, 34, 'rings10');
    b.enemy(210, 34, 5);
    b.crystal(214, 31); // CRYSTAL — underworld
    b.ringBox(220, 30, 4, 2);
    b.enemy(240, 34, 5);
    b.spikes(246, 248, 34);
    b.ringsH(250, 255, 31);
    b.spring(191, 34, 11); // lifts back through drop shaft 1
    b.spring(192, 34, 11);
    b.spring(245, 34, 11);
    b.spring(246, 34, 11);
    b.spring(257, 34, 11); // and out again near the mesa
    b.spring(258, 34, 11);
    // Secret room 3: a low crawl off the far end of the gallery.
    b.carve(263, 31, 270, 33);
    b.floor(263, 270, 34);
    b.secret(263, 31, 270, 33);
    b.crystal(267, 32); // CRYSTAL — deep secret
    b.ringBox(265, 32, 2, 1);
  },
};
