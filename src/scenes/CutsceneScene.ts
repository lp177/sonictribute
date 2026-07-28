import type { Scene } from '../core/Game.ts';
import type { Game } from '../core/Game.ts';
import type { Input } from '../core/Input.ts';
import type { Sfx } from '../audio/sfx.ts';
import type { Cutscene } from '../game/story.ts';
import { PAL } from '../render/painter.ts';

const W = 640;
const H = 360;
/** Frames before a fully-typed line advances on its own (keeps the pace up). */
const LINE_FRAMES = 200;
/** Frames per typed character. */
const TYPE_SPEED = 2;

/**
 * Story beat between levels. Skippable (Enter finishes the line, then
 * advances); when the last line ends we hand over to the next scene, which is
 * constructed behind the fade — the cutscene IS the loading screen.
 */
export class CutsceneScene implements Scene {
  private frame = 0;
  private line = 0;
  private lineFrame = 0;
  private done = false;
  private game: Game;
  private input: Input;
  private sfx: Sfx;
  private story: Cutscene;
  private next: () => Scene;

  constructor(game: Game, input: Input, sfx: Sfx, story: Cutscene, next: () => Scene) {
    this.game = game;
    this.input = input;
    this.sfx = sfx;
    this.story = story;
    this.next = next;
  }

  update(): void {
    this.frame++;
    this.lineFrame++;
    if (this.done) return;
    const advance = this.input.confirmPressed();
    const text = this.story.lines[this.line];
    const fullyTyped = Math.floor(this.lineFrame / TYPE_SPEED) >= text.length;
    if (advance && !fullyTyped) {
      this.lineFrame = text.length * TYPE_SPEED; // first press: reveal the line
      return;
    }
    if (advance || this.lineFrame > LINE_FRAMES) {
      if (advance) this.sfx.ensure();
      if (this.line + 1 < this.story.lines.length) {
        this.line++;
        this.lineFrame = 0;
        this.sfx.play('ring');
      } else {
        this.done = true;
        this.game.changeScene(this.next); // built behind the fade
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Letterboxed night backdrop.
    ctx.fillStyle = '#0a0a0e';
    ctx.fillRect(0, 0, W, H);
    const sky = ctx.createLinearGradient(0, 40, 0, 250);
    sky.addColorStop(0, PAL.skyTop);
    sky.addColorStop(1, '#141426');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 40, W, 210);
    ctx.fillStyle = '#0a0a0e';
    ctx.fillRect(0, 0, W, 40);
    ctx.fillRect(0, 250, W, H - 250);

    switch (this.story.art) {
      case 'steal':
        this.drawSteal(ctx);
        break;
      case 'chase':
        this.drawChase(ctx);
        break;
      case 'ending':
        this.drawEnding(ctx);
        break;
    }

    // Typed story lines.
    ctx.textAlign = 'center';
    ctx.font = '12px monospace';
    for (let i = 0; i <= this.line; i++) {
      const text = this.story.lines[i];
      const shown = i < this.line ? text : text.slice(0, Math.floor(this.lineFrame / TYPE_SPEED));
      ctx.fillStyle = i < this.line ? '#6b7280' : '#e5e9f0';
      ctx.fillText(shown, W / 2, 272 + i * 16);
    }
    if (this.frame % 60 < 40) {
      ctx.fillStyle = '#9aa3b2';
      ctx.font = '10px monospace';
      ctx.fillText('ENTER — next', W / 2, H - 8);
    }
    ctx.textAlign = 'left';
  }

  /* --------------------------- Procedural vignettes -------------------------- */

  private drawSteal(ctx: CanvasRenderingContext2D): void {
    const t = this.frame;
    // Shrine floor and pedestal.
    ctx.fillStyle = '#16283f';
    ctx.fillRect(80, 220, 480, 30);
    ctx.fillStyle = '#2a3b55';
    ctx.fillRect(300, 180, 40, 40);
    ctx.fillRect(290, 175, 60, 8);
    // Yolk's pod descending, tractor beam on the Core.
    const podY = 80 + Math.sin(t / 40) * 4;
    ctx.fillStyle = 'rgba(255,220,120,0.15)';
    ctx.beginPath();
    ctx.moveTo(320 - 26, podY + 14);
    ctx.lineTo(320 + 26, podY + 14);
    ctx.lineTo(320 + 10, 185);
    ctx.lineTo(320 - 10, 185);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAL.pod;
    ctx.beginPath();
    ctx.roundRect(320 - 20, podY - 12, 40, 24, 10);
    ctx.fill();
    ctx.fillStyle = PAL.yolk;
    ctx.beginPath();
    ctx.roundRect(320 - 12, podY - 20, 24, 12, 6);
    ctx.fill();
    // The Chrono Core, lifted out of the pedestal.
    const coreY = 172 - Math.min(60, t / 3);
    const glow = ctx.createRadialGradient(320, coreY, 2, 320, coreY, 26);
    glow.addColorStop(0, 'rgba(255,170,60,0.9)');
    glow.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(294, coreY - 26, 52, 52);
    ctx.fillStyle = '#ffbe50';
    ctx.beginPath();
    ctx.arc(320, coreY, 8, 0, Math.PI * 2);
    ctx.fill();
    // Crystals scattering outward.
    ctx.fillStyle = PAL.crystal;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI - Math.PI * 0.05;
      const d = 30 + Math.min(160, t * 1.2) + i * 8;
      const cx = 320 + Math.cos(a + Math.PI) * d;
      const cy = 180 - Math.sin(a) * d * 0.5;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t / 20 + i);
      ctx.fillRect(-3, -5, 6, 10);
      ctx.restore();
    }
  }

  private drawChase(ctx: CanvasRenderingContext2D): void {
    const t = this.frame;
    // Scrolling cloud strips.
    ctx.fillStyle = 'rgba(200,214,235,0.12)';
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 210 - t * (1.5 + i * 0.4)) % (W + 160)) + 80;
      ctx.beginPath();
      ctx.ellipse(cx < -80 ? cx + W + 160 : cx, 90 + i * 38, 60, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Yolk's pod fleeing up-right with the Core.
    const px = 400 + Math.sin(t / 50) * 10;
    const py = 110 - Math.sin(t / 70) * 8;
    ctx.fillStyle = PAL.pod;
    ctx.beginPath();
    ctx.roundRect(px - 20, py - 12, 40, 24, 10);
    ctx.fill();
    ctx.fillStyle = PAL.yolk;
    ctx.beginPath();
    ctx.roundRect(px - 12, py - 20, 24, 12, 6);
    ctx.fill();
    ctx.fillStyle = '#ffbe50';
    ctx.beginPath();
    ctx.arc(px, py + 20, 6, 0, Math.PI * 2);
    ctx.fill();
    // Exhaust puffs.
    ctx.fillStyle = 'rgba(150,150,160,0.4)';
    for (let i = 0; i < 3; i++) {
      const ex = px - 30 - i * 16 - (t % 16);
      ctx.beginPath();
      ctx.arc(ex, py + 6 + i * 3, 5 - i, 0, Math.PI * 2);
      ctx.fill();
    }
    // BOLT sprinting after him along the ridge.
    const bx = 150 + Math.sin(t / 30) * 12;
    ctx.fillStyle = '#16283f';
    ctx.fillRect(0, 210, W, 40);
    ctx.fillStyle = PAL.heroBlue;
    ctx.beginPath();
    ctx.arc(bx, 200, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(75,225,255,0.6)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(bx - 16 - i * 9 - (t * 6) % 9, 196 + i * 4);
      ctx.lineTo(bx - 26 - i * 9 - (t * 6) % 9, 196 + i * 4);
      ctx.stroke();
    }
  }

  private drawEnding(ctx: CanvasRenderingContext2D): void {
    const t = this.frame;
    // Ground.
    ctx.fillStyle = '#16283f';
    ctx.fillRect(0, 210, W, 40);
    // Yolk sputtering away on his rocket-chair, small and sad.
    const px = W - 90 - t * 0.4;
    const py = 70 + Math.sin(t / 9) * 5;
    ctx.fillStyle = PAL.yolk;
    ctx.beginPath();
    ctx.roundRect(px - 8, py - 8, 16, 10, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(150,150,160,0.5)';
    ctx.beginPath();
    ctx.arc(px - 12 - (t % 10), py + 8, 3, 0, Math.PI * 2);
    ctx.fill();
    // BOLT holding the recovered Core aloft.
    ctx.fillStyle = PAL.heroBlue;
    ctx.beginPath();
    ctx.arc(320, 196, 12, 0, Math.PI * 2);
    ctx.fill();
    const coreY = 168 + Math.sin(t / 25) * 3;
    const glow = ctx.createRadialGradient(320, coreY, 2, 320, coreY, 30 + Math.sin(t / 10) * 5);
    glow.addColorStop(0, 'rgba(255,190,80,0.9)');
    glow.addColorStop(1, 'rgba(255,190,80,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(280, coreY - 40, 80, 80);
    ctx.fillStyle = '#ffbe50';
    ctx.beginPath();
    ctx.arc(320, coreY, 9, 0, Math.PI * 2);
    ctx.fill();
    // Returning crystal sparkles orbiting the Core.
    ctx.fillStyle = PAL.crystal;
    for (let i = 0; i < 5; i++) {
      const a = t / 30 + (i / 5) * Math.PI * 2;
      ctx.save();
      ctx.translate(320 + Math.cos(a) * 34, coreY + Math.sin(a) * 18);
      ctx.rotate(a);
      ctx.fillRect(-2, -4, 4, 8);
      ctx.restore();
    }
  }
}
