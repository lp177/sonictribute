#!/usr/bin/env node
/**
 * BOLT — Chrono Rush : marketing key art ("social card") generator.
 *
 *   node tools/make-cover.mjs                   # writes docs/ and public/ social-card.png
 *   node tools/make-cover.mjs --out /tmp/x.png  # writes a single file instead
 *
 * This is NOT a screenshot of the game. It is a poster: BOLT at full sprint
 * across a mountain ridge at dawn, gold rings blowing past the lens, the
 * stolen Chrono Core burning above him, wordmark holding the left third.
 *
 * The character is drawn bespoke for the cover, but in the game's own design
 * language and with the game's own palette (src/render/painter.ts PAL) and
 * wordmark treatment (src/render/titleArt.ts drawTitleLogo, which is likewise
 * sheared bold monospace): blue body, cream muzzle / chest / gloves, red-and-
 * white shoes, lightning-bolt tail, cyan Chrono accents.
 *
 * The head is deliberately re-drawn at far higher detail than the 30 px
 * in-game sprite: a bezier skull with a brow shelf and a cheek plane break, a
 * wedge muzzle whose back third runs UNDER the eyes so it grows out of the
 * face instead of sitting on it, and the joined two-lobe eye mass that is the
 * character's signature silhouette — one continuous sclera, a hooded lid, big
 * fibred irises and two catchlights on the Core side.
 *
 * Lighting: single key light = the Chrono Core, up and behind him on the
 * right. Every rim light therefore falls on the RIGHT/upper-right edge of a
 * form; a much weaker cyan bounce off the ring trail catches the left edge.
 *
 * Everything is composed on a 2400x1260 Canvas2D surface, screenshot with
 * Playwright/Chrome, then Lanczos-downscaled to exactly 1200x630.
 *
 * Requirements (already present on this machine):
 *   - /usr/bin/google-chrome
 *   - playwright (resolved from a sibling checkout if not installed here)
 *   - ImageMagick `magick` for the downscale
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

/* Playwright lives in this repo if installed, otherwise in a sibling checkout. */
function loadChromium() {
  const roots = [REPO, path.resolve(REPO, '..', 'Tribble')];
  for (const root of roots) {
    try {
      return createRequire(path.join(root, 'noop.js'))('playwright').chromium;
    } catch {
      /* try the next root */
    }
  }
  throw new Error('playwright not found in ' + roots.join(' or '));
}

/* -------------------------------------------------------------------------- */
/*  The artwork. Runs inside the browser page.                                 */
/* -------------------------------------------------------------------------- */

const ART = String.raw`
const W = 2400, H = 1260, TAU = Math.PI * 2;

/* Palette lifted verbatim from src/render/painter.ts PAL + titleArt.ts sky. */
const PAL = {
  heroBlue: '#2f7df6',
  heroBlueDark: '#1d4fb4',
  heroCream: '#f3e5c3',
  heroShoe: '#e8384f',
  ring: '#ffd94a',
  ringDark: '#d9a41f',
  crystal: '#4be1ff',
};
const INK = '#050b1c';          // keyline
const FUR_DEEP = '#0d2764';
const CREAM_SHADE = '#b8945f';
const CREAM_LIT = '#fff9ea';
const RIM_WARM = 'rgba(255,186,108,1)';
const RIM_HOT = 'rgba(255,248,228,1)';
const RIM_COOL = 'rgba(88,196,255,1)';

const GROUND = 1088;                         // top of the near ground strip
const CORE = { x: 2196, y: 262, r: 80 };     // the stolen Chrono Core: key light

function lcg(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
ctx.lineJoin = 'round';
ctx.lineCap = 'round';

/* ------------------------------- helpers ---------------------------------- */

function lg(x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [t, c] of stops) g.addColorStop(t, c);
  return g;
}
function rg(x0, y0, r0, x1, y1, r1, stops) {
  const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
  for (const [t, c] of stops) g.addColorStop(t, c);
  return g;
}
function bloom(x, y, r, color, a) {
  ctx.fillStyle = rg(x, y, 0, x, y, r, [
    [0, color.replace('ALPHA', a)],
    [0.4, color.replace('ALPHA', a * 0.26)],
    [1, color.replace('ALPHA', 0)],
  ]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/**
 * Rim light. Clip to the form, stroke a copy of it shifted the OPPOSITE way
 * from the light, and the surviving crescent hugs the lit edge. Positive dx
 * puts the rim on the right, positive dy puts it on top.
 */
function rim(pathFn, dx, dy, width, style, alpha) {
  ctx.save();
  pathFn();
  ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = alpha;
  ctx.translate(-dx, -dy);
  ctx.lineWidth = width;
  ctx.strokeStyle = style;
  pathFn();
  ctx.stroke();
  ctx.restore();
}

/** Catmull-Rom resample of a control polyline, with widths carried along. */
function spline(pts, widths, n) {
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  const op = [], ow = [];
  const segs = pts.length - 1;
  for (let i = 1; i < P.length - 2; i++) {
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const c = (a, b, cc, d) => 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3);
      op.push([c(P[i - 1][0], P[i][0], P[i + 1][0], P[i + 2][0]), c(P[i - 1][1], P[i][1], P[i + 1][1], P[i + 2][1])]);
      const u = ((i - 1) + t) / segs * (widths.length - 1);
      const j = Math.min(widths.length - 2, Math.floor(u));
      ow.push(widths[j] + (widths[j + 1] - widths[j]) * (u - j));
    }
  }
  op.push(pts[pts.length - 1]); ow.push(widths[widths.length - 1]);
  return { p: op, w: ow };
}

/** Closed outline of a tapered limb / quill built from a spline. */
function taper(pts, widths, n) {
  ctx.beginPath();
  taperSub(pts, widths, n);
}

/** Same, but appended to the current path so several can be unioned. */
function taperSub(pts, widths, n) {
  const s = spline(pts, widths, n || 12);
  const L = [], R = [];
  for (let i = 0; i < s.p.length; i++) {
    const a = s.p[Math.max(0, i - 1)], b = s.p[Math.min(s.p.length - 1, i + 1)];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const nx = -Math.sin(ang) * s.w[i], ny = Math.cos(ang) * s.w[i];
    L.push([s.p[i][0] + nx, s.p[i][1] + ny]);
    R.push([s.p[i][0] - nx, s.p[i][1] - ny]);
  }
  ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < L.length; i++) ctx.lineTo(L[i][0], L[i][1]);
  for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath();
}

/* ================================ BACKDROP ================================= */

function sky() {
  ctx.fillStyle = lg(0, 0, 0, H, [
    [0.00, '#03040c'], [0.13, '#070d26'], [0.26, '#181541'],
    [0.36, '#3a1f50'], [0.44, '#7a3350'], [0.50, '#c46e3f'],
    [0.545, '#efa74e'], [0.575, '#f7c56d'], [1.00, '#f8cf80'],
  ]);
  ctx.fillRect(0, 0, W, H);

  const rnd = lcg(4211);
  for (let i = 0; i < 460; i++) {
    const x = rnd() * W, y = rnd() * 720;
    const big = rnd() > 0.9;
    ctx.globalAlpha = (0.12 + rnd() * 0.7) * Math.max(0, 1 - y / 700);
    ctx.fillStyle = rnd() > 0.85 ? '#bfe6ff' : '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, big ? 1.9 : 1.1, 0, TAU); ctx.fill();
    if (big) { ctx.globalAlpha *= 0.45; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;

  /* Chrono aurora — the stolen Core makes time ripple, so the sky does too. */
  for (let band = 0; band < 3; band++) {
    const baseY = 118 + band * 128;
    const tint = band === 1 ? '186,110,255' : '75,225,255';
    ctx.fillStyle = lg(0, 0, W, 0, [
      [0, 'rgba(' + tint + ',0)'], [0.34, 'rgba(' + tint + ',0.16)'],
      [0.63, 'rgba(' + tint + ',0.05)'], [1, 'rgba(' + tint + ',0)'],
    ]);
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= W; x += 24) ctx.lineTo(x, baseY + Math.sin((x / W) * TAU + band) * 34);
    for (let x = W; x >= 0; x -= 24) ctx.lineTo(x, baseY + 62 + band * 20 + Math.sin((x / W) * TAU + band) * 34);
    ctx.closePath(); ctx.fill();
  }
}

function chronoCore() {
  ctx.save();
  ctx.translate(CORE.x, CORE.y);
  ctx.rotate(0.24);
  ctx.fillStyle = rg(0, 0, 24, 0, 0, 1700, [
    [0, 'rgba(255,206,140,0.2)'], [0.34, 'rgba(255,180,110,0.075)'], [1, 'rgba(255,164,96,0)'],
  ]);
  for (let i = 0; i < 18; i++) {
    ctx.rotate(TAU / 18);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1700, -56); ctx.lineTo(1700, 56); ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  bloom(CORE.x, CORE.y, 620, 'rgba(255,152,74,ALPHA)', 0.5);
  bloom(CORE.x, CORE.y, 210, 'rgba(255,226,164,ALPHA)', 0.85);

  /* A CUT GEM, not a disc. A circle up in the corner reads as the sun, which
     is the last thing a stolen time crystal should look like. */
  const R = CORE.r * 1.2;
  const gem = () => {
    ctx.beginPath();
    ctx.moveTo(0, -R * 1.34);
    ctx.lineTo(R * 0.66, -R * 0.52);
    ctx.lineTo(R * 0.86, R * 0.42);
    ctx.lineTo(0, R * 1.26);
    ctx.lineTo(-R * 0.86, R * 0.42);
    ctx.lineTo(-R * 0.66, -R * 0.52);
    ctx.closePath();
  };
  ctx.save();
  ctx.translate(CORE.x, CORE.y); ctx.rotate(0.16);

  ctx.fillStyle = 'rgba(255,246,220,0.9)'; gem(); ctx.fill();
  ctx.save(); gem(); ctx.clip();
  /* facets: alternating bright table and dark pavilion, meeting at the girdle */
  const facets = [
    [[0, -R * 1.34], [R * 0.66, -R * 0.52], [0, -R * 0.1], 'rgba(255,246,214,0.95)'],
    [[0, -R * 1.34], [-R * 0.66, -R * 0.52], [0, -R * 0.1], 'rgba(252,190,104,0.85)'],
    [[R * 0.66, -R * 0.52], [R * 0.86, R * 0.42], [0, -R * 0.1], 'rgba(255,214,140,0.9)'],
    [[-R * 0.66, -R * 0.52], [-R * 0.86, R * 0.42], [0, -R * 0.1], 'rgba(214,120,52,0.85)'],
    [[R * 0.86, R * 0.42], [0, R * 1.26], [0, -R * 0.1], 'rgba(250,164,80,0.9)'],
    [[-R * 0.86, R * 0.42], [0, R * 1.26], [0, -R * 0.1], 'rgba(168,80,38,0.85)'],
  ];
  for (const [p0, p1, p2, col] of facets) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = rg(0, -R * 0.4, 2, 0, -R * 0.2, R * 1.1, [
    [0, '#ffffff'], [0.34, 'rgba(255,252,236,0.85)'], [1, 'rgba(255,190,110,0)'],
  ]);
  ctx.fillRect(-R * 1.4, -R * 1.5, R * 2.8, R * 3);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,248,222,0.85)'; ctx.lineWidth = 4; gem(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -R * 1.34); ctx.lineTo(0, R * 1.26);
  ctx.moveTo(-R * 0.86, R * 0.42); ctx.lineTo(R * 0.86, R * 0.42);
  ctx.stroke();
  ctx.restore();

  /* Hour-shard crystals in orbit — the campaign's collectible motif. */
  const rnd = lcg(77);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.4;
    const x = CORE.x + Math.cos(a) * (CORE.r + 70 + rnd() * 54);
    const y = CORE.y + Math.sin(a) * (CORE.r * 0.5 + 30);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a * 1.7);
    ctx.fillStyle = 'rgba(178,246,255,0.92)';
    ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(8, 0); ctx.lineTo(0, 24); ctx.lineTo(-8, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

/**
 * A mountain RANGE: one continuous jagged skyline with asymmetric peaks and
 * shoulders, not a row of isolated equilateral triangles. The triangles were
 * the single most diagram-like thing in the frame.
 */
function ridge() {
  const base = 836, rnd = lcg(881);
  const pts = [[-40, base]];
  let x = -40;
  let y = base - 60;
  while (x < W + 60) {
    const run = 70 + rnd() * 150;
    x += run;
    /* peaks and saddles alternate, with the peak offset off-centre */
    const peak = base - 120 - rnd() * 210;
    pts.push([x - run * (0.28 + rnd() * 0.3), peak]);
    y = base - 40 - rnd() * 90;
    pts.push([x, y]);
  }
  pts.push([W + 60, base]);

  const skyline = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.lineTo(W + 60, base + 90); ctx.lineTo(-40, base + 90);
    ctx.closePath();
  };
  skyline(); ctx.fillStyle = '#0d172e'; ctx.fill();

  /* only the Core-facing flank of each peak catches any light */
  ctx.save(); skyline(); ctx.clip();
  ctx.fillStyle = 'rgba(255,176,112,0.1)';
  for (let i = 1; i < pts.length - 2; i += 2) {
    ctx.beginPath();
    ctx.moveTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
    ctx.lineTo(pts[i][0] + 6, base + 90);
    ctx.closePath(); ctx.fill();
  }
  /* snow catching the dawn on the highest shoulders */
  ctx.strokeStyle = 'rgba(255,214,168,0.32)'; ctx.lineWidth = 4;
  for (let i = 1; i < pts.length - 2; i += 2) {
    if (pts[i][1] > base - 220) continue;
    ctx.beginPath();
    ctx.moveTo(pts[i][0] - 22, pts[i][1] + 30);
    ctx.lineTo(pts[i][0], pts[i][1] + 3);
    ctx.lineTo(pts[i][0] + 26, pts[i][1] + 34);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Dawn haze pooling on the ridgeline. Without it the bright band of sky
 * between the peaks and the hills runs at one even value clean across the
 * frame and reads as a painted stripe.
 */
function horizonHaze() {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = rg(2060, 890, 40, 2060, 890, 1520, [
    [0, 'rgba(255,178,104,0.3)'], [0.42, 'rgba(255,150,90,0.1)'], [1, 'rgba(255,140,80,0)'],
  ]);
  ctx.fillRect(0, 690, W, 320);
  ctx.restore();
  /* and the far side of the frame, away from the Core, stays night */
  ctx.fillStyle = lg(0, 0, 1280, 0, [[0, 'rgba(5,9,24,0.72)'], [1, 'rgba(5,9,24,0)']]);
  ctx.fillRect(0, 740, 1280, 280);
}

function hills() {
  const base = 900;
  const line = (x) => base - 46 * Math.sin((x / W) * TAU * 0.7 + 0.4)
    - 26 * Math.sin((x / W) * TAU * 1.6 + 1.1) - 12 * Math.sin((x / W) * TAU * 2.9 + 2.3);

  const rnd = lcg(1597);
  for (let i = 0; i < 11; i++) {
    const x = (i + 0.5) * (W / 11) + (rnd() - 0.5) * 90;
    const tall = 70 + rnd() * 96, wide = 11 + rnd() * 11, b = line(x) + 16;
    ctx.fillStyle = 'rgba(75,225,255,0.20)';
    ctx.beginPath(); ctx.moveTo(x, b - tall); ctx.lineTo(x + wide, b); ctx.lineTo(x - wide, b); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(190,248,255,0.30)';
    ctx.fillRect(x - 2, b - tall, 4, tall * 0.55);
  }

  ctx.fillStyle = '#132039';
  ctx.beginPath(); ctx.moveTo(0, line(0));
  for (let x = 0; x <= W; x += 16) ctx.lineTo(x, line(x));
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(130,196,255,0.22)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, line(0));
  for (let x = 0; x <= W; x += 16) ctx.lineTo(x, line(x));
  ctx.stroke();
}

function treeline() {
  const rnd = lcg(3307), cells = 18, cell = W / cells;
  ctx.fillStyle = '#040810';
  for (let i = -1; i <= cells; i++) {
    const x = (i + 0.5) * cell + (rnd() - 0.5) * cell * 0.8;
    if (rnd() > 0.8) {
      const r = 20 + rnd() * 30;
      ctx.beginPath(); ctx.ellipse(x, GROUND + 4, r, r * 0.6, 0, Math.PI, 0); ctx.fill();
      continue;
    }
    const tall = 84 + rnd() * 152, wide = 26 + rnd() * 30;
    ctx.fillRect(x - 5, GROUND - 30, 10, 32);
    for (let tier = 0; tier < 3; tier++) {
      const top = GROUND - tall + tier * (tall * 0.25);
      const spread = wide * (0.6 + tier * 0.2);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x + spread, GROUND - 22 - (2 - tier) * 16);
      ctx.lineTo(x - spread, GROUND - 22 - (2 - tier) * 16);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.beginPath(); ctx.moveTo(0, GROUND - 10);
  for (let x = 0; x <= W; x += 24) ctx.lineTo(x, GROUND - 10 - 11 * Math.sin((x / W) * TAU * 2 + 0.7));
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
}

function groundStrip() {
  const h = H - GROUND;
  ctx.fillStyle = lg(0, GROUND, 0, H, [[0, '#17392b'], [0.32, '#0d2220'], [1, '#04070e']]);
  ctx.fillRect(0, GROUND, W, h);
  ctx.fillStyle = '#256f45'; ctx.fillRect(0, GROUND, W, 11);
  ctx.fillStyle = 'rgba(150,255,200,0.16)'; ctx.fillRect(0, GROUND, W, 3);

  const rnd = lcg(6113);
  for (let i = 0; i < 240; i++) {
    const x = rnd() * W, tall = 9 + rnd() * 20;
    ctx.fillStyle = rnd() > 0.6 ? '#256f45' : '#184e30';
    ctx.beginPath(); ctx.moveTo(x, GROUND + 11); ctx.lineTo(x + 5, GROUND + 11 - tall); ctx.lineTo(x + 10, GROUND + 11); ctx.closePath(); ctx.fill();
  }
  for (let i = 0; i < 200; i++) {
    const x = rnd() * W, y = GROUND + 18 + rnd() * (h - 24);
    ctx.globalAlpha = 0.05 + rnd() * 0.11;
    ctx.fillStyle = rnd() > 0.68 ? '#ffd08a' : '#9fe4ff';
    ctx.fillRect(x, y, 70 + rnd() * 240, 3);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = rg(1980, GROUND, 10, 1980, GROUND, 900, [
    [0, 'rgba(255,168,92,0.22)'], [1, 'rgba(255,168,92,0)'],
  ]);
  ctx.fillRect(0, GROUND, W, h);
}

/* ================================= RINGS =================================== */

/** One gold ring: dark back rim, gold body, hot specular arcs on the lit side. */
function ring(x, y, r, tilt, squash, alpha, blurPx) {
  const rx = Math.max(0.12, Math.abs(squash)) * r;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (blurPx) ctx.filter = 'blur(' + blurPx + 'px)';
  ctx.translate(x, y);
  ctx.rotate(tilt);
  const th = Math.max(3.5, r * 0.27);

  ctx.strokeStyle = '#5e3806'; ctx.lineWidth = th * 1.55;
  ctx.beginPath(); ctx.ellipse(0, 0, rx, r, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = lg(-rx, -r, rx, r, [[0, '#fff0a8'], [0.36, PAL.ring], [0.7, PAL.ringDark], [1, '#8f6208']]);
  ctx.lineWidth = th;
  ctx.beginPath(); ctx.ellipse(0, 0, rx, r, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,253,232,0.95)'; ctx.lineWidth = th * 0.32;
  ctx.beginPath(); ctx.ellipse(0, 0, rx, r, 0, -2.0, -0.7); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.99, r * 0.99, 0, 1.5, 2.0); ctx.stroke();
  ctx.restore();

  if (r > 30 && alpha > 0.5 && !blurPx) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    bloom(x, y, r * 2.6, 'rgba(255,200,80,ALPHA)', 0.2); ctx.restore();
  }
}

/**
 * Rings do not sit on one rigid curve — that reads as a spring. They come out
 * of the distance behind him in a loose stream, tumble past his trailing side,
 * then blow across the bottom of the frame at lens scale.
 */
const RINGS_FAR = [
  [2330, 620, 16, -0.5, 0.30], [2246, 676, 21, -0.35, 0.55], [2140, 720, 27, -0.2, 0.74],
  [2028, 760, 33, -0.05, 0.9], [1918, 812, 41, 0.12, 0.6], [2280, 900, 40, 0.4, 0.46],
  [2180, 992, 52, 0.55, 0.68],
];
const RINGS_NEAR = [
  [1336, 1036, 74, -0.45, 0.58, 2], [986, 1104, 102, -0.6, 0.46, 5],
  [606, 1090, 136, -0.7, 0.6, 9], [232, 962, 92, -0.5, 0.5, 6],
  [214, 1226, 190, -0.4, 0.36, 22], [2144, 1212, 128, 0.6, 0.5, 18],
];

function ringsBehind() { for (const [x, y, r, t, s] of RINGS_FAR) ring(x, y, r, t, s, 0.95, 0); }
function ringsFront() { for (const [x, y, r, t, s, b] of RINGS_NEAR) ring(x, y, r, t, s, 0.93, b); }

/* ============================== SPEED / FX ================================= */

function speedStreaks() {
  const rnd = lcg(2029);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 44; i++) {
    const a = -0.6 + rnd() * 0.48;
    const d0 = 200 + rnd() * 1200, len = 260 + rnd() * 820;
    const ox = CORE.x - 90, oy = CORE.y + 300;
    const x0 = ox - Math.cos(a) * d0, y0 = oy + Math.sin(a) * d0 * 0.55 + (rnd() - 0.5) * 800;
    const x1 = x0 - Math.cos(a) * len, y1 = y0 + Math.sin(a) * len * 0.55;
    const warm = rnd() > 0.55;
    ctx.strokeStyle = lg(x0, y0, x1, y1, warm
      ? [[0, 'rgba(255,214,150,0)'], [0.3, 'rgba(255,214,150,0.32)'], [1, 'rgba(255,170,90,0)']]
      : [[0, 'rgba(120,220,255,0)'], [0.3, 'rgba(150,235,255,0.32)'], [1, 'rgba(70,180,255,0)']]);
    ctx.lineWidth = 2 + rnd() * 7;
    ctx.globalAlpha = 0.32 + rnd() * 0.45;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  ctx.restore();
}

function shards() {
  const rnd = lcg(8081);
  /* Kept clear of the figure — a shard crossing the ear or the eye reads as a
     defect, not as sparkle. */
  const spots = [[1148, 296], [1218, 704], [1104, 992], [1500, 100], [2340, 232]];
  for (const [x, y] of spots) {
    const sc = 0.7 + rnd() * 0.9, a = -0.5 + rnd() * 1.2;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(a); ctx.scale(sc, sc);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    bloom(0, 0, 110, 'rgba(75,225,255,ALPHA)', 0.35); ctx.restore();
    ctx.fillStyle = 'rgba(8,24,48,0.9)';
    ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(17, 0); ctx.lineTo(0, 46); ctx.lineTo(-17, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = lg(-17, -46, 17, 46, [[0, '#dcfaff'], [0.45, PAL.crystal], [1, '#0f7fa8']]);
    ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(13, 0); ctx.lineTo(0, 40); ctx.lineTo(-13, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(5, -4); ctx.lineTo(0, 8); ctx.lineTo(-4, -4); ctx.closePath(); ctx.fill();
    /* trail */
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = lg(20, 0, 190, 0, [[0, 'rgba(120,235,255,0.6)'], [1, 'rgba(120,235,255,0)']]);
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(190, -8); ctx.stroke();
    ctx.restore();
  }
}

/** Out-of-focus grass right at the lens: the closest layer of all, and what
 *  turns the empty bottom-left into foreground instead of dead ground. */
function foregroundGrass() {
  const rnd = lcg(7717);
  ctx.save();
  ctx.filter = 'blur(10px)';
  for (let i = 0; i < 52; i++) {
    const x = rnd() * W;
    const tall = 60 + rnd() * 210;
    const lean = (rnd() - 0.5) * 110;
    ctx.globalAlpha = 0.5 + rnd() * 0.42;
    ctx.fillStyle = rnd() > 0.72 ? '#0b2419' : '#03090f';
    ctx.beginPath();
    ctx.moveTo(x - 10, H + 12);
    ctx.quadraticCurveTo(x - 4 + lean * 0.4, H - tall * 0.6, x + lean, H - tall);
    ctx.quadraticCurveTo(x + 6 + lean * 0.4, H - tall * 0.55, x + 10, H + 12);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function motes() {
  const rnd = lcg(9173);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 78; i++) {
    const x = rnd() * W, y = 80 + rnd() * 1100, r = 3 + rnd() * 10;
    /* never over the figure — a soft bright disc on top of him reads as a
       smudge on the artwork, not as a bokeh spark in front of the lens */
    if (Math.hypot((x - 1780) / 620, (y - 660) / 640) < 1) continue;
    ctx.globalAlpha = 0.14 + rnd() * 0.36;
    const warm = rnd() > 0.6;
    bloom(x, y, r * 5, warm ? 'rgba(255,208,138,ALPHA)' : 'rgba(120,230,255,ALPHA)', 0.55);
    ctx.globalAlpha = 0.5 + rnd() * 0.4;
    ctx.fillStyle = warm ? '#ffe4b2' : '#c9f4ff';
    ctx.beginPath(); ctx.arc(x, y, r * 0.38, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/* ================================== HERO =================================== */

const HIP = { x: 1806, y: 906 };
const LEAN = -0.46;                     // hard forward lean: this is a sprint
const HEAD_SCALE = 1.62;
const HEAD_AT = { x: -20, y: -516 };   // figure space, before the lean
/* A sprinter's body pitches forward but his head stays up, eyes on the road.
   Without this counter-rotation the whole lean reads as a stumble. */
const HEAD_TILT = 0.22;

/* --------------------------- lighting helpers ----------------------------- */

/** Soft dark inner edge all round a form. Without it, rim light has nothing
 *  to sit against and reads as a plastic decal instead of light. */
function innerShade(pathFn, w, alpha, color) {
  ctx.save();
  pathFn(); ctx.clip();
  ctx.globalAlpha = alpha === undefined ? 0.42 : alpha;
  ctx.filter = 'blur(' + Math.min(9, Math.round(w * 0.4)) + 'px)';
  ctx.lineWidth = w;
  ctx.strokeStyle = color || '#04102e';
  pathFn(); ctx.stroke();
  ctx.restore();
}

/** Warm rim on the Core side + a thin hot core line, both softened. */
function litEdge(pathFn, dx, dy, w, strength) {
  const s = strength === undefined ? 1 : strength;
  ctx.save();
  pathFn(); ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  ctx.translate(-dx, -dy);
  ctx.filter = 'blur(' + Math.min(4, Math.round(w * 0.22)) + 'px)';
  ctx.globalAlpha = 0.34 * s;
  ctx.lineWidth = w; ctx.strokeStyle = RIM_WARM;
  pathFn(); ctx.stroke();
  ctx.restore();

  /* The hot core of the rim. It gets a small blur on purpose: an unblurred
     offset stroke lays a hard white hairline down the whole length of a form,
     which is the single most reliable way to make painted art look like
     vector clip-art. */
  ctx.save();
  pathFn(); ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  ctx.translate(-dx * 1.28, -dy * 1.28);
  ctx.filter = 'blur(2.5px)';
  ctx.globalAlpha = 0.46 * s;
  ctx.lineWidth = Math.max(3, w * 0.24); ctx.strokeStyle = RIM_HOT;
  pathFn(); ctx.stroke();
  ctx.restore();
}

/**
 * A limb with volume. The trick is that the shading gradient runs ACROSS the
 * limb, not along it: a highlight painted down the length of a tapered polygon
 * is exactly what made the last pass read as planks with a stripe on top.
 */
function limb(pts, ws, lit, base, dark) {
  const inner = () => taper(pts, ws);
  const outline = () => taper(pts, ws.map((w) => w + 8));
  const a = pts[0], b = pts[pts.length - 1];
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const wm = Math.max.apply(null, ws) * 1.5;
  /* unit normal, flipped so it always points at the Core (up and right) */
  let nx = -Math.sin(ang), ny = Math.cos(ang);
  if (nx * 0.62 + ny * -0.78 < 0) { nx = -nx; ny = -ny; }

  outline(); ctx.fillStyle = INK; ctx.fill();
  ctx.save(); inner(); ctx.clip();
  ctx.fillStyle = lg(mx - nx * wm, my - ny * wm, mx + nx * wm, my + ny * wm,
    [[0, dark], [0.42, base], [0.8, base], [1, lit]]);
  ctx.fillRect(-3000, -3000, 6000, 6000);
  /* soft crease at the joint, so a bent limb has an inside to its bend */
  if (pts.length > 3) {
    const j = pts[1];
    ctx.filter = 'blur(16px)';
    ctx.fillStyle = 'rgba(4,14,50,0.45)';
    ctx.beginPath(); ctx.arc(j[0] - nx * ws[1] * 0.9, j[1] - ny * ws[1] * 0.9, ws[1] * 0.95, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  innerShade(inner, 13, 0.3);
  litEdge(inner, 9, 6, 13, 0.6);
  coolEdge(inner, 9, -3, 9);
}

/** Weak cyan bounce off the ring trail, on the shadow side. */
function coolEdge(pathFn, dx, dy, w) {
  ctx.save();
  pathFn(); ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  ctx.translate(dx, -dy);
  ctx.filter = 'blur(' + Math.min(4, Math.round(w * 0.4)) + 'px)';
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = w; ctx.strokeStyle = RIM_COOL;
  pathFn(); ctx.stroke();
  ctx.restore();
}

/* -------------------------------- head ------------------------------------ */

/*
 * Head-local space (blown up by HEAD_SCALE at draw time). The skull mass sits
 * on the origin, the muzzle pushes down-LEFT because he runs left into the
 * wordmark, and the quills sweep back to +x.
 */

/** Four swept quills, fat at the root and a point at the tip, back to front. */
const QUILLS = [
  { pts: [[30, 58], [140, 108], [252, 178]], ws: [50, 31, 2], lit: 0.20 },
  { pts: [[56, 12], [186, 32], [330, 68]], ws: [55, 34, 2], lit: 0.42 },
  { pts: [[60, -38], [202, -48], [352, -64]], ws: [57, 35, 2], lit: 0.78 },
  { pts: [[22, -84], [146, -132], [282, -198]], ws: [47, 29, 2], lit: 1.00 },
];

/** Union silhouette of the whole quill mass — used by the afterimage ghosts. */
function quillPath() {
  ctx.beginPath();
  for (const q of QUILLS) taperSub(q.pts, q.ws.map((w) => w + 5));
}

/**
 * Quills, one form at a time. The previous pass merged them into a single
 * notched outline and rim-lit that outline, which put a bright hairline in
 * every notch and made the mass read as wireframe. Separate forms with a dark
 * seam between them and a rim only on each shaft's upper edge read as hair.
 */
function drawQuills() {
  for (const q of QUILLS) {
    const outer = () => taper(q.pts, q.ws.map((w) => w + 7));
    const inner = () => taper(q.pts, q.ws);
    const [ax, ay] = q.pts[0];
    const [bx, by] = q.pts[2];

    outer(); ctx.fillStyle = INK; ctx.fill();

    ctx.save(); inner(); ctx.clip();
    ctx.fillStyle = lg(ax, ay - 30, bx, by + 40, [
      [0, '#2f6fd8'], [0.4, PAL.heroBlueDark], [1, FUR_DEEP],
    ]);
    ctx.fillRect(-260, -340, 780, 700);
    /* lit plane along the top of the shaft rather than an outline */
    ctx.fillStyle = lg(ax, ay - 58, ax + 30, ay + 46, [
      [0, 'rgba(186,224,255,' + (0.46 * q.lit).toFixed(3) + ')'],
      [1, 'rgba(186,224,255,0)'],
    ]);
    ctx.fillRect(-260, -340, 780, 700);
    ctx.restore();

    innerShade(inner, 17, 0.42);
    litEdge(inner, 6, 9, 11, 0.68 * q.lit);
  }
}

/**
 * A real ear: broad triangular base pinned to the skull, swept back by the
 * run, with a visible pinna on the near one. The old version was a thin spike
 * that read as a stray horn.
 */
function ear(pts, ws, near) {
  const outer = () => taper(pts, ws.map((w) => w + 6));
  outer(); ctx.fillStyle = INK; ctx.fill();
  ctx.save(); outer(); ctx.clip();
  taper(pts, ws);
  ctx.fillStyle = near
    ? lg(pts[0][0], pts[0][1], pts[2][0], pts[2][1], [[0, '#4f9aff'], [1, '#16408e']])
    : lg(pts[0][0], pts[0][1], pts[2][0], pts[2][1], [[0, '#1b4694'], [1, FUR_DEEP]]);
  ctx.fill();
  ctx.restore();
  if (near) {
    ctx.save();
    taper(pts.map((p) => [p[0] + 6, p[1] + 9]), ws.map((w) => w * 0.44));
    ctx.fillStyle = lg(pts[0][0], pts[0][1], pts[2][0], pts[2][1],
      [[0, '#d09283'], [1, '#5c3742']]);
    ctx.fill();
    ctx.restore();
  }
  innerShade(() => taper(pts, ws.map((w) => w + 6)), 12, 0.4);
  litEdge(outer, 7, 7, 9, near ? 0.9 : 0.5);
}

/** Skull: domed crown, a brow shelf at the front, cheekbone, jaw angling in
 *  under the ear. A perfect circle here is what makes a head read as a ball. */
function craniumPath() {
  ctx.beginPath();
  ctx.moveTo(-100, -32);
  ctx.bezierCurveTo(-98, -88, -52, -122, 10, -120);
  ctx.bezierCurveTo(72, -118, 116, -78, 116, -16);
  ctx.bezierCurveTo(116, 38, 86, 84, 32, 100);
  ctx.bezierCurveTo(-14, 113, -58, 98, -82, 60);
  ctx.bezierCurveTo(-97, 37, -104, 4, -100, -32);
  ctx.closePath();
}

/**
 * Muzzle. Its top-right third runs UNDER the eye mass, which is what turns a
 * snout from a tan ball stuck on the front of the face into a wedge growing
 * out of it. Only the part below and forward of the eyes is ever visible.
 */
function muzzlePath() {
  ctx.beginPath();
  ctx.moveTo(-30, -12);
  ctx.bezierCurveTo(-86, -34, -138, -10, -148, 32);
  ctx.bezierCurveTo(-158, 70, -132, 104, -94, 110);
  ctx.bezierCurveTo(-56, 116, -24, 92, -20, 58);
  ctx.bezierCurveTo(-17, 26, -18, 8, -30, -12);
  ctx.closePath();
}

/**
 * The brow ridge, drawn as part of the SKULL on top of the eye mass rather
 * than as two separate shapes floating above it. Floating shapes read as
 * moulded goggles; a shelf of the same fur, with the eye tops in its shadow,
 * reads as a face.
 */
function browShelfPath() {
  ctx.beginPath();
  ctx.moveTo(-104, -38);
  ctx.bezierCurveTo(-102, -92, -54, -124, 10, -122);
  ctx.bezierCurveTo(58, -120, 90, -104, 98, -82);
  ctx.lineTo(84, -90);
  ctx.bezierCurveTo(64, -100, 40, -96, 20, -84);
  ctx.quadraticCurveTo(8, -72, -2, -82);
  ctx.bezierCurveTo(-20, -76, -38, -68, -56, -62);
  ctx.bezierCurveTo(-78, -54, -96, -46, -104, -46);
  ctx.closePath();
}

/*
 * The eyes. Two raked ovals that OVERLAP at the bridge so they read as one
 * joined mask — that single silhouette is the character's signature and the
 * thing that survives a 320 px thumbnail. Two separate round eyes with a lot
 * of white around a small iris is what made the last pass look googly.
 */
const EYE_N = { cx: -42, cy: -34, rx: 53, ry: 36, rot: -0.30 };
/* The far eye. Small, pulled in close and drawn UNDER the near one, so the
   near eye overlaps it and only a crescent of it clears the edge. It used to
   be nearly the size of the near eye and sat clear of it, which put two full
   front-facing eyes on a head whose muzzle is in hard profile. */
const EYE_F = { cx: 12, cy: -50, rx: 30, ry: 24, rot: -0.30 };

function eyeEllipse(e, grow) {
  ctx.beginPath();
  ctx.ellipse(e.cx, e.cy, e.rx + (grow || 0), e.ry + (grow || 0), e.rot, 0, TAU);
}

/** Hooded lid, drawn once in head space and clipped into each eye so the two
 *  lids meet exactly at the bridge. Slopes down toward the muzzle: a scowl. */
function lidPath() {
  ctx.beginPath();
  ctx.moveTo(-134, -150);
  ctx.lineTo(106, -150);
  ctx.lineTo(98, -86);
  ctx.bezierCurveTo(58, -76, 14, -64, -8, -54);
  ctx.bezierCurveTo(-38, -60, -76, -56, -108, -56);
  ctx.closePath();
}

function iris(e, ox, oy, r) {
  const gx = e.cx + ox;
  const gy = e.cy + oy;
  ctx.save();
  eyeEllipse(e, 0); ctx.clip();

  /* sclera shading: the brow drops a shadow across the top of the ball */
  ctx.fillStyle = rg(gx + r * 0.5, gy - r * 0.6, r * 0.06, gx, gy, r, [
    [0, '#d8fbff'], [0.30, '#3fd0f6'], [0.72, '#0b63a6'], [1, '#04203f'],
  ]);
  ctx.beginPath(); ctx.arc(gx, gy, r, 0, TAU); ctx.fill();

  ctx.strokeStyle = 'rgba(5,40,86,0.30)'; ctx.lineWidth = r * 0.055;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    ctx.beginPath();
    ctx.moveTo(gx + Math.cos(a) * r * 0.4, gy + Math.sin(a) * r * 0.4);
    ctx.lineTo(gx + Math.cos(a) * r * 0.94, gy + Math.sin(a) * r * 0.94);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(3,18,44,0.9)'; ctx.lineWidth = r * 0.15;
  ctx.beginPath(); ctx.arc(gx, gy, r, 0, TAU); ctx.stroke();

  ctx.fillStyle = '#04070f';
  ctx.beginPath(); ctx.ellipse(gx - r * 0.05, gy + r * 0.03, r * 0.4, r * 0.48, 0, 0, TAU); ctx.fill();

  /* catchlights sit on the KEY side — up and to the right, where the Core is */
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(gx + r * 0.4, gy - r * 0.46, r * 0.3, 0, TAU); ctx.fill();
  ctx.globalAlpha = 0.55;
  ctx.beginPath(); ctx.arc(gx - r * 0.46, gy + r * 0.44, r * 0.14, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawEyes() {
  const eyes = [EYE_F, EYE_N];   // far first: the near eye must occlude it

  /* union keyline: two grown fills of the same colour merge seamlessly */
  ctx.fillStyle = INK;
  for (const e of eyes) { eyeEllipse(e, 5); ctx.fill(); }

  /* one sclera gradient drawn under each clip, so the bridge has no seam */
  const sclera = lg(0, -108, 0, -6, [[0, '#7f9ac2'], [0.44, '#e6eefb'], [1, '#ffffff']]);
  for (const e of eyes) {
    ctx.save(); eyeEllipse(e, 0); ctx.clip();
    ctx.fillStyle = sclera; ctx.fillRect(-170, -150, 300, 200);
    ctx.restore();
  }

  /* irises pushed forward and low: he is looking where he is going, and a
     centred iris in a big white field is exactly what reads as googly */
  iris(EYE_F, -11, 6, 19);
  iris(EYE_N, -22, 9, 33);

  /* the lid, then a soft shadow falling off it onto the ball */
  for (const e of eyes) {
    ctx.save(); eyeEllipse(e, 0); ctx.clip();
    ctx.fillStyle = INK; lidPath(); ctx.fill();
    ctx.filter = 'blur(10px)'; ctx.globalAlpha = 0.24;
    ctx.translate(0, 10); lidPath(); ctx.fill();
    ctx.restore();
  }

  /* lower lid catching the ground bounce */
  for (const e of eyes) {
    ctx.save(); eyeEllipse(e, 0); ctx.clip();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.35; ctx.filter = 'blur(4px)';
    ctx.strokeStyle = 'rgba(255,186,120,1)'; ctx.lineWidth = 8;
    ctx.translate(0, -7); eyeEllipse(e, 0); ctx.stroke();
    ctx.restore();
  }
}

function drawHead() {
  drawQuills();
  ear([[-50, -84], [-62, -112], [-72, -140]], [36, 21, 3], false);
  ear([[16, -96], [34, -126], [50, -156]], [44, 25, 3], true);

  /* ---- cranium ---- */
  craniumPath(); ctx.fillStyle = INK; ctx.fill();
  ctx.save();
  craniumPath(); ctx.clip();
  ctx.fillStyle = PAL.heroBlue; ctx.fillRect(-180, -180, 380, 380);
  /* deep shadow rolling off the front-bottom, away from the Core */
  ctx.fillStyle = rg(70, -80, 14, -18, 30, 232, [
    [0, 'rgba(150,206,255,0)'], [0.36, 'rgba(14,46,124,0.32)'], [1, 'rgba(3,14,56,0.98)'],
  ]);
  ctx.fillRect(-180, -180, 380, 380);
  /* lit plane on the crown, Core side */
  ctx.fillStyle = rg(52, -84, 8, 52, -84, 158, [
    [0, 'rgba(206,238,255,0.95)'], [0.42, 'rgba(104,178,255,0.32)'], [1, 'rgba(104,178,255,0)'],
  ]);
  ctx.fillRect(-180, -180, 380, 380);
  /* warm bounce off the lit ground under the jaw */
  ctx.fillStyle = rg(-40, 96, 6, -40, 96, 138, [
    [0, 'rgba(255,138,70,0.34)'], [1, 'rgba(255,138,70,0)'],
  ]);
  ctx.fillRect(-180, -180, 380, 380);
  /* cheek blush */
  ctx.fillStyle = rg(6, 30, 4, 6, 30, 70, [[0, 'rgba(255,124,116,0.2)'], [1, 'rgba(255,124,116,0)']]);
  ctx.fillRect(-180, -180, 380, 380);
  /* brow ridge shelf: dark under, catching light on top */
  ctx.fillStyle = lg(0, -118, 0, -46, [[0, 'rgba(4,16,60,0.5)'], [1, 'rgba(4,16,60,0)']]);
  ctx.fillRect(-180, -180, 380, 380);
  ctx.restore();

  innerShade(craniumPath, 25, 0.45);
  litEdge(craniumPath, 16, 8, 18, 1.0);
  coolEdge(craniumPath, 13, -2, 12);

  /* cheek plane break — the one hard edge that gives the skull a far side */
  ctx.save(); craniumPath(); ctx.clip();
  ctx.strokeStyle = 'rgba(5,20,66,0.3)'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(60, -40); ctx.bezierCurveTo(80, 6, 62, 58, 14, 90); ctx.stroke();
  ctx.strokeStyle = 'rgba(160,212,255,0.2)'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(67, -40); ctx.bezierCurveTo(87, 6, 69, 58, 21, 92); ctx.stroke();
  ctx.restore();

  /* ---- muzzle ---- */
  ctx.save();
  ctx.globalAlpha = 0.45; ctx.filter = 'blur(14px)'; ctx.fillStyle = '#05122f';
  ctx.beginPath(); ctx.ellipse(-58, 70, 82, 60, -0.15, 0, TAU); ctx.fill();
  ctx.restore();

  muzzlePath(); ctx.fillStyle = INK; ctx.fill();
  ctx.save();
  muzzlePath(); ctx.clip();
  ctx.fillStyle = lg(-16, -18, -120, 130, [
    [0, CREAM_LIT], [0.24, PAL.heroCream], [0.64, '#c39d63'], [1, '#77592a'],
  ]);
  ctx.fillRect(-210, -60, 260, 240);
  /* the skull casts down onto the muzzle root */
  ctx.fillStyle = lg(0, -14, 0, 60, [[0, 'rgba(38,22,9,0.7)'], [1, 'rgba(38,22,9,0)']]);
  ctx.fillRect(-210, -60, 260, 150);
  ctx.fillStyle = lg(0, 100, 0, 152, [[0, 'rgba(54,32,11,0)'], [1, 'rgba(54,32,11,0.5)']]);
  ctx.fillRect(-210, 84, 260, 96);
  ctx.fillStyle = rg(-92, 116, 6, -92, 116, 96, [[0, 'rgba(255,136,70,0.4)'], [1, 'rgba(255,136,70,0)']]);
  ctx.fillRect(-210, -60, 260, 240);
  ctx.restore();
  /* soft fur transition back into the cheek instead of a hard keyline */
  ctx.save();
  muzzlePath(); ctx.clip();
  ctx.filter = 'blur(17px)';
  ctx.fillStyle = 'rgba(26,62,144,0.82)';
  ctx.beginPath();
  ctx.moveTo(-58, -26); ctx.bezierCurveTo(-14, 18, -10, 78, -40, 138);
  ctx.lineTo(40, 148); ctx.lineTo(40, -40); ctx.closePath(); ctx.fill();
  ctx.restore();
  /* Only the outer, forward half of the muzzle gets a dark inner edge — the
     back of it dissolves into cheek fur, and a keyline all the way round is
     what made the snout read as a tan ball stuck on the face. */
  ctx.save();
  ctx.beginPath(); ctx.rect(-200, -60, 150, 250); ctx.clip();
  innerShade(muzzlePath, 15, 0.32, '#2a1708');
  ctx.restore();
  litEdge(muzzlePath, 10, 6, 11, 0.85);

  /* ---- grin: wide, open, corner curling up onto the cheek ---- */
  const mouth = () => {
    ctx.beginPath();
    ctx.moveTo(-132, 40);
    ctx.bezierCurveTo(-120, 98, -48, 106, -22, 30);
    ctx.bezierCurveTo(-58, 68, -108, 66, -132, 40);
    ctx.closePath();
  };
  mouth(); ctx.fillStyle = '#3d1220'; ctx.fill();
  ctx.save(); mouth(); ctx.clip();
  /* upper tooth row hanging off the lip line */
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath();
  /* The tooth row has to hang BELOW the upper lip or the clip eats it and the
     grin is just a black hole. */
  ctx.moveTo(-140, 48); ctx.bezierCurveTo(-100, 94, -46, 96, -12, 40);
  ctx.lineTo(-12, -16); ctx.lineTo(-140, -16); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(150,120,110,0.4)'; ctx.lineWidth = 3;
  for (const tx of [-104, -78, -52, -28]) {
    ctx.beginPath(); ctx.moveTo(tx, 24); ctx.lineTo(tx + 7, 78); ctx.stroke();
  }
  /* tongue */
  ctx.fillStyle = '#ad4a62';
  ctx.beginPath(); ctx.ellipse(-78, 102, 40, 20, -0.08, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,152,172,0.45)';
  ctx.beginPath(); ctx.ellipse(-84, 96, 20, 9, -0.08, 0, TAU); ctx.fill();
  /* throat falls into shadow behind the teeth */
  ctx.fillStyle = lg(0, 40, 0, 88, [[0, 'rgba(26,6,14,0.8)'], [1, 'rgba(26,6,14,0)']]);
  ctx.fillRect(-150, 32, 150, 58);
  ctx.restore();
  mouth(); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
  /* laugh line running from the nose to the mouth corner */
  ctx.strokeStyle = 'rgba(96,64,28,0.34)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-26, 22); ctx.quadraticCurveTo(-18, 2, -32, -12); ctx.stroke();

  /* ---- nose: small, matte, on the front corner of the wedge ---- */
  ctx.save();
  ctx.translate(-126, 6); ctx.rotate(-0.42);
  ctx.fillStyle = 'rgba(70,44,19,0.24)';
  ctx.beginPath(); ctx.ellipse(3, 8, 20, 13, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#181321';
  ctx.beginPath(); ctx.ellipse(0, 0, 19, 14, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = rg(4, -6, 1, 4, -6, 19, [
    [0, 'rgba(222,236,255,0.42)'], [0.5, 'rgba(180,205,240,0.1)'], [1, 'rgba(180,205,240,0)'],
  ]);
  ctx.beginPath(); ctx.ellipse(0, 0, 19, 14, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.ellipse(-7, 4, 5, 3, -0.4, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(108,74,40,0.28)';
  for (const [wx, wy] of [[-106, 62], [-88, 72], [-110, 78]]) {
    ctx.beginPath(); ctx.arc(wx, wy, 3.2, 0, TAU); ctx.fill();
  }

  /* ---- eyes, then the brow ridge closing over them ---- */
  drawEyes();

  /* Same fur as the skull, same lighting, so it welds to the head. */
  ctx.save();
  browShelfPath(); ctx.clip();
  ctx.fillStyle = PAL.heroBlue; ctx.fillRect(-180, -180, 380, 380);
  ctx.fillStyle = rg(70, -80, 14, -18, 30, 232, [
    [0, 'rgba(150,206,255,0)'], [0.36, 'rgba(14,46,124,0.32)'], [1, 'rgba(3,14,56,0.98)'],
  ]);
  ctx.fillRect(-180, -180, 380, 380);
  ctx.fillStyle = rg(52, -84, 8, 52, -84, 158, [
    [0, 'rgba(206,238,255,0.95)'], [0.42, 'rgba(104,178,255,0.32)'], [1, 'rgba(104,178,255,0)'],
  ]);
  ctx.fillRect(-180, -180, 380, 380);
  /* the ridge is a shelf, so its own underside is the darkest part of it */
  ctx.fillStyle = lg(0, -104, 0, -40, [[0, 'rgba(3,12,48,0)'], [1, 'rgba(3,12,48,0.72)']]);
  ctx.fillRect(-180, -180, 380, 380);
  ctx.restore();

  /* shadow the ridge throws down across the eyes */
  ctx.save();
  for (const e of [EYE_N, EYE_F]) {
    ctx.save(); eyeEllipse(e, 0); ctx.clip();
    ctx.globalAlpha = 0.42; ctx.filter = 'blur(11px)';
    ctx.fillStyle = '#02081c';
    ctx.translate(0, 12); browShelfPath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  litEdge(browShelfPath, 13, 8, 13, 0.9);

  /* two fur points breaking the outer end of each brow, so the ridge is not
     a smooth arc — that is what carries the scowl at thumbnail size */
  const spike = (pts, ws) => {
    taper(pts, ws.map((w) => w + 3)); ctx.fillStyle = '#02081c'; ctx.fill();
    ctx.save(); taper(pts, ws); ctx.clip();
    ctx.fillStyle = lg(pts[0][0], pts[0][1] - 16, pts[2][0], pts[2][1] + 18,
      [[0, '#2b62b6'], [1, '#0a2054']]);
    ctx.fillRect(-220, -240, 440, 320);
    ctx.restore();
  };
  spike([[-96, -40], [-78, -56], [-58, -62]], [10, 8, 2]);
  spike([[-4, -70], [22, -80], [50, -84]], [9, 7, 2]);
}

/* -------------------------------- body ------------------------------------ */

/**
 * Broad through the shoulders, tapering hard to a narrow waist. The last pass
 * was nearly as wide as it was tall, which is what made a lean speedster read
 * as a teddy bear.
 */
function torsoPath() {
  ctx.beginPath();
  ctx.moveTo(-112, -276);
  ctx.bezierCurveTo(-88, -330, 84, -336, 120, -268);
  ctx.bezierCurveTo(150, -212, 132, -96, 100, -24);
  ctx.bezierCurveTo(78, 30, -70, 34, -94, -22);
  ctx.bezierCurveTo(-126, -92, -132, -220, -112, -276);
  ctx.closePath();
}

function torso() {
  torsoPath(); ctx.fillStyle = INK; ctx.fill();
  ctx.save(); torsoPath(); ctx.clip();
  ctx.fillStyle = PAL.heroBlue; ctx.fillRect(-200, -380, 400, 460);
  ctx.fillStyle = rg(122, -232, 20, -8, -54, 306, [
    [0, 'rgba(198,234,255,0.75)'], [0.32, 'rgba(28,76,176,0.24)'], [1, 'rgba(3,16,62,0.98)'],
  ]);
  ctx.fillRect(-200, -380, 400, 460);
  ctx.restore();

  /* Cream chest ruff. It has to read as fur GROWING out of the chest, so the
     lower edge is a run of soft points, not the bottom of an oval. */
  /* Runs from the collarbone down the front of the body and narrows to a
     point at the belly, the way a chest blaze actually grows. */
  const chest = () => {
    ctx.beginPath();
    ctx.moveTo(-58, -282);
    ctx.bezierCurveTo(-14, -300, 30, -286, 44, -246);
    ctx.bezierCurveTo(56, -212, 34, -140, -16, -74);
    ctx.quadraticCurveTo(-26, -110, -44, -108);
    ctx.bezierCurveTo(-72, -160, -80, -224, -74, -252);
    ctx.bezierCurveTo(-70, -270, -66, -278, -58, -282);
    ctx.closePath();
  };
  ctx.save(); ctx.globalAlpha = 0.55; ctx.filter = 'blur(12px)';
  ctx.fillStyle = '#030c26'; chest(); ctx.fill(); ctx.restore();
  ctx.save(); chest(); ctx.clip(); ctx.translate(2, -6);
  /* a stop darker than the muzzle: the face has to stay the brightest cream */
  ctx.fillStyle = lg(46, -292, -60, -110, [[0, '#f0e0bc'], [0.34, '#dccca6'], [1, '#7d6238']]);
  ctx.fillRect(-200, -340, 340, 300);
  ctx.fillStyle = rg(34, -268, 8, 34, -268, 130, [[0, 'rgba(255,236,192,0.42)'], [1, 'rgba(255,236,192,0)']]);
  ctx.fillRect(-200, -340, 340, 300);
  ctx.restore();
  innerShade(chest, 20, 0.35, '#3b2a10');
  litEdge(chest, 11, 7, 11, 0.8);

  /* head casts onto the chest */
  ctx.save(); torsoPath(); ctx.clip();
  ctx.globalAlpha = 0.42; ctx.filter = 'blur(26px)'; ctx.fillStyle = '#030b22';
  ctx.beginPath(); ctx.ellipse(-38, -292, 176, 88, -0.2, 0, TAU); ctx.fill();
  ctx.restore();

  /* Deltoid on the near shoulder and a rib/hip break, so the torso stops
     being one tapering blue blob. */
  ctx.save(); torsoPath(); ctx.clip();
  const delt = () => {
    ctx.beginPath();
    ctx.moveTo(-142, -256);
    ctx.bezierCurveTo(-150, -312, -88, -336, -50, -304);
    ctx.bezierCurveTo(-26, -282, -40, -232, -74, -218);
    ctx.bezierCurveTo(-108, -204, -136, -222, -142, -256);
    ctx.closePath();
  };
  ctx.fillStyle = rg(-84, -300, 8, -96, -272, 116, [
    [0, 'rgba(150,204,255,0.42)'], [1, 'rgba(150,204,255,0)'],
  ]);
  delt(); ctx.fill();
  ctx.strokeStyle = 'rgba(4,18,62,0.34)'; ctx.lineWidth = 9;
  ctx.filter = 'blur(5px)';
  ctx.beginPath(); ctx.moveTo(-44, -300); ctx.bezierCurveTo(-24, -262, -42, -226, -80, -212); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-118, -46); ctx.bezierCurveTo(-40, -12, 60, -18, 128, -58); ctx.stroke();
  ctx.restore();

  innerShade(torsoPath, 30, 0.4);
  litEdge(torsoPath, 19, 6, 19, 0.95);
  coolEdge(torsoPath, 14, -2, 12);
}

/** A gloved fist: one silhouette, knuckles and thumb modelled inside it. */
function fistPath() {
  ctx.beginPath();
  ctx.moveTo(-12, -98);
  ctx.bezierCurveTo(54, -102, 98, -58, 96, 6);
  ctx.bezierCurveTo(94, 66, 44, 106, -16, 100);
  ctx.bezierCurveTo(-42, 97, -60, 88, -72, 72);
  ctx.bezierCurveTo(-98, 84, -122, 60, -108, 34);
  ctx.bezierCurveTo(-120, 12, -110, -24, -90, -36);
  ctx.bezierCurveTo(-88, -70, -54, -96, -12, -98);
  ctx.closePath();
}

/**
 * "dim" pushes a glove down the value scale. Two gloves, a chest patch and a
 * muzzle all painted at full cream gives four equally bright blobs and no
 * focal point — the muzzle has to win, so the trailing glove runs dark.
 */
function fist(cx, cy, s, rot, dim) {
  const d = dim === undefined ? 1 : dim;
  const mix = (a, b) => {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
    const f = (u, v) => Math.round(u + (v - u) * (1 - d));
    return 'rgb(' + f(r1, r2) + ',' + f(g1, g2) + ',' + f(b1, b2) + ')';
  };
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(s, s);

  fistPath(); ctx.fillStyle = INK; ctx.fill();
  ctx.save(); fistPath(); ctx.clip();
  ctx.fillStyle = lg(72, -86, -86, 94, [
    [0, mix(CREAM_LIT, '#8a7a5c')], [0.34, mix(PAL.heroCream, '#7d6c4d')], [1, mix('#8d6d2a', '#3c3016')],
  ]);
  ctx.fillRect(-160, -130, 300, 270);
  ctx.globalAlpha = d;
  ctx.fillStyle = rg(44, -58, 6, 44, -58, 124, [[0, 'rgba(255,250,228,0.85)'], [1, 'rgba(255,250,228,0)']]);
  ctx.fillRect(-160, -130, 300, 270);
  ctx.globalAlpha = 1;
  /* four knuckle bumps read as light on the leading edge, dark between */
  for (let i = 0; i < 4; i++) {
    const y = -64 + i * 40;
    ctx.fillStyle = rg(-70, y, 3, -70, y, 40, [[0, 'rgba(255,246,214,0.55)'], [1, 'rgba(255,246,214,0)']]);
    ctx.beginPath(); ctx.arc(-70, y, 40, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(88,58,20,0.42)'; ctx.lineWidth = 7;
  for (const y of [-44, -4, 36]) {
    ctx.beginPath(); ctx.moveTo(-94, y); ctx.quadraticCurveTo(-58, y + 8, -22, y + 4); ctx.stroke();
  }
  /* thumb wrapped across the front */
  ctx.strokeStyle = 'rgba(88,58,20,0.5)'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(-104, 30); ctx.bezierCurveTo(-72, 44, -40, 54, -6, 48); ctx.stroke();
  ctx.restore();

  innerShade(fistPath, 20, 0.38, '#33240c');
  litEdge(fistPath, 15, 8, 14, d);
  coolEdge(fistPath, 12, -4, 10);
  ctx.restore();
}

/** A soft cuff where the glove meets the arm, cut to the arm's angle. */
function cuff(x, y, ang, r) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = '#071c4c';
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.42, r, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(190,226,255,0.4)';
  ctx.beginPath(); ctx.ellipse(r * 0.16, -r * 0.14, r * 0.16, r * 0.78, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

/**
 * The leading arm, driven forward and DOWN toward the lens. Short upper arm,
 * a real elbow, and a glove scaled up so the punch has some foreshortening
 * instead of reading as a flat side-on wave.
 */
function frontArm() {
  /* One continuous arm through a soft elbow. A separate upper arm, elbow ball
     and forearm reads as a doll with visible joints. */
  const pts = [[-92, -288], [-152, -204], [-248, -220], [-316, -246]];
  const ws = [66, 52, 46, 40];

  ctx.save();
  ctx.globalAlpha = 0.42; ctx.filter = 'blur(28px)';
  ctx.fillStyle = '#03081a';
  taper(pts.map((p) => [p[0] + 28, p[1] + 52]), ws.map((w) => w * 1.2)); ctx.fill();
  ctx.restore();

  /* motion ghosts trailing back along the swing */
  ctx.save();
  for (let i = 3; i >= 1; i--) {
    ctx.globalAlpha = 0.075;
    ctx.fillStyle = '#79b7ff';
    taper(pts.map((p) => [p[0] + i * 34, p[1] - i * 22]), ws); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-350 + i * 34, -250 - i * 22, 82, 86, 0.3, 0, TAU); ctx.fill();
  }
  ctx.restore();

  limb(pts, ws, '#8cc0ff', PAL.heroBlue, '#123268');
  cuff(-316, -246, -0.2, 40);
  fist(-352, -254, 0.86, -0.2, 0.88);
}

/** The trailing arm, swept back so only a dark glove clears the shoulder. */
function backArm() {
  const pts = [[102, -270], [178, -208], [240, -152]];
  const ws = [56, 44, 36];
  limb(pts, ws, '#3d7cd0', '#1d4e91', '#081c4e');
  cuff(240, -152, 0.9, 34);
  fist(264, -122, 0.56, 1.2, 0.16);
}

/** The lightning-bolt tail — his most identifiable cue after the quills. */
function tail() {
  /* Small, dark and tucked against the small of the back. Blown up and lit it
     stopped reading as a tail and started reading as a shard of glass stuck
     to his hip. */
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  bloom(168, 34, 130, 'rgba(80,196,255,ALPHA)', 0.15);
  ctx.restore();

  ctx.save();
  ctx.translate(148, 26); ctx.rotate(0.5); ctx.scale(2.3, 2.3);
  const p = () => {
    ctx.beginPath();
    ctx.moveTo(-6, -13); ctx.lineTo(30, -32); ctx.lineTo(13, -6);
    ctx.lineTo(50, 3); ctx.lineTo(9, 14); ctx.lineTo(21, 32);
    ctx.lineTo(-8, 12); ctx.closePath();
  };
  p(); ctx.fillStyle = INK; ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.save(); p(); ctx.clip();
  ctx.fillStyle = lg(-8, -32, 50, 32, [[0, '#1c4a9e'], [1, '#0a1e50']]);
  ctx.fillRect(-12, -36, 66, 72);
  ctx.restore();
  ctx.save(); p(); ctx.clip(); ctx.translate(-1.6, -1.8); p();
  ctx.lineWidth = 2.6; ctx.strokeStyle = 'rgba(255,196,126,0.5)'; ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(140,224,255,0.34)';
  ctx.beginPath();
  ctx.moveTo(-2, -9); ctx.lineTo(18, -19); ctx.lineTo(8, -5);
  ctx.lineTo(29, 2); ctx.lineTo(6, 9); ctx.lineTo(12, 19); ctx.lineTo(-3, 8); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/**
 * A sneaker, drawn in profile: heel counter, an instep that rises, a blunt
 * toe box, one white stripe and a white sole. The old version stacked three
 * white bands on a red capsule, which read as a barber's pole.
 */
function shoe(x, y, ang, scale, near) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang); ctx.scale(scale, scale);

  /* Heel counter at the back, instep rising over the laces, a blunt toe box
     that lifts clear of the sole. The old outline was a plain capsule, which
     is why it read as a sweet rather than a sneaker. */
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-92, -34);
    ctx.bezierCurveTo(-106, -8, -104, 20, -86, 34);
    ctx.lineTo(78, 34);
    ctx.bezierCurveTo(112, 30, 124, -4, 108, -28);
    ctx.bezierCurveTo(86, -46, 40, -56, -6, -58);
    ctx.bezierCurveTo(-46, -60, -76, -52, -92, -34);
    ctx.closePath();
  };
  /* sock cuff, overlapping the shoe's collar so the two are one object */
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.roundRect(-84, -98, 96, 62, 24); ctx.fill();
  ctx.fillStyle = near ? '#f6f9ff' : '#aab0be';
  ctx.beginPath(); ctx.roundRect(-79, -94, 86, 54, 21); ctx.fill();
  ctx.fillStyle = near ? 'rgba(136,154,188,0.45)' : 'rgba(56,66,86,0.45)';
  ctx.beginPath(); ctx.roundRect(-79, -60, 86, 20, 9); ctx.fill();

  body(); ctx.fillStyle = INK; ctx.fill();
  ctx.save(); body(); ctx.clip();
  ctx.fillStyle = near
    ? lg(0, -62, 0, 36, [[0, '#ff8090'], [0.3, PAL.heroShoe], [1, '#6e0e1e']])
    : lg(0, -62, 0, 36, [[0, '#c94b59'], [0.32, '#a92236'], [1, '#500c19']]);
  ctx.fillRect(-120, -72, 260, 120);
  /* one narrow diagonal stripe, running from the laces down to the sole */
  ctx.fillStyle = near ? '#f9fcff' : '#c2c8d4';
  ctx.beginPath();
  ctx.moveTo(-18, -54); ctx.lineTo(6, -52); ctx.lineTo(30, 36); ctx.lineTo(4, 36);
  ctx.closePath(); ctx.fill();
  /* white sole, a clear slab the shoe stands on */
  ctx.fillStyle = near ? '#f2f5fc' : '#9aa1af';
  ctx.beginPath();
  ctx.moveTo(-100, 4); ctx.bezierCurveTo(-106, 22, -96, 36, -76, 38);
  ctx.lineTo(84, 38); ctx.bezierCurveTo(112, 34, 124, 14, 120, -2);
  ctx.lineTo(104, 8); ctx.lineTo(-96, 14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(6,12,30,0.26)'; ctx.fillRect(-104, 4, 232, 6);
  /* toe cap and heel seams */
  ctx.strokeStyle = 'rgba(56,6,16,0.42)'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(56, -52); ctx.quadraticCurveTo(74, -18, 68, 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-62, -50); ctx.quadraticCurveTo(-74, -20, -70, 8); ctx.stroke();
  ctx.restore();

  innerShade(body, 11, 0.24, '#2a0510');
  litEdge(body, 13, 8, 14, 0.75);
  ctx.restore();
}

/** Legs: an explicit drive/recovery pair over a translucent motion wheel. */
function legs() {
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.filter = 'blur(22px)';
  ctx.fillStyle = 'rgba(47,125,246,0.3)';
  ctx.beginPath(); ctx.ellipse(1782, 1026, 268, 130, -0.18, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(190,232,255,0.45)'; ctx.lineWidth = 20;
  ctx.beginPath(); ctx.ellipse(1782, 1026, 268, 130, -0.18, 0.5, 3.0); ctx.stroke();
  ctx.restore();

  /* Trailing leg: thigh back, a real knee, shin extended, toe pointed. It sits
     against the darkest part of the backdrop, so it runs a stop brighter. */
  limb([[1858, 872], [1966, 928], [2034, 992], [2092, 1040]],
    [56, 44, 34, 27], '#7ab2f5', '#3672c4', '#12306e');
  shoe(2142, 1062, -0.44, 0.98, false);

  /* Leading leg: knee driven forward, shin dropping to a planted foot. */
  limb([[1746, 916], [1622, 954], [1576, 1032], [1544, 1106]],
    [64, 50, 40, 33], '#8cc0ff', PAL.heroBlue, '#123268');
  shoe(1496, 1142, 0.2, 1.14, true);
}

/** Blue afterimages of the whole figure, offset back along the path. */
function afterimages() {
  const ghost = (dx, dy, a) => {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(HIP.x + dx, HIP.y + dy);
    ctx.rotate(LEAN);
    ctx.fillStyle = PAL.heroBlue;
    torsoPath(); ctx.fill();
    ctx.save();
    ctx.translate(HEAD_AT.x, HEAD_AT.y); ctx.rotate(HEAD_TILT); ctx.scale(HEAD_SCALE, HEAD_SCALE);
    craniumPath(); ctx.fill();
    quillPath(); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(-20, 150, 150, 100, 0, 0, TAU); ctx.fill();
    ctx.restore();
  };
  ghost(238, -18, 0.16);
  ghost(452, -36, 0.09);
  ghost(676, -56, 0.05);
}

/**
 * Air tearing past him. The streaks live at the figure's own level, so the
 * speed is happening TO him instead of decorating the sky behind him.
 */
function wake() {
  const rnd = lcg(4409);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 30; i++) {
    const y = 250 + rnd() * 820;
    const x0 = 1440 + rnd() * 880;
    const len = 260 + rnd() * 760;
    ctx.strokeStyle = lg(x0, y, x0 + len, y, [
      [0, 'rgba(180,226,255,0)'], [0.2, 'rgba(206,238,255,0.55)'], [1, 'rgba(120,190,255,0)'],
    ]);
    ctx.lineWidth = 1.5 + rnd() * 5.5;
    ctx.globalAlpha = 0.2 + rnd() * 0.38;
    ctx.filter = 'blur(' + (1 + rnd() * 3).toFixed(1) + 'px)';
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + len, y - rnd() * 44); ctx.stroke();
  }
  ctx.restore();
}

function contactDust() {
  const rnd = lcg(5501);
  ctx.save();
  /* Soft, irregular and blurred. Crisp circles with a crisp highlight inside
     them read as soap bubbles, which is exactly what the last pass produced. */
  ctx.filter = 'blur(20px)';
  for (let i = 0; i < 24; i++) {
    const t = rnd();
    const x = 1540 + t * 740 + (rnd() - 0.5) * 90;
    const y = GROUND + 40 - Math.pow(t, 1.6) * 122 - rnd() * 28;
    const r = 20 + t * 62 + rnd() * 20;
    ctx.globalAlpha = 0.15 * (1 - t * 0.45);
    ctx.fillStyle = rnd() > 0.55 ? '#ffc490' : '#a8968a';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.6 + rnd() * 0.5), rnd() * TAU, 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.save();
  /* Kicked-up grit. Sparse and low: scattered across the figure it stopped
     reading as debris and started reading as litter on the artwork. */
  for (let i = 0; i < 7; i++) {
    const x = 1700 + rnd() * 560, y = GROUND - rnd() * 70;
    ctx.globalAlpha = 0.3 + rnd() * 0.26;
    ctx.fillStyle = rnd() > 0.5 ? '#e0c79c' : '#8fa3b8';
    ctx.save(); ctx.translate(x, y); ctx.rotate(rnd() * TAU);
    ctx.fillRect(-3, -2.5, 9 + rnd() * 12, 5);
    ctx.restore();
  }
  ctx.restore();
}

function hero() {
  /* dark halo, then a cool wake: he has to separate from a sky that is
     brightest exactly where he is. */
  /* Aerial perspective: the midground loses contrast right behind him so the
     lit figure reads as being in front of it rather than pasted onto it. */
  ctx.save();
  ctx.globalAlpha = 0.62; ctx.filter = 'blur(110px)';
  ctx.fillStyle = '#040a1e';
  ctx.beginPath(); ctx.ellipse(1790, 640, 640, 620, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 0.44; ctx.filter = 'blur(70px)';
  ctx.beginPath(); ctx.ellipse(1760, 620, 400, 460, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  bloom(1860, 600, 620, 'rgba(60,124,255,ALPHA)', 0.15);
  ctx.restore();

  /* Ground contact. The key light is up and to the RIGHT, so the shadow rakes
     down-left; without a directional cast shadow he floats above the grass. */
  ctx.save();
  ctx.globalAlpha = 0.5; ctx.filter = 'blur(34px)';
  ctx.fillStyle = '#02050d';
  ctx.beginPath(); ctx.ellipse(1830, 1152, 430, 46, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.62; ctx.filter = 'blur(13px)';
  ctx.fillStyle = '#01030a';
  ctx.beginPath(); ctx.ellipse(1418, 1168, 168, 25, -0.06, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(2064, 1112, 122, 17, -0.16, 0, TAU); ctx.fill();
  ctx.restore();

  afterimages();

  ctx.save();
  ctx.translate(HIP.x, HIP.y);
  ctx.rotate(LEAN);
  tail();
  ctx.restore();

  legs();

  ctx.save();
  ctx.translate(HIP.x, HIP.y);
  ctx.rotate(LEAN);
  /* The trailing arm goes BEHIND the torso. It used to be drawn after it, so
     the whole limb sat on top of the chest and the figure read as a front-on
     character with two complete arms pasted onto a body that is in profile.
     He is sprinting across the frame: the near arm reads in full, and the far
     one should only show the part that clears the shoulder. */
  backArm();
  torso();
  ctx.save();
  ctx.translate(HEAD_AT.x, HEAD_AT.y);
  ctx.rotate(HEAD_TILT);
  ctx.scale(HEAD_SCALE, HEAD_SCALE);
  drawHead();
  ctx.restore();
  frontArm();
  ctx.restore();

  contactDust();
}

/* ================================== LOGO =================================== */

function boltGlyph(x, y, s, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(1.5, -10); ctx.lineTo(-6, 1); ctx.lineTo(-1, 1);
  ctx.lineTo(-2.5, 10); ctx.lineTo(6, -2); ctx.lineTo(1, -2); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function spacedText(text, cx, y, spacing) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  const align = ctx.textAlign;
  ctx.textAlign = 'left';
  let x = cx - total / 2;
  chars.forEach((c, i) => { ctx.fillText(c, x, y); x += widths[i] + spacing; });
  ctx.textAlign = align;
}

/** Dark scrim under the type block — the sky behind it is far too busy. */
function typeScrim() {
  ctx.fillStyle = lg(0, 0, 1320, 0, [
    [0, 'rgba(3,6,16,0.82)'], [0.5, 'rgba(3,6,16,0.56)'], [1, 'rgba(3,6,16,0)'],
  ]);
  ctx.fillRect(0, 0, 1320, H);
}

function logo(cx, base) {
  const word = 'BOLT';
  const size = 322;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  bloom(cx, base - 110, 600, 'rgba(52,124,255,ALPHA)', 0.34);
  ctx.restore();
  boltGlyph(cx + 458, base - 148, 14, PAL.crystal, 0.15);
  boltGlyph(cx - 462, base - 186, 10, PAL.crystal, 0.1);

  ctx.save();
  ctx.translate(cx, base);
  ctx.transform(1, 0, -0.16, 1, 0, 0);   // forward shear, same as drawTitleLogo
  ctx.textAlign = 'center';
  ctx.font = '700 ' + size + 'px "DejaVu Sans Mono", monospace';

  for (let d = 32; d >= 1; d--) {
    ctx.fillStyle = d > 17 ? '#02060f' : '#0b1f4c';
    ctx.fillText(word, d, d * 0.85);
  }
  ctx.lineJoin = 'round';
  ctx.lineWidth = 40; ctx.strokeStyle = '#02050d'; ctx.strokeText(word, 0, 0);
  ctx.lineWidth = 20; ctx.strokeStyle = '#0d2352'; ctx.strokeText(word, 0, 0);

  ctx.fillStyle = lg(0, -size * 0.78, 0, size * 0.13, [
    [0, '#f4fbff'], [0.28, '#8ad6ff'], [0.52, '#2f7df6'], [0.86, '#1a4fb8'], [1, '#6fbcff'],
  ]);
  ctx.fillText(word, 0, 0);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-500, -300); ctx.lineTo(-410, -300); ctx.lineTo(-150, 90); ctx.lineTo(-240, 90);
  ctx.closePath(); ctx.clip();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#ffffff'; ctx.fillText(word, 0, 0);
  ctx.restore();
  ctx.restore();

  /* CHRONO RUSH chevron plate */
  const rw = 690, rh = 94, rx = cx - rw / 2, ry = base + 58;
  ctx.beginPath();
  ctx.moveTo(rx + 34, ry); ctx.lineTo(rx + rw - 34, ry); ctx.lineTo(rx + rw, ry + rh / 2);
  ctx.lineTo(rx + rw - 34, ry + rh); ctx.lineTo(rx + 34, ry + rh); ctx.lineTo(rx, ry + rh / 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(4,8,18,0.92)'; ctx.fill();
  ctx.strokeStyle = 'rgba(75,225,255,0.9)'; ctx.lineWidth = 5; ctx.stroke();
  ctx.fillStyle = 'rgba(75,225,255,0.2)'; ctx.fillRect(rx + 44, ry + 11, rw - 88, 3);

  ctx.font = '700 53px "DejaVu Sans Mono", monospace';
  ctx.fillStyle = PAL.crystal;
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = 'rgba(75,225,255,0.85)'; ctx.shadowBlur = 24;
  spacedText('CHRONO RUSH', cx, ry + rh / 2 + 19, 11);
  ctx.restore();
  boltGlyph(rx + 48, ry + rh / 2, 2.1, PAL.crystal);
  boltGlyph(rx + rw - 48, ry + rh / 2, 2.1, PAL.crystal);

  /* tagline */
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#eaf3ff';
  ctx.font = '900 46px Lato, sans-serif';
  ctx.fillText('RUN THE FOUR STOLEN HOURS.', cx, ry + rh + 90);
  ctx.fillText('TAKE TOMORROW BACK.', cx, ry + rh + 146);
  ctx.font = '700 32px Lato, sans-serif';
  ctx.fillStyle = 'rgba(255,217,74,0.95)';
  spacedText('42 ACTS  ·  FREE & OPEN SOURCE  ·  NO DOWNLOAD', cx, ry + rh + 216, 2);
  ctx.restore();
}

/* ================================= FINISH ================================== */

function vignette() {
  ctx.fillStyle = rg(1240, 590, 280, 1240, 610, 1440, [
    [0, 'rgba(0,0,0,0)'], [0.58, 'rgba(2,3,10,0.2)'], [1, 'rgba(2,3,10,0.88)'],
  ]);
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = lg(0, H - 230, 0, H, [[0, 'rgba(3,5,13,0)'], [1, 'rgba(3,5,13,0.7)']]);
  ctx.fillRect(0, H - 230, W, 230);
  ctx.fillStyle = lg(0, 0, 0, 170, [[0, 'rgba(2,3,10,0.6)'], [1, 'rgba(2,3,10,0)']]);
  ctx.fillRect(0, 0, W, 170);
}

/* Grain is applied AFTER the Lanczos downscale, in the render pipeline below.
   Painting 2 px dots on a 2400 px canvas and then halving it averaged them
   straight back out again — the old pass cost time and did nothing. */

/* ================================== DRAW =================================== */

sky();
chronoCore();
ridge();
horizonHaze();
hills();
speedStreaks();
treeline();
groundStrip();
ringsBehind();
hero();
wake();
ringsFront();
foregroundGrass();
shards();
motes();
vignette();
typeScrim();
logo(608, 462);

window.__coverDone = true;
`;

/* -------------------------------------------------------------------------- */
/*  Render pipeline                                                            */
/* -------------------------------------------------------------------------- */

const PAGE = `<!doctype html><meta charset="utf-8">
<link rel="icon" href="data:,">
<style>html,body{margin:0;background:#000}canvas{display:block}</style>
<canvas id="cv" width="2400" height="1260"></canvas>
<script type="module">
await document.fonts.ready;
await document.fonts.load('900 100px Lato');
await document.fonts.load('700 100px "DejaVu Sans Mono"');
${ART}
</script>`;

async function main() {
  const args = process.argv.slice(2);
  const outArg = args.indexOf('--out');
  const targets = outArg >= 0
    ? [path.resolve(args[outArg + 1])]
    : [path.join(REPO, 'docs', 'social-card.png'), path.join(REPO, 'public', 'social-card.png')];

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bolt-cover-'));
  fs.writeFileSync(path.join(tmp, 'index.html'), PAGE);

  const server = createServer((req, res) => {
    const file = path.join(tmp, req.url === '/' ? 'index.html' : path.basename(req.url));
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('nope'); }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const chromium = loadChromium();
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--force-device-scale-factor=1'],
  });
  const page = await browser.newPage({ viewport: { width: 2400, height: 1260 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await page.waitForFunction('window.__coverDone === true', null, { timeout: 30000 })
    .catch(() => { throw new Error('draw failed: ' + errors.join('\n')); });

  const big = path.join(tmp, 'cover-2x.png');
  await page.locator('#cv').screenshot({ path: big });
  if (args.includes('--keep-2x')) fs.copyFileSync(big, path.join(os.tmpdir(), 'bolt-cover-2x.png'));
  await browser.close();
  server.close();
  if (errors.length) console.warn('page errors:', errors.join('\n'));

  for (const target of targets) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    /* Lanczos down to the exact 1.91:1 target. No grain pass: the 2x render
       already dithers the sky ramp on the way down, and ImageMagick +noise
       here pushed the PNG from 660 kB to 1.4 MB for no visible gain. */
    execFileSync('/usr/bin/magick', [
      big, '-filter', 'Lanczos', '-resize', '1200x630!', '-colorspace', 'sRGB',
      '-strip', '-define', 'png:compression-level=9', target,
    ]);
    console.log(target, (fs.statSync(target).size / 1024).toFixed(0) + ' kB');
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

main().catch((e) => { console.error(e); process.exit(1); });
