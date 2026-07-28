import { TileMap, stampLoop } from '../physics/TileMap.ts';
import { PHYS } from '../physics/constants.ts';
import { loopLayerAt, makeLoopZone, type LoopZone } from './loops.ts';
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
  GoalSign,
  tileCentre,
  type Rect,
  type MonitorKind,
} from './entities.ts';
import { Boss } from './Boss.ts';
import { SCORE, type LevelStats } from './Score.ts';

const T = PHYS.tile;

/* ------------------------------- Level builder ----------------------------- */

const TERRAIN: Record<string, number> = {
  '#': 1,
  '/': 2,
  '\\': 3,
  '(': 4,
  ')': 5,
  '<': 6,
  '>': 7,
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
      this.set(x + i * 2, row, '(');
      this.set(x + i * 2 + 1, row, ')');
      for (let y = row + 1; y < this.h; y++) {
        this.set(x + i * 2, y, '#');
        this.set(x + i * 2 + 1, y, '#');
      }
    }
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

  loop(cxTile: number, surfaceRow: number, innerR = 40, thickness = 16): void {
    const cx = cxTile * T + T / 2;
    const cy = surfaceRow * T - innerR;
    this.loops.push(makeLoopZone(cx, cy, innerR, thickness));
    this.loopStamps.push({ cx, cy, innerR, thickness });
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

export interface LevelDef {
  name: string;
  act: string;
  build(b: LevelBuilder): void;
}

export class Level {
  readonly name: string;
  readonly map: TileMap;
  readonly loops: LoopZone[];
  readonly secrets: (Rect & { found: boolean })[];
  rings: Ring[];
  scattered: ScatteredRing[] = [];
  springs: Spring[];
  monitors: Monitor[];
  spikes: Spikes[];
  crystals: Crystal[];
  checkpoints: Checkpoint[];
  enemies: SnapCrab[];
  goal: GoalSign;
  boss: Boss | null = null;
  bossDefeated = false;

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

  private prevX = 0;

  constructor(def: LevelDef) {
    this.name = def.name;
    const b = new LevelBuilder(320, 28);
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
    for (const s of b.loopStamps) stampLoop(this.map, 1, s.cx, s.cy, s.innerR, s.thickness);

    this.loops = b.loops;
    this.secrets = b.secretRects.map((r) => ({ ...r, found: false }));
    this.rings = b.rings.map((r) => new Ring(r.x, r.y));
    this.springs = b.springs.map((s) => new Spring(s.x, s.y, s.dir, s.power));
    this.monitors = b.monitors.map((m) => new Monitor(m.x, m.y, m.kind));
    this.spikes = b.spikeDefs.map((s) => new Spikes(s.x, s.y));
    this.crystals = b.crystals.map((c) => new Crystal(c.x, c.y, c.id));
    this.checkpoints = b.checkpoints.map((c) => new Checkpoint(c.x, c.y));
    this.enemies = b.enemies.map((e) => new SnapCrab(e.x, e.y, e.x0, e.x1));
    this.goal = new GoalSign(b.goalPos.x, b.goalPos.y);
    this.startPos = b.playerStart;
    this.respawnPos = { ...b.playerStart };
    this.bossTriggerX = b.bossTriggerX;
    this.arena = b.arena;
    this.prevX = this.startPos.x;
  }

  /** Per-frame world update; the player has already been updated. */
  update(p: Player): string[] {
    const events: string[] = [];
    if (!this.results) this.timeFrames++;

    // Loop layer switching.
    p.layer = loopLayerAt(p.layer, this.prevX, p.x, p.y, this.loops);

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

    // Hazards.
    if (!p.dead) {
      for (const s of this.spikes) {
        if (s.touches(p)) this.damagePlayer(p, s.x, events);
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

    // Boss.
    if (!this.boss && !this.bossDefeated && this.bossTriggerX >= 0 && p.x > this.bossTriggerX) {
      this.boss = new Boss(this.arena.right - 96, this.groundAt(this.arena.right - 96), this.arena.left, this.arena.right);
      events.push('boss');
    }
    if (this.boss) {
      if (!this.boss.defeated) {
        p.x = Math.max(this.arena.left + 12, Math.min(this.arena.right - 12, p.x));
        this.boss.update(p);
        const r = this.boss.interact(p);
        if (r === 'hit') {
          this.score += this.boss.hp <= 0 ? SCORE.bossDefeat : SCORE.bossHit;
          events.push(this.boss.hp <= 0 ? 'boss-defeated' : 'boss-hit');
        } else if (r === 'hurt') {
          this.damagePlayer(p, this.boss.x, events);
        }
      }
      if (this.boss.defeated && !this.bossDefeated) {
        this.bossDefeated = true;
        events.push('boss-defeated');
      }
    }

    // Goal.
    if (this.bossDefeated && !this.results && this.goal.tryTrigger(p)) {
      events.push('goal');
      this.results = this.stats();
    }
    this.goal.update();

    // Death / falling out of the world.
    if (!p.dead && p.y > this.map.pixelH + 32) {
      p.die();
      events.push('die');
    }
    if (p.dead && p.y > this.map.pixelH + 96) {
      p.respawn(this.respawnPos.x, this.respawnPos.y);
      this.prevX = p.x;
      events.push('respawn');
    }

    this.prevX = p.x;
    return events;
  }

  private damagePlayer(p: Player, fromX: number, events: string[]): void {
    const lost = p.hurt(fromX);
    if (p.dead) {
      events.push('die');
      return;
    }
    if (lost > 0 || p.events.includes('shield-lost')) {
      this.tookDamage = true;
      events.push('hurt');
      this.scatterRings(p, lost);
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
