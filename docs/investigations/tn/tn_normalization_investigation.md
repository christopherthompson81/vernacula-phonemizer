# Setswana (`tn`) text-normalization investigation

Worktree `/tmp/wt-tn`, branch `n/tn`. Chronological. Raw findings, negative results kept.

## Run 1 — 2026-08-14 08:30 — baselines before touching anything

**Commands**

```
npx tsx tools/referee-eval/eval.ts tn
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/tn.jsonc --lang tn
npx tsx tools/normalization/corpus-diff.ts emit --lang tn --corpus mined:tn --out /tmp/tnwork/tn.before
```

**Question.** What is the engine's state before any normalization layer exists, and what does the
mined artifact say is broken?

**Raw findings.**

Referee (epitran tsn-Latn, 1592 words):

```
raw exact:      571/1592 (35.9%)
folded backbone:1592/1592 (100.0%)
symbol accuracy:100.0%
```

The artifact already exists (`tools/corpus/mined/tn.jsonc`, 44,271 segments from a tn.wikipedia dump,
`cellsCovered 31 / cellsTotal 35`) — step 0b of the playbook was done by an earlier commit, so this run
starts at step 1.

`mine.ts scan` (448 lines):

```
DROP percent       ×40
DROP currency      ×25
DROP math-sign     ×17
DROP degree        ×11
LEAK RAW-LATIN km  ×11
DROP minus         ×7
LEAK RAW-LATIN ft  ×6
DROP ampersand     ×6
DROP exponent      ×5
LEAK RAW-LATIN mm  ×3
LEAK RAW-LATIN bn  ×3
LEAK RAW-LATIN ml  ×1
LEAK RAW-LATIN www ×1
REDUNDANT currency ×2
```

DROP total = 111 (percent 40 + currency 25 + math-sign 17 + degree 11 + minus 7 + ampersand 6 +
exponent 5). Corpus counts from the artifact header: percent 937, currency 338, decimals 2317,
grouped 1553, units 417, ranges 2042, degrees 180, signs 1453, rate 43.

`corpus-diff emit` wrote 447 utterances to the baseline.

**Implication.** Every class the playbook names is live here and the corpus is big (44k paragraphs), so
this is a sourcing problem, not a detection problem. Next: read the corpus by hand, tabulate what
Setswana actually writes, and source each word form.

## Run 2 — 2026-08-14 09:10 — read the corpus, tabulate the separators

**Commands.** Dumped `tools/corpus/mined/tn.jsonc` (448 deduplicated segments: 240 hard + 200 sample) to
`/tmp/tnwork/tn_corpus.txt` and tabulated each numeric shape with a script over the same 448 lines.

**Question.** Which mark is grouping and which is decimal? Setswana Wikipedia looked like it wrote both in
both roles (the Kirundi hazard, trap 55).

**Raw finding.**

```
comma + exactly 3 digits    59   ALL grouping   231,626 · 92,859 · 15,254,700 (ha) · $2,266,160 · 138,000
comma + 1–2 digits           4   ALL decimal    18 443,8 · dimilione di le 3,4 · $124,60 · $1 200,20
comma + 4+ digits            0
period + exactly 3 digits    5   4 grouping (4.389 · 3.132.463 · 1.766 · 1.300m2=14,000sq ft), 1 decimal (0.001)
period + 1–2 digits        123   ALL decimal    41.9 °C · 604.3 km2 · 88.5% · 9.75 · 1.35
space + 3 digits            21   ALL grouping   581 730 · 224 607 · 18 443 · 111 000 000 · 290 000
```

The single period-grouping counter-example (`0.001 mm`) opens with a **leading zero**, and a grouped number
never does — so Chichewa's "head must start 1–9" guard separates the two populations at 4 against 0 here.

**Implication.** All three separators de-group on exactly-3-digit blocks with a 1–9 head; both `.` and `,`
take a 1–2 digit decimal tail. Same shape as nya, re-measured on tn's own corpus rather than inherited.

## Run 3 — 2026-08-14 09:35 — probe the engine on the attested forms (playbook step 2)

**Command.** `phonemize(form, "tn")` over 48 forms read out of the corpus.

**Raw finding** — the defect list is what the engine produces:

```
"77%"              → masʊmɪ a supaŋ lɪ bʊsupa            % DROPPED
"40 °C"            → masʊmɪ a manɪ k                     ° dropped, ⟨C⟩ read as [k]
"−15.0 °C (5.0 °F)"→ … lɪfɪla k … lɪfɪla f               minus dropped, ⟨F⟩ read as [f]
"15 km (9.3 mi)"   → lɪsʊmɪ lɪ bʊtɬʰanʊ km … mi          raw ASCII in the IPA
"604.3 km2"        → … bʊnɪ . bʊrarʊ km bʊbɪdi           the ASCII 2 read as the NUMBER two (trap 53 shape)
"1,500 m"          → bʊŋwɪ , makχʰʊlʊ a matɬʰanʊ m       one, five hundred — a clause pause inside a number
"3.132.463"        → bʊrarʊ . lɪkχʰʊlʊ … . …             one number read as three sentences
"$145 million"     → lɪkχʰʊlʊ lɪ masʊmɪ a manɪ … milliʊn $ DROPPED
"P4.7million"      → p bʊnɪ . bʊsupa milliʊn             ⟨P⟩ read as the letter [p]
"R268.26bn"        → r … bn                              ⟨R⟩ as [r], ⟨bn⟩ raw
"15–49"            → lɪsʊmɪ lɪ bʊtɬʰanʊ masʊmɪ a manɪ …  the dash DROPPED
"13:11"            → lɪsʊmɪ lɪ bʊrarʊ , lɪsʊmɪ lɪ bʊŋwɪ  a comma pause inside a clock
"20th"             → masʊmɪ a mabɪdi tʰ                  the English ordinal suffix reaches the IPA as [tʰ]
"4×100m relay"     → bʊnɪ lɪkχʰʊlʊ m rɪlaj               × DROPPED
"kwena &jones"     → kwɪna dʒʊnɪs                        & DROPPED
```

**Implication.** Everything the playbook names is live. Nothing is in `src/core` (playbook step 3): the
number path, `clausePunctuation` and the grapheme table are all correct — what is missing is the layer.

## Run 4 — 2026-08-14 09:50 — sourcing every word form

`sources.ts --lang tn`: **espeak does not ship Setswana at all**, `scale-names [NONE]`, and every symbol
class is `[chk?]`. `concept.ts --items … --langs tn` returns **nothing for tn** on all ten concepts
(subtraction, minus sign, decimal separator, degree Celsius, hectare, metre, watt, euro, USD) — no Wikidata
label and no article title. So the haystack is: the mined artifact, the referee word list (carries none of
these), and `attest.ts` against tn.wikipedia.

### PERCENT — `mo lekgolong`, postposed

The corpus GLOSSES it against the digit form three separate times, which is the strongest evidence there is:

```
"go feta sephatlo mo lekgolong (50%)"                              half in-the-hundred
"bobedi mo lekgolong (2%)"                                          two   in-the-hundred
"palo ya masome a le mane le bosupa mo lekgolong (47%)"             forty-seven in-the-hundred
"lesome mo lekgolong la batho botlhe ba Botswana"                   ten percent of all Batswana
```

`attest.ts` → **156 tokens / 20 articles**, every readable example the percent reading
(*masome a le mararo mo lekgolong fela la Batswana ba ba dirisang inthanete*).

⚠ THE COMPETITOR IS ALSO REAL AND WAS MEASURED, NOT DISMISSED. `diperesente di le N` is attested
**59 tokens / 20 articles**, every one in the percent slot (*diperesente di le 50.3 tsa baagi ba naga*),
plus `dipesente dile lesome (10%)` and `diperesente dile 1.15` in the mined corpus — i.e. glossed against a
digit too. It is PREPOSED. `mo lekgolong` wins on 156-against-59, on carrying the corpus's three digit
glosses, and on being postposed where the sign is, so the tier needs no reordering.

⚠ AND THE TRAP-37 NEAR MISS: `phesente` ×2 / `Peresente` ×1 in the corpus are the NOUN "a percentage"
(*phesente e nnye thata ya baagi*, *phesente e kgolo ya letseno*) — the wrong slot. Bare `lekgolong` is
polysemous the other way: `mo lekgolong la bo 18 la dingwaga` is the 18th CENTURY. Only the collocation
attests.

### CURRENCY — four signs sourced, one declined

Every one attested with the same `di le` linker, in an unambiguous money context:

| sign | word | evidence |
|---|---|---|
| `$` / `US$` | `didolara di le` | attest 30/19 — *didolara di le dikete di le tlhano* (5000 dollars), *didolara di le dimilione di le 65*; `dolara ya America`, `dolara ya Zimbabwe` |
| `R` | `diranta di le` | attest 34/20 — *diranta di le dimilione di le 112*, *diranta di le dibilione di le 115* |
| `P` | `dipula di le` | corpus: *pampiri e ntšha ya polymer ya dipula di le 10* (a 10-pula note); attest `dipula di le` 2/2, BOTH money (*kotlhao … dipula di le makgolo a matlhano*, *ntlo ya dipula di le dimilione di le 2 (US$312,000)*) |
| `£` | `diponto di le` | corpus: *diponto di le dikete tse tharo*; attest 28/20, all money |

⚠ TRAP 37 LIVE ON THE PULA. Bare `dipula` is **61 tokens / 20 articles** and every single displayed example
is RAIN — *dipula tse di maatla*, *paka ya dipula*. Setswana names its currency after rain. The bare count is
useless; only `dipula di le` in a money frame attests it, and that is what was probed.

⚠ **`€` DECLINED.** `diyuro` is ×0. `yuro` is 6 tokens / 2 articles and **five of the six are the UEFA
football tournament** (*Yuro ya Basadi ya UEFA ya 2017*); the sixth is genuine (*a duela … Yuro e le nngwe ka
kopolo nngwe le nngwe*) — one hit in one article, which the playbook calls a lead, not a finding. The corpus
writes `€10 000`, `€80 million`, `€1.2 million`, `€4.5 million`, so this is a real 4-instance silence, stated
rather than guessed at.

⚠ **`R` IS NOT SAFE AS A BARE TIER KEY, MEASURED.** `R` + digit in the artifact: `R268.26bn` and
`R1&nbsp;billion` are rand — and `jaaka R59, N12, N17 le N3` is a list of **South African road numbers**. 2
true against 1 false in 448 lines, and a road read as an amount of money is confidently wrong. Handled by a
local rule instead (see the layer's step 3).

### UNITS — every noun glossed against its own abbreviation, and the noun comes FIRST

```
dikhilometara di le makgolo a mabedi (200km)      km   → dikilometara
dimilimitara dile 360 (360&nbsp;mm)               mm   → dimilimetara
dimelemetha dile makgolo a mabedi (200 ml)        ml   → (declined, see below)
diheketara di le 15,254,700 (ha)                  ha   → diheketara
sekwere sa dimaele di le 224 607                  mi   → dimaele
dimetara di le 650 kwa godimo ga bogare jwa lewatle   m → dimetara
dikhubikimitara di le 111 000 000 (3.9×10⁹ cu ft) m³  → dikhubikimitara
```

⚠ THE LINKER IS NOT OPTIONAL AND WAS COUNTED. Every measure noun in the artifact is followed by a concord
copula before its numeral — **51 instances**, `di le` / `dile` / `tse di` / `di ka nna`, and **zero**
instances of the bare noun immediately followed by a digit. So the unit forms carry `di le`, which is also
what makes the exponent and rate compositions come out in the attested word order. Class 4 nouns take `e le`
instead (`metsotswana e le 44.55`), which is per-key data anyway.

`attest.ts` counts, all sense-checked in the measurement slot: `dimetara` 115/20, `diheketara` (in the area
slot), `dikilometara` 37/20, `dikilogerama` 30/20 (*bokete jwa dikilogerama di le 350 le 700*),
`dikhubikimitara di le` 19/16, `dilithara` (*dilithara di le lekgolo ka letsatsi*), `disentimetara`,
`dimilimetara`, `dimaele`.

⚠ **`ml` AND `ft` DECLINED.** `mililithara` and `dimililithara` are ×0; the corpus's one `ml` gloss spells
`dimelemetha`, a hapax whose spelling nothing corroborates. `difiti` is ×0 and every `ft` in the corpus sits
inside an English parenthetical glossing a metric figure already given. Both keep leaking VISIBLY, which is
the honest side to fail on.

### SQUARED / CUBED — `sekwere sa` (preposed) and `dikhubikimitara`

`sekwere` is 21 tokens / 20 articles and is polysemous exactly as English "square" is: *Sekwere sa Kereke*
(Church Square, a plaza), *sekwere se se makgwakgwa* (a rough square). The measure sense is attested in BOTH
positions:

```
preposed    sekwere sa dimaele di le 224 607          (mined corpus, glossed against Botswana's sq-mi figure)
            sekwere sa dimaele di le 5 400            attest
            banni ba le 111 mo sekwere sa kilometara  attest ×3
postposed   dikilometara di le 34,635 tsa sekwere     attest ×2
            Dikilometara tse makgolo a matlhano tsa sekwere (190 sq mi)
            dikilometara di le 52,000 tsa sekwere (20,000 sq mi)
`tsa sekwere` 15/14 · `sekwere sa` 8/7
```

⚠ POSTPOSED IS COMMONER AND THE TIER CANNOT SAY IT — it would need noun + number + modifier, and
`exponentWords` only offers before/after/compound/suffix around the noun with the number outside. So the
PREPOSED order is taken (`squared: ["sekwere sa"]`, `position: "before"`, `unitPrefix`), which reproduces the
mined corpus's own sentence byte for byte. Declining outright is not neutral: with `km` declared and no
square word, `604.3 km2` reads *…dikilometara di le TWO* — trap 53 exactly, which is how this was decided.

⚠ CUBED IS A FUSED COMPOUND AND SO IS NOT `exponentWords` EITHER. `dikhubikimitara` is *di-khubiki-mitara*:
the class prefix migrates to the front of the compound, which none of the four positions produces
(`compound` gives *khubikidimetara*). `m³` and `m3` are therefore declared as their own UNIT KEYS, which the
longest-first alternation tries before bare `m`. The analytic variant is attested too — *dimetara tse di
khubiki di le 6,700 (maoto a khubiki a le 240,000)*, `khubiki` 12/2 — and the fused form wins on articles
(19/16 vs 12/2).

### RATE — `ka`, with `ura` and `motsotswana`

```
dikilometara di le 97 ka ura         attest — 97 kilometres per hour, the exact slot
"(10-38) ka ura"                     attest
dikhubikimitara di le makgolo a matlhano ka motsotswana (18,000 cu ft/s)
12-13 m3 ka motsotswana              mined corpus
dilithara di le lekgolo ka letsatsi  attest — per day
```

`unitPer: "ka"`, `rateDenominators: { h: "ura", s: "motsotswana" }` — never standalone keys, per the field's
own warning.

### DEGREES — `dikirii`, and the scale names ARE sourceable

⚠ TRAP 37 AGAIN, AND IT NEARLY WENT THE OTHER WAY. `dikirii` is 50 tokens / 20 articles and every wiki
example is the ACADEMIC degree (*baithuti ba dikirii ya ntlha*). The angular sense is attested three times
and only in collocation: `dikirii di le 23 kwa Borwa jwa ekhweitha` (mined corpus), and
`dikirii tsa masome a mabedi tsa longitute ya botlhaba` / `dikirii tsa masome a mabedi le bobedi ya
latitšhutu ya borwa` (attest, a second article). The connective is `tsa`.

`sources.ts` says `[NONE] scale-names`, and that is **wrong for this language** — the probe run turned up
two independent glossed sentences:

```
"mogote wa Celcius e le nngwe (1 °C)"                                            attest
"selekanyo sa mogote sa Celcius e le boraro (3 °C)"                              attest
"degree Celsius tse di kwa tlase ga lefela di le thataro ntlha botlhano (−6.5 °C)"  attest
"degree Fahrenheit di le lekgolo le borataro ntlha lefela (106.0 °F)"            attest
```

So the tn spelling of the scale is `Celcius` (with ⟨c⟩), `Fahrenheit` is written as-is, and the degree
phrase takes the class-8/10 concords `tsa` / `tse di` / `di le` that `dikirii` already takes in its own
attestations.

### DECIMAL POINT — `ntlha`, and this is the run's best find

The same two sentences settle the decimal separator, which every other tier said was unsourceable:

```
"… di le thataro NTLHA botlhano (−6.5 °C)"                    6.5   = thataro ntlha botlhano
"… di le lekgolo le borataro NTLHA lefela (106.0 °F)"       106.0   = lekgolo le borataro ntlha lefela
```

Two values, two marks, both glossed directly against the digit form — and they also settle that the
FRACTIONAL part is read one digit at a time (`.0` → *lefela*, not "nought"), which is what the spell-out
below does.

⚠ THE WORD IS MASSIVELY POLYSEMOUS AND IT DOES NOT MATTER HERE. Bare `ntlha` is 185 tokens / 19 articles and
`attest --after ntlha` shows the distribution is overwhelmingly the ordinal *wa ntlha* ("first") and the
connective *ka ntlha ya* ("because of"). This layer only ever EMITS `ntlha`; it never matches it, so the
polysemy costs nothing. Probing the tail collocations found `ntlha botlhano` ×1 and `ntlha lefela` ×1 and
`ntlha bobedi/boraro/bone/borataro/bosupa` all ×0 — i.e. the evidence is two sentences in one climate-table
article family. Recorded as the limit; the sense is nonetheless unambiguous, because the word sits between an
integer and a single fractional digit beside the printed decimal.

### MINUS — `kwa tlase ga lefela`, temperature only

From the same sentence: *degree Celsius tse di **kwa tlase ga lefela** di le thataro ntlha botlhano (−6.5 °C)*
— "below zero". `attest.ts` → 2 tokens / 2 articles, the second also a temperature (*ka mariga di wela kwa
tlase ga lefela*). All five negative numbers in the artifact that are genuinely negative are TEMPERATURES
(−15.0 °C, −6.0 °C, −6.1 °C, −8.0 °C, and one −21.95 which is a LATITUDE). So the reading is claimed only in
the degree rule and only for `°C`/`°F`; a bare negative gets nothing, because "below zero" is not what a
negative latitude says. Omitting a minus INVERTS, which is why this was worth the effort at seven instances.

### DECLINED, with the count and the reason

- **`×` / `x` (16 instances).** 6 are relay formats (`4×100m relay`, `4 × 400 m`, `4x400`), 2 scientific
  notation (`3.9×10⁹`, `1×10⁻⁶`), 1 a product (`360×1024`), 1 a dental formula, and the rest were my regex
  matching `&#x20;` entities. The corpus's own gloss of `4×100m relay` is a full PARAPHRASE — *batho ba le
  bane dimmithara dile lekgolo mongwe le mongwe* ("four people, one hundred metres each") — not a word in the
  slot. `makgetlho` ("times/occasions", attested *makgetlho a le lesome le borataro*) is the occurrence word,
  not the multiplier: Fula `hakkunde` again. Left unread.
- **`=` `<` `>` `±` `÷` `+`.** Every `=` in the artifact is an EasyTimeline chart directive
  (`ScaleMajor = unit:year increment:11000`) or an English book title (*Food × Mixing + Heat = Baking*).
  `<` `>` `±` `÷` are ×0. The only `+` is `UTC+02:00`, which the playbook records fleet-wide as the one
  contentful plus that nothing attests.
- **LETTER NAMES / INITIALISMS (11,486 in the corpus).** `core/initialisms.ts` needs a `letterName` table;
  espeak ships no Setswana and no in-repo source carries one. Wiring the pass without it is a no-op — a
  sourcing gap, not a seam gap (trap 16 checked, not assumed).
- **ERA MARKERS, FRACTIONS.** `sources.ts` reports `[NONE] fraction-series`; no denominator series to compose
  from.
- **SPORTS TIMES (20 of the 39 colon shapes).** Deliberately untouched — see the clock step.

## Run 5 — 2026-08-14 10:40 — write the layer, then the gate that earns its keep

**Commands**

```
npx tsc --noEmit
npx tsx tools/normalization/corpus-diff.ts emit --lang tn --corpus mined:tn --out /tmp/tnwork/tn.after
npx tsx tools/normalization/corpus-diff.ts compare --before /tmp/tnwork/tn.before --after /tmp/tnwork/tn.after
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/tn.jsonc --lang tn
```

**Shape.** Two exports and the engine sequences them —
`normalizeSetswanaPost(SYMBOLS(normalizeSetswanaPre(input)))`, the Shona arrangement. Forced from both ends:

- HTML entities, the currency magnitude suffixes and the degree/minus rules must precede the tier.
  ⚠ THE ENTITY FOLD IS NOT COSMETIC: tn.wikipedia writes `1,400&nbsp;km²`, `$52&nbsp;million`,
  `31&nbsp;°C`, `R1&nbsp;billion` — the entity sits between the number and the thing that has to be adjacent
  to it, so un-folded it breaks the tier's match and the abbreviation reaches the phoneme sink raw. 21 of the
  artifact's 32 ampersands are `&nbsp;` and 4 more are `&#x5B;` / `&#x5D;` / `&#x20;`.
- De-grouping and the decimal spell-out must follow it. ⚠ AND THAT ORDER IS WHAT KEEPS `NOT_VERSION` ALIVE —
  this layer declares the one-letter key `m`, the key that turned `802.11m` into "802.11 metres" in af/ca/is/
  sd, and the tier's guard for it works by SEEING THE DOT. Verified through the real phonemizer, not assumed:
  `802.11m` → `…nt͡ɬʰa bʊŋwɪ bʊŋwɪ m`, no metre.

**Raw finding — corpus diff, 447 utterances.**

```
changed 149/447 (33.3%)
before  { DIGIT: 0, SLOT-GAP: 0, RAWMARK: 0, ZERO-WIDTH: 0, RAW-CAPS: 0, DROP: 94, THROW: 0 }
after   { DIGIT: 0, SLOT-GAP: 0, RAWMARK: 0, ZERO-WIDTH: 0, RAW-CAPS: 0, DROP: 19, THROW: 0 }
```

**Raw finding — artifact scan, before → after.**

```
DROP percent    40 → 0     DROP degree     11 → 0     LEAK km   11 → 2
DROP currency   25 → 1     DROP minus       7 → 2     LEAK mm    3 → 0
DROP math-sign  17 → 16    DROP ampersand   6 → 0     LEAK bn    3 → 0
DROP exponent    5 → 0                                LEAK ft    6 → 6 (declined)
                                                      LEAK ml    1 → 1 (declined)
artifact DROP total 111 → 19
```

**All 149 changed lines were read.** What that turned up, in both directions:

- The degree rule is the biggest single win and it was invisible to every leak class: `41.9 °C (107.4 °F)`
  read *…masʊmɪ a manɪ lɪ bʊŋwɪ . bʊfɪra bʊŋwɪ **K** lɪkχʰʊlʊ lɪ bʊsupa . bʊnɪ **F**.* — the ° dropped, the
  decimal point read as a SENTENCE BREAK, and the scale letters reaching the g2p as bare [k] and [f]. It now
  reads *dikirii tsa Celcius di le 41 ntlha 9, dikirii tsa Fahrenheit di le 107 ntlha 4*.
- ⚠ A REAL REGRESSION, MEASURED RATHER THAN GLOSSED OVER: **6 utterances of 447 (1.3%)** now contain a
  de-grouped number ≥ 10⁶, and `setswana/numbers.ts` degrades those to DIGIT-BY-DIGIT by design (its own
  header says "≥10⁶ or unsafe integers degrade to digit-by-digit"). `15,254,700`, `3.132.463`, `$2,266,160`,
  `111 000 000`, `12,000,000`. Before, those read as two or three plausible sub-million chunks separated by
  spurious clause pauses; now they read as eight or nine separate digit words with no pauses. Not fixed here
  — see the backlog note in Run 7 — because extending the number path needs a JOIN convention for which this
  corpus has no source, and the referee is word-only and cannot measure it.
- ⚠ THE GLOSS DOUBLES, and it is what the writer typed. tn.wikipedia's house style spells a figure in words
  and then repeats it in digits: `dikhilometara di le makgolo a mabedi (200km)` now reads
  *dikhilometara di le makgolo a mabedi **dikilometara di le makgolo a mabedi***. The tier has no
  redundancy suppression for units (it has one for currency and percent), and the sign is not redundant here
  — the parenthetical is a second, numeric statement of the same quantity. Left as the text writes it.
- ONE MEASURED LOSS in the range rule: `bokete jwa 4 -5 kg` has its unit after the SECOND operand, so the
  tier has already rewritten `5 kg` into `dikilogerama di le 5` by the time ranges run and the two operands
  are no longer both digits — the dash is dropped. Moving ranges above the tier only moves the damage
  (`4 go ya go dikilogerama di le 5`). One instance; recorded rather than chased.
- `0.001 mm` fell through BOTH decimal arms (3-digit tail) and the period-grouping arm (leading zero) and its
  dot survived as a sentence break. A third arm was added for the leading-zero long tail; a head of exactly
  `0` can never be a grouped thousand, so the 3-digit tail reserved for grouping is safe there.

## Run 6 — 2026-08-14 11:20 — the mechanical review, the tests, and the full suite

```
npx tsx tools/normalization/review.ts --lang tn
npx vitest run   ·   npx tsc --noEmit
```

**First pass: 3 FAILING** — no test file, 8 dropped sign classes, and the artifact scan. Then:

- **Tests.** 12 new cases appended to `test/setswana.test.ts`, written to pin the RULES' BRANCHES rather than
  the corpus's instances (trap 13): the bare-unit citation branch (`km` alone → `dikilometara`, ×0 in the
  corpus), the rand guard's TRUE side (`R268.26` → money) beside its FALSE side (`tsela ya R59` → the road),
  the `NOT_VERSION` shape, the cubed key against the squared exponent, a descending range and a hyphen chain,
  a sports time against a marked clock, and the leading-zero decimal.
  ⚠ TWO OF THOSE ASSERTIONS WERE WRONG WHEN FIRST WRITTEN AND THE TEST CORRECTED ME, not the other way round
  (trap 5): the bare-unit rewrite happens in the TIER, so it is not visible to `normalizeSetswanaPost` alone,
  and `2:54.47` spells its fractional digits individually (`ntlha 4 7`), which is the rule working.
- **Sign classes.** A `tn` block was added to `ACCEPTED_SIGN_SILENCE` in `tools/normalization/defects.ts` for
  the seven classes whose refusal is argued in the layer — `plus`, `plus-minus`, `equals`, `less-than`,
  `greater-than`, `divide`, `times`. ⚠ `minus` IS DELIBERATELY LEFT OUT so `review.ts --lang tn` stays RED on
  it: the layer reads a negative TEMPERATURE but not the corpus's negative LATITUDE (`-21.95`), and "below
  zero" is not what a southern latitude says. Omitting a minus INVERTS; the line goes green the day a
  Setswana negative-number word is attested.
- **`languageCatalogue.test.ts` failed on the derived `normalization` column** — the tn cell moved
  `(none)` → `done`. Regenerated with `derive-normalization.py`, then `build.py` for `languages.db`.

**Final:** `review.ts` → 2 FAILING, both deliberate (the minus refusal, and the artifact scan's argued
declines: `ft` ×6, `ml` ×1, `€` ×1, a bare `km²` ×2 with no adjacent numeral, `www` ×1, minus ×2).
`npx vitest run` → **244 files / 4,163 tests passed**. `npx tsc --noEmit` → clean.

## Run 7 — 2026-08-14 11:35 — referee, and what could not be verified

```
npx tsx tools/referee-eval/eval.ts tn
```

**Before and after are byte-identical:**

```
raw exact:      571/1592 (35.9%)
folded backbone:1592/1592 (100.0%)
symbol accuracy:100.0%
```

**And that is the correct result, not a null one.** `epitran tsn-Latn` is programmatic AND WORD-ONLY — 1,592
isolated words, no symbols, no digits, no punctuation — so it cannot see one line of this layer. It is a
regression tripwire on the g2p, and the g2p was not touched. Trap 57's lesson applies exactly: a green gate
that would print the same thing if the change had never happened is not a gate for this change. The gates
that CAN see it are the corpus diff (DROP 94 → 19, 149 lines read by hand) and the artifact scan
(111 → 19).

### Backlog — defects found that are not this layer's to fix

1. **`src/languages/setswana/numbers.ts` has a 10⁶ ceiling**, and de-grouping makes it audible in 6 of 447
   utterances. Reproducing reading: `phonemize("15254700", "tn")` → *bʊŋwɪ bʊt͡ɬʰanʊ bʊbɪdi bʊt͡ɬʰanʊ bʊnɪ
   bʊsupa lɪfɪla lɪfɪla* — eight digit words, not a number. The magnitude WORDS are attested (`dimilione` in *didolara di le dimilione di le 65*,
   `dibilione` in *diranta di le dibilione di le 115*, `didikadike` in *batho ba le didikadike di le 8.2*);
   what is missing is the JOIN convention for a number this corpus never spells out, and the referee is
   word-only so a change there would be unmeasured. Left alone deliberately.
2. **The shared tier ignores `unitPrefix` on its no-measure-word exponent branch.**
   `normalizeSymbols.ts` returns `` `${q} ${head}${exp}` `` when `exponentWords[power]` is undefined, without
   consulting `d.unitPrefix`. For a `unitPrefix` language that puts the reading on the wrong side of its
   number. tn does not hit it in the corpus (`km³` is ×0) but is exposed: `phonemize("5 km³", "tn")` →
   *bʊt͡ɬʰanʊ dikilʊmɪtara di lɪ³*, with the copula dangling and the superscript raw. `src/core` is the
   reviewer's call, so it is REPORTED rather than edited.
3. **`sources.ts` reports `[NONE] scale-names` for tn and it is wrong.** tn.wikipedia glosses both scales
   against the sign — *"mogote wa Celcius e le nngwe (1 °C)"*, *"selekanyo sa mogote sa Celcius e le boraro
   (3 °C)"*, *"degree Fahrenheit di le lekgolo le borataro ntlha lefela (106.0 °F)"*. The report's haystack
   is the corpus + referee + espeak, and all three are silent here; only the wiki carries it. A false
   negative, i.e. trap 57's expensive direction.

### Could not be verified

- **The decimal word `ntlha` rests on two sentences in one climate-table article family.** The sense is
  unambiguous (it sits between an integer and a single fractional digit, beside the printed mark) and the
  repo's own `test/setswana.test.ts` independently glosses `ntlha` as "point", but `ntlha bobedi`,
  `ntlha boraro`, `ntlha bone`, `ntlha borataro` and `ntlha bosupa` are all ×0, so I cannot say the
  convention is general.
- **`dikirii` is attested for ANGULAR degrees, not thermal ones.** The three collocation hits are a latitude
  and two longitudes; the thermal phrase the corpus writes is `mogote wa Celcius`. The composition
  `dikirii tsa Celcius di le N` uses only attested morphemes and the language's own concords, but the
  head noun in a temperature is an extrapolation.
- **`1 km` reads *dikilometara bongwe*** — the plural noun with a singular count. `1 km` is ×0 in 44,271
  paragraphs and the singular concord is attested only for a different class (`litara e lengwe`), so both
  candidates for index 0 are unmeasured and the bare citation form was preferred.
- **No audio tier.** There is no FLEURS corpus for Setswana, so the playbook's audio arbiter — which is the
  tier that outranks every text tier for a SIGN — was not available for the plus/minus/times questions.
