import { describe, it, expect } from 'vitest';
import { FxSystem } from '../src/render/fx.ts';

describe('FxSystem — screen shake', () => {
  it('shakes on damage and slam events, hardest on the slam', () => {
    const hurt = new FxSystem();
    hurt.onEvent('hurt', 0, 0);
    const slam = new FxSystem();
    slam.onEvent('boss-slam', 0, 0);
    expect(hurt.shakeMag).toBeGreaterThan(0);
    expect(slam.shakeMag).toBeGreaterThan(hurt.shakeMag);
  });

  it('does not shake on harmless events', () => {
    const fx = new FxSystem();
    fx.onEvent('ring', 0, 0);
    fx.onEvent('checkpoint', 0, 0);
    expect(fx.shakeMag).toBe(0);
  });

  it('offset is deterministic, bounded and decays to zero', () => {
    const fx = new FxSystem();
    fx.onEvent('hurt', 0, 0);
    const a = fx.shakeOffset(10);
    const b = fx.shakeOffset(10);
    expect(a).toEqual(b);
    expect(Math.abs(a.x)).toBeLessThanOrEqual(4);
    for (let i = 0; i < 60; i++) fx.update();
    expect(fx.shakeOffset(99)).toEqual({ x: 0, y: 0 });
  });

  it('a stronger shake overrides a weaker one, never the reverse', () => {
    const fx = new FxSystem();
    fx.onEvent('boss-slam', 0, 0);
    const strong = fx.shakeMag;
    fx.onEvent('boss-hit', 0, 0);
    expect(fx.shakeMag).toBe(strong);
  });

  it('reduced motion disables shake entirely', () => {
    const fx = new FxSystem(true);
    fx.onEvent('boss-slam', 0, 0);
    expect(fx.shakeMag).toBe(0);
    expect(fx.shakeOffset(7)).toEqual({ x: 0, y: 0 });
  });
});

describe('FxSystem — hit-stop', () => {
  it('freezes the world on a heavy impact, briefly', () => {
    const fx = new FxSystem();
    fx.onEvent('boss-hit', 0, 0);
    expect(fx.hitStop).toBeGreaterThan(0);
    // Long enough to read as weight, short enough not to feel like lag.
    expect(fx.hitStop).toBeLessThanOrEqual(12);
    let frozen = 0;
    while (fx.tickFreeze()) frozen++;
    expect(frozen).toBeGreaterThan(0);
    expect(fx.tickFreeze()).toBe(false); // and it always ends
  });

  it('does not freeze on trivial events', () => {
    const fx = new FxSystem();
    fx.onEvent('ring', 0, 0);
    fx.onEvent('checkpoint', 0, 0);
    expect(fx.hitStop).toBe(0);
    expect(fx.tickFreeze()).toBe(false);
  });

  it('keeps the longest freeze when impacts stack', () => {
    const fx = new FxSystem();
    fx.onEvent('enemy', 0, 0);
    const small = fx.hitStop;
    fx.onEvent('boss-defeated', 0, 0);
    expect(fx.hitStop).toBeGreaterThan(small);
  });

  it('still gives a token freeze under reduced motion', () => {
    // Removing it entirely makes hits feel unresponsive; it is weight, not
    // motion, so a couple of frames is the accessible compromise.
    const fx = new FxSystem(true);
    fx.onEvent('boss-defeated', 0, 0);
    expect(fx.hitStop).toBeGreaterThan(0);
    expect(fx.hitStop).toBeLessThanOrEqual(2);
  });
});

describe('FxSystem — impact flash', () => {
  it('flashes on damage and fades out', () => {
    const fx = new FxSystem();
    fx.onEvent('hurt', 0, 0);
    expect(fx.flashFrames).toBeGreaterThan(0);
    for (let i = 0; i < 60; i++) fx.update();
    expect(fx.flashFrames).toBe(0);
  });

  it('does not flash on ordinary pickups', () => {
    const fx = new FxSystem();
    fx.onEvent('ring', 0, 0);
    expect(fx.flashFrames).toBe(0);
  });

  it('scales landing dust with the impact', () => {
    const soft = new FxSystem();
    soft.emitLandingDust(0, 0, 3);
    const hard = new FxSystem();
    hard.emitLandingDust(0, 0, 10);
    expect(hard.particles.length).toBeGreaterThan(soft.particles.length);
    expect(hard.shakeMag).toBeGreaterThan(0); // a hard landing is felt
    expect(soft.shakeMag).toBe(0);
  });
});

describe('FxSystem — particles', () => {
  it('events spawn particles near their world position', () => {
    const fx = new FxSystem();
    fx.onEvent('enemy', 500, 300);
    expect(fx.particles.length).toBeGreaterThan(0);
    for (const p of fx.particles) {
      expect(Math.abs(p.x - 500)).toBeLessThan(40);
      expect(Math.abs(p.y - 300)).toBeLessThan(40);
    }
  });

  it('particles move, age and expire', () => {
    const fx = new FxSystem();
    fx.onEvent('crystal', 100, 100);
    const n0 = fx.particles.length;
    const first = fx.particles[0];
    const x0 = first.x;
    const y0 = first.y;
    fx.update();
    expect(first.x !== x0 || first.y !== y0).toBe(true);
    for (let i = 0; i < 200; i++) fx.update();
    expect(fx.particles).toHaveLength(0);
    expect(n0).toBeGreaterThan(0);
  });

  it('continuous emitters produce dust, smoke and trails', () => {
    const fx = new FxSystem();
    fx.emitRunDust(10, 20, 6); // running right
    fx.emitSpindashSmoke(10, 20, 1);
    fx.emitBoardTrail(10, 20);
    fx.emitShoesTrail(10, 20);
    expect(fx.particles.length).toBeGreaterThanOrEqual(4);
    expect(fx.particles.some((p) => p.kind === 'smoke')).toBe(true);
    expect(fx.particles.some((p) => p.kind === 'glow')).toBe(true);
    // Run dust drifts AGAINST the direction of travel. The emit speed alone
    // is < 1, so only a negative value proves the anti-travel kick is applied.
    const dust = fx.particles[0];
    expect(dust.xsp).toBeLessThan(0);
  });

  it('reduced motion halves burst sizes', () => {
    const full = new FxSystem(false);
    full.onEvent('boss-defeated', 0, 0);
    const reduced = new FxSystem(true);
    reduced.onEvent('boss-defeated', 0, 0);
    expect(reduced.particles.length).toBeLessThan(full.particles.length);
    expect(reduced.particles.length).toBeGreaterThan(0); // feedback still exists
  });

  it('is fully deterministic for identical event sequences', () => {
    const a = new FxSystem();
    const b = new FxSystem();
    a.onEvent('goal', 50, 60);
    b.onEvent('goal', 50, 60);
    a.update();
    b.update();
    expect(a.particles).toEqual(b.particles);
  });
});
