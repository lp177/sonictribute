import type { Scene } from '../core/Game.ts';
import type { Game } from '../core/Game.ts';
import type { Input } from '../core/Input.ts';
import type { Sfx } from '../audio/sfx.ts';
import { speakerOf, type Cutscene, type Mood } from '../game/story.ts';
import type { LevelTheme } from '../game/Level.ts';
import { VIEW_W, VIEW_H } from '../core/view.ts';
import { prefersReducedMotion } from '../core/prefs.ts';
import { settings } from '../core/settings.ts';
import { buildBackdrop, drawBackdrop, freshBackdrop, type Backdrop } from '../render/backdrop.ts';
import { drawBoltPose } from '../render/hero.ts';
import { drawYolkPod, drawYolkBust, drawChronoCore, drawShard } from '../render/characters.ts';
import { drawText, proseFont, wrapLines } from '../render/font.ts';
import { UI, BIOME_UI, promptRow } from '../ui/theme.ts';

const W = VIEW_W;
const H = VIEW_H;
/** Frames before a fully-typed line advances on its own (keeps the pace up). */
const LINE_HOLD = 170;
/** Characters revealed per frame. */
const TYPE_RATE = 0.9;
const BAR = 34;
const GROUND = 262;
/** Where the shrine's pedestal stands, and where the pod hovers over it. */
const SHRINE_X = 320;
const HOVER_Y = 100;

/** Where each story beat is staged. */
const STAGE: Record<string, LevelTheme> = {
  'hour-of-dusk': 'verdant',
  'hour-of-midnight': 'gear',
  'hour-of-never': 'crystal',
  'hour-of-tomorrow': 'neon',
  ending: 'verdant',
};

const SHARD_COLORS = [BIOME_UI.verdant.main, BIOME_UI.gear.main, BIOME_UI.crystal.main, BIOME_UI.neon.main];

const ease = (t: number) => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;

/** Something that happens `at` frames into a line: a sound, a jolt, a flash. */
interface Cue {
  at: number;
  sfx?: string;
  /** Frames of screen shake. */
  shake?: number;
  /** Frames of white flash (lightning, the Core cracking). */
  flash?: number;
}

/**
 * The theft, line by line. This is the villain's ENTRANCE, so it is scored
 * and choreographed as one: the night goes dark before he is seen, he arrives
 * as a silhouette with lit goggles, the pod slams down on a thunderclap, and
 * he laughs — out loud — with the world's clock in his claw.
 */
const STEAL_CUES: Cue[][] = [
  [],
  [
    { at: 30, sfx: 'thunder', flash: 7 },
    { at: 64, sfx: 'yolk-sting' },
  ],
  [
    { at: 0, sfx: 'whoosh' },
    { at: 12, sfx: 'thunder', flash: 8, shake: 16 },
    { at: 58, sfx: 'beam' },
  ],
  [],
  [{ at: 2, sfx: 'yolk-laugh', shake: 30 }],
  [{ at: 4, sfx: 'core-crack', flash: 10, shake: 10 }],
  [{ at: 2, sfx: 'time-stop' }],
  [{ at: 112, sfx: 'whoosh' }],
  [{ at: 18, sfx: 'whoosh' }],
];

/**
 * Story beat between zones, staged per line: the illustration changes with
 * what is being said (the pod arrives, the Core cracks, the shards scatter,
 * BOLT bolts), and a line that belongs to Dr. Yolk gets a close-up — a
 * slanted cut-in with his bust acting the line out — and its sound.
 *
 * Skippable at two speeds: confirm finishes the line / advances, back skips
 * the whole scene (a replaying player should never sit through it). When the
 * last line ends we hand over to the next scene, which is constructed behind
 * the fade — the cutscene IS the loading screen.
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
  private backdrop: Backdrop;
  private theme: LevelTheme;
  private reduced = prefersReducedMotion();
  private lastBlip = 0;
  /** Cues of the current line already fired. */
  private cued = 0;
  private shake = 0;
  private flash = 0;
  private flashTotal = 1;
  /** 0..1: how far the close-up panel has slid in. */
  private closeUp = 0;
  /** The mood shown in the panel (kept while it slides back out). */
  private mood: Mood = 'grin';

  constructor(game: Game, input: Input, sfx: Sfx, story: Cutscene, next: () => Scene) {
    this.game = game;
    this.input = input;
    this.sfx = sfx;
    this.story = story;
    this.next = next;
    this.theme = STAGE[story.id] ?? 'verdant';
    this.backdrop = buildBackdrop(this.theme);
    input.setGameplayTouch(false);
    sfx.music.play(story.art === 'ending' ? 'ending' : 'story');
  }

  private get typed(): number {
    return Math.floor(this.lineFrame * TYPE_RATE);
  }

  private cues(): Cue[] {
    if (this.story.art === 'steal') return STEAL_CUES[this.line] ?? [];
    // Everywhere else Yolk only taunts: his laugh says so.
    const who = speakerOf(this.story, this.line);
    return who && who.mood !== 'sad' ? [{ at: 4, sfx: 'yolk-laugh' }] : [];
  }

  update(): void {
    this.frame++;
    this.lineFrame++;
    if (this.shake > 0) this.shake--;
    if (this.flash > 0) this.flash--;
    const speaker = speakerOf(this.story, this.line);
    if (speaker) this.mood = speaker.mood;
    this.closeUp = Math.max(0, Math.min(1, this.closeUp + (speaker && !this.done ? 0.1 : -0.16)));
    if (this.done) return;

    // Everything due by now, including what a skipped-ahead line jumped over.
    const cues = this.cues();
    while (this.cued < cues.length && cues[this.cued].at <= this.lineFrame) {
      const c = cues[this.cued++];
      if (c.sfx) this.sfx.play(c.sfx);
      if (c.shake) this.shake = c.shake;
      if (c.flash) {
        this.flash = c.flash;
        this.flashTotal = c.flash;
      }
    }

    const text = this.story.lines[this.line];
    const fullyTyped = this.typed >= text.length;
    if (!fullyTyped && this.typed - this.lastBlip >= 3 && text[this.typed] !== ' ') {
      this.lastBlip = this.typed;
      this.sfx.play('text-blip');
    }
    if (this.input.menuBack()) {
      this.finish();
      return;
    }
    const p = this.input.pointer;
    const advance = this.input.menuConfirm() || this.input.pausePressed() || p.released;
    if (advance) this.sfx.ensure();
    if (advance && !fullyTyped) {
      this.lineFrame = Math.ceil(text.length / TYPE_RATE); // first press: reveal the line
      return;
    }
    if (advance || this.lineFrame > text.length / TYPE_RATE + LINE_HOLD) {
      if (this.line + 1 < this.story.lines.length) {
        this.line++;
        this.lineFrame = 0;
        this.lastBlip = 0;
        this.cued = 0;
        this.sfx.play('ui-move');
      } else this.finish();
    }
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.sfx.music.stop(1);
    this.game.changeScene(this.next); // built behind the fade
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    const t = this.frame;
    this.backdrop = freshBackdrop(this.backdrop);
    const chase = this.story.art === 'chase';
    // The scroll runs on fractional frames, so it is smooth at any refresh rate.
    const scroll = this.reduced ? 0 : t + alpha;
    const camX = chase ? scroll * 7 : scroll * 0.25;
    drawBackdrop(ctx, this.backdrop, camX, 150, t, !this.reduced);

    ctx.save();
    if (this.shake > 0 && !this.reduced && settings().screenShake) {
      const m = Math.min(4, this.shake * 0.4);
      ctx.translate(Math.round(Math.sin(t * 2.3) * m), Math.round(Math.cos(t * 3.1) * m * 0.7));
    }
    switch (this.story.art) {
      case 'steal':
        this.drawSteal(ctx);
        break;
      case 'chase':
        this.drawChase(ctx, scroll);
        break;
      case 'ending':
        this.drawEnding(ctx);
        break;
    }
    ctx.restore();

    if (this.flash > 0 && settings().flashes) {
      ctx.fillStyle = `rgba(255,255,255,${0.75 * (this.flash / this.flashTotal)})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (this.closeUp > 0) this.drawCloseUp(ctx, this.story.art === 'steal' ? -1 : 1);

    // Letterbox bars slide in: this is a cinematic, not gameplay.
    const bar = BAR * ease(t / 20);
    ctx.fillStyle = '#05060c';
    ctx.fillRect(0, 0, W, bar);
    ctx.fillRect(0, H - bar - 46, W, bar + 46);
    const fade = ctx.createLinearGradient(0, H - bar - 86, 0, H - bar - 46);
    fade.addColorStop(0, 'rgba(5,6,12,0)');
    fade.addColorStop(1, 'rgba(5,6,12,1)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, H - bar - 86, W, 40);

    // Subtitle: the current line, typed out. A speaker's line wears his
    // colour and his name; a laugh shakes on the page.
    const text = this.story.lines[this.line];
    const speaker = speakerOf(this.story, this.line);
    const shown = text.slice(0, this.typed);
    ctx.font = proseFont(13, speaker ? 700 : 600, !!speaker);
    ctx.fillStyle = speaker ? '#ffd2b8' : '#f2f0ea';
    ctx.textAlign = 'center';
    const lines = wrapLines(shown, 520, (s) => ctx.measureText(s).width);
    const full = wrapLines(text, 520, (s) => ctx.measureText(s).width);
    const y0 = H - 66 - (full.length - 1) * 9;
    const jitter = speaker?.mood === 'laugh' && !this.reduced;
    lines.forEach((l, i) => {
      const jx = jitter ? Math.sin(t * 1.9 + i) * 1.2 : 0;
      const jy = jitter ? Math.cos(t * 2.7 + i) * 1.2 : 0;
      ctx.fillText(speaker ? `“${l}${i === lines.length - 1 && shown.length === text.length ? '”' : ''}` : l, W / 2 + jx, y0 + i * 18 + jy);
    });
    ctx.textAlign = 'left';
    if (speaker) {
      drawText(ctx, 'DR. YOLK', W / 2, y0 - 15, { size: 5.5, fill: UI.danger, outline: UI.ink, align: 'center', tracking: 1 });
    }

    // Progress pips and prompts.
    const n = this.story.lines.length;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i <= this.line ? UI.accent : 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(W / 2 - (n - 1) * 6 + i * 12, H - 26, i === this.line ? 2.6 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
    promptRow(ctx, this.input, W - 20, H - 24, [
      { action: 'confirm', label: 'NEXT' },
      { action: 'back', label: 'SKIP' },
    ], 'right', 6, 0.75);
  }

  /** Frames since the current line began, eased 0..1 over `d` frames. */
  private beat(d: number): number {
    return this.reduced ? 1 : ease(this.lineFrame / d);
  }

  /**
   * The villain's close-up: a slanted cut-in panel, arcade style, that slides
   * in from `side` (-1 left, 1 right) with his bust acting the line out over
   * a burst of speed lines.
   */
  private drawCloseUp(ctx: CanvasRenderingContext2D, side: -1 | 1): void {
    const t = this.frame;
    const k = this.reduced ? (this.closeUp > 0.5 ? 1 : 0) : ease(this.closeUp);
    if (k <= 0) return;
    const pw = 224;
    const ph = 168;
    const x0 = (side < 0 ? 26 : W - 26 - pw) + side * (1 - k) * (pw + 60);
    const y0 = 52;
    const lean = 26 * side;
    const shape = () => {
      ctx.beginPath();
      ctx.moveTo(x0 + Math.max(0, lean), y0);
      ctx.lineTo(x0 + pw + Math.min(0, lean), y0);
      ctx.lineTo(x0 + pw - Math.max(0, lean), y0 + ph);
      ctx.lineTo(x0 - Math.min(0, lean), y0 + ph);
      ctx.closePath();
    };
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 1.4);
    shape();
    ctx.save();
    ctx.clip();
    const bg = ctx.createLinearGradient(0, y0, 0, y0 + ph);
    bg.addColorStop(0, '#2a0716');
    bg.addColorStop(1, '#6b1126');
    ctx.fillStyle = bg;
    ctx.fillRect(x0 - 30, y0, pw + 60, ph);
    // Speed lines fanning out from behind him.
    const cx = x0 + pw / 2;
    const cy = y0 + ph * 0.6;
    ctx.fillStyle = 'rgba(255,90,110,0.20)';
    const spin = this.reduced ? 0 : t / 70;
    for (let i = 0; i < 18; i++) {
      const a = spin + (i / 18) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a - 0.06) * 320, cy + Math.sin(a - 0.06) * 320);
      ctx.lineTo(cx + Math.cos(a + 0.06) * 320, cy + Math.sin(a + 0.06) * 320);
      ctx.closePath();
      ctx.fill();
    }
    const halo = ctx.createRadialGradient(cx, cy - 20, 10, cx, cy - 20, 130);
    halo.addColorStop(0, 'rgba(255,170,120,0.35)');
    halo.addColorStop(1, 'rgba(255,120,90,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x0 - 30, y0, pw + 60, ph);
    drawYolkBust(ctx, cx, y0 + ph - 76, 3, this.reduced ? 0 : t, this.mood);
    ctx.restore();
    shape();
    ctx.lineWidth = 3;
    ctx.strokeStyle = UI.ink;
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = UI.danger;
    ctx.stroke();
    ctx.restore();
  }

  /* --------------------------------- Stages -------------------------------- */

  private ground(ctx: CanvasRenderingContext2D, scroll: number): void {
    const c = BIOME_UI[this.theme];
    ctx.fillStyle = '#0b0a16';
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = c.deep;
    ctx.fillRect(0, GROUND, W, 5);
    ctx.fillStyle = c.main;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(0, GROUND, W, 1.5);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 12; i++) {
      const x = ((i * 97 - scroll) % (W + 80) + W + 80) % (W + 80) - 40;
      ctx.fillRect(x, GROUND + 12 + (i % 4) * 9, 30 + (i % 3) * 14, 1.5);
    }
  }

  /** A fork of lightning from the top of the frame down to (x, y). */
  private lightning(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number): void {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let px = x + 70;
    ctx.moveTo(px, 0);
    const steps = 7;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      px = x + 70 * (1 - k) + Math.sin(seed * 12.9 + i * 4.7) * 22 * (1 - k);
      ctx.lineTo(px, y * k);
    }
    ctx.strokeStyle = 'rgba(190,225,255,0.5)';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  /** The pod as the shrine first sees it: a black shape with lit goggles. */
  private podSilhouette(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
    const t = this.frame;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    // Searchlight, sweeping the ground for what he came for.
    const sweep = this.reduced ? 0 : Math.sin(t / 26) * 0.35;
    const beam = ctx.createLinearGradient(0, 14, 0, 190);
    beam.addColorStop(0, 'rgba(160,235,255,0.26)');
    beam.addColorStop(1, 'rgba(160,235,255,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(-5, 14);
    ctx.lineTo(5, 14);
    ctx.lineTo(Math.sin(sweep) * 190 + 46, 190);
    ctx.lineTo(Math.sin(sweep) * 190 - 46, 190);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#04040a';
    ctx.beginPath();
    ctx.moveTo(-28, -2);
    ctx.quadraticCurveTo(-28, 18, 0, 18);
    ctx.quadraticCurveTo(28, 18, 28, -2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-24, -2);
    ctx.quadraticCurveTo(-24, -34, 0, -34);
    ctx.quadraticCurveTo(24, -34, 24, -2);
    ctx.closePath();
    ctx.fill();
    // Two lit lenses: all of him you can see, and all you need to.
    for (const gx of [-5, 5]) {
      const glow = ctx.createRadialGradient(gx, -14.5, 0.5, gx, -14.5, 9);
      glow.addColorStop(0, 'rgba(140,245,255,0.95)');
      glow.addColorStop(1, 'rgba(140,245,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(gx - 9, -23.5, 18, 18);
      ctx.fillStyle = '#e8fdff';
      ctx.beginPath();
      ctx.ellipse(gx, -14.5, 2.6, 1.3, gx < 0 ? 0.3 : -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawSteal(ctx: CanvasRenderingContext2D): void {
    const t = this.frame;
    const L = this.line;
    const f = this.lineFrame;
    const px = SHRINE_X;

    // The night closes in before he is seen, and lifts only when time stops.
    const dark = L === 0 ? 0.28 : L === 1 ? 0.28 + 0.3 * this.beat(120) : L <= 5 ? 0.55 : 0.18;
    ctx.fillStyle = `rgba(6,4,20,${dark})`;
    ctx.fillRect(0, 0, W, H);
    if ((L === 1 && f >= 30 && f < 38) || (L === 2 && f >= 12 && f < 19)) this.lightning(ctx, px, L === 1 ? 150 : HOVER_Y - 50, L);
    this.ground(ctx, 0);

    // Pedestal.
    ctx.fillStyle = '#1d1a33';
    ctx.beginPath();
    ctx.moveTo(px - 30, GROUND);
    ctx.lineTo(px - 20, GROUND - 40);
    ctx.lineTo(px + 20, GROUND - 40);
    ctx.lineTo(px + 30, GROUND);
    ctx.fill();
    ctx.fillStyle = '#2c2850';
    ctx.fillRect(px - 26, GROUND - 46, 52, 8);

    // The pod. Line 1: a silhouette sinking out of the storm. Line 2: it
    // drops the last stretch like a hammer. Line 7: he leaves, in no hurry
    // at all — until the afterburner.
    const bob = this.reduced ? 0 : Math.sin(t / 20) * 3;
    let podX = px;
    let podY = -80;
    let lit = true;
    let tilt = 0;
    if (L === 1) {
      podY = -70 + 138 * this.beat(150);
      lit = false;
    } else if (L === 2) {
      const k = Math.min(1, f / 12);
      podY = 68 + (HOVER_Y - 68) * (this.reduced ? 1 : 1 - (1 - k) ** 2) + (f > 12 && f < 26 ? Math.sin((f - 12) * 0.9) * (26 - f) * 0.5 : 0);
      lit = f >= 12;
    } else if (L >= 3 && L <= 6) {
      podY = HOVER_Y + bob;
      // The laugh rocks the whole machine.
      if (L === 4 && !this.reduced) tilt = Math.sin(f * 0.45) * 0.09;
    } else if (L === 7) {
      const go = Math.max(0, f - 112);
      podX = px + go * go * 0.11;
      podY = HOVER_Y + bob - go * 1.3;
      tilt = -Math.min(0.35, go * 0.02);
    }
    const podShown = L >= 1 && L <= 7 && podX < W + 80;

    // The Core: ticking on its pedestal, hauled up the beam, held and gloated
    // over — then cracked.
    const held = L >= 3 && L <= 4;
    const rising = L === 2 && f > 58;
    let coreY = GROUND - 62;
    if (rising) coreY = GROUND - 62 - (GROUND - 62 - (HOVER_Y + 50)) * ease((f - 58) / 70);
    if (rising && podShown) {
      const beam = ctx.createLinearGradient(0, podY + 20, 0, GROUND - 50);
      beam.addColorStop(0, 'rgba(255,230,140,0.45)');
      beam.addColorStop(1, 'rgba(255,230,140,0.04)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(px - 14, podY + 20);
      ctx.lineTo(px + 14, podY + 20);
      ctx.lineTo(px + 34, GROUND - 46);
      ctx.lineTo(px - 34, GROUND - 46);
      ctx.closePath();
      ctx.fill();
    }
    if (L <= 2) drawChronoCore(ctx, px, coreY, 13, t, 0);

    if (podShown) {
      if (!lit) this.podSilhouette(ctx, podX, podY, 1.7);
      else {
        ctx.save();
        ctx.translate(podX, podY);
        ctx.rotate(tilt);
        drawYolkPod(ctx, 0, 0, 1.7, t, {
          flame: true,
          holding: held ? 'core' : null,
          dir: L === 7 && f > 112 ? 1 : 1,
          mood: L === 4 ? 'laugh' : L === 2 ? 'scheme' : L === 3 ? 'gloat' : 'grin',
        });
        ctx.restore();
      }
    }

    // Line 5: the Core cracks; four shards burst out toward the four hours
    // and are gone — off the frame, into the campaign.
    if (L === 5) {
      const k = this.beat(90);
      const cy = HOVER_Y + 52;
      if (f < 26) drawChronoCore(ctx, px + 2, cy, 13 * (1 + f * 0.012), t, 1);
      SHARD_COLORS.forEach((col, i) => {
        const a = -Math.PI / 2 + (i - 1.5) * 0.75;
        const d = 30 + 430 * k;
        drawShard(ctx, px + Math.cos(a) * d, cy + Math.sin(a) * d * 0.55, 1.6, t + i * 9, col);
      });
    }

    // Line 6: the hour stops — a frozen clock face over the sky.
    if (L === 6) {
      const k = this.beat(40);
      ctx.save();
      ctx.globalAlpha = 0.35 * k;
      ctx.strokeStyle = '#ffe9b0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(W / 2, 120, 70, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(W / 2, 120);
      ctx.lineTo(W / 2 + 34, 120 - 20);
      ctx.moveTo(W / 2, 120);
      ctx.lineTo(W / 2, 120 - 52);
      ctx.stroke();
      ctx.restore();
      // Birds parked mid-air.
      ctx.fillStyle = '#140c22';
      for (const [bx, by] of [
        [140, 90],
        [170, 104],
        [470, 70],
        [500, 86],
      ]) {
        ctx.beginPath();
        ctx.moveTo(bx - 7, by);
        ctx.quadraticCurveTo(bx - 3, by - 4, bx, by);
        ctx.quadraticCurveTo(bx + 3, by - 4, bx + 7, by);
        ctx.quadraticCurveTo(bx, by - 1, bx - 7, by);
        ctx.fill();
      }
    }

    // Line 8: BOLT arrives — and goes.
    if (L >= 8) {
      const k = this.beat(80);
      const hx = -60 + 300 * Math.min(1, k * 1.6) + (k > 0.62 ? (k - 0.62) * 900 : 0);
      drawBoltPose(ctx, hx, GROUND, 2, t, 'sprint', 'steal');
    }
  }

  private drawChase(ctx: CanvasRenderingContext2D, scroll: number): void {
    const t = this.frame;
    this.ground(ctx, scroll * 9);
    const k = this.beat(50);
    const speaker = speakerOf(this.story, this.line);
    // Yolk flees ahead with the shard he took; BOLT gains on him. When he
    // turns to taunt, the pod swings round to face the fox.
    const px = 470 + Math.sin(t / 50) * 14;
    const py = 112 + Math.sin(t / 37) * 9;
    drawYolkPod(ctx, px, py, 1.5, t, {
      flame: true,
      holding: 'shard',
      dir: speaker ? -1 : 1,
      mood: speaker ? speaker.mood : 'scowl',
    });
    const hx = 150 + this.line * 14 + Math.sin(t / 30) * 10 - (1 - k) * 30;
    drawBoltPose(ctx, hx, GROUND, 2.1, t, this.reduced ? 'idle' : 'sprint', 'chase');
    if (!this.reduced) {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) {
        const y = 60 + i * 28;
        const x = W - (((scroll * (10 + i * 3)) + i * 113) % (W + 200));
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 50 + (i % 3) * 20, y);
        ctx.stroke();
      }
    }
  }

  private drawEnding(ctx: CanvasRenderingContext2D): void {
    const t = this.frame;
    const L = this.line;
    // Morning finally arrives: warm light rises line by line.
    const dawn = Math.min(1, (L + this.beat(120)) / 4);
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, `rgba(120,190,255,${0.25 * dawn})`);
    g.addColorStop(1, `rgba(255,220,150,${0.35 * dawn})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GROUND);
    this.ground(ctx, 0);

    // BOLT stands still for once.
    drawBoltPose(ctx, 300, GROUND, 2.2, t, 'idle', 'ending');
    // The Core, whole again, floating over him with its shards homing in.
    const cy = 150 + Math.sin(t / 25) * 3;
    const merge = L === 0 ? this.beat(100) : 1;
    drawChronoCore(ctx, 300, cy, 15, t, 0);
    SHARD_COLORS.forEach((col, i) => {
      const a = t / 40 + (i / 4) * Math.PI * 2;
      const r = 40 * (1 - merge) + 26;
      if (merge < 1 || L < 2) drawShard(ctx, 300 + Math.cos(a) * r, cy + Math.sin(a) * r * 0.45, 1.1, t, col);
    });
    // Line 3: his last word. Line 4: he sputters off into next week.
    if (L === 3) {
      drawYolkPod(ctx, 520, 96 + Math.sin(t / 6) * 3, 1.1, t, { flame: t % 6 < 4, sad: true, dir: -1 });
    } else if (L >= 4) {
      const k = L === 4 ? this.beat(220) : 1;
      drawYolkPod(ctx, 520 + k * 160, 96 - k * 80 + Math.sin(t / 6) * 3, 1.1 - k * 0.2, t, { flame: t % 6 < 4, sad: true, dir: 1 });
    }
  }
}
