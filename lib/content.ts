import fs from "node:fs";
import path from "node:path";

export type HomeContent = {
  draft: boolean;
  name: string;
  title: string;
  intro: string;
  gameHint: string;
  gameLabel: string;
  receiptsValue: string;
  receiptsLabel: string;
};

function readField(frontmatter: string, key: string): string {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  if (!match) {
    throw new Error(`content/home.md is missing ${key}`);
  }

  const value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export function readHome(): HomeContent {
  const filePath = path.join(process.cwd(), "content", "home.md");
  const raw = fs.readFileSync(filePath, "utf8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error("content/home.md is missing frontmatter");
  }

  const frontmatter = match[1];

  return {
    draft: readField(frontmatter, "draft") === "true",
    name: readField(frontmatter, "name"),
    title: readField(frontmatter, "title"),
    intro: readField(frontmatter, "intro"),
    gameHint: readField(frontmatter, "gameHint"),
    gameLabel: readField(frontmatter, "gameLabel"),
    receiptsValue: readField(frontmatter, "receiptsValue"),
    receiptsLabel: readField(frontmatter, "receiptsLabel"),
  };
}
