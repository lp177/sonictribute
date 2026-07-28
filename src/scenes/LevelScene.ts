import type { Scene } from '../core/Game.ts';
import type { Game } from '../core/Game.ts';
import type { Input } from '../core/Input.ts';
import type { Sfx } from '../audio/sfx.ts';
import { Camera } from '../core/Camera.ts';
import { Level } from '../game/Level.ts';
import { Player } from '../game/Player.ts';
import { HUD } from '../game/HUD.ts';
import { zone1 } from '../levels/zone1.ts';
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
  drawGoal,
  drawBoss,
  drawHero,
} from '../render/painter.ts';
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

  constructor(game: Game, input: Input, sfx: Sfx) {
    this.game = game;
    this.input = input;
    this.sfx = sfx;
    this.level = new Level(zone1);
    this.player = new Player(this.level.startPos.x, this.level.startPos.y);
    this.camera = new Camera(W, H);
    this.camera.snapTo(this.player.x, this.player.y, this.level.map.pixelW, this.level.map.pixelH);
    // Pre-rendered art — built once, behind the scene fade.
    this.terrain = renderTerrain(this.level.map);
    this.loopArts = this.level.loops.map((l) => ({
      art: renderLoopArt(l),
      cx: l.cx,
      cy: l.cy,
      r: l.outerR + 8,
    }));
    this.bg = renderBackground(W, H);
  }

  update(): void {
    this.frame++;
    const { level, player } = this;

    if (level.results) {
      if (this.input.uiWasPressed('Enter', 'Space', 'KeyZ')) {
        this.game.changeScene(new TitleScene(this.game, this.input, this.sfx));
      }
      return;
    }

    const snap = this.input.snapshot();
    if (snap.jumpPressed) this.sfx.ensure();
    player.update(level.map, snap);

    for (const ev of player.events) this.sfx.play(ev);
    for (const ev of level.update(player)) this.sfx.play(ev);

    // Camera: locked during the boss fight, classic follow otherwise.
    if (level.boss && !level.bossDefeated) {
      const cx = (level.arena.left + level.arena.right) / 2;
      const target = cx - W / 2;
      this.camera.x += Math.max(-8, Math.min(8, target - this.camera.x));
      this.camera.update(player.x, player.y, 0, player.facing, level.map.pixelW, level.map.pixelH);
      this.camera.x = Math.max(level.arena.left - 80, Math.min(level.arena.right + 80 - W, this.camera.x));
    } else {
      this.camera.update(player.x, player.y, player.gsp, player.facing, level.map.pixelW, level.map.pixelH);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { level, player, camera } = this;
    const camX = Math.round(camera.x);
    const camY = Math.round(camera.y);

    // Parallax background (two depths of the same strip).
    this.tiledBg(ctx, camX * 0.2, 0);
    this.tiledBg(ctx, camX * 0.45, 40, 0.6);

    ctx.save();
    ctx.translate(-camX, -camY);

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

    for (const r of level.rings) if (!r.taken && visible(r.x)) drawRing(ctx, r.x, r.y, this.frame);
    for (const s of level.scattered) if (visible(s.x)) drawRing(ctx, s.x, s.y, this.frame);
    for (const c of level.crystals) if (!c.taken && visible(c.x)) drawCrystal(ctx, c.x, c.y, this.frame);
    for (const s of level.springs) if (visible(s.x)) drawSpring(ctx, s.x, s.y, s.cooldown);
    for (const m of level.monitors) if (visible(m.x)) drawMonitor(ctx, m.x, m.y, m.kind, m.broken);
    for (const s of level.spikes) if (visible(s.x)) drawSpikes(ctx, s.x, s.y);
    for (const c of level.checkpoints) if (visible(c.x)) drawCheckpoint(ctx, c.x, c.y, c.active);
    for (const e of level.enemies) if (e.alive && visible(e.x)) drawSnapCrab(ctx, e.x, e.y, e.xsp);
    if (visible(level.goal.x)) drawGoal(ctx, level.goal.x, level.goal.y, level.goal.spinning, this.frame);
    if (level.boss && visible(level.boss.x)) drawBoss(ctx, level.boss, this.frame);

    drawHero(ctx, player, this.frame);
    ctx.restore();

    // Boss intro banner.
    if (level.boss && level.boss.phase === 'intro') {
      ctx.textAlign = 'center';
      ctx.fillStyle = PAL.yolk;
      ctx.font = 'bold 20px monospace';
      ctx.fillText('DR. YOLK', W / 2, 60);
      ctx.fillStyle = '#9aa3b2';
      ctx.font = '11px monospace';
      ctx.fillText('WRECKING POD', W / 2, 78);
      ctx.textAlign = 'left';
    }

    this.hud.draw(ctx, level, player);
    if (level.results) this.hud.drawResults(ctx, level, player, this.frame);
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
