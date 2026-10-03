import type { LevelDef } from '../../game/Level.ts';
import { midnight01 } from './act01.ts';
import { midnight02 } from './act02.ts';
import { midnight03 } from './act03.ts';
import { midnight04 } from './act04.ts';
import { midnight05 } from './act05.ts';
import { midnight06 } from './act06.ts';
import { midnight07 } from './act07.ts';
import { midnight08 } from './act08.ts';
import { midnight09 } from './act09.ts';
import { midnight10 } from './act10.ts';
import { midnight11 } from './act11.ts';

/**
 * BIOME 1 — OTHERWHILE FOUNDRY, the endless midnight shift. Eleven acts of
 * gear-theme foundry, built vertical: slag chutes with a cart or a skyhook
 * rail over them, needle roofs (steel stalactites) that double as the high
 * road, press halls a kicker carries you over, the coolant galleries
 * underneath, and late-biome shift-change catwalks of hard light. The
 * Mag-Board rides acts 3, 7, 10 and 11. The Piston Press guards act 6 (a
 * descent into the pit) and act 11 (the climb to the last bell). Biome
 * pieces live in `pieces.ts`.
 */
export const midnightActs: LevelDef[] = [
  midnight01,
  midnight02,
  midnight03,
  midnight04,
  midnight05,
  midnight06,
  midnight07,
  midnight08,
  midnight09,
  midnight10,
  midnight11,
];
