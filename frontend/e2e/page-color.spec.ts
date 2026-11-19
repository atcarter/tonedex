import { test, expect, type Page } from "@playwright/test";
import { mockPublicGameRoutes } from "./fixtures";

// A reload (pull-to-refresh) paints index.html before the app mounts
const bodyColor = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

for (const [colorScheme, color] of [
  ["dark", "rgb(18, 18, 18)"],
  ["light", "rgb(232, 232, 232)"],
] as const) {
  test(`before the app mounts, the page is the ${colorScheme} background`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    // Hold the app's entry module so the page stays unmounted
    await page.route("**/src/main.tsx", () => {});
    await page.goto("/game/scarlet", { waitUntil: "commit" });
    await page.waitForFunction(() => document.body);

    expect(await bodyColor(page)).toBe(color);
    expect(await page.locator("#root").innerHTML()).toBe("");
  });
}

for (const [stored, colorScheme, color] of [
  ["dark", "light", "rgb(18, 18, 18)"],
  ["light", "dark", "rgb(232, 232, 232)"],
] as const) {
  test(`before the app mounts, a stored ${stored} mode wins over a ${colorScheme} system`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.addInitScript(
      (mode) => localStorage.setItem("pokedex_color_mode", mode),
      stored,
    );
    await page.route("**/src/main.tsx", () => {});
    await page.goto("/game/scarlet", { waitUntil: "commit" });
    await page.waitForFunction(() => document.body);

    expect(await bodyColor(page)).toBe(color);
    expect(await page.locator("#root").innerHTML()).toBe("");
  });
}

test("once mounted, the stored color mode wins over the system one", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() =>
    localStorage.setItem("pokedex_color_mode", "light"),
  );
  await mockPublicGameRoutes(page);
  await page.goto("/game/scarlet");
  await expect(page.getByText("Sprigatito")).toBeVisible();

  expect(await bodyColor(page)).toBe("rgb(232, 232, 232)");
});

test("once mounted, toggling the color mode repaints the page", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("pokedex_color_mode", "dark"),
  );
  await mockPublicGameRoutes(page);
  await page.goto("/game/scarlet");
  await expect(page.getByText("Sprigatito")).toBeVisible();
  expect(await bodyColor(page)).toBe("rgb(18, 18, 18)");

  await page.getByRole("button", { name: "toggle color mode" }).click();
  await expect.poll(() => bodyColor(page)).toBe("rgb(232, 232, 232)");
});
