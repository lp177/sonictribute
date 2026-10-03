import type { Scene } from '../core/Game.ts';
import type { Game } from '../core/Game.ts';
import type { Input } from '../core/Input.ts';
import type { Sfx } from '../audio/sfx.ts';
import { Camera } from '../core/Camera.ts';
import { Level, type LevelTheme } from '../game/Level.ts';
import { Player, NO_INPUT } from '../game/Player.ts';
import { Hud } from '../ui/Hud.ts';
import { TitleCard } from '../ui/TitleCard.ts';
import { Results } from '../ui/Results.ts';
import { drawText } from '../render/font.ts';
import { settings } from '../core/settings.ts';
import { UI, slantPath } from '../ui/theme.ts';
import { LEVELS, BIOMES } from '../levels/index.ts';
import { STORY_ENDING, BOSS_TAUNTS } from '../game/story.ts';
import { Progress } from '../game/progress.ts';
import {
  PAL,
  drawBoardPad,
  drawRail,
  drawQuarterPipe,
  drawGliderPickup,
  drawWindZone,
  drawStalactite,
  drawMinecart,
  drawCartBuffer,
  drawPhasePlatform,
  drawSpikeTrap,
  drawCrumble,
  drawSwingBall,
  drawBossGate,
  drawBoss,
} from '../render/painter.ts';
import { HeroRenderer } from '../render/hero.ts';
import {
  drawRing,
  drawCrystal,
  drawSpring,
  drawMonitor,
  drawSpikes,
  drawCheckpoint,
  drawSnapCrab,
  drawBuzzDrone,
  drawDashPad,
  drawHopper,
  drawGoal,
  drawPopup,
} from '../render/objects.ts';
import { FxSystem } from '../render/fx.ts';
import { buildDecor, drawDecor, drawClouds, type DecorSet } from '../render/decor.ts';
import { TerrainRenderer, renderLoopArt } from '../render/terrain.ts';
import { buildBackdrop, drawBackdrop, freshBackdrop, type Backdrop } from '../render/backdrop.ts';
import { VIEW_W, VIEW_H, WORLD_ZOOM, blit, snap, snapWorld, renderScaleVersion, type Layer } from '../core/view.ts';
import { BossArena } from '../game/BossArena.ts';
import { prefersReducedMotion } from '../core/prefs.ts';
import { PauseMenu } from '../ui/PauseMenu.ts';
import { OptionsMenu } from '../ui/OptionsMenu.ts';
import { fmtTime } from '../ui/Hud.ts';
import { CutsceneScene } from './CutsceneScene.ts';
import { TitleScene } from './TitleScene.ts';

const W = VIEW_W;
const H = VIEW_H;
/** A jump in position bigger than this in one step is a respawn, not motion. */
const TELEPORT = 64;
/** Share of the remaining zoom change made each step (an ease-out)... */
const ZOOM_EASE = 0.07;
/** ...and the least it moves, so the last hundredth does not take a second. */
const ZOOM_MIN_STEP = 0.004;

/** Each zone's soundtrack. */
const ZONE_TRACK: Record<LevelTheme, 'dusk' | 'midnight' | 'never' | 'tomorrow'> = {
  verdant: 'dusk',
  gear: 'midnight',
  crystal: 'never',
  neon: 'tomorrow',
};

export class LevelScene implements Scene {
  private level: Level;
  private player: Player;
  private camera: Camera;
  private hud = new Hud();
  private hero = new HeroRenderer(1, true);
  private card: TitleCard;
  private results: Results | null = null;
  /** What the soundtrack is currently scored for. */
  private musicState: 'zone' | 'boss' | 'clear' = 'zone';
  /** Floating score labels ("100") over whatever earned them. */
  private popups: { x: number; y: number; text: string; age: number }[] = [];
  private terrain: TerrainRenderer;
  private loopArts: { art: Layer; cx: number; cy: number; r: number }[] = [];
  private loopVersion = -1;
  private backdrop: Backdrop;
  private frame = 0;
  private game: Game;
  private input: Input;
  private sfx: Sfx;
  private levelIndex: number;
  private fx: FxSystem;
  private pause: PauseMenu | null = null;
  private options: OptionsMenu | null = null;
  private decor: DecorSet;
  private theme: LevelTheme;
  private animate: boolean;
  /** Frames until Yolk laughs: a beat after the gates slam, over his name. */
  private laughIn = 0;
  /** Recent hero positions for speed afterimages (newest first). */
  private trail: { x: number; y: number; ball: boolean }[] = [];
  /**
   * The camera and the hero as they stood one simulation step ago. A draw
   * falls somewhere between two steps (`alpha`), and it shows them that far
   * along the way — the scroll stays even at any display refresh rate.
   */
  private prev = { camX: 0, camY: 0, px: 0, py: 0, zoom: WORLD_ZOOM };
  /** The simulation step the last draw showed (terrain prefetch is paced by steps). */
  private drawnFrame = 0;
  /**
   * How much the world is magnified right now. It rests at WORLD_ZOOM; a
   * boss fight eases it back until the whole arena is in frame, because a
   * boss that attacks from off screen is not a fight, and eases it in again
   * when he falls.
   */
  private zoom = WORLD_ZOOM;

  constructor(game: Game, input: Input, sfx: Sfx, levelIndex = 0) {
    this.game = game;
    this.input = input;
    this.sfx = sfx;
    this.levelIndex = levelIndex;
    const def = LEVELS[levelIndex];
    this.level = new Level(def);
    this.player = new Player(this.level.startPos.x, this.level.startPos.y);
    this.camera = new Camera(W / WORLD_ZOOM, H / WORLD_ZOOM);
    this.camera.snapTo(this.player.x, this.player.y, this.level.map.pixelW, this.level.map.pixelH);
    this.remember();
    this.fx = new FxSystem(prefersReducedMotion());
    this.animate = !prefersReducedMotion();
    this.theme = def.theme;
    this.decor = buildDecor(this.level.map, def.theme, W, H);
    // Pre-rendered art — built once, behind the scene fade. The background is
    // rendered taller than the view for vertical parallax headroom.
    this.terrain = new TerrainRenderer(this.level.map, def.theme);
    this.terrain.warm(this.camera.x - 128, this.camera.viewY - 128, this.camera.w + 256, this.camera.h + 256);
    this.bakeLoops();
    this.backdrop = buildBackdrop(def.theme);
    const biome = BIOMES[def.biome];
    const actNo = parseInt(def.act.replace(/\D+/g, ''), 10) || 1;
    this.card = new TitleCard(biome.name, actNo, def.title, biome.hour, def.theme);
    this.input.setGameplayTouch(true);
    sfx.music.play(ZONE_TRACK[def.theme], { fadeIn: 0.4 });
  }

  /** Keeps the score in step with the act: zone theme, boss, clear jingle, shoes. */
  private updateMusic(): void {
    const { level, player } = this;
    const music = this.sfx.music;
    const def = LEVELS[this.levelIndex];
    let want: 'zone' | 'boss' | 'clear' = 'zone';
    if (level.results) want = 'clear';
    else if (level.boss && !level.bossDefeated) want = 'boss';
    if (want !== this.musicState) {
      this.musicState = want;
      if (want === 'clear') music.play('clear', { restart: true });
      else if (want === 'boss') music.play(def.bossRage ? 'finale' : 'boss', { fadeIn: 0.3 });
      else music.play(ZONE_TRACK[def.theme], { fadeIn: 1.2 });
    }
    // Speed shoes speed the music up, like the classics.
    music.setTempoScale(player.shoes > 0 && want === 'zone' ? 1.2 : 1);
  }

  /** The page was hidden or lost focus: never keep running behind the player's back. */
  suspend(): void {
    if (!this.pause && !this.results) this.openPause();
  }

  private openPause(): void {
    const def = LEVELS[this.levelIndex];
    const { level, player } = this;
    this.sfx.music.duck(true);
    this.pause = new PauseMenu({
      zone: BIOMES[def.biome].name,
      act: def.act,
      title: def.title,
      time: fmtTime(level.timeFrames, settings().preciseTimer),
      crystals: level.crystals.filter((c) => c.taken).length,
      crystalsTotal: level.crystals.length,
      rings: player.rings,
    });
    this.sfx.play('pause');
  }

  private remember(): void {
    this.prev.camX = this.camera.x;
    this.prev.camY = this.camera.viewY;
    this.prev.px = this.player.x;
    this.prev.py = this.player.y;
    this.prev.zoom = this.zoom;
  }

  /** The zoom at which the whole boss arena, gates and all, is in frame. */
  private arenaZoom(): number {
    const { left, right } = this.level.arena;
    return Math.max(1, Math.min(WORLD_ZOOM, W / (right - left + 64)));
  }

  update(): void {
    this.frame++;
    // First thing, before any early return: a step that changes nothing
    // (pause, hit-stop, results) must leave nothing to interpolate.
    this.remember();
    const { level, player } = this;
    this.input.setGameplayTouch(!this.pause && !this.results);
    const opts = settings();
    this.fx.allowShake = opts.screenShake;
    this.fx.allowFlash = opts.flashes;

    // --- Paused: menus run, the world is frozen ---
    if (this.pause) {
      if (this.options) {
        if (this.options.update(this.input) === 'close') this.options = null;
        return;
      }
      const choice = this.pause.update(this.input);
      if (choice === 'resume') {
        this.pause = null;
        this.sfx.music.duck(false);
        this.sfx.play('unpause');
      }
      else if (choice === 'settings') this.options = new OptionsMenu(this.sfx);
      else if (choice === 'restart') {
        this.sfx.music.duck(false);
        this.sfx.music.stop(0.4);
        this.game.changeScene(() => new LevelScene(this.game, this.input, this.sfx, this.levelIndex));
      } else if (choice === 'quit') {
        this.sfx.music.duck(false);
        this.sfx.music.stop(0.5);
        this.game.changeScene(() => new TitleScene(this.game, this.input, this.sfx));
      }
      return;
    }

    // Hit-stop: the whole world holds still for a few frames on impact. This
    // is what gives a stomp weight, so it must gate physics AND particles.
    if (this.fx.tickFreeze()) return;

    this.fx.update();

    if (level.results) {
      if (!this.results) {
        // The act is beaten the moment the results exist — record it even if
        // the player walks away at the results screen.
        const progress = Progress.load();
        const def = LEVELS[this.levelIndex];
        this.results = new Results(
          { ...level.results, ringsHeld: player.rings },
          { actLabel: def.act, theme: def.theme, best: progress.best(this.levelIndex), score: level.score },
        );
        progress.recordClear(this.levelIndex, {
          score: this.results.total,
          timeFrames: level.results.timeFrames,
          crystals: level.results.crystalsFound,
          secrets: level.results.secretsFound,
          rank: this.results.rank,
        });
        progress.save();
      }
      this.updateMusic();
      const r = this.results.update(this.input);
      for (const ev of r.events) this.sfx.play(ev);
      if (r.next) {
        const next = this.levelIndex + 1;
        if (next < LEVELS.length) {
          // A biome's first act opens with its story beat (which doubles as
          // the loading screen); between ordinary acts the fade is enough.
          const intro = LEVELS[next].biome !== LEVELS[this.levelIndex].biome ? LEVELS[next].intro : undefined;
          this.game.changeScene(
            () =>
              intro
                ? new CutsceneScene(
                    this.game,
                    this.input,
                    this.sfx,
                    intro,
                    () => new LevelScene(this.game, this.input, this.sfx, next),
                  )
                : new LevelScene(this.game, this.input, this.sfx, next),
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

    if (this.input.pausePressed()) {
      this.openPause();
      return;
    }
    this.card.update();

    // During the gate slam the player watches; control returns once locked in.
    const snap = level.arenaGates?.cinematic ? NO_INPUT : this.input.snapshot();
    if (snap.jumpPressed) this.sfx.ensure();
    player.update(level.map, snap);

    // Only a landing with real weight kicks dust. A low threshold puffs
    // smoke on every micro-landing while the hero stands on a slope.
    if (player.landImpact > 5) {
      this.fx.emitLandingDust(player.x, player.y + player.h, player.landImpact);
    }

    // The act announces itself the moment it is on screen (the constructor
    // runs behind the fade).
    if (this.frame === 1) this.sfx.play('title-card');
    // Sounds sit where they happen: left of the hero, right of him, on him.
    const panAt = (x: number) => Math.max(-1, Math.min(1, ((x - this.camera.x) / this.camera.w - 0.5) * 1.4));
    for (const ev of player.events) {
      // A soft landing is silent: the hero resettles on slopes constantly.
      if (ev !== 'land' || player.landImpact > 2) this.sfx.play(ev, { pan: panAt(player.x) });
      this.fx.onEvent(ev, player.x, player.y + 8);
      if (ev === 'hurt') this.input.rumble(0.7, 160);
    }
    for (const ev of level.update(player)) {
      // Effects — and sounds — belong to whatever caused them: the level
      // reports a position for entity events, boss events erupt at the boss,
      // and only what the hero actually did bursts out of the hero.
      const src = level.eventSources.get(ev);
      const atBoss = !src && ev.startsWith('boss') && level.boss;
      this.sfx.play(ev, { pan: panAt(src ? src.x : atBoss ? level.boss!.x : player.x) });
      this.hud.event(ev, level);
      if (ev === 'boss') this.laughIn = 44;
      if (ev === 'enemy' || ev === 'hopper-stomp') this.popups.push({ x: src?.x ?? player.x, y: (src?.y ?? player.y) - 12, text: '100', age: 0 });
      else if (ev === 'crystal') this.popups.push({ x: player.x, y: player.y - 24, text: '1000', age: 0 });
      this.fx.onEvent(
        ev,
        src ? src.x : atBoss ? level.boss!.x : player.x,
        src ? src.y : atBoss ? level.boss!.y + 18 : player.y,
      );
    }

    this.hud.update(level, player);
    this.updateMusic();
    if (level.boss && level.boss.phase === 'intro') this.bossIntroT++;
    if (this.laughIn > 0 && --this.laughIn === 0) this.sfx.play('yolk-laugh');
    for (const pp of this.popups) pp.age++;
    this.popups = this.popups.filter((pp) => pp.age < 40);

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

    // What the hero actually covered this step — the camera leads on that,
    // whatever moved him (running, a rail, a cart, a spring). A respawn is a
    // cut, not a velocity.
    const mx = player.x - this.prev.px;
    const my = player.y - this.prev.py;
    const cut = Math.abs(mx) > TELEPORT || Math.abs(my) > TELEPORT;
    const vx = cut ? 0 : mx;
    const vy = cut ? 0 : my;

    // Framing: pulled back to the arena for a boss, close on the hero otherwise.
    const fight = !!level.boss && !level.bossDefeated;
    const wantZoom = fight ? this.arenaZoom() : WORLD_ZOOM;
    const dz = wantZoom - this.zoom;
    if (Math.abs(dz) <= ZOOM_MIN_STEP) this.zoom = wantZoom;
    else this.zoom += Math.sign(dz) * Math.max(ZOOM_MIN_STEP, Math.abs(dz) * ZOOM_EASE);
    this.camera.resize(W / this.zoom, H / this.zoom);

    // Camera: locked during the boss fight, classic follow otherwise.
    if (fight) {
      const vw = this.camera.w;
      const cx = (level.arena.left + level.arena.right) / 2;
      const target = cx - vw / 2;
      this.camera.x += Math.max(-8, Math.min(8, target - this.camera.x));
      this.camera.update(player.x, player.y, 0, vy, level.map.pixelW, level.map.pixelH);
      this.camera.x = Math.max(level.arena.left - 80, Math.min(level.arena.right + 80 - vw, this.camera.x));
    } else {
      // Look up / down: only while standing still, so it never fights the
      // follow camera mid-run. Down doubles as the spin-dash charge posture,
      // which is fine — the glance and the charge are both "planted".
      const still = player.grounded && Math.abs(player.gsp) < 0.2;
      const look: -1 | 0 | 1 = !still ? 0 : snap.up ? -1 : snap.down ? 1 : 0;
      const riding = player.grounded || player.railing || player.carting;
      this.camera.update(player.x, player.y, vx, vy, level.map.pixelW, level.map.pixelH, look, riding);
      // Never show ground the player is no longer allowed to reach. Without
      // this the backtrack limit is a world-space slab that the camera happily
      // scrolls past, so it lands wherever the camera settled — an invisible
      // wall in mid-screen. Pinning the view to the limit makes the two the
      // same line: you stop at the left edge because the camera stopped, which
      // is how the classics read.
      this.camera.x = Math.max(this.camera.x, level.backLimitX - player.w);
    }
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    const { level, player, camera, prev } = this;
    // Between two simulation steps: the camera and the hero are drawn `alpha`
    // of the way from where they were to where they are. Everything else is
    // either fixed in the world (so it scrolls with the camera) or slow enough
    // that a 60 Hz position is indistinguishable.
    const cut = Math.abs(player.x - prev.px) > TELEPORT || Math.abs(player.y - prev.py) > TELEPORT;
    const k = cut ? 1 : alpha;
    const heroAt = { x: prev.px + (player.x - prev.px) * k, y: prev.py + (player.y - prev.py) * k };
    // The view in WORLD pixels: the frame divided by the zoom.
    const zoom = prev.zoom + (this.zoom - prev.zoom) * k;
    const VW = W / zoom;
    const VH = H / zoom;
    // Snap the camera to whole DEVICE pixels: pre-baked layers then blit 1:1
    // and the terrain never shimmers as it scrolls.
    const camX = snapWorld(prev.camX + (camera.x - prev.camX) * k, zoom);
    const camY = snapWorld(prev.camY + (camera.viewY - prev.camY) * k, zoom);
    const so = this.fx.shakeOffset(this.frame);
    so.x = snap(so.x);
    so.y = snap(so.y);

    // Layered parallax backdrop, re-baked if the window changed resolution.
    // It lives in screen space and scrolls with what the world covers ON
    // SCREEN — at the resting zoom whatever the camera is doing, and taken
    // from the point a zoom opens around, so a pull-back for a boss does not
    // drag the mountains sideways.
    const bgX = (camX + VW / 2) * WORLD_ZOOM - W / 2;
    const bgY = camY + (VH - H / WORLD_ZOOM) * camera.focus;
    this.backdrop = freshBackdrop(this.backdrop);
    drawBackdrop(ctx, this.backdrop, bgX, bgY, this.frame, this.animate, so.x, so.y);
    drawClouds(ctx, this.decor, this.frame, bgX, W, this.theme, this.animate);

    ctx.save();
    ctx.translate(so.x, so.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    // Loop annuli sit behind the terrain they are cut into.
    this.bakeLoops();
    for (const l of this.loopArts) {
      if (l.cx + l.r < camX || l.cx - l.r > camX + VW) continue;
      blit(ctx, l.art, l.cx - l.r, l.cy - l.r);
    }

    // Terrain: visible chunks, plus staged bakes ahead of the run.
    const dy = camera.viewY - prev.camY;
    this.terrain.draw(ctx, camX, camY, VW, VH, camera.x >= prev.camX ? 1 : -1, dy > 2 ? 1 : dy < -2 ? -1 : 0, this.frame - this.drawnFrame);
    this.drawnFrame = this.frame;

    // `m` is how far the thing reaches from its anchor: culled on the anchor
    // alone, anything wide (a pendulum on a nine-tile chain, a ledge, the
    // boss) blinks out while half of it is still on screen.
    const visible = (x: number, m = 40) => x > camX - m && x < camX + VW + m;

    // Living scenery: grass and flowers bending in the wind, torches
    // guttering, vents puffing, cogs turning.
    drawDecor(ctx, this.decor, this.frame, camX, VW, this.animate);

    for (const r of level.rails) {
      if (r.x1 > camX - 40 && r.x0 < camX + VW + 40) drawRail(ctx, r.x0, r.y0, r.x1, r.y1, this.frame);
    }
    for (const c of level.crumbles) {
      if (c.x + c.w > camX - 40 && c.x < camX + VW + 40) drawCrumble(ctx, c.x, c.y, c.w, c.state, c.shakeOffset, c.fallY, this.theme);
    }
    for (const pl of level.phasePlats) {
      if (pl.x + pl.w > camX - 40 && pl.x < camX + VW + 40) {
        const flipIn = pl.solid ? pl.onFrames - pl.t : pl.period - pl.t;
        drawPhasePlatform(ctx, pl.x, pl.y, pl.w, pl.solid, flipIn, this.frame);
      }
    }
    for (const wz of level.winds) {
      if (wz.x1 > camX - 40 && wz.x0 < camX + VW + 40) {
        drawWindZone(ctx, wz.x0, wz.y0, wz.x1, wz.y1, this.frame, this.animate);
      }
    }
    for (const g of level.gliders) {
      if (!g.taken && visible(g.x)) drawGliderPickup(ctx, g.x, g.y, this.frame);
    }
    // Quarter-pipe rims: the converting launcher at the lip must be visible,
    // or the launch reads as an invisible trigger on ordinary terrain.
    for (const qp of level.pipes) {
      if (visible(qp.x, 120)) drawQuarterPipe(ctx, qp.x, qp.baseY, qp.dir, this.frame, this.theme);
    }
    for (const st of level.stalactites) {
      if (visible(st.x)) {
        drawStalactite(ctx, st.x + st.shakeOffset, st.y, st.state, this.frame, st.timer, this.theme);
      }
    }
    for (const cart of level.carts) {
      // The TRACK renders first: a cart with no visible rail reads as flying,
      // and its crash reads as hitting thin air — unreadable, so unfair.
      if (cart.endX > camX - 40 && cart.startX < camX + VW + 40) {
        drawRail(ctx, cart.startX, cart.startY, cart.endX, cart.endY, this.frame);
      }
      if (visible(cart.endX, 72)) drawCartBuffer(ctx, cart.endX, cart.endY, this.frame);
      if (visible(cart.x, 72)) {
        const pitch = Math.atan2(cart.endY - cart.startY, cart.endX - cart.startX);
        drawMinecart(
          ctx,
          cart.x,
          cart.y,
          cart.state === 'running' ? 'riding' : cart.state,
          this.frame,
          pitch,
          cart.timer,
        );
      }
    }
    for (const hop of level.hoppers) {
      if (hop.alive && visible(hop.x)) {
        const charge = hop.coiled ? (hop.t % hop.period) / 45 : 0;
        drawHopper(ctx, hop.x, hop.y, hop.dir, hop.coiled, Math.min(1, charge), this.frame);
      }
    }
    for (const t of level.traps) {
      if (visible(t.x)) drawSpikeTrap(ctx, t.x, t.y, t.extension, t.phase === 'warning', this.frame);
    }
    for (const s of level.swings) {
      if (visible(s.pivotX, s.length + 40)) drawSwingBall(ctx, s.pivotX, s.pivotY, s.x, s.y, this.frame);
    }
    for (const d of level.dashPads) if (visible(d.x)) drawDashPad(ctx, d.x, d.y, d.dir, d.cooldown, this.frame);
    for (const bp of level.boardPads) if (visible(bp.x)) drawBoardPad(ctx, bp.x, bp.y, this.frame);
    for (const r of level.rings) if (!r.taken && visible(r.x)) drawRing(ctx, r.x, r.y, this.frame);
    for (const s of level.scattered) if (visible(s.x)) drawRing(ctx, s.x, s.y, this.frame);
    for (const c of level.crystals) if (!c.taken && visible(c.x)) drawCrystal(ctx, c.x, c.y, this.frame);
    for (const s of level.springs) if (visible(s.x)) drawSpring(ctx, s.x, s.y, s.cooldown, s.dir);
    for (const m of level.monitors) if (visible(m.x)) drawMonitor(ctx, m.x, m.y, m.kind, m.broken, this.frame);
    for (const s of level.spikes) if (visible(s.x)) drawSpikes(ctx, s.x, s.y);
    for (const c of level.checkpoints) if (visible(c.x)) drawCheckpoint(ctx, c.x, c.y, c.active, this.frame);
    for (const e of level.enemies) if (e.alive && visible(e.x)) drawSnapCrab(ctx, e.x, e.y, e.xsp, this.frame);
    for (const d of level.drones) if (d.alive && visible(d.x)) drawBuzzDrone(ctx, d.x, d.y, d.dir, this.frame);
    if (visible(level.goal.x, 80)) drawGoal(ctx, level.goal.x, level.goal.y, level.goal.spinning, this.frame, !!level.results);
    if (level.boss && visible(level.boss.x, 240)) drawBoss(ctx, level.boss, this.frame);

    // Speed afterimages trail behind the hero at high speed.
    const fast = Math.abs(player.gsp) > 7.5 || (player.shoes > 0 && Math.abs(player.gsp) > 5);
    const ghost = fast && !this.fx.reducedMotion && !player.dead ? (player.board ? PAL.board : player.shoes > 0 ? '#ffd94a' : '#5aa0ff') : null;
    this.hero.draw(ctx, player, this.frame, this.trail, ghost, heroAt);

    // Arena gates in front of the hero, so being sealed in reads clearly.
    const gates = level.arenaGates;
    if (gates && gates.closed > 0) {
      const h = BossArena.HEIGHT * gates.closed;
      drawBossGate(ctx, gates.leftX, gates.gateTop(), BossArena.WIDTH, h, this.frame);
      drawBossGate(ctx, gates.rightX, gates.gateTop(), BossArena.WIDTH, h, this.frame);
    }

    this.fx.render(ctx);
    for (const pp of this.popups) drawPopup(ctx, pp.x, pp.y, pp.text, pp.age);
    ctx.restore();

    // Screen-space juice: speed streaks, vignette, impact flash.
    this.fx.renderScreen(ctx, W, H, Math.abs(player.gsp), this.frame);

    // Boss intro: hazard bands and the boss's name, the "WARNING" beat.
    if (level.boss && level.boss.phase === 'intro') {
      const taunt = level.bossKind ? BOSS_TAUNTS[level.bossKind][level.bossRage ? 1 : 0] : '';
      this.drawBossIntro(ctx, level.boss.title, level.boss.subtitle, taunt);
    }

    if (!this.results) {
      this.hud.draw(ctx, level, player, this.frame, settings().preciseTimer);
      this.card.draw(ctx, !this.animate);
    }
    if (this.results) this.results.draw(ctx, this.input, this.frame);
    if (this.pause && !this.options) this.pause.render(ctx, this.input);
    if (this.options) this.options.render(ctx, this.input);
  }

  private bossIntroT = 0;

  private drawBossIntro(ctx: CanvasRenderingContext2D, title: string, subtitle: string, taunt: string): void {
    const t = this.bossIntroT;
    const k = Math.min(1, t / 14);
    const e = 1 - (1 - k) ** 3;
    ctx.save();
    // Two hazard bands closing in from the screen edges.
    for (const [y, dir] of [
      [58, 1],
      [104, -1],
    ] as const) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, y, W, 10);
      ctx.clip();
      ctx.fillStyle = 'rgba(10,6,10,0.85)';
      ctx.fillRect(0, y, W, 10);
      ctx.fillStyle = UI.danger;
      const off = ((this.animate ? t * 1.5 * dir : 0) % 20) - 20;
      for (let x = off; x < W + 20; x += 20) {
        slantPath(ctx, x, y, 10, 10, 1);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = e;
    drawText(ctx, title, W / 2, 92, { size: 18, fill: UI.gold, outline: UI.ink, outlineWidth: 3, align: 'center', shadow: { x: 0, y: 3, color: 'rgba(0,0,0,0.5)' } });
    drawText(ctx, subtitle, W / 2, 124, { size: 8, fill: '#ffd0d4', outline: UI.ink, align: 'center' });
    // His line lands a beat after his name, with the laugh.
    const q = Math.min(1, Math.max(0, (t - 40) / 12));
    if (taunt && q > 0) {
      ctx.globalAlpha = q;
      drawText(ctx, taunt, W / 2, 148 + (1 - q) * 6, { size: 6.5, fill: '#ffffff', outline: UI.ink, outlineWidth: 2, align: 'center' });
    }
    ctx.restore();
  }

  /** Loop annuli are baked at the render scale; re-bake when it changes. */
  private bakeLoops(): void {
    if (this.loopVersion === renderScaleVersion()) return;
    this.loopVersion = renderScaleVersion();
    this.loopArts = this.level.loops.map((l) => ({
      art: renderLoopArt(l, this.theme),
      cx: l.cx,
      cy: l.cy,
      r: l.outerR + 8,
    }));
  }
}
