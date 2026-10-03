"use client";

import type { RequestSummary } from "@/lib/types";
import MethodBadge from "./MethodBadge";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RequestTable({
  requests,
  selectedId,
  onSelect,
}: {
  requests: RequestSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (requests.length === 0) {
    return (
      <p className="p-4 text-sm text-zinc-500">
        No requests yet. Send one to the webhook URL above.
      </p>
    );
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
          <th className="px-3 py-2 font-medium">Method</th>
          <th className="px-3 py-2 font-medium">Path</th>
          <th className="px-3 py-2 font-medium">Time</th>
          <th className="px-3 py-2 text-right font-medium">Size</th>
        </tr>
      </thead>
      <tbody>
        {requests.map((r) => (
          <tr
            key={r.id}
            onClick={() => onSelect(r.id)}
            className={`cursor-pointer border-b border-zinc-800/60 ${
              r.id === selectedId
                ? "bg-sky-500/10"
                : "hover:bg-zinc-800/40"
            }`}
          >
            <td className="px-3 py-2">
              <MethodBadge method={r.method} />
            </td>
            <td className="max-w-0 truncate px-3 py-2 font-mono text-zinc-300">
              {r.path}
            </td>
            <td className="whitespace-nowrap px-3 py-2 text-zinc-400">
              {new Date(r.receivedAt).toLocaleTimeString()}
            </td>
            <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-400">
              {formatSize(r.sizeBytes)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
