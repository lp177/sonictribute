/**
 * Physics constants taken from the Sonic Physics Guide (Sega Mega Drive
 * classics, 60 fps, 16 px tiles). All speeds are px/frame, accelerations are
 * px/frame^2. These values are what give the classics their feel — do not
 * "tune" them casually.
 */
export const PHYS = {
  /** Ground acceleration when holding a direction. */
  acc: 0.046875,
  /** Ground deceleration when pushing against the direction of travel. */
  dec: 0.5,
  /** Ground friction when no direction is held. */
  frc: 0.046875,
  /** Rolling friction (half of normal friction). */
  rfc: 0.0234375,
  /** Top horizontal running speed from input alone. */
  top: 6,
  /** Air acceleration (double the ground value). */
  air: 0.09375,
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
