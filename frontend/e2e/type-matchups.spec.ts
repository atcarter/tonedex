import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { GAME, SPRIGATITO_DETAIL, mockPublicGameRoutes } from "./fixtures";

// The detail page's matchup chart, with Bronzong's Levitate folded in and tagged.

const API = "http://localhost:3000";

const ability = (name: string, hidden = false) => ({
  name,
  hidden,
  description: null,
  short_effect: null,
});

const BRONZONG_DETAIL = {
  ...SPRIGATITO_DETAIL,
  pokemon: {
    ...SPRIGATITO_DETAIL.pokemon,
    id: 437,
    name: "bronzong",
    types: ["steel", "psychic"],
    pokedex_number: 183,
  },
  species: {
    genus: "Bronze Bell Pokémon",
    flavor_text: null,
    height: 13,
    weight: 1870,
    abilities: [
      ability("levitate"),
      ability("heatproof"),
      ability("heavy-metal", true),
    ],
  },
};

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
  test.describe(`type matchups (${viewport.label})`, () => {
    test.use(viewport.use);

    test.beforeEach(async ({ page }) => {
      await mockPublicGameRoutes(page);
      await page.route(`${API}/api/v1/pokemon/bronzong*`, (r) =>
        r.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(BRONZONG_DETAIL),
        }),
      );
    });

    test("charts the tiers with the ability folded in", async ({ page }) => {
      await page.goto(`/game/${GAME.name}/pokemon/bronzong`);

      const chart = page.getByTestId("type-matchups");
      await expect(
        chart
          .getByRole("list", { name: "2 times damage from" })
          .getByRole("listitem"),
      ).toHaveText(["fire", "ghost", "dark"]);
      // Bronzong may have Heatproof or Heavy Metal instead, hence the tag
      await expect(
        chart.getByRole("list", { name: "Immune to" }).getByRole("listitem"),
      ).toHaveText(["poison", "ground with Levitate"]);

      const pageOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(pageOverflow).toBe(false);
    });

    test("aligns a tagged chip with its untagged neighbour", async ({
      page,
    }) => {
      await page.goto(`/game/${GAME.name}/pokemon/bronzong`);

      const immune = page
        .getByTestId("type-matchups")
        .getByRole("list", { name: "Immune to" });
      const chips = immune.locator(".MuiChip-root");
      await expect(chips).toHaveCount(2);
      const poison = (await chips.nth(0).boundingBox())!;
      const ground = (await chips.nth(1).boundingBox())!;
      const tag = (await immune.getByText("with Levitate").boundingBox())!;

      expect(Math.abs(ground.y - poison.y)).toBeLessThanOrEqual(0.5);
      expect(ground.height).toBeCloseTo(poison.height, 1);
      const middle = (box: { y: number; height: number }) =>
        box.y + box.height / 2;
      expect(Math.abs(middle(tag) - middle(ground))).toBeLessThanOrEqual(1);
    });

    for (const colorScheme of ["light", "dark"] as const) {
      test(`passes axe in ${colorScheme} mode`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(`/game/${GAME.name}/pokemon/bronzong`);
        await expect(page.getByText("with Levitate")).toBeVisible();

        const results = await new AxeBuilder({ page })
          .include('[data-testid="type-matchups"]')
          .analyze();
        expect(results.violations.map((v) => v.id)).toEqual([]);
      });
    }
  });
}
