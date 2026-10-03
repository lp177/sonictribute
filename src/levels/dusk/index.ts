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
 * signpost. A coast of headlands and bays, each act with its own shape:
 * the wing arrives in act 2 (`gliderBay`, `thermalCliff`), the caves in act
 * 3, hoppers in tide pools in act 4, slope-fed reef bowls in act 5; the
 * second half climbs (7, 10), goes through the rock (8), takes the high
 * road (9) and comes back down the seawall (11). Hazard clocks tighten
 * 170 → 140 and gauntlet density runs 1 → 3 along the way. Biome pieces
 * live in `pieces.ts`.
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
