# Min Nan in C#: why the golden run took 27 s

Question: after #1620, `nan` was the floor of the C# parity run, at about 23 s of per-row work and 3× its TS twin
(`docs/investigations/csharp_parity_perf_investigation.md`, Runs 1 and 3). Where does the time go?

Instrument: `dotnet csharp/tools/parity/bin/Release/net10.0/parity.dll nan` (200 rows), timed with
`/usr/bin/time`, and profiled with `dotnet-trace collect --format Speedscope`. A scratch script credits the trace's
synthetic `CPU_TIME` leaf to the real frame under it and sums inclusive time per frame.

## Run 1 — 2026-10-16 10:25

**Baseline.** C#: 26.7 s wall. TS: `tools/check-goldens.mts nan`, 12.7 s.

**Profile:** 22.85 s of the 25 s inside `PhonemizeAsync` is `EnglishG2pImpl.NgramDecode`, reached through
`MinNanPhonemizer.Engine.Text` → `Registry.ReadAsEnglish`. Min Nan text carries Latin names (*Ukraina*, *Lietuva*,
*Khorasan*), which the English reader decodes as out-of-vocabulary words. The self time lands in
`Thread.PollGC`, a sign of an allocation-bound loop.

**The code:**
- `ScoreTokAt` scanned each context's stored `[token, count]` pairs as `JsonElement`s and called `GetString()` (a
  fresh string) on every one until a match. The empty context holds 984 pairs.
- TS does the same linear `find`, but over native strings, which cost no allocation.
- Rust interns the tokens and hashes each context's counts, which is why Rust never had this.

## Run 2 — 2026-10-16 10:30

**Fix 1: each context's candidates become a `Dictionary<string, double>`.** The first occurrence of a token wins,
as `find` does.
- Built eagerly in the constructor: 26.7 → 10.1 s, 200/200 rows. But `CreateEnglish` went from 2.4 s to 4.6 s,
  a load cost every English caller would pay for 61,846 tables, of which a run touches a small fraction.
- **Built lazily per context instead**, in a `ConcurrentDictionary` with `GetOrAdd`.

**Fix 2: the beam state.** Every candidate chunk at every letter copied the hypothesis's whole history list and
whole phone list, which makes the decoder quadratic in word length.
- The history now keeps only the last `Order − 1` tokens, all the scorer ever reads.
- The phones are a chain back to the start, materialised once at the end.
- Result: 7.9–8.8 s.

## Run 3 — 2026-10-16 10:35

**What reaches the decoder.** I patched the TS `ngramDecode` temporarily to log its input (restored afterwards):
604 calls, 496 distinct words, 2–16 letters, mostly 5–9. The most repeated were *ukraina* ×24, *selo* ×15 and
*lietuva* ×12. So it's about 5 ms per word of plain work: 12 hypotheses × ~30 chunks × letters, each rebuilding up to
4 context strings.

**Fix 3: resolve the contexts once per hypothesis, not once per candidate chunk.** They depend only on the history.
Each letter's joint tokens and phone pieces are also built once per letter. Result: **5.1 s.**

**Fix 4: build only the beam survivors.** Scoring happens first, and a hypothesis object is built only for the
top 12, after the same stable sort, so ties break identically. 4.9–5.2 s, which is within noise, but it's harmless.

What's left: `NgramDecode` is no longer near the top of the profile. `CreateEnglish` (2.4 s, almost 1 s of it
`LoadJson` of `g2p-model.json`) is shared by every language with English runs.

## Result

- **`nan`:** 26.7 s → about 5 s, 200/200 rows.
- **Full C# parity:** 189/189 byte-identical, all 36,495 rows.

| run | before (#1620) | after |
|---|---|---|
| serial | 107.5 s / 192 CPU-s | 71.4 s / 151 CPU-s |
| `--jobs 4` | 48.9 s | 41.6 s / 175 CPU-s |
| `--jobs 8` | 45.6 s | **29.7 s** / 230 CPU-s |

With `nan` no longer the floor, 8 jobs now beat 4 clearly. The machine's load average was about 9–10 during
the 8-job run, so treat that time as rough.

## Run 4 — 2026-10-16 11:10 — the same fix in TypeScript

TS had the same shape: a linear `e.c.find` per context, context strings rebuilt per candidate chunk, and the history
and phone arrays copied into every candidate. I applied the same four changes:
- a lazy per-context `Map`, first occurrence wins;
- contexts resolved once per hypothesis;
- a history window and a phone chain;
- objects built only for the beam survivors, after the same stable sort.

**Instrument:** a scratch bench that constructs `createEnglishG2p` exactly as `rust/tools/fn-diff/dump.mts` does and
times `g2p()` over a word list, warm, median of 5.

| word list | before | after |
|---|---|---|
| the 604 decoder inputs logged in Run 3 | 8,726 ms per pass (~14 ms a word) | **606 ms** (14×) |

**Outputs, before against after:**
- the 604 Min Nan words: identical;
- 20,000 constructed OOV words (every 7th lexicon word + `-ing`/`-s`/doubled `-er`/a glued pair, the fn-diff
  recipe): identical, `cmp` on the full output.

⚠ The first 20,000-word attempt timed 6 passes of the *old* decoder, which needs about 30 minutes. I stopped it
after its fingerprint pass had already been written, and compared one pass of the new decoder against that.

**`tools/check-goldens.mts nan`:** 12.7–22.4 s before (noisy, under other load), 5.8–7.6 s after.

**Gates:** all green. One TS failure in the first run, `trace-token-source` "#1452 IS FIXED", which goes through the
ONNX tagger path that this change doesn't touch. It passed alone and in a full rerun (7224/7224).
