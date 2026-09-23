/**
 * `build-en-gb-sets.ts --jobs N` MUST PRODUCE EXACTLY WHAT `--jobs 1` PRODUCES.
 *
 * ⚠ THE BUILDER IS THE SOURCE OF A COMMITTED ARTIFACT, so a sharding bug does not fail loudly — it writes
 * five plausible word lists that nothing else checks, and `check:en-gb-sets` then reports them as fresh
 * because they DO reproduce from the (wrong) builder. The same shape as #1381's months of drift.
 *
 * ⚠ AND THE GATE IS ON CONTENTS, NOT COUNTS. Two different merges can agree on five totals and disagree
 * about who is in them, so `--dump` prints the memberships themselves.
 *
 * ⚠ `--limit` IS WHY THIS IS AFFORDABLE. A full run is minutes; limiting the ROW LIST keeps the shard
 * arithmetic (`index % n`) identical, so the property under test is the real one. The builder refuses to
 * WRITE the shipped sets while `--limit` is set, so a test device cannot become a shipping path.
 *
 * ⚠ AND IT COSTS ~19s OF CPU AND ~0 OF WALL CLOCK. Review flagged the fixed cost; measured, the suite's
 * wall time is set by its LONGEST FILE (onset-r, ~47s) and this one runs beside it. The floor is engine
 * load plus the dict-wide inflection index, which `--limit` cannot reduce.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { describe, expect, it } from "vitest";

// ⚠ EVERY SET THE BUILDER WRITES MUST BE LISTED, and `trap` was the sixth (#1414). This array is what the
// clobber test snapshots and restores; a set missing from it is a file the test would destroy and not put
// back if the `--limit` guard ever regressed — the failure mode is silent because the assertion below is
// about the throw, not about the files.
const SETS = ["bath", "cloth", "yod", "palm", "lotr", "trap"] as const;
const setPath = (s: string): string => `data/languages/english-gb/en-gb-${s}.tsv`;

/** stdout AND stderr — stderr carries `[jobs] effective N`, which is how a sharded run proves it was
 *  actually taken rather than clamped away to the serial path. */
const run = (jobs: number): { out: string; jobs: number } => {
    const r = spawnSync("npx",
        ["tsx", "tools/referee-eval/build-en-gb-sets.ts", "--dump", "--limit", "1500", "--jobs", String(jobs)],
        { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    expect([jobs, r.status]).toEqual([jobs, 0]);
    const m = /\[jobs\] effective (\d+)/u.exec(r.stderr);
    expect([jobs, m !== null]).toEqual([jobs, true]);
    return { out: r.stdout, jobs: Number(m![1]) };
};

describe("build-en-gb-sets --jobs", () => {
    // ⚠ SKIPPED RATHER THAN VACUOUS ON A ONE-CORE RUNNER. `jobs` is CLAMPED to the core count, so
    // `--jobs 2` there silently becomes the serial path and this would pass while exercising nothing —
    // green for exactly the bug it exists to catch. The `effective` assertion is the other half: a clamp
    // for any other reason fails loudly instead of quietly comparing serial against serial.
    it.skipIf(availableParallelism() < 2)(
        "a sharded run is byte-identical to the serial one, memberships and all", () => {
            const serial = run(1);
            expect(serial.out.split("\n").length).toBeGreaterThan(20);
            const sharded = run(2);
            expect(sharded.jobs).toBe(2);   // it really did shard
            expect(sharded.out).toBe(serial.out);
        }, 300_000);

    it("refuses to write the shipped sets while --limit is set", () => {
        // ⚠ THIS TEST'S FAILURE MODE IS CLOBBERING FIVE COMMITTED FILES, so it snapshots them and puts
        // them back. Without `--dump`/`--check` the run reaches `write()`, which is the point — and if
        // the guard is ever removed, the six sets would be overwritten with ~95%-truncated memberships
        // before the assertion had anything to say.
        const before = SETS.map((s) => [setPath(s), readFileSync(setPath(s), "utf8")] as const);
        try {
            // ⚠ AND IT ASSERTS THE MESSAGE, not merely a non-zero exit — a typo in the path, a missing
            // `tsx`, or an ENOENT from an unrelated file all exit non-zero and would pass a bare throw.
            expect(() => execFileSync("npx",
                ["tsx", "tools/referee-eval/build-en-gb-sets.ts", "--limit", "500"],
                { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }))
                .toThrow(/--limit is a test device/u);
        } finally {
            for (const [p, body] of before) if (readFileSync(p, "utf8") !== body) writeFileSync(p, body);
        }
    }, 300_000);
});
