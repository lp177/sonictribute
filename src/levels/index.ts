import type { LevelDef, LevelTheme } from '../game/Level.ts';
import { duskActs } from './dusk/index.ts';
import { midnightActs } from './midnight/index.ts';
import { neverActs } from './never/index.ts';
import { tomorrowActs } from './tomorrow/index.ts';

/**
 * The four stolen hours — one biome per Hour Shard, each with its own look,
 * mechanisms and boss. Acts live in `levels/<biome>/actNN.ts`; the campaign
 * is their concatenation in biome order.
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

/** Campaign order: 42 acts. Every def carries its biome; openers, the story. */
export const LEVELS: LevelDef[] = [...duskActs, ...midnightActs, ...neverActs, ...tomorrowActs];

/** The acts of one biome, in campaign order (with their campaign indices). */
export function biomeActs(biome: number): { def: LevelDef; index: number }[] {
  return LEVELS.map((def, index) => ({ def, index })).filter((e) => e.def.biome === biome);
}
