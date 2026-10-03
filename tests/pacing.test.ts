import { describe, it, expect } from 'vitest';
import { FramePacer, STEP_MS, snapDelta } from '../src/core/pacing.ts';
import { Camera } from '../src/core/Camera.ts';
import { scanlinePeriod, scanlineProfile } from '../src/render/crt.ts';
import { defaultSettings, sanitizeSettings } from '../src/core/settings.ts';

/**
 * Drives a pacer the way Game.tick does and returns what it decided. `gpu` is
 * how long the GPU takes over each draw; while it is busy the next callback
 * is held back to the following refresh.
 */
function run(pacer: FramePacer, hz: number, seconds: number, gpu: number | ((draw: number) => number) = 0) {
  const period = 1000 / hz;
  const cost = typeof gpu === 'number' ? () => gpu : gpu;
  let now = 0;
  let busyUntil = 0;
  let draws = 0;
  let struggling = 0;
  const gaps: number[] = [];
  let lastDraw = NaN;
  for (let i = 0; i < hz * seconds; i++) {
    const prev = now;
    now = Math.max(now + period, Math.ceil(busyUntil / period - 1e-9) * period);
    pacer.observe(now - prev);
    if (!pacer.shouldDraw(now)) continue;
    if (!Number.isNaN(lastDraw)) gaps.push(now - lastDraw);
    lastDraw = now;
    busyUntil = now + cost(draws++);
    if (pacer.drew(now) === 'struggling') struggling++;
  }
  return { draws, struggling, gaps };
}

describe('snapDelta', () => {
  it('snaps a jittery 60 / 120 / 240 Hz interval onto exact quarter-steps', () => {
    expect(snapDelta(16.61)).toBeCloseTo(STEP_MS, 9);
    expect(snapDelta(16.74)).toBeCloseTo(STEP_MS, 9);
    expect(snapDelta(8.4)).toBeCloseTo(STEP_MS / 2, 9);
    expect(snapDelta(4.1)).toBeCloseTo(STEP_MS / 4, 9);
    expect(snapDelta(33.2)).toBeCloseTo(STEP_MS * 2, 9);
  });

  it('leaves refresh rates 60 does not divide alone', () => {
    for (const hz of [75, 90, 100, 144, 165]) expect(snapDelta(1000 / hz)).toBe(1000 / hz);
  });

  it('never turns a real interval into zero time', () => {
    expect(snapDelta(0.9)).toBe(0.9);
    expect(snapDelta(0)).toBe(0);
  });

  it('makes four 240 Hz frames add up to exactly one simulation step', () => {
    let acc = 0;
    let steps = 0;
    for (let i = 0; i < 2400; i++) {
      acc += snapDelta(1000 / 240 + (i % 2 ? 0.03 : -0.03));
      while (acc >= STEP_MS - 1e-6) {
        acc = Math.max(0, acc - STEP_MS);
        steps++;
      }
    }
    expect(steps).toBe(600);
  });
});

describe('FramePacer', () => {
  it('draws every frame of a 60 Hz display', () => {
    const r = run(new FramePacer(), 60, 5);
    expect(r.draws).toBe(300);
    expect(r.struggling).toBe(0);
  });

  it('halves a 240 Hz display to an even 120 fps instead of drawing duplicates', () => {
    const pacer = new FramePacer();
    const r = run(pacer, 240, 5);
    expect(r.draws).toBe(600);
    expect(Math.max(...r.gaps) - Math.min(...r.gaps)).toBeLessThan(0.01);
    expect(pacer.tier).toBe(0);
  });

  it('lets 144 Hz and 165 Hz displays draw every refresh', () => {
    expect(run(new FramePacer(), 144, 5).draws).toBe(720);
    expect(run(new FramePacer(), 165, 4).draws).toBe(660);
  });

  it('settles a GPU that holds 120 fps only some of the time onto a steady 60', () => {
    const pacer = new FramePacer();
    // Every third frame is a heavy one: on a 240 Hz panel the cadence would
    // stumble 8, 8, 17, 8, 8, 17 ms — motion that visibly hiccups.
    const r = run(pacer, 240, 10, (d) => (d % 3 === 2 ? 14 : 6));
    expect(pacer.tier).toBe(1);
    expect(r.struggling).toBe(0);
    const tail = r.gaps.slice(-200);
    expect(Math.max(...tail)).toBeCloseTo(STEP_MS, 3);
    expect(Math.min(...tail)).toBeCloseTo(STEP_MS, 3);
  });

  it('leaves a slow but perfectly regular cadence alone', () => {
    const pacer = new FramePacer();
    // 11 ms every frame on a 240 Hz panel: an even 80 fps. Even is all that
    // interpolated motion needs.
    const r = run(pacer, 240, 8, 11);
    expect(pacer.tier).toBe(0);
    expect(r.struggling).toBe(0);
    expect(Math.max(...r.gaps) - Math.min(...r.gaps)).toBeLessThan(0.01);
  });

  it('reports a device that cannot even hold 60 fps, so resolution can drop', () => {
    const pacer = new FramePacer();
    // Learn the display on a light scene first (the title), as the game does.
    run(pacer, 60, 1);
    const r = run(pacer, 60, 12, 24);
    expect(pacer.tier).toBe(1);
    expect(r.struggling).toBeGreaterThan(0);
  });

  it('draws the CURRENT step on displays the step divides into, and lags only where it must', () => {
    const lead = (hz: number, tier: 0 | 1 = 0) => {
      const pacer = new FramePacer();
      run(pacer, hz, 2);
      pacer.tier = tier;
      return pacer.lead;
    };
    // 60 Hz: one step per draw — no reason to show the previous one.
    expect(lead(60)).toBeCloseTo(STEP_MS, 6);
    // 240 Hz drawn at 120: half a step per draw.
    expect(lead(240)).toBeCloseTo(STEP_MS / 2, 6);
    expect(lead(240, 1)).toBeCloseTo(STEP_MS, 6);
    expect(lead(120)).toBeCloseTo(STEP_MS / 2, 6);
    // 144 / 75 Hz: draws land on a different phase every time; interpolate plainly.
    expect(lead(144)).toBe(0);
    expect(lead(75)).toBe(0);
    // A display slower than the simulation always gets the latest state.
    expect(lead(30)).toBeCloseTo(STEP_MS, 6);
  });

  it('ignores a one-off hitch (tab switch, scene build)', () => {
    const pacer = new FramePacer();
    run(pacer, 60, 1);
    pacer.observe(900);
    expect(pacer.period).toBeCloseTo(STEP_MS, 6);
    expect(pacer.drew(5000)).toBe('ok');
    expect(pacer.tier).toBe(0);
  });

  it('is not fooled by timestamp jitter into calling on-time frames late', () => {
    // A 240 Hz display whose callbacks land up to 0.6 ms early or late: one
    // short interval must not shrink the target under the real cadence.
    const pacer = new FramePacer();
    const period = 1000 / 240;
    let now = 0;
    let struggling = 0;
    for (let i = 0; i < 240 * 20; i++) {
      const jitter = ((i * 7919) % 13) / 10 - 0.6;
      const dt = period + jitter - (((i - 1) * 7919) % 13) / 10 + 0.6;
      now += dt;
      pacer.observe(dt);
      // Hold 60 fps, as a GPU that could not manage 120 would be asked to.
      pacer.tier = 1;
      if (!pacer.shouldDraw(now)) continue;
      if (pacer.drew(now) === 'struggling') struggling++;
    }
    expect(struggling).toBe(0);
    expect(pacer.period).toBeGreaterThan(3.2);
  });
});

describe('Camera lead and framing', () => {
  const LW = 20000;
  const LH = 4000;

  it('leads in the direction of travel and eases there', () => {
    const cam = new Camera(640, 360);
    cam.snapTo(5000, 2000, LW, LH);
    let x = 5000;
    x += 10;
    cam.update(x, 2000, 10, 0, LW, LH);
    expect(cam.lead).toBeGreaterThan(0);
    expect(cam.lead).toBeLessThanOrEqual(cam.leadEase);
    for (let i = 0; i < 120; i++) cam.update((x += 10), 2000, 10, 0, LW, LH);
    expect(cam.lead).toBeCloseTo((10 / 6) * cam.lookahead, 3);
    // The hero now sits left of centre: more of the road ahead is on screen.
    expect(x - cam.x).toBeLessThan(320);
  });

  it('leads LEFT when running left (the lead follows velocity, not facing)', () => {
    const cam = new Camera(640, 360);
    cam.snapTo(5000, 2000, LW, LH);
    let x = 5000;
    for (let i = 0; i < 120; i++) cam.update((x -= 8), 2000, -8, 0, LW, LH);
    expect(cam.lead).toBeLessThan(0);
    expect(x - cam.x).toBeGreaterThan(320);
  });

  it('never lurches when the hero stops dead against a wall', () => {
    const cam = new Camera(640, 360);
    cam.snapTo(5000, 2000, LW, LH);
    let x = 5000;
    for (let i = 0; i < 120; i++) cam.update((x += 14), 2000, 14, 0, LW, LH);
    let worst = 0;
    for (let i = 0; i < 80; i++) {
      const before = cam.x;
      cam.update(x, 2000, 0, 0, LW, LH);
      worst = Math.max(worst, Math.abs(cam.x - before));
    }
    expect(worst).toBeLessThanOrEqual(cam.leadEase + 1e-9);
  });

  it('shows the landing during a long fall', () => {
    const cam = new Camera(640, 360);
    cam.snapTo(5000, 1000, LW, LH);
    let y = 1000;
    const before = y - cam.viewY; // hero's height in the frame at rest
    for (let i = 0; i < 60; i++) cam.update(5000, (y += 14), 0, 14, LW, LH);
    const falling = y - cam.viewY;
    expect(falling).toBeLessThan(before - 60); // hero rides higher: more floor visible below
    for (let i = 0; i < 120; i++) cam.update(5000, y, 0, 0, LW, LH, 0, true); // landed
    expect(y - cam.viewY).toBeGreaterThan(falling);
  });

  // The zoomed playfield is 240 world px tall: where the hero sits in it is
  // most of what he can see coming.
  const VW = 640 / 1.5;
  const VH = 360 / 1.5;
  /** Runs `frames` at (vx, vy) on the ground and returns the hero's height in the frame, 0..1. */
  const ride = (cam: Camera, at: { x: number; y: number }, vx: number, vy: number, frames: number) => {
    for (let i = 0; i < frames; i++) cam.update((at.x += vx), (at.y += vy), vx, vy, LW, LH, 0, true);
    return (at.y - cam.viewY) / VH;
  };

  it('running downhill the hero rides higher in the frame, uphill lower', () => {
    const cam = new Camera(VW, VH);
    const at = { x: 5000, y: 2000 };
    cam.snapTo(at.x, at.y, LW, LH);
    const flat = ride(cam, at, 6, 0, 120);
    expect(flat).toBeCloseTo(cam.focus, 1);
    const down = ride(cam, at, 9, 4.5, 120); // a 26.5° descent at a roll
    expect(down).toBeLessThan(flat - 0.12);
    // More than half the frame is below him: the hill he is running down.
    expect(down).toBeLessThan(0.5);
    const up = ride(cam, at, 5.4, -2.7, 160); // and back up at a run
    expect(up).toBeGreaterThan(flat + 0.05);
  });

  it('eases into that lead instead of snapping to it', () => {
    const cam = new Camera(VW, VH);
    const at = { x: 5000, y: 2000 };
    cam.snapTo(at.x, at.y, LW, LH);
    ride(cam, at, 6, 0, 60);
    let worst = 0;
    for (let i = 0; i < 90; i++) {
      const before = at.y - cam.viewY;
      ride(cam, at, 9, 4.5, 1);
      worst = Math.max(worst, Math.abs(at.y - cam.viewY - before));
    }
    // The hero's place in the frame never moves faster than the eased lead plus the settle.
    expect(worst).toBeLessThanOrEqual(cam.focusEase * VH + cam.settle + 1e-9);
  });

  it('a hop on a hill does not rock the camera', () => {
    const cam = new Camera(VW, VH);
    const at = { x: 5000, y: 2000 };
    cam.snapTo(at.x, at.y, LW, LH);
    ride(cam, at, 9, 4.5, 120);
    const before = cam.viewY - at.y;
    // A jump: up 40 px and back, while the ground under it keeps falling away.
    let vy = -5;
    let worst = 0;
    for (let i = 0; i < 46; i++) {
      at.x += 9;
      at.y += vy;
      vy += 0.21875;
      cam.update(at.x, at.y, 9, vy, LW, LH);
      worst = Math.max(worst, Math.abs(cam.viewY - at.y - before));
    }
    // The view let him rise and fall inside its dead zone; it did not swing back to neutral.
    expect(worst).toBeLessThan(cam.deadzoneH + 50);
    const landed = ride(cam, at, 9, 4.5, 30);
    expect(landed).toBeLessThan(0.5);
  });

  it('on the ground the view stays on the hero, with only a small dead zone', () => {
    const cam = new Camera(VW, VH);
    const at = { x: 5000, y: 2000 };
    cam.snapTo(at.x, at.y, LW, LH);
    ride(cam, at, 6, 0, 30);
    at.y += 24; // set down two steps lower (a ledge drop that just landed)
    const settled = ride(cam, at, 6, 0, 30);
    expect(Math.abs(settled * VH - cam.focus * VH)).toBeLessThanOrEqual(cam.deadzoneGround + 1e-9);
  });
});

describe('CRT filter dosing', () => {
  it('uses about one scanline per logical row, never a one-row pattern', () => {
    expect(scanlinePeriod(1080)).toBe(3);
    expect(scanlinePeriod(720)).toBe(2);
    expect(scanlinePeriod(360)).toBe(2);
    expect(scanlinePeriod(2160)).toBe(6);
  });

  it('keeps the top of every line clear and darkens the picture only slightly', () => {
    for (const period of [2, 3, 4, 6]) {
      const p = scanlineProfile(period);
      expect(p).toHaveLength(period);
      expect(p[0]).toBe(0);
      expect(Math.max(...p)).toBeLessThanOrEqual(0.2);
      const mean = p.reduce((a, b) => a + b, 0) / period;
      expect(mean).toBeGreaterThan(0.03); // visible...
      expect(mean).toBeLessThan(0.09); // ...but never a dimmed screen
    }
  });

  it('is an option, on by default, and survives junk in storage', () => {
    expect(defaultSettings(false).crt).toBe(true);
    expect(sanitizeSettings({ crt: false }).crt).toBe(false);
    expect(sanitizeSettings({ crt: 'yes' }, defaultSettings(false)).crt).toBe(true);
  });
});
