import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const ROUTES = [
  "/",
  "/briefing",
  "/requests",
  "/requests/req-301",
  "/spaces",
  "/spaces/space-roca-llisa",
  "/gates",
  "/dues",
  "/experiences",
  "/experiences/exp-501",
  "/people",
  "/people/person-ana-martins",
  "/vendors",
  "/communications",
  "/content",
  "/knowledge",
  "/reports",
  "/agents",
  "/settings",
  "/more",
  "/design-system",
];

const scan = (page: import("@playwright/test").Page) =>
  new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

test.describe("accessibility", () => {
  for (const path of ROUTES) {
    test(`no serious or critical violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      const results = await scan(page);
      const blocking = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(
        blocking.map((v) => `${v.id} (${v.impact}) — ${v.nodes.length} node(s): ${v.help}`),
      ).toEqual([]);
    });
  }

  test("open sheets are accessible", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("add-fab").click();
    await expect(page.getByTestId("composer-sheet")).toBeVisible();
    const results = await scan(page);
    expect(
      results.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${v.id} — ${v.help}`),
    ).toEqual([]);
  });

  test("interactive targets are at least 44px", async ({ page }) => {
    await page.goto("/");
    const small = await page.evaluate(() => {
      const out: string[] = [];
      const nodes = document.querySelectorAll<HTMLElement>(
        "button, a[href], input, select, [role=tab], [role=switch], [role=checkbox], [role=radio]",
      );
      for (const el of nodes) {
        if (el.offsetParent === null) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;

        // An absolutely-positioned ::after overlay extends the real hit area
        // beyond the element box; measure it from its own offsets.
        const after = getComputedStyle(el, "::after");
        const px = (v: string) => (v.endsWith("px") ? parseFloat(v) : 0);
        const overlay =
          after.content !== "none" && after.position === "absolute"
            ? {
                y: -Math.min(0, px(after.top)) - Math.min(0, px(after.bottom)),
                x: -Math.min(0, px(after.left)) - Math.min(0, px(after.right)),
              }
            : { x: 0, y: 0 };

        const h = r.height + overlay.y;
        const w = r.width + overlay.x;
        if (h < 44 || w < 24) {
          out.push(
            `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""} ${Math.round(w)}x${Math.round(h)} — "${(el.textContent ?? "").trim().slice(0, 30)}"`,
          );
        }
      }
      return out;
    });
    expect(small).toEqual([]);
  });

  test("status is never conveyed by colour alone", async ({ page }) => {
    await page.goto("/");
    const empties = await page
      .locator(".status, .status-pill")
      .evaluateAll((els) => els.filter((e) => !(e.textContent ?? "").trim()).length);
    expect(empties).toBe(0);
  });

  test("the timeline is an ordered list with descriptive rows", async ({ page }) => {
    await page.goto("/");
    const timeline = page.getByTestId("timeline");
    await expect(timeline).toHaveJSProperty("tagName", "OL");
    const first = page.getByTestId("operation-row").first();
    const label = await first.innerText();
    expect(label.length).toBeGreaterThan(5);
  });

  test("remains usable at 200% text zoom", async ({ page }) => {
    await page.goto("/");
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    await page.waitForTimeout(200);
    await expect(page.getByTestId("add-fab")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow, "no horizontal page overflow at 200% text").toBe(false);
  });
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("disables scroll snap and cinematic transitions", async ({ page }) => {
    await page.goto("/");
    const snap = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollSnapType,
    );
    expect(snap).toBe("none");

    const sceneFilter = await page.evaluate(() => {
      const el = document.querySelector(".ambient-scene__picture");
      return el ? getComputedStyle(el).filter : null;
    });
    expect(sceneFilter).toBe("none");
  });
});
