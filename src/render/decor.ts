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
  | 'mote'
  // Duskmere Coast
  | 'petal'
  | 'seagrass'
  | 'shell'
  | 'shorebird'
  // Noon Tomorrow
  | 'holoSign'
  | 'grate'
  | 'antenna'
  | 'hoverStreak';

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
  let seed = theme === 'gear' ? 90210 : theme === 'crystal' ? 4242 : theme === 'neon' ? 777001 : 1337;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  const items: DecorItem[] = [];
  // The coast is the campaign's first impression, so it is planted denser
  // than the industrial zones; the density gap itself reads as biome flavour.
  const density = theme === 'verdant' ? 0.52 : 0.34;
  for (let tx = 1; tx < map.w - 1; tx++) {
    const y = surfaceAt(map, tx);
    if (y === null) continue;
    // Keep the running lane clear: only decorate some columns.
    if (rnd() > density) continue;
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
    } else if (theme === 'neon') {
      const kind: DecorKind = roll < 0.3 ? 'holoSign' : roll < 0.58 ? 'grate' : roll < 0.82 ? 'antenna' : 'lamp';
      items.push({ kind, x, y, phase, scale });
    } else {
      const kind: DecorKind =
        roll < 0.26 ? 'grass'
        : roll < 0.46 ? 'seagrass'
        : roll < 0.62 ? 'flower'
        : roll < 0.78 ? 'shell'
        : roll < 0.96 ? 'bush'
        : 'shorebird'; // rare on purpose: one frozen bird is a story, five are wallpaper
      items.push({ kind, x, y, phase, scale });
    }
  }

  // Drifting points of light above the ground: fireflies in the dusk meadow,
  // cold crystal dust in the vault, hover-lane traffic over the neon city.
  if (theme === 'verdant') {
    // Petals shed by a coast stuck at dusk — they drift, but never land.
    for (let i = 0; i < 55; i++) {
      const tx = 2 + Math.floor(rnd() * (map.w - 4));
      const y = surfaceAt(map, tx);
      if (y === null) continue;
      items.push({ kind: 'petal', x: tx * T + rnd() * T, y: y - 30 - rnd() * 200, phase: rnd() * 6.283, scale: 0.6 + rnd() * 0.7 });
    }
  }
  if (theme === 'verdant' || theme === 'crystal' || theme === 'neon') {
    const kind: DecorKind = theme === 'crystal' ? 'mote' : theme === 'neon' ? 'hoverStreak' : 'firefly';
    const count = theme === 'neon' ? 46 : 90;
    for (let i = 0; i < count; i++) {
      const tx = 2 + Math.floor(rnd() * (map.w - 4));
      const y = surfaceAt(map, tx);
      if (y === null) continue;
      items.push({ kind, x: tx * T + rnd() * T, y: y - 20 - rnd() * 90, phase: rnd() * 6.283, scale: 0.6 + rnd() * 0.8 });
    }
  }

  // Parallax clouds live in the background strip's own coordinate space. The
  // cavern has no sky, so its "clouds" are mist banks and lit dust — more of
  // them, drifting slower, because that layer is the only motion back there.
  // Noon Tomorrow gets a thin, slow smog: its sky is mostly light and haze.
  const clouds: Cloud[] = [];
  const cloudCount = theme === 'gear' ? 7 : theme === 'crystal' ? 16 : theme === 'neon' ? 6 : 9;
  for (let i = 0; i < cloudCount; i++) {
    clouds.push({
      x: rnd() * viewW,
      y: 24 + rnd() * (viewH * (theme === 'crystal' ? 0.7 : 0.42)),
      scale: 0.6 + rnd() * 1.3,
      drift: (theme === 'gear' ? 0.10 : theme === 'crystal' ? 0.06 : theme === 'neon' ? 0.05 : 0.16) + rnd() * 0.22,
      alpha: (theme === 'gear' || theme === 'neon' ? 0.10 : 0.16) + rnd() * 0.14,
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
      case 'petal':
        drawPetal(ctx, d, frame, animate);
        break;
      case 'seagrass':
        drawSeagrass(ctx, d, sway);
        break;
      case 'shell':
        drawShell(ctx, d);
        break;
      case 'shorebird':
        drawShorebird(ctx, d);
        break;
      case 'holoSign':
        drawHoloSign(ctx, d, frame, animate);
        break;
      case 'grate':
        drawGrate(ctx, d, frame, animate);
        break;
      case 'antenna':
        drawAntenna(ctx, d, frame, animate);
        break;
      case 'hoverStreak':
        drawHoverStreak(ctx, d, frame, animate);
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

/** Tall coastal blades — the meadow grass's leggy shoreline cousin. */
function drawPetal(ctx: CanvasRenderingContext2D, d: DecorItem, frame: number, animate: boolean): void {
  const t = animate ? frame : 0;
  // A lazy figure-eight drift: time is stuck, so the fall never completes.
  const x = d.x + Math.sin(t / 60 + d.phase) * 22;
  const y = d.y + Math.sin(t / 37 + d.phase * 2) * 9;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t / 45 + d.phase) * 0.8);
  ctx.fillStyle = ['#ff8fb1', '#ffb03d', '#ffd94a'][Math.floor(d.phase * 2.1) % 3];
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(0, 0, 3.2 * d.scale, 1.8 * d.scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSeagrass(ctx: CanvasRenderingContext2D, d: DecorItem, sway: number): void {
  ctx.save();
  ctx.translate(d.x, d.y);
  for (let i = -2; i <= 2; i++) {
    const h = (13 + (i % 2) * 4 + Math.abs(i)) * d.scale;
    // Sea-green blades with the odd sun-dried one, so the tuft reads coastal.
    ctx.strokeStyle = i === 0 ? '#7c9b4a' : '#3f8e6e';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(i * 1.8, 0);
    // The stalk stays rooted and upright; only the top third leans with the
    // wind. Throwing the whole blade sideways made the tuft read as debris.
    ctx.quadraticCurveTo(i * 1.8 + sway * 2, -h * 0.62, i * 1.8 + sway * 6.5, -h);
    ctx.stroke();
  }
  ctx.restore();
}

/** A washed-up scallop, catching the last of the stuck sun. Static. */
function drawShell(ctx: CanvasRenderingContext2D, d: DecorItem): void {
  ctx.save();
  ctx.translate(d.x, d.y - 1.5 * d.scale);
  ctx.rotate((d.phase - 3.14) * 0.12);
  const r = 3.6 * d.scale;
  ctx.fillStyle = d.phase > 3.6 ? '#f0d6c2' : '#f2c8c8';
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,95,80,0.55)';
  ctx.lineWidth = 0.8;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(i * r * 0.6, -r * 0.78);
    ctx.stroke();
  }
  // Dusk glint along the rim.
  ctx.strokeStyle = 'rgba(255,214,120,0.5)';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, Math.PI * 1.15, Math.PI * 1.6);
  ctx.stroke();
  ctx.restore();
}

/**
 * A shore bird caught mid-hop by the time freeze. Deliberately ignores the
 * animate flag and the wind: everything else on the coast still moves, and
 * one thing that should move but never does is what sells the stolen hour.
 */
function drawShorebird(ctx: CanvasRenderingContext2D, d: DecorItem): void {
  ctx.save();
  ctx.translate(d.x, d.y - 7 * d.scale);
  ctx.scale(d.phase > 3.14 ? d.scale : -d.scale, d.scale);
  // The stopped ripple of its take-off, ruled and still like the sea glints.
  ctx.strokeStyle = 'rgba(255,206,120,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 7, 5, 1.4, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Body, wing thrown up, never coming down.
  ctx.fillStyle = '#2e3348';
  ctx.beginPath();
  ctx.ellipse(0, 0, 4.4, 2.8, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath(); // wing
  ctx.moveTo(-0.5, -1);
  ctx.quadraticCurveTo(-4.5, -7, -8, -7.5);
  ctx.quadraticCurveTo(-4, -4.5, -1.5, -2.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8ddc8'; // breast
  ctx.beginPath();
  ctx.ellipse(1, 1, 2.6, 1.6, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2e3348'; // head + beak
  ctx.beginPath();
  ctx.arc(3.6, -2.2, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(5, -2.6);
  ctx.lineTo(8, -1.9);
  ctx.lineTo(5, -1.4);
  ctx.closePath();
  ctx.fill();
  // Legs trailing the hop.
  ctx.strokeStyle = '#c98a3f';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-1, 2.4);
  ctx.lineTo(-3, 5.4);
  ctx.moveTo(0.6, 2.6);
  ctx.lineTo(-0.8, 5.8);
  ctx.stroke();
  ctx.restore();
}

/** A kerbside holo-sign, flickering the way cheap hard-light does. */
function drawHoloSign(ctx: CanvasRenderingContext2D, d: DecorItem, frame: number, animate: boolean): void {
  const t = animate ? frame : 0;
  // Stuttering duty cycle: mostly on, occasionally dipping — but steady under
  // reduced motion, where flicker is exactly the wrong kind of life.
  const s = Math.sin(t / 7 + d.phase * 3) + Math.sin(t / 2.3 + d.phase);
  const on = !animate ? 0.85 : s > -1.1 ? 1 : 0.3;
  const hue = d.phase > 3.14 ? '255,79,168' : '65,240,255';
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.fillStyle = '#2a2438';
  ctx.fillRect(-1.5, -14 * d.scale, 3, 14 * d.scale);
  const py = -14 * d.scale - 7 * d.scale;
  const g = ctx.createRadialGradient(0, py, 1, 0, py, 16 * d.scale);
  g.addColorStop(0, `rgba(${hue},${0.4 * on})`);
  g.addColorStop(1, `rgba(${hue},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-18, py - 18, 36, 36);
  ctx.fillStyle = `rgba(${hue},${0.28 * on})`;
  ctx.fillRect(-7 * d.scale, py - 5 * d.scale, 14 * d.scale, 10 * d.scale);
  ctx.strokeStyle = `rgba(${hue},${0.9 * on})`;
  ctx.lineWidth = 1;
  ctx.strokeRect(-7 * d.scale, py - 5 * d.scale, 14 * d.scale, 10 * d.scale);
  // Unreadable glyphs — signage, not a message for the player.
  ctx.fillStyle = `rgba(255,255,255,${0.75 * on})`;
  ctx.fillRect(-5 * d.scale, py - 2.4 * d.scale, 7 * d.scale, 1.2);
  ctx.fillRect(-5 * d.scale, py + 0.6 * d.scale, 9 * d.scale, 1.2);
  ctx.restore();
}

/** A street steam grate, breathing the city's heat out through the deck. */
function drawGrate(ctx: CanvasRenderingContext2D, d: DecorItem, frame: number, animate: boolean): void {
  const t = animate ? frame : 0;
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.fillStyle = '#0d0c14';
  ctx.fillRect(-8, -2.5, 16, 3);
  ctx.fillStyle = '#3a3450';
  for (let i = -3; i <= 3; i++) ctx.fillRect(i * 2.4 - 0.6, -2.5, 1.2, 3);
  if (animate) {
    for (let i = 0; i < 3; i++) {
      const p = (t / 60 + i / 3 + d.phase / 6.283) % 1;
      const yy = -4 - p * 26 * d.scale;
      ctx.fillStyle = `rgba(180,168,205,${0.22 * (1 - p)})`;
      ctx.beginPath();
      ctx.arc(Math.sin(p * 4 + d.phase) * 5, yy, (2 + p * 6) * d.scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** A comms mast with a slow aircraft-warning blink. */
function drawAntenna(ctx: CanvasRenderingContext2D, d: DecorItem, frame: number, animate: boolean): void {
  const t = animate ? frame : 0;
  const hh = (20 + d.phase * 2) * d.scale;
  const on = animate ? Math.sin(t / 26 + d.phase) > 0.1 : true;
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.strokeStyle = '#3a3450';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -hh);
  ctx.moveTo(-3.5, -hh * 0.55);
  ctx.lineTo(3.5, -hh * 0.55);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(58,52,80,0.6)'; // guy wires
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -hh * 0.8);
  ctx.lineTo(-6, 0);
  ctx.moveTo(0, -hh * 0.8);
  ctx.lineTo(6, 0);
  ctx.stroke();
  if (on) {
    const g = ctx.createRadialGradient(0, -hh - 2, 0.5, 0, -hh - 2, 7);
    g.addColorStop(0, 'rgba(255,80,110,0.65)');
    g.addColorStop(1, 'rgba(255,80,110,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-8, -hh - 10, 16, 16);
  }
  ctx.fillStyle = on ? '#ff506e' : '#5c2a38';
  ctx.fillRect(-1.2, -hh - 3.2, 2.4, 2.4);
  ctx.restore();
}

/**
 * Hover traffic cutting across the mid-air lanes — the neon zone's firefly.
 * The streak IS the vehicle: at lane speed all you ever see is the light.
 */
function drawHoverStreak(ctx: CanvasRenderingContext2D, d: DecorItem, frame: number, animate: boolean): void {
  const span = 300;
  const dir = d.phase > 3.14 ? 1 : -1;
  const p = animate ? ((frame * (0.9 + d.scale) * 1.6) / span + d.phase / 6.283) % 1 : d.phase / 6.283;
  const x = d.x - (span / 2) * dir + p * span * dir;
  const y = d.y + Math.sin(d.phase * 3) * 4;
  const len = 20 * d.scale;
  const hue = d.phase % 1.5 > 0.75 ? '255,79,168' : '65,240,255';
  ctx.save();
  const g = ctx.createLinearGradient(x - dir * len, y, x, y);
  g.addColorStop(0, `rgba(${hue},0)`);
  g.addColorStop(1, `rgba(${hue},0.6)`);
  ctx.fillStyle = g;
  ctx.fillRect(Math.min(x, x - dir * len), y - 1, len, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(x - 1, y - 1, 2, 2);
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
    // Clouds wear the biome's light: smog in the foundry, warm underlit dusk
    // banks on the coast, pale exhaust haze over the neon city.
    ctx.fillStyle =
      theme === 'gear' ? `rgba(150,150,170,${c.alpha})`
      : theme === 'neon' ? `rgba(240,222,205,${c.alpha})`
      : theme === 'verdant' ? `rgba(255,178,130,${c.alpha})`
      : `rgba(210,224,245,${c.alpha})`;
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
