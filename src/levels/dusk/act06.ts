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
  skySteps,
  underGallery,
} from '../motifs.ts';

/**
 * DUSKMERE COAST — ACT 6 — "Duskgate Bastion"
 *
 * The mid-biome check: the Wrecking Pod guards the bastion gate. Everything
 * taught so far gets one rep — rollers, loop, rail cascade, bowl, leap —
 * before a straightforward arena. The act opens on the stacked choice (the
 * bastion's outer wall, shelves first), the sky alternates catwalks and
 * trapped steps, and a sea-cave gallery runs beneath the whole approach so
 * even the boss road has a third route under it.
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
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 10–31, CRYSTAL 1 (sky shelf)
    c = runway(b, c.endX, c.endRow, { len: 12, dashPad: true }); // 32–43
    c = rollersRun(b, c.endX, c.endRow, { cycles: 2 }); // 44–101
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true }); // 102–109 (shaft at 106)
    c = corridorLoop(b, c.endX, c.endRow); // 110–137, loop centre 123
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6 }); // 138–149, up to row 21 (shaft at 145)
    c = railCascade(b, c.endX, c.endRow); // 150–180, grind down to row 27
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 7, checkpoint: true }); // 181–193, back to 24 (shaft at 191)
    c = sneakUnder(b, c.endX, c.endRow, { secret: true }); // 194–205, secret 1 (opens into the gallery)
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 16, density: 2, period: 150 }); // 206–221
    c = secretPocket(b, c.endX, c.endRow); // 222–231, CRYSTAL 2 + secret 2
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 4 }); // 232–245
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 18 }); // 246–271: blind drop to row 27
    b.crystal(259, 13); // CRYSTAL 3 — riding the leap's ring arc
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 8, enemy: true }); // 272–285, back to 24
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shield' }); // 286–295, secret 3 (armour for the fight)
    c = runway(b, c.endX, c.endRow, { len: 16 }); // 296–311 (shaft at 306)
    b.drone(240, 18, 4); // harries the bowl-to-leap stretch
    arenaApproach(b, c.endX, c.endRow, { width: 48 }); // 312–359: the Pod's arena

    // Sky overlay: catwalks joined to the early shelves, then two step sets
    // with teeth breaking up the long middle catwalk.
    const s1 = canopyRun(b, 38, 9, { len: 52, crystal: true }); // 38–89, CRYSTAL 5 (sky)
    const k1 = skySteps(b, s1.endX, 9, { steps: 5, drone: true, trap: true }); // 90–127
    const s2 = canopyRun(b, k1.endX, 9, { len: 65 }); // 128–192
    const k2 = skySteps(b, s2.endX, 9, { steps: 4, trap: true, drone: false }); // 193–223
    canopyRun(b, k2.endX, 9, { len: 52 }); // 224–275, ending before the arena

    /* ============================ UNDER ROUTE ============================
     * The bastion's sea-cave, carved last: it runs from under the rollers to
     * the arena wall, with shafts on the plain runways — clear of the loop
     * corridor (110–137), the rails, the bowl and the leap mesa.
     */
    underGallery(b, 30, {
      len: 280, // 30–309, ending at the arena approach
      shafts: [76, 115, 161, 276], // at 106, 145, 191, 306
      hazards: 2,
      crystal: true, // CRYSTAL 4 — under-lane prize beneath the rail cascade
    });
  },
};
