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
import { act11 } from './act11.ts';

/**
 * BIOME 0 — DUSKMERE COAST, the stolen hour of dusk. Eleven acts:
 * act 1 carries the biome's story intro, acts 6 and 11 are the Wrecking Pod
 * fights (mid-biome check and the finale), everything else ends at the
 * signpost. The difficulty knobs turn steadily: hazard periods 170 → 140,
 * gauntlet density 1 → 3, hoppers from act 4, quarter pipes from act 4's
 * leap of faith, the cart galleries at act 8, the Mag-Board at act 9.
 */
export const duskActs: LevelDef[] = [
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
  act11,
];
