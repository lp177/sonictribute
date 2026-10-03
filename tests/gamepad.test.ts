import { describe, it, expect } from 'vitest';
import {
  BTN,
  GamepadReader,
  STICK_4WAY,
  STICK_8WAY,
  browserPads,
  sectorDirs,
  stickSector,
  type HapticsLike,
  type PadLike,
} from '../src/core/gamepad.ts';
import { Input, MENU_REPEAT, repeatFires } from '../src/core/Input.ts';
import { Bindings } from '../src/core/bindings.ts';

/** A mutable stand-in for a W3C Gamepad (standard mapping, 17 buttons). */
class FakePad implements PadLike {
  index: number;
  connected = true;
  mapping = 'standard';
  axes = [0, 0, 0, 0];
  buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  vibrationActuator: HapticsLike | null = null;

  constructor(index = 0) {
    this.index = index;
  }

  press(i: number): this {
    this.buttons[i] = { pressed: true, value: 1 };
    return this;
  }

  release(i: number): this {
    this.buttons[i] = { pressed: false, value: 0 };
    return this;
  }

  stick(x: number, y: number): this {
    this.axes[0] = x;
    this.axes[1] = y;
    return this;
  }
}

/** An Input whose pads are `pads` (mutate the array to plug/unplug). */
function padInput(pads: (FakePad | null)[]) {
  return new Input(new Bindings(), { gamepads: () => pads });
}

/** One fixed update: poll, read, end. */
function step<T>(input: Input, read: (i: Input) => T): T {
  input.poll();
  const r = read(input);
  input.endFrame();
  return r;
}

const dirsAt = (deg: number, mag = 1, prev = -1) =>
  sectorDirs(stickSector(Math.cos((deg * Math.PI) / 180) * mag, Math.sin((deg * Math.PI) / 180) * mag, prev, STICK_8WAY));

describe('stickSector — radial deadzone with hysteresis', () => {
  it('ignores a centred or barely-touched stick', () => {
    expect(stickSector(0, 0, -1, STICK_8WAY)).toBe(-1);
    expect(stickSector(0.2, 0.1, -1, STICK_8WAY)).toBe(-1);
  });

  it('a stick resting on the threshold never flickers on', () => {
    // Worn sticks wander around 0.3 at rest: that must read as nothing, every frame.
    let s = -1;
    for (const m of [0.28, 0.33, 0.29, 0.34, 0.27, 0.32, 0.3]) {
      s = stickSector(m, 0, s, STICK_8WAY);
      expect(s).toBe(-1);
    }
  });

  it('once pushed, the same wobble does not flicker off', () => {
    let s = stickSector(0.6, 0, -1, STICK_8WAY);
    expect(s).toBe(0);
    for (const m of [0.28, 0.33, 0.29, 0.34, 0.27, 0.32, 0.3]) {
      s = stickSector(m, 0, s, STICK_8WAY);
      expect(s).toBe(0);
    }
    expect(stickSector(0.2, 0, s, STICK_8WAY)).toBe(-1); // let go below `release`
  });

  it('reads 8 ways in screen space (y down)', () => {
    expect(dirsAt(0)).toEqual({ right: true, down: false, left: false, up: false });
    expect(dirsAt(45)).toEqual({ right: true, down: true, left: false, up: false });
    expect(dirsAt(90)).toEqual({ right: false, down: true, left: false, up: false });
    expect(dirsAt(135)).toEqual({ right: false, down: true, left: true, up: false });
    expect(dirsAt(180)).toEqual({ right: false, down: false, left: true, up: false });
    expect(dirsAt(225)).toEqual({ right: false, down: false, left: true, up: true });
    expect(dirsAt(270)).toEqual({ right: false, down: false, left: false, up: true });
    expect(dirsAt(315)).toEqual({ right: true, down: false, left: false, up: true });
  });

  it('holds a sector across its boundary instead of alternating', () => {
    const right = stickSector(Math.cos(0.3), Math.sin(0.3), -1, STICK_8WAY); // ~17°
    expect(right).toBe(0);
    // 26° is past the 22.5° boundary but within the hysteresis margin.
    const a = (26 * Math.PI) / 180;
    expect(stickSector(Math.cos(a), Math.sin(a), right, STICK_8WAY)).toBe(0);
    // From rest, the same angle is a diagonal.
    expect(stickSector(Math.cos(a), Math.sin(a), -1, STICK_8WAY)).toBe(1);
  });

  it('the menu read is 4-way: a diagonal never moves on both axes', () => {
    const a = (40 * Math.PI) / 180;
    expect(sectorDirs(stickSector(Math.cos(a), Math.sin(a), -1, STICK_4WAY))).toEqual({
      right: true,
      down: false,
      left: false,
      up: false,
    });
    const b = (50 * Math.PI) / 180;
    expect(sectorDirs(stickSector(Math.cos(b), Math.sin(b), -1, STICK_4WAY)).down).toBe(true);
  });
});

describe('GamepadReader — standard mapping', () => {
  it('ANY face button jumps (Sonic convention)', () => {
    for (const b of [BTN.south, BTN.east, BTN.west, BTN.north]) {
      const pad = new FakePad();
      const r = new GamepadReader(() => [pad]);
      pad.press(b);
      r.poll();
      expect(r.held.jump).toBe(true);
      expect(r.pressed.jump).toBe(true);
    }
  });

  it('only South confirms and only East backs out', () => {
    const pad = new FakePad().press(BTN.west);
    const r = new GamepadReader(() => [pad]);
    r.poll();
    expect(r.held.confirm).toBe(false);
    expect(r.held.back).toBe(false);
    pad.press(BTN.south).press(BTN.east);
    r.poll();
    expect(r.held.confirm).toBe(true);
    expect(r.held.back).toBe(true);
  });

  it('Start and Back/Select both pause', () => {
    for (const b of [BTN.start, BTN.select]) {
      const pad = new FakePad().press(b);
      const r = new GamepadReader(() => [pad]);
      r.poll();
      expect(r.pressed.pause).toBe(true);
      expect(r.held.jump).toBe(false);
    }
  });

  it('d-pad and stick both steer', () => {
    const pad = new FakePad().press(BTN.left);
    const r = new GamepadReader(() => [pad]);
    r.poll();
    expect(r.held.left).toBe(true);
    pad.release(BTN.left).stick(0, 0.9);
    r.poll();
    expect(r.held.down).toBe(true);
    expect(r.held.left).toBe(false);
  });

  it('edges last one poll while the button stays held', () => {
    const pad = new FakePad().press(BTN.south);
    const r = new GamepadReader(() => [pad]);
    r.poll();
    expect(r.pressed.jump).toBe(true);
    r.poll();
    expect(r.held.jump).toBe(true);
    expect(r.pressed.jump).toBe(false);
  });

  it('any pad drives: two controllers are OR-ed', () => {
    const p1 = new FakePad(0).stick(1, 0);
    const p2 = new FakePad(1).press(BTN.north);
    const r = new GamepadReader(() => [p1, null, p2]);
    r.poll();
    expect(r.connected).toBe(2);
    expect(r.held.right).toBe(true);
    expect(r.held.jump).toBe(true);
  });

  it('an unplugged pad releases everything it held, and reconnects clean', () => {
    const pad = new FakePad().stick(1, 0).press(BTN.south);
    const slots: (FakePad | null)[] = [pad];
    const r = new GamepadReader(() => slots);
    r.poll();
    expect(r.held.right).toBe(true);
    slots[0] = null; // yanked cable
    r.poll();
    expect(r.held.right).toBe(false);
    expect(r.held.jump).toBe(false);
    expect(r.connected).toBe(0);
    slots[0] = pad; // plugged back in, still holding
    r.poll();
    expect(r.pressed.jump).toBe(true);
  });

  it('skips pads reporting connected: false', () => {
    const pad = new FakePad().press(BTN.south);
    pad.connected = false;
    const r = new GamepadReader(() => [pad]);
    r.poll();
    expect(r.held.jump).toBe(false);
    expect(r.connected).toBe(0);
  });

  it('a pressed analog button counts by value too', () => {
    const pad = new FakePad();
    pad.buttons[BTN.south] = { pressed: false, value: 0.9 };
    const r = new GamepadReader(() => [pad]);
    r.poll();
    expect(r.held.jump).toBe(true);
  });

  it('flags activity only on a fresh press, never on a held state', () => {
    const pad = new FakePad().press(4); // a shoulder button: unmapped, but it is the pad in use
    const r = new GamepadReader(() => [pad]);
    r.poll();
    expect(r.active).toBe(true);
    r.poll();
    expect(r.active).toBe(false);
  });

  it('is headless-safe without the Gamepad API', () => {
    expect(() => browserPads()).not.toThrow();
    const r = new GamepadReader();
    expect(() => r.poll()).not.toThrow();
    expect(r.connected).toBe(0);
  });
});

describe('GamepadReader — rumble', () => {
  function hapticPad(index: number) {
    const calls: { type: string; params: Record<string, number> }[] = [];
    const pad = new FakePad(index);
    pad.vibrationActuator = {
      playEffect: (type, params) => {
        calls.push({ type, params });
        return Promise.resolve('complete');
      },
    };
    return { pad, calls };
  }

  it('plays a clamped dual-rumble on a pad that supports it', () => {
    const { pad, calls } = hapticPad(0);
    const r = new GamepadReader(() => [pad]);
    r.poll();
    expect(r.rumble(2, 9000)).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].type).toBe('dual-rumble');
    expect(calls[0].params.strongMagnitude).toBe(1);
    expect(calls[0].params.duration).toBe(5000);
  });

  it('targets the pad in the player hands', () => {
    const a = hapticPad(0);
    const b = hapticPad(1);
    const r = new GamepadReader(() => [a.pad, b.pad]);
    b.pad.press(BTN.south);
    r.poll();
    r.rumble(0.5, 100);
    expect(a.calls).toHaveLength(0);
    expect(b.calls).toHaveLength(1);
  });

  it('is a silent no-op without haptics, a pad, or intensity', () => {
    const r = new GamepadReader(() => [new FakePad()]);
    r.poll();
    expect(r.rumble(1, 100)).toBe(false);
    expect(new GamepadReader(() => []).rumble(1, 100)).toBe(false);
    const { pad } = hapticPad(0);
    const r2 = new GamepadReader(() => [pad]);
    r2.poll();
    expect(r2.rumble(0, 100)).toBe(false);
  });
});

describe('Input — gamepad merged into the snapshot', () => {
  it('ORs keyboard and pad into one snapshot', () => {
    const pad = new FakePad().press(BTN.east);
    const input = padInput([pad]);
    input.pressForTest('ArrowLeft');
    const snap = step(input, (i) => i.snapshot());
    expect(snap.left).toBe(true);
    expect(snap.jump).toBe(true);
    expect(snap.jumpPressed).toBe(true);
  });

  it('a held face button is one jumpPressed, not one per frame', () => {
    const pad = new FakePad().press(BTN.south);
    const input = padInput([pad]);
    expect(step(input, (i) => i.snapshot().jumpPressed)).toBe(true);
    expect(step(input, (i) => i.snapshot().jumpPressed)).toBe(false);
    expect(step(input, (i) => i.snapshot().jump)).toBe(true);
  });

  it('Start and Back pause through pausePressed and actionWasPressed', () => {
    const pad = new FakePad().press(BTN.start);
    const input = padInput([pad]);
    expect(step(input, (i) => [i.pausePressed(), i.actionWasPressed('pause')])).toEqual([true, true]);
    pad.release(BTN.start);
    step(input, () => 0);
    pad.press(BTN.select);
    expect(step(input, (i) => i.pausePressed())).toBe(true);
  });

  it('pad South confirms menus (and the legacy confirmPressed), East backs out', () => {
    const pad = new FakePad().press(BTN.south);
    const input = padInput([pad]);
    expect(step(input, (i) => [i.menuConfirm(), i.confirmPressed(), i.menuBack()])).toEqual([true, true, false]);
    pad.release(BTN.south).press(BTN.east);
    expect(step(input, (i) => [i.menuConfirm(), i.menuBack()])).toEqual([false, true]);
  });

  it('keyboard menu keys still work: Enter/jump confirm, Escape/Backspace back', () => {
    const input = padInput([]);
    input.pressForTest('Enter');
    expect(input.menuConfirm()).toBe(true);
    input.endFrame();
    input.pressForTest('Space');
    expect(input.menuConfirm()).toBe(true);
    input.endFrame();
    input.pressForTest('Backspace');
    expect(input.menuBack()).toBe(true);
    input.endFrame();
    input.pressForTest('Escape');
    expect([input.menuBack(), input.pausePressed()]).toEqual([true, true]);
  });

  it('pad buttons never leak into a rebinding capture', () => {
    const pad = new FakePad();
    const input = padInput([pad]);
    input.beginCapture();
    pad.press(BTN.south);
    step(input, () => 0);
    expect(input.takeCaptured()).toBeNull();
    expect(input.isCapturing).toBe(true); // still waiting for a KEY
    pad.release(BTN.south).press(BTN.east);
    // …but the pad can still back out of it.
    expect(step(input, (i) => i.menuBack())).toBe(true);
    input.pressForTest('KeyM');
    expect(input.takeCaptured()).toBe('KeyM');
  });

  it('reports a connected pad and forwards rumble', () => {
    const pad = new FakePad();
    let rumbled = 0;
    pad.vibrationActuator = {
      playEffect: () => {
        rumbled++;
        return Promise.resolve();
      },
    };
    const input = padInput([pad]);
    expect(input.padConnected).toBe(false); // not polled yet
    input.poll();
    expect(input.padConnected).toBe(true);
    input.rumble(0.6, 120);
    expect(rumbled).toBe(1);
  });
});

describe('Input — lastDevice', () => {
  it('starts on keyboard and follows the device actually used', () => {
    const pad = new FakePad();
    const input = padInput([pad]);
    expect(input.lastDevice).toBe('keyboard');
    pad.press(BTN.south);
    step(input, () => 0);
    expect(input.lastDevice).toBe('gamepad');
    input.pressForTest('ArrowRight');
    expect(input.lastDevice).toBe('keyboard');
  });

  it('a held pad does not steal the device back from the keyboard', () => {
    const pad = new FakePad().stick(1, 0);
    const input = padInput([pad]);
    step(input, () => 0);
    expect(input.lastDevice).toBe('gamepad');
    input.pressForTest('Enter');
    step(input, () => 0); // stick still held: no fresh press
    expect(input.lastDevice).toBe('keyboard');
  });

  it('keys that do nothing (media, volume) do not switch the device', () => {
    const pad = new FakePad().press(BTN.south);
    const input = padInput([pad]);
    step(input, () => 0);
    input.pressForTest('AudioVolumeUp');
    expect(input.lastDevice).toBe('gamepad');
  });
});

describe('Input — menu navigation with auto-repeat', () => {
  /** Frames (1-based) on which `fire` returned true over `n` updates. */
  function fireFrames(input: Input, n: number, fire: (i: Input) => boolean, each?: (f: number) => void) {
    const out: number[] = [];
    for (let f = 1; f <= n; f++) {
      each?.(f);
      if (step(input, fire)) out.push(f);
    }
    return out;
  }

  const expected = (n: number) => {
    const frames = [1];
    for (let f = 1 + MENU_REPEAT.delay; f <= n; f += MENU_REPEAT.rate) frames.push(f);
    return frames;
  };

  it('repeatFires: never on the first frame, then after the delay at the rate', () => {
    expect(repeatFires(1)).toBe(false);
    expect(repeatFires(MENU_REPEAT.delay)).toBe(false);
    expect(repeatFires(MENU_REPEAT.delay + 1)).toBe(true);
    expect(repeatFires(MENU_REPEAT.delay + 1 + MENU_REPEAT.rate)).toBe(true);
    expect(repeatFires(MENU_REPEAT.delay + 2)).toBe(false);
  });

  it('a held arrow key fires once, waits ~18 frames, then every ~6', () => {
    const input = padInput([]);
    const frames = fireFrames(input, 40, (i) => i.menuDown(), (f) => f === 1 && input.pressForTest('ArrowDown'));
    expect(frames).toEqual(expected(40));
    expect(frames.slice(0, 3)).toEqual([1, 19, 25]); // 18 frames to the first repeat, then every 6
  });

  it('a held d-pad repeats on the same clock', () => {
    const pad = new FakePad().press(BTN.up);
    const input = padInput([pad]);
    expect(fireFrames(input, 40, (i) => i.menuUp())).toEqual(expected(40));
  });

  it('a tap steps exactly once', () => {
    const input = padInput([]);
    const frames = fireFrames(
      input,
      30,
      (i) => i.menuRight(),
      (f) => {
        if (f === 1) input.pressForTest('ArrowRight');
        if (f === 2) input.releaseForTest('ArrowRight');
      },
    );
    expect(frames).toEqual([1]);
  });

  it('follows the bindings as well as the arrows', () => {
    const input = padInput([]);
    input.pressForTest('KeyS'); // default secondary for down
    expect(input.menuDown()).toBe(true);
    input.endFrame();
    input.releaseForTest('KeyS');
    input.bindings.set('left', 'primary', 'KeyJ');
    input.pressForTest('KeyJ');
    expect(input.menuLeft()).toBe(true);
    input.endFrame();
    input.pressForTest('ArrowLeft'); // arrows always navigate
    expect(input.menuLeft()).toBe(true);
  });

  it('a diagonal stick moves a menu on one axis only', () => {
    const a = (35 * Math.PI) / 180;
    const pad = new FakePad().stick(Math.cos(a), Math.sin(a)); // mostly right, a bit down
    const input = padInput([pad]);
    expect(step(input, (i) => [i.menuRight(), i.menuDown()])).toEqual([true, false]);
    // …while gameplay still gets the full 8-way read.
    const p2 = new FakePad().stick(Math.cos(Math.PI / 4), Math.sin(Math.PI / 4));
    const i2 = padInput([p2]);
    expect(step(i2, (i) => [i.snapshot().right, i.snapshot().down])).toEqual([true, true]);
  });
});
