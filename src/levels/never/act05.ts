import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  corridorLoop,
  railCascade,
  cartCanyon,
  stalactiteGallery,
  sneakUnder,
  quarterPipeBowl,
  phaseCrossing,
  secretPocket,
  hazardGauntlet,
  stackedChoice,
  rollersRun,
  leapOfFaith,
  arenaApproach,
  canopyRun,
  underGallery,
} from '../motifs.ts';

/**
 * THE UNDERWHEN — ACT 5 — "Shardheart Lock" — the mid-biome boss check.
 *
 * Everything taught so far, once each, in one sitting: a loop, a rail
 * cascade, a cart canyon, a stalactite run, a phase crossing and a bowl —
 * then the Shard Drill waits behind the arena gates. Difficulty sits square
 * in the middle of the biome's curve; the finale at act 10 is the harder
 * arena approach. Fast lane rotates by section (rails, then ground).
 */
const W = 400;

export const act05: LevelDef = {
  name: 'THE UNDERWHEN',
  act: 'ACT 5',
  title: 'Shardheart Lock',
  biome: 2,
  theme: 'crystal',
  width: W,
  bossKind: 'shard',
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 22, { len: 10, rings: false });
    b.start(4, 22);
    c = corridorLoop(b, c.endX, c.endRow);
    c = runway(b, c.endX, c.endRow, { len: 6, checkpoint: true });
    c = railCascade(b, c.endX, c.endRow, { steps: 2, run: 8, span: 8, dropEach: 2 });
    c = runway(b, c.endX, c.endRow, { rise: 2, len: 8, enemy: true });
    c = cartCanyon(b, c.endX, c.endRow, { gap: 7 });
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 16, count: 3 });
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // crystal 1 (under), secret 1
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 4 });
    c = runway(b, c.endX, c.endRow, { len: 6 });
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 170 });
    c = secretPocket(b, c.endX, c.endRow); // crystal 2, secret 2
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 2, period: 150 });
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // crystal 3 (sky shelf)
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1, rise: 3, crown: 6 });
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shoes' }); // secret 3
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 26 }); // the blind drop before the lock
    c = runway(b, c.endX, c.endRow, { len: 12 }); // flat landing room past the mesa
    c = runway(b, c.endX, c.endRow, { rise: 3, len: W - 36 - 6 - c.endX });
    arenaApproach(b, c.endX, c.endRow, { width: 36 });

    // A patrol drone over the mid-act to keep the sky honest.
    b.drone(217, 18, 3);

    // Sky overlay: two canopy stretches, each carrying a crystal.
    const s = canopyRun(b, 40, 10, { len: 117, crystal: true }); // crystal 4 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 117, crystal: true }); // crystal 5 (sky)

    /* ================ UNDER — THE LOCK'S UNDERCROFT (whole act) ============
     * A biome-length carved route at row 34 running beneath the exam. It
     * breaks only at the cart canyon's deep ledge (98-104, floor row 30),
     * which is itself standable under-lane floor and bridges the route, and
     * it stops short of the arena — the boss floor stays whole. Shafts avoid
     * the loop's run-up corridor (10-37), the cart track and buffer, the
     * bowl's pipes, the leap launcher and every patrol range. The sneak-under
     * pocket (floor 34) opens straight into the corridor.
     */
    underGallery(b, 14, { len: 84, row: 34, shafts: [32, 49], hazards: 1, rail: true, crystal: false });
    // hazards 0: this stretch owns the sneak-under springs — no teeth beside them.
    underGallery(b, 105, { len: 68, row: 34, shafts: [4, 53], hazards: 0, rail: true, crystal: false });
    underGallery(b, 173, { len: 90, row: 34, shafts: [1, 48], hazards: 1, rail: true, crystal: false });
    underGallery(b, 263, { len: 93, row: 34, shafts: [25, 67, 85], hazards: 1, rail: true, crystal: false });
  },
};
