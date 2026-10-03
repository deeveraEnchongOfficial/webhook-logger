import { describe, expect, it } from "vitest";
import { redactHeaders, SENSITIVE_HEADERS } from "./redact";

describe("redactHeaders", () => {
  it("masks sensitive headers case-insensitively", () => {
    const out = redactHeaders({
      Authorization: "Bearer secret",
      COOKIE: "session=abc",
      "X-Api-Key": "key123",
      "X-Custom": "visible",
    });
    expect(out.Authorization).toBe("[redacted]");
    expect(out.COOKIE).toBe("[redacted]");
    expect(out["X-Api-Key"]).toBe("[redacted]");
    expect(out["X-Custom"]).toBe("visible");
  });

  it("covers the documented sensitive header list", () => {
    for (const name of ["authorization", "cookie", "x-api-key"]) {
      expect(SENSITIVE_HEADERS).toContain(name);
    }
  });
});
