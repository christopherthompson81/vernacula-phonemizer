# Spanish manifest lift — investigation log

First of the bulk `letterNames` languages. 18 ported languages still hold a letter-name table inline; Spanish
was taken first because its whole normalization file is compact enough to lift in one pass, as `de` and `uk`
were.

## Run 1 — 2026-08-24 21:30

**Question.** What is inline in `es`, beyond `letterNames`?

**Finding (raw).** `spanish.jsonc` held phonemes, function words and number words. Inline: the month
alternation, 34 dotted abbreviations, the letter names, phonotactics, four ordinal tables plus the thousandth,
the suppletive fraction denominators, the era markers, `Estados Unidos`, `número`, nine sign words, and the
whole symbol tier (percent, currency, 26 units, exponent words, bare exponents, magnitudes).

**Implication.** A full-language lift, not a one-key lift. 21 new keys.

## Run 2 — 2026-08-24 21:38

**Question.** Any word written twice?

**Finding (raw).** One, and it is a composition rather than a copy: `a. m.` / `p. m.` are read in Spanish as
the LETTER NAMES ([a ˈeme], [pe ˈeme]), and the code held `"a eme"` and `"pe eme"` as literals beside a
`letterNames` table containing exactly ⟨a⟩, ⟨p⟩ and ⟨m⟩. Now composed from those three entries.

Two things that look like duplicates and are not, both about "one":
- `fractions.numeratorOne` is **un**, the APOCOPATED form before the fraction noun (*un quinto*, never *uno
  quinto*) — a different word from `numbers.ones[1]`.
- `feminineOne` is **una**, for the clock (*hora* is feminine: a la una). Also not `numbers.ones[1]`.

And `symbols.bareExponent.squared` ("{n} al cuadrado") is not `symbols.exponentWords.squared` ("cuadrado"):
the first is the PREDICATE for a bare power, the second the unit MODIFIER. *veinte al cuadrado* vs *kilómetros
cuadrados*.

## Run 3 — 2026-08-24 21:47

**Question.** Did the lift move any reading?

**Command.** 162-line probe, Node before (stashed) vs after, for **both variants** — `es` and `es-419` differ
on seseo and on the date rule — in sync and async. **0 of 162 moved in all four.**

## Run 4 — 2026-08-24 21:52 — the sweep, and a key that is dead in one variant

**Command.** Sabotage each key, re-probe, count moved readings.

```
dottedAbbrev 22  symbols.units 24  ordinals.units 11  eraMarkers 6  numberSign 5
fractions.numeratorOne 4  currency 4  letterNames 3  feminineOne 3  unitedStates 3
fractions.denominators 3  ordinals.teens 3  phonotactics.onsets 4  ordinals.tens 1
ordinals.hundreds 1  ordinals.thousandth 1  phonotactics.codas 1  phonotactics.vowels 1
signWords: plusMinus 2 · plus 3 · minus 1 · ampersand 2 · equals 1 · lessThan 1 · greaterThan 1 · times 2 · dividedBy 1
symbols: percent 1 · exponentWords 2 · magnitudes 3 · magnitudeConnective 1
bareExponent: squared 2 · cubed 1 · power 1 · negative 2
months  ── 0 in es, 13 in es-419
```

**Finding (raw).** Five keys swept 0 on the first pass. Four were probe gaps, filled by adding round-hundred
and teen ordinals, cluster-legality acronyms (`PLAN`, `TEST`), magnitude+currency adjacency, and a bare cube
and a negative exponent.

**`months` is the interesting one, and it is NOT a probe gap.** In peninsular Spanish the date rule rewrites
`1 de enero` to *uno de enero* — which is what the number path says anyway — and `1º de enero` has already
been consumed upstream by the ordinal-indicator rule. So in `es` the table changes nothing. Only the Americas
branch (*primero de enero*) depends on it, where it moves 13.

**Implication.** A sweep is per-variant. Run against `es` alone it scores `months` dead, and the conclusion
would be wrong. Recorded in both coupling tests.

## Run 5 — 2026-08-24 22:05 — what the C# pass caught

Mirroring the date rule in C# surfaced two literals I had left in the **TypeScript**: `primero de ${mon}` and
`.replace(/1\.?º?/u, "uno")`. Both are manifest values (`ordinals.units[1]`, `numbers.ones[1]`). Porting is a
second reading of the same code by a different route, and it reads what the first pass skimmed.

## Run 6 — 2026-08-24 22:15 — three test assertions wrong, for two different reasons

- `siglo XII` does not contain *duodécimo*: Spanish reads a century as a CARDINAL (*siglo doce*). The Roman
  policy only reaches the ordinal after the nouns it names — `XII aniversario` does.
- `dividido por` and `después de Cristo` failed to match because **Spanish spirantization is post-lexical**:
  a word phonemized standing alone starts with the stop (`diβiðiðo`), the same word inside a phrase with the
  fricative (`ðiβiðiðo`). Folded β/ð/ɣ → b/d/ɡ in the test helper, with a note that the spirantization axis
  is covered elsewhere and is not being deleted here.

**And one code-sabotage that PASSED, correctly.** Re-hardcoding `"a eme"` produces output identical to the
composition while the data agrees, so no assertion in that test can separate them. The guard that actually
holds it together is the manifest-sabotage sweep (`letterNames` moves 3). Stated in the test rather than left
to look like coverage it does not have.

## Result

`spanish.jsonc` +21 keys. 0 of 162 probe readings moved in Node across both variants and both modes; 324
C#-vs-Node probe readings identical for `es`, sync and async, 0 threw. ⚠ `es-419` is NOT ported to C#
(pre-existing, on the deferred golden-less-variant list), so the C# comparison covers `es` only. Parity 55
languages / 11,000 rows / 0 differ; 389 C# tests, 5,049 TS tests.

## Remaining in this sweep

17 ported languages still hold `letterNames` inline: en, fr, pt, ru, jv, tr, it, pl, th, vi, ta, te, kn, hu,
nl, ha, cmn.
