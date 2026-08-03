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
} from '../motifs.ts';

/**
 * DUSKMERE COAST — ACT 8 — "Sea-Cave Galleries"
 *
 * The minecart act. Three cart canyons of rising length, then the grand
 * gallery: a roofed sea-cave where the cart runs a long track under falling
 * stalactites while the crash buffer waits in plain sight — bail before the
 * impact or pay one hit through the normal damage path. Every canyon floor
 * has a consolation monitor and a spring escape: falling costs time, never
 * a life.
 */
export const act08: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 8',
  title: 'Sea-Cave Galleries',
  biome: 0,
  theme: 'verdant',
  width: 380,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: start apron
    b.start(4, 24);
    c = runway(b, c.endX, c.endRow, { len: 12, dashPad: true }); // 10–21
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 22–51
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 52–59
    c = cartCanyon(b, c.endX, c.endRow, { gap: 7 }); // 60–79: first, gentle ride
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 16, count: 4 }); // 80–95
    c = cartCanyon(b, c.endX, c.endRow, { gap: 9 }); // 96–115: wider canyon
    c = runway(b, c.endX, c.endRow, { len: 8, enemy: true }); // 116–123
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 124–135, CRYSTAL 1 (under) + secret 1

    /* -------------------- The grand gallery (136–175) --------------------
     * A roofed cavern with a long cart track over a deep bay. The roof drips
     * stalactites armed by the passing rider; the bay floor below carries a
     * monitor and a spring lift at the far wall. The track's buffer stands
     * on solid far ground, so the crash always sets the rider down on floor.
     */
    b.floor(136, 141, 24); // boarding shelf, cart waiting
    // The bay bottoms out at row 27: deep enough that missing the cart is a
    // real fall, shallow enough that its floor stays inside the ground band —
    // the route-continuity rule that caps cartCanyon's gap applies here too.
    b.carve(142, 18, 169, 26); // the bay
    b.floor(142, 169, 27);
    b.monitor(145, 27, 'rings10');
    b.spring(168, 27, 12); // the lift out, right at the far wall
    b.spring(169, 27, 12);
    b.floor(170, 175, 24); // far side, carrying the buffer
    b.slab(144, 167, 14, 2); // the cave roof
    b.stalactite(148, 15);
    b.stalactite(153, 15);
    b.stalactite(158, 15);
    b.stalactite(163, 15);
    b.cartRide(139, 24, 171, 24);
    b.ringsH(144, 167, 20); // the flight line for bailers
    b.crystal(155, 22); // CRYSTAL 2 — over the bay, jump from the cart
    b.drone(155, 17, 4); // patrols just under the roof
    c = { endX: 176, endRow: 24 };

    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true }); // 176–183
    c = cartCanyon(b, c.endX, c.endRow, { gap: 8 }); // 184–203
    c = secretPocket(b, c.endX, c.endRow); // 204–213, CRYSTAL 3 + secret 2
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 2, period: 140 }); // 214–229
    c = stalactiteGallery(b, c.endX, c.endRow); // 230–243
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 20 }); // 244–271: blind drop to row 27
    b.crystal(258, 13); // CRYSTAL 4 — riding the leap's ring arc
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 8, enemy: true }); // 272–285, back to 24
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // 286–295, secret 3
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 296–325
    c = runway(b, c.endX, c.endRow, { len: 22 }); // 326–347
    signpostFinish(b, c.endX, c.endRow, { len: 32 }); // 348–379

    // Sky overlay, running the length of the caves above the rooflines.
    const s = canopyRun(b, 70, 8, { len: 130 });
    canopyRun(b, s.endX, s.endRow, { len: 130, crystal: true }); // CRYSTAL 5 (sky)
  },
};
