import type { LevelBuilder, LevelDef } from '../../game/Level.ts';
import { STORY_HOUR_OF_TOMORROW } from '../../game/story.ts';
import {
  runway,
  rollersRun,
  corridorLoop,
  stackedChoice,
  phaseCrossing,
  sneakUnder,
  stalactiteGallery,
  secretPocket,
  hazardGauntlet,
  quarterPipeBowl,
  signpostFinish,
  canopyRun,
} from '../motifs.ts';

const W = 320;

/**
 * NOON TOMORROW — ACT 1: the biome opener, and the softest act of the final
 * stretch. It introduces the city's toys one at a time at friendly clocks:
 * one slow phase crossing, a two-spike stalactite awning, a density-1
 * gauntlet, a lone security hopper. Fast lane: GROUND (dash-pad traffic
 * lanes); the hard-light canopy above is the scenic toll road.
 */
export const act01: LevelDef = {
  name: 'NOON TOMORROW',
  act: 'ACT 1',
  title: 'Dawnshift Boulevard',
  biome: 3,
  theme: 'neon',
  width: W,
  intro: STORY_HOUR_OF_TOMORROW,
  build(b: LevelBuilder): void {
    // Ground chain, left to right. All clocked hazards sit past column 33 so
    // an idle hero at the start hears nothing (AMBIENT_RANGE contract).
    let c = runway(b, 0, 24, { len: 10, rings: false }); // 0–9: start apron
    b.start(4, 24);
    c = runway(b, c.endX, c.endRow, { len: 12, dashPad: true }); // 10–21: first traffic lane
    c = stackedChoice(b, c.endX, c.endRow, { crystal: true }); // 22–43, crystal 1 (sky shelf)
    c = rollersRun(b, c.endX, c.endRow, { cycles: 1 }); // 44–73: momentum warm-up
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 6, period: 210 }); // 74–89: phase 101, slow clock
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true, enemy: true }); // 90–97
    c = corridorLoop(b, c.endX, c.endRow); // 98–125
    c = sneakUnder(b, c.endX, c.endRow, { secret: true, crystal: true }); // 126–137, crystal 2 (under), secret 1
    c = runway(b, c.endX, c.endRow, { len: 10, dashPad: true }); // 138–147
    b.hopper(143, 24); // first city-security hopper, on open flat ground
    c = stalactiteGallery(b, c.endX, c.endRow, { len: 14, count: 2 }); // 148–161: steel awning spikes
    c = secretPocket(b, c.endX, c.endRow); // 162–171, crystal 3 (ground), secret 2
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 14, density: 1, period: 170 }); // 172–185
    c = secretPocket(b, c.endX, c.endRow); // 186–195, crystal 4, secret 3
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true }); // 196–203
    c = quarterPipeBowl(b, c.endX, c.endRow); // 204–217: the skate bowl
    c = runway(b, c.endX, c.endRow, { len: 12, enemy: true }); // 218–229
    c = rollersRun(b, c.endX, c.endRow); // 230–287: roll it home
    const fin = signpostFinish(b, c.endX, c.endRow, { len: 32 }); // 288–319
    if (fin.endX !== W) throw new Error(`act01 chain ends at ${fin.endX}, not ${W}`);

    // Sky overlay: the hard-light canopy, stamped after the ground chain.
    const s = canopyRun(b, 40, 10, { len: 100, crystal: true }); // crystal 5 (sky)
    canopyRun(b, s.endX, s.endRow, { len: 86 });
    // Ghost bridges over the first two canopy gaps: the phase platform shown
    // as pure infrastructure before it is ever asked to gate progress.
    b.phasePlatform(48, 52, 10, 220, 0);
    b.phasePlatform(61, 65, 10, 220, 110);
    // Security drones patrol the canopy, not the boulevard.
    b.drone(78, 7, 3);
    b.drone(170, 6, 3);
  },
};
