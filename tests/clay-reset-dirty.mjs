// Dirty-profile check: old clay keys + unlocked hard mode, then ?test=normal.
// Usage: node tests/clay-reset-dirty.mjs --url http://127.0.0.1:3000
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const args = process.argv.slice(2);
const urlFlag = args.indexOf("--url");
const base =
  urlFlag >= 0 && args[urlFlag + 1]
    ? args[urlFlag + 1].replace(/\/$/, "")
    : "http://127.0.0.1:3000";

const profileDir = join(
  dirname(fileURLToPath(import.meta.url)),
  ".clay-dirty-profile",
);
mkdirSync(profileDir, { recursive: true });

const browser = await chromium.launchPersistentContext(profileDir, {
  headless: true,
  viewport: { width: 1100, height: 720 },
});

const page = browser.pages()[0] ?? (await browser.newPage());

// Seed old preview keys as if this browser used earlier hard-mode builds.
await page.goto(base + "/");
await page.evaluate(() => {
  const keys = [
    "clay-hard-unlocked",
    "clay-mode",
    "clay-hard-counted",
    "clay-hard-last-invite",
    "clay-hard-last-score-message",
    "clay-hard-last-win",
    "clay-last-score-message",
    "clay-unlocked",
    "clayHardUnlocked",
    "clay-legacy-preview",
  ];
  for (const key of keys) {
    window.localStorage.setItem(key, key.includes("mode") ? "hard" : "1");
    window.sessionStorage.setItem(key, key.includes("mode") ? "hard" : "1");
  }
});

await page.goto(base + "/?test=hard");
await page.waitForSelector("text=Pull", { timeout: 20000 });
const hardVisibleAfterUnlock = await page
  .locator("text=Hard mode")
  .first()
  .isVisible()
  .catch(() => false);
if (!hardVisibleAfterUnlock) {
  console.error("FAIL: Hard mode option missing after ?test=hard");
  await browser.close();
  process.exit(1);
}

await page.goto(base + "/?test=normal");
await page.waitForSelector("text=Pull", { timeout: 20000 });
await page.waitForTimeout(800);

const hardVisible = await page
  .locator("text=Hard mode")
  .first()
  .isVisible()
  .catch(() => false);
const storage = await page.evaluate(() => {
  const local = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith("clay-")) {
      local.push([key, localStorage.getItem(key)]);
    }
  }
  return {
    unlocked: localStorage.getItem("clay-hard-unlocked"),
    mode: localStorage.getItem("clay-mode"),
    legacy: localStorage.getItem("clay-legacy-preview"),
    local,
  };
});

console.log(
  JSON.stringify(
    { hardVisible, storage, base },
    null,
    2,
  ),
);

if (hardVisible) {
  console.error("FAIL: Hard mode option still visible after ?test=normal");
  await browser.close();
  process.exit(1);
}
if (storage.unlocked === "1") {
  console.error("FAIL: unlock key still set");
  await browser.close();
  process.exit(1);
}
if (storage.mode === "hard") {
  console.error("FAIL: mode still hard");
  await browser.close();
  process.exit(1);
}
if (storage.legacy) {
  console.error("FAIL: legacy clay key still present");
  await browser.close();
  process.exit(1);
}

console.log("PASS: dirty profile reset hides Hard mode and clears clay keys");
await browser.close();
