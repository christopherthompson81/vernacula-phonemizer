/**
 * Malayalam (ml) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ MALAYALAM DIGITS ൦-൯ DO NOT OCCUR in practice; the digit inventory used is ASCII. Step 2 folds them
 * anyway, because it costs nothing and malayalam.ts's own fold happens too late for any rule here.
 *
 * ⚠ THE TWO ZERO-WIDTH CHARACTERS ARE NOT THE SAME DEFECT, and treating them alike — a blanket deletion —
 * is wrong for this script:
 *   · ZWNJ splits the word. The engine's word class is the Malayalam block, which excludes U+200C, so
 *     ഓസ്‌ട്രേലിയ tokenizes as TWO words and comes out [ˈoːsɨ ʈɾˈeːlija] — two primary stresses AND a
 *     spurious samvritokaram [ɨ] on a word-internal virama. Deleting it is correct.
 *   · ZWJ is Malayalam's LEGACY CHILLU ENCODING: ല് + ZWJ IS ൽ. Deleting it leaves a bare word-final
 *     virama, which malayalam.ts then reads as samvritokaram — വിസ്താരത്തില്‍ becomes [ʋˈist̪aːɾat̪ːilɨ]
 *     where the chillu spelling gives [ʋˈist̪aːɾat̪ːil]. It must be MAPPED to the atomic chillu, not
 *     dropped. Almost all of them sit immediately after a virama; the few strays are deleted.
 *
 * ⚠ NO `\b` ANYWHERE. `\b` is defined on ASCII word characters and finds no boundary at all against
 * Malayalam script. Every boundary here is an explicit `(?<![\p{L}\p{M}])` / `(?![\p{L}\p{M}])`.
 *
 * LATIN RUNS ARE LEFT TO THE EMBEDDED FOREIGN PHONEMIZER (US, NSA, FBI, MRI, GMT, DNA, GPS, COVID…). A
 * Latin→Malayalam letter-name table would be invented data.
 */
import { foldNativeDigits } from "../../core/unicode.ts";
import { MANIFEST } from "./manifest.ts";
import { NOT_LETTER_AFTER } from "../../core/boundaries.ts";
import { postposedSign } from "../../core/postposedSign.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import {
    cliticToWords,
    DECIMAL_WORD,
    numberToWords,
    obliqueStem,
    ordinalStem,
    ordinalToWords,
    pluralStem,
} from "./numbers.ts";
import { tr } from "../../core/provenance.ts";

/** Malayalam letter+mark boundary. Never `\b`. */
/**
 * ZWJ chillu ligatures — the legacy encoding of the six chillu letters as base + virama + ZWJ.
 * malayalam.ts already knows the atomic characters and expands them correctly; this only converts the
 * old spelling into the new one so that path is reached.
 */
const ZWJ_CHILLU: Readonly<Record<string, string>> = {
    "ണ": "ൺ", "ന": "ൻ", "ര": "ർ", "ല": "ൽ", "ള": "ൾ", "ക": "ൿ",
};

/**
 * The SHARED symbol tier (percent / currency / units / exponent). Kept in this file rather than in
 * malayalam.ts because its position in the ordering matters and the ordering is this file's job.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: MANIFEST.symbolTier.percent,
    currency: MANIFEST.symbolTier.currency,
    units: MANIFEST.symbolTier.units,
    exponentWords: MANIFEST.symbolTier.exponentWords,
    magnitudes: MANIFEST.symbolTier.magnitudes,
    ampersand: MANIFEST.symbolTier.ampersand,
    multiply: MANIFEST.symbolTier.multiply,
});

/** Read from the manifest — LONGEST FIRST, and the order is load-bearing (see the jsonc). */
const ORDINAL_ENDINGS = MANIFEST.ordinalEndings;

const OBLIQUE_CLITICS = ["ത്തിലെ", "ത്തിൽ", "ത്തില്", "ലാണ്", "ന്റെ", "ലോ", "നും", "ലെ", "ൽ", "ന്"];
const PLURAL_CLITICS = ["കളുടെ", "കളിലെ", "കളിൽ", "കൾ"];
const longestFirst = (a: string[]): string =>
    [...a].sort((x, y) => y.length - x.length).join("|");

/** ത്തിൽ/ത്തിലെ are the ം-final oblique already spelled out; fold them onto the plain clitic. */
const FOLD_CLITIC: Readonly<Record<string, string>> = {
    "ത്തിലെ": "ലെ", "ത്തിൽ": "ൽ", "ത്തില്": "ൽ",
};

/**
 * The Malayalam normalizer. ⚠ A numbered, ORDER-DEPENDENT sequence — the coupling is stated at each step,
 * because it is not recoverable from the code.
 */
export function normalizeMalayalam(input: string): string {
    // 1) ZERO-WIDTH characters — FIRST, because every later rule asserts letter/digit adjacency and an
    //    invisible character defeats all of them. The two classes are NOT treated alike; see the header.
    //    (a) virama + ZWJ is the legacy chillu spelling → the atomic chillu character.
    //    ⚠ THE ZERO-WIDTH CHARACTERS ARE ESCAPED, NOT WRITTEN AS THEMSELVES. Both patterns used to carry
    //    the literal code points, so (a) read as `virama` followed by nothing and (b) read as an EMPTY
    //    character class — the two rules this file's header spends a paragraph distinguishing were both
    //    invisible in their own source. Same defect class as the Burmese U+0001 join separator (#931).
    let s = input.replace(/([ണനരലളക])്\u200d/gu, (_m, base: string) => ZWJ_CHILLU[base]!);
    //    (b) everything else zero-width is a rendering hint with no phonetic content.
    s = tr(s, /[\u200b\u200c\u200d\ufeff]/gu, "");

    // 2) MALAYALAM DIGITS ൦-൯ → ASCII. Zero occurrences here (see the header); folded before every
    //    numeric rule anyway so a native-digit numeral would be eligible for the same de-grouping,
    //    clitic, percent and unit handling as an ASCII one, rather than only for malayalam.ts's own
    //    late fold inside an already-classified digit token.
    s = foldNativeDigits(s);

    // 3) DIGIT DE-GROUPING (×36), before anything that reads punctuation. A grouping comma is otherwise
    //    clause punctuation: 1,234 was reading as ഒന്ന് <pause> ഇരുന്നൂറ്റി മുപ്പത്തിനാല് — a phrase
    //    break inside a number, and the leading digit spoken as a separate numeral. All 36 are Western
    //    3-digit blocks; no Indian 2-then-3 grouping occurs here.
    s = tr(s, /(?<=\d)(?<!(?<![\d\.,])0),(?=\d{3}(?:,\d|[^\d]|$))/gu, "");

    // 4) NUMERIC CLITICS (×133 hyphenated + ~40 spaced), AFTER de-grouping — this corpus writes a
    //    clitic on a grouped numeral ("1,000-മത്തെ" shape) which a `(?<![\d,])` guard would reject
    //    while the comma was still there. BEFORE the symbol tier and the time rule, because those match
    //    on a number and would otherwise consume the numeral out from under the clitic.
    //
    //    Malayalam welds the suffix onto the LAST cardinal word through an oblique/ordinal stem. Left
    //    apart, each of these reached the G2P as a stray stressed syllable: 1789-ൽ ended [… ˈompat̪ɨ l],
    //    a bare consonant; 18-ആം was [pˈad̪ineʈːɨ ˈaːm], two stresses; 150-നും was [… nˈum].
    //    The hyphen itself is optional because the corpus writes both "2010 ൽ" and "1789-ൽ".
    const clitic = (list: string[]): RegExp =>
        new RegExp(`(?<![\\d.,])(\\d+)\\s*[-–]?\\s*(${longestFirst(list)})${NOT_LETTER_AFTER}`, "gu");
    //    (a) ORDINALS first: -ാമത്തെ must not be claimed by a shorter ending, and ordinal endings are
    //        not a subset of the oblique ones, so the two lists cannot be merged.
    s = tr(s, clitic(ORDINAL_ENDINGS), (whole, digits: string, end: string) => {
        const n = Number(digits);
        if (!Number.isSafeInteger(n) || n === 0) return whole;
        // "ആം" is the standalone spelling of the ending "ാം"; "മത്തെ" of "ാമത്തെ".
        const ending = end === "ആം" ? "ാം" : end.startsWith("ാ") ? end : `ാ${end}`;
        const w = ordinalToWords(n, ending);
        return w === "" ? whole : w;
    });
    //    (b) PLURAL clitics before oblique ones: -കളിൽ ends in the oblique -ൽ and would otherwise be
    //        split, leaving a stranded കളി. The plural stem takes -ു, not -ി (ഇരുപതുകളിൽ, attested).
    s = tr(s, clitic(PLURAL_CLITICS), (whole, digits: string, c: string) => {
        const n = Number(digits);
        if (!Number.isSafeInteger(n) || n === 0) return whole;
        const w = cliticToWords(n, c, pluralStem);
        return w === "" ? whole : w;
    });
    //    (c) OBLIQUE case clitics.
    s = tr(s, clitic(OBLIQUE_CLITICS), (whole, digits: string, c: string) => {
        const n = Number(digits);
        if (!Number.isSafeInteger(n) || n === 0) return whole;
        const w = cliticToWords(n, FOLD_CLITIC[c] ?? c, obliqueStem);
        return w === "" ? whole : w;
    });

    // 5) The SHARED symbol tier: percent, currency, units, exponent. UNITS BEFORE DECIMALS (step 7) —
    //    the tier matches a unit only when a NUMBER is adjacent, and rewriting 6.5 to "ആറ് ദശാംശം അഞ്ച്"
    //    first would destroy that adjacency. AFTER de-grouping, so "19,500 km2" is one number.
    s = SYMBOLS(s);

    // 6) TIMES BEFORE the decimal step: a bare-number rule must not claim 06:30, and this corpus writes
    //    the sports times 2:11.60, 1:09.02 and 4:41.30, where a bare-number rule restarting INSIDE the
    //    number is the classic failure.
    //    (a) :00 minutes are DROPPED, not read, or "11:00" gives പതിനൊന്ന് പൂജ്യം.
    //    (b) every remaining digit-colon-digit becomes a SPACE: ⚠ `:` is clause punctuation in this engine
    //        (malayalam.jsonc maps it to ","), so left alone it inserts a pause INSIDE 8:30.
    //    NO മണി is added — the noun is already in the text where it belongs ("11:00 ന് കഴിഞ്ഞപ്പോൾ").
    s = tr(s, /(?<![\d:])([01]?\d|2[0-3]):\s?00(?![\d:.])/gu, "$1");
    s = tr(s, /(?<=\d):\s?(?=\d)/gu, " ");

    // 7) PERCENT ALREADY SPELLED OUT ("93% ശതമാനം"). ⚠ The shared tier's duplicate guard is CURRENCY-ONLY,
    //    so step 5 turns this into "93 ശതമാനം ശതമാനം". Collapsed here rather than in core, because
    //    generalising that guard to percent is a shared-code change.
    s = tr(s, /ശതമാനം(\s+ശതമാനം)+/gu, "ശതമാനം");

    // 8) DECIMALS (×25), after units and times have taken their share.
    s = tr(s, 
        /(?<![\d.])(\d+)\.(\d+)(?![\d.])/gu,
        (_m, int: string, frac: string) => `${int} ${DECIMAL_WORD} ${[...frac].join(" ")}`,
    );

    // 9) DEGREES (×1), last, so a decimal temperature would keep its point. Only the bare sign is
    //    handled: ഡിഗ്രി is written out three times in this corpus, but no scale word (സെൽഷ്യസ്,
    //    ഫാരൻഹീറ്റ്) appears anywhere here and neither °C nor °F occurs, so none is invented.
    // THE PLUS is പ്ലസ്, and Malayalam voices it in BOTH positions (`UTC+1`, `+30°C`). ⚠ This is the
    //    MEASUREMENT plus — the reading a language uses for a signed quantity — which not every language
    //    shares; some read a word meaning "above" instead.
    //
    // THE MINUS AND ±. ⚠ WHETHER A MINUS RULE IS SAFE IS A FACT ABOUT THE TEXT, NOT ABOUT THE GUARD. The
    //    shape no guard can reject is `word · space · hyphen · digit`, which is indistinguishable from a
    //    spaced range or a dashed designation; a language whose text contains that shape must decline the
    //    rule outright. This one does not contain it, so a guarded rule is safe HERE and nowhere by default.
    //
    //    THREE GUARDS: a digit immediately after the sign (rejects `- 2`), a letter or digit immediately
    //    before (rejects closed designations), and a digit ANYWHERE to the left — that last one rejects a
    //    SPACED range or score, which the usual guard misses.
    //
    //    ± IS SOURCED BY THE SAME SENTENCE AS THE MINUS: ml.wikipedia names the glyph directly —
    //    "പ്ലസ്-മൈനസ് ചിഹ്നം, ±, ഒന്നിലധികം അർത്ഥങ്ങളുള്ള ഒരു ഗണിത…" (the plus-minus sign, ±, a mathematical
    //    symbol with several meanings). A citation that names the WORD against the GLYPH is the strongest
    //    form this kind of sourcing takes. ± is then the two words juxtaposed, both already in this file.
    s = tr(s, /±/gu, " പ്ലസ് മൈനസ് ");
    s = tr(s, /(?<![\p{L}\p{M}\p{Nd}])[-−–](?=\d)/gu, (m0: string, off: number, whole: string) =>
        /\d\s*$/u.test(whole.slice(0, off)) ? m0 : "മൈനസ് ");
    s = tr(s, /(\S)\+\s?(?=\d)/gu, "$1 പ്ലസ് ");
    s = tr(s, /(^|\s)\+\s?(?=\d)/gu, "$1പ്ലസ് ");

    // THE DIVISION AND COMPARISON SIGNS.
    //
    // ⚠ A VERB FORM FOUND IN RUNNING TEXT IS USUALLY INFLECTED FOR THAT SENTENCE, not for the slot between
    // two operands. Malayalam is the clearest case: the obvious source phrase is
    // "പന്ത്രണ്ട് ഉപയോഗിച്ച് ഹരിക്കുമ്പോൾ", and BOTH halves are sentence-bound —
    //
    //   ഹരിക്കുമ്പോൾ = ഹരിക്ക്- (divide) + -ുമ്പോൾ, and -ുമ്പോൾ IS "when" (historically -ഉം + പോൾ "time"),
    //   so the form means "when dividing" — a temporal SUBORDINATOR needing a main predicate. Between two
    //   operands there is none, so `6 ÷ 3` would read "six when-divided three", a fragment.
    //
    //   ഉപയോഗിച്ച് ("using") is a converb, not the instrumental -കൊണ്ട് that Malayalam puts on a divisor.
    //
    // What such a phrase DOES establish is the ROOT, ഹരി-. The form shipped is the sign's own NAME, taken
    // from an arithmetic article that names it against the glyph — `=== ഹരണം (÷ or /) ===`. ⚠ The naming
    // citation is the EVIDENCE; placing that name INFIX is an INFERENCE, and is marked as one.
    //
    // ⚠ AND ഹരണം'S CORPUS HITS ARE ALL INSIDE അപഹരണം, "ABDUCTION" — a substring trap. Counting tokens for a
    // short root without checking what encloses them measures the wrong word.
    //
    // ⚠ A BOUND MORPHEME CANNOT BE TOKEN-COUNTED AT ALL. -എക്കാൾ ("than") appears only fused
    // (കൾച്ചർ ഷോക്കിനെക്കാൾ, പരമ്പരാഗത ഭാഷകളെക്കാൾ), so its token count is ×0 BY CONSTRUCTION, not by
    // absence. What IS countable is the head it governs: കൂടുതൽ, കുറവ്. Postposed, so a comparison here
    // cannot read backwards.
    //
    // Emitted UNFUSED: fusing would need the numeral spelled out here plus its sandhi. The phones are
    // unchanged; the tokenizer merely sees a boundary Malayalam would not write.
    s = postposedSign(s, "<", "എക്കാൾ കുറവ്");
    s = postposedSign(s, ">", "എക്കാൾ കൂടുതൽ");
    s = tr(s, /\s?÷\s?/gu, " ഹരണം ");

    // THE EQUALITY. ⚠ SEARCHING ONLY INSIDE MATHS ARTICLES HIDES THE EQUALITY WORD, because those articles
    // WRITE the notation rather than read it aloud. The word turns up immediately in ordinary prose:
    // തുല്യം in "കിലോഗ്രാമിന്റെ പിണ്ഡത്തിന് തുല്യം" (equal TO the mass of the kilogram), and the predicative
    // സമമാണ് ("is equal").
    //
    // ⚠ AND `സമം` IS THE WRONG WORD FOR THIS SLOT, though it is the commonest candidate. It means "in equal
    // MEASURE" adverbially ("ഇവ സമം കഷായം" — these in equal parts) and is separately the name of a rhetorical
    // figure. Its Tamil, Kannada and Telugu cognates (சமம், ಸಮ, సమానం) ARE the equality word there — all four
    // are the same Sanskrit loan *sama* — so a sister-language inference picks exactly the wrong member of
    // the set. A cognate tells you where to look, not which sense the borrowing settled into.
    //
    // ⚠ POSTPOSED, because the attested construction is DATIVE + തുല്യം: the standard comes first
    // (`പിണ്ഡത്തിന് തുല്യം`), so `A = B` is "A B-ന് തുല്യം". The dative is emitted unfused, as above.
    s = postposedSign(s, "=", "ന് തുല്യം");

    s = tr(s, /(\d)\s?°\s?/gu, "$1 ഡിഗ്രി ");

    return s;
}

/** Exposed for tests: the corrected cardinal/ordinal readings the engine now composes. */
export { numberToWords, obliqueStem, ordinalStem, ordinalToWords };
