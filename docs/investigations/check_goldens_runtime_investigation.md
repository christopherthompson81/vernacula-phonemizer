# `tools/check-goldens.mts` — where the wall time goes, and what a speedup would cost

The TypeScript golden-freshness gate over all 189 goldens takes ~47.5 s. This is the measurement of why,
and of the one lever that actually moves it. Companion to `csharp_parity_perf_investigation.md`, which
measures the same 36,495 rows through the C# parity tool.

Machine for every run below: Intel i7-10700K, **8 physical cores / 16 threads**, Node v22.12.0,
`onnxruntime-node` 1.27.0. The core count is load-bearing for every conclusion here.

⚠ **THIS RE-OPENS A QUESTION THAT WAS CLOSED WITH "AT THE FLOOR".**
`docs/investigations/en/test_wall_time_investigation.md` Run 5 (2026-09-16) built a `--jobs=N` mode,
measured 12% for double the CPU with one setting slower than serial, and reverted it. That measurement was
right. It also named, in its last paragraph, the one configuration it did not try — "pin ORT to a single
intra-op thread and then shard, so N children × 1 thread matches the 8 physical cores instead of fighting
over them" — and set it aside as needing a thread-count option that "also governs PRODUCTION inference
latency, where the current behaviour is the one you want." That is the configuration measured below. It is
worth 2×, and the production objection dissolves once the knob is opt-in per heap rather than a global
default (`setOrtSessionDefaults`, set by the gate's children and by nothing else).

## Run 1 — 2026-09-18 15:55 — the baseline, and the first surprise

    $ time npx tsx tools/check-goldens.mts
    goldens fresh: 189 languages, 36495 rows, 0 stale
    real 0m47.5s   user 4m14.0s   sys 0m1.2s

⚠ **USER TIME IS 5.3× WALL TIME, SO SOMETHING IS ALREADY PARALLEL.** That is not the script — the script is
a single `for` loop awaiting one row at a time. It is ONNX Runtime's intra-op thread pool, which defaults to
one thread per core. The naive reading of a 47 s single-threaded script ("just run languages in parallel")
is therefore wrong before it starts: the box is already ~5 cores busy.

Per-language cost, instrumented in-process (top of 189):

    nan 7.33 s (36.7 ms/row)   pnb 4.41 s   ary 2.08 s   acm 1.94 s   hak 1.94 s   arz 1.65 s   ur 1.21 s
    top 25 ≈ 33 s; the remaining 164 languages ≈ 14.7 s

Same two languages at the head as the C# run, and the Arabic family behind them. Fixed process startup is
1.25 s (`npx tsx tools/check-goldens.mts <unknown-code>` → exit 2).

## Run 2 — 2026-09-18 16:00 — sharding at DEFAULT thread settings buys almost nothing

Round-robin the 189 codes into N processes, `wait`, take the wall clock:

    shards=4   wall 41.7 s
    shards=8   wall 42.5 s

47.5 → 41.7 s for 8× the processes. ⚠ **THE OBVIOUS FIX IS A DEAD END AS WRITTEN**, because each shard
spawns its own 16-thread ORT pool on an 8-core box: 128 threads fighting over 8 cores. The parallelism has
to be *moved*, not added.

## Run 3 — 2026-09-18 16:10 — capping the ORT pool: the efficiency curve

Wrapped `InferenceSession.create` through `setOrtLoader` to force `intraOpNumThreads: N`,
`interOpNumThreads: 1`, `executionMode: "sequential"`, serial over all 189 languages:

    ORT threads   wall     user     CPU-seconds spent
    1             83.5 s    93.4 s   ← the real total work
    2             59.8 s   109.4 s
    4             49.7 s   151.7 s
    16 (default)  47.5 s   254.0 s

⚠ The ORT pool is real work, not spin-waiting — 1 thread is genuinely 1.8× slower in wall time. But its
**scaling efficiency is terrible**: going from 1 to 16 threads spends 2.7× the CPU to save 43% of the wall.
That inefficiency is the headroom. The whole gate is only **93 CPU-seconds** of work; the default
configuration burns 254 to finish in 47.5 s.

⚠ AND THE OUTPUT DID NOT MOVE: all three capped runs reported `0 stale`. Thread count is not a source of
the argmax drift the header comment documents for cross-microarchitecture runs — at least not on this CPU.
That is a necessary precondition for any sharded mode; it is not proof for other hardware.

## Run 4 — 2026-09-18 16:15 — row-level concurrency inside one process does NOTHING

Replaced the per-row `await` with a K-way worker pool over the rows of each language (memo clear still per
language):

    conc=2  wall 47.1 s   conc=4  wall 47.0 s   conc=8  wall 46.5 s   (mismatch=0 in all three)

⚠ **NEGATIVE RESULT, AND THE REASON IS IN THE VENDOR CODE.** `onnxruntime-node`'s
`OnnxruntimeSessionHandler.run` (node_modules/onnxruntime-node/dist/backend.js:113) is a `setImmediate`
wrapped around a **synchronous** native `run()`. `phonemizeAsync` is async in signature only where ONNX is
concerned: the inference blocks the JS thread. There is nothing to overlap. Anything that wants two
inferences in flight needs two *heaps*, i.e. processes or worker threads.

(The run does confirm concurrency is semantically safe — 0 mismatches — so the finding is "no gain", not
"unsafe".)

## Run 5 — 2026-09-18 16:25 — sharding with the pool capped: 2× and then a wall

LPT bin-packing of the 189 codes by measured single-thread cost, one process per bin, `ORT_THREADS=1`:

    shards=4  ort=1   wall 29.1 s
    shards=6  ort=1   wall 23.6 s
    shards=8  ort=1   wall 23.8 s     ← best
    shards=10 ort=1   wall 25.0 s
    shards=12 ort=1   wall 26.6 s
    shards=16 ort=1   wall 29.2 s
    shards=6  ort=2   wall 23.1 s
    shards=8  ort=2   wall 24.4 s

**47.5 s → ~23 s, a 2.05× speedup**, flat across 6–8 shards and degrading past that. Same `0 stale`.

⚠ **THE PLATEAU IS THE PHYSICAL CORE COUNT, NOT A BUG IN THE PACKING.** 93 CPU-seconds over 8 physical
cores is an 11.6 s floor; SMT threads 9–16 add contention rather than throughput. Two further taxes sit on
top of that floor:

  · **per-process init ~2.7 s.** The best 6-way bin, run *alone*: 15.6 s wall for 12.9 s of measured
    phonemize time. Every shard re-pays module compilation, the data-table loads, and the neural-liveness
    probe. It is not amortisable across shards — each heap loads its own copy.
  · **memory/cache contention ~50%.** That same bin costs 15.6 s alone and ~23.6 s with five siblings
    running. The English lexicon and n-gram tables are resident in all 8 heaps at once.

The single longest language sets a hard floor too: `pnb` alone is 10.6 s at one thread, so no packing of
whole languages beats ~13 s however many cores are thrown at it. Splitting *within* a language would break
the per-language `clearForeignOov()` contract that the script's header documents as load-bearing.

## Run 6 — 2026-09-18 16:18 — where the main-thread time actually goes

`npx tsx --cpu-prof` over the full fleet, self time on the main thread (48.4 s sampled):

    17.02 s   onnxruntime-node/dist/backend.js:114      ← the SYNCHRONOUS native run(), see Run 4
     6.32 s   ngramDecode        src/languages/english/englishG2p.ts
     3.18 s   (garbage collector)
     2.64 s   rewrite            src/core/provenance.ts
     2.23 s   scoreTokAt         src/languages/english/englishG2p.ts
     0.91 s   decomposeInner     src/languages/english/englishG2p.ts
     0.84 s   loadTsvMap         src/core/loadTsv.ts

Two things worth naming:

  · **The English OOV n-gram decoder is ~9.5 s (20%) of main-thread time, fleet-wide** — and it is why
    `nan` and `pnb` head the list. Neither is an English golden; both carry embedded Latin runs that the
    engine hands to the English neural/n-gram reader, exactly as the `--no-ort` note in the script header
    describes for the delegation route. `nan` is 36.7 ms/row on 200 rows.
  · **`provenance.rewrite` is 2.6 s (5%)** and is bookkeeping, not phonemization. Unmeasured whether the
    gate needs it at all.

## Run 7 — 2026-09-18 16:55 — shipped as `--jobs N`, and what it had to refuse

`src/core/onnx.ts` gains `setOrtSessionDefaults(options)`, merged into every `InferenceSession.create`.
It is the only way to cap the pool from the tool: `test/onnx-optional.test.ts` pins `core/onnx.ts` as the
SOLE importer of `onnxruntime-node`, so a tool reaching for the package directly is a test failure, and
correctly so — that single indirection is what keeps the optional dependency optional. It wraps the
resolved runtime **only when defaults are set**, because `test/browser-seams.test.ts` pins that `loadOrt()`
resolves to the very object `setOrtLoader` installed.

`tools/check-goldens.mts` gains `--jobs N`: N long-lived children, each with `--cap-ort`, fed the next
language as it finishes the last.

  · **Work-stealing, not a static split.** LPT packing (Run 5) needs a cost table, and a committed cost
    table going stale inside the tool that exists to complain about a committed artifact going stale is a
    joke with a punchline nobody would enjoy. Handing out the next code on completion needs no table.
    Largest golden first is the one scheduling heuristic, and it is free.
  · **The child protocol became a stream** — a code per line in, a `Result` per line out. `--isolate`'s
    one-code-on-argv child would re-pay the module graph and the model loads 189 times, which is why
    `--isolate` is ~10× slower than serial and would have eaten the whole win. `--isolate` now writes one
    line and closes the pipe; one protocol, two modes.
  · **Every capped worker re-runs the neural-liveness assert.** The parent's proof covers the DEFAULT
    configuration. If the cap ever broke session creation, `loadOrt` would reject, every neural path would
    fall back silently, and the fleet would read stale — this file's oldest failure arriving by a new
    route. The `--jobs` parent skips its own assert instead: it renders no rows, and N workers proving
    their own heaps is strictly stronger.

Refused rather than documented:

  · **`--jobs` + `--write`.** Writing is the dangerous operation; doing it from a differently-configured
    engine is the fleet-scale version of #1283.
  · **`--jobs` + `--isolate`.** Opposite answers to the same question — one proves a mismatch belongs to
    its row, the other shares a heap between languages.
  · **`--jobs` + `--no-clear`, which is the one that had to be MEASURED to be believed.** `--no-clear`
    asks what each language inherits from the one before it, so its answer is a property of the sequence.
    Split the sequence and most languages no longer follow the language that poisoned them:

        npx tsx tools/check-goldens.mts --no-clear mi vi nan hak hmn sat
          → hmn  53 rows  1 stale   "1 of 6 languages moved"
        npx tsx tools/check-goldens.mts --jobs 4 --no-clear mi vi nan hak hmn sat
          → "no language moved — nothing here depends on what this flag disables"

    ⚠ The pooled run answers "the memo clear is not load-bearing", which is false, and is the strongest
    possible wrong answer to the only question that flag asks. Refused.
  · **`--no-ort` is NOT refused**, because it was checked and has no such interaction: it degrades each row
    on its own terms, and serial and pooled runs agree language for language, row count for row count,
    over a 9-language sample spanning all three ONNX routes (`en fa ar km bn nan pnb ru ja`).

Verification, full fleet, same tree:

    jobs=1    wall 45.8 s   user 249 s    189 languages, 36495 rows, 0 stale
    jobs=6    wall 22.8 s   user 152 s    189 languages, 36495 rows, 0 stale   ← 2.01×
    jobs=8    wall 23.9 s   user 185 s    189 languages, 36495 rows, 0 stale
    jobs=12   wall 26.7 s   user 261 s    189 languages, 36495 rows, 0 stale

Identical verdict at every setting. `npm test` 315 files / 6,045 tests green, `tsc --noEmit` clean,
`check:package` clean.

⚠ **THE DEFAULT IS STILL SERIAL, DELIBERATELY.** `npm run check:goldens` is unchanged and no second npm
script was added. The gate's value is that it is trusted, and `--jobs` is a configuration whose output was
proven equal on ONE CPU — the same class of claim the header refuses to make for ONNX across
microarchitectures. So the flag is opt-in, the header says that if a `--jobs` run and a serial run ever
disagree the serial run defines the goldens, and `--write` cannot be reached from it at all.

## Where this leaves it

  1. **Done: `--jobs N`, 47.5 s → ~23 s.** Best at 6–8 workers on 8 physical cores.
  2. Past ~23 s the money is in `ngramDecode`, not in scheduling. 8 physical cores and 93 CPU-seconds are
     the arithmetic; the only way under it is to do less work. The English OOV n-gram decoder is 20% of
     main-thread time fleet-wide and `provenance.rewrite` another 5%, and the gate may not need the latter
     at all.
  3. ⚠ Do NOT reach for in-process async concurrency (Run 4) or for uncapped sharding (Run 2). Both look
     obviously right and both measured flat.
