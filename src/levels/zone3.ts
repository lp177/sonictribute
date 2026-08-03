import type { LevelDef, LevelBuilder } from '../game/Level.ts';
import { STORY_ACT3 } from '../game/story.ts';

/**
 * ZONE 3 — THE CHRONO VAULT
 *
 * The cavern the Chrono Core was cut out of: violet rock, luminous crystal,
 * and the old cutters' GRIND RAILS still bolted to the walls. Rails are this
 * zone's signature toy and its verbs are all built around them:
 *
 *   - a rail always starts where the rock ENDS. You board one by running off
 *     a lip, never by walking onto it, so a grind is something you commit to
 *     rather than something that happens to you.
 *   - every rail has a floor under it. Missing one costs height and time, and
 *     nothing else — there is no bottomless anything in the Vault.
 *   - the slope IS the gameplay (see RAIL): the dives build speed, the one
 *     climbing rail spends it.
 *
 * THREE ROUTES, as every zone owes:
 *   SKY    (rows 3–12)  — the crystal canopy, entered off the launcher at 148
 *                         or the climbing rail, and left on a long dive into
 *                         the arena approach.
 *   GROUND (rows 18–27) — the cutting floor: two loops, a chasm bridged by a
 *                         rail, a rail dive into the gallery, and both of the
 *                         surface secrets.
 *   UNDER  (rows 28–34) — the drainage gallery, entered by dropping onto a
 *                         rail through a shaft or by diving into it at 45°,
 *                         left by spring lifts.
 *
 * TERRAIN RULE (as zones 1 and 2): the running route only ever changes height
 * with `hill`/`dip`/`gentleUp`/`gentleDown`. 45° faces read as walls at speed.
 * Drops are fine — falling never costs a life here — but climbs are not.
 *
 * BUILD ORDER: ground first (floors fill to bedrock), then the canopy, then
 * the gallery is CARVED out of the bedrock and given its own floor.
 */
export const zone3: LevelDef = {
  name: 'CHRONO VAULT',
  act: 'ACT 3',
  title: 'The First Vein',
  biome: 2,
  theme: 'crystal',
  bossKind: 'shard',
  intro: STORY_ACT3,
  build(b: LevelBuilder): void {
    /* ======================== A — VAULT MOUTH (0–20) ======================= */
    b.floor(0, 20, 21);
    b.start(4, 21);
    b.ringsH(7, 12, 18);
    b.monitor(17, 21, 'rings10');

    /* ====================== B — THE FIRST GRIND (21–60) ====================
     * The mouth ends in a lip and the vault's first rail hangs off it: the
     * whole mechanic taught in one move, with a soft landing either way.
     */
    b.floor(21, 60, 24);
    b.rail(21, 21, 35, 24); // RAIL — the tutorial descent
    b.ringsH(22, 25, 20); // the ring line follows the rail down
    b.ringsH(27, 30, 21);
    b.ringsH(32, 35, 22);
    b.loop(44, 24);
    b.ringsH(52, 57, 21);
    b.enemy(55, 24, 3);
    b.dashPad(59, 24, 1, 11); // feeds the chasm rail with speed

    /* ==================== C — THE CUTTERS' CHASM (61–68) ===================
     * The floor is simply gone. The rail is the bridge; the ledge far below
     * is the consolation, with springs back up — falling costs time, never a
     * life. The bridge starts one tile INTO the gap, so a crawl drops in and
     * a run sails across.
     */
    b.floor(61, 68, 30);
    b.rail(62, 24, 69, 24); // RAIL — the bridge
    b.ringsH(62, 68, 22);
    b.ringBox(63, 27, 3, 2);
    b.spring(64, 30, 12);
    b.spring(65, 30, 12);

    /* ==================== D — THE CUTTING FLOOR (69–110) =================== */
    b.floor(69, 110, 24);
    b.checkpoint(74, 24);
    b.ringsH(70, 75, 21);
    b.spikeTrap(84, 24, 150, 0); // telegraphed: the plate rattles first
    b.spikeTrap(85, 24, 150, 0);
    b.enemy(89, 24, 3);
    b.swingBall(92, 14, 9, 160, 0);
    b.monitor(94, 24, 'shoes');
    b.crumble(96, 98, 21); // a ledge that gives way over the ring line
    b.ringsH(96, 98, 19);
    // Secret room 1, under the cutting floor.
    b.carve(100, 24, 101, 27);
    b.carve(100, 25, 108, 27);
    b.secret(100, 24, 108, 27);
    b.crystal(105, 26); // 1 — ground secret
    b.ringBox(102, 26, 2, 1);
    b.monitor(107, 28, 'shield');
    b.spring(100, 28, 12);
    b.spring(101, 28, 12);

    /* ================== E — THE SHARD TERRACE (111–166) ==================== */
    b.gentleUp(111, 23, 3); // 111–116, up to row 21
    b.floor(117, 140, 21);
    b.ringsH(122, 127, 18);
    // Secret room 2: a shaft in the terrace floor.
    b.carve(119, 21, 120, 25);
    b.carve(119, 23, 128, 25);
    b.secret(119, 21, 128, 25);
    b.crystal(124, 24); // 2 — terrace secret
    b.ringBox(121, 24, 2, 1);
    b.monitor(127, 26, 'rings10');
    b.spring(119, 26, 12);
    b.spring(120, 26, 12);
    b.drone(133, 17, 3);
    b.enemy(137, 21, 3);
    b.launchRamp(141, 21, 3); // 141–148: the shot up into the canopy
    // Ease back down off the pad: a straight drop to the base row would be a
    // 3-tile cliff for anyone who arrived too slow to fire the launcher.
    b.gentleDown(149, 18, 3); // 149–154, back to row 21
    b.floor(155, 160, 21);
    b.gentleDown(161, 21, 3); // 161–166, down to the deep corridor

    /* ==================== F — THE DEEP CORRIDOR (167–216) ================== */
    b.floor(167, 200, 24);
    b.loop(175, 24);
    b.ringsH(184, 189, 21);
    b.checkpoint(190, 24);
    b.spikeTrap(193, 24, 140, 70);
    b.dip(201, 24, 2, 8); // 201–216, a basin that keeps rolling speed
    b.spikes(207, 209, 26);
    b.platform(205, 212, 22);
    b.ringsH(206, 211, 20);
    b.enemy(214, 24, 2);

    /* ===================== G — THE DIVE (217–239) ==========================
     * The corridor ends over the gallery. Walk off and a 45° rail takes you
     * straight down into the underworld at speed; run at it and you clear the
     * gap entirely. Both are progress — the gallery comes back up at 264.
     */
    b.floor(217, 231, 24);
    b.ringsH(218, 223, 21);
    b.drone(226, 20, 3);
    b.rail(232, 24, 239, 31); // RAIL — the 45° dive into the gallery

    /* ==================== H — THE LAST SHOULDER (240–319) ================== */
    b.floor(240, 241, 24);
    b.hill(242, 24, 3, 6); // 242–259, crown row 21
    b.checkpoint(250, 21);
    b.ringsH(248, 253, 18);
    b.monitor(252, 21, 'rings10');
    b.floor(260, 319, 24);
    b.enemy(272, 24, 4);
    b.ringsH(276, 281, 21);
    b.boss(292, 286, 318);
    b.goal(314, 24);

    /* ======================= SKY — THE CRYSTAL CANOPY =====================
     * Shelves of grown crystal under the cavern roof. The launcher throws you
     * onto the long catwalk; one rail climbs between shelves, and the last
     * one is a long dive that spends every tile of height on speed.
     */
    b.platform(150, 159, 8);
    b.ringsH(151, 158, 6);
    b.platform(168, 190, 10); // the catwalk the launcher lands on
    b.ringsH(170, 176, 8);
    b.ringsH(182, 188, 8);
    b.monitor(179, 10, 'shield');
    b.platform(196, 204, 6);
    b.crystal(200, 4); // 3 — canopy route
    b.rail(205, 6, 219, 3); // RAIL — the climb between shelves
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
    b.rail(270, 12, 283, 24); // RAIL — the long dive into the arena approach

    /* ==================== UNDER — THE DRAINAGE GALLERY =====================
     * Carved out of the bedrock AFTER the surface exists. Two shafts down and
     * the dive in; spring lifts out. Falling here costs time, never a life.
     */
    b.carve(160, 28, 268, 33);
    b.floor(160, 268, 34);
    b.carve(196, 24, 199, 33); // drop shaft, onto the gallery rail
    b.carve(232, 24, 239, 33); // the dive shaft
    b.carve(264, 24, 268, 33); // exit shaft
    b.rail(197, 30, 220, 33); // RAIL — caught on the way down the shaft
    b.ringsH(202, 210, 31);
    b.crystal(214, 31); // 4 — the gallery
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
    b.crystal(273, 32); // 5 — deep secret
    b.ringBox(271, 32, 2, 1);
  },
};
