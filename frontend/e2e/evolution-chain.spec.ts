import { test, expect, type Locator, type Page } from "@playwright/test";
import { SPRIGATITO_DETAIL, mockPublicGameRoutes } from "./fixtures";

const API = "http://localhost:3000";

const lv = (min_level: number) => [{ trigger: "level-up", min_level }];
const stone = (item: string) => [{ trigger: "use-item", item }];
const happiness = [{ trigger: "level-up", min_happiness: 160 }];
const step = (
  name: string,
  evolves_from: string | null = null,
  evolution_details: unknown[] = [],
) => ({
  name,
  evolves_from,
  evolution_details,
  sprite_url: `${API}/sprites/${name}.png` as string | null,
});

// One chain per shape: single, two and three stage, and branching at the base, past it and with nested stages
const CHAINS: Record<string, ReturnType<typeof step>[]> = {
  tauros: [step("tauros")],
  wingull: [step("wingull"), step("pelipper", "wingull", lv(25))],
  sprigatito: [
    step("sprigatito"),
    step("floragato", "sprigatito", lv(16)),
    step("meowscarada", "floragato", lv(36)),
  ],
  eevee: [
    step("eevee"),
    step("vaporeon", "eevee", stone("water-stone")),
    step("jolteon", "eevee", stone("thunder-stone")),
    step("flareon", "eevee", stone("fire-stone")),
    step("espeon", "eevee", happiness),
    step("umbreon", "eevee", happiness),
    step("leafeon", "eevee", stone("leaf-stone")),
    step("glaceon", "eevee", stone("ice-stone")),
    step("sylveon", "eevee", [{ trigger: "level-up" }]),
  ],
  oddish: [
    step("oddish"),
    step("gloom", "oddish", lv(21)),
    step("vileplume", "gloom", stone("leaf-stone")),
    step("bellossom", "gloom", stone("sun-stone")),
  ],
  wurmple: [
    step("wurmple"),
    step("silcoon", "wurmple", lv(7)),
    step("beautifly", "silcoon", lv(10)),
    step("cascoon", "wurmple", lv(7)),
    step("dustox", "cascoon", lv(10)),
  ],
  charcadet: [
    step("charcadet"),
    step("armarouge", "charcadet", stone("auspicious-armor")),
    step("ceruledge", "charcadet", stone("malicious-armor")),
  ],
};
const LINEAR = ["tauros", "wingull", "sprigatito"];

// PokeAPI's trees: the stage each branch splits from, and the branch column
// (named by its first evolution) every later stage belongs to
const EEVEELUTIONS = CHAINS.eevee.slice(1).map((s) => s.name);
const TREES: Record<string, Record<string, [string, string] | null>> = {
  eevee: {
    eevee: null,
    ...Object.fromEntries(EEVEELUTIONS.map((n) => [n, ["eevee", n]])),
  },
  oddish: {
    oddish: null,
    gloom: null,
    vileplume: ["gloom", "vileplume"],
    bellossom: ["gloom", "bellossom"],
  },
  wurmple: {
    wurmple: null,
    silcoon: ["wurmple", "silcoon"],
    beautifly: ["wurmple", "silcoon"],
    cascoon: ["wurmple", "cascoon"],
    dustox: ["wurmple", "cascoon"],
  },
  charcadet: {
    charcadet: null,
    armarouge: ["charcadet", "armarouge"],
    ceruledge: ["charcadet", "ceruledge"],
  },
};
const BRANCHING = Object.keys(TREES);

async function mockChain(page: Page, name: string, chain = CHAINS[name]) {
  await mockPublicGameRoutes(page);
  await page.route(`${API}/api/v1/pokemon/${name}*`, (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...SPRIGATITO_DETAIL,
        pokemon: { ...SPRIGATITO_DETAIL.pokemon, name },
        evolution_chain: chain,
      }),
    }),
  );
}

async function openChain(page: Page, name: string, chain = CHAINS[name]) {
  await mockChain(page, name, chain);
  await page.goto(`/game/scarlet/pokemon/${name}`);
  const stages = page
    .getByTestId("evolution-chain")
    .getByTestId("evolution-stage");
  await expect(stages).toHaveCount(chain.length);
  return stages;
}

// Every stage shows its loaded sprite above its name
async function expectSprites(stages: Locator) {
  for (const stage of await stages.all()) {
    const name = await stage.innerText();
    const sprite = stage.getByRole("img", { name });
    // Sprites load lazily, so bring each one into view first
    await sprite.scrollIntoViewIfNeeded();
    await expect
      .poll(() => sprite.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBe(1);
    const spriteBox = (await sprite.boundingBox())!;
    const nameBox = (await stage.getByText(name).boundingBox())!;
    expect(spriteBox.y + spriteBox.height).toBeLessThanOrEqual(nameBox.y + 0.5);
  }
}

// Boxes of the chain, its Paper's content area, and each stage card
async function measure(page: Page) {
  return page.getByTestId("evolution-chain").evaluate((chain) => {
    const paper = chain.closest(".MuiPaper-root")!;
    const style = getComputedStyle(paper);
    const outer = paper.getBoundingClientRect();
    const box = (el: Element) => {
      const { left, right, top } = el.getBoundingClientRect();
      return { left, right, top };
    };
    return {
      overflow: chain.scrollWidth - chain.clientWidth,
      chain: box(chain),
      content: {
        left: outer.left + parseFloat(style.paddingLeft),
        right: outer.right - parseFloat(style.paddingRight),
      },
      parts: [...chain.querySelectorAll("*")].map(box),
      stages: [
        ...chain.querySelectorAll('[data-testid="evolution-stage"]'),
      ].map(box),
      // Each arrow with the element after it and the column holding it
      arrows: [
        ...chain.querySelectorAll('[data-testid="evolution-arrow"]'),
      ].map((arrow) => {
        const target = arrow.nextElementSibling!;
        const a = arrow.getBoundingClientRect();
        const t = target.getBoundingClientRect();
        return {
          targetIsStage:
            target.getAttribute("data-testid") === "evolution-stage",
          sameColumn:
            arrow.closest('[data-testid="evolution-branch"]') ===
            target.closest('[data-testid="evolution-branch"]'),
          center: (a.left + a.right) / 2,
          bottom: a.bottom,
          target: { left: t.left, right: t.right, top: t.top },
        };
      }),
      // Where each stage sits in the tree, and the box of its card
      tree: Object.fromEntries(
        [...chain.querySelectorAll('[data-testid="evolution-stage"]')].map(
          (stage) => {
            const column = stage.closest<HTMLElement>(
              '[data-testid="evolution-branch"]',
            );
            const group = column?.closest<HTMLElement>(
              '[data-testid="evolution-branches"]',
            );
            return [
              stage.textContent!.toLowerCase(),
              {
                place: column
                  ? [group!.dataset.parent!, column.dataset.species!]
                  : null,
                ...box(stage),
              },
            ];
          },
        ),
      ),
      groups: [
        ...chain.querySelectorAll<HTMLElement>(
          '[data-testid="evolution-branches"]',
        ),
      ].map((group) => ({ parent: group.dataset.parent!, ...box(group) })),
      branches: [
        ...chain.querySelectorAll('[data-testid="evolution-branch"]'),
      ].map((column) => {
        const kids = [...column.children].map((k) => k.getBoundingClientRect());
        const style = getComputedStyle(column);
        const { height } = column.getBoundingClientRect();
        // Blank space a column holds beyond its stages and padding
        const slack =
          height -
          (kids.at(-1)!.bottom - kids[0].top) -
          parseFloat(style.paddingTop) -
          parseFloat(style.paddingBottom) -
          parseFloat(style.borderTopWidth) -
          parseFloat(style.borderBottomWidth);
        return { ...box(column), slack };
      }),
      pageWidth: document.documentElement.scrollWidth,
    };
  });
}

type Measured = Awaited<ReturnType<typeof measure>>;

function expectInsideSection(m: Measured) {
  expect(m.overflow).toBe(0);
  for (const part of m.parts) {
    expect(part.left).toBeGreaterThanOrEqual(m.content.left - 0.5);
    expect(part.right).toBeLessThanOrEqual(m.content.right + 0.5);
  }
}

// Every stage sits in the branch column of its real parent, below that parent,
// and every arrow shares its column with the stage right after it
function expectTree(m: Measured, name: string) {
  const tree = TREES[name];
  expect(Object.keys(m.tree).sort()).toEqual(Object.keys(tree).sort());
  for (const [species, place] of Object.entries(tree)) {
    expect(m.tree[species].place, species).toEqual(place);
  }
  for (const group of m.groups) {
    expect(m.tree[group.parent].top).toBeLessThan(group.top);
  }
  for (const arrow of m.arrows) {
    expect(arrow.targetIsStage).toBe(true);
    expect(arrow.sameColumn).toBe(true);
    expect(arrow.target.top).toBeGreaterThanOrEqual(arrow.bottom);
    expect(arrow.center).toBeGreaterThan(arrow.target.left);
    expect(arrow.center).toBeLessThan(arrow.target.right);
  }
  // Columns hug their stages, with no blank band below them
  for (const branch of m.branches) expect(branch.slack).toBeLessThan(1);
}

test.describe("Evolution chain at phone width", () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true });

  for (const name of LINEAR) {
    test(`${name} stacks its stages inside the section`, async ({ page }) => {
      const stages = await openChain(page, name);
      const m = await measure(page);

      expect(m.pageWidth).toBe(375);
      // 375 minus the page's and the Paper's 16px side padding
      expect(m.content.right - m.content.left).toBe(375 - 64);
      expectInsideSection(m);
      // Every card spans the section, one per row, in chain order
      m.stages.forEach((stage, i) => {
        expect(stage.left).toBeCloseTo(m.content.left, 0);
        expect(stage.right).toBeCloseTo(m.content.right, 0);
        if (i > 0) expect(stage.top).toBeGreaterThan(m.stages[i - 1].top);
      });
      await expectSprites(stages);
    });
  }

  for (const name of BRANCHING) {
    test(`${name} shows its branches under the stage they evolve from`, async ({
      page,
    }) => {
      const stages = await openChain(page, name);
      const m = await measure(page);

      expect(m.pageWidth).toBe(375);
      expectInsideSection(m);
      expectTree(m, name);
      await expectSprites(stages);
    });
  }
});

test.describe("Evolution chain at desktop width", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  for (const name of Object.keys(CHAINS)) {
    test(`${name} fits inside the section`, async ({ page }) => {
      const stages = await openChain(page, name);
      const m = await measure(page);

      expect(m.pageWidth).toBe(1280);
      expectInsideSection(m);
      await expectSprites(stages);
    });
  }

  for (const name of BRANCHING) {
    test(`${name} shows its branches under the stage they evolve from`, async ({
      page,
    }) => {
      await openChain(page, name);
      expectTree(await measure(page), name);
    });
  }

  test("a stage without a sprite, or whose sprite fails, shows its name only", async ({
    page,
  }) => {
    await page.route(`${API}/missing/**`, (r) => r.fulfill({ status: 404 }));
    const [sprigatito, floragato, meowscarada] = CHAINS.sprigatito;
    const stages = await openChain(page, "sprigatito", [
      sprigatito,
      { ...floragato, sprite_url: `${API}/missing/floragato.png` },
      { ...meowscarada, sprite_url: null },
    ]);

    await expect(stages.nth(0).getByRole("img")).toBeVisible();
    for (const i of [1, 2]) {
      await expect(stages.nth(i).getByRole("img")).toHaveCount(0);
      await expect(stages.nth(i)).toBeVisible();
    }
    await expect(stages.nth(1)).toHaveText("Floragato");
    await expect(stages.nth(2)).toHaveText("Meowscarada");
  });

  test("a three-stage chain stays on one row", async ({ page }) => {
    await openChain(page, "sprigatito");
    const { stages } = await measure(page);
    expect(new Set(stages.map((s) => Math.round(s.top))).size).toBe(1);
  });
});
