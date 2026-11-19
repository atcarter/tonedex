import { test, expect, type Page } from "@playwright/test";
import {
  GAME,
  SPRIGATITO,
  SPRIGATITO_DETAIL,
  mockPublicGameRoutes,
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

function detailFor(name: string) {
  const i = DEX.findIndex((p) => p.name === name);
  return {
    ...SPRIGATITO_DETAIL,
    pokemon: { ...SPRIGATITO_DETAIL.pokemon, ...DEX[i] },
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
