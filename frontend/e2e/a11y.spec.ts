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

const FLORAGATO_DETAIL = {
  ...SPRIGATITO_DETAIL,
  pokemon: { ...SPRIGATITO_DETAIL.pokemon, ...FLORAGATO },
};

const TEAM = [
  SPRIGATITO,
  FLORAGATO,
  { id: 909, name: "fuecoco", types: ["fire"], sprite_url: "" },
];

const BLOCKING_IMPACTS = new Set(["serious", "critical"]);

// Violations in files other specs own; drop each once its file is fixed.
const EXCLUDED = [
  // PokemonSearch.tsx: aria-expanded without a combobox role; unnamed submit
  "header form",
  // GameSelector.tsx: unnamed Select
  "header .MuiSelect-select",
];

// PokemonCard.tsx (first child of each favorite): unnamed button, dex number contrast
const FAVORITE_CARD = '[draggable="true"] > :first-child';

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
    r.fulfill(json(SPRIGATITO_DETAIL)),
  );
  await page.route(`${API}/api/v1/pokemon/floragato*`, (r) =>
    r.fulfill(json(FLORAGATO_DETAIL)),
  );
}

interface Route {
  name: string;
  path: string;
  signedIn?: boolean;
  exclude?: string[];
  ready: (page: Page) => Promise<void>;
}

const ROUTES: Route[] = [
  {
    name: "detail",
    path: "/game/1/pokemon/sprigatito",
    ready: async (page) => {
      await expect(page.getByText("Scratch")).toBeVisible();
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
    path: "/game/1/team",
    ready: async (page) => {
      await expect(page.getByText("Defensive Overview")).toBeVisible();
    },
  },
  {
    name: "favorites",
    path: "/favorites",
    signedIn: true,
    exclude: [FAVORITE_CARD],
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
          await mockAuthenticatedRoutes(page, {
            favorites: [
              { ...SPRIGATITO, favorite_id: 5 },
              { ...FLORAGATO, favorite_id: 6 },
            ],
          });
        }

        await page.goto(route.path);
        await route.ready(page);

        const axe = new AxeBuilder({ page });
        for (const selector of [...EXCLUDED, ...(route.exclude ?? [])]) {
          axe.exclude(selector);
        }
        const results = await axe.analyze();
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
