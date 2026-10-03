import type { PlayerInput } from '../game/Player.ts';
import { Bindings, type Action } from './bindings.ts';
import { GamepadReader, browserPads, type Dirs, type PadSource } from './gamepad.ts';
import {
  PointerTracker,
  clientToLogical,
  normalizeWheel,
  type PointerSample,
  type PointerState,
  type PointerType,
} from './pointer.ts';

/** Keys the browser scrolls/navigates with; always swallowed while playing. */
const ALWAYS_PREVENT = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab'];

/** The device behind the most recent real input — prompts show its glyphs. */
export type Device = 'keyboard' | 'gamepad' | 'touch' | 'mouse';

export type MenuDir = 'up' | 'down' | 'left' | 'right';

/** Arrow keys always navigate menus, whatever the bindings say. */
const NAV_KEYS: Record<MenuDir, string> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

const CONFIRM_KEYS = ['Enter', 'NumpadEnter'];
const BACK_KEYS = ['Escape', 'Backspace'];

/**
 * Menu auto-repeat, in fixed frames: a held direction fires once, waits
 * `delay`, then fires every `rate` — the console convention, so a long list
 * can be crossed without hammering the key, and a tap never double-steps.
 */
export const MENU_REPEAT = { delay: 18, rate: 6 } as const;

/** True on the frames a direction held for `heldFrames` should repeat (never the first). */
export function repeatFires(heldFrames: number): boolean {
  const since = heldFrames - 1 - MENU_REPEAT.delay;
  return since >= 0 && since % MENU_REPEAT.rate === 0;
}

/** What the on-screen touch controls contribute to one frame. */
export interface TouchFrame extends Dirs {
  jump: boolean;
  /** A jump touch landed this frame. */
  jumpPressed: boolean;
  /** The on-screen pause button was tapped this frame. */
  pauseTapped: boolean;
}

const NO_TOUCH: Readonly<TouchFrame> = Object.freeze({
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  jumpPressed: false,
  pauseTapped: false,
});

/**
 * The on-screen gameplay controls (ui/TouchControls), as `Input` sees them.
 * Every touch or pen contact is offered to them first; a pointer they claim
 * stays theirs until it lifts, so a thumb on the stick can never also click
 * the menu that opens under it.
 */
export interface TouchGameplay {
  readonly frame: Readonly<TouchFrame>;
  /** Offered every touch/pen press; true = this pointer now belongs to the controls. */
  claim(s: PointerSample): boolean;
  owns(id: number): boolean;
  move(s: PointerSample): void;
  /** The pointer lifted or was cancelled. */
  release(id: number): void;
  /** Drop this frame's edges. */
  endFrame(): void;
  /**
   * Stop contributing. Soft (gameplay paused): fingers still down stay owned
   * but inert until they lift. Hard (focus lost): forget them entirely.
   */
  reset(hard?: boolean): void;
}

export interface InputOptions {
  /** Where gamepads come from; defaults to `navigator.getGamepads()`. */
  gamepads?: PadSource;
}

/**
 * Every input device translated into the engine's per-frame input:
 *
 * - keyboard, through the remappable `Bindings` (plus the one-shot key
 *   capture the settings panel uses to rebind an action);
 * - gamepads, polled once per fixed update (core/gamepad.ts);
 * - mouse / pen / touch as a logical-space menu `pointer` (core/pointer.ts);
 * - the on-screen touch controls, while gameplay asks for them.
 *
 * Gameplay reads one merged `snapshot()`; menus read the semantic
 * `menu*()` / `pausePressed()` calls and hit-test `pointer`. Constructible
 * headless — the DOM is only touched in `attach`, and every DOM handler is a
 * thin shell over a public method that tests drive directly.
 */
export class Input {
  bindings: Bindings;
  /** Device behind the most recent real input. */
  lastDevice: Device = 'keyboard';
  /** Gamepads, sampled by `poll()`. */
  readonly pads: GamepadReader;

  private held = new Set<string>();
  private pressedThisFrame = new Set<string>();
  /** UI-level edge events (menu confirm, pause…). */
  private uiPressed = new Set<string>();
  /** When true, the next key press is swallowed and reported as a capture. */
  private capturing = false;
  private captured: string | null = null;

  private ptr = new PointerTracker();
  private touchControls: TouchGameplay | null = null;
  private gameplayTouchOn = false;
  /** Consecutive polled frames each menu direction has been held. */
  private navHeld: Record<MenuDir, number> = { up: 0, down: 0, left: 0, right: 0 };
  /** Auto-repeat fires due this frame. */
  private navRepeat: Record<MenuDir, boolean> = { up: false, down: false, left: false, right: false };
  /** Canvas whose cursor is hidden while keyboard/pad drive (set by `attach`). */
  private canvas: HTMLCanvasElement | null = null;
  private cursorHidden = false;

  constructor(bindings: Bindings = new Bindings(), options: InputOptions = {}) {
    this.bindings = bindings;
    this.pads = new GamepadReader(options.gamepads ?? browserPads);
  }

  /**
   * Wires the DOM: keyboard on `target`, and — given the game canvas —
   * pointer events anywhere on the play surface. The letterbox bars count:
   * on a 19.5:9 phone the 16:9 canvas leaves bars exactly where thumbs
   * rest, and a stick that ignores them is a stick that misses.
   */
  attach(target: Window, canvas?: HTMLCanvasElement): void {
    target.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (this.keyDown(e.code)) e.preventDefault();
    });
    target.addEventListener('keyup', (e) => this.held.delete(e.code));
    target.addEventListener('blur', () => this.releaseAll());
    target.document?.addEventListener('visibilitychange', () => {
      if (target.document.hidden) this.releaseAll();
    });
    // Touch-first devices start with touch prompts (and controls) before the
    // first touch arrives.
    try {
      if (target.matchMedia?.('(pointer: coarse)').matches) this.lastDevice = 'touch';
    } catch {
      // No media queries: keep the keyboard default.
    }
    if (canvas) this.attachPointer(target, canvas);
  }

  private attachPointer(target: Window, canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    /** The canvas or an ancestor of it (the letterbox) — never page UI. */
    const onSurface = (e: Event): boolean => e.target instanceof Node && e.target.contains(canvas);
    const sample = (e: PointerEvent): PointerSample => {
      const p = clientToLogical(e.clientX, e.clientY, canvas.getBoundingClientRect());
      return { id: e.pointerId, x: p.x, y: p.y, type: pointerType(e.pointerType), buttons: e.buttons };
    };

    target.addEventListener('pointerdown', (e) => {
      if (!onSurface(e)) return;
      // Touch and pen: no emulated mouse events or long-press behaviour.
      // A mouse press keeps its default, which is what focuses the page (or
      // an embedding iframe) so the keyboard keeps working; and no focus()
      // by hand, which would light the keyboard focus ring on every tap.
      if (e.pointerType !== 'mouse') e.preventDefault();
      try {
        // Keep receiving the drag when it leaves the canvas (or the window).
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic or already-released pointer: nothing to capture.
      }
      this.pointerDown(sample(e));
    });
    target.addEventListener('pointermove', (e) => {
      if (onSurface(e)) this.pointerMove(sample(e));
    });
    target.addEventListener('pointerup', (e) => this.pointerUp(sample(e)));
    target.addEventListener('pointercancel', (e) => this.pointerCancel(e.pointerId));
    // Belt and braces: if capture is lost without an up (it happens on some
    // mobile browsers), a held stick must not keep running the hero.
    canvas.addEventListener('lostpointercapture', (e) => this.pointerCancel(e.pointerId));
    target.addEventListener('pointerout', (e) => {
      if (e.pointerType === 'mouse' && !e.relatedTarget) this.ptr.leave();
    });
    target.addEventListener(
      'wheel',
      (e) => {
        // Ctrl+wheel is the browser's zoom: an accessibility tool, left alone.
        if (!onSurface(e) || e.ctrlKey) return;
        e.preventDefault();
        this.wheel(normalizeWheel(e.deltaY, e.deltaMode));
      },
      { passive: false },
    );
    // iOS honours `touch-action` only partly: double-tap zoom and the
    // rubber-band still need the touch events themselves cancelled.
    const stopGesture = (e: TouchEvent) => {
      if (onSurface(e)) e.preventDefault();
    };
    target.addEventListener('touchstart', stopGesture, { passive: false });
    target.addEventListener('touchmove', stopGesture, { passive: false });
    target.addEventListener('contextmenu', (e) => {
      if (onSurface(e)) e.preventDefault(); // long-press menu on a game surface
    });
  }

  /* ------------------------------ Keyboard ------------------------------ */

  /**
   * A key went down (DOM keydown without auto-repeat, or a test). Returns
   * true when the browser's default action should be suppressed.
   */
  private keyDown(code: string): boolean {
    if (this.capturing) {
      // Rebinding: consume the key entirely, never feed it to gameplay.
      this.captured = code;
      this.capturing = false;
      return true;
    }
    this.held.add(code);
    this.pressedThisFrame.add(code);
    this.uiPressed.add(code);
    const bound = this.isBound(code);
    // Only keys that DO something switch prompts to the keyboard: media and
    // volume keys (which some phones report) must not hide touch controls.
    if (bound || code in KEY_DEVICE_SWITCH) this.noteDevice('keyboard');
    return ALWAYS_PREVENT.includes(code) || bound;
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

  /* ------------------------------ Gameplay ------------------------------ */

  /**
   * Snapshot for one physics frame: keyboard OR gamepad OR touch controls.
   * Call `endFrame()` after the update.
   */
  snapshot(): PlayerInput {
    const pad = this.pads.held;
    const t = this.touch;
    return {
      left: this.any('left') || pad.left || t.left,
      right: this.any('right') || pad.right || t.right,
      up: this.any('up') || pad.up || t.up,
      down: this.any('down') || pad.down || t.down,
      jump: this.any('jump') || pad.jump || t.jump,
      jumpPressed: this.anyPressed('jump') || this.pads.pressed.jump || t.jumpPressed,
    };
  }

  /**
   * Whether gameplay wants the on-screen touch controls. The level scene
   * turns this on while a run is live and off for pause, results and menus;
   * while off, touches are plain pointer input. Switching off releases any
   * held control at once — a paused hero must not resume already running.
   */
  setGameplayTouch(on: boolean): void {
    if (this.gameplayTouchOn === on) return;
    this.gameplayTouchOn = on;
    if (!on) this.touchControls?.reset();
  }

  get gameplayTouch(): boolean {
    return this.gameplayTouchOn;
  }

  /** Installs the on-screen controls (ui/TouchControls does this itself). */
  useTouchControls(controls: TouchGameplay | null): void {
    this.touchControls?.reset(true);
    this.touchControls = controls;
  }

  /** This frame's touch-control state (all false when there are none). */
  get touch(): Readonly<TouchFrame> {
    return this.touchControls?.frame ?? NO_TOUCH;
  }

  /** True while at least one gamepad is connected. */
  get padConnected(): boolean {
    return this.pads.connected > 0;
  }

  /**
   * Rumble the pad in the player's hands: `intensity` 0..1 for `ms`.
   * No-op without a pad or haptics support.
   */
  rumble(intensity: number, ms: number): void {
    this.pads.rumble(intensity, ms);
  }

  /* -------------------------------- Menus -------------------------------- */

  /** Edge-triggered raw key check (consumed by `endFrame`). */
  uiWasPressed(...codes: string[]): boolean {
    return codes.some((c) => this.uiPressed.has(c));
  }

  /**
   * Edge-triggered check of an action on every device: its bound keys, the
   * pad (face buttons jump, Start/Back pause, d-pad/stick move) and the
   * touch controls.
   */
  actionWasPressed(action: Action): boolean {
    if (this.bindings.codes(action).some((c) => this.uiPressed.has(c))) return true;
    const pad = this.pads.pressed;
    switch (action) {
      case 'jump':
        return pad.jump || this.touch.jumpPressed;
      case 'pause':
        return pad.pause || this.touch.pauseTapped;
      default:
        return pad[action];
    }
  }

  /** Menu confirm — same as `menuConfirm()` (kept for existing callers). */
  confirmPressed(): boolean {
    return this.menuConfirm();
  }

  menuUp(): boolean {
    return this.menuDir('up');
  }

  menuDown(): boolean {
    return this.menuDir('down');
  }

  menuLeft(): boolean {
    return this.menuDir('left');
  }

  menuRight(): boolean {
    return this.menuDir('right');
  }

  /** Enter (reserved, so it can never be rebound away), jump's keys, pad South. */
  menuConfirm(): boolean {
    return this.uiWasPressed(...CONFIRM_KEYS) || this.keyActionPressed('jump') || this.pads.pressed.confirm;
  }

  /** Escape, Backspace, pad East. */
  menuBack(): boolean {
    return this.uiWasPressed(...BACK_KEYS) || this.pads.pressed.back;
  }

  /** Pause's keys, pad Start or Back, the on-screen pause button. */
  pausePressed(): boolean {
    return this.actionWasPressed('pause');
  }

  /**
   * A menu direction fired this frame: its first press (arrow key, a key
   * bound to that direction, d-pad or stick) or an auto-repeat tick.
   */
  private menuDir(dir: MenuDir): boolean {
    return this.navKeys(dir).some((c) => this.uiPressed.has(c)) || this.pads.pressed.nav[dir] || this.navRepeat[dir];
  }

  private navKeys(dir: MenuDir): string[] {
    return [NAV_KEYS[dir], ...this.bindings.codes(dir)];
  }

  private keyActionPressed(action: Action): boolean {
    return this.bindings.codes(action).some((c) => this.uiPressed.has(c));
  }

  /* ------------------------------- Pointer ------------------------------- */

  /** The menu pointer (mouse, pen, or touches the controls did not claim). */
  get pointer(): Readonly<PointerState> {
    return this.ptr.state;
  }

  pointerDown(s: PointerSample): void {
    this.noteDevice(s.type === 'mouse' ? 'mouse' : 'touch');
    if (s.type !== 'mouse' && this.touchControls?.claim(s)) return;
    this.ptr.down(s);
  }

  pointerMove(s: PointerSample): void {
    if (this.touchControls?.owns(s.id)) {
      this.touchControls.move(s);
      return;
    }
    // A parked mouse does not move; only real travel claims the prompts.
    if (this.ptr.move(s) && s.type !== 'touch') this.noteDevice(s.type === 'mouse' ? 'mouse' : 'touch');
  }

  pointerUp(s: PointerSample): void {
    if (this.touchControls?.owns(s.id)) {
      this.touchControls.release(s.id);
      return;
    }
    this.ptr.up(s);
  }

  pointerCancel(id: number): void {
    if (this.touchControls?.owns(id)) {
      this.touchControls.release(id);
      return;
    }
    this.ptr.cancel(id);
  }

  /** Wheel distance in normalised pixels (see `normalizeWheel`). */
  wheel(px: number): void {
    this.noteDevice('mouse');
    this.ptr.wheel(px);
  }

  /* ------------------------------ Key capture ------------------------------ */

  /**
   * Swallow the next key press and report it via `takeCaptured()`. Only the
   * keyboard can be captured: pad buttons never become key codes, though they
   * still reach `menuBack()`, so a pad user can back out of a capture.
   */
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

  /* ------------------------------- Frame ------------------------------- */

  /**
   * Called once per fixed update, before the scene: samples the devices that
   * are polled rather than event driven (gamepads — Chrome only refreshes
   * them when asked) and advances menu auto-repeat.
   */
  poll(): void {
    this.pads.poll();
    if (this.pads.active) this.noteDevice('gamepad');
    for (const dir of Object.keys(NAV_KEYS) as MenuDir[]) {
      const held = this.navKeys(dir).some((c) => this.held.has(c)) || this.pads.held.nav[dir];
      this.navHeld[dir] = held ? this.navHeld[dir] + 1 : 0;
      this.navRepeat[dir] = repeatFires(this.navHeld[dir]);
    }
    this.syncCursor();
  }

  endFrame(): void {
    this.pressedThisFrame.clear();
    this.uiPressed.clear();
    this.pads.clearEdges();
    this.ptr.endFrame();
    this.touchControls?.endFrame();
    for (const dir of Object.keys(this.navRepeat) as MenuDir[]) this.navRepeat[dir] = false;
  }

  /** Focus lost or page hidden: nothing can still be held. */
  private releaseAll(): void {
    this.held.clear();
    this.ptr.reset();
    this.touchControls?.reset(true);
  }

  private noteDevice(d: Device): void {
    this.lastDevice = d;
    if (d === 'keyboard' || d === 'gamepad') this.ptr.hide();
  }

  /** Hide the OS cursor over the canvas while keyboard or pad is driving. */
  private syncCursor(): void {
    if (!this.canvas) return;
    const hide = this.lastDevice === 'keyboard' || this.lastDevice === 'gamepad';
    if (hide === this.cursorHidden) return;
    this.cursorHidden = hide;
    this.canvas.style.cursor = hide ? 'none' : '';
  }

  /** Test/debug hook: simulate a key press for one frame. */
  pressForTest(code: string): void {
    this.keyDown(code);
  }

  releaseForTest(code: string): void {
    this.held.delete(code);
  }
}

/** Unbound keys that still mean "the keyboard is in use" (menu keys). */
const KEY_DEVICE_SWITCH: Record<string, true> = Object.fromEntries(
  [...Object.values(NAV_KEYS), ...CONFIRM_KEYS, ...BACK_KEYS, 'Space', 'Tab'].map((k) => [k, true]),
);

function pointerType(t: string): PointerType {
  return t === 'touch' || t === 'pen' ? t : 'mouse';
}
