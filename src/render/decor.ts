import { PHYS } from '../physics/constants.ts';
import type { TileMap } from '../physics/TileMap.ts';
import type { LevelTheme } from '../game/Level.ts';
import { PAL } from './painter.ts';

const T = PHYS.tile;

/**
 * Animated scenery. Everything here is decoration only — no collision, no
 * gameplay effect — but a world that breathes (grass bending in the wind,
 * torches guttering, gears turning, steam venting) reads as alive rather than
 * as a static backdrop.
 *
 * Placement is deterministic (seeded LCG) and computed once at level load by
 * walking the terrain surface, so decor always sits ON the ground without the
 * level author placing anything by hand.
 */

export type DecorKind =
  | 'grass'
  | 'flower'
  | 'bush'
  | 'firefly'
  | 'torch'
  | 'gear'
  | 'steam'
  | 'lamp'
  | 'shardCluster'
  | 'vein'
  | 'drip'
  | 'mote';

export interface DecorItem {
  kind: DecorKind;
  x: number;
  y: number;
  /** Per-item phase so neighbours never animate in lockstep. */
  phase: number;
  scale: number;
}

/** A drifting background cloud/smog bank, positioned in parallax space. */
export interface Cloud {
  x: number;
  y: number;
  scale: number;
  /** px per frame; negative drifts left. */
  drift: number;
  alpha: number;
}

export interface DecorSet {
  items: DecorItem[];
  clouds: Cloud[];
}

/** Surface y at a tile column on layer 0, or null when there is no ground. */
function surfaceAt(map: TileMap, tx: number): number | null {
  for (let ty = 0; ty < map.h; ty++) {
    const h = Math.max(...map.get(tx, ty, 0).heights);
    if (h > 0) {
      // Skip one-way platforms: decor belongs on real ground.
      if (map.get(tx, ty, 0).oneWay) continue;
      return (ty + 1) * T - h;
    }
  }
  return null;
}

/**
 * Builds the decor set for a level. `theme` selects the vocabulary: verdant
 * gets plants and fireflies, gear gets torches, vents and turning machinery,
 * crystal gets glowing clusters, floor veins and cave water.
 */
export function buildDecor(map: TileMap, theme: LevelTheme, viewW = 640, viewH = 360): DecorSet {
  let seed = theme === 'gear' ? 90210 : theme === 'crystal' ? 4242 : 1337;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  const items: DecorItem[] = [];
  for (let tx = 1; tx < map.w - 1; tx++) {
    const y = surfaceAt(map, tx);
    if (y === null) continue;
    // Keep the running lane clear: only decorate some columns.
    if (rnd() > 0.34) continue;
    const x = tx * T + rnd() * T;
    const phase = rnd() * Math.PI * 2;
    const scale = 0.75 + rnd() * 0.55;
    const roll = rnd();
    if (theme === 'gear') {
      const kind: DecorKind = roll < 0.34 ? 'torch' : roll < 0.62 ? 'steam' : roll < 0.84 ? 'gear' : 'lamp';
      items.push({ kind, x, y, phase, scale });
    } else if (theme === 'crystal') {
      const kind: DecorKind = roll < 0.46 ? 'shardCluster' : roll < 0.78 ? 'vein' : 'drip';
      items.push({ kind, x, y, phase, scale });
    } else {
      const kind: DecorKind = roll < 0.5 ? 'grass' : roll < 0.76 ? 'flower' : 'bush';
      items.push({ kind, x, y, phase, scale });
    }
  }

  // Drifting points of light above the ground: fireflies in the meadow, cold
  // crystal dust in the vault.
  if (theme === 'verdant' || theme === 'crystal') {
    const kind: DecorKind = theme === 'crystal' ? 'mote' : 'firefly';
    for (let i = 0; i < 90; i++) {
      const tx = 2 + Math.floor(rnd() * (map.w - 4));
      const y = surfaceAt(map, tx);
      if (y === null) continue;
      items.push({ kind, x: tx * T + rnd() * T, y: y - 20 - rnd() * 90, phase: rnd() * 6.283, scale: 0.6 + rnd() * 0.8 });
    }
  }

  // Parallax clouds live in the background strip's own coordinate space. The
  // cavern has no sky, so its "clouds" are mist banks and lit dust — more of
  // them, drifting slower, because that layer is the only motion back there.
  const clouds: Cloud[] = [];
  const cloudCount = theme === 'gear' ? 7 : theme === 'crystal' ? 16 : 9;
  for (let i = 0; i < cloudCount; i++) {
    clouds.push({
      x: rnd() * viewW,
      y: 24 + rnd() * (viewH * (theme === 'crystal' ? 0.7 : 0.42)),
      scale: 0.6 + rnd() * 1.3,
      drift: (theme === 'gear' ? 0.10 : theme === 'crystal' ? 0.06 : 0.16) + rnd() * 0.22,
      alpha: (theme === 'gear' ? 0.10 : 0.16) + rnd() * 0.14,
    });
  }
  return { items, clouds };
}

/* --------------------------------- Drawing -------------------------------- */

/**
 * Draws the ground decor in world space (call inside the camera transform).
 * `wind` is a global sway signal so a whole meadow leans together.
 */
export function drawDecor(
  ctx: CanvasRenderingContext2D,
  set: DecorSet,
  frame: number,
  camX: number,
  viewW: number,
  animate: boolean,
): void {
  const wind = animate ? Math.sin(frame / 55) * 0.55 + Math.sin(frame / 17) * 0.18 : 0;
  for (const d of set.items) {
    if (d.x < camX - 40 || d.x > camX + viewW + 40) continue;
    const sway = animate ? wind + Math.sin(frame / 23 + d.phase) * 0.22 : 0;
    switch (d.kind) {
      case 'grass':
        drawGrassTuft(ctx, d, sway);
        break;
      case 'flower':
        drawFlower(ctx, d, sway);
        break;
      case 'bush':
        drawBush(ctx, d, sway);
        break;
      case 'firefly':
        drawFirefly(ctx, d, frame, animate);
        break;
      case 'torch':
        drawTorch(ctx, d, frame, animate);
        break;
      case 'steam':
        drawSteamVent(ctx, d, frame, animate);
        break;
      case 'gear':
        drawGearCog(ctx, d, frame, animate);
        break;
      case 'lamp':
        drawLamp(ctx, d, frame, animate);
        break;
      case 'shardCluster':
        drawShardCluster(ctx, d, frame, animate);
        break;
      case 'vein':
        drawFloorVein(ctx, d, frame, animate);
        break;
      case 'drip':
        drawCaveDrip(ctx, d, frame, animate);
        break;
      case 'mote':
        drawMote(ctx, d, frame, animate);
        break;
    }
  }
}

function drawGrassTuft(ctx: CanvasRenderingContext2D, d: DecorItem, sway: number): void {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.strokeStyle = PAL.grassDark;
  ctx.lineWidth = 1.5;
  for (let i = -1; i <= 1; i++) {
    const h = (7 + i * 2) * d.scale;
    ctx.beginPath();
    ctx.moveTo(i * 2.5, 0);
    ctx.quadraticCurveTo(i * 2.5 + sway * 3, -h * 0.6, i * 2.5 + sway * 7, -h);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFlower(ctx: CanvasRenderingContext2D, d: DecorItem, sway: number): void {
  const h = 11 * d.scale;
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.strokeStyle = PAL.grassDark;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(sway * 3, -h * 0.6, sway * 6, -h);
  ctx.stroke();
  const petals = ['#ffd94a', '#ff8fb1', '#b7a4ff'][Math.floor(d.phase * 1.9) % 3];
  ctx.translate(sway * 6, -h);
  ctx.fillStyle = petals;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + d.phase;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 2.4 * d.scale, Math.sin(a) * 2.4 * d.scale, 1.7 * d.scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath();
  ctx.arc(0, 0, 1.3 * d.scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBush(ctx: CanvasRenderingContext2D, d: DecorItem, sway: number): void {
  ctx.save();
  ctx.translate(d.x + sway * 1.6, d.y);
  ctx.fillStyle = PAL.hillNear;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(i * 4.5 * d.scale, -3 * d.scale, 4.6 * d.scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = PAL.grassDark;
  ctx.beginPath();
  ctx.arc(-2 * d.scale, -5 * d.scale, 3 * d.scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFirefly(ctx: CanvasRenderingContext2D, d: DecorItem, frame: number, animate: boolean): void {
  const t = animate ? frame : 0;
  const x = d.x + Math.sin(t / 70 + d.phase) * 16;
  const y = d.y + Math.cos(t / 53 + d.phase * 1.7) * 10;
  const pulse = animate ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 14 + d.phase)) : 0.7;
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 0, x, y, 7 * d.scale);
  g.addColorStop(0, `rgba(255,240,150,${0.75 * pulse})`);
  g.addColorStop(1, 'rgba(255,240,150,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 8, y - 8, 16, 16);
  ctx.fillStyle = `rgba(255,250,200,${pulse})`;
  ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
  ctx.restore();
}

function drawTorch(ctx: CanvasRenderingContext2D, d: DecorItem, frame: number, animate: boolean): void {
  const t = animate ? frame : 0;
  ctx.save();
  ctx.translate(d.x, d.y);
  // Bracket.
  ctx.fillStyle = '#3d4452';
  ctx.fillRect(-2, -16, 4, 16);
  ctx.fillRect(-4, -18, 8, 3);
  // Flame: three stacked flickering tongues.
  const flick = Math.sin(t / 5 + d.phase) * 0.5 + Math.sin(t / 3.1 + d.phase * 2) * 0.3;
  const h = (11 + flick * 3) * d.scale;
  const glow = ctx.createRadialGradient(0, -22, 1, 0, -22, 26 * d.scale);
  glow.addColorStop(0, 'rgba(255,170,60,0.42)');
  glow.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-28, -48, 56, 56);
  const tongue = (w: number, hh: number, color: string, dx: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(dx - w, -19);
    ctx.quadraticCurveTo(dx - w * 0.4 + flick, -19 - hh * 0.6, dx + flick * 2, -19 - hh);
    ctx.quadraticCurveTo(dx + w * 0.4 + flick, -19 - hh * 0.6, dx + w, -19);
    ctx.closePath();
    ctx.fill();
  };
  tongue(5 * d.scale, h, '#ff7b28', 0);
  tongue(3.2 * d.scale, h * 0.7, '#ffb03d', 0);
  tongue(1.6 * d.scale, h * 0.42, '#fff3b0', 0);
  ctx.restore();
}

function drawSteamVent(ctx: CanvasRenderingContext2D, d: DecorItem, frame: number, animate: boolean): void {
  const t = animate ? frame : 0;
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.fillStyle = '#3d4452';
  ctx.fillRect(-5, -5, 10, 5);
  ctx.fillStyle = '#565d6e';
  ctx.fillRect(-6, -7, 12, 2);
  // Puffs rise, expand and fade on a loop.
  for (let i = 0; i < 3; i++) {
    const p = ((t / 46 + i / 3 + d.phase / 6.283) % 1);
    const yy = -8 - p * 34 * d.scale;
    const r = (2.5 + p * 7) * d.scale;
    ctx.fillStyle = `rgba(200,214,235,${0.34 * (1 - p)})`;
    ctx.beginPath();
    ctx.arc(Math.sin(p * 5 + d.phase) * 4, yy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGearCog(ctx: CanvasRenderingContext2D, d: DecorItem, frame: number, animate: boolean): void {
  const t = animate ? frame : 0;
  const r = 9 * d.scale;
  ctx.save();
  ctx.translate(d.x, d.y - r - 2);
  ctx.rotate((t / 90) * (d.phase > 3.14 ? -1 : 1) + d.phase);
  ctx.fillStyle = '#3d4452';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#565d6e';
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((i / 8) * Math.PI * 2);
    ctx.fillRect(r - 1, -1.6 * d.scale, 3.4 * d.scale, 3.2 * d.scale);
    ctx.restore();
  }
  ctx.fillStyle = '#23262e';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLamp(ctx: CanvasRenderingContext2D, d: DecorItem, frame: number, animate: boolean): void {
  const t = animate ? frame : 0;
  // Slow blink with an occasional stutter, like a failing factory lamp.
  const on = animate ? (Math.sin(t / 21 + d.phase) > -0.35 ? 1 : 0.25) : 1;
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.fillStyle = '#3d4452';
  ctx.fillRect(-1.5, -14, 3, 14);
  const g = ctx.createRadialGradient(0, -16, 1, 0, -16, 16 * d.scale);
  g.addColorStop(0, `rgba(255,190,80,${0.5 * on})`);
  g.addColorStop(1, 'rgba(255,190,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-18, -32, 36, 32);
  ctx.fillStyle = `rgba(255,214,120,${on})`;
  ctx.beginPath();
  ctx.arc(0, -16, 2.6 * d.scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Crystal outcrop: a few prisms growing out of the rock, breathing light. The
 * Chrono Vault is lit by its own walls, so these are the zone's lamps as well
 * as its scenery — the pulse is what stops a dark cavern reading as dead.
 */
function drawShardCluster(ctx: CanvasRenderingContext2D, d: DecorItem, frame: number, animate: boolean): void {
  const t = animate ? frame : 0;
  const pulse = animate ? 0.55 + 0.45 * Math.sin(t / 26 + d.phase) : 0.8;
  // Magenta outcrops are the minority: a rare accent reads richer than an
  // even split, which just looks like two zones fighting.
  const hue = d.phase > 4.6 ? '224,90,216' : '75,225,255';
  const heights = [9, 20, 13];
  ctx.save();
  ctx.translate(d.x, d.y);
  const glow = ctx.createRadialGradient(0, -9 * d.scale, 1, 0, -9 * d.scale, 30 * d.scale);
  glow.addColorStop(0, `rgba(${hue},${0.32 * pulse})`);
  glow.addColorStop(1, `rgba(${hue},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(-32 * d.scale, -42 * d.scale, 64 * d.scale, 52 * d.scale);
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * 4.6 * d.scale;
    const hh = (heights[i] + Math.sin(d.phase + i * 2) * 2.5) * d.scale;
    const w = 3.1 * d.scale;
    const lean = Math.sin(d.phase + i) * 1.6 * d.scale;
    ctx.fillStyle = `rgba(${hue},${0.42 + 0.16 * pulse})`;
    ctx.beginPath();
    ctx.moveTo(off - w, 1);
    ctx.lineTo(off - w * 0.7, -hh * 0.6);
    ctx.lineTo(off + lean, -hh);
    ctx.lineTo(off + w * 0.7, -hh * 0.6);
    ctx.lineTo(off + w, 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.28 + 0.42 * pulse})`;
    ctx.beginPath();
    ctx.moveTo(off + lean, -hh);
    ctx.lineTo(off + w * 0.45, -hh * 0.5);
    ctx.lineTo(off, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** A lit seam running through the cavern floor, breathing along its length. */
function drawFloorVein(ctx: CanvasRenderingContext2D, d: DecorItem, frame: number, animate: boolean): void {
  const t = animate ? frame : 0;
  const pulse = animate ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 38 + d.phase)) : 0.75;
  const len = 17 * d.scale;
  // Magenta by default: the terrain cap is cyan, and a cyan seam painted on it
  // simply disappears.
  const hue = d.phase < 1.6 ? '75,225,255' : '224,90,216';
  ctx.save();
  // Seated below the crystal crust, on the rock: painted on the bright cap it
  // is invisible, and painted above it, it reads as a wire lying on the floor.
  ctx.translate(d.x, d.y + 8);
  ctx.lineCap = 'round';
  const seam = (dir: number, scale: number) => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(dir * len * 0.4 * scale, 1.4);
    ctx.lineTo(dir * len * 0.72 * scale, -0.6);
    ctx.lineTo(dir * len * scale, 1);
    ctx.stroke();
  };
  ctx.strokeStyle = `rgba(${hue},${0.22 * pulse})`;
  ctx.lineWidth = 5;
  seam(-1, 1);
  seam(1, 1);
  ctx.strokeStyle = `rgba(255,235,255,${0.6 * pulse})`;
  ctx.lineWidth = 1.3;
  seam(-1, 1);
  seam(1, 1);
  ctx.strokeStyle = `rgba(${hue},${0.55 * pulse})`;
  seam(d.phase > 3.14 ? 1 : -1, 0.45);
  ctx.restore();
}

/** Groundwater finding its way through the rock: drip, land, ripple, repeat. */
function drawCaveDrip(ctx: CanvasRenderingContext2D, d: DecorItem, frame: number, animate: boolean): void {
  const fall = 42 * d.scale;
  ctx.save();
  // Below the crust like the veins: a pool drawn on the bright cap vanishes.
  ctx.translate(d.x, d.y + 7);
  // The pool it has been carving is always there, even when nothing is falling.
  ctx.fillStyle = 'rgba(90,205,238,0.30)';
  ctx.beginPath();
  ctx.ellipse(0, -1, 7 * d.scale, 2 * d.scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(200,245,255,0.3)';
  ctx.fillRect(-4 * d.scale, -2, 5 * d.scale, 1);

  const p = animate ? (frame / 96 + d.phase / 6.283) % 1 : 0.05;
  if (p < 0.72) {
    // Free fall, so the drop accelerates instead of sliding down at a
    // constant rate — the one cue that sells it as water and not a spark.
    const q = p / 0.72;
    const y = -fall + q * q * fall;
    ctx.fillStyle = `rgba(185,240,255,${Math.min(1, q * 4) * 0.75})`;
    ctx.beginPath();
    ctx.ellipse(0, y, 1.3 * d.scale, (2.2 + q * 1.6) * d.scale, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const q = (p - 0.72) / 0.28;
    ctx.strokeStyle = `rgba(170,238,255,${0.5 * (1 - q)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, -1, (2 + q * 9) * d.scale, (0.8 + q * 2.6) * d.scale, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Crystal dust hanging in the cavern air — the vault's cold answer to fireflies. */
function drawMote(ctx: CanvasRenderingContext2D, d: DecorItem, frame: number, animate: boolean): void {
  const t = animate ? frame : 0;
  const x = d.x + Math.sin(t / 96 + d.phase) * 12;
  // Motes settle downward and are nudged back up, so the air reads as still
  // and heavy rather than breezy like the meadow.
  const y = d.y + Math.cos(t / 71 + d.phase * 1.4) * 14;
  const pulse = animate ? 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t / 22 + d.phase)) : 0.65;
  const hue = d.phase > 4.9 ? '224,90,216' : '140,240,255';
  ctx.save();
  // A tight halo around a hard core: widen it and the mote stops being dust
  // and starts looking like a bubble.
  const g = ctx.createRadialGradient(x, y, 0, x, y, 4.5 * d.scale);
  g.addColorStop(0, `rgba(${hue},${0.55 * pulse})`);
  g.addColorStop(1, `rgba(${hue},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - 6, y - 6, 12, 12);
  ctx.fillStyle = `rgba(235,252,255,${0.85 * pulse})`;
  ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
  ctx.restore();
}

/**
 * Draws drifting clouds into the parallax background, in screen space. They
 * move independently of the camera so the sky is never static.
 */
export function drawClouds(
  ctx: CanvasRenderingContext2D,
  set: DecorSet,
  frame: number,
  camX: number,
  viewW: number,
  theme: LevelTheme,
  animate: boolean,
): void {
  const t = animate ? frame : 0;
  ctx.save();
  for (const c of set.clouds) {
    // Camera parallax plus an independent horizontal drift.
    const span = viewW + 260;
    let x = (c.x - camX * 0.08 - t * c.drift) % span;
    if (x < -130) x += span;
    if (theme === 'crystal') {
      drawCavernDrift(ctx, c, x, t);
      continue;
    }
    const w = 46 * c.scale;
    const h = 11 * c.scale;
    ctx.fillStyle =
      theme === 'gear' ? `rgba(150,150,170,${c.alpha})` : `rgba(210,224,245,${c.alpha})`;
    ctx.beginPath();
    ctx.ellipse(x, c.y, w, h, 0, 0, Math.PI * 2);
    ctx.ellipse(x - w * 0.55, c.y + h * 0.3, w * 0.55, h * 0.72, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.6, c.y + h * 0.25, w * 0.5, h * 0.66, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * The cavern's parallax layer. Nothing is backlit down here, so a cloud shape
 * would read as a hole in the rock: the big banks are cold mist catching the
 * crystal glow, and everything smaller is lit dust sinking through it.
 */
function drawCavernDrift(ctx: CanvasRenderingContext2D, c: Cloud, x: number, t: number): void {
  const y = c.y + Math.sin(t / 130 + c.x) * 7;
  if (c.scale > 1.15) {
    const w = 74 * c.scale;
    const h = 15 * c.scale;
    ctx.save();
    // The squash goes on BEFORE the gradient is built: canvas gradients are
    // evaluated in the transform active when they are painted, so a circle
    // defined up front would be dragged off the shape it is meant to fill.
    ctx.translate(x, y);
    ctx.scale(1, h / w);
    const mist = ctx.createRadialGradient(0, 0, 1, 0, 0, w);
    mist.addColorStop(0, `rgba(125,155,235,${c.alpha * 0.5})`);
    mist.addColorStop(0.55, `rgba(90,80,180,${c.alpha * 0.26})`);
    mist.addColorStop(1, 'rgba(90,80,180,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(-w, -w, w * 2, w * 2);
    ctx.restore();
    return;
  }
  const r = 5 * c.scale;
  const hue = c.drift > 0.2 ? '224,90,216' : '140,240,255';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${hue},${0.35 + c.alpha * 1.6})`);
  g.addColorStop(1, `rgba(${hue},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = `rgba(240,252,255,${0.4 + c.alpha})`;
  ctx.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);
}
