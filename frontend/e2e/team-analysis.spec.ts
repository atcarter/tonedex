import { test, expect } from "@playwright/test";
import { GAME, mockPublicGameRoutes } from "./fixtures";

// The per-member defense entries wrap type badges instead of overflowing.

// Steel types fill the longest tiers; Crabominable is a long name
const TEAM = [
  { name: "bastiodon", types: ["rock", "steel"] },
  { name: "corviknight", types: ["flying", "steel"] },
  { name: "empoleon", types: ["water", "steel"] },
  { name: "crabominable", types: ["fighting", "ice"] },
  { name: "gyarados", types: ["water", "flying"] },
  { name: "dragapult", types: ["dragon", "ghost"] },
].map((p, i) => ({ id: 100_000 + i, sprite_url: "", ...p }));

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
  test.describe(`team analysis (${viewport.label})`, () => {
    test.use(viewport.use);

    test("no defensive overview entry overflows", async ({ page }) => {
      await mockPublicGameRoutes(page);
      await page.addInitScript((team) => {
        localStorage.setItem("pokedex_team_1", team);
      }, JSON.stringify(TEAM));
      await page.goto(`/game/${GAME.id}/team`);

      const entries = page.getByTestId("defense-member");
      await expect(entries).toHaveCount(6);
      await expect(
        entries
          .filter({ hasText: "Bastiodon" })
          .getByRole("list", { name: "4 times damage from" }),
      ).toBeAttached();

      const overflowing = await entries.evaluateAll((els) =>
        els
          .flatMap((el) => [el, ...el.querySelectorAll("li")])
          .filter((el) => {
            const box = el.getBoundingClientRect();
            const parent = el.parentElement!.getBoundingClientRect();
            return (
              el.scrollWidth > el.clientWidth ||
              box.left < parent.left - 0.5 ||
              box.right > parent.right + 0.5
            );
          })
          .map((el) => el.textContent),
      );
      expect(overflowing).toEqual([]);
      const pageOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(pageOverflow).toBe(false);
    });
  });
}
