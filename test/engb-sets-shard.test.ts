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
 */
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const dump = (jobs: number): string =>
    execFileSync("npx", ["tsx", "tools/referee-eval/build-en-gb-sets.ts", "--dump", "--limit", "6000", "--jobs", String(jobs)],
        { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

describe("build-en-gb-sets --jobs", () => {
    it("a sharded run is byte-identical to the serial one, memberships and all", () => {
        const serial = dump(1);
        expect(serial.split("\n").length).toBeGreaterThan(20);
        expect(dump(3)).toBe(serial);
    }, 300_000);

    it("refuses to write the shipped sets while --limit is set", () => {
        // ⚠ THE DEVICE MUST NOT BECOME A SHIPPING PATH. `--limit` produces meaningful-looking but
        // meaningless sets; writing them would silently delete ~95% of every membership.
        expect(() => execFileSync("npx",
            ["tsx", "tools/referee-eval/build-en-gb-sets.ts", "--limit", "500"],
            { encoding: "utf8", stdio: "pipe" })).toThrow();
    }, 300_000);
});
