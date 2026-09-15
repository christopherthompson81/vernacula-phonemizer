# A space-guarded dash, across the fleet

Reported against English: space-guarded hyphens, en dashes and em dashes should
introduce a pause and did not. Fixed for English in #1309; this is the same
defect measured and fixed for the other 188 languages.

## Run 1 — 2026-09-15 18:55 — how wide is it?

**Command.** For every language, compare `"aba - ebe"` against `"aba, ebe"` and
count only the languages that mark a comma as a pause at all.

**Raw finding.**

```
languages: 189
  a comma marks a pause: 188   (dash also pauses 9, dash DROPPED 179)
  a comma marks NOTHING: 1  lo
```

**Implication.** The same six characters are wrong in 179 files, which is the
argument `core/separatorHygiene.ts` already makes for fixing a class rather than
a language. And the measurement licenses the REMEDY as well as the diagnosis: the
question "is a comma the right mark here" was asked of each engine directly, and
188 answered yes, so the rewrite produces a pause in each of them by
construction. `lo` drops the comma exactly as it drops the dash today.

The rule spends a SEPARATOR and speaks no word, which is what makes a shared rule
legitimate: a connective ("to", "hanga", "minus") is vocabulary, and no shared
pass may put a word into a language whose vocabulary it does not know.

## Run 2 — 19:10 — the first version destroyed a word in 17 languages

**Question.** English's rule claims everything except digit-on-both-sides. Is
that safe fleet-wide?

**Command.** Render six dash shapes in all 189 languages before and after, and
keep every language that LOST a token.

**Raw finding.** No.

```
cs   `aba - 28.7`  before: ˈaba mˈiːnus dvˈat͡sɛtosm …   after: ˈaba , dvˈat͡sɛtosm …
om   `10ffaa - 11ffaa`  reads its own range word *hanga*
```

17 languages, every one the same shape: a MINUS or a range connective, with a
NUMBER on the right of the dash. The suite caught two of them (om, ug); the probe
found the rest.

**Implication.** Refusing a digit on the right leaves every minus and every span
to the language that reads it, and costs only the `page - 5` shape, which no
language in the fleet reads as anything today. One arm, one condition.

⚠ **This corrected a claim I had made about English.** I believed English had
regressed its own minus reading in #1309. Rendering the same shapes at the commit
before it showed `the temperature - 28.7` dropping the sign both before and
after: English has no spaced-minus reading to lose, which is why it can afford
the more permissive rule it has, and why it opts out here.

## Run 3 — 19:30 — the goldens are the corpus

**Question.** Six synthetic shapes cannot cover 189 languages' conventions. What
does the change do to real text?

**Command.** `check-goldens --show 200` over all 36,495 rows, bucketing every
stale row by whether its only difference is the inserted pause.

**Raw findings, in the order they were found and fixed:**

```
1368 findings   1273 only the comma    95 residual
   · 47 rows: a full stop DOWNGRADED to a comma. The bibliographic style
     `Чебоксары, 2004. – 215 с.` puts a spaced dash straight after a sentence
     mark, and the engine collapses the pair. Where a pause already exists there
     is nothing to add → guard on the left, then symmetrically on the right.
1302 findings   1275 only a pause     27 residual
   · ug 17: `1957 -، 1976 - يىللاردا` loses its ORDINAL year reading
     (ʔɑltint͡ʃi → ʔɑltɛ, "seventy-sixth" → "six")
   · hmn 2: loses its range connective *mus txog*
   · kaa 1: loses a prefix minus
     → these three read the dash as a WORD and opt out
   · ki 1: NOT a regression — Kikuyu's own pause mark is `.`, so the added pause
     reads as a full stop. Counted as residual only by the classifier.
1210 findings   1208 only a pause      2 residual
   · crh, nci: a `?` separated from the dash by a closing quote or bracket
     (`"…Christmas?" - Band Aid`) → the guard must look PAST closing marks
1204 findings   1203 only a pause      1 residual
```

⚠ **A POSITIVE LOOKBEHIND CANNOT EXPRESS THIS GUARD.** `[^pause][closing]*`
matches `?"` by letting the closing run go empty and testing the quote, which is
not a pause mark — so the guard passed and claimed the dash anyway, and the
measurement did not move. It is a NEGATIVE lookbehind for that reason.

**⚠ The one row not fixed,** recorded rather than papered over: crh
`(1891 – 1938 (?) ) – belli` puts a SPACE between two closing brackets, which
breaks the closing run, so that row downgrades a `?` to a pause. One row in
36,495. Widening the guard to skip spaces would let it reach back across
arbitrary distance, which costs more than the row is worth.

## Run 4 — 20:05 — the port, and a drift the parity harness caught

`csharp/tools/parity` failed on Uyghur after the goldens were regenerated: the
opt-out list had been extended in TypeScript (hmn, kaa, ug) and not in C#, so the
port still spent the dash there. **A hand-maintained list duplicated in two
languages is a drift hazard**, and this is the second kind of thing in this tree
that only a cross-implementation gate can see.

⚠ **The differential does not cover this pattern.** `tools/extract_regexes.mts`
reports "12 unparseable, dropped", and the new literal is one of them — it
contains `"` and `'` inside a character class, which defeats the extractor's
string-stripping, so no `\u2026` row reaches `regex-corpus.jsonl`. What covers it
instead is stronger for this particular rule: `csharp/tools/parity` renders all
36,495 golden rows in both implementations and compares them byte for byte, on
real text in 189 languages rather than on a synthetic probe set.

**Final state.**

```
TS 5883 pass   C# 6654 pass   regex-diff 142982 probes 0 DIFFER
goldens: 94 files, 1204 insertions, 1204 deletions, no row added or dropped
goldens fresh: 189 languages, 36495 rows, 0 stale
189 languages byte-identical, 0 differ (36495 rows ok)
```
