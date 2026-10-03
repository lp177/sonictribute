/**
 * Level props, hazards and bosses that have not moved to their own modules
 * (terrain -> terrain.ts, backdrops -> backdrop.ts, hero -> hero.ts, common
 * objects -> objects.ts, story characters -> characters.ts).
 */
import type { Boss, BossLike } from '../game/Boss.ts';
import type { PressBoss } from '../game/PressBoss.ts';
import type { CrystalBoss } from '../game/CrystalBoss.ts';
import type { LevelTheme } from '../game/Level.ts';
import { AFTERIMAGE_LIFE, AFTERIMAGE_ARM } from '../game/MirageBoss.ts';
import { drawYolkPod, drawYolkHead } from './characters.ts';
import { Outliner } from './sprite.ts';

/** Shared buffer for the bosses' keyline + hit flash. */
const bossSprite = new Outliner(96, true);
const BOSS_INK = '#0a1030';


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

/* -------------------------------- Background ------------------------------- */

/* --------------------------------- Entities -------------------------------- */

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

export function drawGliderPickup(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
  const bob = Math.sin(frame / 22) * 2.5;
  ctx.save();
  ctx.translate(x, y + bob);
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
  glow.addColorStop(0, 'rgba(255,214,120,0.5)');
  glow.addColorStop(1, 'rgba(255,214,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-18, -18, 36, 36);
  // Folded wing: a bright chevron sail on a tiny frame.
  ctx.strokeStyle = '#8a5a32';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.lineTo(0, -4);
  ctx.stroke();
  ctx.fillStyle = '#ffb03d';
  ctx.beginPath();
  ctx.moveTo(-12, -2);
  ctx.quadraticCurveTo(0, -12, 12, -2);
  ctx.lineTo(0, -5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath();
  ctx.moveTo(-12, -2);
  ctx.quadraticCurveTo(0, -12, 12, -2);
  ctx.lineTo(9, -3.4);
  ctx.quadraticCurveTo(0, -10, -9, -3.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Rising-air column: streaming motes, drawn in world space. */
export function drawWindZone(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  frame: number,
  animate: boolean,
): void {
  const w = x1 - x0;
  const h = y1 - y0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();
  const t = animate ? frame : 0;
  // Deterministic streak lattice, phase-shifted per column.
  const cols = Math.max(2, Math.floor(w / 22));
  for (let i = 0; i < cols; i++) {
    const cx = x0 + ((i + 0.5) / cols) * w + Math.sin(i * 2.7) * 5;
    const speed = 2.2 + (i % 3) * 0.8;
    for (let k = 0; k < 3; k++) {
      const phase = ((i * 977 + k * 331) % 1000) / 1000;
      const yy = y1 - (((t * speed) / (h + 40) + phase) % 1) * (h + 40);
      const fade = Math.min(1, (y1 - yy) / 60, (yy - y0 + 40) / 60);
      ctx.strokeStyle = `rgba(220,240,255,${0.28 * Math.max(0, fade)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, yy + 12);
      ctx.lineTo(cx + Math.sin(yy / 30) * 2, yy);
      ctx.stroke();
    }
  }
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
  const dead = boss.phase === 'defeated';
  // Mace on its chain: links, then a spiked steel ball with a keyline.
  const mace = boss.maceBox;
  if (mace) {
    const mp = boss.macePos();
    const ax = boss.x;
    const ay = boss.y + 14;
    const n = 7;
    for (let i = 1; i < n; i++) {
      const lx = ax + ((mp.x - ax) * i) / n;
      const ly = ay + ((mp.y - ay) * i) / n;
      ctx.fillStyle = BOSS_INK;
      ctx.beginPath();
      ctx.arc(lx, ly, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#9aa3b5';
      ctx.beginPath();
      ctx.arc(lx, ly, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(mp.x, mp.y);
    ctx.rotate(frame / 20);
    ctx.fillStyle = BOSS_INK;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.3) * 8, Math.sin(a - 0.3) * 8);
      ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14);
      ctx.lineTo(Math.cos(a + 0.3) * 8, Math.sin(a + 0.3) * 8);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.fillStyle = '#c9d0dc';
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.22) * 8, Math.sin(a - 0.22) * 8);
      ctx.lineTo(Math.cos(a) * 12.4, Math.sin(a) * 12.4);
      ctx.lineTo(Math.cos(a + 0.22) * 8, Math.sin(a + 0.22) * 8);
      ctx.fill();
    }
    const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 9);
    g.addColorStop(0, '#8f98aa');
    g.addColorStop(1, '#2c313c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 8.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  bossSprite.paint((c) => drawYolkPod(c, 0, 0, 0.82, frame, { flame: !dead || frame % 6 < 3, sad: dead }));
  bossSprite.stamp(ctx, boss.x, boss.y, BOSS_INK, 1.4);
  if (flash) bossSprite.ghost(ctx, boss.x, boss.y, '#ffffff', 0.75);
}

function drawPressBoss(ctx: CanvasRenderingContext2D, boss: PressBoss, frame: number): void {
  const flash = boss.invuln > 0 && frame % 4 < 2;
  const open = boss.phase === 'open';
  const warning = boss.phase === 'telegraph' && frame % 8 < 4;
  ctx.save();

  // Ground shockwaves: rippling energy arcs.
  for (const s of boss.shockwaves) {
    if (s.age < 0) continue; // queued rage wave: not in the world yet
    const a = 1 - s.age / 80;
    ctx.strokeStyle = `rgba(255,170,60,${0.9 * a})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(s.x, boss.groundY, 6 + i * 5, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
  bossSprite.paint((c) => pressBody(c, boss, frame, open, warning));
  bossSprite.stamp(ctx, boss.x, boss.y, BOSS_INK, 1.5);
  if (flash) bossSprite.ghost(ctx, boss.x, boss.y, '#ffffff', 0.75);
}

/** The Piston Crusher: a riveted hydraulic ram with Yolk in a glass cab. */
function pressBody(c: CanvasRenderingContext2D, boss: PressBoss, frame: number, open: boolean, warning: boolean): void {
  // Cab on top: glass dome with the doctor inside.
  drawYolkHead(c, 0, -24, 0.62, frame, boss.phase === 'defeated');
  c.fillStyle = 'rgba(160,230,255,0.2)';
  c.strokeStyle = 'rgba(220,245,255,0.6)';
  c.lineWidth = 1;
  c.beginPath();
  c.ellipse(0, -22, 12, 11, 0, Math.PI, 0);
  c.closePath();
  c.fill();
  c.stroke();
  // Hydraulic rails.
  c.fillStyle = '#3d4452';
  c.fillRect(-27, -18, 6, 31);
  c.fillRect(21, -18, 6, 31);
  c.fillStyle = '#9aa3b5';
  c.fillRect(-26, -18, 1.5, 31);
  c.fillRect(22, -18, 1.5, 31);
  // Body.
  const g = c.createLinearGradient(0, -18, 0, 12);
  g.addColorStop(0, warning ? '#b0606a' : '#8a93a6');
  g.addColorStop(1, warning ? '#5a2830' : '#454c5b');
  c.fillStyle = g;
  c.beginPath();
  c.roundRect(-22, -18, 44, 30, 6);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.25)';
  c.fillRect(-19, -16, 38, 2);
  c.fillStyle = '#2c313c';
  c.fillRect(-22, -5, 44, 4);
  for (const rx of [-17, -6, 6, 17]) {
    c.fillStyle = '#c9d0dc';
    c.beginPath();
    c.arc(rx, -10, 1.4, 0, Math.PI * 2);
    c.arc(rx, 6, 1.4, 0, Math.PI * 2);
    c.fill();
  }
  // Vents: glowing (and hittable) only while open.
  const pulse = open ? 0.55 + Math.sin(frame / 4) * 0.35 : 0.08;
  c.fillStyle = `rgba(255,140,40,${pulse})`;
  c.fillRect(-16, 1, 10, 4);
  c.fillRect(6, 1, 10, 4);
  // Crush plate with hazard stripes.
  c.fillStyle = '#1b1e28';
  c.beginPath();
  c.roundRect(-25, 12, 50, 9, 2);
  c.fill();
  c.save();
  c.beginPath();
  c.rect(-24, 14, 48, 5);
  c.clip();
  c.fillStyle = '#f2c230';
  c.fillRect(-24, 14, 48, 5);
  c.fillStyle = '#1b1e28';
  for (let x = -30; x < 30; x += 8) {
    c.beginPath();
    c.moveTo(x, 19);
    c.lineTo(x + 4, 14);
    c.lineTo(x + 8, 14);
    c.lineTo(x + 4, 19);
    c.fill();
  }
  c.restore();
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

  // Yolk in his cockpit, under a glass dome — the same doctor as every rig.
  drawYolkHead(ctx, 0, -26, 0.6, frame, dead);
  ctx.fillStyle = flash ? 'rgba(255,255,255,0.7)' : 'rgba(160,230,255,0.18)';
  ctx.strokeStyle = 'rgba(220,245,255,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, -24, 12, 11, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

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

