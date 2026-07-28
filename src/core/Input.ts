import type { PlayerInput } from '../game/Player.ts';

/** Keyboard state translated into the engine's per-frame input. */
export class Input {
  private held = new Set<string>();
  private pressedThisFrame = new Set<string>();
  /** UI-level edge events (menu confirm, pause…). */
  private uiPressed = new Set<string>();

  attach(target: Window): void {
    target.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.held.add(e.code);
      this.pressedThisFrame.add(e.code);
      this.uiPressed.add(e.code);
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    target.addEventListener('keyup', (e) => this.held.delete(e.code));
    target.addEventListener('blur', () => this.held.clear());
  }

  private any(...codes: string[]): boolean {
    return codes.some((c) => this.held.has(c));
  }

  private anyPressed(...codes: string[]): boolean {
    return codes.some((c) => this.pressedThisFrame.has(c));
  }

  /** Snapshot for one physics frame. Call `endFrame()` after the update. */
  snapshot(): PlayerInput {
    return {
      left: this.any('ArrowLeft', 'KeyA'),
      right: this.any('ArrowRight', 'KeyD'),
      up: this.any('ArrowUp', 'KeyW'),
      down: this.any('ArrowDown', 'KeyS'),
      jump: this.any('Space', 'KeyZ', 'KeyJ'),
      jumpPressed: this.anyPressed('Space', 'KeyZ', 'KeyJ'),
    };
  }

  /** Edge-triggered UI key check (consumed by `endFrame`). */
  uiWasPressed(...codes: string[]): boolean {
    return codes.some((c) => this.uiPressed.has(c));
  }

  endFrame(): void {
    this.pressedThisFrame.clear();
    this.uiPressed.clear();
  }
}
