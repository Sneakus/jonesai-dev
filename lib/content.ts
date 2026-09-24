import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter, type FrontmatterValue } from "@/lib/frontmatter";

export type HomeContent = {
  draft: boolean;
  name: string;
  title: string;
  intro: string;
  metaTitle: string;
  metaDescription: string;
  gameHint: string;
  gameLabel: string;
  startLabel: string;
  replayLabel: string;
  gameLiveLabel: string;
  hitMark: string;
};

export type GameContent = {
  draft: boolean;
  replayButton: string;
  scoreMessages: string[][];
};

export type ContactContent = {
  draft: boolean;
  heading: string;
  copyLabel: string;
  copiedLabel: string;
  copiedAnnouncement: string;
  copyFallbackControl: string;
  copyFallbackCommand: string;
  linkedInLabel: string;
  linkedInUrl: string;
  githubLabel: string;
  githubUrl: string;
  cvLabel: string;
  cvUrl: string;
};

export type SiteContent = {
  buildsHeading: string;
  transcriptLink: string;
  planLink: string;
  repoLink: string;
};

export type CallLine = {
  who: string;
  said: string;
};

export type PlanItem = {
  text: string;
  quote: string;
};

export type PlanGroup = {
  label: string;
  items: PlanItem[];
};

export type CallPlan = {
  callLabel: string;
  call: CallLine[];
  planLabel: string;
  groups: PlanGroup[];
};

export type BuildBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "callPlan" }
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

export type FunnelStep = {
  label: string;
  out: number;
};

export type BuildFunnel = {
  date: string;
  start: string;
  steps: FunnelStep[];
  end: string;
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
  image: BuildImage | null;
  globeCaption: string;
  callPlan: CallPlan | null;
  example: BuildExample | null;
  funnel: BuildFunnel | null;
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
    metaTitle: requiredString(data, "metaTitle", "content/home.md"),
    metaDescription: requiredString(data, "metaDescription", "content/home.md"),
    gameHint: requiredString(data, "gameHint", "content/home.md"),
    gameLabel: requiredString(data, "gameLabel", "content/home.md"),
    startLabel: requiredString(data, "startLabel", "content/home.md"),
    replayLabel: requiredString(data, "replayLabel", "content/home.md"),
    gameLiveLabel: requiredString(data, "gameLiveLabel", "content/home.md"),
    hitMark: requiredString(data, "hitMark", "content/home.md"),
  };
}

export function readGame(): GameContent {
  const file = "content/game.md";
  const filePath = path.join(process.cwd(), "content", "game.md");
  const { data } = readMarkdown(filePath);
  const messages = data.scoreMessages;
  if (!isRecord(messages)) {
    throw new Error(`${file} is missing scoreMessages`);
  }

  const scoreMessages = Array.from({ length: 6 }, (_, score) => {
    const value =
      messages[String(score)] ?? messages[`"${String(score)}"`];
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error(`${file} is missing messages for score ${score}`);
    }
    return value.map((message) => {
      if (typeof message !== "string") {
        throw new Error(`${file} has a message that could not be read`);
      }
      return message;
    });
  });

  return {
    draft: data.draft === "true",
    replayButton: requiredString(data, "replayButton", file),
    scoreMessages,
  };
}

export function readContact(): ContactContent {
  const file = "content/contact.md";
  const filePath = path.join(process.cwd(), "content", "contact.md");
  const { data } = readMarkdown(filePath);

  return {
    draft: data.draft === "true",
    heading: requiredString(data, "heading", file),
    copyLabel: requiredString(data, "copyLabel", file),
    copiedLabel: requiredString(data, "copiedLabel", file),
    copiedAnnouncement: requiredString(data, "copiedAnnouncement", file),
    copyFallbackControl: requiredString(data, "copyFallbackControl", file),
    copyFallbackCommand: requiredString(data, "copyFallbackCommand", file),
    linkedInLabel: requiredString(data, "linkedInLabel", file),
    linkedInUrl: requiredString(data, "linkedInUrl", file),
    githubLabel: requiredString(data, "githubLabel", file),
    githubUrl: requiredString(data, "githubUrl", file),
    cvLabel: requiredString(data, "cvLabel", file),
    cvUrl: requiredString(data, "cvUrl", file),
  };
}

export function readSite(): SiteContent {
  const filePath = path.join(process.cwd(), "content", "site.md");
  const { data } = readMarkdown(filePath);
  const file = "content/site.md";

  return {
    buildsHeading: requiredString(data, "buildsHeading", file),
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
    if (line.trim() === "<!-- CALLPLAN -->") {
      blocks.push({ type: "callPlan" });
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
      lines[index].trim() !== "<!-- CALLPLAN -->" &&
      lines[index].trim() !== "<!-- EXAMPLE -->"
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

function parseCallPlan(
  value: FrontmatterValue | undefined,
  file: string,
): CallPlan | null {
  if (value === undefined) {
    return null;
  }
  if (!isRecord(value)) {
    throw new Error(`${file} call plan could not be read`);
  }
  if (!Array.isArray(value.call)) {
    throw new Error(`${file} is missing call plan lines`);
  }
  const call = value.call.map((item, itemIndex) => {
    if (!isRecord(item)) {
      throw new Error(`${file} call line ${itemIndex + 1} could not be read`);
    }
    return {
      who: requiredString(item, "who", file),
      said: requiredString(item, "said", file),
    };
  });
  if (!Array.isArray(value.groups)) {
    throw new Error(`${file} is missing call plan groups`);
  }
  const groups = value.groups.map((group, groupIndex) => {
    if (!isRecord(group) || !Array.isArray(group.items)) {
      throw new Error(`${file} call plan group ${groupIndex + 1} could not be read`);
    }
    return {
      label: requiredString(group, "label", file),
      items: group.items.map((item, itemIndex) => {
        if (!isRecord(item)) {
          throw new Error(`${file} plan item ${itemIndex + 1} could not be read`);
        }
        return {
          text: requiredString(item, "text", file),
          quote: optionalString(item, "quote"),
        };
      }),
    };
  });
  return {
    callLabel: requiredString(value, "callLabel", file),
    call,
    planLabel: requiredString(value, "planLabel", file),
    groups,
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

function requiredNumber(
  data: { [key: string]: FrontmatterValue },
  key: string,
  file: string,
): number {
  const raw = requiredString(data, key, file);
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`${file} has a ${key} that could not be read`);
  }
  return value;
}

function parseFunnel(
  value: FrontmatterValue | undefined,
  file: string,
): BuildFunnel | null {
  if (value === undefined) {
    return null;
  }
  if (!isRecord(value)) {
    throw new Error(`${file} funnel could not be read`);
  }
  if (!Array.isArray(value.steps) || value.steps.length === 0) {
    throw new Error(`${file} is missing funnel steps`);
  }
  const steps = value.steps.map((item, itemIndex) => {
    if (!isRecord(item)) {
      throw new Error(`${file} funnel step ${itemIndex + 1} could not be read`);
    }
    return {
      label: requiredString(item, "label", file),
      out: requiredNumber(item, "out", file),
    };
  });
  return {
    date: requiredString(value, "date", file),
    start: requiredString(value, "start", file),
    steps,
    end: requiredString(value, "end", file),
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
    image: parseImage(data.image, filename),
    globeCaption: optionalString(data, "globeCaption"),
    callPlan: parseCallPlan(data.callPlan, filename),
    example: parseExample(data.example, filename),
    funnel: parseFunnel(data.funnel, filename),
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
