# Kabuverdianu (kea) text normalization — investigation log

Chronological. Each run records the command, the question it was meant to answer, the RAW finding, and what
that implies for the next step. Negative results are kept; they are the point.

Corpus: FLEURS `kea_cv`, 3,945 rows → **1,931 unique utterances** (FLEURS repeats each sentence per speaker).
There is **no mined artifact** for kea, so `mine.ts scan` is unavailable and every class count below was
measured by hand over column 3 of the TSVs.

---

## Run 1 — 2026-08-16 — baseline: DROP=19, every leak class 0, referee 7/7 folded

```
npx tsx tools/normalization/corpus-diff.ts emit --lang kea --corpus kea_cv --out <scratch>/kea-base.json
npx tsx tools/normalization/corpus-diff.ts compare --before <same> --after <same> --corpus kea_cv
npx tsx tools/referee-eval/eval.ts kea
```

Question: what is the pre-change state of every gate?

RAW:

```
changed 0/1931 (0.0%)
  DIGIT: 0, SLOT-GAP: 0, RAWMARK: 0, ZERO-WIDTH: 0, RAW-CAPS: 0, DROP: 19, THROW: 0
```

```
=== kea vs kaikki.org Kabuverdianu (Wiktionary-derived, human) — the 7 IPA-carrying words … ===
raw exact:      0/7 (0.0%)     folded backbone: 7/7 (100.0%)     symbol accuracy: 100.0%
⚠ secondary-source gap: NO independent referee beyond these 7 kaikki words — wikipron has no
Kabuverdianu … thin single-source (the fleet's thinnest, 7 words vs Luo 17 / Madurese 35).
```

Implication: DROP=19 is the highest baseline of the five FLEURS-only languages, and the referee is a
7-word tripwire that cannot arbitrate anything this layer does. The corpus is the only instrument.

---

## Run 2 — 2026-08-16 — the orthography question: ALUPEC, near-categorically

Question (the Papiamento prediction): Papiamento carries TWO live orthographies in one corpus — Curaçaoan
phonological (205 segments) against Aruban etymological (102). Kabuverdianu is likewise written both in
ALUPEC/ALUPEK and in Portuguese-etymological spelling. Which is this corpus?

`<scratch>/ortho.mts` over the 1,931 unique lines, whole-word counts with `(?<![\p{L}\p{M}])…`:

```
ku ×427   | cu ×0        ki ×899  | qui ×0      kel ×284 | quel ×0     kes ×211 | ques ×0
txeu ×175 | cheu ×0      dja ×85  | ja ×14      kuza ×30 | cousa ×0    nasional ×26 | nacional ×0
letters:  k ×7668  c ×366  ç ×1  qu ×15  tx ×348  ch ×99  dj ×379
          -son ×713 (the ALUPEC reflex of -ção)      -ção ×0      -ç/cao ×0
```

Then every lowercase-initial word containing ⟨c⟩ or ⟨ç⟩ — **28 types, 39 tokens** in the whole corpus:

```
etc×8 · hockey×2 · chhappan×2 · cella×2 · civilis×2 · asisténcia×1 · octogonal×1 · caro×1 · carro×1 ·
cm×1 · rock×1 · podcasts×1 · acordu×1 · karacól×1 · c×1 · cypha×1 · canyon×1 · plc×1 · cappuccino×1 ·
civitas×1 · cluster×1 · caucus×1 · l'Oyapock×1 · chakras×1 · card×1 · car×1 · cloud×1 · cocktail×1
```

RAW FINDING: **the corpus is ALUPEC, categorically.** Of 366 ⟨c⟩ occurrences, all but four are inside
foreign loans, Latin quotations, or proper nouns; the four genuine etymological slips are `asisténcia`
(beside `asisténsia` in the SAME utterance), `acordu` (vs `akordu`), `caro`/`carro` (vs `karu`), and
`octogonal`. `ç` occurs **once** in the entire corpus.

Implication: **the Papiamento prediction does NOT transfer.** There is no orthography split to straddle
here, so — unlike pap, which had to ship Curaçaoan-spelled measure words to Aruban-orthography articles —
every word this layer emits can be spelled the one way the corpus spells everything else. That removes a
whole class of cost pap had to state. It does NOT remove the separator question (Run 3), which pap's round
turned on for a different reason.

---

## Run 3 — 2026-08-16 — the separators: BOTH marks do BOTH jobs, and the three-digit test costs exactly one

Question: pap's finding was that the DOT and the COMMA each both group and decimate, resolved by applying
the three-digit test symmetrically. Does kea do the same, or pick one convention?

`<scratch>/scan.mts` printing every `\d[.,]\d+` with 45 characters of context, read one at a time:

```
DOT ×55
  GROUPING (exactly three digits after the mark) ×43 —
    11.000 · 22.500 · 40.000 · 783.562 · 300.948 · 755.688 · 291.773 · 23.764 · 9.174 · 30.000 ·
    5.000.000 · 9.000 · 100.000 · 1.400 · 24.000 · 1.000 · 2.400 · 10.000 · 7.000 · 9.000 ·
    19.500 · 17.500 · 1.300 · 5.000 · 6.500 · 400.000 · 6.000 · 330.000 · 3.000 · 100.000 ·
    104.500 · 6.387 · 3.980 · 1.000º · 2.243 · 3.850 · ¥2.500 · ¥130.000 · ¥7.000 · 1.600 · …
  NOT GROUPING ×12 — 2.2 milhon · 152.4m · 2.4Ghz · 5.0Ghz · Figura 1.1 · 15.00 UTC (a CLOCK) ·
    802.11a · 802.11b · 802.11g · 802.11n ×2

COMMA ×17
  DECIMATING ×14 — 14,7 · 2,3 · 3,7 · 6,5 · 12,8 · 3,50 · 1,2 · 2,8 · 1,5 ×3 · 4,2 · 3,9 · 9,114
  GROUPING ×3 — "Ku 17,000 ilhas pa skodje" · "kintu y sestu ku 2,220 y 2,207 pontus"
```

RAW FINDING: **pap's structural finding REPRODUCES — each mark does both jobs — but the dominance is
inverted and the cause is different.** In pap the split was per-ARTICLE and per-ORTHOGRAPHY (Curaçaoan/Dutch
against Aruban/American). Here there is one orthography, the European convention dominates both marks
(dot groups 43/55, comma decimates 14/17), and the American convention leaks in on untranslated figures
carried over from the English source set — the Indonesian islands count `17,000` and the NASCAR points
`2,220 / 2,207`.

⚠ AND THE THREE-DIGIT TEST IS NOT FREE HERE, WHICH IT WAS IN PAPIAMENTO. pap recorded that "every grouped
instance in the corpus has exactly three digits after the mark and every decimal has one or two". kea has
ONE counter-example: `un staka di serka di 30 pes (**9,114 m**)` — 30 feet is 9.144 m, so this is a decimal
with a three-digit fraction, and the symmetric test reads it as 9,114 metres.

Priced both ways before choosing:
* test on both marks  → 3 groupings right (`17,000`, `2,220`, `2,207`), 1 decimal wrong (`9,114`)
* test on the dot only → 1 decimal right, 3 groupings wrong

3-for-1 in favour of the symmetric test. Taken, with the counter-example named in the file.

---

## Run 4 — 2026-08-16 — the engine probe: the grouping DOT is read as a FULL STOP

```
npx tsx <scratch>/probe.mts     # 70 attested forms through phonemize(x, "kea")
```

Question: what does the engine actually produce on the shapes Run 3 and the class census found?

RAW (the load-bearing rows):

```
"783.562 kilómitrus kuadradu" → setisˈẽtus oitˈẽtɐ tɾˈes . kiɲˈẽtus sɐsˈẽtɐ dˈos kilˈɔmitɾus kuɐdɾˈɐdu
"1.000 libras"                → ˈũ . zˈɛɾu lˈibɾɐs
"14,7 mil milhon di dóla"     → kɐtˈoɾzi , sˈeti mˈil miʎˈõ dˈi dˈɔlɐ
"11:20, pulísia"              → ˈõzi , vˈĩti , pulˈisiɐ
"na 323 a.C."                 → nˈɐ tɾezˈẽtus vˈĩti tɾˈes ˈɐ . k .
"8% konparadu"                → ˈoitu kõpɐɾˈɐdu
"nota Kanadianu di $5 y $100" → nˈotɐ kɐnɐdiˈɐnu dˈi sˈĩŋku ˈi sˈẽ
"AUD$45 milhon"               → ˈɐud koɾˈẽtɐ sˈĩŋku miʎˈõ
"35°W"                        → tɾˈĩtɐ sˈĩŋku v
"riba di +30°C é kumun"       → ɾˈibɐ dˈi tɾˈĩtɐ k ˈɛ kumˈũ
"37º país"                    → tɾˈĩtɐ sˈeti pɐˈis
"1º dia di mês"               → ˈũ dˈiɐ dˈi mˈes
"kosmonauta Nº 11"            → kosmonˈɐutɐ n ˈõzi
"2-3 km di jélu"              → dˈos tɾˈes km dˈi ʒˈɛlu
"120--160 métrus kúbikus"     → sˈẽ vˈĩti sˈẽ sɐsˈẽtɐ mˈɛtɾus kˈubikus
"3136 mm2 kontra 864"         → … mm dˈos …
"29¾ polegada pa 24½ polegada"→ vˈĩti nˈovi tɾˈes kuˈɐtu poleɡˈɐdɐ pˈɐ vˈĩti kuˈɐtu ˈũ dˈos poleɡˈɐdɐ
"B&Bs ta konpiti"             → b bs tˈɐ kõpˈiti
"5 mm (1/5 polegadas)"        → sˈĩŋku mm ˈũ sˈĩŋku poleɡˈɐdɐs
```

IMPLICATIONS, in the order they change the work:

1. **The grouping dot is a SENTENCE BREAK.** `783.562` reads as *783* · full stop · *562*, and `1.000
   libras` reads **"one, zero pounds"** because the trailing group's zeros go through the number path as
   `000`. 43 instances. This is the class the brief warns DROP cannot see, and it is the flagship defect.
2. **The grouping/decimal comma is a PAUSE.** 17 instances, same shape.
3. **The colon is a PAUSE** (`clausePunctuation` maps `:` → `,` in kabuverdianu.jsonc): every clock breaks
   its own sentence.
4. **`º` produces a READING, not garbage** (trap 56): `1º dia` reads *"one day"* and `37º país`
   *"thirty-seven country"*. Nothing counts it.
5. **`mm2` reads as the NUMBER two** — trap 53 exactly, and it is already shipped in the engine's default
   path rather than introduced by a refusal.
6. `¾`/`½` DECOMPOSE to two bare cardinals — *"twenty-nine three four inches"*.
7. Percent, every currency sign, the degree sign and the ampersand are silent.
8. Every range fuses its endpoints with no pause at all.

---

## Run 5 — 2026-08-16 — sourcing: there is NO wiki, NO espeak, and a 7-word referee

```
npx tsx tools/normalization/sources.ts --lang kea
npx tsx tools/normalization/attest.ts --lang kea --words "milímitru,kilograma,Celsius,…"
```

Question: what can be sourced from outside the corpus?

RAW:

```
[ ?? ] letter-names     ⚠ NO espeak-ng dictsource/ FOUND — the espeak tier was not consulted at all.
[NONE] scale-names      ° occurs, neither scale name in corpus/referee …
[chk?] unit-word        the corpus writes km×78 mm×26 m×25 km/h×24 g×9 kg×8 after a number
```

```
kea.wikipedia.org does not respond as a wiki — a negative from here is NOT evidence.
[exited with code 3]
```

And `$ESPEAK_NG=/home/chris/Programming/espeak-ng` has `pt_list` and `crh_list` but **no `kea_list`** —
espeak-ng does not ship Kabuverdianu at all. The referee is
`tools/referee-eval/referees/kea.kaikki-anchors.tsv`: **seven words**, none of them a unit, a currency or a
sign name.

RAW FINDING: **this is trap 51's floor with the floor removed — there is no wiki to be under.** zu and xh
ended on an unresolvable prompt because espeak ships neither; kea has neither espeak NOR a Wikipedia NOR a
usable referee. The haystack is the 1,931-utterance FLEURS corpus and nothing else.

⚠ And the lexifier is not a substitute (trap 55/38). Portuguese is fully treated and espeak ships `pt_list`,
but a Portuguese word attested in Portuguese sources says nothing about Kabuverdianu — this is exactly the
ckb/fa case, where the same two graphemes are a unit key in one language and an ordinary adjective in the
other. Every word below is a kea CORPUS token whose examples were read.

---

## Run 6 — 2026-08-16 — the vocabulary the corpus does supply, read in slot

`<scratch>/words.mts`, whole-word counts with the surrounding prose printed and read:

| slot | word | count | the example that settles the sense |
|---|---|---:|---|
| percent | `pur sentu` | ×13 | `34 pur sentu di partisipantis`, `46 pur sentu di votus`, `90 pur sentu di lus solar` — 8 of the 13 are digit-adjacent |
| dollar | `dóla` | ×5 | `un taxa di 30 dóla, ô 10 dóla pa pasi di un dia` |
| pound | `libra` | ×2 | `libra Falkland (FKP), se valor é ekivalenti a un libra Britániku (GBP)` |
| kilometre | `kilómitru` | ×4 | `un sidadi 50 kilómitru (31 milhas) di Buenos Aires` |
| metre | `métru` | ×5 | `fika peloménus 100 métru di distánsia di ursus` |
| centimetre | `sentímitru` | ×1 | `stima ma 6 sentímitru di prisipitason pode ronpe dikis` |
| mile | `milha` | ×6 | `800 milha di Sistéma di Oliodutu Trans-Alaska` |
| squared | `kuadradu` | ×6 | `783.562 kilómitrus kuadradu (300.948 milha kuadradu)` — position AFTER |
| cubed | `kúbikus` | ×1 | `Kel Luno tinha 120--160 métrus kúbikus di konbustível a bordu` |
| hour | `óra` | ×16 | `240 kilómitru pa óra (149 milhas pa óra)` |
| second | `sigundu` | ×30 | `12,8 km ô 8 milhas pa sigundu` |
| rate joiner | `pa` | — | `pa óra` ×4 · `pa sigundu` ×2 · `pur óra` ×1 · `baril pur dia` ×1 |
| degree | `grau` | ×4 | `apénas alguns grau a norti di ekuador` (latitude) · `na 90(F)-grau di kalor` (temperature) |
| number sign | `númeru` | ×27 | `riatoris Númeru 1 y 2 di se sentral di Shika fitxadu` |
| magnitudes | `milhon` ×25 · `milhons` ×6 · `mil` ×10 | | `10 mil milhon di euros`, `2,3 milhon di galon` |
| connective | `di` | ×3983 | `milhons di dóla` |
| ampersand | `y` | ×1106 | the ordinary conjunction |
| fractions | `meiu` ×19 · `tersu` ×4 · `kuartu` ×11 · `kintu` ×7 | | `un tersu sta kubertu pa agu`, `un kintu ta trabadja na agrikultura`, `mudansa di kuartu pa meiu kilómetru` |
| ordinals 1–10 | priméru ×68 · sigundu ×30 · terseru ×5 · kuartu ×11 · kintu ×7 · sestu ×3 · sétimu ×2 · oitavu ×1 · nonu ×1 · désimu ×7 | | `termina na kuartu, kintu, y sestu lugar`, `désimu oitavu` |
| era | `antis` ×49 · `dipôs` ×109 · `Kristu` ×1 | | `antis di Sigundu Géra Mundial`, `dipôs di géra`, `selebra risureison di Kristu` |

⚠ TWO SENSE TRAPS FOUND AND HANDLED, both of the shape the playbook warns about:

* `grau` — of its four instances, one is an ACADEMIC DEGREE (`un 2:2 (un grau di sigundu klasi inferior)`)
  and one is "to a certain extent" (`nun sertu grau`). The other two are the two senses this layer needs
  (latitude and temperature), so the word is confirmed by reading, not by counting. Its plural `graus` ×1 is
  the abstract "levels" and is NOT the measurement word.
* `libra`/`libras` — `libras` ×5 is the POUND WEIGHT (`un pesoa ki ta peza 200 libras (90kg)`), and only the
  singular in `un libra Britániku (GBP)` is the currency. The `£` key takes `libra`.

---

## Run 7 — 2026-08-16 — the refusals, each measured

| class | count | why refused |
|---|---:|---|
| `mm` | 26 digit-adjacent | no kea word anywhere. `milímitru` ×0 in the corpus, no wiki, no espeak. The corpus DOES attest the `-mitru` stem twice (`kilómitru`, `sentímitru`), so `milímitru` is a compositional near-certainty — and it is still a word nobody has written. Leaving the key undeclared is NEUTRAL (the abbreviation stays exactly as it reads today), which is what makes the refusal safe (trap 53). Priced: 26 instances continue as a raw /mm/ cluster. |
| `kg` | 8 | `kilograma` ×0, `kilu` ×0, `quilo` ×0. Same shape, same refusal. |
| Celsius / Fahrenheit | `°C` ×1 | `Celsius` ×0, `Fahrenheit` ×0, `centígradu` ×0. `sources.ts` reports `[NONE] scale-names` independently. The degree WORD ships; the scale letter is left, as Hawaiian did. |
| compass letter after `°` | `35°W` ×1 | kea west is `oesti` ×7 and the corpus never writes `W` for it. This is the Aragonese `ueste` case (trap 55) with the evidence pointing the other way: a ported `W`→west arm would be asserting an abbreviation the language does not use. |
| yen `¥` | ×3 | no yen word in any kea source. |
| decimal word | 14 decimal commas + 6 decimal dots | `vírgula` ×0. `pontu` ×11 is "point of view" / a sports point / the full stop of a sentence (`pontu final des frazi`) — never the decimal separator. The mark is SPENT ON A SPACE rather than spoken, which is exactly Hawaiian's position and for the same reason. |
| plus `+` | ×2 | `mais` ×0. And one of the two instances does not want a word: `tenperaturas riba di +30°C` — `riba di` IS "above", so the sign is redundant with the preposition (the playbook's own trap-48 finding). The other, `(UTC+1)`, is contentful and is the price of the refusal, stated. |
| minus / `=` / `<` / `>` / `×` / `÷` / `±` | ×0 each | the signs do not occur. Every one of the 14 digit-flanked hyphens is a RANGE or a SCORE (`2-3 km di jélu`, `5-3 kontra Atlanta`, `1418 - 1450`, `26 - 00`, `1644-1912`); there is no negative number in this corpus. |
| ordinal `º` above 10, and every `ª` | 3 + 2 | the ordinal series is attested 1–10 and again as `désimu X` / `vijésimu X`, but `37º`, `60º` and `1.000º` would need `trijésimu`/`sesajésimu`/`milésimu`, which are ×0. ⚠ AND THE FEMININE IS A SEPARATE REFUSAL: kea DOES inflect the low ordinals (`Priméra Géra` ×6, `Sigunda Géra` ×8, `Terséra Klasi` ×1) but the two `ª` instances are `7ª maior ilha` and `5ª lugar`, and `sétima`/`kinta` are ×0. Both refusals leave the indicator exactly as it reads today. |
| `etc.` ×8, `E.D.C.` ×1 | | no kea reading attested; the era rule's left guard excludes a preceding dot so `E.D.C.` is not half-claimed. |

---

## Run 8 — 2026-08-16 — the sibling re-measurement (trap 55)

Every claim carried over from Papiamento and from Portuguese, re-measured on kea's own corpus.

| claim | source | held? |
|---|---|---|
| two live orthographies in one corpus | pap | **NO** — ALUPEC is categorical (Run 2) |
| both marks group AND decimate | pap | **YES** (Run 3) — structurally identical, dominance inverted |
| three-digit test is free | pap | **NO** — `9,114 m` costs one (Run 3) |
| the dash is spent on a PAUSE, not a connective | pap/haw | **YES** — kea writes `entri X y Y` / `100 a 250 métrus` / `3 a 5 pur sentu` in full where it means it |
| en/em dash appears between digits | pap/haw | **NO** — `–` ×1 and `—` ×6 are all PARENTHETICAL; the range mark is the ASCII hyphen ×14 and a DOUBLE hyphen ×4 (`120--160`, `1469--1539`, `7--2`, `1995--96`) |
| no clock rule (the colon is a ratio) | pap | **NO, INVERTED** — pap's only digit-colon was the Curaçao flag's stripe ratio. kea has **20 colons and 17 are clocks** (`11:20`, `9:30 óra lokal`, `06:30 y 07:30`, `07:19 ora lokal (21:19 GMT)`). The 3 non-clocks are `un 2:2 (un grau di sigundu klasi inferior)` — a UK degree classification — and `rifiridu komu 3:2`, a ratio; a two-digit minute requirement declines both. |
| `º` U+00BA stands in for the degree sign | pap/an/ast | **NO, INVERTED** — of 9 `º`, **seven are the genuine masculine ORDINAL indicator** and one is `Nº`. Only `90º` is a degree, and it is the one that is not followed by a letter. The real degree sign `°` is a separate ×2. |
| the separators need no layer (the tokenizer reads them) | pt | **NO** — `phonemize("783.562 quilómetros","pt")` → *setisẽtus e oitẽtɐ e tɾeʃ mil kiɲẽtuʃ…* and `14,7` → *catorze **vírgula** sete*. pt's number tokenizer does both; kea's does neither, and kea has no `vírgula` to say. |
| the ordinal indicator needs a gendered series | pt | **PARTLY** — pt composes `feminineOrdinal()` over the full range; kea's is attested only 1–10 masculine, so the layer claims that and refuses the rest (Run 7). |
| `por cento` / `por ciento` shape | pt/es | **YES, in kea spelling** — `pur sentu`, two words, ×13 |

Ratio: **five of nine pap claims held, four did not.** That is squarely in the band the playbook records
(4/6 for an/ast, 7/10 for rn/rw, 3/4 for hil/ceb) and it is why every rule was re-measured.

---

## Run 9 — 2026-08-16 — two defects the FIRST version of the layer introduced, and how each surfaced

Both were found by re-probing the corpus's own instances rather than by any gate, and both are worth
recording because they are trap instances one step removed from the trap's own statement.

**(a) A REFUSAL UNDONE ONE LINE LATER.** Step 6 declines an ordinal above 10 and returns the match
unchanged; step 7 then read the surviving `º` as a degree, so `37º país` — which the refusal exists to
leave alone — came out **`tɾˈĩtɐ sˈeti ɡɾˈɐu pɐˈis`**, "thirty-seven degrees country". The guard was
written `(?![\p{L}\p{M}])` and the next character in `37º país` is a **space**. Fixed to
`(?!\s?[\p{L}\p{M}])` and re-measured on all three refused instances (`37º`, `60º`, `1.000º`) plus the one
degree (`90º.`). This is the general shape of trap 53: a refusal is only neutral if nothing downstream
picks the residue up.

**(b) TRAP 58, ON THE CLOCK, ON THE CORPUS'S FIRST CLOCK.** The fleet-standard clock guard
`(?![\d:.,])` declined `**11:20**, pulísia pidi manifestantis` — the comma is a CLAUSE mark, not a third
field. Narrowed to `(?![\d:])(?![.,]\d)`, which is exactly the `[.,]\d` form trap 63 spells out for the
de-grouping arms three steps above it.

⚠ AND A THIRD, WHICH IS TRAP 39 ONE LEVEL UP AND WAS *NOT* A DEFECT SO MUCH AS A DEAD RULE. The first
version carried `(\d)\s?¾` / `(\d)\s?½` arms emitting `29 y tres kuartu`. They type-checked, they passed
when `normalizeKabuverdianu` was called directly — and they were **dead in the pipeline**, because
`core/unicode.ts` folds `¾` → ` 3/4` at the registry dispatch point before any engine's `text()` runs. The
tell was that `phonemize` and the local function disagreed. Rewritten onto the ASCII shape the fold
produces; the tests now assert through `phonemize` for exactly this reason.

⚠ The fold's documented cost is the mixed-number conjunction: `29¾` reads *vinti novi tres kuartu* rather
than *vinti novi **y** tres kuartu*. `registry.ts` has a `VULGAR_FOLD_OPT_OUT` set for the nine languages
that read it better locally, and kea is a candidate — but that is a SHARED file, so it is in the backlog
rather than in this commit.

---

## Gates

| gate | before | after |
|---|---|---|
| `corpus-diff` changed | — | **126/1931 (6.5 %)** |
| `corpus-diff` DROP | **19** | **7** |
| DIGIT / SLOT-GAP / RAWMARK / ZERO-WIDTH / RAW-CAPS / THROW | 0 / 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 / 0 |
| `review.ts --lang kea` | sign classes FAIL (8 dropped), tests FAIL | **sign classes ok · sourcing ok · clause-final ok** (`artifact tracked` FAIL — kea has no mined artifact; expected) |
| `referee-eval kea` | raw 0/7, folded 7/7, symbol 100.0 % | **identical — raw 0/7, folded 7/7, symbol 100.0 %** |
| `npx tsc --noEmit` | clean | clean |
| `npx vitest run` | — | **4,648 passed, 1 failed** — `languageCatalogue`, "1 cell(s) differ", the expected regeneration |

THE SEVEN REMAINING DROPS, read one at a time:

```
DROP:minus  ×4   every one a DOUBLE-HYPHEN range — `1995--96`, `1469--1539`, `120--160`, `7--2`.
                 The DROPPABLE minus regex's digit lookbehind rejects the first hyphen and matches the
                 second (the `mos` case already recorded in defects.ts). All four READ CORRECTLY as
                 spans; registered under `minus`.
DROP:math-sign ×2  `(UTC+1)` and `riba di +30°C` — the two `+`; registered under `plus`.
DROP:currency  ×1  `entri ¥2.500 y ¥130.000 … serka di ¥7.000` — the yen, refused for want of a word.
                 NOT registered as a class silence, because the currency class as a whole IS read
                 (`$` and `£` both have sourced words) and a class-level exemption would hide that.
```

## Backlog surfaced, not fixed

1. **`mm` ×26 and `kg` ×8 have no kea word in any reachable source.** This is the largest single gap the
   layer leaves and it is a SOURCING problem, not a coding one. The corpus attests the `-mitru` stem twice
   (`kilómitru`, `sentímitru`), so `milímitru` is compositionally near-certain; nothing in this tree has
   written it. What would move it: a Kabuverdianu dictionary, or an ALUPEC-orthography text corpus. Same
   for `kilograma` / `kilu`.
2. **No Celsius or Fahrenheit name.** `20 °C` reads *vinti grau k*. Same sourcing floor.
3. **`kea` is a candidate for `registry.ts`'s `VULGAR_FOLD_OPT_OUT`.** The mixed-number conjunction is
   `y` ×1106 and its position is settled (`29 y tres kuartu`); the fold cannot supply it. Not done here
   because `registry.ts` is shared and a core change is the reviewer's call.
4. **The ordinal series above 10.** `désimu X` and `vijésimu X` are attested compositional patterns; the
   round tens above 20 are not. Three corpus instances (`37º`, `60º`, `1.000º`) are waiting on it.
5. **The feminine ordinal.** kea inflects the low ordinals (`Priméra`, `Sigunda`, `Terséra`) but the two
   `ª` in the corpus need `sétima` and `kinta`, both ×0.
6. **`etc.` ×8** — the corpus's most frequent dotted abbreviation, with no attested kea expansion.
7. **`E.D.C.` ×1** — the reading is not established even as a Portuguese abbreviation; deliberately left
   whole by the era rule's left guard.
8. **There is no mined artifact for kea and no wiki to build one from.** `mine.ts fetch --fill` (trap 25)
   is unavailable for the same reason `attest.ts` is, so the cell inventory can never be evaluated for
   this language from a Wikipedia source. If kea is to get an artifact it will have to come from the
   FLEURS transcripts alone, which is a smaller ruler than any other language in the sweep has.
9. **`AUD` is consumed with its `$`.** `AUD$45 milhon` reads *korenta sinku milhon di dóla* — correct as a
   currency amount, but the "Australian" is gone. The tier has no slot for a qualified currency name and
   one instance does not justify inventing one.

