import { defineConfig } from "vitest/config";

// ⚠ THE SUITE IS SCOPED TO `test/`, AND THE REASON IS AGENT WORKTREES. Vitest's default include pattern is
// a recursive glob over the whole project with only `node_modules` and `dist` excluded — so the moment a
// worktree lands inside the checkout (`.claude/worktrees/agent-*/`, which is how parallel agents are
// isolated), `npm test` starts collecting THAT worktree's copy of all 248 files as well.
//
// That is not a slow build, it is a WRONG ANSWER: a run in this repo reported three failures from
// `.claude/worktrees/agent-…/test/languageCatalogue.test.ts`, all of them "the derived normalization column
// is stale" — true of a worktree with a half-finished layer in it, and false of this checkout. A phantom
// failure that names a real test file and a real assertion is exactly the kind a reader believes.
//
// All 248 test files live under `test/` and none lives anywhere else (verified with `find`, not assumed),
// so naming that directory costs no coverage and makes the collected set independent of what else is on
// disk. The agents' own runs were never affected — their worktrees do not contain `.claude/` — so this is
// a hazard for the PARENT of a fan-out only.
export default defineConfig({
    test: {
        include: ["test/**/*.test.ts"],
        // ⚠ FULL VALUES IN FAILURE MESSAGES. The default truncates a long expected/actual to ~40 chars
        // with an ellipsis, which is fine for reading and useless for MECHANICALLY correcting a
        // large expectation change — a phonemizer diff is one character inside a 60-character IPA
        // string, and the ellipsis hides exactly which. 0 disables the cutoff.
        chaiConfig: { truncateThreshold: 0 },

        // ⚠ ONE MODULE REGISTRY PER WORKER, NOT PER FILE. Vitest isolates by default, so each of the
        // 300 test files re-imports and re-parses the engine from scratch — and for this repo that
        // is 14.5 MB of English data alone (g2p-dict 3.0, accent-lexicon 3.0, g2p-model 3.2,
        // pos-model 2.9) before any other language loads. Measured on a 16-core box:
        //
        //                        wall     collect    tests    CPU
        //   isolate (default)    103s      816s      444s    18m53s
        //   isolate: false        75s      104s      400s     8m28s
        //
        // COLLECT falls by 87% and is where nearly all of the saving is; the tests themselves barely
        // move. That is the shape of the problem — the suite was paying to re-read data, not to run.
        //
        // ⚠ THE RISK IS SHARED MODULE STATE, AND THIS SUITE HAD SOME. A grep for the usual three
        // ways (`process.env` writes, assignment to a settable export, `vi.mock`/`vi.spyOn`/
        // `stubGlobal`) found nothing and three shuffled runs passed — and that was not enough.
        // `browser-seams.test.ts` calls `vi.resetModules()` and installs a BROWSER data source
        // backed by a frozen prefetch map, which is the entire point of the file; per-file isolation
        // used to contain it. Without isolation the next file in that worker inherited a reader that
        // only knew the prefetched keys, and any other language died with
        // `not prefetched: languages/<x>/<x>.jsonc`.
        //
        // ⚠ IT TOOK A FOURTH SHUFFLED RUN TO SEE IT, and then 8, 11, 14 or 22 files at once
        // depending on scheduling — about one run in five. Plain runs never failed, because in file
        // order that file lands late. The fix is an `afterAll(() => vi.resetModules())` there, so it
        // puts the registry back; eight shuffled runs are clean since.
        //
        // ⚠ SO `--sequence.shuffle` IS THE GATE FOR THIS CLASS, and a grep is not. Run it when
        // adding a test that touches module-level state — installing a data source, an ORT loader,
        // a neural hook. Nothing else sees an order dependence, and a plain run passing is not
        // evidence.
        //
        // ⚠ `pool: "threads"` WAS TRIED AND IS SLOWER — 116s against forks' 103s on the same tree.
        // The default pool stays.
        //
        // If a test ever does need a private registry, `isolate` is settable per-file with
        // `// @vitest-environment` style options rather than by reverting this.
        isolate: false,
    },
});
