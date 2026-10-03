import type { Input } from '../core/Input.ts';
import type { Sfx } from '../audio/sfx.ts';
import { VIEW_W, VIEW_H } from '../core/view.ts';
import { settings, updateSettings, type GameSettings, type TouchMode } from '../core/settings.ts';
import { drawText } from '../render/font.ts';
import { SettingsPanel } from './SettingsPanel.ts';
import { UI, ListNav, panel, promptRow, selectionBar, slantPath, type Rect } from './theme.ts';

type RowId = 'music' | 'sfx' | 'shake' | 'flash' | 'crt' | 'touch' | 'timer' | 'fullscreen' | 'controls' | 'back';

interface Row {
  id: RowId;
  label: string;
  help: string;
}

const ROWS: Row[] = [
  { id: 'music', label: 'MUSIC VOLUME', help: 'Soundtrack level.' },
  { id: 'sfx', label: 'EFFECTS VOLUME', help: 'Rings, jumps, impacts and menus.' },
  { id: 'shake', label: 'SCREEN SHAKE', help: 'Camera shake on impacts. Off if motion makes you uncomfortable.' },
  { id: 'flash', label: 'FLASH EFFECTS', help: 'Full-screen flashes on big hits. Turn off for photosensitivity.' },
  { id: 'crt', label: 'CRT FILTER', help: 'A light vintage glaze: scanlines, phosphor grille and a soft vignette.' },
  { id: 'touch', label: 'TOUCH CONTROLS', help: 'On-screen stick and jump. AUTO shows them when you touch the screen.' },
  { id: 'timer', label: 'TIMER', help: 'PRECISE shows hundredths for speedruns.' },
  { id: 'fullscreen', label: 'FULLSCREEN', help: 'Fill the whole screen. Esc or F11 to leave.' },
  { id: 'controls', label: 'CONTROLS  ▶', help: 'Rebind keyboard keys. Gamepad layout reference.' },
  { id: 'back', label: 'BACK', help: '' },
];

const PW = 440;
const PH = 312;
const PX = (VIEW_W - PW) / 2;
const PY = (VIEW_H - PH) / 2;
const TOP = PY + 44;
const ROW_H = 22;
const VALUE_X = PX + PW - 150;

const TOUCH_MODES: TouchMode[] = ['auto', 'on', 'off'];

/**
 * Options: audio mix, comfort and display, plus the way into key remapping.
 * Left/right (or click) changes a value, so every row is adjustable without
 * a sub-screen; the help line under the panel says what the focused option
 * actually does — "FLASH EFFECTS" means nothing until you know it is about
 * photosensitivity. Changes apply and persist immediately.
 */
export class OptionsMenu {
  private nav = new ListNav();
  private controls: SettingsPanel | null = null;
  private sfx: Sfx | null;

  constructor(sfx: Sfx | null = null) {
    this.sfx = sfx;
  }

  private rows(): Rect[] {
    return ROWS.map((_, i) => ({ x: PX + 12, y: this.rowY(i), w: PW - 24, h: ROW_H - 3 }));
  }

  private rowY(i: number): number {
    return TOP + i * ROW_H + (ROWS[i].id === 'controls' || ROWS[i].id === 'back' ? 8 : 0);
  }

  update(input: Input): 'close' | null {
    if (this.controls) {
      if (this.controls.update(input) === 'close') this.controls = null;
      return null;
    }
    const r = this.nav.update(input, ROWS.length, this.rows());
    const row = ROWS[this.nav.index];
    if (r === 'move') this.sfx?.play('ui-move');
    if (r === 'back') {
      this.sfx?.play('ui-back');
      return 'close';
    }
    if (r === 'left' || r === 'right') this.adjust(row.id, r === 'left' ? -1 : 1);
    if (r === 'confirm') {
      if (row.id === 'back') {
        this.sfx?.play('ui-back');
        return 'close';
      }
      if (row.id === 'controls') {
        this.sfx?.play('ui-confirm');
        this.controls = new SettingsPanel();
        return null;
      }
      // Clicking a value steps it forward (volumes wrap 100% -> 0%).
      this.adjust(row.id, 1, true);
    }
    return null;
  }

  private adjust(id: RowId, dir: -1 | 1, wrap = false): void {
    const s = settings();
    const vol = (v: number) => {
      let n = Math.round((v + dir * 0.1) * 10) / 10;
      if (wrap && n > 1) n = 0;
      return Math.max(0, Math.min(1, n));
    };
    const patch: Partial<GameSettings> = {};
    switch (id) {
      case 'music':
        patch.musicVolume = vol(s.musicVolume);
        break;
      case 'sfx':
        patch.sfxVolume = vol(s.sfxVolume);
        break;
      case 'shake':
        patch.screenShake = !s.screenShake;
        break;
      case 'flash':
        patch.flashes = !s.flashes;
        break;
      case 'crt':
        patch.crt = !s.crt;
        break;
      case 'touch': {
        const i = TOUCH_MODES.indexOf(s.touch);
        patch.touch = TOUCH_MODES[(i + dir + TOUCH_MODES.length) % TOUCH_MODES.length];
        break;
      }
      case 'timer':
        patch.preciseTimer = !s.preciseTimer;
        break;
      case 'fullscreen':
        toggleFullscreen();
        this.sfx?.play('ui-confirm');
        return;
      default:
        return;
    }
    updateSettings(patch);
    // Let the player hear the level they just set.
    this.sfx?.play(id === 'sfx' ? 'ring' : 'ui-move');
  }

  private value(id: RowId): { text?: string; bar?: number } {
    const s = settings();
    switch (id) {
      case 'music':
        return { bar: s.musicVolume };
      case 'sfx':
        return { bar: s.sfxVolume };
      case 'shake':
        return { text: s.screenShake ? 'ON' : 'OFF' };
      case 'flash':
        return { text: s.flashes ? 'ON' : 'OFF' };
      case 'crt':
        return { text: s.crt ? 'ON' : 'OFF' };
      case 'touch':
        return { text: s.touch.toUpperCase() };
      case 'timer':
        return { text: s.preciseTimer ? 'PRECISE' : 'SIMPLE' };
      case 'fullscreen':
        return { text: isFullscreen() ? 'ON' : 'OFF' };
      default:
        return {};
    }
  }

  render(ctx: CanvasRenderingContext2D, input: Input): void {
    if (this.controls) {
      this.controls.render(ctx, input);
      return;
    }
    ctx.save();
    ctx.fillStyle = UI.scrim;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    panel(ctx, PX, PY, PW, PH);
    drawText(ctx, 'OPTIONS', PX + 20, PY + 28, { size: 13, fill: '#ffffff', outline: UI.ink, outlineWidth: 2 });

    ROWS.forEach((row, i) => {
      const y = this.rowY(i);
      const sel = this.nav.index === i;
      if (sel) selectionBar(ctx, PX + 16, y, 190, ROW_H - 3, this.nav.age / 8);
      drawText(ctx, row.label, PX + 28 + (sel ? 4 : 0), y + 12.5, {
        size: 7.5,
        fill: sel ? UI.accentInk : UI.text,
        outline: sel ? undefined : UI.ink,
      });
      const v = this.value(row.id);
      if (v.bar !== undefined) {
        // Ten slanted pips: a volume you can read at a glance.
        for (let k = 0; k < 10; k++) {
          ctx.fillStyle = k < Math.round(v.bar * 10) ? (sel ? UI.accent : UI.text) : 'rgba(255,255,255,0.12)';
          slantPath(ctx, VALUE_X + k * 11, y + 4, 8, 11);
          ctx.fill();
        }
        drawText(ctx, `${Math.round(v.bar * 100)}%`, PX + PW - 20, y + 12.5, { size: 6.5, fill: UI.textDim, align: 'right' });
      } else if (v.text) {
        if (sel) {
          drawText(ctx, '◀', VALUE_X, y + 12, { size: 5.5, fill: UI.accent });
          drawText(ctx, '▶', VALUE_X + 100, y + 12, { size: 5.5, fill: UI.accent });
        }
        drawText(ctx, v.text, VALUE_X + 54, y + 12.5, { size: 7.5, fill: sel ? '#ffffff' : UI.textDim, outline: UI.ink, align: 'center' });
      }
    });

    const help = ROWS[this.nav.index].help;
    if (help) {
      ctx.font = '600 9px "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
      ctx.fillStyle = UI.textDim;
      ctx.textAlign = 'center';
      ctx.fillText(help, VIEW_W / 2, PY + PH - 26);
      ctx.textAlign = 'left';
    }
    promptRow(ctx, input, VIEW_W / 2, PY + PH - 10, [
      { action: 'move', label: 'CHANGE' },
      { action: 'back', label: 'BACK' },
    ], 'center', 6);
    ctx.restore();
  }
}

function isFullscreen(): boolean {
  return typeof document !== 'undefined' && !!document.fullscreenElement;
}

/** Fullscreen needs the user activation the key/click that got us here grants. */
export function toggleFullscreen(): void {
  if (typeof document === 'undefined') return;
  if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
  else void document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
}
