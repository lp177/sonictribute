/**
 * Background story beats (pure data, unit tested). Each cutscene plays while
 * the NEXT scene is built behind the fade — the cinematic doubles as the
 * loading screen, so there is never a visible pause between levels.
 *
 * THE SCENARIO — "the day Dr. Yolk stopped the clock":
 * The Chrono Core is not a treasure, it is the escapement of the world —
 * the little mechanism that lets "now" tick forward into "next". Dr. Yolk
 * split it into four HOUR SHARDS and jammed one into each of his four great
 * Engines, freezing four regions at the hour that suits him best. While the
 * world stands still, he is winding a clock of his own: Yolk Standard Time,
 * where every day runs on his schedule. BOLT — small enough to slip between
 * two seconds — is the only one still free to run. One biome per stolen hour;
 * pull the shard, the hour comes unstuck, and the chase moves on.
 */

export type CutsceneArt = 'steal' | 'chase' | 'ending';

export interface Cutscene {
  id: string;
  art: CutsceneArt;
  lines: string[];
}

/** Biome 1 opener — the theft itself, and a coast stuck at golden dusk. */
export const STORY_HOUR_OF_DUSK: Cutscene = {
  id: 'hour-of-dusk',
  art: 'steal',
  lines: [
    'The world keeps time with one small machine: the CHRONO CORE.',
    'Tonight Dr. Yolk cracks it into four HOUR SHARDS —',
    'and the sun of Duskmere Coast simply... stops setting.',
    'Stuck golden light. Tides that never turn. Birds parked mid-air.',
    'BOLT can still run between the seconds. So run.',
  ],
};

/** Biome 2 opener — a foundry where midnight never ends. */
export const STORY_HOUR_OF_MIDNIGHT: Cutscene = {
  id: 'hour-of-midnight',
  art: 'chase',
  lines: [
    'The first shard is free — dusk finally lets the coast go.',
    'The trail climbs to the OTHERWHILE FOUNDRY,',
    'where Yolk pinned the clocks at midnight: the shift never ends,',
    'the furnaces never cool, and the workers never get to go home.',
    'Second shard. Second hour. Keep running.',
  ],
};

/** Biome 3 opener — the vault outside every hour. */
export const STORY_HOUR_OF_NEVER: Cutscene = {
  id: 'hour-of-never',
  art: 'chase',
  lines: [
    'Midnight breaks. The foundry whistle finally blows.',
    'The third shard sits deeper: THE UNDERWHEN,',
    'the cavern the Core was first cut from — a place with no hour at all.',
    'Down here Yolk is drilling for something older than clocks.',
    'Do not let him reach the bottom.',
  ],
};

/** Biome 4 opener — the city where tomorrow never arrives. */
export const STORY_HOUR_OF_TOMORROW: Cutscene = {
  id: 'hour-of-tomorrow',
  art: 'chase',
  lines: [
    'Three hours running again. One left — and it is the strangest:',
    'NOON TOMORROW, the city Yolk promised his machines.',
    'Neon avenues, sky-rails, a skyline counting down to a day',
    'that never comes. The last shard powers the countdown itself.',
    'End the wait. Take tomorrow back.',
  ],
};

/** After the final biome: the Core is whole and time flows again. */
export const STORY_ENDING: Cutscene = {
  id: 'ending',
  art: 'ending',
  lines: [
    'The fourth shard clicks home. The Core remembers how to tick.',
    'Dusk sets. Midnight passes. The vault sleeps. Tomorrow ARRIVES —',
    'and Yolk Standard Time is cancelled, permanently.',
    'Dr. Yolk flees into next week on a sputtering rocket-chair.',
    'BOLT does not chase him. There is finally time to rest.',
  ],
};

/* Aliases kept while the original three zones migrate into the campaign. */
export const STORY_INTRO = STORY_HOUR_OF_DUSK;
export const STORY_ACT2 = STORY_HOUR_OF_MIDNIGHT;
export const STORY_ACT3 = STORY_HOUR_OF_NEVER;
