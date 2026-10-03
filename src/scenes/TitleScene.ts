import type { Scene } from '../core/Game.ts';
import type { Game } from '../core/Game.ts';
import type { Input } from '../core/Input.ts';
import type { Sfx } from '../audio/sfx.ts';
import {
  drawTitleBackdrop,
  drawTitleLogo,
  freshTitleBackdrop,
  renderTitleBackdrop,
  TITLE_GROUND_Y,
  type TitleBackdrop,
} from '../render/titleArt.ts';
import { prefersReducedMotion } from '../core/prefs.ts';
import { drawBoltPose } from '../render/hero.ts';
import { VIEW_W, VIEW_H } from '../core/view.ts';
import { drawText, proseFont } from '../render/font.ts';
import { OptionsMenu } from '../ui/OptionsMenu.ts';
import { UI, ListNav, menuRow, promptRow, type Rect } from '../ui/theme.ts';
import { LEVELS, BIOMES } from '../levels/index.ts';
import { Progress } from '../game/progress.ts';
import { CutsceneScene } from './CutsceneScene.ts';
import { LevelScene } from './LevelScene.ts';
import { LevelSelectScene } from './LevelSelectScene.ts';
import { appUpdate, updateApplying, updateReady } from '../pwa/updateHandle.ts';

type MenuId = 'start' | 'levels' | 'options' | 'update';
interface MenuItem {
  id: MenuId;
  label: string;
}

/**
 * Composition: the key art (hero, sun, parallax) owns the right of the frame;
 * the logo and menu own the left, with no card behind them — a soft shade on
 * the left third is enough for contrast and keeps the art whole.
 */
const COL_X = 176;
const LOGO_Y = 92;
const MENU_X = 84;
const MENU_Y = 168;
const MENU_W = 196;
const ROW_H = 23;
const HERO_X = 486;
const HERO_SCALE = 2.4;

export class TitleScene implements Scene {
  private bd: TitleBackdrop;
  private frame = 0;
  private game: Game;
  private input: Input;
  private sfx: Sfx;
  private nav = new ListNav();
  private options: OptionsMenu | null = null;
  private reduced = prefersReducedMotion();
  private progress = Progress.load();

  constructor(game: Game, input: Input, sfx: Sfx) {
    this.game = game;
    this.input = input;
    this.sfx = sfx;
    this.bd = renderTitleBackdrop();
    input.setGameplayTouch(false);
    sfx.music.play('title');
  }

  /** The live menu: the update row exists only while a build is waiting. */
  private menu(): MenuItem[] {
    const started = this.progress.clearedCount() > 0;
    const items: MenuItem[] = [
      { id: 'start', label: started ? 'CONTINUE' : 'START GAME' },
      { id: 'levels', label: 'LEVEL SELECT' },
      { id: 'options', label: 'OPTIONS' },
    ];
    if (updateReady() || updateApplying()) items.push({ id: 'update', label: updateApplying() ? 'UPDATING…' : 'UPDATE GAME' });
    return items;
  }

  private rows(n: number): Rect[] {
    return Array.from({ length: n }, (_, i) => ({ x: MENU_X - 8, y: MENU_Y + i * ROW_H, w: MENU_W + 16, h: ROW_H - 4 }));
  }

  /** One line under the menu saying what the focused entry will do. */
  private describe(id: MenuId): string {
    const at = this.progress.continueAt(LEVELS.length);
    const def = LEVELS[at];
    switch (id) {
      case 'start':
        return this.progress.clearedCount() > 0
          ? `${BIOMES[def.biome].name} · ${def.act} — ${def.title}`
          : 'Four stolen hours. Four zones. Take tomorrow back.';
      case 'levels': {
        const best = LEVELS.map((_, i) => this.progress.best(i)?.rank).filter((r) => r === 'S').length;
        return `${this.progress.clearedCount()} / ${LEVELS.length} acts cleared${best ? ` · ${best} S rank${best > 1 ? 's' : ''}` : ''}`;
      }
      case 'options':
        return 'Audio, controls, gamepad, touch and comfort settings.';
      case 'update':
        return 'A new version is ready — the game reloads to apply it.';
    }
  }

  update(): void {
    this.frame++;

    if (this.options) {
      if (this.options.update(this.input) === 'close') this.options = null;
      return;
    }
    if (this.game.transitioning) return;

    const menu = this.menu();
    const r = this.nav.update(this.input, menu.length, this.rows(menu.length));
    if (r === 'move') {
      // A key press IS the user gesture WebAudio waits for, so the menu blip
      // can arm the synth — the game then has sound from the very first frame.
      this.sfx.ensure();
      this.sfx.play('ui-move');
    }
    if (r !== 'confirm') return;

    this.sfx.ensure();
    this.sfx.play('ui-confirm');
    const id = menu[this.nav.index].id;
    if (id === 'update') {
      // Only offered here, never mid-act: applying reloads the page, and a
      // reload in a level would throw away the run.
      appUpdate()?.apply();
      return;
    }
    if (id === 'options') {
      this.options = new OptionsMenu(this.sfx);
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
    this.sfx.music.stop(0.8);
    this.game.changeScene(
      () =>
        intro
          ? new CutsceneScene(this.game, this.input, this.sfx, intro, () => new LevelScene(this.game, this.input, this.sfx, at))
          : new LevelScene(this.game, this.input, this.sfx, at),
    );
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    const menu = this.menu();
    this.bd = freshTitleBackdrop(this.bd);
    // The scroll runs on fractional frames; the hero's own animation ticks.
    drawTitleBackdrop(ctx, this.bd, this.frame + alpha, this.reduced);
    drawBoltPose(ctx, HERO_X, TITLE_GROUND_Y, HERO_SCALE, this.frame, this.reduced ? 'idle' : 'sprint', 'title');

    // Left-third shade for legibility, instead of a card over the art.
    const shade = ctx.createLinearGradient(0, 0, 360, 0);
    shade.addColorStop(0, 'rgba(4,6,16,0.78)');
    shade.addColorStop(0.6, 'rgba(4,6,16,0.45)');
    shade.addColorStop(1, 'rgba(4,6,16,0)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, 360, VIEW_H);

    drawTitleLogo(ctx, COL_X, LOGO_Y, this.frame, this.reduced);

    // Menu rows slide in once, staggered, on first show.
    menu.forEach((item, i) => {
      const k = this.reduced ? 1 : Math.min(1, Math.max(0, (this.frame - 8 - i * 4) / 14));
      const e = 1 - (1 - k) ** 3;
      ctx.save();
      ctx.globalAlpha = e;
      const sel = this.nav.index === i;
      menuRow(ctx, MENU_X - (1 - e) * 40, MENU_Y + i * ROW_H, MENU_W, item.label, sel, this.nav.age, {
        size: 10,
        h: ROW_H - 4,
        color: item.id === 'update' ? UI.gold : UI.accent,
      });
      ctx.restore();
    });

    // Description of the focused entry.
    const desc = this.describe(menu[this.nav.index].id);
    ctx.font = proseFont(9.5);
    ctx.fillStyle = UI.textDim;
    ctx.fillText(desc, MENU_X - 4, MENU_Y + menu.length * ROW_H + 12);

    // Bottom: device-aware prompts on the left, credits on the right.
    promptRow(ctx, this.input, 24, VIEW_H - 18, [
      { action: 'confirm', label: 'SELECT' },
      { action: 'back', label: 'BACK' },
    ], 'left', 6.5, 0.85);
    drawText(ctx, 'FREE & OPEN SOURCE · ALL ART AND SOUND MADE IN CODE', VIEW_W - 20, VIEW_H - 15, {
      size: 5,
      fill: 'rgba(255,255,255,0.45)',
      align: 'right',
    });

    if (this.options) this.options.render(ctx, this.input);
  }
}
