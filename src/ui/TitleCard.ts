/**
 * The act title card: the classic Sonic "zone name sweeps in" moment.
 *
 * The old card was a translucent rounded box near the bottom of the screen —
 * right over the ground the hero was about to run on. This one lives in the
 * upper half (the sky, which is empty at the start of an act), is built from
 * the biome's colours, and gets out of the way: control is live from frame
 * one, the card holds for about a second and a half and then whips off
 * screen. Players replaying an act never wait for it.
 */
import { drawText, measureText } from '../render/font.ts';
import { VIEW_W } from '../core/view.ts';
import type { LevelTheme } from '../game/Level.ts';
import { BIOME_UI, UI, slantPath } from './theme.ts';

const IN = 16;
const HOLD = 100;
const OUT = 18;
export const TITLE_CARD_FRAMES = IN + HOLD + OUT;

const ease = (t: number) => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;
const easeIn = (t: number) => Math.max(0, Math.min(1, t)) ** 3;

export class TitleCard {
  private t = 0;
  private zone: string;
  private act: number;
  private title: string;
  private hour: string;
  private theme: LevelTheme;

  constructor(zone: string, act: number, title: string, hour: string, theme: LevelTheme) {
    this.zone = zone;
    this.act = act;
    this.title = title.toUpperCase();
    this.hour = hour;
    this.theme = theme;
  }

  get done(): boolean {
    return this.t >= TITLE_CARD_FRAMES;
  }

  update(): void {
    if (!this.done) this.t++;
  }

  /** Skip straight to the exit sweep (any input after the first beat). */
  hurry(): void {
    if (this.t > IN && this.t < IN + HOLD) this.t = IN + HOLD;
  }

  draw(ctx: CanvasRenderingContext2D, reduced: boolean): void {
    if (this.done) return;
    const c = BIOME_UI[this.theme];
    const t = this.t;
    const enter = reduced ? 1 : ease(t / IN);
    const leave = reduced ? 0 : easeIn((t - IN - HOLD) / OUT);
    const fade = reduced ? Math.min(1, t / 10, (TITLE_CARD_FRAMES - t) / 12) : 1;

    ctx.save();
    ctx.globalAlpha = fade;

    // Main band: sweeps in from the left, leaves to the right.
    const bandY = 118;
    const bandH = 54;
    const titleSize = 22;
    const tw = measureText(this.title, titleSize);
    const bandW = Math.max(300, tw + 120);
    const bx = -bandW - 40 + (bandW + 40 + 60) * enter + VIEW_W * 1.3 * leave;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    slantPath(ctx, bx + 6, bandY + 6, bandW, bandH, 0.5);
    ctx.fill();
    const g = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
    g.addColorStop(0, c.main);
    g.addColorStop(1, c.deep);
    ctx.fillStyle = g;
    slantPath(ctx, bx, bandY, bandW, bandH, 0.5);
    ctx.fill();
    // Speed stripes trailing the band.
    ctx.fillStyle = c.main;
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = fade * (0.55 - i * 0.15);
      slantPath(ctx, bx - 26 - i * 22, bandY + 10 + i * 12, 16, 6, 0.5);
      ctx.fill();
    }
    ctx.globalAlpha = fade;

    // Zone line above the band, sliding the other way.
    const zx = VIEW_W + 40 - (VIEW_W + 40 - 76) * enter - VIEW_W * 1.3 * leave;
    drawText(ctx, this.zone, zx, bandY - 8, { size: 9, fill: '#ffffff', outline: UI.ink, outlineWidth: 2 });
    drawText(ctx, this.hour, zx + measureText(this.zone, 9) + 10, bandY - 8, {
      size: 6.5,
      fill: c.main,
      outline: UI.ink,
      outlineWidth: 1.6,
    });

    // Title on the band.
    drawText(ctx, this.title, bx + 52, bandY + 36, {
      size: titleSize,
      fill: '#ffffff',
      outline: UI.ink,
      outlineWidth: 3,
      shadow: { x: 2, y: 3, color: 'rgba(0,0,0,0.35)' },
    });

    // ACT badge: drops in after the band lands.
    const pop = reduced ? 1 : ease((t - IN + 2) / 10);
    if (pop > 0) {
      const ax = bx + 52 + tw + 34;
      const ay = bandY + bandH - 4;
      const s = pop * (1 + 0.25 * Math.sin(Math.min(1, pop) * Math.PI));
      ctx.save();
      ctx.translate(ax, ay);
      ctx.scale(s, s);
      ctx.fillStyle = UI.ink;
      ctx.beginPath();
      ctx.arc(0, 0, 21, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      drawText(ctx, 'ACT', 0, -6, { size: 5.5, fill: UI.ink, align: 'center', italic: false });
      drawText(ctx, String(this.act), 0, 11, { size: 15, fill: c.deep, align: 'center' });
      ctx.restore();
    }
    ctx.restore();
  }
}
