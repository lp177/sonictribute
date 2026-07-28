import { PHYS } from '../physics/constants.ts';
import { TILES, TILE_EMPTY } from '../physics/TileMap.ts';
import type { TileMap } from '../physics/TileMap.ts';
import type { Player } from '../game/Player.ts';
import type { Boss, BossLike } from '../game/Boss.ts';
import type { PressBoss } from '../game/PressBoss.ts';
import type { LoopZone } from '../game/loops.ts';
import type { LevelTheme } from '../game/Level.ts';

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
}

const TERRAIN_THEMES: Record<LevelTheme, TerrainTheme> = {
  verdant: {
    body: PAL.dirt,
    bodyDark: PAL.dirtDark,
    cap: PAL.grass,
    capDark: PAL.grassDark,
    platTop: PAL.grass,
    platTopDark: PAL.grassDark,
    platBody: PAL.dirt,
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
  }

  if (id === 8) {
    // One-way platform: capped slab (grass ledge / hazard-striped girder).
    ctx.fillStyle = pal.platBody;
    ctx.fillRect(0, 8, T, 8);
    ctx.fillStyle = pal.platTop;
    ctx.fillRect(0, 0, T, 8);
    ctx.fillStyle = pal.platTopDark;
    ctx.fillRect(0, 6, T, 2);
  } else if (exposed) {
    // Surface cap following the terrain profile.
    ctx.fillStyle = pal.cap;
    for (let c = 0; c < T; c++) {
      const top = T - heights[c];
      ctx.fillRect(c, top, 1, Math.min(6, heights[c]));
    }
    ctx.fillStyle = pal.capDark;
    for (let c = 0; c < T; c += 3) {
      const top = T - heights[c];
      ctx.fillRect(c, top + 4, 1, 2);
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

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, PAL.skyTop);
  sky.addColorStop(1, PAL.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Stars.
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 90; i++) {
    const s = rnd();
    ctx.globalAlpha = 0.2 + rnd() * 0.5;
    ctx.fillRect(rnd() * w, rnd() * h * 0.55, s > 0.9 ? 2 : 1, s > 0.9 ? 2 : 1);
  }
  ctx.globalAlpha = 1;

  // Moon glow.
  const moon = ctx.createRadialGradient(w * 0.78, h * 0.2, 4, w * 0.78, h * 0.2, 60);
  moon.addColorStop(0, 'rgba(240,244,255,0.9)');
  moon.addColorStop(0.25, 'rgba(200,214,255,0.25)');
  moon.addColorStop(1, 'rgba(200,214,255,0)');
  ctx.fillStyle = moon;
  ctx.fillRect(0, 0, w, h);

  // Far hills.
  ridge(ctx, w, h, h * 0.62, 34, PAL.hillFar, 3);
  // Near hills.
  ridge(ctx, w, h, h * 0.78, 46, PAL.hillNear, 7);
  return cv;
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
  if (boss.kind === 'press') drawPressBoss(ctx, boss as PressBoss, frame);
  else drawPodBoss(ctx, boss as Boss, frame);
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
    // Head with ears (swift fox).
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
    ctx.fillRect(4, -15, 2, 3);
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
