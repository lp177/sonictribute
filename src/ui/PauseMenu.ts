import type { Input } from '../core/Input.ts';
import { prefersReducedMotion } from '../core/prefs.ts';
import { UI, panel, selectionRow } from './theme.ts';

export type PauseChoice = 'resume' | 'settings' | 'restart' | 'quit';

const ITEMS: { id: PauseChoice; label: string }[] = [
  { id: 'resume', label: 'RESUME' },
  { id: 'settings', label: 'SETTINGS' },
  { id: 'restart', label: 'RESTART ZONE' },
  { id: 'quit', label: 'QUIT TO TITLE' },
];

/** In-level pause menu. `update` returns a choice once the player commits. */
export class PauseMenu {
  index = 0;
  private frame = 0;
  private reduced = prefersReducedMotion();

  get items(): typeof ITEMS {
    return ITEMS;
  }

  update(input: Input): PauseChoice | null {
    this.frame++;
    if (input.uiWasPressed('ArrowUp', 'KeyW')) this.index = (this.index + ITEMS.length - 1) % ITEMS.length;
    if (input.uiWasPressed('ArrowDown', 'KeyS')) this.index = (this.index + 1) % ITEMS.length;
    if (input.actionWasPressed('pause') || input.uiWasPressed('Escape')) return 'resume';
    if (input.confirmPressed()) return ITEMS[this.index].id;
    return null;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const pulse = this.reduced ? 1 : 0.5 + 0.5 * Math.sin(this.frame / 12);

    ctx.save();
    ctx.fillStyle = UI.scrim;
    ctx.fillRect(0, 0, w, h);

    const pw = 260;
    const rowH = 30;
    const ph = 78 + ITEMS.length * rowH;
    const px = (w - pw) / 2;
    const py = (h - ph) / 2;
    panel(ctx, px, py, pw, ph);

    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = UI.accent;
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', px + pw / 2, py + 30);
    ctx.textAlign = 'left';

    ITEMS.forEach((it, i) => {
      const y = py + 44 + i * rowH;
      if (this.index === i) selectionRow(ctx, px + 10, y, pw - 20, rowH - 6, pulse);
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = this.index === i ? UI.text : UI.textDim;
      ctx.fillText(it.label, px + 24, y + 17);
    });

    ctx.font = '9px monospace';
    ctx.fillStyle = UI.textFaint;
    ctx.textAlign = 'center';
    ctx.fillText('↑↓ SELECT  ·  ENTER CONFIRM  ·  ESC RESUME', px + pw / 2, py + ph - 14);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}
