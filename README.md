# BOLT — Chrono Rush

[![CI](https://github.com/lp177/sonictribute/actions/workflows/ci.yml/badge.svg)](https://github.com/lp177/sonictribute/actions/workflows/ci.yml)
[![Play](https://img.shields.io/badge/play-online-4be1ff)](https://lp177.github.io/sonictribute/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A free, open-source **Sonic-style platformer that runs in your browser**. No
plugins, no downloads, no accounts, nothing to install — open the page and
play.

It is built with **vanilla TypeScript and Canvas 2D**: no game engine, no
downloaded art or audio. Every sprite, background, sound effect and level is
generated procedurally at boot, and the movement follows the community
[Sonic Physics Guide](https://info.sonicretro.org/Sonic_Physics_Guide) — the
ground-speed model, slope factors, rolling, spin dash and 360° loops built
from dual collision layers.

> The Chrono Core is the world's escapement — the mechanism that lets "now"
> tick into "next". Dr. Yolk split it into four **Hour Shards** and froze four
> regions at the hour that suits him best. Run the four stolen hours, pull the
> shards, and take tomorrow back.

## Play

**▶ [Play it in your browser](https://lp177.github.io/sonictribute/)** — no
install, no sign-up.

**Locally:** `npm install && npm run dev`, then open the printed URL.

The whole game is about 66 kB gzipped and runs entirely on your device —
there is no backend, no telemetry and no network traffic after the page
loads.

## Features

- **Authentic feel** — Sonic Physics Guide constants at a fixed 60 Hz
  timestep: momentum, slope physics, rolling and spin dash.
- **Loops that always feel good** — full-height 360° loops built from a real
  annulus with dual collision layers. Running into one at any pace grants a
  speed boost and the channel holds you at speed, so you never stall
  upside-down: you commit, you get the whole ride, you come out fast.
- **A 42-act campaign across four biomes**, with no loading screens — each
  biome's opening cutscene doubles as its loading screen, and between acts
  the fade alone keeps the pace.
  - *Duskmere Coast* (11 acts) — stuck at golden dusk over a frozen sea:
    loops, launch ramps, quarter-pipes, and the Wrecking Pod.
  - *Otherwhile Foundry* (11 acts) — the endless midnight shift: Mag-Board
    sprints, dash pads, drones, steel stalactites, and the Piston Crusher.
  - *The Underwhen* (10 acts) — the cavern with no hour at all: grind-rail
    cascades, **minecarts that crash at the rail's end unless you jump out**,
    falling stalactites, half-pipe bowls, and the Shard Drill.
  - *Noon Tomorrow* (10 acts) — the neon city whose tomorrow never arrives:
    hard-light phase platforms, sky-rail ribbons, and the Mirage Pacer, a
    ground-race boss that fills the arena with hard-light afterimages.
- **A level select that earns itself** — every act you clear unlocks a line
  with a terrain postcard (the act's real map silhouette), its name, and your
  best score/time/crystals/secrets; click any unlocked act to play it
  directly. Progress persists in localStorage.
- **Exploration rewards** — 5 Chrono Crystals and 3 secret rooms per zone,
  monitors, checkpoints, and a score/time-bonus results screen with
  achievements (Untouchable, Speed Demon, Crystal Hunter, Explorer, Ring
  Master).
- **Three routes through every zone** — a sky route of precise platform hops
  reached off a launch ramp, the ground road, and an underground gallery you
  drop into through visible shafts and spring back out of. The Chrono
  Crystals are spread across all three, so no single lane collects them all.
- **A world with depth** — run-up ramps that fling you into the sky, holes
  that drop you into the underworks rather than killing you, and a void far
  below that only ever catches a genuinely bottomless fall.
- **The deltaplane** — a hang-glider pickup on the sky routes: hold jump
  while falling to deploy, ride rising-air columns to soar, and weave the
  ring lines. Lost when you take a hit, like everything good.
- **Game juice** — hit-stop on impact, screen shake, impact flashes, speed
  streaks and a tunnel vignette at pace, squash-and-stretch, run dust,
  spin-dash smoke, board wake, explosion particles and speed afterimages.
  Audio is dynamic too: chained ring pickups climb a pitch ladder, spin-dash
  revs wind up, and impacts are bass-heavy.
- **Living scenery** — grass and flowers bending in the wind, fireflies,
  guttering torches, steam vents, turning cogs and drifting clouds.
- **Hazards you can read** — pop-up spikes that rattle a warning first,
  ledges that visibly crumble before they drop, and swinging wrecking balls
  on a readable arc. Every one is dodgeable on sight.
- **A boss arena that locks** — gates slam down at both ends when the fight
  starts and grind back up when it ends.
- **Accessible** — fully keyboard-driven, remappable controls, visible focus
  states, and `prefers-reduced-motion` support (screen shake and afterimages
  off, fewer particles).
- **Procedural audio** — a small WebAudio synth, no audio files.
- **Installable and playable offline** — a service worker caches the game on
  first visit, so it loads instantly and runs with no network at all. It still
  checks for new builds in the background, and offers an **UPDATE GAME** row on
  the title screen rather than swapping versions mid-run.
- **748 unit tests** — physics sensors, player state machine, entities,
  hazards, bosses, key bindings, menus, scoring, level structure, flood-fill
  reachability, simulated loop rides, route-continuity contracts, and a flow
  test that fails if a bot holding right ever gets pinned by the terrain.

## Controls

| Action | Default keys |
| --- | --- |
| Move | Arrow keys / `WASD` (`ZQSD` on AZERTY) |
| Jump | `Space` or `Z` (`W` on AZERTY) |
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

Bindings are **positional** (they use physical key codes), so the defaults
land under the same fingers on every keyboard layout — on AZERTY they simply
*are* `ZQSD`. The game detects your layout (Keyboard Layout API, with a
language fallback) and labels every key by what it actually prints on your
keyboard, so an AZERTY player sees `Z`/`Q`/`S`/`D` in the menus, not
`W`/`A`/`S`/`D`.

## Getting started

Requires **Node.js 20+** (any platform; developed on Debian Trixie).

```sh
npm install
npm run dev        # dev server with hot reload — prints a local URL
npm test           # unit tests (must stay green)
npm run typecheck  # tsc, no emit
npm run build      # typecheck + production build into docs/
npm run preview    # serve the production build locally to verify it
```

The game logic is fully headless-testable: physics, entities, bosses and
levels never touch the DOM, so tests run in plain Node without a browser.

## Deploying

`npm run build` writes a **fully static site into [`docs/`](docs/)** — one
HTML file, one JS bundle (~66 kB gzipped), one CSS file, a favicon, a web app
manifest and a service worker. There is no server-side code, no build step at
runtime, no external requests and no secrets.

### GitHub Pages (no CI required)

`docs/` is committed precisely so GitHub can serve it directly:

1. Run `npm run build` and commit the updated `docs/`.
2. Push to GitHub.
3. In the repository: **Settings → Pages → Build and deployment**, set
   *Source* to **Deploy from a branch**, then choose branch `main` and folder
   **`/docs`**, and save.
4. The site goes live at <https://lp177.github.io/sonictribute/> within a
   minute or two.

Assets are referenced with **relative URLs** (`base: './'` in
[vite.config.ts](vite.config.ts)), so the same build works at a project-site
sub-path, at a user site, behind a custom domain, or opened from disk — you
never have to hard-code the deploy URL. A `.nojekyll` file is included so
GitHub serves the build verbatim.

The [CI workflow](.github/workflows/ci.yml) typechecks, tests, builds, and
fails if the committed `docs/` is stale — so the published site can't silently
drift from `src/`.

### Offline play, and how updates reach players

The game installs a **service worker** ([src/pwa/](src/pwa/)), so after the
first visit it loads from its own cache: instant, and fully playable with no
network at all. That cache is also the fix for a real problem — GitHub Pages
serves `index.html` with its own cache lifetime, so a plain refresh could hand
you a stale build.

Freshness is handled explicitly rather than left to HTTP headers:

- The precache list is generated **at build time** from the files Rolldown
  actually emitted, and the cache version is a fingerprint of their *contents* —
  so editing only `index.html` still produces a new version.
- Content-hashed bundles under `assets/` are served **cache-first** (a new build
  means a new filename). Everything else is **stale-while-revalidate**.
- The app asks the network for a newer worker on load, when the tab becomes
  visible again, and every 15 minutes.
- When a new build is found it is downloaded but **not applied**. An amber
  **UPDATE GAME** row appears on the title screen; the swap and reload happen
  only when the player chooses it, so a version never changes mid-run.

To ship an update, just build and push as above — players get it on their next
visit without clearing anything. To verify a deploy went out, compare the
hashed bundle name in the live page against `git show HEAD:docs/index.html`.

### Anywhere else

Copy `docs/` to any static host — nginx, Apache, Caddy, Cloudflare Pages,
Netlify, S3, or a container:

```Dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/docs /usr/share/nginx/html
```

Cache policy: files under `docs/assets/` are content-hashed and safe to cache
forever; serve `index.html` with a short or no-cache policy so updates reach
players immediately.

## Project layout

```text
src/
  physics/    Sonic Physics Guide constants, tile map (height/width arrays,
              2 collision layers, loop stamper), sensor casts
  game/       Player state machine, Level + LevelBuilder, entities, bosses,
              loop tracker, scoring/achievements, story data
  levels/     the motif kit plus dusk/, midnight/, never/, tomorrow/ —
              42 acts in four biomes, campaign roster in index.ts
  render/     procedural art (themed terrain/backgrounds/sprites) and the
              FX layer (particles, screen shake)
  ui/         canvas menus: settings (key remapping) and pause
  scenes/     Title → Cutscene → Level flow (fade transitions, no loading)
  core/       game shell (fixed timestep), input, key bindings, camera
  audio/      procedural WebAudio sound effects
tests/        Vitest suites (748 tests)
docs/         built site — this is what GitHub Pages serves
```

Engine internals and the level-design rules that keep the physics honest are
documented in [AGENTS.md](AGENTS.md).

## Debugging

The running game is exposed as `window.__game` in the browser console for
smoke testing (scene → level / player).

## License

[MIT](LICENSE) — code, procedural art and audio alike.

## A note on what this is

BOLT — Chrono Rush is an **unofficial fan tribute**. It is **not affiliated
with, endorsed by, or connected to SEGA** in any way. *Sonic the Hedgehog* and
related marks are trademarks of SEGA.

Nothing here is ripped from any commercial game. The characters (BOLT, Dr.
Yolk), levels, music and artwork are original to this project and drawn
procedurally in code. What *is* borrowed is the publicly documented movement
model from the community-written Sonic Physics Guide — the constants and
algorithms that make classic 2D platforming feel the way it does.
