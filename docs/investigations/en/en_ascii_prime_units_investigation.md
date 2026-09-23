# en — the ASCII spellings of the prime units (#1449)

#1434 and #1435 fixed the typographic `′`/`″`. The ASCII `'`/`"` — what keyboards actually produce —
were not covered, and `0.015"` **silently drops the unit**.

The obvious fix is to add `'` and `"` as `UNIT_RE` keys, which already requires a preceding number. This
log measures whether that guard is enough. **It is not, and the measurement inverts the fix.**

## Run 1 — 2026-09-23 — every digit+quote in a real English corpus is a FALSE POSITIVE

FLEURS `en_us`, 3,643 transcript lines. Every occurrence of a digit followed by `'` or `"`:

```
7'  ×4     it was a perfect day for 7's rugby.            ← POSSESSIVE, not feet
8"  ×2     known as "cosmonaut No. 11", was part of…      ← CLOSING QUOTE
1"  ×2     a decal reading "18" and makes their sale      ← CLOSING QUOTE
6"  ×1     start trading on July 1, 2020".                ← CLOSING QUOTE
0"  ×1     correspondence dated 4th July 1776". The text  ← CLOSING QUOTE
```

⚠ **TEN OF TEN ARE WRONG. There is not one genuine foot or inch mark in the corpus.** A rule keyed on
digit-adjacency alone would have fired ten times and been wrong every time — turning a silent drop into
an audible corruption, which this normalizer ranks as the worse trade (`6′2″` → "6 SQUARE FEET" is the
same class, recorded at `COMPOUND_MEASURE`).

That is the opposite of the conclusion I would have drawn from the issue text, which reasoned about the
ambiguity but did not count it.

## Run 2 — which shapes ARE safe

Re-running the same corpus against narrower candidate guards:

```
a DECIMAL followed by a quote   \d+\.\d+["']     0 occurrences   ← safe
the COMPOUND  N' M"             \d+'\s?\d+"      0 occurrences   ← safe
a digit followed by  '          \d'              4, ALL `7's`    ← unsafe
a bare INTEGER followed by  "   \d"              6, ALL quotes   ← unsafe
```

So the admissible subset is:

1. **The compound `6' 2"`** — a foot mark and an inch mark together. Unambiguous: no English
   punctuation produces that shape, and it is the commonest way a height is written.
2. **A DECIMAL followed by `"`** — `0.015"`. A quotation that ends in a decimal fraction is vanishingly
   rare; the corpus has none, and the issue's headline case is exactly this shape.

And the refusals, each with the counterexample that earns it:

3. ⚠ **A bare `'` after a digit is NOT a foot mark** — `7's`, `the 90's`, `'90s`. Refused outright.
4. ⚠ **A bare integer + `"` is NOT an inch mark** — `"18"`, `"cosmonaut No. 11"`. Refused outright,
   which costs `a 2" pipe`. That is a real loss and it is the right trade at 6 counterexamples to 0.

⚠ **THE BALANCE TEST IS THE RULE THAT WOULD CLAIM CASE 4 AND IT IS NOT AVAILABLE HERE.** Counting the
`"` before the position and firing only on an even count would separate `"18"` from `2"` correctly. It
needs the whole string at the callback, which the TypeScript gives (`offset`, `string`) and .NET's
`MatchEvaluator` does NOT — `Match` exposes no input. A port-divergent guard is worse than a narrower
one, so the balance test is recorded here as the way to widen this later, not taken now.

## Run 3 — 2026-09-23 — implemented, and the probe caught a regression a test would not have

Two rules, in this order, both after `DMS_COORDINATE` and `FEET_INCHES`:

```
FEET_INCHES_ASCII    (\d+(?:\.\d+)?)'[ \t ]?(\d+(?:\.\d+)?)"     the self-guarding pair
INCH_DECIMAL_ASCII   (\d+\.\d+)"                                       the decimal point is the guard
```

```
0.015" total      ->  "0.015 inches total"
he is 6' 2" tall  ->  "he is 6 feet 2 inches tall"
a 6' 2.5" board   ->  "a 6 feet 2.5 inches board"    ← compound first, or the decimal strands the feet
```

and every corpus false positive is untouched: `7's rugby`, `a decal reading "18" and`, `"5" is the
answer`, `the 90's`, and the named cost `a 2" pipe`.

### ⚠ AND THE SHAPE PROBE CAUGHT A REGRESSION I HAD JUST INTRODUCED

`tools/normalization/en-shape-equivalence.mts` went 8 → 6 failing and then reported a NEW disagreement:

```
40°26'46"N   ->  "40 degrees 26 feet 46 inchesN"        ✗ mine
40°26′46″N   ->  "40 degrees 26 minutes 46 seconds north"
```

The ASCII coordinate had nothing in front of it — `DMS_COORDINATE` matched only the typographic primes,
so `FEET_INCHES_ASCII` claimed `26'46"` and read it as feet and inches. ⚠ **That is worse than the
half-normalized string it replaced**, because a wrong unit is louder than a surviving symbol — the same
trade `COMPOUND_MEASURE` records for `6′2″` → "6 SQUARE FEET".

`DMS_COORDINATE` now takes `[′']` and `[″"]`. ⚠ **The `°` is what makes the ASCII form safe there**, while
a bare `6' 2"` needs the pair to self-guard: a degree sign followed by digits and a quote is not a shape
English punctuation produces.

**No test would have found this.** The equivalence probe found it because it asks a question no
hand-written assertion does — *do these two spellings of one thing agree?* — and the ASCII coordinate was
a row in it precisely because #1434 had been fixed on the typographic spelling only. The probe built two
PRs ago paid for itself on the PR after next.

### Remaining probe failures, unchanged and unfiled

```
a 2" pipe      vs  a 2″ pipe       ← the named cost, refused on corpus evidence
a 6' span      vs  a 6′ span       ← bare `N'` refused: `the 90's`, `7's`
2-5 inches     vs  2–5 inches      ← ASCII hyphen range, a weaker signal than an en-dash
.002-.005      vs  .002–.005       ← same
wait…          survives            ← the ellipsis, no pause
```

## Run 4 — 2026-09-23 — ⚠ #1435 HAD ALREADY REFUSED THIS CLASS, IN A PINNED TEST, WITH REASONING

`test/english-prime-marks.test.ts` and its C# twin both pinned `0.015"`, `5'` and `5' 6"` as **left
alone**, with a comment:

> *"⚠ THE ASCII QUOTES ARE DELIBERATELY NOT CLAIMED. `"` and `'` are quotation marks and apostrophes far
> more often than they are units, and `5'` in prose is usually a quote — the same reasoning that keeps
> ⟨in⟩ out of the unit table while ⟨µin⟩ is a whole key (#1427)."*

⚠ **THAT REASONING IS CORRECT AND THE MEASUREMENT CONFIRMS IT** — ten of ten corpus occurrences are
apostrophes or closing quotes, which is a stronger statement than the comment made. What the pin got
wrong was its SCOPE: it refused the whole class, and two sub-shapes inside the class carry no ambiguity
at all. The refusal is now evidence rather than reasoning, and it is narrower by exactly two rows.

**So this PR does not overturn #1435's decision; it measures it and finds it over-broad on two shapes.**
The pins keep `5'` and gain `a 2" pipe`, `the 90's` and a real corpus line, so the class-level refusal is
pinned on the cases that earn it rather than on two that do not.

⚠ **AND I DID NOT FIND THE PIN BEFORE WRITING THE RULE.** It failed in the full suite, after the targeted
tests and the shape probe were both green — the third time this session a prior decision surfaced as a
test failure rather than as something I looked for. `grep` for the shape I am about to claim, before
claiming it, is the cheap move I keep not making.
