import { describe, expect, it } from "vitest";
import { ApiError, asEmail, asOtp, asString, escapeHtml, readJson } from "@/lib/server/http";

const req = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api", { method: "POST", body, headers });

describe("validators", () => {
  it("normalises valid emails and rejects bad ones", () => {
    expect(asEmail("  User@Example.COM ")).toBe("user@example.com");
    expect(() => asEmail("nope")).toThrow(ApiError);
    expect(() => asEmail(42)).toThrow(ApiError);
    expect(() => asEmail("<a>@b.co")).toThrow(ApiError);
  });

  it("enforces string length bounds", () => {
    expect(asString(" abc ", "Name", { min: 2, max: 5 })).toBe("abc");
    expect(() => asString("a", "Name", { min: 2 })).toThrow(ApiError);
    expect(() => asString("x".repeat(10), "Name", { max: 5 })).toThrow(ApiError);
  });

  it("accepts only 6-digit OTPs", () => {
    expect(asOtp("123456")).toBe("123456");
    for (const bad of ["12345", "1234567", "abcdef", 123456, "12 456"]) {
      expect(() => asOtp(bad)).toThrow(ApiError);
    }
  });

  it("escapes HTML", () => {
    expect(escapeHtml(`<img src=x onerror="a">&'`)).toBe("&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;");
  });
});

describe("readJson", () => {
  it("parses objects", async () => {
    expect(await readJson(req('{"a":1}'))).toEqual({ a: 1 });
  });

  it("rejects malformed, non-object and oversized bodies", async () => {
    await expect(readJson(req("{bad"))).rejects.toMatchObject({ status: 400 });
    await expect(readJson(req("[1]"))).rejects.toMatchObject({ status: 400 });
    await expect(readJson(req("null"))).rejects.toMatchObject({ status: 400 });
    await expect(readJson(req(JSON.stringify({ a: "x".repeat(100) })), 50)).rejects.toMatchObject({ status: 413 });
  });
});
