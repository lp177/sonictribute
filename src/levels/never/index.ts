import type { LevelDef } from '../../game/Level.ts';
import { act01 } from './act01.ts';
import { act02 } from './act02.ts';
import { act03 } from './act03.ts';
import { act04 } from './act04.ts';
import { act05 } from './act05.ts';
import { act06 } from './act06.ts';
import { act07 } from './act07.ts';
import { act08 } from './act08.ts';
import { act09 } from './act09.ts';
import { act10 } from './act10.ts';

/**
 * THE UNDERWHEN — biome 2, 'NO HOUR AT ALL'. Ten acts in campaign order, a
 * cavern drilled toward its bottom: most of them sink, on grind rails slung
 * across chasms, diving minecarts and plunges, under roofs strung with
 * stalactites and over floors of hard light that are only sometimes there.
 * Act 6 is the rails' own, act 8 the low road's, act 9 the one that climbs
 * back out. Shard bosses at act 5 (mid-check) and act 10 (finale). Biome
 * pieces live in `pieces.ts`.
 */
export const neverActs: LevelDef[] = [
  act01,
  act02,
  act03,
  act04,
  act05,
  act06,
  act07,
  act08,
  act09,
  act10,
];
