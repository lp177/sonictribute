import type { Scene } from '../core/Game.ts';
import type { Game } from '../core/Game.ts';
import type { Input } from '../core/Input.ts';
import type { Sfx } from '../audio/sfx.ts';
import { renderBackground } from '../render/painter.ts';
import { prefersReducedMotion } from '../core/prefs.ts';
import { keyLabel } from '../core/bindings.ts';
import { SettingsPanel } from '../ui/SettingsPanel.ts';
import { UI, selectionRow } from '../ui/theme.ts';
import { LEVELS } from '../levels/index.ts';
import { CutsceneScene } from './CutsceneScene.ts';
import { LevelScene } from './LevelScene.ts';

const MENU = [
  { id: 'start', label: 'START GAME' },
  { id: 'settings', label: 'SETTINGS' },
] as const;

export class TitleScene implements Scene {
  private bg: HTMLCanvasElement;
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
    this.bg = renderBackground(640, 360);
  }

  update(): void {
    this.frame++;

    if (this.settings) {
      if (this.settings.update(this.input) === 'close') this.settings = null;
      return;
    }

    if (this.input.uiWasPressed('ArrowUp', 'KeyW')) this.index = (this.index + MENU.length - 1) % MENU.length;
    if (this.input.uiWasPressed('ArrowDown', 'KeyS')) this.index = (this.index + 1) % MENU.length;

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
    ctx.drawImage(this.bg, 0, 0);
    const w = ctx.canvas.width;

    // Silhouette hero dashing across the bottom.
    const hx = ((this.frame * 4) % (w + 120)) - 60;
    ctx.fillStyle = 'rgba(47,125,246,0.85)';
    ctx.beginPath();
    ctx.arc(hx, 336, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#2f7df6';
    ctx.font = 'bold 52px monospace';
    ctx.fillText('BOLT', w / 2, 96);
    ctx.fillStyle = '#4be1ff';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('— CHRONO RUSH —', w / 2, 128);

    ctx.fillStyle = UI.textDim;
    ctx.font = '12px monospace';
    ctx.fillText('Dr. Yolk has stolen the Chrono Core — time is stuttering!', w / 2, 168);
    ctx.fillText('Chase him through two zones and take it back.', w / 2, 186);
    ctx.textAlign = 'left';

    // Menu.
    const pulse = this.reduced ? 1 : 0.5 + 0.5 * Math.sin(this.frame / 12);
    MENU.forEach((item, i) => {
      const y = 214 + i * 32;
      if (this.index === i) selectionRow(ctx, w / 2 - 110, y, 220, 26, pulse);
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = this.index === i ? UI.text : UI.textDim;
      ctx.textAlign = 'center';
      ctx.fillText(item.label, w / 2, y + 18);
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = UI.textFaint;
    ctx.font = '10px monospace';
    ctx.fillText('↑↓ SELECT  ·  ENTER CONFIRM', w / 2, 300);
    const b = this.input.bindings;
    ctx.fillText(
      `IN GAME — ${keyList(b.codes('left'))}/${keyList(b.codes('right'))} MOVE · ` +
        `${keyList(b.codes('down'))} ROLL · ${keyList(b.codes('jump'))} JUMP · ` +
        `${keyList(b.codes('pause'))} PAUSE`,
      w / 2,
      318,
    );
    ctx.textAlign = 'left';

    if (this.settings) this.settings.render(ctx, this.input);
  }
}

function keyList(codes: string[]): string {
  return codes.map(keyLabel).join('/') || '—';
}
