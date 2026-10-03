/**
 * The game's UI language: shared colours, shapes, prompts and the menu
 * navigation every screen uses.
 *
 * The previous kit was "dark Material": rounded grey cards and a monospace
 * label column — the look of a settings app, not of a game about speed. This
 * one is built from the game's own motifs: forward-leaning parallelograms
 * (everything leans the way BOLT runs), the BOLT Display face with a dark
 * outline, and the Chrono cyan as the one accent that means "this is
 * selected / this is interactive". Gold is reserved for rewards, red for
 * danger, so colour always carries meaning.
 *
 * Prompts are device aware: a keyboard player sees their actual (rebindable)
 * keys, a pad player sees pad buttons, a touch player sees tap icons —
 * telling a pad user to "PRESS ENTER" is the kind of thing that makes a game
 * feel unfinished.
 */
import type { Input } from '../core/Input.ts';
import type { Action } from '../core/bindings.ts';
import { keyLabel } from '../core/bindings.ts';
import type { LevelTheme } from '../game/Level.ts';
import { drawText, measureText, type TextStyle } from '../render/font.ts';
import { drawPadButton, drawTouchGlyph, PAD_PROMPT } from './glyphs.ts';

export const UI = {
  ink: '#090b16',
  scrim: 'rgba(6,7,14,0.72)',
  panel: 'rgba(12,14,28,0.92)',
  panelHi: 'rgba(30,34,60,0.95)',
  edge: 'rgba(120,140,200,0.22)',
  text: '#f2f0ea',
  textDim: '#a8adc4',
  textFaint: '#6c7290',
  accent: '#4be1ff',
  accentInk: '#06222c',
  gold: '#ffd94a',
  danger: '#ff4b5c',
  good: '#7cf29a',
  /* Back-compat names used by older call sites. */
  warn: '#ffd94a',
  outline: 'rgba(120,140,200,0.22)',
  surface: 'rgba(12,14,28,0.92)',
  surfaceHi: 'rgba(30,34,60,0.95)',
  accentDim: 'rgba(75,225,255,0.16)',
} as const;

/** Per-biome UI accents: [main, deep]. Title cards and results wear them. */
export const BIOME_UI: Record<LevelTheme, { main: string; deep: string; glow: string }> = {
  verdant: { main: '#ff9e3d', deep: '#7a2f4e', glow: 'rgba(255,158,61,0.35)' },
  gear: { main: '#ffc22e', deep: '#3a2a33', glow: 'rgba(255,194,46,0.30)' },
  crystal: { main: '#4be1ff', deep: '#3a1f6e', glow: 'rgba(75,225,255,0.32)' },
  neon: { main: '#ff4fa8', deep: '#2b1450', glow: 'rgba(255,79,168,0.34)' },
};

/** The forward lean every UI shape shares (x offset per px of height). */
export const LEAN = 0.32;

/** A forward-leaning parallelogram path. `x` is the left edge at mid-height. */
export function slantPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lean = LEAN): void {
  const d = (h * lean) / 2;
  ctx.beginPath();
  ctx.moveTo(x + d, y);
  ctx.lineTo(x + w + d, y);
  ctx.lineTo(x + w - d, y + h);
  ctx.lineTo(x - d, y + h);
  ctx.closePath();
}

/** Standard text styles. */
export const TEXT = {
  title: (size = 18, fill: string = UI.text): TextStyle => ({ size, fill, outline: UI.ink, shadow: { x: 0, y: 2, color: 'rgba(0,0,0,0.45)' } }),
  label: (size = 8, fill: string = UI.text): TextStyle => ({ size, fill, outline: UI.ink }),
  plain: (size = 7, fill: string = UI.textDim): TextStyle => ({ size, fill }),
};

/** A dark glass panel with a lit top edge. */
export function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, accent: string = UI.accent): void {
  ctx.save();
  ctx.fillStyle = UI.panel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = UI.edge;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.9;
  slantPath(ctx, x + 14, y - 1.5, 46, 3);
  ctx.fill();
  ctx.globalAlpha = 0.35;
  slantPath(ctx, x + 66, y - 1.5, 14, 3);
  ctx.fill();
  ctx.restore();
}

/**
 * Selected-row treatment: a bright slanted bar the label sits on in dark
 * ink, with a chevron. `t` (0..1) is the eased selection age, so the bar
 * sweeps in from the left rather than popping.
 */
export function selectionBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t = 1, color: string = UI.accent): void {
  const e = 1 - (1 - Math.min(1, t)) ** 3;
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.18;
  slantPath(ctx, x, y, w, h);
  ctx.fill();
  ctx.globalAlpha = 1;
  slantPath(ctx, x, y, Math.max(6, w * e), h);
  ctx.fill();
  ctx.restore();
}

/* ------------------------------- Key prompts ------------------------------ */

/** A light keycap with the key's label. `y` is the vertical centre. Returns width. */
export function keycap(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, size = 7, state: 'normal' | 'focus' | 'capture' | 'empty' = 'normal'): number {
  const h = size + 7;
  const tw = measureText(label, size, 0, 0.9);
  const w = Math.max(h, tw + 8);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.roundRect(x, y - h / 2 + 1.5, w, h, 3);
  ctx.fill();
  ctx.fillStyle =
    state === 'capture' ? UI.accent : state === 'focus' ? '#ffffff' : state === 'empty' ? 'rgba(255,255,255,0.08)' : '#dcdfe8';
  ctx.beginPath();
  ctx.roundRect(x, y - h / 2, w, h, 3);
  ctx.fill();
  if (state === 'focus' || state === 'capture') {
    ctx.strokeStyle = UI.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  drawText(ctx, label, x + w / 2, y + size / 2, {
    size,
    fill: state === 'empty' ? UI.textFaint : UI.ink,
    align: 'center',
    weight: 0.9,
    italic: false,
  });
  ctx.restore();
  return w;
}

export type PromptAction = 'confirm' | 'back' | 'jump' | 'pause' | 'move' | 'down';

/** Draws the glyph for an action on the player's current device. Returns width. */
export function promptGlyph(ctx: CanvasRenderingContext2D, input: Input, x: number, y: number, action: PromptAction, size = 7): number {
  const dev = input.lastDevice;
  if (dev === 'gamepad') {
    const pad = action === 'down' ? 'dpad-down' : PAD_PROMPT[action];
    return drawPadButton(ctx, x, y, size + 7, pad);
  }
  if (dev === 'touch') {
    return drawTouchGlyph(ctx, x, y, size + 7, action === 'jump' ? 'jump' : action === 'move' || action === 'down' ? 'stick' : 'tap');
  }
  const b = input.bindings;
  const key = (a: Action) => keyLabel(b.get(a).primary);
  if (action === 'move') {
    let w = keycap(ctx, x, y, key('left'), size);
    w += 2 + keycap(ctx, x + w + 2, y, key('right'), size);
    return w;
  }
  const label =
    action === 'confirm' ? 'ENTER' : action === 'back' ? 'ESC' : action === 'pause' ? key('pause') : action === 'down' ? key('down') : key('jump');
  return keycap(ctx, x, y, label, size);
}

/**
 * A row of "[glyph] LABEL" hints. `align` positions the whole row around x.
 * Returns the row width.
 */
export function promptRow(
  ctx: CanvasRenderingContext2D,
  input: Input,
  x: number,
  y: number,
  items: { action: PromptAction; label: string }[],
  align: 'left' | 'center' | 'right' = 'center',
  size = 7,
  alpha = 1,
): number {
  // Measure by drawing off-canvas once is wasteful; estimate glyph widths.
  const glyphW = (a: PromptAction) => {
    if (input.lastDevice === 'gamepad' || input.lastDevice === 'touch') return size + 7;
    const label = (act: Action) => keyLabel(input.bindings.get(act).primary);
    const one = (l: string) => Math.max(size + 7, measureText(l, size, 0, 0.9) + 8);
    if (a === 'move') return one(label('left')) + 2 + one(label('right'));
    const l = a === 'confirm' ? 'ENTER' : a === 'back' ? 'ESC' : a === 'pause' ? label('pause') : a === 'down' ? label('down') : label('jump');
    return one(l);
  };
  const gap = 12;
  const widths = items.map((it) => glyphW(it.action) + 4 + measureText(it.label, size));
  const total = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ctx.save();
  ctx.globalAlpha *= alpha;
  items.forEach((it, i) => {
    const gw = promptGlyph(ctx, input, cx, y, it.action, size);
    drawText(ctx, it.label, cx + gw + 4, y + size / 2, { size, fill: UI.text, outline: UI.ink });
    cx += widths[i] + gap;
  });
  ctx.restore();
  return total;
}

/* -------------------------------- Navigation ------------------------------ */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

export type NavResult = 'confirm' | 'back' | 'left' | 'right' | 'move' | null;

/**
 * Vertical list navigation shared by every menu: keys/pad move with wrap and
 * auto-repeat, the pointer hovers to select and clicks (press AND release on
 * the same row) to confirm, and the wheel scrolls. `rows` are the hit boxes
 * of the rows as last laid out.
 */
export class ListNav {
  index = 0;
  /** Frames since the selection last changed (drives the bar sweep). */
  age = 99;

  update(input: Input, count: number, rows: Rect[]): NavResult {
    this.age++;
    if (count <= 0) return null;
    if (this.index >= count) this.index = count - 1;
    const before = this.index;
    let result: NavResult = null;
    if (input.menuUp()) this.index = (this.index + count - 1) % count;
    if (input.menuDown()) this.index = (this.index + 1) % count;
    const p = input.pointer;
    if (p.visible && p.moved) {
      const hovered = rows.findIndex((r) => inRect(r, p.x, p.y));
      if (hovered >= 0) this.index = hovered;
    }
    if (p.scrollSteps) this.index = Math.max(0, Math.min(count - 1, this.index + p.scrollSteps));
    if (this.index !== before) {
      this.age = 0;
      result = 'move';
    }
    if (input.menuLeft()) return 'left';
    if (input.menuRight()) return 'right';
    if (input.menuBack()) return 'back';
    if (input.menuConfirm()) return 'confirm';
    if (p.released) {
      const r = rows[this.index];
      if (r && inRect(r, p.x, p.y) && inRect(r, p.pressX, p.pressY)) return 'confirm';
    }
    return result;
  }
}

/**
 * Draws a standard menu row: label left, optional value right, selection bar.
 * Returns its hit rect.
 */
export function menuRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  label: string,
  selected: boolean,
  age: number,
  opts: { value?: string; valueColor?: string; size?: number; h?: number; color?: string; disabled?: boolean } = {},
): Rect {
  const size = opts.size ?? 9;
  const h = opts.h ?? size + 9;
  if (selected) selectionBar(ctx, x, y, w, h, age / 8, opts.color ?? UI.accent);
  const nudge = selected ? 6 * Math.min(1, age / 6) : 0;
  const fg = selected ? UI.accentInk : opts.disabled ? UI.textFaint : UI.text;
  drawText(ctx, label, x + 10 + nudge, y + h / 2 + size / 2, {
    size,
    fill: fg,
    outline: selected ? undefined : UI.ink,
  });
  if (opts.value) {
    drawText(ctx, opts.value, x + w - 10, y + h / 2 + (size - 1) / 2, {
      size: size - 1,
      fill: selected ? UI.accentInk : opts.valueColor ?? UI.textDim,
      outline: selected ? undefined : UI.ink,
      align: 'right',
    });
  }
  return { x: x - 4, y, w: w + 8, h };
}
