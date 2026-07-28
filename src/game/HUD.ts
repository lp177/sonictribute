import type { Level } from './Level.ts';
import type { Player } from './Player.ts';
import { timeBonus, ringBonus, computeAchievements, type LevelStats } from './Score.ts';

function fmtTime(frames: number): string {
  const m = Math.floor(frames / 3600);
  const s = Math.floor((frames % 3600) / 60);
  const f = Math.floor(((frames % 60) * 100) / 60);
  return `${m}:${String(s).padStart(2, '0')}.${String(f).padStart(2, '0')}`;
}

/** Dark Material-style overlay panels drawn on the canvas. */
export class HUD {
  draw(ctx: CanvasRenderingContext2D, level: Level, p: Player): void {
    ctx.save();
    ctx.fillStyle = 'rgba(18,18,24,0.72)';
    ctx.beginPath();
    ctx.roundRect(8, 8, 190, 58, 8);
    ctx.fill();
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#9aa3b2';
    ctx.fillText('SCORE', 18, 24);
    ctx.fillText('TIME', 18, 40);
    ctx.fillText('RINGS', 18, 56);
    ctx.fillStyle = '#fff';
    ctx.fillText(String(level.score).padStart(6, '0'), 78, 24);
    ctx.fillText(fmtTime(level.timeFrames), 78, 40);
    ctx.fillStyle = p.rings === 0 && Math.floor(level.timeFrames / 20) % 2 === 0 ? '#e8384f' : '#ffd94a';
    ctx.fillText(String(p.rings).padStart(3, '0'), 78, 56);

    // Chrono crystals.
    const found = level.crystals.filter((c) => c.taken).length;
    for (let i = 0; i < level.crystals.length; i++) {
      ctx.fillStyle = i < found ? '#4be1ff' : 'rgba(255,255,255,0.15)';
      ctx.save();
      ctx.translate(212 + i * 14, 18);
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(4, 0);
      ctx.lineTo(0, 5);
      ctx.lineTo(-4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Boss health bar.
    if (level.boss && !level.bossDefeated && level.boss.phase !== 'intro') {
      ctx.fillStyle = 'rgba(18,18,24,0.72)';
      ctx.beginPath();
      ctx.roundRect(ctx.canvas.width / 2 - 80, 10, 160, 18, 6);
      ctx.fill();
      ctx.fillStyle = '#3a3f4a';
      ctx.fillRect(ctx.canvas.width / 2 - 72, 15, 144, 8);
      ctx.fillStyle = '#e8384f';
      ctx.fillRect(ctx.canvas.width / 2 - 72, 15, (144 * Math.max(0, level.boss.hp)) / level.boss.maxHp, 8);
      ctx.fillStyle = '#9aa3b2';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(level.boss.title, ctx.canvas.width / 2 - 76, 24);
    }
    ctx.restore();
  }

  drawResults(ctx: CanvasRenderingContext2D, level: Level, p: Player, frame: number): void {
    const stats: LevelStats = { ...level.stats(), ringsHeld: p.rings };
    const tb = timeBonus(stats.timeFrames);
    const rb = ringBonus(stats.ringsHeld);
    const total = level.score + tb + rb;
    const achievements = computeAchievements(stats);

    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.save();
    ctx.fillStyle = 'rgba(10,10,14,0.82)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#4be1ff';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(`${level.name} CLEARED!`, w / 2, 64);

    ctx.fillStyle = 'rgba(30,30,38,0.95)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 170, 84, 340, 150, 12);
    ctx.fill();

    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#9aa3b2';
    const rows: [string, string][] = [
      ['TIME', fmtTime(stats.timeFrames)],
      ['TIME BONUS', String(tb)],
      ['RING BONUS', String(rb)],
      ['CRYSTALS', `${stats.crystalsFound} / ${stats.crystalsTotal}`],
      ['SECRETS', `${stats.secretsFound} / ${stats.secretsTotal}`],
      ['TOTAL SCORE', String(total)],
    ];
    rows.forEach(([k, v], i) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#9aa3b2';
      ctx.fillText(k, w / 2 - 140, 112 + i * 20);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.fillText(v, w / 2 + 140, 112 + i * 20);
    });

    ctx.textAlign = 'center';
    achievements.forEach((a, i) => {
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`★ ${a.label}`, w / 2, 254 + i * 16);
    });

    if (frame % 60 < 40) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('PRESS ENTER', w / 2, h - 24);
    }
    ctx.restore();
  }
}
