import { test, expect, type Page } from "@playwright/test";
import {
  SPRIGATITO,
  SPRIGATITO_DETAIL,
  mockAuthenticatedRoutes,
  mockPublicGameRoutes,
  seedAuthState,
} from "./fixtures";

// 375px with touch: no page scrolls sideways; favorites reorder by tap and drag.
test.use({
  viewport: { width: 375, height: 812 },
  isMobile: true,
  hasTouch: true,
});

const API = "http://localhost:3000";
const PHONE_WIDTH = 375;

const FLORAGATO = {
  id: 907,
  name: "floragato",
  types: ["grass"],
  sprite_url: "",
  pokedex_number: 2,
};

const FLORAGATO_DETAIL = {
  ...SPRIGATITO_DETAIL,
  pokemon: {
    ...SPRIGATITO_DETAIL.pokemon,
    ...FLORAGATO,
    base_stats: {
      hp: 61,
      attack: 80,
      defense: 63,
      "special-attack": 60,
      "special-defense": 63,
      speed: 83,
    },
  },
};

// Long names make the 30-row move list as wide as it gets.
const THIRTY_MOVES = Array.from({ length: 30 }, (_, i) => ({
  name: `extremely-long-signature-move-number-${i + 1}`,
  level_learned: i % 2 === 0 ? i + 1 : 0,
  learn_method: i % 2 === 0 ? "level-up" : "egg-tutor-technical-record",
}));

const DETAIL_WITH_MOVES = {
  ...SPRIGATITO_DETAIL,
  moves: THIRTY_MOVES,
  species: {
    genus: "Grass Cat Pokémon",
    flavor_text:
      "Its fluffy fur is similar in composition to plants. This Pokémon frequently washes its face to keep it from drying out.",
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
        description:
          "Changes the Pokémon's type to the type of the move it's about to use. This works only once each time the Pokémon enters battle.",
        short_effect:
          "Changes the Pokémon's type to the type of the move it's using.",
      },
    ],
  },
};

function json(body: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function pageScrollWidth(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

type Point = { x: number; y: number };

function centre(box: { x: number; y: number; width: number; height: number }) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// Real touch input (Playwright's touchscreen only taps); release() lifts the finger
async function touchDrag(page: Page, from: Point, to: Point) {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: string, p?: Point) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: p ? [{ ...p, id: 1 }] : [],
    });
  await touch("touchStart", from);
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await touch("touchMove", {
      x: from.x + ((to.x - from.x) * i) / steps,
      y: from.y + ((to.y - from.y) * i) / steps,
    });
    await page.waitForTimeout(16);
  }
  return { release: () => touch("touchEnd") };
}

test.describe("Phone width: pages fit the viewport", () => {
  test.beforeEach(async ({ page }) => {
    await mockPublicGameRoutes(page);
    await page.route(`${API}/api/v1/pokemon/sprigatito*`, (r) =>
      r.fulfill(json(DETAIL_WITH_MOVES)),
    );
    await page.route(`${API}/api/v1/pokemon/floragato*`, (r) =>
      r.fulfill(json(FLORAGATO_DETAIL)),
    );
  });

  test("detail page with 30 moves keeps the move list inside its wrapper", async ({
    page,
  }) => {
    await page.goto("/game/1/pokemon/sprigatito");
    await expect(
      page.getByRole("heading", { name: /sprigatito/i }),
    ).toBeVisible();

    const wrapper = page.getByTestId("move-table");
    await expect(wrapper).toBeVisible();
    await expect(wrapper.getByRole("button")).toHaveCount(30);

    const { scrollWidth, clientWidth, overflowX } = await wrapper.evaluate(
      (el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        overflowX: getComputedStyle(el).overflowX,
      }),
    );
    expect(overflowX).toBe("auto");
    expect(scrollWidth).toBeGreaterThanOrEqual(clientWidth);
    expect(await pageScrollWidth(page)).toBe(PHONE_WIDTH);

    const firstRow = wrapper.getByRole("button").first();
    const box = await firstRow.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  test("a tapped ability opens a full-width panel with its hidden label", async ({
    page,
  }) => {
    await page.goto("/game/1/pokemon/sprigatito");
    const chip = page.getByRole("button", { name: "Protean" });
    await chip.tap();

    await expect(chip).toHaveAttribute("aria-expanded", "true");
    const panel = page.getByRole("region", { name: "Protean ability" });
    await expect(panel).toContainText("Hidden ability");
    await expect(panel).toContainText("In battle:");
    expect((await chip.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect(await pageScrollWidth(page)).toBe(PHONE_WIDTH);
  });

  test("detail header stacks the sprite above the name, centred", async ({
    page,
  }) => {
    await page.goto("/game/1/pokemon/sprigatito");
    const heading = page.getByRole("heading", { name: /sprigatito/i });
    await expect(heading).toBeVisible();

    const sprite = await page
      .getByRole("img", { name: "sprigatito" })
      .boundingBox();
    const name = await heading.boundingBox();
    expect(sprite && name).toBeTruthy();
    expect(sprite!.y + sprite!.height).toBeLessThanOrEqual(name!.y);
    const centre = (b: { x: number; width: number }) => b.x + b.width / 2;
    expect(Math.abs(centre(sprite!) - PHONE_WIDTH / 2)).toBeLessThan(8);
    expect(Math.abs(centre(name!) - PHONE_WIDTH / 2)).toBeLessThan(8);
  });

  test("compare page stacks the pickers and fits both stat columns", async ({
    page,
  }) => {
    await page.goto("/compare?left=sprigatito&right=floragato");
    await expect(
      page.getByRole("heading", { name: /floragato/i }),
    ).toBeVisible();
    await expect(page.getByText("BASE STAT TOTAL")).toHaveCount(2);

    const first = await page.getByLabel("First Pokémon...").boundingBox();
    const second = await page.getByLabel("Second Pokémon...").boundingBox();
    expect(first && second).toBeTruthy();
    expect(Math.abs(first!.x - second!.x)).toBeLessThan(1);
    expect(second!.y).toBeGreaterThan(first!.y + first!.height);
    expect(first!.width).toBeGreaterThan(PHONE_WIDTH - 100);

    expect(await pageScrollWidth(page)).toBe(PHONE_WIDTH);
  });

  test("empty compare page fits the viewport", async ({ page }) => {
    await page.goto("/compare");
    await expect(page.getByLabel("First Pokémon...")).toBeVisible();
    expect(await pageScrollWidth(page)).toBe(PHONE_WIDTH);
  });

  test("team builder has a full-width picker and fits the viewport", async ({
    page,
  }) => {
    // Six members so the analysis renders
    const team = [
      SPRIGATITO,
      FLORAGATO,
      { id: 909, name: "fuecoco", types: ["fire"], sprite_url: "" },
      { id: 912, name: "quaxly", types: ["water"], sprite_url: "" },
      { id: 921, name: "pawmi", types: ["electric"], sprite_url: "" },
      { id: 935, name: "charcadet", types: ["fire", "ghost"], sprite_url: "" },
    ];
    await page.addInitScript((value) => {
      localStorage.setItem("pokedex_team_1", value);
    }, JSON.stringify(team));

    await page.goto("/game/1/team");
    await expect(page.getByTestId("team-slot")).toHaveCount(6);
    await expect(page.getByText("Defensive Overview")).toBeVisible();

    // A full team starts with the picker collapsed
    await page.getByRole("button", { name: "Show picker" }).click();
    await expect(page.getByLabel("Add a Pokémon")).toBeVisible();
    const picker = await page.getByLabel("Add a Pokémon").boundingBox();
    const main = await page.locator("main").boundingBox();
    expect(picker && main).toBeTruthy();
    // main minus its 16px side padding
    expect(picker!.width).toBeGreaterThanOrEqual(main!.width - 32 - 1);

    expect(await pageScrollWidth(page)).toBe(PHONE_WIDTH);
  });

  test("404 page fits the viewport", async ({ page }) => {
    await page.goto("/nope");
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
    expect(await pageScrollWidth(page)).toBe(PHONE_WIDTH);
  });
});

test.describe("Phone width: favorites reorder by touch", () => {
  const SECOND = { ...FLORAGATO, favorite_id: 6 };
  const FIRST = { ...SPRIGATITO, favorite_id: 5 };
  const THIRD = {
    id: 908,
    name: "meowscarada",
    types: ["grass", "dark"],
    sprite_url: "",
    pokedex_number: 3,
    favorite_id: 7,
  };
  const items = (page: Page) => page.locator("[data-reorder-index]");
  const order = async (page: Page) =>
    (await items(page).allInnerTexts()).map((t) =>
      t.split("\n").find((line) => /[a-z]{4}/i.test(line)),
    );

  // Serves the favorites in the order the last PATCH stored
  async function mockFavorites(page: Page, initial: (typeof FIRST)[]) {
    await seedAuthState(page);
    await mockPublicGameRoutes(page);
    await mockAuthenticatedRoutes(page, { favorites: initial });
    let serverOrder = initial;
    await page.route(`${API}/api/v1/favorites`, (r) =>
      r.fulfill(json(serverOrder)),
    );
    const patches: { ids: number[] }[] = [];
    await page.route(`${API}/api/v1/favorites/reorder`, (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}") as {
        ids: number[];
      };
      patches.push(body);
      serverOrder = body.ids.map(
        (id) => initial.find((f) => f.favorite_id === id)!,
      );
      return route.fulfill({ status: 204, body: "" });
    });
    return patches;
  }

  test("dragging a card's handle reorders live and saves the order", async ({
    page,
  }) => {
    const patches = await mockFavorites(page, [FIRST, SECOND, THIRD]);
    await page.goto("/favorites");
    await expect(page.getByText("Meowscarada")).toBeVisible();

    const handle = items(page).first().locator("[data-reorder-handle]");
    const handleBox = await handle.boundingBox();
    expect(handleBox?.width).toBeGreaterThanOrEqual(44);
    expect(handleBox?.height).toBeGreaterThanOrEqual(44);
    const target = await items(page).nth(2).boundingBox();

    const drag = await touchDrag(page, centre(handleBox!), centre(target!));
    // Live while the finger is down, and nothing saved yet
    await expect
      .poll(() => order(page))
      .toEqual(["Floragato", "Meowscarada", "Sprigatito"]);
    await expect(items(page).nth(2)).toHaveCSS("opacity", "0.4");
    expect(patches).toEqual([]);

    await drag.release();
    await expect.poll(() => patches).toEqual([{ ids: [6, 7, 5] }]);
    await expect(items(page).nth(2)).toHaveCSS("opacity", "1");
    await expect(page).toHaveURL(/\/favorites$/);

    await page.reload();
    await expect(page.getByText("Meowscarada")).toBeVisible();
    expect(await order(page)).toEqual([
      "Floragato",
      "Meowscarada",
      "Sprigatito",
    ]);
  });

  test("a swipe on a card scrolls the page instead of dragging", async ({
    page,
  }) => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      ...THIRD,
      id: 2000 + i,
      name: `pokemon-number-${i + 1}`,
      favorite_id: 3000 + i,
    }));
    const patches = await mockFavorites(page, many);
    await page.goto("/favorites");
    await expect(items(page)).toHaveCount(12);
    const before = await order(page);

    const card = await items(page).nth(2).boundingBox();
    const from = { x: card!.x + card!.width / 2, y: card!.y + 40 };
    const drag = await touchDrag(page, from, { ...from, y: from.y - 300 });
    await drag.release();

    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(100);
    expect(await order(page)).toEqual(before);
    expect(patches).toEqual([]);
  });

  test("move buttons are visible, 44px tall, and tapping one reorders", async ({
    page,
  }) => {
    // A second row, whose cards must not cover the first row's buttons
    const patches = await mockFavorites(page, [FIRST, SECOND, THIRD]);

    await page.goto("/favorites");
    await expect(page.getByText("Sprigatito")).toBeVisible();
    await expect(page.getByText("Meowscarada")).toBeVisible();
    expect(await pageScrollWidth(page)).toBe(PHONE_WIDTH);

    const moveButtons = page.getByRole("button", {
      name: /^move .* (earlier|later)$/,
    });
    await expect(moveButtons).toHaveCount(6);
    for (const button of await moveButtons.all()) {
      const { opacity, onTop } = await button.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(
          r.x + r.width / 2,
          r.y + r.height / 2,
        );
        return {
          opacity: getComputedStyle(el.parentElement!).opacity,
          // Disabled buttons pass hits through to their controls row
          onTop: el.parentElement!.contains(hit),
        };
      });
      expect(opacity).toBe("1");
      expect(onTop).toBe(true);
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    await page.getByRole("button", { name: "move sprigatito later" }).tap();

    await expect.poll(() => patches).toEqual([{ ids: [6, 5, 7] }]);
    expect(await order(page)).toEqual([
      "Floragato",
      "Sprigatito",
      "Meowscarada",
    ]);
    await expect(
      page.getByText("Sprigatito moved to position 2 of 3"),
    ).toBeAttached();
  });
});
