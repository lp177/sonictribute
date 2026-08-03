import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  rollersRun,
  stackedChoice,
  corridorLoop,
  boardSprint,
  secretPocket,
  sneakUnder,
  hazardGauntlet,
  stalactiteGallery,
  phaseCrossing,
  quarterPipeBowl,
  railCascade,
  leapOfFaith,
  signpostFinish,
  canopyRun,
} from '../motifs.ts';

/**
 * DUSKMERE COAST — ACT 9 — "Riptide Boardwalk"
 *
 * The Mag-Board returns for one act: a three-section board sprint down the
 * boardwalk is the fast ground line, and after the dismount the act turns
 * into the biome's toughest mixed run — a density-3 gauntlet, a wide phase
 * crossing, a bowl, a rail cascade and the longest leap of faith yet.
 */
export const act09: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 9',
  title: 'Riptide Boardwalk',
  biome: 0,
  theme: 'verdant',
  width: 400,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: start apron
    b.start(4, 24);
    c = runway(b, c.endX, c.endRow, { len: 10, dashPad: true }); // 10–19
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 20–49
    c = runway(b, c.endX, c.endRow, { len: 6, checkpoint: true, enemy: true }); // 50–55
    c = boardSprint(b, c.endX, c.endRow, { sections: 3, board: true }); // 56–103: the boardwalk
    c = corridorLoop(b, c.endX, c.endRow); // 104–131
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 132–153, CRYSTAL 1 (sky shelf)
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 18, density: 3, period: 150 }); // 154–171
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 172–179
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 150 }); // 180–198
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 199–210, CRYSTAL 2 (under) + secret 1
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 6 }); // 211–226
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 16, count: 4 }); // 227–242
    c = secretPocket(b, c.endX, c.endRow); // 243–252, CRYSTAL 3 + secret 2
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6 }); // 253–264, up to row 21
    c = railCascade(b, c.endX, c.endRow); // 265–295, grind down to row 27
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6, enemy: true }); // 296–307, back to 24
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 22 }); // 308–337: blind drop to row 27
    b.crystal(326, 12); // CRYSTAL 4 — riding the leap's ring arc
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 9, checkpoint: true }); // 338–352, back to 24
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shoes' }); // 353–362, secret 3
    c = runway(b, c.endX, c.endRow, { len: 21 }); // 363–383
    signpostFinish(b, c.endX, c.endRow, { len: 16 }); // 384–399

    // Sky overlay, covering the stacked shelves and the whole middle third.
    const s = canopyRun(b, 80, 8, { len: 130, crystal: true }); // CRYSTAL 5 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 117 });
  },
};
