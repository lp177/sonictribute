import { PAL } from './painter.ts';

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
  cv: HTMLCanvasElement;
  /** Where the strip's top edge lands on screen. */
  y: number;
  /** Parallax scroll, px per frame. */
  speed: number;
}

export interface TitleBackdrop {
  sky: HTMLCanvasElement;
  layers: Layer[];
}

function lcg(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function surface(w: number, h: number): CanvasRenderingContext2D {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return cv.getContext('2d')!;
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
  };
}

export function drawTitleBackdrop(
  ctx: CanvasRenderingContext2D,
  bd: TitleBackdrop,
  frame: number,
  reduced: boolean,
): void {
  ctx.drawImage(bd.sky, 0, 0);
  drawCoreSun(ctx, frame, reduced);
  for (const l of bd.layers) {
    // Every layer tiles over exactly W, so two blits always cover the screen.
    const off = reduced ? 0 : (frame * l.speed) % W;
    ctx.drawImage(l.cv, -off, l.y);
    ctx.drawImage(l.cv, -off + W, l.y);
  }
  drawMotes(ctx, reduced ? 0 : frame);
  if (!reduced) {
    drawSpeedStreaks(ctx, frame);
    drawChronoStutter(ctx, frame);
  }
  drawVignette(ctx);
}

function renderSky(): HTMLCanvasElement {
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
  return ctx.canvas;
}

/** Far mountains: one self-contained peak per cell, so the strip wraps cleanly. */
function renderRidge(): HTMLCanvasElement {
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
  return ctx.canvas;
}

/** Mid hills with crystal spires — a nod to the vault under the coast. */
function renderHills(): HTMLCanvasElement {
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
  return ctx.canvas;
}

/** Near treeline in near-black silhouette, standing on the running surface. */
function renderTreeline(): HTMLCanvasElement {
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
  return ctx.canvas;
}

/** The strip BOLT runs on: fastest layer, so it carries most of the speed read. */
function renderGround(): HTMLCanvasElement {
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
  return ctx.canvas;
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
  for (const [by, bh, dx] of bands) {
    ctx.drawImage(ctx.canvas, 0, by, W, bh, Math.round(dx * fade), by, W, bh);
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

/**
 * BOLT as a key-art piece: a full sprint, drawn in the same design language as
 * the in-game hero (blue body, cream muzzle and chest, red shoes, lightning
 * tail, swept ear tufts) but bigger, leaning into the run and trailing
 * afterimages, dust and wind.
 *
 * `x`/`y` is the ground contact point; the whole figure is ~64 units tall
 * before `scale`.
 */
export function drawTitleHero(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  frame: number,
  reduced: boolean,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const spin = frame / 2.6;
  const bob = reduced ? 0 : Math.sin(spin * 2) * 1.1;

  ctx.fillStyle = 'rgba(3,5,12,0.45)';
  ctx.beginPath();
  ctx.ellipse(-1, 1, 19, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!reduced) {
    heroDust(ctx, frame);
    heroGhost(ctx, -11, 0.16);
    heroGhost(ctx, -22, 0.08);
    heroWind(ctx, frame);
  }

  if (reduced) plantedLegs(ctx);
  else runWheel(ctx, spin);

  const swing = reduced ? 0 : Math.sin(spin);
  ctx.save();
  ctx.translate(0, -17 + bob);
  ctx.rotate(0.17); // forward lean — the pose has to read as SPEED at a glance
  heroTail(ctx, frame, reduced);
  // Shoulders sit on the torso's top corners so the gloves swing OUTSIDE the
  // silhouette — an arm ending inside the chest just reads as a stray blob.
  heroArm(ctx, -5, -14, 3.05 + swing * 0.35, 10.5, '#2a63cc', '#cbb894');
  heroTorso(ctx);
  heroArm(ctx, 5, -13.5, 0.35 - swing * 0.5, 11, PAL.heroBlue, PAL.heroCream);
  heroHead(ctx, frame, reduced);
  ctx.restore();

  if (!reduced) heroSpark(ctx, frame);
  ctx.restore();
}

function heroGhost(ctx: CanvasRenderingContext2D, dx: number, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = PAL.heroBlue;
  ctx.translate(dx, 0);
  ctx.beginPath();
  ctx.roundRect(-10, -34, 20, 20, 9);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -45, 10, 9.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -8, 13, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The classic sprint read: the legs blur into a wheel and only the shoes land. */
function runWheel(ctx: CanvasRenderingContext2D, spin: number): void {
  const rx = 11.5;
  const ry = 6.5;
  const cy = -9;
  ctx.save();
  ctx.fillStyle = 'rgba(47,125,246,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(196,231,255,0.32)';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(0, cy, rx, ry, 0, spin, spin + 2.2);
  ctx.stroke();
  ctx.restore();

  for (let i = 0; i < 2; i++) {
    const a = spin + i * Math.PI;
    const sx = Math.cos(a) * rx;
    const sy = cy + Math.sin(a) * ry;
    ctx.save();
    ctx.strokeStyle = i === 0 ? PAL.heroBlue : PAL.heroBlueDark;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    ctx.restore();
    heroShoe(ctx, sx, sy, -Math.sin(a) * 0.4, i === 0);
  }
}

/** Reduced motion gets a planted hero stance instead of a frozen blur. */
function plantedLegs(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = PAL.heroBlueDark;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(-7, -4);
  ctx.stroke();
  ctx.strokeStyle = PAL.heroBlue;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(7, -4);
  ctx.stroke();
  ctx.restore();
  heroShoe(ctx, -8, -3, -0.1, false);
  heroShoe(ctx, 8, -3, 0.05, true);
}

function heroShoe(ctx: CanvasRenderingContext2D, sx: number, sy: number, ang: number, near: boolean): void {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(ang);
  // One white stripe and a sock cuff: any more white and the shoe stops
  // reading as red at this size.
  ctx.fillStyle = near ? PAL.heroShoe : '#a82134';
  ctx.beginPath();
  ctx.roundRect(-6, -3.2, 13, 6.8, 3);
  ctx.fill();
  ctx.fillStyle = near ? '#f6f8ff' : '#cfd4de';
  ctx.fillRect(-4.5, -0.6, 11, 1.8);
  ctx.beginPath();
  ctx.roundRect(-4.5, -5.6, 8, 2.8, 1.4);
  ctx.fill();
  ctx.restore();
}

function heroTorso(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PAL.heroBlue;
  ctx.beginPath();
  ctx.roundRect(-11, -18, 22, 20, 9);
  ctx.fill();
  // Rim light: the Core burns behind him, so his leading edge catches it.
  ctx.fillStyle = 'rgba(150,210,255,0.35)';
  ctx.beginPath();
  ctx.roundRect(5.5, -16, 4, 15, 2);
  ctx.fill();
  ctx.fillStyle = PAL.heroCream;
  ctx.beginPath();
  ctx.roundRect(-5.5, -13, 12.5, 15, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(10,28,74,0.30)';
  ctx.beginPath();
  ctx.roundRect(-11, -3, 22, 5, 2.5);
  ctx.fill();
}

function heroArm(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  ang: number,
  len: number,
  color: string,
  glove: string,
): void {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(ang);
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();
  // Cuff, so the glove reads as a hand on an arm and not a floating ball.
  ctx.strokeStyle = '#0d2f74';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(len - 3.4, -2.4);
  ctx.lineTo(len - 3.4, 2.4);
  ctx.stroke();
  ctx.fillStyle = glove;
  ctx.beginPath();
  ctx.arc(len, 0, 3.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function heroTail(ctx: CanvasRenderingContext2D, frame: number, reduced: boolean): void {
  ctx.save();
  ctx.translate(-8, -4);
  ctx.rotate(reduced ? -0.1 : Math.sin(frame / 7) * 0.14 - 0.1);
  ctx.scale(0.85, 0.85);
  // Chunky enough to read as a lightning bolt rather than a glass shard.
  ctx.beginPath();
  ctx.moveTo(2, -6);
  ctx.lineTo(-13, -15);
  ctx.lineTo(-5.5, -5);
  ctx.lineTo(-20, 3);
  ctx.lineTo(-4, 2);
  ctx.closePath();
  ctx.fillStyle = '#0d2f74';
  ctx.fill();
  ctx.strokeStyle = '#0d2f74';
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = PAL.heroBlueDark;
  ctx.fill();
  ctx.fillStyle = `rgba(120,215,255,${reduced ? 0.45 : 0.3 + 0.25 * Math.sin(frame / 6)})`;
  ctx.beginPath();
  ctx.moveTo(0.5, -6.5);
  ctx.lineTo(-9.5, -12.5);
  ctx.lineTo(-6, -6);
  ctx.lineTo(-15, -0.5);
  ctx.lineTo(-5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function heroHead(ctx: CanvasRenderingContext2D, frame: number, reduced: boolean): void {
  ctx.save();
  // Sits low enough to overlap the shoulders — a head floating over a neck gap
  // is the single fastest way to make a character read as parts, not a body.
  ctx.translate(1, -22);
  ctx.rotate(-0.12 + (reduced ? 0 : Math.sin(frame / 26) * 0.03));

  // Fox ears: broad at the base, swept back by the run. Thin spikes read as
  // antennae at this size — the base width is what makes them ears.
  ctx.fillStyle = PAL.heroBlueDark;
  ctx.beginPath();
  ctx.moveTo(-7, -4);
  ctx.lineTo(-13.5, -13);
  ctx.lineTo(-1, -8.5);
  ctx.closePath();
  ctx.moveTo(-0.5, -6.5);
  ctx.lineTo(-1.5, -17);
  ctx.lineTo(7, -7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(243,229,195,0.6)';
  ctx.beginPath();
  ctx.moveTo(0.8, -8);
  ctx.lineTo(-0.2, -14);
  ctx.lineTo(4.6, -8.2);
  ctx.closePath();
  ctx.fill();

  // Dark keyline first: without it the head fuses into the shoulders and the
  // whole hero reads as one blue mass.
  ctx.fillStyle = '#0d2f74';
  ctx.beginPath();
  ctx.roundRect(-8.8, -9.8, 17.6, 16, 7);
  ctx.fill();
  ctx.fillStyle = '#3a88ff';
  ctx.beginPath();
  ctx.roundRect(-8, -9, 16, 14.5, 6.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(150,210,255,0.4)';
  ctx.beginPath();
  ctx.roundRect(3, -8, 3.6, 7, 1.8);
  ctx.fill();

  ctx.fillStyle = PAL.heroCream;
  ctx.beginPath();
  ctx.roundRect(1.5, -1.5, 9.5, 7.5, 3.5);
  ctx.fill();
  ctx.fillStyle = '#12181f';
  ctx.beginPath();
  ctx.ellipse(10.2, 0.4, 2, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#12181f';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(7, 2, 2.6, 0.2, 1.2);
  ctx.stroke();

  ctx.fillStyle = '#f4f8ff';
  ctx.beginPath();
  ctx.roundRect(0.8, -6.2, 6.4, 5.6, 2.6);
  ctx.fill();
  ctx.fillStyle = '#16213c';
  ctx.beginPath();
  ctx.ellipse(4.8, -3.6, 1.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PAL.crystal;
  ctx.fillRect(5.2, -4.7, 0.9, 0.9);
  // Brow: the difference between "mascot" and "determined mascot".
  ctx.strokeStyle = PAL.heroBlueDark;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0.6, -7.2);
  ctx.lineTo(7.2, -5.6);
  ctx.stroke();
  ctx.restore();
}

function heroWind(ctx: CanvasRenderingContext2D, frame: number): void {
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const p = (frame * 1.6 + i * 17) % 46;
    const x = -18 - p;
    const y = -8 - i * 9;
    const len = 10 + (i % 2) * 8;
    ctx.globalAlpha = Math.max(0, 0.5 - p / 60);
    ctx.strokeStyle = i % 2 ? PAL.crystal : '#cfe8ff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - len, y + 1.5);
    ctx.stroke();
  }
  ctx.restore();
}

function heroDust(ctx: CanvasRenderingContext2D, frame: number): void {
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const p = (frame * 1.4 + i * 15) % 60;
    ctx.globalAlpha = Math.max(0, 0.35 - p / 170);
    ctx.fillStyle = i % 2 ? '#9fb4c8' : '#d9c9a6';
    ctx.beginPath();
    ctx.arc(-6 - p * 0.9, -1 - p * 0.12, 2 + p * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function heroSpark(ctx: CanvasRenderingContext2D, frame: number): void {
  if (frame % 46 > 5) return;
  ctx.save();
  ctx.strokeStyle = PAL.crystal;
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = 0.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-16, -4);
  ctx.lineTo(-21, -9);
  ctx.lineTo(-18, -9);
  ctx.lineTo(-25, -16);
  ctx.stroke();
  ctx.restore();
}

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

  ctx.save();
  ctx.translate(cx, y);
  ctx.transform(1, 0, -0.16, 1, 0, 0); // forward shear: the logo leans like he does
  ctx.textAlign = 'center';
  ctx.font = 'bold 58px monospace';
  const word = 'BOLT';
  for (let d = 6; d >= 1; d--) {
    ctx.fillStyle = d > 3 ? '#050b1c' : '#0d2352';
    ctx.fillText(word, d, d * 0.85);
  }
  // Heavy keyline: the letters have to hold against a moving sky.
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#040814';
  ctx.strokeText(word, 0, 0);
  const body = ctx.createLinearGradient(0, -44, 0, 8);
  body.addColorStop(0, '#eef8ff');
  body.addColorStop(0.3, '#8ad6ff');
  body.addColorStop(0.52, '#2f7df6');
  body.addColorStop(0.86, '#1a4fb8');
  body.addColorStop(1, '#5fb4ff');
  ctx.fillStyle = body;
  ctx.fillText(word, 0, 0);
  if (!reduced) {
    // Specular sweep: the letters are re-drawn white through a moving slit,
    // which is the cheapest way to "clip to text" on a 2D canvas.
    const sweep = ((frame % 280) / 280) * 320 - 160;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(sweep - 13, -54);
    ctx.lineTo(sweep + 13, -54);
    ctx.lineTo(sweep + 31, 14);
    ctx.lineTo(sweep + 5, 14);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(word, 0, 0);
    ctx.restore();
  }
  ctx.restore();

  // Sub-title plate.
  const rw = 190;
  const rh = 26;
  const rx = cx - rw / 2;
  const ry = y + 14;
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
  ctx.fillStyle = 'rgba(75,225,255,0.18)';
  ctx.fillRect(rx + 12, ry + 3, rw - 24, 1);

  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = PAL.crystal;
  spacedText(ctx, 'CHRONO RUSH', cx, ry + 18, 3);
  boltGlyph(ctx, rx + 13, ry + rh / 2, 0.6, PAL.crystal);
  boltGlyph(ctx, rx + rw - 13, ry + rh / 2, 0.6, PAL.crystal);
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

/** Letter-spaced centred text — canvas has no tracking control worth relying on. */
function spacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  spacing: number,
): void {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  const align = ctx.textAlign;
  ctx.textAlign = 'left';
  let x = cx - total / 2;
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y);
    x += widths[i] + spacing;
  });
  ctx.textAlign = align;
}
