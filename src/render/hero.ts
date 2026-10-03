/**
 * BOLT in play: a small articulated rig with a full pose set, drawn through
 * a keyline Outliner.
 *
 * The old sprite was two stroked lines for legs under a rounded rectangle,
 * the same three-frame shuffle at every speed, and no outline — a blue blob
 * that vanished against the dusk sea. The rig here is built in the title
 * art's design language (profile head with a cream muzzle, swept fox ears,
 * lightning-bolt tail, red shoes with a white stripe) and every state the
 * physics can be in has its own read:
 *
 *   idle (breathes, blinks, taps a foot when kept waiting) · look up ·
 *   crouch · walk · run (lean grows with speed) · sprint (legs blur into the
 *   classic wheel) · skid (heels dug in) · spin ball (quills, speed-scaled
 *   spin) · spin dash (compressed, revving) · spring (stretched, arms up) ·
 *   fall (arms out) · hurt (knocked back) · dead · board · rail · glide.
 *
 * Pure presentation: it only READS the Player.
 */
import { Player } from '../game/Player.ts';
import { Outliner } from './sprite.ts';

const TAU = Math.PI * 2;
const BLUE = '#2f7df6';
const BLUE_D = '#1d4fb4';
const BLUE_L = '#7db4ff';
const CREAM = '#f6e7c4';
const CREAM_D = '#d9c49a';
const SHOE = '#e8384f';
const SHOE_D = '#a82134';
const WHITE = '#f6f8ff';
const INK = '#0a1030';
const BOARD = '#38e0c8';
const BOARD_D = '#1a9c8a';

/** Fastest the stride and the sprint wheel may turn, in radians per frame. */
const LEG_RATE = 0.62;
const WHEEL_RATE = 0.8;

type Eyes = 'open' | 'closed' | 'x' | 'squint' | 'up';

interface Limb {
  /** Root angle from straight down (legs) / straight down (arms), + = forward. */
  a: number;
  /** Bend at the middle joint, + = folds the lower part back. */
  b: number;
}

interface Pose {
  lean: number;
  bodyY: number;
  headTilt: number;
  headY: number;
  armF: Limb;
  armB: Limb;
  legF: Limb;
  legB: Limb;
  eyes: Eyes;
  tail: number;
  /** Sprint: legs replaced by the blurred wheel, phase in radians. */
  wheel?: number;
  /** Squash scale on y (1 = none). */
  sy: number;
}

const rest = (): Pose => ({
  lean: 0,
  bodyY: 0,
  headTilt: 0,
  headY: 0,
  armF: { a: 0.35, b: 0.35 },
  armB: { a: -0.25, b: 0.4 },
  legF: { a: 0.08, b: 0 },
  legB: { a: -0.08, b: 0 },
  eyes: 'open',
  tail: 0,
  sy: 1,
});

export class HeroRenderer {
  private sprite: Outliner;
  private zoom: number;
  private idle = 0;
  /** Phase of the walk/run stride and of the sprint wheel (radians). */
  private runPhase = 0;
  private wheelPhase = 0;
  private lastX = 0;
  private lastFrame = -1;
  private blink = 0;

  /**
   * `zoom` > 1 renders the rig larger at full resolution (title, cutscenes).
   * `world` is the hero in a level, drawn through the world transform.
   */
  constructor(zoom = 1, world = false) {
    this.zoom = zoom;
    this.sprite = new Outliner(Math.ceil(104 * zoom), world);
  }

  /** Draws the hero (and its afterimages) at its world position. */
  draw(
    ctx: CanvasRenderingContext2D,
    p: Player,
    frame: number,
    trail: { x: number; y: number }[],
    ghosts: string | null,
    at: { x: number; y: number } = p,
  ): void {
    const pose = this.pose(p, frame);
    const ball = p.ball && !p.dead;
    this.sprite.paint((c) => {
      c.scale(this.zoom, this.zoom);
      if (p.grounded && !p.dead) c.rotate((-p.angle * Math.PI) / 180);
      if (p.squash !== 0) {
        const sy = 1 - p.squash * 0.24;
        c.translate(0, (1 - sy) * p.h);
        c.scale(1 / sy, sy);
      }
      c.scale(p.facing, 1);
      if (p.gliding) glider(c, frame);
      if (p.board) board(c, ball ? 14 : 19, frame);
      if (ball) spinBall(c, p, frame);
      else body(c, pose, frame);
    });

    if (ghosts) {
      for (let i = trail.length - 1; i >= 1; i -= 2) {
        const t = trail[i];
        this.sprite.ghost(ctx, t.x, t.y, ghosts, 0.1 + (1 - i / trail.length) * 0.16);
      }
    }
    // Damage blink: classic, but never fully gone for more than two frames.
    if (p.invuln > 0 && !p.dead && frame % 4 < 2) return;
    this.sprite.stamp(ctx, at.x, at.y, INK, 1.5 * Math.sqrt(this.zoom));
    if (p.shield) shield(ctx, at.x, at.y, frame);
  }

  private pose(p: Player, frame: number): Pose {
    const s = rest();
    const speed = Math.abs(p.gsp);
    const standing = p.grounded && speed < 0.25 && !p.ball;
    const k = Math.min(1, speed / 6.5);
    // The animation clocks tick once per SIMULATION step: the scene draws the
    // same step several times on a fast display, and a clock that ran per
    // draw would animate at the monitor's refresh rate.
    if (frame !== this.lastFrame) {
      this.lastFrame = frame;
      const moved = Math.abs(p.x - this.lastX);
      this.lastX = p.x;
      // Feet are locked to the ground they cover — up to a point. Past
      // LEG_RATE the legs would turn more than a quarter cycle per frame and
      // alias: at a run they flail, and the sprint wheel (two shoes, half a
      // turn apart) visibly spins BACKWARDS. Capped, they always read forward
      // and the blur trails say the rest.
      this.runPhase += Math.min(LEG_RATE, (moved / (10 + k * 10)) * TAU);
      this.wheelPhase += Math.min(WHEEL_RATE, moved / 6);
      this.idle = standing && !p.crouch && !p.lookUp ? this.idle + 1 : 0;
      if (this.blink > 0) this.blink--;
      else if (frame % 173 === 0) this.blink = 7;
    }
    if (this.blink > 0) s.eyes = 'closed';

    if (p.dead) {
      s.eyes = 'x';
      s.armF = { a: Math.PI * 0.9, b: -0.3 };
      s.armB = { a: Math.PI * 0.75, b: -0.3 };
      s.legF = { a: 0.5, b: 0.6 };
      s.legB = { a: -0.4, b: 0.8 };
      s.headTilt = -0.4;
      return s;
    }
    if (p.invuln > 90 && !p.grounded) {
      // Knocked back: thrown off balance, eyes squeezed shut.
      s.eyes = 'squint';
      s.lean = -0.45;
      s.armF = { a: -1.6, b: 0.4 };
      s.armB = { a: -2.1, b: 0.4 };
      s.legF = { a: 0.7, b: 0.5 };
      s.legB = { a: 0.2, b: 1 };
      s.headTilt = -0.25;
      return s;
    }
    if (p.gliding) {
      s.armF = { a: Math.PI * 0.95, b: 0 };
      s.armB = { a: Math.PI * 0.9, b: 0 };
      s.legF = { a: -0.15 + Math.sin(frame / 9) * 0.1, b: 0.3 };
      s.legB = { a: -0.35 + Math.sin(frame / 9 + 1) * 0.1, b: 0.4 };
      s.lean = 0.1;
      return s;
    }
    if (p.board || p.railing || p.carting) {
      // Surf stance: knees bent, arms out for balance.
      const sway = Math.sin(frame / 12) * 0.08;
      s.bodyY = 3;
      s.lean = 0.2 + sway;
      s.legF = { a: 0.55, b: -1.1 };
      s.legB = { a: -0.35, b: 1 };
      s.armF = { a: 1.2 + sway, b: 0.4 };
      s.armB = { a: -1.1 - sway, b: 0.5 };
      s.headY = 2;
      return s;
    }
    if (!p.grounded) {
      if (p.ysp < -2.5) {
        // Sprung: stretched upward, arms up — the launch belongs to the spring.
        s.armF = { a: Math.PI * 0.85, b: 0.1 };
        s.armB = { a: Math.PI * 0.95, b: 0.1 };
        s.legF = { a: 0.05, b: 0.15 };
        s.legB = { a: -0.1, b: 0.3 };
        s.headTilt = -0.2;
        s.eyes = s.eyes === 'closed' ? 'closed' : 'up';
        return s;
      }
      // Falling: arms thrown out, legs pedalling.
      const f = frame / 5;
      s.armF = { a: 1.9 + Math.sin(f) * 0.2, b: 0.3 };
      s.armB = { a: -1.7 + Math.sin(f + 1) * 0.2, b: 0.3 };
      s.legF = { a: 0.45 + Math.sin(f) * 0.25, b: 0.6 };
      s.legB = { a: -0.3 + Math.sin(f + 2) * 0.25, b: 0.8 };
      s.lean = 0.05;
      return s;
    }
    if (p.crouch) {
      s.bodyY = 6;
      s.headY = 5;
      s.lean = 0.3;
      s.legF = { a: 1.1, b: -2 };
      s.legB = { a: 0.6, b: -1.6 };
      s.armF = { a: 0.9, b: 1 };
      s.armB = { a: 0.6, b: 1 };
      s.headTilt = 0.15;
      return s;
    }
    if (p.lookUp) {
      s.headTilt = -0.45;
      s.eyes = 'up';
      s.lean = -0.08;
      s.armF = { a: 0.1, b: 0.6 };
      return s;
    }
    if (standing) {
      // Idle: breathing; kept waiting, he taps a foot and folds his arms.
      const breathe = Math.sin(frame / 22);
      s.bodyY = breathe * 0.4;
      s.headY = breathe * 0.5;
      if (this.idle > 300) {
        const tap = Math.max(0, Math.sin(frame / 5)) * 0.35;
        s.legF = { a: 0.15 + tap, b: -tap };
        s.armF = { a: 0.9, b: 2.2 };
        s.armB = { a: 0.7, b: 2.2 };
        s.headTilt = 0.08;
      }
      return s;
    }
    // Skid: moving one way, facing (pushing) the other.
    if (speed > 2.2 && Math.sign(p.gsp) !== p.facing) {
      s.lean = -0.35;
      s.legF = { a: 0.75, b: 0.2 };
      s.legB = { a: 0.25, b: 0.4 };
      s.armF = { a: -0.6, b: 0.5 };
      s.armB = { a: -1, b: 0.6 };
      s.eyes = 'squint';
      return s;
    }
    if (speed > 7.2) {
      // Top speed: the legs blur into the wheel, arms swept back.
      s.wheel = this.wheelPhase;
      s.lean = 0.42;
      s.armF = { a: -1.25, b: 0.7 };
      s.armB = { a: -1.05, b: 0.8 };
      s.headTilt = 0.12;
      s.tail = -0.3;
      return s;
    }
    // Walk -> run: stride swing and lean both grow with speed.
    const ph = this.runPhase;
    const swing = 0.45 + k * 0.6;
    s.lean = 0.06 + k * 0.28;
    s.bodyY = -Math.abs(Math.sin(ph)) * (0.6 + k * 1.4) + 1;
    s.legF = { a: Math.sin(ph) * swing, b: Math.max(0, -Math.sin(ph + 0.6)) * (0.8 + k) };
    s.legB = { a: -Math.sin(ph) * swing, b: Math.max(0, Math.sin(ph + 0.6)) * (0.8 + k) };
    s.armF = { a: -Math.sin(ph) * (0.5 + k * 0.6), b: 0.6 + k * 0.9 };
    s.armB = { a: Math.sin(ph) * (0.5 + k * 0.6), b: 0.6 + k * 0.9 };
    s.tail = Math.sin(ph * 2) * 0.1 - k * 0.15;
    return s;
  }
}

/* ---------------------------------- Parts --------------------------------- */

/** Hip / shoulder anchors in body space (facing right, y down, feet at +19). */
const HIP_Y = 4;
const THIGH = 6;
const SHIN = 6.5;

function body(c: CanvasRenderingContext2D, s: Pose, frame: number): void {
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.translate(0, s.bodyY);
  // Legs pivot at the hip, so lean the torso around it.
  if (s.wheel !== undefined) wheelLegs(c, s.wheel, true);
  else leg(c, -1, s.legB, true);
  arm(c, 0, s.armB, true, s.lean);
  c.save();
  c.translate(0, HIP_Y);
  c.rotate(s.lean);
  c.translate(0, -HIP_Y);
  tail(c, s.tail, frame);
  torso(c);
  c.restore();
  if (s.wheel !== undefined) wheelLegs(c, s.wheel, false);
  else leg(c, 1, s.legF, false);
  c.save();
  c.translate(0, HIP_Y);
  c.rotate(s.lean);
  c.translate(0, -HIP_Y);
  head(c, s);
  c.restore();
  arm(c, 1, s.armF, false, s.lean);
  c.restore();
}

function torso(c: CanvasRenderingContext2D): void {
  c.fillStyle = BLUE;
  c.beginPath();
  c.ellipse(0, 1.5, 6.6, 8, 0, 0, TAU);
  c.fill();
  c.fillStyle = CREAM;
  c.beginPath();
  c.ellipse(2.4, 3, 3.6, 5.6, 0.1, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.18)';
  c.beginPath();
  c.ellipse(-2, -2, 2.4, 3.4, -0.4, 0, TAU);
  c.fill();
}

function head(c: CanvasRenderingContext2D, s: Pose): void {
  c.save();
  c.translate(1.5, -9 + s.headY);
  c.rotate(s.headTilt);
  // Fox ears, broad at the base and swept back by the run — BOLT's
  // signature silhouette (see the title art and the cover). Not quills: he is
  // a fox, and an original character, not a hedgehog lookalike.
  c.fillStyle = BLUE_D;
  c.beginPath();
  c.moveTo(-6.5, -6);
  c.lineTo(-15.5, -15);
  c.lineTo(-1.5, -10.5);
  c.closePath();
  c.fill();
  c.fillStyle = BLUE;
  c.beginPath();
  c.moveTo(-1.5, -9.5);
  c.quadraticCurveTo(-4.5, -16, -3.5, -23);
  c.quadraticCurveTo(3, -17, 6.5, -9.5);
  c.closePath();
  c.fill();
  c.fillStyle = CREAM_D;
  c.beginPath();
  c.moveTo(0.4, -10.5);
  c.quadraticCurveTo(-1.6, -15, -1.4, -19);
  c.quadraticCurveTo(2.4, -15, 4.2, -10.5);
  c.closePath();
  c.fill();
  // Cheek ruff at the back of the head: fox fur, swept by the wind.
  c.fillStyle = BLUE;
  c.beginPath();
  c.moveTo(-7.5, -5);
  c.lineTo(-13, -2);
  c.lineTo(-8, 0);
  c.lineTo(-12, 3);
  c.lineTo(-6, 2.5);
  c.closePath();
  c.fill();
  // Skull.
  c.fillStyle = BLUE;
  c.beginPath();
  c.ellipse(0, -4, 8.6, 8, 0, 0, TAU);
  c.fill();
  c.fillStyle = BLUE_L;
  c.globalAlpha = 0.35;
  c.beginPath();
  c.ellipse(-3, -8, 3.4, 2.2, -0.5, 0, TAU);
  c.fill();
  c.globalAlpha = 1;
  // Muzzle.
  c.fillStyle = CREAM;
  c.beginPath();
  c.ellipse(5.8, -1.2, 5.2, 3.9, 0.12, 0, TAU);
  c.fill();
  c.fillStyle = INK;
  c.beginPath();
  c.ellipse(10.6, -2.2, 1.7, 1.3, 0, 0, TAU);
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 0.8;
  c.beginPath();
  c.arc(7.2, 0.4, 2, 0.15, 1.3);
  c.stroke();
  // Eye.
  eye(c, s.eyes);
  c.restore();
}

function eye(c: CanvasRenderingContext2D, eyes: Eyes): void {
  c.save();
  c.translate(4, -6.5);
  if (eyes === 'closed' || eyes === 'squint') {
    c.strokeStyle = INK;
    c.lineWidth = 1.2;
    c.beginPath();
    if (eyes === 'closed') c.arc(0, -0.5, 2.4, 0.2, Math.PI - 0.2);
    else {
      c.moveTo(-2.4, -2);
      c.lineTo(1.6, 0);
      c.lineTo(-2.4, 1.4);
    }
    c.stroke();
  } else if (eyes === 'x') {
    c.strokeStyle = INK;
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(-2, -2.4);
    c.lineTo(2, 1.6);
    c.moveTo(2, -2.4);
    c.lineTo(-2, 1.6);
    c.stroke();
  } else {
    c.fillStyle = WHITE;
    c.beginPath();
    c.ellipse(0, -0.6, 2.9, 3.6, 0.1, 0, TAU);
    c.fill();
    const py = eyes === 'up' ? -2.2 : -0.3;
    c.fillStyle = '#123a8a';
    c.beginPath();
    c.ellipse(1.2, py, 1.6, 2.2, 0, 0, TAU);
    c.fill();
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(1.5, py, 0.9, 1.4, 0, 0, TAU);
    c.fill();
    c.fillStyle = '#fff';
    c.fillRect(1.6, py - 1.4, 0.9, 0.9);
    // Brow: determined.
    c.strokeStyle = BLUE_D;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-2.8, -4.4);
    c.lineTo(2.8, -3.2);
    c.stroke();
  }
  c.restore();
}

function tail(c: CanvasRenderingContext2D, swing: number, frame: number): void {
  c.save();
  c.translate(-5, 4);
  c.rotate(-0.15 + swing + Math.sin(frame / 8) * 0.05);
  c.fillStyle = BLUE_D;
  c.beginPath();
  c.moveTo(1, -2.5);
  c.lineTo(-8, -8);
  c.lineTo(-4, -2.5);
  c.lineTo(-12, 2);
  c.lineTo(-2, 1.6);
  c.closePath();
  c.fill();
  c.fillStyle = 'rgba(140,215,255,0.5)';
  c.beginPath();
  c.moveTo(0, -2.4);
  c.lineTo(-6, -6.2);
  c.lineTo(-3.6, -2.2);
  c.closePath();
  c.fill();
  c.restore();
}

/** Two-segment leg from the hip; `side` -1 = far leg (darker). */
function leg(c: CanvasRenderingContext2D, side: number, l: Limb, far: boolean): void {
  const hx = side * 1.2;
  const hy = HIP_Y;
  const kx = hx + Math.sin(l.a) * THIGH;
  const ky = hy + Math.cos(l.a) * THIGH;
  const sa = l.a - l.b;
  const fx = kx + Math.sin(sa) * SHIN;
  const fy = ky + Math.cos(sa) * SHIN;
  c.strokeStyle = far ? BLUE_D : BLUE;
  c.lineWidth = 3.2;
  c.beginPath();
  c.moveTo(hx, hy);
  c.lineTo(kx, ky);
  c.lineTo(fx, fy);
  c.stroke();
  shoe(c, fx, fy, Math.min(0.6, Math.max(-0.8, -sa * 0.6)), far);
}

function shoe(c: CanvasRenderingContext2D, x: number, y: number, ang: number, far: boolean): void {
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  c.fillStyle = far ? SHOE_D : SHOE;
  c.beginPath();
  c.moveTo(-3, -2.6);
  c.lineTo(4, -2.6);
  c.quadraticCurveTo(8.4, -2.4, 8.4, 0.6);
  c.lineTo(8.4, 1.6);
  c.lineTo(-3.4, 1.6);
  c.quadraticCurveTo(-4, -2.6, -3, -2.6);
  c.fill();
  c.fillStyle = far ? '#c8ccd8' : WHITE;
  c.fillRect(0.4, -2.6, 2, 4.2);
  c.fillStyle = far ? '#8a8f9c' : '#dfe3ec';
  c.fillRect(-3.4, 1.2, 11.8, 1.3);
  c.restore();
}

function arm(c: CanvasRenderingContext2D, side: number, l: Limb, far: boolean, lean: number): void {
  // Shoulder rides on the leaning torso.
  const sx0 = side * 0.6;
  const sy0 = -2.5;
  const sx = sx0 * Math.cos(lean) - (sy0 - HIP_Y) * Math.sin(lean);
  const sy = HIP_Y + sx0 * Math.sin(lean) + (sy0 - HIP_Y) * Math.cos(lean);
  const ex = sx + Math.sin(l.a) * 5.6;
  const ey = sy + Math.cos(l.a) * 5.6;
  const fa = l.a + l.b;
  const hx = ex + Math.sin(fa) * 5.4;
  const hy = ey + Math.cos(fa) * 5.4;
  c.strokeStyle = far ? BLUE_D : BLUE;
  c.lineWidth = 2.8;
  c.beginPath();
  c.moveTo(sx, sy);
  c.lineTo(ex, ey);
  c.lineTo(hx, hy);
  c.stroke();
  // Cuff + glove: white against blue is what makes the arm readable.
  c.fillStyle = far ? '#b9bfcc' : '#e6e9f2';
  c.beginPath();
  c.arc(hx - Math.sin(fa) * 1.6, hy - Math.cos(fa) * 1.6, 2.1, 0, TAU);
  c.fill();
  c.fillStyle = far ? '#cfd3df' : WHITE;
  c.beginPath();
  c.arc(hx, hy, 3, 0, TAU);
  c.fill();
}

/** Sprint legs: a blurred wheel with the two shoes on its rim. */
function wheelLegs(c: CanvasRenderingContext2D, phase: number, far: boolean): void {
  const cx = 1;
  const cy = 14;
  if (far) {
    c.fillStyle = 'rgba(47,125,246,0.35)';
    c.beginPath();
    c.ellipse(cx, cy, 8.5, 5, 0, 0, TAU);
    c.fill();
    c.strokeStyle = 'rgba(200,230,255,0.5)';
    c.lineWidth = 1.6;
    c.beginPath();
    c.ellipse(cx, cy, 8.5, 5, 0, phase, phase + 2);
    c.stroke();
  }
  const a = phase + (far ? Math.PI : 0);
  const fx = cx + Math.cos(a) * 8.5;
  const fy = cy + Math.sin(a) * 5;
  // Each shoe drags a streak along the arc it just travelled: the smear is
  // what tells the eye which way the wheel turns.
  c.strokeStyle = far ? 'rgba(168,33,52,0.4)' : 'rgba(232,56,79,0.5)';
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(cx, cy, 8.5, 5, 0, a - 1.1, a - 0.25);
  c.stroke();
  c.strokeStyle = far ? BLUE_D : BLUE;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(0, HIP_Y);
  c.lineTo(fx, fy);
  c.stroke();
  shoe(c, fx, fy, -Math.sin(a) * 0.4, far);
}

/** The spin ball: quills curling round it, spinning with ground speed. */
function spinBall(c: CanvasRenderingContext2D, p: Player, frame: number): void {
  const rate = p.spindashing ? 0.9 : Math.min(0.8, 0.25 + Math.abs(p.gsp || p.xsp) * 0.06);
  const a = frame * rate;
  const r = 12.5;
  c.save();
  if (p.spindashing) c.scale(1.08, 0.9);
  const g = c.createRadialGradient(-4, -4, 2, 0, 0, r);
  g.addColorStop(0, BLUE_L);
  g.addColorStop(0.55, BLUE);
  g.addColorStop(1, BLUE_D);
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, r, 0, TAU);
  c.fill();
  // Quills: three swept blades rotating with the ball.
  c.rotate(a);
  c.fillStyle = BLUE_D;
  for (let i = 0; i < 3; i++) {
    c.rotate(TAU / 3);
    c.beginPath();
    c.moveTo(r - 1, 0);
    c.quadraticCurveTo(r * 0.5, -r * 0.55, -r * 0.2, -r * 0.6);
    c.quadraticCurveTo(r * 0.3, -r * 0.2, r - 1, 0);
    c.fill();
  }
  c.rotate(-a);
  // A glimpse of muzzle and shoe so the ball is still BOLT.
  c.fillStyle = CREAM;
  c.beginPath();
  c.ellipse(r * 0.45, -r * 0.1, 3.4, 2.8, 0, 0, TAU);
  c.fill();
  c.fillStyle = SHOE;
  c.beginPath();
  c.ellipse(-r * 0.15, r * 0.62, 4, 2.6, -0.3, 0, TAU);
  c.fill();
  // Spin arcs.
  c.strokeStyle = 'rgba(220,240,255,0.7)';
  c.lineWidth = 1.4;
  c.beginPath();
  c.arc(0, 0, r - 2.5, a * 1.3, a * 1.3 + 1.2);
  c.stroke();
  if (p.spindashing) {
    c.strokeStyle = `rgba(255,255,255,${0.5 + 0.3 * Math.sin(frame)})`;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, r + 3, a, a + 2.4);
    c.stroke();
  }
  c.restore();
}

function board(c: CanvasRenderingContext2D, deckY: number, frame: number): void {
  const glow = c.createRadialGradient(0, deckY + 4, 2, 0, deckY + 4, 18);
  glow.addColorStop(0, 'rgba(56,224,200,0.45)');
  glow.addColorStop(1, 'rgba(56,224,200,0)');
  c.fillStyle = glow;
  c.fillRect(-20, deckY - 8, 40, 26);
  c.fillStyle = BOARD_D;
  c.beginPath();
  c.roundRect(-14, deckY + 1, 29, 4, 2);
  c.fill();
  c.fillStyle = BOARD;
  c.beginPath();
  c.moveTo(-15, deckY + 1);
  c.lineTo(13, deckY + 1);
  c.quadraticCurveTo(18, deckY, 18, deckY - 2.5);
  c.lineTo(-13, deckY - 1);
  c.quadraticCurveTo(-16, deckY - 1, -15, deckY + 1);
  c.fill();
  c.fillStyle = `rgba(200,255,245,${0.6 + Math.sin(frame / 3) * 0.3})`;
  c.fillRect(-10, deckY - 1, 18, 1);
}

function glider(c: CanvasRenderingContext2D, frame: number): void {
  const flex = Math.sin(frame / 7) * 1.5;
  c.strokeStyle = '#6b4a2a';
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(-3, -24);
  c.lineTo(1, -35);
  c.moveTo(5, -24);
  c.lineTo(1, -35);
  c.moveTo(-5, -24);
  c.lineTo(7, -24);
  c.stroke();
  c.fillStyle = '#ffb03d';
  c.beginPath();
  c.moveTo(-26, -32 + flex);
  c.quadraticCurveTo(1, -48 - flex, 28, -32 + flex);
  c.lineTo(1, -36);
  c.closePath();
  c.fill();
  c.fillStyle = '#e8384f';
  c.beginPath();
  c.moveTo(-26, -32 + flex);
  c.quadraticCurveTo(1, -48 - flex, 28, -32 + flex);
  c.lineTo(22, -33.5);
  c.quadraticCurveTo(1, -44, -20, -33.5);
  c.closePath();
  c.fill();
}

function shield(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
  ctx.save();
  ctx.translate(x, y);
  const r = 23 + Math.sin(frame / 10) * 0.8;
  const g = ctx.createRadialGradient(-6, -8, 2, 0, 0, r);
  g.addColorStop(0, 'rgba(220,240,255,0.22)');
  g.addColorStop(0.7, 'rgba(90,169,255,0.10)');
  g.addColorStop(1, 'rgba(90,169,255,0.35)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(170,215,255,0.8)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  const a = frame / 18;
  ctx.beginPath();
  ctx.arc(0, 0, r - 3, a, a + 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r - 3, a + Math.PI, a + Math.PI + 0.4);
  ctx.stroke();
  ctx.restore();
}

/* ----------------------------- Illustration use ---------------------------- */

const stagePlayers = new Map<string, { p: Player; r: HeroRenderer }>();

/**
 * BOLT outside gameplay (title screen, cutscenes): the same rig as in play, so
 * there is one character, not a key-art one and an in-game one. (x, groundY)
 * is where his feet touch the ground.
 */
export function drawBoltPose(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  zoom: number,
  frame: number,
  pose: 'sprint' | 'run' | 'idle' | 'cheer',
  key = 'default',
): void {
  const id = `${key}:${zoom}`;
  let e = stagePlayers.get(id);
  if (!e) {
    e = { p: new Player(0, 0), r: new HeroRenderer(zoom) };
    stagePlayers.set(id, e);
  }
  const p = e.p;
  p.grounded = pose !== 'cheer';
  p.gsp = pose === 'sprint' ? 9 : pose === 'run' ? 5 : 0;
  // The rig reads stride from x travel: feed it a virtual run.
  p.x = pose === 'sprint' ? frame * 9 : pose === 'run' ? frame * 5 : 0;
  p.ysp = pose === 'cheer' ? -4 : 0;
  p.facing = 1;
  e.r.draw(ctx, p, frame, [], null, { x, y: groundY - 19 * zoom });
}
