/**
 * Gameplay objects: everything the player collects, touches or fears.
 *
 * Same rules as the hero (render/hero.ts): every object has a dark keyline,
 * a light source from the upper left, and a colour that carries its meaning —
 * gold = reward, red/white = spring (go up), cyan = Chrono (collectible),
 * steel + red = danger. The old set was flat primitives with no outline
 * (spikes were three grey triangles, the crab a red rectangle with two
 * squares for claws), so hazards and pickups dissolved into the backdrops.
 *
 * Geometry matches the collision boxes in game/entities.ts exactly; only the
 * look changed. Enemies go through a shared Outliner for a clean silhouette.
 */
import { Outliner } from './sprite.ts';
import { drawText } from './font.ts';

const TAU = Math.PI * 2;
const INK = '#0a1030';
const GOLD = '#ffd94a';

const enemySprite = new Outliner(56, true);

/* ---------------------------------- Rings ---------------------------------- */

/**
 * The ring: a fat gold torus spinning about its vertical axis. It never goes
 * fully edge-on (a ring that collapses to a line reads as a glitch in a still
 * frame) and the glint stays on the lit side.
 */
export function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
  const t = frame / 11 + x * 0.013;
  const sq = Math.max(0.32, Math.abs(Math.cos(t)));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sq, 1);
  ctx.lineWidth = 5.2;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.arc(0, 0, 5.6, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = '#d99a17';
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = GOLD;
  ctx.beginPath();
  ctx.arc(-0.3, -0.3, 5.4, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#fff7cc';
  ctx.beginPath();
  ctx.arc(0, 0, 5.4, Math.PI * 1.05, Math.PI * 1.5);
  ctx.stroke();
  ctx.restore();
}

/* ------------------------------ Chrono crystal ----------------------------- */

export function drawCrystal(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
  const bob = Math.sin(frame / 30) * 2;
  ctx.save();
  ctx.translate(x, y + bob);
  const pulse = 0.5 + 0.5 * Math.sin(frame / 14);
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 20);
  glow.addColorStop(0, `rgba(75,225,255,${0.4 + pulse * 0.2})`);
  glow.addColorStop(1, 'rgba(75,225,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-20, -20, 40, 40);
  const turn = Math.cos(frame / 24);
  ctx.scale(0.75 + 0.25 * Math.abs(turn), 1);
  const gem = new Path2D('M0 -11 L7 -2 L0 11 L-7 -2 Z');
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke(gem);
  ctx.fillStyle = '#1f8fc4';
  ctx.fill(gem);
  // Facets: the lit one swaps sides as it turns.
  ctx.fillStyle = turn > 0 ? '#7ee9ff' : '#4bc6ee';
  ctx.fill(new Path2D('M0 -11 L7 -2 L0 1 Z'));
  ctx.fillStyle = turn > 0 ? '#4bc6ee' : '#7ee9ff';
  ctx.fill(new Path2D('M0 -11 L-7 -2 L0 1 Z'));
  ctx.fillStyle = '#2aa7d8';
  ctx.fill(new Path2D('M0 1 L7 -2 L0 11 Z'));
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill(new Path2D('M0 -11 L2.6 -4 L0 -2.6 L-2.6 -4 Z'));
  ctx.restore();
  // Sparkle orbiting the gem.
  if (frame % 50 < 12) {
    const k = (frame % 50) / 12;
    sparkle(ctx, x + 8 - k * 4, y + bob - 9 + k * 3, 3 * Math.sin(k * Math.PI));
  }
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  if (r <= 0.1) return;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.6);
  ctx.lineTo(x + r * 0.35, y);
  ctx.lineTo(x, y + r * 1.6);
  ctx.lineTo(x - r * 0.35, y);
  ctx.closePath();
  ctx.moveTo(x - r * 1.6, y);
  ctx.lineTo(x, y + r * 0.35);
  ctx.lineTo(x + r * 1.6, y);
  ctx.lineTo(x, y - r * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* --------------------------------- Spring ---------------------------------- */

/** Red base, steel coil, yellow plate. Compresses for a beat when fired. */
export function drawSpring(ctx: CanvasRenderingContext2D, x: number, y: number, cooldown: number, dir: 'up' | 'left' | 'right' = 'up'): void {
  const fired = cooldown > 8;
  const coil = fired ? 10 : 4;
  ctx.save();
  ctx.translate(x, y);
  if (dir === 'left') ctx.rotate(-Math.PI / 2);
  if (dir === 'right') ctx.rotate(Math.PI / 2);
  ctx.lineJoin = 'round';
  // Base.
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(-9.5, 1.5, 19, 7.5, 2);
  ctx.fill();
  ctx.fillStyle = '#c23a4b';
  ctx.beginPath();
  ctx.roundRect(-8.5, 2.5, 17, 5.5, 1.5);
  ctx.fill();
  ctx.fillStyle = '#ff6b7c';
  ctx.fillRect(-7.5, 2.8, 15, 1.2);
  // Coil.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(-4, 2);
  for (let i = 0; i <= 3; i++) ctx.lineTo(i % 2 ? -4 : 4, 2 - (coil * (i + 1)) / 4);
  ctx.stroke();
  ctx.strokeStyle = '#c9d0dc';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // Plate.
  const py = 2 - coil - 4;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(-9.5, py - 1, 19, 6, 2);
  ctx.fill();
  ctx.fillStyle = '#f2c230';
  ctx.beginPath();
  ctx.roundRect(-8.5, py, 17, 4, 1.5);
  ctx.fill();
  ctx.fillStyle = '#fff3b0';
  ctx.fillRect(-7, py + 0.4, 14, 1.2);
  ctx.restore();
}

/* --------------------------------- Monitor --------------------------------- */

/** Item box: a chunky TV with the prize on its screen. */
export function drawMonitor(ctx: CanvasRenderingContext2D, x: number, y: number, kind: string, broken: boolean, frame = 0): void {
  ctx.save();
  ctx.translate(x, y);
  if (broken) {
    // Smashed shell: open frame, dark screen, shards.
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.roundRect(-12, 2, 24, 10, 2);
    ctx.fill();
    ctx.fillStyle = '#4b5263';
    ctx.beginPath();
    ctx.roundRect(-11, 3, 22, 8, 1.5);
    ctx.fill();
    ctx.fillStyle = '#1b1e28';
    ctx.fillRect(-8, 4, 16, 5);
    ctx.restore();
    return;
  }
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(-13, -13, 26, 26, 4);
  ctx.fill();
  const shell = ctx.createLinearGradient(0, -12, 0, 12);
  shell.addColorStop(0, '#e9edf4');
  shell.addColorStop(1, '#8f98aa');
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.roundRect(-12, -12, 24, 24, 3);
  ctx.fill();
  // Screen.
  ctx.fillStyle = '#10141f';
  ctx.beginPath();
  ctx.roundRect(-9, -9, 18, 15, 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(-9, -9, 18, 15, 2);
  ctx.clip();
  if (kind === 'rings10') {
    drawRing(ctx, 0, -1.5, frame);
  } else if (kind === 'shield') {
    const g = ctx.createRadialGradient(-2, -4, 1, 0, -1.5, 6.5);
    g.addColorStop(0, '#e6f4ff');
    g.addColorStop(1, '#3d8bff');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -1.5, 5.5, 0, TAU);
    ctx.fill();
  } else {
    // Speed shoes.
    ctx.fillStyle = '#e8384f';
    ctx.beginPath();
    ctx.roundRect(-6, -3, 12, 5, 2.4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-1.5, -3, 2, 5);
    ctx.fillStyle = GOLD;
    ctx.fillRect(-6, 1.5, 12, 1.5);
  }
  // Scanline shimmer.
  ctx.fillStyle = 'rgba(160,220,255,0.10)';
  ctx.fillRect(-9, -9 + ((frame / 2) % 15), 18, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.moveTo(-9, -9);
  ctx.lineTo(1, -9);
  ctx.lineTo(-9, 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Base slot.
  ctx.fillStyle = '#5a6376';
  ctx.fillRect(-9, 8, 18, 2);
  ctx.restore();
}

/* ---------------------------------- Spikes --------------------------------- */

export function drawSpikes(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  // Mount plate.
  ctx.fillStyle = INK;
  ctx.fillRect(-9, 3, 18, 4);
  ctx.fillStyle = '#3d4452';
  ctx.fillRect(-8.5, 3.5, 17, 3);
  for (let i = -1; i <= 1; i++) {
    const cx = i * 5.4;
    const spike = new Path2D();
    spike.moveTo(cx - 2.8, 4);
    spike.lineTo(cx, -7);
    spike.lineTo(cx + 2.8, 4);
    spike.closePath();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = INK;
    ctx.stroke(spike);
    ctx.fillStyle = '#9aa3b5';
    ctx.fill(spike);
    ctx.fillStyle = '#eef1f7';
    ctx.beginPath();
    ctx.moveTo(cx - 0.4, -5.6);
    ctx.lineTo(cx - 2, 3.4);
    ctx.lineTo(cx - 0.6, 3.4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/* -------------------------------- Checkpoint ------------------------------- */

/** Lamp post: the head spins and turns from steel to Chrono cyan when passed. */
export function drawCheckpoint(ctx: CanvasRenderingContext2D, x: number, y: number, active: boolean, frame = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = INK;
  ctx.fillRect(-2.6, -30, 5.2, 30);
  ctx.fillRect(-6, -3, 12, 4);
  ctx.fillStyle = '#b8c0d0';
  ctx.fillRect(-1.6, -29, 3.2, 28);
  ctx.fillStyle = '#e6eaf2';
  ctx.fillRect(-1.6, -29, 1, 28);
  ctx.fillStyle = '#5a6376';
  ctx.fillRect(-5, -2, 10, 2);
  // Head.
  const spin = active ? Math.cos(frame / 5) : 1;
  ctx.translate(0, -34);
  if (active) {
    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, 14);
    glow.addColorStop(0, 'rgba(75,225,255,0.55)');
    glow.addColorStop(1, 'rgba(75,225,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-14, -14, 28, 28);
  }
  ctx.scale(Math.max(0.35, Math.abs(spin)), 1);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, TAU);
  ctx.fill();
  const g = ctx.createRadialGradient(-2, -2, 0.5, 0, 0, 5);
  g.addColorStop(0, active ? '#e6fdff' : '#ffffff');
  g.addColorStop(1, active ? '#2aa7d8' : '#e8384f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 4.8, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/* ---------------------------------- Goal ----------------------------------- */

/**
 * The goal signpost. It shows Dr. Yolk until BOLT runs past, then spins and
 * lands on BOLT's emblem — the classic payoff, told with the face on the sign.
 */
export function drawGoal(ctx: CanvasRenderingContext2D, x: number, y: number, spinning: number, frame: number, passed = false): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = INK;
  ctx.fillRect(-2.6, -40, 5.2, 40);
  ctx.fillStyle = '#b8c0d0';
  ctx.fillRect(-1.6, -39, 3.2, 38);
  ctx.fillStyle = '#5a6376';
  ctx.fillRect(-6, -2, 12, 2);
  const spinT = spinning > 0 ? (120 - spinning) / 120 : 1;
  const ang = spinning > 0 ? frame / 3 : 0;
  const sq = Math.cos(ang);
  ctx.translate(0, -52);
  ctx.scale(Math.max(0.06, Math.abs(sq)), 1);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, TAU);
  ctx.fill();
  const showBolt = spinning > 0 ? sq > 0 && spinT > 0.5 : passed;
  ctx.fillStyle = '#eef1f7';
  ctx.beginPath();
  ctx.arc(0, 0, 11.5, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = showBolt ? '#2f7df6' : '#e8384f';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (showBolt) {
    // BOLT's emblem: a blue lightning bolt.
    ctx.fillStyle = '#2f7df6';
    ctx.fill(new Path2D('M1.5 -8 L-5 1 L-0.8 1 L-2.4 8 L5 -1.6 L0.8 -1.6 Z'));
  } else {
    // Yolk's face: the egg, the goggles, the moustache.
    ctx.fillStyle = '#f2b03d';
    ctx.beginPath();
    ctx.ellipse(0, 0.5, 6.5, 8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7fe0ff';
    ctx.beginPath();
    ctx.arc(-2.6, -2.6, 1.8, 0, TAU);
    ctx.arc(2.6, -2.6, 1.8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6a3a1e';
    ctx.beginPath();
    ctx.ellipse(-2.4, 2.6, 3, 1.3, 0.3, 0, TAU);
    ctx.ellipse(2.4, 2.6, 3, 1.3, -0.3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/* --------------------------------- Enemies --------------------------------- */

/** SnapCrab: a beach badnik — red shell, steel pincers, stalk eyes. */
export function drawSnapCrab(ctx: CanvasRenderingContext2D, x: number, y: number, xsp: number, frame = 0): void {
  const dir = xsp >= 0 ? 1 : -1;
  const step = Math.sin(frame / 4);
  enemySprite.paint((c) => {
    c.scale(dir, 1);
    c.lineCap = 'round';
    // Legs.
    c.strokeStyle = '#8b2230';
    c.lineWidth = 1.8;
    for (let i = 0; i < 3; i++) {
      const lx = -6 + i * 5;
      const k = (i % 2 ? step : -step) * 1.5;
      c.beginPath();
      c.moveTo(lx, 2);
      c.lineTo(lx - 2 + k, 7);
      c.stroke();
    }
    // Claws on arms, snapping.
    const snap = Math.max(0, Math.sin(frame / 7)) * 0.5;
    for (const side of [-1, 1]) {
      c.strokeStyle = '#8b2230';
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(side * 6, -2);
      c.lineTo(side * 11, -6);
      c.stroke();
      c.save();
      c.translate(side * 12, -8);
      c.fillStyle = '#c9d0dc';
      c.beginPath();
      c.ellipse(0, 0, 3.6, 2.8, 0, 0, TAU);
      c.fill();
      c.fillStyle = '#10141f';
      c.beginPath();
      c.moveTo(side * 1, 0);
      c.lineTo(side * 4.5, -1.8 - snap * 2);
      c.lineTo(side * 4.5, 1.8 + snap * 2);
      c.closePath();
      c.fill();
      c.restore();
    }
    // Shell.
    const g = c.createLinearGradient(0, -7, 0, 4);
    g.addColorStop(0, '#ff6b5e');
    g.addColorStop(1, '#c2283a');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(0, -1, 9, 6, 0, Math.PI, 0);
    c.lineTo(8, 3);
    c.lineTo(-8, 3);
    c.closePath();
    c.fill();
    c.fillStyle = '#ffd0c8';
    c.globalAlpha = 0.5;
    c.beginPath();
    c.ellipse(-3, -4, 3, 1.4, -0.3, 0, TAU);
    c.fill();
    c.globalAlpha = 1;
    c.fillStyle = '#4b5263';
    c.fillRect(-8, 1.5, 16, 2);
    // Stalk eyes.
    for (const ex of [-2.5, 2.5]) {
      c.strokeStyle = '#8b2230';
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(ex, -5);
      c.lineTo(ex, -9);
      c.stroke();
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(ex, -10, 2.2, 0, TAU);
      c.fill();
      c.fillStyle = INK;
      c.beginPath();
      c.arc(ex + 0.8, -10, 1.1, 0, TAU);
      c.fill();
    }
  });
  enemySprite.stamp(ctx, x, y, INK, 1.3);
}

/** BuzzDrone: a hornet-bot with a rotor and a stinger. */
export function drawBuzzDrone(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, frame: number): void {
  enemySprite.paint((c) => {
    c.scale(dir >= 0 ? 1 : -1, 1);
    // Rotor blur.
    const spin = Math.sin(frame / 1.3);
    c.fillStyle = 'rgba(220,230,245,0.55)';
    c.beginPath();
    c.ellipse(0, -11, 9 * Math.abs(spin) + 2, 1.6, 0, 0, TAU);
    c.fill();
    c.fillStyle = '#4b5263';
    c.fillRect(-1, -11, 2, 4);
    // Abdomen with stripes and stinger.
    c.fillStyle = '#f2c230';
    c.beginPath();
    c.ellipse(-5, 1, 6, 4.5, 0.25, 0, TAU);
    c.fill();
    c.fillStyle = '#1b1e28';
    c.fillRect(-7, -3, 1.8, 8);
    c.fillRect(-3.8, -3.4, 1.8, 8);
    c.fillStyle = '#c9d0dc';
    c.beginPath();
    c.moveTo(-10, 3);
    c.lineTo(-14, 6);
    c.lineTo(-9.5, 5.5);
    c.closePath();
    c.fill();
    // Head pod.
    const g = c.createLinearGradient(0, -7, 0, 5);
    g.addColorStop(0, '#ff6b5e');
    g.addColorStop(1, '#b02236');
    c.fillStyle = g;
    c.beginPath();
    c.arc(4, -2, 5.5, 0, TAU);
    c.fill();
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(6, -3, 2.4, 0, TAU);
    c.fill();
    c.fillStyle = INK;
    c.beginPath();
    c.arc(6.8, -3, 1.2, 0, TAU);
    c.fill();
  });
  enemySprite.stamp(ctx, x, y, INK, 1.3);
}

/** Hopper: a spring-legged badnik that coils, rattles, and leaps. */
export function drawHopper(ctx: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1, grounded: boolean, charge01: number, frame: number): void {
  const coilH = grounded ? 10 - 4.5 * charge01 : 14;
  const rattle = grounded && charge01 > 0.75 ? Math.sin(frame * 2.4) : 0;
  enemySprite.paint((c) => {
    c.translate(0, 12);
    c.scale(dir >= 0 ? 1 : -1, 1);
    c.translate(rattle, 0);
    c.fillStyle = '#2c2838';
    c.fillRect(-6, -2, 12, 2.5);
    c.strokeStyle = '#c9d0dc';
    c.lineWidth = 1.8;
    for (let i = 0; i < 3; i++) {
      const cy = -2 - (coilH / 3) * (i + 0.5);
      c.beginPath();
      c.ellipse(0, cy, 5.5 - i * 0.7, coilH / 7, 0, 0, TAU);
      c.stroke();
    }
    const squash = grounded ? 1 - charge01 * 0.22 : 1.12;
    c.translate(0, -2 - coilH);
    c.scale(1 / Math.sqrt(squash), squash);
    const g = c.createLinearGradient(0, -12, 0, 0);
    g.addColorStop(0, '#ff6b5e');
    g.addColorStop(1, '#c2283a');
    c.fillStyle = g;
    c.beginPath();
    c.roundRect(-8, -12, 16, 12, 6);
    c.fill();
    c.fillStyle = '#4b5263';
    c.fillRect(-8, -4, 16, 2);
    c.fillStyle = '#fff';
    c.beginPath();
    c.ellipse(3, -8, 2.6, 3, 0, 0, TAU);
    c.fill();
    c.fillStyle = INK;
    c.beginPath();
    c.arc(4, -7.6, 1.3, 0, TAU);
    c.fill();
  });
  enemySprite.stamp(ctx, x, y - 12, INK, 1.3);
}

/* --------------------------------- Dash pad -------------------------------- */

export function drawDashPad(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, cooldown: number, frame: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir >= 0 ? 1 : -1, 1);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(-14, -3, 28, 10, 3);
  ctx.fill();
  ctx.fillStyle = cooldown > 8 ? '#3d4452' : '#262b36';
  ctx.beginPath();
  ctx.roundRect(-13, -2, 26, 8, 2);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const lit = (Math.floor(frame / 4) + i) % 3 === 2;
    ctx.fillStyle = lit ? '#bff9ff' : '#38e0c8';
    ctx.globalAlpha = lit ? 1 : 0.55;
    ctx.beginPath();
    ctx.moveTo(-9 + i * 7, -0.5);
    ctx.lineTo(-4 + i * 7, 2);
    ctx.lineTo(-9 + i * 7, 4.5);
    ctx.lineTo(-7 + i * 7, 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Small label floating over a world position (score popups). */
export function drawPopup(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, age: number): void {
  const a = Math.min(1, (40 - age) / 12);
  drawText(ctx, text, x, y - age * 0.6, { size: 6, fill: '#ffffff', outline: INK, outlineWidth: 1.4, align: 'center', alpha: a });
}
