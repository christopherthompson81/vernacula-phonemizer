# Ilocano / Iloko (ilo) text-normalization investigation

## Run 1 — 2026-08-13 18:20 — baseline, and establishing whether the referee is a meter

**Commands**

```
npx tsx tools/referee-eval/eval.ts ilo
grep -n "ilocano" tools/referee-eval/eval.ts
```

**Question.** What state is the language in before anything is written, and — the question the brief
asked to settle first — is `referee-eval` a METER for a normalization layer here, or only a tripwire?

**Raw finding.**

```
=== ilo vs wikipron ilo_latn broad (human) [primary] (926 words) ===
raw exact:      0/926 (0.0%)
folded backbone:766/926 (82.7%)
symbol accuracy:95.9%
=== ilo vs kaikki ilo (Wiktionary, human) [secondary] (973 words) ===
folded backbone:822/973 (84.5%)   symbol accuracy 96.0%
=== ilo vs epitran ilo-Latn (programmatic) [secondary] (887 words) ===
folded backbone:673/887 (75.9%)   symbol accuracy 94.9%

eval.ts:88: import { phonemizeWordRules as ilo } from ".../ilocano.ts";
            // RULE-ONLY: the shipped phonemizeWord consults a referee-derived lexicon
```

**Implication.** ⚠ **The referee is a TRIPWIRE for this work, not a meter, and the binding proves it.**
`eval.ts` binds ilo to `phonemizeWordRules` — a WORD-level function. A normalization layer runs inside the
engine's `text()`, which the eval never calls, so no rule in `normalize.ts` can move any of those three
numbers. The correct expectation is **byte-identical before/after**, and a change would mean I had touched
the word path by accident. This is the fleet pattern the brief described; ilo is on that side of it.
The meters for this run are therefore `corpus-diff` and `mine.ts scan`.

Note also what the eval's residual classes show about the g2p (not this layer's business, but useful
context for reading any output): the divergences are hiatus (`bauang` → `baʔˈuʔaŋ` vs referee `bawaŋ`),
⟨rr⟩ gemination, and Spanish-era ⟨z⟩. All lexical, none normalization.

## Run 2 — 2026-08-13 18:25 — sourcing the corpus: ilo HAS a Wikipedia, and it is not Lsjbot

**Commands**

```
curl "https://ilo.wikipedia.org/w/api.php?action=query&meta=siteinfo&siprop=statistics"
curl -O https://dumps.wikimedia.org/ilowiki/latest/ilowiki-latest-pages-articles.xml.bz2
python3 tools/normalization/wikidump-to-text.py ilowiki.xml.bz2 ilo_paras.txt
```

**Question.** Where does the corpus come from? There is no FLEURS ilo (FLEURS ships `ceb_ph` and
`fil_ph` for this family and nothing else), so it is the wiki or nothing.

**Raw finding.** `ilo.wikipedia` is live: **15,526 articles, 3,569,803 article-words**. The dump is 19 MB
and extracts to **38,655 paragraphs / 95,056 lines / 2,025,082 tokens**. Unlike `ceb.wikipedia` this is
*not* a Lsjbot farm — it is human-written prose with a large tail of geography/species stubs. Top tokens
are the language's own grammar: `ti` ×210,865 · `a` ×205,218 · `iti` ×98,097 · `ket` ×68,682 ·
`nga` ×49,773 · `ken` ×46,863 · `dagiti` ×42,254.

**Implication.** A DUMP-sourced artifact, which is the better tier: `sample` is then a real frequency
distribution rather than a fact about a search ranking. Contrast hil, which had to use the Incubator.

## Run 3 — 2026-08-13 18:35 — contamination, and the four Tagalog/Cebuano words that are ordinary Ilocano

**Command**

```
python3 - <<  (count candidate contrast words inside paragraphs with >=4 Ilocano markers)
```

**Question.** `filter-by-language.py` has no `ilo` row. What is this wiki's contaminant, and which
Tagalog/Cebuano markers would be safe to put in the contrast set?

**Raw finding.** Over 30,340 strongly-Ilocano paragraphs, counting each candidate contrast word:

```
para   ×4748   ORDINARY ILOCANO — "para kadagiti umamianan", the Spanish-derived benefactive
mula   ×4112   ORDINARY ILOCANO — "maap-apit a mula", a PLANT/crop.  In Tagalog `mula` is "from".
ay     × 989   present in genuine Ilocano paragraphs
at     × 539   ditto
ang    × 212 · ng ×195 · sa ×92 · mga ×15   all present inside real Ilocano text (quoted tl names)
hindi  ×  33   ⚠ NOT the Tagalog negator — it is the LANGUAGE Hindi ("am-ammo kas mung iti Hindi")
wala   ×   7   ⚠ a LANGUAGE NAME — "Ti pagsasao a Langalanga, wenno Wala"
usa    ×   6 · mao ×14 · dili ×11 · kaayo ×1   ⚠ all proper nouns in Ilocano text:
               USA · Mao Tse-tung · Dili (East Timor) · `kaayo` here is Ilocano "tree"
ito ×1 · siya ×1 · habang ×1 · naman ×3 · kung ×3 · kami ×3 · nang ×5   ← safe
```

Whole-corpus dominance test, marker-set vs contrast-set:

```
ilo-dominant 43,216 · English-dominant 12,769 · Tagalog-dominant 730 · Cebuano-dominant 9 · short 38,332
```

**Implication.** Two things. (1) **The contaminant is ENGLISH, by a factor of 17 over Tagalog** — the
opposite of hil, whose contaminant was Tagalog+Cebuano and whose English list was useless. (2) trap 37 in
miniature, four times over: `hindi`, `wala`, `usa`, `mao`, `dili`, `kaayo` all have healthy counts and
**every one is a different word** — a language name, a place, a person, a tree. Putting the obvious
Tagalog/Cebuano list in the contrast set would have deleted Ilocano paragraphs about Hindi, Wala, the USA,
Mao and Dili. The `ilo` CONTRAST row is therefore restricted to words measured at ≤5 occurrences inside
strongly-Ilocano text, and `para`, `mula`, `ay`, `at`, `ang`, `ng`, `sa`, `mga` are deliberately absent.

## Run 4 — 2026-08-13 18:45 — the artifact, and the baseline every later gate is measured against

**Commands**

```
python3 tools/normalization/filter-by-language.py --lang ilo --in ilo_paras.txt --out ilo_paras.ilo.txt
npx tsx tools/normalization/mine.ts mine --in ilo_paras.ilo.txt --out tools/corpus/mined/ilo.jsonc \
    --lang ilo --segment paragraph --per-cell 6 --sample 40
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/ilo.jsonc --lang ilo
npx tsx tools/normalization/corpus-diff.ts emit --lang ilo --corpus mined:ilo --out ilo.before
npx tsx tools/normalization/sources.ts --lang ilo
npx tsx tools/normalization/review.ts --lang ilo
```

**Question.** What does the corpus contain, and what does the engine do to it today?

**Raw finding.** Filter: kept 43,258 (45.5%) · short 38,332 · undecidable 9,807 · contrast 3,659 (3.8%).
Reading a random 12 of the contrast drops: every one is a BIBLIOGRAPHY line, an English film/book title,
or timeline markup (`from:11/25/1935 till:12/30/1938 text:"Gil Montilla"`). No Ilocano prose lost.

Mining 38,673 unique paragraphs → **covered 32/36 cells**, `EMPTY: ordinal-native ordinal-range iteration
calendar`. Matched counts (the whole corpus, not the hard-set):

```
digit-run 11760 · year 11727 · abbrev 4858 · initialism 3822 · letter-name 2917 · decimals 2055
ordinal-latin 1909 · grouped 1528 · ranges 1461 · signs 855 · roman 886 · quote-letter 834
degrees 737 · units 628 · percent 514 · clock 496 · dotted 521 · exponent 316 · arithmetic 76
fractions 76 · signed-number 68 · currency 52 · era-marker 51 · rate 37 · scaled-currency 22
version-dot 8 · zero-width 6 · ordinal-caps 5 · native-terminator 5 · sports-time 3
```

**BASELINE `mine.ts scan` — 8 defective classes:**

```
DROP percent       ×23      LEAK RAW-LATIN km  ×16
DROP math-sign     ×13      LEAK RAW-LATIN st  ×5
DROP exponent      ×12      LEAK RAW-LATIN th  ×2
DROP currency      ×12      LEAK RAW-LATIN kg  ×2
DROP degree        ×10      LEAK RAW-LATIN mm  ×2
DROP minus         ×6       LEAK RAW-LATIN nd  ×1
DROP ampersand     ×6       LEAK RAW-LATIN mph ×1
                            LEAK RAW-LATIN kd  ×1
```

`corpus-diff emit` baseline: **226 utterances**. `review.ts`: 1 FAIL (`normalize.ts` missing).
`sources.ts`: espeak NOT SHIPPED for ilo; referee 2,787 lines; no decimal word, no letter names, no
scale names. The unit-word line already names the slots the corpus fills: `km×11 m×6 kg×3 km/s×3
mm×2 ml×2` after a number.

**Implication.** Every symbol class in this language is unread. The two biggest are the grouped/decimal
pair and the percent sign; the RAW-LATIN leaks are the class no other counter reports, and `st`/`th`/`nd`
in that list are ENGLISH ORDINAL SUFFIXES inside quoted regiment names, not units — the brief's
"units are the real defects, English citation residue usually is not."

## Run 5 — 2026-08-13 18:55 — re-measuring every ceb and hil rule against Ilocano

**Commands** — whole-word and collocation counts over the filtered corpus, plus
`npx tsx tools/normalization/attest.ts --lang ilo --words …`

**Question.** The brief names four ceb rules that failed re-measurement in hil. Which of ceb's and hil's
rules survive for Ilocano, and which do not?

**Raw finding.**

| what | ceb | hil | ilo — measured |
|---|---|---|---|
| range word | `ngadto sa` | `hasta` | **`aginggana`** — ×220 written out BETWEEN DIGITS (`aginggana iti` ×127, `aginggana ti` ×47, `agingga iti` ×29). `hasta` ×0, `ngadto sa` ×0 |
| clock guard | bare `\d{1,2}:\d{2}` | `alas` PRECEDING | **neither.** `alas` ×12 and NOT ONE precedes a digit; the bare shape is ×205 of which ~23 are clocks |
| percent word | `porsyento` | `porsiyento` | **`porsiento`** ×120 — the other two are ×0 |
| decimal word | `punto` | `punto` | `punto` ✓ ×550, and attested IN THE SLOT: *iti maikanem a desimal a punto* |
| exponent position | after (default) | `after` | **`before`** — see Run 6 |
| `$` | `dolyar` | declined (×0) | **`doliar`** ×26 — see Run 6 |
| `+` | `dugang` | declined | declined; `dugang` ×0 in ilo |
| `sg` → genitive | — | `sang` | no analogue: ilo's genitive is `ti`, and `sg` ×38 here is the gloss `3sg`/`1sg` |
| `kada`, `oras`, `segundo`, dotted-abbrev-as-closed-list | ✓ | ✓ | **survive** — `kada` ×120, `oras` ×790, `segundo` ×83 |

The clock is the sharpest. Reading all 205 colon-numbers: **UTC offsets ×103** (`UTC+08:00`, `UTC−05:00`),
**scripture references ×26** (`Juan 13:21`, `Ezek. 47:10`, `1 Macc. 14:34`), flag **ratios** (`5:8`, `2:3`,
`7:10`), and ~23 genuine clocks. A ceb-shaped rule would have fixed 23 and broken 182. hil's `alas` guard
would have fixed 0 — its single clock-ish `alas` use spells the numeral out (`alas kuatro ken alas singko`)
and the rest are place and language names (Alas-asin, Batak Alas, Severino de las Alas).

**Implication.** Three Philippine languages, three different range words and three different percent
spellings. Nothing lexical transfers; only the SHAPES do.

## Run 6 — 2026-08-13 19:00 — two trap-40 findings, and one metalinguistic sentence

**Commands**

```
npx tsx tools/normalization/attest.ts --lang ilo --words dolyar,dolar,dollar,piso,peso,pisos
npx tsx tools/normalization/attest.ts --lang ilo --words kuadrado,kubiko,punto,porsiento,pulgada,milia
```

**Question.** Does the dollar word transfer from ceb, and which way round does the measure word go?

**Raw finding — the currency probe nearly closed the wrong way.**

```
dolyar    0 tokens   absent
dolar     0 tokens   absent
dollar    3 tokens   attested   ← and every hit is "Million Dollar Baby", the FILM
piso      3 tokens   attested   ← two are the botanist Willem Piso, one a Tagalog story title
pisos     7 tokens   attested   ← every hit money in an amount, plus a definitional sentence
```

On the first three lines hil's refusal would have been copied. The word exists and is spelled **`doliar`**
— ×26 in the corpus, ×30 on `attest.ts`, with a sentence that names the sign: *"Ti doliar ti Estados Unidos
(senial: $; kodigo: USD; naipangyababaan pay ti US$)"*. This is trap 40: a word-first probe cannot find a
spelling you did not guess. The same thing happened a second time with `ft` — `piye` ×0 and `talampakan` ×0,
and the corpus's foot word is `pie`/`pié` ×26, digit-adjacent in the gloss beside a metric figure.

**Raw finding — the exponent position, settled by the wiki in so many words.** ilo.wikipedia's `km²`
article says:

> Ti "km²" ket kayatna a sawen **kuadrado kilometro**, saan a kilometro kuadrado.

("«km²» means *kuadrado kilometro*, NOT *kilometro kuadrado*.") The corpus agrees 39:10, and the cube word
the same way (`kubiko metro` ×15 : `metro kubiko` ×1). ceb and hil both postpose.

**Implication.** `position: "before"` for both powers — the one place a sibling's rule is actively WRONG
for Ilocano rather than merely unattested. And two spellings that a reference-first approach would have
missed entirely.

## Run 7 — 2026-08-13 19:05 — the gates, before and after

**Commands** — `corpus-diff emit/compare`, `mine.ts scan`, `review.ts`, `sources.ts`,
`referee-eval.ts ilo`, `npx vitest run`, `npx tsc --noEmit`.

| gate | before | after |
|---|---|---|
| `corpus-diff` DROP | 70 | **20** |
| utterances changed | — | **102 / 226 (45.1 %)**, all 102 read individually |
| `mine.ts scan` | 8 defective classes | **4** (DROP minus ×6, DROP exponent ×1, RAW-LATIN st/th/nd/km/kd ×11) |
| `referee-eval` wikipron | 766/926 (82.7 %) | **766/926 — byte-identical** |
| `referee-eval` kaikki | 822/973 (84.5 %) | **822/973 — byte-identical** |
| `referee-eval` epitran | 673/887 (75.9 %) | **673/887 — byte-identical** |
| `review.ts` | 1 FAIL (no normalizer) | **2 FAIL** — both genuine sourced refusals (trap 24) |
| `vitest` | — | **242 files, 3,983 passed** |
| `coverage.ts` | — | `ilo done — 3 defective cell(s)` |

**Implication.** The referee moving zero on all three sources is the RESULT, not a null: Run 1 predicted it
from the `phonemizeWordRules` binding, and a moved number would have meant the word path had been touched.

## Run 8 — 2026-08-13 19:10 — what the scan still reports, itemised

**Command** `npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/ilo.jsonc --lang ilo`

**Question.** A declared unit that still reports has six known causes, none visible from the unit table.
Which are these?

**Raw finding.**

```
DROP minus         ×6    genuine negatives, no Ilocano word — DELIBERATELY not accepted (the ak/ln/bm stance)
LEAK RAW-LATIN st  ×5    English ordinal suffixes: `1st Battalion`, `121st Infantry`
LEAK RAW-LATIN th  ×2    `4th Tank Regiment`, `47th Infantry`
LEAK RAW-LATIN nd  ×1    `2nd Battalion`
LEAK RAW-LATIN km  ×2    (a) `5 a riwriw km²` — a MAGNITUDE between the number and the unit, and the
                             EXPONENT branch does not make the hop the plain unit does (`3 a bilion km`
                             reads *bilion kilometro* correctly). ×8 corpus-wide, a shared-tier limit.
                         (b) `densidad 5,060 hab/km²` — a rate whose NUMERATOR is Spanish `hab`. ×1.
LEAK RAW-LATIN kd  ×1    `261,227 kd mi` — one writer's ad-hoc contraction of `kuadrado`
DROP exponent      ×1    `香港仔 hoeng¹ gong² zai²` — JYUTPING TONE NUMBERS, not exponents
```

**Two causes that were found and FIXED rather than recorded**, both of which the unit table cannot show:

- **a unit in the `per` slot with no number beside it**, ×133 — the population-density template
  `N a tattao tunggal maysa a km²`. The numeral belongs to `tattao`, so the tier (which matches a unit only
  after a number) could never reach it. Now a local rule; the third-largest single repair in this layer.
- **bare `m` claiming a MINUTE**, ×4 — `12 h 49 m`, `GMT +0h 19 m 32.13s`. Bare `m` is ×300 digit-adjacent
  and 296 are genuine metres, so declaring it is overwhelmingly right (trap 28's own arithmetic), but the
  four `\dh` shapes needed claiming first. Reading them as `oras`/`minuto`/`segundo` — all corpus-attested
  — fixes 4 of 4 with no false positives.

**Implication.** Of the brief's six causes, this language exhibited three: the missing connective (the
magnitude/exponent hop), unit-not-adjacent-to-a-number (the `per` slot), and a one-letter key colliding
with another notation. The remainder is foreign-citation residue, which is not a defect in Ilocano.
