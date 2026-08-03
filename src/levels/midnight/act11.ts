import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  corridorLoop,
  stackedChoice,
  boardSprint,
  sneakUnder,
  stalactiteGallery,
  phaseCrossing,
  secretPocket,
  hazardGauntlet,
  cartCanyon,
  railCascade,
  quarterPipeBowl,
  leapOfFaith,
  arenaApproach,
  canopyRun,
  underGallery,
} from '../motifs.ts';

/**
 * MIDNIGHT ACT 11 — "Last Shift Bell"
 *
 * The biome finale. Every machine of the endless shift stands between the
 * runner and the second Hour Shard: board decks, needle roofs, the fastest
 * shift-change bells, a full-pressure gauntlet, carts, rails — and then the
 * hardest arena approach in the foundry: a quarter-pipe leap of faith that
 * drops the runner BLIND onto the press arena's own floor, ring trail first,
 * with the trigger line waiting in the dark below.
 */
export const midnight11: LevelDef = {
  name: 'OTHERWHILE FOUNDRY',
  act: 'ACT 11',
  title: 'Last Shift Bell',
  biome: 1,
  theme: 'gear',
  width: 420,
  bossKind: 'press',
  bossRage: true, // the finale rematch runs the escalated pattern
  build(b: LevelBuilder): void {
    // The finale opens NOTHING like act 6: no rollers, no early loop — the
    // shift bell goes straight to machinery. Dip runway, stalactite roof,
    // cart over the first chasm, THEN the loop, and the board run comes late.
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: the final gate
    b.start(4, 24);
    c = stackedChoice(b, c.endX, c.endRow, { len: 26, crystal: true }); // 10–35, crystal 1 (sky shelf)
    b.drone(24, 12, 3);
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 22, count: 4 }); // 36–57: the roof bites first
    c = cartCanyon(b, c.endX, c.endRow, { gap: 8 }); // 58–77: first ride, early
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 78–85
    c = corridorLoop(b, c.endX, c.endRow, { drop: 2, corridor: 26 }); // 86–119
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 120–131, crystal 2 (under), secret 1
    c = boardSprint(b, c.endX, c.endRow, { sections: 3, board: true }); // 132–179: last board run
    b.drone(158, 20, 2);
    c = runway(b, c.endX, c.endRow, { len: 4, rings: false }); // 180–183
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 130 }); // 184–202: the fastest bell
    b.swingBall(188, 13, 8, 120, 0); // tackle over the crossing's near lip
    c = secretPocket(b, c.endX, c.endRow); // 203–212, crystal 3 (ground), secret 2
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 20, density: 3, period: 110 }); // 213–232: full pressure
    c = cartCanyon(b, c.endX, c.endRow, { gap: 9 }); // 233–252
    b.drone(243, 20, 2);
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // 253–262, secret 3
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 5 }); // 263–273, up to row 21
    c = railCascade(b, c.endX, c.endRow); // 274–304, grind down to row 27
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6, checkpoint: true, enemy: true }); // 305–316
    b.swingBall(309, 16, 7, 120, 60);
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 6 }); // 317–332
    // The finale's approach IS a leap of faith: over the lip, blind, ring
    // trail promising a floor — and the floor is the arena's own apron.
    c = leapOfFaith(b, c.endX, c.endRow, { drop: 3, glide: 14 }); // 333–354, lands on row 27
    b.crystal(350, 9); // 4 (sky) — the last crystal before the fight
    c = runway(b, c.endX, c.endRow, { len: 15, enemy: true }); // 355–369
    arenaApproach(b, c.endX, c.endRow, { width: 50 }); // 370–419: the last bell

    // Sky overlay; it ends at the leap — past that, everyone falls together.
    let s = canopyRun(b, 44, 10, { len: 104, crystal: true }); // crystal 5 (sky)
    s = canopyRun(b, s.endX, s.endRow, { len: 104 });
    canopyRun(b, s.endX, s.endRow, { len: 104 });

    // The last shift's escape tunnel: three trap-laced bores split by the two
    // cart canyons, whose ledges (floor 30) keep their springs and act as
    // drop-in doors onto the bores east of them. The sneak-under pocket
    // (122–129, floor 34) merges into the middle bore, under crystal and
    // all; the east bore runs right up to the arena wall (col 369) and no
    // further — the Piston Press is fought on solid floor. Shafts: the
    // stacked-choice deck (32), between stalactites (41), mid-gauntlet
    // (218), the high runway (270) and the pre-arena walk (366) — clear of
    // the loop corridor (86–119), board decks (132–179), the phase pit, the
    // rail cascade, the bowl and the leap.
    underGallery(b, 4, { len: 59, row: 34, shafts: [28, 37], hazards: 2, crystal: false });
    underGallery(b, 71, { len: 167, row: 34, shafts: [147], hazards: 2, crystal: false });
    underGallery(b, 247, { len: 123, row: 34, shafts: [23, 119], hazards: 2, crystal: false });
  },
};
