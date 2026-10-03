import { describe, expect, it } from "vitest";
import {
  isTextContentType,
  parseCapturedBody,
  readLimitedBody,
  sanitizeForMongo,
  truncateForStore,
} from "./capture";

describe("sanitizeForMongo", () => {
  it("strips keys starting with $ or containing .", () => {
    const input = {
      safe: 1,
      $where: "evil",
      "a.b": "evil",
      nested: { $gt: "", ok: true, deep: { "x.y": 1, keep: 2 } },
    };
    expect(sanitizeForMongo(input)).toEqual({
      safe: 1,
      nested: { ok: true, deep: { keep: 2 } },
    });
  });

  it("sanitizes objects inside arrays", () => {
    const input = { list: [{ $bad: 1, good: 2 }] };
    expect(sanitizeForMongo(input)).toEqual({ list: [{ good: 2 }] });
  });

  it("passes through primitives and arrays", () => {
    expect(sanitizeForMongo("str")).toBe("str");
    expect(sanitizeForMongo([1, "a", null])).toEqual([1, "a", null]);
  });

  it("truncates extremely deep nesting", () => {
    let obj: Record<string, unknown> = { leaf: true };
    for (let i = 0; i < 200; i++) obj = { next: obj };
    const out = sanitizeForMongo(obj) as Record<string, unknown>;
    let depth = 0;
    let cur: unknown = out;
    while (cur && typeof cur === "object" && "next" in (cur as object)) {
      depth++;
      cur = (cur as Record<string, unknown>).next;
    }
    expect(depth).toBeLessThanOrEqual(64);
  });
});

describe("truncateForStore", () => {
  it("returns text unchanged under the limit", () => {
    expect(truncateForStore("hello", 100)).toEqual({ text: "hello", truncated: false });
  });

  it("truncates by byte length, not char count", () => {
    const text = "é".repeat(100); // 200 bytes in utf-8
    const { text: out, truncated } = truncateForStore(text, 100);
    expect(truncated).toBe(true);
    expect(Buffer.byteLength(out, "utf8")).toBeLessThanOrEqual(100);
  });
});

describe("readLimitedBody", () => {
  function streamOf(...chunks: string[]) {
    return new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(new TextEncoder().encode(c));
        controller.close();
      },
    });
  }

  it("reads a full body under the limit", async () => {
    const r = await readLimitedBody(streamOf("hello ", "world"), 100, 1000);
    expect(r.truncated).toBe(false);
    expect(Buffer.from(r.bytes).toString()).toBe("hello world");
    expect(r.sizeBytes).toBe(11);
  });

  it("stops reading at the limit and flags truncation", async () => {
    const r = await readLimitedBody(streamOf("a".repeat(50), "b".repeat(50)), 60, 1000);
    expect(r.truncated).toBe(true);
    expect(r.sizeBytes).toBe(60);
    expect(r.bytes.length).toBe(60);
  });

  it("times out on a stalled body", async () => {
    const stalled = new ReadableStream<Uint8Array>({ start() {} });
    await expect(readLimitedBody(stalled, 100, 50)).rejects.toThrow(/timeout/i);
  });
});

describe("isTextContentType", () => {
  it("treats json, form and text types as text", () => {
    expect(isTextContentType("application/json")).toBe(true);
    expect(isTextContentType("application/x-www-form-urlencoded")).toBe(true);
    expect(isTextContentType("text/plain; charset=utf-8")).toBe(true);
    expect(isTextContentType("multipart/form-data; boundary=x")).toBe(true);
    expect(isTextContentType("application/xml")).toBe(true);
  });

  it("treats binary types as non-text", () => {
    expect(isTextContentType("application/octet-stream")).toBe(false);
    expect(isTextContentType("image/png")).toBe(false);
    expect(isTextContentType(null)).toBe(false);
  });
});

describe("parseCapturedBody", () => {
  it("parses JSON bodies into bodyJson", async () => {
    const r = await parseCapturedBody("application/json", Buffer.from('{"a":1,"$evil":2}'));
    expect(r.bodyJson).toEqual({ a: 1 });
    expect(r.encoding).toBe("utf8");
  });

  it("leaves bodyJson undefined for invalid JSON", async () => {
    const r = await parseCapturedBody("application/json", Buffer.from("{nope"));
    expect(r.bodyJson).toBeUndefined();
    expect(r.bodyRaw).toBe("{nope");
  });

  it("parses urlencoded forms into key/value bodyJson", async () => {
    const r = await parseCapturedBody(
      "application/x-www-form-urlencoded",
      Buffer.from("a=1&b=two&a=again")
    );
    expect(r.bodyJson).toEqual({ a: ["1", "again"], b: "two" });
  });

  it("parses multipart text fields and lists files as metadata", async () => {
    const boundary = "----testboundary";
    const payload =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="field1"\r\n\r\n` +
      `value1\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="upload"; filename="a.txt"\r\n` +
      `Content-Type: text/plain\r\n\r\n` +
      `filecontents\r\n` +
      `--${boundary}--\r\n`;
    const r = await parseCapturedBody(
      `multipart/form-data; boundary=${boundary}`,
      Buffer.from(payload)
    );
    expect(r.bodyJson).toMatchObject({ field1: "value1" });
    const upload = (r.bodyJson as Record<string, unknown>).upload as {
      filename: string;
      size: number;
    };
    expect(upload.filename).toBe("a.txt");
    expect(upload.size).toBe(12);
  });

  it("base64-encodes binary bodies", async () => {
    const r = await parseCapturedBody("application/octet-stream", Buffer.from([0x00, 0x01, 0xff]));
    expect(r.encoding).toBe("base64");
    expect(r.bodyRaw).toBe(Buffer.from([0x00, 0x01, 0xff]).toString("base64"));
    expect(r.bodyJson).toBeUndefined();
  });
});

describe("escapeKeyForMongo", () => {
  it("escapes dots and leading dollars while preserving readability", async () => {
    const { escapeKeyForMongo } = await import("./capture");
    expect(escapeKeyForMongo("a.b")).toBe("a．b");
    expect(escapeKeyForMongo("$gt")).toBe("＄gt");
    expect(escapeKeyForMongo("a$b")).toBe("a$b");
    expect(escapeKeyForMongo("ok")).toBe("ok");
  });

  it("escapes prototype-polluting keys", async () => {
    const { escapeKeyForMongo } = await import("./capture");
    expect(escapeKeyForMongo("__proto__")).not.toBe("__proto__");
    expect(escapeKeyForMongo("constructor")).not.toBe("constructor");
    expect(escapeKeyForMongo("prototype")).not.toBe("prototype");
  });
});

describe("paramsToObject sanitization", () => {
  it("preserves dotted/dollar keys in escaped form and never mutates prototype", async () => {
    const { paramsToObject } = await import("./capture");
    const out = paramsToObject(new URLSearchParams("a.b=1&$x=2&__proto__=3&ok=4"));
    expect(Object.keys(out)).not.toContain("a.b");
    expect(Object.keys(out)).not.toContain("$x");
    expect(Object.keys(out)).not.toContain("__proto__");
    expect(out["a．b"]).toBe("1");
    expect(out["＄x"]).toBe("2");
    expect(out["ok"]).toBe("4");
    expect(Object.keys(out).length).toBe(4);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("hasIllegalMongoKey", () => {
  it("detects illegal keys at any depth", async () => {
    const { hasIllegalMongoKey } = await import("./capture");
    expect(hasIllegalMongoKey({ a: 1, b: { c: 2 } })).toBe(false);
    expect(hasIllegalMongoKey({ "a.b": 1 })).toBe(true);
    expect(hasIllegalMongoKey({ $gt: 1 })).toBe(true);
    expect(hasIllegalMongoKey({ ok: { "x.y": 1 } })).toBe(true);
    expect(hasIllegalMongoKey({ ok: [{ $bad: 1 }] })).toBe(true);
    expect(hasIllegalMongoKey(JSON.parse('{"__proto__":{}}'))).toBe(true);
    expect(hasIllegalMongoKey("str")).toBe(false);
    expect(hasIllegalMongoKey(null)).toBe(false);
    expect(hasIllegalMongoKey([1, 2])).toBe(false);
  });
});
