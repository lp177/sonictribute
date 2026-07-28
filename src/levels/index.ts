import type { LevelDef } from '../game/Level.ts';
import { zone1 } from './zone1.ts';
import { zone2 } from './zone2.ts';

/** Zone order for the campaign. Each def carries its own intro cutscene. */
export const LEVELS: LevelDef[] = [zone1, zone2];
