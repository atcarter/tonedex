import { createServer } from "node:net";
import { defineConfig, devices } from "@playwright/test";

// Every API call is mocked with page.route (see e2e/fixtures.ts), so the suite
// needs only the Vite dev server. Each run starts its own on a free port and
// never reuses one, so copies of the repo can run e2e side by side. E2E_PORT
// pins the port; E2E_BASE_URL targets a dev server you already started.
// No backend, no Docker.
//
//   npm run test:e2e
//   npm run test:e2e:headed
//   E2E_BASE_URL=http://localhost:5173 npm run test:e2e

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

const existingServer = process.env.E2E_BASE_URL;
// Workers reload this config; the env they inherit carries the main process's port.
if (!existingServer) process.env.E2E_PORT ||= String(await freePort());
const port = process.env.E2E_PORT;
const baseURL = existingServer ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",

  webServer: existingServer
    ? undefined
    : {
        command: `npm run dev -- --port ${port} --strictPort`,
        url: baseURL,
        reuseExistingServer: false,
      },

  use: {
    baseURL,
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
