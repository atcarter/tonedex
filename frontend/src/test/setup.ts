import "@testing-library/jest-dom";

// jsdom has no IntersectionObserver; GamePage's infinite-scroll sentinel
// constructs one on mount. A no-op stub is enough — scroll behaviour itself
// is covered by the Playwright suite.
globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = "";
  thresholds = [];
} as unknown as typeof IntersectionObserver;
