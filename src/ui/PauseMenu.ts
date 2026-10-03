import type { Input } from '../core/Input.ts';
import { prefersReducedMotion } from '../core/prefs.ts';
import { VIEW_W, VIEW_H } from '../core/view.ts';
import { drawText } from '../render/font.ts';
import { UI, ListNav, menuRow, promptRow, slantPath, type Rect } from './theme.ts';

export type PauseChoice = 'resume' | 'settings' | 'restart' | 'quit';

const ITEMS: { id: PauseChoice; label: string; confirm?: string }[] = [
  { id: 'resume', label: 'RESUME' },
  { id: 'settings', label: 'OPTIONS' },
  { id: 'restart', label: 'RESTART ACT', confirm: 'RESTART? PRESS AGAIN' },
  { id: 'quit', label: 'QUIT TO TITLE', confirm: 'QUIT? PRESS AGAIN' },
];

/** What the pause screen shows about the run in progress. */
export interface PauseInfo {
  zone: string;
  act: string;
  title: string;
  time: string;
  crystals: number;
  crystalsTotal: number;
  rings: number;
}

const LIST_X = 64;
const LIST_Y = 126;
const ROW_H = 24;
const LIST_W = 190;

/**
 * In-level pause menu. `update` returns a choice once the player commits.
 *
 * Restart and quit throw the run away, so they ask twice: the first press
 * turns the row red with "PRESS AGAIN", any move cancels. Pause / back
 * always resumes — the key that opened the menu closes it.
 */
export class PauseMenu {
  private nav = new ListNav();
  private frame = 0;
  private armed: PauseChoice | null = null;
  private reduced = prefersReducedMotion();
  private info: PauseInfo | null;

  constructor(info: PauseInfo | null = null) {
    this.info = info;
  }

  get index(): number {
    return this.nav.index;
  }

  get items(): typeof ITEMS {
    return ITEMS;
  }

  private rows(): Rect[] {
    return ITEMS.map((_, i) => ({ x: LIST_X - 8, y: LIST_Y + i * ROW_H, w: LIST_W + 16, h: ROW_H - 4 }));
  }

  update(input: Input): PauseChoice | null {
    this.frame++;
    if (input.pausePressed()) return 'resume';
    const r = this.nav.update(input, ITEMS.length, this.rows());
    if (r === 'move') this.armed = null;
    if (r === 'back') return 'resume';
    if (r === 'confirm') {
      const item = ITEMS[this.nav.index];
      if (item.confirm && this.armed !== item.id) {
        this.armed = item.id;
        return null;
      }
      return item.id;
    }
    return null;
  }

  render(ctx: CanvasRenderingContext2D, input?: Input): void {
    const k = this.reduced ? 1 : 1 - (1 - Math.min(1, this.frame / 10)) ** 3;
    ctx.save();
    ctx.fillStyle = `rgba(6,7,14,${0.55 * k})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Slanted side panel sweeping in from the left.
    const px = -40 - 300 * (1 - k);
    ctx.fillStyle = 'rgba(10,12,26,0.94)';
    slantPath(ctx, px, 0, 330, VIEW_H, 0.36);
    ctx.fill();
    ctx.fillStyle = UI.accent;
    slantPath(ctx, px + 330, 0, 4, VIEW_H, 0.36);
    ctx.fill();

    const ox = (1 - k) * -120;
    drawText(ctx, 'PAUSED', LIST_X + ox, 74, { size: 24, fill: '#ffffff', outline: UI.ink, outlineWidth: 3 });
    if (this.info) {
      const i = this.info;
      drawText(ctx, `${i.zone} · ${i.act}`, LIST_X + ox, 92, { size: 6.5, fill: UI.accent, outline: UI.ink });
      drawText(ctx, i.title.toUpperCase(), LIST_X + ox, 106, { size: 8, fill: UI.textDim, outline: UI.ink });
    }

    ITEMS.forEach((it, i) => {
      const sel = this.nav.index === i;
      const armed = this.armed === it.id;
      menuRow(ctx, LIST_X + ox, LIST_Y + i * ROW_H, LIST_W, armed ? it.confirm! : it.label, sel, this.nav.age, {
        size: 9,
        h: ROW_H - 4,
        color: armed ? UI.danger : UI.accent,
      });
    });

    // Run summary on the right: where you are and how it is going.
    if (this.info) {
      const i = this.info;
      const rx = 470;
      const rows: [string, string][] = [
        ['TIME', i.time],
        ['RINGS', String(i.rings)],
        ['CRYSTALS', `${i.crystals}/${i.crystalsTotal}`],
      ];
      rows.forEach(([l, v], n) => {
        const y = 150 + n * 22;
        drawText(ctx, l, rx, y, { size: 7, fill: UI.gold, outline: UI.ink, alpha: k });
        drawText(ctx, v, rx + 110, y, { size: 9, fill: '#ffffff', outline: UI.ink, align: 'right', alpha: k });
      });
    }

    if (input) {
      promptRow(ctx, input, LIST_X + 120 + ox, VIEW_H - 22, [
        { action: 'confirm', label: 'SELECT' },
        { action: 'pause', label: 'RESUME' },
      ]);
    }
    ctx.restore();
  }
}
