import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

// The inline script in index.html sends links to the old Render hostname to the
// same path on tonedex.app. The page is served with a CSP allowing only the hash
// in infra/render/main.tf, so a stale hash blocks the script and fails the test.
const OLD_ORIGIN = "https://tonedex-web.onrender.com";
const NEW_ORIGIN = "https://tonedex.app";

const indexHtml = readFileSync(
  new URL("../index.html", import.meta.url),
  "utf8",
);
const mainTf = readFileSync(
  new URL("../../infra/render/main.tf", import.meta.url),
  "utf8",
);
const scriptHash = mainTf.match(/'sha256-[A-Za-z0-9+/=]+'/)?.[0];

test("the old hostname redirects to the same path on tonedex.app", async ({
  page,
}) => {
  expect(scriptHash).toBeDefined();
  const path = "/game/scarlet/pokemon/sprigatito?dex=national#moves";
  await page.route(`${OLD_ORIGIN}/**`, (route) =>
    route.request().resourceType() === "document"
      ? route.fulfill({
          contentType: "text/html",
          headers: { "Content-Security-Policy": `script-src ${scriptHash}` },
          body: indexHtml,
        })
      : route.abort(),
  );
  await page.route(`${NEW_ORIGIN}/**`, (route) =>
    route.fulfill({ contentType: "text/html", body: "<p>new host</p>" }),
  );

  await page.goto(`${OLD_ORIGIN}${path}`);

  await expect(page).toHaveURL(`${NEW_ORIGIN}${path}`);
});

test("the old hostname never boots the app or calls the API", async ({
  page,
  baseURL,
}) => {
  // The dev server's page and modules, minus the redirect, so the old page stays as if tonedex.app were slow.
  const offOrigin: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(OLD_ORIGIN)) offOrigin.push(request.url());
  });
  await page.route(`${OLD_ORIGIN}/**`, async (route) => {
    const { pathname, search } = new URL(route.request().url());
    const response = await route.fetch({
      url: `${baseURL}${pathname}${search}`,
    });
    if (route.request().resourceType() !== "document")
      return route.fulfill({ response });
    const html = await response.text();
    await route.fulfill({
      response,
      body: html.replace(/<script>[\s\S]*?<\/script>/, ""),
    });
  });

  await page.goto(`${OLD_ORIGIN}/game/scarlet`);
  await page.waitForLoadState("networkidle");

  await expect(page.locator("#root")).toBeEmpty();
  expect(offOrigin).toEqual([]);
});
