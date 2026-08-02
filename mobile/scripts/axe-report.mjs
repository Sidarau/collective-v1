/**
 * Prints the failing nodes behind an axe violation, which `npm run test:e2e`
 * only summarises by rule id. Start the app first, then:
 *   npx next start --port 3212 &
 *   npm run axe:report -- / /dues /design-system
 */
import { chromium, devices } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const args = process.argv.slice(2);
const reduced = args.includes("--reduced");
const routes = args.filter((a) => !a.startsWith("--"));
if (!routes.length) routes.push("/");
const base = process.env.BASE_URL ?? "http://127.0.0.1:3212";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  ...devices["iPhone 13"],
  browserName: undefined,
  viewport: { width: 390, height: 844 },
  isMobile: true,
  deviceScaleFactor: 1,
  reducedMotion: reduced ? "reduce" : "no-preference",
});
const page = await ctx.newPage();
let failed = 0;

for (const route of routes) {
  await page.goto(`${base}${route}`);
  await page.waitForTimeout(400);
  const res = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  const blocking = res.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  console.log(`\n===== ${route} — ${blocking.length ? `${blocking.length} blocking` : "clean"} =====`);
  for (const v of blocking) {
    failed += 1;
    console.log(`\n## ${v.id} (${v.impact}) — ${v.nodes.length} nodes`);
    for (const n of v.nodes.slice(0, 8)) {
      console.log(`  target: ${n.target.join(" ")}`);
      console.log(`  why:    ${[...(n.any ?? []), ...(n.all ?? [])].map((c) => c.message).join(" | ")}`);
      console.log(`  html:   ${n.html.slice(0, 140)}`);
    }
  }
}

await browser.close();
process.exit(failed ? 1 : 0);
