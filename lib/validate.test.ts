import { describe, expect, it } from "vitest";
import { isValidBinId, isValidRequestId } from "./validate";

describe("isValidBinId", () => {
  it("accepts a 32-char hex token", () => {
    expect(isValidBinId("a".repeat(32))).toBe(true);
    expect(isValidBinId("0123456789abcdef0123456789abcdef")).toBe(true);
  });

  it("rejects wrong lengths", () => {
    expect(isValidBinId("a".repeat(31))).toBe(false);
    expect(isValidBinId("a".repeat(33))).toBe(false);
    expect(isValidBinId("")).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(isValidBinId("g".repeat(32))).toBe(false);
    expect(isValidBinId("A".repeat(32))).toBe(false);
  });

  it("rejects mongo operator injection shapes", () => {
    expect(isValidBinId('{"$gt":""}')).toBe(false);
    expect(isValidBinId("a".repeat(32) + ".$where")).toBe(false);
  });
});

describe("isValidRequestId", () => {
  it("accepts a 24-char hex ObjectId", () => {
    expect(isValidRequestId("b".repeat(24))).toBe(true);
  });

  it("rejects malformed ids", () => {
    expect(isValidRequestId("b".repeat(23))).toBe(false);
    expect(isValidRequestId("z".repeat(24))).toBe(false);
  });
});
