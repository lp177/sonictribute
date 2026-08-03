import { describe, it, expect } from 'vitest';
import { LEVELS, BIOMES, biomeActs } from '../src/levels/index.ts';
import {
  STORY_HOUR_OF_DUSK,
  STORY_HOUR_OF_MIDNIGHT,
  STORY_HOUR_OF_NEVER,
  STORY_HOUR_OF_TOMORROW,
  STORY_ENDING,
} from '../src/game/story.ts';
import { Level } from '../src/game/Level.ts';
import { Game, type Scene } from '../src/core/Game.ts';
import { Input } from '../src/core/Input.ts';

describe('Scene transitions', () => {
  const stubScene: Scene = { update() {}, render() {} };

  function makeGame() {
    return new Game({} as HTMLCanvasElement, new Input());
  }

  it('defers building the next scene until the fade covers the screen', () => {
    const game = makeGame();
    let built = 0;
    game.changeScene(() => {
      built++;
      return stubScene;
    });
    // This is what makes a cutscene a loading screen: the expensive level
    // build must NOT happen on the visible frame that requested it.
    expect(built).toBe(0);
    expect(game.transitioning).toBe(true);
  });

  it('ignores a second transition request while one is in flight', () => {
    const game = makeGame();
    let built = 0;
    const factory = () => {
      built++;
      return stubScene;
    };
    game.changeScene(factory);
    game.changeScene(factory);
    expect(built).toBe(0);
    expect(game.transitioning).toBe(true);
  });

  it('still accepts an already-built scene', () => {
    const game = makeGame();
    game.changeScene(stubScene);
    expect(game.transitioning).toBe(true);
  });
});

describe('Campaign progression', () => {
  it('runs the four stolen hours: 11 + 11 + 10 + 10 = 42 acts', () => {
    expect(LEVELS).toHaveLength(42);
    expect(biomeActs(0)).toHaveLength(11);
    expect(biomeActs(1)).toHaveLength(11);
    expect(biomeActs(2)).toHaveLength(10);
    expect(biomeActs(3)).toHaveLength(10);
  });

  it('each biome keeps its own theme and its own boss, mid + finale', () => {
    const bossKinds = ['pod', 'press', 'shard', 'mirage'] as const;
    BIOMES.forEach((biome, bi) => {
      const acts = biomeActs(bi);
      for (const { def } of acts) expect(def.theme, `${def.title} theme`).toBe(biome.theme);
      const bosses = acts.filter((a) => a.def.bossKind);
      expect(bosses, `${biome.name} boss cadence`).toHaveLength(2);
      for (const b of bosses) expect(b.def.bossKind).toBe(bossKinds[bi]);
      // The finale carries a boss; the other one sits mid-biome.
      expect(acts[acts.length - 1].def.bossKind).toBe(bossKinds[bi]);
    });
  });

  it('every level declares a theme; biome openers carry the story beat', () => {
    const seenBiome = new Set<number>();
    for (const def of LEVELS) {
      expect(['verdant', 'gear', 'crystal', 'neon']).toContain(def.theme);
      if (def.bossKind) expect(['pod', 'press', 'shard', 'mirage']).toContain(def.bossKind);
      const opener = !seenBiome.has(def.biome);
      seenBiome.add(def.biome);
      if (opener) {
        // The first act of a biome is where the story advances.
        expect(def.intro, `biome ${def.biome} opener has no cutscene`).toBeDefined();
        expect(def.intro!.lines.length).toBeGreaterThanOrEqual(3);
      }
      expect(def.title.length).toBeGreaterThan(3);
    }
    // Each biome opener gets its own story beat.
    const ids = LEVELS.filter((d) => d.intro).map((d) => d.intro!.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the four hour beats open their biomes, and the ending exists', () => {
    const beats = [STORY_HOUR_OF_DUSK, STORY_HOUR_OF_MIDNIGHT, STORY_HOUR_OF_NEVER, STORY_HOUR_OF_TOMORROW];
    BIOMES.forEach((_, bi) => {
      const acts = biomeActs(bi);
      expect(acts[0].def.intro, `biome ${bi} opener`).toBe(beats[bi]);
      for (const { def } of acts.slice(1)) expect(def.intro, `${def.title} must not re-run the cutscene`).toBeUndefined();
    });
    for (const c of [...beats, STORY_ENDING]) {
      expect(c.lines.length).toBeGreaterThanOrEqual(3);
      for (const line of c.lines) expect(line.length).toBeGreaterThan(0);
    }
    expect(STORY_HOUR_OF_DUSK.lines.join(' ')).toMatch(/CHRONO CORE/i);
    expect(STORY_ENDING.lines.join(' ')).toMatch(/Core/);
  });

  it('spot-checks the collectible contract on each biome opener and finale', () => {
    // The full 42-act sweep lives in tests/acts.test.ts; this is the fast pin.
    for (const bi of [0, 1, 2, 3]) {
      const acts = biomeActs(bi);
      for (const { def } of [acts[0], acts[acts.length - 1]]) {
        const level = new Level(def);
        expect(level.crystals).toHaveLength(5);
        expect(level.secrets).toHaveLength(3);
        expect(level.checkpoints.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
