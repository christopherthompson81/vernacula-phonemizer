# C# parity gate — where the wall time goes

The parity gate over all 189 goldens took ~131 s and resisted parallelisation. This is the measurement.

## Run 1 — 2026-09-17 22:30

### The shape of the run, first, because two obvious readings of it are wrong

Per-language timing, instrumented with a Stopwatch in `csharp/tools/parity/Program.cs`:

    total 129.0 s across 189 languages, 5,452 GCs
    nan 20.1 s (2,700 gen0)   hak 5.4 s (697 gen0)   acm 4.0 s   pnb 3.4 s   ary 2.2 s
    top 2 = 20% of the run; the other 187 average ~0.5 s

⚠ **THE FIRST TIMING WAS AN ARTIFACT AND NAMED THE WRONG LANGUAGE.** Timestamping the tool's stdout line
by line from the shell said `my` cost 19.6 s. It costs 1.4 s. C# buffers console output to a pipe, so
every line of a short run carries the timestamp of the final flush; the deltas were measuring the buffer,
not the work. Only in-process instrumentation gave the real distribution.

⚠ AND `en-GB` LOOKED 14× `en` IN THE SAME RUNTIME, which is not true either. The two goldens are the SAME
200 rows and the same 26,734 characters, and the tool walks the directory in ordinal order — so `en-GB`
sorts first and pays the one-time English model and lexicon load (~2.1 s) that `en` then gets warm. The
same ordering effect inverted the TypeScript comparison. Neither number means anything on its own.

### ⚠ NOT the GC, though the counters invite it

`nan` does 2,700 gen0 collections in 20 s — 13.5 per row. Gen2 is ~0, so it is allocation RATE, not
retention. But tuning the collector does essentially nothing:

    baseline 30.0 s   server GC 30.1 s   gen0=256MB 29.4 s   server+gen0 29.2 s   (nan+hak)

The collections are a symptom of an allocating workload, not the cost of it.

### ⚠ NOT the JsRegex cache lock either, though it is a real serialisation hazard

`JsRegex.Compile` takes a process-wide `lock (Gate)` on EVERY call including cache hits, and there are 183
call sites, many inside per-invocation methods (`Sinitic.cs` builds interpolated patterns per call). That
looks like the answer and is not: instrumenting the counter shows only ~3,000 `Compile` calls in the
heaviest three languages combined. Trivial contention, trivial cost.

### THE FINDING: `RegexOptions.Compiled` never pays here

`JsRegex` compiled every pattern with `RegexOptions.Compiled`, which JITs a bespoke matcher per pattern.
That only pays back if the pattern then runs many times, and this fleet's patterns do not — 2,357 distinct
patterns across 189 languages, most touched a handful of times per process.

    parity, all 189, single-threaded:   131.0 s → 81.5 s     (−38%, one line)

⚠ AND THERE IS NO STEADY-STATE CASE TO PRESERVE, which is why this is a deletion and not a lazy promotion
of hot patterns. Even on the heaviest single languages the JIT still loses:

    nan   24.6 s → 23.8 s        hak   11.5 s → 9.9 s        en-GB   4.8 s → 3.8 s

Output is unchanged: 189/189 goldens byte-identical, and regex-diff's 143,678 probes still agree with V8.

### Why parallelising it did not get wall time down

    1 process,  all 189                       81.5 s   (user 300 s)
    6 processes, disjoint slices, SERIAL      119.0 s  (user 382 s)   ← the same work
    6 processes, disjoint slices, CONCURRENT   67.6 s  (user 652 s)
    12 processes, concurrent                   72.4 s  (user 789 s)   ← worse

⚠ **SPLITTING THE WORK COSTS 37 s BEFORE CONCURRENCY CAN WIN ANYTHING.** The same 189 languages split into
6 processes and run one after another take 119 s against 81.5 s in one process. The run is dominated by
per-process and per-language FIXED setup — assembly JIT, data files, model init, and the English lexicon
that many slices each need — and splitting duplicates that instead of dividing it. Running the slices
concurrently then spends ~9.6 cores to claw back to 67.6 s, a 1.2× return on 6× the processes; at 12 it
goes backwards. Bare process startup is 2.7 s, so the duplication is mostly re-initialisation, not exec.

⚠ AND IN-PROCESS PARALLELISM IS BLOCKED BY CORRECTNESS, NOT ONLY BY THROUGHPUT. Three pieces of
process-wide mutable state are reset INSIDE the loop, by design and with comments saying why:
`Registry.ClearPortPending()` per ROW (without it the first Hebrew row poisons every later row's verdict),
`Foreign.ClearForeignOov()` per LANGUAGE (the memo is global, and the goldens are generated
per-language-isolated), and the `JsRegex` cache lock. A `Parallel.ForEach` over languages would not merely
fail to scale — it would corrupt the blocked-row accounting the gate exists to report.

### What is left, if more is wanted

`nan` alone is 20 s of the remaining 82 s, and it is 3× its TypeScript twin (23.0 s against 7.4 s, both
warm) while `en` is 3.5× FASTER in C# than in TypeScript (159 ms against 568 ms cold / ~143 ms warm). So
the gap is specific to the Sinitic path, not to the port in general. Not chased here.

### Unrelated, but found on the way

`dotnet test csharp` fails 10 cases in 8 test methods **on main** — `MaxExpandsToMaximum`,
`RevIsARevisionBeforeADesignatorAndAReverendBeforeAName`, `AClauseInitialCoordinatorTakesItsStrongForm`,
`TheReducedPrefixAndTheProductiveOne`, `AnOnsetRSurvivesTheReducedVowel`, two
`EnglishSpellingVariantsTests`, and `LanguageBootstrapTests.PortedEnginesAnswer`. Pre-existing and not
touched here; recorded because the suite is not green and a reader will otherwise assume it was.

## Run 2 — 2026-09-18 — the threading refactor, tested and NOT taken

Run 1 concluded that splitting into processes costs 37 s of duplicated setup before concurrency can win
anything, and that threads would collect it because setup is paid once. That reasoning was incomplete, and
this run measures it properly: a standalone benchmark against the same 36,495 golden rows, with the
bootstrap warmed OUTSIDE the timed region, so per-process setup is not in the number at all.

    threads=1   work 76.7 s
    threads=4   work 54.3 s   1.41×
    threads=8   work 67.1 s   WORSE than 4
    threads=16  work 83.1 s   WORSE than serial

⚠ **THREADS DO NOT SCALE EITHER, AND SETUP WAS NEVER THE WHOLE STORY.** Warm-up is 1.1 s here and outside
the measurement, so whatever limits this is inside the work.

### Five hypotheses, four of them wrong

Each was tested rather than argued, and the first four changed nothing measurable:

  * **ORT / OMP intra-op threads oversubscribing.** `OMP_NUM_THREADS=1 ORT_NUM_THREADS=1`: 76.9 / 53.0 /
    64.5 / 81.4 — identical curve.
  * **Load imbalance** — `nan` alone is ~20 s of the 77 s, so one thread could hold the wall time hostage.
    Re-partitioned at the ROW level (36,495 items, perfect distribution): 75.3 / 48.1 / 56.0 / 78.4. Same
    shape. Not imbalance.
  * **The `JsRegex.Compile` global lock**, taken on every call including cache hits. ⚠ MY RUN-1 COUNT WAS
    3,000 AND IT WAS MEASURED OVER THREE LANGUAGES; the fleet figure is **110,751**. Replaced with a
    lock-free `ConcurrentDictionary` anyway: 75.4 / 47.6 / 55.5 / 81.5. Not the lock.
  * **.NET `Regex` runner contention** — a `Regex` caches one runner per instance, and every thread shares
    the same cached `JsRe` objects, so losers allocate (gen1 collections do jump 212 → ~650 under threads).
    Gave each thread its own regex cache: 74.8 / 47.6 / 57.2 / 82.4. Not that either.

### ⚠ IT IS ONNX RUNTIME, AND THE MACHINE

Moving all 17 `.onnx` files aside — the documented degraded path, where `createEnglishTagger()` returns
undefined and the engines fall back to their rule/lexicon tiers — changes the SHAPE of the curve:

                    with ONNX          without ONNX
    threads=1        75.3 s             72.9 s
    threads=4        48.1 s  1.57×      38.8 s  1.88×
    threads=8        56.0 s  worse      36.8 s  1.98×   ← still scaling
    threads=16       78.4 s  worse      42.7 s

With ONNX the curve peaks at 4 and degrades hard; without it, it keeps scaling to 8 and only degrades at
16. Shared `InferenceSession` use is a serialisation point that outer threads cannot get past — and the
English tagger is reached from EVERY language carrying a Latin run, through the foreign-OOV prewarm, so it
is not confined to the 12 languages that own a model.

⚠ AND EVEN WITHOUT ONNX THE CEILING IS ~2×, on a box whose "16 CPUs" are **8 physical cores with 2 threads
each** (i7-10700K). Scaling to 8 and degrading at 16 is exactly hyperthreads thrashing a shared L3 on a
workload that walks large lexicons. The remaining gap to 8× is memory-bound, not lock-bound.

### Not taken, and why

The best case is the real gate going ~82 s → ~50 s, and buying it costs:

  * `Foreign.foreignOov` becoming per-thread — ⚠ WHICH ITS OWN COMMENT ARGUES AGAINST IN THOSE WORDS:
    "UNLIKE THE HOST STACK THIS ONE MUST STAY SHARED. The memo is deliberately process-wide — a warm cache
    across languages — so per-thread storage would be the wrong fix." Overturning that for a dev tool's
    wall clock is the wrong trade.
  * `Registry.PortPending` becoming per-thread, and the gate's blocked-vs-wrong accounting — the thing it
    exists to report — being restructured around it.
  * A `--threads` knob that makes the gate SLOWER than serial at its most obvious setting (16 on a
    "16-CPU" box), which is a footgun pointed at the next person.

1.6× on a gate that already went 131 s → 82 s for one line in Run 1 is not worth that. Recorded so the next
person does not re-derive the four dead ends; the ONNX finding is the one worth keeping, because it says
something about the ENGINE (a shared session serialises concurrent callers) rather than about this tool.
