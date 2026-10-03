/**
 * In-play HUD.
 *
 * The old HUD was a 190x58 dark card of monospace labels parked over the top
 * left of the playfield — a debug readout, and an opaque one: it hid the
 * route above the hero on every sky lane. This one has no box at all. Every
 * element is outlined BOLT Display text or an icon, legible over any
 * background, and ordered by what the player checks most:
 *
 *   RINGS  — biggest, with a live ring icon; flashes red at zero (one more
 *            hit is a death) and bumps when it rises.
 *   TIME   — the clock, tabular so it does not jitter.
 *   SCORE  — rolls up instead of jumping.
 *   crystals — five slots, filled as found: the exploration goal is always
 *            on screen, not discovered at the results.
 *
 * Power-ups (shield, speed shoes with a draining bar) sit beside the rings.
 * The boss bar is segmented — one pip per hit left — because "two more
 * hits" is what a player wants to know, not a percentage.
 * Short toasts confirm the moments the player cannot otherwise see
 * registered: checkpoint, secret room, crystal n/5.
 */
import type { Level } from '../game/Level.ts';
import type { Player } from '../game/Player.ts';
import { drawText } from '../render/font.ts';
import { VIEW_W } from '../core/view.ts';
import { UI, slantPath } from './theme.ts';

const TAU = Math.PI * 2;
const GOLD = '#ffd94a';

export function fmtTime(frames: number, precise = true): string {
  const m = Math.floor(frames / 3600);
  const s = Math.floor((frames % 3600) / 60);
  if (!precise) return `${m}:${String(s).padStart(2, '0')}`;
  const c = Math.floor(((frames % 60) * 100) / 60);
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

interface Toast {
  text: string;
  color: string;
  t: number;
}

const TOAST_LIFE = 110;

export class Hud {
  private shownScore = 0;
  private lastRings = 0;
  private ringBump = 0;
  private toasts: Toast[] = [];
  private crystalFlash: number[] = [];

  /** Reacts to a level event with a toast where the moment needs confirming. */
  event(ev: string, level: Level): void {
    if (ev === 'checkpoint') this.toast('CHECKPOINT', UI.accent);
    else if (ev === 'secret') this.toast('SECRET ROOM FOUND!', GOLD);
    else if (ev === 'crystal') {
      const n = level.crystals.filter((c) => c.taken).length;
      this.toast(`CHRONO CRYSTAL ${n}/${level.crystals.length}`, '#8ff0ff');
      this.crystalFlash[n - 1] = 40;
    } else if (ev === 'shield') this.toast('SHIELD', '#7fc4ff');
    else if (ev === 'shoes') this.toast('SPEED SHOES', GOLD);
  }

  toast(text: string, color: string): void {
    this.toasts = this.toasts.filter((t) => t.text !== text);
    this.toasts.push({ text, color, t: 0 });
    if (this.toasts.length > 2) this.toasts.shift();
  }

  update(level: Level, p: Player): void {
    // Score rolls toward the real value: fast for big jumps, never stalls.
    const gap = level.score - this.shownScore;
    if (gap > 0) this.shownScore += Math.max(1, Math.ceil(gap * 0.18));
    else this.shownScore = level.score;
    if (p.rings > this.lastRings) this.ringBump = 10;
    this.lastRings = p.rings;
    if (this.ringBump > 0) this.ringBump--;
    for (const t of this.toasts) t.t++;
    this.toasts = this.toasts.filter((t) => t.t < TOAST_LIFE);
    this.crystalFlash = this.crystalFlash.map((f) => Math.max(0, (f ?? 0) - 1));
  }

  draw(ctx: CanvasRenderingContext2D, level: Level, p: Player, frame: number, precise = true): void {
    ctx.save();
    const x = 14;

    // --- Rings ---
    const zero = p.rings === 0;
    const alarm = zero && Math.floor(frame / 16) % 2 === 0;
    ringIcon(ctx, x + 9, 22, 8.5, frame);
    const bump = 1 + (this.ringBump / 10) * 0.22;
    ctx.save();
    ctx.translate(x + 22, 29);
    ctx.scale(bump, bump);
    drawText(ctx, String(p.rings).padStart(3, '0'), 0, 0, {
      size: 15,
      fill: alarm ? UI.danger : '#ffffff',
      outline: UI.ink,
      outlineWidth: 2.4,
      shadow: { x: 0, y: 2, color: 'rgba(0,0,0,0.35)' },
    });
    ctx.restore();

    // Power-ups beside the ring count.
    let px = x + 90;
    if (p.shield) {
      shieldIcon(ctx, px, 22, frame);
      px += 20;
    }
    if (p.shoes > 0) {
      shoesIcon(ctx, px, 22);
      const f = Math.min(1, p.shoes / 1200);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(px - 8, 32, 16, 3);
      ctx.fillStyle = GOLD;
      ctx.fillRect(px - 8, 32, 16 * f, 3);
      px += 20;
    }

    // --- Time & score: yellow labels, white figures (the classic read) ---
    const label = (text: string, y: number) => drawText(ctx, text, x, y, { size: 6.5, fill: GOLD, outline: UI.ink, outlineWidth: 1.6 });
    const value = (text: string, y: number) =>
      drawText(ctx, text, x + 38, y, { size: 8.5, fill: '#ffffff', outline: UI.ink, outlineWidth: 1.8 });
    label('TIME', 48);
    value(fmtTime(level.timeFrames, precise), 48.5);
    label('SCORE', 62);
    value(String(this.shownScore).padStart(7, '0'), 62.5);

    // --- Chrono crystals ---
    const found = level.crystals.filter((c) => c.taken).length;
    for (let i = 0; i < level.crystals.length; i++) {
      gem(ctx, x + 6 + i * 13, 76, i < found, this.crystalFlash[i] ?? 0);
    }

    // --- Boss ---
    const boss = level.boss;
    if (boss && !level.bossDefeated && boss.phase !== 'intro') {
      const cx = VIEW_W / 2;
      const pips = boss.maxHp;
      const pw = 14;
      const total = pips * (pw + 3) - 3;
      drawText(ctx, boss.title, cx, 20, { size: 7, fill: '#ffd0d4', outline: UI.ink, align: 'center' });
      for (let i = 0; i < pips; i++) {
        const lit = i < boss.hp;
        const bx = cx - total / 2 + i * (pw + 3);
        ctx.fillStyle = UI.ink;
        slantPath(ctx, bx - 1, 25, pw + 2, 9);
        ctx.fill();
        ctx.fillStyle = lit ? UI.danger : 'rgba(255,255,255,0.10)';
        slantPath(ctx, bx, 26, pw, 7);
        ctx.fill();
        if (lit) {
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          slantPath(ctx, bx + 1, 26.5, pw - 2, 2);
          ctx.fill();
        }
      }
    }

    // --- Toasts ---
    this.toasts.forEach((t, i) => {
      const inT = Math.min(1, t.t / 8);
      const outT = Math.min(1, (TOAST_LIFE - t.t) / 14);
      const a = Math.min(inT, outT);
      const y = 58 + i * 18 - (1 - inT) * 8;
      drawText(ctx, t.text, VIEW_W / 2, y, {
        size: 9,
        fill: t.color,
        outline: UI.ink,
        outlineWidth: 2,
        align: 'center',
        alpha: a,
        shadow: { x: 0, y: 2, color: 'rgba(0,0,0,0.4)' },
      });
    });
    ctx.restore();
  }
}

/* --------------------------------- Icons ---------------------------------- */

/** The HUD ring: a fat gold torus with a sliding glint (it never stops). */
export function ringIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, frame: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = r * 0.62;
  ctx.strokeStyle = UI.ink;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, 0, TAU);
  ctx.lineWidth = r * 0.62 + 3;
  ctx.stroke();
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, '#fff6c0');
  g.addColorStop(0.45, '#ffd94a');
  g.addColorStop(1, '#c98a12');
  ctx.strokeStyle = g;
  ctx.lineWidth = r * 0.62;
  ctx.stroke();
  const a = (frame / 24) % TAU;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = r * 0.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, a, a + 0.6);
  ctx.stroke();
  ctx.restore();
}

function gem(ctx: CanvasRenderingContext2D, x: number, y: number, lit: boolean, flash: number): void {
  ctx.save();
  ctx.translate(x, y);
  if (flash > 0) ctx.scale(1 + flash / 60, 1 + flash / 60);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, -1.5);
    ctx.lineTo(0, 6);
    ctx.lineTo(-4.5, -1.5);
    ctx.closePath();
  };
  path();
  ctx.lineWidth = 3;
  ctx.strokeStyle = UI.ink;
  ctx.stroke();
  if (lit) {
    if (flash > 0) {
      ctx.shadowColor = '#4be1ff';
      ctx.shadowBlur = 10;
    }
    const g = ctx.createLinearGradient(0, -6, 0, 6);
    g.addColorStop(0, '#d9fbff');
    g.addColorStop(0.5, '#4be1ff');
    g.addColorStop(1, '#1b7fb0');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(2, -1.5);
    ctx.lineTo(0, 0);
    ctx.lineTo(-2, -1.5);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(160,220,255,0.45)';
    path();
    ctx.stroke();
  }
  ctx.restore();
}

function shieldIcon(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = UI.ink;
  ctx.beginPath();
  ctx.arc(0, 0, 8.5, 0, TAU);
  ctx.fill();
  const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 8);
  g.addColorStop(0, 'rgba(220,240,255,0.95)');
  g.addColorStop(1, 'rgba(70,150,255,0.85)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.3 * Math.sin(frame / 8)})`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function shoesIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y + 1);
  ctx.fillStyle = UI.ink;
  ctx.beginPath();
  ctx.roundRect(-9, -6, 18, 12, 5);
  ctx.fill();
  ctx.fillStyle = '#e8384f';
  ctx.beginPath();
  ctx.roundRect(-7.5, -4.5, 15, 7, 3.5);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(-2, -4.5, 2.5, 7);
  ctx.fillStyle = GOLD;
  ctx.fillRect(-7.5, 2.5, 15, 2);
  ctx.restore();
}
