import type { Page, Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

export const GAME = { id: 1, name: "scarlet", generation: 9, region: "paldea" };

export const SPRIGATITO = {
  id: 906,
  name: "sprigatito",
  types: ["grass"],
  sprite_url: "",
  pokedex_number: 1,
};

export const SPRIGATITO_DETAIL = {
  pokemon: {
    ...SPRIGATITO,
    shiny_sprite_url: "",
    base_stats: {
      hp: 40,
      attack: 61,
      defense: 54,
      "special-attack": 45,
      "special-defense": 45,
      speed: 65,
    },
  },
  moves: [{ name: "scratch", level_learned: 1, learn_method: "level-up" }],
  evolution_chain: [
    { name: "sprigatito", evolution_details: [] },
    {
      name: "floragato",
      evolution_details: [{ trigger: "level-up", min_level: 16 }],
    },
  ],
};

export const GAME_PAGE_RESPONSE = {
  game: GAME,
  pokemons: [SPRIGATITO],
  available_types: ["grass"],
  pagination: {
    total: 1,
    limit: 40,
    offset: 0,
    has_more: false,
    seeding: false,
  },
};

// ---------------------------------------------------------------------------
// Route helpers
//
// All API requests from the browser go to http://localhost:3000 (the default
// API_URL in api.ts). Playwright intercepts them before they reach the network
// so the backend does not need to be reachable from the test runner.
// ---------------------------------------------------------------------------

const API = "http://localhost:3000";

/** Responds with JSON and 200 */
function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/** Register the routes that every test needs: game list + game detail page */
export async function mockPublicGameRoutes(page: Page) {
  await page.route(`${API}/api/v1/games`, (r) => json(r, [GAME]));
  // The first page request is ?limit=40 with no offset (offset=0 is falsy in api.ts)
  await page.route(`${API}/api/v1/games/1*`, (r) =>
    json(r, GAME_PAGE_RESPONSE),
  );
}

/** Register routes that require authentication */
export async function mockAuthenticatedRoutes(
  page: Page,
  opts: { favorites?: unknown[]; caught?: unknown[] } = {},
) {
  const favorites = opts.favorites ?? [];
  const caught = opts.caught ?? [];

  let favoritesCallCount = 0;

  await page.route(`${API}/api/v1/favorites`, async (route) => {
    if (route.request().method() === "POST") {
      return json(route, { id: 5, pokemon_id: SPRIGATITO.id }, 201);
    }
    // First call: return the initial list. Subsequent calls (after invalidation
    // from a mutation) return the pokemon as favorited.
    favoritesCallCount++;
    if (favoritesCallCount === 1) {
      return json(route, favorites);
    }
    return json(route, [{ ...SPRIGATITO, favorite_id: 5 }]);
  });

  await page.route(`${API}/api/v1/caught_pokemons*`, (r) => json(r, caught));
}

/** Seed localStorage with a fake JWT + user before the page loads */
export async function seedAuthState(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("pokedex_token", "fake-test-jwt");
    localStorage.setItem(
      "pokedex_user",
      JSON.stringify({
        id: 1,
        email: "test@example.com",
        name: "Test User",
        avatar_url: "",
      }),
    );
  });
}
