# Sesotho / Southern Sotho (`st`) — text-normalization investigation

Chronological. One heading per run. Raw findings, dead ends kept.

## Run 1 — 2026-08-14 08:35 — the baseline instruments

**Commands.**

```
npx tsx tools/referee-eval/eval.ts st
npx tsx tools/normalization/review.ts --lang st
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/st.jsonc --lang st
npx tsx tools/normalization/corpus-diff.ts emit --lang st --corpus mined:st --out /tmp/st-work/st.before
```

**Question.** What do the four gates say before I touch anything?

**Raw findings.**

`eval.ts st` does not run. It prints its usage banner — `st` is **not in the referee list at all**
(`ab|acm|…|sq|sr|su|sv|sw|syl|ta|te|tg|th|ti|tk|tl|tn|tr|…`; `tn` Setswana is there, `st` is not).
`sesotho.jsonc`'s own header says why: *"NO usable machine referee (kaikki 'Sotho' = 3 IPA entries; no
wikipron/epitran) → hand-gold anchored, verdict single-source."* So **there is no referee before/after
number for this language, and there cannot be one**. Recorded rather than worked around; every claim below
is therefore made on the corpus diff, the artifact scan, and readings pasted from the phonemizer.

`review.ts --lang st` → `[FAIL] normalizer  src/languages/sesotho/normalize.ts missing`. One check, one fail.

`mine.ts scan` over the committed artifact (435 lines):

```
DROP currency      ×19
DROP percent       ×18
DROP math-sign     ×15
DROP minus         ×11
DROP exponent      ×9
DROP degree        ×6
DROP ampersand     ×6
LEAK RAW-LATIN bn  ×2
LEAK RAW-LATIN lb  ×2
```

`corpus-diff emit` → 428 utterances, and the DROP annotations on them:

```
currency 19 · percent 18 · math-sign 15 · minus 11 · exponent 8 · degree 6 · ampersand 6   = 83 on 79 lines
```

**Implication.** Seven droppable classes, none of them read. The two RAW-LATIN leaks are `bn` and `lb`
inside English fragments (`Ballah Bypass`, `Li-clones`), i.e. contamination rather than a Sesotho defect —
noted for later, not a target.

## Run 2 — 2026-08-14 08:40 — which orthography is this corpus in?

**Command.** dumped `hard` + `sample` out of the artifact to `/tmp/st-work/corpus.txt` (435 segments,
`tools/normalization/…` parseJsonc, not a hand-rolled JSON reader — the file has comments), then counted the
Lesotho-vs-South-African orthographic markers.

**Question.** Sesotho has two standard orthographies. The engine's manifest declares South African
(`⟨kg⟩ → kχ`, `⟨w⟩`, numbers `dikete / mashome a mabedi / lekgolo`). Which one does the corpus write?

**Raw finding — BOTH, in the same corpus and sometimes in the same paragraph.**

```
 wa  327    oa  136
 ya  715    ea  397
di-   18   li-   20
```

and, decisively, in the words this layer needs:

```
kilometre   dikilomitara ×1   (SA)      lik'hilomithara ×2, k'hilomithara ×1   (Lesotho)
metre       dimithara ×1, metara ×2 (SA) limithara ×6                          (Lesotho)
centimetre  —                            lisenthimithara ×1                    (Lesotho)
percent     diperesente ×2    (SA)       liporesente ×2                        (Lesotho)
hour        dihora ×1         (SA)       lihora ×4                             (Lesotho)
hectare     —                            lihekthere ×1                         (Lesotho)
square      —                            lisekoere-k'hilomithara ×1            (Lesotho)
rand        diranta ×3        (SA)       —
pound       —                            liponto ×1                            (Lesotho)
```

**Implication.** Corpus frequency alone would pick Lesotho. That is the wrong criterion here, for a reason
that has nothing to do with counts: **the engine already committed to South African orthography**, in its
grapheme table (⟨kg⟩ is /kχ/ in SA and is spelled ⟨kh⟩ in Lesotho, where ⟨kh⟩ is instead /kʰ/ — the two
conventions read the SAME letters as DIFFERENT phonemes) and in `numbers.ts`, whose every emitted word is SA
(`dikete`, `mashome`, `lekgolo`, `di-`). A layer that emitted `lik'hilomithara` would put a Lesotho word
beside an SA numeral in one noun phrase, and would hand ⟨kh⟩ to a grapheme table that reads it as the
aspirate. So: **target South African orthography**, and require every emitted form to be attested in that
orthography — not merely transposed from a Lesotho attestation by rule. Next step: check each SA form's
sense in the corpus, then corroborate on st.wikipedia with `attest.ts`.

**The single best attestation found in this run**, because it settles word, order and concord at once:

```
Motse ona o dikilomitara tse mashome a mararo ho tloha ho moeedi wa naha ya Lesotho
"This town is thirty kilometres from the Lesotho border"
```

`dikilomitara tse` + `mashome a mararo` — the measure noun FIRST, the cl.8/10 concord `tse`, and the numeral
in exactly the SA series `numbers.ts` emits. That is `unitPrefix: true` on the shared tier, and it is the
language's own sentence rather than an inference.

## Run 3 — 2026-08-14 08:55 — what the engine actually does to the attested shapes

**Command.** `npx tsx /tmp/st-work/probe.ts <28 forms>` (a one-process `phonemize(form,"st")` loop).

**Question.** Step 2 of the playbook: not what I assume the engine does, what it does.

**Raw finding** (verbatim):

```
"50%"          → mɑʃɔmɛ ɑ mɑɬɑnɔ                       the sign DROPPED
"R470"         → r mɑkχɔlɔ ɑ mɑnɛ …                    the rand sign read as a bare [r]
"$675"         → mɑkχɔlɔ ɑ t͡sʰɛlɛt͡sʼɛŋ …                sign DROPPED
"£15,500"      → lɛʃɔmɛ … , mɑkχɔlɔ ɑ mɑɬɑnɔ           sign DROPPED *and* the grouping comma is a PAUSE
"12 km"        → … kʼm
"12 cm"        → … km
"50 kg"        → mɑʃɔmɛ ɑ mɑɬɑnɔ kχ                    ⟨kg⟩ IS A SESOTHO GRAPHEME — /kχ/
"5 ha"         → ɬɑnɔ ɦɑ                               ⟨ha⟩ is a Sesotho WORD
"1,395 m"      → nŋwɛ , mɑkχɔlɔ ɑ mɑrɑrɔ … m
"632,702 km2"  → … kʼm pʼɛdi                           the ASCII 2 read as the NUMBER TWO
"603 628 km²"  → … kʼm                                 the ² DROPPED
"32.9°C"       → mɑʃɔmɛ ɑ mɑrɑrɔ … . rɔbɔŋ k           decimal point = SENTENCE BREAK, ° dropped, ⟨C⟩ → [k]
"0-100 km/h"   → lɛfɛɛlɑ lɛkχɔlɔ kʼm ɦ                 range unread, ⟨h⟩ → [ɦ]
"1,500"        → nŋwɛ , mɑkχɔlɔ ɑ mɑɬɑnɔ               "one, five hundred"
"10-20"        → lɛʃɔmɛ mɑʃɔmɛ ɑ mɑbɛdi                bare juxtaposition
"Arts & Sciences" → ɑrt͡sʼ skiɛnkɛs                     `&` DROPPED
"4x4"          → nnɛ z nnɛ                             ASCII ⟨x⟩ → [z]
"5 × 5"        → ɬɑnɔ ɬɑnɔ                             × DROPPED
"20²" / "10⁻³¹" → mɑʃɔmɛ ɑ mɑbɛdi / lɛʃɔmɛ             exponent DROPPED ENTIRELY
"+30"          → mɑʃɔmɛ ɑ mɑrɑrɔ                       + DROPPED
```

**Implication.** Three of these are **trap 56** — a defect that produces a *reading* and that no leak class
can see:

* `50 kg` → **[kχ]**. ⟨kg⟩ is a declared Sesotho grapheme (the velar affricate), so a kilogram is read as one
  consonant. Not a leak; not a drop; a phoneme.
* `5 ha` → **[ɦɑ]**, which is the Sesotho word *ha*. The Javanese `10 ha` defect, in a different language.
* `632,702 km2` → **"… kʼm PEDI"** — the trap-53 shape exactly: the ASCII exponent is not a visible mark, it
  is a NUMBER, and it invents a quantity.

And `12 cm` → **[km]** against `12 km` → **[kʼm]**: not byte-identical (⟨c⟩ falls to `latinPhone` → [k],
⟨k⟩ is the ejective [kʼ]), so this is *not* the `misread.ts` cm/km collision — but both are garbage.

## Run 4 — 2026-08-14 09:05 — sourcing every word, and four measured refusals

**Commands.** `tools/normalization/sources.ts --lang st`, then six `tools/normalization/attest.ts --lang st
--words …` batches (cache: `tools/corpus/attest/st.jsonc`, 43 findings).

`sources.ts --lang st`:

```
[NONE] letter-names     espeak does not ship this language at all
[NONE] decimal-point    no _dpt, no _., no manifest word
[NONE] scale-names      ° occurs, neither scale name anywhere
[NONE] fraction-series  fraction occurs, no series to compose from
[chk?] percent/currency/unit/minus/equals/ampersand
       the corpus writes km×29 ha×11 m×6 km/h×4 after a number
```

**What st.wikipedia attests, in SOUTH AFRICAN orthography** (token / articles; every example read):

```
diperesente      8/5   "diperesente tse 80 tsa baahi", "diperesente tse fetang tse 70"        PERCENT
diphesente       5/3   "diphesente tse 35 ho isa ho tse 45 tsa batho"                         PERCENT (variant)
diranta         14/12  "diranta tse dimilione tse 70.1 kgahlanong le tekanyetso"              RAND
didolara         5/4   "Didolara tsa Amerika tse 44 le 78", "didolara tse 4bn"                DOLLAR
diponto          5/5   "theko ya diponto tse 4 le disheleng tse 5 ka acre"                    POUND
dikhilomithara  21/19  "E fumaneha dikhilomithara tse ka bang 76 ka borwa ho motse-moholo"    KILOMETRE
dikilomitara    10/10  "Motse ona o dikilomitara tse mashome a mararo ho tloha ho moeedi"     KILOMETRE (variant)
dimithara       28/16  "bophahamo ba dimithara tse 792 (2,600 ft) ka holima bophahamo"        METRE
dikhilograma     1/1   "basadi ba boima ba dikhilograma tse 50 ho Ditlhodisano tsa Lefatshe"  KILOGRAM
dihekthere       1/1   "sebakeng se kwahelang dihekthere tse 324"                             HECTARE
disekwere        2/2   "sehlekehleke sa disekwere-kilometara tse 19 (7.3 sq mi)"              SQUARE
dimilione       41/20  · dibilione 4/4 · dimiliyone 4/1                                       MAGNITUDES
ho isa ho       49/19  "dikhilomithara tse 16 ho isa ho tse 8", "dilemong tsa 8 ho isa ho 14" RANGE JOINER
```

**Absent, probed and recorded** (so the silence is a measurement, not an oversight):

```
kilomitara 0 · disentimithara 0 · disenthimithara 0 · disenthimitara 0 · dimilimithara 0
dikilograma 0 · dikilogeramo 0 · kilograma 0 · khilograma 0 · dikhilogramo 0
digiri 0 · didigiri 0 · digerii 0 · didikirii 0 · dikgato 0 · dikhutlo 0 · Celsius 0 · dikhelsiase 0
dieuro 0 · diyuro 0 · disekonto 0
```

**Two sense checks that changed a decision.**

* `ka hora` reports 11 tokens / 7 articles and **every single example is a CLOCK TIME**, not a rate:
  *"ka hora ea bohlano hoseng"*, *"ka hora ya leshome le motso o mong"*, *"ka hora ya 1 thapama"*. Taken as
  the rate connective it would have been the Fula `hakkunde` mistake. The rate is instead composed from `ka`
  = **per**, which the corpus attests twice digit-adjacent and glossed: *"li-kilos tse fetang 2 000 **ka**
  hektare (1,800 lb / acre)"* and *"diponto tse nne le disheleng tse hlano **ka** acre"*. So
  `unitPer: "ka"` + `rateDenominators: { h: "hora" }`, never the phrase.
* `mocheso` (12/7) is HEAT / the animal oestrus, not a degree. There is no degree noun and no scale name.

**The refusal that a count settled, against my own expectation.** `sources.ts` reports `ha×11` after a
number and hectare is a settled borrowing, so I expected to declare it. Reading all six digit-adjacent
instances in the artifact:

```
…ka selemo sa 1994 ha mmuso o kopanya Mazulu bantustan…      "when"
…tsa lilemo tse 15 le 64 ha ba na mosebetsi…                 negative
…ka 1905 ha taemane e kgolo ka ho fetisisa…                  "when"
…Ka 1969 ha a ntse a ithuta…                                 "when"
…ho fihlela Mphalane 2010 ha a phahamisetsoa…                "when"
…ka Phupu 2020 ha a ne a ikopanya le Glasgow…                "when"
```

**6 instances, 6 of them the Sesotho word *ha*, 0 hectares.** `ha` is NOT declared. Trap 9 exactly: a guard
alternative with no attested instance is a misfire generator — here the alternative had eleven "instances"
and all of them were a conjunction.

**Implication for `cm`/`mm`/`l`.** `disenthimithara` and every spelling of it is ×0 on the wiki and
digit-adjacent `cm`/`mm` is ×0 in the artifact, so there is nothing to read and nothing being lost.
`dilithara` is 1/1 but `l` is a one-letter key and the playbook's standing rule forbids it. All declined.

## Run 5 — 2026-08-14 09:20 — reading the cells before writing a rule

**Command.** dumped the `hard` tier by cell.

* **`clock` — there are no clocks.** The colon instances are `1:10`, `1:11`, `1:14` (Genesis, in Sesotho),
  a percentage (`50.19%`), and a date (`30.01.1912`). The `sports-time` cell holds `2:04.23`, `1:56.72`,
  `4:08.01`, `3:31.49`, `5:58:53`, `3:31:28`, `2:27:48`, `2:25:28` — every one a race time. **A ceb-shaped
  bare-colon clock rule would have claimed 8 race times and 3 Bible verses and 0 clocks.** No clock rule.
* **`arithmetic` — all eight are EasyTimeline chart directives** (`ScaleMajor = unit:year increment:11000
  start:0 gridcolor:linegrey`). That is where `DROP math-sign ×15` comes from. No `=` rule; `<` `>` `×` `÷`
  `±` are ×0 in the artifact and `×` is ×0 too (the only multiplication-shaped thing is `4,757 ft × 98 ft`
  in one Lesotho-orthography paragraph). `+` is ×1.
* **`exponent` — every instance is `km²`**: `38.6 km²`, `603 628 km²`, `217 km²`, `188 km²`, `37,99 km²`,
  `21 500 km²`, `6 750 km²`. This is the cell with the most to gain, and it needs `disekwere`.
* **`ranges` ×50, and the modal shape is a SEASON** — `2016-17` ×8, `2018-19`, `2017-18`, `2010-11`. Those
  are non-ascending and decline themselves.
* **`&` ×19, of which `&nbsp;` ×8**, plus `&#39;` (the orthographic apostrophe in `Ntat&#39;a`, `&#39;Matsaba`)
  and `&#x5B;`/`&#x5D;`. So the entity table must be consulted BEFORE the sign — the Chichewa finding,
  reproduced, and the reason `ampersand` is NOT declared on the shared tier here either.
* **`R` + digits ×12, and all twelve are money** (`R470 bilione`, `R332 milione`, `R30,000,000`,
  `R22.7 milione`, `R3,2 milione`, `R8 million`, `R2.3m`, `R22.8m`, `R28.9 …`, `R23.5 …`). A bare capital
  `R` key is safe in this corpus, measured.
* **digit-adjacent `m` ×10: 7 metres, 3 MILLIONS after a currency sign** — `R2.3m`, `£1.2m`, `R22.8m`. And
  the corpus glosses the abbreviation itself: `R2.3m(di-milione tse pedi feelwane tharo)`,
  `R8 million(di-milione tse …)`. So `m` can be declared as the metre only if the currency-glued magnitude
  is spent FIRST, which is one of the two rules that force this file to own the tier call.

## Run 6 — 2026-08-14 09:35 — the first corpus diff, and the two regressions it caught

**Commands.**

```
npx tsx tools/normalization/corpus-diff.ts emit --lang st --corpus mined:st --out /tmp/st-work/st.after
npx tsx tools/normalization/corpus-diff.ts compare --before /tmp/st-work/st.before --after /tmp/st-work/st.after
```

**Question.** Did the eleven steps break anything the probes could not see? (Playbook step 5: budget for
reading the diff.)

**Raw finding.** `changed 143/428 (33.4%)`, `DROP 79 → 33` lines, DIGIT/SLOT-GAP/RAWMARK/ZERO-WIDTH/RAW-CAPS
all 0 → 0. And two things in the first twelve rows that were NOT improvements:

```
SRC Friedrich Engels, *28.11.1820 ka Barmen †05.08.1895 ka London
 -  … mɑʃɔmɛ ɑ mɑbɛdi lɛ mɛt͡sʼɔ ɛ rɔbɛdi . lɛʃɔmɛ lɛ mɔt͡sʼɔ ɔ lɛ mɔŋ . sɛkʼɛtʼɛ …
 +  … mɑʃɔmɛ ɑ mɑbɛdi lɛ mɛt͡sʼɔ ɛ rɔbɛdi NŊWƐ NŊWƐ . sɛkʼɛtʼɛ …
```

The DECIMAL arm claimed `28.11` out of the D.M.Y date `28.11.1820` — its trailing guard was `(?![\d])` and
the next character is a `.`, not a digit. The day and month came out as spelled-out fraction digits. Fixed
two ways so the two rules are independent (trap 39's lesson inverted — a guard's evidence has a lifetime):
a new step 3b spends a D.M.Y date's dots outright (those dots were THREE sentence breaks inside one date,
`*30.01.1912 ka Hannover †27.12.1999`), and the decimal arm's guard became `(?![\d]|\.\d)`.

The second, found by the test file rather than the diff: `ka nako ya 1:56.72` read as **`1:56 7 2`** — the
decimal arm claiming HALF of a race time this layer had explicitly declined to claim at all. `(?<![\d.,])`
admits a preceding `:`. Guard is now `(?<![\d.,:])`. **Refuse the whole match, never half of it** (trap 53).

**And one thing the diff proved right rather than wrong**, worth recording because it looks alarming:

```
SRC Uropa … batho ba fetang 742 000 000 ka palo
 -  … mɑkχɔlɔ ɑ supʼilɛŋ lɛ mɑʃɔmɛ ɑ mɑnɛ lɛ …      "seven hundred forty-two" then two zeros-runs
 +  … DIMILIƆNƐ mɑkχɔlɔ ɑ supʼilɛŋ lɛ mɑʃɔmɛ …      "742 million"
```

That is `numbers.ts` doing its job once space-grouping is spent — not a magnitude this layer invented.

## Run 7 — 2026-08-14 09:45 — the dotted-run trade, measured instead of assumed

**Command.** `grep -oP "\p{Lu}\.\p{Lu}\.\s+\p{Lu}\w+" /tmp/st-work/corpus.txt`

**Question.** The Chichewa-shaped dotted-abbreviation rule drops the final dot when a capitalised word
follows, and my first test asserted it should be KEPT (`4000 B.C. Li ne li entsoe` is a real sentence end).
Which behaviour is right for this corpus?

**Raw finding — three instances, and they do not agree:**

```
B.C. Li            a genuine sentence end   → keeping the dot is RIGHT
J.G. Fraser        name initials            → keeping the dot is a SPURIOUS pause
U.D. Oliveirense   a club name              → likewise
```

1 against 2. The dot goes; the one lost pause is recorded in the step-3 comment and in the test, rather than
being traded for two invented ones. (The alternative regex — consume the interior space only when another
capital-dot pair follows, `(?:[  ](?=\p{Lu}\.))?` — was written, run, and reverted.)

## Run 8 — 2026-08-14 09:55 — the gates, closing state

```
npx tsx tools/referee-eval/eval.ts st       — DOES NOT RUN. `st` is not a referee code. Before = after = n/a.
npx tsx tools/normalization/review.ts --lang st
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/st.jsonc --lang st
npx tsx tools/normalization/corpus-diff.ts compare …
npx vitest run          244 files, 4166 passed, 5 skipped
npx tsc --noEmit        clean
```

**DROP, before → after** (annotations on the emitted corpus):

```
              before   after
currency        19       1     the residue is the € — `dieuro`/`diyuro` are 0/0, so the sign stays visible
percent         18       1     the residue is `liporesente tse 25%`, a REDUNDANT sign correctly dropped
                              (trap 12: the reading is byte-identical with and without it, so the gate
                               reports it and cannot be made not to)
ampersand        6       0
exponent         8       0
math-sign       15      15     all EasyTimeline `=` directives
minus           11      11     coordinates (`-28.61804; 28.70374`) and hyphen spans
degree           6       6     no degree noun and no scale name is sourceable — RED ON PURPOSE
TOTAL           83      34
```

`mine.ts scan` additionally lost `LEAK RAW-LATIN bn ×2` — the `bn` of `$2.5bn`, now read as *dibilione*.
`LEAK RAW-LATIN lb ×2` remains and is not a Sesotho defect: it is `Li-clones … 1,800 lb / acre`, an English
parenthetical inside a Lesotho-orthography paragraph.

`review.ts` closes at **2 FAILING, both deliberate**: the sign-class probe (minus, plus, plus-minus, equals,
less-than, greater-than, times, divide, degrees — each measured ×0 or unsourceable above) and the artifact
scan (the same six classes). `sourcing` reports **all 4 high-traffic words attested**. Everything else `ok`,
including `spelling → g2p` (no word literal reaches the phoneme sink — trap 6).

**Deliberately NOT recorded in `tools/normalization/defects.ts`.** Two of the six residual classes have a
defensible accepted-silence argument (the `=` is a chart directive; the minus is a coordinate). The other
four do not, and `defects.ts` is a file two other agents are editing this week. An accepted silence claims
the drop is CORRECT; a red gate that is correct beats a green gate that is wrong (trap 24), so they are left
red and named here instead.

## Backlog — defects in shared code found on the way

1. **`normalizeSymbols.ts` line ~849: the missing-measure-word branch ignores `unitPrefix`.** When a
   language declares `units` and `unitPrefix: true` but no `exponentWords[power]`, the branch returns
   `` `${q} ${head}${exp}` `` — number first — where every other return in that callback honours
   `unitPrefix`. Reproducing reading, with `cubed` removed from st's declaration (st declares no cube word,
   so this is st's live path for `m³`):
   ```
   $ npx tsx probe.ts "120 m³"  "120 km³"
   "120 m³"   → lɛkχɔlɔ lɛ mɑʃɔmɛ ɑ mɑbɛdi dimitʰɑrɑ t͡sʼɛ
   "120 km³"  → lɛkχɔlɔ lɛ mɑʃɔmɛ ɑ mɑbɛdi dikʰilɔmitʰɑrɑ t͡sʼɛ
   ```
   The quantity comes BEFORE the noun in a `unitPrefix` language, and the concord `tse` is left dangling at
   the end of the phrase. Every other branch of the same callback would have produced `dimithara tse 120³`.
   (The re-emitted `³` then reaches the tokenizer, which has no rule for a superscript, so it is silent —
   which is the branch's stated intent, "leave it where the leak gate can see it", failing in a Latin-script
   language exactly the way trap 56 describes.) Not fixed here: `src/core` is the reviewer's call
   and the change touches every `unitPrefix` language. **No st corpus line is affected** — `m³`/`km³` are ×0
   in the artifact — which is why it is filed rather than worked around.
2. **`attest.ts` is rate-limited without backoff visibility.** Two of six batches printed
   `429 from st.wikipedia.org — waiting 9s (attempt 1/6)`. It recovered; noting only that a batch that
   exhausted six attempts would print a confident `absent`, which is trap 57's direction exactly.

## What could not be verified

* **There is no referee for `st` and there cannot be a before/after number.** `eval.ts` does not accept the
  code; `sesotho.jsonc` records why (kaikki "Sotho" = 3 IPA entries, no wikipron, no epitran). Every claim in
  this document rests on the corpus diff, the artifact scan, and readings pasted from `phonemize`.
* **`dikhilograma` is one token in one article.** The sense is exactly right (`basadi ba boima ba
  dikhilograma tse 50`, the women's 50 kg class) and every competing spelling is 0/0, but this is a lead by
  the playbook's own standard. It ships because the alternative reading is `[kχ]` — ⟨kg⟩ is a Sesotho
  grapheme — which is trap 56 rather than a visible gap. If a second source ever contradicts it, this is the
  first entry to revisit.
* **`dihekthere` (1/1) is probably a real word and is not declared**, because its ABBREVIATION is
  unusable here, not because the word is doubtful. If a future corpus writes `ha` after a numeral in a
  hectare sense, the refusal is one grep away from being re-measured.
* **The Lesotho-orthography half of the corpus is read with SA rules.** A `limithara`/`lik'hilomithara`
  sentence gets no unit reading from this layer at all (the ABBREVIATIONS still read; the spelled-out
  Lesotho nouns were always read as words and still are). Whether st should instead be two engines is a
  question this layer does not answer.
