/**
 * Physics constants taken from the Sonic Physics Guide (Sega Mega Drive
 * classics, 60 fps, 16 px tiles). All speeds are px/frame, accelerations are
 * px/frame^2. These values are what give the classics their feel — do not
 * "tune" them casually.
 *
 * Three of them are NOT the guide's, on purpose: `acc`, `frc` and `airTurn`.
 * At the guide's values the hero takes over two seconds to reach a run, two
 * more to coast to a stop, and a whole jump to change his mind in the air —
 * faithful, and what play-testing called heavy. They decide how quickly he
 * answers the stick and nothing else: top speed, the jump, gravity, every
 * slope factor and the push FORWARD in the air are the guide's, so momentum
 * is still made and lost on the terrain. See also `START` in Player.ts (the
 * kick off the line).
 */
export const PHYS = {
  /** Ground acceleration when holding a direction. (SPG: 0.046875.) */
  acc: 0.0703125,
  /** Ground deceleration when pushing against the direction of travel. */
  dec: 0.5,
  /** Ground friction when no direction is held. (SPG: 0.046875.) */
  frc: 0.09375,
  /** Rolling friction (half of normal friction). */
  rfc: 0.0234375,
  /** Top horizontal running speed from input alone. */
  top: 6,
  /** Air acceleration (double the guide's ground value). */
  air: 0.09375,
  /**
   * Air deceleration when steering AGAINST the flight (not SPG, which uses
   * `air` both ways: checking a jump took most of the jump). Forward stays
   * the guide's on purpose — doubled, every slow launch off a kicker turned
   * into a full-speed flight in mid-air, and the speed you arrived with
   * stopped mattering.
   */
  airTurn: 0.1875,
  /** Gravity applied every airborne frame. */
  grv: 0.21875,
  /** Jump velocity. */
  jmp: 6.5,
  /** Jump release cut-off: if ascending slower than this on release... */
  jrel: 4,
  /** Slope factor when running / standing. */
  slp: 0.125,
  /** Slope factor when rolling uphill. */
  slpRollUp: 0.078125,
  /** Slope factor when rolling downhill. */
  slpRollDown: 0.3125,
  /** Below this ground speed on walls/ceilings the player slides off. */
  fallSpeed: 2.5,
  /** Rolling uncurles below this ground speed. */
  unrollSpeed: 0.5,
  /** Terminal falling velocity. */
  yspMax: 16,
  /** Absolute ground speed cap (safety, SPG never exceeds ~16 naturally). */
  gspMax: 16,
  /** Spin dash base speed. */
  dashBase: 8,
  /** Each spin dash rev adds half this to release speed. */
  dashRev: 2,
  /** Max spin dash revs. */
  dashRevMax: 8,
  /** Spin dash charge decay per frame. */
  dashDecay: 0.125,
  /** Tile size in pixels. */
  tile: 16,
  /** Horizontal sensor offset (body half width) standing. */
  widthRadius: 9,
  /** Vertical sensor offset (body half height) standing. */
  heightRadius: 19,
  /** Vertical sensor offset while rolling. */
  heightRadiusRoll: 14,
  /** How far below/above a surface the ground sensors will snap. */
  snapRange: 14,
} as const;

export type Phys = typeof PHYS;
