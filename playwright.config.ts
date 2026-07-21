import { defineConfig } from "@playwright/test";

// Smoke suite against a production build with placeholder Supabase env
// vars - covers "the app builds, boots, serves its PWA assets and
// gates unauthenticated visitors", not logged-in flows (those would
// need a seeded database).
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:3111",
    // Sandboxed dev environments ship a system chromium instead of
    // letting Playwright download its own matching build - point at it
    // via env var there; CI/local installs use the default resolution.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : undefined,
  },
  webServer: {
    command: "npm run start -- -p 3111",
    url: "http://127.0.0.1:3111/login",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder",
    },
  },
});
