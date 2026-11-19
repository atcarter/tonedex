import { test, expect, type Page } from "@playwright/test";
import { GAME, SPRIGATITO_DETAIL, mockPublicGameRoutes } from "./fixtures";

// A new page starts at the top even when its data is cached; Back restores.
test.use({
  viewport: { width: 375, height: 812 },
  isMobile: true,
  hasTouch: true,
});

const API = "http://localhost:3000";

const POKEMONS = Array.from({ length: 40 }, (_, i) => ({
  id: 100_000 + i,
  name: `mon-${i + 1}`,
  types: ["grass"],
  sprite_url: "",
  pokedex_number: i + 1,
}));

// Enough moves to make a detail page several screens tall
const MOVES = Array.from({ length: 40 }, (_, i) => ({
  name: `move-${i + 1}`,
  level_learned: i + 1,
  learn_method: "level-up",
}));

function detailFor(name: string) {
  const entry = POKEMONS.find((p) => p.name === name)!;
  return {
    ...SPRIGATITO_DETAIL,
    pokemon: { ...SPRIGATITO_DETAIL.pokemon, ...entry },
    moves: MOVES,
    evolution_chain: ["mon-1", "mon-2"].map((stage) => ({
      name: stage,
      pokemon_name: stage,
      evolution_details: [],
      sprite_url: null,
    })),
  };
}

async function mockRoutes(page: Page) {
  await mockPublicGameRoutes(page);
  await page.route(`${API}/api/v1/games/1*`, (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        game: GAME,
        pokemons: POKEMONS,
        available_types: ["grass"],
        pokemon_ids: POKEMONS.map((p) => p.id),
        dex_numbers: POKEMONS.map((p) => p.pokedex_number),
        pagination: {
          total: 40,
          limit: 40,
          offset: 0,
          has_more: false,
          seeding: false,
        },
      }),
    }),
  );
  await page.route(/\/api\/v1\/pokemon\/mon-\d+(\?|$)/, (r) => {
    const name = new URL(r.request().url()).pathname.split("/").pop()!;
    return r.fulfill({
      contentType: "application/json",
      body: JSON.stringify(detailFor(name)),
    });
  });
}

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

async function scrollTo(page: Page, y: number) {
  await page.evaluate((top) => window.scrollTo(0, top), y);
  await expect.poll(() => scrollY(page)).toBe(y);
}

test.beforeEach(async ({ page }) => {
  await mockRoutes(page);
});

test("opening a cached Pokémon from a scrolled list starts at the top, and Back restores the list", async ({
  page,
}) => {
  await page.goto("/game/scarlet");
  const card = page.getByText("Mon 31", { exact: true });
  await card.scrollIntoViewIfNeeded();
  expect(await scrollY(page)).toBeGreaterThan(1000);
  await card.click();
  await expect(page.getByRole("heading", { name: "Mon 31" })).toBeVisible();
  await page.goBack();
  await expect(card).toBeInViewport();

  // Now cached: the detail renders at once, with no spinner to collapse the page
  await card.click();
  await expect(page.getByRole("heading", { name: "Mon 31" })).toBeVisible();
  expect(await scrollY(page)).toBe(0);

  // Back to where the list was; the browser's restoration isn't pixel exact
  await page.goBack();
  await expect(card).toBeInViewport();
  expect(await scrollY(page)).toBeGreaterThan(1000);
});

test("Back from one detail page to another restores its offset", async ({
  page,
}) => {
  await page.goto("/game/scarlet/pokemon/mon-1");
  await expect(page.getByRole("heading", { name: "Mon 1" })).toBeVisible();

  await scrollTo(page, 700);
  await page
    .getByTestId("evolution-stage")
    .filter({ hasText: "Mon 2" })
    .click();
  await expect(page.getByRole("heading", { name: "Mon 2" })).toBeVisible();
  expect(await scrollY(page)).toBe(0);

  await page.goBack();
  await expect(page.getByRole("heading", { name: "Mon 1" })).toBeVisible();
  await expect
    .poll(async () => Math.abs((await scrollY(page)) - 700))
    .toBeLessThan(50);
});
