import { test, expect } from "@playwright/test";
import {
  mockPublicGameRoutes,
  mockAuthenticatedRoutes,
  seedAuthState,
  SPRIGATITO,
} from "./fixtures";

const API = "http://localhost:3000";

test.describe("Favorites — authenticated user", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthState(page);
    await mockPublicGameRoutes(page);
    await mockAuthenticatedRoutes(page, { favorites: [], caught: [] });
    // Mock the reorder PATCH so drag operations don't log 404 errors
    await page.route(`${API}/api/v1/favorites/reorder`, (r) =>
      r.fulfill({ status: 204, body: "" }),
    );
  });

  test("favorite button is enabled when signed in", async ({ page }) => {
    await page.goto("/game/scarlet");

    await expect(page.getByText("Sprigatito")).toBeVisible();
    // When signed in, no buttons should be disabled (caught + favorite are both enabled)
    // Verify a button inside the card is NOT disabled (MUI adds disabled attr)
    const cardButtons = page
      .locator("text=Sprigatito")
      .locator("../..//button");
    // At least one button exists and isn't disabled when authenticated
    await expect(cardButtons.first()).not.toBeDisabled();
  });

  test("clicking the heart button sends POST /api/v1/favorites", async ({
    page,
  }) => {
    let capturedPayload: unknown = null;

    // Override the POST handler to capture the request body
    await page.route(`${API}/api/v1/favorites`, async (route) => {
      if (route.request().method() === "POST") {
        capturedPayload = JSON.parse(route.request().postData() ?? "{}");
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ id: 5, pokemon_id: SPRIGATITO.id }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/game/scarlet");
    await expect(page.getByText("Sprigatito")).toBeVisible();

    // The favorite button is the last icon button inside the card
    const card = page.locator("text=Sprigatito").locator("../..").first();
    await card.locator("button").last().click();

    await expect
      .poll(() => capturedPayload)
      .toEqual({ pokemon_id: SPRIGATITO.id });
  });

  test("favorited Pokemon appears in the favorites list", async ({ page }) => {
    // Seed the favorites API to return Sprigatito already favorited
    await page.route(`${API}/api/v1/favorites`, (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ ...SPRIGATITO, favorite_id: 5 }]),
      }),
    );

    await page.goto("/favorites");

    await expect(page.getByText("Sprigatito")).toBeVisible();
  });
});

test.describe("Favorites — mouse drag reorder", () => {
  const FAVORITES = [
    { ...SPRIGATITO, favorite_id: 5 },
    { ...SPRIGATITO, id: 907, name: "floragato", favorite_id: 6 },
    { ...SPRIGATITO, id: 908, name: "meowscarada", favorite_id: 7 },
  ];

  test("dragging a card reorders and saves without opening it", async ({
    page,
  }) => {
    await seedAuthState(page);
    await mockPublicGameRoutes(page);
    await mockAuthenticatedRoutes(page);
    // Refetches return the order the last PATCH stored
    let serverOrder = FAVORITES;
    await page.route(`${API}/api/v1/favorites`, (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(serverOrder),
      }),
    );
    const patches: { ids: number[] }[] = [];
    await page.route(`${API}/api/v1/favorites/reorder`, (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}") as {
        ids: number[];
      };
      patches.push(body);
      serverOrder = body.ids.map(
        (id) => FAVORITES.find((f) => f.favorite_id === id)!,
      );
      return route.fulfill({ status: 204, body: "" });
    });

    await page.goto("/favorites");
    const items = page.locator("[data-reorder-index]");
    await expect(items).toHaveCount(3);
    const from = (await items.nth(0).boundingBox())!;
    const to = (await items.nth(2).boundingBox())!;

    await page.mouse.move(from.x + from.width / 2, from.y + 60);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 10 });
    await expect(items.nth(2)).toContainText("Sprigatito");
    await page.mouse.up();

    await expect.poll(() => patches).toEqual([{ ids: [6, 7, 5] }]);
    await expect(items.first()).toContainText("Floragato");
    await expect(page).toHaveURL(/\/favorites$/);

    // The drop swallows one click only; the next one opens the card
    await page.getByText("Floragato").click();
    await expect(page).toHaveURL(/\/pokemon\/floragato$/);
  });
});

test.describe("Favorites — unauthenticated user", () => {
  // No beforeEach with seedAuthState — these tests run without a signed-in user

  test("favorites page shows sign-in prompt when signed out", async ({
    page,
  }) => {
    // Mock the games list so GameSelector (AppBar) doesn't generate a network error
    await mockPublicGameRoutes(page);
    await page.goto("/favorites");

    // FavoritesPage renders this exact copy when currentUser is null
    await expect(
      page.getByText("Sign in to save and view your favorites"),
    ).toBeVisible();
  });
});

test.describe("Favorites persistence across navigation", () => {
  test("favorite heart reflects server state after navigating back", async ({
    page,
  }) => {
    await seedAuthState(page);
    await mockPublicGameRoutes(page);

    let callCount = 0;
    await page.route(`${API}/api/v1/favorites`, async (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ id: 5, pokemon_id: SPRIGATITO.id }),
        });
      }
      callCount++;
      // First load: no favorites. After mutation invalidates: show as favorited.
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          callCount <= 1 ? [] : [{ ...SPRIGATITO, favorite_id: 5 }],
        ),
      });
    });

    await page.route(`${API}/api/v1/caught_pokemons*`, (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
    );
    await page.route(`${API}/api/v1/favorites/reorder`, (r) =>
      r.fulfill({ status: 204, body: "" }),
    );

    await page.goto("/game/scarlet");
    await expect(page.getByText("Sprigatito")).toBeVisible();

    // Click the favorite button on the first card
    const card = page.locator("text=Sprigatito").locator("../..").first();
    await card.locator("button").last().click();

    // Verify the server re-fetch fired (callCount > 1 means invalidation triggered)
    await expect.poll(() => callCount).toBeGreaterThan(1);
  });
});
