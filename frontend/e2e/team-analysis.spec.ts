import { test, expect } from "@playwright/test";
import { GAME, mockPublicGameRoutes } from "./fixtures";

// The defensive rows wrap badges and sprites instead of overflowing.

// Six members weak to electric make its weak entry as wide as it gets
const TEAM = [
  "gyarados",
  "pelipper",
  "mantine",
  "wingull",
  "swanna",
  "ducklett",
].map((name, i) => ({
  id: 100_000 + i,
  name,
  types: ["water", "flying"],
  sprite_url: "",
}));

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

    test("no defensive overview row overflows", async ({ page }) => {
      await mockPublicGameRoutes(page);
      await page.addInitScript((team) => {
        localStorage.setItem("pokedex_team_1", team);
      }, JSON.stringify(TEAM));
      await page.goto(`/game/${GAME.id}/team`);

      const rows = page.getByTestId("defense-row");
      await expect(rows).toHaveCount(3);
      await expect(
        page.getByRole("img", { name: "Gyarados (4×)" }).first(),
      ).toBeAttached();

      const overflowing = await rows.evaluateAll((els) =>
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
