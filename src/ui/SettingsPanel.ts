import type { Input } from '../core/Input.ts';
import { ACTIONS, keyLabel, type Action, type Slot } from '../core/bindings.ts';
import { prefersReducedMotion } from '../core/prefs.ts';
import { UI, panel, selectionRow, keyChip } from './theme.ts';

/** Extra rows below the action list. */
const ROW_RESET = ACTIONS.length;
const ROW_CLOSE = ACTIONS.length + 1;
const ROW_COUNT = ACTIONS.length + 2;

/**
 * Key-remapping panel, shared by the title screen and the pause menu. Purely
 * keyboard-driven: arrows move between rows and the primary/secondary
 * columns, Enter starts a capture, Backspace clears a slot, Escape closes.
 *
 * Update returns 'close' when the panel is finished, otherwise null.
 */
export class SettingsPanel {
  row = 0;
  col: 0 | 1 = 0;
  private frame = 0;
  /** Row/slot currently waiting for a key press, or null. */
  private capturing: { action: Action; slot: Slot } | null = null;
  /** Transient message (e.g. a reserved key was refused). */
  private notice = '';
  private noticeFrames = 0;
  private reduced = prefersReducedMotion();

  update(input: Input): 'close' | null {
    this.frame++;
    if (this.noticeFrames > 0) this.noticeFrames--;

    // --- Waiting for a key to bind ---
    if (this.capturing) {
      const code = input.takeCaptured();
      if (!code) return null;
      const { action, slot } = this.capturing;
      this.capturing = null;
      if (code === 'Escape') return null; // Escape always cancels a capture
      if (!input.bindings.set(action, slot, code)) {
        this.flash(`${keyLabel(code)} IS RESERVED FOR MENUS`);
        return null;
      }
      input.bindings.save();
      return null;
    }

    if (input.uiWasPressed('Escape')) return 'close';

    if (input.uiWasPressed('ArrowUp', 'KeyW')) this.row = (this.row + ROW_COUNT - 1) % ROW_COUNT;
    if (input.uiWasPressed('ArrowDown', 'KeyS')) this.row = (this.row + 1) % ROW_COUNT;
    if (input.uiWasPressed('ArrowLeft', 'KeyA')) this.col = 0;
    if (input.uiWasPressed('ArrowRight', 'KeyD')) this.col = 1;

    if (input.uiWasPressed('Backspace', 'Delete') && this.row < ACTIONS.length) {
      const action = ACTIONS[this.row].id;
      const slot: Slot = this.col === 0 ? 'primary' : 'secondary';
      const bound = input.bindings.get(action);
      // Refuse to strip an action's last key — it would be untriggerable.
      if (slot === 'primary' && !bound.secondary) {
        this.flash('EACH ACTION NEEDS AT LEAST ONE KEY');
      } else {
        input.bindings.clear(action, slot);
        input.bindings.save();
      }
    }

    if (input.uiWasPressed('Enter')) {
      if (this.row === ROW_CLOSE) return 'close';
      if (this.row === ROW_RESET) {
        input.bindings.reset();
        input.bindings.save();
        this.flash('DEFAULTS RESTORED');
      } else {
        this.capturing = {
          action: ACTIONS[this.row].id,
          slot: this.col === 0 ? 'primary' : 'secondary',
        };
        input.beginCapture();
      }
    }
    return null;
  }

  private flash(msg: string): void {
    this.notice = msg;
    this.noticeFrames = 150;
  }

  render(ctx: CanvasRenderingContext2D, input: Input): void {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const pulse = this.reduced ? 1 : 0.5 + 0.5 * Math.sin(this.frame / 12);

    ctx.save();
    ctx.fillStyle = UI.scrim;
    ctx.fillRect(0, 0, w, h);

    const pw = 460;
    const ph = 300;
    const px = (w - pw) / 2;
    const py = (h - ph) / 2;
    panel(ctx, px, py, pw, ph);

    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = UI.accent;
    ctx.fillText('SETTINGS — CONTROLS', px + 20, py + 30);
    ctx.font = '10px monospace';
    ctx.fillStyle = UI.textDim;
    ctx.textAlign = 'right';
    ctx.fillText('PRIMARY', px + pw - 104, py + 30);
    ctx.fillText('ALTERNATE', px + pw - 20, py + 30);
    ctx.textAlign = 'left';

    // Action rows.
    const rowH = 26;
    const top = py + 42;
    ACTIONS.forEach((a, i) => {
      const y = top + i * rowH;
      const selected = this.row === i;
      if (selected) selectionRow(ctx, px + 10, y, pw - 20, rowH - 4, pulse);

      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = selected ? UI.text : UI.textDim;
      ctx.fillText(a.label, px + 22, y + 15);
      if (a.hint) {
        ctx.font = '9px monospace';
        ctx.fillStyle = UI.textFaint;
        ctx.fillText(a.hint, px + 22 + ctx.measureText(a.label).width + 44, y + 15);
      }

      const b = input.bindings.get(a.id);
      const capturingHere = this.capturing?.action === a.id;
      const chip = (slot: Slot, cx: number, col: 0 | 1) => {
        const code = b[slot];
        const isCapturing = capturingHere && this.capturing?.slot === slot;
        const focused = selected && this.col === col;
        keyChip(
          ctx,
          cx,
          y + 1,
          78,
          isCapturing ? 'PRESS KEY' : keyLabel(code),
          isCapturing ? 'capturing' : focused ? 'focus' : code ? 'normal' : 'empty',
        );
      };
      chip('primary', px + pw - 182, 0);
      chip('secondary', px + pw - 98, 1);
    });

    // Reset / close rows.
    const resetY = top + ACTIONS.length * rowH + 6;
    const closeY = resetY + rowH;
    const actionRow = (y: number, label: string, index: number, color: string) => {
      if (this.row === index) selectionRow(ctx, px + 10, y, pw - 20, rowH - 4, pulse);
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = this.row === index ? color : UI.textDim;
      ctx.fillText(label, px + 22, y + 15);
    };
    actionRow(resetY, 'RESET TO DEFAULTS', ROW_RESET, UI.warn);
    actionRow(closeY, 'BACK', ROW_CLOSE, UI.accent);

    // Footer: notice, else the key hints.
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    if (this.noticeFrames > 0) {
      ctx.fillStyle = UI.warn;
      ctx.fillText(this.notice, px + pw / 2, py + ph - 12);
    } else {
      ctx.fillStyle = UI.textFaint;
      ctx.fillText(
        this.capturing
          ? 'PRESS A KEY TO BIND  ·  ESC CANCELS'
          : '↑↓ ROW  ·  ←→ COLUMN  ·  ENTER REBIND  ·  BKSP CLEAR  ·  ESC BACK',
        px + pw / 2,
        py + ph - 12,
      );
    }
    ctx.textAlign = 'left';
    ctx.restore();
  }
}
