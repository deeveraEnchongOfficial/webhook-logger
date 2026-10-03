import { describe, expect, it } from "vitest";
import { readConfig } from "./env";

describe("readConfig", () => {
  it("returns defaults when env is empty", () => {
    const c = readConfig({});
    expect(c.mongodbUri).toBe("mongodb://localhost:27017");
    expect(c.mongodbDb).toBe("webhook_logger");
    expect(c.bodyLimitBytes).toBe(1048576);
    expect(c.storeLimitBytes).toBe(262144);
    expect(c.rateLimitPerMin).toBe(120);
    expect(c.retentionDays).toBe(7);
    expect(c.maxRequestsPerBin).toBe(1000);
    expect(c.bodyReadTimeoutMs).toBe(10000);
  });

  it("parses numeric overrides", () => {
    const c = readConfig({
      MONGODB_URI: "mongodb://example:27017",
      BODY_LIMIT_BYTES: "2048",
      RETENTION_DAYS: "30",
    });
    expect(c.mongodbUri).toBe("mongodb://example:27017");
    expect(c.bodyLimitBytes).toBe(2048);
    expect(c.retentionDays).toBe(30);
  });

  it("falls back to defaults on non-numeric values", () => {
    const c = readConfig({ BODY_LIMIT_BYTES: "huge", RATE_LIMIT_PER_MIN: "" });
    expect(c.bodyLimitBytes).toBe(1048576);
    expect(c.rateLimitPerMin).toBe(120);
  });
});

describe("binTtlDays", () => {
  it("defaults to 30 and parses overrides", () => {
    expect(readConfig({}).binTtlDays).toBe(30);
    expect(readConfig({ BIN_TTL_DAYS: "90" }).binTtlDays).toBe(90);
    expect(readConfig({ BIN_TTL_DAYS: "x" }).binTtlDays).toBe(30);
  });
});
