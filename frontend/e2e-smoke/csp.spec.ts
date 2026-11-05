import { test, expect, type Page } from "@playwright/test";

// Proves the live site's Content Security Policy blocks nothing it needs.
// Chromium logs every violation to the console, enforced or report-only, with
// a message that names the "Content Security Policy" directive it broke. Run
// this before changing local.content_security_policy in infra/render/main.tf.
// Read-only and signed out: page loads and GETs only.
const API = process.env.SMOKE_API_URL!;

// ":scarlet" stands for Scarlet's id, looked up from the API by name.
const ROUTES = [
  "/",
  "/game/:scarlet",
  "/game/:scarlet/pokemon/sprigatito",
  "/compare",
  "/game/:scarlet/team",
  "/favorites",
  "/this-page-does-not-exist",
];

const VIEWPORTS = [
  { name: "desktop", size: undefined },
  { name: "phone", size: { width: 375, height: 812 } },
];

let scarletId: number;

test.beforeAll(async ({ playwright }) => {
  const api = await playwright.request.newContext();
  const res = await api.get(`${API}/api/v1/games`);
  expect(res.status()).toBe(200);
  const games: { id: number; name: string }[] = await res.json();
  await api.dispose();

  const scarlet = games.find((g) => g.name === "scarlet");
  expect(scarlet, "Scarlet is in /api/v1/games").toBeDefined();
  scarletId = scarlet!.id;
});

// Loads Google Identity Services the way a signed-out visitor would: the
// Google button renders on load, possibly behind an account menu on phones.
async function loadGoogleSignIn(page: Page) {
  const account = page.getByRole("button", { name: /account/i });
  if ((await account.count()) > 0) await account.first().click();

  await expect(
    page
      .locator('iframe[src^="https://accounts.google.com/gsi/button"]')
      .first(),
  ).toBeAttached({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

for (const { name, size } of VIEWPORTS) {
  test.describe(name, () => {
    if (size) test.use({ viewport: size });

    for (const route of ROUTES) {
      test(`${route} has no CSP violations`, async ({ page }) => {
        const messages: string[] = [];
        page.on("console", (msg) => messages.push(msg.text()));

        await page.goto(route.replace(":scarlet", String(scarletId)), {
          waitUntil: "networkidle",
        });
        await loadGoogleSignIn(page);

        expect(
          messages.filter((m) => m.includes("Content Security Policy")),
        ).toEqual([]);
      });
    }
  });
}
