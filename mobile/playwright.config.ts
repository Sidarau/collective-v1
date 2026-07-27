import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3212);
const baseURL = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`;

/** The viewports the acceptance checklist requires evidence for. */
export const VIEWPORTS = {
  "320x700": { width: 320, height: 700 },
  "390x844": { width: 390, height: 844 },
  "430x932": { width: 430, height: 932 },
  "768-tablet": { width: 768, height: 1024 },
} as const;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: "retain-on-failure",
    // Fixtures are deterministic, so screenshots are comparable run to run.
    timezoneId: "Europe/Madrid",
    locale: "en-GB",
  },

  projects: [
    {
      name: "phone-390",
      use: {
        ...devices["iPhone 13"],
        // The iPhone descriptor defaults to webkit, which segfaults on some
        // macOS hosts. Chromium runs everywhere; set PW_BROWSER=webkit to
        // check Safari-specific rendering when the host supports it.
        browserName: (process.env.PW_BROWSER as "chromium" | "webkit") ?? "chromium",
        viewport: VIEWPORTS["390x844"],
        isMobile: true,
        // Evidence is captured at logical size; the device's 3x factor would
        // put ~110 MB of PNGs in the repository for no extra information.
        deviceScaleFactor: 1,
      },
    },
    {
      name: "reduced-motion-390",
      use: {
        ...devices["iPhone 13"],
        browserName: (process.env.PW_BROWSER as "chromium" | "webkit") ?? "chromium",
        viewport: VIEWPORTS["390x844"],
        isMobile: true,
        deviceScaleFactor: 1,
        // Playwright 1.62 takes this through contextOptions, not `use` directly.
        contextOptions: { reducedMotion: "reduce" },
      },
    },
  ],

  webServer: {
    // Production server: the dev overlay must not appear in screenshots.
    command: `npx next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
