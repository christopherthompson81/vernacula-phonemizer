/**
 * Khmer text normalization — symbols and marks the tokenizer cannot see, rewritten as Khmer words.
 *
 * WHY THESE DEFECTS EXIST. `khmer.ts` tokenizes with a deliberately minimal three-way split: a Khmer run, a
 * digit run, a clause mark. Everything else matches NO group and is skipped in silence — `%`, `$`, `°`, `&`,
 * `+`, `/`, an en dash, and the iteration mark ៗ, whose code point falls in the gap between the two Khmer
 * ranges. Two characters that DO match are in the wrong group: `,` and `.` are clause punctuation, so a
 * grouped number and a decimal read as sentences with pauses inside them.
 *
 * ⚠ NATIVE DIGITS ARE THE MAJORITY — Khmer ០-៩ far outnumber ASCII here, so `\d` alone would miss most digit
 * runs and years. Every pattern in this file matches BOTH ranges explicitly.
 *
 * ⚠ THE DECIMAL POINT HAS NO SOURCEABLE READING. Two candidates look available by frequency but fail on
 * sense — neither occurs between digits, and ចុច collocates as "click"/"keyboard"/"press", the verb. So the
 * fallback applies: read the fraction digit-by-digit with no separator word, which here means REMOVING the
 * point so the digits are not split by a clause pause.
 *
 * ⚠ NO CLOCK RULE, deliberately. Khmer writes the frame word itself (`ម៉ោង ៨:៣០`), so inserting ម៉ោង would
 * duplicate what the writer already typed. ASCII `:` is not clause punctuation here, so it is dropped without
 * a pause and the two numbers read adjacently — defensible, and left alone on purpose.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { lastKhmerWord } from "./segment.ts";
import { havePerceptron, segmentRun } from "./khmerPerceptron.ts";
import { tr } from "../../core/provenance.ts";

/**
 * THE SHARED SYMBOL TIER, not local regexes. ⚠ Before declaring a class out of scope, check whether the seam
 * already exists — it covers five of the classes this file would otherwise solve by hand, plus two Khmer needs
 * hand-written rules miss entirely.
 *
 * `unspacedScript` is the load-bearing flag, and the tier's own header documents Khmer's exact symptoms against
 * Chinese: the boundary guards assume spaces between words, so in an unspaced script the ORDINARY case is the one
 * they reject — `20°C` read its C as English *sˈiː*, and `km²` dropped the `²`. Khmer separates words with
 * U+200B rather than a space, so it belongs in the same class as cmn and yue.
 *
 * Sourcing, all corpus-attested with the sense checked against digit or unit adjacency:
 *   percent      ភាគរយ    445, of which 230 directly after a digit
 *   currency     ដុល្លារ  712
 *   °C / °       អង្សាសេ 25 after a digit · អង្សា 74 — declared as UNITS, which is how the tier reads a scale
 *   exponent     ការេ     ⚠ PROBE THE UNIT, NOT THE DIGIT. This word is 0/0 digit-adjacent, which looks
 *                         unsourceable — but `²` attaches to a UNIT, and ការេ is exactly the square-metre word
 *                         (ម៉ែត្រការេ, គីឡូម៉ែត្រការេ). `position: "compound"` because it FUSES, like Swedish
 *                         kvadratkilometer.
 *   multiply     គុណ      3,338, written out between numerals: `៣គុណ៥`, `១៤០០ គុណ ២០០០`
 *   ampersand    និង      40,204 — the commonest word in the language
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["ភាគរយ"],
    // ⚠ `US$` IS ITS OWN KEY because the bare `$` key cannot reach it: the tier refuses a sign preceded by a
    // Latin letter — the guard that stops a sign being read out of the middle of a Latin word — and a
    // multi-character key is matched as a unit, sidestepping it.
    //
    // ⚠ `CN¥` IS DECLARED AND BARE `¥` IS NOT: the SIGN is ambiguous between yen and yuan, the CODE is not.
    // A bare `¥` rule would read `CN¥117,500` with the yen word, which is wrong.
    //
    // The yuan word comes from a pronunciation dictionary rather than the corpus. Currency names are
    // LOANWORDS, so the Khmer form is a transliteration; corpus frequency could not have found it, and the
    // apparent hits for the short spelling are all substrings of unrelated words (the spaceless-script
    // inflation `corpus-words.ts` warns about).
    currency: {
        $: ["ដុល្លារ"],
        "៛": ["រៀល"],
        "€": ["អឺរ៉ូ"],
        "£": ["ផោន"],
        "US$": ["ដុល្លារអាមេរិក"],
        "CN¥": ["យូអាន"],
    },
    // A scale is a UNIT to this tier. `℃` is listed beside `°C` because the corpus carries both spellings, and
    // the bare `°` last so the longer keys win — the tier sorts by length, but declaring the order makes it read.
    // ⚠ THE KEYS MUST BE LOWERCASE. The tier looks a matched unit up as `d.units[u.toLowerCase()]` with a
    // non-null assertion, so a capitalised key is not a missed match — it is a TypeError at runtime
    // ("Cannot read properties of undefined") the first time that unit appears in real text. Declaring `°C`
    // crashed on `៣៥°C`; `°c` matches the same input because the alternation is case-insensitive.
    // Both spellings of the kilometre abbreviation: the corpus writes គម 212 times after a digit and the
    // Latin `km` 95 times, so declaring only one leaves the other reading as a foreign-fallback mangle
    // (`1 km` came out as *muəj ˈʊkm*).
    units: { "គម": ["គីឡូម៉ែត្រ"], km: ["គីឡូម៉ែត្រ"], "°c": ["អង្សាសេ"], "℃": ["អង្សាសេ"], "°": ["អង្សា"] },
    // ⚠ MAGNITUDES ARE WHAT LET A POSTPOSED SIGN COMPOSE. Khmer writes the sign AFTER the number, so without
    // declared magnitudes the number is not adjacent to the sign and the match fails.
    magnitudes: [
        "ពាន់លាន",
        "រយពាន់",
        "រយកោដិ",
        "ពាន់កោដិ",
        "រយលាន",
        "ដប់កោដិ", // stacked: 324, 20, 17, 4, 2, 2
        "លាន",
        "ពាន់",
        "ម៉ឺន",
        "កោដិ", // simple: 1,324 · 558 · 274 · 53
    ],
    exponentWords: { squared: ["ការេ"], position: "suffix" },
    multiply: { times: "គុណ" },
    ampersand: "និង",
    unspacedScript: true,
});

/** Khmer letters, marks and signs — the run the tokenizer treats as one unit. Excludes ៗ by construction. */
const KH = "ក-៓ៜ៝";
/** Both digit ranges, always together. See the header: native digits are 74% of this corpus. */
const D = "\\d០-៩";
/**
 * ⚠ A SEPARATOR IN KHMER INCLUDES ZERO-WIDTH SPACE, AND `\s` DOES NOT MATCH IT. U+200B is not whitespace to a
 * JavaScript regex, and Khmer writers use it as their word separator — 33,285 occurrences in the mined corpus,
 * the single most frequent pattern cell in the language. Every rule below that allows optional space between a
 * number and its symbol must therefore use THIS class, or it silently fails on the commonest way Khmer is typed:
 * `៣០​%` (digit, ZWSP, percent) was left unread, and a ៗ whose antecedent ended in ZWSP kept its mark.
 *
 * Found by reading the artifact scan after the corpus diff was already clean on counts — the residual 43 drops were
 * not a different defect class, they were these rules missing their own trigger.
 */
const SEP = "[\\s\u200b\u200c]*";  // ZWSP, ZWNJ

/** The final word of a Khmer run — the perceptron's answer, or the unigram segmenter's when it is unavailable. */
function lastWord(run: string): string {
    if (!havePerceptron()) return lastKhmerWord(run);
    const parts = segmentRun(run);
    return parts[parts.length - 1] ?? run;
}

export function normalizeKhmer(text: string): string {
    let s = text;

    // ── 0. entities are NOT decoded here ─────────────────────────────────────────────────────────────
    // ⚠ AND THE FIRST VERSION OF THIS FILE DID DECODE THEM, WHICH WAS THE WRONG LAYER. Wikitext carries
    // `&nbsp;`, `&amp;` and numeric character references, and stripping tags does not touch them, so they reach
    // the mined artifacts of 94 of 154 languages — 2,653 occurrences. Solving that here would mean solving it 94
    // times. It now happens once, during extraction, in `tools/normalization/wikidump-to-text.py`.
    //
    // What remains local is one guard, because a caller can pass anything: the shared tier at step 8 turns `&`
    // into និង, and the `&` of an undecoded `&nbsp;` would become "and nbsp" — confident nonsense, read aloud.
    // So that rule declines an `&` that opens an entity rather than re-implementing a decoder.

    // ── 1. ៗ (លេខទោ) = repeat the preceding WORD ──────────────────────────────────────────────────────
    // FIRST, because it is the only rule that reads a Khmer run as a unit; every later rule works on digits
    // and symbols and cannot disturb it. The antecedent is a WORD, not the whole run: Khmer writes no word
    // space, so `អារម្មណ៍នោះៗ` must repeat នោះ ("that") and not អារម្មណ៍នោះ ("that feeling"). The shipped
    // pronunciation lexicon cannot supply the boundary — 12% of top antecedents are entries and none has a lexicon
    // word as a suffix — so it comes from a segmenter.
    //
    // Measured over all 24,413 antecedents: 24.3% are already a single vocabulary word, and repeating the whole
    // run — the only option without a segmenter — would therefore be wrong three times in four.
    //
    // ⚠ THIS USES THE PERCEPTRON, NOT `segment.ts`'s unigram Viterbi, and the difference is not marginal. On
    // 20,000 held-out multi-word runs, scored on exactly what this rule needs — does the FINAL boundary match the
    // human's last typed ZWSP — the two measure:
    //     unigram Viterbi (segment.ts)   51.9%
    //     averaged perceptron            78.7%
    // The perceptron already ships in this path (khmer.ts restores boundaries with it), so leaving the rule on the
    // weaker segmenter would have meant carrying two segmenters and consulting the worse one 24,413 times.
    // `lastKhmerWord` remains the fallback for when the perceptron's weight table is absent.
    //
    // An empty antecedent drops the mark rather than inventing a word, matching Thai's ๆ rule.
    s = tr(s, new RegExp(`([${KH}]+)${SEP}ៗ`, "gu"), (_m, run: string) =>
        run === "" ? "" : `${run} ${lastWord(run)}`,
    );

    // ── 2. de-group thousands ─────────────────────────────────────────────────────────────────────────
    // FIRST among the numeric rules, and ⚠ the grouping comma is otherwise
    // clause punctuation, so `១,០០០,០០០` reads as three sentences — "one", "zero", "zero" — instead of one
    // million. Exactly-three-digit blocks only, so a genuine list `៣,៤,៥` is untouched. 2,788 in the corpus.
    // Applied repeatedly because the lookbehind cannot span a group it has already consumed.
    const degroup = new RegExp(`(?<=[${D}])(?<!(?<![${D}\\.,])0),(?=[${D}]{3}(?![${D}]))`, "gu");
    for (let i = 0; i < 4 && degroup.test(s); i++) s = tr(s, degroup, "");
    // ⚠ AND THE SPACE-GROUPED FORM, which this rule missed and `review.ts` surfaced: it printed `5 000` reading
    // as "pram soun" — "five zero". Khmer groups with a space or a ZWSP as well as a comma, 567 times in the
    // corpus (`៣០ ០០០`, `១១៨ ១៨៣`), and the artifact's own exponent example is `១៨១ ០៣៥ គម²`, which without this
    // is two numbers and a stranded unit. Same three-digit-block guard, so a genuine list of numbers survives.
    const degroupSpace = new RegExp(`(?<=[${D}])(?<!(?<![${D}\\.,])0)[ \u00a0\u202f\u2009\u200b](?=[${D}]{3}(?![${D}]))`, "gu");  // space, NBSP, NNBSP, thin space, ZWSP
    for (let i = 0; i < 4 && degroupSpace.test(s); i++) s = tr(s, degroupSpace, "");

    // ── 3. decimal point ─────────────────────────────────────────────────────────────────────────────
    // AFTER de-grouping, which would otherwise see `៣.៥` as a group boundary. The point becomes a SPACE, not
    // a word: there is no sourceable Khmer reading for it (see the header — both candidates fail on sense), so
    // the digits are read individually and the only fix available is removing the clause pause that currently
    // splits the number in half. Requires a digit on both sides, so an abbreviation dot (គ.ស) and a
    // sentence-final period are untouched. 4,018 in the corpus.
    s = tr(s, new RegExp(`(?<=[${D}])\\.(?=[${D}])`, "gu"), " ");
    // ⚠ THE COMMA IS ALSO A DECIMAL SEPARATOR HERE, which `review.ts` caught: it printed `12,5` reading as
    // "ɗɑp piː , pram" — twelve, pause, five. Khmer writes both forms (`៦,០%`, `០,៣៥`, `៥,៧`), and de-grouping
    // above has already consumed every comma that introduces a three-digit block, so whatever survives to this
    // point is a decimal rather than a group boundary. That ordering is the entire discrimination.
    s = tr(s, new RegExp(`(?<=[${D}]),(?=[${D}])`, "gu"), " ");

    // ── 4. ranges ────────────────────────────────────────────────────────────────────────────────────
    // BEFORE the arithmetic rule, because both compete for a hyphen. In this corpus a dash between two numbers
    // is overwhelmingly a range — 4,014 ranges against 399 signed numbers — so the range reading wins, and a
    // signed number is left to the deeper number path rather than guessed at here.
    s = tr(s, new RegExp(`(?<=[${D}])${SEP}[–—-]${SEP}(?=[${D}])`, "gu"), " ដល់ ");

    // ── 5. equals ────────────────────────────────────────────────────────────────────────────────────
    // ⚠ THIS CLASS WAS REFUSED IN THE FIRST VERSION OF THIS FILE, on an assumption rather than a check —
    // "× ÷ and = have no corpus-attested Khmer reading" — because `sources.ts` had no row for the sign classes
    // and its silence read as absence. ស្មើ is attested 2,077 times, 24 before a digit and 33 after, and the
    // corpus writes the arithmetic out: `៤ = ២៤`, `២=៣៥ តួ`. 5,844 `=` in the corpus.
    // ⚠ DIGIT-FLANKED ONLY, and `review.ts` will report `equals` as DROPPED because its probe is `x = y` —
    // letters, not digits. That divergence is deliberate and the corpus decides it. Of 5,844 `=`:
    //     1,348  Khmer = word     a gloss (`ចក្រវាឡរណប=satellite`)
    //     1,057  code-shaped      `==`, an assignment, a quoted value
    //       109  digit = digit    arithmetic — this rule
    //         9  URL query strings
    // Widening to the probe's shape would fire on the code and the query strings, getting it wrong nearly as
    // often as right. The arithmetic reading is
    // the only one the evidence supports.
    s = tr(s, new RegExp(`(?<=[${D}])${SEP}=${SEP}(?=[${D}])`, "gu"), " ស្មើ ");
    /**
     * ⚠ AND A SPACED `=` BETWEEN ANY TWO OPERANDS, which this file refused for two rounds. The refusal was that
     * the letter-flanked shape is "glosses and code, getting it wrong nearly as often as right" — true of the
     * shape as a whole, and false once SPACING splits it, the same discriminator the plus above needed:
     *
     *     1,649  SPACED, operand-flanked, code operators excluded   ← this rule
     *              of which 1,546 are on a line containing KHMER (prose) and 103 on Khmer-free markup lines
     *       239  UNSPACED                                          ← still silent: `ចក្រវាឡរណប=satellite`, `x=-1/2`
     *       694  code operators `==`, `!=`, `>=`, `<=`             ← still silent, excluded by the lookarounds
     *
     * The 1,546 prose sites are three things, and ស្មើ ("equal, the same") reads all three:
     *   · DEFINITIONAL glosses from dictionary and commentary articles — `ឧបាយកោសល្លបណ្ឌិត = បណ្ឌិត​ព្រោះ​ឈ្លាស…`,
     *     a term and its explanation. A literal reading of the sign, and it keeps the boundary between them.
     *   · GRAMMAR formulas — `(កន = នាម + ឈ្នាប់ + នាម)`, "compound = noun + connector + noun".
     *   · ARITHMETIC whose left operand is algebraic — `12x 2 + 8x + 1 = 0`, which the digit rule cannot see.
     *
     * ⚠ THE 103 KHMER-FREE SITES ARE MIS-READ BY THIS RULE, and they are EasyTimeline markup
     * (`AlignBars = justify`, `BackgroundColors = canvas:c`) that should never have been in a spoken-text corpus.
     * 6% of the sites, all of them markup rather than language — and `allOccurrencesInMarkup` in defects.ts now
     * keeps the scan from reporting that class of line as a language defect.
     */
    s = tr(s, 
        new RegExp(`(?<![=!<>])(?<=[${D}\\p{L}\\p{M}²³)]) = (?=[${D}\\p{L}\\p{M}(])(?![=<>])`, "gu"),
        " ស្មើ ",
    );

    // ── 5b. plus, and plus-minus ─────────────────────────────────────────────────────────────────────
    // ⚠ THE PLUS RULE EXISTED AND I DELETED IT while restructuring for the shared tier — the tier carries
    // `multiply` but has no plus, so migrating silently dropped a class with 74 digit-flanked instances. Caught
    // by `review.ts` reporting `plus` among the DROPPED sign classes. បូក is corpus-attested (3,338).
    s = tr(s, new RegExp(`(?<=[${D}])${SEP}\\+${SEP}(?=[${D}])`, "gu"), " បូក ");
    /**
     * ⚠ AND A SPACED `+` BETWEEN ANY TWO OPERANDS, not only between digits — 274 sites this file used to leave
     * silent. They were counted once as "leading" pluses and refused as undecidable, on the grounds that "142 of
     * 254 sites with no number before the sign are LaTeX or C". That measurement was of the wrong population: it
     * pooled the unspaced `x+3\!` shape with the spaced one. Measured separately on the deduplicated dump, a
     * SPACED plus between operands has 312 sites and ZERO carry a LaTeX or C marker within ±40 characters.
     *
     * What they carry instead is two things a reader voices as បូក:
     *   · KHMER GRAMMAR FORMULAS, which are most of them — `(នាម + កំនត់ + ពង្រីក)` "noun + determiner +
     *     modifier", `(សព្វនាម + ឈ្នាប់ + កន្សោមនាម)` "pronoun + conjunction + noun phrase", and etymological
     *     compounds like `(សមណ + សត្តិ)`. Left silent, the two words run together as one.
     *   · ALGEBRA from the maths articles — `16x² + 24x + 9 = 0`, `( A + B )² = A² + 2AB + B²`. The left operand
     *     ends in a LETTER, which is the only reason the digit-flanked rule above could not see them.
     *
     * The unspaced form is deliberately NOT included: 169 sites, and that is where `x+3\!` and `printf(…a+b)`
     * live. Spacing is the discriminator, and it was there to be measured the first time.
     */
    // ⚠ EITHER SIDE MAY BE A DIGIT OR A LETTER. The first version required a LETTER on the left, which left the
    // mixed shape unread — `cos\alpha_1 + isin\alpha_1` has a digit before the sign and a letter after, so
    // neither this rule nor the digit-flanked one above could see it, and the artifact scan reported four
    // math-sign drops that were all of that shape.
    s = tr(s, new RegExp(`(?<=[${D}\\p{L}\\p{M}²³)]) \\+ (?=[${D}\\p{L}\\p{M}(])`, "gu"), " បូក ");
    /**
     * ⚠ A LEADING `+` ON A BARE NUMBER READS វិជ្ជមាន ("positive value"), and this one is NOT corpus-sourced —
     * it is the weaker tier and is marked as such. `វិជ្ជមាន` is attested 419 times as a WORD, but the SIGN never
     * appears in a sign-value role in this corpus: of 62 sites with no operand before a `+`, 61 are the algebra
     * above and one is a timezone offset (`16:46:36 +0000`). So the reading rests on the word's attestation plus
     * the sign's meaning, which is a LEAD rather than a finding.
     *
     * It is preferred to silence because silence is not neutral here: `review.ts`'s `+5` probe read *pram*, the
     * bare number, with the sign gone — a reader told "five" where the text says "positive five".
     *
     * ⚠ `លើសូន្យ` ("above zero", for temperatures) is NOT implemented. Its pieces are attested — លើ and សូន្យ
     * (781) — but the compound has ZERO occurrences, and exactly one corpus site (a `+`, a number and a degree
     * unit) would use it. Composing an unattested compound to read one site is the zu/xh `Kristu` mistake.
     */
    // ⚠ `%` AND `)` COUNT AS AN OPERAND for this guard. Without `%` in it, `៥០%+១` ("50% + 1", a voting
    // threshold) read *haːsəp pʰiəkrɔːj ʋɨcceəmiən muəj* — "fifty percent POSITIVE one" — because a percent sign
    // is neither a letter nor a digit, so the sign looked like it began a fresh number. An unspaced plus after an
    // operand is left silent rather than mis-read: that is the LaTeX-risk shape.
    s = tr(s, new RegExp(`(?<![\\p{L}\\p{M}${D}%‰\\\\)])\\+${SEP}(?=[${D}])`, "gu"), "វិជ្ជមាន ");
    // ⚠ AND THE TIMEZONE OFFSET, which is the one unspaced shape worth reading: `UTC+7`, `GMT+9`, `JST (UTC+09:00)`
    // — 11 sites, every one a real offset after an uppercase initialism, no misfires available. A reader says
    // "UTC plus seven", so the sign carries meaning here where an unspaced `+` inside LaTeX does not.
    s = tr(s, new RegExp(`(?<=[A-Z]{2,4})\\+(?=[${D}])`, "gu"), " បូក ");
    // ± is always a scientific tolerance here, never a sign pair, so it reads as the two words juxtaposed.
    s = tr(s, new RegExp(`(?<=[${D}])${SEP}±${SEP}(?=[${D}])`, "gu"), " បូក ឬ ដក ");
    // AND THE LEADING FORM, which is what `review.ts`'s `±5` probe tests. Measured before adding rather than
    // after: stripping whitespace properly, exactly 4 sites in the corpus have a ± with no number before it, and
    // all 4 are genuine — the latitude bands `±20°`, `±60°`, `± 50°` and the tolerance `± 0.1 ឆ្នាំ`. No misfires
    // available, so this is safe in a way the leading PLUS is not (see ACCEPTED_SIGN_SILENCE in defects.ts).
    s = tr(s, new RegExp(`(?<![${D}])±${SEP}(?=[${D}])`, "gu"), "បូក ឬ ដក ");

    // ── 6. minus ─────────────────────────────────────────────────────────────────────────────────────
    // AFTER step 4, which has already claimed every dash BETWEEN two numbers — so what reaches here is
    // a dash with no number before it, which is the negative/subtract reading. ដក is attested 3,808 times with
    // `២៨ ដក៥` written out. The ordering is the whole guard: this corpus has 4,014 ranges against 399 signed
    // numbers, so a digit-flanked dash belongs to the range and only a leading one is a minus.
    s = tr(s, new RegExp(`(?<![${D}${KH}])[-−–](?=[${D}])`, "gu"), "ដក ");

    // ── 6b. divide, less-than, greater-than — ROBUSTNESS, not repair ─────────────────────────────────
    // ⚠ THESE SIGNS DO NOT OCCUR DIGIT-FLANKED IN THIS CORPUS: `÷` 0, `<` 0, `>` 2. Khmer writes the WORD
    // instead — ចែក 3,285, and the same is true of `×` (0 signs, គុណ 3,338), which is the central findral finding
    // restated: the signs are absent while the readings are ordinary prose.
    //
    // They are added anyway because the words are SOURCED and the rules are digit-flanked, so on this corpus
    // they cannot misfire — the risk is a guard
    // that fires on something else, and with zero instances there is nothing here to fire on. This is the
    // "pure robustness rather than a repair" case, and it closes the same class for arbitrary input.
    s = tr(s, new RegExp(`(?<=[${D}])${SEP}÷${SEP}(?=[${D}])`, "gu"), " ចែក ");
    s = tr(s, new RegExp(`(?<=[${D}])${SEP}<${SEP}(?=[${D}])`, "gu"), " តិចជាង ");
    s = tr(s, new RegExp(`(?<=[${D}])${SEP}>${SEP}(?=[${D}])`, "gu"), " ច្រើនជាង ");

    // ── 7. fractions ─────────────────────────────────────────────────────────────────────────────────
    // The frame is NUM ភាគ NUM, which the corpus writes out 74 times as `៥ភាគ៦` — the language's own
    // construction rather than a calque. 326 in the corpus.
    s = tr(s, new RegExp(`(?<=[${D}])${SEP}/${SEP}(?=[${D}])`, "gu"), " ភាគ ");

    // ── 8. the shared symbol tier ────────────────────────────────────────────────────────────────────
    // LAST, because it works on numbers and units that the rules above have finished shaping: de-grouping has
    // joined `១៨១ ០៣៥` so the exponent rule can see one number, and the decimal rules have removed the marks
    // that would have split it. See the SYMBOLS declaration for what it owns and where each word came from.
    s = SYMBOLS(s);

    return s;
}
