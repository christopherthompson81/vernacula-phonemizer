# Portuguese manifest lift — investigation log

Second of the `letterNames` sweep, taken next because it also answers whether **pt-BR** is cheap to port —
the last open question from the accent-variant work.

## Run 1 — 2026-08-25 00:10 — the pt-BR question, answered first

**Question.** Does the C# Portuguese engine carry the `dialect: "bp"` mode pt-BR needs?

**Command.** `grep dialect csharp/.../Portuguese/*.cs`

**Finding (raw).** Yes, throughout — `G2p.ToSegments(word, dialect)`, `G2p.Sibilants(segs, dialect)`,
`Portuguese.Realize(segs, stress, dialect)`, and `CreatePortuguese(string dialect = "ep",
Func<string,string,string>? postWord = null)` already takes both arguments pt-BR supplies. The open/close
lexicon `data/languages/portuguese-br/pt-br-openclose.tsv` is in the repo and `LoadTsv` exists.

**Implication.** pt-BR is ~35 lines, like es-419 — not the deep fork the "engine MODE" classification
suggested. The classification was right about the SHAPE (it is a mode, not a substitution) and wrong to
imply cost. Recorded so the next reader does not price it from the shape.

## Run 2 — 2026-08-25 00:22

**Question.** What is inline in `pt`?

**Finding (raw).** The same census as `es`, minus two: months, 22 dotted abbreviations, letter names,
phonotactics, three ordinal tables plus the thousandth, the suppletive fraction denominators, the feminine
one, the clock nouns, era markers, `número`, the degree words, the real, the dollar codes, nine sign words,
and the whole symbol tier. 15 new keys.

**Two keys Spanish has and Portuguese must NOT**, both deliberate absences:
- no `ordinals.teens` — Portuguese composes them regularly (`tens[1]` + a unit → *décimo primeiro*), so a
  table would be a second way to say the same thing.
- no `fractions.numeratorOne` — Portuguese does not apocopate before the fraction noun (*um quinto*), where
  Spanish needs *un* against its own *uno*.

Both are asserted as absences in the coupling tests, so a later "make pt match es" cannot quietly add them.

## Run 3 — 2026-08-25 00:35

**Command.** 143-line probe; Node before (stashed) vs after, for `pt` and `pt-BR`, sync and async.
**0 of 143 moved in all four.**

## Run 4 — 2026-08-25 00:41 — the sweep

```
symbols.units 17  dottedAbbrev 14  ordinals.units 12  clock 8  currency 7  numberSign 6
ordinals.tens 5  phonotactics.vowels 5  eraMarkers 4  degree 4  feminineOne 3
fractions.denominators 3  phonotactics.onsets 3  phonotactics.codas 3  ordinals.hundreds 2
ordinals.thousandth 2  realWord 2  dollarCodes 2  letterNames 1
signWords: plusMinus 2 · plus 3 · minus 1 · ampersand 2 · equals 1 · lessThan 1 · greaterThan 1 · times 2 · dividedBy 1
symbols: percent 1 · exponentWords 2 · magnitudes 1 · magnitudeConnective 2 · bareExponent 2/1/1/1
months  ── 0 in pt, 12 in pt-BR
```

**`months` is variant-gated again** — the second language in this sweep with that shape, after `es`. Brazil
says *primeiro de julho*; Portugal normally *um de julho*, which the number path says anyway. A sweep against
`pt` alone scores it dead.

**`phonotactics.codas` swept 0 and needed a specific probe shape.** Portuguese words essentially never end in
a two-consonant cluster, so the coda test cannot bite on native vocabulary — and most entries in the `codas`
list are vowel+s pairs (`is`, `us`, `as`), which the test skips because the first character is not a
consonant. It took borrowed-shaped all-caps acronyms (`ROBUST`, `FAST`, `INPUT`, `GRAND`) to reach it. Then 3.

## Run 5 — 2026-08-25 00:58 — a KNOWN DEFECT the lift surfaced but did not cause

```
1 °C apenas.  →  ũ ɡɾˈawʃ sɛɫsˈiwʃ ɐpˈenɐʃ .
```

*um **graus** Celsius* — the degree noun is emitted PLURAL whatever the count. Pre-existing: the rule has
always written the plural literal, and lifting the word to `degree.word` moved the word, not the missing
agreement.

**Deliberately NOT fixed here.** A fix changes readings, which would muddy this PR's "0 of 143 moved", and it
has to go TypeScript-first with a test and regenerated goldens. Asserted in both coupling tests as a known
defect rather than as correct behaviour, so it is visible in the suite and not only in this doc — when it is
fixed, that test is what says so.

## Run 6 — 2026-08-25 01:06 — the all-caps-document trap, which this file documents and I still hit

`say("O CD")` returned `o kd` — the initialism pass had not run. "O CD" is entirely uppercase, which trips
`initialisms.ts`'s all-caps-DOCUMENT guard and skips the pass outright.

⚠ `portuguese.ts` ALREADY RECORDS THIS TRAP, in the note explaining why the `US$` currency key was once
believed verified: *"the 'verification' had used an all-caps probe string, which trips initialisms.ts's
all-caps-document guard and skips the pass."* I wrote a probe with the same defect two screens below the
comment warning about it. Fixed with a lowercase context (`o CD tocou`), and the reason is now in the test.

## Run 7 — code sabotage

- ordinal `tens` read from `units` (the composed teens break) → **fails** ✓
- `realWord` back to a literal → **fails** ✓
- clock connector back to a literal `"e"` → **passes**, and cannot do otherwise: the literal equals the
  manifest value, so nothing observable separates them. Same limit the es lift recorded for `a. m.`; the
  sweep is what holds it (`clock` moves 8). Noted in the test.

## Result

`portuguese.jsonc` +15 keys. 0 of 143 probe readings moved across `pt` and `pt-BR`, sync and async; 286
C#-vs-Node readings identical for `pt`, 0 threw. ⚠ pt-BR is not ported to C# — the parity gate now names it
on every run. 56 languages / 11,200 rows / 0 differ; 404 C# tests, 5,057 TS tests.

## Remaining in this sweep

16: en, fr, ru, jv, tr, it, pl, th, vi, ta, te, kn, hu, nl, ha, cmn.
