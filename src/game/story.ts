/**
 * Background story beats (pure data, unit tested). Each cutscene plays while
 * the NEXT scene is built behind the fade — the cinematic doubles as the
 * loading screen, so there is never a visible pause between levels.
 */

export type CutsceneArt = 'steal' | 'chase' | 'ending';

export interface Cutscene {
  id: string;
  art: CutsceneArt;
  lines: string[];
}

/** Opening: what Dr. Yolk stole, and why BOLT gives chase. */
export const STORY_INTRO: Cutscene = {
  id: 'intro',
  art: 'steal',
  lines: [
    'The Chrono Shrine, at dusk.',
    'Dr. Yolk rips the CHRONO CORE from the altar —',
    'its five Chrono Crystals scatter across the coast!',
    'Time itself begins to stutter and skip.',
    'BOLT — recover the crystals. Catch that egg!',
  ],
};

/** Between Zone 1 and Zone 2: the pursuit climbs into Yolk's sky-factory. */
export const STORY_ACT2: Cutscene = {
  id: 'act2',
  art: 'chase',
  lines: [
    'The coast crystals are safe — but Yolk keeps the Chrono Core.',
    'His oily trail climbs into the clouds...',
    'COG SKYWAY: conveyor steel, and a long way down.',
    'His Mag-Boards are lying around. Borrow one.',
  ],
};

/** After the last zone (this build): the Core is recovered. */
export const STORY_ENDING: Cutscene = {
  id: 'ending',
  art: 'ending',
  lines: [
    'The Piston Crusher lies in pieces.',
    'Dr. Yolk flees on a sputtering rocket-chair —',
    'and drops the CHRONO CORE into BOLT’s hands!',
    'Time flows true again... for now.',
    'THE CHASE CONTINUES IN THE NEXT ZONE.',
  ],
};
