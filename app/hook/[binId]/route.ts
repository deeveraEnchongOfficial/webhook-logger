import { type NextRequest, NextResponse } from "next/server";
import {
  escapeKeyForMongo,
  paramsToObject,
  parseCapturedBody,
  readLimitedBody,
  truncateForStore,
} from "@/lib/capture";
import { getDb } from "@/lib/db";
import { config } from "@/lib/env";
import { clientIp } from "@/lib/ip";
import { RateLimiter } from "@/lib/ratelimit";
import { redactHeaders } from "@/lib/redact";
import type { BinDoc, RequestDoc } from "@/lib/types";
import { isValidBinId } from "@/lib/validate";

export const dynamic = "force-dynamic";

const limiter = new RateLimiter(config.rateLimitPerMin);

async function capture(
  req: NextRequest,
  ctx: { params: Promise<{ binId: string }> }
): Promise<Response> {
  const start = Date.now();
  const { binId } = await ctx.params;
  if (!isValidBinId(binId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const ip = clientIp(req.headers);
  if (!limiter.allow(ip)) {
    return NextResponse.json({ error: "rate limit exceeded" }, { status: 429 });
  }

  const db = await getDb();
  const bins = db.collection<BinDoc>("bins");
  const requests = db.collection<RequestDoc>("requests");

  const bin = await bins.findOne({ token: binId });
  if (!bin) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let body: Awaited<ReturnType<typeof readLimitedBody>> = {
    bytes: Buffer.alloc(0),
    truncated: false,
    sizeBytes: 0,
  };
  if (req.body) {
    try {
      body = await readLimitedBody(
        req.body as ReadableStream<Uint8Array>,
        config.bodyLimitBytes,
        config.bodyReadTimeoutMs
      );
    } catch (err) {
      const timeout =
        err instanceof Error && /timeout/i.test(err.message);
      return NextResponse.json(
        { error: timeout ? "body read timeout" : "body read failed" },
        { status: timeout ? 408 : 400 }
      );
    }
  }

  const contentType = req.headers.get("content-type") ?? "";
  const parsed = await parseCapturedBody(contentType || null, body.bytes);
  const url = new URL(req.url);

  let headers: Record<string, string> = {};
  for (const [name, value] of req.headers.entries()) {
    headers[escapeKeyForMongo(name)] = value;
  }
  if (bin.redactHeaders) headers = redactHeaders(headers);

  const stored = truncateForStore(parsed.bodyRaw, config.storeLimitBytes);
  const responseStatus = bin.responseStatus ?? 200;
  const doc: RequestDoc = {
    binId,
    method: req.method,
    path: url.pathname,
    query: paramsToObject(url.searchParams),
    headers,
    ip,
    userAgent: req.headers.get("user-agent") ?? "",
    contentType,
    bodyRaw: stored.text,
    bodyJson: parsed.bodyJson,
    bodyEncoding: parsed.encoding,
    bodyTruncated: body.truncated || stored.truncated,
    sizeBytes: body.sizeBytes,
    receivedAt: new Date(),
    durationMs: Date.now() - start,
    responseStatus,
  };

  await requests.insertOne(doc);
  await bins.updateOne({ token: binId }, { $inc: { requestCount: 1 } });

  // LRU cap: drop the oldest requests beyond maxRequestsPerBin
  const count = await requests.countDocuments({ binId });
  const excess = count - config.maxRequestsPerBin;
  if (excess > 0) {
    const oldest = await requests
      .find({ binId })
      .sort({ receivedAt: 1 })
      .limit(excess)
      .project({ _id: 1 })
      .toArray();
    await requests.deleteMany({ _id: { $in: oldest.map((d) => d._id!) } });
  }

  // 1xx/204/304 forbid a response body — NextResponse.json would throw.
  const nullBody =
    responseStatus < 200 || responseStatus === 204 || responseStatus === 304;
  if (req.method === "HEAD" || nullBody) {
    return new Response(null, { status: responseStatus });
  }
  return NextResponse.json(bin.responseBody ?? { ok: true }, {
    status: responseStatus,
  });
}

export {
  capture as DELETE,
  capture as GET,
  capture as HEAD,
  capture as OPTIONS,
  capture as PATCH,
  capture as POST,
  capture as PUT,
};
