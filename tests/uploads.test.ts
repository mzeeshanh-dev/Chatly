import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", () => ({ adminDb: {}, adminAuth: {} }));

import { parseAvatarPublicId } from "@/lib/server/uploads";

describe("parseAvatarPublicId", () => {
  it("accepts avatar folders only", () => {
    expect(parseAvatarPublicId("Chatly/profiles/abc123")).toEqual({ kind: "profile", id: "abc123" });
    expect(parseAvatarPublicId("chatly/groups/g_1")).toEqual({ kind: "group", id: "g_1" });
  });

  it.each([
    "Chatly/chat-media/abc/file",
    "Chatly/profiles/../groups/x",
    "Chatly/profiles/a/b",
    "other/profiles/abc",
    "",
  ])("rejects %s", (id) => {
    expect(() => parseAvatarPublicId(id)).toThrow();
  });
});
