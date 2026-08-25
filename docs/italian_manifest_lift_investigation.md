# Italian manifest lift — investigation log

Third of the `letterNames` sweep. 22 keys, of which the three that matter most are the ones the sweep is
actually for: `letterNames`, `phonotactics` and `acronymLetters`, which all feed the SAME call site
(`makeInitialismNormalizer`).

## Run 1 — 2026-08-25 04:20

**Finding (raw).** ⚠ **Italian was the only ported language whose acronym list was not in its manifest** — a
bare `new Set(["ia", "ip", "hiv"])` sitting in normalize.ts, beside an inline `letterNames` table and an
inline phonotactics block. Every other ported language declares `acronymLetters` in its jsonc. Three tables,
one call site, all three inline.

Italian also had no `manifest.ts` at all: `italian.ts` declared the shape inline and loaded the file itself,
so normalize.ts would have had to load it a second time. Added one, as de/es/pt/uk have.

## Run 2 — 2026-08-25 04:35 — what Italian does NOT have

Two absences that are deliberate and are now asserted as absences:

- **No tens/hundreds ordinal row.** Italian composes every ordinal above ten from the cardinal
  (venti → ventesimo, ventitré → ventitreesimo), so only the 1–10 irregular head is data. es and pt both need
  full tables; Italian would be storing a second way to say the same thing.
- **`euro` and `yen` have identical singular and plural** — they are INVARIABLE in Italian (Accademia della
  Crusca), so the repeated word is the fact, not an oversight. Noted in the jsonc so a later "deduplication"
  does not collapse the pair.

And one thing Italian has that es and pt do not: **the relational readings carry the copula** — `è uguale a`,
not `uguale a`. That is sourced, not stylistic: the register tier's Italian arithmetic prose writes the full
predicate between operands ("tre volte un quarto è uguale a un quarto di tre", "39 non può essere diviso per
15").

## Run 3 — 2026-08-25 04:50 — the sweep, and a key I declared but never wired

**0 of 115 probe readings moved**, sync and async.

```
dottedAbbrev 18  phonotactics.vowels 9  ordinals 7  symbols.units 7  phonotactics.codas 6
letterNames 5  numberSign 5  fractions.numeratorOne 4  eraMarkers 4  degree 4  compass 4
decimalWord 3  phonotactics.onsets 3  symbols.magnitudes 3  symbols.magnitudeConnective 3
acronymLetters 2  symbols.exponentWords 2  fractions.denominators 1  symbols.percent 1
symbols.currency 1  symbols.currencyStems 1
signWords: plusMinus 2 · plus 3 · minus 1 · ampersand 2 · equals 1 · lessThan 1 · greaterThan 1 · times 2 · dividedBy 1
bareExponent: squared 1 · cubed 1 · power 2 · negative 2
```

**⚠ `ordinals` SWEPT 0 BECAUSE I DECLARED THE KEY AND NEVER WIRED IT.** The table went into the jsonc and the
manifest interface, and `romanOrdinals.ts` kept its own hardcoded `IRREGULAR` right beside it. Not a probe
gap this time — a genuinely dead key, the exact failure the sweep exists to find, and invisible to every test
because the data agreed. Wired; now 7.

`phonotactics.onsets`/`codas` swept 0 on the first pass, and that WAS a probe gap: it took the loanwords the
jsonc's own comment names (`SPORT`, `TEST`, `FILM`, `ROCK`, `TREND`) to reach them, because those are exactly
the words whose legal two-consonant codas keep them from being spelled out. Then 3 and 6.

## Run 4 — code sabotage, four ways

- `acronymLetters` back to a bare set with `hiv` dropped → **fails**
- `letterNames` wired to the wrong manifest key → **fails**
- `codas` emptied, so the loanwords get spelled letter by letter → **fails**
- `ordinals` re-hardcoded in romanOrdinals.ts with `3: "terza"` → **fails**

## Run 5 — the degree defect, recorded and NOT fixed

`1 °C` reads *uno gradi Celsius*. Same shape as the Portuguese defect fixed in #966, including the same
single-digit `(\d)` capture underneath it.

⚠ **Italian needs strictly more than Portuguese did.** The noun must agree (*un grado* / *venti gradi*) AND
the numeral must APOCOPATE before it — *un grado*, not *uno grado* — which the Portuguese fix did not need.
Left for its own change so this lift keeps its "0 moved"; asserted in both coupling tests as a known defect.

## Result

`italian.jsonc` 9 → 22 keys, and a new `manifest.ts`. 0 of 115 probe readings moved; 230 C#-vs-Node readings
identical, sync and async, 0 threw. 60 languages / 12,000 rows / 0 differ; 443 C# tests, 5,065 TS tests.

## Remaining in this sweep

15: en, fr, ru, jv, tr, pl, th, vi, ta, te, kn, hu, nl, ha, cmn.
