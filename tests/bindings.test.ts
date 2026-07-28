import { describe, it, expect, beforeEach } from 'vitest';
import {
  Bindings,
  ACTIONS,
  DEFAULT_BINDINGS,
  RESERVED_UI_KEYS,
  keyLabel,
  type Action,
} from '../src/core/bindings.ts';

/** Minimal in-memory localStorage so persistence is testable headless. */
function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

describe('Bindings — defaults', () => {
  it('binds every listed action out of the box', () => {
    const b = new Bindings();
    for (const a of ACTIONS) expect(b.codes(a.id).length).toBeGreaterThan(0);
    expect(b.isComplete()).toBe(true);
  });

  it('ships the classic arrows + WASD layout', () => {
    const b = new Bindings();
    expect(b.get('left')).toEqual({ primary: 'ArrowLeft', secondary: 'KeyA' });
    expect(b.get('jump').primary).toBe('Space');
    expect(b.get('pause').primary).toBe('Escape');
  });

  it('never hands out a reference into its own state', () => {
    const b = new Bindings();
    const got = b.get('left');
    got.primary = 'KeyQ';
    expect(b.get('left').primary).toBe('ArrowLeft');
  });
});

describe('Bindings — remapping', () => {
  let b: Bindings;
  beforeEach(() => {
    b = new Bindings();
  });

  it('rebinds a primary key', () => {
    expect(b.set('jump', 'primary', 'KeyM')).toBe(true);
    expect(b.get('jump').primary).toBe('KeyM');
    expect(b.codes('jump')).toContain('KeyM');
  });

  it('sets an optional secondary key', () => {
    b.set('pause', 'secondary', 'KeyQ');
    expect(b.codes('pause')).toEqual(['Escape', 'KeyQ']);
  });

  it('steals a key from whichever action held it', () => {
    b.set('jump', 'primary', 'ArrowUp'); // was up.primary
    expect(b.get('jump').primary).toBe('ArrowUp');
    expect(b.get('up').primary).not.toBe('ArrowUp');
    // No key is ever bound twice.
    const all = ACTIONS.flatMap((a) => b.codes(a.id));
    expect(new Set(all).size).toBe(all.length);
  });

  it('rebinding a slot to the key it already holds is a no-op', () => {
    b.set('left', 'primary', 'ArrowLeft');
    expect(b.get('left')).toEqual({ primary: 'ArrowLeft', secondary: 'KeyA' });
  });

  it('refuses reserved menu keys so the player cannot lock themselves out', () => {
    for (const key of RESERVED_UI_KEYS) {
      expect(b.set('jump', 'primary', key)).toBe(false);
      expect(b.get('jump').primary).toBe('Space');
    }
  });

  it('promotes the secondary when the primary is cleared', () => {
    b.clear('left', 'primary');
    expect(b.get('left')).toEqual({ primary: 'KeyA', secondary: null });
    expect(b.codes('left')).toEqual(['KeyA']);
  });

  it('can clear a secondary without touching the primary', () => {
    b.clear('right', 'secondary');
    expect(b.get('right')).toEqual({ primary: 'ArrowRight', secondary: null });
  });

  it('reports an action left with no key at all', () => {
    b.clear('down', 'secondary');
    b.clear('down', 'primary');
    expect(b.codes('down')).toEqual([]);
    expect(b.isComplete()).toBe(false);
  });

  it('finds which action owns a key', () => {
    expect(b.findConflict('KeyA')).toEqual({ action: 'left', slot: 'secondary' });
    expect(b.findConflict('KeyJ')).toBeNull();
  });

  it('restores every default on reset', () => {
    b.set('jump', 'primary', 'KeyM');
    b.clear('up', 'secondary');
    b.reset();
    expect(b.toJSON()).toEqual(DEFAULT_BINDINGS);
  });
});

describe('Bindings — persistence', () => {
  it('round-trips through storage', () => {
    const store = fakeStorage();
    (globalThis as { localStorage?: Storage }).localStorage = store;
    try {
      const b = new Bindings();
      b.set('jump', 'primary', 'KeyM');
      b.set('pause', 'secondary', 'KeyQ');
      b.save();
      const loaded = Bindings.load();
      expect(loaded.get('jump').primary).toBe('KeyM');
      expect(loaded.codes('pause')).toEqual(['Escape', 'KeyQ']);
    } finally {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  });

  it('falls back to defaults when storage is missing or corrupt', () => {
    expect(Bindings.load().toJSON()).toEqual(DEFAULT_BINDINGS); // no storage at all
    const store = fakeStorage();
    store.setItem('bolt.bindings.v1', '{not json');
    (globalThis as { localStorage?: Storage }).localStorage = store;
    try {
      expect(Bindings.load().toJSON()).toEqual(DEFAULT_BINDINGS);
    } finally {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  });

  it('saving without storage does not throw', () => {
    expect(() => new Bindings().save()).not.toThrow();
  });

  it('keeps unknown actions out and fills gaps from defaults', () => {
    const partial = new Bindings({ jump: { primary: 'KeyM', secondary: null } });
    expect(partial.get('jump').primary).toBe('KeyM');
    expect(partial.get('left').primary).toBe('ArrowLeft'); // untouched default
  });
});

describe('keyLabel', () => {
  it('renders arrows, letters, digits and specials readably', () => {
    expect(keyLabel('ArrowLeft')).toBe('←');
    expect(keyLabel('KeyA')).toBe('A');
    expect(keyLabel('Digit5')).toBe('5');
    expect(keyLabel('Space')).toBe('SPACE');
    expect(keyLabel('Escape')).toBe('ESC');
    expect(keyLabel('Numpad4')).toBe('NUM 4');
  });

  it('marks an empty slot', () => {
    expect(keyLabel(null)).toBe('—');
  });

  it('has a label for every default key', () => {
    for (const a of Object.keys(DEFAULT_BINDINGS) as Action[]) {
      for (const code of [DEFAULT_BINDINGS[a].primary, DEFAULT_BINDINGS[a].secondary]) {
        if (code) expect(keyLabel(code)).not.toBe(code); // not a raw code leak
      }
    }
  });
});
