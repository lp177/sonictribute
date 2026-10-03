import type { Input } from '../core/Input.ts';
import { ACTIONS, keyLabel, type Action, type Slot } from '../core/bindings.ts';
import { VIEW_W, VIEW_H } from '../core/view.ts';
import { drawText } from '../render/font.ts';
import { drawPadButton } from './glyphs.ts';
import { UI, keycap, panel, promptRow, selectionBar, inRect, type Rect } from './theme.ts';

/** Extra rows below the action list. */
const ROW_RESET = ACTIONS.length;
const ROW_CLOSE = ACTIONS.length + 1;
const ROW_COUNT = ACTIONS.length + 2;

const PW = 470;
const PH = 300;
const PX = (VIEW_W - PW) / 2;
const PY = (VIEW_H - PH) / 2;
const TOP = PY + 50;
const ROW_H = 22;
const COL_X = [PX + PW - 196, PX + PW - 104];
const CHIP_W = 84;

/**
 * Keyboard remapping (Options > Controls). Arrows / pad move between rows
 * and the primary / alternate columns, confirm starts a capture, Backspace
 * clears a slot, back closes. The mouse can point and click any key slot.
 * Gamepad buttons are fixed (Sonic convention: every face button jumps) and
 * shown at the bottom so pad players know where everything is.
 *
 * Update returns 'close' when the panel is finished, otherwise null.
 */
export class SettingsPanel {
  row = 0;
  col: 0 | 1 = 0;
  private frame = 0;
  private age = 99;
  /** Row/slot currently waiting for a key press, or null. */
  private capturing: { action: Action; slot: Slot } | null = null;
  /** Transient message (e.g. a reserved key was refused). */
  private notice = '';
  private noticeFrames = 0;

  private rowRect(i: number): Rect {
    const y = i < ACTIONS.length ? TOP + i * ROW_H : TOP + ACTIONS.length * ROW_H + 8 + (i - ACTIONS.length) * ROW_H;
    return { x: PX + 12, y, w: PW - 24, h: ROW_H - 3 };
  }

  private chipRect(i: number, col: 0 | 1): Rect {
    const r = this.rowRect(i);
    return { x: COL_X[col], y: r.y, w: CHIP_W, h: r.h };
  }

  update(input: Input): 'close' | null {
    this.frame++;
    this.age++;
    if (this.noticeFrames > 0) this.noticeFrames--;

    // --- Waiting for a key to bind ---
    if (this.capturing) {
      // A pad has no keys to bind; its back button must still get out.
      if (input.isCapturing && input.menuBack() && input.lastDevice === 'gamepad') {
        input.cancelCapture();
        this.capturing = null;
        return null;
      }
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

    // Backspace clears a slot; it must be checked before "back" claims it.
    if (input.uiWasPressed('Backspace', 'Delete')) {
      if (this.row < ACTIONS.length) this.clearSlot(input);
      return null;
    }
    if (input.menuBack()) return 'close';

    const prev = this.row;
    if (input.menuUp()) this.row = (this.row + ROW_COUNT - 1) % ROW_COUNT;
    if (input.menuDown()) this.row = (this.row + 1) % ROW_COUNT;
    if (input.menuLeft()) this.col = 0;
    if (input.menuRight()) this.col = 1;

    // Pointer: hover picks the row (and the column under the cursor).
    const p = input.pointer;
    let clicked = false;
    if (p.visible) {
      for (let i = 0; i < ROW_COUNT; i++) {
        if (!inRect(this.rowRect(i), p.x, p.y)) continue;
        if (p.moved) {
          this.row = i;
          if (i < ACTIONS.length) {
            if (inRect(this.chipRect(i, 0), p.x, p.y)) this.col = 0;
            if (inRect(this.chipRect(i, 1), p.x, p.y)) this.col = 1;
          }
        }
        if (p.released && inRect(this.rowRect(i), p.pressX, p.pressY)) {
          this.row = i;
          clicked = true;
        }
      }
    }
    if (this.row !== prev) this.age = 0;

    if (input.menuConfirm() || clicked) {
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

  private clearSlot(input: Input): void {
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

  private flash(msg: string): void {
    this.notice = msg;
    this.noticeFrames = 150;
  }

  render(ctx: CanvasRenderingContext2D, input: Input): void {
    ctx.save();
    ctx.fillStyle = UI.scrim;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    panel(ctx, PX, PY, PW, PH);

    drawText(ctx, 'CONTROLS', PX + 20, PY + 28, { size: 13, fill: '#ffffff', outline: UI.ink, outlineWidth: 2 });
    drawText(ctx, 'KEYBOARD', PX + 20, PY + 41, { size: 6, fill: UI.accent });
    drawText(ctx, 'PRIMARY', COL_X[0] + CHIP_W / 2, PY + 41, { size: 6, fill: UI.textDim, align: 'center' });
    drawText(ctx, 'ALTERNATE', COL_X[1] + CHIP_W / 2, PY + 41, { size: 6, fill: UI.textDim, align: 'center' });

    ACTIONS.forEach((a, i) => {
      const r = this.rowRect(i);
      const selected = this.row === i;
      if (selected) selectionBar(ctx, r.x + 4, r.y, 150, r.h, this.age / 8);
      drawText(ctx, a.label, r.x + 12, r.y + r.h / 2 + 3.5, {
        size: 7,
        fill: selected ? UI.accentInk : UI.text,
        outline: selected ? undefined : UI.ink,
      });
      if (a.hint) drawText(ctx, a.hint.toUpperCase(), r.x + 12, r.y + r.h + 4, { size: 4.5, fill: UI.textFaint });

      const b = input.bindings.get(a.id);
      const capturingHere = this.capturing?.action === a.id;
      (['primary', 'secondary'] as const).forEach((slot, col) => {
        const code = b[slot];
        const cap = capturingHere && this.capturing?.slot === slot;
        const focused = selected && this.col === col;
        const cr = this.chipRect(i, col as 0 | 1);
        ctx.save();
        if (focused && !cap) {
          ctx.strokeStyle = UI.accent;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(cr.x - 3, cr.y - 1, cr.w + 6, cr.h + 2, 4);
          ctx.stroke();
        }
        ctx.restore();
        const label = cap ? (this.frame % 40 < 26 ? 'PRESS A KEY' : '') : keyLabel(code);
        const w = Math.min(CHIP_W, 18 + label.length * 5.5);
        keycap(ctx, cr.x + (CHIP_W - w) / 2, cr.y + cr.h / 2, label || ' ', 6.5, cap ? 'capture' : code ? (focused ? 'focus' : 'normal') : 'empty');
      });
    });

    // Reset / close rows.
    const actionRow = (i: number, label: string, color: string) => {
      const r = this.rowRect(i);
      const sel = this.row === i;
      if (sel) selectionBar(ctx, r.x + 4, r.y, 180, r.h, this.age / 8, color);
      drawText(ctx, label, r.x + 12, r.y + r.h / 2 + 3.5, { size: 7, fill: sel ? UI.accentInk : UI.text, outline: sel ? undefined : UI.ink });
    };
    actionRow(ROW_RESET, 'RESET TO DEFAULTS', UI.gold);
    actionRow(ROW_CLOSE, 'BACK', UI.accent);

    // Gamepad reference: fixed layout, shown so nobody has to guess.
    const gy = PY + PH - 44;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(PX + 12, gy - 12, PW - 24, 24);
    drawText(ctx, 'GAMEPAD', PX + 22, gy + 3, { size: 6, fill: UI.accent });
    let gx = PX + 78;
    const pad = (glyph: Parameters<typeof drawPadButton>[4], label: string) => {
      gx += drawPadButton(ctx, gx, gy, 13, glyph) + 4;
      gx += drawText(ctx, label, gx, gy + 3, { size: 6, fill: UI.textDim }) + 12;
    };
    pad('lstick', 'MOVE');
    pad('south', 'JUMP (ANY FACE BUTTON)');
    pad('dpad-down', 'ROLL');
    pad('start', 'PAUSE');

    if (this.noticeFrames > 0) {
      drawText(ctx, this.notice, VIEW_W / 2, PY + PH - 12, { size: 6.5, fill: UI.gold, outline: UI.ink, align: 'center' });
    } else if (this.capturing) {
      drawText(ctx, 'PRESS THE KEY TO BIND · ESC CANCELS', VIEW_W / 2, PY + PH - 12, { size: 6.5, fill: UI.accent, outline: UI.ink, align: 'center' });
    } else {
      promptRow(ctx, input, VIEW_W / 2, PY + PH - 14, [
        { action: 'confirm', label: 'REBIND' },
        { action: 'back', label: 'BACK' },
      ], 'center', 6);
      drawText(ctx, 'BKSP CLEARS', PX + PW - 16, PY + PH - 11, { size: 5, fill: UI.textFaint, align: 'right' });
    }
    ctx.restore();
  }
}
