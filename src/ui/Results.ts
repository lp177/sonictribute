/**
 * Act-clear results: the payoff screen.
 *
 * The old one was a static table ("TIME BONUS 3000") over a dark wash, with
 * the bonuses already added up and achievements as a list of sentences. The
 * classic games make this a little ceremony — the bonuses count down INTO
 * the score with a ticking sound — and that ceremony is most of what makes
 * finishing an act feel good. So: header sweep, rows that land one by one, a
 * count-up tally, then a rank stamp (S..D, see Score.computeRank) and "NEW
 * BEST" flags against the saved record.
 *
 * It never holds the player hostage: the first confirm skips straight to the
 * final numbers, the second continues. Tap, click, key or pad all work.
 */
import type { Input } from '../core/Input.ts';
import type { LevelTheme } from '../game/Level.ts';
import type { ActBest } from '../game/progress.ts';
import { timeBonus, ringBonus, computeAchievements, computeRank, betterRank, type LevelStats, type Rank, type Achievement } from '../game/Score.ts';
import { drawText } from '../render/font.ts';
import { VIEW_W, VIEW_H } from '../core/view.ts';
import { BIOME_UI, UI, slantPath, promptRow } from './theme.ts';
import { fmtTime, ringIcon } from './Hud.ts';

const ROW_START = 26;
const ROW_STEP = 7;
const ROWS = 5;
const TALLY_START = ROW_START + ROW_STEP * ROWS + 10;

const ease = (t: number) => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;

const RANK_COLOR: Record<Rank, string> = {
  S: '#ffd94a',
  A: '#4be1ff',
  B: '#7cf29a',
  C: '#c9b6ff',
  D: '#a8adc4',
};

export interface ResultsInfo {
  actLabel: string;
  theme: LevelTheme;
  best: ActBest | null;
  /** Score before bonuses (enemies, rings, monitors, crystals...). */
  score: number;
}

export class Results {
  readonly stats: LevelStats;
  readonly timeBonus: number;
  readonly ringBonus: number;
  readonly total: number;
  readonly rank: Rank;
  readonly achievements: Achievement[];
  readonly newBestTime: boolean;
  readonly newBestRank: boolean;
  private info: ResultsInfo;
  private t = 0;
  /** Bonus points not yet counted into the shown total. */
  private pendingTime: number;
  private pendingRing: number;
  private shownTotal: number;
  private tallyDone = false;
  private stamped = false;

  constructor(stats: LevelStats, info: ResultsInfo) {
    this.stats = stats;
    this.info = info;
    this.timeBonus = timeBonus(stats.timeFrames);
    this.ringBonus = ringBonus(stats.ringsHeld);
    this.total = info.score + this.timeBonus + this.ringBonus;
    this.rank = computeRank(stats).rank;
    this.achievements = computeAchievements(stats);
    this.pendingTime = this.timeBonus;
    this.pendingRing = this.ringBonus;
    this.shownTotal = info.score;
    this.newBestTime = !!info.best && stats.timeFrames < info.best.timeFrames;
    this.newBestRank = !!info.best && betterRank(this.rank, info.best.rank);
  }

  /** True once everything is shown (the next confirm continues). */
  get settled(): boolean {
    return this.stamped;
  }

  /**
   * Advances the ceremony. Returns sound events to play and whether the
   * player asked to continue.
   */
  update(input: Input): { events: string[]; next: boolean } {
    const events: string[] = [];
    this.t++;
    const pressed = input.menuConfirm() || input.pausePressed() || input.pointer.released;
    if (pressed) {
      if (this.stamped && this.t > 20) return { events, next: true };
      // Skip to the end of the ceremony.
      this.t = Math.max(this.t, TALLY_START);
      if (this.pendingTime || this.pendingRing) events.push('tally-end');
      this.pendingTime = 0;
      this.pendingRing = 0;
      this.shownTotal = this.total;
      this.tallyDone = true;
    }
    if (this.t === 4) events.push('title-card');
    if (this.t > ROW_START && this.t <= ROW_START + ROW_STEP * ROWS && (this.t - ROW_START) % ROW_STEP === 0) events.push('ui-move');
    if (this.t >= TALLY_START && !this.tallyDone) {
      const step = Math.max(100, Math.ceil((this.timeBonus + this.ringBonus) / 70 / 100) * 100);
      const take = (v: number) => Math.min(v, step);
      if (this.pendingTime > 0) {
        const d = take(this.pendingTime);
        this.pendingTime -= d;
        this.shownTotal += d;
      } else if (this.pendingRing > 0) {
        const d = take(this.pendingRing);
        this.pendingRing -= d;
        this.shownTotal += d;
      }
      if (this.t % 4 === 0) events.push('tally');
      if (this.pendingTime === 0 && this.pendingRing === 0) {
        this.tallyDone = true;
        this.shownTotal = this.total;
        events.push('tally-end');
        this.tSettle = this.t;
      }
    }
    if (this.tallyDone && !this.stamped && this.t >= this.tSettle + 14) {
      this.stamped = true;
      this.tStamp = this.t;
      events.push('rank');
    }
    return { events, next: false };
  }

  private tSettle = TALLY_START;
  private tStamp = 0;

  draw(ctx: CanvasRenderingContext2D, input: Input, frame: number): void {
    const c = BIOME_UI[this.info.theme];
    const t = this.t;
    ctx.save();
    ctx.fillStyle = `rgba(6,7,14,${0.62 * ease(t / 14)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Header band.
    const e = ease(t / 16);
    const bx = -420 + 440 * e;
    const g = ctx.createLinearGradient(0, 30, 0, 86);
    g.addColorStop(0, c.main);
    g.addColorStop(1, c.deep);
    ctx.fillStyle = g;
    slantPath(ctx, bx, 32, 400, 52, 0.5);
    ctx.fill();
    drawText(ctx, 'BOLT GOT THROUGH', bx + 40, 50, { size: 8, fill: '#ffffff', outline: UI.ink, outlineWidth: 1.8 });
    drawText(ctx, `${this.info.actLabel} CLEAR!`, bx + 40, 76, {
      size: 20,
      fill: '#ffffff',
      outline: UI.ink,
      outlineWidth: 3,
      shadow: { x: 2, y: 3, color: 'rgba(0,0,0,0.35)' },
    });

    // Rows.
    const s = this.stats;
    const lx = 150;
    const rx = 380;
    const rows: { label: string; value: string; color?: string; extra?: () => void; best?: boolean }[] = [
      { label: 'TIME', value: fmtTime(s.timeFrames), best: this.newBestTime },
      { label: 'TIME BONUS', value: String(this.pendingTime), color: UI.gold },
      { label: 'RING BONUS', value: String(this.pendingRing), color: UI.gold },
      { label: 'CHRONO CRYSTALS', value: `${s.crystalsFound}/${s.crystalsTotal}`, color: '#8ff0ff' },
      { label: 'SECRET ROOMS', value: `${s.secretsFound}/${s.secretsTotal}` },
    ];
    rows.forEach((r, i) => {
      const at = ROW_START + i * ROW_STEP;
      const k = ease((t - at) / 8);
      if (k <= 0) return;
      const y = 112 + i * 19;
      ctx.save();
      ctx.globalAlpha = k;
      ctx.translate((1 - k) * 30, 0);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)';
      slantPath(ctx, lx - 14, y - 12, rx - lx + 28, 16);
      ctx.fill();
      drawText(ctx, r.label, lx, y, { size: 8, fill: UI.gold, outline: UI.ink, outlineWidth: 1.6 });
      drawText(ctx, r.value, rx, y, { size: 9, fill: r.color ?? '#ffffff', outline: UI.ink, outlineWidth: 1.8, align: 'right' });
      if (i === 2) ringIcon(ctx, lx - 22, y - 4, 5, frame);
      if (r.best) drawText(ctx, 'NEW BEST', rx + 12, y, { size: 6, fill: UI.danger, outline: UI.ink, alpha: 0.6 + 0.4 * Math.sin(frame / 6) });
      ctx.restore();
    });

    // Total.
    const kt = ease((t - (ROW_START + ROW_STEP * ROWS)) / 8);
    if (kt > 0) {
      ctx.save();
      ctx.globalAlpha = kt;
      const y = 222;
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      slantPath(ctx, lx - 14, y - 15, rx - lx + 28, 20);
      ctx.fill();
      drawText(ctx, 'TOTAL', lx, y, { size: 10, fill: '#ffffff', outline: UI.ink, outlineWidth: 2 });
      drawText(ctx, String(this.shownTotal), rx, y, { size: 12, fill: '#ffffff', outline: UI.ink, outlineWidth: 2.2, align: 'right' });
      ctx.restore();
    }

    // Rank stamp.
    if (this.stamped) {
      const st = t - this.tStamp;
      const k = ease(st / 10);
      const scale = 2.2 - 1.2 * k;
      const col = RANK_COLOR[this.rank];
      ctx.save();
      ctx.translate(500, 168);
      ctx.rotate(-0.12);
      ctx.scale(scale, scale);
      ctx.globalAlpha = Math.min(1, st / 4);
      ctx.fillStyle = UI.ink;
      ctx.beginPath();
      ctx.arc(0, 0, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 33, 0, Math.PI * 2);
      ctx.stroke();
      drawText(ctx, 'RANK', 0, -16, { size: 6, fill: col, align: 'center', italic: false });
      drawText(ctx, this.rank, 2, 20, { size: 34, fill: col, outline: UI.ink, outlineWidth: 2, align: 'center' });
      ctx.restore();
      if (this.newBestRank) {
        drawText(ctx, 'NEW BEST RANK', 500, 226, { size: 6.5, fill: UI.danger, outline: UI.ink, align: 'center', alpha: 0.6 + 0.4 * Math.sin(frame / 6) });
      }

      // Achievements as badges.
      const ka = ease((st - 8) / 10);
      if (ka > 0 && this.achievements.length) {
        ctx.save();
        ctx.globalAlpha = ka;
        const names = this.achievements.map((a) => a.label.split(' — ')[0].toUpperCase());
        let x = VIEW_W / 2 - (names.length * 104) / 2;
        for (const n of names) {
          ctx.fillStyle = 'rgba(255,217,74,0.14)';
          slantPath(ctx, x, 246, 98, 18);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,217,74,0.6)';
          ctx.lineWidth = 1;
          ctx.stroke();
          drawText(ctx, `★ ${n}`, x + 49, 258.5, { size: 6.5, fill: UI.gold, outline: UI.ink, align: 'center' });
          x += 104;
        }
        ctx.restore();
      }

      if (st > 20) {
        promptRow(ctx, input, VIEW_W / 2, 326, [{ action: 'confirm', label: 'CONTINUE' }], 'center', 7, 0.7 + 0.3 * Math.sin(frame / 10));
      }
    } else if (t > 30) {
      promptRow(ctx, input, VIEW_W / 2, 326, [{ action: 'confirm', label: 'SKIP' }], 'center', 7, 0.6);
    }
    ctx.restore();
  }
}
