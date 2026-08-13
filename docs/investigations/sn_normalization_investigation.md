# sn (Shona) text-normalization investigation

Chronological log for the Shona normalization layer. Kept per the playbook's workflow: every run records
the command, the question it was meant to answer, the raw finding, and what that implies for the next step.
Negative results are kept deliberately.

**Standing caveat for this language.** Shona has **no FLEURS corpus, no kaikki (>25 IPA entries), and no
wikipron**. The only referee is `epitran sna-Latn`, which is *programmatic* and *word-only*. There is
therefore **no referee at all for the normalization layer** — `referee-eval.ts sn` measures the g2p's
agreement with a rule-based transliterator over 443 isolated words, none of which contains a digit or a
symbol. It is a **tripwire** (it goes red if I break the g2p), never a meter for this work. See Run 2.

The corpus is `tools/corpus/mined/sn.jsonc`, a dump-sourced artifact of sn.wikipedia (51,971 paragraphs,
441 retained segments = 8 hard + sample). Because the dump itself is not in the repository, **every count
below is over the 439 deduplicated retained segments**, not over the 51,971. Where the artifact's own
`counts` block gives a whole-corpus figure I say so explicitly.

---

## Run 1 — 2026-08-12 19:05

**Command.**

```
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/sn.jsonc --lang sn
npx tsx tools/normalization/corpus-diff.ts emit --lang sn --corpus mined:sn --out <before>
npx tsx tools/normalization/sources.ts --lang sn
npx tsx tools/normalization/review.ts --lang sn
npx tsx tools/referee-eval/eval.ts sn
```

**Question.** What is the baseline — which gates have anything to say about Shona at all, and what does the
engine currently do to the forms the corpus writes?

**Raw finding.**

`mine.ts scan` — 7 DROP classes, 91 instances:

```
DROP math-sign     ×26      DROP currency      ×19      DROP minus         ×10
DROP percent       ×10      DROP exponent      ×10      DROP degree        ×8
DROP ampersand     ×8       MARKUP math-sign   ×1
```

`corpus-diff emit` — 439 utterances (`mined:sn`; there is no FLEURS `sn_zw`).

`sources.ts` — espeak does **not ship Shona at all**, so the strongest external haystack this repo has is
absent. `letter-names NONE`, `decimal-point NONE`, `fraction-series NONE`; percent/currency/minus/equals/
ampersand/exponent all `chk?`.

`review.ts` — one FAIL, `normalize.ts missing`. Nothing else runs until the file exists.

`referee-eval sn` — 443 words, raw exact 263/443 (59.4%), folded backbone **440/443 (99.3%)**, symbol
accuracy 99.9%. Three residual divergences, all the `⟨mv⟩` grapheme (`mvura`, `mvuu`, `muzvcazi`).

**Engine probes on attested surface forms** (`phonemize(f, "sn")`):

```
"85%"                 → makumi sere ne ʃanu                              % SILENT
"$60"                 → makumi tan̤atu                                   $ SILENT
"US$28,000"           → us makumi piri ne sere , zero                    "us" as a word; comma = PAUSE
"1,606,000"           → mot͡si , zana tan̤atu ne tan̤atu , zero            three numbers and two pauses
"12.9cm"              → ɡumi ne piri . p͡fuᵐbamwe km                      "." = PAUSE mid-number; cm → [km]
"105 kg"              → zana ne ʃanu kɡ                                  raw letters
"120 km/hr"           → zana ne makumi piri km hr                        raw letters, slash silent
"makore 25-30"        → makore makumi piri ne ʃanu makumi tatu           hyphen SILENT, two bare cardinals
"1987-2017"           → …p͡fuᵐbamwe ne makumi sere ne nomwe t͡ʃuru piri…   ditto, on years
"22/7"                → makumi piri ne piri nomwe                        slash silent
"32 ° C"              → makumi tatu ne piri k                            ° silent, C → [k]
"1m²"                 → mot͡si m                                          ² silent, m raw
"$800 - $600 = $200"  → zana sere zana tan̤atu zana piri                  −, = and $ all silent
"13-16million"        → ɡumi ne tatu ɡumi ne tan̤atu million             raw English magnitude
"gore ra1923"         → ɡore ra t͡ʃuru ne zana p͡fuᵐbamwe ne makumi…       the proclitic survives as a token
```

**Implication.**

1. Every symbol class the corpus writes is currently silent or leaks a raw Latin spelling. That is the
   layer's whole job and it is unwritten.
2. The **grouping comma and the decimal point are read as CLAUSE PUNCTUATION**, which is the playbook's
   first ordering coupling ("digit de-grouping first"). `1,606,000` produces two spurious pauses and three
   wrong numbers. The artifact's whole-corpus count for `grouped` is 204 and for `decimals` 397.
3. `gore ra1923` is the one shape that already reads acceptably — the proclitic concord `ra` falls out as
   its own token with no pause, which is roughly what a reader does. Flagged for a proper measurement in
   Run 4 (this is the Bantu trap-14/15 shape, mirrored to the LEFT).
4. `referee-eval` will be re-run, but it can only ever confirm I did not break the g2p. **Meter vs
   tripwire, stated once here:** `vitest`/`tsc`/`corpus-diff`/`mine scan`/`review` are meters for this work;
   `referee-eval` is a tripwire.

Next: measure the corpus cell by cell before writing a single rule, and check contamination — this wiki
carries a large comparative-Bantu dictionary project written substantially in English.

---

## Run 2 — 2026-08-12 19:25

**Command.** A function-word contamination test (the `filter-by-language.py` method, run in scratch with a
Shona marker row against the stock English contrast set), over the artifact's retained text, whole and then
**per cell**.

**Question.** sn.wikipedia carries a large comparative-Bantu dictionary project whose entries are
English-glossed, plus imported English sports tables. Is the evidence I am about to write rules from
actually Shona? (Playbook §0b, the su lesson; trap 34.)

**Raw finding.** Whole retained text, 439 segments: **sn-dominant 316 (72.0%), English-dominant 72 (16.4%),
undecidable 51 (11.6%)**. That is the same order as `ht` (15.1% French) and `bar` (24% German).

Per cell (8 hard segments each), sorted by English share:

```
sports-time  100%   dotted 62%   era-marker 50%   ordinal-latin 38%   letter-name 38%   clock 38%
exponent 25%   ampersand 25%
scaled-currency · roman · quote-letter · grouped · fractions · currency · abbrev      12%
percent · ranges · units · decimals · degrees · rate · signs · arithmetic · digit-run · year   0%
```

**Implication.** The contamination is exactly as unevenly distributed as the playbook predicts, and it lands
on the cells I was least likely to write a rule from anyway. The ten cells that carry this layer's real work
are **0% English**. The cells I must NOT write rules from are named by this table, and each is checked by
hand in Run 3 rather than trusted:

- `sports-time` — 8/8 are an imported English swimming-results table (`Gold in the 800 m freestyle
  (8:43.89 CR)`). No Shona sports time exists in the evidence.
- `dotted` / `era-marker` — the comparative-Bantu dictionary's English abbreviations (`n.`, `v.t.`, `e.g.`,
  `adv.`). `era-marker`'s Shona instances are 2 (`muna 3000 B.C.`, `kuzvika muna 533 CE`).
- `ordinal-latin` — dictionary sense numbering, `(1. Boomslang, 2. Water snake)`, plus one `19th Century`.

⚠ **Variety.** Six of the `clock` cell's eight segments are a **ChiNdau** Bible parallel text, labelled as
such in the corpus itself (*"kubva muBhaibheri reChiNdau"*). Ndau is a Shona variety with its own
orthography, and this text is bilingual Ndau/English. It is evidence about Ndau Bible typography, not about
Standard (Zezuru-based) Shona, and no rule below rests on it.

---

## Run 3 — 2026-08-12 19:40

**Commands.** `grep -oP` tabulations over the 439 retained segments (`/tmp/sn.before.src`), one per cell.

**Question.** Cell by cell: what shape does Shona actually write, and does the nya/rw/rn rule for that cell
survive re-measurement here? (The rn lesson: every borrowed rule is a hypothesis.)

### 3.1 Separators — which mark is the decimal and which the grouping?

The corpus **states its own convention**, in a Shona mathematics article:

> *"Cherechedzai zvakare kuti ana **koma** vanotsvetwa mushure menzvimbo nhatu dzega-dzega zvichibva kurudyi
> … Pakati pezvibodzi nezvikamu panotsvetwa **poyindi**."*
> ("commas are placed after every three places from the right … between the whole numbers and the parts a
> POINT is placed")

Measured against that:

```
comma + exactly 3 digits (grouping)     20 groups, 18 distinct tokens   431,257,698 · 1,606,000 · 6,650km · $480,000,000
comma + 1–2 digits, letter follows       6                              0,5m² ×4 · 273,15K ×2
comma-separated LIST of numbers          1 list, 11 commas              "3,4,6,7,8,9,10,4,11,2,1,4"
period + 1–2 digits (decimal)           ~40                             12.9cm · 2.1-3.4m · 99.8 percent · 101.365kPa
space-grouped                            1                              US$7 000
```

⚠ **The comma-separated LIST is the trap here, and it is Shona-specific.** A naive `\d+,\d{1,2}` decimal arm
claims `3,4` and `6,7` out of that list. All six genuine comma-decimals are followed immediately by a unit
LETTER; not one list element is. That lookahead takes 6/6 and 0/11.

**Implication.** Grouping arms demand blocks of exactly three digits (20 against 0 counter-examples, same
discipline as nya); the comma-decimal arm additionally demands a following letter.

### 3.2 The decimal word — `poyindi`

`sources.ts` reports `[NONE] decimal-point`, and espeak ships no Shona, so nya's answer here was "no
separator word, spell the fractional digits". Shona is **not** in that position: the sentence above is a
definitional statement of exactly this slot, using `poyindi`.

`attest.ts --lang sn --words poyindi` → **30 token hits in 13 articles**, verdict `attested`.
⚠ **And the sense check does not simply confirm it.** The readable wiki examples are the GEOMETRIC point —
*"Muchidzidzo chePimanyika, poyindi kana shanga (point) izita rinoreva kanzvimbo katokotoko"*, *"Sarudza
poyindi A iri padenderedzwa"* — and dictionary glosses of *"a point, a tip"*. The decimal sense rests on the
ONE corpus sentence above. Recorded as the limit rather than papered over; the same polysemy is true of
English "point", which is why the loan is usable at all. `poindi` is ×0 — the spelling is `poyindi`.

### 3.3 The percent word — `pazana`, and `muzana` is the higher-count LOSER

Both are attested, and the corpus glosses both directly against the sign:

```
pazana   22 hits / 20 arts   "chikamu chimwe pazana (1%), zviviri pazana (2%)"      ← BARE, POSTPOSED
                             "chikamu che 71 pazana (71%)"        [sn corpus]
                             "makumi masere nemapfumbamwe kubva pazana (79%)"       [sn corpus]
muzana   56 hits / 20 arts   "zvikamu zvevhu makumi masere kubva muzana (80%)"      ← ALWAYS with `kubva`
```

**`muzana` outnumbers `pazana` 56 to 22 and is the wrong pick**, because every one of its hits is inside the
frame `kubva muzana` ("out of a hundred") and the tier emits a BARE word after the number. `pazana` is the
only one attested bare-postposed — `zviviri pazana (2%)` is the exact shape the tier produces. This is trap
37's "picking by count picks the wrong unit", reproduced.
`peresenti` — the word **nya** ships — is **×0 on sn.wikipedia**. A sibling's rule, refuted.

### 3.4 The currency word — `madhora`, and the order is PREFIX

```
madhora   attested   "chikwereti chezana remadhora chinonyorwa senhamba yakagon'a sezvizvi -$100"   [sn corpus]
                     "madhora miriyoni 1.1" · "madhora 5.5 miriyoni" · "madhora makumi masere emamiriyoni"
dhora     ×0         the singular is not attested at all; the class-6 plural is the citation form
mapondo   ×0  pondo ×0   → `£` DECLINED (its 2 corpus instances are a quotation of Virginia Woolf)
```

The first line is a gloss of the sign itself: *"a debt of a hundred dollars is written as a negative number
like this: `-$100`"*. Every instance puts the noun BEFORE the number → `currencyPrefix: true`.

⚠ **`US$` NEEDS ITS OWN KEY, and this is a divergence from nya.** nya records that its corpus writes the
code SPACED (`US $ 50,000`) so a bare `$` matches. Shona **glues** it: `US$28,000`, `US$7 000`, `US$22
billion`, `US$100,000` — 4 of the corpus's 19 currency instances — and the tier's `$` key is letter-bounded
on the left precisely so a code prefix is not split. Copied verbatim, nya's declaration reads none of them.

### 3.5 Units — Shona is a UNIT-PREFIX language, and two words are NOT sourceable

Every measure noun in this corpus and on the wiki heads its phrase:

```
makiromita 200 · makiromita mazanamatanhatu (600) · makilomita 305 · mamita anosvika · masendimita 5.5
matani gumi · matani 25 miriyoni · maawa 2 · mita pa sekondi · maskweya kiromita 1,886,068
```

→ `unitPrefix: true` (trap 47 reason 2 does NOT apply — the tier gained `unitPrefix` for Swahili and it
expresses this exactly).

```
km   makiromita   33 hits / 20 arts      ✓        h/hr/hrs  awa   5 of 6 corpus instances are the hour noun
m    mamita       10 hits /  9 arts      ✓        s         sekondi ("mita pa sekondi (m/s)")
cm   masendimita   1 hit  /  1 art       ⚠ LEAD, not a finding — declared anyway, see below
t    matani        5 hits /  4 arts      ✓        min       mineti ("Dendera pa Mineti", "radian pa mineti")
kg   makirogiramu  ×0 · kirogiramu ×0 · makiro ×0     ✗ NOT SOURCEABLE
```

⚠ **`kg` IS DECLINED AND IT IS THE MOST-WRITTEN UNIT AFTER km AND m** — 8 digit-adjacent instances in the
retained text (`105 kg`, `40kg`, `685 kg`, `46–76&nbsp;kg`, `3.2-3.6kg`, `0.5-8.9kg`, `100kg`, `$5 pa Kg`),
all of which keep reading as a raw [kɡ] cluster. espeak ships no Shona and no in-repo source carries the
word. Leaving it unread beats inventing it.

### 3.6 The range joiner — `kusvika`, glossed against the digits twice

```
"padzinenge dzave nemwedzi mitanhatu KUSVIKA gumi nemiviri (6-12)"
"mushure memazuva makumi mashunu ne matanhatu KUSVIKA makumi manomwe nemavari (56-72)"
"kubva pa 2.5 metres KUSVIKA ku 3.2 metres"     "makore ekubva 1955 KUSVIKA 1959"     "kubva 0-100 km/hr"
```

Two of those spell the span out in words AND give the digit form in parentheses in the same sentence — the
strongest attestation in this run. `attest.ts` → 37 hits / 20 articles; the sense is *"to arrive, until"*,
and the PART OF SPEECH check (the Fula `hakkunde` lesson) passes: it is used as a bare infix between two
numerals, which is exactly the slot.

### 3.7 The rate connective — `pa`

`mita pa sekondi (m/s)` · `Dendera pa Mineti (Revolutions per minute)` · `radian pa mineti` ·
`10km pa Rita repeturu` · `$5 pa Kg` · `US$28,000 pa tonne`. Six independent slots, three of them glossed
against the English. Same word nya found (`pa`) — **this borrowed rule survives**.

### 3.8 The squared word — `maskweya` / `skweya`

```
maskweya  5 hits / 5 arts   "maskweya ekiromita 1,100,000" · "1,886,068 maskweya kiromita" · "maskweya emakiromita"
skweya   38 hits /19 arts   "skweya remita; skweya rekiromita; skweya refutu"   ← the geometry article, definitional
```

Position is BEFORE the unit noun, settled by the definitional list. ⚠ **What I cannot express** is the
associative concord the corpus writes on the unit — `maskweya **e**makiromita` — because that prefix is
inside the following word. The tier's `before` emits `maskweya makiromita`; the bare juxtaposition
`maskweya kiromita` is itself attested twice, so the shape is right and one concord is missing. Recorded, not
hidden.

**Cubed is NOT sourceable**: `kubhiki` ×0, `kubhiku` ×0, and `attest.ts --after makiromita,mamita,mita`
returns only numerals. That is trap 51's floor, one language further on. `m³` (×1 in the corpus, `25,339 m³`)
keeps dropping its exponent.

### 3.9 The degree word — DECLINED, and the near-miss is instructive

`attest.ts --lang sn --words dhigirii` → **18 hits / 14 articles, verdict `attested`**. Every readable
example is an ACADEMIC degree: *dhigirii reBachelor*, *dhigirii reMasters*, *dhigirii raDhokotera*,
*dhigirii re chibhachera*. ⚠ **This is `zu amaphuzu` exactly**, and nya's own file warns about the same
polysemy for `madigiri` — but nya had a decisive collocation beside the sign itself and Shona does not.
`madhigiriyi` and `madhigirii` are **×0 on the wiki**; the corpus's single `10 madhigiriyi` is an image
caption about latitude lines. One caption is not an attestation for 29 corpus degrees. **Declined.**

⚠ **Compass words declined too, and NOT for lack of candidates.** This wiki's own directional vocabulary is
internally inconsistent: the Arctic article writes *"gonga remaodzanyemba … kwagumira maodzanyemba
eRinopasi"* and *"kumaodzanyemba kwedenderedzwa reArtic (66° 33'N)"* — using `maodzanyemba` for NORTH —
while *Afurika Chamhembe* (South Africa) and the Zimbabwean place articles use `chamhembe` for SOUTH and
`maodzanyemba` for SOUTH. A compass word that is 180° wrong is the worst kind of confidently-wrong reading,
so nya's `COMPASS` table does **not** transfer.

### 3.10 The clock — DECLINED, on a tabulation of all 23 colon shapes

Trap 4's move (the German bare-ordinal table), and it lands very differently from nya:

```
sports time  M:SS.hh   10   the imported English swimming table — 100% English by Run 2
Bible ch:verse           9   Genesis 30:13 · 37:18 · 8:23 · 49:13 · 18:11 · Rute 1:19 · Joel 1:9 · Psalm 118:26 · 144:15
ratio / score            2   "zvibodzwa 3:2 papera mutambo" · "vane 30:15 migomo yemvura"
list position            2   "rinotevera rinova 16: 27/16"
TRUE CLOCK               2   "iri pa 06:00hrs" · "inenge iri pa 08:00hrs"
```

2 of 23, both `HH:00hrs`, both in one article, and Shona has no attested clock idiom (`koloko`-equivalent
×0). nya shipped a clock because it had 12 marked instances and three sourced nouns; Shona has neither.
**Declined**, and the `:` keeps reading as the comma pause it already was.

### 3.11 Trap 14/15 — it DOES occur in Shona, mirrored to the LEFT, and it is HARMLESS

⚠ This is the one the brief flagged, and the answer is neither nya's ("the shape does not occur") nor
Welsh's ("it occurs and breaks the reading").

```
bound particle GLUED to a digit run   38   ra1923 ×14 · pa2 · ne180 · ye32 · we120 · che99.8 · wa18 · mu2020 · ku38 · pe10
the SAME particles SPACED             26   "ra 2" · "pa 2" · "ne 2" · "ku 3" · "che 7" · "ye 4" · "we 1"
bound suffix AFTER a digit run         0   (every `\d+\p{L}{1,4}` is a unit abbreviation: km, m, cm, kg, hr, hrs)
```

So Shona writes the same morpheme both ways — trap 15's finding — but nothing has to be done about it, for
a reason worth stating: **a Shona associative/locative proclitic agrees with the HEAD NOUN, not with the
numeral.** `gore ra1923` is "year OF-1923"; the `ra` is fixed by `gore`, which is already in the text. There
is no agreement to compute and no reason to word-ify the operand, so — as in nya, by a different route —
every rule below may leave its operand as DIGITS. Verified in Run 1: `gore ra1923` → *ɡore ra t͡ʃuru ne
zana p͡fuᵐbamwe ne makumi piri ne tatu*, with `ra` correctly its own token and no pause.

⚠ **BUT THE PROCLITIC BREAKS EVERY BORROWED LEFT-GUARD, and this is the real cost.** nya's rules open
`(?<![\p{L}\p{M}])`, and the tier's currency key is letter-bounded on the left for the `US$` reason. Applied
to Shona those guards reject the corpus's own instances: `ye32 ° C`, `ne180 °`, `ye$150`, `che99.8`. This is
trap 27's shape — a guard that assumes a space arrives at the ordinary case — reaching a Bantu language
through the proclitic instead of through an unspaced script. Measured and handled in Run 4.

### 3.12 Signs — what is declined, with the counts

- **`=` ×20 — DECLINED, a sourced refusal.** The word is attested (`-enzana`, "be equal"): *"0 Kelvins
  inenge **yaenzana** ne -273,15K"*, *"inoda **kuyenzana** na (22/7)"*, and a maths article reads its
  equations *"mbiri (2) kuwanzana nenhatu (3) **zvakaenzana na** 6"*. **Every finite form carries a SUBJECT
  CONCORD** — `ya-` for class 9, `zva-` for class 8, `ra-` for class 5 — which this layer cannot compute,
  and the article's `zvakaenzana` is already a class mismatch for a numeric subject. This is the Fula
  `hakkunde` failure: the word is real, and the slot it fits is not the slot I have. Trap 24 — the gate stays
  RED and that is correct.
- **`−` / negative — DECLINED.** Two candidates, both attested, both concorded adjectives from one
  vocabulary article: `hwaradada` (23 hits / 9 arts, glossed *"-236 inhamba hwaradada: -236 is a negative
  number"*, but also meaning "empty" — *"Musoro wake wakati hwaradada"*) and `yakagon'a` (the sn corpus's
  own `-$100` gloss). Both take the frame NOUN + adjective (`nhamba hwaradada`), never `hwaradada <number>`.
  ⚠ Recorded with the playbook's warning attached: **omitting a minus INVERTS**, unlike a plus. 6 genuine
  negatives in the retained text (3 coordinates, 2 currency, 1 Kelvin). Stated rather than guessed.
- **`+` — DECLINED**, and the playbook's fleet finding holds here: 8 of the corpus's 11 pluses are a
  coordinate sign redundant with the following `E`/`N` letter (`+30 o E`, `+23.5 o`), 2 are ion charges
  (`Zn 2+`), and 1 is a UTC offset (`GMT + 2hrs`) — the one contentful case, and nothing attests it.
- **`&` — DECLINED as a WORD, folded as ENTITIES.** Every `&` in a Shona sentence is an HTML entity:
  `&nbsp;` ×3 (`46–76&nbsp;kg`, `80&nbsp;km/h`), `&phi;`, `&lambda;`. The bare `&` occurs only inside
  English dictionary glosses (*"flour & water"*). nya declared no `ampersand` on the tier for the `&nbsp;`
  reason and handled entities locally; **that borrowed rule survives**, and Shona needs only the fold.
- **`×` / `x` — TAKEN, and this one is new.** The multiplication word is glossed four times in a Shona
  maths article, in the infix slot: *"four times five inenge yonzi **zvina kuwanzana ne**shanu"*, *"mbiri (2)
  **kuwanzana ne**nhatu (3)"*, *"nhatu (3) **kuwanzana ne**ina"*, *"5x kureva 5 **kuwanzana na**x"*.
  ⚠ `attest.ts` → 7 token hits in **ONE article**, which is a lead by the article-count rule — but it is a
  DEFINITIONAL article glossing the operation against both the English and the digit form, four separate
  times, and 5 genuine `N x N` instances in Shona prose are currently reading as bare juxtaposition. Taken,
  with the one-article limit recorded.
- **Fractions — DECLINED.** `sources.ts` reports `[NONE] fraction-series` and there is none to compose
  from: `hafu` is attested (*"zvitatu nehafu (3.5%)"*) and nothing else is. 12 `N/N` shapes, plus 2 dates
  (`31/07/1920`) a fraction rule would have claimed.

---

## Run 4 — 2026-08-12 20:05

**Command.** `attest.ts --lang sn --words …` (five batches, carry-forward on, default `--limit`), plus
`attest.ts --lang sn --after makiromita,mamita,mita` and `--after huremu,kg`; plus a delegated WEB SEARCH
pass over Shona dictionaries, JW.org's Shona corpus, Omniglot, Wiktionary and sn.wikipedia article text.

**Question.** For each word the layer would have to emit: is it attested, and — the half no tool does — is
the SENSE the one I need?

**Raw finding.** The probe's verdict and the sense check disagreed four times, in both directions.

| word | verdict | the sense, read |
|---|---|---|
| `madhora` | attested | ✅ currency, in monetary amounts, and the corpus glosses `-$100` with it |
| `dhora` | **absent** | the singular is not attested at all; the class-6 plural is the citation form |
| `pazana` | attested 22/20 | ✅ percent, bare-postposed — `zviviri pazana (2%)` |
| `muzana` | attested 56/20 | ✅ percent, but ONLY inside `kubva muzana`. Higher count, wrong slot |
| `peresenti` | **absent** | the word **nya** ships. A sibling's rule, refuted |
| `kusvika` | attested 37/20 | ✅ the range infix, and the part-of-speech check passes |
| `maskweya` / `skweya` | attested | ✅ the squared measure word, definitionally |
| `chiuru` / `zviuru` | attested 36/20, 34/20 | ✅ thousand — `"Chiuru (thousand) zvinoreva mazana gumi"` |
| **`churu`** | attested 33/20 | ⚠ **THE ANTHILL.** 33 of 33. And it is what `shona.jsonc` shipped as 1000 |
| **`dhigirii`** | attested 18/14 | ⚠ **AN ACADEMIC DEGREE.** *dhigirii reBachelor / reMasters / raDhokotera*, all of them |
| **`poyindi`** | attested 30/13 | ⚠ the GEOMETRIC point in every readable wiki hit |
| **`koma`** | attested 52/9 | ⚠ **Koma, a language of Ghana**, in every readable wiki hit |
| `kirogiramu` / `makirogiramu` / `makiro` | **absent ×3** | no wiki word for the kilogram at all |
| `kubhiki` / `kubhiku` | **absent ×2** | no cube word |
| `mapondo` / `pondo` | **absent ×2** | no pound word |
| `kuwanzana` | attested 7 tokens / **1 article** | ✅ multiply, glossed 4× in the infix slot — but one article |
| `hwaradada` | attested 23/9 | ⚠ "negative" AND "empty"; and it is a post-nominal adjective |

**Three of these would have shipped a confidently wrong reading**, and none of them looks wrong from the
verdict column:

1. **`churu` for 1000 was already shipped**, in `shona.jsonc`, before this run. Every Shona number ≥ 1000
   was reading "anthill". This is `zu amaphuzu` and `rn kare` in the language's *existing* data. Fixed.
2. **`dhigirii`** passes `attested` with 14 articles and is an academic qualification. What rescued the
   degree was not the probe but a targeted article read (**this is why the brief said to use web search as
   well**): sn.wikipedia's `Gonyo` (angle) article says *"Gonyo kana ichipimwa inopimwa nechiyero chinonzi
   DHIGIRIYI chinova chinomirirwa nevara iri (o)"* — naming the SIGN. Note the spelling: `madhigirii` is
   ×0; the attested plural is `madhigiriyi`, which the corpus corroborates (`10 madhigiriyi`).
3. **`muzana` outnumbers `pazana` 56 to 22 and is the wrong word for this slot.** Trap 37.

**The `--after` probe** (trap 40) was the run's other payoff. `--after makiromita,mamita,mita` returned no
measure word — and instead returned **the numeral system glossed against digits five times**:

```
makiromita ezvuruzvisere (8000km)                 8000   = zviuru zvisere
makiromita ezvuruzvinomwe-nemazanamana (7,400km)  7,400  = zviuru zvinomwe ne mazana mana
makiromita ezvuruzvemakumimaviri-netanhatu (26,000km)
makiromita ezvuruzitanhatu nemazanamatanhatu…     6,650  = zviuru zvitanhatu ne mazana matanhatu ne makumi mashanu
makiromita ezvuruzvitatu mazanamashanu-nemakumiman… 3,540
```

`--after huremu,kg` returned nothing usable, which is the negative that closed the kilogram question on the
wiki side.

**Implication.** Two words are declared on evidence from OUTSIDE this repo and both are flagged at their
declaration: `makirogiramu` (sn.wikipedia silent; JW.org's human-translated Shona corpus writes
*makirogiramu 34*, and it is the productive SI pattern of the loans the wiki DOES attest) and
`masendimita` (1 wiki hit in 1 article — a lead, not a finding — plus the same JW.org corpus). Everything
else is in-repo. `kg` is the most-written unit after km and m, so leaving it unread was the alternative;
declaring it on a named outside source and saying so beats both silence and invention.

### The decimal word — the one decision I changed twice, recorded in full

sn.wikipedia carries **both numeric conventions in different articles, each naming its own mark**:

- `Zviperengo zvehuwandu` (which this corpus retains) — UK/US: *"ana **koma** vanotsvetwa mushure menzvimbo
  nhatu"* (commas every three places) and *"Pakati pezvibodzi nezvikamu panotsvetwa **poyindi**"*.
- `Rupande rweMuravanegumi` (decimal fractions) — SI/Southern-African, and it gives a worked SPOKEN
  reading: 0,286 → *"zero **koma** mbiri nomwe nhanhatu"*; 12,286 → *"gumi nembiri koma mbiri nomwe
  nhanhatu"*.

I first took `poyindi` (my corpus's own sentence), then `koma` (the only one attested inside a *reading* —
the register point that put `धन` into Hindi), then settled on **one word per mark**. The corpus decides
which mark is which, not which word: **period-as-decimal ~40 instances against 6 comma-as-decimal, and 20
comma-grouped thousands against 0 period-grouped**. So the text this layer reads follows the first
convention, and each mark gets the word that names it — the arrangement in which nothing is invented and no
reading calls a printed point a comma. The limit is stated at the declaration: `koma` has a worked spoken
reading behind it and `poyindi` has only the writing-description register.

⚠ The wiki sense check is *negative for both words* (`koma` = a Ghanaian language; `poyindi` = the
geometric point), so both rest on the two maths articles. That is the weakest link in this layer and it is
labelled as such in the code.

---

## Run 5 — 2026-08-12 20:35

**Command.** `npx tsx tools/normalization/corpus-diff.ts emit/compare`, `mine.ts scan`, `review.ts --lang
sn`, `referee-eval.ts sn`, `npx vitest run`, `npx tsc --noEmit`, then
`derive-normalization.py` + `build.py`.

**Question.** What did the layer actually change, and did anything break?

**Raw finding — before/after for every gate.**

| gate | before | after | meter or tripwire |
|---|---|---|---|
| `corpus-diff` DROP | **82** | **44** | meter — 160/439 utterances changed (36.4%) |
| `corpus-diff` DIGIT / SLOT-GAP / RAWMARK / THROW | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | meter |
| `mine.ts scan` | 7 classes, 91 instances | **2 classes, 11 instances** (+ 40 ACCEPTED) | meter |
| `review.ts` | 1 FAIL (`normalize.ts missing`) | **2 FAIL, both deliberate** | meter |
| `sources.ts` percent / currency | `chk?` | declared and read | meter (prompt) |
| `referee-eval sn` | 263/443 raw, 440/443 folded, 99.9% | **byte-identical** | **tripwire only** |
| `vitest` | 3820 pass | **3821 pass, 0 fail** | meter |
| `tsc --noEmit` | clean | clean | meter |
| `languageCatalogue.test.ts` | pass | pass, after `derive-normalization.py` moved sn `none` → `done` | meter |

Per-class `mine.ts scan`:

```
                before   after
DROP math-sign    26   →   0 unaccepted (27 ACCEPTED-CLASS — the `=` refusal)
DROP currency     19   →   0 unaccepted (1 ACCEPTED — the £ quotation)
DROP percent      10   →   0
DROP exponent     10   →   1 unaccepted (4 ACCEPTED — `(m/s²)` cited with no number)
DROP minus        10   →  10 (DELIBERATE — see below)
DROP degree        8   →   0
DROP ampersand     8   →   0 unaccepted (8 ACCEPTED-CLASS — markup and English)
```

⚠ **`referee-eval` is byte-identical across a substantial rewrite of `numbers.ts`**, which is the cleanest
possible demonstration that it is not a meter for this work: its 443-word list contains no numeral. Stated
in Run 1 as a prediction; confirmed here.

**The two remaining `review.ts` FAILs are both genuine sourced refusals and stay RED** (trap 24):

1. **`minus`.** Deliberately absent from `ACCEPTED_SIGN_SILENCE` — the `ln`/`rw`/`ht` stance. Shona has real
   negatives (4 latitudes in the class, plus `-$100`, `-$50`, `-273,15K` outside it), two attested candidate
   words, and neither fits: `hwaradada` and `yakagon'a` are both **concorded adjectives** in the frame NOUN
   + adjective, never `<word> <number>`. Omitting a minus INVERTS.
2. **`exponent ×1`.** The bare-base run `2⁰ … 2¹ … 2²`. `pawa` is attested as the power word (*pawa ra 2*,
   *pawa wa 2*) but its associative connective changes with the base's noun class — the same blocker as `=`.

**Reading the sampled changes** (the gate the playbook says earns its keep). Every one I read was an
improvement; three are worth quoting because no probe named them:

- `12.9cm` was reading ***ɡumi ne piri . p͡fuᵐbamwe KM*** — the centimetre abbreviation reaching the g2p as
  the letters `c`+`m`, and Shona's `c` has no grapheme so `latinPhone` gave [k]. A **wrong unit**, not a
  dropped one. Now *maseⁿdimita ɡumi ne piri pojiⁿdi p͡fuᵐbamwe*.
- `6,650km` was three numbers and two pauses; now *makiromita ɀiuru ɀitan̤atu ne mazana matan̤atu ne makumi
  maʃanu*, which is the corpus's own spelled gloss of that figure modulo the closed spelling.
- The corpus's worked reading of `431,257,698` now composes structurally word for word against the sentence
  the corpus writes next to it.

One reading is *changed but not right*: `1.1 Pakutanga Mwari akasika…` is Bible VERSE numbering and now
reads *mot͡si pojiⁿdi mot͡si*. It was previously *mot͡si . mot͡si* — a spurious sentence break — so this is
strictly better and strictly not correct. 1 instance; recorded rather than guarded, because the guard would
have to distinguish a verse number from a decimal and nothing in the text does.

**Implication.** Two defects were exposed BY the layer rather than fixed by it, which is the normal order:

- **De-grouping made numbers ≥10⁶ reach the composer for the first time**, and they fell straight through to
  the digit-by-digit fallback. `numbers.ts` gained a million/billion arm, worded and ordered from the
  corpus's own reading.
- **Widening the period-decimal arm.** The sibling layers cap both separator arms at a 1–2 digit tail,
  because a longer tail is a grouped thousand their de-grouping declined. That reasoning is about a language
  that groups with periods, and Shona does not: **0 period-grouped thousands** here (its one candidate,
  `101.365kPa`, is atmospheric pressure — a decimal) against **14 period-decimals with a 3+ digit tail** —
  the coordinates this wiki writes for every Zimbabwean place, plus π at `3.14159`. Capped, each emitted a
  sentence break mid-number. 14 against 0, so the period arm takes any tail and the comma arm keeps the cap.

---

## Run 6 — 2026-08-12 20:50 — which sibling rules survived re-measurement

The brief's central question, answered per rule rather than per language.

**Survived unchanged**

- **`pa` as the rate connective** (nya). Six independent Shona slots, three glossed against the English.
- **HTML entities folded locally instead of declaring `ampersand`** (nya). Same defect shape (`&nbsp;` in
  the number–unit gap), reached on Shona's own evidence: 12 `&`, all markup or English, 0 Shona.
- **Ascending-only ranges** (nya). Doing real work here — the descending pairs are a subtraction in a worked
  example, a football score, a birth–death pair whose second operand is a day, and a journal volume-year.
- **Stripping the English ordinal suffix** (nya). Shona writes its own ordinals as `chi-`/`re-` words.
- **De-grouping in blocks of exactly three** (nya, rw). 20 against 0 counter-examples.
- **`unitPrefix` + `currencyPrefix`** (sw, nya). Shona is unambiguous: the measure noun heads its phrase.

**Refuted or replaced**

- ⚠ **`peresenti`** — nya's percent word is **×0 on sn.wikipedia**. Shona's is `pazana`.
- ⚠ **nya's `COMPASS` table.** Not for lack of a Shona equivalent: this wiki's own directional vocabulary
  contradicts itself between the Arctic article and the Zimbabwean place articles, so `maodzanyemba` is
  north in one and south in the other. A compass word 180° out is the worst class of wrong.
- ⚠ **nya's clock.** 12 marked instances there, **2** here, no attested Shona clock idiom.
- ⚠ **nya's note that a bare `$` suffices.** nya's corpus spaces `US $`; Shona **glues** it, so the tier's
  deliberate left letter-boundary refuses 4 of the 19 currency instances. `US$` needs its own key.
- ⚠ **Every borrowed `(?<![\p{L}\p{M}])` LEFT GUARD.** Shona binds a proclitic to the front of a digit run
  (`ye32 ° C`, `ne180 °`, `ye$150`), so the siblings' guards decline the corpus's own instances. The degree
  rules use `(?<![\d.,])` instead, and step 2 splits the proclitic off a `$`.
  ⚠ The one place the guard is NOT widened is the dotted-capital-run rule, because `kuU.S.` has **zero**
  corpus instances — widening a guard for an uncounted shape is trap 9. Pinned as a test so the decision is
  re-checkable rather than invisible.
- ⚠ **The 1–2 digit cap on the period decimal.** See Run 5.

**The two the brief asked about specifically**

- **Noun-class concord reaching inside a numeral (nya's `mamiliyoni asanu ndi anayi`) — CONFIRMED for
  Shona, and it splits into a computable half and an uncomputable one.** The MAGNITUDE slot is computable
  and is now fixed in `numbers.ts`: `makumi` and `mazana` are class-6 nouns and `zviuru` is class 8, so
  their numeral takes that class's prefix whatever the phrase counts (`makumi maviri`, `mazana mana`,
  `zviuru zvisere` — 20 of 20 corpus instances, plus five digit-glossed wiki instances). The TRAILING UNIT
  agrees with the head noun, and one corpus sentence writes each of `makumi manomwe ne MAVARI` (72),
  `makumi matanhatu ne ZVINA` (64), `makumi mapfumbamwe ne VANOMWE` (97) — not computable from a digit, so
  it stays the bare recitation stem, which sn.wikipedia states is the counting series.
  ⚠ **What IS newly computable is the slot beside a measure noun**, and that is trap 14's prescribed fix
  applied: the tier's `madhora 2` read *madhora PIRI*, and step 9 now converts the operand to WORDS inside
  the rule that knows which noun precedes it — *madhora maviri*, the reading shonadictionary.com's own
  example sentence gives. 19 of ~55 unit-adjacent numbers here end in a stem that takes the concord.
- **`magnitudes` — WITHHELD, and for a different reason than nya's.** nya withheld it because its corpus
  attests only NOUN + NUMBER + MAGNITUDE. Shona attests **both** orders, in the same article — *madhora
  miriyoni 1.1* and *madhora 5.5 miriyoni* — so declaring the field asserts a preference the evidence does
  not support, while withholding leaves the magnitude where the writer put it, which is right either way.
  The playbook's "one declaration, two consumers" warning was checked, not assumed: the field also gates
  `magAltU`, and the shape that needs it (digit + magnitude + unit ABBREVIATION) is ×0 here.
- **rw's two-sided shared-tier call — NEEDED, and forced from both ends.** Ranges and de-grouping must reach
  the tier already rewritten, because Shona writes the unit after the SECOND operand of a range (`20-50 cm`)
  and the tier would otherwise move it and break the pair. The decimal spell-out and the concord pass must
  follow the tier. So `shona.ts` calls `normalizeShonaPost(SYMBOLS(normalizeShonaPre(input)))`.
- **Traps 8, 28/46 — measured, not inherited.** Bare `m` is declared: 15 digit-adjacent instances in Shona
  lines, all genuine metres, **0** false, and no `m'` apostrophe hazard (Shona's locative is `mu-`, not
  nya's `m'`). What DOES bite is `NOT_VERSION`, which rejects a dotted number glued to a one-letter key —
  and Shona's corpus contains **no dotted version designation at all** while writing seven decimal metre
  figures. So the guard is pure cost here and step 7 claims that case locally. Trap 46 through a third door.
- **Trap 15 — the same morpheme both glued and spaced, 38 vs 26 instances — occurs and is HARMLESS**,
  because a Shona proclitic agrees with the head noun rather than with the numeral. See Run 3.11.

---

## Declined, with counts — the standing list

| class | instances | why |
|---|---:|---|
| clock | 2 of 23 colon shapes | no attested Shona clock idiom; 10 of the 23 are an English sports table |
| `=` | 20 | `-enzana` is attested; every finite form carries a subject concord |
| minus / negative | 4 in class + 3 outside | `hwaradada` / `yakagon'a` are post-nominal adjectives |
| `+` | 11 | 8 redundant coordinate signs, 2 ion charges, 1 UTC offset nothing attests |
| `&` as a word | 12 | all markup or English; the entities ARE folded |
| fractions | 12 | `[NONE] fraction-series`; declining also protects 2 slashed dates |
| cubed (`m³`) | 1 | `kubhiki`/`kubhiku` ×0; trap 51's floor |
| degree COMPASS letters | 6 coordinates | the wiki's own direction words contradict each other |
| `£` | 2 | `mapondo`/`pondo` ×0; both instances quote Virginia Woolf |
| `ft` / `in` / `oz` / `mi` | ~6 | all English parentheticals glossing a metric figure already given |
| bare exponent (`2⁰`) | 3 | `pawa`'s associative varies with the base's class |
| letter names / initialisms | 794 (whole corpus) | no `letterName` table; espeak ships no Shona |
| decimal RANGES (`2.1-3.4m`) | 8 | the range guard excludes a dot on either operand |
| `m³` word ORDER | 1 | with no cubed word the tier ignores `unitPrefix` on that branch — a CORE issue, not touched |
