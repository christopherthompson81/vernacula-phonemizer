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

/** `npm pack --dry-run --json` for one workspace (or the root), as a list of paths. */
const packed = (args) => {
    const raw = execFileSync("npm", ["pack", "--dry-run", "--json", ...args], {
        encoding: "utf8",
        maxBuffer: 256 * 1024 * 1024,
    });
    return JSON.parse(raw)[0].files.map((f) => f.path);
};

const files = packed([]);

const leaked = files.filter((p) => FORBIDDEN.test(p));
if (leaked.length) {
    console.error(`would publish ${leaked.length} file(s) that must not ship:`);
    for (const p of leaked.slice(0, 40)) console.error(`  ${p}`);
    if (leaked.length > 40) console.error(`  … and ${leaked.length - 40} more`);
    process.exit(1);
}

/**
 * ⚠ AND ASSERT WHAT THE PACKAGES CAN LOAD, NOT ONLY WHAT THEY EXCLUDE (#1247).
 *
 * The fence above is one-directional: it catches a file that LEAKS, never one that is missing. That is how
 * `data/` came to be absent from every publishable artifact while this check stayed green — `npm pack`
 * produced 734 files with ZERO under `data/`, and an installed copy threw ENOENT on `hindi.jsonc` at the
 * first manifest read, before any consumer code ran. The engine ships no data BY DESIGN now; the data
 * package is what must carry it, so probe the keys the engine reads first and the model the async path
 * needs. A probe list is not coverage, but it is the difference between a check that can fail and one that
 * cannot.
 */
const REQUIRED = [
    "core/phonology.jsonc", // the shared abugida tables
    "languages/hindi/hindi.jsonc", // the first manifest `registry.ts` reads — where #1247 surfaced
    "languages/norwegian/nb-g2p-tagger.int8.onnx", // the async path is the one that matters
    "languages/norwegian/nb-g2p-tagger.meta.json",
    // ⚠ THE ATTRIBUTION SET, PROBED IN THE PACKED OUTPUT AND NOT IN `files`. Declaring the names is not
    //   the same as shipping them: a `!` negation derived from .gitignore once stripped all 15 files under
    //   LICENSES/ — PROVENANCE.md, the per-artifact licence map, among them — while the unit test that
    //   reads `files` stayed green, because `files` still NAMED "LICENSES". Only packing shows it.
    "NOTICE.md",
    "LICENSE",
    "LICENSES/PROVENANCE.md",
    "LICENSES/licencing_posture.md",
];
const dataFiles = new Set(packed(["-w", "data"]));
const missing = REQUIRED.filter((p) => !dataFiles.has(p));
if (missing.length) {
    console.error(`the data package would publish without ${missing.length} required file(s):`);
    for (const p of missing) console.error(`  ${p}`);
    process.exit(1);
}
if (files.some((p) => p.startsWith("data/"))) {
    console.error("the engine package ships data/ — it must come from vernacula-phonemizer-data");
    process.exit(1);
}

console.log(
    `ok — engine ${files.length} files (no docs/ tools/ test/, no data/), data package ${dataFiles.size} files`,
);
