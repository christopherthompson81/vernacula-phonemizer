# en — alloy and grade designations (#1458)

Two reported from listening: `316L tubing` → "three hundred sixteen **liters** tubing", and `Ti64` →
"T sixty-four".

## Run 1 — 2026-09-23 — the `L` is #1421's leak from the other side

```
316L tubing   ->  "316 liters tubing"   ->  θɹˈiː hˈʌndɹəd sɪkstˈiːn lˈiːt̬ɚz tʰˈuːbɪŋ
304L          ->  "304 liters"
Ti64          ->  unchanged             ->  tʰˈiː sˈɪksti fˈɔːɹ
```

⚠ **`316L` IS A WRONG UNIT, NOT A MISSING WORD**, which this normalizer ranks worse. It is the same leak
as #1421 (`V6L 2T5` → "vee six LITRES two"), and **that fix cannot reach it**: the code-slot lookbehind
matches *a token-initial letter, ONE digit, a one-letter unit* — `V6L` — and `316L` has no leading letter.

⚠ **AND NO SHAPE-BASED RULE SEPARATES THEM.** `a 5L jug` → "5 liters" is correct and pinned in the suite.
`316L` and `5L` differ only in the digits, and a `500L` tank is real. The discriminator is *which numbers
name a grade* — knowledge a list carries and a regex cannot. That is #1424's lesson, where a general
chemistry-formula reader was built for `CoCr` and rejected as out of step with the ask.

## Run 2 — the reading is the SPOKEN form, which was the user's call

Asked directly, because the two reports implied different rules — `Ti64` → "titanium sixty-four" is the
spoken form, while `316L` → "three sixteen austenitic stainless steel" is a **gloss**:

```
316L  ->  "three sixteen L"          ← chosen
Ti64  ->  "titanium sixty-four"
```

A material description is a *definition*: a spec naming the grade forty times would gain four words at
every mention. `Ti64` is the same principle from the other side — nobody reads it "titanium six aluminium
four vanadium". `FORMULA_READING` (`CoCr` → "cobalt chromium") reads the SYMBOLS and does not gloss either.

⚠ **THE USER DECLINED THE GRADE-LIST OPTION** when it was offered, so the table carries the two reported
rows and nothing else. `304L`, `321`, `410` and `17-4PH` all misread today and are **deliberately absent**
— `FORMULA_READING`'s own bar is *"rows are added on report, not by enumeration"*, and it applies with
more force here: the reading of a grade is mechanical, so the risk is not a wrong reading but a CLAIMED
TOKEN that was never a grade, and every extra row widens that. `304L` is pinned as still reading "liters"
so the absence is a decision rather than an oversight.

## Result

```
316L tubing   ->  "three sixteen L tubing"       θɹˈiː sɪkstˈiːn ˈɛɫ tʰˈuːbɪŋ
a Ti64 part   ->  "a titanium sixty-four part"   ə taᶦtʰˈeᶦniʲəm sˈɪksti fˈɔːɹ pʰˈɑːɹt
a 5L jug      ->  "a 5 liters jug"               unchanged
A316LX        ->  unchanged                      the boundary is exact
```

The rule runs at 0b6b, beside `FORMULA_TOKEN` and **before the unit rule** — which is the whole point,
since step 6 is where the `L` becomes litres.

## Run 3 — 2026-09-23 — the other three reports from the same batch

Worked in the same pass, because all four are "a token read as the wrong thing" and three of them land in
adjacent tables.

### #1459 `CT scan` → "court scan" — and the sweep could never have found it

The initialism pass is gated on `isRecorded(lower)`. Driving it directly with the gate forced both ways:

```
isRecorded -> true    "CT scan"  ->  "CT scan"      ← shipped
isRecorded -> false   "CT scan"  ->  "c t scan"     ← wanted
```

`ct` is a lexicon word, so the pass declines — the `ai` (sloth) / `psi` (Greek letter) / `tso` (the dish)
shape the list already documents. One row in `acronymLetters`, case-gated.

⚠ **THE ISSUE ASKED WHETHER #1422's SWEEP HAD A PREDICATE GAP. IT DOES NOT.** That sweep is anchored on
espeak-ng's `$abbrev` set — 160 entries — and **`ct` is not in it**. No tuning of the sweep's second
signal reaches a token its first signal never proposes. A source-coverage gap, not a predicate gap.

⚠ **AND MY ATTEMPT TO RE-RUN A CORRECTED SWEEP PRODUCED A BROKEN PREDICATE.** It reported 45 espeak
abbrevs as "dictionary words not yet spelled out", including `AI`, `OK`, `USA`, `ASAP`, `ABC` — all of
which read **correctly** today. The comparison expected a space-joined letter string (`"u s a"`) when the
engine emits a FUSED reading (`jˌuːɛsˈeᶦ`). The number is meaningless and is recorded here only so it is
not quoted from the scrollback.

### #1460 `DoE` → "doe" — a different mechanism from `CT`, measured

```
isRecorded -> true    "DoE matrix"  ->  "DoE matrix"
isRecorded -> false   "DoE matrix"  ->  "DoE matrix"      ← unchanged EITHER way
```

`CT` is declined by the gate; `DoE` is never a candidate, because the pass claims ALL-CAPS runs. So the
acronym list cannot reach it and it needs an expansion table of its own, keyed on EXACT CASE — `doe` is a
noun and `DOE` is the Department of Energy.

⚠ **ONE ROW, AND `PoC` IS THE REASON THE SHAPE IS NOT ENUMERATED.** `DoD`, `QoS`, `IoT`, `CoC` share it;
`PoC` has TWO common expansions ("proof of concept", "person of colour"), so a table row would pick one
silently. `SLASH_ABBREV`'s bar — a row needs a SINGLE DOMINANT READING — applies unchanged.

### #1461 `unmachinable` — see its own investigation; two rows, derived

Curated row → `g2p-dict.tsv` → `en_rebuild_lexicon.mts --write --add-missing`. Round-trip fidelity 100%,
0 other rows changed. ⚠ The rebuild tool NAMES the flag for a word the dict has and the lexicon does not,
which is the only reason the addition was not silently dropped: *"the engine will not look them up.
Re-run with --add-missing."*

## Two adjacent findings, recorded and NOT fixed

⚠ **NO ACRONYM PLURAL IS CLAIMED AT ALL.** The initialism pass matches an all-caps run and a trailing
lowercase `s` ends it: `AIs`, `CTs`, `SUVs`, `UFOs`, `TSOs` all reach the word layer whole. It only
MISREADS for the rows in `acronymLetters` — `SUVs` → `ˌɛsjuːvˈiːz` and `UFOs` → `jˌuːɛfˈoᶷz` are right,
because the OOV path spells a token the dictionary does not know, while `AIs` → `ˈaᶦz` ("eyes"),
`CTs` → `kʰˈɔːɹts` ("courts") and `TSOs` → `tsˈoᶷz` (the dish) are wrong for exactly the reason their
singulars were: the lowercase form is a real word, so the plural simply INFLECTS THAT WORD. **The plural
gap is the same defect one inflection over, for every hand-added row in that list.** Pinned positively.

⚠ **THE FIRST WRITE-UP OF THIS PARAGRAPH GUESSED `CTs` → `kʰˌɔːɹtˈɛs`** — "court-ess", as though the
`s` were spelled out separately — and review caught it. The engine emits plain `kʰˈɔːɹts`. The claim was
never measured; it was inferred from the shape of the defect, and it was wrong in the one direction that
mattered, because the whole point of the paragraph is to record the MEASURED state of the gap. Every
reading in it is now a copy of engine output.

⚠ **`DOE` ALL-CAPS STILL READS "doe"** — the Department of Energy. Unreported, and adding `doe` to
`acronymLetters` would claim it; left alone rather than decided in passing.
