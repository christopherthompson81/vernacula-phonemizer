# ti (Tigrinya) text-normalization investigation

Working log for the normalization layer on `ti`. Chronological, one entry per run. Negative results are
kept deliberately — several of them are the load-bearing evidence for a rule's shape or for a refusal.

The near neighbour is `am` (Amharic): same Ge'ez/Fidäl script, same shared `core/geez.ts` engine. **Every
Amharic rule was treated as a hypothesis and re-measured against ti's own corpus**, and the re-measurement
is the substance of Run 3. Seven of them did not survive.

Evidence base: `tools/corpus/mined/ti.jsonc` — a ti.wikipedia dump artifact, 1,338 segments, of which the
committed artifact carries 154 hard + 200 sample = **323 deduplicated lines**. Dump-sourced, so the sample
tier is the language's real distribution.

⚠ **THE REFEREE IS NOT A METER HERE.** `kaikki tir` (human) carries 26 entries and `wikipron tir` carries
0, so `referee-eval.ts ti` runs against **epitran tir-Ethi**, a rule-based G2P — a *secondary* referee that
is a second opinion, not ground truth. It is also **word-level**: it reads a 898-word list, never a
sentence, so no normalization rule can move it at all. It is a **tripwire** for this work (it proves the
g2p was not disturbed), never a meter. Which gates are meters is stated in Run 9.

---

## Run 1 — 2026-08-12 09:20 — the artifact, and the first thing to check on a Ge'ez language

**Question.** Is ti's sentence terminator reachable? Commit `b9ccace` found Sylheti's terminator undeclared
*and its declarations unreachable*, because the marks sat inside the Unicode range the word class claimed.
Ethiopic has exactly that shape: the syllabary and its punctuation share one block.

**Command.**

```
python3 -c "for c in '።፣፤፥፦፧፨፡፠፩፲፻፼': print(c, hex(ord(c)))"
grep -n 'TOKEN' src/languages/tigrinya/tigrinya.ts
```

**Raw finding.** `tigrinya.ts` has `TOKEN = /([ሀ-ፚ]+)|(\d+)|([።፣፤፥፦፧፨.?!,;:])/gu`. The letter class is
`ሀ`–`ፚ` = **U+1200–U+135A**. The punctuation sub-block is U+1360–U+1368 and the numerals U+1369–U+137C,
both **above** the class. So the punctuation branch is reachable, and a probe confirms it end-to-end:

```
ሰላም። ከመይ → "səlam . kəməj"      ሰላም፣ ከመይ → "səlam , kəməj"      ሰላም፧ ከመይ → "səlam ? kəməj"
```

All seven declared marks fire. `፨` fires too, at ×0 in the corpus. `፠` (U+1360, section mark) is undeclared
and is ×0.

**Implication.** **NOT the Sylheti defect.** ti's own artifact records `backfill: { "native-terminator": 333 }`
— 333 of 1,338 segments carry one — and every one of them reaches a declared pause. Nothing to fix here, and
the `am` comment warning "DO NOT widen this to the full block" is correct and applies unchanged to ti.

The same measurement says the **numerals are outside every branch**, which is Run 2.

---

## Run 2 — 2026-08-12 09:45 — probing for the EMPTY READING

**Question.** The `ug` and `bal` runs both found segments reading as the empty string because characters fell
outside the token class; `bal`'s missing letter was 39% of its corpus. Does ti have one? Ethiopic numerals
`፩፪፫…፻፼` are U+1369–U+137C — outside `[ሀ-ፚ]`, outside `\d`, outside the punctuation branch.

**Command.** `phonemize(x, "ti")` over every numeral shape the artifact contains.

**Raw finding.**

```
"፻፲"           → ""          "፬"    → ""     "፳፭፻"  → ""     "፩፱፱፱" → ""
"፻፲ ኪሎሜተር"     → "kilometəɾ"                  ← the number VANISHES, the noun survives
```

Byte-for-byte empty. `\p{Nd}` does not match them either — they are `No` (other number), so any rule keyed on
`\p{Nd}` or `[0-9]` is blind to them, which is the `ps`/`as`/`my` hazard (`fdab9b1`, `e5a3716`) in its
Ethiopic form.

Counted over the 323 artifact lines: **20 occurrences**. Contexts are ordinary encyclopedic prose — an
elevation (`፳፭፻ ሜትሮ`), a distance (`፻፲ ኪሎሜተር`), temperatures (`፶፭°C`, `፭°C`, `፩፭°C`), dates
(`፪፩ ነሓሰ ፩፱፪፭`), a school roll (`፪፯ ተመሃሮ ፩፱ ተኻፊሎሞ`), an ordinal (`፮ይ ክፍሊ`).

**Implication.** A real defect of the `bal` class, 20 instances, and the *only* one where the language's own
script is being erased. It must be read. **How** to read it is Run 4 — and the answer is not arithmetic.

---

## Run 3 — 2026-08-12 10:30 — re-measuring every Amharic rule against ti's corpus

**Question.** `am`'s `normalize.ts` has 16 numbered steps. Which of them are facts about the Ge'ez script,
and which are facts about *Amharic*? The task brief warned that a sibling re-measurement in the `rn` run
failed seven rules. Treat each as a hypothesis.

**Command.** A tabulation over the 323 artifact lines (`python3` with explicit `[ሀ-ፚ]` lookarounds, never
`\b` — trap 1), plus `phonemize` on each attested surface form.

**Raw finding.** Per Amharic step:

| am step | am's rule | ti count | verdict |
|---|---|---:|---|
| 1 | `፡፡` → `።` | 1 | **survives** (also `::` ×1) |
| 2 | `\d፡\d` time separator | 1 | **survives**, narrowly — `ሰዓት 10፡00 ቅድሚ ቐትሪ` |
| 3 | dotted abbreviations | 71 | **survives** |
| 4 | lone `፡` → `,` | **910** | **survives, and is ti's LARGEST defect** |
| 5 | de-grouping, comma only | 66 comma + **4 period** | **FAILS** — ti groups with the period too |
| 6 | clock on ASCII `:` | 0 real | **FAILS** — ti's only `d:dd` is a scripture citation |
| 7 | `12.00 GMT` clock | 0 | **FAILS** — absent |
| 8 | range in the `ከ` frame | 5, in the `ካብ` frame | **re-keyed** — ti's frame is `ካብ … ክሳብ` |
| 8b | `US$`/plural-currency workarounds | 0 | **FAILS** — absent |
| 10 | decimals, `ነጥብ` | 57 | **survives**, different word (`ነጥቢ`) |
| 11 | ordinal suffix `ኛ` | **0** | **FAILS** — ti writes `Nይ` ×22 and `መበል N` ×35 |
| 12 | squared, `ካሬ` before the unit | 2 | **re-worded** — ti's own word is `ትርብዒት` |
| 13 | `ኪሜ` → `ኪሎ ሜትር` | 15 | **survives**, ti spells it `ኪሎ ሜተር` |
| 14 | `°` → `ዲግሪ` | 10 | **survives**, same word |
| 15 | `+` → `ፕላስ` | 1 | **declined** — see Run 7 |
| 16 | `<` `>` `÷` `=` | 0 real | **FAILS** — the `=` ×2 are wiki markup and a URL |

**Seven Amharic rules do not survive re-measurement** (steps 5-as-written, 6, 7, 8b, 11, 15, 16), and one
more (8) needed re-keying to a different frame word. The ordinal is the sharpest: Amharic's whole
`ORDINAL` table plus its "consonant-final cardinal takes its 1st-order counterpart" morphology has
**zero** instances in Tigrinya, which uses an entirely different (Semitic pattern) ordinal series.

**⚠ The ordinal is also this language's version of the Haitian/Bavarian contamination trap.** Amharic's
`ኛ` suffix and its table are perfectly good Ge'ez script; nothing about the *rendering* says they are
wrong for ti. Only the count does.

**Implication.** Write the layer from ti's corpus, borrowing only the eight rules the count justifies.

---

## Run 4 — 2026-08-12 11:15 — how to read an Ethiopic numeral, when the corpus writes the system TWO ways

**Question.** Ethiopic numerals are **additive, not positional, and have no zero** (`am`'s own file says so
and declines them on that basis). To read `፻፲` as 110 needs an evaluator. Is that safe?

**Command.** Read all 20 instances in context.

**Raw finding.** **The corpus writes the same number both ways, in one parenthesis:**

```
እቲ ካብ ፪፬፬፬(፳፻፬፻፵፬) ልዕሊ ጽፍሒ ባሕሪ ንላዕሊ ዘሎ ቦታ ደጋ ይብሃል
```

`፳፻፬፻፵፬` is **proper additive** Ge'ez: 20×100 + 4×100 + 40 + 4 = 2444. `፪፬፬፬` is the digits **2-4-4-4**
typed one glyph per Arabic digit. They are the same number and the author wrote both. Sorting the other 18:

* **proper additive** — `፻፲` (110), `፳፭፻` (2500), `፶፭` (55), `፭` (5), `፬` (4), `፮` (6), `፳፻፬፻፵፬` (2444)
* **positional misuse** — `፩፱፱፱` (1999; proper would be `፲፱፻፺፱`), `፩፭` (15; proper `፲፭`), `፪፯` (27; proper
  `፳፯`), `፪፩` (21), `፩፱` (19), `፩፶፬` (154), `፳፩፩` (2011-ish, mixed)

**Implication.** **An arithmetic evaluator would be confidently wrong on the majority of instances** — it
reads `፩፱፱፱` as 1+9+9+9 = 28 where the author meant 1999. There is nothing in the text that separates the
two conventions. So: **do not evaluate. Read each numeral CHARACTER as its own value word.** That is faithful
under both conventions, invents no value, and needs no new vocabulary — every value word is already in
`tigrinya.jsonc`.

**And the wiki confirms the per-character reading is the right one.** ti.wikipedia's own numeral pages gloss
them with exactly these words:

```
ሚእቲ ቁጽሪ ፻።                 ("ሚእቲ [hundred] is the number ፻")
ሓሙሽተ ሚእቲ ቁጽሪ ፭፻።          ("ሓሙሽተ ሚእቲ [five hundred] is the number ፭፻")
```

`፭፻` → `ሓሙሽተ ሚእቲ` is **character-by-character** — which is what this rule emits. Sourced, not invented.

**Stated limit, recorded in the rule:** for a proper additive numeral the words and their order are right but
the additive `ን` conjunction is not applied (`፻፲` → `ሚእቲ ዓሰርተ`, where full Tigrinya is `ሚእትን ዓሰርተን`). That
is a prosodic imperfection replacing a total silence, and applying the conjunction would require committing
to the additive reading, which Run 4 has just shown is wrong for over half the instances.

**Corroborating negative, kept:** Gaim (arXiv:2601.03403), the paper this manifest already cites for its
cardinals, states *"While Ge'ez numerals exist in historical and religious scripts, modern Tigrinya uses the
Arabic numerals."* True and consistent — 20 numerals against 437 digit-runs. It is not a reason to leave the
20 silent.

---

## Run 5 — 2026-08-12 12:00 — sourcing, and three refusals

**Question.** `sources.ts --lang ti` reports `letter-names NONE (espeak does not ship this language at all)`,
`decimal-point NONE`, `percent-word chk?`, `currency-word chk?`, `minus-word chk?`, `ampersand-word chk?`.
With kaikki=26 and wikipron=0 there is effectively no referee, so every word must be sourced from the corpus,
`attest.ts`, or a citable external source — and left unauthored otherwise.

**Commands.** `attest.ts --lang ti --words …` (four batches), a corpus collocation tabulation, and two web
searches. Full attest output is cached in `tools/corpus/attest/ti.jsonc`.

**Raw finding — what closed.**

| slot | word | evidence |
|---|---|---|
| percent | `ሚእታዊት` | corpus ×2 + wiki ×2 (`ዓቢ ሚእታዊት ካብቶም …`, `ናይ ዝልከፋ ሚእታዊት ደቀኣንስትዮ ካብ 5% ክሳዕ 70%`) **+ Gaim Table 1 names it as the percent word** |
| decimal point | `ነጥቢ` | **Gaim** (`ነጥቢ /näTbi/ (point)`) — see the refusal note below |
| degree | `ዲግሪ` | wiki ×16, and **number-adjacent in the angular sense**: `30 ዲግሪ ጽላታት`, `360 ዲግሪ ዝዓቐኑ` |
| squared | `ትርብዒት` | corpus ×7, wiki ×11, always **BEFORE** the unit: `916,445 ትርብዒት ኪ.ሜ`, `172,300 ትርብዒት ማይል` |
| km | `ኪሎ ሜተር` | corpus writes it out ×6 (`ኪሎሜተር` ×3, `ኪሎ ሜተር` ×3) beside `ኪ.ሜ` ×15 — trap 38, the word was already there |
| `$` | `ዶላር` | corpus ×6 in monetary amounts (`1.65 ቢልዮን ዶላር`, `ልዕሊ 1 ትሪልዮን ዶላር`), wiki ×12 |
| `£` | `ፓውንድ` | corpus ×3 (`800 ፓውንድ`, `3.15 ፓውንድ`), wiki ×3 |
| `€` | `ዩሮ` | wiki ×2, of which **one** is the slot (`222 ሚልዮን ዩሮ ዝውውር`) and one is the football tournament `ዩሮ 2024` |
| era `ቅ.ል.ክ` | `ቅድሚ ልደተ ክርስቶስ` | **corpus writes it out in full ×12**, wiki ×28 |
| era `ድ.ል.ክ` | `ድሕሪ ልደተ ክርስቶስ` | wiki ×3, all `Nይ ክፍለ ዘመን ድሕሪ ልደተ ክርስቶስ` — the exact slot |
| ordinals 1–5 | `ቀዳማይ ካልኣይ ሳልሳይ ራብዓይ ሓምሻይ` | corpus ×31/×29/×13/×7/×1 |
| ordinals 6,8,10 | `ሻድሻይ ሻሙናይ ዓስራይ` | wiki ×1/×2/×1, right sense each (`እቲ ሻድሻይ እምነት`, `ኣብ ሻሙናይ ደረጃ`, `ዓስራይ ክፍሊ`) |
| ordinals 7,9 | `ሻውዓይ ታሽዓይ` | **Gaim Table 1 only** — see below |

**Raw finding — what did NOT close, with counts.**

* **`ናቕፋ` (nakfa, the Eritrean currency) — REFUSED.** ×5 in the corpus and **every one is the TOWN of Nakfa**
  (`ናቕፋ ብድፋዓት ተኸቢባ ትርከብ`, `ንከተማ ናቕፋ ምስ ኣተዉ`). Trap 37 exactly. No `Nfk` sign occurs anyway.
* **`ብር` — REFUSED**, ×41 and effectively all inside longer words (`ክብርኻ`, `ክብርን`), the same finding `am`'s
  file already records for itself.
* **ampersand — REFUSED for want of a SIGN, not a word.** `&` ×27, and **not one is a Tigrinya ampersand**:
  13 are `&nbsp;`, 11 are numeric entities (`&#x5B;`, `&#x2013;`), and the remainder are inside English
  strings (`Shoe Shine & Piano`, a mangled `R & amp;B`). Wiki markup that survived the dump extraction.
* **`=` — REFUSED, same reason.** ×2: one inside an English gloss `(= divide and conquer)`, one inside a URL
  query string. `ማዕረ`, the Tigrinya word for "equal", is attested ×9 — the *word* is available and the
  *sign* does not occur in Tigrinya text. Trap 48's shape.
* **`ዓ.ም` — REFUSED.** ×19, and `ዓመተ ምሕረት` is **absent from ti.wikipedia** (0 token, 0 substring). Left as a
  letter-run, which is what `am` does with the identical marker.

**⚠ The decimal point deserves its own note, because the corpus argues against it.** `ነጥቢ` is attested ×6 in
the corpus and ×19 on the wiki and **not one instance is a decimal separator** — they are point-of-sale
(`ነጥቢ መሸጣ`), a geometric point (`ነጥቢ B`), a score, and a place (`ዝወሓደ ነጥቢ ኣብ መሬት`). On the corpus alone
that reads like Zulu's `amaphuzu`. It is not the same case: **Zulu's was a refusal on SENSE, this would be a
refusal on the absence of a sense the corpus cannot record.** A written corpus is the weakest evidence there
is about how a *symbol* is spoken — writers type `48.33`, they never spell out how they would say it — which
is the Igbo `ǹtụ̀kpọ` lesson, and the playbook requires a dictionary-grade check before a silence-based
refusal. Gaim's paper is that check and is better than a dictionary: it is specifically about Tigrinya number
*verbalization* and lists `ነጥቢ /näTbi/ (point)` as the decimal-point word. Adopted, with the citation beside
it.

**⚠ And ordinals 7 and 9 rest on the paper alone.** `ሻውዓይ` and `ታሽዓይ` are **absent** from ti.wikipedia (0
token / 0 substring, and so are `ሻውዐይ`, `ታሽዐይ`, `ትሽዓይ`, `ትሽዓተይ`). For 7th the wiki instead attests the
classical `ሳብዓይ` ×1 — a *different word*, in `ሄንሪ ሳብዓይ` (Henry VII). Recorded as a competitor rather than
adopted: Gaim's Table 1 is a verbalization table (what to *say*), it is the source this manifest already
adopted for its cardinals, and the corpus's `7ይ` ×5 / `9ይ` ×3 prove the slot is real. Where the wiki attests
a different **spelling of the same word** the attested spelling wins (`ሓምሻይ` over the paper's `ሓሙሻይ`;
`ሻሙናይ` over `ሻምናይ`) — the same policy the manifest already states for the cardinals.

**Implication.** Every rule below is sourced or declined; the four refusals above have counts and stay
refused.

---

## Run 6 — 2026-08-12 13:00 — the ordinal, and the LARGEST defect in the language

**Question.** ti writes ordinals two ways. Which does the engine get wrong, and by how much?

**Command.** Tabulation + probes.

**Raw finding.**

* `መበል N` ×35 — reads **correctly already**. `መበል 16` → `məbəl ʕasəɾtə ʃɨdʃtə`: `መበል` is an ordinary word and
  the numeral an ordinary cardinal, which is exactly the spoken form. **No rule needed.** Gaim confirms
  `መበል + cardinal` is the 11th-and-above form.
* `Nይ` ×22 (`7ይ` ×5, `8ይ` ×4, `9ij` ×3+1, `6ይ` ×2, `5ይ` ×2, `3ይ` ×2, `4ይ` ×1, `2ይቲ` ×1, `10ይን` ×1) — reads as
  **cardinal + a bare orphan syllable**: `6ይ` → `ʃɨdʃtə jɨ`. The `ይ` is the ordinal's final letter, not a word.
  **Every value is 1–10**; nothing above 10 takes this form in the artifact.
* Tails observed: feminine `ቲ` (`2ይቲ`) and the conjunction `ን` (`9ይን`, `10ይን`).

**And the biggest one, which is not a number rule at all.** `፡` (U+1361) occurs **998 times in 323 lines**
and contributes **no pause whatsoever** — it is outside `[ሀ-ፚ]`, outside the punctuation branch, and
`makeGeezG2P` merely treats it as a word boundary. Broken down:

```
X፡ Y   (fidel, then a space)   806      X ፡ Y  (spaced both sides)   104
fidel፡fidel (no space)           2      digit፡digit (a clock)          1
፡፡                               1      other                          ~
```

Read in context, the 910 spaced instances are **clause boundaries**, not the traditional word separator:
`ኣብ 2010፡ ንኣስታት 9,000 ሰባት ሞት ከስዕብ ከሎ፡ …`, `ዝተፈላለዩ ዓይነት ስርሓት ካይላ፡ ካብ እምኒ፡ ኣስራዝን ዑንቊን …`. Ordinary word
gaps in this corpus are plain spaces; 910 marks across ~15,000 words is far too sparse for a word separator.
The two unspaced `fidel፡fidel` are a place-name list and a clause break, so they want a comma too.

**Implication.** Mapping lone `፡` → `,` is **ti's single largest reading change by count** — roughly 910
restored clause pauses, more than every other rule in this layer combined. It is `am`'s step 4 verbatim, but
the justification and the magnitude are ti's own.

---

## Run 7 — 2026-08-12 13:30 — measuring the refusals that a gate will call FAIL

**Question.** `sources.ts` flags `minus-word chk?`. The playbook (trap 24) says a refusal is a measurement,
and (trap 48) that a definitive negative is worth the effort. Measure before deferring.

**Command.** Every `[-–—]` adjacent to a digit, read in context.

**Raw finding.** The fleet's minus shape `(^|[\s(])[-−–](\d)` has **2 hits in 323 lines**:

```
TRUE   ኤሌክትሮናት -1 ኣሃዱ ዝኾነ ኣሉታዊ ቻርጅ ይሕዙ      electrons carry a negative charge of −1 unit
FALSE  ( –500 ቅድሚ ልደተ ክርስቶስ)                 "(500 BC)" — an era dash, not a sign
```

Every *other* digit-adjacent hyphen (25 of them) is a **range** (`1937-1938`, `60–70%`, `8–12 ሳምንታት`,
`2016-17`) or a **designation** (`COVID-19`, `ICD-10`, `SARS-CoV-2`, `G-20`, `DSM-5`, `ሚግ-21`). One true
positive against one false positive, with a sourced word available (`ኣሉታ`, Gaim).

**Implication.** **Declined, 1-for-1.** Neither of hi's narrowing arms rescues it — the false positive is
exactly the bracket-opening arm, and there is no degree/percent word after the true one. A rule that is right
half the time is worse than a silence, and the two instances are re-checkable from this entry in one grep.

The plus is the same shape at ×1 (`G-20`-adjacent prose, no `UTC+n` anywhere in the artifact) and is declined
with it; `< > ÷ ×` are ×0.

---

## Run 8 — 2026-08-12 14:00 — the two grouping conventions, and the one that is not a decimal

**Question.** ti groups thousands with a comma (×66). It also writes `\d\.\d{3}` (×5). Is that a second
grouping convention or a decimal?

**Command.** Read all five.

**Raw finding.**

```
GROUPING   ልዕሊ 200.000 ሰባት ይቅመጥዋ                   Samoa, >200,000 people
GROUPING   ኣስታት 38.800 ሰባት ድማ ይቕመጥዋ (2001)         Apia, ~38,800
GROUPING   ኣብ 16.000 ዝተመቀለት ደሴት                    Indonesia, 16,000 islands
GROUPING   ስፍሓት 26.990 ኪ.ሜ2 ዘለዎ                    26,990 km²
DECIMAL    451,170.7 ሄክታር (1,741.980) ስፍሓት         1,741.98 — and it already carries a COMMA group
```

**4 grouping against 1 decimal, and the discriminator is clean and mechanical: the one decimal is the one
number that already uses the comma for its thousands.** A number cannot use both marks for the same job.

**Implication.** De-group `\d\.\d{3}` **only when the number carries no comma group**. Zero exceptions in the
artifact. Two-digit and one-digit fractions (`48.33`, `1.24`, `451,170.7`) are untouched and remain decimals —
57 of them.

---

## Run 9 — 2026-08-12 15:10 — the gates, and which of them are meters

**Question.** Everything is written. What did each gate actually measure?

**Commands / raw findings.**

```
npx tsc --noEmit                                   clean, before and after
npx vitest run                                     241 files, 3803 passed, 1 expected staleness (see Run 10)
corpus-diff.ts emit/compare --corpus mined:ti      changed 247/323 (76.5%)
                                                   before { DIGIT 0, SLOT-GAP 0, RAWMARK 0, DROP 51, THROW 0 }
                                                   after  { DIGIT 0, SLOT-GAP 0, RAWMARK 0, DROP 12, THROW 0 }
mine.ts scan                                       percent 39→0 · degree 7→0 · currency 3→0
                                                   math-sign 7→1 · minus 2→1 · ampersand 2→0(accepted)
review.ts --lang ti                                1 FAIL (no normalizer) → 2 FAIL, both intended (Run 11)
sources.ts --lang ti                               percent-word chk?→ok · currency-word chk?→ok
                                                   fraction-series NONE→part (the ordinal series now exists)
referee-eval.ts ti                                 kaikki tir 26w: 7/26 raw, 25/26 folded, 99.2% symbol
                                                   epitran tir-Ethi 898w: 321/898 raw, 847/898 folded, 98.8%
                                                   ⚠ BYTE-IDENTICAL BEFORE AND AFTER
```

**⚠ WHICH GATES ARE METERS AND WHICH ARE TRIPWIRES — the task's own question, answered mechanically.**

* **`referee-eval.ts ti` is a TRIPWIRE and cannot be anything else**, and the reason is structural rather than
  a matter of the 26-entry sample size. `tools/referee-eval/eval.ts` line 200 imports ti as
  `import { phonemizeWord as ti } from ".../tigrinya.ts"` — **the WORD path**. `normalize.ts` runs inside
  `text()`, downstream of nothing this harness ever calls, so a normalization change **cannot** move this
  number. Both runs are byte-identical (321/898, 847/898, 98.8%) and that equality is the tripwire firing
  correctly: it proves the g2p and the manifest were not disturbed. Reporting it as evidence that the
  normalization is *good* would be reporting a measurement of a different thing.
  Even if it were sentence-level, the primary referee is **26 words** and wikipron is **0**, so the only
  volume is epitran — an independent *rule-based* G2P, a second opinion and not ground truth.
* **`corpus-diff.ts` is the only real meter here**, and it is a good one because the artifact is dump-sourced:
  323 lines of ordinary ti.wikipedia prose, both sides read by the same ruler with only the engine differing.
  **DROP 51 → 12** and 247 utterances changed is the measurement this run rests on.
* **`mine.ts scan` is a meter for the DROP classes**, per class, and it is what shows which of the 39 change.
* **`review.ts` and `sources.ts` are tripwires** — necessary, never sufficient, as their own headers say.
  `sources.ts` moving `percent-word`/`currency-word` from `chk?` to `ok` says a declaration now exists, never
  that `ሚእታዊት` is right; that argument is Run 5's.
* **`vitest`/`tsc` are regression tripwires** for the other 190 languages.

**Implication.** The claim this work can defend is the corpus-diff one. Everything else is a guard.

---

## Run 10 — 2026-08-12 15:30 — reading the diff, because the counts are not the check

**Question.** 247 utterances changed. Playbook step 5: *read the sampled changes; do not just check the
counts.* Did anything get worse?

**Command.** Sampled changed rows, plus a mechanical sweep for the failure shapes (`, ,`, doubled spaces,
orphan syllables, stray Latin, and any reading that got SHORTER).

**Raw finding.** Zero suspicious rows. 18 readings got shorter by >2 characters and **every one is an
improvement**:

```
ʕa . mɨ . kɨsaʕ …   →  ʕam kɨsaʕ …           ዓ.ም — three phrase breaks collapsed into one letter-run
ħɨ . mə , … ħɨ . mə . ʔa  →  ħɨmə … ħɨməʔa   ሕ.መ / ሕ.መ.አ, the abbreviation for "United States"
wahjotat ʔen . ke   →  wahjotat ʔenke        ኤን.ኬ — an initialism, was two phrases
lɨʕli kɨltə miʔti . zeɾo səbat  →  lɨʕli kɨltə miʔti ʃɨħ səbat
                                             `ልዕሊ 200.000 ሰባት` — "over two hundred . ZERO people"
                                             became "over two hundred thousand people"
```

The bulk of the 247 is the `፡` clause comma, and read in context it lands where a comma belongs every time.

**Implication.** No regression found. `vitest` reported one failure — `languageCatalogue.test.ts`, the derived
`normalization` column being stale, which is the expected consequence of adding a normalizer.
`derive-normalization.py` + `build.py` closed it (`(none)=86, done=116, inherited=13`, 0 cells differ) and the
suite is green.
⚠ `onnx-optional.test.ts` did not time out on this run; it is discounted either way.

---

## Run 11 — 2026-08-12 15:50 — what stays RED, deliberately

**Question.** `review.ts` still reports 2 FAIL. Is that trap 24 (a correct red gate) or an unfinished job?

**Raw finding.** After the class-level refusals were recorded in `defects.ts`, the residual is **exactly two
instances, and they are the two genuine ones**:

```
[FAIL] sign classes    DROPPED: minus plus
[FAIL] artifact scan   DROP math-sign ×1  … ኣወንታዊ ቻርጅ ዘለዎም ንጥረ ነገራት … +1 ኣሃዱታት …   (the proton, +1)
                       DROP minus     ×1  … ኤሌክትሮናት -1 ኣሃዱ ዝኾነ ኣሉታዊ ቻርጅ …            (the electron, −1)
```

Everything else in those classes is now `ACCEPTED` or `ACCEPTED-CLASS`, by identity, with the spans named.

**The split is the whole point and it is drawn on evidence, not on convenience:**

* `equals`, `divide`, `times`, `less-than`, `greater-than`, `plus-minus`, `ampersand` → **exempted**, because
  the **SIGN is not Tigrinya**. `=` ×2 is an English gloss and a URL; `÷` ×5 is clause-final **list
  punctuation** (`ንሳቶም ድማ÷`), a typographic stand-in for `፦`, and never division; `&` ×27 is unstripped wiki
  markup; `× ± < >` are ×0. No word could close any of these. `ማዕረ` "equal" is attested ×9 — the word is
  available and the sign is not, which is trap 48's shape.
* `minus` and `plus` → **left RED**, because each has **one genuine unread Tigrinya instance** (the electron's
  and the proton's charge, in the same article). A sourced word exists (`ኣሉታ`, Gaim). What is missing is a
  rule that can separate them from the 25 ranges and designations, and 1-true-against-1-false does not earn
  one. **A red gate that is correct beats a green gate that is wrong** — so these must keep failing until a ti
  minus rule is earned.

The by-identity list in `ACCEPTED_SILENT` accepts the era dash `( –500 ቅድሚ ልደተ ክርስቶስ)` — decidable, because
the corpus's own next words say "before the birth of Christ" — and deliberately **omits** the electron's `-1`,
so the genuine negative still reports. That asymmetry is the property `accepted-silent.test.ts` exists to pin.

**Implication.** Two red lines, both correct, both re-checkable in one grep from Run 7.

---

## Summary of what changed

| | before | after |
|---|---|---|
| corpus-diff DROP | 51 | **12** |
| utterances changed | — | **247 / 323 (76.5%)** |
| scan: DROP percent | 39 | **0** |
| scan: DROP degree | 7 | **0** |
| scan: DROP currency | 3 | **0** |
| scan: DROP math-sign | 7 | **1** (the proton's `+1`) |
| scan: DROP minus | 2 | **1** (the electron's `−1`) |
| scan: DROP ampersand | 2 | **0** (accepted by identity) |
| Ethiopic numerals reading as `""` | 20 | **0** |
| `፡` clause breaks producing no pause | ~910 | **0** |
| DIGIT / SLOT-GAP / RAWMARK / THROW | 0 | **0** |
| referee (kaikki 26w · epitran 898w) | 7/26 · 321/898 | **identical — a tripwire, see Run 9** |

Declined, with counts: the minus (1 true / 1 false), the plus (×1), the ampersand (×27, all markup), `=`
(×2, a gloss and a URL), `÷`-as-division (×5, all list punctuation), `± × < >` (×0), `ናቕፋ` as a currency (×5,
all the town), `ብር` (×41, all inside longer words), `ዓ.ም` as a calendar (×19, `ዓመተ ምሕረት` absent from the
wiki), a cube word (×0 — trap 51's floor), and `Nይ` ordinals above 10 (×0).


---

## Run 12 — 2026-08-27 08:40 — the C# port's reading, and the half of Run 8 that was never asked

**Question.** Run 8 asked "ti groups with the comma — is `\d\.\d{3}` a second GROUPING convention or a
decimal?" and answered it. The mirror question was never put: **ti points with the period — is `\d,\d{1,2}`
a decimal?** Asked while porting `ti` to C#, where the gate can only prove the two engines agree.

**Command.**

```
grep -oE '[0-9]+,[0-9]+' corpus.txt | sort | uniq -c | sort -rn      # 67 instances, 323 lines
```

**Raw finding.** 62 of the 67 are three-digit thousands groups. The other five are:

```
2,5 ሜ.     ×2   ተባዕታይ ኣንበሳ ንውሓቱ ( ካብ ርእሱ ክሳብ ጭራኡ) 2,5 ሜ. ኣቢሉ ይበጽሕ   a lion, 2.5 m nose to tail
1,2 ሜ.           ( ካብ ርእሱ ክሳብ እግሩ) ከኣ ካብ 1,2 ሜ. ንላዕሊ ኢዩ            1.2 m at the shoulder
99,7%            99,7% ካብ ቶም ሰባት ድማ ክርስትና ሃይማኖት ኣለዎም                 Samoa's Christian share
A 2,2            (ናይ መጀመርታ ደረጃ A 2,2 ዒላማ ደረጃ B.1-B1.2)              a CEFR sub-level
```

**Every one is a decimal, and every one read with a CLAUSE PAUSE inside the number and its fraction as a
whole number:**

```
2,5 ሜ. ኣቢሉ    kɨltə , ħamuʃtə me . ʔabilu        "two, five"     → kɨltə nətʼbi ħamuʃtə me .
99,7% ካብ ሰባት  təsʕan tɨʃʕatən , ʃəwʕatə miʔtawit  "ninety-nine, seven percent"
0,001 ግራም     zeɾo , ħadə ɡɨɾam                   "zero, one gram"
```

⚠ **A CONFIDENTLY WRONG QUANTITY, NOT A DROP** — and the third line is the su finding one step on: step 6's
leading-zero guard is *right* to refuse `0,001` as a thousands group, and the comma it correctly declines to
spend then read as punctuation. The guard's safe branch stranded the separator.

⚠ **ZERO instances are a comma followed by four or more digits.** So "whatever step 6 declined" and "a
one-or-two-digit fraction" name exactly the same five strings in this artifact. Step 10 is written as the
former, because that is the property that makes the split decidable rather than a count that could change;
it is also what the period arm has always done (`2010.2011` already read as a decimal).

**Implication.** Step 10 claims `[.,]`, not `.`. Measured over the 323 corpus lines: **4 lines move, and
they are the four carrying those five instances; the other 319 are byte-identical.** Three of the 200 golden
rows move. `1,741.980`, the one number carrying both marks, is untouched — step 6 spends its comma as a
group first, so only one mark ever survives to step 10.

---

## Run 13 — 2026-08-27 08:55 — the scale letter does not "stay dropped"

**Question.** Step 13's comment claimed "the Latin scale letter after [°] (C, W) is outside TOKEN's
alphabet and stays dropped". Is that true?

**Command.** `phonemize("ኣብ ለይቲ ክሳዕ ፭°C ኣቢሉ ይብጽሕ።", "ti")`

**Raw finding.** `ʔab ləjti kɨsaʕ ħamuʃtə diɡɨɾi sˈiː ʔabilu jɨbɨt͡sʼħ .` — *sˈiː*. The letter is outside
TOKEN, but a Latin run never reaches TOKEN: `core/scripts.ts` splits it out first and hands it to the English
reader, which says the LETTER NAME. ×3 in the artifact (`፭°C`, and two `&nbsp;°C`).

**Implication.** The code was doing something the comment denied, which is the gap the correctness lens
exists to find. Not changed: which reading is better — the English letter name or silence — is a fleet
question about unreadable Latin residue, and inventing ሴልሲየስ is the refusal Run 5 already made. The comment
now states the measured behaviour.
