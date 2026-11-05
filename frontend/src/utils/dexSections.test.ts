import { dexSections } from "./dexSections";

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

const labels = (numbers: number[]) =>
  dexSections(numbers).map(({ start, end }) => `${start}–${end}`);

describe("dexSections", () => {
  it("returns no sections for a dex under 100", () => {
    expect(dexSections(range(1, 99))).toEqual([]);
  });

  it("splits 100 into two full buckets", () => {
    expect(labels(range(1, 100))).toEqual(["1–50", "51–100"]);
  });

  it("folds a trailing bucket of fewer than 10 into the previous one", () => {
    expect(labels(range(1, 105))).toEqual(["1–50", "51–105"]);
    expect(labels(range(1, 151))).toEqual(["1–50", "51–100", "101–151"]);
  });

  it("keeps a trailing bucket of 10 or more", () => {
    const sections = labels(range(1, 160));
    expect(sections).toHaveLength(4);
    expect(sections.at(-1)).toBe("151–160");
  });

  it("splits 400 into eight buckets", () => {
    expect(labels(range(1, 400))).toHaveLength(8);
    expect(labels(range(1, 400)).at(-1)).toBe("351–400");
  });

  it("records where each section starts in the list", () => {
    expect(dexSections(range(1, 151)).map((s) => s.index)).toEqual([
      0, 50, 100,
    ]);
  });

  it("buckets sparse national numbers by the numbers present", () => {
    // 1–60, then 120–179, then a lone 900
    const numbers = [...range(1, 60), ...range(120, 179), 900];
    expect(labels(numbers)).toEqual(["1–50", "51–60", "120–150", "151–900"]);
    expect(dexSections(numbers).map((s) => s.index)).toEqual([0, 50, 60, 91]);
  });
});
