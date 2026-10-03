import { ObjectId } from "mongodb";
import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { BinDoc, RequestDetail, RequestDoc } from "@/lib/types";
import { isValidBinId, isValidRequestId } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ binId: string; id: string }> };

function toDetail(doc: RequestDoc): RequestDetail {
  return {
    id: doc._id!.toHexString(),
    method: doc.method,
    path: doc.path,
    query: doc.query,
    headers: doc.headers,
    ip: doc.ip,
    userAgent: doc.userAgent,
    contentType: doc.contentType,
    bodyRaw: doc.bodyRaw,
    bodyJson: doc.bodyJson,
    bodyEncoding: doc.bodyEncoding,
    bodyTruncated: doc.bodyTruncated,
    sizeBytes: doc.sizeBytes,
    receivedAt: doc.receivedAt.toISOString(),
    durationMs: doc.durationMs,
    responseStatus: doc.responseStatus,
  };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { binId, id } = await ctx.params;
  if (!isValidBinId(binId) || !isValidRequestId(id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const db = await getDb();
  const bin = await db.collection<BinDoc>("bins").findOne({ token: binId });
  if (!bin) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const doc = await db
    .collection<RequestDoc>("requests")
    .findOne({ _id: new ObjectId(id), binId });
  if (!doc) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(toDetail(doc));
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { binId, id } = await ctx.params;
  if (!isValidBinId(binId) || !isValidRequestId(id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const db = await getDb();
  const result = await db
    .collection<RequestDoc>("requests")
    .deleteOne({ _id: new ObjectId(id), binId });
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await db.collection<BinDoc>("bins").updateOne({ token: binId }, [
    {
      $set: {
        requestCount: { $max: [0, { $subtract: ["$requestCount", 1] }] },
      },
    },
  ]);
  return NextResponse.json({ deleted: true });
}
