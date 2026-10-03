import { describe, it, expect } from 'vitest';
import { Input } from '../src/core/Input.ts';
import { Bindings } from '../src/core/bindings.ts';
import type { PointerSample } from '../src/core/pointer.ts';
import type { PadLike } from '../src/core/gamepad.ts';
import type { TouchMode } from '../src/core/settings.ts';
import { TOUCH_LAYOUT, TouchControls, touchControlsShown, touchZone } from '../src/ui/TouchControls.ts';
import { drawPadButton, drawTouchGlyph, type PadGlyph } from '../src/ui/glyphs.ts';

const finger = (id: number, x: number, y: number, down = true): PointerSample => ({
  id,
  x,
  y,
  type: 'touch',
  buttons: down ? 1 : 0,
});

/** Input + controls with a settable touch mode and pads; gameplay touch on by default. */
function rig(opts: { mode?: TouchMode; gameplay?: boolean; pads?: PadLike[] } = {}) {
  let mode: TouchMode = opts.mode ?? 'auto';
  const input = new Input(new Bindings(), { gamepads: () => opts.pads ?? [] });
  const controls = new TouchControls(input, { mode: () => mode });
  input.setGameplayTouch(opts.gameplay ?? true);
  return {
    input,
    controls,
    setMode: (m: TouchMode) => (mode = m),
  };
}

/** A stick touch: lands at (x, y) then drags by (dx, dy). */
function drag(input: Input, id: number, x: number, y: number, dx: number, dy: number) {
  input.pointerDown(finger(id, x, y));
  input.pointerMove(finger(id, x + dx, y + dy));
}

describe('touchZone', () => {
  it('left 45% is the stick, the rest is jump, top-right corner is pause', () => {
    expect(touchZone(40, 300)).toBe('stick');
    expect(touchZone(640 * 0.45 - 1, 100)).toBe('stick');
    expect(touchZone(640 * 0.45 + 1, 100)).toBe('jump');
    expect(touchZone(600, 330)).toBe('jump');
    expect(touchZone(TOUCH_LAYOUT.pause.x, TOUCH_LAYOUT.pause.y)).toBe('pause');
  });

  it('the whole lower-right quadrant is jump, not just the drawn button', () => {
    for (const [x, y] of [
      [330, 190],
      [639, 359],
      [480, 260],
      [TOUCH_LAYOUT.jump.x + 50, TOUCH_LAYOUT.jump.y - 60],
    ]) {
      expect(touchZone(x, y)).toBe('jump');
    }
  });

  it('thumbs resting in the letterbox bars still land on a control', () => {
    expect(touchZone(-30, 250)).toBe('stick');
    expect(touchZone(700, 300)).toBe('jump');
  });
});

describe('touchControlsShown', () => {
  it('never outside gameplay, never when off', () => {
    expect(touchControlsShown('on', false, 'touch', false)).toBe(false);
    expect(touchControlsShown('off', true, 'touch', true)).toBe(false);
  });

  it("'on' forces them; 'auto' follows the device in use", () => {
    expect(touchControlsShown('on', true, 'keyboard', false)).toBe(true);
    expect(touchControlsShown('auto', true, 'touch', false)).toBe(true);
    expect(touchControlsShown('auto', true, 'gamepad', false)).toBe(false);
    expect(touchControlsShown('auto', true, 'keyboard', false)).toBe(false);
  });

  it('a finger already down keeps them on screen', () => {
    expect(touchControlsShown('auto', true, 'gamepad', true)).toBe(true);
  });
});

describe('TouchControls — floating stick', () => {
  it('drag direction gives the direction, from wherever the thumb landed', () => {
    const { input } = rig();
    drag(input, 1, 120, 250, 20, 0);
    expect(input.snapshot().right).toBe(true);
    input.pointerMove(finger(1, 100, 250));
    expect(input.snapshot()).toMatchObject({ left: true, right: false });
    input.pointerMove(finger(1, 120, 275));
    expect(input.snapshot()).toMatchObject({ down: true, left: false, right: false });
  });

  it('a small wobble inside the deadzone does nothing', () => {
    const { input } = rig();
    drag(input, 1, 120, 250, 6, 4);
    const s = input.snapshot();
    expect(s.left || s.right || s.up || s.down).toBe(false);
  });

  it('reads 8 ways, but favours pure left/right/down', () => {
    const { input } = rig();
    drag(input, 1, 120, 250, 20, 20); // 45°
    expect(input.snapshot()).toMatchObject({ right: true, down: true });
    input.pointerUp(finger(1, 140, 270, false));
    const a = (25 * Math.PI) / 180; // 25° off horizontal: still a pure run
    drag(input, 2, 120, 250, 30 * Math.cos(a), 30 * Math.sin(a));
    expect(input.snapshot()).toMatchObject({ right: true, down: false });
  });

  it('the origin trails the thumb, so reversing after an overshoot is a short flick', () => {
    const { input } = rig();
    drag(input, 1, 100, 250, 100, 0); // far past the rim
    expect(input.snapshot().right).toBe(true);
    // The origin trailed to 200 - 34 = 166. Pulling back 50 px is still +50
    // from where the thumb landed, but -16 from the trailed origin: the hero
    // turns around without the thumb crossing the whole screen back.
    input.pointerMove(finger(1, 150, 250));
    expect(input.snapshot()).toMatchObject({ left: true, right: false });
  });

  it('lifting the thumb lets go', () => {
    const { input } = rig();
    drag(input, 1, 120, 250, 25, 0);
    input.pointerUp(finger(1, 145, 250, false));
    expect(input.snapshot().right).toBe(false);
  });

  it('a cancelled touch lets go too (no stuck run)', () => {
    const { input } = rig();
    drag(input, 1, 120, 250, 25, 0);
    input.pointerCancel(1);
    expect(input.snapshot().right).toBe(false);
  });

  it('a second thumb on the left cannot hijack the stick', () => {
    const { input } = rig();
    drag(input, 1, 120, 250, 25, 0);
    drag(input, 2, 60, 200, -25, 0);
    expect(input.snapshot()).toMatchObject({ right: true, left: false });
  });

  it('a thumb landing in the letterbox bar works the stick', () => {
    const { input } = rig();
    drag(input, 1, -20, 250, 0, 20);
    expect(input.snapshot().down).toBe(true);
  });
});

describe('TouchControls — jump, multi-touch, pause', () => {
  it('a jump touch is held + a one-frame jumpPressed edge', () => {
    const { input } = rig();
    input.pointerDown(finger(5, 580, 300));
    let s = input.snapshot();
    expect(s.jump && s.jumpPressed).toBe(true);
    input.endFrame();
    s = input.snapshot();
    expect(s.jump).toBe(true);
    expect(s.jumpPressed).toBe(false);
    input.pointerUp(finger(5, 580, 300, false));
    expect(input.snapshot().jump).toBe(false);
  });

  it('hold down on the stick + tap jump = spin dash input', () => {
    const { input } = rig();
    drag(input, 1, 120, 250, 0, 25);
    input.endFrame();
    input.pointerDown(finger(2, 600, 320)); // second thumb
    const s = input.snapshot();
    expect(s.down).toBe(true);
    expect(s.jumpPressed).toBe(true);
    input.endFrame();
    input.pointerUp(finger(2, 600, 320, false));
    input.pointerDown(finger(3, 590, 310)); // rev again
    expect(input.snapshot()).toMatchObject({ down: true, jumpPressed: true });
  });

  it('pause tap is reported to the scene and does not jump', () => {
    const { input, controls } = rig();
    input.pointerDown(finger(9, TOUCH_LAYOUT.pause.x + 4, TOUCH_LAYOUT.pause.y + 3));
    expect(controls.pauseTapped).toBe(true);
    expect(input.touch.pauseTapped).toBe(true);
    expect(input.pausePressed()).toBe(true);
    expect(input.snapshot().jumpPressed).toBe(false);
    input.endFrame();
    expect(input.pausePressed()).toBe(false);
  });

  it('touches the controls claim never reach the menu pointer', () => {
    const { input } = rig();
    input.pointerDown(finger(1, 580, 300));
    expect(input.pointer.pressed).toBe(false);
  });
});

describe('TouchControls — gameplay gating', () => {
  it('with gameplay touch off, touches are plain pointer input', () => {
    const { input, controls } = rig({ gameplay: false });
    input.pointerDown(finger(1, 580, 300));
    expect(controls.visible).toBe(false);
    expect(input.snapshot().jumpPressed).toBe(false);
    expect(input.pointer.pressed).toBe(true);
  });

  it('switching gameplay off mid-hold releases at once, and the lift does not click the menu', () => {
    const { input } = rig();
    drag(input, 1, 120, 250, 25, 0);
    input.pointerDown(finger(2, 580, 300));
    input.endFrame();
    input.setGameplayTouch(false); // pause menu opened
    const s = input.snapshot();
    expect(s.right || s.jump).toBe(false);
    input.pointerUp(finger(2, 580, 300, false));
    input.pointerUp(finger(1, 145, 250, false));
    expect(input.pointer.released).toBe(false);
    // A fresh touch is a menu tap.
    input.pointerDown(finger(3, 320, 180));
    expect(input.pointer.pressed).toBe(true);
  });

  it('a finger left down across a pause stays inert after resume', () => {
    const { input } = rig();
    drag(input, 1, 120, 250, 25, 0);
    input.setGameplayTouch(false);
    input.setGameplayTouch(true);
    input.pointerMove(finger(1, 150, 250));
    expect(input.snapshot().right).toBe(false);
    input.pointerUp(finger(1, 150, 250, false));
    drag(input, 2, 120, 250, 25, 0); // a new thumb works
    expect(input.snapshot().right).toBe(true);
  });

  it("'off' never claims a touch", () => {
    const { input, controls } = rig({ mode: 'off' });
    input.pointerDown(finger(1, 580, 300));
    expect(controls.visible).toBe(false);
    expect(input.snapshot().jump).toBe(false);
    expect(input.pointer.pressed).toBe(true);
  });

  it("'on' shows them even before any touch", () => {
    const { controls } = rig({ mode: 'on' });
    expect(controls.visible).toBe(true);
  });

  it("'auto': a pad hides them, the next touch brings them back and is not lost", () => {
    const pad: PadLike = {
      index: 0,
      connected: true,
      axes: [0, 0],
      buttons: [{ pressed: true, value: 1 }],
    };
    const { input, controls } = rig({ pads: [pad] });
    input.lastDevice = 'touch';
    expect(controls.visible).toBe(true);
    input.poll(); // pad press
    expect(input.lastDevice).toBe('gamepad');
    expect(controls.visible).toBe(false);
    input.endFrame();
    input.pointerDown(finger(1, 580, 300));
    expect(controls.visible).toBe(true);
    expect(input.snapshot().jumpPressed).toBe(true); // the revealing touch already jumps
  });

  it('turning the setting off under a held thumb lets go', () => {
    const { input, controls, setMode } = rig();
    drag(input, 1, 120, 250, 25, 0);
    setMode('off');
    controls.update();
    expect(input.snapshot().right).toBe(false);
  });
});

/** A 2D context stand-in that accepts every call and property. */
function fakeCtx() {
  const calls: string[] = [];
  const props: Record<string | symbol, unknown> = { globalAlpha: 1 };
  const ctx = new Proxy(props, {
    get(t, k) {
      if (k in t) return t[k];
      return (..._args: unknown[]) => {
        calls.push(String(k));
      };
    },
    set(t, k, v) {
      t[k] = v;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, props };
}

describe('TouchControls — render', () => {
  it('draws nothing while hidden, and fades in when shown', () => {
    const { input, controls } = rig({ gameplay: false });
    const a = fakeCtx();
    controls.update();
    controls.render(a.ctx);
    expect(a.calls).toHaveLength(0);
    input.setGameplayTouch(true);
    input.lastDevice = 'touch';
    for (let i = 0; i < 10; i++) controls.update();
    const b = fakeCtx();
    controls.render(b.ctx);
    expect(b.calls).toContain('arc');
    expect(b.props.globalAlpha).toBe(1); // restored for whatever draws next
  });

  it('renders a live stick, a pressed jump and the pause button without throwing', () => {
    const { input, controls } = rig({ mode: 'on' });
    drag(input, 1, -10, 340, 30, 0); // landing off-canvas: base drawn on screen
    input.pointerDown(finger(2, 580, 300));
    for (let i = 0; i < 10; i++) controls.update();
    const { ctx, calls } = fakeCtx();
    expect(() => controls.render(ctx)).not.toThrow();
    expect(calls.filter((c) => c === 'stroke').length).toBeGreaterThan(3);
  });
});

describe('glyphs', () => {
  const all: PadGlyph[] = [
    'south',
    'east',
    'west',
    'north',
    'start',
    'select',
    'dpad',
    'dpad-up',
    'dpad-down',
    'dpad-left',
    'dpad-right',
    'lstick',
  ];

  it('every pad glyph draws and reports its width', () => {
    for (const g of all) {
      const { ctx, calls } = fakeCtx();
      const w = drawPadButton(ctx, 10, 20, 16, g);
      expect(w).toBeGreaterThanOrEqual(16);
      expect(calls.length).toBeGreaterThan(3);
      expect(calls[0]).toBe('save'); // never leaks state into the caller
      expect(calls[calls.length - 1]).toBe('restore');
    }
  });

  it('start/select are pills, wider than they are tall', () => {
    expect(drawPadButton(fakeCtx().ctx, 0, 0, 16, 'start')).toBeGreaterThan(16);
    expect(drawPadButton(fakeCtx().ctx, 0, 0, 16, 'south')).toBe(16);
  });

  it('touch glyphs draw and report their width', () => {
    for (const k of ['tap', 'jump', 'stick'] as const) {
      const { ctx, calls } = fakeCtx();
      expect(drawTouchGlyph(ctx, 0, 0, 18, k)).toBe(18);
      expect(calls).toContain('arc');
    }
  });
});
