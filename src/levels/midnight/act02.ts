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
  leapOfFaith,
  rollersRun,
  signpostFinish,
  canopyRun,
} from '../motifs.ts';

/**
 * MIDNIGHT ACT 2 — "Slaglight Causeway"
 *
 * The causeway over the slag channels, lit only by furnace glow. First grind
 * rails of the biome (a cascade down into the channel bed), first hopper in
 * the trap row, and the biome's first leap of faith: a quarter-pipe lip flings
 * the runner over a blind slag pit on a ring-guided arc. Runs a row higher
 * than act 1 so the rail cascade can bottom out inside the ground band.
 */
export const midnight02: LevelDef = {
  name: 'OTHERWHILE FOUNDRY',
  act: 'ACT 2',
  title: 'Slaglight Causeway',
  biome: 1,
  theme: 'gear',
  width: 330,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 21, { len: 10, rings: false }); // 0–9: the causeway gate
    b.start(4, 21);
    c = runway(b, c.endX, c.endRow, { len: 6, rings: false, dashPad: true }); // 10–15
    c = corridorLoop(b, c.endX, c.endRow, { drop: 3, corridor: 22 }); // 16–49: channel loop
    c = stackedChoice(b, c.endX, c.endRow, { len: 24, crystal: true }); // 50–73, crystal 1 (sky shelf)
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 74–81
    c = railCascade(b, c.endX, c.endRow); // 82–112: grind down to the channel bed (row 27)
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 7, enemy: true }); // 113–125, back to row 24
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 126–137, crystal 2 (under), secret 1
    c = boardSprint(b, c.endX, c.endRow, { sections: 2 }); // 138–171: dash decks over slag pits
    b.drone(148, 20, 2); // drones hunt over the pits, like the old skyway
    b.drone(162, 20, 2);
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 16, count: 3 }); // 172–187
    c = secretPocket(b, c.endX, c.endRow); // 188–197, crystal 3 (ground), secret 2
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 2 }); // 198–213: first hopper
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shoes' }); // 214–223, secret 3
    c = leapOfFaith(b, c.endX, c.endRow, { drop: 3, glide: 20 }); // 224–251: the blind slag jump
    b.crystal(242, 12); // 4 (sky) — hanging at the top of the leap arc
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 8, checkpoint: true }); // 252–265, back to row 24
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 266–295
    signpostFinish(b, c.endX, c.endRow, { len: 34 }); // 296–329

    // Sky overlay after the ground chain; row 10 sits clear of the leap arc's
    // ring trail (rows 11+), so no catwalk tile can bury a ring.
    let s = canopyRun(b, 48, 10, { len: 104, crystal: true }); // crystal 5 (sky)
    s = canopyRun(b, s.endX, s.endRow, { len: 104 });
    canopyRun(b, s.endX, s.endRow, { len: 39 });
  },
};
