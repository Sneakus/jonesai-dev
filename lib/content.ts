import fs from "node:fs";
import path from "node:path";

export function readHomeHeading(): string {
  const filePath = path.join(process.cwd(), "content", "home.md");
  const raw = fs.readFileSync(filePath, "utf8");
  const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
  return (match ? match[1] : raw).trim();
}
