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
 *
 * THE VILLAIN SPEAKS. The first version told all of this in the narrator's
 * voice while a small pod hovered in the distance: the antagonist of the
 * whole campaign never said a word, never laughed, never looked at the
 * player. A line may now belong to a speaker (`speakers`, aligned with
 * `lines`); the scene gives it a close-up, a mood and a voice. Yolk gets an
 * entrance, a boast, a laugh and a parting shot in the opener, and one taunt
 * in every beat after it — a villain is someone you have heard gloat.
 */

export type CutsceneArt = 'steal' | 'chase' | 'ending';

/** Who says a line; `null` (or no `speakers` at all) is the narrator. */
export type Speaker = 'yolk';

/** How the speaker carries himself while saying it (drives the close-up). */
export type Mood = 'scheme' | 'grin' | 'gloat' | 'laugh' | 'point' | 'sad';

export interface Cutscene {
  id: string;
  art: CutsceneArt;
  lines: string[];
  /** Same length as `lines`: who speaks each one, and how. */
  speakers?: ({ who: Speaker; mood: Mood } | null)[];
}

const yolk = (mood: Mood) => ({ who: 'yolk' as const, mood });

/** Who speaks line `i` of a cutscene (null = the narrator). */
export function speakerOf(story: Cutscene, i: number): { who: Speaker; mood: Mood } | null {
  return story.speakers?.[i] ?? null;
}

/** Biome 1 opener — the theft itself, and a coast stuck at golden dusk. */
export const STORY_HOUR_OF_DUSK: Cutscene = {
  id: 'hour-of-dusk',
  art: 'steal',
  lines: [
    'The world keeps time with one small machine: the CHRONO CORE.',
    'It has ticked, untouched, for ten thousand years. Until tonight.',
    'Tick. Tock. ...MINE.',
    "Ten thousand years of everybody's time — and nobody thought to lock it up?",
    'NYA-HA-HA-HA-HAAA!',
    'He cracks it into four HOUR SHARDS —',
    'and the sun over Duskmere Coast simply... stops setting.',
    'From now on, the world runs on YOLK STANDARD TIME. Do try to keep up.',
    'BOLT can still run between the seconds. So run.',
  ],
  speakers: [null, null, yolk('scheme'), yolk('gloat'), yolk('laugh'), null, null, yolk('point'), null],
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
    'One shard? Keep it. My night shift has no morning, little fox.',
    'Second shard. Second hour. Keep running.',
  ],
  speakers: [null, null, null, null, yolk('grin'), null],
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
    'Follow me down, then! Nobody down here will ever know how late you are.',
    'Do not let him reach the bottom.',
  ],
  speakers: [null, null, null, null, yolk('point'), null],
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
    'You are too late. You will ALWAYS be too late — I have made sure of it!',
    'End the wait. Take tomorrow back.',
  ],
  speakers: [null, null, null, null, yolk('laugh'), null],
};

/** After the final biome: the Core is whole and time flows again. */
export const STORY_ENDING: Cutscene = {
  id: 'ending',
  art: 'ending',
  lines: [
    'The fourth shard clicks home. The Core remembers how to tick.',
    'Dusk sets. Midnight passes. The vault sleeps. Tomorrow ARRIVES —',
    'and Yolk Standard Time is cancelled, permanently.',
    'This is not over! I have all the time in the— oh. Oh, bother.',
    'Dr. Yolk flees into next week on a sputtering rocket-chair.',
    'BOLT does not chase him. There is finally time to rest.',
  ],
  speakers: [null, null, null, yolk('sad'), null, null],
};

/**
 * What Yolk says as the arena gates slam shut: [first fight, the rage
 * rematch]. One line each, under his name on the WARNING card and over his
 * laugh — every boss used to arrive in silence. Caps, and only characters
 * BOLT Display has (no apostrophes).
 */
export const BOSS_TAUNTS: Record<'pod' | 'press' | 'shard' | 'mirage', [string, string]> = {
  pod: ['THIS HOUR IS TAKEN, LITTLE FOX!', 'YOU AGAIN? YOU ARE WASTING MY TIME — ALL OF IT!'],
  press: ['CLOCK OUT. PERMANENTLY.', 'OVERTIME, FOX. UNPAID.'],
  shard: ['NOTHING DOWN HERE IS EVER LATE. EXCEPT YOU.', 'THIS DRILL KEEPS NO SCHEDULE!'],
  mirage: ['TOMORROW IS CANCELLED!', 'NOON WILL NEVER STRIKE!'],
};

/* Aliases kept while the original three zones migrate into the campaign. */
export const STORY_INTRO = STORY_HOUR_OF_DUSK;
export const STORY_ACT2 = STORY_HOUR_OF_MIDNIGHT;
export const STORY_ACT3 = STORY_HOUR_OF_NEVER;
