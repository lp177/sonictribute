import type { Input } from './Input.ts';

export interface Scene {
  update(): void;
  render(ctx: CanvasRenderingContext2D): void;
}

const FRAME = 1000 / 60;

/**
 * Fixed-timestep game shell (60 Hz physics, per SPG constants) with a fade
 * transition between scenes — the next scene is constructed while the fade
 * covers the screen, so there is never a visible loading pause.
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
    this.last = performance.now();
    requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    requestAnimationFrame(this.tick);
    if (!this.scene) return;
    this.acc += Math.min(100, now - this.last); // cap to avoid spiral of death
    this.last = now;
    while (this.acc >= FRAME) {
      this.acc -= FRAME;
      this.frame++;
      this.scene.update();
      this.input.endFrame();
    }
    const ctx = this.canvas.getContext('2d')!;
    this.scene.render(ctx);

    // Fade transition.
    if (this.fade !== 0) {
      const alpha = Math.min(1, Math.abs(this.fade));
      this.fade += 0.04; // 0 -> +1 (out), -1 -> 0 (in)
      if (this.fade >= 1 && this.nextScene) {
        const build = this.nextScene;
        this.nextScene = null;
        this.scene = build(); // constructed behind a fully black screen
        this.acc = 0; // drop the time the build cost instead of catching up
        this.last = performance.now();
        this.fade = -1; // fade back in
      } else if (this.fade >= 0 && !this.nextScene) {
        this.fade = 0;
      }
      ctx.fillStyle = `rgba(10,10,14,${alpha})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  };
}
