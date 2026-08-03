import type { LevelDef, LevelTheme } from '../game/Level.ts';
import { zone1 } from './zone1.ts';
import { zone2 } from './zone2.ts';
import { zone3 } from './zone3.ts';

/**
 * The four stolen hours — one biome per Hour Shard, each with its own look,
 * mechanisms and boss. Acts live in `levels/<biome>/actN.ts`; the campaign is
 * their concatenation in biome order.
 */
export interface Biome {
  id: string;
  name: string;
  /** The hour Yolk froze this region at (flavour, shown in level select). */
  hour: string;
  theme: LevelTheme;
}

export const BIOMES: Biome[] = [
  { id: 'dusk', name: 'DUSKMERE COAST', hour: 'STUCK AT DUSK', theme: 'verdant' },
  { id: 'midnight', name: 'OTHERWHILE FOUNDRY', hour: 'ENDLESS MIDNIGHT', theme: 'gear' },
  { id: 'never', name: 'THE UNDERWHEN', hour: 'NO HOUR AT ALL', theme: 'crystal' },
  { id: 'tomorrow', name: 'NOON TOMORROW', hour: 'TOMORROW, ALWAYS', theme: 'neon' },
];

/** Campaign order. Every def carries its biome; openers carry the cutscene. */
export const LEVELS: LevelDef[] = [zone1, zone2, zone3];

/** The acts of one biome, in campaign order (with their campaign indices). */
export function biomeActs(biome: number): { def: LevelDef; index: number }[] {
  return LEVELS.map((def, index) => ({ def, index })).filter((e) => e.def.biome === biome);
}
