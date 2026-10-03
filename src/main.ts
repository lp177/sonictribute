import './style.css';
import { Game } from './core/Game.ts';
import { Input } from './core/Input.ts';
import { Bindings } from './core/bindings.ts';
import { initKeyboardLayout } from './core/keyboardLayout.ts';
import { Sfx } from './audio/sfx.ts';
import { TitleScene } from './scenes/TitleScene.ts';
import { TouchControls } from './ui/TouchControls.ts';
import { AppUpdate, browserEnv } from './pwa/appUpdate.ts';
import { setAppUpdate } from './pwa/updateHandle.ts';

// Resolve the player's real key labels (AZERTY shows Z/Q/S/D, not W/A/S/D).
// Async by browser design; menus re-read labels every frame, so no wait.
void initKeyboardLayout();

// Cache the game for instant loads and offline play, and watch for new builds.
// Dev is served fresh by Vite and emits no worker, so only do this in a build.
if (import.meta.env.PROD) {
  const updater = new AppUpdate(browserEnv('./sw.js'));
  setAppUpdate(updater);
  void updater.start();
}

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;

const input = new Input(Bindings.load());
// The canvas lets pointer events (mouse, pen, touch) map into logical space.
input.attach(window, canvas);

const sfx = new Sfx();
// Audio may only start from a user gesture, and the title theme should not
// wait for the player to happen to press a key the menu listens to. So: try
// right away (it plays at once wherever the browser already trusts the page),
// and otherwise start on the first key, click or tap of ANY kind — unlocked
// inside the event handler itself, which Safari requires.
sfx.ensure();
for (const type of ['keydown', 'pointerdown', 'touchend'] as const) {
  window.addEventListener(type, () => sfx.unlock(), { capture: true, passive: true });
}
// A hidden tab stops the audio clock outright: the scheduler would otherwise
// be throttled, and the level pauses itself anyway (Game -> scene.suspend).
document.addEventListener('visibilitychange', () => (document.hidden ? sfx.mixer.suspend() : sfx.mixer.resume()));
const game = new Game(canvas, input);
// On-screen stick + jump for touch devices; they only appear while a scene
// asks for them with `input.setGameplayTouch(true)`.
game.overlays.push(new TouchControls(input));
game.setScene(new TitleScene(game, input, sfx));
game.start();

// Dev/debug handle (used by automated smoke tests).
Object.assign(window, { __game: game });
