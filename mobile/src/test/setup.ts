import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());

// jsdom implements neither of these, and the shell relies on both.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = "";
  thresholds = [];
}

vi.stubGlobal("ResizeObserver", MockResizeObserver);
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

window.matchMedia =
  window.matchMedia ||
  ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList);

window.scrollTo = (() => {}) as typeof window.scrollTo;

// Node ≥ 22.4 exposes an experimental global `localStorage` that shadows
// jsdom's and is undefined without `--localstorage-file` (warning: "localStorage
// is not available"). Give the jsdom window an in-memory stand-in so suites
// that exercise storage-dependent components run on any Node version.
if (typeof window !== "undefined" && typeof window.localStorage === "undefined") {
  const backing = new Map<string, string>();
  const storage: Storage = {
    getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
    setItem: (k: string, v: string) => void backing.set(k, String(v)),
    removeItem: (k: string) => void backing.delete(k),
    clear: () => backing.clear(),
    key: (i: number) => [...backing.keys()][i] ?? null,
    get length() {
      return backing.size;
    },
  };
  Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
}
