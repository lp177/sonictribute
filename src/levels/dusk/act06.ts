import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  rollersRun,
  stackedChoice,
  corridorLoop,
  secretPocket,
  sneakUnder,
  hazardGauntlet,
  quarterPipeBowl,
  railCascade,
  leapOfFaith,
  arenaApproach,
  canopyRun,
} from '../motifs.ts';

/**
 * DUSKMERE COAST — ACT 6 — "Duskgate Bastion"
 *
 * The mid-biome check: the Wrecking Pod guards the bastion gate. Everything
 * taught so far gets one rep — rollers, loop, rail cascade, bowl, leap —
 * before a straightforward arena. The finale at act 11 reprises this fight
 * with a nastier approach; here the fight itself is the lesson.
 */
export const act06: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 6',
  title: 'Duskgate Bastion',
  biome: 0,
  theme: 'verdant',
  width: 360,
  bossKind: 'pod',
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: start apron
    b.start(4, 24);
    c = runway(b, c.endX, c.endRow, { len: 12, dashPad: true }); // 10–21
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 22–43, CRYSTAL 1 (sky shelf)
    c = rollersRun(b, c.endX, c.endRow, { cycles: 2 }); // 44–101
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 102–109
    c = corridorLoop(b, c.endX, c.endRow); // 110–137
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6 }); // 138–149, up to row 21
    c = railCascade(b, c.endX, c.endRow); // 150–180, grind down to row 27
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 7, checkpoint: true }); // 181–193, back to 24
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 194–205, CRYSTAL 2 (under) + secret 1
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 2, period: 150 }); // 206–221
    c = secretPocket(b, c.endX, c.endRow); // 222–231, CRYSTAL 3 + secret 2
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 4 }); // 232–245
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 18 }); // 246–271: blind drop to row 27
    b.crystal(259, 13); // CRYSTAL 4 — riding the leap's ring arc
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 8, enemy: true }); // 272–285, back to 24
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // 286–295, secret 3 (armour for the fight)
    c = runway(b, c.endX, c.endRow, { len: 16 }); // 296–311
    b.drone(240, 18, 4); // harries the bowl-to-leap stretch
    arenaApproach(b, c.endX, c.endRow, { width: 48 }); // 312–359: the Pod's arena

    // Sky overlay, joined to the stacked shelves near the start.
    const s = canopyRun(b, 46, 9, { len: 130, crystal: true }); // CRYSTAL 5 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 117 });
  },
};
