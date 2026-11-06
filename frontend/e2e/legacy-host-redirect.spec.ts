import { test, expect, type Page } from "@playwright/test";

// src/main.tsx sends visits on the old Render hostname to the same URL on
// tonedex.app without booting the app. The old origin is served by the dev
// server, so these run the real page and modules.
const OLD_ORIGIN = "https://tonedex-web.onrender.com";
const NEW_ORIGIN = "https://tonedex.app";

async function serveOldOriginFromDevServer(page: Page, baseURL: string) {
  await page.route(`${OLD_ORIGIN}/**`, async (route) => {
    const { pathname, search } = new URL(route.request().url());
    const response = await route.fetch({
      url: `${baseURL}${pathname}${search}`,
    });
    await route.fulfill({ response });
  });
}

test("the old hostname redirects to the same path on tonedex.app", async ({
  page,
  baseURL,
}) => {
  const path = "/game/scarlet/pokemon/sprigatito?dex=national#moves";
  await serveOldOriginFromDevServer(page, baseURL!);
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
  const offOrigin: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(OLD_ORIGIN) && !url.startsWith(NEW_ORIGIN))
      offOrigin.push(url);
  });
  const mountedOn: string[] = [];
  await page.exposeFunction("reportMounted", (origin: string) =>
    mountedOn.push(origin),
  );
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (document.getElementById("root")?.hasChildNodes())
        (
          window as unknown as { reportMounted: (o: string) => void }
        ).reportMounted(location.origin);
    }).observe(document, { childList: true, subtree: true });
  });
  await serveOldOriginFromDevServer(page, baseURL!);
  // Hold the redirect so the old page stays loaded, as if tonedex.app were slow;
  // a wrongly booted app would render and fire its first queries meanwhile.
  await page.route(`${NEW_ORIGIN}/**`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fulfill({ contentType: "text/html", body: "<p>new host</p>" });
  });

  await page.goto(`${OLD_ORIGIN}/game/scarlet`, { waitUntil: "commit" });
  await page.waitForURL(`${NEW_ORIGIN}/game/scarlet`);

  expect(mountedOn).toEqual([]);
  expect(offOrigin).toEqual([]);
});
