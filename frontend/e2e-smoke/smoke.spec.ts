import { test, expect } from "@playwright/test";

// Read-only checks against the live stack (see playwright.smoke.config.ts,
// which guarantees both variables are set). Only GETs and page loads.
const API = process.env.SMOKE_API_URL!;

// Scarlet's id on production, and Sprigatito's PokeAPI id (its sprite name).
const SCARLET_ID = 34;
const SPRIGATITO_POKEAPI_ID = 906;

test.describe("API", () => {
  test("GET /up reports the backend up", async ({ request }) => {
    const res = await request.get(`${API}/up`);

    expect(res.status()).toBe(200);
    expect((await res.json()).status).toBe("up");
  });

  test("GET /api/v1/games includes Scarlet", async ({ request }) => {
    const res = await request.get(`${API}/api/v1/games`);

    expect(res.status()).toBe(200);
    const games: { name: string }[] = await res.json();
    expect(games.map((g) => g.name)).toContain("scarlet");
  });
});

test.describe("Frontend", () => {
  test("Scarlet's dex shows Sprigatito with no seeding banner", async ({
    page,
  }) => {
    await page.goto(`/game/${SCARLET_ID}`);

    await expect(page.getByText("Sprigatito", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/being loaded in the background/)).toHaveCount(
      0,
    );
  });

  test("a deep link to Sprigatito's detail page renders it", async ({
    page,
  }) => {
    await page.goto(`/game/${SCARLET_ID}/pokemon/sprigatito`);

    await expect(
      page.getByRole("heading", { name: "Sprigatito", exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("img", { name: "sprigatito", exact: true }),
    ).toHaveAttribute(
      "src",
      new RegExp(`/sprites/${SPRIGATITO_POKEAPI_ID}\\.png`),
    );
  });
});
