import { PAL } from './painter.ts';
import { makeLayer, blit, renderScale, renderScaleVersion, type Layer as Surface } from '../core/view.ts';
import { drawText, measureText } from './font.ts';

/**
 * Title-screen art: the animated backdrop, BOLT's key-art pose and the
 * wordmark treatment. It lives here rather than in TitleScene so the scene
 * stays a small input state machine and all the heavy procedural drawing sits
 * with the rest of the render layer.
 *
 * The backdrop is pre-rendered once into a few layer canvases that are
 * PERIODIC over the canvas width, so scrolling them is two blits with no
 * visible seam — a title screen that re-draws mountains and trees every frame
 * costs more than the game itself does.
 *
 * Deterministic throughout: placement comes from a seeded LCG (same idiom as
 * painter/decor) and motion from the frame counter. No Math.random anywhere.
 */

/** The canvas is a fixed 640x360 backbuffer; the composition is authored for it. */
const W = 640;
const H = 360;

/** Screen y of the foreground surface BOLT runs on — the scene poses him on it. */
export const TITLE_GROUND_Y = 286;

/** Sunken Chrono Core burning on the horizon: the light source for the scene. */
const SUN_X = 460;
const SUN_Y = 190;

interface Layer {
  cv: Surface;
  /** Where the strip's top edge lands on screen. */
  y: number;
  /** Parallax scroll, px per frame. */
  speed: number;
}

export interface TitleBackdrop {
  sky: Surface;
  layers: Layer[];
  /** Render-scale version the layers were baked at. */
  version: number;
}

function lcg(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Offscreen strip baked at the device render scale (see core/view.ts). */
function surface(w: number, h: number): CanvasRenderingContext2D & { layer: Surface } {
  const layer = makeLayer(w, h);
  return Object.assign(layer.ctx, { layer });
}

/* ------------------------------- Backdrop --------------------------------- */

export function renderTitleBackdrop(): TitleBackdrop {
  return {
    sky: renderSky(),
    layers: [
      { cv: renderRidge(), y: 150, speed: 0.05 },
      { cv: renderHills(), y: 224, speed: 0.18 },
      { cv: renderTreeline(), y: 200, speed: 0.55 },
      { cv: renderGround(), y: TITLE_GROUND_Y, speed: 2.2 },
    ],
    version: renderScaleVersion(),
  };
}

/** Re-bakes the backdrop when the window moved to another render scale. */
export function freshTitleBackdrop(bd: TitleBackdrop): TitleBackdrop {
  return bd.version === renderScaleVersion() ? bd : renderTitleBackdrop();
}

export function drawTitleBackdrop(
  ctx: CanvasRenderingContext2D,
  bd: TitleBackdrop,
  frame: number,
  reduced: boolean,
): void {
  blit(ctx, bd.sky, 0, 0);
  drawCoreSun(ctx, frame, reduced);
  for (const l of bd.layers) {
    // Every layer tiles over exactly W, so two blits always cover the screen.
    const off = reduced ? 0 : (frame * l.speed) % W;
    blit(ctx, l.cv, -off, l.y);
    blit(ctx, l.cv, -off + W, l.y);
  }
  drawMotes(ctx, reduced ? 0 : frame);
  if (!reduced) {
    drawSpeedStreaks(ctx, frame);
    drawChronoStutter(ctx, frame);
  }
  drawVignette(ctx);
}

function renderSky(): Surface {
  const ctx = surface(W, H);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#04050e');
  sky.addColorStop(0.22, '#080e28');
  sky.addColorStop(0.42, '#1a1642');
  sky.addColorStop(0.56, '#3d2050');
  sky.addColorStop(0.66, '#7e3550');
  sky.addColorStop(0.75, '#c9713f');
  sky.addColorStop(0.85, '#f0a94f');
  sky.addColorStop(1, '#f6c169');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Stars, thinning out towards the lit horizon.
  const rnd = lcg(4211);
  for (let i = 0; i < 130; i++) {
    const x = rnd() * W;
    const y = rnd() * 210;
    const big = rnd() > 0.9;
    ctx.globalAlpha = (0.15 + rnd() * 0.6) * (1 - y / 260);
    ctx.fillStyle = rnd() > 0.85 ? '#bfe6ff' : '#ffffff';
    ctx.fillRect(x, y, big ? 2 : 1, big ? 2 : 1);
  }
  ctx.globalAlpha = 1;

  // Chrono aurora: the stolen Core makes time ripple, so the sky does too.
  for (let band = 0; band < 3; band++) {
    const baseY = 46 + band * 34;
    const tint = band === 1 ? '186,110,255' : '75,225,255';
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, `rgba(${tint},0)`);
    g.addColorStop(0.35, `rgba(${tint},0.13)`);
    g.addColorStop(0.62, `rgba(${tint},0.05)`);
    g.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= W; x += 16) {
      ctx.lineTo(x, baseY + Math.sin((x / W) * Math.PI * 2 + band) * 9);
    }
    for (let x = W; x >= 0; x -= 16) {
      ctx.lineTo(x, baseY + 16 + band * 5 + Math.sin((x / W) * Math.PI * 2 + band) * 9);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Horizon haze pooling under the mountains.
  const haze = ctx.createLinearGradient(0, 168, 0, 292);
  haze.addColorStop(0, 'rgba(255,180,110,0)');
  haze.addColorStop(0.55, 'rgba(255,170,100,0.16)');
  haze.addColorStop(1, 'rgba(255,150,90,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 168, W, 124);
  return ctx.layer;
}

/** Far mountains: one self-contained peak per cell, so the strip wraps cleanly. */
function renderRidge(): Surface {
  const h = 130;
  const ctx = surface(W, h);
  const rnd = lcg(881);
  const cells = 7;
  const cell = W / cells;
  for (let i = 0; i < cells; i++) {
    const cx = (i + 0.5) * cell;
    const hw = cell * 0.36 + rnd() * cell * 0.12;
    const peak = h - 50 - rnd() * 46;
    ctx.fillStyle = '#101a34';
    ctx.beginPath();
    ctx.moveTo(cx - hw, h);
    ctx.lineTo(cx, peak);
    ctx.lineTo(cx + hw, h);
    ctx.closePath();
    ctx.fill();
    // Sun-facing flank catches the horizon light.
    ctx.fillStyle = 'rgba(255,170,110,0.13)';
    ctx.beginPath();
    ctx.moveTo(cx, peak);
    ctx.lineTo(cx + hw, h);
    ctx.lineTo(cx + hw * 0.45, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#101a34';
  ctx.fillRect(0, h - 10, W, 10);
  return ctx.layer;
}

/** Mid hills with crystal spires — a nod to the vault under the coast. */
function renderHills(): Surface {
  const h = 76;
  const ctx = surface(W, h);
  const line = (x: number) =>
    26 - 11 * Math.sin((x / W) * Math.PI * 2) - 6 * Math.sin((x / W) * Math.PI * 4 + 1.1) - 3 * Math.sin((x / W) * Math.PI * 6 + 2.3);

  const rnd = lcg(1597);
  // Spires first: they rise out of the hills, so the hill body buries their feet.
  for (let i = 0; i < 6; i++) {
    const x = (i + 0.5) * (W / 6) + (rnd() - 0.5) * 20;
    const tall = 16 + rnd() * 22;
    const wide = 3 + rnd() * 3;
    const base = line(x) + 4;
    ctx.fillStyle = 'rgba(75,225,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(x, base - tall);
    ctx.lineTo(x + wide, base);
    ctx.lineTo(x - wide, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(180,245,255,0.22)';
    ctx.fillRect(x - 0.6, base - tall, 1.2, tall * 0.6);
  }

  ctx.fillStyle = '#16243f';
  ctx.beginPath();
  ctx.moveTo(0, line(0));
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, line(x));
  ctx.lineTo(W, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(120,190,255,0.20)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, line(0));
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, line(x));
  ctx.stroke();
  return ctx.layer;
}

/** Near treeline in near-black silhouette, standing on the running surface. */
function renderTreeline(): Surface {
  const h = 120;
  const ctx = surface(W, h);
  const ground = TITLE_GROUND_Y - 200; // local y of the surface the trees stand on
  const rnd = lcg(3307);

  const cells = 8;
  const cell = W / cells;
  for (let i = 0; i < cells; i++) {
    const x = (i + 0.5) * cell + (rnd() - 0.5) * cell * 0.4;
    if (rnd() > 0.72) {
      // Boulder.
      const r = 6 + rnd() * 7;
      ctx.fillStyle = '#080d1a';
      ctx.beginPath();
      ctx.ellipse(x, ground, r, r * 0.7, 0, Math.PI, 0);
      ctx.fill();
      continue;
    }
    // Pine: stacked triangles, tallest tier first.
    const tall = 38 + rnd() * 30;
    const wide = 9 + rnd() * 5;
    ctx.fillStyle = '#060a16';
    ctx.fillRect(x - 1.5, ground - 8, 3, 8);
    for (let tier = 0; tier < 3; tier++) {
      const top = ground - tall + tier * (tall * 0.24);
      const spread = wide * (0.62 + tier * 0.19);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x + spread, ground - 6 - (2 - tier) * 4);
      ctx.lineTo(x - spread, ground - 6 - (2 - tier) * 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Undergrowth line so the trees are rooted rather than floating.
  ctx.fillStyle = '#060a16';
  ctx.beginPath();
  ctx.moveTo(0, ground - 3);
  for (let x = 0; x <= W; x += 10) {
    ctx.lineTo(x, ground - 3 - 3 * Math.sin((x / W) * Math.PI * 4 + 0.7));
  }
  ctx.lineTo(W, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  return ctx.layer;
}

/** The strip BOLT runs on: fastest layer, so it carries most of the speed read. */
function renderGround(): Surface {
  const h = H - TITLE_GROUND_Y;
  const ctx = surface(W, h);
  const body = ctx.createLinearGradient(0, 0, 0, h);
  body.addColorStop(0, '#16382a');
  body.addColorStop(0.35, '#0e2320');
  body.addColorStop(1, '#05080f');
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, W, h);

  // Muted cap: a bright grass line across the full width pulls the eye away
  // from the logo and the hero, which is exactly backwards.
  ctx.fillStyle = '#256f45';
  ctx.fillRect(0, 0, W, 4);
  ctx.fillStyle = 'rgba(150,255,200,0.14)';
  ctx.fillRect(0, 0, W, 1);

  const rnd = lcg(6113);
  // Tufts on the lip.
  for (let i = 0; i < 90; i++) {
    const x = rnd() * W;
    const tall = 3 + rnd() * 5;
    ctx.fillStyle = rnd() > 0.6 ? '#256f45' : '#184e30';
    ctx.beginPath();
    ctx.moveTo(x, 4);
    ctx.lineTo(x + 1.6, 4 - tall);
    ctx.lineTo(x + 3.2, 4);
    ctx.closePath();
    ctx.fill();
  }
  // Ground streaks: horizontal dashes that smear into speed once it scrolls.
  for (let i = 0; i < 60; i++) {
    const x = rnd() * W;
    const y = 8 + rnd() * (h - 12);
    ctx.globalAlpha = 0.05 + rnd() * 0.07;
    ctx.fillStyle = rnd() > 0.7 ? '#ffd08a' : '#9fe4ff';
    ctx.fillRect(x, y, 12 + rnd() * 40, 1);
  }
  ctx.globalAlpha = 1;
  return ctx.layer;
}

function drawCoreSun(ctx: CanvasRenderingContext2D, frame: number, reduced: boolean): void {
  const spin = reduced ? 0.4 : frame / 260;
  ctx.save();
  ctx.translate(SUN_X, SUN_Y);
  ctx.rotate(spin);
  // God rays fade with distance: a hard-edged wedge reads as a grey triangle
  // pasted on the sky, a fading one reads as light.
  const ray = ctx.createRadialGradient(0, 0, 8, 0, 0, 200);
  ray.addColorStop(0, 'rgba(255,208,138,0.20)');
  ray.addColorStop(0.45, 'rgba(255,190,120,0.07)');
  ray.addColorStop(1, 'rgba(255,170,100,0)');
  ctx.fillStyle = ray;
  for (let i = 0; i < 14; i++) {
    ctx.rotate((Math.PI * 2) / 14);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(200, -11);
    ctx.lineTo(200, 11);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  const glow = ctx.createRadialGradient(SUN_X, SUN_Y, 4, SUN_X, SUN_Y, 110);
  glow.addColorStop(0, 'rgba(255,214,140,0.55)');
  glow.addColorStop(0.35, 'rgba(255,150,90,0.18)');
  glow.addColorStop(1, 'rgba(255,120,70,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(SUN_X - 110, SUN_Y - 110, 220, 220);

  ctx.fillStyle = '#ffcf7c';
  ctx.beginPath();
  ctx.arc(SUN_X, SUN_Y, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff2cf';
  ctx.beginPath();
  ctx.arc(SUN_X - 4, SUN_Y - 5, 12, 0, Math.PI * 2);
  ctx.fill();

  // Crystal shards orbiting the Core, the campaign's collectible motif.
  const orbit = reduced ? 0 : frame / 90;
  ctx.fillStyle = 'rgba(75,225,255,0.7)';
  for (let i = 0; i < 5; i++) {
    const a = orbit + (i / 5) * Math.PI * 2;
    ctx.save();
    ctx.translate(SUN_X + Math.cos(a) * 44, SUN_Y + Math.sin(a) * 15);
    ctx.rotate(a);
    ctx.fillRect(-1.5, -4, 3, 8);
    ctx.restore();
  }
}

interface Mote {
  x: number;
  y: number;
  r: number;
  speed: number;
  phase: number;
  warm: boolean;
}

const MOTES: Mote[] = (() => {
  const rnd = lcg(9173);
  const out: Mote[] = [];
  for (let i = 0; i < 34; i++) {
    out.push({
      x: rnd() * W,
      y: 40 + rnd() * 250,
      r: 0.8 + rnd() * 1.7,
      speed: 0.25 + rnd() * 1.1,
      phase: rnd() * Math.PI * 2,
      warm: rnd() > 0.62,
    });
  }
  return out;
})();

function drawMotes(ctx: CanvasRenderingContext2D, frame: number): void {
  const span = W + 20;
  for (const m of MOTES) {
    const x = (((m.x - frame * m.speed) % span) + span) % span - 10;
    const tw = 0.5 + 0.5 * Math.sin(frame / 22 + m.phase);
    ctx.globalAlpha = 0.2 + tw * 0.5;
    ctx.fillStyle = m.warm ? '#ffd08a' : PAL.crystal;
    ctx.beginPath();
    ctx.arc(x, m.y + Math.sin(frame / 40 + m.phase) * 4, m.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSpeedStreaks(ctx: CanvasRenderingContext2D, frame: number): void {
  ctx.save();
  ctx.lineCap = 'round';
  const span = W + 320;
  for (let i = 0; i < 6; i++) {
    const x = W + 140 - (((frame * (6 + i * 1.4) + i * 173) % span) + span) % span;
    const y = 198 + ((i * 37) % 92);
    const len = 40 + (i % 3) * 26;
    ctx.strokeStyle = i % 2 ? 'rgba(120,220,255,0.16)' : 'rgba(255,214,150,0.13)';
    ctx.lineWidth = i % 3 === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Time is stuttering — that is the whole premise — so every few seconds the
 * image tears into displaced slices for a handful of frames. Slicing the
 * canvas back onto itself keeps it free: no extra buffers, no per-frame art.
 */
function drawChronoStutter(ctx: CanvasRenderingContext2D, frame: number): void {
  const phase = frame % 214;
  if (phase > 5) return;
  const fade = 1 - phase / 6;
  const bands: [number, number, number][] = [
    [58, 16, -7],
    [148, 11, 9],
    [236, 13, -5],
  ];
  // The source rect is in DEVICE pixels (the backing store), the
  // destination in logical ones (the context carries the render scale).
  const s = renderScale();
  for (const [by, bh, dx] of bands) {
    ctx.drawImage(ctx.canvas, 0, by * s, W * s, bh * s, Math.round(dx * fade), by, W, bh);
  }
  ctx.globalAlpha = 0.09 * fade;
  ctx.fillStyle = PAL.crystal;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

function drawVignette(ctx: CanvasRenderingContext2D): void {
  const v = ctx.createRadialGradient(320, 168, 110, 320, 180, 330);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(2,3,10,0.6)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);

  // The bottom band carries the control bar, so it is darkened for contrast.
  const b = ctx.createLinearGradient(0, 288, 0, H);
  b.addColorStop(0, 'rgba(5,6,14,0)');
  b.addColorStop(0.35, 'rgba(5,6,14,0.7)');
  b.addColorStop(1, 'rgba(5,6,14,0.92)');
  ctx.fillStyle = b;
  ctx.fillRect(0, 288, W, H - 288);
}

/* --------------------------------- Hero ----------------------------------- */

/* --------------------------------- Logo ----------------------------------- */

/**
 * Wordmark: an extruded, sheared "BOLT" over a backlight, with the sub-title
 * on a chevron plate. `y` is the wordmark baseline.
 */
export function drawTitleLogo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  frame: number,
  reduced: boolean,
): void {
  const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(frame / 48);

  const glow = ctx.createRadialGradient(cx, y - 18, 6, cx, y - 18, 120);
  glow.addColorStop(0, `rgba(64,150,255,${0.2 + pulse * 0.1})`);
  glow.addColorStop(0.55, 'rgba(40,90,190,0.10)');
  glow.addColorStop(1, 'rgba(40,90,190,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 132, y - 94, 264, 156);

  ctx.save();
  ctx.globalAlpha = 0.16 + pulse * 0.06;
  boltGlyph(ctx, cx + 96, y - 26, 3.2, PAL.crystal);
  ctx.globalAlpha = 0.1;
  boltGlyph(ctx, cx - 98, y - 32, 2.2, PAL.crystal);
  ctx.restore();

  // The wordmark: BOLT Display, extruded toward the lower right, with a
  // heavy keyline so it holds against the moving sky, and a specular sweep.
  const word = 'BOLT';
  const size = 50;
  for (let d = 7; d >= 1; d--) {
    drawText(ctx, word, cx + d * 0.9, y + d, { size, fill: d > 3 ? '#050b1c' : '#0d2352', align: 'center', outline: d > 3 ? '#050b1c' : '#0d2352', outlineWidth: 4 });
  }
  const body = ctx.createLinearGradient(0, y - size, 0, y);
  body.addColorStop(0, '#eef8ff');
  body.addColorStop(0.32, '#8ad6ff');
  body.addColorStop(0.55, '#2f7df6');
  body.addColorStop(0.88, '#1a4fb8');
  body.addColorStop(1, '#5fb4ff');
  drawText(ctx, word, cx, y, { size, fill: body, outline: '#040814', outlineWidth: 4, align: 'center' });
  if (!reduced) {
    const ww = measureText(word, size);
    const sweep = ((frame % 280) / 280) * (ww + 140) - 70 - ww / 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx + sweep - 10, y - size - 8);
    ctx.lineTo(cx + sweep + 12, y - size - 8);
    ctx.lineTo(cx + sweep + 26, y + 8);
    ctx.lineTo(cx + sweep + 4, y + 8);
    ctx.closePath();
    ctx.clip();
    drawText(ctx, word, cx, y, { size, fill: 'rgba(255,255,255,0.55)', align: 'center' });
    ctx.restore();
  }

  // Sub-title plate.
  const rw = 196;
  const rh = 24;
  const rx = cx - rw / 2;
  const ry = y + 12;
  ctx.beginPath();
  ctx.moveTo(rx + 9, ry);
  ctx.lineTo(rx + rw - 9, ry);
  ctx.lineTo(rx + rw, ry + rh / 2);
  ctx.lineTo(rx + rw - 9, ry + rh);
  ctx.lineTo(rx + 9, ry + rh);
  ctx.lineTo(rx, ry + rh / 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(6,10,22,0.86)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(75,225,255,0.75)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  drawText(ctx, 'CHRONO RUSH', cx, ry + rh / 2 + 4.5, { size: 9, fill: PAL.crystal, align: 'center', tracking: 1.2 });
  boltGlyph(ctx, rx + 14, ry + rh / 2, 0.6, PAL.crystal);
  boltGlyph(ctx, rx + rw - 14, ry + rh / 2, 0.6, PAL.crystal);
}

function boltGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(1.5, -10);
  ctx.lineTo(-6, 1);
  ctx.lineTo(-1, 1);
  ctx.lineTo(-2.5, 10);
  ctx.lineTo(6, -2);
  ctx.lineTo(1, -2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
