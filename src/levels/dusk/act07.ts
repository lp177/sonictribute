import type { LevelDef, LevelBuilder } from '../../game/Level.ts';
import { hazardGauntlet, rollersRun, runway, secretPocket, signpostFinish } from '../motifs.ts';
import { WORLD_ROWS, rollingStart, launchValley, loopHill, plunge, undercroft, highRoad, lowRoad, groundRow } from '../sections.ts';
import { crumbleSpan, gliderBay, reefBowl, thermalCliff, tideFlats } from './pieces.ts';

/**
 * DUSKMERE COAST — ACT 7 — "Foam Lantern Rise"
 *
 * The climb out of the bay. It starts at the waterline and never gives a row
 * back for long: almost every release ends higher than it began, and each
 * step up is won a different way — a valley that climbs out past its own
 * rim, the sea wind up a cliff (three times, never the same height), a bowl
 * that flings you up a reef, a bay whose far shore stands over the near
 * one. The lanterns are the high road: ledges strung along the rise, every
 * third one crumbling, and above the headland a glide — a perch, a wing,
 * and one thermal that carries it to the lantern deck.
 *
 * BEATS (knot = tension, the rest is release):
 *   opening   the waterline apron,
 *   valley    the first fork — and the first rise: its far side tops out
 *             four rows over the near one.
 *   knot      planking over a channel.                        -- checkpoint
 *   cliff     the sea wind up the face (crystal on the perch).
 *   loop      on its hill.
 *   knot      two clocked traps, a hopper, a pendulum; a gallery beneath
 *             (crystal, secret room).                         -- checkpoint
 *   bowl      the bowl as a climb: flung eight rows up the reef.
 *   ebb       the one step back: down the reef's far face
 *   knot      to three tide pools and their hoppers,
 *   cliff     and up again on the wind.
 *   headland  the hill with the sea cave under it (crystal, secret room) —
 *             and overhead, the lantern glide: perch, wing, thermal, deck.
 *   bay       the signature: a long ramp down to the water, the kicker, wing
 *             open — no thermal here. A run reaches the roost, a roll the
 *             upper one (crystal), and the far shore climbs fourteen rows.
 *                                                            -- checkpoint
 *   tower     the last lift on the wind,
 *   home      the ridge: a pocket, swells, the signpost at the top.
 *
 * ROADS: the middle road is the rise, row 44 to row 22. The high road is the
 * lantern ledges and the glide; the low road is the gallery under the second
 * knot, the headland's cave and the floor of the bay.
 */
export const act07: LevelDef = {
  name: 'DUSKMERE COAST',
  act: 'ACT 7',
  title: 'Foam Lantern Rise',
  biome: 0,
  theme: 'verdant',
  width: 692,
  height: WORLD_ROWS,
  build(b: LevelBuilder): void {
    let c = rollingStart(b, 0, 42, { drop: 2 }); // the only way is up from row 44
    c = launchValley(b, c.endX, c.endRow, { depth: 8, out: 12, crabs: 1, prize: 'shield' });
    const k1 = c.endX;
    c = crumbleSpan(b, c.endX, c.endRow, { planks: 4 });
    b.checkpoint(c.endX - 3, c.endRow);
    c = thermalCliff(b, c.endX, c.endRow, { rise: 8, top: 6, prize: 'crystal' }); // CRYSTAL 1 (perch)
    const l0 = c.endX;
    c = loopHill(b, c.endX, c.endRow, { drop: 6, up: 4, roof: 'rings10' });
    c = runway(b, c.endX, c.endRow, { len: 12 }); // a loop's landing is ground and rings
    const g0 = c.endX;
    c = hazardGauntlet(b, c.endX, c.endRow, { len: 28, density: 2, period: 150 });
    b.swingBall(g0 + 20, c.endRow - 11, 8, 150, 40);
    c = runway(b, c.endX, c.endRow, { len: 8, checkpoint: true });
    const g1 = c.endX;
    c = reefBowl(b, c.endX, c.endRow, { drop: 2, basin: 8, lift: 8, prize: 'rings10' });
    const reef = c.endX;
    c = plunge(b, c.endX, c.endRow, { drop: 8, runout: 16 }); // the one ebb: off the reef, to the pools at its foot
    c = tideFlats(b, c.endX, c.endRow, { pools: 3, depth: 2, prize: 'shield' });
    c = thermalCliff(b, c.endX, c.endRow, { rise: 8, top: 6, prize: 'shield' });
    const h0 = c.endX;
    c = undercroft(b, c.endX, c.endRow, { rise: 6, crown: 12, down: 4, prize: 'crystal', hazards: 2, secret: true }); // CRYSTAL 3 (cave), secret 2
    // The bay lays its own long ramp down to the water. Twelve rows of it, and
    // not for the speed alone: the headland's cave lets out through a sprung
    // shaft at its foot, that spring's arc is thirty columns long, and it has
    // to come down on the ramp or the run-up — never on the kicker.
    c = gliderBay(b, c.endX, c.endRow, { feed: 12, width: 56, depth: 8, out: 14, crabs: 2, thermal: false, prize: 'rings10', upper: 'crystal' }); // CRYSTAL 4 (upper roost)
    b.checkpoint(c.endX - 2, c.endRow);
    const tw = c.endX;
    c = thermalCliff(b, c.endX, c.endRow, { rise: 10, top: 6, prize: 'rings10' });
    c = secretPocket(b, c.endX, c.endRow, { reward: 'shoes' }); // secret 3
    c = rollersRun(b, c.endX, c.endRow, { cycles: 2, rise: 2, crown: 6, depth: 2, basin: 6 });
    signpostFinish(b, c.endX, c.endRow, { len: 26 });

    /* ============================== HIGH ROAD ==============================
     * The lanterns: ledges strung up the rise, every third one crumbling, so
     * the height a kicker or a fling gave you is kept only by moving.
     */
    highRoad(b, k1 - 4, k1 + 22, { crumbleEvery: 3, monitors: ['rings10'], onRamp: true }); // from the valley's rim to the foot of the wind
    highRoad(b, l0 + 2, g1 - 8, { crumbleEvery: 3, droneEvery: 3, monitors: ['rings10', 'shield'], onRamp: true }); // over the loop (its roof is a drop from here) and the knot
    highRoad(b, g1 + 44, reef + 2, { crumbleEvery: 3, droneEvery: 2, onRamp: true }); // along the reef, off its shelf
    highRoad(b, reef + 30, h0 - 16, { crumbleEvery: 3, droneEvery: 2, monitors: ['rings10'], onRamp: true }); // over the pools at the reef's foot
    highRoad(b, h0 - 4, h0 + 14, { crumbleEvery: 3, onRamp: true }); // from the second clifftop, up the headland
    // The lantern glide. A spring on the headland's crown reaches the perch
    // and the wing on it; run off the end with jump held and the wing sinks
    // down the hill's back to a thermal, which carries it up through the
    // crystal to the lantern deck. (Hand-set, not glideRun: its full-strength
    // thermals would throw a wing from here to the signpost.)
    const perch = groundRow(b, h0 + 20) - 9;
    b.spring(h0 + 19, perch + 9, 11);
    b.platform(h0 + 18, h0 + 23, perch);
    b.glider(h0 + 21, perch - 2);
    b.wind(h0 + 34, perch - 6, h0 + 38, perch + 4, 0.16); // its foot stays well clear of the hill: wind lifts anyone airborne, and the road below is not its business
    b.ringsH(h0 + 26, h0 + 32, perch + 1);
    b.crystal(h0 + 50, perch - 6); // CRYSTAL 5 (top of the lift)
    b.platform(h0 + 58, h0 + 74, perch - 2);
    b.ringsH(h0 + 62, h0 + 70, perch - 4);
    b.monitor(h0 + 72, perch - 2, 'rings10');
    highRoad(b, tw + 20, tw + 88, { crumbleEvery: 3, monitors: ['rings10'], onRamp: true }); // along the ridge

    /* =============================== LOW ROAD ==============================
     * The gallery under the second knot. Holds the first secret.
     */
    lowRoad(b, g0 + 5, g1 - 1, { shafts: [g0 + 5], crabs: 1, prize: 'crystal', secret: true }); // CRYSTAL 2, secret 1
  },
};
