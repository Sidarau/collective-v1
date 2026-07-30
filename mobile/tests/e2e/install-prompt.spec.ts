import { mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * The Add to Home Screen coach mark, on the only platform that needs it.
 *
 * The project's iPhone descriptor already supplies a Safari user agent, so the
 * real detection path runs here — nothing is stubbed except the storage, which
 * the shared config pre-seeds as "installed" for every other spec.
 */

const DIR = "screenshots";

// A first visit: no dismissals, not installed.
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeAll(async () => {
  await mkdir(DIR, { recursive: true });
});

test.describe("add to home screen", () => {
  test("rises on its own after the settle delay", async ({ page }) => {
    await page.goto("/");
    const card = page.getByTestId("add-to-home-screen");

    // Not part of the page's own arrival — it waits.
    await expect(card).toBeHidden();
    await expect(card).toBeVisible({ timeout: 10_000 });

    await expect(card).toHaveAttribute("role", "dialog");
    await expect(page.getByText(/in the Safari toolbar/)).toBeVisible();
    await expect(page.getByText("Add to Home Screen", { exact: true }).first()).toBeVisible();
  });

  test("covers the rail it points past, and clears the safe area", async ({ page }) => {
    await page.goto("/");
    const card = page.getByTestId("add-to-home-screen");
    await expect(card).toBeVisible({ timeout: 10_000 });

    const box = await card.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    // Anchored to the bottom edge: the arrow has to aim at Safari's toolbar,
    // which sits below the viewport.
    expect(Math.round(box!.y + box!.height)).toBe(viewport!.height);
  });

  test("dismissal is remembered across a reload", async ({ page }) => {
    await page.goto("/");
    const card = page.getByTestId("add-to-home-screen");
    await expect(card).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Not now" }).click();
    await expect(card).toBeHidden();

    const stored = await page.evaluate(() => window.localStorage.getItem("oc.a2hs.v1"));
    expect(JSON.parse(stored ?? "{}")).toMatchObject({ dismissals: 1 });

    await page.reload();
    await page.waitForTimeout(5_000);
    await expect(card).toBeHidden();
  });

  test("?a2hs=show opens it for review, ?a2hs=reset clears the snooze", async ({ page }) => {
    await page.goto("/?a2hs=show");
    await expect(page.getByTestId("add-to-home-screen")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Not now" }).click();

    await page.goto("/?a2hs=reset");
    const stored = await page.evaluate(() => window.localStorage.getItem("oc.a2hs.v1"));
    expect(stored).toBeNull();
  });

  test("has no serious or critical accessibility violations", async ({ page }) => {
    await page.goto("/?a2hs=show");
    await expect(page.getByTestId("add-to-home-screen")).toBeVisible({ timeout: 10_000 });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(
      results.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${v.id} — ${v.help}`),
    ).toEqual([]);
  });

  test("captures evidence", async ({ page }, testInfo) => {
    await page.goto("/?a2hs=show");
    await expect(page.getByTestId("add-to-home-screen")).toBeVisible({ timeout: 10_000 });
    // Past the entrance, so the still shows the resting state rather than a
    // half-played rise.
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${DIR}/${testInfo.project.name}__add-to-home-screen.png` });
  });
});

/**
 * Shared links. These are the ones an operator sends to a member, so the URL
 * has to survive a real browser: the params fire the prompt once and then
 * leave nothing behind.
 */
test.describe("add to home screen — shared link", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("an invitation names the sender and cleans up after itself", async ({
    page,
  }, testInfo) => {
    await page.goto("/?a2hs=invite&from=Don");
    const card = page.getByTestId("add-to-home-screen");
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Don shared this with you")).toBeVisible();

    // The address bar is clean, so a refresh does not re-fire and a member
    // forwarding the link does not pass on someone else's name.
    expect(new URL(page.url()).search).toBe("");

    await page.waitForTimeout(600);
    await page.screenshot({ path: `${DIR}/${testInfo.project.name}__add-to-home-screen-invite.png` });
  });

  test("an invitation reaches a member who already dismissed the prompt", async ({ page }) => {
    await page.goto("/");
    const card = page.getByTestId("add-to-home-screen");
    await expect(card).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Not now" }).click();

    // Snoozed for a week — an ordinary visit stays quiet.
    await page.reload();
    await page.waitForTimeout(5_000);
    await expect(card).toBeHidden();

    await page.goto("/?a2hs=invite");
    await expect(card).toBeVisible({ timeout: 10_000 });
  });

  test("carries the prompt onto a deep link", async ({ page }) => {
    await page.goto("/requests/req-301?a2hs=invite&from=Ana%20Martins");
    await expect(page.getByTestId("add-to-home-screen")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Ana Martins shared this with you")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/requests/req-301");
  });
});

/**
 * The in-app-browser variant is a different layout, not different copy: no
 * arrow, because nothing in Instagram's toolbar performs the gesture.
 */
test.describe("add to home screen — in-app browser", () => {
  test.use({
    storageState: { cookies: [], origins: [] },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22C152 Instagram 361.0.0.25.88",
  });

  test("sends the operator to Safari instead of pointing at a toolbar", async ({
    page,
  }, testInfo) => {
    await page.goto("/?a2hs=show");
    const card = page.getByTestId("add-to-home-screen");
    await expect(card).toBeVisible({ timeout: 10_000 });

    await expect(card).toHaveAccessibleName("Open in Safari");
    await expect(page.getByRole("button", { name: /copy link/i })).toBeVisible();
    expect(await card.locator(".a2hs__pointer").count()).toBe(0);

    await page.waitForTimeout(600);
    await page.screenshot({ path: `${DIR}/${testInfo.project.name}__add-to-home-screen-webview.png` });
  });
});
