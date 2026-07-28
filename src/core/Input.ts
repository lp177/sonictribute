import type { PlayerInput } from '../game/Player.ts';
import { Bindings, type Action } from './bindings.ts';

/** Keys the browser scrolls/navigates with; always swallowed while playing. */
const ALWAYS_PREVENT = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab'];

/**
 * Keyboard state translated into the engine's per-frame input, through the
 * remappable `Bindings`. Also provides the one-shot key capture the settings
 * panel uses to rebind an action.
 */
export class Input {
  bindings: Bindings;
  private held = new Set<string>();
  private pressedThisFrame = new Set<string>();
  /** UI-level edge events (menu confirm, pause…). */
  private uiPressed = new Set<string>();
  /** When true, the next key press is swallowed and reported as a capture. */
  private capturing = false;
  private captured: string | null = null;

  constructor(bindings: Bindings = new Bindings()) {
    this.bindings = bindings;
  }

  attach(target: Window): void {
    target.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (this.capturing) {
        // Rebinding: consume the key entirely, never feed it to gameplay.
        e.preventDefault();
        this.captured = e.code;
        this.capturing = false;
        return;
      }
      this.held.add(e.code);
      this.pressedThisFrame.add(e.code);
      this.uiPressed.add(e.code);
      if (ALWAYS_PREVENT.includes(e.code) || this.isBound(e.code)) e.preventDefault();
    });
    target.addEventListener('keyup', (e) => this.held.delete(e.code));
    target.addEventListener('blur', () => this.held.clear());
  }

  private isBound(code: string): boolean {
    return this.bindings.findConflict(code) !== null;
  }

  private any(action: Action): boolean {
    return this.bindings.codes(action).some((c) => this.held.has(c));
  }

  private anyPressed(action: Action): boolean {
    return this.bindings.codes(action).some((c) => this.pressedThisFrame.has(c));
  }

  /** Snapshot for one physics frame. Call `endFrame()` after the update. */
  snapshot(): PlayerInput {
    return {
      left: this.any('left'),
      right: this.any('right'),
      up: this.any('up'),
      down: this.any('down'),
      jump: this.any('jump'),
      jumpPressed: this.anyPressed('jump'),
    };
  }

  /** Edge-triggered raw key check (consumed by `endFrame`). */
  uiWasPressed(...codes: string[]): boolean {
    return codes.some((c) => this.uiPressed.has(c));
  }

  /** Edge-triggered check against an action's bound keys. */
  actionWasPressed(action: Action): boolean {
    return this.bindings.codes(action).some((c) => this.uiPressed.has(c));
  }

  /** Menu confirm: Enter is reserved, plus whatever jump is bound to. */
  confirmPressed(): boolean {
    return this.uiWasPressed('Enter') || this.actionWasPressed('jump');
  }

  /* ------------------------------ Key capture ------------------------------ */

  /** Swallow the next key press and report it via `takeCaptured()`. */
  beginCapture(): void {
    this.capturing = true;
    this.captured = null;
  }

  cancelCapture(): void {
    this.capturing = false;
    this.captured = null;
  }

  get isCapturing(): boolean {
    return this.capturing;
  }

  /** Returns the captured key code once, then forgets it. */
  takeCaptured(): string | null {
    const c = this.captured;
    this.captured = null;
    return c;
  }

  endFrame(): void {
    this.pressedThisFrame.clear();
    this.uiPressed.clear();
  }

  /** Test/debug hook: simulate a key press for one frame. */
  pressForTest(code: string): void {
    if (this.capturing) {
      this.captured = code;
      this.capturing = false;
      return;
    }
    this.held.add(code);
    this.pressedThisFrame.add(code);
    this.uiPressed.add(code);
  }

  releaseForTest(code: string): void {
    this.held.delete(code);
  }
}
