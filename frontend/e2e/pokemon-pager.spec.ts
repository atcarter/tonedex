import { test, expect, type Page } from "@playwright/test";
import {
  GAME,
  SPRIGATITO,
  SPRIGATITO_DETAIL,
  mockAuthenticatedRoutes,
  mockPublicGameRoutes,
  seedAuthState,
  touchDrag,
  type Point,
} from "./fixtures";

// Previous and next on the detail page, through the URL's dex view.

const API = "http://localhost:3000";

const DEX = [
  SPRIGATITO,
  {
    id: 907,
    name: "floragato",
    types: ["grass"],
    sprite_url: "",
    pokedex_number: 2,
  },
  {
    id: 908,
    name: "meowscarada",
    types: ["grass", "dark"],
    sprite_url: "",
    pokedex_number: 3,
  },
];

// Enough moves to make the page several screens tall
const MOVES = Array.from({ length: 40 }, (_, i) => ({
  name: `move-${i + 1}`,
  level_learned: i + 1,
  learn_method: "level-up",
}));

function detailFor(name: string) {
  const i = DEX.findIndex((p) => p.name === name);
  return {
    ...SPRIGATITO_DETAIL,
    pokemon: { ...SPRIGATITO_DETAIL.pokemon, ...DEX[i] },
    moves: MOVES,
    neighbors: { previous: DEX[i - 1] ?? null, next: DEX[i + 1] ?? null },
  };
}

// Returns the detail requests made, by Pokémon name
async function mockPager(page: Page) {
  const requests: string[] = [];
  await mockPublicGameRoutes(page);
  await page.route(`${API}/api/v1/games/1*`, (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        game: GAME,
        pokemons: DEX,
        available_types: ["dark", "grass"],
        pokemon_ids: DEX.map((p) => p.id),
        dex_numbers: DEX.map((p) => p.pokedex_number),
        pagination: {
          total: 3,
          limit: 40,
          offset: 0,
          has_more: false,
          seeding: false,
        },
      }),
    }),
  );
  await page.route(
    /\/api\/v1\/pokemon\/(sprigatito|floragato|meowscarada)(\?|$)/,
    (r) => {
      const name = new URL(r.request().url()).pathname.split("/").pop()!;
      requests.push(name);
      return r.fulfill({
        contentType: "application/json",
        body: JSON.stringify(detailFor(name)),
      });
    },
  );
  return requests;
}

const formatted = (name: string) => name[0].toUpperCase() + name.slice(1);
const heading = (page: Page, name: string) =>
  page.getByRole("heading", { name, exact: true });
const historyLength = (page: Page) => page.evaluate(() => history.length);
const nextButton = (page: Page) =>
  page.getByRole("button", { name: /^(Next|No next) Pokémon/ });
const previousButton = (page: Page) =>
  page.getByRole("button", { name: /^(Previous|No previous) Pokémon/ });

test.describe("Previous and next (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("Next and Previous move through the dex, and one Back returns to the list", async ({
    page,
  }) => {
    await mockPager(page);
    await page.goto("/game/scarlet");
    await page.getByText("Sprigatito", { exact: true }).click();
    await expect(heading(page, "Sprigatito")).toBeVisible();
    const length = await historyLength(page);

    await expect(previousButton(page)).toHaveAccessibleName(
      "No previous Pokémon",
    );
    await expect(previousButton(page)).toHaveAttribute("aria-disabled", "true");
    await expect(nextButton(page)).toHaveAccessibleName(
      "Next Pokémon: #002 Floragato",
    );
    await expect(nextButton(page)).toHaveText("#002 Floragato");

    await nextButton(page).click();
    await expect(heading(page, "Floragato")).toBeVisible();
    await expect(page).toHaveURL("/game/scarlet/pokemon/floragato");
    await nextButton(page).click();
    await expect(heading(page, "Meowscarada")).toBeVisible();
    await expect(nextButton(page)).toHaveAccessibleName("No next Pokémon");
    await previousButton(page).click();
    await expect(heading(page, "Floragato")).toBeVisible();
    expect(await historyLength(page)).toBe(length);

    await page.goBack();
    await expect(page).toHaveURL("/game/scarlet");
  });

  test("a disabled control does nothing", async ({ page }) => {
    await mockPager(page);
    await page.goto("/game/scarlet/pokemon/sprigatito");
    await expect(heading(page, "Sprigatito")).toBeVisible();

    // Playwright won't click an aria-disabled element unless forced
    await previousButton(page).click({ force: true });
    await expect(page).toHaveURL("/game/scarlet/pokemon/sprigatito");
  });

  test("the national view keeps ?dex=national on the neighbor's URL", async ({
    page,
  }) => {
    await mockPager(page);
    await page.goto("/game/scarlet/pokemon/sprigatito?dex=national");
    await nextButton(page).click();
    await expect(page).toHaveURL(
      "/game/scarlet/pokemon/floragato?dex=national",
    );
  });

  test("arrow keys move, except in the search box, with Alt, or with the game menu open", async ({
    page,
  }) => {
    await mockPager(page);
    await page.goto("/game/scarlet/pokemon/floragato");
    await expect(heading(page, "Floragato")).toBeVisible();

    await page.getByLabel("search pokemon").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL("/game/scarlet/pokemon/floragato");

    await page.locator("body").click({ position: { x: 5, y: 400 } });
    await page.keyboard.press("Alt+ArrowRight");
    await expect(page).toHaveURL("/game/scarlet/pokemon/floragato");

    await page.getByRole("combobox", { name: "select game" }).click();
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toBeHidden();
    await expect(page).toHaveURL("/game/scarlet/pokemon/floragato");

    await page.locator("body").click({ position: { x: 5, y: 400 } });
    await page.keyboard.press("ArrowRight");
    await expect(heading(page, "Meowscarada")).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(heading(page, "Floragato")).toBeVisible();
  });

  test("Enter on Next keeps focus on it and announces the new Pokémon", async ({
    page,
  }) => {
    await mockPager(page);
    await page.goto("/game/scarlet/pokemon/sprigatito");
    await expect(heading(page, "Sprigatito")).toBeVisible();

    await nextButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(heading(page, "Floragato")).toBeVisible();
    await expect(nextButton(page)).toBeFocused();
    await expect(page.locator("[aria-live='polite']")).toHaveText("Floragato");

    await expect(nextButton(page)).toHaveAccessibleName(
      "Next Pokémon: #003 Meowscarada",
    );
    await page.keyboard.press("Enter");
    await expect(heading(page, "Meowscarada")).toBeVisible();
    await expect(nextButton(page)).toBeFocused();
    await expect(nextButton(page)).toHaveAttribute("aria-disabled", "true");
    await expect(nextButton(page)).toHaveAccessibleName("No next Pokémon");
  });

  test("both neighbors are prefetched once, and moving to one requests nothing", async ({
    page,
  }) => {
    const requests = await mockPager(page);
    await page.goto("/game/scarlet/pokemon/floragato");
    await expect(heading(page, "Floragato")).toBeVisible();
    await expect
      .poll(() => [...requests].sort())
      .toEqual(["floragato", "meowscarada", "sprigatito"]);

    await nextButton(page).click();
    await expect(heading(page, "Meowscarada")).toBeVisible();
    // The page settles and prefetches again; its only new neighbor is cached
    await page.waitForTimeout(500);
    expect([...requests].sort()).toEqual([
      "floragato",
      "meowscarada",
      "sprigatito",
    ]);
  });

  test("no controls outside a dex view or when the API sends no neighbors", async ({
    page,
  }) => {
    await mockPager(page);
    await page.goto("/pokemon/floragato");
    await expect(heading(page, "Floragato")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Previous and next Pokémon" }),
    ).toHaveCount(0);

    await page.route(`${API}/api/v1/pokemon/floragato*`, (r) =>
      r.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ...detailFor("floragato"),
          neighbors: undefined,
        }),
      }),
    );
    await page.goto("/game/scarlet/pokemon/floragato");
    await expect(heading(page, "Floragato")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Previous and next Pokémon" }),
    ).toHaveCount(0);
  });
});

test.describe("Previous and next (phone)", () => {
  test.use({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });

  test("the controls show the number only, beside Back, at 44px", async ({
    page,
  }) => {
    await mockPager(page);
    await page.goto("/game/scarlet/pokemon/floragato");
    await expect(heading(page, "Floragato")).toBeVisible();

    await expect(nextButton(page)).toHaveText("#003", { useInnerText: true });
    await expect(nextButton(page)).toHaveAccessibleName(
      "Next Pokémon: #003 Meowscarada",
    );
    const back = (await page
      .getByRole("button", { name: "Back" })
      .boundingBox())!;
    for (const button of [previousButton(page), nextButton(page)]) {
      const box = (await button.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(
        Math.abs(box.y + box.height / 2 - (back.y + back.height / 2)),
      ).toBeLessThan(4);
      expect(box.x + box.width).toBeLessThanOrEqual(375);
    }
  });
});

test.describe("Swipe (phone)", () => {
  test.use({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });

  const MID_Y = 400;
  const left = (from = 300, y = MID_Y): [Point, Point] => [
    { x: from, y },
    { x: from - 200, y },
  ];
  const right = (from = 75, y = MID_Y): [Point, Point] => [
    { x: from, y },
    { x: from + 200, y },
  ];
  const content = (page: Page) => page.getByTestId("pager-content");
  const transform = (page: Page) =>
    content(page).evaluate((el) => el.style.transform);

  async function swipe(page: Page, [from, to]: [Point, Point]) {
    const drag = await touchDrag(page, from, to);
    await drag.release();
  }

  async function open(page: Page, name: string) {
    const requests = await mockPager(page);
    await page.goto(`/game/scarlet/pokemon/${name}`);
    await expect(heading(page, formatted(name))).toBeVisible();
    // Neighbors prefetched, so a swipe renders at once
    await expect.poll(() => requests.length).toBeGreaterThanOrEqual(2);
    return requests;
  }

  test("left goes next and right goes previous, replacing the entry", async ({
    page,
  }) => {
    await mockPager(page);
    await page.goto("/game/scarlet");
    await page.getByText("Floragato", { exact: true }).click();
    await expect(heading(page, "Floragato")).toBeVisible();
    const length = await historyLength(page);

    await swipe(page, left());
    await expect(heading(page, "Meowscarada")).toBeVisible();
    await swipe(page, right());
    await expect(heading(page, "Floragato")).toBeVisible();
    await swipe(page, right());
    await expect(heading(page, "Sprigatito")).toBeVisible();
    expect(await historyLength(page)).toBe(length);

    await page.goBack();
    await expect(page).toHaveURL("/game/scarlet");
  });

  test("at an end the page lags the finger, then springs back", async ({
    page,
  }) => {
    await open(page, "sprigatito");

    const drag = await touchDrag(page, ...right());
    await expect
      .poll(() => transform(page))
      .toBe("translate3d(50px, 0px, 0px)");
    await drag.release();
    await expect.poll(() => transform(page)).toBe("");
    await expect(page).toHaveURL("/game/scarlet/pokemon/sprigatito");
  });

  test("the last Pokémon has no next", async ({ page }) => {
    await open(page, "meowscarada");

    await swipe(page, left());
    await page.waitForTimeout(300);
    await expect(page).toHaveURL("/game/scarlet/pokemon/meowscarada");
  });

  test("with no previous or next there are no controls and the page doesn't follow the finger", async ({
    page,
  }) => {
    await mockPager(page);
    await page.route(`${API}/api/v1/pokemon/floragato*`, (r) =>
      r.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ...detailFor("floragato"),
          neighbors: { previous: null, next: null },
        }),
      }),
    );
    await page.goto("/game/scarlet/pokemon/floragato");
    await expect(heading(page, "Floragato")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Previous and next Pokémon" }),
    ).toHaveCount(0);

    const drag = await touchDrag(page, ...left());
    expect(await transform(page)).toBe("");
    await drag.release();
    await page.waitForTimeout(300);
    await expect(page).toHaveURL("/game/scarlet/pokemon/floragato");
  });

  test("a vertical or 45° drag scrolls and never moves sideways", async ({
    page,
  }) => {
    await open(page, "floragato");

    await swipe(page, [
      { x: 200, y: 650 },
      { x: 200, y: 250 },
    ]);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(100);
    expect(await transform(page)).toBe("");

    await swipe(page, [
      { x: 300, y: 650 },
      { x: 100, y: 450 },
    ]);
    await page.waitForTimeout(300);
    await expect(page).toHaveURL("/game/scarlet/pokemon/floragato");
  });

  test("a swipe from within 32px of either edge is the browser's", async ({
    page,
  }) => {
    await open(page, "floragato");

    await swipe(page, right(8));
    await swipe(page, left(367));
    await page.waitForTimeout(300);
    await expect(page).toHaveURL("/game/scarlet/pokemon/floragato");

    await swipe(page, right(40));
    await expect(heading(page, "Sprigatito")).toBeVisible();
  });

  test("a swipe inside a sideways scroller scrolls it instead", async ({
    page,
  }) => {
    await open(page, "floragato");
    await content(page).evaluate((el) => {
      const scroller = document.createElement("div");
      scroller.id = "wide";
      scroller.style.cssText =
        "overflow-x: auto; position: fixed; top: 300px; left: 40px; width: 295px; height: 200px";
      const wide = document.createElement("div");
      wide.style.cssText = "width: 900px; height: 200px";
      scroller.append(wide);
      el.append(scroller);
    });

    await swipe(page, left());
    await expect
      .poll(() => page.locator("#wide").evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(100);
    await expect(page).toHaveURL("/game/scarlet/pokemon/floragato");
  });

  test("mid-drag the page doesn't widen", async ({ page }) => {
    await open(page, "floragato");

    const drag = await touchDrag(page, ...left());
    expect(await transform(page)).toContain("translate3d(-");
    const width = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      x: window.scrollX,
    }));
    expect(width).toEqual({ scroll: 375, x: 0 });
    await drag.release();
  });

  test("a short slow drag springs back", async ({ page }) => {
    await open(page, "floragato");

    await touchDrag(
      page,
      { x: 250, y: MID_Y },
      { x: 190, y: MID_Y },
      {
        steps: 10,
        delay: 60,
      },
    ).then((drag) => drag.release());
    await expect.poll(() => transform(page)).toBe("");
    await expect(page).toHaveURL("/game/scarlet/pokemon/floragato");
  });

  test("a swipe from deep in the page lands at the top with the header shown", async ({
    page,
  }) => {
    await open(page, "floragato");
    await page.evaluate(() => window.scrollTo(0, 1500));
    await expect
      .poll(() =>
        page
          .locator("header")
          .first()
          .boundingBox()
          .then((b) => b!.y),
      )
      .toBeLessThan(-10);

    await swipe(page, left());
    await expect(heading(page, "Meowscarada")).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect
      .poll(() =>
        page
          .locator("header")
          .first()
          .boundingBox()
          .then((b) => b!.y),
      )
      .toBe(0);
  });

  test("a swipe that starts on the moves list moves sideways", async ({
    page,
  }) => {
    await open(page, "floragato");
    const row = page.getByTestId("move-table").getByRole("button").nth(3);
    await row.scrollIntoViewIfNeeded();
    const box = (await row.boundingBox())!;

    await swipe(page, left(300, box.y + box.height / 2));
    await expect(heading(page, "Meowscarada")).toBeVisible();
  });

  test("with reduced motion it moves without any transform or animation", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "floragato");

    const drag = await touchDrag(page, ...left());
    expect(await transform(page)).toBe("");
    await drag.release();
    await expect(heading(page, "Meowscarada")).toBeVisible();
    expect(
      await content(page).evaluate((el) => el.getAnimations().length),
    ).toBe(0);
  });

  test("the detail isn't remounted, and the new Pokémon slides in", async ({
    page,
  }) => {
    await open(page, "floragato");
    await content(page).evaluate((el) => {
      (window as unknown as { detailRoot: Element }).detailRoot =
        el.firstElementChild!;
    });

    await swipe(page, left());
    await expect(heading(page, "Meowscarada")).toBeVisible();
    expect(
      await content(page).evaluate(
        (el) =>
          el.firstElementChild ===
          (window as unknown as { detailRoot: Element }).detailRoot,
      ),
    ).toBe(true);
  });

  test("nothing inside the page scrolls sideways unless marked to", async ({
    page,
  }) => {
    await open(page, "floragato");
    await expect(page.getByTestId("move-table")).toBeVisible();

    const scrollers = await content(page).evaluate((root) =>
      [root, ...root.querySelectorAll("*")]
        .filter((el) => !el.closest("[data-swipe-ignore]"))
        .filter((el) =>
          ["auto", "scroll"].includes(getComputedStyle(el).overflowX),
        )
        .map((el) => el.outerHTML.slice(0, 80)),
    );
    expect(scrollers).toEqual([]);
  });
});

test.describe("Swipe (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("a mouse drag doesn't move sideways", async ({ page }) => {
    await mockPager(page);
    await page.goto("/game/scarlet/pokemon/floragato");
    await expect(heading(page, "Floragato")).toBeVisible();

    await page.mouse.move(800, 400);
    await page.mouse.down();
    await page.mouse.move(400, 400, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await expect(page).toHaveURL("/game/scarlet/pokemon/floragato");
  });
});

test.describe("Previous and next from Favorites and Compare", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // Favorites in the user's order, not the dex's
  const FAVORITES = [DEX[2], DEX[0], DEX[1]].map((p, i) => ({
    ...p,
    pokedex_number: undefined,
    favorite_id: i + 1,
  }));

  test("opened from Favorites, it steps through the favorites list", async ({
    page,
  }) => {
    await mockPager(page);
    await seedAuthState(page);
    await mockAuthenticatedRoutes(page);
    await page.route(`${API}/api/v1/favorites`, (r) =>
      r.fulfill({
        contentType: "application/json",
        body: JSON.stringify(FAVORITES),
      }),
    );
    await page.goto("/favorites");
    await page.getByText("Sprigatito", { exact: true }).click();
    await expect(heading(page, "Sprigatito")).toBeVisible();
    await expect(page).toHaveURL("/pokemon/sprigatito");

    await expect(previousButton(page)).toHaveAccessibleName(
      "Previous Pokémon: Meowscarada",
    );
    await nextButton(page).click();
    await expect(heading(page, "Floragato")).toBeVisible();
    await expect(page).toHaveURL("/pokemon/floragato");
    await expect(nextButton(page)).toHaveAccessibleName("No next Pokémon");

    // A reload keeps the list it came from
    await page.reload();
    await expect(heading(page, "Floragato")).toBeVisible();
    // The favorites list refetches after the reload
    await expect(previousButton(page)).toHaveAccessibleName(
      "Previous Pokémon: Sprigatito",
    );
    await page.keyboard.press("ArrowLeft");
    await expect(heading(page, "Sprigatito")).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL("/favorites");
  });

  test("opened from Compare, it swaps between the two", async ({ page }) => {
    await mockPager(page);
    await page.goto("/compare?left=sprigatito&right=meowscarada");
    await page.getByRole("link", { name: "Sprigatito" }).click();
    await expect(heading(page, "Sprigatito")).toBeVisible();

    await expect(previousButton(page)).toHaveAccessibleName(
      "No previous Pokémon",
    );
    await nextButton(page).click();
    await expect(heading(page, "Meowscarada")).toBeVisible();
    await expect(page).toHaveURL("/pokemon/meowscarada");
    await expect(nextButton(page)).toHaveAccessibleName("No next Pokémon");
    await previousButton(page).click();
    await expect(heading(page, "Sprigatito")).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL("/compare?left=sprigatito&right=meowscarada");
  });

  test("an evolution link leaves the list behind", async ({ page }) => {
    await mockPager(page);
    await page.goto("/compare?left=sprigatito&right=meowscarada");
    await page.getByRole("link", { name: "Sprigatito" }).click();
    await page
      .getByTestId("evolution-stage")
      .filter({ hasText: "Floragato" })
      .click();
    await expect(heading(page, "Floragato")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Previous and next Pokémon" }),
    ).toHaveCount(0);
  });
});
