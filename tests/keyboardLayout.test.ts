import { describe, it, expect, afterEach } from 'vitest';
import {
  initKeyboardLayout,
  isAzerty,
  layoutLabel,
  setLayoutForTest,
} from '../src/core/keyboardLayout.ts';
import { keyLabel, DEFAULT_BINDINGS, type Action } from '../src/core/bindings.ts';

/** A believable slice of what Chromium's getLayoutMap() returns per layout. */
const AZERTY = {
  KeyQ: 'a',
  KeyW: 'z',
  KeyE: 'e',
  KeyA: 'q',
  KeyS: 's',
  KeyD: 'd',
  KeyZ: 'w',
  KeyM: ',',
  Semicolon: 'm',
};
const QWERTY = { KeyQ: 'q', KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyZ: 'z' };

function fakeNav(opts: { layout?: Record<string, string>; language?: string }): Navigator {
  return {
    language: opts.language ?? 'en-US',
    ...(opts.layout
      ? { keyboard: { getLayoutMap: async () => new Map(Object.entries(opts.layout!)) } }
      : {}),
  } as unknown as Navigator;
}

afterEach(() => setLayoutForTest(null, false));

describe('Keyboard layout detection', () => {
  it('detects AZERTY from the Keyboard Layout API', async () => {
    await initKeyboardLayout(fakeNav({ layout: AZERTY }));
    expect(isAzerty()).toBe(true);
  });

  it('detects QWERTY from the Keyboard Layout API, whatever the language', async () => {
    // A French speaker on a QWERTY machine must NOT get AZERTY labels: the
    // API reports the real layout and outranks the language heuristic.
    await initKeyboardLayout(fakeNav({ layout: QWERTY, language: 'fr-FR' }));
    expect(isAzerty()).toBe(false);
    expect(keyLabel('KeyW')).toBe('W');
  });

  it('falls back to the language heuristic when the API is missing', async () => {
    await initKeyboardLayout(fakeNav({ language: 'fr-FR' }));
    expect(isAzerty()).toBe(true);
    expect(keyLabel('KeyW')).toBe('Z');
    expect(keyLabel('KeyA')).toBe('Q');

    await initKeyboardLayout(fakeNav({ language: 'en-US' }));
    expect(isAzerty()).toBe(false);
    expect(keyLabel('KeyW')).toBe('W');
  });

  it('survives a missing navigator entirely (headless / SSR)', async () => {
    await initKeyboardLayout(undefined);
    expect(isAzerty()).toBe(false);
    expect(keyLabel('KeyW')).toBe('W');
  });
});

describe('Layout-aware key labels', () => {
  it('shows the character the key actually prints', async () => {
    await initKeyboardLayout(fakeNav({ layout: AZERTY }));
    expect(keyLabel('KeyW')).toBe('Z');
    expect(keyLabel('KeyA')).toBe('Q');
    expect(keyLabel('KeyZ')).toBe('W');
    expect(keyLabel('Semicolon')).toBe('M');
    expect(keyLabel('KeyS')).toBe('S');
  });

  it('never rewrites fixed-function keys', async () => {
    await initKeyboardLayout(fakeNav({ layout: { ...AZERTY, Space: ' ' } }));
    expect(keyLabel('Space')).toBe('SPACE');
    expect(keyLabel('ArrowLeft')).toBe('←');
    expect(keyLabel('Escape')).toBe('ESC');
  });

  it('ignores unprintable layout values and falls back to position names', () => {
    setLayoutForTest({ KeyE: 'dead', KeyR: ' ' }, false);
    expect(keyLabel('KeyE')).toBe('E');
    expect(keyLabel('KeyR')).toBe('R');
    expect(layoutLabel('KeyE')).toBeNull();
  });
});

describe('Fresh-player defaults on AZERTY', () => {
  it('reads as ZQSD without touching a single binding', async () => {
    // Bindings store physical positions, so the untouched defaults already
    // sit on the right keys — this pins that a fresh AZERTY player SEES them
    // as Z/Q/S/D too, which is the whole request.
    await initKeyboardLayout(fakeNav({ layout: AZERTY }));
    const shown = (a: Action) => keyLabel(DEFAULT_BINDINGS[a].secondary);
    expect(shown('up')).toBe('Z');
    expect(shown('left')).toBe('Q');
    expect(shown('down')).toBe('S');
    expect(shown('right')).toBe('D');
    // The jump alternate is the bottom-left letter key on both layouts.
    expect(shown('jump')).toBe('W');
  });
});
