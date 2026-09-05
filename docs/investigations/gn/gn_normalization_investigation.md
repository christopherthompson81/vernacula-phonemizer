# gn (Paraguayan Guaraní) — text-normalization investigation

Language: Guaraní / Avañe'ẽ, Tupian, Latin script (the *achegety*), co-official in Paraguay.
Engine: `src/languages/guarani/guarani.ts` (+ `numbers.ts`, `guarani.jsonc`).
Artifact: `tools/corpus/mined/gn.jsonc` — gn.wikipedia dump, 35,143 paragraphs, 433 retained
(233 hard + 200 sample).

⚠ Standing limit for every count below: the artifact's whole-corpus `counts` block covers all 35,143
paragraphs, but the retained TEXT is 433 segments. A shape count taken over the retained text is a
lower bound and is adversarially weighted (the hard-set). Both are labelled.

---

## Run 1 — 2026-08-13 09:10 — baseline gates

**Command.**
```
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/gn.jsonc --lang gn
npx tsx tools/normalization/review.ts --lang gn
npx tsx tools/normalization/sources.ts --lang gn
npx tsx tools/referee-eval/eval.ts gn
```

**Question.** What does the engine do today, and which gates can even move?

**Raw finding.**

```
LEAK RAW-LATIN km  ×38     DROP percent   ×22     DROP exponent ×22
LEAK RAW-LATIN mm  ×5      DROP degree    ×13     DROP math-sign ×12
                           DROP currency  ×9      DROP minus     ×7
```

`review.ts`: 1 FAILING — `normalize.ts` missing (the only check that runs; everything downstream of it
is unreachable).

`sources.ts`: espeak does NOT ship Guaraní at all, so the letter-name / decimal-point / fraction routes
are structurally empty. `unit-word` reports the corpus writes `km×31 ha×30 mm×5 km/h×2 kg×2 m×2` after
a number. `scale-names` NONE.

`referee-eval gn`: raw exact 82/432 (19.0%), folded backbone 328/432 (75.9%), symbol accuracy 94.4%.

**Implication.**

- `eval.ts` binds gn as `phonemizeWord` (line 32, `import { phonemizeWord as gn }`), a WORD-level
  function. A `normalize.ts` symbol layer runs inside `text()` and cannot reach it. **referee-eval is a
  TRIPWIRE for this task, not a meter** — it must come out byte-identical, and if it moves I have
  touched the g2p, which is not this job.
- The **RAW-LATIN count IS the meter** (38 + 5 = 43 leaking readings), together with the DROP classes.
- ⚠ `sources.ts`'s `ha×30` is the single most dangerous line in this run. `ha` is Guaraní's coordinator
  "and" and the corpus's commonest token at ×932. Flagged for Run 4.

---

## Run 2 — 2026-08-13 09:35 — character census against the token class

**Command.** Census of every non-ASCII codepoint in the 433 retained segments, tagged with
`\p{Script=Latin}` / `\p{M}`, then probed through `getPhonemizer("gn").text()`.

**Question.** The task's standing warning: a character outside the engine's token class is DELETED and
splits its word (bal 38.9% of paragraphs, ki 7%, bm ~222 characters). Does gn have one?

**Raw finding.** The census (counts over 433 segments):

```
é 1250  ñ 1134  á 1124  ã 882  ó 567  ẽ 454  ’ 395  í 384  ĩ 373
ꞌ  301  õ 271   ý 198   ú 188  ũ 131  Ñ 98   ̃  82   ỹ 64
º  19   ° 33    ² 28    – 22   — 15   ​ 11 (U+200B)   ´ 6   ʼ 2   U+F02B 3
```

Three characters are outside what the pipeline can read, and each fails DIFFERENTLY:

| char | count | script | what happens | probe |
|---|---:|---|---|---|
| `ꞌ` U+A78C SALTILLO | **301** | Latin | matched as a LETTER by `hostWordRun(["Latin"])`, survives `makeNativiser` (no decomposition, not in `UNDECOMPOSABLE`), then `graphemes` has no key → **silently deleted** | `mbaꞌe` → `ᵐbaˈe` (vs `mba'e` → `ᵐbaˈʔe`) |
| `ʼ` U+02BC | 2 | **Common** | outside the token class → **splits the word in two** | `ñeʼẽ` → `ˈɲe ˈẽ` (vs `ñe'ẽ` → `ɲeˈʔẽ`) |
| `​` ZWSP | 11 | Common | outside the token class → **splits the word in two** | `a​b` → `ˈa b` |
| `º` U+00BA | 19 | Latin | matched as a whole WORD, no grapheme → **reads as the EMPTY STRING** | `º` → `""`, `1º` → `peteˈĩ` + `""` |

⚠ **The saltillo is the puso.** gn.wikipedia writes the glottal stop three ways — `'` U+0027,
`’` U+2019 (both already handled by `phonemizeWord`'s `replace(/[’ʼ]/gu, "'")`) and `ꞌ` U+A78C, which is
handled by NOTHING. At ×301 in 433 segments it is not a typo, it is one of the wiki's two house styles:
whole articles use it consistently (`heꞌõporã`, `Mboꞌehára`, `ñeꞌẽ`, `haꞌe`). Every one of those loses
its /ʔ/, which is a PHONEME of Guaraní, not a diacritic.

⚠ **`ʼ` U+02BC is the sharper bug even at ×2**, because `phonemizeWord` already lists it in its fold —
the fold can never run, because the TOKENIZER split the word before `phonemizeWord` saw it. A guard
written in the wrong layer (playbook trap 39's shape: the evidence has a lifetime).

**Empty-reading probe.** Over all 433 segments: **0 segments read as the empty string.** At the WORD
level, 11 tokens do: `1º ×2, 21º, 0º, 39º, 36º, 70º, 26º, 54º, 15.º` and `孔子,`. Every Latin one is the
masculine ordinal indicator `º`, which is `\p{Script=Latin}` and therefore a WORD to the tokenizer with
no grapheme behind it.

**Implication.** Three fixes, and only one of them belongs in `normalize.ts`:

- `ꞌ`/`ʼ` → `'` is a **character fold**, and it must happen before tokenization, i.e. in `normalize.ts`
  step 1 — putting it in `phonemizeWord` (where `’` lives) cannot fix `ʼ`, because the split already
  happened. Fold BOTH there and leave `phonemizeWord`'s existing fold alone as belt-and-braces.
- ZWSP is the `zero-width` cell (84 whole-corpus). Delete it; it is a line-break hint, not a phoneme.
- `º`/`ª` are the Spanish ordinal indicators and are a NORMALIZATION question (`1º` = "1st"), not a
  grapheme question. See Run 5.

---

## Run 3 — 2026-08-13 10:05 — the Jopara contamination, measured

**Command.** Added a `gn` row to `MARKERS` and a Spanish `gn` row to `CONTRAST` in
`tools/normalization/filter-by-language.py` (the language had none), then:
```
python3 tools/normalization/filter-by-language.py --lang gn --in <retained text> --out /dev/null
```
run over the whole retained text and again per hard-set CELL.

**Question.** Paraguay is officially bilingual and the written register is Jopara. `bal` measured 37.4%
non-Balochi, `bar` 24%, `ht` 15.1%. Where does gn land, and — the part that matters — does the
contamination concentrate in the cells a normalizer mines?

**Raw finding.** Whole retained text (433 segments):

```
kept (Guaraní-dominant)   366  (84.5%)
dropped: undecidable       38   (8.8%)
dropped: contrast (Spanish) 29   (6.7%)
```

hard 85.8% / 7.7% Spanish; sample 83.0% / 5.5% Spanish. So gn is **materially cleaner than bal/bar/ht
at the corpus level** — 6.7%, not 37%.

**But the per-cell breakdown is the finding, and it is not uniform:**

```
clock            12.5%  Guaraní   ← seven of eight
arithmetic       50.0%
dotted           50.0%
latin-in-native  62.5%
ordinal-latin    62.5%
year             75.0%
… every other cell 87.5–100%
```

Reading the four bad cells:

- **`clock` — 7 of the 8 hard instances are not clocks at all.** They are a Guaraní grammar article's
  SECTION NUMBERS: `3.4.10. Ñeꞌẽteko apoukapohýi (imperativo conminativo)`, `3.4.11.`, `3.4.12.` … The
  one real clock is `umi 11:00 ha 12:00 pyharekuepytépe`. The filter scored them non-Guaraní because
  they are one-line list items with a Spanish parenthetical gloss — which is right about the LINE and
  beside the point about the SHAPE. Both readings matter: the cell is Spanish-glossed AND the dominant
  shape in it is a dotted section number, not a time.
- **`ordinal-latin` — 5 of 8 are Spanish bibliography or degrees.** `109-115`, `169-180` are page
  ranges in Spanish journal citations; `1a. Edición` is Spanish; `36º` and `70º` in
  `umi paralélo 36º ha 70º mbytépe` are DEGREES OF LATITUDE, not ordinals. Guaraní's own ordinal is
  the suffix `-ha` (see Run 5).
- **`dotted` — the Spanish half is citation furniture**: `S.R.L.`, `1a. Edición`, `ISBN:`, and the era
  marker `16 a.C. peve` (*antes de Cristo*). `m.s.n.m.` (metres above sea level) likewise.
- **`arithmetic` — 0 arithmetic.** All eight are a grammar article's verb-conjugation tables
  (`karu = rekaru, okaru, jakaru…`), where `=` means "conjugates as", and pronoun lists
  (`che / nde / ñande / ore / pende`). The `=` is a GLOSS separator.

**Implication.**

1. The contamination is real but it is *lexical Spanish inside Guaraní prose* far more than whole
   Spanish paragraphs — which is Jopara behaving exactly as advertised. The rule-level consequence is
   the reverse of `bal`'s: I do not need to throw evidence away, I need to check the SENSE of every
   Spanish-looking token before refusing it and before accepting it.
2. **The `clock` cell cannot be read as evidence for a clock rule** — playbook trap 55, the `ilo`
   finding (a ceb-shaped bare-colon rule would have fixed 23 and broken 182). Measured separately in
   Run 6.
3. **The `arithmetic` cell must not produce an `=` rule.** Its `=` is a metalinguistic gloss in a
   grammar article; reading it as "equals" would say *"karu equals rekaru"* about a conjugation table.
4. `a.C.` is Spanish, and the era-marker cell is 29 whole-corpus. Deferred pending a source (Run 8).

---

## Run 4 — 2026-08-13 10:40 — the `ha` question

**Command.** `grep` for `[0-9] ha\b` and `[0-9]+ha\b` over the retained text, then read every hit.

**Question.** `sources.ts` reports the corpus writes `ha` after a number ×30 and offers it as a unit word.
Is any one of those a HECTARE?

**Raw finding.** Not one.

```
spaced  `N ha M`  ×17 — 70 ha 80% rupi · 600 ha 900 · 1523 ha 1534 · 1.400 ha 1.600 milímetro
                        (the COORDINATOR "and", the corpus's commonest token at ×932)
glued   `Nha`     ×15 — 12ha producto interno bruto · 13ha paridad · 35ha tendota · 127ha ary ·
                        11ha umi 100 Opurahéiva  (the ORDINAL SUFFIX: 12ha = "twelfth")
```

One of the fifteen glued hits is neither: `Ijapytépe 1932ha 1934` is the coordinator written tight
against a year.

The word `hectárea` is separately abundant and correct (`attest.ts` ×37 tokens / 20 articles, digit-
adjacent: `64.405 hectárea`, `9 hectárea rupi`, `30.000 hectárea`).

**Implication.** The WORD is fine and the ABBREVIATION is unusable. `ha` must never enter `units`. And the
glued form is a rule in its own right — Guaraní's ordinal — which is trap 14: `12ha` cannot be fixed by
gluing, because the digit does not become a word until the tokenizer. The `1932ha 1934` exception gives the
guard: an ordinal is never immediately followed by a bare number.

---

## Run 5 — 2026-08-13 11:15 — sourcing, and two refusals

**Command.** `attest.ts --lang gn` over five batches (37 probes); `concept.ts --items … --langs gn
--titles`; plus an independent web pass over gn.wikipedia, ABC Remiandu and Guaraní glossaries.

**Question.** Which symbols can be read, and with which word?

**Raw finding — TAKEN**, each with its sense read:

| slot | word | evidence |
|---|---|---|
| km / m / mm / cm / kg | kilómetro, metro, milímetro, centímetro, kilogramo | ×35/19, ×31/19, ×4/4, —, ×13/8. The wiki's own articles NAME THE ABBREVIATION: *"ojehechauka tai km rupive"*, *"oñemoha'anga pe tai «m» rupive"*, *"ojeporu «kg» (ndaha'éi «Kg»)"* |
| ² / ³ | cuadrado / cúbico | the COLLOCATION `kilómetro cuadrado` ×5/5; `cúbico` ×3/3 all postposed |
| $ | dólar | ×32/20, and the sense is closed: *"Dólar … ha'e hína VIRU TEE Tetãvore Joapykuéra pegua"* |
| °C / °F | Celsius / Fahrenheit | ×6/5 and ×2/2; three Guaraní-context (`ohasa rire 0° Celsius`) |
| % | por ciento | ×1 token, ×1 article — `10 por ciento kuimba'e`. The weakest word in the file |
| span | guive … peve | the corpus writes it between digits itself, ×5 (`1932 guive 1935 peve`) |
| clock | aravo | ×49/20 + a definitional article; the wiki writes `15:30 aravo` and `14.30 aravo` |
| 10⁶ | sua | ×16 digit-adjacent in the retained text (`44 sua km²`) |

**Raw finding — REFUSED**, and each refusal is a measurement:

- **the decimal separator.** Both routes independently: written Guaraní never spells one out. What both
  found instead is the PUNCTUATION MARK'S NAME, from gn.wikipedia's punctuation article and a Guaraní
  glossary that agree form-for-form — `Kyta` (punto) ×33/12, `Kyguái` (coma) ×4/2, `Kytaguái`, `Kytakõi`.
  `kyguái` even has one numeric-context use (*"pe kyguái rire hembýva"*, about `39,73`). ⚠ Declined: that
  is a good citation for the WRONG REGISTER — it is what the mark is CALLED — and the cost is asymmetric
  (a pause in 1,777 places vs a confidently wrong word in 1,777 places, in the highest-traffic rule a
  layer has). The independent researcher reached the same recommendation unprompted.
- **the degree word.** `grado` reports ×46/19 and every readable hit is Spanish — an external link marked
  "(en español)" and school-year book titles (`Segundo grado`, `cuarto grado escolar`). `kokatu` reports
  ×62/11 and sixty-one are the GRAMMATICAL degree from one grammar article's comparison paradigm
  (`Kokatu Mbojojáva` comparative). What survives is `Grádo` ×2 in ONE article. A lead, not a finding.
- **the minus word.** `menos` ×8/7 — every hit inside Spanish prose (`por lo menos` ×4). `negativo` ×4/2 —
  a photographic negative (the Boggiani glass plates) and a negative test result. Trap 37 twice.
- **the guaraní currency.** `guaraníes` reports ×19/17 and every hit is the PEOPLE or a Spanish book title
  (*Los Guaraníes* the football side, *Estudios Guaraníes*). ⚠ And `₲` is ×0 in the corpus anyway.
- **the native square word.** `Supukukue irundykejojáva` exists and appears ONLY as a piped wikilink
  target whose displayed text is still `kilómetro cuadrado` — never in text a reader voices.

**Implication.** Five refusals, five different reasons, and three of them were caught only by reading the
examples beside a healthy count. `review.ts --lang gn` will stay RED on `minus`, correctly.

---

## Run 6 — 2026-08-13 12:30 — the clock, and why the cell count is a trap

**Command.** Read the `clock` cell's eight hard instances; count `\d{1,2}:\d{2}` in the retained text;
read `cells.ts`'s regex for the cell.

**Question.** The cell reports ×158 whole-corpus. Is that 158 clocks?

**Raw finding.** The cell regex is `\p{Nd}{1,2}\s*[:.]\s*\p{Nd}{2}(?!\p{Nd})` — a DOT is accepted. In this
corpus that matches, far more often than a time:

- a grammar article's SECTION NUMBERS — `3.4.10.`, `3.4.11.`, `3.4.12.`, `3.4.13.`, `3.4.14.`, `3.4.19.`,
  `3.4.20.` — which is **seven of the cell's eight hard instances**, and why the cell measures 12.5%
  Guaraní by the language filter;
- any two-digit decimal: `3.61%` matches.

The colon form is ×3 in the retained text and all three are on the hour (`umi 11:00 ha 12:00
pyharekuepytépe`, `16:00`).

**Implication.** This is trap 55's `ilo` case, where a ceb-shaped bare-colon rule would have fixed 23 and
broken 182. A DOT-form clock rule in Guaraní would claim decimals wholesale. The rule takes the colon form
only, and only on the hour — `aravo` is richly sourced and the minute-joining frame is not (the only one
found is a language-teaching page), so a non-zero time is refused WHOLE (trap 53's `ak` model). It also
must not double a noun the text already wrote: the wiki writes `15:30 aravo`.

---

## Run 7 — 2026-08-13 13:20 — the gates, before and after

**Command.** The full gate set, with the "before" baseline emitted before any edit.

**Raw finding.**

| gate | before | after | kind |
|---|---|---|---|
| `mine.ts scan` LEAK RAW-LATIN | km ×38, mm ×5 | **km ×5, mm ×0** | **METER** |
| `mine.ts scan` DROP percent | ×22 | **×0** | meter |
| `mine.ts scan` DROP exponent | ×22 | **×0** | meter |
| `mine.ts scan` DROP currency | ×9 | **×0** (2 → REDUNDANT, a note) | meter |
| `mine.ts scan` DROP degree | ×13 | ×5 (coordinates — declared refusal) | meter |
| `mine.ts scan` DROP math-sign | ×12 | ACCEPTED-CLASS ×12 (argued in `defects.ts`) | meter |
| `mine.ts scan` DROP minus | ×7 | ×7 — **deliberately unchanged** | tripwire (stays red) |
| `corpus-diff` DROP total | 73 | **23** | meter |
| `corpus-diff` changed | — | 181/430 (42.1%) | meter |
| `corpus-diff` DIGIT/SLOT-GAP/RAWMARK/ZERO-WIDTH/RAW-CAPS/THROW | 0 | **0** | tripwire — held |
| `referee-eval gn` secondary (kaikki 432) | 82/432 · 328/432 · 94.4% | **identical** | **TRIPWIRE — held** |
| `referee-eval gn` primary (wikipron 348) | 0/348 · 263/348 · 94.9% | **identical** | tripwire — held |
| `npx vitest run` | 4026 pass | 4026 pass + 22 new gn | tripwire |
| `npx tsc --noEmit` | clean | clean | tripwire |
| `review.ts --lang gn` | 1 FAIL (no normalizer) | 2 FAIL (minus; artifact scan) | both sourced refusals |

⚠ **`referee-eval` IS A TRIPWIRE HERE, NOT A METER, and it was named as one before the work started.**
`tools/referee-eval/eval.ts` binds gn at line 32 as `import { phonemizeWord as gn }` — a WORD-level
function. A `normalize.ts` layer runs inside `text()`, downstream of it, so no symbol rule can reach the
referee. It coming out byte-identical is the evidence that the g2p was not touched; had it moved, that
would mean I had changed something outside this job.

⚠ **`onnx-optional.test.ts` did not time out** on this run.

**The token-level diff over all 181 changed utterances** (rather than the tool's 12-line sample):

```
ADDED    kilómetro ×44 · por ciento ×35 · Celsius ×31 · cuadrado ×26 · guive/peve ×10 each ·
         dólar ×8 · centímetro ×6 · milímetro ×5 · and ~90 restored puso tokens
         (haʔe ×14, ñeʔẽ ×9, paʔi ×8, mbaʔe ×8, avañeʔẽ ×7, mboʔehára ×5 …)
REMOVED  "." ×109  ← false SENTENCE BREAKS inside grouped numbers, the single biggest win
         mba'eve ×50 ← "nothing", i.e. a `.000` group read as the number zero
         km ×50 · k ×31 (the stray Celsius consonant) · ʔ ×5 (the INVENTED glottal stop) ·
         mm ×4 · m ×4 · every DROP annotation
```

The six utterances with the largest token loss were read individually and every one is a repair:
`pateˈĩ ᵐbaʔeˈʋe ᵐbaʔeˈʋe km moˈkõi` ("eleven nothing nothing K-M two") → `pateˈĩswa kiˈlometɾo
kwadɾaˈdo` (11 million square kilometres). No regression was found in either direction.

---

## Run 8 — 2026-08-13 14:05 — a test found a real gap

**Command.** `npx vitest run test/guarani.test.ts`.

**Question.** Do the branch-level tests (trap 13) pass?

**Raw finding.** Four failures. Three were my own wrong expectations (the engine reads 65000 as
`poteĩpa posu`, not `popasu`; `3.61%` reaches the percent tier before the assertion). **The fourth was a
real gap**: I had typed U+00A0 into the test literal `21 696`, and my space-grouping character class
carried the ASCII space, U+202F and U+2009 but **not U+00A0**. It passed on the corpus only because
`stripMarkup` decodes the `&nbsp;` ENTITY to a plain ASCII space before this layer runs — so the class was
correct for the decoded form and blind to a dump carrying the raw character.

A second test failure exposed the same shape in the `º` rule: a digit lookbehind missed the corpus's own
`15.º` (a dot between) and `Nº`.

**Implication.** Both rules widened; both fixes are in the file with the reason. This is the playbook's
"probe the adversarial neighbour" (trap 8) arriving through a test rather than through a grep — and the
`º` one is the better lesson, because `º`/`ª` have no reading in Guaraní AT ALL, so the tight guard was
buying nothing and costing coverage.

**Residual, resolved one at a time (trap 54) — none is a missing key.** `435 km²`, `2.294 km²`,
`246.925 km²` and `1.483 mm` all read. The five that remain are: a COMMON-NOUN NUMERATOR (`9,9 ava/km2`,
population density — bar's row, and its ASCII form additionally reads the `2` as the NUMBER two, ig's trap
53 shape); the RATE `115 km/h`, declined whole for want of a sourced "per", which leaves a stray [h]; and
`400 mm/año` with a Spanish denominator. Recorded in `normalize.ts`.
