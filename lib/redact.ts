export const SENSITIVE_HEADERS = [
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
] as const;

const SENSITIVE_SET = new Set<string>(SENSITIVE_HEADERS);
export const REDACTED = "[redacted]";

export function redactHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    out[name] = SENSITIVE_SET.has(name.toLowerCase()) ? REDACTED : value;
  }
  return out;
}
