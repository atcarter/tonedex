import { test, expect } from "@playwright/test";
import { mockPublicGameRoutes, SPRIGATITO_DETAIL } from "./fixtures";

const API = "http://localhost:3000";

test.describe("Unauthenticated browsing", () => {
  test.beforeEach(async ({ page }) => {
    await mockPublicGameRoutes(page);
    await page.route(`${API}/api/v1/pokemon/sprigatito*`, (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SPRIGATITO_DETAIL),
      }),
    );
  });

  test("game page renders Pokemon cards from the API", async ({ page }) => {
    await page.goto("/game/1");

    await expect(page.getByText("Sprigatito")).toBeVisible();
  });

  test("Pokemon card shows the type badge", async ({ page }) => {
    await page.goto("/game/1");

    await expect(page.getByText("Sprigatito")).toBeVisible();
    // Type badges render the type name in lowercase (e.g. "grass", not "Grass").
    // Use first() because the same type chip may appear in both the filter bar
    // and the card itself.
    await expect(page.getByText("grass").first()).toBeVisible();
  });

  test("clicking a Pokemon card navigates to its detail page", async ({
    page,
  }) => {
    await page.goto("/game/1");

    await expect(page.getByText("Sprigatito")).toBeVisible();
    await page.getByText("Sprigatito").click();

    await expect(page).toHaveURL(/\/game\/1\/pokemon\/sprigatito/);
    // Wait for detail content to load before asserting the heading
    await expect(page.locator("text=Loading Pokémon...")).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: /sprigatito/i }),
    ).toBeVisible();
  });

  test("favorite button is disabled when signed out", async ({ page }) => {
    await page.goto("/game/1");

    await expect(page.getByText("Sprigatito")).toBeVisible();
    // All icon buttons on the card are disabled when there is no currentUser
    const disabledBtn = page.locator("button[disabled]").first();
    await expect(disabledBtn).toBeDisabled();
  });

  test("evolution chain appears on the detail page", async ({ page }) => {
    await page.goto("/game/1/pokemon/sprigatito");

    await expect(page.getByText("Floragato")).toBeVisible();
  });
});

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await mockPublicGameRoutes(page);
    await page.route(`${API}/api/v1/pokemon/sprigatito*`, (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SPRIGATITO_DETAIL),
      }),
    );
  });

  test("back button on detail page returns to the game page", async ({
    page,
  }) => {
    await page.goto("/game/1");
    await expect(page.getByText("Sprigatito")).toBeVisible();
    await page.getByText("Sprigatito").click();
    await expect(page).toHaveURL(/pokemon\/sprigatito/);

    // Wait for the detail page to finish loading so the layout is stable
    await expect(page.locator("text=Loading Pokémon...")).not.toBeVisible();
    await page.getByRole("button", { name: /back/i }).click();

    await expect(page).toHaveURL(/\/game\/1$/);
  });
});

test.describe("Seeding state", () => {
  test("shows a banner when the game is still seeding", async ({ page }) => {
    await page.route(`${API}/api/v1/games`, (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: 1, name: "scarlet", generation: 9, region: "paldea" },
        ]),
      }),
    );
    await page.route(`${API}/api/v1/games/1*`, (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          game: { id: 1, name: "scarlet", generation: 9, region: "paldea" },
          pokemons: [],
          available_types: [],
          pagination: {
            total: 0,
            limit: 40,
            offset: 0,
            has_more: false,
            seeding: true,
          },
        }),
      }),
    );

    await page.goto("/game/1");

    // GamePage renders a SeedingBanner with this specific copy when seeding: true
    await expect(
      page.getByText(/Pokémon data is being loaded in the background/),
    ).toBeVisible();
  });
});
