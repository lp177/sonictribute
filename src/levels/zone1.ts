import type { LevelDef, LevelBuilder } from '../game/Level.ts';

/**
 * ZONE 1 — VERDANT RUSH
 * Three stacked routes (low corridor at row 24, hills/mesas, one-way
 * platforms above), 3 loops, 3 secret rooms, 5 Chrono Crystals, boss arena
 * at the far right. Built with the LevelBuilder API; coordinates are tiles.
 */
export const zone1: LevelDef = {
  name: 'VERDANT RUSH',
  act: 'ACT 1',
  build(b: LevelBuilder): void {
    /* ---- Section A (0–45): start, first descent to the low corridor ---- */
    b.floor(0, 30, 21);
    b.start(4, 21);
    b.ringsH(8, 13, 18);
    b.slopeDown(20, 21, 3); // rolling descent 21 -> 24
    b.pit(23, 72, 21, 3); // open the low corridor (surface row 24)
    b.floor(23, 72, 24); // low corridor ground
    b.ringsH(24, 29, 21);
    b.enemy(34, 24, 4);

    /* ---- Section B (36–72): loop 1, spring, secret room 1 ---- */
    b.loop(44, 24);
    b.ringsH(36, 40, 21);
    b.ringsH(41, 47, 17); // ring arc over the loop
    b.ringsH(50, 54, 21);
    b.spring(58, 24, 10); // yellow spring up to the platform route
    b.slopeUp(69, 24, 3); // 24 -> 21 (done before carving, it backfills below)
    // Secret room 1: hidden shaft in the floor.
    b.carve(64, 24, 65, 27); // entrance shaft (2 wide)
    b.carve(64, 25, 72, 27); // room
    b.secret(64, 24, 72, 27);
    b.crystal(68, 26);
    b.ringBox(66, 26, 2, 1);
    b.monitor(70, 28, 'rings10');
    b.spring(64, 28, 12); // way back up (covers the whole shaft)
    b.spring(65, 28, 12);

    /* ---- Section C (69–100): hill + high platform route ---- */
    b.floor(72, 100, 21); // the hill
    b.platform(74, 82, 18);
    b.platform(84, 92, 15);
    b.platform(94, 99, 18);
    b.ringsH(75, 81, 17);
    b.ringsH(85, 91, 14);
    b.crystal(96, 17); // crystal on the high route
    b.spring(72, 21, 14); // red spring onto the platforms
    b.enemy(78, 21, 4);
    b.enemy(90, 21, 4);
    b.monitor(96, 21, 'rings10');

    /* ---- Section D (100–135): valley, loop 2, high ledge, checkpoint ---- */
    b.slopeDown(100, 21, 3);
    b.pit(103, 160, 21, 3); // low corridor resumes at row 24
    b.floor(103, 137, 24);
    b.loop(116, 24);
    b.ringsH(108, 112, 21);
    b.ringsH(113, 119, 17);
    b.ringsH(122, 126, 21);
    b.spring(130, 24, 10);
    b.platform(128, 134, 17);
    b.crystal(131, 16); // above the ledge
    b.checkpoint(134, 24);

    /* ---- Section E (137–160): spike hollow, secret room 2 ---- */
    b.slopeDown(137, 24, 2); // 24 -> 26
    b.pit(139, 160, 24, 2);
    b.floor(139, 160, 26);
    b.spikes(144, 145, 26);
    b.ringsH(143, 146, 23);
    b.monitor(140, 26, 'shield');
    b.enemy(150, 26, 5);
    b.carve(152, 26, 153, 28); // hidden shaft
    b.carve(154, 27, 158, 28); // room 2
    b.secret(152, 26, 158, 28);
    b.crystal(156, 27);
    b.spring(153, 29, 12); // way back up

    /* ---- Section F (160–200): pit crossing over a spike floor ---- */
    b.slopeUp(160, 26, 2); // back to 24
    b.floor(162, 203, 24);
    b.pit(170, 181, 24, 4); // open pit
    b.floor(170, 181, 28); // pit floor
    b.spikes(173, 175, 28);
    b.spring(171, 28, 10); // escape if you fall in
    b.gentleUp(176, 27, 4); // gentle climb-out ramp, tops out flush at row 24
    b.platform(169, 172, 20);
    b.platform(174, 177, 17);
    b.platform(179, 182, 20);
    b.ringsH(174, 177, 16);

    /* ---- Section G (185–235): loop 3, mesa with secret room 3 ---- */
    b.loop(192, 24);
    b.ringsH(186, 190, 21);
    b.ringsH(189, 195, 17);
    b.enemy(200, 24, 3);
    b.slopeUp(203, 24, 6); // 24 -> 18 mesa approach
    b.floor(209, 222, 18); // the mesa
    b.carve(210, 20, 218, 23); // room 3 inside the mesa
    b.carve(216, 18, 217, 20); // hidden shaft through the top
    b.secret(210, 19, 218, 23);
    b.crystal(213, 21);
    b.ringBox(211, 20, 3, 1);
    b.spring(216, 24, 12); // way back up through the shaft
    b.slopeDown(222, 18, 6); // 18 -> 24
    b.floor(228, 250, 24);

    /* ---- Section H (228–250): final stretch ---- */
    b.ringsH(230, 236, 21);
    b.monitor(238, 24, 'shoes');
    b.checkpoint(240, 24);
    b.enemy(244, 24, 4);
    b.ringsH(242, 246, 20);

    /* ---- Section I (250–319): boss arena & goal ---- */
    b.slopeUp(250, 24, 3); // 24 -> 21
    b.floor(253, 319, 21); // arena floor to the map edge
    b.boss(258, 252, 292);
    b.goal(288, 21);
    b.ringsH(254, 257, 18);
  },
};
