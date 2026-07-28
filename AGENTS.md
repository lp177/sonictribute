# BOLT — Chrono Rush (Sonic tribute)

Vanilla TypeScript + Canvas 2D platformer with Sonic Physics Guide (SPG)
movement. No game engine, no art assets — all sprites/backgrounds are drawn
procedurally at boot.

## Commands

- `npm run dev` — dev server (Vite)
- `npm run build` — typecheck (tsc) + production build
- `npx vitest run` — unit tests (77 tests, must stay green; add a test per
  feature/level to prevent regressions)

## Architecture

- `src/physics/constants.ts` — SPG values (60 fps, px/frame). Do not tune casually.
- `src/physics/TileMap.ts` — tiles with height/width arrays (SPG style), two
  collision layers (0 = normal, 1 = inside loops), procedural loop generator
  (`stampLoop`).
- `src/physics/sensors.ts` — ground/wall/ceiling sensor casts in 4 ground
  modes (floor/right wall/ceiling/left wall).
- `src/game/Player.ts` — hero state machine: gsp/xsp/ysp model, rolling, spin
  dash, slope factor, hurt/knockback, shield, speed shoes. Pure logic,
  headless-testable.
- `src/game/loops.ts` — Sonic 1-style layer switch triggers at loop bases.
- `src/game/Level.ts` + `src/levels/zone1.ts` — LevelBuilder API
  (floor/slope/carve/spring/secret/loop/boss…) and level data. Level owns
  entities, score, secrets, checkpoints, boss, respawn.
- `src/game/Boss.ts` — deterministic boss (timer-driven pattern, 8 HP).
  Boss reports contacts; the LEVEL applies player damage (single damage path —
  do not call `player.hurt()` from entities).
- `src/game/Score.ts` — score values, time bonus tiers, achievements (pure).
- `src/render/painter.ts` — all procedural art (terrain chunks, hero, boss…).
- `src/core/Game.ts` — fixed 60 Hz timestep + fade transitions (next scene is
  built behind the fade = no loading screens).
- `src/scenes/` — TitleScene, LevelScene.

## Design rules learned (don't regress)

- Climb-out slopes must top out flush with the destination floor, and pits
  need an escape (spring) — a parked player cannot climb a 45° slope from
  standstill (authentic SPG slope factor).
- Wall sensors only stop the player on near-perpendicular obstacles
  (angleDiff > 60°); steepening curves are handled by ground sensors.
- Slope tiles that can be traversed in wall mode need true mirrored width
  arrays (see tile 2 in TILES).
- Level geometry: `slopeUp`/`slopeDown` backfill below — carve rooms AFTER
  slopes, and make sure every corridor span has an explicit `floor()` call.

## Debug

`window.__game` exposes the Game (scene → level/player) for smoke testing in
the browser console.
