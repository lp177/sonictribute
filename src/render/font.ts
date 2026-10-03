/**
 * BOLT Display — the game's own typeface, drawn in code like everything else.
 *
 * The old UI set every word in the platform's `monospace`: Consolas on
 * Windows, Menlo on a Mac, DejaVu on Linux — three different games, none of
 * them looking like one, and a terminal font says "debug overlay", not
 * "Sonic". This is a heavy, rounded, slightly italic display face built from
 * stroked centre-lines on a 6-unit cap height, so it renders identically
 * everywhere, stays razor sharp at any render scale, and can carry the
 * cartoon outline + drop shadow that keeps HUD text legible over any
 * background. It is caps-only by design (lowercase maps to caps): it is for
 * titles, labels and numbers. Running prose uses the system UI sans
 * (`proseFont`), which is what prose is for.
 *
 * Glyph geometry is pure data (`GLYPHS`, unit tested for coverage); only
 * `drawText` touches a canvas.
 */

/** Cap height in glyph units. */
const CAP = 6;
/** Stroke weight in glyph units: heavy, so small sizes stay solid. */
const WEIGHT = 1.32;
/** Gap between glyph boxes, in units (on top of the stroke overhang). */
const GAP = 1.75;
/** Horizontal shear for the italic lean. */
const SLANT = 0.16;

interface Glyph {
  /** SVG path data on the 6-unit grid (y down, baseline at 6). */
  d: string;
  /** Advance width in units (centre-line box; the stroke adds overhang). */
  w: number;
}

/**
 * Centre-lines for every glyph. Digits share one width so counters never
 * jitter as they tick (tabular figures).
 */
export const GLYPHS: Record<string, Glyph> = {
  A: { d: 'M0 6 L2.1 0 L4.2 6 M0.8 4 L3.4 4', w: 4.2 },
  B: { d: 'M0 6 L0 0 L2.5 0 Q3.9 0 3.9 1.5 Q3.9 3 2.5 3 L0 3 M2.5 3 Q4.2 3 4.2 4.5 Q4.2 6 2.5 6 L0 6', w: 4.2 },
  C: { d: 'M4 1.1 Q3.4 0 2.2 0 Q0 0 0 3 Q0 6 2.2 6 Q3.4 6 4 4.9', w: 4 },
  D: { d: 'M0 0 L0 6 L1.8 6 Q4.2 6 4.2 3 Q4.2 0 1.8 0 Z', w: 4.2 },
  E: { d: 'M3.8 0 L0 0 L0 6 L3.8 6 M0 3 L3 3', w: 3.8 },
  F: { d: 'M3.8 0 L0 0 L0 6 M0 3 L3 3', w: 3.6 },
  G: { d: 'M4 1.1 Q3.4 0 2.2 0 Q0 0 0 3 Q0 6 2.2 6 Q4.2 6 4.2 4 L4.2 3.3 L2.5 3.3', w: 4.2 },
  H: { d: 'M0 0 L0 6 M4 0 L4 6 M0 3 L4 3', w: 4 },
  I: { d: 'M0 0 L0 6', w: 0 },
  J: { d: 'M3 0 L3 4.2 Q3 6 1.5 6 Q0 6 0 4.6', w: 3 },
  K: { d: 'M0 0 L0 6 M4 0 L0.5 3.5 M1.5 2.6 L4.1 6', w: 4 },
  L: { d: 'M0 0 L0 6 L3.6 6', w: 3.5 },
  M: { d: 'M0 6 L0 0 L2.5 3.8 L5 0 L5 6', w: 5 },
  N: { d: 'M0 6 L0 0 L4 6 L4 0', w: 4 },
  O: { d: 'M2.2 0 Q4.4 0 4.4 3 Q4.4 6 2.2 6 Q0 6 0 3 Q0 0 2.2 0 Z', w: 4.4 },
  P: { d: 'M0 6 L0 0 L2.5 0 Q4.1 0 4.1 1.75 Q4.1 3.5 2.5 3.5 L0 3.5', w: 4.1 },
  Q: { d: 'M2.2 0 Q4.4 0 4.4 3 Q4.4 6 2.2 6 Q0 6 0 3 Q0 0 2.2 0 Z M2.8 4.4 L4.6 6.3', w: 4.4 },
  R: { d: 'M0 6 L0 0 L2.5 0 Q4.1 0 4.1 1.75 Q4.1 3.5 2.5 3.5 L0 3.5 M2.3 3.5 L4.2 6', w: 4.2 },
  S: { d: 'M3.9 1 Q3.3 0 2 0 Q0.1 0 0.1 1.6 Q0.1 3 2 3 Q4.1 3 4.1 4.5 Q4.1 6 2 6 Q0.7 6 0 5', w: 4.1 },
  T: { d: 'M0 0 L4.4 0 M2.2 0 L2.2 6', w: 4.4 },
  U: { d: 'M0 0 L0 4 Q0 6 2.1 6 Q4.2 6 4.2 4 L4.2 0', w: 4.2 },
  V: { d: 'M0 0 L2.15 6 L4.3 0', w: 4.3 },
  W: { d: 'M0 0 L1.35 6 L2.8 1.8 L4.25 6 L5.6 0', w: 5.6 },
  X: { d: 'M0 0 L4.1 6 M4.1 0 L0 6', w: 4.1 },
  Y: { d: 'M0 0 L2.1 3.1 L4.2 0 M2.1 3.1 L2.1 6', w: 4.2 },
  Z: { d: 'M0.1 0 L4 0 L0 6 L4 6', w: 4 },
  '0': { d: 'M2 0 Q4 0 4 3 Q4 6 2 6 Q0 6 0 3 Q0 0 2 0 Z', w: 4 },
  '1': { d: 'M0.9 1.3 L2.5 0 L2.5 6', w: 4 },
  '2': { d: 'M0.2 1.2 Q0.8 0 2.1 0 Q4 0 4 1.8 Q4 3 2.5 4 L0.1 6 L4 6', w: 4 },
  '3': { d: 'M0.3 0.7 Q1 0 2.1 0 Q3.8 0 3.8 1.5 Q3.8 2.9 2 2.9 L1.5 2.9 M2 2.9 Q4 2.9 4 4.45 Q4 6 2 6 Q0.8 6 0.1 5.2', w: 4 },
  '4': { d: 'M3 6 L3 0 L0 4.2 L4.2 4.2', w: 4 },
  '5': { d: 'M3.8 0 L0.7 0 L0.3 2.8 Q1.1 2.4 2.1 2.4 Q4 2.4 4 4.2 Q4 6 2 6 Q0.8 6 0.1 5.2', w: 4 },
  '6': { d: 'M3.6 0.5 Q3 0 2.2 0 Q0 0 0 3.4 Q0 6 2 6 Q4 6 4 4.25 Q4 2.6 2.1 2.6 Q0.6 2.6 0 3.6', w: 4 },
  '7': { d: 'M0 0 L4 0 L1.6 6', w: 4 },
  '8': { d: 'M2 2.9 Q0.25 2.9 0.25 1.45 Q0.25 0 2 0 Q3.75 0 3.75 1.45 Q3.75 2.9 2 2.9 Q0 2.9 0 4.45 Q0 6 2 6 Q4 6 4 4.45 Q4 2.9 2 2.9 Z', w: 4 },
  '9': { d: 'M0.4 5.5 Q1 6 1.8 6 Q4 6 4 2.6 Q4 0 2 0 Q0 0 0 1.75 Q0 3.4 1.9 3.4 Q3.4 3.4 4 2.4', w: 4 },
  ' ': { d: '', w: 1.6 },
  '.': { d: 'M0 5.95 L0 6', w: 0 },
  ',': { d: 'M0.35 5.7 L0 6.9', w: 0.35 },
  ':': { d: 'M0 1.95 L0 2 M0 5.95 L0 6', w: 0 },
  ';': { d: 'M0.3 1.95 L0.3 2 M0.35 5.7 L0 6.9', w: 0.35 },
  '-': { d: 'M0 3.2 L2.4 3.2', w: 2.4 },
  '–': { d: 'M0 3.2 L3.6 3.2', w: 3.6 },
  '—': { d: 'M0 3.2 L5 3.2', w: 5 },
  _: { d: 'M0 6.6 L4 6.6', w: 4 },
  '+': { d: 'M0 3.2 L3.2 3.2 M1.6 1.6 L1.6 4.8', w: 3.2 },
  '=': { d: 'M0 2.3 L3.2 2.3 M0 4.1 L3.2 4.1', w: 3.2 },
  '/': { d: 'M0 6 L3 0', w: 3 },
  '!': { d: 'M0 0 L0 3.8 M0 5.95 L0 6', w: 0 },
  '?': { d: 'M0 1.2 Q0.6 0 1.9 0 Q3.6 0 3.6 1.6 Q3.6 2.8 1.9 3.4 L1.9 4 M1.9 5.95 L1.9 6', w: 3.6 },
  "'": { d: 'M0 0 L0 1.7', w: 0 },
  '’': { d: 'M0.3 0 L0 1.7', w: 0.3 },
  '"': { d: 'M0 0 L0 1.7 M1.3 0 L1.3 1.7', w: 1.3 },
  '(': { d: 'M1.3 -0.4 Q0 1.5 0 3 Q0 4.5 1.3 6.4', w: 1.3 },
  ')': { d: 'M0 -0.4 Q1.3 1.5 1.3 3 Q1.3 4.5 0 6.4', w: 1.3 },
  '#': { d: 'M1.3 0.3 L0.8 5.7 M3 0.3 L2.5 5.7 M0 2 L3.6 2 M-0.2 4 L3.4 4', w: 3.5 },
  '%': { d: 'M0.9 0.3 L0.9 1.6 M3.4 4.4 L3.4 5.7 M3.9 0 L0.4 6', w: 4.3 },
  '&': { d: 'M4 6 L1 2.4 Q0.3 1.6 0.6 0.8 Q1 0 1.9 0 Q2.9 0 2.9 1.1 Q2.9 2 1.5 3 Q0 4 0 4.8 Q0 6 1.6 6 Q2.9 6 4 4', w: 4 },
  '·': { d: 'M0 3.15 L0 3.2', w: 0 },
  '•': { d: 'M0 3.15 L0 3.2', w: 0 },
  '×': { d: 'M0 1.8 L2.8 4.6 M2.8 1.8 L0 4.6', w: 2.8 },
  '<': { d: 'M3 0.8 L0 3.2 L3 5.6', w: 3 },
  '>': { d: 'M0 0.8 L3 3.2 L0 5.6', w: 3 },
  '←': { d: 'M4.4 3.2 L0 3.2 M1.8 1.3 L0 3.2 L1.8 5.1', w: 4.4 },
  '→': { d: 'M0 3.2 L4.4 3.2 M2.6 1.3 L4.4 3.2 L2.6 5.1', w: 4.4 },
  '↑': { d: 'M1.9 6 L1.9 0.6 M0 2.4 L1.9 0.4 L3.8 2.4', w: 3.8 },
  '↓': { d: 'M1.9 0 L1.9 5.4 M0 3.6 L1.9 5.6 L3.8 3.6', w: 3.8 },
  '▶': { d: 'M0 0.6 L3.4 3.2 L0 5.8 Z', w: 3.4 },
  '◀': { d: 'M3.4 0.6 L0 3.2 L3.4 5.8 Z', w: 3.4 },
  '★': {
    d: 'M2.3 0 L2.95 2.05 L5 2.1 L3.35 3.35 L3.95 5.45 L2.3 4.2 L0.65 5.45 L1.25 3.35 L-0.4 2.1 L1.65 2.05 Z',
    w: 4.6,
  },
};

/**
 * Kerning pairs (units). Open-sided letters (L, T, V, Y, A...) leave holes a
 * fixed advance cannot close — "BOL T" is the kind of gap that makes a logo
 * look home-made.
 */
const KERN: Record<string, number> = {
  LT: -2.2, LV: -1.6, LW: -1.4, LY: -2, LO: -0.6, LC: -0.6, LG: -0.6, LU: -0.4,
  TA: -1.4, AT: -1.4, AV: -1.2, VA: -1.2, AW: -0.9, WA: -0.9, AY: -1.2, YA: -1.2,
  TO: -0.7, OT: -0.7, TC: -0.6, TJ: -1, FA: -1, PA: -0.9, 'P.': -1.2, 'T.': -1.4, 'F.': -1.2, 'Y.': -1.2,
  'L’': -1.4, "L'": -1.4, RT: -0.5, RV: -0.5, RY: -0.6, KO: -0.3, VO: -0.5, OV: -0.5, YO: -0.6, OY: -0.6,
};

function kern(prev: string, cur: string): number {
  return KERN[prev + cur] ?? 0;
}

const ALIASES: Record<string, string> = { À: 'A', Â: 'A', É: 'E', È: 'E', Ê: 'E', Ë: 'E', Î: 'I', Ï: 'I', Ô: 'O', Ù: 'U', Û: 'U', Ç: 'C' };

/** Normalises a character to one the face has (caps-only; accents dropped). */
export function glyphKey(ch: string): string {
  const up = ch.toUpperCase();
  if (GLYPHS[up]) return up;
  if (ALIASES[up]) return ALIASES[up];
  return '?';
}

/** True when every character of `text` has a real glyph (no '?' fallback). */
export function hasGlyphs(text: string): boolean {
  for (const ch of text) {
    const up = ch.toUpperCase();
    if (!GLYPHS[up] && !ALIASES[up]) return false;
  }
  return true;
}

export interface TextStyle {
  /** Cap height in logical px. */
  size: number;
  fill?: string | CanvasGradient | CanvasPattern;
  /** Outline colour (drawn under the fill, as a fatter stroke). */
  outline?: string;
  /** Outline thickness in logical px on each side (default ~size/7). */
  outlineWidth?: number;
  /** Drop shadow offset (logical px) and colour. */
  shadow?: { x: number; y: number; color: string };
  align?: 'left' | 'center' | 'right';
  /** Extra letter spacing in glyph units. */
  tracking?: number;
  /** Lean (default on). */
  italic?: boolean;
  /** Weight multiplier (1 = regular heavy). */
  weight?: number;
  alpha?: number;
}

/** Width of `text` in logical px at cap height `size`. */
export function measureText(text: string, size: number, tracking = 0, weight = 1): number {
  const u = size / CAP;
  let w = 0;
  let n = 0;
  let prev = '';
  for (const ch of text) {
    const key = glyphKey(ch);
    const g = GLYPHS[key];
    w += g.w + GAP + tracking + kern(prev, key);
    prev = key;
    n++;
  }
  if (n > 0) w -= GAP + tracking;
  return (w + WEIGHT * weight) * u;
}

const pathCache = new Map<string, Path2D>();
function glyphPath(key: string): Path2D | null {
  const g = GLYPHS[key];
  if (!g.d) return null;
  let p = pathCache.get(key);
  if (!p) {
    p = new Path2D(g.d);
    pathCache.set(key, p);
  }
  return p;
}

/**
 * Draws `text` with its BASELINE at y. Returns the drawn width.
 *
 * The outline, the shadow and the fill are three passes over the whole
 * string (not per glyph), so neighbouring letters' outlines never paint over
 * each other's fill.
 */
export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, style: TextStyle): number {
  const size = style.size;
  const u = size / CAP;
  const tracking = style.tracking ?? 0;
  const weight = style.weight ?? 1;
  const width = measureText(text, size, tracking, weight);
  const align = style.align ?? 'left';
  const left = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
  const lw = WEIGHT * weight;
  const outline = style.outlineWidth ?? Math.max(1, size / 7);

  ctx.save();
  if (style.alpha !== undefined) ctx.globalAlpha *= style.alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const pass = (dx: number, dy: number, stroke: string | CanvasGradient | CanvasPattern, extra: number) => {
    ctx.save();
    ctx.translate(left + dx, y + dy);
    if (style.italic !== false) ctx.transform(1, 0, -SLANT, 1, 0, 0);
    ctx.scale(u, u);
    ctx.translate(lw / 2, -CAP);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw + (extra * 2) / u;
    let cx = 0;
    let prev = '';
    for (const ch of text) {
      const key = glyphKey(ch);
      cx += kern(prev, key);
      prev = key;
      const p = glyphPath(key);
      if (p) {
        ctx.save();
        ctx.translate(cx, 0);
        ctx.stroke(p);
        // Closed counters (O, D, the star) read better filled when they are
        // tiny shapes like the play triangles and the star.
        if (key === '▶' || key === '◀' || key === '★') {
          ctx.fillStyle = stroke;
          ctx.fill(p);
        }
        ctx.restore();
      }
      cx += GLYPHS[key].w + GAP + tracking;
    }
    ctx.restore();
  };

  if (style.shadow) pass(style.shadow.x, style.shadow.y, style.shadow.color, style.outline ? outline : 0);
  if (style.outline) pass(0, 0, style.outline, outline);
  pass(0, 0, style.fill ?? '#fff', 0);
  ctx.restore();
  return width;
}

/** The system UI sans, for running prose (story text, descriptions, hints). */
export function proseFont(size: number, weight = 600, italic = false): string {
  return `${italic ? 'italic ' : ''}${weight} ${size}px "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, "Noto Sans", sans-serif`;
}

/**
 * Word-wraps prose to `maxW` logical px with the current ctx font.
 * Pure apart from `measure`, so it is testable with a fake measurer.
 */
export function wrapLines(text: string, maxW: number, measure: (s: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && measure(next) > maxW) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
