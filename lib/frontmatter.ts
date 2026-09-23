export type FrontmatterValue =
  | string
  | FrontmatterValue[]
  | { [key: string]: FrontmatterValue };

function indentOf(line: string): number {
  return line.match(/^ */)?.[0].length ?? 0;
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function readBlock(
  lines: string[],
  start: number,
): { value: string; next: number } {
  let index = start;
  while (index < lines.length && lines[index].trim() === "") {
    index += 1;
  }
  if (index >= lines.length) {
    return { value: "", next: index };
  }

  const base = indentOf(lines[index]);
  const collected: string[] = [];

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      collected.push("");
      index += 1;
      continue;
    }
    if (indentOf(line) < base) {
      break;
    }
    collected.push(line.slice(base));
    index += 1;
  }

  while (collected.length > 0 && collected[collected.length - 1] === "") {
    collected.pop();
  }

  return { value: collected.join("\n"), next: index };
}

function parseObject(
  lines: string[],
  start: number,
  indent: number,
): { value: { [key: string]: FrontmatterValue }; next: number } {
  const value: { [key: string]: FrontmatterValue } = {};
  let index = start;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      index += 1;
      continue;
    }
    if (indentOf(line) < indent) {
      break;
    }
    if (indentOf(line) > indent || line.trim().startsWith("- ")) {
      break;
    }

    const trimmed = line.trim();
    const colon = trimmed.indexOf(":");
    if (colon === -1) {
      break;
    }

    const key = trimmed.slice(0, colon).trim();
    const rest = trimmed.slice(colon + 1).trim();
    index += 1;

    if (rest === "|-" || rest === "|") {
      const block = readBlock(lines, index);
      value[key] = block.value;
      index = block.next;
      continue;
    }

    if (rest === "") {
      let nested = index;
      while (nested < lines.length && lines[nested].trim() === "") {
        nested += 1;
      }
      if (nested >= lines.length || indentOf(lines[nested]) <= indent) {
        value[key] = "";
        index = nested;
        continue;
      }
      if (lines[nested].trim().startsWith("- ")) {
        const list = parseList(lines, nested, indentOf(lines[nested]));
        value[key] = list.value;
        index = list.next;
        continue;
      }
      const child = parseObject(lines, nested, indentOf(lines[nested]));
      value[key] = child.value;
      index = child.next;
      continue;
    }

    value[key] = unquote(rest);
  }

  return { value, next: index };
}

function parseList(
  lines: string[],
  start: number,
  indent: number,
): { value: FrontmatterValue[]; next: number } {
  const value: FrontmatterValue[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      index += 1;
      continue;
    }
    if (indentOf(line) < indent || !line.trim().startsWith("- ")) {
      break;
    }

    const rest = line.trim().slice(2);
    const colon = rest.indexOf(":");
    const looksLikeKey = colon > 0 && !rest.startsWith("http");

    if (!looksLikeKey) {
      value.push(unquote(rest));
      index += 1;
      continue;
    }

    const item: { [key: string]: FrontmatterValue } = {};
    const key = rest.slice(0, colon).trim();
    const after = rest.slice(colon + 1).trim();
    index += 1;

    if (after === "|-" || after === "|") {
      const block = readBlock(lines, index);
      item[key] = block.value;
      index = block.next;
    } else if (after === "") {
      item[key] = "";
    } else {
      item[key] = unquote(after);
    }

    while (index < lines.length) {
      const nextLine = lines[index];
      if (nextLine.trim() === "") {
        index += 1;
        continue;
      }
      if (indentOf(nextLine) <= indent || nextLine.trim().startsWith("- ")) {
        break;
      }

      const nextTrimmed = nextLine.trim();
      const nextColon = nextTrimmed.indexOf(":");
      if (nextColon === -1) {
        break;
      }

      const nextKey = nextTrimmed.slice(0, nextColon).trim();
      const nextRest = nextTrimmed.slice(nextColon + 1).trim();
      index += 1;

      if (nextRest === "|-" || nextRest === "|") {
        const block = readBlock(lines, index);
        item[nextKey] = block.value;
        index = block.next;
      } else {
        item[nextKey] = unquote(nextRest);
      }
    }

    value.push(item);
  }

  return { value, next: index };
}

export function parseFrontmatter(source: string): {
  data: { [key: string]: FrontmatterValue };
  body: string;
} {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    throw new Error("Missing frontmatter");
  }

  const lines = match[1].split(/\r?\n/);
  const parsed = parseObject(lines, 0, 0);

  return {
    data: parsed.value,
    body: source.slice(match[0].length),
  };
}
