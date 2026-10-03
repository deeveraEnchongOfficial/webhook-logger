"use client";

import { useState } from "react";
import { buildCurl } from "@/lib/curl";
import type { RequestDetail as Detail } from "@/lib/types";
import JsonTree from "./JsonTree";
import KeyValueTable from "./KeyValueTable";
import MethodBadge from "./MethodBadge";

type BodyTab = "json" | "table" | "raw";

function isKvRenderable(
  v: unknown
): v is Record<string, unknown> | unknown[] {
  return v !== null && typeof v === "object";
}

function toKv(v: unknown): Record<string, unknown> {
  if (Array.isArray(v)) {
    return Object.fromEntries(v.map((item, i) => [String(i), item]));
  }
  return v as Record<string, unknown>;
}

export default function RequestDetail({
  detail,
  status,
  onDelete,
}: {
  detail: Detail | null;
  status: "idle" | "loading" | "missing" | "error";
  onDelete: (id: string) => void;
}) {
  const [tab, setTab] = useState<BodyTab>("json");
  const [copied, setCopied] = useState<string | null>(null);

  if (!detail) {
    const message =
      status === "loading"
        ? "Loading…"
        : status === "missing"
          ? "Request not found — it may have expired or been deleted."
          : status === "error"
            ? "Failed to load the request."
            : "Select a request to inspect it.";
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        {message}
      </div>
    );
  }

  const copy = async (label: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const rawBody =
    detail.bodyEncoding === "base64" && detail.bodyRaw
      ? `[binary body, base64]\n${detail.bodyRaw}`
      : (detail.bodyRaw ?? "");

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <MethodBadge method={detail.method} />
            <span className="break-all font-mono text-sm text-zinc-200">
              {detail.path}
            </span>
          </div>
          <div className="text-xs text-zinc-500">
            {new Date(detail.receivedAt).toLocaleString()} · {detail.ip} ·{" "}
            {detail.sizeBytes} B · {detail.durationMs} ms · responded{" "}
            {detail.responseStatus}
            {status === "loading" && (
              <span className="ml-2 text-sky-400">updating…</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => copy("body", detail.bodyRaw ?? "")}
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            {copied === "body" ? "Copied!" : "Copy body"}
          </button>
          <button
            type="button"
            onClick={() =>
              copy("curl", buildCurl(detail, window.location.origin))
            }
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            {copied === "curl" ? "Copied!" : "Copy as cURL"}
          </button>
          <button
            type="button"
            onClick={() => onDelete(detail.id)}
            className="rounded border border-rose-800 px-2 py-1 text-xs text-rose-400 hover:bg-rose-950"
          >
            Delete
          </button>
        </div>
      </div>

      <section className="mb-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Headers
        </h3>
        <KeyValueTable data={detail.headers} />
      </section>

      <section className="mb-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Query params
        </h3>
        <KeyValueTable data={detail.query} emptyText="No query params" />
      </section>

      <section>
        <div className="mb-2 flex items-center gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Body
          </h3>
          <div className="flex gap-1">
            {(["json", "table", "raw"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded px-2 py-0.5 text-xs ${
                  tab === t
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-800"
                }`}
              >
                {t === "json" ? "JSON tree" : t === "table" ? "Table" : "Raw"}
              </button>
            ))}
          </div>
          {detail.bodyTruncated && (
            <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">
              truncated
            </span>
          )}
        </div>
        {tab === "json" && <JsonTree data={detail.bodyJson} />}
        {tab === "table" &&
          (isKvRenderable(detail.bodyJson) ? (
            <KeyValueTable data={toKv(detail.bodyJson)} />
          ) : (
            <p className="text-sm text-zinc-500">
              Body is not a key/value structure.
            </p>
          ))}
        {tab === "raw" && (
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded bg-zinc-900 p-3 font-mono text-xs text-zinc-300">
            {rawBody || "(empty body)"}
          </pre>
        )}
      </section>
    </div>
  );
}
