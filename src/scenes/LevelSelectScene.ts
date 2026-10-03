import type { Scene } from '../core/Game.ts';
import type { Game } from '../core/Game.ts';
import type { Input } from '../core/Input.ts';
import type { Sfx } from '../audio/sfx.ts';
import { LEVELS, BIOMES, biomeActs } from '../levels/index.ts';
import { Progress } from '../game/progress.ts';
import { renderThumbnail } from '../render/minimap.ts';
import { buildBackdrop, drawBackdrop, freshBackdrop, type Backdrop } from '../render/backdrop.ts';
import { prefersReducedMotion } from '../core/prefs.ts';
import { VIEW_W, VIEW_H, renderScale, renderScaleVersion } from '../core/view.ts';
import { drawText, proseFont } from '../render/font.ts';
import { fmtTime } from '../ui/Hud.ts';
import { UI, BIOME_UI, ListNav, inRect, panel, promptRow, selectionBar, slantPath, type Rect } from '../ui/theme.ts';
import type { Rank } from '../game/Score.ts';
import { LevelScene } from './LevelScene.ts';
import { TitleScene } from './TitleScene.ts';

const TAB_Y = 44;
const TAB_H = 22;
const LIST_X = 40;
const LIST_Y = 84;
const ROW_H = 21;
const LIST_W = 236;
const CARD_X = 304;
const CARD_Y = 84;
const CARD_W = 304;
const POST_W = 280;
const POST_H = 96;

const RANK_COLOR: Record<Rank, string> = { S: '#ffd94a', A: '#4be1ff', B: '#7cf29a', C: '#c9b6ff', D: '#a8adc4' };

/**
 * The campaign map. The old screen was one 42-row list — a file browser.
 * Here the four zones are tabs (left/right, or click), each zone's acts are
 * a short list with the rank earned on each, and the focused act gets a big
 * postcard of its real terrain with its records. The zone's own parallax art
 * scrolls behind it all, so choosing a zone feels like going somewhere.
 */
export class LevelSelectScene implements Scene {
  private frame = 0;
  private zone: number;
  private nav = new ListNav();
  private game: Game;
  private input: Input;
  private sfx: Sfx;
  private progress: Progress;
  private reduced = prefersReducedMotion();
  private thumbs = new Map<number, HTMLCanvasElement>();
  private thumbVersion = renderScaleVersion();
  private backdrops = new Map<number, Backdrop>();
  private zoneAge = 99;

  constructor(game: Game, input: Input, sfx: Sfx) {
    this.game = game;
    this.input = input;
    this.sfx = sfx;
    this.progress = Progress.load();
    input.setGameplayTouch(false);
    const at = this.progress.continueAt(LEVELS.length);
    this.zone = LEVELS[at].biome;
    this.nav.index = biomeActs(this.zone).findIndex((a) => a.index === at);
  }

  private acts(): { index: number }[] {
    return biomeActs(this.zone);
  }

  private rows(): Rect[] {
    return this.acts().map((_, i) => ({ x: LIST_X - 6, y: LIST_Y + i * ROW_H, w: LIST_W + 12, h: ROW_H - 3 }));
  }

  private tabs(): Rect[] {
    const tw = (VIEW_W - 80) / BIOMES.length;
    return BIOMES.map((_, i) => ({ x: 40 + i * tw, y: TAB_Y, w: tw - 8, h: TAB_H }));
  }

  private setZone(z: number): void {
    const n = (z + BIOMES.length) % BIOMES.length;
    if (n === this.zone) return;
    this.zone = n;
    this.zoneAge = 0;
    this.nav.index = Math.min(this.nav.index, this.acts().length - 1);
    this.sfx.play('ui-move');
  }

  update(): void {
    this.frame++;
    this.zoneAge++;
    if (this.game.transitioning) return;

    const p = this.input.pointer;
    if (p.released) {
      const t = this.tabs().findIndex((r) => inRect(r, p.x, p.y));
      if (t >= 0) this.setZone(t);
      if (inRect({ x: CARD_X, y: CARD_Y, w: CARD_W, h: POST_H + 24 }, p.x, p.y)) return this.play();
    }

    const r = this.nav.update(this.input, this.acts().length, this.rows());
    if (r === 'move') {
      this.sfx.ensure();
      this.sfx.play('ui-move');
    } else if (r === 'left') this.setZone(this.zone - 1);
    else if (r === 'right') this.setZone(this.zone + 1);
    else if (r === 'back') {
      this.sfx.play('ui-back');
      this.game.changeScene(() => new TitleScene(this.game, this.input, this.sfx));
    } else if (r === 'confirm') this.play();
  }

  private play(): void {
    this.sfx.ensure();
    const act = this.acts()[this.nav.index];
    if (!act) return;
    if (this.progress.isUnlocked(act.index)) {
      this.sfx.play('ui-confirm');
      this.sfx.music.stop(0.6);
      const start = act.index;
      this.game.changeScene(() => new LevelScene(this.game, this.input, this.sfx, start));
    } else {
      this.sfx.play('ui-error'); // locked: the click has to answer SOMETHING
    }
  }

  private thumb(i: number): HTMLCanvasElement {
    if (this.thumbVersion !== renderScaleVersion()) {
      this.thumbs.clear();
      this.thumbVersion = renderScaleVersion();
    }
    let t = this.thumbs.get(i);
    if (!t) {
      const s = renderScale();
      t = renderThumbnail(LEVELS[i], Math.round(POST_W * s), Math.round(POST_H * s));
      this.thumbs.set(i, t);
    }
    return t;
  }

  private backdrop(z: number): Backdrop {
    let bd = this.backdrops.get(z);
    if (!bd) bd = buildBackdrop(BIOMES[z].theme);
    bd = freshBackdrop(bd);
    this.backdrops.set(z, bd);
    return bd;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const biome = BIOMES[this.zone];
    const c = BIOME_UI[biome.theme];
    drawBackdrop(ctx, this.backdrop(this.zone), this.reduced ? 0 : this.frame * 0.6, 150, this.frame, !this.reduced);
    ctx.fillStyle = 'rgba(5,6,14,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    drawText(ctx, 'LEVEL SELECT', 40, 30, { size: 14, fill: '#ffffff', outline: UI.ink, outlineWidth: 2.4 });
    drawText(ctx, `${this.progress.clearedCount()} / ${LEVELS.length} CLEARED`, VIEW_W - 40, 30, {
      size: 7,
      fill: UI.textDim,
      outline: UI.ink,
      align: 'right',
    });

    // Zone tabs.
    this.tabs().forEach((r, i) => {
      const sel = i === this.zone;
      const col = BIOME_UI[BIOMES[i].theme];
      const acts = biomeActs(i);
      const cleared = acts.filter((a) => this.progress.isCleared(a.index)).length;
      ctx.fillStyle = sel ? col.main : 'rgba(255,255,255,0.07)';
      slantPath(ctx, r.x, r.y, r.w, r.h);
      ctx.fill();
      drawText(ctx, BIOMES[i].name, r.x + 10, r.y + 10, { size: 6, fill: sel ? UI.ink : UI.text, outline: sel ? undefined : UI.ink });
      drawText(ctx, `${cleared}/${acts.length}`, r.x + r.w - 10, r.y + 18, { size: 5, fill: sel ? UI.ink : UI.textDim, align: 'right' });
      drawText(ctx, BIOMES[i].hour, r.x + 10, r.y + 18, { size: 4.5, fill: sel ? 'rgba(0,0,0,0.6)' : UI.textFaint });
    });
    drawText(ctx, '◀', 28, TAB_Y + 14, { size: 6, fill: UI.textDim });
    drawText(ctx, '▶', VIEW_W - 34, TAB_Y + 14, { size: 6, fill: UI.textDim });

    // Act list.
    const slide = this.reduced ? 1 : 1 - (1 - Math.min(1, this.zoneAge / 10)) ** 3;
    this.acts().forEach((a, i) => {
      const def = LEVELS[a.index];
      const y = LIST_Y + i * ROW_H;
      const sel = this.nav.index === i;
      const unlocked = this.progress.isUnlocked(a.index);
      const best = this.progress.best(a.index);
      const x = LIST_X - (1 - slide) * 30;
      ctx.save();
      ctx.globalAlpha = slide;
      if (sel) selectionBar(ctx, x, y, LIST_W, ROW_H - 3, this.nav.age / 8, c.main);
      else {
        ctx.fillStyle = 'rgba(10,12,26,0.6)';
        slantPath(ctx, x, y, LIST_W, ROW_H - 3);
        ctx.fill();
      }
      const ink = sel ? UI.ink : unlocked ? UI.text : UI.textFaint;
      drawText(ctx, String(i + 1).padStart(2, '0'), x + 10, y + 12.5, { size: 7, fill: sel ? UI.ink : c.main, outline: sel ? undefined : UI.ink });
      drawText(ctx, def.title.toUpperCase(), x + 32, y + 12.5, { size: 6.5, fill: ink, outline: sel ? undefined : UI.ink });
      if (def.bossKind) drawText(ctx, '★', x + LIST_W - 40, y + 12.5, { size: 6, fill: sel ? UI.ink : UI.danger });
      if (!unlocked) lockIcon(ctx, x + LIST_W - 16, y + 9, sel ? UI.ink : UI.textFaint);
      else if (best?.rank) {
        drawText(ctx, best.rank, x + LIST_W - 14, y + 13, { size: 8, fill: sel ? UI.ink : RANK_COLOR[best.rank], outline: sel ? undefined : UI.ink, align: 'center' });
      }
      ctx.restore();
    });

    // Focused act card.
    const act = this.acts()[this.nav.index];
    if (act) {
      const def = LEVELS[act.index];
      const unlocked = this.progress.isUnlocked(act.index);
      const best = this.progress.best(act.index);
      panel(ctx, CARD_X, CARD_Y - 6, CARD_W, 236, c.main);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(CARD_X + 12, CARD_Y + 6, POST_W, POST_H, 4);
      ctx.clip();
      ctx.drawImage(this.thumb(act.index), CARD_X + 12, CARD_Y + 6, POST_W, POST_H);
      if (!unlocked) {
        ctx.fillStyle = 'rgba(6,7,14,0.72)';
        ctx.fillRect(CARD_X + 12, CARD_Y + 6, POST_W, POST_H);
        lockIcon(ctx, CARD_X + 12 + POST_W / 2, CARD_Y + 6 + POST_H / 2 - 4, UI.textDim, 2);
      }
      ctx.restore();

      drawText(ctx, `${biome.name} · ${def.act}`, CARD_X + 14, CARD_Y + 120, { size: 6, fill: c.main, outline: UI.ink });
      drawText(ctx, def.title.toUpperCase(), CARD_X + 14, CARD_Y + 136, { size: 10, fill: '#ffffff', outline: UI.ink, outlineWidth: 2 });
      if (def.bossKind) {
        drawText(ctx, def.bossRage ? '★ BOSS REMATCH' : '★ BOSS', CARD_X + CARD_W - 14, CARD_Y + 120, { size: 6, fill: UI.danger, outline: UI.ink, align: 'right' });
      }

      if (best) {
        const stats: [string, string][] = [
          ['BEST TIME', fmtTime(best.timeFrames)],
          ['BEST SCORE', String(best.score)],
          ['CRYSTALS', `${best.crystals}/5`],
          ['SECRETS', `${best.secrets}/3`],
        ];
        stats.forEach(([l, v], i) => {
          const sx = CARD_X + 14 + (i % 2) * 140;
          const sy = CARD_Y + 160 + Math.floor(i / 2) * 18;
          drawText(ctx, l, sx, sy, { size: 5.5, fill: UI.gold, outline: UI.ink });
          drawText(ctx, v, sx + 118, sy, { size: 7, fill: '#ffffff', outline: UI.ink, align: 'right' });
        });
        if (best.rank) {
          drawText(ctx, 'RANK', CARD_X + CARD_W - 40, CARD_Y + 156, { size: 5, fill: UI.textDim, align: 'center' });
          drawText(ctx, best.rank, CARD_X + CARD_W - 40, CARD_Y + 192, { size: 26, fill: RANK_COLOR[best.rank], outline: UI.ink, outlineWidth: 2.4, align: 'center' });
        }
      } else {
        ctx.font = proseFont(9);
        ctx.fillStyle = UI.textDim;
        ctx.fillText(unlocked ? 'Not cleared yet — no records.' : 'Clear the act before this one to unlock it.', CARD_X + 14, CARD_Y + 168);
      }
      if (unlocked) {
        promptRow(ctx, this.input, CARD_X + CARD_W / 2, CARD_Y + 214, [{ action: 'confirm', label: 'PLAY' }], 'center', 7, 0.75 + 0.25 * Math.sin(this.frame / 10));
      }
    }

    promptRow(ctx, this.input, VIEW_W / 2, VIEW_H - 14, [
      { action: 'move', label: 'ZONE' },
      { action: 'back', label: 'BACK' },
    ], 'center', 6, 0.85);
  }
}

function lockIcon(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, s = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, -1, 3, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-4.5, -1, 9, 7, 1.5);
  ctx.fill();
  ctx.restore();
}
