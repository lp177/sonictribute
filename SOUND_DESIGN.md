# BOLT — sound effects

Everything is synthesised in `src/audio/sfx.ts`; there are no audio files.
This is the reference for what each sound is, why, and how loud.

## House style

**A Mega Drive cabinet.** Three voice types, the three the console had, and
every effect is a small arrangement of them:

| Voice | What it is | What it is for |
|---|---|---|
| `fm` | 2-operator FM (YM2612): a modulator swings the carrier's pitch; its index has its own decay | whole-number ratio → brass, buzz, "boing"; anything else (1.41, 2.4, 2.76, 3.5) → metal: bells, clangs, glass |
| `tone` | PSG (SN76489): one square / band-limited 25 % or 12.5 % pulse / triangle, swept or stepped | blips, arpeggios, the jump |
| `noise` | the shared noise buffer through ONE filter — never bare white noise | crunch (low-pass sweep), hiss (high band), screech (narrow band), rumble |

Helpers built from them: `click` (the transient), `thud` (sub sine drop +
low-passed noise: weight), `bell` (FM 1:3.5), `clang` (FM 1:1.41, deep index),
`boom`, `rev`, `scatter`.

Rules:

- **An impact is three things** — transient click, pitched body, tail. Nothing is a bare beep.
- **A run is one channel.** `seq` re-strikes a voice at stepped pitches, so an
  arpeggio costs one voice (4 nodes), not one per note — exactly how the chip did it.
- **Gold is a bell, danger is metal and sub, the hero is a pulse wave.** Pickups
  are FM 1:3.5 bells in major keys; hazards and bosses are inharmonic clangs over
  `thud`; BOLT's own moves (jump, roll, revs) are pulse and buzz.
- **Repeats vary.** Pitch jitter (±1.5 % jump and roll, ±4 % skid and stomps), round-robin
  (`ui-move` ×3, `tally` ×2), or musical state (ring ladder, rev ladder).
- **Nothing plays twice in one frame**, and per-frame callers are rate limited
  (`MIN_GAP`): N traps on one clock would otherwise stack into one N-times-louder hit.
  The long story voices have a gap too, so skipping through a cutscene cannot
  pile a laugh on a laugh.
- **Stereo.** `play(name, { pan })` places the whole sound (-1…1); a sound's own
  left/right play is offset by it and clamped. Voices of one call share a panner.
- **A voice is closed from the moment it is booked**, not from its strike: a gain
  node idles at 1, and a delayed pulse or noise voice leaks one full-scale sample
  if its source starts a sample ahead of its first envelope event (measured: a
  0.1-gain click peaking at -3 dBFS).

## Mix

Measured through the real `AudioMixer` at default volumes (music 0.7, effects
0.8). Reference: the music's loop body is ≈ -25 dBFS RMS, peaks -9…-10 dBFS,
loudest 50 ms ≈ -18…-19 dBFS (`story` is 5 dB quieter).

| Tier | Peak dBFS | Loudest 50 ms | What |
|---|---|---|---|
| **SLAM** | -4 … -1 | -11 … -8 | boss slams, eruptions, the defeat chain, wrecks, thunder. Leans on the master compressor: ducks the music 4–6 dB for ≈ 0.1 s |
| **ACTION** | -9 … -4 | -20 … -12 | what the hero does or earns. 5–15 dB over the band in its first 60 ms; ducks it < 1.5 dB |
| **WORLD** | -16 … -9 | -35 … -16 | hazards on their own clocks, foley, results ceremony. At the band's level, not over it |
| **UI** | < -16 | < -24 | menus. Per-frame tickers (`ui-move`, `tally`, `text-blip`) peak -18…-22 and last 30 ms |

Priority is the tier: there is no voice stealing; the limiter arbitrates, and
only SLAM is hot enough to move it. Held tones sit at the bottom of their peak
window (their loudness is in the "50 ms" column).

Chains: 14 rings at 20/s sum to -3.6 dBFS peak / -15.5 loud (one ring: -7.5 / -17);
10 revs at 11/s to -4.5 / -13.5.

### How to measure

`OfflineAudioContext(2, …, 44100)` → `new AudioMixer({ context, volumes })` →
`new Sfx(mixer)` → `play(name)` → render. **Fire at ≥ 0.25 s, not at 0**: the
first ≈ 60 ms of an offline render come out of the mixer faded in,
which shaves up to 12 dB off every onset. Noise-bearing sounds vary ±1 dB between
renders (random buffer offset). `tests/sfx.test.ts` covers bookkeeping only
(nodes freed, rate limits, pan, ladders); levels are not unit-testable.

## The palette

"Before" is the replaced sound measured the same way (peak dBFS). The old set had
no tiers: a spike trap (-4) was as loud as the jump (-3) and louder than the boss
alarm (-10); the rank stamp hit -3 in a menu; most noise was unfiltered white
(half its energy above 6 kHz).

"Now" lists layers as *voice: detail*. Level column: tier · peak / loudest 50 ms (dBFS) · length to -60 dB.

### Hero

| Sound | Fired by | Before — critique | Now | Level |
|---|---|---|---|---|
| `jump` | `Player` jump, rail/cart jump-off | -3: square chirp + triangle, linear sweep; hot and hollow | tone: pulse25 310→900 Hz in 0.13 s, held, linear decay · push-off: sine 170→80 + low-passed puff. ±1.5 % | ACTION · -7 / -15 · 0.21 s |
| `land` | every soft landing | silent (explicit no-op) | foley pat: low-passed noise 900→300 + sine 130→70. Max 1 per 0.12 s | WORLD · -15 / -28 · 0.05 s |
| `land-hard` | landing with impact > 7 | -5: `thud` only, 98 % of it below 500 Hz — gone on a phone speaker | click + `thud` 85 + slap: band 1700→600, linear (a third of the energy now above 500 Hz) | ACTION · -6 / -17 · 0.19 s |
| `roll` | down while running | silent | "zzip": FM 1:1 190→760 Hz, index 6→3 (buzz) + band 2.5→6 kHz | WORLD · -13 / -21 · 0.14 s |
| `unroll` | ball slows and uncurls | silent | pulse25 520→300 + soft puff | WORLD · -14 / -30 · 0.06 s |
| `skid` | `Player`: braking against a run of 4 px/frame or more, once per skid | — | two narrow clashing noise bands, 2.3 kHz Q 9 and 3.5 kHz Q 12, falling. Max 1 per 0.25 s | WORLD · -11 / -24 · 0.21 s |
| `slide-off` | too slow on a steep face | silent | band 1600→500 + sine 440→220. Max 1 per 0.3 s | WORLD · -14 / -28 · 0.12 s |
| `dash-charge` | spin dash starts | silent | rev #0 (resets the ladder) + scuff band 600→1800 | ACTION · -8 / -16 · 0.29 s |
| `dash-rev` | each rev press | -7.5: 80 ms square blip, +0.86 semitone/rev | FM saw carrier, 1:0.5, winds up 0.7f→1.5f in 90 ms; f = 185 Hz × semitone per rev (12 rungs, resets after 0.7 s) + band. Max 1 per 0.05 s | ACTION · -8.5 / -16 · 0.29 s |
| `dash` | spin dash release | -3: saw sweep UP + noise; reads as a rev, not a launch | click + noise burst 3200→500 (linear) + FM zap 1500→170, 1:0.5 + `thud` 70 | ACTION · -4.5 / -15.5 · 0.25 s |
| `hurt` | `Level.damagePlayer` | -3: saw 440→140 + thud; no rings in it | click + FM 1:1.41 660→150 (harsh) + `thud` 80 + `ring-loss` — skipped when `shield-lost`/`board-lost` fired within 50 ms | ACTION · -4 / -13 · 0.58 s |
| `ring-loss` | inside `hurt`; free-standing | — | two FM 1:3.5 channels, hard L/R, 4 detuned pings each (±3 %), 2.1→1.0 kHz falling | WORLD · -15.5 / -24.5 · 0.58 s |
| `die` | death | -7: one saw falling; quieter than a spring | click + `thud` + FM 587↗659↘110 Hz, index opening 1→2.5 + pulse25 an octave under | ACTION · -5 / -13.5 · 0.63 s |
| `respawn` | back at the checkpoint | silent | FM 1:2 run G4-D5-G5-D6 + noise swell | ACTION · -7.5 / -15 · 0.39 s |

### Pickups

| Sound | Fired by | Before — critique | Now | Level |
|---|---|---|---|---|
| `ring` | ring / scattered ring; SFX volume preview | -7: two sine+triangle pairs L then R + echo, 15 nodes; pure tones, no "ching" | **the signature.** FM bell 1:3.5, index 1.7 gone in ≈ 0.1 s: B5 (988) struck one side, E6 (1319) answers the other; sides swap per pickup. Ladder 0-2-4-7-9-12-14-16-19-21-24-26 semitones, reset after 0.55 s; index and level key-scaled down the higher the rung. Max 1 per 0.03 s. 10 nodes | ACTION · -7.5 / -17 · 0.32 s |
| `rings10` | ring monitor broken (after `monitor`) | shared `monitor` | the ring bell run B5-E6-G6-B6 left, answered a fourth up on the right | ACTION · -8.5 / -16 · 0.49 s |
| `shield` | shield monitor broken (after `monitor`) | shared `monitor` | FM 1:2 swell G3→G4, 0.18 s attack, index RISING 0.4→2.2 + sine shimmer + air + "bloop" as it seals | ACTION · -8 / -15 · 0.61 s |
| `shield-lost` | hit absorbed by shield | -7: one falling sine | pop (sine 500→1500, 45 ms) + band puff + FM 1:2 1000→280 | ACTION · -7 / -18.5 · 0.28 s |
| `shoes` | speed-shoes monitor broken (after `monitor`) | shared `monitor` | pulse25 arpeggio C5→C7 at 36 ms/step, pulse12 an octave up 18 ms behind on the other side, rising air | ACTION · -8 / -20 · 0.46 s |
| `monitor` | monitor broken | -4: two-note square jingle + thud, same for all kinds | the box only: click + sine 620→150 + glass band 2.6→1.2 kHz + `thud`. The contents have their own sound | ACTION · -5 / -18 · 0.16 s |
| `crystal` | crystal collected | -5: three sines + detuned triangle | E-major FM-bell arpeggio E6-G#6-B6-E7 (L), FM 1:2 a fifth above (R), low bell E4 for body, top note beating against a twin +12 cents, 9 kHz sparkle | ACTION · -6 / -16 · 0.73 s |
| `secret` | hidden room entered | -7: three triangle notes | Gmaj7 run G4-B4-D5-F#5-B5, FM 1:2, octave echo 35 ms behind on the right; never lands on the root | ACTION · -8 / -16 · 0.69 s |
| `checkpoint` | lamp activated | -7: two square notes | click + FM bell D6→A6 + the twirl: pulse12 run A6→A7, 30 ms a note + small `thud` | ACTION · -6 / -16 · 0.48 s |
| `goal` | goal sign | -7: four square notes over 0.5 s, fighting the clear jingle | pulse rip G4-C5-E5 into a C-major FM brass stab (1:1, index 2.6) with a bell C6 on top + `thud`. The music owns the jingle | ACTION · -4.5 / -12 · 0.57 s |

### Gadgets and rides

| Sound | Fired by | Before — critique | Now | Level |
|---|---|---|---|---|
| `spring` | spring | -6: square + triangle sweeping up; a chirp, not rubber | click + FM 1:1 "boing": 170→640 (overshoot)→400→540→450→490 Hz, index 6→1.5, linear decay + sine kick | ACTION · -6 / -13.5 · 0.35 s |
| `launch` | quarter-pipe / ramp launcher | silent | rising air 500→3600 + FM 1:2 slide 260→1040 + `thud` | ACTION · -7.5 / -15.5 · 0.35 s |
| `dash-pad` | dash pad | -4: white noise + saw; 58 % of energy above 6 kHz | click + FM 1:1 zap 380→1500 in 0.1 s, index 6 + band 1.8→5.2 kHz + `thud` | ACTION · -5 / -15 · 0.21 s |
| `loop-boost` | loop entry | -4: white noise + saw + triangle | air 500→4200 + FM 300→1200 + pulse12 run G5-C6-E6-G6 (the reward) | ACTION · -7 / -15 · 0.39 s |
| `rail-on` | rail caught | -4: white noise + two saws | click + FM 1:2.76 bite at 740 + grind: noise band 3.4 kHz Q 5 + low FM 1:3 | ACTION · -7 / -17 · 0.43 s |
| `rail-off` | rail ends | -14: falling saw | click + FM bell 880→1320 | WORLD · -14.5 / -26 · 0.11 s |
| `glider` | glider picked up | -7: two triangle notes | FM 1:2 run C5-G5-C6 + canvas unfurling (band 700→2600) | ACTION · -8 / -15.5 · 0.36 s |
| `glide` | wing deploys | -9: white noise + sine | band 400→1300 + triangle 300→440. Max 1 per 0.2 s | WORLD · -15 / -26.5 · 0.18 s |
| `glider-lost` | **never reaches the scene** (see wiring) | -13: falling triangle | rip: band 3000→700 Q 2 + triangle 620→260 | WORLD · -13.5 / -25.5 · 0.19 s |
| `board` | Mag-Board mounted | -7: two triangle notes | coils: FM 1:1 110→440 + FM 1:2 E5→B5 + `thud` | ACTION · -8 / -15 · 0.42 s |
| `board-end` | board ride ends | -7: as loud as a ring | FM 1:2 660→330 + small `thud` | WORLD · -15.5 / -26 · 0.15 s |
| `board-lost` | board destroyed by a hit | -3: white noise + triangle | click + crunch band 1800→400 + FM 1:2.76 520→140 + `thud` + two debris ticks L/R | ACTION · -5 / -17 · 0.23 s |
| `cart-board` | minecart boarded | -8: thud + saw | `thud` + FM 1:2.76 clank + wheels (FM 1:0.5 110→165, noise 400→900) fading in | ACTION · -6 / -17.5 · 0.47 s |
| `cart-wreck`, `cart-crash` | cart hits the buffer (ridden / unmanned) | -1: thud + white noise | click + `thud` 52 + low-pass sweep 3800→280 + `clang` 196 + three debris ticks | SLAM · -2 / -10 · 0.53 s |

### Enemies and hazards

| Sound | Fired by | Before — critique | Now | Level |
|---|---|---|---|---|
| `enemy` | crab / drone destroyed | -2: white noise + square; a hiss (48 % above 6 kHz) | click + "pok" sine 880→180 + square 560→240 + explosion: low-pass 3200→500, linear + `thud`. ±4 % | ACTION · -4.5 / -17 · 0.21 s |
| `hopper-stomp` | hopper destroyed | -2: same recipe as `enemy` | the pop + the spring it sat on: FM "boing" 300→620→380 | ACTION · -5 / -16.5 · 0.19 s |
| `crumble` | ledge gives way | -7.5: white noise + square | click + low-passed rubble in three lumps (`seq`) + FM 1:0.5 110→55 | WORLD · -10 / -21.5 · 0.28 s |
| `phase-blink` | phase platform toggles (in range) | -16.5: sine | FM 1:2 1245→830, 70 ms | WORLD · -15 / -26 · 0.07 s |
| `spike-warn` | spike trap about to strike | -16: square | click + pulse12 1245 Hz, 35 ms | WORLD · -14.5 / -35 · 0.04 s |
| `spike-trap` | spike trap strikes | -4: louder than the jump | "shing": FM 1:3.5 1700→2700 + high-passed burst + `thud` | WORLD · -10 / -25 · 0.12 s |
| `stalactite-warn` | stalactite armed | -18: two squares | two ticks + FM 1:2.4 glass 1480, 1568 | WORLD · -15 / -24.5 · 0.19 s |
| `stalactite-fall` | stalactite drops | -12: saw | whistle: sine 1500→520 + band Q 3 | WORLD · -11.5 / -21.5 · 0.27 s |
| `stalactite-shatter` | stalactite lands | -7: white noise, centroid 10 kHz | click + band 5.2→2.2 kHz + four FM 1:2.4 glass pings + `thud` | WORLD · -9.5 / -23.5 · 0.26 s |

### Boss

| Sound | Fired by | Before — critique | Now | Level |
|---|---|---|---|---|
| `warning` | boss spawn, with `boss` and `gate-slam` | — | klaxon: FM 1:1 (index 2.4, held) D#5 / A4 — a tritone — two cycles of 0.22 s per tone, pulse25 an octave under. Max 1 per 0.8 s | ACTION · -8 / -12.5 · 0.90 s |
| `boss` | boss spawns (same frame as `gate-slam`) | -10: two saw stabs, the quietest thing in the fight | no alarm in it: FM growl D2 + G#2 + D3 with the index OPENING 1→5, + `thud`. Sits under `warning` | ACTION · -9 / -14.5 · 0.76 s |
| `gate-slam` | arena locks | -2: thud + white noise | click + `thud` 56 + low-pass 2600→220 + two `clang`s (98 / 104 Hz) hard L and R + latch clunk at 0.57 s (the gates finish falling 34 frames later) | SLAM · -1.5 / -10 · 0.67 s |
| `gate-open` | boss defeated | -4: thud + triangle | motor FM 1:0.5 82→147 + noise 500→1200 + four chain ticks L/R + lock clunk at 0.76 s | WORLD · -10 / -16 · 0.86 s |
| `gate-bump` | hero pushed against a gate (every frame) | silent | `thud` 95 + FM 1:1.41 donk. Max 1 per 0.35 s | WORLD · -10 / -21.5 · 0.11 s |
| `boss-telegraph` | every boss, before its attack | -7: two identical squares | "bi-BIP": FM 1:1 G5 then C6 (up a fourth), index 2.2, held | ACTION · -9 / -12 · 0.24 s |
| `boss-hit` | hit landed, HP left | -2: white noise + saw + thud | click + `clang` 311 + FM 1:2.76 at 466 ringing off it + `thud` 92 + crunch band | ACTION · -4 / -14.5 · 0.35 s |
| `boss-slam` | press lands | -1.5: white noise + thud | click + `thud` 46 + low-pass 2800→200 + `clang` 131 + rubble in three lumps | SLAM · -1.5 / -9 · 0.58 s |
| `boss-dig` | drill rig burrows | -3: thud + white noise | `thud` 55 + low-passed rubble ×4 + drill: FM 1:3 82→49 | ACTION · -5 / -13 · 0.47 s |
| `boss-burst` | drill rig erupts | -1: thud + white noise + saw | click + `thud` 42 + low-pass 4500→240 + roar FM 1:0.5 98→392 + crystal raining (FM 1:2.4 pings) | SLAM · -1.5 / -9 · 0.64 s |
| `boss-shards` | each shard volley | -13.5: three triangles; "no weight" by design, and unheard | launch thump (sine 220→80) + "thwip" band + three FM 1:2.4 glass darts fanned L-C-R | ACTION · -5.5 / -18 · 0.25 s |
| `boss-trace` | Mirage starts its run | -6: white noise + saw | air 500→4500 + FM 1:1 220→880, index 6 | ACTION · -7 / -14 · 0.33 s |
| `boss-derez` | Mirage overheats | -11: two falling squares | square down a broken staircase (8 steps, 988→185) + stuttering high-passed hiss + FM 1:0.5 440→110 | ACTION · -5 / -17 · 0.45 s |
| `boss-rez` | Mirage recovers | -12.5: one rising square | square up six steps 185→1109 + rising air | ACTION · -8 / -14.5 · 0.32 s |
| `boss-defeated` | last hit | -1: ONE noise + thud + saw, 0.73 s | the chain: six `boom`s at 0, .17, .31, .50, .66, .84 s walking L/R, then the seventh and biggest at 1.05 s (7 dB hotter, 0.5 s tail), over FM 1:1.41 winding down 880→55. 51 nodes | SLAM · -2 / -10 · 1.61 s |

### Story

None of these is emitted yet. Levels suit the `story` track (-30 dBFS RMS).

| Sound | Now | Level |
|---|---|---|
| `yolk-laugh` | "HA-HA-HA-HA-HA-HAAA": one saw + pulse25 an octave under, gated into six syllables (five of 0.12 s, the last 0.56 s), through parallel band-passes at 700 Hz (Q 5), 1100 Hz (Q 7) and 2500 Hz, plus a 320 Hz chest band. Pitch falls 196→131 Hz across the phrase, each syllable scoops ×1.14→×0.9, a noise puff is the "H", 6.5 Hz vibrato on the last. 17 nodes. Max 1 per 1.2 s | ACTION · -5 / -14.5 · 1.39 s |
| `yolk-sting` | FM brass (1:1, index 4→1.5) on D2 + D3 + Eb3 + Ab3 — a minor second and a tritone — over a timpani (sine 110→73 Hz + mallet) | ACTION · -4 / -13 · 0.87 s |
| `thunder` | crack (high-passed burst + band 5000→600) then low-passed noise rolling in four darker swells (420→160 Hz) over a sine 62→34. Max 1 per 0.4 s | SLAM · -2 / -10.5 · 1.48 s |
| `core-crack` | click + high-passed crack + splinters 6.5→2.5 kHz + `thud`, then FM 1:2.4 glass notes tumbling C8→E6, traded L/R | ACTION · -6 / -18.5 · 0.81 s |
| `beam` | two FM 1:2 hums 3 % apart, 98→294 Hz: their beating quickens as they rise, + air Q 3 | ACTION · -6.5 / -13.5 · 1.01 s |
| `time-stop` | tape stop: saw fifth (392 + 588 Hz) and a noise band falling in a STRAIGHT line to nothing, low-pass closing with them, and seven clock ticks spreading apart (60 ms → 220 ms) | ACTION · -6 / -16.5 · 0.90 s |
| `whoosh` | noise band 500→3600→800 Hz swelling and fading, Doppler whine 1180→600, panned -0.85→+0.85 around `pan`. Max 1 per 0.2 s | ACTION · -6 / -17 · 0.51 s |

### Menus and results

| Sound | Fired by | Before — critique | Now | Level |
|---|---|---|---|---|
| `ui-move` | cursor step, cutscene line, results rows | -17: triangle + sine | one pulse25 tick, 1568 Hz, three pitches ±1.5 % in rotation. Max 1 per 0.03 s | UI · -18.5 / -36.5 · 0.03 s |
| `ui-confirm` | confirm; coach tip | -13.5: three squares | click + FM 1:2 G5→D6 | UI · -17.5 / -27.5 · 0.18 s |
| `ui-back` | back | -14: two triangles | pulse25 E5→B4 | UI · -17.5 / -28.5 · 0.13 s |
| `ui-error` | locked act | -19: two squares | FM 1:1 buzz, index 3, 196→185 Hz | UI · -21.5 / -24.5 · 0.22 s |
| `pause` / `unpause` | pause menu | -14.5: two sines | FM 1:2 A5→D5 / D5→A5 | UI · -17.5 / -26.5 · 0.20 s |
| `tally` | score count-up | -22.5: square | one pulse25 tick, 1760 / 1976 alternating. Max 1 per 0.045 s | UI · -21.5 / -39 · 0.03 s |
| `tally-end` | count-up ends | -7.5: four sines, as loud as a ring | ka-ching: click + pulse12 tick + bells E6 (L) and B6 (R) | WORLD · -13.5 / -21 · 0.40 s |
| `rank` | rank stamped | -3: the loudest thing in the menus | `thud` 105 + slap + C-major FM brass triad + bell C6 | WORLD · -9.5 / -19.5 · 0.40 s |
| `title-card` | results panel slides in | -10: two noise sweeps + sine | whoosh in from the left, away to the right, low swoop, bell glint as it lands | WORLD · -11 / -21 · 0.48 s |
| `text-blip` | cutscene typewriter | -21: triangle | pulse25 700–770 Hz, random. Max 1 per 0.035 s | UI · -22 / -39 · 0.03 s |
