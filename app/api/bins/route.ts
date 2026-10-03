import { randomBytes } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { hasIllegalMongoKey, readLimitedBody } from "@/lib/capture";
import { getDb } from "@/lib/db";
import { config } from "@/lib/env";
import { clientIp } from "@/lib/ip";
import { RateLimiter } from "@/lib/ratelimit";
import type { BinDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

const createLimiter = new RateLimiter(config.rateLimitPerMin);
const CREATE_BODY_LIMIT = 65_536;

export async function GET() {
  const db = await getDb();
  const bins = (await db
    .collection<BinDoc>("bins")
    .find({})
    .sort({ createdAt: -1 })
    .limit(100)
    .project({ token: 1, name: 1, createdAt: 1, requestCount: 1 })
    .toArray()) as unknown as BinDoc[];
  return NextResponse.json({
    bins: bins.map((b) => ({
      binId: b.token,
      name: b.name,
      createdAt: b.createdAt.toISOString(),
      requestCount: b.requestCount,
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!createLimiter.allow(clientIp(req.headers))) {
    return NextResponse.json({ error: "rate limit exceeded" }, { status: 429 });
  }

  let body: Record<string, unknown> = {};
  if (req.body) {
    let read: Awaited<ReturnType<typeof readLimitedBody>>;
    try {
      read = await readLimitedBody(
        req.body as ReadableStream<Uint8Array>,
        CREATE_BODY_LIMIT,
        config.bodyReadTimeoutMs
      );
    } catch {
      return NextResponse.json(
        { error: "body read timeout" },
        { status: 408 }
      );
    }
    if (read.truncated) {
      return NextResponse.json({ error: "body too large" }, { status: 413 });
    }
    try {
      const parsed = JSON.parse(read.bytes.toString("utf8") || "{}");
      if (parsed && typeof parsed === "object") body = parsed;
    } catch {
      return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
    }
  }

  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim().slice(0, 100)
      : undefined;
  const redactHeaders = body.redactHeaders === true;
  const responseStatus =
    Number.isInteger(body.responseStatus) &&
    (body.responseStatus as number) >= 100 &&
    (body.responseStatus as number) <= 599
      ? (body.responseStatus as number)
      : undefined;
  // Cap the stored custom response: this endpoint is unauthenticated.
  let responseBody: unknown;
  if (body.responseBody !== undefined) {
    const invalid =
      hasIllegalMongoKey(body.responseBody) ||
      (() => {
        try {
          return JSON.stringify(body.responseBody).length > 8192;
        } catch {
          return true;
        }
      })();
    if (invalid) {
      return NextResponse.json(
        { error: "responseBody contains unsupported keys or is too large" },
        { status: 400 }
      );
    }
    responseBody = body.responseBody;
  }

  const token = randomBytes(16).toString("hex");
  const bin: BinDoc = {
    token,
    name,
    createdAt: new Date(),
    requestCount: 0,
    redactHeaders,
    responseStatus,
    responseBody,
  };
  const db = await getDb();
  await db.collection<BinDoc>("bins").insertOne(bin);

  const origin = new URL(req.url).origin;
  return NextResponse.json(
    { binId: token, url: `${origin}/hook/${token}` },
    { status: 201 }
  );
}
