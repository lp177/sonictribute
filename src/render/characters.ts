/**
 * Story characters and props, drawn at illustration scale for cutscenes and
 * reused by the bosses: Dr. Yolk in his hover pod, and the Chrono Core.
 *
 * Yolk was a grey rounded rectangle with an orange rounded rectangle on top —
 * the antagonist of the whole campaign, unreadable as a character. He is now
 * an egg-shaped inventor with goggles and a moustache, sitting in a chrome
 * pod with a glass canopy and a thruster: the silhouette tells you "villain
 * in a flying machine" before any detail does. Same keyline + rim-light
 * language as the hero so they belong to one world.
 */

import type { Mood } from '../game/story.ts';

const TAU = Math.PI * 2;
const INK = '#0b0d1a';
const COAT = '#c23a4b';
const COAT_D = '#7a1f2e';
const GLOVE = '#f6f8ff';

/** How Yolk carries his face: a story mood, or the everyday scowl of his rigs. */
export type YolkMood = Mood | 'scowl';

export interface PodOptions {
  /** Thruster flame (flying). */
  flame?: boolean;
  /** What dangles from the claw. */
  holding?: 'core' | 'shard' | null;
  /** Defeated / fleeing: sweat, droopy brows, smoke. */
  sad?: boolean;
  /** His expression in the cockpit (defaults to the scowl, or 'sad'). */
  mood?: YolkMood;
  /** Facing: 1 right, -1 left. */
  dir?: 1 | -1;
}

/** Dr. Yolk in his pod. (x, y) is the pod's centre; ~56 units wide at s = 1. */
export function drawYolkPod(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, frame: number, opts: PodOptions = {}): void {
  const dir = opts.dir ?? 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * dir, s);

  // Thruster flame under the pod.
  if (opts.flame !== false) {
    const f = 0.8 + 0.2 * Math.sin(frame * 0.9) + 0.1 * Math.sin(frame * 2.3);
    const g = ctx.createLinearGradient(0, 14, 0, 14 + 22 * f);
    g.addColorStop(0, 'rgba(255,240,180,0.95)');
    g.addColorStop(0.4, 'rgba(255,150,60,0.8)');
    g.addColorStop(1, 'rgba(255,80,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-7, 14);
    ctx.quadraticCurveTo(0, 14 + 30 * f, 7, 14);
    ctx.closePath();
    ctx.fill();
  }

  // Claw arm with what it carries.
  if (opts.holding) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(14, 8);
    ctx.lineTo(22, 22);
    ctx.stroke();
    ctx.strokeStyle = '#8f96a3';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (opts.holding === 'core') drawChronoCore(ctx, 24, 32, 8, frame);
    else drawShard(ctx, 24, 30, 1, frame, '#4be1ff');
    ctx.strokeStyle = '#5a6070';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(24, 24, 5, Math.PI * 0.15, Math.PI * 0.85, true);
    ctx.stroke();
  }

  // Pod hull: a fat chrome bowl with a dark keyline.
  const hull = new Path2D();
  hull.moveTo(-28, -2);
  hull.quadraticCurveTo(-28, 18, 0, 18);
  hull.quadraticCurveTo(28, 18, 28, -2);
  hull.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke(hull);
  const chrome = ctx.createLinearGradient(0, -4, 0, 18);
  chrome.addColorStop(0, '#f2f4f8');
  chrome.addColorStop(0.45, '#b9c0cc');
  chrome.addColorStop(1, '#6f7686');
  ctx.fillStyle = chrome;
  ctx.fill(hull);
  // Hazard band and a row of lights.
  ctx.fillStyle = '#e8384f';
  ctx.fillRect(-26, 2, 52, 3);
  for (let i = -2; i <= 2; i++) {
    ctx.fillStyle = Math.floor(frame / 8 + i) % 3 === 0 ? '#ffe36a' : '#7a5a20';
    ctx.beginPath();
    ctx.arc(i * 9, 10, 1.6, 0, TAU);
    ctx.fill();
  }

  // Yolk himself, sitting in the pod.
  drawYolk(ctx, 0, -10, frame, opts.mood ?? (opts.sad ? 'sad' : 'scowl'));

  // Glass canopy over him.
  ctx.fillStyle = 'rgba(160,230,255,0.18)';
  ctx.strokeStyle = 'rgba(220,245,255,0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-24, -2);
  ctx.quadraticCurveTo(-24, -34, 0, -34);
  ctx.quadraticCurveTo(24, -34, 24, -2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, -6, 22, Math.PI * 1.18, Math.PI * 1.38);
  ctx.stroke();
  // Rim of the cockpit.
  ctx.fillStyle = '#4b5263';
  ctx.beginPath();
  ctx.roundRect(-28, -4, 56, 5, 2.5);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (opts.sad) {
    for (let i = 0; i < 3; i++) {
      const p = (frame * 0.8 + i * 20) % 60;
      ctx.fillStyle = `rgba(90,90,100,${0.5 - p / 130})`;
      ctx.beginPath();
      ctx.arc(-22 - p * 0.5, -2 - p * 0.6, 4 + p * 0.12, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Yolk's head and collar alone (for the cockpits of his other rigs). */
export function drawYolkHead(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, frame: number, sad = false): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  drawYolk(ctx, 0, 0, frame, sad ? 'sad' : 'scowl');
  ctx.restore();
}

/** The doctor: an egg with goggles, a big moustache and a high collar. */
function drawYolk(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, mood: YolkMood): void {
  ctx.save();
  const bob = mood === 'laugh' ? Math.abs(Math.sin(frame * 0.5)) * 1.6 : Math.sin(frame / 14) * 0.6;
  ctx.translate(x, y - bob);
  // Red coat collar.
  ctx.fillStyle = COAT;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 6, 14, 7, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  face(ctx, frame, mood);
  ctx.restore();
}

/**
 * Yolk's head, drawn around (0, -6): the egg, the goggles, and a face that
 * can act. His brows used to slope the wrong way — raised in the middle, the
 * worried look — and he had no mouth at all, so the villain of the campaign
 * read as mildly concerned. The scowl is now a real one (brows driven down
 * onto the nose), there are teeth under the moustache, and each mood has its
 * own eyes and mouth: scheming behind lit goggles, gloating, laughing with
 * his head thrown back.
 */
function face(ctx: CanvasRenderingContext2D, frame: number, mood: YolkMood, underlit = false): void {
  const laugh = mood === 'laugh';
  const sad = mood === 'sad';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Egg head.
  const egg = new Path2D();
  egg.moveTo(0, -20);
  egg.bezierCurveTo(10, -20, 13, -6, 12, 2);
  egg.bezierCurveTo(11, 9, -11, 9, -12, 2);
  egg.bezierCurveTo(-13, -6, -10, -20, 0, -20);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.stroke(egg);
  const skin = ctx.createRadialGradient(-4, -12, 2, 0, -6, 16);
  skin.addColorStop(0, '#ffe7b0');
  skin.addColorStop(1, '#f2b03d');
  ctx.fillStyle = skin;
  ctx.fill(egg);
  if (underlit) {
    // Lit from below by the thing he stole, the crown of the head lost in
    // shadow: the oldest trick there is for making a face mean harm.
    const shade = ctx.createLinearGradient(0, -20, 0, 9);
    shade.addColorStop(0, 'rgba(46,10,44,0.62)');
    shade.addColorStop(0.5, 'rgba(46,10,44,0.14)');
    shade.addColorStop(0.72, 'rgba(255,200,110,0)');
    shade.addColorStop(1, 'rgba(255,214,130,0.5)');
    ctx.fillStyle = shade;
    ctx.fill(egg);
  }

  // Mouth first: the moustache hangs over its top edge.
  if (laugh) {
    const open = 3.4 + Math.abs(Math.sin(frame * 0.5)) * 1.8;
    ctx.fillStyle = '#5a1020';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-6.5, 2.6);
    ctx.quadraticCurveTo(0, 2.6 + open * 2.1, 6.5, 2.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff8a9a'; // tongue
    ctx.beginPath();
    ctx.ellipse(0, 2.6 + open * 0.8, 2.6, 1.3, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff'; // upper teeth, with a pair of points
    ctx.beginPath();
    ctx.moveTo(-5.4, 2.6);
    ctx.lineTo(5.4, 2.6);
    ctx.lineTo(4.6, 5.2);
    ctx.lineTo(3.4, 3.9);
    ctx.lineTo(-3.4, 3.9);
    ctx.lineTo(-4.6, 5.2);
    ctx.closePath();
    ctx.fill();
  } else if (sad) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 8.2, 3.2, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
  } else {
    // A grin full of teeth; lopsided when he gloats.
    const skew = mood === 'gloat' ? 1.4 : 0;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-6.4, 3 + skew * 0.6);
    ctx.quadraticCurveTo(0, 8.4 - skew, 6.6, 2.4 - skew);
    ctx.quadraticCurveTo(0, 5 - skew * 0.4, -6.4, 3 + skew * 0.6);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (const tx of [-3.2, -1, 1.2, 3.4]) {
      ctx.moveTo(tx, 3.6);
      ctx.lineTo(tx, 6.2);
    }
    ctx.stroke();
  }

  // Goggles: down over the eyes and lit when he schemes, else on the forehead.
  const down = mood === 'scheme';
  const gy = down ? -4.5 : -12;
  ctx.fillStyle = '#3a3f4c';
  ctx.fillRect(-12, gy - 1, 24, 3);
  for (const gx of [-5, 5]) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(gx, gy, 4.4, 0, TAU);
    ctx.fill();
    if (down) {
      const pulse = 0.75 + 0.25 * Math.sin(frame / 5);
      const glow = ctx.createRadialGradient(gx, gy, 0.5, gx, gy, 9);
      glow.addColorStop(0, `rgba(120,240,255,${0.7 * pulse})`);
      glow.addColorStop(1, 'rgba(120,240,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(gx - 9, gy - 9, 18, 18);
    }
    ctx.fillStyle = down ? '#d8fbff' : '#7fe0ff';
    ctx.beginPath();
    ctx.arc(gx, gy, 3.1, 0, TAU);
    ctx.fill();
    if (down) {
      // A narrowed slit of an eye behind the glass.
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(gx + Math.sign(gx) * -0.4, gy + 0.3, 2.3, 0.75, gx < 0 ? 0.3 : -0.3, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(gx - 1, gy - 1, 1, 0, TAU);
      ctx.fill();
    }
  }

  // Eyes and brows.
  ctx.strokeStyle = INK;
  if (!down) {
    for (const ex of [-4.2, 4.2]) {
      // Laughing, he looks DOWN his nose at you: eyes narrowed, not shut —
      // shut eyes are a jolly laugh, and this one is not.
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex, -4, 2.4, sad ? 2.2 : laugh ? 1.15 : 1.7, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(ex + (sad ? 0 : 0.7), -3.7 + (sad ? 0.5 : laugh ? 0.4 : 0), laugh ? 0.9 : 1.05, 0, TAU);
      ctx.fill();
    }
  }
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (sad) {
    // Raised in the middle: dismay.
    ctx.moveTo(-7.5, -6.2);
    ctx.lineTo(-2, -8.4);
    ctx.moveTo(7.5, -6.2);
    ctx.lineTo(2, -8.4);
  } else if (!down) {
    // Driven down onto the nose: the scowl. The gloat cocks one brow.
    ctx.moveTo(-8, -9.4);
    ctx.lineTo(-1.6, -5.8);
    ctx.moveTo(8, mood === 'gloat' ? -11 : -9.4);
    ctx.lineTo(1.6, mood === 'gloat' ? -7 : -5.8);
  }
  ctx.stroke();

  // Nose and the moustache — the whole villain lives in the moustache.
  ctx.fillStyle = '#f7c46a';
  ctx.beginPath();
  ctx.ellipse(0, -1, 2.6, 2.2, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#6a3a1e';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  const twitch = Math.sin(frame / (laugh ? 2.2 : 9)) * (laugh ? 1.3 : 0.6);
  const droop = sad ? 3 : 0;
  ctx.beginPath();
  ctx.moveTo(0, 1);
  ctx.bezierCurveTo(-4, 0, -10, 1 + twitch + droop, -13, -2 + twitch + droop * 2);
  ctx.bezierCurveTo(-11, 5 + droop, -4, 5, 0, 3);
  ctx.bezierCurveTo(4, 5, 11, 5 + droop, 13, -2 - twitch + droop * 2);
  ctx.bezierCurveTo(10, 1 - twitch + droop, 4, 0, 0, 1);
  ctx.fill();
  ctx.stroke();
  if (sad) {
    ctx.fillStyle = '#9fe4ff';
    ctx.beginPath();
    ctx.ellipse(10, -10, 1.4, 2.2, 0.3, 0, TAU);
    ctx.fill();
  }
}

/** A gloved hand: palm at (x, y), fingers fanned along `ang`. */
function glove(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, pose: 'open' | 'fist' | 'point'): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.strokeStyle = INK;
  ctx.fillStyle = GLOVE;
  ctx.lineWidth = 1.2;
  const fingers = pose === 'open' ? [-0.5, -0.17, 0.17, 0.5] : pose === 'point' ? [0] : [];
  for (const a of fingers) {
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.roundRect(-1.1, -9 - (pose === 'point' ? 3 : 0), 2.2, 7 + (pose === 'point' ? 3 : 0), 1.1);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 4.2, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // Cuff.
  ctx.fillStyle = '#e8c06a';
  ctx.beginPath();
  ctx.roundRect(-4, 2.8, 8, 2.6, 1);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** A coat sleeve from the shoulder to the hand. */
function sleeve(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  ctx.lineCap = 'round';
  for (const [w, col] of [
    [9, INK],
    [6.6, COAT],
  ] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 + (x1 > x0 ? 3 : -3), Math.max(y0, y1) + 4, x1, y1);
    ctx.stroke();
  }
}

/**
 * Dr. Yolk from the chest up, for the cutscene close-ups: the high collar, the
 * coat, the face — and hands, because a villain gloats with his hands.
 * (x, y) is the base of his collar; about 64 units tall at s = 1.
 *
 *   scheme  goggles down and lit, fingers steepled and tapping
 *   grin    the same hands, the goggles up: he is enjoying this
 *   gloat   the Chrono Core held up in one hand, the other twirling the
 *           moustache, one brow cocked
 *   laugh   head thrown back, mouth open, both hands in the air, the whole
 *           coat shaking
 *   point   a raised finger, wagging at whoever is listening
 *   sad     hands to his head, moustache drooping
 */
export function drawYolkBust(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, frame: number, mood: Mood): void {
  const laugh = mood === 'laugh';
  const shake = laugh ? Math.sin(frame * 1.05) * 1.1 : 0;
  ctx.save();
  ctx.translate(x, y + shake);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // The high collar, behind the head: two dark wings.
  ctx.fillStyle = COAT_D;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(d * 4, 8);
    ctx.quadraticCurveTo(d * 13, -4, d * 20, -15);
    ctx.quadraticCurveTo(d * 27, -2, d * 23, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // Coat.
  ctx.fillStyle = COAT;
  ctx.beginPath();
  ctx.moveTo(-34, 36);
  ctx.quadraticCurveTo(-34, 9, -13, 5);
  ctx.lineTo(13, 5);
  ctx.quadraticCurveTo(34, 9, 34, 36);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Lapels and a row of brass buttons.
  ctx.fillStyle = COAT_D;
  ctx.beginPath();
  ctx.moveTo(-12, 5);
  ctx.lineTo(0, 24);
  ctx.lineTo(12, 5);
  ctx.lineTo(5, 5);
  ctx.lineTo(0, 13);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8c06a';
  for (const by of [26, 32]) {
    ctx.beginPath();
    ctx.arc(0, by, 1.5, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.ellipse(-20, 16, 7, 4, -0.5, 0, TAU);
  ctx.fill();

  // Head: thrown back when he laughs, pushed forward when he schemes.
  ctx.save();
  const bob = laugh ? Math.abs(Math.sin(frame * 0.5)) * 2.4 : Math.sin(frame / 16) * 0.5;
  ctx.translate(0, -2 - bob);
  ctx.rotate(laugh ? -0.16 : mood === 'scheme' ? 0.07 : mood === 'gloat' ? -0.06 : 0);
  face(ctx, frame, mood, mood !== 'sad');
  ctx.restore();

  // Hands.
  if (mood === 'scheme' || mood === 'grin') {
    const tap = Math.max(0, Math.sin(frame / 7)) * 1.2;
    sleeve(ctx, -24, 16, -7, 25);
    sleeve(ctx, 24, 16, 7, 25);
    glove(ctx, -5.5 - tap, 23, 0.55, 'open');
    glove(ctx, 5.5 + tap, 23, -0.55, 'open');
  } else if (mood === 'gloat') {
    const lift = Math.sin(frame / 22) * 1.2;
    sleeve(ctx, -24, 16, -27, 0);
    glove(ctx, -27, -3, 0, 'open');
    drawChronoCore(ctx, -27, -17 + lift, 6.5, frame);
    sleeve(ctx, 24, 16, 15, 6);
    glove(ctx, 14, 3 + Math.sin(frame / 6) * 0.8, -0.9, 'fist');
  } else if (laugh) {
    const w = Math.sin(frame * 0.9) * 2;
    sleeve(ctx, -24, 16, -32, -6 + w);
    sleeve(ctx, 24, 16, 32, -6 - w);
    glove(ctx, -32, -10 + w, -0.45, 'open');
    glove(ctx, 32, -10 - w, 0.45, 'open');
  } else if (mood === 'point') {
    // A raised finger, wagging: he is not threatening you, he is CORRECTING you.
    const wag = Math.sin(frame / 5) * 0.28;
    sleeve(ctx, -24, 16, -14, 27);
    glove(ctx, -13, 27, 0.6, 'fist');
    sleeve(ctx, 24, 16, 27, 6);
    glove(ctx, 27, 1, 0.1 + wag, 'point');
  } else {
    sleeve(ctx, -24, 16, -17, -6);
    sleeve(ctx, 24, 16, 17, -6);
    glove(ctx, -16, -10, 0.5, 'open');
    glove(ctx, 16, -10, -0.5, 'open');
  }
  ctx.restore();
}

/**
 * The Chrono Core: a clockwork orb — brass rim, a glowing amber heart and a
 * ticking hand. `crack` (0..1) splits it into four glowing seams.
 */
export function drawChronoCore(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, frame: number, crack = 0): void {
  ctx.save();
  ctx.translate(x, y);
  const glow = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 3.2);
  glow.addColorStop(0, 'rgba(255,190,90,0.55)');
  glow.addColorStop(1, 'rgba(255,170,70,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-r * 3.2, -r * 3.2, r * 6.4, r * 6.4);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(0, 0, r + 1.5, 0, TAU);
  ctx.fill();
  const body = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  body.addColorStop(0, '#fff3cf');
  body.addColorStop(0.45, '#ffbe50');
  body.addColorStop(1, '#c46a1a');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  // Brass rim with hour ticks.
  ctx.strokeStyle = '#e8c06a';
  ctx.lineWidth = r * 0.16;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.86, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(80,40,10,0.6)';
  ctx.lineWidth = r * 0.06;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
    ctx.lineTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
    ctx.stroke();
  }
  // The hand ticks once a second — until the Core is cracked.
  const tick = crack > 0 ? 0.4 : Math.floor(frame / 60) * (TAU / 12);
  ctx.strokeStyle = '#3a1a06';
  ctx.lineWidth = r * 0.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(tick - Math.PI / 2) * r * 0.55, Math.sin(tick - Math.PI / 2) * r * 0.55);
  ctx.stroke();
  if (crack > 0) {
    ctx.strokeStyle = `rgba(160,245,255,${Math.min(1, crack * 1.5)})`;
    ctx.lineWidth = r * 0.12;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5 + r * 0.1);
      ctx.lineTo(Math.cos(a + 0.2) * r, Math.sin(a + 0.2) * r);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** An Hour Shard / Chrono Crystal at illustration scale. */
export function drawShard(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, frame: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(Math.sin(frame / 20) * 0.15);
  ctx.fillStyle = 'rgba(160,240,255,0.25)';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, TAU);
  ctx.fill();
  const shape = new Path2D('M0 -9 L5 -2 L0 9 L-5 -2 Z');
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.stroke(shape);
  ctx.fillStyle = color;
  ctx.fill(shape);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fill(new Path2D('M0 -9 L2.4 -2 L0 0 L-2.4 -2 Z'));
  ctx.restore();
}
