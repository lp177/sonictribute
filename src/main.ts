import './style.css';
import { Game } from './core/Game.ts';
import { Input } from './core/Input.ts';
import { Bindings } from './core/bindings.ts';
import { initKeyboardLayout } from './core/keyboardLayout.ts';
import { Sfx } from './audio/sfx.ts';
import { TitleScene } from './scenes/TitleScene.ts';
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
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

const input = new Input(Bindings.load());
input.attach(window);

const sfx = new Sfx();
const game = new Game(canvas, input);
game.setScene(new TitleScene(game, input, sfx));
game.start();

// Dev/debug handle (used by automated smoke tests).
Object.assign(window, { __game: game });
