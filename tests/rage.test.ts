import { describe, it, expect } from 'vitest';
import { Boss } from '../src/game/Boss.ts';
import { PressBoss } from '../src/game/PressBoss.ts';
import { CrystalBoss } from '../src/game/CrystalBoss.ts';
import { MirageBoss } from '../src/game/MirageBoss.ts';
import { Player } from '../src/game/Player.ts';

const far = () => new Player(0, 300);

describe('Enraged finales change the script', () => {
  it('the Wrecking Pod dives twice per telegraph when enraged', () => {
    const count = (rage: boolean) => {
      const b = new Boss(4600, 336, 4000, 4700, rage);
      b.phase = 'sway';
      b.y = 232;
      const p = far();
      p.x = 4400;
      // Every dive start announces itself with 'boss-telegraph' (including
      // the rage mid-air turnaround), so the event count IS the dive count.
      let tells = 0;
      for (let i = 0; i < 700; i++) {
        tells += b.update(p).filter((e) => e === 'boss-telegraph').length;
        if ((b.phase as string) === 'retreat') break;
      }
      return tells;
    };
    expect(count(false)).toBe(1);
    expect(count(true)).toBe(2);
  });

  it('the Piston Crusher fires a trailing shockwave pair when enraged', () => {
    const waves = (rage: boolean) => {
      const b = new PressBoss(4600, 336, 4000, 4700, rage);
      b.phase = 'slam';
      b.y = b.groundY - 40;
      const p = far();
      for (let i = 0; i < 6 && (b.phase as string) !== 'open'; i++) b.update(p);
      return b.shockwaves.length;
    };
    expect(waves(false)).toBe(2);
    expect(waves(true)).toBe(4);
  });

  it('queued rage shockwaves are inert until born', () => {
    const b = new PressBoss(4600, 336, 4000, 4700, true);
    b.phase = 'slam';
    b.y = b.groundY - 40;
    const p = far();
    for (let i = 0; i < 6 && (b.phase as string) !== 'open'; i++) b.update(p);
    // A queued wave must not exist in the world yet: it holds position while
    // its age is negative and only starts travelling once born — the delay is
    // the dodge rhythm, so it must be real, not cosmetic.
    const queued = b.shockwaves.filter((s) => s.age < 0);
    expect(queued.length).toBe(2);
    const x0 = queued[0].x;
    for (let i = 0; i < 10; i++) b.update(p);
    expect(queued[0].x).toBe(x0); // frozen while queued
    for (let i = 0; i < 20; i++) b.update(p);
    expect(queued[0].age).toBeGreaterThanOrEqual(0);
    expect(queued[0].x).not.toBe(x0); // born and moving
  });

  it('the Shard Drill fires a third volley when enraged', () => {
    const volleys = (rage: boolean) => {
      const b = new CrystalBoss(4600, 336, 4000, 4700, rage);
      b.phase = 'shards';
      b.timer = 0;
      const p = far();
      p.x = 4400;
      let n = 0;
      for (let i = 0; i < 80; i++) n += b.update(p).filter((e) => e === 'boss-shards').length;
      return n;
    };
    expect(volleys(false)).toBe(2);
    expect(volleys(true)).toBe(3);
  });

  it('the Mirage Pacer runs hotter and derezzes shorter when enraged', () => {
    const calm = new MirageBoss(4600, 336, 4000, 4700, false);
    const angry = new MirageBoss(4600, 336, 4000, 4700, true);
    expect(angry.rage).toBe(true);
    expect(calm.rage).toBe(false);
  });
});
