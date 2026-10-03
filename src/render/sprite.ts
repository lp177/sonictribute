/**
 * Keyline sprites: draws a character into a small offscreen buffer, then
 * stamps a uniform dark outline around its whole silhouette before drawing it.
 *
 * A dark keyline around everything the player must track is the single most
 * important readability rule in a platformer: the hero, enemies and hazards
 * must separate from any background at a glance. Stroking each body part
 * instead draws lines BETWEEN parts too and the outline thickness changes
 * with every rotation; outlining the composited silhouette gives the clean
 * "cel" edge of hand-drawn sprites. Cost: one small buffer redraw and ten
 * blits per sprite per frame.
 */
import { makeLayer, blit, renderScale, worldScale, renderScaleVersion, type Layer } from '../core/view.ts';

const OFFSETS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.7, 0.7],
  [-0.7, 0.7],
  [0.7, -0.7],
  [-0.7, -0.7],
];

export class Outliner {
  private art: Layer | null = null;
  private ink: Layer | null = null;
  private version = -1;
  readonly size: number;
  /**
   * A sprite that lives in the level is drawn through the zoomed world
   * transform, so its buffer is baked at the world scale; baked at the UI
   * scale it would be magnified on the way to the screen and come out soft.
   */
  private readonly world: boolean;

  constructor(size: number, world = false) {
    this.size = size;
    this.world = world;
  }

  private get scale(): number {
    return this.world ? worldScale() : renderScale();
  }

  private ensure(): void {
    if (this.version === renderScaleVersion() && this.art) return;
    this.version = renderScaleVersion();
    this.art = makeLayer(this.size, this.size, this.scale);
    this.ink = makeLayer(this.size, this.size, this.scale);
  }

  private clear(l: Layer): void {
    l.ctx.save();
    l.ctx.setTransform(1, 0, 0, 1, 0, 0);
    l.ctx.globalCompositeOperation = 'source-over';
    l.ctx.globalAlpha = 1;
    l.ctx.clearRect(0, 0, l.canvas.width, l.canvas.height);
    l.ctx.restore();
  }

  /** Renders `paint` (centred on 0,0) into the buffer. */
  paint(paint: (c: CanvasRenderingContext2D) => void): void {
    this.ensure();
    const a = this.art!;
    this.clear(a);
    a.ctx.save();
    a.ctx.translate(this.size / 2, this.size / 2);
    paint(a.ctx);
    a.ctx.restore();
  }

  /** The buffered art as a flat silhouette of `color`. */
  private tint(color: string): Layer {
    const k = this.ink!;
    this.clear(k);
    k.ctx.save();
    k.ctx.setTransform(1, 0, 0, 1, 0, 0);
    k.ctx.drawImage(this.art!.canvas, 0, 0);
    k.ctx.globalCompositeOperation = 'source-in';
    k.ctx.fillStyle = color;
    k.ctx.fillRect(0, 0, k.canvas.width, k.canvas.height);
    k.ctx.restore();
    return k;
  }

  /** Draws the buffered art at (x, y) with a keyline `width` px wide. */
  stamp(ctx: CanvasRenderingContext2D, x: number, y: number, ink = '#0a1030', width = 1.6, alpha = 1): void {
    if (!this.art) return;
    const ox = x - this.size / 2;
    const oy = y - this.size / 2;
    // Snap to device pixels so the outline never shimmers as the sprite moves.
    const s = this.scale;
    const sx = Math.round(ox * s) / s;
    const sy = Math.round(oy * s) / s;
    const k = this.tint(ink);
    for (const [dx, dy] of OFFSETS) blit(ctx, k, sx + dx * width, sy + dy * width, alpha);
    blit(ctx, this.art, sx, sy, alpha);
  }

  /** A flat-colour ghost of the buffered art (speed afterimages). */
  ghost(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, alpha: number): void {
    if (!this.art) return;
    const k = this.tint(color);
    blit(ctx, k, x - this.size / 2, y - this.size / 2, alpha);
  }
}
