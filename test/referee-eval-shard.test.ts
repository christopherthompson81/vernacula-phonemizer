/**
 * `--jobs N` MUST NOT CHANGE THE ANSWER.
 *
 * ⚠ The referee eval is the instrument every English floor is set against, so sharding it across processes is
 * only acceptable if the merged result is EXACTLY the one the unsharded run would have produced. This
 * compares the whole reported result, not a few counters, because both bugs the change actually had were
 * invisible in the headline numbers:
 *   • the product-delta sampler keyed on a PER-SHARD counter, so N shards sampled N different row sets.
 *     ⚠ COMPARING THE MERGED RESULT DOES NOT CATCH THIS, which was verified by reintroducing the bug: on
 *     `kk` the delta is 0/280 and `pCompared` sums to 280 either way, so every reported field matches while
 *     the rows behind them differ. The `pIdxSum` test below exists for exactly that gap.
 *   • the residual histogram broke ties by INSERTION order, so the listed 1× examples moved with the job
 *     count while every number matched. `kk` is 193 residual classes and all 193 are ties, so any
 *     order-dependence in the SORT shows up immediately.
 *   • the merge picked each class's example from the first SHARD holding that class, where the unsharded
 *     run picks the first ROW. Those differ whenever a class's earliest row is not in shard 0.
 *     ⚠ `kk` CANNOT SEE THIS — every one of its 193 classes has count 1, so there is only ever one row to
 *     choose from and the two rules agree by accident. `vi` is the fixture that can: 278 of its 783 classes
 *     have count > 1 over only 5,453 rows, and against the old merge it diverged on 129–166 entries.
 */
import { describe, expect, test } from "vitest";
import { evaluate, mergeShards, type RefereeResult } from "../tools/referee-eval/eval.ts";

/** The reported surface — everything except the raw sums carried only to make the merge possible. */
const reported = (r: RefereeResult): Omit<RefereeResult, "acc"> => {
    const { acc: _acc, ...rest } = r;
    return rest;
};

describe("sharded referee evaluation", () => {
    for (const n of [2, 4, 7]) {
        test(`${n} shards merge to exactly the unsharded result`, async () => {
            const whole = await evaluate("kk", true, 0, true);
            const parts = await Promise.all(
                Array.from({ length: n }, (_, i) => evaluate("kk", true, 0, true, { i, n })),
            );
            const merged = mergeShards(parts);
            expect(merged.map(reported)).toEqual(whole.map(reported));
        });
    }

    // ⚠ THE MERGED-RESULT COMPARISON ABOVE CANNOT SEE THE SAMPLER BUG ON ITS OWN, and that was verified by
    // reintroducing it: `kk`'s product delta is 0/280, so two different row sets give identical counts and
    // all four tests still passed. `pIdxSum` is the row IDENTITIES, which is the only thing that differs.
    test("the product delta samples the same ROWS however it is sharded", async () => {
        const whole = (await evaluate("kk", true, 0, true))[0]!;
        for (const n of [2, 4, 7]) {
            const parts = await Promise.all(
                Array.from({ length: n }, (_, i) => evaluate("kk", true, 0, true, { i, n })),
            );
            expect(parts.reduce((t, p) => t + p[0]!.acc.pIdxSum, 0)).toBe(whole.acc.pIdxSum);
        }
    });

    // ⚠ A SEPARATE FIXTURE, because kk's classes are all singletons and cannot witness this at all.
    for (const n of [3, 4, 7]) {
        test(`${n} shards pick each residual example from the same ROW as the unsharded run`, async () => {
            const whole = (await evaluate("vi", true, 0, true))[0]!;
            const parts = await Promise.all(
                Array.from({ length: n }, (_, i) => evaluate("vi", true, 0, true, { i, n })),
            );
            const merged = mergeShards(parts)[0]!;
            expect(merged.residual).toEqual(whole.residual);
        });
    }

    test("the vi fixture is dense in REPEATED classes, or the example rule is untested", async () => {
        const whole = (await evaluate("vi", true, 0, true))[0]!;
        expect(whole.residual.filter((r) => r.count > 1).length).toBeGreaterThan(100);
    });

    test("the fixture actually exercises both hazards", async () => {
        const whole = (await evaluate("kk", true, 0, true))[0]!;
        // the product delta must STRIDE, or the sampler bug has nothing to get wrong
        expect(whole.acc.pCompared).toBeGreaterThan(0);
        expect(whole.acc.pCompared).toBeLessThan(whole.acc.total);
        // and the residual must be dense in TIES, or the sort bug has nothing to get wrong
        const counts = Object.values(whole.acc.diffClass);
        expect(counts.filter((v) => v === 1).length).toBeGreaterThan(50);
    });
});
