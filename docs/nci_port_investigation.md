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
