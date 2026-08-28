# #1150 stage 2 — normalizer provenance, the shape (English first)

Stage 1 shipped a `normalize` REWRITE EVENT: one `{before, after}` pair for the whole normalization. That is
the receipt. Provenance is the itemisation — *which input characters produced this normalized token*. This
investigation finds the shape by building a prototype against English, then testing whether the shape
generalises.

## Run 1 — 2026-08-28 — what English's normalizer actually is

    709 lines · 48 `.replace(` · 1 `.split(` · 5 `.slice(` · 0 `matchAll`

    pipeline replaces (`s = s.replace(...)`)   45
    replaces on LOCAL strings inside callbacks  3   (predicates like `int.replace(/,/g,"")`)
    split                                       1   (on a CONSTANT, `MONTH_ALT.split("|")`)
    slices                                      5   (all inside callbacks, READING context)

⚠ **So the whole normalizer is one string threaded through 45 sequential whole-string replaces.** Nothing
restructures the pipeline. That is what makes a mechanical answer possible, and it is the first real finding:
the shape of stage 2 is determined by the shape of the normalizers, and this one is uniform.

## Run 2 — the model, and the mechanical adoption path

Carry a **provenance array** beside the string: `prov[i]` is the `[start,end)` range of the ORIGINAL input
that character `i` derives from. Identity to begin with; each replace keeps the provenance of untouched
regions and stamps the WHOLE match's provenance across the replacement.

Adoption is then a textual substitution, exactly as stage 1 derived the trace at one seam rather than
threading it through 180 modules:

    s = s.replace(RE, REP)   ->   s = tr(s, RE, REP)

Applied mechanically to English: **45 of 45 rewritten**, `s` the only pipeline variable.

## Run 3 — measured, and the prototype was wrong in an instructive way

First run over `csharp/goldens/en.tsv`: **198/200 identical, 2 differ** — `Jr.` stayed `Jr.`.

⚠ **THE BUG WAS MINE AND IT NAMES A CONSTRAINT ON THE REAL DESIGN.** The prototype re-ran the regex against
the isolated match text to compute the replacement. A pattern with a LOOKAHEAD — English has many, e.g.
`\bca?\.\s*(?=\d{3,4}(?!\d))` — cannot match `m[0]` alone, so the replacement silently did not apply. The
helper must invoke the replacer with the SAME arguments `String.replace` passes, **including the offset and
the whole string**, which several English callbacks genuinely read (`all.slice(at + whole.length)` at
normalize.ts:583, `full.slice(off + whole.length)` at :657).

After fixing that: **200/200 identical, provenance length equals output length on every row (total
coverage).**

## Run 4 — ⚠ the reordering claim I made in #1150 and #1153 was WRONG

I wrote that mapping back "is not an offset problem — normalization REORDERS", citing Luganda's measure noun
moving ahead of its number. Measured:

    en   200/200 identical   NON-MONOTONIC 0
    lg   201/201 identical   NON-MONOTONIC 0

The reordering is real but it happens **inside a single match**, so a SPAN-level mapping absorbs it:

    "1 244.7 km²"  ->  "kiromita eza kyebiriga 1244 7"     one span to one span
    "$1,250"       ->  "1,250 dollars"                     the `$` moves, the span does not
    "15%"          ->  "15 ku kikumi"
    "1775–1783"    ->  "1775 okutuuka mu 1783"

Character-level provenance would indeed be non-monotonic here. **Span-level provenance is not**, because the
unit rule matches the number and its unit TOGETHER and replaces them together. The blocker I asserted does
not exist at the granularity stage 2 actually needs.

## Run 5 — does the shape generalise?

The same mechanical rewrite applied to the 17 largest normalizers in the tree, run over their own goldens:

    et lt mn ka rn ky sl rw bs fi sat nso bm sr ak    2,931 rows
    plus en (200) and lg (201)

    identical: ALL          non-monotonic: 0

Two declined for a reason worth recording: `ug` and `ps` export no `normalize<Lang>` under that name, so the
sweep skipped them rather than guessing — a reminder that the entry points are not uniform even where the
bodies are.

## The shape, stated

1. **A `tr()` helper replacing `s.replace()`** — same regex, same replacer, same order, plus an ambient
   provenance array. Adoption per normalizer is a mechanical substitution, ~15–48 sites each.
2. **Span granularity, not character.** It is what makes the mapping monotonic, and it is the granularity a
   consumer wants anyway ("this token came from those characters").
3. **The replacer contract must be honoured exactly** — offset and whole-string arguments included. This is
   the one place a naive wrapper breaks, silently, on lookahead patterns.
4. **It composes with stage 1 for free.** A trace token already carries a span into `normalized`; provenance
   maps that span to the input, so `token → input characters` is a lookup rather than a new mechanism.

### What was still unknown at Run 5 — all of it measured in Run 6

  * **180 normalizers × 2 engines.** This sweep covered 17 of them, chosen as the largest. Uniformity held,
    but "the largest" is a biased sample — the small ones may use shapes the rewrite does not cover.
  * **Non-`replace` transformations.** English has none in its pipeline; another engine may (a `split`/`join`
    round trip, a manual rebuild). Those need per-site work, and the sweep would show them as `differ`.
  * **The registry pre-passes** (markup stripping, digit folds, Roman numerals) run BEFORE the engine's own
    normalizer and are not covered by a per-normalizer rewrite.
  * **Cost in the hot path.** The prototype allocates a `[start,end)` pair per character per step. That is
    fine for a diagnostic and probably not fine for `phonemize()`, so provenance must be OFF unless a trace
    is running — the same discipline stage 1 uses.


## Run 6 — the fleet sweep: where the hard cases actually are

Run 5 sampled the 17 largest normalizers. This is all of them, plus the shared components, and it moved the
answer: **the per-language normalizers are the easy part.**

### First, is `tr` a faithful drop-in? If so the rewrite is safe BY CONSTRUCTION

A differential against native `String.replace` over hand cases drawn from what the fleet actually uses
(lookahead, lookbehind, named groups, `$1`/`$&`/`$$`, callbacks reading offset and whole string, non-global,
unicode properties, zero-width) plus a randomised sweep:

    first run:  4,000 random cases, 337 MISMATCHED

⚠ **An out-of-range `$n` is LITERAL in JavaScript, not empty.** `"abc".replace(/\d+/g, "$1")` keeps the text
`$1`, because the pattern has no group 1. The prototype emitted `""`. Also missing: `` $` ``, `$'`, `$<name>`
with no named groups, `$0`, and the `$nn` → `$n` + digit fallback. After implementing the substitution rules
properly: **29/29 hand cases and 4,000/4,000 random identical.**

### Then the fleet

    168 normalizers rewritten mechanically · 3,203 `s = s.replace(...)` sites
    measured: 140 normalizers · 27,286 golden rows

    identical      27,286      DIFFER 0        <- the rewrite is faithful IN SITU, everywhere
    prov-length       283                      <- a pipeline step the rewrite MISSED
    non-monotonic      13

⚠ **`prov.length !== output.length` is the detector for a missed step**, and it is why static analysis was not
the instrument: a `.replace` the rewrite does not convert still changes the string, so only the provenance
falls out of sync. Counting unconverted `.replace(` calls statically flagged 145 of 168 files, almost all of
them harmless locals inside predicates.

### ⚠ The hard cases are the SHARED components, not the per-language files

`abkhaz` and `sesotho` both desynced, and neither had an unconverted pipeline replace of its own. Both call
`makeSymbolNormalizer` from `core/normalizeSymbols.ts` — **used by 211 language files**. Rewriting that one
shared file:

    non-monotonic   13 -> 1        prov-length   283 -> 239

### And there are THREE code shapes, only one of which the pattern covers

    s = s.replace(...)                    3,203 sites   covered
    return s.replace(...)                               NOT covered — normalizeSymbols.ts:658
    return (text) => text.replace(...)                  NOT covered — normalizeSymbols.ts:602
    non-`replace` transformation                        per-site work

### ⚠ AND THERE IS NO GENUINE REORDERING ANYWHERE

Every "non-monotonic" row turned out to be a provenance DESYNC from an uncovered step — `prov` holes reading
as a jump back to offset 0 — not text moving. Checked case by case for `ab`, `st`, `eu`, `ilo` and the last
survivor `ltg`. Run 4's correction stands and is now fleet-wide rather than a two-language sample.

### The remaining work, sized

  * **The shared components.** `core/normalizeSymbols.ts` (211 users, 23 replaces, 12 self-assigning) needs
    the `return`/closure shapes too. `core/initialisms.ts` (78 users) has **0** self-assigning replaces — a
    different shape entirely. `core/unicode.ts`, `markup.ts`, `roman.ts` are the registry pre-passes.
  * **Entry-point variance.** 18 normalizers have no single-argument `normalize<Lang>` export (french is
    `(input, isWord)`; several Indic engines differ), so they could not be measured this way and were
    REPORTED rather than skipped. 10 more have no self-assigning replace at all: ancientgreek kalaallisut
    kiche lulesami maltese naija nama nogai tagalog totontepecmixe.
  * **Nesting.** Ambient provenance has the same hazard stage 1's recorder had: a traced component called
    from inside another traced component corrupts the outer array. It needs the same depth discipline.
  * **Hot-path cost.** Still unmeasured. The prototype allocates a `[start,end)` pair per character per step,
    so provenance must be OFF unless a trace is running.

### What this means for doing the rewrites en masse

The mechanical part is proven — 3,203 sites, 27,286 rows, zero output change. But shipping it now would leave
239 rows silently desynced, which is precisely the failure mode this project keeps finding: an instrument
that looks clean and measures nothing. The order that follows from the evidence is: cover the three shapes in
the shared components first, add the nesting guard, measure the cost, and only then rewrite the 168.

## Run 7 — review, and the defect that made the feature worse than useless

⚠ **The `?? [0, 0]` fallback laundered a desync into a confident wrong mapping.** `provenanceFor` withholds
the mapping when its length disagrees with the string — but `tr` rebuilt the array at the CURRENT length,
filling gaps with `[0,0]`, so the very next tracked step re-synchronised the LENGTH over shifted values and
the check then passed. Repro:

    beginProvenance("abc"); s = "abc".replace(/b/u,"BB");   // provenanceFor -> undefined   (right)
    s = tr(s, /c/gu, "C");                                  // provenanceFor -> [[0,1],[1,2],[2,3],[3,3]]

End to end, `phonemizeTrace("<b>Dr.</b> Smith paid $1,250.", "en")` reported `paid` → `" Smi"` and `1,250` →
`"h paid"`. Corpus-wide: **1,478 of 112,640 tokens across 74 of 185 languages** named input characters that
did not contain their own surface. The header claimed that was impossible.

**The fix is to check at ENTRY, not per index.** Checking only the indices actually read is not enough — the
repro touches none of the missing ones. `tr` now requires `p.length === s.length` before it will track, and
drops the mapping permanently otherwise. Coverage fell from a claimed 97.0% to a true **92.8%**; the 4.2%
difference was the wrong answers.

⚠ **And the test could not have caught it.** It asserted `0 <= start <= end <= length`, which all 1,478 wrong
spans satisfy. The replacement asserts CONTAINMENT where normalization changed nothing — and the obvious
alternative ("the surface must appear inside the mapped span") is UNSOUND, because normalization GENERATES
tokens: `an`'s `habitants` maps to `210,59 hab/km²` and `hil`'s `sang` to `sg`, both correct.

### Four more

  * **Code points vs code units.** `beginProvenance` seeded with `[...input]` (code points) while every other
    offset in the trace is a UTF-16 index, so one astral character made the array short — and per the defect
    above, the next step hid it. The replacement loop had the mirror bug. Both now index code units.
  * **`re.lastIndex`.** `String.replace` resets it on a global regex; the traced path built its own and left
    the caller's untouched. `khmer`'s de-grouping loop shares one `/g` regex between `tr` and `.test()`.
  * **A second source scanner went blind.** `tools/normalization/review.ts`'s `replaceCalls` matched only
    `.replace(`, dropping from 3,743 sites to 614 — an 84% loss, after which its blindness probe reported
    clean because it saw nothing. Restored to 3,825.
  * **Chained tails.** `tr(x, A, B).replace(C, D)` left the tail untracked; 63 sites in 45 files rewritten to
    `tr(tr(x, A, B), C, D)`. ⚠ Measured afterwards: coverage did NOT move, so these were not the binding
    constraint — the registry pre-passes are.

### The ceiling, stated precisely

`getPhonemizer`'s wrapper runs `stripMarkup`, the confusable/fullwidth folds, Roman numerals and the
vulgar-fraction fold BEFORE any normalizer, and none reports. A LENGTH-PRESERVING pre-pass is harmless
(`foldNativeDigits`: `１`→`1`, one for one) and a LENGTH-CHANGING one desyncs:

    phonemizeTrace("Dr. Smith paid １２５０", "en")   every token mapped
    phonemizeTrace("<b>hi</b> there", "en")         none mapped

That is the remaining 7.2%, and closing it means instrumenting ten fold functions in `core/unicode.ts` and
`markup.ts`, each with its own shape. Left undone deliberately: it is a coverage limit, and with the entry
check in place an unreported step now costs an ABSENT span rather than a wrong one.

## Run 8 — the C# port, where the seam is better and the rule is the opposite

⚠ **The port needed no change under `Languages/`.** The TS normalizers call `s.replace(re, rep)` — the STRING
is the receiver — so there was no single place to instrument and 3,203 sites had to be rewritten. The C# calls
`RE.Replace(s, rep)` — the JsRe is the receiver — so all 2,280 normalizer sites already funnel through two
methods on one type. Instrumenting `JsRe.ReplaceAll` (and writing out the single-match path, which had been
delegating to `Re.Replace(input, rep, 1)`) covers the fleet.

### ⚠ And that breadth inverted the rule about a length mismatch

The TS treats `p.length !== s.length` as a MISSED STEP and poisons, because `tr` is only ever called by a
normalizer on the pipeline string. Doing the same in C# destroyed the mapping for most of the fleet, and the
first offender named itself:

    POISON entry: prov=22 input=8
      Provenance.StartTrack -> JsRe.ReplaceAll -> Initialisms.MakeUnreadableTest
      -> English.Normalize..cctor()

A **static constructor** building a lookup table, through the same shared method. Here a mismatch usually
means "a different string", not "a step went unseen", so it is IGNORED.

⚠ **Ignoring is still safe, and the reason matters:** completeness is enforced at the END, not per call. The
array is never REBUILT over a shifted string — it simply stops being updated — so a genuinely missed pipeline
step leaves `For(normalized)` disagreeing on length and the mapping is withheld. What must never happen is
the rebuild, which is exactly the TS defect Run 7 fixed. Same guarantee, opposite local rule, because the
seams have different breadth.

### Coverage, and an asymmetry worth recording

    C#   99.4% of tokens carry an InputSpan (28,203 of 28,386)   0 out of range   2 languages partial
    TS   92.8% (36,656 of 39,506)                                0 out of range

⚠ **The C# is BETTER, and for a structural reason:** `JsRe.Replace` also carries the registry pre-passes
(`stripMarkup`, the confusable and fullwidth folds, Roman numerals), which the TS rewrite deliberately did not
touch — those are the TS's remaining 7.2%. `phonemizeTrace("<b>hi</b> there", "en")` maps nothing in TS and
maps both tokens in C#. Closing the TS gap means either instrumenting those ten fold functions or moving the
TS seam to match this one; the second is now the more attractive option and was not obvious before the port.

Gates: parity 136 languages / 26,827 rows / 0 differ · goldens 0 rows changed · dotnet test 2,751 · TS 5,719.

## Run 9 — review of the port: LENGTH IS NOT IDENTITY, in both engines

Two defects, one root cause, and the TypeScript had the same hole.

⚠ **A net length-preserving step outside the seam passed the completeness check.** `Mandarin.SubstituteNumbers`
rewrites a code-point list rather than going through `JsRe.Replace`, and its edits cancel out — `115`→`一百一十五`
is +2, each `10`→`十` is −1 — so a stale identity mapping survived and reported a token as coming from a SPACE:

    input  115 10 10 中国        normalized  一百一十五 十 十 中国      (both length 12)
      十  norm[6,7)  ->  src [6,7) = " "        should be [4,6) = "10"

In range, and therefore invisible to a bounds assertion.

⚠ **And a string that merely SHARED a length was adopted.** `Initialisms` runs
`CLASS_BRACKETS.Replace("[aeiouy]", "")` inside a STATIC INITIALIZER — eight characters — so any pipeline
string of length 8 took its six-entry result over the real mapping. Every language had its own poisoned
length, once per process, on the first COLD trace. `phonemizeTrace("hi there", "en")` lost every span;
the same call made second in the process was fine.

**The fix is to track the STRING, not its length** — `tracked` beside `prov`, compared on entry, at commit and
in `For()`. Applied to both engines, since the TS shared the defect. O(n) and only on the traced path.

    TS   92.8% -> 88.9%      C#   99.4% -> 97.6%      out-of-range: 0 in both

Those deltas were wrong spans passing a length-only check, exactly as in Run 7.

⚠ **And neither existing test could see either defect** — the bounds test admits any in-range hull, and the
containment test only runs where normalization is a NO-OP, i.e. precisely where the mapping cannot be wrong.
The xunit suite additionally could never see the second one: it shares a process, so the static initializers
were already warm by the time it ran. New tests in both engines cover the `cmn` numeral case and the
length-8 collision, and the TS one was verified to FAIL against the pre-fix code.

## Run 10 — the TS pre-passes, and why the seam must stay narrow

The C# port's coverage lead came from `JsRe.Replace` also carrying the registry pre-passes. PR #1155 first
claimed closing the TS gap might mean "moving the TS seam to match"; measured, that was backwards — the ten
fold functions carry **19 `.replace` sites between them**, while moving the seam would mean introducing a
JsRe-style wrapper across a codebase that uses native `String.replace` everywhere.

Converting those 19 (plus `roman.ts`'s one, which runs outside `foldPass`) lifted TS coverage
**88.9% → 92.1%**, and made the case that previously mapped nothing map everything:

    phonemizeTrace("<b>hi</b> there", "en")     before: neither token     after: both

### ⚠ And a blanket conversion broke English, which is the lesson

`foldLatinDiacritics` lives in the same file, has the identical `return s.replace(...)` shape, and is
**called per word from `resolveWord`**. Routing it through `tr` poisoned the mapping on every utterance:

    POISON: tracked="doctor Smith paid 1,250 dollars."  s="doctor"
      at foldLatinDiacritics (unicode.ts:108) <- resolveWord <- EnglishPhonemizer.text

Only functions that transform the PIPELINE STRING belong on this seam. That is the same "input-side only"
boundary the engine files taught in Run 6, reappearing inside `core/` where the shapes are indistinguishable
by grep — and it is why the two engines take OPPOSITE rules for a length mismatch: the TS seam is narrow, so
a mismatch means a step went unseen (poison); the C# seam is the shared `JsRe.Replace`, so a mismatch means a
different string (ignore).

    TS  92.1%   ·   C#  97.6%   ·   out-of-range 0 in both

The residual TS gap is now the languages whose normalizers do something other than `replace`, not the
pre-passes.
