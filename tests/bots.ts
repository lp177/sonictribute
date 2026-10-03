import { Level, type LevelDef } from '../src/game/Level.ts';
import { castGround } from '../src/physics/sensors.ts';
import { PHYS } from '../src/physics/constants.ts';
import { Player, NO_INPUT } from '../src/game/Player.ts';
import { input } from './helpers.ts';

const T = PHYS.tile;

/**
 * Three ways of playing an act badly or well, used to prove its roads work:
 *
 *  - 'naive'  holds right, hops gaps it can see and walls it bumps into: the
 *             first-time player. Whatever road this ends up on must lead to
 *             the goal.
 *  - 'faller' holds right and never jumps unless a wall leaves no choice: it
 *             drops into every shaft and pit the act has, so every low road
 *             and every cave must have a way out that works by holding right.
 *  - 'roller' holds right and curls into a ball on every downhill: the
 *             player who has learned that slopes pay. It takes the kickers at
 *             full pace, so every flight must come down somewhere safe.
 *  - 'ace'    is the naive player who has also learned to roll: hops the
 *             gaps AND curls on the downhills. Not part of the contract — it
 *             is the yardstick for "does rolling pay?" (see campaign tests).
 */
export type BotStyle = 'naive' | 'faller' | 'roller' | 'ace';

export interface BotRun {
  level: Level;
  player: Player;
  frames: number;
  reached: boolean;
  worstStall: number;
  /** Tile column of the worst stall. */
  worstAt: number;
  avgSpeed: number;
  /** Feet row at each column the bot stood on (first visit). */
  road: Map<number, number>;
  /** Fastest ground speed reached. */
  topSpeed: number;
  /** Frames spent airborne. */
  airFrames: number;
}

/** Where an act ends for a bot: the boss trigger, or just short of the signpost. */
export function finishLine(level: Level): number {
  return level.bossTriggerX > 0 ? level.bossTriggerX : level.goal.x - 8 * T;
}

/** `spawn` (tile column, feet row) starts the bot somewhere other than the act's start. */
export function runBot(def: LevelDef, style: BotStyle, maxFrames = 20000, spawn?: { col: number; row: number }): BotRun {
  const level = new Level(def);
  const p = spawn
    ? new Player(spawn.col * T + T / 2, spawn.row * T - PHYS.heightRadius - 2)
    : new Player(level.startPos.x, level.startPos.y);
  for (let i = 0; i < 40 && !p.grounded; i++) p.update(level.map, NO_INPUT);
  p.rings = 30;
  const target = finishLine(level);
  const startX = p.x;
  const road = new Map<number, number>();
  let lastX = p.x;
  let stall = 0;
  let still = 0;
  let worstStall = 0;
  let worstAt = 0;
  let holdJump = false;
  let topSpeed = 0;
  let airFrames = 0;
  let f = 0;
  for (; f < maxFrames && !p.dead; f++) {
    const upright = p.grounded && p.mode === 0 && p.layer === 0;
    // Blocked: feet on the floor and no speed to speak of — a wall, a step, a
    // lip. (Measured on speed, not on distance covered: a hero picking himself
    // up on a slope crawls for a moment, and a bot that took that for a wall
    // jumped, landed back where it was and did it again for ever.)
    const hops = style === 'naive' || style === 'ace';
    const rolls = style === 'roller' || style === 'ace';
    still = upright && Math.abs(p.gsp) < 0.12 ? still + 1 : 0;
    // ...or plainly getting nowhere for most of a second, whatever the speed.
    const blocked = still >= (hops ? 6 : 12) || (upright && stall >= 40);
    const gapAhead = upright && !castGround(level.map, p.x + 26, p.y + p.h + 8, 0, p.layer);
    // Downhill: the ground speed points down the slope under the feet.
    const sinA = Math.sin((p.angle * Math.PI) / 180);
    const downhill = Math.abs(sinA) > 0.2 && Math.sign(p.gsp) === -Math.sign(sinA);
    const press = blocked || (hops && gapAhead);
    // A wall needs the whole jump; a gap gets the nervous tap of a beginner.
    if (blocked) holdJump = true;
    else if (p.grounded || p.ysp >= 0) holdJump = false;
    const down = rolls && upright && !p.rolling && !press && downhill && Math.abs(p.gsp) > 2.5;
    p.update(level.map, input({ right: true, down, jump: holdJump || press, jumpPressed: press }));
    level.update(p);
    if (p.rings === 0) p.rings = 30; // keep the bot alive: this measures roads, not skill
    if (p.grounded) {
      topSpeed = Math.max(topSpeed, Math.abs(p.gsp));
      const col = Math.floor(p.x / T);
      if (p.mode === 0 && p.layer === 0 && !road.has(col)) road.set(col, (p.y + p.h) / T);
    } else airFrames++;
    if (p.x - lastX > 0.4 || p.layer === 1) {
      // A lap of a loop goes backwards for half of it: that is not a stall.
      lastX = Math.max(lastX, p.x);
      stall = 0;
    } else {
      stall++;
      if (stall > worstStall) {
        worstStall = stall;
        worstAt = Math.round(p.x / T);
      }
    }
    if (p.x > target) break;
  }
  return {
    level,
    player: p,
    frames: f,
    reached: p.x > target && !p.dead,
    worstStall,
    worstAt,
    avgSpeed: (p.x - startX) / Math.max(1, f),
    road,
    topSpeed,
    airFrames,
  };
}
