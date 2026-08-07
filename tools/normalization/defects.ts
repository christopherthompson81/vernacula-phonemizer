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
