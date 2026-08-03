import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  stackedChoice,
  hazardGauntlet,
  sneakUnder,
  stalactiteGallery,
  phaseCrossing,
  quarterPipeBowl,
  leapOfFaith,
  rollersRun,
  secretPocket,
  signpostFinish,
  canopyRun,
} from '../motifs.ts';

/**
 * THE UNDERWHEN — ACT 7 — "Hollow Hour Halls"
 *
 * The underworld act: beneath a hundred columns of surface road runs a
 * hand-carved gallery — the Halls — entered by shafts, ridden by rail, and
 * left by spring lifts, zone-3 style. The UNDER lane is the fast one (the
 * surface above it is trapped and patrolled); a deeper crawl below the Halls
 * hides the act's second secret. The blind leap hangs a crystal in its arc.
 */
const W = 396;

export const act07: LevelDef = {
  name: 'THE UNDERWHEN',
  act: 'ACT 7',
  title: 'Hollow Hour Halls',
  biome: 2,
  theme: 'crystal',
  width: W,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false });
    b.start(4, 24);
    c = stackedChoice(b, c.endX, c.endRow);
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 2, period: 170 });
    c = runway(b, c.endX, c.endRow, { len: 6, checkpoint: true });
    c = sneakUnder(b, c.endX, c.endRow, { secret: true }); // secret 1 (shield pocket)
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 18, count: 4 });

    /* ================= THE HALLS — surface road (84–200) ==================
     * A long trapped road; the gallery below is carved AFTER the whole
     * surface chain exists (build-order rule). Shafts at 96, 150; exit 193.
     */
    b.floor(84, 200, 24);
    b.ringsH(86, 94, 21);
    b.spikeTrap(105, 24, 160, 0);
    b.ringsH(120, 128, 21);
    b.swingBall(130, 14, 9, 170, 0);
    b.enemy(140, 24, 3);
    b.ringsH(160, 168, 21);
    b.checkpoint(186, 24);

    c = phaseCrossing(b, 201, 24, { gap: 7, period: 160 });
    c = runway(b, c.endX, c.endRow, { len: 6, enemy: true });
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 4 });
    const leapX = c.endX;
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 30 });
    b.crystal(leapX + 18, 12); // crystal 1 — hung in the leap's arc (sky)
    c = runway(b, c.endX, c.endRow, { len: 12 }); // flat landing room past the mesa
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 8, checkpoint: true });
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1, depth: 3 });
    c = secretPocket(b, c.endX, c.endRow); // crystal 2, secret 3
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 3, period: 150 });
    c = runway(b, c.endX, c.endRow, { len: W - 16 - c.endX, enemy: true });
    signpostFinish(b, c.endX, c.endRow);

    /* ================= THE HALLS — the gallery below ======================
     * Carved last, out of the bedrock the surface road filled in.
     */
    b.carve(88, 29, 196, 33);
    b.floor(88, 196, 34);
    b.carve(96, 24, 98, 33); // entry shaft, onto the rail
    b.carve(150, 24, 152, 33); // mid shaft
    b.carve(193, 24, 196, 33); // exit shaft
    b.rail(97, 29, 118, 33); // caught on the way down the entry shaft
    b.ringsH(100, 114, 30);
    b.crystal(130, 31); // crystal 3 — the Halls (under)
    b.ringBox(133, 31, 3, 2);
    b.enemy(126, 34, 4);
    b.spikes(140, 142, 34);
    b.enemy(160, 34, 4);
    b.ringsH(156, 170, 31);
    b.spring(151, 34, 11); // back up the mid shaft
    b.spring(152, 34, 11);
    b.spring(195, 34, 11); // the lift out
    b.spring(196, 34, 11);
    // Secret 2: the deeper crawl below the Halls' floor.
    b.carve(170, 34, 178, 37);
    b.floor(170, 178, 38);
    b.secret(170, 34, 178, 37);
    b.monitor(176, 38, 'rings10');
    b.ringBox(172, 36, 3, 1);
    b.spring(170, 38, 11);
    b.spring(171, 38, 11);

    // Sky overlay: two canopy stretches, each carrying a crystal.
    const s = canopyRun(b, 28, 10, { len: 117, crystal: true }); // crystal 4 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 117, crystal: true }); // crystal 5 (sky)
  },
};
