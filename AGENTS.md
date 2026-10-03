# BOLT — Chrono Rush (Sonic tribute)

Vanilla TypeScript + Canvas 2D platformer with Sonic Physics Guide (SPG)
movement. No game engine, no assets — all sprites, backgrounds, the font and
the music are generated in code.

## Commands

- `npm run dev` — dev server (Vite)
- `npm run build` — typecheck (tsc) + production build
- `npx vitest run` — unit tests (~1000 tests, must stay green; add a test per
  feature/level to prevent regressions)

## Architecture

- `src/physics/constants.ts` — SPG values (60 fps, px/frame). Do not tune
  casually. Three are deliberate departures (`acc`, `frc`, `airTurn`: how fast
  the hero answers the stick) — see "The hero answers the stick" below.
- `src/physics/TileMap.ts` — tiles with height/width arrays (SPG style), two
  collision layers (0 = normal, 1 = inside loops), procedural loop generator
  (`stampLoop`). `makeTile` derives the side profiles (`widths`,
  `widthsLeft`) from the heights unless they are given.
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
  dirs (dusk/midnight/never/tomorrow). An act is a 64-row world composed from
  two kits that chain the same way (`(b, x, row) -> { endX, endRow }`):
  `levels/sections.ts`, the RELIEF kit (valleys with kickers, loops fed by a
  hill, plunges, long jumps, hills with a cave under them, the tube shot, plus
  the terrain-following `highRoad` and the `lowRoad` galleries), and
  `levels/motifs.ts`, the flat gimmick KNOTS stamped between them. Every act is
  gated by `tests/actContract.ts` (see "Level design rules"). zone1/2/3.ts are
  retired from the roster but kept as engine-test fixtures.
  LevelDef carries `theme` ('verdant' | 'gear' | 'crystal' | 'neon'),
  `bossKind` ('pod' | 'press' | 'shard' | 'mirage'), the finale-only
  `bossRage`, and its `intro` cutscene. Level owns entities, score, secrets,
  checkpoints, boss, respawn, board mount/dismount.
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
- `src/core/view.ts` — the 640x360 LOGICAL view and the device render scale
  (quarter steps, max 3). `Game` installs the scale as the context transform;
  offscreen art is a `Layer` from `makeLayer` drawn with `blit`. The WORLD is
  drawn `WORLD_ZOOM` (1.5) times larger than the UI — a 427x240 playfield —
  and its art is baked at `worldScale()`.
- `src/render/terrain.ts` + `terrainGeometry.ts` (pure, tested) — terrain
  baked lazily into 256x256 chunks (LRU, prefetch ahead of the run) from
  smoothed column runs merged into strip polygons; per-zone procedural
  materials; caps / rims / AO / glow derived by compositing the path against
  shifted copies of itself; back walls behind roofed galleries.
- `src/render/backdrop.ts` — per-biome layered parallax: a screen layer plus
  three seamless periodic bands and optional live elements.
- `src/render/font.ts` — BOLT Display, the game's stroked caps typeface
  (`drawText`, kerning, tabular figures) + `proseFont` for running text.
- `src/render/sprite.ts` — `Outliner`: keyline + hit-flash for sprites.
- `src/render/hero.ts` — BOLT's articulated rig and pose set (also used for
  the title and cutscenes via `drawBoltPose`); `objects.ts` — rings,
  crystals, springs, monitors, spikes, lamps, goal, badniks;
  `characters.ts` — Dr. Yolk, his pod, the Chrono Core;
  `painter.ts` — remaining props, hazards and the bosses.
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
  level build/pre-render never hitches a visible frame. Draws are separate
  from steps: `Scene.render(ctx, alpha)` is called with how far the clock is
  into the next step, and `core/pacing.ts` (`FramePacer`, pure, tested)
  decides how often to draw and when to shed resolution.
- `src/render/crt.ts` — the CRT glaze, a static canvas stacked OVER the game
  canvas (zero per-frame cost, laid out in real device pixels).
- `src/pwa/` — offline + update control. `sw.template.js` is the service
  worker; its precache list and cache version are injected AT BUILD TIME by the
  plugin in `vite.config.ts` (pure logic in `buildSw.ts`, unit tested), because
  bundle filenames are content-hashed and a hand-written list would go stale
  silently. `appUpdate.ts` is the page-side state machine (register → detect a
  waiting worker → apply on the player's say-so → reload), fully injectable so
  it tests headless; `updateHandle.ts` is the singleton the menus read.
- `src/core/bindings.ts` — remappable controls (primary + optional secondary
  per action, conflict stealing, localStorage persistence). Pure/testable.
- `src/core/Input.ts` — bindings-driven per-frame input + one-shot key capture
  used by the settings panel.
- `src/ui/` — the UI language (`theme.ts`: lean, keycaps, device-aware
  `promptGlyph`/`promptRow`, `ListNav` for keys/pad/mouse/touch), `Hud`,
  `TitleCard`, `Results` (tally + rank), `PauseMenu`, `OptionsMenu`,
  `SettingsPanel` (key remapping), `TouchControls`, `glyphs`.
- `src/core/settings.ts` — persisted options (volumes, shake, flashes, touch,
  timer, CRT); `gamepad.ts` / `pointer.ts` — pad and pointer input merged
  into `Input` (semantic `menuUp/Down/Left/Right/Confirm/Back`,
  `pausePressed`, `lastDevice`).
- `src/audio/` — `mixer.ts` (one AudioContext, music/sfx buses, limiter),
  `music.ts` (lookahead tracker), `songs.ts` + `notation.ts` (the ten tracks,
  pure and tested), `sfx.ts` (`sfx.music` is the jukebox). The effects are a
  small FM + PSG toolkit in four loudness tiers; `SOUND_DESIGN.md` is the
  reference for every sound (what fires it, its layers, its level) — a new
  event needs a `case` there, a row in that table and a name in the cue list
  in `tests/events.test.ts`. `play(name, { pan })` places a sound where it
  happened.
- `src/scenes/` — TitleScene (START or CONTINUE / LEVEL SELECT / OPTIONS) →
  CutsceneScene (story beat staged per line, skippable, doubles as the loading
  screen) → LevelScene(levelIndex) → next zone's cutscene → … → ending
  cutscene → title. LevelSelectScene: zone tabs, act list with ranks, act
  card. Pause in a level opens the pause menu (resume / options / restart /
  quit, the last two confirmed).

## Level design rules (what makes an act fun — enforced by `tests/actContract.ts`)

These come from how the classic acts are built and from what their designers
and critics say about them. The campaign used to break every one: three flat
parallel lanes, a dash pad before every loop, and holding right finished any
act.

- **Speed is the ground's to give.** A loop, a ramp, a long jump gets its
  run-up from a DOWNHILL, never a booster: at most two dash pads per act, none
  feeding a loop. Rolling a 12-row descent is worth ~2 px/frame over running
  it — that difference is the game. Kickers (`sections.kicker`) are plain
  terrain with no launcher on the lip, so the arc is the approach speed.
- **Speed decides which road you are on.** The roads are stacked and
  INTERWOVEN, not parallel: carry speed over a kicker and you are thrown to
  the high ledge; lose it and you are on the low road — slower, never dead.
  At least 40% of an act has a second road, 10% a third.
- **No road is a straight line.** At least 14 rows of relief, three real
  descents, and never more than 44 level columns of ground outside the home
  straight. Height won on a release is paid back by a spring cliff or a
  terrace climb.
- **Knot, release, knot, release.** A knot is a tight flat gimmick from the
  motif kit (tension); a release is a relief section (the reward). Never chain
  two knots; never let a release end in a hazard — one screen after any
  launch, loop or plunge has nothing on it but ground and rings.
- **Rings trace the line.** Every flight path is drawn in rings
  (`sections.ringArc`); a blind jump with no ring trail is a bug.
- **Nothing is bottomless.** A missed jump costs time, never the run. Every
  low ROAD has a way out that works by holding right (a spring lift at its
  far end); only a small secret room may ask you to walk back to its shaft.
- **Loops are few and belong to their hill:** three at most, each with
  something on its roof that is seen from the road and reached from above.
- **Acts are classic-sized:** 480–760 tiles by 64. A first run takes 40–60 s,
  a rolled run about 30.
- **Anyone can walk up a hill** (`CLIMB` in Player.ts): raw SPG stalls a slow
  hero on a 26.5° ramp, which in a world made of hills is a dead stop on
  ordinary ground. It covers 45° faces too — left out at first, and every
  author then built the same trap (a hero set down at the foot of a kicker
  with nowhere to back up to). A slow climb costs the LAUNCH, not the road.
- **Every ledge can be stood on, every prize taken** (`tests/reach.ts`, part
  of the contract). The flood fill only proves a prize is not sealed in rock;
  three biomes' first drafts had catwalks eleven rows over flat ground with
  nothing leading up, crystals included. `highRoad` and `droneBridge` stamp
  stepping ledges up to themselves when nothing else reaches them, and a
  `loopHill` carries a ledge onto its own roof.
- **A stomp returns the fall** (`BOUNCE`): hold jump on a badnik and you
  rebound to the height you fell from, so a row of drones is a bridge.

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
- **Acceleration applies only BELOW top speed** (SPG) — on the ground AND in
  the air. Clamping `gsp` down to `top` while the player holds the direction
  they are over-speeding in makes spin dash, springs, dash pads and loop
  boosts decay within a frame; the same clamp on `xsp` in `updateAir` (the
  Sonic 1 air cap) cut every flight faster than a run down to running speed
  the instant forward was held, so kickers and rails threw a third short.
- **A neighbour across an edge is not the same surface.** `slopeAngle` reads
  the height columns either side of the sensor; straight across the lip of a
  ledge that is 16 px of ground and then nothing, which it took for an 83°
  slope. A hero with one foot on that last pixel column flipped into wall
  mode and ran down the cliff face glued to it, or round a shaft's lip and
  along its ceiling — the "clipping" at every ledge. `slopeAcross` carries
  the slope on from the side that still exists
  (`tests/sensors.test.ts` sweeps every speed and pixel offset).
- **A ledge the tile map does not know must CARRY the hero before it asks
  whether he is on it.** He comes unstuck from crumbling and hard-light
  ledges every frame, so `CrumblePlatform.update` — which looked for grounded
  feet before `standOn` had set him down — never saw any: no ledge ever
  crumbled under someone who landed on it. Same family: the wing refused to
  open after a jump (`jumping` stayed true all the way down), and a rail
  boarded a hero thrown BACK by a hit and rode him the wrong way.
- **A ball stays a ball.** Standing the hero up on every landing ("as in the
  classics") was tried and reverted: the ground is hills and lips, a rolling
  hero leaves it for a frame constantly, and a player holding the roll was
  uncurled a dozen times an act at full speed. The roll ends when it runs out
  of speed — never because the terrain had a bump in it.
- **A tile's side profiles must be TRUE.** `makeTile` used to default
  `widths` to "the whole box is a wall if the tile has anything in it". The
  rounded foot of every ramp and kicker was therefore a 16-px wall to
  anything whose middle sits lower than a standing hero's — a ball. Measured:
  39 % of rolled approaches to a rise stopped dead and stood up (every speed,
  every pixel offset); and a slow climber's wall-mode sensors read the same
  boxes as a 63° face and threw him off the kicker in hops. Both were
  reported by a player as "the ball stands up at the slightest rise". The
  profiles are now derived from the heights; `tests/sensors.test.ts` sweeps
  every speed and offset into a ramp and a kicker.
- **A ball out of speed gets up on anything the legs can climb.** The uncurl
  limit sat a hair under a 45° face and the slide-off limit a hair over it: a
  ball that came to rest on a kicker could do neither, and with no control in
  a roll it froze there for good.
- **The hero answers the stick** (the three non-SPG constants, plus `START`
  in Player.ts). At the guide's values he needs 128 frames to reach a run,
  128 to coast to a stop and a whole jump to turn in the air: faithful, and
  what play-testing called heavy, too much inertia. Now: `acc` x1.5 with a
  kick off the line that fades by speed 4 (a jog in 24 frames, a run in ~63),
  `frc` x2 (a stop in 64), and `airTurn` — steering AGAINST a flight brakes
  twice as hard as steering with it pushes. Top speed, jump, gravity, slope
  factors and the forward push in the air are untouched, so speed is still
  made and lost on the terrain. Two things were tried and withdrawn because
  they flattened the kit's speed tiers: the kick ON slopes (a hero at the
  foot of a kicker left its lip at a run) and a doubled forward air push
  (every slow launch became a full-speed flight in mid-air).
- **Never put a one-way tile on, or one row over, a ramp tile.** The ground
  sensors of whoever is walking UP the ramp read it, and he stops dead under
  it. Ledges end two rows clear of any slope (`launchValley`'s lower ledge).
- **A high road needs a way in.** A jump clears six rows; the high road rides
  eleven up. A stretch with no valley ledge, spring or cave lift arriving
  under it is scenery — `highRoad({ onRamp: true })` stamps stepping ledges.
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
- A cave must be a TRAVELLABLE gallery — floor plus headroom, a way in and a
  way out — never bedrock with a bonus closet. `sections.lowRoad` builds one
  and refuses to be dug under a slope.
- The camera may overscroll above the map top (`Camera.overscrollTop`).
  Without it the view pins to y=0 on the sky route and the hero rides the
  top third of the frame while the lower paths hog the screen.
- Anything that moves on a track must RENDER its track. Minecarts rode
  invisible rails — the cart read as flying and its crash as hitting thin
  air. If the player must predict it, the player must see it.
- A biome fights its boss twice; the finale rematch must not replay the same
  script. `LevelDef.bossRage` unlocks each boss's escalated pattern (pod:
  double dive + wider mace; press: trailing shockwave pair + shorter vent;
  shard: third leaning volley + faster chase; mirage: hotter trace + briefer
  derez). Queued rage projectiles are inert until born.
- The hang glider (`GLIDE`, `b.glider`, `b.wind`) deploys by HOLDING jump
  while falling, folds on landing or release, and is lost on a real hit.
  Wind zones are silent force fields, never event sources.
- A boss's ANIMATION clock must be separate from its phase timer. Phase
  changes reset `timer`, so anything drawn from it (the Wrecking Pod's mace)
  teleports the instant the boss is hit. Same rule for intangibility: gate it
  on real depth/state, not on the phase name, or a rig that is still visibly
  above the floor becomes unhittable.
- A vehicle that carries the player (rail, board) must set them down at a
  DEFINED position when the ride ends. Bailing out and leaving last frame's
  y is how riders end up inside whatever the ride finished against.
- Climb-out slopes must top out flush with the destination floor, and pits
  need an escape (spring or a walkable climb). A parked player does walk up
  a 45° face now (`CLIMB`), but slowly and with no launch off its lip.
- Wall sensors only stop the player on near-perpendicular obstacles
  (angleDiff > 60°); steepening curves are handled by ground sensors.
- Slope tiles need true side profiles. `makeTile` derives them from the
  heights; pass explicit `widths` only for shapes that are not "solid below
  a height profile" (tile 2 keeps its hand-written mirror, loops stamp their
  own).
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
- **The service worker must never apply an update on its own.** `install` does
  NOT call `skipWaiting()`; the new worker sits waiting until the player picks
  UPDATE GAME on the title screen, and only then does the page reload. Swapping
  the bundle mid-act would throw away the run, and an auto-reload is
  indistinguishable from a crash. For the same reason the update row is offered
  on the title screen only, never in the pause menu.
- **The precache list is generated, never written by hand.** It comes from the
  files actually emitted, and the cache version is a fingerprint of their
  CONTENTS — not their names — because `index.html` is not content-hashed, so a
  meta-tag-only edit would otherwise ship a new page under an old version and
  never reach players. `renderServiceWorker` throws (failing the build) rather
  than emit a worker with an empty precache or an unreplaced placeholder.
- Anything added to `public/` needs its `docs/` twin `git add`ed explicitly:
  CI's staleness check is `git diff --quiet -- docs`, which does not see NEW
  untracked files, so a forgotten asset passes CI and 404s on the live site.

## Presentation rules learned (don't regress)

- **Draw between steps, never once per display frame.** The simulation is 60
  Hz; the display may be 240. Drawing every `requestAnimationFrame` put four
  identical frames on screen per step and saturated a laptop GPU, so the
  frames that did finish arrived unevenly — the game stuttered while its
  JavaScript cost 2 ms. `Scene.render` interpolates the camera and the hero by
  `alpha`; `FramePacer` rations the draws and drops to 60 fps, then to a lower
  render scale, when the device cannot keep an even cadence.
- **Animation clocks tick per simulation step, not per draw.** Anything that
  counts frames inside a render path runs at the monitor's refresh rate.
- **Never let an animated wheel turn more than a quarter cycle per frame.** The
  sprint legs (two shoes half a turn apart) aliased and visibly spun
  BACKWARDS at speed; capped, they read forward and the streaks say the rest.
- **Expensive bakes are staged.** A terrain chunk is ~15 compositing passes:
  the ones ahead of the run are baked three passes a frame
  (`TerrainRenderer.bake` is a generator that yields before every pass),
  only on-screen ones in one go. At the world scale a chunk is 2.25 times the
  pixels it was — the stage had to shrink to one pass to keep a frame's bake
  work where it was.
- **The world is framed like the classics: 427x240, not 640x360.** At one
  world pixel per logical pixel the view showed forty tiles across, twice the
  field of view of the games this one is modelled on. Top speed crawled over
  the screen, the hero was a speck and a twenty-screen act read as a short
  corridor ("the maps feel small"). `WORLD_ZOOM` scales the world only; HUD,
  menus and text stay in 640x360. World art (terrain chunks, loops, the
  `Outliner` sprites) is baked at `worldScale()` so it still blits 1:1 —
  baked at the UI scale it would be magnified and soft. The camera position
  is snapped with `snapWorld`. The backdrop is screen-space and scrolls by
  the resting zoom from the centre of the view, so a zoom does not drag it.
- **A boss fight pulls the camera back** until the arena is in frame
  (`LevelScene.arenaZoom`), eased, and back in when he falls: a boss that
  attacks from off screen is not a fight. The zoom is part of the
  interpolated state (`prev.zoom`).
- **On a slope the camera leads vertically** (`Camera.slopeLead`), and on the
  ground it tracks the hero closely (`deadzoneGround`): in a 240-px-tall view
  a descent left the frame a hundred pixels ahead of the feet. The wide dead
  zone is for jumps only, and in the air the framing HOLDS — easing back to
  neutral for the length of a hop rocks the view on every jump.
- **Cull on extent, not on anchor.** A pendulum culled on its pivot blinks out
  with its ball still on screen.
- **The camera leads on velocity, eased.** Lead as a function of speed and
  facing lurches a hundred pixels on every skid or wall; and it shifts its
  framing downward during a long fall so the landing is seen before it is
  reached.
- **Audio unlocks on the first gesture of ANY kind**, inside the DOM handler
  (`Sfx.unlock`), and one-shots are dropped while the context is still
  suspended — queued, they all fire at once when it wakes.

- **Lay out in logical units, never in canvas pixels.** `ctx.canvas.width` is
  the device backing store (up to 1920); use `VIEW_W`/`VIEW_H`. Offscreen
  canvases must come from `makeLayer` (baked at the render scale — or at
  `worldScale()` for anything drawn inside the world transform) and be drawn
  with `blit`, or they come out blurry; caches re-bake when
  `renderScaleVersion()` changes. Snap camera and sprite positions with
  `snap()` / `snapWorld()` so baked layers blit 1:1 and nothing shimmers.
- **Compositing masks must be opaque.** `destination-out`/`-in` scale by the
  source alpha; a translucent colour used as the mask removes only a fraction
  (that bug tinted every terrain pixel with the rim light). Build the mask in
  `#000`, then colour it with `source-in`.
- **Path complexity is GPU time.** Terrain chunks fill their path ~20 times;
  per-column quads (~300 sub-polygons) stalled frames for seconds on software
  GL. Keep strips merged and collinear points dropped.
- **Edge effects need enough neighbouring geometry.** Depth shading looks up
  to 176 px above a pixel, so chunks build geometry `MARGIN_TOP` above
  themselves; anything less shows as a seam on every chunk row.
- **Parallax bands are periodic and seeded per prop.** Whole sine cycles per
  period, props drawn wrapped with their own seed (a shared RNG makes the two
  halves of a wrapped prop differ). Never tile one picture twice at different
  alphas — that was the "two suns" bug. Far bands must not fill downward.
- **Everything the player must track gets a dark keyline** (`Outliner` or an
  inline stroke); backgrounds stay lower contrast. Gold = reward, cyan =
  Chrono / interactive, red + steel = danger.
- **BOLT is a fox** (broad swept ears, cheek ruff, lightning tail), not a
  quilled hedgehog: an original character. There is ONE rig (`hero.ts`) for
  play, title and cutscenes.
- **Prompts name the device in use.** Never hard-code "PRESS ENTER": use
  `promptGlyph`/`promptRow` (keys follow rebinding, pads show buttons, touch
  shows tap icons). Touch players have no confirm key — every "press to
  continue" also accepts `input.pointer.released`.
- **Never hold the player hostage.** Title card, results tally and cutscenes
  are skippable (back skips a whole cutscene); restart/quit ask twice; the
  level pauses itself when the page is hidden or blurred (`Scene.suspend`),
  and the mixer suspends with a hidden tab.
- **No tutorial text during play.** The game had a coach: a line at the
  bottom of the screen the first time each mechanic came up. In a game this
  fast nobody has time to read it, and a caption on every interactable is
  noise — the player works it out, and the key hints live in Options >
  Controls. It was removed outright; do not bring it back as an option.
- **Music follows state, not events**: `LevelScene.updateMusic` derives
  zone / boss (`finale` when `bossRage`) / clear from the level each frame;
  speed shoes set tempo 1.2; the pause menu ducks.

## Debug

`window.__game` exposes the Game (scene → level/player) for smoke testing in
the browser console.
