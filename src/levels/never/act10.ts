import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  rollersRun,
  stalactiteGallery,
  cartCanyon,
  phaseCrossing,
  hazardGauntlet,
  sneakUnder,
  quarterPipeBowl,
  railCascade,
  stackedChoice,
  secretPocket,
  leapOfFaith,
  arenaApproach,
  canopyRun,
  underGallery,
} from '../motifs.ts';

/**
 * THE UNDERWHEN — ACT 10 — "Vault of No Hours" — the biome finale.
 *
 * The hardest arena approach in the biome: the widest cart canyon, the
 * biome's tightest phase clocks (140), back-to-back density-3 gauntlets on
 * 130-frame periods, and a 22-column five-spike stalactite roof — all funnel
 * into a wide arena where the Shard Drill makes its last stand. Everything
 * stays telegraphed; the difficulty is the rhythm's tempo, never ambush.
 */
const W = 420;

export const act10: LevelDef = {
  name: 'THE UNDERWHEN',
  act: 'ACT 10',
  title: 'Vault of No Hours',
  biome: 2,
  theme: 'crystal',
  width: W,
  bossKind: 'shard',
  bossRage: true, // the finale rematch runs the escalated pattern
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false });
    b.start(4, 24);
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 });
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 18, count: 4 });
    c = cartCanyon(b, c.endX, c.endRow, { gap: 9 });
    c = runway(b, c.endX, c.endRow, { len: 6, checkpoint: true });
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 140 });
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 18, density: 3, period: 140 });
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // crystal 1 (under), secret 1
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 4 });
    c = runway(b, c.endX, c.endRow, { len: 6, enemy: true });
    c = railCascade(b, c.endX, c.endRow, { steps: 2, run: 6, span: 9, dropEach: 1 }); // shallow fast grinds
    c = runway(b, c.endX, c.endRow, { rise: 2, len: 6 });
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // crystal 2 (sky shelf)
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 22, count: 5 }); // the long roof
    c = secretPocket(b, c.endX, c.endRow); // crystal 3, secret 2
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 24 }); // the last blind drop
    c = runway(b, c.endX, c.endRow, { len: 12 }); // flat landing room past the mesa
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 8, checkpoint: true });
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 3, period: 130 }); // the door knocker
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // secret 3
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 140 });
    c = runway(b, c.endX, c.endRow, { len: W - 40 - c.endX, enemy: true });
    arenaApproach(b, c.endX, c.endRow, { width: 40 }); // the wide last stand

    // A watcher over the first gauntlet.
    b.drone(112, 18, 2);

    // Sky overlay: two canopy stretches, each carrying a crystal.
    const s = canopyRun(b, 30, 10, { len: 130, crystal: true }); // crystal 4 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 130, crystal: true }); // crystal 5 (sky)

    /* ================ UNDER — THE VAULT BENEATH THE VAULT ==================
     * The finale's carved route at row 34 runs from the swells to the arena
     * door and stops there — the boss floor stays whole. It breaks only at
     * the cart canyon's deep ledge (63-71, floor row 30), standable
     * under-lane floor that bridges the route. Shafts punch a swell crown,
     * cascade shelves, the stacked road and the last phase pit's floor,
     * clear of every gauntlet clock, pipe, cart buffer and patrol range;
     * the sneak-under pocket (floor 34) opens straight into the corridor.
     */
    // One shaft, placed after the dip: a runner reaches it carrying full
    // rolling speed and sails over. A hole at the slow uphill crown proved a
    // trap — the flow bot fell in and dead-ended against the segment wall.
    underGallery(b, 14, { len: 44, row: 34, shafts: [24], hazards: 1, crystal: false });
    // hazards spared where the motif's teeth would land beside shaft springs.
    underGallery(b, 76, { len: 80, row: 34, shafts: [0], hazards: 1, rail: true, crystal: false });
    underGallery(b, 156, { len: 80, row: 34, shafts: [14, 58], hazards: 1, rail: true, crystal: false });
    underGallery(b, 236, { len: 80, row: 34, shafts: [34, 52], hazards: 0, rail: true, crystal: false });
    underGallery(b, 316, { len: 56, row: 34, shafts: [26, 39], hazards: 0, crystal: false });
  },
};
