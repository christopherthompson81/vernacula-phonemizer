import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The language catalogue (tools/language-catalogue/) records what we implemented, rejected or left alone,
// and its `normalization` column is what the next target is picked off. Two of its facts are DERIVED and
// both go stale silently:
//
//   · `normalization` is computed from the repo by derive-normalization.py — whether a language's engine
//     directory has a normalize.ts AND whether the engine calls it.
//   · languages.db is a COMMITTED BUILD ARTIFACT of catalogue.tsv, produced by build.py.
//
// ⚠ WHY THIS TEST EXISTS. Both are manual steps documented in the README, and the column drifted by four
// rows across one working session — si, kmr, lo and mg each sat empty after their layer had shipped. A
// planning column that is wrong at the top is worse than no column, because the whole point of it is to
// stop re-deriving the same scope verdicts; the four stale rows were exactly the four most recent, i.e.
// the ones a planner would have trusted most.
//
// CI's automatic triggers are off in this repo (see .github/workflows/ci.yml), so the gate that actually
// runs before a merge is `npm test` — which is why this is a test and not a workflow step.
const ROOT = join(import.meta.dirname, "..");
const CAT = join(ROOT, "tools", "language-catalogue");

const havePython = (() => {
    try {
        execFileSync("python3", ["-c", "import csv, sqlite3"], { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
})();

/** Run one of the catalogue tools and return its stdout; throws with the tool's own message on a non-zero exit. */
const run = (script: string, ...args: string[]): string =>
    execFileSync("python3", [join(CAT, script), ...args], { cwd: CAT, encoding: "utf8", timeout: 120_000 });

describe("language catalogue", () => {
    it("its files are all present", () => {
        for (const f of ["catalogue.tsv", "languages.db", "schema.sql", "build.py", "derive-normalization.py"])
            expect(existsSync(join(CAT, f)), f).toBe(true);
    });

    // Skipped without a python3 on PATH, the same shape as the optional-venv tests. The two scripts need
    // only the standard library — no venv, no torch — so this skips on a bare container and nowhere else.
    describe.skipIf(!havePython)("with python3 available", () => {
        it("the derived `normalization` column matches the repo", () => {
            const out = run("derive-normalization.py", "--check");
            // The tool prints e.g. `(none)=99, done=99, inherited=17   (0 cell(s) differ from the file)`.
            expect(out, `stale — run: python3 tools/language-catalogue/derive-normalization.py\n${out}`)
                .toMatch(/\(0 cell\(s\) differ/);
        });

        it("no language has a normalizer that is written but never wired", () => {
            // `partial` is a real state and is reported rather than rounded up to `done`: a normalize.ts can
            // exist and the engine never call it, which review.ts checks separately because it came apart in
            // practice. The count only appears in the tool's output when it is non-zero.
            const out = run("derive-normalization.py", "--check");
            expect(out, `a normalizer exists but is not wired:\n${out}`).not.toContain("partial=");
        });

        it("languages.db is in sync with catalogue.tsv", () => {
            // Compares ROW CONTENT, not bytes — bytes would make the check hostage to sqlite's page layout.
            const out = run("build.py", "--check");
            expect(out).toContain("is in sync with catalogue.tsv");
        });
    });
});
