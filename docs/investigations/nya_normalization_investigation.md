# nya (Chichewa / Chinyanja) — text-normalization investigation

Method: `docs/normalization_playbook.md`. Worktree `norm/nya`. Engine verdict in the catalogue is ✅
(measured, mature) — so the normalizer is the missing layer, not the phonology.

## Run 1 — 2026-08-11 (baselines, before any edit)

Commands, and what each answered.

**`npx tsx tools/referee-eval/eval.ts nya`** — where does the g2p stand before the layer?

```
wikipron nya_latn (human, narrow) [primary] (1562 w)  raw 708/1562 45.3%  folded 1553/1562 99.4%  symbol 99.9%
kaikki nya (human) [secondary]    (1526 w)            raw  15/1526  1.0%  folded 1498/1526 98.2%  symbol 99.5%
epitran nya-Latn (programmatic)   (1562 w)            raw 644/1562 41.2%  folded 1448/1562 92.7%  symbol 98.6%
```

Word-only referees — none of them contains a digit, so the referee number is expected to be BYTE-IDENTICAL
after this work. It is a regression tripwire, not a progress meter.

**`corpus-diff.ts emit --lang nya --corpus mined:nya --out /tmp/nya.before`** → `emitted 416 utterances`.
(First attempt without `--corpus` threw; the mined-artifact source needs the explicit `mined:nya` prefix.)

**`mine.ts scan --in tools/corpus/mined/nya.jsonc --lang nya`** — what vanishes silently today?

```
DROP percent       ×29
DROP currency      ×21
DROP math-sign     ×12
DROP minus         ×9
DROP exponent      ×7
DROP ampersand     ×7
DROP degree        ×4
REDUNDANT currency ×1
```

89 dropped-symbol instances across 7 classes. That is the work list, in count order.

**`sources.ts --lang nya`** — is there a source for each class?

```
[NONE] letter-names     espeak does not ship this language at all
[NONE] decimal-point    no _dpt, no _., no manifest word
[part] era-phrase       marker occurs; a Christ-stem exists somewhere
[NONE] scale-names      ° occurs, neither scale name anywhere
[chk?] percent-word / currency-word / minus / equals / ampersand / exponent
[NONE] fraction-series
espeak: NOT SHIPPED · referee: 4651 lines · corpus: 424 lines
```

espeak has no Chichewa at all, so the usual fallback tier is gone: sourcing must come from the corpus
itself, the referee word lists, and `attest.ts` against ny.wikipedia. Initialisms are structurally blocked
(no letter-name table, nothing to build one from) — that is a sourcing fact, recorded, not a coding choice.

**`review.ts --lang nya`** → `[FAIL] normalizer  src/languages/chichewa/normalize.ts missing`. As expected.

**Implication.** Next: read the corpus cell by cell before writing a rule (playbook step 1), and probe the
engine on the surface forms actually attested (step 2).

## Run 2 — 2026-08-11 (read the corpus, then probe the engine)

### 2a. What the corpus writes (counts over the 424-line artifact, `hard` + `sample`)

```
comma-grouped thousands  54     dot-grouped thousands   13     space-grouped   6
decimal with a dot       39     decimal with a comma    20 (16 of them EasyTimeline chart markup)
percent sign             41     currency signs          35     km²             9
colon clock, 2-digit min 14     sports time (h:mm:ss)   15     ° sign          5
ranges (digit-dash)      52     ampersand               14 (6 of them &nbsp;)
dotted capital runs      25     spaced dotted initials   3     era markers    21
English ordinal suffix    5     `=`                     14 (ALL EasyTimeline)  `<` `>` `×` `÷` `±`  0
```

⚠ **THE ARTIFACT CARRIES WIKI MARKUP AND ENGLISH, AND IT LANDS IN EXACTLY THE CELLS I WAS ABOUT TO WRITE
RULES FROM** (playbook §0b). The `arithmetic` cell is 8/8 EasyTimeline directives
(`ScaleMajor = unit:year increment:11000`); `signed-number` is 7/8 the same
(`bar:1991 at: 1651 text: 1601,1 shift:(-10,5)`); `version-dot` is 3/3 CSS
(`.mw-parser-output .reflist{...}`); and the bibliographies of the Paul/Newton/Eminem articles are English
prose. So: **`=` is declared absent for Chichewa** — all 14 hits are chart markup, none is prose — and the
comma-decimal count drops from 20 to 4 real prose instances once the chart data is set aside.

### 2b. THE GROUPING/DECIMAL AMBIGUITY, measured rather than assumed

Chichewa Wikipedia writes thousands with a comma, a period AND a space, and writes decimals with a comma
AND a period. So neither separator identifies its own role. The discriminator that the corpus actually
supports is the **digit-group length**:

```
separator + exactly 3 digits   33 instances   ALL groupings   (500,000 · 14,591 · 221,272 · 31,753 km²
                                                               · 35.592 km² · 26.931 km² · 2.289.780 …)
                               0 counter-examples — the corpus contains no 3-place decimal at all
separator + 1–2 digits         43 instances   ALL decimals    (66.7% · 9,5 trillion · 0,60 oz · 104.0 °F)
separator + 4+ digits           0 instances
```

33 against 0. That is the rule, and it is why the de-grouping arm demands exactly `\d{3}` blocks.

### 2c. Sourcing — what the corpus and ny.wikipedia actually attest

`attest.ts --lang nya --wiki ny` (note: **`nya.wikipedia.org` does not exist**; the wiki is filed under
`ny`, and without `--wiki ny` the tool correctly refuses to return a negative — trap 43's shape).

| word | token / arts | sense read from the examples | verdict |
|---|---|---|---|
| `peresenti` | 33 / 19 | `85 peresenti ya anawo`, `7.8 peresenti` — always AFTER the number | **ship**, postposed |
| `madola` | 29 / 19 | `madola 195`, `madola 50 mpaka 100`, `madola a ku America 0.58` | **ship**, prefixed |
| `mapaundi` | 3 / 2 | 2 are Nyasaland stamp denominations (`mpaka mapaundi khumi`); 1 is DNA base *pairs* mistranslated | **ship** (2/3 monetary) |
| `mamita` | 16 / 11 | `mamita 1,708`, `mamita 108` — metres, prefixed | **ship** the WORD (see 2e for the key) |
| `sikweya` | 3 / 3 | 2 are `sikweya makilomita`; 1 is the SHAPE (`mu sikweya (1: 1)`, an aspect ratio) | **ship** as the squared word |
| `madigiri` | 7 / 6 | 3 angular/thermal (`madigiri atatu`, `10 ° C 20 ° C madigiri`); 2 ACADEMIC degrees — trap 37 polysemy | **ship** |
| `koloko` | 3 / 3 | `8 koloko masana`, `3 koloko masana` — o'clock, AFTER the hour | **ship** |
| `mphindi` | 48 / 20 | `mphindi 12`, `mphindi ziwiri` — minute, BEFORE the number | **ship** |
| `ola` / `maola` | 10+31 | `517 kilomita pa ola` — and that is the RATE construction too | **ship** |
| `mailosi` | 5 / 4 | `mailosi awiri (3.2 km)` | **ship** |
| `sentimita` | 1 / 1 | `98.1 ndi 129.9 sentimita` | ship (thin) |
| `kwacha` | 12 / 7 | the Malawi/Zambia currency — but no `MK`/`K` sign occurs, so nothing to key it to | not needed |
| `yuro` | **1 / 1** | one hit, in one article, and it is the same machine-translated sentence the corpus carries | **DECLINE `€`** |
| `mayuro`, `paundi`, `milimita`, `kilogalamu` | 0 | — | absent |
| `Khristu asanabadwe` etc. | 0 | — | **DECLINE the era phrase** |

Two refusals worth stating precisely:

- **`€` stays unread.** `yuro` is a real Chichewa token, but one hit in one article is a lead and not a
  finding, and that article is visibly machine-translated ("The ambiri amangoti ntchito ndalama ndi yuro").
  A wrong currency word is confidently wrong; the sign stays silent and the reason is recorded.
- **The era phrase is declined on REGISTER, not on absence.** ny.wikipedia does gloss it —
  *"pa 25 December 1ACN (kutanthauza kuti zaka za kumbuyo Yesu asanabadwe)"* — but that is a definitional
  gloss of an abbreviation, which is exactly the wrong-register trap the playbook records for hi's `धन`.
  What the layer does instead is remove the DOTS of `B.C.E`, which were three sentence breaks.

### 2d. Probing the current engine (playbook step 2) — the defect list

```
"1,600,000"        → t͡ʃimod͡zi , mazana asanu ⁿdi ɽimod͡zi , ziɽo        "one, six hundred, zero"
"2.289.780"        → ziwiɽi . mazana awiɽi … . mazana asanu …            TWO SENTENCE BREAKS inside one number
"66.7%"            → makumi asanu ⁿdi ɽimod͡zi ⁿdi zisanu ⁿdi t͡ʃimod͡zi . zisanu ⁿdi ziwiɽi   sentence break; % gone
"$ 350 miliyoni"   → mazana atatu ⁿdi makumi asanu miɽijoni              sign silently dropped
"2,780,400 km²"    → ziwiɽi , … , mazana anaji km                        raw "km", exponent gone
"150cm (4 ft…)"    → zana ⁿdi makumi asanu KM zinaji ft …                ⚠ ⟨cm⟩ reads as [km] — c→k, m→m
"40 °C (104.0 °F)" → makumi anaji K zana ⁿdi zinaji . ziɽo F             ° gone, C reads [k], F reads [f]
"1:30 mmawa"       → t͡ʃimod͡zi , makumi atatu mmawa                      "one, thirty"
"6:23 p.m."        → … , makumi awiɽi ⁿdi zitatu p . m .                 THREE sentence breaks
"2004-2009"        → zikwi ziwiɽi ⁿdi zinaji  zikwi ziwiɽi ⁿdi zisanu …  no joiner at all
"Europu & Asia"    → euɽopu asia                                         & dropped
"20th century"     → makumi awiɽi TʰEⁿTUɽʲ                               the suffix reaches the IPA
"U.S. Census"      → u . s . keⁿsus                                      two sentence breaks
"442 B.C.E"        → … ɓ . k . e                                         three sentence breaks
"No.1"             → no . t͡ʃimod͡zi                                      sentence break
```

**The `150cm` → `km` finding is the sharpest one and no gate names it**: Chichewa has no ⟨c⟩ grapheme, so
`latinPhone` falls back to [k] and the abbreviation for CENTImetre is pronounced as the abbreviation for
KILOmetre. A silent unit is merely missing; this one is a different quantity by a factor of 100,000.

### 2e. The bare `m` key — declined, and the measurement that decided it

`mamita` is well attested (16/11), so the WORD is not the blocker. The KEY is. Chichewa's locative prefix
is `m'`, and the shared tier's trailing guard is `(?![\p{L}\p{M}])` — an apostrophe is neither:

```
digit + m + apostrophe   6    "…105 m'ma…" — the LOCATIVE, would read as metres
digit + bare m           3    "107 m pansi pa nyanja", "10,000 m", "(18 m)" — genuine metres
```

6 false against 3 true, so `m` is **not declared in the shared tier**. It is instead claimed by a LOCAL
rule with an apostrophe-aware guard `(?![\p{L}\p{M}'’ʼ])`, which takes all 3 and none of the 6. This is
trap 46 arriving through a new door — there the one-letter key collided with a version dot, here with a
noun-class prefix — and trap 47 reason 4: the tier cannot express the guard, so the rule is local.

**Implication for the next step:** write `normalize.ts` with the tier wired as
`normalizeChichewa(SYMBOLS(input))` — the SWAHILI order, tier first — because the decimal spell-out has to
happen after the percent/currency/unit words are attached, while de-grouping works equally well on either
side (it keys on the digit run alone, which the tier leaves intact).

## Run 3 — 2026-08-11 (write the layer, then measure it)

`src/languages/chichewa/normalize.ts` written, wired as `normalizeChichewa(SYMBOLS(input))` in
`chichewa.ts` — the **Swahili order (tier first)**, not the Xhosa one. The coupling is forced from both
ends and is stated in both files: the decimal spell-out must run AFTER a percent/currency/unit word is
attached (otherwise the tier sees `66 7 %`), while de-grouping is order-independent because it keys on the
digit run alone, which the tier leaves intact.

### 3a. Corpus diff

```
npx tsx tools/normalization/corpus-diff.ts emit --lang nya --corpus mined:nya --out /tmp/nya.after
npx tsx tools/normalization/corpus-diff.ts compare --before … --after … --corpus mined:nya

changed 144/416 (34.6%)
  before  { DIGIT: 0, SLOT-GAP: 0, RAWMARK: 0, DROP: 84, THROW: 0 }
  after   { DIGIT: 0, SLOT-GAP: 0, RAWMARK: 0, DROP: 23, THROW: 0 }
```

All 144 read by hand. No regressions found; the residual 23 are the three refused classes below.

### 3b. Two things the first draft got wrong, both caught by re-measuring rather than by a gate

**(1) `magnitudes` had to come back OUT of the tier declaration.** Declared, `$ 350 miliyoni` read
*madola miliyoni 350* — the tier hops the magnitude to the currency word's side, which is right for
*cinco millones de dólares* and wrong here. Re-probed:

```
attest.ts --words "madola miliyoni","miliyoni madola"  → 0 / 0
`num MAG` in the corpus ×36, EVERY ONE number-then-magnitude:
   matani 1.3 miliyoni · makilomita 4 biliyoni · anthu 739-743 miliyoni · Mafayilo 5 miliyoni · £ 12.24 miliyoni
```

Chichewa's order is NOUN + NUMBER + MAGNITUDE, 36 instances and no counter-example. Withheld, the tier
attaches only the noun and the magnitude stays where the writer put it: *madola 350 miliyoni*. ✓
⚠ The playbook's "one declaration, two consumers" warning was then CHECKED rather than assumed —
`magnitudes` also gates the unit path's connective hop, so withholding it would break a `2,2 miliyoni km²`
shape. That shape is **×0** in this corpus (grep: magnitude followed by a unit abbreviation), so the second
consumer loses nothing. Recorded in chichewa.ts.

**(2) The `B.C.E` run needed an optional trailing bare capital.** Without it the dotted-run rule matched
`B.C.` and left `E`, giving `BC E`. Bounded by `(?![\p{L}])` so `U.S. Census` keeps its `Census`.

### 3c. What was refused, and on what evidence

| class | count | why |
|---|---:|---|
| `minus` | 9 | **all nine are EasyTimeline pixel offsets** (`shift:(-10,5)`) — a chart directive, never a quantity. The tenth candidate, `2004 -2009`, is a spaced range and step 8 now reads it. Zero negatives in Chichewa prose; no minus word in any source. |
| `equals` + the arithmetic set | 14 | **all fourteen `=` are markup** — 9 EasyTimeline directives, 5 CSS declarations. `< > × ÷ ±` are ×0 apiece. |
| `plus` | 2 | both a UTC offset (`(UTC + 7)`, `(GMT+1)`) — the playbook's fleet finding is that this is the one contentful plus and the one nothing attests. |
| `€` | 7 signs, 2 lines | `yuro` is 1 hit in 1 article, and that article is the machine-translated one the corpus already carries — so the "second haystack" is not independent evidence. `$`→*madola* and `£`→*mapaundi* ARE read. |
| era phrase | 21 | declined on REGISTER: the only wiki evidence is a definitional gloss. The DOTS are removed, which was the audible defect (three sentence breaks per marker). |
| initialisms | 1163 | structurally blocked — no `letterName` table and espeak ships no Chichewa, so `core/initialisms.ts` would be a no-op. |
| fractions | 13 `N/N` | not one is a fraction (seasons, review scores, date spans, `NGC 6992/5`), and no denominator series exists to compose from. |
| `ft` / `in` / `oz` | — | every instance is an English parenthetical glossing a metric figure already given; no Chichewa word attested. |

`defects.ts` gained `nya` in **both** tables. The class refusals (`minus`, `equals`, `plus-minus`,
`less-than`, `greater-than`, `times`, `divide`, `plus`) went to `ACCEPTED_SIGN_SILENCE`; the `€` lines and
the EasyTimeline `shift:(…)` spans to `ACCEPTED_SILENT`.

⚠ **The minus needed BOTH**, and the reason is mechanical rather than editorial: the coarse-class accept
(`acceptedSignClass`) tests a class by matching its `DROPPABLE` regex against a SINGLE CHARACTER, and the
`minus` pattern is contextual (`(?<!…)[-−–](?=\p{Nd})`), so it can never be satisfied that way. `math-sign`
needs no instance list because it is the plain character class `[+±×÷=<>]`. tl and wuu carry the same
double entry for the same reason; worth knowing before anyone tries to simplify one of them away.

### 3d. Gates after

```
mine.ts scan       no defects   (ACCEPTED-CLASS math-sign ×12 · ACCEPTED minus ×9 · ACCEPTED currency ×2)
review.ts --lang nya   checklist clean — 10/10, including `sourcing  all 3 high-traffic words attested`
sources.ts         percent-word [ok] · currency-word [ok] · exponent-word [ok]  (were [chk?] ×3)
npx vitest run     234 files, 3416 passed
npx tsc --noEmit   clean
referee-eval nya   BYTE-IDENTICAL, as predicted: wikipron 99.4% / kaikki 98.2% / epitran 92.7% folded.
                   All three referees are word→IPA and contain no digit, so this is a regression tripwire
                   and never a progress meter for a normalization change.
```

## Run 4 — 2026-08-11 (found and NOT fixed)

**The engine reads every number ≥ 10⁶ digit by digit, and de-grouping made that visible.** `numbers.ts`
falls back to digit-by-digit at 1e6, with the comment *"Chichewa has no well-attested native million"*, and
`test/chichewa.test.ts` pins it. Measured after this layer runs:

```
utterances containing a ≥10⁶ digit run: 19 / 416   (25 numbers)
   2780400 · 6581500 · 3761274 · 1700000 · 1600000 · 17125200 · 147000000 · 10180000 · 24709000 …
```

So `1,600,000` now reads as seven digit words. That is **better than before** — the old reading was
*chimodzi , mazana asanu ndi limodzi , ziro* ("one, six hundred, zero"), three unrelated numbers separated
by pauses — but it is not right.

⚠ **AND THE COMMENT THAT JUSTIFIES THE LIMIT IS NOW REFUTED BY THIS RUN'S OWN SOURCING.** `miliyoni` is
attested **67 times across 20 ny.wikipedia articles**, always in the magnitude slot after its number
(*Mafayilo 5 miliyoni*, *zaka 7 miliyoni*, *565 miliyoni*), plus *biliyoni* in the corpus. "No
well-attested native million" is true of a NATIVE word and false of the loan the language actually writes.

**Not fixed here, deliberately.** It is engine number DATA, not normalization: it changes
`numberToWords` for every caller, it breaks a committed golden test, and composing it needs a decision the
corpus does not settle — `miliyoni` follows its number (`5 miliyoni`) while the existing `zikwi` multiplier
precedes it (`zikwi ziwiri` = 2000), so the two magnitudes would disagree about word order and that is a
sourcing question of its own. Flagged for the orchestrator with the count above; the measurement is
re-runnable in one command.

**Also found, also not fixed — one known false positive in the range rule.** `ndege ya Boeing 737-800` is a
model designation and now reads *737 mpaka 800*. 1 against the 14 genuine ascending spans. Every one of
those 14 is preceded by a lowercase word, an open paren or a comma, and only the Boeing case by a
capitalised name — but a "not after a capitalised word" guard would also decline a sentence-initial
*Mu 2004-2009*, so the trade was refused (trap 9: widen — or narrow — a guard only for a shape you have
counted) and the instance is stated in the rule's comment instead.

**And one measured NEGATIVE worth keeping, because the brief predicted the opposite.** Traps 14/15 (a bound
suffix glued to, or spaced off, a digit run) were flagged as the live hazard for a noun-class language.
They do not arise in Chichewa: `letter-hyphen-digit` ×13 is entirely CSS and English designations
(`Under-20`, `AR-15`, `COVID-19`), `digit-hyphen-letter` ×2 is `23-karat` and `1254-January`, and the 86
`digit + short word` pairs are ordinary Chichewa particles standing as WORDS (`mipando 49 ya`, `7 pa 10`),
never a detached bound morpheme. Chichewa numerals ARE bound concord-taking stems — the concord simply goes
on the numeral WORD, and the corpus never writes it on a digit. So every rule leaves its operand as digits,
which is also what keeps the tier's number–unit adjacency alive.
