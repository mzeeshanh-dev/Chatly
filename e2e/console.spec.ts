import { expect, test } from "@playwright/test";

// Guards against CSP regressions: no console errors or CSP violations on key
// pages, and the FCM service worker must be allowed to evaluate.
test("no CSP violations or console errors on login and chat", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop run is sufficient for CSP checks.");
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

  await page.goto("/login?from=%2Fchat");
  await page.getByRole("button", { name: /guest_user@gmail.com/ }).click();
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/chat$/, { timeout: 30_000 });
  await page.waitForTimeout(4000);

  // _vercel/insights only exists on Vercel hosting, not on a local server.
  const ignorable = /Failed to load resource|net::ERR|notification|permission|_vercel\/insights/i;
  const sw = await page.request.get("/firebase-messaging-sw.js");
  expect(sw.headers()["content-security-policy"]).toContain("https://www.gstatic.com");
  // Headless Chromium reports notifications as denied, so the app never reaches
  // its own registration. Register the worker the same way the app does to prove
  // its script evaluates under our CSP (the regression was importScripts being blocked).
  const registered = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js?config=%7B%22projectId%22%3A%22x%22%2C%22appId%22%3A%221%3A1%3Aweb%3Aa%22%2C%22apiKey%22%3A%22k%22%2C%22messagingSenderId%22%3A%221%22%7D");
    await navigator.serviceWorker.ready;
    return Boolean(reg.active || reg.installing || reg.waiting);
  });
  expect(registered).toBe(true);

  expect(problems.filter((p) => !ignorable.test(p))).toEqual([]);
});
