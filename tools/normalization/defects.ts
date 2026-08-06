/**
 * THE DEFECT CLASSES, in one place (#586) — what counts as a leak, what counts as a drop, and the
 * REDUNDANT-vs-DROP discrimination that separates a permissible drop from a real one.
 *
 * WHY THIS FILE EXISTS. These tables lived in three copies — `mine.ts scan`, `corpus-diff.ts emit` and
 * `coverage.ts` — and they had DRIFTED. The union of the three is strictly better than any one of them:
 *
 *   class        mine.ts        corpus-diff.ts   coverage.ts
 *   minus        [-−–]          [-−] only        absent
 *   math-sign    yes            BLIND            BLIND
 *   exponent     BLIND          BLIND            yes
 *   ampersand    BLIND          BLIND            yes
 *   iteration    BLIND          BLIND            yes
 *   ZERO-WIDTH   yes            absent           absent
 *
 * Read the third row twice. `corpus-diff.ts` is the gate whose own header calls it "the verification gate
 * that caught more real defects than any other check", and it could not see a dropped `&` or a dropped `²`
 * — which are the exact two defects #586 opens with (English, the first language ever treated, drops both).
 * Every language reviewed against that gate was reviewed with those two classes switched off.
 *
 * The drift was invisible because it was three files agreeing on the concept and disagreeing on the data.
 * That is the argument for the extraction: the tables are a SHARED FACT about the fleet, not a per-tool
 * setting, and the ISO-code work in #601 had to be applied to two of the three copies by hand.
 */

/** A LEAK is a character that SURVIVED into the IPA and should not have. */
export const LEAK_CLASSES: readonly (readonly [string, RegExp])[] = [
    // `\p{Nd}`, NOT `\d`: under the `u` flag `\d` is ASCII 0-9 and nothing else, so this class was blind to
    // a digit leak in every language that writes its own numerals — Burmese ၀-၉, Thai ๐-๙, Bengali ০-৯,
    // Khmer, Lao. Found while mining a Burmese hard-set (#585).
    ["DIGIT", /\p{Nd}/u],
    ["SLOT-GAP", /\s{2,}|^\s|\s$/u],
    // NOT `.,;:!?` — those are the CANONICAL inline pause marks every engine emits via clauseSink, so
    // including them flags every utterance and the check tells you nothing. What belongs here is a mark that
    // should have become one of those and did not: a native terminator, a symbol, or a non-ASCII digit.
    // U+00BA º and U+00AA ª are here because the Italian run found the class silently missing them: it had
    // `°` (U+00B0) only, so `dell'11º` → `undˈit͡ʃi º` passed the scan clean and was caught by probing.
    ["RAWMARK", /[…。、，％℃°ºª〜～・！？²³\p{Sc}।॥۔؟،؛]/u],
    ["ZERO-WIDTH", /[​-‍⁠﻿]/u],
];

/**
 * A DROP is a symbol that VANISHED — detected differentially: phonemize the sentence, then phonemize it again
 * with the symbol REPLACED BY A SPACE (see `withoutSymbol`; deleting it perturbs how its neighbours tokenize
 * and the test then credits the symbol for that), and compare. Identical readings prove it said nothing.
 *
 * THE UNION of what the three copies knew, with the widest form of each pattern kept:
 *   · `minus` keeps the EN DASH, which `corpus-diff.ts` was missing — a corpus writes `–5` as readily as `-5`
 *   · `math-sign`, `exponent`, `ampersand` and `iteration` are now visible to EVERY tool
 * `exponent` and `ampersand` in particular are the two #586 cites as having survived undetected through
 * thirty-seven languages because no gate could see them.
 */
export const DROPPABLE: readonly (readonly [string, RegExp])[] = [
    // U+066A ٪ is the Arabic-script sign and U+FF05 ％ the fullwidth one — both are ordinary typography in
    // their scripts, and the tier already accepts them (ar/ur/fa used to pre-fold ٪ locally).
    ["percent", /[%‰٪％]/gu],
    ["currency", /\p{Sc}/gu],
    ["degree", /[°℃℉]/gu],
    // Only where a digit FOLLOWS and no letter/digit precedes, so a compound hyphen (`Il-76`, `COVID-19`)
    // and a range (`5-3`) are not mistaken for a negative. Probe forms never merge two digits, so `-`/`+`
    // are judged on `5-`/`-5` and not on `5-5` → `55`.
    //
    // `\p{M}` IS IN THE GUARD, and leaving it out made this class blind across every abugida in the fleet.
    // A Devanagari word usually ends in a MATRA, not a bare consonant: the character before the hyphen in
    // `फ़ॉर्मूला-1` is ा (U+093E, `Mn`), so `(?<!\p{L})` passed and the scan reported a DROP on Formula-1 —
    // a designation whose hyphen is correctly silent.
    //
    // ⚠ THE SECOND LOOKBEHIND EXCLUDES A RANGE, and without it this class was measuring almost nothing it
    // claimed to. Resolved per hit across all 66 artifacts (docs/investigations/sign_reading_investigation.md),
    // the 15 dropped "minus" instances were 8 RANGES (`dem 10.-11.`, `(1418 -1450)`, `26 -00`, `1995 -96`,
    // `२०१७ -१७`, `1000 -1300`, `10મી -11મી`, `ngo-26 -00`), 4 DESIGNATIONS (`चंद्रयान -1` in hi/mr/ta,
    // `એચજેઆર -3`), 2 APPOSITION dashes (el's parenthetical `–12 χιλιόμετρα … Σιέμ Ριπ–`, my's
    // `(Koreans -၂သန်း)`) — and exactly ONE true negative.
    //
    // A dash BETWEEN TWO NUMBERS is never a minus, so that exclusion costs no recall: the window is
    // deliberately tight (a digit, then at most an ordinal suffix or an abbreviating dot, then at most one
    // space) rather than "a digit somewhere behind". Measured why — hi's one real negative is `०.३७२७१९
    // ख॰इ॰), -२.८८ परिमाण` (an astronomical magnitude), and a window wide enough to reach past `ख॰इ॰),`
    // swallows it. Under-excluding a range is a stray report; over-excluding deletes the only true positive
    // in the fleet.
    //
    // ⚠ A DESIGNATION AFTER A SPACE IS NOT DECIDABLE HERE and is deliberately still reported. `चंद्रयान -1`
    // and a real `-5 stupňů` are the same shape — word, space, dash, digit — so separating them needs a
    // lexicon, not a guard. Those hits want a per-language judgement; a quiet gate would be worse.
    //
    // Corrects this comment's own earlier claim that hi "contains no negative number at all" — it does, and
    // the sentence above is it. That claim was made from the two designation hits without resolving the rest.
    ["minus", /(?<![\p{L}\p{M}\p{Nd}])(?<!\p{Nd}[\p{L}\p{M}]{0,2}[.,]?[ \t]?)[-−–](?=\p{Nd})/gu],
    ["math-sign", /[+±×÷=<>]/gu],
    /**
     * ⚠ A SUPERSCRIPT WITH NOTHING BEFORE IT IS NOT AN EXPONENT, and this pattern used to be a bare
     * `/[²³⁰¹⁴-⁹]/gu` that flagged every one. `⁸C` is an ISOTOPE MASS NUMBER — the superscript precedes the
     * element symbol — and `³He` the same; no language reads either as a power, and `normalizeSymbols.ts` is
     * right not to: its own `BARE_EXPONENT` requires a base BEFORE the run. So the scan was reporting a dropped
     * exponent for text the reader is correct to leave alone, and Yoruba's residual gate failure was one English
     * sentence about carbon isotopes. The class now asks what the reader asks — is there a base?
     *
     * A LOOKBEHIND, not a captured base, because the scan needs the SIGN's own extent to test its removal.
     *
     * ⚠ IT MATCHES THE WHOLE RUN AND ALLOWS A SPACE, and both were wrong in the first version. A superscript
     * digit is `\p{No}`, not `\p{Nd}`, so a per-character pattern anchored on a base matched only the FIRST
     * superscript of `10¹⁵` and silently shortened the sign's extent; and the corpus writes the sign spaced
     * (`0,5 ² км`, `16000km ² `), which `normalizeSymbols.ts` reads via its own `\s?`. Measured over the fleet,
     * the loose version flagged 2,089 and this flags 1,992 — the 97 excluded are leading superscripts
     * (`⁸C`, a bare `¹¹` footnote marker, `(1)²`), not shortened runs.
     *
     * ⚠ AND THE RUN INCLUDES THE SUPERSCRIPT MINUS, because `kg⁻²` is a real exponent whose run begins with it —
     * `normalizeSymbols.ts` maps `⁻` for exactly that reason ("without it the whole run failed to…"). Leaving it
     * out truncated every negative exponent to the digits after the sign.
     *
     * ⚠ A TRAILING LETTER IS WHAT ACTUALLY IDENTIFIES ISOTOPE NOTATION, and the base test alone does not catch
     * it. Allowing the space that real spaced exponents need (`16000km ² `) also let `is ⁸C` through, since a
     * letter and a space do precede that superscript. What no exponent does is run straight into a letter:
     * `⁸C`, `¹⁴C`, `³He` are a mass number and an element symbol. A power is terminal or followed by
     * punctuation, a space, or an operator.
     *
     * ⚠ THE LOOKAHEAD MUST ALSO EXCLUDE A FOLLOWING SUPERSCRIPT, or BACKTRACKING defeats it. On `¹⁴C` the engine
     * matched the run `¹⁴`, failed the letter test on `C`, then backtracked to `¹` — where the next character is
     * `⁴`, not a letter, so the trimmed match succeeded and the isotope was flagged after all. Forbidding a
     * superscript after the run leaves nothing to backtrack into.
     */
    ["exponent", /(?<=[\p{L}\p{M}\p{Nd}][ \t]?)[²³⁰¹⁴-⁹⁻]+(?![\p{L}\p{M}²³⁰¹⁴-⁹⁻])/gu],
    ["ampersand", /[&＆]/gu],
    ["iteration", /[ๆ々〃ヽヾゝゞៗ]/gu],
];

/**
 * THE SIGN-CLASS PROBES — one synthetic input per droppable sign, and the pair of readings that decides whether
 * the engine voiced it (#586/#654).
 *
 * ⚠ SHARED, BECAUSE A HAND-KEPT LIST IN ONE TOOL IS A LIST THAT DRIFTS. This table lived inside `review.ts`,
 * which is a CLI script and therefore cannot be imported — so `coverage.ts` could not sweep the fleet with the
 * same probes `review.ts` uses per language, and the #654 progress number had to be re-derived in a scratch
 * script each time. That is exactly the shape the `DROPPABLE` comment above warns about: this very list was
 * once missing `÷ > ±`, the exponent and the currency sign, and nothing said so.
 *
 * ⚠ IT CANNOT BE DERIVED FROM `DROPPABLE`. A defect regex is not a probe string, and one class needs several
 * probes — `math-sign` alone covers `+ ± = < > × ÷`. `review.ts` asserts the mapping between the two rather
 * than trusting it, which turns the next omission into a loud failure.
 *
 * Each entry is [class name, the probe, the regex that REMOVES the sign from it]. A sign is DROPPED when the
 * reading of the probe equals the reading of the probe with the sign stripped out — i.e. the character
 * contributed nothing.
 */
/**
 * WORDS SOURCED FROM OUTSIDE THE CORPUS, each with its citation — the `sourcing` gate's escape hatch, and the
 * narrowest one in this file.
 *
 * ⚠ WHY THIS IS NEEDED AT ALL: A CORPUS CANNOT ATTEST HOW A SYMBOL IS SPOKEN. Writers type `2.5`; they do not
 * spell out how they say it. So the decimal word of a language whose wiki dump is 559k lines can score exactly
 * zero and still be in universal spoken use — which is what happened to Igbo's `ntụkpọ`, declared "[NONE] — no
 * word exists" on the strength of 0 hits for it and every variant, and then found in a dictionary with a
 * definitional example. Khmer's `យូអាន` (yuan) is the same shape. For symbols with a small WRITTEN footprint,
 * corpus silence is close to no evidence, and a gate that can only be satisfied by corpus hits pushes the layer
 * toward dropping the symbol — the worse outcome.
 *
 * ⚠ AND WHY IT IS NOT SIMPLY THE MANIFEST. The `sourcing` haystack used to include the language's own `.jsonc`,
 * which is where the gate EXTRACTS its needles from — so every declared word attested itself and the check was
 * inert. A substituted nonsense word passed it. A declaration cannot be its own evidence; a citation naming a
 * source outside this repository can be, and that is the only thing accepted here.
 *
 * ⚠ THE CITATION IS THE POINT, NOT THE EXEMPTION. Anything vague enough that a reader could not go and check it
 * ("a dictionary", "standard usage") is a TODO wearing a citation's clothes and must keep failing the gate.
 * Name the work, the headword and the sense, as the entries below do.
 */
export const CITED_WORDS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    ig: {
        // Igbo has NO independent referee (wikipron ibo_latn, epitran ibo-Latn, kaikki: all 404), so a
        // non-corpus tier is the only tier it has beyond the corpus itself. The referee config names Emenanjo
        // 1978 and Green & Igwe 1963 for the same reason.
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
 * SIGN CLASSES A LANGUAGE IS INTENTIONALLY SILENT ON (#654) — the synthetic-probe counterpart of
 * `ACCEPTED_SILENT` above, and the difference between the two matters.
 *
 * `ACCEPTED_SILENT` names CORPUS LINES: this exact sentence's hyphen is a designation, so the drop is correct.
 * This names a whole CLASS for a language: no reading of this sign is shippable here at all, so `review.ts`'s
 * synthetic probe (`-5`, `+5`) will always report DROPPED and always be right to.
 *
 * ⚠ WHY IT EXISTS RATHER THAN JUST LETTING THE GATE FAIL. A hard fail that can never be fixed is noise, and
 * noise is how the audit's own hardcoded 37-of-67 list stayed wrong for months — a number nobody trusted
 * enough to read. Three languages had a permanently red `sign classes` line for reasons already argued at
 * length in their own files, which meant the line said nothing about whether anything had REGRESSED.
 *
 * ⚠ AND IT IS DELIBERATELY SHORT. Only a class whose refusal is ARGUED IN THE LANGUAGE'S OWN FILE belongs
 * here; "no rule yet" is a TODO and must keep failing. Every other language in the `minus` and `plus-minus`
 * columns is a real gap, and adding them here to quiet the gate would be exactly the wrong use of it.
 *
 * The reason string is printed by both tools, so the justification travels with the exemption.
 */
export const ACCEPTED_SIGN_SILENCE: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    yo: {
        // Yoruba HAS referees (wikipron yor, kaikki yor) but they are word→IPA: they can check how a word is
        // pronounced, never whether it is the right word for a sign. So every reason below is a measurement from
        // a 112,738-paragraph yo.wikipedia dump (deduplicated from 123,405). See src/languages/yoruba/normalize.ts.
        minus: "measured: the digit-flanked dash in Yoruba is a RANGE, not a minus — 3,378 hyphens and 4,159 en "
            + "dashes sit between digits, and the corpus glosses the reading twice: `ọgọ́rùn-ún méjì sí mẹ́fà "
            + "(200-600 kg)` and, for a scoreline, `góòlù mẹ́rin sí òdo (4–0)`. `sí` IS read for the range, 1,427 "
            + "digit-flanked instances — see ig/nl/mr/ta/yue, which record the same shape",
        // ⚠ `degrees` AND `times` WERE HERE AND HAVE BEEN REMOVED — both refusals were wrong, and they were the
        // two highest-frequency entries in this block. `degrees` rested on `dígírí` 0 and `sẹ́lísíọ̀sì` 0, two
        // Yorubized spellings that do not exist; the corpus borrows `Celsius`/`Fahrenheit` unchanged and says
        // `ìwọ̀n` for the degree, so °C (211) and °F (144) are now read. `times` was refused as having no
        // operator word while numbers.ts was already multiplying with `lọ́nà`, this language's multiplicative
        // particle. A long accepted-silence block is a smell: re-read it before adding to it.
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
        // ⚠ IGBO HAS NO REFEREE (wikipron ibo_latn, epitran ibo-Latn and the kaikki extract are all 404), so every
        // reason below is a corpus measurement from a 558,991-line ig.wikipedia dump and nothing else can check it.
        // Counts marked "sample" are from a 26 MB slice. See src/languages/igbo/normalize.ts.
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
        // Both refusals are argued with a measured distribution in src/languages/khmer/normalize.ts, and in both
        // cases a rule DOES ship for the shape the corpus supports — it is the probe's shape that is undecidable,
        // the same structure as gu/kn's minus below.
        equals: "measured: of 5,844 `=` in the mined corpus, 1,348 are a gloss (`ចក្រវាឡរណប=satellite`), 1,057 "
            + "are code-shaped (`==`, an assignment, a quoted value) and 9 are URL query strings, against 109 "
            + "genuine digit-flanked arithmetic — which IS read. Widening to the probe's `x = y` letter-flanked "
            + "shape would fire on the code and the glosses, getting it wrong about as often as right",
        plus: "measured: the digit-flanked plus IS read (74 corpus instances → បូក). The probe's LEADING `+5` "
            + "shape is the undecidable one: of 254 sites with no number before the sign, 142 are LaTeX or C "
            + "(`x+3\\!`, `\\to +\\infty`, `printf(...a+b)`) against 4 genuine paren-arithmetic instances "
            + "(`(២១-១)+៤`), because this wiki carries maths articles written in LaTeX and a C tutorial",
    },
    gu: {
        // The same undecidable shape as ta, and MEASURED rather than assumed: gu_in carries two spaced
        // designations — the bill number `એચજેઆર -3` (already in ACCEPTED_SILENT) and `ગોથિક શૈલી 10મી -11મી`,
        // a spaced ORDINAL range, where the character before the hyphen is a letter and the one after is a digit.
        minus: "measured: gu_in has two `word -digit` instances (the bill `એચજેઆર -3` and the ordinal range "
            + "`10મી -11મી`), the shape no guard can reject — see ta's entry and ACCEPTED_SILENT",
    },
    kn: {
        minus: "measured: kn_in has the bill number `ಎಚ್‌ಜೆಆರ್ -3`, the `word -digit` shape no guard can reject "
            + "— see ta's entry and ACCEPTED_SILENT, which lists this instance as correctly silent",
    },
    yue: {
        // ⚠ AND HERE THE SHAPE IS AN ARTEFACT OF THE TRANSCRIPT, not of Chinese. FLEURS writes Han with a space
        // between EVERY character, so the aircraft designation `Il-76` is stored as `伊 爾 -76` — a letter, a
        // space, then the hyphen. The undecidable shape arrives through the corpus's own formatting, which is
        // the same source-orthography divergence zu/xh documented for the plus.
        minus: "measured: the per-character spacing FLEURS uses for Han turns the designation `Il-76` into "
            + "`伊 爾 -76`, producing the `word -digit` shape no guard can reject",
    },
    ta: {
        // ⚠ TRIED, AND THE CORPUS DIFF REJECTED IT. A guarded minus rule was written for ta and correctly refused
        // every range, score and closed designation — and then read `சந்திரயான் -1` as "கழித்தல் ஒன்று", minus
        // one. That is the shape NO guard can reject: `word -1` is identical to a genuine `was -5`, so telling
        // them apart needs a lexicon. `ACCEPTED_SILENT` already lists this exact instance as correctly silent,
        // which means the rule converted an accepted silence into an audible error — strictly worse than the gap.
        //
        // ⚠ AND IT IS THE SAME SENTENCE IN FIVE LANGUAGES. FLEURS is parallel, so the Chandrayaan designation
        // appears in gu, hi, kn, mr and ta — and those are exactly the five languages `ACCEPTED_SILENT` lists
        // for `minus`. Whatever is decided here applies to all of them, and it is not a coincidence to be
        // rediscovered per language.
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
        // Every `-\d` in nl_nl is a score or a range (`6-6`, `22:00-23:00`), which Dutch reads as two bare
        // numbers. Writing the rule would have turned 14 scores into negatives.
        minus: "measured: every `-\\d` in nl_nl is a score or a range, so the rule would have turned 14 scores "
            + "into negatives — see dutch/normalize.ts step 9",
    },
};

/**
 * SISTER STANDARDS — codes that are the same language under different standardisation, so one's artifact,
 * corpus and referee are evidence for another's.
 *
 * ⚠ THIS LIVED IN TWO FILES AND HAD ALREADY DIVERGED, inside the change that introduced the second copy.
 * `review.ts` held three sets and `candidates.ts` four — the extra being Latin American Spanish, which shares
 * the Spanish wiki and therefore its artifact. So `candidates.ts` reported that code as artifact-covered while
 * `review.ts`, asked the same question, would have gone looking for a file that does not exist. Two tools,
 * contradictory answers, one fleet fact.
 *
 * That is exactly the failure this file was created to end: its own header records three copies of the defect
 * tables drifting until one of them was the only place that knew about a whole sign class. A fleet fact belongs
 * in one place, and this is that place.
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
 * DESIGNATIONS ACCEPTED AS CORRECTLY SILENT (#586) — the sweep's permanent residual, named per instance.
 *
 * WHY A BASELINE AND NOT A GUARD. The `minus` class above explains why a spaced designation cannot be
 * separated from a real negative by pattern: `चंद्रयान -1` and a real `-5 stupňů` are the same shape — word,
 * space, dash, digit — so telling them apart needs a LEXICON, and the comment there records the judgement that
 * "a quiet gate would be worse". That judgement still holds; widening the regex to swallow these would blind
 * the class to every true negative of the same shape, and hi's one real negative is exactly that shape.
 *
 * So these are accepted BY IDENTITY instead. Each entry is the literal designation string as it appears in the
 * corpus, and a hit is accepted only when EVERY occurrence of the symbol in that sentence falls inside one of
 * them. Two properties follow, and both are the point:
 *   · a SIXTH designation, or the same one in a new language, still reports — nothing is suppressed by shape
 *   · a sentence carrying a listed designation AND a real negative still reports, because the negative's match
 *     does not lie inside a named span
 *
 * WHAT IS BEING ASSERTED. Not that the drop is harmless — that the reading is already CORRECT. These are
 * product names (`Chandrayaan-1`) and bill numbers (`HJR-3`) whose hyphen is silent in speech, so a silent
 * hyphen is the right output and the differential test is reporting a true fact with a false label. Resolved
 * per hit across all 66 artifacts; see docs/investigations/sign_reading_investigation.md.
 *
 * The five are two universal sentences: FLEURS translates ONE English set, so `Chandrayaan-1` and `HJR-3` recur
 * across the fleet, and these five are simply the languages that write a SPACE before the hyphen. Every other
 * language writes it closed and the `(?<![\p{L}\p{M}\p{Nd}])` guard already handles it.
 *
 * ⚠ THIS LIST IS EVIDENCE, NOT A TODO. Do not "fix" an entry by making its hyphen audible.
 */
export const ACCEPTED_SILENT: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
    // DESIGNATIONS — a product name or bill number whose hyphen is silent in speech. Two universal sentences
    // across the five languages that write a SPACE before the hyphen; every other language writes it closed and
    // the `(?<![\p{L}\p{M}\p{Nd}])` guard already handles it.
    // A C FORMAT SPECIFIER, not a percentage. The km wiki carries a programming tutorial whose code survives
    // into the corpus (`scanf("%lf %lf",&a, &b); /*Khmer comment*/`), and the cell selector reaches for it
    // because `%` next to letters is exactly what the percent cell looks for. The `%` in `%lf` is a conversion
    // flag — silence is the CORRECT reading, and a rule that voiced it would be a defect. The line survives the
    // native-script filter legitimately, because its trailing comment really is Khmer.
    km: {
        percent: ["%lf"],
        // ⚠ STRIPPED-MARKUP DEBRIS, not operators — the reading is correct BECAUSE these are not signs at all.
        // A `<` immediately after the Khmer full stop ៕, a `>` standing before a Greek gloss, and a lone `÷` after
        // ។ are all what a removed tag or a mis-rendered entity leaves behind. Reading any of them as arithmetic
        // would be the defect.
        //
        // ⚠ AND THE PROPER FIX IS UPSTREAM, NOT HERE. These three should never have been mined:
        // `wikidump-to-text.py`/`filter-markup.py` own the residue guards, and a bare angle bracket adjacent to
        // sentence punctuation is exactly the shape they exist to catch. Listed here so the gate reads true today,
        // with the cleaning gap recorded rather than papered over — re-mining km after extending those guards
        // should let these entries be deleted.
        "math-sign": ["៕<", "ឈោ្មះ >", "។ ÷"],
    },
    gu: { minus: ["એચજેઆર -3"] },
    kn: { minus: ["ಎಚ್‌ಜೆಆರ್ -3"] },
    mr: { minus: ["चंद्रयान -1"] },
    ta: { minus: ["சந்திரயான் -1"] },
    hi: {
        minus: [
            "चंद्रयान -1",
            // AN ERA RANGE, not a negative: "circa 600 BCE-1200 CE". The range lookbehind spans a digit plus at
            // most two letters and a dot, and `600 ई. पू.-` is longer than that — widening it far enough to
            // reach past two abbreviations would swallow hi's ONE true negative (`ख॰इ॰), -२.८८ परिमाण`), which
            // is the same shape. So the range is named instead of pattern-matched.
            "पू.-1200",
        ],
    },
    my: {
        // AN APPOSITION dash inside a list of ethnic groups — `(Koreans -၂သန်း)`, "Koreans – 2 million".
        // Already documented as an apposition in the `minus` class comment above.
        minus: ["Koreans -၂သန်း"],
        // A COMPOUND JOINER, and this one is a linguistic judgement rather than a shrug. `အချိန်+ရပ်ဝန်းထု` is
        // *spacetime*; the `+` marks a compound and the words are spoken adjacent, exactly as a hyphen would be.
        // burmese/normalize.ts step 12 states the distinction it draws: a GLOSS sign (`=`) separates a label
        // from its expansion and must be audible, a compound joiner need not be. Contrast Italian's
        // `volo+hotel`, a coordination whose reader was recorded saying *più* — same glyph, different function.
        "math-sign": ["အချိန်+ရပ်ဝန်းထု", "ရပ်ဝန်း+အချိန်"],
        // A BARE ITERATION MARK HAS NOTHING TO REPEAT, so silence is the only correct output. These two entries
        // are the ENTIRE evidence for my's `iteration` cell and they are wikitable rows from a Burmese article
        // about JAPANESE kana marks — `ゝ`/`ゞ` are not Burmese orthography at all. Routed to Japanese the mark
        // still reads empty, because `ja` also (correctly) has no antecedent to reduplicate.
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
 * A CURRENCY IS ALSO NAMED BY ITS ISO CODE, which `contribution` cannot see: the code reads as spelled
 * letters, so the sign's own word is nowhere in the IPA and a correct drop still reports. Malay (#601)
 * writes `$45 juta AUD` — the sign and the code are the same currency stated twice, so saying it once is the
 * right reading and the deletion test cannot pass on it. Sign-keyed rather than a bare three-capitals shape,
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
 * This is what separates a PERMISSIBLE drop from a defect. The Assamese corpus writes
 * `($১৪.৭ বিলিয়ন আমেৰিকান ডলাৰ)`, which already says "American dollar", so the correct reading is
 * byte-identical with and without the sign and no correct rule can escape the deletion test there. Ask
 * instead whether the symbol's OWN WORD is in the reading: present → the meaning IS spoken → permissible;
 * absent → nothing says it → a real drop.
 *
 * Strictly narrower than "does the engine know this symbol anywhere": Xhosa reads a bare `$5` but swallowed
 * the `$` in `leUS$30`, and that one still reports. A symbol the engine never reads adds no tokens, so it can
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
 * Two ways it can: the symbol's own word is in the reading (the Assamese case above), or the sentence names
 * a currency by its ISO CODE and that code is itself spoken (the Malay case). The code must be spoken, or a
 * dropped code would license a dropped sign.
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
 * THE PROBE STRING for the differential test: the sentence with the symbol replaced by a SPACE.
 *
 * Exported because there are TWO differential loops, not one — `dropsIn` below tests every class against one
 * sentence, while `coverage.ts` iterates PER CLASS and stops at the first hit, which is deliberate (a class
 * whose instances sit late in the corpus is otherwise never tested; getting that wrong once took the fleet
 * count from 38 defective cells to 15). Those two shapes cannot share a loop, so they share this instead —
 * the alternative was the same one-character decision written in two files, which is exactly the drift this
 * module was extracted to end. It happened anyway: the space fix landed in `dropsIn` and `coverage.ts` kept
 * deleting, so the fleet count did not move until this was hoisted.
 *
 * WHY A SPACE AND NOT DELETION: see `dropsIn`.
 */
export const withoutSymbol = (sentence: string, re: RegExp): string => sentence.replace(re, " ");

/**
 * Run the differential drop test for one sentence.
 *
 * `re.lastIndex = 0` BEFORE EVERY `.test`: these regexes are `/g/` and shared across a whole corpus loop,
 * and `RegExp.prototype.test` ADVANCES lastIndex on a hit — so the next sentence resumed mid-string and the
 * one after that started over. Measured: `re.test(s1), re.test(s2), re.test(s1)` → true, false, true on the
 * same pattern. A scan was therefore skipping about half its candidate sentences, silently.
 */
/**
 * Is this symbol sitting inside a FOREIGN-LANGUAGE SPAN of a bilingual line?
 *
 * ⚠ WHY THIS IS NOT THE SAME AS THE NATIVE-SEGMENT FILTER, and why both are needed. `scripts.ts`'s
 * `isNativeSegment` discards a mined segment with no native letter at all — a wholly English article quoted in a
 * non-Latin wiki. It cannot help with a BILINGUAL segment, which is legitimately in the corpus because most of it
 * IS the language. km's artifact carries `ឧទ្យាន ប៊ីសេន សាងសង់នៅ… It was also envisioned as a leisure destination
 * …costing SGD$8.5 million to build…`: 73 Khmer letters and 306 Latin ones, with the currency sign inside the
 * ENGLISH half. A dropped sign there is a fact about English, not about Khmer, and failing a Khmer gate for it
 * asks the author to source a Khmer reading for a sentence that is not Khmer.
 *
 * The test is deliberately conservative — Latin must OUTNUMBER the native script on BOTH sides of the symbol
 * within a short window — so a native sentence that merely quotes a foreign name still counts as native. And it is
 * INERT for Latin-script languages: there `nativeRe` matches Latin, so Latin can never outnumber it.
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
 * `ACCEPTED_SIGN_SILENCE` is per SIGN, and records refusals argued at length in a language's own file. The scan
 * consulted the per-INSTANCE table (`ACCEPTED_SILENT`) but not the per-CLASS one, so km's `=` was simultaneously a
 * documented refusal (measured: 1,348 glosses and 1,057 code-shaped instances against 109 real arithmetic) and a
 * hard artifact-scan failure. That is the same inconsistency #586 fixed between `coverage.ts` and `review.ts`,
 * one level up: two tables disagreeing about the same character.
 *
 * A coarse-class drop is accepted only when EVERY sign of that class present in the line belongs to an accepted
 * class. A line mixing `=` (accepted for km) with `×` (which km reads) is still a defect, because the `×` may be
 * the one being dropped.
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
        // SUBSTITUTE A SPACE, DO NOT DELETE. Deleting the symbol also changes how its NEIGHBOURS tokenize,
        // and the test then attributes that change to the symbol. This is the merge trap `review.ts` had in
        // its `A&B` probe, arriving from the other direction — in real corpus text, and worst in an
        // agglutinative language. Korean's own artifact writes `32℃에`, which reads as two tokens
        // (*sˈɐmsibi ˈe*); delete the ℃ and `32에` agglutinates into one (*sˈɐmsibie*), so the readings differ,
        // the test concluded the ℃ contributed, and `scan` reported ko as having NO DEFECTS while `20℃` read
        // as bare *isˈip̚*. Replacing the symbol with a space holds the token boundary still, so what is
        // compared is the symbol's own contribution and nothing else.
        const without = say(withoutSymbol(sentence, re));
        if (without === undefined || without !== ipa) continue;
        const symbols = [...new Set(sentence.match(re) ?? [])];
        out.push({ klass, redundant: isRedundant(sentence, ipa, symbols, contribution, say) });
    }
    return out;
}
