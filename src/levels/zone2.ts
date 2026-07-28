import type { LevelDef, LevelBuilder } from '../game/Level.ts';
import { STORY_ACT2 } from '../game/story.ts';

/**
 * ZONE 2 — COG SKYWAY
 *
 * Dr. Yolk's sky-factory. Same terrain rule as Zone 1: the running route
 * changes height with gentle ramps, hills and dips, never 45° steps.
 *
 * Introduces two original mechanisms in order — dash pads first, then the
 * Mag-Board vehicle (skyway section only: mount pad at the checkpoint,
 * dismount line at the end). Gaps in the skyway drop to slower lower pits
 * with spring escapes, so falling costs time rather than a life. 2 loops,
 * 3 secret rooms, 5 crystals, Buzz Drones, factory traps, and the Piston
 * Crusher arena.
 */
export const zone2: LevelDef = {
  name: 'COG SKYWAY',
  act: 'ACT 2',
  theme: 'gear',
  bossKind: 'press',
  intro: STORY_ACT2,
  build(b: LevelBuilder): void {
    /* ---- A (0–40): factory gate, dash pad tutorial ---- */
    b.floor(0, 14, 21);
    b.start(4, 21);
    b.ringsH(7, 11, 18);
    b.dashPad(13, 21, 1, 10); // the first new mechanism, seconds in
    b.hill(15, 21, 2, 6); // 15–26, crown row 19
    b.ringsH(19, 24, 16);
    b.floor(27, 32, 21);
    b.enemy(30, 21, 3);
    b.launchRamp(33, 21, 3); // 33–40: catapult onto the factory roofline
    b.drone(35, 17, 3); // first flyer, telegraphed above the path

    /* ---- B (41–92): descent, loop 1, ledge route, secret room 1 ---- */
    // Ease off the launch pad first: a straight drop from the pad row to the
    // base row is a 3-tile cliff for anyone too slow to fire the board.
    b.gentleDown(41, 18, 3); // 41–46, pad row 18 back down to 21
    b.gentleDown(47, 21, 3); // 47–52, on down to the corridor at row 24
    b.floor(53, 92, 24);
    b.dashPad(54, 24, 1, 11); // launches you into the loop
    b.loop(60, 24);
    b.ringsH(66, 70, 21);
    b.spring(72, 24, 11);
    b.platform(74, 80, 17);
    b.ringsH(75, 79, 15);
    b.crystal(77, 14); // 1 — ledge route
    b.spikeTrap(84, 24, 150, 40);
    b.spikeTrap(85, 24, 150, 40);
    // Secret room 1 in the corridor floor.
    b.carve(86, 24, 87, 27);
    b.carve(86, 25, 91, 27);
    b.secret(86, 24, 91, 27);
    b.crystal(89, 26); // 2 — secret room
    b.ringBox(87, 26, 2, 1);
    b.spring(86, 28, 12);
    b.spring(87, 28, 12);

    /* ---- C (93–152): THE SKYWAY — Mag-Board section ---- */
    b.gentleUp(93, 23, 3); // 93–98, back to row 21
    b.floor(99, 108, 21);
    b.checkpoint(101, 21);
    b.boardPad(104, 21); // the vehicle, only in this zone
    b.dashPad(107, 21, 1, 11);
    b.ringsH(100, 107, 18);
    // Three gaps. Falling costs time, not a life: each pit has a spring out.
    b.floor(109, 116, 26);
    b.spring(112, 26, 11);
    b.ringsH(110, 115, 23);
    b.floor(117, 124, 21);
    b.dashPad(119, 21, 1, 11);
    b.floor(125, 132, 26);
    b.spikes(127, 129, 26);
    b.spring(131, 26, 11);
    b.floor(133, 140, 21);
    b.dashPad(135, 21, 1, 11);
    b.floor(141, 148, 26);
    b.spring(144, 26, 11);
    b.monitor(146, 26, 'shield'); // consolation prize down in a pit
    b.floor(149, 176, 21);
    b.dashPad(151, 21, 1, 11);
    // High air route over the gaps.
    b.platform(109, 116, 16);
    b.platform(125, 132, 15);
    b.platform(141, 148, 16);
    b.ringsH(110, 115, 14);
    b.ringsH(126, 131, 13);
    b.ringsH(142, 147, 14);
    b.crystal(128, 12); // (skyway) above the middle platform
    b.drone(112, 18, 2);
    b.drone(137, 17, 3);
    b.boardEnd(160); // dismount line — the ride ends here
    b.checkpoint(163, 21);
    b.ringsH(165, 169, 18);

    /* ---- D (177–214): loop 2, factory hazards, secret room 2 ---- */
    b.gentleDown(177, 21, 3); // 177–182, down to row 24
    b.floor(183, 214, 24);
    b.dashPad(185, 24, 1, 11);
    b.loop(190, 24);
    b.swingBall(200, 14, 9, 150, 0);
    b.enemy(204, 24, 4);
    b.drone(207, 20, 3);
    b.crumble(209, 211, 20);
    b.ringsH(209, 211, 18);
    // Secret room 2, under the corridor.
    b.carve(212, 24, 213, 27);
    b.carve(208, 25, 213, 27);
    b.secret(208, 24, 213, 27);
    b.crystal(210, 26); // 3 — secret room 2
    b.ringBox(211, 26, 2, 1);
    b.spring(212, 28, 12);
    b.spring(213, 28, 12);

    /* ---- E (215–262): gear tower, sky route, secret room 3 ---- */
    b.gentleUp(215, 23, 3); // 215–220, up to row 21
    b.floor(221, 262, 21);
    b.hill(224, 21, 3, 8); // 224–243, crown row 18: the tower shoulder
    b.ringsH(231, 237, 15);
    b.drone(234, 13, 3);
    b.platform(228, 236, 12);
    b.ringBox(230, 10, 4, 1); // sky-route reward
    b.spikeTrap(247, 21, 150, 75);
    b.enemy(251, 21, 4);
    b.monitor(255, 21, 'shoes');
    b.checkpoint(257, 21);
    b.ringsH(252, 256, 18);
    // Secret room 3: the shaft must break the SURFACE row, or the room is
    // sealed and the crystal unreachable.
    b.carve(244, 21, 245, 25);
    b.carve(244, 23, 249, 25);
    b.secret(244, 21, 249, 25);
    b.crystal(247, 24); // 5 — secret room 3
    b.ringBox(245, 24, 2, 1);
    b.spring(244, 26, 11);
    b.spring(245, 26, 11);

    /* ---- F (263–319): the Piston Crusher arena ---- */
    b.floor(263, 319, 21);
    b.ringsH(264, 269, 18);
    b.boss(272, 266, 306);
    b.goal(302, 21);

    /* ============================ ROOF ROUTE =============================
     * Entered off the launch ramp at 40 (or the skyway springs), then a chain
     * of catwalks running the length of the factory to the arena approach.
     */
    b.platform(48, 58, 6);
    b.ringsH(49, 57, 4);
    b.monitor(53, 6, 'rings10');
    b.platform(64, 72, 9);
    b.ringsH(65, 71, 7);
    b.platform(78, 86, 6);
    b.platform(92, 100, 9);
    b.ringsH(93, 99, 7);
    b.platform(106, 114, 5);
    b.ringsH(107, 113, 3);
    b.platform(120, 128, 8);
    b.platform(134, 142, 5);
    b.ringsH(135, 141, 3);
    b.platform(148, 156, 8);
    b.ringsH(149, 155, 6);
    b.platform(162, 170, 5);
    b.platform(176, 184, 8);
    b.ringsH(177, 183, 6);
    b.platform(190, 198, 5);
    b.platform(204, 212, 8);
    b.ringsH(205, 211, 6);
    b.platform(218, 226, 5);
    b.platform(232, 240, 8);
    b.ringsH(233, 239, 6);
    b.platform(246, 254, 11);
    b.platform(258, 264, 15); // last step down to the arena approach

    /* ========================= UNDERWORKS ROUTE ==========================
     * Carved out of the bedrock after the surface exists. Drop shafts in,
     * spring lifts out. Falling here costs time, never a life.
     */
    b.carve(150, 28, 260, 33);
    b.floor(150, 260, 34);
    b.carve(166, 21, 169, 33); // drop shaft 1, through the skyway deck
    b.carve(228, 21, 231, 33); // drop shaft 2, through the tower approach
    b.carve(254, 21, 257, 33); // exit shaft
    b.ringsH(172, 182, 31);
    b.monitor(176, 34, 'rings10');
    b.enemy(186, 34, 5);
    b.ringBox(192, 30, 4, 2);
    b.spikes(198, 200, 34);
    b.enemy(206, 34, 5);
    b.ringsH(210, 220, 31);
    b.ringsH(236, 246, 31);
    b.spring(167, 34, 11); // lifts back through drop shaft 1
    b.spring(168, 34, 11);
    b.spring(229, 34, 11);
    b.spring(230, 34, 11);
    b.spring(255, 34, 11); // and out again before the arena
    b.spring(256, 34, 11);
  },
};
