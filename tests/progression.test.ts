import { describe, it, expect } from 'vitest';
import { LEVELS } from '../src/levels/index.ts';
import { zone1 } from '../src/levels/zone1.ts';
import { zone2 } from '../src/levels/zone2.ts';
import { zone3 } from '../src/levels/zone3.ts';
import { STORY_INTRO, STORY_ACT2, STORY_ENDING } from '../src/game/story.ts';
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
  it('runs Verdant Rush, then Cog Skyway, then the Chrono Vault', () => {
    expect(LEVELS).toHaveLength(3);
    expect(LEVELS[0]).toBe(zone1);
    expect(LEVELS[1]).toBe(zone2);
    expect(LEVELS[2]).toBe(zone3);
  });

  it('gives each zone its own look and its own boss', () => {
    // Pinned per zone: an enum-membership check would pass if both zones
    // declared the same theme, or if the two were swapped.
    expect(zone1.theme).toBe('verdant');
    expect(zone1.bossKind).toBe('pod');
    expect(zone2.theme).toBe('gear');
    expect(zone2.bossKind).toBe('press');
    expect(zone3.theme).toBe('crystal');
    expect(zone3.bossKind).toBe('shard');
    expect(new Set(LEVELS.map((d) => d.theme)).size).toBe(LEVELS.length);
  });

  it('every level declares a theme, a boss and an intro cutscene', () => {
    for (const def of LEVELS) {
      expect(['verdant', 'gear', 'crystal']).toContain(def.theme);
      expect(['pod', 'press', 'shard']).toContain(def.bossKind);
      expect(def.intro.lines.length).toBeGreaterThanOrEqual(3);
      expect(['steal', 'chase', 'ending']).toContain(def.intro.art);
    }
    // Each zone gets its own story beat.
    expect(new Set(LEVELS.map((d) => d.intro.id)).size).toBe(LEVELS.length);
  });

  it('story order: intro -> act2 -> ending, all with text', () => {
    expect(zone1.intro).toBe(STORY_INTRO);
    expect(zone2.intro).toBe(STORY_ACT2);
    for (const c of [STORY_INTRO, STORY_ACT2, STORY_ENDING]) {
      expect(c.lines.length).toBeGreaterThanOrEqual(3);
      for (const line of c.lines) expect(line.length).toBeGreaterThan(0);
    }
    // The stolen MacGuffin threads through the whole campaign.
    expect(STORY_INTRO.lines.join(' ')).toMatch(/CHRONO CORE/i);
    expect(STORY_ENDING.lines.join(' ')).toMatch(/CHRONO CORE/i);
  });

  it('every campaign level keeps the collectible contract (5 crystals, 3 secrets)', () => {
    for (const def of LEVELS) {
      const level = new Level(def);
      expect(level.crystals).toHaveLength(5);
      expect(level.secrets).toHaveLength(3);
      expect(level.goal.x).toBeGreaterThan(level.bossTriggerX);
      expect(level.checkpoints.length).toBeGreaterThanOrEqual(2);
    }
  });
});
