import { test, expect, type Page } from "@playwright/test";
import { SPRIGATITO_DETAIL, mockPublicGameRoutes } from "./fixtures";

const API = "http://localhost:3000";

const lv = (min_level: number) => [{ trigger: "level-up", min_level }];
const stone = (item: string) => [{ trigger: "use-item", item }];

// One chain per shape: single, two and three stage, and branching
const CHAINS: Record<string, { name: string; evolution_details: unknown[] }[]> =
  {
    tauros: [{ name: "tauros", evolution_details: [] }],
    wingull: [
      { name: "wingull", evolution_details: [] },
      { name: "pelipper", evolution_details: lv(25) },
    ],
    sprigatito: [
      { name: "sprigatito", evolution_details: [] },
      { name: "floragato", evolution_details: lv(16) },
      { name: "meowscarada", evolution_details: lv(36) },
    ],
    eevee: [
      { name: "eevee", evolution_details: [] },
      { name: "vaporeon", evolution_details: stone("water-stone") },
      { name: "jolteon", evolution_details: stone("thunder-stone") },
      { name: "flareon", evolution_details: stone("fire-stone") },
      {
        name: "espeon",
        evolution_details: [{ trigger: "level-up", min_happiness: 160 }],
      },
      {
        name: "umbreon",
        evolution_details: [{ trigger: "level-up", min_happiness: 160 }],
      },
      { name: "leafeon", evolution_details: stone("leaf-stone") },
      { name: "glaceon", evolution_details: stone("ice-stone") },
      { name: "sylveon", evolution_details: [{ trigger: "level-up" }] },
    ],
  };

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
      pageWidth: document.documentElement.scrollWidth,
    };
  });
}

test.describe("Evolution chain at phone width", () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true });

  for (const name of Object.keys(CHAINS)) {
    test(`${name} stacks its stages inside the section`, async ({ page }) => {
      await openChain(page, name);
      const m = await measure(page);

      expect(m.pageWidth).toBe(375);
      expect(m.overflow).toBe(0);
      // 375 minus the page's and the Paper's 16px side padding
      expect(m.content.right - m.content.left).toBe(375 - 64);
      for (const part of m.parts) {
        expect(part.left).toBeGreaterThanOrEqual(m.content.left - 0.5);
        expect(part.right).toBeLessThanOrEqual(m.content.right + 0.5);
      }
      // Every card spans the section, one per row, in chain order
      m.stages.forEach((stage, i) => {
        expect(stage.left).toBeCloseTo(m.content.left, 0);
        expect(stage.right).toBeCloseTo(m.content.right, 0);
        if (i > 0) expect(stage.top).toBeGreaterThan(m.stages[i - 1].top);
      });
    });
  }
});

test.describe("Evolution chain at desktop width", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  for (const name of Object.keys(CHAINS)) {
    test(`${name} fits inside the section`, async ({ page }) => {
      await openChain(page, name);
      const m = await measure(page);

      expect(m.pageWidth).toBe(1280);
      expect(m.overflow).toBe(0);
      for (const part of m.parts) {
        expect(part.left).toBeGreaterThanOrEqual(m.content.left - 0.5);
        expect(part.right).toBeLessThanOrEqual(m.content.right + 0.5);
      }
    });
  }

  test("a three-stage chain stays on one row", async ({ page }) => {
    await openChain(page, "sprigatito");
    const { stages } = await measure(page);
    expect(new Set(stages.map((s) => Math.round(s.top))).size).toBe(1);
  });
});
