# Uyghur (ug) text-normalization investigation

Worktree `norm/ug`. Method: `docs/normalization_playbook.md`.

## Run 1 — 2026-08-11 (baselines, before any edit)

**Question.** What is the pre-change state of every gate, so the "after" numbers mean something?

Commands and raw findings:

```
$ npx tsx tools/normalization/corpus-diff.ts emit --lang ug --corpus mined:ug --out $TMP/ug.before
emitted 428 utterances → $TMP/ug.before

$ npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/ug.jsonc --lang ug
DROP percent       ×50
DROP math-sign     ×27
DROP degree        ×20
DROP minus         ×17
DROP exponent      ×14
DROP currency      ×11
DROP ampersand     ×3
FOREIGN degree     ×1
FOREIGN ampersand  ×1

$ npx tsx tools/referee-eval/eval.ts ug
raw exact: 2627/2674 (98.2%)   symbol accuracy 99.7%

$ npx tsx tools/normalization/review.ts --lang ug
[FAIL] normalizer  src/languages/uyghur/normalize.ts missing     (1 FAILING)

$ npx tsx tools/normalization/sources.ts --lang ug
espeak: NOT SHIPPED for ug.  letter-names NONE, decimal-point NONE, scale-names NONE,
fraction-series NONE; percent/currency/minus/equals/times/ampersand/plus/exponent all `chk?`.
```

**Implication.** ug has a mature engine (✅, 98.2% raw exact vs wikipron) and NO normalizer at all — the
missing layer is exactly this one. espeak ships nothing for Uyghur, so the haystacks are: the mined
ug.wikipedia artifact (66,091 paragraphs), the wikipron referee word list, and `attest.ts` against
ug.wikipedia. Every word I put in a speaker's mouth has to come from one of those three or from a cited
web source.

## Run 2 — 2026-08-11 (reading the corpus)

**Question.** What does Uyghur actually write, and which of it does the engine currently mis-read?
Instrument: `tools/corpus/mined/ug.jsonc` — 429 segments (229 hard + 200 sample) out of a 66,091-paragraph
ug.wikipedia dump; `counts` are dump-wide, everything else is over the 429.

Raw findings (`.scratch/measure.mts`, `m2`–`m5`):

```
digit + hyphen + Uyghur word              390    يىلى×132 ئاينىڭ×36 كۈنى×26 يىلىدىن×16 يىللىق×11
                                                 ئەسىردىن×8 يىل×8 ماددا×7 ئەسىردە×6 م×6 ئايدا×6 …
spelled-out ordinals in prose              23    بىرىنچى ئىككىنچى ئۈچىنچى بەشىنچى يەتتىنچى توققۇزىنچى
                                                 ئون بەشىنچى يىگىرمىنچى
percent sign                              129    N% ×72 · %N ×56 · with a BOUND SUFFIX ×59
decimal point `.`                        ~199    D.D ×128 · D.DD ×53 · D.DDD ×18
grouping ،  ×21   grouping ,  ×11         (D،D with 1–2 trailing digits: ×0 — ، is NEVER a decimal)
℃ ×45 · ° ×46 (40 of them coordinates)    °C ×3
كم²/km² ×20      ￥ ×8   ₺ ×6   $ ×2
= ×39   + ×8   × ×3   & ×9   ～ ×15   : ×134 (clock HH:MM only ×3)
digit–digit ranges ×47
ASCII digit runs ×1957 · Extended Arabic-Indic ۰-۹ ×1 · Arabic-Indic ٠-٩ ×0
Arabic PRESENTATION FORMS  2,367 characters across 8 of 429 segments
ه U+0647 ×40 (vs ھ U+06BE ×1099)   ZWNJ ×15  ZWSP ×11  &nbsp; ×4
```

**Implications, one per line.**

1. **The defining rule is the HYPHENATED ORDINAL — 390 instances in 429 segments.** Uyghur writes its
   ordinal as `numeral + hyphen + noun` (`1949-يىلى`, `9-ئاينىڭ`, `5-ئەسىردە`, `306-ماددا`) and the corpus
   GLOSSES ITSELF: it writes `15-ئەسىردىن كېيىن` and `ئون بەشىنچى ئەسىرىدىن باشلاپ`, `5- ئەسردە` and
   `بەشىنچى ئەسىردە`, `7-ئەسىردىن` and `يەتتىنچى ئاسىردىن`, `12 -ئورۇندا` and `توققۇزىنچى ئورۇندا`. That
   is the same self-glossing attestation the Pashto era markers rested on. The engine currently drops the
   hyphen and reads a bare CARDINAL.
2. **The digit-system hazard resolves the other way from `ps`.** Uyghur writes ASCII digits — 1,957 against
   ONE Extended Arabic-Indic run in 429 segments, and the artifact's own note says `\d` would miss 13 of
   13,772 dump-wide. So this is not `ps`'s problem; but the class is still written out explicitly, because
   the engine's `TOKEN` is ASCII-only and those 13 runs would leak.
3. **The two separators do not overlap at all** — `،`/`,` group, `.` decimalises, and `D،D` with 1–2
   trailing digits is ×0. That is a cleaner split than any of the Perso-Arabic precedents had.
4. **8 of 429 segments are Arabic PRESENTATION FORMS and are 100% unreadable** — the engine's TOKEN class
   is U+0620–U+06FF, so U+FB50–U+FEFF matches nothing and every letter is deleted.
5. `تەڭ` ×5 whole-word is the ADJECTIVE "equal" in every instance (`كۆلىمىگە تەڭ`, `تەڭ ھوقۇقلۇق`,
   `تەڭ پايدا`), never digit-adjacent — trap 37 exactly, so `=` gets no reading.
6. Only 3 `HH:MM` in 429 segments and all three are wiki signature timestamps (`20:39, 30 دېكابىر 2006
   (UTC)`). There is no clock class in Uyghur here.

## Run 3 — 2026-08-11 (sourcing every word before writing a rule)

**Question.** Which of the words a rule would need can be sourced, and which must be refused?
Commands: `attest.ts --lang ug --words …` (twice, with a wait between — ug.wikipedia returns 429 under
the fan-out), plus greps over the mined artifact and over
`tools/referee-eval/referees/ug.wikipron-uig-arab.tsv`.

```
word        wiki tok/arts   corpus   referee   sense read from the examples
پىرسەنت      31 / 9          –        –        `12.06 پىرسەنت بولغان`, `6.83 پىرسەنت ئاشقان`  IN SLOT, postposed
پېرسەنت       3 / 2          ×2       –        `92 پېرسەنت`; corpus `44 پېرسەنتىنى`, `90 پېرسەنت` IN SLOT
گرادۇس       33 / 14         ×1       –        ALL 33 are the degree of ARC (`90 گرادۇس شىمال پارالېلى`);
                                               the corpus's ×1 is TEMPERATURE (`50-گرادۇسقا يېتىدۇ`)
كۋادرات      54 / 14         ×27      –        `960 مىڭ كۋادرات كىلومېتىر` — PREPOSED, and the corpus
                                               writes both this and `كم²` (it glosses its own symbol)
يۈەن         86 / 19         ×8       –        monetary in `297 مېليون يۈەن`, `5000 يۈەنگە`; ⚠ the bare
                                               token is also the Yuan DYNASTY (trap 37)
لىرا          9 / 7          ×7       –        `₺10 (لىرا)` — the wiki glosses the SIGN itself
دوللار       40 / 10         ×56      ✓        everywhere digit-adjacent
مىنۇس         7 / 5          –        ✓        `يىللىق خاتالىق مىنۇس 0.9 دەقىقە` — PREPOSED, in front of a
                                               quantity; and `مىنۇس بەلگىسى` for the sign's name
پۈتۈن        36 / 15         ×2       –        ✗ the ADJECTIVE "whole/entire" in all 36
نۇقتا        11 / 9          –        ✓        ✗ the geometric/geographic POINT in all 11
چېكىت         5 / 4          –        –        ✗ the written DOT as a mark (`ئۈچ چېكىت (؞)`)
تەڭ           –              ×5       ✓ ×4     ✗ the ADJECTIVE "equal", never digit-adjacent
سېلسىي        0 / 0          ×0       –        ✗ absent
ئونلۇق كەسىر  0 (substring)  –        –        ✗ substring-only
```

**Implication.** The percent, degree, squared, minus and all three currency words are sourced in slot. The
DECIMAL POINT is not, and it is the highest-traffic slot in the layer — but the three candidates fail on
SENSE, not on silence, which the playbook says is the refusal that stands without a further dictionary
check. `پۈتۈن` is the trap: Uzbek's cognate *butun* IS that language's decimal word, and 36 Uyghur hits say
"whole/entire". So the point becomes a SPACE and no word is invented.

## Run 4 — 2026-08-11 (writing the layer, and the four things the gates caught)

Thirteen ordered steps; the file's header carries the reasons. Four defects were found by running
something rather than by reading, and each is worth keeping:

1. **The era rule typechecked, ran, and did nothing.** The body pattern stopped at `ب` and the corpus
   writes `م.ب. 55` — a dot after EACH letter — so `م.ب. 55 - م.ك. 410` still read `m . p . … m . k .`.
   Found by probing the corpus's own line instead of the shape I had in mind.
2. **The percent rule left the sign unread on exactly the 20 cases it most needed to.** Written as
   `(SUFFIX)?(?![\p{L}\p{M}])`, the guard applies to the WHOLE match, so `%پورتۇگال` — an ordinary word
   after the sign — matched nothing at all. Moving the guard INSIDE the optional bracket lets the
   alternation backtrack to "no suffix".
3. **The Arabic percent sign `٪` U+066A was missed.** ×4 only, and they were precisely what
   `mine.ts scan` still reported as `DROP percent` after the ASCII arm landed. `﹪` and `％` are ×0.
4. **The presentation-form fold got the HEH wrong, and only the corpus diff's SAMPLE tier could see it.**
   `ﺧﻪﻟﻖ` (خەلق, "people") came out *χhlq* for *χɛlq*: the legacy encoding uses the PLAIN heh forms for the
   VOWEL ە U+06D5 and the heh-goal forms for the CONSONANT ھ U+06BE, and NFKC flattens both onto ه U+0647,
   which step 4 then reads as /h/. ە has no initial or medial shape in Uyghur, so ISOLATED/FINAL plain heh
   is the vowel and INITIAL/MEDIAL is the consonant; `ﻫﻪﺳﻪﻥ` (ھەسەن) carries both in one word. After the
   fix, `phonemize("ﺧﻪﻟﻖ ﻫﻪﺳﻪﻥ ﻫﯜﺳﻪﻧﻨﻰ ﺋﺎﺯﺍﺩﻩ ﻣﺎﮬﯩﺮﻯ")` is byte-identical to the modern spelling.

Two smaller ones from the artifact scan, both closed: a MAGNITUDE WORD between the number and its unit
(`10 مىڭ كم²`) left the unit non-adjacent, and a spelled-out unit noun with a bare `²`
(`36.6 مىلىيون كىلومېتر²`) is reachable by no symbol key at all.

## Run 5 — 2026-08-11 (the gates, before → after)

```
                          BEFORE                       AFTER
corpus-diff (mined:ug)    DROP 111                     DROP 48        237/428 utterances changed (55.4%)
                          DIGIT/SLOT-GAP/RAWMARK/THROW all 0 on both sides; nothing REGRESSED
mine.ts scan              percent 50 · math-sign 27    minus 1        (+ ACCEPTED: math-sign 27, minus 16,
                          degree 20 · minus 17                         ampersand 4, currency 1, percent 1)
                          exponent 14 · currency 11
                          ampersand 3
referee-eval ug           2627/2674 (98.2%), 99.7%     UNCHANGED, byte for byte
review.ts --lang ug       1 FAILING (no normalizer)    1 FAILING (the one refusal below)
npx tsc --noEmit          clean                        clean
npx vitest run            1 failing (catalogue, stale) all pass
```

⚠ **THE CORPUS DIFF COULD NOT COMPARE ITS OWN OUTPUT AT FIRST**, and the reason is the fix showing up as a
tool failure: `compare` filters empty lines, the two presentation-form segments read as the EMPTY STRING
before this layer, so "before" had 426 lines and "after" 428 (`length mismatch — different corpora?`).
Padded both sides with a sentinel to compare; the same ruler on both sides, only the engine differing.

⚠ **THE ONE REMAINING RED IS DELIBERATE** (trap 24 — do not fix the FAIL). `DROP minus ×1` is
`ياۋروپا ۋاقتى(-2ۋاقىت رايونى)`, a real UTC offset, which the playbook's audio tier says IS voiced. One
instance is not enough to widen a guard that 28 counter-examples argued for (19 range dashes, 9
clause-opening dashes), so it stays visible rather than accepted. The other 16 minus lines, and the
ampersand / currency / percent residue, are listed in `defects.ts` — per INSTANCE where the layer does read
the class, per CLASS where it does not.

⚠ **`review.ts` reports `[??] sourcing — no percent/currency/decimal word declared`**, and that is trap 42's
shape rather than a real absence: the check looks for a `makeSymbolNormalizer({…})` declaration, and this
layer owns its symbol table locally (trap 47 reason 3 — the shared tier runs AFTER normalize and this file
spends the decimal point). The words are sourced in Run 3 above and cited at each rule.

**Declined, with counts:** the decimal-point WORD (~199/429, 1,533 dump-wide — three candidates, all wrong
on sense); `=` ×39 (`تەڭ` is the adjective); `+` ×8 and `×` ×3 (contaminated); `&` ×9 (markup/English);
ranges ×47 and `～` ×10 (the connective is a circumfix, not an infix); the clock (×3, all wiki timestamps);
fractions (×15 slashes, 1 real); initialisms (678 dump-wide — espeak ships no Uyghur, so no letter names);
the regnal ordinal (225 romans, all 8 in the artifact regnal — `core/roman.ts` spends the numeral upstream
in `registry.ts`, which is a shared-file question); space grouping (1 candidate in 429 segments).

**Accepted costs, counted:** 4 of the 390 hyphen-ordinals are claimed wrongly — `50-گرادۇسقا` ("50 degrees",
×1) and the second operand of a page range (`70 -90-بەتلەر`, ×3). The alternative is a closed noun list,
which is trap 8's table: the tail of that tally is 76 distinct nouns and 40 of them occur once.
