import { describe, expect, it } from "vitest";
import { getSafeRedirectPath } from "@/lib/safe-redirect";

describe("getSafeRedirectPath", () => {
  it("accepts internal chat paths", () => {
    expect(getSafeRedirectPath("/chat")).toBe("/chat");
    expect(getSafeRedirectPath("%2Fchat")).toBe("/chat");
    expect(getSafeRedirectPath("/chat/room?x=1")).toBe("/chat/room?x=1");
  });

  it("defaults to /chat when missing or empty", () => {
    expect(getSafeRedirectPath(null)).toBe("/chat");
    expect(getSafeRedirectPath(undefined)).toBe("/chat");
    expect(getSafeRedirectPath("")).toBe("/chat");
  });

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\evil.com",
    "%2F%2Fevil.com",
    "javascript:alert(1)",
    "/chat\r\nSet-Cookie: a=b",
    "/login",
    "/chatter",
    "/admin/dashboard",
    "%E0%A4%A",
  ])("rejects unsafe or non-allow-listed target %s", (input) => {
    expect(getSafeRedirectPath(input)).toBe("/chat");
  });

  it("rejects oversized values", () => {
    expect(getSafeRedirectPath("/chat/" + "a".repeat(600))).toBe("/chat");
  });
});
