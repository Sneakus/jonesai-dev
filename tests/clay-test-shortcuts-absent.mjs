// Proves clay test shortcuts are absent from a production Next build.
// Run after `npm run build` with VERCEL_ENV unset (or production).
import fs from "node:fs";
import path from "node:path";

const marker = "clay-test-shortcut-bundle-marker";
const root = path.join(process.cwd(), ".next");

function walk(dir, hits) {
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "cache" || entry.name === "types") {
        continue;
      }
      walk(full, hits);
      continue;
    }
    if (!/\.(js|mjs|cjs|css|html|map|json)$/i.test(entry.name)) {
      continue;
    }
    const text = fs.readFileSync(full, "utf8");
    if (text.includes(marker)) {
      hits.push(path.relative(process.cwd(), full));
    }
  }
}

if (!fs.existsSync(root)) {
  console.error("No .next folder. Run npm run build first.");
  process.exit(1);
}

const hits = [];
walk(path.join(root, "static"), hits);
walk(path.join(root, "server"), hits);

if (hits.length) {
  console.error(
    `Clay test shortcuts must not ship in production. Found "${marker}" in:\n${hits.join("\n")}`,
  );
  process.exit(1);
}

console.log(`ok: production build has no ${marker}`);
