"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { RequestDetail, RequestSummary } from "@/lib/types";
import RequestDetailView from "./RequestDetail";
import RequestTable from "./RequestTable";

const METHODS = [
  "ALL",
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

interface ListResponse {
  bin: {
    binId: string;
    name?: string;
    requestCount: number;
    createdAt: string;
  };
  requests: RequestSummary[];
}

const noopSubscribe = () => () => {};

export default function Inspector({ binId }: { binId: string }) {
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => ""
  );
  const [data, setData] = useState<ListResponse | null>(null);
  const [older, setOlder] = useState<RequestSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const exhausted = useRef(false);
  const [notFound, setNotFound] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [detailStatus, setDetailStatus] = useState<
    "idle" | "loading" | "missing" | "error"
  >("idle");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const detailReq = useRef(0);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/bins/${binId}/requests?limit=200`);
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    if (res.ok) {
      const json: ListResponse = await res.json();
      setData(json);
      // A full page suggests older history may exist beyond it —
      // unless a previous paging pass already reached the end.
      if (json.requests.length === 200 && !exhausted.current) {
        setHasMore(true);
      }
    }
  }, [binId]);

  useEffect(() => {
    queueMicrotask(refresh);
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  const select = (id: string) => {
    setSelectedId(id);
    setDetailStatus("loading");
    const req = ++detailReq.current;
    fetch(`/api/bins/${binId}/requests/${id}`)
      .then((r) => (r.ok ? r.json() : r.status === 404 ? "missing" : "error"))
      .then((d) => {
        if (detailReq.current !== req) return;
        if (d === "missing" || d === "error") {
          setDetail(null);
          setDetailStatus(d);
        } else {
          setDetail(d);
          setDetailStatus("idle");
        }
      })
      .catch(() => {
        if (detailReq.current === req) {
          setDetail(null);
          setDetailStatus("error");
        }
      });
  };

  const deleteRequest = async (id: string) => {
    await fetch(`/api/bins/${binId}/requests/${id}`, { method: "DELETE" });
    if (id === selectedId) {
      setSelectedId(null);
      setDetail(null);
      setDetailStatus("idle");
    }
    refresh();
  };

  const clearBin = async () => {
    await fetch(`/api/bins/${binId}/requests`, { method: "DELETE" });
    setSelectedId(null);
    setDetail(null);
    setDetailStatus("idle");
    setOlder([]);
    exhausted.current = false;
    refresh();
  };

  const hookUrl = `${origin}/hook/${binId}`;

  const copyUrl = async () => {
    await navigator.clipboard.writeText(hookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (notFound) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-2 text-xl font-semibold">Bin not found</h1>
          <Link href="/" className="text-sm text-sky-400 hover:underline">
            Create a new bin
          </Link>
        </div>
      </main>
    );
  }

  const loadAllHistory = async () => {
    setLoadingOlder(true);
    try {
      const seen = new Set(older.map((r) => r.id));
      const pages: RequestSummary[] = [];
      let cursor = [...(data?.requests ?? []), ...older].at(-1)?.receivedAt;
      // Fetch every older page until the API returns a short one.
      for (;;) {
        if (!cursor) break;
        const res = await fetch(
          `/api/bins/${binId}/requests?limit=200&before=${encodeURIComponent(cursor)}`
        );
        if (!res.ok) break;
        const json: ListResponse = await res.json();
        const fresh = json.requests.filter((r) => !seen.has(r.id));
        for (const r of fresh) {
          seen.add(r.id);
          pages.push(r);
        }
        if (json.requests.length < 200) break;
        cursor = json.requests[json.requests.length - 1]?.receivedAt;
      }
      setOlder((prev) => [...prev, ...pages]);
      exhausted.current = true;
      setHasMore(false);
    } finally {
      setLoadingOlder(false);
    }
  };

  const merged = (() => {
    const seen = new Set<string>();
    return [...(data?.requests ?? []), ...older].filter((r) =>
      seen.has(r.id) ? false : (seen.add(r.id), true)
    );
  })();

  const filtered = merged.filter((r) => {
    if (methodFilter !== "ALL" && r.method !== methodFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.path.toLowerCase().includes(q) ||
        r.method.toLowerCase().includes(q) ||
        r.contentType.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <main className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-800 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold">
            {data?.bin.name || "Webhook bin"}
          </h1>
          <code className="rounded bg-zinc-900 px-2 py-1 font-mono text-xs text-sky-300">
            {hookUrl}
          </code>
          <button
            type="button"
            onClick={copyUrl}
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            {copied ? "Copied!" : "Copy URL"}
          </button>
          <span className="text-xs text-zinc-500">
            {data?.bin.requestCount ?? 0} captured
          </span>
          <button
            type="button"
            onClick={clearBin}
            className="ml-auto rounded border border-rose-800 px-2 py-1 text-xs text-rose-400 hover:bg-rose-950"
          >
            Clear bin
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search path, method, content type…"
            className="w-64 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600"
          />
        </div>
      </header>
      <div className="grid flex-1 grid-cols-1 md:grid-cols-2">
        <div className="overflow-y-auto border-b border-zinc-800 md:border-b-0 md:border-r">
          <RequestTable
            requests={filtered}
            selectedId={selectedId}
            onSelect={select}
          />
          {hasMore && !search && methodFilter === "ALL" && (
            <div className="p-3 text-center">
              <button
                type="button"
                onClick={loadAllHistory}
                disabled={loadingOlder}
                className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                {loadingOlder ? "Loading history…" : "Load all history"}
              </button>
            </div>
          )}
        </div>
        <div className="min-h-0">
          <RequestDetailView
            detail={detail}
            status={detailStatus}
            onDelete={deleteRequest}
          />
        </div>
      </div>
    </main>
  );
}
