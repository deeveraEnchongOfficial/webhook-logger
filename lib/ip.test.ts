import { describe, expect, it } from "vitest";
import { clientIp } from "./ip";

describe("clientIp", () => {
  it("takes the rightmost x-forwarded-for hop", () => {
    const h = new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" });
    expect(clientIp(h)).toBe("3.3.3.3");
  });

  it("uses a single x-forwarded-for value", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9" }))).toBe("9.9.9.9");
  });

  it("skips empty trailing hops", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1, , " }))).toBe("1.1.1.1");
  });

  it("falls back to x-real-ip then unknown", () => {
    expect(clientIp(new Headers({ "x-real-ip": "5.5.5.5" }))).toBe("5.5.5.5");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
