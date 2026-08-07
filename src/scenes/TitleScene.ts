import type { Scene } from '../core/Game.ts';
import type { Game } from '../core/Game.ts';
import type { Input } from '../core/Input.ts';
import type { Sfx } from '../audio/sfx.ts';
import type { Action, Bindings } from '../core/bindings.ts';
import {
  drawTitleBackdrop,
  drawTitleHero,
  drawTitleLogo,
  renderTitleBackdrop,
  TITLE_GROUND_Y,
  type TitleBackdrop,
} from '../render/titleArt.ts';
import { prefersReducedMotion } from '../core/prefs.ts';
import { keyLabel } from '../core/bindings.ts';
import { SettingsPanel } from '../ui/SettingsPanel.ts';
import { UI, keyChip, selectionRow } from '../ui/theme.ts';
import { LEVELS } from '../levels/index.ts';
import { Progress } from '../game/progress.ts';
import { CutsceneScene } from './CutsceneScene.ts';
import { LevelScene } from './LevelScene.ts';
import { LevelSelectScene } from './LevelSelectScene.ts';
import { appUpdate, updateApplying, updateReady } from '../pwa/updateHandle.ts';

type MenuId = 'start' | 'levels' | 'settings' | 'update';
interface MenuItem {
  id: MenuId;
  label: string;
  hint: string;
}

const MENU: MenuItem[] = [
  { id: 'start', label: 'START GAME', hint: '' },
  { id: 'levels', label: 'LEVEL SELECT', hint: '' },
  { id: 'settings', label: 'SETTINGS', hint: 'REBIND CONTROLS' },
];

/**
 * Composition: the key art (hero, sun, parallax) owns the right of the frame,
 * so all reading matter lives in one column on the left over a soft surface.
 */
const COL_X = 226;
const COL_W = 232;
const COL_LEFT = COL_X - COL_W / 2;
const LOGO_Y = 106;
const MENU_Y = 190;
const ROW_H = 28;
/**
 * The update row is a fourth entry that only exists when a new build is
 * waiting, so the column shifts up to make room rather than colliding with the
 * control bar. Everything vertical derives from the live row count.
 */
const UPDATE_SHIFT = 14;
const HERO_X = 498;
const HERO_SCALE = 1.75;

/** Actions summarised in the bottom control bar, in reading order. */
const HINT_GROUPS: { actions: Action[]; label: string }[] = [
  { actions: ['left', 'right'], label: 'MOVE' },
  { actions: ['down'], label: 'ROLL' },
  { actions: ['jump'], label: 'JUMP' },
  { actions: ['pause'], label: 'PAUSE' },
];

export class TitleScene implements Scene {
  private bd: TitleBackdrop;
  private frame = 0;
  private game: Game;
  private input: Input;
  private sfx: Sfx;
  private index = 0;
  private settings: SettingsPanel | null = null;
  private reduced = prefersReducedMotion();
  private progress = Progress.load();

  constructor(game: Game, input: Input, sfx: Sfx) {
    this.game = game;
    this.input = input;
    this.sfx = sfx;
    this.bd = renderTitleBackdrop();
  }

  /** The live menu: the update row exists only while a build is waiting. */
  private menu(): MenuItem[] {
    if (!updateReady() && !updateApplying()) return MENU;
    return [
      ...MENU,
      {
        id: 'update',
        label: updateApplying() ? 'UPDATING…' : 'UPDATE GAME',
        hint: updateApplying() ? 'PLEASE WAIT' : 'NEW VERSION',
      },
    ];
  }

  update(): void {
    this.frame++;

    if (this.settings) {
      if (this.settings.update(this.input) === 'close') this.settings = null;
      return;
    }

    const menu = this.menu();
    // The row count can change mid-session when an update finishes downloading.
    if (this.index >= menu.length) this.index = menu.length - 1;

    const up = this.input.uiWasPressed('ArrowUp', 'KeyW');
    const down = this.input.uiWasPressed('ArrowDown', 'KeyS');
    if (up) this.index = (this.index + menu.length - 1) % menu.length;
    if (down) this.index = (this.index + 1) % menu.length;
    if (up || down) {
      // A key press IS the user gesture WebAudio waits for, so the menu blip
      // can arm the synth — the game then has sound from the very first frame.
      this.sfx.ensure();
      this.sfx.play('ring');
    }

    if (this.input.confirmPressed()) {
      this.sfx.ensure();
      const id = menu[this.index].id;
      if (id === 'update') {
        // Only offered here, never mid-act: applying reloads the page, and a
        // reload in a level would throw away the run.
        appUpdate()?.apply();
        return;
      }
      if (id === 'settings') {
        this.settings = new SettingsPanel();
        return;
      }
      if (id === 'levels') {
        this.game.changeScene(() => new LevelSelectScene(this.game, this.input, this.sfx));
        return;
      }
      // START continues the campaign from the first uncleared act. Its
      // biome-opening cutscene (when it has one) doubles as the loading
      // screen — no visible pause, ever.
      const at = this.progress.continueAt(LEVELS.length);
      const intro = at === 0 || LEVELS[at].biome !== LEVELS[at - 1].biome ? LEVELS[at].intro : undefined;
      this.game.changeScene(
        () =>
          intro
            ? new CutsceneScene(
                this.game,
                this.input,
                this.sfx,
                intro,
                () => new LevelScene(this.game, this.input, this.sfx, at),
              )
            : new LevelScene(this.game, this.input, this.sfx, at),
      );
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const menu = this.menu();
    // A fourth row would run into the control bar, so the whole column lifts.
    const shift = menu.length > MENU.length ? UPDATE_SHIFT : 0;

    drawTitleBackdrop(ctx, this.bd, this.frame, this.reduced);
    drawTitleHero(ctx, HERO_X, TITLE_GROUND_Y, HERO_SCALE, this.frame, this.reduced);

    this.drawColumnSurface(ctx, shift);
    drawTitleLogo(ctx, COL_X, LOGO_Y, this.frame, this.reduced);

    ctx.textAlign = 'center';
    ctx.font = '10px monospace';
    ctx.fillStyle = UI.textDim;
    ctx.fillText('DR. YOLK STOLE THE CHRONO CORE.', COL_X, 168 - shift);
    ctx.fillText(`${LEVELS.length} ZONES STAND BETWEEN YOU AND HIM.`, COL_X, 182 - shift);
    ctx.textAlign = 'left';

    this.drawMenu(ctx, menu, shift);

    ctx.textAlign = 'center';
    ctx.font = '9px monospace';
    ctx.fillStyle = UI.textFaint;
    // Below the last menu row (the hint sat at the 2-row-menu height and
    // overlapped SETTINGS once LEVEL SELECT joined the list).
    ctx.fillText('↑↓ SELECT  ·  ENTER CONFIRM', COL_X, MENU_Y - shift + menu.length * ROW_H + 14);
    ctx.textAlign = 'left';

    this.drawControlBar(ctx);

    if (this.settings) this.settings.render(ctx, this.input);
  }

  /**
   * The text column sits over moving art, so it gets a Material-ish surface:
   * a soft wash to kill the contrast underneath plus a low-elevation card.
   */
  private drawColumnSurface(ctx: CanvasRenderingContext2D, shift: number): void {
    const wash = ctx.createRadialGradient(COL_X, 158, 40, COL_X, 158, 250);
    wash.addColorStop(0, 'rgba(5,7,15,0.72)');
    wash.addColorStop(0.6, 'rgba(5,7,15,0.42)');
    wash.addColorStop(1, 'rgba(5,7,15,0)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.beginPath();
    // Grows downward by the same amount the rows lift, so the extra row stays
    // on the card instead of hanging off its bottom edge.
    ctx.roundRect(COL_LEFT - 16, 52 - shift, COL_W + 32, 228 + shift * 2, 12);
    ctx.fillStyle = 'rgba(16,18,28,0.28)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(75,225,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawMenu(ctx: CanvasRenderingContext2D, menu: MenuItem[], shift: number): void {
    const pulse = this.reduced ? 1 : 0.5 + 0.5 * Math.sin(this.frame / 12);
    menu.forEach((item, i) => {
      const y = MENU_Y - shift + i * ROW_H;
      const selected = this.index === i;
      const h = ROW_H - 4;
      // The update row earns a warm accent: it is the one entry that appeared
      // on its own rather than always being there.
      const flag = item.id === 'update';

      ctx.beginPath();
      ctx.roundRect(COL_LEFT, y, COL_W, h, 6);
      ctx.fillStyle = selected ? 'rgba(12,26,44,0.92)' : 'rgba(10,12,20,0.6)';
      ctx.fill();
      if (selected) {
        selectionRow(ctx, COL_LEFT, y, COL_W, h, pulse);
      } else {
        ctx.strokeStyle = flag ? UI.warn : UI.outline;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Leading caret, so the selection reads even without colour.
      ctx.fillStyle = selected ? UI.accent : flag ? UI.warn : UI.textFaint;
      ctx.beginPath();
      ctx.moveTo(COL_LEFT + 12, y + h / 2 - 4);
      ctx.lineTo(COL_LEFT + 17, y + h / 2);
      ctx.lineTo(COL_LEFT + 12, y + h / 2 + 4);
      ctx.closePath();
      ctx.fill();

      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = selected ? UI.text : flag ? UI.warn : UI.textDim;
      ctx.fillText(item.label, COL_LEFT + 24, y + 17);

      ctx.font = '9px monospace';
      ctx.fillStyle = selected ? UI.accent : flag ? UI.warn : UI.textFaint;
      ctx.textAlign = 'right';
      const hint =
        item.id === 'start'
          ? `ACT ${this.progress.continueAt(LEVELS.length) + 1}/${LEVELS.length}`
          : item.id === 'levels'
            ? `${this.progress.clearedCount()}/${LEVELS.length} CLEARED`
            : item.hint;
      ctx.fillText(hint, COL_LEFT + COL_W - 12, y + 17);
      ctx.textAlign = 'left';
    });
  }

  /**
   * Bottom bar: the live primary bindings as key caps, plus the line telling
   * the player they are all remappable. Read straight from `input.bindings`,
   * so it never lies after a rebind.
   */
  private drawControlBar(ctx: CanvasRenderingContext2D): void {
    const w = ctx.canvas.width;
    const b = this.input.bindings;
    const y = 312;

    ctx.fillStyle = 'rgba(75,225,255,0.10)';
    ctx.fillRect(40, 300, w - 80, 1);

    const groups = HINT_GROUPS.map((g) => {
      const caps = g.actions.map((a) => primaryLabel(b, a));
      ctx.font = 'bold 11px monospace';
      const capW = caps.map((c) => Math.max(26, Math.ceil(ctx.measureText(c).width) + 14));
      ctx.font = '9px monospace';
      const labelW = ctx.measureText(g.label).width;
      const width = capW.reduce((a, c) => a + c, 0) + 4 * (caps.length - 1) + 7 + labelW;
      return { caps, capW, label: g.label, labelW, width };
    });
    const total = groups.reduce((a, g) => a + g.width, 0) + 18 * (groups.length - 1);

    let x = (w - total) / 2;
    for (const g of groups) {
      g.caps.forEach((cap, i) => {
        keyChip(ctx, x, y, g.capW[i], cap, 'normal');
        x += g.capW[i] + 4;
      });
      x += 3; // the trailing chip gap becomes the label gap
      ctx.font = '9px monospace';
      ctx.fillStyle = UI.textDim;
      ctx.fillText(g.label, x, y + 14);
      x += g.labelW + 18;
    }

    // Rebinding is invisible unless it is advertised — and the word that
    // matters is highlighted so it maps onto the menu entry above.
    const pre = 'ALL CONTROLS CAN BE REBOUND IN ';
    const hot = 'SETTINGS';
    ctx.font = '9px monospace';
    let hx = (w - ctx.measureText(pre + hot).width) / 2;
    ctx.fillStyle = UI.textFaint;
    ctx.fillText(pre, hx, 342);
    hx += ctx.measureText(pre).width;
    ctx.fillStyle = UI.accent;
    ctx.fillText(hot, hx, 342);
  }
}

function primaryLabel(b: Bindings, action: Action): string {
  return keyLabel(b.get(action).primary);
}
