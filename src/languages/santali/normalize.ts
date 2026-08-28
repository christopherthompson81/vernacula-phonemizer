/**
 * Santali / ᱥᱟᱱᱛᱟᱲᱤ (sat) text normalization — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ── WHAT THE CORPUS IS ────────────────────────────────────────────────────────────────────────────────
 *
 * `tools/corpus/mined/sat.jsonc`, a sat.wikipedia dump (96,454 segments; the 242-segment retained tier,
 * 87,012 characters, is what the counts below are measured over unless stated).
 *
 * ⚠ THE SCRIPT QUESTION, SETTLED BEFORE ANY RULE WAS WRITTEN. Santali is written in Ol Chiki, Devanagari,
 * Bengali, Odia and Latin, so a layer could easily have been built for the wrong one. Two measurements
 * close it. The ENGINE accepts only Ol Chiki: `TOKEN` in `santali.ts` is U+1C5A–U+1C7D for words,
 * U+1C50–U+1C59 plus ASCII for digits, and a short punctuation class. The CORPUS is only Ol Chiki too —
 * a census of all 87,012 characters found no running text in any other script, just 15 stray Bengali
 * characters (one gloss), 25 Arabic (two glosses) and 10 Han (one proper name). **A Devanagari or Bengali
 * arm would have been a no-op**, and is deliberately not written. Recorded as a negative result.
 *
 * ⚠ THE DIGIT QUESTION. Ol Chiki has its OWN digits (᱐-᱙, U+1C50–1C59) and the corpus prefers them
 * overwhelmingly: the artifact's `digit-run` cell is 43,787 of which **an ASCII `\d` would miss 40,539**
 * — 93%. Same story for `year` (43,212 / 40,011 missed) and `percent` (5,315 / 5,234). `santali.ts`
 * already folds them to ASCII before composing a numeral, but every pattern in THIS file is keyed on
 * `\p{Nd}`, never `\d` and never `[0-9]`, because a rule that fired on 7% of the corpus would look like
 * it worked.
 *
 * ⚠ THE PUNCTUATION QUESTION, and the `syl` hazard that does NOT apply here. Syloti Nagri's sentence
 * terminator was unreachable because it lived inside the range that language's word class claimed.
 * Santali's ᱾ MUCAAD and ᱿ DOUBLE MUCAAD are U+1C7E/U+1C7F, ABOVE the word class's U+1C7D ceiling, and
 * both are already declared as full stops. `cells.ts`'s `native-terminator` backfill puts one in 374 of
 * the artifact's 442 retained segments and all of them read. Nothing to fix; checked rather than assumed.
 *
 * ⚠ EVERY BOUNDARY IS AN EXPLICIT LOOKAROUND, NEVER `\b` (trap 1). Note that every Ol Chiki sign —
 * ᱹ ᱸ ᱺ ᱼ ᱽ ᱻ — is `\p{L}` (Lo), not `\p{M}`: Ol Chiki is an ALPHABET, not an abugida, so trap 23's
 * "`\p{L}` is not the end of a word" does not bite, and nothing in the block decomposes, so trap 11's
 * two-encodings problem does not either. Both were checked before being relied on.
 *
 * ── THE TWO DEFECTS THAT DOMINATE, AND NEITHER IS A NUMBER RULE ───────────────────────────────────────
 *
 * ⚠ 1. THE ASCII PERIOD IS A TYPEWRITER SUBSTITUTE FOR ⟨ᱹ GAAHLAA⟩ (U+1C79) — 246 occurrences, more than
 * percent, currency, degrees, ranges, clocks and every math sign put together. `ᱞᱟ.ᱜᱤᱫ` is `ᱞᱟᱹᱜᱤᱫ`.
 * Because `.` is in `TOKEN`'s punctuation arm, each one currently SPLITS THE WORD, inserts a CLAUSE
 * PAUSE, and leaves the vowel unmodified: `ᱞᱟ.ᱜᱤᱫ` → *la ‖ ɡitʼ* where the word is *ləɡitʼ*. Three
 * defects in one character. Three independent measurements establish it:
 *
 *   · the letter BEFORE the dot has the same distribution as the letter before the real sign —
 *     dot: ᱟ ×226 ᱤ ×11 ᱢ ×11 ᱞ ×6 ᱠ ×6 …;  ᱹ: ᱟ ×1171 ᱮ ×5 ᱤ ×3 ᱢ ×2 …  (GAAHLAA is a VOWEL diacritic,
 *     and 246 of the 283 dots follow a vowel letter);
 *   · **55 of the 142 distinct dotted word-forms have their EXACT GAAHLAA twin elsewhere in the same 242
 *     segments** — an in-corpus minimal pair, not an inference: ᱞᱟ.ᱜᱤᱫ ≡ ᱞᱟᱹᱜᱤᱫ, ᱟ.ᱰᱤ ≡ ᱟᱹᱰᱤ,
 *     ᱠᱟ.ᱢᱤ ≡ ᱠᱟᱹᱢᱤ, ᱨᱩᱣᱟ. ≡ ᱨᱩᱣᱟᱹ, ᱢᱤᱫᱴᱟ.ᱝ ≡ ᱢᱤᱫᱴᱟᱹᱝ;
 *   · the affected words are the commonest in the language (ᱞᱟᱹᱜᱤᱫ "for", ᱟᱹᱰᱤ "very", ᱢᱤᱫᱴᱟᱹᱝ "one"),
 *     which is what a keyboard-layout artefact looks like rather than a lexical fact.
 *
 * ⚠ 2. AND THE ASCII HYPHEN IS THE SAME SUBSTITUTION FOR ⟨ᱼ PHAARKAA⟩ (U+1C7C) — 99 occurrences. The two
 * suffix distributions are the same morpheme: `-ᱟ` ×70 / `-ᱵᱤᱥᱟᱹᱨ` ×2 / `-ᱢᱤᱫ` ×1 against `ᱼᱟ` ×275 /
 * `ᱼᱵᱤᱥᱟᱹᱨ` ×2 / `ᱼᱢᱤᱫ` ×1, and the corpus writes `ᱢᱮᱱᱟᱜ-ᱟ` ×30 beside its own `ᱢᱮᱱᱟᱜᱼᱟ`.
 * **The wiki says so itself**: sat.wikipedia's article on the script glosses the diacritic names as
 * `ᱢᱩ ᱴᱩᱰᱟᱹᱜ (ᱸ), ᱜᱟᱹᱦᱞᱟᱹ ᱴᱩᱰᱟᱹᱜ (ᱹ), ᱨᱮᱞᱟ (ᱻ), ᱯᱷᱟᱨᱠᱟ (-) ᱟᱨ ᱚᱦᱚᱫ (ᱽ)` — typing PHAARKAA as an ASCII
 * hyphen in its own parenthesis. This one is much MILDER than the dot (`ᱢᱮᱱᱟᱜ-ᱟ` → *menakʼ a*,
 * `ᱢᱮᱱᱟᱜᱼᱟ` → *menakʼa*: identical phonemes, a spurious word boundary), so step 6 claims only the shape
 * that was counted — the finite-verb enclitic — and leaves the ~29 genuine compound hyphens
 * (`ᱚᱞ-ᱛᱚᱞ`, `ᱤᱱᱰᱚ-ᱤᱭᱩᱨᱚᱯᱤᱭᱟᱱ`, `ᱟᱞ-ᱟᱦᱨᱟᱢ`) alone, where two words is right. Trap 9.
 *
 * ── WHAT THE SOURCED VOCABULARY IS, AND WHERE EACH WORD CAME FROM ─────────────────────────────────────
 *
 *   %       ᱥᱟᱭᱠᱚᱲᱟ     attest.ts 63 tok / 13 arts, postposed, in census prose:
 *                       `᱕᱒.᱖᱒ ᱥᱟᱭᱠᱚᱲᱟ ᱠᱚᱲᱟ ᱟᱨ ᱔᱗.᱓᱘ ᱥᱟᱭᱠᱚᱲᱟ ᱛᱤᱨᱞᱟᱹ`, `ᱥᱮᱪᱮᱫ ᱫᱚᱨ ᱘᱐.᱕᱖ ᱥᱟᱭᱠᱚᱲᱟ`.
 *                       ⚠ THE NATIVE CALQUE BEAT THE LOAN, AND THE FIRST DRAFT OF THIS FILE HAD THE LOAN.
 *                       `ᱥᱟᱭᱠᱚᱲᱟ` is literally "per hundred" on `ᱥᱟᱭ` = 100 — the engine's OWN hundred
 *                       word, in `numbers.ts` — so it is composed from attested pieces rather than
 *                       borrowed (the Fula `e teemedere` move). Competitors, both real and both rejected
 *                       on the count: ᱯᱨᱚᱛᱤᱥᱚᱛ 12/6 (Indo-Aryan *pratishat*, chosen first and replaced
 *                       when the wider probe found it outnumbered 5:1) and ᱯᱟᱨᱥᱮᱱᱴ 8/8, of which two are
 *                       an English film title (*Hundred Percent*).
 *   $       ᱰᱚᱞᱟᱨ       45/12, and the article states the mapping outright:
 *                       `ᱢᱟᱨᱠᱤᱱ ᱰᱚᱞᱟᱨ (ᱯᱚᱛᱥᱟ ᱪᱤᱱᱦᱟᱹ: $ ᱵᱮᱝᱠ ᱠᱳᱰ: USD)`. Also ×13 in the corpus.
 *   ৳       ᱴᱟᱠᱟ        56/11, `ᱵᱟᱝᱞᱟᱫᱮᱥᱤ ᱴᱟᱠᱟ (… ᱪᱤᱱᱦᱟᱹ: ৳ …)`.
 *   ₹       ᱴᱟᱠᱟ        sign-stated as well, in the article on the Indian rupee:
 *                       `ᱥᱤᱧᱚᱛᱤᱭᱟᱹ ᱴᱟᱠᱟ (symbol ₹; code: INR) ᱥᱤᱧᱚᱛ ᱨᱮ ᱥᱚᱨᱠᱟᱨᱤ ᱠᱟᱹᱣᱰᱤ ᱠᱟᱱᱟ`, and the
 *                       corpus writes `₹᱕᱐᱐ ᱠᱳᱴᱤ ᱴᱟᱠᱟ`. ᱴᱟᱠᱟ is the general money word for BOTH currencies;
 *                       ᱨᱩᱯᱤᱭᱟ exists (×5) but is historical/quoted amounts.
 *   km mm cm  ᱠᱤᱞᱚᱢᱤᱴᱚᱨ ᱢᱤᱞᱤᱢᱤᱴᱚᱨ ᱥᱮᱱᱴᱤᱢᱤᱴᱚᱨ — corpus ×11/×1/×7, and ᱠᱤᱞᱚᱢᱤᱴᱚᱨ 87/17 on the wiki
 *                       glossed against miles: `᱖᱘,᱐᱔᱓ ᱠᱤᱞᱚᱢᱤᱴᱚᱨ (᱔᱒,᱒᱘᱐ ᱢᱟᱭᱤᱞ)`. Postposed.
 *   ²       ᱵᱚᱨᱜᱚ       39/10, and the COLLOCATION rather than the bare modifier (trap 37):
 *                       `ᱯᱚᱨᱚᱛᱤ ᱵᱚᱨᱜᱚ ᱠᱤᱢᱤ ᱨᱮ ᱑᱑᱐᱑` (per square km), `᱑᱒᱘.᱖᱔ ᱵᱚᱨᱜᱚ ᱠᱤᱢᱤ`. Position BEFORE.
 *   °C      ᱰᱤᱜᱨᱤ ᱥᱮᱞᱥᱤᱭᱚᱥ  the whole reading in order, from the wiki: `᱓᱓.᱘ ᱰᱤᱜᱨᱤ ᱥᱮᱞᱥᱤᱭᱟᱥ ᱟᱨ ᱡᱚᱢ ᱫᱚ
 *                       ᱑᱔.᱕ ᱰᱤᱜᱨᱤ ᱥᱮᱞᱥᱤᱭᱟᱥ`, and the corpus's own `᱒᱙° ᱠᱷᱚᱱ ᱓᱖° ᱥᱮᱞᱥᱤᱭᱚᱥ`.
 *                       ⚠ THE TWO SPELLINGS ARE A DEAD HEAT and the choice is stated rather than hidden:
 *                       ᱥᱮᱞᱥᱤᱭᱚᱥ 35 tok / 14 arts against ᱥᱮᱞᱥᱤᱭᱟᱥ 33/12. ᱥᱮᱞᱥᱤᱭᱚᱥ wins on articles and on
 *                       being what THIS corpus writes; ᱥᱮᱞᱥᱤᱭᱟᱥ has the `ᱰᱤᱜᱨᱤ ᱥᱮᱞᱥᱤᱭᱟᱥ` collocation.
 *                       Either is defensible; the tie is the finding.
 *                       ⚠ AND A THIRD CANDIDATE IS A SCHOOL. `sources.ts`'s degree-adjacent list offered
 *                       ᱥᱮᱞᱥᱤᱭᱚᱥ ×1 and ᱥᱮᱞᱥᱤᱭᱚᱱ ×1 side by side, which looks like two spelling variants.
 *                       ᱥᱮᱞᱥᱤᱭᱚᱱ is 2 hits wiki-wide: one a typo inside a Celsius range, the other
 *                       **Salesian College** (`ᱥᱮᱞᱥᱤᱭᱚᱱ ᱠᱚᱞᱮᱡᱽ ᱨᱮᱱᱟᱜ ᱛᱷᱟᱯᱚᱱ ᱫᱚ ᱑᱙᱓᱓`). Only reading them
 *                       separated the unit from the school — trap 37, from a gate's own output.
 *   range   ᱠᱷᱚᱱ        the CORPUS, repeatedly, and always BETWEEN the two numerals: `᱑᱕ ᱠᱷᱚᱱ ᱒᱕ °C`,
 *                       `᱒᱐᱐᱒ ᱠᱷᱚᱱ ᱒᱐᱐᱗ ᱥᱟᱞᱮ ᱫᱷᱟᱹᱵᱤᱡ`, `᱗ ᱠᱷᱚᱱ ᱙ ᱢᱟᱹᱦᱤᱛ`, `$᱑᱐ ᱠᱷᱚᱱ $᱑᱐᱐᱐ ᱫᱷᱟᱹᱵᱤᱡ`.
 *                       ⚠ PART OF SPEECH CHECKED (the Fula `hakkunde` lesson): an INFIX in every corpus
 *                       instance, not a preposition governing both operands. Also in the referee.
 *
 * ⚠ FOUR WORDS THAT LOOK RIGHT AND ARE NOT — each was one step from shipping a confidently wrong reading:
 *
 *   ᱯᱟᱨᱥᱮᱛ ×3   looks exactly like *percent*; it is **PRESIDENT** (`ᱵᱷᱟᱨᱚᱛ ᱫᱤᱥᱚᱢ ᱨᱤᱱᱤᱡ ᱯᱟᱨᱥᱮᱛ ᱜᱚᱢᱠᱮ`,
 *               `ᱪᱟᱭᱱᱤᱡ ᱯᱟᱨᱥᱮᱛ ᱜᱚᱢᱠᱮ ᱥᱤ ᱡᱤᱱᱯᱤᱝ`). Trap 37, in the highest-traffic rule the layer has.
 *   ᱰᱤᱜᱽᱨᱤ ×1   is the ACADEMIC degree (`ᱥᱚᱱᱮᱨ ᱰᱤᱜᱽᱨᱤ ᱥᱟ.ᱛ ᱞᱮᱫᱟᱭ`) — the `ki digirii` case exactly. The
 *               unit word is ᱰᱤᱜᱨᱤ *without* the AHAD, and only the SLOT separates them, not the spelling,
 *               which is why step 10 emits it only between a numeral and a scale name.
 *   ᱯᱚᱭᱮᱱᱴ ×36  every hit is a PLACE NAME — *Indira Point*, *Zero Point*, *Parsons Point*.
 *   ᱰᱚᱴ ×11     *Red Dot Foundation*, and `ᱰᱚᱴ ᱮᱪᱴᱤᱮᱢᱮᱞ` — a URL. (ᱵᱤᱱᱫᱩ ×33 is the actress Bindu.)
 *
 * ── DECLINED, WITH THE COUNTS ─────────────────────────────────────────────────────────────────────────
 *
 *  • THE DECIMAL WORD — declined on REGISTER, not on absence, and the refusal is PRICED (trap 53).
 *    `ᱴᱩᱰᱟᱹᱜ` IS attested (29 tok / 13 arts) and IS the Santali word for the mark: the script article
 *    quoted above names ⟨ᱹ⟩ as ᱜᱟᱹᱦᱞᱟᱹ ᱴᱩᱰᱟᱹᱜ. But that is what the mark is CALLED, in an article about
 *    the alphabet — the hi `धन` failure, a correctly-sourced word in the wrong register — and the three
 *    obvious loans are all the wrong sense above. **What the refusal COSTS while it stands**: stripping
 *    the separator would read `᱒᱒.᱓᱓` as *twenty-two thirty-three*, inventing a quantity, so the dot
 *    stays and keeps the pause it already had, which is not a wrong word. Step 3 instead folds the 16
 *    GAAHLAA-written decimals ONTO that same behaviour, closing a silent merge for free.
 *  • THE CLOCK — trap 55, and the count is the whole argument. Of the 20 `d:d` instances at least five are
 *    SPORTS TIMES (`᱑0:᱔᱔.᱖᱕ ᱥᱮᱠᱮᱸᱰ`, `᱑:᱐᱖.᱑᱙ ᱴᱤᱯᱤᱡ` butterfly, `᱑:᱐᱕.᱒᱗`, `᱒:᱑᱙.᱖᱐`, `᱑᱕:᱔᱒.᱖᱗`) and
 *    one is a UTC offset (`GMT +6:30`). A `ceb`-shaped bare-colon rule claims every one of them. No
 *    Santali clock idiom is attested — the single `᱒:᱓᱘ ᱴᱟᱲᱟᱝ` is a lead, not a rule.
 *  • THE MATH SIGNS `+ − × ÷ = <`. ⚠ DECLINED ON SYNTAX, NOT ON VOCABULARY — and this is the most
 *    surprising result of the run, because the words are NOT missing. Santali has a complete NATIVE set,
 *    each with its own sat.wikipedia article that states its sign outright:
 *
 *        +  ᱥᱮᱞᱮᱫ   "ᱥᱮᱞᱮᱫ (ᱤᱝᱞᱤᱥ: Addition) (ᱱᱚᱶᱟ ᱨᱮᱭᱟᱜ ᱪᱤᱱᱦᱟᱹ ᱫᱚ \"+\")"     44 tok / 11 arts
 *        −  ᱵᱷᱮᱜᱮᱫ  "ᱵᱷᱮᱜᱮᱫ (ᱤᱝᱞᱤᱥ: Subtraction) (… ᱪᱤᱱᱦᱟᱹ ᱫᱚ \"−\")"
 *        ×  ᱜᱟᱵᱟᱬ   "ᱜᱟᱵᱟᱬ (ᱤᱝᱞᱤᱥ: Multiplication) (ᱱᱚᱶᱟ ᱨᱮᱭᱟᱜ ᱪᱤᱱᱦᱟᱹ \"×\" …)"
 *        ÷  ᱦᱟᱴᱟᱬ   "ᱦᱟᱴᱟᱬ ᱨᱮᱭᱟᱜ ᱪᱤᱱᱦᱟᱹ ᱫᱚ \"÷\" ᱾"
 *        =  ᱥᱚᱢᱟᱱ   "…ᱟᱨ ᱥᱚᱢᱟᱱ ᱪᱤᱱᱦᱟᱹ (=) ᱮᱢ ᱠᱟᱛᱮ…"
 *
 *    (ᱥᱮᱞᱮᱫ is independently in en.wiktionary from Hansdah's *Concise English-Santali Dictionary*, and all
 *    five are visible in this corpus's own arithmetic paragraph — `᱐ ᱥᱟᱶ ᱥᱮᱞᱮᱫ ᱞᱮᱱᱠᱷᱟᱱ`, `ᱮᱞ ᱛᱮ ᱦᱟᱴᱟᱬ`.)
 *    **They are operation NOUNS, not infix operators**, and the articles' own worked examples prove it:
 *    `᱒+᱓ = ᱕ (ᱢᱮᱱᱫᱚ ᱒ ᱟᱨ ᱓ ᱥᱮᱞᱮᱫ ᱞᱮᱠᱷᱟᱱ ᱕ ᱦᱩᱭᱩᱜᱼᱟ)` — the INFIX is `ᱟᱨ` ("and") and the operation name
 *    is POSTPOSED; subtraction takes the ablative `ᱠᱷᱚᱱ` on the minuend. So `᱑ ᱥᱮᱞᱮᱫ ᱐` would be
 *    ungrammatical, and the correct frame restructures the whole expression rather than replacing a glyph.
 *    That restructure is worth exactly ONE ARTICLE in this corpus — every `+ − × ÷ = <` instance is the
 *    wiki's arithmetic/zero page (`᱐ × ᱑ = ᱐`, `᱑ + ᱐ = ᱑`, `᱑<᱒<᱓`) — so it is not written. This is a
 *    re-runnable refusal (trap 24): the words are above, the frame is above, and only the corpus footprint
 *    argues against it. (`ᱵᱟᱨᱟᱵᱟᱹᱨᱤ`, "equal to", is attested too — `ᱢᱤᱫ ᱟᱢᱮᱨᱤᱠᱟᱱ ᱰᱚᱞᱟᱨ ᱫᱚ $᱗.᱗᱕ ᱥᱟᱶ
 *    ᱵᱟᱨᱟᱵᱟᱹᱨᱤ ᱟ` — and is likewise a postpositional predicate taking `ᱥᱟᱶ`, never an infix.)
 *  • THE MINUS — the same article supplies the only true negatives (`᱐ - ᱑ = -᱑`). `ᱵᱷᱮᱜᱮᱫ` is the
 *    subtraction NOUN, not the sign's reading, and nothing attests a negative-sign word. Step 8 is careful
 *    NOT to claim these as ranges (see its guard). Stays unread, and `review.ts` stays RED on it.
 *  • `&` ×17 — every instance is `&nbsp;` markup residue or the English org name *Defence Research &
 *    Development Organisation*. Not a Santali conjunction, so nothing is read; but step 1 repairs `&nbsp;`
 *    to a SPACE, because it sits between a number and its unit (`83,883&nbsp;km²`) and otherwise breaks
 *    the adjacency the shared tier matches on.
 *  • THE ERA MARKER `ᱠ.ᱞ.` ×2 (`᱑᱙᱓ ᱠ.ᱞ. - ᱑᱗᱐ ᱠ.ᱞ.`, plainly a BC-equivalent) — ⚠ AND THE EXPANSION IS
 *    A HAPAX THE WIKI NEVER SPELLS OUT. `insource:"ᱠ.ᱞ."` returns exactly ONE article, the same one, and
 *    the full text never expands it; `ᱠᱷᱨᱤᱥᱴ ᱞᱟᱦᱟ` and `ᱠᱷᱨᱤᱥᱴᱚ ᱞᱟᱦᱟ` both return 0/0. "Christ-before" is
 *    plausible (`ᱞᱟᱦᱟᱨᱮ` does mean "before" in dates) and it is one page by one editor, so it is NOT
 *    shipped. Left to step 7's initialism handling. **The era words Santali actually spells out are
 *    known and are a different string**: BC = ᱠᱷᱤᱥᱴᱚᱯᱩᱨᱵᱚ (14 tok / 10 arts, `᱒᱒᱑ ᱠᱷᱤᱥᱴᱚᱯᱩᱨᱵᱚ ᱨᱮ`) and
 *    AD/CE = ᱠᱷᱨᱤᱥᱴᱟᱵᱽᱫᱚ (19/12, `᱑᱕᱔᱒ ᱠᱷᱨᱤᱥᱴᱟᱵᱽᱫᱚ ᱨᱮ`), both already WORDS in running text and so needing
 *    no rule. Recorded so the next reader does not re-derive them, and so nobody maps `ᱠ.ᱞ.` onto one of
 *    them on the strength of the resemblance.
 *  • `°F` ×2 and the coordinate `°N/E/S/W` ×6 — no Fahrenheit word and no sourced direction words, so the
 *    WHOLE match is refused rather than half of it (trap 53: `ak`'s shape, not Igbo's).
 *  • THE OL CHIKI UNIT ABBREVIATION `ᱠᱤᱢᱤ` ×1 (and `ᱠᱤᱢᱤ²` ×1) — one instance is a lead, not a rule.
 *  • BARE LATIN `m` as a unit key — trap 46. Withdrawn where it buys nothing: the Ol Chiki `ᱢ.` form is
 *    what this corpus writes (step 5, with its own lookbehind), and a one-letter Latin key would expose
 *    the `802.11m` class for no measured gain.
 *  • THE LATIN GLOSSES — 944 runs over the retained tier, and ⚠ THE ENGLISH ROUTING IS RIGHT FOR ALMOST ALL
 *    OF THEM, which is the finding rather than a concession. `createSantali()` takes NO foreign reader: sat
 *    is not one of the 45 factories handed one, so there is no dead wiring here, and the English reading
 *    comes from `core/clauses.ts`'s shared `emitUnclaimed` fallback. Reading the census settles that this is
 *    correct: the runs are English PROPER NOUNS and org names (`Mars Orbiter Mission`, `PSLV`, `DRDO`,
 *    `Encyclopædia Britannica`, `Sukhumi Babushara Airport`) and English prose inside the wiki's OWN gloss
 *    frame `(ᱤᱝᱞᱤᱥ: …)` — literally "in English: …". Santali also writes its own Ol Chiki initialisms
 *    (`ᱯᱤ.ᱮᱥ.ᱮᱞ.ᱵᱷᱤ` = PSLV), which are the English letter names already transliterated, and step 7 reads
 *    those; nothing here invents a Santali letter name, because none is attested (the `hmn` refusal).
 *    THREE SHAPES WERE WRONG and each is fixed where it belongs, not by re-routing the class:
 *      · `1st`/`13th`/`131st` ×7 — the ENGINE's tokenizer cut the run in half and the orphan `st` was
 *        expanded to *street*. Fixed in `santali.ts`'s `TOKEN`, which now hands the whole ordinal to English.
 *      · `sq mi` ×20 — step 5b, the attested `ᱵᱚᱨᱜᱚ ᱢᱟᱭᱤᱞ`.
 *      · `ft` ×1 — the units tier, `ᱯᱷᱤᱴ`.
 *    STILL REPORTED, with the reason: `people/km²` ×1 (the density frame needs a "per" word, and `ᱯᱚᱨᱚᱛᱤ`
 *    is 13 tokens in ONE article — too thin), `Mw` ×1 (no moment-magnitude word), and the URL
 *    `www.balochistanpolice.gov.pk` (a URL, correctly left as a visible leak rather than spelled out).
 *  • ⚠ ROMAN NUMERALS ARE FOLDED TO SANTALI NUMBERS BY THE REGISTRY, ABOVE THIS LAYER — `Peak XV` reads
 *    *ɡel mɔɳe* and `CITES Appendix II` reads *bar*. Recorded as a fleet-level observation, NOT touched
 *    here: `normalizeRomans` is the registry's shared pass and this file cannot see it.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { rewrite } from "../../core/provenance.ts";

/** Ol Chiki LETTERS and signs — U+1C5A–U+1C7D, exactly the class `santali.ts`'s `TOKEN` claims. */
const OL = "\\u1C5A-\\u1C7D";
/** One Ol Chiki letter or sign, as a bare class for lookarounds. */
const O = `[${OL}]`;
/**
 * The Ol Chiki VOWEL letters — ᱚ ᱟ ᱤ ᱩ ᱮ ᱳ. ⟨ᱹ GAAHLAA⟩ is a vowel diacritic and cannot attach to
 * anything else, which is what makes step 2's consonant test sound.
 */
const VOWEL = "[\\u1C5A\\u1C5F\\u1C64\\u1C69\\u1C6E\\u1C73]";
/**
 * ⟨ᱟ⟩ U+1C5F alone — the vowel that step 7's dot rule actually keys on, and the narrowing is measured.
 *
 * ⚠ THE FIRST DRAFT USED THE WHOLE VOWEL CLASS AND GLUED AN ACRONYM SHUT. `ᱯᱤ.ᱮᱥ.ᱮᱞ.ᱵᱷᱤ` (PSLV) has its
 * first dot after ᱤ, so the wide class rewrote it to `ᱯᱤᱹᱮᱥ` and the reading came out *pies el bʱi*
 * instead of *pi es el bʱi*. GAAHLAA on ᱤ is phonologically a no-op, which is why I expected the overlap
 * to be free — but a no-op SUBSTITUTION still JOINS the two segments where a space was wanted.
 *
 * The corpus settles it: **226 of the 246 vowel-preceded dots follow ᱟ**, and so do 1,171 of the 1,181
 * real ⟨ᱹ⟩ signs (the ᱮ/ᱤ/ᱩ tail is 0.8%). Every non-ᱟ dotted token in the corpus is an INITIALISM —
 * ᱯᱤ.ᱮᱥ.ᱮᱞ.ᱵᱷᱤ, ᱤ.ᱥ.ᱥ.ᱯᱷ., ᱮᱢ.ᱤ., ᱭᱩ.ᱴᱤ.ᱥᱤ, ᱮ., ᱴᱤ., ᱮᱞ., ᱮᱯ. — with not one genuine word among them. So
 * keying on ᱟ claims 92% of the real cases and hands the whole of the rest to the initialism arm, which
 * is where they belonged. Same discipline as trap 9: narrow the guard to the shape that was counted.
 */
const A = "\\u1C5F";
/** Any Unicode decimal digit — `\p{Nd}`, so Ol Chiki ᱐-᱙ counts. NEVER `\d` (93% of this corpus). */
const D = "\\p{Nd}";

const GAAHLAA = "ᱹ"; // ᱹ
const MU_GAHLA = "ᱺ"; // ᱺ
const PHAARKAA = "ᱼ"; // ᱼ
const RELAA = "ᱻ"; // ᱻ

/**
 * Santali text normalization. A numbered, ORDER-DEPENDENT sequence; each step states the coupling that
 * pins it where it is, because a future reader cannot recover that from the code.
 */
export function normalizeSantali(input: string): string {
    let s = input;

    // ── 1. INVISIBLES AND MARKUP RESIDUE ──────────────────────────────────────────────────────────────
    // ZWNJ/ZWJ/ZWSP and the bidi marks are outside `TOKEN`'s word class, so each one ENDS THE WORD and is
    // dropped: `ᱦᱚ‌ᱲ` reads *hɔ ɽ* instead of *hɔɽ*. 23 occurrences (ZWNJ ×15, ZWJ ×7, ZWSP ×1). Ol Chiki
    // is an alphabet with no ligature or half-form for these to control, so they carry nothing.
    s = rewrite(s, new RegExp(`(?<=${O})[​‌‍‎‏‬](?=${O})`, "gu"), "");  // ZWSP, ZWNJ, ZWJ, LRM, RLM, PDF
    // `&nbsp;` survives the dump into the artifact and sits BETWEEN A NUMBER AND ITS UNIT
    // (`83,883&nbsp;km²`). Repaired to a space FIRST, because step 10's tier matches a unit only when a
    // number is adjacent, and an unrepaired entity destroys exactly that adjacency (trap 54, `so`'s shape).
    s = rewrite(s, /&nbsp;/gu, " ");

    // ── 2. ⟨ᱻ RELAA⟩ AFTER A CONSONANT IS A KEYBOARD SLIP FOR ⟨ᱼ PHAARKAA⟩ ────────────────────────────
    // U+1C7B and U+1C7C are adjacent code points, both hyphen-shaped, both in the modifier-letter
    // subblock, and RELAA reads as the EMPTY STRING today — it is inside `TOKEN`'s word class but no
    // branch of `phonemizeWord` claims it. The corpus's five instances are `ᱵᱮᱲᱟᱻᱫᱚ ᱢᱤᱻᱢᱤᱫ ᱛᱤᱻ ᱛᱮ
    // ᱮᱱᱮᱡᱻᱮ ᱱᱟᱜᱟᱨᱻᱮ`, and the wiki elsewhere writes `ᱦᱩᱭᱩᱜᱻᱟ` for the ubiquitous `ᱦᱩᱭᱩᱜᱼᱟ`.
    //
    // ⚠ NARROWED TO THE CONSONANT CASE, AND THE FIRST DRAFT OF THIS RULE WAS BLIND AND WRONG. RELAA has
    // a LEGITIMATE function — it is the vowel-LENGTH mark, and the encoding material says it "may combine
    // with any oral or nasal vowel". So after a vowel it may be doing its own job and must not be
    // rewritten; after a CONSONANT the length reading is impossible and only PHAARKAA makes sense. That
    // splits the corpus's five: `ᱮᱱᱮᱡᱻᱮ` (after ᱡ) and `ᱱᱟᱜᱟᱨᱻᱮ` (after ᱨ) are repaired, and so is the
    // wiki's `ᱦᱩᱭᱩᱜᱻᱟ` (after ᱜ); the vowel-preceded ones are LEFT ALONE for `santali.ts` to read.
    //
    // ⚠ AND THE GUARD LOOKED AT ONE CHARACTER WHEN THE VOWEL CAN BE TWO. `ᱟᱹᱻ` and `ᱟᱸᱻ` have ⟨ᱹ GAAHLAA⟩ /
    // ⟨ᱸ MU⟩ between the vowel LETTER and the RELAA, so a bare `(?<!VOWEL)` saw a sign, called it a
    // consonant, and rewrote a legitimate length mark into a PHAARKAA that then vanished — the sources are
    // explicit that relaa is written AFTER the găhlă ṭuḍăg and combines with a NASAL vowel as readily as an
    // oral one, so the two vowel-modifying signs are TRANSPARENT here. U+1C78–1C7A is exactly ᱸ ᱹ ᱺ.
    s = rewrite(s, new RegExp(`(?<=${O})(?<!${VOWEL}[\\u1C78-\\u1C7A]?)${RELAA}`, "gu"), PHAARKAA);

    // ── 2b. AN ORPHAN SIGN IS A PUNCTUATION MARK SOMEBODY TYPED WITH THE WRONG KEY ────────────────────
    // ⚠ THE COMPANION FINDING TO STEP 2, AND THE SAME CLASS: a sign that is not attached to a letter is not
    // a sign at all. It still falls inside `TOKEN`'s word class, so `phonemizeWord` is handed a token with
    // no vowel to modify and returns the EMPTY STRING — silent, and invisible to every leak gate.
    //
    //   ⟨ᱺ MU-GAHLA⟩ ×3, standing alone, is a COLON. The glyph is two dots and that is what it was typed
    //   for: `ᱚᱲᱟᱜ ᱵᱷᱤᱛᱤᱨ ᱥᱴᱟᱰᱤᱭᱚᱢ ᱺ ᱱᱚᱰᱮ …` (indoor stadium: here …), `(ᱤᱝᱞᱤᱥ ᱺSukhumi Babushara Airport)`
    //   — the wiki's own "in English:" gloss frame — and `ᱡᱮᱞᱮᱠᱟ ᱺ-` ("for example :-").
    //   ⟨ᱹ GAAHLAA⟩ ×2 or more in a row, standing alone, is an ELLIPSIS: `᱐ - ᱒ = -᱒ ᱹᱹᱹ ᱾`.
    //
    // Both become the ASCII mark, which `TOKEN`'s punctuation arm already reads as a clause pause. NARROW
    // ON THE LEFT EDGE, because both signs are ordinary and frequent when they ARE attached (`ᱥᱟᱺᱜᱤᱧ`,
    // `ᱦᱟᱺᱰᱤ`, and GAAHLAA 1,181 times): only a sign with no Ol Chiki letter before it is claimed.
    // ⚠ A SINGLE orphan ⟨ᱹ⟩ is deliberately NOT claimed — `(ᱥᱤᱹᱰᱞᱤᱭᱩ ᱹᱣᱤᱭᱩ ᱹᱟᱨ)` (CWUR spelled out in Ol
    // Chiki) writes it as an initialism dot glued to the NEXT segment, where it is already harmless: the
    // sign is dropped and `ᱣᱤᱭᱩ` reads. Claiming it would put a pause inside an acronym — step 7's mistake.
    s = rewrite(s, new RegExp(`(?<!${O})${MU_GAHLA}`, "gu"), ":");
    s = rewrite(s, new RegExp(`(?<!${O})${GAAHLAA}{2,}`, "gu"), "…");

    // ── 3. DIGIT-FLANKED ⟨ᱹ GAAHLAA⟩ IS A DECIMAL SEPARATOR ───────────────────────────────────────────
    // The corpus writes decimals TWO ways: `᱒᱒.᱓᱓` ×84 and `᱓᱐ᱹ᱑%` ×16 — the GAAHLAA sign standing in for
    // the point, which is the same typewriter habit as step 4 running in the opposite direction. Today the
    // ᱹ form reads as NOTHING (a lone sign is an empty token), so `᱓᱐ᱹ᱑` silently merges into *thirty one*.
    // Folded onto the `.` behaviour rather than given a word: see the header's decimal refusal.
    // ⚠ BEFORE step 4, and disjoint from it by construction — this is digit-flanked, step 4 is
    // letter-flanked — but ordered first so the digit rules are all above the letter rules (playbook §4).
    s = rewrite(s, new RegExp(`(?<=${D})${GAAHLAA}(?=${D})`, "gu"), ".");

    // ── 4. DE-GROUP ───────────────────────────────────────────────────────────────────────────────────
    // ⚠ FIRST AMONG THE NUMBER RULES: a grouping comma is otherwise read as clause punctuation, and
    // `᱑᱐,᱐᱐᱐` reads *ɡel , sun* — "ten, zero", the quantity destroyed rather than merely paused.
    // 126 occurrences. ⚠ BOTH CONVENTIONS ARE PRESENT: western 3-3-3 (`᱒᱙᱙,᱗᱙᱒,᱔᱕᱘`) and Indian 2-2-3
    // (`᱑,᱒᱓,᱔᱕᱖`), which is why the group is `{2,3}` and repeated rather than a single `{3}` — a
    // 3-only guard would have left the language's own lakh/crore grouping half-degrouped.
    // ⚠ AND A GROUPING COMMA MAY NOT FOLLOW A LONE `0` — no convention groups from zero, so `0,001`
    // joining to `0001` is a 1000× error, not a reading.
    s = rewrite(s, new RegExp(`(?<=${D})(?<!(?<!${D})0)(?:,(?=${D}{2,3}(?!${D})))`, "gu"), "");

    // ── 5. THE NATIVE DOTTED UNIT ABBREVIATIONS `ᱠ.ᱢ.` AND `ᱢ.` ───────────────────────────────────────
    // The corpus abbreviates its units in OL CHIKI letters with dots — `᱑᱐᱕ ᱠ.ᱢ.` ×4, `᱘00 ᱢ.` ×4 — which
    // no Latin-keyed unit table can reach. Claimed HERE, above steps 6/7, because those spend the dots.
    // ⚠ ANCHORED ON BOTH EDGES OF THE OPERAND (trap 52): a lookbehind rejects one STARTING POSITION, not
    // the string, so the digit run must both begin where the match begins and be a real numeral. And the
    // one-letter `ᱢ.` key needs the left guard or it claims the LAST LETTER of `ᱮᱢ.` (M.A.) and `ᱮᱢ.ᱤ.` —
    // trap 28's family, arriving in Ol Chiki.
    s = rewrite(s, new RegExp(`(?<!${D})(${D}+(?:\\.${D}+)?)\\s*(?<!${O})ᱠ\\.ᱢ\\.?(?!${O})`, "gu"), "$1 ᱠᱤᱞᱚᱢᱤᱴᱚᱨ");
    s = rewrite(s, new RegExp(`(?<!${D})(${D}+(?:\\.${D}+)?)\\s*(?<!${O})ᱢ\\.(?!${O})`, "gu"), "$1 ᱢᱤᱴᱚᱨ");

    // ── 5b. `sq mi` — THE IMPERIAL GLOSS THIS CORPUS PUTS AFTER EVERY METRIC AREA ──────────────────────
    // ⚠ THE SECOND-BIGGEST LATIN SHAPE IN THE CORPUS, AND IT READ AS GARBAGE IN ENGLISH TOO. `sq mi` ×20 —
    // always the parenthetical imperial gloss of a km² figure, always in the same country-infobox sentence
    // (`… ᱚᱛ ᱦᱟᱥᱟ ᱫᱚ ᱦᱩᱭᱩᱜ ᱠᱟᱱᱟ 1,972,550 km² (761,610 sq mi)`) — fell to the English fallback and came out
    // *sk mˈiː*, because English does not expand `sq` either. It is not a leak the gates could see: two
    // plausible-looking syllables, trap 56's class.
    // ⚠ BOTH WORDS ARE ATTESTED IN EXACTLY THIS SLOT, so the match is WHOLE (trap 53):
    //   ᱢᱟᱭᱤᱞ  32 tok / 14 arts, and every example IS the parenthetical gloss — `᱖᱘,᱐᱔᱓ ᱠᱤᱞᱚᱢᱤᱴᱚᱨ
    //          (᱔᱒,᱒᱘᱐ ᱢᱟᱭᱤᱞ)`, `᱑᱕,᱐᱐᱕ ᱢᱟᱭᱤᱞ` — postposed after the numeral, same as ᱠᱤᱞᱚᱢᱤᱴᱚᱨ.
    //   ᱵᱚᱨᱜᱚ  39/10, the tier's own exponent word, and it PRECEDES its unit noun: `ᱵᱚᱨᱜᱚ ᱠᱤᱢᱤ`,
    //          `᱑᱒᱘.᱖᱔ ᱵᱚᱨᱜᱚ ᱠᱤᱢᱤ`, `ᱯᱚᱨᱚᱛᱤ ᱵᱚᱨᱜᱚ ᱠᱤᱢᱤ ᱨᱮ ᱑᱑᱐᱑`. So `ᱵᱚᱨᱜᱚ ᱢᱟᱭᱤᱞ` is the corpus's own
    //          `ᱵᱚᱨᱜᱚ ᱠᱤᱢᱤ` frame with its own mile word in the noun slot — composed, not coined.
    // ⚠ BARE `mi` IS NOT DECLARED AS A UNIT KEY (trap 46/28). Only the two-token `sq mi` shape is claimed —
    // the one that was counted — because a bare two-letter `mi` would fire on far more than a unit.
    // ⚠ ABOVE the symbol tier so the `sq`/`mi` pair never reaches it as two unrelated fragments.
    s = rewrite(s, new RegExp(`(?<=${D})\\s*sq\\s*mi(?![\\p{sc=Latn}])`, "gu"), " ᱵᱚᱨᱜᱚ ᱢᱟᱭᱤᱞ");

    // ── 6. THE ASCII HYPHEN AS ⟨ᱼ PHAARKAA⟩, NARROWLY ─────────────────────────────────────────────────
    // See the header's finding 2. Only the FINITE-VERB ENCLITIC is claimed — the shape that carries 70 of
    // the 99 hyphens and that the corpus itself writes both ways (`ᱢᱮᱱᱟᱜ-ᱟ` ×30 / `ᱢᱮᱱᱟᱜᱼᱟ`) — matching
    // the attested PHAARKAA suffix set `ᱼᱟ ᱼᱟᱜ ᱼᱟᱭ ᱼᱮ`. The ~29 genuine compound hyphens are left alone.
    // ⚠ Above step 8, because that step reads hyphens too: this one is LETTER-flanked and that one is
    // DIGIT-flanked, so they are disjoint, but the order is fixed so the disjointness is checkable.
    s = rewrite(s, new RegExp(`(?<=${O})-(ᱟᱜ?|ᱟᱭ|ᱮ)(?![${OL}])`, "gu"), `${PHAARKAA}$1`);

    // ── 7. THE ASCII PERIOD AS ⟨ᱹ GAAHLAA⟩, AND THE DOTTED INITIALISM ─────────────────────────────────
    // The layer's largest rule; the evidence is finding 1 in the header. Two arms, and the discriminator
    // is the language's own phonology rather than a heuristic: GAAHLAA is a VOWEL diacritic.
    //
    //   (a) a dot AFTER ⟨ᱟ⟩ and BEFORE another Ol Chiki letter → the sign. (Keyed on ᱟ rather than on the
    //       whole vowel class; the measurement that narrowed it is at `A`'s definition above.)
    //   (b) a dot after ⟨ᱟ⟩ at the END of the token → the sign, but only when the token has
    //       THREE OR MORE letters. The shortest token-final GAAHLAA form in the corpus is 3 (`ᱩᱞᱟ.`,
    //       `ᱤᱱᱟ.`); every initialism segment of that shape is 1–2 (`ᱮ.`, `ᱴᱤ.`, `ᱮᱢ.`, `ᱮᱞ.`, `ᱰᱨ.`).
    //   (c) everything left — a dot after a CONSONANT — is an initialism separator and becomes a SPACE,
    //       which is exactly right because these are Latin acronyms SPELLED OUT in Ol Chiki:
    //       `ᱯᱤ.ᱮᱥ.ᱮᱞ.ᱵᱷᱤ` (PSLV) → *pi es el bʱi*, `ᱟᱨ.ᱮᱱ.ᱟᱭ` (RNI), `ᱤ.ᱥ.ᱥ.ᱯᱷ.` (ISSF), `ᱭᱩ.ᱴᱤ.ᱥᱤ` (UTC),
    //       `ᱮᱢ. ᱮ.` (M.A.), `ᱰᱨ.` (Dr.), `ᱠ.ᱞ.` (the unexpanded era marker). Today each dot is a CLAUSE
    //       PAUSE inside the acronym.
    //
    // ⚠ THE TWO ARMS CONVERGE WHERE THEY OVERLAP, which is what makes the residue cheap: `ᱯᱤ.` in PSLV,
    // `ᱤ.` in ISSF and `ᱭᱩ.`/`ᱴᱤ.` in UTC are vowel-preceded and are read by arm (a) — but `santali.jsonc`'s
    // `gahla` table maps `i→i` and `u→u`, so the substitution is phonologically a NO-OP and its only
    // effect is the one wanted anyway, the spurious break going away.
    s = rewrite(s, new RegExp(`(?<=${A})\\.(?=${O})`, "gu"), GAAHLAA);
    s = rewrite(s, new RegExp(`(?<=${O}${O}${A})\\.(?![${OL}.])`, "gu"), GAAHLAA);
    s = rewrite(s, new RegExp(`(?<=${O})\\.(?=\\s*${O})`, "gu"), " ");
    s = rewrite(s, new RegExp(`(?<=${O})\\.(?!\\s*[${OL}])(?=\\s|$|[),])`, "gu"), " ");

    // ── 8. RANGES — THE ATTESTED INFIX `ᱠᱷᱚᱱ` ─────────────────────────────────────────────────────────
    // `᱑᱙᱔᱕-᱑᱙᱔᱖`, `᱒-᱓ ᱜᱤᱫᱽᱨᱟᱹ`, `᱔-᱕ ᱢᱤᱴᱚᱨ`, `᱒᱐᱑᱒-᱑᱓`, and the ⟨ᱼ PHAARKAA⟩-as-dash form
    // `᱑᱘᱔᱘ ᱼ ᱔᱙` from Run 3 — 21 hyphen ranges + 5 en-dash + 4 digit-flanked PHAARKAA. Today the joiner is
    // simply deleted and the two numbers run together.
    //
    // ⚠ THE GUARD IS THE POINT, AND IT IS TRAP 55's LESSON. The SAME corpus writes `᱑ - ᱐ = ᱑` and
    // `᱐ - ᱑ = -᱑` — subtraction and a true negative, in the wiki's arithmetic article. A bare
    // digit-hyphen-digit rule would read those as spans. So the rule refuses any match that has an
    // arithmetic operator in view on either side, which is what separates the two shapes in this corpus:
    // every range is a bare pair, every subtraction sits in an equation.
    //
    // ⚠ AND A SECOND GUARD THE CORPUS DIFF FOUND, not the probes (trap 3). The first draft read
    // `᱑᱐:᱓᱐ - ᱑᱑` — a Wikipedia credit line's time span — as a range between the MINUTES and the next
    // hour, giving *ɡel , pe ɡel kʰɔn ɡel mitʼ*. The joiner is not wrong about the span; it is attached to
    // the wrong operand, because `᱓᱐` is a clock FIELD and not a number in its own right. Since the clock
    // is deliberately unclaimed (see the header), the honest move is to leave the whole shape alone: a
    // left operand preceded by a colon is refused. One instance, and refusing it costs nothing.
    //
    // ⚠ AND THE RIGHT-HAND COLON GUARD WAS TOO WIDE, which the orphan-PHAARKAA census found. `(?![:\d])`
    // refused `᱑᱙᱙᱘ᱼ᱑᱙᱙᱙: ᱠᱟᱞᱤᱫᱟᱥ ᱥᱚᱢᱟᱱ` — an AWARDS LIST, where the colon introduces the prize and the
    // span before it is a plain year range — and the refusal was invisible, because the abandoned ⟨ᱼ⟩ then
    // read as the empty string. The clock hazard is a colon followed by a DIGIT (`᱒-᱓:᱓᱐`), never a colon
    // followed by a space and a name, so the guard now says exactly that. The LEFT operand's own
    // `(?<![:.]\d{0,4})` is untouched and still refuses the `᱑᱐:᱓᱐ - ᱑᱑` case it was written for.
    const RANGE_DASH = `[-–—${PHAARKAA}]`;
    s = rewrite(s,
        new RegExp(`(?<![-+×÷=<>]\\s?)(?<![:.]${D}{0,4})(?<!${D})(${D}+(?:\\.${D}+)?)\\s?${RANGE_DASH}\\s?(${D}+(?:\\.${D}+)?)(?!\\s?[-+×÷=<>])(?!${D})(?!:${D})`, "gu"),
        "$1 ᱠᱷᱚᱱ $2");

    // ── 9. `°C` — THE SCALE NAME, AND ONLY THAT ONE ───────────────────────────────────────────────────
    // `᱓᱐ °C` reads *pe ɡel sˈiː* today: the ⟨C⟩ falls to the English fallback and is spoken as the letter
    // name "see", which is trap 56's class — a plausible word rather than a visible leak.
    // ⚠ ORDERED AFTER step 8 so `᱑᱕ ᱠᱷᱚᱱ ᱒᱕ °C` has already become a span, and BEFORE step 10 so the tier
    // never sees a bare `C` to reason about.
    // ⚠ `°F` ×2 AND THE COORDINATE `°N/E/S/W` ×6 ARE DELIBERATELY NOT CLAIMED — no Fahrenheit word and no
    // sourced direction words, and half a reading is worse than none (trap 53). The whole match is refused,
    // so those keep exactly the reading they had; the sign stays visible to the leak gates.
    s = rewrite(s, new RegExp(`(${D})\\s*°\\s*C(?![\\p{sc=Latn}])`, "gui"), "$1 ᱰᱤᱜᱨᱤ ᱥᱮᱞᱥᱤᱭᱚᱥ");
    // ── 9b. THE BARE `°`, WHERE THE NOUN AFTER IT IS ALREADY SANTALI ──────────────────────────────────
    // ⚠ FOUND BY THE SCAN AFTER 9 LANDED, WHICH IS THE NORMAL ORDER — a cell can hide behind itself.
    // The corpus's DOMINANT temperature and coordinate shape is not `°C` at all; it is a bare `°` with the
    // noun spelled out in Santali right after it:
    //     ᱒᱙° ᱠᱷᱚᱱ ᱓᱖° ᱥᱮᱞᱥᱤᱭᱚᱥ            (29 to 36 Celsius)
    //     ᱔᱔° ᱟᱨ ᱕᱓° ᱠᱚᱧᱮ ᱚᱠᱷᱟᱝᱥᱚ          (44 and 53 north LATITUDE)
    //     ᱒᱒° ᱟᱨ ᱔᱑° ᱥᱟᱢᱟᱝ ᱫᱽᱨᱟᱜᱷᱤᱢᱟ        (22 and 41 east LONGITUDE)
    // Only the `°` itself is unread, and `ᱰᱤᱜᱨᱤ` is attested in exactly this slot — the wiki writes
    // `89 ᱰᱤᱜᱨᱤ 46 ᱢᱤᱱᱤᱴ … ᱫᱨᱟᱜᱷᱤᱢᱟ` for a longitude and `᱓᱓.᱘ ᱰᱤᱜᱨᱤ ᱥᱮᱞᱥᱤᱭᱟᱥ` for a temperature. So the
    // match is WHOLE here (trap 53 satisfied): the reading needs one word and the language supplies it.
    // ⚠ REFUSED before a Latin letter (`°F`, `°N`, `°E` — no Fahrenheit word, no sourced direction words,
    // and reading only the `°` would leave `N` to the English fallback as *ˈɛn*), and before a digit or an
    // arc-minute/second mark (`77°12.5′E` is a DMS coordinate needing minute and second words this layer
    // does not have). Half a reading is worse than none.
    s = rewrite(s, new RegExp(`(${D})\\s*°(?![\\p{sc=Latn}${D}′″'"])`, "gu"), "$1 ᱰᱤᱜᱨᱤ");

    // ── 10. THE SHARED SYMBOL TIER — %, CURRENCY, UNITS, ² ─────────────────────────────────────────────
    // Trap 47's test is "can the tier SAY it?", and for Santali it can: percent, currency and units are all
    // POSTPOSED after the numeral (`᱒ ᱯᱟᱨᱥᱮᱱᱴ ᱢᱮᱨᱤᱴ`, `᱑ ᱰᱚᱞᱟᱨ ᱑᱐᱐ ᱥᱮᱱᱴ`, `᱖᱘,᱐᱔᱓ ᱠᱤᱞᱚᱢᱤᱴᱚᱨ`), the
    // exponent word is an invariant modifier, and there is no number agreement to express. Nothing here
    // needs a local table.
    // ⚠ `unspacedScript` is NOT set: Santali is spaced, so the tier's `(?<![\p{L}\p{M}])` guards are right
    // and Ol Chiki letters are `\p{L}`, so a key cannot bite into a word (trap 27 is not this language's).
    return SYMBOLS(s);
}

const SYMBOLS = makeSymbolNormalizer({
    // Postposed. The NATIVE calque, and it beat the loan on every axis — see the header.
    percent: ["ᱥᱟᱭᱠᱚᱲᱟ"],
    currency: {
        // Sourced sign-first: sat.wikipedia states `ᱢᱟᱨᱠᱤᱱ ᱰᱚᱞᱟᱨ (ᱯᱚᱛᱥᱟ ᱪᱤᱱᱦᱟᱹ: $ …)` and
        // `ᱵᱟᱝᱞᱟᱫᱮᱥᱤ ᱴᱟᱠᱟ (… ᱪᱤᱱᱦᱟᱹ: ৳ …)`. ₹ rests on the corpus's own `₹᱕᱐᱐ ᱠᱳᱴᱤ ᱴᱟᱠᱟ` and is the
        // weaker of the three; recorded rather than left to be rediscovered.
        // ⚠ `US$` IS ITS OWN KEY, longest-first, because a bare `$` is letter-bounded on the left and
        // cannot match inside a code prefix. The corpus writes `US$᱖᱕,00,00,000` and `US$᱑,᱑᱑᱐,᱐᱐᱐`, and
        // both reported `DROP currency` until this key existed. It reads the same word: the corpus's own
        // gloss is `ᱢᱟᱨᱠᱤᱱ ᱰᱚᱞᱟᱨ` ("American dollar"), and `ᱢᱟᱨᱠᱤᱱ` is already in the text where it matters.
        "US$": ["ᱰᱚᱞᱟᱨ"],
        // ⚠ `HK$` IS THE SAME TRAP AS `US$` AND WAS MISSED WITH IT (trap 64). The corpus writes the Hong
        // Kong bank's balance sheet twice in one sentence — `HK$᱓᱒᱗ ᱵᱤᱞᱤᱭᱚᱱ ᱥᱚᱢᱯᱚᱛᱤ ᱟᱨ HK$᱒᱙ ᱵᱤᱞᱤᱭᱚᱱ ᱞᱟᱵᱷ`
        // — and both read as a bare number with the code recited as English letter names
        // (*ˈeᶦt͡ʃ kʰˈeᶦ pe saj bar ɡel ejaj bilijɔn*), the currency noun absent. THE SAME WORD, on this
        // entry's own precedent: `US$` above already emits the plain ᱰᱚᱞᱟᱨ rather than a nation-specific
        // phrase, so the generic dollar noun is what this corpus is established to say for a coded dollar.
        // No Santali name for the Hong Kong dollar specifically is attested, and none is invented here.
        "HK$": ["ᱰᱚᱞᱟᱨ"],
        $: ["ᱰᱚᱞᱟᱨ"],
        "৳": ["ᱴᱟᱠᱟ"],
        "₹": ["ᱴᱟᱠᱟ"],
    },
    units: {
        // ⚠ BARE `m` IS DELIBERATELY ABSENT (trap 46). The Ol Chiki `ᱢ.` form is what this corpus writes
        // and step 5 claims it with its own guard; a one-letter Latin key would buy nothing here and would
        // expose the `802.11m` class. `cm` is declared for robustness though the corpus spells the word out
        // — that is a plausible-input fix, not a measured-defect repair, and this comment says which.
        km: ["ᱠᱤᱞᱚᱢᱤᱴᱚᱨ"],
        cm: ["ᱥᱮᱱᱴᱤᱢᱤᱴᱚᱨ"],
        mm: ["ᱢᱤᱞᱤᱢᱤᱴᱚᱨ"],
        // ⚠ THE FOOT WORD EXISTS AND RUN 12 SAID IT DID NOT. `LEAK RAW-LATIN ft ×1` was left open on
        // "no foot word sourced"; re-probing finds TWO, both attested and both in precisely this slot —
        // the parenthetical imperial gloss after a metre figure, the same frame as ᱢᱟᱭᱤᱞ above:
        //   ᱯᱷᱤᱴ 63 tok / 16 arts — `᱓᱐᱔ ᱢᱤᱴᱚᱨ (᱙᱙᱙ ᱯᱷᱤᱴ)`, `᱔,᱔᱗᱗ ᱯᱷᱤᱴ (᱑,᱓᱘᱒ ᱢᱤᱴᱚᱨ)`
        //   ᱯᱷᱩᱴ 25/13        — `᱔᱒᱘᱐ ᱢᱤᱴᱚᱨ (᱑᱔,᱐᱔᱐ ᱯᱷᱩᱴ)`, `᱑᱕᱐ ᱯᱷᱩᱴ(᱔᱖ ᱢᱤᱴᱟᱹᱨ)`
        // A real spelling tie like the Celsius one, decided on count and article spread rather than hidden:
        // ᱯᱷᱤᱴ wins 63/16 against 25/13. The corpus's own instance is `3,776.24 m (12,389 ft)`, Mount Fuji.
        ft: ["ᱯᱷᱤᱴ"],
    },
    // `ᱵᱚᱨᱜᱚ` PRECEDES its noun — `ᱵᱚᱨᱜᱚ ᱠᱤᱢᱤ`, `ᱯᱚᱨᱚᱛᱤ ᱵᱚᱨᱜᱚ ᱠᱤᱢᱤ ᱨᱮ ᱑᱑᱐᱑` — so `position: "before"`.
    // ⚠ `cubed` IS OMITTED, not guessed: no cube word is attested and `km³` is ×0 in this corpus. The tier
    // then re-emits `³` where the leak gate can see it, which is the honest state (trap 53's `ak` shape).
    exponentWords: { squared: ["ᱵᱚᱨᱜᱚ"], position: "before" },
});
