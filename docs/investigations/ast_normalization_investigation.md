# Asturian (ast) normalization — investigation log

Picked as the largest untreated corpus in the fleet — **1,343,097 paragraph segments**, 2.4× the next one
— with the densest cell profile the sweep has met: `year` 577,546 · `letter-name` 267,970 ·
`initialism` 257,306 · `abbrev` 216,569 · `ordinal-latin` 103,191 · `roman` 88,304 · `ranges` 84,805 ·
`decimals` 71,505 · `signs` 40,944 · `grouped` 34,726 · `units` 27,763 · `percent` 17,570.

`tools/corpus/mined/ast.jsonc` — ast.wikipedia dump, 33/35 cells.

## Run 1 — 2026-08-16 — what the engine does today

```
"171.057 falantes" → …setenta i un . θinkwenta…   the GROUPING DOT read as a full stop
"0,54%"            → θeɾo , θinkwenta i kwatɾo    the decimal comma a pause, the sign gone
"16°C" · "23ºC"    → …k                            the sign gone, ⟨C⟩ read as a bare letter
"5° presidente"    → θinko pɾesidente              the ordinal indicator gone
"88°23' S"         → …bentitɾes s                  degree and prime both gone
"25 000 y 35 000"  → bentiθinko θeɾo …             space-grouping unread, `000` read as ZERO
"1200 e.C."        → …e . k .                      the era letter-by-letter with two false pauses
"24-X-1793"        → bentikwatɾo ʃ mil …           ⚠ the ROMAN MONTH read as the LETTER ⟨x⟩
"1-III-1700"       → un tɾes mil seteθjentos       …and here as the bare number 3
"sieglu XX"        → sjeɡlu benti                  "century twenty"
"23:40 h."         → bentitɾes , kwaɾenta .        the colon a clause pause
"21.035 €"         → …tɾenta i θinko                the sign dropped
"90 kg"            → nobenta kɡ                     the unit as a consonant cluster
```

## Run 2 — 2026-08-16 — ⚠ THE DEGREE SIGN AND THE ORDINAL INDICATOR ARE SWAPPED, IN BOTH DIRECTIONS

This is the round's finding and it is a shape trap 61 has not produced before. Ibero-Romance writes the
MASCULINE ORDINAL INDICATOR `º` (U+00BA) and the DEGREE SIGN `°` (U+00B0), which render near-identically
at text size — and this corpus uses **each of them for the other's job**:

| written | what it means | instance |
|---|---|---|
| `º` U+00BA | **degree** (temperature) | `23ºC`, `perriba de los 30º de media` |
| `º` U+00BA | **degree** (latitude/longitude) | `ente los 43º y los 42º de llatitú norte y los 4º y los 7º de llonxitú oeste` |
| `°` U+00B0 | **ordinal** | `1758 - James Monroe, **5° presidente** de los Estaos Xuníos` |
| `°` U+00B0 | degree (the ordinary case) | `16°C`, `44,9 °C`, `88°23' S`, `6.9 °` |

**Implication** Neither codepoint identifies the sense, so a codepoint-keyed rule is wrong in both
directions — and a fold in either direction destroys the other reading. The discriminator has to be the
CONTEXT: a following scale letter (`C`/`F`), a following latitude/longitude word, or a following prime
makes it a degree; a following noun makes it an ordinal. That is what the layer keys on.

## Run 3 — 2026-08-16 — the separators, and the Roman month

⚠ **THE DOT GROUPS AND THE COMMA DECIMATES** — the Ibero-Romance convention: `171.057 falantes`,
`150.644`, `20.413`, `21.035 €`, `1.012.292 €`, `17.500£`, `504.645 km²` against `0,54%`, `44,9 °C`,
`38,5 °C`, `12,9 °C`, `1,5 y 2,5 millones`. ⚠ **And the SPACE groups too** (`25 000 y 35 000`), and the
DOT also decimates when fewer than three digits follow (`132.46 km`, `6.9 °`). So the three-digit test
decides the dot, and the comma is always a decimal.

⚠ **THE ROMAN NUMERAL IS A MONTH.** `Calendariu republicanu francés (24-X-1793 - 31-XII-1805)`,
`Calendariu suecu (1-III-1700 - "30-II"-1711)`, `Calendariu revolucionariu soviéticu (1-X-1929 - 1940)` —
the day-`ROMAN`-year date form. Before this layer, `24-X-1793` read the `X` as the LETTER (the shared
roman pass declines a lone `X`) and `1-III-1700` read `III` as the bare number three. Neither is a month.

⚠ **AND A DENTAL FORMULA IS NOT A FRACTION.** "según la fórmula dentaria **I 3/3, C 0-1/0-1, P 3-4/3
M 3/3**" — Roman-letter tooth classes with slashed counts, in the mammal articles. Any `x/y` rule reaching
for a fraction lands on it, and the `C` and `M` in the same string are exactly the letters a Roman-numeral
pass looks at.

## Run 4 — 2026-08-16 — sourcing

`attest.ts --lang ast` over 26 words: **all 26 attested**, and the high-traffic ones comfortably —
`euru` ×256, `sieglu` ×181, `hores` ×151, `Cristu` ×142, `graos` ×140, `llibra` ×109, `dempués` ×107,
`grau` ×105, `cientu` ×78, `coma` ×75, `cuadráu` ×66, `Celsius` ×64, `cúbicu` ×51, `quilómetru` ×49,
`metru` ×47, `quilogramu` ×42.

⚠ **`vixésimu` scores ×1**, against `décimu` ×27 — which is what settles the century question. `sieglu XX`
is ×32 in the retained text and the corpus **never spells one out**. Spanish, Galician and Catalan all
carry a century policy in this repo; Asturian's would rest on a single attestation of its commonest form,
so it is refused and recorded. The shared cardinal pass reads *sieglu venti*, which is wrong in the same
way theirs was before they were given one.

⚠ **AND THE CURRENCY IS POSTPOSED, which the corpus proves rather than the tier assuming**: `21.035 € en
2012`, `unes ventes de 1.012.292 €`, `sobre 86.000£ millones`, `un PIB per cápita de 16.900£` — every
instance has the sign AFTER the figure. Worth stating because the neighbouring Ibero-Romance layers in
this repo see `$` prefixed in their own corpora.

## Run 5 — 2026-08-16 — two defects the tests found

⚠ **THE SHARED ROMAN PASS EATS HALF THE MONTHS BEFORE THE LAYER SEES THEM.** `core/roman.ts` runs at
`romanPass` in registry.ts, BEFORE this layer, and it converts a multi-letter numeral while declining a
lone one. So `1-III-1700` arrives here as `1-3-1700` and `24-X-1793` arrives intact — the same date form
in two shapes, and a rule written for either alone gets half of them. Both are claimed. (The same seam
ordering bit the Chuvash round from the other side, where a policy written for the folded spelling matched
nothing because the fold runs after `romanPass`.)

⚠ **AND THE DENTAL FORMULA DEFEATED THE RANGE GUARD.** `«la fórmula dentaria I 3/3, C 0-1/0-1, P 3-4/3
M 3/3»` — each `0-1` is a hyphenated pair flanked by a SLASH, so a guard blocking only on a following
hyphen let it through and produced *C cero, uno barra cero, uno*. Blocking on an adjacent `/` on either
side is what keeps the range rule out. The test caught it, not the corpus diff.

## Run 6 — 2026-08-16 — the gates

- **`mine.ts scan`**: `percent` 33→0 · `currency` 16→1 · `degree` 12→1 (the recorded ordinal) ·
  `minus` 10→2 · `exponent` 23→8 · `math-sign` 15→2 · LEAK `km` 32→7. Residual, all read: the LaTeX
  fragment, a Proto-Indo-European root written with the linguists' asterisk (`*Steu-r`), `km` inside
  compound rates the tier does not reach, two `pp.` in a Spanish citation and one English `3rd ed.`
- **corpus diff** (baseline emitted from a pristine worktree at `c81abeb`): **178/459 utterances changed
  (38.8%), DROP 95 → 27**, and no DIGIT / SLOT-GAP / RAWMARK / RAW-CAPS / THROW on either side.
- **`review.ts --lang ast`**: green on every checklist item including `sourcing`, `sign classes` and
  `clause-final` — seven refused classes registered in `ACCEPTED_SIGN_SILENCE` with their counts.
- **`referee-eval ast`**: **87.6% raw / 99.1% folded / 99.8% symbol, before and after** — the highest
  referee scores in the sweep, measured on both sides from the pristine worktree.
- **`vitest`** 4,561 passed and **`tsc --noEmit`** clean.

## Backlog surfaced, not fixed

- **The century ordinal** — `sieglu XX` ×32 and no spelled instance anywhere. Run 4.
- **`5° presidente`** — the one degree sign doing an ordinal's job, left unread. Run 2.
- **The exponent residual ×8** is a rate with a compound denominator the shared tier does not reach
  (`hab./km²`), which is the same shape trap 60 fixed on the numerator side.
