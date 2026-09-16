# Test wall time — where it goes, and the bug that fell out

## Run 1 — 2026-09-16 18:00 — loading, not running

    vitest run    wall 103s   collect 816s   tests 444s   CPU 18m53s   (16 cores)

**COLLECT WAS BIGGER THAN TESTS.** Vitest isolates by default, so each of 300 test files gets a
fresh module registry and re-imports and re-parses the engine. Measured directly:

| per worker | |
|---|---|
| import graph (tsx over ~700 TS files) | 833 ms |
| first English phonemize (the 14.5 MB data parse) | 354 ms |
| every call after | 0.9 ms |

`isolate: false` shares one registry per worker:

| | wall | collect | tests | CPU |
|---|---|---|---|---|
| isolate (default) | 103s | 816s | 444s | 18m53s |
| **isolate: false** | **75s** | **104s** | 400s | **8m28s** |

Collect falls 87%. `pool: "threads"` was tried and is SLOWER (116s) — forks stays.

⚠ **A BINARY DATA FORMAT WOULD NOT HELP.** The obvious next thought is to stop parsing 14.5 MB of
TSV/JSON — but after the config change the data parse is 354 ms × 16 workers ≈ 6s of CPU, under
0.4s of wall, and the import graph is more than twice it. The parse was never the wall; the
REPETITION was, and one line of config removed it.

## Run 2 — 2026-09-16 18:20 — the work is lumpy, not the workers scarce

75s wall against 8m of CPU is 6.9× on 16 cores — 43% utilisation. `--maxWorkers=16` and `=24` both
change nothing (71s, 74s). The cause is file-size skew: vitest schedules whole FILES to workers, so
the slowest file is a floor under the suite no matter how many cores are idle.

    referee-eval    65s        trace    35s    onset-r    33s    latin-tokenizers   27s
    everything else together, without referee-eval: 41s wall

Inside referee-eval, `en` (11.8s) and `en-GB` (16.4s) are 28s of 51s; the other 171 languages are
23s. Both are slow for a good reason — they run their referee through the NEURAL English G2P at
~9ms a word, over a stride sample of 3,000 of en-GB's 76,284 rows.

`--sequence.concurrent` on that file is SLOWER (54s vs 51s, 60% more CPU): the work is CPU-bound, so
in-worker concurrency buys nothing.

So the two English floors moved to `referee-eval-english.test.ts` — same `evaluate` call, same
sample cap, same floors, nothing about what is measured changed. **103s → 62s.**

⚠ **AND THE SAMPLE CAP IS SHARED, NOT DUPLICATED** — caught on review. The split file first carried
the literal `3000` with a comment asking the reader to keep it in step with the other file. That is
not a gate, and the thing it guards is not cosmetic: en-GB's floor of 0.44 is set against the
SAMPLED 45.4%, about 1pp of margin, where the full-referee number is 46.4%. A cap changed in one
file only would move the number the floor was chosen for, and nothing would fail. Both files now
import `capFor` from `test/referee-sample.ts`.

⚠ A guard went with them. Nothing in the repo asserts that every referee'd language HAS a floor
(that was true before the split too), so a later edit could delete the new file and the two
most-exercised languages in the repo would stop being floored with nothing failing. `referee-eval.test.ts`
now reads the split file and asserts both entries are still there; checked by deleting one.

**Stopped here.** The remaining poles (trace 35s, onset-r 33s) are all "run every language through
X" files, splittable the same way, but each fragments a coherent test of one mechanism and
re-introduces the coverage-guard problem. The floor is CPU/cores ≈ 30s.

## Run 3 — 2026-09-16 18:40 — `isolate: false` exposed a real bug, and the grep that missed it

Before shipping, `--sequence.shuffle`. **22 files failed.**

    Error: not prefetched: languages/chhattisgarhi/chhattisgarhi.jsonc
      ❯ Object.read test/browser-seams.test.ts:236

`browser-seams.test.ts` calls `vi.resetModules()` and installs a BROWSER data source backed by a
frozen prefetch map — the entire point of the file. Per-file isolation used to contain it. Without
isolation the next file in that worker inherited a reader that only knew the prefetched keys, so
any other language died.

⚠ **THE SAFETY ARGUMENT IN RUN 1 WAS WRONG.** It grepped for `process.env` writes, assignment to a
settable export, and `vi.mock`/`vi.spyOn`/`stubGlobal`, found none, and called the suite clean.
This file mutates shared state by a fourth route the grep did not name, and **three shuffled runs
passed before one failed** — about one in five, because in file order it lands late and a plain run
never fails at all.

Fixed where the mutation is: an `afterAll(() => vi.resetModules())` in that file, so it puts the
registry back (a fresh import auto-installs the Node reader). Eight shuffled runs clean; five runs
with the cleanup removed put the failure back, 1 in 5.

**`--sequence.shuffle` is the gate for this class and a grep is not.** Recorded in vitest.config.ts
beside the setting that creates the hazard.

## Where it ended

⚠ **AND THE RELATIONSHIP THAT STARTED THIS INVERTED**, which matters for whatever is tried next:

| | collect | tests | |
|---|---|---|---|
| Run 1 baseline | 816s | 444s | collect **1.84×** tests |
| now | **96s** | 390s | collect **0.25×** tests |

Loading is no longer the dominant cost — it is ~20% of the 486s of CPU, and eliminating it
ENTIRELY would save about 6s of the 61s wall. Tests fell too (444s → 390s), because a shared
registry keeps the memoized lexicons and taggers warm across files in a worker, so some of what
Run 1 counted as "tests" was also first-load.

So the loading question is closed, and anything further is scheduling: the wall is set by the
slowest FILE, not by total CPU. Floor is 486s / 16 cores ≈ 30s.

| | before | after |
|---|---|---|
| vitest | 103s | **62s** |
| check:goldens | 55s | 55s (untouched — it deliberately clears the module cache between languages) |
| C# tests | 24s | 24s |
| typecheck / package fence | 6s / 16s | unchanged |

Suite −40%, and one latent order-dependence bug fixed on the way.
