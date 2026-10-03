import type { RequestDetail } from "./types";

const SKIP_HEADERS = new Set([
  "host",
  "content-length",
  "connection",
  "transfer-encoding",
  "accept-encoding",
]);

function shq(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function queryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const v of Array.isArray(value) ? value : [value]) {
      params.append(key, String(v));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function buildCurl(detail: RequestDetail, origin: string): string {
  const url = `${origin}${detail.path}${queryString(detail.query)}`;
  const parts = [`curl -X ${detail.method} ${shq(url)}`];

  for (const [name, value] of Object.entries(detail.headers)) {
    if (SKIP_HEADERS.has(name.toLowerCase())) continue;
    parts.push(`-H ${shq(`${name}: ${value}`)}`);
  }

  if (detail.bodyRaw) {
    if (detail.bodyEncoding === "base64") {
      parts.push(
        `--data-binary "$(echo ${shq(detail.bodyRaw)} | base64 -d)"`
      );
    } else {
      parts.push(`--data-raw ${shq(detail.bodyRaw)}`);
    }
  }
  return parts.join(" \\\n  ");
}
