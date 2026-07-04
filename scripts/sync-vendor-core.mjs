#!/usr/bin/env node
// Refresh admin/vendor-core from packages/core/src. The admin app resolves
// @core/* from its own vendored snapshot (self-contained Vercel CLI deploys —
// see ZEUG-415), so this must run after any packages/core change. Wired into
// admin's predev/prebuild; skips silently when the source tree isn't present
// (e.g. remote Vercel build of the uploaded admin/ directory).
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "packages", "core", "src");
const target = join(root, "admin", "vendor-core");

if (!existsSync(source)) {
  console.log("[sync-vendor-core] packages/core/src not found — skipping (vendored snapshot assumed current)");
  process.exit(0);
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log("[sync-vendor-core] admin/vendor-core refreshed from packages/core/src");
