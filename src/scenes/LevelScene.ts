import type { Scene } from '../core/Game.ts';
import type { Game } from '../core/Game.ts';
import type { Input } from '../core/Input.ts';
import type { Sfx } from '../audio/sfx.ts';
import { Camera } from '../core/Camera.ts';
import { Level, type LevelTheme } from '../game/Level.ts';
import { Player, NO_INPUT } from '../game/Player.ts';
import { HUD } from '../game/HUD.ts';
import { LEVELS } from '../levels/index.ts';
import { STORY_ENDING } from '../game/story.ts';
import {
  PAL,
  renderTerrain,
  renderLoopArt,
  renderBackground,
  drawRing,
  drawCrystal,
  drawSpring,
  drawMonitor,
  drawSpikes,
  drawCheckpoint,
  drawSnapCrab,
  drawBuzzDrone,
  drawDashPad,
  drawBoardPad,
  drawRail,
  drawSpikeTrap,
  drawCrumble,
  drawSwingBall,
  drawBossGate,
  drawGoal,
  drawBoss,
  drawHero,
  drawAfterimage,
} from '../render/painter.ts';
import { FxSystem } from '../render/fx.ts';
import { buildDecor, drawDecor, drawClouds, type DecorSet } from '../render/decor.ts';
import { BossArena } from '../game/BossArena.ts';
import { prefersReducedMotion } from '../core/prefs.ts';
import { PauseMenu } from '../ui/PauseMenu.ts';
import { SettingsPanel } from '../ui/SettingsPanel.ts';
import { CutsceneScene } from './CutsceneScene.ts';
import { TitleScene } from './TitleScene.ts';

const W = 640;
const H = 360;

export class LevelScene implements Scene {
  private level: Level;
  private player: Player;
  private camera: Camera;
  private hud = new HUD();
  private terrain: HTMLCanvasElement[];
  private loopArts: { art: HTMLCanvasElement; cx: number; cy: number; r: number }[];
  private bg: HTMLCanvasElement;
  private frame = 0;
  private game: Game;
  private input: Input;
  private sfx: Sfx;
  private levelIndex: number;
  private fx: FxSystem;
  private skyFill: string;
  private pause: PauseMenu | null = null;
  private settings: SettingsPanel | null = null;
  private decor: DecorSet;
  private theme: LevelTheme;
  private animate: boolean;
  /** Recent hero positions for speed afterimages (newest first). */
  private trail: { x: number; y: number; ball: boolean }[] = [];

  constructor(game: Game, input: Input, sfx: Sfx, levelIndex = 0) {
    this.game = game;
    this.input = input;
    this.sfx = sfx;
    this.levelIndex = levelIndex;
    const def = LEVELS[levelIndex];
    this.level = new Level(def);
    this.player = new Player(this.level.startPos.x, this.level.startPos.y);
    this.camera = new Camera(W, H);
    this.camera.snapTo(this.player.x, this.player.y, this.level.map.pixelW, this.level.map.pixelH);
    this.fx = new FxSystem(prefersReducedMotion());
    this.animate = !prefersReducedMotion();
    this.theme = def.theme;
    this.skyFill = def.theme === 'gear' ? '#0d0d16' : def.theme === 'crystal' ? '#080513' : '#0b1026';
    this.decor = buildDecor(this.level.map, def.theme, W, H);
    // Pre-rendered art — built once, behind the scene fade. The background is
    // rendered taller than the view for vertical parallax headroom.
    this.terrain = renderTerrain(this.level.map, def.theme);
    this.loopArts = this.level.loops.map((l) => ({
      art: renderLoopArt(l, def.theme),
      cx: l.cx,
      cy: l.cy,
      r: l.outerR + 8,
    }));
    this.bg = renderBackground(W, H + 32, def.theme);
  }

  update(): void {
    this.frame++;
    const { level, player } = this;

    // --- Paused: menus run, the world is frozen ---
    if (this.pause) {
      if (this.settings) {
        if (this.settings.update(this.input) === 'close') this.settings = null;
        return;
      }
      const choice = this.pause.update(this.input);
      if (choice === 'resume') this.pause = null;
      else if (choice === 'settings') this.settings = new SettingsPanel();
      else if (choice === 'restart') {
        this.game.changeScene(() => new LevelScene(this.game, this.input, this.sfx, this.levelIndex));
      } else if (choice === 'quit') {
        this.game.changeScene(() => new TitleScene(this.game, this.input, this.sfx));
      }
      return;
    }

    // Hit-stop: the whole world holds still for a few frames on impact. This
    // is what gives a stomp weight, so it must gate physics AND particles.
    if (this.fx.tickFreeze()) return;

    this.fx.update();

    if (level.results) {
      if (this.input.confirmPressed()) {
        const next = this.levelIndex + 1;
        if (next < LEVELS.length) {
          // The next zone's intro cutscene doubles as its loading screen.
          this.game.changeScene(
            () =>
              new CutsceneScene(
                this.game,
                this.input,
                this.sfx,
                LEVELS[next].intro,
                () => new LevelScene(this.game, this.input, this.sfx, next),
              ),
          );
        } else {
          this.game.changeScene(
            () =>
              new CutsceneScene(this.game, this.input, this.sfx, STORY_ENDING, () =>
                new TitleScene(this.game, this.input, this.sfx),
              ),
          );
        }
      }
      return;
    }

    if (this.input.actionWasPressed('pause')) {
      this.pause = new PauseMenu();
      return;
    }

    // During the gate slam the player watches; control returns once locked in.
    const snap = level.arenaGates?.cinematic ? NO_INPUT : this.input.snapshot();
    if (snap.jumpPressed) this.sfx.ensure();
    player.update(level.map, snap);

    // Only a landing with real weight kicks dust. A low threshold puffs
    // smoke on every micro-landing while the hero stands on a slope.
    if (player.landImpact > 5) {
      this.fx.emitLandingDust(player.x, player.y + player.h, player.landImpact);
    }

    for (const ev of player.events) {
      this.sfx.play(ev);
      this.fx.onEvent(ev, player.x, player.y + 8);
    }
    for (const ev of level.update(player)) {
      this.sfx.play(ev);
      // Effects belong to whatever caused them: the level reports a position
      // for entity events, boss events erupt at the boss, and only what the
      // hero actually did bursts out of the hero.
      const src = level.eventSources.get(ev);
      const atBoss = !src && ev.startsWith('boss') && level.boss;
      this.fx.onEvent(
        ev,
        src ? src.x : atBoss ? level.boss!.x : player.x,
        src ? src.y : atBoss ? level.boss!.y + 18 : player.y,
      );
    }

    // Continuous juice: run dust, spin-dash smoke, board wake, shoes trail.
    if (!player.dead) {
      if (player.grounded && Math.abs(player.gsp) > 4 && this.frame % 3 === 0) {
        this.fx.emitRunDust(player.x - player.facing * 6, player.y + player.h, player.gsp);
      }
      if (player.spindashing && this.frame % 2 === 0) {
        this.fx.emitSpindashSmoke(player.x, player.y + player.h - 4, player.facing);
      }
      if (player.board && this.frame % 2 === 0) {
        this.fx.emitBoardTrail(player.x - 14, player.y + (player.ball ? 14 : 19));
      }
      if (player.shoes > 0 && this.frame % 2 === 1) {
        this.fx.emitShoesTrail(player.x - player.facing * 10, player.y);
      }
    }
    if (this.frame % 2 === 0) {
      this.trail.unshift({ x: player.x, y: player.y, ball: player.ball });
      if (this.trail.length > 8) this.trail.pop();
    }

    // Camera: locked during the boss fight, classic follow otherwise.
    if (level.boss && !level.bossDefeated) {
      const cx = (level.arena.left + level.arena.right) / 2;
      const target = cx - W / 2;
      this.camera.x += Math.max(-8, Math.min(8, target - this.camera.x));
      this.camera.update(player.x, player.y, 0, player.facing, level.map.pixelW, level.map.pixelH);
      this.camera.x = Math.max(level.arena.left - 80, Math.min(level.arena.right + 80 - W, this.camera.x));
    } else {
      // Look up / down: only while standing still, so it never fights the
      // follow camera mid-run. Down doubles as the spin-dash charge posture,
      // which is fine — the glance and the charge are both "planted".
      const still = player.grounded && Math.abs(player.gsp) < 0.2;
      const look: -1 | 0 | 1 = !still ? 0 : snap.up ? -1 : snap.down ? 1 : 0;
      this.camera.update(
        player.x,
        player.y,
        player.gsp,
        player.facing,
        level.map.pixelW,
        level.map.pixelH,
        look,
      );
      // Never show ground the player is no longer allowed to reach. Without
      // this the backtrack limit is a world-space slab that the camera happily
      // scrolls past, so it lands wherever the camera settled — an invisible
      // wall in mid-screen. Pinning the view to the limit makes the two the
      // same line: you stop at the left edge because the camera stopped, which
      // is how the classics read.
      this.camera.x = Math.max(this.camera.x, level.backLimitX - player.w);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { level, player, camera } = this;
    const camX = Math.round(camera.x);
    const camY = Math.round(camera.viewY);
    const so = this.fx.shakeOffset(this.frame);

    // Solid sky behind everything (covers shake/parallax overdraw).
    ctx.fillStyle = this.skyFill;
    ctx.fillRect(0, 0, W, H);

    // Parallax background: two horizontal depths plus a slight vertical drift.
    const bgY = -Math.round(camY * 0.12) + so.y;
    this.tiledBg(ctx, camX * 0.2 - so.x, bgY);
    // Clouds drift between the two parallax depths so the sky is never still.
    drawClouds(ctx, this.decor, this.frame, camX, W, this.theme, this.animate);
    this.tiledBg(ctx, camX * 0.45 - so.x, 40 + bgY, 0.6);

    ctx.save();
    ctx.translate(-camX + so.x, -camY + so.y);

    // Loop art (decor).
    for (const l of this.loopArts) {
      if (l.cx + l.r < camX || l.cx - l.r > camX + W) continue;
      ctx.drawImage(l.art, l.cx - l.r, l.cy - l.r);
    }

    // Terrain chunks.
    const chunkW = 16 * 16;
    const first = Math.max(0, Math.floor(camX / chunkW));
    const last = Math.min(this.terrain.length - 1, Math.floor((camX + W) / chunkW));
    for (let i = first; i <= last; i++) ctx.drawImage(this.terrain[i], i * chunkW, 0);

    const visible = (x: number) => x > camX - 40 && x < camX + W + 40;

    // Living scenery: grass and flowers bending in the wind, torches
    // guttering, vents puffing, cogs turning.
    drawDecor(ctx, this.decor, this.frame, camX, W, this.animate);

    for (const r of level.rails) {
      if (r.x1 > camX - 40 && r.x0 < camX + W + 40) drawRail(ctx, r.x0, r.y0, r.x1, r.y1, this.frame);
    }
    for (const c of level.crumbles) {
      if (visible(c.x)) drawCrumble(ctx, c.x, c.y, c.w, c.state, c.shakeOffset, c.fallY, this.theme);
    }
    for (const t of level.traps) {
      if (visible(t.x)) drawSpikeTrap(ctx, t.x, t.y, t.extension, t.phase === 'warning', this.frame);
    }
    for (const s of level.swings) {
      if (visible(s.pivotX)) drawSwingBall(ctx, s.pivotX, s.pivotY, s.x, s.y, this.frame);
    }
    for (const d of level.dashPads) if (visible(d.x)) drawDashPad(ctx, d.x, d.y, d.dir, d.cooldown, this.frame);
    for (const bp of level.boardPads) if (visible(bp.x)) drawBoardPad(ctx, bp.x, bp.y, this.frame);
    for (const r of level.rings) if (!r.taken && visible(r.x)) drawRing(ctx, r.x, r.y, this.frame);
    for (const s of level.scattered) if (visible(s.x)) drawRing(ctx, s.x, s.y, this.frame);
    for (const c of level.crystals) if (!c.taken && visible(c.x)) drawCrystal(ctx, c.x, c.y, this.frame);
    for (const s of level.springs) if (visible(s.x)) drawSpring(ctx, s.x, s.y, s.cooldown);
    for (const m of level.monitors) if (visible(m.x)) drawMonitor(ctx, m.x, m.y, m.kind, m.broken);
    for (const s of level.spikes) if (visible(s.x)) drawSpikes(ctx, s.x, s.y);
    for (const c of level.checkpoints) if (visible(c.x)) drawCheckpoint(ctx, c.x, c.y, c.active);
    for (const e of level.enemies) if (e.alive && visible(e.x)) drawSnapCrab(ctx, e.x, e.y, e.xsp);
    for (const d of level.drones) if (d.alive && visible(d.x)) drawBuzzDrone(ctx, d.x, d.y, d.dir, this.frame);
    if (visible(level.goal.x)) drawGoal(ctx, level.goal.x, level.goal.y, level.goal.spinning, this.frame);
    if (level.boss && visible(level.boss.x)) drawBoss(ctx, level.boss, this.frame);

    // Speed afterimages trail behind the hero at high speed.
    const fast = Math.abs(player.gsp) > 7.5 || (player.shoes > 0 && Math.abs(player.gsp) > 5);
    if (fast && !this.fx.reducedMotion && !player.dead) {
      const tint = player.board ? PAL.board : player.shoes > 0 ? '#ffd94a' : PAL.heroBlue;
      for (let i = 2; i >= 0; i--) {
        const t = this.trail[(i + 1) * 2];
        if (t) drawAfterimage(ctx, t.x, t.y, t.ball, 0.08 + (2 - i) * 0.05, tint);
      }
    }
    drawHero(ctx, player, this.frame);

    // Arena gates in front of the hero, so being sealed in reads clearly.
    const gates = level.arenaGates;
    if (gates && gates.closed > 0) {
      const h = BossArena.HEIGHT * gates.closed;
      drawBossGate(ctx, gates.leftX, gates.gateTop(), BossArena.WIDTH, h, this.frame);
      drawBossGate(ctx, gates.rightX, gates.gateTop(), BossArena.WIDTH, h, this.frame);
    }

    this.fx.render(ctx);
    ctx.restore();

    // Screen-space juice: speed streaks, vignette, impact flash.
    this.fx.renderScreen(ctx, W, H, Math.abs(player.gsp), this.frame);

    // Boss intro banner.
    if (level.boss && level.boss.phase === 'intro') {
      ctx.textAlign = 'center';
      ctx.fillStyle = PAL.yolk;
      ctx.font = 'bold 20px monospace';
      ctx.fillText(level.boss.title, W / 2, 60);
      ctx.fillStyle = '#9aa3b2';
      ctx.font = '11px monospace';
      ctx.fillText(level.boss.subtitle, W / 2, 78);
      ctx.textAlign = 'left';
    }

    this.hud.draw(ctx, level, player);
    if (level.results) this.hud.drawResults(ctx, level, player, this.frame);
    if (this.pause) this.pause.render(ctx);
    if (this.settings) this.settings.render(ctx, this.input);
  }

  private tiledBg(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, alpha = 1): void {
    const w = this.bg.width;
    let x = -Math.round(offsetX % w);
    if (x > 0) x -= w;
    ctx.globalAlpha = alpha;
    for (; x < W; x += w) ctx.drawImage(this.bg, x, offsetY);
    ctx.globalAlpha = 1;
  }
}
