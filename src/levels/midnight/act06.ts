import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  rollersRun,
  corridorLoop,
  stackedChoice,
  boardSprint,
  sneakUnder,
  stalactiteGallery,
  hazardGauntlet,
  secretPocket,
  cartCanyon,
  quarterPipeBowl,
  arenaApproach,
  canopyRun,
  underGallery,
} from '../motifs.ts';

/**
 * MIDNIGHT ACT 6 — "Press Floor Foreman"
 *
 * Mid-shift inspection: the Piston Press itself walks the floor. The approach
 * crosses the press hall — swinging tackle over the walkways, a full-density
 * trap row, a Mag-Board deck run and an ore cart — before the arena gates
 * slam. First boss check of the biome; the finale in act 11 is harder.
 */
export const midnight06: LevelDef = {
  name: 'OTHERWHILE FOUNDRY',
  act: 'ACT 6',
  title: 'Press Floor Foreman',
  biome: 1,
  theme: 'gear',
  width: 360,
  bossKind: 'press',
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: press hall doors
    b.start(4, 24);
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 10–39
    c = corridorLoop(b, c.endX, c.endRow); // 40–67
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 68–89, crystal 1 (sky shelf)
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 90–97
    c = boardSprint(b, c.endX, c.endRow, { sections: 3, board: true }); // 98–145: board past the presses
    b.drone(108, 20, 2);
    b.drone(122, 20, 2);
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 146–157, crystal 2 (under), secret 1
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 16, count: 3 }); // 158–173
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 18, density: 3, period: 140 }); // 174–191: full machinery
    c = secretPocket(b, c.endX, c.endRow); // 192–201, crystal 3 (ground), secret 2
    c = cartCanyon(b, c.endX, c.endRow, { gap: 8 }); // 202–221
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // 222–231, secret 3
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 232–239
    b.swingBall(236, 14, 8, 140, 70); // press tackle swinging over the walkway
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 6 }); // 240–255
    b.crystal(248, 26); // 4 (ground) — cupped inside the bowl
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 256–285
    c = runway(b, c.endX, c.endRow, { len: 20, enemy: true }); // 286–305: the long quiet walk in
    b.swingBall(296, 14, 8, 140, 0);
    arenaApproach(b, c.endX, c.endRow, { width: 54 }); // 306–359: the foreman's floor

    // Sky overlay ends before the arena — the fight is fought on the floor.
    let s = canopyRun(b, 40, 10, { len: 104, crystal: true }); // crystal 5 (sky)
    s = canopyRun(b, s.endX, s.endRow, { len: 104 });
    canopyRun(b, s.endX, s.endRow, { len: 52 });

    // The press hall's under-floor duct, two bores either side of the cart
    // canyon (ledge at row 30 keeps its springs), ending at col 305 so the
    // fight is fought on the arena's own solid floor. The sneak-under pocket
    // (148–155, floor 34) merges in with the under crystal. Mid-shift now:
    // the duct carries pop-up traps as well as fixed spikes. Shafts: the
    // stacked-choice deck (84), between stalactites (163), the pre-arena
    // walk (301) — clear of the loop (40–67), board decks (98–145), the full
    // gauntlet (174–191) and the bowl (240–255).
    underGallery(b, 4, { len: 203, row: 34, shafts: [80, 159], hazards: 2, crystal: false });
    underGallery(b, 215, { len: 91, row: 34, shafts: [86], hazards: 2, crystal: false });
  },
};
