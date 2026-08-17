# Latgalian (ltg) text normalization — investigation log

Chronological. Each run records the command, the question it was meant to answer, the RAW finding, and what
that implied for the next step. Negative results and dead ends are kept — they are the point.

Corpus: `tools/corpus/mined/ltg.jsonc`, an ltg.wikipedia paragraph dump, 3,444 segments, of which 394 are
retained (194 hard-set + 200 sample). Every count below is over the retained text unless it says otherwise.

---

## Run 1 — 2026-08-16 — the baseline, and what the engine does to the corpus's own shapes

```
npx tsx tools/normalization/corpus-diff.ts emit --lang ltg --corpus mined:ltg --out /tmp/ltg-base.json
npx tsx tools/referee-eval/eval.ts ltg
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/ltg.jsonc --lang ltg
npx tsx tools/normalization/review.ts --lang ltg
```

**Question.** What is broken before anything is written?

**Raw finding.**

```
emitted 382 utterances
DIGIT 0 · SLOT-GAP 0 · RAWMARK 0 · ZERO-WIDTH 0 · RAW-CAPS 0 · DROP 66 · THROW 0
raw exact 1/488 (0.2%) · folded backbone 379/488 (77.7%) · symbol accuracy 95.9%
LEAK RAW-LATIN km ×38 · DROP percent ×24 · DROP math-sign ×21 · DROP exponent ×20 · DROP degree ×9 ·
DROP ampersand ×6 · DROP minus ×5 · LEAK RAW-LATIN lpp ×4 · LEAK RAW-LATIN mm ×3 · LEAK RAW-LATIN ts ×2 ·
LEAK RAW-LATIN lt ×1 · DROP currency ×1 · LEAK RAW-LATIN mln ×1
review.ts: [FAIL] normalizer — src/languages/latgalian/normalize.ts missing
```

Then ~48 attested shapes through `phonemize(…, "ltg")`. The readings that mattered:

| input | reading before |
|---|---|
| `-7°C` | `sʲæpʲtʲænʲi t͡s` — sign gone, ⟨C⟩ read as Latgalian /t͡s/ |
| `83 871 km²` | *83 · 871* as TWO numbers, `km` raw, `²` gone |
| `3,555 km2` | `træis , pʲiːt͡sʲi sɨmʲtʲi …` — a clause break mid-number, then `km`, then `divi` (the ASCII 2 as a NUMBER) |
| `1,500 solu` | `vʲiːnt͡s , pʲiːt͡sʲi sɨmʲtʲi sɔlu` — clause break, wrong quantity |
| `10%`, `-7%`, `>80%` | the sign silently gone in all three |
| `16.3 °C` | `sʲæʃpatʲsʲmʲit . træis t͡s` — a FULL STOP inside a number |
| `753 ha` | `xa` · `0,6-0,8 cm` → `t͡sm` · `650—800 g.` → `k` · `9.—10.gs.` → `ks` |
| `Nu 1964. da 1968. godam` | two spurious sentence breaks inside one date |
| `143.–153. lpp.` | three spurious breaks, `lpp` raw |
| `Thomas & Hinton` | the `&` gone |
| `310—305 g. p. Kr.` | `k . p . kr .` — three fragments, three false breaks |
| `€151 miljonu` | the sign gone |

**Implication.** The largest classes are the ordinal period, the two separators, the unit table and the
degree sign — and four of the defects (`ha`→[xa], `cm`→[t͡sm], `g`→[k], `gs`→[ks]) are playbook trap 56: a
plausible Latgalian syllable rather than audible garbage, so no leak class, no DROP and no referee could see
them. The layer's job list came out of this table, not out of the sibling's.

---

## Run 2 — 2026-08-16 — the separators, and the three-digit test's two counter-examples

Small node scripts over the artifact's string leaves (comments stripped, trailing commas removed), printing
every match of each pattern with 45 characters of context.

**Question.** Which mark groups, which decimates, and does the three-digit test hold?

**Raw finding.**

```
comma 3-digit group  9      comma decimal (not 3)  65
space group         29      dot decimal single     12      dot date (2 dots)  5
```

The nine comma-groups read one at a time: `3,794 km` (Estonia's coastline, 3794 km), `1,500 solu` (>1500
islands), `3,555 km2` (Peipus, 3555 km²), `548,000 cylvāku` (9.9% of Denmark), `2,300 km²` ×2, `450,295 km²`
(Sweden) — seven correct. And two that are **not**:

```
Iudiņbaseina pluots 87,900 km² (33,900 mi²)
```

Drīdzis lake, whose surface the same infobox gives as `753 ha` = 7.53 km²; a catchment of 87,900 km² would be
larger than Latvia. The pair is self-consistent under EITHER reading — 87.9/2.59 = 33.9 and 87900/2.59 =
33900 — so nothing in the string separates them.

The dot decimates too (`16.3 °C`, `−3.5 °C`, `5.2 °C`, `3.5%`, `1.8 milijoni`) while also writing five DATES
(`07.02.1922`, `1858.07.01 — 1922.12.16`, `17.12.1932`, `18.02.2004`) and two VERSIONS (`HTML versija 4.01`,
`XHTML 1.0`).

**Implication.** Ship the three-digit test on the comma and state the 7-against-2. Guard the dot on "exactly
ONE dot in the run", which declines every date. Four conventions in 394 segments is the round's second
finding, and it is why nothing about separators could be ported.

---

## Run 3 — 2026-08-16 — reading every instance of every sign

**Question.** What does each mark actually mean here? (Playbook trap 62: print every instance with context
before writing any rule.)

**Raw finding.**

```
=  14    +  5    <  1    >  4    ±  0    ×  0    ÷  0    *  2    ~  1    &  6 (+6 &nbsp; entities)
°  25    º  0    ˚  0    ℃  0    %  52   €  1    $  0    ²  24   ³  0    km2 10
colon between digits 1
```

- **`=` ×14, one arithmetic.** Five are EasyTimeline chart markup (`PlotArea = left:50`, `ScaleMajor =
  unit:year`, `ScaleMinor = …` ×3), two are formula assignments (`x = log(1)`, `y = log(69971)`), one is an
  English sentence, three are currency equivalences whose right operand is a WORD (`1 eura (EUR) = apmāram
  0,702804 latu (LVL)`), two are Gothic numeral glosses (`𐌹𐌱 = 12`), and one is `26*26=676`.
- **`>` ×4, one comparison.** `-> "die Bäume"` is a derivation arrow, `informatika > datorzineiba` ×2 is an
  IT-glossary mapping, and only `(>80%)` is "more than". `<` ×1 is an ETYMOLOGY arrow: `alluvius < alluere`.
- **`*` ×2.** `26*26=676` is a product; `Kalimahs (; * ap 310—305 g. p. Kr., † ap 240 g. p. Kr.)` is the
  biographical BIRTH asterisk.
- **`:` between digits ×1, and it is not a clock.** `atmejūt ekeju (ECU, European Currency Unit) pa kursam
  1:1` — an exchange RATIO. A ported ceb-shaped `\d{1,2}:\d{2}` rule would have fixed nothing and read a
  currency peg as a time of day.
- **The em dash ×169 is the COPULA** standing in for the absent verb (`Bolvi () — mīsts pūstumu Latgolā`,
  `Golvysmīsts — Santjago`) — the Karakalpak finding again. Exactly ONE is a minus: `temperatura beja — 43° C`,
  the same fact a parallel article writes as `(–43 gradi C)`.
- **`&nbsp;` ×6 appears as literal text in the artifact.** Probed through the pipeline: `core/markup.ts`
  decodes it to a space before any language rule runs, so `7&nbsp;km` is already number-adjacent. No local
  rule needed — checked rather than assumed.

**Implication.** `=`, `<`, `>`, `÷`, `±` are all refusable on sense alone; `*` is claimable with a
digits-on-both-sides guard; there is no clock rule to write. The em dash must never join the sign class.

---

## Run 4 — 2026-08-16 — the corpus glosses its own degree sign

**Question.** What word does this language use for `°`?

**Raw finding.** Two sentences about the same fact, in different articles:

```
Vydyskuo temperatura janvara mienesī -7°C, juļa mienesī +17°C
Dagdā i Daugpilī registrāta vysuzamuokuo temperatura (–43 gradi C) … vysuaugstuokuo (+36 gradi C)
```

`gradi` ×4 in the corpus and ×6 on the wiki, every example a temperature. ⚠ And the gloss leaves a bare ⟨C⟩
that no `°`-keyed rule can reach — ×4, each reading as /t͡s/.

**Implication.** `gradi` is the degree word and the writer's own `gradi C` needs its own arm.

---

## Run 5 — 2026-08-16 — sourcing, three batches, and two words that scored well and were wrong

```
npx tsx tools/normalization/attest.ts --lang ltg --limit 12 --words <30 words>   # batch 1
npx tsx tools/normalization/attest.ts --lang ltg --limit 12 --words <32 words>   # batch 2
npx tsx tools/normalization/attest.ts --lang ltg --limit 20 --words <15 words>   # batch 3
npx tsx tools/normalization/attest.ts --lang ltg --limit 25 --after kilometru,metru,kilometri,metri
```

**Question.** Which readings are sourceable, and does each hit sit in the slot I need?

**Raw finding — the words that hold.**

| word | tok/arts | the example that settles it |
|---|---|---|
| `procents` / `procenti` | 2/2, 1/1 | "atsateikūši 42,3 i 41,7 procenti" · "labtik leluoks procents daugpilīšu" |
| `eura` / `euru` | 5/2, 8/2 | the euro's own ltg article; "1 eura (EUR) = …", "610 milijardi euru" |
| `kilometri` / `kilometru` | 3/3, 11/11 | "2 kilometri iz PR nu Rogoukys" · "210 kilometru iz zīmeļvokorim" |
| `metri` / `metru` | 9/7, 3/3 | "Dzagužkolns (28 metri ajl.)" · "ļeidz pot 3000 metru augstumu" |
| `ceņtimetru` | 2/2 | "da 150 ceņtimetru garuma" · "Augums 52-58 ceņtimetru augsts" |
| `hektaru` | 1/1 | "Andryvs daboj 15 hektaru" |
| `kilogrami` | 3/2 | "svors 30—65 kilogrami (rekords — 79 kilogrami)" |
| `gradi` / `gradu` | 6/3, 3/3 | "(–43 gradi C)" · "+29,3 gradu pa Celseja skolai" |
| `Celseja` | 3/2 | "-9° pa Celseja skolai", "+18° pa Celseja skolai" |
| `kvadratkilometru` | 2/2 | "kura pluots viņ nazcik kvadratkilometru" · "izlītoj apmāram 1 kvadratkilometru lelu pluotu" |
| `reiz` | 1/1 | "diveju komandu kaitaunīkim 15 reiz 4 m pluota laukumeņā" |
| `apmāram` | 27/20 | "apmāram 15% (~16 tyukstūšys)", directly before a figure |
| `cyti` | 22/19 | "1,1% boltkrīvi i 5,0% cyti" |
| `pyrma` + `Krystus` | 14/12, 20/12 | "pīdzims 7-2 godā **pyrma Krystus**" · "II godusymtā **pyrma Krystus**" |

**Raw finding — READ THE EXAMPLES, and three of them were traps.**

- **`grads` ×2 is the ACADEMIC degree** — "bakalaura grads 1993, magistra grads 1996", both hits. Same shape
  as ki's `digirii`. The temperature word is the plural `gradi`/`gradu`.
- **`Kristus` ×4 is a SONG TITLE.** Every hit is "Kristus iz pogolma", a Graždanskaja Oborona track listing.
  The era phrase this layer needed is spelled `pyrma **Krystus**`, with ⟨y⟩ — found only because batch 3
  probed `pyrma` and the examples printed the collocation. A word-first probe had the right concept and the
  wrong spelling.
- **`punkts` ×18 / 12 arts is a FACILITY** — `feļčeru punkts` (paramedic post), `turizma informacejis
  punkts`, `dzeļžaceļa rūbežkontrolis punkts`, `vysuaugstais punkts` (a district's high point). Not one is
  the decimal point. That is zu's `amaphuzu`, exactly. `komats`/`komata` are ×0.
- **`plus` ×1 is inside an ENGLISH sentence** on the IT-glossary page ("translates common terms of IT (plus
  some Wikipedia specific ones) into Latgalian"), and `plyusmuos` ×1 is *plūsma*, a flow.
- **`kvadrata` ×1 is the SHAPE** — "kvadrata forma ar četrim portikim" — not the measure word.

**Raw finding — the negatives.**

```
dolars dolari kilometrs metrs centimetri milimetri milimetru hektars hektari grami tonna tonnys
Celsija Celsijs Farenheits komats komata mīnuss mīnus plyus dalīts vinaids lappuse sekundes
kvadratkilometri kvadratmetri kvadrats kvadratā kubikmetri kubs   — ALL ×0
```

**⚠ The square word was found only by the SLOT-SHAPED probe** (playbook trap 40): five spellings at ×0, and
`kvadratkilometru` at ×2 in exactly the slot. The `--after` probe on the metre nouns returned only
`nu ×1 · augstumu ×1` — trap 51's floor, and it is why the CUBE word stayed unfound (`³` is ×0 here, so
nothing is lost).

**Implication.** Everything the corpus writes a sign for is sourceable except the arithmetic signs and the
decimal point. `mm` and `$` have no word and no sourceable one; they stay unread and visible.

---

## Run 6 — 2026-08-16 — the sibling's unit table would have read 32 years as a weight

**Question.** Latvian's layer landed days earlier and is the obvious template. Which of its rules survive
re-measurement on Latgalian's own corpus (playbook trap 55)?

**Raw finding.**

```
\d[\s.]?g\.  (the YEAR abbreviation)     ×32
\d[\s ]g     (a gram, no dot following)  ×1
```

The 32: `1577 g. — Ivana Borguo vodomi krīvu karapulki iznycynoj Dynaburgu`, `Dzymuse 1935 g. apreļa 22 d.`,
`2003/2004 g. sezonā`, `1983.g. pījimts Ministru Padūmis lāmums`, `1893 g., kod cara vaļdeiba…`. The one:
`svors&nbsp;— 650—800&nbsp;g.`, a boules ball.

Latvian declares `g: pair("grams", "grami")` and is right to; here it would read every one of those years as
a weight. Two further Latvian rules also failed re-measurement: its `līdz` range connective (Latgalian's `da`
is attested only inside the `nu … da …` frame — 53 spans, not one without its `nu`), and its ordinal
composition (there is no attested Latgalian ordinal series; only the half-measure transfers).

**Implication.** `g` and `t` out of the unit table. The dash gets a pause, not a connective. The ordinal
period is removed and the figure left cardinal.

---

## Run 7 — 2026-08-16 — the ordinal period: 139 against 14

**Question.** Can the period be removed without eating a real full stop?

**Raw finding.**

```
ordinal dot + lower-case follower   139
ordinal dot + dash                   14
ordinal dot + comma                   2
dot + UPPER-CASE or end of input     14
```

The 14 that must not be touched read as: `mozuokais, 3000. Partū`, `jau 120-150. Div reizis`, `Īstateišonys
gods – 1957. Nūlīgtiņs`, `92 301 km2. Praņcūzejis`, and two that ARE ordinals with a capitalised head noun —
`1789. Godā nūtyka Līlā Praņcūzejis revoluceja` and `1. Godasymta prīkš Krysta`. Those two are missed, and
that is the price of the guard.

The corpus writes the abbreviation-tight form as often as the spaced one: `1922.gods`, `115.panta`, `2.pusē`,
`16.juņa`, `1901.godā`, `1983.g.`.

**Implication.** Three arms — before a dash (above the range step), before a comma, and the main
lower-case arm — and the gap must be SUPPLIED where there is none or the figure fuses onto the noun.

---

## Run 8 — 2026-08-16 — writing the layer, and re-measuring

```
npx tsc --noEmit
npx tsx tools/normalization/corpus-diff.ts emit --lang ltg --corpus mined:ltg --out /tmp/ltg-after.json
npx tsx tools/normalization/corpus-diff.ts compare --before /tmp/ltg-base.json --after /tmp/ltg-after.json
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/ltg.jsonc --lang ltg
```

**Raw finding.**

```
changed 166/382 (43.5%)
before  DIGIT 0 · SLOT-GAP 0 · RAWMARK 0 · ZERO-WIDTH 0 · RAW-CAPS 0 · DROP 66 · THROW 0
after   DIGIT 0 · SLOT-GAP 0 · RAWMARK 0 · ZERO-WIDTH 0 · RAW-CAPS 0 · DROP 21 · THROW 0

scan after: DROP minus ×5 · LEAK RAW-LATIN km ×4 · LEAK RAW-LATIN lpp ×4 · LEAK RAW-LATIN mm ×3 ·
            DROP exponent ×2 · LEAK RAW-LATIN lt ×1 · LEAK RAW-LATIN ts ×1
```

`percent`, `currency`, `degree`, `ampersand` and `math-sign` are gone from the scan; `RAW-LATIN km` fell
38 → 4. The four survivors are the DENSITY shape — `899 dzeiv/km²`, `29 cylv./km²` — a common-noun
numerator with no digit adjacent to the unit, which is trap 54's `bar` case and nothing the unit table can
reach. The two `exponent` residuals are the same two sentences.

**Then I read the changes rather than the counts.** A dedicated pass counted the periods the normalizer
removes per segment: **179 dots over the whole retained text, every one an ordinal marker.** The largest
single-segment removals were `1920.godā … 1923.godam … 1923.—1925.g. … 1925—1928.g.` (−9) and a bibliography
line (−7), both correct.

**One real cost surfaced in that read.** `* ap 310—305 g. p. Kr. Kirenē` keeps its era period, because the
sentence-end discriminator (whitespace + upper case) cannot tell a following proper noun from a new
sentence. That is Latvian's documented trade — a spurious pause is audible and recoverable; two sentences
welded together are not — and it is one instance here.

---

## Run 9 — 2026-08-16 — the review, and a tool limitation worth recording

```
npx tsx tools/normalization/review.ts --lang ltg
```

After registering eight refusals in `ACCEPTED_SIGN_SILENCE`:

```
[ ok ] sign classes       none dropped
[ ok ] clause-final       a trailing . or , loses no reading
[ ok ] sourcing           all 4 high-traffic words attested
[ ok ] spelling → g2p     no unphonemized word literal in text()
[FAIL] artifact scan      DROP minus ×5 · LEAK RAW-LATIN km ×4 / lpp ×4 / mm ×3 · DROP exponent ×2 · lt ×1 · ts ×1
```

**⚠ A finding about the instrument, not about the language.** `DROP math-sign ×20` went away when the class
was registered; `DROP minus ×5` did not. `acceptedSignClass()` maps a coarse DROPPABLE class to the probe
names in `SIGN_CASES`, and the `minus` probe's character class is `[-−]` while the DROPPABLE `minus` pattern
is `[-−–]`. A sentence whose only minus-shaped character is an EN DASH — which is how this corpus writes
`(–43 gradi C)` — therefore has no probe name to match and can never be class-accepted. Not fixed here: it
is a shared file and the fix wants its own fleet measurement.

---

## Gates

| gate | result |
|---|---|
| `corpus-diff compare` | changed 166/382 (43.5%). **DROP 66 → 21.** DIGIT / SLOT-GAP / RAWMARK / ZERO-WIDTH / RAW-CAPS / THROW all **0 on both sides** |
| `review.ts --lang ltg` | `sign classes` ✅ · `sourcing` ✅ · `clause-final` ✅ · `artifact scan` red on the residuals read above |
| `referee-eval ltg` | raw 1/488 (0.2%) · folded 379/488 (77.7%) · symbol 95.9% — **byte-identical before and after**, verified by bypassing the normalizer and re-running |
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 247/248 files, 4606 passed, 5 skipped. The one failure is `languageCatalogue` reporting `1 cell(s) differ` — the derived `normalization` column now disagrees with `catalogue.tsv` because ltg has a normalizer. That file is regenerated centrally and was deliberately not touched; the fix is `python3 tools/language-catalogue/derive-normalization.py` |

---

## Backlog surfaced, not fixed

- **⟨g.⟩, ⟨gs.⟩ and ⟨lpp.⟩ stay unread, and two of the three read as plausible syllables** — `g.` ×32 → [k],
  `gs.` ×20 → [ks], `lpp.` ×4 raw. `godu symts` is spelled out ×17 in the corpus but in the GENITIVE
  (`da poš 20 godu symta`, `nu 17.-18. godusymta`, `Da 13 godu symta`, `XX godusymta beigu`) and the LOCATIVE
  (`15.–17. godu symtā`, `XX godusymtā` ×2) in the same slot — 4 against 3, a coin flip, not a derivation.
  `lappuse` is ×0 on the wiki; the corpus's own candidates are `puslopys` ×2 and `lopys` ×1, in a book's
  page-count sentence rather than in a citation. Unblocking this wants a case-bearing rule or a source.
- **Dates are not handled at all.** `07.02.1922.gods.`, `1858.07.01 — 1922.12.16`, `17.12.1932`,
  `1883.goda 10.dekabris` — the two-dot guard correctly declines them as decimals, so they keep three or
  four false sentence breaks each. Five dotted dates in the retained text; `clock` ×27 corpus-wide is mostly
  this shape.
- **`m/s²` reads as "metri s".** The shared tier's unit pattern offers a numerator exponent and a rate
  denominator as ALTERNATIVES, and `s` is undeclared here anyway (`sekundes` ×0), so `8,8 m/s²` composes the
  metre and leaves `/s²`. One instance. `stuņdis` ×8 IS attested ("Reigā speid 1812 stuņdis"), so a `km/h`
  rate would be sourceable — the corpus simply never writes one.
- **The three-digit comma test is wrong twice**, on `87,900 km² (33,900 mi²)` (Run 2). Nothing in the string
  separates the two readings; a fix would need the infobox's own units cross-checked.
- **The minus is refused and it costs** — six instances read as positive, including Daugpils's record low.
  No Latgalian sign word exists in any source this tree can reach. This is the single item most worth
  reopening if a dictionary tier ever lands.
- **`1, 95 milijoni`** — a decimal comma written with a space after it (Latvia's population). Neither the
  grouping nor the decimal rule can see it; it reads as two numbers with a pause. One instance.
- **`(1797.—1813.)`** keeps its second period, because a `)` is not a lower-case letter. Cosmetic; two sites.
- **`acceptedSignClass()`'s minus probe is narrower than the DROPPABLE minus pattern** (Run 9). Fleet-wide,
  and a shared-file change.
