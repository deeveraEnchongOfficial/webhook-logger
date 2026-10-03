/**
 * Client IP for rate limiting and logging. The leftmost x-forwarded-for
 * entry is attacker-supplied, so the rightmost hop (closest upstream peer)
 * is used. Behind a single trusted proxy that hop is the real client; with
 * no proxy it is the connector itself. x-real-ip is the fallback for
 * proxies that set it instead.
 */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const hops = fwd
      .split(",")
      .map((h) => h.trim())
      .filter((h) => h.length > 0);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return headers.get("x-real-ip") ?? "unknown";
}
