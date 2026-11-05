import { test, expect, type Page } from "@playwright/test";
import {
  GAME,
  GAME_PAGE_RESPONSE,
  SPRIGATITO,
  SPRIGATITO_DETAIL,
  mockPublicGameRoutes,
} from "./fixtures";

// Picker collapse, slot links and the defense grid, desktop and phone.

const API = "http://localhost:3000";

const DEX = [
  SPRIGATITO,
  { id: 907, name: "floragato", types: ["grass"] },
  { id: 909, name: "fuecoco", types: ["fire"] },
  { id: 912, name: "quaxly", types: ["water"] },
  { id: 921, name: "pawmi", types: ["electric"] },
  { id: 935, name: "charcadet", types: ["fire", "ghost"] },
  { id: 950, name: "klawf", types: ["rock"] },
  { id: 957, name: "tinkatink", types: ["fairy", "steel"] },
].map((p, i) => ({ sprite_url: "", pokedex_number: i + 1, ...p }));

async function openTeamBuilder(page: Page, team: typeof DEX = []) {
  await mockPublicGameRoutes(page);
  // Registered last, so it wins over the one-Pokémon fixture
  await page.route(`${API}/api/v1/games/1*`, (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...GAME_PAGE_RESPONSE,
        pokemons: DEX,
        pagination: { ...GAME_PAGE_RESPONSE.pagination, total: DEX.length },
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
  await page.addInitScript((value) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("pokedex_team_1", value);
      sessionStorage.setItem("seeded", "1");
    }
  }, JSON.stringify(team));
  await page.goto(`/game/${GAME.id}/team`);
}

const pickerToggle = (page: Page) =>
  page.getByRole("button", { name: /picker/ });
const search = (page: Page) => page.getByLabel("Add a Pokémon");

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
  test.describe(`team builder (${viewport.label})`, () => {
    test.use(viewport.use);

    test("adding the sixth member collapses the picker and shows the analysis", async ({
      page,
    }) => {
      await openTeamBuilder(page, DEX.slice(0, 5));
      await expect(pickerToggle(page)).toHaveAttribute("aria-expanded", "true");

      await page.getByRole("button", { name: "Klawf" }).click();

      await expect(page.getByTestId("team-slot")).toHaveCount(6);
      await expect(pickerToggle(page)).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await expect(search(page)).toBeHidden();
      await expect(
        page.getByRole("button", { name: "Tinkatink" }),
      ).toBeHidden();
      await expect(page.getByText("Defensive Overview")).toBeInViewport();
    });

    test("removing a member re-opens a picker that collapsed itself", async ({
      page,
    }) => {
      await openTeamBuilder(page, DEX.slice(0, 6));
      await expect(pickerToggle(page)).toHaveAttribute(
        "aria-expanded",
        "false",
      );

      await page.getByRole("button", { name: "remove fuecoco" }).click();

      await expect(pickerToggle(page)).toHaveAttribute("aria-expanded", "true");
      await expect(search(page)).toBeVisible();
    });

    test("the keyboard toggles the picker, and a hand-collapsed picker stays shut", async ({
      page,
    }) => {
      await openTeamBuilder(page, DEX.slice(0, 2));
      const toggle = pickerToggle(page);

      await toggle.focus();
      await page.keyboard.press("Enter");
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(search(page)).toBeHidden();
      // Slots and analysis sit straight under the toggle
      await expect(page.getByText("Defensive Overview")).toBeInViewport();

      await page.keyboard.press("Space");
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(search(page)).toBeVisible();

      await toggle.click();
      await page.getByRole("button", { name: "remove floragato" }).click();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
    });

    test("a slot opens the member's detail page; remove does not navigate", async ({
      page,
    }) => {
      await openTeamBuilder(page, DEX.slice(0, 3));

      await page.getByRole("button", { name: "remove fuecoco" }).click();
      await expect(page.getByTestId("team-slot")).toHaveCount(2);
      await expect(page).toHaveURL(/\/game\/1\/team$/);

      await page.getByRole("link", { name: /Sprigatito/ }).click();
      await expect(page).toHaveURL(/\/game\/1\/pokemon\/sprigatito$/);
      await expect(page.getByText("Scratch")).toBeVisible();
    });

    test("no defensive overview cell overflows", async ({ page }) => {
      await openTeamBuilder(page, DEX.slice(0, 6));
      await expect(page.getByText("Defensive Overview")).toBeVisible();

      const cells = page.locator("[data-testid=defense-cell]");
      await expect(cells).toHaveCount(18);
      const overflowing = await cells.evaluateAll((els) =>
        els
          .filter((el) => el.scrollWidth > el.clientWidth)
          .map((el) => el.textContent),
      );
      expect(overflowing).toEqual([]);
    });
  });
}
