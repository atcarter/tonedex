import { defineConfig, devices } from "@playwright/test";

// Requires the full Docker Compose stack to be running:
//   docker compose up -d
//
// Run tests:
//   docker compose exec frontend npx playwright test
//   docker compose exec frontend npx playwright test --headed
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",

  use: {
    // Vite dev server exposed by Docker Compose at port 5173
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
