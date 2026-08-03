import { TileMap, stampLoop } from '../physics/TileMap.ts';
import { PHYS } from '../physics/constants.ts';
import { LoopTracker, makeLoopZone, LOOP, type LoopZone } from './loops.ts';
import { Player } from './Player.ts';
import {
  Ring,
  ScatteredRing,
  Spring,
  Monitor,
  Spikes,
  Crystal,
  Checkpoint,
  SnapCrab,
  BuzzDrone,
  DashPad,
  BoardPad,
  Launcher,
  Rail,
  SpikeTrap,
  CrumblePlatform,
  SwingBall,
  Stalactite,
  Minecart,
  PhasePlatform,
  Hopper,
  GoalSign,
  tileCentre,
  type Rect,
  type MonitorKind,
} from './entities.ts';
import { BossArena } from './BossArena.ts';
import { Boss, type BossLike } from './Boss.ts';
import { PressBoss } from './PressBoss.ts';
import { CrystalBoss } from './CrystalBoss.ts';
import { MirageBoss } from './MirageBoss.ts';
import { SCORE, type LevelStats } from './Score.ts';
import type { Cutscene } from './story.ts';

export type LevelTheme = 'verdant' | 'gear' | 'crystal' | 'neon';
export type BossKind = 'pod' | 'press' | 'shard' | 'mirage';

const T = PHYS.tile;

/**
 * How far behind the player's furthest progress the world stays walkable.
 * A bit under one screen: enough to nip back for a missed ring or a secret,
 * not enough to re-run the level backwards.
 */
const BACKTRACK_SLACK = 560;

/**
 * How close a scenery hazard must be to the player before it is allowed to
 * make a noise. Traps run on their own clock all over the level; without
 * this, every one of them chirps at the player from half a zone away and the
 * result is meaningless repeating noise.
 */
const AMBIENT_RANGE = 420;

/* ------------------------------- Level builder ----------------------------- */

const TERRAIN: Record<string, number> = {
  '#': 1,
  '/': 2,
  '\\': 3,
  '(': 4,
  ')': 5,
  '<': 6,
  '>': 7,
  // rounded ramp joins (same endpoints as ( ) < > — see TileMap curveFoot/curveCrest)
  '{': 9,
  '}': 10,
  '[': 11,
  ']': 12,
  '=': 8,
};

export class LevelBuilder {
  readonly grid: string[][];
  rings: { x: number; y: number }[] = [];
  springs: { x: number; y: number; dir: 'up' | 'left' | 'right'; power: number }[] = [];
  monitors: { x: number; y: number; kind: MonitorKind }[] = [];
  spikeDefs: { x: number; y: number }[] = [];
  crystals: { x: number; y: number; id: number }[] = [];
  checkpoints: { x: number; y: number }[] = [];
  enemies: { x: number; y: number; x0: number; x1: number }[] = [];
  droneDefs: { x: number; y: number; range: number }[] = [];
  dashPadDefs: { x: number; y: number; dir: 1 | -1; power: number }[] = [];
  boardPadDefs: { x: number; y: number }[] = [];
  launcherDefs: {
    x: number;
    y: number;
    dir: 1 | -1;
    power: number;
    angle: number;
    minSpeed?: number;
    convert?: boolean;
  }[] = [];
  railDefs: { x0: number; y0: number; x1: number; y1: number }[] = [];
  pipeDefs: { x: number; baseY: number; dir: 1 | -1 }[] = [];
  trapDefs: { x: number; y: number; period: number; offset: number }[] = [];
  crumbleDefs: { x: number; y: number; w: number }[] = [];
  swingDefs: { x: number; y: number; len: number; period: number; offset: number }[] = [];
  stalactiteDefs: { x: number; y: number }[] = [];
  cartDefs: { x0: number; y0: number; x1: number; y1: number }[] = [];
  phaseDefs: { x: number; y: number; w: number; period: number; offset: number }[] = [];
  hopperDefs: { x: number; y: number }[] = [];
  boardEndX = -1;
  loops: LoopZone[] = [];
  secretRects: Rect[] = [];
  playerStart = { x: 64, y: 64 };
  bossTriggerX = -1;
  arena = { left: 0, right: 0 };
  goalPos = { x: 0, y: 0 };
  /** Loop stamps applied after the grid is converted (layer 1). */
  loopStamps: { cx: number; cy: number; innerR: number; thickness: number }[] = [];

  readonly w: number;
  readonly h: number;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.grid = Array.from({ length: h }, () => new Array<string>(w).fill('.'));
  }

  set(x: number, y: number, ch: string): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.grid[y][x] = ch;
  }

  /** Solid ground from `surfaceRow` down to the bottom of the map. */
  floor(x0: number, x1: number, surfaceRow: number): void {
    for (let x = x0; x <= x1; x++) for (let y = surfaceRow; y < this.h; y++) this.set(x, y, '#');
  }

  /**
   * A deck of finite thickness, leaving open space underneath. This is what
   * makes a layered world possible: run along the top, or drop through a hole
   * and explore the gallery below.
   */
  slab(x0: number, x1: number, surfaceRow: number, thickness = 4): void {
    for (let x = x0; x <= x1; x++) {
      for (let y = surfaceRow; y < Math.min(this.h, surfaceRow + thickness); y++) this.set(x, y, '#');
    }
  }

  /** 45° descent to the right starting at (x, surfaceRow). */
  slopeDown(x: number, surfaceRow: number, len: number): void {
    for (let i = 0; i < len; i++) {
      this.set(x + i, surfaceRow + i, '\\');
      for (let y = surfaceRow + i + 1; y < this.h; y++) this.set(x + i, y, '#');
    }
  }

  /** 45° ascent to the right starting at (x, surfaceRow). */
  slopeUp(x: number, surfaceRow: number, len: number): void {
    for (let i = 0; i < len; i++) {
      this.set(x + i, surfaceRow - i, '/');
      for (let y = surfaceRow - i + 1; y < this.h; y++) this.set(x + i, y, '#');
    }
  }

  /**
   * Gentle (~26.5°) ascent to the right: each pair of columns climbs one
   * tile. `surfaceRow` is the row of the FIRST (lower) gentle tile; the ramp
   * spans 2*pairs columns and tops out flush with `surfaceRow - pairs`.
   */
  gentleUp(x: number, surfaceRow: number, pairs: number): void {
    for (let i = 0; i < pairs; i++) {
      const row = surfaceRow - i;
      // Round the two ends so the ground eases out of / into the flat instead
      // of kinking 0deg -> 26.5deg in one column. Endpoints are identical, so
      // the ramp still tops out flush with `surfaceRow - pairs`.
      this.set(x + i * 2, row, i === 0 ? '{' : '(');
      this.set(x + i * 2 + 1, row, i === pairs - 1 ? '}' : ')');
      for (let y = row + 1; y < this.h; y++) {
        this.set(x + i * 2, y, '#');
        this.set(x + i * 2 + 1, y, '#');
      }
    }
  }

  /**
   * Gentle (~26.5°) descent to the right, the mirror of `gentleUp`. Each pair
   * of columns drops one tile; the ramp spans 2*pairs columns and bottoms out
   * flush with `surfaceRow + pairs`.
   */
  gentleDown(x: number, surfaceRow: number, pairs: number): void {
    for (let i = 0; i < pairs; i++) {
      const row = surfaceRow + i;
      // '>' is the upper half of the descent (16 -> 8.5), '<' the lower
      // (8 -> 0.5): together one pair drops the surface exactly one tile.
      this.set(x + i * 2, row, i === 0 ? '[' : '>');
      this.set(x + i * 2 + 1, row, i === pairs - 1 ? ']' : '<');
      for (let y = row + 1; y < this.h; y++) {
        this.set(x + i * 2, y, '#');
        this.set(x + i * 2 + 1, y, '#');
      }
    }
  }

  /**
   * A rolling hill: gentle up, flat crown, gentle down. Returns the surface
   * row of the crown. This is the preferred way to change height on the main
   * running route — 45° steps kill momentum and read as walls.
   */
  hill(x: number, baseRow: number, rise: number, crownLen: number): number {
    const crown = baseRow - rise;
    this.gentleUp(x, baseRow - 1, rise);
    const crownX = x + rise * 2;
    this.floor(crownX, crownX + crownLen - 1, crown);
    this.gentleDown(crownX + crownLen, crown, rise);
    return crown;
  }

  /**
   * A shallow dip: gentle down into a basin, then gentle back up. Great for
   * carrying rolling speed — you lose height and get it straight back.
   */
  dip(x: number, baseRow: number, depth: number, floorLen: number): number {
    const bottom = baseRow + depth;
    this.gentleDown(x, baseRow, depth);
    const flatX = x + depth * 2;
    this.floor(flatX, flatX + floorLen - 1, bottom);
    this.gentleUp(flatX + floorLen, bottom - 1, depth);
    return bottom;
  }

  /** Empty pit in the ground (caller ensures there is a floor elsewhere). */
  pit(x0: number, x1: number, fromRow: number, depth: number): void {
    for (let x = x0; x <= x1; x++)
      for (let y = fromRow; y < Math.min(this.h, fromRow + depth); y++) this.set(x, y, '.');
  }

  platform(x0: number, x1: number, row: number): void {
    for (let x = x0; x <= x1; x++) this.set(x, row, '=');
  }

  ringsH(x0: number, x1: number, row: number): void {
    for (let x = x0; x <= x1; x++) this.rings.push({ x: tileCentre(x), y: tileCentre(row) });
  }

  ringBox(x0: number, y0: number, cols: number, rowsN: number): void {
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rowsN; r++) this.rings.push({ x: tileCentre(x0 + c), y: tileCentre(y0 + r) });
  }

  spring(x: number, surfaceRow: number, power: number): void {
    this.springs.push({ x: tileCentre(x), y: surfaceRow * T - 8, dir: 'up', power });
  }

  spikes(x0: number, x1: number, surfaceRow: number): void {
    for (let x = x0; x <= x1; x++) this.spikeDefs.push({ x: tileCentre(x), y: surfaceRow * T - 6 });
  }

  monitor(x: number, surfaceRow: number, kind: MonitorKind): void {
    this.monitors.push({ x: tileCentre(x), y: surfaceRow * T - 12, kind });
  }

  crystal(x: number, row: number): void {
    this.crystals.push({ x: tileCentre(x), y: tileCentre(row), id: this.crystals.length });
  }

  checkpoint(x: number, surfaceRow: number): void {
    this.checkpoints.push({ x: tileCentre(x), y: surfaceRow * T });
  }

  enemy(x: number, surfaceRow: number, range: number): void {
    this.enemies.push({
      x: tileCentre(x),
      y: surfaceRow * T - 7,
      x0: (x - range) * T,
      x1: (x + range) * T,
    });
  }

  /** Flying BuzzDrone hovering around the centre of tile (x, row). */
  drone(x: number, row: number, rangeTiles: number): void {
    this.droneDefs.push({ x: tileCentre(x), y: tileCentre(row), range: rangeTiles * T });
  }

  /** Floor booster on the surface at `surfaceRow`. */
  dashPad(x: number, surfaceRow: number, dir: 1 | -1 = 1, power = 10): void {
    this.dashPadDefs.push({ x: tileCentre(x), y: surfaceRow * T - 6, dir, power });
  }

  /** Mag-Board pickup pad standing on the surface at `surfaceRow`. */
  boardPad(x: number, surfaceRow: number): void {
    this.boardPadDefs.push({ x: tileCentre(x), y: surfaceRow * T - 14 });
  }

  /** Dismount line: riding past this x ends the Mag-Board section. */
  boardEnd(x: number): void {
    this.boardEndX = x * T;
  }

  /**
   * A run-up ramp that ends in a springboard: gentle climb, then a diagonal
   * launch high across the sky. Returns the row the ramp tops out on.
   */
  launchRamp(x: number, baseRow: number, rise = 3, power = 12, angle = 56): number {
    this.gentleUp(x, baseRow - 1, rise);
    const top = baseRow - rise;
    const padX = x + rise * 2;
    this.floor(padX, padX + 1, top);
    this.launcher(padX + 1, top, 1, power, angle);
    return top;
  }

  /** Standalone diagonal springboard sitting on `surfaceRow`. */
  launcher(x: number, surfaceRow: number, dir: 1 | -1 = 1, power = 12, angle = 56): void {
    this.launcherDefs.push({ x: tileCentre(x), y: surfaceRow * T - 8, dir, power, angle });
  }

  /**
   * A grind rail between two tile corners. Land on it and you ride it: the
   * slope decides whether you gain or bleed speed.
   */
  rail(x0: number, row0: number, x1: number, row1: number): void {
    this.railDefs.push({ x0: x0 * T, y0: row0 * T, x1: x1 * T, y1: row1 * T });
  }

  /** Telegraphed pop-up spikes flush with the surface at `surfaceRow`. */
  spikeTrap(x: number, surfaceRow: number, period = 150, offset = 0): void {
    this.trapDefs.push({ x: tileCentre(x), y: surfaceRow * T, period, offset });
  }

  /** Crumbling ledge spanning tiles [x0, x1] whose top sits on `row`. */
  crumble(x0: number, x1: number, row: number): void {
    this.crumbleDefs.push({ x: x0 * T, y: row * T, w: (x1 - x0 + 1) * T });
  }

  /** Spiked ball swinging from a ceiling pivot at tile (x, row). */
  swingBall(x: number, row: number, lengthTiles: number, period = 150, offset = 0): void {
    this.swingDefs.push({
      x: tileCentre(x),
      y: row * T,
      len: lengthTiles * T,
      period,
      offset,
    });
  }

  /**
   * Hanging spike under the ceiling tile at (x, ceilingRow). Armed by the
   * player passing beneath: trembles, drops, shatters, regrows.
   */
  stalactite(x: number, ceilingRow: number): void {
    this.stalactiteDefs.push({ x: tileCentre(x), y: (ceilingRow + 1) * T });
  }

  /**
   * A ~5-tile quarter-pipe lip: rounded foot, gentle middle, 45° upper curve,
   * with a speed-gated converting launcher at the lip. Entered fast in `dir`
   * it turns ground speed into a steep diagonal launch; entered slow it is
   * just a climbable curve the player slides back down — every tile in it is
   * ordinary ground, so it can never read as a wall.
   *
   * `x` is the LEFTMOST column of the footprint either way; `dir` picks which
   * end is the lip (dir=1 launches rightward off the right end).
   */
  quarterPipe(x: number, baseRow: number, dir: 1 | -1): void {
    const fill = (col: number, row: number, ch: string) => {
      this.set(col, row, ch);
      for (let y = row + 1; y < this.h; y++) this.set(col, y, '#');
    };
    if (dir === 1) {
      fill(x, baseRow - 1, '{');
      fill(x + 1, baseRow - 1, ')');
      fill(x + 2, baseRow - 2, '/');
      fill(x + 3, baseRow - 3, '/');
      fill(x + 4, baseRow - 4, '/');
    } else {
      fill(x, baseRow - 4, '\\');
      fill(x + 1, baseRow - 3, '\\');
      fill(x + 2, baseRow - 2, '\\');
      fill(x + 3, baseRow - 1, '>');
      fill(x + 4, baseRow - 1, ']');
    }
    const lipX = dir === 1 ? x + 4 : x;
    // Recorded for the renderer: an unmarked converting launcher on ordinary
    // terrain is an invisible trigger, and invisible triggers are unfair.
    this.pipeDefs.push({ x: (dir === 1 ? x : x + 5) * T, baseY: baseRow * T, dir });
    this.launcherDefs.push({
      x: tileCentre(lipX),
      y: (baseRow - 4) * T - 8,
      dir,
      power: 12,
      angle: 62,
      // Well above walking-up-the-curve pace, comfortably below a real run:
      // the gate that separates "launch" from "climbable curve".
      minSpeed: 4.5,
      convert: true,
    });
  }

  /** A minecart track from tile corner (x0,row0) to (x1,row1), cart waiting at the start. */
  cartRide(x0: number, row0: number, x1: number, row1: number): void {
    // A vertical track would divide by zero in the cart's yAt. Authoring
    // error, caught at build time rather than as NaN mid-ride.
    if (x0 === x1) throw new Error('cartRide: vertical tracks are not supported');
    this.cartDefs.push({ x0: x0 * T, y0: row0 * T, x1: x1 * T, y1: row1 * T });
  }

  /** Hard-light one-way platform spanning tiles [x0,x1], top surface on `row`. */
  phasePlatform(x0: number, x1: number, row: number, period = 180, offset = 0): void {
    this.phaseDefs.push({ x: x0 * T, y: row * T, w: (x1 - x0 + 1) * T, period, offset });
  }

  /** Coiled jumper enemy sitting on the surface at `surfaceRow`. */
  hopper(x: number, surfaceRow: number): void {
    this.hopperDefs.push({ x: tileCentre(x), y: surfaceRow * T });
  }

  start(x: number, surfaceRow: number): void {
    this.playerStart = { x: tileCentre(x), y: surfaceRow * T - PHYS.heightRadius - 2 };
  }

  boss(triggerX: number, arenaLeft: number, arenaRight: number): void {
    this.bossTriggerX = triggerX * T;
    this.arena = { left: arenaLeft * T, right: arenaRight * T };
  }

  goal(x: number, surfaceRow: number): void {
    this.goalPos = { x: tileCentre(x), y: surfaceRow * T };
  }

  /**
   * A full 360° loop centred on tile `cxTile`, standing on `surfaceRow`. Also
   * lays a ring arc along the inner channel (the reward line the player rides
   * around), so loop rings can never drift out of the channel by hand-editing.
   */
  loop(cxTile: number, surfaceRow: number, innerR = LOOP.innerR, thickness = LOOP.thickness): void {
    const cx = cxTile * T + T / 2;
    const cy = surfaceRow * T - innerR;
    this.loops.push(makeLoopZone(cx, cy, innerR, thickness));
    this.loopStamps.push({ cx, cy, innerR, thickness });
    // Ring arc over the top of the channel, at the radius a rolling hero rides.
    const r = innerR - 13;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = ((25 + (130 * i) / (n - 1)) * Math.PI) / 180;
      this.rings.push({ x: cx + Math.cos(a) * r, y: cy - Math.sin(a) * r });
    }
  }

  secret(x0: number, y0: number, x1: number, y1: number): void {
    this.secretRects.push({ x: x0 * T, y: y0 * T, w: (x1 - x0 + 1) * T, h: (y1 - y0 + 1) * T });
  }

  /** Carve an empty rectangular room/tunnel out of the solid ground. */
  carve(x0: number, y0: number, x1: number, y1: number): void {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, '.');
  }
}

/* ---------------------------------- Level ---------------------------------- */

/** Default world size in tiles: wide, and deep enough for a real underworld. */
export const WORLD_W = 320;
export const WORLD_H = 40;

export interface LevelDef {
  name: string;
  act: string;
  /**
   * Scene-descriptive display name for the level-select list — it should let
   * a player recognise the stage at a glance ("Tidebreak Run", not "Act 3").
   */
  title: string;
  /** Which biome this act belongs to (index into BIOMES). */
  biome: number;
  /** World size in tiles; defaults to WORLD_W x WORLD_H. */
  width?: number;
  height?: number;
  /** Visual theme for terrain/background procedural art. */
  theme: LevelTheme;
  /** Boss guarding the goal; omit for acts that end at the signpost. */
  bossKind?: BossKind;
  /**
   * Story beat played (as a pseudo-loading cinematic) before this level.
   * Only a biome's first act carries one — between ordinary acts the fade
   * alone keeps the pace up.
   */
  intro?: Cutscene;
  build(b: LevelBuilder): void;
}

export class Level {
  readonly name: string;
  readonly theme: LevelTheme;
  readonly bossKind: BossKind | null;
  readonly map: TileMap;
  readonly loops: LoopZone[];
  readonly loopTracker: LoopTracker;
  readonly secrets: (Rect & { found: boolean })[];
  rings: Ring[];
  scattered: ScatteredRing[] = [];
  springs: Spring[];
  monitors: Monitor[];
  spikes: Spikes[];
  crystals: Crystal[];
  checkpoints: Checkpoint[];
  enemies: SnapCrab[];
  drones: BuzzDrone[];
  dashPads: DashPad[];
  boardPads: BoardPad[];
  launchers: Launcher[];
  rails: Rail[];
  /** The rail currently being ridden, if any. */
  private onRail: Rail | null = null;
  traps: SpikeTrap[];
  crumbles: CrumblePlatform[];
  swings: SwingBall[];
  stalactites: Stalactite[];
  carts: Minecart[];
  phasePlats: PhasePlatform[];
  hoppers: Hopper[];
  readonly boardEndX: number;
  readonly pipes: { x: number; baseY: number; dir: 1 | -1 }[];
  goal: GoalSign;
  boss: BossLike | null = null;
  bossDefeated = false;
  /** Gates that seal the boss arena; null until the level defines one. */
  arenaGates: BossArena | null = null;
  /**
   * Hard left limit that follows the player, like the classic games' screen
   * edge. Backtracking a little is fine (secrets, missed rings); wandering
   * back a whole screen is not.
   */
  backLimitX: number;
  /**
   * Falling past this kills. It sits below the deepest route, so the void
   * only ever catches a genuinely bottomless fall — it exists to end an
   * endless drop, not to punish using the underworld.
   */
  readonly voidY: number;

  readonly startPos: { x: number; y: number };
  respawnPos: { x: number; y: number };
  readonly bossTriggerX: number;
  readonly arena: { left: number; right: number };

  score = 0;
  timeFrames = 0;
  ringsCollected = 0;
  tookDamage = false;
  /** Set when the goal sign is hit. */
  results: LevelStats | null = null;
  /**
   * Where this frame's positional events happened, so effects appear at the
   * thing that caused them. Without it every spark from every entity in the
   * level bursts out of the hero.
   */
  readonly eventSources = new Map<string, { x: number; y: number }>();

  private prevX = 0;

  constructor(def: LevelDef) {
    this.name = def.name;
    this.theme = def.theme;
    this.bossKind = def.bossKind ?? null;
    const b = new LevelBuilder(def.width ?? WORLD_W, def.height ?? WORLD_H);
    def.build(b);

    this.map = new TileMap(b.w, b.h);
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        const id = TERRAIN[b.grid[y][x]];
        if (id !== undefined) this.map.set(x, y, id);
      }
    }
    // Layer 1 = same terrain, but loop corridors replaced by the annulus.
    this.map.copyLayer(0, 1);
    // The flattened channel base must match the trigger offset, so the layer
    // switch happens where both floors line up (see LOOP.flatHalf).
    for (const s of b.loopStamps) stampLoop(this.map, 1, s.cx, s.cy, s.innerR, s.thickness, LOOP.flatHalf);

    this.loops = b.loops;
    this.loopTracker = new LoopTracker(this.loops);
    this.secrets = b.secretRects.map((r) => ({ ...r, found: false }));
    this.rings = b.rings.map((r) => new Ring(r.x, r.y));
    this.springs = b.springs.map((s) => new Spring(s.x, s.y, s.dir, s.power));
    this.monitors = b.monitors.map((m) => new Monitor(m.x, m.y, m.kind));
    this.spikes = b.spikeDefs.map((s) => new Spikes(s.x, s.y));
    this.crystals = b.crystals.map((c) => new Crystal(c.x, c.y, c.id));
    this.checkpoints = b.checkpoints.map((c) => new Checkpoint(c.x, c.y));
    this.enemies = b.enemies.map((e) => new SnapCrab(e.x, e.y, e.x0, e.x1));
    this.drones = b.droneDefs.map((d) => new BuzzDrone(d.x, d.y, d.range));
    this.dashPads = b.dashPadDefs.map((d) => new DashPad(d.x, d.y, d.dir, d.power));
    this.boardPads = b.boardPadDefs.map((d) => new BoardPad(d.x, d.y));
    this.launchers = b.launcherDefs.map(
      (d) => new Launcher(d.x, d.y, d.dir, d.power, d.angle, d.minSpeed ?? 3.5, d.convert ?? false),
    );
    this.rails = b.railDefs.map((d) => new Rail(d.x0, d.y0, d.x1, d.y1));
    this.traps = b.trapDefs.map((d) => new SpikeTrap(d.x, d.y, d.period, d.offset));
    this.crumbles = b.crumbleDefs.map((d) => new CrumblePlatform(d.x, d.y, d.w));
    this.swings = b.swingDefs.map((d) => new SwingBall(d.x, d.y, d.len, d.period, d.offset));
    this.stalactites = b.stalactiteDefs.map((d) => new Stalactite(d.x, d.y));
    this.carts = b.cartDefs.map((d) => new Minecart(d.x0, d.y0, d.x1, d.y1));
    this.phasePlats = b.phaseDefs.map((d) => new PhasePlatform(d.x, d.y, d.w, d.period, d.offset));
    this.hoppers = b.hopperDefs.map((d) => new Hopper(d.x, d.y));
    this.boardEndX = b.boardEndX;
    this.pipes = b.pipeDefs;
    this.goal = new GoalSign(b.goalPos.x, b.goalPos.y);
    this.startPos = b.playerStart;
    this.respawnPos = { ...b.playerStart };
    this.bossTriggerX = b.bossTriggerX;
    this.arena = b.arena;
    this.prevX = this.startPos.x;
    this.backLimitX = this.startPos.x - BACKTRACK_SLACK;
    this.voidY = this.map.pixelH + 32;
  }

  /** Per-frame world update; the player has already been updated. */
  update(p: Player): string[] {
    const events: string[] = [];
    this.eventSources.clear();
    if (!this.results) this.timeFrames++;

    // Loop layer switching + speed assist. Entering a loop at any running
    // pace grants the boost; inside the channel a floor speed is enforced so
    // gravity can never stall the player upside-down. Loops are a toy here,
    // not a skill check (see LOOP in loops.ts).
    const cross = this.loopTracker.update(this.prevX, p.x, p.y, p.dead ? 0 : p.gsp);
    p.layer = cross.layer;
    if (cross.entered !== 0) {
      if (Math.abs(p.gsp) < LOOP.boost) p.gsp = LOOP.boost * cross.entered;
      p.facing = cross.entered;
      events.push('loop-boost');
    }
    if (this.loopTracker.current >= 0 && p.grounded && !p.dead && Math.abs(p.gsp) < LOOP.sustain) {
      p.gsp = LOOP.sustain * (p.gsp !== 0 ? Math.sign(p.gsp) : p.facing);
    }

    // Rings.
    for (const r of this.rings) {
      if (r.tryCollect(p)) {
        this.score += SCORE.ring;
        this.ringsCollected++;
        events.push('ring');
      }
    }
    this.scattered = this.scattered.filter((s) => s.alive && !s.collected);
    for (const s of this.scattered) {
      s.update(this.map, p.layer);
      if (s.tryCollect(p)) events.push('ring');
    }

    // Springs & monitors.
    for (const s of this.springs) {
      s.update();
      if (s.tryTrigger(p)) events.push('spring');
    }
    for (const m of this.monitors) {
      if (m.tryBreak(p)) {
        this.score += SCORE.monitor;
        events.push('monitor');
      }
    }

    // Dash pads & Mag-Board (level-specific vehicle).
    for (const d of this.dashPads) {
      d.update();
      if (d.tryTrigger(p)) events.push('dash-pad');
    }
    for (const l of this.launchers) {
      l.update();
      if (l.tryLaunch(p)) events.push('launch');
    }

    // Grind rails: ride one until it ends or the player jumps off.
    if (p.railing) {
      if (!this.onRail || !this.onRail.carry(p)) {
        p.dismountRail();
        this.onRail = null;
        events.push('rail-off');
      }
    } else {
      this.onRail = null;
      for (const r of this.rails) {
        if (r.tryCatch(p)) {
          this.onRail = r;
          events.push('rail-on');
          break;
        }
      }
    }
    for (const bp of this.boardPads) {
      if (bp.tryMount(p)) events.push('board');
    }
    if (p.board && this.boardEndX >= 0 && p.x >= this.boardEndX) {
      p.dismountBoard();
      events.push('board-end');
    }

    // Minecarts: touching a waiting cart commits the player to the ride; the
    // cart runs its track and crashes into the buffer at the far end.
    for (const cart of this.carts) {
      if (cart.tryBoard(p)) {
        events.push('cart-board');
        this.eventSources.set('cart-board', { x: cart.x, y: cart.y });
      }
      // A rider who jumped out (or died) is no longer aboard, but a launched
      // cart is committed: it runs on riderless and still crashes.
      if (cart.rider && (!p.carting || p.dead)) cart.rider = false;
      if (cart.update() === 'crash') {
        // The crash happens wherever the buffer is — which can be far from a
        // player who bailed early, so it is ambient-gated like any hazard.
        // Two event names because juice policy differs: the unmanned wreck is
        // spectacle (hit-stop allowed); a ridden crash is damage TAKEN, and
        // hit-stop never accompanies damage taken (AGENTS.md).
        if (Math.abs(cart.x - p.x) < AMBIENT_RANGE) {
          const name = cart.rider ? 'cart-wreck' : 'cart-crash';
          events.push(name);
          this.eventSources.set(name, { x: cart.x, y: cart.y });
        }
        if (cart.rider) {
          cart.rider = false;
          // Set the rider down at a DEFINED position (feet on the buffer end
          // of the track) BEFORE the hit — the knockback must start from a
          // known spot, never from inside whatever the cart finished against.
          p.dismountCart();
          p.x = cart.endX;
          p.y = cart.endY - p.h;
          this.damagePlayer(p, cart.x + cart.dirX * 8, events);
        }
      } else if (cart.rider && p.carting && !p.dead) {
        cart.carry(p);
      }
    }

    // Hazards.
    if (!p.dead) {
      for (const s of this.spikes) {
        if (s.touches(p)) this.damagePlayer(p, s.x, events);
      }
      for (const t of this.traps) {
        const ev = t.update();
        // Only traps the player could plausibly see or hear announce
        // themselves, and they announce themselves AT the trap.
        if (ev && Math.abs(t.x - p.x) < AMBIENT_RANGE) {
          const name = ev === 'warn' ? 'spike-warn' : 'spike-trap';
          events.push(name);
          this.eventSources.set(name, { x: t.x, y: t.y });
        }
        if (t.touches(p)) this.damagePlayer(p, t.x, events);
      }
      for (const s of this.swings) {
        s.update();
        if (s.touches(p)) this.damagePlayer(p, s.x, events);
      }
      for (const st of this.stalactites) {
        const ev = st.update(this.map, p.layer, p);
        // Armed by the player, but they may already have dashed out of
        // earshot by the time it lands — gate like every scenery hazard.
        if (ev && Math.abs(st.x - p.x) < AMBIENT_RANGE) {
          const name = ev === 'warn' ? 'stalactite-warn' : ev === 'fall' ? 'stalactite-fall' : 'stalactite-shatter';
          events.push(name);
          this.eventSources.set(name, { x: st.x, y: st.y });
        }
        if (st.touches(p)) this.damagePlayer(p, st.x, events);
      }
      for (const hp of this.hoppers) {
        hp.update();
        const r = hp.interact(p);
        if (r === 'kill') {
          this.score += SCORE.enemy;
          events.push('hopper-stomp');
          this.eventSources.set('hopper-stomp', { x: hp.x, y: hp.y });
        } else if (r === 'hurt') {
          this.damagePlayer(p, hp.x, events);
        }
      }
      for (const e of this.enemies) {
        e.update();
        const r = e.interact(p);
        if (r === 'kill') {
          this.score += SCORE.enemy;
          events.push('enemy');
        } else if (r === 'hurt') {
          this.damagePlayer(p, e.x, events);
        }
      }
      for (const d of this.drones) {
        d.update();
        const r = d.interact(p);
        if (r === 'kill') {
          this.score += SCORE.enemy;
          events.push('enemy');
        } else if (r === 'hurt') {
          this.damagePlayer(p, d.x, events);
        }
      }
    }

    // Crumbling ledges: they carry the player until they let go.
    for (const c of this.crumbles) {
      if (c.update(p) === 'crumble') {
        events.push('crumble');
        this.eventSources.set('crumble', { x: c.x + c.w / 2, y: c.y });
      }
      if (c.solid && !p.dead) this.standOn(p, c.x, c.y, c.w);
    }

    // Phase platforms: hard light, solid half the time. Like the crumble
    // ledge they are NOT tilemap tiles — standOn carries the player. Their
    // clocks tick level-wide, so the blink is ambient-gated.
    for (const ph of this.phasePlats) {
      if (ph.update() === 'blink' && Math.abs(ph.x + ph.w / 2 - p.x) < AMBIENT_RANGE) {
        events.push('phase-blink');
        this.eventSources.set('phase-blink', { x: ph.x + ph.w / 2, y: ph.y });
      }
      if (ph.solid && !p.dead) this.standOn(p, ph.x, ph.y, ph.w);
    }

    // Collectibles & progression.
    for (const c of this.crystals) {
      if (c.tryCollect(p)) {
        this.score += SCORE.crystal;
        events.push('crystal');
      }
    }
    for (const c of this.checkpoints) {
      if (c.tryActivate(p)) {
        this.respawnPos = { x: c.x, y: c.y - PHYS.heightRadius - 2 };
        events.push('checkpoint');
      }
    }
    for (const s of this.secrets) {
      if (!s.found && p.x > s.x && p.x < s.x + s.w && p.y > s.y && p.y < s.y + s.h) {
        s.found = true;
        this.score += SCORE.secret;
        events.push('secret');
      }
    }

    // Boss: crossing the trigger slams the arena gates shut behind and ahead
    // of the player — the only way out is through the fight.
    if (this.bossKind && !this.boss && !this.bossDefeated && this.bossTriggerX >= 0 && p.x > this.bossTriggerX) {
      const bx = this.arena.right - 96;
      const gy = this.groundAt(bx);
      this.boss =
        this.bossKind === 'press'
          ? new PressBoss(bx, gy, this.arena.left, this.arena.right)
          : this.bossKind === 'shard'
            ? new CrystalBoss(bx, gy, this.arena.left, this.arena.right)
            : this.bossKind === 'mirage'
              ? new MirageBoss(bx, gy, this.arena.left, this.arena.right)
              : new Boss(bx, gy, this.arena.left, this.arena.right);
      this.arenaGates = new BossArena(this.arena.left, this.arena.right, this.groundAt(this.arena.left + 40));
      const ev = this.arenaGates.lock();
      if (ev) events.push(ev);
      events.push('boss');
    }
    if (this.arenaGates) {
      this.arenaGates.update();
      if (this.arenaGates.confine(p)) events.push('gate-bump');
    }
    if (this.boss) {
      if (!this.boss.defeated) {
        // The boss's own events (telegraph, slam) drive sfx and screen shake.
        events.push(...this.boss.update(p));
        // A dead player is not a target — same rule as every other hazard.
        const r = p.dead ? null : this.boss.interact(p);
        if (r === 'hit') {
          this.score += this.boss.hp <= 0 ? SCORE.bossDefeat : SCORE.bossHit;
          events.push(this.boss.hp <= 0 ? 'boss-defeated' : 'boss-hit');
        } else if (r === 'hurt') {
          this.damagePlayer(p, this.boss.x, events);
        }
      }
      if (this.boss.defeated && !this.bossDefeated) {
        this.bossDefeated = true;
        // Victory: the gates grind back up and the goal is reachable again.
        const ev = this.arenaGates?.release();
        if (ev) events.push(ev);
        // interact() already reported the killing hit as 'boss-defeated'.
        if (!events.includes('boss-defeated')) events.push('boss-defeated');
      }
    }

    // Goal.
    if ((this.bossKind === null || this.bossDefeated) && !this.results && this.goal.tryTrigger(p)) {
      events.push('goal');
      this.results = this.stats();
    }
    this.goal.update();

    // Backtrack limit: the world closes behind you, exactly like the classic
    // games' screen edge. It only ever advances, and never during the boss
    // lock-in (the gates own confinement there).
    if (!this.arenaGates) {
      this.backLimitX = Math.max(this.backLimitX, p.x - BACKTRACK_SLACK);
      if (!p.dead && p.x < this.backLimitX) {
        p.x = this.backLimitX;
        if (p.gsp < 0) p.gsp = 0;
        if (p.xsp < 0) p.xsp = 0;
      }
    }

    // Death / falling into the void below every route.
    if (!p.dead && p.y > this.voidY) {
      p.die();
      events.push('die');
    }
    if (p.dead && p.y > this.map.pixelH + 96) {
      p.respawn(this.respawnPos.x, this.respawnPos.y);
      this.loopTracker.reset();
      this.prevX = p.x;
      events.push('respawn');
    }

    this.prevX = p.x;
    return events;
  }

  private damagePlayer(p: Player, fromX: number, events: string[]): void {
    // Already dead: nothing more can happen to them. Re-emitting 'die' every
    // frame the corpse still overlaps a hazard used to re-trigger hit-stop
    // forever, freezing the game solid.
    if (p.dead) return;
    const lost = p.hurt(fromX);
    if (p.dead) {
      events.push('die');
      return;
    }
    const shieldLost = p.events.includes('shield-lost');
    const boardLost = p.events.includes('board-lost');
    if (lost > 0 || shieldLost || boardLost) {
      this.tookDamage = true;
      // Emit the specific event too: `player.events` is refilled at the start
      // of the next player update, so the scene can only ever see the level's
      // event stream for anything raised during Level.update.
      if (boardLost) events.push('board-lost');
      else if (shieldLost) events.push('shield-lost');
      events.push('hurt');
      this.scatterRings(p, lost);
    }
  }

  /**
   * Carries the player on a moving/temporary surface the tile map knows
   * nothing about (crumbling ledges). Behaves like a one-way platform: only
   * catches feet arriving from above.
   */
  private standOn(p: Player, x: number, y: number, w: number): void {
    if (p.ysp < 0) return;
    if (p.x < x - 4 || p.x > x + w + 4) return;
    const feet = p.y + p.h;
    if (feet < y - 2 || feet > y + 14) return;
    p.y = y - p.h;
    p.ysp = 0;
    if (!p.grounded) {
      p.grounded = true;
      p.angle = 0;
      p.gsp = p.xsp;
      p.events.push('land');
    }
  }

  private scatterRings(p: Player, count: number): void {
    const n = Math.min(count, 16);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / 8;
      const speed = 3.5;
      this.scattered.push(
        new ScatteredRing(p.x, p.y - 8, Math.cos(a) * speed, Math.sin(a) * speed - 2.5),
      );
    }
  }

  /** First solid surface below (x, yFrom) on layer 0 — used for boss spawn. */
  groundAt(x: number, yFrom = 0): number {
    const tx = Math.floor(x / T);
    for (let ty = Math.floor(yFrom / T); ty < this.map.h; ty++) {
      const tile = this.map.get(tx, ty, 0);
      const max = Math.max(...tile.heights);
      if (max > 0) return (ty + 1) * T - max;
    }
    return this.map.pixelH;
  }

  stats(): LevelStats {
    return {
      timeFrames: this.timeFrames,
      ringsHeld: 0, // filled by caller with player rings
      ringsCollected: this.ringsCollected,
      crystalsFound: this.crystals.filter((c) => c.taken).length,
      crystalsTotal: this.crystals.length,
      secretsFound: this.secrets.filter((s) => s.found).length,
      secretsTotal: this.secrets.length,
      tookDamage: this.tookDamage,
    };
  }
}
