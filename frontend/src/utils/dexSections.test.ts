import { dexSections } from "./dexSections";

const labels = (total: number) =>
  dexSections(total).map(({ start, end }) => `${start}–${end}`);

describe("dexSections", () => {
  it("returns no sections for a dex under 100", () => {
    expect(dexSections(99)).toEqual([]);
  });

  it("splits 100 into two full buckets", () => {
    expect(labels(100)).toEqual(["1–50", "51–100"]);
  });

  it("folds a trailing bucket of fewer than 10 into the previous one", () => {
    expect(labels(105)).toEqual(["1–50", "51–105"]);
    expect(labels(151)).toEqual(["1–50", "51–100", "101–151"]);
  });

  it("keeps a trailing bucket of 10 or more", () => {
    const sections = labels(160);
    expect(sections).toHaveLength(4);
    expect(sections.at(-1)).toBe("151–160");
  });

  it("splits 400 into eight buckets", () => {
    expect(labels(400)).toHaveLength(8);
    expect(labels(400).at(-1)).toBe("351–400");
  });
});
