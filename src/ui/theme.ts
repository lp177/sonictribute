/**
 * Shared canvas-UI styling for the menus: a dark, Material-inspired surface
 * language (elevation, accent, clear selected/disabled states) drawn with the
 * same procedural approach as the rest of the game.
 */
export const UI = {
  scrim: 'rgba(8,8,12,0.78)',
  surface: '#1a1a22',
  surfaceHi: '#23232e',
  outline: '#33333f',
  accent: '#4be1ff',
  accentDim: 'rgba(75,225,255,0.16)',
  text: '#e7ebf2',
  textDim: '#9aa3b2',
  textFaint: '#666e7d',
  warn: '#ffd94a',
  danger: '#e8384f',
} as const;

/** Rounded surface with a subtle border — the panel "card". */
export function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 12,
): void {
  ctx.fillStyle = UI.surface;
  ctx.strokeStyle = UI.outline;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.stroke();
}

/**
 * Selected-row treatment: filled accent tint plus a leading accent bar. The
 * bar breathes gently as the keyboard-accessible stand-in for a pointer
 * ripple; `pulse` should be held at 1 when reduced motion is requested.
 */
export function selectionRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pulse: number,
): void {
  ctx.fillStyle = UI.accentDim;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.globalAlpha = 0.55 + 0.45 * pulse;
  ctx.fillStyle = UI.accent;
  ctx.fillRect(x, y + 2, 3, h - 4);
  ctx.globalAlpha = 1;
}

/** Key-cap chip used to show a bound key. */
export function keyChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  label: string,
  state: 'normal' | 'focus' | 'empty' | 'capturing',
): void {
  const h = 20;
  ctx.fillStyle = state === 'capturing' ? UI.accent : state === 'focus' ? UI.surfaceHi : '#16161d';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.strokeStyle = state === 'focus' || state === 'capturing' ? UI.accent : UI.outline;
  ctx.lineWidth = state === 'focus' || state === 'capturing' ? 2 : 1;
  ctx.stroke();

  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle =
    state === 'capturing' ? '#08131a' : state === 'empty' ? UI.textFaint : UI.text;
  ctx.fillText(label, x + w / 2, y + 14);
  ctx.textAlign = 'left';
}
