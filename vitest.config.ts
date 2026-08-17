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
    },
});
