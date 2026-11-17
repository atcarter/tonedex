import { test, expect, type Page } from "@playwright/test";
import { SPRIGATITO_DETAIL, mockPublicGameRoutes } from "./fixtures";

// The detail page's "Where to Catch It" section in its states, desktop and phone.

const API = "http://localhost:3000";

const location = (i: number) => ({
  area: `paldea-extremely-long-named-coastal-wilderness-route-${i}-area`,
  method: i === 0 ? "super-rod" : "walk",
  dlc: i === 1 ? "The Indigo Disk" : null,
  min_level: 10 + i,
  max_level: 20 + i,
  chance: 40 - i,
  chance_varies: i === 0,
  conditions: i === 0 ? ["time-night"] : [],
  varies_with: i === 0 ? ["radio-off", "season-spring"] : [],
});

const FLORAGATO_DETAIL = {
  ...SPRIGATITO_DETAIL,
  pokemon: {
    ...SPRIGATITO_DETAIL.pokemon,
    id: 907,
    name: "floragato",
    pokedex_number: 2,
  },
};

async function mockDetail(page: Page, encounters: unknown) {
  await mockPublicGameRoutes(page);
  await page.route(`${API}/api/v1/pokemon/sprigatito*`, (r) =>
    r.fulfill({ json: SPRIGATITO_DETAIL }),
  );
  await page.route(`${API}/api/v1/pokemon/floragato*`, (r) =>
    r.fulfill({ json: FLORAGATO_DETAIL }),
  );
  await page.route(`${API}/api/v1/pokemon/*/encounters*`, (r) =>
    r.fulfill({ json: encounters }),
  );
}

const section = (page: Page) =>
  page.locator("div", { has: page.getByText("Where to Catch It") }).last();

test("lists where to catch it and expands the rest from the keyboard", async ({
  page,
}) => {
  await mockDetail(page, {
    status: "found",
    locations: Array.from({ length: 9 }, (_, i) => location(i)),
  });
  await page.goto("/game/scarlet/pokemon/sprigatito");

  const rows = page.getByTestId("encounter-list").getByRole("listitem");
  await expect(rows).toHaveCount(6);
  await expect(rows.first()).toContainText(
    "Extremely Long Named Coastal Wilderness Route 0",
  );
  await expect(rows.first()).toContainText("Super Rod");
  await expect(rows.first()).toContainText("Lv. 10–20");
  await expect(rows.first()).toContainText("Up to 40% chance");
  await expect(rows.first()).toContainText(
    "Night · Varies with the radio and season",
  );
  await expect(rows.nth(1)).toContainText("The Indigo Disk");

  const toggle = page.getByRole("button", { name: "Show all 9 locations" });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(rows).toHaveCount(9);
  await expect(
    page.getByRole("button", { name: "Show fewer" }),
  ).toHaveAttribute("aria-expanded", "true");
});

test("says when the game has no location data", async ({ page }) => {
  await mockDetail(page, { status: "unavailable", locations: [] });
  await page.goto("/game/scarlet/pokemon/sprigatito");

  await expect(
    page.getByText("Location data isn't available for Scarlet."),
  ).toBeVisible();
  await expect(page.getByText(/not found in the wild/i)).toHaveCount(0);
});

test("points to the earlier stage when it isn't in the wild", async ({
  page,
}) => {
  await mockDetail(page, {
    status: "none",
    locations: [],
    evolves_from: { name: "sprigatito", pokemon_name: "sprigatito" },
  });
  await page.goto("/game/scarlet/pokemon/floragato");

  await expect(
    page.getByText("Not found in the wild in Scarlet. Evolve it from"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sprigatito", exact: true }).click();
  await expect(page).toHaveURL(/\/game\/scarlet\/pokemon\/sprigatito$/);
});

test("polls while the data is being cached", async ({ page }) => {
  let calls = 0;
  await mockDetail(page, null);
  await page.route(`${API}/api/v1/pokemon/*/encounters*`, (r) => {
    calls += 1;
    return r.fulfill({
      json:
        calls === 1
          ? { status: "pending", locations: [] }
          : { status: "found", locations: [location(0)] },
    });
  });
  await page.goto("/game/scarlet/pokemon/sprigatito");

  await expect(page.getByText("Checking where to find it…")).toBeVisible();
  await expect(
    page.getByTestId("encounter-list").getByRole("listitem"),
  ).toHaveCount(1, { timeout: 10_000 });
});

test.describe("on a 375px phone", () => {
  test.use({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });

  test("long location rows wrap instead of scrolling the page", async ({
    page,
  }) => {
    await mockDetail(page, {
      status: "found",
      locations: Array.from({ length: 9 }, (_, i) => location(i)),
    });
    await page.goto("/game/scarlet/pokemon/sprigatito");
    await page.getByRole("button", { name: "Show all 9 locations" }).tap();
    await expect(
      page.getByTestId("encounter-list").getByRole("listitem"),
    ).toHaveCount(9);

    const width = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(width).toBeLessThanOrEqual(375);
    await expect(section(page)).toBeVisible();
  });
});
