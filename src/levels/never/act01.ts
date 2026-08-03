import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { STORY_HOUR_OF_NEVER } from '../../game/story.ts';
import {
  stalactiteGallery,
  quarterPipeBowl,
  cartCanyon,
  rollersRun,
  runway,
  signpostFinish,
  underGallery,
} from '../motifs.ts';

/**
 * THE UNDERWHEN — ACT 1 — "Glimmerdeep Gate"
 *
 * The biome opener. It deliberately reuses the Chrono Vault's best-tested
 * geometry (the tutorial grind, the chasm rail bridge, the crystal canopy and
 * the drainage gallery) because those sections are hard-won flow — and then
 * runs 80 columns FURTHER: past the old arena line the cavern opens into the
 * Underwhen proper, introducing this biome's three new toys in their gentlest
 * forms — a short stalactite gallery, one quarter-pipe bowl, and a single
 * easy minecart hop — before the signpost. Fast lane: ground/under (the rail
 * dives). No boss; the mid-biome check waits at act 5.
 */
export const act01: LevelDef = {
  name: 'THE UNDERWHEN',
  act: 'ACT 1',
  title: 'Glimmerdeep Gate',
  biome: 2,
  theme: 'crystal',
  width: 400,
  intro: STORY_HOUR_OF_NEVER,
  build(b: LevelBuilder): void {
    /* ======================== A — VAULT MOUTH (0–20) ======================= */
    b.floor(0, 20, 21);
    b.start(4, 21);
    b.ringsH(7, 12, 18);
    b.monitor(17, 21, 'rings10');

    /* ====================== B — THE FIRST GRIND (21–60) ====================
     * The mouth ends in a lip and the first rail hangs off it: the whole
     * mechanic taught in one move, with a soft landing either way.
     */
    b.floor(21, 60, 24);
    b.rail(21, 21, 35, 24); // the tutorial descent
    b.ringsH(22, 25, 20);
    b.ringsH(27, 30, 21);
    b.ringsH(32, 35, 22);
    b.loop(44, 24);
    b.ringsH(52, 57, 21);
    b.enemy(55, 24, 3);
    b.dashPad(59, 24, 1, 11); // feeds the chasm rail with speed

    /* ==================== C — THE CUTTERS' CHASM (61–68) ===================
     * The rail is the bridge; the ledge far below is the consolation, with
     * springs back up — falling costs time, never a life.
     */
    b.floor(61, 68, 30);
    b.rail(62, 24, 69, 24);
    b.ringsH(62, 68, 22);
    b.ringBox(63, 27, 3, 2);
    b.spring(64, 30, 12);
    b.spring(65, 30, 12);

    /* ==================== D — THE CUTTING FLOOR (69–110) =================== */
    b.floor(69, 110, 24);
    b.checkpoint(74, 24);
    b.ringsH(70, 75, 21);
    b.spikeTrap(84, 24, 150, 0); // telegraphed, and far outside idle earshot
    b.spikeTrap(85, 24, 150, 0);
    b.enemy(89, 24, 3);
    b.swingBall(92, 14, 9, 160, 0);
    b.monitor(94, 24, 'shoes');
    b.crumble(96, 98, 21);
    b.ringsH(96, 98, 19);
    // Secret room 1, under the cutting floor.
    b.carve(100, 24, 101, 27);
    b.carve(100, 25, 108, 27);
    b.secret(100, 24, 108, 27);
    b.crystal(105, 26); // crystal 1 — ground secret
    b.ringBox(102, 26, 2, 1);
    b.monitor(107, 28, 'shield');
    b.spring(100, 28, 12);
    b.spring(101, 28, 12);

    /* ================== E — THE SHARD TERRACE (111–166) ==================== */
    b.gentleUp(111, 23, 3); // up to row 21
    b.floor(117, 140, 21);
    b.ringsH(122, 127, 18);
    // Secret room 2: a shaft in the terrace floor.
    b.carve(119, 21, 120, 25);
    b.carve(119, 23, 128, 25);
    b.secret(119, 21, 128, 25);
    b.crystal(124, 24); // crystal 2 — terrace secret
    b.ringBox(121, 24, 2, 1);
    b.monitor(127, 26, 'rings10');
    b.spring(119, 26, 12);
    b.spring(120, 26, 12);
    b.drone(133, 17, 3);
    b.enemy(137, 21, 3);
    b.launchRamp(141, 21, 3); // the shot up into the canopy
    b.gentleDown(149, 18, 3); // ease back down for anyone too slow to fire it
    b.floor(155, 160, 21);
    b.gentleDown(161, 21, 3); // down to the deep corridor

    /* ==================== F — THE DEEP CORRIDOR (167–216) ================== */
    b.floor(167, 200, 24);
    b.loop(175, 24);
    b.ringsH(184, 189, 21);
    b.checkpoint(190, 24);
    b.spikeTrap(193, 24, 140, 70);
    b.dip(201, 24, 2, 8); // a basin that keeps rolling speed
    b.spikes(207, 209, 26);
    b.platform(205, 212, 22);
    b.ringsH(206, 211, 20);
    b.enemy(214, 24, 2);

    /* ===================== G — THE DIVE (217–239) ==========================
     * Walk off the corridor's end and a 45° rail takes you down into the
     * gallery at speed; run at it and you clear the gap entirely.
     */
    b.floor(217, 231, 24);
    b.ringsH(218, 223, 21);
    b.drone(226, 20, 3);
    b.rail(232, 24, 239, 31);

    /* ==================== H — THE LAST SHOULDER (240–283) ================== */
    b.floor(240, 241, 24);
    b.hill(242, 24, 3, 6); // crown at row 21
    b.checkpoint(250, 21);
    b.ringsH(248, 253, 18);
    b.monitor(252, 21, 'rings10');
    b.floor(260, 283, 24);
    b.enemy(272, 24, 4);
    b.ringsH(276, 281, 21);

    /* ================ I — THE UNDERWHEN OPENS (284–399) ====================
     * Where the old vault arena stood, the cavern now runs on: the biome's
     * three new toys, each in its mildest form, then the signpost.
     */
    let c = stalactiteGallery(b, 284, 24, { len: 16, count: 3 });
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 6 });
    c = cartCanyon(b, c.endX, c.endRow, { gap: 6 });
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 });
    c = runway(b, c.endX, c.endRow, { len: 400 - 16 - c.endX, enemy: true });
    signpostFinish(b, c.endX, c.endRow);

    /* ======================= SKY — THE CRYSTAL CANOPY =====================
     * Stamped after the ground per the build-order rule. The final dive rail
     * lands flush at 283, right at the stalactite gallery's mouth.
     */
    b.platform(150, 159, 8);
    b.ringsH(151, 158, 6);
    b.platform(168, 190, 10); // the catwalk the launcher lands on
    b.ringsH(170, 176, 8);
    b.ringsH(182, 188, 8);
    b.monitor(179, 10, 'shield');
    b.platform(196, 204, 6);
    b.crystal(200, 4); // crystal 3 — canopy route
    b.rail(205, 6, 219, 3); // the climb between shelves
    b.platform(210, 214, 9); // the shelf below it, for a missed catch
    b.ringsH(210, 214, 7);
    b.platform(219, 227, 3);
    b.ringsH(220, 226, 1);
    b.platform(233, 241, 6);
    b.ringsH(234, 240, 4);
    b.platform(247, 255, 9);
    b.ringsH(248, 254, 7);
    b.platform(261, 269, 12);
    b.ringsH(262, 268, 10);
    b.rail(270, 12, 283, 24); // the long dive out of the sky

    /* ==================== UNDER — THE DRAINAGE GALLERY =====================
     * Carved out of the bedrock AFTER the surface exists. Two shafts down and
     * the dive in; spring lifts out. Falling here costs time, never a life.
     */
    b.carve(160, 28, 268, 33);
    b.floor(160, 268, 34);
    b.carve(196, 24, 199, 33); // drop shaft, onto the gallery rail
    b.carve(232, 24, 239, 33); // the dive shaft
    b.carve(264, 24, 268, 33); // exit shaft
    b.rail(197, 30, 220, 33); // caught on the way down the shaft
    b.ringsH(202, 210, 31);
    b.crystal(214, 31); // crystal 4 — the gallery
    b.ringBox(217, 30, 3, 2);
    b.enemy(224, 34, 5);
    b.spikes(228, 230, 34);
    b.monitor(236, 34, 'rings10');
    b.ringBox(242, 31, 4, 2);
    b.enemy(250, 34, 5);
    b.ringsH(254, 262, 31);
    b.spring(197, 34, 11); // back up the drop shaft
    b.spring(198, 34, 11);
    // The lift out sits at the far side of its shaft: a rider still carrying
    // speed rightwards needs room to clear the deck edge, not a wall to bump.
    b.spring(266, 34, 11);
    b.spring(267, 34, 11);
    // Secret room 3: the deep crawl past the end of the gallery.
    b.carve(269, 31, 276, 33);
    b.floor(269, 276, 34);
    b.secret(269, 31, 276, 33);
    b.crystal(273, 32); // crystal 5 — deep secret
    b.ringBox(271, 32, 2, 1);

    /* ============== UNDER — THE GLIMMERDEEP RUNS (whole act) ===============
     * The drainage gallery was the only real stretch of underworld; these
     * segments extend it into a biome-length carved route at row 34. Breaks
     * only where existing r30 floors must survive: the chasm ledge (61-68)
     * and the cart canyon ledge (321-326) — both are themselves standable
     * under-lane floor, so they bridge the route across the skips. Shaft
     * columns are chosen clear of both loop footprints (cx 45 and 176 ± 6),
     * the launch ramp (141+), the stalactite roof (285-298) and the bowl.
     */
    // Vault mouth run: shaft at 26 threads between the tutorial rail's posts.
    underGallery(b, 14, { len: 47, row: 34, shafts: [12], hazards: 0, crystal: false });
    // Cutting-floor run: rail-threaded, entered at 78 (before the spike
    // clocks) or 130 (off the terrace, past secret room 2's far wall).
    underGallery(b, 69, { len: 91, row: 34, shafts: [9, 61], hazards: 1, rail: true, crystal: false });
    // Underwhen-opens run: entered from the last shoulder, before the roof.
    underGallery(b, 277, { len: 44, row: 34, shafts: [2], hazards: 0, crystal: false });
    // Signpost run: entered from the finish runway, clear of its patrol.
    underGallery(b, 327, { len: 52, row: 34, shafts: [35], hazards: 1, crystal: false });
  },
};
