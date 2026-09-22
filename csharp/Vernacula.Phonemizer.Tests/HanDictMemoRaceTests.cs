/**
 * The greedy-window memo must not throw under contention (#1442).
 *
 * ⚠ THE DEFECT WAS A THROW FROM SHIPPED CODE, not a lost cache entry. `MaxWordFor` was a check-then-act
 * memo — `TryGetValue`, compute, `Add` — and `ConditionalWeakTable.Add` is documented to throw on a
 * duplicate key. Two threads both miss, both compute, and the second raises
 * `ArgumentException: An item with the same key has already been added`, out of `Phonemize()`.
 *
 * ⚠ IT IS REACHABLE ON THE FIRST CONCURRENT CALL, which is the production shape rather than an exotic
 * one: a cold memo means every thread misses at once. Measured before the fix, 32 threads against a
 * fresh engine — 16 threw on the first attempt.
 *
 * ⚠ AND IT IS PORT-INTRODUCED. The TypeScript memoises with a `WeakMap`; JS is single-threaded, so the
 * hazard exists only here. `Hakka/Pfs.cs` already used the `GetValue` form — this was the only site
 * that did not.
 *
 * ⚠ THE TEST GOES THROUGH THE INTERNAL ENTRY ON PURPOSE. Through `Phonemize()` the memo can be cold
 * only ONCE per process, so the assertion would pass trivially whenever another test had run first —
 * it would pin nothing. A fresh dictionary per iteration makes the cold memo repeatable.
 */
using Vernacula.Phonemizer.Core;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class HanDictMemoRaceTests
{
    [Fact]
    public void TheGreedyWindowMemoSurvivesConcurrentFirstUse()
    {
        for (var round = 0; round < 24; round++)
        {
            // A FRESH dictionary each round, so the memo is cold and every thread misses at once.
            var dict = new Dictionary<string, string>(StringComparer.Ordinal);
            for (var i = 0; i < 64; i++) dict[new string('一', (i % 5) + 1) + i] = "x";

            var thrown = new List<Exception>();
            var seen = new System.Collections.Concurrent.ConcurrentBag<int>();
            Parallel.For(0, 32, _ =>
            {
                try { seen.Add(HanDictIpa.MaxWordFor(dict)); }
                catch (Exception e) { lock (thrown) thrown.Add(e); }
            });

            Assert.Empty(thrown);
            // ⚠ AND EVERY THREAD MUST AGREE. The factory may run more than once under contention, which
            // is harmless only because the value is a pure function of the dictionary and one result is
            // published — this is what says so rather than assuming it.
            Assert.Single(seen.Distinct());
            // ⚠ DERIVED, NOT TYPED. A hand-written expectation here was wrong first time — the numeric
            // suffix on each key adds characters — and `EnumerateRunes` counts the same property the
            // implementation does without calling it.
            Assert.Equal(dict.Keys.Max(k => k.EnumerateRunes().Count()), seen.First());
        }
    }
}
