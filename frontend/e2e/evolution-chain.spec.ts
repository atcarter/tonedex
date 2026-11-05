import { test, expect, type Page } from "@playwright/test";
import { SPRIGATITO_DETAIL, mockPublicGameRoutes } from "./fixtures";

const API = "http://localhost:3000";

const lv = (min_level: number) => [{ trigger: "level-up", min_level }];
const stone = (item: string) => [{ trigger: "use-item", item }];
const happiness = [{ trigger: "level-up", min_happiness: 160 }];
const step = (
  name: string,
  evolves_from: string | null = null,
  evolution_details: unknown[] = [],
) => ({ name, evolves_from, evolution_details });

// One chain per shape: single, two and three stage, branching, and branching past the base
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
};
const LINEAR = ["tauros", "wingull", "sprigatito"];

async function mockChain(page: Page, name: string) {
  await mockPublicGameRoutes(page);
  await page.route(`${API}/api/v1/pokemon/${name}*`, (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...SPRIGATITO_DETAIL,
        pokemon: { ...SPRIGATITO_DETAIL.pokemon, name },
        evolution_chain: CHAINS[name],
      }),
    }),
  );
}

async function openChain(page: Page, name: string) {
  await mockChain(page, name);
  await page.goto(`/game/1/pokemon/${name}`);
  const chain = page.getByTestId("evolution-chain");
  await expect(chain.getByTestId("evolution-stage")).toHaveCount(
    CHAINS[name].length,
  );
  return chain;
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
      // Each arrow with the stage it points to and whether one card holds both
      arrows: [
        ...chain.querySelectorAll('[data-testid="evolution-arrow"]'),
      ].map((arrow) => {
        const stages = [
          ...chain.querySelectorAll('[data-testid="evolution-stage"]'),
        ];
        const target = stages.find(
          (s) =>
            arrow.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING,
        )!;
        const card = arrow.closest('[data-testid="evolution-branch"]');
        const a = arrow.getBoundingClientRect();
        const t = target.getBoundingClientRect();
        return {
          sameCard: !!card && card.contains(target),
          center: (a.left + a.right) / 2,
          bottom: a.bottom,
          target: { left: t.left, right: t.right, top: t.top },
        };
      }),
      branches: [
        ...chain.querySelectorAll('[data-testid="evolution-branch"]'),
      ].map((card) => {
        const kids = [...card.children].map((k) => k.getBoundingClientRect());
        const { height } = card.getBoundingClientRect();
        // Blank space a card holds below its arrow and stage
        const slack = height - (kids.at(-1)!.bottom - kids[0].top);
        return { ...box(card), slack };
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

// Eevee: the base stage, then a grid of cards that each hold an arrow and its target
function expectBranchGrid(m: Measured) {
  const [base, ...targets] = m.stages;
  expect(m.branches).toHaveLength(targets.length);
  expect(m.arrows).toHaveLength(targets.length);
  for (const arrow of m.arrows) {
    expect(arrow.sameCard).toBe(true);
    expect(arrow.target.top).toBeGreaterThanOrEqual(arrow.bottom);
    expect(arrow.center).toBeGreaterThan(arrow.target.left);
    expect(arrow.center).toBeLessThan(arrow.target.right);
  }
  // The grid wraps, and every row starts at the section's left edge
  const tops = [...new Set(m.branches.map((b) => Math.round(b.top)))];
  expect(tops.length).toBeGreaterThan(1);
  for (const top of tops) {
    const row = m.branches.filter((b) => Math.round(b.top) === top);
    expect(Math.min(...row.map((b) => b.left))).toBeCloseTo(m.content.left, 0);
  }
  expect(Math.min(...m.branches.map((b) => b.top))).toBeGreaterThan(base.top);
  // Rows hug their cards, with no blank band between one row and the next
  for (const branch of m.branches) expect(branch.slack).toBeLessThan(1);
}

test.describe("Evolution chain at phone width", () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true });

  for (const name of LINEAR) {
    test(`${name} stacks its stages inside the section`, async ({ page }) => {
      await openChain(page, name);
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
    });
  }

  test("eevee lays its branches out as cards inside the section", async ({
    page,
  }) => {
    await openChain(page, "eevee");
    const m = await measure(page);

    expect(m.pageWidth).toBe(375);
    expectInsideSection(m);
    expectBranchGrid(m);
  });
});

test.describe("Evolution chain at desktop width", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  for (const name of Object.keys(CHAINS)) {
    test(`${name} fits inside the section`, async ({ page }) => {
      await openChain(page, name);
      const m = await measure(page);

      expect(m.pageWidth).toBe(1280);
      expectInsideSection(m);
    });
  }

  test("eevee wraps its branches as cards, never a bare arrow", async ({
    page,
  }) => {
    await openChain(page, "eevee");
    expectBranchGrid(await measure(page));
  });

  test("a branch from a later stage names its parent", async ({ page }) => {
    const chain = await openChain(page, "oddish");
    const arrowOf = (name: string) =>
      chain
        .getByTestId("evolution-branch")
        .filter({ has: page.getByText(name, { exact: true }) })
        .getByTestId("evolution-arrow");

    await expect(arrowOf("Gloom")).toHaveText("→Lv. 21");
    await expect(arrowOf("Vileplume")).toHaveText("→Leaf Stone (from Gloom)");
    await expect(arrowOf("Bellossom")).toHaveText("→Sun Stone (from Gloom)");
  });

  test("a three-stage chain stays on one row", async ({ page }) => {
    await openChain(page, "sprigatito");
    const { stages } = await measure(page);
    expect(new Set(stages.map((s) => Math.round(s.top))).size).toBe(1);
  });
});
