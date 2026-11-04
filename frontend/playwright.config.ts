import { defineConfig, devices } from "@playwright/test";

// Every API call is mocked with page.route (see e2e/fixtures.ts), so the suite
// needs only the Vite dev server, which Playwright starts itself (or reuses,
// when one is already running on :5173 outside CI). No backend, no Docker.
//
//   npm run test:e2e
//   npm run test:e2e:headed
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",

  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },

  use: {
    baseURL: "http://localhost:5173",
    // Capture traces on first retry in CI so failures are debuggable
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
