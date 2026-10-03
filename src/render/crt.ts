/**
 * The CRT filter: a light vintage glaze over the whole picture — scanlines, a
 * hint of aperture grille, a soft vignette, rounded tube corners and a trace
 * of glass sheen. Dosed to be felt more than seen: the art is drawn at full
 * device resolution and must stay crisp and readable underneath.
 *
 * It is a SEPARATE static canvas stacked over the game canvas, not a pass
 * inside the frame, for two reasons:
 *
 *  - it is baked once per resize, so it costs nothing per frame (the browser
 *    composites the two layers; no full-screen fill in the game's own budget);
 *  - it is laid out in real DEVICE pixels. The game canvas renders at a
 *    quantised (and, on a slow GPU, reduced) scale and is then resampled to
 *    fit the window; scanlines drawn inside it would be resampled too and
 *    beat against the pixel grid in visible bands. Out here every line is an
 *    exact number of device rows, whatever the game resolution is doing.
 */

/** How dark a scanline's trough gets (0..1). */
const LINE_DEPTH = 0.2;
/** Opacity of the red / green / blue phosphor stripes. */
const GRILLE_ALPHA = 0.04;
const VIGNETTE_ALPHA = 0.3;
/** Tube corner radius, as a share of the picture height. */
const CORNER = 0.035;
const BEZEL = '#06070c';

/**
 * Device rows per scanline for a picture `deviceH` rows tall: about one line
 * per logical row of the 360-row view, never fewer than two rows (a one-row
 * pattern is just a darker screen).
 */
export function scanlinePeriod(deviceH: number): number {
  return Math.max(2, Math.round(deviceH / 360));
}

/**
 * Darkness (0..1) of each device row of one scanline: the upper rows stay
 * clear and the picture dims smoothly into the gap below the beam.
 */
export function scanlineProfile(period: number, depth = LINE_DEPTH): number[] {
  return Array.from({ length: period }, (_, i) => {
    const t = Math.max(0, Math.min(1, ((i + 0.5) / period - 0.45) / 0.5));
    return depth * t * t * (3 - 2 * t);
  });
}

export class CrtOverlay {
  private canvas: HTMLCanvasElement;
  private enabled = true;

  constructor(host: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    const st = this.canvas.style;
    st.position = 'absolute';
    // Never in the way of the pointer: clicks and touches belong to the game.
    st.pointerEvents = 'none';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(this.canvas);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.canvas.style.display = on ? 'block' : 'none';
  }

  /** Lays the overlay over a `cssW` x `cssH` picture centred in its host. */
  fit(cssW: number, cssH: number, dpr: number): void {
    const host = this.canvas.parentElement!;
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    const st = this.canvas.style;
    // Snapped to whole device pixels, or the browser would resample the lines.
    st.left = `${Math.round(((host.clientWidth - cssW) / 2) * dpr) / dpr}px`;
    st.top = `${Math.round(((host.clientHeight - cssH) / 2) * dpr) / dpr}px`;
    st.width = `${w / dpr}px`;
    st.height = `${h / dpr}px`;
    if (this.canvas.width === w && this.canvas.height === h) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.bake(w, h);
    this.setEnabled(this.enabled);
  }

  private bake(w: number, h: number): void {
    const ctx = this.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);
    const period = scanlinePeriod(h);

    // Aperture grille: vertical phosphor stripes, one triad per scanline pitch.
    const sw = Math.max(1, Math.round(period / 3));
    const grille = tile(sw * 3, 1, (c) => {
      ['255,48,48', '48,255,72', '72,72,255'].forEach((rgb, i) => {
        c.fillStyle = `rgba(${rgb},${GRILLE_ALPHA})`;
        c.fillRect(i * sw, 0, sw, 1);
      });
    });
    ctx.fillStyle = ctx.createPattern(grille, 'repeat')!;
    ctx.fillRect(0, 0, w, h);

    // Scanlines.
    const lines = tile(1, period, (c) => {
      scanlineProfile(period).forEach((d, i) => {
        c.fillStyle = `rgba(0,0,0,${d})`;
        c.fillRect(0, i, 1, 1);
      });
    });
    ctx.fillStyle = ctx.createPattern(lines, 'repeat')!;
    ctx.fillRect(0, 0, w, h);

    // Vignette: the tube is dimmer toward its corners.
    const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.45, w / 2, h / 2, Math.hypot(w, h) / 2);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(0,0,0,${VIGNETTE_ALPHA})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // Glass: a faint sheen across the top third.
    const sheen = ctx.createLinearGradient(0, 0, 0, h * 0.36);
    sheen.addColorStop(0, 'rgba(255,255,255,0.028)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h * 0.36);

    // Rounded tube corners, in the page's own black.
    ctx.fillStyle = BEZEL;
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.roundRect(0, 0, w, h, h * CORNER);
    ctx.fill('evenodd');
  }
}

function tile(w: number, h: number, paint: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  paint(cv.getContext('2d')!);
  return cv;
}
