import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import {
  runway,
  rollersRun,
  stackedChoice,
  corridorLoop,
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
 * DUSKMERE COAST — ACT 7 — "Foam Lantern Rise"
 *
 * The climb out of the bay, lit by lantern rows along the canopy — the sky
 * lane is the featured road here, entered off an early launch ramp and held
 * by long catwalk chains, while the ground pays phase crossings, a stalactite
 * roof and a rail cascade. Falling out of the sky always lands on the road,
 * never in a pit.
 */
export const act07: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 7',
  title: 'Foam Lantern Rise',
  biome: 0,
  theme: 'verdant',
  width: 380,
  build(b: LevelBuilder): void {
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: start apron
    b.start(4, 24);
    c = runway(b, c.endX, c.endRow, { len: 10, dashPad: true }); // 10–19
    c = corridorLoop(b, c.endX, c.endRow); // 20–47

    // Launch set piece (48–69): the early door to the lantern walk.
    b.launchRamp(48, 24, 3); // 48–55, pad tops out on row 21
    b.gentleDown(56, 21, 3); // 56–61, back down to 24
    b.floor(62, 69, 24);
    b.ringsH(63, 68, 21);
    c = { endX: 70, endRow: 24 };

    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 70–91, CRYSTAL 1 (sky shelf)
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 92–99
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 9, period: 160 }); // 100–118
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 18, count: 4 }); // 119–136
    b.crystal(128, 20); // CRYSTAL 2 — under the stalactite roof
    c = runway(b, c.endX, c.endRow, { len: 8, enemy: true }); // 137–144
    c = quarterPipeBowl(b, c.endX, c.endRow, { basin: 5 }); // 145–159
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 160–189
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 190–201, CRYSTAL 3 (under) + secret 1
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 18, density: 2, period: 150 }); // 202–219
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true }); // 220–227
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 6 }); // 228–239, up to row 21
    c = railCascade(b, c.endX, c.endRow); // 240–270, grind down to row 27
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 8, enemy: true }); // 271–284, back to 24
    c = secretPocket(b, c.endX, c.endRow); // 285–294, CRYSTAL 4 + secret 2
    c = leapOfFaith(b, c.endX, c.endRow, { glide: 20 }); // 295–322: blind drop to row 27
    c = runway(b, c.endX, c.endRow, { rise: 3, len: 9 }); // 323–337, back to 24
    c = secretPocket(b, c.endX, c.endRow, { reward: 'rings10' }); // 338–347, secret 3
    signpostFinish(b, c.endX, c.endRow, { len: 32 }); // 348–379

    // The lantern walk: two long canopy chains, the act's true main road.
    const s = canopyRun(b, 94, 8, { len: 130, crystal: true }); // CRYSTAL 5 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 117 });
  },
};
