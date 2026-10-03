/**
 * Mouse, pen and touch as ONE menu pointer, in the 640x360 logical space the
 * menus are laid out in. Pure state fed by `Input`'s DOM layer (or by tests
 * with fake samples), so hit-testing logic never needs a browser.
 *
 * Gameplay touch controls do not go through here: `Input` offers each touch
 * to them first, and only touches they decline become pointer input.
 */
import { VIEW_W, VIEW_H } from './view.ts';

export type PointerType = 'mouse' | 'pen' | 'touch';

/** One pointer event, already mapped to logical coordinates. */
export interface PointerSample {
  id: number;
  x: number;
  y: number;
  type: PointerType;
  /** `PointerEvent.buttons`: bit 0 is the left button, pen tip or finger contact. */
  buttons: number;
}

/** What menus read. Edges and deltas last exactly one fixed update. */
export interface PointerState {
  /**
   * Logical position. May lie outside 0..VIEW_W / 0..VIEW_H when the pointer
   * is over the letterbox bars, so a hit-test there simply misses.
   */
  x: number;
  y: number;
  /** The position changed this frame. */
  moved: boolean;
  /** Movement this frame (same pointer only — a new finger landing is not a drag). */
  dx: number;
  dy: number;
  /** Primary button / pen tip / finger is down. */
  down: boolean;
  /** Went down this frame. */
  pressed: boolean;
  /** Came up this frame (not on a cancel: a cancelled touch never activates). */
  released: boolean;
  /** Where the current (or last) press started — for tap-vs-drag and same-item checks. */
  pressX: number;
  pressY: number;
  type: PointerType;
  /**
   * The position is worth showing: a mouse or pen moved or clicked, or a
   * finger is down. False after keyboard or gamepad input, once a finger
   * lifts (touch has no hover), and when the mouse leaves the window. Menus
   * should only draw hover — and only let hover move the selection — while
   * this is true, or a parked cursor fights the arrow keys.
   */
  visible: boolean;
  /** Wheel distance this frame in normalised pixels (positive = scroll down). */
  scrollDelta: number;
  /** Whole list steps this frame: one per mouse-wheel notch, trackpads accumulate. */
  scrollSteps: number;
}

/** The canvas's on-screen box (a DOMRect satisfies this). */
export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Client (CSS pixel) coordinates to logical ones. The canvas's CSS box is
 * the whole logical view, wherever the flex layout letterboxes it, so this is
 * a plain linear map through the bounding rect.
 */
export function clientToLogical(clientX: number, clientY: number, rect: RectLike): { x: number; y: number } {
  return {
    x: rect.width > 0 ? ((clientX - rect.left) * VIEW_W) / rect.width : 0,
    y: rect.height > 0 ? ((clientY - rect.top) * VIEW_H) / rect.height : 0,
  };
}

/** `WheelEvent.deltaMode` units to pixels (DOM_DELTA_LINE / DOM_DELTA_PAGE). */
export function normalizeWheel(deltaY: number, deltaMode: number): number {
  if (deltaMode === 1) return deltaY * 16;
  if (deltaMode === 2) return deltaY * VIEW_H;
  return deltaY;
}

/** Logical pixels of travel below which a "move" is sensor noise. */
const MOVE_EPSILON = 0.75;
/**
 * Wheel distance per list step. A mouse notch (Chrome ~100 px, Firefox
 * 3 lines = 48 px) is always exactly one step; smaller trackpad deltas
 * accumulate to it.
 */
const SCROLL_STEP = 40;

export function blankPointer(): PointerState {
  return {
    x: VIEW_W / 2,
    y: VIEW_H / 2,
    moved: false,
    dx: 0,
    dy: 0,
    down: false,
    pressed: false,
    released: false,
    pressX: 0,
    pressY: 0,
    type: 'mouse',
    visible: false,
    scrollDelta: 0,
    scrollSteps: 0,
  };
}

/**
 * Folds pointer samples into `state`. One pointer at a time drives it: the
 * mouse, or the first finger down — a second finger landing while the first
 * is still down is ignored, so a palm or a two-thumb grip cannot click a
 * menu item by accident.
 */
export class PointerTracker {
  readonly state: PointerState = blankPointer();
  /** Pointer currently holding `down`, or null. */
  private active: number | null = null;
  /** Pointer that last set the position (motion only counts as a drag for it). */
  private lastId: number | null = null;
  private scrollAcc = 0;

  /** Returns true when the sample really moved the pointer (noise filtered). */
  down(s: PointerSample): boolean {
    return this.sync(s);
  }

  move(s: PointerSample): boolean {
    return this.sync(s);
  }

  up(s: PointerSample): boolean {
    return this.sync({ ...s, buttons: 0 });
  }

  /** The browser took the pointer away (scroll gesture, alert…): no click. */
  cancel(id: number): void {
    if (this.active !== id) return;
    this.active = null;
    this.state.down = false;
    if (this.state.type === 'touch') this.state.visible = false;
  }

  /** Mouse wheel / trackpad scroll, in normalised pixels. */
  wheel(px: number): void {
    if (!Number.isFinite(px) || px === 0) return;
    this.state.scrollDelta += px;
    if (Math.abs(px) >= SCROLL_STEP) {
      this.state.scrollSteps += Math.sign(px);
      this.scrollAcc = 0;
      return;
    }
    // Trackpads stream small deltas; a reversal starts the count afresh.
    if (Math.sign(px) !== Math.sign(this.scrollAcc)) this.scrollAcc = 0;
    this.scrollAcc += px;
    while (Math.abs(this.scrollAcc) >= SCROLL_STEP) {
      this.state.scrollSteps += Math.sign(this.scrollAcc);
      this.scrollAcc -= Math.sign(this.scrollAcc) * SCROLL_STEP;
    }
  }

  /** Keyboard or gamepad took over: stop showing hover. */
  hide(): void {
    this.state.visible = false;
  }

  /** The mouse left the window: its last position is stale. */
  leave(): void {
    if (!this.state.down) this.state.visible = false;
  }

  /** Focus lost: nothing can still be held, and no edge is invented. */
  reset(): void {
    this.active = null;
    this.state.down = false;
    this.state.visible = false;
    this.scrollAcc = 0;
  }

  endFrame(): void {
    const s = this.state;
    s.moved = s.pressed = s.released = false;
    s.dx = s.dy = 0;
    s.scrollDelta = 0;
    s.scrollSteps = 0;
  }

  private sync(p: PointerSample): boolean {
    if (this.active !== null && this.active !== p.id) return false; // another pointer owns the press
    const s = this.state;
    const ddx = p.x - s.x;
    const ddy = p.y - s.y;
    const moved = Math.hypot(ddx, ddy) >= MOVE_EPSILON;
    if (this.lastId === p.id) {
      s.dx += ddx;
      s.dy += ddy;
    }
    this.lastId = p.id;
    s.x = p.x;
    s.y = p.y;
    s.type = p.type;
    if (moved) s.moved = true;

    const contact = (p.buttons & 1) !== 0;
    if (contact && !s.down) {
      s.down = true;
      s.pressed = true;
      s.pressX = p.x;
      s.pressY = p.y;
      this.active = p.id;
    } else if (!contact && s.down) {
      s.down = false;
      s.released = true;
      this.active = null;
    }

    // Touch has no hover: its position matters only while a finger is down.
    if (p.type === 'touch') s.visible = s.down;
    else if (moved || s.pressed || s.released) s.visible = true;
    return moved;
  }
}
