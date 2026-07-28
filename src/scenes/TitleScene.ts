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
import { CutsceneScene } from './CutsceneScene.ts';
import { LevelScene } from './LevelScene.ts';

const MENU = [
  { id: 'start', label: 'START GAME', hint: `${LEVELS.length} ZONES` },
  { id: 'settings', label: 'SETTINGS', hint: 'REBIND CONTROLS' },
] as const;

/**
 * Composition: the key art (hero, sun, parallax) owns the right of the frame,
 * so all reading matter lives in one column on the left over a soft surface.
 */
const COL_X = 226;
const COL_W = 232;
const COL_LEFT = COL_X - COL_W / 2;
const LOGO_Y = 106;
const MENU_Y = 196;
const ROW_H = 30;
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

  constructor(game: Game, input: Input, sfx: Sfx) {
    this.game = game;
    this.input = input;
    this.sfx = sfx;
    this.bd = renderTitleBackdrop();
  }

  update(): void {
    this.frame++;

    if (this.settings) {
      if (this.settings.update(this.input) === 'close') this.settings = null;
      return;
    }

    const up = this.input.uiWasPressed('ArrowUp', 'KeyW');
    const down = this.input.uiWasPressed('ArrowDown', 'KeyS');
    if (up) this.index = (this.index + MENU.length - 1) % MENU.length;
    if (down) this.index = (this.index + 1) % MENU.length;
    if (up || down) {
      // A key press IS the user gesture WebAudio waits for, so the menu blip
      // can arm the synth — the game then has sound from the very first frame.
      this.sfx.ensure();
      this.sfx.play('ring');
    }

    if (this.input.confirmPressed()) {
      this.sfx.ensure();
      if (MENU[this.index].id === 'settings') {
        this.settings = new SettingsPanel();
        return;
      }
      // Into the story: the intro cutscene plays while the first level is
      // built behind the fade — no visible loading pause, ever.
      this.game.changeScene(
        () =>
          new CutsceneScene(
            this.game,
            this.input,
            this.sfx,
            LEVELS[0].intro,
            () => new LevelScene(this.game, this.input, this.sfx, 0),
          ),
      );
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawTitleBackdrop(ctx, this.bd, this.frame, this.reduced);
    drawTitleHero(ctx, HERO_X, TITLE_GROUND_Y, HERO_SCALE, this.frame, this.reduced);

    this.drawColumnSurface(ctx);
    drawTitleLogo(ctx, COL_X, LOGO_Y, this.frame, this.reduced);

    ctx.textAlign = 'center';
    ctx.font = '10px monospace';
    ctx.fillStyle = UI.textDim;
    ctx.fillText('DR. YOLK STOLE THE CHRONO CORE.', COL_X, 168);
    ctx.fillText(`${LEVELS.length} ZONES STAND BETWEEN YOU AND HIM.`, COL_X, 182);
    ctx.textAlign = 'left';

    this.drawMenu(ctx);

    ctx.textAlign = 'center';
    ctx.font = '9px monospace';
    ctx.fillStyle = UI.textFaint;
    ctx.fillText('↑↓ SELECT  ·  ENTER CONFIRM', COL_X, 268);
    ctx.textAlign = 'left';

    this.drawControlBar(ctx);

    if (this.settings) this.settings.render(ctx, this.input);
  }

  /**
   * The text column sits over moving art, so it gets a Material-ish surface:
   * a soft wash to kill the contrast underneath plus a low-elevation card.
   */
  private drawColumnSurface(ctx: CanvasRenderingContext2D): void {
    const wash = ctx.createRadialGradient(COL_X, 158, 40, COL_X, 158, 250);
    wash.addColorStop(0, 'rgba(5,7,15,0.72)');
    wash.addColorStop(0.6, 'rgba(5,7,15,0.42)');
    wash.addColorStop(1, 'rgba(5,7,15,0)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.beginPath();
    ctx.roundRect(COL_LEFT - 16, 52, COL_W + 32, 228, 12);
    ctx.fillStyle = 'rgba(16,18,28,0.28)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(75,225,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawMenu(ctx: CanvasRenderingContext2D): void {
    const pulse = this.reduced ? 1 : 0.5 + 0.5 * Math.sin(this.frame / 12);
    MENU.forEach((item, i) => {
      const y = MENU_Y + i * ROW_H;
      const selected = this.index === i;
      const h = ROW_H - 4;

      ctx.beginPath();
      ctx.roundRect(COL_LEFT, y, COL_W, h, 6);
      ctx.fillStyle = selected ? 'rgba(12,26,44,0.92)' : 'rgba(10,12,20,0.6)';
      ctx.fill();
      if (selected) {
        selectionRow(ctx, COL_LEFT, y, COL_W, h, pulse);
      } else {
        ctx.strokeStyle = UI.outline;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Leading caret, so the selection reads even without colour.
      ctx.fillStyle = selected ? UI.accent : UI.textFaint;
      ctx.beginPath();
      ctx.moveTo(COL_LEFT + 12, y + h / 2 - 4);
      ctx.lineTo(COL_LEFT + 17, y + h / 2);
      ctx.lineTo(COL_LEFT + 12, y + h / 2 + 4);
      ctx.closePath();
      ctx.fill();

      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = selected ? UI.text : UI.textDim;
      ctx.fillText(item.label, COL_LEFT + 24, y + 17);

      ctx.font = '9px monospace';
      ctx.fillStyle = selected ? UI.accent : UI.textFaint;
      ctx.textAlign = 'right';
      ctx.fillText(item.hint, COL_LEFT + COL_W - 12, y + 17);
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
