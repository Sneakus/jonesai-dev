import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter, type FrontmatterValue } from "@/lib/frontmatter";

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

export type SiteContent = {
  buildsHeading: string;
  quotedTag: string;
  gapTag: string;
  judgementTag: string;
  transcriptLink: string;
  planLink: string;
  repoLink: string;
};

export type Finding = {
  claim: string;
  quote: string;
};

export type BuildExcerpt = {
  findings: Finding[];
  gap: string;
  questions: string[];
  judgementLabel: string;
  judgement: string;
};

export type BuildBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "excerpt" };

export type Build = {
  draft: boolean;
  title: string;
  slug: string;
  summary: string;
  repo: string;
  transcript: string;
  plan: string;
  excerptLabel: string;
  excerpt: BuildExcerpt | null;
  blocks: BuildBlock[];
};

function isRecord(value: FrontmatterValue | undefined): value is {
  [key: string]: FrontmatterValue;
} {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(
  data: { [key: string]: FrontmatterValue },
  key: string,
  file: string,
): string {
  const value = data[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${file} is missing ${key}`);
  }
  return value;
}

function optionalString(
  data: { [key: string]: FrontmatterValue },
  key: string,
): string {
  const value = data[key];
  return typeof value === "string" ? value : "";
}

function readMarkdown(filePath: string): {
  data: { [key: string]: FrontmatterValue };
  body: string;
} {
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    return parseFrontmatter(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : "could not be read";
    throw new Error(`${path.basename(filePath)} ${message}`);
  }
}

export function readHome(): HomeContent {
  const filePath = path.join(process.cwd(), "content", "home.md");
  const { data } = readMarkdown(filePath);

  return {
    draft: data.draft === "true",
    name: requiredString(data, "name", "content/home.md"),
    title: requiredString(data, "title", "content/home.md"),
    intro: requiredString(data, "intro", "content/home.md"),
    gameHint: requiredString(data, "gameHint", "content/home.md"),
    gameLabel: requiredString(data, "gameLabel", "content/home.md"),
    receiptsValue: requiredString(data, "receiptsValue", "content/home.md"),
    receiptsLabel: requiredString(data, "receiptsLabel", "content/home.md"),
  };
}

export function readSite(): SiteContent {
  const filePath = path.join(process.cwd(), "content", "site.md");
  const { data } = readMarkdown(filePath);
  const file = "content/site.md";

  return {
    buildsHeading: requiredString(data, "buildsHeading", file),
    quotedTag: requiredString(data, "quotedTag", file),
    gapTag: requiredString(data, "gapTag", file),
    judgementTag: requiredString(data, "judgementTag", file),
    transcriptLink: requiredString(data, "transcriptLink", file),
    planLink: requiredString(data, "planLink", file),
    repoLink: requiredString(data, "repoLink", file),
  };
}

function parseBlocks(body: string): BuildBlock[] {
  const lines = body.split(/\r?\n/);
  const blocks: BuildBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      index += 1;
      continue;
    }
    if (line.trim() === "<!-- EXCERPT -->") {
      blocks.push({ type: "excerpt" });
      index += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ type: "heading", text: line.slice(3).trim() });
      index += 1;
      continue;
    }
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length && lines[index].startsWith("- ")) {
        items.push(lines[index].slice(2).trim());
        index += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() !== "" &&
      !lines[index].startsWith("## ") &&
      !lines[index].startsWith("- ") &&
      lines[index].trim() !== "<!-- EXCERPT -->"
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

function parseExcerpt(
  value: FrontmatterValue | undefined,
  file: string,
): BuildExcerpt | null {
  if (!isRecord(value)) {
    return null;
  }

  const findingsValue = value.findings;
  if (!Array.isArray(findingsValue)) {
    throw new Error(`${file} is missing excerpt findings`);
  }

  const findings = findingsValue.map((item, itemIndex) => {
    if (!isRecord(item)) {
      throw new Error(`${file} finding ${itemIndex + 1} could not be read`);
    }
    return {
      claim: requiredString(item, "claim", file),
      quote: requiredString(item, "quote", file),
    };
  });

  const questionsValue = value.questions;
  if (!Array.isArray(questionsValue)) {
    throw new Error(`${file} is missing excerpt questions`);
  }
  const questions = questionsValue.map((item) => {
    if (typeof item !== "string") {
      throw new Error(`${file} has a question that could not be read`);
    }
    return item;
  });

  return {
    findings,
    gap: requiredString(value, "gap", file),
    questions,
    judgementLabel: requiredString(value, "judgementLabel", file),
    judgement: requiredString(value, "judgement", file),
  };
}

function readBuildFile(filePath: string): Build {
  const filename = path.basename(filePath);
  const { data, body } = readMarkdown(filePath);
  const slug = optionalString(data, "slug") || filename.replace(/\.md$/, "");

  return {
    draft: data.draft === "true",
    title: requiredString(data, "title", filename),
    slug,
    summary: requiredString(data, "summary", filename),
    repo: optionalString(data, "repo"),
    transcript: optionalString(data, "transcript"),
    plan: optionalString(data, "plan"),
    excerptLabel: optionalString(data, "excerptLabel"),
    excerpt: parseExcerpt(data.excerpt, filename),
    blocks: parseBlocks(body),
  };
}

export function readBuilds(): Build[] {
  const directory = path.join(process.cwd(), "content", "builds");
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => readBuildFile(path.join(directory, name)));
}

export function readBuild(slug: string): Build | null {
  return readBuilds().find((build) => build.slug === slug) ?? null;
}
