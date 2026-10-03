const MAX_SANITIZE_DEPTH = 64;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Escape a key so it can be stored in MongoDB while staying readable:
 * "." -> fullwidth dot, leading "$" -> fullwidth dollar, and prototype-
 * polluting keys get a fullwidth underscore prefix. Legal HTTP names are
 * preserved instead of silently dropped (unlike sanitizeForMongo).
 */
export function escapeKeyForMongo(key: string): string {
  if (FORBIDDEN_KEYS.has(key)) return "＿" + key;
  let out = key;
  if (out.startsWith("$")) out = "＄" + out.slice(1);
  return out.replace(/\./g, "．");
}

/**
 * True when an object tree contains a key MongoDB forbids
 * ("$" prefix, ".", or prototype-polluting names).
 */
export function hasIllegalMongoKey(value: unknown, depth = 0): boolean {
  if (depth >= MAX_SANITIZE_DEPTH || value === null || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((v) => hasIllegalMongoKey(v, depth + 1));
  }
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith("$") || key.includes(".") || FORBIDDEN_KEYS.has(key)) {
      return true;
    }
    if (hasIllegalMongoKey(v, depth + 1)) return true;
  }
  return false;
}

/**
 * Recursively strip keys MongoDB forbids or that enable injection:
 * keys starting with "$", keys containing ".", and prototype-polluting keys.
 */
export function sanitizeForMongo(value: unknown, depth = 0): unknown {
  if (depth >= MAX_SANITIZE_DEPTH) return null;
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeForMongo(v, depth + 1));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith("$") || key.includes(".") || FORBIDDEN_KEYS.has(key)) {
        continue;
      }
      out[key] = sanitizeForMongo(v, depth + 1);
    }
    return out;
  }
  return value;
}

export function truncateForStore(
  text: string,
  limitBytes: number
): { text: string; truncated: boolean } {
  if (Buffer.byteLength(text, "utf8") <= limitBytes) {
    return { text, truncated: false };
  }
  return {
    text: Buffer.from(text, "utf8").subarray(0, limitBytes).toString("utf8"),
    truncated: true,
  };
}

export interface LimitedBody {
  bytes: Buffer;
  truncated: boolean;
  sizeBytes: number;
}

export async function readLimitedBody(
  stream: ReadableStream<Uint8Array>,
  limitBytes: number,
  timeoutMs: number
): Promise<LimitedBody> {
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  let truncated = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Body read timeout after ${timeoutMs}ms`));
      reader.cancel().catch(() => {});
    }, timeoutMs);
  });

  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      if (!value || value.length === 0) continue;
      const remaining = limitBytes - size;
      if (value.length > remaining) {
        chunks.push(Buffer.from(value.subarray(0, remaining)));
        size = limitBytes;
        truncated = true;
        await reader.cancel().catch(() => {});
        break;
      }
      chunks.push(Buffer.from(value));
      size += value.length;
      if (size === limitBytes) {
        // Check whether the stream has more data; if so it's truncated.
        const next = await Promise.race([reader.read(), timeout]);
        if (!next.done) {
          truncated = true;
          await reader.cancel().catch(() => {});
        }
        break;
      }
    }
  } finally {
    if (timer) clearTimeout(timer);
  }

  return { bytes: Buffer.concat(chunks), truncated, sizeBytes: size };
}

export function isTextContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const base = contentType.split(";")[0].trim().toLowerCase();
  if (base.startsWith("text/")) return true;
  if (base.endsWith("+json") || base.endsWith("+xml")) return true;
  return [
    "application/json",
    "application/xml",
    "application/javascript",
    "application/x-javascript",
    "application/x-www-form-urlencoded",
    "multipart/form-data",
    "application/graphql",
    "application/x-ndjson",
  ].includes(base);
}

export interface ParsedBody {
  bodyRaw: string;
  bodyJson?: unknown;
  encoding: "utf8" | "base64";
}

export async function parseCapturedBody(
  contentType: string | null,
  bytes: Buffer
): Promise<ParsedBody> {
  if (!isTextContentType(contentType)) {
    return { bodyRaw: bytes.toString("base64"), encoding: "base64" };
  }

  const raw = bytes.toString("utf8");
  const base = (contentType ?? "").split(";")[0].trim().toLowerCase();
  const result: ParsedBody = { bodyRaw: raw, encoding: "utf8" };
  if (bytes.length === 0) return result;

  if (base === "application/json" || base.endsWith("+json")) {
    try {
      result.bodyJson = sanitizeForMongo(JSON.parse(raw));
    } catch {
      // invalid JSON: keep bodyRaw only
    }
  } else if (base === "application/x-www-form-urlencoded") {
    result.bodyJson = sanitizeForMongo(paramsToObject(new URLSearchParams(raw)));
  } else if (base === "multipart/form-data") {
    try {
      const synthetic = new Request("http://capture.local", {
        method: "POST",
        headers: { "content-type": contentType ?? "" },
        body: new Uint8Array(bytes),
      });
      const form = await synthetic.formData();
      const fields: Record<string, unknown> = {};
      for (const [name, value] of form.entries()) {
        const entry =
          typeof value === "string"
            ? value
            : { filename: value.name, size: value.size, type: value.type };
        const existing = fields[name];
        fields[name] =
          existing === undefined
            ? entry
            : Array.isArray(existing)
              ? [...existing, entry]
              : [existing, entry];
      }
      result.bodyJson = sanitizeForMongo(fields);
    } catch {
      // malformed multipart: keep bodyRaw only
    }
  }
  return result;
}

export function paramsToObject(
  params: URLSearchParams
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of params.entries()) {
    const key = escapeKeyForMongo(rawKey);
    const existing = out[key];
    out[key] =
      existing === undefined
        ? value
        : Array.isArray(existing)
          ? [...existing, value]
          : [existing, value];
  }
  return out;
}
