import { defineConfig, devices } from "@playwright/test";

// Read-only smoke suite against a live deployment: no mocking, no sign-in, no
// writes, and no webServer (the target is already running). Both URLs come
// from the environment so no deployment is baked into the repo.
//
//   SMOKE_BASE_URL=https://… SMOKE_API_URL=https://… npm run test:smoke
const baseURL = process.env.SMOKE_BASE_URL;
const apiURL = process.env.SMOKE_API_URL;

if (!baseURL || !apiURL) {
  throw new Error("SMOKE_BASE_URL and SMOKE_API_URL are required");
}

export default defineConfig({
  testDir: "./e2e-smoke",
  forbidOnly: !!process.env.CI,
  // A live host can be cold (free-tier spin-up) or briefly flaky; retry before
  // calling the deployment broken.
  retries: 2,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL,
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
