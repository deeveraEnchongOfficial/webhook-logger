import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { BinDoc, RequestDoc, RequestSummary } from "@/lib/types";
import { isValidBinId } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ binId: string }> };

function toSummary(doc: RequestDoc): RequestSummary {
  return {
    id: doc._id!.toHexString(),
    method: doc.method,
    path: doc.path,
    sizeBytes: doc.sizeBytes,
    receivedAt: doc.receivedAt.toISOString(),
    contentType: doc.contentType,
  };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { binId } = await ctx.params;
  if (!isValidBinId(binId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const db = await getDb();
  const bin = await db.collection<BinDoc>("bins").findOne({ token: binId });
  if (!bin) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit"));
  const limit =
    Number.isInteger(limitParam) && limitParam > 0
      ? Math.min(limitParam, 200)
      : 100;

  const filter: Record<string, unknown> = { binId };
  const before = url.searchParams.get("before");
  if (before) {
    const beforeDate = new Date(before);
    if (!Number.isNaN(beforeDate.getTime())) {
      filter.receivedAt = { $lt: beforeDate };
    }
  }

  const docs = (await db
    .collection<RequestDoc>("requests")
    .find(filter)
    .sort({ receivedAt: -1 })
    .limit(limit)
    .project({
      method: 1,
      path: 1,
      sizeBytes: 1,
      receivedAt: 1,
      contentType: 1,
    })
    .toArray()) as unknown as RequestDoc[];

  return NextResponse.json({
    bin: {
      binId: bin.token,
      name: bin.name,
      requestCount: bin.requestCount,
      createdAt: bin.createdAt.toISOString(),
    },
    requests: docs.map(toSummary),
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { binId } = await ctx.params;
  if (!isValidBinId(binId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const db = await getDb();
  const bin = await db.collection<BinDoc>("bins").findOne({ token: binId });
  if (!bin) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const result = await db
    .collection<RequestDoc>("requests")
    .deleteMany({ binId });
  await db
    .collection<BinDoc>("bins")
    .updateOne({ token: binId }, { $set: { requestCount: 0 } });
  return NextResponse.json({ cleared: result.deletedCount });
}
