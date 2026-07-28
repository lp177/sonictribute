import type { Scene } from '../core/Game.ts';
import type { Game } from '../core/Game.ts';
import type { Input } from '../core/Input.ts';
import type { Sfx } from '../audio/sfx.ts';
import { renderBackground } from '../render/painter.ts';
import { LevelScene } from './LevelScene.ts';

export class TitleScene implements Scene {
  private bg: HTMLCanvasElement;
  private frame = 0;
  private game: Game;
  private input: Input;
  private sfx: Sfx;

  constructor(game: Game, input: Input, sfx: Sfx) {
    this.game = game;
    this.input = input;
    this.sfx = sfx;
    this.bg = renderBackground(640, 360);
  }

  update(): void {
    this.frame++;
    if (this.input.uiWasPressed('Enter', 'Space', 'KeyZ')) {
      this.sfx.ensure();
      // The next scene (terrain pre-render, level build) is constructed
      // behind the fade — no visible loading pause.
      this.game.changeScene(new LevelScene(this.game, this.input, this.sfx));
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.drawImage(this.bg, 0, 0);
    const w = ctx.canvas.width;

    // Silhouette hero dashing across the bottom.
    const hx = ((this.frame * 4) % (w + 120)) - 60;
    ctx.fillStyle = 'rgba(47,125,246,0.85)';
    ctx.beginPath();
    ctx.arc(hx, 320, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#2f7df6';
    ctx.font = 'bold 52px monospace';
    ctx.fillText('BOLT', w / 2, 110);
    ctx.fillStyle = '#4be1ff';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('— CHRONO RUSH —', w / 2, 142);

    ctx.fillStyle = '#9aa3b2';
    ctx.font = '12px monospace';
    ctx.fillText('Dr. Yolk has stolen the five Chrono Crystals!', w / 2, 190);
    ctx.fillText('Race through Verdant Rush and take them back.', w / 2, 208);

    ctx.fillStyle = '#6b7280';
    ctx.font = '10px monospace';
    ctx.fillText('ARROWS / WASD — move · DOWN — roll · SPACE — jump', w / 2, 240);
    ctx.fillText('DOWN + SPACE — spin dash', w / 2, 256);

    if (this.frame % 60 < 40) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('PRESS ENTER', w / 2, 300);
    }
    ctx.textAlign = 'left';
  }
}
