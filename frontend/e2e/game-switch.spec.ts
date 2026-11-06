import { test, expect, type Page } from "@playwright/test";
import {
  GAME,
  GAME_PAGE_RESPONSE,
  SPRIGATITO,
  SPRIGATITO_DETAIL,
  mockPublicGameRoutes,
} from "./fixtures";

// Choosing a game in the header picker keeps the page when it can.

const API = "http://localhost:3000";

const VIOLET = { id: 2, name: "violet", generation: 9, region: "paldea" };
const SWORD = { id: 3, name: "sword", generation: 8, region: "galar" };

function json(body: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function mockGames(page: Page) {
  await mockPublicGameRoutes(page);
  await page.route(`${API}/api/v1/games`, (r) =>
    r.fulfill(json([GAME, VIOLET, SWORD])),
  );
  for (const game of [VIOLET, SWORD]) {
    await page.route(`${API}/api/v1/games/${game.id}*`, (r) =>
      r.fulfill(json({ ...GAME_PAGE_RESPONSE, game })),
    );
  }
  // Sprigatito is in Scarlet and Violet's dexes but not Sword's.
  await page.route(`${API}/api/v1/pokemon/sprigatito*`, (r) => {
    const gameId = new URL(r.request().url()).searchParams.get("game_id");
    const inDex = gameId !== String(SWORD.id);
    return r.fulfill(
      json({
        ...SPRIGATITO_DETAIL,
        pokemon: {
          ...SPRIGATITO_DETAIL.pokemon,
          pokedex_number: inDex ? SPRIGATITO.pokedex_number : null,
        },
      }),
    );
  });
}

async function chooseGame(page: Page, label: string) {
  await page.getByRole("combobox", { name: "select game" }).click();
  await page.getByRole("option", { name: label }).click();
}

test.describe("Game switch", () => {
  test.beforeEach(async ({ page }) => {
    await mockGames(page);
  });

  test("on the team builder, stays on the team builder for the new game", async ({
    page,
  }) => {
    await page.addInitScript(
      (team) => {
        localStorage.setItem("pokedex_team_1", team);
      },
      JSON.stringify([SPRIGATITO]),
    );
    await page.goto("/game/scarlet/team");
    await expect(page.getByText("empty slot")).toHaveCount(5);

    await chooseGame(page, "Violet");

    await expect(page).toHaveURL(/\/game\/violet\/team$/);
    await expect(page.getByText("Team Builder")).toBeVisible();
    // Violet has its own team, empty so far
    await expect(page.getByText("empty slot")).toHaveCount(6);
  });

  test("on the dex, goes to the new game's dex", async ({ page }) => {
    await page.goto("/game/scarlet");
    await expect(page.getByText("#001")).toBeVisible();

    await chooseGame(page, "Violet");

    await expect(page).toHaveURL(/\/game\/violet$/);
  });

  test("on a detail page, stays put when the Pokémon is in the new game", async ({
    page,
  }) => {
    await page.goto("/game/scarlet/pokemon/sprigatito");
    await expect(page.getByText("Scratch")).toBeVisible();

    await chooseGame(page, "Violet");

    await expect(page).toHaveURL(/\/game\/violet\/pokemon\/sprigatito$/);
    await expect(page.getByText(/moves in violet/i)).toBeVisible();
  });

  test("on a detail page, goes to the new game's dex when the Pokémon isn't in it", async ({
    page,
  }) => {
    await page.goto("/game/scarlet/pokemon/sprigatito");
    await expect(page.getByText("Scratch")).toBeVisible();

    await chooseGame(page, "Sword");

    await expect(page).toHaveURL(/\/game\/sword$/);
  });
});
