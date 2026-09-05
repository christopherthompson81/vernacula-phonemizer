# Aragonese (an) normalization — investigation log

Picked as the largest untreated corpus in the fleet — **255,887 paragraph segments** — and as a live test of
**trap 55**: Asturian was treated two rounds earlier and is the closest sibling this sweep has, so every
Asturian finding is a HYPOTHESIS here, not a template. The round is organised around which of them survive.

`tools/corpus/mined/an.jsonc` — an.wikipedia dump, 31/35 cells, 696 retained segments.

Corpus-wide: `latin-in-native` 254,911 · `quote-letter` 182,181 · `digit-run` 90,280 · `year` 89,305 ·
`letter-name` 78,118 · `initialism` 27,740 · `decimals` 24,548 · `abbrev` 17,018 · `grouped` 15,257 ·
`roman` 15,137 · `exponent` 13,092 · `units` 12,366 · `rate` 10,578 · `ampersand` 7,567 ·
`ordinal-latin` 7,655 · `ranges` 6,148 · `signs` 3,452 · `fractions` 2,081 · `dotted` 1,807 ·
`percent` 1,255 · `clock` 889 · `signed-number` 342 · `arithmetic` 678 · `era-marker` 101 ·
`currency` 85 · `degrees` 178.

## Run 1 — 2026-08-16 — what the engine does today

```
"92.000€"                → nobanta i dos . θeɾo        the GROUPING DOT a full stop, `000` read as ZERO
"1.500 metros"           → un . θinkoθjentos metɾos    …and the head reduced to *one*
"10.92 °C"               → djeθ . nobanta i dos k      the DECIMAL DOT also a full stop, ⟨C⟩ a bare letter
"de 450 295 km²"         → kwatɾeθjentos θinkwanta doθjentos nobanta i θinko km   space-grouping unread
"as latituz 19° y 37°N"  → deθinweu i tɾenta i sjete n  the degree sign gone
"baixan d'os -10º"       → baiʃan dos djeθ             ⚠ `º` gone AND the minus sign gone
"o 57° país mas gran"    → o θinkwanta i sjete pais    ⚠ the ORDINAL written with a DEGREE SIGN
"un 60% d'os ingresos"   → un siʃanta dos suʝos        the sign gone
"$359,9 billons"         → tɾeθjentos θinkwanta i nweu , nweu biʎons   sign gone, decimal a pause
"A las 17:07 se produce" → a las deθisjete , sjete     the colon a clause pause
"3:40.96 min"            → tɾes , kwaɾanta . nobanta i seis min
"12.500 a. C."           → dot͡se . θinkoθjentos a . k .   the era letter-by-letter, two false pauses
"43,5 hab/km²"           → kwaɾanta i tɾes , θinko ab km   the rate unread
"nº 132"                 → n θjent tɾenta i dos       the abbreviation as a bare letter
"58 kg" · "dika 7 cm"    → θinkwanta i weito kɡ · sjete km   units as consonant clusters
"30.689 km2"             → …i nweu km dos             the ASCII exponent read as the number two
```

## Run 2 — 2026-08-16 — ⚠ THE SIBLING HYPOTHESIS: FOUR HELD, TWO DID NOT

Asturian's six findings, each re-measured against this corpus rather than assumed:

| ast finding | an? | evidence |
|---|---|---|
| DOT groups, COMMA decimates | ✓ **held** | `30.689 km2`, `8.443.713`, `652.864 km²` vs `21,9°`, `9,68 billons`, `55,4%` |
| …and the DOT ALSO decimates under three digits | ✓ **held** | `10.92 °C`, `4.76 °C`, `12.7 °C`, `4.74 mil millons`, `$33.3 millons` |
| the SPACE groups too | ✓ **held** | `450 295 km²`, `30 278 km2`, `1 426 250` |
| `°`/`º` are SWAPPED in both directions | ✓ **held, and tighter** | `de 3º y la de agosto de 21,9°` — BOTH codepoints for temperature IN ONE SENTENCE; and `o 57° país mas gran d'o mundo` is the ordinal written with U+00B0 |
| the currency is POSTPOSED | ✗ **refuted** | both orders, and the prefixed one is commoner: `$359,9`, `$33.3`, `US$185`, `€47.5`, `£ 1,5`, `£4.300` against `92.000€`, `2€`, `300$` |
| the Roman numeral is a MONTH | ✗ **absent** | no `24-X-1793` date form here; every Roman numeral is a century (`sieglo XX`), a regnal number (`Valentinián III`, `Pero IV`) or a pagination (`XVIII+1022 pp.`) |

**Implication** The separator machinery ports wholesale and the `°`/`º` discriminator ports wholesale; the
currency ORDER and the Roman-month rule do not. Four out of six — which is exactly why the sibling is a
hypothesis and not a template.

## Run 3 — 2026-08-16 — ⚠ THE COLON IS AN ATHLETICS STOPWATCH, AND THE CORPUS GLOSSES THE OTHER SENSE

`clock` is 889 corpus-wide. In the retained text there are eleven colon-between-digits instances and only
**two** are times of day (`A las 17:07`, `a las 04:35 UTC`). Six are **race times** in minutes:seconds.hundredths,
from the athletics articles:

```
1.500 metros lisos  - 3:40.96 min      3.000 metros lisos  - 7:50.71 min
5.000 metros lisos  - 13:47.77 min     10.000 metros lisos - 28:39.11 min
3.000 metros obstaclos - 8:09.09 min   …superó a lo favorito Jim Ryun con un tiempo de 3:34.91
```

This is the Faroese finding recurring in an unrelated family — and it settles the guard rather than the
rule: a trailing `.dd` is what tells a stopwatch from a clock, so `(?![\d:.,])` after the minute field
declines all six while `17:07 se produce` passes.

⚠ **AND THE THIRD SENSE IS SELF-GLOSSED.** `Graus:Menutos:Segundos (en anglés Degree Minute Second, DMS)
eixemplo 41:20:00- 106:30:00` — the corpus spells out its own notation in the same line it uses it. Two
colons, so the same guard declines it; and the gloss is where `graus`, `menutos` and `segundos` are attested
as this language's own words for the coordinate fields.

## Run 4 — 2026-08-16 — ⚠ `>` IS A SOUND-CHANGE ARROW, AGAIN

All the retained `>` instances are one etymology table in the aragonés-language article — Latin etymon to
Aragonese reflex, twelve rows of it:

```
PONTE > puent   ·  FERRU > fierro  ·  FOLIA > fuella  ·  SPEC'LU > espiello
GRANDE > gran   ·  IUVEN > choven  ·  GELARE > chelar ·  FILIU > fillo
```

Shan's `>` was the same thing and no other language's was. gd's was a LaTeX fragment, tk's a typo for ⟨ş⟩,
la's a genuine comparison, oc's a taxonomic rank chain. Six treated languages, five distinct senses, and
**zero comparisons in this one** — the sign is refused and registered.

The other math signs are the same story: `+` is a PHONOLOGICAL ENVIRONMENT in `g(+e), g(+i)` ("g before e,
before i") and a pagination in `XVIII+1022 pp.`, and `±` is an approximate geological date (`fa ±415 - ±360
m.a.`). None is arithmetic.

⚠ **AND THE SLASH IS ALMOST NEVER A FRACTION.** `fractions` is 2,081 corpus-wide, but of the eleven retained
instances only three are fractions (`2/3`, `1/10`, `1/72`) and the rest are LEGAL CITATIONS (`Lei 10/2009`,
`Decreto 208/1993`, `Lei Organica 4/1979`), an issue number (`Fuellas, 16/93`), a sports season
(`temporada 2004/2005`), a date (`from:30/10/1977`) and a rate (`hab/km²`). Reading the citations as
fractions is the trap-56 shape — a defect that produces a READING. Refused and registered.

## Run 5 — 2026-08-16 — ⚠ THE CORPUS DEFINES ITS OWN NOTATION, FOUR TIMES OVER

`attest.ts --lang an` over 70 words: **69 attested, 1 absent** (`hectarea` — the Aragonese spelling is
`hectaria`, and the unit is not in the retained text anyway, so no `ha` key is declared).

What makes this round unusual is not the counts but where the examples came from. an.wikipedia carries a
UNIT ARTICLE PER SYMBOL, and each one pairs the noun with its abbreviation in the first sentence:

```
"O kilogramo (simbolo kg) ye a unidat base de masa d'o Sistema Internacional d'Unidaz"
"O centimetro, que tiene por simbolo cm, ye una unidat de mesura derivata"
"O milimetro, que ha simbolo mm, ye una unidat de mesura de lonchituz"
"Un kilometro cuadrau ye a superficie que ocupa un cuadrau d'un kilometro de canto … Se simboliza por km²"
"O grau Celsius u grau centigrado, representau como °C, ye una unidat de temperatura"
"O kilogramo por metro cubico ye a unidat d'o SI ta a densidat y se representa por kg/m³"
"a densidat de población … s'expresa en habitants por km²"
"1 000 000 mm - un millón de milimetros. 100 000 cm - cient mil centimetros. 0,1 dam - zero coma un decametro."
```

That last line is doing three jobs at once: it attests the unit plurals, it demonstrates SPACE GROUPING,
and it names the decimal mark (`coma`). The rate connective `por` and the `km²` expansion are likewise the
corpus's own words rather than a construction of this layer.

⚠ **AND THE PERCENT WORD IS NOT THE HIGHER-SCORING ONE.** `ciento` ×49 beats `cient` ×35 on the wiki, but
the phrase this corpus writes is **`por cient`** — "creixió en un 6 por cient", "o PIB meyo d'o 4.5 por
cient". The count ranks a word; the slot picks it. Same shape as the `graus` check below, in reverse.

⚠ **`graus` IS THE MEASURE WORD AND ALSO A TOWN IN ARAGON**, and it outscores the measure sense on the wiki
(Graus, Huesca). One round earlier Occitan's `gras` ×156 was REFUSED for exactly this reason — but there
the homograph is a different word ("fat") with a different reading, and here `Graus` and `graus` are the
same word phonetically. The identical-looking check goes the other way, and that is the point of running it.

⚠ **`coma` ×74 IS MOSTLY A LANDFORM** — "Una coma u nava ye una plana situada en un zona…", the Pyrenean
hollow. The punctuation sense is attested through the corpus's own disambiguation line ("ta la coma como
signo de puntuación, se veiga Coma (puntuación)") and through the metric glossary above. Costs nothing,
since both senses are one word.

## Run 6 — 2026-08-16 — three defects the layer INTRODUCED, and how each was caught

⚠ **`m.a.` READ AS METRES.** "En o Devoniano (fa ±415 - ±360 **m.a.**)" is *millons d'anyadas*. Before this
layer it read `m . a .`; after declaring `m` as a unit for the tier it read **`trecientos sisanta metros`** —
a defect that produces a READING, and one the layer would have INTRODUCED rather than inherited (trap 56).
Claimed explicitly; the corpus writes the phrase out elsewhere ("1,5/1,8 millons d'anyadas d'antigüidat").

⚠ **THE MINUS SIGN CLAIMED THE ATHLETICS LIST SEPARATOR.** The same articles that supply the stopwatch times
write them as `EVENT - TIME`: "3.000 metros obstaclos - 8:09.09 min". The standard fleet minus rule read six
national records as NEGATIVE times. The guard is that a figure whose digits run into a colon is a time —
`-10º` and `-218.3°C` carry no colon and are untouched.

⚠ **`US$` WAS SILENTLY DROPPED.** The tier declines a currency mark a letter runs into, so `US$185 billons`
read as *us cient uitanta i cinco billons* with no unit at all — five instances. Fixed by declaring `US$` as
its own key, with the phrase the corpus supplies ("As unidaz son en dólars estausunidenses").

None of the three was visible in the corpus diff as a lost reading; the first two were found by reading the
probe output, the third by the artifact scan's residual currency count.

## Run 7 — 2026-08-16 — the gates

- **`mine.ts scan`**: LEAK `km` 45→0, `mm` 3→0, `kg` 3→0 · `percent` 20→1 · `degree` 20→1 · `minus` 12→0 ·
  `currency` 16→5→0 (after the `US$` key; the residual 5 was that bug) · `ampersand` 5→0 ·
  `exponent` 37→3. Residual, all read: three `pp.` in a Spanish/English citation, `c²` in the physics
  prose (a superscript on a VARIABLE, not a unit), the one `57°` ordinal, and one `%` inside a
  Spanish-language quotation.
- **corpus diff** (baseline emitted from a pristine worktree at `72519d1`): **174/447 utterances changed
  (38.9%), DROP 117 → 39**, and no DIGIT / SLOT-GAP / RAWMARK / ZERO-WIDTH / RAW-CAPS / THROW either side.
- **`review.ts --lang an`**: green on every checklist item including `sourcing`, `sign classes` and
  `clause-final` — seven refused classes registered in `ACCEPTED_SIGN_SILENCE` with their counts.
- **`referee-eval an`**: 60.0% raw / 76.2% folded / 96.2% symbol, before and after.
- **`vitest`** full suite and **`tsc --noEmit`** clean.

## Backlog surfaced, not fixed

- **The century ordinal** — `sieglo XX`/`XII`/`IX`/`VIII`/`XV`/`XIX`, never spelled out. Third Romance
  round in a row to record this; Spanish, Galician and Catalan all carry a policy in this repo.
- **`57° país`** — the one degree sign doing an ordinal's job, left unread. Run 2.
- **`13.ª edición` and `3ª posición`** — the FEMININE ordinal indicator U+00AA, a third member of the
  `°`/`º` confusable family that this layer does not touch.
- **The magnitude connective on a plain number** — `1 000 000 mm` reads *un millón milimetros*; the corpus
  writes "un millón **de** milimetros". `magnitudeConnective` is currency-only in the shared tier.
- **`54.8K`** — Kelvin, with no degree sign and no attested Aragonese word in this corpus.
- **`1.88×10^9`** — the caret exponent, unread; the `×` is registered as scientific notation rather than
  multiplication for the same reason.
