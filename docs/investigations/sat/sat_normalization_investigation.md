# Santali (sat) text-normalization investigation

Working log for the `norm/sat` branch. Chronological, one entry per run: the command, the question it was
meant to answer, the raw finding, and what that implies for the next step. Negative results are kept.

---

## Run 1 — 2026-08-13 — establish the SCRIPT situation before writing anything

**Question.** Santali is catalogued Ol Chiki but is also written in Devanagari, Bengali, Odia and Latin.
Which does the engine accept, and what does the corpus actually contain? Everything else depends on this.

**Commands.**

    (read) src/languages/santali/santali.ts, santali.jsonc, test/santali.test.ts
    (read) tools/corpus/mined/sat.jsonc  — 96,454 segments, dump-sourced, 442 retained lines

**Raw finding — the engine.** `santali.ts`'s `TOKEN` is

    /([ᱚ-ᱽ]+)|([᱐-᱙]+|\d+)|([.!?…,;:᱾᱿])/gu

so the word class is exactly U+1C5A–U+1C7D, the digit class is Ol Chiki U+1C50–U+1C59 **plus** ASCII, and
the punctuation class already contains ᱾ MUCAAD and ᱿ DOUBLE MUCAAD. There is no Devanagari, Bengali, Odia
or Latin arm anywhere in the engine. Ol Chiki is the only front-end input.

**Raw finding — the `syl` hazard does NOT apply here.** `syl`'s sentence terminator was undeclared *because
it sat inside the range its word class claimed*. Santali's terminators are U+1C7E/U+1C7F, which are ABOVE
the word class's U+1C7D ceiling, and both are declared in the punctuation arm. `cells.ts`'s
`native-terminator` backfill records 374 of this artifact's 442 retained segments as carrying one, and they
are read. **Nothing to fix here** — the first structural hypothesis dies, which is the point of checking.

**Raw finding — the digits.** Ol Chiki has its own digit block and `santali.ts` already folds it
(`toAsciiDigits`, U+1C50–1C59 → ASCII) before composing, and `test/santali.test.ts` already pins
`᱒᱕` ≡ `25`. But the artifact's own counts show how much rides on that: `digit-run` 43,787 of which
**`\d` would miss 40,539** — i.e. 93% of this corpus's digits are Ol Chiki. Same for `year` (43,212 / 40,011
missed), `decimals` (10,681 / 10,344), `percent` (5,315 / 5,234).

**Implication.** Every pattern this layer writes must be keyed on `\p{Nd}`, never `\d` and never `[0-9]`.
An ASCII-only selector would cover ~7% of the corpus and look like it worked. Script question: settled,
Ol Chiki, single script, no fold needed.

---

## Run 2 — 2026-08-13 — character census against the token class

**Question.** Which characters in the corpus fall OUTSIDE the engine's token class and are therefore
DELETED (splitting their word), and does anything read as the empty string? (`bal` 38.9% of paragraphs,
`ki` 7%, `bm` ~222 characters; `ug` 8/429 empty, `ti` 20 numerals.)

**Command.** A census over the artifact's 242 retained segments (87,012 characters), classifying every
character against the three `TOKEN` arms.

**Raw finding — outside the class: 170 distinct characters, 3,971 occurrences (4.6% of all characters).**
In-class: word 36 distinct / 62,600; digit 20 distinct / 2,656; punctuation 7 distinct / 1,890.
The outside set, by group:

| group | occurrences | examples |
|---|---:|---|
| Latin letters | ~2,900 | glosses, names, URLs, `IAST:` transliterations |
| brackets / quotes | 506 | `(` ×190 `)` ×190 `"` ×64 `'` ×37 `[` `]` |
| hyphen / dashes | 178 | `-` ×171, `–` ×6, `—` ×1 |
| signs | 174 | `%` ×45 `=` ×35 `²` ×27 `°` ×24 `&` ×17 `×` ×11 `÷` ×10 `+` ×10 `<` ×6 |
| currency | 25 | `$` ×19 `₹` ×4 `€` ×1 `£` ×1 |
| slash / pipe / misc | 49 | `/` ×36 `\|` ×7 `*` ×5 `•` ×3 |
| invisibles | 23 | ZWNJ ×15, ZWJ ×7, ZWSP ×1, plus LRM/PDF |
| other scripts | ~60 | Arabic ×25, Cyrillic ×15, Han ×10, Bengali ×15, IPA letters ×20 |

**Raw finding — the script question, closed from the other side.** There is **no running text in any other
script**. The Bengali is 15 single characters (one gloss), the Arabic 25 (two glosses), the Han 10 (one
proper name, 中国巴基斯坦经济走廊). Santali's other orthographies are simply not on this wiki. So — unlike the
hypothesis the brief raised — there is no Devanagari/Bengali/Odia arm to write, and writing one would have
been a no-op. Recorded as a NEGATIVE result.

**Raw finding — one character inside the word class reads as NOTHING.** Of the 36 Ol Chiki characters
present, 35 are mapped by `santali.jsonc` (or handled as a sign in `santali.ts`). The 36th is
**U+1C7B OL CHIKI RELAA ⟨ᱻ⟩ ×5**. It is inside `TOKEN`'s `[ᱚ-ᱽ]` word class, so it is consumed — and then
no branch of `phonemizeWord` claims it, so it contributes the empty string. This is the `ug`/`ti`
empty-reading class, one level down: not an empty *segment*, an empty *character* inside a live word.

**Raw finding — the empty-reading probe.** 0 of 242 segments read as the empty string. At token level,
13,980 word tokens produced 4 distinct empty readings, 27 occurrences — all of them ORPHAN SIGNS standing
alone between spaces: `ᱹ` ×16, `ᱼ` ×8, `ᱺ` ×2, `ᱹᱹᱹ` ×1.

**Implication.** Two leads to read, not yet findings: what RELAA is doing in those 5 words, and what a
bare spaced `ᱼ` PHAARKAA is doing 8 times.

---

## Run 3 — 2026-08-13 — reading the orphan signs

**Question.** Are the 27 empty-reading orphan-sign tokens noise, or a shape?

**Raw finding — ⟨ᱼ PHAARKAA⟩ SPACED IS A RANGE DASH.**

    ᱑᱘᱔᱘ ᱼ ᱔᱙ ᱥᱟᱞᱮ            (1848–49)
    (ᱨᱚᱣᱟᱞᱰ ᱟᱢᱩᱱᱰᱥᱮᱱ /᱑᱘᱗᱒ ᱼ ᱑᱙᱒᱘)   (1872–1928, a life-dates parenthetical)

The character is the Ol Chiki consonant-checking sign, being used as a **hyphen substitute** — it is the
code point immediately below AHAD and immediately above RELAA, and it looks like a dash. Digit-flanked
`ᱼ` is ×4; spaced `ᱼ` is ×2 more. It reads as nothing today, so the range joiner is silently deleted.

**Raw finding — ⟨ᱻ RELAA⟩ is also a separator, not a letter.** All five instances:

    ᱵᱮᱲᱟᱻᱫᱚ      ᱢᱤᱻᱢᱤᱫ      ᱛᱤᱻ ᱛᱮ      ᱮᱱᱮᱡᱻᱮ      ᱱᱟᱜᱟᱨᱻᱮ

`ᱢᱤᱻᱢᱤᱫ` is decisive: the SAME PARAGRAPH writes `ᱢᱤ-ᱢᱤᱫ` two clauses earlier, with an ASCII hyphen, for the
same reduplicated word. And `ᱱᱟᱜᱟᱨᱻᱮ` / `ᱮᱱᱮᱡᱻᱮ` are noun + the enclitic `ᱮ`, which this corpus otherwise
writes with ⟨ᱼ PHAARKAA⟩ (`ᱢᱮᱱᱟᱜᱼᱟ`, `ᱥᱮᱴᱮᱨᱚᱜᱼᱟ`, ×333). So RELAA U+1C7B is a **keyboard slip for
PHAARKAA U+1C7C, the adjacent code point** — the `ki` keyboard-substitute class exactly.

**Implication.** Five instances is a lead, not a rule. Held; see Run 8.

---

## Run 4 — 2026-08-13 — baseline gates, before any edit

**Question.** What does each gate say today, and which of them can even MEASURE this language?

    npx tsx tools/normalization/corpus-diff.ts emit --lang sat --corpus mined:sat --out <before>
    npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/sat.jsonc --lang sat
    npx tsx tools/referee-eval/eval.ts sat
    npx tsx tools/normalization/review.ts --lang sat
    npx tsx tools/normalization/sources.ts --lang sat

**Raw finding — `corpus-diff emit`: 441 utterances.** Note the invocation: `--corpus mined:sat`. There is
no FLEURS `sat` directory, and `--corpus sat` throws `ENOENT scandir 'sat'` — the artifact route is the
only one.

**Raw finding — `mine.ts scan`:**

    DROP percent   ×28      DROP math-sign ×26      DROP currency ×17
    DROP degree    ×12      DROP minus     ×6       DROP ampersand ×6
    DROP exponent  ×2       LEAK RAW-LATIN ft ×1    LEAK RAW-LATIN pk ×1

**Raw finding — `referee-eval sat`: raw exact 419/490 (85.5%), folded backbone 455/490 (92.9%), symbol
accuracy 97.1%.** The referee is 490 single-headword entries from ONE source (kaikki), flagged
`secondary-source gap: single-source`. **Every residual is a g2p question** (`ato ≠ ɔto`, `ɟ ≠ c~ɟ`,
`h ≠ ʰ`), and 7 of the 12 residual classes are single Ol Chiki LETTERS quoted as citation forms.

⚠ **So `referee-eval` is a TRIPWIRE here, not a meter.** It scores headwords; this layer rewrites running
text and touches no headword, so its correct after-value is *unchanged*. A move in either direction means I
broke the g2p. Named as such up front so a flat number is not later reported as a result.

**Raw finding — `sources.ts`:** espeak does not ship Santali at all, so `letter-names` and `decimal-point`
are `[NONE]` with no haystack behind them. `scale-names` is `[ ?? ]` — "the scale probe reads LATIN
spellings and this corpus is not Latin" — but it prints the degree-adjacent corpus tokens, and two of them
are the answer: **ᱥᱮᱞᱥᱤᱭᱚᱥ ×1 and ᱥᱮᱞᱥᱤᱭᱚᱱ ×1**. `unit-word` reports the corpus writes `km` ×21, `mm` ×2,
`mw` ×1 after a number. Eight sign classes come back `[chk?]`.

**Raw finding — `review.ts`:** one line, `[FAIL] normalizer … missing`. It can say nothing else until the
file exists.

**Implication — which gates are METERS and which are TRIPWIRES for sat:**

| gate | role | why |
|---|---|---|
| `corpus-diff compare` | **METER** | the only instrument that measures this layer's actual output over real text |
| `mine.ts scan` | **METER** | counts the DROP/LEAK classes a rule is supposed to close |
| `review.ts` | **METER** (checklist) + prompt | but a sourced refusal must stay RED (trap 24) |
| `referee-eval` | **TRIPWIRE** | headword-only; must not move |
| `vitest` / `tsc` | **TRIPWIRE** | cross-language regression |
| `sources.ts` / `attest.ts` | neither | sourcing prompts; availability is not correctness |

---

## Run 5 — 2026-08-13 — counting the shapes

**Question.** What does this corpus actually write, measured rather than assumed?

**Command.** A tabulation over the 242 retained segments using `tools/normalization/count.ts`'s
`matches`/`DIGIT` (never `\d`, never `\b`).

    195  intra-word DOT  ⟨olchiki⟩.⟨olchiki⟩       126  comma grouped digits
    100  hyphen Ol-Chiki-flanked                    84  decimal dot d.d
     78  dot after Ol Chiki, before a space         67  digit + Latin unit run
     45  percent after digit                        27  ²/³
     25  currency sign before digit                 24  °  (9 °C/°F, 6 coordinate, 9 other)
     23  ZWNJ/ZWJ/ZWSP                              22  = digit-flanked
     21  hyphen digit-flanked (range)               20  colon clock d:d
     11  slash digit-flanked                        17  &
     10  × digit-flanked                            10  ÷ digit-flanked
      5  en dash – digit-flanked                     4  + digit-flanked
    549  Latin run ≥2                              883  ᱾ MUCAAD (already read)

**Implication.** The largest single shape is not a number rule at all. It is a DOT inside Ol Chiki words,
at 195 + 78 = 273 occurrences — more than percent, currency, degrees, ranges, clocks, exponents and every
math sign put together. Run 6 reads it.

---

## Run 6 — 2026-08-13 — the intra-word dot, read rather than counted

**Question.** What is a `.` doing between two Ol Chiki letters 195 times? (Trap 2: read the instances.)

**Raw finding.** Two senses, and the corpus proves both.

**(a) THE ASCII DOT IS A TYPEWRITER SUBSTITUTE FOR ⟨ᱹ GAAHLAA⟩ (U+1C79).** Examples:

    ᱞᱟ.ᱜᱤᱫ   ᱠᱟ.ᱱᱩᱱ   ᱨᱩᱣᱟ.   ᱴᱷᱟ.ᱣᱠᱟ.ᱱ   ᱟ.ᱰᱤ   ᱢᱤᱫᱴᱟ.ᱝ   ᱵᱷᱟᱨᱚᱛᱤᱭᱟ.   ᱦᱩᱞᱥᱟ.ᱭ

Three independent measurements say so:

1. **The letter BEFORE the dot has the same distribution as the letter before the real sign.**

        before an ASCII dot:  ᱟ ×226  ᱤ ×11  ᱢ ×11  ᱞ ×6  ᱠ ×6  ᱥ ×5  ᱮ ×5  ᱨ ×3  ᱩ ×3  …
        before ᱹ GAAHLAA:     ᱟ ×1171 ᱮ ×5   ᱤ ×3   ᱢ ×2  ᱷ ×1  ᱵ ×1  ᱩ ×1

   ᱟ dominates both. GAAHLAA is a VOWEL diacritic, and 246 of the 283 dots follow a vowel letter.

2. **55 of the 142 distinct dotted word-forms have their EXACT GAAHLAA twin elsewhere in the same 242
   segments** — an in-corpus minimal pair, not a hypothesis:

        ᱞᱟ.ᱜᱤᱫ == ᱞᱟᱹᱜᱤᱫ    ᱟ.ᱰᱤ == ᱟᱹᱰᱤ      ᱠᱟ.ᱢᱤ == ᱠᱟᱹᱢᱤ     ᱨᱩᱣᱟ. == ᱨᱩᱣᱟᱹ
        ᱢᱤᱫᱴᱟ.ᱝ == ᱢᱤᱫᱴᱟᱹᱝ  ᱵᱟ.ᱲᱛᱤ == ᱵᱟᱹᱲᱛᱤ   ᱯᱟ.ᱨᱥᱤ == ᱯᱟᱹᱨᱥᱤ  ᱟ.ᱱᱟ.ᱨᱤ == ᱟᱹᱱᱟᱹᱨᱤ

3. The words are the commonest in the language — `ᱞᱟᱹᱜᱤᱫ` "for", `ᱟᱹᱰᱤ` "very", `ᱢᱤᱫᱴᱟᱹᱝ` "one",
   `ᱠᱟᱹᱢᱤ` "work" — which is what a keyboard-layout artefact looks like.

**(b) A NATIVE DOTTED ABBREVIATION, spelling a Latin initialism in Ol Chiki letters.** The whole set,
read one by one:

    ᱠ.ᱢ. ×4  = km          ᱢ. ×4   = m           ᱠ.ᱞ. ×2  = an ERA marker (᱑᱙᱓ ᱠ.ᱞ. - ᱑᱗᱐ ᱠ.ᱞ.)
    ᱮᱢ. ᱮ. ×2 = M.A.       ᱮᱯ. ᱮ. = F.A.         ᱮᱞ. ᱴᱤ. = L.T.      ᱰᱨ. = Dr.
    ᱯᱤ.ᱮᱥ.ᱮᱞ.ᱵᱷᱤ = PSLV    ᱤ.ᱥ.ᱥ.ᱯᱷ. ×2 = ISSF    ᱟᱨ.ᱮᱱ.ᱟᱭ ×2 = RNI   ᱭᱩ.ᱴᱤ.ᱥᱤ = UTC
    ᱮᱢ.ᱤ. = M.E.           ᱮᱞ. = "No." in a gazette citation

**The discriminator, and it falls out of the data rather than being imposed.** GAAHLAA is a vowel
diacritic and cannot attach to a consonant; every one of the 37 consonant-preceded dots is in list (b) and
every one of the ~120 GAAHLAA word-forms takes its dot after a vowel. The residue is a token-final dot
after a vowel, which both lists contain (`ᱨᱩᱣᱟ.` vs `ᱮ.`) — separated by LENGTH: the shortest token-final
GAAHLAA form in the corpus is 3 letters (`ᱩᱞᱟ.`, `ᱤᱱᱟ.`), and every list-(b) token-final-after-vowel form
is 1–2 letters (`ᱮ.`, `ᱴᱤ.`, `ᱮᱢ.`, `ᱮᱞ.`, `ᱰᱨ.`).

**And the two rules CONVERGE where they overlap, which is why the residue is cheap.** `ᱯᱤ.` in PSLV,
`ᱤ.` in ISSF and `ᱭᱩ.`/`ᱴᱤ.` in UTC are vowel-preceded and would be read as GAAHLAA — but
`santali.jsonc`'s `gahla` maps `i→i` and `u→u`, so the substitution is phonologically a NO-OP and its only
effect is the one wanted anyway: the spurious phrase break goes away.

**What it costs today.** `.` is in `TOKEN`'s punctuation arm, so every one of these 273 dots is currently a
CLAUSE PAUSE inside a word. `ᱞᱟ.ᱜᱤᱫ` reads as *la* ‖ *ɡid* — two fragments and a phrase break, where the
word is *ləɡitʼ*. This is the single largest defect in the language and it is not a number rule.

---

## Run 7 — 2026-08-13 — probing the engine on every attested shape

**Question.** Step 2 of the playbook: what does the engine ACTUALLY produce for each shape counted in
Run 5? (The defect list is what the engine produces, not what I assume.)

**Raw finding.**

    ᱞᱟ.ᱜᱤᱫ        → "la . ɡitʼ"       (vs ᱞᱟᱹᱜᱤᱫ → "ləɡitʼ")   wrong vowel + split + false pause
    ᱨᱩᱣᱟ.         → "ruwa ."          (vs ᱨᱩᱣᱟᱹ → "ruwə")
    ᱑᱐,᱐᱐᱐ ᱦᱚᱲ    → "ɡel , sun hɔɽ"                    TEN, ZERO — the quantity is destroyed
    ᱒᱒.᱓᱓         → "bar ɡel bar . pe ɡel pe"          a clause break inside a number
    ᱓᱐ᱹ᱑%         → "pe ɡel mitʼ"                       the ᱹ separator vanishes: 30 1, silently merged
    ᱕᱐%           → "mɔɳe ɡel"                          percent DROPPED
    ᱓᱐ °C         → "pe ɡel sˈiː"                       ⟨C⟩ read as the ENGLISH letter name "see"
    $᱕᱐᱐ / ₹᱕᱐᱐   → "mɔɳe saj"                          currency DROPPED
    ᱕ km          → "mɔɳe ˈʊkm"                         raw Latin through the English fallback
    ᱕ km²         → "mɔɳe ˈʊkm skwˈɛɹd"                 …and "squared", in ENGLISH
    1st           → "mitʼ stɹˈiːt"                      "1st" read as the English word STREET
    ᱦᱚᱲ (Santal)  → "hɔɽ sˈæntɑːɫ kana"                 a Latin gloss read as English
    ᱒᱐:᱑᱗         → "bar ɡel , ɡel ejaj"                clock fields separated by a pause
    ᱑᱙᱔᱕-᱑᱙᱔᱖     → "…mɔɳe mitʼ haɟar…"                  two numbers run together, no joiner
    ᱦᱚ‌ᱲ (ZWNJ)    → "hɔ ɽ"                              a zero-width character SPLITS the word
    ᱢᱮᱱᱟᱜ-ᱟ       → "menakʼ a"       (vs ᱢᱮᱱᱟᱜᱼᱟ → "menakʼa")   one word read as two

**⚠ THE LATIN IS NOT DELETED — IT IS READ AS ENGLISH.** This is the trap-56 class, the one no counter
sees. `TOKEN` has no Latin arm, but `assembleClauses` routes an unmatched Latin run to the English
fallback, so `1st` becomes *street* and `km²` becomes *ˈʊkm skwˈɛɹd*. A DROP would have been visible; a
plausible English word is not. 549 Latin runs ≥2 characters in 242 segments.

**Implication.** Ranked by count × severity, the layer's job is: the GAAHLAA dot (246), de-grouping (126),
the decimal separators (84 + 16), the unit/percent/currency vocabulary, the invisibles (23), and the
range joiner (21+). The clock and the math signs need reading before any rule (Runs 9, 10).

---

## Run 8 — 2026-08-13 — the ASCII hyphen is ⟨ᱼ PHAARKAA⟩ too, and the wiki says so

**Question.** 100 ASCII hyphens sit between Ol Chiki letters. Compound hyphens, or another typewriter
substitute?

**Raw finding — the suffix distributions are the same word.**

    after an ASCII hyphen:   -ᱟ ×70  -ᱛᱚᱞ ×3  -ᱥᱟᱢᱟᱝ ×2  -ᱵᱤᱥᱟᱹᱨ ×2  -ᱢᱤᱫ ×1  …
    after ⟨ᱼ PHAARKAA⟩:      ᱼᱟ ×275 ᱼᱟᱜ ×3   ᱼᱮ ×2      ᱼᱵᱤᱥᱟᱹᱨ ×2  ᱼᱢᱤᱫ ×1  …

`ᱢᱮᱱᱟᱜ-ᱟ` ×30 against the corpus's own `ᱢᱮᱱᱟᱜᱼᱟ`; `-ᱵᱤᱥᱟᱹᱨ` ×2 against `ᱼᱵᱤᱥᱟᱹᱨ` ×2 — the SAME compound
spelled both ways. `-ᱟ` is the finite-verb suffix and carries 70 of the 99.

**Raw finding — an independent corroboration, from the wiki's own Ol Chiki article** (surfaced by
`attest.ts` while probing something else). It names all five diacritics:

> ᱚᱞᱪᱤᱠᱤ ᱨᱮᱭᱟᱜ ᱡᱟᱯᱟᱜ ᱪᱤᱠᱤ ᱨᱮᱭᱟᱜ ᱧᱩᱛᱩᱢ ᱠᱚᱫᱚ ᱦᱩᱭᱩᱜ ᱠᱟᱱᱟ ᱢᱩ ᱴᱩᱰᱟᱹᱜ (ᱸ), ᱜᱟᱹᱦᱞᱟᱹ ᱴᱩᱰᱟᱹᱜ (ᱹ), ᱨᱮᱞᱟ (ᱻ), **ᱯᱷᱟᱨᱠᱟ (-)** ᱟᱨ ᱚᱦᱚᱫ (ᱽ)

The article glosses PHAARKAA **with an ASCII hyphen** in its own parenthesis. The substitution is not my
inference; it is the wiki's own typing practice, stated in the article about the script.

**Raw finding — what it costs, measured.** `ᱢᱮᱱᱟᱜ-ᱟ` → *menakʼ a*, `ᱢᱮᱱᱟᱜᱼᱟ` → *menakʼa*. The PHONEMES
are identical; what differs is the word boundary. Much milder than the dot, whose vowel is also wrong.

**Implication.** Fix only the shape that is measured — the finite-verb enclitic — and leave the ~29
genuine compound hyphens (`ᱚᱞ-ᱛᱚᱞ`, `ᱤᱱᱰᱚ-ᱤᱭᱩᱨᱚᱯᱤᱭᱟᱱ`, `ᱟᱞ-ᱟᱦᱨᱟᱢ`) alone, where two words is right.
Trap 9: widen a guard only for a shape you have counted.

---

## Run 9 — 2026-08-13 — sourcing, and four words that look right and are not

**Question.** Which readings can be sourced, with a SENSE that has been read?

**Commands.** `sources.ts --lang sat`; token frequency over the artifact; `attest.ts --lang sat --words …`
(three batches, default `--limit`).

**SOURCED, with the sense read:**

| slot | word | evidence |
|---|---|---|
| `%` | **ᱯᱨᱚᱛᱤᱥᱚᱛ** | wiki 12 tok / 6 arts. ⚠ ONE SENTENCE CARRIES THE WORD AND THE SIGN TOGETHER: `᱖᱔.᱘ ᱯᱨᱚᱛᱤᱥᱚᱛ ᱥᱮᱪᱮᱫ … ᱚᱱᱟ ᱠᱷᱚᱱ ᱗᱕.᱓% ᱠᱚᱲᱟ ᱟᱨ ᱕᱓.᱗% ᱛᱤᱨᱞᱟᱹ` — the word and `%` glossing each other. Postposed. Competitor ᱯᱟᱨᱥᱮᱱᱴ 8/8 recorded |
| `$` | **ᱰᱚᱞᱟᱨ** | wiki 45/12; the article states it: `ᱢᱟᱨᱠᱤᱱ ᱰᱚᱞᱟᱨ (ᱯᱚᱛᱥᱟ ᱪᱤᱱᱦᱟᱹ: $ …)` — "currency SIGN: $". Postposed: `᱑ ᱰᱚᱞᱟᱨ ᱑᱐᱐ ᱥᱮᱱᱴ`. Also corpus ×13 |
| `৳`/`₹` | **ᱴᱟᱠᱟ** | wiki 56/11; `ᱵᱟᱝᱞᱟᱫᱮᱥᱤ ᱴᱟᱠᱟ (… ᱪᱤᱱᱦᱟᱹ: ৳ …)` for ৳. For ₹ the CORPUS is the source: `₹᱕᱐᱐ ᱠᱳᱴᱤ ᱴᱟᱠᱟ` — the sign and the word in one phrase (a weaker tier; recorded as such) |
| units | **ᱠᱤᱞᱚᱢᱤᱴᱚᱨ ᱢᱤᱴᱚᱨ ᱥᱮᱱᱴᱤᱢᱤᱴᱚᱨ ᱢᱤᱞᱤᱢᱤᱴᱚᱨ** | corpus ×11/17/7/1; wiki ᱠᱤᱞᱚᱢᱤᱴᱚᱨ 87/17, glossed against miles: `᱖᱘,᱐᱔᱓ ᱠᱤᱞᱚᱢᱤᱴᱚᱨ (᱔᱒,᱒᱘᱐ ᱢᱟᱭᱤᱞ)`. Postposed |
| `²` | **ᱵᱚᱨᱜᱚ**, position BEFORE | wiki 39/10, and the COLLOCATION not the bare word (trap 37): `ᱯᱚᱨᱚᱛᱤ ᱵᱚᱨᱜᱚ ᱠᱤᱢᱤ ᱨᱮ ᱑᱑᱐᱑` (per square km), `᱑᱒᱘.᱖᱔ ᱵᱚᱨᱜᱚ ᱠᱤᱢᱤ` |
| `°C` | **ᱰᱤᱜᱨᱤ ᱥᱮᱞᱥᱤᱭᱚᱥ** | wiki `᱓᱓.᱘ ᱰᱤᱜᱨᱤ ᱥᱮᱞᱥᱤᱭᱟᱥ ᱟᱨ ᱡᱚᱢ ᱫᱚ ᱑᱔.᱕ ᱰᱤᱜᱨᱤ ᱥᱮᱞᱥᱤᱭᱟᱥ` — the whole reading, in order. Corpus: `᱒᱙° ᱠᱷᱚᱱ ᱓᱖° ᱥᱮᱞᱥᱤᱭᱚᱥ` |
| range | **ᱠᱷᱚᱱ** (infix) | the CORPUS, many times, always BETWEEN the two numerals: `᱑᱕ ᱠᱷᱚᱱ ᱒᱕ °C`, `᱒᱐᱐᱒ ᱠᱷᱚᱱ ᱒᱐᱐᱗ ᱥᱟᱞᱮ ᱫᱷᱟᱹᱵᱤᱡ`, `᱗ ᱠᱷᱚᱱ ᱙ ᱢᱟᱹᱦᱤᱛ`, `$᱑᱐ ᱠᱷᱚᱱ $᱑᱐᱐᱐ ᱫᱷᱟᱹᱵᱤᱡ`. ⚠ PART-OF-SPEECH CHECKED (the Fula `hakkunde` lesson): it is an INFIX in every instance, not a preposition governing both operands. Also in the referee (ᱠᱷᱚᱱ / kʰɔn) |

**⚠ FOUR WORDS THAT LOOK RIGHT AND ARE NOT — each would have shipped a confidently wrong reading:**

- **ᱯᱟᱨᱥᱮᱛ ×3** looks exactly like *percent*. It is **PRESIDENT**: `ᱵᱷᱟᱨᱚᱛ ᱫᱤᱥᱚᱢ ᱨᱤᱱᱤᱡ ᱯᱟᱨᱥᱮᱛ ᱜᱚᱢᱠᱮ`,
  `ᱪᱟᱭᱱᱤᱡ ᱯᱟᱨᱥᱮᱛ ᱜᱚᱢᱠᱮ ᱥᱤ ᱡᱤᱱᱯᱤᱝ`. The trap-37 near-miss, in the highest-traffic rule the layer has.
- **ᱰᱤᱜᱽᱨᱤ ×1** (with AHAD) is the ACADEMIC degree: `ᱥᱚᱱᱮᱨ ᱰᱤᱜᱽᱨᱤ ᱥᱟ.ᱛ ᱞᱮᱫᱟᱭ`, "took an honours degree" —
  precisely the `ki digirii` case the playbook names. The unit word is ᱰᱤᱜᱨᱤ *without* the AHAD, and only
  the SLOT (digit-adjacent, before a scale name) separates them, not the spelling.
- **ᱯᱚᱭᱮᱱᱴ ×36/10** — every hit is a PLACE NAME: *Indira Point*, *Zero Point*, *Parsons Point*. Not the
  decimal point. The zu `amaphuzu` shape.
- **ᱰᱚᱴ ×11/8** — *Red Dot Foundation*, and `ᱰᱚᱴ ᱮᱪᱴᱤᱮᱢᱮᱞ` (dot html), a URL. Not the decimal point.
- (and **ᱵᱤᱱᱫᱩ ×33/13** is the actress **Bindu**.)

**DECLINED, with the counts and the reason:**

- **THE DECIMAL WORD. Declined on REGISTER, not on absence** — and this is the one that needed care.
  `ᱴᱩᱰᱟᱹᱜ` IS attested (29 tok / 13 arts) and it IS the Santali word for the mark: the Ol Chiki article
  quoted in Run 8 names ⟨ᱹ⟩ as **ᱜᱟᱹᱦᱞᱟᱹ ᱴᱩᱰᱟᱹᱜ**. But that is what the mark is CALLED, in a script
  article — the hi `धन` failure exactly, a correctly-sourced word from the wrong register. Nothing
  attests `᱒᱒ ᱴᱩᱰᱟᱹᱜ ᱓᱓` as how a reader says 22.33, and the three obvious loans are all the wrong sense
  above. ⚠ **Trap 53 — the refusal is PRICED.** Stripping the separator would read `᱒᱒.᱓᱓` as *twenty-two
  thirty-three*, INVENTING a quantity. So the dot STAYS and keeps its pause, which is not a wrong word;
  and the 16 GAAHLAA decimals are folded ONTO that same behaviour rather than continuing to vanish. The
  refusal costs nothing it did not already cost, and closes a silent merge.
- **THE CLOCK.** ⚠ Trap 55, and the count is the argument. Of the 20 `d:d` instances, at least 5 are
  SPORTS TIMES (`᱑0:᱔᱔.᱖᱕ ᱥᱮᱠᱮᱸᱰ`, `᱑:᱐᱖.᱑᱙ ᱴᱤᱯᱤᱡ` butterfly, `᱑:᱐᱕.᱒᱗`, `᱒:᱑᱙.᱖᱐`, `᱑᱕:᱔᱒.᱖᱗`) and one
  is a UTC offset (`GMT +6:30`). A `ceb`-shaped bare-colon clock would claim every one of them. No
  Santali clock idiom is attested — the single `᱒:᱓᱘ ᱴᱟᱲᱟᱝ` is one instance, a lead not a rule.
- **THE MATH SIGNS `= + × ÷ <`.** ⚠ Read rather than counted, and they are ONE ARTICLE: the wiki's
  arithmetic/zero article, `᱐ × ᱑ = ᱐`, `᱐ ÷ ᱑ = ᱐`, `᱑ + ᱐ = ᱑`, `᱑<᱒<᱓`. `ᱵᱟᱨᱟᱵᱟᱹᱨᱤ` ("equal") IS
  attested — `ᱢᱤᱫ ᱟᱢᱮᱨᱤᱠᱟᱱ ᱰᱚᱞᱟᱨ ᱫᱚ $᱗.᱗᱕ ᱥᱟᱶ ᱵᱟᱨᱟᱵᱟᱹᱨᱤ ᱟ` — but as a POSTPOSITIONAL predicate taking
  `ᱥᱟᱶ` ("with"), never as an infix, so `᱑ + ᱐ ᱵᱟᱨᱟᱵᱟᱹᱨᱤ ᱑` would be ungrammatical. The Fula
  part-of-speech lesson. Nothing read.
- **`&` ×17.** Every instance is `&nbsp;` markup residue or the English org name *Defence Research &
  Development Organisation*. Not a Santali conjunction. Nothing read — but the `&nbsp;` is repaired to a
  SPACE, because it sits between a number and its unit (`83,883&nbsp;km²`) and breaks the adjacency the
  unit tier matches on.
- **THE ERA MARKER ᱠ.ᱞ. ×2.** `᱑᱙᱓ ᱠ.ᱞ. - ᱑᱗᱐ ᱠ.ᱞ.` is plainly a BC-equivalent, but `ᱠᱷᱨᱤᱥᱴ ᱞᱟᱦᱟ` and
  `ᱠᱷᱨᱤᱥᱴᱚ ᱞᱟᱦᱟ` both come back 0/0. Left as an initialism (Run 11), not expanded.
- **`°F` ×2 and the coordinate `°N/E/S/W` ×6.** No Fahrenheit word and no sourced direction words, so
  the whole match is refused rather than half of it (trap 53's `ak` shape).

---

## Run 10 — 2026-08-13 — a web sourcing pass, and it CORRECTED three of my choices

**Question.** The corpus and `attest.ts` had settled most slots. What does a wider search (sat.wikipedia's
CirrusSearch with `insource:` regex, en.wiktionary, r12a's orthography notes, the Unicode encoding
material) say about the ones that were thin?

**Raw finding — three of my picks were wrong or second-best, and one gate had handed me a school.**

1. **PERCENT: ᱥᱟᱭᱠᱚᱲᱟ, not ᱯᱨᱚᱛᱤᱥᱚᱛ.** I had shipped the Indo-Aryan loan on 12 tok / 6 arts. The native
   calque is **63 tok / 13 arts** by this repo's own `attest.ts` — 5× the count, same postposed slot
   (`᱕᱒.᱖᱒ ᱥᱟᱭᱠᱚᱲᱟ ᱠᱚᱲᱟ ᱟᱨ ᱔᱗.᱓᱘ ᱥᱟᱭᱠᱚᱲᱟ ᱛᱤᱨᱞᱟᱹ`) — and it is literally "per hundred" on `ᱥᱟᱭ` = 100,
   which is the engine's OWN hundred word in `numbers.ts`. Composed from attested pieces, the Fula
   `e teemedere` move. Changed.
2. **⚠ ᱥᱮᱞᱥᱤᱭᱚᱱ IS "SALESIAN".** `sources.ts`'s degree-adjacent list printed `ᱥᱮᱞᱥᱤᱭᱚᱥ ×1` and
   `ᱥᱮᱞᱥᱤᱭᱚᱱ ×1` side by side, which reads exactly like two spelling variants of Celsius. Wiki-wide
   ᱥᱮᱞᱥᱤᱭᱚᱱ is 2 hits: one a typo inside a Celsius range, the other **Salesian College**
   (`ᱥᱮᱞᱥᱤᱭᱚᱱ ᱠᱚᱞᱮᱡᱽ ᱨᱮᱱᱟᱜ ᱛᱷᱟᱯᱚᱱ ᱫᱚ ᱑᱙᱓᱓`). I had picked ᱥᱮᱞᱥᱤᱭᱚᱥ, so nothing shipped wrong — but I
   picked it on a coin-flip and it was a coin-flip between a unit and a school. Trap 37, arriving from a
   gate's own output. (`attest.ts`: ᱥᱮᱞᱥᱤᱭᱚᱥ 35/14 vs ᱥᱮᱞᱥᱤᱭᱟᱥ 33/12 — a dead heat, recorded as one.)
3. **⚠ ⟨ᱻ RELAA⟩ HAS A LEGITIMATE FUNCTION and my step 2 was BLIND.** I had rewritten every RELAA to
   PHAARKAA on the strength of five corpus instances. RELAA is the vowel-LENGTH mark and "may combine
   with any oral or nasal vowel". Narrowed to the CONSONANT case, where the length reading is impossible:
   that repairs `ᱮᱱᱮᱡᱻᱮ` (after ᱡ), `ᱱᱟᱜᱟᱨᱻᱮ` (after ᱨ) and the wiki's `ᱦᱩᱭᱩᱜᱻᱟ` (after ᱜ), and leaves the
   three vowel-preceded ones alone. Those three stay UNREAD, which is a real residual gap and belongs to
   `santali.ts`'s sign machinery (RELAA has no branch there at all), not to a normalization rule.

**Raw finding — the arithmetic signs are NOT a vocabulary gap.** Santali has a complete native set, each
with its own sat.wikipedia article stating its sign: `+` **ᱥᱮᱞᱮᱫ** (44 tok / 11 arts, and in en.wiktionary
from Hansdah's *Concise English-Santali Dictionary*), `−` **ᱵᱷᱮᱜᱮᱫ**, `×` **ᱜᱟᱵᱟᱬ**, `÷` **ᱦᱟᱴᱟᱬ**,
`=` **ᱥᱚᱢᱟᱱ ᱪᱤᱱᱦᱟᱹ**. All five are visible in this corpus's own arithmetic paragraph, which I had read in
Run 6 without recognising them. **They are operation NOUNS and the articles' own worked examples put the
infix on `ᱟᱨ`**: `᱒+᱓ = ᱕ (ᱢᱮᱱᱫᱚ ᱒ ᱟᱨ ᱓ ᱥᱮᱞᱮᱫ ᱞᱮᱠᱷᱟᱱ ᱕ ᱦᱩᱭᱩᱜᱼᱟ)`, with subtraction taking the ablative
`ᱠᱷᱚᱱ` on the minuend. So the refusal stands, but its GROUND changed from "no word" to "the frame is a
restructure worth one article's instances" — a far better refusal, and a re-runnable one.

**Raw finding — the era marker.** `insource:"ᱠ.ᱞ."` returns exactly ONE article, the same one, and its
full text never expands the abbreviation. The words Santali does spell out are different strings:
BC = ᱠᱷᱤᱥᱴᱚᱯᱩᱨᱵᱚ (14/10), AD = ᱠᱷᱨᱤᱥᱴᱟᱵᱽᱫᱚ (19/12), both already words in running text and needing no
rule. `ᱠ.ᱞ.` is left as an initialism rather than mapped onto either on the strength of the resemblance.

**Raw finding — the ASCII-dot convention is far bigger than my sample showed.** `ᱟ.ᱰᱤ` alone returns
**970 hits** wiki-wide and whole articles are written in the convention. And `insource:/[᱐-᱙]ᱹ[᱐-᱙]/`
returns **704** — the GAAHLAA-as-decimal-separator is corpus-wide, not a local quirk of my 16 instances.

**Implication.** Two words changed, one rule narrowed, one refusal re-grounded. The corpus route had
given me the right shape of every rule and the wrong word twice — which is the sibling-is-a-hypothesis
lesson (trap 55) applied to a SOURCE rather than to a language.

---

## Run 11 — 2026-08-13 — writing the layer, and what the corpus diff found that no probe did

**Command.** `normalize.ts` written, wired into `santali.ts`'s `text()`, then
`corpus-diff.ts emit`/`compare` against the Run 4 baseline.

**Raw finding — two bugs the unit probes could not see (trap 3, budgeted for and earned).**

1. **The vowel class glued an acronym shut.** Arm (a) of the dot rule fired on any vowel + dot, so PSLV's
   first dot (after ᱤ) became a GAAHLAA and `ᱯᱤ.ᱮᱥ.ᱮᱞ.ᱵᱷᱤ` read *pies el bʱi*. I had reasoned that the
   overlap was free because `gahla` maps `i→i` — true, and irrelevant: **a no-op SUBSTITUTION still JOINS
   two segments where a space was wanted.** Narrowed to ⟨ᱟ⟩, which carries 226 of the 246 vowel-preceded
   dots and 1,171 of the 1,181 real signs, and every non-ᱟ dotted token in the corpus is an initialism.
2. **The range rule claimed a clock field.** `᱑᱐:᱓᱐ - ᱑᱑` read as *ɡel , pe ɡel kʰɔn ɡel mitʼ* — the
   joiner attached between the MINUTES and the next hour. Since the clock is deliberately unclaimed, a
   left operand preceded by a colon is now refused. One instance, and refusing it costs nothing.

**Raw finding — a change that LOOKED like a regression and was the opposite.** The diff showed
`bar saj ar` → `bar ɡel ar` and I chased it as a de-grouping bug. The source is
`᱒᱙᱙,᱗᱙᱒,᱔᱕᱘ ᱢᱤᱴᱚᱨ` — the speed of light. Before, the three groups read as three separate numbers; after,
it reads as one, and `bar ɡel are` is *29* opening *29 crore 97 lakh …*. The diff line was truncated at
90 characters and that is what made it look wrong. Read the whole row.

**Raw finding — the word-level diff over all 209 changed rows** (added/removed token multisets), which is
what turns 47.8% changed into a judgement:

    REMOVED   . ×362   , ×185   a ×125   saj ×70   sun ×41   menakʼ ×34   ⟪DROP:percent⟫ ×28
              ˈʊkm ×24   skwˈɛɹd ×21   ka/la/ri/pa/mi/ba/ta/sa/ɖi/d/r/j/m — word-splitting debris
              ⟪DROP:currency⟫ ×12   sˈiː ×6
    ADDED     haɟar ×145   sajkɔɽa ×78   lakʰ ×71   kʰɔn ×36   menakʼa ×34   kilɔmiʈɔr ×28
              bɔrɡɔ ×21   ləɡitʼ ×16   ɖɔlar ×12   kɔrɔɽ ×11   ruwə ×9   kəmi ×9   hujukʼa ×9
              mucətʼ ×8   əɖi ×7   ɖiɡri/selsijɔs ×6   ʈaka ×6 …

Every one of the ~75 added token types is a well-formed Santali word — the ə-vowel repairs (`pəwrə`,
`pərsi`, `pəhil`, `midʈəŋ`, `bəɽti`, `pʰəɡun`, `əndolɔn`, `ʈʰəwkən`, `amerikijə`), the magnitudes that
de-grouping restored, and the sourced sign words. Nothing was mangled. The 362 removed `.` and 185 removed
`,` are the spurious pauses; the 125 removed bare `a` are the stranded verb enclitics.

**Implication.** The layer does what it was designed to do and nothing else. Proceed to the residue.

---

## Run 12 — 2026-08-13 — the residue, and closing two more classes

**Question.** `mine.ts scan` still reports eight lines. Which are defects and which are the refusals?

**Raw finding — two were closable, and both had a word already sourced.**

- **`US$` needed its own KEY.** `US$᱖᱕,00,00,000` and `US$᱑,᱑᱑᱐,᱐᱐᱐` reported `DROP currency`, because
  the tier's bare `$` is letter-bounded on the left and cannot match inside a code prefix — which the
  tier's own documentation says. Declared. Currency 17 → 5 → **1**.
- **⚠ A CELL HID BEHIND ITSELF.** With `°C` closed, the scan re-surfaced the corpus's DOMINANT degree
  shape, which is not `°C` at all: a bare `°` with the noun already spelled out in Santali —
  `᱒᱙° ᱠᱷᱚᱱ ᱓᱖° ᱥᱮᱞᱥᱤᱭᱚᱥ`, `᱔᱔° ᱟᱨ ᱕᱓° ᱠᱚᱧᱮ ᱚᱠᱷᱟᱝᱥᱚ` (north LATITUDE), `᱒᱒° ᱟᱨ ᱔᱑° ᱥᱟᱢᱟᱝ ᱫᱽᱨᱟᱜᱷᱤᱢᱟ`
  (east LONGITUDE). Only the `°` itself was unread and `ᱰᱤᱜᱨᱤ` is attested in exactly that slot
  (`89 ᱰᱤᱜᱨᱤ 46 ᱢᱤᱱᱤᱴ … ᱫᱨᱟᱜᱷᱤᱢᱟ`), so the match is WHOLE. Degree 12 → 8 → **6**. This is the
  playbook's own note that a cell is done when it re-scans clean, not when a fix lands.

**Raw finding — the de-grouping's 2-digit arm, checked for its adversarial neighbour.** Indian 2-2-3
grouping forces `,` + 2 digits, which would also match a comma-decimal. Counted: the corpus has exactly
**2** instances of `,` + exactly 2 digits, and both are interior fragments of Indian-grouped numbers
(`᱖᱕,00`, `᱐᱕᱖,᱐᱐`). Santali writes no comma-decimal. Safe, and `12,5` (one digit) is correctly untouched.

**Raw finding — what is left, and every line accounted for:**

    DROP math-sign ×25 / minus ×6   the arithmetic article — declined on SYNTAX (Run 10). Stays RED.
    DROP degree ×6                  DMS coordinates with LATIN directions (77°12.5′E / 28.6133°N) — refused whole
    DROP ampersand ×6               &nbsp; markup residue + English org names — accepted silence
    DROP exponent ×2                the same Latin coordinate, mis-filed by the probe
    DROP currency ×1                a sign with no sourced word (€ / £ / a bank name)
    LEAK RAW-LATIN ft ×1, pk ×1     no foot word sourced; and a URL

---

## Run 13 — 2026-08-13 — the gates, before and after

    gate                            before                       after                     role
    ─────────────────────────────── ──────────────────────────── ───────────────────────── ─────────
    npx vitest run                  242 files / 4023 pass        242 files / 4024 pass     TRIPWIRE
    npx tsc --noEmit                clean                        clean                     TRIPWIRE
    referee-eval sat  raw exact     419/490 (85.5%)              419/490 (85.5%)           TRIPWIRE
                      folded        455/490 (92.9%)              455/490 (92.9%)           TRIPWIRE
                      symbol acc    97.1%                        97.1%                     TRIPWIRE
    corpus-diff       changed       —                            211/441 (47.8%)           METER
                      DROP          88                           45                        METER
    mine.ts scan      DROP percent  28                           0                         METER
                      DROP currency 17                           1                         METER
                      DROP degree   12                           6                         METER
                      DROP math-sign 26                          25                        (refused)
                      DROP minus     6                           6                         (refused, RED)
                      DROP ampersand 6                           6                         (accepted silence)
                      DROP exponent  2                           2                         (refused)
                      LEAK RAW-LATIN 2                           2                         (unsourced)
    review.ts                       1 FAILING (no normalizer)    2 FAILING                 METER + prompt
    mine.ts scan RAW-LATIN hits     1 (the brief's figure)       —                          —

**⚠ THE REFEREE DID NOT MOVE, AND THAT IS THE RESULT, NOT AN ABSENCE OF ONE.** Named as a tripwire in
Run 4 before any code was written: it scores 490 single headwords and this layer rewrites running text, so
its correct after-value is *identical*. A move in either direction would have meant the g2p was damaged.
It is identical to three decimal places on all three measures.

**⚠ `review.ts` GOES FROM 1 FAILING TO 2, AND BOTH REDS ARE CORRECT (trap 24).** `sign classes` and
`artifact scan` both report the arithmetic signs. Santali HAS the words (Run 10) and the blocker is that
they are operation nouns needing a restructured frame — an addressable gap, not a permissible silence — so
they are **deliberately not entered** in `ACCEPTED_SIGN_SILENCE`. Only `ampersand` (markup residue and
English names) and `plus-minus` (×0) are. The minus is the sharpest case: this corpus writes a real
negative RESULT (`᱐ - ᱑ = -᱑`) and omitting a minus INVERTS. A red gate that is right beats a green gate
that is wrong.

**Goldens.** No existing golden changed. `test/santali.test.ts` was APPENDED to, never overwritten: the
five original describe-blocks (checked stops, nasalization, palatals, AHAD, the cardinal series) are
untouched and still pass. A new `Santali (sat) text normalization` block adds 11 tests, each pinning a
rule's BRANCH plus the adversarial neighbour it must refuse (trap 13) — including three tests whose whole
content is a REFUSAL: the range rule declining arithmetic/negative/clock, `°F` and `°N` declining, and
`ᱠ.ᱞ.` reading as its letters rather than a guessed era phrase.

**Build.** `derive-normalization.py` reported `1 cell(s) differ` — sat's own new normalizer — and after
regeneration plus `build.py` the catalogue is `(none)=78, done=124, inherited=13`, 0 cells differing, and
`test/languageCatalogue.test.ts` is green. `tools/corpus/attest/sat.jsonc` is written and tracked, holding
18 probed findings with their example prose.

---

## Run 14 — 2026-08-14 — ⟨ᱻ RELAA⟩ has a reading, and the Latin routing was right except in three places

Opened on the two defects Run 13 reported and did not fix: RELAA contributing the empty string inside a
live word, and Latin runs reading as English (`1st` → *street*).

**Command.** `referee-eval sat` before anything; a census of every orphan Ol Chiki sign and every Latin run
in the retained tier; `attest.ts` on the candidate unit words; then `corpus-diff emit/compare`,
`mine.ts scan`, `review.ts`, `npx vitest run`, `npx tsc --noEmit`.

### Defect 1 — what RELAA is

**Question.** U+1C7B is inside `TOKEN`'s word class and no branch of `phonemizeWord` claims it, so it is
consumed and contributes nothing. What should it read as?

**Raw finding — it is the vowel-LENGTH mark, and it modifies its neighbour rather than having a phone.**
Three independent sources agree and one of them is a dictionary:

- r12a's Ol Chiki orthography notes: *"To indicate a prolonged vowel sound, ᱻ is used."*
- the encoding material: a length mark that *"may combine with any oral or nasal vowel"*, written AFTER the
  vowel — and AFTER ⟨ᱹ GAAHLAA⟩ when both are present, which is the opposite of the usual Indic diacritic
  placement and is exactly the order this engine's left-to-right segment scan already produces.
- en.wiktionary's ONLY RELAA headword, `ᱡᱤᱻ` "to smell", **romanises as *jiː*** and lists `ᱡᱤ` as its
  alternative spelling. That is the length mark, spelled out in the transliteration column.

So the branch appends a length mark to the preceding vowel and nothing else. `ᱟᱻ`→[aː], `ᱟᱹᱻ`→[əː],
`ᱟᱸᱻ`→[ãː]. A RELAA with no vowel to its left is consumed silently — a modifier with an absent neighbour
carries nothing, which is a claimed character rather than an unclaimed one.

**⚠ Raw finding — the Run 11 guard was one character too short and would have destroyed two of the three
shapes.** Step 2 rewrites a consonant-preceded RELAA to ⟨ᱼ PHAARKAA⟩ and its guard was `(?<!VOWEL)ᱻ`,
testing the immediately preceding CHARACTER. In `ᱟᱹᱻ` and `ᱟᱸᱻ` that character is a SIGN, not the vowel
letter, so the guard called it a consonant and rewrote a legitimate length mark into a PHAARKAA which then
vanished. The sources are explicit that relaa follows the găhlă ṭuḍăg and combines with nasal vowels, so
U+1C78–1C7A are now transparent to the guard. Found by probing the branch, not by the corpus — the corpus
has no instance of either shape.

**⚠ Raw finding — the referee DID NOT MOVE, and its one RELAA row is unreachable either way.**

    referee-eval sat        before              after
    raw exact               419/490 (85.5%)     419/490 (85.5%)
    folded backbone         455/490 (92.9%)     455/490 (92.9%)
    symbol accuracy         97.1%               97.1%

The referee has exactly ONE headword containing RELAA — `ᱡᱤᱻ`, whose expected IPA is `ɟĩ`, a NASAL. We read
`ɟi` before and `ɟiː` after; both differ from `ɟĩ`. The Wiktionary page for the same entry romanises it
*jiː*, so its own two columns disagree with each other, and 1/490 is below the printed precision on all
three measures anyway. **A word-level referee that does not move on a change that touches one of its 490
rows is the expected result, not an absent one** — but unlike Run 13's zero, this one had a live path to a
regression and did not take it.

**⚠ Raw finding — the corpus's own five RELAAs are all keyboard slips, so this rule is WRONG on all five,
and the trade is priced.** After step 2's repair, five vowel-preceded RELAA survive: `ᱵᱮᱲᱟᱻᱫᱚ` (= ᱵᱮᱲᱟ +
topic ᱫᱚ), `ᱢᱤᱻᱢᱤᱫ` (the same paragraph writes `ᱢᱤ-ᱢᱤᱫ`), `ᱛᱤᱻ ᱛᱮ`, `ᱵᱚᱝᱜᱟᱻᱟᱭ`, `ᱡᱚᱻ`. Every one is a
mistyped separator, so the length reading puts a spurious duration cue on a vowel in all five.
**Priced rather than assumed (trap 53):** the alternative is the status quo, a character that vanishes
silently inside a live word — the class found by hand in six languages now. A duration cue is a
sub-phonemic error on a vowel that is already there; a deletion removes a segment. And no rule can repair
the typos: only `ᱢᱤᱻᱢᱤᱫ` has an in-corpus twin, and the other four could be a space, a hyphen or nothing.
The character's own function is the only defensible general reading, and the golden that pinned the silence
(`ᱢᱤᱻᱢᱤᱫ` → *mimitʼ*) is changed to `miːmitʼ` with this reasoning attached.

### Defect 1b — which of the orphan signs still had an unclaimed path

**Question.** Run 13 counted 27 word tokens reading as the empty string, "all orphan ᱹ ᱼ ᱺ". Which are
still unclaimed after the layer landed?

**Raw finding — a census of every sign not attached to an Ol Chiki letter, before and after normalization.
The count is now 12, in three shapes, and only two of them were defects:**

- **⟨ᱹ GAAHLAA⟩ — already claimed, and this is where the 27 went.** The ~17 orphan GAAHLAAs are the
  DECIMAL SEPARATOR (`᱗᱒ᱹ᱗%`, `᱒᱓ᱹ᱔᱔ ᱠᱤᱢᱤ²`, `᱘᱒ᱹ᱖᱑ %`) and step 3 already folds them onto the `.`
  behaviour. Negative result: nothing to do. The one residue is `ᱹᱹᱹ` ×1, an ELLIPSIS typed with three
  length-of-the-wrong-mark strokes (`᱐ - ᱒ = -᱒ ᱹᱹᱹ ᱾`) — now folded to `…`.
  ⚠ A SINGLE orphan ⟨ᱹ⟩ is deliberately NOT claimed: `(ᱥᱤᱹᱰᱞᱤᱭᱩ ᱹᱣᱤᱭᱩ ᱹᱟᱨ)` is CWUR spelled out in Ol
  Chiki with the sign glued to the FOLLOWING segment, where it is already harmless — claiming it would put
  a pause inside an acronym, which is step 7's own lesson.
- **⟨ᱺ MU-GAHLA⟩ ×3 — UNCLAIMED, and it is a COLON.** The glyph is two dots and that is what it was typed
  for: `ᱚᱲᱟᱜ ᱵᱷᱤᱛᱤᱨ ᱥᱴᱟᱰᱤᱭᱚᱢ ᱺ ᱱᱚᱰᱮ …`, `(ᱤᱝᱞᱤᱥ ᱺSukhumi Babushara Airport)` — the wiki's own "in
  English:" frame — and `ᱡᱮᱞᱮᱠᱟ ᱺ-` ("for example :-"). Folded to `:`, which `TOKEN` already reads as a
  pause. Narrow on the left edge, because attached MU-GAHLA is ordinary and frequent (`ᱥᱟᱺᱜᱤᱧ`, `ᱦᱟᱺᱰᱤ`).
- **⟨ᱼ PHAARKAA⟩ ×8 — unclaimed, and DELIBERATELY LEFT SO.** All eight are dashes: four are the year in a
  births list (`᱑᱘᱖᱙ᱼ ᱢᱚᱦᱟᱛᱢᱟ ᱜᱟᱱᱫᱷᱤ`), the rest a film title (`ᱫᱷᱩᱢ ᱼ᱓`), a filmography separator and
  `2014 ᱼ …`. A dash that reads as nothing is a dash read correctly, so no rule is written and this is a
  negative result, not a gap.
  **⚠ BUT ONE OF THE EIGHT WAS HIDING A REFUSED RANGE.** `᱑᱙᱙᱘ᱼ᱑᱙᱙᱙: ᱠᱟᱞᱤᱫᱟᱥ ᱥᱚᱢᱟᱱ` is an AWARDS LIST —
  the colon introduces the prize — and step 8's right-hand guard `(?![:\d])` refused the whole span, after
  which the abandoned ⟨ᱼ⟩ read as nothing and the refusal was invisible. The clock hazard the guard was
  written for is a colon followed by a DIGIT, never a colon followed by a space and a name, so the guard now
  says exactly that. The left-operand guard is untouched and `᱑᱐:᱓᱐ - ᱑᱑` is still refused.

### Defect 2 — the Latin runs, and whether the routing is wired

**Question 1: is sat's foreign-reader wiring live or dead?** **NEITHER — there is no wiring to look at.**
`createSantali()` takes no argument at all, so `sat` is not among the 45 factories handed a foreign reader
and there is nothing to remove (the `ak` case does not apply). The English reading comes from
`core/clauses.ts`'s shared `emitUnclaimed`: script router first, Latin→English fallback second.

**Question 2: what is the right behaviour?** A census of all 944 Latin runs in the retained tier
(633 distinct) answers it, and the answer is mostly *leave it alone*:

    English proper nouns / org names   Mars Orbiter Mission, PSLV, DRDO, Encyclopædia Britannica,
                                       Sukhumi Babushara Airport, García Márquez, Googleplex …
    English prose inside the wiki's    "(ᱤᱝᱞᱤᱥ: …)" — literally "in English: …". The corpus asks for an
    OWN gloss frame                    English reading in so many words.
    unit abbreviations                 km² ×22, sq ×20, mi ×20, ft ×1, Mw ×1, C ×10 (already claimed)

**⚠ SANTALI'S OWN INITIALISMS ARE ALREADY IN OL CHIKI AND ARE ALREADY READ.** `ᱯᱤ.ᱮᱥ.ᱮᱞ.ᱵᱷᱤ` is PSLV
written as the ENGLISH LETTER NAMES transliterated, and step 7 reads it. So the language's attested habit
for a Latin initialism is the English letter names, and nothing here invents a Santali letter name — the
`hmn` refusal, reached by the same road from different evidence. **English is the right foreign reader for
this language**, and it has an unusually strong argument here: Santali has its own script and its own
digits, so a Latin run is unambiguously foreign, and the wiki labels most of them as English itself.

**Raw finding — THREE shapes were wrong, and none of them is the routing.**

1. **`1st` → *mitʼ stɹˈiːt* is THIS ENGINE cutting an English expression in half.** `TOKEN`'s numeral arm
   claimed the `1` and spoke it in Santali; the orphaned `st` fell to the English fallback, which expanded
   the abbreviation *st* to **STREET**. Seven instances, every one inside an English phrase — `4th century
   BCE`, `c. 6th century BCE`, `Languages attested from the 19th century`, and `(13th)`/`(14th)`/`(131st)`
   as a country's world area RANK. English reads `13th` as *θˈɝtʰˈiːnθ* the moment it is handed the digits
   too, so the fix is to stop cutting the run, which is `FOREIGN_RUN`'s own argument for carrying a trailing
   superscript. A new `TOKEN` arm, narrow by construction: ASCII digits + one of the four English suffixes,
   no Ol Chiki digits (a Santali numeral takes no Latin ordinal suffix and `᱑᱓th` does not occur).
2. **`sq mi` ×20 read as *sk mˈiː* — A WRONG READING IN BOTH LANGUAGES.** English does not expand `sq`
   either, so routing it "correctly" produced two plausible syllables and no leak the gates could see.
   ⚠ AND BOTH WORDS ARE ATTESTED IN EXACTLY THIS SLOT, so the match is whole: `ᱢᱟᱭᱤᱞ` 32 tok / 14 arts and
   **every example is the parenthetical gloss itself** (`᱖᱘,᱐᱔᱓ ᱠᱤᱞᱚᱢᱤᱴᱚᱨ (᱔᱒,᱒᱘᱐ ᱢᱟᱭᱤᱞ)`), and `ᱵᱚᱨᱜᱚ`
   39/10 PRECEDES its noun (`ᱵᱚᱨᱜᱚ ᱠᱤᱢᱤ`, `᱑᱒᱘.᱖᱔ ᱵᱚᱨᱜᱚ ᱠᱤᱢᱤ`). `ᱵᱚᱨᱜᱚ ᱢᱟᱭᱤᱞ` is the corpus's own frame
   with its own mile word in the noun slot — composed from attested pieces, not coined. Bare `mi` is NOT
   declared as a unit key; only the two-token shape that was counted.
3. **⚠ `LEAK RAW-LATIN ft ×1` WAS CLOSED ON A CLAIM THAT WAS FALSE.** Run 12 recorded "no foot word
   sourced". Re-probing finds TWO, both attested and both in precisely this parenthetical slot:
   ᱯᱷᱤᱴ 63/16 (`᱓᱐᱔ ᱢᱤᱴᱚᱨ (᱙᱙᱙ ᱯᱷᱤᱴ)`) and ᱯᱷᱩᱴ 25/13 (`᱔᱒᱘᱐ ᱢᱤᱴᱚᱨ (᱑᱔,᱐᱔᱐ ᱯᱷᱩᱴ)`). A real spelling tie
   like the Celsius one, decided on count and article spread and stated rather than hidden: ᱯᱷᱤᱴ wins.
   The lesson generalises: *a "no word is attested" note is a claim with a date on it, and it is cheap to
   re-probe.*

**Raw finding — what is LEFT REPORTED, with the reason for each (refusal priced, not assumed):**

    people/km² ×1   the DENSITY frame needs a "per" word. `ᱯᱚᱨᱚᱛᱤ` is attested — but 13 tokens in ONE
                    article, and reading half the expression (`ᱦᱚᱲ` for `people` would be invented) is
                    the `ig` "790 kilometres two" shape. Refused whole.
    Mw ×1           moment magnitude. No word, no near-miss, one instance.
    www.…gov.pk ×1  a URL. Left as a visible leak on purpose; spelling out a hostname is not a reading.
    math signs ×31  unchanged from Run 13 — declined on SYNTAX. review.ts stays RED and is right to.

**⚠ A FLEET-LEVEL OBSERVATION, RECORDED AND NOT TOUCHED.** Roman numerals are folded to Arabic by the
registry's shared `normalizeRomans`, ABOVE this layer, and then read as SANTALI NUMBERS: `Peak XV` →
*ɡel mɔɳe*, `CITES Appendix II` → *bar*, `ᱞᱩᱭᱤᱥ XIII` → *ɡel pe*. For a monarch or a papal name that is
arguably right; for `CITES Appendix II` it is a wrong reading. It is not this file's to fix and no change
was made.

### The gates, before and after

    gate                              before                     after                    role
    ───────────────────────────────── ────────────────────────── ──────────────────────── ─────────
    npx vitest run                    242 files / 4057 pass      242 files / 4062 pass    TRIPWIRE
    npx tsc --noEmit                  clean                      clean                    TRIPWIRE
    referee-eval sat  raw exact       419/490 (85.5%)            419/490 (85.5%)          METER
                      folded          455/490 (92.9%)            455/490 (92.9%)          METER
                      symbol acc      97.1%                      97.1%                    METER
    corpus-diff       changed         —                          34/441 (7.7%)            METER
                      DROP            45                         45                       METER
    mine.ts scan      LEAK RAW-LATIN  2 (ft, pk)                 1 (pk — a URL)           METER
                      everything else unchanged                  unchanged                (refused)
    review.ts                         2 FAILING                  2 FAILING                METER
    catalogue                         0 cells differ             0 cells differ           TRIPWIRE

⚠ `test/onnx-optional.test.ts` and two `referee-eval.test.ts` rows time out under a full parallel run;
both files pass in isolation (`referee-eval.test.ts` 171/171, including sat's 0.89 floor). Discounted.

**Raw finding — the word-level diff over the 34 changed rows is exactly the four intended edits and
nothing else:**

    REMOVED   sk ×20   mˈiː ×20            → ADDED  bɔrɡɔ ×20  majil ×20        (sq mi)
              tʰˈiːʲˈeᶦt͡ʃ ×6  stɹˈiːt ×1  → ADDED  fˈɔːɹθ sˈɪksθ θˈɝtʰˈiːnθ fˈɔːɹtˈiːnθ nˈaᶦntˈiːnθ
              + ɡel×4 pun×2 pe×2 mitʼ×2 …          fˈɪfθ  wˈʌn hˈʌndɹəd θˈɝd̬iː fˈɝst   (the ordinals)
              ft ×1                        → ADDED  pʰiʈ ×1                            (the foot word)
              beɽadɔ mimitʼ ti bɔŋɡaaj ɟɔ  → ADDED  beɽaːdɔ miːmitʼ tiː bɔŋɡaːaj ɟɔː    (RELAA, all 5)
                                           → ADDED  , ×3                               (the orphan colons)
                                           → ADDED  kʰɔn ×1                            (the awards range)

Not one word was mangled and no new DROP/RAWMARK/LEAK class appeared.

**Goldens.** ONE existing golden changed: `test/santali.test.ts`'s RELAA test pinned `ᱢᱤᱻᱢᱤᱫ` → *mimitʼ*,
i.e. the sign reading as the empty string, and now pins `miːmitʼ`. That is the defect this run was opened
on; the justification is the priced trade above and it is written into the test. Everything else in the
file is APPENDED — four new tests (RELAA through GAAHLAA/MU, the orphan colon and its attached neighbour,
the English ordinal with its Ol-Chiki-numeral refusal, `sq mi`/`ft` with a bare-`mi` refusal, and the range
guard with the clock it must still decline). The file was never overwritten.
