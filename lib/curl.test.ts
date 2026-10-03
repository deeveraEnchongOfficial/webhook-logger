import { describe, expect, it } from "vitest";
import { buildCurl } from "./curl";
import type { RequestDetail } from "./types";

const base: RequestDetail = {
  id: "a".repeat(24),
  method: "POST",
  path: "/hook/" + "b".repeat(32),
  query: {},
  headers: {},
  ip: "1.2.3.4",
  userAgent: "test",
  contentType: "",
  bodyEncoding: "utf8",
  bodyTruncated: false,
  sizeBytes: 0,
  receivedAt: "2026-01-01T00:00:00.000Z",
  durationMs: 1,
  responseStatus: 200,
};

describe("buildCurl", () => {
  it("builds a basic request with headers and query params", () => {
    const cmd = buildCurl(
      {
        ...base,
        query: { x: ["1", "2"], y: "z" },
        headers: { "content-type": "application/json", "x-token": "abc" },
        bodyRaw: '{"a":1}',
      },
      "https://example.com"
    );
    expect(cmd).toContain("curl -X POST");
    expect(cmd).toContain("'https://example.com/hook/");
    expect(cmd).toContain("x=1");
    expect(cmd).toContain("x=2");
    expect(cmd).toContain("y=z");
    expect(cmd).toContain("-H 'content-type: application/json'");
    expect(cmd).toContain("-H 'x-token: abc'");
    expect(cmd).toContain("--data-raw '{\"a\":1}'");
  });

  it("omits hop-by-hop and auto headers", () => {
    const cmd = buildCurl(
      {
        ...base,
        method: "GET",
        headers: { host: "x", "content-length": "9", connection: "keep-alive", accept: "*/*" },
      },
      "https://example.com"
    );
    expect(cmd).not.toContain("host:");
    expect(cmd).not.toContain("content-length:");
    expect(cmd).not.toContain("connection:");
    expect(cmd).toContain("-H 'accept: */*'");
  });

  it("escapes single quotes in shell args", () => {
    const cmd = buildCurl(
      { ...base, bodyRaw: "it's", headers: {} },
      "https://example.com"
    );
    expect(cmd).toContain("--data-raw 'it'\\''s'");
  });

  it("emits a base64 decode pipeline for binary bodies", () => {
    const cmd = buildCurl(
      { ...base, bodyEncoding: "base64", bodyRaw: "AAE=" },
      "https://example.com"
    );
    expect(cmd).toContain("base64");
    expect(cmd).toContain("--data-binary");
  });
});
