import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  GAME_PAGE_RESPONSE,
  SPRIGATITO,
  mockPublicGameRoutes,
} from "./fixtures";

const API = "http://localhost:3000";
const VIEWPORT = { width: 375, height: 812 };

test.use({ viewport: VIEWPORT, isMobile: true, hasTouch: true });

const headerRect = (page: Page) =>
  page.locator("header").evaluate((el) => {
    const { top, bottom, height } = el.getBoundingClientRect();
    return { top, bottom, height };
  });

// Enough cards for the phone page to scroll
const FORTY_POKEMON = Array.from({ length: 40 }, (_, i) => ({
  ...SPRIGATITO,
  id: 100_000 + i,
  name: `sprigatito-${i + 1}`,
  pokedex_number: i + 1,
}));

// Fake GSI script: renders an iframe so sign-in placement is testable offline
const FAKE_GSI = `
  window.google = { accounts: { id: {
    initialize() {},
    renderButton(parent) {
      const frame = document.createElement("iframe");
      frame.title = "Sign in with Google Button";
      // StrictMode renders twice; replace, as the real script does
      parent.replaceChildren(frame);
    },
    prompt() {},
    cancel() {},
    disableAutoSelect() {},
  } } };
`;

test.describe("Phone header", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("https://accounts.google.com/gsi/client*", (r) =>
      r.fulfill({
        status: 200,
        contentType: "text/javascript",
        body: FAKE_GSI,
      }),
    );
    await mockPublicGameRoutes(page);
  });

  test("is one row and the page has no horizontal overflow", async ({
    page,
  }) => {
    await page.goto("/game/1");
    await expect(page.getByText("Sprigatito")).toBeVisible();

    const { height } = await headerRect(page);
    expect(height).toBeLessThanOrEqual(64);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(VIEWPORT.width);
  });

  test("search expands, keeps its dropdown on screen, and Escape collapses it", async ({
    page,
  }) => {
    await page.route(`${API}/api/v1/pokemon/suggestions*`, (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: [SPRIGATITO] }),
      }),
    );
    await page.goto("/game/1");

    await page.getByRole("button", { name: "open search" }).tap();
    const input = page.getByLabel("search pokemon");
    await expect(input).toBeFocused();
    await input.fill("spr");

    const listbox = page.getByRole("listbox");
    await expect(listbox.getByText("Sprigatito")).toBeVisible();
    const box = await listbox.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(VIEWPORT.width);

    await input.press("Escape");
    await expect(input).toBeHidden();
    await expect(
      page.getByRole("button", { name: "open search" }),
    ).toBeVisible();
  });

  test("the account menu holds Favorites and the color-mode toggle", async ({
    page,
  }) => {
    await page.goto("/game/1");

    await page.getByRole("button", { name: "account" }).tap();
    const menu = page.getByRole("menu");
    await expect(
      menu.getByRole("menuitem", { name: "Favorites" }),
    ).toBeVisible();
    await expect(
      menu.getByRole("menuitem", { name: /switch to (dark|light) mode/i }),
    ).toBeVisible();

    await menu.getByRole("menuitem", { name: "Favorites" }).tap();
    await expect(page).toHaveURL(/\/favorites$/);
  });

  test("slides away on scroll down and returns on scroll up", async ({
    page,
  }) => {
    // Overrides the shared mock (last registered route wins)
    await page.route(`${API}/api/v1/games/1*`, (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...GAME_PAGE_RESPONSE,
          pokemons: FORTY_POKEMON,
          pagination: { ...GAME_PAGE_RESPONSE.pagination, total: 40 },
        }),
      }),
    );
    await page.goto("/game/1");
    await expect(page.getByText("Sprigatito 40")).toBeAttached();

    await page.evaluate(() => window.scrollBy(0, 400));
    await expect
      .poll(async () => (await headerRect(page)).bottom)
      .toBeLessThanOrEqual(0);

    await page.evaluate(() => window.scrollBy(0, -100));
    await expect.poll(async () => (await headerRect(page)).top).toBe(0);
  });

  test("signed out, Google's sign-in renders only inside the account menu", async ({
    page,
  }) => {
    await page.goto("/game/1");
    await expect(page.getByRole("button", { name: "account" })).toBeVisible();

    await expect(page.locator("header iframe")).toHaveCount(0);
    await expect(page.locator("iframe")).toHaveCount(0);

    await page.getByRole("button", { name: "account" }).tap();
    await expect(page.getByRole("menu").locator("iframe")).toBeAttached();
    await expect(page.locator("header iframe")).toHaveCount(0);
  });
});

test.describe("Desktop header", () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    isMobile: false,
    hasTouch: false,
  });

  test("keeps the 64px toolbar with the inline search input", async ({
    page,
  }) => {
    await mockPublicGameRoutes(page);
    await page.goto("/game/1");

    const search = page.getByLabel("search pokemon");
    await expect(search).toBeVisible();
    const toolbar = await page.locator("header .MuiToolbar-root").boundingBox();
    expect(toolbar?.height).toBe(64);
  });
});
