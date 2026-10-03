/**
 * The logical view and the device-resolution render scale.
 *
 * Gameplay, layout and every draw call work in a fixed 640x360 LOGICAL space
 * (physics constants, camera, level design and HUD all assume it). The canvas
 * backing store, however, is sized to the real screen: a 1080p window renders
 * at 3x, a retina laptop at 2.5x. `Game` installs `scale` as the context
 * transform each frame, so vector art and text are rasterised at full device
 * resolution instead of being drawn at 640x360 and blown up — the old
 * pipeline's pixelated upscale turned every anti-aliased curve and glyph into
 * mush.
 *
 * The scale is quantised to quarter steps. That keeps 640*s, 360*s and every
 * 64-px chunk boundary on whole device pixels, so pre-rendered layers blit
 * 1:1 with no resampling blur as the camera scrolls.
 */

export const VIEW_W = 640;
export const VIEW_H = 360;

/**
 * How much bigger the WORLD is drawn than the UI. The frame is 640x360 for
 * menus, HUD and text, but a level seen at one world pixel per logical pixel
 * shows forty tiles across — twice the field of view of the games this one
 * is modelled on. Everything is then small and far away: top speed crawls
 * across the screen, the hero is a speck, and an act that is twenty screens
 * long reads as a corridor you can see the end of. At 1.5 the playfield is
 * 427x240 world pixels, the classic widescreen framing.
 */
export const WORLD_ZOOM = 1.5;

/** Highest render scale (1080p backing store); larger screens CSS-upscale. */
export const MAX_SCALE = 3;

let scale = 1;
let version = 0;

/** Device pixels per logical pixel. */
export function renderScale(): number {
  return scale;
}

/** Bumped whenever the scale changes, so caches know to re-bake. */
export function renderScaleVersion(): number {
  return version;
}

export function setRenderScale(s: number): void {
  if (s !== scale) {
    scale = s;
    version++;
  }
}

/**
 * Picks the render scale for a canvas box of `cssW` x `cssH` CSS pixels on a
 * `dpr` display: as many quarter-steps as fit, clamped to [1, max].
 */
export function fitScale(cssW: number, cssH: number, dpr: number, max = MAX_SCALE): number {
  const fit = Math.min((cssW * dpr) / VIEW_W, (cssH * dpr) / VIEW_H);
  return Math.max(1, Math.min(max, Math.floor(fit * 4) / 4));
}

/**
 * Device pixels per WORLD pixel at the resting zoom. World art (terrain,
 * loops, keylined sprites) is baked at this scale, so it blits 1:1 through
 * the zoomed world transform instead of being magnified from a UI-scale
 * bake. Quarter-step render scales keep a 256-px chunk on whole device
 * pixels here too (256 * 0.25 * 1.5 = 96).
 */
export function worldScale(): number {
  return scale * WORLD_ZOOM;
}

/** Rounds a logical coordinate to the nearest whole device pixel. */
export function snap(v: number): number {
  return Math.round(v * scale) / scale;
}

/** Rounds a world coordinate to the nearest whole device pixel at `zoom`. */
export function snapWorld(v: number, zoom = WORLD_ZOOM): number {
  const s = scale * zoom;
  return Math.round(v * s) / s;
}

/**
 * An offscreen surface measured in logical pixels but backed at the render
 * scale. Draw into `ctx` with logical coordinates; blit with `blit()`.
 */
export interface Layer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Logical size. */
  w: number;
  h: number;
  /** Scale the layer was baked at. */
  scale: number;
}

export function makeLayer(w: number, h: number, s = scale): Layer {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w * s));
  canvas.height = Math.max(1, Math.ceil(h * s));
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx, w, h, scale: s };
}

/** Draws a layer at logical (x, y), 1:1 in device pixels when scales match. */
export function blit(ctx: CanvasRenderingContext2D, layer: Layer, x: number, y: number, alpha = 1): void {
  if (alpha <= 0) return;
  const prev = ctx.globalAlpha;
  if (alpha !== 1) ctx.globalAlpha = prev * alpha;
  ctx.drawImage(layer.canvas, x, y, layer.canvas.width / layer.scale, layer.canvas.height / layer.scale);
  if (alpha !== 1) ctx.globalAlpha = prev;
}
