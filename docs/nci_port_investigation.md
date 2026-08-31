# nci → C# port investigation

Port of `src/languages/nahuatl/` (3 modules: the position-aware grapheme scan, the 10-step
pre-tokenizer normalizer, the vigesimal `īpan`/`on-` composer) into
`csharp/Vernacula.Phonemizer/Languages/Nahuatl/` (Manifest.cs, Numbers.cs, Normalize.cs,
Nahuatl.cs) + `NahuatlTests.cs` (87 cases) + the Bootstrap and ManifestMappingTests
registrations. Branch: `port/nci-nahuatl`.

The gate set is the one PORTING.md makes expected of every port: the portable test suite, the
200-row golden, the corpus-wide differential, off-golden probes, and the seam gates.

## Run 1 — 2026-08-31 ~09:30 — first build + portable tests

**Command:** `dotnet build csharp/Vernacula.Phonemizer/…` then `dotnet test … --filter Nahuatl`.

**Question:** does the ported g2p + numbers + normalize match the TS engine's own pinned outputs?

**Raw finding:** build clean after two `var a = …, b = …` multi-declarator fixes in Numbers.cs
(C# has no implicit multi-declarator; the JS `const p = …, d = …` idiom does not transliterate).
87/87 pass on the first full run — word scan, the vigesimal series, and the whole normalize
layer. No TS-side finding.

## Run 2 — 2026-08-31 ~09:35 — golden parity

**Command:** `dotnet run --project csharp/tools/parity -- nci`

**Question:** are the 200 golden rows byte-identical?

**Raw finding:** `nci OK 200 rows` — 200/200 byte-identical, first run. No fix needed.

## Run 3 — 2026-08-31 ~09:45 — corpus-wide differential (mined corpus, not FLEURS)

**Command:** both engines over every text of `tools/corpus/mined/nci.jsonc` — the `hard` tier
(191 adversarial segments) and the `sample` tier (200 uniform segments), deduped to 377 unique
texts. TS `phonemize` vs C# `Phonemize`, fresh process each, JSONL transport, line-wise diff.

**Question:** does the whole corpus agree?

**Raw finding:** 0 differing lines (377 × 2 directions).

**⚠ THE CORPUS IS THE MINED ARTIFACT, BECAUSE nci HAS NO FLEURS.** Classical Nahuatl is not in
FLEURS, so the FLEURS transcript differential PORTING.md expects is unavailable and the mined
wiki corpus carries the weight instead. Two structural notes:

1. The `sample` tier IS the 200 golden rows (row 0 of the artifact is row 1 of `nci.tsv`), so
   the incremental coverage of this run over Run 2 is the `hard` tier — the segments selected
   because they challenge the normalization layer.
2. The `sample` array is flat strings while `hard` is `{cell, text}` rows. The first harness
   read `row.text` off both and fed `phonemize(undefined, "nci")` 200 times: the TS engine threw
   a `TypeError` in the SHARED roman pass, because `"undefined"` (the stringified `undefined`)
   contains `i` and `d`, past the one-Roman-letter fast path and into `rewrite(undefined, …)`.
   A harness bug, not an engine finding — garbage in is garbage out on both sides — but it is
   the reason the artifact's two tiers have different shapes and any future consumer must check
   `typeof row === "string"`.

**Coverage measurement (the clean-differential caveat):** all ten normalize arms are exercised,
including the refusals this layer is designed to make: degree `°` 8 texts, the `º` masculine
ordinal it must NOT read 3, space-grouped figures 9, comma-grouped 22, decimals 12, clocks 9
(`hrs`-gated 2), range dashes 27, ZWSP 8, literal `&nbsp;` 6, the morpheme-boundary `+` it must
NOT read 9, `%` 11, `$` 1, the self-glossed `1/4` fraction 3, `km` 3 and `m` 11 (the glued
`9.8m`/`180m` declinations included). 256 of 377 texts carry digits at all.

## Run 4 — 2026-08-31 ~09:50 — numbers differential

**Command:** `numberToWords` over 0…200,000 in both engines, tab-delimited, `diff -q`.

**Question:** does the vigesimal composer agree beyond the TS suite's 0…20,000 sweep?

**Raw finding:** 200,001/200,001 identical. The range covers every sub-20³ composite, the
`on-`/`om-` linker in all its assimilations, and the first `īpan` groups above 400.

## Run 5 — 2026-08-31 ~09:55 — seam gates

**Command:** `dotnet run --project csharp/tools/parity -- --poison nci`, `--provenance nci`,
`--ipaspans nci`.

**Question:** is every `Rewrite` call actually on the pipeline string, and are the spans intact?

**Raw finding:** poison 0 sites (SUBSTRING 0, desync 0); provenance 4,196/4,196 tokens mapped
(100.0%); IpaSpan 3,535/3,535 (100.0%), 0 spans not covering their emission. The normalizer's
two per-match replacements (the space/comma de-grouping inner `rest.replace`) correctly stay on
`JsRegex.Replace` — they operate on a captured group, not the pipeline string — and the poison
gate confirms no `Rewrite` site is a substring call.

## Run 6 — 2026-08-31 ~10:00 — regression check + the bootstrap sample rotation

**Command:** full C# suite (`dotnet test`, 5,716 tests) and the TS `test/nahuatl.test.ts`
(50 tests).

**Raw finding:** 50/50 on the TS side (untouched by the port). The C# side came back 5,715/5,716
with exactly one failure, and it is the failure the test was built to produce:
`LanguageBootstrapTests.UnportedLanguageIsReportedRatherThanGuessedAt` uses `nci` as its sample
of a still-unported language, and its own comment says the sample "changes as the port
advances — it was `de` until German landed". Rotated to `mto` (Totontepec Mixe) — the smallest
L1 population (6,000) of the 14 unported languages, and golden-less at that, so it is the least
likely to be the next port. 5,716/5,716 after.

## State

Port complete on `port/nci-nahuatl`, uncommitted. Every gate green with no TS-side finding to
file: no defect the port sent back to the TypeScript, so the bidirectional rule does not
trigger. The only standing change outside the port is the bootstrap-test sample rotation
(nci → mto), which the test's own comment anticipates.

---

# Review (2026-08-31)

Reviewed on the rebased branch. Runs 7–13 are the review's own measurements.

## Run 7 — 2026-08-31 11:02 — the rebase, and the `[Fact]` trap a second time

Two additive conflicts (`Bootstrap.cs`, `ManifestMappingTests.cs`): both sides had appended an entry.
In the mapping file the shared `[Fact]` sits ABOVE the conflict marker, so the naive "keep both"
resolution strands whichever test lands second — the same defect the mos review hit and repaired.
Resolved with the attribute restored, then audited: **150 mapping tests, 0 missing `[Fact]`**.

⚠ This is now twice in three ports. The conflict is structural, not incidental: every port appends its
mapping test to the end of the same file, so every port conflicts here, and the attribute always
belongs to the hunk that loses. Worth knowing before the next port lands.

## Run 8 — 2026-08-31 11:06 — the rotated bootstrap sample, checked rather than accepted

The PR rotates `LanguageBootstrapTests`'s "still unported" sample from `nci` to `mto`. All four claims
verified: no `Languages/TotontepecMixe/` in the C# tree, no `csharp/goldens/mto.tsv`, the
`case "mto": return Create("totontepecmixe")` mapping exists (so the test exercises the intended path
rather than an unknown-code path), and `nahuatl` is now registered so it could no longer serve.

## Run 9 — 2026-08-31 11:14 — the corpus differential is 6,287 rows, not 377

Run 3 built its differential from the mined artifact's two tiers and reported 377 unique texts, noting
that the `sample` tier IS the golden so only the 191-row `hard` tier carries new signal. That is
correct as far as it goes, but the repo holds more:

```
tools/corpus/mined/nci.jsonc                        100,540 bytes
tools/corpus/attest/nci.jsonc                        31,260 bytes
tools/referee-eval/referees/nci.kaikki.tsv           67,540 bytes
tools/referee-eval/referees/nci.wikipron-broad.tsv   26,502 bytes
```

nci has **kaikki and wikipron referees** — the absent artifact is FLEURS, which is a narrower fact than
"no corpus". Harvesting all four plus the golden: **6,287 unique texts, 0 differ on `norm`, `word` and
`text`**, no throws on either side.

## Run 10 — 2026-08-31 11:20 — the walks, and the range Run 4 could not reach

Run 4 walked `numberToWords` over 0…200,000. ⚠ That range never reaches 20⁵ (3,200,000) or 20⁶
(64,000,000), so the upper `īpan` groups and the 20⁷ digit-fallback boundary were untested — which
matters here because the composer's whole difficulty is the positional magnitude ladder.

| walk | rows | differ |
|---|---|---|
| numbers — 0…200,000 exhaustive, ±1,200 around **every** power of 20 (20¹…20⁷) plus each multiplier 1–19 of each, 80k random inside the composed range, 20k random in the digit fallback, 2³¹/2⁵³, non-finite, astral and lone-surrogate operands | 307,431 | 0 |
| g2p — exhaustive over the trap alphabet: every string of length 1–3 over 21 letters, **every string of length 4 over the 14-letter core** (38,416 — the space the four-deep ⟨chu⟩ lookahead lives in), plus every documented trap in six preceding × six following contexts, and the saltillo's whole domain | 48,455 | 0 |
| normalizer adversarial + astral fuzz — every documented corpus instance and every refusal verbatim, separators × head × group-count × 17 trailing contexts, clock arity 7×3×3, range shapes, units × 6 adjacencies, `°`/`º` × 6 scale letters, 35k random astral/invisible strings — on `norm`, `word`, `text`, `num` | 31,329 ×4 | 0 |
| token/script boundary — every ordered pair of 12 scripts, 5 combining marks in 6 positions, the `NATIVE_CLASS` in/out boundary | 1,053 | 0 |

## Run 11 — 2026-08-31 11:26 — pattern diff, both halves of it

A source-literal scan alone is not sound here: `TOKEN`, `CLOCK_HRS`, the two unit regexes and the
nativiser are all built with `new RegExp` on the TS side and are invisible to it (the lesson from the
mos review, where the same gap read as a 6-pattern disagreement). Ran both halves — literals scanned
from source, dynamics captured by a `RegExp` constructor Proxy hooked before the import:

```
TS literals 14 + dynamic 10 = 24 union     C# 16     shared 16     ONLY IN C#: 0
```

Every C# pattern has a byte-identical TS twin including flags. The 8 TS-only are accounted for: 4 are
shared-core patterns outside a Nahuatl-namespace reflection scan, 2 are the unit regexes compiled in a
loop on BOTH sides (so reflectable as a static field on neither), 1 is `LATIN_RUN` standalone (its body
appears inside the C# `TOKEN`), and 1 is the `link` regex — see below.

⚠ **`link()` is a rewrite, not a mirror.** TS tests `/^[aeiouāēīōū]/u.test(word) || word.startsWith("m")`;
C# tests `first is 'a' or … or 'm'`. Equivalent only if the TS class is PRECOMPOSED — a decomposed
source would make the class match a bare U+0304 and miss precomposed ā. Checked codepoint by codepoint:
`U+0061 U+0065 U+0069 U+006F U+0075 U+0101 U+0113 U+012B U+014D U+016B`, precomposed throughout, and
the manifest's vowel keys are all single precomposed characters. Equivalent.

⚠ Unlike the mos and cdo ports, nci has **no empty-string divergence to find**: `isVowel` uses
`VOWEL[c] !== undefined` rather than truthiness, and the final fallback uses `??` rather than `||`, so
an empty table value would behave identically in both engines. The TS is written defensively here.

`regex-diff`: **141,068 probe results identical, 0 DIFFER, 0 threw**, corpus fresh. ⚠ Only **3 of
nci's 13 patterns** are in that corpus, so the fleet instrument covers a fifth of this layer — the
pattern diff above and the behavioural walks are what carry the rest.

## Run 12 — 2026-08-31 11:33 — seam gates widened, and a clean leak sweep

Golden-swap widening, 87,124 TS-sourced rows (corpus + fuzz + g2p + token walks), restored afterwards
as its own command and verified byte-identical to the committed golden:

```
parity       87,124 rows ok, 0 differ
provenance   183,547/183,547 tokens (100.0%)
ipaspans     0 spans that do not cover what the token emitted
poison       0 SUBSTRING, 0 desync
```

Leak sweep over the 54,502 rows whose subject is native-alphabet only (the restriction the mos review
learned to apply — an unrestricted sweep just measures the script router on foreign text), against the
inventory built from `vowels` ∪ `consonants` plus the positional rules' own literals, with a planted
`ħ` to prove the instrument can fail: **0 stray characters, 0 distinct.** Probe: 1 stray. The cleanest
of the three ports reviewed.

## Run 13 — 2026-08-31 11:40 — the test diff, and one fidelity slip repaired

Mechanical `(input, expected)` pair diff: 47 TS pairs, 47 C# pairs. Two initially read as missing; both
were extractor artifacts of `​` vs `​` casing — except that reading them found a real slip:

```
TS:  "Cicero;​ Arpino"     U+003B U+200B U+0020    (semicolon, ZWSP, space)
C#:  "Cicero; ​Arpino"     U+003B U+0020 U+200B    (semicolon, space, ZWSP)
```

The ZWSP and the space are TRANSPOSED, so the ported test did not test the TS's input. Both pass and
both inputs were confirmed to agree across the engines (0 differ on all five orderings probed), so
there is no behavioural defect — but a 1:1 port's test should carry the 1:1 input, and a transposed
one would not catch a rule that became position-sensitive. **Corrected**; the pair diff is now 47/47,
0 TS-only.

No duplicate `InlineData` rows (xUnit silently skips those), no test method missing its attribute, and
the entry points match — both sides call the registry `phonemize(..., "nci")` throughout, so there is
no raw-engine/pipeline mismatch of the kind the mos review had to check.

Culture sweep over `Languages/Nahuatl/*.cs`: `Js.ToLowerCase`/`Js.Normalize` on input, only
`char.ToString()` and `StringBuilder.ToString()` otherwise, ordinal dictionary lookups, no `Parse`, no
culture-sensitive comparison. The trailing `sb.ToString().Normalize(FormC)` is a RAW `.Normalize` —
checked, because that is what turned latent in `HostWord`/`Balochi` under #1227. It cannot throw here:
the scan drops any character with no table entry, so a lone surrogate never reaches the output.
Confirmed by probe (10 lone-surrogate inputs, 0 differ, no throw), and raw `.Normalize` on an output
string is the fleet idiom at 71 other sites.

## Gates

```
dotnet test                     5,815 passed, 0 failed
parity -- nci                   200/200 byte-identical
parity (full fleet)             177 languages byte-identical, 0 differ (34,539 rows)
golden-swap widening            87,124 rows · provenance 183,547 · ipaspans 0 · poison 0
regex-diff                      141,068 identical, 0 differ
TS suite                        290 files / 5,746 tests
```

## Standing

Nothing outstanding against the port. Two things worth carrying forward, neither blocking: the
corpus differential is 6,287 rows rather than 377 (Run 9), and `regex-corpus.jsonl` holds only 3 of
this layer's 13 patterns (Run 11).
