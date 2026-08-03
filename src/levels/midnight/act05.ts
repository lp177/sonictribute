import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  rollersRun,
  corridorLoop,
  stackedChoice,
  sneakUnder,
  stalactiteGallery,
  secretPocket,
  hazardGauntlet,
  quarterPipeBowl,
  boardSprint,
  cartCanyon,
  signpostFinish,
  canopyRun,
} from '../motifs.ts';

/**
 * MIDNIGHT ACT 5 — "Coolant Undercroft"
 *
 * The cellars where the coolant runs. This act leans downward: a deep triple
 * dip right after the gate, TWO underworld pockets (one secret, one open
 * larder), and the longest stalactite roof so far. The under lane is the
 * scenic-fast route here — both sneak-under shafts pay out for divers, while
 * the surface pays in traps.
 */
export const midnight05: LevelDef = {
  name: 'OTHERWHILE FOUNDRY',
  act: 'ACT 5',
  title: 'Coolant Undercroft',
  biome: 1,
  theme: 'gear',
  width: 350,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: cellar door
    b.start(4, 24);
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1, depth: 3, basin: 6 }); // 10–45: the deep dip
    b.crystal(35, 25); // 1 (ground) — down in the coolant basin
    c = runway(b, c.endX, c.endRow, { len: 6, checkpoint: true }); // 46–51
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 52–63, crystal 2 (under), secret 1
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 18, count: 3 }); // 64–81: dripstone steel
    c = corridorLoop(b, c.endX, c.endRow); // 82–109
    b.drone(108, 22, 2); // guards the climb out of the loop corridor
    c = stackedChoice(b, c.endX, c.endRow, { len: 24, crystal: true }); // 110–133, crystal 3 (sky shelf)
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 134–141
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 2, period: 130 }); // 142–157
    c = secretPocket(b, c.endX, c.endRow); // 158–167, crystal 4 (ground), secret 2
    c = boardSprint(b, c.endX, c.endRow, { sections: 2 }); // 168–201: decks over coolant pits
    b.drone(178, 20, 2);
    b.drone(192, 20, 2);
    c = quarterPipeBowl(b, c.endX, c.endRow); // 202–215
    c = secretPocket(b, c.endX, c.endRow, { reward: 'rings10' }); // 216–225, secret 3
    c = cartCanyon(b, c.endX, c.endRow, { gap: 8 }); // 226–245
    c = sneakUnder(b, c.endX, c.endRow); // 246–257: the open larder (shield below)
    c = runway(b, c.endX, c.endRow, { len: 8, enemy: true }); // 258–265
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 266–295
    signpostFinish(b, c.endX, c.endRow, { len: 54 }); // 296–349

    // Sky overlay at row 11 — the undercroft's service walk, thinner rewards
    // than usual: this act pays underground.
    let s = canopyRun(b, 48, 11, { len: 104, crystal: true }); // crystal 5 (sky)
    s = canopyRun(b, s.endX, s.endRow, { len: 104 });
    canopyRun(b, s.endX, s.endRow, { len: 52 });
  },
};
