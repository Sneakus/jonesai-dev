import fs from "fs";
import path from "path";
import { parseFrontmatter, type FrontmatterValue } from "@/lib/frontmatter";

export type GoodShot = {
  key: string;
  name: string;
  cause: string;
  messages: string[];
};

export type FaultShot = {
  key: string;
  name: string;
  cause: string;
  tip: string;
};

export type AirShot = {
  key: string;
  name: string;
  cause: string;
  hard: string[];
  normal: string[];
  slow: string[];
};

export type GolfRangeCopy = {
  good: GoodShot[];
  faults: FaultShot[];
  air: AirShot;
};

function asRecord(value: FrontmatterValue | undefined): { [key: string]: FrontmatterValue } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value;
}

function asList(value: FrontmatterValue | undefined): FrontmatterValue[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: FrontmatterValue | undefined): string {
  return typeof value === "string" ? value : "";
}

function stringList(value: FrontmatterValue | undefined): string[] {
  return asList(value).filter((item): item is string => typeof item === "string");
}

export function readGolfRange(): GolfRangeCopy {
  const filePath = path.join(process.cwd(), "content", "golf-range.md");
  const raw = fs.readFileSync(filePath, "utf8");
  const cleaned = raw
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
  const { data } = parseFrontmatter(cleaned);
  const good = asList(data.good).map((item) => {
    const row = asRecord(item);
    return {
      key: asString(row?.key),
      name: asString(row?.name),
      cause: asString(row?.cause),
      messages: stringList(row?.messages),
    };
  });
  const faults: FaultShot[] = [];
  let air: AirShot | null = null;
  for (const item of asList(data.faults)) {
    const row = asRecord(item);
    if (!row) {
      continue;
    }
    if (asString(row.key) === "air-shot") {
      const messages = asRecord(row.messages);
      air = {
        key: "air-shot",
        name: asString(row.name),
        cause: asString(row.cause),
        hard: stringList(messages?.hard),
        normal: stringList(messages?.normal),
        slow: stringList(messages?.slow),
      };
      continue;
    }
    faults.push({
      key: asString(row.key),
      name: asString(row.name),
      cause: asString(row.cause),
      tip: asString(row.tip),
    });
  }
  if (!air) {
    throw new Error("content/golf-range.md is missing the air shot");
  }
  return { good, faults, air };
}
