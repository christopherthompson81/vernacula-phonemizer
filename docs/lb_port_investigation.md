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

## Run 7 — 2026-08-31 21:30 — independent review of #1223

Rebased onto a main that had moved eight commits. The only conflict was `Bootstrap.cs`'s registration
block — resolved keeping all four new entries in alphabetical order (Luo, Luxembourgish, Macedonian,
Maltese). 200/200 and 131 tests after.

**THE GAPS IN THIS LOG, FILLED.** Runs 1–6 have no exhaustive g2p walk, no astral or lone-surrogate fuzz,
no digit-family probe and no culture sweep:

    exhaustive g2p + digraph-order walk                       357,215 words   0 differ
      (all 1–3-letter words over the 28-letter orthography, all 4-letter over the 24 that carry a rule,
       EVERY one of the 26 digraphs in every slot against every other — tsch/sch/ch and éi/ei and äu/au
       are what make the longest-match order load-bearing — plus the rules the table cannot express:
       initial st/sp, single ⟨s⟩→[z], ⟨e⟩→[æ]/[ə], final ⟨g⟩, ⟨n⟩ before a velar, geminate collapse,
       intervocalic ⟨g⟩, and every unstressed prefix × stem × ending)
    FLEURS lb_lu cols 3+4 + golden, norm and text               3,822 rows    0 differ
    numbers 0–20,000 exhaustive + magnitude seams + non-finite  20,035 rows    0 differ
    five digit families × 14 operand frames                        145 rows    0 differ
    astral / lone-surrogate fuzz, norm and text                  36,419 rows    0 differ
    astral / lone-surrogate fuzz, WORD                           36,419 rows    **1 differs**

**THE ORDER CLAIM, DECIDED RATHER THAN ARGUED.** Run 4 and the PR both state that the digraph sort is
stable in both engines and that the golden re-proves it. That is an argument; the decidable question is
whether the two engines build the same list. Dumped both — **identical, 26 keys, same order**
(`tsch|sch|ch|ck|qu|…|ää|ss`). The C# `ABBREV_ALT` is likewise a stable length-descending join.

**Culture sweep:** three sites, all accounted for — the two `OrderByDescending` just decided, and one
`char.ToUpperInvariant` in `FractionNoun`, where every ordinal stem opens on ⟨é⟩ or an ASCII letter and the
two runtimes fold identically. `Js.Normalize` (not `string.Normalize`) is used on the raw word, so the
#1199 lone-surrogate throw is already handled.

## ⚠ Run 8 — the one differing row, and it is NOT a port defect

    phonemizeWord("ge\uD800é")   TS  ɡəˈeː      C#  ɡˈæeː
    phonemizeWord("ge\uD800a")   TS  ɡəˈa       C#  ɡˈæa

Reduced from 1-in-36,419 to a targeted prefix × junk × vowel grid: **56 of 245**. The trigger is an
unstressed prefix followed by a LONE SURROGATE, and the stress rule's `UNSTRESSED_PREFIX` test answers
differently, which moves both the stress mark and the ⟨e⟩ quality.

Isolated to the regex itself, outside the port:

    ^(ge|be|er|zer|ze)[^aeiouyäëéô]|^ver   flags u
      "ge\uD800é"   JS true   C# False        ⚠
      "ge\uD800"    JS true   C# False        ⚠
      "ge𐀀é"        JS true   C# True    (a well-formed pair agrees)

`Core/JsRegex.cs` translates a `u`-mode negated class into `(?:AstralPair|(?![\uD800-\uDFFF])[^body])`
**deliberately**, with the rationale written in place: emitting a plain `[^…]` "would match a LONE SURROGATE
and report half a character as the answer". JS disagrees. So this is a known design choice in the shared
tier whose cost had never been measured — and Luxembourgish's stress rule is the first rule in the fleet
whose OUTPUT depends on the answer. The same fuzz over lv, lt, smj, ky, luo, mk and mt is 0 differ.

⚠ **AND THE TOOL THAT EXISTS TO CATCH THIS CANNOT PROBE IT.** `extract_regexes.mts`'s own header says a
curated probe set "tests what someone thought of"; its `PROBES` carry astral pairs, ligatures, dotted and
dotless I, Deseret — and no lone surrogate. Adding one is not a one-line change, because the corpus
transport throws on it:

    System.InvalidOperationException: Cannot read incomplete UTF-16 JSON text as string with missing
    low surrogate.  at JsonDocument.GetString  …  regex-diff/Program.cs:line 40

So the one input class where `JsRegex` knowingly differs from JS is **structurally invisible** to the tool
whose job is to prove they agree, and `regex-diff` will keep reporting 124,863 identical / 0 DIFFER. Filed
as **#1227** with the repro and with what a fix needs (the transport first — code-unit arrays, as the
per-language harnesses here already use — then the decision about which engine is the reference).

Nothing in the port changes: it reproduces `JsRegex`'s behaviour exactly, which is what a port is for.

## Outstanding

Nothing found in the port itself. **#1227** stands, in the shared tier.
