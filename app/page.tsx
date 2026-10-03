"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface BinInfo {
  binId: string;
  name?: string;
  createdAt: string;
  requestCount: number;
}

export default function Home() {
  const [name, setName] = useState("");
  const [redact, setRedact] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ binId: string; url: string } | null>(
    null
  );
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bins, setBins] = useState<BinInfo[]>([]);

  useEffect(() => {
    let alive = true;
    fetch("/api/bins")
      .then((r) => (r.ok ? r.json() : { bins: [] }))
      .then((j) => {
        if (alive) setBins(j.bins ?? []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [result]);

  const createBin = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/bins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          redactHeaders: redact,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create bin");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="mb-2 text-2xl font-bold">Webhook Logger</h1>
        <p className="mb-6 text-sm text-zinc-400">
          Get a unique URL, point any webhook sender at it, and inspect every
          request it receives — headers, query params, body.
        </p>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
          <label className="mb-1 block text-xs font-medium text-zinc-400">
            Bin name (optional)
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Stripe test"
            className="mb-3 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600"
          />
          <label className="mb-4 flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={redact}
              onChange={(e) => setRedact(e.target.checked)}
              className="accent-sky-500"
            />
            Redact sensitive headers (authorization, cookie, x-api-key)
          </label>
          <button
            type="button"
            onClick={createBin}
            disabled={creating}
            className="w-full rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create webhook bin"}
          </button>
          {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
        </div>

        {result && (
          <div className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950/40 p-5">
            <p className="mb-2 text-sm font-medium text-emerald-300">
              Your webhook URL — send requests here:
            </p>
            <div className="mb-3 flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-zinc-900 px-3 py-2 font-mono text-sm text-sky-300">
                {result.url}
              </code>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(result.url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="shrink-0 rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <Link
              href={`/b/${result.binId}`}
              className="text-sm font-medium text-sky-400 hover:underline"
            >
              Open the request inspector →
            </Link>
            <p className="mt-2 text-xs text-zinc-500">
              Save this link — the URL is the only key to this bin.
            </p>
          </div>
        )}

        {bins.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-zinc-300">
              Your bins
            </h2>
            <div className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-900/50">
              {bins.map((b) => (
                <Link
                  key={b.binId}
                  href={`/b/${b.binId}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800/40"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-zinc-200">
                      {b.name || "Webhook bin"}
                    </div>
                    <div className="truncate font-mono text-xs text-zinc-500">
                      /hook/{b.binId}
                    </div>
                  </div>
                  <div className="ml-4 shrink-0 text-right">
                    <div className="text-xs text-zinc-400">
                      {b.requestCount} requests
                    </div>
                    <div className="text-xs text-zinc-600">
                      {new Date(b.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
