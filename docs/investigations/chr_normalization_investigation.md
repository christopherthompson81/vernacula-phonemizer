# Cherokee (chr) text normalization — investigation log

Chronological. Each run records the command, the question it was meant to answer, the RAW finding, and what
that implied for the next step. **Negative results are kept, and for this language they are most of the
value**: chr.wikipedia is 734 paragraphs — the smallest corpus in the fleet — and the governing result of the
round is playbook trap 51's floor. Almost every vocabulary class a normalization layer could have read is
unsourceable here, and the layer that ships reads three SEPARATORS and declares no shared symbol tier at all.

---

## Run 0 — 2026-08-16 — baseline, before any code

```
npx tsx tools/normalization/corpus-diff.ts emit --lang chr --corpus mined:chr --out /tmp/chr-base.json
npx tsx tools/referee-eval/eval.ts chr
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/chr.jsonc --lang chr
```

**Question.** What does the engine do today, and what does the artifact scan already flag?

**Raw finding.**

```
emitted 285 utterances → /tmp/chr-base.json

=== chr vs wikipron chr_cher_broad (183) — INDEPENDENT PRIMARY ===
raw exact:      53/183 (29.0%)   folded backbone: 168/183 (91.8%)   symbol accuracy: 97.3%
=== chr vs kaikki Cherokee (179) — INDEPENDENT SECONDARY ===
raw exact:      49/179 (27.4%)   folded backbone: 165/179 (92.2%)   symbol accuracy: 97.3%

scanned 315 lines of tools/corpus/mined/chr.jsonc as chr
DROP percent       ×4     e.g. Ꮲ 95% ᎢᎦ ᎡᎶᎯ ᏄᏍᏛ ᎠᎹ, …
DROP currency      ×1     e.g. … ᎤᎾᏤᎵ ᎠᏕᎳ ᏣᏆᏂ …
DROP minus         ×1     e.g. ᎹᏱᎩᎵ I ᎳᏂᎦᏇ (????-844) ᎠᏍᎦᏯ …
FOREIGN ampersand  ×1     e.g. Ben & Jerry's ᎤᏛᏁᎢ ᎤᎦᎾᏍᏗ Holdings Inc. …
```

**Implication.** Four flagged classes, all tiny. Nothing here tells me what the corpus's *numbers* look like,
and the scan is blind to a symbol that survives into a wrong reading rather than vanishing. Read the corpus.

---

## Run 1 — 2026-08-16 — the corpus, read in full: what is actually in it

`scratch-chr/read.mts` strips JSONC comments and trailing commas and walks the string leaves; `ctx.mts`
prints every match of a pattern with 25–55 characters of context on each side (playbook trap 62's procedure).

**Question.** How much of the retained text is Cherokee versus Latin residue; which separators appear;
are the digits ASCII; and what are the colon, the dashes and `= < > × ÷ ± +` actually doing?

**Raw finding.** 315 retained segments (115 hard + 200 sample), 285 unique utterances after the emit.

```
chars: cherokee=38069 latin=6410 digits=968
non-ASCII digits: []                      ← \p{Nd} minus [0-9] is EXACTLY ZERO
segments where latin > cherokee: 30 / 315
LATIN RUNS: 669 distinct, 1075 total      of×23 the×23 tribal×12 Ross×11 Chad×11 Freedmen×11 …

MARKS:  , ×772 · . ×765 · ( ×115 · ) ×108 · " ×103 · - ×101 · ; ×68 · : ×31 · ' ×28
        – ×16 · ’ ×12 · ! ×11 · “ ×10 · ” ×8 · % ×6 · ² ×5 · ~ ×5 · — ×4 · ] ×4
        ? ×4 · / ×3 · & ×3 · ½ ×2 · ¥ ×1 · [ ×1
```

Then every instance of every rare mark, read:

| mark | ×  | what it actually is |
|---|---:|---|
| `%` | 6 | genuine percentages in Cherokee prose (`ᏂᎪᎯᎸ ᎤᏁᏍᏓᎳ 98% ᎦᏙᎯ ᏗᏚᏝᎢ`, `Ꮲ 95% ᎢᎦ ᎡᎶᎯ`, `20–25%`, `10–15%`) |
| `²` | 5 | all `km²`, country areas (`ᏂᎬᎢ 9,984,670 km².`) |
| `~` | 5 | **circa**, always before a birth year in a regnal parenthetical: `(~1096–1154)`, `(~965–1038)` |
| `&` | 3 | **two are the unexpanded HTML entity `&ndash;`**; the third is `Ben & Jerry's`, an English brand |
| `½` | 2 | the SAME sentence twice — `3-3 ½ ᎢᏯᎳᏏᏗ ᎢᎦᏘ` |
| `¥` | 1 | `ᎤᎾᏤᎵ ᎠᏕᎳ ᏣᏆᏂ ᎠᏕᎳ (¥)` — the Cherokee word for *money* written TWICE beside the sign |
| `/` | 3 | all inside ENGLISH: `(1897/98: pt.1)`, `English/Cherokee Glossary`, `for Cherokee / Tsalagi` |
| `[` `]` | 5 | unclosed wiki markup — `… ᎭᏫᎾᏗᏢ 1828.]]` |
| `= < > × ÷ ± +` | **0** | **not one instance of any of the six, anywhere in the corpus** |

**The colon, ×31, read in full — not one is a clock.** It introduces a list or a quotation in Cherokee prose
(`ᏄᏍᏛ ᏗᎧᏃᏗ:`, `ᏣᎳᎩ ᎤᏅᏔᏂᏓᏍᏗ:`, `ᎤᏪᏡᏁ: “Ᏻ! ᎥᎩᎵᏏ…`), separates city from publisher in an English citation
(`Tulsa: Cherokee Language and Culture`), marks a PARALLEL TITLE (`(ᏣᎳᎩ: Tatiyana Bulanowa; ᏲᏂᎢ: Татьяна…)`),
or sits in a page reference (`(1897/98: pt.1)`). `\d:\d` is ×0. The artifact's `clock: 2` cell is a false
positive of the cell selector.

**The ASCII hyphen, ×101 — and it is the round's most important negative.**

```
-Ꭿ / -Ꮒ enclitic     ᏧᏴᏢ ᎠᎹᏰᎵ-Ꭿ · ᎡᎶᎯ-Ꮒ · ᏳᎳᏛ-Ꭿ · ᎢᏅᏗᎾ-Ꭿ · ᏧᏁᏍᏓᎸ-Ꭿ      the commonest sense
compound numeral     ᏦᏍᎪᎯ-ᏐᏁᎳ (39) · ᏔᎳᏍᎪᎯ-ᏌᏊ · ᏁᎳᏚ-ᏐᏁᎳ                  ⚠ glossed by its own digits
Cherokee compound    ᎦᎸᎳᏗᏢ-ᎦᏙᎯ · ᎩᏄᏙᏗ-ᎩᎬ · ᎬᏂᎨᏒ ᏄᏍᏛᎢ-ᎤᏍᏗ ᎦᏅᏅ
an ISBN              0-7167-2438-3 · 1-884655-63-7 · 0-937207-43-8          ×9 hyphens, 3 citations
an English compound  Baskin-Robbins · Cross-Cultural · KJRH-TV · Babel-X
a real span          1-6 cm · 0.8-4 cm · 3-3 ½ ᎢᏯᎳᏏᏗ                        ×3 — the whole class
```

`ᏦᏍᎪᎯ-ᏐᏁᎳ (39)` is the best single piece of evidence in the round: the writer spells *thirty-nine* as a
hyphen-joined compound and then repeats it in digits in the same clause. That is a Cherokee reader telling us
the hyphen is INSIDE a word.

**The en-/em-dash is a different mark.** Digit-flanked, `–` ×16 and `—` ×4 are the birth–death span of a
biographical parenthetical without exception (`(1923–2008)`, `(1976–1990)`, `(1852—1892)`) plus the two
percent spans. Spaced between words it is the species-gloss dash (`ᏒᎩ — Allium canadense`) and an apposition.

**The comma and the dot between digits, counted exactly:**

```
\d,\d+   ×50 match positions — EVERY ONE a thousands group, 0 exceptions
\d.\d    ×6 — 29.53 · 4.5 (×2) · 0.8 · 3.5" · 4.25" — ALL decimals, no date/IP/version anywhere
\d{1,3}(,\d{3}){3,}   ×1 — `1,028,737,436` (India's population), a FOUR-group figure
```

**Implication.** Three separator rules are available and need no vocabulary at all. Every class that would
need a *word* is a handful of instances in a corpus that may not have the word. And playbook trap 63 is live
rather than prophylactic — the four-group figure is right there.

---

## Run 2 — 2026-08-16 — probing the engine: what breaks today

```
npx tsx scratch-chr/probe.mts     # 28 shapes taken verbatim from Run 1, through phonemize(…, "chr")
```

**Question.** What does the engine actually produce for the shapes the corpus contains?

**Raw finding — the defect list.**

```
ᎬᏩᏚᏫᏛ 17,000 ᏣᎳᎩ      → kə̃watuwitə̃ kalikʷatu , notʰi t͡salaki
                          "seventeen, ZERO"  ⚠ a silent 1000× error
ᎾᏂᎥ ᏴᏫ 33,625,989.     → … t͡sosko t͡soi , sutaliskohit͡sikʷa tʰalisko hiski , sonelaskohit͡sikʷa nelasko sonela .
                          "thirty-three, six hundred twenty-five, nine hundred eighty-nine"
                          three numbers and TWO false sentence breaks where the writer wrote one figure
ᎢᎦᏘᎭ ᎢᎬᏁᎸ 29.53 ᎯᎸᏍᎩ  → … tʰalisko sonela . hiskisko t͡soi …      a FULL STOP inside a quantity
ᏆᏟᎩ ᎯᎳᏫ (1923–2008)    → … tʰalisko t͡soi tʰali ijakajə̃li …       the dash DROPPED, the years fused
(1914&ndash;1972)       → … nikatu ijakajə̃li …                     the entity contributes NOTHING
Ꮲ 95% ᎢᎦ ᎡᎶᎯ           → t͡ɬə̃ sonelasko hiski ika elohi           the sign silent
ᎠᏕᎳ ᏣᏆᏂ ᎠᏕᎳ (¥)        → atela t͡sakʷani atela                     the sign silent — and ALREADY correct
5 km                    → hiski ˈʊkm            5 cm  →  hiski km   ⚠ see below
ᎯᎠ ᎢᎬᏱ 20th ᏍᏉᎯᏧᏈ      → … tʰaliskohi tʰˈiːʲˈeᶦt͡ʃ …               the English letter names "T-H"
ᎣᏂᏱᏳ 1820s              → … tʰaliskohi ˈɛs …                       the English letter name "ess"
```

⚠ **`cherokee.ts` tokenizes `([Ꭰ-Ᏽꭰ-ꮿ]+)|(\d+)|([.?!,;:…])` — a Latin run is never claimed**, so
`assembleClauses` hands it to `emitUnclaimed`, i.e. to the Latin-to-English fallback. Two consequences that
shaped everything after this point:

1. **Any word this layer emitted in Latin would be read as ENGLISH.** A rule here may emit SYLLABARY only.
2. **`cm` reads as the raw string `km` and `km` as `ˈʊkm`** — playbook trap 56's magnitude-confusable
   collision, the same defect measured in nya and tl, live in Cherokee.

**Implication.** The three separator defects (comma, dot, dash) are the round's real content and cost nothing
in vocabulary. Everything else needs a Cherokee word. Go and see whether the words exist.

---

## Run 3 — 2026-08-16 — the sourcing floor, measured. **espeak's Cherokee dictionary is empty.**

```
npx tsx tools/normalization/sources.ts --lang chr
wc -l $ESPEAK_NG/dictsource/chr_list $ESPEAK_NG/dictsource/chr_rules
```

**Question.** What tiers exist for this language at all?

**Raw finding.**

```
  0 /home/chris/Programming/espeak-ng/dictsource/chr_list
324 /home/chris/Programming/espeak-ng/dictsource/chr_rules

  [chk?] percent-word    % in corpus, no declaration found
  [chk?] currency-word   sign in corpus, no declaration found
  [chk?] unit-word       the corpus writes km×7 cm×2 after a number — source the unit words
  [  · ] scale-names     no ° in the corpus
  espeak: NOT CONSULTED · referee: 363 lines · corpus: 315 lines
```

**espeak-ng ships a Cherokee voice with ZERO dictionary entries.** `chr_rules` is 324 lines of phonetic rules
over a ROMANIZATION (`.L04 a e i o u v ạ ẹ ị ọ ụ ṿ`, tone digits `¹²³⁴`) and carries no orthographic word at
all. The playbook's usual fallback tier (§5c) does not exist for this language.

**Implication.** Everything has to come from chr.wikipedia. Probe it.

---

## Run 4 — 2026-08-16 — `attest.ts`, one batch, and the examples read

```
npx tsx tools/normalization/attest.ts --lang chr \
  --words "ᏍᎪᎯᏥᏆ,ᎢᏳᏟᎶᏛ,ᎢᏯᎳᏏᏗ,ᎠᏕᎳ,ᎬᏩᏚᏫᏛ,ᎾᎥᏂᎨᏍᏙᏗ,ᎠᎴ,ᏂᏛᎴᏅᏓ,ᎠᏰᎵ,ᏅᎩᎪᏢᏅ,ᎠᏍᏓᏅᏅ,ᏗᎦᏅᎯᏓ"
npx tsx tools/normalization/attest.ts --lang chr --words "ᏅᎩ ᏧᏅᏏᏯ,ᏑᏟᎶᏛ,ᏧᏅᏏᏯ,ᏍᎪᎯᏥᏆ ᎢᏳᏓᎵ,ᎢᏳᏓᎵ,ᏗᏙᎳᎩ,ᎤᏓᏓᏛ"
npx tsx tools/normalization/attest.ts --lang chr --after "ᏍᎪᎯ,ᎯᏍᎩ,ᏔᎵᏍᎪᎯ,ᏑᏓᎵ,ᎢᏳᏟᎶᏛ,ᏍᎪᎯᏥᏆ"
```

**Question.** Is there a Cherokee percent word, unit word, square word, or approximation word — read for
SENSE, not counted?

**Raw finding — counts.**

```
ᏍᎪᎯᏥᏆ       1/1   attested        ᏅᎩ ᏧᏅᏏᏯ    5/3   attested
ᎢᏳᏟᎶᏛ       3/2   attested        ᏑᏟᎶᏛ       1/1   attested
ᎠᏕᎳ         16/8  attested        ᏧᏅᏏᏯ       6/4   attested
ᎬᏩᏚᏫᏛ       7/3   attested        ᏍᎪᎯᏥᏆ ᎢᏳᏓᎵ  0/0   absent
ᎠᎴ          255/20 attested       ᏅᎩᎪᏢᏅ      0/0   absent
```

**And the examples, which reverse three of those counts.**

- **`ᏅᎩ ᏧᏅᏏᏯ` is the SHAPE word — playbook trap 37 exactly.** Three of its five hits are geometry:
  `ᎦᏅᎯᏓ ᏅᎩ ᏧᏅᏏᏯ (ganvhida nvgi tsunvsiya)` is a dictionary entry for the **rectangle**, `ᏦᎢ ᏧᏅᏏᏯ ᎤᏃᏴᎩ`
  beside it is the **triangle**, and a third is in a list of woven patterns (`ᎦᏅᎯᏓ ᏅᎩ ᏧᏅᏏᏯ, ᏗᎦᏐᏆᎸ,
  ᎦᎸᏉᏗ ᏃᏈᏏ` — rectangle, diamond, star). The two measure-slot hits are the *same clause of the same article*.
- **That clause is also the only evidence for a kilometre word, and it contradicts itself:**
  `ᎠᏍᏓᏅᏅ ᏂᏛᎴᏅᏓ ᎦᏲᎵ ᏅᎩ ᏧᏅᏏᏯ ᏑᏟᎶᏛ(ᏅᎩ ᏧᏅᏏᏯ kilometer) … ᏅᎩ ᏧᏅᏏᏯ ᎢᏳᏟᎶᏛ` — it glosses `ᏑᏟᎶᏛ` as
  "kilometer" while using the near-identical `ᎢᏳᏟᎶᏛ` for square MILES two clauses later. And the mined
  corpus is unambiguous that `ᎢᏳᏟᎶᏛ` is the MILE, because it converts it against km twice:
  `1,200 ᎢᏳᏟᎶᏛ (1,900 km)` and `2,200 ᎢᏳᏟᎶᏛ (3,540 km)`.
- **`ᎠᏕᎳ` is confirmed as "money", and confirms the yen line is REDUNDANT rather than defective.** The wiki
  writes the same gloss shape for the euro: `ᏳᎳᏛ (€) ᎠᏕᎳ ᎾᎿ European Union`.
- **`ᎬᏩᏚᏫᏛ` ("about") is attested ×7/3 and every example approximates a QUANTITY** —
  `ᎬᏩᏚᏫᏛ 290,000,000 ᎠᏂᎤᏁᎦ`, `ᎬᏩᏚᏫᏛ 17,000 ᏣᎳᎩ`, `ᎬᏩᏚᏫᏛ 7,000 ᎠᏂᏯᏫᏍᎩ`. A different register from
  circa-a-date, which is what `~` marks in all five of its instances.
- **`ᎠᎴ` ("and") is ×255 over 20 articles** and is the corpus's ordinary conjunction.

**And the slot probe returned essentially nothing, which is the floor:**

```
── what FOLLOWS ᏍᎪᎯ / ᎯᏍᎩ / ᏔᎵᏍᎪᎯ / ᏑᏓᎵ / ᎢᏳᏟᎶᏛ / ᏍᎪᎯᏥᏆ ──
  ꭴꮺꮨ ×1 · ꭲᏼ ×1 · ᏹꮷꮥꮨᏼꮣ ×1 · ꭽꮻꮎꮧꮲ ×1
```

Four followers across the whole of chr.wikipedia, none a measure word. **This wiki essentially never spells a
numeral out beside a unit**, so trap 40's slot inversion has nothing to find.

**Implication — the refusals, each priced (trap 53).**

| class | × | refused because | what the silence costs |
|---|---:|---|---|
| percent | 6 | no candidate; `ᏍᎪᎯᏥᏆ` ×1/1 is a count of people, `ᏍᎪᎯᏥᏆ ᎢᏳᏓᎵ` ×0 | the sign is unread; nothing wrong is said |
| currency | 1 | trap 12 — `ᎠᏕᎳ` is written TWICE beside the sign | **nothing**; the reading is already correct |
| units | 9 | `ᏑᏟᎶᏛ` ×1/1 in a clause that mis-glosses itself; declaring it is trap 44 in reverse | `cm` reads as `km` (trap 56), stated not hidden |
| exponent | 5 | the square word is the SHAPE word (trap 37) | refused WHOLE, so `km²` is not read as "kilometres two" |
| ampersand | 3 | not one is a Cherokee conjunction | a Cherokee word spliced into `Ben & Jerry's` is worse |
| minus | 1 | it is `(????-844)`, an unknown birth year; ×0 negatives in 101 hyphens | nothing — there is no negative to invert |
| `= < > × ÷ ± +` | 0 | the signs do not occur | closed, not deferred (trap 48) |
| `~` | 5 | `ᎬᏩᏚᏫᏛ` is the wrong REGISTER (quantity, not date) | the tilde is unread; five instances do not buy a guess |
| `½` | 2 | no half word; `ᎠᏰᎵ` ×134 is "central/government" in every example | one sentence, unread |
| `'` `"` | 7 | no foot/inch word — and `"` is also the quotation mark ×103 | a rule keyed on `"` would claim 103 quotes to read 7 measurements |

---

## Run 5 — 2026-08-16 — the layer, and the corpus diff

`src/languages/cherokee/normalize.ts` ships four steps and **no `makeSymbolNormalizer` declaration at all**:
fold `&ndash;`/`&mdash;`; de-group the comma (whole number at once, trap 63; trailing guard `(?!\d)` only,
trap 58); neutralise the decimal dot; spend the en-/em-dash on a pause, digit-flanked and spaced.

```
npx tsx tools/normalization/corpus-diff.ts emit --lang chr --corpus mined:chr --out /tmp/chr-after.json
npx tsx tools/normalization/corpus-diff.ts compare --before /tmp/chr-base.json --after /tmp/chr-after.json
```

**Question.** Do the 42 changed readings read correctly, and did anything regress?

**Raw finding.** `changed 42/285 (14.7%)`, and both sides identical on every leak class:

```
before  DIGIT 0 · SLOT-GAP 0 · RAWMARK 0 · ZERO-WIDTH 0 · RAW-CAPS 0 · DROP 7 · THROW 0
after   DIGIT 0 · SLOT-GAP 0 · RAWMARK 0 · ZERO-WIDTH 0 · RAW-CAPS 0 · DROP 7 · THROW 0
```

All 42 read, individually (`scratch-chr/showdiff.mts` prints the differing window of each). Representative:

```
17,000        - kalikʷatu , notʰi                       + kalikʷatu ijakajə̃li          seventeen THOUSAND
243,610 km²   - tʰaliskohit͡sikʷa nə̃kisko t͡soi , sutaliskohit͡sikʷa skohi
              + tʰaliskohit͡sikʷa nə̃kisko t͡soi ijakajə̃li sutaliskohit͡sikʷa skohi
29.53         - tʰalisko sonela . hiskisko t͡soi        + tʰalisko sonela hiskisko t͡soi
(1923–2008)   - … tʰalisko t͡soi tʰali …                + … tʰalisko t͡soi , tʰali …
1,200 ᎢᏳᏟᎶᏛ (1,900 km)  - sakʷu , tʰaliskohit͡sikʷa … ijut͡ɬilotə̃ sakʷu , sonelaskohit͡sikʷa
                        + ijakajə̃li tʰaliskohit͡sikʷa … ijut͡ɬilotə̃ ijakajə̃li sonelaskohit͡sikʷa
```

Nothing regressed and no reading got worse. The figures at or above 10⁶ move to `numbers.ts`'s documented
digit-by-digit fallback (`33625989` → *t͡soi t͡soi sutali tʰali hiski sonela t͡sanela sonela*), which is the
honest answer where the old reading lost six orders of magnitude.

**Implication.** Register the twelve class refusals and the two per-instance ones, then re-run every gate.

---

## Run 6 — 2026-08-16 — registering the refusals, and one mechanical surprise

Added `ACCEPTED_SIGN_SILENCE.chr` (twelve classes, immediately before `kaa`) and `ACCEPTED_SILENT.chr`
(two instances). **The entry's Cherokee quotes were generated by `scratch-chr/genentry.mts`, which asserts
each literal actually occurs in the retained text before escaping it** — the first hand-typed draft had
mangled quotes, which is exactly the failure a `q()` assertion exists to prevent.

**Question.** Does the class-level refusal close the artifact scan?

**Raw finding.** Only `percent` and `ampersand` were accepted at class level; `currency` and `minus` still
failed. Reading `acceptedSignClass`, each fails for its own mechanical reason and neither is a weak refusal:

- **currency** — the sign here is `¥`, and `SIGN_CASES`'s currency probe is keyed on `$`, so the class test
  never sees a currency in the line at all;
- **minus** — the `DROPPABLE` minus pattern requires a digit AFTER the sign, which a bare `-` handed to
  `covered.test(ch)` can never satisfy. The tl/wuu/mad limitation, one language further on.

Both went to `ACCEPTED_SILENT` by identity. ⚠ **That accept is safe here in a way it is not for ln/rw/sn/bo,
and the reason is the Run 1 measurement rather than a convention: there is no true positive to hide.** 101
hyphens, zero negatives.

**Implication.** Gates.

---

## Gates

| gate | result |
|---|---|
| `corpus-diff compare` | **changed 42/285 (14.7%)**. DIGIT / SLOT-GAP / RAWMARK / ZERO-WIDTH / RAW-CAPS / THROW = **0 on both sides**. **DROP 7 → 7 — did not rise.** |
| `review.ts --lang chr` | **checklist clean.** `sign classes` ok (none dropped) · `clause-final` ok (a trailing `.` or `,` loses no reading) · `sourcing` `[ ?? ]` — *nothing declared, so nothing to source*, which is the correct state for a layer with no tier · `artifact scan` ok (no defects) |
| `referee-eval chr` | **no regression, byte-identical.** wikipron primary 53/183 raw · 168/183 folded · 97.3% symbol accuracy; kaikki secondary 49/179 · 165/179 · 97.3%. A word-level referee cannot see a text-normalization change, and this confirms none leaked. |
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 4607 passed / 5 skipped, **1 failing and it is out of scope**: `languageCatalogue.test.ts` reports `(1 cell(s) differ from the file)` — chr's `normalization` column, now `done` and empty in `catalogue.tsv`. The brief forbids touching `catalogue.tsv` / `languages.db`; fix centrally with `python3 tools/language-catalogue/derive-normalization.py`. Verified the differing cell is chr's and nothing else. |

---

## Backlog surfaced, not fixed

1. **The English ordinal suffix on a Cherokee century, ×4.** `ᎯᎠ ᎢᎬᏱ 20th ᏍᏉᎯᏧᏈ ᏧᏕᏘᏴᏗ` reads
   *tʰaliskohi **tʰˈiːʲˈeᶦt͡ʃ** skʷohit͡sukʷi* — the digits as a Cherokee cardinal and then `th` as two
   ENGLISH LETTER NAMES. Cherokee has an ordinal suffix and the corpus uses it (`ᏔᎵᏁᎢ`, `ᏦᎢᏁᎢ`, `ᏑᏓᎵᏁᎢ`,
   `ᎦᎵᏉᎩᏁᎢ`, `ᏐᏁᎵᏁ`), but `numbers.ts` has no ordinal composer and four instances do not justify authoring
   one over an unattested boundary (what does 20th look like — does the tens word clip?). Also `16th`, `18th`,
   `19th`.
2. **The decade plural, ×6.** `1820s` → *… **ˈɛs*** (the English letter name); `1800Ꮝ` writes the same
   morpheme in SYLLABARY (`Ꮝ` = /s/) and `1900'` writes it as an apostrophe. Three spellings of one thing,
   and the syllabary one already reads. Needs a decade/plural reading nothing attests.
3. **`cm` reads as `km` — trap 56, live.** `5 cm` → *hiski km* and `5 km` → *hiski ˈʊkm*, both via the
   English fallback. Nine instances. Blocked on a Cherokee unit word, and Run 4 says the wiki does not have
   one; what would move it is a source neither the corpus nor the wiki provides (the Cherokee Nation
   Language Department publishes wordlists — the same tier `numbers.ts` already cites for 0–100).
4. **`~` circa, ×5.** Refused on REGISTER, not absence: `ᎬᏩᏚᏫᏛ` is attested ×7/3 and every example
   approximates a quantity, never a date. A dictionary check (playbook trap: a refusal resting on silence
   alone needs one; this one rests on sense, so it stands on the corpus) would settle whether a date-circa
   word exists.
5. **The ISBN reads as four cardinals.** `0-7167-2438-3` → *notʰi kalikʷoki ijakajə̃li skohit͡sikʷa …* —
   digit-group cardinals where a reader says digits. Three citations. Needs a digit-by-digit path keyed on
   the ISBN shape, and the hyphen refusal above is what currently keeps it from being worse.
6. **The `-Ꭿ`/`-Ꮒ` enclitic is emitted as its own word.** `ᏧᏴᏢ ᎠᎹᏰᎵ-Ꭿ` → *t͡sujə̃t͡ɬə̃ amajeli **hi***. The
   tokenizer splits at the hyphen and the enclitic becomes a separate token. Whether that is wrong is a
   question about word boundaries in a segmental-skeleton IPA rather than about normalization, and it is
   left alone deliberately — but it is where a Cherokee reader would look first.
7. **The `clock: 2` cell of the artifact is a false positive.** `\d:\d` is ×0; the cell selector is matching
   something else (probably `(1897/98: pt.1)`). Worth a look when the cell inventory is next audited.
