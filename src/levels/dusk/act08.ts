import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  rollersRun,
  cartCanyon,
  secretPocket,
  sneakUnder,
  hazardGauntlet,
  stalactiteGallery,
  leapOfFaith,
  signpostFinish,
  canopyRun,
  skySteps,
} from '../motifs.ts';

/**
 * DUSKMERE COAST — ACT 8 — "Sea-Cave Galleries"
 *
 * The minecart act, and now the galleries live up to the name: the very
 * first stretch is a cart canyon (each act opens differently — this one
 * opens on its toy), and beneath the whole shore runs a true sea-cave
 * corridor. It is hand-carved rather than stamped because the cart canyons'
 * consolation floors (row 30) must survive as shelves in its ceiling — the
 * second canyon's floor even has a carved door straight down into the cave.
 * The sky alternates catwalks and stepped platforms over the cave roofs.
 */
export const act08: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 8',
  title: 'Sea-Cave Galleries',
  biome: 0,
  theme: 'verdant',
  width: 380,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 12, rings: false }); // 0–11: start apron
    b.start(4, 24);
    c = cartCanyon(b, c.endX, c.endRow, { gap: 7 }); // 12–31: the cart, immediately
    c = runway(b, c.endX, c.endRow, { len: 8, dashPad: true }); // 32–39
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 40–69
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true }); // 70–77 (shaft at 74)
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 16, count: 4 }); // 78–93
    c = cartCanyon(b, c.endX, c.endRow, { gap: 9 }); // 94–113: wider canyon (cave door in its floor)
    c = runway(b, c.endX, c.endRow, { len: 8, enemy: true }); // 114–121
    c = sneakUnder(b, c.endX, c.endRow, { secret: true }); // 122–133, secret 1 (opens into the cave)

    /* -------------------- The grand gallery (134–173) --------------------
     * A roofed cavern with a long cart track over a deep bay. The roof drips
     * stalactites armed by the passing rider; the bay floor below carries a
     * monitor and a spring lift at the far wall. The track's buffer stands
     * on solid far ground, so the crash always sets the rider down on floor.
     */
    b.floor(134, 139, 24); // boarding shelf, cart waiting
    b.carve(140, 18, 167, 26); // the bay (floor row 27 keeps it in the ground band)
    b.floor(140, 167, 27);
    b.monitor(143, 27, 'rings10');
    b.spring(166, 27, 12); // the lift out, right at the far wall
    b.spring(167, 27, 12);
    b.floor(168, 173, 24); // far side, carrying the buffer
    b.slab(142, 165, 14, 2); // the cave roof
    b.stalactite(146, 15);
    b.stalactite(151, 15);
    b.stalactite(156, 15);
    b.stalactite(161, 15);
    b.cartRide(137, 24, 169, 24);
    b.ringsH(142, 165, 20); // the flight line for bailers
    b.crystal(153, 22); // CRYSTAL 1 — over the bay, jump from the cart
    b.drone(153, 17, 4); // patrols just under the roof
    c = { endX: 174, endRow: 24 };

    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true }); // 174–181 (shaft at 178)
    c = cartCanyon(b, c.endX, c.endRow, { gap: 8 }); // 182–201
    c = secretPocket(b, c.endX, c.endRow); // 202–211, CRYSTAL 2 + secret 2
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 2, period: 140 }); // 212–227
    c = stalactiteGallery(b, c.endX, c.endRow); // 228–241
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 20 }); // 242–269: blind drop to row 27
    b.crystal(256, 13); // CRYSTAL 3 — riding the leap's ring arc
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 8 }); // 270–283, back to 24 (shaft at 278)
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // 284–293, secret 3
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 294–323
    c = runway(b, c.endX, c.endRow, { len: 22 }); // 324–345 (shaft at 338)
    signpostFinish(b, c.endX, c.endRow, { len: 34 }); // 346–379

    // Sky overlay over the rooflines: catwalks and stepped platforms taking
    // turns, with the trapped set past the grand gallery.
    const s1 = canopyRun(b, 70, 8, { len: 52 }); // 70–121
    const k1 = skySteps(b, s1.endX, 9, { steps: 4, drone: true, trap: false }); // 122–152
    const s2 = canopyRun(b, k1.endX, 8, { len: 78, crystal: true }); // 153–230, CRYSTAL 5 (sky)
    const k2 = skySteps(b, s2.endX, 9, { steps: 5, trap: true, drone: false }); // 231–268
    canopyRun(b, k2.endX, 8, { len: 52 }); // 269–320

    /* ============================ UNDER ROUTE ============================
     * The sea-cave proper, hand-carved LAST so nothing back-fills it. The
     * ceiling is row 30 except beneath the two later cart canyons, where
     * their consolation floors (row 30) survive as one-tile shelves and the
     * corridor ducks a row lower. Entered by light-well shafts on the plain
     * runways, by the sneak-under, and through the door in canyon 2's floor.
     */
    b.carve(28, 30, 98, 33);
    b.carve(99, 31, 107, 33); // duck under canyon 2's floor
    b.carve(108, 30, 186, 33);
    b.carve(187, 31, 194, 33); // duck under canyon 3's floor
    b.carve(195, 30, 343, 33);
    b.floor(28, 343, 34);
    // Light-well shafts (3 wide, carved from row 18 so they read from the
    // surface), each with its spring lift back out.
    for (const sx of [74, 178, 278, 338]) {
      b.carve(sx, 18, sx + 2, 33);
      b.spring(sx, 34, 13);
      b.spring(sx + 1, 34, 13);
    }
    // The door in canyon 2's floor: fall past the consolation ledge into the
    // cave; springs climb back to the ledge's own escape.
    b.carve(102, 30, 103, 33);
    b.spring(102, 34, 13);
    b.spring(103, 34, 13);
    // The cave pays its way: rings, a patrol, teeth, a grind line, and the
    // under-lane crystal deep inside.
    b.ringsH(44, 54, 32);
    b.ringsH(210, 220, 32);
    b.enemy(150, 34, 4);
    b.spikes(160, 161, 34);
    b.spikeTrap(250, 34, 150, 40);
    b.rail(216, 31, 240, 32); // sets the rider down on open floor at 240
    b.crystal(196, 32); // CRYSTAL 4 — past canyon 3's underside
  },
};
