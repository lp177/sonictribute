import { describe, it, expect } from 'vitest';
import { Input } from '../src/core/Input.ts';
import { Bindings, ACTIONS } from '../src/core/bindings.ts';
import { SettingsPanel } from '../src/ui/SettingsPanel.ts';
import { PauseMenu } from '../src/ui/PauseMenu.ts';

/** Presses keys for exactly one frame, then advances the panel. */
function frame(input: Input, panel: { update(i: Input): unknown }, ...codes: string[]) {
  for (const c of codes) input.pressForTest(c);
  const r = panel.update(input);
  input.endFrame();
  for (const c of codes) input.releaseForTest(c);
  return r;
}

function makeInput() {
  return new Input(new Bindings());
}

describe('Input — bindings driven', () => {
  it('maps held keys through the current bindings', () => {
    const input = makeInput();
    input.pressForTest('KeyD');
    expect(input.snapshot().right).toBe(true);
    expect(input.snapshot().left).toBe(false);
  });

  it('follows a rebind immediately', () => {
    const input = makeInput();
    input.bindings.set('jump', 'primary', 'KeyM');
    input.pressForTest('KeyM');
    const snap = input.snapshot();
    expect(snap.jump).toBe(true);
    expect(snap.jumpPressed).toBe(true);
  });

  it('stops responding to a key that was rebound away', () => {
    const input = makeInput();
    input.bindings.set('jump', 'primary', 'KeyM'); // Space no longer primary
    input.bindings.clear('jump', 'secondary');
    input.pressForTest('Space');
    expect(input.snapshot().jump).toBe(false);
  });

  it('treats Enter and the jump key as menu confirm', () => {
    const input = makeInput();
    input.pressForTest('Enter');
    expect(input.confirmPressed()).toBe(true);
    input.endFrame();
    input.pressForTest('Space');
    expect(input.confirmPressed()).toBe(true);
  });

  it('swallows the captured key instead of feeding it to gameplay', () => {
    const input = makeInput();
    input.beginCapture();
    expect(input.isCapturing).toBe(true);
    input.pressForTest('ArrowRight');
    expect(input.snapshot().right).toBe(false); // not applied to the hero
    expect(input.takeCaptured()).toBe('ArrowRight');
    expect(input.takeCaptured()).toBeNull(); // consumed once
    expect(input.isCapturing).toBe(false);
  });

  it('can cancel a capture', () => {
    const input = makeInput();
    input.beginCapture();
    input.cancelCapture();
    expect(input.isCapturing).toBe(false);
    expect(input.takeCaptured()).toBeNull();
  });
});

describe('SettingsPanel', () => {
  it('moves between rows and columns', () => {
    const input = makeInput();
    const p = new SettingsPanel();
    expect(p.row).toBe(0);
    frame(input, p, 'ArrowDown');
    expect(p.row).toBe(1);
    frame(input, p, 'ArrowRight');
    expect(p.col).toBe(1);
    frame(input, p, 'ArrowLeft');
    expect(p.col).toBe(0);
    frame(input, p, 'ArrowUp');
    expect(p.row).toBe(0);
  });

  it('wraps around the row list', () => {
    const input = makeInput();
    const p = new SettingsPanel();
    frame(input, p, 'ArrowUp');
    expect(p.row).toBe(ACTIONS.length + 1); // last row (BACK)
    frame(input, p, 'ArrowDown');
    expect(p.row).toBe(0);
  });

  it('rebinds the focused slot through a capture', () => {
    const input = makeInput();
    const p = new SettingsPanel();
    frame(input, p, 'Enter'); // start capture on row 0 (MOVE LEFT), primary
    expect(input.isCapturing).toBe(true);
    frame(input, p, 'KeyM'); // captured
    p.update(input); // apply
    expect(input.bindings.get('left').primary).toBe('KeyM');
  });

  it('cancels a capture with Escape without binding it', () => {
    const input = makeInput();
    const p = new SettingsPanel();
    frame(input, p, 'Enter');
    frame(input, p, 'Escape');
    p.update(input);
    expect(input.bindings.get('left').primary).toBe('ArrowLeft');
  });

  it('refuses to bind a reserved menu key', () => {
    const input = makeInput();
    const p = new SettingsPanel();
    frame(input, p, 'Enter');
    frame(input, p, 'Enter'); // captured 'Enter'
    p.update(input);
    expect(input.bindings.get('left').primary).toBe('ArrowLeft');
  });

  it('clears a secondary key with Backspace', () => {
    const input = makeInput();
    const p = new SettingsPanel();
    frame(input, p, 'ArrowRight'); // secondary column
    frame(input, p, 'Backspace');
    expect(input.bindings.get('left').secondary).toBeNull();
  });

  it('refuses to strip an action of its last key', () => {
    const input = makeInput();
    const p = new SettingsPanel();
    frame(input, p, 'ArrowRight');
    frame(input, p, 'Backspace'); // secondary gone
    frame(input, p, 'ArrowLeft');
    frame(input, p, 'Backspace'); // would leave MOVE LEFT unbound
    expect(input.bindings.codes('left').length).toBeGreaterThan(0);
    expect(input.bindings.isComplete()).toBe(true);
  });

  it('restores defaults from its reset row', () => {
    const input = makeInput();
    input.bindings.set('jump', 'primary', 'KeyM');
    const p = new SettingsPanel();
    p.row = ACTIONS.length; // RESET TO DEFAULTS
    frame(input, p, 'Enter');
    expect(input.bindings.get('jump').primary).toBe('Space');
  });

  it('closes from the back row and from Escape', () => {
    const input = makeInput();
    const p = new SettingsPanel();
    p.row = ACTIONS.length + 1;
    expect(frame(input, p, 'Enter')).toBe('close');
    const p2 = new SettingsPanel();
    expect(frame(input, p2, 'Escape')).toBe('close');
  });

  it('leaves every action bound no matter how it is driven', () => {
    const input = makeInput();
    const p = new SettingsPanel();
    // Hammer clear on every row/column.
    for (let r = 0; r < ACTIONS.length; r++) {
      p.row = r;
      for (const col of [0, 1] as const) {
        p.col = col;
        frame(input, p, 'Backspace');
      }
    }
    expect(input.bindings.isComplete()).toBe(true);
  });
});

describe('PauseMenu', () => {
  it('resumes on the pause key', () => {
    const input = makeInput();
    const m = new PauseMenu();
    expect(frame(input, m, 'Escape')).toBe('resume');
  });

  it('navigates and confirms an entry', () => {
    const input = makeInput();
    const m = new PauseMenu();
    frame(input, m, 'ArrowDown');
    expect(m.items[m.index].id).toBe('settings');
    expect(frame(input, m, 'Enter')).toBe('settings');
  });

  it('offers resume, settings, restart and quit', () => {
    expect(new PauseMenu().items.map((i) => i.id)).toEqual([
      'resume',
      'settings',
      'restart',
      'quit',
    ]);
  });

  it('wraps selection around', () => {
    const input = makeInput();
    const m = new PauseMenu();
    frame(input, m, 'ArrowUp');
    expect(m.items[m.index].id).toBe('quit');
  });

  it('follows a rebound pause key', () => {
    const input = makeInput();
    input.bindings.set('pause', 'primary', 'KeyQ');
    const m = new PauseMenu();
    expect(frame(input, m, 'KeyQ')).toBe('resume');
  });
});
