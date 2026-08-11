# si (Sinhala) text normalization — investigation log

Corpus artifact: `tools/corpus/mined/si.jsonc` — si.wikipedia dump, **191,335 paragraphs**, 448 mined
segments (248 hard + 200 sample), `covered 31/35`, `cellsTotal 35` (current, not stale). No FLEURS corpus
for Sinhala, so the artifact IS the corpus and its `counts` are DUMP-WIDE frequencies.

Referee: wikipron `sin_sinh_narrow` (human), 648 words. **No second source wired** (eval prints a
`secondary-source gap` warning; epitran `sin` would corroborate).

---

## Run 1 — 2026-08-11 — baseline: what the engine does to attested forms

Command: `npx tsx tools/normalization/{mine.ts scan,sources.ts,review.ts}` + a hand probe through
`phonemize(s, "si")`.

`mine.ts scan` (448 lines):

```
DROP percent   ×31   DROP math-sign ×22   DROP currency ×16   DROP degree ×10
DROP minus     ×8    DROP exponent  ×6    DROP ampersand ×3    FOREIGN ampersand ×3
```

`review.ts`: `[FAIL] normalizer missing` — nothing else runs until the file exists.
`sources.ts`: espeak does **not ship Sinhala at all**, so letter-names and the decimal point report
`[NONE]` from the espeak side; percent/currency/minus/equals/times/ampersand/exponent all `[chk?]`.

Hand probe of the current engine (the defect list this layer exists to fix):

| input | reading | what is wrong |
|---|---|---|
| `12.5` | `d̪ˈoləhə . pˈahə` | the decimal point is a CLAUSE PAUSE — "twelve. five" |
| `2,400` | `d̪ˈekə , hˈat̪ərə sˈijəjə` | the grouping comma is a clause comma — "two, four hundred" |
| `1,001,450` | `ˈekə , ˈekə , hˈat̪ərə sˈijəjə pˈanəhə` | three numbers and two pauses |
| `70%` | `hˈæt̪ːæːw` | `%` dropped |
| `12:30` | `d̪ˈoləhə , t̪ˈihə` | the clock colon is a comma |
| `20°C` | `ʋˈisːə sˈiː` | degree dropped, `C` read as the ENGLISH letter name |
| `$5` | `pˈahə` | sign dropped |
| `120 km/h` | `sˈijəjə ʋˈisːə ˈʊkm ˈeᶦt͡ʃ` | trap 47 exactly — raw `km` + the English letter H |
| `50 km²` | `pˈanəhə ˈʊkm skwˈɛɹd` | and the English word *squared* |
| `10¹⁵` | `d̪ˈahəjə` | the whole exponent vanishes |
| `Y = 0.25` | `wˈaᶦ bˈind̪uw . ʋˈisipˌəhə` | `=` dropped; `0.25` → "zero. twenty-five" |

Baseline referee: **606/648 (93.5%) folded backbone**, symbol accuracy 98.3%.

**Implication.** Every one of these is in this layer except the last column of row 8/9 (`km`), which is a
missing tier declaration. Write the layer.

---

## Run 2 — 2026-08-11 — the biggest defect is not in any cell: ZWJ splits every conjunct

Question: the `zero-width` cell counts **144,214** occurrences — the largest count in the artifact by a
factor of two over `digit-run`. Is that noise, or is it load-bearing?

Census over the 448 mined segments: **ZWJ (U+200D) ×1,978, ZWNJ (U+200C) ×258, ZWSP (U+200B) ×22**. Of
the 1,978 ZWJ, **1,841 immediately follow a virama ්** — i.e. they are the ordinary Sinhala conjunct
(rakaransaya `්‍ර`, yansaya `්‍ය`, repaya `ර්‍`), not stray markup.

`sinhala.ts`'s word token is `[඀-෿]+`, and **U+200D is outside that range**, so every conjunct is two
tokens:

```
ක්‍රි      → k rˈi        (should be krˈi)
ශ්‍රී      → s rˈiː       ← the country's own name
ප්‍රතිශතය  → p rˈat̪isˌət̪əjə
මිශ්‍ර     → mˈis rˈə
```

With the joiner removed the same words read correctly (`ක්රි → krˈi`, `ප්රතිශතය → prˈat̪isˌət̪əjə`), because
in Sinhala **ZWJ only selects the ligature glyph — it never reorders the letters**, so stripping it is
phonemically lossless and re-joins the token.

**Implication.** This is the single highest-traffic defect in the language and it is a pre-tokenizer
text→text rewrite, which is exactly what this layer is. It is *not* in any defect class the scan hunts:
the leak classes look for a surviving digit/mark and the DROP test looks for a symbol that says nothing —
a ZWJ says nothing *and should say nothing*. What it does is split a word, and no gate in the tree looks
for that.

---

## Run 3 — 2026-08-11 — the word order: Sinhala puts the measure BEFORE the number

Question: the shared symbol tier can only postpose a unit/currency word (trap 47, case 2). Which side does
Sinhala write?

Corpus (`w.ts` window-grep over the 448 segments) — every attested instance is measure-first:

```
වර්ග කිලෝමීටර් 1,001,450   (වර්ග සැතපුම් 386,660)      මිලිමීටර් 2,400 ක්
කිලෝමීටර් 7,517ක            සෙන්ටිමීටර් 50ක (අඟල් 8)     කිලෝග්‍රෑම් 300 (රාත්තල් 650)
ග්‍රෑම් 75                   මීටර් 400                   ඝන සෙන්ටිමීටර 200 ක් (200 cm3 / 200 cc)
```

and the same for the percent word, which is `සියයට` — **4/4 in the corpus and 4/4 on the wiki probe, all
prefix**:

```
සියයට 4.8 ක    සියයට 88කට    සියයට 95 කට    සියයට 7 ක්
wiki: සියයට 50.6 සිට 49.4 දක්වා · සියයට 16.5 කින් · සියයට 65ක් · සියයට 12.1ක්
```

⚠ **`ප්‍රතිශතය` ×11 is NOT the percent word** — it is the abstract noun *proportion*, and the corpus proves
it by writing both at once: `88.8% ක ප්‍රතිශතයක්`, `49.2% ක ප්‍රතිශතයක්` ("a proportion of 88.8%"). Picking
by raw count would have picked the loser. Trap 37.

Currency, from `attest.ts --lang si`: `ඩොලර්` and `රුපියල්`, also prefix and also in a monetary slot —
`ඩොලර් 38,100ක්`, `රුපියල් මිලියන 50 ක`, and the corpus supplies the abbreviation itself:
*"රුපියල යන්න කෙටියෙන් දක්වන්නේ රු. (Rs)"* — "the rupee is abbreviated රු. (Rs)".

`දශම` is attested as the decimal point in a definitional sentence — *"… හෝ දශම තිතකින් ඇරඹී …"*, "…or
beginning with a decimal point" — plus `දශම වර්ගීකරණය` (Dewey **Decimal** Classification) and
`දශම රූපාකාරයෙන්` ("in decimal form").

**Implication.** The tier already has all three switches — `percentPrefix`, `currencyPrefix` and
`unitPrefix` (the Swahili case) — so none of that has to be local, which was the first guess and was wrong.
What IS local is the RATE: `පැයට කිලෝමීටර 250` puts a DATIVE-suffixed denominator at the head of the phrase,
and `unitPer` is one invariant string between two nouns. Trap 47 case 1, not case 2.

---

## Run 4 — 2026-08-11 — the layer, and what the gates said

Rules written, in order: joiners+`&nbsp;` → dotted abbreviations (closed list) → Sinhala-letter initials →
thousands de-grouping → degrees → negative → rate → the shared tier → the decimal point → re-strip.

```
npx vitest run                                        233 files, 3,360 tests
npx tsc --noEmit                                      OK
npx tsx tools/normalization/mine.ts scan --lang si    no defects   (was 8 classes, 96 hits)
npx tsx tools/normalization/review.ts --lang si       checklist clean
corpus-diff compare                                   changed 381/447 (85.2%), DROP 85 → 33
npx tsx tools/referee-eval/eval.ts si                 606/648 → 607/648
```

**The referee barely moves, and that is the expected result rather than a disappointment.** `eval.ts`
phonemizes si through `phonemizeWord`, which is the WORD path; the joiner defect is a TOKENIZER defect and
lives on the text path. Checked directly: the referee list carries 25 ZWJ-bearing words and
`phonemizeWord("අවුරුද්‍ද")` was already correct, because the abugida g2p skips the joiner — only the
tokenizer split on it. So the corpus diff is the instrument that can see this change and the referee is not.

### Three things the run found that the plan did not

**1. The measure word leads, so `mg` had to be withdrawn after being declared.** `mg` is ×9 in the mined
segments — a healthy count — and **all nine are inside a rate** (`126 mg/dl` ×4, `14.6 mg• L⁻¹` ×2,
`1.9mg/cm3`) whose denominator has no sourced Sinhala reading. With the key declared, `unitPrefix` moved the
number in front of a denominator the tier could not claim: `126 mg/dl` → *මිලිග්‍රෑම් 126/dl*. Trap 46's
"withdraw the key where it buys nothing", found by reading the reading rather than the count.

**2. `NOT_VERSION` costs eight metre readings and saves two.** Bare `m` is ×12 digit-adjacent: 10 metres, 2
the English million-suffix (`SDR69.5m (US$100m)`). The tier's version guard rejects a one-letter key glued to
a dotted number — which is both of the millions AND eight of the ten metres (`2.5m දිගින්`, `1.397m හා
0.508m`, `3.29m`, `9.75m`, `2.5m X 2.5m`). So both sides are paid for locally: the currency-glued `m` becomes
`මිලියන` before the tier, and the dotted-number-glued `m` becomes `මීටර්`, guarded on there being no Latin
letter before the number — which is exactly what separates `SDR69.5m` from `2.5m`.

**3. The rate rule must move the NUMBER, and must claim a whole RANGE.** Rewriting only the unit left
`120 km/h` as *120 පැයට කිලෝමීටර්* — operands in the wrong order, and unrepairable by the tier afterwards
because the unit is no longer number-adjacent. Capturing a single operand then produced
*35-පැයට කිලෝමීටර් 40*, tearing a range in half. Both are trap 14's fix shape.

### The measured refusals

| class | count | why not |
|---|---:|---|
| ranges | 6,900 (dump) | Sinhala writes its own connective — `9.1–9.3 අතර`, `115 –135 අතර`, `60°-75° අතර` — so a `සිට…දක්වා` rewrite says it twice. The dash's other mined uses are a date, a page range, a score, a season and a song title. |
| clock `NN:NN` | 2,921 (dump) | mostly NOT a clock: a Bible verse (`1 කොරි 15:14`), a citation (`1964:189/193/197`), against three timestamps inside one astronomy worked example. Sinhala also writes the time with a PERIOD (`8.30 AM`), character-identical to a decimal. |
| `=` | 700 (dump) | every mined instance is a glossary/table separator or a definition heading (`මාමා = මාමා`, `|alt=`); the two flanking a number are variable assignments. |
| `×` | — | all six mined are a DIMENSION CROSS after `මිලිමීටර්` (`8.2×6.3×0.6`), which is "by", not "times"; `ගුණිත` ×0. |
| fractions | 1,078 (dump) | diluted the same way `abbrev` is — the mined `N/M` are a cricket score, a season, a date, an aperture and a shutter speed. Genuine ones are `1/4 කි`, `1/50 කි`, `¼ කි`. |
| `±` `<` `>` `÷` | ×0 each | no sign and no word. |

### The trap-2 instance of the run

`abbrev` is 29,394 in the dump and **that is mostly a sentence period with no space after it** —
`ය.කොරල්පර`, `වේ.තව`, `රටකි.විවිධ`. A shape rule would have read thousands of clause boundaries as
abbreviations. The initials rule therefore requires **two** dots in the run, measured at
**20 matches, zero false positives** over the 448 segments, and everything else is a closed list.

### Not a normalization defect, found on the way

`ං` before a SIBILANT fell to the ම් default, so `අක්ෂාංශ` read *ˈakʃaːmsə*. wikipron's one ං+sibilant word
refutes it — `පංසු = p ə ŋ s u` against the engine's *pˈamsu*. Fixed in `sinhala.jsonc` (a fourth anusvara
class), **606/648 → 607/648**, no word lost. It mattered here rather than later because the degree rule now
emits `අංශක` for every `°`, so the gap would have been *introduced* into a high-traffic reading instead of
merely inherited.

**Still open, and out of this layer:** ශ/ෂ/ස all read `s` where the referee has `ʃ` (`බංගලාදේශය`). That is a
phoneme-inventory decision, and `eval.ts` prints a standing `secondary-source gap` warning for si — epitran
`sin` would be the second opinion it needs.

---

## Run 5 — 2026-08-11 — the review pass: probe the adversarial neighbour of every rule

Trap 8 says a rule is correct exactly where you looked. Thirty-three probes, of which three found a defect:

| probe | before | after |
|---|---|---|
| `ස්කන්ධයෙන් .9% ක්` | `…ස්කන්ධයෙන් . සියයට 9 ක්` — a spurious SENTENCE BREAK | `සියයට 0 දශම 9` |
| `90.20 K (−182.95 °C…)` | the kelvin dropped, the sentence half-read | `කෙල්වින් 90 දශම 2 0 (සෙල්සියස් අංශක ඍණ 182 දශම 9 5…)` |
| `ක්‍රි.ව.1940 දී` | `ක්‍රිස්තු වර්ෂ1940` — the expansion glued to its year | `ක්‍රිස්තු වර්ෂ 1940` |

**The truncated decimal is the interesting one, because the guard is the whole rule.** `.9%` writes `0.9%`
without its zero. There are 13 dot-before-digit hits in the mined segments and **only that one is a
decimal**: the other twelve are the corpus's missing-space-after-a-full-stop (`ඇත.2011`, `තිබේ.1930`,
`ය.1958`) plus the abbreviation `අවු.18`, and every one of those is GLUED to a letter while the decimal is
preceded by a SPACE. So the rule is `(?<=[\s(\[])\.(?=\p{Nd})` → `0.` and the twelve stay pauses. Had it
been written on the shape instead, it would have deleted twelve sentence boundaries.

**Kelvin needed sourcing before it could be read, and takes no degree word.** `කෙල්වින්` ×37 whole-word on
si.wikipedia, in the right sense — *කෙල්වින් යනු උෂ්නත්වය මිනුමකි* ("Kelvin is a temperature measure") and
*කෙල්වින් මගින් ඇති ද්‍රවාංකයයි* (a melting point stated in kelvin). Digit-adjacent `K` is ×2 and both are
kelvin. But a bare one-letter uppercase key is the trap-46 shape, so it is claimed only SPACE-SEPARATED and
not before a dot: `5K` (a designation) and `1990 K.M.` (an initial) both stay unread. The two corpus
instances are the *same sentences* the °C/°F rule already handles, so this finishes them.

**What the probes confirmed rather than changed**, worth recording so nobody re-tests it: `%25` prefix sign,
`5$` sign-after, `₨500`, `98.6°f` lowercase, `50 m2`/`50 m3` ASCII exponents, `B&B`, `-5` and `(-5)`,
`425KM` uppercase, ZWNJ conjuncts — all already correct. And the three refusals held: `1,0000` and `1,00`
are not de-grouped, `ලකුණු 156ක්, තරග 90කදී` keeps its clause comma, `ප%තිපත්ති` keeps its manufactured `%`
silent.

Gates after: 3,363 tests, tsc OK, scan "no defects", review.ts clean, corpus diff 381/447 with DROP 85 → 33,
referee 607/648.
