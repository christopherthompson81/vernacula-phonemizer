# Kamba (kam) — C# port investigation

Chronological log of the runs behind the kam port.

## Run 1 — 2026-08-30 12:30 — scope

    wc -l src/languages/kamba/*.ts csharp/goldens/kam.tsv
        81 kamba.ts · 24 manifest.ts · 348 normalize.ts · 19 numbers.ts · 200 kam.tsv (rows)

Niger-Congo Bantu (E55), Kenya (~4M), Latin orthography. A PURE greedy longest-match scan over the
grapheme table — no code rules in the engine file; the Bantu fricativization/prenasalization live
entirely in `kamba.jsonc` (the Kikuyu pattern). The weight is split between the 12-step normalizer
(`normalize.ts`: the tilde-confusable fold, `sq mi`/`mph` composition, the currency-noun consume-and-
put-back, the shared symbol tier, the three-digit de-grouping, the `kũthi` range joiner, the decimal
spend, degrees with the already-said-it suppression, the clock, the spaced dash) and the shared E5x
cardinal compositor, which Kamba imports from Kikuyu (`src/languages/kikuyu/e5xNumbers.ts`) — a
cross-language import that had NO C# counterpart yet.

    csharp/goldens/kam.tsv (200 rows) exists, so the gate applies from the first run.

**The structure of the port:**

  * `Languages/Kamba/Kamba.cs` — the greedy scan (NFC first, then `Js.ToLowerCase`, then the length-
    descending grapheme keys, `LatinPhone` only on the miss branch) and the TOKEN regex, which is the
    one in this file worth reading: the word group is bounded to Latin script and anchored to BEGIN
    with a Latin letter, so a bare combining mark can never be claimed and a foreign run stays
    UNCLAIMED for the script router.
  * `Languages/Kamba/Manifest.cs` — `kamba.jsonc` typed; all keys are plain camelCase, so the loader's
    naming policy claims every one of them (pinned by `ManifestMappingTests.KambaManifestIsFullyMapped`).
  * `Languages/Kamba/Numbers.cs` — a two-line wrapper; the algorithm is the shared module.
  * `Languages/Kikuyu/E5xNumbers.cs` — the shared E5x compositor, ported once and placed in the
    Kikuyu namespace to mirror the TS tree 1:1, even though the Kikuyu ENGINE itself is unported:
    the module the TS lives in is where the C# copy lives. Kikuyu's own port will slot in beside it.
  * `Languages/Kamba/Normalize.cs` — the 12 steps in TS order, every pattern through `JsRegex.Compile`
    verbatim, every pipeline replace through the `Rewrite` seam.

⚠ **THE HAZARD LIST, WRITTEN BEFORE ANY CODE.**

  * The degree step's callback tests the PRE-MATCH prefix (`ndikilii\s*[+\-−]?\s*$` over
    `full.slice(0, offset)`). A .NET `Match` does not carry the input string — the port snapshots
    `var src10 = s;` before the `Rewrite`, the same shape Kinyarwanda uses for its marked insertions.
    Reading `m.String` does not compile; the first build attempt caught exactly that.
  * The E5x fallback degrades digit-by-digit for non-safe integers and must keep `raw` (#1095):
    `[...raw]` is CODE POINTS (`Js.CodePoints`), and `T.units[digitIndex(d)] ?? d` maps through
    `Numbers.DigitWord`, which returns null for non-ASCII — NOT the `(int)Js.Number(d)` index, which
    answers 0 for a whitespace character and would read a surviving separator as the word for ZERO
    (the #1165 class, filed against exactly this shape in Georgian).
  * Kamba is RULE-BASED ONLY (no ONNX tagger), so sync and async produce identical output and only
    the sync engine registers. No `NeuralRegistry` entry.

## Run 2 — 2026-08-30 13:00 — the first gates

    dotnet build                                    clean (the one pre-existing Marathi warning)
    dotnet test --filter Kamba                      63/64 — one failure
    npx vitest run test/kamba.test.ts               27/27 (TS side untouched)

The one failure was a transcription error in the NEW C# test, not the port: `ũtukũ` was expected to
read `otoko`, but the TS test file says `otuko` (o-t-u-k-o, checked by hexdump — the tilde is on the
first and last vowels only). Fixed the expectation; 64/64.

To be sure the C# test file carries the SAME inputs (tilde composition, apostrophe variants), every
string literal in `test/kamba.test.ts` was diffed against the C# file code-point by code point: all
67 unmatched strings were comments/imports/descriptions — every actual input and expectation is
byte-identical.

    dotnet test (full suite)                        4,354 pass · 0 fail
    dotnet run --project csharp/tools/parity -- kam  kam OK 200 rows · 0 differ
    --provenance kam   tokens 4743/4743 (100.0%) mapped, nothing lost
    --ipaspans kam     tokens 4329/4329 (100.0%), 0 wrong spans
    --poison kam       distinct poison sites: 0 (SUBSTRING 0, desync 0)

200/200 on the first parity run. The gate is the definition of done, and it closed before any
widening.

## Run 3 — 2026-08-30 13:10 — the widenings: FLEURS corpus + off-golden probes

The golden is 200 rows of FLEURS `kam_ke` prose; the corpus-wide differential is 20x that for the
cost of one command. There is NO mined artifact and NO kam.wikipedia (the normalization header says
so and measured it), so the corpus is the whole sourcing haystack and the widest differential
available.

    FLEURS kam_ke (train+dev+test, text col 3 + lowercased col 4, deduped)   3,984 unique lines
        C# sync      == TS   3,984/3,984   0 differ
        C# async     == TS   3,984/3,984   0 differ
        C# normalize == TS   3,984/3,984   0 differ
    off-golden probes (.probe/kam/probes.txt: every normalize arm plus its adversarial neighbour —
        confusables both cases + the six foreign-diacritic words, sq mi/mph spacings, the ndola
        consume-and-put-back shapes, US$/AUD$/$, the tier's unit keys with and without spacing,
        802.11a-g and 802.11m and 18.55.6.215, the three-digit test on both marks including
        5,000,000 and 12.345.678 and 01.234 and 2.4000, the range joiner's ascending guard and its
        two aircraft guards and `2-3-4`, the clock's two-digit minute bound against 3:2/2:2/4:41.30
        and 24:00 and 12:60, degrees with/without the preceding word, the spaced dash against
        `26 - 00`, `&`, `x`, the 2⁵³ ordinal fallback, the sign refusals)   167 lines
        C# sync/async/normalize == TS   167/167   0 differ

Leak sweep over all 8,138 TS outputs: **0 carry a raw digit or an unread symbol** (`%$&°£+/=<>×÷±`
all absent). ⚠ ASCII LETTERS are NOT a leak here — they are phonemic in Kamba's IPA (a, i, k, n, u,
m, w, t, e, l, o, s, j, d, b, z, p, h, f) and letter names, so the sweep is digits+symbols, not
alphanumerics. No BLOCKED rows: no foreign run in the corpus reaches an unported engine (the Latin
word class keeps everything claimed by Kamba itself).

Zero throws on every side. Everything matched on the first differential — the port needed no
correction, which is the expected answer for a language whose engine file is a table scan.

## Run 4 — 2026-08-30 13:16 — the full gates

    dotnet test (full suite)                        4,354 pass · 0 fail
    dotnet run --project csharp/tools/parity         160 languages byte-identical · 31,270 rows · 0 differ
    npm test (full TS suite)                        5,733 pass · 5 skip · 0 fail

The fleet total moved 159→160 languages and 31,070→31,270 rows — exactly kam's 200, no other
language's row moved.

## Notes for the record

  * kam is RULE-BASED ONLY: sync and async agree, one registration, no neural table.
  * The shared E5x module now lives at `csharp/.../Languages/Kikuyu/E5xNumbers.cs`. Kikuyu (ki) is
    still unported; its port reuses this module and adds only its own table and files.
  * The C# test file is the mirror of `test/kamba.test.ts` (64 tests over the 27 TS tests — the
    theories unpack the same rows); both suites stay green and pin the same goldens.
  * No defect found in either engine. The two things that would have diverged — the degree callback's
    pre-match prefix and the digit-by-digit fallback's whitespace-as-zero index — were hazards the
    hazard list caught before a run, not findings the gate caught.
