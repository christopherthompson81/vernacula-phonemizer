# Kikuyu / Gĩkũyũ (ki) — text-normalization investigation

Chronological log for the `norm/ki` run. Method: `docs/normalization_playbook.md`.
Bantu precedents re-measured rather than inherited: sn, nya, rw, rn, sw, xh, zu, ln.

## Run 1 — 2026-08-13 (setup + baseline gates)

**Question.** What does ki already have, which gates are real meters, and what is the corpus?

**Commands.**

```
npx tsx tools/normalization/review.ts   --lang ki
npx tsx tools/normalization/sources.ts  --lang ki
npx tsx tools/referee-eval/eval.ts ki
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/ki.jsonc --lang ki
npx tsx tools/normalization/corpus-diff.ts emit --lang ki --corpus mined:ki --out <scratch>/ki.before
```

**Raw findings.**

- `review.ts` → `[FAIL] normalizer  src/languages/kikuyu/normalize.ts missing`. That is the only line;
  everything else is gated behind the normalizer existing.
- `sources.ts` → espeak does NOT ship Kikuyu. `[NONE]` letter-names, decimal-point, scale-names,
  fraction-series. `[chk?]` percent, currency, unit, minus, equals, times, ampersand, exponent.
  Haystack size: `espeak: NOT SHIPPED · referee: 1065 lines · corpus: 372 lines (incl. mined artifact)`.
- `referee-eval ki` → the referee EXISTS and is real, but it is a WORD referee only: en.wiktionary Kikuyu,
  1062 IPA words, folded backbone 1056/1062 (99.4%), symbol accuracy 99.9%, 6 residual divergences.
  Its own footer states the secondary-source gap: no kaikki per-language dump, no wikipron `kik`, no
  epitran `kik-Latn`.
- `mine.ts scan` (372 retained lines) → 14 findings:
  `DROP math-sign ×14 · DROP percent ×13 · DROP ampersand ×8 · LEAK RAW-LATIN ft ×7 · DROP minus ×5 ·
   DROP currency ×5 · LEAK RAW-LATIN mw ×3 · DROP exponent ×3 · LEAK RAW-LATIN km ×2 ·
   LEAK RAW-LATIN tv ×2 · DROP degree ×1 · LEAK RAW-LATIN mt ×1 · LEAK RAW-LATIN st ×1 ·
   LEAK RAW-LATIN sh ×1`.
- `corpus-diff emit` → 363 utterances (372 segments deduplicated).
- Artifact: `tools/corpus/mined/ki.jsonc`, ki.wikipedia dump, 3921 paragraphs, `cellsCovered 30/35`,
  NOT stale (review.ts raises no staleness fail).

**Implication.** The gate taxonomy for this language, stated plainly:

| gate | meter or tripwire |
|---|---|
| `referee-eval.ts ki` | **tripwire only for this layer.** It is a real 1062-word meter on the g2p, and this layer does not touch the g2p, so its job here is to prove nothing moved. It can say nothing about any rule below. |
| `npx vitest run` / `tsc --noEmit` | real meters (regression + types) |
| `corpus-diff emit/compare` | **the real meter.** 363 utterances of this language's own text, before vs after. |
| `mine.ts scan` | real meter — 14 findings to drive to a smaller number or to classify |
| `review.ts --lang ki` | real checklist meter, plus a `sourcing` PROMPT |
| `sources.ts` | tripwire/prompt — every class is `[NONE]` or `[chk?]`; espeak has nothing |
| `attest.ts --lang ki` | the ONLY external referee for vocabulary, and ki.wikipedia IS the mined corpus, so it is not independent of it |

So the sourcing situation is `ak`/`bal`/`mos`-shaped: no espeak, no second phonetic referee, and the wiki
that must attest a word is the same wiki the corpus was mined from. Every word below is sourced from
ki.wikipedia via `attest.ts` (with the sense READ) or from a cited web source, or it is not authored.

## Run 2 — 2026-08-13 (contamination, and the number data re-measured)

**Question A.** ki.wikipedia is Kenyan. How much of the mined artifact is English or SWAHILI, and does it
land in the cells I am about to write rules from (playbook trap 34 / the su lesson)?

**Command.** Added a `ki` row to `tools/normalization/filter-by-language.py` (markers = the highest-frequency
Gĩkũyũ grammatical words; CONTRAST = ENGLISH ∪ a Swahili set), then:

```
python3 tools/normalization/filter-by-language.py --lang ki --in <artifact text> --out <ki-only>
```

**Raw finding.** Over the artifact's 372 retained segments: kept 277 (74.5%), dropped-contrast 36 (9.7%),
dropped-undecidable 59 (15.9%). Per cell (hard-set, n=8 unless stated), `ki / other / undecidable`:

```
clock      3/5/0   ← the worst cell by far
letter-name 3/3/2  ordinal-latin 3/2/3   ranges 3/2/3   ampersand 4/3/1   signs 4/1/3
decimals   6/1/1   dotted 6/1/1   percent 6/0/2   grouped 8/0/0   year 8/0/0   abbrev 8/0/0
currency   4/0/0   units 4/0/0   signed-number 7/0/0   sports-time 4/0/0
sample tier: 153 ki / 12 other / 35 undecidable of 200
```

**Implication.** `clock` is 5/8 foreign and reading the instances confirms it — `2013.07.27 (English)`
Korean news citations, `Soundtracks - il cinema alla radio, at 8:40, 15:10 and 23:00` an Italian radio
schedule. Any clock rule written from this cell would be a rule about Italian radio. The numeric cells that
matter most (`grouped`, `year`, `decimals`, `percent`, `currency`, `units`) are clean.

⚠ The `ki` row is an ADDITIVE table entry in a shared tool; no existing language's behaviour changes.

---

**Question B.** ⚠ The Shona `churu` question: does ki's shipped number data survive contact with its corpus?

**Commands.**

```
grep -oP '(?i)m[iĩ]rongo\s+\S+'  <artifact text> | sort | uniq -c
grep -oP '(?i)ma[gk]ana\s+\S+'   <artifact text> | sort | uniq -c
npx tsx tools/normalization/attest.ts --lang ki --words "mĩrongo ĩrĩ,mĩrongo igĩrĩ,mĩrongo ĩtatũ,…"
npx tsx tools/normalization/attest.ts --lang ki --words "meerĩ,matano,matandatũ,manana,mirioni,kĩbũgũ,…"
npx tsx tools/normalization/attest.ts --lang ki --after "mĩrongo,magana,ngiri,igana"
```

**Raw finding — SEVEN multiplier entries and the MILLION word were forms the language does not write.**

`attest.ts` collocation counts on ki.wikipedia, shipped form vs corrected form:

```
 3  mĩrongo ithatũ     ×0  →  mĩrongo ĩtatũ     ×3
 4  mĩrongo inya       ×0  →  mĩrongo ĩna       ×8
 5  mĩrongo ithano     ×0  →  mĩrongo ĩtano     ×2
 6  mĩrongo ithathatũ  ×0  →  mĩrongo ĩtandatũ  ×3
 8  mĩrongo inyanya    ×0  →  mĩrongo ĩnana     ×2
 2  mĩrongo ĩrĩ        ×5  (vs mĩrongo igĩrĩ ×0)   — already correct
 7  mĩrongo mũgwanja   ×1   9  mĩrongo kenda ×1    — already correct, invariant stems
```

Corroborated independently by the mined corpus, which spells four years out: `mĩrongo ĩtandatũ na ithatũ`
(1963), `mĩrongo ĩtano na inya` (54), `mĩrongo ĩna na matano` (45 countries), `mĩrongo ĩnana na mũgwanja`
(87 years). The corpus writes the shipped forms ZERO times in that slot.

Hundreds (class 6, `magana`): 2–5 were already right and are corroborated as class-6 numerals in their own
right (`meerĩ` ×20, `matatũ` ×21, `mana` ×2, `matano` ×20). 6 and 8 were NOT — the file's own comment claimed
"6–9 do not inflect", and the tens series refutes that for both. Their class-6 forms are attested bare:
`matandatũ` ×3 (*marĩtwa matandatũ*, *magũrũ matandatũ*), `manana` ×6 (*mahati manana*, *mabũrũri manana*).

MILLION: `mĩrioni` is ×0 in the 3921-paragraph corpus AND ×0 on ki.wikipedia. `mirioni` is ×14/11 with the
sense READ (*andu ta mirioni igana rimwe*, *dolari mirioni 4.33*); `milioni` ×14/12 is the same loan with the
l/r spelling this language does not distinguish. Corpus: mirioni ×8, milioni ×7.

**NEGATIVE RESULTS — things I suspected and the corpus vindicated.**

- `ithathatũ` for SIX looked like a `churu` (×0 in the artifact under that exact spelling). It is NOT. It is
  ×9/9 on the wiki and TWO independent gloss lists pin the value — one against Kamba (*itatũ >> ithatũ …
  thanthatũ >> ithathatũ … nyanya >> inyanya*), one against Somali (*Shan - ithano … Lix - ithathatũ …
  Toddobá - mũgwanja … Sidéed - inyanya*). Kikuyu simply has two stems for six, `-thathatũ` in the citation
  series and `-tandatũ` under concord; `itandatũ` appears too (*thiũ inya, ndere itandatũ, na ica inya* — a
  tetrahedron). The citation series is left untouched.
- `kĩbũgũ` (zero) ×3/2, sense READ and definitional: *ndari ya kĩbũgũ*, in the sentence stating that adding
  it to any number leaves that number unchanged. Correct as shipped.
- The `na` PLACEMENT is split 2–2 in the corpus's four spelled-out years and is NOT changed. Declaring
  either order asserts a preference the evidence does not support — the reasoning that withheld
  `magnitudes` from Shona.
- `magana meerĩ/matatũ/matano/matandatũ/manana/mũgwanja` are each ×0 as a COLLOCATION. The corrections rest
  on the class-6 multiplier being attested, not on the pairing; recorded as extrapolation in the manifest.

**Implication.** Five of eight tens multipliers wrong means every integer with a tens digit of 3, 4, 5, 6 or
8 read a form Kikuyu does not write — half of every hundred, and it feeds the `year` cell, 808 occurrences
whole-corpus. Fixed in `kikuyu.jsonc`. `kam` imports only the ALGORITHM and the TYPE from
`kikuyu/e5xNumbers.ts`, never the table, so no other language moves. The goldens in `test/kikuyu.test.ts`
that assert the old forms are asserting the bug (trap 5) and are corrected, not preserved.

## Run 3 — 2026-08-13 (the defect probe, and the one nobody was looking for)

**Question.** What does the engine actually produce on the forms this corpus writes?

**Command.** `phonemize(form, "ki")` over every attested shape (a scratch probe script, not committed).

**Raw finding.** The expected set, plus one that was not on the list:

```
2.7           → iɣeɾe . moɣwaᶮdʑa          a SENTENCE BREAK inside a number   (158 whole-corpus)
1,312         → emwɛ , maɣana matato …     one number read as two, w/ pause   (86)
29.2%         → …  sign silent             (17)     $2.7 million → … sign silent   (4)
1661 m        → … m       raw ASCII        95 lb → lβ    61 cm → ɕm     ⚠ phonemized as Kikuyu letters
193 °C        → … ɕ       the scale letter read as a PHONEME
1891-1978     → two cardinals juxtaposed   (49)     21st → … st raw   (194)
700²          → the exponent silent        7/3 → juxtaposed    8:40 → a comma pause
```

⚠ **AND THE LARGEST DEFECT IN THIS LANGUAGE IS NOT A SYMBOL AT ALL.** Enumerating every non-ASCII character
in the artifact turned up a set with no business in Kikuyu, English or Swahili:

```
ű U+0171 ×69   ī U+012B ×37   ū U+016B ×23   û U+00FB ×10   î U+00EE ×6   Î ×2   ŭ ×1
```

Reading the words they occur in settles what they are — `nyamű`, `műno`, `andű`, `gĩkűyű`, `mūndū`,
`mūtambo`, `mīaka-inī`, `kūrī`, `ūrīa`, `mûno`, `igûrû`, `kîa`, `Îri`. Every one is a Gĩkũyũ word in which
the character stands for ⟨ĩ⟩ or ⟨ũ⟩ — contributors writing the tilde vowels with whatever their keyboard
offered. **ZERO of those 148 instances is a foreign word.** Probed:

```
nyamű → ɲam     mūndū → mⁿd     kūrī → kɾ     mûno → mnɔ     kîa → ka     Îri → ɾi     íría → ɾa
```

The vowel is **DELETED** — `kikuyu.ts` consults `latinPhone` on a grapheme miss and appends `?? ""`. This is
the `bal` finding reached by a different road, and it affects **26 of 372 paragraphs (7.0%)**.

**NEGATIVE RESULT — the acute accents were measured and REFUSED.** `í` ×25 and `ú` ×14 are also tilde
stand-ins here (`ígúrú`, `búrúrí`, `andú`, `nthí`, `íría`) — but they are ALSO ordinary in the foreign names
this wiki quotes (`Fágúnwà`, `Márquez`, `Lucía`, `Ramírez`, `Yorùbá`, `exílio`). The obvious guard — "fold
only in a word carrying no accent Kikuyu never uses" — was measured: it folds 35 and about 8 of those are
foreign. **~75% is not a signature**, so the acutes are left alone and the ~23 residual deleted Kikuyu vowels
are recorded rather than repaired by a rule that would corrupt eight proper names.

**Implication.** The fold is step 1 of the layer, on the unambiguous set only. A separate, larger finding is
recorded and NOT fixed: `é á ó à è ò â ê ô ç ñ` are deleted too, in every Latin-script language with no rule
for them. That is `src/core`, it affects all 191 languages, and it must not land as a side effect of one
language's commit.

---

## Run 4 — 2026-08-13 (sourcing, one word at a time)

**Question.** Which readings can be sourced, with a SENSE READ, and which cannot?

**Commands.** `attest.ts --lang ki --words …` (several batches), `attest.ts --lang ki --after
mĩrongo,magana,ngiri,igana`, `concept.ts` (no ki labels), and web search for the classes the wiki cannot
answer.

**SHIPPED, each with the sense that was read:**

| reading | word | evidence |
|---|---|---|
| range | `nginya` | ×32/20. *"kuma 2013 NGINYA 2017"*, *"Mīaka-inī ya 1978 NGINYA 1988"* (two bare numerals), *"ũraihu wa mita 6 NGINYA 12"*. ⚠ Part-of-speech check passes: always the INFIX, never a preposition governing both operands (the Fula `hakkunde` test). |
| percent | `harĩ igana` | COMPOSED from attested pieces (`igana` = 100 in the engine's own data + the locative `harĩ`) AND attested as a collocation in exactly the slot, ×2 in 2 articles: *"gĩcunjĩ gĩa 51 HARĨ IGANA kĩa andũ nĩ andũ-a-nja"*, *"gĩcunjĩ kĩa 17 HARĨ IGANA kĩa akenya othe"*. ⚠ And the FRAME is the corpus's own — its `%` instances are written `gĩcunjĩ kĩa 29.2%`. |
| `$` | `dolari` | ×2/1, monetary and in the slot: *"mũcaara wa makĩria wa DOLARI milioni 4.35 kũgerera wa DOLARI mirioni 4.33"*. Thin, and said so. |
| `m` / `km` | `mita` / `kilomita` | ×43/19 and ×26/18. *"mahenya ma MITA 100, MITA 200"*, *"nĩ irĩ KILOMITA 871 kuuma Cape Town"*. |

**DECLINED, each with the count and the reason:**

- **decimal point** — `ndonge`, `kabungo`, `tuti`, `mũhũthĩrĩri` ×0; `koma` ×7 is the verb *to sleep*
  (*koma koma gwĩtandaiya handũ*), which is the `bar Komma` trap exactly; `ngingo` ×65 is the NECK. Web
  search of the Gĩkũyũ dictionary and numeral sources returned nothing — the check the Igbo lesson demands
  before a silence-based refusal. Separator dropped, fractional digits read one at a time (ln's resolution).
- **degree / scale** — `digirii` ×4/3 and EVERY hit is an ACADEMIC degree (*digirii ya mbere*, *digirii ya
  Bachelor*). That is `zu amaphuzu` and sn's `dhigirii`; what rescued sn was a definitional sentence naming
  the SIGN on its `Gonyo` article, and ki.wikipedia has none. `Celsius`/`Fahrenheit` ×0. ONE sentence.
- **squared / cubed** — `cukwea` ×0; `thikwea` ×1 is a transliteration of the PROPER NAME "Square Kilometre
  Array". Trap 37's shape: a real token, the wrong register. Trap 51's floor.
- **centimetre** — `thendimita`/`thentimita` ×0. `cm` ×2, one of them an English gloss of `inchi 24`.
- **`ft` / `lb` / `mph`** — every instance is an English parenthetical glossing a metric figure the sentence
  already gave (`1661 m (5450 ft)`, `kilo 30.9-72 (68-159 lb)`). ⚠ Keeps `LEAK RAW-LATIN ft ×7` RED, on
  purpose (trap 24).
- **`KSh`** — `ciringi` IS well sourced (×10/5, with a DEFINITIONAL hit, *"ciringi beca cĩa Kenya na
  mabũrũrĩ mangĩ ma Afrĩca"*). The COUNT refuses it: ×1, and typo'd (`KSh.,902,472`).
- **fractions** — the reading is written down (ki.wikipedia's `Gĩcunjĩ` article glosses 3/4 as *gĩcunjĩ gĩa
  ithatũ gĩa gĩcunjĩ gĩa inya*) but it is a DEFINITION, and the corpus's `N/N` are journal volume/issue
  (`Manja 7/3`, `Manja 27/3`), year pairs (`1960/1961`) and rates (`rev/min`). 4 genuine against 5 not.
- **clock** — the cell is 5/8 FOREIGN (Korean news datelines, an Italian radio schedule) and the genuinely
  Kikuyu `N:NN` are SPORTS TIMES. `thaa` ×18/14 is attested but attesting the NOUN is not attesting a clock.

**Implication.** Sourced: 4 readings. Declined with counts: 8 classes. Every declined class either stays
visible in `mine.ts scan` or is entered in `ACCEPTED_SIGN_SILENCE.ki` with its argument — and `degrees` and
`greater-than` are DELIBERATELY not entered, so `review.ts --lang ki` stays red on the two that are sourcing
gaps rather than absences.

---

## Run 5 — 2026-08-13 (the gates, before and after)

**Commands.** The full gate set, before/after.

| gate | before | after |
|---|---|---|
| `npx vitest run` | 242 files, 3976 tests (baseline) | **242 files pass, 3980 tests, 5 skipped** |
| `npx tsc --noEmit` | clean | **clean** |
| `referee-eval.ts ki` | 218/1062 raw, 99.4% folded, 99.9% symbol | **byte-identical** — a TRIPWIRE, and it did its job |
| `corpus-diff emit/compare` | DROP 46, all leak classes 0 | **DROP 30**, all leak classes still 0, THROW 0, **142/363 changed (39.1%)** |
| `mine.ts scan` | 14 findings | **11** — `DROP percent ×13`, `DROP currency ×5`, `LEAK RAW-LATIN st ×1` and `DROP ampersand ×8` all CLOSED; `km` 2→1; `math-sign` 14→11 |
| `review.ts --lang ki` | 1 FAIL (no normalizer) | **2 FAIL, both deliberate** — `greater-than`/`degrees` and the artifact scan's declined classes |
| `sources.ts --lang ki` | all `[NONE]`/`[chk?]` | unchanged; `review.ts` sourcing line now `[ ok ] all 3 high-traffic words attested` |
| `attest.ts` | 0 cached findings | 71+ cached, `tools/corpus/attest/ki.jsonc` committed |
| `languageCatalogue.test.ts` | stale by 1 cell | **passes** after `derive-normalization.py` + `build.py` |

**All 142 changed corpus lines were classified and read**, not just counted:

```
numeral-concord-only 39   fold 20   range 19   unit 18   decimal 15   percent 12   grouped 12
currency 4   entity 2   ordinal 1
```

Sampled readings, before → after:

- `gĩcunjĩ kĩa 29.2%` — `…kea meɾɔᵑɡɔ eɾe na kɛⁿda . iɣeɾe kea ðe` → `…kea meɾɔᵑɡɔ eɾe na kɛⁿda iɣeɾe haɾe
  iɣana kea ðe`. Two defects in one line: the false sentence break AND the silent sign.
- `andũ 600,000` — `aⁿdo maɣana iðaðato , keβoɣo` ("six hundred, zero") → `aⁿdo ᵑɡiɾi maɣana mataⁿdato`.
- `makĩria ma 2,000` — `iɣeɾe , keβoɣo` ("two, zero") → `ᵑɡiɾi iɣeɾe`.
- `934.6 m` — `maɣana kɛⁿda meɾɔᵑɡɔ iðato na iɲa . …` → `mita maɣana kɛⁿda meɾɔᵑɡɔ etato na iɲa iðaðato`.
- `mūtambo ũhũthĩkaga harī gūtūma ndūmĩrĩri` — `mtaᵐbɔ ohoðekaɣa haɾ ɣtma ⁿdmɾɾi` → `motaᵐbɔ ohoðekaɣa
  haɾe ɣotoma ⁿdomeɾe…`. Six deleted vowels restored in one clause.
- `70th Birthday` — `meɾɔᵑɡɔ moɣwaᶮdʑa ð …` (the raw `th` read as ð) → `meɾɔᵑɡɔ moɣwaᶮdʑa …`.

**TWO REAL DEFECTS WERE FOUND BY THE TESTS, NOT BY A PROBE**, which is the argument for pinning branches:

1. ⚠ **TRAP 46 FIRED ON THE FIRST RUN.** `802.11m` read as *mita 802 11*. The lookbehind stops a match
   BEGINNING INSIDE a number but the whole of `802.11` is itself a valid `\d+\.\d+` operand, so the match
   began at the FRONT. Fixed by splitting the metre arm: a DECIMAL operand must be SPACED from the
   one-letter key. Measured first — decimal metres are spaced 2/2 in this corpus, glued decimal-plus-`m`
   is ×0, glued integer-plus-`m` is ×0 — so the split costs nothing. `km` keeps the single arm because it
   is a TWO-letter key, which trap 28 explicitly requires to keep reading (`12.5km`).
2. ⚠ **AN INHERITED GUARD WAS WRONG FOR THIS LANGUAGE.** The sibling layers' de-grouping trailing guard is
   `(?!\d|[.,]\d)`, which declines to de-group `3,066.3` — a real elevation gloss here — leaving it to read
   as *ithatũ , mĩrongo ĩtandatũ na ithathatũ . ithatũ*: one number, one pause and one sentence break. Their
   guard exists because their corpora carry BOTH numeric conventions; ki's comma is a grouping mark 86 times
   and a decimal ZERO times, so ki takes the bare `(?!\d)`. **This is the run's clearest instance of the
   brief's point that the DIFFERENCES between the Bantu siblings are the useful part.**

**Implication.** Done. Committed to `norm/ki`.
