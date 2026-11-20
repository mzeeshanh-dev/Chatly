import { expect, test } from "@playwright/test";

// Every public page should render without console errors or CSP violations.
for (const path of ["/", "/about", "/security", "/support", "/privacy", "/terms", "/register", "/forgot-password", "/login", "/admin/login"]) {
  test(`no console errors on ${path}`, async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
    page.on("pageerror", (e) => problems.push(e.message));
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await page.waitForTimeout(1500);
    // _vercel/insights only exists on Vercel hosting.
    expect(problems.filter((p) => !/_vercel\/insights|Failed to load resource/.test(p))).toEqual([]);
  });
}
