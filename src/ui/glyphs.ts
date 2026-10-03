/**
 * Vector button glyphs for input prompts ("Ⓐ JUMP", "≡ PAUSE", "tap to
 * continue"), drawn with Canvas2D paths in logical coordinates like the rest
 * of the art — no fonts, no images, so they are crisp at every render scale
 * and identical on every platform. Even the A/B/X/Y letters are strokes: a
 * glyph font missing on one OS would turn a prompt into tofu.
 *
 * Every function takes (x, y) as the glyph's LEFT edge and VERTICAL CENTRE —
 * the way a prompt is laid out inline with text drawn at `textBaseline =
 * 'middle'` — and returns the width it drew, so callers can advance x.
 *
 * The touch painters at the bottom are shared with ui/TouchControls, so a
 * "tap JUMP" prompt shows exactly the button the player will see on screen.
 */

export type PadGlyph =
  | 'south'
  | 'east'
  | 'west'
  | 'north'
  | 'start'
  | 'select'
  | 'dpad'
  | 'dpad-up'
  | 'dpad-down'
  | 'dpad-left'
  | 'dpad-right'
  | 'lstick';

export type TouchGlyph = 'tap' | 'jump' | 'stick';

/** Which pad glyph stands for each semantic prompt (mirrors core/Input.ts). */
export const PAD_PROMPT: Record<'confirm' | 'back' | 'jump' | 'pause' | 'move', PadGlyph> = {
  confirm: 'south',
  back: 'east',
  jump: 'south', // any face button jumps; South is the one to name
  pause: 'start',
  move: 'lstick',
};

/** Glyph palette: neutral surfaces that sit on the dark menus and on the game. */
const INK = {
  body: '#262b36',
  bodyEdge: '#4a5263',
  symbol: '#e7ebf2',
  lit: '#4be1ff',
  shade: 'rgba(0,0,0,0.28)',
} as const;

/**
 * Xbox face colours (A green, B red, X blue, Y yellow), muted so they read
 * as button identity rather than as alerts next to the game's own reds and
 * golds.
 */
const FACE: Record<'south' | 'east' | 'west' | 'north', { fill: string; letter: Letter }> = {
  south: { fill: '#3f8a4f', letter: 'A' },
  east: { fill: '#a8473f', letter: 'B' },
  west: { fill: '#3d68a8', letter: 'X' },
  north: { fill: '#a88a3a', letter: 'Y' },
};

type Letter = 'A' | 'B' | 'X' | 'Y';

/** Strokes a face-button letter centred on (cx, cy), `h` tall. */
function letterPath(ctx: CanvasRenderingContext2D, letter: Letter, cx: number, cy: number, h: number): void {
  const u = h / 2; // unit: half the letter height
  const p = (x: number, y: number): [number, number] => [cx + x * u, cy + y * u];
  ctx.beginPath();
  switch (letter) {
    case 'A':
      ctx.moveTo(...p(-0.78, 1));
      ctx.lineTo(...p(0, -1));
      ctx.lineTo(...p(0.78, 1));
      ctx.moveTo(...p(-0.46, 0.36));
      ctx.lineTo(...p(0.46, 0.36));
      break;
    case 'X':
      ctx.moveTo(...p(-0.7, -1));
      ctx.lineTo(...p(0.7, 1));
      ctx.moveTo(...p(0.7, -1));
      ctx.lineTo(...p(-0.7, 1));
      break;
    case 'Y':
      ctx.moveTo(...p(-0.72, -1));
      ctx.lineTo(...p(0, 0.02));
      ctx.lineTo(...p(0.72, -1));
      ctx.moveTo(...p(0, 0.02));
      ctx.lineTo(...p(0, 1));
      break;
    case 'B':
      // Stem plus two bowls; the lower bowl is a touch wider, as in print.
      ctx.moveTo(...p(-0.6, 1));
      ctx.lineTo(...p(-0.6, -1));
      ctx.lineTo(...p(0.1, -1));
      ctx.arc(cx + 0.1 * u, cy - 0.5 * u, 0.5 * u, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(...p(0.2, 0));
      ctx.arc(cx + 0.2 * u, cy + 0.5 * u, 0.5 * u, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(...p(-0.6, 1));
      ctx.moveTo(...p(-0.6, 0));
      ctx.lineTo(...p(0.1, 0));
      break;
  }
  ctx.stroke();
}

function faceButton(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, which: keyof typeof FACE): number {
  const r = size / 2;
  const cx = x + r;
  ctx.fillStyle = FACE[which].fill;
  ctx.beginPath();
  ctx.arc(cx, y, r, 0, Math.PI * 2);
  ctx.fill();
  // A darker lower rim gives the cap a hint of depth without a gradient.
  ctx.strokeStyle = INK.shade;
  ctx.lineWidth = Math.max(1, size * 0.07);
  ctx.beginPath();
  ctx.arc(cx, y, r - ctx.lineWidth / 2, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  ctx.strokeStyle = INK.symbol;
  ctx.lineWidth = Math.max(1.2, size * 0.1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  letterPath(ctx, FACE[which].letter, cx, y, size * 0.46);
  return size;
}

/** Start (≡) and Back/Select (⧉) are pills, as on the controller. */
function menuButton(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, which: 'start' | 'select'): number {
  const w = size * 1.45;
  const h = size * 0.82;
  ctx.fillStyle = INK.body;
  ctx.strokeStyle = INK.bodyEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y - h / 2, w - 1, h, h / 2);
  ctx.fill();
  ctx.stroke();

  const cx = x + w / 2;
  const s = size * 0.36;
  ctx.strokeStyle = INK.symbol;
  ctx.lineWidth = Math.max(1, size * 0.08);
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (which === 'start') {
    for (const dy of [-0.55, 0, 0.55]) {
      ctx.moveTo(cx - s * 0.75, y + dy * s);
      ctx.lineTo(cx + s * 0.75, y + dy * s);
    }
  } else {
    // Two overlapping windows (the "view" button): the front one whole, the
    // back one only where it shows.
    const b = s * 1.05;
    const o = b * 0.4;
    const bx = cx - (b + o) / 2;
    const by = y - (b + o) / 2;
    ctx.rect(bx + o, by + o, b, b);
    ctx.moveTo(bx + o, by + b);
    ctx.lineTo(bx, by + b);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + b, by);
    ctx.lineTo(bx + b, by + o);
  }
  ctx.stroke();
  return w;
}

/** A d-pad cross; `lit` names the arm to highlight (none for the plain d-pad). */
function dpad(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, lit: 'up' | 'down' | 'left' | 'right' | null): number {
  const cx = x + size / 2;
  const a = size / 2; // arm reach
  const t = size * 0.18; // half arm thickness
  ctx.beginPath();
  ctx.moveTo(cx - t, y - a);
  ctx.lineTo(cx + t, y - a);
  ctx.lineTo(cx + t, y - t);
  ctx.lineTo(cx + a, y - t);
  ctx.lineTo(cx + a, y + t);
  ctx.lineTo(cx + t, y + t);
  ctx.lineTo(cx + t, y + a);
  ctx.lineTo(cx - t, y + a);
  ctx.lineTo(cx - t, y + t);
  ctx.lineTo(cx - a, y + t);
  ctx.lineTo(cx - a, y - t);
  ctx.lineTo(cx - t, y - t);
  ctx.closePath();
  ctx.fillStyle = INK.body;
  ctx.strokeStyle = INK.bodyEdge;
  ctx.lineWidth = 1;
  ctx.fill();
  ctx.stroke();

  if (lit) {
    const arm = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[lit];
    const inset = Math.max(0.75, size * 0.05);
    const [ax, ay] = arm;
    // The lit arm: from the hub to the tip, inset so the outline stays visible.
    const x0 = ax === 0 ? cx - t + inset : ax < 0 ? cx - a + inset : cx + t;
    const x1 = ax === 0 ? cx + t - inset : ax < 0 ? cx - t : cx + a - inset;
    const y0 = ay === 0 ? y - t + inset : ay < 0 ? y - a + inset : y + t;
    const y1 = ay === 0 ? y + t - inset : ay < 0 ? y - t : y + a - inset;
    ctx.fillStyle = INK.lit;
    ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
  } else {
    ctx.fillStyle = INK.bodyEdge;
    ctx.beginPath();
    ctx.arc(cx, y, t * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  return size;
}

/** Left stick: a ring with its cap. */
function stick(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): number {
  const cx = x + size / 2;
  ctx.fillStyle = INK.body;
  ctx.strokeStyle = INK.bodyEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, y, size / 2 - 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK.bodyEdge;
  ctx.beginPath();
  ctx.arc(cx, y, size * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK.symbol;
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.beginPath();
  ctx.arc(cx, y, size * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  return size;
}

/**
 * Draws a gamepad button glyph `size` tall with its left edge at x and its
 * centre at y. Returns the drawn width (pills are wider than they are tall).
 */
export function drawPadButton(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, button: PadGlyph): number {
  ctx.save();
  let w: number;
  switch (button) {
    case 'south':
    case 'east':
    case 'west':
    case 'north':
      w = faceButton(ctx, x, y, size, button);
      break;
    case 'start':
    case 'select':
      w = menuButton(ctx, x, y, size, button);
      break;
    case 'dpad':
      w = dpad(ctx, x, y, size, null);
      break;
    case 'dpad-up':
    case 'dpad-down':
    case 'dpad-left':
    case 'dpad-right':
      w = dpad(ctx, x, y, size, button.slice(5) as 'up' | 'down' | 'left' | 'right');
      break;
    case 'lstick':
      w = stick(ctx, x, y, size);
      break;
  }
  ctx.restore();
  return w;
}

/* ---------------------------- Touch painters ---------------------------- */

/** The on-screen controls' look: translucent white strokes on a soft dark fill. */
export const TOUCH_INK = {
  fill: 'rgba(6,8,14,0.30)',
  fillLit: 'rgba(255,255,255,0.20)',
  stroke: 'rgba(255,255,255,0.35)',
  strokeLit: 'rgba(255,255,255,0.80)',
} as const;

/** A round touch control: ring + fill, brighter while `lit`. */
export function paintTouchRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, lit: boolean, width = 1.5): void {
  ctx.fillStyle = lit ? TOUCH_INK.fillLit : TOUCH_INK.fill;
  ctx.strokeStyle = lit ? TOUCH_INK.strokeLit : TOUCH_INK.stroke;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** The jump icon: an upward chevron over a short ground line ("leave the floor"). */
export function paintJumpIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, lit: boolean): void {
  ctx.strokeStyle = lit ? TOUCH_INK.strokeLit : 'rgba(255,255,255,0.6)';
  ctx.lineWidth = Math.max(1.2, s * 0.16);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, cy + s * 0.05);
  ctx.lineTo(cx, cy - s * 0.42);
  ctx.lineTo(cx + s * 0.5, cy + s * 0.05);
  ctx.stroke();
  ctx.globalAlpha *= 0.6;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.32, cy + s * 0.48);
  ctx.lineTo(cx + s * 0.32, cy + s * 0.48);
  ctx.stroke();
  ctx.globalAlpha /= 0.6;
}

/** The pause icon: two bars. */
export function paintPauseIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, lit: boolean): void {
  ctx.fillStyle = lit ? TOUCH_INK.strokeLit : 'rgba(255,255,255,0.6)';
  const bw = s * 0.22;
  const bh = s * 0.7;
  ctx.beginPath();
  ctx.roundRect(cx - s * 0.3, cy - bh / 2, bw, bh, bw / 3);
  ctx.roundRect(cx + s * 0.3 - bw, cy - bh / 2, bw, bh, bw / 3);
  ctx.fill();
}

/**
 * Draws a touch prompt glyph `size` tall, left edge at x, centre at y.
 * 'tap' is a fingertip with ripples, 'jump' and 'stick' are miniatures of
 * the on-screen controls. Returns the drawn width.
 */
export function drawTouchGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, kind: TouchGlyph): number {
  const r = size / 2;
  const cx = x + r;
  ctx.save();
  switch (kind) {
    case 'tap':
      ctx.strokeStyle = TOUCH_INK.strokeLit;
      ctx.lineWidth = Math.max(1, size * 0.07);
      for (const [rr, a] of [
        [0.92, 0.35],
        [0.66, 0.65],
      ] as const) {
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(cx, y, r * rr, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = INK.symbol;
      ctx.beginPath();
      ctx.arc(cx, y, r * 0.36, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'jump':
      paintTouchRing(ctx, cx, y, r - 0.75, false, Math.max(1, size * 0.06));
      paintJumpIcon(ctx, cx, y, size * 0.42, true);
      break;
    case 'stick': {
      paintTouchRing(ctx, cx, y, r - 0.75, false, Math.max(1, size * 0.06));
      paintTouchRing(ctx, cx + r * 0.22, y, r * 0.42, true, Math.max(1, size * 0.05));
      // Left/right hints: the stick's job in a platformer is mostly horizontal.
      ctx.strokeStyle = TOUCH_INK.strokeLit;
      ctx.lineWidth = Math.max(1, size * 0.06);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const dir of [-1, 1]) {
        const tip = cx + dir * r * 0.82;
        ctx.moveTo(tip - dir * r * 0.16, y - r * 0.16);
        ctx.lineTo(tip, y);
        ctx.lineTo(tip - dir * r * 0.16, y + r * 0.16);
      }
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
  return size;
}
