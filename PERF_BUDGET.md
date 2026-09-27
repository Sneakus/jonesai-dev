# Performance budget

These are the targets for the home page when the first clays are broken, on a desktop window of 1920 by 1080.

- No long task and no long animation frame during the first 10 seconds of smashing.
- No single task from a smash over 10 milliseconds.
- The animation loop's own code stays under 4 milliseconds a frame on a desktop, and under 8 milliseconds when the processor is slowed to a quarter of its speed.
- 95 percent of frames finish within 16.7 milliseconds on a desktop.
- The animation loop does not read element positions.
- The full-page clay canvas stays at or under about 4.7 million pixels.
- The animation loop stops completely when nothing is moving.

The headless check is `node tests/first-clays.mjs --label after --check`, against a production server.
