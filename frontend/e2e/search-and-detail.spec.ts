import { test, expect } from "@playwright/test";
import {
  SPRIGATITO,
  SPRIGATITO_DETAIL,
  mockPublicGameRoutes,
  seedAuthState,
} from "./fixtures";

const API = "http://localhost:3000";

const FLORAGATO = {
  id: 907,
  name: "floragato",
  types: ["grass"],
  sprite_url: "",
};

test.describe("Search", () => {
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

  test("an exact match navigates straight to the detail page", async ({
    page,
  }) => {
    await page.route(`${API}/api/v1/pokemon/search*`, (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: [SPRIGATITO], exact: true }),
      }),
    );
    await page.goto("/game/1");

    await page.getByLabel("search pokemon").fill("sprigatito");
    await page.getByLabel("search pokemon").press("Enter");

    // Search stays inside the selected game's context
    await expect(page).toHaveURL(/\/game\/1\/pokemon\/sprigatito/);
    await expect(
      page.getByRole("heading", { name: /sprigatito/i }),
    ).toBeVisible();
    await expect(page.getByText(/moves in scarlet/i)).toBeVisible();
    await expect(page.getByText("Scratch")).toBeVisible();
  });

  test("fallback results render a dropdown; picking one navigates", async ({
    page,
  }) => {
    await page.route(`${API}/api/v1/pokemon/search*`, (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [SPRIGATITO, FLORAGATO],
          exact: false,
        }),
      }),
    );
    await page.goto("/game/1");

    await page.getByLabel("search pokemon").fill("gato");
    await page.getByLabel("search pokemon").press("Enter");

    await expect(page.getByText("Floragato")).toBeVisible();
    await page.getByText("Sprigatito").last().click();

    await expect(page).toHaveURL(/\/game\/1\/pokemon\/sprigatito/);
  });

  test("no matches shows an error that Escape dismisses", async ({ page }) => {
    await page.route(`${API}/api/v1/pokemon/search*`, (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: [], exact: false }),
      }),
    );
    await page.goto("/game/1");

    await page.getByLabel("search pokemon").fill("zzz");
    await page.getByLabel("search pokemon").press("Enter");

    await expect(page.getByText("No Pokémon found")).toBeVisible();
    await page.getByLabel("search pokemon").press("Escape");
    await expect(page.getByText("No Pokémon found")).not.toBeVisible();
  });
});

test.describe("Search autocomplete", () => {
  test.beforeEach(async ({ page }) => {
    await mockPublicGameRoutes(page);
    await page.route(`${API}/api/v1/pokemon/suggestions*`, (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            {
              ...SPRIGATITO,
              sprite_url: "http://localhost:3000/sprites/906.png",
            },
            { id: 907, name: "floragato", types: ["grass"], sprite_url: "" },
          ],
        }),
      }),
    );
    await page.route(`${API}/api/v1/pokemon/sprigatito*`, (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SPRIGATITO_DETAIL),
      }),
    );
  });

  test("typing shows sprite suggestions and clicking one navigates", async ({
    page,
  }) => {
    await page.goto("/game/1");

    await page.getByLabel("search pokemon").fill("gato");

    const listbox = page.getByRole("listbox");
    await expect(listbox.getByText("Floragato")).toBeVisible();
    await expect(listbox.locator("img").first()).toBeVisible();

    // No Enter pressed — this is pure autocomplete
    await listbox.getByText("Sprigatito").click();
    await expect(page).toHaveURL(/\/game\/1\/pokemon\/sprigatito/);
  });

  test("arrow keys highlight and Enter selects a suggestion", async ({
    page,
  }) => {
    await page.goto("/game/1");

    const input = page.getByLabel("search pokemon");
    await input.fill("gato");
    await expect(page.getByRole("listbox")).toBeVisible();

    await input.press("ArrowDown");
    await expect(
      page.getByRole("option", { selected: true }).getByText("Sprigatito"),
    ).toBeVisible();

    await input.press("Enter");
    await expect(page).toHaveURL(/\/game\/1\/pokemon\/sprigatito/);
  });
});

test.describe("Compare page", () => {
  test("picking two pokemon shows side-by-side stats with winners highlighted", async ({
    page,
  }) => {
    await mockPublicGameRoutes(page);
    await page.route(`${API}/api/v1/pokemon/suggestions*`, (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: [SPRIGATITO, FLORAGATO] }),
      }),
    );
    await page.route(`${API}/api/v1/pokemon/sprigatito*`, (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SPRIGATITO_DETAIL),
      }),
    );
    await page.route(`${API}/api/v1/pokemon/floragato*`, (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...SPRIGATITO_DETAIL,
          pokemon: {
            ...SPRIGATITO_DETAIL.pokemon,
            id: 907,
            name: "floragato",
            base_stats: {
              hp: 61,
              attack: 80,
              defense: 63,
              "special-attack": 60,
              "special-defense": 63,
              speed: 83,
            },
          },
        }),
      }),
    );

    await page.goto("/compare");

    await page.getByLabel("First Pokémon...").fill("spri");
    await page.getByRole("option", { name: /sprigatito/i }).click();
    await expect(
      page.getByRole("heading", { name: /sprigatito/i }),
    ).toBeVisible();

    await page.getByLabel("Second Pokémon...").fill("flor");
    await page.getByRole("option", { name: /floragato/i }).click();
    await expect(
      page.getByRole("heading", { name: /floragato/i }),
    ).toBeVisible();

    // Both stat columns render, selection is shareable via the URL
    await expect(page.getByText("BASE STAT TOTAL")).toHaveCount(2);
    await expect(page).toHaveURL(/left=sprigatito/);
    await expect(page).toHaveURL(/right=floragato/);

    // Deep-linking the same comparison renders directly
    await page.goto("/compare?left=sprigatito&right=floragato");
    await expect(
      page.getByRole("heading", { name: /sprigatito/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /floragato/i }),
    ).toBeVisible();
  });
});

test.describe("Move drawer", () => {
  test("expanding a move lazily loads its details", async ({ page }) => {
    await mockPublicGameRoutes(page);
    await page.route(`${API}/api/v1/pokemon/sprigatito*`, (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SPRIGATITO_DETAIL),
      }),
    );
    let moveRequested = false;
    await page.route(`${API}/api/v1/moves/scratch`, (r) => {
      moveRequested = true;
      return r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          name: "scratch",
          type: "normal",
          power: 40,
          accuracy: 100,
          pp: 35,
          damage_class: "physical",
        }),
      });
    });

    await page.goto("/game/1/pokemon/sprigatito");
    await expect(page.getByText("Scratch")).toBeVisible();
    // Not fetched until the row is expanded
    expect(moveRequested).toBe(false);

    await page.getByText("Scratch").click();

    await expect(page.getByText("Power")).toBeVisible();
    await expect(page.getByText("100%")).toBeVisible();
    expect(moveRequested).toBe(true);
  });
});

test.describe("Caught tracker", () => {
  test("toggling caught POSTs and fills the marker", async ({ page }) => {
    await mockPublicGameRoutes(page);
    await seedAuthState(page);
    await page.route(`${API}/api/v1/favorites`, (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      }),
    );

    // GET returns empty until the POST lands, then the caught entry
    let caughtEntries: unknown[] = [];
    await page.route(`${API}/api/v1/caught_pokemons*`, (route) => {
      if (route.request().method() === "POST") {
        caughtEntries = [{ id: 42, pokemon_id: SPRIGATITO.id, game_id: 1 }];
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(caughtEntries[0]),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(caughtEntries),
      });
    });

    await page.goto("/game/1");
    await expect(page.getByText("Sprigatito")).toBeVisible();

    const postRequest = page.waitForRequest(
      (req) =>
        req.url().includes("/api/v1/caught_pokemons") &&
        req.method() === "POST",
    );
    // The caught toggle is the top-left icon button on the card
    await page.locator('[data-testid="PanoramaFishEyeIcon"]').first().click();
    await postRequest;

    // Optimistic update + refetch settle into the filled marker
    await expect(
      page.locator('[data-testid="Brightness1Icon"]').first(),
    ).toBeVisible();
    // Signed-in counter reflects the catch
    await expect(page.getByText(/1 \/ 1 caught/)).toBeVisible();
  });
});
