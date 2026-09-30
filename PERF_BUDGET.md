# Performance budget

These are the targets for the home page when the first clays are broken, on a desktop window of 1920 by 1080.

- A long task (over 50 milliseconds) or a long animation frame during the first 10 seconds of smashing stops the release. That applies on a normal run and when the processor is slowed.
- On a normal run, no single task from a smash over 10 milliseconds.
- On a normal run, the animation loop's own code stays under 4 milliseconds a frame.
- When the processor is slowed to a quarter of its speed, 12 milliseconds of code per frame and 12 milliseconds per task are a soft target. The check prints those numbers and does not stop the release for them.
- 95 percent of frames finish within 16.7 milliseconds on a desktop.
- The animation loop does not read element positions.
- The full-page clay canvas stays at or under about 4.7 million pixels.
- The animation loop stops completely when nothing is moving.
- During the first 10 seconds of smashing, the full-page overlay is not redrawn. Only the game and the tray-sized heap are.

The headless check is `node tests/first-clays.mjs --label after --check`, against a production server.

The puzzle box page has its own limits.

- While "Unpacking the box" is on screen, getting ready may take up to about a second.
- From the moment the box can be touched, no task over 50 milliseconds and no frame over 50 milliseconds. That includes picking something up, opening the held view, the foot linkage, the key turn and the lid opening.
- The light count and the materials stay as they were when the box became ready to touch.

The headless check is `node tests/puzzle-box.mjs`, against a server built with the puzzle test hooks.
