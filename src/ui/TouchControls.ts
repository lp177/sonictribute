/**
 * On-screen controls for touch-first devices, drawn as an `Overlay` above
 * every scene: a floating stick on the left, one big JUMP on the right, a
 * small pause button top-right (clear of the HUD, which lives top-left).
 *
 * Designed for two thumbs on a landscape phone:
 *
 * - The stick FLOATS: its origin is wherever the left thumb lands, so there
 *   is no target to find without looking. If the thumb drifts past the rim,
 *   the origin trails behind it — reversing direction then takes one short
 *   flick instead of dragging all the way back across a fixed base.
 * - JUMP owns the whole right side (bar the pause button), not just its
 *   drawn circle: a panicked jump that misses by a few pixels is a lost
 *   life, and nothing else lives there.
 * - Every touch belongs to one control for its whole life, so the stick and
 *   jump work together — hold down + tap jump is a spin dash.
 *
 * All gesture logic is pure (logical coordinates in, `frame` out); `Input`
 * feeds it the touches and merges `frame` into the player's snapshot.
 */
import type { Overlay } from '../core/Game.ts';
import type { Device, Input, TouchFrame, TouchGameplay } from '../core/Input.ts';
import type { PointerSample } from '../core/pointer.ts';
import { stickSector, sectorDirs, type StickConfig } from '../core/gamepad.ts';
import { settings, type TouchMode } from '../core/settings.ts';
import { VIEW_W, VIEW_H } from '../core/view.ts';
import { TOUCH_INK, paintTouchRing, paintJumpIcon, paintPauseIcon } from './glyphs.ts';

/** Layout in logical pixels (640x360). */
export const TOUCH_LAYOUT = {
  /** Fraction of the screen width, from the left, that summons the stick. */
  stickZone: 0.45,
  stick: {
    /** Drag (logical px) before a direction registers… */
    deadzone: 10,
    /** …and the distance it must fall back under to let go (hysteresis). */
    release: 7,
    /** The rim: the origin trails the thumb beyond it. */
    radius: 34,
    knob: 14,
    /** Where the idle stick is drawn, as a hint of where it lives. */
    home: { x: 84, y: VIEW_H - 78 },
  },
  jump: { x: VIEW_W - 64, y: VIEW_H - 62, r: 30 },
  /** `hit` is the tap radius: bigger than the drawn button, as thumbs are. */
  pause: { x: VIEW_W - 22, y: 22, r: 11, hit: 24 },
} as const;

/**
 * Stick reading. Cardinal sectors are 60° and diagonals 30°: there is no
 * physical gate under a thumb on glass, and a platformer lives on pure
 * left/right (run) and pure down (roll, spin dash) — a thumb a few degrees
 * off must not read as a diagonal.
 */
const TOUCH_STICK: StickConfig = {
  engage: TOUCH_LAYOUT.stick.deadzone,
  release: TOUCH_LAYOUT.stick.release,
  cardinalHalf: 30,
  hysteresis: 8,
};

export type TouchZone = 'stick' | 'jump' | 'pause';

/** Which control a touch landing at logical (x, y) belongs to. Off-canvas counts. */
export function touchZone(x: number, y: number): TouchZone {
  const p = TOUCH_LAYOUT.pause;
  if (Math.hypot(x - p.x, y - p.y) <= p.hit) return 'pause';
  return x < VIEW_W * TOUCH_LAYOUT.stickZone ? 'stick' : 'jump';
}

/**
 * Whether the controls are on screen (and claiming touches). Never outside
 * gameplay — while gameplay is off, touches are menu input. 'on' forces
 * them; 'auto' follows the device in use: a touch device shows them until a
 * pad or keyboard takes over (a phone with a Bluetooth controller must not
 * keep thumb controls over the action), and the next touch brings them
 * back. A finger already down keeps them, so they never vanish mid-press.
 */
export function touchControlsShown(mode: TouchMode, gameplay: boolean, lastDevice: Device, touching: boolean): boolean {
  if (!gameplay || mode === 'off') return false;
  return mode === 'on' || lastDevice === 'touch' || touching;
}

type Role =
  | { kind: 'stick'; ox: number; oy: number; x: number; y: number; sector: number }
  | { kind: 'jump' }
  | { kind: 'pause' }
  /** A spare finger, or one left down across a pause: owned, but does nothing. */
  | { kind: 'inert' };

export interface TouchControlsOptions {
  /** Where the touch setting comes from; defaults to the live settings. */
  mode?: () => TouchMode;
}

/** Fixed frames the controls take to fade in or out. */
const FADE_FRAMES = 8;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export class TouchControls implements Overlay, TouchGameplay {
  readonly frame: TouchFrame = {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    jumpPressed: false,
    pauseTapped: false,
  };
  private input: Input;
  private mode: () => TouchMode;
  private roles = new Map<number, Role>();
  private alpha = 0;
  /** Frames a button stays lit after a tap, so even a flick visibly lands. */
  private jumpLit = 0;
  private pauseLit = 0;

  /** Binds itself to `input`: touches are offered here first from now on. */
  constructor(input: Input, options: TouchControlsOptions = {}) {
    this.input = input;
    this.mode = options.mode ?? (() => settings().touch);
    input.useTouchControls(this);
  }

  /** On screen and claiming touches right now. */
  get visible(): boolean {
    return touchControlsShown(this.mode(), this.input.gameplayTouch, this.input.lastDevice, this.roles.size > 0);
  }

  /** The pause button was tapped this frame (also folded into `input.pausePressed()`). */
  get pauseTapped(): boolean {
    return this.frame.pauseTapped;
  }

  /* --------------------------- TouchGameplay --------------------------- */

  claim(s: PointerSample): boolean {
    if (!this.visible) return false;
    let role: Role;
    switch (touchZone(s.x, s.y)) {
      case 'pause':
        role = { kind: 'pause' };
        this.frame.pauseTapped = true;
        this.pauseLit = FADE_FRAMES;
        break;
      case 'stick':
        // One stick: a second thumb on the left must not hijack it.
        role = this.stick() ? { kind: 'inert' } : { kind: 'stick', ox: s.x, oy: s.y, x: s.x, y: s.y, sector: -1 };
        break;
      case 'jump':
        role = { kind: 'jump' };
        this.frame.jumpPressed = true;
        this.jumpLit = 6;
        break;
    }
    this.roles.set(s.id, role);
    this.refresh();
    // Every touch while the controls are up is theirs, even an inert one:
    // nothing under them is a menu.
    return true;
  }

  owns(id: number): boolean {
    return this.roles.has(id);
  }

  move(s: PointerSample): void {
    const role = this.roles.get(s.id);
    if (role?.kind !== 'stick') return;
    const R = TOUCH_LAYOUT.stick.radius;
    let dx = s.x - role.ox;
    let dy = s.y - role.oy;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      // Trail the origin so it stays exactly one rim behind the thumb.
      dx = (dx / d) * R;
      dy = (dy / d) * R;
      role.ox = s.x - dx;
      role.oy = s.y - dy;
    }
    role.x = s.x;
    role.y = s.y;
    role.sector = stickSector(dx, dy, role.sector, TOUCH_STICK);
    this.refresh();
  }

  release(id: number): void {
    if (this.roles.delete(id)) this.refresh();
  }

  endFrame(): void {
    this.frame.jumpPressed = false;
    this.frame.pauseTapped = false;
  }

  reset(hard = false): void {
    if (hard) this.roles.clear();
    else for (const id of this.roles.keys()) this.roles.set(id, { kind: 'inert' });
    this.refresh();
  }

  /* ------------------------------ Overlay ------------------------------ */

  update(): void {
    const shown = this.visible;
    // Switched off (setting changed) under a held thumb: let go at once.
    if (!shown && [...this.roles.values()].some((r) => r.kind !== 'inert')) this.reset();
    const step = 1 / FADE_FRAMES;
    this.alpha = shown ? Math.min(1, this.alpha + step) : Math.max(0, this.alpha - step);
    if (this.jumpLit > 0) this.jumpLit--;
    if (this.pauseLit > 0) this.pauseLit--;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.alpha <= 0) return;
    ctx.globalAlpha = this.alpha;
    this.renderStick(ctx);
    this.renderJump(ctx);
    this.renderPause(ctx);
    ctx.globalAlpha = 1;
  }

  private renderStick(ctx: CanvasRenderingContext2D): void {
    const { radius: R, knob, home } = TOUCH_LAYOUT.stick;
    const st = this.stick();
    if (!st) {
      // Resting hint, fainter than a live stick: shows where it lives
      // without competing with the level.
      ctx.globalAlpha = this.alpha * 0.55;
      paintTouchRing(ctx, home.x, home.y, R, false);
      paintTouchRing(ctx, home.x, home.y, knob, false);
      ctx.globalAlpha = this.alpha;
      return;
    }
    // Drawn where it fits on screen (a thumb may land in the letterbox),
    // while the logic keeps the true origin; the knob shows the same offset.
    const bx = clamp(st.ox, R + 3, VIEW_W - R - 3);
    const by = clamp(st.oy, R + 3, VIEW_H - R - 3);
    paintTouchRing(ctx, bx, by, R, false);
    if (st.sector >= 0) {
      // Light the slice of rim the stick is reading, so a diagonal the
      // player did not mean is visible at a glance.
      const half = st.sector % 2 === 0 ? TOUCH_STICK.cardinalHalf : 45 - TOUCH_STICK.cardinalHalf;
      const c = (st.sector * 45 * Math.PI) / 180;
      const h = (half * Math.PI) / 180;
      ctx.strokeStyle = TOUCH_INK.strokeLit;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(bx, by, R, c - h, c + h);
      ctx.stroke();
    }
    paintTouchRing(ctx, bx + (st.x - st.ox), by + (st.y - st.oy), knob, true);
  }

  private renderJump(ctx: CanvasRenderingContext2D): void {
    const { x, y, r } = TOUCH_LAYOUT.jump;
    const lit = this.frame.jump || this.jumpLit > 0;
    // Pressed: brighter and a touch smaller, like a cap going down.
    const s = lit ? 0.93 : 1;
    paintTouchRing(ctx, x, y, r * s, lit, 2);
    paintJumpIcon(ctx, x, y, r * 0.62 * s, lit);
  }

  private renderPause(ctx: CanvasRenderingContext2D): void {
    const { x, y, r } = TOUCH_LAYOUT.pause;
    const lit = this.pauseLit > 0 || [...this.roles.values()].some((role) => role.kind === 'pause');
    paintTouchRing(ctx, x, y, r, lit, 1.25);
    paintPauseIcon(ctx, x, y, r * 0.9, lit);
  }

  /* ------------------------------ Helpers ------------------------------ */

  private stick(): Extract<Role, { kind: 'stick' }> | null {
    for (const r of this.roles.values()) if (r.kind === 'stick') return r;
    return null;
  }

  /** Recomputes the held part of `frame` from the live touches. */
  private refresh(): void {
    const f = this.frame;
    f.left = f.right = f.up = f.down = f.jump = false;
    for (const r of this.roles.values()) {
      if (r.kind === 'stick') {
        const d = sectorDirs(r.sector);
        f.left ||= d.left;
        f.right ||= d.right;
        f.up ||= d.up;
        f.down ||= d.down;
      } else if (r.kind === 'jump') {
        f.jump = true;
      }
    }
  }
}
