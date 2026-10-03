import type { Input } from './Input.ts';
import { VIEW_W, VIEW_H, MAX_SCALE, fitScale, renderScale, setRenderScale } from './view.ts';
import { FramePacer, STEP_MS, snapDelta } from './pacing.ts';
import { CrtOverlay } from '../render/crt.ts';
import { onSettingsChange, settings } from './settings.ts';

export interface Scene {
  update(): void;
  /**
   * `alpha` (0..1) is how far the clock has run into the NEXT simulation
   * step. A scene that scrolls should draw moving things `alpha` of the way
   * from where they were one step ago to where they are now — that is what
   * keeps motion even on a display that refreshes faster than 60 Hz (or at a
   * rate 60 does not divide). Static scenes can ignore it.
   */
  render(ctx: CanvasRenderingContext2D, alpha: number): void;
  /**
   * The page lost focus or was hidden. A scene with a run in progress should
   * pause itself — a game that keeps running in a background tab, or while the
   * player answers a notification, kills them for looking away.
   */
  suspend?(): void;
}

/** Something drawn above every scene (touch controls, toasts). */
export interface Overlay {
  update?(): void;
  render(ctx: CanvasRenderingContext2D): void;
}

/** Fade progress per simulation step (18 steps each way). */
const FADE_STEP = 1 / 18;
/** The render scale never auto-drops below this; text stops being crisp. */
const MIN_AUTO_SCALE = 1.5;

/**
 * Fixed-timestep game shell (60 Hz physics, per SPG constants) with a fade
 * transition between scenes — the next scene is constructed while the fade
 * covers the screen, so there is never a visible loading pause.
 *
 * Rendering is resolution independent: scenes draw in the 640x360 logical
 * space and the shell installs the device-pixel scale as the transform (see
 * core/view.ts), so everything is rasterised at the screen's real resolution.
 * How often it draws, and at what resolution, is `FramePacer`'s call (see
 * core/pacing.ts).
 */
export class Game {
  private canvas: HTMLCanvasElement;
  private input: Input;
  private scene: Scene | null = null;
  /** Built only once the fade covers the screen — see `changeScene`. */
  private nextScene: (() => Scene) | null = null;
  private fade = 0; // >0 fading out, <0 fading in
  private acc = 0;
  private last = 0;
  private frame = 0;
  private pacer = new FramePacer();
  /** Ceiling on the render scale; lowered when the device cannot keep up. */
  private scaleCap = MAX_SCALE;
  private crt: CrtOverlay | null = null;
  readonly overlays: Overlay[] = [];

  constructor(canvas: HTMLCanvasElement, input: Input) {
    this.canvas = canvas;
    this.input = input;
  }

  setScene(scene: Scene): void {
    this.scene = scene;
  }

  /**
   * Fades out, then builds and installs the next scene. Pass a FACTORY so the
   * expensive construction (level build, terrain pre-render) happens on the
   * frame the screen is already black — that is what makes the cutscenes
   * double as loading screens instead of hitching on a visible frame.
   */
  changeScene(next: Scene | (() => Scene)): void {
    if (this.nextScene) return;
    this.nextScene = typeof next === 'function' ? next : () => next;
    this.fade = 0.0001; // start fade-out
  }

  /** True while a scene transition is in flight (input should be ignored). */
  get transitioning(): boolean {
    return this.nextScene !== null;
  }

  start(): void {
    if (this.canvas.parentElement) {
      this.crt = new CrtOverlay(this.canvas.parentElement);
      this.crt.setEnabled(settings().crt);
      onSettingsChange((s) => this.crt?.setEnabled(s.crt));
    }
    this.fit();
    window.addEventListener('resize', () => this.fit());
    // Moving the window to a screen with a different pixel density.
    window.matchMedia?.(`(resolution: ${window.devicePixelRatio}dppx)`)?.addEventListener?.('change', () => this.fit());
    const suspend = () => this.scene?.suspend?.();
    window.addEventListener('blur', suspend);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) suspend();
    });
    this.last = performance.now();
    requestAnimationFrame(this.tick);
  }

  /**
   * Sizes the canvas to the largest 16:9 box that fits the window, with a
   * backing store at a whole quarter-step render scale. The CSS box is derived
   * from the backing store (not the other way round) so device pixels map 1:1
   * and nothing is resampled by the browser.
   */
  fit(): void {
    const dpr = window.devicePixelRatio || 1;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cssW = Math.min(vw, (vh * VIEW_W) / VIEW_H);
    const cssH = (cssW * VIEW_H) / VIEW_W;
    const s = fitScale(cssW, cssH, dpr, this.scaleCap);
    setRenderScale(s);
    const bw = Math.round(VIEW_W * s);
    const bh = Math.round(VIEW_H * s);
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.crt?.fit(cssW, cssH, dpr);
  }

  /**
   * The device cannot hold 60 fps at this resolution: render smaller and let
   * the browser upscale. One step softer beats a game about speed stuttering.
   * Returns false once there is nothing left to give.
   */
  private shedResolution(): boolean {
    const s = renderScale();
    if (s <= MIN_AUTO_SCALE) return false;
    this.scaleCap = Math.max(MIN_AUTO_SCALE, s - 0.5);
    this.fit();
    return true;
  }

  /** One fixed simulation step. Returns false when the scene was swapped. */
  private step(): boolean {
    this.frame++;
    this.input.poll();
    for (const o of this.overlays) o.update?.();
    this.scene!.update();
    this.input.endFrame();

    // Fade transition: stepped with the simulation, so it lasts the same
    // third of a second on a 60 Hz and a 240 Hz display.
    if (this.fade === 0) return true;
    this.fade += FADE_STEP; // 0 -> +1 (out), -1 -> 0 (in)
    if (this.fade >= 1 && this.nextScene) {
      const build = this.nextScene;
      this.nextScene = null;
      this.scene = build(); // constructed behind a fully black screen
      this.fade = -1; // fade back in
      return false;
    }
    if (this.fade >= 0 && !this.nextScene) this.fade = 0;
    return true;
  }

  private tick = (now: number): void => {
    requestAnimationFrame(this.tick);
    if (!this.scene) return;
    const dt = Math.max(0, now - this.last);
    this.last = now;
    this.pacer.observe(dt);
    this.acc += snapDelta(Math.min(100, dt)); // cap to avoid spiral of death
    // The epsilon keeps four snapped quarter-steps from summing to a hair
    // under one step and skipping it.
    while (this.acc >= STEP_MS - 1e-6) {
      this.acc = Math.max(0, this.acc - STEP_MS);
      if (!this.step()) {
        // Drop the time the build cost instead of catching up on it.
        this.acc = 0;
        this.last = performance.now();
        this.pacer.reset();
        break;
      }
    }
    if (!this.pacer.shouldDraw(now)) return;

    const ctx = this.canvas.getContext('2d')!;
    const s = renderScale();
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    this.scene.render(ctx, Math.min(1, (this.acc + this.pacer.lead) / STEP_MS));
    for (const o of this.overlays) {
      ctx.save();
      o.render(ctx);
      ctx.restore();
    }

    if (this.fade !== 0) {
      const alpha = Math.min(1, Math.abs(this.fade));
      // Ease, so the black arrives and leaves softly instead of linearly.
      ctx.fillStyle = `rgba(6,7,12,${alpha * alpha * (3 - 2 * alpha)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    if (this.pacer.drew(now) === 'struggling' && this.shedResolution()) this.pacer.reset();
  };
}
