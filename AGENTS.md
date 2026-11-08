# AGENTS.md

## Project summary and core loop
The alarm cutscene plays, you walk to the door and open it, then cross
the highways in first person while dodging cars, judging their
direction by stereo sound and side flashes. If a car hits you, you
retry from the curb. Reaching work the first time sets off the crash,
and the second, deaf run ends at work, late.

## How to play / controls
Guide Goosetavo Quillson Swanson the 2nd from his bed to work across
three two-lane highways. On the first trip, listen for engines and
horns and watch for light flashing at the edge of the screen. After
the crash he is deaf, so on the second trip you only have the flashes.
Controls: WASD or the arrow keys move forward, back, left and right
(always facing forward). E or Space opens the bedroom door. Click the
buttons on menu screens. Headphones are recommended.

## Important files
- `/index.html` — entry point: importmap, canvas/DOM shell, script bootstrap
- `/rosebud-game-defaults.css` — project file
- `/rosebud-game-defaults.js` — game module
- `/art_direction.md` — visual direction used for generated art
- `/sound_direction.md` — audio direction used for generated sound
- `/main.js` — game bootstrap and main loop

## Assets and audio
Audio: `assets/audio/alarm-clock.mp3`, `assets/audio/car-horn.mp3`,
`assets/audio/commute-music.mp3`
Sound direction: - Music: upbeat, slightly anxious morning commute
loop (hearing part only) - SFX: alarm clock ring, car horn; engine hum
+ explosion are procedural WebAudio
Playback note: reference media as `assets/...`; browsers start audio
only after the first user gesture.

## Notes for future edits
All graphics are drawn in code (drawDuck, drawCarSide,
drawBedroomSide, drawRoom, drawStreetScene, drawRoad in main.js), so
the PNGs you provide later can replace these functions. The road
layout is in the LANES array (z rows), and GOAL_Z is the finish line.
States: title, wake, room, road, crash, death, ending. Setting `deaf`
mutes all audio.

## Final validation status
Static: 0 blocking, 4 advisory; overall clean. Runtime behavior was
not checked during generation.
Finished via the `finish` tool.

