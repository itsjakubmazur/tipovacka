import { expect, test } from "@playwright/test";

test("login page renders both auth modes", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Přihlášení" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrace" })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Heslo")).toBeVisible();
});

test("registration mode requires an invite code", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Registrace" }).click();
  await expect(page.getByLabel("Zvací kód")).toBeVisible();
  await expect(page.getByLabel("Zvací kód")).toHaveAttribute("required", "");
});

test("unauthenticated visitor is redirected to login", async ({ page }) => {
  for (const path of ["/leaderboard", "/profile", "/wrapped"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
});

test("PWA manifest is served and sane", async ({ request }) => {
  const resp = await request.get("/manifest.webmanifest");
  expect(resp.ok()).toBeTruthy();
  const manifest = await resp.json();
  expect(manifest.name).toContain("OKTAGON");
});

test("service worker script is served", async ({ request }) => {
  const resp = await request.get("/sw.js");
  expect(resp.ok()).toBeTruthy();
  expect(resp.headers()["content-type"]).toContain("javascript");
});

test("no console errors on the login page", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});
