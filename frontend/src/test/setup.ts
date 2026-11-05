import "@testing-library/jest-dom/vitest";

// Vitest launches Node with --localstorage-file (no valid path), which makes
// Node's experimental webstorage shadow jsdom's working Storage — its methods
// throw "is not a function". Install a real in-memory Storage for tests.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  key(index: number) {
    return [...this.store.keys()][index] ?? null;
  }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new MemoryStorage(),
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, "sessionStorage", {
  value: new MemoryStorage(),
  writable: true,
  configurable: true,
});

// jsdom doesn't implement scrollIntoView (used by the dex section quick-jump)
Element.prototype.scrollIntoView = () => {};

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
