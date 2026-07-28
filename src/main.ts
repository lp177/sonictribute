import './style.css';
import { Game } from './core/Game.ts';
import { Input } from './core/Input.ts';
import { Sfx } from './audio/sfx.ts';
import { TitleScene } from './scenes/TitleScene.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

const input = new Input();
input.attach(window);

const sfx = new Sfx();
const game = new Game(canvas, input);
game.setScene(new TitleScene(game, input, sfx));
game.start();

// Dev/debug handle (used by automated smoke tests).
Object.assign(window, { __game: game });
