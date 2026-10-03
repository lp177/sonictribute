import type { LevelBuilder, LevelDef } from '../../game/Level.ts';
import { cartCanyon, hazardGauntlet, phaseCrossing, railCascade, runway, signpostFinish } from '../motifs.ts';
import {
  WORLD_ROWS,
  rollingStart,
  launchValley,
  loopHill,
  plunge,
  undercroft,
  springCliff,
  highRoad,
  lowRoad,
} from '../sections.ts';
import { ribbon, rooftops, skyRail } from './pieces.ts';

const W = 751;

/**
 * NOON TOMORROW — ACT 3 — "Ribbonrail Junction"
 *
 * The rail act. It starts on the roofline and SINKS: every drop is a grind
 * rail — a cascade to learn the catch on, then ribbons that span whole
 * valleys — and every climb back up has a line over it for whoever earned
 * the height. The silhouette is a saw: long ribbons down, short walls up.
 *
 * BEATS:
 *   opening    a safe apron tips downhill.
 *   knot       the cascade: run off each shelf to catch its rail (a floor
 *              under every one).                                -- checkpoint
 *   valley     roll it and the upper ledge is a STATION: its rail climbs away
 *   knot       over the gauntlet to a catwalk, and a second one from there
 *   lift       to the head of the cliff the others are sprung up.
 *   ribbon 1   the first sky rail; a crystal on the valley floor under it,
 *              for whoever jumps off the ride.                  -- checkpoint
 *   knot       the city's first minecart.
 *   hill       a climbing hill, a crystal vault under it,
 *   knot       a hard-light crossing on its far side,
 *   loop       and the loop its slope feeds.                    -- checkpoint
 *   knot       a second cascade, three shallow rails,
 *   junction   then sprung up to the top of the act: two lines leave together, one
 *              a jump over the other, across the deepest valley. A crystal
 *              hangs between them; another waits where the upper line ends.
 *                                                               -- checkpoint
 *   knot       the roofs, with the upper line's catwalk running on over them,
 *   ribbon 3   then a plunge onto the last rail, which sets you down at the
 *              signpost.
 *
 * ROADS: the middle road is the ground. The high road is rails and the
 * stations they join; the low road is the valleys under the ribbons, the
 * gallery under the gauntlet, the vault and the street.
 */
export const act03: LevelDef = {
  name: 'NOON TOMORROW',
  act: 'ACT 3',
  title: 'Ribbonrail Junction',
  biome: 3,
  theme: 'neon',
  width: W,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 20); // the roofline, down to row 24
    c = railCascade(b, c.endX, c.endRow, { steps: 2 }); // → row 30
    b.checkpoint(c.endX - 2, c.endRow);
    const lip = c.endX + 43; // first column past the valley's kicker
    c = launchValley(b, c.endX, c.endRow, { depth: 12, out: 8, crabs: 2, prize: 'rings10' }); // → row 34
    c = runway(b, c.endX, c.endRow, { len: 4, rings: false }); // a breath between the climb-out and the first trap
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 24, density: 2, period: 160 });
    const g1 = c.endX;
    c = springCliff(b, c.endX, c.endRow, { rise: 12, top: 8 }); // → row 22
    const s1 = c.endX;
    c = skyRail(b, c.endX, c.endRow, { drop: 8, len: 44, prize: 'crystal' }); // CRYSTAL 1 (under the ribbon) → row 30
    b.checkpoint(c.endX - 3, c.endRow);
    const cc0 = c.endX;
    c = cartCanyon(b, c.endX, c.endRow, { gap: 7 });
    c = undercroft(b, c.endX, c.endRow, { rise: 8, crown: 14, down: 4, prize: 'crystal', secret: true }); // CRYSTAL 2 (vault), secret 1 → row 26
    c = phaseCrossing(b, c.endX, c.endRow, { gap: 8, period: 170 });
    const l0 = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 6, roof: 'shield' }); // → row 28
    b.checkpoint(c.endX - 1, c.endRow);
    c = railCascade(b, c.endX, c.endRow, { steps: 3, dropEach: 2, span: 8 }); // → row 34
    const j0 = c.endX;
    c = springCliff(b, c.endX, c.endRow, { rise: 14, top: 8 }); // → row 20
    const jr = c.endX + 6; // the head of the junction's lower line
    c = skyRail(b, c.endX, c.endRow, { drop: 14, len: 90, depth: 22, hoppers: 3, prize: 'shield', crystal: true, runout: 14 }); // CRYSTAL 3 → row 34
    b.checkpoint(c.endX - 4, c.endRow);
    c = rooftops(b, c.endX, c.endRow, { steps: [0, -2, 1, -1, 0], droneEvery: 2, room: 'rings10', secret: true }); // secret 2 → row 32
    const r1 = c.endX;
    c = plunge(b, c.endX, c.endRow, { drop: 6, runout: 6 }); // → row 38
    c = skyRail(b, c.endX, c.endRow, { drop: 6, len: 70, depth: 12, hoppers: 0, prize: 'none', runout: 6 }); // → row 44
    c = signpostFinish(b, c.endX, c.endRow, { len: 24 });
    if (c.endX !== W) throw new Error(`act03 chain ends at ${c.endX}, not ${W}`);

    /* ============================== HIGH ROAD ==============================
     * Rails, and the stations they join. The valley's upper ledge — the one
     * only a rolled descent reaches — is the first station.
     */
    highRoad(b, 25, 58, { monitors: ['rings10'] }); // over the cascade: the lesson, seen from above
    b.spring(26, 24, 10);
    b.platform(g0 + 2, g0 + 19, 25); // the catwalk over the gauntlet
    b.crystal(g0 + 11, 23); // CRYSTAL 4
    ribbon(b, lip + 37, 31, g0 + 2, 25);
    b.platform(s1 - 8, s1 - 1, 17); // and the station over the head of the lift
    b.monitor(s1 - 2, 17, 'rings10');
    ribbon(b, g0 + 20, 25, s1 - 8, 17);

    // An up-line off the first ribbon's far bank: a hop onto its station and
    // it lifts you to the catwalks over the cart, the hill and the loop.
    b.platform(cc0 - 12, cc0 - 9, 26);
    b.platform(cc0 + 8, cc0 + 15, 19);
    ribbon(b, cc0 - 8, 26, cc0 + 8, 19);
    highRoad(b, cc0 + 19, l0 + 16, { span: 10, gap: 3, droneEvery: 3, monitors: ['rings10'] }); // the loop's roof is a drop from its end
    highRoad(b, l0 + 34, j0 - 2, { span: 10, gap: 3, droneEvery: 2 }); // and on from the roof, over the second cascade, to the junction

    // The junction's upper line: its station hangs where the cliff's spring
    // throws you, and it leaves over the lower line's head.
    b.platform(j0 + 9, j0 + 16, 16);
    b.ringsH(j0 + 11, j0 + 15, 14);
    b.platform(jr + 70, jr + 78, 24);
    ribbon(b, j0 + 17, 16, jr + 70, 24);
    b.crystal(jr + 75, 22); // CRYSTAL 5 — where the upper line ends
    highRoad(b, jr + 82, r1 + 4, { lift: 10, crumbleEvery: 4, monitors: ['rings10', 'shield'] }); // on over the roofs

    /* =============================== LOW ROAD ============================== */
    lowRoad(b, g0 + 1, g1 - 2, { shafts: [g0 + 2], crabs: 1, prize: 'rings10', secret: true }); // secret 3
  },
};
