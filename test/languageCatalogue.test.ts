import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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

        /**
         * ⚠ `inherited` MUST MEAN DELEGATION, NEVER BORROWING — the one way this column can lie in the
         * direction that costs work. A missing layer reported as `inherited` drops the language out of the
         * planning query entirely, so it reads as done and is never picked up again.
         *
         * The original test was "imports something from ../Y and calls it", and five rows were wrong under
         * it. `rn` (Kirundi) borrows exactly one function from Kinyarwanda — `composeRwandaRundi`, a number
         * composer — and flipped to `inherited` the moment kinyarwanda gained a normalize.ts, though no
         * Kinyarwanda normalizer runs for it. `bar`/`fo` borrow danish's `unitsFirstNumberToWords`, `ba`
         * borrows russian's `phonemizeWord`, `bs` borrows serbian's. All five are ordinary engines with no
         * layer at all. Caught by the rw normalization run, when its own regeneration flipped `rn`.
         *
         * Both directions are pinned, because the fix is a NARROWING and a narrowing can cut too deep: the
         * genuine wrappers below have no normalize.ts of their own and must keep reading `inherited`, or
         * 420 million speakers of es-419 reappear at the head of the planning query for work already done.
         */
        it("⚠ `inherited` is delegation to a factory, not a borrowed helper", () => {
            const rows = readFileSync(join(CAT, "catalogue.tsv"), "utf8").trim().split("\n");
            const cols = rows[0]!.split("\t");
            const col = { code: cols.indexOf("code"), norm: cols.indexOf("normalization") };
            const value = (code: string): string =>
                rows.slice(1).map((r) => r.split("\t")).find((r) => r[col.code] === code)?.[col.norm] ?? "MISSING";

            // Borrows one helper across a directory boundary; runs no other language's normalizer.
            // ⚠ THE ASSERTION IS "NOT inherited", NOT "EMPTY", AND THE DIFFERENCE IS THE WHOLE POINT — it is
            // the invariant the docstring above actually states. `toBe("")` pinned a second, weaker claim
            // with a shelf life: that these five HAVE NO LAYER. That was true the day it was written and
            // false within a day — `rn` and `bar` were both treated in the very next batch and now read
            // `done`. The borrowing fact is what survives and what matters: `rn` takes `composeRwandaRundi`
            // from kinyarwanda and `bar` takes `unitsFirstNumberToWords` from danish, and neither runs the
            // donor's normalizer. `done` and `""` both satisfy that; only `inherited` breaks it.
            //
            // ⚠ Written twice, independently, by the two agents treating rn and bar — each hit the failure,
            // each diagnosed it the same way. A test that fires the moment its subject gets fixed is pinning
            // the accident rather than the rule.
            for (const code of ["rn", "bar", "fo", "ba", "bs"])
                expect(value(code), `${code} borrows a helper — it must not read as inherited`).not.toBe("inherited");

            // ⚠ AND A THIRD SHAPE, WHICH PASSES THE FACTORY TEST AND STILL INHERITS NOTHING: `hyw` calls
            // `makeArmenianEngine`, a genuine factory — but that factory takes the normalizer as a PARAMETER
            // (`pre`, defaulting to identity) and Western Armenian passes no argument for it, so no Armenian
            // normalizer runs. It flipped to `inherited` the moment `armenian/normalize.ts` existed while
            // being wholly untreated: `5%` reads *hinkʰ* with the sign dropped where hy reads *hinɡ tokos*,
            // and hyw's entire mined corpus is BYTE-IDENTICAL across the change (442/442 utterances). Same
            // failure as the five above, one narrowing later — a language that needs work reading as done.
            expect(value("hyw"), "hyw calls a factory that takes its normalizer as an argument it never passes")
                .not.toBe("inherited");

            // Calls another language's FACTORY, so that engine — and its layer — is what actually runs.
            for (const code of ["es-419", "awa", "bho", "mai", "pt-BR", "en-GB"])
                expect(value(code), `${code} is a wrapper — it must still read as inherited`).toBe("inherited");
        });

        it("languages.db is in sync with catalogue.tsv", () => {
            // Compares ROW CONTENT, not bytes — bytes would make the check hostage to sqlite's page layout.
            const out = run("build.py", "--check");
            expect(out).toContain("is in sync with catalogue.tsv");
        });
    });
});
