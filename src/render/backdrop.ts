/**
 * Layered parallax backdrops, one art-directed set per biome.
 *
 * The old background was ONE 640-px image tiled twice — the second pass at
 * 60% opacity and a different scroll speed. Every sun, lighthouse and
 * billboard in it was therefore printed twice, ghosted, with a hard seam
 * every 640 px: the "two suns" bug, and the reason the sky looked like a
 * double exposure.
 *
 * Here each biome is a stack of distinct layers, far to near:
 *  - a SCREEN layer (sky gradient, sun/moon, sea) that barely moves;
 *  - three silhouette bands, each a seamless period (whole sine cycles,
 *    props wrapped across the period edge), baked once at the render scale
 *    and scrolled at its own horizontal and vertical parallax;
 *  - optional live elements (turning gears, drifting motes) drawn per frame.
 * Atmospheric perspective does the depth work: every farther band is closer
 * to the sky colour and lower in contrast, so the gameplay layer — the only
 * saturated, outlined thing on screen — always pops.
 */
import type { LevelTheme } from '../game/Level.ts';
import { VIEW_W, VIEW_H, makeLayer, blit, snap, renderScaleVersion, type Layer } from '../core/view.ts';

const W = VIEW_W;
const H = VIEW_H;
const TAU = Math.PI * 2;

/** Camera y at which each band sits at its designed screen height. */
const REST_Y = 150;

interface Band {
  layer: Layer;
  /** Horizontal parallax factor (0 = fixed to screen, 1 = world). */
  fx: number;
  /** Vertical parallax factor. */
  fy: number;
  /** Designed screen y of the layer's top edge at camera y = REST_Y. */
  y: number;
  /**
   * Colour that continues below the layer's bottom edge — only for bands that
   * are ground mass. A far band of headlands on the sea must NOT fill down,
   * or it paints over the water with a hard horizontal edge.
   */
  under?: string;
}

export interface Backdrop {
  theme: LevelTheme;
  screen: Layer;
  /** Screen layer vertical parallax and its rest offset. */
  screenFy: number;
  bands: Band[];
  /** Solid colour behind everything (overscroll, shake). */
  base: string;
  live: (ctx: CanvasRenderingContext2D, camX: number, camY: number, frame: number, animate: boolean) => void;
  liveDepth: number;
  version: number;
}

function lcg(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** A periodic profile: sum of sines with whole cycles across `period`. */
function profile(x: number, period: number, waves: [number, number, number][]): number {
  let y = 0;
  for (const [k, amp, ph] of waves) y += Math.sin((x / period) * TAU * k + ph) * amp;
  return y;
}

/** Fills a seamless silhouette from `base + profile` down to the layer bottom. */
function silhouette(
  ctx: CanvasRenderingContext2D,
  period: number,
  h: number,
  base: number,
  waves: [number, number, number][],
  fill: string | CanvasGradient,
  step = 4,
): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= period; x += step) ctx.lineTo(x, base - profile(x, period, waves));
  ctx.lineTo(period, h);
  ctx.closePath();
  ctx.fill();
}

/**
 * Lays props left to right across one period and draws each one wrapped.
 * Every prop gets its own seed, so the copy drawn past an edge is identical
 * to the original — a shared RNG would make the two halves of a building
 * straddling the seam disagree.
 */
function row<P extends { w: number; gap: number }>(
  period: number,
  r: () => number,
  next: (r: () => number) => P,
  draw: (x: number, p: P, r: () => number) => void,
): void {
  for (let x = 0; x < period; ) {
    const seed = Math.floor(r() * 1e9) + 1;
    const p = next(r);
    wrap(period, x + p.w / 2, p.w / 2 + 24, (cx) => draw(cx - p.w / 2, p, lcg(seed)));
    x += p.w + p.gap;
  }
}

/** Draws `fn` at x, and again one period left/right when it straddles an edge. */
function wrap(period: number, x: number, halfW: number, fn: (x: number) => void): void {
  fn(x);
  if (x - halfW < 0) fn(x + period);
  if (x + halfW > period) fn(x - period);
}

/* ================================ Duskmere ================================ */

function duskmere(): Backdrop {
  const horizon = 196;
  const sunX = W * 0.62;

  // Screen layer: sky, stuck sun, frozen sea. Taller than the view so the
  // vertical drift never uncovers its edge.
  const screen = makeLayer(W, H + 120);
  {
    const c = screen.ctx;
    const r = lcg(7);
    const sky = c.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#1b1338');
    sky.addColorStop(0.35, '#3d2050');
    sky.addColorStop(0.68, '#93424a');
    sky.addColorStop(0.9, '#e07a3e');
    sky.addColorStop(1, '#f6a54e');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, horizon);
    for (let i = 0; i < 70; i++) {
      const big = r() > 0.93;
      c.globalAlpha = (0.15 + r() * 0.5) * (1 - i / 90);
      c.fillStyle = '#fff6e8';
      c.beginPath();
      c.arc(r() * W, r() * horizon * 0.45, big ? 1.1 : 0.6, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
    // Sun pillar and bloom.
    const pillar = c.createLinearGradient(sunX - 30, 0, sunX + 30, 0);
    pillar.addColorStop(0, 'rgba(255,190,110,0)');
    pillar.addColorStop(0.5, 'rgba(255,200,120,0.16)');
    pillar.addColorStop(1, 'rgba(255,190,110,0)');
    c.fillStyle = pillar;
    c.fillRect(sunX - 30, 20, 60, horizon - 20);
    const bloom = c.createRadialGradient(sunX, horizon - 6, 6, sunX, horizon - 6, 150);
    bloom.addColorStop(0, 'rgba(255,224,150,0.75)');
    bloom.addColorStop(0.25, 'rgba(255,170,90,0.32)');
    bloom.addColorStop(1, 'rgba(255,140,70,0)');
    c.fillStyle = bloom;
    c.fillRect(0, 0, W, horizon + 40);
    c.save();
    c.beginPath();
    c.rect(0, 0, W, horizon);
    c.clip();
    const disc = c.createLinearGradient(0, horizon - 40, 0, horizon);
    disc.addColorStop(0, '#fff4c8');
    disc.addColorStop(1, '#ffc46a');
    c.fillStyle = disc;
    c.beginPath();
    c.arc(sunX, horizon + 6, 38, 0, TAU);
    c.fill();
    // Sun banding: the classic stripes of a sun seen through dusk haze.
    c.fillStyle = 'rgba(232,110,70,0.55)';
    for (let i = 0; i < 4; i++) c.fillRect(sunX - 40, horizon - 4 - i * 7, 80, 1.6 + i * 0.3);
    c.restore();
    // Underlit cirrus bars.
    for (let i = 0; i < 9; i++) {
      const cy = 40 + r() * (horizon - 70);
      const warm = cy / horizon;
      const cw = 60 + r() * 160;
      const cx = r() * W;
      const g = c.createLinearGradient(0, cy - 4, 0, cy + 4);
      g.addColorStop(0, `rgba(255,${120 + warm * 80},${120 + warm * 30},0)`);
      g.addColorStop(1, `rgba(255,${150 + warm * 70},${110 + warm * 20},${0.16 + warm * 0.3})`);
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(cx, cy, cw, 2.5 + warm * 3, 0, 0, TAU);
      c.fill();
    }
    // The frozen sea.
    const sea = c.createLinearGradient(0, horizon, 0, H + 120);
    sea.addColorStop(0, '#d0745a');
    sea.addColorStop(0.08, '#8a4656');
    sea.addColorStop(0.45, '#4a2a52');
    sea.addColorStop(1, '#1d1434');
    c.fillStyle = sea;
    c.fillRect(0, horizon, W, H + 120 - horizon);
    c.fillStyle = 'rgba(255,230,170,0.85)';
    c.fillRect(0, horizon, W, 1);
    // Glitter ruled in neat, impossible rows — light stopped mid-dance.
    for (let row = 0; row < 28; row++) {
      const gy = horizon + 3 + row * row * 0.32 + row * 1.6;
      const depth = row / 28;
      const half = 18 + depth * 110;
      const n = 4 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const gx = sunX + (r() * 2 - 1) * half;
        const len = 4 + r() * (6 + depth * 18);
        c.fillStyle = `rgba(255,${220 - depth * 70},${150 - depth * 50},${0.7 - depth * 0.45})`;
        c.fillRect(gx - len / 2, gy, len, 1 + depth * 1.2);
      }
    }
  }

  // Far band: headlands and a lighthouse, deep in the haze.
  const P1 = 1280;
  const far = makeLayer(P1, 90);
  {
    const c = far.ctx;
    const r = lcg(31);
    silhouette(c, P1, 90, 74, [[2, 10, 0.3], [5, 6, 1.1], [11, 3, 2]], '#7a3a55');
    silhouette(c, P1, 90, 84, [[3, 8, 2.1], [7, 4, 0.4]], '#5f2c4e');
    for (const lx of [310, 930]) {
      wrap(P1, lx, 20, (x) => {
        const top = 84 - profile(x, P1, [[3, 8, 2.1], [7, 4, 0.4]]);
        c.fillStyle = '#4a2242';
        c.fillRect(x - 3, top - 26, 6, 26);
        c.fillStyle = '#efe3d0';
        c.fillRect(x - 3, top - 18, 6, 3);
        c.fillStyle = '#ffd36a';
        c.fillRect(x - 2.5, top - 31, 5, 4);
        const g = c.createRadialGradient(x, top - 29, 1, x, top - 29, 22);
        g.addColorStop(0, 'rgba(255,211,106,0.55)');
        g.addColorStop(1, 'rgba(255,211,106,0)');
        c.fillStyle = g;
        c.fillRect(x - 22, top - 51, 44, 44);
      });
    }
    // Haze line where the land meets the sea.
    const haze = c.createLinearGradient(0, 70, 0, 90);
    haze.addColorStop(0, 'rgba(240,150,100,0)');
    haze.addColorStop(1, 'rgba(240,150,100,0.25)');
    c.fillStyle = haze;
    c.fillRect(0, 70, P1, 20);
    void r;
  }

  // Mid band: dunes and leaning palms, back-lit.
  const P2 = 1100;
  const mid = makeLayer(P2, 170);
  {
    const c = mid.ctx;
    const r = lcg(77);
    const dune: [number, number, number][] = [[2, 16, 0.6], [5, 8, 2.3], [9, 3, 1]];
    const grad = c.createLinearGradient(0, 40, 0, 170);
    grad.addColorStop(0, '#4b2650');
    grad.addColorStop(1, '#2a1638');
    silhouette(c, P2, 170, 118, dune, grad);
    // Rim light on the dune crests facing the sun.
    c.strokeStyle = 'rgba(255,170,110,0.35)';
    c.lineWidth = 1.2;
    c.beginPath();
    for (let x = 0; x <= P2; x += 4) {
      const y = 118 - profile(x, P2, dune) + 0.6;
      if (x === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
    for (let i = 0; i < 7; i++) {
      const px = (i + 0.3 + r() * 0.4) * (P2 / 7);
      const hgt = 46 + r() * 34;
      const lean = (r() - 0.4) * 18;
      const seed = Math.floor(r() * 1e6) + 1;
      wrap(P2, px, 60, (x) => palm(c, x, 118 - profile(x, P2, dune) + 2, hgt, lean, '#2c1736', lcg(seed)));
    }
  }

  // Near band: the dark bank right behind the playfield.
  const P3 = 900;
  const near = makeLayer(P3, 150);
  {
    const c = near.ctx;
    const r = lcg(5);
    const bank: [number, number, number][] = [[3, 12, 2.2], [7, 6, 0.4], [13, 2.5, 1.7]];
    silhouette(c, P3, 150, 92, bank, '#1c1028');
    c.strokeStyle = '#1c1028';
    c.lineWidth = 1.1;
    for (let i = 0; i < 90; i++) {
      const x = r() * P3;
      const y = 92 - profile(x, P3, bank) + 1;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + 1, y - 4, x + (r() - 0.3) * 6, y - 5 - r() * 7);
      c.stroke();
    }
    for (let i = 0; i < 5; i++) {
      const px = r() * P3;
      const hgt = 70 + r() * 30;
      const lean = (r() - 0.4) * 24;
      const seed = Math.floor(r() * 1e6) + 1;
      wrap(P3, px, 60, (x) => palm(c, x, 92 - profile(x, P3, bank) + 2, hgt, lean, '#140a1e', lcg(seed)));
    }
  }

  return {
    theme: 'verdant',
    screen,
    screenFy: 0.05,
    base: '#1b1338',
    bands: [
      { layer: far, fx: 0.08, fy: 0.07, y: horizon - 84 },
      { layer: mid, fx: 0.22, fy: 0.13, y: horizon - 60, under: '#2a1638' },
      { layer: near, fx: 0.42, fy: 0.22, y: horizon + 20, under: '#1c1028' },
    ],
    live: () => {},
    liveDepth: 1,
    version: renderScaleVersion(),
  };
}

/** A back-lit palm: curved trunk and a burst of drooping fronds. */
function palm(c: CanvasRenderingContext2D, x: number, y: number, h: number, lean: number, color: string, r: () => number): void {
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineCap = 'round';
  c.lineWidth = 3.2;
  const tx = x + lean;
  const ty = y - h;
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + lean * 0.2, y - h * 0.6, tx, ty);
  c.stroke();
  const fronds = 7;
  for (let i = 0; i < fronds; i++) {
    const a = Math.PI + (i / (fronds - 1)) * Math.PI + (r() - 0.5) * 0.2;
    const len = 18 + r() * 10;
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.5 + 8;
    c.beginPath();
    c.moveTo(tx, ty);
    c.quadraticCurveTo(tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.6 - 6, ex, ey);
    c.quadraticCurveTo(tx + Math.cos(a) * len * 0.5, ty + Math.sin(a) * len * 0.4 - 2, tx, ty + 1);
    c.fill();
  }
  c.beginPath();
  c.arc(tx, ty + 2, 2.6, 0, TAU);
  c.fill();
}

/* ================================ Foundry ================================= */

function foundry(): Backdrop {
  const horizon = 214;
  const screen = makeLayer(W, H + 120);
  {
    const c = screen.ctx;
    const r = lcg(12);
    const sky = c.createLinearGradient(0, 0, 0, H + 120);
    sky.addColorStop(0, '#06060d');
    sky.addColorStop(0.35, '#121125');
    sky.addColorStop(0.55, '#2a1a2c');
    sky.addColorStop(0.7, '#5a2a22');
    sky.addColorStop(1, '#1a0e12');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H + 120);
    for (let i = 0; i < 60; i++) {
      c.globalAlpha = 0.1 + r() * 0.35;
      c.fillStyle = '#dfe6ff';
      c.fillRect(r() * W, r() * 120, 1, 1);
    }
    c.globalAlpha = 1;
    // A huge moon, half-drowned in smog: midnight that will not end.
    const mx = W * 0.24;
    const my = 92;
    const halo = c.createRadialGradient(mx, my, 20, mx, my, 120);
    halo.addColorStop(0, 'rgba(220,210,255,0.22)');
    halo.addColorStop(1, 'rgba(220,210,255,0)');
    c.fillStyle = halo;
    c.fillRect(0, 0, W, 260);
    c.fillStyle = '#d8d4ee';
    c.beginPath();
    c.arc(mx, my, 34, 0, TAU);
    c.fill();
    c.fillStyle = 'rgba(150,140,190,0.35)';
    for (const [dx, dy, rr] of [
      [-10, -8, 7],
      [8, 6, 9],
      [12, -14, 4],
      [-14, 12, 5],
    ]) {
      c.beginPath();
      c.arc(mx + dx, my + dy, rr, 0, TAU);
      c.fill();
    }
    // Smog bands across the moon.
    for (let i = 0; i < 6; i++) {
      c.fillStyle = `rgba(40,24,40,${0.3 + r() * 0.3})`;
      c.beginPath();
      c.ellipse(r() * W, 70 + i * 20 + r() * 10, 120 + r() * 140, 5 + r() * 5, 0, 0, TAU);
      c.fill();
    }
    // Furnace light from below the horizon.
    const furnace = c.createRadialGradient(W * 0.6, horizon + 70, 10, W * 0.6, horizon + 70, 360);
    furnace.addColorStop(0, 'rgba(255,120,40,0.45)');
    furnace.addColorStop(0.5, 'rgba(255,90,40,0.12)');
    furnace.addColorStop(1, 'rgba(255,90,40,0)');
    c.fillStyle = furnace;
    c.fillRect(0, 0, W, H + 120);
  }

  // Far: a skyline of foundry halls and chimneys, smog-blue.
  const P1 = 1200;
  const far = makeLayer(P1, 160);
  {
    const c = far.ctx;
    const r = lcg(41);
    row(
      P1,
      r,
      (q) => ({ w: 40 + q() * 80, gap: 2 + q() * 10, bh: 40 + q() * 70 }),
      (x, { w, bh }, q) => {
        c.fillStyle = '#2a2134';
        c.fillRect(x, 160 - bh, w, bh);
        // Saw-tooth roof on some halls.
        if (q() > 0.5) {
          c.beginPath();
          for (let sx = x; sx < x + w - 10; sx += 14) {
            c.moveTo(sx, 160 - bh);
            c.lineTo(sx + 14, 160 - bh - 9);
            c.lineTo(sx + 14, 160 - bh);
          }
          c.fill();
        }
        if (q() > 0.4) {
          const cx = x + w * (0.2 + q() * 0.6);
          const ch = 30 + q() * 40;
          c.fillRect(cx - 4, 160 - bh - ch, 8, ch);
          c.fillStyle = 'rgba(255,140,60,0.8)';
          c.fillRect(cx - 4, 160 - bh - ch, 8, 2);
        }
      },
    );
    c.fillStyle = 'rgba(255,170,90,0.5)';
    for (let i = 0; i < 80; i++) c.fillRect(r() * P1, 100 + r() * 56, 2, 1.5);
  }

  // Mid: gantries, pipes and lit windows.
  const P2 = 1000;
  const mid = makeLayer(P2, 200);
  {
    const c = mid.ctx;
    const r = lcg(9);
    row(
      P2,
      r,
      (q) => ({ w: 60 + q() * 90, gap: 6 + q() * 30, top: 70 + q() * 70 }),
      (x, { w, top }, q) => {
        c.fillStyle = '#1a1522';
        c.fillRect(x, top, w, 200 - top);
        for (let wy = top + 8; wy < 190; wy += 12) {
          for (let wx = x + 6; wx < x + w - 8; wx += 10) {
            const lit = q();
            c.fillStyle = lit > 0.82 ? 'rgba(255,180,90,0.85)' : lit > 0.74 ? 'rgba(255,120,60,0.5)' : 'rgba(255,255,255,0.03)';
            c.fillRect(wx, wy, 5, 6);
          }
        }
      },
    );
    // A pipe run threading the halls.
    c.strokeStyle = '#2b2433';
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(0, 150);
    for (let x = 0; x <= P2; x += 100) c.lineTo(x, 150 + (Math.floor(x / 100) % 2 ? -18 : 0));
    c.stroke();
    c.strokeStyle = 'rgba(255,150,80,0.25)';
    c.lineWidth = 1;
    c.stroke();
  }

  // Near: black truss catwalks.
  const P3 = 640;
  const near = makeLayer(P3, 120);
  {
    const c = near.ctx;
    c.fillStyle = '#0c0a12';
    c.fillRect(0, 40, P3, 80);
    c.strokeStyle = '#0c0a12';
    c.lineWidth = 3;
    c.beginPath();
    for (let x = 0; x < P3; x += 32) {
      c.moveTo(x, 40);
      c.lineTo(x + 16, 14);
      c.lineTo(x + 32, 40);
    }
    c.moveTo(0, 14);
    c.lineTo(P3, 14);
    c.stroke();
    c.fillStyle = 'rgba(255,140,60,0.35)';
    c.fillRect(0, 40, P3, 1);
  }

  // Live: three slow giant cogs between the far and mid bands.
  const cogs = [
    { x: 160, y: 120, r: 70, teeth: 14, speed: 0.003, col: '#241d2f' },
    { x: 560, y: 150, r: 44, teeth: 10, speed: -0.0048, col: '#211a2b' },
    { x: 860, y: 90, r: 56, teeth: 12, speed: 0.0036, col: '#1f1929' },
  ];
  const period = 1100;
  return {
    theme: 'gear',
    screen,
    screenFy: 0.04,
    base: '#06060d',
    bands: [
      { layer: far, fx: 0.08, fy: 0.07, y: horizon - 150, under: '#2a2134' },
      { layer: mid, fx: 0.24, fy: 0.13, y: horizon - 90, under: '#1a1522' },
      { layer: near, fx: 0.46, fy: 0.22, y: horizon + 60, under: '#0c0a12' },
    ],
    liveDepth: 1,
    live(ctx, camX, camY, frame, animate) {
      const off = camX * 0.15;
      const oy = horizon - 130 - (camY - REST_Y) * 0.1;
      for (const g of cogs) {
        let x = (((g.x - off) % period) + period) % period;
        if (x > W + g.r) x -= period;
        for (const px of [x, x + period]) {
          if (px < -g.r - 10 || px > W + g.r + 10) continue;
          cog(ctx, px, oy + g.y, g.r, g.teeth, animate ? frame * g.speed : 0, g.col);
        }
      }
    },
    version: renderScaleVersion(),
  };
}

function cog(c: CanvasRenderingContext2D, x: number, y: number, r: number, teeth: number, a: number, col: string): void {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.fillStyle = col;
  c.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * TAU;
    const a1 = a0 + (TAU / teeth) * 0.22;
    const a2 = a0 + (TAU / teeth) * 0.5;
    const a3 = a0 + (TAU / teeth) * 0.72;
    c.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
    c.lineTo(Math.cos(a1) * (r + r * 0.16), Math.sin(a1) * (r + r * 0.16));
    c.lineTo(Math.cos(a2) * (r + r * 0.16), Math.sin(a2) * (r + r * 0.16));
    c.lineTo(Math.cos(a3) * r, Math.sin(a3) * r);
  }
  c.closePath();
  c.arc(0, 0, r * 0.42, 0, TAU, true);
  c.fill('evenodd');
  for (let i = 0; i < 5; i++) {
    const aa = (i / 5) * TAU;
    c.beginPath();
    c.arc(Math.cos(aa) * r * 0.68, Math.sin(aa) * r * 0.68, r * 0.1, 0, TAU);
    c.fillStyle = 'rgba(6,6,13,0.6)';
    c.fill();
  }
  c.restore();
}

/* =============================== Underwhen ================================ */

function underwhen(): Backdrop {
  const screen = makeLayer(W, H + 120);
  {
    const c = screen.ctx;
    const g = c.createLinearGradient(0, 0, 0, H + 120);
    g.addColorStop(0, '#05030c');
    g.addColorStop(0.4, '#120a26');
    g.addColorStop(0.75, '#1d1038');
    g.addColorStop(1, '#0b0618');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H + 120);
    const seam = c.createRadialGradient(W * 0.55, H * 0.9, 10, W * 0.55, H * 0.9, W * 0.7);
    seam.addColorStop(0, 'rgba(80,215,245,0.22)');
    seam.addColorStop(0.5, 'rgba(90,110,230,0.08)');
    seam.addColorStop(1, 'rgba(75,225,255,0)');
    c.fillStyle = seam;
    c.fillRect(0, 0, W, H + 120);
    const counter = c.createRadialGradient(W * 0.1, H * 0.6, 6, W * 0.1, H * 0.6, W * 0.45);
    counter.addColorStop(0, 'rgba(224,90,216,0.18)');
    counter.addColorStop(1, 'rgba(224,90,216,0)');
    c.fillStyle = counter;
    c.fillRect(0, 0, W, H + 120);
  }

  // Far: the cavern's back wall with giant dim crystals.
  const P1 = 1200;
  const far = makeLayer(P1, 300);
  {
    const c = far.ctx;
    const r = lcg(4242);
    // Ceiling teeth across the top.
    c.fillStyle = '#0e0820';
    c.fillRect(0, 0, P1, 20);
    for (let x = 0; x < P1; ) {
      const bw = 14 + r() * 30;
      const d = 20 + r() * 60;
      c.beginPath();
      c.moveTo(x, 18);
      c.lineTo(x + bw, 18);
      c.lineTo(x + bw * 0.45, 18 + d);
      c.closePath();
      c.fill();
      x += bw + r() * 12;
    }
    silhouette(c, P1, 300, 230, [[2, 18, 0.5], [6, 8, 1.4]], '#1a1036');
    for (let i = 0; i < 6; i++) {
      const cx = (i + 0.5) * (P1 / 6) + (r() - 0.5) * 60;
      wrap(P1, cx, 80, (x) => crystalCluster(c, x, 236 - profile(x, P1, [[2, 18, 0.5], [6, 8, 1.4]]), 1.2, '#2a2a63', 'rgba(90,150,240,0.22)', lcg(i * 13 + 1)));
    }
  }

  // Mid: crystal columns and stalagmites.
  const P2 = 980;
  const mid = makeLayer(P2, 220);
  {
    const c = mid.ctx;
    const r = lcg(99);
    const wv: [number, number, number][] = [[3, 14, 2.4], [8, 6, 0.3]];
    silhouette(c, P2, 220, 150, wv, '#140c2b');
    for (let i = 0; i < 5; i++) {
      const cx = (i + 0.4) * (P2 / 5) + (r() - 0.5) * 40;
      wrap(P2, cx, 70, (x) => crystalCluster(c, x, 154 - profile(x, P2, wv), 0.9, '#33306e', 'rgba(80,215,245,0.28)', lcg(i * 7 + 3)));
    }
    for (let i = 0; i < 9; i++) {
      const x = r() * P2;
      const hh = 20 + r() * 40;
      const base = 150 - profile(x, P2, wv) + 4;
      wrap(P2, x, 12, (px) => {
        c.fillStyle = '#140c2b';
        c.beginPath();
        c.moveTo(px - 9, base);
        c.lineTo(px, base - hh);
        c.lineTo(px + 9, base);
        c.closePath();
        c.fill();
      });
    }
  }

  // Near: dark rock with bright crystal tips.
  const P3 = 760;
  const near = makeLayer(P3, 140);
  {
    const c = near.ctx;
    const r = lcg(3);
    const wv: [number, number, number][] = [[4, 10, 1.3], [9, 5, 2.2]];
    silhouette(c, P3, 140, 80, wv, '#0a0616');
    for (let i = 0; i < 10; i++) {
      const x = r() * P3;
      const base = 80 - profile(x, P3, wv) + 2;
      const hh = 8 + r() * 16;
      const tint = r() > 0.6 ? 'rgba(224,90,216,0.75)' : 'rgba(110,230,255,0.75)';
      wrap(P3, x, 20, (px) => {
        const glow = c.createRadialGradient(px, base - hh * 0.6, 1, px, base - hh * 0.6, 18);
        glow.addColorStop(0, tint.replace('0.75', '0.35'));
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = glow;
        c.fillRect(px - 18, base - hh - 18, 36, 36);
        c.fillStyle = tint;
        c.beginPath();
        c.moveTo(px - 3, base);
        c.lineTo(px - 1, base - hh);
        c.lineTo(px + 3, base - hh * 0.4);
        c.lineTo(px + 4, base);
        c.closePath();
        c.fill();
      });
    }
  }

  const motes = Array.from({ length: 34 }, (_, i) => {
    const r = lcg(i * 31 + 7);
    return { x: r() * 900, y: r() * H, sp: 0.15 + r() * 0.35, ph: r() * TAU, pink: r() > 0.7, depth: 0.2 + r() * 0.3 };
  });
  return {
    theme: 'crystal',
    screen,
    screenFy: 0.04,
    base: '#05030c',
    bands: [
      { layer: far, fx: 0.08, fy: 0.08, y: -20, under: '#1a1036' },
      { layer: mid, fx: 0.24, fy: 0.15, y: 90, under: '#140c2b' },
      { layer: near, fx: 0.44, fy: 0.24, y: 230, under: '#0a0616' },
    ],
    liveDepth: 2,
    live(ctx, camX, camY, frame, animate) {
      const t = animate ? frame : 0;
      for (const m of motes) {
        const x = (((m.x - camX * m.depth + Math.sin(t / 90 + m.ph) * 8) % 900) + 900) % 900 - 130;
        const y = (((m.y - t * m.sp - camY * m.depth * 0.5) % H) + H) % H;
        const a = 0.35 + 0.35 * Math.sin(t / 40 + m.ph);
        ctx.fillStyle = m.pink ? `rgba(240,120,230,${a})` : `rgba(140,240,255,${a})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.1, 0, TAU);
        ctx.fill();
      }
    },
    version: renderScaleVersion(),
  };
}

function crystalCluster(
  c: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  scale: number,
  body: string,
  glow: string,
  r: () => number,
): void {
  const bloom = c.createRadialGradient(cx, baseY - 30 * scale, 4, cx, baseY - 30 * scale, 80 * scale);
  bloom.addColorStop(0, glow);
  bloom.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = bloom;
  c.fillRect(cx - 90 * scale, baseY - 120 * scale, 180 * scale, 160 * scale);
  for (let p = 0; p < 3; p++) {
    const off = (p - 1) * (14 + r() * 10) * scale;
    const ph = (34 + r() * 62) * scale;
    const pw = (7 + r() * 9) * scale;
    const tilt = (p - 1) * 0.12;
    c.save();
    c.translate(cx + off, baseY);
    c.rotate(tilt);
    c.fillStyle = body;
    c.beginPath();
    c.moveTo(-pw, 0);
    c.lineTo(-pw * 0.8, -ph * 0.62);
    c.lineTo(0, -ph);
    c.lineTo(pw * 0.8, -ph * 0.62);
    c.lineTo(pw, 0);
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(150,240,255,0.14)';
    c.beginPath();
    c.moveTo(0, -ph);
    c.lineTo(pw * 0.8, -ph * 0.62);
    c.lineTo(pw * 0.45, 0);
    c.lineTo(0, 0);
    c.closePath();
    c.fill();
    c.restore();
  }
}

/* ============================== Noon Tomorrow ============================= */

function tomorrow(): Backdrop {
  const screen = makeLayer(W, H + 120);
  {
    const c = screen.ctx;
    const r = lcg(2026);
    const sky = c.createLinearGradient(0, 0, 0, H + 120);
    sky.addColorStop(0, '#f2e2bc');
    sky.addColorStop(0.18, '#e4ad92');
    sky.addColorStop(0.42, '#a5658f');
    sky.addColorStop(0.66, '#4d3166');
    sky.addColorStop(1, '#1d1230');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H + 120);
    const sx = W * 0.5;
    const sy = 26;
    const glow = c.createRadialGradient(sx, sy, 2, sx, sy, 90);
    glow.addColorStop(0, 'rgba(255,253,240,0.95)');
    glow.addColorStop(0.2, 'rgba(255,240,205,0.35)');
    glow.addColorStop(1, 'rgba(255,240,205,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, W, 140);
    c.fillStyle = '#fffdf4';
    c.beginPath();
    c.arc(sx, sy, 8, 0, TAU);
    c.fill();
    for (let i = 0; i < 5; i++) {
      c.fillStyle = `rgba(255,245,228,${0.05 + r() * 0.05})`;
      c.fillRect(0, 60 + i * 22 + r() * 8, W, 2 + r() * 3);
    }
  }

  // Far: pale haze towers.
  const P1 = 1300;
  const far = makeLayer(P1, 240);
  {
    const c = far.ctx;
    const r = lcg(808);
    row(
      P1,
      r,
      (q) => ({ w: 26 + q() * 44, gap: 3 + q() * 6, bh: 80 + q() * 130, mast: q() > 0.6 }),
      (x, { w, bh, mast }) => {
        c.fillStyle = '#8b6697';
        c.fillRect(x, 240 - bh, w, bh);
        if (mast) c.fillRect(x + w / 2 - 1, 240 - bh - 20, 2, 20);
      },
    );
    const haze = c.createLinearGradient(0, 120, 0, 240);
    haze.addColorStop(0, 'rgba(165,101,143,0)');
    haze.addColorStop(1, 'rgba(165,101,143,0.55)');
    c.fillStyle = haze;
    c.fillRect(0, 120, P1, 120);
  }

  // Mid: the skyline with its sky-rail and the frozen countdown.
  const P2 = 1600;
  const mid = makeLayer(P2, 260);
  {
    const c = mid.ctx;
    const r = lcg(4040);
    const tops: { x: number; w: number; top: number }[] = [];
    row(
      P2,
      r,
      (q) => ({ w: 36 + q() * 56, gap: 4 + q() * 8, top: 70 + q() * 90 }),
      (x, { w, top }, q) => {
        if (x >= 0 && x < P2) tops.push({ x, w, top });
        c.fillStyle = '#3f2a57';
        c.fillRect(x, top, w, 260 - top);
        for (let i = 0; i < 10; i++) {
          if (q() > 0.6) continue;
          c.fillStyle = q() > 0.5 ? 'rgba(65,240,255,0.7)' : 'rgba(255,220,150,0.7)';
          c.fillRect(x + 3 + q() * (w - 7), top + 4 + q() * (240 - top), 2, 2);
        }
      },
    );
    // Sky-rail ribbon with stopped traffic streaks.
    const rail = (base: number, amp: number, k: number, ph: number, tint: string) => {
      c.strokeStyle = 'rgba(230,220,245,0.45)';
      c.lineWidth = 1.6;
      c.beginPath();
      for (let x = 0; x <= P2; x += 8) {
        const y = base + Math.sin((x / P2) * TAU * k + ph) * amp;
        if (x === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
      for (let i = 0; i < 9; i++) {
        const tx = r() * P2;
        const ty = base + Math.sin((tx / P2) * TAU * k + ph) * amp;
        const len = 12 + r() * 20;
        const g = c.createLinearGradient(tx - len, ty, tx, ty);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, tint);
        c.fillStyle = g;
        c.fillRect(tx - len, ty - 1.2, len, 2.4);
        c.fillStyle = '#fff';
        c.fillRect(tx - 1, ty - 1.2, 2, 2.4);
      }
    };
    rail(120, 14, 2, 0.8, 'rgba(65,240,255,0.9)');
    // One countdown billboard per period, mounted on the tallest tower.
    const host = tops.reduce((a, b) => (b.top < a.top ? b : a), tops[0]);
    const bx = host.x + host.w / 2;
    wrap(P2, bx, 70, (x) => countdown(c, x, Math.max(48, host.top - 10)));
  }

  // Near: black towers wearing the neon.
  const P3 = 1000;
  const near = makeLayer(P3, 220);
  {
    const c = near.ctx;
    const r = lcg(77);
    row(
      P3,
      r,
      (q) => ({ w: 50 + q() * 60, gap: 10 + q() * 24, top: 40 + q() * 80 }),
      (x, { w, top }, q) => {
        c.fillStyle = '#150d24';
        c.fillRect(x, top, w, 220 - top);
        const edge = q() > 0.5 ? x + 1 : x + w - 2.6;
        c.fillStyle = q() > 0.5 ? 'rgba(255,79,168,0.85)' : 'rgba(65,240,255,0.85)';
        c.fillRect(edge, top + 2, 1.6, (220 - top) * (0.4 + q() * 0.5));
        for (let wy = top + 8; wy < 214; wy += 10) {
          for (let wx = x + 6; wx < x + w - 6; wx += 9) {
            const lit = q();
            c.fillStyle = lit > 0.88 ? 'rgba(255,235,170,0.75)' : lit > 0.8 ? 'rgba(120,230,255,0.45)' : 'rgba(255,255,255,0.05)';
            c.fillRect(wx, wy, 3.5, 4.5);
          }
        }
        if (q() > 0.45) {
          const ax = x + 8 + q() * (w - 16);
          c.fillStyle = '#0d0818';
          c.fillRect(ax - 1, top - 16, 2, 16);
          c.fillStyle = 'rgba(255,80,110,0.95)';
          c.beginPath();
          c.arc(ax, top - 17, 1.8, 0, TAU);
          c.fill();
        }
      },
    );
  }

  return {
    theme: 'neon',
    screen,
    screenFy: 0.03,
    base: '#1d1230',
    bands: [
      { layer: far, fx: 0.07, fy: 0.06, y: 0, under: '#8b6697' },
      { layer: mid, fx: 0.2, fy: 0.12, y: 50, under: '#3f2a57' },
      { layer: near, fx: 0.44, fy: 0.22, y: 150, under: '#150d24' },
    ],
    live: () => {},
    liveDepth: 1,
    version: renderScaleVersion(),
  };
}

/** "TOMORROW IN 00:00:01" — the biome's thesis, frozen one second short. */
function countdown(c: CanvasRenderingContext2D, x: number, y: number): void {
  const w = 120;
  const h = 44;
  const bloom = c.createRadialGradient(x, y, 4, x, y, 100);
  bloom.addColorStop(0, 'rgba(255,79,168,0.3)');
  bloom.addColorStop(1, 'rgba(255,79,168,0)');
  c.fillStyle = bloom;
  c.fillRect(x - 100, y - 80, 200, 160);
  c.fillStyle = '#8a8098';
  c.fillRect(x - 10, y + h / 2, 4, 14);
  c.fillRect(x + 6, y + h / 2, 4, 14);
  c.fillStyle = '#0b0716';
  c.beginPath();
  c.roundRect(x - w / 2, y - h / 2, w, h, 4);
  c.fill();
  c.strokeStyle = 'rgba(255,79,168,0.95)';
  c.lineWidth = 2;
  c.stroke();
  c.textAlign = 'center';
  c.font = '700 8px system-ui, sans-serif';
  c.fillStyle = 'rgba(160,235,255,0.9)';
  c.fillText('TOMORROW IN', x, y - 8);
  c.font = '800 20px ui-monospace, Consolas, monospace';
  c.fillStyle = '#41f0ff';
  c.fillText('00:00:01', x, y + 13);
  c.textAlign = 'left';
  c.fillStyle = 'rgba(0,0,0,0.25)';
  for (let sy = y - h / 2 + 2; sy < y + h / 2; sy += 3) c.fillRect(x - w / 2 + 2, sy, w - 4, 1);
}

/* ================================= Public ================================= */

const BUILDERS: Record<LevelTheme, () => Backdrop> = {
  verdant: duskmere,
  gear: foundry,
  crystal: underwhen,
  neon: tomorrow,
};

export function buildBackdrop(theme: LevelTheme): Backdrop {
  return BUILDERS[theme]();
}

/** Rebuilds the backdrop if the render scale changed since it was baked. */
export function freshBackdrop(bd: Backdrop): Backdrop {
  return bd.version === renderScaleVersion() ? bd : buildBackdrop(bd.theme);
}

/**
 * Draws the whole backdrop in screen space. `camX/camY` are the world camera;
 * `sx/sy` the screen-shake offset (the backdrop shakes less than the world,
 * which is what sells it as far away).
 */
export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  bd: Backdrop,
  camX: number,
  camY: number,
  frame: number,
  animate: boolean,
  sx = 0,
  sy = 0,
): void {
  ctx.fillStyle = bd.base;
  ctx.fillRect(0, 0, W, H);
  const dy = camY - REST_Y;
  blit(ctx, bd.screen, snap(sx * 0.2), snap(-60 - dy * bd.screenFy + sy * 0.2));
  bd.bands.forEach((b, i) => {
    if (i === bd.liveDepth) bd.live(ctx, camX, camY, frame, animate);
    const y = snap(b.y - dy * b.fy + sy * (0.3 + b.fx));
    const pw = b.layer.w;
    let x = -((((camX * b.fx - sx * b.fx) % pw) + pw) % pw);
    for (; x < W; x += pw) blit(ctx, b.layer, snap(x), y);
    const bottom = y + b.layer.h;
    if (b.under && bottom < H) {
      ctx.fillStyle = b.under;
      ctx.fillRect(0, bottom - 0.5, W, H - bottom + 1);
    }
  });
  if (bd.liveDepth >= bd.bands.length) bd.live(ctx, camX, camY, frame, animate);
}
