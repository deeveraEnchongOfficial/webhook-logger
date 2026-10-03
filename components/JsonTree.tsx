"use client";

import { useState } from "react";

function Primitive({ value }: { value: unknown }) {
  if (value === null) return <span className="text-zinc-500">null</span>;
  if (typeof value === "string")
    return <span className="text-emerald-300">&quot;{value}&quot;</span>;
  if (typeof value === "number")
    return <span className="text-sky-300">{String(value)}</span>;
  if (typeof value === "boolean")
    return <span className="text-amber-300">{String(value)}</span>;
  return <span className="text-zinc-300">{String(value)}</span>;
}

function Node({
  name,
  value,
  depth,
}: {
  name?: string;
  value: unknown;
  depth: number;
}) {
  const [open, setOpen] = useState(depth < 2);
  const isObj = value !== null && typeof value === "object";
  const entries = isObj
    ? Array.isArray(value)
      ? value.map((v, i) => [String(i), v] as const)
      : Object.entries(value as Record<string, unknown>)
    : [];

  const label = name !== undefined && (
    <span className="text-zinc-400">{name}: </span>
  );

  if (!isObj) {
    return (
      <div className="font-mono text-sm leading-6">
        {label}
        <Primitive value={value} />
      </div>
    );
  }

  const isArray = Array.isArray(value);
  return (
    <div className="font-mono text-sm leading-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer select-none text-left"
      >
        <span className="mr-1 inline-block w-3 text-zinc-500">
          {open ? "▾" : "▸"}
        </span>
        {label}
        <span className="text-zinc-500">
          {isArray ? `[${entries.length}]` : `{${entries.length}}`}
        </span>
      </button>
      {open && (
        <div className="ml-4 border-l border-zinc-800 pl-3">
          {entries.map(([k, v]) => (
            <Node key={k} name={k} value={v} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function JsonTree({ data }: { data: unknown }) {
  if (data === undefined || data === null) {
    return <p className="text-sm text-zinc-500">No parsed body.</p>;
  }
  return (
    <div className="overflow-auto p-1">
      <Node value={data} depth={0} />
    </div>
  );
}
