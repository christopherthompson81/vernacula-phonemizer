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

---

# PR review (#1200)

## Run A — 2026-08-30 13:25 — rebase and the mechanical diffs

Rebased onto main (2 behind: #1198 kea, #1194 ilo). One `Bootstrap.cs` conflict; both projects rebuild
with 0 errors, which is the check that matters after a `ManifestMappingTests`-adjacent merge.

    parity -- kam (after the rebase)   kam  OK  200 rows

**Patterns.** Source-scanned literals plus a RegExp-constructor hook on the TS side; reflection over the
`JsRe` static fields on the C# side. 17 C# patterns, every one byte-identical to its TypeScript
counterpart with flags. The 2 TS-only literals are the de-grouping arms' inner `rest.replace(/,/gu,"")`
and `rest.replace(/\./gu,"")` — matched groups, spelled `string.Replace` in the C#, which is the correct
non-seam call on both sides.

⚠ Two patterns in the TS hook dump belong to the SHARED TIER, not to kam — `(\p{Nd})\s*(×|x)\s*(?=\p{Nd})`
and the `[    ]` class both come from `core/normalizeSymbols.ts`. Checked before treating
their absence from the kam C# as a gap. **kam has TWO de-grouping arms (comma, dot) and no space arm**,
on both sides — unlike kea, which has three.

`GRAPHEME_KEYS` is length-descending and stable on both sides (`OrderByDescending` / `sort((a,b)=>b.length-a.length)`).

## Run B — 2026-08-30 13:30 — the differentials and the walks

One process per side, `clearForeignOov()` once, rows in order, code-unit transport.

    corpus (1,994 lines: 1,992 FLEURS kam_ke + the golden's own)   norm 0 · text 0
    generated haystack (1,898 lines)                                norm 0 · text 0
    numbers (0…200,000 exhaustive + boundaries + stride to 10¹²
             + the fallback arms incl. an astral raw; 326,327)      0 differ

The g2p ENUMERATED:

    full 29-character word inventory, 1–3 letters      25,259 words   0 differ
    16 class representatives, 4 letters                65,536 words   0 differ

## Run C — 2026-08-30 13:35 — **DEFECT 1: `PhonemizeWord` threw on a lone surrogate**

The astral/surrogate walk — U+1F600 and its two halves crossed with the letters that decide the scan:

    PhonemizeWord("a\ud83d")   TS: "a"   C#: !!ERR String contains invalid Unicode code points
    2,949 of 12,672 words threw

`Kamba.cs` normalized the RAW WORD with `string.Normalize`, which refuses an unpaired surrogate where JS
returns it unchanged. #1199's class. Fixed with the shared `Js.Normalize`; the walk re-runs at 0 of 12,672.

## Run D — 2026-08-30 13:40 — **DEFECT 2: the same hazard IN THE SHARED CORE, on the shipped path**

The adversarial fuzz (888 hostile lines) failed 48 rows on the NORMALIZE path — which `PhonemizeWord`'s
fix does not touch:

    normalizeKamba("1\ud83d000")   TS: "1\ud83d000"   C#: !!ERR String contains invalid Unicode code points

`Rewriter.Renormalize` opened with `s.Normalize(form)` on the **pipeline string**. That is reachable from
the shipped `Phonemize()` for every engine whose normalize pass begins with a renormalization — not a kam
bug at all. Fixed there (both the whole-string call and the per-block one on the traced path, since the
blocks are slices of the same untrusted string).

⚠ THE SCALE, MEASURED BEFORE AND AFTER over every code in `Registry.cs`:

    before   193 languages × 5 surrogate probes:  100 threw, 809 ok  —  25 languages
    after                                          16 threw, 809 ok  —   4 (chv fa qu sv)

**21 of the 25 languages in #1199 were this one shared-core site.** The issue was updated with the new
scope rather than left claiming 25.

## Run E — 2026-08-30 13:45 — the seam gates on a real corpus

A 3,892-row reference generated from the TypeScript over the corpus + haystack, swapped in for
`csharp/goldens/kam.tsv`, both engines' gates run, golden restored.

    parity kam                 3,892 rows OK, 0 differ
    parity --poison kam        0 sites      provenance 52,800/52,800   IpaSpan 47,256/47,256
    provenance-poison.mts      0 sites      --full coverage: 52,800/52,800 and 47,256/47,256
    seam-parity.mts            kam absent from the disagreement table

    leak sweep   corpus 0/1,994 · haystack 0/1,898, on BOTH engines

The token counts match EXACTLY across the two engines.

## Run F — 2026-08-30 13:48 — the fuzz residue

    hostile fuzz (888 lines)   norm: 0 differ    text: 17 differ

All 17 contain a Tifinagh code point — checked mechanically, the residue is empty. That is #1196.

## Read for correctness — notes, nothing filed

- **The confusable fold is spelled correctly on both sides**: the outer call is `rewrite`/`Rewrite` (the
  pipeline string) and the four inner folds are plain replaces on a matched word. Unlike kea, kam's TS
  tail is already `rewrite`, so there is no undeclared mutation here.
- **`KAMBA_WORD` carries `i`+`u`**, so JS's fold widens its alphabet (`ſ` reaches `s`, U+212A reaches `k`).
  Identical in both engines — JsRegex models the widening — so it is faithful, not a divergence.
- **The three apostrophe variants** (`'`, `’`, `ʼ`) are folded to `'` before the ⟨ng'⟩ key lookup on both
  sides, and the 1–3 walk includes all three.

## Run G — 2026-08-30 13:55 — the full gates

    dotnet test (full suite)          4,532 pass, 0 fail
    parity (ALL goldens)              162 languages, 31,564 rows, 0 differ
    npx vitest run (full suite)       290 files, 5,740 pass, 0 fail
