function renderValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function KeyValueTable({
  data,
  emptyText = "None",
}: {
  data: Record<string, unknown>;
  emptyText?: string;
}) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <p className="text-sm text-zinc-500">{emptyText}</p>;
  }
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {entries.map(([key, value]) => (
          <tr key={key} className="border-b border-zinc-800 align-top">
            <td className="w-1/3 break-all py-1.5 pr-3 font-mono text-zinc-400">
              {key}
            </td>
            <td className="break-all py-1.5 font-mono text-zinc-200">
              {renderValue(value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
