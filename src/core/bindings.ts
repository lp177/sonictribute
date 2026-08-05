/**
 * Remappable key bindings: every action has a primary and an optional
 * secondary key. Pure logic + a guarded localStorage layer, so it is fully
 * unit-testable headless.
 */

import { layoutLabel } from './keyboardLayout.ts';

export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'pause';
export type Slot = 'primary' | 'secondary';

export interface Binding {
  primary: string | null;
  secondary: string | null;
}

/** Display order and labels for the settings panel. */
export const ACTIONS: { id: Action; label: string; hint: string }[] = [
  { id: 'left', label: 'MOVE LEFT', hint: '' },
  { id: 'right', label: 'MOVE RIGHT', hint: '' },
  { id: 'up', label: 'LOOK UP', hint: '' },
  { id: 'down', label: 'CROUCH / ROLL', hint: 'hold + jump to spin dash' },
  { id: 'jump', label: 'JUMP', hint: '' },
  { id: 'pause', label: 'PAUSE MENU', hint: '' },
];

export const DEFAULT_BINDINGS: Record<Action, Binding> = {
  left: { primary: 'ArrowLeft', secondary: 'KeyA' },
  right: { primary: 'ArrowRight', secondary: 'KeyD' },
  up: { primary: 'ArrowUp', secondary: 'KeyW' },
  down: { primary: 'ArrowDown', secondary: 'KeyS' },
  jump: { primary: 'Space', secondary: 'KeyZ' },
  pause: { primary: 'Escape', secondary: 'KeyP' },
};

const STORAGE_KEY = 'bolt.bindings.v1';

/** Keys the UI always owns, so a rebind can never lock the player out. */
export const RESERVED_UI_KEYS = ['Enter'];

/** Human-readable label for a key code (menus show these, not raw codes). */
export function keyLabel(code: string | null): string {
  if (!code) return '—';
  // Fixed-function keys read the same on every layout.
  const fixed: Record<string, string> = {
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    Space: 'SPACE',
    Enter: 'ENTER',
    Escape: 'ESC',
    ShiftLeft: 'L-SHIFT',
    ShiftRight: 'R-SHIFT',
    ControlLeft: 'L-CTRL',
    ControlRight: 'R-CTRL',
    AltLeft: 'L-ALT',
    AltRight: 'R-ALT',
    Tab: 'TAB',
    Backspace: 'BKSP',
  };
  if (fixed[code]) return fixed[code];
  if (code.startsWith('Numpad')) return `NUM ${code.slice(6)}`;
  // Character keys show what the player's keyboard actually prints there:
  // codes are positional, so 'KeyW' is the Z key on AZERTY — naming it "W"
  // is how a correct positional default gets mistaken for WASD.
  const printed = layoutLabel(code);
  if (printed) return printed;
  const punct: Record<string, string> = {
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
  };
  if (punct[code]) return punct[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code.toUpperCase();
}

export class Bindings {
  private map: Record<Action, Binding>;

  constructor(initial?: Partial<Record<Action, Binding>>) {
    this.map = cloneDefaults();
    if (initial) {
      for (const a of Object.keys(this.map) as Action[]) {
        const b = initial[a];
        if (b) this.map[a] = { primary: b.primary ?? null, secondary: b.secondary ?? null };
      }
    }
  }

  get(action: Action): Binding {
    return { ...this.map[action] };
  }

  /** Every key currently bound to an action (skipping empty slots). */
  codes(action: Action): string[] {
    const b = this.map[action];
    return [b.primary, b.secondary].filter((c): c is string => !!c);
  }

  /** Which action+slot a key is bound to, if any. */
  findConflict(code: string): { action: Action; slot: Slot } | null {
    for (const action of Object.keys(this.map) as Action[]) {
      if (this.map[action].primary === code) return { action, slot: 'primary' };
      if (this.map[action].secondary === code) return { action, slot: 'secondary' };
    }
    return null;
  }

  /**
   * Binds `code` to a slot. A key can only serve one action, so any previous
   * owner loses it. Returns false (changing nothing) for reserved UI keys.
   */
  set(action: Action, slot: Slot, code: string | null): boolean {
    if (code && RESERVED_UI_KEYS.includes(code)) return false;
    if (code) {
      const clash = this.findConflict(code);
      if (clash && !(clash.action === action && clash.slot === slot)) {
        this.map[clash.action][clash.slot] = null;
      }
    }
    this.map[action][slot] = code;
    // An action with only a secondary key promotes it, so `primary` is always
    // the one shown first and never a hole.
    const b = this.map[action];
    if (!b.primary && b.secondary) {
      b.primary = b.secondary;
      b.secondary = null;
    }
    return true;
  }

  clear(action: Action, slot: Slot): void {
    this.set(action, slot, null);
  }

  reset(): void {
    this.map = cloneDefaults();
  }

  /** True when every action can still be triggered by at least one key. */
  isComplete(): boolean {
    return (Object.keys(this.map) as Action[]).every((a) => this.codes(a).length > 0);
  }

  toJSON(): Record<Action, Binding> {
    return JSON.parse(JSON.stringify(this.map));
  }

  /** Persist to localStorage; silently no-ops where storage is unavailable. */
  save(): void {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.map));
    } catch {
      // Private mode / disabled storage — bindings simply do not persist.
    }
  }

  static load(): Bindings {
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      if (raw) return new Bindings(JSON.parse(raw) as Partial<Record<Action, Binding>>);
    } catch {
      // Corrupt or unavailable storage falls back to defaults.
    }
    return new Bindings();
  }
}

function cloneDefaults(): Record<Action, Binding> {
  return JSON.parse(JSON.stringify(DEFAULT_BINDINGS)) as Record<Action, Binding>;
}
