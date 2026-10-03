import { describe, it, expect } from 'vitest';
import { clientToLogical, normalizeWheel, type PointerSample, type PointerType } from '../src/core/pointer.ts';
import { Input } from '../src/core/Input.ts';
import { Bindings } from '../src/core/bindings.ts';
import { BTN, type PadLike } from '../src/core/gamepad.ts';

const sample = (id: number, x: number, y: number, type: PointerType = 'mouse', buttons = 0): PointerSample => ({
  id,
  x,
  y,
  type,
  buttons,
});

function makeInput(pads: PadLike[] = []) {
  return new Input(new Bindings(), { gamepads: () => pads });
}

describe('clientToLogical', () => {
  // A 1600x720 window: the 16:9 canvas is 1280x720, letterboxed 160 px each side.
  const rect = { left: 160, top: 0, width: 1280, height: 720 };

  it('maps the letterboxed canvas box onto 640x360', () => {
    expect(clientToLogical(160, 0, rect)).toEqual({ x: 0, y: 0 });
    expect(clientToLogical(1440, 720, rect)).toEqual({ x: 640, y: 360 });
    expect(clientToLogical(800, 360, rect)).toEqual({ x: 320, y: 180 });
  });

  it('pillarboxed vertically too (tall window)', () => {
    const tall = { left: 0, top: 120, width: 960, height: 540 };
    expect(clientToLogical(480, 390, tall)).toEqual({ x: 320, y: 180 });
  });

  it('reports the letterbox bars outside the logical view, not clamped', () => {
    expect(clientToLogical(80, 360, rect).x).toBeLessThan(0);
    expect(clientToLogical(1520, 360, rect).x).toBeGreaterThan(640);
  });

  it('survives a collapsed canvas', () => {
    expect(clientToLogical(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe('normalizeWheel', () => {
  it('converts line and page deltas to pixels', () => {
    expect(normalizeWheel(100, 0)).toBe(100);
    expect(normalizeWheel(3, 1)).toBe(48);
    expect(normalizeWheel(1, 2)).toBe(360);
  });
});

describe('Input.pointer — mouse', () => {
  it('tracks hover position and movement for one frame', () => {
    const input = makeInput();
    input.pointerMove(sample(1, 100, 50));
    expect(input.pointer.x).toBe(100);
    expect(input.pointer.y).toBe(50);
    expect(input.pointer.moved).toBe(true);
    expect(input.pointer.visible).toBe(true);
    expect(input.lastDevice).toBe('mouse');
    input.endFrame();
    expect(input.pointer.moved).toBe(false);
    expect(input.pointer.visible).toBe(true); // a parked mouse is still there
  });

  it('ignores sub-pixel jitter (a parked mouse does not claim the prompts)', () => {
    const input = makeInput();
    input.pointerMove(sample(1, 100, 50));
    input.endFrame();
    input.pressForTest('ArrowDown');
    expect(input.lastDevice).toBe('keyboard');
    input.pointerMove(sample(1, 100.2, 50.1));
    expect(input.pointer.moved).toBe(false);
    expect(input.lastDevice).toBe('keyboard');
  });

  it('press and release are one-frame edges; down persists', () => {
    const input = makeInput();
    input.pointerDown(sample(1, 200, 100, 'mouse', 1));
    expect(input.pointer.pressed).toBe(true);
    expect(input.pointer.down).toBe(true);
    expect([input.pointer.pressX, input.pointer.pressY]).toEqual([200, 100]);
    input.endFrame();
    expect(input.pointer.pressed).toBe(false);
    expect(input.pointer.down).toBe(true);
    input.pointerUp(sample(1, 210, 100, 'mouse', 0));
    expect(input.pointer.released).toBe(true);
    expect(input.pointer.down).toBe(false);
    input.endFrame();
    expect(input.pointer.released).toBe(false);
  });

  it('a right or middle click is not a press', () => {
    const input = makeInput();
    input.pointerDown(sample(1, 200, 100, 'mouse', 2));
    expect(input.pointer.pressed).toBe(false);
    expect(input.pointer.down).toBe(false);
  });

  it('a press chorded after another button still registers', () => {
    const input = makeInput();
    input.pointerDown(sample(1, 200, 100, 'mouse', 2)); // right first
    input.pointerMove(sample(1, 200, 100, 'mouse', 3)); // then left: arrives as a move
    expect(input.pointer.pressed).toBe(true);
  });

  it('reports drag deltas in logical pixels', () => {
    const input = makeInput();
    input.pointerDown(sample(1, 100, 100, 'mouse', 1));
    input.endFrame();
    input.pointerMove(sample(1, 104, 110, 'mouse', 1));
    input.pointerMove(sample(1, 106, 112, 'mouse', 1));
    expect([input.pointer.dx, input.pointer.dy]).toEqual([6, 12]);
  });

  it('hides when the keyboard or a pad takes over', () => {
    const pad = {
      index: 0,
      connected: true,
      axes: [0, 0],
      buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === BTN.south, value: i === BTN.south ? 1 : 0 })),
    };
    const input = makeInput();
    input.pointerMove(sample(1, 10, 10));
    expect(input.pointer.visible).toBe(true);
    input.pressForTest('ArrowUp');
    expect(input.pointer.visible).toBe(false);
    input.endFrame();
    input.pointerMove(sample(1, 30, 30));
    expect(input.pointer.visible).toBe(true);

    const withPad = makeInput([pad]);
    withPad.pointerMove(sample(1, 10, 10));
    withPad.poll();
    expect(withPad.pointer.visible).toBe(false);
    expect(withPad.lastDevice).toBe('gamepad');
  });

  it('wheel: one list step per notch in any browser, trackpads accumulate', () => {
    const input = makeInput();
    input.wheel(100); // Chrome notch
    expect(input.pointer.scrollDelta).toBe(100);
    expect(input.pointer.scrollSteps).toBe(1);
    input.endFrame();
    input.wheel(normalizeWheel(3, 1)); // Firefox notch (3 lines)
    expect(input.pointer.scrollSteps).toBe(1);
    input.endFrame();
    input.wheel(-100);
    expect(input.pointer.scrollSteps).toBe(-1);
    input.endFrame();
    // Trackpad: a stream of small deltas.
    let steps = 0;
    for (let k = 0; k < 10; k++) {
      input.wheel(8);
      steps += input.pointer.scrollSteps;
      input.endFrame();
    }
    expect(steps).toBe(2); // 80 px
  });
});

describe('Input.pointer — touch and pen', () => {
  it('the first finger drives the pointer; a second is ignored', () => {
    const input = makeInput();
    input.pointerDown(sample(7, 100, 100, 'touch', 1));
    expect(input.pointer.pressed).toBe(true);
    expect(input.lastDevice).toBe('touch');
    input.endFrame();
    input.pointerDown(sample(8, 500, 300, 'touch', 1)); // palm / second thumb
    expect(input.pointer.pressed).toBe(false);
    expect(input.pointer.x).toBe(100);
    input.pointerUp(sample(8, 500, 300, 'touch'));
    expect(input.pointer.released).toBe(false);
    input.pointerUp(sample(7, 100, 100, 'touch'));
    expect(input.pointer.released).toBe(true);
  });

  it('touch has no hover: visible only while a finger is down', () => {
    const input = makeInput();
    input.pointerDown(sample(1, 100, 100, 'touch', 1));
    expect(input.pointer.visible).toBe(true);
    input.pointerUp(sample(1, 100, 100, 'touch'));
    expect(input.pointer.visible).toBe(false);
  });

  it('a new finger landing elsewhere is a jump, not a drag', () => {
    const input = makeInput();
    input.pointerDown(sample(1, 100, 100, 'touch', 1));
    input.pointerUp(sample(1, 100, 100, 'touch'));
    input.endFrame();
    input.pointerDown(sample(2, 400, 200, 'touch', 1));
    expect([input.pointer.dx, input.pointer.dy]).toEqual([0, 0]);
    expect(input.pointer.moved).toBe(true);
  });

  it('a cancelled touch never activates (no released edge)', () => {
    const input = makeInput();
    input.pointerDown(sample(1, 100, 100, 'touch', 1));
    input.endFrame();
    input.pointerCancel(1);
    expect(input.pointer.down).toBe(false);
    expect(input.pointer.released).toBe(false);
  });

  it('a pen counts as a touch device for prompts', () => {
    const input = makeInput();
    input.pointerDown(sample(3, 50, 50, 'pen', 1));
    expect(input.lastDevice).toBe('touch');
    expect(input.pointer.type).toBe('pen');
    expect(input.pointer.pressed).toBe(true);
  });
});
