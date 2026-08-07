#!/usr/bin/env node
/**
 * Assert what `npm publish` would actually ship.
 *
 * ⚠ THE FENCE IS `files` IN package.json, AND IT IS EASY TO LOSE. Without it npm falls back to .gitignore and
 * packs the whole repo; with it, the allowlist SILENTLY OVERRIDES .gitignore, so a pattern that stops matching
 * leaks rather than errors. Neither failure announces itself — the package just gets bigger.
 *
 * Extracted from .github/workflows/ci.yml so CI and `npm run ci` run the SAME code. Inline in the workflow it
 * could only be exercised by pushing, which is how a check drifts from the thing it checks.
 */
import { execFileSync } from "node:child_process";

const FORBIDDEN = /^(docs|tools|test)\/|\.test\.ts$/u;

const raw = execFileSync("npm", ["pack", "--dry-run", "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const files = JSON.parse(raw)[0].files.map((f) => f.path);

const leaked = files.filter((p) => FORBIDDEN.test(p));
if (leaked.length) {
    console.error(`would publish ${leaked.length} file(s) that must not ship:`);
    for (const p of leaked.slice(0, 40)) console.error(`  ${p}`);
    if (leaked.length > 40) console.error(`  … and ${leaked.length - 40} more`);
    process.exit(1);
}
console.log(`ok — ${files.length} files, no docs/ tools/ test/`);
