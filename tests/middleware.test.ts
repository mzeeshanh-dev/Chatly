import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

const call = (path: string, cookie?: string) =>
  middleware(
    new NextRequest(`http://localhost${path}`, { headers: cookie ? { cookie } : {} })
  );

describe("route guard", () => {
  it("redirects anonymous users from /chat to /login preserving the destination", () => {
    const res = call("/chat");
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("from")).toBe("/chat");
  });

  it("lets users with a session cookie through, uncached", () => {
    const res = call("/chat", "chatly_session=abc");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("does not treat lookalike paths as protected", () => {
    expect(call("/chatter").status).toBe(200);
  });

  it("protects admin routes", () => {
    const res = call("/admin/dashboard");
    expect(new URL(res.headers.get("location")!).pathname).toBe("/admin/login");
  });
});
