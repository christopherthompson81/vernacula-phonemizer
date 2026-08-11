/**
 * THE DEFECT CLASSES, in one place — what counts as a leak, what counts as a drop, and the
 * REDUNDANT-vs-DROP discrimination that separates a permissible drop from a real one.
 *
 * ⚠ EVERY TABLE HERE IS A FLEET FACT, NOT A PER-TOOL SETTING. These tables were once copied into each tool
 * that needed them and drifted apart, leaving the strongest gate in the repo blind to two whole sign classes
 * while the others could see them. Add a class here, never in a caller.
 */

/** A LEAK is a character that SURVIVED into the IPA and should not have. */
export const LEAK_CLASSES: readonly (readonly [string, RegExp])[] = [
    // ⚠ `\p{Nd}`, NOT `\d`: under the `u` flag `\d` is ASCII 0-9 and nothing else, so `\d` is blind to a digit
    // leak in every language that writes its own numerals — Burmese ၀-၉, Thai ๐-๙, Bengali ০-৯, Khmer, Lao.
    ["DIGIT", /\p{Nd}/u],
    ["SLOT-GAP", /\s{2,}|^\s|\s$/u],
    // ⚠ NOT `.,;:!?` — those are the CANONICAL inline pause marks every engine emits via clauseSink, so
    // including them flags every utterance and the check tells you nothing. What belongs here is a mark that
    // should have BECOME one of those and did not: a native terminator, a symbol, or a non-ASCII digit.
    // U+00BA º and U+00AA ª are here because a class holding only `°` (U+00B0) lets `dell'11º` →
    // `undˈit͡ʃi º` pass the scan clean.
    ["RAWMARK", /[…。、，％℃°ºª〜～・！？²³\p{Sc}।॥۔؟،؛]/u],
    ["ZERO-WIDTH", /[​-‍⁠﻿]/u],
];

/**
 * A DROP is a symbol that VANISHED — detected differentially: phonemize the sentence, then phonemize it again
 * with the symbol REPLACED BY A SPACE (see `withoutSymbol`; deleting it perturbs how its neighbours tokenize
 * and the test then credits the symbol for that), and compare. Identical readings prove it said nothing.
 *
 * Keep each pattern at its WIDEST form — `minus` has to include the EN DASH, because a corpus writes `–5` as
 * readily as `-5`.
 */
export const DROPPABLE: readonly (readonly [string, RegExp])[] = [
    // U+066A ٪ is the Arabic-script sign and U+FF05 ％ the fullwidth one — both are ordinary typography in
    // their scripts, and the tier already accepts them.
    ["percent", /[%‰٪％]/gu],
    ["currency", /\p{Sc}/gu],
    ["degree", /[°℃℉]/gu],
    // Only where a digit FOLLOWS and no letter/digit precedes, so a compound hyphen (`Il-76`, `COVID-19`) and
    // a range (`5-3`) are not mistaken for a negative. Probe forms never merge two digits, so `-`/`+` are
    // judged on `5-`/`-5` and not on `5-5` → `55`.
    //
    // ⚠ `\p{M}` IS IN THE GUARD, and leaving it out makes this class blind across every abugida in the fleet.
    // A Devanagari word usually ends in a MATRA, not a bare consonant: the character before the hyphen in
    // `फ़ॉर्मूला-1` is ा (U+093E, `Mn`), so `(?<!\p{L})` passes and the scan reports a DROP on Formula-1 — a
    // designation whose hyphen is correctly silent.
    //
    // ⚠ THE SECOND LOOKBEHIND EXCLUDES A RANGE, and without it this class measures almost nothing it claims
    // to: resolved per hit, the overwhelming majority of "dropped minus" reports are ranges (`(1418 -1450)`,
    // `1995 -96`), designations (`चंद्रयान -1`) and apposition dashes, against a bare handful of true
    // negatives across the whole fleet.
    // ⚠ THE WINDOW IS DELIBERATELY TIGHT — a digit, then at most an ordinal suffix or an abbreviating dot,
    // then at most one space — rather than "a digit somewhere behind". Widen it far enough to reach past two
    // abbreviations and it swallows `०.३७२७१९ ख॰इ॰), -२.८८ परिमाण`, an astronomical magnitude and a genuine
    // negative. Under-excluding a range is a stray report; over-excluding deletes a true positive.
    //
    // ⚠ A DESIGNATION AFTER A SPACE IS NOT DECIDABLE HERE and is deliberately still reported. `चंद्रयान -1`
    // and a real `-5 stupňů` are the same shape — word, space, dash, digit — so separating them needs a
    // lexicon, not a guard. Those hits want a per-language judgement; a quiet gate would be worse. They are
    // accepted BY IDENTITY instead, in `ACCEPTED_SILENT` below.
    ["minus", /(?<![\p{L}\p{M}\p{Nd}])(?<!\p{Nd}[\p{L}\p{M}]{0,2}[.,]?[ \t]?)[-−–](?=\p{Nd})/gu],
    ["math-sign", /[+±×÷=<>]/gu],
    /**
     * ⚠ A SUPERSCRIPT WITH NOTHING BEFORE IT IS NOT AN EXPONENT. `⁸C` is an ISOTOPE MASS NUMBER — the
     * superscript precedes the element symbol — and `³He` the same; no language reads either as a power, and
     * `normalizeSymbols.ts` is right not to (its own `BARE_EXPONENT` requires a base BEFORE the run). A bare
     * `/[²³⁰¹⁴-⁹]/gu` reports a dropped exponent for text the reader is correct to leave alone.
     *
     * A LOOKBEHIND, not a captured base, because the scan needs the SIGN's own extent to test its removal.
     *
     * ⚠ IT MATCHES THE WHOLE RUN AND ALLOWS A SPACE. A superscript digit is `\p{No}`, not `\p{Nd}`, so a
     * per-character pattern anchored on a base matches only the FIRST superscript of `10¹⁵` and silently
     * shortens the sign's extent; and corpora write the sign spaced (`0,5 ² км`, `16000km ² `), which
     * `normalizeSymbols.ts` reads via its own `\s?`.
     *
     * ⚠ AND THE RUN INCLUDES THE SUPERSCRIPT MINUS, because `kg⁻²` is a real exponent whose run begins with
     * it. Leaving it out truncates every negative exponent to the digits after the sign.
     *
     * ⚠ A TRAILING LETTER IS WHAT ACTUALLY IDENTIFIES ISOTOPE NOTATION, and the base test alone does not
     * catch it: allowing the space that real spaced exponents need also lets `is ⁸C` through, since a letter
     * and a space do precede that superscript. What no exponent does is run straight into a letter. A power
     * is terminal or followed by punctuation, a space, or an operator.
     *
     * ⚠ THE LOOKAHEAD MUST ALSO EXCLUDE A FOLLOWING SUPERSCRIPT, or BACKTRACKING defeats it. On `¹⁴C` the
     * engine matches the run `¹⁴`, fails the letter test on `C`, then backtracks to `¹` — where the next
     * character is `⁴`, not a letter, so the trimmed match succeeds and the isotope is flagged after all.
     * Forbidding a superscript after the run leaves nothing to backtrack into.
     */
    ["exponent", /(?<=[\p{L}\p{M}\p{Nd}][ \t]?)[²³⁰¹⁴-⁹⁻]+(?![\p{L}\p{M}²³⁰¹⁴-⁹⁻])/gu],
    ["ampersand", /[&＆]/gu],
    ["iteration", /[ๆ々〃ヽヾゝゞៗ]/gu],
];

/**
 * WORDS SOURCED FROM OUTSIDE THE CORPUS, each with its citation — the `sourcing` gate's escape hatch, and the
 * narrowest one in this file.
 *
 * ⚠ WHY THIS IS NEEDED AT ALL: A CORPUS CANNOT ATTEST HOW A SYMBOL IS SPOKEN. Writers type `2.5`; they do not
 * spell out how they say it. So a language's decimal word can score exactly zero against a half-million-line
 * wiki dump and still be in universal spoken use, and a gate satisfiable only by corpus hits pushes the layer
 * toward dropping the symbol — the worse outcome.
 *
 * ⚠ AND WHY IT IS NOT SIMPLY THE MANIFEST. A haystack that includes the language's own `.jsonc` is the file
 * the gate EXTRACTS its needles from, so every declared word attests itself and a substituted nonsense word
 * passes. A declaration cannot be its own evidence; a citation naming a source outside this repository can.
 *
 * ⚠ THE CITATION IS THE POINT, NOT THE EXEMPTION. Anything vague enough that a reader could not go and check
 * it ("a dictionary", "standard usage") is a TODO wearing a citation's clothes and must keep failing the
 * gate. Name the work, the headword and the sense.
 */
export const CITED_WORDS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    cjy: {
        "百分之": "⚠ THERE IS NO JIN CORPUS TO ATTEST ANYTHING IN — no cjy.wikipedia exists, and the "
            + "Wikimedia Incubator's Wp/cjy holds 3,060 Han characters whose artifact covers 7 of 35 cells "
            + "with `percent` among the EMPTY ones. So this rests on two other legs. (1) IT SPEAKS, which is "
            + "the gate that matters for this engine: 百 分 之 are all in the shipped Wiktionary/kaikki "
            + "Taiyuan dict, so 百分之 reads pai˥˧ fəŋ˩˩ t͡sz̩˩˩ — where ⟨度⟩ and ⟨摄氏⟩ are SILENT and were "
            + "refused for exactly that reason. (2) IT IS THE PAN-SINITIC WRITTEN FORM, not a dialect "
            + "vocabulary choice: 百分之 is corpus-verified in the cmn, yue and wuu layers already shipped, "
            + "each against its own corpus, and Jin is written in the same Han orthography. The genuinely "
            + "dialectal choices in this layer — the ampersand and the range word — were NOT inferred this "
            + "way; they come from the incubator text (和 ×16 coordinating, 到 ×5).",
    },
    hak: {
        "百分之": "⚠ THE GATE CANNOT SEE THIS WORD BECAUSE THE CORPUS IS IN THE OTHER ORTHOGRAPHY — the same "
            + "shape as nan, and for a stronger reason here: hak.wikipedia is written in Pha̍k-fa-sṳ and "
            + "**93.5% of its characters are Latin**, so a HAN spelling scores zero there by construction. "
            + "The romanization attests it directly. (1) THE WHOLE WORD, ONCE: `Sîn Nò-vî-ngî pûn sṳ́-yung "
            + "yî chhû-kiê sû-siá tha̍t-tó pak-fûn-chṳ̂-sṳ̍p-ńg` — 百分之十五, 15%, the percent word in a "
            + "percentage. (2) ITS SECOND HALF, ×39, IN EXACTLY THE CONSTRUCTION THE FRACTION RULE NEEDS: "
            + "`sâm-fûn-chṳ̂-ngi` (三分之二 = 2/3), `si-fûn-chṳ̂-yit` (四分之一), `ńg-fûn-chṳ̂-yit` (五分之一) "
            + "— denominator first, which is what makes 百分之 'of a hundred parts' rather than a borrowing. "
            + "(3) IT SPEAKS, which is this engine's hard gate: 百 分 之 are each dict keys, so 百分之 reads "
            + "pak̚¹ pun⁴⁴ t͡sz̩⁴⁴ — where ⟨度⟩ did NOT speak and had to be sourced as a derived entry before "
            + "the degree rule could exist at all.",
    },
    nan: {
        "百分之": "⚠ THE GATE CANNOT SEE THIS WORD BECAUSE THE CORPUS IS IN THE OTHER ORTHOGRAPHY. "
            + "nan.wikipedia is written in POJ, so a HAN spelling scores zero there by construction — and "
            + "this layer sources its words from POJ prose but EMITS them in Han, because the POJ forms leak "
            + "ASCII through the converter (`hun chi` → *hun chi˥*, the 之 syllable unmapped) while the Han "
            + "forms read cleanly. Two independent legs hold it up. (1) THE CONSTRUCTION IS CORPUS-ATTESTED: "
            + "百分之 is 百 + 分之, and the corpus writes `Tē-kiû ê gō͘ hun chi it` (1/5), `7 hun chi 1`, and "
            + "`1-pah-bān-hun chi it` — the same construction with a magnitude prefix, which is exactly what "
            + "百分之 is. (2) THE HAN SPELLING IS VALIDATED BY THE SHIPPED MOE DICTIONARY (Taiwan Ministry of "
            + "Education Taiwanese dictionary, via dict.tsv): 分之 reads hun-t͡ɕi and 百分之 reads paʔ-hun-t͡ɕi, "
            + "the POJ word's own reading. The same two-step is confirmed outright elsewhere — nan.wikipedia "
            + "glosses `Kong-lí ta̍k tiám-cheng (公里逐點鐘)`, pairing the POJ and Han spellings in one line.",
    },
    ig: {
        // Igbo has NO independent referee (wikipron ibo_latn, epitran ibo-Latn, kaikki: all 404), so a
        // non-corpus tier is the only tier it has beyond the corpus itself.
        "ntụkpọ": "Nkọwa okwu (nkowaokwu.com), an Igbo dictionary published by a 501(c)(3) nonprofit: "
            + "`ǹtụ̀kpọ`, n. 'decimal point; decimal number', with the definitional example "
            + "\"E ji ntụkpọ ekewapụ nọmba nnuzuroke na nọmba ọgwa\" — 'ntụkpọ is used to separate whole "
            + "numbers from fractions'. Corpus evidence is ZERO and that is expected: 0 hits for the word and "
            + "every variant, 0 digit-point-digit instances, and the 89 whole-word `point` hits are all English "
            + "text inside the Igbo wiki. Shipped untoned, matching the dictionary's own running-text examples "
            + "and the register of every other word the layer emits (pasent, naira, dollar)",
    },
};

/**
 * SIGN CLASSES A LANGUAGE IS INTENTIONALLY SILENT ON — the synthetic-probe counterpart of `ACCEPTED_SILENT`
 * below, and the difference between the two matters.
 *
 * `ACCEPTED_SILENT` names CORPUS LINES: this exact sentence's hyphen is a designation, so the drop is
 * correct. This names a whole CLASS for a language: no reading of this sign is shippable here at all, so a
 * synthetic probe (`-5`, `+5`) will always report DROPPED and always be right to.
 *
 * ⚠ WHY IT EXISTS RATHER THAN JUST LETTING THE GATE FAIL. A hard fail that can never be fixed is noise, and a
 * permanently red line says nothing about whether anything has REGRESSED.
 *
 * ⚠ AND IT IS DELIBERATELY SHORT. Only a class whose refusal is ARGUED IN THE LANGUAGE'S OWN FILE belongs
 * here; "no rule yet" is a TODO and must keep failing. Adding a real gap here to quiet the gate is exactly
 * the wrong use of it — and a long block is a smell, since the two highest-frequency entries this file ever
 * carried both turned out to be wrong refusals.
 *
 * The reason string is printed by both tools, so the justification travels with the exemption.
 */
export const ACCEPTED_SIGN_SILENCE: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    hsn: {
        // ⚠ THERE IS NO hsn.wikipedia AND NO REFEREE. Every reason below is read off the Wikimedia Incubator's
        // `Wp/hsn` — 153 pages, 30,640 characters, the only Xiang text that exists — plus a DICT CHECK through
        // the shipped engine, which is the harder gate: `sinitic/hanDictIpa.ts` skips an uncovered character
        // SILENTLY, so an unsourced word does not mispronounce, it VANISHES.
        times: "measured: `×` occurs ONCE in the whole corpus and it is SCIENTIFIC NOTATION — `質量5.9742×"
            + "10²⁴公斤`, the mass of the Earth — which this layer reads for no language. And the word is not "
            + "available anyway: ⟨乘⟩ is SILENT in this dict, so emitting it would delete the operator rather "
            + "than read it",
        equals: "measured: `=` is digit-adjacent 0 times; the corpus's `===` runs are wiki heading markup. "
            + "⟨等於⟩/⟨等于⟩ is HALF — the engine emits tən˦˩, one syllable of two, dropping 於 — so the "
            + "reading would be a truncated word",
        plus: "measured: zero digit-adjacent `+` in 30,640 characters",
        minus: "measured: the only digit-flanked dashes are the 3 ranges the layer READS (到, normalize.ts "
            + "step 6) and the coordinate span `東經111°53'－114°5'`. No negative number occurs",
        "plus-minus": "measured: zero ± in the corpus",
        "less-than": "measured: zero < in the corpus",
        "greater-than": "measured: zero > in the corpus",
        divide: "measured: zero ÷ in the corpus. ⟨除⟩ does speak, unlike ⟨乘⟩, but there is nothing to read",
        exponent: "⚠ THE SQUARED/CUBED UNIT IS READ (平方/立方 compose onto the unit noun, normalize.ts step "
            + "4); a BARE superscript is not, and that is this corpus's sharpest finding. Of its 24 "
            + "superscript runs **23 are ROMANIZATION TONE NUMBERS** from the 湘語羅馬字 tables the incubator "
            + "carries — /ʃɘ̃⁴⁵/, /ye²⁴/, /mɔ⁴²/, /tɕiɑʌ⁴⁵/, /n̩⁴²/ — and exactly ONE is an exponent "
            + "(5.9742×10²⁴). Reading superscripts as powers would turn a pronunciation table into "
            + "arithmetic. hsn is the FIFTH Sinitic corpus to produce this hazard from a fifth source, after "
            + "wuu, nan, cjy and hak; test/accepted-silent.test.ts predicted it here by name",
        // ⚠ THE KEY IS `degrees`, PLURAL — it must match the PROBE name in review.ts's signCases, not the
        // DROPPABLE class name. Spelled `degree` here it silently exempts nothing and the gate still fails.
        degrees: "measured: the corpus's only 2 `°` are COORDINATES (`東經111°53'－114°5'`, `北緯27°51'－"
            + "28°40'`), where neither the degree nor the primes has a reading. And the word is unavailable: "
            + "⟨度⟩ is SILENT in this dict and ⟨攝氏⟩ is HALF (sz̩˦˥ — it would say 'shì' and drop 'shè'), so "
            + "`20°C` would lose the WORD as well as the sign — strictly worse than the raw sign, which at "
            + "least survives as a RAWMARK the scan can see",
        currency: "measured: NO currency sign occurs in the 30,640-character corpus at all — not ¥, not $, "
            + "not €. ⟨元⟩ speaks and appears ×33, but every instance is an already-spelled amount "
            + "(`可支配收入12434元`) — the WORD, never a sign to rewrite. Declaring a currency would be "
            + "robustness for input this language has never been observed to write, and the sign probe would "
            + "then be reporting on a rule with no evidence behind it",
        ampersand: "n/a — the ampersand IS read (跟, the corpus's own coordinator ×136 against 和 ×63; "
            + "normalize.ts declares it through the shared tier)",
    },
    ps: {
        // ⚠ NO ESPEAK PASHTO AT ALL, so every reason below is a corpus measurement over a fresh
        // ps.wikipedia dump (242,649 lines after markup and category-residue filtering) and nothing else can
        // check it. Argued at length in src/languages/pashto/normalize.ts's header.
        equals: "measured: `=` counts 7,734 and essentially NONE of it is arithmetic. The bulk is WIKI "
            + "SECTION HEADING markup that wikidump-to-text.py leaves in (`==خوي او عادتونه==`, "
            + "`==په طبيعت کښي د يورانيم موجوديت==`) and the rest is chemistry and physics copy "
            + "(`P1=750mmHg V1=290cc`). Reading the sign would say an equals word twice on every heading. "
            + "`مساوي` ×935 is the ordinary copula-adjective, never a digit-adjacent operator",
        plus: "measured: `+` counts 2,001 and is almost entirely CHEMICAL EQUATIONS — `2KMnO4+10FeSO4+"
            + "8H2SO4`, `Cl2+2NaOH → NaClO + NaCl + H2O`, `Al2O3.2H2O + 6NaOh`. `جمع` ×1,729 is the ordinary "
            + "noun 'sum/total' and the corpus never places it between two operands",
        times: "measured: `×` counts 196 and is FOUR different things in one glyph — a cartridge dimension "
            + "(`۳۹×۷،۶۲ ماډل ۴۳ گولی`), scientific notation (`1.60218 × 10 −13 J`), an equipment count "
            + "(`۲ × Lyulka AL-37FU`) and genuine arithmetic in one maths article (`1×8 + 90×8`). `ضرب` "
            + "×574 is attested but no single reading is right for all four senses",
        "less-than": "measured: `<` is digit-adjacent 1 time in the artifact, inside a temperature range "
            + "copied from an English source (`>950 °C; >1,740 °F`) — a comparative, not an operator",
        "greater-than": "measured: same instance as `less-than`, the same imported English fragment",
        "plus-minus": "measured: zero ± in 242,649 lines",
        divide: "measured: zero ÷ in 242,649 lines",
        ampersand: "measured: all 297 `&` sit inside LATIN text — `AT&T`, `P&T/Telecom Éireann`, "
            + "`Sight & Sound`, the Bangladeshi highway pair `N4 & N405`, and URL query strings "
            + "(`…&oldid=421080475`). The Pashto conjunction is `او`, and emitting it here would put a "
            + "Pashto word inside an English proper name",
    },
    ln: {
        // ⚠ NO ESPEAK LINGALA AT ALL and a 36-line referee, so every reason below is a corpus measurement
        // over a fresh ln.wikipedia dump (23,678 paragraphs) and nothing else can check it. The refusals are
        // argued at length in src/languages/lingala/normalize.ts's header.
        minus: "measured: the digit-flanked dash in Lingala is a RANGE, not a minus — 1,424 hyphens and 162 "
            + "en dashes sit between digits, and reading them gives year spans (`1965 - 1997 Mobutu Sese "
            + "Seko`, a governor list), ISBNs and the ISO code `639-3`. Of 228 LEADING dashes, two are true "
            + "negatives (`-273,15 °C`, `-1,602 189 × 10⁻¹⁹`); the rest are coordinates (`-4.2667`), a "
            + "postcode (`B-3840`), a compound (`TB-8,000`) and open-ended spans (`19.. - 1960`). And no "
            + "negative word exists: `molongola` ×1 is an ADJECTIVE in a physics gloss ('mokúmba ya "
            + "molongola (negative \"-\")'), i.e. the wrong register. Ranges ARE read (kino, normalize.ts "
            + "step 7). ⚠ OMITTING A MINUS INVERTS — this is a known-wrong silence, not an acceptable one",
        plus: "measured: 16 digit-flanked `+`, and not one is arithmetic — TELEPHONE COUNTRY CODES (`+255`, "
            + "`+872 – unassigned`, a dialling-plan article), two album titles (`Libala 1+1`, `1+1=1 (Remix "
            + "Total)`) and a French book title (`Devenir Président en 50 + 20 jours`). Of 360 leading `+`, "
            + "the bulk is that same dialling table plus infobox residue (`bato1= +30 000 000`). `kobakisa` "
            + "×141 is the verb 'to add/increase' and is never digit-adjacent as an operator",
        "plus-minus": "measured: zero ± in 23,678 paragraphs",
        equals: "measured: 6 digit-flanked `=` — an album title (`1+1=1`), a population table (`2004 = "
            + "13197`) and spectroscopy (`v1 = 3650 cm−1`). The bare total of 870 is dominated by WIKI "
            + "SECTION HEADINGS (`== Bomoyi ==`), so reading the sign would say the equals word twice on "
            + "every heading. `ezalí` is the ordinary copula, not an arithmetic reading — the corpus writes "
            + "its own equalities with it (`Falánga ya Swisi mókó ezalí 100 centimes`)",
        "less-than": "measured: `<` occurs once in the whole corpus and 0 times between digits",
        "greater-than": "measured: `>` occurs 27 times and 0 of them between digits — all markup residue",
        times: "measured: `×` occurs 5 times in total. Three are SCIENTIFIC NOTATION (`9,109 53 × 10⁻³¹ "
            + "kg`), which this layer reads for no language; one is a band name (Wenge Musica 4×4) and one "
            + "a French relay leg (`le relais du 4 × 100 m`). Zero arithmetic instances, and no multiply "
            + "word is attested",
        divide: "measured: zero ÷ in 23,678 paragraphs",
        exponent: "measured: the SQUARED UNIT is read (`km²`/`km2` → `kilomɛtrɛ-kare`, the word attested ×11 "
            + "hyphenated onto its noun), but a BARE exponent has no reading: all 24 superscripts are "
            + "scientific-notation exponents in two physics articles (`10⁻¹⁹`, `10⁻²⁷`, `10⁻³¹`) plus one "
            + "edition marker (`Kinsásá, 2007³`), and no power word occurs anywhere in the corpus",
    },
    tl: {
        // Every reason is a reading of the mined artifact's actual instances (259 utterances) — the classes
        // are physics/科 encyclopedia copy, not running Tagalog, and no reading word is attested anywhere.
        minus: "measured: the digit-flanked leading dashes are PREHISTORIC-YEAR notation (`taong -73 000 "
            + "hanggang -60 000`, `-4000`) — a BCE convention, not arithmetic, and no negative-value word "
            + "occurs in the corpus. Digit–digit dashes AND digit-hyphen-digit are RANGES and ARE read "
            + "(hanggang, normalize.ts — a hyphen between digits cannot be a compound)",
        plus: "measured: 5 instances — a quark charge (`bayad + 2/3`), Greek etymology glosses (`astron + "
            + "nomos` ×2), a pulsar designation (PSR B1257+12) and one timezone (UTC+8). No plus word is "
            + "attested; ⟨dagdag⟩ never occurs digit-adjacent",
        "plus-minus": "measured: zero digit-flanked ± in the artifact",
        equals: "measured: 5 instances, all physics/etymology copy (`c = 299,792,458m/s`, `E = mc²`, "
            + "`αστρονομία = άστρον + νόμος`). ⟨katumbas⟩ is never digit-adjacent",
        "less-than": "measured: zero digit-flanked < in the artifact",
        "greater-than": "measured: zero digit-flanked > in the artifact",
        times: "measured: all 9 × are SCIENTIFIC NOTATION (`6.022 × 10²³`) — and every instance is preceded "
            + "by a wiki value-template artifact (`7023602200000000000♠`), so the class is template dirt on "
            + "top of a notation this layer does not read for any language",
        divide: "measured: zero ÷ in the artifact",
        degrees: "measured: 16 digit-adjacent ° — nearly all geographic COORDINATES (`116°&nbsp;40′ E`), the "
            + "yo shape, and the two temperatures write the scale word out themselves (`26.5° sentigrado`), "
            + "so voicing ° would double it. \"digri Selsiyus\" has 0 tl.wikipedia phrase hits",
    },
    yo: {
        // Yoruba's referees (wikipron yor, kaikki yor) are word→IPA: they can check how a word is pronounced,
        // never whether it is the right word for a sign. So every reason below is a corpus measurement.
        minus: "measured: the digit-flanked dash in Yoruba is a RANGE, not a minus — 3,378 hyphens and 4,159 en "
            + "dashes sit between digits, and the corpus glosses the reading twice: `ọgọ́rùn-ún méjì sí mẹ́fà "
            + "(200-600 kg)` and, for a scoreline, `góòlù mẹ́rin sí òdo (4–0)`. `sí` IS read for the range, 1,427 "
            + "digit-flanked instances — see ig/nl/mr/ta/yue, which record the same shape",
        degrees: "measured: only the BARE ° with no scale letter — 128 occurrences, of which 55 are "
            + "digit-flanked geographic coordinates (`7°30′S 3°21′E`). °C and °F ARE read (`ìwọ̀n 38 Celsius`). "
            + "The angular `digiri` has 1 hit and three of its four total hits are ACADEMIC degrees "
            + "(`ẹ̀rí digiri (doctorate)`, `masita digiri (MBA)`)",
        plus: "measured: + is 9 digit-flanked in 21 MB. `àfikún` (564 whole-word) is the nominal 'addition' and "
            + "is digit-adjacent 3 times in running prose, not as an operator; `kún` is a verb 'to fill'",
        "plus-minus": "measured: ± is 18 digit-flanked and NO tolerance word occurs — the sign appears in "
            + "scientific ranges copied into the wiki, with nothing in the corpus that reads it",
        equals: "measured: = is 7 digit-flanked. `dọ́gba` (124 whole-word) means 'is equal to' and is "
            + "digit-adjacent 9 times, which is too thin to map a sign onto, and `jẹ́` (30,012) is the ordinary "
            + "copula rather than an arithmetic reading",
        "less-than": "measured: < occurs 13 times and NEVER between digits (0 digit-flanked); the sign is not "
            + "used as a comparator in this corpus",
        "greater-than": "measured: > occurs 39 times and 0 of them between digits",
        divide: "measured: ÷ occurs twice in 21 MB and never between digits. `pín` (709) is the ordinary verb "
            + "'to divide/share' and `ìpín` (349) a share or portion — neither is digit-adjacent as an operator",
        exponent: "measured: the SQUARED UNIT is read (`km²` → `kìlómítà onígun mẹ́rin`, 754 occurrences of the "
            + "sign, the reading attested 15 times after a unit noun), but a BARE exponent has no reading: ³ "
            + "occurs 23 times with no cube word anywhere in the corpus, and no predicate form — the `20 squared` "
            + "shape — is attested for a base with no unit noun",
    },
    ig: {
        // ⚠ IGBO HAS NO REFEREE (wikipron ibo_latn, epitran ibo-Latn and the kaikki extract are all 404), so
        // every reason below is a corpus measurement and nothing else can check it.
        minus: "measured: the digit-flanked dash in Igbo is a RANGE, not a minus — of 4,993 in a 26 MB sample, "
            + "1,734 are year-year (`1967-1970`, `1979-1983`) and 1,741 small-small (`peeji 90-120`). A minus rule "
            + "would read every date range as arithmetic. `ruo` ('to') IS read for the range, 1,687 digit-flanked "
            + "instances — see nl/mr/ta/yue, which record the same shape",
        degrees: "measured: ° occurs 41 times digit-flanked but NEITHER scale name occurs anywhere in the corpus — "
            + "`dịgrii` 0 hits, `selsiọs` 0 hits. `sources.ts` reports [NONE] scale-names for this language. Most "
            + "of the corpus's ° is geographic coordinates (`4°06′12′′S 141°39′54′′E`) rather than temperature",
        times: "measured: × occurs 123 times digit-flanked and every one is a relay distance (`4 × 100` metres). "
            + "The candidate `mụba` is the VERB 'to increase' (`na-amụba 6`), not the arithmetic operator; no "
            + "operator word is attested",
        plus: "measured: + is 23 digit-flanked in a 26 MB sample. `mgbakwunye` (4,685 hits) is the NOMINAL "
            + "'addition', not what a reader says between two operands — the distinction concept.ts warns about",
        equals: "measured: = is 1 digit-flanked and 24 leading in a 26 MB sample. `nhata` ('equal', 2,250 hits) is "
            + "available but the sign is too rare in this corpus to sense-check a digit-flanked reading against",
        "plus-minus": "measured: the sign does not occur digit-flanked in the corpus (1 instance in 26 MB)",
        "less-than": "measured: the sign does not occur in the corpus (0 digit-flanked, 0 leading)",
        "greater-than": "measured: 0 digit-flanked; the 6 leading instances are markup residue, not comparisons",
        divide: "measured: the sign does not occur in the corpus at all (0 digit-flanked, 0 leading)",
        exponent: "measured: `sources.ts` reports the sign does not occur in the evidence for this language",
    },
    km: {
        // ⚠ SPACING SPLITS THIS SHAPE, which is why only the unspaced form is refused. A refusal that
        // describes `=` as a whole ("glosses and code") throws away 1,649 spaced operand-flanked sites, the
        // great majority of them Khmer prose. The spaced form now reads ស្មើ; see khmer/normalize.ts rule 5.
        // The Khmer-free spaced sites are EasyTimeline markup, which `allOccurrencesInMarkup` keeps the scan
        // from reporting as a language defect.
        //
        // ⚠ NOTE what remains in the probe's reading: `x = y` gives *ˈɛks smaə wˈaᶦ* — the sign is right and
        // the LETTER NAMES are English inside a Khmer engine. That is the letter-name seam, and it is its own
        // work.
        equals: "measured: what is STILL silent is the UNSPACED equals only — 239 sites, and they are a "
            + "translation gloss (`ចក្រវាឡរណប=satellite`, Khmer joined to its English equivalent) or a solution "
            + "set (`x=-1/2`), plus 694 code operators `==`/`!=`/`>=`/`<=`. Reading `equal` in a translation gloss "
            + "would voice a sign that means 'renders as'. The SPACED form — 1,649 sites, 1,546 of them Khmer "
            + "prose — now reads ស្មើ, so this entry covers the unspaced shape and nothing else",
    },
    gu: {
        minus: "measured: gu_in has two `word -digit` instances (the bill `એચજેઆર -3` and the ordinal range "
            + "`10મી -11મી`), the shape no guard can reject — see ta's entry and ACCEPTED_SILENT",
    },
    kn: {
        minus: "measured: kn_in has the bill number `ಎಚ್‌ಜೆಆರ್ -3`, the `word -digit` shape no guard can reject "
            + "— see ta's entry and ACCEPTED_SILENT, which lists this instance as correctly silent",
    },
    yue: {
        // ⚠ HERE THE SHAPE IS AN ARTEFACT OF THE TRANSCRIPT, not of Chinese. FLEURS writes Han with a space
        // between EVERY character, so the aircraft designation `Il-76` is stored as `伊 爾 -76` — a letter, a
        // space, then the hyphen. The undecidable shape arrives through the corpus's own formatting.
        minus: "measured: the per-character spacing FLEURS uses for Han turns the designation `Il-76` into "
            + "`伊 爾 -76`, producing the `word -digit` shape no guard can reject",
    },
    ta: {
        // ⚠ TRIED, AND THE CORPUS DIFF REJECTED IT. A guarded minus rule correctly refuses every range, score
        // and closed designation — and then reads `சந்திரயான் -1` as "கழித்தல் ஒன்று", minus one. The rule
        // converts an accepted silence into an audible error, which is strictly worse than the gap.
        // ⚠ AND IT IS THE SAME SENTENCE IN FIVE LANGUAGES. FLEURS is parallel, so the Chandrayaan designation
        // appears in gu, hi, kn, mr and ta — exactly the five languages listed for `minus` here and in
        // `ACCEPTED_SILENT`. Whatever is decided applies to all of them.
        minus: "measured, then TESTED: a guarded rule read the spacecraft `சந்திரயான் -1` as minus one, the one "
            + "shape no guard can reject — see ACCEPTED_SILENT, which lists this instance as correctly silent",
    },
    mr: {
        // Devanagari compounds are written with a hyphen (आस-पास), and the corpus's one hyphen-before-digit
        // outside a range is `चंद्रयान -1`, a spacecraft name.
        minus: "measured: the corpus's only hyphen-before-digit outside a range is the spacecraft `चंद्रयान -1`, "
            + "so a minus rule would read a designation as arithmetic — see marathi/normalize.ts step 15",
    },
    nl: {
        minus: "measured: every `-\\d` in nl_nl is a score or a range, so the rule would have turned 14 scores "
            + "into negatives — see dutch/normalize.ts step 9",
    },
    cjy: {
        // ⚠ cjy HAS NO CORPUS — there is no cjy.wikipedia, and the Wikimedia Incubator's Wp/cjy is 3,060 Han
        // characters whose artifact covers 7 of 35 cells. So these reasons are NOT corpus measurements like
        // every other entry in this table. They are something rarer and, for once, stronger: a CHECK AGAINST
        // THE SHIPPED DICT, which decides whether a word can be spoken at all. The shared Han-dict engine
        // skips an uncovered character SILENTLY, so a rule using one of these would delete the word instead
        // of mispronouncing it — strictly worse than leaving the sign unread, which at least leaves a
        // RAWMARK the scan can see.
        degrees: "checked, not measured: ⟨度⟩ is SILENT in this dict, and so are ⟨摄氏⟩/⟨攝氏⟩. `20°C` would "
            + "lose the degree WORD as well as the sign. The corpus cannot help — its `degrees` cell is EMPTY",
        equals: "checked: ⟨等于⟩ emits ONE syllable — 于 is silent — so it would say the first half of the "
            + "word and drop the second. ⟨等於⟩ likewise",
        "less-than": "checked: the same half-word problem as ⟨等于⟩, on ⟨小于⟩",
        "greater-than": "checked: the same half-word problem, on ⟨大于⟩",
        divide: "checked: ⟨除以⟩ needs 以, and no reading is available for the pair; the artifact's "
            + "`arithmetic` cell is EMPTY so there is nothing to measure either",
        times: "checked: ⟨乘⟩ speaks but ⟨乘以⟩ does not, and a bare 乘 in the dimension slot is an inference "
            + "no Jin text available can support",
        plus: "checked: ⟨加⟩ speaks, but ⟨减⟩ is SILENT — so the layer could read a plus and not a minus, "
            + "which is a worse state than reading neither. Deferred as a pair",
        minus: "checked: ⟨负⟩ speaks and ⟨减⟩ is silent (see plus). And with an EMPTY `signed-number` cell "
            + "there is no evidence about which shapes a Jin corpus would even contain",
        "plus-minus": "checked: no reading available, and the cell is EMPTY",
        currency: "⚠ NOT a dict problem — ⟨元⟩ speaks. It is a SENSE problem: all four incubator instances "
            + "are 維基元 (Meta-Wiki) and the personal names 元好問 / 柳宗元, never money. No Jin currency word "
            + "is attested in any source available, so the sign stays unread",
    },
    hak: {
        // ⚠ THE MEASUREMENT BEHIND EVERY LINE HERE IS UNUSUAL AND IS STATED ONCE: hak.wikipedia is written in
        // Pha̍k-fa-sṳ, not Han — 93.5% of the sample tier's characters are Latin — so these counts are over a
        // ROMANIZED corpus, and the words they are about would be emitted in Han. That split is nan's shape
        // too. What it costs here is nothing, because each refusal below rests on reading the INSTANCES.
        equals: "measured: the `=` instances are not arithmetic. `Egnatia T=thai-kiê` is a mangled wikitable "
            + "cell, `UTC+8` a timezone, `Yit Kûng-khín = 10 000 Phìn-fông Kûng-tshak` a unit DEFINITION "
            + "whose two sides are already words, and the rest are LaTeX bodies (`&=\\lim_{h \\to 0}{9 + 6h "
            + "+ h^2 - 9\\over{h}}`). And ⟨於⟩/⟨于⟩ are SILENT in this dict, so ⟨等於⟩ could only say half of "
            + "itself — the same half-word refusal cjy made",
        plus: "measured: ⟨加⟩ speaks but ⟨減⟩ is SILENT, so the layer could read a plus and not a minus, "
            + "which is worse than reading neither. The 19 `arithmetic` instances do not argue otherwise: "
            + "`「3+1」的安排` is a train-scheduling label and `-2, 0, +4, +6` are chemical oxidation states",
        times: "measured: every digit-adjacent `×` is SCIENTIFIC NOTATION whose superscript the dump "
            + "stripped — `1.392×106`, `2×1030`, `5×1030` are 10⁶, 10³⁰, 10³⁰. Reading the sign there would "
            + "say \"times one hundred and six\". ⟨乘⟩ speaks; the sign has no attested operator instance",
        divide: "measured: the one ÷ is inside a formula gloss (`ńg sien chhòng-thu ÷180÷60`), and ⟨除以⟩ "
            + "needs ⟨以⟩, which this dict does not carry",
        "plus-minus": "measured: zero ± in the artifact",
        minus: "measured, and the refusal is NARROWER than it looks: a negative IS read — but only before a "
            + "degree sign, because the only negative-number word this corpus supplies is 零下 (`làng-hâ`, "
            + "'below zero'), which is temperature-specific. All 6 genuine negatives in the corpus ARE "
            + "temperatures (`-4.5℃`, `-218 °C`, `−224℃`, `-170°C` ×2, `-5 °C`) and all 6 are read. A BARE "
            + "`-5` is what stays silent, and it has no attested instance and no attested word: the other 28 "
            + "leading hyphens before digits are 3-digit year-range separators (`303-ngièn -349-ngièn`), "
            + "coordinate ranges (`112°50'-114°45'`, read as ranges by step 3) and chemical oxidation states "
            + "(`-2, 0, +4, +6`). ⚠ AND THE HYPHEN IS THE WORST CHARACTER IN THIS ORTHOGRAPHY TO GUESS WITH — "
            + "Pha̍k-fa-sṳ joins every polysyllable with one (`Hak-kâ-ngìn`, `2005-ngièn`), which is why nan "
            + "declined the ASCII hyphen outright for the same reason",
        "less-than": "measured: zero `<` in the artifact; and the ⟨小於⟩ half-word problem would apply",
        "greater-than": "measured: zero `>` in the artifact; same half-word problem on ⟨大於⟩",
    },
    nan: {
        // ⚠ EVERY REASON HERE IS A CORPUS MEASUREMENT. nan HAS a referee (wikipron Hokkien), but it is
        // word→IPA: it can check how a word is pronounced, never whether it is the right word for a SIGN.
        minus: "measured: THE HYPHEN IS A WORD-INTERNAL SYLLABLE JOINER IN POJ, which is what makes this "
            + "class unlike any other language's. The corpus's digit-adjacent dashes are POJ compounds "
            + "(`ko͘-1-ê`, `bó͘-1-ê`, `têng poaⁿ--1-piàn`), the `ISO 8859-1 … 8859-16` designation block, an "
            + "ISBN (`957-2053-07-8`) and citation pages (`313-332`). The two GENUINE negatives are both "
            + "inside formulas or glosses — `10°C kàu -2°C` and `(2000 kg) × (−10 m/s)` — and no Min Nan "
            + "negative-number word occurs anywhere in the corpus. The RANGES are read, via the en dash and "
            + "the tilde, which are 5/5 and 4/4 genuine (normalize.ts step 2)",
        equals: "measured: the `=` instances are WIKI SECTION HEADINGS (`== Chām-gōa liân-kiat ==`) and "
            + "EasyTimeline template code (`ScaleMajor = unit:year increment:20 start:01/01/1800`, "
            + "`ScaleMinor = unit:year`). Not one is arithmetic in running prose",
        plus: "measured: the digit-adjacent `+` joins RUNNING MATES in an election table — "
            + "`Chúi-píⁿ(chóng-thóng)+Lū Siù-liân(hù-chóng-thóng)` — which is a list separator, not an "
            + "operator, and no Min Nan addition word is attested digit-adjacent",
        "plus-minus": "measured: zero ± in the artifact",
        "less-than": "measured: zero `<` in the artifact",
        "greater-than": "measured: zero `>` in the artifact",
        divide: "measured: zero ÷ in the artifact",
        times: "measured: the one `×` is a PHYSICS FORMULA in a quoted gloss, `(2000 kg) × (−10 m/s)`, and "
            + "no multiplication word is attested; the corpus writes dimensions out in words instead",
        currency: "measured: `$` IS read (⟨箍⟩, which the corpus glosses — `Bí-kim 1 kho͘ (US$1)`). What "
            + "remains is ¥ ×2, € ×2, £ ×6 and ¢, for which NO Min Nan currency name occurs anywhere in the "
            + "corpus — ⟨箍⟩ is the unit word, not a currency name — plus `$now`, which is EasyTimeline "
            + "template code rather than money",
    },
    jv: {
        minus: "measured: the corpus's ONE true negative is `at –45 °C` inside an ENGLISH bibliographic "
            + "citation title, and no Javanese negative-number word is attested in the corpus or on "
            + "jv.wikipedia. Every other digit-adjacent dash is a RANGE (read as ⟨nganti⟩, normalize.ts "
            + "step 7), a COORDINATE range (step 4b), a citation PAGE range (`157-167 doi:`), a DOI's own "
            + "`0301-0104`, or a botanical parenthetical extreme (`10-15(-17) cm`)",
        // ⚠ jv HAS referees (kaikki jv + Aksara), but they are word→IPA: they can check how a word is
        // pronounced, never whether it is the right word for a SIGN. So every reason below is a corpus
        // measurement over the mined artifact (jv.wikipedia dump).
        equals: "measured: 34 `=`, and NOT ONE is arithmetic. They are DEFINITIONAL GLOSSES — a formula "
            + "being explained (`Rumus: x + y = z. X = pengalaman, y = renungan, z = hasilipun`), a "
            + "register equivalence (`dèwèkè=dhékné (ngoko)`, `piambeké=piyambekipun`) and a cross-language "
            + "gloss (`tembung rika (jw = kowé, ind = kamu)`). No equals word is attested, and reading one "
            + "would speak it aloud in every dictionary-style line the wiki has",
        plus: "measured: 7 `+`, and the digit-adjacent ones are not operators — `+/- 327.866` is an "
            + "APPROXIMATION (claimed as ⟨kurang luwih⟩ in normalize.ts step 5b, so the sign IS read there) "
            + "and the rest are MUSICAL NOTATION, the slendro/pelog scale degrees `[C-D E+ G A]` and "
            + "`[C+ D E-F# G# A B]`, where a `+` marks a raised pitch",
        "less-than": "measured: zero `<` in the artifact",
        "greater-than": "measured: zero `>` in the artifact",
        divide: "measured: zero `÷` in the artifact",
        // ⚠ NOT LISTED, deliberately: `±` and `×` ARE read — ± as ⟨kurang luwih⟩ (step 5b) and × as
        // ⟨kaping⟩ through the tier — so a drop of either is a real regression and must keep failing.
    },
    wuu: {
        // ⚠ wuu HAS NO REFEREE (the whole modern Wu ecosystem derives from the one Wugniu tradition, so any
        // automated referee is circular), and no FLEURS corpus. Every count below is over the mined
        // artifact's retained text; the words are separately checked against `src/languages/wu/dict.tsv`,
        // which is a hard gate here — a word the dict does not carry is SKIPPED by the front end, silently.
        minus: "measured: 169 hyphens, 56 digit-flanked, and ZERO of them a negative. They are RANGES with a "
            + "unit (`2-8°C`, `15-25公里`, `0-14 岁`), YEAR ranges (`1763-1774`), BUS ROUTE LISTS "
            + "(`公交车8 - 31 - 32 - 46 - 49D - 55`), MODEL NUMBERS (`747-400`, `Qwen2.5-72B`) and a TONE "
            + "NOTATION (`223-33`). The ranges ARE read (到, wu/normalize.ts step 6, right-context guarded); "
            + "the other three shapes are correctly silent. The only `−` U+2212 instances are 2, both inside "
            + "Japanese-language mathematics copy quoted in a wuu article (`m = −1 で调和平均`)",
        plus: "measured: 22 `+`, exactly ONE digit-flanked — a programming tutorial computing `3+2`. And the "
            + "word fails independently: all 47 corpus hits of 加 are BOUND (外加, 加勒比, 新加坡, 加工, 增加, "
            + "加拿大) and wuu.wikipedia adds only 汤加 and 毕加索, so no operator sense is attested anywhere",
        "plus-minus": "measured: zero ± in the artifact",
        equals: "measured: 20 `=`, ONE digit-flanked (`195 kg ÷ 3 = 65 kg`). The rest are WIKI SECTION "
            + "HEADINGS (`== 参考文献 ==`) and LaTeX formula bodies (`(x-x_m)^2 + (y-y_m)^2 = a^2`, "
            + "`y = y_m + a \\sin \\theta`). 等于 is in the dict AND corpus-attested in sense — the WORD is "
            + "fine and the SIGN is not what the count implied; reading it would say 等于等于 参考文献 等于等于 "
            + "aloud on every article",
        "less-than": "measured: zero `<` in the artifact",
        "greater-than": "measured: zero `>` in the artifact",
        times: "measured: one `×`, and it is SCIENTIFIC NOTATION (`地球质量约为5.97×10²⁴千克`), which this "
            + "layer reads for no language. 乘 is in the dict but both its corpus hits are 乘坐 'to ride'",
        divide: "measured: one `÷`, in the same `195 kg ÷ 3 = 65 kg` worked example as the `=` above; 除以 "
            + "occurs zero times in the corpus",
    },
};

/**
 * SISTER STANDARDS — codes that are the same language under different standardisation, so one's artifact,
 * corpus and referee are evidence for another's.
 *
 * ⚠ ONE COPY ONLY. Two tools holding their own sister sets will answer the same question differently: a code
 * present in one and absent from the other is reported as artifact-covered by one tool and sent looking for a
 * file that does not exist by the other.
 */
export const SISTER_STANDARDS: readonly (readonly string[])[] = [
    ["hr", "sr", "bs"],      // Serbo-Croatian: three standards, one language
    ["id", "zsm", "ms"],     // Malay: Indonesian and Malaysian
    ["nb", "nn", "no"],      // Norwegian: Bokmål and Nynorsk
    ["es", "es-419"],        // Latin American Spanish shares the Spanish wiki, and so its artifact
];

/** The other codes in `code`'s sister set, or none. */
export function sistersOf(code: string): readonly string[] {
    return SISTER_STANDARDS.find((set) => set.includes(code))?.filter((c) => c !== code) ?? [];
}

/**
 * THE SIGN-CLASS PROBES — one synthetic input per droppable sign, and the pattern that removes it. A sign is
 * DROPPED when the reading of the probe equals the reading of the probe with the sign stripped out.
 *
 * ⚠ SHARED, BECAUSE A HAND-KEPT LIST IN ONE TOOL IS A LIST THAT DRIFTS. Held inside a CLI script this table
 * cannot be imported, so a fleet sweep cannot use the same probes a per-language review uses — and this very
 * list was once missing `÷ > ±`, the exponent and the currency sign, with nothing to say so.
 *
 * ⚠ IT CANNOT BE DERIVED FROM `DROPPABLE`. A defect regex is not a probe string, and one class needs several
 * probes — `math-sign` alone covers `+ ± = < > × ÷`. Callers should ASSERT the mapping between the two rather
 * than trusting it, which turns the next omission into a loud failure.
 */
export const SIGN_CASES: readonly (readonly [string, string, RegExp])[] = [
    ["minus", "-5", /[-−]/gu],
    ["plus", "+5", /\+/gu],
    ["plus-minus", "±5", /±/gu],
    ["ampersand", "A & B", /&/gu],
    ["equals", "x = y", /=/gu],
    ["less-than", "5 < 6", /</gu],
    ["greater-than", "6 > 5", />/gu],
    ["times", "6 × 6", /×/gu],
    ["divide", "6 ÷ 3", /÷/gu],
    ["exponent", "5 km²", /²/gu],
    ["currency", "$5", /\$/gu],
    ["percent", "25 %", /%/gu],
    ["degrees", "20 °C", /°/gu],
];

/**
 * DESIGNATIONS ACCEPTED AS CORRECTLY SILENT — the sweep's permanent residual, named per instance.
 *
 * ⚠ WHY A BASELINE AND NOT A GUARD: widening the `minus` regex to swallow these would blind the class to
 * every true negative of the same shape (see its note above).
 *
 * So these are accepted BY IDENTITY instead. Each entry is the literal string as it appears in the corpus,
 * and a hit is accepted only when EVERY occurrence of the symbol in that sentence falls inside one of them.
 * Two properties follow, and both are the point:
 *   · a NEW designation, or the same one in a new language, still reports — nothing is suppressed by shape
 *   · a sentence carrying a listed designation AND a real negative still reports, because the negative's
 *     match does not lie inside a named span
 *
 * ⚠ WHAT IS BEING ASSERTED is not that the drop is harmless — that the reading is already CORRECT. These are
 * product names and bill numbers whose hyphen is silent in speech, so a silent hyphen is the right output and
 * the differential test is reporting a true fact with a false label.
 *
 * ⚠ THIS LIST IS EVIDENCE, NOT A TODO. Do not "fix" an entry by making its hyphen audible.
 */
export const ACCEPTED_SILENT: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
    so: {
        // A `+` JOINING TWO GREEK ETYMOLOGY GLOSSES, not arithmetic — `"waan gubaa" + ōps "wejiga"`, inside the
        // article on the name Αἰθιοπία. so/normalize.ts reads `+` before a digit or a bracketed one; this one
        // has quoted words on both sides, and voicing it would read a word-formation gloss as a sum.
        "math-sign": ['"waan gubaa" + ōps'],
        // TWO SUPERSCRIPTS WITH NO NUMBER TO ATTACH TO. `cm³` follows the WORD `cubo` — the article writes the
        // Somali reading and the abbreviation side by side (`11.548 Sentimitir cubo cm³`), so the cube is
        // already spoken and the symbol is a gloss. `E = mc²` is Einstein's, where the base is a VARIABLE; the
        // `=` IS read (`u dhiganta`), and `bareExponent` is not declared for this language because its
        // superscripts are overwhelmingly units (km² ×93, m³ ×37) which the unit path already handles.
        exponent: ["cubo cm³", "E = mc²"],
    },
    su: {
        // ⚠ ALGEBRAIC SUBTRACTION WITH A VARIABLE OPERAND. su/normalize.ts reads the minus before a DIGIT
        // (`-1,00`, `antara -100`, `(−3)`); these are `1 - p` and `1 − p` inside a standard-deviation
        // formula, where the operand is a letter. Reading them would mean matching a dash between two
        // variables, which is the same shape as a compound hyphen in an ordinary Sundanese word — the
        // language hyphenates reduplication constantly (`kira-kira`, `béda-béda`, `rata-rata`, ×thousands).
        // The formula is niche; the hyphen is not. Left silent deliberately.
        // Three lines, none of them arithmetic: `(H^+)` is an ION CHARGE, `L(+)-asam` is an optical-isomer
        // label, and `aX + b ~ N(aμ + b, (aσ)²)` is algebra over VARIABLES — su/normalize.ts reads `+` only
        // before a digit or a bracketed one. Widening it to letters would match a dash between two variables,
        // the same shape as the reduplication hyphen Sundanese writes constantly (`kira-kira`, `béda-béda`).
        "math-sign": ["(H^+)", "L(+)-asam", "aX + b ~ N(aμ + b, (aσ)²)", "X+b", "σ = (n p (1 - p))",
            "σ = (p(1 − p)/n)", "1.5log((r+ra)/g)+.45", "((r+ra)/g)^.287", "A/(A+B)"],
        // THE SOURCE'S OWN TYPO, twice: `$28.ooUS` and `$60.ooUS` are `.00` mistyped with letter o's, so the
        // amount is `28.oo` and no rule can make a number of it. The `$` IS read (*dua puluh dalapan dolar*);
        // what the scan sees is the trailing `US` fragment. Not repairable from this side.
        // LaTeX MATH DELIMITERS, not money — `($10^7$ nepi ka $10^{12}$)`, `($10^{13}$–$10^{14}$ taun)`.
        // su/normalize.ts step 0 strips the pair so the exponent can be read; the scan then sees a `$` whose
        // removal changes nothing, which is exactly right and exactly what it cannot tell from a real drop.
        // ⚠ `$28.ooUS` / `$60.ooUS` are the SOURCE'S OWN TYPO (`.00` mistyped with letter o's). The `$` IS
        // read there (*dua puluh dalapan dolar*); the fragment the scan sees is the trailing `US`.
        currency: ["$10^7$", "$10^{12}$", "$10^{13}$", "$10^{14}$", "$28.ooUS", "$60.ooUS"],
        // AN IUPAC CHEMICAL NAME — `2-(Buta-1,3-diynyl)-5-(but-3-en-1-ynyl)`. Every dash is a locant
        // separator, none is a minus. The Burmese precedent exactly (playbook 5d): the flag needed the
        // instances read, not a rule.
        minus: ["2-(Buta-1,3-diynyl)-5-(but-3-en-1-ynyl)", "-5-(4-c", "-ynyl)-2,2'-b"],
        // ⚠ A JAPANESE ITERATION MARK QUOTED IN A SUNDANESE ARTICLE ABOUT JAPANESE WRITING — `Misuzu (みすゞ)`.
        // The article is ABOUT the mark, so the one instance is a mention rather than a use, and Sundanese has
        // no iteration mark of its own to read it with.
        iteration: ["みすゞ"],
    },
    tl: {
        // ⟨EU$8.86 bilyon⟩ — a NONSTANDARD currency marker: the sentence is about EU aid, so reading the $
        // as ⟨dolyar⟩ would assert dollars for what the context says are EU funds, and rewriting it as euro
        // would be inventing what the writer meant. The bare-$ rule cannot reach it anyway (letter-bounded
        // key), so the silence is the correct reading of an ambiguous token, not a gap.
        currency: ["EU$8.86"],
        // The Japanese ideographic iteration mark inside JAPANESE NAMES quoted in a sentence about katakana
        // (佐々木, 奈々子). The names are Japanese, read as names; the foreign-span filter cannot always see
        // it because the surrounding gloss is Latin.
        iteration: ["々", "ゝ", "ゞ"], // 々 in quoted Japanese names; ゝ/ゞ MENTIONED as signs in the same orthography article
        // PREHISTORIC-YEAR notation — the leading dash is a BCE convention, not arithmetic (the class refusal
        // with its measurement is in ACCEPTED_SIGN_SILENCE; these instance spans exist because the scan's
        // class-acceptance test cannot match a CONTEXTUAL sign regex against single characters).
        minus: ["-73 000", "-60 000", "-70 000", "-50 000", "-52 000", "-108 000", "-39 000", "-38 000",
            "-10 000", "-4000", "-8000", "-9000", "-1 BCE",
            // EasyTimeline MARKUP that survived into the artifact ("bar:1991 at:626 fontsize:XS text: 626
            // shift:(-8,5)") — code coordinates, not prose; the km %lf shape.
            "shift:(-8,5)"],
        // BARE POWERS OF TEN in physics copy — scientific notation (`6.022 × 10²³`, `9.11 × 10⁻³¹`) and an
        // electron configuration (`5s² 4d¹⁰`), the same encyclopedia-copy register as the accepted ×
        // refusal; this layer reads UNIT exponents (km² → kuwadrado) and no language reads mantissa
        // notation. Instance-listed rather than class-silenced so a km² regression stays visible.
        exponent: ["10⁵", "10²¹", "10²²", "10²³", "10⁵⁰", "10⁻⁴", "10⁻¹⁵", "10⁻²⁷", "10⁻³¹", "5s² 4d¹⁰", "mc²"],
    },
    km: {
        // A C FORMAT SPECIFIER, not a percentage — the km wiki carries a programming tutorial whose code
        // survives into the corpus (`scanf("%lf %lf",&a, &b); /*Khmer comment*/`), and the cell selector
        // reaches for it because `%` next to letters is exactly what the percent cell looks for. The `%` in
        // `%lf` is a conversion flag, so silence is the CORRECT reading and a rule that voiced it would be a
        // defect. The line survives the native-script filter legitimately: its trailing comment really is
        // Khmer.
        percent: ["%lf"],
        // ⚠ STRIPPED-MARKUP DEBRIS, not operators — the reading is correct BECAUSE these are not signs at
        // all. A `<` immediately after the Khmer full stop ៕, a `>` standing before a Greek gloss, and a lone
        // `÷` after ។ are all what a removed tag or a mis-rendered entity leaves behind.
        // ⚠ AND THE PROPER FIX IS UPSTREAM, NOT HERE. `wikidump-to-text.py`/`filter-markup.py` own the
        // residue guards, and a bare angle bracket adjacent to sentence punctuation is exactly the shape they
        // exist to catch. Listed here so the gate reads true today, with the cleaning gap recorded rather
        // than papered over — re-mining km after extending those guards should let these entries be deleted.
        "math-sign": ["៕<", "ឈោ្មះ >", "។ ÷"],
    },
    // DESIGNATIONS — a product name or bill number whose hyphen is silent in speech. FLEURS translates ONE
    // English set, so these recur across the fleet; the languages listed here are simply the ones that write
    // a SPACE before the hyphen. Every other language writes it closed and the
    // `(?<![\p{L}\p{M}\p{Nd}])` guard already handles it.
    cjy: {
        // ⚠ A SUPERSCRIPT IN A JIN ARTICLE IS A ROMANIZATION TONE NUMBER, NOT A POWER — the incubator writes
        // Jin romanized with them: `Hai²-di²-lau¹ si³ Zung¹-gueh⁴ dieh⁴ hue²-gue¹-tsi² ing²-seh⁵ gung¹-si¹`.
        // ⚠ THIS IS THE THIRD SINITIC CORPUS TO PRODUCE THAT HAZARD FROM A DIFFERENT SOURCE: wuu from Chao
        // tone letters in its own phonology sections, nan from jyutping quoted in a Hong Kong article, and
        // now cjy from its own romanization. Worth expecting in gan/hak/hsn when they are treated.
        exponent: ["Hai²", "di²", "lau¹", "si³", "Zung¹", "gueh⁴", "dieh⁴", "hue²", "gue¹", "tsi²",
            "ing²", "seh⁵", "gung¹", "si¹"],
    },
    nan: {
        // FOREIGN ITERATION MARKS inside QUOTED JAPANESE AND THAI, which Min Nan does not use: the Japanese
        // 々 in names (`千々岩 助太郎`, `佐々木舜一`, `天々座理世`, `東方妖々夢`), the hiragana ゝ in a book
        // title (`Kokoro (こゝろ)`), and Thai's ๆ in a passage ABOUT Thai text (`และอื่นๆ`). Reading them
        // would need the quoted language's rule, not this one's.
        iteration: ["々", "ゝ", "ๆ"],
        // EASYTIMELINE TEMPLATE CODE that survived into the corpus — a chart definition, not prose:
        // `ScaleMajor = unit:year increment:20 start:01/01/1800`, `from: 25/10/1945 till: $now text:"…"`.
        // The `$` there is a template variable and the `=` a parameter assignment.
        "math-sign": ["ScaleMajor =", "ScaleMinor =", "increment:20"],
        // `km²` after a POJ magnitude word joined by a HYPHEN — `5-ek 1000-ban km²`. The shared tier's
        // magnitude hop is declared and handles the SPACED form (`1.797 ek km²` reads), but its `magAlt` is
        // whitespace and POJ also hyphenates. Widening that is a fleet change with its own measurement.
        // ⚠ A SUPERSCRIPT IN A nan ARTICLE IS OFTEN A ROMANIZATION TONE NUMBER, NOT A POWER — the same
        // hazard the Wu layer records, here with JYUTPING quoted in a Hong Kong article:
        // `hoeng¹ gong² dak⁶ bit⁶ hang⁴ zing³ keoi¹`. Plus scientific notation (`1.6749 × 10⁻²⁷ kg`) and a
        // physics unit (`39.573 MeV/c²`), neither of which this layer reads for any language.
        exponent: ["1000-ban km²", "5-ek", "chhù-goân-", "hoeng¹", "gong²", "dak⁶", "bit⁶", "hang⁴",
            "zing³", "keoi¹", "10⁻²⁷", "MeV/c²"],
        // The genuine negatives and the POJ compounds, listed by span because `acceptedSignClass` tests a
        // sign regex against a SINGLE CHARACTER and the minus pattern is contextual — the same limitation
        // tl and wuu record. `-2°C` and `(−10 m/s)` are real negatives with no Min Nan word to read them;
        // the rest are POJ's word-internal hyphen and the ISO/ISBN designation blocks.
        minus: ["-2°C", "−10 m/s", "Ko·-1-kái", "--1-piàn", "ko͘-1-ê", "bó͘-1-ê", ", -1633", ", -1636",
            "8859-1", "8859-2", "8859-3", "8859-4", "8859-5", "8859-6", "8859-7", "8859-8", "8859-9",
            "8859-10", "8859-11", "8859-13", "8859-14", "8859-15", "8859-16", "957-2053-07-8", "313-332",
            "2^7-1", "1700-1400", "36-45", "1837-1898", "85%–90%",
            // POJ's `ko·-1-` compounds (the middle-dot spelling of ko͘), and EasyTimeline chart offsets.
            "ko·-1-", "shift:(-40,0)"],
        // ¢ and ¥/€/£ — no Min Nan currency NAME occurs in the corpus (⟨箍⟩ is the unit word), so they are
        // left unread rather than guessed. `$` IS read.
        // ⚠ THE POUND DENOMINATIONS ARE LISTED INDIVIDUALLY because `isAcceptedSilent` is all-or-nothing per
        // LINE, and one sentence lists six of them (`£1 kap £2 … £5, £10, £20, kap £50`). No Min Nan name
        // for the pound occurs in the corpus — ⟨箍⟩ is the unit word, not a currency — so they are left
        // unread rather than guessed, as ¥/€/¢/₫ are.
        currency: ["$now", "3¢", "¥147,778", "£1", "£2", "£5", "£10", "£20", "£50", "M$2", "€;", "€9500", "₫44"],
    },
    jv: {
        // BARE POWERS OF TEN in astronomy infoboxes — SCIENTIFIC NOTATION (`108,2 × 10⁶ km`,
        // `2,875 × 10⁹ km`, the planetary orbital radii), which this layer reads for NO language: it reads
        // UNIT exponents (km² → kilomèter persegi) and mantissa notation is a different thing. Listed by
        // instance rather than silencing the class, so a km²/cm³ regression stays visible — both ARE read.
        // …and `mil³`, cubic MILES in a parenthetical unit gloss (`1,4 triliun kilomèter kubik (330 juta
        // mil³)`). The metric units are declared and read; the imperial one is not, and one instance inside
        // a conversion aside does not justify adding a short, collision-prone `mil` key.
        // `--- jiwa/km²` is INFOBOX DEBRIS — a template whose value never filled in ("Kapadhetan: +/- ---
        // jiwa/km²"), so the density rule finds no number to key on. `m³/s` is a tier limitation rather than
        // a data gap: its unit pattern offers a numerator EXPONENT and a rate DENOMINATOR as alternatives,
        // not together, so `1 m³/s` composes the m³ and leaves the `/s`. One instance, in a unit-conversion
        // aside; widening the shared tier for it would want its own fleet measurement.
        exponent: ["10⁶", "10⁹", "sa-km²", "mil³", "ft³", "--- jiwa/km²", "m³/s"],
        // PARENTHETICAL EXTREMES in a botanical description, not negatives: `Godhong awangun jorong nganti
        // lansét, 10-15(-17) cm × 3-4,5(-12,5) cm` — the flora convention for "usually 10–15, rarely to 17".
        // A minus rule would read a leaf measurement as arithmetic.
        // …plus the corpus's ONE TRUE NEGATIVE, which is inside an ENGLISH bibliographic citation: "a
        // thermodynamic singularity at –45 °C, The Journal of Chemical Physics". No Javanese negative-number
        // word is attested anywhere in the corpus or on jv.wikipedia, and the sign here sits in foreign
        // text; inventing one to read a reference title would be the wrong trade.
        minus: ["(-17)", "(-12,5)", "(-1", "–45"],
        // A MIXED FRACTION before the degree sign — `2 garis balik (23 1/2°LU-23 1/2° LS)`, the tropics at
        // 23½°. Step 4 turns the `1/2` into ⟨setengah⟩, which leaves a WORD rather than a digit before the
        // sign, and the degree rule requires a digit. One instance, and the alternative — letting the degree
        // rule fire on a word — would misread every other shape.
        degree: ["setengah°", "1/2°"],
        // The ⟨×⟩ of a BOTANICAL DIMENSION whose left operand is a unit word, not a digit — `10-15(-17) cm
        // × 3-4,5(-12,5) cm`. The tier's multiply composes number×number, and the sign IS read in that
        // shape; this one instance sits after `cm`. Listed rather than widening the tier, since a
        // `word × number` rule has exactly one attested instance to justify it (trap 9).
        "math-sign": ["cm × 3"],
    },
    hak: {
        // ⚠ THE SAME SINITIC HAZARD wuu RECORDS: A SUPERSCRIPT IN THESE ARTICLES IS OFTEN A TONE NUMBER,
        // not a power — hak.wikipedia glosses other varieties' phonology inline (`Si-chhôn-fa piang-yîm:
        // Xu⁴nin²`). Silence is the CORRECT reading there; voicing it would read a pronunciation gloss as
        // arithmetic. The rest are real exponents this layer cannot reach, each for a stated reason:
        //   · `m/s²` and `m/s/s` — an acceleration in a quoted CHINESE rolling-stock article. The exponent
        //     sits on a RATE denominator, which the shared tier composes but cannot then square.
        //   · `万m³` (`2700万m³`, `11.85万m³`) — cubic metres, and BOTH halves are declined: ⟨立方⟩ is
        //     undeclared because `li̍p-fông` has ZERO corpus instances against `phiàng-fông`'s 1,850, and
        //     `m` is undeclared because a one-character unit in an unspaced script is inseparable from any
        //     name containing it. The two gaps are the same gap, as they were in wuu.
        //   · `ngìn/km²` (population density) — the exponent IS read; what the reading lacks is the rate,
        //     and wuu's density rule was local precisely because the per-phrase order is per-language and
        //     this corpus never writes the fact in words for it to be sourced from.
        // Instance-listed rather than class-silenced so a km² regression stays visible — km² IS read
        // (`8,494 km²` → 8494 平方公里).
        //   · `R² sa to R³` — a MATHEMATICAL space (ℝ²→ℝ³) in the calculus article. Not a unit at all, so
        //     no `exponentWords` slot can reach it; reading it as "square" would be wrong for a dimension.
        exponent: ["Xu⁴nin²", "No²san¹", "ȵi²bin¹", "Mi²san¹", "R² sa", "to R³", "m/s²", "1.3m/s²",
            "1.35m/s²", "2700万m³", "11.85万m³", "ngìn/km²", "ngìn /km²", "sṳ̀-kiên²", "x^2", "y^2", "h^2"],
        // ⚠ NOT ARITHMETIC, which is why the class refusal in ACCEPTED_SIGN_SILENCE cannot carry them (that
        // table is consulted per SIGN and the minus pattern is CONTEXTUAL, so it never matches one char):
        //   · `-2, 0, +4, +6` — CHEMICAL OXIDATION STATES in the sulfur article, a list not a subtraction.
        //   · `112°50'-114°45'` and `23°5'-25°31'` — COORDINATE RANGES, which normalize.ts step 3 reads as
        //     ranges (`112度50分至114度45分`); the leading `-` the pattern sees is that connective.
        //   · THE 3-DIGIT YEAR RANGES — `562-ngièn -560-ngièn`, `303-ngièn -349-ngièn`, `319-ngièn -351`,
        //     `384-ngièn -407-ngièn`. Step 2 folds the morpheme so both endpoints read as cardinals with 年,
        //     but `spellYears` claims FOUR digits only, so the dash between them stays unread. That is the
        //     fleet's standing refusal working as intended, not an oversight: a short `N年` is a DURATION as
        //     often as a year and nothing in the surface separates them. ⚠ THEIR 4-DIGIT COUSINS ARE READ —
        //     `1847-ngièn -1899-ngièn` → 一八四七年至一八九九年 — which is what makes this a boundary rather
        //     than a gap. `(1906 -1979)` has no year word on either side and is declined for that reason.
        // The GENUINE negatives are read, and their word is the corpus's own: `-4.5℃`, `-218 °C`, `−224℃`,
        // `-170°C`, `-5 °C` all take 零下 (`làng-hâ`, corpus-attested) — normalize.ts step 4.
        minus: ["-2, 0, +4", "+4, +6", "50'-114", "5'-25", "562-ngièn -560", "1906 -1979",
            "303-ngièn -349", "319-ngièn -351", "384-ngièn -407",
            "chṳ́ -yû", "chṳ́ -yu", "sṳ́ -yung", "Chhṳ́ -ngoi"],
    },
    hsn: {
        // THE COORDINATE DEGREE, and it is the whole of this class: the corpus's only two `°` are one
        // sentence's bounding box — `地圖座標為東經111°53'－114°5'，北緯27°51'－28°40'`. The TEMPERATURE
        // degree is not read either, but for a different and harder reason recorded in ACCEPTED_SIGN_SILENCE:
        // ⟨度⟩ is SILENT in this dict, so a `°C` rule would delete the word as well as the sign. Listed by
        // instance rather than silencing the class, so if a Xiang temperature ever appears it still reports.
        degree: ["111°", "114°", "27°", "28°"],
    },
    ps: {
        // THE BARE DEGREE SIGN, every instance a GEOGRAPHIC COORDINATE. ps/normalize.ts step 6 reads the
        // temperature one (`۲۴ °C` → `۲۴ سانتيګراد`, the word attested ×100 and ×56 directly after a
        // numeral); the degree OF ARC has no attested Pashto reading and neither do the prime/double-prime
        // marks beside it, so `۳۳°۳۹'۱۱"N` would be half-read at best. Listed by instance so a `°C`
        // regression stays visible.
        degree: ["5 °", "29 °", "22 °", "37 °", "45 °", "38 °", "48 °", "31°", "64 °", "۳۳°", "۷۳°",
            "۱۳°", "۵۹°"],
        // CURRENCIES THIS LAYER DOES NOT DECLARE, and deliberately: only the dollar is (`ډالر` ×2,520,
        // ×374 directly after a numeral). The rupee, the pound and the won have NO Pashto name anywhere in
        // 242,649 lines, and all four instances are foreign-context asides — Indian cinema ticket prices
        // (`۱۲۰ ₹`, `₹ 50`), a British statutory fine (`د £ ۵۰۰۰ جریمې`) and a Korean prize
        // (`₩۱۰۰ میلیونه`). Naming them would be invention; `؋`, the AFGHANI, occurs ONCE in the whole
        // corpus, which is why the country's own currency is not declared either.
        // ⚠ AND THE `$` SPANS ARE THE OPPOSITE CASE — PERMISSIBLE DROPS the probe cannot see (trap 12).
        // The sentence NAMES the dollar on the other side of the figure, so ps/normalize.ts step 10 drops
        // the sign on purpose: `$ 250 ډالرو`, `$۱۷۴۰۰ ډالره`, `100 $ میلیارده امریکایي ډالرو`. The word IS
        // in the reading — but in an OBLIQUE/plural form (ډالرو، ډالره) where the probe looks for the
        // citation form ډالر, so the redundancy test scores it as a drop. Emitting the word anyway would
        // say the currency twice, which is the reading this layer exists to avoid.
        currency: ["₹", "£", "₩", "$ 250", "$١٧٤٠٠", "100 $"],
        // AN EN DASH INSIDE A SCIENTIFIC-NOTATION RANGE — `نژدې 10¹¹–10¹² د وينې نوي سلولونه`, i.e.
        // 10¹¹ to 10¹². It is a span, not a negative, and the range rule (step 8) cannot claim it because
        // its operands end in SUPERSCRIPTS rather than digits. Reading it as a minus would turn a blood-cell
        // count into arithmetic. The corpus's true negatives ARE read — `منفي`, step 11.
        minus: ["10¹¹–10¹²"],
        // SCIENTIFIC NOTATION, which this layer reads for no language: `4.1×10¹⁰ m³`, `3 x 10²⁶`,
        // `2×10³⁰`, `4×10¹³`, `7.2 x 10¹³ jouls/kg`, `2.4 x 10⁷`. A mantissa power is a different thing
        // from a squared unit, and the squared unit IS read (`km²` → `کیلو متر مربع`, step 5).
        // Three that are not scientific notation and are worth naming separately:
        //   · `هر km²` — a unit with NO NUMERAL in front of it ("per every km²"). The rule keys on
        //     number+unit adjacency, which is right; a numberless unit is a tier limitation, not a gap in
        //     the data, and it is one instance.
        //   · `۱۳۷ ک.م²` — the exponent on the PASHTO abbreviation of kilometre (ک.م) rather than the Latin
        //     one. Undeclared because ک.م is two letters plus a dot and would collide with ordinary prose.
        //   · `يادېږي²` — a FOOTNOTE MARKER on a word, not a power at all.
        exponent: ["10¹⁰", "10²⁶", "10³⁰", "10¹³", "10⁷", "km²", "ک.م²", "يادېږي²", "m³"],
    },
    ln: {
        // THE BARE DEGREE SIGN, which is not the temperature one. ln/normalize.ts step 6 reads `25 °C` as
        // `Celsius 25` — the SCALE NAME, since `Celsius`/`kelvin` are attested and no Lingala word for
        // *degree* is (`degré` ×1 is French). Every instance below is the sign WITHOUT a scale letter, and
        // there are exactly three kinds, none of them a temperature:
        //   · GEOGRAPHIC COORDINATES — `4°16′S`, `15°17′E`, `04°48′S`, `11°51′E`, `77° 02’ 12’’ W`, and the
        //     decimal-degree pair a geohack template emits (`4.800°S 11.850°E`).
        //   · GEOMETRY ANGLES in the maths articles — the sum of a triangle's angles (`180°`) and the right
        //     angle (`90°`, ×3 across the perpendicularity and right-triangle definitions).
        //   · THE FRENCH NUMERO SIGN, which is a different character's job done by this one: `Mobéko
        //     n°011/2002` (a statute number) and `n° 33-34` / `n° 68-70` (journal issues, two citations in
        //     the same reference list).
        //     Reading it as a degree would be worse than silence.
        // Listed by instance rather than silencing the class so a `°C` regression stays visible — that IS read.
        degree: ["4°16", "4°22", "15°17", "77°", "04°48", "11°51", "4.800°S", "11.850°E",
            "180°", "90°", "n°011", "n° 33", "n° 68"],
        // SCIENTIFIC NOTATION and BIBLIOGRAPHIC EDITION NUMBERS — neither is a unit exponent, and unit
        // exponents are what this layer reads (`km²` → kilomɛtrɛ-kare, ln/normalize.ts step 5, sourced from
        // the corpus's own `kilomɛtrɛ-kare` ×11).
        //   · `10⁻¹⁹`, `10⁻³¹`, `10⁻²⁷` — the electron charge, the electron mass and the neutron mass, in the
        //     physics articles. A mantissa power is a different thing from a squared unit and no language in
        //     the fleet reads it.
        //   · `2007³` and `2007²` — the CONTINENTAL EDITION CONVENTION in a reference list ("3rd ed., 2007"),
        //     where the superscript numbers the edition, not a power of the year.
        //   · `m³/s` — a river's discharge. The shared unit tier offers a numerator exponent OR a rate
        //     denominator, not both, so `m³` composes and the `/s` is left; the same one-instance tier
        //     limitation jv records. Widening it wants its own fleet measurement.
        exponent: ["10⁻¹⁹", "10⁻³¹", "10⁻²⁷", "2007³", "2007²", "m³/s"],
        // THE SIGN IS NAMED IN ITS OWN SENTENCE in every case — the drop is redundant, not lossy, and the
        // contribution test cannot see it because the name the corpus writes is not the word this layer says.
        //   · `Bozitó Sterling (lingɛlɛ́sa: Pound Sterling, £) ezalí mbóngo ya Ingɛlɛ́tɛlɛ` and
        //     `Euro (€) ezalí mbɔ́ngɔ ya Erópa` — DEFINITIONAL GLOSSES, the sign parenthesised beside the
        //     currency's spelled-out name. Only `dolare` is declared (×16, sense-checked); the pound and the
        //     euro have no attested Lingala name, so naming them here would be an invention on top of a
        //     sentence that already says which currency it means.
        //   · `badollar 45$ tii na badollar 10$` — the DOLLAR, named immediately before the figure. The
        //     layer's `NAMED` lookbehind (step 9) is what suppresses this on purpose: emitting the word would
        //     read the currency twice.
        //   · `ndako na €1` sits inside a French-language passage about a French city.
        currency: ["£", "€", "45$", "10$"],
        // LUA MODULE SOURCE quoted verbatim into the wiki (`local zehner = (zahl - zahl % 10 ) / 10;`), where
        // `%` is the MODULO OPERATOR. A percent word here would read a line of code as a proportion.
        percent: ["zahl % 10"],
        // ⚠ NO `minus` KEY, DELIBERATELY. Six lines still report, and all six are GENUINE negatives: two
        // negative latitudes (`-4.2667`, `-4.800`), the electron charge (`-1,602 189`), absolute zero
        // (`-273,15 °C`), and two BCE years (`mobú -753`, `mobú -3300`). Lingala has no attested word for
        // them — the corpus's only candidate, `molongola`, is an adjective describing a charge, not what a
        // reader says before a number — so the sign is silent and the silence INVERTS the value. Accepting
        // it here would turn a known-wrong reading into a green gate; the header of ln/normalize.ts records
        // the same refusal. The two `%`-flanked hyphens that used to report alongside them were never
        // negatives at all (`20%-40%`, `7.5%-10%`) and are now read as spans, step 7.
    },
    wuu: {
        // A SUPERSCRIPT IN A WU ARTICLE IS OFTEN A CHAO TONE NUMBER, NOT A POWER — the language's own
        // phonology is written with them, and wuu.wikipedia does it constantly: `khan³⁵-ban⁵⁵-kae³¹`,
        // `[ʑin²²ø⁵⁵tɕʰy²¹]`, `di⁶ jieu⁶`. Silence is the CORRECT reading; a rule that voiced these would
        // read a pronunciation gloss as arithmetic. That is a hazard specific to the Sinitic dirs and not a
        // gap. The remaining two are real exponents this layer cannot reach: `m³` needs the metre, which is
        // deliberately undeclared (米 is one character and inseparable from 米勒 "Miller" in an unspaced
        // script), and `公分³` puts the superscript on a HAN unit, which the shared tier cannot key on.
        // Instance-listed rather than class-silenced so a km² regression stays visible — km² IS read.
        exponent: ["khan³⁵", "ban⁵⁵", "kae³¹", "ʑin²²", "ø⁵⁵", "tɕʰy²¹", "di⁶", "jieu⁶", "doŋ²²³", "473m³",
            "公分³", "khan³⁵-ban⁵⁵-kae³¹"],
        // ⚠ NEITHER OF THESE IS ARITHMETIC, which is the whole reason the class refusal in
        // ACCEPTED_SIGN_SILENCE cannot carry them: that table is consulted per SIGN and the minus pattern is
        // CONTEXTUAL, so it can never match a single character (the tl entry records the same limitation).
        //   · `m = −1 で调和平均` — Japanese-language mathematics copy quoted in a wuu article.
        //   · `kg·m·s −2` — an SI derived unit, where the sign opens a NEGATIVE EXPONENT (s⁻²) spelled with
        //     an ASCII minus. Reading it as "minus two" would turn a unit into a subtraction.
        //   · `g·mol −1` and `g·cm −3` are the same SI shape twice more (mol⁻¹, cm⁻³) — one CHEMISTRY
        //     infobox carries both, so the line is only accepted once every span in it is named.
        minus: ["= −1", "s −2", "mol −1", "cm −3"],
        // A COLUMN HEADING IN A STATISTICS TABLE (`省内生产总值/GDP％ 人均省内生产总值`), where the sign
        // follows an INITIALISM and no number is in reach. The shared tier is right to require a number; a
        // percent word here would attach to nothing.
        percent: ["GDP％"],
        // The Japanese ideographic iteration mark inside JAPANESE text quoted in a wuu article
        // (`物理学や工学で様々な応用をもつ`). ⚠ AND THE DROP TEST IS A FALSE POSITIVE HERE FOR A SECOND
        // REASON: 様 is not a dict.tsv key, so the character it would repeat is skipped either way and the
        // reading is byte-identical with the mark deleted. The mark IS read wherever the base character is
        // in the dict — 佐々木 → 佐佐木, wu/normalize.ts step 13.
        iteration: ["様々"],
    },
    gu: { minus: ["એચજેઆર -3"] },
    kn: { minus: ["ಎಚ್‌ಜೆಆರ್ -3"] },
    mr: { minus: ["चंद्रयान -1"] },
    ta: { minus: ["சந்திரயான் -1"] },
    hi: {
        minus: [
            "चंद्रयान -1",
            // AN ERA RANGE, not a negative: "circa 600 BCE-1200 CE". The range lookbehind spans a digit plus
            // at most two letters and a dot, and `600 ई. पू.-` is longer than that — widening it far enough
            // to reach past two abbreviations would swallow hi's ONE true negative (`ख॰इ॰), -२.८८ परिमाण`),
            // which is the same shape. So the range is named instead of pattern-matched.
            "पू.-1200",
        ],
    },
    my: {
        // AN APPOSITION dash inside a list of ethnic groups — `(Koreans -၂သန်း)`, "Koreans – 2 million".
        minus: ["Koreans -၂သန်း"],
        // A COMPOUND JOINER, and this one is a linguistic judgement rather than a shrug. `အချိန်+ရပ်ဝန်းထု`
        // is *spacetime*; the `+` marks a compound and the words are spoken adjacent, exactly as a hyphen
        // would be. ⚠ Contrast a GLOSS sign (`=`), which separates a label from its expansion and must be
        // audible — burmese/normalize.ts step 12 draws the distinction — and Italian's `volo+hotel`, a
        // coordination whose reader was recorded saying *più*. Same glyph, different function.
        "math-sign": ["အချိန်+ရပ်ဝန်းထု", "ရပ်ဝန်း+အချိန်"],
        // A BARE ITERATION MARK HAS NOTHING TO REPEAT, so silence is the only correct output. These two are
        // wikitable rows from a Burmese article about JAPANESE kana marks — `ゝ`/`ゞ` are not Burmese
        // orthography at all. Routed to Japanese the mark still reads empty, because `ja` also (correctly)
        // has no antecedent to reduplicate.
        iteration: ["ゝ (reduplicates", "ゞ (reduplicates"],
    },
    xh: {
        // A STRAY HYPHEN. `ebhudla kangange -40 mph`, where the English original reads "winds blowing at
        // 40 mph" — so reading it as *thabatha* ("minus") would be confidently wrong. xhosa/normalize.ts
        // step 14 records this and measures its guarded pattern at 0 corpus matches.
        minus: ["kangange -40"],
    },
};

/**
 * Is every occurrence of this class's symbol inside a designation accepted for this language?
 *
 * Deliberately strict: returns false when the sentence contains a match OUTSIDE a named span, and false when
 * the language names none, so the accept can only ever remove a hit it can fully account for.
 */
export function isAcceptedSilent(lang: string, cls: string, line: string, re: RegExp): boolean {
    const forms = ACCEPTED_SILENT[lang]?.[cls];
    if (forms === undefined) return false;
    const spans: [number, number][] = [];
    for (const f of forms)
        for (let i = line.indexOf(f); i !== -1; i = line.indexOf(f, i + 1)) spans.push([i, i + f.length]);
    if (spans.length === 0) return false;
    const saved = re.lastIndex;
    re.lastIndex = 0;
    let sawOne = false;
    for (let m = re.exec(line); m !== null; m = re.exec(line)) {
        sawOne = true;
        if (!spans.some(([a, b]) => m!.index >= a && m!.index < b)) { re.lastIndex = saved; return false; }
    }
    re.lastIndex = saved;
    return sawOne;
}

/**
 * ISO codes that denote each currency sign.
 *
 * ⚠ A CURRENCY IS ALSO NAMED BY ITS ISO CODE, which `contribution` cannot see: the code reads as spelled
 * letters, so the sign's own word is nowhere in the IPA and a correct drop still reports. Malay writes
 * `$45 juta AUD` — the sign and the code are the same currency stated twice, so saying it once is the right
 * reading and the deletion test cannot pass on it. Sign-keyed rather than a bare three-capitals shape,
 * because that shape is every other initialism in the corpus too.
 */
export const SIGN_CODES: Readonly<Record<string, string>> = {
    $: "USD|AUD|CAD|NZD|SGD|HKD|TWD|MXN|BRL|ARS|CLP|COP",
    "€": "EUR", "£": "GBP", "¥": "JPY|CNY|RMB", "₹": "INR", "₽": "RUB", "₩": "KRW", "₺": "TRY", "₪": "ILS",
};

/** Phonemize one probe string, or undefined if the engine throws on it. */
export type Say = (text: string) => string | undefined;

/**
 * The IPA tokens a symbol adds to a bare `5` — its own word, or [] if it says nothing at all.
 *
 * ⚠ THIS IS WHAT SEPARATES A PERMISSIBLE DROP FROM A DEFECT. A sentence like `($১৪.৭ বিলিয়ন আমেৰিকান ডলাৰ)`
 * already says "American dollar", so the correct reading is byte-identical with and without the sign and no
 * correct rule can escape the deletion test there. Ask instead whether the symbol's OWN WORD is in the
 * reading: present → the meaning IS spoken → permissible; absent → nothing says it → a real drop.
 *
 * Strictly narrower than "does the engine know this symbol anywhere": an engine that reads a bare `$5` but
 * swallows the `$` in `leUS$30` still reports. A symbol the engine never reads adds no tokens, so it can
 * never be downgraded.
 */
export function makeContribution(say: Say): (sym: string) => string[] {
    const memo = new Map<string, string[]>();
    return (sym: string): string[] => {
        const hit = memo.get(sym);
        if (hit !== undefined) return hit;
        let words: string[] = [];
        const bareRead = say("5");
        if (bareRead !== undefined) {
            const bare = new Set(bareRead.split(/\s+/u));
            for (const probe of [`5${sym}`, `${sym}5`]) {
                const read = say(probe);
                if (read === undefined) continue;
                const added = read.split(/\s+/u).filter((t) => t !== "" && !bare.has(t));
                if (added.length > 0) { words = added; break; }
            }
        }
        memo.set(sym, words);
        return words;
    };
}

/**
 * Is this drop PERMISSIBLE — i.e. does the sentence already say what the symbol means?
 *
 * Two ways it can: the symbol's own word is in the reading, or the sentence names a currency by its ISO CODE
 * and that code is itself spoken. ⚠ The code must be SPOKEN, or a dropped code would license a dropped sign.
 */
export function isRedundant(
    sentence: string,
    ipa: string,
    symbols: readonly string[],
    contribution: (sym: string) => string[],
    say: Say,
): boolean {
    if (symbols.length === 0) return false;
    return symbols.every((sym) => {
        const words = contribution(sym);
        if (words.length > 0 && words.every((w) => ipa.includes(w))) return true;
        const alt = SIGN_CODES[sym];
        if (alt === undefined) return false;
        const code = new RegExp(`(?<![\\p{L}\\p{M}])(?:${alt})(?![\\p{L}\\p{M}])`, "u").exec(sentence)?.[0];
        if (code === undefined) return false;
        const spelled = say(code)?.split(/\s+/u).filter((t) => t !== "") ?? [];
        return spelled.length > 0 && spelled.every((t) => ipa.includes(t));
    });
}

/**
 * THE PROBE STRING for the differential test: the sentence with the symbol replaced by a SPACE (see `dropsIn`
 * for why a space and not deletion).
 *
 * ⚠ EXPORTED BECAUSE THERE ARE TWO DIFFERENTIAL LOOPS, NOT ONE. `dropsIn` below tests every class against one
 * sentence, while a fleet sweep iterates PER CLASS and stops at the first hit — deliberately, since a class
 * whose instances sit late in the corpus is otherwise never tested. Those two shapes cannot share a loop, so
 * they share this instead, rather than writing the same one-character decision in two files.
 */
export const withoutSymbol = (sentence: string, re: RegExp): string => sentence.replace(re, " ");

/**
 * Are ALL occurrences of this sign inside LaTeX or template MARKUP rather than prose?
 *
 * ⚠ MARKUP IS NOT A LANGUAGE'S READING GAP. A maths article's complex-number formulas survive into an
 * artifact verbatim — `z_1z_2 = r_1r_2[cos(\alpha_1+\alpha_2)+isin(\alpha_1+\alpha_2)]\!` — and their `+` and
 * `=` get reported as defects. Nothing is read there because nothing should be: `\!` is a LaTeX thin-space
 * and `\alpha_1` a subscripted variable, and a reader voices neither.
 *
 * The test is per SIGN, not per line: a line may mix a formula with prose, and a dropped sign in the prose
 * half is still a defect. So every occurrence must be inside a markup neighbourhood for the line to be
 * excused.
 *
 * ⚠ AND THE MARKERS ARE BRACE-LESS AS OFTEN AS NOT. `\mathbb{R}` has braces and `\alpha_1`, `\!`, `\,`, `i^2`
 * do not, which is why the miner's own markup filter misses exactly these lines. Subscripts and superscripts
 * written with `_` and `^` are the giveaway that survives the dump converter.
 */
const LATEX = /\\[a-zA-Z]+|\\[!,;:]|[A-Za-z0-9)\]]_[0-9A-Za-z]|[A-Za-z0-9)\]]\^[0-9A-Za-z]/u;
export function allOccurrencesInMarkup(sentence: string, re: RegExp): boolean {
    if (!LATEX.test(sentence)) return false;
    const saved = re.lastIndex;
    re.lastIndex = 0;
    let sawOne = false;
    for (let m = re.exec(sentence); m !== null; m = re.exec(sentence)) {
        sawOne = true;
        // A window either side, because a formula's signs sit between its markers rather than beside them.
        const from = Math.max(0, m.index - 30), to = Math.min(sentence.length, m.index + m[0].length + 30);
        if (!LATEX.test(sentence.slice(from, to))) { re.lastIndex = saved; return false; }
    }
    re.lastIndex = saved;
    return sawOne;
}

/**
 * Is this symbol sitting inside a FOREIGN-LANGUAGE SPAN of a bilingual line?
 *
 * ⚠ WHY THIS IS NOT THE SAME AS THE NATIVE-SEGMENT FILTER, and why both are needed. `scripts.ts`'s
 * `isNativeSegment` discards a mined segment with no native letter at all — a wholly English article quoted
 * in a non-Latin wiki. It cannot help with a BILINGUAL segment, which is legitimately in the corpus because
 * most of it IS the language: 73 Khmer letters against 306 Latin ones, with the currency sign inside the
 * ENGLISH half. A dropped sign there is a fact about English, not about Khmer.
 *
 * The test is deliberately conservative — Latin must OUTNUMBER the native script on BOTH sides of the symbol
 * within a short window — so a native sentence that merely quotes a foreign name still counts as native. And
 * it is INERT for Latin-script languages: there `nativeRe` matches Latin, so Latin can never outnumber it.
 */
export function inForeignSpan(sentence: string, index: number, nativeRe: RegExp, window = 30): boolean {
    const side = (s: string): [number, number] => {
        let nat = 0, lat = 0;
        for (const ch of s) {
            if (nativeRe.test(ch)) nat++;
            else if (LATIN.test(ch)) lat++;
        }
        return [nat, lat];
    };
    const [ln, ll] = side(sentence.slice(Math.max(0, index - window), index));
    const [rn, rl] = side(sentence.slice(index + 1, index + 1 + window));
    return ll > ln && rl > rn && ll + rl > 0;
}
const LATIN = /\p{sc=Latn}/u;

/**
 * Do ALL occurrences of this class in the line sit in foreign-language spans? Only then is the drop not this
 * language's problem — one native-context occurrence makes it a real gap again.
 */
export function allOccurrencesForeign(sentence: string, re: RegExp, nativeRe: RegExp | undefined): boolean {
    if (nativeRe === undefined) return false;
    re.lastIndex = 0;
    const idx = [...sentence.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`))]
        .map((m) => m.index);
    if (idx.length === 0) return false;
    return idx.every((i) => inForeignSpan(sentence, i, nativeRe));
}

/**
 * Is a drop of this COARSE class an already-argued silence for this language?
 *
 * ⚠ WHY THE SCAN HAS TO ASK. `DROPPABLE` is coarse — `math-sign` alone covers `+ ± × ÷ = < >` — while
 * `ACCEPTED_SIGN_SILENCE` is per SIGN. A scan consulting only the per-INSTANCE table (`ACCEPTED_SILENT`)
 * makes km's `=` simultaneously a documented refusal and a hard scan failure: two tables disagreeing about
 * the same character.
 *
 * A coarse-class drop is accepted only when EVERY sign of that class present in the line belongs to an
 * accepted class. A line mixing `=` (accepted for km) with `×` (which km reads) is still a defect, because
 * the `×` may be the one being dropped.
 */
export function acceptedSignClass(lang: string, klass: string, sentence: string): boolean {
    const accepted = ACCEPTED_SIGN_SILENCE[lang];
    if (accepted === undefined) return false;
    const present = SIGN_CASES.filter(([, , re]) => { re.lastIndex = 0; return re.test(sentence); }).map(([n]) => n);
    if (present.length === 0) return false;
    // Only the signs this coarse class actually covers are relevant.
    const covered = DROPPABLE.find(([k]) => k === klass)?.[1];
    if (covered === undefined) return false;
    const relevant = present.filter((n) => {
        const re = SIGN_CASES.find(([m]) => m === n)?.[2];
        if (re === undefined) return false;
        // does this sign's own character belong to the coarse class's set?
        const ch = [...sentence].find((c) => { re.lastIndex = 0; return re.test(c); });
        if (ch === undefined) return false;
        covered.lastIndex = 0;
        return covered.test(ch);
    });
    return relevant.length > 0 && relevant.every((n) => n in accepted);
}

/**
 * Run the differential drop test for one sentence.
 *
 * ⚠ `re.lastIndex = 0` BEFORE EVERY `.test`: these regexes are `/g/` and shared across a whole corpus loop,
 * and `RegExp.prototype.test` ADVANCES lastIndex on a hit — so the next sentence resumes mid-string and the
 * one after that starts over (`re.test(s1), re.test(s2), re.test(s1)` → true, false, true on the same
 * pattern). Without the reset a scan silently skips about half its candidate sentences.
 */
export function dropsIn(
    sentence: string,
    ipa: string,
    say: Say,
    contribution: (sym: string) => string[],
): { klass: string; redundant: boolean }[] {
    const out: { klass: string; redundant: boolean }[] = [];
    for (const [klass, re] of DROPPABLE) {
        re.lastIndex = 0;
        if (!re.test(sentence)) continue;
        // ⚠ SUBSTITUTE A SPACE, DO NOT DELETE. Deleting the symbol also changes how its NEIGHBOURS tokenize,
        // and the test then attributes that change to the symbol — worst in an agglutinative language.
        // `32℃에` reads as two tokens (*sˈɐmsibi ˈe*); delete the ℃ and `32에` agglutinates into one
        // (*sˈɐmsibie*), so the readings differ, the test concludes the ℃ contributed, and the scan reports
        // NO DEFECTS while `20℃` reads as bare *isˈip̚*. Replacing the symbol with a space holds the token
        // boundary still, so what is compared is the symbol's own contribution and nothing else.
        const without = say(withoutSymbol(sentence, re));
        if (without === undefined || without !== ipa) continue;
        const symbols = [...new Set(sentence.match(re) ?? [])];
        out.push({ klass, redundant: isRedundant(sentence, ipa, symbols, contribution, say) });
    }
    return out;
}
