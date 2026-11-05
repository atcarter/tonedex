import { test, expect, type Page, type Route } from "@playwright/test";

// Phone layout: three-column grid, sideways chip rows, 44px card buttons.
test.use({
  viewport: { width: 375, height: 812 },
  isMobile: true,
  hasTouch: true,
});

const API = "http://localhost:3000";
const GAME = { id: 1, name: "red-blue", generation: 1, region: "kanto" };

const TYPES = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
];

// Some dual types wrap their badges onto a second line; others fit on one.
const NAMED: Record<number, { name: string; types: string[] }> = {
  0: { name: "annihilape", types: ["fighting", "ghost"] },
  1: { name: "meditite", types: ["fighting", "psychic"] },
  2: { name: "medicham", types: ["fighting", "psychic"] },
  3: { name: "squawkabilly-green-plumage", types: ["normal", "flying"] },
};

const POKEMONS = Array.from({ length: 40 }, (_, i) => ({
  id: 100_000 + i,
  name: i % 3 === 0 ? `crabominable-${i}` : `mon-${i}`,
  types:
    i % 2 === 0
      ? [TYPES[i % TYPES.length], TYPES[(i + 6) % TYPES.length]]
      : [TYPES[i % TYPES.length]],
  sprite_url: "",
  pokedex_number: i + 1,
  ...NAMED[i],
}));

const LONGEST_NAME = "Squawkabilly Green Plumage";

const GAME_PAGE_RESPONSE = {
  game: GAME,
  pokemons: POKEMONS,
  available_types: TYPES,
  pagination: {
    total: 151,
    limit: 40,
    offset: 0,
    has_more: false,
    seeding: false,
  },
};

function json(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function openDex(page: Page) {
  await page.route(`${API}/api/v1/games`, (r) => json(r, [GAME]));
  await page.route(`${API}/api/v1/games/1*`, (r) =>
    json(r, GAME_PAGE_RESPONSE),
  );
  await page.goto("/game/1");
  await expect(page.locator("[data-dex]")).toHaveCount(40);
}

const typeChip = (page: Page, type: string) =>
  page.getByRole("button", { name: type, exact: true });

test.describe("Phone dex", () => {
  test.beforeEach(async ({ page }) => {
    await openDex(page);
  });

  test("shows three columns of compact cards without widening the page", async ({
    page,
  }) => {
    const cards = page.locator("[data-dex]");
    const lefts = new Set<number>();
    for (let i = 0; i < 3; i++) {
      lefts.add(Math.round((await cards.nth(i).boundingBox())!.x));
    }
    expect(lefts.size).toBe(3);

    const heights = await cards.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().height),
    );
    expect(Math.max(...heights)).toBeLessThanOrEqual(150);

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(375);
  });

  test("sizes every card the same whatever its name or types", async ({
    page,
  }) => {
    const boxes = await page.locator("[data-dex] > *").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { width: r.width, height: r.height };
      }),
    );
    expect(boxes).toHaveLength(40);
    for (const box of boxes) {
      expect(Math.abs(box.width - boxes[0].width)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.height - boxes[0].height)).toBeLessThanOrEqual(1);
    }

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(375);
  });

  test("truncates a long name and keeps both type badges inside the card", async ({
    page,
  }) => {
    // The full name stays in the DOM for assistive tech; only the paint is cut.
    const name = page.getByText(LONGEST_NAME, { exact: true });
    expect(await name.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
      true,
    );

    const badgesOutside = await page
      .locator("[data-dex] > *")
      .evaluateAll((cards) =>
        cards.flatMap((card) => {
          const c = card.getBoundingClientRect();
          return [...card.querySelectorAll(".MuiChip-root")]
            .map((badge) => badge.getBoundingClientRect())
            .filter(
              (b) =>
                b.width === 0 ||
                b.left < c.left ||
                b.right > c.right ||
                b.top < c.top ||
                b.bottom > c.bottom,
            );
        }),
      );
    expect(badgesOutside).toHaveLength(0);
    await expect(page.locator('[data-dex="1"] .MuiChip-root')).toHaveText([
      "fighting",
      "ghost",
    ]);
  });

  test("keeps the type filter on one line that scrolls sideways", async ({
    page,
  }) => {
    const chips = TYPES.map((type) => typeChip(page, type));
    const tops = new Set<number>();
    for (const chip of chips) {
      const box = (await chip.boundingBox())!;
      tops.add(Math.round(box.y));
      expect(box.height).toBeGreaterThanOrEqual(32);
    }
    expect(tops.size).toBe(1);

    const row = chips[0].locator("..");
    const { scrollWidth, clientWidth } = await row.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scrollWidth).toBeGreaterThan(clientWidth);

    const last = chips[chips.length - 1];
    const isInsideRow = () =>
      last.evaluate((chip) => {
        const c = chip.getBoundingClientRect();
        const r = chip.parentElement!.getBoundingClientRect();
        return c.left >= r.left && c.right <= r.right;
      });
    expect(await isInsideRow()).toBe(false);

    await row.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
    await expect.poll(isInsideRow).toBe(true);
  });

  test("ends the jump row at 101–151 rather than a lone 151", async ({
    page,
  }) => {
    const jumps = page.getByRole("button", { name: /^\d+–\d+$/ });
    await expect(jumps).toHaveText(["1–50", "51–100", "101–151"]);

    const tops = await jumps.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top)),
    );
    expect(new Set(tops).size).toBe(1);
    for (const height of await jumps.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().height),
    )) {
      expect(height).toBeGreaterThanOrEqual(32);
    }
  });

  test("puts the clear chip first and clears the filter on tap", async ({
    page,
  }) => {
    await typeChip(page, "dragon").tap();
    await expect(page.locator("[data-dex]")).not.toHaveCount(40);

    const firstChip = typeChip(page, "normal")
      .locator("..")
      .locator(":scope > *");
    await expect(firstChip.first()).toHaveText("clear");

    await firstChip.first().tap();
    await expect(page.getByRole("button", { name: "clear" })).toHaveCount(0);
    await expect(page.locator("[data-dex]")).toHaveCount(40);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(375);
  });

  test("gives every card's caught and favorite buttons a 44px tap target", async ({
    page,
  }) => {
    const boxes = await page.locator("[data-dex] button").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { width: r.width, height: r.height };
      }),
    );
    expect(boxes).toHaveLength(80);
    for (const box of boxes) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe("Desktop dex", () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    isMobile: false,
    hasTouch: false,
  });

  test("keeps at least six columns for a 40-card page", async ({ page }) => {
    await openDex(page);

    const lefts = await page
      .locator("[data-dex]")
      .evaluateAll((els) =>
        els.map((el) => Math.round(el.getBoundingClientRect().left)),
      );
    expect(new Set(lefts).size).toBeGreaterThanOrEqual(6);
  });
});
