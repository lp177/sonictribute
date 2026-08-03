# BOLT — Chrono Rush (Sonic tribute)

Vanilla TypeScript + Canvas 2D platformer with Sonic Physics Guide (SPG)
movement. No game engine, no art assets — all sprites/backgrounds are drawn
procedurally at boot.

## Commands

- `npm run dev` — dev server (Vite)
- `npm run build` — typecheck (tsc) + production build
- `npx vitest run` — unit tests (695 tests, must stay green; add a test per
  feature/level to prevent regressions)

## Architecture

- `src/physics/constants.ts` — SPG values (60 fps, px/frame). Do not tune casually.
- `src/physics/TileMap.ts` — tiles with height/width arrays (SPG style), two
  collision layers (0 = normal, 1 = inside loops), procedural loop generator
  (`stampLoop`).
- `src/physics/sensors.ts` — ground/wall/ceiling sensor casts in 4 ground
  modes (floor/right wall/ceiling/left wall).
- `src/game/Player.ts` — hero state machine: gsp/xsp/ysp model, rolling, spin
  dash, slope factor, hurt/knockback, shield, speed shoes, Mag-Board vehicle
  (`board`: enforced forward speed, absorbs one hit, no rolling/spindash while
  riding; `BOARD` const, not SPG). Pure logic, headless-testable.
- `src/game/loops.ts` — loop geometry tuning (`LOOP`) + `LoopTracker`, the
  Sonic 1-style path swapper. Loops are a toy, not a skill check: entry grants
  a boost and the channel enforces a floor speed, so any loop entered at a
  running pace is always completed (a deliberate departure from raw SPG).
- `src/game/Level.ts` + `src/levels/` — LevelBuilder API (floor/slope/carve/
  spring/secret/loop/boss/dashPad/boardPad/drone/rail/cartRide/quarterPipe/
  stalactite/phasePlatform/hopper…). The campaign is 42 acts in four biome
  dirs (dusk/midnight/never/tomorrow), composed from `levels/motifs.ts` and
  gated per-act by `tests/actContract.ts` (structure minimums, 3 continuous
  routes, reachability, no-stall flow bot, idle silence). zone1/2/3.ts are
  retired from the roster but kept as engine-test fixtures.
  LevelDef carries `theme` ('verdant' | 'gear'), `bossKind` ('pod' | 'press')
  and its `intro` cutscene. Level owns entities, score, secrets, checkpoints,
  boss, respawn, board mount/dismount.
- `src/game/Boss.ts` / `src/game/PressBoss.ts` / `src/game/CrystalBoss.ts` —
  deterministic bosses
  (timer-driven patterns, no RNG) behind the shared `BossLike` interface.
  Bosses report contacts; the LEVEL applies player damage (single damage path —
  do not call `player.hurt()` from entities). PressBoss is armoured except
  during its post-slam 'open' window; its shockwaves hurt even a rolling player.
- `src/game/story.ts` — background-story cutscene data (pure, tested):
  intro → act2 → ending. The stolen Chrono Core threads the campaign; the
  crystals are the per-zone recoverable parts.
- `src/game/Score.ts` — score values, time bonus tiers, achievements (pure).
- `src/render/painter.ts` — all procedural art, themed per zone
  (`TERRAIN_THEMES`: verdant grass vs gear steel; themed backgrounds).
- `src/render/fx.ts` — game-juice layer: deterministic particles, screen
  shake, **hit-stop** (the world freezes a few frames on impact — the single
  most effective piece of juice), impact flashes, speed streaks and a
  tunnel vignette. Pure logic apart from `render`; honours
  `prefers-reduced-motion` (no shake/afterimages, halved particles, and only
  a 2-frame token hit-stop, since freeze reads as weight rather than motion).
- `src/render/decor.ts` — animated scenery placed by walking the terrain
  surface at load: wind-blown grass and flowers, fireflies, guttering
  torches, steam vents, turning cogs, drifting clouds. Decoration only.
- `src/game/BossArena.ts` — the arena lock-in: gates slam down at both ends
  when the boss spawns, a short cinematic holds control, and they grind back
  up when he falls.
- `src/core/Game.ts` — fixed 60 Hz timestep + fade transitions. `changeScene`
  takes a FACTORY and calls it only once the screen is fully black, so the
  level build/pre-render never hitches a visible frame.
- `src/core/bindings.ts` — remappable controls (primary + optional secondary
  per action, conflict stealing, localStorage persistence). Pure/testable.
- `src/core/Input.ts` — bindings-driven per-frame input + one-shot key capture
  used by the settings panel.
- `src/ui/` — canvas menus in a dark Material-ish language (`theme.ts`):
  `SettingsPanel` (key remapping) and `PauseMenu`, both keyboard-only.
- `src/scenes/` — TitleScene (START / SETTINGS) → CutsceneScene (story beat,
  skippable, doubles as the loading screen) → LevelScene(levelIndex) → next
  zone's cutscene → … → ending cutscene → title. ESC in a level opens the
  pause menu (resume / settings / restart / quit).

## Design rules learned (don't regress)

- **Hit-stop is for hits the player LANDS, never hits they take.** Freezing
  the world while someone is being hurt steals the reaction time they need,
  and repeated damage stacks freezes into an unplayable stutter. 'hurt' and
  'die' get shake and a flash instead. `freeze()` is also hard-capped so no
  event or bug can hold the world still.
- **Never re-emit a state-transition event while the state persists.**
  `damagePlayer` used to push 'die' every frame a dead player still
  overlapped a hazard; each one re-armed hit-stop and the game froze solid.
  Guard on the transition, and skip hazards entirely once `p.dead`.
- **Entity events need a position and a range.** Hazards run on their own
  clocks across the whole level. Without an `AMBIENT_RANGE` gate they chirp
  at the player from half a zone away, and without `Level.eventSources` their
  particles burst out of the hero instead of out of the hazard. Both read as
  constant meaningless noise. `tests/feedback.test.ts` asserts an idle hero
  triggers nothing at all.
- **Springs and launchers must clear `player.jumping`.** The variable-jump
  cutoff clamps upward speed to `PHYS.jrel` the moment the jump button is not
  held, so every spring in the game was firing at a third of its power until
  this was fixed. A launch's power belongs to the launcher, not the player.
- **Acceleration applies only BELOW top speed** (SPG). Clamping `gsp` down to
  `top` while the player holds the direction they are over-speeding in makes
  spin dash, springs, dash pads and loop boosts decay within a frame.
- Height changes on a running route use `hill`/`dip`/`gentleUp`/`gentleDown`
  (~26.5°). A 45° face reads as a wall at speed; keep those for deliberate
  obstacles only. The flow test in `tests/routes.test.ts` fails if a bot
  holding right gets pinned for more than 150 frames anywhere.
- Level build order: ground first (`floor` fills to bedrock), then sky
  platforms, then CARVE the underworld and give it a floor. Carving last is
  what stops the gallery being back-filled. `slab` builds a deck with space
  underneath.
- Drop shafts must clear every loop footprint, or they punch a hole in the
  loop's run-up corridor.
- Each zone owes three full-length routes (sky / ground / underground) with
  crystals spread across them, enforced by `tests/routes.test.ts`.
- A boss's ANIMATION clock must be separate from its phase timer. Phase
  changes reset `timer`, so anything drawn from it (the Wrecking Pod's mace)
  teleports the instant the boss is hit. Same rule for intangibility: gate it
  on real depth/state, not on the phase name, or a rig that is still visibly
  above the floor becomes unhittable.
- A vehicle that carries the player (rail, board) must set them down at a
  DEFINED position when the ride ends. Bailing out and leaving last frame's
  y is how riders end up inside whatever the ride finished against.
- Climb-out slopes must top out flush with the destination floor, and pits
  need an escape (spring) — a parked player cannot climb a 45° slope from
  standstill (authentic SPG slope factor).
- Wall sensors only stop the player on near-perpendicular obstacles
  (angleDiff > 60°); steepening curves are handled by ground sensors.
- Slope tiles that can be traversed in wall mode need true mirrored width
  arrays (see tile 2 in TILES).
- Level geometry: `slopeUp`/`slopeDown` backfill below — carve rooms AFTER
  slopes, and make sure every corridor span has an explicit `floor()` call.
- Vehicles are zone-specific and discovered progressively (dash pads first,
  then the Mag-Board pad); falling off the fast route must cost time, not a
  life (lower pits with spring escapes).
- Sounds/FX triggered from `Level.update` must be pushed to the LEVEL's event
  list. `player.events` is cleared at the start of the next `player.update`,
  and the scene reads it BEFORE `level.update`, so anything raised during the
  level update (hurt, 'shield-lost', 'board-lost') is invisible there — the
  level re-emits those itself. Same rule for a boss: forward the array its
  `update()` returns, don't drop it.
- A loop's annulus must satisfy `thickness >= innerR * (sqrt(2) - 1)`, else
  its lower quarters float above the corridor and headbutt the player instead
  of curving up under their feet.
- Loop entry and exit lines are the same two lines, so exiting is gated on a
  lap actually being climbed (`LoopTracker.armed`). Without that, a fast
  runner is ejected one frame after entering.

## Debug

`window.__game` exposes the Game (scene → level/player) for smoke testing in
the browser console.
