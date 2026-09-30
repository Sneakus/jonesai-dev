import { NextResponse } from "next/server";

const COUNT_KEY = "clay-hard-beats";

function redisConfig() {
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    "";
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    "";
  if (!url || !token) {
    return null;
  }
  return { url: url.replace(/\/$/, ""), token };
}

async function redisCommand(
  config: { url: string; token: string },
  command: (string | number)[],
) {
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`redis ${response.status}`);
  }
  const body = (await response.json()) as { result?: unknown };
  return body.result;
}

function clientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

export async function GET() {
  try {
    const config = redisConfig();
    if (!config) {
      return NextResponse.json({ count: null });
    }
    const result = await redisCommand(config, ["GET", COUNT_KEY]);
    const count = Number(result ?? 0);
    return NextResponse.json({
      count: Number.isFinite(count) ? count : 0,
    });
  } catch {
    return NextResponse.json({ count: null });
  }
}

export async function POST(request: Request) {
  try {
    const config = redisConfig();
    if (!config) {
      return NextResponse.json({ count: null, ok: false });
    }
    const ip = clientAddress(request);
    const limitKey = `clay-hard-ip:${ip}`;
    const limited = await redisCommand(config, [
      "SET",
      limitKey,
      "1",
      "NX",
      "EX",
      60,
    ]);
    if (limited === null) {
      const current = await redisCommand(config, ["GET", COUNT_KEY]);
      return NextResponse.json({
        count: Number(current ?? 0) || 0,
        ok: false,
        limited: true,
      });
    }
    const count = Number(await redisCommand(config, ["INCR", COUNT_KEY]));
    return NextResponse.json({
      count: Number.isFinite(count) ? count : 0,
      ok: true,
    });
  } catch {
    return NextResponse.json({ count: null, ok: false });
  }
}

// Test helper: run the same logic against a mock store.
export async function hardBeatsWithStore(
  store: Map<string, string>,
  method: "GET" | "POST",
  ip = "test",
) {
  if (method === "GET") {
    return { count: Number(store.get(COUNT_KEY) ?? 0) };
  }
  const limitKey = `clay-hard-ip:${ip}`;
  if (store.has(limitKey)) {
    return { count: Number(store.get(COUNT_KEY) ?? 0), ok: false, limited: true };
  }
  store.set(limitKey, "1");
  const next = Number(store.get(COUNT_KEY) ?? 0) + 1;
  store.set(COUNT_KEY, String(next));
  return { count: next, ok: true };
}
