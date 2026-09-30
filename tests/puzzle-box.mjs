// Headless checks for the puzzle box, against a server on PORT (default 3460).
// The solve and cradle checks need NEXT_PUBLIC_PUZZLE_TEST=1 at build time.
// Pass --production to confirm a normal build draws and does not expose those hooks.

import { chromium } from "playwright";

const port = Number(process.env.PORT || 3460);
const production = process.argv.includes("--production");
const base = `http://localhost:${port}/builds/puzzle-box`;

const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (msg) => {
  if (msg.text().startsWith("puzzle-mark")) console.log(msg.text());
  if (msg.type() === "error") errors.push(msg.text());
});

await page.addInitScript(() => {
  const longTasks = [];
  const frames = [];
  let last = 0;
  const note = (entry) => {
    const scripts = entry.scripts
      ? [...entry.scripts].slice(0, 3).map((script) => ({
          name: script.name,
          fn: script.sourceFunctionName,
          invoker: script.invoker,
          d: Math.round(script.duration),
        }))
      : [];
    longTasks.push({
      t: entry.startTime,
      d: entry.duration,
      blocking: entry.blockingDuration,
      render: entry.renderStart,
      style: entry.styleAndLayoutStart,
      scripts,
    });
  };
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) note(entry);
    }).observe({ type: "long-animation-frame", buffered: true });
  } catch {
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) note(entry);
      }).observe({ type: "longtask", buffered: true });
    } catch {
      longTasks.push({ error: "longtask unsupported" });
    }
  }
  const orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) =>
    orig((t) => {
      const started = performance.now();
      const result = cb(t);
      frames.push({ t: started, d: performance.now() - started, gap: last ? t - last : 0 });
      last = t;
      return result;
    });
  window.__shaderCompiles = 0;
  const watch = (proto) => {
    if (!proto || proto.__puzzleWatch) return;
    const compile = proto.compileShader;
    proto.compileShader = function () {
      window.__shaderCompiles += 1;
      return compile.apply(this, arguments);
    };
    proto.__puzzleWatch = true;
  };
  watch(window.WebGLRenderingContext && window.WebGLRenderingContext.prototype);
  watch(window.WebGL2RenderingContext && window.WebGL2RenderingContext.prototype);
  window.__puzzlePerf = { longTasks, frames };
});

await page.goto(base, { waitUntil: "networkidle" });
await page.waitForSelector(".puzzle-stage canvas", { timeout: 30000 });

if (production) {
  const exposed = await page.evaluate(() => ({
    test: typeof window.__test,
    tags: typeof window.__tags,
    box: typeof window.__box,
  }));
  const drawn = await page.evaluate(() => {
    const canvas = document.querySelector(".puzzle-stage canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return { w: canvas.width, h: canvas.height, gl: Boolean(gl) };
  });
  await browser.close();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  if (exposed.test !== "undefined" || exposed.tags !== "undefined" || exposed.box !== "undefined") {
    console.error("production exposed test hooks", exposed);
    process.exit(1);
  }
  if (!drawn.gl || drawn.w < 2 || drawn.h < 2) {
    console.error("production canvas did not draw", drawn);
    process.exit(1);
  }
  console.log("production puzzle box drew", drawn.w, "x", drawn.h, "and hid the test hooks");
  process.exit(0);
}

await page.waitForFunction(() => window.__test && window.__tags && window.__puzzleReady, null, { timeout: 30000 });
const ready = await page.evaluate(() => window.__puzzleReady);

const drawn = await page.evaluate(() => {
  const canvas = document.querySelector(".puzzle-stage canvas");
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  return {
    w: canvas.width,
    h: canvas.height,
    gl: Boolean(gl),
    err: gl ? gl.getError() : -1,
  };
});
if (!drawn.gl || drawn.w < 2 || drawn.h < 2 || drawn.err !== 0) {
  throw new Error("canvas did not draw " + JSON.stringify(drawn));
}

const tags = await page.evaluate(() => window.__tags());
const needed = [
  "pinhole",
  "keyPickup",
  "toolPickup",
  "keyTurn",
  "cover",
  "foot",
  "panel",
  "strip",
  "drawer",
  "lid",
  "ball0",
  "ball1",
  "ball2",
  "ball3",
  "ball4",
];
for (const name of needed) {
  if (!tags[name]) throw new Error("missing part " + name + " " + JSON.stringify(tags));
}

const refused = await page.evaluate(() => {
  const ev = { clientX: 0, clientY: 0 };
  return {
    panel: window.__test.beginPart("panel", ev),
    drawer: window.__test.beginPart("drawer", ev),
  };
});
if (refused.panel || refused.drawer) {
  throw new Error("panel or drawer moved before they were freed " + JSON.stringify(refused));
}

async function state() {
  return page.evaluate(() => window.__box.state());
}

await page.evaluate(() => {
  const ev = { clientX: 200, clientY: 200 };
  const d = window.__test.beginPart("strip", ev);
  if (!d) throw new Error("strip would not move");
  window.__test.movePart(d, {
    clientX: ev.clientX + d.dir.x * 0.2,
    clientY: ev.clientY + d.dir.y * 0.2,
  });
  window.__test.endPart(d);
  window.__test.wake();
});
let now = await state();
if (now.strip < 0.07 || now.panel !== 0) {
  throw new Error("strip did not free the panel " + JSON.stringify(now));
}

await page.evaluate(() => {
  const ev = { clientX: 200, clientY: 200 };
  const d = window.__test.beginPart("panel", ev);
  if (!d) throw new Error("panel still locked");
  window.__test.movePart(d, {
    clientX: ev.clientX + d.dir.x * 0.3,
    clientY: ev.clientY + d.dir.y * 0.3,
  });
  window.__test.endPart(d);
  window.__test.wake();
});
now = await state();
if (now.panel < 0.18) throw new Error("panel did not open " + JSON.stringify(now));

const stillLocked = await page.evaluate(() => window.__test.beginPart("drawer", { clientX: 0, clientY: 0 }));
if (stillLocked) throw new Error("drawer opened before the pin");

await page.evaluate(() => {
  const tool = window.__test.beginPart("toolPickup", { clientX: 0, clientY: 0 });
  if (!tool) throw new Error("could not take the tool");
  window.__test.wake();
});
await page.waitForSelector(".puzzle-stage .hand.open", { timeout: 3000 });
await page.waitForTimeout(500);
await page.click(".puzzle-stage .closeInspect");
await page.evaluate(() => {
  const pin = window.__test.beginPart("pinhole", { clientX: 0, clientY: 0 });
  if (!pin) throw new Error("pin did not go in the hole");
  window.__test.wake();
});
await page.waitForFunction(() => window.__box.state().drawer > 0.04, null, { timeout: 3000 });

await page.evaluate(() => {
  const ev = { clientX: 200, clientY: 200 };
  const d = window.__test.beginPart("drawer", ev);
  if (!d) throw new Error("drawer still locked");
  window.__test.movePart(d, {
    clientX: ev.clientX + d.dir.x * 0.8,
    clientY: ev.clientY + d.dir.y * 0.8,
  });
  window.__test.endPart(d);
  const key = window.__test.beginPart("keyPickup", { clientX: 0, clientY: 0 });
  if (!key) throw new Error("could not take the key");
  window.__test.wake();
});
await page.waitForSelector(".puzzle-stage .hand.open", { timeout: 3000 });
await page.waitForTimeout(500);
await page.click(".puzzle-stage .closeInspect");
await page.evaluate(() => {
  const foot = window.__test.beginPart("foot", { clientX: 0, clientY: 0 });
  window.__test.movePart(foot, { clientX: Math.PI / 2 / 0.014, clientY: 0 });
  window.__test.endPart(foot);
  window.__test.wake();
});
await page.waitForFunction(() => window.__box.state().cover > 1.2, null, { timeout: 4000 });

await page.evaluate(() => {
  const hole = window.__test.beginPart("keyhole", { clientX: 0, clientY: 0 });
  if (!hole) throw new Error("key did not go in");
  const turn = window.__test.beginPart("keyTurn", { clientX: 0, clientY: 0 });
  const ang = turn.a0 - 1.6;
  window.__test.movePart(turn, {
    clientX: turn.c.x + Math.cos(ang) * 90,
    clientY: turn.c.y + Math.sin(ang) * 90,
  });
  window.__test.endPart(turn);
  window.__test.wake();
});
await page.waitForFunction(() => window.__box.state().unlocked, null, { timeout: 4000 });
const solved = await state();
if (!solved.unlocked || !solved.keyTurned || solved.cover < 1.2) {
  throw new Error("lid stayed locked " + JSON.stringify(solved));
}

function resetBalls() {
  return page.evaluate(() => {
    for (const ball of window.__test.balls) {
      ball.th = 0;
      ball.w = 0;
      ball.held = false;
    }
  });
}

const one = await page.evaluate(() => {
  const balls = window.__test.balls;
  for (const ball of balls) {
    ball.th = 0;
    ball.w = 0;
    ball.held = false;
  }
  balls[0].th = -0.6;
  let far = 0;
  let mid = 0;
  for (let i = 0; i < 360; i += 1) {
    window.__test.stepCradle(1 / 60);
    far = Math.max(far, balls[4].th);
    mid = Math.max(mid, Math.abs(balls[2].th));
  }
  return { far, mid };
});
console.log("one ball far", one.far.toFixed(3), "middle", one.mid.toFixed(3));
if (one.far < 0.5 || one.far > 0.64) throw new Error("far ball was " + one.far);
if (one.mid > 0.08) throw new Error("middle ball moved " + one.mid);

const two = await page.evaluate(() => {
  const balls = window.__test.balls;
  for (const ball of balls) {
    ball.th = 0;
    ball.w = 0;
    ball.held = false;
  }
  balls[0].th = -0.6;
  balls[1].th = -0.6;
  let a = 0;
  let b = 0;
  let mid = 0;
  for (let i = 0; i < 360; i += 1) {
    window.__test.stepCradle(1 / 60);
    a = Math.max(a, balls[3].th);
    b = Math.max(b, balls[4].th);
    mid = Math.max(mid, Math.abs(balls[2].th));
  }
  return { a, b, mid };
});
console.log("two balls", two.a.toFixed(3), two.b.toFixed(3), "middle", two.mid.toFixed(3));
if (two.a < 0.45 || two.b < 0.45) throw new Error("two balls did not go out " + JSON.stringify(two));
if (two.mid > 0.12) throw new Error("middle ball joined in " + two.mid);

const hard = await page.evaluate(() => {
  const balls = window.__test.balls;
  for (const ball of balls) {
    ball.th = 0;
    ball.w = 0;
    ball.held = false;
  }
  balls[0].th = -0.4;
  balls[0].w = -28;
  let worst = 0;
  let bad = false;
  for (let i = 0; i < 240; i += 1) {
    window.__test.stepCradle(1 / 60);
    for (const ball of balls) {
      if (!Number.isFinite(ball.th) || !Number.isFinite(ball.w)) bad = true;
      worst = Math.max(worst, Math.abs(ball.th));
    }
  }
  return { worst, bad };
});
console.log("hard throw peak", hard.worst.toFixed(3));
if (hard.bad || hard.worst > 2.71) throw new Error("hard throw was not stable " + JSON.stringify(hard));
await resetBalls();

const framesBeforeDrag = await page.evaluate(() => window.__puzzlePerf.frames.length);
const stage = page.locator(".puzzle-stage");
const box = await stage.boundingBox();
await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
await page.mouse.down();
for (let i = 0; i < 12; i += 1) {
  await page.mouse.move(box.x + box.width * 0.5 + i * 8, box.y + box.height * 0.45 + i * 3);
  await page.waitForTimeout(16);
}
await page.mouse.up();
const dragFrames = await page.evaluate((start) => window.__puzzlePerf.frames.slice(start).map((frame) => frame.gap).filter((dt) => dt > 0), framesBeforeDrag);

await page.evaluate(() => {
  const lid = window.__test.beginPart("lid", { clientX: 0, clientY: 300 });
  window.__test.movePart(lid, { clientX: 0, clientY: 300 - 400 });
  window.__test.endPart(lid);
  window.__test.balls[0].th = -0.5;
  window.__test.balls[0].w = 0;
  window.__test.wake();
});
const swingStart = await page.evaluate(() => window.__puzzlePerf.frames.length);
await page.waitForTimeout(700);
const swingFrames = await page.evaluate((start) => window.__puzzlePerf.frames.slice(start).map((frame) => frame.gap).filter((dt) => dt > 0), swingStart);

await page.evaluate(() => {
  for (const ball of window.__test.balls) {
    ball.th = 0;
    ball.w = 0;
    ball.held = false;
  }
  window.__test.lidState.vel = 0;
  window.__test.lidState.target = window.__test.lidState.angle;
  window.__test.wake();
});
await page.waitForTimeout(1200);
const beforeSleep = await page.evaluate(() => window.__puzzlePerf.frames.length);
await page.waitForTimeout(600);
const afterSleep = await page.evaluate(() => window.__puzzlePerf.frames.length);

const perf = await page.evaluate((mark) => {
  const tasks = window.__puzzlePerf.longTasks.filter((task) => !task.error);
  const setup = tasks.filter((task) => task.t < mark.t);
  const later = tasks.filter((task) => task.t >= mark.t);
  const work = window.__puzzlePerf.frames.filter((frame) => frame.t >= mark.t);
  return {
    setupMs: Math.round(mark.setupMs),
    setup: setup.slice(0, 6).map((task) => ({ d: Math.round(task.d), scripts: task.scripts })),
    later: later.slice(0, 6).map((task) => ({
      at: Math.round(task.t - mark.t),
      d: Math.round(task.d),
      blocking: Math.round(task.blocking || 0),
      render: task.render ? Math.round(task.render - task.t) : 0,
      style: task.style ? Math.round(task.style - task.t) : 0,
      scripts: task.scripts,
    })),
    worstWork: Math.round(work.reduce((worst, frame) => Math.max(worst, frame.d), 0)),
    shaders: window.__shaderCompiles - mark.shaders,
    lights: window.__test.lights(),
    lightStart: mark.lights,
    programs: window.__test.programs(),
    programStart: mark.programs,
  };
}, ready);

function p95(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

console.log("canvas", drawn.w, "x", drawn.h, "gl error", drawn.err);
console.log("setup", perf.setupMs, "ms, long tasks", JSON.stringify(perf.setup));
console.log("after touch, long tasks", JSON.stringify(perf.later), "worst frame", perf.worstWork, "ms");
console.log("shader compiles after touch", perf.shaders, "lights", perf.lightStart, "->", perf.lights, "programs", perf.programStart, "->", perf.programs);
console.log(
  "drag frames",
  dragFrames.length,
  "p95",
  p95(dragFrames).toFixed(1),
  "max",
  Math.max(0, ...dragFrames).toFixed(1),
);
console.log(
  "cradle frames",
  swingFrames.length,
  "p95",
  p95(swingFrames).toFixed(1),
  "max",
  Math.max(0, ...swingFrames).toFixed(1),
);
console.log("frames while idle", afterSleep - beforeSleep);

await browser.close();

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
if (perf.setupMs > 1500) {
  console.error("setup took longer than about a second");
  process.exit(1);
}
if (perf.later.length || perf.worstWork > 50) {
  console.error("a task or frame after the box could be touched took more than 50ms");
  process.exit(1);
}
if (perf.shaders !== 0 || perf.lights !== perf.lightStart || perf.programs !== perf.programStart) {
  console.error("the light count or the materials changed while playing");
  process.exit(1);
}
if (afterSleep - beforeSleep > 2) {
  console.error("the loop did not sleep");
  process.exit(1);
}
console.log("puzzle box checks passed");
