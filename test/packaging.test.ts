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
const dataPkg = JSON.parse(readFileSync(join(ROOT, "data/package.json"), "utf8")) as {
    files?: string[];
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

    /**
     * ⚠ THE ALLOWLIST THAT OVERRIDES .gitignore IS THE **DATA** PACKAGE'S NOW, AND THE RULE HAD NOT MOVED
     * WITH IT (#1247). This test used to check `src/` paths, and it passed for a year while guarding
     * nothing: the trainers' intermediates moved to `data/` in #876 and `.gitignore` kept saying `src/…`,
     * so the move carried `km_segmenter.pt` out from under its own rule and committed the 8.9 MB torch
     * checkpoint. `data/package.json` blanket-includes `core` and `languages`, so any gitignored
     * intermediate written under them ships into a 60 MB package unless it is negated — the same trap,
     * one directory over.
     */
    it("restates every gitignored data/ path as a data-package files negation", () => {
        const ignored = readFileSync(join(ROOT, ".gitignore"), "utf8")
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.startsWith("data/"));
        const negated = new Set((dataPkg.files ?? []).filter((f) => f.startsWith("!")).map((f) => f.slice(1)));
        const positives = new Set((dataPkg.files ?? []).filter((f) => !f.startsWith("!")));
        expect(ignored.length, "expected some gitignored data/ intermediates").toBeGreaterThan(0);
        for (const path of ignored) {
            const rel = path.slice("data/".length).replace(/\/$/u, ""); // package keys are root-relative
            // ⚠ ACCOUNTED FOR, NOT MERELY NEGATED — the two reasons a path is gitignored are opposite here.
            //   A trainer intermediate is ignored because it must NOT ship. LICENSE / LICENSES/ / NOTICE.md
            //   are ignored because they are COPIES generated at pack time from the repo root, and they are
            //   the one thing this package absolutely must carry. Deriving "gitignored ⇒ negate" from the
            //   first class silently stripped the second: 15 attribution files, including
            //   LICENSES/PROVENANCE.md, vanished from the packed set while every gate here stayed green.
            expect(
                negated.has(rel) || positives.has(rel),
                `.gitignore excludes ${path}: either negate it ("!${rel}") or ship it deliberately`,
            ).toBe(true);
        }
    });

    it("negates the unanchored gitignored globs inside the data package too", () => {
        // Same subtlety as for src/ below: `*.log` and friends match anywhere, and an allowlist ignores
        // them. `core` and `languages` are blanket includes, so nothing else stops a stray one shipping.
        const globs = readFileSync(join(ROOT, ".gitignore"), "utf8")
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith("#") && !l.includes("/") && l.includes("*"));
        const negated = new Set(dataPkg.files ?? []);
        for (const g of globs)
            expect(negated.has(`!**/${g}`), `data/package.json "files" needs "!**/${g}"`).toBe(true);
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
