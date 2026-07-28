import type { LevelDef, LevelBuilder } from '../game/Level.ts';
import { STORY_ACT2 } from '../game/story.ts';

/**
 * ZONE 2 — COG SKYWAY
 * Dr. Yolk's sky-factory. Introduces two original mechanisms discovered in
 * order: dash pads (from the first stretch) and the Mag-Board vehicle
 * (skyway section only — mount pad at the checkpoint, dismount line at the
 * end). Gaps in the skyway drop to slower lower pits with spring escapes, so
 * falling costs time, not a life. 2 loops, 3 secret rooms, 5 crystals, Buzz
 * Drones, and the Piston Crusher boss. Coordinates are tiles.
 */
export const zone2: LevelDef = {
  name: 'COG SKYWAY',
  act: 'ACT 2',
  theme: 'gear',
  bossKind: 'press',
  intro: STORY_ACT2,
  build(b: LevelBuilder): void {
    /* ---- Section A (0–42): factory gate, dash pad tutorial ---- */
    b.floor(0, 44, 21);
    b.start(4, 21);
    b.ringsH(8, 12, 18);
    b.dashPad(16, 21, 1, 10); // first new mechanism, seconds after spawn
    b.ringsH(18, 26, 18);
    b.enemy(30, 21, 3);
    b.drone(36, 17, 3); // first flyer, telegraphed above the path
    b.monitor(40, 21, 'rings10');

    /* ---- Section B (42–79): descent, loop 1, high ledge, secret room 1 ---- */
    b.slopeDown(42, 21, 3); // 21 -> 24
    b.pit(45, 78, 21, 3); // open the low corridor
    b.floor(45, 78, 24);
    b.dashPad(48, 24, 1, 11); // launches you through the loop
    b.loop(56, 24); // lays its own ring arc along the channel
    b.ringsH(46, 50, 21); // approach rings, clear of the loop footprint
    b.ringsH(62, 66, 21);
    b.spring(68, 24, 10); // up to the ledge route
    b.platform(66, 72, 17);
    b.crystal(69, 15); // crystal 1, ledge route
    b.slopeUp(76, 24, 3); // 24 -> 21 (before carving the secret below)
    // Secret room 1: hidden shaft in the corridor floor.
    b.carve(70, 24, 71, 27); // entrance shaft
    b.carve(70, 25, 74, 27); // room
    b.secret(70, 24, 74, 27);
    b.crystal(73, 26); // crystal 2, secret room
    b.ringBox(71, 26, 2, 1);
    b.spring(70, 28, 12); // way back up (covers the shaft)
    b.spring(71, 28, 12);

    /* ---- Section C (79–150): THE SKYWAY — Mag-Board section ---- */
    b.floor(79, 100, 21);
    b.checkpoint(82, 21);
    b.boardPad(86, 21); // the vehicle, only in this zone
    b.dashPad(92, 21, 1, 11);
    b.ringsH(88, 98, 18);
    // Three gaps; falling in costs time (lower pits with spring escapes).
    b.pit(101, 107, 21, 5);
    b.floor(101, 107, 26);
    b.spring(104, 26, 12);
    b.ringsH(102, 106, 24);
    b.floor(108, 115, 21);
    b.dashPad(110, 21, 1, 11);
    b.pit(116, 122, 21, 5);
    b.floor(116, 122, 26);
    b.spikes(117, 119, 26);
    b.spring(121, 26, 12);
    b.floor(123, 130, 21);
    b.dashPad(125, 21, 1, 11);
    b.pit(131, 137, 21, 5);
    b.floor(131, 137, 26);
    b.spring(134, 26, 12);
    b.monitor(136, 26, 'shield'); // consolation prize down in the pit
    b.floor(138, 165, 21);
    b.dashPad(140, 21, 1, 11);
    // High air route over the gaps (platforms + rings + crystal).
    b.platform(102, 106, 16);
    b.platform(117, 121, 15);
    b.platform(132, 136, 16);
    b.ringsH(102, 106, 14);
    b.ringsH(117, 121, 13);
    b.ringsH(132, 136, 14);
    b.crystal(119, 12); // crystal 3, above the middle platform
    b.drone(104, 18, 2);
    b.drone(126, 17, 3);
    b.boardEnd(150); // dismount line — the ride ends here
    b.checkpoint(152, 21);
    b.ringsH(154, 158, 18);

    /* ---- Section D (165–202): loop 2, spike run, secret room 2 ---- */
    b.slopeDown(165, 21, 3); // 21 -> 24
    b.pit(168, 200, 21, 3);
    b.floor(168, 200, 24);
    b.dashPad(170, 24, 1, 11);
    b.loop(176, 24);
    b.ringsH(167, 170, 21); // approach rings, clear of the loop footprint
    b.enemy(186, 24, 4);
    b.drone(190, 20, 3);
    b.spikes(193, 194, 24);
    b.monitor(196, 24, 'rings10');
    b.slopeUp(199, 24, 3); // 24 -> 21, before carving the room below
    // Secret room 2: under the monitor alcove.
    b.carve(197, 24, 198, 27); // hidden shaft
    b.carve(192, 25, 198, 27); // room
    b.secret(192, 24, 198, 27);
    b.crystal(194, 26); // crystal 4, secret room
    b.ringBox(195, 26, 2, 1);
    b.spring(197, 28, 12); // way back up
    b.spring(198, 28, 12);

    /* ---- Section E (202–248): gear tower (mesa), high route, secret 3 ---- */
    b.floor(202, 319, 21);
    b.slopeUp(210, 21, 3); // 21 -> 18 tower approach
    b.floor(213, 228, 18); // the tower top
    b.slopeDown(228, 18, 3); // 18 -> 21
    // Secret room 3: inside the tower.
    b.carve(215, 20, 224, 23); // room
    b.carve(221, 18, 222, 20); // hidden shaft through the top
    b.secret(215, 19, 224, 23);
    b.monitor(218, 24, 'rings10');
    b.ringBox(216, 21, 3, 1);
    b.spring(221, 24, 12); // way back up through the shaft
    // High platforms above the tower.
    b.platform(214, 219, 14);
    b.platform(222, 227, 12);
    b.crystal(225, 10); // crystal 5, top of the sky route
    b.ringsH(214, 219, 13);
    b.drone(232, 17, 3);
    b.enemy(236, 21, 4);
    b.monitor(242, 21, 'shoes');
    b.checkpoint(244, 21);
    b.ringsH(238, 243, 18);

    /* ---- Section F (248–319): boss arena & goal ---- */
    b.boss(258, 254, 294);
    b.goal(290, 21);
    b.ringsH(250, 253, 18);
  },
};
