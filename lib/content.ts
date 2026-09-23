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
  startLabel: string;
  replayLabel: string;
  gameLiveLabel: string;
  hitMark: string;
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
  | { type: "excerpt" }
  | { type: "example" };

export type BuildImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type BuildExample = {
  label: string;
  question: string;
  answerLabel: string;
  answer: string[];
};

export type BuildLink = {
  label: string;
  url: string;
};

export type Build = {
  draft: boolean;
  order: number;
  title: string;
  slug: string;
  summary: string;
  repo: string;
  transcript: string;
  plan: string;
  excerptLabel: string;
  excerpt: BuildExcerpt | null;
  image: BuildImage | null;
  example: BuildExample | null;
  links: BuildLink[];
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
    startLabel: requiredString(data, "startLabel", "content/home.md"),
    replayLabel: requiredString(data, "replayLabel", "content/home.md"),
    gameLiveLabel: requiredString(data, "gameLiveLabel", "content/home.md"),
    hitMark: requiredString(data, "hitMark", "content/home.md"),
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
    if (line.trim() === "<!-- EXAMPLE -->") {
      blocks.push({ type: "example" });
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
      lines[index].trim() !== "<!-- EXCERPT -->" &&
      lines[index].trim() !== "<!-- EXAMPLE -->"
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

function readImageSize(src: string, file: string): { width: number; height: number } {
  const relative = src.replace(/^\/+/, "");
  const filePath = path.join(process.cwd(), "public", relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(`${file} image ${src} is missing`);
  }

  const data = fs.readFileSync(filePath);
  const kind = data.toString("ascii", 12, 16);
  if (data.toString("ascii", 0, 4) !== "RIFF" || data.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error(`${file} image ${src} could not be read`);
  }

  if (kind === "VP8 ") {
    if (data[23] !== 0x9d || data[24] !== 0x01 || data[25] !== 0x2a) {
      throw new Error(`${file} image ${src} could not be read`);
    }
    return {
      width: data.readUInt16LE(26) & 0x3fff,
      height: data.readUInt16LE(28) & 0x3fff,
    };
  }

  if (kind === "VP8X") {
    return {
      width: 1 + data.readUIntLE(24, 3),
      height: 1 + data.readUIntLE(27, 3),
    };
  }

  if (kind === "VP8L" && data[20] === 0x2f) {
    const bits = data.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  throw new Error(`${file} image ${src} could not be read`);
}

function parseImage(
  value: FrontmatterValue | undefined,
  file: string,
): BuildImage | null {
  if (value === undefined) {
    return null;
  }
  if (!isRecord(value)) {
    throw new Error(`${file} image could not be read`);
  }
  const src = requiredString(value, "src", file);
  const alt = requiredString(value, "alt", file);
  const size = readImageSize(src, file);
  return { src, alt, width: size.width, height: size.height };
}

function parseStringList(
  value: FrontmatterValue | undefined,
  file: string,
  label: string,
): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${file} is missing ${label}`);
  }
  return value.map((item) => {
    if (typeof item !== "string") {
      throw new Error(`${file} has a ${label} line that could not be read`);
    }
    return item;
  });
}

function parseExample(
  value: FrontmatterValue | undefined,
  file: string,
): BuildExample | null {
  if (value === undefined) {
    return null;
  }
  if (!isRecord(value)) {
    throw new Error(`${file} example could not be read`);
  }
  return {
    label: requiredString(value, "label", file),
    question: requiredString(value, "question", file),
    answerLabel: requiredString(value, "answerLabel", file),
    answer: parseStringList(value.answer, file, "example answer"),
  };
}

function parseLinks(value: FrontmatterValue | undefined, file: string): BuildLink[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`${file} links could not be read`);
  }
  return value.map((item, itemIndex) => {
    if (!isRecord(item)) {
      throw new Error(`${file} link ${itemIndex + 1} could not be read`);
    }
    return {
      label: requiredString(item, "label", file),
      url: requiredString(item, "url", file),
    };
  });
}

function readOrder(data: { [key: string]: FrontmatterValue }, file: string): number {
  const value = data.order;
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${file} is missing order`);
  }
  const order = Number(value);
  if (!Number.isFinite(order)) {
    throw new Error(`${file} has an order that could not be read`);
  }
  return order;
}

function readBuildFile(filePath: string): Build {
  const filename = path.basename(filePath);
  const { data, body } = readMarkdown(filePath);
  const slug = optionalString(data, "slug") || filename.replace(/\.md$/, "");

  return {
    draft: data.draft === "true",
    order: readOrder(data, filename),
    title: requiredString(data, "title", filename),
    slug,
    summary: requiredString(data, "summary", filename),
    repo: optionalString(data, "repo"),
    transcript: optionalString(data, "transcript"),
    plan: optionalString(data, "plan"),
    excerptLabel: optionalString(data, "excerptLabel"),
    excerpt: parseExcerpt(data.excerpt, filename),
    image: parseImage(data.image, filename),
    example: parseExample(data.example, filename),
    links: parseLinks(data.links, filename),
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
    .map((name) => readBuildFile(path.join(directory, name)))
    .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}

export function readBuild(slug: string): Build | null {
  return readBuilds().find((build) => build.slug === slug) ?? null;
}
