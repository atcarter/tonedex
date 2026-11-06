import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  SPRIGATITO,
  SPRIGATITO_DETAIL,
  mockAuthenticatedRoutes,
  mockPublicGameRoutes,
  seedAuthState,
} from "./fixtures";

// No serious or critical axe violations on each page, desktop and phone.

const API = "http://localhost:3000";

const FLORAGATO = {
  id: 907,
  name: "floragato",
  types: ["grass"],
  sprite_url: "",
  pokedex_number: 2,
};

// The detail audit runs with an ability panel open
const SPRIGATITO_WITH_ABILITIES = {
  ...SPRIGATITO_DETAIL,
  species: {
    genus: "Grass Cat Pokémon",
    flavor_text: "Its fluffy fur is similar in composition to plants.",
    height: 4,
    weight: 41,
    abilities: [
      {
        name: "overgrow",
        hidden: false,
        description: "Powers up Grass-type moves when the Pokémon's HP is low.",
        short_effect:
          "Strengthens grass moves to inflict 1.5× damage at 1/3 max HP or less.",
      },
      {
        name: "protean",
        hidden: true,
        description: null,
        short_effect: null,
      },
    ],
  },
};

const FLORAGATO_DETAIL = {
  ...SPRIGATITO_DETAIL,
  pokemon: { ...SPRIGATITO_DETAIL.pokemon, ...FLORAGATO },
};

const TEAM = [
  SPRIGATITO,
  FLORAGATO,
  { id: 909, name: "fuecoco", types: ["fire"], sprite_url: "" },
  // 4× and 0× tiers in the defensive overview
  { id: 130, name: "gyarados", types: ["water", "flying"], sprite_url: "" },
  // ¼× tier (fire and water vs water/dragon)
  { id: 230, name: "kingdra", types: ["water", "dragon"], sprite_url: "" },
];

const BLOCKING_IMPACTS = new Set(["serious", "critical"]);

function json(body: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function mockPages(page: Page) {
  await mockPublicGameRoutes(page);
  await page.route(`${API}/api/v1/pokemon/sprigatito*`, (r) =>
    r.fulfill(json(SPRIGATITO_WITH_ABILITIES)),
  );
  await page.route(`${API}/api/v1/pokemon/floragato*`, (r) =>
    r.fulfill(json(FLORAGATO_DETAIL)),
  );
}

interface Route {
  name: string;
  path: string;
  signedIn?: boolean;
  ready: (page: Page) => Promise<void>;
}

const ROUTES: Route[] = [
  {
    name: "detail",
    path: "/game/scarlet/pokemon/sprigatito",
    ready: async (page) => {
      await expect(page.getByText("Scratch")).toBeVisible();
      await page.getByRole("button", { name: "Overgrow" }).click();
      await expect(
        page.getByRole("region", { name: "Overgrow ability" }),
      ).toBeVisible();
    },
  },
  {
    name: "compare (empty)",
    path: "/compare",
    ready: async (page) => {
      await expect(page.getByText("Pick a Pokémon to compare")).toHaveCount(2);
    },
  },
  {
    name: "compare",
    path: "/compare?left=sprigatito&right=floragato",
    ready: async (page) => {
      await expect(page.getByText("BASE STAT TOTAL")).toHaveCount(2);
    },
  },
  {
    name: "team builder",
    path: "/game/scarlet/team",
    ready: async (page) => {
      await expect(page.getByText("Defensive Overview")).toBeVisible();
    },
  },
  {
    name: "favorites",
    path: "/favorites",
    signedIn: true,
    ready: async (page) => {
      await expect(
        page.getByRole("button", { name: "move floragato earlier" }),
      ).toBeAttached();
    },
  },
  {
    name: "404",
    path: "/nope",
    ready: async (page) => {
      await expect(
        page.getByRole("heading", { name: "Page not found" }),
      ).toBeVisible();
    },
  },
];

const VIEWPORTS = [
  { label: "desktop", use: {} },
  {
    label: "phone",
    use: {
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    },
  },
];

for (const viewport of VIEWPORTS) {
  test.describe(`axe audit (${viewport.label})`, () => {
    test.use(viewport.use);

    for (const route of ROUTES) {
      test(`${route.name} has no serious or critical violations`, async ({
        page,
      }) => {
        await mockPages(page);
        await page.addInitScript((team) => {
          localStorage.setItem("pokedex_team_1", team);
        }, JSON.stringify(TEAM));
        if (route.signedIn) {
          await seedAuthState(page);
          await mockAuthenticatedRoutes(page);
          // Every card refetches favorites on mount, so answer each call the same.
          await page.route(`${API}/api/v1/favorites`, (r) =>
            r.fulfill(
              json([
                { ...SPRIGATITO, favorite_id: 5 },
                { ...FLORAGATO, favorite_id: 6 },
              ]),
            ),
          );
        }

        await page.goto(route.path);
        await route.ready(page);

        const results = await new AxeBuilder({ page }).analyze();
        const blocking = results.violations.filter((v) =>
          BLOCKING_IMPACTS.has(v.impact ?? ""),
        );

        const summary = blocking.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.map(
            (n) => `${n.target.join(" ")} ${n.html.slice(0, 160)}`,
          ),
        }));
        expect(summary).toEqual([]);
      });
    }
  });
}
