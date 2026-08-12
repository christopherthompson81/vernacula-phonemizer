# ak (Akan / Twi) — text-normalization investigation

Worktree `/tmp/vp-norm-ak`, branch `norm/ak`. Method: `docs/normalization_playbook.md`.

## Run 1 — 2026-08-12 09:10 (orientation and the baseline gates)

**Question.** What evidence exists for `ak` at all, and what is the pre-change state of every gate?

**Commands and raw findings.**

`ls src/languages/akan/` → `akan.ts`, `akan.jsonc`, `akan-tone.tsv`. **No `normalize.ts`.**
Golden file is `test/akan.test.ts` (75 lines, named after the LANGUAGE, not the code).

```
tools/corpus/mined/ak.jsonc   → DOES NOT EXIST
tools/corpus/attest/ak.jsonc  → DOES NOT EXIST
```

So step 0b of the playbook is the first job, and there is no FLEURS (`$FLEURS` is unset in this
environment and `ak` has no FLEURS corpus).

```
npx tsx tools/referee-eval/eval.ts ak
  === ak vs kaikki Akan (Wiktionary, human, small) [primary] (20 words) ===
  raw exact:      0/20 (0.0%)
  folded backbone:14/20 (70.0%)
  symbol accuracy:91.8%
  residuals: dwa≠duia, obwe≠obue, wɔfa≠uɔfa, wanim≠wunim, wafɔn≠wafɔŋ, abirantiɛ≠abiranti
```

⚠ The task brief said `ak` has neither wikipron nor kaikki. The catalogue columns are indeed empty, but a
**20-word kaikki human-gold set does exist** and `eval.ts` runs on it. Twenty words, all of them ordinary
lexical items — no digits, no symbols, no punctuation — so it is a **TRIPWIRE, not a meter**: it can tell
me I broke the word path, and it can say nothing whatever about a normalization rule. The residuals are
all glide-formation / ATR / vowel-quality disagreements in the g2p, none of them in this layer.

```
npx tsx tools/normalization/review.ts --lang ak
  [FAIL] normalizer  src/languages/akan/normalize.ts missing   (1 FAILING)
```

```
npx tsx tools/normalization/sources.ts --lang ak
  [NONE] letter-names     espeak does not ship this language at all
  [NONE] decimal-point    no _dpt, no _., no manifest word
  [  · ] era-phrase       no era marker in the corpus
  [NONE] scale-names      ° occurs, neither scale name anywhere
  [chk?] percent-word / currency-word / minus / equals / times / ampersand / plus / exponent
  espeak: NOT SHIPPED · referee: 22 lines · corpus: 226 lines (incl. mined artifact)
```

**Implication.** espeak ships no Akan, so §5c's phonetic fallback is closed and letter names are
structurally blocked (no initialism seam — trap 16 checked: the seam exists, the DATA does not). Every
word this layer emits has to come from the corpus itself, from the engine's own number data, or from
`attest.ts`. Next: build the corpus.

## Run 2 — 2026-08-12 09:25 (the corpus — and ak.wikipedia is LOCKED)

**Question.** Where does Akan text come from?

```
curl -sSI https://dumps.wikimedia.org/akwiki/latest/akwiki-latest-pages-articles.xml.bz2
  → 252,206 bytes
python3 tools/normalization/wikidump-to-text.py akwiki.xml.bz2 ak.txt
  → pages seen 417, paragraphs written 1
cat ak.txt
  → "This wiki has been locked (see discussion). To contribute, please go to Twi Wikipedia or
     Fante Wikipedia."
```

**The whole of ak.wikipedia is ONE paragraph, and that paragraph is the lock notice.** The language's own
ISO-639-1 wiki is closed. Wikimedia split it into two variety wikis:

```
twwiki   6,942,974 bytes → pages 7,649 → 39,513 paragraphs (10.6 MB) after filter-markup (dropped 0.9%)
fatwiki  3,543,818 bytes → pages 4,686 → 14,751 paragraphs (3.5 MB) after filter-markup (dropped 1.4%)
```

`tw` is **Asante/Akuapem Twi**, which is the variety `akan.jsonc` implements (its cardinals are the
Asante series: baako, mmienu, aduonu, ɔha, apem). `fat` is **Fante**, a different orthography and a
different numeral series (ebien, ebiasa, anan, enum, esia, esuon, eduonu, eduasa — see Run 5). Both are
Akan and the registry serves both under `ak`, so **the artifact is mined from both and every count below
is reported per variety**. Where a rule rests on Twi evidence only, the file says so.

**Contamination measured before mining** (playbook: a small wiki is not all in its own language):

```
tw.txt  ak-dominant 27,508 · English-dominant 1,790 (4.5%) · tie 2,682 · short 7,533
fat.txt ak-dominant  9,049 · English-dominant 1,195 (8.1%) · tie 1,861 · short 2,646
```

`filter-by-language.py` had no `ak` row; added one (function words shared by BOTH varieties — the row is
deliberately NOT diagnostic between Twi and Fante, because they are one language; it is diagnostic
against English, which is what these wikis actually carry).

```
python3 tools/normalization/filter-by-language.py --lang ak --in tw.txt  --out tw.ak.txt
  kept 27,415 (69.4%) · short 7,910 · undecidable 2,473 · english 1,715 (4.3%)
python3 tools/normalization/filter-by-language.py --lang ak --in fat.txt --out fat.ak.txt
  kept 9,029 (61.2%) · short 2,722 · undecidable 1,836 · english 1,164 (7.9%)
```

```
npx tsx tools/normalization/mine.ts mine --in tw.ak.txt,fat.ak.txt --out tools/corpus/mined/ak.jsonc \
    --lang ak --segment paragraph --source "…" --per-cell 6 --sample 40
  → 35,517 unique paragraphs, covered 31/35 cells, 186 hard + 40 sample
  EMPTY: ordinal-native ordinal-range iteration calendar
```

`ordinal-native` and `calendar` are LEXICAL cells and need a `--terms` file; see Run 6.

**Baseline gates, on the fresh artifact and before any engine edit:**

```
corpus-diff emit --lang ak --corpus mined:ak   → 225 utterances
mine.ts scan --in tools/corpus/mined/ak.jsonc --lang ak
  DROP percent       ×22
  DROP currency      ×11
  DROP math-sign     ×10
  DROP ampersand     ×8
  DROP degree        ×7
  DROP exponent      ×6
  DROP minus         ×4
  REDUNDANT currency ×1
```

⚠ Two of those examples (math-sign, ampersand) come from ONE line of MediaWiki edit-link boilerplate
("Nsɛm a ɛwɔ saa atwerɛwsɛm yi mu … [//tw.wikipedia.org/w/index.php?title=…") that `filter-markup.py`
did not catch — one line in the artifact. Recorded rather than hand-removed: the artifact must stay
regenerable from the recorded command (trap 32).

## Run 3 — 2026-08-12 10:05 (tabulation and engine probes)

**Question.** What does Akan text actually contain, and what does the engine do to it?

Counts over the two filtered dumps (tw = 27,415 paragraphs / 9.4 MB; fat = 9,029 / 3.0 MB):

```
                                  tw     fat
apostrophe elision n'/w'/m' + V  4930    2664     ← the largest class in the language
percent %                        3033    2121
comma grouping                   3128    2171
decimal dot                      3421    2118
4-digit year                    23321   10323
hyphen digit pairs (bare)        1125     264     (ascending 807 / 190)
dotted abbreviation              940      222
English ordinal suffix (24th)    528      254
roman numeral                    394      138
units km/cm/mm/kg (digit-adj)    168       14
unit m (digit-adjacent)           81       21
degree sign                      139       38     (°C/°F 103 / 24)
currency sign  $ 97 € 24 £ 31 ₵ 8       $ 6 £ 3 ₵ 2
ampersand (non-entity)           230       91
equals                           108        5
slash n/n                        119       47
colon clock shape                 68        9
times ×                           19       11
plus                              18        3
leading minus                     39        7
superscript ² ³                   17        3
dot grouping — CHAIN of 2+        28        0     (single `.ddd` is 35 / 10 and is a DECIMAL)
space grouping                    29        2
ISBN                              18        5
```

**Engine probes on the attested shapes — the defect list, measured not assumed:**

```
49.6%              → adwanan ŋkron . nsia                    the sign is SILENT; the point is a PAUSE
16,083             → du nsia , adwɔwɔt͡ɕʷɪ mmiɛnsa            grouping comma → a PAUSE, wrong number
1.8                → baako . ŋʷɔt͡ɕʷɪ                          decimal dot → a SENTENCE BREAK
3 500 nnipa        → mmiɛnsa ahanum nnipa                    space grouping → two numbers
n'awofoɔ           → n awʊfwɔ                                a BARE CONSONANT as a word (×7,594)
w'ate              → w ate                                   the same, on the 2sg clitic
1989-1997          → two bare cardinals, no connective       (×1,389 bare pairs)
afe 3500 A.Y.B.    → … a . j . b .                           3 spurious clause breaks (era marker)
U.S.A.             → u . s . a .                             3 more
€126 million       → ɔha adwonu nsia million                 the sign is silent
GH₵50              → ɡh adwonum                              the cedi sign is silent
12 km              → du mmienu km                            the abbreviation reaches the IPA raw
5 kg               → nnum kɡ                                 …and as an impossible cluster
37.2 °C            → adwasa nson . mmienu k                  ° silent, C read as a bare [k]
45 km²             → adwanan nnum km                         unit raw, exponent gone
24th February      → adwonu nnan th febrwarj                 the suffix letters reach the IPA
S&P                → s p                                     the ampersand is silent
```

⚠ **THE ENGLISH FOREIGN-WORD READER IS DEAD CODE, so the hazard the brief warned about does not exist
here.** `registry.ts` wires `createAkan((latin) => getPhonemizer("en").text(latin))`, but `akan.ts`'s
`createAkan(foreign?)` never references `foreign` in its body — `TOKEN` matches `LATIN_RUN` and every
match goes through `phonemizeWord(nat(...))`. So an unrecognised Latin run is read by the AKAN g2p
(`February` → *febrwarj*), not by English. A defect therefore hides as plausible-sounding **Akan-ish**
gibberish rather than as a plausible English word — same class of invisibility, different disguise, and
the probe above is what settles it. Not changed: wiring the parameter up would alter the reading of every
foreign name in the language and is not this layer's call.

`ak` is NOT in `registry.ts`'s `ROMAN_NATIVE`, so Roman numerals are digits before `text()` runs (394+138
instances, mostly regnal `II`/`III`). No roman rule needed here.

## Run 4 — 2026-08-12 10:40 (sourcing: the corpus glosses itself)

**Question.** Does Akan have attested words for percent, the decimal point, a range and a unit?

This corpus does something unusual and very useful: **it spells the reading out beside the figure**.

```
"ɔde ɔha nkyekye mu aduonum-mmienu ne akyiripɔ nson ne nnum(52.75%)"
"ɛgyina hɔ ma ɔha mu nkyekyɛmu aduasa mmienu akyiripɔn aduasa (32.30%)"
"ɔha mu nkyekyɛmu aduonum baako ne akyire pɔ hwee (51.0%)"
"ɔha nkyekyemu susupɛn aduosia-nan ne akyiripɔ aduonu (64.20%)"
```

**PERCENT — `ɔha mu nkyekyɛmu`, PREPOSED.** Total of the family: **1,387 tw + 215 fat**, in both varieties.

```
ɔha nkyekyɛmu 352 · ɔha mu nkyekyɛmu 324 · ɔhamu nkyekyɛmu 298 · ɔha mu nkyekyɛm 125 …   (tw)
ɔha mu nkyekyɛmu 113 · ɔha nkyekyɛmu 45 · ɔha mu nkyekyɛ 33 …                            (fat)
```
`ɔha mu nkyekyɛmu` is the plurality across both (437). The position is settled by every instance read:
the word comes BEFORE the figure ("ɔha mu nkyekyɛmu 49.6%", "ɔha nkyekyɛmu 44.6%"). The only 24 hits of
a word AFTER the sign are `25% ɔhaw` — *ɔhaw* is "chance/risk", a different word (trap 2 avoided).

**DECIMAL POINT — `akyiri pɔ`, and this one is TWI ONLY.** 1,137 tw / **1** fat.

```
akyiri pɔ 355 · akyirepɔ 347 · akyiripɔ 243 · akyire pɔ 60 · akyire po 46 · akyirepɔn 24 …
```
Every instance read sits between the integer part and the fractional part of a figure the sentence also
writes in digits, which is attestation in exactly the slot — the strongest form there is, because the
source document glosses itself. ⚠ **Fante writes `ekyir pɔw`** ("nyaa ɔha nkyekyɛmu esia na n'ekyir pɔw
eduowɔtwe"), the same morpheme in the Fante shape. The layer ships the Twi form and the header says so.

**THE FRACTIONAL PART IS READ AS A CARDINAL, not digit by digit** — 55.77 → *… ne akyiri pɔ aduɔson nson*
(77), 32.30 → *akyiripɔn aduasa* (30), 0.53 → *hwee ne akyiripo aduonum mmiensa* (53), 64.20 →
*akyiripɔ aduonu* (20). One counter-example: 52.75 → *akyiripɔ nson ne nnum* (7 and 5). Fraction lengths
in the corpus: **1 digit 2,638 · 2 digits 2,969 · 3 digits 81 · 4+ 13**. So the attested convention covers
1–2 digits and there is nothing at all behind a cardinal reading of a longer tail (nor behind a leading
zero, which a cardinal cannot express: `1.05` ≠ "point five"). Rule: cardinal for a 1–2 digit tail with no
leading zero, digit-by-digit otherwise. Both branches pinned (trap 13).

**RANGE — `kosi`.** `N kosi M` occurs **569** times in tw (`kosi` 423, `kɔsi` 127, `kɔpem` 30, `kosii` 15)
and **150** in fat (`kesi` 88, `kɛpem` 42, `kosi` 43…). Part of speech checked (the Fula `hakkunde`
lesson): it is used as an INFIX between the two operands — "fi afe 2017 kosi 2022", "fi 1948 kosi 1955",
"fri afe 2005 kosi 2007". 316 of the 569 follow an explicit *fi/firi* ("from"), which leaves **253 bare**
`N kosi M` — so the infix does not depend on the preposition being present.

**UNITS — the words are already in the corpus, and one sentence glosses the abbreviation.**

```
"Park no yɛ 24 kilomita fi Damongo, ɔma ntam ahenkurow no, 146 km wɔ Tamale"
```
One sentence, both spellings, same unit. `kilomita` 178 tw / 59 fat, `mita` 358 / 94. That is trap 38's
case: not a missing word, a missing KEY. Digit-adjacent `km` is 76/8 and digit-adjacent `m` is 81/21 —
every one of the `m` instances read is a genuine metre (athletics distances `100m`, `1,500m`, `5.20m`,
heights `23m`, `62 m`).

**CURRENCY — `dɔla` and `cedi`, PREPOSED; `€` and `£` DECLINED.**
`dɔla` ×125 tw, in the money slot and before the amount: "dɔla 10,000", "U.S. dɔla ɔpepem 2.3",
"Canada dɔla ɔpepem 481". `cedi`/`cedis`/`sidi` ×31 tw + 6 fat, likewise: "Ghana cedis ɔpepem 59.9",
"Ghana cedi no cedi apem mmienu ne aha nsia (GHc 2600)" — and it is Ghana's own currency.
`euro`/`yuro` counts 784 tw but reading them kills it: the overwhelming majority are the FOOTBALL
tournament ("UEFA Mmea Euro 2017", "2009 U-17 Euro", "Euros mu") or the continent (*Europa*); only two
sit in a money slot ("euro ɔpepem 340", "(Euros152,500)"). That is trap 37 exactly — a healthy count on
the wrong sense — so `€` (24 tw) stays unread. `pound` ×12 is mostly "Ghana Pound", the historical
currency, and the anatomical loan "paunch"; `£` (31 tw) stays unread too.

**ERA — `A.Y.B.` (BC) ×155 tw + 25 fat and `Y.B.` (AD) ×43 + 13, and NEITHER IS EXPANDABLE.**
"afeha a ɛto so 3 Y.B." = "the 3rd century AD"; "wɔ mfirihyia apem a ɛto so abien A.Y.B." = "in the 2nd
millennium BC". The expansion is not in the corpus: `ansa na Yesu mmae` occurs **once**, and not beside
the abbreviation. Trap 37 says the bare phrase is not the attestation, so the era marker is NOT expanded —
only its interior dots are removed, which is a pause fix and nothing more (the bm precedent).

**DEGREES / SCALE NAMES — nothing.** `°C`/`°F` ×103 tw + 24 fat. `Celsius` ×1, `Fahrenheit` ×2. The 354
tw + 353 fat hits for "degree" are the ACADEMIC degree ("Master's degree", "bakyela degree wɔ Law"), i.e.
trap 37 again. No degree word, no scale name → `°` stays unread and `°C`'s C keeps reading as [k]. Red.

## Run 5 — 2026-08-12 11:15 (an accidental referee for the NUMBER path — and a refusal)

**Question.** The corpus glosses years ("afe apem ahankron ne aduokron nsia (1996)"). Does the engine's
own cardinal agree?

Extracted every `(\d{1,7})` preceded by a run of Akan numeral words: **459 distinct numbers, 2,533
glosses**. Compared against `numberWords()` (restricted to numbers glossed ≥2 times, 179 compared):

```
exact 43 · differ ONLY by the connective "ne" 62 · other 74
```

The 74 "other" are Fante numerals (a different series entirely — 25 = *eduonu enum*, 99 = *eduokron
akron*), orthographic variants the manifest spells with ⟨ɔ⟩ and the wiki with ⟨o⟩ (aduɔson/aduoson,
aduɔkron/aduokron), the alternative 200 (*aha mmienu* ×17 beside *ahanu*), and extraction artifacts.

The one systematic difference is **`ne` before the final sub-hundred group** — 1996 = *apem ahankron **ne**
aduokron nsia*, 2004 = *mpem mmienu **ne** nan*. Measured over the whole tw dump:

```
hundreds + ne + tens   1441      hundreds + tens   565
thousand + ne + …        53      thousand + hundreds   2324
tens + ne + unit         20      tens + unit      2999
```

**DECLINED, and this is a measured refusal rather than an omission.** `ne` is the majority but it is not
the only attested form: the no-`ne` variant has 565 instances of its own, and for several individual years
it is the *plurality* gloss (1958 *apem ahankron aduonum nwɔtwe* ×7 vs ×4 with `ne`; 1978 ×8 vs ×4; 1991
×11 vs ×7; 1943 ×3, no `ne` at all). The engine's current output is therefore an attested variant, not a
defect, and swapping one attested variant for another is not what this layer is for — it would churn the
committed goldens for a stylistic preference. Re-running the check costs one command
(`numgloss.mts`, which needs `numberWords` temporarily exported from `akan.ts`).

**Negative results from the same pass, each of which closes a rule I would otherwise have written:**

- **Fractions `n/n` — DECLINED.** 119 tw + 47 fat, and they are not fractions: UN resolution numbers
  (`60/147`, `64/292`), slash DATES (`12/01/2008`, `29/02/1952`), disability sport classes (`LW 10/11`).
  One real fraction in the sample (`1/8 inch`). No denominator series exists to compose from either
  (`sources.ts` says `[NONE] fraction-series`).
- **Clock — DECLINED.** 68 tw + 9 fat colon-numerals, and the majority are not clocks: sports times
  (`1:30.00`, `1: 43.55`), a UTC offset (`UTC+14:00`), map scales (`1:50,0000`), scripture (`1 Petro
  4:16`). Two or three are real (`wui wɔ 13:38`, `awia 5:30`). No Akan reading of a digital time is
  attested anywhere. The ln precedent.
- **`= × +` — DECLINED.** `=` ×108 is mostly `==` heading residue that survived extraction, plus
  linguistic glosses; `×` ×19 is a botanical hybrid (`Citrus × latifolia`) or a relay dimension
  (`mita 4 × 100`), which is "by" and not "times" (the bm finding); `+` ×18 is `Senegal + Liberia`,
  `pseudo + epistaxis`, `UTC +14:00` — never arithmetic.
- **MINUS — DECLINED, AND KNOWN-WRONG RATHER THAN ACCEPTABLE.** All 39 tw leading minuses read back as
  EN-DASH RANGES (`1862 –1961`, `35 –40 m`, `14 – 28 mm`) which the range rule claims, plus coordinates
  (`6.28ɛ°N 1.850°W / 6.28ɛ; -1.850`). The coordinate is a genuine negative and there is no Akan word for
  one. ⚠ So it is NOT added to `ACCEPTED_SILENT` and `review.ts --lang ak` stays red on it: an accepted
  silence claims the drop is correct, and this one is not (the ln/bm precedent).
- **EXPONENT — DECLINED.** `²`/`³` ×17 + 3, `km2`/`m2` ×26 + 25. No square or cube word is attested
  (`ahinanan`, `square`, `kubik` all ×0 in the money slot or at all). The unit rule therefore REFUSES a
  key followed by `2`/`3`/`²`/`³`, so `km²` reads exactly as it did before rather than becoming a
  confidently wrong LENGTH.
- **`No.` — DECLINED, and this one was a near miss.** A naive `\bNo\.\s?\d` count says 51 tw. Reading them
  shows almost all are the Akan definite article `no` ending a sentence, followed by a numbered list item
  ("… mu no. 2. Akanfoɔ yɛ nhwehwɛmu…"). Claiming it would delete a real sentence pause. Trap 2.
- **ISBN — no rule, but the RANGE rule had to be guarded for it.** 18 + 5 instances; `978-9988-…` is
  exactly the shape the range rule looks for, so the rule rejects a hyphen CHAIN (a hyphen-digit on either
  side), which is the ln guard.
- **DOT GROUPING is only safe as a CHAIN.** `\d{1,3}\.\d{3}` is ambiguous in this corpus: 28 tw instances
  are population figures with two or more groups (`3.038.217`, `48.168.996`) and 35 are three-decimal
  DECIMALS (`0.206 km`, `1.132B`, `4.568`, `1.850°W`). So only a chain of **two or more** groups
  de-groups; a single `.ddd` is left to the decimal rule. Comma grouping has no such problem (the comma
  decimal is 39 tw / 13 fat and always 1–2 digits), so a single comma group de-groups.

## Run 6 — 2026-08-12 11:50 (the lexical cells: month names, from the corpus)

**Question.** `calendar` and `ordinal-native` came back EMPTY, and they are lexical cells that need a
`--terms` file. What are Akan's month names?

Not asserted — mined from the date slots the corpus itself writes (word immediately before a day number,
and word between a day and a year):

```
tw  (Twi):    Ɔpɛpɔn 155 · Ɔbɛnem 323 · Oforisuo 66 · Ɔkɔtɔberɛ 58 · Ayɛwohomumɔ 40 · Obubuo · Ɔsanaa …
fat (Fante):  Sanda 222 · Mumu 133 · Fankwa 102 · Ayɛwoho 99 · Ebɔw 97 · Dzifuu 92 · Aketseaba 92 ·
              Ɔberɛfɛw 84 · Obiradzi 79 · Kwakwar 71 · Ɔbɛsɛ 69 · Ebɔbira 40
```

⚠ **The two varieties do not share a single month name**, which is the sharpest evidence in this whole run
that "Akan" is not one undifferentiated orthography. Both sets go into `tools/corpus/terms/ak.tsv` with
the variety recorded per row, and the artifact is re-mined with `--terms` so `calendar` is measured rather
than reported empty (trap 32: the term list is committed beside the artifact).

No rule is written on the month names. The dates they appear in (`21 Ɔbɛnem 1961`) already read correctly
— the day and the year are cardinals and the month is an ordinary word — and the Akan ordinal is a
POSTPOSED phrase (`bosome no da a ɛtɔ so aduonu nan` = "the day of the month that falls on 24"), not a
suffix, so there is nothing for a date rule to rewrite.

## Run 7 — 2026-08-12 13:20 (the layer, and the four defects the probes found in my own rules)

**Question.** Do the rules do what the corpus says, and what do they break?

`src/languages/akan/normalize.ts`, eleven numbered steps: NFC · entities/zero-width · the elision
apostrophe · de-grouping · units · percent · currency · dotted abbreviations · ranges · the decimal point ·
the English ordinal suffix · the ampersand. Wired at the head of `createAkan`'s `text()`.

**Four defects the probe pass found in the rules as first written, each a playbook trap:**

1. **`cedi` reads as [kedi].** ⟨c⟩ is not an Akan letter, so `phonemizeWord("cedi")` falls through every
   rule to `latinPhone` and comes out *kedi* — this layer putting a mis-read word in the speaker's mouth.
   Both spellings are in the corpus (`cedi` ×25 tw + 1 fat, `sidi` ×6 + 5) and `cedi` is the commoner, but
   A/B'ing them through the engine (the xh/zu `plas`-vs-`plus` method) settles it: `sidi` → [sidi]. And
   `sidi` is attested in exactly the slot — "Ghana sika sidi ebien", and a list of the banknote
   denominations "sidi ahodoɔ 50, 200, 100, 500, ne 5000 a Ghana Sikakorabea …".
2. **`sentimita` is not the word — `sɛntimita` is.** The first pass composed the centimetre from the
   kilometre by analogy. Checked afterwards: `sɛntimita` ×91 tw, `sentimita` ×2. The Fula `tere` failure
   avoided by one grep, and the reason every one of the five unit words is now cited in the file.
3. **`US$ 1m` read as ONE METRE.** `€2.5m`, `£2.19m`, `US$100m` — 5 instances across the two wikis where a
   lowercase `m` after a money amount is the MAGNITUDE, and the one-letter unit key claimed all five
   (trap 46's shape). Guarded with a currency lookbehind, which works only because the currency sign is
   still there at step 5 — step 7 spends it. The capital `615M` / `1.132B` were never at risk: the table
   is case-sensitive.
4. **THE PERCENT WORD WAS BEING SAID TWICE, ×893.** This corpus writes the word AND the sign in one breath
   ("ɔha mu nkyekyemu eduokron (90%)") because the sentence spells the figure out and then repeats it in
   digits. Measured: **893 of the 5,154 percent signs across the two wikis already have the word in front
   of them** (170 immediately adjacent, the rest with the spelled numeral between). Trap 12 — a redundant
   sign is a permissible drop; say it once, in the position the language puts it. Step 6 now suppresses
   the word when the preceding 60 characters carry it with no intervening `%` or sentence break.

**Gates.**

```
npx tsc --noEmit                         clean
corpus-diff compare (mined:ak, 237)      changed 138/237 (58.2%)
                                         DROP 57 → 27 ; DIGIT/SLOT-GAP/RAWMARK/THROW 0 → 0
mine.ts scan                             7 classes / 57 → 4 classes / 27, of which:
                                           DROP percent  ×6  the ⟨e⟩-spelled redundancy (see Run 8)
                                           DROP minus    ×3  the coordinate — DELIBERATELY RED
                                           DROP currency ×3  € and £ — DELIBERATELY RED
                                           DROP exponent ×1  km² — DELIBERATELY RED
                                           ACCEPTED-CLASS math-sign ×10, degree ×7
referee-eval ak                          14/20 folded, 91.8% symbol — BYTE-IDENTICAL before and after
```

**Sampled 14 changed readings by hand.** All improvements: grouping commas (`1,957,914` →
*ɔpepem mpem ahankron …* instead of three numbers with two pauses), decimals, `$10.5 ɔpepepepe` gaining
*dɔla*, `57%` gaining *ɔha mu nkyekyɛmu*, `1296–1346` gaining *kosi*, `n'adwuma` → *nadwuma*, `J.A.` losing
one of its two spurious pauses, `750-1050mm` → *750 kosi 1050 milimita* (the range and the unit composing
correctly). One neutral change worth recording: the sports time `2:03.83` now reads its `.83` as
*akyiri pɔ 83* where it used to be a pause — the colon is still a pause and the fraction genuinely is one,
so this is a small improvement rather than the clock rule sneaking in.

⚠ **THE REFEREE IS A TRIPWIRE, NOT A METER, AND IT DID ITS ONE JOB.** Twenty kaikki words, no digits and no
symbols, so it can only tell me the word path is untouched — which is exactly what byte-identical output
means. Nothing about this layer is measurable with it. The METERS here are the corpus diff (237 utterances,
138 of them changed and read), the artifact scan, and the corpus counts themselves.

## Run 8 — 2026-08-12 14:05 (the residual, and what goes in defects.ts)

**Question.** Of the 27 remaining DROPs, which are correct and which are honest failures?

Read every one:

- **`percent` ×6 — CORRECT, and they are the redundancy of Run 7.4.** Extracted the six sentences: every
  one spells the word out and then gives the figure ("ɔha mu nkyekyemu eduonu (50%)"). ⚠ The scan's own
  `isRedundant` test caught the other FIVE such sentences and missed these six, because it looks for the
  symbol's contribution TOKENS in the reading and these use the corpus's ⟨e⟩ variants (`nkyekyem`,
  `nkyekyemu` → ŋt͡ɕɪt͡ɕem(u), not ŋt͡ɕɪt͡ɕɛmu). A limitation of the probe, not of the reading → six spans in
  `ACCEPTED_SILENT.ak.percent`, each carrying the WORD as well as the figure so a genuinely dropped `2%`
  elsewhere still reports.
- **`minus` ×3 — HONEST FAILURE, LEFT RED.** The coordinate `6.28ɛ; -1.850`. Omitting a minus inverts.
- **`currency` ×3 — HONEST FAILURE, LEFT RED.** `€126 million`, `€102 million`, `£45 million`. The euro
  word is attested ×784 and is the football tournament (Run 4).
- **`exponent` ×1 — HONEST FAILURE, LEFT RED.** `km²`, refused by the unit rule on purpose.
- **`math-sign` ×10 and `degree` ×7 → ACCEPTED-CLASS**, from the new `ACCEPTED_SIGN_SILENCE.ak` block:
  degrees, plus, plus-minus, equals, times, divide, less-than, greater-than, each with its measurement.
  ⚠ `minus` is deliberately NOT in that block, which is what keeps `review.ts --lang ak` red.

⚠ One of the ten math-signs is not a language fact at all: a MediaWiki edit-link URL
("[//tw.wikipedia.org/w/index.php?title=…&action=edit]") that `filter-markup.py` did not catch, and the
`==` heading residue. Recorded rather than hand-removed — the artifact has to stay regenerable from the
command it records (trap 32), and the `equals` exemption argues the heading case explicitly.

**`attest.ts` — and it is STRUCTURALLY BLIND for this language code.**

```
npx tsx tools/normalization/attest.ts --lang ak --words dɔla,sidi,akyiri,kilomita,kosi,nkyekyɛmu
  → all six: token 0, arts 0, substr 0, verdict ABSENT
```

Six words, six identical verdicts — trap 19's tell, and here the cause is Run 2: **ak.wikipedia is locked
and holds one paragraph**, so it returns `absent` for every input including words the language plainly
has. A gate that gives the same answer to every question is broken, not strict. Re-run against the variety
wiki, which is what `--wiki` exists for:

```
npx tsx tools/normalization/attest.ts --lang ak --wiki tw --words dɔla,sidi,akyiri,kilomita,kosi,nkyekyɛmu,sɛntimita,kilogram
  → all eight ATTESTED, and the examples carry the sense:
     akyiri  "… a agyina hɔ ma ɔha nkyekyɛmu aduonu bako akyiri pɔ du-nsia (21.16%)"
     kilomita "… km yɛ kilomita ahinanan biako" · "abɔnten so atrae no kɛse yɛ kilomita 827"
     sɛntimita "n'haban tenten boro sɛntimita aduanan(40)"
     kilogram "ne mu duru nso bɛyɛ sɛ kilogram no aduosia num (65kg)"   ← the abbreviation glossed
```
⚠ `kosi`'s examples include the personal name *Kosi Kedem*, which is why the range connective rests on the
569 measured `N kosi M` instances rather than on the bare token count — trap 37, one more time.

The cached verdicts in `tools/corpus/attest/ak.jsonc` are the `--wiki tw` run; the locked-wiki run is
recorded here and not in the cache.

## Run 9 — 2026-08-12 14:40 (the catalogue, and the final gate sweep)

`review.ts --lang ak` after the artifact and the attest cache were tracked; `derive-normalization.py` and
`build.py` re-run; `npx vitest run` full-suite. Results in the commit message.

## Run 10 — 2026-08-12 15:10 (a reproducibility bug this run's corpus shape exposed)

**Question.** The artifact records the command that produced it. Does that command actually rebuild it?

```
grep '"command"' tools/corpus/mined/ak.jsonc
  → npx tsx tools/normalization/mine.ts mine --in fat.ak.txt --out ak.jsonc …
```

**No. It records ONE of the two corpora.** `mine.ts` reduces path arguments to basenames — correctly, to
keep a local directory tree out of a public repo — with `a.replace(/^.*\//u, "")`, and `^.*\/` is GREEDY
across the whole argument. Given `--in /…/tw.ak.txt,/…/fat.ak.txt` it deletes everything up to the LAST
slash, so the first source and the comma vanish together. Silent: the artifact looks complete, and
rebuilding from it would quietly drop 27,415 of the 35,517 paragraphs.

This is trap 32's own failure mode reached through a different door — an artifact that cannot be
regenerated from the repository is not really committed — and it is not specific to Akan: the playbook's
own recommended hybrid `--in fleurs:xx,fill.txt` (trap 25) has exactly this shape. Fixed by reducing each
comma-separated element rather than the argument as a whole.

**Verified rather than assumed**, which is the half of trap 32 that matters: re-mining after the fix gave
an artifact **byte-identical to the committed one apart from the `command` line itself** — so the pipeline
is deterministic and the recorded invocation now reproduces it. Checked the rest of the fleet too: `ak` is
the only artifact in the tree with a multi-source `--in`, so nothing else was damaged.
