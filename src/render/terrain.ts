/**
 * Terrain renderer: smooth, textured, lit ground baked lazily into chunks at
 * the device render scale.
 *
 * The old renderer filled each tile column with 1-px rects at 640x360 and let
 * the browser blow the frame up with nearest-neighbour — stair-stepped slopes,
 * a dotted fill and no sense of mass. This one:
 *
 *  - builds the solid mass as polygons from `terrainGeometry` (surfaces
 *    smoothed along their own run, walls kept on their exact pixel edge);
 *  - fills it with a per-biome procedural material (Duskmere's checkered
 *    earth, the Foundry's riveted plate, the Underwhen's faceted rock, Noon
 *    Tomorrow's composite panels), anchored to WORLD space so it is seamless
 *    across chunks;
 *  - derives every edge effect by compositing the same path against shifted
 *    copies of itself: a turf/lip cap that follows any profile, a lit top
 *    edge, an ambient-occlusion band under the lip, rim light on walls, a
 *    shadowed underside on ceilings, a glow above lit surfaces, and darkening
 *    with depth below the surface;
 *  - paints a back wall behind underground galleries, so a tunnel reads as a
 *    tunnel instead of a hole onto the sunset;
 *  - draws one-way ledges as their own props.
 *
 * Chunks are 256x256 logical px and kept in an LRU pool whose canvases are
 * recycled. A chunk is some twenty full-surface compositing passes, far too
 * much GPU work to drop into one frame of a game about speed — so the ones
 * ahead of the run are baked IN STAGES, a few passes per frame, and are
 * finished well before they scroll into view. Only a chunk that is needed on
 * screen right now (level start, a respawn) is baked in one go. A change of
 * render scale flushes the pool.
 */
import type { TileMap } from '../physics/TileMap.ts';
import type { LevelTheme } from '../game/Level.ts';
import type { LoopZone } from '../game/loops.ts';
import { worldScale, renderScaleVersion, makeLayer, blit, type Layer } from '../core/view.ts';
import { buildColumns, solidPolys, ledges, interiorRects, type Ledge } from './terrainGeometry.ts';

export const CHUNK = 256;
/** World px of neighbouring geometry included around a chunk for edge effects. */
const MARGIN = 40;
/**
 * Extra geometry above a chunk: depth shading asks whether the pixel up to
 * 176 px ABOVE is solid, and a chunk that could not see that far would shade
 * differently from its neighbour — a visible seam on every chunk row.
 */
const MARGIN_TOP = 192;
/**
 * Chunks kept. Baked at the world scale a chunk is 1152 px square on a 1080p
 * screen (5 MB), and the zoomed view shows six of them at most, twelve when
 * a boss fight pulls the camera back: this covers that, the prefetch ring
 * and a turn-around.
 */
const POOL = 24;
/**
 * Bake stages advanced per SIMULATION STEP for chunks that are not on screen
 * yet. A stage is ONE compositing pass (five chunk-sized operations): at the
 * world scale a chunk is 2.25 times the pixels it was at the UI scale, and
 * three passes of that is the same fill the old two stages of three were.
 * Fifteen-odd passes a chunk, 180 a second: twelve chunks a second, where a
 * hero at full speed uncovers eleven.
 *
 * Per step, not per draw: the hero covers ground per step. Budgeted per
 * draw, a machine that could only manage twelve draws a second prefetched a
 * fifth as much per pixel travelled, half the chunks came on screen
 * unfinished and were baked whole in one frame — which is what made it slow.
 */
const STAGES_PER_STEP = 3;
/** Steps' worth of stages one draw may spend (a whole chunk, never several). */
const MAX_STEPS_PER_DRAW = 5;
/** Staged bakes under way at once; the camera can outrun a longer queue. */
const MAX_BAKING = 6;

/* --------------------------------- Styles --------------------------------- */

interface TerrainStyle {
  /** Material tile: logical size and painter (draws into a size x size box). */
  matSize: number;
  material: (ctx: CanvasRenderingContext2D, s: number) => void;
  /** Back wall behind galleries: material drawn under this dark wash. */
  wallWash: string;
  cap: string;
  capHi: string;
  capLo: string;
  capDepth: number;
  /** Hanging turf teeth under the cap (grass only). */
  teeth: boolean;
  /** Thin lit line on the very surface. */
  edgeHi: string;
  edgeHiDepth: number;
  /** Translucent glow just above a lit surface (neon strip, crystal crust). */
  glow?: string;
  glowDepth?: number;
  /** Light catching the left-facing walls, shade on the right-facing ones. */
  rimLight: string;
  rimShade: string;
  /** Occlusion under the lip and under ceilings. */
  ao: string;
  /** Darkening with depth below the surface (per step). */
  depthShade: string;
  ledge: (ctx: CanvasRenderingContext2D, l: Ledge) => void;
}

function lcg(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Duskmere Coast: sun-warmed checkered earth under deep dusk-lit turf. */
const DUSK: TerrainStyle = {
  matSize: 32,
  material(ctx, s) {
    const half = s / 2;
    const tones = ['#a35a33', '#8a4628'];
    for (let i = 0; i < 4; i++) {
      const x = (i % 2) * half;
      const y = Math.floor(i / 2) * half;
      const tone = tones[(i + Math.floor(i / 2)) % 2];
      ctx.fillStyle = tone;
      ctx.fillRect(x, y, half, half);
      // Soft bevel: each square catches the low sun on its upper-left.
      ctx.fillStyle = 'rgba(255,200,140,0.10)';
      ctx.fillRect(x, y, half, 1.5);
      ctx.fillRect(x, y, 1.5, half);
      ctx.fillStyle = 'rgba(40,12,4,0.16)';
      ctx.fillRect(x, y + half - 1.5, half, 1.5);
      ctx.fillRect(x + half - 1.5, y, 1.5, half);
    }
    const r = lcg(11);
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = r() > 0.5 ? 'rgba(60,20,8,0.22)' : 'rgba(255,190,130,0.12)';
      ctx.beginPath();
      ctx.arc(r() * s, r() * s, 0.6 + r() * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  wallWash: 'rgba(28,10,26,0.72)',
  cap: '#3f9a4a',
  capHi: '#b9de68',
  capLo: '#245f34',
  capDepth: 9,
  teeth: true,
  edgeHi: '#e8f59a',
  edgeHiDepth: 1.6,
  glow: 'rgba(255,190,100,0.20)',
  glowDepth: 3,
  rimLight: 'rgba(255,196,130,0.30)',
  rimShade: 'rgba(30,8,20,0.35)',
  ao: 'rgba(40,10,20,0.26)',
  depthShade: 'rgba(24,8,30,0.16)',
  ledge(ctx, l) {
    // A floating turf island: grass deck over a tapered checkered underside.
    const { x, y, w } = l;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x + w, y + 2);
    ctx.lineTo(x + w - 3, y + 12);
    ctx.quadraticCurveTo(x + w / 2, y + 19, x + 3, y + 12);
    ctx.closePath();
    ctx.fillStyle = '#8a4628';
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = '#a35a33';
    for (let cx = Math.floor(x / 8) * 8; cx < x + w; cx += 8) {
      if (((cx / 8) | 0) % 2 === 0) ctx.fillRect(cx, y + 6, 8, 6);
      else ctx.fillRect(cx, y + 12, 8, 8);
    }
    ctx.fillStyle = 'rgba(30,8,20,0.35)';
    ctx.fillRect(x, y + 13, w, 8);
    ctx.restore();
    ctx.fillStyle = '#245f34';
    ctx.beginPath();
    ctx.roundRect(x - 1, y, w + 2, 7, 3);
    ctx.fill();
    ctx.fillStyle = '#3f9a4a';
    ctx.beginPath();
    ctx.roundRect(x - 1, y - 0.5, w + 2, 5.5, 3);
    ctx.fill();
    ctx.fillStyle = '#e8f59a';
    ctx.fillRect(x + 1, y - 0.5, w - 2, 1.4);
  },
};

/** Otherwhile Foundry: riveted steel plate under a grated walkway lip. */
const FOUNDRY: TerrainStyle = {
  matSize: 64,
  material(ctx, s) {
    const p = s / 2;
    const tones = ['#4a5162', '#434a5a', '#4e5567', '#40475a'];
    for (let i = 0; i < 4; i++) {
      const x = (i % 2) * p;
      const y = Math.floor(i / 2) * p;
      ctx.fillStyle = tones[i];
      ctx.fillRect(x, y, p, p);
      ctx.fillStyle = 'rgba(190,200,220,0.13)';
      ctx.fillRect(x + 1, y + 1, p - 2, 1.4);
      ctx.fillRect(x + 1, y + 1, 1.4, p - 2);
      ctx.fillStyle = 'rgba(10,12,20,0.38)';
      ctx.fillRect(x, y + p - 1.4, p, 1.4);
      ctx.fillRect(x + p - 1.4, y, 1.4, p);
      for (const [rx, ry] of [
        [4, 4],
        [p - 4, 4],
        [4, p - 4],
        [p - 4, p - 4],
      ]) {
        ctx.fillStyle = 'rgba(10,12,20,0.45)';
        ctx.beginPath();
        ctx.arc(x + rx + 0.4, y + ry + 0.5, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7f889b';
        ctx.beginPath();
        ctx.arc(x + rx, y + ry, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // A brushed-metal streak or two so plates are not flat paint.
    ctx.fillStyle = 'rgba(200,210,230,0.05)';
    ctx.fillRect(0, s * 0.3, s, 2);
    ctx.fillRect(0, s * 0.78, s, 1);
  },
  wallWash: 'rgba(8,8,16,0.74)',
  cap: '#7c8598',
  capHi: '#c9d0dc',
  capLo: '#2a2f3c',
  capDepth: 7,
  teeth: false,
  edgeHi: '#eef2f8',
  edgeHiDepth: 1.3,
  glow: 'rgba(255,150,60,0.10)',
  glowDepth: 2,
  rimLight: 'rgba(255,170,90,0.24)',
  rimShade: 'rgba(0,0,8,0.4)',
  ao: 'rgba(0,0,10,0.32)',
  depthShade: 'rgba(4,4,12,0.17)',
  ledge(ctx, l) {
    // Steel girder: deck plate, hazard-striped fascia, truss underneath.
    const { x, y, w } = l;
    ctx.fillStyle = '#23262e';
    ctx.fillRect(x, y + 6, w, 8);
    ctx.strokeStyle = '#3a3f4c';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let tx = x; tx < x + w; tx += 12) {
      ctx.moveTo(tx, y + 7);
      ctx.lineTo(tx + 6, y + 13);
      ctx.lineTo(tx + 12, y + 7);
    }
    ctx.stroke();
    ctx.fillStyle = '#2b2f3a';
    ctx.fillRect(x, y + 13, w, 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y + 3, w, 3.5);
    ctx.clip();
    ctx.fillStyle = '#e8b832';
    ctx.fillRect(x, y + 3, w, 3.5);
    ctx.fillStyle = '#1b1d24';
    for (let sx = x - 8; sx < x + w; sx += 8) {
      ctx.beginPath();
      ctx.moveTo(sx, y + 6.5);
      ctx.lineTo(sx + 4, y + 3);
      ctx.lineTo(sx + 8, y + 3);
      ctx.lineTo(sx + 4, y + 6.5);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#9aa3b4';
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = '#eef2f8';
    ctx.fillRect(x, y, w, 1);
  },
};

/** The Underwhen: faceted indigo rock under a luminous crystal crust. */
const UNDERWHEN: TerrainStyle = {
  matSize: 48,
  material(ctx, s) {
    ctx.fillStyle = '#2b2050';
    ctx.fillRect(0, 0, s, s);
    const r = lcg(5);
    const tones = ['#33265e', '#261c48', '#2f2357', '#3a2c69', '#231a42'];
    // Facets: jittered grid triangles, wrapped so the tile repeats cleanly.
    const n = 4;
    const g = s / n;
    const pts: [number, number][][] = [];
    for (let j = 0; j <= n; j++) {
      pts.push([]);
      for (let i = 0; i <= n; i++) {
        const edge = i === 0 || j === 0 || i === n || j === n;
        pts[j].push([i * g + (edge ? 0 : (r() - 0.5) * g * 0.7), j * g + (edge ? 0 : (r() - 0.5) * g * 0.7)]);
      }
    }
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = pts[j][i];
        const b = pts[j][i + 1];
        const c = pts[j + 1][i + 1];
        const d = pts[j + 1][i];
        for (const tri of [
          [a, b, c],
          [a, c, d],
        ]) {
          ctx.fillStyle = tones[Math.floor(r() * tones.length)];
          ctx.beginPath();
          ctx.moveTo(tri[0][0], tri[0][1]);
          ctx.lineTo(tri[1][0], tri[1][1]);
          ctx.lineTo(tri[2][0], tri[2][1]);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    // Hairline seams of light: the whole cavern is laced with crystal.
    ctx.strokeStyle = 'rgba(90,220,255,0.16)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(pts[1][0][0], pts[1][0][1]);
    ctx.lineTo(pts[1][1][0], pts[1][1][1]);
    ctx.lineTo(pts[2][2][0], pts[2][2][1]);
    ctx.lineTo(pts[2][3][0], pts[2][3][1]);
    ctx.stroke();
  },
  wallWash: 'rgba(6,3,16,0.7)',
  cap: '#2fb8dc',
  capHi: '#8ff0ff',
  capLo: '#5c2f9a',
  capDepth: 7,
  teeth: false,
  edgeHi: '#e6fdff',
  edgeHiDepth: 1.5,
  glow: 'rgba(75,225,255,0.30)',
  glowDepth: 4,
  rimLight: 'rgba(120,220,255,0.22)',
  rimShade: 'rgba(4,0,14,0.4)',
  ao: 'rgba(8,2,24,0.34)',
  depthShade: 'rgba(6,2,18,0.17)',
  ledge(ctx, l) {
    // A crystal slab: violet body, jagged hanging facets, lit cyan top.
    const { x, y, w } = l;
    ctx.fillStyle = '#3a2a6c';
    ctx.beginPath();
    ctx.moveTo(x, y + 3);
    ctx.lineTo(x + w, y + 3);
    let k = 0;
    for (let px = x + w; px > x; px -= 6) {
      ctx.lineTo(px - 3, y + 10 + (k++ % 2 ? 6 : 2));
    }
    ctx.lineTo(x, y + 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(160,240,255,0.18)';
    ctx.fillRect(x, y + 5, w, 2);
    ctx.fillStyle = '#2fb8dc';
    ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = '#e6fdff';
    ctx.fillRect(x, y, w, 1.2);
  },
};

/** Noon Tomorrow: near-black composite decks wearing a hot light strip. */
const NEON: TerrainStyle = {
  matSize: 64,
  material(ctx, s) {
    ctx.fillStyle = '#1a1724';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#1f1b2b';
    ctx.fillRect(2, 2, s / 2 - 4, s / 2 - 4);
    ctx.fillRect(s / 2 + 2, s / 2 + 2, s / 2 - 4, s / 2 - 4);
    ctx.strokeStyle = '#0f0d16';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(0.6, 0.6, s / 2 - 1.2, s / 2 - 1.2);
    ctx.strokeRect(s / 2 + 0.6, 0.6, s / 2 - 1.2, s / 2 - 1.2);
    ctx.strokeRect(0.6, s / 2 + 0.6, s / 2 - 1.2, s / 2 - 1.2);
    ctx.strokeRect(s / 2 + 0.6, s / 2 + 0.6, s / 2 - 1.2, s / 2 - 1.2);
    // Circuit traces and the odd status LED.
    ctx.strokeStyle = 'rgba(120,90,200,0.16)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(6, 14);
    ctx.lineTo(20, 14);
    ctx.lineTo(26, 20);
    ctx.lineTo(26, 28);
    ctx.moveTo(s / 2 + 8, s / 2 + 22);
    ctx.lineTo(s / 2 + 18, s / 2 + 12);
    ctx.lineTo(s - 6, s / 2 + 12);
    ctx.stroke();
    ctx.fillStyle = 'rgba(65,240,255,0.55)';
    ctx.fillRect(s / 2 + 22, 9, 1.6, 1.6);
    ctx.fillStyle = 'rgba(255,79,168,0.5)';
    ctx.fillRect(9, s / 2 + 24, 1.6, 1.6);
  },
  wallWash: 'rgba(6,4,14,0.66)',
  cap: '#2c2739',
  capHi: '#463e5c',
  capLo: '#100e17',
  capDepth: 6,
  teeth: false,
  edgeHi: '#ff4fa8',
  edgeHiDepth: 2.2,
  glow: 'rgba(255,79,168,0.38)',
  glowDepth: 5,
  rimLight: 'rgba(65,240,255,0.18)',
  rimShade: 'rgba(0,0,0,0.35)',
  ao: 'rgba(0,0,0,0.3)',
  depthShade: 'rgba(4,2,12,0.15)',
  ledge(ctx, l) {
    // Hard-light deck: translucent glass with a bright projector edge.
    const { x, y, w } = l;
    ctx.fillStyle = 'rgba(65,240,255,0.16)';
    ctx.fillRect(x, y + 2, w, 9);
    ctx.strokeStyle = 'rgba(65,240,255,0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let gx = x + 8; gx < x + w; gx += 8) {
      ctx.moveTo(gx, y + 3);
      ctx.lineTo(gx, y + 10);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(65,240,255,0.45)';
    ctx.fillRect(x, y + 10, w, 1.2);
    ctx.fillStyle = '#41f0ff';
    ctx.fillRect(x, y, w, 2.6);
    ctx.fillStyle = '#eaffff';
    ctx.fillRect(x, y, w, 1);
  },
};

const STYLES: Record<LevelTheme, TerrainStyle> = {
  verdant: DUSK,
  gear: FOUNDRY,
  crystal: UNDERWHEN,
  neon: NEON,
};

/* ------------------------------ Compositing ------------------------------- */

/** World-anchored repeating pattern of a style's material at scale `s`. */
function materialPattern(ctx: CanvasRenderingContext2D, style: TerrainStyle, s: number): CanvasPattern {
  const tile = makeLayer(style.matSize, style.matSize, s);
  style.material(tile.ctx, style.matSize);
  const pat = ctx.createPattern(tile.canvas, 'repeat')!;
  pat.setTransform(new DOMMatrix([1 / s, 0, 0, 1 / s, 0, 0]));
  return pat;
}

/**
 * Vertical blade stripes for the turf hanging under the cap. Two sets with
 * different lengths interleave, so the fringe reads as ragged grass rather
 * than a comb. (Stripes, not triangles: the pattern is anchored to world y,
 * and the surface it hangs from can sit at any height.)
 */
function teethPatterns(ctx: CanvasRenderingContext2D, color: string, s: number): [CanvasPattern, CanvasPattern] {
  const make = (x: number, w: number) => {
    const tile = makeLayer(9, 4, s);
    tile.ctx.fillStyle = color;
    tile.ctx.fillRect(x, 0, w, 4);
    const pat = ctx.createPattern(tile.canvas, 'repeat')!;
    pat.setTransform(new DOMMatrix([1 / s, 0, 0, 1 / s, 0, 0]));
    return pat;
  };
  return [make(0.5, 2.6), make(5, 2)];
}

/**
 * `band(dx, dy)`: the part of the path NOT covered by itself shifted by
 * (dx, dy) — i.e. the edge facing away from the shift. Painted into `scratch`
 * then composited onto the target. This one trick yields caps, rims, AO and
 * glows that follow any terrain profile.
 */
class Compositor {
  private target: Layer;
  private scratch: Layer;
  private path: Path2D;
  private ox: number;
  private oy: number;

  constructor(target: Layer, scratch: Layer, path: Path2D, ox: number, oy: number) {
    this.target = target;
    this.scratch = scratch;
    this.path = path;
    this.ox = ox;
    this.oy = oy;
  }

  private begin(): CanvasRenderingContext2D {
    const c = this.scratch.ctx;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, this.scratch.canvas.width, this.scratch.canvas.height);
    c.restore();
    c.save();
    c.translate(-this.ox, -this.oy);
    return c;
  }

  private fillShifted(c: CanvasRenderingContext2D, dx: number, dy: number): void {
    c.save();
    c.translate(dx, dy);
    c.fill(this.path);
    c.restore();
  }

  private commit(alpha = 1, op: GlobalCompositeOperation = 'source-over'): void {
    this.scratch.ctx.restore();
    const t = this.target.ctx;
    t.save();
    t.setTransform(1, 0, 0, 1, 0, 0);
    t.globalAlpha = alpha;
    t.globalCompositeOperation = op;
    t.drawImage(this.scratch.canvas, 0, 0);
    t.restore();
  }

  /**
   * Colours the mask built so far. Masks are always built with OPAQUE fills:
   * destination-out/in scale by the source alpha, so a translucent colour
   * used as the mask would only remove a fraction of what it should (that
   * bug tinted every wall pixel with the rim light).
   */
  private paint(c: CanvasRenderingContext2D, fill: string | CanvasPattern): void {
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = fill;
    c.fillRect(this.ox - 8, this.oy - 8, CHUNK + 16, CHUNK + 16);
  }

  /** Edge of the solid facing away from the shift (dx, dy). */
  band(fill: string | CanvasPattern, dx: number, dy: number, alpha = 1): void {
    const c = this.begin();
    c.fillStyle = '#000';
    c.fill(this.path);
    c.globalCompositeOperation = 'destination-out';
    this.fillShifted(c, dx, dy);
    this.paint(c, fill);
    this.commit(alpha);
  }

  /** Solid pixels that have solid `k` px above them (depth below surface). */
  buried(fill: string, k: number): void {
    const c = this.begin();
    c.fillStyle = '#000';
    this.fillShifted(c, 0, k);
    c.globalCompositeOperation = 'destination-in';
    c.fill(this.path);
    this.paint(c, fill);
    this.commit();
  }

  /** A strip `depth` px above every top surface (glow), outside the solid. */
  above(fill: string, depth: number): void {
    const c = this.begin();
    c.fillStyle = '#000';
    this.fillShifted(c, 0, -depth);
    c.globalCompositeOperation = 'destination-out';
    c.fill(this.path);
    this.paint(c, fill);
    this.commit();
  }

  /** Band between depth a and b below the surface, kept inside the solid. */
  subBand(fill: string, a: number, b: number): void {
    const c = this.begin();
    c.fillStyle = '#000';
    this.fillShifted(c, 0, a);
    c.globalCompositeOperation = 'destination-out';
    this.fillShifted(c, 0, b);
    c.globalCompositeOperation = 'destination-in';
    c.fill(this.path);
    this.paint(c, fill);
    this.commit();
  }
}

/* --------------------------------- Chunks --------------------------------- */

export class TerrainRenderer {
  private style: TerrainStyle;
  private chunks = new Map<string, Layer | null>();
  /** Chunks being baked in stages, oldest first. */
  private baking = new Map<string, Generator<void, Layer | null>>();
  private spare: Layer[] = [];
  private scratch: Layer | null = null;
  private version = -1;
  private mat: CanvasPattern | null = null;
  private teeth: [CanvasPattern, CanvasPattern] | null = null;
  private readonly cols: number;
  private readonly rows: number;

  private map: TileMap;

  constructor(map: TileMap, theme: LevelTheme) {
    this.map = map;
    this.style = STYLES[theme];
    this.cols = Math.ceil(map.pixelW / CHUNK);
    this.rows = Math.ceil(map.pixelH / CHUNK);
  }

  /** Flushes everything when the render scale changed since the last bake. */
  private validate(): void {
    if (this.version === renderScaleVersion()) return;
    this.version = renderScaleVersion();
    this.chunks.clear();
    this.baking.clear();
    this.spare = [];
    this.scratch = null;
    this.mat = null;
    this.teeth = null;
  }

  /** Bakes every chunk in the given world rect now (level start, behind the fade). */
  warm(x: number, y: number, w: number, h: number): void {
    this.validate();
    for (const [cx, cy] of this.range(x, y, w, h)) this.get(cx, cy);
  }

  /**
   * Draws the terrain visible in the camera rect (world coordinates; the
   * caller has already translated the context by the camera). Missing
   * visible chunks are finished immediately; then the chunks the hero is
   * heading for — two columns ahead, and the rows a fall or a climb is about
   * to reveal — get a few bake stages for each of the `steps` the simulation
   * has taken since the last draw (0 on a draw that only interpolates).
   */
  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, w: number, h: number, dirX = 1, dirY = 0, steps = 1): void {
    this.validate();
    for (const [cx, cy] of this.range(camX, camY, w, h)) {
      const layer = this.get(cx, cy);
      if (layer) blit(ctx, layer, cx * CHUNK, cy * CHUNK);
    }
    const ahead = dirX >= 0 ? camX + w : camX - CHUNK * 2;
    this.queue(ahead, camY - CHUNK / 2, CHUNK * 2, h + CHUNK);
    if (dirY !== 0) this.queue(camX - CHUNK / 2, dirY > 0 ? camY + h : camY - CHUNK, w + CHUNK, CHUNK);
    this.queue(camX - CHUNK, camY - CHUNK, w + CHUNK * 2, h + CHUNK * 2);

    // Oldest job first, and all of the budget on it before the next: the
    // oldest is the one nearest the screen, and three chunks a third done
    // are no use to a camera that needs one.
    let left = STAGES_PER_STEP * Math.max(0, Math.min(MAX_STEPS_PER_DRAW, steps));
    for (const [k, job] of this.baking) {
      while (left > 0) {
        left--;
        const r = job.next();
        if (r.done) {
          this.baking.delete(k);
          this.store(k, r.value);
          break;
        }
      }
      if (left <= 0) break;
    }
  }

  /** Starts staged bakes for the chunks of a world rect that do not exist yet. */
  private queue(x: number, y: number, w: number, h: number): void {
    for (const [cx, cy] of this.range(x, y, w, h)) {
      if (this.baking.size >= MAX_BAKING) return;
      const k = key(cx, cy);
      if (!this.chunks.has(k) && !this.baking.has(k)) this.baking.set(k, this.bake(cx, cy));
    }
  }

  private *range(x: number, y: number, w: number, h: number): Generator<[number, number]> {
    const c0 = Math.max(0, Math.floor(x / CHUNK));
    const c1 = Math.min(this.cols - 1, Math.floor((x + w - 0.01) / CHUNK));
    const r0 = Math.max(0, Math.floor(y / CHUNK));
    const r1 = Math.min(this.rows - 1, Math.floor((y + h - 0.01) / CHUNK));
    for (let cx = c0; cx <= c1; cx++) for (let cy = r0; cy <= r1; cy++) yield [cx, cy];
  }

  private get(cx: number, cy: number): Layer | null {
    const k = key(cx, cy);
    if (this.chunks.has(k)) {
      const v = this.chunks.get(k)!;
      // LRU touch.
      this.chunks.delete(k);
      this.chunks.set(k, v);
      return v;
    }
    // Needed NOW: finish the staged bake if one is under way, else do it all.
    const job = this.baking.get(k) ?? this.bake(cx, cy);
    this.baking.delete(k);
    let r = job.next();
    while (!r.done) r = job.next();
    this.store(k, r.value);
    return r.value;
  }

  private store(k: string, layer: Layer | null): void {
    this.chunks.set(k, layer);
    while (this.chunks.size > POOL) {
      const oldest = this.chunks.keys().next().value!;
      const old = this.chunks.get(oldest);
      this.chunks.delete(oldest);
      if (old) this.spare.push(old);
    }
  }

  /**
   * Bakes one chunk, yielding before every compositing pass so the
   * caller can spread the work over several frames. The scratch layer is
   * shared, but each pass uses it start to finish, so bakes may interleave.
   */
  private *bake(cx: number, cy: number): Generator<void, Layer | null> {
    const s = worldScale();
    const x0 = cx * CHUNK;
    const y0 = cy * CHUNK;
    const gx0 = x0 - MARGIN;
    const gx1 = x0 + CHUNK + MARGIN;
    const gy0 = y0 - MARGIN_TOP;
    const gy1 = y0 + CHUNK + MARGIN;

    const cols = buildColumns(this.map, gx0, gx1, gy0, gy1);
    const polys = solidPolys(cols, gx0);
    const ledgeList = ledges(this.map, x0 - 8, y0 - 24, x0 + CHUNK + 8, y0 + CHUNK + 8);
    const walls = interiorRects(this.map, x0 - 16, y0 - 16, x0 + CHUNK + 16, y0 + CHUNK + 16);
    if (polys.length === 0 && ledgeList.length === 0 && walls.length === 0) return null;

    const layer = this.takeLayer(s);
    const t = layer.ctx;
    t.setTransform(1, 0, 0, 1, 0, 0);
    t.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    // Set outright, not saved and restored: the bake is suspended between
    // stages, and no state may be left stacked on this context meanwhile.
    t.setTransform(s, 0, 0, s, -x0 * s, -y0 * s);

    const st = this.style;
    if (!this.mat) this.mat = materialPattern(t, st, s);
    if (!this.teeth) this.teeth = teethPatterns(t, st.cap, s);

    // Back wall behind galleries: the same material, pushed back in shadow.
    if (walls.length) {
      const wp = new Path2D();
      for (const r of walls) wp.rect(r.x - 1, r.y, r.w + 2, r.h);
      t.fillStyle = this.mat;
      t.fill(wp);
      t.fillStyle = st.wallWash;
      t.fill(wp);
    }

    if (polys.length) {
      const path = new Path2D();
      for (const p of polys) {
        path.moveTo(p[0], p[1]);
        for (let i = 2; i < p.length; i += 2) path.lineTo(p[i], p[i + 1]);
        path.closePath();
      }
      if (!this.scratch || this.scratch.scale !== s) this.scratch = makeLayer(CHUNK, CHUNK, s);
      const comp = new Compositor(layer, this.scratch, path, x0, y0);

      // Body.
      t.fillStyle = this.mat;
      t.fill(path);
      const teeth = this.teeth;
      const passes: (() => void)[] = [
        // Depth below the surface, in soft steps.
        ...[28, 64, 112, 176].map((k) => () => comp.buried(st.depthShade, k)),
        // Occlusion under the lip, fading downward.
        () => comp.subBand(st.ao, st.capDepth - 1, st.capDepth + 5),
        () => comp.subBand(st.ao, st.capDepth - 1, st.capDepth + 12),
        // Underside of ceilings and overhangs.
        () => comp.band(st.ao, 0, -6),
        () => comp.band(st.ao, 0, -12, 0.6),
        // Walls: light from the upper left.
        () => comp.band(st.rimLight, 2, 0),
        () => comp.band(st.rimShade, -3, 0),
        // The cap: teeth first, then the solid lip over them.
        ...(st.teeth
          ? [() => comp.band(teeth[0], 0, st.capDepth + 5), () => comp.band(teeth[1], 0, st.capDepth + 2.5)]
          : []),
        () => comp.band(st.cap, 0, st.capDepth),
        () => comp.subBand(st.capLo, st.capDepth - 2, st.capDepth),
        () => comp.band(st.capHi, 0, 3.2),
        () => comp.band(st.edgeHi, 0, st.edgeHiDepth),
        ...(st.glow ? [() => comp.above(st.glow!, st.glowDepth ?? 3)] : []),
      ];
      for (const pass of passes) {
        yield;
        pass();
      }
    }

    for (const l of ledgeList) st.ledge(t, l);
    return layer;
  }

  private takeLayer(s: number): Layer {
    const l = this.spare.pop();
    if (l && l.scale === s) return l;
    return makeLayer(CHUNK, CHUNK, s);
  }
}

function key(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

/* ---------------------------------- Loops --------------------------------- */

/**
 * A loop's annulus, in the zone's material. The running surface is the INNER
 * rim, so that is where the lit track edge goes; the outer rim gets the cap.
 */
export function renderLoopArt(loop: LoopZone, theme: LevelTheme): Layer {
  const st = STYLES[theme];
  const r = loop.outerR + 8;
  const layer = makeLayer(r * 2, r * 2, worldScale());
  const ctx = layer.ctx;
  ctx.translate(r, r);
  const ring = new Path2D();
  ring.arc(0, 0, loop.outerR, 0, Math.PI * 2);
  ring.arc(0, 0, loop.innerR, 0, Math.PI * 2, true);
  ctx.fillStyle = materialPattern(ctx, st, layer.scale);
  ctx.fill(ring, 'evenodd');
  // Shade the far (lower) half so the ring has volume.
  const shade = ctx.createLinearGradient(0, -loop.outerR, 0, loop.outerR);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, st.depthShade.replace(/[\d.]+\)$/, '0.45)'));
  ctx.fillStyle = shade;
  ctx.fill(ring, 'evenodd');
  // Inner track: cap colour with a bright running edge.
  ctx.lineWidth = st.capDepth;
  ctx.strokeStyle = st.cap;
  ctx.beginPath();
  ctx.arc(0, 0, loop.innerR + st.capDepth / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = st.capLo;
  ctx.beginPath();
  ctx.arc(0, 0, loop.innerR + st.capDepth, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = st.edgeHiDepth;
  ctx.strokeStyle = st.edgeHi;
  ctx.beginPath();
  ctx.arc(0, 0, loop.innerR + st.edgeHiDepth / 2, 0, Math.PI * 2);
  ctx.stroke();
  // Outer rim: the cap, lit along the top.
  ctx.lineWidth = 4;
  ctx.strokeStyle = st.cap;
  ctx.beginPath();
  ctx.arc(0, 0, loop.outerR - 2, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = st.capHi;
  ctx.beginPath();
  ctx.arc(0, 0, loop.outerR - 0.6, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  return layer;
}
