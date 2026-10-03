/**
 * Frame pacing: how the fixed 60 Hz simulation meets a display that may run at
 * 60, 75, 120, 144 or 240 Hz on a GPU that may or may not keep up. Pure logic,
 * unit tested — `Game` is the only caller.
 *
 * The game used to draw once per `requestAnimationFrame`, whatever the screen.
 * On a 240 Hz panel that is four draws per simulation step, three of them
 * pixel-identical: a laptop GPU saturated on duplicates, the frames it did
 * finish arrived at irregular intervals, and a game about speed stuttered.
 * Three rules fix it:
 *
 *  - draws are INTERPOLATED between the last two simulation states (see
 *    `Scene.render`'s `alpha`), so what is on screen is where things are at
 *    that instant — smooth at any refresh rate and at any frame interval;
 *  - draws are RATIONED: never closer together than `minGap`, so a 240 Hz
 *    panel gets an even 120 fps instead of as many as the GPU can choke down;
 *  - a device that still cannot hold the target steps DOWN on its own: first
 *    to ~60 fps, then (the caller's job) to a lower render resolution.
 */

/** One simulation step, in milliseconds. */
export const STEP_MS = 1000 / 60;

/**
 * rAF timestamps jitter a few hundredths of a millisecond around the true
 * refresh period. Left alone, the accumulator's remainder drifts across a step
 * boundary every few seconds and a frame runs zero steps, the next one two.
 * Displays whose refresh is a multiple of the step (60 / 120 / 240 Hz, the
 * common case) are snapped onto exact quarter-steps; anything else (75, 144,
 * 165 Hz) is left as measured and relies on interpolation alone.
 */
export function snapDelta(dt: number): number {
  const q = STEP_MS / 4;
  const n = Math.round(dt / q);
  return n >= 1 && Math.abs(dt - n * q) < 0.35 ? n * q : dt;
}

/** Draws are never scheduled closer than this: [full rate, held at ~60]. */
const MIN_GAP = [5.4, 13] as const;
/** Draw intervals judged per verdict. */
const WINDOW = 120;
/** Share of late draws in a window that counts as "cannot keep up". */
const LATE_SHARE = 0.2;
/** A draw is late when its interval runs this far past the target. */
const LATE_FACTOR = 1.3;
/** Anything longer is a tab switch or a scene build, not a slow frame. */
const HICCUP_MS = 100;
/** rAF intervals remembered for the refresh estimate, and how often it is redone. */
const SAMPLES = 90;
const RESAMPLE = 30;

export type PaceVerdict = 'ok' | 'struggling';

export class FramePacer {
  /**
   * The display's refresh period in ms: the low end of the frame intervals
   * seen so far. A low QUANTILE, not the minimum — timestamps jitter, and one
   * short interval would otherwise shrink the target until every on-time
   * frame counted as late.
   */
  period = STEP_MS;
  /** 0 = every frame the display offers (up to ~170 fps); 1 = held at ~60 fps. */
  tier: 0 | 1 = 0;
  private seen = false;
  private samples: number[] = [];
  private fresh = 0;
  private lastDraw = -Infinity;
  private draws = 0;
  private late = 0;

  /** Feed every rAF interval, drawn or not: the quick ones reveal the display. */
  observe(dt: number): void {
    if (dt < 2 || dt > HICCUP_MS) return;
    this.samples.push(dt);
    if (this.samples.length > SAMPLES) this.samples.shift();
    if (++this.fresh < RESAMPLE) return;
    this.fresh = 0;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const low = sorted[Math.floor(sorted.length * 0.2)];
    // Only ever downward: a heavy scene makes frames slower, not the display.
    this.period = this.seen ? Math.min(this.period, low) : low;
    this.seen = true;
  }

  get minGap(): number {
    return MIN_GAP[this.tier];
  }

  /** The draw interval a device that keeps up delivers at this tier. */
  get target(): number {
    return Math.max(1, Math.ceil((this.minGap - 0.3) / this.period)) * this.period;
  }

  /**
   * How far ahead of the clock a draw may look, in ms. Plain interpolation
   * shows the world one whole step late; but when the draw interval divides
   * the step evenly (60, 120, 240 Hz) every draw lands on the same phase, so
   * it can show the state as of the END of the interval it will be on screen
   * for — a 60 Hz display then draws the current step, not the previous one,
   * and nobody pays a frame of input lag for smoothness they already had.
   * Any other refresh rate gets 0: there the lag is what keeps motion even.
   */
  get lead(): number {
    const gap = snapDelta(this.target);
    if (gap >= STEP_MS - 1e-6) return STEP_MS; // a step or more per draw: show the latest
    const per = STEP_MS / gap;
    return Math.abs(per - Math.round(per)) < 1e-6 ? gap : 0;
  }

  shouldDraw(now: number): boolean {
    return now - this.lastDraw >= this.minGap;
  }

  /**
   * Records a draw. Every `WINDOW` draws it judges the device: too many late
   * ones drops the tier to ~60 fps, and if that was already the tier it
   * reports 'struggling' so the caller can shed resolution instead.
   */
  drew(now: number): PaceVerdict {
    const gap = now - this.lastDraw;
    this.lastDraw = now;
    if (gap > HICCUP_MS) return 'ok';
    this.draws++;
    if (gap > this.target * LATE_FACTOR) this.late++;
    if (this.draws < WINDOW) return 'ok';
    const struggling = this.late / this.draws > LATE_SHARE;
    this.draws = 0;
    this.late = 0;
    if (!struggling) return 'ok';
    if (this.tier === 0) {
      this.tier = 1;
      return 'ok';
    }
    return 'struggling';
  }

  /** Forget the current window (scene swap, resolution change: both hitch once). */
  reset(): void {
    this.lastDraw = -Infinity;
    this.draws = 0;
    this.late = 0;
  }
}
