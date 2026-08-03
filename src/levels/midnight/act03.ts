import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  corridorLoop,
  stackedChoice,
  railCascade,
  sneakUnder,
  boardSprint,
  stalactiteGallery,
  secretPocket,
  hazardGauntlet,
  rollersRun,
  signpostFinish,
  canopyRun,
} from '../motifs.ts';

/**
 * MIDNIGHT ACT 3 — "Mainline Mag-Board"
 *
 * The Mag-Board is issued at the depot gate and the mainline opens up: a
 * four-section board sprint right out of the start, then a second (on-foot)
 * deck run later. The widest act so far — this is the biome's first full
 * sprint act, so the ground lane is the fast lane and the rail cascade is a
 * shallow one-row-per-step glide rather than a drop.
 */
export const midnight03: LevelDef = {
  name: 'OTHERWHILE FOUNDRY',
  act: 'ACT 3',
  title: 'Mainline Mag-Board',
  biome: 1,
  theme: 'gear',
  width: 400,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 22, { len: 12, rings: false }); // 0–11: the depot gate
    b.start(4, 22);
    c = runway(b, c.endX, c.endRow, { len: 8, rings: false, dashPad: true, checkpoint: true }); // 12–19
    c = boardSprint(b, c.endX, c.endRow, { sections: 4, board: true }); // 20–81: THE mainline
    b.crystal(58, 17); // 1 (ground) — on the flight line over the third pit
    b.drone(44, 17, 2); // pit guards, dodged at board speed
    b.drone(72, 17, 2);
    c = runway(b, c.endX, c.endRow, { len: 8, enemy: true }); // 82–89
    c = corridorLoop(b, c.endX, c.endRow, { drop: 2 }); // 90–117
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 118–139, crystal 2 (sky shelf)
    c = railCascade(b, c.endX, c.endRow, { steps: 3, run: 5, span: 7, dropEach: 1 }); // 140–181: shallow glide
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 8, checkpoint: true, enemy: true }); // 182–195
    c = secretPocket(b, c.endX, c.endRow); // 196–205, crystal 3 (ground), secret 1
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 2, period: 140 }); // 208–223
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // crystal 4 (under), secret 2
    c = boardSprint(b, c.endX, c.endRow, { sections: 3 }); // 234–281: second deck run, on foot
    b.drone(258, 17, 2);
    c = secretPocket(b, c.endX, c.endRow, { reward: 'rings10' }); // 282–291, secret 3
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 18, count: 3 }); // 292–309
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1, rise: 3, crown: 6 }); // 310–345
    c = runway(b, c.endX, c.endRow, { len: 10, enemy: true }); // 346–355
    signpostFinish(b, c.endX, c.endRow, { len: 44 }); // 356–399

    // Sky overlay at row 9 — clear of the stacked shelf's ring line (row 12).
    let s = canopyRun(b, 60, 9, { len: 104, crystal: true }); // crystal 5 (sky)
    s = canopyRun(b, s.endX, s.endRow, { len: 104 });
    canopyRun(b, s.endX, s.endRow, { len: 104 });
  },
};
