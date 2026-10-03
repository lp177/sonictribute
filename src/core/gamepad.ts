/**
 * Gamepad support: the W3C "standard" layout mapped onto the engine's
 * actions. The mapping is pure and reads pads through an injectable
 * `PadSource`, so every rule here runs headless with fake pads; only
 * `browserPads` touches `navigator`.
 *
 * Sonic convention: ANY face button jumps — the Mega Drive's A, B and C all
 * did, and a player mashing whichever button their thumb is on should never
 * be punished for it. Menus are stricter (South confirms, East backs out),
 * because there a wrong button commits to something.
 */

/** The four directions the engine understands. */
export interface Dirs {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

/** Minimal shape of a W3C GamepadButton (fakes in tests). */
export interface PadButtonLike {
  readonly pressed: boolean;
  readonly value: number;
}

/** Minimal shape of a W3C GamepadHapticActuator. */
export interface HapticsLike {
  playEffect?(
    type: 'dual-rumble',
    params: { startDelay: number; duration: number; weakMagnitude: number; strongMagnitude: number },
  ): Promise<unknown>;
}

/** Minimal shape of a W3C Gamepad: only what this module reads. */
export interface PadLike {
  readonly index: number;
  readonly connected: boolean;
  readonly mapping?: string;
  readonly axes: readonly number[];
  readonly buttons: readonly PadButtonLike[];
  readonly vibrationActuator?: HapticsLike | null;
}

/** Returns the current pads; slots may be null (unplugged pads keep their index). */
export type PadSource = () => ReadonlyArray<PadLike | null>;

/** Standard-mapping button indices. */
export const BTN = {
  south: 0,
  east: 1,
  west: 2,
  north: 3,
  select: 8,
  start: 9,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const;

/** How a stick's raw vector is turned into directions. */
export interface StickConfig {
  /** Radial distance a resting stick must exceed to register at all. */
  engage: number;
  /**
   * Radial distance it must fall back under to let go. Lower than `engage`:
   * that gap is the hysteresis that stops a stick resting on the threshold
   * (or a worn one drifting around it) from flickering on and off.
   */
  release: number;
  /**
   * Half-width in degrees of the four cardinal sectors; diagonals get the
   * rest (45 - cardinalHalf). 22.5 is a fair 8-way, 45 is pure 4-way.
   */
  cardinalHalf: number;
  /**
   * Degrees a held direction may overshoot its sector before switching, so a
   * stick held right on a sector boundary does not alternate between them.
   */
  hysteresis: number;
}

/** Gameplay stick: a true 8-way with a radial deadzone centred on ~0.3. */
export const STICK_8WAY: StickConfig = { engage: 0.35, release: 0.25, cardinalHalf: 22.5, hysteresis: 8 };

/**
 * Menu stick: 4-way. Lists move on one axis at a time; an 8-way read would
 * step a grid diagonally (or a list AND a slider) whenever the thumb is a
 * few degrees off.
 */
export const STICK_4WAY: StickConfig = { engage: 0.5, release: 0.35, cardinalHalf: 45, hysteresis: 10 };

/** Sector centres in screen space (y down): 0 = right, 2 = down, 4 = left, 6 = up. */
const sectorCentre = (s: number): number => s * 45;

/** Smallest absolute difference between two angles, in degrees. */
function angleDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Reads a stick vector as one of 8 sectors (0..7, clockwise from right in
 * screen space), or -1 when centred. `prev` is last frame's answer: it picks
 * the release threshold and lets a held sector keep its hysteresis margin.
 * Works in any unit — gamepad axes (-1..1) or touch-stick pixels.
 */
export function stickSector(x: number, y: number, prev: number, cfg: StickConfig): number {
  const mag = Math.hypot(x, y);
  if (mag < (prev >= 0 ? cfg.release : cfg.engage)) return -1;
  const angle = (Math.atan2(y, x) * 180) / Math.PI;
  const half = (s: number) => (s % 2 === 0 ? cfg.cardinalHalf : 45 - cfg.cardinalHalf);
  if (prev >= 0 && angleDist(angle, sectorCentre(prev)) <= half(prev) + cfg.hysteresis) return prev;
  // Cardinals first, so a pure 4-way config resolves exact diagonals to one.
  for (const s of [0, 2, 4, 6, 1, 3, 5, 7]) {
    if (angleDist(angle, sectorCentre(s)) <= half(s)) return s;
  }
  return -1; // unreachable: the sectors cover the circle
}

/** The directions a sector stands for (-1 → none). */
export function sectorDirs(s: number): Dirs {
  return {
    right: s === 7 || s === 0 || s === 1,
    down: s === 1 || s === 2 || s === 3,
    left: s === 3 || s === 4 || s === 5,
    up: s === 5 || s === 6 || s === 7,
  };
}

/** Everything the game reads from pads in one frame (all pads merged). */
export interface PadState extends Dirs {
  /** Any face button. */
  jump: boolean;
  /** Start or Back/Select. */
  pause: boolean;
  /** South (A) — menus only. */
  confirm: boolean;
  /** East (B) — menus only. */
  back: boolean;
  /** Menu directions: d-pad plus the stick read 4-way. */
  nav: Dirs;
}

const noDirs = (): Dirs => ({ left: false, right: false, up: false, down: false });

export function blankPadState(): PadState {
  return { ...noDirs(), jump: false, pause: false, confirm: false, back: false, nav: noDirs() };
}

/** Per-pad memory carried between polls (stick hysteresis, button edges). */
interface PadMemory {
  s8: number;
  s4: number;
  buttons: boolean[];
}

const isDown = (b: PadButtonLike | undefined): boolean => !!b && (b.pressed || b.value > 0.5);

/**
 * Maps one pad's raw state through the standard layout. Pads reporting a
 * non-standard mapping get the same indices as a best effort — most modern
 * pads the browser does not recognise still put the face buttons first.
 * `fresh` is true when this pad produced a NEW press (any button, or the
 * stick leaving its deadzone): that, and never a held state, is what marks
 * the gamepad as the device in use.
 */
export function readPad(pad: PadLike, mem: PadMemory): { state: PadState; fresh: boolean } {
  const ax = pad.axes[0] ?? 0;
  const ay = pad.axes[1] ?? 0;
  const s8 = stickSector(ax, ay, mem.s8, STICK_8WAY);
  const s4 = stickSector(ax, ay, mem.s4, STICK_4WAY);
  let fresh = s8 >= 0 && mem.s8 < 0;
  mem.s8 = s8;
  mem.s4 = s4;

  const btn = pad.buttons.map(isDown);
  for (let i = 0; i < btn.length; i++) if (btn[i] && !mem.buttons[i]) fresh = true;
  mem.buttons = btn;

  const d8 = sectorDirs(s8);
  const d4 = sectorDirs(s4);
  const dpad: Dirs = {
    up: !!btn[BTN.up],
    down: !!btn[BTN.down],
    left: !!btn[BTN.left],
    right: !!btn[BTN.right],
  };
  return {
    fresh,
    state: {
      left: dpad.left || d8.left,
      right: dpad.right || d8.right,
      up: dpad.up || d8.up,
      down: dpad.down || d8.down,
      jump: !!(btn[BTN.south] || btn[BTN.east] || btn[BTN.west] || btn[BTN.north]),
      pause: !!(btn[BTN.start] || btn[BTN.select]),
      confirm: !!btn[BTN.south],
      back: !!btn[BTN.east],
      nav: {
        left: dpad.left || d4.left,
        right: dpad.right || d4.right,
        up: dpad.up || d4.up,
        down: dpad.down || d4.down,
      },
    },
  };
}

/** OR `b` into `a`. */
function merge(a: PadState, b: PadState): void {
  for (const k of ['left', 'right', 'up', 'down'] as const) {
    a[k] ||= b[k];
    a.nav[k] ||= b.nav[k];
  }
  a.jump ||= b.jump;
  a.pause ||= b.pause;
  a.confirm ||= b.confirm;
  a.back ||= b.back;
}

/** `now && !before`, field by field. */
function rising(now: PadState, before: PadState, out: PadState): void {
  for (const k of ['left', 'right', 'up', 'down'] as const) {
    out[k] = now[k] && !before[k];
    out.nav[k] = now.nav[k] && !before.nav[k];
  }
  out.jump = now.jump && !before.jump;
  out.pause = now.pause && !before.pause;
  out.confirm = now.confirm && !before.confirm;
  out.back = now.back && !before.back;
}

/** `navigator.getGamepads()`, or nothing where the API is absent or blocked. */
export const browserPads: PadSource = () => {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return [];
    return navigator.getGamepads() as unknown as ReadonlyArray<PadLike | null>;
  } catch {
    // Permissions-Policy can forbid the API; that is "no pads", not a crash.
    return [];
  }
};

/**
 * Samples every connected pad once per fixed update and merges them: any
 * pad drives (a second controller picked up mid-run just works).
 *
 * Gamepads are polled, not event driven, and Chrome hands out SNAPSHOT
 * objects — a Gamepad kept from an earlier frame never changes — so the
 * source is re-read on every `poll()`. Connect and disconnect need no events
 * either: a pad that vanishes from the list stops contributing that same
 * frame (no stuck "right held" from a yanked cable) and its memory is
 * dropped, so it reconnects clean.
 */
export class GamepadReader {
  /** Merged held state this frame. */
  readonly held: PadState = blankPadState();
  /** Rising edges this frame (cleared by `clearEdges`). */
  readonly pressed: PadState = blankPadState();
  /** Connected pads at the last poll. */
  connected = 0;
  /** A pad produced a fresh press this frame. */
  active = false;

  private source: PadSource;
  private before: PadState = blankPadState();
  private memory = new Map<number, PadMemory>();
  private pads: PadLike[] = [];
  /** Index of the pad that last produced a press: the one in the player's hands. */
  private lastActive = -1;

  constructor(source: PadSource = browserPads) {
    this.source = source;
  }

  poll(): void {
    const merged = blankPadState();
    const seen = new Set<number>();
    this.pads = [];
    this.active = false;
    for (const pad of this.source()) {
      if (!pad || !pad.connected) continue;
      seen.add(pad.index);
      this.pads.push(pad);
      let mem = this.memory.get(pad.index);
      if (!mem) this.memory.set(pad.index, (mem = { s8: -1, s4: -1, buttons: [] }));
      const { state, fresh } = readPad(pad, mem);
      if (fresh) {
        this.active = true;
        this.lastActive = pad.index;
      }
      merge(merged, state);
    }
    for (const index of [...this.memory.keys()]) if (!seen.has(index)) this.memory.delete(index);
    this.connected = this.pads.length;

    rising(merged, this.before, this.pressed);
    Object.assign(this.held, merged, { nav: { ...merged.nav } });
    this.before = merged;
  }

  /** Forget this frame's edges (they belong to exactly one update). */
  clearEdges(): void {
    Object.assign(this.pressed, blankPadState());
    this.active = false;
  }

  /**
   * Rumbles the pad in the player's hands (or every pad, before any has been
   * used). `intensity` 0..1 drives both motors; `ms` is capped at Chrome's
   * 5 s limit. Feature-detected: pads or browsers without haptics do
   * nothing. Returns true when an effect was requested.
   */
  rumble(intensity: number, ms: number): boolean {
    const magnitude = Math.max(0, Math.min(1, intensity));
    const duration = Math.max(0, Math.min(5000, ms));
    if (magnitude === 0 || duration === 0) return false;
    const inHand = this.pads.filter((p) => p.index === this.lastActive);
    let requested = false;
    for (const pad of inHand.length ? inHand : this.pads) {
      const haptics = pad.vibrationActuator;
      if (typeof haptics?.playEffect !== 'function') continue;
      try {
        haptics
          .playEffect('dual-rumble', {
            startDelay: 0,
            duration,
            weakMagnitude: magnitude,
            strongMagnitude: magnitude,
          })
          .catch(() => {});
        requested = true;
      } catch {
        // A pad that claims haptics but throws is simply a pad without them.
      }
    }
    return requested;
  }
}
