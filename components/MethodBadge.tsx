const COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-400",
  POST: "bg-sky-500/15 text-sky-400",
  PUT: "bg-amber-500/15 text-amber-400",
  PATCH: "bg-violet-500/15 text-violet-400",
  DELETE: "bg-rose-500/15 text-rose-400",
  HEAD: "bg-zinc-500/15 text-zinc-400",
  OPTIONS: "bg-zinc-500/15 text-zinc-400",
};

export default function MethodBadge({ method }: { method: string }) {
  const color = COLORS[method.toUpperCase()] ?? "bg-zinc-500/15 text-zinc-400";
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${color}`}
    >
      {method}
    </span>
  );
}
