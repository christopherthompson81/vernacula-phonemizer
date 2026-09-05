# Sepedi / Northern Sotho (`nso`) — text normalization investigation

Chronological log. One `## Run N` heading per run: the command, the question it was meant to answer, the
RAW finding, and what it implies for the next step. Negative results are kept deliberately.

**Standing constraint for this language.** `nso` carries verdict ⛔ — there is **no machine referee at all**
(no wikipron, no kaikki, no epitran; `sepedi.jsonc` says so in its own header). So nothing in this document
may quote a referee delta, and no claim of "the IPA is right" is available. What IS available, and what
every conclusion below rests on: (a) the word forms are SOURCED, each with a citation; (b) the readings are
PASTED, produced by actually running the phonemizer. Correctness here is the correctness of the sourcing
plus the correctness of the rewrite, and nothing more is claimed.

## Run 1 — 2026-08-14 08:38 — the state of the tree before anything is edited

```
npx tsx tools/normalization/corpus-diff.ts emit --lang nso --corpus mined:nso --out /tmp/wt-nso-nso.before
  → emitted 402 utterances
npx tsx tools/normalization/review.ts --lang nso
  → [FAIL] normalizer  src/languages/sepedi/normalize.ts missing        (1 FAILING)
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/nso.jsonc --lang nso
```

Question: what does the untreated engine already lose, and on what evidence base?

Raw scan output (the BEFORE baseline; DROP total **76**):

```
DROP percent       ×26
DROP currency      ×16
DROP math-sign     ×16
DROP ampersand     ×7
DROP degree        ×5
DROP exponent      ×3
DROP minus         ×3
LEAK RAW-LATIN km  ×1     Traka, e sepela ka 30 m/s goba 108 km/h go leba bohlabela …
LEAK RAW-LATIN bn  ×1     Ka morago ga bohlatse bja Zuma go khomišene …
REDUNDANT currency ×1
```

The artifact (`tools/corpus/mined/nso.jsonc`) is **dump-sourced** — nso.wikipedia pages-articles,
12,077 paragraph segments, `cellsCovered 29/35` — so its `sample` tier is the language's real distribution
and a rate computed from it is meaningful. Whole-corpus counts it records:

```
percent 108 · decimals 226 · grouped 175 · ranges 118 · units 78 · currency 17 · clock 65
degrees 5 · exponent 7 · rate 3 · ampersand 124 · arithmetic 15 · signed-number 8 · fractions 13
ordinal-latin 612 · abbrev 847 · initialism 2975 · roman 2080 · letter-name 1170
```

Implication: percent (108) and the decimal/grouping separators (226 + 175) are the traffic. Units at 78 and
ampersand at 124 are next. Every one of those needs a SOURCED Sepedi word before a rule may exist, and this
language has no espeak entry and no referee, so the sourcing tiers available are: the corpus artifact
itself, nso.wikipedia via `attest.ts`, Wiktionary, and published Northern Sotho reference material.
Next step: read the corpus instances by hand, cell by cell, before proposing a single rule.

## Run 2 — 2026-08-14 08:55 — read the corpus cell by cell, before proposing any rule

The artifact's retained text (`hard` + `sample`, 405 segments) dumped to a scratch file and grepped per cell.
Raw findings, with the counts that actually decided rules:

```
percent          48 `%` in the retained text, EVERY ONE postposed: `40% ya palomoka`, `61.9% ya dikgetho`,
                 `0.15%`, `+52.5%`, `96.7% … 2.6% … 0.3`
currency         R ×11 (of which R37/R555 ×2 are ROAD DESIGNATIONS), $ / US$ ×10, GB£ / £ ×6
grouping         `,`+3 digits ×28 · ` `+3 digits ×many (`30 560 860`, `1 221 037`) · `.`+3 digits ×2
decimals         `.`+1–2 digits ×70 · `,`+1–2 digits ×4 (`221,6 km²`, `430,9 km²`, `+3,4%`, and `(1,2,3,4,5,6)`
                 which is a LIST, not a number)
units            km ×15 · kg ×4 · cm ×2 · m ×9 (all genuine metres) · m/s ×3 · km/h ×1 · /ha ×1
exponent         km² ×3 in the retained text (`221,6 km²`, `430,9 km²`, `361 million km²`)
ranges           mostly YEAR spans (1901–2012, 1880–1881, 1876-77, 1978 -1989) plus `5–8 senthimetara`,
                 `2–3 inches`, `11-12 yuan`, `800-2000`, and two DESCENDING (`33,500–32,500`, `17000–15000`)
math signs       `+` ×8 · `=` ×8 · `×` ×4 · `±` `÷` `<` `>` ×0
ampersand        &nbsp; dominates; real `&` = R&B ×2, `Mail & Guardian`, `Poso & Mohlokomedi`, `Science &Tech`
clock            ×0 in the retained text (65 corpus-wide)
fractions        `1/100` ×1 real; the rest are seasons (2017/18, 2015/16, 2020/2021) and a time signature 4/4
dotted caps      T.L. P.H. M.C. J.C. F.W. C.E. B.P.J. B.C.E. A.O. — one each
```

⚠ **THE RETAINED TEXT IS NOT ALL SEPEDI.** Two segments are Sesotho (`ka holimo ho 85°F Chiclayo`,
`ha a bua le parishe ya`) and one is AFRIKAANS (`Ducatimotorfietse gebruik byna uitsluitlik 90° V-tweeling…`).
Both landed in the `degrees` cell, which is the smallest cell in the artifact (5). Playbook trap 34, and it
means the degree evidence is thinner than the count suggests.

Implication: the traffic is percent, the two separators, and the units — and every one of those needs a
sourced word. Next: probe each candidate word against nso.wikipedia and READ THE SENSES.

## Run 3 — 2026-08-14 09:05 — what the engine does to those shapes TODAY

```
npx tsx /tmp/probe.mts <the shapes above>
```

Question: what is the defect, in the reading, rather than in the abstract? Raw output:

```
"40% ya badudi"        → mɑsɔmɛnnɛ jɑ bɑdudi                        the sign is GONE
"R125 milione"         → r lɛkxɔlɔ lɛ mɑsɔmɛpʼɛdi ɬɑnɔ miliɔnɛ      the R is a bare [r]
"$450"                 → mɑkxɔlɔnnɛ lɛ mɑsɔmɛɬɑnɔ                   the sign is GONE
"108 km/h"             → lɛkxɔlɔ lɛ sɛswɑi kʼm ɦ                    raw ⟨km⟩, and ⟨h⟩ read as [ɦ]
"30 m/s"               → mɑsɔmɛtʰɑrɔ m s
"221,6 km²"            → mɑkxɔlɔpʼɛdi lɛ mɑsɔmɛpʼɛdi tʼɛɛ , t͡sʰɛlɑ kʼm   comma = CLAUSE PAUSE, ² gone
"1.2 °C"               → tʼɛɛ . pʼɛdi k                             dot = SENTENCE BREAK, ° gone, C = [k]
"1,600,000"            → tʼɛɛ , mɑkxɔlɔt͡sʰɛlɑ , lɛfɛɛlɑ             "one, six hundred, zero"
"30 560 860"           → three separate numbers
"1950–2020"            → the dash is dropped, two cardinals juxtaposed
"Mail & Guardian"      → mɑil xuɑrdiɑn                              the & is GONE
"4 × 100"              → nnɛ lɛkxɔlɔ                                the × is GONE
"55°S"                 → mɑsɔmɛɬɑnɔ ɬɑnɔ s
"802.11n"              → mɑkxɔlɔsɛswɑi lɛ pʼɛdi . lɛsɔmɛtʼɛɛ n       a sentence break inside a designation
```

⚠ **TWO TRAP-56 MISREADS — a defect that produces a READING, which no leak class can see:**

```
"1200 kg"  → sɛkʼɛtʼɛ lɛ mɑkxɔlɔpʼɛdi **kx**     ⟨kg⟩ IS the Sepedi digraph for the velar affricate /kx/,
                                                  so `kg` is not a leak at all — it is pronounced as a
                                                  well-formed Sepedi consonant.
"50 cm"    → mɑsɔmɛɬɑnɔ **km**                    ⟨c⟩ has no grapheme rule, falls through to latinPhone → [k],
                                                  so ⟨cm⟩ reads as a plain [km] cluster — one ejective mark
                                                  away from ⟨km⟩ → [kʼm]. The nya/tl ⟨cm⟩=⟨km⟩ collision
                                                  (playbook trap 56) in a third language.
```

Neither appears in `mine.ts scan` (kg is not vowel-less-raw — it IS converted, to the wrong thing). Both
close when the unit table is declared. Implication: units are not optional here.

## Run 4 — 2026-08-14 09:20 — sourcing every word, `attest.ts` against nso.wikipedia

⚠ nso has **no espeak entry, no referee, and no FLEURS corpus**, so the sourcing tiers available are the
mined artifact and nso.wikipedia. `concept.ts` was tried first and returned a **complete negative**:

```
npx tsx tools/normalization/concept.ts --items Q25267,Q32043,Q40754,Q40276,Q1226939,Q11229 --langs nso,st,tn --titles
  nso  —  —  —  —  —  —          (and "no article" in every wiki, for all six items)
```

Wikidata has no nso label and nso.wikipedia no article for degree-Celsius, addition, subtraction,
multiplication, division or percent. That is the definitive negative for the arithmetic signs — trap 48's
shape — and it is why `+ − × ÷ = < >` are all left unread below.

`attest.ts --lang nso`, run in five batches. Verdicts, with the SENSE read from the printed prose:

| word | tok/arts | sense read | verdict |
|---|---|---|---|
| `diperesente` | 2/2 | **`diperesente tše tharo (3%)`** — glossed against the sign itself | ✅ percent, plural |
| `peresente` | 2/2 | `peresente ye masometharo tshela(36) ya barutiši` — "36 percent of teachers" | ✅ percent, singular |
| `dipersente` | 4/2 | `dipersente tše nne tša badudi` — same word, syncopated spelling | variant, recorded |
| `phesente` | 1/1 | `phesente ya palo ya batho` | variant, recorded |
| `persente` / `protsente` | 0/0 | — | absent |
| `dikhilomithara` | 16/10 | `dikhilomithara tše 2,798`, `… tše 40 ka borwa bja toropo` | ✅ kilometre |
| `dimithara` | 37/10 | `dimithara tše 100`, `dimithara tše 2,6` | ✅ metre |
| `mithara` | 1/1 | **`gola go feta mithara e tee ka botelele`** — "grow past ONE metre in length" | ✅ metre, singular |
| `disekwere-khilomithara` | 3/2 | `lefelo la disekwere-khilomithara tše 1 221 037` | ✅ square kilometre |
| `disekwere` | 4/3 | `dikhilomithara tše di nyakilego go ba disekwere tše 20,000`; `Sekwere-maele` = square mile | ✅ the SQUARE modifier |
| `dikhilograma` | 10/2 | `boima bja dikhilograma tše 7.5 (diponto tše 17)` | ✅ kilogram |
| `dikilogeramo` | 1/1 | `di ka imela go feta dikilogeramo tše 250` | variant, ×1 — `dikhilograma` preferred |
| `dimilimithara` | 2/1 | `botelele bja dimilimithara tše 60` | ✅ millimetre |
| `senthimetara` | 1/1 | `5–8 senthimetara (2–3 inches) ka bophara` | ✅ centimetre |
| `disenthimetara` | 0/0 | — | absent; the `di-` plural is NOT written for cm |
| `hektare` | 5/3 | `mehlare ya mo e ka bago 100 **ka** hektare` — and 1 of the 5 hits is SESOTHO | ✅ hectare, but see `ha` below |
| `metsotswana` | 34/11 | `metsotswana ye 60`, `nako ya metsotswana ya 9.84` | ✅ seconds |
| `motsotswana` | 3/2 | **`Motsotswana (taetšo ya SI : s) ke leina la motšo wa nako`** — glosses the SI symbol ⟨s⟩ | ✅ second, singular |
| `iri` | 14/10 | `Iri e lekana le metsotso ye 60`; `iri ye tee` | ✅ hour |
| `ranta` / `diranta` | 11/6, 6/5 | **`Ranta (rand) ke mašeleng a Afrika Borwa`**; `diranta tše dikete tše 1,6` | ✅ rand |
| `ditolara` | 2/2 | `dimilione tše 450 tša ditolara`; `bodiiding ka ditolara tša PPP` | ✅ dollar |
| `khutlo` | 2/1 | **`khutlo(.) ; fegelwana(,) ; leswao potsiso(?)`** — the FULL-STOP mark's NAME | ❌ see below |
| `ntlha` | 6/3 | a geographic point/cape, and "point of sale" | ❌ not a decimal point |
| `desimale`, `tikimale`, `khoma` | 0/0 | — | absent |
| `dikgato` | 16/13 | **`bodiba bja dimetara tše 3 (dikgato tše 10)`** — glossed against metres: this is the FOOT | ❌ not "degree" |
| `dikhutlo` | 2/2 | `dikhutlo tše mmalwa tša tšona di bogale` — geometric ANGLES | ❌ not the temperature degree |
| `Celsius` | 2/1 | `magareng ga 2.24º le 1.02º Celsius … fasefase go - 3.12º Celsius` | scale name, one article |
| `Fahrenheit` | 0/0 | — | absent |
| `diponto` | 5/1 | **`dikhilograma tše 7.5 (diponto tše 17)`** — the POUND WEIGHT, glossed against kilograms | ❌ not the currency |
| `dilithara` / `lithara` / `milimithara` / `kilogeramo` / `khilograma` / `diyuro` | 0/0 | — | absent |

**Three near-misses that the prose caught and a count would not have:**

1. `dikgato` ×16 in 13 articles looks like an ideal degree word. Its own gloss says otherwise —
   `bodiba bja dimetara tše 3 (dikgato tše 10)`, a pit of 3 metres = 10 FEET. Shipping it would have read
   every temperature in the language as feet. Trap 37 exactly.
2. `diponto` ×5 is the obvious `£`. Every one of the five is a weight in a parenthetical beside a kilogram
   figure. Same shape as the playbook's `ms paun`.
3. `khutlo` is a real, attested word for the character `.` — from nso.wikipedia's own punctuation article,
   which lists `khutlo(.)`, `fegelwana(,)`, `leswao potsiso(?)`. It is the mark's NAME, not what a reader
   says between the halves of `9.84`; using it would read that as "nine full-stop eight four". This is the
   `धन` register trap, and it is why **no decimal word is emitted** (see the layer's header).

**The one probe-shape failure worth recording.** `dikhilogeramo` (my first spelling) returned `absent`; the
word is `dikhilograma` — and it was found only because the `mithara e tee` example printed beside a different
probe happened to contain `dikilogeramo`. Trap 40: a word-first probe cannot find a spelling you did not
guess. Reading the examples is what supplied it.

## Run 5 — 2026-08-14 09:00 — the layer, and the three defects the corpus diff found that no probe could

`src/languages/sepedi/normalize.ts` written and wired into `sepedi.ts`'s `text()` as
`assembleClauses(normalizeSepedi(input), …)`. The tier runs FIRST (`normalizeSepedi` opens with
`SYMBOLS(input)`), the Chichewa order; `units` are LOCAL, for three reasons argued in the file header.

```
npx tsx tools/normalization/corpus-diff.ts emit --lang nso --corpus mined:nso --out /tmp/wt-nso-nso.after
npx tsx tools/normalization/corpus-diff.ts compare --before … --after … --corpus mined:nso
  → changed 109/402 (27.1%)
    DROP 71 → 22 · DIGIT 0→0 · SLOT-GAP 0→0 · RAWMARK 0→0 · ZERO-WIDTH 0→0 · RAW-CAPS 0→0 · THROW 0→0
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/nso.jsonc --lang nso
  → DROP 76 → 23   percent 26→0 · currency 16→3 · ampersand 7→0 · exponent 3→0 · degree 5→1
                   math-sign 16→16 · minus 3→3 · LEAK RAW-LATIN km ×1 → 0 · LEAK RAW-LATIN bn ×1 (unchanged)
```

**Three defects came out of READING the diff, and every one of them passes every unit probe.** They are the
argument for the gate.

1. **A SPACED-HYPHEN CHAIN IS A YEAR INDEX, NOT FIVE SPANS.** nso.wikipedia has year-navigation pages —
   `1970 - 1969 - 1968 - 1967 - 1966 - …`, ×4 in the retained corpus — and the first range rule, which
   excluded only an ADJACENT hyphen, claimed every alternate pair: *1970 go ya go 1969*. The guard now reaches
   across the space on both sides (`(?<![-–—][  ])` … `(?![  ][-–—])`), which declines the whole chain and
   costs nothing on the fourteen genuine spans.
2. **DE-GROUPING A 43-DIGIT RUN MADE THE ENGINE SPEAK ITS OWN EXPONENT NOTATION.** The base-16 article
   tabulates powers of two as space-grouped runs
   (`2 658 455 991 569 831 744 654 692 615 953 842 176`). De-grouped, that exceeds `Number.MAX_SAFE_INTEGER`,
   the engine's `Number(m[2])` yields `2.658455991569832e+42`, and `numberToWords` falls to its digit-at-a-time
   branch over the EXPONENT STRING — the reading was
   *sɛɲɑnɛ pʼɛdi t͡sʰɛlɑ ɬɑnɔ … tʰɑrɔ pʼɛdi **ɛ** tʰɑrɔ t͡sʰɛlɑ*, with the ⟨e⟩ of `e+42` voiced as a numeral
   and the `+` and `.` dropped. Capped at four groups (≤15 digits, inside the safe range). ⚠ The precision
   failure itself is an ENGINE defect and is NOT fixed here — see the backlog below.
3. **GLUED INITIALS FUSE INTO A DIGRAPH.** The dotted-capital rule first joined the letters, as its Chichewa
   and Kirundi ancestors do. In Sepedi that is not neutral: ⟨tl⟩ and ⟨ph⟩ are grapheme-table entries, so the
   corpus's own `Verster T.L.` read **`t͡ɬʼ`** — the lateral affricate — and `P.H. Nortjé` read **`pʰ`**. Two
   of the nine dotted runs in the retained text became a single phoneme the writer never wrote, and no leak
   class can see it (trap 56). Joining with a HYPHEN instead makes each letter its own token, because the
   engine's word arm is `LATIN_RUN` and does not include `-`: `tʼ l`, `pʼ ɦ`, `b k ɛ`.

**Readings, pasted from the phonemizer rather than described** (`phonemize(x, "nso")`). This is what the
⛔ verdict leaves available as evidence, and the claims in this document go no further than these strings:

```
BEFORE                                                    AFTER
40% ya badudi   mɑsɔmɛnnɛ jɑ bɑdudi                       dipʼɛrɛsɛntʼɛ t͡ʃʼɛ mɑsɔmɛnnɛ jɑ bɑdudi
R125 milione    r lɛkxɔlɔ lɛ mɑsɔmɛpʼɛdi ɬɑnɔ miliɔnɛ     dirɑntʼɑ t͡ʃʼɛ miliɔnɛ lɛkxɔlɔ lɛ mɑsɔmɛpʼɛdi ɬɑnɔ
$450 milione    mɑkxɔlɔnnɛ lɛ mɑsɔmɛɬɑnɔ                  ditʼɔlɑrɑ t͡ʃʼɛ miliɔnɛ mɑkxɔlɔnnɛ lɛ mɑsɔmɛɬɑnɔ
108 km/h        lɛkxɔlɔ lɛ sɛswɑi kʼm ɦ                   dikʰilɔmitʰɑrɑ t͡ʃʼɛ lɛkxɔlɔ lɛ sɛswɑi kʼɑ iri
30 m/s          mɑsɔmɛtʰɑrɔ m s                           dimitʰɑrɑ t͡ʃʼɛ mɑsɔmɛtʰɑrɔ kʼɑ mɔt͡sʼɔt͡sʼwɑnɑ
1200 kg         sɛkʼɛtʼɛ lɛ mɑkxɔlɔpʼɛdi **kx**           dikʰilɔxrɑmɑ t͡ʃʼɛ sɛkʼɛtʼɛ lɛ mɑkxɔlɔpʼɛdi
50 cm           mɑsɔmɛɬɑnɔ **km**                         sɛntʰimɛtʼɑrɑ mɑsɔmɛɬɑnɔ
221,6 km²       …tʼɛɛ , t͡sʰɛlɑ kʼm                        disɛkʼwɛrɛ kʰilɔmitʰɑrɑ t͡ʃʼɛ …pʼɛdi tʼɛɛ t͡sʰɛlɑ
1.2 °C          tʼɛɛ . pʼɛdi k                            tʼɛɛ pʼɛdi kɛlsius
1,600,000       tʼɛɛ , mɑkxɔlɔt͡sʰɛlɑ , lɛfɛɛlɑ            miliɔnɛ lɛ dikʼɛtʼɛ mɑkxɔlɔt͡sʰɛlɑ
900,000,000     mɑkxɔlɔsɛɲɑnɛ , lɛfɛɛlɑ , lɛfɛɛlɑ         dimiliɔnɛ mɑkxɔlɔsɛɲɑnɛ
1950–2020       …mɑsɔmɛɬɑnɔ dikʼɛtʼɛ t͡ʃʼɛ pʼɛdi…          …mɑsɔmɛɬɑnɔ **xɔ jɑ xɔ** dikʼɛtʼɛ t͡ʃʼɛ pʼɛdi…
Mail & Guardian mɑil xuɑrdiɑn                             mɑil **lɛ** xuɑrdiɑn
55°S            mɑsɔmɛɬɑnɔ ɬɑnɔ s                         mɑsɔmɛɬɑnɔ ɬɑnɔ bɔrwɑ
802.11m         mɑkxɔlɔsɛswɑi lɛ pʼɛdi **.** lɛsɔmɛtʼɛɛ m mɑkxɔlɔsɛswɑi lɛ pʼɛdi tʼɛɛ tʼɛɛ m  (still NOT metres)
```

⚠ **`kg` AND `cm` ARE THE HEADLINE, AND NEITHER WAS IN ANY GATE'S REPORT.** ⟨kg⟩ is the Sepedi digraph for
the velar affricate /kx/, so `1200 kg` was not leaking — it was being PRONOUNCED, as a well-formed Sepedi
consonant. ⟨c⟩ has no grapheme rule and falls through to `latinPhone`, so ⟨cm⟩ read [km], one ejective mark
away from ⟨km⟩ → [kʼm]: the nya/tl collision of playbook trap 56, in a third language.

## Run 6 — 2026-08-14 09:05 — the gates, and the two that are RED on purpose

```
npx tsc --noEmit                                  clean
npx vitest run                                    244 files, 4162 passed, 5 skipped   (0 failed)
npx tsx tools/normalization/review.ts --lang nso  2 FAILING — both deliberate, see below
npx tsx tools/normalization/mine.ts scan …        DROP 76 → 23
```

`vitest` initially failed one shared test — `test/languageCatalogue.test.ts`, because the catalogue's derived
`normalization` column and `languages.db` are generated from the presence of a `normalize.ts`. Regenerated
with the repo's own tools (`derive-normalization.py`, `build.py`); the only cell that moved is nso's, from
blank to `done`.

**`review.ts` reports 2 FAILING and both are refusals this document has already argued.** A red gate that is
correct beats a green gate that is wrong (trap 24), and they are NOT entered into `defects.ts`'s
`ACCEPTED_SILENT` — that file is shared, another agent has it open in this fan-out, and ak's `km²` is the
precedent for leaving a deliberate silence visible:

```
[FAIL] sign classes   DROPPED: minus plus plus-minus equals less-than greater-than times divide
[FAIL] artifact scan  DROP math-sign ×16 · DROP currency ×3 · DROP minus ×3 · DROP degree ×1
                      LEAK RAW-LATIN bn ×1
```

- **math-sign / minus / plus** — nothing in any nso source says what a reader puts in those slots.
  `concept.ts` returns a blank row for nso on addition, subtraction, multiplication and division; the corpus's
  `=` are five EasyTimeline directives, two English infobox rows and one arithmetic line; its `×` are four
  copies of the English phrase `4 × 100 metres relay`; its `+` are wind readings and antenna gains.
- **currency ×3** — all `£`/`GB£`. Refuted, not unfound: `diponto` ×5 on nso.wikipedia is the pound WEIGHT,
  glossed against kilograms in its own sentence.
- **degree ×1** — the one remaining instance is the AFRIKAANS paragraph in the corpus
  (`Ducatimotorfietse gebruik byna uitsluitlik 90° V-tweelingenjins`), i.e. contamination, not nso.
- **LEAK RAW-LATIN `bn` ×1** — `$2.5bn (£1.98bn)`, an English magnitude abbreviation. Pre-existing and
  unchanged by this layer.

### Backlog — defects found in SHARED code, not fixed here

1. **`src/core/normalizeSymbols.ts`: the no-measure-word exponent fallback ignores `unitPrefix`.** In the
   unit branch, `if (forms === undefined) return \`${q} ${head}${exp}\`` — every other return in that
   callback honours `d.unitPrefix`, this one does not, and it also re-emits the superscript glued to the
   noun. For a `unitPrefix` language declaring `units` but no `exponentWords`, `5 m²` therefore reads
   *5 dimithara tše²* — number first, and a stranded `²` fused to the concord particle. Reproduce by
   declaring `units: { m: ["dimithara tše"] }, unitPrefix: true` with no `exponentWords` and normalizing
   `5 m²`. nso does not reach it (its unit path is local), but ig, ki, om, rn, rw, si, so and zsm are all
   `unitPrefix` languages and any of them that omits a cube word is exposed.
2. **`src/languages/sepedi/numbers.ts` + `sepedi.ts`: a digit run longer than 15 digits reads as JavaScript
   exponent notation.** `sepedi.ts` does `numberToWords(Number(m[2]))`; above `Number.MAX_SAFE_INTEGER` the
   conversion yields `2.658455991569832e+42` and `numberToWords`'s digit-at-a-time fallback spells that
   string — emitting the letter ⟨e⟩ as a word and silently dropping `.` and `+`. This is an engine bug rather
   than a normalization one and the fix (carry the digit STRING rather than a `Number`) belongs with whoever
   owns the compositor; the normalization layer works around it by capping de-grouping at four groups.
   The same shape almost certainly exists in every engine that writes `numberToWords(Number(…))`.

## Run 7 — 2026-08-14 09:10 — what was DECLINED, and the price of each refusal

Trap 53 says a refusal is not neutral: price it against what the half-declared reading says. Each of these
was priced, and the price is stated:

| class | declined because | what the text reads instead |
|---|---|---|
| decimal-point word | `khutlo` is attested — as the NAME of the mark `.`, from nso.wikipedia's punctuation article (`khutlo(.) ; fegelwana(,)`). Wrong register: it would read `9.84` as "nine FULL-STOP eight four". `desimale`/`tikimale`/`khoma` ×0, `sources.ts` `[NONE] decimal-point` | the separator is removed and the fraction is read digit-by-digit — `9 8 4`. Nothing is lost that was there before; the dot WAS a sentence break |
| `+ − × ÷ = < >` | `concept.ts` blank for nso on all four operations; no article, no Wikidata label | the signs stay visible to the DROP gate. `4 × 100` reads as two cardinals, as it did before |
| `£` / `€` | `diponto` ×5 is the pound WEIGHT (`dikhilograma tše 7.5 (diponto tše 17)`); `diyuro` ×0 | the sign drops, as before. A currency read as a mass would be worse |
| `°F` scale name | `Fahrenheit` ×0 everywhere | the `F` is CLAIMED so it cannot reach the g2p as a bare [f], and the scale is unsaid |
| degree NOUN | `dikgato` ×16/13 is this wiki's word for the FOOT (`dimetara tše 3 (dikgato tše 10)`); `dikhutlo` ×2 is the geometric angle | `1.2 °C` reads `tʼɛɛ pʼɛdi kɛlsius` — scale named, unit noun absent |
| cube word, and `cm²`/`kg²` | nothing attests a cube word or these compounds | ⚠ the WHOLE match is refused: `5 m³` reads `ɬɑnɔ m`, exactly as before. It is NOT half-read — that is the `790 km2` → "790 kilometres two" defect |
| letter names / initialisms | `sources.ts` `[NONE] letter-names — espeak does not ship this language at all`; 2,975 in the corpus | `core/initialisms.ts` would be a no-op. The dotted-run step removes the spurious sentence pauses and nothing more |
| fractions | `sources.ts` `[NONE] fraction-series`; 1 of the corpus's 13 `N/N` shapes is a fraction, the rest are financial years and a time signature | unchanged |
| clock | ×0 `N:NN` in the retained corpus. The whole-corpus cell is 65, but with nothing retained there is no marker distribution to tabulate, and the ilo lesson (trap 55) is that a colon rule guessed from a sibling breaks more than it fixes | `1:15` still reads `tʼɛɛ , lɛsɔmɛɬɑnɔ` |
| `ha` unit key | `hektare` ×5 is attested, but digit-adjacent `ha` is ×0 while `ha` is a very common word in the Sesotho that contaminates this wiki | unchanged |
| `s` unit key | `\ds` ×62 in the corpus and 60 are DECADES (`1910s`, `1990s`, `2000s`) against two genuine seconds | `9.90s` keeps its raw `s`. `s` IS declared as a rate denominator, where the position rules the decade out |
| bare `R` + 1–3 digits | `R37`/`R555` are national ROADS. All 9 corpus currency instances carry a magnitude, a decimal or a grouping; neither road number does | `R100` would be left unread — visible to the DROP gate, where a route read as money is visible to nothing |

**Two known false positives, recorded rather than guarded away:**

- `ndege ya Boeing 737-800`-shaped model designations are claimed by the range rule (`737 go ya go 800`).
  The same instance Chichewa records. 1 against the 14 genuine spans; a "not after a capitalised word" guard
  would also decline a sentence-initial `Ka 2004-2009`.
- `1.234` de-groups to `1234`. A three-place DECIMAL would be mis-read — but the corpus has 0 of those and 2
  dot-groupings (`216.061 badudi`, `1.800.000 badudi`), both in the two continental-typography city stubs
  that also supply the corpus's only comma decimals.

**And what cannot be verified at all, stated plainly.** nso carries verdict ⛔: there is no wikipron, no
kaikki, no epitran and no espeak for it, so there is **no referee delta in this document and none can be
measured**. Every IPA string above is this engine's own output, and its segmental correctness rests on
`sepedi.jsonc`'s authored grapheme table, which is itself unverified (its header says so). What this run can
stand behind is narrower and is the whole of the claim: each word form emitted is a token somebody else
wrote, cited with its `attest.ts` count and the sense read from its own prose; each guard is a tabulation over
the corpus with both its true and false counts stated; and the corpus diff moved 109 of 402 utterances with
no new leak in any class.
