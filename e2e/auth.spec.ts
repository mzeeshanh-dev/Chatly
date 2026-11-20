import { expect, test, type Page } from "@playwright/test";

// Uses the public demo guest accounts shown on /login (shared, evaluation-only).
const GUEST = "guest_user@gmail.com";

async function signInAsGuest(page: Page, url: string) {
  await page.goto(url);
  await page.getByRole("button", { name: new RegExp(GUEST) }).click();
  await expect(page.getByLabel("Email Address")).toHaveValue(GUEST);
  await page.getByRole("button", { name: "Sign In" }).click();
}

test("anonymous /chat redirects to login and keeps the destination", async ({ page }) => {
  await page.goto("/chat");
  await expect(page).toHaveURL(/\/login\?from=%2Fchat$/);
});

test("guest login from /login?from=/chat lands on /chat", async ({ page }) => {
  await signInAsGuest(page, "/login?from=%2Fchat");
  await expect(page).toHaveURL(/\/chat$/, { timeout: 30_000 });
  await expect(page.getByText("Select a conversation").or(page.getByText("Messages")).first()).toBeVisible({
    timeout: 30_000,
  });
});

test("session persists across reload and /login skips the form when signed in", async ({ page }) => {
  await signInAsGuest(page, "/login?from=%2Fchat");
  await expect(page).toHaveURL(/\/chat$/, { timeout: 30_000 });

  await page.reload();
  await expect(page).toHaveURL(/\/chat$/);

  await page.goto("/login");
  await expect(page).toHaveURL(/\/chat$/, { timeout: 30_000 });
});

test("external redirect targets are ignored", async ({ page }) => {
  await signInAsGuest(page, "/login?from=https%3A%2F%2Fevil.example%2Fphish");
  await expect(page).toHaveURL(/localhost:\d+\/chat$/, { timeout: 30_000 });
});

test("logout clears the session and protects /chat again", async ({ page, isMobile }) => {
  test.skip(isMobile, "Sign out lives in the desktop sidebar; covered on desktop.");
  await signInAsGuest(page, "/login?from=%2Fchat");
  await expect(page).toHaveURL(/\/chat$/, { timeout: 30_000 });

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });

  await page.goto("/chat");
  await expect(page).toHaveURL(/\/login\?from=%2Fchat$/);
});

test("wrong password shows an error and stays on login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email Address").fill(GUEST);
  await page.getByLabel("Password", { exact: true }).fill("definitely-wrong");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Invalid email or password");
  await expect(page).toHaveURL(/\/login$/);
});
