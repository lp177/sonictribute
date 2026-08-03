import type { Scene } from '../core/Game.ts';
import type { Game } from '../core/Game.ts';
import type { Input } from '../core/Input.ts';
import type { Sfx } from '../audio/sfx.ts';
import { LEVELS, BIOMES } from '../levels/index.ts';
import { Progress } from '../game/progress.ts';
import { renderThumbnail } from '../render/minimap.ts';
import { prefersReducedMotion } from '../core/prefs.ts';
import { UI, panel, selectionRow } from '../ui/theme.ts';
import { LevelScene } from './LevelScene.ts';
import { TitleScene } from './TitleScene.ts';

const W = 640;
const H = 360;
const ROW_H = 46;
const VISIBLE = 6;
const LIST_X = 24;
const LIST_W = W - 48;
const LIST_Y = 54;

function fmtTime(frames: number): string {
  const m = Math.floor(frames / 3600);
  const s = Math.floor((frames % 3600) / 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * The campaign map: one line per act, with a real postcard of its terrain, a
 * scene-descriptive name, best results, and a lock until the act before it is
 * cleared. Enter starts the selected act directly — that is what makes
 * per-act completion runs practical.
 */
export class LevelSelectScene implements Scene {
  private frame = 0;
  private index: number;
  private scroll = 0;
  private game: Game;
  private input: Input;
  private sfx: Sfx;
  private progress: Progress;
  private reduced = prefersReducedMotion();
  /** Thumbnails are built lazily: only rows near the view pay their cost. */
  private thumbs = new Map<number, HTMLCanvasElement>();

  constructor(game: Game, input: Input, sfx: Sfx) {
    this.game = game;
    this.input = input;
    this.sfx = sfx;
    this.progress = Progress.load();
    this.index = this.progress.continueAt(LEVELS.length);
    this.scroll = Math.max(0, Math.min(this.index - 2, LEVELS.length - VISIBLE));
  }

  update(): void {
    this.frame++;

    if (this.input.uiWasPressed('Escape')) {
      this.game.changeScene(() => new TitleScene(this.game, this.input, this.sfx));
      return;
    }
    const up = this.input.uiWasPressed('ArrowUp', 'KeyW');
    const down = this.input.uiWasPressed('ArrowDown', 'KeyS');
    if (up) this.index = (this.index + LEVELS.length - 1) % LEVELS.length;
    if (down) this.index = (this.index + 1) % LEVELS.length;
    if (up || down) {
      this.sfx.ensure();
      this.sfx.play('ring');
      this.scroll = Math.max(0, Math.min(Math.max(0, this.index - 2), LEVELS.length - VISIBLE));
    }

    if (this.input.confirmPressed()) {
      this.sfx.ensure();
      if (this.progress.isUnlocked(this.index)) {
        const start = this.index;
        this.game.changeScene(() => new LevelScene(this.game, this.input, this.sfx, start));
      } else {
        this.sfx.play('hurt'); // locked: the click has to answer SOMETHING
      }
    }
  }

  private thumb(i: number): HTMLCanvasElement {
    let t = this.thumbs.get(i);
    if (!t) {
      t = renderThumbnail(LEVELS[i]);
      this.thumbs.set(i, t);
    }
    return t;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, W, H);

    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = UI.accent;
    ctx.fillText('THE FOUR STOLEN HOURS', LIST_X, 30);
    ctx.font = '10px monospace';
    ctx.fillStyle = UI.textDim;
    ctx.textAlign = 'right';
    ctx.fillText(`${this.progress.clearedCount()} / ${LEVELS.length} CLEARED`, W - LIST_X, 30);
    ctx.textAlign = 'left';

    const pulse = this.reduced ? 1 : 0.5 + 0.5 * Math.sin(this.frame / 12);
    const last = Math.min(LEVELS.length, this.scroll + VISIBLE);
    for (let i = this.scroll; i < last; i++) {
      const def = LEVELS[i];
      const y = LIST_Y + (i - this.scroll) * ROW_H;
      const selected = i === this.index;
      const unlocked = this.progress.isUnlocked(i);
      const best = this.progress.best(i);
      const biome = BIOMES[def.biome];

      panel(ctx, LIST_X, y, LIST_W, ROW_H - 6, 8);
      if (selected) selectionRow(ctx, LIST_X, y, LIST_W, ROW_H - 6, pulse);

      // Postcard (dimmed while locked, silhouette only).
      ctx.save();
      if (!unlocked) ctx.globalAlpha = 0.25;
      ctx.drawImage(this.thumb(i), LIST_X + 10, y + 2, 132, 36);
      ctx.restore();
      ctx.strokeStyle = selected ? UI.accent : UI.outline;
      ctx.lineWidth = 1;
      ctx.strokeRect(LIST_X + 10, y + 2, 132, 36);

      const tx = LIST_X + 154;
      ctx.font = '8px monospace';
      ctx.fillStyle = unlocked ? UI.textFaint : UI.textFaint;
      ctx.fillText(`${biome.name} · ${String(i + 1).padStart(2, '0')}`, tx, y + 12);
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = unlocked ? (selected ? UI.text : UI.textDim) : UI.textFaint;
      ctx.fillText(unlocked ? def.title.toUpperCase() : '— LOCKED —', tx, y + 26);

      ctx.textAlign = 'right';
      if (best) {
        ctx.font = '9px monospace';
        ctx.fillStyle = UI.accent;
        ctx.fillText(`★ ${best.score}`, LIST_X + LIST_W - 12, y + 12);
        ctx.fillStyle = UI.textDim;
        ctx.fillText(`${fmtTime(best.timeFrames)} · ${best.crystals}/5 ◆ · ${best.secrets}/3 ?`, LIST_X + LIST_W - 12, y + 26);
      } else if (unlocked) {
        ctx.font = '9px monospace';
        ctx.fillStyle = UI.warn;
        ctx.fillText('NOT CLEARED', LIST_X + LIST_W - 12, y + 19);
      } else {
        // Padlock glyph, drawn (no fonts to rely on).
        const lx = LIST_X + LIST_W - 24;
        const ly = y + 13;
        ctx.fillStyle = UI.textFaint;
        ctx.fillRect(lx, ly + 4, 12, 9);
        ctx.strokeStyle = UI.textFaint;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(lx + 6, ly + 4, 4, Math.PI, 0);
        ctx.stroke();
      }
      ctx.textAlign = 'left';
    }

    // Scroll hints.
    ctx.fillStyle = UI.textFaint;
    ctx.textAlign = 'center';
    if (this.scroll > 0) ctx.fillText('▲', W / 2, LIST_Y - 6);
    if (last < LEVELS.length) ctx.fillText('▼', W / 2, LIST_Y + VISIBLE * ROW_H + 4);
    ctx.font = '9px monospace';
    ctx.fillText('↑↓ SELECT  ·  ENTER PLAY  ·  ESC BACK', W / 2, H - 10);
    ctx.textAlign = 'left';
  }
}
