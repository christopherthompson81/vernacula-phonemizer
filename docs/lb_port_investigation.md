# lb → C# port investigation

Port of `src/languages/luxembourgish/` (3 modules: the grapheme-scan g2p, the pre-tokenizer
normalizer, the units-first numbers + Eifeler Regel) into `csharp/Vernacula.Phonemizer/Languages/Luxembourgish/`
(Manifest.cs, Numbers.cs, Normalize.cs, Luxembourgish.cs) + `LuxembourgishTests.cs` (130 cases) +
the Bootstrap and ManifestMappingTests registrations. Branch: `port/lb-luxembourgish`.

The gate set is the one PORTING.md makes expected of every port: the portable test suite, the 200-row
golden, the corpus-wide differential, off-golden probes, and the seam gates.

## Run 1 — 2026-08-31 ~07:00 — first build + portable tests

**Command:** `dotnet build csharp/Vernacula.Phonemizer/…` then `dotnet test … --filter Luxembourgish`.

**Question:** does the ported g2p + numbers + normalize match the TS engine's own pinned outputs?

**Raw finding:** build clean. 47/130 pass — all the pure word-level g2p and `numberToWords` theories.
83 fail, all in the normalize layer and everything downstream of it. Two distinct causes, both found
from the first failure's stack:

1. `JsRegex: in-class \S not supported` — the TS pattern is `(\S)` (a capture group); the first draft
   wrote `([\S])` (a character class), which the translator refuses by design. One-character fix.
2. With that gone, the next failure showed `plus` spliced between digits that had no plus sign — the
   literal `\+` was dropped from BOTH the after-word and initial plus patterns while transcribing the
   `SP`-interpolated template. Restored; 130/130 pass.

**Implication:** the g2p and numbers composer were correct on the first pass (the manifest tables and
the Danish `UnitsFirstNumbers` seam did the work); all divergence risk in this port lives in the
normalizer's ~30 regexes, exactly where the translator's loud-at-construction policy is meant to catch
drift.

## Run 2 — 2026-08-31 ~07:05 — golden parity

**Command:** `dotnet run --project csharp/tools/parity -- lb`

**Question:** are the 200 golden rows byte-identical?

**Raw finding:** `lb OK 200 rows` — 200/200 byte-identical, first run. No fix needed.

## Run 3 — 2026-08-31 ~07:10 — corpus-wide differential (FLEURS lb_lu)

**Command:** cols 3+4 of the three lb_lu TSVs, deduped
(`cat …/lb_lu/{dev,test,train}.tsv | cut -f3,4 | tr '\t' '\n' | sort -u` → 3,792 lines; first line is a
sentence, so the column trap did not bite). Both engines, three modes each, fresh process per mode:
TS `phonemize`/`phonemizeAsync`/`normalizeLuxembourgish∘prePass` vs C# `Phonemize`/`PhonemizeAsync`/
`NormalizeLuxembourgish∘Registry.PrePass`, diffed line-wise.

**Question:** does the whole corpus agree, sync and async?

**Raw finding:** 0 differing lines in all three modes (3,792 × 3 × 2 directions).

**Coverage measurement (the clean-differential caveat):** the corpus does NOT contain: `-N` negatives
(0), `±` (0), `× ÷ = < >` (0 each), `m³` (0), `z. B.`/`d. h.` (0), thin space U+2009 (0). It DOES carry:
period-clocks 58, grouping 8, ordinals 22, comma decimals 46, colon scores 12, en dashes 69, NBSP 584,
NNBSP 96, `km/h` 20, mph/Meile 18, abbreviations 14, a degree sign 6, era 1. The absent arms are the
off-golden probes' job (Run 4), and they all agree there.

## Run 4 — 2026-08-31 ~07:15 — off-golden probes + numbers differential

**Command:** 126 hand-built probe lines (one per normalize arm + the adversarial neighbour each must
decline: `802.11n`, `Ofbildung 1.1.`, unlicensed `20.30`, `gëtt – duerch`, `St.`, `Typ-1-Diabetes`,
`Kapitel 5.`, the `±/×÷=<>` sign class the corpus lacks, the Eifeler `-en` edges, bignum 2^53+1 and
1e21) through both engines in sync/async/norm; plus `numberToWords` over 0…999,999 and the eleven
magnitude sentinels, both engines.

**Question:** do the arms the corpus never exercises agree?

**Raw finding:** 0 differing lines in all three probe modes; numbers 1,000,011/1,000,011 identical.

## Run 5 — 2026-08-31 ~07:20 — seam gates

**Command:** `dotnet run --project csharp/tools/parity -- --poison lb`, `--provenance lb`, `--ipaspans lb`.

**Question:** is every `Rewrite` call actually on the pipeline string, and are the spans intact?

**Raw finding:** poison 0 sites (SUBSTRING 0, desync 0); provenance 4,801/4,801 tokens mapped
(100.0%); IpaSpan 4,254/4,254 (100.0%), 0 spans not covering their emission. All normalizer replaces
are legitimately pipeline-string; no `Rebuilt`/`Renormalize` needed — lb's normalizer is pure
regex-replace, no segmentation or per-rune fold.

## Run 6 — 2026-08-31 ~07:25 — regression check

**Command:** full C# suite (`dotnet test`, 5,288 tests) and the TS `test/luxembourgish.test.ts`
(33 tests).

**Raw finding:** 5,288/5,288 and 33/33. The TS side is untouched by the port.

## State

Port complete on `port/lb-luxembourgish`, uncommitted. Every gate green with no TS-side finding to
file: the two Run-1 defects were port transcription errors (a class where the translator's refusal is
the designed failure mode) with no TypeScript half, so the bidirectional rule does not trigger.
