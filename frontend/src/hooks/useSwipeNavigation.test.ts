import {
  decideAxis,
  decideSwipe,
  startsInHorizontalScroller,
} from "./useSwipeNavigation";

// Velocities are px/ms; e2e can't time touch moves precisely enough for them
describe("decideAxis", () => {
  it("waits until the pointer has moved 10px", () => {
    expect(decideAxis(6, 6)).toBe("pending");
  });

  it("is horizontal only when sideways beats 1.5× the vertical travel", () => {
    expect(decideAxis(31, 20)).toBe("horizontal");
    expect(decideAxis(-31, 20)).toBe("horizontal");
    expect(decideAxis(30, 20)).toBe("vertical");
  });

  it("treats a 45° drag as a scroll", () => {
    expect(decideAxis(40, 40)).toBe("vertical");
  });
});

describe("decideSwipe", () => {
  const PHONE = 375; // commits at 30%: 112.5px

  it("commits by distance, left for next and right for previous", () => {
    expect(decideSwipe(-113, 0, PHONE)).toBe("next");
    expect(decideSwipe(113, 0, PHONE)).toBe("previous");
    expect(decideSwipe(-112, 0, PHONE)).toBeNull();
  });

  it("caps the distance at 140px on wide surfaces", () => {
    expect(decideSwipe(-140, 0, 900)).toBe("next");
    expect(decideSwipe(-139, 0, 900)).toBeNull();
  });

  it("commits a short flick moving the same way", () => {
    expect(decideSwipe(-40, -0.3, PHONE)).toBe("next");
    expect(decideSwipe(40, 0.5, PHONE)).toBe("previous");
  });

  it("does not commit a flick that is too short, too slow or reversing", () => {
    expect(decideSwipe(-39, -1, PHONE)).toBeNull();
    expect(decideSwipe(-60, -0.29, PHONE)).toBeNull();
    expect(decideSwipe(-60, 0.5, PHONE)).toBeNull();
  });
});

describe("startsInHorizontalScroller", () => {
  function scroller(overflowX: string, overflows: boolean) {
    const surface = document.createElement("div");
    const box = document.createElement("div");
    const target = document.createElement("span");
    box.style.overflowX = overflowX;
    Object.defineProperty(box, "scrollWidth", { value: overflows ? 900 : 300 });
    Object.defineProperty(box, "clientWidth", { value: 300 });
    box.append(target);
    surface.append(box);
    // Computed styles need the element in the document
    document.body.append(surface);
    return { surface, target };
  }

  afterEach(() => document.body.replaceChildren());

  it("is true inside a container that really scrolls sideways", () => {
    const { surface, target } = scroller("auto", true);
    expect(startsInHorizontalScroller(target, surface)).toBe(true);
  });

  it("is false when nothing overflows, or when overflow is clipped", () => {
    for (const [overflowX, overflows] of [
      ["auto", false],
      ["clip", true],
      ["hidden", true],
    ] as const) {
      const { surface, target } = scroller(overflowX, overflows);
      expect(startsInHorizontalScroller(target, surface)).toBe(false);
    }
  });
});
