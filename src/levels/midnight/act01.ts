import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { STORY_HOUR_OF_MIDNIGHT } from '../../game/story.ts';
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
  signpostFinish,
  canopyRun,
  underGallery,
} from '../motifs.ts';

/**
 * MIDNIGHT ACT 1 — "Midnight Clock-In"
 *
 * The foundry gate at the start of the shift that never ends. The biome's
 * vocabulary is introduced gently, one machine at a time: rolling slag hills,
 * a first corridor loop, two steel stalactites under a low gantry roof, a
 * single low-density trap row, and finally a taste of the dash-padded skyway
 * decks (no Mag-Board yet — the vehicle is earned in Act 3). Sky lane is the
 * catwalk chain over the shop floor; the under lane is reached through the
 * maintenance shafts.
 */
export const midnight01: LevelDef = {
  name: 'OTHERWHILE FOUNDRY',
  act: 'ACT 1',
  title: 'Midnight Clock-In',
  biome: 1,
  theme: 'gear',
  width: 320,
  intro: STORY_HOUR_OF_MIDNIGHT,
  build(b: LevelBuilder): void {
    // Ground chain, left to right along row 24. Clocked hazards start far
    // past AMBIENT_RANGE of the start so an idle hero hears nothing.
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: clock-in apron
    b.start(4, 24);
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 10–39: slag rollers
    b.crystal(17, 19); // 1 (ground) — over the first hill crown
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 40–61, crystal 2 (sky shelf)
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 62–69
    c = corridorLoop(b, c.endX, c.endRow); // 70–97: first cog loop
    c = sneakUnder(b, c.endX, c.endRow, { secret: true }); // 98–109, secret 1 (pocket joins the gallery below)
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 14, count: 2 }); // 110–123: two steel needles
    c = secretPocket(b, c.endX, c.endRow); // 124–133, crystal 4 (ground), secret 2
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 134–163
    b.drone(141, 19, 2); // patrol drone over the second roller crown
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true, dashPad: true }); // 164–171
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 14, density: 1 }); // 172–185: one telegraphed trap
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // 186–195, secret 3
    c = quarterPipeBowl(b, c.endX, c.endRow); // 196–209: the half-pipe toy
    c = runway(b, c.endX, c.endRow, { len: 10, enemy: true }); // 210–219
    b.drone(216, 20, 3);
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 220–249
    c = boardSprint(b, c.endX, c.endRow, { sections: 2 }); // 250–283: skyway decks, on foot
    signpostFinish(b, c.endX, c.endRow, { len: 36 }); // 284–319: shift bell

    // Sky overlay: the catwalk chain over the whole shop floor, stamped after
    // the ground per the build-order rule.
    const s = canopyRun(b, 36, 10, { len: 104, crystal: true }); // crystal 5 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 104 });

    // The coolant undercroft: a real service tunnel running the length of the
    // shift, carved LAST so nothing back-fills it. Its floor (row 34) matches
    // the sneak-under pocket at 100–107, which becomes a lit alcove of the
    // gallery; crystal 3 (under) now hangs mid-tunnel. Shafts drop from the
    // stacked-choice deck (56), the trap-row tail (180) and the run-out (296)
    // — all clear of the loop corridor (70–97), the bowl (196–209) and the
    // board-deck pits.
    underGallery(b, 4, { len: 310, row: 34, shafts: [52, 176, 292], hazards: 1, crystal: true });
  },
};
