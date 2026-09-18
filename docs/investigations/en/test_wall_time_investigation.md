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

## Run 4 — 2026-09-16 18:45 — the tests themselves: at the floor, and one trap

After #1320 the suite is 59s with ~486s of CPU. The question left was whether the 390s of TEST time
(as opposed to loading, now 96s) has anything in it.

### The machine is 8 cores, not 16

    workers=6   62.7s      workers=10  56.7s
    workers=8   63.9s      workers=16  55.9s

2.7× the workers buys 11%. `lscpu`: **i7-10700K, 8 cores / 16 threads**. Hyperthreading is worth
almost nothing for this work, so the floor is 486s ÷ 8 ≈ **61s**, not the 30s an earlier run in this
doc claimed by dividing by the thread count. **We are at it.**

Sampling worker CPU during a run agrees: 12–14 busy until t≈36s, then 6 for the last 20s.

### The scheduler is doing its job

Vitest 2.x sorts files by CACHED DURATION descending when `node_modules/.vite/vitest/results.json`
exists, and it does — the cached numbers track the reporter's within noise (referee-eval-english
43s cached / 38s measured). Shuffled runs came out ~7s faster on average, but across interleaved
samples the two overlap (default 62–66s, shuffled 55–62s); that is scheduling noise on a saturated
box, not a better order.

### What redundancy there is, and why it was not taken

| | saving | wall |
|---|---|---|
| `onset-r` computes the PARENT reading twice — once per `test.each` language, though it is language-independent | ~9s CPU | ~1s |
| `trace` re-traces the same corpus in 10 tests (sample sizes 12,4,4,6,4,2,6,6,4 — 48 passes per language where 12 would do) | ~20s CPU | ~2s |

Both are real and neither loses coverage, but together they are 6% of CPU on a box that is CPU-bound,
and the second one edits ten tests. Recorded rather than done.

Everything else is genuinely necessary: `onset-r` audits all 117,479 dict words (its header explains
that the full corpus is what makes it an audit rather than a spot check), `referee-eval` covers 171
languages, `latin-tokenizers` every registered code. **The cost is the coverage.**

### ⚠ The one big lever is a trap, and it looks like a 4× win

`englishTagger.tag()` runs ONE ONNX inference per word, shape `[1, T]` — 6,000 of them in
referee-eval-english, the slowest file. The export has a dynamic batch dimension and accepts `[B, T]`,
and batching equal-length words (so there is no padding for the BiLSTM's backward pass to eat) is
**4.2× faster** at B=64.

It is also not output-preserving:

    batch [A, A]  row 0 vs solo(A)   0.00e+0      exact
    batch [A, A]  row 1 vs solo(A)   0.00e+0      exact
    batch [A, B]  row 0 vs solo(A)   1.11e-1

⚠ **THE MODEL IS DYNAMICALLY QUANTIZED int8**, so activation scales are computed at runtime over the
whole tensor — a row's logits depend on its batch NEIGHBOURS. Identical rows agree exactly, which is
what proves the indexing is right and the effect is the quantizer. Batching would make a word's
reading depend on which other words happened to be grouped with it. For a phonemizer that is not a
speed/accuracy trade, it is non-determinism.

Available only with a statically-quantized or fp32 re-export, and then it would want measuring
again — the 4.2× is an int8 number.

⚠ **AND THE FIRST MEASUREMENT OF IT SAID 0.1× — batching TEN TIMES SLOWER.** That was the harness:
`Array.from(d)` inside the per-row loop copied the whole batch output once per row, O(B²). The
lesson from Run 3 repeating itself — the number that looks impossible usually is.

## Run 5 — 2026-09-16 19:10 — the cross-implementation gate: already parallel, and sharding it loses

`check:goldens` (48–55s) is the TS half of the C#/TS parity gate — 189 languages, 36,495 rows
through `phonemizeAsync`, compared against `csharp/goldens/*.tsv`; the C# suite reads the same files
for its half. Run 1 left it alone on the strength of a comment. This measured it.

### It is already 5.4× parallel, and nothing in the tool does that

| | wall | CPU | parallelism |
|---|---|---|---|
| serial, as shipped | 48.3s | 261s | **5.4×** |
| serial, `--no-ort` | 31.4s | 38.5s | 1.2× |

⚠ **THE PARALLELISM IS ONNX RUNTIME'S OWN THREAD POOL**, not the tool's — the loop at the bottom of
`check-goldens.mts` is a plain `for`. Disabling ORT drops CPU from 261s to 38s and wall from 48s to
31s, which splits the gate cleanly: ~31s of single-threaded engine work, and ~17s of neural work that
already spreads across ~5 cores by itself.

### So process sharding was built, measured, and thrown away

The only state crossing languages is the foreign-OOV memo, which `checkOne` already clears per
language — that clear is what makes an in-process run equal to one-child-per-language. If in-process
ORDER does not matter then neither does which PROCESS, so the languages can be partitioned freely.
A `--jobs=N` mode was implemented on that reasoning (strided, not chunked, because `en`/`en-GB` carry
the neural cost), and it produces the identical verdict — 189 languages, 36,495 rows, 0 stale.

    serial   48.3s / 261s CPU        jobs=3   45.2s / 497s
    jobs=2   41.9s / 351s            jobs=4   46.5s / 504s
    jobs=8   42.7s / 570s            jobs=6   51.0s / 608s   ← SLOWER than serial

Best case 12% of wall for 1.3–2.2× the CPU, no monotonic trend, and one setting that loses outright.
On a box whose cores are already saturated by ORT's threads, extra processes mostly oversubscribe —
and each child re-pays the fixed setup, which is where the doubled CPU goes.

**Reverted.** A second mode of a gate whose whole job is to be trusted is not worth 6 seconds.

The one configuration that might genuinely pay — pin ORT to a single intra-op thread and then shard,
so N children × 1 thread matches the 8 physical cores instead of fighting over them — needs a
thread-count option threaded through `Onnx.CreateInferenceSession`, and that setting also governs
PRODUCTION inference latency, where the current behaviour is the one you want. Not worth it for a
~13s gate.

⚠ **SUPERSEDED, 2026-09-18 — THAT LAST PARAGRAPH WAS THE ANSWER AND IT WAS WORTH IT.** Capping the pool
and then sharding is 47.5s → 22.8s on this box, a clean 2.0×, with an identical verdict at every worker
count. The production objection was real and dissolves once the knob is per-heap and opt-in
(`setOrtSessionDefaults`, set by the gate's own children and by nothing else) rather than a global
default. Shipped as `check-goldens.mts --jobs N`; the default stays serial. The measurement, including why
`--jobs` refuses `--no-clear` and why in-process row concurrency buys exactly nothing, is in
`docs/investigations/check_goldens_runtime_investigation.md`. "At the floor" in the table below is
therefore no longer true of the gate, only of its serial mode.

### Where the gate set stands

    vitest        59s       (was 103s, #1320)
    check:goldens 48s       already ~5.4× parallel; at the floor
    C# tests      24s
    package fence 16s
    typecheck      6s

Sequentially 153s. The gates are independent of one another, so the largest remaining win is not
inside any of them — it is running them concurrently, which is a change to how `npm run ci` reports
failures rather than to how fast anything computes.

### ⚠ Correction to that table — it is missing a gate, and that omission has now cost something

The list above is "the gates", and it is the set `npm run ci` runs. **`csharp/tools/parity` is not
in it and is not in `dotnet test` either** — it is a standalone program, run by hand, that replays
every golden through the C# engine and diffs. 2m10s, and the only thing anywhere that compares the
two implementations *fleet-wide in the direction that matters*:

| | direction | in an automatic gate? |
|---|---|---|
| `check:goldens` | TS engine → `csharp/goldens/*.tsv` | yes, `npm run ci` |
| `dotnet test` | 6,687 hand-written C# assertions | yes |
| `csharp/tools/parity` | **C# engine → the same goldens** | **no** |

So the TS side is pinned to the goldens and the C# side is pinned to whatever a human remembered to
assert. #1319 shipped a TS-only change with every gate green; the C# port read `innocent` as
*inasn̩t* across 56 pcm rows, and #1319's bulk expectation re-record wrote the leaked value INTO a
C# test, so the divergence was recorded twice and caught by neither. Found by running the standalone
program on a hunch while timing it for this document.

Relevant here because the honest cost of closing it is a wall-time number: 2m10s, roughly 1.4× the
whole 153s gate set. That is why it belongs in CI rather than in the local loop — the local loop is
what this investigation has been shortening, and this is the one thing worth NOT putting in it.
