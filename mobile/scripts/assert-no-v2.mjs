#!/usr/bin/env node
/**
 * Deterministic guard: this application must never expose a versioned path.
 *
 * mobile-routes.json declares `versionedPathAllowed: false`. The rejected /v2
 * work lives in the admin app and must not reappear here — not as a route
 * segment, not as a link target, not as a redirect.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const SCAN_DIRS = ["src", "public"];
const SKIP = new Set(["node_modules", ".next", "test-results", "playwright-report", "screenshots"]);

/** Route segments named v2, and hrefs/redirects pointing at /v2. */
const HREF_V2 = /(?:href|src|url|redirect|pathname)\s*[:=]\s*["'`][^"'`]*\/v2(?:\/|["'`])/i;
const ROUTE_V2 = /[/\\]v2[/\\]/;

const problems = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    const rel = relative(root, full);
    if (statSync(full).isDirectory()) {
      if (/^v2$/i.test(entry)) problems.push(`route segment directory: ${rel}`);
      walk(full);
      continue;
    }
    if (ROUTE_V2.test(rel)) problems.push(`file under a v2 path: ${rel}`);
    if (!/\.(tsx?|jsx?|mjs|css|json|html)$/.test(entry)) continue;
    const text = readFileSync(full, "utf8");
    for (const [i, line] of text.split("\n").entries()) {
      if (HREF_V2.test(line)) problems.push(`${rel}:${i + 1} links to /v2 → ${line.trim()}`);
    }
  }
}

for (const dir of SCAN_DIRS) {
  try {
    walk(join(root, dir));
  } catch {
    // A missing directory is not a failure for this check.
  }
}

// No declared route may contain a version segment.
const routesSource = readFileSync(join(root, "src/lib/routes.ts"), "utf8");
for (const [, path] of routesSource.matchAll(/path:\s*"([^"]+)"/g)) {
  if (/\/v\d+(\/|$)/.test(path)) problems.push(`versioned route declared: ${path}`);
}

if (problems.length) {
  console.error("✗ /v2 surface detected in the mobile application:\n");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log("✓ no user-facing /v2 route exists in mobile/");
