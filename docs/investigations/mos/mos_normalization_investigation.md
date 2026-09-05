# mos (Mooré / Mossi) — text-normalization investigation

Method: `docs/normalization_playbook.md`. Mooré is Niger-Congo **GUR** (Oti-Volta), Burkina Faso's largest
language (~8M speakers), written in a Latin (Burkinabé) orthography with the dedicated ATR letters ⟨ɛ ɩ ʋ⟩.

## Run 1 — 2026-08-12 18:50 (orientation: what evidence exists at all)

**Question.** Before designing anything: which of this repo's gates are real METERS for `mos` and which are
only tripwires? The brief says no kaikki and no wikipron.

**Commands and raw findings.**

```
ls src/languages/mossi/     → manifest.ts  mossi.jsonc  mossi.ts  numbers.ts     (NO normalize.ts)
test/mossi.test.ts          → EXISTS, 89 lines, named after the LANGUAGE
tools/corpus/mined/mos.jsonc  → EXISTS, 14,908 segments, dump-sourced, TRACKED
tools/corpus/attest/mos.jsonc → does not exist
tools/referee-eval/langs/mos.jsonc + referees/mos.wiktionary-mos.tsv → EXIST (42 lines / 39 words)
```

⚠ The brief said "no referee at all". That is right about kaikki and wikipron and **wrong about the
referee file**: `mos.wiktionary-mos.tsv` exists and `eval.ts mos` runs.

```
npx tsx tools/referee-eval/eval.ts mos
  === mos vs en.wiktionary Moore (Wiktionary, human) [primary] (39 words) ===
  raw exact:      0/39 (0.0%)
  folded backbone:37/39 (94.9%)
  symbol accuracy:98.5%
  residuals: lekole ≠ lekolːe (geminate notation) · jinmasem ≠ yinmaasem (a y/j typo in the referee)
  ⚠ secondary-source gap: no second orthography-matched NUMERIC referee for Mooré
```

**Which gates are meters here, stated plainly.**

| gate | meter or tripwire for THIS layer |
|---|---|
| `referee-eval.ts mos` | **TRIPWIRE ONLY.** 39 ordinary lexical words — no digit, no symbol, no punctuation. It can tell me I broke the word path; it can say nothing whatever about a normalization rule. Expect it byte-identical before and after, and that is the pass condition. |
| `corpus-diff` (`mined:mos`) | **METER.** The only instrument that sees the change at scale. |
| `mine.ts scan` | **METER** for the DROP classes. |
| `review.ts` | **METER** for the mechanical checklist; its `sourcing` line is a PROMPT. |
| `sources.ts` | **TRIPWIRE.** espeak does not ship Mooré at all, so most rows can only ever say NONE. |
| `attest.ts` | **METER, and here the ONLY external one** — mos.wikipedia exists (unlike `hil` and `bal`). |
| `npx vitest run` / `tsc` | **METER** for regressions, not for correctness of a reading. |

```
npx tsx tools/normalization/sources.ts --lang mos
  [NONE] letter-names     espeak does not ship this language at all
  [NONE] decimal-point    no _dpt, no _., no manifest word
  [part] era-phrase       marker occurs; a Christ-stem exists somewhere
  [NONE] scale-names      ° occurs, neither scale name anywhere
  [chk?] percent · currency · minus · equals · times · ampersand · plus · exponent
  espeak: NOT SHIPPED · referee: 43 lines · corpus: 434 lines (incl. mined artifact)
```

```
npx tsx tools/normalization/review.ts --lang mos
  [FAIL] normalizer  src/languages/mossi/normalize.ts missing   (1 FAILING)

npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/mos.jsonc --lang mos
  scanned 434 lines
  DROP percent   ×38 · DROP currency ×16 · DROP ampersand ×12 · DROP math-sign ×12
  DROP degree    ×9  · DROP exponent ×9  · DROP minus     ×3
```

**Implication.** espeak is closed (§5c's phonetic fallback does not exist for Mooré), letter names are
structurally blocked, and the referee cannot arbitrate anything this layer does. Every word this layer emits
has to come from **the corpus itself, the engine's own number data (`numbers.ts`), or `attest.ts`**. The
artifact is already mined and fresh (`cellsTotal` 35 + a `native-terminator` backfill = the current 36), so
step 0b is done — but it was mined **without a language filter**, and that is the next question.

## Run 2 — 2026-08-12 19:05 (does a Mooré Wikipedia exist, and is its text Mooré?)

**Question.** The brief warns that two of the last four languages had no wiki, and that a French word must
not be allowed to stand in for a Mooré one. Both halves need measuring, not assuming.

```
curl -sSI https://dumps.wikimedia.org/moswiki/latest/moswiki-latest-pages-articles.xml.bz2
  → HTTP 200, 2,864,224 bytes
python3 tools/normalization/wikidump-to-text.py moswiki.xml.bz2 mos.txt
  → pages seen 2088, paragraphs written 12650
```

**mos.wikipedia EXISTS and is directly dumpable** — no Incubator route needed, unlike `hil` and `bal`.

Top tokens over 994,385 tokens of that text:

```
a 67576 · sẽn 61919 · n 53685 · b 40445 · yaa 29128 · wã 26218 · la 23594 · tɩ 17930 · ne 14466
…and, in the same list:  of 4460 · the 2658
```

**The contaminant is ENGLISH, not French, and that was worth measuring rather than assuming.** Counting
each French function word only inside paragraphs that are strongly Mooré (≥4 Mooré markers, no `the`/`of`):

```
word     in-strong-mos   whole-corpus
la              19073          23594     ← Mooré "and"
le                652            794
de                399            774
region            142            462
dans               44             56
pour               28             44
```

Read the instances (trap 34):

- **`le` is a Mooré word**, the adverb "again / any more": `a sẽn pa le get radio wã`, `zũngã pa le tõe n
  paam tɩbsg ye`. Not the French article.
- **`de` inside Mooré paragraphs is never French prose** — every instance is inside a francophone PROPER
  NAME the Mooré sentence is naming: `Cascades de Karfiguéla`, `Asociación de Charros Regionales`.
- **`region` ×142 is the ENGLISH loan** inside Mooré sentences about Ghana (`Ghana Ashanti region`), i.e. a
  topic word, not a language marker.

So the francophone-contamination worry the brief raised is real in principle and **small in this corpus**;
what actually floods it is English, from bibliographic citation blocks and from the wiki's large body of
Ghana/Anglophone-topic articles.

**Added a `mos` row to `tools/normalization/filter-by-language.py`** — markers are the highest-frequency
Mooré grammatical words (`sẽn yaa wã tɩ pʋgẽ yʋʋmd boond rasem kiuug …`), contrast is ENGLISH merged with a
French set from which `le`, `de`, `la` and `region` are deliberately **absent** for the four reasons above.
`la`, `n`, `a`, `b` are absent from the MARKERS for the mirror reason: they are the corpus's four commonest
tokens and every one of them collides with French or English.

```
python3 tools/normalization/filter-by-language.py --lang mos --in mos.txt --out mos.mos.txt
  kept                 12733  (59.5%)
  short                 5424  (25.3%)
  dropped: contrast     2486  (11.6%)
  dropped: undecidable   768  (3.6%)
```

**Implication.** 11.6% of this wiki is not Mooré. The su lesson says that does not spread evenly. Measure it
per cell before writing a single rule.

## Run 3 — 2026-08-12 19:20 (WHERE the contamination lands — the su measurement)

**Question.** Which cells' evidence is actually Mooré, and which cells would have had me writing rules about
English text that happens to sit in mos.wikipedia?

Each cell's `re` run over the 12,650 raw paragraphs, then asked how many of the matching paragraphs survive
the language filter:

```
cell                 matching mos-kept  %mos        cell             matching mos-kept  %mos
ordinal-range               1        0   0.0        decimals              960      803  83.6
era-marker                 50       12  24.0        scaled-currency        33       28  84.8
ampersand                 222       98  44.1        degrees                16       14  87.5
ranges                   1140      533  46.8        currency               54       48  88.9
ordinal-latin            1993     1073  53.8        grouped               737      656  89.0
exponent                   35       19  54.3        signs                 696      620  89.1
fractions                  97       54  55.7        letter-name          9838     8927  90.7
latin-in-native         20918    12733  60.9        clock                 315      289  91.7
dotted                    350      225  64.3        abbrev               6337     5945  93.8
units                      52       35  67.3        sports-time            20       20 100.0
roman                     183      134  73.2        percent               523      522  99.8
digit-run                9107     6774  74.4        zero-width              2        2 100.0
```

**Raw finding.** The spread is 24% to 100%, and it is exactly the su shape — most cells are fine, which is
what makes the bad ones easy to miss.

- **`era-marker` 24% Mooré.** 50 matches, 12 of them Mooré. Whatever an era rule would have been written
  from here is three-quarters English.
- **`ampersand` 44%, `ranges` 47%, `ordinal-latin` 54%, `fractions` 56%.** `fractions` reproduces the su
  finding almost verbatim: its artifact hard-set is JSTOR/DOI bibliography lines (`56: 153–173.
  doi:10.2307/1291860`), which are English-language citation furniture, not Mooré fractions.
- **`percent` 99.8% (522/523), `clock` 92%, `abbrev` 94%, `currency` 89%, `decimals` 84%.** These are the
  cells whose evidence I can actually trust, and — usefully — they are also the highest-traffic ones.

**Implication for the design.** The rules worth writing are the ones standing on the trusted cells; anything
resting on `era-marker`, `ampersand`, `ranges`, `ordinal-latin` or `fractions` must be re-counted in the
FILTERED text before it earns a rule, because the unfiltered count is about English. Next: read the
instances in `mos.mos.txt`, cell by cell.

## Run 4 — 2026-08-12 19:35 (probing the engine on attested surface forms)

**Question.** Playbook step 2: what does the engine actually produce for the shapes this corpus writes?
Not what I assume it produces.

```
"53%"        → pis nu la a tã              the sign SILENT
"21,552"     → pisi la a je , kobs a nu …  grouping comma → a CLAUSE PAUSE, mid-figure
"16 037"     → piːɡ la a joːbe pis tã …    space grouping → two numbers
"1.384"      → jembɾe . kobs a tã …        grouping dot → a SENTENCE BREAK
"10:00"      → piːɡa , zaːlem              the colon → a pause, and "00" → "zero"
"doolaar 100 000" → doːlaːɾ koabɡa zaːlem  "dollar hundred zero"
"$5" / "£20" → nu / pisi                   signs silent
"25 °C"      → pisi la a nu k              degree gone, the C read as a raw letter
"km²"        → km                          exponent gone
"12 soabã"   → piːɡ la a ji soabã          ✓ ALREADY CORRECT — the native ordinal needs no rule
"Yʋʋm 2006 wã. Yaa sõma ye." → … wã . jaː sõma je .   ✓ sentence periods already correct
```

**Two findings that removed work rather than adding it.**

1. **The `abbrev` cell (×6,148, the artifact's second largest, 94% Mooré) is a FALSE POSITIVE.** Its
   selector is a short word plus a period. Tabulating what precedes those dots:

   ```
   wã. ×4316 · ye. ×2660 · pʋgẽ. ×1962 · soaba. ×1165 · yelle. ×598 · pʋga. ×563
   ```

   The definite article, the negation particle, the locative, the ordinal noun. **They are sentence-final
   periods, every one.** An `N.` abbreviation rule would have deleted ~6,000 real pauses — trap 4 from the
   other direction. The Bambara layer reached the identical conclusion independently, which is worth
   knowing: two Niger-Congo wikis, same cell, same artefact of the selector.
2. **The native ordinal already reads correctly.** Mooré's ordinal is the postposed noun `soaba` and the
   corpus writes it after DIGITS — `\d+ ?-?soab` ×1,958. The tokenizer splits the digit run from the word
   already, so `12 soabã` → *piːɡ la a ji soabã*. No rule needed; `pipi` "first" ×1,388 is likewise already
   a word.

**Implication.** The largest cells are not the largest opportunities. What is left that is both real and
sourceable: de-grouping (no vocabulary at all) and the currency signs.

## Run 5 — 2026-08-12 19:45 (the grouping/decimal ambiguity, settled by digit count)

**Question.** The corpus uses `.` and `,` for BOTH the thousands separator and the decimal point. Can they
be told apart mechanically, or does this class have to be declined?

```
                separator + exactly 3 digits          separator + 1–2 digits
comma           ×698  (678 one group, 20 more)        ×365    1,5 · 0,5 · 3,5 · 50,28
period          ×61   (61 one group, 0 more)          ×1,050  0.2 · 0.4 · 3.5 · 58.4
space           ×224                                  —
```

**Read back to the instances, the split is clean.** The 3-digit column is thousands:

- `A paama vote 21,552 tɩ Mohammed Abdul Aziz … paam vote 14,158`
- `a paama Hemang Lower Denkyira sullã vot ne koees 15.043, sẽn yaa koeesã fãa 58.4%` — **one sentence
  carrying both roles**: 15,043 votes, which is 58.4%. That single line settles the rule in both directions.
- `yɩɩl-gʋlsdb sẽn ta 30.000`, `ligd sẽn ta doolaar 100 000`, `koees 19,800`, `4,200km`, `18,476km`

**The one false positive, stated rather than hidden (trap 28).** Of the 61 period+3-digit instances, 60 are
thousands and one is a genuine three-place decimal: `zĩigã … sẽn yaa ha 358.5 (1.384 km2)` — 358.5 hectares
given as 1.384 km². It will read as 1,384. No lookahead separates them: its neighbour `225.000 km2 (87.000
sq mi)` is thousands before the SAME unit. **60:1 is the cost and it is stated in the rule's comment.**

**Implication.** The rule is `separator + groups of exactly 3, anchored on both sides`. Anchored both ways
because a lookahead alone is not enough (trap 28) — and the anchors are what keep it off the corpus's comma
LIST of small numbers (`nu ni piig la a tãambo (1,5,13)`), off DOI strings (`doi:10.2307/1291860`, four
digits) and off version dots (`802.11n`, two).

## Run 6 — 2026-08-12 19:55 (sourcing the symbols — what could be found, and what could not)

**Question.** For every symbol class, is there a Mooré word, and does it fit the slot?

### The percent sign — declined, and it is the largest declined class here (×1,328)

`%` is in the one cell whose evidence is 99.8% Mooré, so this is not a contamination question. The corpus
writes the glyph every time and never spells the reading — which the playbook says is the weakest evidence
there is about how a symbol is spoken, so silence alone would not settle it and a dictionary check was owed
(the Igbo lesson). Every route:

```
sources.ts                      → [chk?] percent-word; espeak ships no Mooré at all
concept.ts --items Q11229,Q137985650 --langs mos  → NO Wikidata label, NO article, for either item
attest.ts  pourcent 0 · pursã 0 · poursã 0 · pursaã 0        the French loan is absent
Glosbe fr→mos "pour cent"       → "nous n'avons pas de traductions pour pour cent"
webonary.org/moore              → HTTP 403
```

**The composed native form is the one that nearly shipped, and reading its instances is what stopped it.**
`koabg pʋgẽ` — "in a hundred", from `pʋgẽ` ×6,707 and the 100-stem the corpus glosses against itself
(`kilometr ramba koabga (62 mi)(Ãnglindi: 100 kilometres)`) — comes back:

```
word             token  arts  substr-only  verdict
koabg pʋgẽ       4      3     0            attested
koabg pʋgẽ gɛɛlga 2     1     0            attested
```

Read the four. **TWO are the CENTURY sense**: `Yaa a sẽn da zãad a meng to-to yʋʋm koabg pʋgẽ`, `Sẽn na maan
yʋʋm koabg pʋgẽ, ra pa maand Ommegang ye` — "within a hundred years". The other two are the percent sense
and **they are the same sentence of ONE article**, the Ouahigouya demographics paragraph, in a visibly
non-standard register (`ya` for `yaa`, `ni` for `ne`, `tib`):

> Yʋʋm 2006, **koabg pʋgẽ gɛɛlga** 50,28 da ya pagba, 37,4 ya neb sẽn ya yʋʋm 14 talle … 3,7 **koabg pʋgẽ
> gɛɛlga**.

Two hits in one article is a lead, not a finding. **And the position is wrong even in the lead**, which is
what finally settles it: the phrase PRECEDES its figure, where a normalizer would postpose it. Nothing
attests the postposed order. That is the Fula `hakkunde` failure exactly — a word being real is not the same
as a word fitting the slot — and it is why this composition is refused where Fula's `e teemedere` was
accepted. **DECLINED.**

### The currency signs — two sourced, three not

```
$  ×2   NEITHER is currency — both are markup residue in one sentence about a chieftaincy title
£  ×18  genuine, unglossed:  £1,500 · £50,000 · £ 4,200 · £88 milyõ
€  ×3   genuine, and ONE OF THEM GLOSSES ITSELF: `b da yaooda Ero wã milyo a naase(€4 million)`
¢  ×5   the Ghanaian cedi (`GH¢250,000`, `¢820,000`) — no Mooré word anywhere
₹  ×1
```

The word side is the reverse of the usual case: **Mooré spells the currency out and omits the sign.**
`doolaar` ×8 across 7 independent articles, every one a monetary amount — `a yõod yaa doolaar 100 000`,
`ligd sẽn ta doolaar 4000`, `ligd sẽn yaa doolaar 217,464.00`, `paam ligd sẽn ta doolaar 300` — plus
`dolaar` ×2. And every attestation puts the noun **BEFORE the figure**, which fixes the position at the
same time as the word.

- `€` → **`Ero`**: attested, and glossed against its own sign in one sentence. A measured-defect repair.
- `$` → **`doolaar`**: the best-attested word in the file, but its SIGN is ×0 as currency here — so this arm
  is **robustness for plausible input, not a defect repair**, and the comment says which it is (trap 22).
- `£`, `¢`, `₹` → **DECLINED.** No Mooré word attested. The most frequent sign in the corpus stays unread,
  which is what this tree ranks above a confidently wrong word.

### The rest — every one measured, none shippable

```
+  ×26   one arithmetic gloss (3 + 2 = 5), a Tamil ETYMOLOGY gloss, a biology label (LFS- ne LFS+),
         and a PHONE CODE (+233). Not one signed number.
±  ×2    tolerances: `andante ± 96 bpm`, `19 600 ± 400 BC`
=  ×25   ONE arithmetic; the other 24 are `==Heading==` MediaWiki residue
<  ×1    a DERIVATION ARROW in an etymology (`< du do "kẽmba"`)
>  ×6    derivation/translation arrows (`pitta > pizza`, `-> "Chiro zĩi…"`), a blockquote marker
×  ×15   ALL "by", never "times": the BOTANICAL HYBRID sign (Musa × paradisiaca) and a DIMENSION
         CROSS (30 cm × 14 cm × 9 cm). The th and bm finding reproduced.
÷  ×0
&  ×111  cell only 44% Mooré; the instances are ENGLISH company/publisher names (Mim Cashew & Agric
         Products LTD, Camargo & L.B.Sm.). Mooré's "and" is `la` ×23,594 and is never written `&`.
²³ ×24   TWO DIFFERENT THINGS: one genuine `km²`, and Jyutping/Pinyin TONE NUMBERS in the
         Cantonese-opera article (`cing⁴ sik¹ sing³`, `Siu² Mou⁵ Sang¹`)
°  ×41   all genuine temperature, all in the same translated agronomy articles. sources.ts:
         `[NONE] scale-names`. No scale word, no espeak fallback.
minus    the DROPPABLE shape ×5: FOUR are year/measure ranges with a stray or doubled hyphen
         (`2007 -2009`, `800--1532`, `20--40 km`) — designations. ⚠ ONE IS A REAL NEGATIVE:
         `n yɩɩg n yɩɩg −1 °C la 2 °C` (U+2212).
```

**The clock is refused on SENSE, not on silence, which makes it the stronger refusal.**
`\d{1,2}:\d{2}` ×68, and most of it is not a clock: BIBLE VERSE references (`a Luke 2:22-40 pʋgẽ`), a vote
ratio (`vot wʋsg sẽn yɩɩd a 80:35`), a chat timestamp pasted into an article (`[2:54 PM, 10/14/2023]
Hassan:`), a page-footer UTC stamp (`rasem 2 daar n tãag 13:13 (UTC)`), beside one genuine opening-hours run
(`08:30 n tɩ tãag 17:00`). A rule keyed on the shape would claim scripture citations. `wakato` is glossed
"heure" in the Lexique français-mooré but that is the bare noun and nothing attests it in a spoken clock —
trap 37. **DECLINED.**

**Implication.** The layer is small and that is the correct outcome: de-grouping plus two currency signs.
Everything else is recorded as a re-runnable measurement in `defects.ts` and in `normalize.ts`'s header.

## Run 7 — 2026-08-12 20:10 (a finding this layer raised and `numbers.ts` settled)

**Question.** De-grouping joins figures that were never one integer before. What happens at 10⁶?

```
"1,234,567" → jembɾe jiːbu tãːbo naːse nu joːbe jopoe        digit-by-digit
```

`numbers.ts` said: *"NO million: no attested Mooré numeral above tusri (the French loan is not documented in
any source consulted), so ≥ 10⁶ falls back to digit-by-digit rather than inventing one."* **That is a
statement about the sources consulted, and the corpus refutes it.**

```
milyõ   ×219      milyaar  ×51      (filtered Mooré text)
```

And the corpus supplies the **syntax** as well as the word — what follows each one:

```
milyõ a yembr ×5 · milyõ a yiib ×4 · milyõ a ye ×7 · milyõ a yopoe ×5 · milyõ 37 ×6 · milyõ 20 ×3
milyaar a ye ×4 · milyaar a yoob · milyaar 128 · milyaar 44
in slot: `ligd milyõ a yopoe` · `ton milyõ 29` · `dolaar milyaar a 9` · `bao ligidi … bɩ milyõ 2.26`
```

That is exactly the particle-plus-SHORT-stem compound this file already uses for `tus a yi` (2000) and
`kobs a nu` (500), so the fix is the existing composition with two more scale words, not a new mechanism.
⚠ **Neither alternates for number** — 1 million is `milyõ a ye`, not a bare singular — unlike
piiga→pisi, koabga→kobs and tusri→tus. That is the evidence, not a simplification.

**Why it landed with the normalization work rather than separately: the two changes are coupled.** 25 figures
in the corpus cross 10⁶ once their separators are removed (`19,811,000`, `13 025 000`, `1,286,728`). Before
the de-grouping those never reached the number path as one integer, so the fallback was unreachable for
them; after it, all 25 would have read as a string of loose digits.

Branches enumerated rather than spot-checked (trap 13 — the table, the composition, and the boundary):

```
1000000 milyõ a ye        7000000 milyõ a yopoe      37000000 milyõ pis tã la a yopoe
1000000000 milyaar a ye   1001000000 milyaar a ye la milyõ a ye
19811000 milyõ piig la a wɛ la tus kobs a nii la piig la a ye
1e12 → yembre zaalem ×12  (nothing above milyaar is attested, so the fallback stays)
```

**A golden changed.** `test/mossi.test.ts` asserted the digit-by-digit reading of 10⁶; it now asserts
`milyõ a ye`, with the reason recorded beside it.

## Run 8 — 2026-08-12 20:25 (the gates, before and after)

| gate | before | after | note |
|---|---|---|---|
| `npx vitest run` | 3802 pass | 3802 pass + 15 mos | one catalogue failure in between, closed by regenerating |
| `npx tsc --noEmit` | clean | clean | |
| `referee-eval.ts mos` | 37/39 folded, 98.5% symbol | **byte-identical** | ⚠ TRIPWIRE, NOT A METER — 39 lexical words, no digit or symbol in them. Identical is the pass condition. |
| `corpus-diff` DROP | 95 | **88** | **63/431 utterances changed (14.6%)**, DIGIT/SLOT-GAP/RAWMARK/THROW all 0→0 |
| `mine.ts scan` | percent 38 · currency 16 · ampersand 12 · math-sign 12 · degree 9 · exponent 9 · minus 3 | **currency 9 · exponent 2 · minus 1**, rest ACCEPTED-CLASS | currency 16→9 is the `€`/`$` arms closing |
| `review.ts --lang mos` | 1 FAIL (no normalizer) | **2 FAIL, both correct** | see below |
| `sources.ts` | unchanged | unchanged | ⚠ TRIPWIRE — espeak ships no Mooré, so most rows can only ever say NONE |
| `attest.ts` | no cache | `tools/corpus/attest/mos.jsonc` written | the only external evidence tier this language has |
| `languageCatalogue.test.ts` | pass | pass | after `derive-normalization.py` + `build.py` |

**Every one of the 63 changed utterances was read.** All are the same class: a spurious `,` or `.` clause
pause inside a figure replaced by the `la` that joins thousands to remainder, plus the six million-scale
figures that were reading digit-by-digit. Examples:

```
- paːma vote jãkɾe piːɡ la a jopoe , kobs a tã la pis wɛ la a wɛ
+ paːma vote jãkɾe tus piːɡ la a jopoe la kobs a tã la pis wɛ la a wɛ
- wã sõoɾ jaː jembɾe , kobs a jopoe la a ji , koabɡa la pis …
+ wã sõoɾ jaː miljõ a je la tus kobs a jopoe la a ji la koabɡa la pis …
- ɾamba nademɾ jita piːɡ la a ji , zaːlem bke hal nɪ            (12 000 → "twelve, zero")
+ ɾamba nademɾ jita tus piːɡ la a ji bke hal nɪ                 (→ "twelve thousand")
```

**The two remaining `review.ts` FAILs are genuine sourced refusals and stay RED (trap 24).**

- `sign classes — DROPPED: minus`. The corpus has ONE true negative (`n yɩɩg −1 °C la 2 °C`, U+2212).
  Omitting a plus is lossless; omitting a minus INVERTS. So `minus` is deliberately **absent** from
  `ACCEPTED_SIGN_SILENCE`, and only the two double-hyphen RANGE instances are listed per-instance in
  `ACCEPTED_SILENT` — which keeps the class red on the real negative, exactly as that table intends.
- `artifact scan — DROP currency ×9 · exponent ×2 · minus ×1`. The nine currency lines are the `¢` (cedi),
  `£` and `₹` this layer cannot source; the two exponent lines are the one genuine `km²`; the minus line is
  the negative temperature. All real gaps, none of them closable with the evidence Mooré has.

`ACCEPTED_SILENT` for mos lists the seven Jyutping/Pinyin tone-number spans under `exponent` — a raised tone
digit is correctly silent as a power — which is what pulled that class from ×9 down to the ×2 that are
actually about area. Listing them is what makes the real gap visible instead of buried.

**Closing note on what was NOT possible here.** Two of the five gates are tripwires for this language rather
than meters, and it is worth saying which: `referee-eval` (39 lexical words) and `sources.ts` (espeak ships
no Mooré). The meters were `corpus-diff`, `mine.ts scan` and `review.ts`, plus `attest.ts` as the only
evidence tier outside the corpus itself. Unlike `hil` and `bal`, mos does have a directly dumpable
Wikipedia, so the Incubator route was not needed — but 11.6% of it is English, and every count in this
layer is over the filtered text for that reason.

---

## Run 9 — 2026-08-12 20:50 (the kilometre word: sourcing it, and settling a word order the corpus writes both ways)

**Question.** The layer landed without a unit noun, so `km` survived normalization and reached the IPA as
two raw ASCII letters — measured exposure `km` ×6 after a digit / ×10 as a token. Is there a Mooré
kilometre word, and if so which side of the figure does it go?

### The word

```
npx tsx tools/normalization/attest.ts --lang mos --words kilometr,kilomɛtre,kilometre,kilomeetre

  word        token  arts  verdict
  kilometr    31     20    attested
  kilomɛtre   2      1     attested
  kilometre   0      0     absent
  kilomeetre  0      0     absent
```

**And the sense did not have to be inferred from the count — the corpus GLOSSES THE WORD AGAINST THE
SYMBOL, in two unrelated articles.** This is the same evidence that settled `Ero` for the euro in Run 4,
and here it is available twice:

```
Lake Tengrela      Kulgà ya kilometr a yiibu woglem ni yaadem a yéndé la pusuka.
                   Woglem: kilometr a yiibu (2 km)   Yaadem: kilometr yéndé la pʋsʋka (1.5 km)
Acacus Mountains   … kilometr ramba koabga (62 mi)(Ãnglindi: 100 kilometres)
                   … n na ta kilometr kobga 100km (62mi)                        (same article, body text)
```

`kilomɛtre` ×2 is one article, a table of protected-area sizes. Spelling settled: **`kilometr`**.

### The word order — the part that nearly went wrong

⚠ **A raw count would have settled nothing, because this corpus writes BOTH orders.**
`insource:/kilometr/` over mos.wikipedia (50 articles) splits roughly **17 preposed to 11 postposed**.
On that alone the answer is "unclear", which is the state the Haitian `pwen` failure started from.

What settles it is restricting to instances where **the numeral is SPELLED OUT IN MOORÉ** — i.e. the
SPOKEN form, which is the only form this layer's output has to match, since the digits it re-emits become
Mooré numerals downstream:

| | count | instances |
|---|---|---|
| **PREPOSED**, numeral spelled out | **×11** | `kilometr a yiibu` · `kilometr yéndé la pʋsʋka` · `kilometr kobga` · `kilometr pis-naase (40)` · `kilometr tus-pis-nii(8000km)` · `kilometr piso-poe la a nu(75km)` · `kilometr a nii 8km` · `kilometr a tãab 3km` · `kilometr a yi` · `kilometr ramba koabga` · `kilometres koabg la pis-naas la a yopoe` |
| **POSTPOSED**, numeral spelled out | **×1** | `… pis-yoopoe la yoobe kilometr (18,476km)` (Upper West Region) |

**11:1 on the form that matters, against a near-even split on the raw shapes.** And the postposed hits are
precisely the DIGIT ones — `85 kilometr (53 ml)`, `4,596 kilometr`, `219 kilometr`, `182 kilometr (113 ml)`
— i.e. figures copied across from a source wiki with their Anglo-French order intact, which is exactly the
11.6% contamination this language's Run 1 had to filter for.

⚠ **Independent corroboration from the SYMBOL.** The corpus writes `km` itself in front of its own figure:
`km 2,04`, `km 3,245`, `km 179.0`, `km2 77.0`, `km2 199.4`, and the marathon splits `zoe km 10 … km 15 …
km 30`. Writers reaching for the symbol still put the unit where Mooré puts the noun. This also matches the
currency rule Run 4 already landed (`doolaar 100 000`, `Ero wã milyo a naase`) — two rules, two routes, one
head-initial answer.

**Implication.** Declare `kilometr`, PREPOSED, with two arms: one for the already-native `km 2,04` shape
(swap the symbol, the figure never moves) and one for `140 km` / `100km` / `18,476km` (reorder).

### The particle `a` is NOT emitted

The corpus writes `kilometr a yiibu`, `kilometr a 5`, `kilometr a nii`, `kilometr a tãab`, `kilometr a yi`
— the enumerative particle before a small numeral — but also `kilometr kobga` and `kilometr pis-naase`
without it. Whether `a` appears is a fact about `numbers.ts`, not about this noun, and the currency rule
already emits `doolaar 300` bare on the same reasoning. Left alone.

### The squared reading is REFUSED — three rivals that agree on nothing

```
npx tsx tools/normalization/attest.ts --lang mos --words kars,zem-taas,zemtaas
  kars      1  1  attested
  zem-taas  3  3  attested
  zemtaas   0  0  absent
```

Reading them is what refuses them:

- `kars` ×1 — `A ziiga yalem taa kilometr kars 923.769` (Nigeria's area). One hit, one article.
- `zem-taas` ×3 — and one is a **square MILE** (`2,000 zem-taas yaremde mile (5,200 km²)`), while the other
  two sit on **opposite sides of the unit noun**: `24,389 kilometrẽ zem-taas yalem` against `(8,842)
  zem-taas ya remde kilometrē (square kilometer)`. A word whose slot flips between its own two
  attestations cannot be emitted into a slot.
- `men-yɩlende` ×2 — `9826 kilometr men-yɩlende`, `6,000 mètr men-yɩlende`. The most consistent of the
  three and still two hits.

Three candidates at ×1–3 with no agreement is a LEAD, not a finding — the `koabg pʋgẽ` shape from Run 6
again. **So `km²`/`km2`/`km^2` emit the BARE unit and the squared-ness is dropped.** That is a real loss of
meaning, and it ships only because what it replaces is worse than a silence: `km2 77.0` read as *km* RAW
plus the `2` claimed by the number path as the CARDINAL TWO — the `za` `810km2` bug, reproduced here.
⚠ mos is deliberately **NOT** added to `ACCEPTED_SIGN_SILENCE` for `exponent`; `review.ts` stays RED on it
(trap 24). An accepted silence claims the drop is correct, and this one is not.

### A shape only a head-initial language gets for free

`20--40 km (12-25 mi)` is in the corpus and mos has **no range joiner** (Run 6: that cell is 47% Mooré and
dominated by football scores). Matching only the right endpoint would emit `20--kilometr 40` — the unit
noun dropped into the middle of the span. Because Mooré is head-initial the whole span can keep its shape
behind one noun instead: `kilometr 20--40`, which reads as the two bare cardinals it already read as, now
with the unit attached. The postposing languages in this tree cannot have this.

### Verified through the engine

```
phonemize("kilometr", "mos")   → kilometɾ          pronounceable, nothing raw
"10 km"          → kilometr 10             → kilometɾ piːɡa
"140 km (87 mi)" → kilometr 140 (87 mi)    → kilometɾ koabɡa la pis naːse …
"km2 77.0"       → kilometr 77.0           → kilometɾ pis jopoe la a jopoe . zaːlem   (no stray *jiːbu*)
"18,476km"       → kilometr 18476          (de-grouping coupling holds)
"kmall" / "akm 5" → unchanged              (both lookarounds hold)
```

## Run 10 — 2026-08-12 21:05 (the gates — and the finding that MOST OF THEM CANNOT SEE THIS AT ALL)

| gate | before | after |
|---|---|---|
| `npx tsc --noEmit` | clean | clean |
| `npx vitest run` | 242 files / 3,851 passing | **242 files / 3,851 passing + 4 new mos tests**; `onnx-optional` passed in-suite this run |
| `referee-eval.ts mos` | raw exact 0/39, folded backbone **37/39 (94.9%)**, symbol accuracy 98.5% | **byte-identical** |
| `corpus-diff` utterances changed | — | **9 / 431 (2.1%)** |
| `corpus-diff` DROP | 88 | **88 — UNCHANGED** |
| `mine.ts scan` | DROP currency ×9 · exponent ×2 · minus ×1 | **identical, class for class** |
| `review.ts --lang mos` | 2 FAILING (`sign classes: DROPPED minus`, artifact scan) | **identical, 2 FAILING** |
| `sources.ts --lang mos` | 4 NONE / 1 part / 7 chk? | **identical** |

⚠⚠ **THE HEADLINE IS THE COLUMN THAT DID NOT MOVE.** `referee-eval`, `mine.ts scan`, `review.ts`,
`sources.ts` and even corpus-diff's own DROP counter are **byte-identical before and after a change that
repairs the reading of 9 utterances**. This is not a bug in the tooling; it is the shape of the defect:

- **There is no `unit` sign class.** Every leak counter in this repo is keyed on a SIGN — `%`, `$`, `°`,
  `−`, `²`, `&`. `km` is not a sign; it is two ASCII letters, and the DROP counters have nothing to count.
- **And no leak class could be added cheaply,** because in a LATIN-SCRIPT language a Latin-letter residue
  is indistinguishable from a word (trap 6). `km` reaching the IPA looks exactly like an ordinary token.
- `referee-eval.ts mos` is a **tripwire only** and Run 1 said so: 39 ordinary lexical words, no digit, no
  symbol, no punctuation. It cannot arbitrate one line of this layer. Byte-identical IS its pass condition,
  and it is worth running precisely because a rule that bit into a Mooré word WOULD show up here.
- `sources.ts` has **no row for a unit noun at all**, so it cannot even prompt for one.

**The only instrument that sees this defect is `corpus-diff`'s utterance-change count, plus reading the
changes.** Recorded because it generalises: the fleet's unit words are invisible to the sourcing gate, and
the only reason this one was found is that it was named in the brief. `km` ×6 digit-adjacent / ×10 as a
token sat in a layer whose own gates all reported green.

### All 9 changed utterances were read. Every one is the intended repair.

```
760km (290sqm)     -  … ja kobs a jopoe la pis joːbe km kobs a ji …
                   +  … ja kilometɾ kobs a jopoe la pis joːbe kobs a ji …

km2 77.0           -  … taɾ zĩiɡa jaː km JIːBU pis jopoe la a jopoe …     ← the `2` read as the CARDINAL TWO
                   +  … taɾ zĩiɡa jaː kilometɾ pis jopoe la a jopoe …     ← the za `810km2` bug, gone

(20.4 km2)         -  … tiɡisɡã pʊɡa pisi . naːse km JIːBU sẽn jaː …
                   +  … tiɡisɡã pʊɡa kilometɾ pisi . naːse sẽn jaː …      ← reordered AND the cardinal gone

zoe km 10 … km 30  -  … n wa zoe km piːɡa n pa …                          ← the native-order arm
                   +  … n wa zoe kilometɾ piːɡa n pa …                       (figure never moved)
```

⚠ **ONE HONEST COST, in 2 of the 9: the unit is now read TWICE where the SOURCE glosses itself.**
`kilometr kobga 100km (62mi)` and `nao kilometr piso-poe la a nu(75km)` write the Mooré word and then
repeat the figure with the symbol, so the output is `kilometɾ kobɡa kilometɾ koabɡa …`. This is the
REDUNDANT class (playbook trap 12) rather than a wrong reading — the source text really does say it twice —
and it is the same trade `hmn`'s `duas` made in its Run 7. Reading the unit twice beats leaving `km` raw;
recorded rather than hidden.

**What is still RED, deliberately:** `sign classes: DROPPED minus` (Run 6 — omitting a minus INVERTS and no
Mooré word is attested) and `artifact scan DROP exponent ×2` (this run — the squared-ness is dropped and
mos is deliberately not an accepted silence for it). Both are sourced refusals, not oversights.
