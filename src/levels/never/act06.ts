import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  railCascade,
  cartCanyon,
  sneakUnder,
  quarterPipeBowl,
  secretPocket,
  rollersRun,
  stalactiteGallery,
  leapOfFaith,
  signpostFinish,
  canopyRun,
  underGallery,
} from '../motifs.ts';

/**
 * THE UNDERWHEN — ACT 6 — "The Long Grind"
 *
 * The ride act: the widest world in the biome (420 columns) and most of it
 * is spent OFF your feet — three grind cascades totalling eight rails, a
 * cart run, and the blind leap to finish. Shelves between rides are just
 * long enough to breathe on. Fast lane: the rails themselves (ground band);
 * every rail keeps a safety floor beneath, so a missed catch costs height
 * and never a life.
 */
const W = 420;

export const act06: LevelDef = {
  name: 'THE UNDERWHEN',
  act: 'ACT 6',
  title: 'The Long Grind',
  biome: 2,
  theme: 'crystal',
  width: W,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 21, { len: 12, rings: false });
    b.start(4, 21);
    c = railCascade(b, c.endX, c.endRow, { steps: 3, run: 6, span: 9, dropEach: 2 }); // ride 1
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 8, checkpoint: true });
    c = cartCanyon(b, c.endX, c.endRow, { gap: 8 }); // ride 2
    c = runway(b, c.endX, c.endRow, { rise: 2, len: 6 });
    const cascade2 = c.endX;
    c = railCascade(b, c.endX, c.endRow, { steps: 2, run: 5, span: 12, dropEach: 2 }); // ride 3
    // A crystal hung over ride 3's first grind line — caught mid-rail.
    b.crystal(cascade2 + 11, 20); // crystal 1 (ground band, over the rail)
    c = runway(b, c.endX, c.endRow, { rise: 2, len: 6, enemy: true });
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // crystal 2 (under), secret 1
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 5 });
    c = railCascade(b, c.endX, c.endRow, { steps: 3, run: 5, span: 10, dropEach: 2 }); // ride 4
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 7, checkpoint: true });
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 6 });
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // secret 2
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 });
    c = secretPocket(b, c.endX, c.endRow); // crystal 3, secret 3
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 14, count: 2 });
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 28 }); // the last ride is airborne
    c = runway(b, c.endX, c.endRow, { len: 12 }); // flat landing room past the mesa
    c = runway(b, c.endX, c.endRow, { rise: 3, len: W - 16 - 6 - c.endX, enemy: true });
    signpostFinish(b, c.endX, c.endRow);

    // Watchers over the cascades.
    b.drone(140, 18, 3);
    b.drone(200, 16, 3);

    // Sky overlay: two canopy stretches, each carrying a crystal.
    const s = canopyRun(b, 30, 9, { len: 130, crystal: true }); // crystal 4 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 130, crystal: true }); // crystal 5 (sky)

    /* ================= UNDER — THE GRINDERS' GALLERY (whole act) ===========
     * The ride act gets a ride-length underworld: a carved route at row 34
     * running beneath all three cascades, broken only at the cart canyon's
     * deep ledge (82-89, floor row 30) — itself standable under-lane floor
     * that bridges the route. Shafts punch through cascade shelves (a missed
     * catch already costs height here, never a life) and flat runways, clear
     * of every rail tip, cart buffer, pipe, launcher and patrol.
     */
    underGallery(b, 14, { len: 68, row: 34, shafts: [15, 60], hazards: 1, rail: true, crystal: false });
    // hazards 0: this stretch owns the sneak-under springs — no teeth beside them.
    underGallery(b, 90, { len: 78, row: 34, shafts: [4, 36], hazards: 0, rail: true, crystal: false });
    underGallery(b, 168, { len: 75, row: 34, shafts: [7, 28], hazards: 1, rail: true, crystal: false });
    underGallery(b, 243, { len: 113, row: 34, shafts: [99], hazards: 1, rail: true, crystal: false });
    underGallery(b, 356, { len: 41, row: 34, shafts: [6, 22], hazards: 1, crystal: false });
  },
};
