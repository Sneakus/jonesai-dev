// Headless checks for the knowledge base assistant page.
// Run against a production server: node tests/knowledge-base.mjs

import { chromium } from "playwright";

const port = Number(process.env.PORT || 3460);
const base = `http://localhost:${port}`;

const pages = [
  "/",
  "/builds/knowledge-base-assistant",
  "/builds/puzzle-box",
  "/worldcupmap",
  "/golf-agent",
  "/ajob",
  "/meeting-plan-agent",
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));

for (const path of pages) {
  const response = await page.goto(`${base}${path}`, { waitUntil: "load", timeout: 60000 });
  if (!response || response.status() !== 200) {
    console.error(`${path} did not render (${response ? response.status() : "no response"})`);
    process.exitCode = 1;
  }
}

await page.goto(`${base}/`, { waitUntil: "load", timeout: 60000 });
const titles = await page.locator("section.mt-16 a span.text-lg").allTextContents();
const expected = [
  "Knowledge base assistant",
  "The puzzle box",
  "worldcupmap",
  "Golf Agent",
  "AJob",
  "Meeting plan agent",
];
if (titles.join(" | ") !== expected.join(" | ")) {
  console.error(`builds order: ${titles.join(" | ")}`);
  process.exitCode = 1;
}
const lines = await page.locator("section.mt-16 a span.mt-1").allTextContents();
const cardLine =
  "Finds every contradiction an update causes across our documents, and suggests the fixes.";
if (lines[0] !== cardLine) {
  console.error(`card line: ${lines[0]}`);
  process.exitCode = 1;
}

await page.setViewportSize({ width: 375, height: 700 });
await page.goto(`${base}/builds/knowledge-base-assistant`, {
  waitUntil: "load",
  timeout: 60000,
});
const narrow = await page.evaluate(() => {
  const stage = document.querySelector(".kb-stage");
  const html = document.documentElement.innerHTML;
  return {
    overflow: stage ? stage.scrollWidth - stage.clientWidth : -1,
    page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    company: /knowledge base assistant/i.test(html) && !/—|–/.test(html),
    dashes: /—|–/.test(html),
  };
});
if (narrow.overflow > 1 || narrow.page > 1) {
  console.error(`narrow layout overflow stage ${narrow.overflow} page ${narrow.page}`);
  process.exitCode = 1;
}
if (narrow.dashes) {
  console.error("knowledge base page contains a dash that is not a hyphen");
  process.exitCode = 1;
}

const reduced = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  reducedMotion: "reduce",
});
await reduced.goto(`${base}/builds/knowledge-base-assistant`, {
  waitUntil: "load",
  timeout: 60000,
});
const still = await reduced.locator(".kb-stage").getAttribute("data-kb-state");
if (still !== "done") {
  console.error(`reduced motion state ${still}`);
  process.exitCode = 1;
}
await reduced.close();

await page.setViewportSize({ width: 1280, height: 800 });
await page.addInitScript(() => {
  const longTasks = [];
  const loafs = [];
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTasks.push({ t: entry.startTime, d: entry.duration });
      }
    }).observe({ type: "longtask", buffered: true });
  } catch {
    longTasks.push(-1);
  }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        loafs.push({ t: entry.startTime, d: entry.duration });
      }
    }).observe({ type: "long-animation-frame", buffered: true });
  } catch {
    loafs.push(-1);
  }
  window.__kbWatch = { longTasks, loafs };
});
await page.goto(`${base}/builds/knowledge-base-assistant`, {
  waitUntil: "load",
  timeout: 60000,
});
const stage = page.locator(".kb-stage");
await stage.scrollIntoViewIfNeeded();
const started = await page.evaluate(() => performance.now());
await page.waitForFunction(() => document.querySelector(".kb-stage")?.dataset.kbState === "play", null, {
  timeout: 8000,
});
await page.waitForFunction(() => document.querySelector(".kb-stage")?.dataset.kbState === "done", null, {
  timeout: 15000,
});
await page.waitForTimeout(800);
const after = await page.evaluate((mark) => {
  const node = document.querySelector(".kb-stage");
  const watch = window.__kbWatch;
  return {
    state: node ? node.dataset.kbState : "",
    playing: node ? node.classList.contains("is-play") : true,
    longTasks: (watch?.longTasks || []).filter((task) => task.t >= mark).map((task) => Math.round(task.d)),
    loafs: (watch?.loafs || []).filter((frame) => frame.t >= mark).map((frame) => Math.round(frame.d)),
    mark,
  };
}, started);
if (after.state !== "done" || after.playing) {
  console.error(`graphic did not stop: ${after.state} playing ${after.playing}`);
  process.exitCode = 1;
}
if (after.longTasks.length || after.loafs.length) {
  console.error(
    `graphic performance long tasks ${after.longTasks.join(", ") || "none"}; long animation frames ${after.loafs.join(", ") || "none"}`,
  );
  process.exitCode = 1;
}

await stage.click();
await page.waitForFunction(() => document.querySelector(".kb-stage")?.dataset.kbState === "play", null, {
  timeout: 4000,
});
await page.waitForFunction(() => document.querySelector(".kb-stage")?.dataset.kbState === "done", null, {
  timeout: 15000,
});
await page.waitForTimeout(400);
const replay = await page.locator(".kb-stage").getAttribute("data-kb-state");
if (replay !== "done") {
  console.error(`replay did not stop: ${replay}`);
  process.exitCode = 1;
}

await browser.close();
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
}
if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log("knowledge base page checks passed");
