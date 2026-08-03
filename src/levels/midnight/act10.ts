import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  cartCanyon,
  rollersRun,
  stackedChoice,
  corridorLoop,
  sneakUnder,
  hazardGauntlet,
  secretPocket,
  boardSprint,
  stalactiteGallery,
  phaseCrossing,
  quarterPipeBowl,
  signpostFinish,
  canopyRun,
  underGallery,
} from '../motifs.ts';

/**
 * MIDNIGHT ACT 10 — "Ore Cart Terminus"
 *
 * The marshalling yard where every ore line in the foundry ends. Three cart
 * canyons — the first waiting seconds past the gate, the widest ridden at
 * full crash-clock pressure — threaded between everything the biome has
 * taught: board decks, needle roofs, shift-change catwalks and a
 * full-density press gauntlet. The hardest signpost act of the shift.
 */
export const midnight10: LevelDef = {
  name: 'OTHERWHILE FOUNDRY',
  act: 'ACT 10',
  title: 'Ore Cart Terminus',
  biome: 1,
  theme: 'gear',
  width: 400,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: the yard throat
    b.start(4, 24);
    c = runway(b, c.endX, c.endRow, { len: 6, rings: false, dashPad: true }); // 10–15
    c = cartCanyon(b, c.endX, c.endRow, { gap: 7 }); // 16–35: a cart waits at the gate
    b.crystal(24, 20); // 1 (ground) — on the bailers' flight line
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 36–65
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 66–87, crystal 2 (sky shelf)
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 88–95
    c = cartCanyon(b, c.endX, c.endRow, { gap: 9 }); // 96–115: the widest canyon
    b.drone(105, 20, 2);
    c = corridorLoop(b, c.endX, c.endRow); // 116–143
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 144–155, crystal 3 (under), secret 1
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 20, density: 3, period: 120 }); // 156–175
    c = secretPocket(b, c.endX, c.endRow); // 176–185, crystal 4 (ground), secret 2
    c = boardSprint(b, c.endX, c.endRow, { sections: 3, board: true }); // 186–233
    b.drone(196, 20, 2);
    b.drone(210, 20, 2);
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 20, count: 4 }); // 234–253
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 140 }); // 254–272
    b.swingBall(258, 13, 8, 130, 40); // loading tackle over the crossing's near lip
    c = secretPocket(b, c.endX, c.endRow, { reward: 'rings10' }); // 273–282, secret 3
    c = cartCanyon(b, c.endX, c.endRow, { gap: 8 }); // 283–302: the terminus line
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 303–310
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 6 }); // 311–326
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 327–356
    signpostFinish(b, c.endX, c.endRow, { len: 43 }); // 357–399

    // Sky overlay at row 9, running the length of the yard.
    let s = canopyRun(b, 72, 9, { len: 104, crystal: true }); // crystal 5 (sky)
    s = canopyRun(b, s.endX, s.endRow, { len: 104 });
    canopyRun(b, s.endX, s.endRow, { len: 104 });

    // The yard's haulage tunnel, threaded between the three canyons — each
    // canyon ledge (floor 30) keeps its springs and doubles as a raised door
    // onto the bore (walk off its east lip, drop four rows in). No bore
    // before canyon 1: the yard throat is solid, the route opens at the
    // ledge. The sneak-under pocket (146–153, floor 34) merges in with the
    // under crystal. Shafts: stacked-choice deck (82), between stalactites
    // (238), the run-out (372) — clear of the loop corridor (116–143), the
    // gauntlet, the board decks, the phase pit and the bowl.
    underGallery(b, 28, { len: 73, row: 34, shafts: [54], hazards: 1, crystal: false });
    underGallery(b, 110, { len: 178, row: 34, shafts: [128], hazards: 2, crystal: false });
    underGallery(b, 296, { len: 100, row: 34, shafts: [76], hazards: 2, crystal: false });
  },
};
