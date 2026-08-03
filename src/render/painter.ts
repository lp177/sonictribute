import { PHYS } from '../physics/constants.ts';
import { TILES, TILE_EMPTY } from '../physics/TileMap.ts';
import type { TileMap } from '../physics/TileMap.ts';
import type { Player } from '../game/Player.ts';
import type { Boss, BossLike } from '../game/Boss.ts';
import type { PressBoss } from '../game/PressBoss.ts';
import type { CrystalBoss } from '../game/CrystalBoss.ts';
import type { LoopZone } from '../game/loops.ts';
import type { LevelTheme } from '../game/Level.ts';
import { AFTERIMAGE_LIFE, AFTERIMAGE_ARM } from '../game/MirageBoss.ts';

const T = PHYS.tile;

/* ------------------------------ Palette (dark, modern) --------------------- */
export const PAL = {
  skyTop: '#0b1026',
  skyBottom: '#1d3a5f',
  hillFar: '#16283f',
  hillNear: '#1f4d3a',
  grass: '#3fae5a',
  grassDark: '#2b7f40',
  dirt: '#8a5a32',
  dirtDark: '#6e4525',
  heroBlue: '#2f7df6',
  heroBlueDark: '#1d4fb4',
  heroCream: '#f3e5c3',
  heroShoe: '#e8384f',
  ring: '#ffd94a',
  ringDark: '#d9a41f',
  crystal: '#4be1ff',
  spring: '#e8c832',
  springBase: '#c23a4b',
  spike: '#9aa3b2',
  enemy: '#d64545',
  pod: '#c8cdd6',
  podDark: '#8f96a3',
  yolk: '#f2b03d',
  board: '#38e0c8',
  boardDark: '#1a9c8a',
  // The Chrono Vault: violet cavern rock lit by its own crystal.
  cavern: '#3a2b5e',
  cavernDark: '#241a42',
  magenta: '#e05ad8',
  magentaDark: '#8a2ea0',
};

/** Per-theme terrain colours (body fill, surface cap, one-way platforms). */
interface TerrainTheme {
  body: string;
  bodyDark: string;
  cap: string;
  capDark: string;
  platTop: string;
  platTopDark: string;
  platBody: string;
  /** Cap thickness in px (default 6). A deeper cap reads as turf, not paint. */
  capDepth?: number;
  /** Thin lit line along the very surface (low sun / light strip). */
  capHighlight?: string;
  /** Highlight thickness in px (default 1.6 — a glint, not a stripe). */
  capHighlightDepth?: number;
  /** Soft translucent glow painted just above the surface line. */
  capGlow?: string;
  /** Horizontal sediment bands inside the body, spaced this many px apart. */
  strataSpacing?: number;
  strataDark?: string;
  strataLight?: string;
  /** Glow above one-way platforms (hard-light decks want to bleed light). */
  platGlow?: string;
}

const TERRAIN_THEMES: Record<LevelTheme, TerrainTheme> = {
  // Noon Tomorrow: asphalt/composite decks with a hot light-strip running
  // along every walkable edge. The strip carries the readability: the body is
  // nearly black on purpose so the magenta line is the ground.
  neon: {
    body: '#1a1824',
    bodyDark: '#100e18',
    cap: '#332e44',
    capDark: '#1c1928',
    platTop: '#41f0ff',
    platTopDark: '#12414a',
    platBody: '#1a1824',
    capDepth: 7,
    capHighlight: '#ff4fa8',
    capHighlightDepth: 2.4,
    capGlow: 'rgba(255,79,168,0.35)',
    strataSpacing: 16,
    strataDark: 'rgba(0,0,0,0.30)',
    platGlow: 'rgba(65,240,255,0.28)',
  },
  // Duskmere Coast: warm shore earth under a deep turf cap, its tips lit by
  // the jammed sun. Strata in the body keep tall cliffs from reading as one
  // brown slab.
  verdant: {
    body: '#7c4a29',
    bodyDark: '#5e381f',
    cap: '#379a52',
    capDark: '#256e3a',
    platTop: '#379a52',
    platTopDark: '#256e3a',
    platBody: '#7c4a29',
    capDepth: 9,
    capHighlight: '#c9e070',
    capGlow: 'rgba(255,196,90,0.22)',
    strataSpacing: 22,
    strataDark: 'rgba(46,24,10,0.42)',
    strataLight: 'rgba(255,190,120,0.10)',
  },
  gear: {
    body: '#4a4f5c',
    bodyDark: '#343947',
    cap: '#7b8496',
    capDark: '#565e6c',
    platTop: '#e8c832',
    platTopDark: '#23262e',
    platBody: '#4a4f5c',
  },
  // Indigo rock under a crust of luminous crystal. The cap is the brightest
  // thing in the zone on purpose: underground, the floor is the light source,
  // so the running line stays readable against a near-black background.
  crystal: {
    body: PAL.cavern,
    bodyDark: PAL.cavernDark,
    cap: '#45c3e2',
    capDark: PAL.magentaDark,
    platTop: PAL.magenta,
    platTopDark: '#4a1a58',
    platBody: PAL.cavern,
  },
};

/* ------------------------------ Static terrain ----------------------------- */

/**
 * Renders the layer-0 terrain into offscreen chunks (one canvas per 16-tile
 * column band) once at level load — no per-frame tile work afterwards.
 */
export function renderTerrain(map: TileMap, theme: LevelTheme = 'verdant'): HTMLCanvasElement[] {
  const pal = TERRAIN_THEMES[theme];
  const chunkTiles = 16;
  const chunks: HTMLCanvasElement[] = [];
  for (let cx = 0; cx < map.w; cx += chunkTiles) {
    const cv = document.createElement('canvas');
    cv.width = chunkTiles * T;
    cv.height = map.pixelH;
    const ctx = cv.getContext('2d')!;
    for (let tx = cx; tx < Math.min(cx + chunkTiles, map.w); tx++) {
      for (let ty = 0; ty < map.h; ty++) {
        const id = tileId(map, tx, ty);
        if (id !== TILE_EMPTY) drawTile(ctx, map, id, (tx - cx) * T, ty * T, tx, ty, pal);
      }
    }
    // Depth shading: the world is deep, and an unshaded slab of bedrock
    // filling the lower screen reads as a flat wall. Darkening with depth
    // turns it into distance instead.
    const shade = ctx.createLinearGradient(0, map.pixelH * 0.42, 0, map.pixelH);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.globalCompositeOperation = 'source-over';
    chunks.push(cv);
  }
  return chunks;
}

function tileId(map: TileMap, tx: number, ty: number): number {
  const t = map.get(tx, ty, 0);
  return TILES.findIndex((c) => c === t);
}

function drawTile(ctx: CanvasRenderingContext2D, map: TileMap, id: number, px: number, py: number, tx: number, ty: number, pal: TerrainTheme): void {
  const above = map.get(tx, ty - 1, 0);
  const exposed = above === TILES[TILE_EMPTY];
  ctx.save();
  ctx.translate(px, py);

  // Solid body from the tile's height array.
  const heights = TILES[id].heights;
  ctx.fillStyle = pal.body;
  for (let c = 0; c < T; c++) {
    if (id === 8) continue; // one-way platform: drawn separately
    ctx.fillRect(c, T - heights[c], 1, heights[c]);
  }
  if (id !== 8) {
    ctx.fillStyle = pal.bodyDark;
    for (let c = 0; c < T; c += 4) {
      const h = heights[c];
      if (h > 6) ctx.fillRect(c + 1, T - h + 6, 2, 2);
      if (h > 11) ctx.fillRect(c + 2, T - h + 11, 2, 2);
    }
    // Sediment strata keyed to WORLD y, so bands run level across tile seams
    // and a tall cliff face reads as layered earth instead of one flat fill.
    const spacing = pal.strataSpacing ?? 0;
    if (spacing > 0) {
      for (let sy = 0; sy < T; sy++) {
        const band = (ty * T + sy) % spacing;
        const dark = band === 0;
        const light = band === Math.floor(spacing / 2) && pal.strataLight;
        if (!dark && !light) continue;
        ctx.fillStyle = dark ? (pal.strataDark ?? pal.bodyDark) : pal.strataLight!;
        for (let c = 0; c < T; c++) {
          const top = T - heights[c];
          // Stay clear of the cap so strata never cut through the turf.
          if (sy > top + (pal.capDepth ?? 6) + 2) ctx.fillRect(c, sy, 1, dark ? 2 : 1);
        }
      }
    }
  }

  if (id === 8) {
    // One-way platform: capped slab (grass ledge / hazard-striped girder).
    if (pal.platGlow) {
      ctx.fillStyle = pal.platGlow;
      ctx.fillRect(0, -2, T, 2);
    }
    ctx.fillStyle = pal.platBody;
    ctx.fillRect(0, 8, T, 8);
    ctx.fillStyle = pal.platTop;
    ctx.fillRect(0, 0, T, 8);
    ctx.fillStyle = pal.platTopDark;
    ctx.fillRect(0, 6, T, 2);
  } else if (exposed) {
    // Surface cap following the terrain profile.
    const depth = pal.capDepth ?? 6;
    ctx.fillStyle = pal.cap;
    for (let c = 0; c < T; c++) {
      const top = T - heights[c];
      ctx.fillRect(c, top, 1, Math.min(depth, heights[c]));
    }
    ctx.fillStyle = pal.capDark;
    for (let c = 0; c < T; c += 3) {
      const top = T - heights[c];
      ctx.fillRect(c, top + depth - 2, 1, 2);
    }
    // Lit edge: the one line of the terrain the light actually catches.
    if (pal.capGlow) {
      ctx.fillStyle = pal.capGlow;
      for (let c = 0; c < T; c++) ctx.fillRect(c, T - heights[c] - 2, 1, 2);
    }
    if (pal.capHighlight) {
      ctx.fillStyle = pal.capHighlight;
      const hd = pal.capHighlightDepth ?? 1.6;
      for (let c = 0; c < T; c++) ctx.fillRect(c, T - heights[c], 1, hd);
    }
  }
  ctx.restore();
}

/** Pre-renders a loop's annulus art (decor, always visible). */
export function renderLoopArt(loop: LoopZone, theme: LevelTheme = 'verdant'): HTMLCanvasElement {
  const pal = TERRAIN_THEMES[theme];
  const r = loop.outerR + 8;
  const cv = document.createElement('canvas');
  cv.width = cv.height = r * 2;
  const ctx = cv.getContext('2d')!;
  ctx.translate(r, r);
  // Annulus body.
  ctx.beginPath();
  ctx.arc(0, 0, loop.outerR, 0, Math.PI * 2);
  ctx.arc(0, 0, loop.innerR, 0, Math.PI * 2, true);
  ctx.fillStyle = pal.body;
  ctx.fill('evenodd');
  // Checker accents.
  ctx.save();
  ctx.clip('evenodd');
  ctx.fillStyle = pal.bodyDark;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    ctx.save();
    ctx.rotate(a);
    ctx.fillRect(loop.innerR + 2, -2, 6, 4);
    ctx.restore();
  }
  ctx.restore();
  // Cap on the outer top half.
  ctx.beginPath();
  ctx.arc(0, 0, loop.outerR, Math.PI, Math.PI * 2);
  ctx.arc(0, 0, loop.outerR - 6, Math.PI * 2, Math.PI, true);
  ctx.closePath();
  ctx.fillStyle = pal.cap;
  ctx.fill();
  // Themes with a lit running edge carry it around the loop too, so the ring
  // reads as part of the same track and not a hole punched in the level.
  if (pal.capHighlight) {
    if (pal.capGlow) {
      ctx.strokeStyle = pal.capGlow;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, loop.outerR + 1, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = pal.capHighlight;
    ctx.lineWidth = pal.capHighlightDepth ?? 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, loop.outerR, 0, Math.PI * 2);
    ctx.stroke();
  }
  return cv;
}

/* -------------------------------- Background ------------------------------- */

export function renderBackground(w: number, h: number, theme: LevelTheme = 'verdant'): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  if (theme === 'gear') {
    renderGearBackground(ctx, w, h);
    return cv;
  }
  if (theme === 'crystal') {
    renderCrystalBackground(ctx, w, h);
    return cv;
  }
  if (theme === 'neon') {
    renderNeonBackground(ctx, w, h);
    return cv;
  }
  renderDuskBackground(ctx, w, h);
  return cv;
}

/**
 * Duskmere Coast: the hour is jammed at golden dusk. A low sun sits ON the
 * horizon over a sea that is stopped mid-shimmer — the glitter path is baked
 * static, in unnaturally neat rows, because water that never moves is the
 * whole story beat. Everything else is layered silhouettes: headlands on the
 * horizon, then dunes, then a dark near bank for the terrain to sit against.
 */
function renderDuskBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const horizon = h * 0.52;
  const sunX = w * 0.5;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // Sky: violet dusk overhead falling to hot amber where the sun is stuck.
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#241a44');
  sky.addColorStop(0.42, '#5c2e58');
  sky.addColorStop(0.78, '#b3503f');
  sky.addColorStop(1, '#f0913f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);

  // The first stars are out in the top of the sky — dusk, not day.
  for (let i = 0; i < 40; i++) {
    const s = rnd();
    ctx.globalAlpha = 0.12 + rnd() * 0.35;
    ctx.fillStyle = '#fff';
    ctx.fillRect(rnd() * w, rnd() * h * 0.24, s > 0.92 ? 2 : 1, s > 0.92 ? 2 : 1);
  }
  ctx.globalAlpha = 1;

  // Flat underlit cloud bars — dusk cirrus catching the sun from below.
  for (let i = 0; i < 7; i++) {
    const cy = horizon * (0.32 + rnd() * 0.55);
    const cw = 50 + rnd() * 130;
    const cx = rnd() * w;
    const warm = cy / horizon; // lower bars sit closer to the sun's light
    ctx.fillStyle = `rgba(255,${150 + Math.round(60 * warm)},${90 + Math.round(40 * warm)},${0.10 + warm * 0.16})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw, 3 + warm * 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Molten light along the WHOLE horizon. This band is translation-invariant,
  // so the scene's double parallax pass can overlay it at any offset without
  // manufacturing a second sunset — only the modest disc below is localised.
  const molten = ctx.createLinearGradient(0, horizon - 26, 0, horizon);
  molten.addColorStop(0, 'rgba(255,170,80,0)');
  molten.addColorStop(1, 'rgba(255,190,95,0.38)');
  ctx.fillStyle = molten;
  ctx.fillRect(0, horizon - 26, w, 26);

  // Sun pillar: the vertical shaft of light a low sun throws in cold air.
  const pillar = ctx.createLinearGradient(sunX - 26, 0, sunX + 26, 0);
  pillar.addColorStop(0, 'rgba(255,180,90,0)');
  pillar.addColorStop(0.5, 'rgba(255,190,100,0.14)');
  pillar.addColorStop(1, 'rgba(255,180,90,0)');
  ctx.fillStyle = pillar;
  ctx.fillRect(sunX - 26, h * 0.1, 52, horizon - h * 0.1);

  // The sun itself, half-swallowed by the horizon line. Kept soft: the second
  // parallax pass duplicates it faintly, and a soft disc's ghost reads as a
  // lit cloud instead of a spare sun.
  const glow = ctx.createRadialGradient(sunX, horizon - 4, 4, sunX, horizon - 4, 78);
  glow.addColorStop(0, 'rgba(255,214,130,0.6)');
  glow.addColorStop(0.35, 'rgba(255,170,80,0.24)');
  glow.addColorStop(1, 'rgba(255,150,70,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 84, horizon - 84, 168, 88);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, horizon);
  ctx.clip(); // the disc ends AT the waterline — the sea owns its reflection
  ctx.fillStyle = '#ffe9b0';
  ctx.beginPath();
  ctx.arc(sunX, horizon + 4, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,240,0.85)';
  ctx.beginPath();
  ctx.arc(sunX, horizon + 2, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Headlands resting on the horizon at the frame edges.
  ctx.fillStyle = '#2c1a3e';
  ctx.beginPath();
  ctx.moveTo(-4, horizon);
  ctx.lineTo(w * 0.1, horizon - 14);
  ctx.lineTo(w * 0.2, horizon - 4);
  ctx.lineTo(w * 0.26, horizon);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.72, horizon);
  ctx.lineTo(w * 0.8, horizon - 9);
  ctx.lineTo(w * 0.9, horizon - 18);
  ctx.lineTo(w + 4, horizon - 6);
  ctx.lineTo(w + 4, horizon);
  ctx.closePath();
  ctx.fill();
  // A lighthouse on the far right headland, its lamp lit for the stuck dusk.
  ctx.fillStyle = '#1d1230';
  ctx.fillRect(w * 0.9 - 3, horizon - 34, 6, 17);
  ctx.fillStyle = '#ffd94a';
  ctx.fillRect(w * 0.9 - 2, horizon - 37, 4, 3);
  const beam = ctx.createRadialGradient(w * 0.9, horizon - 36, 1, w * 0.9, horizon - 36, 16);
  beam.addColorStop(0, 'rgba(255,217,74,0.5)');
  beam.addColorStop(1, 'rgba(255,217,74,0)');
  ctx.fillStyle = beam;
  ctx.fillRect(w * 0.9 - 16, horizon - 52, 32, 32);

  // The frozen sea: warm reflection fading into deep water.
  const seaBottom = h * 0.86;
  const sea = ctx.createLinearGradient(0, horizon, 0, seaBottom);
  sea.addColorStop(0, '#8a4046');
  sea.addColorStop(0.3, '#5c2c4e');
  sea.addColorStop(1, '#1e1638');
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizon, w, seaBottom - horizon);

  // Static glitter. Real water scatters its sparkle; this sea's is ruled into
  // even rows — light stopped mid-dance. Density falls off away from the sun
  // path so it still reads as a reflection, not a texture.
  for (let row = 0; row < 22; row++) {
    const gy = horizon + 3 + row * ((seaBottom - horizon - 6) / 22);
    const depth = row / 22;
    const pathHalf = 26 + depth * 90; // glitter path widens toward the viewer
    const n = 3 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) {
      const gx = sunX + (rnd() * 2 - 1) * pathHalf;
      const len = 3 + rnd() * (6 + depth * 10);
      ctx.fillStyle = `rgba(255,${205 - depth * 60},${120 - depth * 40},${0.55 - depth * 0.3})`;
      ctx.fillRect(gx - len / 2, gy, len, 1.4);
    }
    // Sparse cold glints out on the open water.
    if (row % 2 === 0) {
      const gx = rnd() * w;
      ctx.fillStyle = `rgba(200,170,220,${0.18 - depth * 0.1})`;
      ctx.fillRect(gx, gy, 2 + rnd() * 5, 1);
    }
  }

  // Coast silhouettes: dune ridges walking toward the viewer, then a near
  // bank that grounds the playfield. Frequencies are whole cycles per tile
  // width so the background loops without a seam.
  duneRidge(ctx, w, h, h * 0.80, 16, '#3a2244', 2, 5, 1.3);
  duneRidge(ctx, w, h, h * 0.88, 20, '#251534', 3, 7, 4.1);
  duneRidge(ctx, w, h, h * 0.97, 14, '#140c22', 2, 9, 2.2);
  // Seagrass ticks along the middle dune crest.
  ctx.strokeStyle = 'rgba(80,50,90,0.9)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const gx = rnd() * w;
    const gy = duneY(gx, w, h * 0.88, 20, 3, 7, 4.1);
    const gh = 3 + rnd() * 5;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + (rnd() * 2 - 1) * 2, gy - gh);
    ctx.stroke();
  }
}

/** y of a dune crest at x — sin harmonics with whole cycles per width. */
function duneY(x: number, w: number, base: number, amp: number, k1: number, k2: number, phase: number): number {
  const t = (x / w) * Math.PI * 2;
  return base - (Math.sin(t * k1 + phase) * 0.65 + Math.sin(t * k2 + phase * 2.7) * 0.35 + 1) * 0.5 * amp;
}

/** A dune silhouette filled to the bottom of the frame. Tiles seamlessly. */
function duneRidge(ctx: CanvasRenderingContext2D, w: number, h: number, base: number, amp: number, color: string, k1: number, k2: number, phase: number): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 6) ctx.lineTo(x, duneY(x, w, base, amp, k1, k2, phase));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

/**
 * Noon Tomorrow: a neon metropolis one second before a noon that never comes.
 * The sky is bleached and hazy with a hard little zenith sun; under it the
 * city is all silhouette — window grids, sky-rail ribbons carrying frozen
 * light-streak traffic, and a giant countdown billboard stopped at 00:00:01.
 */
function renderNeonBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  let seed = 20260803;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // Bleached zenith pressed down into dusty rose, then city smog. The bright
  // band is kept thin: the picture belongs to the silhouettes under it.
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.82);
  sky.addColorStop(0, '#ead9b4');
  sky.addColorStop(0.2, '#d9a290');
  sky.addColorStop(0.5, '#8f5a88');
  sky.addColorStop(0.78, '#45305f');
  sky.addColorStop(1, '#241636');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // A small, harsh sun almost at zenith — one second from the top of the sky.
  const sunX = w * 0.52;
  const sunY = h * 0.08;
  const glow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 44);
  glow.addColorStop(0, 'rgba(255,252,235,0.9)');
  glow.addColorStop(0.3, 'rgba(255,240,200,0.28)');
  glow.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 46, sunY - 46, 92, 92);
  ctx.fillStyle = '#fffdf2';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 6, 0, Math.PI * 2);
  ctx.fill();
  // Heat haze bands pressing down on the city.
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = `rgba(255,245,225,${0.04 + rnd() * 0.04})`;
    ctx.fillRect(0, h * (0.14 + i * 0.06) + rnd() * 8, w, 2 + rnd() * 3);
  }

  // Far skyline: haze towers rising well into the sky band.
  ctx.fillStyle = '#7a5588';
  for (let x = -10; x < w; ) {
    const bw = 24 + rnd() * 42;
    const bh = 70 + rnd() * 110;
    ctx.fillRect(x, h * 0.66 - bh, bw, bh + h * 0.36);
    x += bw + 3;
  }

  // Sky-rail ribbons threading BETWEEN the tower depths, carrying baked
  // traffic streaks stopped dead on the line. Whole sine cycles per width so
  // the tile edge never shows a kink.
  const rail = (base: number, amp: number, k: number, phase: number, tint: string) => {
    ctx.strokeStyle = 'rgba(225,215,240,0.4)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const y = base + Math.sin(((x / w) * Math.PI * 2) * k + phase) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const tx = rnd() * w;
      const ty = base + Math.sin(((tx / w) * Math.PI * 2) * k + phase) * amp;
      const dir = rnd() > 0.5 ? 1 : -1;
      const len = 10 + rnd() * 18;
      const g = ctx.createLinearGradient(tx - dir * len, ty, tx, ty);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, tint);
      ctx.fillStyle = g;
      ctx.fillRect(Math.min(tx, tx - dir * len), ty - 1.4, len, 2.2);
      ctx.fillStyle = '#fff';
      ctx.fillRect(tx - 1, ty - 1.4, 2, 2.2);
    }
  };
  rail(h * 0.5, 10, 1, 0.8, 'rgba(65,240,255,0.85)');

  // Mid skyline: darker towers with sparse lit windows.
  ctx.fillStyle = '#3c2a54';
  const midTops: { x: number; bw: number; top: number }[] = [];
  for (let x = -8; x < w; ) {
    const bw = 30 + rnd() * 50;
    const top = h * (0.42 + rnd() * 0.2);
    ctx.fillRect(x, top, bw, h - top);
    midTops.push({ x, bw, top });
    x += bw + 5;
  }
  for (const b of midTops) {
    for (let i = 0; i < 8; i++) {
      if (rnd() > 0.55) continue;
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(65,240,255,0.7)' : 'rgba(255,220,150,0.7)';
      ctx.fillRect(b.x + 3 + rnd() * (b.bw - 7), b.top + 4 + rnd() * (h - b.top - 30), 2, 2);
    }
  }
  // The second ribbon runs in front of the mid skyline, behind the near one.
  rail(h * 0.62, 12, 2, 3.6, 'rgba(255,79,168,0.85)');

  // Near skyline: black towers wearing the neon — edge strips, window grids,
  // antennae. This is the band the countdown billboard lives in.
  interface Tower { x: number; bw: number; top: number }
  const towers: Tower[] = [];
  for (let x = -6; x < w; ) {
    const bw = 42 + rnd() * 58;
    const top = h * (0.5 + rnd() * 0.26);
    towers.push({ x, bw, top });
    x += bw + 8 + rnd() * 20;
  }
  for (const t of towers) {
    ctx.fillStyle = '#170f28';
    ctx.fillRect(t.x, t.top, t.bw, h - t.top);
    // Neon edge strip down one side.
    const edge = rnd() > 0.5 ? t.x + 1 : t.x + t.bw - 2.4;
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,79,168,0.8)' : 'rgba(65,240,255,0.8)';
    ctx.fillRect(edge, t.top + 2, 1.6, (h - t.top) * (0.4 + rnd() * 0.4));
    // Window grid, mostly dark — offices at (almost) noon.
    for (let wy = t.top + 6; wy < h - 8; wy += 9) {
      for (let wx = t.x + 5; wx < t.x + t.bw - 5; wx += 8) {
        const lit = rnd();
        ctx.fillStyle = lit > 0.86 ? 'rgba(255,235,170,0.8)' : lit > 0.78 ? 'rgba(120,230,255,0.5)' : 'rgba(255,255,255,0.06)';
        ctx.fillRect(wx, wy, 3, 4);
      }
    }
    // Rooftop antenna with a beacon.
    if (rnd() > 0.45) {
      const ax = t.x + 6 + rnd() * (t.bw - 12);
      ctx.fillStyle = '#0d0818';
      ctx.fillRect(ax - 1, t.top - 14, 2, 14);
      ctx.fillStyle = 'rgba(255,80,110,0.9)';
      ctx.fillRect(ax - 1.5, t.top - 17, 3, 3);
    }
  }

  // The countdown billboard: mounted high on the tallest near tower, frozen
  // one second before tomorrow starts. It is the biome's thesis statement, so
  // it gets a glow no other sign has.
  const host = towers.reduce((a, b) => (b.top < a.top ? b : a), towers[0]);
  const bx = Math.min(Math.max(host.x + host.bw / 2, 90), w - 90);
  // High in the frame no matter which tower won: the countdown must clear the
  // playfield's terrain, which owns the bottom half of the screen.
  const by = Math.min(host.top + 26, h * 0.34);
  const bw2 = 108;
  const bh2 = 40;
  const bloom = ctx.createRadialGradient(bx, by, 4, bx, by, 90);
  bloom.addColorStop(0, 'rgba(255,79,168,0.28)');
  bloom.addColorStop(1, 'rgba(255,79,168,0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(bx - 90, by - 70, 180, 140);
  ctx.fillStyle = '#0b0716';
  ctx.beginPath();
  ctx.roundRect(bx - bw2 / 2, by - bh2 / 2, bw2, bh2, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,79,168,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#8a8098';
  ctx.fillRect(bx - 8, by + bh2 / 2, 4, 10); // mounting struts
  ctx.fillRect(bx + 4, by + bh2 / 2, 4, 10);
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(160,235,255,0.85)';
  ctx.fillText('TOMORROW IN', bx, by - 8);
  ctx.font = 'bold 19px monospace';
  ctx.fillStyle = '#41f0ff';
  ctx.fillText('00:00:01', bx, by + 11);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('00:00:01', bx, by + 11); // hot double-strike core
  ctx.textAlign = 'left';
  // Scanlines over the panel.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  for (let sy = by - bh2 / 2 + 2; sy < by + bh2 / 2; sy += 4) ctx.fillRect(bx - bw2 / 2 + 2, sy, bw2 - 4, 1);

  // Street-level light haze pooling at the bottom of the frame.
  const street = ctx.createLinearGradient(0, h - 46, 0, h);
  street.addColorStop(0, 'rgba(10,6,24,0)');
  street.addColorStop(1, 'rgba(10,6,24,0.9)');
  ctx.fillStyle = street;
  ctx.fillRect(0, h - 46, w, 46);
  for (let i = 0; i < 12; i++) {
    const lx = rnd() * w;
    const ly = h - 6 - rnd() * 30;
    const len = 16 + rnd() * 40;
    const dir = rnd() > 0.5 ? 1 : -1;
    const tint = rnd() > 0.5 ? '65,240,255' : '255,79,168';
    const g = ctx.createLinearGradient(lx - dir * len, ly, lx, ly);
    g.addColorStop(0, `rgba(${tint},0)`);
    g.addColorStop(1, `rgba(${tint},0.5)`);
    ctx.fillStyle = g;
    ctx.fillRect(Math.min(lx, lx - dir * len), ly, len, 1.6);
  }
}

/** Cog Skyway: smog-lit sky, factory skyline, giant gear silhouettes. */
function renderGearBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0d0d16');
  sky.addColorStop(0.65, '#1c1a2e');
  sky.addColorStop(1, '#3a2620');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  let seed = 12;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // Smog-dimmed stars.
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.1 + rnd() * 0.35;
    ctx.fillRect(rnd() * w, rnd() * h * 0.4, 1, 1);
  }
  ctx.globalAlpha = 1;

  // Furnace glow on the horizon.
  const glow = ctx.createRadialGradient(w * 0.3, h * 0.95, 10, w * 0.3, h * 0.95, w * 0.5);
  glow.addColorStop(0, 'rgba(255,120,40,0.30)');
  glow.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Giant background gears.
  const gear = (cx: number, cy: number, r: number, teeth: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillRect(r - 2, -r * 0.09, r * 0.22, r * 0.18);
      ctx.restore();
    }
    ctx.fillStyle = '#0d0d16';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  };
  gear(w * 0.82, h * 0.34, 52, 12, '#232134');
  gear(w * 0.16, h * 0.22, 34, 10, '#1e1c2c');
  gear(w * 0.55, h * 0.5, 26, 8, '#262238');

  // Factory skyline: blocks, smokestacks, lit windows.
  ctx.fillStyle = '#15131f';
  for (let x = 0; x < w; ) {
    const bw = 30 + rnd() * 60;
    const bh = 40 + rnd() * 90;
    ctx.fillRect(x, h - bh, bw, bh);
    if (rnd() > 0.5) ctx.fillRect(x + bw * 0.3, h - bh - 26, 8, 26); // smokestack
    x += bw + 4;
  }
  seed = 99;
  ctx.fillStyle = 'rgba(255,190,80,0.8)';
  for (let i = 0; i < 70; i++) {
    ctx.globalAlpha = 0.25 + rnd() * 0.6;
    ctx.fillRect(rnd() * w, h - rnd() * 100, 2, 2);
  }
  ctx.globalAlpha = 1;

  // Near catwalk silhouette.
  ctx.fillStyle = '#100e18';
  ctx.fillRect(0, h - 22, w, 22);
  for (let x = 8; x < w; x += 26) ctx.fillRect(x, h - 34, 4, 12);
}

/**
 * The Chrono Vault: an underground crystal cavern. There is no sky here, so
 * the depth cues are inverted — the frame is darkest at the ceiling and the
 * light wells UP out of the crystal field. Stalactites bite into the top edge
 * so the eye never reads the upper band as open air.
 */
function renderCrystalBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const rock = ctx.createLinearGradient(0, 0, 0, h);
  rock.addColorStop(0, '#080513');
  rock.addColorStop(0.34, '#130a28');
  rock.addColorStop(0.72, '#20123d');
  rock.addColorStop(1, '#0c0619');
  ctx.fillStyle = rock;
  ctx.fillRect(0, 0, w, h);

  let seed = 4242;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // Cold glow rising off the buried crystal seam, with a magenta counter-light
  // so the cavern is not a single flat hue.
  const seam = ctx.createRadialGradient(w * 0.46, h * 0.82, 8, w * 0.46, h * 0.82, w * 0.62);
  seam.addColorStop(0, 'rgba(80,215,245,0.20)');
  seam.addColorStop(0.45, 'rgba(90,120,230,0.09)');
  seam.addColorStop(1, 'rgba(75,225,255,0)');
  ctx.fillStyle = seam;
  ctx.fillRect(0, 0, w, h);
  const counter = ctx.createRadialGradient(w * 0.08, h * 0.66, 6, w * 0.08, h * 0.66, w * 0.4);
  counter.addColorStop(0, 'rgba(224,90,216,0.16)');
  counter.addColorStop(1, 'rgba(224,90,216,0)');
  ctx.fillStyle = counter;
  ctx.fillRect(0, 0, w, h);

  // Rock strata, far to near. Each band is a wavy silhouette filled to the
  // bottom, so the cavern floor recedes in readable steps.
  ridge(ctx, w, h, h * 0.60, 26, '#1d1338', 5);
  bgCrystalField(ctx, w, h * 0.63, 0.62, '#2a2a63', 'rgba(90,150,240,0.22)', rnd, 7);
  ridge(ctx, w, h, h * 0.76, 30, '#160e2b', 11);
  bgCrystalField(ctx, w, h * 0.80, 1.0, '#33306e', 'rgba(80,215,245,0.28)', rnd, 5);
  ridge(ctx, w, h, h * 0.93, 20, '#0d0819', 3);

  // Ceiling: stalactites of assorted depth, a few of them crystal-tipped.
  ctx.fillStyle = '#07040f';
  for (let x = -10; x < w + 10; ) {
    const bw = 8 + rnd() * 22;
    const d = 12 + rnd() * 56;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + bw, 0);
    ctx.lineTo(x + bw * 0.45, d);
    ctx.closePath();
    ctx.fill();
    if (rnd() > 0.78) {
      const tip = ctx.createRadialGradient(x + bw * 0.45, d, 1, x + bw * 0.45, d, 14);
      tip.addColorStop(0, 'rgba(120,235,255,0.45)');
      tip.addColorStop(1, 'rgba(120,235,255,0)');
      ctx.fillStyle = tip;
      ctx.fillRect(x + bw * 0.45 - 16, d - 16, 32, 32);
      ctx.fillStyle = '#07040f';
    }
    x += bw + 2 + rnd() * 14;
  }

  // Stalagmites biting up from the near band, plus suspended crystal glints.
  ctx.fillStyle = '#0a0616';
  for (let x = 0; x < w; x += 18 + rnd() * 40) {
    const hh = 10 + rnd() * 34;
    ctx.beginPath();
    ctx.moveTo(x - 7, h);
    ctx.lineTo(x, h - hh);
    ctx.lineTo(x + 7, h);
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 0; i < 60; i++) {
    const gx = rnd() * w;
    const gy = h * 0.12 + rnd() * h * 0.7;
    ctx.fillStyle = rnd() > 0.7 ? 'rgba(224,90,216,0.55)' : 'rgba(140,240,255,0.6)';
    ctx.globalAlpha = 0.18 + rnd() * 0.5;
    ctx.fillRect(gx, gy, 1, 1);
  }
  ctx.globalAlpha = 1;
}

/** A receding cluster of cavern crystal: prisms with a glow bloom behind them. */
function bgCrystalField(
  ctx: CanvasRenderingContext2D,
  w: number,
  baseY: number,
  scale: number,
  body: string,
  glow: string,
  rnd: () => number,
  count: number,
): void {
  for (let i = 0; i < count; i++) {
    const cx = (i + 0.35 + rnd() * 0.3) * (w / count);
    const bloom = ctx.createRadialGradient(cx, baseY - 26 * scale, 4, cx, baseY - 26 * scale, 78 * scale);
    bloom.addColorStop(0, glow);
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(cx - 90 * scale, baseY - 110 * scale, 180 * scale, 150 * scale);
    for (let p = 0; p < 3; p++) {
      const off = (p - 1) * (14 + rnd() * 10) * scale;
      const ph = (34 + rnd() * 62) * scale;
      const pw = (7 + rnd() * 9) * scale;
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(cx + off - pw, baseY);
      ctx.lineTo(cx + off - pw * 0.8, baseY - ph * 0.62);
      ctx.lineTo(cx + off, baseY - ph);
      ctx.lineTo(cx + off + pw * 0.8, baseY - ph * 0.62);
      ctx.lineTo(cx + off + pw, baseY);
      ctx.closePath();
      ctx.fill();
      // Lit facet down one edge — a flat prism silhouette reads as a rock.
      ctx.fillStyle = 'rgba(150,240,255,0.13)';
      ctx.beginPath();
      ctx.moveTo(cx + off, baseY - ph);
      ctx.lineTo(cx + off + pw * 0.8, baseY - ph * 0.62);
      ctx.lineTo(cx + off + pw * 0.45, baseY);
      ctx.lineTo(cx + off, baseY);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function ridge(ctx: CanvasRenderingContext2D, w: number, h: number, base: number, amp: number, color: string, seed: number): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 8) {
    const y = base - Math.abs(Math.sin(x / 97 + seed * 13.7)) * amp - Math.sin(x / 31 + seed) * 6;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

/* --------------------------------- Entities -------------------------------- */

export function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
  const sq = Math.abs(Math.cos(frame / 12));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(Math.max(0.15, sq), 1);
  ctx.strokeStyle = PAL.ringDark;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = PAL.ring;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawCrystal(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
  const bob = Math.sin(frame / 30) * 2;
  ctx.save();
  ctx.translate(x, y + bob);
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
  glow.addColorStop(0, 'rgba(75,225,255,0.55)');
  glow.addColorStop(1, 'rgba(75,225,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-16, -16, 32, 32);
  ctx.fillStyle = PAL.crystal;
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(6, 0);
  ctx.lineTo(0, 10);
  ctx.lineTo(-6, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(3, -2);
  ctx.lineTo(0, 2);
  ctx.lineTo(-3, -2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawSpring(ctx: CanvasRenderingContext2D, x: number, y: number, cooldown: number): void {
  const squash = cooldown > 8 ? 4 : 0;
  ctx.save();
  ctx.translate(x, y + squash);
  ctx.fillStyle = PAL.springBase;
  ctx.fillRect(-8, 2 - squash, 16, 6);
  ctx.fillStyle = PAL.spring;
  ctx.fillRect(-8, -4 - squash, 16, 6);
  ctx.fillStyle = '#fff3b0';
  ctx.fillRect(-6, -3 - squash, 12, 2);
  ctx.restore();
}

export function drawMonitor(ctx: CanvasRenderingContext2D, x: number, y: number, kind: string, broken: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = broken ? '#3a3f4a' : '#23262e';
  ctx.strokeStyle = '#565d6e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-11, -11, 22, 22, 4);
  ctx.fill();
  ctx.stroke();
  if (!broken) {
    ctx.fillStyle = kind === 'rings10' ? PAL.ring : kind === 'shield' ? '#5aa9ff' : '#7CFC00';
    if (kind === 'rings10') {
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = PAL.ring;
      ctx.stroke();
    } else if (kind === 'shield') {
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(5, -2);
      ctx.lineTo(0, 7);
      ctx.lineTo(-5, -2);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(-5, -3, 10, 6);
      ctx.fillRect(-3, 3, 6, 3);
    }
  }
  ctx.restore();
}

export function drawSpikes(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = PAL.spike;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 5 - 2.5, 6);
    ctx.lineTo(i * 5 + 2.5, 6);
    ctx.lineTo(i * 5, -5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function drawCheckpoint(ctx: CanvasRenderingContext2D, x: number, y: number, active: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#aab3c5';
  ctx.fillRect(-2, -28, 4, 28);
  ctx.fillStyle = active ? PAL.crystal : '#5a6376';
  ctx.beginPath();
  ctx.arc(0, -32, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawSnapCrab(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir >= 0 ? 1 : -1, 1);
  ctx.fillStyle = PAL.enemy;
  ctx.beginPath();
  ctx.roundRect(-9, -6, 18, 10, 4);
  ctx.fill();
  // Claws.
  ctx.fillRect(7, -9, 6, 5);
  ctx.fillRect(-13, -9, 6, 5);
  // Eyes.
  ctx.fillStyle = '#fff';
  ctx.fillRect(-4, -10, 3, 4);
  ctx.fillRect(1, -10, 3, 4);
  ctx.fillStyle = '#111';
  ctx.fillRect(-3, -9, 2, 2);
  ctx.fillRect(2, -9, 2, 2);
  ctx.restore();
}

export function drawDashPad(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, cooldown: number, frame: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir >= 0 ? 1 : -1, 1);
  ctx.fillStyle = cooldown > 8 ? '#3d4452' : '#23262e';
  ctx.beginPath();
  ctx.roundRect(-12, -2, 24, 8, 2);
  ctx.fill();
  // Scrolling chevrons.
  for (let i = 0; i < 3; i++) {
    const lit = (Math.floor(frame / 5) + i) % 3 === 0;
    ctx.fillStyle = lit ? PAL.board : PAL.boardDark;
    ctx.beginPath();
    ctx.moveTo(-8 + i * 7, -4);
    ctx.lineTo(-3 + i * 7, 0);
    ctx.lineTo(-8 + i * 7, 4);
    ctx.lineTo(-6 + i * 7, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function drawBoardPad(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
  const bob = Math.sin(frame / 25) * 2;
  ctx.save();
  ctx.translate(x, y);
  // Pedestal.
  ctx.fillStyle = '#23262e';
  ctx.fillRect(-9, 8, 18, 6);
  ctx.fillStyle = '#3d4452';
  ctx.fillRect(-7, 6, 14, 2);
  // Hover glow.
  const glow = ctx.createRadialGradient(0, bob - 2, 2, 0, bob - 2, 18);
  glow.addColorStop(0, 'rgba(56,224,200,0.5)');
  glow.addColorStop(1, 'rgba(56,224,200,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-18, bob - 20, 36, 36);
  // The board itself, hovering.
  ctx.fillStyle = PAL.board;
  ctx.beginPath();
  ctx.roundRect(-11, bob - 4, 22, 5, 3);
  ctx.fill();
  ctx.fillStyle = PAL.boardDark;
  ctx.fillRect(-8, bob + 1, 16, 2);
  ctx.restore();
}

/**
 * A grind rail: a metal bar on short struts with an energy pulse running along
 * it. The shimmer is the whole read — a bare pipe is scenery, a lit one is a
 * line you are invited to take at speed — so it runs even when the rail is
 * empty, and it travels in both directions because the rail rides both ways.
 */
export function drawRail(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  frame: number,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const nx = dx / len;
  const ny = dy / len;

  ctx.save();
  // Struts are drawn in world space so they hang straight down whatever the
  // rail's pitch — struts rotated with a steep rail read as a broken ladder.
  for (let d = 10; d < len; d += 46) {
    const px = x0 + nx * d;
    const py = y0 + ny * d;
    ctx.fillStyle = '#2a2340';
    ctx.fillRect(px - 1.5, py + 2, 3, 13);
    ctx.fillStyle = '#3d3358';
    ctx.fillRect(px - 5, py + 14, 10, 3);
  }

  ctx.translate(x0, y0);
  ctx.rotate(Math.atan2(dy, dx));
  // Bar: dark underside, steel body, hot top edge.
  ctx.fillStyle = '#1b1530';
  ctx.fillRect(0, 1, len, 4);
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(0, -3, len, 4);
  ctx.fillStyle = '#aab3c5';
  ctx.fillRect(0, -3, len, 1.4);
  ctx.fillStyle = 'rgba(75,225,255,0.35)';
  ctx.fillRect(0, -4.6, len, 1.2);
  // End anchors.
  ctx.fillStyle = '#3d3358';
  ctx.fillRect(-3, -5, 5, 10);
  ctx.fillRect(len - 2, -5, 5, 10);

  // Travelling energy pulses, clipped to the bar.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, -6, len, 9);
  ctx.clip();
  const span = len + 60;
  for (let i = 0; i < 3; i++) {
    const p = ((frame / 90 + i / 3) % 1) * span - 30;
    const g = ctx.createLinearGradient(p - 22, 0, p + 22, 0);
    g.addColorStop(0, 'rgba(75,225,255,0)');
    g.addColorStop(0.5, 'rgba(190,250,255,0.75)');
    g.addColorStop(1, 'rgba(75,225,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(p - 22, -5, 44, 3.4);
  }
  ctx.restore();
  ctx.restore();
}

export function drawBuzzDrone(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, frame: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir >= 0 ? 1 : -1, 1);
  // Rotor (spinning blur).
  ctx.strokeStyle = 'rgba(200,210,225,0.8)';
  ctx.lineWidth = 2;
  const spin = Math.sin(frame / 1.5) * 7;
  ctx.beginPath();
  ctx.moveTo(-spin, -9);
  ctx.lineTo(spin, -9);
  ctx.stroke();
  ctx.fillStyle = '#565d6e';
  ctx.fillRect(-1, -9, 2, 3);
  // Body.
  ctx.fillStyle = PAL.enemy;
  ctx.beginPath();
  ctx.roundRect(-8, -6, 16, 11, 5);
  ctx.fill();
  ctx.fillStyle = PAL.podDark;
  ctx.fillRect(-8, 0, 16, 3);
  // Eye.
  ctx.fillStyle = '#fff';
  ctx.fillRect(2, -4, 4, 4);
  ctx.fillStyle = '#111';
  ctx.fillRect(4, -3, 2, 2);
  ctx.restore();
}

export function drawSpikeTrap(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  extension: number,
  warning: boolean,
  frame: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  // Base plate always visible, so the hazard is readable even when retracted.
  ctx.fillStyle = warning ? '#7c4a52' : '#3d4452';
  ctx.fillRect(-8, -3, 16, 5);
  ctx.fillStyle = '#23262e';
  for (let i = -1; i <= 1; i++) ctx.fillRect(i * 5 - 1, -3, 2, 5);
  if (warning) {
    // Rattle + amber tell: this is your cue to move.
    const j = Math.sin(frame * 1.9) * 1.4;
    ctx.fillStyle = `rgba(255,190,60,${0.5 + 0.4 * Math.sin(frame / 2)})`;
    ctx.fillRect(-8 + j, -5, 16, 2);
  }
  if (extension > 0) {
    const h = 14 * extension;
    ctx.fillStyle = PAL.spike;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 5 - 2.5, -2);
      ctx.lineTo(i * 5 + 2.5, -2);
      ctx.lineTo(i * 5, -2 - h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = -1; i <= 1; i++) ctx.fillRect(i * 5 - 0.6, -2 - h * 0.75, 1.2, h * 0.5);
  }
  ctx.restore();
}

export function drawCrumble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  state: string,
  shake: number,
  fallY: number,
  theme: LevelTheme,
): void {
  if (state === 'gone') return;
  const pal = TERRAIN_THEMES[theme];
  ctx.save();
  ctx.translate(x + shake, y + fallY);
  ctx.globalAlpha = state === 'falling' ? Math.max(0, 1 - fallY / 90) : 1;
  ctx.fillStyle = pal.platBody;
  ctx.fillRect(0, 4, w, 5);
  ctx.fillStyle = pal.platTop;
  ctx.fillRect(0, 0, w, 5);
  // Fracture lines make it obvious this ledge is not permanent.
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    const fx = (w / 3) * i;
    ctx.beginPath();
    ctx.moveTo(fx, 0);
    ctx.lineTo(fx + (i % 2 ? 2 : -2), 9);
    ctx.stroke();
  }
  if (state === 'shaking') {
    ctx.fillStyle = 'rgba(255,190,60,0.35)';
    ctx.fillRect(0, 0, w, 2);
  }
  ctx.restore();
}

export function drawSwingBall(
  ctx: CanvasRenderingContext2D,
  pivotX: number,
  pivotY: number,
  x: number,
  y: number,
  frame: number,
): void {
  ctx.save();
  // Chain.
  ctx.strokeStyle = '#565d6e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.strokeStyle = '#3d4452';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Pivot mount.
  ctx.fillStyle = '#3d4452';
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, 5, 0, Math.PI * 2);
  ctx.fill();
  // Spiked ball.
  ctx.fillStyle = '#707a8c';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + frame / 60;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
    ctx.lineTo(x + Math.cos(a + 0.3) * 7, y + Math.sin(a + 0.3) * 7);
    ctx.lineTo(x + Math.cos(a + 0.15) * 12, y + Math.sin(a + 0.15) * 12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#3d4452';
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#565d6e';
  ctx.beginPath();
  ctx.arc(x - 2.5, y - 2.5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* --------------------------- New mechanic art ------------------------------ */

export type StalactiteState = 'hanging' | 'trembling' | 'falling' | 'shattered';

/**
 * A hanging spike under a ceiling tile: crystal in the Underwhen, steel
 * elsewhere. (x, y) is the ANCHOR — the ceiling point for hanging/trembling,
 * the moving top of the spike while falling, and the floor impact point once
 * shattered. `stateTime` is frames in the current state; it drives the
 * one-shot tells (regrow after respawn, debris fade) while `frame` drives the
 * looping shimmer, so phase changes never teleport the art.
 */
export function drawStalactite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  state: StalactiteState,
  frame: number,
  stateTime = 0,
  theme: LevelTheme = 'crystal',
): void {
  const crystal = theme === 'crystal';
  const body = crystal ? '#8b7ab8' : '#7b8496';
  const dark = crystal ? '#5b4e90' : '#4a4f5c';
  const glint = crystal ? 'rgba(140,245,255,' : 'rgba(220,230,245,';
  const len = 26;
  const halfW = 6;

  ctx.save();
  ctx.translate(x, y);

  if (state === 'shattered') {
    // Debris on the floor. Harmless, and drawn like it: flat, settling dust,
    // fading as the respawn approaches.
    const a = Math.max(0, 1 - stateTime / 60) * 0.9 + 0.1;
    ctx.globalAlpha = a;
    ctx.fillStyle = dark;
    for (let i = 0; i < 5; i++) {
      const sx = (i - 2) * 6 + ((i * 7) % 3) - 1;
      const sw = 3 + ((i * 5) % 4);
      ctx.beginPath();
      ctx.moveTo(sx - sw / 2, 0);
      ctx.lineTo(sx + sw / 2, 0);
      ctx.lineTo(sx + ((i % 2) * 2 - 1), -3 - ((i * 3) % 4));
      ctx.closePath();
      ctx.fill();
    }
    if (stateTime < 22) {
      // Impact dust for the first beat only.
      const p = stateTime / 22;
      ctx.fillStyle = `${glint}${0.3 * (1 - p)})`;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(dir * (6 + p * 14), -3 - p * 6, 2 + p * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    return;
  }

  // Regrow after respawn: scale in about the anchor so it descends from the
  // ceiling rather than popping into place.
  const grow = state === 'hanging' ? Math.min(1, 0.4 + (stateTime / 40) * 0.6) : 1;
  const jx = state === 'trembling' ? Math.sin(frame * 2.6) * 1.6 : 0;
  ctx.translate(jx, 0);
  ctx.scale(1, grow);

  if (state === 'falling') {
    // Vertical motion smear above the spike: the read is DOWN, fast.
    const smear = ctx.createLinearGradient(0, -26, 0, 2);
    smear.addColorStop(0, `${glint}0)`);
    smear.addColorStop(1, `${glint}0.4)`);
    ctx.fillStyle = smear;
    ctx.fillRect(-halfW * 0.5, -26, halfW, 28);
  } else {
    // Ceiling mount rubble.
    ctx.fillStyle = dark;
    ctx.fillRect(-halfW - 2, -1, halfW * 2 + 4, 3);
  }

  // The spike itself.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-halfW, 0);
  ctx.lineTo(halfW, 0);
  ctx.lineTo(1, len);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(1, 2);
  ctx.lineTo(halfW, 0);
  ctx.lineTo(1, len);
  ctx.closePath();
  ctx.fill();
  // Lit facet, breathing on the loop clock.
  ctx.fillStyle = `${glint}${0.35 + 0.2 * Math.sin(frame / 16)})`;
  ctx.fillRect(-2.4, 3, 1.6, len * 0.55);

  if (state === 'trembling') {
    // The warning is amber — the game's established "about to hurt you" hue —
    // plus dust shaken off the mount.
    ctx.fillStyle = `rgba(255,190,60,${0.4 + 0.4 * Math.sin(frame / 2.2)})`;
    ctx.fillRect(-halfW - 2, -1, halfW * 2 + 4, 1.6);
    ctx.fillStyle = 'rgba(200,195,220,0.6)';
    for (let i = 0; i < 2; i++) {
      const p = (frame / 22 + i / 2) % 1;
      ctx.fillRect(-3 + i * 6, len * 0.3 + p * 20, 1.4, 1.4);
    }
  } else if (state === 'falling') {
    ctx.fillStyle = `${glint}${0.5 + 0.3 * Math.sin(frame / 2)})`;
    ctx.beginPath();
    ctx.arc(1, len, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * The rail minecart. (x, y) is the rail contact point under the axles;
 * `angle` is the rail's pitch in radians. Waiting carts advertise themselves
 * with a boarding glow (same invitation language as the board pad); riding
 * carts spark and rattle; crashed carts sit tipped against the buffer with
 * `stateTime` timing the impact burst.
 */
export function drawMinecart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  state: 'waiting' | 'riding' | 'crashed',
  frame: number,
  angle = 0,
  stateTime = 0,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (state === 'crashed') ctx.rotate(-0.38); // pitched up onto the buffer

  if (state === 'waiting') {
    const pulse = 0.35 + 0.2 * Math.sin(frame / 18);
    const glow = ctx.createRadialGradient(0, -10, 3, 0, -10, 24);
    glow.addColorStop(0, `rgba(56,224,200,${pulse})`);
    glow.addColorStop(1, 'rgba(56,224,200,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-26, -34, 52, 48);
  }

  // Wheels behind the tub, spinning only when the cart moves.
  for (const side of [-9, 9]) {
    ctx.save();
    ctx.translate(side, -4);
    ctx.fillStyle = '#2c2838';
    ctx.beginPath();
    ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1.2;
    const spin = state === 'riding' ? frame / 2 : 0;
    for (let i = 0; i < 2; i++) {
      const a = spin + (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 3.4, Math.sin(a) * 3.4);
      ctx.lineTo(-Math.cos(a) * 3.4, -Math.sin(a) * 3.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  // The tub: riveted steel with rust streaks and a worn top rail.
  ctx.fillStyle = '#5c5468';
  ctx.beginPath();
  ctx.moveTo(-14, -20);
  ctx.lineTo(14, -20);
  ctx.lineTo(11, -6);
  ctx.lineTo(-11, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3f3a4c';
  ctx.beginPath();
  ctx.moveTo(-14, -20);
  ctx.lineTo(-10, -20);
  ctx.lineTo(-8, -6);
  ctx.lineTo(-11, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8a5a32'; // rust
  ctx.fillRect(4, -16, 3, 7);
  ctx.fillRect(-6, -12, 2, 5);
  ctx.fillStyle = '#8a93a5';
  ctx.fillRect(-15, -22, 30, 3);
  ctx.fillStyle = '#2c2838';
  ctx.fillRect(-11, -7, 22, 2.4);

  if (state === 'riding') {
    // Rail sparks off the leading wheel.
    ctx.fillStyle = `rgba(255,190,80,${0.5 + 0.4 * Math.sin(frame * 1.7)})`;
    ctx.fillRect(11, -2, 3, 1.6);
    ctx.fillRect(14, -3.4, 2, 1.4);
  } else if (state === 'crashed') {
    // Impact burst for the first beat, then a wreck that keeps smoking until
    // the respawn sweeps it away.
    if (stateTime < 26) {
      const p = stateTime / 26;
      ctx.strokeStyle = `rgba(255,190,80,${0.8 * (1 - p)})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const a = -0.5 + i * 0.55;
        ctx.beginPath();
        ctx.moveTo(12 + Math.cos(a) * 6 * p * 3, -12 + Math.sin(a) * 6 * p * 3);
        ctx.lineTo(12 + Math.cos(a) * (10 + 8 * p), -12 + Math.sin(a) * (10 + 8 * p));
        ctx.stroke();
      }
    }
    for (let i = 0; i < 3; i++) {
      const p = (frame / 48 + i / 3) % 1;
      ctx.fillStyle = `rgba(160,150,175,${0.3 * (1 - p)})`;
      ctx.beginPath();
      ctx.arc(-2 + Math.sin(p * 5 + i) * 4, -24 - p * 22, 2.5 + p * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // A thrown plank beside the wreck.
    ctx.fillStyle = '#3f3a4c';
    ctx.save();
    ctx.rotate(0.9);
    ctx.fillRect(6, 8, 12, 3);
    ctx.restore();
  }
  ctx.restore();
}

/** The end-of-line buffer a cart wrecks against. (x, y) is ground level. */
export function drawCartBuffer(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#3f3a4c';
  ctx.fillRect(-3, -18, 6, 18);
  ctx.fillStyle = '#2c2838';
  ctx.fillRect(-8, -2, 16, 2);
  // Hazard-striped beam at cart height: the language of "this ends here".
  ctx.save();
  ctx.beginPath();
  ctx.rect(-9, -16, 18, 7);
  ctx.clip();
  for (let i = -2; i < 4; i++) {
    ctx.fillStyle = i % 2 ? '#e8c832' : '#23262e';
    ctx.beginPath();
    ctx.moveTo(i * 6, -16);
    ctx.lineTo(i * 6 + 6, -16);
    ctx.lineTo(i * 6 + 2, -9);
    ctx.lineTo(i * 6 - 4, -9);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = `rgba(232,56,79,${0.45 + 0.45 * Math.sin(frame / 8)})`;
  ctx.beginPath();
  ctx.arc(0, -21, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Quarter-pipe lip dressing over the terrain tiles. (x, baseY) is where the
 * curve leaves flat ground and `dir` the direction it launches; the chevrons
 * climb the curve so the invitation reads like a dash pad bent skyward.
 */
export function drawQuarterPipe(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  dir: 1 | -1,
  frame: number,
  theme: LevelTheme = 'verdant',
  radius = 76,
): void {
  const rim =
    theme === 'neon' ? '#ff4fa8' : theme === 'crystal' ? '#45c3e2' : theme === 'gear' ? '#e8c832' : '#c9e070';
  const pt = (a: number) => ({
    x: x + dir * radius * Math.sin(a),
    y: baseY - radius + radius * Math.cos(a),
  });
  ctx.save();
  // Rim: a soft wide band with a hot line on top, hugging the curve.
  for (const [width, alpha] of [
    [5, 0.22],
    [1.8, 0.85],
  ] as const) {
    ctx.strokeStyle = rim;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const p = pt((i / 16) * (Math.PI / 2));
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Chevrons climbing toward the lip.
  for (let i = 0; i < 3; i++) {
    const t = (frame / 46 + i / 3) % 1;
    const a = t * (Math.PI / 2);
    const p = pt(a);
    const fade = Math.sin(t * Math.PI); // ease in and out at the ends
    ctx.save();
    ctx.translate(p.x, p.y);
    // Tangent of the curve at a, pointing up-slope.
    ctx.rotate(Math.atan2(-Math.sin(a), dir * Math.cos(a)) + (dir === 1 ? 0 : Math.PI));
    ctx.scale(dir, 1);
    ctx.fillStyle = rim;
    ctx.globalAlpha = 0.5 * fade;
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.lineTo(1, 0);
    ctx.lineTo(-4, 4);
    ctx.lineTo(-2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Lip marker: the take-off point, flagged like a summit.
  const lip = pt(Math.PI / 2);
  ctx.fillStyle = rim;
  ctx.fillRect(lip.x - 1, lip.y - 8, 2, 8);
  const g = ctx.createRadialGradient(lip.x, lip.y - 8, 1, lip.x, lip.y - 8, 8);
  g.addColorStop(0, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(lip.x - 8, lip.y - 16, 16, 16);
  ctx.restore();
}

/**
 * Hard-light one-way platform. (x, y) is the top-left of the deck, `w` its
 * width. `flipIn` is frames until the next solid<->ghost flip: a solid deck
 * blinks its last 40 frames (the mechanics side guarantees at least 20 under
 * a standing player), and a ghost brightens as its return approaches.
 */
export function drawPhasePlatform(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  solid: boolean,
  flipIn: number,
  frame: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  if (solid) {
    // Warning blink is keyed to flipIn, not the frame clock, so the LAST
    // blink always lands exactly at the flip.
    const warning = flipIn < 40;
    const dim = warning && Math.floor(flipIn / 5) % 2 === 0;
    ctx.globalAlpha = dim ? 0.42 : 1;
    ctx.fillStyle = 'rgba(65,240,255,0.25)';
    ctx.fillRect(-2, -3, w + 4, 12);
    ctx.fillStyle = '#1a7a8c';
    ctx.fillRect(0, 4, w, 3);
    ctx.fillStyle = '#41d4ec';
    ctx.fillRect(0, 1.6, w, 3);
    ctx.fillStyle = '#c9f6ff';
    ctx.fillRect(0, 0, w, 2);
    // Scan shimmer sliding along the deck.
    const sx = ((frame * 1.4) % (w + 30)) - 15;
    const g = ctx.createLinearGradient(sx - 12, 0, sx + 12, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(Math.max(0, sx - 12), 0, Math.min(24, w), 2.4);
    // End caps.
    ctx.fillStyle = '#ff4fa8';
    ctx.fillRect(-2, -1, 3, 8.5);
    ctx.fillRect(w - 1, -1, 3, 8.5);
    if (warning && !dim) {
      ctx.fillStyle = 'rgba(255,190,60,0.8)';
      ctx.fillRect(0, -2.4, w, 1.6);
    }
  } else {
    // Ghost: the telegraph that the floor comes back. Brightens on approach,
    // sparkles just before re-materialising.
    const near = Math.max(0, 1 - flipIn / 50);
    const a = 0.1 + near * 0.3;
    ctx.strokeStyle = `rgba(65,240,255,${a})`;
    ctx.lineWidth = 1.2;
    for (let sx = 0; sx < w; sx += 10) {
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(Math.min(sx + 6, w), 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx + 2, 7);
      ctx.lineTo(Math.min(sx + 8, w), 7);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(255,79,168,${a + 0.1})`;
    ctx.fillRect(-2, -1, 3, 8.5);
    ctx.fillRect(w - 1, -1, 3, 8.5);
    if (flipIn < 16) {
      // Rising assembly ticks.
      for (let i = 0; i < 3; i++) {
        const p = ((16 - flipIn) / 16 + i / 3) % 1;
        ctx.fillStyle = `rgba(200,250,255,${0.7 * (1 - p)})`;
        ctx.fillRect(w * (0.2 + i * 0.3), 6 - p * 10, 1.6, 3);
      }
    }
  }
  ctx.restore();
}

/**
 * The hopper: a coiled spring-legged jumper, stompable like a crab. (x, y) is
 * its ground contact point. `charge01` squashes the coil through the wind-up
 * (its jump tell); airborne it rides fully extended.
 */
export function drawHopper(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: 1 | -1,
  grounded: boolean,
  charge01: number,
  frame: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir >= 0 ? 1 : -1, 1);
  const coilH = grounded ? 10 - 4.5 * charge01 : 14;
  const rattle = grounded && charge01 > 0.75 ? Math.sin(frame * 2.4) : 0;
  ctx.translate(rattle, 0);

  // Foot plate + coil.
  ctx.fillStyle = '#2c2838';
  ctx.fillRect(-5, -2, 10, 2);
  ctx.strokeStyle = '#8b93a5';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 3; i++) {
    const cy = -2 - (coilH / 3) * (i + 0.5);
    ctx.beginPath();
    ctx.ellipse(0, cy, 5.5 - i * 0.7, coilH / 7, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Body: same hostile red family as the crab, so "stomp me" carries over.
  const squash = grounded ? 1 - charge01 * 0.22 : 1.12;
  ctx.translate(0, -2 - coilH);
  ctx.scale(1 / Math.sqrt(squash), squash);
  ctx.fillStyle = PAL.enemy;
  ctx.beginPath();
  ctx.roundRect(-7.5, -11, 15, 11, 5);
  ctx.fill();
  ctx.fillStyle = PAL.podDark;
  ctx.fillRect(-7.5, -3.5, 15, 2);
  // Eyes forward.
  ctx.fillStyle = '#fff';
  ctx.fillRect(1, -9.5, 4, 4.5);
  ctx.fillStyle = '#111';
  ctx.fillRect(3, -8.2, 2, 2);
  if (!grounded) {
    // Airborne: motion ticks under the coil.
    ctx.fillStyle = 'rgba(200,210,225,0.5)';
    ctx.fillRect(-4, 13, 1.6, 4);
    ctx.fillRect(2.5, 14, 1.6, 3);
  }
  ctx.restore();
}

/** The arena gates that seal the boss fight in. */
export function drawBossGate(
  ctx: CanvasRenderingContext2D,
  x: number,
  top: number,
  w: number,
  h: number,
  frame: number,
): void {
  if (h <= 0) return;
  ctx.save();
  ctx.translate(x - w / 2, top);
  ctx.fillStyle = '#4a4f5c';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#343947';
  for (let y = 0; y < h; y += 14) ctx.fillRect(0, y, w, 3);
  // Hazard stripes on the leading edge.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, h - 12, w, 12);
  ctx.clip();
  for (let i = -2; i < w / 6 + 2; i++) {
    ctx.fillStyle = i % 2 ? '#e8c832' : '#23262e';
    ctx.beginPath();
    ctx.moveTo(i * 8, h - 12);
    ctx.lineTo(i * 8 + 8, h - 12);
    ctx.lineTo(i * 8 + 2, h);
    ctx.lineTo(i * 8 - 6, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Rivets and a warning light.
  ctx.fillStyle = '#6b7280';
  for (let y = 8; y < h - 12; y += 22) {
    ctx.fillRect(3, y, 2, 2);
    ctx.fillRect(w - 5, y, 2, 2);
  }
  ctx.fillStyle = `rgba(232,56,79,${0.45 + 0.45 * Math.sin(frame / 6)})`;
  ctx.beginPath();
  ctx.arc(w / 2, 10, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawGoal(ctx: CanvasRenderingContext2D, x: number, y: number, spinning: number, frame: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#aab3c5';
  ctx.fillRect(-2, -34, 4, 34);
  const sq = spinning > 0 ? Math.abs(Math.cos(frame / 6)) : 1;
  ctx.scale(Math.max(0.1, sq), 1);
  ctx.fillStyle = '#2b6cb0';
  ctx.beginPath();
  ctx.roundRect(2, -34, 22, 14, 3);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px monospace';
  ctx.fillText('GOAL', 4, -24);
  ctx.restore();
}

export function drawBoss(ctx: CanvasRenderingContext2D, boss: BossLike, frame: number): void {
  // Compared through `string` so this file stays green while the mirage boss
  // itself is still landing in its own lane.
  const kind = boss.kind as string;
  if (kind === 'press') drawPressBoss(ctx, boss as PressBoss, frame);
  else if (kind === 'shard') drawShardBoss(ctx, boss as CrystalBoss, frame);
  else if (kind === 'mirage') drawMirageBoss(ctx, boss as unknown as MirageBossView, frame);
  else drawPodBoss(ctx, boss as Boss, frame);
}

/**
 * The shape of the mirage boss this painter draws from — kept structural so
 * the art and the boss logic can land independently. The boss lane's class
 * satisfies this by construction.
 */
export interface MirageBossView {
  x: number;
  y: number;
  groundY: number;
  phase: 'intro' | 'pace' | 'trace' | 'derez' | 'defeated';
  afterimages: { x: number; y: number; age: number }[];
  /** 0 = fully rendered, 1 = fully de-rezzed (core exposed). */
  derez01: number;
  facing: 1 | -1;
  timer: number;
  hp: number;
  maxHp: number;
  invuln: number;
  /** Ground speed, px/frame (>= 0). Drives the legs — a planted pacer stands. */
  speed?: number;
}

function drawPodBoss(ctx: CanvasRenderingContext2D, boss: Boss, frame: number): void {
  const flash = boss.invuln > 0 && frame % 4 < 2;
  ctx.save();
  // Mace.
  const mace = boss.maceBox;
  if (mace) {
    const mp = boss.macePos();
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(boss.x, boss.y + 14);
    ctx.lineTo(mp.x, mp.y);
    ctx.stroke();
    ctx.fillStyle = '#3d4452';
    ctx.beginPath();
    ctx.arc(mp.x, mp.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#707a8c';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + frame / 20;
      ctx.fillRect(mp.x + Math.cos(a) * 8 - 1.5, mp.y + Math.sin(a) * 8 - 1.5, 3, 3);
    }
  }
  // Pod.
  ctx.translate(boss.x, boss.y);
  ctx.fillStyle = flash ? '#fff' : PAL.pod;
  ctx.beginPath();
  ctx.roundRect(-20, -12, 40, 24, 10);
  ctx.fill();
  ctx.fillStyle = flash ? '#ffd' : PAL.yolk;
  ctx.beginPath();
  ctx.roundRect(-12, -20, 24, 12, 6);
  ctx.fill();
  // Dr. Yolk silhouette (goggles + moustache, original design).
  if (!flash) {
    ctx.fillStyle = '#20303f';
    ctx.fillRect(-7, -17, 5, 4);
    ctx.fillRect(2, -17, 5, 4);
    ctx.fillStyle = '#7a4a21';
    ctx.fillRect(-6, -11, 12, 3);
  }
  // Thruster flame.
  ctx.fillStyle = `rgba(255,${140 + Math.sin(frame / 3) * 60},40,0.8)`;
  const f = 6 + Math.sin(frame / 2) * 2;
  ctx.beginPath();
  ctx.moveTo(-5, 12);
  ctx.lineTo(5, 12);
  ctx.lineTo(0, 12 + f);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPressBoss(ctx: CanvasRenderingContext2D, boss: PressBoss, frame: number): void {
  const flash = boss.invuln > 0 && frame % 4 < 2;
  const open = boss.phase === 'open';
  const warning = boss.phase === 'telegraph' && frame % 8 < 4;
  ctx.save();

  // Ground shockwaves: rippling energy arcs.
  for (const s of boss.shockwaves) {
    const a = 1 - s.age / 80;
    ctx.strokeStyle = `rgba(255,170,60,${0.9 * a})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(s.x, boss.groundY, 6 + i * 5, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.translate(boss.x, boss.y);
  // Piston body: heavy cylinder with side rails.
  ctx.fillStyle = flash ? '#fff' : warning ? '#7c4a52' : '#59616f';
  ctx.beginPath();
  ctx.roundRect(-22, -18, 44, 30, 6);
  ctx.fill();
  ctx.fillStyle = flash ? '#eee' : '#3d4452';
  ctx.fillRect(-22, -6, 44, 4);
  ctx.fillRect(-26, -18, 5, 30);
  ctx.fillRect(21, -18, 5, 30);
  // Crush plate.
  ctx.fillStyle = flash ? '#fff' : '#23262e';
  ctx.beginPath();
  ctx.roundRect(-24, 12, 48, 8, 2);
  ctx.fill();
  ctx.fillStyle = PAL.spring;
  for (let i = 0; i < 4; i++) ctx.fillRect(-20 + i * 12, 14, 6, 4); // hazard studs
  // Vulnerable vents glow while open.
  if (open) {
    const pulse = 0.5 + Math.sin(frame / 4) * 0.3;
    ctx.fillStyle = `rgba(255,140,40,${pulse})`;
    ctx.fillRect(-16, -14, 10, 6);
    ctx.fillRect(6, -14, 10, 6);
  }
  // Yolk cockpit dome on top.
  ctx.fillStyle = flash ? '#ffd' : PAL.yolk;
  ctx.beginPath();
  ctx.roundRect(-12, -28, 24, 12, 6);
  ctx.fill();
  if (!flash) {
    ctx.fillStyle = '#20303f';
    ctx.fillRect(-7, -25, 5, 4);
    ctx.fillRect(2, -25, 5, 4);
    ctx.fillStyle = '#7a4a21';
    ctx.fillRect(-6, -19, 12, 3);
  }
  ctx.restore();
}

/**
 * The Shard Drill. Its whole fight is legible from three silhouettes: a
 * travelling mound of rubble (untouchable), a planted rig with the drill
 * buried and the hatch shut (armoured), and the same rig with its hatch split
 * open around a lit core (hurt it now).
 */
function drawShardBoss(ctx: CanvasRenderingContext2D, boss: CrystalBoss, frame: number): void {
  const flash = boss.invuln > 0 && frame % 4 < 2;
  const open = boss.phase === 'vulnerable';
  const firing = boss.phase === 'shards';
  const dead = boss.phase === 'defeated';
  const em = boss.emergence;

  // Shards first, so a splinter leaving the rig reads as having come out of it.
  for (const s of boss.shards) {
    const sp = Math.hypot(s.vx, s.vy) || 1;
    ctx.save();
    ctx.translate(s.x, s.y);
    const halo = ctx.createRadialGradient(0, 0, 1, 0, 0, 14);
    halo.addColorStop(0, 'rgba(224,90,216,0.45)');
    halo.addColorStop(1, 'rgba(224,90,216,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(-14, -14, 28, 28);
    ctx.strokeStyle = 'rgba(224,90,216,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo((-s.vx / sp) * 11, (-s.vy / sp) * 11);
    ctx.stroke();
    ctx.rotate(Math.atan2(s.vy, s.vx) + s.age * 0.11);
    ctx.fillStyle = PAL.magenta;
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(0, 4.6);
    ctx.lineTo(-7, 0);
    ctx.lineTo(0, -4.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(0, 1.8);
    ctx.lineTo(-2, 0);
    ctx.lineTo(0, -1.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  if (!dead) drawBurrowMound(ctx, boss, frame, em);
  if (boss.buried) return; // under the floor: the mound is the whole picture

  ctx.save();
  // Anything below the cavern floor belongs to the floor. Clipping there is
  // what makes a half-risen rig look like it is climbing OUT of the rock
  // rather than standing in front of it.
  ctx.beginPath();
  ctx.rect(boss.x - 96, boss.groundY - 640, 192, 640);
  ctx.clip();
  ctx.translate(boss.x, boss.y);
  if (dead) ctx.rotate(0.22);

  // Drill: stalls the moment the rig is spent, which is the tell that the
  // hatch is about to open.
  const drilling = !open && !dead;
  const metal = flash ? '#fff' : dead ? '#443b66' : '#5b4e90';
  const metalDark = flash ? '#eee' : dead ? '#2a2444' : '#332a55';
  const metalLit = flash ? '#fff' : dead ? '#564b7f' : '#8478c4';
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-13, 4);
  ctx.lineTo(13, 4);
  ctx.lineTo(0, 42);
  ctx.closePath();
  ctx.fillStyle = flash ? '#fff' : '#8b7ab8';
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = flash ? '#ddd' : '#3d3358';
  const helix = (drilling ? frame * 1.2 : 0) % 9;
  for (let y = -5 + helix; y < 44; y += 9) {
    ctx.beginPath();
    ctx.moveTo(-16, y);
    ctx.lineTo(16, y - 4);
    ctx.lineTo(16, y - 0.5);
    ctx.lineTo(-16, y + 3.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  if (drilling) {
    ctx.fillStyle = `rgba(140,245,255,${0.35 + 0.35 * Math.sin(frame / 4)})`;
    ctx.beginPath();
    ctx.arc(0, 40, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Chassis. It is a machine in a cave of the same violet, so it carries its
  // own rim light — without it the silhouette dissolves into the rock.
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.roundRect(-24, -20, 48, 32, 7);
  ctx.fill();
  ctx.fillStyle = metalLit;
  ctx.fillRect(-19, -19, 38, 3);
  ctx.fillRect(-28, -17, 5, 26);
  ctx.fillRect(23, -17, 5, 26);
  ctx.fillStyle = metalDark;
  ctx.fillRect(-24, -4, 48, 5);
  if (!flash) {
    ctx.fillStyle = `rgba(140,245,255,${dead ? 0.12 : 0.32})`;
    ctx.fillRect(-19, -21, 38, 1.4);
  }

  // Battle damage: one crack per hit landed, under everything mounted on the
  // hull so a wound never draws across the core.
  const wounds = boss.maxHp - boss.hp;
  ctx.strokeStyle = 'rgba(15,10,26,0.7)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < wounds; i++) {
    const cx = -21 + ((i * 7) % 42);
    const cy = -13 + ((i * 5) % 20);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (i % 2 ? 5 : -4), cy + 5);
    ctx.lineTo(cx + (i % 2 ? 2 : -7), cy + 11);
    ctx.stroke();
  }

  // Shard launchers, lit while a volley is in the tubes.
  const hot = firing ? 0.55 + 0.45 * Math.sin(frame / 3) : 0.12;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 22, -13);
    ctx.rotate(side * 0.55);
    ctx.fillStyle = metalLit;
    ctx.fillRect(-4, -13, 8, 15);
    ctx.fillStyle = `rgba(224,90,216,${hot})`;
    ctx.fillRect(-3, -14, 6, 4);
    ctx.restore();
  }

  if (open) {
    // Hatch split apart around the core: the one thing worth aiming at, so it
    // is the brightest object on screen while the window is up.
    const pulse = 0.55 + 0.45 * Math.sin(frame / 5);
    const bloom = ctx.createRadialGradient(0, -6, 2, 0, -6, 28);
    bloom.addColorStop(0, `rgba(150,245,255,${0.55 * pulse})`);
    bloom.addColorStop(0.5, `rgba(224,90,216,${0.26 * pulse})`);
    bloom.addColorStop(1, 'rgba(224,90,216,0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(-30, -34, 60, 58);
    ctx.fillStyle = metalDark;
    ctx.fillRect(-22, -18, 6, 17);
    ctx.fillRect(16, -18, 6, 17);
    ctx.fillStyle = `rgba(150,245,255,${0.75 + 0.25 * pulse})`;
    ctx.beginPath();
    ctx.moveTo(0, -19);
    ctx.lineTo(9, -6);
    ctx.lineTo(0, 7);
    ctx.lineTo(-9, -6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(4, -7);
    ctx.lineTo(0, -3);
    ctx.lineTo(-4, -7);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = flash ? '#eee' : dead ? '#3b3360' : '#6b5ca0';
    ctx.beginPath();
    ctx.roundRect(-13, -17, 26, 20, 4);
    ctx.fill();
    // Core light leaking through the seam: the hatch is never fully cold, so
    // the player learns where to hit before the window ever opens.
    ctx.fillStyle = '#2b2348';
    ctx.fillRect(-1.5, -17, 3, 20);
    ctx.fillStyle = `rgba(75,225,255,${dead ? 0.06 : 0.2 + 0.14 * Math.sin(frame / 9)})`;
    ctx.fillRect(-1, -16, 2, 18);
  }

  // Yolk's cockpit, same goggles-and-moustache silhouette as his other rigs.
  ctx.fillStyle = flash ? '#ffd' : dead ? '#9a7328' : PAL.yolk;
  ctx.beginPath();
  ctx.roundRect(-12, -32, 24, 13, 6);
  ctx.fill();
  if (!flash) {
    ctx.fillStyle = '#20303f';
    ctx.fillRect(-7, -29, 5, 4);
    ctx.fillRect(2, -29, 5, 4);
    ctx.fillStyle = '#7a4a21';
    ctx.fillRect(-6, -23, 12, 3);
  }

  if (dead) {
    // Venting smoke, so a beaten rig still moves while the arena opens up.
    for (let i = 0; i < 3; i++) {
      const p = ((frame / 52 + i / 3) % 1);
      ctx.fillStyle = `rgba(185,175,215,${0.34 * (1 - p)})`;
      ctx.beginPath();
      ctx.arc(-6 + Math.sin(p * 5 + i) * 6, -30 - p * 30, 3 + p * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Rubble over the buried rig. `em` is 0 while it is fully under the floor and
 * 1 once it is clear, so the mound shrinks as the rig comes up. The spray
 * intensifies the longer it stays down — the eruption has to be visible before
 * it happens, not after.
 */
function drawBurrowMound(ctx: CanvasRenderingContext2D, boss: CrystalBoss, frame: number, em: number): void {
  const hide = 1 - em;
  if (hide <= 0.02) return;
  const charge = Math.min(1, boss.timer / 110);
  const shake = Math.sin(frame * 1.7) * 1.6 * charge;
  ctx.save();
  ctx.translate(boss.x + shake, boss.groundY);

  // Glowing fracture in the crystal floor — the rig is lit from underneath.
  const seam = ctx.createRadialGradient(0, 0, 2, 0, 0, 52);
  seam.addColorStop(0, `rgba(224,90,216,${0.32 * hide})`);
  seam.addColorStop(1, 'rgba(224,90,216,0)');
  ctx.fillStyle = seam;
  ctx.fillRect(-54, -38, 108, 46);
  // Cracks run further out than the rubble does, so the ground it is about to
  // come through is marked wider than the mound the player is watching.
  ctx.strokeStyle = `rgba(140,245,255,${(0.3 + 0.4 * charge) * hide})`;
  ctx.lineWidth = 1.3;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 12, -1);
    ctx.lineTo(dir * 25, -4);
    ctx.lineTo(dir * 34, -1);
    ctx.lineTo(dir * 45, -4);
    ctx.stroke();
  }

  // The pile itself: angular, because a smooth dome reads as another vehicle
  // rather than as broken floor.
  const mh = 16 * hide;
  const pile: [number, number][] = [
    [-29, 2],
    [-20, -mh * 0.4],
    [-12, -mh * 0.82],
    [-3, -mh],
    [5, -mh * 0.7],
    [14, -mh * 0.92],
    [23, -mh * 0.32],
    [30, 2],
  ];
  ctx.beginPath();
  ctx.moveTo(pile[0][0], pile[0][1]);
  for (const [px, py] of pile) ctx.lineTo(px, py);
  ctx.closePath();
  ctx.fillStyle = PAL.cavernDark;
  ctx.fill();
  ctx.strokeStyle = `rgba(150,230,255,${0.3 * hide})`;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = PAL.cavern;
  ctx.beginPath();
  ctx.moveTo(-12, -mh * 0.82);
  ctx.lineTo(-3, -mh);
  ctx.lineTo(1, -mh * 0.55);
  ctx.lineTo(-9, -mh * 0.4);
  ctx.closePath();
  ctx.fill();

  // Rubble thrown clear, plus dust hanging over the hole.
  for (let i = 0; i < 6; i++) {
    const p = (frame / 32 + i / 6) % 1;
    const dir = i % 2 ? 1 : -1;
    const cx = dir * (4 + i * 2.4) * (0.5 + p * 1.2);
    const cy = -mh - (1 - (2 * p - 1) * (2 * p - 1)) * (8 + 15 * charge);
    ctx.fillStyle = `rgba(155,125,210,${(1 - p) * hide})`;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 2.4);
    ctx.lineTo(cx + 2.4, cy + 1.8);
    ctx.lineTo(cx - 2.4, cy + 1.4);
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 0; i < 3; i++) {
    const p = (frame / 46 + i / 3) % 1;
    ctx.fillStyle = `rgba(125,105,180,${0.26 * (1 - p) * hide})`;
    ctx.beginPath();
    ctx.arc(Math.sin(p * 5 + i * 2) * 7, -mh - 2 - p * 20, 3 + p * 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * The Mirage: a hard-light pace-runner. Its fight is told in light levels —
 * sprinting it is a saturated neon streak trailing afterimages; de-rezzed it
 * collapses into glitched slices around a bare core, and THAT is the thing to
 * hit. The silhouette is deliberately taller and leaner than the hero: a
 * rival runner, not another machine.
 */
function drawMirageBoss(ctx: CanvasRenderingContext2D, boss: MirageBossView, frame: number): void {
  const flash = boss.invuln > 0 && frame % 4 < 2;
  // Legs follow actual speed when the boss exposes it: the pre-trace tell is
  // the pacer PLANTING mid-lap, which only reads if a stationary boss stands.
  const running = boss.speed !== undefined ? boss.speed > 0.5 : boss.phase === 'pace' || boss.phase === 'trace';
  const derez = boss.derez01;

  ctx.save();

  // Afterimages first. These are not exhaust — each one is a hard-light copy
  // frozen in the lane that stays LETHAL until it ages out (whatever phase
  // the boss itself is in), so each is drawn from its own age alone: a brief
  // materialise, a long solid hold, and a clearly-dying flicker at the end.
  for (const ai of boss.afterimages) {
    if (ai.age >= AFTERIMAGE_LIFE) continue;
    const life = 1 - ai.age / AFTERIMAGE_LIFE;
    const arming = ai.age < AFTERIMAGE_ARM;
    // The last quarter of life burns down visibly; before that, hold solid.
    let alpha = arming ? 0.2 + (ai.age / AFTERIMAGE_ARM) * 0.35 : life < 0.25 ? 0.55 * (life / 0.25) : 0.55;
    if (!arming && life < 0.25 && frame % 6 < 2) alpha *= 0.45; // dying flicker
    // A vertical hard-light seam through the copy sells "fence post", which
    // is what the hazard box actually is.
    ctx.fillStyle = `rgba(255,79,168,${alpha * 0.55})`;
    ctx.fillRect(ai.x - 1, ai.y - 17, 2, 34);
    mirageFigure(ctx, ai.x, ai.y, boss.facing, frame, {
      running: false,
      alpha,
      color: '255,79,168',
      ghost: true,
    });
  }

  // Ground light: a runner made of light throws glow, not shadow.
  const pool = ctx.createRadialGradient(boss.x, boss.groundY, 2, boss.x, boss.groundY, 34);
  pool.addColorStop(0, `rgba(255,79,168,${0.22 * (1 - derez * 0.6)})`);
  pool.addColorStop(1, 'rgba(255,79,168,0)');
  ctx.fillStyle = pool;
  ctx.fillRect(boss.x - 36, boss.groundY - 12, 72, 18);

  // Intro: assembling out of scanlines. `timer` is safe here — it is the
  // intro's own one-shot ramp, not a looping animation clock.
  const assemble = boss.phase === 'intro' ? Math.min(1, boss.timer / 55) : 1;

  if (boss.phase === 'defeated') {
    // Kneeling and coming apart: pixels stream upward off the body.
    mirageFigure(ctx, boss.x, boss.y + 8, boss.facing, frame, {
      running: false,
      alpha: 0.5 + 0.2 * Math.sin(frame / 5),
      color: '120,110,160',
      ghost: false,
      kneel: true,
    });
    for (let i = 0; i < 8; i++) {
      const p = (frame / 60 + i / 8) % 1;
      const px = boss.x + Math.sin(i * 2.6) * 14;
      ctx.fillStyle = `rgba(${i % 2 ? '255,79,168' : '65,240,255'},${0.7 * (1 - p)})`;
      ctx.fillRect(px, boss.y + 4 - p * 46, 2, 2);
    }
    ctx.restore();
    return;
  }

  if (derez > 0.05) {
    // De-rezzed: the figure shears into horizontal slices, each thrown a
    // deterministic distance sideways. More derez, more throw.
    const sliceH = 12;
    for (let s = 0; s < 5; s++) {
      const off = Math.sin(s * 37.7 + Math.floor(frame / 3) * 1.31) * 7 * derez;
      ctx.save();
      ctx.beginPath();
      ctx.rect(boss.x - 40, boss.y - 34 + s * sliceH, 80, sliceH);
      ctx.clip();
      mirageFigure(ctx, boss.x + off, boss.y, boss.facing, frame, {
        running: false,
        alpha: (0.5 + 0.3 * Math.sin(frame / 2 + s)) * assemble,
        color: flash ? '255,255,255' : '255,79,168',
        ghost: false,
      });
      ctx.restore();
    }
    // The exposed core: brightest thing on screen while the window is open,
    // exactly like the shard rig's hatch. Hit this.
    const pulse = 0.55 + 0.45 * Math.sin(frame / 5);
    const bloom = ctx.createRadialGradient(boss.x, boss.y - 12, 2, boss.x, boss.y - 12, 26 * derez + 6);
    bloom.addColorStop(0, `rgba(200,250,255,${0.7 * pulse * derez})`);
    bloom.addColorStop(0.55, `rgba(255,79,168,${0.3 * pulse * derez})`);
    bloom.addColorStop(1, 'rgba(255,79,168,0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(boss.x - 34, boss.y - 46, 68, 68);
    ctx.fillStyle = `rgba(235,252,255,${0.6 + 0.4 * pulse})`;
    ctx.beginPath();
    ctx.moveTo(boss.x, boss.y - 12 - 6 - 3 * derez);
    ctx.lineTo(boss.x + 5 + 2 * derez, boss.y - 12);
    ctx.lineTo(boss.x, boss.y - 12 + 6 + 3 * derez);
    ctx.lineTo(boss.x - 5 - 2 * derez, boss.y - 12);
    ctx.closePath();
    ctx.fill();
  } else {
    // Fully rendered. Speed streaks trail the sprint.
    if (running) {
      for (let i = 0; i < 3; i++) {
        const g = ctx.createLinearGradient(boss.x - boss.facing * 46, 0, boss.x - boss.facing * 8, 0);
        g.addColorStop(0, 'rgba(65,240,255,0)');
        g.addColorStop(1, `rgba(65,240,255,${0.3 - i * 0.08})`);
        ctx.fillStyle = g;
        ctx.fillRect(Math.min(boss.x - boss.facing * 46, boss.x - boss.facing * 8), boss.y - 26 + i * 14, 38, 2);
      }
    }
    ctx.save();
    if (assemble < 1) {
      // Materialise bottom-up behind a scanline curtain.
      ctx.beginPath();
      ctx.rect(boss.x - 40, boss.y + 24 - 60 * assemble, 80, 60 * assemble);
      ctx.clip();
    }
    mirageFigure(ctx, boss.x, boss.y, boss.facing, frame, {
      running,
      alpha: flash ? 1 : 0.92,
      color: flash ? '255,255,255' : '255,79,168',
      ghost: false,
    });
    if (assemble < 1) {
      ctx.fillStyle = 'rgba(160,240,255,0.5)';
      ctx.fillRect(boss.x - 26, boss.y + 24 - 60 * assemble, 52, 1.6);
    }
    ctx.restore();
    // Core seam glinting through the chest plate — the tell of where to aim,
    // taught before the first derez window ever opens.
    ctx.fillStyle = `rgba(200,250,255,${0.25 + 0.15 * Math.sin(frame / 9)})`;
    ctx.fillRect(boss.x - 1, boss.y - 17, 2, 10);
    // The pre-trace tell: the pacer has PLANTED mid-lap and is charging up.
    // (Early pace also starts at standstill, but it is up to cruise within
    // ~30 frames, so a stationary pacer past that is always the wind-up.)
    if (boss.phase === 'pace' && (boss.speed ?? 1) < 0.3 && boss.timer > 30) {
      const surge = 0.35 + 0.45 * Math.sin(frame / 2.6);
      ctx.fillStyle = `rgba(65,240,255,${surge})`;
      for (let i = 0; i < 3; i++) {
        const gy = boss.y - 24 + ((frame * 2 + i * 18) % 48);
        ctx.fillRect(boss.x - 12, gy, 24, 1.4);
      }
      ctx.fillStyle = `rgba(255,255,255,${surge * 0.8})`;
      ctx.fillRect(boss.x - 14, boss.y + 22, 28, 1.6);
    }
  }
  ctx.restore();
}

/** One hard-light runner figure. `color` is an "r,g,b" string. */
function mirageFigure(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: 1 | -1,
  frame: number,
  opt: { running: boolean; alpha: number; color: string; ghost: boolean; kneel?: boolean },
): void {
  const { running, alpha, color, ghost, kneel } = opt;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.globalAlpha = alpha;
  if (kneel) {
    ctx.translate(0, 6);
    ctx.rotate(-0.18);
  }

  const body = `rgba(${color},${ghost ? 0.55 : 0.85})`;
  const edge = ghost ? `rgba(${color},0.9)` : 'rgba(65,240,255,0.9)';

  // Legs: light-blades scissoring on the frame clock in a sprint, or a
  // braced stance when planted.
  ctx.strokeStyle = body;
  ctx.lineWidth = 3;
  if (running) {
    for (let i = 0; i < 2; i++) {
      const a = frame / 1.8 + i * Math.PI;
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.quadraticCurveTo(Math.cos(a) * 6, 15, Math.cos(a) * 11, 8 + Math.abs(Math.sin(a)) * 14);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(-1, 8);
    ctx.lineTo(-5, 22);
    ctx.moveTo(1, 8);
    ctx.lineTo(6, 22);
    ctx.stroke();
  }

  // Torso: a swept wedge leaning into the run.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-5, 10);
  ctx.lineTo(-8, -14);
  ctx.lineTo(4, -18);
  ctx.lineTo(8, -6);
  ctx.lineTo(4, 10);
  ctx.closePath();
  ctx.fill();
  // Leading-edge light.
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(4, -18);
  ctx.lineTo(8, -6);
  ctx.stroke();

  // Head: angular visor helm with a swept crest.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-3, -18);
  ctx.lineTo(6, -22);
  ctx.lineTo(9, -27);
  ctx.lineTo(-2, -30);
  ctx.lineTo(-9, -24);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath(); // crest streaming behind
  ctx.moveTo(-7, -28);
  ctx.lineTo(-18, -24);
  ctx.lineTo(-8, -22);
  ctx.closePath();
  ctx.fill();
  // Visor slit.
  ctx.fillStyle = ghost ? `rgba(${color},1)` : 'rgba(235,252,255,0.95)';
  ctx.fillRect(1, -26.5, 7, 2);

  // Arms pumping (simple counter-swing light blades).
  ctx.strokeStyle = body;
  ctx.lineWidth = 2.4;
  if (running) {
    const a = frame / 1.8;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(Math.cos(a + Math.PI) * 9, -6 + Math.sin(a + Math.PI) * 5);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(7, -2);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------------------------------- Hero ----------------------------------- */

/** Translucent speed afterimage (ball or standing silhouette). */
export function drawAfterimage(ctx: CanvasRenderingContext2D, x: number, y: number, ball: boolean, alpha: number, color = PAL.heroBlue): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  if (ball) ctx.arc(x, y, 12, 0, Math.PI * 2);
  else ctx.roundRect(x - 8, y - 16, 16, 34, 8);
  ctx.fill();
  ctx.restore();
}

export function drawHero(ctx: CanvasRenderingContext2D, p: Player, frame: number): void {
  if (p.invuln > 0 && frame % 4 < 2) return; // damage blink
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.grounded) ctx.rotate((-p.angle * Math.PI) / 180);
  // Squash and stretch: land hard and the body compresses, rise fast and it
  // elongates. Volume is roughly preserved so it reads as weight, not scale.
  if (p.squash !== 0) {
    const sy = 1 - p.squash * 0.28;
    ctx.translate(0, (1 - sy) * p.h);
    ctx.scale(1 / sy, sy);
  }
  // Crouching compresses the whole body, not just the head.
  if (p.crouch) {
    ctx.translate(0, p.h * 0.22);
    ctx.scale(1.08, 0.78);
  }
  ctx.scale(p.facing, 1);

  // Mag-Board deck under the rider (vehicle, zone-specific).
  if (p.board) {
    const deckY = p.ball ? 14 : 19;
    const glow = ctx.createRadialGradient(0, deckY + 2, 2, 0, deckY + 2, 16);
    glow.addColorStop(0, 'rgba(56,224,200,0.45)');
    glow.addColorStop(1, 'rgba(56,224,200,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-18, deckY - 8, 36, 22);
    ctx.fillStyle = PAL.board;
    ctx.beginPath();
    ctx.roundRect(-13, deckY - 1, 27, 5, 3);
    ctx.fill();
    ctx.fillStyle = PAL.boardDark;
    ctx.fillRect(-9, deckY + 4, 19, 2);
    // Mag-field sparks trailing the deck.
    ctx.fillStyle = `rgba(56,224,200,${0.4 + Math.sin(frame / 3) * 0.3})`;
    ctx.fillRect(-17, deckY, 3, 2);
    ctx.fillRect(-20, deckY + 2, 2, 2);
  }

  if (p.ball) {
    // Ball form: spinning disc.
    ctx.fillStyle = PAL.heroBlue;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PAL.heroBlueDark;
    ctx.lineWidth = 2;
    const a = frame / 2.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 9, a + (i * Math.PI * 2) / 3, a + (i * Math.PI * 2) / 3 + 1.1);
      ctx.stroke();
    }
    if (p.spindashing) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(0, 0, 16, a, a + 2.2);
      ctx.stroke();
    }
  } else {
    const running = Math.abs(p.gsp) > 0.5;
    const legPhase = frame / Math.max(1.5, 6 - Math.abs(p.gsp) * 0.6);
    // Tail (lightning bolt).
    ctx.fillStyle = PAL.heroBlueDark;
    ctx.beginPath();
    ctx.moveTo(-10, 2);
    ctx.lineTo(-18, -2);
    ctx.lineTo(-14, 4);
    ctx.lineTo(-19, 8);
    ctx.lineTo(-11, 8);
    ctx.closePath();
    ctx.fill();
    // Legs.
    ctx.strokeStyle = PAL.heroBlue;
    ctx.lineWidth = 3;
    if (running) {
      for (let i = 0; i < 2; i++) {
        const a = legPhase + i * Math.PI;
        ctx.beginPath();
        ctx.moveTo(0, 6);
        ctx.lineTo(Math.cos(a) * 8, 6 + Math.abs(Math.sin(a)) * 10);
        ctx.stroke();
        ctx.fillStyle = PAL.heroShoe;
        ctx.fillRect(Math.cos(a) * 8 - 4, 6 + Math.abs(Math.sin(a)) * 10 - 2, 8, 4);
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(-3, 6);
      ctx.lineTo(-3, 16);
      ctx.moveTo(3, 6);
      ctx.lineTo(3, 16);
      ctx.stroke();
      ctx.fillStyle = PAL.heroShoe;
      ctx.fillRect(-7, 14, 8, 4);
      ctx.fillRect(-1, 14, 8, 4);
    }
    // Body.
    ctx.fillStyle = PAL.heroBlue;
    ctx.beginPath();
    ctx.roundRect(-8, -6, 16, 14, 6);
    ctx.fill();
    ctx.fillStyle = PAL.heroCream;
    ctx.beginPath();
    ctx.roundRect(-4, -2, 8, 9, 3);
    ctx.fill();
    // Head with ears (swift fox). Looking up tilts it back and lifts the
    // muzzle; crouching tucks it down — the pose has to read at a glance,
    // because it is the only confirmation the input did anything.
    ctx.save();
    if (p.lookUp) {
      ctx.translate(0, -2);
      ctx.rotate(-0.26);
    } else if (p.crouch) {
      ctx.translate(-1, 5);
      ctx.rotate(0.16);
    }
    ctx.fillStyle = PAL.heroBlue;
    ctx.beginPath();
    ctx.roundRect(-7, -18, 15, 13, 5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-5, -17);
    ctx.lineTo(-8, -24);
    ctx.lineTo(-1, -19);
    ctx.moveTo(4, -17);
    ctx.lineTo(6, -24);
    ctx.lineTo(8, -17);
    ctx.fill();
    ctx.fillStyle = PAL.heroCream;
    ctx.beginPath();
    ctx.roundRect(0, -13, 8, 7, 3);
    ctx.fill();
    // Eye.
    ctx.fillStyle = '#fff';
    ctx.fillRect(2, -16, 4, 5);
    ctx.fillStyle = '#111';
    ctx.fillRect(4, p.lookUp ? -16 : -15, 2, 3);
    ctx.restore();
    // Shield bubble.
    if (p.shield) {
      ctx.strokeStyle = 'rgba(90,169,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}
