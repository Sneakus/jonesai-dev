// Headless desktop measurement of the first five clay smashes.
// Run against a production server: node tests/first-clays.mjs --label before

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const label = process.argv.includes("--label")
  ? process.argv[process.argv.indexOf("--label") + 1]
  : "run";
const check = process.argv.includes("--check");
const quick = process.argv.includes("--quick");
const port = Number(process.env.PORT || 3456);
const base = `http://127.0.0.1:${port}/`;

const init = () => {
  const frames = [];
  const longTasks = [];
  const loafs = [];
  let framing = false;
  let last = 0;
  let frameReads = 0;
  const noteRead = () => {
    window.__anyReads = (window.__anyReads || 0) + 1;
    if (framing) {
      frameReads += 1;
    }
  };
  const origRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function patchedRect() {
    noteRead();
    return origRect.call(this);
  };
  const watchGetter = (proto, prop) => {
    const desc = Object.getOwnPropertyDescriptor(proto, prop);
    if (!desc?.get) {
      return;
    }
    Object.defineProperty(proto, prop, {
      configurable: true,
      enumerable: desc.enumerable,
      get() {
        noteRead();
        return desc.get.call(this);
      },
    });
  };
  watchGetter(HTMLElement.prototype, "offsetWidth");
  watchGetter(HTMLElement.prototype, "offsetHeight");
  watchGetter(Element.prototype, "clientWidth");
  watchGetter(Element.prototype, "clientHeight");
  const origRAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) =>
    origRAF((t) => {
      const outer = !framing;
      framing = true;
      try {
        return cb(t);
      } finally {
        if (outer) {
          frames.push({
            t,
            dt: last ? t - last : 0,
            layoutReads: frameReads,
          });
          frameReads = 0;
          last = t;
          framing = false;
        }
      }
    });
  const dump = (entry) => {
    const json = entry.toJSON();
    if (entry.scripts) {
      json.scripts = entry.scripts.map((script) => ({
        name: script.name,
        sourceURL: script.sourceURL,
        sourceFunctionName: script.sourceFunctionName,
        invoker: script.invoker,
        invokerType: script.invokerType,
        duration: script.duration,
      }));
    }
    if (entry.attribution) {
      json.attribution = entry.attribution.map((item) => ({
        name: item.name,
        containerType: item.containerType,
        containerName: item.containerName,
        containerSrc: item.containerSrc,
      }));
    }
    return json;
  };
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTasks.push(dump(entry));
      }
    }).observe({ type: "longtask", buffered: true });
  } catch {
    longTasks.push({ error: "longtask unsupported" });
  }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        loafs.push(dump(entry));
      }
    }).observe({ type: "long-animation-frame", buffered: true });
  } catch {
    loafs.push({ error: "long-animation-frame unsupported" });
  }
  const origClear = CanvasRenderingContext2D.prototype.clearRect;
  CanvasRenderingContext2D.prototype.clearRect = function patchedClear(x, y, w, h) {
    if (framing) {
      const canvas = this.canvas;
      const name = String(canvas.getAttribute("data-canvas") || canvas.className || "canvas");
      const pixels = canvas.width * canvas.height;
      const redrawn = window.__redrawn || (window.__redrawn = {});
      const rec = redrawn[name] || { pixels: 0, clears: 0 };
      rec.pixels = Math.max(rec.pixels, pixels);
      rec.clears += 1;
      redrawn[name] = rec;
    }
    return origClear.call(this, x, y, w, h);
  };
  window.__frames = frames;
  window.__longTasks = longTasks;
  window.__loafs = loafs;
  window.__layoutReads = 0;
  window.__redrawn = {};
};

function percentile(values, p) {
  if (!values.length) {
    return 0;
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

async function saveTrace(session, file) {
  const done = new Promise((resolve) => {
    session.once("Tracing.tracingComplete", resolve);
  });
  await session.send("Tracing.end");
  const complete = await done;
  if (!complete.stream) {
    return;
  }
  let text = "";
  for (;;) {
    const chunk = await session.send("IO.read", { handle: complete.stream });
    text += chunk.base64Encoded
      ? Buffer.from(chunk.data, "base64").toString("utf8")
      : chunk.data;
    if (chunk.eof) {
      break;
    }
  }
  await session.send("IO.close", { handle: complete.stream });
  fs.writeFileSync(file, text);
}

async function smashFive(page) {
  await page.waitForFunction(() => window.__jonesTest, null, { timeout: 20000 });
  const start = await page.evaluate(() => {
    window.__anyReads = 0;
    window.__redrawn = {};
    performance.mark("jones-smash-start");
    return performance.now();
  });
  let smashed = 0;
  const deadline = Date.now() + 90000;
  while (smashed < 5 && Date.now() < deadline) {
    const hit = await page.evaluate(() => window.__jonesTest.smash());
    if (hit) {
      smashed += 1;
    }
    await page.waitForTimeout(80);
  }
  const elapsed = await page.evaluate((t0) => performance.now() - t0, start);
  const remain = Math.max(0, 10000 - elapsed);
  if (remain > 0) {
    await page.waitForTimeout(remain);
  }
  await page.evaluate(() => performance.mark("jones-smash-end"));
  return { smashed, start };
}

async function readStats(page, smashStart) {
  return page.evaluate((t0) => {
    const frames = (window.__frames || []).filter((frame) => frame.t >= t0 && frame.dt > 0);
    const tasks = (window.__longTasks || []).filter(
      (task) => !task.error && task.startTime >= t0,
    );
    const loafs = (window.__loafs || []).filter(
      (frame) => !frame.error && frame.startTime >= t0,
    );
    const fx = document.querySelector(".portrait-fx");
    const perf = window.__jonesPerf || null;
    return {
      frames: frames.map((frame) => frame.dt),
      layoutReadsInFrames: frames.reduce((sum, frame) => sum + frame.layoutReads, 0),
      anyReads: window.__anyReads || 0,
      longTasks: tasks.map((task) => ({
        name: task.name,
        duration: task.duration,
        startTime: task.startTime,
        at: task.startTime - t0,
        attribution: task.attribution,
        scripts: task.scripts,
      })),
      loafs: loafs.map((frame) => ({
        name: frame.name,
        duration: frame.duration,
        startTime: frame.startTime,
        at: frame.startTime - t0,
        scripts: frame.scripts,
      })),
      canvasPixels: fx ? fx.width * fx.height : 0,
      canvasSize: fx ? { width: fx.width, height: fx.height } : null,
      loopSamples: (perf?.samples || [])
        .filter((sample) => (sample.t || 0) >= t0)
        .map((sample) => ({ at: (sample.t || 0) - t0, ms: sample.ms || 0 })),
      asleep: Boolean(perf?.asleep),
      shared: Boolean(perf?.shared),
      redrawn: window.__redrawn || {},
      canvases: Array.from(document.querySelectorAll("canvas")).map((canvas) => ({
        name: String(canvas.getAttribute("data-canvas") || canvas.className || "canvas"),
        pixels: canvas.width * canvas.height,
      })),
      observerErrors: [
        ...(window.__longTasks || []).filter((task) => task.error),
        ...(window.__loafs || []).filter((frame) => frame.error),
      ],
    };
  }, smashStart);
}

async function runPass(browser, { throttle, hard = false }) {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  await page.addInitScript(init);
  if (hard) {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("clay-hard-unlocked", "1");
        window.localStorage.setItem("clay-mode", "hard");
      } catch {
        // Ignore.
      }
    });
  }
  page.on("pageerror", (error) => {
    console.error("pageerror", error.message);
  });
  await page.goto(base, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByRole("button", { name: "Pull", exact: true }).click({ timeout: 20000 });
  if (hard) {
    await page.waitForFunction(() => window.__jonesHard, null, { timeout: 20000 });
    await page.evaluate(() => window.__jonesHard.setHard(true));
  }
  if (!quick) {
    await session.send("Tracing.start", {
      transferMode: "ReturnAsStream",
      traceConfig: {
        recordMode: "recordAsMuchAsPossible",
        includedCategories: [
          "devtools.timeline",
          "disabled-by-default-devtools.timeline",
          "v8.execute",
          "blink.user_timing",
          "loading",
        ],
      },
    });
  }
  const smashed = await smashFive(page);
  const stats = await readStats(page, smashed.start);
  if (check) {
    try {
      await page.waitForFunction(() => window.__jonesPerf?.asleep === true, null, {
        // A perfect round celebration needs more wall time when the CPU is slowed.
        timeout: Math.max(20000, 15000 * throttle),
      });
      stats.asleep = true;
    } catch {
      stats.asleep = await page.evaluate(() => Boolean(window.__jonesPerf?.asleep));
    }
  }
  if (!quick) {
    fs.mkdirSync("perf", { recursive: true });
    const traceName = throttle === 1 ? `${label}-desktop.trace.json` : `${label}-4x.trace.json`;
    await saveTrace(session, path.join("perf", traceName));
  }
  await context.close();
  const loop = stats.loopSamples.length ? stats.loopSamples : [];
  const loopMs = loop.map((sample) => sample.ms);
  const loopLimit = throttle === 1 ? 4 : 12;
  const over = loop.filter((sample) => sample.ms > loopLimit);
  const early = loop.filter((sample) => sample.at < 3000);
  const earlyOver = over.filter((sample) => sample.at < 3000);
  return {
    throttle,
    smashed: smashed.smashed,
    frameCount: stats.frames.length,
    frameP95: percentile(stats.frames, 95),
    frameMax: Math.max(0, ...stats.frames),
    longTasks: stats.longTasks,
    loafs: stats.loafs,
    layoutReadsInFrames: stats.layoutReadsInFrames,
    anyReads: stats.anyReads,
    canvasPixels: stats.canvasPixels,
    canvasSize: stats.canvasSize,
    loopP95: percentile(loopMs, 95),
    loopMax: Math.max(0, ...loopMs),
    loopOutliers: over.length,
    loopOutlier: Math.max(0, ...over.map((sample) => sample.ms)),
    earlyWorst: Math.max(0, ...early.map((sample) => sample.ms)),
    earlyOver: earlyOver.map((sample) => ({
      at: Math.round(sample.at),
      ms: Math.round(sample.ms * 10) / 10,
    })),
    earlyTasks: stats.longTasks
      .filter((task) => task.at < 3000)
      .map((task) => ({ at: Math.round(task.at), ms: Math.round(task.duration) })),
    earlyLoafs: stats.loafs
      .filter((frame) => frame.at < 3000)
      .map((frame) => ({ at: Math.round(frame.at), ms: Math.round(frame.duration) })),
    asleep: stats.asleep,
    shared: stats.shared,
    redrawn: stats.redrawn,
    canvases: stats.canvases,
    observerErrors: stats.observerErrors,
  };
}

function summariseTask(task) {
  const bits = [];
  if (task.name) {
    bits.push(task.name);
  }
  if (task.attribution?.length) {
    bits.push(
      task.attribution
        .map((item) => item.name || item.containerName || item.containerSrc || "page")
        .join(", "),
    );
  }
  if (task.scripts?.length) {
    bits.push(
      task.scripts
        .map(
          (script) =>
            `${script.sourceFunctionName || script.invoker || script.name || "script"} ${Math.round(script.duration)}ms`,
        )
        .join("; "),
    );
  }
  return {
    duration: Math.round(task.duration),
    start: Math.round(task.startTime),
    what: bits.filter(Boolean).join(" | ") || "unattributed",
  };
}

const browser = await chromium.launch({ headless: true });
const passes = quick
  ? [await runPass(browser, { throttle: 1 })]
  : [await runPass(browser, { throttle: 4 }), await runPass(browser, { throttle: 1 })];
const hardPass =
  check && !quick ? await runPass(browser, { throttle: 1, hard: true }) : null;
await browser.close();
const throttled = quick ? null : passes[0];
const desktop = quick ? passes[0] : passes[1];

const report = {
  label,
  throttled: throttled
    ? {
        ...throttled,
        longTasks: throttled.longTasks.map(summariseTask),
        loafs: throttled.loafs.map(summariseTask),
      }
    : null,
  desktop: {
    ...desktop,
    longTasks: desktop.longTasks.map(summariseTask),
    loafs: desktop.loafs.map(summariseTask),
  },
  hard: hardPass
    ? {
        ...hardPass,
        longTasks: hardPass.longTasks.map(summariseTask),
        loafs: hardPass.loafs.map(summariseTask),
      }
    : null,
};
fs.mkdirSync("perf", { recursive: true });
fs.writeFileSync(path.join("perf", `${label}.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

function slowTraceTasks(file, limitMs) {
  if (!fs.existsSync(file)) {
    return [`missing trace ${file}`];
  }
  const events = JSON.parse(fs.readFileSync(file, "utf8")).traceEvents || [];
  let start = 0;
  let end = 0;
  for (const event of events) {
    const name = event.name === "UserTiming" ? event.args?.data?.name : event.name;
    if (name === "jones-smash-start" && !start) {
      start = event.ts;
    }
    if (name === "jones-smash-end") {
      end = event.ts;
    }
  }
  if (!start || !end) {
    return [`could not find the smash window in ${file}`];
  }
  return events
    .filter(
      (event) =>
        (event.name === "FunctionCall" || event.name === "EvaluateScript") &&
        event.ph === "X" &&
        event.ts >= start &&
        event.ts <= end &&
        event.dur > limitMs * 1000,
    )
    .map((event) => `${path.basename(file)} ${event.name} ${Math.round(event.dur / 1000)}ms`);
}

function worstTraceCall(file) {
  if (!fs.existsSync(file)) {
    return null;
  }
  const events = JSON.parse(fs.readFileSync(file, "utf8")).traceEvents || [];
  let start = 0;
  let end = 0;
  for (const event of events) {
    const name = event.name === "UserTiming" ? event.args?.data?.name : event.name;
    if (name === "jones-smash-start" && !start) {
      start = event.ts;
    }
    if (name === "jones-smash-end") {
      end = event.ts;
    }
  }
  if (!start || !end) {
    return null;
  }
  let worst = 0;
  for (const event of events) {
    if (
      (event.name === "FunctionCall" || event.name === "EvaluateScript") &&
      event.ph === "X" &&
      event.ts >= start &&
      event.ts <= end
    ) {
      worst = Math.max(worst, event.dur || 0);
    }
  }
  return Math.round(worst / 1000);
}

if (check && throttled) {
  const problems = [];
  if (throttled.smashed !== 5 || desktop.smashed !== 5) {
    problems.push(`smashed ${throttled.smashed}/${desktop.smashed}, expected 5`);
  }
  if (throttled.longTasks.length || desktop.longTasks.length) {
    problems.push(
      `long tasks: 4x ${throttled.longTasks.length}, desktop ${desktop.longTasks.length}`,
    );
  }
  if (throttled.loafs.length || desktop.loafs.length) {
    problems.push(`long animation frames: 4x ${throttled.loafs.length}, desktop ${desktop.loafs.length}`);
  }
  const slow = slowTraceTasks(path.join("perf", `${label}-desktop.trace.json`), 10);
  if (slow.length) {
    problems.push(slow.slice(0, 8).join("; "));
  }
  if (!desktop.loopMax) {
    problems.push("the animation loop did not report its frame times");
  }
  if (desktop.loopP95 > 4 || desktop.loopMax > 4) {
    problems.push(`desktop loop p95 ${desktop.loopP95.toFixed(2)} max ${desktop.loopMax.toFixed(2)}`);
  }
  const slowedTasks = slowTraceTasks(path.join("perf", `${label}-4x.trace.json`), 12);
  const slowedWorst = worstTraceCall(path.join("perf", `${label}-4x.trace.json`));
  const slowedNote = [
    "slowed run, soft target 12ms, does not stop the release",
    throttled.loopMax
      ? `code per frame p95 ${throttled.loopP95.toFixed(2)} max ${throttled.loopMax.toFixed(2)}`
      : "code per frame was not reported",
    slowedWorst == null ? "worst task was not reported" : `worst task ${slowedWorst}ms`,
    slowedTasks.length ? `over 12ms: ${slowedTasks.slice(0, 8).join("; ")}` : "none over 12ms",
  ].join(": ");
  console.warn(slowedNote);
  if (desktop.frameP95 > 17) {
    problems.push(`desktop frame p95 ${desktop.frameP95.toFixed(2)}`);
  }
  if (desktop.layoutReadsInFrames > 0 || throttled.layoutReadsInFrames > 0) {
    problems.push(
      `layout reads inside frames: desktop ${desktop.layoutReadsInFrames}, 4x ${throttled.layoutReadsInFrames}`,
    );
  }
  if (desktop.canvasPixels > 4_700_000 || throttled.canvasPixels > 4_700_000) {
    problems.push(
      `overlay pixels desktop ${desktop.canvasPixels} 4x ${throttled.canvasPixels}`,
    );
  }
  if (!desktop.asleep || !throttled.asleep) {
    problems.push("animation loop was still running when nothing was moving");
  }
  for (const pass of [throttled, desktop]) {
    const name = pass.throttle === 1 ? "desktop" : "4x";
    const allowed = Math.max(
      0,
      ...pass.canvases
        .filter((canvas) => canvas.name.includes("clay-canvas") || canvas.name.includes("heap-canvas"))
        .map((canvas) => canvas.pixels),
    );
    for (const [canvasName, rec] of Object.entries(pass.redrawn || {})) {
      if (canvasName.includes("portrait-fx") && rec.clears > 0) {
        problems.push(
          `${name} redrew the full-page overlay ${rec.clears} times (${rec.pixels} pixels)`,
        );
      } else if (allowed > 0 && rec.pixels > allowed * 1.02 && rec.clears > 0) {
        problems.push(
          `${name} redrew ${canvasName} at ${rec.pixels} pixels, bigger than the game and the tray (${allowed})`,
        );
      }
    }
  }
  if (hardPass) {
    if (hardPass.smashed !== 5) {
      problems.push(`hard smashed ${hardPass.smashed}, expected 5`);
    }
    if (hardPass.longTasks.length) {
      problems.push(`hard long tasks: ${hardPass.longTasks.length}`);
    }
    if (hardPass.loafs.length) {
      problems.push(`hard long animation frames: ${hardPass.loafs.length}`);
    }
  }
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
}
