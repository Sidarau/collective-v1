import { expect, test } from "@playwright/test";

/** Every top-level route in mobile-routes.json, plus the design gallery. */
const TOP_LEVEL = [
  "/",
  "/briefing",
  "/requests",
  "/spaces",
  "/gates",
  "/dues",
  "/experiences",
  "/people",
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

const DETAIL = [
  "/requests/req-301",
  "/spaces/space-roca-llisa",
  "/gates/gate-north",
  "/dues/tx-460",
  "/experiences/exp-501",
  "/people/person-ana-martins",
  "/vendors/vendor-sol-provisions",
];

test.describe("route coverage", () => {
  for (const path of [...TOP_LEVEL, ...DETAIL]) {
    test(`renders ${path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));

      const response = await page.goto(path);
      expect(response?.status(), `${path} status`).toBe(200);

      await expect(page.getByRole("heading").first()).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
      await expect(page.locator("body")).not.toContainText("A server error occurred");
      expect(errors, `${path} runtime errors`).toEqual([]);
    });
  }
});

test.describe("navigation has no dead ends", () => {
  test("every bottom-rail destination resolves", async ({ page }) => {
    await page.goto("/");
    for (const label of ["People", "Spaces", "More"]) {
      await page.getByRole("navigation", { name: "Primary" }).getByText(label, { exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${label.toLowerCase()}$`));
      await expect(page.getByRole("heading", { name: label })).toBeVisible();
    }
  });

  test("every More link resolves to a real screen", async ({ page }) => {
    await page.goto("/more");
    const links = page.locator("main a[href^='/']");
    const hrefs = [...new Set(await links.evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!),
    ))];
    expect(hrefs.length).toBeGreaterThan(10);

    for (const href of hrefs) {
      const res = await page.goto(href);
      expect(res?.status(), `${href} must resolve`).toBe(200);
      await expect(page.locator("body")).not.toContainText("A server error occurred");
    }
  });

  test("no navigation target is a versioned path", async ({ page }) => {
    for (const path of TOP_LEVEL) {
      await page.goto(path);
      const hrefs = await page.locator("a[href]").evaluateAll((els) =>
        els.map((e) => (e as HTMLAnchorElement).getAttribute("href") ?? ""),
      );
      expect(hrefs.filter((h) => /\/v\d+(\/|$)/.test(h)), `${path} links to a versioned path`)
        .toEqual([]);
    }
  });

  test("a versioned path is not routable", async ({ page }) => {
    const res = await page.goto("/v2", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(404);
  });
});

test.describe("Today behaviour", () => {
  test("lands near the present", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(400);
    const pct = await page.evaluate(() => {
      const m = document.querySelector("[data-testid=now-marker]");
      if (!m) return null;
      return (m.getBoundingClientRect().top / window.innerHeight) * 100;
    });
    expect(pct, "present should land at roughly 35–42% of the viewport").not.toBeNull();
    expect(pct!).toBeGreaterThan(25);
    expect(pct!).toBeLessThan(50);
  });

  test("filters persist in URL state and change the stream", async ({ page }) => {
    await page.goto("/");
    const all = await page.getByTestId("operation-row").count();

    await page.getByTestId("filter-tab-dues").click();
    await expect(page).toHaveURL(/filter=dues/);
    const dues = page.getByTestId("operation-row");
    await expect(dues.first()).toBeVisible();
    expect(await dues.count()).toBeLessThan(all);
    for (const cat of await dues.evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.category),
    )) {
      expect(cat).toBe("dues");
    }

    // Survives a reload.
    await page.reload();
    await expect(page.getByTestId("filter-tab-dues")).toHaveAttribute("aria-selected", "true");
  });

  test("a summary term applies its filter", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("summary-term-requests").first().click();
    await expect(page).toHaveURL(/filter=requests/);
  });

  test("untimed rows never render an invented clock", async ({ page }) => {
    await page.goto("/");
    const rows = page.getByTestId("operation-row");
    const data = await rows.evaluateAll((els) =>
      els.map((e) => ({
        precision: (e as HTMLElement).dataset.precision,
        time: e.querySelector(".op-row__time")?.textContent ?? null,
      })),
    );
    expect(data.length).toBeGreaterThan(5);
    for (const row of data) {
      if (row.precision === "none") expect(row.time).toBeNull();
      if (row.precision === "minute") expect(row.time).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  test("overdue work is carried forward above the present", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Carried forward")).toBeVisible();
    const order = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll("[data-event-id], [data-testid=now-marker]")];
      return nodes.map((n) => (n as HTMLElement).dataset.eventId ?? "NOW");
    });
    expect(order.indexOf("ev-c-002")).toBeLessThan(order.indexOf("NOW"));
    expect(order.indexOf("ev-c-001")).toBeLessThan(order.indexOf("NOW"));
  });

  test("the add flow defaults to the visible future date", async ({ page }) => {
    await page.goto("/");
    const initial = await page.getByTestId("add-fab").getAttribute("data-default-date");
    expect(initial).toBeTruthy();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const later = await page.getByTestId("add-fab").getAttribute("data-default-date");
    expect(later).toBeTruthy();
    expect(Date.parse(later!)).toBeGreaterThan(Date.parse("2026-07-26"));
  });

  test("exactly one luminous selection is visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".op-row--focused")).toHaveCount(1);
  });
});

test.describe("sheets and confirmation", () => {
  test("money and access actions require a review sheet", async ({ page }) => {
    await page.goto("/requests");
    await page.getByTestId("request-row").first().click();
    await expect(page.getByTestId("detail-sheet")).toBeVisible();

    await page.getByTestId("approve-request").click();
    const confirm = page.getByTestId("confirm-sheet");
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText("Approve access request?");

    await confirm.getByTestId("confirm-action").click();
    await expect(page.getByRole("status").filter({ hasText: "local fixture change" })).toBeVisible();
  });

  test("the composer opens with a type chooser and returns focus on close", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("add-fab").click();
    await expect(page.getByTestId("composer-sheet")).toBeVisible();
    await expect(page.getByTestId("composer-option-access")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("composer-sheet")).toBeHidden();
    await expect(page.getByTestId("add-fab")).toBeFocused();
  });

  test("Collecta opens with page context and drafts before confirming", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("collecta-orb").click();
    const sheet = page.getByTestId("collecta-sheet");
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId("collecta-context")).toContainText("/");

    await page.getByTestId("collecta-input").fill("publish the founders dinner");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByTestId("collecta-draft")).toBeVisible();
    await expect(page.getByTestId("collecta-draft")).toContainText("nothing changes until you confirm");

    await page.getByTestId("collecta-review").click();
    await expect(page.getByTestId("confirm-sheet")).toBeVisible();
  });
});

test.describe("product language", () => {
  const BANNED = [
    "booking",
    "bookings",
    "stay",
    "stays",
    "guest",
    "guests",
    "villa",
    "check-in",
    "checkout",
    "check out",
    "housekeeping",
    "occupancy",
  ];

  for (const path of TOP_LEVEL) {
    test(`${path} uses access-network language`, async ({ page }) => {
      await page.goto(path);
      const text = ((await page.locator("main").innerText()) + " " +
        (await page.locator("nav").first().innerText())).toLowerCase();
      const found = BANNED.filter((w) => new RegExp(`\\b${w}\\b`).test(text));
      expect(found, `${path} contains hospitality language`).toEqual([]);
    });
  }
});
