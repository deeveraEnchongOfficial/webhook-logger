import { describe, expect, it } from "vitest";
import { RateLimiter } from "./ratelimit";

describe("RateLimiter", () => {
  it("allows up to the per-minute limit then denies", () => {
    const rl = new RateLimiter(3);
    const t = 1_000_000;
    expect(rl.allow("ip1", t)).toBe(true);
    expect(rl.allow("ip1", t + 1)).toBe(true);
    expect(rl.allow("ip1", t + 2)).toBe(true);
    expect(rl.allow("ip1", t + 3)).toBe(false);
  });

  it("refills tokens as time passes", () => {
    const rl = new RateLimiter(2);
    const t = 1_000_000;
    rl.allow("ip1", t);
    rl.allow("ip1", t);
    expect(rl.allow("ip1", t + 100)).toBe(false);
    // after 30s of a 60s window at 2/min, one token refilled
    expect(rl.allow("ip1", t + 30_000)).toBe(true);
  });

  it("tracks keys independently", () => {
    const rl = new RateLimiter(1);
    const t = 1_000_000;
    expect(rl.allow("a", t)).toBe(true);
    expect(rl.allow("a", t)).toBe(false);
    expect(rl.allow("b", t)).toBe(true);
  });

  it("evicts stale entries", () => {
    const rl = new RateLimiter(1);
    rl.allow("old", 0);
    rl.allow("new", 10 * 60_000);
    expect(rl.size).toBe(1);
  });
});
