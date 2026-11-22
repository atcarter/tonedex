import { neighborsIn } from "./useNeighbors";

describe("neighborsIn", () => {
  const LIST = [{ name: "pikachu" }, { name: "eevee" }, { name: "snorlax" }];

  it("returns the entries either side", () => {
    expect(neighborsIn(LIST, "eevee")).toEqual({
      previous: { name: "pikachu" },
      next: { name: "snorlax" },
    });
  });

  it("has no previous at the start and no next at the end", () => {
    expect(neighborsIn(LIST, "pikachu")?.previous).toBeNull();
    expect(neighborsIn(LIST, "snorlax")?.next).toBeNull();
  });

  it("is null for a name the list doesn't hold", () => {
    expect(neighborsIn(LIST, "mew")).toBeNull();
  });
});
