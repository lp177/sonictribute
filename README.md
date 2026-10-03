# BOLT — Chrono Rush

[![CI](https://github.com/lp177/sonictribute/actions/workflows/ci.yml/badge.svg)](https://github.com/lp177/sonictribute/actions/workflows/ci.yml)
[![Play](https://img.shields.io/badge/play-online-4be1ff)](https://lp177.github.io/sonictribute/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A free, open-source **Sonic-style platformer that runs in your browser**. No
plugins, no downloads, no accounts, nothing to install — open the page and
play.

It is built with **vanilla TypeScript and Canvas 2D**: no game engine, no
downloaded art, fonts or audio. Every sprite, background, letter, sound effect,
music track and level is generated procedurally in code, and the movement follows the community
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

The whole game — art, music and all — is about 110 kB gzipped and runs entirely on your device —
there is no backend, no telemetry and no network traffic after the page
loads.

## Features

- **Sharp at any size** — the game thinks in a 640×360 logical view but
  draws at your screen's real resolution (up to 1080p backing, quarter-step
  render scale), so curves, text and outlines stay crisp from a phone to a
  4K monitor. Terrain is built as smooth polygons from the collision tiles —
  no staircase slopes — with per-zone procedural materials, turf lips,
  ambient occlusion and back walls behind underground galleries.
- **An original soundtrack, made in code** — ten tracks (title, one per zone,
  story, boss, finale rematch, act clear, ending) from a small WebAudio
  tracker, mixed through a limiter with a separate music / effects bus. The
  music speeds up under speed shoes and ducks while paused.
- **Its own typeface** — *BOLT Display*, a heavy rounded italic face stroked
  from centre-lines, so titles and the HUD look the same on every OS.
- **Classic momentum, quick hands** — Sonic Physics Guide slope physics,
  rolling and spin dash at a fixed 60 Hz timestep: speed is made and lost on
  the terrain. Three constants are deliberately not the guide's — the hero is
  at a run in about a second instead of two, stops in one, and can check a
  jump in mid-air — because faithful felt heavy.
- **Framed like the classics** — the playfield is 427×240 world pixels (the
  HUD and menus stay in 640×360), so speed reads as speed and an act is
  twenty-odd screens long. The camera leads the run, looks down a slope
  before you do, and pulls back to show the whole arena for a boss.
- **Smooth on any screen** — the simulation runs at 60 Hz, but every frame is
  drawn *between* two steps, so the scroll is even on a 60, 144 or 240 Hz
  display. The game rations its own draws and, on a GPU that cannot keep an
  even cadence, steps down to 60 fps and then to a lower render resolution
  rather than stutter.
- **Loops that always feel good** — full-height 360° loops built from a real
  annulus with dual collision layers, each one standing at the foot of the
  hill that feeds it. Running into one at any pace grants a speed boost and
  the channel holds you at speed, so you never stall upside-down: you commit,
  you get the whole ride, you come out fast.
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
- **Exploration rewards** — 5 Chrono Crystals and 3 secret rooms per act,
  monitors, checkpoints, and a results ceremony: bonuses tally into the score,
  then an **S–D rank** stamps the act (pace against a par time, crystals,
  damage, rings), with NEW BEST flags against your saved record and
  achievements (Untouchable, Speed Demon, Crystal Hunter, Explorer, Ring
  Master). Best ranks show in the level select.
- **Levels shaped like the classics** — every act is a roller coaster, not a
  corridor: long descents, valleys, cliffs you run down, hills with a cave
  under them. Speed is something the ground *gives* you (roll a downhill and
  you leave it two px/frame faster than if you ran it), and what you do with
  it decides which road you are on: carry it over a kicker and you are thrown
  to the high ledge and its prize; lose it and you take the valley floor —
  slower, never dead. Tight platforming knots are the tension, the long
  downhills between them the release.
- **Roads that cross** — a high road of ledges that follows the ground, the
  middle road, and caves you drop into through visible shafts and spring back
  out of. They fork and merge all the way through an act, and the Chrono
  Crystals are spread across them, so no single road collects them all.
  Nothing is bottomless: a missed jump costs time, never the run.
- **The deltaplane** — a hang-glider pickup on the sky routes: hold jump
  while falling to deploy, ride rising-air columns to soar, and weave the
  ring lines. Lost when you take a hit, like everything good.
- **A villain you have heard gloat** — Dr. Yolk arrives as a silhouette with
  lit goggles on a thunderclap, steals the world's clock, and laughs about
  it: every line of his gets an arcade-style close-up acting it out, and he
  taunts you again at the gates of every boss arena.
- **Game juice** — hit-stop on impact, screen shake, impact flashes, speed
  streaks and a tunnel vignette at pace, squash-and-stretch, run dust,
  spin-dash smoke, board wake, explosion particles and speed afterimages.
- **Arcade sound** — eighty-odd effects from a small FM + PSG toolkit in the
  Mega Drive mould (see [SOUND_DESIGN.md](SOUND_DESIGN.md)): an FM bell for
  rings that climbs a pitch ladder as you chain them, a rubbery spring, revs
  that wind up, metal and sub-bass for bosses — mixed in four loudness tiers
  and panned to where each thing happened.
- **A CRT glaze** — scanlines, a hint of aperture grille, a soft vignette and
  rounded tube corners, dosed to be felt more than seen (and one option away
  from off).
- **Living scenery** — grass and flowers bending in the wind, fireflies,
  guttering torches, steam vents, turning cogs and drifting clouds.
- **Hazards you can read** — pop-up spikes that rattle a warning first,
  ledges that visibly crumble before they drop, and swinging wrecking balls
  on a readable arc. Every one is dodgeable on sight.
- **A boss arena that locks** — gates slam down at both ends when the fight
  starts and grind back up when it ends.
- **Play it your way** — keyboard (fully remappable), **gamepad** (standard
  mapping, rumble on hits) and **touch** (floating stick, jump and pause
  buttons on phones and tablets); menus also take the mouse. Every on-screen
  prompt shows the device you are actually using.
- **Accessible** — options for music and effects volume, screen shake, flash
  effects (photosensitivity), the CRT filter, touch controls and timer
  precision;
  `prefers-reduced-motion` sets the comfort defaults. The game pauses itself
  when the tab is hidden or loses focus, and restart / quit ask twice.
- **Installable and playable offline** — a service worker caches the game on
  first visit, so it loads instantly and runs with no network at all. It still
  checks for new builds in the background, and offers an **UPDATE GAME** row on
  the title screen rather than swapping versions mid-run.
- **~1000 unit tests** — physics sensors, player state machine, entities,
  hazards, bosses, key bindings, menus, scoring, level structure, flood-fill
  reachability, simulated loop rides, frame pacing, and an act contract that
  plays every level three ways (a first-timer, one who never jumps, one who
  rolls every slope) and fails it for a dead end, a booster-fed loop or a
  flat corridor.

## Controls

| Action | Default keys |
| --- | --- |
| Move | Arrow keys / `WASD` (`ZQSD` on AZERTY) |
| Jump | `Space` or `Z` (`W` on AZERTY) |
| Roll | `Down` while moving |
| Spin dash | `Down` + `Space` (tap `Space` to rev, release `Down`) |
| Pause menu | `Esc` or `P` |
| Confirm / advance cutscene | `Enter` or the jump key |
| Skip a cutscene | `Esc` |

**Gamepad:** stick or d-pad to move, any face button to jump (the Sonic
convention), down to roll, Start to pause; in menus South confirms and East
goes back. **Touch:** drag anywhere on the left half for a floating stick,
the big button bottom-right jumps, the button top-right pauses.

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
HTML file, one JS bundle (~110 kB gzipped), one CSS file, a favicon, a web app
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
  render/     procedural art: smooth terrain chunks, layered parallax
              backdrops, the BOLT Display font, the hero rig, objects,
              bosses, story characters, and the FX layer
  ui/         HUD, title card, results, pause / options / controls menus,
              touch controls and device-aware prompt glyphs
  scenes/     Title → Cutscene → Level flow (fade transitions, no loading)
  core/       game shell (fixed timestep, render scale), input (keyboard,
              gamepad, pointer, touch), key bindings, settings, camera
  audio/      mixer, music tracker + the ten songs, sound effects
tests/        Vitest suites (~1000 tests)
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
