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
  skySteps,
  glideRun,
  underGallery,
} from '../motifs.ts';

/**
 * DUSKMERE COAST — ACT 9 — "Riptide Boardwalk"
 *
 * The Mag-Board returns for one act: a three-section board sprint down the
 * boardwalk is the fast ground line, and after the dismount the act turns
 * into the biome's toughest mixed run — a density-3 gauntlet, a wide phase
 * crossing, a bowl, a rail cascade and the longest leap of faith yet. The
 * act opens over one big swell (no dash-pad apron), the sky mixes steps,
 * catwalks and a closing glide to the goal, and the sea-cave gallery runs
 * beneath it all — its doors include holes in the board sprint's third pit
 * and the phase crossing's floor.
 */
export const act09: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 9',
  title: 'Riptide Boardwalk',
  biome: 0,
  theme: 'verdant',
  width: 400,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 8, rings: false }); // 0–7: start apron
    b.start(4, 24);
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1, rise: 3, crown: 6 }); // 8–43: one big swell
    c = runway(b, c.endX, c.endRow, { len: 6, dashPad: true }); // 44–49
    c = runway(b, c.endX, c.endRow, { len: 6, checkpoint: true, enemy: true }); // 50–55
    c = boardSprint(b, c.endX, c.endRow, { sections: 3, board: true }); // 56–103: the boardwalk
    c = corridorLoop(b, c.endX, c.endRow); // 104–131, loop centre 117
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 132–153, CRYSTAL 1 (sky shelf)
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 18, density: 3, period: 150 }); // 154–171
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true }); // 172–179 (shaft at 176)
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 150 }); // 180–198
    c = sneakUnder(b, c.endX, c.endRow, { secret: true }); // 199–210, secret 1 (opens into the gallery)
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 6 }); // 211–226
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 16, count: 4 }); // 227–242
    c = secretPocket(b, c.endX, c.endRow); // 243–252, CRYSTAL 2 + secret 2
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6 }); // 253–264, up to row 21 (shaft at 260)
    c = railCascade(b, c.endX, c.endRow); // 265–295, grind down to row 27
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6, enemy: true }); // 296–307, back to 24
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 22 }); // 308–337: blind drop to row 27
    b.crystal(326, 12); // CRYSTAL 3 — riding the leap's ring arc
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 9, checkpoint: true }); // 338–352, back to 24 (shaft at 349)
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shoes' }); // 353–362, secret 3
    c = runway(b, c.endX, c.endRow, { len: 21 }); // 363–383
    signpostFinish(b, c.endX, c.endRow, { len: 16 }); // 384–399

    // Sky overlay: steps over the boardwalk, catwalks through the middle,
    // a trapped step set over the leap, and a glide down to the goal.
    const k1 = skySteps(b, 80, 10, { steps: 5, drone: true, trap: false }); // 80–117
    const s1 = canopyRun(b, k1.endX, 10, { len: 52, crystal: true }); // 118–169, CRYSTAL 5 (sky)
    const s2 = canopyRun(b, s1.endX, 10, { len: 117 }); // 170–286
    const k2 = skySteps(b, s2.endX, 10, { steps: 5, trap: true, drone: false }); // 287–324
    const s3 = canopyRun(b, k2.endX, 10, { len: 13 }); // 325–337: seam catwalk
    glideRun(b, s3.endX, 9, { len: 52 }); // 338–389: glide out over the last runways
    // Mercy mast-tops under the closing glide keep the sky lane continuous.
    for (const mx of [350, 358, 366, 374]) b.platform(mx, mx + 1, 15);

    /* ============================ UNDER ROUTE ============================
     * The gallery spans from under the boardwalk to the last checkpoint,
     * carved last. Shafts sit on plain runways, clear of the loop corridor
     * (104–131), the bowl, the cascade and the leap mesa; two more doors are
     * carved through pit floors (board sprint pit 3, phase crossing).
     */
    underGallery(b, 54, {
      len: 300, // 54–353, within one column of the last secret pocket
      shafts: [122, 206, 295], // at 176, 260, 349
      hazards: 2,
      rail: true,
      crystal: true, // CRYSTAL 4 — under-lane prize below the sneak-under
    });
    // Door in the board sprint's third pit (its floor is row 29): bailing
    // the board can become a route choice instead of just a time loss.
    b.carve(93, 29, 94, 33);
    b.spring(93, 34, 13);
    b.spring(94, 34, 13);
    // Door in the phase crossing's lower route.
    b.carve(186, 29, 187, 33);
    b.spring(186, 34, 13);
    b.spring(187, 34, 13);
  },
};
