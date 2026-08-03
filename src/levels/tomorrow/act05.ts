import type { LevelBuilder, LevelDef } from '../../game/Level.ts';
import {
  runway,
  corridorLoop,
  stackedChoice,
  phaseCrossing,
  leapOfFaith,
  railCascade,
  cartCanyon,
  sneakUnder,
  stalactiteGallery,
  secretPocket,
  hazardGauntlet,
  quarterPipeBowl,
  arenaApproach,
  canopyRun,
  underGallery,
} from '../motifs.ts';

const W = 352;

/**
 * NOON TOMORROW — ACT 5: the mid-biome checkpoint fight. Everything taught
 * so far — phase, rails, a cart, a density-3 gauntlet — funnels into a wide
 * plaza where the Mirage waits. The approach is honest; the arena is the
 * test. Fast lane: GROUND into the cascade dive.
 */
export const act05: LevelDef = {
  name: 'NOON TOMORROW',
  act: 'ACT 5',
  title: 'Mirage Toll Gate',
  biome: 3,
  theme: 'neon',
  width: W,
  bossKind: 'mirage',
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: start apron
    b.start(4, 24);
    c = stackedChoice(b, c.endX, c.endRow); // 10–31: monitor shelf, no crystal
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 160 }); // 32–49
    c = runway(b, c.endX, c.endRow, { len: 6, rise: 3, checkpoint: true, dashPad: true }); // 50–61, up to 21
    c = railCascade(b, c.endX, c.endRow); // 62–92: dive to row 27
    c = runway(b, c.endX, c.endRow, { len: 5, rise: 3 }); // 93–103, up to 24
    c = cartCanyon(b, c.endX, c.endRow, { gap: 8 }); // 104–123
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 124–135, crystal 1 (under), secret 1
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 3, period: 150 }); // 136–151: first density 3
    c = secretPocket(b, c.endX, c.endRow); // 152–161, crystal 2 (ground), secret 2
    c = corridorLoop(b, c.endX, c.endRow); // 162–189
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 14, count: 3 }); // 190–203
    c = secretPocket(b, c.endX, c.endRow); // 204–213, crystal 3 (ground), secret 3
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 214–221
    b.hopper(220, 24);
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 26 }); // 222–255: blind drop to row 27
    c = runway(b, c.endX, c.endRow, { len: 8, rise: 3 }); // 256–269, up to 24
    c = quarterPipeBowl(b, c.endX, c.endRow); // 270–283
    const fin = arenaApproach(b, c.endX, c.endRow, { width: 68 }); // 284–351: the toll plaza
    if (fin.endX !== W) throw new Error(`act05 chain ends at ${fin.endX}, not ${W}`);

    // Sky overlay, clear of the leap zone's air.
    const s = canopyRun(b, 36, 9, { len: 100, crystal: true }); // crystal 4 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 82, crystal: true }); // crystal 5 (sky)
    b.phasePlatform(44, 48, 9, 170, 0);
    b.drone(75, 6, 3);
    b.drone(180, 6, 3);

    // Undercity metro gallery, split around the cart canyon (109-116, ledge
    // floor on row 30 sits in the carve band; the ledge itself bridges the
    // under lane over the 2-tile seams) and ending flush with the toll
    // plaza — no tunnelling under the boss arena. Segment A shafts: 26
    // (under a stackedChoice shelf, clear of the crab at 17-23) and 100 (the
    // flat before the canyon boarding edge). Segment B shaft: 266 (plain
    // floor past the checkpoint) — clear of the loop at 162-189, the leap
    // zone at 222-255 and the bowl at 270-283; the sneakUnder pocket at
    // 126-133 merges in as segment B's western entrance.
    underGallery(b, 12, { len: 97, shafts: [14, 88], hazards: 1, crystal: false });
    underGallery(b, 119, { len: 165, shafts: [147], hazards: 1, crystal: false });
  },
};
