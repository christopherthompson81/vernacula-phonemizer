import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// What `npm publish` would ship. Without a `files` allowlist npm falls back to `.gitignore` and packs the whole
// repo — 2193 files / 253 MB, including all of tools/ (which carries absolute developer paths and 64 MB of referee
// corpora) and all 234 docs/investigations/ files, which are not meant to leave the working tree at all.
//
// The subtlety this guards: **a `files` allowlist OVERRIDES `.gitignore`.** Adding `"files": ["src", …]` silently
// re-included two gitignored fp32/torch intermediates (da-g2p-tagger.onnx, km_segmenter.pt — 18 MB of artifacts
// whose whole point is that only their int8 counterparts ship). Each `src/` entry in .gitignore therefore has to be
// restated as a `!` negation in `files`, and the two lists have to stay in step.
const ROOT = join(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    files?: string[];
    license?: string;
};

describe("npm packaging", () => {
    it("declares a license and a files allowlist", () => {
        expect(pkg.license).toBe("MIT");
        expect(pkg.files, "no `files` → npm packs docs/, tools/ and test/ too").toBeDefined();
    });

    it("ships src/ plus the licensing files, and nothing else", () => {
        const positives = (pkg.files ?? []).filter((f) => !f.startsWith("!"));
        expect(positives.sort()).toEqual(["LICENSES", "NOTICE.md", "src"]);
        // README.md, LICENSE and package.json are added by npm regardless.
        for (const never of ["docs", "tools", "test"])
            expect(positives, `${never}/ must not be published`).not.toContain(never);
    });

    it("restates every gitignored src/ path as a files negation", () => {
        const ignored = readFileSync(join(ROOT, ".gitignore"), "utf8")
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.startsWith("src/"));
        const negated = new Set((pkg.files ?? []).filter((f) => f.startsWith("!")).map((f) => f.slice(1)));
        expect(ignored.length, "expected some gitignored src/ intermediates").toBeGreaterThan(0);
        for (const path of ignored)
            expect(
                negated.has(path),
                `.gitignore excludes ${path}, but package.json "files" would publish it — add "!${path}"`,
            ).toBe(true);
    });

    // The subtler half: .gitignore's UNANCHORED globs (*.scratch.*, *.log, __pycache__/) match anywhere,
    // including under src/ — and an allowlist ignores them too. `*.scratch.*` is the one that matters:
    // .gitignore calls those "session handoffs and working files, never committed", so publishing one to
    // the registry is precisely the leak that rule exists to prevent. Verified empirically: before these
    // negations, src/probe.scratch.md and src/probe.log both appeared in `npm pack --dry-run`.
    it("negates gitignored globs under src/ too, not just anchored paths", () => {
        const globs = readFileSync(join(ROOT, ".gitignore"), "utf8")
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith("#") && !l.includes("/") && l.includes("*"));
        const negated = new Set((pkg.files ?? []).filter((f) => f.startsWith("!")));
        for (const g of globs)
            expect(
                negated.has(`!src/**/${g}`),
                `.gitignore has the unanchored glob "${g}"; a files allowlist bypasses it — add "!src/**/${g}"`,
            ).toBe(true);
    });
});
