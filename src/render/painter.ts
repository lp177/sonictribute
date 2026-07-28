import { PHYS } from '../physics/constants.ts';
import { TILES, TILE_EMPTY } from '../physics/TileMap.ts';
import type { TileMap } from '../physics/TileMap.ts';
import type { Player } from '../game/Player.ts';
import type { Boss } from '../game/Boss.ts';
import type { LoopZone } from '../game/loops.ts';

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
};

/* ------------------------------ Static terrain ----------------------------- */

/**
 * Renders the layer-0 terrain into offscreen chunks (one canvas per 16-tile
 * column band) once at level load — no per-frame tile work afterwards.
 */
export function renderTerrain(map: TileMap): HTMLCanvasElement[] {
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
        if (id !== TILE_EMPTY) drawTile(ctx, map, id, (tx - cx) * T, ty * T, tx, ty);
      }
    }
    chunks.push(cv);
  }
  return chunks;
}

function tileId(map: TileMap, tx: number, ty: number): number {
  const t = map.get(tx, ty, 0);
  return TILES.findIndex((c) => c === t);
}

function drawTile(ctx: CanvasRenderingContext2D, map: TileMap, id: number, px: number, py: number, tx: number, ty: number): void {
  const above = map.get(tx, ty - 1, 0);
  const exposed = above === TILES[TILE_EMPTY];
  ctx.save();
  ctx.translate(px, py);

  // Dirt body from the tile's height array.
  const heights = TILES[id].heights;
  ctx.fillStyle = PAL.dirt;
  for (let c = 0; c < T; c++) {
    if (id === 8) continue; // one-way platform: drawn separately
    ctx.fillRect(c, T - heights[c], 1, heights[c]);
  }
  if (id !== 8) {
    ctx.fillStyle = PAL.dirtDark;
    for (let c = 0; c < T; c += 4) {
      const h = heights[c];
      if (h > 6) ctx.fillRect(c + 1, T - h + 6, 2, 2);
      if (h > 11) ctx.fillRect(c + 2, T - h + 11, 2, 2);
    }
  }

  if (id === 8) {
    // One-way platform: grassy slab.
    ctx.fillStyle = PAL.dirt;
    ctx.fillRect(0, 8, T, 8);
    ctx.fillStyle = PAL.grass;
    ctx.fillRect(0, 0, T, 8);
    ctx.fillStyle = PAL.grassDark;
    ctx.fillRect(0, 6, T, 2);
  } else if (exposed) {
    // Grass cap following the surface.
    ctx.fillStyle = PAL.grass;
    for (let c = 0; c < T; c++) {
      const top = T - heights[c];
      ctx.fillRect(c, top, 1, Math.min(6, heights[c]));
    }
    ctx.fillStyle = PAL.grassDark;
    for (let c = 0; c < T; c += 3) {
      const top = T - heights[c];
      ctx.fillRect(c, top + 4, 1, 2);
    }
  }
  ctx.restore();
}

/** Pre-renders a loop's annulus art (decor, always visible). */
export function renderLoopArt(loop: LoopZone): HTMLCanvasElement {
  const r = loop.outerR + 8;
  const cv = document.createElement('canvas');
  cv.width = cv.height = r * 2;
  const ctx = cv.getContext('2d')!;
  ctx.translate(r, r);
  // Annulus body.
  ctx.beginPath();
  ctx.arc(0, 0, loop.outerR, 0, Math.PI * 2);
  ctx.arc(0, 0, loop.innerR, 0, Math.PI * 2, true);
  ctx.fillStyle = PAL.dirt;
  ctx.fill('evenodd');
  // Checker accents.
  ctx.save();
  ctx.clip('evenodd');
  ctx.fillStyle = PAL.dirtDark;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    ctx.save();
    ctx.rotate(a);
    ctx.fillRect(loop.innerR + 2, -2, 6, 4);
    ctx.restore();
  }
  ctx.restore();
  // Grass on the outer top half.
  ctx.beginPath();
  ctx.arc(0, 0, loop.outerR, Math.PI, Math.PI * 2);
  ctx.arc(0, 0, loop.outerR - 6, Math.PI * 2, Math.PI, true);
  ctx.closePath();
  ctx.fillStyle = PAL.grass;
  ctx.fill();
  return cv;
}

/* -------------------------------- Background ------------------------------- */

export function renderBackground(w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;

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

export function drawBoss(ctx: CanvasRenderingContext2D, boss: Boss, frame: number): void {
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

/* ---------------------------------- Hero ----------------------------------- */

export function drawHero(ctx: CanvasRenderingContext2D, p: Player, frame: number): void {
  if (p.invuln > 0 && frame % 4 < 2) return; // damage blink
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.grounded) ctx.rotate((-p.angle * Math.PI) / 180);
  ctx.scale(p.facing, 1);

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
