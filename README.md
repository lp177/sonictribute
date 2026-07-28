# BOLT — Chrono Rush

A Sonic-tribute 2D platformer built with **vanilla TypeScript + Canvas 2D** —
no game engine, no downloaded assets. Physics follow the
[Sonic Physics Guide](https://info.sonicretro.org/Sonic_Physics_Guide)
(ground-speed model, slope factors, rolling, spin dash, 360° loops via dual
collision layers), and every sprite, background and sound is generated
procedurally at boot.

> Dr. Yolk has stolen the **Chrono Core** and time is stuttering. Chase him
> through two zones, recover the scattered Chrono Crystals, and take the Core
> back.

## Features

- **Authentic feel** — SPG constants at a fixed 60 Hz timestep: momentum,
  slope physics, rolling and spin dash.
- **Loops that always feel good** — full-height 360° loops built from a real
  annulus with dual collision layers. Running into one at any pace grants a
  speed boost and the channel holds you at speed, so you never stall
  upside-down: you commit, you get the whole ride, you come out fast.
- **Two zones, no loading screens** — story cutscenes double as loading
  screens: the next level is built behind the fade while the cinematic plays.
  - *Verdant Rush* — hills, loops, stacked routes, Dr. Yolk's Wrecking Pod.
  - *Cog Skyway* — Yolk's sky-factory: dash pads, Buzz Drones, the
    **Mag-Board** hoverboard (zone-exclusive vehicle that absorbs one hit),
    and the Piston Crusher boss (armoured except after its slam — jump the
    shockwaves, strike the open window).
- **Exploration rewards** — 5 Chrono Crystals and 3 secret rooms per zone,
  monitors, checkpoints, score/time-bonus results screen with achievements
  (Untouchable, Speed Demon, Crystal Hunter, Explorer, Ring Master).
- **Game juice** — parallax backgrounds (horizontal + vertical), run dust,
  spin-dash smoke, board wake, explosion particles, speed afterimages and
  screen shake. Honours `prefers-reduced-motion` (shake and afterimages off,
  fewer particles).
- **Procedural audio** — WebAudio synth, no audio files.
- **Remappable controls** — primary + alternate key per action, with a
  settings panel on the title screen and in the pause menu (see below).
- **207 unit tests** — physics sensors, player state machine, entities,
  bosses, key bindings, menus, scoring, level structure, flood-fill
  reachability, simulated loop rides, and scripted bot runs through each zone
  to prevent regressions.

## Controls

| Action | Default keys |
| --- | --- |
| Move | Arrow keys / `WASD` |
| Jump | `Space` or `Z` |
| Roll | `Down` while moving |
| Spin dash | `Down` + `Space` (tap `Space` to rev, release `Down`) |
| Pause menu | `Esc` or `P` |
| Confirm / advance cutscene | `Enter` or the jump key |

**Every control is remappable**, with a primary and an optional alternate key
per action. Open **Settings** from the title screen or from the pause menu
(`Esc` in a level): `↑↓` picks the action, `←→` picks the primary/alternate
column, `Enter` captures the next key you press, `Backspace` clears an
alternate, and there is a reset-to-defaults row. Bindings persist in
`localStorage`. `Enter` stays reserved for menus so you can never lock
yourself out, and an action can never be stripped of its last key.

## Getting started

Requires **Node.js 20+** (any platform; developed on Debian Trixie).

```sh
npm install
npm run dev        # dev server with hot reload (Vite) — prints a local URL
```

### Tests & type checking

```sh
npx vitest run     # full unit-test suite (must stay green)
npx tsc            # type check only
```

The game logic is fully headless-testable: physics, entities, bosses and
levels never touch the DOM, so tests run in plain Node without a browser.

## Building & deployment

```sh
npm run build      # tsc + vite build → static site in dist/
npm run preview    # serve the production build locally to verify it
```

The build output in `dist/` is a **fully static site** (one HTML file, one JS
bundle ~21 kB gzipped, one CSS file, favicon). There is no server-side code,
no external requests and no secrets — deploy it on any static host:

- **Any web server** (nginx, Apache, Caddy): copy `dist/` to the document
  root. No special configuration needed; it works from a sub-path too, if you
  build with `vite build --base=/your/sub/path/`.
- **Static platforms** (GitHub Pages, Cloudflare Pages, Netlify, …): publish
  the `dist/` directory; build command `npm run build`.
- **Container**: serve `dist/` with any static-file image, e.g.

  ```Dockerfile
  FROM node:22-alpine AS build
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build

  FROM nginx:alpine
  COPY --from=build /app/dist /usr/share/nginx/html
  ```

Cache policy: `dist/assets/*` filenames are content-hashed and safe to cache
forever; serve `index.html` with a short/no-cache policy so updates roll out
immediately.

## Project layout

```
src/
  physics/    SPG constants, tile map (height/width arrays, 2 collision
              layers, loop stamper), sensor casts
  game/       Player state machine, Level + LevelBuilder, entities, bosses,
              scoring/achievements, story data
  levels/     zone1 (Verdant Rush), zone2 (Cog Skyway), campaign roster
  render/     procedural art (themed terrain/backgrounds/sprites) and the
              FX layer (particles, screen shake)
  scenes/     Title → Cutscene → Level flow (fade transitions, no loading)
  core/       game shell (fixed timestep), input, camera
  audio/      procedural WebAudio sfx
tests/        Vitest suites (127 tests)
```

More engine internals and level-design rules: see [AGENTS.md](AGENTS.md).

## Debugging

The running game is exposed as `window.__game` in the browser console for
smoke testing (scene → level/player).
