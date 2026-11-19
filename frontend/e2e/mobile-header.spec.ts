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
    await page.goto("/game/scarlet");
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
    await page.goto("/game/scarlet");

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
    await page.goto("/game/scarlet");

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
    await page.goto("/game/scarlet");
    await expect(page.getByText("Sprigatito 40")).toBeAttached();

    await page.evaluate(() => window.scrollBy(0, 400));
    await expect
      .poll(async () => (await headerRect(page)).bottom)
      .toBeLessThanOrEqual(0);

    await page.evaluate(() => window.scrollBy(0, -100));
    await expect.poll(async () => (await headerRect(page)).top).toBe(0);
  });

  test("the sliding bar paints nothing outside its box", async ({ page }) => {
    // Safari skips painting the slide when the bar carries an overflowing pseudo
    await page.goto("/game/scarlet");
    const pseudos = await page
      .locator("header")
      .evaluate((el) =>
        ["::before", "::after"].map((p) => getComputedStyle(el, p).content),
      );
    expect(pseudos).toEqual(["none", "none"]);
  });

  test("signed out, Google's sign-in renders only inside the account menu", async ({
    page,
  }) => {
    await page.goto("/game/scarlet");
    await expect(page.getByRole("button", { name: "account" })).toBeVisible();

    await expect(page.locator("header iframe")).toHaveCount(0);
    await expect(page.locator("iframe")).toHaveCount(0);

    await page.getByRole("button", { name: "account" }).tap();
    await expect(page.getByRole("menu").locator("iframe")).toBeAttached();
    await expect(page.locator("header iframe")).toHaveCount(0);
  });
});

// iPhone 15 Pro Max: 430x932 CSS px, 59px status-bar inset
for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`Phone header under a notch (${colorScheme})`, () => {
    const INSET_TOP = 59;
    test.use({ viewport: { width: 430, height: 932 }, colorScheme });

    // Rows above the toolbar not painted solid primary.main (#cc0000)
    const nonRedRows = (page: Page) =>
      page.evaluate(() => {
        const header = document.querySelector("header")!;
        // The status-bar strip renders just before the header, the fill before it
        const strip = header.previousElementSibling!;
        const fill = strip.previousElementSibling!;
        const toolbarTop = header
          .querySelector(".MuiToolbar-root")!
          .getBoundingClientRect().top;
        const end = Math.max(toolbarTop, strip.getBoundingClientRect().bottom);
        const rows: string[] = [];
        for (let y = 0; y < end; y++) {
          const hit = document.elementFromPoint(200, y);
          // A fill hit is its ::before
          const style =
            hit === strip
              ? getComputedStyle(strip)
              : hit === fill
                ? getComputedStyle(fill, "::before")
                : hit && header.contains(hit)
                  ? getComputedStyle(header)
                  : null;
          const paint = style
            ? `${style.backgroundColor} ${style.backgroundImage}`
            : hit?.tagName;
          if (paint !== "rgb(204, 0, 0) none") rows.push(`${y}:${paint}`);
        }
        return rows;
      });

    const toolbarRect = (page: Page) =>
      page.locator("header .MuiToolbar-root").evaluate((el) => {
        const { top, bottom } = el.getBoundingClientRect();
        return { top, bottom };
      });

    test.beforeEach(async ({ page, context }) => {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setSafeAreaInsetsOverride", {
        insets: { top: INSET_TOP },
      });
      await mockPublicGameRoutes(page);
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
      await page.goto("/game/scarlet");
      await expect(page.getByText("Sprigatito 40")).toBeAttached();
    });

    test("stays red from the screen top to the bar while scrolling down and back", async ({
      page,
    }) => {
      expect((await toolbarRect(page)).top).toBe(INSET_TOP);
      expect(await nonRedRows(page)).toEqual([]);

      await page.evaluate(() => window.scrollBy(0, 400));
      await expect
        .poll(async () => (await toolbarRect(page)).bottom)
        .toBeLessThanOrEqual(0);
      expect(await nonRedRows(page)).toEqual([]);

      await page.evaluate(() => window.scrollTo(0, 0));
      await expect
        .poll(async () => (await toolbarRect(page)).top)
        .toBe(INSET_TOP);
      expect(await nonRedRows(page)).toEqual([]);
    });

    test("a top overscroll shows red above the bar, not the page", async ({
      page,
    }) => {
      // Chromium on Linux can't rubber-band; pull the page down as iOS does
      const PULL = 100;
      await page.evaluate(
        (pull) => (document.body.style.translate = `0 ${pull}px`),
        PULL,
      );
      expect(await nonRedRows(page)).toEqual([]);
      expect((await toolbarRect(page)).top).toBe(INSET_TOP + PULL);
    });
  });
}

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
    await page.goto("/game/scarlet");

    const search = page.getByLabel("search pokemon");
    await expect(search).toBeVisible();
    const toolbar = await page.locator("header .MuiToolbar-root").boundingBox();
    expect(toolbar?.height).toBe(64);
  });

  test("a top overscroll shows red above the bar, not the page", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await mockPublicGameRoutes(page);
    await page.goto("/game/scarlet");
    await expect(page.getByLabel("search pokemon")).toBeVisible();

    // Chromium on Linux can't bounce; pull the page down as a trackpad does
    await page.evaluate(() => (document.body.style.translate = "0 100px"));
    const paints = await page.evaluate(() => {
      const header = document.querySelector("header")!;
      const fill = header.previousElementSibling!;
      const seen = new Set<string>();
      for (let y = 0; y < header.getBoundingClientRect().bottom; y++) {
        const hit = document.elementFromPoint(640, y)!;
        const style =
          hit === fill
            ? getComputedStyle(fill, "::before")
            : getComputedStyle(header.contains(hit) ? header : hit);
        seen.add(`${style.backgroundColor} ${style.backgroundImage}`);
      }
      return [...seen];
    });
    // Solid primary.main above and through the bar, in dark mode too
    expect(paints).toEqual(["rgb(204, 0, 0) none"]);
  });
});
